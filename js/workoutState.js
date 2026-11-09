// Pure workout session logic. A "session" is also the persisted draft.
import { createTimer, elapsedSec } from './timer.js';
import { isTimeType } from './validate.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
export const isEachSide = (ex) => ex.type === 'reps_each_side' || ex.type === 'time_each_side';
export const restSecFor = (ex) => (typeof ex.restSec === 'number' ? ex.restSec : 0);

export function describeTarget(ex) {
  const sets = ex.sets === 1 ? 'סט אחד' : `${ex.sets} סטים`;
  const side = isEachSide(ex) ? ' לכל צד' : '';
  const val = isTimeType(ex.type) ? `${ex.durationSec} שנ'` : `${ex.reps}`;
  return `${sets} × ${val}${side}`;
}

export function newSession(plan, day, now) {
  return {
    planId: plan.id,
    dayId: day.id,
    startedAt: now,
    exerciseIndex: 0,
    setIndex: 0,
    log: {
      exercises: day.exercises.map((ex) => ({
        exerciseId: ex.id,
        status: 'pending',
        sets: Array.from({ length: ex.sets }, () => ({ done: false })),
      })),
    },
    timer: null,
  };
}

const firstUndone = (exLog) => exLog.sets.findIndex((s) => !s.done);

// Next exercise (starting at `from`, wrapping) that is not skipped and still has an undone set.
export function findNext(session, from) {
  const list = session.log.exercises;
  for (let k = 0; k < list.length; k++) {
    const i = (from + k) % list.length;
    if (list[i].status !== 'skipped' && firstUndone(list[i]) !== -1) return { exerciseIndex: i, setIndex: firstUndone(list[i]) };
  }
  return null;
}

export function currentSetIndex(session) {
  const exLog = session.log.exercises[session.exerciseIndex];
  const i = firstUndone(exLog);
  return i === -1 ? exLog.sets.length - 1 : i;
}

// Mark the current set done with actual values. Moves the position; starts rest when needed.
export function completeSet(session, day, actual, now) {
  const s = clone(session);
  const exIdx = s.exerciseIndex;
  const exLog = s.log.exercises[exIdx];
  const ex = day.exercises[exIdx];
  const idx = firstUndone(exLog);
  if (idx === -1) return { session: s, finished: false, restSec: 0 };
  exLog.sets[idx] = { done: true, ...actual, doneAt: now };
  exLog.status = firstUndone(exLog) === -1 ? 'done' : 'pending';
  s.timer = null;
  const next = findNext(s, exIdx);
  if (!next) return { session: s, finished: true, restSec: 0 };
  s.exerciseIndex = next.exerciseIndex;
  s.setIndex = next.setIndex;
  const restSec = restSecFor(ex);
  if (restSec > 0) s.timer = createTimer('rest', restSec, now);
  return { session: s, finished: false, restSec };
}

export function undoSet(session, exIdx, setIdx) {
  const s = clone(session);
  const exLog = s.log.exercises[exIdx];
  exLog.sets[setIdx] = { done: false };
  exLog.status = 'pending';
  s.exerciseIndex = exIdx;
  s.setIndex = currentSetIndex(s);
  s.timer = null;
  return s;
}

export function skipExercise(session) {
  const s = clone(session);
  const from = s.exerciseIndex;
  s.log.exercises[from].status = 'skipped';
  s.timer = null;
  const next = findNext(s, from + 1);
  if (!next) return { session: s, finished: true };
  s.exerciseIndex = next.exerciseIndex;
  s.setIndex = next.setIndex;
  return { session: s, finished: false };
}

export function goTo(session, idx) {
  const s = clone(session);
  const count = s.log.exercises.length;
  s.exerciseIndex = Math.min(count - 1, Math.max(0, idx));
  s.setIndex = currentSetIndex(s);
  s.timer = null;
  return s;
}

export function startExerciseTimer(session, ex, now) {
  const s = clone(session);
  s.timer = createTimer('exercise', ex.durationSec, now, { side: isEachSide(ex) ? 0 : null });
  return s;
}

// Called when an exercise timer reaches zero. Returns { session, event: 'side'|'set'|'finished', ... }.
export function exerciseTimerDone(session, day, now) {
  const ex = day.exercises[session.exerciseIndex];
  const t = session.timer;
  if (isEachSide(ex) && t.side === 0) {
    const s = clone(session);
    s.timer = createTimer('exercise', ex.durationSec, now, { side: 1 });
    return { session: s, event: 'side' };
  }
  const r = completeSet(session, day, { durationSec: ex.durationSec }, now);
  return { session: r.session, event: r.finished ? 'finished' : 'set', restSec: r.restSec };
}

// "Finish" pressed during an exercise timer: record elapsed time.
export function exerciseTimerFinishEarly(session, day, now) {
  const t = session.timer;
  const secs = Math.max(1, elapsedSec(t, now));
  const r = completeSet(session, day, { durationSec: secs }, now);
  return { session: r.session, event: r.finished ? 'finished' : 'set', restSec: r.restSec };
}

export function clearTimer(session) {
  const s = clone(session);
  s.timer = null;
  return s;
}

export function summarize(session, now) {
  let done = 0;
  let skipped = 0;
  let setsDone = 0;
  let setsTotal = 0;
  session.log.exercises.forEach((e) => {
    setsTotal += e.sets.length;
    setsDone += e.sets.filter((x) => x.done).length;
    if (e.status === 'done') done++; else skipped++;
  });
  return { done, skipped, setsDone, setsTotal, durationSec: Math.max(0, Math.round((now - session.startedAt) / 1000)) };
}

// Final WorkoutLog entry. Exercises not fully done become "skipped" (their done sets stay recorded).
export function buildLog(session, day, { rpe, pain } = {}, now) {
  const exercises = session.log.exercises.map((e, i) => ({
    exerciseId: e.exerciseId,
    titleSnapshot: day.exercises[i].name,
    status: e.status === 'done' ? 'done' : 'skipped',
    sets: e.sets,
  }));
  const entry = {
    id: `w-${session.startedAt}`,
    planId: session.planId,
    dayId: session.dayId,
    dayTitleSnapshot: day.title,
    startedAt: session.startedAt,
    endedAt: now,
    status: exercises.every((e) => e.status === 'done') ? 'done' : 'partial',
    exercises,
  };
  if (typeof rpe === 'number') entry.rpe = rpe;
  if (typeof pain === 'boolean') entry.pain = pain;
  return entry;
}

// ---- Home helpers ----
export function weekStart(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function recommendedDayIndex(plan, log) {
  const mine = log.filter((l) => l.planId === plan.id).sort((a, b) => b.endedAt - a.endedAt);
  if (!mine.length) return 0;
  const idx = plan.days.findIndex((d) => d.id === mine[0].dayId);
  return idx === -1 ? 0 : (idx + 1) % plan.days.length;
}

// Per-day status for the week strip: 'done' | 'next' | 'pending'
export function weekStatus(plan, log, now) {
  const start = weekStart(now);
  const doneIds = new Set(log.filter((l) => l.planId === plan.id && l.endedAt >= start).map((l) => l.dayId));
  const rec = recommendedDayIndex(plan, log);
  return plan.days.map((d, i) => (doneIds.has(d.id) ? 'done' : i === rec ? 'next' : 'pending'));
}
