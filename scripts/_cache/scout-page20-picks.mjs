/**
 * Curate strong literal hits for page 20.
 */
import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const used = new Map(Object.entries(usedRaw));
const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

function st(n) {
  const hits = used.get(String(n).toLowerCase());
  return hits ? `USED → ${hits.join('; ')}` : 'free';
}

const named = [
  'Still Grieving',
  "Father's Bow",
  'Something from nothing',
  'Like a Brother',
  'Sleeping Dragon',
  'Summon a Dragon',
  'Testing my Patience',
  'Utilizing you',
  'Rather Quiet',
  'Where Max lives',
  'Outside Hire',
  'Calling the Shots',
  'Fight for All Omnics',
  'Los Muertos',
  'Leaving Vishkar',
  'Cutting Hands',
  'In the Wrong hands',
  'The Martinses',
  'Visiting the Martinses',
  'Returning to Vishkar',
  'Dr. Bhatt',
  'Efi at the Arcology',
  'Open her eyes',
  'Sorry enough to Help',
  'Hashimoto Bounties',
  'No Experience',
  'Hope for more',
  'Fight Smarter',
  'Mina Liao',
  'Keeping the Label',
  'Peanut Butter',
  'Hammond?',
  'Cursed Boy',
];

console.log('==== NAMED ====');
for (const name of named) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  console.log(`\n=== ${name} [${st(name)}] ===`);
  for (const l of (c.lines || []).slice(0, 5)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 130)}`);
  }
}

console.log('\n==== NAME SEARCH ====');
for (const c of convs) {
  if (isChatterEntry(c)) continue;
  if (
    /moira|reaper|reyes|blackwatch|mei|antarctica|cryo|blizzard|snow|sombra|muertos|dorado|lum|biolight|arcology|martins|vishkar|kiriko|hashimoto|toshiro|mauga|samoa|coral|pirate|echo.*cass|cass.*echo|laugh|blacklist|dublin|entropy|wraith|fade|genetic/i.test(
      c.name,
    )
  ) {
    console.log('D', st(c.name), c.name);
  }
}

const chatterBuckets = [
  [/shimada|hanamura|honor|vagabond|father|brother/i, 'shimada'],
  [/moira|genetic|dublin|oasis|ethics|blacklist/i, 'moira'],
  [/antarctic|ecopoint|blizzard|cryo|mei.*ice|frozen|cold/i, 'mei'],
  [/maxim|monaco|circuit royal|coterie|casino/i, 'max'],
  [/reaper|wraith|fade|reyes|blackwatch|regenerat|death/i, 'entropy'],
  [/sombra|dorado|los muertos|lum[eé]rico|hack/i, 'sombra'],
  [/biolight|arcology|martins|leaving|vishkar/i, 'biolight'],
  [/kiriko|hashimoto|toshiro|asa|kanezaka|yamagami|grandma/i, 'hostage'],
  [/mauga|samoa|coral|pirate|raider|deep.?sea/i, 'raiders'],
  [/echo|cassidy|liao|laugh|cowboy|oslo/i, 'canvas'],
];

for (const [re, tag] of chatterBuckets) {
  console.log(`\n#### ${tag}`);
  let n = 0;
  for (const c of convs) {
    if (!isChatterEntry(c)) continue;
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
      const blob = `${lab} ${l.disclaimer || ''}`;
      if (!re.test(blob)) continue;
      // tighten per tag heroes
      if (tag === 'mei' && !/^Mei$/i.test(l.hero || c.name) && !/antarctic|ecopoint|blizzard/i.test(blob)) continue;
      if (tag === 'sombra' && !/^Sombra$/i.test(l.hero || c.name) && !/dorado|muertos|lum/i.test(blob)) continue;
      if (tag === 'raiders' && !/^Mauga$/i.test(l.hero || c.name) && !/samoa|coral|pirate|raider/i.test(blob)) continue;
      console.log('C', st(lab), lab.slice(0, 135));
      if (++n >= 14) break;
    }
    if (n >= 14) break;
  }
}
