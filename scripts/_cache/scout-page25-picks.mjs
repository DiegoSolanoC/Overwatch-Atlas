/**
 * Curate page 25 commentary picks (incl. Classic dialogues).
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

const names = [
  'Always my brother',
  'Missing Genji',
  'Never lose sight',
  'Running from Responsability',
  'What is left',
  'Answer the recall',
  'Hoping for Overwatch',
  'Overwatch failed you',
  'Care to listen',
  'Petras',
  'The Petras Act',
  'Helix',
  'Raptora',
  'Pharah',
  'Code of Violence',
  'Reaper',
  'Subject Sigma',
  'Released',
  'Shrike',
  'D.va',
  'D.mon',
  'Top Player',
  'Found Family',
  'Phreak',
];

console.log('==== EXACT / PARTIAL NAME SEARCH ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  if (
    /genji|zenyatta|shambali|nepal|petras|sojourn|helix|raptora|pharah|anubis|reaper|reyes|moira|sigma|sombra|emre|chernobog|echo|liao|shrike|ana|cairo|egypt|d\.?va|d\.?mon|mecha|esport|hazard|phreak|susannah|deadlock|deactivat|quarantine|self.?disc|pupil|monk/i.test(
      c.name,
    )
  ) {
    console.log(
      `${String(c.status) === 'removed' ? 'OW1' : '   '} ${st(c.name)} | ${c.name}`,
    );
  }
}

const buckets = [
  [/genji|zenyatta|shambali|nepal|himalay|pupil|monk|angela.*letter|letter.*angela|peace with/i, 'self'],
  [/petras|hearing|sojourn.*overwatch|overwatch.*illegal|ijc|united nations|credentials/i, 'petras'],
  [/helix|raptora|pharah|fareeha|anubis|giza|grand mesa|security firm/i, 'helix'],
  [/reaper|reyes.*talon|code of violence|moira.*reyes|subject.?sigma|extraction/i, 'violence'],
  [/sigma|siebren|gravity|melody|sombra.*old|old man/i, 'released'],
  [/emre|chernobog|husk|another life|go dark/i, 'emre'],
  [/echo|liao|deactivat|quarantine|project.?echo/i, 'echo'],
  [/shrike|ana.*cairo|cairo.*ana|necropolis|vigilante|egypt/i, 'shrike'],
  [/d\.?va|d\.?mon|mecha guardian|esport|streamer|king|yuna|hana/i, 'dva'],
  [/hazard|phreak|susannah|susie|touch.?up|found family|deadlock/i, 'hazard'],
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
        if (++n >= 8) break;
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
    if (n >= 10) break;
  }
}

console.log('\n==== REQUESTED NAMES ====');
for (const name of names) {
  const hits = convs.filter(
    (c) => isDialogueEligibleForCommentary(c) && c.name.toLowerCase().includes(name.toLowerCase()),
  );
  if (!hits.length) console.log('MISS fragment', name);
  for (const c of hits.slice(0, 3)) {
    console.log(st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
  }
}
