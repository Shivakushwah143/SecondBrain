import mongoose from 'mongoose';

const telegramLinkCodeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    usedByTelegramUserId: { type: String }
  },
  { timestamps: true }
);

telegramLinkCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TelegramLinkCode = mongoose.model('TelegramLinkCode', telegramLinkCodeSchema);
