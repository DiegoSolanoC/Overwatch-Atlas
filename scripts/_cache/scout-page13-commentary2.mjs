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
    console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
  }
}

function show(name) {
  const h = all.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!h) {
    console.log(`MISSING ${name}`);
    return;
  }
  console.log(`${status(h.name).padEnd(48)} | ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
}

console.log('==== KEY ====');
[
  'The Martinses',
  'Visiting the Martinses',
  'At Gibraltar',
  'Dancing in the Command Center',
  'Gérard spoke of you',
  "Gérard's Grave",
  'Complicated',
  'Undo it all',
  'Apology',
  'Lonely Road',
  'Love Life',
  'Painful Memories',
  'Owe to the Iris',
  'Asthma',
  'Interesting Theory',
  'Meeting Aurora',
  'Fond of you',
  'Your Awakening',
  'Omnic archaeology',
  'Show some respect',
  'In a Dream',
  'Seen you before',
  'Junkers giving you trouble',
  'Pig Boy',
  'Magical Healing',
  'Anger Management',
  'Love Life',
  'Hard Bargain',
  'How\'s Bars',
  'Nice to see you',
  'Your Parents',
  'Making a Living',
  'Fun fact',
  'Circuit Maximus',
  'Negotiator',
  'More than Prey',
].forEach(show);

dump(
  '#123 Morrison family / lonely / partner',
  (x) =>
    /vincent|lonely|settle|partner|love life|painful memories|commander morrison|capture the heart|had someone/i.test(
      x.blob,
    ) ||
    (x.heroes.some((h) => /soldier 76|reaper|ana|mercy/i.test(h)) &&
      /family|lonely|love|partner|regret|home|settle/i.test(x.blob)),
  18,
);

dump(
  '#125 Iris / Shambali / Mondatta / Aurora path',
  (x) =>
    /iris|shambali|mondatta|pilgrim|aurora|monk|coexist|omnic rights|one within/i.test(x.blob),
  20,
);

dump(
  '#126 Junker Queen exile / family / howl / survive',
  (x) =>
    x.heroes.some((h) => /junker queen/i.test(h)) &&
    /family|king|queen|exile|home|survive|wasteland|outback|howl|throne|highness|respect/i.test(
      x.blob,
    ),
  16,
);

dump(
  '#127 Mercy student / nanobio / Torb / Sigma school',
  (x) =>
    (x.heroes.includes('Mercy') &&
      /school|student|study|research|nanobiot|heal|medicine|doctor|paper|young|torbjörn|sigma|fund/i.test(
        x.blob,
      )) ||
    /nanobiot|zeigler|miracle worker|chalmers/i.test(x.blob) ||
    (x.heroes.includes('Mercy') && x.heroes.includes('Torbjörn')) ||
    (x.heroes.includes('Mercy') && x.heroes.includes('Sigma')),
  20,
);
