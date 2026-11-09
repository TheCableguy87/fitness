// Backup build / parse / merge (pure) and the reminder rule.
import { validatePlan } from './validate.js';
import { SCHEMA_VERSION, DEFAULTS } from './storage.js';

export const BACKUP_APP = 'home-fitness';
const DAY_MS = 86400000;

export function buildBackup({ plan, log, settings }, now) {
  return { app: BACKUP_APP, backupVersion: 1, schemaVersion: SCHEMA_VERSION, exportedAt: now, plan: plan || null, log: log || [], settings: settings || DEFAULTS.settings() };
}

export function backupFileName(now) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `fitness-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export function parseBackup(text) {
  let b;
  try { b = JSON.parse(text); } catch { return { ok: false, errors: ['זה לא JSON תקין'] }; }
  const errors = [];
  if (!b || typeof b !== 'object' || Array.isArray(b) || b.app !== BACKUP_APP) return { ok: false, errors: ['זה לא קובץ גיבוי של האפליקציה'] };
  if (!(Number(b.schemaVersion) <= SCHEMA_VERSION)) errors.push('הגיבוי מגרסה חדשה יותר של האפליקציה');
  if (b.plan != null) {
    const r = validatePlan(b.plan);
    if (!r.ok) errors.push('התוכנית בגיבוי לא תקינה: ' + r.errors[0].path + ': ' + r.errors[0].message);
  }
  if (!Array.isArray(b.log)) errors.push('חסר log');
  else if (b.log.some((l) => !l || typeof l.id !== 'string' || !Array.isArray(l.exercises) || typeof l.endedAt !== 'number')) errors.push('רשומה לא תקינה ב-log');
  if (b.settings != null && (typeof b.settings !== 'object' || Array.isArray(b.settings))) errors.push('settings לא תקין');
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], backup: b };
}

// Merge: the log is a union by id; the current plan and settings are kept (backup fills gaps).
export function mergeBackup(current, backup) {
  const known = new Set(current.log.map((l) => l.id));
  const added = backup.log.filter((l) => !known.has(l.id));
  const log = [...current.log, ...added].sort((a, b) => a.startedAt - b.startedAt);
  return { plan: current.plan || backup.plan || null, log, settings: current.settings, added: added.length };
}

export function replaceWithBackup(backup) {
  return { plan: backup.plan || null, log: backup.log, settings: { ...DEFAULTS.settings(), ...(backup.settings || {}) } };
}

// Reminder every 7 days or after 5 workouts since the last backup. Silent for a day after "later".
export function backupReminder(meta, log, now) {
  if (!log.length) return { show: false };
  if (meta.snoozeUntil && now < meta.snoozeUntil) return { show: false };
  const since = meta.lastBackupAt || Math.min(...log.map((l) => l.startedAt));
  const days = Math.floor((now - since) / DAY_MS);
  const count = log.filter((l) => l.endedAt > (meta.lastBackupAt || 0)).length;
  if (days >= 7 || count >= 5) return { show: true, days, count };
  return { show: false, days, count };
}

export function reminderText(days) {
  return days >= 1
    ? `לא גיבית ${days} ימים. אם האפליקציה תימחק, ההיסטוריה תאבד.`
    : 'לא גיבית את האימונים האחרונים. אם האפליקציה תימחק, ההיסטוריה תאבד.';
}
