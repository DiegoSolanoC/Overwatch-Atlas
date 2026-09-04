import fs from 'fs';

const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const used = new Map(Object.entries(usedRaw));

const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

function expand(c) {
  let lines = (c.lines || []).slice();
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = [...new Set(lines.map((l) => l.hero).filter(Boolean))];
  const subs = lines.map((l) => `${l.hero || ''}: ${l.subtitles || ''}`).join(' | ');
  return {
    name: c.name,
    heroes,
    subs,
    blob: `${c.name} ${subs}`.toLowerCase(),
    status: c.status,
    entryType: c.entryType || 'dialogue',
  };
}

const all = convs
  .map(expand)
  .filter((x) => x.entryType !== 'chatter' && x.status !== 'removed');

function status(name) {
  const k = String(name).toLowerCase();
  if (used.has(k)) return `USED → ${(used.get(k) || []).join('; ')}`;
  return 'free';
}

function dump(label, pred, limit = 20) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 300).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'Mexico / Dorado / Xibalba / Lumerico / Los Muertos / blackout / light',
  (x) =>
    /\bmexico\b|dorado|xibal|lumer|los muertos|blackout|portero|festival de|la luz|grid/i.test(
      x.blob,
    ),
);

dump(
  'Doomfist legacy / gauntlet / Orisa Numbani / first fist / suffering / conquer',
  (x) =>
    /gauntlet|numb?ani|first doomfist|adhabu|ngumi|nigeria|savior|strength through|to stagnate|coward run|respect, not fear|past your prime|sleeping dragon/i.test(
      x.blob,
    ) ||
    (x.heroes.includes('Doomfist') &&
      /legacy|fist|power|conquer|suffer|war|crisis|africa|nigeria/i.test(x.blob)),
);

dump(
  'Optimism / hope / improve the world / Liao / Echo',
  (x) =>
    /optimism|improve the world|liao created|still so optimistic|hope for|better tomorrow/i.test(
      x.blob,
    ),
);

dump(
  'Awakening / New York battlefield / Ramattra / Not Himself / Ravager / Changed much',
  (x) =>
    /your awakening|not himself|a ravager|changed much|new york|battlefield|omnics.*crisis|during the crisis/i.test(
      x.name + ' ' + x.subs,
    ),
);

dump(
  'Omnic archaeology / Not an Omnic / Name Null Sector / Locked up',
  (x) =>
    /omnic archaeology|not an omnic|null sector|locked up|predecessor|aurora/i.test(x.blob),
);

dump(
  'Sombra Dorado / Mexico lines',
  (x) =>
    x.heroes.some((h) => /sombra/i.test(h)) &&
    /mexico|dorado|xibal|muertos|lumer|home|childhood|blackout|power|god/i.test(x.blob),
);

// list all Sombra dialogues that mention place-ish words
dump(
  'All Sombra + Soldier/Reaper mexico-ish',
  (x) =>
    x.heroes.some((h) => /sombra|soldier 76|reaper/i.test(h)) &&
    /dorado|mexico|xibal|muertos|lumerico|black.?out|power plant|god program|childhood|home town/i.test(
      x.blob,
    ),
);

// Find Strength through Suffering variants
console.log('\n==== NAME CONTAINS strength|suffer|fist|nigeria|savior|xibal|dorado ====');
for (const h of all) {
  if (/strength|suffer|nigeria|savior|xibal|dorado|lumer|blackout|midsummer|gothenburg|macaria|choose well|one life/i.test(h.name)) {
    console.log(`- ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
  }
}
