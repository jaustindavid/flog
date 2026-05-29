import { createContext } from 'react';
import type { User } from 'firebase/auth';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'rejected';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
