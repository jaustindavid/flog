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

  it('owner cannot update an entry', async () => {
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
        cost: 99,
      })
    );
  });

  it('owner can delete an entry', async () => {
    // M4: parent-car owner gets delete via the relaxed rule, so the
    // cascade in src/cars/cars.ts deleteCar can clean up entries
    // before deleting the Car doc. Sharees still cannot delete (see
    // the next test).
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

  it('sharee cannot delete an entry', async () => {
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
