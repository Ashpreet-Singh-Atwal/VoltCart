import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    gallery: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 }, // regular MRP
    description: { type: String, required: true },
    highlights: { type: [String], default: [] },
    // Regular (non-sale) warehouse stock. Flash-sale stock is tracked separately.
    stock: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

export const Product = mongoose.model('Product', productSchema);
