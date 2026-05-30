// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Firestore initialized with an IndexedDB-backed persistent cache.
// This is what makes flog usable at a pump with poor signal: reads
// serve from the local cache, and a fill-up saved offline is queued
// locally and synced automatically when the connection returns
// (rather than the save failing). persistentMultipleTabManager keeps
// the cache coherent across multiple open tabs — without it, a second
// tab would hit a failed-precondition error.
//
// initializeFirestore (vs getFirestore) lets us pass settings, and
// MUST run before any other Firestore call on this app — keeping it
// here, at the single firestore export, guarantees that.

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { app } from './app';

export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
