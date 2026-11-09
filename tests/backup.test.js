import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBackup, parseBackup, mergeBackup, replaceWithBackup, backupReminder, backupFileName } from '../js/backup.js';

const plan = JSON.parse(fs.readFileSync(new URL('../data/sample-plan.json', import.meta.url), 'utf8'));
const entry = (id, t) => ({ id, planId: plan.id, dayId: 'd1', startedAt: t, endedAt: t + 1000, status: 'done', exercises: [] });
const DAY = 86400000;

test('build then parse round-trips', () => {
  const b = buildBackup({ plan, log: [entry('w1', 1)], settings: { sound: false } }, 5);
  const r = parseBackup(JSON.stringify(b));
  assert.equal(r.ok, true);
  assert.equal(r.backup.log.length, 1);
});

test('parse rejects junk, wrong app and bad plan', () => {
  assert.equal(parseBackup('{').ok, false);
  assert.equal(parseBackup('{"app":"other"}').ok, false);
  const b = buildBackup({ plan: { id: 'x' }, log: [], settings: {} }, 1);
  assert.equal(parseBackup(JSON.stringify(b)).ok, false);
  const c = buildBackup({ plan, log: [{ id: 1 }], settings: {} }, 1);
  assert.equal(parseBackup(JSON.stringify(c)).ok, false);
});

test('merge: union by id, current plan and settings win', () => {
  const cur = { plan, log: [entry('a', 100), entry('b', 300)], settings: { sound: true } };
  const bk = { plan: { ...plan, id: 'other' }, log: [entry('b', 300), entry('c', 200)], settings: { sound: false } };
  const m = mergeBackup(cur, bk);
  assert.deepEqual(m.log.map((l) => l.id), ['a', 'c', 'b']);
  assert.equal(m.added, 1);
  assert.equal(m.plan.id, plan.id);
  assert.equal(m.settings.sound, true);
});

test('merge fills a missing plan; replace takes everything with defaults', () => {
  const m = mergeBackup({ plan: null, log: [], settings: {} }, { plan, log: [], settings: {} });
  assert.equal(m.plan.id, plan.id);
  const r = replaceWithBackup({ plan, log: [entry('z', 1)], settings: { sound: false } });
  assert.equal(r.settings.wakeLock, true);
  assert.equal(r.settings.sound, false);
});

test('reminder: after 7 days, after 5 workouts, snooze, empty log', () => {
  const now = 100 * DAY;
  assert.equal(backupReminder({ lastBackupAt: null }, [], now).show, false);
  assert.equal(backupReminder({ lastBackupAt: now - 8 * DAY }, [entry('a', now - 3 * DAY)], now).show, true);
  assert.equal(backupReminder({ lastBackupAt: now - 8 * DAY }, [entry('a', now - 3 * DAY)], now).days, 8);
  assert.equal(backupReminder({ lastBackupAt: now - 2 * DAY }, [entry('a', now - DAY)], now).show, false);
  const five = [1, 2, 3, 4, 5].map((i) => entry('w' + i, now - i * 1000));
  assert.equal(backupReminder({ lastBackupAt: now - 2 * DAY }, five, now).show, true);
  assert.equal(backupReminder({ lastBackupAt: now - 8 * DAY, snoozeUntil: now + 1 }, five, now).show, false);
  assert.equal(backupReminder({ lastBackupAt: null }, [entry('a', now - 9 * DAY)], now).show, true);
});

test('file name', () => {
  assert.match(backupFileName(Date.UTC(2026, 10, 8, 12)), /^fitness-backup-2026-11-0[89]\.json$/);
});
