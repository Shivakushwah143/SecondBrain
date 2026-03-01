import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { FiAirplay, FiCpu, FiDatabase, FiFileText, FiMoon, FiShare2, FiSun, FiTrendingUp } from 'react-icons/fi';
import { SiExpress, SiMongodb, SiReact, SiTypescript } from 'react-icons/si';
import { getErrorMessage } from '../lib/api';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AuthForm: React.FC = () => {
  const auth = useAuthContext();
  const theme = useTheme();
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
    <div className="min-h-screen bg-[#F3EEE7] dark:bg-[#0E1014] flex items-center justify-center p-4 relative">
      <div className="absolute right-6 top-6">
        <button
          type="button"
          onClick={() => theme?.toggle()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] hover:border-[#B35A3C]/40 hover:text-[#161A21] dark:hover:text-[#E9EDF5] transition-colors text-sm font-medium"
          aria-label="Toggle theme"
        >
          {theme?.isDark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          <span>{theme?.isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

        {/* Left Column - Brand & Features */}
        <div className="space-y-8">
          {/* Brand */}
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-2xl flex items-center justify-center shadow-xl">
              <FiDatabase className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-semibold bg-[#B35A3C] dark:bg-[#1E5A58] bg-clip-text text-transparent">
                Second Brain
              </h1>
              <p className="text-[#515A66] dark:text-[#9AA3B2]">A durable memory layer for the internet</p>
            </div>
          </div>

          {/* Hero Text */}
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-[#161A21] dark:text-[#E9EDF5]">
              Keep what matters. Find it fast. Trust it later.
            </h2>
            <p className="text-lg text-[#515A66] dark:text-[#9AA3B2]">
              SecondBrain captures articles, PDFs, and ideas, then turns them into a living library you can search and build on for years.
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
              <div key={idx} className="bg-[#FBF7F1] dark:bg-[#141821]/80 backdrop-blur-sm p-4 rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-[#A46A3B]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5]">{feature.title}</h3>
                    <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tech Stack */}
          <div className="pt-8">
            <p className="text-sm text-[#6B7481] dark:text-[#8D95A3] mb-3">Built on a small, reliable stack</p>
            <div className="flex items-center space-x-4">
              <SiReact className="w-8 h-8 text-[#B35A3C]" title="React" />
              <SiTypescript className="w-8 h-8 text-[#3A4656]" title="TypeScript" />
              <SiExpress className="w-8 h-8 text-gray-800" title="Express" />
              <SiMongodb className="w-8 h-8 text-[#8C6B3D]" title="MongoDB" />
              <FiAirplay className="w-8 h-8 text-[#1E5A58]" title="Groq AI" />
              <SiMongodb className="w-8 h-8 text-[#A46A3B]" title="Qdrant" />
            </div>
          </div>
        </div>

        {/* Right Column - Auth Form */}
        <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-3xl shadow-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => setAuthMethod('clerk')}
              className={`px-4 py-2 rounded-xl border transition-colors ${authMethod === 'clerk'
                ? 'bg-[#B35A3C] text-white border-[#B35A3C]'
                : 'bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442]'
                }`}
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('legacy')}
              className={`px-4 py-2 rounded-xl border transition-colors ${authMethod === 'legacy'
                ? 'bg-[#B35A3C] text-white border-[#B35A3C]'
                : 'bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442]'
                }`}
            >
              Email & Password
            </button>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#161A21] dark:text-[#E9EDF5]">
              {mode === 'signIn' ? 'Welcome back.' : 'Create your workspace.'}
            </h2>
            <p className="text-[#515A66] dark:text-[#9AA3B2] mt-2">
              {mode === 'signIn' ? 'Pick up your thinking where you left it.' : 'Start building a memory layer that grows with you.'}
            </p>
          </div>

          <div className="flex items-center justify-center mb-6">
            <button
              type="button"
              onClick={() => setMode('signIn')}
              className={`px-4 py-2 rounded-xl border transition-colors ${mode === 'signIn'
                ? 'bg-[#B35A3C] text-white border-[#B35A3C]'
                : 'bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442]'
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signUp')}
              className={`px-4 py-2 rounded-xl border transition-colors ${mode === 'signUp'
                ? 'bg-[#B35A3C] text-white border-[#B35A3C]'
                : 'bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442]'
                }`}
            >
              Sign Up
            </button>
          </div>

          <div className="flex flex-col items-center">
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
                  <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                    Email / Username
                  </label>
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    className="block w-full px-4 py-3 border-2 border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:border-[#B35A3C]/40 focus:ring-2 focus:ring-[#E7DED2] transition-all placeholder:text-[#707885] dark:text-[#8D95A3]"
                    placeholder="you@example.com"
                    required
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-3 border-2 border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:border-[#B35A3C]/40 focus:ring-2 focus:ring-[#E7DED2] transition-all placeholder:text-[#707885] dark:text-[#8D95A3]"
                    placeholder="••••••••"
                    required
                    autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={legacyLoading}
                  className="w-full py-3 px-4 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default AuthForm;







