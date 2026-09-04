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
    entryType: c.entryType || 'dialogue',
    heroes,
    subs,
    blob: `${c.name} ${subs}`.toLowerCase(),
    status: c.status,
  };
}

const all = convs
  .map(expand)
  .filter((x) => x.entryType !== 'chatter' && x.status !== 'removed');

const heroIn = (heroes, names) =>
  names.some((n) => heroes.some((h) => h.toLowerCase() === n.toLowerCase()));

function dump(label, pred, limit = 12) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 270).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'Lagos / Crisis start / Anubis attack / first day',
  (x) =>
    /lagos|first day|crisis (began|started)|omnium|anubis.*(attack|war)|global war/i.test(x.blob) ||
    (heroIn(x.heroes, ['Orisa', 'Baptiste', 'Doomfist']) && /crisis|nigeria|lagos/i.test(x.blob)),
);

dump(
  'Caribbean / Baptiste orphan / hurricane / coalition',
  (x) =>
    /caribbean|havana|hurricane|orphan|coalition|haiti|cuba/i.test(x.blob) ||
    (heroIn(x.heroes, ['Baptiste']) && /crisis|orphan|home|island|family/i.test(x.blob)),
);

dump(
  'Russia / Early Victories / hello we won / Zarya crisis',
  (x) =>
    /russia|moscow|volskaya|we won|siberia|novoansk/i.test(x.blob) ||
    (heroIn(x.heroes, ['Zarya']) && /crisis|omnium|protect|village|father/i.test(x.blob)),
);

dump(
  'Swedish Engineering / Torb crisis / turret / Ironclad save',
  (x) =>
    /sweden|gothenburg|turret|ironclad|save sweden|my designs|bastion|titan/i.test(x.blob) ||
    (heroIn(x.heroes, ['Torbjörn']) && /crisis|omnic|turret|bastion|responsible|build/i.test(x.blob)),
);

dump(
  'Expanding the Wall / Portugal / Esperança / wall',
  (x) =>
    /portugal|esperan|wall|lisbon|iberia/i.test(x.blob) ||
    /expanding the wall|mega.?wall/i.test(x.name + x.blob),
);

dump(
  'NYC / Manhattan / hell with them / midtown',
  (x) =>
    /new york|manhattan|midtown|nyc|aguirre|to hell/i.test(x.blob) ||
    (heroIn(x.heroes, ['Ramattra']) && /new york|midtown|battlefield/i.test(x.blob)),
);

dump(
  'Call Sign Sojourn / captain / Liao upgrade crisis',
  (x) =>
    /call.?sign|sojourn|toronto|csor|captain/i.test(x.blob) ||
    (heroIn(x.heroes, ['Sojourn']) &&
      /crisis|cyber|liao|command|upgrade|rocket|ask to change|extension/i.test(x.blob)),
);

dump(
  'Launching skies / mag-lev / satellite / ISRO / Sigma',
  (x) =>
    /mag.?lev|satellite|orbital|launch|isro|roshani/i.test(x.blob) ||
    (heroIn(x.heroes, ['Sigma']) && /invention|mag|space|orbit/i.test(x.blob)),
);

dump(
  'Fiery Pride / Wuxing / Fire College / Anran / Wuyang',
  (x) =>
    /wuxing|fire college|metal college|fiery|chengdu|martial/i.test(x.blob) ||
    (heroIn(x.heroes, ['Wuyang', 'Anran']) &&
      /college|university|fire|crisis|father|mother|pride|wuxing/i.test(x.blob)),
);

dump(
  'Refugees / farm / Cassidy crisis / megafarm',
  (x) =>
    /refugee|megafarm|farm|cheap labor|displac/i.test(x.blob) ||
    (heroIn(x.heroes, ['Cassidy', 'Ashe']) && /farm|ranch|crisis|grow.?up|kid|orphan/i.test(x.blob)),
);
