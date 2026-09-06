/**
 * Detail lines for page 27 curated candidates (dialogues + chatter labels).
 */
import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

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
  'Propaganda Machine',
  'Mech Slayer',
  'Ranking Up',
  'Esports are Sports',
  'Vigilante Route',
  'Sitting out',
  'Just a phase',
  'Sorry enough to Help',
  'Like a Bug',
  'Empty Head',
  'Hack you later',
  'Another Life',
  'Prize Hunter',
  'Talon\'s Bounty',
  'Bills were Always Paid',
  'Failed Negotiation',
  'Where\'s your lasso',
  'Wildfire',
  'Too hard on Wuyang',
  'Dancing anxiety',
  'Handling Dancing',
  'High Scores',
  'Resistance',
  'Done with Talon',
  'Out of Talon',
  'Forgetting about me',
  'Hiding Forever',
  'Crown Jewels',
  'Lunatic',
  'Pig face',
  'Ratjunk',
  'My Specialty',
  'Not as good',
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

console.log('\n==== STRONG CHATTER CANDIDATES ====');
const chatWant = [
  /I'?ve done things I'?m not proud/i,
  /exile ya|come back here, Junkrat|Junkrat\? How many/i,
  /Nothing burns brighter/i,
  /Time is money/i,
  /Gunslinger.*never made sense|fastest gun in the New West/i,
  /idolize anyone|revolution, silenced/i,
  /Behave yourself, Fawkes/i,
  /Emily|tabletop|Wilmington/i,
];
for (const re of chatWant) {
  for (const c of convs) {
    if (!isChatterEntry(c)) continue;
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      if (!re.test(`${l.subtitles || ''} ${l.disclaimer || ''}`)) continue;
      const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
      console.log(st(lab), lab.slice(0, 160));
    }
  }
}
