const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { protect, authorize, checkPermission } = require("../middleware/auth");
const User = require("../models/UserDetails");

// Get all users (only for business owner)
router.get("/", protect, authorize("business_owner"), async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Get single user
router.get("/:id", protect, authorize("business_owner"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Create user (business owner only)
router.post(
  "/",
  protect,
  authorize("business_owner"),
  [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role")
      .isIn(["sales_manager", "salesperson"])
      .withMessage("Invalid role"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    try {
      const userExists = await User.findOne({ email: req.body.email });
      if (userExists) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      const user = await User.create(req.body);

      res.status(201).json({
        success: true,
        data: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          permissions: Object.fromEntries(user.permissions),
        },
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Update user
router.put("/:id", protect, authorize("business_owner"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Remove password from update data
    const { password, ...updateData } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Update user permissions (business owner only)
router.patch(
  "/:id/permissions",
  protect,
  authorize("business_owner"),
  async (req, res) => {
    try {
      const { permissions } = req.body;

      if (!permissions || typeof permissions !== "object") {
        return res.status(400).json({
          success: false,
          message: "Permissions object is required",
        });
      }

      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Update permissions
      for (const [key, value] of Object.entries(permissions)) {
        user.permissions.set(key, value);
      }

      await user.save();

      res.json({
        success: true,
        message: "User permissions updated",
        data: {
          permissions: Object.fromEntries(user.permissions),
        },
      });
    } catch (error) {
      console.error("Update permissions error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Deactivate user
router.delete(
  "/:id",
  protect,
  authorize("business_owner"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent deactivating yourself
      if (user._id.toString() === req.user.id) {
        return res.status(400).json({
          success: false,
          message: "You cannot deactivate your own account",
        });
      }

      user.isActive = false;
      await user.save();

      res.json({
        success: true,
        message: "User deactivated successfully",
      });
    } catch (error) {
      console.error("Deactivate user error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Activate user
router.patch(
  "/:id/activate",
  protect,
  authorize("business_owner"),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.isActive = true;
      await user.save();

      res.json({
        success: true,
        message: "User activated successfully",
      });
    } catch (error) {
      console.error("Activate user error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

// Get user activity
router.get(
  "/:id/activity",
  protect,
  authorize("business_owner"),
  async (req, res) => {
    try {
      // This would typically come from an Activity model
      // For now, returning basic info
      const user = await User.findById(req.params.id).select(
        "lastLogin createdAt updatedAt"
      );

      res.json({
        success: true,
        data: {
          lastLogin: user.lastLogin,
          accountCreated: user.createdAt,
          lastUpdated: user.updatedAt,
        },
      });
    } catch (error) {
      console.error("Get user activity error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

module.exports = router;
