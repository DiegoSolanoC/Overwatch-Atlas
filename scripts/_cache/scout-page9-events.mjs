import fs from 'fs';

const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;

/** @type {Map<string, string[]>} */
const usedBy = new Map();
events.forEach((e, idx) => {
  const names = Array.isArray(e.commentary)
    ? e.commentary.map((c) => String(c || '').trim()).filter(Boolean)
    : [];
  // Also check variants
  if (Array.isArray(e.variants)) {
    for (const v of e.variants) {
      if (!Array.isArray(v?.commentary)) continue;
      for (const c of v.commentary) {
        const n = String(c || '').trim();
        if (n && !names.includes(n)) names.push(n);
      }
    }
  }
  for (const n of names) {
    const key = n.toLowerCase();
    if (!usedBy.has(key)) usedBy.set(key, []);
    usedBy.get(key).push(`#${idx + 1} ${e.name}`);
  }
});

console.log('=== ALREADY USED COMMENTARY ===');
const keys = [...usedBy.keys()].sort();
console.log(`Total unique names: ${keys.length}`);
for (const k of keys) {
  const display = [...usedBy.get(k)][0];
  // recover original casing from first event that has it
  let orig = k;
  for (const e of events) {
    const list = [
      ...(Array.isArray(e.commentary) ? e.commentary : []),
      ...(Array.isArray(e.variants)
        ? e.variants.flatMap((v) => (Array.isArray(v?.commentary) ? v.commentary : []))
        : []),
    ];
    const hit = list.find((c) => String(c).trim().toLowerCase() === k);
    if (hit) {
      orig = String(hit).trim();
      break;
    }
  }
  console.log(`* ${orig}`);
  for (const loc of usedBy.get(k)) console.log(`    → ${loc}`);
}

console.log('\n=== PAGE 9 EVENTS (#81–90) ===');
const page = events.slice(80, 90);
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
  console.log(`#${i + 81}`, e.name);
  console.log('year', e.yearStart, e.yearEnd, '|', e.eraName, '|', e.cityDisplayName);
  const existing = Array.isArray(e.commentary) ? e.commentary.filter(Boolean) : [];
  if (existing.length) console.log('EXISTING commentary:', existing.join(' | '));
  const desc = String(e.description || '').replace(/<br\s*\/?>/gi, '\n');
  console.log('DESC:\n' + desc);
  dumpPlaces(e.secondaryCountryPlaces, 'place');
  dumpPlaces(e.heroFilterPlaces, 'hero');
  dumpPlaces(e.factionFilterPlaces, 'faction');
  dumpPlaces(e.npcFilterPlaces, 'npc');
  if (/is Born|born/i.test(e.name)) console.log('(BIRTHDAY — skip commentary)');
});

fs.writeFileSync(
  'scripts/_cache/used-commentary.json',
  JSON.stringify(
    Object.fromEntries(
      [...usedBy.entries()].map(([k, v]) => [k, v]),
    ),
    null,
    2,
  ),
);
