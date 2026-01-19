

import mongoose from "mongoose";

// ============ MONGODB SCHEMAS ============

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
   telegramChatId: { type: String, unique: true, sparse: true }, // Add this
  telegramUsername: { type: String }, // Add this
});
export const User = mongoose.model('User', userSchema);



// Content Schema
const contentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String, required: true },
  type: { type: String, enum: ['youtube', 'twitter', 'pdf'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});


export const Content = mongoose.model('Content', contentSchema);
// PDF Collection Schema
const pdfCollectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  originalName: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadDate: { type: Date, default: Date.now },
  chunks: { type: Number, required: true },
  vectorCollectionName: { type: String, required: true }
});

export const PDFCollection = mongoose.model('PDFCollection', pdfCollectionSchema);

// Share Link Schema
const shareLinkSchema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const ShareLink = mongoose.model('ShareLink', shareLinkSchema);
// Reminder Schema
const reminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  reminderTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  repeat: { 
    type: String, 
    enum: ['once', 'daily', 'weekly', 'monthly'],
    default: 'once'
  },
  telegramChatId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const Reminder = mongoose.model('Reminder', reminderSchema);
