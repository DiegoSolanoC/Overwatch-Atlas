/**
 * Curate page 26 commentary picks.
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

console.log('==== NAME HITS ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  if (
    /ashe|deadlock|bob|cassidy|symmetra|vishkar|rio|junkrat|roadhog|queen|zarya|strongest|reinhardt|brigitte|chivalry|squire|domina|lumeric|winston|athena|gibraltar|recall|baptiste|mauga|talon|siberia|volskaya|omnium|anubis|pharah|helix/i.test(
      c.name,
    )
  ) {
    console.log(`${String(c.status) === 'removed' ? 'OW1' : '   '} ${st(c.name)} | ${c.name}`);
  }
}

const buckets = [
  [/deadlock|ashe.*cassidy|cassidy.*ashe|holobike|new west|bars|b\.?o\.?b/i, 'family'],
  [/vishkar|symmetra|satya|sanjay|rio|calado|better world|hard light/i, 'vishkar'],
  [/junkrat|roadhog|junkertown|omnium.*treasure|treasure|queen.*junk/i, 'treasure'],
  [/zarya|zaryanova|strongest|weightlifting|olympic|512/i, 'zarya'],
  [/reinhardt|brigitte|chivalry|squire|crusader|errant|lindholm/i, 'chivalry'],
  [/domina|vaira|lumeric|portero|networking|vishkar.*talon/i, 'network'],
  [/winston|athena|gibraltar|peanut|hammond|recall|not alone/i, 'winston'],
  [/baptiste|mauga|cuerva|monte cristi|talon.*leave|leave.*talon/i, 'bap'],
  [/siberia|volskaya|svyatogor|novoansk|omnium|zarya.*war|particle cannon/i, 'siberia'],
  [/anubis|pharah|raptor|helix.*temple|udjat|okoro|khali/i, 'anubis'],
];

for (const [re, tag] of buckets) {
  console.log(`\n#### ${tag}`);
  let n = 0;
  for (const c of convs) {
    if (isChatterEntry(c)) {
      for (const l of c.lines || []) {
        if (!isActiveChatterLineForCommentary(l)) continue;
        const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
        if (!re.test(`${lab} ${l.disclaimer || ''} ${l.subtitles || ''}`)) continue;
        console.log('C', st(lab), lab.slice(0, 140));
        if (++n >= 6) break;
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
    if (n >= 8) break;
  }
}
