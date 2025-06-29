const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

/* ───────────────────────────────────────────
   2️⃣  UserSchema  (your “customer card”)
   ─────────────────────────────────────────── */
const UserSchema = new Schema(
  {
    RCT_id   : { type: Number },
    Name     : { type: String,  required: true, trim: true },
    whatsapp : { type: String },
    phone    : { type: String },
    pincode : {type : Number} ,
    Address : {type : String } ,
    specialRequirement : {type : String},
    login_time: { type: Date,   default: Date.now },   // first entry timestamp
    created_by : {type : String} ,
    /* link *all* measurement snapshots that belong to this person */
    measurements: [{ type: Schema.Types.ObjectId, ref: 'Measurement' }],
    /* who created/edits this card in the admin panel */
    createdBy  : { type: Schema.Types.ObjectId, ref: 'Admin' },
    updatedBy  : { type: Schema.Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('consumer', UserSchema);
