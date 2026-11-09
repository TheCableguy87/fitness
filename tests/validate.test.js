import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatePlan, checkPlanText, parseJson } from '../js/validate.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const sample = () => JSON.parse(fs.readFileSync(new URL('../data/sample-plan.json', import.meta.url), 'utf8'));

test('sample plan is valid', () => {
  const r = validatePlan(sample());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('missing durationSec reports a path', () => {
  const r = checkPlanText(fx('invalid-missing-duration.json'));
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [{ path: 'יום 1 > תרגיל 7', message: 'חסר durationSec' }]);
});

test('duplicate ids are rejected', () => {
  const r = checkPlanText(fx('invalid-duplicate-id.json'));
  assert.equal(r.ok, false);
  assert.match(r.errors[0].message, /id כפול/);
});

test('bad type and sets give separate errors', () => {
  const r = checkPlanText(fx('invalid-type-sets.json'));
  assert.equal(r.errors.length >= 2, true);
  assert.ok(r.errors.some((e) => /type/.test(e.message)));
  assert.ok(r.errors.some((e) => /sets/.test(e.message)));
});

test('broken JSON reports a line number', () => {
  const r = checkPlanText(fx('broken.json'));
  assert.equal(r.ok, false);
  assert.equal(r.jsonError, true);
  assert.equal(r.line, 5);
});

test('unknown ref is a warning, not an error', () => {
  const r = checkPlanText(fx('unknown-ref.json'), new Set(['ex01']));
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /ex999/.test(w.message)));
});

test('unknown extra fields are accepted and kept', () => {
  const p = sample();
  p.days[0].exercises[0].mood = 'x';
  const r = checkPlanText(JSON.stringify(p));
  assert.equal(r.ok, true);
  assert.equal(r.plan.days[0].exercises[0].mood, 'x');
});

test('limits: durationSec above 3600, negative rest, non-array equipment', () => {
  const p = sample();
  p.days[0].exercises[0].durationSec = 4000;
  p.days[0].exercises[1].restSec = -1;
  p.days[0].exercises[2].equipment = 'chair';
  const r = validatePlan(p);
  assert.equal(r.errors.length, 3);
});

test('non-object and empty days', () => {
  assert.equal(validatePlan(null).ok, false);
  assert.equal(validatePlan([]).ok, false);
  assert.equal(validatePlan({ id: 'a', title: 'b', days: [] }).ok, false);
  assert.equal(parseJson('{').ok, false);
});
