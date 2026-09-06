/**
 * Curate strong literal hits for page 18.
 */
import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const used = new Map(Object.entries(usedRaw));
const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

function st(n) {
  const hits = used.get(String(n).toLowerCase());
  return hits ? `USED → ${hits.join('; ')}` : 'free';
}

const patterns = [
  [/null sector|found.*null|leave the monastery|mondatta|ramattra.*zenyatta|zenyatta.*ramattra/i, 'NS/lib'],
  [/gwishin|busan|colossus|meka.*korea|korea.*meka/i, 'gwishin'],
  [/black hole|gravity|siebren|de kuiper|subject.?sigma|melody|universe.*sing/i, 'sigma'],
  [/king.?s row|underworld|turing|mondatta|london.*omnic|omnic.*london/i, 'housing'],
  [/luxury|fashion|holo|akihabara|chassis|indulgen|party/i, 'lux'],
  [/copenhagen|denmark|freja|storm|tracker|search.?and.?rescue|bounty/i, 'freja'],
  [/vishkar|hard light|utopaea|domina|singhania|architect|arms/i, 'domina'],
  [/numbani|adeyemi|or-?15|orisa|ogundimu|gauntlet/i, 'numbani'],
  [/reckoning|scrapyard|mason|throne|crown|junker queen|wasteland/i, 'throne'],
];

for (const [re, tag] of patterns) {
  console.log('\n####', tag);
  for (const c of convs) {
    if (isChatterEntry(c)) {
      for (const l of c.lines || []) {
        if (!isActiveChatterLineForCommentary(l)) continue;
        const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
        const blob = `${lab} ${l.disclaimer || ''}`;
        if (re.test(blob)) console.log('C', st(lab), lab.slice(0, 140));
      }
    } else {
      const lines = [...(c.lines || [])];
      for (const p of c.paths || []) if (p.lines) lines.push(...p.lines);
      const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
      if (re.test(blob) && /ramattra|null|mondatta|sigma|black|gravity|king|underworld|shion|freja|domina|vishkar|numbani|doomfist|orisa|junker|reckoning|mason|gwishin|busan/i.test(blob + c.name)) {
        const heroes = [...new Set(lines.map((l) => l.hero).filter(Boolean))];
        console.log('D', st(c.name), c.name, `[${heroes.slice(0, 5).join(',')}]`, blob.slice(0, 120).replace(/\s+/g, ' '));
      }
    }
  }
}

// Named dialogue dumps
const names = [
  'Fight for All Omnics',
  'Wasted Time',
  'Where Max lives',
  'Being in Charge',
  'Show some respect',
  'Special Order',
  'In a Dream',
  'Bending the Knee',
  'Silhouette',
  'Happy to Kill',
  'Hashimoto Bounties',
  'Outside Hire',
  'On the Wrong Path',
  'Looking Back',
  'Prize Hunter',
];
console.log('\n#### named dialogues');
for (const name of names) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISSING', name);
    continue;
  }
  console.log('===', name, st(name), '===');
  for (const l of (c.lines || []).slice(0, 6)) {
    console.log(' ', l.hero + ':', (l.subtitles || '').slice(0, 140));
  }
}
