
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import  os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from 'crypto';
import dotenv from 'dotenv';
import Groq from 'groq-sdk'; 
import TelegramBot from 'node-telegram-bot-api';
import schedule from 'node-schedule';
import { Content, PDFCollection, Reminder, ShareLink, User } from './models/userModel.js';
import { TelegramLinkCode } from './models/telegramLinkCode.js';
import { NotionConnection } from './models/notionConnection.js';
import { exchangeCodeForToken, generateAuthorizationUrl } from './services/notionService.js';

// Load .env from common locations (root run vs backend run)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dotenvCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env')
];
for (const candidate of dotenvCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const reminderScheduledJobs: { [key: string]: schedule.Job } = {};
// Environment variables - REMOVED Gemini, ADDED Groq
const JWT_SECRET = process.env.JWT_SECRET || 'cosmic-mind-secret-key';
const PORT = process.env.PORT || 3001;
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''; 
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI!;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_IDS = process.env.TELEGRAM_CHAT_IDS?.split(',').map(id => id.trim()) || [];
const CLERK_ENABLED = Boolean(process.env.CLERK_SECRET_KEY);

const buildUserQuery = (userId: string) =>
  mongoose.isValidObjectId(userId) ? { _id: userId } : { clerkId: userId };

const ensureAppUser = async (userId: string, usernameHint?: string) => {
  const existing = await User.findOne(buildUserQuery(userId));
  if (existing) return existing;

  const raw = (usernameHint || 'user').toString();
  const base = raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 20) || 'user';
  let username = base;

  const taken = await User.findOne({ username });
  if (taken) {
    const suffix = userId.slice(-6);
    username = `${base}_${suffix}`;
  }

  const newUser = new User({
    username,
    ...(mongoose.isValidObjectId(userId) ? {} : { clerkId: userId })
  });

  await newUser.save();
  return newUser;
};


// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ============ HELPER FUNCTIONS ============
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

const generateToken = (userId: string, username: string): string => {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (token: string): { userId: string; username: string } | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
  } catch {
    return null;
  }
};

// Create safe collection name for Qdrant
const createSafeCollectionName = (userId: string, originalName: string): string => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  const safeName = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return `user_${userId}_${safeName}_${timestamp}_${randomStr}`.substring(0, 50);
};

// Groq Helper Functions
const initializeGroqClient = () => {
  if (!GROQ_API_KEY || GROQ_API_KEY === '') {
    return null;
  }
  return new Groq({ apiKey: GROQ_API_KEY });
};

const getGroqResponse = async (prompt: string, context?: string) => {
  const groq = initializeGroqClient();
  
  if (!groq) {
    return "⚠️ AI service not configured. Please add GROQ_API_KEY to .env file. Get FREE key from: https://console.groq.com";
  }

  try {
    // Try different Groq models in order
    const modelsToTry = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];

    for (const model of modelsToTry) {
      try {
        const messages: any[] = [];
        
        if (context) {
          messages.push({
            role: 'system',
            content: `You are a helpful AI assistant. Use this context to answer questions:\n\n${context}\n\nAnswer based ONLY on the provided context. If the answer isn't in the context, say "I cannot find that information in the provided context."`
          });
        } else {
          messages.push({
            role: 'system',
            content: 'You are a helpful AI assistant. Respond in a friendly and concise manner.'
          });
        }
        
        messages.push({
          role: 'user',
          content: prompt
        });

        const completion = await groq.chat.completions.create({
          messages,
          model: model,
          temperature: 0.7,
          max_tokens: 1024,
        });

        const response = completion.choices[0]?.message?.content;
        if (response) {
          console.log(`✅ Groq model ${model} worked!`);
          return response;
        }
      } catch (error: any) {
        console.log(`❌ Groq model ${model} failed: ${error.message?.split('\n')[0]}`);
        continue;
      }
    }

    return "⚠️ All Groq models failed. Please try again later.";
    
  } catch (error: any) {
    console.error('🔥 Groq API error:', error);
    return `⚠️ AI service error: ${error.message}`;
  }
};
const TELEGRAM_AI_SYSTEM_PROMPT =
  'You are a senior professional content writer with 5+ years of experience. ' +
  'You write high-quality emails, cold outreach, LinkedIn posts, Twitter/X threads, captions, hooks, CTAs, and content ideas. ' +
  'You can rewrite, summarize, improve tone, and suggest variations. ' +
  'Be concise, structured, and practical. If the request is unclear, ask 1-2 clarifying questions.';

const getTelegramAiResponse = async (
  message: string,
  history?: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt?: string
) => {
  const groq = initializeGroqClient();
  if (!groq) {
    throw new Error('AI service not configured. Please add GROQ_API_KEY to .env.');
  }

  const modelsToTry = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];

  const safeHistory = Array.isArray(history)
    ? history.filter((item) => item && (item.role === 'user' || item.role === 'assistant') && item.content)
    : [];

  const baseMessages: any[] = [
    { role: 'system', content: systemPrompt || TELEGRAM_AI_SYSTEM_PROMPT }
  ];

  if (safeHistory.length > 0) {
    baseMessages.push(...safeHistory.slice(-10));
  } else {
    baseMessages.push({ role: 'user', content: message });
  }

  const last = baseMessages[baseMessages.length - 1];
  if (last?.role !== 'user') {
    baseMessages.push({ role: 'user', content: message });
  }

  for (const model of modelsToTry) {
    try {
      const completion = await groq.chat.completions.create({
        messages: baseMessages,
        model,
        temperature: 0.7,
        max_tokens: 350,
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        return response;
      }
    } catch (error: any) {
      console.log(`Telegram AI model ${model} failed: ${error.message?.split('\n')[0]}`);
      continue;
    }
  }

  throw new Error('All AI models failed. Please try again later.');
};

const getEmbedding = async (text: string): Promise<number[]> => {
  const words = text.toLowerCase().split(/\W+/);
  const uniqueWords = [...new Set(words)];
  const embedding = new Array(768).fill(0);
  
  uniqueWords.forEach((word, index) => {
    const pos = index % 768;
    embedding[pos] = Math.min(embedding[pos] + 0.1, 1);
  });
  
  return embedding;
};


// Telegram Content Management Bot
class TelegramReminderBot {
  public bot: TelegramBot | null = null;
  public isActive = true;
  private userSessions = new Map<string, any>(); // chatId -> session data
  private aiSessions = new Map<string, { history: { role: 'user' | 'assistant'; content: string }[] }>();
  private aiModeSessions = new Map<string, 'write_tweet' | 'linkedin_post' | 'comment_post' | 'write_email'>();

  constructor() {
    if (TELEGRAM_BOT_TOKEN) {
      console.log(TELEGRAM_BOT_TOKEN);
      this.startBot();
    }
  }

  private startBot() {
  try {
    if (this.bot) {
      try {
        this.bot.stopPolling();
        console.log(' Stopped previous bot instance');
      } catch (error) {
      }
      this.bot = null;
    }
    
    // 🔥 FIX: Add error handler for polling conflicts
    this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
      polling: true 
    });
    
    
    
    this.setupHandlers();
    this.isActive = true;
    console.log('🤖 Telegram Reminder Bot started');
    
  } catch (error) {
    console.error('❌ Failed to start Telegram bot:', error);
    setTimeout(() => {
      this.startBot();
    }, 15000);
  }
}



  private setupHandlers() {
    if (!this.bot) return;

    // Start command (supports deep-link /start <code>)
    this.bot.onText(/\/start(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username || msg.from?.first_name;
      const telegramUserId = msg.from?.id?.toString();
      const code = match && match[1] ? String(match[1]).trim() : '';

      if (code) {
        try {
          const codeHash = crypto.createHash('sha256').update(code).digest('hex');
          const record = await TelegramLinkCode.findOne({ codeHash });

          if (!record) {
            await this.sendMessage(chatId, '❌ This link is invalid or expired. Please reconnect from the app.');
            return;
          }

          if (record.usedAt) {
            await this.sendMessage(chatId, '❌ This link has already been used. Please generate a new one.');
            return;
          }

          if (record.expiresAt.getTime() < Date.now()) {
            await this.sendMessage(chatId, '❌ This link has expired. Please generate a new one.');
            return;
          }

          if (!telegramUserId) {
            await this.sendMessage(chatId, '❌ Unable to read your Telegram user ID.');
            return;
          }

          const existingUser = await User.findOne({ telegramUserId });
          if (existingUser && existingUser._id.toString() !== record.userId) {
            await this.sendMessage(chatId, '❌ This Telegram account is already linked to another user.');
            return;
          }

          await TelegramLinkCode.findByIdAndUpdate(record._id, {
            usedAt: new Date(),
            usedByTelegramUserId: telegramUserId
          });

          const updatedUser = await User.findOneAndUpdate(
            buildUserQuery(record.userId),
            {
              telegramChatId: chatId.toString(),
              telegramUserId,
              telegramUsername: msg.from?.username
            }
          );
          if (!updatedUser) {
            await this.sendMessage(chatId, '❌ User account not found. Please reconnect from the app.');
            return;
          }

          await this.sendMessage(chatId,
            `✅ **Connected, ${username}!**\n\n` +
            'Your Telegram is now linked to your Second Brain account.\n\n' +
            'You can now:\n' +
            '• Save YouTube/Twitter links with `/addcontent`\n' +
            '• View saved content with `/mycontent`\n' +
            '• Set reminders for important content'
          );

          await this.bot!.sendMessage(
            chatId,
            'Choose an action below:',
            this.getMainMenuMarkup()
          );
          return;
        } catch (error) {
          await this.sendMessage(chatId, '❌ Linking failed. Please try again from the app.');
          return;
        }
      }

      await this.sendMessage(chatId,
        `✨ **Welcome to Second Brain, ${username}!**\n\n` +
        'I help you save and organize your content.\n\n' +
        '📱 **Quick Start:**\n' +
        '1. Link your account from the web app\n' +
        '2. Then save content using `/addcontent`\n\n' +
        '💡 **Use the buttons below** or type /help for commands.'
      );

      await this.bot!.sendMessage(
        chatId,
        'Choose an action below:',
        this.getMainMenuMarkup()
      );
    });

    // Help command
    this.bot.onText(/\/help/, async (msg: any) => {
      const chatId = msg.chat.id;
      await this.sendMessage(chatId,
        '📱 **Available Commands:**\n\n' +
        '🔗 **Account:**\n' +
        'Connect your account in the web app\n' +
        '/status - Check bot status\n\n' +
        '🎵 **Content Management:**\n' +
        '/addcontent - Save content (with title & tags)\n' +
        '/mycontent - View your saved items\n' +
        '/quickadd <link> - Quick save (just link)\n\n' +
        '⏰ **Reminders:**\n' +
        '/reminders - View reminders\n' +
        '/setreminder - Create reminder\n\n' +
        '💡 **Pro Tip:**\n' +
        'Just send any YouTube/Twitter link to start saving!'
      );
    });

    // Link account
    this.bot.onText(/\/link (.+)/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const token = match[1];
      
      try {
        const response = await fetch(`http://localhost:${PORT}/api/v1/telegram/link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramChatId: chatId.toString(),
            telegramUsername: msg.from.username,
            token: token
          })
        });

        const data = await response.json();

        if (data.success) {
          await this.sendMessage(chatId,
            `✅ **Welcome ${data.username}!**\n\n` +
            'Your Second Brain account is now linked with Telegram!\n\n' +
            '🎯 **Now you can:**\n' +
            '• Save YouTube/Twitter links with `/addcontent`\n' +
            '• View saved content with `/mycontent`\n' +
            '• Set reminders for important content\n\n' +
            'Try it now! Send a YouTube or Twitter link.'
          );
        } else {
          await this.sendMessage(chatId,
            '❌ **Linking Failed**\n\n' +
            `Error: ${data.message}\n\n` +
            'Connect from the Second Brain web app.'
          );
        }
      } catch (error) {
        await this.sendMessage(chatId, '❌ Server connection failed.');
      }
    });

    // ============ ENHANCED CONTENT ADDITION ============
    
    // Add content with full form (like web interface)
    this.bot.onText(/\/addcontent/, async (msg: any) => {
      const chatId = msg.chat.id;
      await this.startAddContentFlow(chatId);
    });

    // Quick add command (just link)
    this.bot.onText(/\/quickadd (.+)/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const link = match[1].trim();
      
      // Detect type from URL
      let type = '';
      if (link.includes('youtube.com') || link.includes('youtu.be')) {
        type = 'youtube';
      } else if (link.includes('twitter.com') || link.includes('x.com')) {
        type = 'twitter';
      }
      
      if (!type) {
        await this.sendMessage(chatId, '❌ Please provide a YouTube or Twitter link.');
        return;
      }
      
      await this.quickSaveContent(chatId, link, type);
    });

    // Handle callback queries
    this.bot.on('callback_query', async (callbackQuery: any) => {
      const message = callbackQuery.message;
      const chatId = message.chat.id;
      const data = callbackQuery.data;
      const sessionId = `${chatId}`;
      const session = this.userSessions.get(sessionId);

      await this.bot!.answerCallbackQuery(callbackQuery.id);

      if (data === 'add_content') {
        await this.startAddContentFlow(chatId);
        return;
      }

      if (data === 'my_content') {
        await this.sendMyContent(chatId);
        return;
      }

      if (data === 'reminders') {
        await this.sendReminders(chatId);
        return;
      }

      if (data === 'ai_assistant') {
        await this.sendMessage(chatId, 'Choose a writing mode:', this.getAiModeMarkup());
        return;
      }

      if (data.startsWith('ai_mode_')) {
        const mode = data.replace('ai_mode_', '') as 'write_tweet' | 'linkedin_post' | 'comment_post' | 'write_email';
        this.aiModeSessions.set(chatId.toString(), mode);
        await this.sendMessage(chatId, 'Mode set. Send your prompt.');
        return;
      }

      if (data === 'link_account') {
        await this.sendMessage(chatId,
          '🔗 **Link your account**\n\n' +
          'Open the web app → Telegram tab → Connect Telegram.\n' +
          'Then come back here and tap /start again.'
        );
        return;
      }

      // Remove inline keyboard
      await this.bot!.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: message.message_id }
      );

      if (data === 'cancel') {
        this.userSessions.delete(sessionId);
        await this.bot!.sendMessage(chatId, '❌ Content addition cancelled.');
        return;
      }

      if (data.startsWith('type_')) {
        const type = data.replace('type_', '');
        
        if (session) {
          session.step = 'title';
          session.data.type = type;
          this.userSessions.set(sessionId, session);

          const emoji = type === 'youtube' ? '🎵' : '🐦';
          await this.bot!.sendMessage(chatId,
            `${emoji} **Step 2: Enter Title**\n\n` +
            `Please send me the title for this ${type} content.\n\n` +
            '**Examples:**\n' +
            '• "React Hooks Tutorial"\n' +
            '• "SpaceX Latest Announcement"\n' +
            '• "AI Conference Highlights"\n\n' +
            '📝 *Tip: Make it descriptive for easy searching.*',
            { parse_mode: 'Markdown' }
          );
        }
      }
    });

    // Handle step-by-step messages
    this.bot.on('message', async (msg: any) => {
      if (!msg.text || msg.text.startsWith('/')) return;
      
      const chatId = msg.chat.id;
      const sessionId = `${chatId}`;
      const session = this.userSessions.get(sessionId);
      
      if (!session) {
        // Check if it's a direct link
        const handled = await this.handleDirectLink(msg);
        if (!handled) {
          await this.handleTelegramAi(msg);
        }
        return;
      }

      const userInput = msg.text.trim();
      
      switch (session.step) {
        case 'title':
          session.data.title = userInput;
          session.step = 'link';
          this.userSessions.set(sessionId, session);
          
          const contentType  = session.data.type;
          console.log( session.data.title)
          const linkExample = contentType   === 'youtube' 
            ? 'https://youtube.com/watch?v=example123'
            : 'https://x.com/username/status/123456';
          
          await this.bot!.sendMessage(chatId,
            `✅ **Title saved:** "${userInput}"\n\n` +
            `🔗 **Step 3: Enter ${contentType  === 'youtube' ? 'YouTube' : 'Twitter/X'} URL**\n\n` +
            `Please send me the full link.\n\n` +
            `**Example:**\n` +
            `\`${linkExample}\`\n\n` +
            '🌐 *Make sure the link starts with https://*',
            { parse_mode: 'Markdown' }
          );
          break;
          
        case 'link':
          // Validate URL
          console.log(userInput)
          if (!this.isValidUrl(userInput)) {
            await this.bot!.sendMessage(chatId,
              '❌ **Invalid URL Format**\n\n' +
              'Please enter a valid URL starting with http:// or https://\n\n' +
              'Example: `https://youtube.com/watch?v=example`'
            );
            return;
          }
          
          // Validate URL type
          const type = session.data.type;
          if ((type === 'youtube' && !userInput.includes('youtube.com') && !userInput.includes('youtu.be')) ||
              (type === 'twitter' && !userInput.includes('twitter.com') && !userInput.includes('x.com'))) {
            await this.bot!.sendMessage(chatId,
              `❌ **Wrong URL Type**\n\n` +
              `This doesn't look like a ${type} link.\n` +
              `Please enter a valid ${type} URL.`
            );
            return;
          }
          
          session.data.link = userInput;
          session.step = 'tags';
          this.userSessions.set(sessionId, session);
          
          await this.bot!.sendMessage(chatId,
            '✅ **URL saved!**\n\n' +
            '🏷️ **Step 4: Add Tags (Optional)**\n\n' +
            'Enter tags separated by commas:\n\n' +
            '**Examples:**\n' +
            '• `programming, tutorial, react`\n' +
            '• `spacex, news, technology`\n' +
            '• `ai, conference, highlights`\n\n' +
            '💡 *Tags help organize and find content later.*\n\n' +
            '**Or use these commands:**\n' +
            '• `/skip` - Continue without tags\n' +
            '• `/cancel` - Cancel everything',
            { parse_mode: 'Markdown' }
          );
          break;
          
        case 'tags':
          if (userInput.toLowerCase() === '/skip') {
            session.data.tags = [];
          } else {
            // Parse tags
            session.data.tags = userInput.split(',')
              .map((tag: string) => tag.trim())
              .filter((tag: string) => tag.length > 0);
          }
          
          // Save the content
          await this.saveContentFromTelegram(chatId, session.data);
          
          // Clear session
          this.userSessions.delete(sessionId);
          break;
      }
    });

    // Skip tags command
    this.bot.onText(/\/skip/, async (msg: any) => {
      const chatId = msg.chat.id;
      const sessionId = `${chatId}`;
      const session = this.userSessions.get(sessionId);
      
      if (session && session.step === 'tags') {
        session.data.tags = [];
        await this.saveContentFromTelegram(chatId, session.data);
        this.userSessions.delete(sessionId);
      }
    });

    // Cancel command
    this.bot.onText(/\/cancel/, async (msg: any) => {
      const chatId = msg.chat.id;
      const sessionId = `${chatId}`;
      
      if (this.userSessions.has(sessionId)) {
        this.userSessions.delete(sessionId);
        await this.bot!.sendMessage(chatId, '❌ Content addition cancelled.');
      }
    });

    // View user's content
    this.bot.onText(/\/mycontent/, async (msg: any) => {
      const chatId = msg.chat.id;
      
      try {
        await this.bot!.sendChatAction(chatId, 'typing');
        
        const response = await fetch(`http://localhost:${PORT}/api/v1/telegram/content/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            telegramChatId: chatId.toString(),
            limit: 5 
          })
        });

        const data = await response.json();

        if (data.success) {
          if (data.content.length === 0) {
            await this.sendMessage(chatId,
              '📭 **No Content Yet**\n\n' +
              'You haven\'t saved any content.\n\n' +
              'Try:\n' +
              '• `/addcontent` - Add with form\n' +
              '• Send a YouTube/Twitter link directly\n' +
              '• `/quickadd <link>` - Quick save'
            );
            return;
          }

          let message = `📚 **Your Recent Content (${data.count} total)**\n\n`;
          
          data.content.forEach((item: any, index: number) => {
            const emoji = item.type === 'youtube' ? '🎵' : '🐦';
            const date = new Date(item.createdAt).toLocaleDateString();
            const tags = item.tags?.length > 0 ? `\n   Tags: ${item.tags.join(', ')}` : '';
            
            message += `${index + 1}. ${emoji} **${item.title}**\n`;
            message += `   📅 ${date}${tags}\n\n`;
          });

          await this.sendMessage(chatId, message);
        } else {
          await this.sendMessage(chatId,
            '❌ **Account Not Linked**\n\n' +
            'Please link your account first:\n' +
            '1. Get token from web app → Profile\n' +
            '2. Use the Connect Telegram button in the web app'
          );
        }
      } catch (error) {
        await this.sendMessage(chatId, '❌ Error fetching content. Please try again.');
      }
    });

    // View reminders
    this.bot.onText(/\/reminders/, async (msg: any) => {
      const chatId = msg.chat.id;
      await this.sendReminders(chatId);
    });

    // AI writer command
    this.bot.onText(/\/ai/, async (msg: any) => {
      const chatId = msg.chat.id;
      await this.sendMessage(chatId, 'Choose a writing mode:', this.getAiModeMarkup());
    });
    // Status command
    this.bot.onText(/\/status/, async (msg: any) => {
      const chatId = msg.chat.id;
      
      await this.sendMessage(chatId,
        '📊 **Bot Status**\n\n' +
        '🤖 Bot: ✅ Online\n' +
        '✨ Features: Content Saving, Reminders\n\n' +
        '🔗 **Get Started:**\n' +
        '1. Connect in the web app\n' +
        '2. Save content: `/addcontent`\n\n' +
        '💡 **Quick Save:**\n' +
        'Just send any YouTube/Twitter link!'
      );
    });
  }

  // ============ HELPER METHODS ============

  private getAiModeMarkup() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Tweet', callback_data: 'ai_mode_write_tweet' },
            { text: 'LinkedIn', callback_data: 'ai_mode_linkedin_post' }
          ],
          [
            { text: 'Comment', callback_data: 'ai_mode_comment_post' },
            { text: 'Email', callback_data: 'ai_mode_write_email' }
          ]
        ]
      }
    };
  }

  private getTelegramAiSystemPrompt(mode: 'write_tweet' | 'linkedin_post' | 'comment_post' | 'write_email') {
    const base =
      'You are SecondBrain AI � a sharp, human content creator with 5+ years of experience.\n\n' +
      'Rules:\n' +
      '- Keep all responses short.\n' +
      '- Never write long paragraphs.\n' +
      '- No generic templates.\n' +
      '- No robotic tone.\n' +
      '- Sound like a real person.\n' +
      '- Slightly conversational.\n' +
      '- Light emotion when appropriate.\n' +
      '- Use max 1 emoji only when it fits naturally.\n' +
      '- Be clear and confident.\n' +
      '- Avoid filler words.';

    switch (mode) {
      case 'write_tweet':
        return base +
          '\n\nTweet Mode:\n' +
          '- Write a short, punchy tweet under 220 characters.\n' +
          '- Make it engaging and human.\n' +
          '- No hashtags unless necessary.';
      case 'linkedin_post':
        return base +
          '\n\nLinkedIn Post Mode:\n' +
          '- Write a short LinkedIn post.\n' +
          '- Max 6 lines.\n' +
          '- Professional but human.\n' +
          '- Clear message. No fluff.';
      case 'comment_post':
        return base +
          '\n\nComment Mode:\n' +
          '- Write a short, thoughtful comment.\n' +
          '- 2�3 lines max.\n' +
          '- Sound natural and smart.';
      case 'write_email':
      default:
        return base +
          '\n\nEmail Mode:\n' +
          '- Write a short professional email.\n' +
          '- Direct and confident.\n' +
          '- No formal clich�s.\n' +
          '- Max 8 lines.';
    }
  }
  private getMainMenuMarkup() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Add Content', callback_data: 'add_content' },
            { text: 'My Content', callback_data: 'my_content' }
          ],
          [
            { text: 'Reminders', callback_data: 'reminders' },
            { text: 'Link Account', callback_data: 'link_account' }
          ],
          [
            { text: 'AI Writer', callback_data: 'ai_assistant' }
          ]
        ]
      }
    };
  }

  private async startAddContentFlow(chatId: string) {
    const sessionId = `${chatId}`;

    this.userSessions.set(sessionId, {
      step: 'type',
      data: { tags: [] }
    });

    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'YouTube Video', callback_data: 'type_youtube' },
            { text: 'Tweet/X Post', callback_data: 'type_twitter' }
          ],
          [
            { text: 'Cancel', callback_data: 'cancel' }
          ]
        ]
      }
    };

    await this.bot!.sendMessage(chatId,
      'Lets save some content!\n\n' +
      'We will collect:\n' +
      '1) Type\n' +
      '2) Title\n' +
      '3) URL\n' +
      '4) Tags (optional)\n\n' +
      'Step 1: Choose content type:',
      options
    );
  }

  private async sendMyContent(chatId: string) {
    try {
      await this.bot!.sendChatAction(chatId, 'typing');

      const response = await fetch(`http://localhost:${PORT}/api/v1/telegram/content/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramChatId: chatId.toString(),
          limit: 5
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.content.length === 0) {
          await this.sendMessage(chatId,
            'No content yet.\n\n' +
            'Try:\n' +
            '/addcontent - Add with form\n' +
            'Send a YouTube/Twitter link\n' +
            '/quickadd <link> - Quick save'
          );
          return;
        }

        let message = `Your Recent Content (${data.count} total)\n\n`;

        data.content.forEach((item: any, index: number) => {
          const date = new Date(item.createdAt).toLocaleDateString();
          const tags = item.tags?.length > 0 ? `\n   Tags: ${item.tags.join(', ')}` : '';

          message += `${index + 1}. ${item.title}\n`;
          message += `   ${date}${tags}\n\n`;
        });

        await this.sendMessage(chatId, message);
      } else {
        await this.sendMessage(chatId,
          'Account not linked.\n\n' +
          'Link your account in the web app and try again.'
        );
      }
    } catch (error) {
      await this.sendMessage(chatId, 'Error fetching content. Please try again.');
    }
  }

  private async sendReminders(chatId: string) {
    try {
      const reminders = await Reminder.find({ telegramChatId: chatId.toString(), isActive: true })
        .sort({ reminderTime: 1 })
        .limit(5)
        .select('title reminderTime repeat');

      if (!reminders.length) {
        await this.sendMessage(chatId,
          'No active reminders.\n\n' +
          'Create reminders in the web app (Reminders tab).'
        );
        return;
      }

      let message = `Your Active Reminders\n\n`;
      reminders.forEach((reminder: any, index: number) => {
        const date = new Date(reminder.reminderTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        message += `${index + 1}. ${reminder.title}\n   ${date}\n   ${reminder.repeat}\n\n`;
      });

      await this.sendMessage(chatId, message);
    } catch (error) {
      await this.sendMessage(chatId, 'Error fetching reminders. Please try again.');
    }
  }
// Handle direct link messages
  private async handleDirectLink(msg: any): Promise<boolean> {
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (this.isValidUrl(text)) {
      let type = '';
      
      if (text.includes('youtube.com') || text.includes('youtu.be')) {
        type = 'youtube';
      } else if (text.includes('twitter.com') || text.includes('x.com')) {
        type = 'twitter';
      }
      
      if (type) {
        // Start session for direct link
        const sessionId = `${chatId}`;
        this.userSessions.set(sessionId, {
          step: 'title',
          data: {
            type: type,
            link: text,
            tags: []
          }
        });
        
        const emoji = type === 'youtube' ? '[YT]' : '[TW]';
        await this.bot!.sendMessage(chatId,
          `${emoji} **I found a ${type} link!**\n\n` +
          'Let\'s save it properly:\n\n' +
          'Title required:\n\n' +
          'Examples:\n' +
          '� "React Tutorial"\n' +
          '� "Important Announcement"\n' +
          '� "Conference Talk"\n\n' +
          'Or use `/cancel` to abort.',
          { parse_mode: 'Markdown' }
        );
        return true;
      }
    }
    return false;
  }

  private async handleTelegramAi(msg: any) {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from?.id?.toString() || chatId.toString();
    const message = msg.text.trim();

    if (!message) return;

    const historyEntry = this.aiSessions.get(telegramUserId);
    const history = [
      ...(historyEntry?.history ?? []),
      { role: 'user' as const, content: message }
    ];

    const mode = this.aiModeSessions.get(chatId.toString());
    if (!mode) {
      await this.sendMessage(chatId, 'Choose a writing mode:', this.getAiModeMarkup());
      return;
    }
    const systemPrompt = this.getTelegramAiSystemPrompt(mode);

    try {
      await this.bot!.sendChatAction(chatId, 'typing');

      const response = await fetch(`http://localhost:${PORT}/api/telegram/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: telegramUserId,
          message,
          history,
          systemPrompt
        })
      });

      const data = await response.json();
      const reply = data?.reply || 'Sorry, I could not generate a response.';
      const chunks = this.splitTelegramMessage(reply, 3800);

      for (const chunk of chunks) {
        await this.sendMessage(chatId, chunk, { parse_mode: false, disable_web_page_preview: true });
      }

      const nextHistory = history
        .concat({ role: 'assistant' as const, content: reply })
        .slice(-10);
      this.aiSessions.set(telegramUserId, { history: nextHistory });
    } catch (error) {
      await this.sendMessage(chatId, 'AI service error. Please try again.');
    }
  }

  private splitTelegramMessage(text: string, maxLength: number) {
    if (text.length <= maxLength) return [text];
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLength) {
      let slice = remaining.slice(0, maxLength);
      const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
      if (lastBreak > 200) {
        slice = slice.slice(0, lastBreak + 1);
      }
      chunks.push(slice.trim());
      remaining = remaining.slice(slice.length);
    }

    if (remaining.trim().length > 0) chunks.push(remaining.trim());
    return chunks;
  }
// Quick save (just link with auto-generated title)
  private async quickSaveContent(chatId: number, link: string, type: string) {
    try {
      await this.bot!.sendChatAction(chatId, 'typing');
      
      // Auto-generate title
      let title = '';
      if (type === 'youtube') {
        const videoId = this.extractVideoId(link);
        title = `YouTube: ${videoId || 'Video'}`;
      } else {
        const tweetId = this.extractTweetId(link);
        title = `Tweet: ${tweetId || 'Post'}`;
      }
      
      const response = await fetch(`http://localhost:${PORT}/api/v1/telegram/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramChatId: chatId.toString(),
          link: link,
          type: type,
          title: title,
          tags: ['telegram', 'quick', type]
        })
      });

      const data = await response.json();

      if (data.success) {
        const emoji = type === 'youtube' ? '🎵' : '🐦';
        await this.sendMessage(chatId,
          `${emoji} **Quick Save Complete!**\n\n` +
          `**Title:** ${data.content.title}\n` +
          `**Type:** ${data.content.type}\n\n` +
          '✅ Added to your Cosmic Mind library.'
        );
      } else {
        await this.sendMessage(chatId,
          '❌ **Failed to Save**\n\n' +
          `Error: ${data.message}\n\n` +
          'Make sure your account is linked from the web app.'
        );
      }
    } catch (error) {
      await this.sendMessage(chatId, '❌ Connection error. Please try again.');
    }
  }

 
  // Save content with full form data - USE PLAIN TEXT
private async saveContentFromTelegram(chatId: number, contentData: any) {
  try {
    await this.bot!.sendChatAction(chatId, 'typing');
    
    console.log('📤 Saving content via API:', contentData);
    
    const response = await fetch(`http://localhost:${PORT}/api/v1/telegram/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramChatId: chatId.toString(),
        link: contentData.link,
        type: contentData.type,
        title: contentData.title,
        tags: contentData.tags
      })
    });

    const data = await response.json();
    console.log('API Response:', data);

    if (data.success) {
      const emoji = contentData.type === 'youtube' ? '🎵' : '🐦';
      let tagsText = '';
      if (contentData.tags && contentData.tags.length > 0) {
        tagsText = `\nTags: ${contentData.tags.join(', ')}`;
      }
      
      // PLAIN TEXT MESSAGE - NO MARKDOWN
      const message = `${emoji} ✅ Content Saved Successfully!\n\n` +
                     `Title: ${data.content.title}\n` +
                     `Type: ${data.content.type}\n` +
                     `URL: ${data.content.link}${tagsText}\n\n` +
                     `✨ This content is now available in your Cosmic Mind library!`;
      
      // Send without parse_mode
      await this.bot!.sendMessage(chatId, message);
      
      // Show quick actions
      const quickActions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📚 View My Content', callback_data: 'view_my_content' }],
            [{ text: '➕ Add More', callback_data: 'add_more_content' }]
          ]
        }
      };
      
      await this.bot!.sendMessage(chatId, 'What would you like to do next?', quickActions);
    } else {
      // Plain text error message
      await this.bot!.sendMessage(chatId,
        `❌ Failed to Save Content\n\n` +
        `Error: ${data.message}\n\n` +
        `Make sure:\n` +
        `1. Your account is linked\n` +
        `2. The URL is valid\n` +
        `3. Try again with /addcontent`
      );
    }
  } catch (error) {
    console.error('Save content error:', error);
    await this.bot!.sendMessage(chatId,
      '❌ Connection Error\n\n' +
      'Cannot connect to server. Please try again later.'
    );
  }
}


  // Utility methods
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
    return match ? match[1]!.substring(0, 10) : 'video';
  }

  private extractTweetId(url: string): string {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1]! : 'tweet';
  }

  // Send message helper
  async sendMessage(chatId: string | number, message: string, options: any = {}) {
    if (!this.bot || !this.isActive) return false;
    
    try {
      if (!options.parse_mode) {
        options.parse_mode = 'Markdown';
      }
      
      await this.bot.sendMessage(chatId, message, options);
      return true;
    } catch (error: any) {
      console.error('Failed to send Telegram message:', error.message);
      
      // Try without Markdown
      if (error.message.includes('Markdown')) {
        try {
          delete options.parse_mode;
          await this.bot.sendMessage(chatId, message.replace(/[\*_`]/g, ''), options);
          return true;
        } catch (retryError) {
          console.error('Retry also failed:', retryError);
        }
      }
      
      return false;
    }
  }

  async sendNotification(message: string) {
    if (!this.bot || !this.isActive || TELEGRAM_CHAT_IDS.length === 0) return;
    
    for (const chatId of TELEGRAM_CHAT_IDS) {
      try {
        await this.sendMessage(chatId, `🔔 ${message}`);
      } catch (error) {
        console.error(`Failed to send to ${chatId}:`, error);
      }
    }
  }
}
// Create bot instance
const telegramBot = new TelegramReminderBot();

// ============ MIDDLEWARE ============
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  // 1) Legacy JWT (our existing auth)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token!);

    if (decoded) {
      req.userId = decoded.userId;
      req.username = decoded.username;
      next();
      return;
    }
  }

  // 2) Clerk (optional) - only if CLERK_SECRET_KEY is configured
  if (CLERK_ENABLED) {
    const auth = getAuth(req);
    if (auth.userId) {
      req.userId = auth.userId;
      // Best-effort username (may be empty depending on Clerk configuration)
      const claims = auth.sessionClaims as Record<string, unknown> | null | undefined;
      const maybeUsername =
        (claims && typeof claims['username'] === 'string' ? claims['username'] : undefined) ||
        (claims && typeof claims['email'] === 'string' ? claims['email'] : undefined) ||
        (claims && typeof claims['primary_email_address'] === 'string' ? claims['primary_email_address'] : undefined) ||
        (claims && typeof claims['sub'] === 'string' ? claims['sub'] : undefined);
      if (typeof maybeUsername === 'string') {
        req.username = maybeUsername;
      }
      next();
      return;
    }
  }

  res.status(401).json({ message: 'Authentication required' });
};


// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      username?: string;
    }
  }
}

// Initialize text splitter (for PDF)
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// ============ EXPRESS SETUP ============
const app = express();
if (CLERK_ENABLED) {
  app.use(clerkMiddleware({
    // Local dev machines often drift; tolerate a bit more than default 5s.
    clockSkewInMs: 2 * 60 * 1000,
  }));
}
app.use(cors({
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// File upload setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'));
    }
  }
});

// ============ ROUTES ============

// 🔐 AUTHENTICATION (UNCHANGED)
app.post('/api/v1/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: 'Username and password required' });
      return;
    }

    if (username.length < 3) {
      res.status(400).json({ message: 'Username must be at least 3 characters' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.status(409).json({ message: 'Username exists' });
      return;
    }

    const hashedPassword = await hashPassword(password);
    const user = new User({
      username,
      password: hashedPassword
    });

    await user.save();

    const token = generateToken(user._id.toString(), user.username);

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/v1/signin', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: 'Username and password required' });
      return;
    }

    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!user.password) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const validPassword = await comparePassword(password, user.password);
    if (!validPassword) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user._id.toString(), user.username);

    res.json({
      token,
      user: { id: user._id, username: user.username }
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/v1/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne(buildUserQuery(req.userId!)).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      username: user.username,
      userId: user._id,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ NOTION OAUTH ============
app.get('/api/notion/connect', async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const authorizationUrl = generateAuthorizationUrl();
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Notion connect error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to initiate Notion OAuth'
    });
  }
});

app.get('/api/notion/callback', async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const code = req.query.code;
    if (!code || typeof code !== 'string') {
      res.status(400).json({ message: 'Authorization code is required' });
      return;
    }

    const token = await exchangeCodeForToken(code);

    await NotionConnection.findOneAndUpdate(
      { userId: auth.userId },
      {
        userId: auth.userId,
        accessToken: token.access_token,
        workspaceId: token.workspace_id,
        workspaceName: token.workspace_name,
        connectedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(dashboardUrl);
  } catch (error) {
    console.error('Notion callback error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to connect Notion'
    });
  }
});

app.get('/api/v1/notion/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const connection = await NotionConnection.findOne({ userId }).select('workspaceName connectedAt');
    res.json({
      connected: Boolean(connection),
      workspaceName: connection?.workspaceName || '',
      connectedAt: connection?.connectedAt || null
    });
  } catch (error) {
    console.error('Notion status error:', error);
    res.status(500).json({ message: 'Failed to fetch Notion status' });
  }
});
// 🎵 CONTENT MANAGEMENT (UNCHANGED)
app.post('/api/v1/content', authMiddleware, async (req, res) => {
  try {
    const { title, link, type, tags } = req.body;
    const userId = req.userId!;

    if (!title || !link || !type) {
      res.status(400).json({ message: 'Title, link, and type required' });
      return;
    }

    if (!['youtube', 'twitter', 'pdf'].includes(type)) {
      res.status(400).json({ message: 'Type must be youtube, twitter, or pdf' });
      return;
    }

    const content = new Content({
      title,
      link,
      type,
      userId,
      tags: tags || []
    });

    await content.save();

    res.status(201).json({
      message: 'Content added',
      content: {
        id: content._id,
        title: content.title,
        link: content.link,
        type: content.type,
        userId: content.userId,
        tags: content.tags,
        createdAt: content.createdAt
      }
    });

  } catch (error) {
    console.error('Add content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/v1/content', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const content = await Content.find({ userId })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      content,
      count: content.length
    });

  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/v1/content', authMiddleware, async (req, res) => {
  try {
    const { contentId } = req.body;
    const userId = req.userId!;

    if (!contentId) {
      res.status(400).json({ message: 'Content ID required' });
      return;
    }

    const content = await Content.findOneAndDelete({
      _id: contentId,
      userId
    });

    if (!content) {
      res.status(404).json({ message: 'Content not found' });
      return;
    }

    res.json({ message: 'Content deleted' });

  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post("/api/v1/pdf/upload", authMiddleware, upload.single("pdf"), async (req, res): Promise<void> => {
  let tempFilePath = "";

  try {
    if (!req.file) {
      res.status(400).json({ message: "No PDF file uploaded" });
      return;
    }

    const userId = req.userId!;
    const originalName = req.file.originalname;
    const pdfBuffer = req.file.buffer;

    // Create temp file
    const tempFileName = `${crypto.randomUUID()}.pdf`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    fs.writeFileSync(tempFilePath, pdfBuffer);

    // Load and split PDF
    const loader = new PDFLoader(tempFilePath);
    const docs = await loader.load();
    const splitDocs = await textSplitter.splitDocuments(docs);

    // Create safe collection name
    const safeCollectionName = `user_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase()
      .substring(0, 50);

    console.log('🔧 Qdrant Configuration:');
    console.log('URL:', QDRANT_URL);
    console.log('API Key present:', !!QDRANT_API_KEY);
    console.log('Collection name:', safeCollectionName);

    // Initialize Qdrant client for Cloud
    const qdrantConfig = {
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY!
    };

    const client = new QdrantClient(qdrantConfig);

    // Test connection to Qdrant Cloud
    try {
      console.log('🔌 Testing Qdrant Cloud connection...');
      const collections = await client.getCollections();
      console.log('✅ Qdrant Cloud connection successful');
      console.log('📊 Existing collections:', collections.collections?.length || 0);
    } catch (connError: any) {
      console.error('❌ Qdrant Cloud connection failed:', connError.message);
      
      // Provide helpful error message
      if (connError.status === 401 || connError.status === 403) {
        throw new Error('Invalid Qdrant Cloud API key. Please check your API key.');
      } else if (connError.status === 404) {
        throw new Error('Qdrant Cloud URL not found. Please check the URL.');
      } else {
        throw new Error(`Qdrant Cloud connection failed: ${connError.message}`);
      }
    }

    // Check if collection exists
    try {
      console.log(`🔍 Checking if collection exists: ${safeCollectionName}`);
      const collectionExists = await client.collectionExists(safeCollectionName);
      if (collectionExists) {
        console.log(`🗑️ Deleting existing collection: ${safeCollectionName}`);
        await client.deleteCollection(safeCollectionName);
        // Wait for collection to be fully deleted
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`✅ Collection doesn't exist, will create new: ${safeCollectionName}`);
      } else {
        console.log(`⚠️ Error checking collection: ${error.message}`);
      }
    }

    // Create simple embeddings (since we're not using Gemini)
    console.log(`🧠 Creating embeddings for ${splitDocs.length} chunks...`);
    const points = [];
    const chunkSize = Math.min(splitDocs.length, 50); // Process in smaller batches for cloud

    for (let batchStart = 0; batchStart < splitDocs.length; batchStart += chunkSize) {
      const batchEnd = Math.min(batchStart + chunkSize, splitDocs.length);
      const batch = splitDocs.slice(batchStart, batchEnd);
      
      for (let i = 0; i < batch.length; i++) {
        const doc = batch[i];
        const embedding = await getEmbedding(doc!.pageContent);
        points.push({
          id: (batchStart + i + 1),
          vector: embedding,
          payload: {
            text: doc!.pageContent,
            chunkIndex: batchStart + i,
            userId: userId,
            originalName: originalName,
            totalChunks: splitDocs.length,
            timestamp: new Date().toISOString()
          },
        });
      }
      
      console.log(`📦 Processed ${batchEnd}/${splitDocs.length} chunks`);
      // Small delay between batches for cloud API
      if (batchEnd < splitDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Create collection in Qdrant Cloud
    console.log('🏗️ Creating collection in Qdrant Cloud...');
    await client.createCollection(safeCollectionName, {
      vectors: {
        size: 768, // Must match embedding size
        distance: "Cosine",
      },
    });

    // Upload vectors in batches (better for cloud)
    console.log('⬆️ Uploading vectors to Qdrant Cloud...');
    if (points.length > 0) {
      // Upload in smaller batches for cloud stability
      const uploadBatchSize = 100;
      for (let i = 0; i < points.length; i += uploadBatchSize) {
        const batch = points.slice(i, i + uploadBatchSize);
        await client.upsert(safeCollectionName, {
          wait: true,
          points: batch,
        });
        console.log(`📤 Uploaded batch ${Math.floor(i/uploadBatchSize) + 1}/${Math.ceil(points.length/uploadBatchSize)}`);
        
        // Small delay between batches
        if (i + uploadBatchSize < points.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    // Store collection metadata in MongoDB
    console.log('💾 Saving metadata to MongoDB...');
    const pdfCollection = new PDFCollection({
      name: safeCollectionName,
      originalName: originalName,
      userId: userId,
      chunks: splitDocs.length,
      vectorCollectionName: safeCollectionName,
      pdfText: splitDocs.map(doc => doc.pageContent).join('\n\n'),
      uploadDate: new Date()
    });

    await pdfCollection.save();

    // Also save as content item
    const content = new Content({
      title: originalName.replace(/\.[^/.]+$/, ""),
      link: `/pdf/${pdfCollection._id}`,
      type: 'pdf',
      userId: userId,
      tags: ['pdf', 'document', 'uploaded'],
      createdAt: new Date()
    });

    await content.save();

    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('🧹 Cleaned up temp file');
    }

    console.log('✅ PDF upload completed successfully');
    res.status(201).json({
      success: true,
      message: "PDF processed and uploaded to Qdrant Cloud successfully",
      data: {
        collectionName: safeCollectionName,
        documentCount: splitDocs.length,
        chunks: splitDocs.length,
        contentId: content._id,
        collectionId: pdfCollection._id,
        originalName: originalName,
        userId: userId
      }
    });

  } catch (error: any) {
    console.error("❌ Error processing PDF:", error);
    
    // Clean up temp file if exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🧹 Cleaned up temp file after error');
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }
    }

    // Provide user-friendly error messages
    let userMessage = "Failed to process PDF";
    let statusCode = 500;
    
    if (error.message.includes('Invalid Qdrant Cloud API key')) {
      userMessage = "Invalid Qdrant Cloud API key. Please check your configuration.";
      statusCode = 401;
    } else if (error.message.includes('Qdrant Cloud URL not found')) {
      userMessage = "Qdrant Cloud URL is incorrect or service is unavailable.";
      statusCode = 400;
    } else if (error.message.includes('connection failed')) {
      userMessage = "Cannot connect to Qdrant Cloud. Please check your internet connection.";
      statusCode = 503;
    }

    res.status(statusCode).json({ 
      success: false,
      message: userMessage,
      error: error.message,
      tip: "Make sure your Qdrant Cloud URL and API key are correct in .env file"
    });
  }
});

app.get('/api/v1/pdf/collections', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const collections = await PDFCollection.find({ userId })
      .sort({ uploadDate: -1 })
      .select('name originalName uploadDate chunks');

    res.json({
      collections,
      count: collections.length
    });

  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 📁 PDF CHAT ENDPOINT
app.post('/api/v1/pdf/chat', authMiddleware, async (req, res) => {
  try {
    const { query, collectionName } = req.body;
    const userId = req.userId!;

    if (!query || !collectionName) {
      res.status(400).json({ message: 'Query and collection name required' });
      return;
    }

    console.log(`📄 PDF Chat Request:`, { query, collectionName, userId });

    // Verify user owns this collection
    const collection = await PDFCollection.findOne({
      name: collectionName,
      userId
    });

    if (!collection) {
      res.status(404).json({ message: 'PDF collection not found or access denied' });
      return;
    }

    // Initialize Qdrant client
    const qdrantConfig = {
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY!
    };

    const client = new QdrantClient(qdrantConfig);

    // Generate query embedding (same as PDF chunks)
    const queryEmbedding = await getEmbedding(query);
    
    // Search in Qdrant for similar chunks
    const searchResult = await client.search(collectionName, {
      vector: queryEmbedding,
      limit: 5, // Get top 5 most relevant chunks
      with_payload: true,
      with_vector: false
    });

    if (!searchResult || searchResult.length === 0) {
      return res.json({
        response: "I couldn't find relevant information in this document to answer your question.",
        relevantChunks: 0,
        collectionName: collection.originalName
      });
    }

    // Extract text from search results
    const relevantTexts = searchResult
      .map(result => (result.payload as any).text)
      .filter(Boolean);

    // Combine into context
    const context = relevantTexts.join('\n\n---\n\n');

    console.log(`🔍 Found ${relevantTexts.length} relevant chunks for query: "${query.substring(0, 50)}..."`);

    // Generate response using Groq with PDF context
    const groq = initializeGroqClient();
    if (!groq) {
      return res.status(500).json({ 
        message: 'AI service not configured' 
      });
    }

    const systemPrompt = `You are a helpful document assistant. Answer the user's question based ONLY on the following context from a PDF document. 
If the answer cannot be found in the context, say "I cannot find that information in this document."

CONTEXT FROM PDF:
${context}

IMPORTANT INSTRUCTIONS:
1. Answer using ONLY information from the context above
2. Do not use any external knowledge
3. If you're not sure, say so
4. Be concise and accurate

QUESTION: ${query}

ANSWER:`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: query
        }
      ],
      model: 'llama-3.1-8b-instant', 
      temperature: 0.3, 
      max_tokens: 1024,
    });

    const response = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

    res.json({
      response,
      relevantChunks: relevantTexts.length,
      collectionName: collection.originalName,
      query: query,
      contextPreview: context.substring(0, 200) + '...' // For debugging
    });

  } catch (error: any) {
    console.error('PDF chat error:', error);
    res.status(500).json({
      message: 'Failed to process PDF chat',
      error: error.message,
      tip: 'Make sure the PDF collection exists and Qdrant is accessible'
    });
  }
});
// SIMPLE WORKING VERSION WITH GROQ
app.post('/api/v1/ai/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    console.log(message)
    const userId = req.userId!;

    // Get user's saved content for context
    const userContent = await Content.find({ userId }).limit(5);
    const context = userContent.length > 0 
      ? `User's saved content:\n${userContent.map((c, i) => `${i+1}. ${c.title} (${c.type}): ${c.link}`).join('\n')}`
      : 'User has no saved content yet.';

    // Get response from Groq
    const response = await getGroqResponse(message, context);

    res.json({
      response,
      hasContext: userContent.length > 0,
      contextItems: userContent.length,
      provider: 'Groq Cloud'
    });

  } catch (error: any) {
    console.error('AI Error:', error.message);
    res.status(500).json({
      response: "I'm having trouble connecting to the AI service right now. Please try again in a moment.",
      error: error.message
    });
  }
});
app.post('/api/telegram/ai', async (req, res) => {
  try {
    const { userId, message,
          history,
          systemPrompt } = req.body;

    if (!userId || !message) {
      res.status(400).json({ message: 'userId and message are required' });
      return;
    }

    const reply = await getTelegramAiResponse(String(message), history, systemPrompt);
    res.json({ reply });
  } catch (error: any) {
    console.error('Telegram AI error:', error);
    res.status(500).json({ message: error?.message || 'Telegram AI failed' });
  }
});

// 🔗 SHARING SYSTEM (MongoDB) - UNCHANGED
app.post('/api/v1/brain/share', authMiddleware, async (req, res) => {
  try {
    const { share } = req.body;
    const userId = req.userId!;

    if (typeof share !== 'boolean') {
      res.status(400).json({ message: 'Share boolean required' });
      return;
    }

    if (share) {
      // Create or update share link in MongoDB
      let shareLink = await ShareLink.findOne({ userId, isActive: true });

      if (!shareLink) {
        const hash = crypto.randomBytes(8).toString('hex');
        shareLink = new ShareLink({
          hash,
          userId,
          isActive: true
        });
        await shareLink.save();
      }

      res.json({
        hash: shareLink.hash,
        url: `${req.protocol}://${req.get('host')}/api/v1/brain/${shareLink.hash}`
      });

    } else {
      // Deactivate share link in MongoDB
      await ShareLink.findOneAndUpdate(
        { userId, isActive: true },
        { isActive: false }
      );

      res.json({ message: 'Share link deactivated' });
    }

  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/v1/brain/:shareLink', async (req, res) => {
  try {
    const { shareLink } = req.params;

    // Find active share link in MongoDB
    const link = await ShareLink.findOne({
      hash: shareLink,
      isActive: true
    }).populate('userId', 'username');

    if (!link) {
      res.status(404).json({ message: 'Link not found or inactive' });
      return;
    }

    const user = link.userId as any;

    // Get user's public content from MongoDB
    const userContent = await Content.find({
      userId: user._id
    }).select('title link type tags createdAt');

    // Get user's PDF collections from MongoDB
    const userCollections = await PDFCollection.find({
      userId: user._id
    }).select('name originalName uploadDate chunks');

    res.json({
      username: user.username,
      content: userContent,
      pdfCollections: userCollections,
      sharedAt: link.createdAt
    });

  } catch (error) {
    console.error('Access shared error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ REMINDER ENDPOINTS ============

// Create a reminder


app.post('/api/v1/reminders', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const { title, description, reminderTime, repeat, telegramChatId } = req.body;

    if (!title || !reminderTime) {
      return res.status(400).json({ message: 'Title and reminder time are required' });
    }

    // IMPORTANT: Convert incoming IST time to UTC for storage
    // Assuming reminderTime is in ISO format like "2024-01-15T14:30:00" (which will be treated as IST)
    const reminderTimeIST = new Date(reminderTime);
    
    // Convert IST to UTC (subtract 5:30 hours)
    const reminderTimeUTC = new Date(reminderTimeIST.getTime() - (5.5 * 60 * 60 * 1000));

    const reminder = new Reminder({
      userId,
      title,
      description: description || '',
      reminderTime: reminderTimeUTC, // Store in UTC
      repeat: repeat || 'once',
      telegramChatId: telegramChatId || '',
      isActive: true
    });

    await reminder.save();

    // Schedule the reminder
    scheduleReminder(reminder);

    res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      reminder: {
        id: reminder._id,
        title: reminder.title,
        reminderTime: reminderTimeIST, // Return IST time to user
        repeat: reminder.repeat,
        isActive: reminder.isActive
      }
    });

  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ message: 'Failed to create reminder' });
  }
});



// Get user's reminders
app.get('/api/v1/reminders', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const reminders = await Reminder.find({ userId })
      .sort({ reminderTime: 1 })
      .select('title description reminderTime repeat isActive');

    const activeReminders = reminders.filter(r => r.isActive);
    const pastReminders = reminders.filter(r => !r.isActive);

    res.json({
      activeReminders,
      pastReminders,
      total: reminders.length,
      activeCount: activeReminders.length
    });

  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ message: 'Failed to get reminders' });
  }
});

// Delete a reminder
app.delete('/api/v1/reminders/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const reminderId = req.params.id;

    const reminder = await Reminder.findOneAndDelete({
      _id: reminderId,
      userId
    });

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    res.json({ 
      success: true, 
      message: 'Reminder deleted successfully' 
    });

  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ message: 'Failed to delete reminder' });
  }
});

// Toggle reminder active status
app.put('/api/v1/reminders/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const reminderId = req.params.id;

    const reminder = await Reminder.findOne({
      _id: reminderId,
      userId
    });

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    reminder.isActive = !reminder.isActive;
    await reminder.save();

    res.json({
      success: true,
      message: reminder.isActive ? 'Reminder activated' : 'Reminder deactivated',
      isActive: reminder.isActive
    });

  } catch (error) {
    console.error('Toggle reminder error:', error);
    res.status(500).json({ message: 'Failed to toggle reminder' });
  }
});

// ============ TELEGRAM INTEGRATION ENDPOINTS ===========

// Generate short-lived deep-link code and return or redirect to Telegram bot
app.get('/api/v1/telegram/link/start', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;

    await ensureAppUser(userId, req.username);

    const code = crypto.randomBytes(24).toString('hex');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await TelegramLinkCode.findOneAndUpdate(
      { userId },
      {
        userId,
        codeHash,
        expiresAt,
        usedAt: null,
        usedByTelegramUserId: null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const telegramBotUsername = 'secondb121_bot';
    const deepLinkUrl = `https://t.me/${telegramBotUsername}?start=${encodeURIComponent(code)}`;
    const wantsJson =
      req.query.format === 'json' ||
      req.headers.accept?.includes('application/json') ||
      req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (wantsJson) {
      res.json({ url: deepLinkUrl, expiresAt: expiresAt.toISOString() });
      return;
    }

    res.redirect(deepLinkUrl);
  } catch (error) {
    console.error('Telegram deep-link error:', error);
    res.status(500).json({ message: 'Failed to generate Telegram link' });
  }
});

// Get Telegram connection status for current user
app.get('/api/v1/telegram/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const user = await User.findOne(buildUserQuery(userId)).select('telegramChatId telegramUsername');

    if (!user) {
      res.json({
        linked: false,
        telegramChatId: '',
        telegramUsername: ''
      });
      return;
    }

    res.json({
      linked: Boolean(user.telegramChatId),
      telegramChatId: user.telegramChatId || '',
      telegramUsername: user.telegramUsername || ''
    });
  } catch (error) {
    console.error('Telegram status error:', error);
    res.status(500).json({ message: 'Failed to fetch Telegram status' });
  }
});

// Link Telegram account with Cosmic Mind account
app.post('/api/v1/telegram/link', async (req, res) => {
  try {
    const { telegramChatId, telegramUsername, token } = req.body;

    if (!telegramChatId || !token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Telegram chat ID and token are required' 
      });
    }

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Update user with Telegram info
    user.telegramChatId = telegramChatId;
    user.telegramUsername = telegramUsername;
    await user.save();

    res.json({
      success: true,
      message: 'Telegram account linked successfully',
      username: user.username,
      telegramChatId: user.telegramChatId
    });

  } catch (error) {
    console.error('Telegram link error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to link Telegram account' 
    });
  }
});

// Add content from Telegram (ENHANCED VERSION - REMOVE THE OTHER ONE!)
app.post('/api/v1/telegram/content', async (req, res) => {
  try {
    const { 
      telegramChatId, 
      link, 
      type, 
      title, 
      tags = [] 
    } = req.body;

    console.log('📥 Telegram content request:', { telegramChatId, type, title });

    if (!telegramChatId || !link || !type || !title) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required: chat ID, link, type, and title' 
      });
    }

    // Validate content type
    if (!['youtube', 'twitter'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Type must be youtube or twitter' 
      });
    }

    // Find user by Telegram chat ID
    const user = await User.findOne({ telegramChatId });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Please connect your account from the web app.' 
      });
    }

    // Create content item
    const content = new Content({
      title: title,
      link: link,
      type: type,
      userId: user._id,
      tags: ['telegram', type, ...tags.filter((tag: string) => tag.trim())],
      createdAt: new Date()
    });

    await content.save();

    console.log('✅ Content saved to DB:', content._id);

    // Send simple notification WITHOUT MARKDOWN to avoid errors
    if (telegramBot && telegramBot.bot) {
      try {
        const emoji = type === 'youtube' ? '🎵' : '🐦';
        const tagsText = tags.length > 0 ? `\nTags: ${tags.join(', ')}` : '';
        
        // PLAIN TEXT MESSAGE - NO MARKDOWN
        const message = `${emoji} Content Saved Successfully!\n\n` +
                       `Title: ${title}\n` +
                       `Type: ${type}\n` +
                       `URL: ${link}${tagsText}\n\n` +
                       `✅ Added to your Cosmic Mind library!`;
        
        await telegramBot.bot.sendMessage(telegramChatId, message);
        console.log('📤 Notification sent to Telegram');
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
        // Don't fail the API call if Telegram notification fails
      }
    }

    res.json({
      success: true,
      message: 'Content saved successfully',
      content: {
        id: content._id,
        title: content.title,
        link: content.link,
        type: content.type,
        tags: content.tags,
        userId: content.userId,
        createdAt: content.createdAt
      }
    });

  } catch (error: any) {
    console.error('Telegram content error:', error);
    
    // Handle duplicate content
    if (error.code === 11000 || error.message.includes('duplicate')) {
      return res.status(409).json({ 
        success: false, 
        message: 'This content already exists in your library' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: `Failed to save content: ${error.message}` 
    });
  }
});

// Get user's content for Telegram
app.post('/api/v1/telegram/content/list', async (req, res) => {
  try {
    const { telegramChatId, limit = 10 } = req.body;

    if (!telegramChatId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Telegram chat ID is required' 
      });
    }

    // Find user by Telegram chat ID
    const user = await User.findOne({ telegramChatId });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Telegram account not linked' 
      });
    }

    // Get user's content
    const content = await Content.find({ userId: user._id.toString() })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('title link type tags createdAt');

    res.json({
      success: true,
      content: content,
      count: content.length,
      username: user.username
    });

  } catch (error) {
    console.error('Telegram content list error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch content' 
    });
  }
});

// Get user's content for Telegram
app.post('/api/v1/telegram/content/list', async (req, res) => {
  try {
    const { telegramChatId, limit = 10 } = req.body;

    if (!telegramChatId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Telegram chat ID is required' 
      });
    }

    // Find user by Telegram chat ID
    const user = await User.findOne({ telegramChatId });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Telegram account not linked' 
      });
    }

    // Get user's content
    const content = await Content.find({ userId: user._id.toString() })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('title link type tags createdAt');

    res.json({
      success: true,
      content: content,
      count: content.length,
      username: user.username
    });

  } catch (error) {
    console.error('Telegram content list error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch content' 
    });
  }
});


function scheduleReminder(reminder: any) {
  try {
    // Convert stored UTC time to India time (IST = UTC+5:30)
    const reminderTimeUTC = new Date(reminder.reminderTime);
    
    // IMPORTANT: MongoDB stores in UTC, but we want to schedule in IST
    // Add 5 hours 30 minutes to convert UTC to IST
    const reminderTimeIST = new Date(reminderTimeUTC.getTime() + (5.5 * 60 * 60 * 1000));
    
    const now = new Date();
    
    console.log(`⏰ Scheduling: "${reminder.title}"`);
    console.log(`   UTC Time: ${reminderTimeUTC.toISOString()}`);
    console.log(`   IST Time: ${reminderTimeIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   Current Time: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   Repeat: ${reminder.repeat}`);
    console.log(`   Time difference: ${Math.round((reminderTimeIST.getTime() - now.getTime()) / 1000)} seconds`);
    
    // If time is in the past for "once" reminders, skip
    if (reminderTimeIST <= now && reminder.repeat === 'once') {
      console.log(`⚠️ Skipping one-time reminder in the past`);
      return;
    }
    
    // Handle repeating reminders
    let rule: schedule.RecurrenceRule | Date;
    
    if (reminder.repeat === 'once') {
      // One-time reminder
      rule = reminderTimeIST;
    } else {
      // Create recurrence rule based on repeat setting
      rule = new schedule.RecurrenceRule();
      
      // Extract time components from the reminder time
      rule.hour = reminderTimeIST.getHours();
      rule.minute = reminderTimeIST.getMinutes();
      rule.second = reminderTimeIST.getSeconds();
      rule.tz = 'Asia/Kolkata'; // Set timezone to IST
      
      switch (reminder.repeat) {
        case 'daily':
          // Daily at the same time
          break;
          
        case 'weekly':
          // Weekly on the same day
          rule.dayOfWeek = reminderTimeIST.getDay();
          break;
          
        case 'monthly':
          // Monthly on the same date
          rule.date = reminderTimeIST.getDate();
          break;
          
        default:
          // Default to one-time
          rule = reminderTimeIST;
      }
    }
    
    // Schedule the job
    const job = schedule.scheduleJob(`reminder_${reminder._id}`, rule, async function() {
      console.log(`🔔 REMINDER EXECUTING: ${reminder.title} (${reminder.repeat})`);
      
      if (telegramBot && telegramBot.bot) {
        try {
          const currentIST = new Date().toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            hour12: true 
          });
          
          const message = `🔔 **Reminder:** ${reminder.title}\n` +
                         `${reminder.description || ''}\n\n` +
                         `⏰ Time: ${currentIST} (IST)\n` +
                         `🔄 Repeat: ${reminder.repeat}`;
          
          // Send to the chat ID from the reminder
          const chatId = reminder.telegramChatId || '7377850240';
          await telegramBot.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          console.log(`✅ Reminder sent to Telegram (${chatId}): ${reminder.title}`);
          
          // If it's a one-time reminder, mark as inactive after sending
          if (reminder.repeat === 'once') {
            await Reminder.findByIdAndUpdate(reminder._id, { isActive: false });
            console.log(`📝 One-time reminder marked as inactive`);
          }
          
        } catch (error: any) {
          console.error(`❌ Telegram error:`, error.message);
          
          // Try again after 5 seconds
          setTimeout(async () => {
            try {
              await telegramBot!.bot!.sendMessage('7377850240', 
                `🔄 Retry: ${reminder.title}\n${error.message.substring(0, 100)}`,
                { parse_mode: 'Markdown' }
              );
            } catch (retryError) {
              console.error('❌ Retry also failed');
            }
          }, 5000);
        }
      } else {
        console.log('❌ Telegram bot not available');
      }
    });
    
    if (job) {
      console.log(`✅ Successfully scheduled "${reminder.title}" for ${reminder.repeat} at ${reminderTimeIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
      
      // Store job reference for cancellation if needed
      reminderScheduledJobs[reminder._id.toString()] = job;
    } else {
      console.error(`❌ FAILED to schedule: "${reminder.title}"`);
    }
    
  } catch (error) {
    console.error(`❌ Error scheduling reminder "${reminder.title}":`, error);
  }
}

// 🏥 HEALTH CHECK
app.get('/api/v1/health', async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check Groq status
    const groqStatus = GROQ_API_KEY && GROQ_API_KEY !== '' ? 'configured' : 'not_configured';

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        mongodb: mongoStatus,
        groq: groqStatus,
        qdrant: 'disabled' // Qdrant disabled for now
      },
      instructions: groqStatus === 'not_configured' 
        ? 'Get FREE Groq API key from: https://console.groq.com'
        : 'All services configured'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Cosmic Mind backend running on port ${PORT}`);
});

// Export for testing
export default app;


