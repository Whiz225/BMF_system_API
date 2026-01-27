const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const mongoose = require("mongoose");

const { body, validationResult } = require("express-validator");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const Customer = require("../models/Customer");

// Get all sales
exports.getAllSales = catchAsync(async (req, res) => {
  const { startDate, endDate, status, paymentMethod } = req.query;

  let filter = {};

  // Date range filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  // Salespersons can only see their own sales
  if (req.user.role === "salesperson") {
    filter.soldBy = req.user._id;
  }

  const sales = await Sale.find(filter)
    .populate("customer", "name phone email")
    .populate("soldBy", "firstName lastName")
    .populate("items.product", "name sku sellingPrice")
    .sort({ createdAt: -1 });

  // Calculate summary
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalProfit = sales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => itemSum + item.profit, 0);
  }, 0);

  res.status(200).json({
    status: "success",
    count: totalSales,
    summary: {
      totalRevenue,
      totalProfit,
      averageSale: totalSales > 0 ? totalRevenue / totalSales : 0,
    },
    data: sales,
  });
});

// Update the createNewSale function
exports.createNewSale = catchAsync(async (req, res, next) => {
  console.log("request", req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array(), 400));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer: customerId, items, ...saleData } = req.body;

    // Validate all products and check stock
    const validatedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        throw new Error(`Product ${item.product} not found`);
      }

      // Check inventory - using product's own stock tracking
      if (product.availableStock < item.quantity) {
        throw new Error(
          `Insufficient stock for product: ${product.name}. Available: ${product.availableStock}, Requested: ${item.quantity}`
        );
      }

      // Update product inventory
      product.currentStock -= item.quantity;
      product.lastSold = new Date();
      await product.save({ session });

      const unitPrice = product.sellingPrice;
      const totalPrice = unitPrice * item.quantity;
      const profit = (unitPrice - product.unitCost) * item.quantity;

      validatedItems.push({
        product: product._id,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        profit,
      });

      subtotal += totalPrice;
    }

    // Handle customer
    let customer = null;
    if (customerId) {
      customer = await Customer.findById(customerId).session(session);
      if (customer) {
        customer.totalPurchases += 1;
        customer.totalSpent += saleData.totalAmount || subtotal;
        customer.lastPurchaseDate = new Date();
        await customer.save({ session });
      }
    }

    // Create sale
    const sale = new Sale({
      ...saleData,
      customer: customer ? customer._id : null,
      items: validatedItems,
      subtotal,
      soldBy: req.user._id,
      status:
        saleData.amountPaid >=
        subtotal - (saleData.discount || 0) + (saleData.tax || 0)
          ? "completed"
          : "pending",
    });

    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate and return
    const populatedSale = await Sale.findById(sale._id)
      .populate("customer", "name phone")
      .populate("items.product", "name sku category")
      .populate("soldBy", "firstName lastName");

    console.log("populatedSale", populatedSale);

    res.status(201).json({
      success: true,
      data: populatedSale,
      message: "Sale created successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Create sale error:", error);
    return next(new AppError(error.message || "Failed to create sale", 400));
  }
});

// Add function to update sale items
exports.updateSaleItems = catchAsync(async (req, res, next) => {
  const { items } = req.body;
  const saleId = req.params.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findById(saleId).session(session);
    if (!sale) {
      throw new Error("Sale not found");
    }

    // Restore original items to inventory
    for (const oldItem of sale.items) {
      const product = await Product.findById(oldItem.product).session(session);
      if (product) {
        product.currentStock += oldItem.quantity;
        await product.save({ session });
      }
    }

    // Validate and add new items
    const validatedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) {
        throw new Error(`Product ${item.product} not found`);
      }

      if (product.availableStock < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      // Update product inventory
      product.currentStock -= item.quantity;
      await product.save({ session });

      const unitPrice = product.sellingPrice;
      const totalPrice = unitPrice * item.quantity;
      const profit = (unitPrice - product.unitCost) * item.quantity;

      validatedItems.push({
        product: product._id,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        profit,
      });

      subtotal += totalPrice;
    }

    // Update sale
    sale.items = validatedItems;
    sale.subtotal = subtotal;
    sale.totalAmount = subtotal - (sale.discount || 0) + (sale.tax || 0);
    sale.balance = sale.totalAmount - (sale.amountPaid || 0);

    if (sale.balance <= 0) {
      sale.status = "completed";
    }

    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      data: sale,
      message: "Sale items updated successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Update sale items error:", error);
    return next(
      new AppError(error.message || "Failed to update sale items", 400)
    );
  }
});

// Get single sale
exports.getSale = catchAsync(async (req, res, next) => {
  // console.log("user2222", req.user);
  const sale = await Sale.findById(req.params.id)
    .populate("customer")
    .populate("soldBy", "firstName lastName")
    .populate("items.product");

  if (!sale) {
    return next("Sale not found", 404);
  }

  // Check permission
  if (
    req.user.role === "salesperson" &&
    sale.soldBy._id.toString() !== req.user._id.toString()
  ) {
    return next("Not authorized to view this sale", 403);
  }

  res.status(200).json({
    status: "success",
    data: sale,
  });
});

exports.updateSales = catchAsync(async (req, res, next) => {
  const {
    discount,
    tax,
    amountPaid,
    totalAmount,
    balance,
    paymentMethod,
    notes,
    status,
  } = req.body;

  // if (!["pending", "completed", "cancelled", "refunded"].includes(status)) {
  //   return next(new AppError("Invalid status", 400));
  // }

  const sale = await Sale.findById(req.params.id);

  if (!sale) {
    return next(new AppError("Sale not found", 404));
  }

  if (status) sale.status = status;
  if (tax) sale.tax = tax;
  if (amountPaid) sale.amountPaid = amountPaid;
  if (totalAmount) sale.totalAmount = totalAmount;
  if (balance) sale.balance = balance;
  if (paymentMethod) sale.paymentMethod = paymentMethod;
  if (notes) sale.notes = notes;

  await sale.save();

  // If cancelled or refunded, restock items
  if (status === "cancelled" || status === "refunded") {
    for (const item of sale.items) {
      const inventory = await Inventory.findOne({ product: item.product });
      if (inventory) {
        inventory.currentStock += item.quantity;
        await inventory.save();
      }
    }
  }

  console.log("sale", sale);

  res.status(203).json({
    status: "success",
    message: `Sale status updated to ${status}`,
    data: sale,
  });
});

// Update sale status
exports.updateSalesStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  if (!["pending", "completed", "cancelled", "refunded"].includes(status)) {
    return next(new AppError("Invalid status", 400));
  }

  const sale = await Sale.findById(req.params.id);

  if (!sale) {
    return next(new AppError("Sale not found", 404));
  }

  sale.status = status;
  await sale.save();

  // If cancelled or refunded, restock items
  if (status === "cancelled" || status === "refunded") {
    for (const item of sale.items) {
      const inventory = await Inventory.findOne({ product: item.product });
      if (inventory) {
        inventory.currentStock += item.quantity;
        await inventory.save();
      }
    }
  }

  res.status(203).json({
    status: "success",
    message: `Sale status updated to ${status}`,
    data: sale,
  });
});

// Get sales summary
exports.getSalesSummary = catchAsync(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sales = await Sale.find({
    createdAt: { $gte: today, $lt: tomorrow },
    status: "completed",
  });

  const summary = {
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    totalProfit: sales.reduce((sum, sale) => {
      return (
        sum + sale.items.reduce((itemSum, item) => itemSum + item.profit, 0)
      );
    }, 0),
    averageSale:
      sales.length > 0
        ? sales.reduce((sum, sale) => sum + sale.totalAmount, 0) / sales.length
        : 0,
  };

  res.status(200).json({
    status: "success",
    data: summary,
  });
});
