// Wake Lock with a graceful fallback: callers show a hint when `active` stays false.
let sentinel = null;
let wanted = false;

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
export const wakeLockActive = () => !!(sentinel && !sentinel.released);

async function acquire() {
  if (!wakeLockSupported() || wakeLockActive()) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { /* re-acquired on visibilitychange */ });
  } catch { sentinel = null; }
}

export async function requestWakeLock() { wanted = true; await acquire(); return wakeLockActive(); }

export async function releaseWakeLock() {
  wanted = false;
  try { if (sentinel) await sentinel.release(); } catch { /* ignore */ }
  sentinel = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted) acquire();
  });
}
