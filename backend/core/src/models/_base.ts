import mongoose, { type SchemaDefinition, type SchemaOptions } from "mongoose";

export function defineModel(
  name: string,
  definition: SchemaDefinition,
  options: SchemaOptions = {},
) {
  const schema = new mongoose.Schema(definition, {
    timestamps: true,
    ...options,
  });
  return mongoose.model(name, schema);
}

export const ObjectId = mongoose.Schema.Types.ObjectId;
export const ref = (model: string, required = true) => ({
  type: ObjectId,
  ref: model,
  required,
});
