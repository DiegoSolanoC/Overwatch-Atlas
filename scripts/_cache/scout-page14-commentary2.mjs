import fs from 'fs';

const used = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const all = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations
  .map((c) => {
    let lines = (c.lines || []).slice();
    for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
    const heroes = [...new Set(lines.map((l) => l.hero).filter(Boolean))];
    const subs = lines.map((l) => `${l.hero}: ${l.subtitles || ''}`).join(' | ');
    return {
      name: c.name,
      heroes,
      subs,
      entryType: c.entryType || 'dialogue',
      status: c.status,
    };
  })
  .filter((x) => x.entryType !== 'chatter' && x.status !== 'removed');

function st(n) {
  const k = String(n).toLowerCase();
  return used[k] ? `USED → ${used[k].join('; ')}` : 'free';
}

function show(n) {
  const h = all.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (!h) {
    console.log(`MISSING ${n}`);
    return;
  }
  console.log(`${st(h.name).padEnd(48)} | ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
}

[
  "Toshiro's forge",
  'Copying Anima',
  'Fox Secret',
  'Foxes Fight Back',
  'Message for the Fox',
  "Father's Bow",
  'Eldest Son',
  'Sleeping Dragon',
  'Always my brother',
  'Like a Brother',
  'A Ravager',
  'Frankie and Bez',
  "How's Bars",
  'Nice to see you',
  'Your Parents',
  'Making a Living',
  'My Type',
  'Freeing your Servant',
  'Not a Toy',
  'Complicated',
  'Undo it all',
  'Apology',
  'Days at the Academy',
  'Missing the Academy',
  'Best Roommate',
  'Returning to Vishkar',
  'Applying to Vishkar',
  'Weather Forecast',
  'Violent Storm',
  'A Reason to Smile',
  'Making a Difference',
  'Cryogenic research',
  'So Miserable',
  'Count on Mei',
].forEach(show);

console.log('\n==== Ramattra + Zenyatta ====');
for (const h of all.filter(
  (x) => x.heroes.includes('Ramattra') && x.heroes.includes('Zenyatta'),
)) {
  console.log(`- ${h.name} [${st(h.name)}]`);
  console.log(`  ${h.subs.slice(0, 260).replace(/\s+/g, ' ')}`);
}

console.log('\n==== name contains forge/anima/brother/academy/deadlock/reyes ====');
for (const re of [/forge|anima|ofuda|fox secret/i, /brother|mondatta|shambali/i, /academy|roommate|vishkar/i, /frankie|bez|deadlock|reyes|blackwatch|gunslinger/i, /flood|janitor|pipeline|vancouver/i]) {
  console.log(`\n~ /${re.source}/`);
  for (const h of all.filter((x) => re.test(x.name) || re.test(x.subs)).slice(0, 12)) {
    console.log(`  ${st(h.name).padEnd(40)} | ${h.name}`);
  }
}
