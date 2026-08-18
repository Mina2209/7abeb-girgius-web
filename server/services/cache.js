// Lightweight in-memory TTL cache. No external dependencies.
// Entries expire after their TTL; stale data is evicted lazily on read.

const store = new Map();

export const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  },

  set(key, value, ttlMs = 60_000) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  },

  del(key) {
    store.delete(key);
  },

  // Remove all keys matching a prefix (e.g. "hymns:" clears "hymns:all", "hymns:list", …)
  delPrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  clear() {
    store.clear();
  },
};
