// Round-2 batch validator (dev tool, not shipped). Run: node .validate-round2.mjs
import fs from 'fs';
const norm = v => String(v || '').trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
const FILES = [
  'lessons/a1/present-continuous.html',
  'lessons/a1/there-is-there-are.html',
  'lessons/a1/can-for-ability-and-permission.html',
  'lessons/a1/adverbs-of-frequency.html',
  'lessons/a1/prepositions-of-time-and-place.html',
  'lessons/a1/some-any-with-countable-and-uncountable-nouns.html',
  'lessons/a1/object-pronouns.html',
  'lessons/a1/imperatives.html',
  'lessons/a1/was-were.html',
  'lessons/a0/animals.html',
];
let anyBad = false;
for (const p of FILES) {
  const s = fs.readFileSync(p, 'utf8');
  const bad = [];
  // quiz contract
  const items = [...s.matchAll(/<[^>]*data-quiz-item[^>]*>/g)];
  items.forEach((m, i) => {
    const end = items[i + 1] ? items[i + 1].index : m.index + 2500;
    const block = s.slice(m.index, end);
    const am = m[0].match(/data-answer="([^"]*)"/);
    if (!am) { bad.push('quiz item missing data-answer'); return; }
    const opts = [...block.matchAll(/data-quiz-option="([^"]*)"/g)].map(x => norm(x[1]));
    if (opts.length && !opts.includes(norm(am[1]))) bad.push(`quiz answer "${am[1]}" not in options`);
  });
  // choice-gap vs bank
  const drills = s.split(/(?=<div class="practice" data-choice-gap-drill)/).slice(1);
  for (const d of drills) {
    const bank = [...d.matchAll(/data-choice-option="([^"]*)"/g)].map(x => norm(x[1]));
    const gaps = [...d.matchAll(/data-choice-gap data-answer="([^"]*)"/g)].map(x => norm(x[1]));
    for (const g of gaps) if (bank.length && !bank.includes(g)) bad.push(`gap answer "${g}" not in bank`);
  }
  // builders
  const builders = [...s.matchAll(/data-tile-builder data-answer="([^"]*)"[\s\S]*?data-build-area/g)];
  for (const b of builders) {
    const tiles = [...b[0].matchAll(/data-build-tile="([^"]*)"/g)].map(x => norm(x[1]));
    const a = norm(b[1]).split(' ').sort().join(' ');
    const t = tiles.flatMap(x => x.split(' ')).sort().join(' ');
    if (a !== t) bad.push(`builder "${b[1]}" tiles mismatch`);
  }
  // spot-error
  const spots = [...s.matchAll(/data-spot-error data-answer="([^"]*)"[\s\S]*?data-error-feedback/g)];
  for (const sp of spots) {
    const ch = [...sp[0].matchAll(/data-error-choice="([^"]*)"/g)].map(x => norm(x[1]));
    if (!ch.includes(norm(sp[1]))) bad.push(`spot answer "${sp[1]}" not among choices`);
  }
  // wiring + inline CSS + em dashes + images
  if (!s.includes('lesson.css')) bad.push('missing lesson.css');
  if (!s.includes('lesson.js')) bad.push('missing lesson.js');
  const style = (s.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
  if (style.length > 200) bad.push(`inline <style> present (${style.length}b)`);
  const visible = s.replace(/<[^>]+>/g, '');
  const em = (visible.match(/—/g) || []).length;
  if (em) bad.push(`${em} em dashes in visible copy`);
  for (const im of [...s.matchAll(/<img[^>]*src="([^"]+)"/g)]) {
    const rel = im[1];
    if (!/^https?:/.test(rel)) {
      const dir = p.split('/').slice(0, -1).join('/');
      const target = new URL(rel, 'file:///' + dir + '/').pathname.slice(1);
      if (!fs.existsSync(target)) bad.push(`missing image ${rel}`);
    }
  }
  // census vs minimums
  const c = re => (s.match(re) || []).length;
  const gaps = c(/data-choice-gap(?!-)/g), typed = c(/answer-input/g), quiz = c(/data-quiz-item/g),
    xf = c(/data-transform-item/g), build = c(/data-tile-builder/g), spot = c(/data-spot-error/g);
  const finalQuiz = (s.split(/Final quiz/i)[1]?.match(/data-quiz-item/g) || []).length;
  const words = visible.replace(/\s+/g, ' ').split(' ').length;
  const isA0 = p.includes('/a0/');
  if (gaps + typed < 8) bad.push(`only ${gaps + typed} gap+typed items (<8)`);
  if (finalQuiz < 6) bad.push(`final quiz only ${finalQuiz} items (<6)`);
  if (xf < 1) bad.push('no transform drill');
  if (!/Read and choose/i.test(s) && !isA0) bad.push('no Read and choose section');
  if (!/Read and choose|read, then choose/i.test(s) && isA0) bad.push('no reading block');
  const status = bad.length ? 'FAIL' : 'ok  ';
  if (bad.length) anyBad = true;
  console.log(`${status} ${p.padEnd(62)} gaps:${gaps} typed:${typed} quiz:${quiz} (final:${finalQuiz}) xf:${xf} build:${build} spot:${spot} words:${words}`);
  for (const b of bad) console.log(`      - ${b}`);
}
process.exit(anyBad ? 1 : 0);
