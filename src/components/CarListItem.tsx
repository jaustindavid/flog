// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// CarListItem — one Car row in the list. Tap navigates to detail.
// When the car has a maintenanceReminder, renders a NextDueLine below
// the name (next-due-display §5.3). NextDueLine is a direct, stable
// child — no unstable key, no wrapper — so React preserves it across
// useCars refreshes (S1: no re-fetch churn).

import { Link } from 'react-router';
import type { Car } from '../cars/cars';
import { NextDueLine } from './NextDueLine';

interface CarListItemProps {
  car: Car;
}

export function CarListItem({ car }: CarListItemProps) {
  return (
    <li>
      <Link
        to={`/cars/${car.id}`}
        className="block px-4 py-4 border border-gray-200 rounded-md min-h-[44px] hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="text-base font-medium text-gray-900">{car.name}</span>
        {car.shareeEmails.length > 0 && (
          <span className="block text-xs text-gray-500 mt-1">
            Shared with {car.shareeEmails.length}
          </span>
        )}
        {/* NextDueLine only mounts when a reminder exists — no conditional
            hooks, no wasted fetch for cars without a reminder. */}
        {car.maintenanceReminder && (
          <NextDueLine carId={car.id} reminder={car.maintenanceReminder} />
        )}
      </Link>
    </li>
  );
}
