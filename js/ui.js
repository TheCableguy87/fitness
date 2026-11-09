// Tiny DOM helpers, inline SVG icons, dialog and toast.
const P = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  dash: '<path d="M6 12h12"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3v3.5c0 1.6 1 2.6 4 5.5 3-2.900 4-3.900 4-5.500V3M8 21v-3.500c0-1.600 1-2.600 4-5.500 3 2.900 4 3.900 4 5.500V21"/>',
  ring: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.500 1.500"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.01"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
  warn: '<path d="M12 3.500l9.500 16.500h-19z"/><path d="M12 10v4.500M12 17.500v.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  play: '<path d="M8 5.500v13l11-6.500z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
};

export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'icon ' + cls);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = P[name] || '';
  return s;
}

// h('div', {class:'x', onclick: fn, 'aria-label': 'y'}, child, 'text')
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const bdi = (text) => h('bdi', {}, text);

export function btn(label, cls, onclick, extra = {}) {
  return h('button', { type: 'button', class: 'btn ' + cls, onclick, ...extra }, label);
}

let toastEl = null;
let toastTimer = null;
export function toast(msg) {
  if (toastEl) toastEl.remove();
  toastEl = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(toastEl);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl && toastEl.remove(); toastEl = null; }, 3500);
}

// Promise<boolean>. Inline modal instead of window.confirm.
export function confirmDialog(message, okLabel, { danger = false } = {}) {
  return new Promise((resolve) => {
    const close = (v) => { ov.remove(); resolve(v); };
    const ov = h('div', { class: 'overlay center', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'dialog' },
        h('p', { class: 'h-card' }, message),
        btn(okLabel, danger ? 'danger' : 'primary', () => close(true)),
        btn('ביטול', 'text', () => close(false))));
    document.body.append(ov);
    ov.querySelector('button').focus();
  });
}

export function fmtDate(ts) {
  try { return new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }); } catch { return ''; }
}

export const go = (path) => { location.hash = path; };
export const rerender = () => window.dispatchEvent(new Event('fit:render'));
