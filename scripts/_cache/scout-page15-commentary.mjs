import fs from 'fs';

const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const used = new Map(Object.entries(usedRaw));

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

function status(name) {
  const k = String(name).toLowerCase();
  if (used.has(k)) return `USED → ${(used.get(k) || []).join('; ')}`;
  return 'free';
}

function dump(label, pred, limit = 16) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 270).replace(/\s+/g, ' ')}`);
  }
}

console.log('==== NAME HITS ====');
for (const [label, re] of [
  ['ecopoint/antarctica/mei/climate/martins', /ecopoint|antarctica|connemara|climate|martins|environment/i],
  ['coalition/caribbean/inti/cuba/havana', /coalition|caribbean|inti|havana|cuba|peacekeep/i],
  ['pharah/ana/fareeha/sniper/egypt', /fareeha|pharah|ana|sniper|egypt|cairo|overwatch.*(join|daughter)/i],
  ['sierra/kendra/sep/run/appalach', /sierra|kendra|naughton|appalach|on the run|sep/i],
  ['brigitte/torbjorn/reinhardt/spark/armor/jetpack', /brigitte|lindholm|jetpack|armor|spark|cookie|mitzi/i],
  ['liao/athena/echo/aurora/ai', /liao|athena|echo|aurora|artificial|god program/i],
  ['gwishin/busan/meka/korea/colossus', /gwishin|busan|meka|korea|colossus|xining/i],
]) {
  const hits = all.filter((x) => re.test(x.name));
  console.log(`\n~ ${label} (${hits.length})`);
  for (const h of hits.slice(0, 12)) {
    console.log(`  ${status(h.name).padEnd(44)} | ${h.name} [${h.heroes.join(', ')}]`);
  }
}

dump(
  '#142 Ecopoint / Martins / environment / Antarctica',
  (x) =>
    /ecopoint|antarctica|connemara|tarapoto|monterey|zealandia|environment|climate|martins|hector|claudio/i.test(
      x.blob,
    ) ||
    (x.heroes.includes('Mei') && /ecopoint|antarctica|research|climate|overwatch/i.test(x.blob)),
  16,
);

dump(
  '#144 Coalitions / Caribbean / Inti / Havana',
  (x) =>
    /caribbean|inti|havana|cuba|coalition|baptiste|mauga|illari|sun.*warrior/i.test(x.blob) ||
    (x.heroes.some((h) => /baptiste|mauga|illari|pharah/i.test(h)) &&
      /coalition|caribbean|inti|army|home|overwatch.*join|join.*overwatch/i.test(x.blob)),
  16,
);

dump(
  '#146 Ana Pharah / join Overwatch / sniper training',
  (x) =>
    (x.heroes.includes('Ana') && x.heroes.includes('Pharah')) ||
    /fareeha|join overwatch|like your mother|follow in|sniper.*train|egypt.*army/i.test(x.blob),
  18,
);

dump(
  '#147 Sierra on the run / SEP inheritance',
  (x) =>
    x.heroes.some((h) => /sierra/i.test(h)) ||
    /on the run|naughton|soldier.?00|sep|enhancement.*inherit/i.test(x.blob),
  16,
);

dump(
  '#148 Brigitte spark / armor / Reinhardt stories',
  (x) =>
    (x.heroes.includes('Brigitte') &&
      x.heroes.some((h) => /torbjörn|reinhardt/i.test(h))) ||
    /jetpack|mitzi|cookie|ladder|armor.*brigitte|godfather/i.test(x.blob),
  18,
);

dump(
  '#149 Liao Athena / Echo / AI trust',
  (x) =>
    /athena|liao|god program|artificial intelligence|created me|improve the world/i.test(x.blob) ||
    (x.heroes.includes('Echo') && /liao|created|athena|aurora|ai/i.test(x.blob)),
  16,
);

dump(
  '#150 Gwishin / Busan / MEKA / Korea',
  (x) =>
    /gwishin|busan|meka|korea|colossus|xining|dae-hyun|hover/i.test(x.blob) ||
    (x.heroes.some((h) => /d\.va|dva|mei|kiriko/i.test(h)) &&
      /korea|busan|meka|gwishin|home/i.test(x.blob)),
  16,
);
