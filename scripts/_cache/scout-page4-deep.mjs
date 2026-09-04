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

function dump(label, pred, limit = 20) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
  }
}

dump('INGRID', (x) => /ingrid/i.test(x.blob));
dump('ANUBIS', (x) => /anubis/i.test(x.blob));
dump('E54 / Siege Automaton', (x) => /e54|siege automaton/i.test(x.blob));
dump(
  'VINCENT / painful heart',
  (x) => /vincent|painful memories|captured the heart/i.test(x.blob),
);
dump(
  'GRAVITY / mag-lev / invention joy',
  (x) =>
    /mag-lev|mag lev|one's invention|gravit/i.test(x.blob) ||
    (x.heroes.includes('Sigma') && /invention|create|research/i.test(x.blob)),
);
dump(
  'TORB AI / machines / trust',
  (x) =>
    x.heroes.some((h) => /torbj/i.test(h)) &&
    /ai|omnic|machine|automat|bastion|weapon|build|control|trust|robot/i.test(x.blob),
);
dump(
  'creations escape control / wrong hands',
  (x) => /wrong hands|escape our control|original programming|opaque|autonom/i.test(x.blob),
);
dump(
  'Omnic workforce / jobs / prosperity',
  (x) => /workforce|took.*jobs|replace.*human|household|god program/i.test(x.blob),
);
