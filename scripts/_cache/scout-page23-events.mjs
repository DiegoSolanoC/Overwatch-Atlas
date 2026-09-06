/**
 * Dump page 23 events (#221–230) + refresh used-commentary.json
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

function dumpPlaces(rows, label) {
  if (!Array.isArray(rows) || !rows.length) return;
  for (const r of rows) {
    console.log(
      `  [${label}]`,
      JSON.stringify({
        loc: r.locationName || r.name,
        country: r.country,
        why: r.reasoning,
      }),
    );
  }
}

console.log(`Used commentary: ${usedBy.size}`);
console.log('\n=== PAGE 23 (#221–230) ===');
events.slice(220, 230).forEach((e, i) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`#${i + 221}`, e.name);
  console.log('year', e.yearStart, e.yearEnd, '|', e.eraName, '|', e.cityDisplayName);
  const existing = collectCommentary(e);
  if (existing.length) console.log('EXISTING commentary:', existing.join(' | '));
  console.log('DESC:\n' + String(e.description || '').replace(/<br\s*\/?>/gi, '\n'));
  dumpPlaces(e.secondaryCountryPlaces, 'place');
  dumpPlaces(e.heroFilterPlaces, 'hero');
  dumpPlaces(e.factionFilterPlaces, 'faction');
  dumpPlaces(e.npcFilterPlaces, 'npc');
  if (/is Born/i.test(e.name)) console.log('(BIRTHDAY — skip commentary)');
});
