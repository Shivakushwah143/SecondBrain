import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  FiBell,
  FiBookmark,
  FiCalendar,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiCpu,
  FiDatabase,
  FiExternalLink,
  FiFileText,
  FiFolder,
  FiGrid,
  FiHome,
  FiList,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiPlus,
  FiSearch,
  FiShare2,
  FiSun,
  FiTarget,
  FiTrash2,
  FiTrendingUp,
  FiUpload,
  FiX,
  FiMoon,
  FiZap,
} from 'react-icons/fi';
import {
  SiAdobeacrobatreader,
  SiAib,
  SiAiohttp,
  SiExpress,
  SiMongodb,
  SiNotion,
  SiReact,
  SiTelegram,
  SiTypescript,
  SiX,
  SiYoutube,
} from 'react-icons/si';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, api, getErrorMessage } from '../lib/api';
import { formatDate, formatTime } from '../lib/format';
import type {
  Captures,
  NewReminder,
  PDFCollection,
  Reminder,
  ReminderRepeat,
  Stats,
  TelegramBotStatus,
} from '../types';
import ReminderModal from './modals/ReminderModal';
import ShareModal from './modals/ShareModal';
import TelegramLinkModal from './modals/TelegramLinkModal';
import DashboardLayout from './DashboardLayout';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

type OverviewTab =
  | 'overview'
  | 'content'
  | 'pdf'
  | 'ai'
  | 'reminders'
  | 'telegram'
  | 'notion'
  | 'share'
  | 'dashboard'
  | 'menu';
// 2. Overview Component
const Dashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const tabToRoute: Partial<Record<OverviewTab, string>> = {
    overview: '/overview',
    dashboard: '/overview',
    content: '/captures',
    pdf: '/libraries',
    ai: '/ask',
    reminders: '/reminders',
    telegram: '/telegram',
    notion: '/notion',
    share: '/share',
  };
  const routeToTab: Record<string, OverviewTab> = {
    '/overview': 'overview',
    '/captures': 'content',
    '/libraries': 'pdf',
    '/ask': 'ai',
    '/reminders': 'reminders',
    '/telegram': 'telegram',
    '/notion': 'notion',
    '/share': 'share',
  };
  const activeTab = routeToTab[location.pathname] ?? 'overview';
  const setActiveTab = (tab: OverviewTab) => {
    const nextRoute = tabToRoute[tab];
    if (nextRoute && nextRoute !== location.pathname) {
      navigate(nextRoute);
    }
  };
  const [Captures, setCaptures] = useState<Captures[]>([]);
  const [collections, setCollections] = useState<PDFCollection[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalCaptures: 0,
    totalLibraries: 0,
    totalCollections: 0,
    recentActivity: 0,
    activeReminders: 0
  });
  const [newCaptures, setNewCaptures] = useState({
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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Telegram Reminders State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showTelegramLinkModal, setShowTelegramLinkModal] = useState(false);
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [isConnectingNotion, setIsConnectingNotion] = useState(false);
  const [telegramBotStatus, setTelegramBotStatus] = useState<TelegramBotStatus>({ isActive: false });
  const [showTelegramLinkedBanner, setShowTelegramLinkedBanner] = useState(false);
  const [notionStatus, setNotionStatus] = useState<{ connected: boolean; workspaceName: string }>({
    connected: false,
    workspaceName: ''
  });
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    reminderTime: '',
    repeat: 'once' as ReminderRepeat,
    telegramChatId: ''
  } satisfies NewReminder);

  const auth = useContext(AuthContext);
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
    checkTelegramBotStatus();
    fetchTelegramStatus();
    fetchNotionStatus();
  }, []);

  const fetchData = async () => {
    try {
      const [contentRes, collectionsRes, remindersRes] = await Promise.all([
        api.get('/content'),
        api.get('/pdf/collections'),
        api.get('/reminders')
      ]);

      const content = contentRes.data.content || [];
      setCaptures(content);
      setCollections(collectionsRes.data.collections || []);
      const activeReminders = remindersRes.data.activeReminders || [];
      const pastReminders = remindersRes.data.pastReminders || [];
      setReminders([...activeReminders, ...pastReminders]);

      const pdfCount = content.filter((c: Captures) => c.type === 'pdf').length || 0;

      setStats({
        totalCaptures: contentRes.data.count || 0,
        totalLibraries: pdfCount,
        totalCollections: collectionsRes.data.count || 0,
        recentActivity: content.slice(0, 5).length || 0,
        activeReminders: remindersRes.data.activeCount || activeReminders.length
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTelegramStatus = async () => {
    try {
      const response = await api.get('/telegram/status');
      if (auth && response.data?.linked) {
        auth.updateTelegramInfo(response.data.telegramChatId, response.data.telegramUsername || '');
      }
      const pending = localStorage.getItem('telegram_link_pending');
      if (pending && response.data?.linked) {
        setShowTelegramLinkedBanner(true);
        localStorage.removeItem('telegram_link_pending');
      }
    } catch (error) {
      console.error('Failed to fetch Telegram status:', error);
    }
  };

  const checkTelegramBotStatus = async () => {
    try {
      const response = await api.get('/health');
      if (response.data.services?.telegram === 'active') {
        setTelegramBotStatus({ isActive: true });
      }
    } catch (error) {
      console.error('Failed to check Telegram bot status:', error);
    }
  };

  const fetchNotionStatus = async () => {
    try {
      const response = await api.get('/notion/status');
      setNotionStatus({
        connected: Boolean(response.data?.connected),
        workspaceName: response.data?.workspaceName || ''
      });
    } catch (error) {
      console.error('Failed to fetch Notion status:', error);
    }
  };

  const handleAddCaptures = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCaptures.title || !newCaptures.type) {
      alert('Title and type are required');
      return;
    }

    try {
      if (newCaptures.type === 'pdf') {
        if (!newCaptures.file) {
          alert('Please select a PDF file');
          return;
        }

        setUploadingPDF(true);

        const formData = new FormData();
        formData.append('pdf', newCaptures.file);

        const uploadResponse = await api.post('/pdf/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Refresh collections
        const collectionsRes = await api.get('/pdf/collections');
        setCollections(collectionsRes.data.collections || []);

        // Add as Captures item
        const CapturesItem: Captures = {
          _id: uploadResponse.data.data.contentId,
          title: newCaptures.title || uploadResponse.data.data.originalName,
          link: `/pdf/${uploadResponse.data.data.collectionId}`,
          type: 'pdf',
          userId: auth?.user?.id || '',
          tags: newCaptures.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
          createdAt: new Date().toISOString()
        };

        setCaptures(prev => [CapturesItem, ...prev]);
        setStats(prev => ({
          ...prev,
          totalLibraries: prev.totalLibraries + 1,
          totalCollections: prev.totalCollections + 1,
          totalCaptures: prev.totalCaptures + 1
        }));

      } else {
        if (!newCaptures.link) {
          alert('URL is required for YouTube and Twitter Captures');
          return;
        }

        const tags = newCaptures.tags.split(',').map(tag => tag.trim()).filter(tag => tag);

        const response = await api.post('/content', {
          title: newCaptures.title,
          link: newCaptures.link,
          type: newCaptures.type,
          tags
        });
        const created = response.data.content;
        setCaptures(prev => [{ ...created, _id: created.id }, ...prev]);
        setStats(prev => ({
          ...prev,
          totalCaptures: prev.totalCaptures + 1,
          recentActivity: prev.recentActivity + 1
        }));
      }

      // Reset form
      setNewCaptures({
        title: '',
        link: '',
        type: '',
        tags: '',
        file: null
      });

    } catch (error: unknown) {
      console.error('Failed to add Captures:', error);
      alert(getErrorMessage(error, 'Failed to add Captures'));
    } finally {
      setUploadingPDF(false);
    }
  };

  const handleDeleteCaptures = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this Captures?')) return;

    try {
      await api.delete('/content', { data: { contentId: id } });
      setCaptures(prev => prev.filter(item => item._id !== id));
      setStats(prev => ({
        ...prev,
        totalCaptures: prev.totalCaptures - 1
      }));
    } catch (error) {
      console.error('Failed to delete Captures:', error);
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
      console.error('Ask failed:', error);
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
        reminderTime,
        telegramChatId: auth?.user?.telegramChatId || ''
      });

      const created = response.data.reminder;
      setReminders(prev => [{ ...created, _id: created.id }, ...prev]);
      setStats(prev => ({
        ...prev,
        activeReminders: prev.activeReminders + 1
      }));

      setNewReminder({
        title: '',
        description: '',
        reminderTime: '',
        repeat: 'once'
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

    try {
      setIsLinkingTelegram(true);
      const response = await api.get('/telegram/link/start?format=json');
      const url = response.data?.url as string | undefined;

      if (!url) {
        throw new Error('Missing Telegram link');
      }

      localStorage.setItem('telegram_link_pending', '1');
      window.location.href = url;
      setShowTelegramLinkModal(false);
    } catch (error: unknown) {
      console.error('Failed to link Telegram:', error);
      alert(getErrorMessage(error, 'Failed to start Telegram linking'));
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  const handleConnectNotion = () => {
    try {
      setIsConnectingNotion(true);
      const baseUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
      window.location.href = `${baseUrl}/api/notion/connect`;
    } finally {
      setIsConnectingNotion(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'youtube': return <SiYoutube className="w-5 h-5 text-red-600" />;
      case 'twitter': return <SiX className="w-5 h-5 text-[#707885]" />;
      case 'pdf': return <SiAdobeacrobatreader className="w-5 h-5 text-red-700" />;
      default: return <FiFileText className="w-5 h-5 text-[#6B7481] dark:text-[#8D95A3]" />;
    }
  };

  const filteredCaptures = Captures.filter(item =>
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
      <div className="min-h-screen bg-[#E7DED2] dark:bg-[#1B1F2A] flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="h-3 w-3 rounded-full bg-[#B35A3C] dark:bg-[#1E5A58] animate-bounce [animation-delay:0ms]" />
            <span className="h-3 w-3 rounded-full bg-[#A46A3B] dark:bg-[#5FA3A6] animate-bounce [animation-delay:120ms]" />
            <span className="h-3 w-3 rounded-full bg-[#7C4D7A] dark:bg-[#C08AA6] animate-bounce [animation-delay:240ms]" />
          </div>
          <p className="text-[#323845] dark:text-[#C7D0DD] font-medium text-lg">Loading your memory layer...</p>
          <p className="text-[#6B7481] dark:text-[#8D95A3] mt-2">Preparing your workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E7DED2] dark:bg-[#1B1F2A]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#FBF7F1] dark:bg-[#141821]/90 backdrop-blur-md border-b border-[#D0C0AE] dark:border-[#2A3442] shadow-sm">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 md:h-16 gap-2">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-lg flex items-center justify-center shadow-sm">
                <FiDatabase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold bg-[#B35A3C] dark:bg-[#1E5A58] bg-clip-text text-transparent">
                  Second Brain
                </h1>
                <p className="hidden sm:block text-xs text-[#6B7481] dark:text-[#8D95A3]">Memory Layer for the Internet</p>
              </div>
            </div>

            {/* Desktop Navigation removed in favor of left rail */}

            {/* Right Side Controls */}
            <div className="flex items-center gap-2 md:gap-4">
              <div className="relative hidden md:block">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-[#D0C0AE] dark:border-[#2A3442] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent w-48"
                />
                <FiSearch className="absolute left-3 top-2.5 w-4 h-4 text-[#707885] dark:text-[#8D95A3]" />
              </div>


              <button
                type="button"
                onClick={() => theme?.toggle()}
                className="h-9 w-9 md:h-auto md:w-auto md:px-3 md:py-2 rounded-lg border border-[#D0C0AE] dark:border-[#2A3442] bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] hover:border-[#B35A3C]/40 hover:text-[#161A21] dark:hover:text-[#E9EDF5] transition-colors text-sm font-medium flex items-center justify-center md:gap-2"
                aria-label="Toggle theme"
              >
                {theme?.isDark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
                <span className="hidden md:inline">{theme?.isDark ? 'Light' : 'Dark'}</span>
              </button>
              <button className="relative h-9 w-9 rounded-lg text-[#515A66] dark:text-[#9AA3B2] hover:text-[#161A21] dark:text-[#E9EDF5] hover:bg-[#E7DED2] dark:bg-[#1B1F2A] flex items-center justify-center">
                <FiBell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <div className="hidden md:flex items-center gap-3">
                <div className="w-8 h-8 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {auth?.user?.username?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={() => auth?.logout()}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-[#323845] dark:text-[#C7D0DD] hover:text-[#161A21] dark:text-[#E9EDF5] bg-[#E7DED2] dark:bg-[#1B1F2A] hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-[#515A66] dark:text-[#9AA3B2] hover:text-[#161A21] dark:text-[#E9EDF5]"
              >
                {mobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-[#D0C0AE] dark:border-[#2A3442]">
              <div className="flex flex-col space-y-2">
                {[
                  { id: 'dashboard', label: 'Overview', icon: FiHome },
                  { id: 'content', label: 'Captures', icon: FiBookmark },
                  { id: 'pdf', label: 'Libraries', icon: FiFolder },
                  { id: 'ai', label: 'Ask', icon: FiMessageSquare },
                  { id: 'reminders', label: 'Reminders', icon: FiBell },
                  { id: 'telegram', label: 'Telegram', icon: SiTelegram },
                  { id: 'notion', label: 'Notion', icon: SiNotion },
                  { id: 'share', label: 'Share', icon: FiShare2 }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as OverviewTab);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-4 py-3 rounded-lg font-medium text-sm transition-all flex items-center space-x-3 ${activeTab === tab.id
                      ? 'bg-[#B35A3C] dark:bg-[#1E5A58] text-[#A46A3B]'
                      : 'text-[#515A66] dark:text-[#9AA3B2] hover:text-[#161A21] dark:text-[#E9EDF5]'
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

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          {/* Left Rail */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl border border-[#D0C0AE] dark:border-[#2A3442] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#6B7481] dark:text-[#8D95A3]">Navigation</p>
                <div className="mt-3 flex flex-col gap-1">
                  {[
                    { id: 'dashboard', label: 'Overview', icon: FiHome },
                    { id: 'content', label: 'Captures', icon: FiBookmark },
                    { id: 'pdf', label: 'Libraries', icon: FiFolder },
                    { id: 'ai', label: 'Ask', icon: FiMessageSquare },
                    { id: 'reminders', label: 'Reminders', icon: FiBell },
                    { id: 'telegram', label: 'Telegram', icon: SiTelegram },
                    { id: 'notion', label: 'Notion', icon: SiNotion },
                    { id: 'share', label: 'Share', icon: FiShare2 }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as OverviewTab)}
                      className={`group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id
                        ? 'bg-[#E7DED2] dark:bg-[#1B1F2A] text-[#161A21] dark:text-[#E9EDF5] border border-[#D0C0AE] dark:border-[#2A3442]'
                        : 'text-[#6B7481] dark:text-[#9AA3B2] hover:text-[#161A21] dark:hover:text-[#E9EDF5] hover:bg-[#F3EEE7] dark:hover:bg-[#141821]'
                        }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl border border-[#D0C0AE] dark:border-[#2A3442] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#6B7481] dark:text-[#8D95A3]">Focus</p>
                <p className="text-sm text-[#323845] dark:text-[#C7D0DD] mt-3">
                  Capture one meaningful item today. Build a memory you can trust.
                </p>
                <button
                  onClick={() => navigate('/captures')}
                  className="mt-4 w-full px-3 py-2 rounded-xl bg-[#B35A3C] dark:bg-[#1E5A58] text-white text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  New Capture
                </button>
              </div>
            </div>
          </aside>

          {/* Main Column */}
          <div>
            {/* Welcome Banner */}
            <div className="bg-[#B35A3C] dark:bg-[#1E5A58] rounded-2xl shadow-xl p-6 mb-8 text-white relative overflow-hidden">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">SecondBrain</p>
                  <h2 className="text-2xl font-semibold mt-2">Welcome back, {auth?.user?.username}.</h2>
                  <p className="text-[#E2C8AC] opacity-90 mt-1">A calm space for long-term thinking and recall.</p>
                </div>
                <div className="hidden md:block">
                  <div className="flex items-center space-x-3">
                    <FiTarget className="w-10 h-10 opacity-30" />
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest opacity-80">Index</p>
                      <p className="text-2xl font-bold">{stats.totalCaptures * 10}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              {[
                {
                  label: 'Items Captured',
                  value: stats.totalCaptures,
                  icon: FiBookmark,
                  color: 'bg-[#B35A3C]',
                  change: 'Last 30 days'
                },
                {
                  label: 'Collections Active',
                  value: stats.totalCollections,
                  icon: FiFolder,
                  color: 'bg-[#6B7A4B]',
                  change: 'Last 30 days'
                },
                {
                  label: 'Libraries Indexed',
                  value: stats.totalLibraries,
                  icon: FiFileText,
                  color: 'bg-[#A46A3B]',
                  change: 'Last 30 days'
                },
                {
                  label: 'Reminders Live',
                  value: stats.activeReminders,
                  icon: FiBell,
                  color: 'bg-[#8C6B3D]',
                  change: 'Last 30 days'
                },
                {
                  label: 'Recent Activity',
                  value: stats.recentActivity,
                  icon: FiTrendingUp,
                  color: 'bg-[#3A4656]',
                  change: 'Last 30 days'
                }
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#515A66] dark:text-[#9AA3B2]">{stat.label}</p>
                      <p className="text-3xl font-bold text-[#161A21] dark:text-[#E9EDF5] mt-2">{stat.value}</p>
                      <p className="text-xs text-[#6B7481] dark:text-[#8D95A3] mt-1">
                        {stat.change}
                      </p>
                    </div>
                    <div className={`w-14 h-14 ${stat.color} rounded-2xl flex items-center justify-center`}>
                      <stat.icon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">Product Highlights</h3>
                  <span className="text-xs uppercase tracking-[0.2em] text-[#6B7481] dark:text-[#8D95A3]">SaaS Ready</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      title: 'Digital Second Brain',
                      src: '/Digital_Second_Brainf.png'
                    },
                    {
                      title: 'AI Knowledge Graph',
                      src: '/AI_Knowledge_Graph.png'
                    },
                    {
                      title: 'Multi-Source Capture',
                      src: '/Multi_Source_Capture.png'
                    },
                    {
                      title: 'AI Chat Over Personal Knowledge',
                      src: '/AI_Chat_Over_Personal_Knowledgel.png'
                    }
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl border border-[#D0C0AE] dark:border-[#2A3442] overflow-hidden shadow-sm"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-[#E7DED2] dark:bg-[#1B1F2A]">
                        <img
                          src={item.src}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-[#161A21] dark:text-[#E9EDF5]">{item.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Captures Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Captures & Forms (2/3 width) */}
              <div className="lg:col-span-2 space-y-8">
                {/* Capture Form */}
                {activeTab === 'content' && (
                  <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">New Capture</h2>
                      <div className="flex items-center space-x-2">
                        <FiPlus className="w-5 h-5 text-[#A46A3B]" />
                        <span className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Capture</span>
                      </div>
                    </div>

                    <form onSubmit={handleAddCaptures} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                            Title
                          </label>
                          <input
                            type="text"
                            value={newCaptures.title}
                            onChange={(e) => setNewCaptures(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent transition-all"
                            placeholder="Enter Captures title"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                            {newCaptures.type === 'pdf' ? 'Upload a PDF' : 'URL'}
                          </label>

                          {newCaptures.type === 'pdf' ? (
                            <div className="relative">
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setNewCaptures(prev => ({
                                      ...prev,
                                      link: file.name,
                                      file: file,
                                      title: prev.title || file.name.replace(/\.[^/.]+$/, "")
                                    }));
                                  }
                                }}
                                className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#F3EEE7] file:text-[#A46A3B] hover:file:bg-[#E7DED2]"
                                required={newCaptures.type === 'pdf'}
                                id="pdf-upload"
                              />
                            </div>
                          ) : (
                            <input
                              type="url"
                              value={newCaptures.link}
                              onChange={(e) => setNewCaptures(prev => ({ ...prev, link: e.target.value }))}
                              className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent transition-all"
                              placeholder="https://"
                              required={newCaptures.type !== 'pdf'}
                            />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                            Type
                          </label>
                          <select
                            value={newCaptures.type}
                            onChange={(e) => {
                              setNewCaptures(prev => ({
                                ...prev,
                                type: e.target.value,
                                link: '',
                                file: null
                              }));
                            }}
                            className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent"
                            required
                          >
                            <option value="">Select Type</option>
                            <option value="youtube">YouTube</option>
                            <option value="twitter">Twitter</option>
                            <option value="pdf">PDF Document</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                            Tags
                          </label>
                          <input
                            type="text"
                            value={newCaptures.tags}
                            onChange={(e) => setNewCaptures(prev => ({ ...prev, tags: e.target.value }))}
                            className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent transition-all"
                            placeholder="tag1, tag2, tag3"
                          />
                        </div>

                        <div className="flex items-end">
                          <button
                            type="submit"
                            disabled={uploadingPDF}
                            className="w-full px-6 py-3 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-medium rounded-xl hover:opacity-90 transition-all flex items-center justify-center shadow-md hover:shadow-lg"
                          >
                            {uploadingPDF ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <FiPlus className="w-5 h-5 mr-2" />
                                {newCaptures.type === 'pdf' ? 'Upload a PDF' : 'Add Captures'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {newCaptures.type === 'pdf' && newCaptures.file && (
                        <div className="mt-2 p-3 bg-[#F3EEE7] border border-[#D0C0AE] rounded-xl">
                          <p className="text-sm text-[#7C5A36] flex items-center">
                            <FiCheck className="w-4 h-4 mr-2" />
                            Selected PDF: {newCaptures.file.name} ({(newCaptures.file.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        </div>
                      )}
                    </form>
                  </div>
                )}

                {/* PDF Chat Interface */}
                {activeTab === 'pdf' && collections.length > 0 && (
                  <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">Ask a document</h2>
                      <FiMessageSquare className="w-5 h-5 text-[#A46A3B]" />
                    </div>

                    {/* Collection Selector */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                        Choose a library
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {collections.map((collection) => (
                          <button
                            key={collection._id}
                            onClick={() => setSelectedCollection(collection._id)}
                            className={`p-4 rounded-xl border transition-all flex items-center space-x-3 ${selectedCollection === collection._id
                              ? 'border-[#B35A3C]/40 bg-[#F3EEE7]'
                              : 'border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442] hover:bg-[#F3EEE7] dark:bg-[#0E1014]'
                              }`}
                          >
                            <div className="w-10 h-10 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-lg flex items-center justify-center">
                              <SiAdobeacrobatreader className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="text-left flex-1">
                              <p className="font-medium text-[#161A21] dark:text-[#E9EDF5] text-sm truncate">
                                {collection.originalName}
                              </p>
                              <p className="text-xs text-[#6B7481] dark:text-[#8D95A3]">
                                {collection.chunks} chunks © {formatDate(collection.uploadDate)}
                              </p>
                            </div>
                            {selectedCollection === collection._id && (
                              <FiCheck className="w-5 h-5 text-[#A46A3B]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* PDF Chat Form */}
                    {selectedCollection && (
                      <div className="space-y-4">
                        {pdfChatResponse && (
                          <div className="bg-[#F3EEE7] dark:bg-[#0E1014] rounded-xl p-4 border border-[#D0C0AE] dark:border-[#2A3442]">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-[#323845] dark:text-[#C7D0DD]">
                                Response from: {pdfChatResponse.collectionName}
                              </p>
                              <span className="text-xs px-2 py-1 bg-[#E7DED2] text-[#A46A3B] rounded-full">
                                {pdfChatResponse.relevantChunks} relevant chunks
                              </span>
                            </div>
                            <p className="text-[#323845] dark:text-[#C7D0DD]">{pdfChatResponse.response}</p>
                            <button
                              onClick={() => setPdfChatResponse(null)}
                              className="mt-3 text-sm text-[#A46A3B] hover:text-[#A46A3B] font-medium"
                            >
                              Ask a follow-up.
                            </button>
                          </div>
                        )}

                        <form onSubmit={handlePdfChat} className="space-y-3">
                          <div className="relative">
                            <input
                              type="text"
                              value={pdfQuery}
                              onChange={(e) => setPdfQuery(e.target.value)}
                              placeholder="Ask about this library..."
                              className="w-full px-4 py-3 pr-12 border-2 border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:border-[#B35A3C]/40 focus:ring-2 focus:ring-[#E7DED2] transition-all"
                              disabled={pdfChatLoading}
                            />
                            <button
                              type="submit"
                              disabled={pdfChatLoading || !pdfQuery.trim()}
                              className="absolute right-2 top-2 p-2 bg-[#B35A3C] dark:bg-[#1E5A58] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {pdfChatLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <FiMessageSquare className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-[#6B7481] dark:text-[#8D95A3] text-center">
                            Ask questions across this library.
                          </p>
                        </form>
                      </div>
                    )}
                  </div>
                )}

                {/* Ask Interface */}
                {activeTab === 'ai' && (
                  <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-4 md:p-6 min-h-[calc(100vh-220px)] md:min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">SecondBrain AI</h2>
                        <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Your personal knowledge assistant</p>
                      </div>
                      <div className="w-10 h-10 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl flex items-center justify-center">
                        <FiCpu className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      {aiResponse ? (
                        <div className="flex-1 flex flex-col gap-3">
                          <div className="bg-[#F3EEE7] dark:bg-[#0E1014] rounded-xl p-4 overflow-y-auto">
                            <p className="text-[#323845] dark:text-[#C7D0DD] whitespace-pre-wrap">{aiResponse}</p>
                          </div>
                          <button
                            onClick={() => setAiResponse('')}
                            className="w-full text-sm text-[#A46A3B] hover:text-[#A46A3B] font-medium"
                          >
                            Ask another question
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                          <h3 className="text-xl font-semibold text-[#161A21] dark:text-[#E9EDF5] mb-2">
                            What can I help with?
                          </h3>
                          <p className="text-sm text-[#6B7481] dark:text-[#9AA3B2] mb-4">
                            Ask about your captures, PDFs, or general questions.
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            {['Summarize notes', 'Draft an email', 'Explain a concept', 'Find key takeaways'].map((hint) => (
                              <button
                                key={hint}
                                type="button"
                                onClick={() => setAiMessage(hint)}
                                className="px-3 py-1.5 text-xs rounded-full border border-[#D0C0AE] dark:border-[#2A3442] bg-[#E7DED2] dark:bg-[#1B1F2A] text-[#323845] dark:text-[#C7D0DD] hover:border-[#B35A3C]/40 transition-colors"
                              >
                                {hint}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleAIChat} className="mt-4">
                      <div className="relative">
                        <input
                          type="text"
                          value={aiMessage}
                          onChange={(e) => setAiMessage(e.target.value)}
                          placeholder="Ask SecondBrain AI..."
                          className="w-full px-4 py-3 pr-12 border-2 border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:border-[#B35A3C]/40 focus:ring-2 focus:ring-[#E7DED2] transition-all"
                          disabled={aiLoading}
                        />
                        <button
                          type="submit"
                          disabled={aiLoading || !aiMessage.trim()}
                          className="absolute right-2 top-2 p-2 bg-[#B35A3C] dark:bg-[#1E5A58] text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {aiLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FiMessageSquare className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
{/* Reminders Interface */}
                {activeTab === 'reminders' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">Reminders</h2>
                      <button
                        onClick={() => setShowReminderModal(true)}
                        className="px-4 py-2 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-medium rounded-xl hover:opacity-90 transition-all flex items-center space-x-2"
                      >
                        <FiPlus className="w-4 h-4" />
                        <span>New Reminder</span>
                      </button>
                    </div>

                    {filteredReminders.length === 0 ? (
                      <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-8 text-center">
                        <div className="w-16 h-16 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <FiBell className="w-8 h-8 text-[#A46A3B]" />
                        </div>
                        <h3 className="text-lg font-medium text-[#161A21] dark:text-[#E9EDF5] mb-2">No reminders scheduled</h3>
                        <p className="text-[#515A66] dark:text-[#9AA3B2] mb-6">Create a gentle nudge for the moments that matter.</p>
                        <button
                          onClick={() => setShowReminderModal(true)}
                          className="px-6 py-3 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-medium rounded-xl hover:opacity-90 transition-all"
                        >
                          Create Your First Reminder
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredReminders.map((reminder) => (
                          <div
                            key={reminder._id}
                            className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-6 hover:shadow-lg transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className={`p-3 rounded-xl ${reminder.isActive
                                  ? 'bg-[#E7DED2] text-[#7C5A36] border border-[#D0C0AE]'
                                  : 'bg-[#E7DED2] dark:bg-[#1B1F2A] text-[#515A66] dark:text-[#9AA3B2] border border-[#D0C0AE] dark:border-[#2A3442]'
                                  }`}>
                                  <FiBell className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5]">{reminder.title}</h3>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className={`text-xs px-2 py-1 rounded-full ${reminder.isActive
                                      ? 'bg-[#E7DED2] text-[#7C5A36]'
                                      : 'bg-[#E7DED2] dark:bg-[#1B1F2A] text-[#323845] dark:text-[#C7D0DD]'
                                      }`}>
                                      {reminder.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className="text-xs text-[#6B7481] dark:text-[#8D95A3]">
                                      {reminder.repeat}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleToggleReminder(reminder._id, reminder.isActive)}
                                  className={`p-2 rounded-lg ${reminder.isActive ? 'hover:bg-red-100' : 'hover:bg-[#E7DED2]'}`}
                                  title={reminder.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {reminder.isActive ? (
                                    <FiBell className="w-4 h-4 text-red-500" />
                                  ) : (
                                    <FiBell className="w-4 h-4 text-[#A46A3B]" />
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
                              <p className="text-[#515A66] dark:text-[#9AA3B2] text-sm mb-4">
                                {reminder.description}
                              </p>
                            )}

                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between text-[#323845] dark:text-[#C7D0DD]">
                                <span className="flex items-center space-x-2">
                                  <FiClock className="w-4 h-4 text-[#A46A3B]" />
                                  <span>Time:</span>
                                </span>
                                <span className="font-medium">{formatTime(reminder.reminderTime)}</span>
                              </div>
                              <div className="flex items-center justify-between text-[#323845] dark:text-[#C7D0DD]">
                                <span className="flex items-center space-x-2">
                                  <FiCalendar className="w-4 h-4 text-[#A46A3B]" />
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

                {/* Notion Interface */}
                {activeTab === 'notion' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">Notion Workspace</h2>
                        <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">
                          {notionStatus.connected
                            ? `Connected${notionStatus.workspaceName ? ` to ${notionStatus.workspaceName}` : ''}`
                            : 'Connect Notion to sync and organize'}
                        </p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${notionStatus.connected
                        ? 'bg-[#E7DED2] text-[#7C5A36] border border-[#D0C0AE]'
                        : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                        {notionStatus.connected ? 'Connected' : 'Not Connected'}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-2xl p-6 border border-[#D0C0AE]">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-12 h-12 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl flex items-center justify-center">
                            <SiNotion className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5]">
                              {notionStatus.connected ? 'Notion Connected' : 'Connect Workspace'}
                            </h3>
                            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">
                              {notionStatus.connected ? 'Your Notion workspace is linked.' : 'Authorize your Notion account'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleConnectNotion}
                          disabled={isConnectingNotion || notionStatus.connected}
                          className="w-full py-3 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {notionStatus.connected ? 'Connected' : isConnectingNotion ? 'Connecting…' : 'Connect Notion'}
                        </button>
                      </div>

                      <div className="bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-2xl p-6 border border-[#D0C0AE]">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-12 h-12 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl flex items-center justify-center">
                            <FiDatabase className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5]">What you'll get</h3>
                            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Secure, read-ready access</p>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm text-[#515A66] dark:text-[#9AA3B2]">
                          <p>• Link one workspace with a single click</p>
                          <p>• Keep tokens secure on the server</p>
                          <p>• Ready for future sync features</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Telegram Interface */}
                {activeTab === 'telegram' && (
                  <div className="space-y-6">
                    {showTelegramLinkedBanner && (
                      <div className="rounded-xl border border-[#D0C0AE] bg-[#E7DED2] px-4 py-3 text-sm text-[#323845]">
                        Telegram account linked successfully.
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">Telegram Bot</h2>
                        <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Save Captures directly from Telegram</p>
                      </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${auth?.user?.telegramChatId
                        ? 'bg-[#E7DED2] text-[#7C5A36] border border-[#D0C0AE]'
                        : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                        {auth?.user?.telegramChatId ? 'Connected' : 'Not Connected'}
                    </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-2xl p-6 border border-[#D0C0AE]">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-12 h-12 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl flex items-center justify-center">
                            <SiTelegram className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5]">Link Your Account</h3>
                            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Connect Telegram to save Captures</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowTelegramLinkModal(true)}
                          className="w-full py-3 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-medium rounded-xl hover:opacity-90 transition-all"
                        >
                          Link Telegram Account
                        </button>
                      </div>

                      <div className="bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-2xl p-6 border border-[#D0C0AE]">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-12 h-12 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl flex items-center justify-center">
                            <FiMessageSquare className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5]">Bot Commands</h3>
                            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Available commands</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <code className="block text-sm bg-[#FBF7F1] dark:bg-[#141821]/50 px-3 py-2 rounded-lg font-mono">
                            /start - Start the bot
                          </code>
                          <code className="block text-sm bg-[#FBF7F1] dark:bg-[#141821]/50 px-3 py-2 rounded-lg font-mono">
                            /addCaptures - Save Captures
                          </code>
                          <code className="block text-sm bg-[#FBF7F1] dark:bg-[#141821]/50 px-3 py-2 rounded-lg font-mono">
                            /myCaptures - View your Captures
                          </code>
                          <code className="block text-sm bg-[#FBF7F1] dark:bg-[#141821]/50 px-3 py-2 rounded-lg font-mono">
                            /remind - Set a reminder
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Captures Display */}
                {(activeTab === 'dashboard' || activeTab === 'content') && (
                  <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#D0C0AE] dark:border-[#2A3442] flex justify-between items-center">
                      <div>
                        <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">
                          {activeTab === 'dashboard' ? 'Recent Captures' : 'All Captures'}
                        </h2>
                        <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">
                          {filteredCaptures.length} items © {stats.totalCaptures} total
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-[#E7DED2] dark:bg-[#1B1F2A] text-[#161A21] dark:text-[#E9EDF5]' : 'text-[#515A66] dark:text-[#9AA3B2] hover:text-[#161A21] dark:text-[#E9EDF5]'}`}
                        >
                          <FiGrid className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[#E7DED2] dark:bg-[#1B1F2A] text-[#161A21] dark:text-[#E9EDF5]' : 'text-[#515A66] dark:text-[#9AA3B2] hover:text-[#161A21] dark:text-[#E9EDF5]'}`}
                        >
                          <FiList className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {filteredCaptures.length === 0 ? (
                      <div className="py-12 text-center">
                        <FiBookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-[#515A66] dark:text-[#9AA3B2]">No captures yet. Save something worth remembering.</p>
                      </div>
                    ) : viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                        {filteredCaptures.slice(0, 6).map((item) => (
                          <div
                            key={item._id}
                            className="border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-lg bg-[#E7DED2] dark:bg-[#1B1F2A] flex items-center justify-center">
                                  {getTypeIcon(item.type)}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5] line-clamp-1">{item.title}</h3>
                                  <p className="text-xs text-[#6B7481] dark:text-[#8D95A3]">{item.type}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteCaptures(item._id)}
                                className="text-[#707885] dark:text-[#8D95A3] hover:text-red-600 transition-colors"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2] mb-3 line-clamp-2">{item.link}</p>

                            <div className="flex flex-wrap gap-1 mb-3">
                              {item.tags.slice(0, 3).map((tag, idx) => (
                                <span key={idx} className="px-2 py-1 text-xs font-medium bg-[#F3EEE7] text-[#A46A3B] rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center justify-between text-xs text-[#6B7481] dark:text-[#8D95A3]">
                              <span>{formatDate(item.createdAt)}</span>
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#A46A3B] hover:text-[#A46A3B] font-medium flex items-center"
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
                        {filteredCaptures.slice(0, 5).map((item) => (
                          <div key={item._id} className="px-6 py-4 hover:bg-[#F3EEE7] dark:bg-[#0E1014] transition-colors">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-xl bg-[#E7DED2] dark:bg-[#1B1F2A] flex items-center justify-center">
                                  {getTypeIcon(item.type)}
                                </div>
                              </div>

                              <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start">
                                  <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5] truncate">{item.title}</h3>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-medium px-2 py-1 bg-[#E7DED2] dark:bg-[#1B1F2A] text-[#323845] dark:text-[#C7D0DD] rounded-full">
                                      {item.type}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteCaptures(item._id)}
                                      className="text-[#707885] dark:text-[#8D95A3] hover:text-red-600 transition-colors p-1"
                                    >
                                      <FiTrash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                <p className="text-sm text-[#515A66] dark:text-[#9AA3B2] mt-1 truncate">{item.link}</p>

                                <div className="flex items-center justify-between mt-4">
                                  <div className="flex items-center space-x-2">
                                    {item.tags.slice(0, 3).map((tag, idx) => (
                                      <span key={idx} className="px-2.5 py-1 text-xs font-medium bg-[#F3EEE7] text-[#A46A3B] rounded-lg">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>

                                  <div className="flex items-center space-x-4 text-sm text-[#6B7481] dark:text-[#8D95A3]">
                                    <span className="flex items-center">
                                      <FiCalendar className="w-3 h-3 mr-1.5" />
                                      {formatDate(item.createdAt)}
                                    </span>
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center text-[#A46A3B] hover:text-[#A46A3B] font-medium"
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

                    {filteredCaptures.length > 6 && (
                      <div className="px-6 py-4 border-t border-[#D0C0AE] dark:border-[#2A3442] bg-[#F3EEE7] dark:bg-[#0E1014]">
                        <button className="w-full text-center text-[#A46A3B] hover:text-[#A46A3B] font-medium">
                          View all {filteredCaptures.length} items
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Libraries Display */}
                {activeTab === 'pdf' && (
                  <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#D0C0AE] dark:border-[#2A3442]">
                      <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">Libraries</h2>
                      <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Uploaded documents with AI-powered search</p>
                    </div>

                    {filteredCollections.length === 0 ? (
                      <div className="py-12 text-center">
                        <FiFolder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-[#515A66] dark:text-[#9AA3B2]">No libraries yet</p>
                        <p className="text-sm text-[#6B7481] dark:text-[#8D95A3] mt-2">Upload a PDF to start a searchable library.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                        {filteredCollections.map((collection) => (
                          <div
                            key={collection._id}
                            className="border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl p-4 hover:shadow-md transition-all hover:-translate-y-1"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-lg flex items-center justify-center">
                                  <SiAdobeacrobatreader className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5] line-clamp-1">
                                    {collection.originalName}
                                  </h3>
                                  <p className="text-xs text-[#6B7481] dark:text-[#8D95A3]">{collection.chunks} text chunks</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedCollection(collection._id)}
                                className="text-[#707885] dark:text-[#8D95A3] hover:text-[#A46A3B] transition-colors"
                                title="Chat with this PDF"
                              >
                                <FiMessageSquare className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-2 mb-3">
                              <div className="flex items-center justify-between text-xs text-[#6B7481] dark:text-[#8D95A3]">
                                <span>Uploaded:</span>
                                <span>{formatDate(collection.uploadDate)}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-[#6B7481] dark:text-[#8D95A3]">
                                <span>Vector Collection:</span>
                                <code className="px-2 py-1 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded text-xs">
                                  {collection.name.substring(0, 15)}...
                                </code>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => setSelectedCollection(collection._id)}
                                className="px-3 py-1.5 text-sm font-medium bg-[#B35A3C] dark:bg-[#1E5A58] text-white rounded-lg hover:opacity-90 transition-all"
                              >
                                Ask this library
                              </button>
                              <span className="text-xs px-2 py-1 bg-[#E7DED2] text-[#7C5A36] rounded-full">
                                Indexed
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
                {/* Shortcuts */}
                <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-6">
                  <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5] mb-4">Shortcuts</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => navigate('/captures')}
                      className="p-3 rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#C7B39C] hover:bg-[#F3EEE7] transition-all flex flex-col items-center justify-center"
                    >
                      <FiPlus className="w-5 h-5 text-[#A46A3B] mb-2" />
                      <span className="text-xs font-medium text-[#323845] dark:text-[#C7D0DD]">Add Captures</span>
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#C7B39C] hover:bg-[#F3EEE7] transition-all flex flex-col items-center justify-center"
                    >
                      <FiUpload className="w-5 h-5 text-[#A46A3B] mb-2" />
                      <span className="text-xs font-medium text-[#323845] dark:text-[#C7D0DD]">Upload a PDF</span>
                    </button>

                    <button
                      onClick={() => navigate('/reminders')}
                      className="p-3 rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#C7B39C] hover:bg-[#F3EEE7] transition-all flex flex-col items-center justify-center"
                    >
                      <FiBell className="w-5 h-5 text-[#A46A3B] mb-2" />
                      <span className="text-xs font-medium text-[#323845] dark:text-[#C7D0DD]">Reminders</span>
                    </button>

                    <button
                      onClick={() => navigate('/ask')}
                      className="p-3 rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#C7B39C] hover:bg-[#F3EEE7] transition-all flex flex-col items-center justify-center"
                    >
                      <FiMessageSquare className="w-5 h-5 text-[#A46A3B] mb-2" />
                      <span className="text-xs font-medium text-[#323845] dark:text-[#C7D0DD]">Ask</span>
                    </button>
                  </div>
                </div>

                {/* PDF Upload Card */}
                <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">Upload a PDF</h2>
                    <FiUpload className="w-5 h-5 text-[#A46A3B]" />
                  </div>

                  <div className="space-y-4">
                    <div
                      className="border-3 border-dashed border-[#D0C0AE] dark:border-[#2A3442] rounded-2xl p-8 text-center hover:border-[#BDAA95] transition-colors cursor-pointer bg-[#F3EEE7] dark:bg-[#0E1014] hover:bg-[#F3EEE7]"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FiUpload className="w-12 h-12 text-[#707885] dark:text-[#8D95A3] mx-auto mb-4" />
                      <p className="text-[#515A66] dark:text-[#9AA3B2] mb-2 font-medium">Drop Libraries here</p>
                      <p className="text-sm text-[#6B7481] dark:text-[#8D95A3] mb-4">or browse from your device</p>
                      <span className="inline-block px-6 py-2.5 bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] font-medium rounded-lg border-2 border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#B35A3C]/40 hover:text-[#A46A3B] cursor-pointer transition-all">
                        Choose File
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewCaptures(prev => ({
                              ...prev,
                              type: 'pdf',
                              link: file.name,
                              file: file,
                              title: prev.title || file.name.replace(/\.[^/.]+$/, "")
                            }));
                            navigate('/captures');
                          }
                        }}
                        disabled={uploadingPDF}
                      />
                    </div>

                    {uploadingPDF && (
                      <div className="flex items-center justify-center space-x-3">
                        <div className="w-4 h-4 border-2 border-[#B35A3C]/40 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[#515A66] dark:text-[#9AA3B2]">Processing PDF...</span>
                      </div>
                    )}

                    <div className="text-xs text-[#6B7481] dark:text-[#8D95A3] space-y-1">
                      <p className="flex items-center">
                        <FiCheck className="w-3 h-3 mr-2 text-[#A46A3B]" />
                        Supports PDF files up to 10MB
                      </p>
                      <p className="flex items-center">
                        <FiCheck className="w-3 h-3 mr-2 text-[#A46A3B]" />
                        AI-powered text extraction and search
                      </p>
                      <p className="flex items-center">
                        <FiCheck className="w-3 h-3 mr-2 text-[#A46A3B]" />
                        Secure cloud storage with Qdrant
                      </p>
                    </div>
                  </div>
                </div>

                {/* Libraries List */}
                <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-sm border border-[#D0C0AE] dark:border-[#2A3442] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-[#161A21] dark:text-[#E9EDF5]">Libraries</h2>
                    <div className="flex items-center space-x-2">
                      <FiFolder className="w-5 h-5 text-[#A46A3B]" />
                      <span className="text-sm font-medium text-[#323845] dark:text-[#C7D0DD]">{collections.length}</span>
                    </div>
                  </div>

                  {collections.length === 0 ? (
                    <div className="text-center py-6">
                      <FiFolder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-[#515A66] dark:text-[#9AA3B2]">No libraries yet</p>
                      <p className="text-sm text-[#6B7481] dark:text-[#8D95A3] mt-2">Upload a PDF to build your first library.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {collections.slice(0, 3).map((collection) => (
                        <div
                          key={collection._id}
                          className="flex items-center justify-between p-4 bg-[#F3EEE7] dark:bg-[#0E1014] rounded-xl hover:bg-[#E7DED2] dark:bg-[#1B1F2A] transition-colors group cursor-pointer"
                          onClick={() => {
                            setSelectedCollection(collection._id);
                            navigate('/libraries');
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-[#E7DED2] rounded-lg flex items-center justify-center group-hover:bg-[#DCCFBE] transition-colors">
                              <FiFileText className="w-5 h-5 text-[#7C5A36]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-[#161A21] dark:text-[#E9EDF5] text-sm truncate max-w-[160px]">
                                {collection.originalName}
                              </p>
                              <div className="flex items-center space-x-3 mt-1">
                                <p className="text-xs text-[#6B7481] dark:text-[#8D95A3]">
                                  {collection.chunks} chunks
                                </p>
                                <p className="text-xs text-[#6B7481] dark:text-[#8D95A3]">
                                  {formatDate(collection.uploadDate)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <button className="text-[#707885] dark:text-[#8D95A3] hover:text-[#515A66] dark:text-[#9AA3B2] opacity-0 group-hover:opacity-100 transition-all">
                            <FiChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      ))}

                      {collections.length > 3 && (
                        <button
                          onClick={() => navigate('/libraries')}
                          className="w-full text-center text-[#A46A3B] hover:text-[#A46A3B] font-medium text-sm pt-2"
                        >
                          View all {collections.length} collections
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Tech Stack */}
                <div className="bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-2xl shadow-lg p-6 text-white">
                  <h3 className="font-semibold mb-4">Infrastructure</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <SiReact className="w-8 h-8 mx-auto mb-2 text-[#B35A3C]" />
                      <p className="text-xs">React</p>
                    </div>
                    <div className="text-center">
                      <SiTypescript className="w-8 h-8 mx-auto mb-2 text-[#3A4656]" />
                      <p className="text-xs">TypeScript</p>
                    </div>
                    <div className="text-center">
                      <SiExpress className="w-8 h-8 mx-auto mb-2 text-white" />
                      <p className="text-xs">Express</p>
                    </div>
                    <div className="text-center">
                      <SiMongodb className="w-8 h-8 mx-auto mb-2 text-[#8C6B3D]" />
                      <p className="text-xs">MongoDB</p>
                    </div>
                    <div className="text-center">
                      <SiAib className="w-8 h-8 mx-auto mb-2 text-[#1E5A58]" />
                      <p className="text-xs">Groq AI</p>
                    </div>
                    <div className="text-center">
                      <SiAiohttp className="w-8 h-8 mx-auto mb-2 text-[#A46A3B]" />
                      <p className="text-xs">Qdrant</p>
                    </div>
                  </div>
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
        onSubmit={handleLinkTelegram}
        isLinking={isLinkingTelegram}
        user={auth?.user}
      />

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 inset-x-0 md:hidden bg-[#FBF7F1] dark:bg-[#141821]/95 border-t border-[#D0C0AE] dark:border-[#2A3442] backdrop-blur-md">
        <div className="grid grid-cols-5 gap-1 px-3 py-2">
          {[
            { id: 'dashboard', label: 'Home', icon: FiHome },
            { id: 'content', label: 'Captures', icon: FiBookmark },
            { id: 'ai', label: 'Ask', icon: FiMessageSquare },
            { id: 'reminders', label: 'Alerts', icon: FiBell },
            { id: 'menu', label: 'More', icon: FiMenu }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'menu') {
                  setMobileMenuOpen(prev => !prev);
                  return;
                }
                setActiveTab(tab.id as OverviewTab);
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-colors ${activeTab === tab.id
                ? 'text-[#A46A3B]'
                : 'text-[#6B7481] dark:text-[#9AA3B2]'
                }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#D0C0AE] dark:border-[#2A3442] bg-[#FBF7F1] dark:bg-[#141821] mt-12">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl flex items-center justify-center">
                  <FiDatabase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-[#161A21] dark:text-[#E9EDF5]">Second Brain</h3>
                  <p className="text-xs text-[#6B7481] dark:text-[#8D95A3]">Memory Layer for the Internet</p>
                </div>
              </div>
              <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">
                Your AI-powered second brain for organizing, discovering, and growing knowledge.
              </p>
            </div>

            {['Product', 'Resources', 'Company', 'Connect'].map((category) => (
              <div key={category}>
                <h4 className="font-semibold text-[#161A21] dark:text-[#E9EDF5] mb-4">{category}</h4>
                <ul className="space-y-2 text-sm">
                  {['Features', 'Documentation', 'Blog', 'Contact'].map((link) => (
                    <li key={link}>
                      <a href="#" className="text-[#515A66] dark:text-[#9AA3B2] hover:text-[#A46A3B] transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-[#D0C0AE] dark:border-[#2A3442] mt-8 pt-8 text-center text-sm text-[#6B7481] dark:text-[#8D95A3]">
            <p>© {new Date().getFullYear()} Second Brain. All rights reserved.</p>
            <p className="mt-2">Built for people who think long term.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;




