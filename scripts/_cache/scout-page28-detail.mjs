import fs from 'fs';

const used = new Map(
  Object.entries(JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'))),
);
const st = (n) =>
  used.has(String(n).toLowerCase())
    ? `USED → ${used.get(String(n).toLowerCase()).join('; ')}`
    : 'free';
const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

const want = [
  'Dorothy',
  'Naughton Vault',
  'Watch your Back',
  'Working with Overwatch',
  'Just your Type',
  'Still Hiding',
  'Thank you Mother',
  'Unstoppable',
  'Working Order',
  'Dragging Brigitte',
  'Medieval History',
  'Not getting any Taller',
  'Thinking Ahead',
  'Two Geniuses',
  'Back so Soon',
  'Hashimoto Bounties',
  'Resolving Differences',
  'Open her eyes',
  'Her own Mistakes',
  'Old Wounds',
  'Resistance',
  'Grown a lot',
  'Music Festival',
  'New Single',
  'Vigilante Route',
  'Vigilantes',
  'Traditional Armaments',
  'War isn\'t a game',
  'Burning the World Down',
  'Mech Mechanic',
  'In the Sky',
  'Who is your Mechanic',
  'Vintage Vinyl',
  'Keeping in Touch',
  'Inspiration',
];

for (const name of want) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const ow1 = String(c.status) === 'removed' ? ' [OW1]' : '';
  console.log(`\n=== ${st(c.name)} | ${name}${ow1} ===`);
  for (const l of lines.slice(0, 5)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 145)}`);
  }
}
