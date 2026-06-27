import mongoose from "mongoose";

const pptSchema = new mongoose.Schema(
  {
    pptUrl: String,
  },
  { timestamps: true },
);

export const Ppt = mongoose.model("Ppt", pptSchema);
