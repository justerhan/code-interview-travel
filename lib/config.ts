// Centralized app configuration
// Clarifying question threshold (client-only). Read from public env for runtime access in the browser.
// NEXT_PUBLIC_MIN_MISSING_GROUPS should be 1..3. Defaults to 3 (ask only when all three groups are missing).
const raw = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MIN_MISSING_GROUPS : undefined) || '3';
const parsed = Number.parseInt(raw, 10);
const clamped = Number.isFinite(parsed) ? Math.min(3, Math.max(1, parsed)) : 3;

export const MIN_MISSING_GROUPS = clamped;

export type Config = {
  minMissingGroups: number;
};

export const config: Config = {
  minMissingGroups: MIN_MISSING_GROUPS,
};
