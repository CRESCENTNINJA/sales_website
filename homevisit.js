const mongoose = require("mongoose");

const homevisit = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "Consumer" } ,
    // user:       { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    garment:    { type: String, required: true },                 // e.g. "kurta"
    phone:      { type: String, required: true },
    address:    { type: String, required: true },
    coords: {
      lat:      { type: Number, required: true },
      lon:      { type: Number, required: true }
    },
    whatsapped: { type: Boolean, default: false },                // ← flag!
    status:     { type: String, enum: ["pending", "scheduled", "done"], default: "pending" },
    // you can add a visit date/time slot later when you build the scheduler
  },
  { timestamps: true }                                            // createdAt / updatedAt
);

module.exports = mongoose.model("homevisit", homevisit);
