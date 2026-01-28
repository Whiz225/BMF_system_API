// app.js
const path = require("path");
// const favicon = require("serve-favicon");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
// const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const dotenv = require("dotenv");

// Load env vars
dotenv.config({ path: "./config.env" });

// Routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const inventoryRoutes = require("./routes/inventory");
const salesRoutes = require("./routes/sales");
const supplierRoutes = require("./routes/suppliers");
const customerRoutes = require("./routes/customers");
const dashboardRoutes = require("./routes/dashboard");
const userRoutes = require("./routes/users");
const categoryRoutes = require("./routes/categories");

// Error handling
const globalErrorHandler = require("./controllers/errorController");

// Start express app
const app = express();

// 1. GLOBAL MIDDLEWARES
app.set('trust proxy', true);

// Implement CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true, // This is crucial for cookies
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Serving static files
app.use(express.static(path.join(__dirname, "public")));
// app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

// Set security HTTP headers
app.use(helmet({ contentSecurityPolicy: false }));

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});
app.use("/api", limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
// app.use(mongoSanitize());

// Data sanitization against XSS
// app.use(xss());

// Prevent parameter pollution
// app.use(
//   hpp({
//     whitelist: [
//       "duration",
//       "ratingsQuantity",
//       "ratingsAverage",
//       "maxGroupSize",
//     ],
//   })
// );

app.use(compression());

// 2. ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);

// 3. ERROR HANDLING
app.use(globalErrorHandler);

module.exports = app;
