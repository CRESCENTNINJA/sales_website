// order.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// OrderSchema: links customer, items, status, etc.
const OrderSchema = new Schema({
  orderNumber: { type: Number, unique: true },               // Unique order ID
  customer:     { type: Schema.Types.ObjectId, ref: 'consumer', required: true }, // Reference to User
  createdBy:    { type: Schema.Types.ObjectId, ref: 'adminn' }, // Admin who created the order
  items: [{
    garment:     String,
    measurement: { type: Schema.Types.ObjectId, ref: 'Measurement' }, // Link to measurements
    quantity:    { type: Number, default: 1 }
  }],
  totalAmount:  { type: Number, required: true },            // Calculated total cost
  status:       { type: String, enum: ['Pending','Delivered','Deleted'], default: 'Pending' },
  deliveredAt:  { type: Date },                              // Timestamp when delivered
  notes:        { type: String },                            // Any special notes
  assignedTo:   { type: Schema.Types.ObjectId, ref: 'adminn' } ,// (Future) assigned worker
  deliveryLcation : {latitude : String , longitude : String}




}, { timestamps: true }); // Adds createdAt and updatedAt

module.exports = mongoose.model('Order', OrderSchema);
