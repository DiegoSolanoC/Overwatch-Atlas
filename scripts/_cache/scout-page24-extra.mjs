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
const st = (n) => (used.has(String(n).toLowerCase()) ? 'USED' : 'free');
const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

console.log('=== SIERRA dialogues ===');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = lines.map((l) => l.hero || '').join(' ');
  const blob = `${c.name} ${heroes} ${lines.map((l) => l.subtitles || '').join(' ')}`;
  if (/sierra/i.test(blob)) {
    console.log(st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
    for (const l of lines.slice(0, 4)) {
      console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 120)}`);
    }
  }
}

console.log('\n=== Mei storm rising ===');
for (const c of convs) {
  if (!isChatterEntry(c)) continue;
  for (const l of c.lines || []) {
    if (!isActiveChatterLineForCommentary(l)) continue;
    if (/storm is rising/i.test(l.subtitles || '')) {
      const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
      console.log(st(lab), lab);
    }
  }
}

console.log('\n=== Named extras ===');
for (const name of [
  'Next Funeral',
  "Anubis's Jailers",
  'Rate the Prison',
  'Coward Run',
  'How can you live with yourself',
  'Inefficient',
  'Enjoying Prison',
  'More Wires than Skin',
  'Jack Morrison',
  'Giving up on you',
  'Complicated',
]) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  console.log(`\n${st(c.name)} | ${name}`);
  for (const l of lines.slice(0, 5)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 130)}`);
  }
}

console.log('\n=== backlash / disband / overwatch end ===');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
  if (
    /disband|backlash|petras|overwatch.*(over|end|done|shut)|should.*(exist|continue)|recall|heroes of old|criminal/i.test(
      blob,
    )
  ) {
    console.log(st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
  }
}

console.log('\n=== Winston + Doomfist dialogues ===');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = new Set(lines.map((l) => (l.hero || '').toLowerCase()));
  const blob = lines.map((l) => l.subtitles || '').join(' ');
  if (
    (heroes.has('winston') && heroes.has('doomfist')) ||
    /winston.*(gauntlet|doomfist)|doomfist.*winston|gorilla/i.test(blob)
  ) {
    console.log(st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
    for (const l of lines.slice(0, 3)) {
      console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 100)}`);
    }
  }
}
