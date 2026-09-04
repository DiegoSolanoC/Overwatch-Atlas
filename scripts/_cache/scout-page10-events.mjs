import fs from 'fs';

const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;

/** @type {Map<string, string[]>} */
const usedBy = new Map();

function collectCommentary(e) {
  /** @type {string[]} */
  const names = [];
  if (Array.isArray(e.commentary)) {
    for (const c of e.commentary) {
      const n = String(c || '').trim();
      if (n) names.push(n);
    }
  }
  if (Array.isArray(e.variants)) {
    for (const v of e.variants) {
      if (!Array.isArray(v?.commentary)) continue;
      for (const c of v.commentary) {
        const n = String(c || '').trim();
        if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
      }
    }
  }
  return names;
}

events.forEach((e, idx) => {
  for (const n of collectCommentary(e)) {
    const key = n.toLowerCase();
    if (!usedBy.has(key)) usedBy.set(key, []);
    usedBy.get(key).push(`#${idx + 1} ${e.name}`);
  }
});

const usedObj = Object.fromEntries([...usedBy.entries()]);
fs.writeFileSync('scripts/_cache/used-commentary.json', JSON.stringify(usedObj, null, 2));

console.log(`Used commentary names: ${usedBy.size}`);
for (const [k, locs] of [...usedBy.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  // recover display casing
  let display = k;
  for (const e of events) {
    const hit = collectCommentary(e).find((c) => c.toLowerCase() === k);
    if (hit) {
      display = hit;
      break;
    }
  }
  console.log(`* ${display}`);
  for (const loc of locs) console.log(`    → ${loc}`);
}

console.log('\n=== PAGE 10 (#91–100) ===');
const page = events.slice(90, 100);
function dumpPlaces(rows, label) {
  if (!Array.isArray(rows) || !rows.length) return;
  for (const r of rows) {
    console.log(
      `  [${label}]`,
      JSON.stringify({ loc: r.locationName, country: r.country, why: r.reasoning }),
    );
  }
}
page.forEach((e, i) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`#${i + 91}`, e.name);
  console.log('year', e.yearStart, e.yearEnd, '|', e.eraName, '|', e.cityDisplayName);
  const existing = collectCommentary(e);
  if (existing.length) console.log('EXISTING commentary:', existing.join(' | '));
  const desc = String(e.description || '').replace(/<br\s*\/?>/gi, '\n');
  console.log('DESC:\n' + desc);
  dumpPlaces(e.secondaryCountryPlaces, 'place');
  dumpPlaces(e.heroFilterPlaces, 'hero');
  dumpPlaces(e.factionFilterPlaces, 'faction');
  dumpPlaces(e.npcFilterPlaces, 'npc');
  if (/is Born|born/i.test(e.name)) console.log('(BIRTHDAY — skip commentary)');
});
