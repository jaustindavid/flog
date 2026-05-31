// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Maintenance module — single boundary between screens/hooks and
// Firestore for the Maintenance doc shape (PRD §14.1). A SEPARATE
// subcollection from fuel `entries` (cars/{carId}/maintenance/{maintId})
// so the MPG/stat pipeline and the P1 entry-validation rules stay pure
// (PRD §14 intro, maintenance-phase-1 §4 #1).
//
// Mirrors the entries-module posture (entries.ts):
//   - All Maintenance writes go through these helpers. No inline
//     addDoc(collection(firestore, 'cars', carId, 'maintenance'), ...)
//     anywhere else (AGENTS: one write path per entity).
//   - `loggedAt` is always serverTimestamp() at this boundary; never a
//     client clock (audit trail).
//   - `date` is the USER-SET service date — a concrete Timestamp the
//     caller builds from the date input (see dateField.ts). It is NOT a
//     server sentinel and IS backdatable (PRD §14.1 / maintenance-
//     phase-1 §4 #4); listing orders by it.
//   - `resetsReminder` is written `false` on every Phase-1 create; no
//     UI exposes it yet. Phase 3 lights it up (the editable set already
//     includes it so the future checkbox needs no rules change).
//   - This module does NOT import from ../cars to avoid a circular
//     dependency (cars.ts imports deleteMaintenanceForCar for cascade) —
//     same acyclic direction as entries.ts.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase/firestore';

export interface Maintenance {
  id: string;
  loggedByUid: string;
  // Service date (user-set, backdatable). `| null` exists ONLY for the
  // read mapping's defensive coalescing of a hand-edited bad doc —
  // mirroring toEntry's loggedAt. Writes always send a concrete
  // Timestamp (SF2); a null `date` would be denied by the rule's
  // `date is timestamp` check.
  date: Timestamp | null;
  odometer: number;
  cost: number;
  note: string;
  // Phase 3; always false in Phase 1 writes (no UI). PRD §14.3.
  resetsReminder: boolean;
  // Server-set audit timestamp (never user-editable).
  loggedAt: Timestamp | null;
}

interface MaintenanceDocData {
  loggedByUid: string;
  date: Timestamp | null;
  odometer: number;
  cost: number;
  note: string;
  resetsReminder: boolean;
  loggedAt: Timestamp | null;
}

function toMaintenance(id: string, data: MaintenanceDocData): Maintenance {
  return {
    id,
    loggedByUid: data.loggedByUid,
    date: data.date ?? null,
    odometer: data.odometer,
    cost: data.cost,
    note: data.note,
    // Defensive: a hand-edited legacy doc with no resetsReminder
    // coalesces to false (the Phase-1 default), never undefined.
    resetsReminder: data.resetsReminder ?? false,
    loggedAt: data.loggedAt ?? null,
  };
}

export async function createMaintenance(
  carId: string,
  // `date` is a concrete Timestamp the caller built from the date
  // input (dateField.dateInputToTimestamp), NOT a sentinel — SF2.
  data: { date: Timestamp; odometer: number; cost: number; note: string },
  loggedByUid: string,
  // Phase 3 (S4): OPTIONAL, defaults false. The banner-tap opens the
  // modal in CREATE mode, so create must be able to set the reset flag
  // (it baselines the reminder). Defaulting false preserves every
  // existing caller that omits it. The create rule already permits the
  // field (Phase 1 pinned it into the field set), so this is purely the
  // client write path.
  resetsReminder = false
): Promise<string> {
  const ref = await addDoc(
    collection(firestore, 'cars', carId, 'maintenance'),
    {
      loggedByUid,
      date: data.date,
      odometer: data.odometer,
      cost: data.cost,
      note: data.note,
      resetsReminder,
      loggedAt: serverTimestamp(), // never a client clock (audit)
    }
  );
  return ref.id;
}

export async function updateMaintenance(
  carId: string,
  maintId: string,
  // Writes these five fields — never loggedByUid / loggedAt. The
  // maintenance `update` rule's hasOnly guard makes loggedByUid +
  // loggedAt immutable; resetsReminder is IN the rule's editable set
  // (already permitted since Phase 1) and Phase 3's modal now sends it,
  // so the diff's affectedKeys is exactly these five.
  fields: {
    date: Timestamp;
    odometer: number;
    cost: number;
    note: string;
    resetsReminder: boolean;
  }
): Promise<void> {
  await updateDoc(doc(firestore, 'cars', carId, 'maintenance', maintId), {
    date: fields.date,
    odometer: fields.odometer,
    cost: fields.cost,
    note: fields.note,
    resetsReminder: fields.resetsReminder,
  });
}

export async function deleteMaintenance(
  carId: string,
  maintId: string
): Promise<void> {
  // Single-doc delete (behind a ConfirmDialog at the UI layer). Distinct
  // from deleteMaintenanceForCar, which cascades the whole subcollection
  // on car-delete. The rule permits parent-car owner or the original
  // logger (canMutate()).
  await deleteDoc(doc(firestore, 'cars', carId, 'maintenance', maintId));
}

export async function listMaintenanceForCar(
  carId: string
): Promise<Maintenance[]> {
  // Per-car maintenance fetch — single read path for the car-detail
  // Maintenance section. No `limit` cap (family scale, mirroring the M5
  // entries decision).
  //
  // N1: order by `date` (the SERVICE date) is DELIBERATE — a maintenance
  // log reads by when the service happened, and `date` is backdatable.
  // Do NOT copy entries.ts's orderBy('loggedAt'). Same-day ties have
  // undefined relative order (local-midnight dates); fine for a log —
  // nothing depends on intra-day ordering.
  const q = query(
    collection(firestore, 'cars', carId, 'maintenance'),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toMaintenance(d.id, d.data() as MaintenanceDocData)
  );
}

export async function deleteMaintenanceForCar(carId: string): Promise<void> {
  // Cascade helper for deleteCar (maintenance-phase-1 §7.2). Mirrors
  // deleteEntriesForCar: chunk defensively in case a car ever grows
  // past Firestore's 500-write batch limit.
  const snap = await getDocs(
    collection(firestore, 'cars', carId, 'maintenance')
  );
  if (snap.empty) return;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(firestore);
    docs.slice(i, i + 500).forEach((d) => {
      batch.delete(
        doc(firestore, 'cars', carId, 'maintenance', d.id)
      );
    });
    await batch.commit();
  }
}
