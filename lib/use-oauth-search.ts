"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * The query string of the current page, including the signed OAuth parameters.
 * Links between sign-in and sign-up must carry it, or the authorization request would be lost.
 * The server renders it empty and the browser fills it in after hydration, so both render the same markup first.
 */
export function useOAuthSearch() {
  return useSyncExternalStore(subscribe, () => window.location.search, () => "");
}
