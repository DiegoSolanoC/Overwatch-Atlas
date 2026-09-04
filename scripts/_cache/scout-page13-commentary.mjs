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

function byNameRe(re) {
  return all.filter((x) => re.test(x.name));
}

console.log('==== NAME HITS ====');
for (const [label, re] of [
  ['gibraltar/watchpoint/martins/orbital', /gibraltar|watchpoint|martins|orbital|grand mesa|zurich/i],
  ['blackwatch/reyes/gerard/undercover', /blackwatch|reyes|g[eé]rard|undercover|covert/i],
  ['vincent/morrison/family/settle', /vincent|settle|family|duty|lonely|love|partner/i],
  ['iris/shambali/mondatta/aurora/pilgrim', /iris|shambali|mondatta|pilgrim|aurora|coexist|unity/i],
  ['junker/howl/outcast/wasteland/dez', /junker|howl|outcast|wasteland|dez|queen/i],
  ['angela/mercy/nanobiot|zeigler|chalmers', /angela|mercy|nanobiot|zeigler|heal|miracle/i],
  ['deadlock/ashe/cassidy/arbalest/heist', /deadlock|arbalest|heist|jail|prison|cole|ashe/i],
  ['colosseo/gladiator/rome/italy/arena', /colosse|gladiator|rome|italy|arena|illios|colossus/i],
  ['sierra/sep/woods/appalach', /sierra|woods|appalach|sep|kendra/i],
]) {
  const hits = byNameRe(re);
  console.log(`\n~ ${label} (${hits.length})`);
  for (const h of hits.slice(0, 14)) {
    console.log(`  ${status(h.name).padEnd(42)} | ${h.name} [${h.heroes.join(', ')}]`);
  }
}

dump(
  '#121 Watchpoints / Gibraltar / Martins / bases',
  (x) =>
    /gibraltar|watchpoint|martins|hector|claudio|orbital|grand mesa|kerguelen|gr[ií]ms|xining|zurich hq/i.test(
      x.blob,
    ) ||
    (x.heroes.some((h) => /torbjörn|winston|echo|sojourn/i.test(h)) &&
      /gibraltar|watchpoint|base|launch/i.test(x.blob)),
);

dump(
  '#122 Blackwatch / Reyes / Gérard / covert',
  (x) =>
    /blackwatch|reyes|g[eé]rard|lacroix|covert|undercover|red tape/i.test(x.blob) ||
    (x.heroes.some((h) => /reaper|emre|cassidy|genji/i.test(h)) &&
      /blackwatch|reyes|covert|shadow/i.test(x.blob)),
  18,
);

dump(
  '#123 Duty / Vincent / Morrison personal life',
  (x) =>
    /vincent|settle down|strike commander|lonely|no time|duty calls|personal life|had someone/i.test(
      x.blob,
    ) ||
    (x.heroes.some((h) => /soldier 76|soldier: 76|reaper|ana/i.test(h)) &&
      /family|love|partner|lonely|regret|settle|home/i.test(x.blob)),
  16,
);

dump(
  '#125 Iris / Shambali / Mondatta / pilgrimage',
  (x) =>
    /iris|shambali|mondatta|pilgrim|aurora|one within|coexistence|omnic rights/i.test(x.blob) ||
    (x.heroes.some((h) => /zenyatta|ramattra|echo|lifeweaver|venture/i.test(h)) &&
      /iris|shambali|mondatta|aurora|faith|monk|pilgrim/i.test(x.blob)),
  18,
);

dump(
  '#126 Outcast / Howl / Junkertown / Dez wasteland',
  (x) =>
    /howl|outcast|wasteland|junkertown|mason|feral|exile|throne|highness/i.test(x.blob) ||
    (x.heroes.some((h) => /junker queen|roadhog|junkrat/i.test(h)) &&
      /family|king|queen|exile|home|survive|wasteland|outback/i.test(x.blob)),
  16,
);

dump(
  '#127 Angela / nanobiotics / Zurich / Chalmers / Torb recommend',
  (x) =>
    /nanobiot|zeigler|chalmers|youngest|miracle worker|medical prodigy|overwatch fund/i.test(
      x.blob,
    ) ||
    (x.heroes.some((h) => /mercy|sigma|torbjörn|soldier 76/i.test(h)) &&
      /school|student|study|research|nanobiot|heal|medicine|doctor|paper/i.test(x.blob)),
  16,
);

dump(
  '#129 Deadlock / Ashe Cassidy meet / Arbalest heist',
  (x) =>
    /deadlock|arbalest|heist|farmhand|megafarm|julian|frankie/i.test(x.blob) ||
    (x.heroes.includes('Ashe') &&
      x.heroes.some((h) => /cassidy|cole/i.test(h))) ||
    (x.heroes.some((h) => /ashe|cassidy/i.test(h)) &&
      /jail|prison|gang|steal|family|parents|bob/i.test(x.blob)),
  18,
);

dump(
  '#130 Colosseo / gladiator / classical rebuild',
  (x) =>
    /colosse|gladiator|rome|italy|arena victoria|illios|colossus|classical|pageant/i.test(x.blob) ||
    (x.heroes.some((h) => /vendetta|doomfist|reinhardt|mauga/i.test(h)) &&
      /arena|gladiator|colosse|rome|champion|fight.*crowd/i.test(x.blob)),
  14,
);
