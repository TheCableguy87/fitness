import { store } from '../store.js';
import { h, btn, icon, go, toast, bdi } from '../ui.js';
import { summarize, buildLog } from '../workoutState.js';
import { formatClock } from '../timer.js';
import { releaseWakeLock } from '../wakelock.js';

const form = { rpe: null, pain: null };

export function summaryView() {
  const s = store.session;
  const day = s && store.plan && store.plan.days.find((d) => d.id === s.dayId);
  if (!day) { setTimeout(() => go('#/'), 0); return h('div', { class: 'screen' }); }
  const now = Date.now();
  const sum = summarize(s, now);
  const redraw = () => window.dispatchEvent(new Event('fit:render'));

  const rows = s.log.exercises.map((e, i) => {
    const done = e.status === 'done';
    const part = e.sets.filter((x) => x.done).length;
    return h('div', { class: 'sum-row' + (done ? '' : ' skipped') },
      icon(done ? 'check' : 'dash', done ? 'ic-ok' : ''),
      h('span', { class: 'grow' }, bdi(day.exercises[i].name)),
      h('span', { class: done ? 'ic-ok label' : 'label' }, done ? 'בוצע' : part ? `דולג, ${part}/${e.sets.length} סטים` : 'דולג'));
  });

  const rpeBtns = Array.from({ length: 10 }, (_, i) => h('button', {
    type: 'button', 'aria-pressed': String(form.rpe === i + 1), 'aria-label': `מאמץ ${i + 1}`,
    onclick: () => { form.rpe = form.rpe === i + 1 ? null : i + 1; redraw(); },
  }, String(i + 1)));
  const yn = (val, label) => h('button', { type: 'button', 'aria-pressed': String(form.pain === val), onclick: () => { form.pain = form.pain === val ? null : val; redraw(); } }, label);

  function save() {
    const entry = buildLog(s, day, { rpe: form.rpe ?? undefined, pain: form.pain ?? undefined }, Date.now());
    if (!store.addLog(entry)) { toast('לא הצלחנו לשמור. גבה עכשיו.'); return; }
    store.clearDraft();
    releaseWakeLock();
    form.rpe = null; form.pain = null;
    go('#/');
    toast('האימון נשמר');
  }

  return h('div', { class: 'screen' },
    h('div', { class: 'topbar' }, h('h1', { class: 'title' }, 'סיכום אימון')),
    h('div', { class: 'content' },
      h('div', { class: 'metrics' },
        h('div', { class: 'metric' }, h('b', { class: 'num' }, formatClock(sum.durationSec)), h('span', { class: 'label' }, 'משך')),
        h('div', { class: 'metric' }, h('b', { class: 'num' }, String(sum.done)), h('span', { class: 'label' }, 'בוצע')),
        h('div', { class: 'metric' }, h('b', { class: 'num' }, String(sum.skipped)), h('span', { class: 'label' }, 'דולג'))),
      h('div', { class: 'card' }, rows),
      h('div', { class: 'card' }, h('p', { class: 'h-card' }, 'כמה קשה היה? (אופציונלי)'), h('div', { class: 'rpe' }, rpeBtns)),
      h('div', { class: 'card' }, h('p', { class: 'h-card' }, 'היה כאב? (אופציונלי)'),
        h('div', { class: 'yn' }, yn(true, 'כן'), yn(false, 'לא')),
        form.pain === true ? h('p', { class: 'sub' }, 'זה לא ייעוץ רפואי.') : null)),
    h('div', { class: 'bottom' },
      btn('שמור', 'primary', save),
      btn('חזרה לאימון', 'text', () => go('#/workout'))));
}
