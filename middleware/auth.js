const jwt = require("jsonwebtoken");
const User = require("../models/UserDetails");

const protect = async (req, res, next) => {
  let token;

  if (
    (req.headers.cookie &&
      req.headers.cookie.startsWith("authjs.session-token")) ||
    (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer"))
  ) {
    try {
      token =
        req.headers?.authorization?.split(" ")[1] ||
        req.headers?.cookie?.split("=")[1];
      console.log("token", token);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user || !req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User not authorized or account is inactive",
        });
      }

      req.user.lastLogin = Date.now();
      await req.user.save();

      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(401).json({
        success: false,
        message: "Not authorized, token failed",
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.permissions.get(permission)) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to ${permission}`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize, checkPermission };

// const jwt = require("jsonwebtoken");
// const User = require("../models/UserDetails");
// const catchAsync = require("../utils/catchAsync");
// const AppError = require("../utils/AppError");

// const protect = catchAsync(async (req, res, next) => {
//   let token;

//   if (
//     (req.headers.cookie &&
//       req.headers.cookie.startsWith("authjs.session-token")) ||
//     (req.headers.authorization &&
//       req.headers.authorization.startsWith("Bearer"))
//   ) {
//     // try {
//     token =
//       req.headers?.cookie?.split("=")[1] ||
//       req.headers?.authorization?.split(" ")[1];
//     console.log("token", token);
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = await User.findById(decoded.id).select("-password");

//     if (!req.user || !req.user.isActive) {
//       return next(
//         new AppError("User not authorized or account is inactive", 401)
//       );
//     }

//     req.user.lastLogin = Date.now();
//     await req.user.save();

//     next();
//   }

//   if (!token) {
//     return next(new AppError("Not authorized, no token", 401));
//   }
// });

// const authorize = catchAsync((...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return next(
//         new AppError(
//           `User role ${req.user.role} is not authorized to access this route`,
//           403
//         )
//       );
//     }
//     next();
//   };
// });

// const checkPermission = catchAsync((permission) => {
//   return (req, res, next) => {
//     if (!req.user.permissions.get(permission)) {
//       return next(
//         new AppError(`You don't have permission to ${permission}`, 403)
//       );
//     }
//     next();
//   };
// });

// module.exports = { protect, authorize, checkPermission };
