/**
 * Curate page 22 commentary picks (incl. Classic dialogues).
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

function dumpNamed(names) {
  for (const name of names) {
    const c = convs.find((x) => x.name === name);
    if (!c) {
      console.log('MISS', name);
      continue;
    }
    const tag = String(c.status) === 'removed' ? 'OW1' : 'live';
    console.log(`\n=== ${name} [${st(name)}] (${tag}) ===`);
    for (const l of (c.lines || []).slice(0, 5)) {
      console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 140)}`);
    }
  }
}

dumpNamed([
  'Disgrace to Overwatch',
  'Déjà Vu',
  'Pulling the Trigger',
  'Unethical Work',
  'Waiting for Progress',
  'Welcomed in Oasis',
  'Funding',
  'Hippocratic Oath',
  'Retribution',
  'At my Induction',
  'Gérard spoke of you',
  "Gérard's Grave",
  'A fool',
  'Captivating',
  'Skin mod',
  'Stop being weak',
  'Numb your Pain',
  'Why Withdraw',
  'Always my brother',
  'The Name Null Sector',
  'Omnic Suffering',
  'Mondatta was an inspiration',
  'Blaming yourself',
  'Different Company',
  'Two Hearts',
  'Negotiator',
]);

console.log('\n==== NAME SEARCH ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  if (
    /blackwatch|venice|antonio|vendetta|vialli|mauga|samoa|heart|oasis|moira|illari|inti|runasapi|uprising|king.?s row|null sector|mondatta|tracer|reinhardt|widow|gérard|gerard|amélie|amelie|talon|retribution|question/i.test(
      c.name,
    )
  ) {
    const tag = String(c.status) === 'removed' ? 'OW1' : '';
    console.log(tag, st(c.name), c.name);
  }
}

const buckets = [
  [/blackwatch|venice|reyes|morrison|question/i, 'question'],
  [/vendetta|vialli|antonio|marzia|stolen/i, 'stolen'],
  [/mauga|samoa|heart|two.?heart|cybernetic/i, 'hearts'],
  [/oasis|moira|genetic|ministry|unshackled/i, 'oasis'],
  [/illari|runasapi|inti|solar|paqarina/i, 'prodigy'],
  [/king.?s row|uprising|null sector|london|mondatta|turing/i, 'uprising'],
  [/widow|gérard|gerard|amélie|amelie|ballet|chateau|château|emotion|blue/i, 'widow'],
  [/ramattra|resolve|liberator|nameless|zera/i, 'resolve'],
];

for (const [re, tag] of buckets) {
  console.log(`\n#### ${tag}`);
  let n = 0;
  for (const c of convs) {
    if (isChatterEntry(c)) {
      for (const l of c.lines || []) {
        if (!isActiveChatterLineForCommentary(l)) continue;
        const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
        if (!re.test(`${lab} ${l.disclaimer || ''}`)) continue;
        console.log('C', st(lab), lab.slice(0, 130));
        if (++n >= 12) break;
      }
    } else if (isDialogueEligibleForCommentary(c)) {
      let lines = [...(c.lines || [])];
      for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
      const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
      if (!re.test(blob)) continue;
      if (n < 8 && /vendetta|mauga|illari|widow|ramattra|moira|oasis|king|null|gérard|gerard|antonio|heart/i.test(blob + c.name)) {
        console.log('D', st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
        n++;
      }
    }
    if (n >= 12) break;
  }
}
