/**
 * Curate page 27 commentary picks — dialogues AND hero chatter (incl. Classic).
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
  [/meka|gwishin|d\.?va|d\.?mon|mecha guardian|exo.?force|busan|colossus|esport/i, 'gameon'],
  [/tracer|emily|wilmington|vigilante|raf|tabletop|neighborhood/i, 'neighbor'],
  [/vanadium|oasis|moira|wayfinder|petra|faisal|ferrofluid|geology/i, 'vanadium'],
  [/freja|gefn|bounty|hunter|denmark/i, 'bounty'],
  [/junker queen|odessa|burninglands|metal demon|feral omnic|outback|scavenger/i, 'queen'],
  [/anran|wuyang|wuxing|fire college|wushu|danc/i, 'firestar'],
  [/cassidy|train|hyperloop|gunslinger|sombra.*bar|blackwatch tactic/i, 'train'],
  [/baptiste|traitor|cuerva|tortuga|talon.*after|humanitarian/i, 'traitor'],
  [/l[uú]cio|sonic|benicio|vishkar.*rio|rio.*vishkar|sound.*police|underworld/i, 'sonic'],
  [/junkrat|roadhog|crime spree|crown jewel|moment in crime|25 million|no job too big/i, 'crime'],
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
        const blob = `${lab} ${l.disclaimer || ''} ${l.subtitles || ''}`;
        if (!re.test(blob)) continue;
        console.log('C', st(lab), lab.slice(0, 150));
        if (++nC >= 8) break;
      }
    } else if (isDialogueEligibleForCommentary(c)) {
      let lines = [...(c.lines || [])];
      for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
      const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
      if (re.test(blob) && nD < 8) {
        console.log('D', st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
        nD++;
      }
    }
    if (nD >= 8 && nC >= 8) break;
  }
}
