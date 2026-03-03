import React, { useState } from 'react';
import {
  FiBell,
  FiBookmark,
  FiDatabase,
  FiHome,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiMoon,
  FiSearch,
  FiSun,
  FiX as FiXIcon,
  FiShare2,
} from 'react-icons/fi';
import { SiTelegram, SiNotion } from 'react-icons/si';
import type { OverviewTab, User } from '../types';

interface ThemeControls {
  isDark: boolean;
  toggle: () => void;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: OverviewTab;
  onNavigate: (path: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  theme: ThemeControls | null;
  user: User | null;
  onLogout: () => void;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: FiHome, path: '/overview' },
  { id: 'content', label: 'Captures', icon: FiBookmark, path: '/captures' },
  { id: 'pdf', label: 'Libraries', icon: FiDatabase, path: '/libraries' },
  { id: 'ai', label: 'Ask', icon: FiMessageSquare, path: '/ask' },
  { id: 'reminders', label: 'Reminders', icon: FiBell, path: '/reminders' },
  { id: 'telegram', label: 'Telegram', icon: SiTelegram, path: '/telegram' },
  { id: 'notion', label: 'Notion', icon: SiNotion, path: '/notion' },
  { id: 'share', label: 'Share', icon: FiShare2, path: '/share' },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeTab,
  onNavigate,
  searchQuery,
  setSearchQuery,
  theme,
  user,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

            {/* Right Side Controls */}
            <div className="flex items-center gap-2 md:gap-4">
              <div className="relative hidden md:block">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-[#D0C0AE] dark:border-[#2A3442] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent w-48 text-[#161A21] dark:text-[#E9EDF5] placeholder:text-[#8D95A3]"
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
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={onLogout}
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
                {mobileMenuOpen ? <FiXIcon className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-[#D0C0AE] dark:border-[#2A3442]">
              <div className="flex flex-col space-y-2">
                {navItems.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onNavigate(tab.path);
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
                  {navItems.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => onNavigate(tab.path)}
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
            </div>
          </aside>

          {/* Main Column */}
          <div>{children}</div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 inset-x-0 md:hidden bg-[#FBF7F1] dark:bg-[#141821]/95 border-t border-[#D0C0AE] dark:border-[#2A3442] backdrop-blur-md">
        <div className="grid grid-cols-5 gap-1 px-3 py-2">
          {[
            { id: 'overview', label: 'Home', icon: FiHome, path: '/overview' },
            { id: 'content', label: 'Captures', icon: FiBookmark, path: '/captures' },
            { id: 'ai', label: 'Ask', icon: FiMessageSquare, path: '/ask' },
            { id: 'reminders', label: 'Alerts', icon: FiBell, path: '/reminders' },
            { id: 'menu', label: 'More', icon: FiMenu, path: '' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'menu') {
                  setMobileMenuOpen(prev => !prev);
                  return;
                }
                onNavigate(tab.path);
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
    </div>
  );
};

export default DashboardLayout;
