/**
 * Curate page 24 commentary picks.
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
  'Where Max lives',
  'Outside Hire',
  'Calling the Shots',
  'Fight for All Omnics',
  'Disappointing',
  'Why Withdraw',
  'Always my brother',
  'The Name Null Sector',
  'Los Muertos',
  'Trust Sombra',
  'Phreak Firewalls',
  'Leaving the Cage',
  'Korrea\'s Strongest',
  'Chronal adjustments',
  'Fighting for Vendetta',
  'Working with Vendetta',
  'Who is we',
  'Taking Action',
  'Make it Count',
  'Negotiator',
  'Madam Wolf',
  'Phreak Firewalls',
  'Show some respect',
  'Paws off',
  'Hope for more',
];

console.log('==== NAMED ====');
for (const name of [...new Set(names)]) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  console.log(`\n=== ${name} [${st(name)}] ===`);
  for (const l of (c.lines || []).slice(0, 4)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 120)}`);
  }
}

console.log('\n==== NAME SEARCH ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  if (
    /sierra|kendra|havana|rumbotico|maxim|doomfist|ramattra|sombra|conspiracy|singapore|winston|gauntlet|vialli|vendetta|hazard|glasgow|zurich|morrison|reyes|genji|vanish|disappear|interrogat|prison|closed fist|storm rising/i.test(
      c.name,
    )
  ) {
    console.log(String(c.status) === 'removed' ? 'OW1' : '', st(c.name), c.name);
  }
}

const buckets = [
  [/sierra|kendra|appalachia|naughton|father|mountain/i, 'disappear'],
  [/havana|rumbotico|maxim|coterie|hurricane|storm rising/i, 'storm'],
  [/ramattra|doomfist|cairo|doomed|nanite|iris|talon.*resource/i, 'doomed'],
  [/sombra|conspiracy|los muertos|dorado|eye symbol|chernobog/i, 'conspiracy'],
  [/singapore|closed fist|gauntlet|winston.*doom|doom.*winston|chronal/i, 'fist'],
  [/interrogat|prison|cell|gauntlet.*mesa|grand mesa/i, 'interrog'],
  [/vialli|vendetta|venice|wolf|lupa|business/i, 'business'],
  [/hazard|glasgow|phreak|amputee|prosthes|findlay/i, 'collateral'],
  [/zurich|reyes|morrison|funeral|explosion|backlash|disband/i, 'zurich'],
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
