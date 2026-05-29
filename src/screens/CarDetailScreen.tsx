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

export function CarDetailScreen() {
  const { carId } = useParams<{ carId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state, refresh } = useCar(carId ?? '');
  const { state: entriesState, refresh: refreshEntries } = useEntries(
    carId ?? ''
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

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
