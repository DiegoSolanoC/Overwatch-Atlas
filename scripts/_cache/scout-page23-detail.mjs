import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const used = new Map(
  Object.entries(JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'))),
);
const st = (n) => (used.has(String(n).toLowerCase()) ? 'USED' : 'free');
const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

const names = [
  'Stayed Retired',
  'Retirement',
  'Better than Retirement',
  'Truth about Retirement',
  'Retirement suits you',
  'Dragging Brigitte',
  'Madam Wolf',
  'Lone Wolf',
  'Phreak Firewalls',
  'Pretty Bad',
  'On the Front lines',
  'Useful when you show up',
  'Going Soft',
  'Eye repair',
  'Got my eye on you',
  'Missing an Eye',
  'Done with Talon',
  'Talon\'s secrets',
  'Show your face',
  'Fighting for Vendetta',
  'Negotiator',
  'Busan fireworks',
  'Like mother like daughter',
  'Thinking of Mother',
  'Adoptive Mother',
];

for (const name of names) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  console.log(`=== ${name} [${st(name)}] ${c.status} ===`);
  for (const l of (c.lines || []).slice(0, 5)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 140)}`);
  }
}

console.log('\n==== KEY CHATTERS ====');
for (const c of convs) {
  if (!isChatterEntry(c)) continue;
  for (const l of c.lines || []) {
    if (!isActiveChatterLineForCommentary(l)) continue;
    const t = `${l.subtitles || ''} ${l.disclaimer || ''}`;
    const hero = l.hero || c.name;
    const hit =
      /retire|Gothenburg|godchild|Hivemind|Phreak|Colosseo|La Lupa|wolf|Chernobog|overrid|MEKA|Gwishin|missing|ghost|Janina|cybernetic eye|Monte Cristi|Caribbean|clinic|Cuerva|fun with/i.test(
        t,
      )
      || (/^Reinhardt$/i.test(hero) && /retire|old|age|hammer/i.test(t))
      || (/^Vendetta$/i.test(hero) && /Colosseo|Rome|wolf|retribution/i.test(t))
      || (/^Hazard$/i.test(hero) && /Phreak/i.test(t))
      || (/^Baptiste$/i.test(hero) && /Talon|Haiti|clinic|regret/i.test(t))
      || (/^Ana$/i.test(hero) && /eye|Fareeha|ghost|widow|dead/i.test(t))
      || (/^Emre$/i.test(hero) && /Freja|overrid|control|voice|Chernobog/i.test(t))
      || (/^D\.?Va$/i.test(hero) && /MEKA|Busan|Gwishin|home/i.test(t))
      || (/^Mauga$/i.test(hero) && /Doomfist|Talon|Baptiste|fun/i.test(t));
    if (!hit) continue;
    const lab = buildChatterCommentaryLabel(hero, l.subtitles, l.disclaimer);
    console.log('C', st(lab), lab.slice(0, 140));
  }
}
