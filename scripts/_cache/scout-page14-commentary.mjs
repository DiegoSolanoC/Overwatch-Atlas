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
  ['anima/shimada/dragon/fox/kiriko/toshiro', /anima|shimada|dragon|fox|ofuda|kiriko|toshiro|yamagami|hanamura/i],
  ['ramattra/zenyatta/mondatta/brother/shambali', /ramattra|zenyatta|mondatta|brother|shambali|ravager|coexist/i],
  ['deadlock/ashe/cassidy/diamondback/gorge', /deadlock|diamondback|gorge|ashe|cassidy|bez|frankie/i],
  ['vancouver/flood/janitor|pipeline|dam|seattle', /vancouver|flood|janitor|pipeline|dam|seattle|british columbia/i],
  ['reyes/blackwatch/recruit/gunslinger|mentor', /reyes|blackwatch|gunslinger|recruit|mentor|jail|second chance/i],
  ['vishkar/architect|symmetra|lifeweaver|academy|hard light', /vishkar|architect|symmetra|lifeweaver|academy|hard.?light|satya|niran/i],
  ['mei/climate|ecopoint|weather|jiayi|lucheng', /mei|climate|ecopoint|weather|jiayi|lucheng|storm|atmosphere/i],
]) {
  const hits = all.filter((x) => re.test(x.name));
  console.log(`\n~ ${label} (${hits.length})`);
  for (const h of hits.slice(0, 14)) {
    console.log(`  ${status(h.name).padEnd(44)} | ${h.name} [${h.heroes.join(', ')}]`);
  }
}

dump(
  '#131 Anima / Shimada / fox / dragon blades',
  (x) =>
    /anima|shimada|dragon|fox spirit|ofuda|yamagami|hanamura|kanezaka|kiriko.*(father|mother|clan)|genji.*(father|clan)|hanzo.*(father|clan)/i.test(
      x.blob,
    ) ||
    (x.heroes.some((h) => /kiriko|hanzo|genji/i.test(h)) &&
      /family|clan|blade|sword|father|mother|dragon|fox|shimada/i.test(x.blob)),
  18,
);

dump(
  '#132 Brotherhood / Ramattra Zenyatta Mondatta',
  (x) =>
    /brother|mondatta|shambali|ravager|coexist|harmony|purpose|stars/i.test(x.blob) &&
    x.heroes.some((h) => /ramattra|zenyatta/i.test(h)),
  18,
);

dump(
  '#133/#136/#137 Deadlock / Cassidy recruit / Reyes',
  (x) =>
    /deadlock|diamondback|gunslinger|reyes|blackwatch|second chance|recruit|mentor|outlaw|jail|prison/i.test(
      x.blob,
    ) ||
    (x.heroes.includes('Cassidy') &&
      x.heroes.some((h) => /ashe|reaper|ana|soldier 76/i.test(h))) ||
    (x.heroes.includes('Ashe') && /gang|family|parents|bob|cassidy|cole/i.test(x.blob)),
  22,
);

dump(
  '#134 Vancouver flood / rebuild / janitors',
  (x) =>
    /vancouver|flood|janitor|pipeline|dam|seattle|rebuild|disaster|evacuat/i.test(x.blob) ||
    (x.heroes.some((h) => /torbjörn|ana|soldier 76|reinhardt/i.test(h)) &&
      /rebuild|flood|disaster|help people|janitor|engineering/i.test(x.blob)),
  14,
);

dump(
  '#139 Vishkar Academy / Sym Lifeweaver school',
  (x) =>
    /vishkar|architect academy|hard.?light|roommate|orphan|academy/i.test(x.blob) ||
    (x.heroes.includes('Symmetra') && x.heroes.includes('Lifeweaver')) ||
    (x.heroes.some((h) => /symmetra|lifeweaver/i.test(h)) &&
      /vishkar|school|student|academy|order|perfection|friend/i.test(x.blob)),
  18,
);

dump(
  '#140 Mei climate / ecopoint / weather',
  (x) =>
    /climate|ecopoint|weather|atmosphere|storm|lucheng|jiayi|climatolog/i.test(x.blob) ||
    (x.heroes.includes('Mei') &&
      /research|science|weather|climate|ice|storm|future|study|overwatch/i.test(x.blob)),
  16,
);
