const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userDetailsSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["business_owner", "sales_manager", "salesperson"],
      default: "salesperson",
    },
    permissions: {
      type: Map,
      of: Boolean,
      default: {
        view_profits: false,
        manage_users: false,
        view_reports: false,
        manage_inventory: false,
        manage_sales: false,
        manage_customers: false,
        manage_suppliers: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userDetailsSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userDetailsSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Set default permissions based on role
userDetailsSchema.pre("save", function (next) {
  if (this.isNew) {
    const rolePermissions = {
      business_owner: {
        view_profits: true,
        manage_users: true,
        view_reports: true,
        manage_inventory: true,
        manage_sales: true,
        manage_customers: true,
        manage_suppliers: true,
      },
      sales_manager: {
        view_profits: false, // Needs owner permission
        manage_users: false,
        view_reports: true,
        manage_inventory: true,
        manage_sales: true,
        manage_customers: true,
        manage_suppliers: false,
      },
      salesperson: {
        view_profits: false,
        manage_users: false,
        view_reports: false,
        manage_inventory: false,
        manage_sales: true,
        manage_customers: true,
        manage_suppliers: false,
      },
    };

    this.permissions = new Map(Object.entries(rolePermissions[this.role]));
  }
  next();
});

module.exports = mongoose.model("UserDetails", userDetailsSchema);
