const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { protect, authorize, checkPermission } = require("../middleware/auth");
const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProductCategories,
  getProductMattressThicknessOptions,
  getProductMattressDensityOptions,
  updateProductInventory,
} = require("../controllers/productController");

router.get("/", protect, getAllProducts);
router.get("/:id", protect, getProduct);
router.post(
  "/",
  protect,
  checkPermission("manage_inventory"),
  [
    body("name").trim().notEmpty().withMessage("Product name is required"),
    body("category").isIn([
      "mattress",
      "pillow",
      "foot_mat",
      "bedsheet",
      "others",
    ]),
    body("unitCost").isFloat({ min: 0 }),
    body("sellingPrice").isFloat({ min: 0 }),
    body("supplier").isMongoId(),
  ],
  createProduct
);
router.patch("/:id", protect, checkPermission("manage_inventory"), updateProduct);
router.delete("/:id", protect, authorize("business_owner"), deleteProduct);
router.get("/categories/all", protect, getAllProductCategories);
router.get(
  "/mattress/thickness-options",
  protect,
  getProductMattressThicknessOptions
);
router.get(
  "/mattress/density-options",
  protect,
  getProductMattressDensityOptions
);
router.patch(
  "/:id/inventory",
  protect,
  checkPermission("manage_inventory"),
  updateProductInventory
);

module.exports = router;
