// Entries module — single boundary between screens/hooks and Firestore
// for the Entry doc shape (PRD §5.3).
//
// Per AGENTS guardrails (mirroring the cars-module posture):
//   - All Entry writes go through these helpers. No inline
//     addDoc(collection(firestore, 'cars', carId, 'entries'), ...) calls
//     anywhere else.
//   - `loggedAt` is always serverTimestamp() at this boundary; never a
//     client clock. PRD §5.3 + AGENTS.
//   - This module does NOT import from ../cars to avoid a circular
//     dependency (cars.ts imports deleteEntriesForCar for cascade).
//
// See dispatch/M4-entries.md §7.2 for shape rationale.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
// fbLimit is kept in scope for getLatestEntry (single-doc fetch);
// listEntriesForCar dropped its limit clause in M5 per PRD §8
// amendment (fetch all entries on car; no arbitrary cap).
import { firestore } from '../firebase/firestore';

export interface Entry {
  id: string;
  loggedByUid: string;
  odometer: number;
  gallons: number;
  cost: number;
  loggedAt: Timestamp | null;
}

interface EntryDocData {
  loggedByUid: string;
  odometer: number;
  gallons: number;
  cost: number;
  loggedAt: Timestamp | null;
}

function toEntry(id: string, data: EntryDocData): Entry {
  return {
    id,
    loggedByUid: data.loggedByUid,
    odometer: data.odometer,
    gallons: data.gallons,
    cost: data.cost,
    loggedAt: data.loggedAt ?? null,
  };
}

export async function createEntry(
  carId: string,
  data: { odometer: number; gallons: number; cost: number },
  loggedByUid: string
): Promise<string> {
  const ref = await addDoc(
    collection(firestore, 'cars', carId, 'entries'),
    {
      loggedByUid,
      odometer: data.odometer,
      gallons: data.gallons,
      cost: data.cost,
      loggedAt: serverTimestamp(), // AGENTS: never client clock
    }
  );
  return ref.id;
}

export async function updateEntry(
  carId: string,
  entryId: string,
  fields: { odometer: number; gallons: number; cost: number }
): Promise<void> {
  // Edit path (edit-delete-entries dispatch). Writes ONLY the three
  // numeric fields — never loggedByUid, never loggedAt. Both stay
  // immutable: loggedByUid by authorship, loggedAt by the AGENTS
  // "always serverTimestamp" guardrail. The entries `update` rule's
  // hasOnly(['odometer','gallons','cost']) enforces this server-side;
  // this client write matches exactly so the diff's affectedKeys is
  // always exactly those three keys.
  await updateDoc(doc(firestore, 'cars', carId, 'entries', entryId), {
    odometer: fields.odometer,
    gallons: fields.gallons,
    cost: fields.cost,
  });
}

export async function deleteEntry(
  carId: string,
  entryId: string
): Promise<void> {
  // Single-entry delete (edit-delete-entries dispatch). Distinct from
  // deleteEntriesForCar, which cascades the whole subcollection on
  // car-delete. Behind a ConfirmDialog at the UI layer; the rule
  // permits parent-car owner or the original logger (canMutate()).
  await deleteDoc(doc(firestore, 'cars', carId, 'entries', entryId));
}

export async function getLatestEntry(carId: string): Promise<Entry | null> {
  // Single-query fetch of the most-recent entry on a car — used by the
  // log form for the odometer monotonicity check (PRD §7 Flow C edge
  // case). PRD §8 amendment 2026-05-28 accounts for this 1-read cost.
  //
  // No runtime validation: rules enforce shape on create. A hand-edited
  // doc with missing fields would silently skip the warning; acceptable
  // at family scale where Firestore Console edits are rare.
  const q = query(
    collection(firestore, 'cars', carId, 'entries'),
    orderBy('loggedAt', 'desc'),
    fbLimit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toEntry(d.id, d.data() as EntryDocData);
}

export async function listEntriesForCar(carId: string): Promise<Entry[]> {
  // Per-car entries fetch — single read path for the per-car detail
  // surface (M5 useEntries hook). Order: most-recent first.
  //
  // No `limit` cap (M5 PRD §8 amendment 2026-05-28): the original v1
  // PRD capped at latest-50; owner decision during M5 was to drop the
  // cap. Family scale (~30 entries/car/year) keeps the read budget
  // comfortable; the aggregate-doc BACKLOG → Later item is the next
  // defense line if scale forces it. Skipping the cap also keeps the
  // lifetime-MPG number honest (avg-over-all-entries, not avg-over-
  // latest-50 which would silently drift as old entries aged out).
  const q = query(
    collection(firestore, 'cars', carId, 'entries'),
    orderBy('loggedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toEntry(d.id, d.data() as EntryDocData));
}

export async function deleteEntriesForCar(carId: string): Promise<void> {
  // Cascade helper for deleteCar (per M3 Decision #6, implemented in
  // M4). Family scale: ~30 entries/car expected, so a single batch
  // suffices. Chunk defensively in case a car ever grows past
  // Firestore's 500-write batch limit.
  const snap = await getDocs(
    collection(firestore, 'cars', carId, 'entries')
  );
  if (snap.empty) return;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(firestore);
    docs.slice(i, i + 500).forEach((d) => {
      batch.delete(doc(firestore, 'cars', carId, 'entries', d.id));
    });
    await batch.commit();
  }
}

