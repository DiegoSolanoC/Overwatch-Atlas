import fs from 'fs';

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

for (const name of [
  'Without my mom',
  'Tugging Heartstrings',
  'Naughton Vault',
  'Stay buried',
  'Stopped you once',
  'Beaten by a Monkey',
  'Overwatch Survived',
  'Answer the recall',
  'Hoping for Overwatch',
  'Just Recall',
  'Condolences',
  'What is left',
  'Overwatch failed you',
  'Running from Responsability',
  'Into the thick of it',
  'Care to listen',
]) {
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
