// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  adminAuth,
  ADMIN_EMAIL,
  aliceAuth,
  ALICE_EMAIL,
  bobAuth,
  BOB_EMAIL,
  createTestEnv,
  outsiderAuth,
  OUTSIDER_EMAIL,
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

async function seedAllowlist(emails: string[]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const email of emails) {
      await setDoc(doc(ctx.firestore(), 'allowlist', email), {});
    }
  });
}

describe('allowlist/{email} rules — PRD §6.4', () => {
  it('allowlisted user can read own allowlist doc', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), 'allowlist', ALICE_EMAIL))
    );
  });

  // Amended 2026-05-28 (M3 V2 fix-forward): read is broadened from
  // "self only" to "any allowlisted user" so shareCar's pre-read of
  // a target email's allowlist doc can proceed. See firestore.rules
  // allowlist comment for full rationale.
  it('allowlisted user can read another user’s allowlist doc', async () => {
    await seedAllowlist([ALICE_EMAIL, 'carol@example.com']);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), 'allowlist', 'carol@example.com'))
    );
  });

  it('non-allowlisted user cannot read any allowlist doc', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(
      getDoc(doc(ctx.firestore(), 'allowlist', ALICE_EMAIL))
    );
  });

  it('admin can create an allowlist doc via carve-out', async () => {
    const ctx = env.authenticatedContext(adminAuth.uid, {
      email: ADMIN_EMAIL,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'allowlist', BOB_EMAIL), {})
    );
  });

  it('allowlisted user can create a new allowlist doc', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'allowlist', BOB_EMAIL), {})
    );
  });

  it('non-allowlisted user cannot create an allowlist doc', async () => {
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'allowlist', OUTSIDER_EMAIL), {})
    );
  });

  it('admin can delete an allowlist doc', async () => {
    await seedAllowlist([BOB_EMAIL]);
    const ctx = env.authenticatedContext(adminAuth.uid, {
      email: ADMIN_EMAIL,
    });
    await assertSucceeds(
      deleteDoc(doc(ctx.firestore(), 'allowlist', BOB_EMAIL))
    );
  });

  it('non-admin cannot delete an allowlist doc', async () => {
    await seedAllowlist([BOB_EMAIL]);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      deleteDoc(doc(ctx.firestore(), 'allowlist', BOB_EMAIL))
    );
  });
});
