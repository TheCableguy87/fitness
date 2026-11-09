import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, remainingSec, remainingMs, isFinished, pauseTimer, resumeTimer, addTime, progress, formatClock, elapsedSec } from '../js/timer.js';

test('remaining is derived from timestamps (background gap)', () => {
  const t = createTimer('exercise', 30, 1000);
  assert.equal(remainingSec(t, 1000), 30);
  assert.equal(remainingSec(t, 1000 + 9000), 21);
  assert.equal(remainingSec(t, 1000 + 9001), 21);
  // app frozen for 20 seconds, then resumes
  assert.equal(remainingSec(t, 1000 + 29000), 1);
  assert.equal(isFinished(t, 1000 + 29999), false);
  assert.equal(isFinished(t, 1000 + 30000), true);
  assert.equal(remainingSec(t, 1000 + 99999), 0);
});

test('pause and resume keep the remaining time', () => {
  let t = createTimer('exercise', 30, 0);
  t = pauseTimer(t, 10000);
  assert.equal(remainingSec(t, 500000), 20);
  assert.equal(isFinished(t, 500000), false);
  t = resumeTimer(t, 600000);
  assert.equal(remainingSec(t, 605000), 15);
  assert.equal(isFinished(t, 620000), true);
});

test('addTime extends running, paused and finished timers', () => {
  const t = createTimer('rest', 40, 0);
  assert.equal(remainingSec(addTime(t, 15, 10000), 10000), 45);
  assert.equal(remainingSec(addTime(pauseTimer(t, 10000), 15, 10000), 99999), 45);
  assert.equal(remainingSec(addTime(t, 15, 50000), 50000), 15);
});

test('progress, elapsed and clock format', () => {
  const t = createTimer('exercise', 20, 0);
  assert.equal(progress(t, 10000), 0.5);
  assert.equal(progress(t, 50000), 1);
  assert.equal(elapsedSec(t, 7000), 7);
  assert.equal(elapsedSec(t, 50000), 20);
  assert.equal(formatClock(21), '0:21');
  assert.equal(formatClock(75), '1:15');
  assert.equal(formatClock(-3), '0:00');
  assert.equal(remainingMs(t, 30000), 0);
});
