import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
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
  'Cryostasis',
  'Cryogenic Freezing',
  'Cryogenic research',
  'Genetic Issues',
  "Toshiro's forge",
  'Trust Sombra',
  'Fear the Reaper',
  'Grim Reaper',
  'Hardlight Snowflakes',
  'Count on Mei',
  'Snow angels',
  'Vishkar is using you',
  'Hashimoto calls',
];

for (const name of names) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  console.log(`=== ${name} [${st(name)}] ===`);
  for (const l of c.lines || []) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 160)}`);
  }
}

console.log('\n==== Echo+Cassidy ====');
for (const c of convs) {
  if (isChatterEntry(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = new Set(lines.map((l) => l.hero));
  if (heroes.has('Echo') && heroes.has('Cassidy')) {
    console.log(
      st(c.name),
      c.name,
      '|',
      lines.map((l) => `${l.hero}: ${(l.subtitles || '').slice(0, 70)}`).join(' / '),
    );
  }
}

console.log('\n==== Moira + Mercy/Reaper/76 ====');
for (const c of convs) {
  if (isChatterEntry(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = [...new Set(lines.map((l) => l.hero))];
  if (
    heroes.includes('Moira') &&
    (heroes.includes('Mercy') || heroes.includes('Reaper') || heroes.includes('Soldier 76'))
  ) {
    console.log(
      st(c.name),
      c.name,
      '|',
      lines.map((l) => `${l.hero}: ${(l.subtitles || '').slice(0, 80)}`).join(' / '),
    );
  }
}

console.log('\n==== Mauga / Samoa ====');
for (const c of convs) {
  if (isChatterEntry(c)) {
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      if (!/^Mauga$/i.test(l.hero || c.name)) continue;
      if (/samoa|coral|pirate|raider|father|home|sea/i.test(`${l.subtitles} ${l.disclaimer}`)) {
        const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
        console.log('C', st(lab), lab.slice(0, 140));
      }
    }
  } else {
    let lines = [...(c.lines || [])];
    for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
    const blob = `${c.name} ${lines.map((l) => l.subtitles).join(' ')}`;
    if (/mauga|samoa|coral|pirate|raider|deep.?sea/i.test(blob) && lines.some((l) => l.hero === 'Mauga')) {
      console.log('D', st(c.name), c.name, '|', blob.slice(0, 140).replace(/\s+/g, ' '));
    }
  }
}

console.log('\n==== Mei Antarctica ====');
for (const c of convs) {
  if (!isChatterEntry(c)) continue;
  for (const l of c.lines || []) {
    if (!isActiveChatterLineForCommentary(l)) continue;
    if (!/^Mei$/i.test(l.hero || c.name)) continue;
    if (/antarctic|ecopoint|cryo|blizzard|frozen|storm|ice/i.test(`${l.subtitles} ${l.disclaimer}`)) {
      const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
      console.log('C', st(lab), lab.slice(0, 140));
    }
  }
}

console.log('\n==== Kiriko grandma / Toshiro ====');
for (const c of convs) {
  if (isChatterEntry(c)) {
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      if (/toshiro|asa|grandma|kamori|hostage|yamagami/i.test(`${l.subtitles} ${l.disclaimer}`)) {
        const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
        console.log('C', st(lab), lab.slice(0, 140));
      }
    }
  }
}
