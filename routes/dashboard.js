const express = require("express");
const router = express.Router();
const { protect, checkPermission } = require("../middleware/auth");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Inventory = require("../models/Inventory");
const { constants } = require("buffer");

// Update the dashboard stats function
router.get("/stats", protect, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get sales data
    const [recentSales, todaysSales, totalSales, totalRevenueAgg] =
      await Promise.all([
        Sale.find({
          createdAt: { $gte: thirtyDaysAgo },
          status: "completed",
        })
          .populate("customer", "name")
          .populate("items.product", "name")
          .sort({ createdAt: -1 })
          .limit(5),
        Sale.find({
          createdAt: { $gte: today },
          status: "completed",
        }),
        Sale.countDocuments({ status: "completed" }),
        Sale.aggregate([
          {
            $match: { status: "completed", createdAt: { $gte: thirtyDaysAgo } },
          },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);

    // Get inventory data directly from products
    const products = await Product.find({ isActive: true })
      .populate("supplier", "name")
      .sort({ currentStock: 1 });

    const inventories = await Inventory.find()
      .populate("product", "minStockLevel dimensions name sku")
      .sort({ currentStock: 1 });

    const lowStockProducts = inventories.filter(
      (p) =>
        p.status === "low_stock" || p.currentStock <= p.product.minStockLevel
    );

    const outOfStockProducts = inventories.filter(
      (p) => p.status === "out_of_stock" || p.currentStock <= 0
    );

    // Get top selling products
    const topProducts = await Sale.aggregate([
      { $match: { status: "completed", createdAt: { $gte: thirtyDaysAgo } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalPrice" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    // Populate product info
    for (const product of topProducts) {
      const prod = await Product.findById(product._id).select(
        "name sku category"
      );
      product.name = prod?.name || "Unknown Product";
      product.sku = prod?.sku || "";
      product.category = prod?.category || "";
    }

    const stats = {
      sales: {
        total: totalSales,
        today: todaysSales.length,
        revenue: totalRevenueAgg.length > 0 ? totalRevenueAgg[0].total : 0,
        thirtyDayRevenue:
          totalRevenueAgg.length > 0 ? totalRevenueAgg[0].total : 0,
      },
      inventory: {
        totalItems: products.length,
        totalValue: products.reduce(
          (sum, p) => sum + p.sellingPrice * p.currentStock,
          0
        ),
        inStock: products.filter((p) => p.inventoryStatus === "in_stock")
          .length,
        lowStock: lowStockProducts.length,
        outOfStock: outOfStockProducts.length,
      },
      customers: {
        total: await Customer.countDocuments({ isActive: true }),
        newToday: await Customer.countDocuments({
          createdAt: { $gte: today },
          isActive: true,
        }),
      },
      topSellingProducts: topProducts,
      recentSales: recentSales,
      lowStockItems: lowStockProducts.slice(0, 5).map((product) => ({
        product: {
          _id: product._id,
          name: product.product.name,
          sku: product.product.sku,
          dimensions: product.product.dimensions,
        },
        availableStock: product.currentStock,
        status: product.inventoryStatus,
        reorderPoint: product.reorderPoint,
      })),
    };

    // Only include profit if user has permission
    if (req.user.permissions.get("view_profits")) {
      const profitData = await Sale.aggregate([
        { $match: { status: "completed", createdAt: { $gte: thirtyDaysAgo } } },
        { $unwind: "$items" },
        { $group: { _id: null, total: { $sum: "$items.profit" } } },
      ]);
      stats.sales.profit = profitData.length > 0 ? profitData[0].total : 0;
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Get sales chart data
router.get(
  "/sales-chart",
  protect,
  checkPermission("view_reports"),
  async (req, res) => {
    try {
      const { period = "7d" } = req.query;
      let days = 7;

      if (period === "30d") days = 30;
      else if (period === "90d") days = 90;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const salesData = await Sale.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: "completed",
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            revenue: { $sum: "$totalAmount" },
            salesCount: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      res.json({
        success: true,
        data: salesData,
      });
    } catch (error) {
      console.error("Get sales chart error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Get inventory chart data
router.get(
  "/inventory-chart",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const inventoryByCategory = await Product.aggregate([
        {
          $lookup: {
            from: "inventories",
            localField: "_id",
            foreignField: "product",
            as: "inventory",
          },
        },
        {
          $unwind: {
            path: "$inventory",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: "$category",
            totalStock: { $sum: "$inventory.currentStock" },
            totalValue: {
              $sum: {
                $multiply: ["$inventory.currentStock", "$sellingPrice"],
              },
            },
            productCount: { $sum: 1 },
          },
        },
      ]);

      res.json({
        success: true,
        data: inventoryByCategory,
      });
    } catch (error) {
      console.error("Get inventory chart error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

module.exports = router;
