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

const needles = [
  'harboring',
  'original programming',
  'never plan',
  'wrong hands',
  'firewall',
  'systems check',
  'optimism',
  'not an omnic',
  'apple pie',
  'kanelbullar',
  'hard bargain',
  'back so soon',
  'mag lev',
  'painful memories',
  'anubis',
  'grave wounds',
  'is that you',
  'growing from',
  'termination',
  'killing machine',
  'built you for',
];

for (const n of needles) {
  const hits = all.filter((x) => x.blob.includes(n) || x.name.toLowerCase().includes(n));
  if (!hits.length) continue;
  console.log(`\n## ${n}`);
  for (const h of hits.slice(0, 5)) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 220).replace(/\s+/g, ' ')}`);
  }
}

// exact dump of candidate names
const want = [
  "Ingrid's Apple Pie",
  'Hard Bargain',
  'Back so Soon',
  'Mag Lev Cape',
  'In the Wrong hands',
  'My greatest Rival',
  'Applied Science',
  "Anubis's Jailers",
  'Grave Wounds',
  'Painful Memories',
  'Firewall System',
  'Systems Check',
  'Is that you',
  'Harboring an E54',
  'Optimism',
  'Not an Omnic',
];
console.log('\n==== EXACT ====');
for (const name of want) {
  const h = all.find((x) => x.name === name);
  if (!h) {
    console.log(`MISSING: ${name}`);
    continue;
  }
  console.log(`✓ ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 300).replace(/\s+/g, ' ')}`);
}

// freja e54
console.log('\n==== FREJA E54 ====');
for (const h of all.filter(
  (x) =>
    x.heroes.includes('Freja') && /e54|bastion|lindholm/i.test(x.blob),
)) {
  console.log(`- ${h.name}`);
  console.log(`  ${h.subs.slice(0, 300)}`);
}
