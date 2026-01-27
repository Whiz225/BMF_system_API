// utils/validateObjectId.js
const mongoose = require("mongoose");
const AppError = require("./AppError");

exports.validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError(`Invalid ${paramName} ID format`, 400));
    }

    next();
  };
};
