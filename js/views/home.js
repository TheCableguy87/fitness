import { store } from '../store.js';
import { h, btn, icon, go, rerender, confirmDialog, bdi } from '../ui.js';
import { weekStatus, recommendedDayIndex } from '../workoutState.js';
import { describeDraft } from '../draft.js';
import { backupReminder, reminderText } from '../backup.js';
import { resumeWorkout } from './workout.js';

function updateBanner() {
  return h('div', { class: 'banner' }, icon('info', 'ic-acc'), h('p', {}, 'יש גרסה חדשה.'),
    btn('עדכן', 'secondary', () => {
      store.reloadOnUpdate = true;
      if (store.waitingWorker) store.waitingWorker.postMessage('SKIP_WAITING'); else location.reload();
    }));
}

function backupBanner(days) {
  return h('div', { class: 'banner warn' }, icon('warn', 'ic-warn'), h('p', {}, reminderText(days)),
    h('div', { class: 'row' },
      btn('גבה', 'secondary', () => go('#/settings')),
      btn('אחר כך', 'text', () => { store.saveMeta({ snoozeUntil: Date.now() + 86400000 }); rerender(); })));
}

function continueCard(info) {
  return h('div', { class: 'card' },
    h('p', { class: 'h-card' }, info.text),
    info.timerExpired ? h('p', { class: 'sub' }, 'הטיימר נגמר בזמן שלא היית כאן.') : null,
    btn('המשך', 'primary', () => resumeWorkout()),
    btn('מההתחלה', 'text', async () => {
      if (await confirmDialog('למחוק את האימון הזה?', 'מחק', { danger: true })) { store.clearDraft(); rerender(); }
    }));
}

export function homeView() {
  const { plan, log, session } = store;
  const now = Date.now();
  const content = h('div', { class: 'content' });

  const top = h('div', { class: 'topbar' },
    h('div', {}, h('h1', { class: 'title' }, 'כושר ביתי'), plan ? h('p', { class: 'sub' }, plan.title) : null),
    h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'הגדרות' }, icon('gear')));

  if (store.updateAvailable) content.append(updateBanner());
  store.notices.forEach((n) => content.append(h('div', { class: 'banner warn' }, icon('warn', 'ic-warn'), h('p', {}, n))));

  if (!plan) {
    content.append(h('div', { class: 'card empty' },
      h('p', { class: 'h-card' }, 'עוד אין תוכנית. הדבק כאן את התוכנית מהמאמן.'),
      h('a', { class: 'btn primary', href: '#/import' }, 'ייבוא')));
    return h('div', { class: 'screen' }, top, content);
  }

  const rem = backupReminder(store.meta, log, now);
  if (rem.show) content.append(backupBanner(rem.days));
  if (session) content.append(continueCard(describeDraft(session, plan, now)));

  const status = weekStatus(plan, log, now);
  const rec = recommendedDayIndex(plan, log);
  content.append(
    h('div', { class: 'label' }, 'השבוע'),
    h('div', { class: 'week' }, plan.days.map((d, i) => h('div', { class: 'sq ' + status[i] },
      icon(status[i] === 'done' ? 'check' : status[i] === 'next' ? 'arrow' : 'square', status[i] === 'next' ? 'flip' : ''),
      h('span', {}, status[i] === 'done' ? 'בוצע' : `יום ${i + 1}`)))));

  plan.days.forEach((d, i) => {
    content.append(h('a', { class: 'card day-card', href: '#/day/' + encodeURIComponent(d.id) },
      h('div', { class: 'row between' },
        h('span', { class: 'h-card' }, bdi(d.title)),
        i === rec && status[i] !== 'done' ? h('span', { class: 'chip next' }, 'הבא') : null),
      d.focus ? h('p', { class: 'sub' }, d.focus) : null,
      h('div', { class: 'meta' },
        d.estMinutes ? h('span', {}, `${d.estMinutes} דק'`) : null,
        h('span', {}, `${d.exercises.length} תרגילים`))));
  });
  return h('div', { class: 'screen' }, top, content);
}
