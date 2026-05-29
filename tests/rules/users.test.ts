import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  adminAuth,
  aliceAuth,
  ALICE_EMAIL,
  ALICE_UID,
  bobAuth,
  BOB_UID,
  createTestEnv,
} from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe('users/{uid} rules — PRD §6.1', () => {
  it('admin can create their own user doc via the carve-out', async () => {
    const ctx = env.authenticatedContext(adminAuth.uid, {
      email: adminAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'users', adminAuth.uid), {
        uid: adminAuth.uid,
        email: adminAuth.email,
        displayName: 'Admin',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('non-allowlisted user cannot create their own user doc', async () => {
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'users', aliceAuth.uid), {
        uid: aliceAuth.uid,
        email: aliceAuth.email,
        displayName: 'Alice',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('allowlisted user can create their own user doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'allowlist', ALICE_EMAIL), {});
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'users', aliceAuth.uid), {
        uid: aliceAuth.uid,
        email: aliceAuth.email,
        displayName: 'Alice',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('user cannot create another user’s doc', async () => {
    const ctx = env.authenticatedContext(adminAuth.uid, {
      email: adminAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'users', BOB_UID), {
        uid: BOB_UID,
        email: bobAuth.email,
        displayName: 'Bob',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('user can read their own doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        uid: ALICE_UID,
        email: ALICE_EMAIL,
        displayName: 'Alice',
      });
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', ALICE_UID)));
  });

  it('user cannot read another user’s doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        uid: ALICE_UID,
        email: ALICE_EMAIL,
        displayName: 'Alice',
      });
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(getDoc(doc(ctx.firestore(), 'users', ALICE_UID)));
  });

  it('owner can update displayName only', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        uid: ALICE_UID,
        email: ALICE_EMAIL,
        displayName: 'Alice',
      });
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        displayName: 'Alice Renamed',
      })
    );
  });

  it('owner cannot mutate email', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        uid: ALICE_UID,
        email: ALICE_EMAIL,
        displayName: 'Alice',
      });
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        email: 'spoof@example.com',
      })
    );
  });

  it('owner cannot add a novel field on update', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        uid: ALICE_UID,
        email: ALICE_EMAIL,
        displayName: 'Alice',
      });
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        admin: true,
      })
    );
  });

  it('delete is denied for any user', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE_UID), {
        uid: ALICE_UID,
        email: ALICE_EMAIL,
        displayName: 'Alice',
      });
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(deleteDoc(doc(ctx.firestore(), 'users', ALICE_UID)));
  });
});
