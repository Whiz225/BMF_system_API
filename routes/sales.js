const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { protect, checkPermission } = require("../middleware/auth");
const {
  getAllSales,
  createNewSale,
  getSale,
  updateSales,
  updateSalesStatus,
  getSalesSummary,
} = require("../controllers/salesController");

router.get("/", protect, checkPermission("manage_sales"), getAllSales);
router.post(
  "/",
  protect,
  checkPermission("manage_sales"),
  [
    body("items").isArray().withMessage("Items must be an array"),
    body("items.*.product").isMongoId(),
    body("items.*.quantity").isInt({ min: 1 }),
    body("paymentMethod").isIn(["cash", "card", "transfer", "credit"]),
    body("amountPaid").isFloat({ min: 0 }),
  ],
  createNewSale
);

router.get("/:id", protect, getSale);
router.patch(
  "/:id/status",
  protect,
  checkPermission("manage_sales"),
  updateSalesStatus
);

router.patch(
  "/:id",
  protect,
  checkPermission("manage_sales"),
  updateSales
);

router.get(
  "/summary/daily",
  protect,
  checkPermission("view_reports"),
  getSalesSummary
);

module.exports = router;
