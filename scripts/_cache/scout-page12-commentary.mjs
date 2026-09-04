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

const heroIn = (heroes, names) =>
  names.some((n) => heroes.some((h) => h.toLowerCase() === n.toLowerCase()));

function dump(label, pred, limit = 16) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 280).replace(/\s+/g, ' ')}`);
  }
}

dump(
  '#111 Prejudice / discrimination / hunted / coexist / ravager extinction',
  (x) =>
    /prejudic|discriminat|hunted|coexist|hate omnics|never forgive|extinction|rotten few|ravager|not himself|fear.*omnic|omnic.*rights/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Ramattra', 'Zenyatta', 'Shion', 'Bastion']) &&
      /human|hate|forgiv|crisis|fear|kill|hunt|prejudic/i.test(x.blob)),
);

dump(
  '#112 Shion / Hashimoto / chains / cage / Tokyo / awakening fear',
  (x) =>
    /shion|hashimoto|cage|captive|kept|chains|prison|tokyo|akihabara|yōkai|yokai|scrap with the hashimoto/i.test(
      x.blob,
    ) || heroIn(x.heroes, ['Shion']),
);

dump(
  '#113 Temple of Anubis / quarantine / jailers / destroy Anubis / study AI',
  (x) =>
    /temple|anubis|jailer|quarantine|god (ai|program)|destroy it|locked up|cairo|egypt/i.test(
      x.blob,
    ),
);

dump(
  '#114 Toronto / rebuild / Omnic employment / Sojourn / Ontario / rights',
  (x) =>
    /toronto|ontario|rebuild|omnic rights|coexist|canada|charon|wilcox|sojourn.*(home|canada|omnic)/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Sojourn']) &&
      /omnic|canada|home|rights|overwatch|recruit|toronto/i.test(x.blob)),
);

dump(
  '#115 Adawe / Numbani / Harmony / Petras / IJC / depart',
  (x) =>
    /adawe|numbani|harmony|petras|ijc|city of|coexist|orisa.*numb|defending numb/i.test(x.blob),
);

dump(
  '#116 Ashe / BOB / Lead Rose / loyal / friend returned',
  (x) =>
    /\bb\.?o\.?b\b|bob\b|lead rose|arbalest|loyal guardian|childhood|ashe.*(friend|omnic)/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Ashe']) && /bob|friend|family|alone|omnic|child/i.test(x.blob)),
);

dump(
  '#117 New Leadership / Morrison / Reyes / Emre / Blackwatch / Strike Commander',
  (x) =>
    /strike commander|blackwatch|morrison|reyes|emre|sarioglu|new leadership|recommended|covert/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Soldier 76', 'Reaper', 'Emre']) &&
      /command|leader|reyes|morrison|blackwatch|promot/i.test(x.blob)),
);

dump(
  '#118 White Dome / Istanbul / Torbjörn arm eye / injury / Emre first mission',
  (x) =>
    /white dome|istanbul|turkey|lost.*(arm|eye)|prosthetic|injury|lindholm.*(arm|eye)|emre/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Torbjörn', 'Reinhardt', 'Ana', 'Emre']) &&
      /arm|eye|injur|wound|mission|loyalist|crisis/i.test(x.blob)),
);

dump(
  '#120 Australia / ALF / Junkertown / Omnium explosion / Outback / Roadhog / Queen',
  (x) =>
    /junkertown|junker|alf|australian|outback|omnium.*(explod|nuclear|fallout)|wasteland|liberation front|mason howl/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Junker Queen', 'Roadhog', 'Junkrat']) &&
      /omnium|australia|outback|junker|king|queen|fallout|nuclear|home/i.test(x.blob)),
);

const want = [
  "Anubis's Jailers",
  'Not Himself',
  'A Ravager',
  'Rotten Few',
  'Changed much',
  'Hope for more',
  'Locked up',
  'Optimism',
  'Looking Sharp',
  'Coward Run',
  'Los Muertos',
  'Not an Omnic',
  'Strenght through Suffering',
  'Real Glory',
  'Back Home',
  'Thanks to your Parents',
  'Twice as Many Lindholms',
  'Lidnholm Spark',
  'Hard Bargain',
  'Dorothy',
  'Firewall System',
  'Digging up Old problems',
  'Ask to Change',
  'What part of Canada',
  'Awful Quiet',
  'Why Withdraw',
  'The Name Null Sector',
  'Before the Crisis',
  'Family Issues',
];
console.log('\n==== EXACT CANDIDATES ====');
for (const name of want) {
  const h = all.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!h) {
    console.log(`MISSING ${name} | JSON ${status(name)}`);
    continue;
  }
  console.log(`${status(h.name).padEnd(52)} | ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 240).replace(/\s+/g, ' ')}`);
}

console.log('\n==== NAME SEARCHES ====');
for (const re of [
  /shion|hashimoto|y[oō]kai/i,
  /bob|b\.o\.b/i,
  /emre|sarioglu|white dome|istanbul/i,
  /numbani|adawe|harmony/i,
  /junker|outback|australia|omnium/i,
  /jailer|anubis|temple/i,
  /toronto|canada|ontario|omnic rights/i,
  /ravager|prejudic|hunted|coexist/i,
]) {
  const hits = all.filter((x) => re.test(x.name) || re.test(x.blob));
  console.log(`\n~ /${re.source}/i → ${hits.length}`);
  for (const h of hits.slice(0, 12)) {
    console.log(`  - ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
  }
}
