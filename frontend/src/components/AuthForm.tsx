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
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] hover:border-[#B35A3C]/40 hover:text-[#161A21] dark:hover:text-[#E9EDF5] dark:hover:border-[#1E5A58]/50 transition-colors text-sm font-medium"
          aria-label="Toggle theme"
        >
          {theme?.isDark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          <span>{theme?.isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

        {/* Left Column - Brand & Features */}
        <div className="space-y-12 relative">
          <div className="absolute -top-8 -left-8 w-40 h-40 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-full blur-3xl opacity-70 animate-pulse" />
          <div className="absolute top-20 left-40 w-24 h-24 bg-[#B35A3C]/20 dark:bg-[#1E5A58]/30 rounded-full blur-2xl opacity-70 animate-pulse" />
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

          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-3xl border border-[#D0C0AE] dark:border-[#2A3442] bg-[#FBF7F1] dark:bg-[#141821] p-6 md:p-8">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(179,90,60,0.25),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(30,90,88,0.25),transparent_45%),radial-gradient(circle_at_40%_80%,rgba(124,77,122,0.18),transparent_40%)] animate-[pulse_6s_ease-in-out_infinite]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(120,120,120,0.08)_1px,transparent_1px)] [background-size:22px_22px] opacity-40" />
            </div>
            <div className="relative space-y-4">
              <h2 className="text-3xl md:text-4xl font-semibold text-[#161A21] dark:text-[#E9EDF5]">
                Your Second Brain for everything you learn.
              </h2>
              <p className="text-lg text-[#515A66] dark:text-[#9AA3B2]">
                Capture once. Connect everything. Ask anything. Second Brain turns your notes, links, and PDFs into a living knowledge graph.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="#auth"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-semibold shadow-lg hover:shadow-xl hover:opacity-90 transition-all duration-200"
                >
                  Start Free
                </a>
                <span className="text-sm text-[#6B7481] dark:text-[#8D95A3]">No credit card required</span>
              </div>
            </div>
          </div>

          {/* Feature Sections */}
          <div className="space-y-12">
            {[
              {
                title: 'Your Digital Second Brain',
                desc: 'A calm, structured home for everything you want to remember. Capture once, recall forever.',
                src: '/Digital_Second_Brainf.png',
                reverse: false
              },
              {
                title: 'AI Knowledge Graph',
                desc: 'Vector search and embeddings connect ideas across your sources for deeper context.',
                src: '/AI_Knowledge_Graph.png',
                reverse: true
              },
              {
                title: 'Capture Everything',
                desc: 'Save from web, PDFs, social, and notes — all indexed in one consistent library.',
                src: '/Multi_Source_Capture.png',
                reverse: false
              },
              {
                title: 'Chat With Your Knowledge',
                desc: 'Ask natural questions and get precise answers grounded in your personal archive.',
                src: '/AI_Chat_Over_Personal_Knowledgel.png',
                reverse: true
              }
            ].map((section) => (
              <div
                key={section.title}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center"
              >
                <div className={`${section.reverse ? 'md:order-2' : ''}`}>
                  <h3 className="text-xl font-semibold text-[#161A21] dark:text-[#E9EDF5] mb-2">{section.title}</h3>
                  <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">{section.desc}</p>
                </div>
                <div className={`${section.reverse ? 'md:order-1' : ''}`}>
                  <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl border border-[#D0C0AE] dark:border-[#2A3442] overflow-hidden shadow-sm">
                    <img
                      src={section.src}
                      alt={section.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Auth Form */}
        <div id="auth" className="bg-[#FBF7F1] dark:bg-[#141821] rounded-3xl shadow-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => setAuthMethod('clerk')}
              className={`px-4 py-2 rounded-xl border transition-colors ${authMethod === 'clerk'
                ? 'bg-[#B35A3C] text-white border-[#B35A3C] dark:bg-[#1E5A58] dark:border-[#1E5A58]'
                : 'bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442] dark:hover:border-[#1E5A58]/50'
                }`}
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('legacy')}
              className={`px-4 py-2 rounded-xl border transition-colors ${authMethod === 'legacy'
                ? 'bg-[#B35A3C] text-white border-[#B35A3C] dark:bg-[#1E5A58] dark:border-[#1E5A58]'
                : 'bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442] dark:hover:border-[#1E5A58]/50'
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
                ? 'bg-[#B35A3C] text-white border-[#B35A3C] dark:bg-[#1E5A58] dark:border-[#1E5A58]'
                : 'bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442] dark:hover:border-[#1E5A58]/50'
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signUp')}
              className={`px-4 py-2 rounded-xl border transition-colors ${mode === 'signUp'
                ? 'bg-[#B35A3C] text-white border-[#B35A3C] dark:bg-[#1E5A58] dark:border-[#1E5A58]'
                : 'bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] border-[#D0C0AE] dark:border-[#2A3442] hover:border-[#D0C0AE] dark:border-[#2A3442] dark:hover:border-[#1E5A58]/50'
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
                    className="block w-full px-4 py-3 border-2 border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:border-[#B35A3C]/40 dark:focus:border-[#1E5A58]/50 focus:ring-2 focus:ring-[#E7DED2] dark:focus:ring-[#1E5A58]/30 transition-all placeholder:text-[#707885] dark:text-[#8D95A3]"
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
                    className="block w-full px-4 py-3 border-2 border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] focus:outline-none focus:border-[#B35A3C]/40 dark:focus:border-[#1E5A58]/50 focus:ring-2 focus:ring-[#E7DED2] dark:focus:ring-[#1E5A58]/30 transition-all placeholder:text-[#707885] dark:text-[#8D95A3]"
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







