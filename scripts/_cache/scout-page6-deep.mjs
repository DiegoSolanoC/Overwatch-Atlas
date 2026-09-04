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

function dump(label, pred, limit = 12) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
  }
}

dump('Ironclad name', (x) => /ironclad/i.test(x.blob));
dump('omnium', (x) => /omnium/i.test(x.blob));
dump(
  'omnic rights / equal / person',
  (x) =>
    /omnic.*(right|equal|person|free)|rights for|treat.*omnic|not.*property|sentien/i.test(
      x.blob,
    ),
);
dump(
  'Talon beginnings / soft power / empire',
  (x) =>
    /talon.*(empire|council|founded|began|rise)|covert|world domination|maximilien|antonio/i.test(
      x.blob,
    ),
);
dump(
  'In the Wrong hands + Digging up + Beautiful + Humanity laws + Misunderstood',
  (x) =>
    [
      'In the Wrong hands',
      'Digging up Old problems',
      'Beautiful Inventions',
      "Humanity's Laws",
      'Misunderstood',
      'Fighting Talon',
      'Lunar Simians',
      'Accident',
    ].includes(x.name),
);
