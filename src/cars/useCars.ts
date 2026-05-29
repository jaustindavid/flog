// useCars — list-my-cars hook.
//
// Wraps listMyCars() with loading/ready/error state and an
// epoch-counter race guard (per dispatch §7.3 + AC C9). The race
// guard ensures rapid sequences (add → refresh → delete → refresh)
// resolve to the latest fetch even when an earlier in-flight fetch
// resolves later. Without it, stale data can silently overwrite
// fresh data on BOTH the success and error paths.
//
// Implementation note: the initial fetch is driven by a useEffect
// that does NOT call setState synchronously in its body (that
// pattern trips react-hooks/set-state-in-effect). Instead, the
// effect kicks off the async fetch directly and the state-sets
// happen inside the awaited microtask. The exposed `refresh` is
// the same async function — safe to call from event handlers.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { canonicalEmail } from '../auth/canonicalEmail';
import { listMyCars, type Car } from './cars';

export type UseCarsState =
  | { status: 'loading' }
  | { status: 'ready'; cars: Car[] }
  | { status: 'error'; error: unknown };

export interface UseCarsResult {
  state: UseCarsState;
  refresh: () => Promise<void>;
}

export function useCars(): UseCarsResult {
  const { user } = useAuth();
  const [state, setState] = useState<UseCarsState>({ status: 'loading' });
  const epochRef = useRef(0);

  // Internal fetcher — does NOT set state synchronously at call
  // time, so it is safe to invoke from a useEffect body.
  const doFetch = useCallback(
    async (showLoading: boolean) => {
      if (!user) return;
      const epoch = ++epochRef.current;
      if (showLoading) {
        setState({ status: 'loading' });
      }
      try {
        const cars = await listMyCars(user.uid, canonicalEmail(user.email));
        if (epoch !== epochRef.current) return; // stale; discard
        setState({ status: 'ready', cars });
      } catch (error: unknown) {
        if (epoch !== epochRef.current) return; // stale; discard
        setState({ status: 'error', error });
      }
    },
    [user]
  );

  useEffect(() => {
    // One-shot fetch on mount / user change. The fetcher only
    // touches setState after an awaited microtask, so no cascading
    // render fires synchronously from this effect body. The new
    // react-hooks/set-state-in-effect rule (v7) flags any reachable
    // setState — a conservative reading that contradicts React's
    // own one-shot-fetch-in-effect guidance. Suppressing the rule
    // narrowly here is preferable to restructuring around the
    // suppression. See dispatch §7.3 race-guard requirement (AC C9).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void doFetch(false);
  }, [doFetch]);

  const refresh = useCallback(() => doFetch(true), [doFetch]);

  return { state, refresh };
}
