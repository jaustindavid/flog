// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// First-sign-in logic. Reads users/{uid}; if absent, attempts to create
// with the four PRD §5.1 fields. permission-denied means the user is
// not allowlisted (rules carve-out + allowlist gate per PRD §6.1).
//
// See dispatch/M2-auth-allowlist.md §7.2.

import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firestore } from '../firebase/firestore';
import { canonicalEmail } from './canonicalEmail';

export type EnsureUserDocResult = 'existing' | 'created' | 'rejected';

function isFirebaseError(err: unknown): err is { code: string } {
  return (
    typeof err === 'object'
    && err !== null
    && 'code' in err
    && typeof (err as { code: unknown }).code === 'string'
  );
}

export async function ensureUserDoc(user: User): Promise<EnsureUserDocResult> {
  const ref = doc(firestore, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return 'existing';

  try {
    await setDoc(ref, {
      uid: user.uid,
      email: canonicalEmail(user.email),
      displayName: user.displayName ?? '',
      createdAt: serverTimestamp(),
    });
    return 'created';
  } catch (err: unknown) {
    if (isFirebaseError(err) && err.code === 'permission-denied') {
      return 'rejected';
    }
    throw err;
  }
}
