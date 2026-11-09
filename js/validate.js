// Pure plan validation. Returns { ok, errors: [{path, message}], warnings: [...] }.
export const TYPES = ['reps', 'reps_each_side', 'time', 'time_each_side'];
export const isRepsType = (t) => t === 'reps' || t === 'reps_each_side';
export const isTimeType = (t) => t === 'time' || t === 'time_each_side';

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isInt = (v) => Number.isInteger(v);

// Parse JSON text; on failure report the line number when it can be found.
export function parseJson(text) {
  try { return { ok: true, value: JSON.parse(text) }; } catch (e) {
    let line = null;
    const m = /position (\d+)/.exec(e.message || '');
    if (m) line = text.slice(0, Number(m[1])).split('\n').length;
    else {
      const l = /line (\d+)/.exec(e.message || '');
      if (l) line = Number(l[1]);
    }
    return { ok: false, line };
  }
}

export function validatePlan(plan, knownRefs = null) {
  const errors = [];
  const warnings = [];
  const err = (path, message) => errors.push({ path, message });
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    err('תוכנית', 'התוכנית חייבת להיות אובייקט');
    return { ok: false, errors, warnings };
  }
  if (!isStr(plan.id)) err('תוכנית', 'חסר id');
  if (!isStr(plan.title)) err('תוכנית', 'חסר title');
  if (plan.weeks !== undefined && !(isInt(plan.weeks) && plan.weeks >= 1 && plan.weeks <= 52)) err('תוכנית', 'weeks חייב להיות מספר שלם בין 1 ל-52');
  if (!Array.isArray(plan.days) || plan.days.length === 0) {
    err('תוכנית', 'חסר days (מערך לא ריק)');
    return { ok: false, errors, warnings };
  }
  const ids = new Set();
  const dupe = (id, path) => { if (ids.has(id)) err(path, `id כפול: ${id}`); else ids.add(id); };

  plan.days.forEach((day, di) => {
    const dp = `יום ${di + 1}`;
    if (!day || typeof day !== 'object') { err(dp, 'היום חייב להיות אובייקט'); return; }
    if (!isStr(day.id)) err(dp, 'חסר id'); else dupe(day.id, dp);
    if (!isStr(day.title)) err(dp, 'חסר title');
    if (day.focus !== undefined && typeof day.focus !== 'string') err(dp, 'focus חייב להיות טקסט');
    if (day.estMinutes !== undefined && !(typeof day.estMinutes === 'number' && day.estMinutes >= 1 && day.estMinutes <= 600)) err(dp, 'estMinutes חייב להיות בין 1 ל-600');
    if (!Array.isArray(day.exercises) || day.exercises.length === 0) { err(dp, 'חסר exercises (מערך לא ריק)'); return; }
    day.exercises.forEach((ex, ei) => {
      const p = `${dp} > תרגיל ${ei + 1}`;
      if (!ex || typeof ex !== 'object') { err(p, 'התרגיל חייב להיות אובייקט'); return; }
      if (!isStr(ex.id)) err(p, 'חסר id'); else dupe(ex.id, p);
      if (!isStr(ex.name)) err(p, 'חסר name');
      if (!TYPES.includes(ex.type)) err(p, `type לא תקין (${TYPES.join(', ')})`);
      if (!(isInt(ex.sets) && ex.sets >= 1 && ex.sets <= 20)) err(p, 'sets חייב להיות מספר שלם בין 1 ל-20');
      if (isRepsType(ex.type)) {
        if (ex.reps === undefined) err(p, 'חסר reps');
        else if (!(isInt(ex.reps) && ex.reps >= 1 && ex.reps <= 1000)) err(p, 'reps חייב להיות בין 1 ל-1000');
      }
      if (isTimeType(ex.type)) {
        if (ex.durationSec === undefined) err(p, 'חסר durationSec');
        else if (!(isInt(ex.durationSec) && ex.durationSec >= 1 && ex.durationSec <= 3600)) err(p, 'durationSec חייב להיות בין 1 ל-3600');
      }
      if (ex.restSec !== undefined && !(typeof ex.restSec === 'number' && ex.restSec >= 0 && ex.restSec <= 3600)) err(p, 'restSec חייב להיות בין 0 ל-3600');
      if (ex.equipment !== undefined && !Array.isArray(ex.equipment)) err(p, 'equipment חייב להיות מערך');
      if (ex.cues !== undefined && typeof ex.cues !== 'string' && !Array.isArray(ex.cues)) err(p, 'cues חייב להיות טקסט');
      if (ex.ref !== undefined) {
        if (!isStr(ex.ref)) err(p, 'ref חייב להיות טקסט');
        else if (knownRefs && !knownRefs.has(ex.ref)) warnings.push({ path: p, message: `ref לא מוכר בספרייה: ${ex.ref}` });
      }
    });
  });
  return { ok: errors.length === 0, errors, warnings };
}

// Text -> result in one shape for the import screen.
export function checkPlanText(text, knownRefs = null) {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, jsonError: true, line: parsed.line, errors: [], warnings: [] };
  const r = validatePlan(parsed.value, knownRefs);
  return { ...r, plan: r.ok ? parsed.value : null };
}
