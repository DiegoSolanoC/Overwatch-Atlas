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
      blob: `${c.name} ${subs}`.toLowerCase(),
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
  const h = all.find((x) => x.name.toLowerCase() === String(n).toLowerCase());
  if (!h) {
    console.log(`MISSING ${n}`);
    return;
  }
  console.log(`${st(h.name).padEnd(48)} | ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
}

function dump(label, pred, limit = 14) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${st(h.name)}] [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 260).replace(/\s+/g, ' ')}`);
  }
}

[
  'The Martinses',
  'Visiting the Martinses',
  'Curious Whales',
  'Condolences',
  'Asleep for a long time',
  'Making a Difference',
  'Looking Sharp',
  'Coward Run',
  'Did you fail',
  'Optimism',
  'Mina Liao',
  'Shared Programming',
  'Peanut Butter',
  'Keeping the Label',
  'Jurong',
  'Chicken Rice',
  'Locked up',
  'Naughton Vault',
  'Lindholm Spark',
  'Twice as Many Lindholms',
  'My little girl',
  'Ready to work',
  'Cat Jetpack',
  'New Armor',
  'Korea Style',
  'Busan fireworks',
  'Propaganda Machine',
  'Not much Sleep',
  'You didn\'t leave',
  'Mech Mechanic',
].forEach(show);

dump(
  'Baptiste Caribbean / Coalition / OW posters',
  (x) =>
    x.heroes.includes('Baptiste') &&
    /caribbean|coalition|haiti|poster|overwatch|medic|recruit|orphan|talón|talon/i.test(x.blob),
  16,
);

dump(
  'Ana + Pharah mother daughter',
  (x) => x.heroes.includes('Ana') && x.heroes.includes('Pharah'),
  20,
);

dump(
  'Numbani / Adawe / Orisa / Unity',
  (x) => /numbani|adawe|unity day|orisa.*numb|defending numb|looking sharp|coward run/i.test(x.blob),
  14,
);

dump(
  'Sierra hero lines',
  (x) => x.heroes.some((h) => /^sierra$/i.test(h)),
  18,
);

dump(
  'Illari Inti / Peru',
  (x) =>
    x.heroes.includes('Illari') && /inti|peru|child of the sun|qualified|worth conquering/i.test(x.blob),
  10,
);
