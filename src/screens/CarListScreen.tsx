// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// CarListScreen — replaces M2's EmptyHomeScreen.
// Renders cars-list-or-empty-state with a persistent Add car button.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { useCars } from '../cars/useCars';
import { createCar } from '../cars/cars';
import { CarListItem } from '../components/CarListItem';
import { AddCarModal } from '../components/AddCarModal';

export function CarListScreen() {
  const { user } = useAuth();
  const { state, refresh } = useCars();
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  async function handleCreate(name: string) {
    if (!user) return;
    const carId = await createCar(name, user.uid);
    setAdding(false);
    // Implementer choice: navigate to the new car detail on create
    // (dispatch §3 / Decision #3 left to implementer). Rationale: the
    // user's next action is usually "share it" or "rename it", both of
    // which live on detail. Saves one tap.
    navigate(`/cars/${carId}`);
  }

  return (
    <main className="flex flex-col gap-6 p-6 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your cars</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md min-h-[44px] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add car
        </button>
      </div>

      {state.status === 'loading' && (
        <p className="text-sm text-gray-500">Loading cars…</p>
      )}

      {state.status === 'error' && (
        <div className="flex flex-col gap-2">
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
        </div>
      )}

      {state.status === 'ready' && state.cars.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <p className="text-lg font-medium text-gray-800">No cars yet.</p>
          <p className="text-sm text-gray-500">
            Tap &ldquo;Add car&rdquo; to get started.
          </p>
        </div>
      )}

      {state.status === 'ready' && state.cars.length > 0 && (
        <ul className="flex flex-col gap-3">
          {state.cars.map((car) => (
            <CarListItem key={car.id} car={car} />
          ))}
        </ul>
      )}

      {adding && (
        <AddCarModal
          onCancel={() => setAdding(false)}
          onCreate={handleCreate}
        />
      )}
    </main>
  );
}
