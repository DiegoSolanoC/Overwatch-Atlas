import fs from 'fs';

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
    entryType: c.entryType || 'dialogue',
    heroes,
    subs,
    blob: `${c.name} ${subs}`.toLowerCase(),
    status: c.status,
  };
}

const all = convs
  .map(expand)
  .filter((x) => x.entryType !== 'chatter' && x.status !== 'removed');

const heroIn = (heroes, names) =>
  names.some((n) => heroes.some((h) => h.toLowerCase() === n.toLowerCase()));

function dump(label, pred, limit = 14) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 270).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'Ironclad / Torb anti-AI / Titan / repair',
  (x) =>
    /ironclad|right to repair|titan|anti.?ai|against.*(ai|omnic)|omnica/i.test(x.blob) ||
    (heroIn(x.heroes, ['Torbjörn']) &&
      /ai|omnic|machine|guild|invent|patent|weapon|build|bastion|titan/i.test(x.blob)),
);

dump(
  'Horizon / New Horizons / Harold / Sigma colony',
  (x) =>
    /horizon|lunar colon|harold|specimen|miss.*(moon|colony)|friend from the colony/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Winston', 'Sigma']) && /moon|colony|lunar|gravity/i.test(x.blob)),
);

dump(
  'Aurora personhood / rights / sentient / Liao legal',
  (x) =>
    /aurora|personhood|civil right|sentient|legal|predecessor/i.test(x.blob) ||
    (heroIn(x.heroes, ['Echo', 'Ramattra', 'Zenyatta']) &&
      /aurora|liao|rights|person|human/i.test(x.blob)),
);

dump(
  'Talon rise / Venice / Antonio / council / corrupt',
  (x) =>
    /talon|venice|antonio|vialli|council|corrupt|terrorist/i.test(x.blob) &&
    !/favorite animals/i.test(x.name),
);

dump(
  'Omnica bankrupt / omnium abandoned / empty shells',
  (x) =>
    /omnica|omnium|bankrupt|abandoned|empty|factory|shut down/i.test(x.blob) &&
    (heroIn(x.heroes, ['Orisa', 'Ramattra', 'Bastion', 'Echo', 'Zenyatta', 'Torbjörn']) ||
      /omnica|omnium/i.test(x.blob)),
);

dump(
  'Anubis rogue / Playing God / Crisis start',
  (x) =>
    /anubis|god (ai|program)|crisis|genocide|war.?bot|omnium/i.test(x.blob) &&
    !/favorite animals/i.test(x.name),
);

// exact candidates
const want = [
  'Firewall System',
  'In the Wrong hands',
  'Friend from the Colony',
  'Missing the Moon',
  'Lunar Food',
  'Meeting Aurora',
  'Fond of you',
  'Interesting Theory',
  'Optimism',
  "Anubis's Jailers",
  'Grave Wounds',
  'Before the Crisis',
  'Your Awakening',
  'Asthma',
  'Keeping the Label',
];
console.log('\n==== EXACT ====');
for (const name of want) {
  const h = all.find((x) => x.name === name);
  console.log(h ? `✓ ${name}` : `MISSING ${name}`);
}
