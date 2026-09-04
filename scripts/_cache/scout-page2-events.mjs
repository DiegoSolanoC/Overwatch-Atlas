import fs from 'fs';

const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;
const page = events.slice(10, 20);

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
  console.log(`#${i + 11}`, e.name);
  console.log('year', e.yearStart, e.yearEnd, '|', e.eraName, '|', e.cityDisplayName);
  const desc = String(e.description || '').replace(/<br\s*\/?>/gi, '\n');
  console.log('DESC:\n' + desc);
  dumpPlaces(e.secondaryCountryPlaces, 'place');
  dumpPlaces(e.heroFilterPlaces, 'hero');
  dumpPlaces(e.factionFilterPlaces, 'faction');
  dumpPlaces(e.npcFilterPlaces, 'npc');
});
