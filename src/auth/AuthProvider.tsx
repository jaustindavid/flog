// AuthProvider — React Context wrapping the auth state machine.
//
// State machine (see dispatch/M2-auth-allowlist.md §7.1):
//   loading → signed-out | signed-in | rejected
//
// onAuthStateChanged is the single source of truth for "is there a
// user." getRedirectResult is awaited on mount to complete the
// redirect handshake; its return value is redundant with the
// subsequent onAuthStateChanged fire (the latter is what drives
// state transitions).

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/auth';
import { googleProvider } from './googleProvider';
import { ensureUserDoc } from './firstSignIn';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './AuthContext';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Guards the async ensureUserDoc against double-invoke when React
  // StrictMode (or rapid onAuthStateChanged fires) revisits the same
  // uid. We only resolve once per uid.
  const resolvingUidRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Complete the redirect handshake. The Promise's return value is
    // intentionally ignored — onAuthStateChanged is the source of truth
    // for the user object. But errors here ARE diagnostic: a failing
    // cross-origin storage handshake (Safari ITP, third-party cookie
    // blocking, etc.) will reject this without onAuthStateChanged ever
    // firing with a user. Log so the failure is visible.
    getRedirectResult(auth).catch((err: unknown) => {
      console.error('getRedirectResult failed', err);
    });

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (cancelled) return;

      if (!fbUser) {
        resolvingUidRef.current = null;
        setUser(null);
        setStatus('signed-out');
        return;
      }

      setUser(fbUser);

      // Avoid re-running ensureUserDoc for the same user under
      // StrictMode double-mount or repeated auth fires.
      if (resolvingUidRef.current === fbUser.uid) return;
      resolvingUidRef.current = fbUser.uid;

      setStatus('loading');
      try {
        const result = await ensureUserDoc(fbUser);
        if (cancelled) return;
        if (result === 'rejected') {
          setStatus('rejected');
        } else {
          setStatus('signed-in');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        // Unexpected error during provisioning — treat as rejected so
        // the user has a clear escape (sign out) rather than a
        // permanent loading spinner. Log for diagnosis.
        console.error('ensureUserDoc failed', err);
        setStatus('rejected');
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signIn: async () => {
        await signInWithRedirect(auth, googleProvider);
      },
      signOut: async () => {
        await fbSignOut(auth);
        resolvingUidRef.current = null;
      },
    }),
    [status, user]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
