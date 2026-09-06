/**
 * Chatter second-pass: dump events #1–150 + used commentary map.
 * Usage: node scripts/_cache/scout-chatter-pass-events.mjs [page]
 * page 1 => #1–10 … page 15 => #141–150; omit = all
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
    else if (c && typeof c === 'object') n = String(c.name || c.theater || '').trim();
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

function heroesFromPlaces(e) {
  const out = new Set();
  for (const row of e.heroFilterPlaces || []) {
    const n = String(row?.locationName || row?.name || '').trim();
    if (n) out.add(n);
  }
  return [...out];
}

/** @type {Map<string, string[]>} */
const usedBy = new Map();
events.forEach((e, idx) => {
  for (const n of collectCommentary(e)) {
    const key = n.toLowerCase();
    if (!usedBy.has(key)) usedBy.set(key, []);
    usedBy.get(key).push(`#${idx + 1} ${e.name}`);
  }
});
fs.writeFileSync(
  'scripts/_cache/used-commentary.json',
  JSON.stringify(Object.fromEntries(usedBy), null, 2),
);

const pageArg = Number(process.argv[2] || 0);
const start = pageArg > 0 ? (pageArg - 1) * 10 : 0;
const end = pageArg > 0 ? pageArg * 10 : 150;
const slice = events.slice(start, end);

console.log(`Used commentary: ${usedBy.size}`);
console.log(`\n=== CHATTER PASS EVENTS #${start + 1}–${end} ===`);

slice.forEach((e, i) => {
  const num = start + i + 1;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`#${num}`, e.name);
  console.log('year', e.yearStart, e.yearEnd, '|', e.eraName, '|', e.cityDisplayName);
  const existing = collectCommentary(e);
  if (existing.length) console.log('EXISTING commentary:', existing.join(' | '));
  const heroes = heroesFromPlaces(e);
  if (heroes.length) console.log('HEROES:', heroes.join(', '));
  console.log('DESC:\n' + String(e.description || '').replace(/<br\s*\/?>/gi, '\n'));
  if (/is Born/i.test(e.name)) console.log('(BIRTHDAY — skip)');
});
