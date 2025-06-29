const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

/* ───────────────────────────────────────────
   1️⃣  MeasurementSchema
   ─────────────────────────────────────────── */
const MeasurementSchema = new Schema(
  {

    whatsapp : {type : Number , require:true} ,
    /*  ✔ which customer these sizes belong to */
    customer : { type: Schema.Types.ObjectId, ref: 'consumer', required: true },

    /*  ✔ when the tape-measure session happened  */
    takenOn  : { type: Date, default: Date.now },

    /*  ✔ who entered these figures (admin/staff) */
    // createdBy: { type: Schema.Types.ObjectId, ref: 'Admin'},
    // updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },

    /*  Garment-wise measurements  */
    pajama: {
      waist : Number, hip:Number, thigh:Number, calf:Number, length:Number , specialRequirement: String , price : String, orgprice : String
    },

    kurta: {
      chest:Number, waist:Number, hip:Number, shoulder:Number,
      sleeveLength:Number, length:Number , specialRequirement: String ,price : String,orgprice : String
    },

    pant: {
      waist:Number, hip:Number, thigh:Number, knee:Number,
      bottom:Number, length:Number, crotch:Number , specialRequirement: String , price : String, orgprice : String
    },

    shirt: {
      chest:Number, waist:Number, hip:Number, shoulder:Number,
      sleeveLength:Number, shirtLength:Number, neck:Number, cuff:Number , specialRequirement: String , price : String,orgprice : String
    },

    formalCoat: {
      chest:Number, waist:Number, hip:Number, shoulder:Number,
      sleeveLength:Number, coatLength:Number, backLength:Number, bicep:Number , specialRequirement: String , price : String,orgprice : String
    }
  },
  { timestamps: true }   // adds createdAt & updatedAt automatically
);

module.exports = mongoose.model('Measurement', MeasurementSchema);
