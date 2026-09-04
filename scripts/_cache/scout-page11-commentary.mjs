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

function dump(label, pred, limit = 14) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
  }
}

dump(
  '#102 Macaria / God AI / NY / noise / jailers / Anubis control',
  (x) =>
    /macaria|god (ai|program)|collapse|broadway|noise|jailer|anubis|new york|manhattan/i.test(
      x.blob,
    ),
);

dump(
  '#103 Gothenburg / bombardment / midsummer / Heroic Five / Lindholm family / Ingrid',
  (x) =>
    /gothenburg|bombard|midsummer|heroic five|steel blanket|iron blanket|eulog|sweden|ingrid|massacre/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Torbjörn', 'Brigitte']) &&
      /family|wife|children|home|sweden|gothenburg|grief|mourn|dead|crisis/i.test(x.blob)),
);

dump(
  '#104 Tipping / hope / strike team / Karachi / Shanghai / morale',
  (x) =>
    /hope|morale|normalcy|tipping|karachi|shanghai|super hero|turning the tide|win the war|glory days|optimism/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Soldier 76', 'Reaper', 'Ana', 'Reinhardt', 'Torbjörn']) &&
      /hope|win|strike team|crisis|anubis|overwatch/i.test(x.blob)),
);

dump(
  '#105 Savior / Doomfist / Ngumi / gauntlet / Nigeria / Ibadan',
  (x) =>
    /doomfist|ngumi|gauntlet|ibadan|nigeria|adhabu|orisa|savior|first doomfist|strength through suffering/i.test(
      x.blob,
    ),
);

dump(
  '#106 Awakening / Aurora sacrifice / choose well / Liao / Nepal',
  (x) =>
    /aurora|awakening|choose well|one life|shambali|liao|nepal|sacrifice|consciousness|sentien|your awakening|fond of you|meeting aurora|asthma|interesting theory/i.test(
      x.blob,
    ),
);

dump(
  '#107 Dying Directive / free omnics / loyalists / side by side',
  (x) =>
    /defector|loyalist|side by side|sentien|awakening|free from|anubis.*(control|panic)|not himself|ravager|personhood/i.test(
      x.blob,
    ),
);

dump(
  '#108 Striking Source / Cairo quarantine / Anubis imprisoned',
  (x) =>
    /cairo|quarantine|omnium|anubis.*(jail|trap|prison|defeat)|jailer|egypt|strike.*(source|anubis)/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Ana', 'Soldier 76', 'Reaper', 'Reinhardt', 'Torbjörn', 'Echo']) &&
      /anubis|omnium|cairo|egypt|crisis.*(end|over)|quarantine/i.test(x.blob)),
);

dump(
  '#109 Cleanup leftovers / Jakarta / Wellington / Aviles / crisis end',
  (x) =>
    /jakarta|wellington|aviles|leftover|clean.?up|loyalist|pacific|crisis.*(end|over)|after the war|war is over/i.test(
      x.blob,
    ),
);

dump(
  '#110 Mexico / Xibalba / light / Lumerico / Portero / Dorado',
  (x) =>
    /mexico|xibalba|xibalbá|lumerico|lumérico|portero|festival|dorado|los muertos|blackout|grid|god program/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Sombra', 'Soldier 76', 'Reaper', 'Venture']) &&
      /mexico|dorado|xibal|light|dark/i.test(x.blob)),
);

const want = [
  "Anubis's Jailers",
  'Not Himself',
  'Your Awakening',
  'A Ravager',
  'Meeting Aurora',
  'Fond of you',
  'Asthma',
  'Interesting Theory',
  'Like the Glory Days',
  'Optimism',
  'Strength through Suffering',
  'Rotten Few',
  'Tin Cans',
  'NO AI Mess',
  'Beautiful Inventions',
  'Digging up Old problems',
  'Grave Wounds',
  'Killing Machine',
  'Sir Wilhelm',
  'Real Glory',
  'Visiting the Martinses',
  'Coward Run',
  'I am Sorry',
  'Dead Gods',
  'Playing God',
  'Personhood',
  'Not an Omnic',
  'Choose well',
  'One Life',
  'Firewall System',
  'Costly Augments',
];
console.log('\n==== EXACT CANDIDATES ====');
for (const name of want) {
  const h = all.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!h) {
    console.log(`MISSING ${name} | JSON ${status(name)}`);
    continue;
  }
  console.log(`${status(h.name).padEnd(52)} | ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 240).replace(/\s+/g, ' ')}`);
}

// name-contains searches for awakening / choose / mexico / doomfist
console.log('\n==== NAME SEARCHES ====');
for (const re of [
  /awaken/i,
  /aurora/i,
  /choose/i,
  /doomfist|gauntlet|nigeria/i,
  /mexico|dorado|xibal|lumer/i,
  /gothenburg|sweden|ingrid|lindholm/i,
  /jailer|anubis|quarantine/i,
  /hope|optimism|glory days/i,
]) {
  const hits = all.filter((x) => re.test(x.name) || re.test(x.blob));
  console.log(`\n~ /${re.source}/i → ${hits.length}`);
  for (const h of hits.slice(0, 10)) {
    console.log(`  - ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
  }
}
