// // // // // // // // import express from 'express'
// // // // // // // // import dotenv from 'dotenv'
// // // // // // // // import { signupSchena } from './types/types.js'
// // // // // // // // dotenv.config()

// // // // // // // // const app = express()

// // // // // // // // app.use(express.json)

// // // // // // // // app.post('/api/v1/auth/signup', async (req,res)=>{
// // // // // // // //     const {data,success} = signupSchena.safeParse(req.body)
// // // // // // // // })
// // // // // // // // app.post('/api/v1/auth/signin', async (req,res)=>{})

// // // // // // // // app.post('/api/v1/content', async (req,res)=>{})
// // // // // // // // app.get('/api/v1/content', async (req,res)=>{})
// // // // // // // // app.delete('/api/v1/content/delete/:id', async (req,res)=>{})
// // // // // // // // app.post('/api/v1/brain/share', async (req,res)=>{})

// // // // // // // // app.listen(3000)




import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import  os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from 'crypto';
import dotenv from 'dotenv';
import Groq from 'groq-sdk'; // Changed from GoogleGenerativeAI to Groq

dotenv.config();

// Environment variables - REMOVED Gemini, ADDED Groq
const JWT_SECRET = process.env.JWT_SECRET || 'cosmic-mind-secret-key';
const PORT = process.env.PORT || 3001;
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''; // Changed from GEMINI_API_KEY
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI!;

// Validate required environment variables
if (!GROQ_API_KEY) {
  console.error('⚠️  GROQ_API_KEY is required. Get FREE key from: https://console.groq.com');
  console.log('ℹ️  Running in demo mode without AI functionality');
}

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ============ MONGODB SCHEMAS ============

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Content Schema
const contentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String, required: true },
  type: { type: String, enum: ['youtube', 'twitter', 'pdf'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const Content = mongoose.model('Content', contentSchema);

// PDF Collection Schema
const pdfCollectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  originalName: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadDate: { type: Date, default: Date.now },
  chunks: { type: Number, required: true },
  vectorCollectionName: { type: String, required: true }
});

const PDFCollection = mongoose.model('PDFCollection', pdfCollectionSchema);

// Share Link Schema
const shareLinkSchema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const ShareLink = mongoose.model('ShareLink', shareLinkSchema);

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
      'llama-3.1-70b-versatile',    // Latest Llama 3.1 70B
      'llama-3.1-8b-instant',       // Fast 8B model
      'mixtral-8x7b-32768',         // Mixtral
      'gemma2-9b-it'                // Gemma 2
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

const getEmbedding = async (text: string): Promise<number[]> => {
  // Simple TF-IDF like embedding (768 dimensions)
  const words = text.toLowerCase().split(/\W+/);
  const uniqueWords = [...new Set(words)];
  const embedding = new Array(768).fill(0);
  
  uniqueWords.forEach((word, index) => {
    const pos = index % 768;
    embedding[pos] = Math.min(embedding[pos] + 0.1, 1);
  });
  
  return embedding;
};



// ============ MIDDLEWARE ============
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token!);

  if (!decoded) {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  req.userId = decoded.userId;
  req.username = decoded.username;
  next();
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
app.use(cors());
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
    const user = await User.findById(req.userId).select('-password');
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

// Error Handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Cosmic Mind backend running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`🗄️  MongoDB: ${MONGODB_URI}`);
  console.log(`🤖 AI Provider: Groq Cloud ${GROQ_API_KEY ? '✅' : '❌ (Get FREE key: https://console.groq.com)'}`);
  console.log(`🔑 API Key Status: ${GROQ_API_KEY ? 'Configured' : 'Not Configured'}`);
});

// Export for testing
export default app;