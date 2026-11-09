import { store } from '../store.js';
import { h, btn, icon, go, bdi } from '../ui.js';
import { describeTarget } from '../workoutState.js';
import { getExplain } from '../library.js';
import { openExplain } from './explain.js';
import { beginWorkout } from './workout.js';

export function dayView({ params }) {
  const day = store.plan && store.plan.days.find((d) => d.id === params[0]);
  if (!day) { setTimeout(() => go('#/'), 0); return h('div', { class: 'screen' }); }

  const list = h('div', { class: 'ex-list' }, day.exercises.map((ex, i) => {
    const entry = getExplain(store.library, ex.ref);
    return h('div', { class: 'ex-row' },
      h('span', { class: 'n num' }, String(i + 1)),
      h('div', { class: 'grow' }, h('div', { class: 'ex-name' }, bdi(ex.name)), h('div', { class: 'sub' }, describeTarget(ex))),
      entry ? h('button', { type: 'button', class: 'icon-btn ic-acc', 'aria-label': `איך עושים: ${ex.name}`, onclick: () => openExplain(ex.ref) }, icon('info')) : null);
  }));

  return h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'חזרה' }, icon('back')),
      h('span', { class: 'label' }, day.estMinutes ? `${day.estMinutes} דק'` : '')),
    h('div', { class: 'content' },
      h('h1', { class: 'title' }, bdi(day.title)),
      day.focus ? h('p', { class: 'sub' }, day.focus) : null,
      list),
    h('div', { class: 'bottom' }, btn('התחל', 'primary', () => beginWorkout(day))));
}
