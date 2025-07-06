const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const UserSchema = new Schema(
  {
    Name     : { type: String,  required: true, trim: true },
    // whatsapp : { type: String },
    phone    : { type: String },
    password : {type : String} ,
    // pincode : {type : Number} ,
    // Address : {type : String } ,
    // specialRequirement : {type : String},
    created_latitude : {type : String} ,
    created_longitude : {type : String} ,
    created_accuracy : {type : String} ,
    login_time: { type: Date,   default: Date.now },   // first entry timestamp
  },
  { timestamps: true }
);

module.exports = mongoose.model('adminn', UserSchema);
