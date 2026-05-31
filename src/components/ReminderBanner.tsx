// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// ReminderBanner — small presentational due/overdue nudge on the log
// screen (maintenance-phase-3 §5.5). Tappable → opens the maintenance
// modal so the user can log the service that resets the clock. A gentle
// amber nudge, NOT an error (red); quiet and mobile-first.
//
// Pure presentation: it takes a ready ReminderStatus and an onTap. The
// caller (LogFillupScreen) only mounts it when status.active &&
// status.due, so this component assumes due and just formats copy.

import type { ReminderStatus } from '../maintenance/computeReminder';

interface ReminderBannerProps {
  status: ReminderStatus;
  onTap: () => void;
}

// Copy rules (§5.5): "[label] due" when just crossed; "overdue by N mi"
// or "overdue by N days" when past. If both dimensions are overdue,
// prefer miles. A 0-overage (just crossed) reads as "due".
function bannerText(status: ReminderStatus): string {
  const { label, overdueMiles, overdueDays } = status;
  if (overdueMiles != null && overdueMiles > 0) {
    return `${label} overdue by ${overdueMiles.toLocaleString()} mi`;
  }
  if (overdueMiles == null && overdueDays != null && overdueDays > 0) {
    return `${label} overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}`;
  }
  return `${label} due`;
}

export function ReminderBanner({ status, onTap }: ReminderBannerProps) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center gap-2 text-left px-4 py-3 rounded-md border border-amber-300 bg-amber-50 text-amber-900 min-h-[44px] hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <span aria-hidden="true">🔧</span>
      <span className="flex-1 text-sm font-medium">{bannerText(status)}</span>
      <span aria-hidden="true" className="text-amber-700">
        ›
      </span>
    </button>
  );
}
