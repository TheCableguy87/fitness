import { store } from '../store.js';
import { h, btn, icon, go, rerender, confirmDialog, bdi } from '../ui.js';
import { newSession, completeSet, undoSet, skipExercise, goTo, startExerciseTimer, exerciseTimerDone, exerciseTimerFinishEarly,
  clearTimer, isEachSide, describeTarget, currentSetIndex } from '../workoutState.js';
import { remainingSec, isFinished, isPaused, pauseTimer, resumeTimer, addTime, progress, formatClock } from '../timer.js';
import { isTimeType } from '../validate.js';
import { unlockAudio, beep } from '../audio.js';
import { requestWakeLock, releaseWakeLock, wakeLockActive } from '../wakelock.js';
import { getExplain } from '../library.js';
import { openExplain } from './explain.js';

// Local, non-persisted UI state; reset when the position changes.
const ui = { key: '', reps: null, chip: null, flash: false, announce: '' };

const CIRC = 2 * Math.PI * 130;

export async function beginWorkout(day) {
  if (store.session) {
    if (!(await confirmDialog('יש אימון שנקטע. להתחיל מחדש ולמחוק אותו?', 'התחל מחדש', { danger: true }))) return;
  }
  unlockAudio();
  store.setSession(newSession(store.plan, day, Date.now()));
  store.flushDraft();
  if (store.settings.wakeLock) requestWakeLock().then(rerender);
  go('#/workout');
}

export function resumeWorkout() {
  unlockAudio();
  if (store.settings.wakeLock) requestWakeLock().then(rerender);
  go('#/workout');
}

export function leaveWorkout() {
  store.flushDraft();
  releaseWakeLock();
}

function svgEl(name, attrs) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function ring(t, now, rest) {
  const sw = rest ? 8 : 14;
  const base = { cx: 140, cy: 140, r: 130, 'stroke-width': sw };
  const fill = svgEl('circle', { ...base, class: 'fill', 'stroke-dasharray': CIRC, 'stroke-dashoffset': CIRC * (1 - progress(t, now)) });
  const svg = svgEl('svg', { viewBox: '0 0 280 280', 'aria-hidden': 'true' });
  svg.append(svgEl('circle', { ...base, class: 'track' }), fill);
  const digits = h('div', { class: 'digits num' }, formatClock(remainingSec(t, now)));
  const el = h('div', { class: 'ring' + (rest ? ' rest' : ''), role: 'timer' }, svg, digits);
  return {
    el,
    update(t2, n) {
      digits.textContent = formatClock(remainingSec(t2, n));
      fill.setAttribute('stroke-dashoffset', String(CIRC * (1 - progress(t2, n))));
    },
  };
}

function setValue(ex, set) {
  if (isTimeType(ex.type)) return `${set.durationSec ?? ex.durationSec} שנ'`;
  return String(set.reps ?? ex.reps);
}

export function workoutView() {
  const plan = store.plan;
  const s = store.session;
  const day = s && plan && plan.days.find((d) => d.id === s.dayId);
  if (!day) { setTimeout(() => go('#/'), 0); return h('div', { class: 'screen' }); }

  const now = Date.now();
  const exIdx = s.exerciseIndex;
  const ex = day.exercises[exIdx];
  const exLog = s.log.exercises[exIdx];
  const setIdx = currentSetIndex(s);
  const key = `${s.startedAt}:${exIdx}:${setIdx}`;
  if (ui.key !== key) { ui.key = key; ui.reps = ex.reps || 0; ui.chip = null; }
  const t = s.timer;
  const inRest = t && t.kind === 'rest';
  const inTimer = t && t.kind === 'exercise';
  const total = day.exercises.length;

  const apply = (next) => { store.setSession(next); rerender(); };
  const toSummary = (next) => { store.setSession(next); store.flushDraft(); go('#/summary'); };
  const afterSet = (r) => (r.event === 'finished' || r.finished ? toSummary(r.session) : apply(r.session));

  const seg = h('div', { class: 'seg', 'aria-hidden': 'true' }, s.log.exercises.map((e, i) =>
    h('i', { class: e.status === 'done' ? 'done' : i === exIdx ? 'cur' : '' })));
  const topbar = h('div', { class: 'topbar' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'יציאה', onclick: () => { leaveWorkout(); go('#/'); } }, icon('x')),
    h('div', { class: 'grow', style: 'display:flex;flex-direction:column;gap:8px' },
      h('span', { class: 'label' }, `${exIdx + 1} מתוך ${total}`), seg));

  const content = h('div', { class: 'content' });
  const bottom = h('div', { class: 'bottom' });
  const root = h('div', { class: 'screen' + (ui.flash ? ' flash' : '') }, topbar, content, bottom);
  ui.flash = false;
  if (ui.announce) { root.append(h('div', { class: 'sr', 'aria-live': 'polite' }, ui.announce)); ui.announce = ''; }

  // Fallback hint: shown for the first seconds of a visit to the workout screen only.
  if (ui.hintFor !== s.startedAt) { ui.hintFor = s.startedAt; ui.hintUntil = now + 15000; }
  if (store.settings.wakeLock && !wakeLockActive() && now < ui.hintUntil) {
    content.append(h('div', { class: 'hint' }, icon('info'), h('span', {}, 'המסך עלול להיכבות. הגדר נעילה אוטומטית ל-5 דקות או לעולם.')));
  }

  let live = null; // { ring, t } updated by the tick
  const explainBtn = () => {
    const entry = getExplain(store.library, ex.ref);
    if (!entry) return null;
    return h('button', { type: 'button', class: 'btn secondary', style: 'min-height:48px', onclick: () => openExplain(ex.ref) }, icon('info'), 'איך עושים');
  };

  if (inRest) {
    const done = isFinished(t, now);
    const r = ring(t, now, true);
    live = { ring: r, t };
    const nextEx = ex;
    content.append(
      h('div', { class: 'timer-wrap' },
        h('div', { class: 'row label' }, icon('hourglass'), done ? 'המנוחה הסתיימה' : 'מנוחה'),
        r.el),
      h('div', { class: 'card' }, h('span', { class: 'label' }, 'הבא'),
        h('p', { class: 'h-card' }, bdi(nextEx.name)),
        h('p', { class: 'sub' }, `סט ${setIdx + 1} מתוך ${nextEx.sets}`)));
    bottom.append(
      btn(done ? 'המשך' : 'דלג', 'primary', () => apply(clearTimer(s))),
      done ? null : btn("+15 שנ'", 'secondary', () => apply({ ...s, timer: addTime(t, 15, Date.now()) })));
  } else if (inTimer) {
    const r = ring(t, now, false);
    live = { ring: r, t };
    const paused = isPaused(t);
    content.append(
      h('h2', { class: 'ex-title' }, bdi(ex.name)),
      h('div', { class: 'timer-wrap' },
        t.side != null ? h('div', { class: 'side-label' }, t.side === 0 ? 'צד ימין' : 'צד שמאל') : null,
        r.el,
        h('div', { class: 'label' }, `סט ${setIdx + 1} מתוך ${ex.sets}`)),
      explainBtn());
    bottom.append(
      btn(h('span', { class: 'row' }, icon(paused ? 'play' : 'pause'), paused ? 'המשך' : 'השהה'), 'primary', () => {
        apply({ ...s, timer: paused ? resumeTimer(t, Date.now()) : pauseTimer(t, Date.now()) });
      }),
      btn('סיים', 'text', () => afterSet(exerciseTimerFinishEarly(s, day, Date.now()))));
  } else {
    content.append(h('h2', { class: 'ex-title' }, bdi(ex.name)));
    const cues = Array.isArray(ex.cues) ? ex.cues.join(', ') : ex.cues;
    if (cues) content.append(h('p', { class: 'cues' }, cues));
    content.append(h('p', { class: 'label' }, describeTarget(ex)));

    const chips = [];
    if (ex.easier) chips.push(['easier', 'קל יותר']);
    if (ex.harder) chips.push(['harder', 'קשה יותר']);
    if (chips.length) {
      content.append(h('div', { class: 'row', style: 'flex-wrap:wrap' }, chips.map(([k, label]) =>
        h('button', { type: 'button', class: 'chip', 'aria-expanded': String(ui.chip === k), onclick: () => { ui.chip = ui.chip === k ? null : k; rerender(); } }, label))));
      if (ui.chip) content.append(h('div', { class: 'card' }, h('span', { class: 'label' }, ui.chip === 'easier' ? 'קל יותר' : 'קשה יותר'), h('p', {}, ex[ui.chip])));
    }
    content.append(explainBtn());

    const skippedEx = exLog.status === 'skipped';
    content.append(h('div', { class: 'sets' }, exLog.sets.map((set, i) => {
      const cur = i === setIdx && !set.done;
      const cls = set.done ? 'done' : cur ? 'cur' : skippedEx ? 'skipped' : '';
      const ic = set.done ? 'check' : cur ? 'arrow' : skippedEx ? 'dash' : 'square';
      const word = set.done ? 'בוצע' : cur ? 'עכשיו' : skippedEx ? 'דולג' : '';
      if (cur && !isTimeType(ex.type)) {
        // The reps stepper lives inside the current set row so the main action stays on screen.
        const val = h('span', { class: 'num' }, String(ui.reps));
        const step = (d) => { ui.reps = Math.min(1000, Math.max(0, ui.reps + d)); val.textContent = String(ui.reps); };
        return h('div', { class: 'set-row cur' },
          icon('arrow', 'flip ic-acc'),
          h('div', { class: 'grow' }, h('div', { class: 'w' }, `סט ${i + 1}`), h('div', { class: 'label' }, 'עכשיו')),
          h('div', { class: 'stepper' },
            h('button', { type: 'button', 'aria-label': 'הפחת חזרה', onclick: () => step(-1) }, icon('minus')),
            h('div', { class: 'val' }, val),
            h('button', { type: 'button', 'aria-label': 'הוסף חזרה', onclick: () => step(1) }, icon('plus'))));
      }
      return h('button', {
        type: 'button', class: 'set-row ' + cls, 'aria-label': set.done ? `סט ${i + 1} בוצע, לחיצה מבטלת` : `סט ${i + 1}`,
        onclick: () => { if (set.done) apply(undoSet(s, exIdx, i)); },
      }, icon(ic, cur ? 'flip ic-acc' : ''), h('span', { class: 'w' }, `סט ${i + 1}`), h('span', { class: 'label' }, word),
      h('span', { class: 'v num' }, setValue(ex, set.done ? set : {})));
    })));

    if (!isTimeType(ex.type)) {
      bottom.append(btn('סיימתי', 'primary', () => afterSet(completeSet(s, day, { reps: ui.reps }, Date.now()))));
    } else {
      bottom.append(btn('התחל', 'primary', () => { unlockAudio(); apply(startExerciseTimer(s, ex, Date.now())); }));
    }
    const last = exIdx === total - 1;
    bottom.append(h('div', { class: 'nav3' },
      h('button', { type: 'button', class: 'btn secondary', disabled: exIdx === 0, onclick: () => apply(goTo(s, exIdx - 1)) }, icon('arrow'), 'הקודם'),
      h('button', { type: 'button', class: 'btn text', onclick: async () => {
        if (await confirmDialog('לדלג על התרגיל?', 'דלג', { danger: true })) {
          const r = skipExercise(s);
          r.finished ? toSummary(r.session) : apply(r.session);
        }
      } }, 'דלג'),
      h('button', { type: 'button', class: 'btn secondary', onclick: () => (last ? toSummary(clearTimer(s)) : apply(goTo(s, exIdx + 1))) },
        last ? 'סיום' : 'הבא', last ? null : icon('arrow', 'flip'))));
  }

  // Timestamp ticker: display and finish detection derive from Date.now().
  if (live) {
    const iv = setInterval(() => {
      const n = Date.now();
      const cur = store.session && store.session.timer;
      if (!cur) return;
      live.ring.update(cur, n);
      if (!isFinished(cur, n) || cur.notified) return;
      beep(store.settings.sound);
      ui.flash = true;
      ui.announce = cur.kind === 'rest' ? 'המנוחה הסתיימה' : 'הטיימר הסתיים';
      if (cur.kind === 'rest') { store.setSession({ ...store.session, timer: { ...cur, notified: true } }); rerender(); return; }
      const r = exerciseTimerDone(store.session, day, n);
      r.event === 'finished' ? toSummary(r.session) : apply(r.session);
    }, 250);
    const onVis = () => { if (document.visibilityState === 'visible') live.ring.update(store.session.timer || live.t, Date.now()); };
    document.addEventListener('visibilitychange', onVis);
    root._cleanup = () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }
  return root;
}
