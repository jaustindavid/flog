// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

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

describe('cars/{carId}/entries/{entryId} rules — PRD §6.3', () => {
  it('parent-car owner can read entries', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'))
    );
  });

  it('parent-car sharee can read entries', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'))
    );
  });

  it('outsider cannot read entries', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      getDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'))
    );
  });

  it('owner can create entry with loggedByUid = self', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: ALICE_UID,
        odometer: 100,
        gallons: 10,
        cost: 30,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('sharee can create entry with loggedByUid = self', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: BOB_UID,
        odometer: 100,
        gallons: 10,
        cost: 30,
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
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: ALICE_UID,
        odometer: 100,
        gallons: 10,
        cost: 30,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('outsider cannot create entry', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: outsiderAuth.uid,
        odometer: 100,
        gallons: 10,
        cost: 30,
        loggedAt: serverTimestamp(),
      })
    );
  });

  // edit-delete-entries dispatch 2026-05-29: entries `update`
  // relaxed from `if false` to canMutate() + hasOnly(['odometer',
  // 'gallons','cost']). Positive cases write the full three-field
  // object — exactly what updateEntry() sends — not a single key.

  it('owner can update an entry (writes the three fields)', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        odometer: 150,
        gallons: 11,
        cost: 33,
      })
    );
  });

  it('owner can update an entry logged by a sharee', async () => {
    // Owner may edit ANY entry on their car, not just their own.
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: BOB_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        odometer: 150,
        gallons: 11,
        cost: 33,
      })
    );
  });

  it('logger-sharee can update their own entry (writes three)', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: BOB_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        odometer: 150,
        gallons: 11,
        cost: 33,
      })
    );
  });

  it('sharee cannot update another user’s entry', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        odometer: 150,
        gallons: 11,
        cost: 33,
      })
    );
  });

  it('outsider cannot update an entry', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        odometer: 150,
        gallons: 11,
        cost: 33,
      })
    );
  });

  it('update that also changes loggedByUid is denied (hasOnly)', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        odometer: 150,
        gallons: 11,
        cost: 33,
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
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        odometer: 150,
        gallons: 11,
        cost: 33,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('rule-property: a single-key {cost} update succeeds (hasOnly subset)', async () => {
    // This documents the rule-level property that hasOnly() permits a
    // SUBSET of the three fields. The app never exercises this path —
    // updateEntry() always writes all three. Kept as a rule-semantics
    // guard, not a model of app behavior.
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        cost: 99,
      })
    );
  });

  it('owner can delete an entry', async () => {
    // M4: parent-car owner gets delete via the relaxed rule, so the
    // cascade in src/cars/cars.ts deleteCar can clean up entries
    // before deleting the Car doc. edit-delete-entries dispatch keeps
    // this green under the broader canMutate() rule (owner branch).
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(aliceAuth.uid, {
      email: aliceAuth.email,
    });
    await assertSucceeds(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'))
    );
  });

  it('logger-sharee can delete their own entry', async () => {
    // edit-delete-entries dispatch 2026-05-29: a sharee with current
    // read access may delete an entry they logged.
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: BOB_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertSucceeds(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'))
    );
  });

  it('sharee cannot delete another user’s entry', async () => {
    // Entry logged by the owner (ALICE); the sharee (BOB) cannot
    // delete it — canMutate()'s logger branch checks loggedByUid.
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [BOB_EMAIL],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(bobAuth.uid, {
      email: bobAuth.email,
    });
    await assertFails(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'))
    );
  });

  it('outsider cannot delete an entry', async () => {
    await seedCar('car-1', {
      name: 'Minivan',
      ownerUid: ALICE_UID,
      shareeEmails: [],
    });
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
    });
    const ctx = env.authenticatedContext(outsiderAuth.uid, {
      email: outsiderAuth.email,
    });
    await assertFails(
      deleteDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'))
    );
  });
});

describe('entries — field/shape validation (P1 hardening 2026-05-29)', () => {
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
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: ALICE_UID,
        odometer: 100,
        gallons: 10,
        cost: 30,
        loggedAt: serverTimestamp(),
        note: 'sneaky extra field',
      })
    );
  });

  it('create with a non-numeric odometer is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: ALICE_UID,
        odometer: 'lots',
        gallons: 10,
        cost: 30,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with negative gallons is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: ALICE_UID,
        odometer: 100,
        gallons: -5,
        cost: 30,
        loggedAt: serverTimestamp(),
      })
    );
  });

  it('create with a forged (client-clock) loggedAt is denied', async () => {
    // The entry list orders by loggedAt; a forged timestamp would
    // reorder fills and silently corrupt every reader's computed MPG.
    // Rule requires loggedAt == request.time (i.e. serverTimestamp()).
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: ALICE_UID,
        odometer: 100,
        gallons: 10,
        cost: 30,
        loggedAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
      })
    );
  });

  it('create with no loggedAt is denied', async () => {
    const ctx = await setupCar();
    await assertFails(
      setDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        loggedByUid: ALICE_UID,
        odometer: 100,
        gallons: 10,
        cost: 30,
      })
    );
  });

  it('update writing a non-numeric cost is denied', async () => {
    const ctx = await setupCar();
    await seedEntry('car-1', 'e1', {
      loggedByUid: ALICE_UID,
      odometer: 100,
      gallons: 10,
      cost: 30,
      loggedAt: serverTimestamp(),
    });
    await assertFails(
      updateDoc(doc(ctx.firestore(), 'cars', 'car-1', 'entries', 'e1'), {
        cost: 'free',
      })
    );
  });
});
