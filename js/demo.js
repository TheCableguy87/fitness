// Looping stick-figure demo: keyframe poses -> inverse kinematics -> inline SVG.
// Angles use one convention everywhere: 0 = up, 90 = right (screen), degrees.
import { h, icon } from './ui.js';

export const L = { torso: 70, neck: 26, upper: 38, fore: 36, thigh: 54, shin: 52, foot: 16, head: 13 };
export const GROUND = 250;
export const LIMBS = ['armN', 'armF', 'legN', 'legF'];

const rad = (d) => (d * Math.PI) / 180;
export const dir = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const mul = (p, k) => [p[0] * k, p[1] * k];
const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k));
const total = (name) => (name.startsWith('arm') ? L.upper + L.fore : L.thigh + L.shin);

// Two-bone IK. sign picks the side of the root->target line the middle joint sits on.
export function limbIK(root, target, a, b, sign) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.hypot(dx, dy) || 1e-6;
  const max = a + b - 0.01;
  const min = Math.abs(a - b) + 0.01;
  const err = d > max ? d - max : d < min ? min - d : 0;
  const dd = Math.min(max, Math.max(min, d));
  const ux = dx / d;
  const uy = dy / d;
  const x = (a * a - b * b + dd * dd) / (2 * dd);
  const hh = Math.sqrt(Math.max(0, a * a - x * x));
  return { mid: [root[0] + ux * x + uy * hh * sign, root[1] + uy * x - ux * hh * sign], end: [root[0] + ux * dd, root[1] + uy * dd], err };
}

function normTarget(v) {
  if (Array.isArray(v)) return { k: 'abs', p: v };
  if (v && v.ang !== undefined) return { k: 'pol', ang: v.ang, len: v.len };
  if (v && v.t) return { k: 'tor', u: v.t[0], v: v.t[1] };
  return null;
}

export function normalizeFrame(f) {
  const armN = normTarget(f.armN);
  const legN = normTarget(f.legN);
  return {
    hip: f.hip, torso: f.torso ?? 0, head: f.head ?? 0,
    armN, armF: normTarget(f.armF) || armN, legN, legF: normTarget(f.legF) || legN,
    fN: f.fN ?? 90, fF: f.fF ?? f.fN ?? 90,
    eN: f.eN ?? -1, eF: f.eF ?? f.eN ?? -1, kN: f.kN ?? 1, kF: f.kF ?? f.kN ?? 1,
    label: f.label, at: f.at, hold: f.hold || 0,
  };
}

export function normalizeDemo(raw) {
  const frames = raw.frames.map(normalizeFrame);
  const n = frames.length;
  return { ...raw, frames, ats: frames.map((f, i) => (f.at ?? i / n)) };
}

function geometry(frame, cfg) {
  const td = dir(frame.torso);
  const shoulder = add(frame.hip, mul(td, L.torso));
  const r = [-td[1], td[0]];
  const sw = cfg.shoulderW || 0;
  const hw = cfg.hipW || 0;
  const roots = {
    armN: add(shoulder, mul(r, sw)), armF: add(shoulder, mul(r, -sw)),
    legN: add(frame.hip, mul(r, hw)), legF: add(frame.hip, mul(r, -hw)),
  };
  return { td, r, shoulder, roots };
}

function resolveTarget(frame, name, g) {
  const t = frame[name];
  const root = g.roots[name];
  if (t.k === 'abs') return t.p;
  if (t.k === 'pol') return add(root, mul(dir(t.ang), t.len ?? total(name) - 0.1));
  return add(root, add(mul(g.td, t.u), mul(g.r, t.v)));
}

// Full joint positions for one (possibly interpolated) frame, plus reach errors.
export function solve(frame, cfg = {}) {
  const g = geometry(frame, cfg);
  const neck = dir(frame.torso + frame.head);
  const pts = { hip: frame.hip, shoulder: g.shoulder, head: add(g.shoulder, mul(neck, L.neck)), roots: g.roots };
  const errs = {};
  for (const name of LIMBS) {
    const arm = name.startsWith('arm');
    const side = name.endsWith('N') ? 'N' : 'F';
    const ik = limbIK(g.roots[name], resolveTarget(frame, name, g), arm ? L.upper : L.thigh, arm ? L.fore : L.shin, frame[(arm ? 'e' : 'k') + side]);
    pts[name] = { root: g.roots[name], mid: ik.mid, end: ik.end };
    errs[name] = ik.err;
    if (!arm) pts[name].toe = add(ik.end, mul(dir(frame['f' + side]), L.foot));
  }
  pts.errs = errs;
  return pts;
}

export function interpFrames(f0, f1, k, cfg) {
  const g0 = geometry(f0, cfg);
  const g1 = geometry(f1, cfg);
  const out = {
    hip: lerp2(f0.hip, f1.hip, k), torso: lerp(f0.torso, f1.torso, k), head: lerp(f0.head, f1.head, k),
    fN: lerp(f0.fN, f1.fN, k), fF: lerp(f0.fF, f1.fF, k),
  };
  for (const s of ['eN', 'eF', 'kN', 'kF']) out[s] = k < 0.5 ? f0[s] : f1[s];
  for (const name of LIMBS) {
    const a = f0[name];
    const b = f1[name];
    if (a.k === b.k && a.k === 'pol') out[name] = { k: 'pol', ang: lerp(a.ang, b.ang, k), len: lerp(a.len ?? total(name) - 0.1, b.len ?? total(name) - 0.1, k) };
    else if (a.k === b.k && a.k === 'tor') out[name] = { k: 'tor', u: lerp(a.u, b.u, k), v: lerp(a.v, b.v, k) };
    else out[name] = { k: 'abs', p: lerp2(resolveTarget(f0, name, g0), resolveTarget(f1, name, g1), k) };
  }
  return out;
}

// phase 0..1 -> frame (loops: the last keyframe eases back to the first)
export function frameAt(demo, phase) {
  const { frames, ats } = demo;
  const n = frames.length;
  let i = n - 1;
  for (let j = 0; j < n; j++) if (phase >= ats[j]) i = j;
  const j = (i + 1) % n;
  const start = ats[i];
  const end = j === 0 ? 1 : ats[j];
  let local = end > start ? (phase - start) / (end - start) : 0;
  const hold = frames[i].hold;
  local = Math.min(1, Math.max(0, hold ? (local - hold) / (1 - hold) : local));
  return { frame: interpFrames(frames[i], frames[j], ease(local), demo), label: local < 0.5 ? frames[i].label : frames[j].label };
}

// ---- Data loading (never throws) ----
export async function loadDemos(url, fetchFn = fetch) {
  const map = new Map();
  try {
    const res = await fetchFn(url);
    if (!res.ok) return map;
    const json = await res.json();
    for (const [ref, raw] of Object.entries((json && json.demos) || {})) {
      try { map.set(ref, normalizeDemo(raw)); } catch { /* skip a broken demo */ }
    }
  } catch { /* no demos */ }
  return map;
}
export const getDemo = (map, ref) => (map && ref && map.get(ref)) || null;

// ---- Rendering ----
const NS = 'http://www.w3.org/2000/svg';
function s(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}
const pts = (...p) => p.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');

export function createDemo(demo) {
  const accent = new Set(demo.accent || []);
  const svg = s('svg', { viewBox: '0 0 400 300', role: 'img', 'aria-label': demo.aria || demo.title || 'הדגמת תנועה' });
  const sc = demo.scale || 1;
  const scene = s('g', { transform: `translate(200 ${GROUND}) scale(${sc}) translate(-200 -${GROUND})` }, svg);
  if (demo.ground !== false) s('line', { class: 'gr', x1: 20, y1: GROUND, x2: 380, y2: GROUND }, scene);
  if (demo.chair) {
    const c = demo.chair;
    const w = c.w || 60;
    const back = c.back === 'right' ? c.x + w : c.x;
    s('polyline', { class: 'gr', points: pts([c.x, c.y], [c.x + w, c.y]) }, scene);
    s('polyline', { class: 'gr', points: pts([c.x + 4, c.y], [c.x + 4, GROUND]) }, scene);
    s('polyline', { class: 'gr', points: pts([c.x + w - 4, c.y], [c.x + w - 4, GROUND]) }, scene);
    if (c.back) s('polyline', { class: 'gr', points: pts([back, c.y], [back, c.y - 60]) }, scene);
  }
  (demo.guide || []).forEach((g) => s('line', { class: 'guide', x1: g[0], y1: g[1], x2: g[2], y2: g[3] }, scene));
  const el = {};
  const limb = (name, far) => { el[name] = s('polyline', { class: 'limb' + (far ? ' far' : '') + (accent.has(name) ? ' acc' : '') }, scene); };
  limb('legF', true); limb('armF', true);
  el.hipBar = s('line', { class: 'bar' }, scene);
  el.shBar = s('line', { class: 'bar' }, scene);
  el.torso = s('line', { class: 'torso' + (accent.has('torso') ? ' acc' : '') }, scene);
  limb('legN', false); limb('armN', false);
  el.neck = s('line', { class: 'neck' }, scene);
  el.head = s('circle', { class: 'head', r: L.head }, scene);
  const label = s('text', { class: 'lbl', x: 24, y: 48, 'text-anchor': 'start' }, svg);

  function draw(phase) {
    const { frame, label: lb } = frameAt(demo, phase);
    const p = solve(frame, demo);
    const set = (e, o) => { for (const [k, v] of Object.entries(o)) e.setAttribute(k, v); };
    for (const name of LIMBS) {
      const q = p[name];
      el[name].setAttribute('points', name.startsWith('leg') ? pts(q.root, q.mid, q.end, q.toe) : pts(q.root, q.mid, q.end));
    }
    set(el.torso, { x1: p.hip[0], y1: p.hip[1], x2: p.shoulder[0], y2: p.shoulder[1] });
    set(el.neck, { x1: p.shoulder[0], y1: p.shoulder[1], x2: p.head[0], y2: p.head[1] });
    set(el.head, { cx: p.head[0], cy: p.head[1] });
    const bar = (e, a, b, on) => { e.style.display = on ? '' : 'none'; if (on) set(e, { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }); };
    bar(el.shBar, p.roots.armN, p.roots.armF, !!demo.shoulderW);
    bar(el.hipBar, p.roots.legN, p.roots.legF, !!demo.hipW);
    label.textContent = lb || '';
    return p;
  }

  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let phase = 0;
  let playing = !reduced;
  let raf = 0;
  let last = 0;
  const toggle = h('button', { type: 'button', class: 'demo-toggle' });
  const root = h('div', { class: 'demo' }, svg, toggle);

  function paintToggle() {
    toggle.replaceChildren(icon(playing ? 'pause' : 'play'));
    toggle.setAttribute('aria-label', playing ? 'השהה הדגמה' : 'הפעל הדגמה');
  }
  function tick(now) {
    phase = (phase + (now - last) / 1000 / demo.duration) % 1;
    last = now;
    draw(phase);
    raf = requestAnimationFrame(tick);
  }
  function play() { playing = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); paintToggle(); }
  function pause() { playing = false; cancelAnimationFrame(raf); paintToggle(); }
  const flip = () => (playing ? pause() : play());
  root.addEventListener('click', flip);
  toggle.addEventListener('click', (e) => { e.stopPropagation(); flip(); });

  draw(0);
  paintToggle();
  if (playing) play();
  root._destroy = () => cancelAnimationFrame(raf);
  root._seek = (ph) => { pause(); phase = ph; return draw(ph); }; // used by checks
  return root;
}
