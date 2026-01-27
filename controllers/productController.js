const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const { body, validationResult } = require("express-validator");
// const { protect, authorize, checkPermission } = require("../middleware/auth");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const Inventory = require("../models/Inventory");

// Get all products

exports.getAllProducts = catchAsync(async (req, res, next) => {
  const { category, supplier, minPrice, maxPrice, search } = req.query;

  let filter = {};

  if (category) filter.category = category;
  if (supplier) filter.supplier = supplier;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
    ];
  }

  if (minPrice || maxPrice) {
    filter.sellingPrice = {};
    if (minPrice) filter.sellingPrice.$gte = Number(minPrice);
    if (maxPrice) filter.sellingPrice.$lte = Number(maxPrice);
  }

  const products = await Product.find(filter)
    .populate("supplier", "name company")
    .sort({ createdAt: -1 });

  const productsArray = await Promise.all(
    products.map(async (prod) => {
      const [inventory] = await Inventory.find({ product: prod._id });
      // console.log("inventory", inventory);
      return { prod, availableStock: inventory?.currentStock };
    })
  );

  // console.log("productArray", productsArray);

  res.status(200).json({
    status: "success",
    count: productsArray.length,
    data: productsArray,
  });
});

// Get single product

exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id).populate("supplier");

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: product,
  });
});

// Create new product

exports.createProduct = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array(), 400));
  }
  const supplier = await Supplier.findById(req.body.supplier);
  if (!supplier) {
    return next(new AppError("Supplier not found", 404));
  }

  const product = new Product(req.body);
  await product.save();

  // Add product to supplier's products list
  if (!supplier.productsSupplied.includes(product._id)) {
    supplier.productsSupplied.push(product._id);
    await supplier.save();
  }

  res.status(201).json({
    status: "success",
    data: product,
  });
});

// Update product

exports.updateProduct = catchAsync(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // Update product
  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(203).json({
    status: "success",
    data: product,
  });
});

// Delete product

exports.deleteProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // Soft delete by marking as inactive
  product.isActive = false;
  await product.save();

  res.status(204).json({
    status: "success",
    message: "Product deactivated successfully",
  });
});

// Get product categories

exports.getAllProductCategories = catchAsync(async (req, res, next) => {
  const categories = await Product.distinct("category");
  res.status(200).json({
    status: "success",
    data: categories,
  });
});

// Get mattress thickness options

exports.getProductMattressThicknessOptions = catchAsync(
  async (req, res, next) => {
    const thicknessOptions = await Product.distinct("dimensions.thickness", {
      category: "mattress",
      "dimensions.thickness": { $ne: null },
    }).sort();

    res.status(200).json({
      status: "success",
      data: thicknessOptions,
    });
  }
);

// Get mattress density options
exports.getProductMattressDensityOptions = catchAsync(
  async (req, res, next) => {
    const densityOptions = await Product.distinct("dimensions.density", {
      category: "mattress",
      "dimensions.density": { $ne: null },
    }).sort();

    res.status(200).json({
      status: "success",
      data: densityOptions,
    });
  }
);

// Update product inventory
exports.updateProductInventory = catchAsync(async (req, res, next) => {
  const {
    // currentStock,
    // reservedStock,
    // reorderPoint,
    minStockLevel,
    maxStockLevel,
  } = req.body;

  // console.log("req", req.body);

  const product = await Product.findById(req.params.id);
  // const inventory = await Inventory.findOneAndUpdate({product: product._id})

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // Update inventory fields
  // if (currentStock !== undefined) {
  //   product.currentStock = currentStock;
  //   product.lastRestocked = new Date();
  // }

  // if (reservedStock !== undefined) {
  //   product.reservedStock = reservedStock;
  // }

  if (minStockLevel !== undefined) {
    product.minStockLevel = minStockLevel;
  }

  if (maxStockLevel !== undefined) {
    product.maxStockLevel = maxStockLevel;
  }

  // if (reorderPoint !== undefined) {
  //   product.reorderPoint = reorderPoint;
  // }

  const p = await product.save();
  // console.log("pppp", p);

  res.status(200).json({
    status: "success",
    data: product,
    message: "Inventory updated successfully",
  });
});
