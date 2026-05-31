// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Maintenance rules tests (maintenance-phase-1 §8 AC R/T). Mirrors
// entries.test.ts: the authz matrix (owner / sharee / outsider ×
// read / create / update / delete) plus the P1 field-validation
// negatives (extra field, bad type, negative, missing/empty note,
// forged loggedAt, AND a non-bool resetsReminder update — SF1).
//
// Differences from entries: `date` is a user-set timestamp validated as
// `is timestamp` but NOT pinned to request.time (backdating is allowed —
// a positive case asserts a 2020 date is accepted). `resetsReminder` is
// written false on create and is in the editable update set.
//
// The helper-lift (§7.4) is covered transitively: these tests pass only
// if the lifted parentCar()/canReadParent()/canMutate() resolve
// correctly for the maintenance subcollection, AND entries.test.ts /
// cars.test.ts / users.test.ts / allowlist.test.ts must STILL pass
// unchanged (run the whole suite).

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  aliceAuth,
  ALICE_UID,
  bobAuth,
  BOB_EMAIL,
  BOB_UID,
  createTestEnv,
  outsiderAuth,
} from './helpers';

let env: RulesTestEnvironment;

// A concrete, backdated service date. The rule accepts any timestamp
// for `date` (NOT request.time), so this is a valid create value.
const SERVICE_DATE = Timestamp.fromDate(new Date(2024, 5, 15)); // local
const BACKDATED = Timestamp.fromDate(new Date(2020, 0, 1)); // year boundary

beforeAll(async () => {
  env = await createTestEnv();
});

afterEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

async function seedCar(carId: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'cars', carId), data);
  });
}

async function seedMaint(
  carId: string,
  maintId: string,
  data: Record<string, unknown>
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'cars', carId, 'maintenance', maintId),
      data
    );
  });
}

// A fully-valid seed doc (rules disabled — used as the prior state for
// update/delete/read tests).
function validSeedDoc(loggedByUid: string): Record<string, unknown> {
  return {
    loggedByUid,
    date: SERVICE_DATE,
    odometer: 50000,
    cost: 79.99,
    note: 'Oil change + filter',
    resetsReminder: false,
    loggedAt: SERVICE_DATE,
  };
}

describe('cars/{carId}/maintenance/{maintId} rules — authz matrix', () => {
  it('parent-car owner can read maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'))
    );
  });

  it('parent-car sharee can read maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'))
    );
  });

  it('outsider cannot read maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      getDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'))
    );
  });

  it('owner can create maintenance with loggedByUid = self', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: 'Oil change',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('sharee can create maintenance with loggedByUid = self', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: BOB_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: 'Brakes',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with a BACKDATED date is accepted (date != request.time)', async () => {
    // The whole point of `date` being user-set: a 2020 service date on a
    // doc created today must succeed (entries would reject a non-
    // request.time loggedAt; maintenance must NOT).
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: BACKDATED,
        odometer: 50000,
        cost: 79.99,
        note: 'Old registration',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with loggedByUid != auth.uid is denied', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: 'Oil change',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('outsider cannot create maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: outsiderAuth.uid,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: 'Oil change',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  // Update positive cases write the four editable fields — exactly what
  // updateMaintenance() sends.
  it('owner can update maintenance (writes the four fields)', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        date: BACKDATED,
        odometer: 50100,
        cost: 88.5,
        note: 'Oil change (corrected)',
      })
    );
  });

  it('owner can update maintenance logged by a sharee', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(BOB_UID));
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        date: SERVICE_DATE,
        odometer: 50100,
        cost: 88.5,
        note: 'Edited by owner',
      })
    );
  });

  it('logger-sharee can update their own maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(BOB_UID));
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        date: SERVICE_DATE,
        odometer: 50100,
        cost: 88.5,
        note: 'Fixed my typo',
      })
    );
  });

  it('sharee cannot update another user’s maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        date: SERVICE_DATE,
        odometer: 50100,
        cost: 88.5,
        note: 'Not mine',
      })
    );
  });

  it('outsider cannot update maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        date: SERVICE_DATE,
        odometer: 50100,
        cost: 88.5,
        note: 'Outsider',
      })
    );
  });

  it('update that also changes loggedByUid is denied (hasOnly)', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        date: SERVICE_DATE,
        odometer: 50100,
        cost: 88.5,
        note: 'Oil',
        loggedByUid: BOB_UID,
      })
    );
  });

  it('update that also changes loggedAt is denied (hasOnly)', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        date: SERVICE_DATE,
        odometer: 50100,
        cost: 88.5,
        note: 'Oil',
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('owner can delete maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'))
    );
  });

  it('logger-sharee can delete their own maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(BOB_UID));
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'))
    );
  });

  it('sharee cannot delete another user’s maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'))
    );
  });

  it('outsider cannot delete maintenance', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'))
    );
  });
});

describe('maintenance — field/shape validation', () => {
  async function setupCar() {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    return env.authenticatedContext(aliceAuth.uid, { email: aliceAuth.email });
  }

  it('create with an extra field is denied (hasOnly)', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: 'Oil',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
        sneaky: 'extra',
      })
    );
  });

  it('create with a non-numeric odometer is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 'lots',
        cost: 79.99,
        note: 'Oil',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with negative cost is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: -5,
        note: 'Oil',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with a non-timestamp date is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: '2024-06-15',
        odometer: 50000,
        cost: 79.99,
        note: 'Oil',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with an empty note is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: '',
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with a missing note is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        resetsReminder: false,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with a non-bool resetsReminder is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: 'Oil',
        resetsReminder: 'yes',
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with a forged (client-clock) loggedAt is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: 'Oil',
        resetsReminder: false,
        loggedAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
      })
    );
  });

  it('create with no loggedAt is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        loggedByUid: ALICE_UID,
        date: SERVICE_DATE,
        odometer: 50000,
        cost: 79.99,
        note: 'Oil',
        resetsReminder: false,
      })
    );
  });

  it('update writing a non-numeric cost is denied', async () => {
    const ctx = await setupCar();
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        cost: 'free',
      })
    );
  });

  it('update writing an empty note is denied', async () => {
    const ctx = await setupCar();
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        note: '',
      })
    );
  });

  it('update writing a non-bool resetsReminder is denied (SF1)', async () => {
    // resetsReminder is in the editable set (Phase 3) and the update
    // rule re-validates `is bool`. A non-bool must be rejected even
    // though Phase 1's modal never sends it.
    const ctx = await setupCar();
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        resetsReminder: 'yes',
      })
    );
  });

  it('update flipping resetsReminder to a bool is allowed (Phase 3 path)', async () => {
    // The rule must permit a future checkbox to flip resetsReminder
    // without a rules change. Documents the rule property; Phase 1 never
    // exercises it.
    const ctx = await setupCar();
    await seedMaint('car-1', 'm1', validSeedDoc(ALICE_UID));
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'maintenance', 'm1'), {
        resetsReminder: true,
      })
    );
  });
});
