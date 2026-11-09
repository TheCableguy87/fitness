// Timestamp-based timers. Time is derived from Date.now(), never from counting ticks.
export function createTimer(kind, durationSec, now, extra = {}) {
  return { kind, startedAt: now, durationSec, endAt: now + durationSec * 1000, pausedRemainingMs: null, ...extra };
}
export function isPaused(t) { return t.pausedRemainingMs != null; }
export function remainingMs(t, now) {
  if (isPaused(t)) return Math.max(0, t.pausedRemainingMs);
  return Math.max(0, t.endAt - now);
}
export const remainingSec = (t, now) => Math.ceil(remainingMs(t, now) / 1000);
export function isFinished(t, now) { return !isPaused(t) && now >= t.endAt; }
export function pauseTimer(t, now) {
  if (isPaused(t)) return t;
  return { ...t, pausedRemainingMs: Math.max(0, t.endAt - now) };
}
export function resumeTimer(t, now) {
  if (!isPaused(t)) return t;
  return { ...t, endAt: now + t.pausedRemainingMs, pausedRemainingMs: null };
}
export function addTime(t, sec, now) {
  if (isPaused(t)) return { ...t, pausedRemainingMs: t.pausedRemainingMs + sec * 1000, durationSec: t.durationSec + sec };
  const base = Math.max(t.endAt, now);
  return { ...t, endAt: base + sec * 1000, durationSec: t.durationSec + sec };
}
// 0..1 of elapsed time
export function progress(t, now) {
  const total = t.durationSec * 1000;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - remainingMs(t, now) / total));
}
export function elapsedSec(t, now) {
  const total = t.durationSec * 1000;
  return Math.round((total - Math.min(total, remainingMs(t, now))) / 1000);
}
export function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
