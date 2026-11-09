// "How to do it" bottom sheet. Opens over the workout without stopping a running timer.
import { store } from '../store.js';
import { h, btn, icon, bdi } from '../ui.js';
import { getExplain, getRelated } from '../library.js';
import { remainingSec } from '../timer.js';
import { formatClock } from '../timer.js';

const section = (title, body) => h('div', {}, h('h3', {}, title), body);

function timerLabel() {
  const s = store.session;
  if (!s || !s.timer) return '';
  const day = store.plan && store.plan.days.find((d) => d.id === s.dayId);
  if (!day) return '';
  const name = s.timer.kind === 'rest' ? 'מנוחה' : day.exercises[s.exerciseIndex].name;
  return `${name} ${formatClock(remainingSec(s.timer, Date.now()))}`;
}

export function openExplain(ref) {
  const first = getExplain(store.library, ref);
  if (!first) return;
  const stack = [first];
  const body = h('div', { class: 'sheet-body' });
  const strip = h('div', { class: 'timer-strip', 'aria-hidden': 'true' });
  const foot = h('div', { class: 'sheet-foot' });
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const close = () => { clearInterval(iv); ov.remove(); document.body.style.overflow = prevOverflow; };
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'איך עושים' }, body, foot);
  const ov = h('div', { class: 'overlay' }, sheet);

  function draw() {
    const e = stack[stack.length - 1];
    body.replaceChildren();
    body.append(h('h2', { class: 'ex-title' }, bdi(e.name)));
    const chips = [...e.muscles, ...e.equipment.map((q) => q)];
    if (chips.length) body.append(h('div', { class: 'row', style: 'flex-wrap:wrap' }, chips.map((c) => h('span', { class: 'chip' }, bdi(c)))));
    if (e.setup) body.append(section('תנוחת התחלה', h('p', {}, e.setup)));
    if (e.steps.length) body.append(section('שלבים', h('ol', {}, e.steps.map((x) => h('li', {}, x)))));
    if (e.cues.length) body.append(section('דגשים', h('ul', {}, e.cues.map((x) => h('li', {}, icon('check', 'ic-ok'), x)))));
    if (e.mistakes.length) body.append(section('טעויות נפוצות', h('ul', { class: 'mist' }, e.mistakes.map((x) => h('li', {}, icon('warn', 'ic-warn'), x)))));
    if (e.breathing) body.append(section('נשימה', h('p', {}, e.breathing)));
    if (e.safety) body.append(section('בטיחות', h('p', {}, e.safety)));
    body.scrollTop = 0;

    foot.replaceChildren();
    const easier = getRelated(store.library, e, 'easier');
    const harder = getRelated(store.library, e, 'harder');
    const swap = (target) => { stack.push(target); draw(); };
    if (stack.length > 1) foot.append(btn(`חזרה ל${stack[0].name}`, 'secondary', () => { stack.length = 1; draw(); }));
    if (easier) foot.append(btn(`גרסה קלה: ${easier.name}`, 'secondary', () => swap(easier)));
    if (harder) foot.append(btn(`גרסה קשה: ${harder.name}`, 'secondary', () => swap(harder)));
    foot.append(btn('סגור', 'primary', close));
  }

  const tickStrip = () => {
    const label = timerLabel();
    strip.textContent = label;
    strip.style.display = label ? '' : 'none';
  };
  const iv = setInterval(tickStrip, 500);
  sheet.prepend(strip);
  tickStrip();
  draw();
  document.body.append(ov);
  foot.lastChild.focus();
}
