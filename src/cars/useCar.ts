// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// useCar — single-car-detail hook. Same epoch-guarded shape as
// useCars (AC C9): both success and error paths discard stale
// resolutions.
//
// The status is 'ready' with car=null when getCar resolves null
// (not-found or permission-denied — see getCar in cars.ts and
// dispatch §7.6). CarDetailScreen renders a friendly "not found"
// surface on that state.
//
// See useCars.ts for the showLoading-false useEffect rationale
// (avoids react-hooks/set-state-in-effect lint).

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCar, type Car } from './cars';

export type UseCarState =
  | { status: 'loading' }
  | { status: 'ready'; car: Car | null }
  | { status: 'error'; error: unknown };

export interface UseCarResult {
  state: UseCarState;
  refresh: () => Promise<void>;
}

export function useCar(carId: string): UseCarResult {
  const [state, setState] = useState<UseCarState>({ status: 'loading' });
  const epochRef = useRef(0);

  const doFetch = useCallback(
    async (showLoading: boolean) => {
      const epoch = ++epochRef.current;
      if (showLoading) {
        setState({ status: 'loading' });
      }
      try {
        const car = await getCar(carId);
        if (epoch !== epochRef.current) return; // stale; discard
        setState({ status: 'ready', car });
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void doFetch(false);
  }, [doFetch]);

  const refresh = useCallback(() => doFetch(true), [doFetch]);

  return { state, refresh };
}
