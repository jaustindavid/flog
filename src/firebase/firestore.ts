// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { getFirestore } from 'firebase/firestore';
import { app } from './app';

export const firestore = getFirestore(app);
