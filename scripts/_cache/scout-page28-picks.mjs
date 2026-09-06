/**
 * Curate page 28 commentary — dialogues AND hero chatter (incl. Classic).
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

const buckets = [
  [/sierra|helix|summit|dorothy|naughton|gran mesa|roth/i, 'summit'],
  [/mercy|angela|baptiste|pharah|fareeha|venezuela|cairo.*medic|needy|charity/i, 'needy'],
  [/reinhardt|brigitte|dragon|romania|crusader|squire|chivalry/i, 'dragon'],
  [/torbj|titan|kurjik|sven|ironclad|destroyer|boklovo/i, 'destroyer'],
  [/brigitte.*armor|squire|lightweight|shield|mechanic/i, 'squire'],
  [/kiriko|fox|hashimoto|kanezaka|asa|anima|miko|yoshida/i, 'fox'],
  [/l[uú]cio|synaesthesia|vishkar|rio|sonic|revolution|heard/i, 'heard'],
  [/soldier|76|morrison|vigilante|pulse rifle|gran mesa|conspiracy/i, 'vigilante'],
  [/d\.?va|shooting star|self.?destruct|dae-hyun|gwishin|busan|eject/i, 'star'],
  [/tracer|iggy|underworld|kace|omnic.*london|vinyl|underground/i, 'underground'],
];

for (const [re, tag] of buckets) {
  console.log(`\n#### ${tag}`);
  let nD = 0;
  let nC = 0;
  for (const c of convs) {
    if (isChatterEntry(c)) {
      for (const l of c.lines || []) {
        if (!isActiveChatterLineForCommentary(l)) continue;
        const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
        if (!re.test(`${lab} ${l.disclaimer || ''} ${l.subtitles || ''}`)) continue;
        console.log('C', st(lab), lab.slice(0, 145));
        if (++nC >= 7) break;
      }
    } else if (isDialogueEligibleForCommentary(c)) {
      let lines = [...(c.lines || [])];
      for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
      const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
      if (re.test(blob) && nD < 7) {
        console.log('D', st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
        nD++;
      }
    }
    if (nD >= 7 && nC >= 7) break;
  }
}
