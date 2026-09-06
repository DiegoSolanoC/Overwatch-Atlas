/**
 * Curate page 23 commentary picks (incl. Classic dialogues).
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

const names = [
  'Different Company',
  'Two hearts',
  'On the Wrong Path',
  'People Change',
  'Working Alone',
  'Pretty Bad',
  'Useful',
  'Care to listen',
  'None of your Business',
  'Back Home',
  'In your Armor',
  'Fighting for Vendetta',
  'Working with Vendetta',
  'Negotiator',
  'Retribution',
  'Who is we',
  'Taking Action',
  'Your daugther',
  'Going Soft',
  'A fool',
  "Gérard's Grave",
  'At my Induction',
  'Show your face',
  'Talon\'s secrets',
  'Done with Talon',
  'Out of Talon',
  'Deals with Talon',
  'Fighting Talon',
  'Korrea\'s Strongest',
  'Mech Mechanic',
  'Hamster in the Mech',
];

console.log('==== NAMED ====');
for (const name of names) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  const tag = String(c.status) === 'removed' ? 'OW1' : 'live';
  console.log(`\n=== ${name} [${st(name)}] (${tag}) ===`);
  for (const l of (c.lines || []).slice(0, 5)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 130)}`);
  }
}

console.log('\n==== NAME SEARCH ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  if (
    /reinhardt|retire|gothenburg|brigitte|phreak|hazard|vendetta|colosseo|lupa|wolf|emre|freja|chernobog|overrid|meka|gwishin|busan|ana|widow|baptiste|talon|mauga|doomfist|samoa|raider|pharah|mother|ghost|eye/i.test(
      c.name,
    )
  ) {
    const tag = String(c.status) === 'removed' ? 'OW1' : '';
    console.log(tag, st(c.name), c.name);
  }
}

const buckets = [
  [/samoa|raider|freja|emre|chaingun|tahiti|polynesia|deep.?sea/i, 'sea'],
  [/reinhardt|retire|gothenburg|brigitte|hammer|crusader/i, 'retire'],
  [/phreak|hazard|anarch|mod|augment/i, 'phreak'],
  [/vendetta|colosseo|lupa|wolf|palatine|gladiator/i, 'lupa'],
  [/emre|freja|chernobog|overrid|helsinki/i, 'override'],
  [/meka|gwishin|busan|d\.?va|korea/i, 'meka'],
  [/ana|widow|eye|scope|warsaw|missing|ghost|fareeha|pharah/i, 'mia'],
  [/baptiste|talon|caribbean|haiti|clinic|mercenary/i, 'bap'],
  [/mauga|doomfist|cuerva|fun|two.?heart/i, 'fun'],
];

for (const [re, tag] of buckets) {
  console.log(`\n#### ${tag}`);
  let n = 0;
  for (const c of convs) {
    if (isChatterEntry(c)) {
      for (const l of c.lines || []) {
        if (!isActiveChatterLineForCommentary(l)) continue;
        const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
        if (!re.test(`${lab} ${l.disclaimer || ''}`)) continue;
        console.log('C', st(lab), lab.slice(0, 130));
        if (++n >= 10) break;
      }
    } else if (isDialogueEligibleForCommentary(c)) {
      let lines = [...(c.lines || [])];
      for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
      const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
      if (re.test(blob) && n < 6) {
        console.log('D', st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
        n++;
      }
    }
    if (n >= 10) break;
  }
}
