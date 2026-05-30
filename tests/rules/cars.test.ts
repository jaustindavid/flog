// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  adminAuth,
  ADMIN_EMAIL,
  aliceAuth,
  ALICE_EMAIL,
  ALICE_UID,
  bobAuth,
  BOB_EMAIL,
  BOB_UID,
  createTestEnv,
  OUTSIDER_EMAIL,
  outsiderAuth,
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

async function seedCar(carId: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'cars', carId), data);
  });
}

describe('cars/{carId} rules — PRD §6.2', () => {
  it('allowlisted user can create a car with ownerUid = self', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Minivan',
        ownerUid: ALICE_UID,
        shareeEmails: [],
        createdAt: serverTimestamp(),
      })
    );
  });

  it('user cannot create a car with ownerUid = other', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Minivan',
        ownerUid: BOB_UID,
        shareeEmails: [],
        createdAt: serverTimestamp(),
      })
    );
  });

  it('non-allowlisted user cannot create a car', async () => {
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Sedan',
        ownerUid: outsiderAuth.uid,
        shareeEmails: [],
        createdAt: serverTimestamp(),
      })
    );
  });

  it('admin can create a car via carve-out (no allowlist doc needed)', async () => {
    const ctx = env.authenticatedContext(adminAuth.uid, {
      email: ADMIN_EMAIL,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'cars', 'car-admin'), {
        name: 'Admin Car',
        ownerUid: adminAuth.uid,
        shareeEmails: [],
        createdAt: serverTimestamp(),
      })
    );
  });

  it('owner can read own car', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'cars', 'car-1')));
  });

  it('sharee can read shared car', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'cars', 'car-1')));
  });

  it('outsider cannot read car', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(getDoc(doc(ctx.firestore(), 'cars', 'car-1')));
  });

  it('owner can update name and shareeEmails', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Big Minivan',
        shareeEmails: [BOB_EMAIL],
      })
    );
  });

  it('owner cannot mutate ownerUid', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        ownerUid: BOB_UID,
      })
    );
  });

  it('sharee cannot update car', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Bob Renamed It',
      })
    );
  });

  it('owner can delete own car', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(deleteDoc(doc(ctx.firestore(), 'cars', 'car-1')));
  });

  it('sharee cannot delete car', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(deleteDoc(doc(ctx.firestore(), 'cars', 'car-1')));
  });
});

describe('shareCar batched write — M3 atomicity (Decision #16)', () => {
  // These tests mirror the shape of src/cars/cars.ts shareCar(): a
  // single writeBatch containing the Car update (arrayUnion) and —
  // when the allowlist doc doesn't pre-exist — a set on
  // allowlist/{email}. Atomicity contract: both writes succeed or
  // neither does, with no orphaned allowlist doc on failure.

  it('positive — first-time share commits both writes when owner is allowlisted', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    const batch = writeBatch(ctx.firestore());
    batch.update(doc(ctx.firestore(), 'cars', 'car-1'), {
      shareeEmails: arrayUnion(BOB_EMAIL),
    });
    batch.set(doc(ctx.firestore(), 'allowlist', BOB_EMAIL), {});
    await assertSucceeds(batch.commit());

    // Verify post-state: both writes landed.
    await env.withSecurityRulesDisabled(async (sctx) => {
      const carSnap = await getDoc(doc(sctx.firestore(), 'cars', 'car-1'));
      expect(carSnap.data()?.shareeEmails).toContain(BOB_EMAIL);
      const allowSnap = await getDoc(
        doc(sctx.firestore(), 'allowlist', BOB_EMAIL)
      );
      expect(allowSnap.exists()).toBe(true);
    });
  });

  it('positive — second share to already-allowlisted email commits the car-only batch', async () => {
    // shareCar's pre-read finds allowlist/{email} existing → batch
    // omits the allowlist set. Verify the car-update-only batch is
    // accepted by rules.
    await seedAllowlist([ALICE_EMAIL, BOB_EMAIL]);
    await seedCar('car-2', {
      name: 'Sedan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    const batch = writeBatch(ctx.firestore());
    batch.update(doc(ctx.firestore(), 'cars', 'car-2'), {
      shareeEmails: arrayUnion(BOB_EMAIL),
    });
    // No allowlist set in this batch — Bob is already on the allowlist.
    await assertSucceeds(batch.commit());

    await env.withSecurityRulesDisabled(async (sctx) => {
      const carSnap = await getDoc(doc(sctx.firestore(), 'cars', 'car-2'));
      expect(carSnap.data()?.shareeEmails).toContain(BOB_EMAIL);
    });
  });

  async function seedAllowlist(emails: string[]) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const email of emails) {
        await setDoc(doc(ctx.firestore(), 'allowlist', email), {});
      }
    });
  }

  it('negative — sharee (not owner) cannot share via batched write; allowlist doc NOT created on failure', async () => {
    // Atomicity proof: Bob is a sharee of car-A (so he IS
    // allowlisted), but he is NOT the owner. He attempts a batched
    // shareCar-shaped write that would otherwise succeed if the two
    // operations were evaluated independently:
    //   - allowlist.set(OUTSIDER_EMAIL) — passes standalone (Bob is
    //     allowlisted; rule R4 lets any allowlisted user create new
    //     allowlist docs).
    //   - cars/car-A.update(shareeEmails) — fails standalone (Bob is
    //     not the owner; rule R2 update denies).
    // The whole batch must be denied. Post-state: allowlist doc for
    // OUTSIDER_EMAIL must NOT exist.
    await seedAllowlist([ALICE_EMAIL, BOB_EMAIL]);
    await seedCar('car-A', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    const batch = writeBatch(ctx.firestore());
    batch.update(doc(ctx.firestore(), 'cars', 'car-A'), {
      shareeEmails: arrayUnion(OUTSIDER_EMAIL),
    });
    batch.set(doc(ctx.firestore(), 'allowlist', OUTSIDER_EMAIL), {});
    await assertFails(batch.commit());

    await env.withSecurityRulesDisabled(async (sctx) => {
      const allowSnap = await getDoc(
        doc(sctx.firestore(), 'allowlist', OUTSIDER_EMAIL)
      );
      expect(allowSnap.exists()).toBe(false);
      const carSnap = await getDoc(doc(sctx.firestore(), 'cars', 'car-A'));
      // shareeEmails should still be [BOB_EMAIL] — the update was
      // rejected as part of the failed batch.
      expect(carSnap.data()?.shareeEmails).toEqual([BOB_EMAIL]);
    });
  });
});

describe('deleteCar cascade — M4 entries cleanup', () => {
  // Mirrors the sequence in src/cars/cars.ts deleteCar:
  //   1. getDocs(entries subcollection)
  //   2. writeBatch deleting each entry
  //   3. deleteDoc(car)
  // Reconstructed inline (vs. importing the helper) so the test is
  // self-contained against the rules layer and doesn't drag the
  // firebase-app client init into the rules-test process. Implementer
  // choice per dispatch §9 #8; flagged in handoff.

  async function seedEntry(
    carId: string,
    entryId: string,
    data: Record<string, unknown>
  ) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'cars', carId, 'entries', entryId),
        data
      );
    });
  }

  it('owner can cascade-delete entries then the car (positive)', async () => {
    await seedCar('car-cascade', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    for (let i = 1; i <= 3; i++) {
      await seedEntry('car-cascade', `e${i}`, {
        loggedByUid: ALICE_UID,
        odometer: 100 * i,
        gallons: 10,
        cost: 30,
        loggedAt: serverTimestamp(),
      });
    }

    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });

    // 1. Read entries subcollection (owner can read via parent rule).
    const entriesSnap = await getDocs(
      collection(ctx.firestore(), 'cars', 'car-cascade', 'entries')
    );
    expect(entriesSnap.size).toBe(3);

    // 2. Batch-delete entries.
    const batch = writeBatch(ctx.firestore());
    entriesSnap.forEach((d) => {
      batch.delete(
        doc(ctx.firestore(), 'cars', 'car-cascade', 'entries', d.id)
      );
    });
    await assertSucceeds(batch.commit());

    // 3. Delete the car.
    await assertSucceeds(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-cascade'))
    );

    // Verify post-state: car gone, entries gone.
    await env.withSecurityRulesDisabled(async (sctx) => {
      const carSnap = await getDoc(
        doc(sctx.firestore(), 'cars', 'car-cascade')
      );
      expect(carSnap.exists()).toBe(false);
      const remainingEntries = await getDocs(
        collection(sctx.firestore(), 'cars', 'car-cascade', 'entries')
      );
      expect(remainingEntries.empty).toBe(true);
    });
  });
});

describe('cars — field/shape validation (P1 hardening 2026-05-29)', () => {
  it('create with an extra field is denied (hasOnly)', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Minivan',
        ownerUid: ALICE_UID,
        shareeEmails: [],
        createdAt: serverTimestamp(),
        secret: 'sneaky',
      })
    );
  });

  it('create with a forged createdAt is denied', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Minivan',
        ownerUid: ALICE_UID,
        shareeEmails: [],
        createdAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
      })
    );
  });

  it('create with non-list shareeEmails is denied', async () => {
    await seedAllowlist([ALICE_EMAIL]);
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Minivan',
        ownerUid: ALICE_UID,
        shareeEmails: 'bob@example.com',
        createdAt: serverTimestamp(),
      })
    );
  });

  it('update adding a novel field is denied (hasOnly)', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1'), {
        name: 'Renamed',
        secret: 'sneaky',
      })
    );
  });
});