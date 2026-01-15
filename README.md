🧠 SecondBrain

SecondBrain is a full-stack knowledge management system that helps users capture, organize, search, and recall information using AI, vector search, and automation.

It acts as a personal memory layer for the internet — saving YouTube videos, Tweets/X posts, PDFs, and reminders, and enabling AI-powered search and chat over your own content.
<img width="1901" height="1020" alt="Screenshot 2026-01-15 200820" src="https://github.com/user-attachments/assets/2cf2ae41-a6dc-4554-9523-a2d63602519c" />


✨ Key Features
🔐 Authentication & Security

JWT-based authentication (signup / signin)

Secure password hashing with bcrypt

Protected routes using middleware

Token-based Telegram account linking

📚 Content Management
![Uploading Screenshot 2026-01-15 201204.png…]()

Save:

🎥 YouTube links

🐦 Twitter/X posts

📄 Uploaded PDFs

Tag content for better organization

Fetch, list, and delete saved content

Share your knowledge base publicly via secure links

📄 PDF Intelligence (RAG System)

Upload PDFs (up to 10MB)

Automatic document parsing & chunking

Vector embeddings generated per chunk

Stored in Qdrant Cloud vector database

Ask questions directly to your PDFs using AI

Answers are generated only from document context (true RAG)

🤖 AI Assistant (Groq Cloud)

Chat with your saved knowledge

Context-aware responses using:

Your saved links

Your uploaded PDFs

Multi-model fallback strategy:

LLaMA 3.1 (70B & 8B)

Mixtral

Gemma

Graceful degradation if AI service is unavailable

⏰ Smart Reminders

Create reminders with:

One-time

Daily / Weekly / Monthly repeats

Fully automated scheduling using node-schedule

Telegram notifications at the exact reminder time

Enable / disable reminders anytime

📲 Telegram Bot Integration

Full Telegram bot support

Link Telegram account to web account securely

Save content directly from Telegram

Manage reminders via Telegram

Receive real-time notifications

Works even when web app is closed

🔗 Knowledge Sharing

Generate public share links for your SecondBrain

Anyone can view:

Public content

PDF collections metadata

Links can be revoked anytime

🩺 Health Monitoring

/health endpoint for service checks

Reports status of:

MongoDB

Groq AI

Vector services

Useful for production readiness

🧩 Tech Stack
Backend

Node.js + Express

TypeScript

MongoDB + Mongoose

JWT Authentication

Groq AI SDK

LangChain

Qdrant Cloud (Vector DB)

Multer (PDF Uploads)

node-schedule

Telegram Bot API

Frontend

React

TypeScript

Tailwind CSS

Clean, responsive UI with strong UX focus



🔑 Environment Variables

Create a .env file:

PORT=3001
JWT_SECRET=your_jwt_secret

MONGODB_URI=your_mongodb_uri

GROQ_API_KEY=your_groq_api_key

QDRANT_URL=https://your-qdrant-cloud-url
QDRANT_API_KEY=your_qdrant_api_key

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_IDS=comma_separated_chat_ids

🚀 Getting Started
# Install dependencies
npm install

# Run in development
npm run dev


Backend runs on:

http://localhost:3001

📌 Why This Project Matters

This is not just CRUD.

SecondBrain demonstrates:

Real-world authentication

AI + Vector Search (RAG)

Background job scheduling

External service orchestration

Telegram bot automation

Scalable backend architecture

This is the kind of project senior engineers build, not tutorials.

🧠 Future Enhancements

Proper embedding model (OpenAI / Groq embeddings)

Semantic search across all content

Frontend PDF reader with highlights

Team / shared brains

Usage analytics

👤 Author

Built by Shiva
Full-stack developer focused on scalable backends, AI systems, and clean architecture.
