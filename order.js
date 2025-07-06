const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const OrderItemSchema = new Schema({
  garment      : { type: String,  required: true },   // e.g. "kurta"
  measurement  : { type: Schema.Types.ObjectId, ref: 'Measurement', required: true },
  quantity     : { type: Number, default: 1 }
});

const OrderSchema = new Schema(
  {
    // Auto‑increment logic handled in route (count+1) or mongoose‑sequence plugin
    orderNumber       : { type: Number, unique: true, required: true },

    customer          : { type: Schema.Types.ObjectId, ref: 'Consumer', required: true },
    createdBy         : { type: Schema.Types.ObjectId, ref: 'Admin' },

    items             : [OrderItemSchema],
    totalAmount       : { type: Number, required: true }, // paise

    // Payment (Razorpay)
    razorpayOrderId   : { type: String },
    razorpayPaymentId : { type: String },
    razorpaySignature : { type: String },
    paymentStatus     : { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },

    status            : { type: String, enum: ['Pending', 'Delivered', 'Deleted'], default: 'Pending' },
    deliveredAt       : { type: Date },
    notes             : { type: String },
    assignedTo        : { type: Schema.Types.ObjectId, ref: 'Admin' },
    deliveryLocation  : {
      latitude  : String,
      longitude : String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
