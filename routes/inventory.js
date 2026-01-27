const express = require("express");
const router = express.Router();
const { protect, checkPermission } = require("../middleware/auth");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");

// Get all inventory items
router.get(
  "/",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const { status, lowStock, category } = req.query;

      let filter = {};

      if (status) filter.status = status;
      if (lowStock === "true") {
        filter.availableStock = { $lt: 10 };
      }

      const inventory = await Inventory.find(filter)
        .populate({
          path: "product",
          select: "name sku category sellingPrice unitCost",
          match: category ? { category } : {},
        })
        .sort("availableStock");

      // Filter out null products if category filter was applied
      const filteredInventory = inventory.filter((item) => item.product);

      res.json({
        success: true,
        count: filteredInventory.length,
        data: filteredInventory,
      });
    } catch (error) {
      console.error("Get inventory error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Get single inventory item
router.get(
  "/:id",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const inventory = await Inventory.findById(req.params.id).populate(
        "product"
      );

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: "Inventory item not found",
        });
      }

      res.json({
        success: true,
        data: inventory,
      });
    } catch (error) {
      console.error("Get inventory item error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// // Update inventory stock
// router.patch(
//   "/:id/stock",
//   protect,
//   checkPermission("manage_inventory"),
//   async (req, res) => {
//     try {
//       const { action, quantity, reason } = req.body;
//       console.log("req", req.body);

//       if (!["add", "remove", "set"].includes(action)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid action. Use add, remove, or set",
//         });
//       }

//       if (quantity === undefined || quantity < 0) {
//         return res.status(400).json({
//           success: false,
//           message: "Valid quantity is required",
//         });
//       }

//       const inventory = await Inventory.findById(req.params.id);

//       if (!inventory) {
//         return res.status(404).json({
//           success: false,
//           message: "Inventory item not found",
//         });
//       }

//       let newStock;
//       switch (action) {
//         case "add":
//           newStock = inventory.currentStock + quantity;
//           break;
//         case "remove":
//           if (inventory.currentStock < quantity) {
//             return res.status(400).json({
//               success: false,
//               message: "Insufficient stock to remove",
//             });
//           }
//           newStock = inventory.currentStock - quantity;
//           break;
//         case "set":
//           newStock = quantity;
//           break;
//       }

//       inventory.currentStock = newStock;
//       inventory.lastRestocked =
//         action === "add" ? Date.now() : inventory.lastRestocked;
//       inventory.lastChecked = Date.now();
//       await inventory.save();

//       // Create stock movement record (you can add a StockMovement model later)

//       res.json({
//         success: true,
//         message: `Stock ${
//           action === "add" ? "added" : action === "remove" ? "removed" : "set"
//         } successfully`,
//         data: inventory,
//       });
//     } catch (error) {
//       console.error("Update stock error:", error);
//       res.status(500).json({
//         success: false,
//         message: "Server error",
//       });
//     }
//   }
// );

// Get low stock alerts
router.get(
  "/alerts/low-stock",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const lowStockItems = await Inventory.find({
        $or: [{ availableStock: { $lt: 10 } }, { status: "low_stock" }],
      })
        .populate("product", "name sku category sellingPrice")
        .sort("availableStock");

      res.json({
        success: true,
        count: lowStockItems.length,
        data: lowStockItems,
      });
    } catch (error) {
      console.error("Get low stock alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Bulk update inventory
router.post(
  "/bulk-update",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Updates array is required",
        });
      }

      const results = [];

      for (const update of updates) {
        try {
          const inventory = await Inventory.findOne({
            product: update.productId,
          });

          if (inventory) {
            inventory.currentStock = update.newStock;
            inventory.lastChecked = Date.now();
            await inventory.save();
            results.push({
              productId: update.productId,
              success: true,
              newStock: inventory.currentStock,
            });
          } else {
            results.push({
              productId: update.productId,
              success: false,
              error: "Product not found in inventory",
            });
          }
        } catch (error) {
          results.push({
            productId: update.productId,
            success: false,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        results,
      });
    } catch (error) {
      console.error("Bulk update error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// const express = require("express");
// const router = express.Router();
// const { protect, checkPermission } = require("../middleware/auth");
// const Inventory = require("../models/Inventory");
// const Product = require("../models/Product");

// // Get all inventory items
// router.get("/", protect, checkPermission("manage_inventory"), async (req, res) => {
//   try {
//     const inventory = await Inventory.find()
//       .populate("product", "name category sku sellingPrice")
//       .sort({ availableStock: 1 });

//     res.json({
//       success: true,
//       count: inventory.length,
//       data: inventory,
//     });
//   } catch (error) {
//     console.error("Get inventory error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// });

// // Get inventory item by ID
// router.get("/:id", protect, checkPermission("manage_inventory"), async (req, res) => {
//   try {
//     const inventory = await Inventory.findById(req.params.id).populate("product");

//     if (!inventory) {
//       return res.status(404).json({
//         success: false,
//         message: "Inventory item not found",
//       });
//     }

//     res.json({
//       success: true,
//       data: inventory,
//     });
//   } catch (error) {
//     console.error("Get inventory item error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// });

// Update stock level
router.patch(
  "/:id/stock",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const { currentStock, notes } = req.body;

      const inventory = await Inventory.findById(req.params.id).populate(
        "product"
      );

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: "Inventory item not found",
        });
      }

      // Update stock
      inventory.currentStock = currentStock;
      inventory.lastChecked = Date.now();

      if (notes) {
        inventory.notes = notes;
      }

      await inventory.save();

      // console.log("inventory", inventory);
      res.json({
        success: true,
        data: inventory,
        message: "Stock updated successfully",
      });
    } catch (error) {
      console.error("Update stock error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Adjust stock (add or remove)
router.patch(
  "/:id/adjust",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      const { adjustment, reason } = req.body;

      const inventory = await Inventory.findById(req.params.id);

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: "Inventory item not found",
        });
      }

      // Calculate new stock
      const newStock = Math.max(
        0,
        inventory.currentStock + parseInt(adjustment)
      );

      // Update stock
      inventory.currentStock = newStock;
      inventory.lastChecked = Date.now();

      // Add stock adjustment history
      if (!inventory.adjustmentHistory) {
        inventory.adjustmentHistory = [];
      }

      inventory.adjustmentHistory.push({
        date: new Date(),
        adjustment: parseInt(adjustment),
        reason: reason || "Manual adjustment",
        adjustedBy: req.user.id,
        previousStock: inventory.currentStock - parseInt(adjustment),
        newStock: newStock,
      });

      await inventory.save();

      res.json({
        success: true,
        data: inventory,
        message: `Stock ${
          adjustment >= 0 ? "increased" : "decreased"
        } by ${Math.abs(adjustment)}`,
      });
    } catch (error) {
      console.error("Adjust stock error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// // Get low stock items
// router.get("/alerts/low-stock", protect, async (req, res) => {
//   try {
//     const lowStockItems = await Inventory.find({
//       availableStock: { $lt: 10 },
//       status: { $ne: "out_of_stock" }
//     })
//       .populate("product", "name sku category")
//       .sort({ availableStock: 1 })
//       .limit(20);

//     res.json({
//       success: true,
//       count: lowStockItems.length,
//       data: lowStockItems,
//     });
//   } catch (error) {
//     console.error("Get low stock error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// });

// module.exports = router;

// // Update product inventory
// router.patch(
//   "/:id/inventory",
//   protect,
//   checkPermission("manage_inventory"),
//   async (req, res) => {
//     try {
//       const {
//         currentStock,
//         reservedStock,
//         minStockLevel,
//         maxStockLevel,
//         reorderPoint,
//       } = req.body;

//       const product = await Product.findById(req.params.id);

//       if (!product) {
//         return res.status(404).json({
//           success: false,
//           message: "Product not found",
//         });
//       }

//       // Update inventory fields
//       if (currentStock !== undefined) {
//         product.currentStock = currentStock;
//         product.lastRestocked = new Date();
//       }

//       if (reservedStock !== undefined) {
//         product.reservedStock = reservedStock;
//       }

//       if (minStockLevel !== undefined) {
//         product.minStockLevel = minStockLevel;
//       }

//       if (maxStockLevel !== undefined) {
//         product.maxStockLevel = maxStockLevel;
//       }

//       if (reorderPoint !== undefined) {
//         product.reorderPoint = reorderPoint;
//       }

//       await product.save();

//       res.json({
//         success: true,
//         data: product,
//         message: "Inventory updated successfully",
//       });
//     } catch (error) {
//       console.error("Update inventory error:", error);
//       res.status(500).json({
//         success: false,
//         message: "Server error",
//       });
//     }
//   }
// );

// Get product inventory history
router.get(
  "/:id/inventory/history",
  protect,
  checkPermission("manage_inventory"),
  async (req, res) => {
    try {
      // This would typically come from an InventoryHistory model
      // For now, we'll return sample data
      const history = [
        {
          date: new Date(),
          type: "sale",
          quantity: -2,
          reference: "SALE-001",
          stockBefore: 50,
          stockAfter: 48,
        },
        {
          date: new Date(Date.now() - 86400000),
          type: "restock",
          quantity: 20,
          reference: "PO-001",
          stockBefore: 30,
          stockAfter: 50,
        },
      ];

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error("Get inventory history error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

module.exports = router;
