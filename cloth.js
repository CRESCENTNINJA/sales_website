const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const ClothSchema = new Schema({
  name:            { type: String, required: true, trim: true },
  photoUrl:        { type: String, required: true },     // URL or path to cloth image
  pricePerMeter:   { type: Number, required: true },     // Price in ₹ per meter
  description:     { type: String },                    // Optional cloth description
  category:        { type: String },                    // e.g. "Cotton", "Silk"
  createdAt:       { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cloth', ClothSchema);
