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
  'Two hearts',
  'Fighting for Vendetta',
  'Working with Vendetta',
  'Disappointing',
  'Who is we',
  'Taking Action',
  'Make it Count',
  'Let it out',
  'Stealing Hearts',
  'Room for Brilliance',
  'Jack Morrison',
  'Painful Memories',
  "Gérard's Grave",
  'A fool',
  'Skin mod',
  'Numb your Pain',
  'Stop being weak',
  'Welcomed in Oasis',
  'Funding',
  'Disgrace to Overwatch',
  'Always my brother',
  'Why Withdraw',
  'Blaming yourself',
];

for (const name of names) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  console.log(`=== ${name} [${st(name)}] ===`);
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
      /King's Row Uprising|two.?heart|Ministry of Genetics|child of the sun|wonders that science/i.test(t)
      || (/^Soldier 76$/i.test(hero) && /King.?s Row/i.test(t))
      || (/^Moira$/i.test(hero) && /Oasis/i.test(t))
      || (/^Illari$/i.test(hero) && /Runasapi|sun|Inti|prodigy/i.test(t))
      || (/^Mauga$/i.test(hero) && /heart/i.test(t))
      || (/^Widowmaker$/i.test(hero) && /Château|Chateau|Gérard|Gerard|Paris|spider/i.test(t))
      || (/^Tracer$/i.test(hero) && /King.?s Row/i.test(t))
      || (/^Ramattra$/i.test(hero) && /alone|alone|sacrifice|liberator|friend/i.test(t));
    if (!hit) continue;
    const lab = buildChatterCommentaryLabel(hero, l.subtitles, l.disclaimer);
    console.log('C', st(lab), lab.slice(0, 145));
  }
}
