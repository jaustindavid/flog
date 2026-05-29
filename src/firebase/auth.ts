// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import { getAuth } from 'firebase/auth';
import { app } from './app';

export const auth = getAuth(app);
