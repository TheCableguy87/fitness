import { store } from '../store.js';
import { h, btn, icon, go, toast, confirmDialog } from '../ui.js';
import { checkPlanText } from '../validate.js';

export function importView() {
  let result = null;
  const area = h('textarea', { class: 'paste', 'aria-label': 'הדבקת תוכנית JSON', placeholder: '{ "id": "...", "days": [ ... ] }', spellcheck: 'false' });
  const out = h('div', { class: 'content' });
  const bottom = h('div', { class: 'bottom' });
  const file = h('input', { type: 'file', accept: '.json,application/json', class: 'sr', tabindex: '-1' });

  const refs = () => (store.library.ok ? new Set(store.library.byRef.keys()) : null);

  function renderResult() {
    out.replaceChildren();
    bottom.replaceChildren();
    if (!result) return;
    if (result.ok) {
      const p = result.plan;
      const count = p.days.reduce((n, d) => n + d.exercises.length, 0);
      out.append(h('div', { class: 'card' },
        h('p', { class: 'ok-text' }, 'התוכנית תקינה'),
        h('p', {}, `${p.title}: ${p.days.length} ימים, ${count} תרגילים.`),
        ...result.warnings.map((w) => h('p', { class: 'sub' }, `אזהרה, ${w.path}: ${w.message}`))));
      bottom.append(btn('ייבא', 'primary', doImport));
      return;
    }
    const card = h('div', { class: 'card err', role: 'alert' }, h('div', { class: 'row' }, icon('warn', 'ic-err'), h('p', { class: 'h-card' }, 'הייבוא נכשל. כלום לא השתנה.')));
    if (result.jsonError) {
      card.append(h('p', {}, `זה לא JSON תקין${result.line ? ` (שורה ${result.line})` : ''}`));
    } else {
      const list = h('ul', { class: 'plain errs' }, result.errors.slice(0, 5).map((e) => h('li', {}, `${e.path}: ${e.message}`)));
      card.append(list);
      if (result.errors.length > 5) {
        const more = btn(`עוד ${result.errors.length - 5}`, 'text', () => {
          result.errors.slice(5).forEach((e) => list.append(h('li', {}, `${e.path}: ${e.message}`)));
          more.remove();
        });
        card.append(more);
      }
    }
    out.append(card);
    bottom.append(btn('הדבק שוב', 'secondary', () => { area.value = ''; result = null; renderResult(); area.focus(); }));
  }

  function check() {
    const text = area.value.trim();
    result = text ? checkPlanText(text, refs()) : null;
    if (!text) toast('הדבק קודם את התוכנית');
    renderResult();
  }

  async function doImport() {
    if (!result || !result.ok) return;
    if (store.plan) {
      const msg = store.session ? 'להחליף את התוכנית? האימון שנקטע יימחק. ההיסטוריה נשמרת.' : 'להחליף את התוכנית הפעילה? ההיסטוריה נשמרת.';
      if (!(await confirmDialog(msg, 'החלף'))) return;
    }
    if (store.session && store.session.planId !== result.plan.id) store.clearDraft();
    if (!store.savePlan(result.plan)) { toast('לא הצלחנו לשמור. גבה עכשיו.'); return; }
    go('#/');
  }

  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    try { area.value = await f.text(); check(); } catch { toast('לא הצלחנו לקרוא את הקובץ'); }
    file.value = '';
  });

  return h('div', { class: 'screen' },
    h('div', { class: 'topbar' }, h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'חזרה' }, icon('back'))),
    h('div', { class: 'content' },
      h('h1', { class: 'title' }, 'ייבוא תוכנית'),
      store.plan ? h('p', { class: 'sub' }, 'הייבוא מחליף את התוכנית הפעילה. ההיסטוריה נשמרת.') : null,
      area,
      h('div', { class: 'nav3', style: 'grid-template-columns:1fr 1fr' },
        btn('בחר קובץ', 'secondary', () => file.click()),
        btn('בדוק', 'secondary', check)),
      file, out),
    bottom);
}
