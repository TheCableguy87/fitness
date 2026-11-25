// Generates data/demos.json. Poses are authored with contact points (hands, feet) and solved
// geometrically so limb lengths stay consistent. Run: node tools/build-demos.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { L, dir } from '../js/demo.js';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/demos.json');
const LEG = 105.9; // ankle-to-hip distance for a (nearly) straight leg
const ARM = 72; // shoulder-to-hand distance for a (nearly) straight arm

const angOf = (from, to) => (Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI;
const upper = (p, q) => (p[1] < q[1] ? p : q);
const lower = (p, q) => (p[1] > q[1] ? p : q);
function inter(c0, r0, c1, r1, pick) {
  const dx = c1[0] - c0[0];
  const dy = c1[1] - c0[1];
  const d = Math.hypot(dx, dy);
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const m = [c0[0] + ux * a, c0[1] + uy * a];
  return pick([m[0] + uy * hh, m[1] - ux * hh], [m[0] - uy * hh, m[1] + ux * hh]);
}
// Body with a known shoulder and ankle (plank, push-up, pike): hip is the third point.
function fromSA(S, A, pick = upper) {
  const hip = inter(S, L.torso, A, LEG, pick);
  return { hip, torso: angOf(hip, S) };
}
// Body with a known hip and hand: shoulder is found from the arm distance.
function fromHH(hip, hand, armDist, pick = upper) {
  const S = inter(hip, L.torso, hand, armDist, pick);
  return { hip, torso: angOf(hip, S) };
}
const P = (o) => o;
const flat = 90;

const demos = {};

// --- standing ---
demos.ex01 = {
  title: 'סקוואט משקל גוף', aria: 'הדגמה: סקוואט. האגן יורד אחורה ולמטה עד שהירכיים במקביל לרצפה, הגב ישר, הידיים לפנים, ואז חוזרים לעמידה.',
  duration: 3.6, accent: ['legN', 'legF'],
  frames: [
    P({ hip: [190, 144], torso: 0, armN: { ang: 90, len: 73.9 }, legN: [190, 246], fN: flat, hold: 0.2 }),
    P({ hip: [160, 196], torso: 35, head: -22, armN: { ang: 90, len: 73.9 }, legN: [190, 246], fN: flat, hold: 0.2 }),
  ],
};

demos.ex35 = {
  title: 'צעידה במקום / ברכיים גבוהות', aria: 'הדגמה: צעידה במקום. הרגליים מתחלפות, כל פעם ברך אחת עולה עד גובה האגן, והזרוע ההפוכה נעה קדימה, בגו זקוף.',
  duration: 1.1, accent: ['legN', 'legF'],
  frames: [
    P({ hip: [190, 144], torso: 2, armN: { t: [-65, -26] }, armF: { t: [-20, 40] }, legN: [240, 190], fN: 140, legF: [190, 246], fF: flat }),
    P({ hip: [190, 144], torso: 2, armN: { t: [-20, 40] }, armF: { t: [-65, -26] }, legN: [190, 246], fN: flat, legF: [240, 190], fF: 140 }),
  ],
};

demos.ex09 = {
  title: 'הטיית ירכיים (Good morning)', aria: 'הדגמה: הטיית ירכיים. הברכיים כפופות מעט, האגן נדחף אחורה והגו מוטה קדימה בגב ישר, הידיים מאחורי הראש, ואז חוזרים לעמידה.',
  duration: 3.6, accent: ['torso'],
  frames: [
    P({ hip: [190, 144], torso: 0, armN: { t: [30, -8] }, legN: [190, 246], fN: flat, hold: 0.2 }),
    P({ hip: [164, 146], torso: 66, armN: { t: [30, -8] }, legN: [190, 246], fN: flat, hold: 0.25 }),
  ],
};

// --- prone support ---
const HAND = [262, 246];
const ANKLE_PLANK = [97.4, 236];
{
  const top = fromSA([262, 174], ANKLE_PLANK);
  const kneeDrive = [222, 238];
  const back = ANKLE_PLANK;
  demos.ex31 = {
    title: 'מטפסי הרים', aria: 'הדגמה: מטפסי הרים. בתנוחת שכיבת סמיכה גבוהה, הידיים מתחת לכתפיים, מביאים ברך אחת אל החזה ומחליפים רגליים במהירות, והאגן נשאר יציב.',
    duration: 1.0, accent: ['legN', 'legF'],
    frames: [
      P({ ...top, head: -8, armN: HAND, legN: kneeDrive, fN: 140, legF: back, fF: 150 }),
      P({ ...top, head: -8, armN: HAND, legN: back, fN: 150, legF: kneeDrive, fF: 140 }),
    ],
  };
  const bottom = fromSA([272, 217], ANKLE_PLANK);
  demos.ex17 = {
    title: 'שכיבות סמיכה', aria: 'הדגמה: שכיבת סמיכה. הגוף בקו ישר מהראש עד העקבים, המרפקים מתכופפים אחורה והחזה יורד כמעט לרצפה, ואז דוחפים חזרה למעלה.',
    duration: 3.0, accent: ['armN', 'armF'],
    frames: [
      P({ ...top, head: -6, armN: HAND, legN: ANKLE_PLANK, fN: 150, hold: 0.15 }),
      P({ ...bottom, head: -6, armN: HAND, legN: ANKLE_PLANK, fN: 150, hold: 0.15 }),
    ],
  };
}

{
  const A = [105, 181];
  const H = [280, 246];
  const top = fromSA([280, 174], A);
  const bottom = fromSA([277, 216], A);
  demos.ex18 = {
    title: 'שכיבות סמיכה, רגליים מורמות', aria: 'הדגמה: שכיבת סמיכה עם כפות הרגליים על כיסא. הגוף בקו ישר, המרפקים מתכופפים והחזה יורד, ואז דוחפים חזרה למעלה.',
    duration: 3.2, accent: ['armN', 'armF'], chair: { x: 60, y: 195, w: 60, back: 'left' },
    frames: [
      P({ ...top, head: -6, armN: H, legN: A, fN: 150, hold: 0.15 }),
      P({ ...bottom, head: -6, armN: H, legN: A, fN: 150, hold: 0.15 }),
    ],
  };
}

{
  const Hd = [250, 246];
  const A = [105, 240];
  const topS = [Hd[0] + 72 * dir(-30)[0], Hd[1] + 72 * dir(-30)[1]];
  demos.ex19 = {
    title: 'פייק פוש-אפ', aria: 'הדגמה: פייק פוש-אפ. הגוף בצורת V הפוכה עם האגן גבוה, המרפקים מתכופפים והראש יורד בין הידיים, ואז דוחפים חזרה למעלה.',
    duration: 3.2, accent: ['armN', 'armF'],
    frames: [
      P({ ...fromSA(topS, A), head: 0, armN: Hd, legN: A, fN: 120, hold: 0.15 }),
      P({ ...fromSA([250, 198], A), head: 0, armN: Hd, legN: A, fN: 120, hold: 0.15 }),
    ],
  };
}

{
  const A = [88.4, 236];
  const g = (S) => fromSA(S, A);
  const f1 = g([262, 209]);
  const line = [A[0], A[1], 262 + 40 * dir(f1.torso)[0] + 0, 209 + 40 * dir(f1.torso)[1]];
  demos.ex27 = {
    title: 'פלאנק', aria: 'הדגמה: פלאנק על אמות הידיים. המרפקים מתחת לכתפיים והגוף בקו ישר מהראש עד העקבים, בלי שהאגן צונח או עולה. החזקה במקום עם נשימה רגילה.',
    duration: 4.0, accent: ['torso'], guide: [line],
    frames: [
      P({ ...f1, armN: [298, 246], legN: A, fN: 150 }),
      P({ ...g([262, 207.5]), armN: [298, 246], legN: A, fN: 150 }),
    ],
  };
}

{
  const E = [298, 246];
  const topA = [89, 240];
  const lowA = [102, 240];
  const S = [262, 209];
  demos.ex28 = {
    title: 'פלאנק צידי', aria: 'הדגמה: פלאנק צידי, מבט מהצד של הגוף. הגוף על אמה אחת, האגן מתרומם מהרצפה עד קו ישר מהראש עד הרגליים, הזרוע העליונה כלפי מעלה, ואז יורדים לאט.',
    duration: 3.6, accent: ['torso'],
    frames: [
      P({ ...fromSA(S, lowA, lower), head: 0, armN: E, armF: { ang: 0 }, legN: lowA, fN: flat, hold: 0.15 }),
      P({ ...fromSA(S, topA, upper), head: 0, armN: E, armF: { ang: 0 }, legN: topA, fN: flat, hold: 0.25 }),
    ],
  };
}

// --- chair work ---
{
  const hand = [148, 192];
  const ankle = [240, 244];
  demos.ex20 = {
    title: 'דיפס על כיסא', aria: 'הדגמה: דיפס על כיסא. הידיים על קצה המושב מאחור, האגן קרוב לכיסא, המרפקים מתכופפים אחורה עד זווית ישרה והגוף יורד, ואז דוחפים חזרה למעלה.',
    duration: 3.2, accent: ['armN', 'armF'], chair: { x: 100, y: 195, w: 60, back: 'left' },
    frames: [
      P({ ...fromHH([166, 190], hand, ARM), armN: hand, legN: ankle, fN: flat, hold: 0.15 }),
      P({ ...fromHH([172, 226], hand, 51), armN: hand, legN: ankle, fN: flat, hold: 0.15 }),
    ],
  };
}

demos.ex13 = {
  title: 'עליית מדרגה (כיסא)', aria: 'הדגמה: עליית מדרגה. רגל אחת על הכיסא, דוחפים בה ועולים עד עמידה מלאה על הכיסא כשהברך השנייה מורמת, ואז יורדים בשליטה.',
  duration: 4.0, scale: 0.8, accent: ['legN'], chair: { x: 250, y: 195, w: 60, back: 'right' },
  frames: [
    P({ hip: [222, 146], torso: 12, head: -10, armN: { ang: 178, len: 70 }, legN: [268, 189], fN: flat, legF: [205, 246], fF: flat, hold: 0.1 }),
    P({ hip: [248, 118], torso: 6, head: -6, armN: { ang: 178, len: 70 }, legN: [268, 189], fN: flat, legF: [236, 206], fF: 120 }),
    P({ hip: [270, 90], torso: 0, armN: { ang: 178, len: 70 }, legN: [270, 190], fN: flat, legF: [322, 142], fF: 120, hold: 0.25 }),
  ],
};

// --- lying on the back (head to the left) ---
const LYING = [200, 237];
demos.ex33 = {
  title: 'הרמת רגליים בשכיבה', aria: 'הדגמה: הרמת רגליים בשכיבה על הגב. הגב התחתון צמוד לרצפה, הרגליים ישרות עולות עד 90 מעלות ויורדות לאט עד כמעט לרצפה בלי לגעת בה.',
  duration: 3.8, accent: ['legN', 'legF'],
  frames: [
    P({ hip: LYING, torso: -90, armN: [200, 244], legN: { ang: 84, len: 105.9 }, fN: 0, hold: 0.2 }),
    P({ hip: LYING, torso: -90, armN: [200, 244], legN: { ang: 0, len: 105.9 }, fN: -90, hold: 0.2 }),
  ],
};

{
  const common = { hip: LYING, torso: -62, head: -10, armN: { t: [30, -8] } };
  const bent = [282, 184];
  const straight = { ang: 78, len: 105.9 };
  demos.ex34 = {
    title: 'אופניים (Bicycle crunch)', aria: 'הדגמה: אופניים בשכיבה. הידיים מאחורי הראש, הכתפיים מורמות מהרצפה, רגל אחת מקופלת אל החזה והשנייה מתארכת, והרגליים מתחלפות בקצב איטי.',
    duration: 2.4, accent: ['legN', 'legF'],
    frames: [
      P({ ...common, legN: bent, fN: 20, legF: straight, fF: -12 }),
      P({ ...common, legN: straight, fN: -12, legF: bent, fF: 20 }),
    ],
  };
  const up = { ang: 0, len: 73.9 };
  const tab = [254, 183];
  const ext = { ang: 80, len: 105.9 };
  const over = { ang: -84, len: 73.9 };
  const base = { hip: LYING, torso: -90 };
  demos.ex29 = {
    title: 'Dead bug', aria: 'הדגמה: Dead bug. שוכבים על הגב, הידיים למעלה והברכיים מעל האגן בזווית 90 מעלות. מורידים יד אחת מעל הראש ורגל מנוגדת קדימה כמעט עד הרצפה, חוזרים ומחליפים צד.',
    duration: 7.0, accent: ['armN', 'armF', 'legN', 'legF'],
    frames: [
      P({ ...base, armN: up, legN: tab, fN: 20, hold: 0.2 }),
      P({ ...base, armN: over, armF: up, legN: tab, legF: ext, fN: 20, fF: -10, hold: 0.2 }),
      P({ ...base, armN: up, legN: tab, fN: 20, hold: 0.2 }),
      P({ ...base, armN: up, armF: over, legN: ext, legF: tab, fN: -10, fF: 20, hold: 0.2 }),
    ],
  };
}

// --- lying on the belly (head to the right) ---
demos.ex21 = {
  title: 'סופרמן', aria: 'הדגמה: סופרמן. שוכבים על הבטן, מרימים יחד ידיים ורגליים מעט מהרצפה, הצוואר ניטרלי והמבט לרצפה, עוצרים רגע ויורדים לאט.',
  duration: 3.4, accent: ['armN', 'armF', 'legN', 'legF'],
  frames: [
    P({ hip: [150, 237], torso: 90, armN: { ang: 90, len: 73.9 }, legN: { ang: -90, len: 105.9 }, fN: 180, hold: 0.25 }),
    P({ hip: [150, 237], torso: 85, armN: { ang: 76, len: 73.9 }, legN: { ang: -76, len: 105.9 }, fN: 180, hold: 0.3 }),
  ],
};

{
  const hip = [200, 150];
  const L1 = (ang) => ({ ang, len: 73.9 });
  const legs = { legN: { ang: 180, len: 105.9 }, fN: 180 };
  demos.ex22 = {
    title: 'Y-T-W בשכיבה על הבטן', aria: 'הדגמה: Y-T-W, מבט מלמעלה על אדם שוכב על הבטן. הידיים מורמות לפי הסדר: בצורת Y קדימה ולצדדים, אחר כך T ישר לצדדים, ואחר כך W עם מרפקים כפופים.',
    duration: 7.5, shoulderW: 24, hipW: 8, ground: false, accent: ['armN', 'armF'],
    frames: [
      P({ hip, torso: 0, ...legs, armN: L1(35), armF: L1(-35), eN: -1, eF: 1, label: 'Y', hold: 0.3 }),
      P({ hip, torso: 0, ...legs, armN: L1(90), armF: L1(-90), eN: -1, eF: 1, label: 'T', hold: 0.3 }),
      P({ hip, torso: 0, ...legs, armN: [268, 70], armF: [132, 70], eN: -1, eF: 1, label: 'W', hold: 0.3 }),
    ],
  };
}

const round = (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);
fs.writeFileSync(out, JSON.stringify({ version: 1, demos }, round, 1) + '\n');
console.log('wrote', Object.keys(demos).length, 'demos');
