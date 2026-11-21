import mongoose, { Schema, Document } from 'mongoose';

export interface IRfidCard extends Document {
  uid: string;
  itemKey: string;
  nameEn: string;
  nameMm: string;
  imageKey: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RfidCardSchema = new Schema<IRfidCard>(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    itemKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: ['apple', 'elephant', 'cat', 'dog', 'banana'],
    },
    nameEn: {
      type: String,
      required: true,
      trim: true,
    },
    nameMm: {
      type: String,
      required: true,
      trim: true,
    },
    imageKey: {
      type: String,
      required: true,
      trim: true,
      default: function (this: IRfidCard) {
        return this.itemKey;
      },
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'rfid_cards',
  }
);

export const RfidCardModel = mongoose.model<IRfidCard>('RfidCard', RfidCardSchema);
