import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeDemo, solve, frameAt, loadDemos, getDemo, limbIK, L } from '../js/demo.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const demos = read('../data/demos.json').demos;
const refs = new Set(read('../data/exercises.json').exercises.map((e) => e.ref));
const PLAN_REFS = 'ex35 ex31 ex17 ex20 ex01 ex27 ex34 ex33 ex13 ex18 ex09 ex21 ex28 ex29 ex19 ex22'.split(' ');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('every demo has a valid ref, at least 2 keyframes and a duration', () => {
  for (const [ref, d] of Object.entries(demos)) {
    assert.ok(refs.has(ref), `unknown ref ${ref}`);
    assert.ok(d.frames.length >= 2 && d.frames.length <= 4, `${ref} keyframes`);
    assert.ok(d.duration > 0, `${ref} duration`);
    assert.ok(typeof d.aria === 'string' && d.aria.length > 10, `${ref} aria`);
  }
});

test('all 16 plan exercises have a demo', () => {
  for (const r of PLAN_REFS) assert.ok(demos[r], r);
});

test('every keyframe is reachable and limb lengths stay constant', () => {
  for (const [ref, raw] of Object.entries(demos)) {
    const d = normalizeDemo(raw);
    d.frames.forEach((f, i) => {
      const p = solve(f, d);
      for (const [limb, err] of Object.entries(p.errs)) assert.ok(err < 0.6, `${ref} frame ${i} ${limb} out of reach by ${err.toFixed(1)}`);
      assert.ok(Math.abs(dist(p.hip, p.shoulder) - L.torso) < 0.01);
      for (const limb of ['armN', 'armF']) {
        assert.ok(Math.abs(dist(p[limb].root, p[limb].mid) - L.upper) < 0.01 && Math.abs(dist(p[limb].mid, p[limb].end) - L.fore) < 0.01, `${ref} ${limb}`);
      }
      for (const limb of ['legN', 'legF']) {
        assert.ok(Math.abs(dist(p[limb].root, p[limb].mid) - L.thigh) < 0.01 && Math.abs(dist(p[limb].mid, p[limb].end) - L.shin) < 0.01, `${ref} ${limb}`);
      }
    });
  }
});

test('interpolated poses stay finite, in view, and limbs keep their lengths', () => {
  for (const [ref, raw] of Object.entries(demos)) {
    const d = normalizeDemo(raw);
    for (let k = 0; k <= 100; k++) {
      const { frame } = frameAt(d, k / 100);
      const p = solve(frame, d);
      for (const limb of ['armN', 'armF', 'legN', 'legF']) {
        for (const pt of [p[limb].mid, p[limb].end]) {
          assert.ok(Number.isFinite(pt[0]) && Number.isFinite(pt[1]), `${ref} NaN at ${k}`);
          assert.ok(pt[0] > -40 && pt[0] < 440 && pt[1] > -40 && pt[1] < 340, `${ref} off canvas at ${k}`);
        }
      }
      // straight-leg exercises must not flex the knee while rotating: thigh+shin reach stays ~full
    }
  }
});

test('straight-leg raise keeps the leg straight through the whole rotation (ex33)', () => {
  const d = normalizeDemo(demos.ex33);
  for (let k = 0; k <= 50; k++) {
    const p = solve(frameAt(d, k / 100).frame, d);
    assert.ok(dist(p.legN.root, p.legN.end) > 105, `bent at ${k}`);
  }
});

test('loop is continuous: phase 0 and phase ~1 give the same pose', () => {
  for (const [ref, raw] of Object.entries(demos)) {
    const d = normalizeDemo(raw);
    const a = solve(frameAt(d, 0).frame, d);
    const b = solve(frameAt(d, 0.9999).frame, d);
    assert.ok(dist(a.hip, b.hip) < 1 && dist(a.head, b.head) < 1, ref);
  }
});

test('IK picks the bend side and clamps unreachable targets', () => {
  const a = limbIK([0, 0], [0, 80], 54, 52, 1);
  assert.ok(a.mid[0] > 0);
  assert.equal(limbIK([0, 0], [0, 80], 54, 52, -1).mid[0] < 0, true);
  assert.ok(limbIK([0, 0], [0, 500], 54, 52, 1).err > 300);
});

test('loadDemos: missing and corrupt data give an empty map; ref without demo gives null', async () => {
  assert.equal((await loadDemos('x', async () => { throw new Error('offline'); })).size, 0);
  assert.equal((await loadDemos('x', async () => ({ ok: false }))).size, 0);
  assert.equal((await loadDemos('x', async () => ({ ok: true, json: async () => ({ demos: 5 }) }))).size, 0);
  const ok = await loadDemos('x', async () => ({ ok: true, json: async () => ({ demos: { ex01: demos.ex01, bad: { frames: 7 } } }) }));
  assert.equal(ok.size, 1);
  assert.ok(getDemo(ok, 'ex01'));
  assert.equal(getDemo(ok, 'ex99'), null);
  assert.equal(getDemo(ok, undefined), null);
});
