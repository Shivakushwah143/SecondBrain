import mongoose from 'mongoose';

const notionConnectionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    workspaceId: { type: String, required: true },
    workspaceName: { type: String, required: true },
    connectedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const NotionConnection = mongoose.model('NotionConnection', notionConnectionSchema);
