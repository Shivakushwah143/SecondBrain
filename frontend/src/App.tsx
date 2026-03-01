import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { AuthContext } from './context/AuthContext';
import { ThemeContext, type ThemeMode } from './context/ThemeContext';
import { api } from './lib/api';
import type { User } from './types';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import LoadingScreen from './components/LoadingScreen';

const App: React.FC = () => {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const [legacyToken, setLegacyToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [telegramInfo, setTelegramInfo] = useState<{ telegramChatId?: string; telegramUsername?: string }>({});
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sb-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'dark';
  });
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

  const isDark = useMemo(() => {
    if (typeof window === 'undefined') return themeMode === 'dark';
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('sb-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!window.matchMedia) {
      document.documentElement.classList.toggle('dark', themeMode === 'dark');
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = themeMode === 'dark' || (themeMode === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };

    apply();

    if (themeMode === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    return undefined;
  }, [themeMode]);

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
      <LoadingScreen
        title="Loading Second Brain..."
        subtitle="Preparing your memory layer"
      />
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        mode: themeMode,
        isDark,
        setMode: setThemeMode,
        toggle: () => setThemeMode(isDark ? 'light' : 'dark'),
      }}
    >
      <AuthContext.Provider value={{ user, logout, updateTelegramInfo, legacySignIn, legacySignUp }}>
        {(isClerkAuthed || isLegacyAuthed) ? <Dashboard /> : <AuthForm />}
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
};

export default App;





