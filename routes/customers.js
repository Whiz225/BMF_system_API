const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { protect, checkPermission } = require("../middleware/auth");
const {
  getAllCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerPurchaseHistory,
  getTopCustomers,
} = require("../controllers/customerController");
// const Customer = require('../models/Customer');
// const Sale = require('../models/Sale');

router.get("/", protect, checkPermission("manage_customers"), getAllCustomers);

router.get("/:id", protect, checkPermission("manage_customers"), getCustomer);

router.post(
  "/",
  protect,
  checkPermission("manage_customers"),
  [
    body("name").notEmpty().withMessage("Customer name is required"),
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("email")
      .optional()
      .isEmail()
      .withMessage("Please enter a valid email"),
  ],
  createCustomer
);

router.put(
  "/:id",
  protect,
  checkPermission("manage_customers"),
  updateCustomer
);
router.delete(
  "/:id",
  protect,
  checkPermission("manage_customers"),
  deleteCustomer
);
router.get(
  "/:id/purchases",
  protect,
  checkPermission("manage_customers"),
  getCustomerPurchaseHistory
);
router.get(
  "/reports/top",
  protect,
  checkPermission("view_reports"),
  getTopCustomers
);

module.exports = router;
