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
  'Siblings',
  'Got each other',
  'Show-off',
  'Keeping me Sharp',
  'Ganymede Scout',
  'Stolen Bird Feed',
  'Bastion Agrees',
  'New Armor',
  'Something Useful',
  'The Poster',
  'Cute Guy',
  'War isn\'t a game',
  'Lucheng\'s Files',
  'She just likes you',
  'Sharpen those claws',
  'Playing on the Desk',
  'Unlocking',
  'Stick to the Plan',
  'Trust Sombra',
  'Blaming yourself',
  'Taking the Risk',
  'Open her eyes',
  'Sorry enough to Help',
  'Well Informed',
  'Her own Mistakes',
  'Answer the recall',
  'Just Recall',
  'Fear the Reaper',
  'Never see me coming',
  'Keeping in Touch',
  'Remmebering the Past',
  'Count on Mei',
  'Googly Eyes',
  'Hotpot',
  'Fun Mother',
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
