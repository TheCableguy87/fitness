// Prints frames whose limb targets are out of reach (pose authoring errors).
import fs from 'node:fs';
import { normalizeDemo, solve } from '../js/demo.js';

const j = JSON.parse(fs.readFileSync(new URL('../data/demos.json', import.meta.url), 'utf8'));
let bad = 0;
for (const [ref, d] of Object.entries(j.demos)) {
  const n = normalizeDemo(d);
  n.frames.forEach((f, i) => {
    const errs = Object.entries(solve(f, n).errs).filter(([, v]) => v > 0.6);
    if (errs.length) { bad++; console.log(ref, 'frame', i, errs.map(([k, v]) => `${k}:${v.toFixed(1)}`).join(' ')); }
  });
}
console.log(bad ? 'reach errors: ' + bad : 'all poses reachable');
