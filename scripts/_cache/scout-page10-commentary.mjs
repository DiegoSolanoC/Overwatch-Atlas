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

const heroIn = (heroes, names) =>
  names.some((n) => heroes.some((h) => h.toLowerCase() === n.toLowerCase()));

function dump(label, pred, limit = 12) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 260).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'Honor Glory / Balderich / Eichenwalde / Crusader last stand',
  (x) =>
    /balderich|eichenwalde|honor|glory|last stand|mentor|crusader/i.test(x.blob) ||
    (heroIn(x.heroes, ['Reinhardt', 'Brigitte']) &&
      /honor|glory|balderich|eichenwalde|mentor|sacrifice|knight/i.test(x.blob)),
);

dump(
  'Original Strike Team / founding five / Overwatch formed',
  (x) =>
    /strike team|founding|original overwatch|overwatch was formed|first overwatch|adawe/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Ana', 'Reinhardt', 'Soldier 76', 'Reaper', 'Torbjörn']) &&
      /old days|glory days|when we started|early days|strike team/i.test(x.blob)),
);

dump(
  'Early Missions / Kyoto / Reyes child / champions',
  (x) =>
    /kyoto|first mission|rescue|child|champion|headline/i.test(x.blob) &&
    heroIn(x.heroes, ['Reaper', 'Soldier 76', 'Ana', 'Reinhardt', 'Torbjörn']),
);

dump(
  'Road of Bones / Oymyakon / sacrifice / Russia nuclear',
  (x) =>
    /oymyakon|kolyma|road of bones|exclusion|sacrifice|siberia/i.test(x.blob) ||
    (heroIn(x.heroes, ['Zarya']) && /sacrifice|protect|home|russia|crisis/i.test(x.blob)),
);

dump(
  'Who Knew Better / Liao recruit / Omnica',
  (x) =>
    /liao|omnica|who knew|recruit|created me|improve the world/i.test(x.blob) ||
    (heroIn(x.heroes, ['Echo', 'Sojourn', 'Soldier 76']) && /liao|omnica|create/i.test(x.blob)),
);

dump(
  'In Partnership / Detroit Omnium / Sojourn / Siege',
  (x) =>
    /detroit|omnium|siege system|partnership|canada|csor/i.test(x.blob) ||
    (heroIn(x.heroes, ['Sojourn']) && /omnium|crisis|canada|overwatch|liao/i.test(x.blob)),
);

dump(
  'Battle of Bridges / NYC / Manhattan breach',
  (x) =>
    /bridge|manhattan|new york|williamsburg|queensboro/i.test(x.blob) ||
    (heroIn(x.heroes, ['Ramattra']) && /new york|awakening|battlefield/i.test(x.blob)),
);

dump(
  'Dead Gods / Chernobog / God AI shutdown / Cairo Anubis',
  (x) =>
    /chernobog|god (ai|program)|xibalba|macaria|shut down|i am sorry|anubis/i.test(x.blob),
);

dump(
  'Dark Days / Dorado / blackout / Xibalba / Mexico',
  (x) =>
    /dorado|xibalba|xibalbá|blackout|mexico|los muertos|dark/i.test(x.blob) ||
    (heroIn(x.heroes, ['Sombra', 'Soldier 76', 'Reaper']) && /dorado|mexico|blackout/i.test(x.blob)),
);

// Exact candidates often suggested
const want = [
  'Sir Wilhelm',
  'Real Glory',
  'Medieval History',
  'Fantasy never hurt',
  'Like the Glory Days',
  'Optimism',
  'Meeting Aurora',
  'Fond of you',
  'Your Awakening',
  'A Ravager',
  'Anubis\'s Jailers',
  'Not Himself',
  'Ask to Change',
  'Extension of myself',
  'Killed Many',
  'Grave Wounds',
];
console.log('\n==== EXACT CANDIDATES ====');
for (const name of want) {
  const h = all.find((x) => x.name === name);
  if (!h) {
    console.log(`MISSING ${name} | JSON ${status(name)}`);
    continue;
  }
  console.log(`${status(h.name).padEnd(48)} | ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 220).replace(/\s+/g, ' ')}`);
}
