const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/UserDetails");
const Product = require("./models/Product");
const Supplier = require("./models/Supplier");
const Customer = require("./models/Customer");
const Inventory = require("./models/Inventory");
require("dotenv").config();

const DB = process.env.MONGODB_URI.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);
// Connect to MongoDB
mongoose.connect(DB, {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
});

const suppliers = [
  {
    name: "Ely Foams",
    company: "Ely Foam Manufacturing Ltd",
    contactPerson: "John Ely",
    email: "contact@elyfoams.com",
    phone: "+2348012345678",
    address: {
      street: "123 Industrial Avenue",
      city: "Lagos",
      state: "Lagos",
    },
    paymentTerms: "net_30",
    rating: 4,
  },
  {
    name: "Best Muca Foams",
    company: "Best Muca Industries",
    contactPerson: "Sarah Muca",
    email: "info@bestmuca.com",
    phone: "+2348098765432",
    address: {
      street: "456 Factory Road",
      city: "Ibadan",
      state: "Oyo",
    },
    paymentTerms: "net_15",
    rating: 5,
  },
  {
    name: "Mouka Foams",
    company: "Mouka Limited",
    contactPerson: "Mike Mouka",
    email: "sales@mouka.com",
    phone: "+2348055551234",
    address: {
      street: "789 Production Street",
      city: "Abeokuta",
      state: "Ogun",
    },
    paymentTerms: "net_30",
    rating: 4,
  },
];

const products = [
  // Mattresses
  {
    name: "Premium 20-inch Mattress",
    category: "mattress",
    dimensions: {
      thickness: 20,
      density: 35,
    },
    unitCost: 45000,
    sellingPrice: 65000,
    description: "High-density premium mattress for maximum comfort",
    tags: ["premium", "luxury", "high-density"],
  },
  {
    name: "Standard 18-inch Mattress",
    category: "mattress",
    dimensions: {
      thickness: 18,
      density: 25,
    },
    unitCost: 35000,
    sellingPrice: 50000,
    description: "Standard mattress for everyday use",
    tags: ["standard", "regular", "medium-density"],
  },
  {
    name: "Economy 16-inch Mattress",
    category: "mattress",
    dimensions: {
      thickness: 16,
      density: 18,
    },
    unitCost: 25000,
    sellingPrice: 35000,
    description: "Affordable mattress for budget customers",
    tags: ["economy", "budget", "low-density"],
  },
  {
    name: "Deluxe 22-inch Mattress",
    category: "mattress",
    dimensions: {
      thickness: 22,
      density: 40,
    },
    unitCost: 60000,
    sellingPrice: 85000,
    description: "Ultra-deluxe mattress with extra thickness",
    tags: ["deluxe", "extra-thick", "ultra-premium"],
  },
  // Pillows
  {
    name: "Memory Foam Pillow",
    category: "pillow",
    unitCost: 5000,
    sellingPrice: 8000,
    description: "Orthopedic memory foam pillow",
    tags: ["memory-foam", "orthopedic", "premium"],
  },
  {
    name: "Standard Pillow",
    category: "pillow",
    unitCost: 2000,
    sellingPrice: 3500,
    description: "Regular pillow for daily use",
    tags: ["standard", "regular", "basic"],
  },
  // Other products
  {
    name: "Plush Foot Mat",
    category: "foot_mat",
    unitCost: 3000,
    sellingPrice: 5000,
    description: "Soft plush foot mat",
    tags: ["foot-mat", "plush", "soft"],
  },
  {
    name: "Cotton Bedsheet Set",
    category: "bedsheet",
    unitCost: 8000,
    sellingPrice: 12000,
    description: "100% cotton bedsheet set",
    tags: ["bedsheet", "cotton", "set"],
  },
];

const customers = [
  {
    name: "Adeola Johnson",
    email: "adeola@email.com",
    phone: "+2348011111111",
    customerType: "regular",
    totalPurchases: 5,
    totalSpent: 250000,
  },
  {
    name: "Chinedu Okoro",
    email: "chinedu@email.com",
    phone: "+2348022222222",
    customerType: "wholesale",
    creditLimit: 500000,
    totalPurchases: 12,
    totalSpent: 1200000,
  },
  {
    name: "Funke Adebayo",
    email: "funke@email.com",
    phone: "+2348033333333",
    customerType: "corporate",
    totalPurchases: 8,
    totalSpent: 600000,
  },
];

const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Supplier.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});
    await Inventory.deleteMany({});

    console.log("🗑️  Old data cleared");

    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    const adminUser = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: "admin@foambusiness.com",
      password: hashedPassword,
      role: "business_owner",
    });

    // Create sales manager
    const salesManagerPassword = await bcrypt.hash("manager123", salt);
    const salesManager = await User.create({
      firstName: "Sales",
      lastName: "Manager",
      email: "manager@foambusiness.com",
      password: salesManagerPassword,
      role: "sales_manager",
    });

    // Create salesperson
    const salesPersonPassword = await bcrypt.hash("seller123", salt);
    const salesPerson = await User.create({
      firstName: "John",
      lastName: "Doe",
      email: "sales@foambusiness.com",
      password: salesPersonPassword,
      role: "salesperson",
    });

    console.log("👥 Users created");

    // Create suppliers
    const createdSuppliers = await Supplier.insertMany(suppliers);
    console.log("🏭 Suppliers created");

    // Create products with suppliers
    const productsWithSuppliers = products.map((product, index) => ({
      ...product,
      supplier: createdSuppliers[index % createdSuppliers.length]._id,
    }));

    const createdProducts = await Product.insertMany(productsWithSuppliers);
    console.log("📦 Products created");

    // Update suppliers with product references
    for (let i = 0; i < createdSuppliers.length; i++) {
      const supplierProducts = createdProducts.filter(
        (_, index) => index % createdSuppliers.length === i
      );

      createdSuppliers[i].productsSupplied = supplierProducts.map((p) => p._id);
      await createdSuppliers[i].save();
    }

    // Create customers
    const createdCustomers = await Customer.insertMany(
      customers.map((customer) => ({
        ...customer,
        createdBy: adminUser._id,
      }))
    );
    console.log("👤 Customers created");

    // Create inventory items
    const inventoryItems = createdProducts.map((product) => ({
      product: product._id,
      currentStock: Math.floor(Math.random() * 100) + 20,
      location: "Main Warehouse",
    }));

    await Inventory.insertMany(inventoryItems);
    console.log("📊 Inventory created");

    console.log("\n✅ Database seeded successfully!");
    console.log("\n📋 Sample Login Credentials:");
    console.log("   Admin: admin@foambusiness.com / admin123");
    console.log("   Manager: manager@foambusiness.com / manager123");
    console.log("   Sales: sales@foambusiness.com / seller123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
