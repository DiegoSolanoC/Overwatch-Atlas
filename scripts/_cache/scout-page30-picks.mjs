/**
 * Curate page 30 + early extras commentary — dialogues AND hero chatter.
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
  [/baptiste|mauga|nguyen|talon.*haiti|haiti|monte cristi|ros|sinclair|immortality field/i, 'baptiste-talon'],
  [/monterrey|ecopoint|marine|lurk|hydroponic|submersible|deep.?sea|cryptid|harbor/i, 'monterrey'],
  [/kiriko|yokai|hashimoto|kanezaka|ryota|fox anima|sojiro|festival.*firework/i, 'yokais'],
  [/sombra|volskaya|katya|widowmaker.*reaper|infiltrat|omnium.*russia|vialli/i, 'infiltration'],
  [/vendetta|colosseo|rome|empire|gladiator|ilias|ital/i, 'empire'],
  [/ecological|eco.?network|mei|snowball|antarctica|habitat|wildlife|conservation/i, 'eco'],
  [/reflect|mirror|echo|amélie|widow|lacroix|paris|reflection/i, 'reflections'],
  [/failed recovery|recovery|petra|helix|overwatch.*asset|decommission/i, 'recovery'],
  [/genius grant|torbj[oö]rn|brigitte|engineering|invent|patent|grant/i, 'genius'],
  [/old soldiers|soldier.?76|morrison|reaper|reyes|ana|amari|shrike|hakim|cairo|bastet/i, 'old-soldiers'],
  [/bastet|necropolis|fareeha|shrike|ana.*mask|protector.*mask/i, 'bastet'],
  [/museum|gauntlet|doomfist|tracer|winston.*museum|new york|more heroes/i, 'museum'],
  [/answering the call|recall|reinhardt|brigitte|eichwalde|gibraltar.*reinhardt|mentor/i, 'recall-rein'],
  [/reconcil|zenyatta|ramattra|suravasa|mondatta|null sector|brother.*omnic|pilgrimage/i, 'reconcile'],
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
        console.log('C', st(lab), lab.slice(0, 160));
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
