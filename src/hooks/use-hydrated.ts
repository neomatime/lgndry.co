"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** `false` during server render and hydration, `true` afterwards on the client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
