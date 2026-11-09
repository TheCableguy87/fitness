import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeLibrary, getExplain, getRelated, loadLibrary, emptyLibrary } from '../js/library.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const real = () => normalizeLibrary(read('../data/exercises.json'));

test('real library: 50 unique entries, all with steps and cues', () => {
  const lib = real();
  assert.equal(lib.ok, true);
  assert.equal(lib.byRef.size, 50);
  assert.deepEqual(lib.problems, []);
  for (const e of lib.byRef.values()) {
    assert.ok(e.steps.length > 0 && e.cues.length > 0 && e.setup, e.ref);
  }
});

test('real library: easier/harder refs all resolve', () => {
  const lib = real();
  for (const e of lib.byRef.values()) {
    if (e.easierRef) assert.ok(getRelated(lib, e, 'easier'), e.ref + ' easier');
    if (e.harderRef) assert.ok(getRelated(lib, e, 'harder'), e.ref + ' harder');
  }
});

test('every ref in the sample plan exists in the library', () => {
  const lib = real();
  const plan = read('../data/sample-plan.json');
  for (const d of plan.days) for (const ex of d.exercises) assert.ok(getExplain(lib, ex.ref), ex.ref);
});

test('missing and unknown ref give null', () => {
  const lib = real();
  assert.equal(getExplain(lib, undefined), null);
  assert.equal(getExplain(lib, 'ex999'), null);
  assert.equal(getRelated(lib, null, 'easier'), null);
  assert.equal(getRelated(lib, { easierRef: 'zzz' }, 'easier'), null);
});

test('corrupt library does not throw and yields no explanations', () => {
  const lib = normalizeLibrary(read('./fixtures/corrupt-library.json'));
  assert.equal(lib.ok, false);
  assert.equal(getExplain(lib, 'ex01'), null);
  assert.equal(normalizeLibrary(null).ok, false);
  assert.equal(getExplain(null, 'ex01'), null);
});

test('bad entries are skipped, good ones kept; missing arrays default to []', () => {
  const lib = normalizeLibrary({ exercises: [{ ref: 'a', name: 'A' }, { name: 'no ref' }, null] });
  assert.equal(lib.byRef.size, 1);
  assert.equal(lib.problems.length, 2);
  assert.deepEqual(lib.byRef.get('a').steps, []);
});

test('loadLibrary survives network and parse failures', async () => {
  assert.equal((await loadLibrary('x', async () => { throw new Error('offline'); })).ok, false);
  assert.equal((await loadLibrary('x', async () => ({ ok: false }))).ok, false);
  assert.equal((await loadLibrary('x', async () => ({ ok: true, json: async () => { throw new Error('bad'); } }))).ok, false);
  assert.equal((await loadLibrary('x', async () => ({ ok: true, json: async () => read('../data/exercises.json') }))).ok, true);
  assert.equal(emptyLibrary().ok, false);
});
