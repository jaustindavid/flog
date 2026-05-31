// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// useEntries — per-car entries-list hook. Same epoch-guarded shape
// as useCars / useCar (AC C9): both success and error paths discard
// stale resolutions so a rapid carId change doesn't let an older
// in-flight fetch overwrite the newer one.
//
// Returns entries in newest-first order (descending loggedAt), as
// listEntriesForCar delivers them — callers (MpgTile, EntriesTable)
// rely on that order to pair entries chronologically.
//
// See useCars.ts for the rationale on the showLoading-false useEffect
// pattern. This is the third instance of the narrow
// react-hooks/set-state-in-effect suppression across the project
// (useCars, useCar, useEntries). Per M4 handoff's "Items deferred →
// To BACKLOG", that triggered promotion of the BACKLOG → Later
// "refactor data-fetch hooks" item; cleanup will land in a dedicated
// dispatch after M5, removing all three suppressions together.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listEntriesForCar, type Entry } from './entries';

export type UseEntriesState =
  | { status: 'loading' }
  // `carId` tags WHICH car this ready data is for. The hook keeps the
  // previous car's ready data during a refetch (doFetch(false) — no
  // loading reset, so dependent UI doesn't flash to a spinner on every
  // car switch). Consumers that must not act on stale data (e.g. a
  // binary show/hide element) can compare `carId` to the currently
  // selected car and ignore a mismatch. Stale-tolerant consumers (the
  // MPG tiles) can keep ignoring it.
  | { status: 'ready'; entries: Entry[]; carId: string }
  | { status: 'error'; error: unknown };

export interface UseEntriesResult {
  state: UseEntriesState;
  refresh: () => Promise<void>;
}

export function useEntries(carId: string): UseEntriesResult {
  const [state, setState] = useState<UseEntriesState>({ status: 'loading' });
  const epochRef = useRef(0);

  const doFetch = useCallback(
    async (showLoading: boolean) => {
      const epoch = ++epochRef.current;
      if (showLoading) {
        setState({ status: 'loading' });
      }
      try {
        const entries = await listEntriesForCar(carId);
        if (epoch !== epochRef.current) return; // stale; discard
        setState({ status: 'ready', entries, carId });
      } catch (error: unknown) {
        if (epoch !== epochRef.current) return; // stale; discard
        setState({ status: 'error', error });
      }
    },
    [carId]
  );

  useEffect(() => {
    // See useCars.ts for the rationale: one-shot fetch on mount /
    // carId change; setState only fires after the awaited microtask.
    // Third project-wide suppression — a subscribe-style refactor
    // (BACKLOG → Soon "Refactor data-fetch hooks") will remove all
    // three (useCars, useCar, useEntries) together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void doFetch(false);
  }, [doFetch]);

  const refresh = useCallback(() => doFetch(true), [doFetch]);

  return { state, refresh };
}
