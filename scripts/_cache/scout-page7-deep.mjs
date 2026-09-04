import fs from 'fs';

const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

function expand(c) {
  let lines = (c.lines || []).slice();
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = [...new Set(lines.map((l) => l.hero).filter(Boolean))];
  const subs = lines.map((l) => `${l.hero || ''}: ${l.subtitles || ''}`).join(' | ');
  return {
    name: c.name,
    heroes,
    subs,
    blob: `${c.name} ${subs}`.toLowerCase(),
    status: c.status,
    entryType: c.entryType || 'dialogue',
  };
}

const all = convs
  .map(expand)
  .filter((x) => x.entryType !== 'chatter' && x.status !== 'removed');

function dump(label, pred, limit = 16) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'crusader OR balderich OR sir wilhelm OR knights at bay',
  (x) => /crusader|balderich|sir wilhelm|knights to keep|brave knight|noble squire/i.test(x.blob),
);

dump(
  'SEP / enhancement / Gabriel / Morrison program',
  (x) =>
    /soldier enhancement|enhancement program|naughton|sep\b|enhanced soldier|super soldier|they enhanced|gene/i.test(
      x.blob,
    ) ||
    (x.heroes.includes('Reaper') &&
      x.heroes.includes('Soldier 76') &&
      /experiment|program|old friend|strength|side effect|what they did/i.test(x.blob)),
);

dump(
  'Reaper/76 relationship experiments',
  (x) =>
    x.heroes.includes('Reaper') &&
    x.heroes.includes('Soldier 76') &&
    !/favorite animals|periodic table/i.test(x.name),
);

dump(
  'Shion form / crude design / scars / weapon',
  (x) =>
    ['Changed much', 'Strenght in Struggle', 'Great Potential', 'Pretending to Listen', 'Happy to Kill'].includes(
      x.name,
    ) ||
    (x.heroes.includes('Shion') && /form humans built|crude design|weapon|scars they gave/i.test(x.blob)),
);

dump(
  'Ramattra Ravager / Awakening NY / Anubis',
  (x) =>
    ['A Ravager', 'Your Awakening', "Anubis's Jailers", 'New Chassis', 'Not Himself', 'Before the Crisis'].includes(
      x.name,
    ),
);

dump(
  'Answers Aurora pilgrimage exact',
  (x) =>
    ['Meeting Aurora', 'Interesting Theory', 'Asthma', 'Omnic archaeology', 'Owe to the Iris'].includes(
      x.name,
    ),
);

dump('Naughton', (x) => /naughton/i.test(x.blob));
