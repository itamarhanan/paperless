import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False while rendering on the server and hydrating, true after: for values only the browser knows. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
