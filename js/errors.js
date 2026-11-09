// Global error handling: show a recovery screen, remember the last error, never loop.
import { h, btn } from './ui.js';
import { store } from './store.js';

let shown = false;

function describe(e) {
  try {
    const msg = (e && (e.stack || e.message)) || String(e);
    return String(msg).slice(0, 600);
  } catch { return 'unknown'; }
}

export function reportError(e) {
  const text = describe(e);
  try { store.saveMeta({ lastError: { at: Date.now(), text } }); } catch { /* ignore */ }
  if (shown) return;
  shown = true;
  try {
    const box = h('div', { class: 'crash', role: 'alert' },
      h('div', { class: 'title' }, 'משהו השתבש'),
      h('p', { class: 'sub' }, 'הנתונים שלך נשמרו. אפשר להמשיך.'),
      btn('המשך', 'primary', () => { box.remove(); shown = false; location.hash = '#/'; location.reload(); }));
    document.body.append(box);
  } catch { /* ignore */ }
}

export function installErrorHandlers() {
  window.addEventListener('error', (ev) => reportError(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
}
