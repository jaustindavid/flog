// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// CarPickerChips — horizontal chip row for the log form's car picker.
// At family scale (4-5 cars) all chips fit on a 375px viewport with
// 44pt tap targets (Decision #9). Selected chip is filled-blue;
// unselected are outlined.

import type { Car } from '../cars/cars';

interface CarPickerChipsProps {
  cars: Car[];
  selectedId: string | null;
  onChange: (carId: string) => void;
  onReselect: (carId: string) => void;
}

export function CarPickerChips({
  cars,
  selectedId,
  onChange,
  onReselect,
}: CarPickerChipsProps) {
  return (
    <div
      role="group"
      aria-label="Choose a car"
      className="flex flex-wrap gap-2"
    >
      {cars.map((car) => {
        const selected = car.id === selectedId;
        return (
          <button
            key={car.id}
            type="button"
            aria-current={selected ? 'true' : undefined}
            onClick={() => {
              if (car.id === selectedId) onReselect(car.id);
              else onChange(car.id);
            }}
            className={
              selected
                ? 'px-4 py-2 min-h-[44px] rounded-full bg-blue-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                : 'px-4 py-2 min-h-[44px] rounded-full border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }
          >
            {car.name}
          </button>
        );
      })}
    </div>
  );
}
