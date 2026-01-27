const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["mattress", "pillow", "foot_mat", "bedsheet", "others"],
      required: true,
    },
    // For mattresses only
    dimensions: {
      thickness: {
        type: Number, // in inches
        required: function () {
          return this.category === "mattress";
        },
      },
      density: {
        type: Number, // density rating
        required: function () {
          return this.category === "mattress";
        },
      },
      length: Number, // optional
      width: Number, // optional
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    profitMargin: {
      type: Number,
      default: function () {
        if (this.unitCost && this.sellingPrice) {
          return ((this.sellingPrice - this.unitCost) / this.unitCost) * 100;
        }
        return 0;
      },
    },
    sku: {
      type: String,
      // unique: true,
      // required: true,
      uppercase: true,
      trim: true,
    },
    description: String,
    image: String,
    minStockLevel: {
      type: Number,
      default: 5,
      min: 0,
    },
    maxStockLevel: {
      type: Number,
      default: 100,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [String],
  },
  {
    timestamps: true,
    lastRestocked: Date,
    lastSold: Date,
  }
);

// Generate SKU before saving
productSchema.pre("save", function (next) {
  if (this.isNew && !this.sku) {
    const prefix = this.category.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const date = new Date().getTime().toString().slice(-4);
    this.sku = `${prefix}-${random}-${date}`;
  }
  next();
});

// Calculate profit margin before saving
productSchema.pre("save", function (next) {
  if (this.unitCost && this.sellingPrice) {
    this.profitMargin =
      ((this.sellingPrice - this.unitCost) / this.unitCost) * 100;
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
