// Single app state + persistence. Views import `store` and call its methods.
import { createStorage, browserBackend, KEYS, requestPersist } from './storage.js';
import { createDraftSaver, isDraftValid } from './draft.js';
import { emptyLibrary } from './library.js';

const listeners = new Set();

export const store = {
  plan: null,
  log: [],
  settings: { sound: true, vibrate: false, wakeLock: true },
  meta: { lastBackupAt: null, snoozeUntil: 0, lastError: null },
  session: null, // active workout / draft
  library: emptyLibrary(),
  updateAvailable: false,
  saveFailed: false,
  notices: [], // load-time problems (corrupt data etc.)
  persisted: false,
  storage: null,
  saver: null,

  init() {
    this.storage = createStorage(browserBackend(), () => { this.saveFailed = true; this.emit(); });
    const s = this.storage;
    for (const key of [KEYS.plan, KEYS.log, KEYS.settings, KEYS.meta, KEYS.draft]) {
      const r = s.read(key);
      if (r.corrupt) this.notices.push(`נתוני ${key} היו פגומים ונשמרו בצד.`);
      if (r.tooNew) this.notices.push(`נתוני ${key} מגרסה חדשה יותר ולא נטענו.`);
    }
    this.plan = s.read(KEYS.plan).data;
    const log = s.read(KEYS.log).data;
    this.log = Array.isArray(log) ? log : [];
    this.settings = { ...this.settings, ...(s.read(KEYS.settings).data || {}) };
    this.meta = { ...this.meta, ...(s.read(KEYS.meta).data || {}) };
    const draft = s.read(KEYS.draft).data;
    this.session = isDraftValid(draft, this.plan) ? draft : null;
    if (draft && !this.session) s.remove(KEYS.draft);
    this.saver = createDraftSaver(s, () => this.session, () => { this.saveFailed = true; this.emit(); });
    requestPersist().then((ok) => { this.persisted = ok; });
  },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach((fn) => fn()); },

  save(key, data) {
    const ok = this.storage.write(key, data);
    if (!ok) { this.saveFailed = true; this.emit(); }
    return ok;
  },
  savePlan(plan) { this.plan = plan; return this.save(KEYS.plan, plan); },
  saveLog() { return this.save(KEYS.log, this.log); },
  saveSettings(patch) { this.settings = { ...this.settings, ...patch }; return this.save(KEYS.settings, this.settings); },
  saveMeta(patch) { this.meta = { ...this.meta, ...patch }; return this.save(KEYS.meta, this.meta); },

  // Draft: update the in-memory session and schedule a debounced write.
  setSession(session) { this.session = session; if (session) this.saver.schedule(); },
  flushDraft() { if (this.session) this.saver.flush(); },
  clearDraft() { this.saver.cancel(); this.session = null; this.storage.remove(KEYS.draft); },

  addLog(entry) {
    this.log = [...this.log.filter((l) => l.id !== entry.id), entry];
    return this.saveLog();
  },
  replaceAll({ plan, log, settings }) {
    this.clearDraft();
    this.plan = plan; this.log = log; this.settings = settings;
    const a = this.save(KEYS.plan, plan);
    const b = this.save(KEYS.log, log);
    const c = this.save(KEYS.settings, settings);
    return a && b && c;
  },
  resetAll() {
    this.clearDraft();
    this.storage.clearAll();
    this.plan = null; this.log = [];
    this.settings = { sound: true, vibrate: false, wakeLock: true };
    this.meta = { lastBackupAt: null, snoozeUntil: 0, lastError: null };
  },
};
