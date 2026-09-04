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

function dump(label, pred, limit = 14) {
  const hits = all.filter(pred);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 260).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'Sojourn cybernetics / upgrades / military / esat',
  (x) =>
    (heroIn(x.heroes, ['Sojourn']) &&
      /cyber|prosthet|upgrade|enhanc|metal|machine|soldier|military|esat|discrimin|advantage/i.test(
        x.blob,
      )) ||
    /cybernetic|prosthetic|esat/i.test(x.blob),
);

dump(
  'Lucheng / Horizon / moon / lunar / space',
  (x) =>
    /lucheng|horizon|lunar colon|on the moon|space colon|astronaut|mars|hydropon/i.test(x.blob) ||
    (heroIn(x.heroes, ['Winston', 'Juno', 'Echo']) &&
      /moon|space|colony|orbit|gravity|star/i.test(x.blob)),
);

dump(
  'Zenyatta made / awakening / omnic past / factory',
  (x) =>
    heroIn(x.heroes, ['Zenyatta']) &&
    /made|creat|factory|awakening|before|iris|shambali|aurora|purpose|past/i.test(x.blob),
);

dump(
  'E54 / Bastion made / siege / killing machine',
  (x) =>
    /e54|siege automaton|killing machine|built you for|grave wound/i.test(x.blob) ||
    (heroIn(x.heroes, ['Bastion', 'Torbjörn']) && /bastion|automaton|relic/i.test(x.blob)),
);

dump(
  'Liao / Aurora / Genesis / Echo creation',
  (x) =>
    /liao|aurora|neuroplastic|omnica|created me|improve the world|echo project/i.test(x.blob) ||
    (heroIn(x.heroes, ['Echo']) && /creat|liao|design|made|mother|purpose/i.test(x.blob)),
);

dump(
  'Ask to Change / Extension / Costly Augments (Sojourn page2)',
  (x) =>
    /ask to change|extension of myself|costly augment|getting use|golden hair|data corruption/i.test(
      x.name + ' ' + x.blob,
    ) ||
    ['Ask to Change', 'Extension of myself', 'Costly Augments', 'Getting use to it'].includes(
      x.name,
    ),
);
