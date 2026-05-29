// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Firebase config — values come from env vars (per env mode at build time).
// See `.env.development` and `.env.production`; values themselves originate
// from `dispatch/M1-g-outputs.md` (gitignored).
//
// Note: no `measurementId` here by design. PRD §1.4 commits to no analytics;
// omitting measurementId prevents Google Analytics from auto-initializing
// even if a future copy/paste re-adds it to env.

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
