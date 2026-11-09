// Boot, hash router and render loop.
import { store } from './store.js';
import { installErrorHandlers, reportError } from './errors.js';
import { loadLibrary } from './library.js';
import { h, btn, go } from './ui.js';
import { homeView } from './views/home.js';
import { dayView } from './views/day.js';
import { importView } from './views/import.js';
import { workoutView } from './views/workout.js';
import { summaryView } from './views/summary.js';
import { settingsView } from './views/settings.js';

const routes = { '': homeView, day: dayView, import: importView, workout: workoutView, summary: summaryView, settings: settingsView };
const main = () => document.getElementById('app');
let cleanup = null;
let alertsEl = null;

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || '', params: parts.slice(1) };
}

function renderAlerts() {
  if (!alertsEl) { alertsEl = h('div', { class: 'alerts' }); document.body.prepend(alertsEl); }
  alertsEl.replaceChildren();
  if (store.saveFailed) {
    alertsEl.append(h('div', { class: 'banner err', role: 'alert' }, h('p', {}, 'לא הצלחנו לשמור. גבה עכשיו.'),
      btn('גבה', 'secondary', () => go('#/settings'))));
  }
}

export function render(resetScroll = false) {
  try {
    if (cleanup) { cleanup(); cleanup = null; }
    const r = parseRoute();
    const view = routes[r.name] || homeView;
    const el = view({ params: r.params });
    main().replaceChildren(el);
    if (el._cleanup) cleanup = el._cleanup;
    if (resetScroll) window.scrollTo(0, 0);
    renderAlerts();
  } catch (e) { reportError(e); }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const check = () => {
      if (reg.waiting && navigator.serviceWorker.controller) { store.updateAvailable = true; store.waitingWorker = reg.waiting; render(); }
    };
    check();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') check(); });
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (store.reloadOnUpdate) location.reload(); });
}

installErrorHandlers();
try { store.init(); } catch (e) { reportError(e); }
window.addEventListener('hashchange', () => render(true));
window.addEventListener('fit:render', () => render());
store.subscribe(renderAlerts);
window.addEventListener('pagehide', () => store.flushDraft());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flushDraft(); });
render(true);
loadLibrary('data/exercises.json').then((lib) => { store.library = lib; render(); });
registerServiceWorker();
