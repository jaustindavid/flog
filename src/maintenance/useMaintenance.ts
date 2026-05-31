// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// useMaintenance — per-car maintenance-list hook. Mirrors useEntries
// exactly (same epoch-guarded shape): both success and error paths
// discard stale resolutions so a rapid carId change can't let an older
// in-flight fetch overwrite the newer one.
//
// Returns maintenance docs newest-service-date first (descending
// `date`), as listMaintenanceForCar delivers them.
//
// Same narrow react-hooks/set-state-in-effect suppression as useCars /
// useCar / useEntries — the fourth instance. The pending subscribe-style
// refactor (BACKLOG) removes all of them together; not expanded here.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listMaintenanceForCar,
  type Maintenance,
} from './maintenance';

export type UseMaintenanceState =
  | { status: 'loading' }
  // `carId` tags which car this ready data is for — see useEntries for
  // the rationale. The reminder banner (a binary show/hide element)
  // compares it to the selected car to avoid a stale-data flash on a
  // rapid car switch (the hook keeps the prior car's ready data during
  // the refetch).
  | { status: 'ready'; maintenance: Maintenance[]; carId: string }
  | { status: 'error'; error: unknown };

export interface UseMaintenanceResult {
  state: UseMaintenanceState;
  refresh: () => Promise<void>;
}

export function useMaintenance(carId: string): UseMaintenanceResult {
  const [state, setState] = useState<UseMaintenanceState>({
    status: 'loading',
  });
  const epochRef = useRef(0);

  const doFetch = useCallback(
    async (showLoading: boolean) => {
      const epoch = ++epochRef.current;
      if (showLoading) {
        setState({ status: 'loading' });
      }
      try {
        const maintenance = await listMaintenanceForCar(carId);
        if (epoch !== epochRef.current) return; // stale; discard
        setState({ status: 'ready', maintenance, carId });
      } catch (error: unknown) {
        if (epoch !== epochRef.current) return; // stale; discard
        setState({ status: 'error', error });
      }
    },
    [carId]
  );

  useEffect(() => {
    // See useEntries.ts / useCars.ts for the rationale: one-shot fetch
    // on mount / carId change; setState only fires after the awaited
    // microtask. Same project-wide suppression.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void doFetch(false);
  }, [doFetch]);

  const refresh = useCallback(() => doFetch(true), [doFetch]);

  return { state, refresh };
}
