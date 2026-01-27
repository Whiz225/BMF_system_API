const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const { body, validationResult } = require("express-validator");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");

// Get all customers
exports.getAllCustomers = catchAsync(async (req, res, next) => {
  const { search, customerType, isActive } = req.query;

  let filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  if (customerType) filter.customerType = customerType;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  const customers = await Customer.find(filter).sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    count: customers.length,
    data: customers,
  });
});

// Get single customer
exports.getCustomer = catchAsync(async (req, res, next) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    return next(new AppError("Customer not found", 404));
  }

  // Get customer's purchase history
  const purchases = await Sale.find({ customer: req.params.id })
    .sort({ createdAt: -1 })
    .limit(10)
    .select("saleNumber totalAmount createdAt status");

  res.json({
    success: true,
    data: {
      ...customer.toObject(),
      purchaseHistory: purchases,
    },
  });
});

// Create customer
exports.createCustomer = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array(), 400));
  }

  const customerData = {
    ...req.body,
    createdBy: req.user.id,
  };

  const customer = await Customer.create(customerData);

  res.status(201).json({
    success: true,
    data: customer,
  });
});

// Update customer
exports.updateCustomer = catchAsync(async (req, res, next) => {
  let customer = await Customer.findById(req.params.id);

  if (!customer) {
    return next(new AppError("Customer not found", 404));
  }

  customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: customer,
  });
});

// Delete customer (soft delete)
exports.deleteCustomer = catchAsync(async (req, res, next) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    return next(new AppError("Customer not found", 404));
  }

  customer.isActive = false;
  await customer.save();

  res.status(204).json({
    success: true,
    message: "Customer deactivated successfully",
  });
});

// Get customer purchase history
exports.getCustomerPurchaseHistory = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const purchases = await Sale.find({ customer: req.params.id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate("soldBy", "firstName lastName");

  const total = await Sale.countDocuments({ customer: req.params.id });

  res.status(200).json({
    status: "success",
    data: purchases,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
  });
});

// Get top customers
exports.getTopCustomers = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const topCustomers = await Customer.find({ isActive: true })
    .sort({ totalSpent: -1 })
    .limit(parseInt(limit))
    .select("name email phone totalPurchases totalSpent lastPurchaseDate");

  res.status(200).json({
    status: "success",
    data: topCustomers,
  });
});

// module.exports = router;
