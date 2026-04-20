/**
 * Task #560 — feature-flag scaffold.
 *
 * Both flags default OFF. Reading from `process.env` directly (rather than
 * caching at module load) so flips can take effect on the next read without
 * a server restart, satisfying the task's "flippable without redeploy"
 * requirement for runtime-toggled flags. Tests can also mutate
 * `process.env.*` between cases.
 *
 *  - `SPEC_MERGE_AUTO_REPAIR` gates the spec_merge auto-repair safety net
 *    (orphan rewire + missing-required-property fill). When off, the
 *    validator failure surfaces as today: a `spec_merge: failed` event and
 *    a hard run failure.
 *
 *  - `CATALOG_AUTHORITY_FROM_DLL` is a forward-looking flag. When the
 *    DLL-introspected catalog lands (Steps 2–6 of the task), it will gate
 *    the swap from `activity-definitions.ts` to the DLL-derived data.
 *    Today it is a no-op except for the boolean read; consumers can guard
 *    new code paths against it ahead of the data being available.
 *
 * Truthy values: "1", "true", "TRUE", "on" (case-insensitive). Anything
 * else, including unset, is false.
 */

const TRUTHY = new Set(["1", "true", "on", "yes"]);

function readBoolFlag(name: string): boolean {
  const raw = process.env[name];
  if (raw == null) return false;
  return TRUTHY.has(String(raw).trim().toLowerCase());
}

export function isAutoRepairEnabled(): boolean {
  return readBoolFlag("SPEC_MERGE_AUTO_REPAIR");
}

export function isCatalogAuthorityFromDllEnabled(): boolean {
  return readBoolFlag("CATALOG_AUTHORITY_FROM_DLL");
}
