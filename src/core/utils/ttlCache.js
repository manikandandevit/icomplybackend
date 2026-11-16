/**
 * Tiny in-memory cache with a time-to-live. Used for per-request lookups that
 * rarely change (signed-in user status, designation permissions), so each API
 * call doesn't pay extra database round-trips.
 */
export const createTtlCache = (ttlMs, maxEntries = 2000) => {
  const entries = new Map();

  return {
    async get(key, loader) {
      const now = Date.now();
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now) return hit.value;

      const value = Promise.resolve().then(loader);
      entries.set(key, { expiresAt: now + ttlMs, value });
      if (entries.size > maxEntries) {
        entries.delete(entries.keys().next().value);
      }
      try {
        return await value;
      } catch (error) {
        entries.delete(key);
        throw error;
      }
    },
    clear() {
      entries.clear();
    },
  };
};
