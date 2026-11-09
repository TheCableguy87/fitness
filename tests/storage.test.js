import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, migrateEnvelope, SCHEMA_VERSION, KEYS } from '../js/storage.js';

const memBackend = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } };
};

test('write then read round-trips with an envelope', () => {
  const b = memBackend();
  const s = createStorage(b);
  assert.equal(s.write(KEYS.log, [{ id: 'a' }]), true);
  assert.deepEqual(JSON.parse(b.m.get('fit.log')), { schemaVersion: SCHEMA_VERSION, data: [{ id: 'a' }] });
  assert.deepEqual(s.read(KEYS.log).data, [{ id: 'a' }]);
});

test('missing key returns the default', () => {
  const s = createStorage(memBackend());
  assert.deepEqual(s.read(KEYS.log).data, []);
  assert.equal(s.read(KEYS.plan).data, null);
  assert.equal(s.read(KEYS.settings).data.sound, true);
});

test('migration: legacy v0 settings get defaults and a version', () => {
  const m = migrateEnvelope('settings', { sound: false });
  assert.equal(m.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(m.data, { sound: false, vibrate: false, wakeLock: true });
});

test('migration: legacy non-array log becomes an empty array; v0 array kept', () => {
  assert.deepEqual(migrateEnvelope('log', { x: 1 }).data, []);
  assert.deepEqual(migrateEnvelope('log', [{ id: 'q' }]).data, [{ id: 'q' }]);
});

test('data from a newer schema is not touched', () => {
  const b = memBackend();
  b.m.set('fit.log', JSON.stringify({ schemaVersion: 99, data: [1] }));
  const r = createStorage(b).read(KEYS.log);
  assert.equal(r.tooNew, true);
  assert.deepEqual(r.data, []);
  assert.ok(b.m.has('fit.log'));
});

test('corrupt JSON is quarantined, not deleted', () => {
  const b = memBackend();
  b.m.set('fit.plan', '{not json');
  const s = createStorage(b);
  const r = s.read(KEYS.plan);
  assert.equal(r.corrupt, true);
  assert.equal(r.data, null);
  assert.equal(b.m.get('fit.plan_corrupt'), '{not json');
  assert.equal(s.hasCorrupt(KEYS.plan), true);
});

test('quota error on write does not throw and is reported', () => {
  let reported = 0;
  const bad = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  const s = createStorage(bad, () => { reported++; });
  assert.equal(s.write(KEYS.log, []), false);
  assert.equal(reported, 1);
});

test('throwing backend on read does not throw', () => {
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => {}, removeItem: () => {} };
  assert.deepEqual(createStorage(bad).read(KEYS.log).data, []);
});
