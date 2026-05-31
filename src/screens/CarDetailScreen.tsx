// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// CarDetailScreen — name, sharees, fill-ups + MPG, and owner
// controls.
//
// Sharees see name + sharees list + fill-ups section identically;
// owner additionally sees rename, share, unshare, and delete. The
// Fill-ups section lives between the Share section and the owner-
// only delete (M5 §7.6) — the slot M4 V6 fix-forward vacated.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useCar } from '../cars/useCar';
import { deleteCar } from '../cars/cars';
import type { MaintenanceReminder } from '../cars/cars';
import { useEntries } from '../entries/useEntries';
import {
  avgLastNMpg,
  lastFillMpg,
  lifetimeMpg,
} from '../entries/computeMpg';
import { RenameCarForm } from '../components/RenameCarForm';
import { ShareForm } from '../components/ShareForm';
import { SharedWithList } from '../components/SharedWithList';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MpgTile } from '../components/MpgTile';
import { EntriesTable } from '../components/EntriesTable';
import { EditEntryModal } from '../components/EditEntryModal';
import type { Entry } from '../entries/entries';
import { useMaintenance } from '../maintenance/useMaintenance';
import { MaintenanceTable } from '../components/MaintenanceTable';
import { MaintenanceModal } from '../components/MaintenanceModal';
import { ReminderConfigForm } from '../components/ReminderConfigForm';
import type { Maintenance } from '../maintenance/maintenance';
import { computeSpend } from '../maintenance/computeSpend';
import { SpendReport } from '../components/SpendReport';
import { computeReminder } from '../maintenance/computeReminder';

// ---------------------------------------------------------------------------
// NextDueDetail — absolute next-due block inside the Maintenance section.
// Pure presentation: takes already-loaded state from the parent screen.
// Shows "Next [label]: N mi or by [date]" when not yet due; "overdue by"
// copy when past due; "Log a [label] to start" when reminder set but no
// baseline yet. (brief §5.2)
// ---------------------------------------------------------------------------

interface NextDueDetailProps {
  reminder: MaintenanceReminder;
  maintenance: Maintenance[];
  currentOdometer: number | null;
}

// Format a Date using local getters → "Aug 31, 2026" style.
// Never toISOString() (UTC); consistent with dateField/addMonths convention.
function formatLocalDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function NextDueDetail({
  reminder,
  maintenance,
  currentOdometer,
}: NextDueDetailProps) {
  const s = computeReminder(maintenance, reminder, currentOdometer, new Date());

  if (!s.active) {
    // Reminder configured but no baseline entry yet.
    return (
      <p className="text-sm text-gray-500">
        Log a {reminder.label.toLowerCase()} to start the reminder.
      </p>
    );
  }

  if (s.due) {
    // Build overdue copy: "overdue by N mi / N days" for present dimensions.
    const parts: string[] = [];
    if (s.milesRemaining !== null && s.milesRemaining <= 0) {
      const mi = Math.abs(s.milesRemaining);
      parts.push(`${mi.toLocaleString()} mi`);
    }
    if (s.daysRemaining !== null && s.daysRemaining <= 0) {
      const d = Math.abs(s.daysRemaining);
      parts.push(`${d} ${d === 1 ? 'day' : 'days'}`);
    }
    const overage = parts.join(' / ');
    return (
      <p className="text-sm text-amber-700">
        {reminder.label} overdue{overage ? ` by ${overage}` : ''}
      </p>
    );
  }

  // Not yet due — show absolute thresholds for present dimensions.
  const thresholdParts: string[] = [];
  if (s.dueOdometer !== null) {
    thresholdParts.push(`${s.dueOdometer.toLocaleString()} mi`);
  }
  if (s.dueDate !== null) {
    thresholdParts.push(`by ${formatLocalDate(s.dueDate)}`);
  }
  const thresholds = thresholdParts.join(' or ');

  return (
    <p className="text-sm text-gray-700">
      Next {reminder.label.toLowerCase()}:{' '}
      <span className="font-medium">{thresholds}</span>
    </p>
  );
}

export function CarDetailScreen() {
  const { carId } = useParams<{ carId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state, refresh } = useCar(carId ?? '');
  const { state: entriesState, refresh: refreshEntries } = useEntries(
    carId ?? ''
  );
  const { state: maintState, refresh: refreshMaint } = useMaintenance(
    carId ?? ''
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  // Maintenance modal state: open + (optional) the entry being edited.
  // `maintModalOpen` distinguishes create mode (open, no entry) from
  // closed; `editingMaint` carries the entry in edit mode.
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [editingMaint, setEditingMaint] = useState<Maintenance | null>(null);
  // Computed once per render; injected into the pure computeSpend fn
  // so the aggregator never calls new Date() itself (testability).
  const currentYear = new Date().getFullYear();

  if (state.status === 'loading') {
    return (
      <main className="p-6 max-w-md mx-auto w-full">
        <p className="text-sm text-gray-500">Loading car…</p>
      </main>
    );
  }

  if (state.status === 'error' || state.car === null) {
    // Per AC U10 + dispatch §7.6: not-found and permission-denied
    // collapse to the same surface.
    return (
      <main className="p-6 max-w-md mx-auto w-full flex flex-col gap-4">
        <p className="text-base text-gray-800">Car not found or no access.</p>
        <Link
          to="/cars"
          className="text-blue-600 underline text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded self-start"
        >
          ← Back to cars
        </Link>
      </main>
    );
  }

  const car = state.car;
  const isOwner = user?.uid === car.ownerUid;

  async function handleDelete() {
    await deleteCar(car.id);
    setConfirmingDelete(false);
    navigate('/cars');
  }

  return (
    <main className="p-6 max-w-md mx-auto w-full flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          to="/cars"
          className="text-blue-600 underline text-sm self-start min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          ← Back to cars
        </Link>
        {isOwner ? (
          <RenameCarForm car={car} onRenamed={refresh} />
        ) : (
          <h1 className="text-2xl font-bold break-words">{car.name}</h1>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Shared with</h2>
        <SharedWithList
          car={car}
          canUnshare={isOwner}
          onUnshared={refresh}
        />
        {isOwner && <ShareForm car={car} onShared={refresh} />}
      </section>

      {entriesState.status === 'ready' && maintState.status === 'ready' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Spend</h2>
          <SpendReport
            report={computeSpend(
              entriesState.entries,
              maintState.maintenance,
              currentYear
            )}
            referenceYear={currentYear}
          />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Maintenance</h2>
          <button
            type="button"
            onClick={() => {
              setEditingMaint(null);
              setMaintModalOpen(true);
            }}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md min-h-[44px] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Log maintenance
          </button>
        </div>
        {/* Service-reminder config (Phase 3) — owner only. Sharees see the
            maintenance log + reset checkbox but not the reminder setup. */}
        {isOwner && (
          <ReminderConfigForm car={car} onChanged={refresh} />
        )}
        {/* Next-due projection — shown when both data sets are ready and
            a reminder is configured. Uses already-loaded state; no extra
            fetch. computeReminder is pure (injected now + odometer). */}
        {car.maintenanceReminder &&
          maintState.status === 'ready' &&
          entriesState.status === 'ready' && (
            <NextDueDetail
              reminder={car.maintenanceReminder}
              maintenance={maintState.maintenance}
              currentOdometer={
                entriesState.entries.length > 0
                  ? Math.max(...entriesState.entries.map((e) => e.odometer))
                  : null
              }
            />
          )}
        {maintState.status === 'loading' && (
          <p className="text-sm text-gray-500">Loading maintenance…</p>
        )}
        {maintState.status === 'error' && (
          <p className="text-sm text-gray-700">
            Couldn&rsquo;t load maintenance —{' '}
            <button
              type="button"
              onClick={refreshMaint}
              className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              try again
            </button>
          </p>
        )}
        {maintState.status === 'ready' && (
          <MaintenanceTable
            maintenance={maintState.maintenance}
            canEditMaintenance={(m) =>
              isOwner || m.loggedByUid === user?.uid
            }
            onEditMaintenance={(m) => {
              setEditingMaint(m);
              setMaintModalOpen(true);
            }}
          />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Fill-ups</h2>
        {entriesState.status === 'loading' && (
          <p className="text-sm text-gray-500">Loading fill-ups…</p>
        )}
        {entriesState.status === 'error' && (
          <p className="text-sm text-gray-700">
            Couldn&rsquo;t load fill-ups —{' '}
            <button
              type="button"
              onClick={refreshEntries}
              className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              try again
            </button>
          </p>
        )}
        {entriesState.status === 'ready' && (
          <>
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
            <EntriesTable
              entries={entriesState.entries}
              canEditEntry={(e) =>
                isOwner || e.loggedByUid === user?.uid
              }
              onEditEntry={(e) => setEditing(e)}
            />
          </>
        )}
      </section>

      {isOwner && (
        <section className="pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-red-600 underline text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            Delete car
          </button>
        </section>
      )}

      {editing && (
        <EditEntryModal
          carId={carId ?? ''}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refreshEntries();
          }}
          onDeleted={() => {
            setEditing(null);
            void refreshEntries();
          }}
        />
      )}

      {maintModalOpen && (
        <MaintenanceModal
          carId={carId ?? ''}
          entry={editingMaint ?? undefined}
          loggedByUid={user?.uid ?? ''}
          reminderLabel={car.maintenanceReminder?.label ?? null}
          onClose={() => {
            setMaintModalOpen(false);
            setEditingMaint(null);
          }}
          onSaved={() => {
            setMaintModalOpen(false);
            setEditingMaint(null);
            void refreshMaint();
          }}
          onDeleted={() => {
            setMaintModalOpen(false);
            setEditingMaint(null);
            void refreshMaint();
          }}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete car"
          message={`Delete ${car.name}? This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </main>
  );
}
