// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Cars module — single boundary between screens/hooks and Firestore
// for the Car doc shape (PRD §5.2).
//
// Per AGENTS "One Car update path": all Car writes go through these
// helpers. No inline updateDoc(doc(firestore, 'cars', ...)) elsewhere.
// Helpers assume *canonical* inputs (email lowercased via
// canonicalEmail; name pre-validated) — callers normalize at the
// boundary.
//
// Share-write atomicity (AGENTS guardrail + PRD §7 Flow E):
// shareCar reads allowlist/{email} first and then issues a single
// writeBatch that conditionally includes the allowlist set — M2's
// allowlist rule denies update (only create + delete), so blindly
// setting an existing allowlist doc would deny the whole batch.
// See dispatch/M3-cars.md Decision #16.

import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase/firestore';
import { deleteEntriesForCar } from '../entries/entries';
import { deleteMaintenanceForCar } from '../maintenance/maintenance';

export interface Car {
  id: string;
  name: string;
  ownerUid: string;
  shareeEmails: string[];
  createdAt: Timestamp | null;
}

interface CarDocData {
  name: string;
  ownerUid: string;
  shareeEmails: string[];
  createdAt: Timestamp | null;
}

function toCar(id: string, data: CarDocData): Car {
  return {
    id,
    name: data.name,
    ownerUid: data.ownerUid,
    shareeEmails: Array.isArray(data.shareeEmails) ? data.shareeEmails : [],
    createdAt: data.createdAt ?? null,
  };
}

function isFirebaseError(err: unknown): err is { code: string } {
  return (
    typeof err === 'object'
    && err !== null
    && 'code' in err
    && typeof (err as { code: unknown }).code === 'string'
  );
}

export async function createCar(
  name: string,
  ownerUid: string
): Promise<string> {
  const ref = doc(collection(firestore, 'cars'));
  await setDoc(ref, {
    name,
    ownerUid,
    shareeEmails: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameCar(carId: string, name: string): Promise<void> {
  await updateDoc(doc(firestore, 'cars', carId), { name });
}

export async function deleteCar(carId: string): Promise<void> {
  // Cascade per M3 Decision #6, implemented in M4 alongside the
  // entries-delete rule relaxation. maintenance-phase-1 §7.2 adds the
  // maintenance subcollection to the cascade so a car-delete leaves no
  // orphans in EITHER subcollection. Subcollections first, car last — a
  // partial failure (e.g. one batch commits, the next doesn't) leaves
  // the car still deletable on retry. Reversing the order would strand
  // orphaned docs under a deleted parent.
  await deleteEntriesForCar(carId);
  await deleteMaintenanceForCar(carId);
  await deleteDoc(doc(firestore, 'cars', carId));
}

export async function shareCar(carId: string, email: string): Promise<void> {
  // Atomicity contract (AGENTS): after this resolves, shareeEmails
  // contains the email AND allowlist/{email} exists.
  //
  // Pre-read allowlist to decide whether the batch includes a
  // batch.set on it. M2's allow update: if false on allowlist means
  // setting a pre-existing allowlist doc would deny the whole batch.
  // See Decision #16 in dispatch/M3-cars.md.
  const allowlistRef = doc(firestore, 'allowlist', email);
  const allowlistSnap = await getDoc(allowlistRef);

  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'cars', carId), {
    shareeEmails: arrayUnion(email),
  });
  if (!allowlistSnap.exists()) {
    batch.set(allowlistRef, {});
  }
  await batch.commit();
}

export async function unshareCar(
  carId: string,
  email: string
): Promise<void> {
  await updateDoc(doc(firestore, 'cars', carId), {
    shareeEmails: arrayRemove(email),
  });
  // Allowlist doc intentionally retained — PRD §5.4: sharee keeps
  // app access on own data after being un-shared.
}

export async function listMyCars(
  uid: string,
  email: string
): Promise<Car[]> {
  // Two parallel queries (Decision #4); deduped client-side. PRD §8
  // "1 query" is interpreted as "one combined fetch."
  const ownedQuery = query(
    collection(firestore, 'cars'),
    where('ownerUid', '==', uid)
  );
  // Empty email would return no rows by definition (an empty-string
  // sharee on a Car would also match, but no such Car is ever written —
  // see shareCar which only accepts canonical emails). Issue both
  // queries unconditionally for simplicity.
  const sharedQuery = email
    ? query(
        collection(firestore, 'cars'),
        where('shareeEmails', 'array-contains', email)
      )
    : null;

  const [ownedSnap, sharedSnap] = await Promise.all([
    getDocs(ownedQuery),
    sharedQuery ? getDocs(sharedQuery) : Promise.resolve(null),
  ]);

  const map = new Map<string, Car>();
  ownedSnap.forEach((d) => {
    map.set(d.id, toCar(d.id, d.data() as CarDocData));
  });
  if (sharedSnap) {
    sharedSnap.forEach((d) => {
      map.set(d.id, toCar(d.id, d.data() as CarDocData));
    });
  }
  return Array.from(map.values());
}

export async function getCar(carId: string): Promise<Car | null> {
  // Null on not-found OR permission-denied so the caller can render
  // a single "Car not found or no access" surface without
  // distinguishing the cases (PRD §7 Flow F + brief §7.6).
  try {
    const snap = await getDoc(doc(firestore, 'cars', carId));
    return snap.exists() ? toCar(snap.id, snap.data() as CarDocData) : null;
  } catch (err: unknown) {
    if (isFirebaseError(err) && err.code === 'permission-denied') {
      return null;
    }
    throw err;
  }
}
