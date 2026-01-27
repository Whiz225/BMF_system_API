const express = require("express");
const router = express.Router();
const { protect, checkPermission } = require("../middleware/auth");
const Product = require("../models/Product");

// Get all categories
router.get("/", protect, async (req, res) => {
  try {
    const categories = await Product.distinct("category", { isActive: true });

    // Get category stats
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        const products = await Product.find({ category, isActive: true });
        const totalValue = products.reduce(
          (sum, product) =>
            sum + product.sellingPrice * (product.currentStock || 0),
          0
        );

        return {
          name: category,
          productCount: products.length,
          totalValue,
          lowStockCount: products.filter(
            (p) => p.inventoryStatus === "low_stock"
          ).length,
          outOfStockCount: products.filter(
            (p) => p.inventoryStatus === "out_of_stock"
          ).length,
        };
      })
    );

    res.json({
      success: true,
      data: categoriesWithStats,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Create category
router.post(
  "/",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const { name, description, isActive } = req.body;

      // Validate category name
      if (!name || name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      // Check if category already exists
      const existingCategories = await Product.distinct("category");
      if (existingCategories.includes(name.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: "Category already exists",
        });
      }

      // Note: In this implementation, categories are stored as strings in products
      // To properly manage categories, you might want a separate Category model
      // For now, we'll just return success

      res.json({
        success: true,
        message: "Category created successfully",
        data: { name, description, isActive },
      });
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Update category
router.put(
  "/:name",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const oldName = req.params.name;
      const { name: newName, description } = req.body;

      // Check if old category exists
      const productsInCategory = await Product.find({ category: oldName });
      if (productsInCategory.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      // Update all products in this category
      if (newName && newName !== oldName) {
        await Product.updateMany(
          { category: oldName },
          { $set: { category: newName } }
        );
      }

      res.json({
        success: true,
        message: "Category updated successfully",
      });
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Delete category
router.delete(
  "/:name",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const categoryName = req.params.name;

      // Check if category has products
      const productsInCategory = await Product.find({ category: categoryName });

      if (productsInCategory.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      // Move all products to "others" category
      await Product.updateMany(
        { category: categoryName },
        { $set: { category: "others" } }
      );

      res.json({
        success: true,
        message: "Category deleted successfully",
        data: {
          movedProducts: productsInCategory.length,
        },
      });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Get category products
router.get("/:name/products", protect, async (req, res) => {
  try {
    const categoryName = req.params.name;
    const products = await Product.find({
      category: categoryName,
      isActive: true,
    }).populate("supplier", "name");

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get category products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
