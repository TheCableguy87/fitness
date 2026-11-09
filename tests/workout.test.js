import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newSession, completeSet, undoSet, skipExercise, goTo, startExerciseTimer, exerciseTimerDone, exerciseTimerFinishEarly,
  summarize, buildLog, describeTarget, recommendedDayIndex, weekStatus } from '../js/workoutState.js';
import { isDraftValid, describeDraft } from '../js/draft.js';

const plan = JSON.parse(fs.readFileSync(new URL('../data/sample-plan.json', import.meta.url), 'utf8'));
const day = plan.days[0];
const T = 1_000_000;

test('describeTarget wording', () => {
  assert.equal(describeTarget(day.exercises[2]), '3 סטים × 12');
  assert.equal(describeTarget(day.exercises[5]), '3 סטים × 8 לכל צד');
  assert.equal(describeTarget(day.exercises[6]), "3 סטים × 30 שנ'");
  assert.equal(describeTarget(day.exercises[7]), "סט אחד × 30 שנ' לכל צד");
});

test('completing a set starts rest and keeps position on the same exercise', () => {
  let s = newSession(plan, day, T);
  s = goTo(s, 2); // squat, 3 sets, rest 45
  const r = completeSet(s, day, { reps: 11 }, T + 1000);
  assert.equal(r.session.log.exercises[2].sets[0].reps, 11);
  assert.equal(r.session.exerciseIndex, 2);
  assert.equal(r.session.setIndex, 1);
  assert.equal(r.session.timer.kind, 'rest');
  assert.equal(r.restSec, 45);
});

test('last set moves to the next exercise; zero rest has no timer', () => {
  let s = newSession(plan, day, T); // exercise 0: 1 set, rest 0
  const r = completeSet(s, day, { durationSec: 90 }, T);
  assert.equal(r.session.exerciseIndex, 1);
  assert.equal(r.session.timer, null);
  assert.equal(r.session.log.exercises[0].status, 'done');
});

test('undo reopens a set', () => {
  let s = goTo(newSession(plan, day, T), 2);
  s = completeSet(s, day, { reps: 12 }, T).session;
  s = undoSet(s, 2, 0);
  assert.equal(s.log.exercises[2].sets[0].done, false);
  assert.equal(s.setIndex, 0);
  assert.equal(s.timer, null);
});

test('skip moves on; finishing everything reports finished', () => {
  let s = newSession(plan, day, T);
  let finished = false;
  for (let i = 0; i < day.exercises.length; i++) {
    const r = skipExercise(s);
    s = r.session;
    finished = r.finished;
  }
  assert.equal(finished, true);
  assert.equal(summarize(s, T + 60000).skipped, day.exercises.length);
});

test('full run builds a "done" log; partial run builds "partial"', () => {
  let s = newSession(plan, day, T);
  let r;
  let guard = 0;
  do {
    const ex = day.exercises[s.exerciseIndex];
    r = completeSet(s, day, ex.type.startsWith('time') ? { durationSec: ex.durationSec } : { reps: ex.reps }, T + ++guard);
    s = r.session;
  } while (!r.finished && guard < 100);
  assert.equal(r.finished, true);
  const log = buildLog(s, day, { rpe: 7, pain: false }, T + 5000);
  assert.equal(log.status, 'done');
  assert.equal(log.rpe, 7);
  assert.equal(log.pain, false);
  assert.equal(log.exercises[2].titleSnapshot, 'סקוואט משקל גוף');

  const p = buildLog(skipExercise(newSession(plan, day, T)).session, day, {}, T + 1);
  assert.equal(p.status, 'partial');
  assert.equal('rpe' in p, false);
});

test('time exercise: each-side runs two phases, then completes the set', () => {
  let s = goTo(newSession(plan, day, T), 7); // time_each_side, 1 set
  s = startExerciseTimer(s, day.exercises[7], T);
  assert.equal(s.timer.side, 0);
  let r = exerciseTimerDone(s, day, T + 30000);
  assert.equal(r.event, 'side');
  assert.equal(r.session.timer.side, 1);
  r = exerciseTimerDone(r.session, day, T + 60000);
  // earlier exercises are still pending, so the session wraps back to them instead of finishing
  assert.equal(r.event, 'set');
  assert.equal(r.session.exerciseIndex, 0);
  assert.equal(r.session.log.exercises[7].sets[0].durationSec, 30);
});

test('early finish records elapsed seconds', () => {
  let s = goTo(newSession(plan, day, T), 6); // plank 30s x3
  s = startExerciseTimer(s, day.exercises[6], T);
  const r = exerciseTimerFinishEarly(s, day, T + 12400);
  assert.equal(r.session.log.exercises[6].sets[0].durationSec, 12);
  assert.equal(r.event, 'set');
});

test('draft validation and description', () => {
  const s = goTo(newSession(plan, day, T), 6);
  assert.equal(isDraftValid(s, plan), true);
  assert.equal(isDraftValid(s, { ...plan, id: 'other' }), false);
  assert.equal(isDraftValid(null, plan), false);
  const bad = JSON.parse(JSON.stringify(s));
  bad.log.exercises.pop();
  assert.equal(isDraftValid(bad, plan), false);
  const d = describeDraft(startExerciseTimer(s, day.exercises[6], T), plan, T + 99999);
  assert.equal(d.text, 'נשארת באמצע: פלאנק, סט 1 מתוך 3.');
  assert.equal(d.timerExpired, true);
});

test('recommended day and week strip', () => {
  assert.equal(recommendedDayIndex(plan, []), 0);
  const now = new Date(2026, 10, 11, 12).getTime(); // Wednesday
  const mk = (dayId, t) => ({ id: dayId + t, planId: plan.id, dayId, startedAt: t, endedAt: t });
  const log = [mk('d1', new Date(2026, 10, 9, 10).getTime())];
  assert.equal(recommendedDayIndex(plan, log), 1);
  assert.deepEqual(weekStatus(plan, log, now), ['done', 'next', 'pending']);
  assert.deepEqual(weekStatus(plan, [mk('d1', new Date(2026, 10, 1).getTime())], now), ['pending', 'next', 'pending']);
});
