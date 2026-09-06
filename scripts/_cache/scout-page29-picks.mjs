/**
 * Curate page 29 commentary — dialogues AND hero chatter (incl. Classic).
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
  [/hanzo|genji|brother|hanamura|shimada|dragon anima|old dragons|forgive/i, 'dragons'],
  [/bastion|ganymede|cardinal|black forest|last bastion|warbot/i, 'bastion'],
  [/soldier|76|morrison|dorado|los muertos|piñata|hero of old|poster/i, 'hero'],
  [/fika|jetpack cat|star companion|lucheng|orange cat/i, 'fika'],
  [/sombra|lumeric|portero|full disclosure|king viper|dorado.*hack|los muertos/i, 'disclosure'],
  [/mondatta|widowmaker|assassination|kings.?row|iggy|chronal/i, 'assassin'],
  [/kiriko|hashimoto|kuroura|protector|kanezaka|fox|ryota/i, 'protector'],
  [/recall|winston|reaper|gibraltar|athena|database|cavalry/i, 'recall'],
  [/london calling|kace|underworld|lizzy|iggy|uprising|sonic pulse/i, 'london'],
  [/mei|snowball|antarctica|ecopoint|rise and shine|cryogenic|recall.*mei/i, 'mei'],
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
