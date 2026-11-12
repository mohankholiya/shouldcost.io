import * as React from "react";

/**
 * Per-request memoisation for server reads. Next's server runtime ships a React
 * build with `cache`, so the layout and the page share one Supabase round trip
 * instead of each repeating it. Plain React 18 (e.g. under vitest) has no
 * `cache`, so it falls back to calling straight through.
 */
export const requestCache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);
