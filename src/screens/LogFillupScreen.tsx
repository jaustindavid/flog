// LogFillupScreen — landing page (`/`) per M4 dispatch §3 + Decision #1.
//
// Family workflow: open app → see a form pre-selected to the car you
// last logged against → enter odometer/gallons/cost → tap Save → toast,
// form clears, MRU stays. PRD §7 Flow C.
//
// State machine for the underlying useCars() call:
//   - loading → small inline spinner (avoids a full-screen wipe when
//     the form mounts on every navigation)
//   - error   → "Couldn't load cars — try again" + Retry
//   - ready + zero cars → empty-state with link to /cars
//   - ready + ≥1 car  → log form
//
// MRU initialization uses the functional setState form so the effect
// can depend on `state` alone (no stale-closure on selectedCarId).
// See dispatch §7.7 for the race-correctness rationale.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useCars } from '../cars/useCars';
import { createEntry, getLatestEntry } from '../entries/entries';
import {
  avgLastNMpg,
  lastFillMpg,
  lifetimeMpg,
} from '../entries/computeMpg';
import { useEntries } from '../entries/useEntries';
import { validateCost } from '../entries/validateCost';
import { validateGallons } from '../entries/validateGallons';
import { validateOdometer } from '../entries/validateOdometer';
import { getMruCarId, setMruCarId } from '../lib/mru';
import { CarPickerChips } from '../components/CarPickerChips';
import { MpgTile } from '../components/MpgTile';
import { NumericField } from '../components/NumericField';
import { Toast, type ToastState } from '../components/Toast';

export function LogFillupScreen() {
  const { user } = useAuth();
  const { state, refresh } = useCars();
  const [selectedCarId, setSelectedCarId] = useState<string | null>(() =>
    getMruCarId()
  );
  // Entries fetch for the currently-selected car. When selectedCarId
  // is null (initial mount pre-MRU-effect), pass '' — Firestore rejects
  // empty-segment paths so the hook lands in {status: 'error'} and the
  // tile-row gate hides cleanly. Pattern matches M3 useCar(carId ?? '').
  const { state: entriesState, refresh: refreshEntries } = useEntries(
    selectedCarId ?? ''
  );
  const [odometer, setOdometer] = useState('');
  const [gallons, setGallons] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastNonce, setToastNonce] = useState(0);

  // Reconcile MRU against the loaded cars list. Functional setState
  // form keeps `selectedCarId` out of the dep array (would otherwise
  // re-fire whenever the user taps a chip, racing the user's pick).
  //
  // The react-hooks/set-state-in-effect rule (eslint-plugin-react-hooks
  // v7) flags any setState reachable from the effect body — see M3
  // brief §13 forward-feedback and the BACKLOG cleanup item. This is
  // the third project-wide suppression (after useCars + useCar). The
  // brief §7.7 committed to this exact race-correctness pattern;
  // stop-and-ask #12 says any cleaner alternative needs equivalent
  // correctness analysis, not a silent rewrite. Filed in the M4
  // handoff "Items deferred → BACKLOG" to promote the cleanup.
  useEffect(() => {
    if (state.status !== 'ready') return;
    const { cars } = state;
    if (cars.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCarId(null);
      return;
    }
    setSelectedCarId((prev) => {
      if (prev && cars.some((c) => c.id === prev)) return prev;
      return cars[0].id;
    });
  }, [state]);

  function pushToast(variant: ToastState['variant'], message: string) {
    const nonce = toastNonce + 1;
    setToastNonce(nonce);
    setToast({ variant, message, nonce });
  }

  const odoResult = validateOdometer(odometer);
  const gallonsResult = validateGallons(gallons);
  const costResult = validateCost(cost);

  // Show inline errors only after the user has typed something — empty
  // fields shouldn't shout at a freshly mounted form.
  const odoError = odometer.length > 0 && !odoResult.ok ? odoResult.reason ?? null : null;
  const gallonsError =
    gallons.length > 0 && !gallonsResult.ok ? gallonsResult.reason ?? null : null;
  const costError = cost.length > 0 && !costResult.ok ? costResult.reason ?? null : null;

  const canSave =
    !!selectedCarId
    && odoResult.ok
    && gallonsResult.ok
    && costResult.ok
    && !saving;

  async function handleSave() {
    if (!canSave || !selectedCarId || !user) return;
    if (!odoResult.ok || !gallonsResult.ok || !costResult.ok) return;
    setSaving(true);
    try {
      const prior = await getLatestEntry(selectedCarId);
      const odo = odoResult.value!;
      const wentDown = prior !== null && odo < prior.odometer;

      await createEntry(
        selectedCarId,
        { odometer: odo, gallons: gallonsResult.value!, cost: costResult.value! },
        user.uid
      );

      setMruCarId(selectedCarId);

      if (wentDown && prior) {
        pushToast(
          'warning',
          `Odometer went down from ${prior.odometer}. Saved anyway.`
        );
      } else {
        pushToast('success', 'Saved');
      }

      setOdometer('');
      setGallons('');
      setCost('');
      // selectedCarId stays — PRD Flow C step 5.
      // Refetch entries so the tile row reflects the just-saved entry.
      // Fire-and-forget: tiles cross-fade-in when the new data lands;
      // form stays responsive in the meantime.
      void refreshEntries();
    } catch {
      pushToast('error', "Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  }

  // Branch on useCars state.
  if (state.status === 'loading') {
    return (
      <main className="p-6 max-w-md mx-auto w-full">
        <p className="text-sm text-gray-500">Loading cars…</p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="p-6 max-w-md mx-auto w-full flex flex-col gap-2">
        <p className="text-sm text-red-600">
          Couldn&apos;t load cars — try again.
        </p>
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          className="self-start text-blue-600 underline text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          Retry
        </button>
      </main>
    );
  }

  if (state.cars.length === 0) {
    return (
      <main className="p-6 max-w-md mx-auto w-full flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-lg font-medium text-gray-800">
          You don&apos;t have any cars yet.
        </p>
        <Link
          to="/cars"
          className="px-4 py-2 bg-blue-600 text-white rounded-md min-h-[44px] flex items-center hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add a car →
        </Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-md mx-auto w-full flex flex-col gap-6">
      <h1 className="sr-only">Log a fill-up</h1>

      <CarPickerChips
        cars={state.cars}
        selectedId={selectedCarId}
        onChange={(id) => {
          setSelectedCarId(id);
          setMruCarId(id);
        }}
      />

      <NumericField
        label="Odometer (mi)"
        decimal={false}
        value={odometer}
        onChange={setOdometer}
        error={odoError}
      />
      <NumericField
        label="Gallons"
        decimal
        value={gallons}
        onChange={setGallons}
        error={gallonsError}
      />
      <NumericField
        label="Cost ($)"
        decimal
        value={cost}
        onChange={setCost}
        error={costError}
      />

      <button
        type="button"
        onClick={() => {
          void handleSave();
        }}
        disabled={!canSave}
        className="px-4 py-3 bg-blue-600 text-white rounded-md min-h-[44px] disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

      <Toast state={toast} onDismiss={() => setToast(null)} />

      {/* MPG tile row — last child of <main>. The discriminator is
          inlined (NOT extracted to a `const showTiles`) so TypeScript's
          control-flow narrowing propagates to `entriesState.entries`
          access below; an extracted const loses the narrowing. Row
          hides entirely until the selected car has ≥1 entry — brand-
          new cars don't show three "—" placeholders (Decision #6).
          `key={selectedCarId}` remounts on car switch, firing the
          150ms `animate-fade-in` keyframe (defined in src/index.css). */}
      {entriesState.status === 'ready' && entriesState.entries.length >= 1 && (
        <section
          key={selectedCarId}
          className="border-t border-gray-200 pt-5 animate-fade-in"
        >
          <div className="grid grid-cols-3 gap-2">
            <MpgTile
              label="Last fill"
              value={lastFillMpg(entriesState.entries)}
              subtitleWhenEmpty="need 2+ fills"
            />
            <MpgTile
              label="Avg last 5"
              value={avgLastNMpg(entriesState.entries, 5)}
              subtitleWhenEmpty="need 2+ fills"
            />
            <MpgTile
              label="Lifetime"
              value={lifetimeMpg(entriesState.entries)}
              subtitleWhenEmpty="need 2+ fills"
            />
          </div>
        </section>
      )}
    </main>
  );
}
