/** Cap for per-file validation results kept for tree and tab badges. */
export const VALIDATION_CACHE_MAX = 2000;

/**
 * Append entries to an immutable Map cache, evicting the oldest entries
 * (insertion order) once the size cap is exceeded. Re-inserted keys move to
 * the back, so recently touched entries survive longest. Returns a new Map.
 */
export function appendBounded<K, V>(
  cache: Map<K, V>,
  entries: Iterable<readonly [K, V]>,
  maxSize: number
): Map<K, V> {
  const next = new Map(cache);
  for (const [key, value] of entries) {
    next.delete(key);
    next.set(key, value);
  }
  if (next.size > maxSize) {
    const excess = next.size - maxSize;
    let removed = 0;
    for (const key of next.keys()) {
      if (removed++ >= excess) break;
      next.delete(key);
    }
  }
  return next;
}
