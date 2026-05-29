// Shared helpers for Firestore rules tests.
//
// Uses @firebase/rules-unit-testing against the Firestore emulator.
// Per dispatch §4 #16, the Auth emulator is NOT in scope here —
// auth tokens are stubbed at the rules-eval level via withAuth.
//
// Reads firebase.json for the emulator port (8080 per M1).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

export const PROJECT_ID = 'flog-rules-test';
export const ADMIN_EMAIL = 'austindavid@gmail.com';
export const ALICE_EMAIL = 'alice@example.com';
export const BOB_EMAIL = 'bob@example.com';
export const OUTSIDER_EMAIL = 'outsider@example.com';

export const ADMIN_UID = 'uid-admin';
export const ALICE_UID = 'uid-alice';
export const BOB_UID = 'uid-bob';
export const OUTSIDER_UID = 'uid-outsider';

const RULES_PATH = resolve(__dirname, '..', '..', 'firestore.rules');

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}

export interface AuthIdentity {
  uid: string;
  email: string;
}

export const adminAuth: AuthIdentity = {
  uid: ADMIN_UID,
  email: ADMIN_EMAIL,
};
export const aliceAuth: AuthIdentity = {
  uid: ALICE_UID,
  email: ALICE_EMAIL,
};
export const bobAuth: AuthIdentity = {
  uid: BOB_UID,
  email: BOB_EMAIL,
};
export const outsiderAuth: AuthIdentity = {
  uid: OUTSIDER_UID,
  email: OUTSIDER_EMAIL,
};
