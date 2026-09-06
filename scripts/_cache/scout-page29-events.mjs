/**
 * Dump page 29 events (#281–290) + refresh used-commentary.json
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

const page = events.slice(280, 290);
console.log('\n=== PAGE 29 (#281–290) ===\n');
page.forEach((e, idx) => {
  const n = 281 + idx;
  console.log('='.repeat(70));
  console.log(`#${n} ${e.name}`);
  console.log(
    `year ${e.yearStart ?? e.year ?? 'null'} ${e.yearEnd ?? 'null'} | ${e.era || ''} | ${e.location || e.place || ''}`,
  );
  console.log('DESC:');
  console.log(e.description || '');
  console.log('');
});
