// Draft (interrupted workout) helpers. The draft is the live session object.
import { KEYS } from './storage.js';
import { isFinished } from './timer.js';

// A draft is usable only if it still matches the active plan.
export function isDraftValid(draft, plan) {
  if (!draft || !plan || draft.planId !== plan.id) return false;
  const day = plan.days.find((d) => d.id === draft.dayId);
  if (!day || !draft.log || !Array.isArray(draft.log.exercises)) return false;
  if (draft.log.exercises.length !== day.exercises.length) return false;
  if (!draft.log.exercises.every((e, i) => e.exerciseId === day.exercises[i].id && Array.isArray(e.sets) && e.sets.length === day.exercises[i].sets)) return false;
  return Number.isInteger(draft.exerciseIndex) && draft.exerciseIndex >= 0 && draft.exerciseIndex < day.exercises.length;
}

export function describeDraft(draft, plan, now) {
  const day = plan.days.find((d) => d.id === draft.dayId);
  const ex = day.exercises[draft.exerciseIndex];
  const exLog = draft.log.exercises[draft.exerciseIndex];
  const idx = exLog.sets.findIndex((s) => !s.done);
  const setNo = (idx === -1 ? exLog.sets.length - 1 : idx) + 1;
  return {
    text: `נשארת באמצע: ${ex.name}, סט ${setNo} מתוך ${ex.sets}.`,
    timerExpired: !!(draft.timer && isFinished(draft.timer, now)),
    day,
  };
}

// Debounced writer plus an immediate flush (used on pagehide).
export function createDraftSaver(storage, getSession, onFail) {
  let timer = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    const s = getSession();
    if (!s) return;
    if (!storage.write(KEYS.draft, s) && onFail) onFail();
  };
  return {
    schedule() { clearTimeout(timer); timer = setTimeout(flush, 300); },
    flush,
    cancel() { clearTimeout(timer); timer = null; },
  };
}
