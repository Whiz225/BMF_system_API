const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    location: {
      type: String,
      trim: true,
    },
    lastRestocked: Date,
    lastChecked: {
      type: Date,
      default: Date.now,
    },
    stockAlerts: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["in_stock", "low_stock", "out_of_stock", "discontinued"],
      default: "in_stock",
    },
  },
  {
    timestamps: true,
  }
);

// Update status based on available stock
inventorySchema.pre("save", function (next) {
  const product = this;

  if (product.currentStock <= 0) {
    product.status = "out_of_stock";
  } else if (product.currentStock <= product.product.minStockLevel) {
    // Assuming minStockLevel is 10
    product.status = "low_stock";
  } else {
    product.status = "in_stock";
  }

  next();
});

inventorySchema.methods.getCurrentStock = function () {
  console.log("this", this);
  return {
    currentStock: this.currentStock,
    status: this.status,
    stockAlerts: this.stockAlerts,
  };
};

// Virtual for low stock alert
inventorySchema.virtual("needsRestock").get(function () {
  return this.currentStock < this.product.product.minStockLevel; // Customize threshold
});

module.exports = mongoose.model("Inventory", inventorySchema);
