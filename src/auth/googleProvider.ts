// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { GoogleAuthProvider } from 'firebase/auth';

// prompt=select_account forces Google to always show the account chooser,
// even if the user is already signed into exactly one Google account.
// Without this:
//   1. After signing out of flog, the next sign-in silently picks the
//      previously-used Google account — no chance to switch accounts
//      (breaks the "try a different account" recovery for rejected users,
//      and the "let me sign in as my spouse" flow on a shared device).
//   2. Silent re-auth (prompt=none) takes a different Firebase Auth
//      redirect code path which has been observed to fail intermittently
//      on Chrome (the "first sign-in fails, second succeeds" pattern).
// See M2 handoff §"Notes for the next dispatch brief" for the full story.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
