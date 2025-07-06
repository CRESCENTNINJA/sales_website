// models/consumer.js
const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const UserSchema = new Schema(
  {
    RCT_id             : { type: Number },
    Name               : { type: String, required: true, trim: true },
    whatsapp           : { type: String },
    phone              : { type: String },
    pincode            : { type: Number },
    Address            : { type: String },
    specialRequirement : { type: String },

    // first entry timestamp
    login_time         : { type: Date, default: Date.now },

    created_by         : { type: String },

    // all measurements that belong to this person
    measurements       : [{ type: Schema.Types.ObjectId, ref: 'Measurement' }],

    // all orders that belong to this person
    orders             : [{ type: Schema.Types.ObjectId, ref: 'Order' }],

    // who created/edits this card in the admin panel
    createdBy          : { type: Schema.Types.ObjectId, ref: 'Admin' },
    updatedBy          : { type: Schema.Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Consumer', UserSchema);
