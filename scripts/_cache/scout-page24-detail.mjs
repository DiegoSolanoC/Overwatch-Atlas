/**
 * Detail lines for page 24 curated candidates.
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

const want = [
  'Outside Hire',
  'Calling the Shots',
  'Disappointing',
  'Why Withdraw',
  'Always my brother',
  'Trust Sombra',
  'Leaving the Cage',
  'Enjoying Prison',
  'Missing Genji',
  'Complicated',
  'Funeral Arrangements',
  'Giving up on you',
  "Talon's Resources",
  'Boss Changes',
  'Money before Loyalty',
  'Taking Action',
  'Who is we',
  'Make it Count',
  'Fighting for Vendetta',
  'Working with Vendetta',
  'Show some respect',
  'Hope for more',
  'Jack Morrison',
  'Painful Memories',
  'Dramatic',
  'Masked Vigilante',
  'War machine',
  'Prize Hunter',
  'Gabrielito',
  'Slow Phone',
  "My Father's Opinion",
  'Spoil the Surprise',
  "Korrea's Strongest",
  'Spiffing Up',
  'Inefficient',
  'What part of Canada',
  'Stressful Situations',
  "Don't need Saving",
  'Not Chasing',
  'Lack of Oxygen',
  'New Chassis',
  'More Wires than Skin',
  'Bastion on our side',
  'How can you live with yourself',
  'Coward Run',
  'Favorite Animals',
  'Threat to myself and others',
];

for (const name of want) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const ow1 = String(c.status) === 'removed' ? ' [OW1/Classic]' : '';
  console.log(`\n=== ${st(c.name)} | ${name}${ow1} ===`);
  for (const l of lines.slice(0, 6)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 150)}`);
  }
}

const chatQueries = [
  [/Havana/i, 'Havana chatter'],
  [/Singapore/i, 'Singapore chatter'],
  [/Zurich|Morrison|Reyes/i, 'Zurich/Morrison/Reyes'],
  [/Glasgow|Scotland/i, 'Glasgow'],
  [/gauntlet/i, 'gauntlet'],
  [/chronal/i, 'chronal'],
  [/Venice/i, 'Venice'],
  [/Maximil|Max lives|Coterie/i, 'Max'],
];

console.log('\n==== TARGETED CHATTER ====');
for (const [re, tag] of chatQueries) {
  console.log(`\n## ${tag}`);
  let n = 0;
  for (const c of convs) {
    if (!isChatterEntry(c)) continue;
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
      const blob = `${lab} ${l.disclaimer || ''} ${l.subtitles || ''}`;
      if (!re.test(blob)) continue;
      console.log(`${st(lab)} | ${lab.slice(0, 160)}`);
      if (++n >= 8) break;
    }
    if (n >= 8) break;
  }
}

// Fuzzy name search for more dialogues
console.log('\n==== EXTRA NAME HITS ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  if (
    /prison|jail|interrogat|zurich|funeral|morrison|reyes|doomfist|winston|singapore|havana|maximil|sombra|conspiracy|vendetta|vialli|hazard|genji.*miss|missing genji|chronal|gauntlet|null sector|ramattra.*doom|doom.*ramattra/i.test(
      c.name,
    )
  ) {
    console.log(`${String(c.status) === 'removed' ? 'OW1' : '   '} ${st(c.name)} | ${c.name}`);
  }
}
