// CarListItem — one Car row in the list. Tap navigates to detail.

import { Link } from 'react-router';
import type { Car } from '../cars/cars';

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
      </Link>
    </li>
  );
}
