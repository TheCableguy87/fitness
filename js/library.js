// Exercise library (read-only explanations). Failures never throw: explanations are just unavailable.
const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const str = (v) => (typeof v === 'string' ? v : '');

export function emptyLibrary() { return { ok: false, byRef: new Map(), problems: [] }; }

export function normalizeLibrary(json) {
  const lib = emptyLibrary();
  if (!json || typeof json !== 'object' || !Array.isArray(json.exercises)) {
    lib.problems.push('ספרייה פגומה');
    return lib;
  }
  json.exercises.forEach((e, i) => {
    if (!e || typeof e !== 'object' || typeof e.ref !== 'string' || typeof e.name !== 'string') {
      lib.problems.push(`רשומה ${i + 1} לא תקינה`);
      return;
    }
    lib.byRef.set(e.ref, {
      ref: e.ref, name: e.name, muscles: arr(e.muscles), equipment: arr(e.equipment), level: str(e.level),
      setup: str(e.setup), steps: arr(e.steps), cues: arr(e.cues), mistakes: arr(e.mistakes),
      breathing: str(e.breathing), safety: str(e.safety), easierRef: str(e.easierRef), harderRef: str(e.harderRef),
    });
  });
  lib.ok = lib.byRef.size > 0;
  return lib;
}

export async function loadLibrary(url, fetchFn = fetch) {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return emptyLibrary();
    return normalizeLibrary(await res.json());
  } catch {
    return emptyLibrary();
  }
}

export function getExplain(lib, ref) {
  if (!lib || !lib.ok || typeof ref !== 'string') return null;
  return lib.byRef.get(ref) || null;
}

// kind: 'easier' | 'harder'. Returns the related entry or null (missing or unknown ref).
export function getRelated(lib, entry, kind) {
  if (!entry) return null;
  return getExplain(lib, kind === 'easier' ? entry.easierRef : entry.harderRef);
}
