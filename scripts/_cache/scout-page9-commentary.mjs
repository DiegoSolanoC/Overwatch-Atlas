import fs from 'fs';

const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const used = new Set(Object.keys(usedRaw));

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

const heroIn = (heroes, names) =>
  names.some((n) => heroes.some((h) => h.toLowerCase() === n.toLowerCase()));

function mark(name) {
  const u = used.has(String(name).toLowerCase());
  const where = usedRaw[String(name).toLowerCase()];
  return u ? ` [ALREADY USED: ${(where || []).join('; ')}]` : ' [free]';
}

function dump(label, pred, limit = 14) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name}${mark(h.name)} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 260).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'Illari / Inti / sun / solar / Runasapi / Children',
  (x) =>
    /inti|paqarina|runasapi|child of the sun|solar|sun warrior/i.test(x.blob) ||
    (heroIn(x.heroes, ['Illari']) &&
      /sun|inti|crisis|augment|protect|warrior|village|peru/i.test(x.blob)),
);

dump(
  'Doomfist / Ngombé / gauntlet / strength in struggle',
  (x) =>
    /doomfist|gauntlet|ngomb|strength in struggle|nigeria|ibadan/i.test(x.blob) ||
    (heroIn(x.heroes, ['Doomfist']) && /crisis|power|strength|fist|title|heir/i.test(x.blob)),
);

dump(
  'Volskaya / Svyatogor / mech / Katya / Russia mechs',
  (x) =>
    /svyatogor|volskaya|mech/i.test(x.blob) ||
    (heroIn(x.heroes, ['Zarya']) && /volskaya|mech|crisis|protect|russia/i.test(x.blob)),
);

dump(
  'Adawe / Overwatch proposal / founding / strike team',
  (x) =>
    /adawe|founding|proposal|strike team|united nations|overwatch was formed|first overwatch/i.test(
      x.blob,
    ) ||
    (heroIn(x.heroes, ['Ana', 'Reinhardt', 'Soldier 76', 'Torbjörn', 'Mercy']) &&
      /overwatch.*(begin|start|found|form)|when overwatch|early days/i.test(x.blob)),
);

dump(
  'Recruiting heroes / invitation / joining Overwatch crisis',
  (x) =>
    /recruit|join overwatch|invited|candidate|strike force/i.test(x.blob) &&
    !/favorite animals/i.test(x.name),
);

dump(
  'Ana sniper / Cairo / Egypt / El-Saqa / mother Fareeha',
  (x) =>
    (heroIn(x.heroes, ['Ana', 'Pharah']) &&
      /cairo|egypt|sniper|crisis|el-?sa|fareeha|mother|protect/i.test(x.blob)) ||
    /cairo|el-?saqa|sa'ka/i.test(x.blob),
);

dump(
  'Torb Defense Network / invite himself / Ironclad crisis',
  (x) =>
    heroIn(x.heroes, ['Torbjörn']) &&
    /defense|network|overwatch|invite|turret|ironclad|crisis|sweden|bastion/i.test(x.blob),
);

dump(
  'NYC skycannon / Ravager / Manhattan crisis fortify',
  (x) =>
    /skycannon|manhattan|new york|ravager|r-7000|carrier/i.test(x.blob) ||
    (heroIn(x.heroes, ['Ramattra', 'Torbjörn']) && /new york|awakening|manhattan/i.test(x.blob)),
);

dump(
  'Crusader myth / honor glory / Balderich / Reinhardt knight',
  (x) =>
    /crusader|balderich|honor|glory|knight|oath|chivalry/i.test(x.blob) ||
    (heroIn(x.heroes, ['Reinhardt', 'Brigitte']) &&
      /crusader|knight|honor|glory|balderich|shield/i.test(x.blob)),
);

dump(
  'SEP / Enhancement / Reyes Morrison / Naughton',
  (x) =>
    /enhancement|sep\b|naughton|super soldier|soldier 24|soldier 76|reyes|morrison/i.test(x.blob) ||
    [
      'Enhancement Program',
      'Enhanced Soldiers',
      'Naughton Vault',
      'Painful Memories',
    ].includes(x.name),
);
