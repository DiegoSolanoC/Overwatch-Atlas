/**
 * Curate strong literal hits for page 21 (incl. Classic dialogues).
 */
import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
  isDialogueEligibleForCommentary,
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

const named = [
  'Hammond?',
  'Peanut Butter',
  'Inside an Orb',
  'Cursed Boy',
  "Toshiro's forge",
  'Chronal adjustments',
  'Chronal Uncertainty',
  'Your Name',
  'Cowboy Hat',
  'Mina Liao',
  'Keeping the Label',
  'Déjà Vu',
  'Pulling the Trigger',
  'Disgrace to Overwatch',
  'Like a Brother',
  'Hamster in the Mech',
  'Not for sale',
];

console.log('==== NAMED ====');
for (const name of named) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  const tag = String(c.status) === 'removed' ? 'OW1' : 'live';
  console.log(`\n=== ${name} [${st(name)}] (${tag}) ===`);
  for (const l of (c.lines || []).slice(0, 5)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 140)}`);
  }
}

console.log('\n==== NAME SEARCH ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c) && !isChatterEntry(c)) continue;
  if (isChatterEntry(c)) continue;
  if (
    /venture|wayfinder|horizon|harold|escape|rocket|pod|chronal|tracer|winston|wrecking|scrapyard|champ|junker|liao|oslo|mondatta|antonio|venice|rialto|retribution|blackwatch|fox|miko|shrine|kiriko|mizuki|shion|toshiro|leverage|ape|gorilla|hammond/i.test(
      c.name,
    )
  ) {
    const tag = String(c.status) === 'removed' ? 'OW1' : '';
    console.log(tag, st(c.name), c.name);
  }
}

const chatRes = [
  [/wayfinder|archaeolog|venture.*history|history.*crisis/i, 'venture'],
  [/horizon|never go home|harold|lunar/i, 'lunar'],
  [/toshiro|forge|cursed|mizuki|shion/i, 'leverage'],
  [/gibraltar|chronal|accelerator|blink/i, 'chronal'],
  [/scrapyard|champ|wrecking ball|hamster.*junker|junkertown.*champ/i, 'champ'],
  [/liao|oslo|mondatta|echo.*doctor/i, 'oslo'],
  [/rialto|venice|antonio|blackwatch|retribution/i, 'venice'],
  [/fox|grandma|miko|shrine|kanezaka|kiriko/i, 'shrine'],
];

for (const [re, tag] of chatRes) {
  console.log(`\n#### ${tag}`);
  let n = 0;
  for (const c of convs) {
    if (!isChatterEntry(c)) continue;
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
      if (!re.test(`${lab} ${l.disclaimer || ''}`)) continue;
      console.log('C', st(lab), lab.slice(0, 135));
      if (++n >= 12) break;
    }
    if (n >= 12) break;
  }
}

// Tracer+Winston dialogues
console.log('\n==== Tracer+Winston ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = new Set(lines.map((l) => l.hero));
  if (heroes.has('Tracer') && heroes.has('Winston')) {
    console.log(
      st(c.name),
      String(c.status) === 'removed' ? 'OW1' : '',
      c.name,
      '|',
      lines.map((l) => `${l.hero}: ${(l.subtitles || '').slice(0, 55)}`).join(' / '),
    );
  }
}
