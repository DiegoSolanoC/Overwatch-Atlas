/**
 * Targeted name lookups for page 30 curation.
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

const nameHits = [
  /live forever|immortality|mauga|baptiste|making a living|favorite animals|advance tech|show your face|right amount/i,
  /monterrey|lurk|marine|harbor|ecopoint/i,
  /yokai|hashimoto|kiriko|absolute victory|well informed|open her eyes|her own mistakes|moved recently|hope for more/i,
  /volskaya|katya|sombra|difficult bosses|slow phone|learned together|gabrielito|unlocking/i,
  /vendetta|colosseo|money before|fighting for vendetta|negotiator|working with vendetta|no italian|acclimat/i,
  /mei|travel|journal|count on mei|hotpot|gotta have|careful swinging|not cute|fun mother/i,
  /reflect|gibraltar|emily|tracer|winston|optimism|recording|man in the mirror|more wires/i,
  /horizon|lucheng|chao|ape|colony|failed|winston.*person|red promise/i,
  /efi|genius|junie|numbani|not getting any taller|keeping track|last slide|mess it up|rubbed off|stay around/i,
  /old soldiers|bastet|shrike|ana|morrison|reyes|still hiding|thank you mother|tugging|cursed artifact|vip passes|stories about you|care to listen/i,
  /museum|gauntlet|more heroes|tracer|winston|coward run|taking action|retribution|more than one path|inefficient|boss changes/i,
  /answering|recall|reinhardt|brigitte|eichwalde|unstoppable|keeping track|last slide|handling dancing|no instrumental/i,
  /reconcil|zenyatta|ramattra|mondatta|suravasa|be proud|awful quiet|getting strong|quite a puzzle|hosting satya|music festival/i,
];

const wantExact = [
  'Live Forever',
  'Making a Living',
  'Immortality Turret',
  'Advance Technologies',
  'Favorite Animals',
  'Her own Mistakes',
  'Open her eyes',
  'Sorry enough to Help',
  'Well Informed',
  'Absolute Victory',
  'Hope for more',
  'Moved Recently',
  'Slow Phone',
  'Difficult Bosses',
  'Learned Together',
  'Gabrielito',
  'Money before Loyalty',
  'Fighting for Vendetta',
  'Negotiator',
  'Working with Vendetta',
  'No Italian',
  'Acclimating',
  'Count on Mei',
  'Hotpot',
  'Gotta have some Dirt',
  'Careful Swinging',
  'Not Cute',
  'Fun Mother',
  'Optimism',
  'Recording',
  'Man in the Mirror',
  'More Wires than Skin',
  'Do not keep Track',
  'Not getting any Taller',
  'Keeping track of Names',
  'The last slide',
  'Mess it Up Again',
  'Rubbed off Behavior',
  'Stay Around',
  'Handling Dancing',
  'No Instrumental',
  'VIP Passes',
  'Stories about you',
  'Care to listen',
  'Still Hiding',
  'Thank you Mother',
  'Tugging Heartstrings',
  'Bastet',
  'First time playing',
  'Cursed artifacts',
  'Boss Changes',
  'How can you live with yourself',
  'Coward Run',
  'More than one Path',
  'Taking Action',
  'Inefficient',
  'Retribution',
  'Unstoppable',
  'Be Proud',
  'Music Festival',
  'Awful Quiet',
  'Hosting Satya',
  'Getting Strong',
  'Quite a puzzle',
];

console.log('\n=== EXACT NAME LOOKUP ===\n');
for (const name of wantExact) {
  const c = convs.find((x) => !isChatterEntry(x) && String(x.name).toLowerCase() === name.toLowerCase());
  if (!c) {
    console.log('MISSING', name);
    continue;
  }
  const elig = isDialogueEligibleForCommentary(c);
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const sample = lines
    .slice(0, 3)
    .map((l) => `${l.hero || '?'}: ${(l.subtitles || '').slice(0, 70)}`)
    .join(' | ');
  console.log(
    `${elig ? 'OK' : 'skip'} ${st(c.name)} ${c.status === 'removed' ? 'OW1' : ''} [${c.name}] ${sample}`,
  );
}

console.log('\n=== TARGETED CHATTER ===\n');
const chatterRes = [
  [/immortality field|temporary|doctor is in|baptiste/i, 'baptiste'],
  [/monterrey|lurk|harbor|marine|ecopoint: monterrey/i, 'monterrey'],
  [/hashimoto|yokai|kanezaka|kiriko.*rule|fox/i, 'yokai'],
  [/volskaya|katya|friend is doing|sombra/i, 'volskaya'],
  [/colosseo|roman empire|sistine|espresso|pasta|italy|rialto|vendetta/i, 'rome'],
  [/mei|travel|journal|mount logan|forecast|antarctica|ecological/i, 'mei'],
  [/gibraltar|emily|holiday|recall|samaritan|winston/i, 'reflect'],
  [/horizon|ape|lucheng|moon|colony/i, 'horizon'],
  [/efi|junie|genius|numbani|orisa.*efi|adawe/i, 'efi'],
  [/bastet|shrike|ana|hakim|cairo|necropolis|old soldier|morrison|reyes/i, 'old'],
  [/museum|gauntlet|more heroes|doomfist.*museum|tracer/i, 'museum'],
  [/eichwalde|recall|reinhardt.*answer|brigitte.*overwatch|mentor/i, 'recall'],
  [/ramattra|zenyatta|mondatta|suravasa|brother|null sector|coexist/i, 'zen'],
];

for (const [re, tag] of chatterRes) {
  console.log(`\n-- ${tag} --`);
  let n = 0;
  for (const c of convs) {
    if (!isChatterEntry(c)) continue;
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
      const blob = `${lab} ${l.disclaimer || ''} ${l.subtitles || ''}`;
      if (!re.test(blob)) continue;
      console.log(st(lab), lab.slice(0, 170));
      if (++n >= 10) break;
    }
    if (n >= 10) break;
  }
}
