import { createContext, useContext } from 'react';
import type { User } from '../types';

export interface AuthContextType {
  user: User | null;
  logout: () => Promise<void>;
  updateTelegramInfo: (chatId: string, username: string) => void;
  legacySignIn: (usernameOrEmail: string, password: string) => Promise<void>;
  legacySignUp: (usernameOrEmail: string, password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuthContext = () => useContext(AuthContext);





