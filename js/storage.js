// Safe localStorage wrapper with schema versions, migration and corrupt-data quarantine.
export const SCHEMA_VERSION = 1;
const PREFIX = 'fit.';
export const KEYS = { plan: 'plan', log: 'log', draft: 'draft', settings: 'settings', meta: 'meta' };

export const DEFAULTS = {
  plan: () => null,
  log: () => [],
  draft: () => null,
  settings: () => ({ sound: true, vibrate: false, wakeLock: true }),
  meta: () => ({ lastBackupAt: null, snoozeUntil: 0, lastError: null }),
};

// Migrations: from version N to N+1. Version 0 = raw value without envelope.
const MIGRATIONS = {
  0: (key, data) => {
    if (key === 'settings') return { ...DEFAULTS.settings(), ...(data && typeof data === 'object' ? data : {}) };
    if (key === 'log' && !Array.isArray(data)) return [];
    return data;
  },
};

export function migrateEnvelope(key, raw) {
  let version = 0;
  let data = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'schemaVersion' in raw && 'data' in raw) {
    version = Number(raw.schemaVersion) || 0;
    data = raw.data;
  }
  if (version > SCHEMA_VERSION) return { tooNew: true, schemaVersion: version, data };
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (step) data = step(key, data);
    version++;
  }
  return { tooNew: false, schemaVersion: version, data };
}

export function createStorage(backend, onWriteError = () => {}) {
  const get = (k) => { try { return backend.getItem(PREFIX + k); } catch { return null; } };
  const set = (k, v) => { try { backend.setItem(PREFIX + k, v); return true; } catch (e) { onWriteError(e); return false; } };
  const del = (k) => { try { backend.removeItem(PREFIX + k); } catch { /* ignore */ } };

  return {
    // Returns { data, corrupt, tooNew }. Corrupt JSON is moved to <key>_corrupt, never deleted.
    read(key) {
      const text = get(key);
      const fallback = DEFAULTS[key] ? DEFAULTS[key]() : null;
      if (text == null) return { data: fallback, corrupt: false, tooNew: false };
      let parsed;
      try { parsed = JSON.parse(text); } catch {
        set(key + '_corrupt', text);
        del(key);
        return { data: fallback, corrupt: true, tooNew: false };
      }
      const m = migrateEnvelope(key, parsed);
      if (m.tooNew) return { data: fallback, corrupt: false, tooNew: true };
      return { data: m.data, corrupt: false, tooNew: false };
    },
    write(key, data) {
      return set(key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, data }));
    },
    remove(key) { del(key); },
    hasCorrupt(key) { return get(key + '_corrupt') != null; },
    clearAll() { Object.values(KEYS).forEach((k) => { del(k); del(k + '_corrupt'); }); },
  };
}

export function browserBackend() {
  try {
    const s = window.localStorage;
    s.getItem('fit.__probe');
    return s;
  } catch {
    // Storage unavailable: in-memory fallback so the app still runs.
    const mem = new Map();
    return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, v); }, removeItem: (k) => { mem.delete(k); } };
  }
}

export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch { /* ignore */ }
  return false;
}
