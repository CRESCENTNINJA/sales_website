// models/measurement.js
const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const MeasurementSchema = new Schema(
  {
    
    // link back to the customer
    customer     : { type: Schema.Types.ObjectId, ref: 'Consumer', required: true },

    // (optional) link to the order this measurement was used for
    order        : { type: Schema.Types.ObjectId, ref: 'Order' },

    // when the tape-measure session happened
    takenOn      : { type: Date, default: Date.now },

    // garment-wise measurements
    pajama       : {
      waist      : Number,
      hip        : Number,
      thigh      : Number,
      calf       : Number,
      length     : Number,
      specialRequirement: String,

    },

    kurta        : {
      chest      : Number,
      waist      : Number,
      hip        : Number,
      shoulder   : Number,
      sleeveLength: Number,
      length     : Number,
      specialRequirement: String,

    },

    pant         : {
      waist      : Number,
      hip        : Number,
      thigh      : Number,
      knee       : Number,
      bottom     : Number,
      length     : Number,
      crotch     : Number,
      specialRequirement: String,

    },

    shirt        : {
      chest      : Number,
      waist      : Number,
      hip        : Number,
      shoulder   : Number,
      sleeveLength: Number,
      shirtLength: Number,
      neck       : Number,
      cuff       : Number,
      specialRequirement: String,

    },

    formalCoat   : {
      chest      : Number,
      waist      : Number,
      hip        : Number,
      shoulder   : Number,
      sleeveLength: Number,
      coatLength : Number,
      backLength : Number,
      bicep      : Number,
      specialRequirement: String,

    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Measurement', MeasurementSchema);
