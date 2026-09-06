/**
 * Curate strong literal hits for page 19.
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
  'Keeping the Label',
  'Meeting Aurora',
  'A Ravager',
  'Inside an Orb',
  'People Change',
  'On the Wrong Path',
  'Care to listen',
  'Useful',
  'Working Alone',
  'Pretty Bad',
  'Still Grieving',
  'Something from nothing',
  'Father\'s Bow',
  'Like my Brother',
  'Wasted Time',
  'Always my brother',
  'The Name Null Sector',
  'Why Withdraw',
  'Try Dying again',
  'Halloween Dress up',
  'In the Wrong hands',
  'Cutting Hands',
  'Science on my side',
  'Leaving Vishkar',
  'To Stagnate is to Die',
  'Family Business',
  'Looking Sharp',
  'Korrea\'s Strongest',
  'Blaming yourself',
  'Happy to Kill',
  'Well Informed',
  'Second Nature',
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

const chatterRes = [
  [/liao|athena|aurora|project.?echo|hard.?light.*echo|duplicate|replicat/i, 'echo'],
  [/horizon|hammond|peanut|lunar colony|specimen|gorilla|wrecking ball.*winston|winston.*wrecking/i, 'horizon'],
  [/mizuki|curse|hashimoto.*debt|elder|shion.*train/i, 'cursed'],
  [/shimada|hanamura|sojiro|dragon|brother.*hanzo|hanzo.*brother|blackwatch/i, 'dragons'],
  [/search and rescue|tracker|freja|copenhagen|emre/i, 'sar'],
  [/null sector|omnium|nanite|liberator|ramattra.*war|war.*ramattra/i, 'escalation'],
  [/cyber|cyborg|more machine|rebuild|almost dying|ninja/i, 'cyber'],
  [/biolight|biomass|lifeweaver|niran|vishkar.*heal|heal.*vishkar/i, 'biolight'],
  [/adeyemi|gauntlet|conflict|stagnate|evolve|doomfist.*talon|talon.*doomfist/i, 'takeover'],
  [/chronal|slipstream|splitstream|time|pulse|accelerator|desync|wexler/i, 'tracer'],
];

for (const [re, tag] of chatterRes) {
  console.log(`\n#### CHAT ${tag}`);
  let n = 0;
  for (const c of convs) {
    if (!isChatterEntry(c)) continue;
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
      if (!re.test(`${lab} ${l.disclaimer || ''}`)) continue;
      console.log('C', st(lab), lab.slice(0, 130));
      if (++n >= 18) break;
    }
    if (n >= 18) break;
  }
}

// Extra dialogue name search
console.log('\n==== DIALOGUE NAME HITS ====');
for (const c of convs) {
  if (isChatterEntry(c)) continue;
  if (
    /echo|liao|aurora|athena|hammond|peanut|horizon|orb|curse|mizuki|shimada|dragon|brother|blackwatch|biolight|chronal|slipstream|stagnate|gauntlet|adeyemi|cyber|dying again|pulse/i.test(
      c.name,
    )
  ) {
    console.log('D', st(c.name), c.name);
  }
}
