/**
 * Detail lines for page 26 curated candidates.
 */
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
  "B.O.B.'s Fire power",
  'How\'s Bars',
  'Where is my Bike',
  'Easy Target',
  'Coming to Rio',
  'Vishkar is using you',
  'Returning to Vishkar',
  'Applying to Vishkar',
  'Leaving Vishkar',
  'Deprioritized',
  'Resistance',
  'Are you a Couple',
  'Fetching Price',
  'Seen you before',
  'My Specialty',
  'Lifting',
  'Huge fan',
  'Korrea\'s Strongest',
  'Unstoppable',
  'What is left',
  'Dragging Brigitte',
  'Deals with Talon',
  'Concerns',
  'At Gibraltar',
  'Answer the recall',
  'Just Recall',
  'Be Proud',
  'Always Captain',
  'Out of Talon',
  'Done with Talon',
  'Right amount of stupid',
  'Where have you been',
  'Volskaya\'s Mechs',
  'Learned Together',
  'Anubis\'s Jailers',
  'Pretty Awesome',
  'Existence is Mysterious',
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
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 150)}`);
  }
}
