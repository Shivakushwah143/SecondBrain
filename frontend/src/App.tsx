
import React, { useState, useEffect, useLayoutEffect, createContext, useContext, useRef } from 'react';
import axios from 'axios';
import { SignIn, SignUp, useAuth, useUser } from '@clerk/clerk-react';
import {
  FiLogOut,
  FiFileText, FiPlus, FiTrash2, FiShare2, FiCopy, FiLink,
  FiSearch, FiMessageSquare, FiUpload, FiFolder,
  FiChevronRight,
  FiExternalLink, FiCalendar,
  FiBookmark, FiGrid, FiList, FiDatabase, FiCpu, FiZap,
  FiHome, FiBell, FiCheck, FiX, FiClock,
  FiTrendingUp, FiTarget,
  FiMenu, FiX as FiXIcon,
  FiZap as  
  FiAirplay
} from 'react-icons/fi';
import {
  SiYoutube, SiAdobeacrobatreader,
  SiMongodb,
  SiReact, SiExpress,SiTypescript,
  SiX,
  SiAib,
  SiAiohttp,
  SiTelegram  // Add this import
} from 'react-icons/si';

// ============ TYPES ============
interface User {
  id: string;
  username: string;
  createdAt?: string;
  telegramChatId?: string;
  telegramUsername?: string;
}

interface Reminder {
  _id: string;
  title: string;
  description?: string;
  reminderTime: string;
  repeat: 'once' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  telegramChatId?: string;
  userId: string;
}

interface Content {
  _id: string;
  title: string;
  link: string;
  type: 'youtube' | 'twitter' | 'pdf';
  userId: string;
  tags: string[];
  createdAt: string;
}

interface PDFCollection {
  _id: string;
  name: string;
  originalName: string;
  uploadDate: string;
  chunks: number;
  vectorCollectionName: string;
}

interface Stats {
  totalContent: number;
  totalPDFs: number;
  totalCollections: number;
  recentActivity: number;
  activeReminders: number; // Add this
}

interface TelegramBotStatus {
  isActive: boolean;
}

type DashboardTab = 'dashboard' | 'content' | 'pdf' | 'ai' | 'reminders' | 'telegram' | 'share';

type ReminderRepeat = Reminder['repeat'];

interface NewReminder {
  title: string;
  description: string;
  reminderTime: string;
  repeat: ReminderRepeat;
  telegramChatId: string;
}

// ============ CONTEXT ============
interface AuthContextType {
  user: User | null;
  logout: () => Promise<void>;
  updateTelegramInfo: (chatId: string, username: string) => void; // Add this
  legacySignIn: (usernameOrEmail: string, password: string) => Promise<void>;
  legacySignUp: (usernameOrEmail: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ============ AXIOS CONFIG ============
const API_BASE_URL = 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
});

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const maybeMessage = (error.response?.data as { message?: string } | undefined)?.message;
    return maybeMessage || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

// ============ UTILITY FUNCTIONS ============
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};


// ============ MODAL COMPONENTS ============

// Reminder Modal Component
interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  newReminder: NewReminder;
  setNewReminder: (reminder: NewReminder) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen, onClose, newReminder, setNewReminder, onSubmit
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Set New Reminder</h2>
            <p className="text-sm text-gray-600">Create reminders for important content</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={newReminder.title}
              onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="Reminder title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={newReminder.description}
              onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
              rows={3}
              placeholder="Additional details about the reminder"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                value={newReminder.reminderTime}
                onChange={(e) => setNewReminder({ ...newReminder, reminderTime: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repeat
              </label>
              <select
                value={newReminder.repeat}
                onChange={(e) => setNewReminder({ ...newReminder, repeat: e.target.value as ReminderRepeat })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telegram Chat ID (Optional)
            </label>
            <input
              type="text"
              value={newReminder.telegramChatId}
              onChange={(e) => setNewReminder({ ...newReminder, telegramChatId: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="For Telegram notifications"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your Telegram chat ID to get notifications on Telegram
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl border border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newReminder.title || !newReminder.reminderTime}
              className="px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Telegram Link Modal Component
interface TelegramLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramToken: string;
  setTelegramToken: (token: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  user?: User | null;
}

const TelegramLinkModal: React.FC<TelegramLinkModalProps> = ({
  isOpen, onClose, telegramToken, setTelegramToken, onSubmit
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Link Telegram Account</h2>
            <p className="text-sm text-gray-600">Connect your Telegram to save content</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <SiTelegram className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Telegram Bot</h3>
              <p className="text-sm text-gray-600">@SecondBrainBot</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Authentication Token *
            </label>
            <input
              type="text"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="Enter your authentication token"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your token from the web app → Profile section
            </p>
          </div>

          <div className="bg-linear-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
            <h4 className="font-medium text-gray-900 mb-2">How to get your token:</h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Go to your Second Brain profile</li>
              <li>Copy your authentication token</li>
              <li>Paste it here and link your account</li>
              <li>Start using the Telegram bot</li>
            </ol>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl border border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!telegramToken.trim()}
              className="px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Link Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============ COMPONENTS ============

// 1. Auth Component (Clerk + Legacy)
const AuthForm: React.FC = () => {
  const auth = useContext(AuthContext);
  const [authMethod, setAuthMethod] = useState<'clerk' | 'legacy'>('clerk');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyError, setLegacyError] = useState('');

  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLegacyError('');
    setLegacyLoading(true);
    try {
      if (mode === 'signIn') {
        await auth.legacySignIn(usernameOrEmail, password);
      } else {
        await auth.legacySignUp(usernameOrEmail, password);
      }
    } catch (error: unknown) {
      setLegacyError(getErrorMessage(error, 'Authentication failed'));
    } finally {
      setLegacyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

        {/* Left Column - Brand & Features */}
        <div className="space-y-8">
          {/* Brand */}
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-linear-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
              <FiDatabase className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Second Brain
              </h1>
              <p className="text-gray-600">Your Intelligent Knowledge Base</p>
            </div>
          </div>

          {/* Hero Text */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-gray-900">
              Organize, Discover, and Grow Your Knowledge
            </h2>
            <p className="text-lg text-gray-600">
              A powerful AI-powered platform to save, organize, and interact with all your knowledge in one place.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: FiCpu, title: 'AI-Powered Search', desc: 'Chat with your documents using advanced AI' },
              { icon: FiFileText, title: 'PDF Intelligence', desc: 'Upload and analyze PDFs with vector search' },
              { icon: FiShare2, title: 'Smart Sharing', desc: 'Share your knowledge with secure links' },
              { icon: FiTrendingUp, title: 'Knowledge Analytics', desc: 'Track your learning and growth' },
            ].map((feature, idx) => (
              <div key={idx} className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-linear-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tech Stack */}
          <div className="pt-8">
            <p className="text-sm text-gray-500 mb-3">Powered by cutting-edge technology</p>
            <div className="flex items-center space-x-4">
              <SiReact className="w-8 h-8 text-[#61DAFB]" title="React" />
              <SiTypescript className="w-8 h-8 text-[#3178C6]" title="TypeScript" />
              <SiExpress className="w-8 h-8 text-gray-800" title="Express" />
              <SiMongodb className="w-8 h-8 text-[#47A248]" title="MongoDB" />
              <FiAirplay className="w-8 h-8 text-[#00A67E]" title="Groq AI" />
              <SiMongodb className="w-8 h-8 text-[#4F46E5]" title="Qdrant" />
            </div>
          </div>
        </div>

        {/* Right Column - Auth Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => setAuthMethod('clerk')}
              className={`px-4 py-2 rounded-xl border transition-colors ${authMethod === 'clerk'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('legacy')}
              className={`px-4 py-2 rounded-xl border transition-colors ${authMethod === 'legacy'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
            >
              Email & Password
            </button>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'signIn' ? 'Welcome Back 👋' : 'Join Second Brain 🚀'}
            </h2>
            <p className="text-gray-600 mt-2">
              {mode === 'signIn' ? 'Sign in to access your knowledge base' : 'Create your account to get started'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => setMode('signIn')}
              className={`px-4 py-2 rounded-xl border transition-colors ${mode === 'signIn'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signUp')}
              className={`px-4 py-2 rounded-xl border transition-colors ${mode === 'signUp'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
            >
              Sign Up
            </button>
          </div>

          <div className="flex justify-center">
            {authMethod === 'clerk' ? (
              mode === 'signIn' ? <SignIn /> : <SignUp />
            ) : (
              <form onSubmit={handleLegacySubmit} className="w-full max-w-sm space-y-4">
                {legacyError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-red-700 text-sm">{legacyError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email / Username
                  </label>
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-gray-400"
                    placeholder="you@example.com"
                    required
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-gray-400"
                    placeholder="••••••••"
                    required
                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={legacyLoading}
                  className="w-full py-3 px-4 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {legacyLoading ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. Dashboard Component
const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [content, setContent] = useState<Content[]>([]);
  const [collections, setCollections] = useState<PDFCollection[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalContent: 0,
    totalPDFs: 0,
    totalCollections: 0,
    recentActivity: 0,
    activeReminders: 0
  });
  const [newContent, setNewContent] = useState({
    title: '',
    link: '',
    type: '',
    tags: '',
    file: null as File | null
  });
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [pdfQuery, setPdfQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [pdfChatLoading, setPdfChatLoading] = useState(false);
  const [pdfChatResponse, setPdfChatResponse] = useState<{ response: string; relevantChunks: number; collectionName: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Telegram Reminders State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showTelegramLinkModal, setShowTelegramLinkModal] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramBotStatus, setTelegramBotStatus] = useState<TelegramBotStatus>({ isActive: false });
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    reminderTime: '',
    repeat: 'once' as ReminderRepeat,
    telegramChatId: ''
  } satisfies NewReminder);

  const auth = useContext(AuthContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
    checkTelegramBotStatus();
  }, []);

  const fetchData = async () => {
    try {
      const [contentRes, collectionsRes, remindersRes] = await Promise.all([
        api.get('/content'),
        api.get('/pdf/collections'),
        api.get('/reminders')
      ]);

      setContent(contentRes.data.content || []);
      setCollections(collectionsRes.data.collections || []);
      const activeReminders = remindersRes.data.activeReminders || [];
      setReminders(activeReminders);

      const pdfCount = contentRes.data.content?.filter((c: Content) => c.type === 'pdf').length || 0;

      setStats({
        totalContent: contentRes.data.count || 0,
        totalPDFs: pdfCount,
        totalCollections: collectionsRes.data.count || 0,
        recentActivity: contentRes.data.content?.slice(0, 5).length || 0,
        activeReminders: activeReminders.length
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkTelegramBotStatus = async () => {
    try {
      const response = await api.get('/api/v1/health');
      if (response.data.services?.telegram === 'active') {
        setTelegramBotStatus({ isActive: true });
      }
    } catch (error) {
      console.error('Failed to check Telegram bot status:', error);
    }
  };

  const handleAddContent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newContent.title || !newContent.type) {
      alert('Title and type are required');
      return;
    }

    try {
      if (newContent.type === 'pdf') {
        if (!newContent.file) {
          alert('Please select a PDF file');
          return;
        }

        setUploadingPDF(true);

        const formData = new FormData();
        formData.append('pdf', newContent.file);

        const uploadResponse = await api.post('/pdf/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Refresh collections
        const collectionsRes = await api.get('/pdf/collections');
        setCollections(collectionsRes.data.collections || []);

        // Add as content item
        const contentItem: Content = {
          _id: uploadResponse.data.data.contentId,
          title: newContent.title || uploadResponse.data.data.originalName,
          link: `/pdf/${uploadResponse.data.data.collectionId}`,
          type: 'pdf',
          userId: auth?.user?.id || '',
          tags: newContent.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
          createdAt: new Date().toISOString()
        };

        setContent(prev => [contentItem, ...prev]);
        setStats(prev => ({
          ...prev,
          totalPDFs: prev.totalPDFs + 1,
          totalCollections: prev.totalCollections + 1,
          totalContent: prev.totalContent + 1
        }));

      } else {
        if (!newContent.link) {
          alert('URL is required for YouTube and Twitter content');
          return;
        }

        const tags = newContent.tags.split(',').map(tag => tag.trim()).filter(tag => tag);

        const response = await api.post('/content', {
          title: newContent.title,
          link: newContent.link,
          type: newContent.type,
          tags
        });

        setContent(prev => [response.data.content, ...prev]);
        setStats(prev => ({
          ...prev,
          totalContent: prev.totalContent + 1,
          recentActivity: prev.recentActivity + 1
        }));
      }

      // Reset form
      setNewContent({
        title: '',
        link: '',
        type: '',
        tags: '',
        file: null
      });

    } catch (error: unknown) {
      console.error('Failed to add content:', error);
      alert(getErrorMessage(error, 'Failed to add content'));
    } finally {
      setUploadingPDF(false);
    }
  };

  const handleDeleteContent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return;

    try {
      await api.delete('/content', { data: { contentId: id } });
      setContent(prev => prev.filter(item => item._id !== id));
      setStats(prev => ({
        ...prev,
        totalContent: prev.totalContent - 1
      }));
    } catch (error) {
      console.error('Failed to delete content:', error);
    }
  };

  const handleAIChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiMessage.trim()) return;

    setAiLoading(true);
    try {
      const response = await api.post('/ai/chat', { message: aiMessage });
      setAiResponse(response.data.response);
    } catch (error) {
      console.error('AI chat failed:', error);
      setAiResponse('Sorry, I encountered an error. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handlePdfChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfQuery.trim() || !selectedCollection) return;

    setPdfChatLoading(true);
    try {
      const collection = collections.find(c => c._id === selectedCollection);
      if (!collection) throw new Error('Collection not found');

      const response = await api.post('/pdf/chat', {
        query: pdfQuery,
        collectionName: collection.name
      });

      setPdfChatResponse(response.data);
      setPdfQuery('');
    } catch (error) {
      console.error('PDF chat failed:', error);
      setPdfChatResponse({
        response: 'Sorry, I encountered an error. Please try again.',
        relevantChunks: 0,
        collectionName: ''
      });
    } finally {
      setPdfChatLoading(false);
    }
  };

  const handleShareToggle = async () => {
    try {
      const response = await api.post('/brain/share', { share: !isSharing });
      setIsSharing(!isSharing);
      if (!isSharing && response.data.hash) {
        setShareLink(response.data.url);
      }
    } catch (error) {
      console.error('Share toggle failed:', error);
    }
  };

  // Telegram Reminders Functions
  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newReminder.title || !newReminder.reminderTime) {
      alert('Title and reminder time are required');
      return;
    }

    try {
      const reminderTime = new Date(newReminder.reminderTime).toISOString();
      const response = await api.post('/reminders', {
        ...newReminder,
        reminderTime
      });

      setReminders(prev => [response.data.reminder, ...prev]);
      setStats(prev => ({
        ...prev,
        activeReminders: prev.activeReminders + 1
      }));

      setNewReminder({
        title: '',
        description: '',
        reminderTime: '',
        repeat: 'once',
        telegramChatId: ''
      });
      setShowReminderModal(false);

    } catch (error: unknown) {
      console.error('Failed to create reminder:', error);
      alert(getErrorMessage(error, 'Failed to create reminder'));
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await api.delete(`/reminders/${id}`);
      setReminders(prev => prev.filter(r => r._id !== id));
      setStats(prev => ({
        ...prev,
        activeReminders: prev.activeReminders - 1
      }));
    } catch (error) {
      console.error('Failed to delete reminder:', error);
    }
  };

  const handleToggleReminder = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/reminders/${id}/toggle`);
      setReminders(prev =>
        prev.map(r =>
          r._id === id ? { ...r, isActive: !isActive } : r
        )
      );
      setStats(prev => ({
        ...prev,
        activeReminders: isActive ? prev.activeReminders - 1 : prev.activeReminders + 1
      }));
    } catch (error) {
      console.error('Failed to toggle reminder:', error);
    }
  };

  const handleLinkTelegram = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!telegramToken) {
      alert('Please enter your token');
      return;
    }

    try {
      const response = await api.post('/telegram/link', {
        telegramChatId: 'YOUR_TELEGRAM_CHAT_ID',
        telegramUsername: auth?.user?.username,
        token: telegramToken
      });

      if (auth) {
        auth.updateTelegramInfo(response.data.telegramChatId, response.data.telegramUsername);
      }

      setTelegramToken('');
      setShowTelegramLinkModal(false);
    } catch (error: unknown) {
      console.error('Failed to link Telegram:', error);
      alert(getErrorMessage(error, 'Failed to link Telegram'));
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'youtube': return <SiYoutube className="w-5 h-5 text-red-600" />;
      case 'twitter': return <SiX className="w-5 h-5 text-sky-500" />;
      case 'pdf': return <SiAdobeacrobatreader className="w-5 h-5 text-red-700" />;
      default: return <FiFileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const filteredContent = content.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCollections = collections.filter(collection =>
    collection.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReminders = reminders.filter(reminder =>
    reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (reminder.description && reminder.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-gray-700 font-medium text-lg">Loading your knowledge base...</p>
          <p className="text-gray-500 mt-2">Preparing your personalized dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <FiDatabase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Second Brain
                </h1>
                <p className="text-xs text-gray-500">Intelligent Knowledge Base</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: FiHome },
                { id: 'content', label: 'Content', icon: FiBookmark },
                { id: 'pdf', label: 'PDFs', icon: FiFolder },
                { id: 'ai', label: 'AI Chat', icon: FiMessageSquare },
                { id: 'reminders', label: 'Reminders', icon: FiBell },
                { id: 'telegram', label: 'Telegram', icon: SiTelegram },
                { id: 'share', label: 'Share', icon: FiShare2 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as DashboardTab)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center space-x-2 ${activeTab === tab.id
                      ? 'bg-linear-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Right Side Controls */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48"
                />
                <FiSearch className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>

              <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                <FiBell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-linear-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {auth?.user?.username?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={() => auth?.logout()}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900"
              >
                {mobileMenuOpen ? <FiXIcon className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="flex flex-col space-y-2">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: FiHome },
                  { id: 'content', label: 'Content', icon: FiBookmark },
                  { id: 'pdf', label: 'PDFs', icon: FiFolder },
                  { id: 'ai', label: 'AI Chat', icon: FiMessageSquare },
                  { id: 'reminders', label: 'Reminders', icon: FiBell },
                  { id: 'telegram', label: 'Telegram', icon: SiTelegram },
                  { id: 'share', label: 'Share', icon: FiShare2 }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as DashboardTab);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-lg font-medium text-sm transition-all flex items-center space-x-3 ${activeTab === tab.id
                        ? 'bg-linear-to-r from-indigo-50 to-purple-50 text-indigo-700'
                        : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-6 mb-8 text-white relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome back, {auth?.user?.username}! 👋</h2>
              <p className="text-indigo-100 opacity-90">Manage your knowledge with AI-powered intelligence</p>
            </div>
            <div className="hidden md:block">
              <div className="flex items-center space-x-2">
                <FiTarget className="w-12 h-12 opacity-20" />
                <div className="text-right">
                  <p className="text-sm opacity-90">Knowledge Score</p>
                  <p className="text-2xl font-bold">{stats.totalContent * 10}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {[
            {
              label: 'Total Content',
              value: stats.totalContent,
              icon: FiBookmark,
              color: 'from-blue-500 to-cyan-500',
              change: '+12%'
            },
            {
              label: 'PDF Collections',
              value: stats.totalCollections,
              icon: FiFolder,
              color: 'from-emerald-500 to-teal-500',
              change: '+8%'
            },
            {
              label: 'PDF Files',
              value: stats.totalPDFs,
              icon: FiFileText,
              color: 'from-purple-500 to-pink-500',
              change: '+5%'
            },
            {
              label: 'Active Reminders',
              value: stats.activeReminders,
              icon: FiBell,
              color: 'from-amber-500 to-orange-500',
              change: '+24%'
            },
            {
              label: 'Recent Activity',
              value: stats.recentActivity,
              icon: FiTrendingUp,
              color: 'from-yellow-500 to-amber-500',
              change: '+18%'
            }
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className="text-xs text-emerald-600 mt-1 flex items-center">
                    <FiTrendingUp className="w-3 h-3 mr-1" />
                    {stat.change} from last month
                  </p>
                </div>
                <div className={`w-14 h-14 bg-linear-to-br ${stat.color} rounded-2xl flex items-center justify-center`}>
                  <stat.icon className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Content & Forms (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Add Form */}
            {activeTab === 'content' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Add New Content</h2>
                  <div className="flex items-center space-x-2">
                    <FiPlus className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm text-gray-600">Quick Add</span>
                  </div>
                </div>

                <form onSubmit={handleAddContent} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={newContent.title}
                        onChange={(e) => setNewContent(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Enter content title"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {newContent.type === 'pdf' ? 'Upload PDF' : 'URL'}
                      </label>

                      {newContent.type === 'pdf' ? (
                        <div className="relative">
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setNewContent(prev => ({
                                  ...prev,
                                  link: file.name,
                                  file: file,
                                  title: prev.title || file.name.replace(/\.[^/.]+$/, "")
                                }));
                              }
                            }}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            required={newContent.type === 'pdf'}
                            id="pdf-upload"
                          />
                        </div>
                      ) : (
                        <input
                          type="url"
                          value={newContent.link}
                          onChange={(e) => setNewContent(prev => ({ ...prev, link: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                          placeholder="https://"
                          required={newContent.type !== 'pdf'}
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type
                      </label>
                      <select
                        value={newContent.type}
                        onChange={(e) => {
                          setNewContent(prev => ({
                            ...prev,
                            type: e.target.value,
                            link: '',
                            file: null
                          }));
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Type</option>
                        <option value="youtube">YouTube</option>
                        <option value="twitter">Twitter</option>
                        <option value="pdf">PDF Document</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tags
                      </label>
                      <input
                        type="text"
                        value={newContent.tags}
                        onChange={(e) => setNewContent(prev => ({ ...prev, tags: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="tag1, tag2, tag3"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={uploadingPDF}
                        className="w-full px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center shadow-md hover:shadow-lg"
                      >
                        {uploadingPDF ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <FiPlus className="w-5 h-5 mr-2" />
                            {newContent.type === 'pdf' ? 'Upload PDF' : 'Add Content'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {newContent.type === 'pdf' && newContent.file && (
                    <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <p className="text-sm text-emerald-700 flex items-center">
                        <FiCheck className="w-4 h-4 mr-2" />
                        Selected PDF: {newContent.file.name} ({(newContent.file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* PDF Chat Interface */}
            {activeTab === 'pdf' && collections.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Chat with PDF</h2>
                  <FiMessageSquare className="w-5 h-5 text-indigo-500" />
                </div>

                {/* Collection Selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select PDF Document
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {collections.map((collection) => (
                      <button
                        key={collection._id}
                        onClick={() => setSelectedCollection(collection._id)}
                        className={`p-4 rounded-xl border transition-all flex items-center space-x-3 ${selectedCollection === collection._id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <div className="w-10 h-10 bg-linear-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center">
                          <SiAdobeacrobatreader className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {collection.originalName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {collection.chunks} chunks • {formatDate(collection.uploadDate)}
                          </p>
                        </div>
                        {selectedCollection === collection._id && (
                          <FiCheck className="w-5 h-5 text-indigo-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PDF Chat Form */}
                {selectedCollection && (
                  <div className="space-y-4">
                    {pdfChatResponse && (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            Response from: {pdfChatResponse.collectionName}
                          </p>
                          <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                            {pdfChatResponse.relevantChunks} relevant chunks
                          </span>
                        </div>
                        <p className="text-gray-700">{pdfChatResponse.response}</p>
                        <button
                          onClick={() => setPdfChatResponse(null)}
                          className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Ask another question →
                        </button>
                      </div>
                    )}

                    <form onSubmit={handlePdfChat} className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={pdfQuery}
                          onChange={(e) => setPdfQuery(e.target.value)}
                          placeholder="Ask a question about this PDF..."
                          className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                          disabled={pdfChatLoading}
                        />
                        <button
                          type="submit"
                          disabled={pdfChatLoading || !pdfQuery.trim()}
                          className="absolute right-2 top-2 p-2 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {pdfChatLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FiMessageSquare className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        Ask questions about the content of your PDF document
                      </p>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* AI Chat Interface */}
            {activeTab === 'ai' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
                    <p className="text-sm text-gray-600">Powered by Groq AI</p>
                  </div>
                  <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <FiCpu className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="space-y-4">
                  {aiResponse ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-gray-700">{aiResponse}</p>
                      </div>
                      <button
                        onClick={() => setAiResponse('')}
                        className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Ask another question →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-linear-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-linear-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FiZap className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-700">
                              Hi! I'm your AI assistant. Ask me anything about your saved content, or upload PDFs for document analysis.
                            </p>
                          </div>
                        </div>
                      </div>

                      <form onSubmit={handleAIChat} className="space-y-3">
                        <div className="relative">
                          <input
                            type="text"
                            value={aiMessage}
                            onChange={(e) => setAiMessage(e.target.value)}
                            placeholder="Ask a question..."
                            className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                            disabled={aiLoading}
                          />
                          <button
                            type="submit"
                            disabled={aiLoading || !aiMessage.trim()}
                            className="absolute right-2 top-2 p-2 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {aiLoading ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <FiMessageSquare className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                          Ask about your content, documents, or general knowledge
                        </p>
                      </form>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Reminders Interface */}
            {activeTab === 'reminders' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Reminders</h2>
                  <button
                    onClick={() => setShowReminderModal(true)}
                    className="px-4 py-2 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center space-x-2"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>New Reminder</span>
                  </button>
                </div>

                {filteredReminders.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                    <div className="w-16 h-16 bg-linear-to-br from-indigo-50 to-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <FiBell className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No reminders yet</h3>
                    <p className="text-gray-600 mb-6">Set reminders for important content and tasks</p>
                    <button
                      onClick={() => setShowReminderModal(true)}
                      className="px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all"
                    >
                      Create Your First Reminder
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredReminders.map((reminder) => (
                      <div
                        key={reminder._id}
                        className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-3 rounded-xl ${reminder.isActive
                                ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}>
                              <FiBell className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{reminder.title}</h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`text-xs px-2 py-1 rounded-full ${reminder.isActive
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-gray-100 text-gray-700'
                                  }`}>
                                  {reminder.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {reminder.repeat}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleReminder(reminder._id, reminder.isActive)}
                              className={`p-2 rounded-lg ${reminder.isActive ? 'hover:bg-red-100' : 'hover:bg-emerald-100'}`}
                              title={reminder.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {reminder.isActive ? (
                                <FiBell className="w-4 h-4 text-red-500" />
                              ) : (
                                <FiBell className="w-4 h-4 text-emerald-500" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteReminder(reminder._id)}
                              className="p-2 hover:bg-red-100 rounded-lg"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>

                        {reminder.description && (
                          <p className="text-gray-600 text-sm mb-4">
                            {reminder.description}
                          </p>
                        )}

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between text-gray-700">
                            <span className="flex items-center space-x-2">
                              <FiClock className="w-4 h-4 text-indigo-500" />
                              <span>Time:</span>
                            </span>
                            <span className="font-medium">{formatTime(reminder.reminderTime)}</span>
                          </div>
                          <div className="flex items-center justify-between text-gray-700">
                            <span className="flex items-center space-x-2">
                              <FiCalendar className="w-4 h-4 text-indigo-500" />
                              <span>Date:</span>
                            </span>
                            <span className="font-medium">{formatDate(reminder.reminderTime)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Telegram Interface */}
            {activeTab === 'telegram' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Telegram Bot</h2>
                    <p className="text-sm text-gray-600">Save content directly from Telegram</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${telegramBotStatus.isActive
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                    {telegramBotStatus.isActive ? 'Bot Active' : 'Bot Offline'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-linear-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                        <SiTelegram className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Link Your Account</h3>
                        <p className="text-sm text-gray-600">Connect Telegram to save content</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTelegramLinkModal(true)}
                      className="w-full py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all"
                    >
                      Link Telegram Account
                    </button>
                  </div>

                  <div className="bg-linear-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                        <FiMessageSquare className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Bot Commands</h3>
                        <p className="text-sm text-gray-600">Available commands</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <code className="block text-sm bg-white/50 px-3 py-2 rounded-lg font-mono">
                        /start - Start the bot
                      </code>
                      <code className="block text-sm bg-white/50 px-3 py-2 rounded-lg font-mono">
                        /addcontent - Save content
                      </code>
                      <code className="block text-sm bg-white/50 px-3 py-2 rounded-lg font-mono">
                        /mycontent - View your content
                      </code>
                      <code className="block text-sm bg-white/50 px-3 py-2 rounded-lg font-mono">
                        /remind - Set a reminder
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content Display */}
            {(activeTab === 'dashboard' || activeTab === 'content') && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {activeTab === 'dashboard' ? 'Recent Content' : 'All Content'}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {filteredContent.length} items • {stats.totalContent} total
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      <FiGrid className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      <FiList className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {filteredContent.length === 0 ? (
                  <div className="py-12 text-center">
                    <FiBookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No content found. Start adding to build your knowledge base!</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                    {filteredContent.slice(0, 6).map((item) => (
                      <div
                        key={item._id}
                        className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              {getTypeIcon(item.type)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 line-clamp-1">{item.title}</h3>
                              <p className="text-xs text-gray-500">{item.type}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteContent(item._id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.link}</p>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {item.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatDate(item.createdAt)}</span>
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center"
                          >
                            <FiExternalLink className="w-3 h-3 mr-1" />
                            Open
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredContent.slice(0, 5).map((item) => (
                      <div key={item._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                              {getTypeIcon(item.type)}
                            </div>
                          </div>

                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start">
                              <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                                  {item.type}
                                </span>
                                <button
                                  onClick={() => handleDeleteContent(item._id)}
                                  className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                >
                                  <FiTrash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <p className="text-sm text-gray-600 mt-1 truncate">{item.link}</p>

                            <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center space-x-2">
                                {item.tags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg">
                                    {tag}
                                  </span>
                                ))}
                              </div>

                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span className="flex items-center">
                                  <FiCalendar className="w-3 h-3 mr-1.5" />
                                  {formatDate(item.createdAt)}
                                </span>
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                  <FiExternalLink className="w-3 h-3 mr-1.5" />
                                  Open
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredContent.length > 6 && (
                  <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button className="w-full text-center text-indigo-600 hover:text-indigo-700 font-medium">
                      View all {filteredContent.length} items →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PDF Collections Display */}
            {activeTab === 'pdf' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">PDF Collections</h2>
                  <p className="text-sm text-gray-600">Uploaded documents with AI-powered search</p>
                </div>

                {filteredCollections.length === 0 ? (
                  <div className="py-12 text-center">
                    <FiFolder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No PDF collections yet</p>
                    <p className="text-sm text-gray-500 mt-2">Upload your first PDF to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                    {filteredCollections.map((collection) => (
                      <div
                        key={collection._id}
                        className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all hover:-translate-y-1"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-linear-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center">
                              <SiAdobeacrobatreader className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 line-clamp-1">
                                {collection.originalName}
                              </h3>
                              <p className="text-xs text-gray-500">{collection.chunks} text chunks</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedCollection(collection._id)}
                            className="text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Chat with this PDF"
                          >
                            <FiMessageSquare className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Uploaded:</span>
                            <span>{formatDate(collection.uploadDate)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Vector Collection:</span>
                            <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {collection.name.substring(0, 15)}...
                            </code>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setSelectedCollection(collection._id)}
                            className="px-3 py-1.5 text-sm font-medium bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
                          >
                            Chat with AI
                          </button>
                          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                            Ready for AI
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Sidebar (1/3 width) */}
          <div className="space-y-8">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('content')}
                  className="p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center"
                >
                  <FiPlus className="w-5 h-5 text-indigo-600 mb-2" />
                  <span className="text-xs font-medium text-gray-700">Add Content</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center"
                >
                  <FiUpload className="w-5 h-5 text-indigo-600 mb-2" />
                  <span className="text-xs font-medium text-gray-700">Upload PDF</span>
                </button>

                <button
                  onClick={() => setActiveTab('reminders')}
                  className="p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center"
                >
                  <FiBell className="w-5 h-5 text-indigo-600 mb-2" />
                  <span className="text-xs font-medium text-gray-700">Reminders</span>
                </button>

                <button
                  onClick={() => setActiveTab('ai')}
                  className="p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center"
                >
                  <FiMessageSquare className="w-5 h-5 text-indigo-600 mb-2" />
                  <span className="text-xs font-medium text-gray-700">AI Chat</span>
                </button>
              </div>
            </div>

            {/* PDF Upload Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Upload PDF</h2>
                <FiUpload className="w-5 h-5 text-indigo-500" />
              </div>

              <div className="space-y-4">
                <div
                  className="border-3 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer bg-gray-50 hover:bg-indigo-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2 font-medium">Drag & drop PDF files here</p>
                  <p className="text-sm text-gray-500 mb-4">or click to browse from your computer</p>
                  <span className="inline-block px-6 py-2.5 bg-white text-gray-700 font-medium rounded-lg border-2 border-gray-300 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer transition-all">
                    Select File
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewContent(prev => ({
                          ...prev,
                          type: 'pdf',
                          link: file.name,
                          file: file,
                          title: prev.title || file.name.replace(/\.[^/.]+$/, "")
                        }));
                        setActiveTab('content');
                      }
                    }}
                    disabled={uploadingPDF}
                  />
                </div>

                {uploadingPDF && (
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-600">Processing PDF...</span>
                  </div>
                )}

                <div className="text-xs text-gray-500 space-y-1">
                  <p className="flex items-center">
                    <FiCheck className="w-3 h-3 mr-2 text-emerald-500" />
                    Supports PDF files up to 10MB
                  </p>
                  <p className="flex items-center">
                    <FiCheck className="w-3 h-3 mr-2 text-emerald-500" />
                    AI-powered text extraction and search
                  </p>
                  <p className="flex items-center">
                    <FiCheck className="w-3 h-3 mr-2 text-emerald-500" />
                    Secure cloud storage with Qdrant
                  </p>
                </div>
              </div>
            </div>

            {/* PDF Collections List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">PDF Collections</h2>
                <div className="flex items-center space-x-2">
                  <FiFolder className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-gray-700">{collections.length}</span>
                </div>
              </div>

              {collections.length === 0 ? (
                <div className="text-center py-6">
                  <FiFolder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No PDF collections yet</p>
                  <p className="text-sm text-gray-500 mt-2">Upload your first PDF to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collections.slice(0, 3).map((collection) => (
                    <div
                      key={collection._id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedCollection(collection._id);
                        setActiveTab('pdf');
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                          <FiFileText className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate max-w-[160px]">
                            {collection.originalName}
                          </p>
                          <div className="flex items-center space-x-3 mt-1">
                            <p className="text-xs text-gray-500">
                              {collection.chunks} chunks
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(collection.uploadDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all">
                        <FiChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  ))}

                  {collections.length > 3 && (
                    <button
                      onClick={() => setActiveTab('pdf')}
                      className="w-full text-center text-indigo-600 hover:text-indigo-700 font-medium text-sm pt-2"
                    >
                      View all {collections.length} collections →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tech Stack */}
            <div className="bg-linear-to-br from-gray-900 to-black rounded-2xl shadow-lg p-6 text-white">
              <h3 className="font-semibold mb-4">Powered By</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <SiReact className="w-8 h-8 mx-auto mb-2 text-[#61DAFB]" />
                  <p className="text-xs">React</p>
                </div>
                <div className="text-center">
                  <SiTypescript className="w-8 h-8 mx-auto mb-2 text-[#3178C6]" />
                  <p className="text-xs">TypeScript</p>
                </div>
                <div className="text-center">
                  <SiExpress className="w-8 h-8 mx-auto mb-2 text-white" />
                  <p className="text-xs">Express</p>
                </div>
                <div className="text-center">
                  <SiMongodb className="w-8 h-8 mx-auto mb-2 text-[#47A248]" />
                  <p className="text-xs">MongoDB</p>
                </div>
                <div className="text-center">
                  <SiAib className="w-8 h-8 mx-auto mb-2 text-[#00A67E]" />
                  <p className="text-xs">Groq AI</p>
                </div>
                <div className="text-center">
                  <SiAiohttp className="w-8 h-8 mx-auto mb-2 text-[#4F46E5]" />
                  <p className="text-xs">Qdrant</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareLink={shareLink}
          isSharing={isSharing}
          onToggleShare={handleShareToggle}
        />
      )}

      {/* Reminder Modal */}
      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        newReminder={newReminder}
        setNewReminder={setNewReminder}
        onSubmit={handleAddReminder}
      />

      {/* Telegram Link Modal */}
      <TelegramLinkModal
        isOpen={showTelegramLinkModal}
        onClose={() => setShowTelegramLinkModal(false)}
        telegramToken={telegramToken}
        setTelegramToken={setTelegramToken}
        onSubmit={handleLinkTelegram}
        user={auth?.user}
      />

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <FiDatabase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Second Brain</h3>
                  <p className="text-xs text-gray-500">Intelligent Knowledge Base</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Your AI-powered second brain for organizing, discovering, and growing knowledge.
              </p>
            </div>

            {['Product', 'Resources', 'Company', 'Connect'].map((category) => (
              <div key={category}>
                <h4 className="font-semibold text-gray-900 mb-4">{category}</h4>
                <ul className="space-y-2 text-sm">
                  {['Features', 'Documentation', 'Blog', 'Contact'].map((link) => (
                    <li key={link}>
                      <a href="#" className="text-gray-600 hover:text-indigo-600 transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Second Brain. All rights reserved.</p>
            <p className="mt-2">Built with ❤️ for knowledge seekers everywhere</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// 3. Share Modal Component
interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareLink: string;
  isSharing: boolean;
  onToggleShare: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, shareLink, isSharing, onToggleShare }) => {
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = () => {
    if (linkRef.current) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Share Your Knowledge</h2>
            <p className="text-sm text-gray-600">Create a public link to share your content</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-semibold text-gray-900">Public Sharing</h3>
              <p className="text-sm text-gray-600 mt-1">
                Anyone with the link can view your shared content
              </p>
            </div>
            <button
              onClick={onToggleShare}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${isSharing ? 'bg-linear-to-r from-indigo-500 to-purple-500' : 'bg-gray-300'
                }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isSharing ? 'translate-x-8' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>

          {isSharing && shareLink && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm text-indigo-600 bg-indigo-50 p-3 rounded-lg">
                <FiLink className="w-4 h-4 flex-shrink-0" />
                <span>Share link is now active</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    ref={linkRef}
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-grow px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-5 py-3 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-colors flex items-center space-x-2"
                  >
                    {copied ? (
                      <>
                        <FiCheck className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <FiCopy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    Share this link with colleagues, friends, or post it anywhere. Viewers will see all your public content in a clean, organized interface.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isSharing && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FiShare2 className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-900 font-medium mb-2">Sharing is currently disabled</p>
              <p className="text-gray-600 text-sm">
                Turn on sharing to generate a public link for your content. Your data remains private until you share it.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-white text-gray-700 font-medium rounded-xl border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. Main App Component
const App: React.FC = () => {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const [legacyToken, setLegacyToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [telegramInfo, setTelegramInfo] = useState<{ telegramChatId?: string; telegramUsername?: string }>({});
  const [legacyUser, setLegacyUser] = useState<User | null>(null);

  const isClerkAuthed = Boolean(isLoaded && isSignedIn && clerkUser);
  const isLegacyAuthed = Boolean(legacyToken);

  const clerkAppUser: User | null = isClerkAuthed
    ? {
        id: clerkUser!.id,
        username:
          clerkUser!.username ??
          clerkUser!.primaryEmailAddress?.emailAddress ??
          clerkUser!.firstName ??
          'User',
        createdAt: clerkUser!.createdAt ? new Date(clerkUser!.createdAt).toISOString() : undefined,
        telegramChatId: telegramInfo.telegramChatId,
        telegramUsername: telegramInfo.telegramUsername,
      }
    : null;

  const user: User | null = clerkAppUser ?? (legacyUser ? { ...legacyUser, ...telegramInfo } : null);

  useLayoutEffect(() => {
    if (!isLoaded) return;

    const interceptorId = api.interceptors.request.use(async (config) => {
      let authToken: string | null = null;

      if (isSignedIn) {
        const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE as string | undefined;
        authToken = template ? await getToken({ template }) : await getToken();
      } else if (legacyToken) {
        authToken = legacyToken;
      }

      if (authToken) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${authToken}`;
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(interceptorId);
    };
  }, [isLoaded, isSignedIn, getToken, legacyToken]);

  useEffect(() => {
    if (!legacyToken) return;

    (async () => {
      try {
        const res = await api.get('/me', {
          headers: { Authorization: `Bearer ${legacyToken}` },
        });
        setLegacyUser({
          id: res.data.userId,
          username: res.data.username,
          createdAt: res.data.createdAt,
        });
      } catch {
        localStorage.removeItem('token');
        setLegacyToken(null);
        setLegacyUser(null);
      }
    })();
  }, [legacyToken]);

  const logout = async () => {
    if (isClerkAuthed) {
      await signOut();
    }
    localStorage.removeItem('token');
    setLegacyToken(null);
    setLegacyUser(null);
    setTelegramInfo({});
  };

  const updateTelegramInfo = (chatId: string, username: string) => {
    setTelegramInfo({ telegramChatId: chatId, telegramUsername: username });
  };

  const legacySignIn = async (usernameOrEmail: string, password: string) => {
    const res = await api.post('/signin', { username: usernameOrEmail, password });
    const nextToken = res.data.token as string;
    localStorage.setItem('token', nextToken);
    setLegacyToken(nextToken);
    setLegacyUser(res.data.user ? { id: res.data.user.id, username: res.data.user.username } : null);
  };

  const legacySignUp = async (usernameOrEmail: string, password: string) => {
    const res = await api.post('/signup', { username: usernameOrEmail, password });
    const nextToken = res.data.token as string;
    localStorage.setItem('token', nextToken);
    setLegacyToken(nextToken);
    setLegacyUser(res.data.user ? { id: res.data.user.id, username: res.data.user.username } : null);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-gray-700 font-medium text-lg">Loading Second Brain...</p>
          <p className="text-gray-500 mt-2">Preparing your knowledge base</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, logout, updateTelegramInfo, legacySignIn, legacySignUp }}>
      {(isClerkAuthed || isLegacyAuthed) ? <Dashboard /> : <AuthForm />}
    </AuthContext.Provider>
  );
};


export default App;
