// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0
//
// import-history.mjs — one-time backfill of historical fuel fill-ups
// from the legacy Google Form CSV export into flog's Firestore.
//
// This is an OPS script, not app code. It uses the Firebase Admin SDK
// (service-account credentials), which bypasses security rules — so it
// writes historical `loggedAt` timestamps directly (no rules/PRD change
// needed) and can resolve `email → uid` for attribution.
//
// USAGE
//   node scripts/import-history.mjs \
//     --key   service-account-dev.json \
//     --map   scripts/car-map.dev.local.json \
//     --csv   "Fuel Log - Form Responses 1.csv" \
//     [--admin-email austindavid@gmail.com] \
//     [--dry-run]
//
//   --dry-run prints exactly what WOULD be written (per-car counts,
//   email→uid resolutions + fallbacks, skip reasons) and writes
//   NOTHING. Always dry-run first, eyeball, then run for real.
//
// MAP FILE (gitignored *.local.json): source "Which Car?" string →
// destination Firestore car doc ID. Only cars present in the map are
// imported; every other source car is skipped.
//   { "Seven: 2021 Caterham Seven 360S": "zIuteJQRhmYTEDHeN0jU", ... }
//
// BEHAVIOR
//   - Skips maintenance rows (blank gallons — not a fuel entry).
//   - Skips rows whose car is not in the map.
//   - Gallons kept at full precision; cost as-is; odometer as integer.
//   - loggedAt = the row's form timestamp parsed as LOCAL time.
//   - loggedByUid resolved from the row's email via getUserByEmail,
//     cached; falls back to the admin uid (with a warning) if a logger
//     hasn't signed in / can't be resolved.
//   - Deterministic doc IDs (`imp_<loggedAtMillis>_<odometer>`) so a
//     re-run upserts the same docs rather than creating duplicates.
//   - The written doc shape is identical to an app-created entry
//     (loggedByUid, odometer, gallons, cost, loggedAt) — no marker
//     field, nothing the app doesn't already read.

import { readFileSync } from 'node:fs';
import { argv } from 'node:process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ---- args --------------------------------------------------------------

function arg(name, fallback = undefined) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  // boolean flag (next token is another flag or absent)
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) return true;
  return next;
}

const KEY_PATH = arg('key', 'service-account-dev.json');
const MAP_PATH = arg('map', 'scripts/car-map.dev.local.json');
const CSV_PATH = arg('csv', 'Fuel Log - Form Responses 1.csv');
const ADMIN_EMAIL = arg('admin-email', 'austindavid@gmail.com');
const DRY_RUN = arg('dry-run', false) === true;

// ---- CSV parsing (quote-aware) -----------------------------------------

// Minimal RFC-4180-ish parser: handles quoted fields, embedded commas,
// embedded newlines, and "" escapes. Returns array of row-arrays.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // ignore; \n handles the row break
    } else field += c;
  }
  // last field/row (if file doesn't end in newline)
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// "5/1/2023 12:10:22" (M/D/YYYY H:MM:SS) → Date in LOCAL time.
function parseLocalTimestamp(s) {
  const m = s.trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
  );
  if (!m) return null;
  const [, mo, d, y, h, mi, se] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, se); // local time
}

// ---- main --------------------------------------------------------------

async function main() {
  const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  const carMap = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
  const csvText = readFileSync(CSV_PATH, 'utf8');

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const auth = getAuth();

  console.log(
    `\nflog history import — project: ${serviceAccount.project_id}` +
    `${DRY_RUN ? '  [DRY RUN — no writes]' : '  [LIVE — will write]'}`
  );
  console.log(`map: ${Object.keys(carMap).length} car(s) → ${MAP_PATH}\n`);

  // Resolve email → uid (cached). Fallback to admin uid.
  let adminUid;
  try {
    adminUid = (await auth.getUserByEmail(ADMIN_EMAIL)).uid;
  } catch {
    console.error(
      `FATAL: admin email ${ADMIN_EMAIL} has no Firebase Auth user ` +
      `(has the admin signed in to this project?). Cannot set a ` +
      `fallback attribution. Aborting.`
    );
    process.exit(1);
  }
  const uidCache = new Map([[ADMIN_EMAIL, adminUid]]);
  const fellBack = new Set();
  async function resolveUid(email) {
    const key = email.trim().toLowerCase();
    if (uidCache.has(key)) return uidCache.get(key);
    let uid;
    try {
      uid = (await auth.getUserByEmail(key)).uid;
    } catch {
      uid = adminUid;
      fellBack.add(key);
    }
    uidCache.set(key, uid);
    return uid;
  }

  const rows = parseCsv(csvText);
  const header = rows.shift(); // discard header row
  void header;

  const perCar = {};       // destDocId → { name, count }
  const perLogger = {};    // email → count
  let skippedMaintenance = 0;
  let skippedUnmapped = 0;
  let skippedInvalid = 0;
  const writes = [];       // { destDocId, docId, data }

  for (const r of rows) {
    if (r.length < 6) continue;             // blank/short line
    const [ts, email, car, odoRaw, galRaw, costRaw] = r;
    if (!ts || !ts.trim()) continue;        // trailing blank line

    const destDocId = carMap[car];
    if (!destDocId) { skippedUnmapped++; continue; }

    if (!galRaw || galRaw.trim() === '') {  // maintenance row
      skippedMaintenance++; continue;
    }

    const odometer = Number(odoRaw);
    const gallons = Number(galRaw);
    const cost = Number(costRaw);
    const when = parseLocalTimestamp(ts);
    if (
      !Number.isInteger(odometer) || odometer < 0 ||
      !Number.isFinite(gallons) || gallons <= 0 ||
      !Number.isFinite(cost) || cost < 0 ||
      when === null
    ) {
      skippedInvalid++;
      console.warn(`  skip (invalid): ${ts} | ${car} | odo=${odoRaw} gal=${galRaw} cost=${costRaw}`);
      continue;
    }

    const loggedByUid = await resolveUid(email);
    const millis = when.getTime();
    const docId = `imp_${millis}_${odometer}`;
    writes.push({
      destDocId,
      docId,
      data: {
        loggedByUid,
        odometer,
        gallons,
        cost,
        loggedAt: Timestamp.fromMillis(millis),
      },
    });

    perCar[destDocId] = perCar[destDocId] || { name: car, count: 0 };
    perCar[destDocId].count++;
    perLogger[email.trim().toLowerCase()] =
      (perLogger[email.trim().toLowerCase()] || 0) + 1;
  }

  // ---- report ----
  console.log('Per car:');
  for (const [docId, { name, count }] of Object.entries(perCar)) {
    console.log(`  ${count.toString().padStart(4)}  ${name}  → ${docId}`);
  }
  console.log('\nPer logger (→ uid):');
  for (const [email, count] of Object.entries(perLogger)) {
    const uid = uidCache.get(email);
    const note = fellBack.has(email) ? '  ⚠️ FELL BACK to admin (not resolvable)' : '';
    console.log(`  ${count.toString().padStart(4)}  ${email} → ${uid}${note}`);
  }
  console.log('\nSkipped:');
  console.log(`  maintenance (blank gallons): ${skippedMaintenance}`);
  console.log(`  unmapped car:                ${skippedUnmapped}`);
  console.log(`  invalid row:                 ${skippedInvalid}`);
  console.log(`\nTotal to write: ${writes.length}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes performed. Re-run without --dry-run to commit.\n');
    return;
  }

  // ---- write (batched, ≤500 per batch) ----
  let written = 0;
  for (let i = 0; i < writes.length; i += 500) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 500)) {
      const ref = db
        .collection('cars').doc(w.destDocId)
        .collection('entries').doc(w.docId);
      batch.set(ref, w.data); // deterministic id → idempotent upsert
    }
    await batch.commit();
    written += Math.min(500, writes.length - i);
  }
  console.log(`\n✅ Wrote ${written} entries.\n`);
}

main().catch((err) => {
  console.error('\nImport failed:', err);
  process.exit(1);
});
