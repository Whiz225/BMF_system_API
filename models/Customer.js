const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: {
      type: String,
      default: 'Nigeria'
    }
  },
  customerType: {
    type: String,
    enum: ['regular', 'wholesale', 'corporate', 'retail'],
    default: 'retail'
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  currentCredit: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  lastPurchaseDate: Date,
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserDetails'
  }
}, {
  timestamps: true
});

// Update last purchase date before saving sale
customerSchema.statics.updatePurchaseStats = async function(customerId, amount) {
  await this.findByIdAndUpdate(customerId, {
    $inc: {
      totalPurchases: 1,
      totalSpent: amount
    },
    lastPurchaseDate: Date.now()
  });
};

module.exports = mongoose.model('Customer', customerSchema);