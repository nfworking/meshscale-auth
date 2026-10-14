"use client";

import { useEffect, useState } from "react";

/**
 * The query string of the current page, including the signed OAuth parameters.
 * Links between sign-in and sign-up must carry it, or the authorization request would be lost.
 * It is read after mount so server and client render the same markup.
 */
export function useOAuthSearch() {
  const [search, setSearch] = useState("");
  useEffect(() => setSearch(window.location.search), []);
  return search;
}
