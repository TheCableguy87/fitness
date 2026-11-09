import { store } from '../store.js';
import { h, btn, icon, go, toast, confirmDialog, fmtDate } from '../ui.js';
import { buildBackup, parseBackup, mergeBackup, replaceWithBackup, backupFileName } from '../backup.js';
import { wakeLockSupported } from '../wakelock.js';

const VERSION = '1.0.0';

function toggle(label, checked, onChange) {
  const sw = h('span', { class: 'switch', 'aria-hidden': 'true' });
  const row = h('button', { type: 'button', class: 'toggle-btn', role: 'switch', 'aria-checked': String(checked), onclick: () => {
    checked = !checked;
    row.setAttribute('aria-checked', String(checked));
    sw.setAttribute('aria-checked', String(checked));
    onChange(checked);
  } }, h('span', {}, label), sw);
  sw.setAttribute('aria-checked', String(checked));
  return row;
}

async function exportBackup() {
  const now = Date.now();
  const json = JSON.stringify(buildBackup({ plan: store.plan, log: store.log, settings: store.settings }, now), null, 2);
  const name = backupFileName(now);
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'גיבוי כושר' });
    } else {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = h('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    store.saveMeta({ lastBackupAt: now, snoozeUntil: 0 });
    toast('הגיבוי נשמר');
    return true;
  } catch (e) {
    if (e && e.name === 'AbortError') return false; // user closed the share sheet
    toast('הייצוא נכשל');
    return false;
  }
}

export function settingsView() {
  const redraw = () => window.dispatchEvent(new Event('fit:render'));
  const importOut = h('div', { class: 'content', style: 'padding:0' });
  const file = h('input', { type: 'file', accept: '.json,application/json', class: 'sr', tabindex: '-1' });

  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    importOut.replaceChildren();
    if (!f) return;
    let r;
    try { r = parseBackup(await f.text()); } catch { r = { ok: false, errors: ['לא הצלחנו לקרוא את הקובץ'] }; }
    file.value = '';
    if (!r.ok) {
      importOut.append(h('div', { class: 'card err', role: 'alert' }, h('p', { class: 'h-card' }, 'הייבוא נכשל. כלום לא השתנה.'), ...r.errors.map((e) => h('p', {}, e))));
      return;
    }
    const b = r.backup;
    importOut.append(h('div', { class: 'card' },
      h('p', { class: 'h-card' }, `בגיבוי: ${b.log.length} אימונים${b.plan ? ', תוכנית ' + b.plan.title : ''}.`),
      btn('מיזוג', 'secondary', () => {
        const m = mergeBackup({ plan: store.plan, log: store.log, settings: store.settings }, b);
        store.replaceAll({ plan: m.plan, log: m.log, settings: m.settings });
        toast(`נוספו ${m.added} אימונים`); redraw();
      }),
      btn('החלפה', 'danger', async () => {
        if (!(await confirmDialog('להחליף את כל הנתונים בגיבוי?', 'החלף', { danger: true }))) return;
        store.replaceAll(replaceWithBackup(b));
        toast('הנתונים הוחלפו'); redraw();
      }),
      btn('ביטול', 'text', () => importOut.replaceChildren())));
  });

  const last = store.meta.lastBackupAt;
  const err = store.meta.lastError;
  return h('div', { class: 'screen' },
    h('div', { class: 'topbar' }, h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'חזרה' }, icon('back')), h('h1', { class: 'title grow' }, 'הגדרות')),
    h('div', { class: 'content' },
      h('div', { class: 'card' },
        toggle('צליל', store.settings.sound, (v) => store.saveSettings({ sound: v })),
        toggle('מסך דלוק באימון', store.settings.wakeLock, (v) => store.saveSettings({ wakeLock: v })),
        !wakeLockSupported() ? h('p', { class: 'sub' }, 'המסך עלול להיכבות באמצע.') : null),
      h('div', { class: 'card' },
        h('p', { class: 'h-card' }, 'גיבוי'),
        h('p', { class: 'sub' }, last ? `גיבוי אחרון: ${fmtDate(last)}` : 'עוד לא גיבית.'),
        btn('ייצוא גיבוי', 'primary', async () => { if (await exportBackup()) redraw(); }),
        btn('ייבוא גיבוי', 'secondary', () => file.click()),
        file, importOut),
      h('div', { class: 'card' },
        h('p', { class: 'h-card' }, 'תוכנית'),
        h('a', { class: 'btn secondary', href: '#/import' }, store.plan ? 'ייבוא תוכנית חדשה' : 'ייבוא תוכנית')),
      h('div', { class: 'card' },
        h('p', { class: 'h-card' }, 'מצב התקנה'),
        h('p', { class: 'sub' }, window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'מותקנת במסך הבית.' : 'פתוחה בדפדפן. כדי להתקין: שיתוף, ואז הוסף למסך הבית.'),
        h('p', { class: 'sub' }, store.persisted ? 'אחסון קבוע: כן.' : 'אחסון קבוע: לא אושר. גבה בקביעות.'),
        h('p', { class: 'sub' }, `גרסה ${VERSION}`)),
      err ? h('div', { class: 'card' }, h('p', { class: 'h-card' }, 'שגיאה אחרונה'), h('pre', { class: 'errlog' }, `${new Date(err.at).toLocaleString('he-IL')}\n${err.text}`)) : null,
      btn('איפוס נתונים', 'danger', async () => {
        if (!(await confirmDialog('למחוק את כל הנתונים? אי אפשר לשחזר.', 'מחק הכל', { danger: true }))) return;
        store.resetAll();
        go('#/');
      })));
}
