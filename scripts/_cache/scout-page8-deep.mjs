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

function dump(label, pred, limit = 14) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'Crisis-named / Anubis / warbots / Awakening NY',
  (x) =>
    /during the crisis|after the crisis|omnium|anubis|warbot|grave wound|survive.*crisis|not himself|your awakening|a ravager/i.test(
      x.blob,
    ) && !/favorite animals/i.test(x.name),
);

dump(
  'Baptiste home / orphan / clinic / crisis childhood',
  (x) =>
    x.heroes.includes('Baptiste') &&
    /orphan|crisis|home|haiti|clinic|grow|child|family|roseline|port/i.test(x.blob),
);

dump(
  'Torb Ironclad / Digging / Firewall / responsible designs',
  (x) =>
    [
      'Digging up Old problems',
      'Firewall System',
      'Beautiful Inventions',
      'Grave Wounds',
      'Killed Many',
      'In a Dream',
      'Systems Check',
    ].includes(x.name),
);

dump(
  'Sojourn Ask / Extension / Liao / twin / commander',
  (x) =>
    [
      'Ask to Change',
      'Extension of myself',
      'Optimism',
      'Returning the favor',
      'Vigilante Route',
      'Not Captain',
    ].includes(x.name) ||
    (x.heroes.includes('Sojourn') && /liao|call.?sign|commander|captain|cyber|rocket/i.test(x.blob)),
);

dump(
  'Wuyang / Anran fire / father / crisis / college',
  (x) =>
    (x.heroes.includes('Wuyang') || x.heroes.includes('Anran')) &&
    /crisis|fire|college|wuxing|father|mother|sister|mech|university|pride|veteran/i.test(x.blob),
);

dump(
  'Cassidy farm / kid / ranch / deadlock / grow up',
  (x) =>
    x.heroes.includes('Cassidy') &&
    /farm|ranch|kid|grow|orphan|crisis|deadlock|ashe|texas|labor|work/i.test(x.blob),
);

dump(
  'Zarya protect / father / crisis / omnium village',
  (x) =>
    x.heroes.includes('Zarya') &&
    /crisis|father|protect|omnium|village|russia|strength|rotten/i.test(x.blob),
);

// Exact dump of top candidates
const want = [
  "Anubis's Jailers",
  'Your Awakening',
  'Not Himself',
  'Survive after the crisis',
  'Grave Wounds',
  'Killed Many',
  'Digging up Old problems',
  'Ask to Change',
  'Extension of myself',
  'Mag Lev Cape',
  'Expectations',
  'Small World',
  'Be Proud',
  'Rotten Few',
  'A Ravager',
];
console.log('\n==== EXACT ====');
for (const name of want) {
  const h = all.find((x) => x.name === name);
  if (!h) {
    console.log('MISSING', name);
    continue;
  }
  console.log(`✓ ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 260).replace(/\s+/g, ' ')}`);
}
