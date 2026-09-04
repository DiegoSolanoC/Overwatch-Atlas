import fs from 'fs';

const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

function expand(c) {
  let lines = (c.lines || []).slice();
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = [...new Set(lines.map((l) => l.hero).filter(Boolean))];
  const subs = lines.map((l) => `${l.hero || ''}: ${l.subtitles || ''}`).join(' | ');
  const blob = `${c.name} ${subs}`.toLowerCase();
  return {
    name: c.name,
    entryType: c.entryType || 'dialogue',
    heroes,
    subs,
    blob,
    status: c.status,
  };
}

const all = convs
  .map(expand)
  .filter((x) => x.entryType !== 'chatter' && x.status !== 'removed');

const has = (blob, arr) => arr.some((k) => blob.includes(k));
const heroIn = (heroes, names) =>
  names.some((n) => heroes.some((h) => h.toLowerCase() === n.toLowerCase()));

function search(label, pred, limit = 14) {
  const hits = all.filter(pred).slice(0, limit);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 250).replace(/\s+/g, ' ')}`);
  }
}

search(
  'Hardlight / Vishkar / Symmetra / Domina / Lucio',
  (x) =>
    has(x.blob, [
      'hard light',
      'hardlight',
      'vishkar',
      'photon',
      'architect',
      'favela',
      'bengaluru',
      'bhatt',
    ]) ||
    (heroIn(x.heroes, ['Symmetra', 'Domina', 'Lúcio', 'Lucio']) &&
      has(x.blob, ['vishkar', 'hard', 'company', 'order', 'chaos', 'rebuild', 'rio'])),
);

search(
  'Omnic / Omnica / Bastion / Zenyatta / Echo / Orisa',
  (x) =>
    has(x.blob, ['omnica', 'omnium', 'first omnic', 'created', 'manufactur']) ||
    (heroIn(x.heroes, ['Bastion', 'Zenyatta', 'Ramattra', 'Orisa', 'Echo']) &&
      has(x.blob, ['omnica', 'omnium', 'factory', 'built', 'human', 'created', 'purpose'])),
);

search(
  'B.O.B. / Ashe butler / Arbalest',
  (x) =>
    has(x.blob, ['b.o.b', 'bob', 'butler', 'arbalest', 'lead rose', 'manor']) ||
    (heroIn(x.heroes, ['Ashe']) && has(x.blob, ['b.o.b', 'bob', 'bodyguard', 'butler'])),
);

search(
  'Shimada / Hanamura / clan / Sojiro',
  (x) =>
    has(x.blob, ['shimada', 'hanamura', 'sojiro', 'clan', 'dragon']) ||
    (heroIn(x.heroes, ['Hanzo', 'Genji']) && has(x.blob, ['father', 'clan', 'brother', 'heir', 'family'])),
);

search(
  'GMO / farm / hunger / megafarm / Cassidy farm',
  (x) =>
    has(x.blob, ['gmo', 'megafarm', 'farm', 'hunger', 'crop', 'seed', 'agriculture']) ||
    (heroIn(x.heroes, ['Cassidy', 'Mei', 'Lifeweaver']) &&
      has(x.blob, ['farm', 'food', 'hunger', 'crop', 'plant', 'grow'])),
);

search(
  'Volskaya / Russia / Alisa / Katya / Zarya',
  (x) =>
    has(x.blob, ['volskaya', 'alisa', 'katya', 'rdf', 'russian defense']) ||
    (heroIn(x.heroes, ['Zarya', 'Katya']) && has(x.blob, ['volskaya', 'russia', 'factory', 'mech'])),
);

search(
  'War distaste Mercy / Peace',
  (x) =>
    heroIn(x.heroes, ['Mercy']) &&
    has(x.blob, ['war', 'peace', 'violence', 'hippocratic', 'kill', 'weapon']),
);

search(
  'Making a Difference / environment Mei',
  (x) =>
    /making a difference|environment|climate|preserve/i.test(x.name + x.subs) &&
    heroIn(x.heroes, ['Mei', 'Symmetra', 'Lifeweaver', 'Winston']),
);
