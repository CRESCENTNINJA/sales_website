// models/price.js
const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const PriceSchema = new Schema(
  {
    pajama: {
      price    : { type: Number, required: true },
      orgprice : { type: Number, required: true }
    },
    kurta: {
      price    : { type: Number, required: true },
      orgprice : { type: Number, required: true }
    },
    pant: {
      price    : { type: Number, required: true },
      orgprice : { type: Number, required: true }
    },
    shirt: {
      price    : { type: Number, required: true },
      orgprice : { type: Number, required: true }
    },
    formalCoat: {
      price    : { type: Number, required: true },
      orgprice : { type: Number, required: true }
    },

    // WHO changed these prices
    changedBy: { type: Schema.Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('price', PriceSchema);
