/**
 * Detail lines for page 25 curated candidates.
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

const want = [
  'Alongside my Pupil',
  'Always my brother',
  'Missing Genji',
  'Never lose sight',
  'Come Home',
  'Keeping me Sharp',
  'Running from Responsability',
  'Overwatch failed you',
  'Hoping for Overwatch',
  'What is left',
  'Care to listen',
  'Helix mercenaries',
  'Agents of Helix',
  'Joining Helix',
  'Still Hiding',
  'Thank you Mother',
  'Going too Far',
  'Fear the Reaper',
  'Grim Reaper',
  "Don't call me anything",
  'Never see me coming',
  'Complicated',
  "Sigma's Brain",
  'Humming',
  'Snap out of it',
  'Who is we',
  'Stay Focus',
  'Another Life',
  'Useful when you show up',
  'Mina Liao',
  'Optimism',
  'Recording',
  'Masked Vigilante',
  'Vigilante Route',
  'Vigilantes',
  'Fierce Protector',
  'Always Worry',
  'Esports are Sports',
  'Mech Mechanic',
  'Time to Relax',
  'Soft Criminals',
  'Making a Living',
  'Anger Management',
  'Mechanical or Human',
  'Advance Technologies',
  'A new answer',
  'Selfie for the fans',
];

for (const name of want) {
  const c = convs.find((x) => x.name === name);
  if (!c) {
    console.log('MISS', name);
    continue;
  }
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const ow1 = String(c.status) === 'removed' ? ' [OW1]' : '';
  console.log(`\n=== ${st(c.name)} | ${name}${ow1} ===`);
  for (const l of lines.slice(0, 6)) {
    console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 150)}`);
  }
}

console.log('\n==== PETRAS / SHUTDOWN / SOJOURN ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
  if (/petras|shut.?down|illegal|testimony|hearing|stripped|IJC|William Petras/i.test(blob)) {
    console.log(st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
    for (const l of lines.slice(0, 3)) {
      console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 120)}`);
    }
  }
}

console.log('\n==== SHRIKE / ANA EGYPT ====');
for (const c of convs) {
  if (isChatterEntry(c)) {
    for (const l of c.lines || []) {
      if (!isActiveChatterLineForCommentary(l)) continue;
      if (/shrike|necropolis|cairo|egypt/i.test(`${l.subtitles} ${l.disclaimer}`)) {
        const lab = buildChatterCommentaryLabel(l.hero || c.name, l.subtitles, l.disclaimer);
        if (/Ana|Pharah|Venture/i.test(lab)) console.log(st(lab), lab.slice(0, 150));
      }
    }
    continue;
  }
  if (!isDialogueEligibleForCommentary(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
  if (/shrike|necropolis|vigilante/i.test(blob) && /Ana|Pharah/i.test(blob)) {
    console.log(st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
  }
}

console.log('\n==== DVA / ESPORTS DETAIL ====');
for (const c of convs) {
  if (!isDialogueEligibleForCommentary(c)) continue;
  let lines = [...(c.lines || [])];
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const blob = `${c.name} ${lines.map((l) => l.subtitles || '').join(' ')}`;
  if (/esport|mecha guardian|d\.mon|streamer|APM|championship|King/i.test(blob)) {
    console.log(st(c.name), String(c.status) === 'removed' ? 'OW1' : '', c.name);
    for (const l of lines.slice(0, 4)) {
      console.log(`  ${l.hero}: ${(l.subtitles || '').slice(0, 120)}`);
    }
  }
}
