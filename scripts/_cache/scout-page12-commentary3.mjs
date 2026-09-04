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

function dump(label, pred, limit = 20) {
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
  ['jailer/anubis/locked', /jailer|anubis|locked/i],
  ['ravager/himself/rotten/changed/awakening', /ravager|himself|rotten|changed|awakening|archaeology/i],
  ['hope/optimism/glory', /hope|optimism|glory/i],
  ['bob/servant/toy', /b\.?o\.?b|servant|toy|fire ?power/i],
  ['shion/hashimoto/cage/prison', /shion|hashimoto|cage|prison|kill/i],
  ['numbani/looking/coward', /numbani|looking sharp|coward/i],
  ['canada/toronto', /canada|toronto/i],
  ['junker/outback/dream/australia', /junker|outback|dream|australia|omnium/i],
  ['emre/blackwatch/reyes', /emre|blackwatch|reyes|commander/i],
  ['arm/eye/prosthetic/istanbul', /arm|eye|prosthetic|istanbul|dome/i],
  ['family/parents/lindholm/home', /family|parents|lindholm|back home|dorothy|bargain/i],
]) {
  const hits = byNameRe(re);
  console.log(`\n~ ${label} (${hits.length})`);
  for (const h of hits.slice(0, 15)) {
    console.log(`  ${status(h.name).padEnd(40)} | ${h.name} [${h.heroes.join(', ')}]`);
  }
}

dump(
  '#111 prejudice / hunted / coexist / ravager',
  (x) =>
    /ravager|hunted|coexist|prejudic|hate omnics|not himself|rotten few|new chassis|changed much|never forgive/i.test(
      x.blob,
    ) ||
    (x.heroes.some((h) => /ramattra|zenyatta|bastion|shion/i.test(h)) &&
      /human|hate|forgiv|crisis|fear|kill|hunt/i.test(x.blob)),
  16,
);

dump(
  '#112 shion / hashimoto / cage / awakening fear',
  (x) =>
    x.heroes.some((h) => /^shion$/i.test(h)) ||
    /hashimoto|bird in a cage|rate the prison|happy to kill/i.test(x.blob),
  22,
);

dump(
  '#113 anubis temple / jailers',
  (x) => /anubis|jailer|locked up|quarantine|temple of/i.test(x.blob),
);

dump(
  '#114 toronto / canada / sojourn omnic',
  (x) =>
    /toronto|canada|what part of canada|ontario|omnic rights|rebuild/i.test(x.blob) ||
    (x.heroes.some((h) => /sojourn/i.test(h)) && /omnic|canada|home|rights/i.test(x.blob)),
  14,
);

dump(
  '#115 numbani / adawe',
  (x) => /numbani|adawe|looking sharp|coward run|harmony/i.test(x.blob),
);

dump(
  '#116 ashe / bob',
  (x) => /\bb\.?o\.?b\b|freeing your|servant|not a toy|lead rose/i.test(x.blob),
);

dump(
  '#117 emre / morrison / reyes / blackwatch',
  (x) =>
    x.heroes.some((h) => /emre/i.test(h)) ||
    /blackwatch|reyes|strike commander|morrison|new leadership/i.test(x.blob),
  16,
);

dump(
  '#118 injury / arm / eye / istanbul',
  (x) =>
    /istanbul|white dome|prosthetic|upgrade that arm|other eye|lost.*(arm|eye)/i.test(x.blob) ||
    (x.heroes.includes('Torbjörn') && /arm|eye|injur|wound/i.test(x.blob)),
);

dump(
  '#120 junker / australia / omnium',
  (x) =>
    /junkertown|outback|australia|omnium|junkers giving|in a dream|seen you before|show some respect/i.test(
      x.blob,
    ),
  16,
);
