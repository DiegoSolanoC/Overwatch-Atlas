/**
 * Dump page 30 events (#291–300) + early extras + refresh used-commentary.json
 */
import fs from 'fs';

const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;

function collectCommentary(e) {
  /** @type {string[]} */
  const names = [];
  const push = (c) => {
    let n = '';
    if (typeof c === 'string') n = c.trim();
    else if (c && typeof c === 'object') n = String(c.name || c.label || c.theater || '').trim();
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  };
  if (Array.isArray(e.commentary)) e.commentary.forEach(push);
  if (Array.isArray(e.variants)) {
    for (const v of e.variants) {
      if (Array.isArray(v?.commentary)) v.commentary.forEach(push);
    }
  }
  return names;
}

/** @type {Map<string, string[]>} */
const used = new Map();
events.forEach((e, i) => {
  const names = collectCommentary(e);
  for (const n of names) {
    const key = n.toLowerCase();
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(`#${i + 1} ${e.name}`);
  }
});
fs.writeFileSync(
  'scripts/_cache/used-commentary.json',
  JSON.stringify(Object.fromEntries(used), null, 2),
);
console.log('Used commentary:', used.size);

const indices = [
  ...Array.from({ length: 10 }, (_, i) => 290 + i), // 291–300
  300, // 301 Bastet
  301, // 302 Museum Assault
  325, // 326 Answering the Call
  361, // 362 Reconciliation
];

console.log('\n=== PAGE 30 + EARLY EXTRAS ===\n');
for (const i of indices) {
  const e = events[i];
  if (!e) {
    console.log(`#${i + 1} MISSING`);
    continue;
  }
  console.log('='.repeat(70));
  console.log(`#${i + 1} ${e.name}`);
  console.log(
    `year ${e.yearStart ?? e.year ?? 'null'} ${e.yearEnd ?? 'null'} | ${e.era || ''} | ${e.location || e.place || ''}`,
  );
  console.log('heroes:', (e.heroes || e.characters || []).join(', ') || '(none)');
  console.log('DESC:');
  console.log(e.description || '');
  console.log('existing commentary:', collectCommentary(e).join(' | ') || '(none)');
  console.log('');
}
