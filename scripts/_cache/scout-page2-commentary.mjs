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
    tags: (c.tags || []).join(','),
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

function search(label, pred, limit = 12) {
  const hits = all.filter(pred).slice(0, limit);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 240).replace(/\s+/g, ' ')}`);
  }
}

search(
  'Sojourn cybernetics/childhood/augments/rocket',
  (x) =>
    heroIn(x.heroes, ['Sojourn']) &&
    has(x.blob, [
      'cyber',
      'augment',
      'rocket',
      'child',
      'young',
      'body',
      'hospital',
      'leg',
      'change',
      'modification',
      'esat',
      'toronto',
    ]),
);

search(
  'Roadhog australia/outback/farm/quiet',
  (x) =>
    heroIn(x.heroes, ['Roadhog']) &&
    has(x.blob, ['australia', 'outback', 'farm', 'quiet', 'country', 'junker', 'mako', 'home']),
);

search(
  'Moira genetics/bugs/science/dublin',
  (x) =>
    heroIn(x.heroes, ['Moira']) &&
    has(x.blob, ['genetic', 'bug', 'insect', 'science', 'research', 'dublin', 'university', 'evolution', 'dna']),
);

search(
  'Illari solar/inti/runasapi/sun',
  (x) =>
    heroIn(x.heroes, ['Illari']) &&
    has(x.blob, ['solar', 'sun', 'inti', 'runasapi', 'peru', 'thread', 'warrior', 'ancestor', 'city']),
);

search(
  'Doomfist family/martial/nigeria/ogundimu',
  (x) =>
    heroIn(x.heroes, ['Doomfist']) &&
    has(x.blob, ['family', 'martial', 'nigeria', 'ogundimu', 'company', 'synergies', 'fighter', 'heir', 'legacy']),
);

search(
  'Wuxing / Lucheng / Water College / Horizon',
  (x) =>
    has(x.blob, ['wuxing', 'lucheng', 'water college', 'horizon', 'lunar', 'juno', 'mars colony']),
);

search(
  'Ecopoint / coral / ocean / wall / climate',
  (x) =>
    has(x.blob, [
      'ecopoint',
      'coral',
      'supercoral',
      'sea wall',
      'rising tide',
      'ocean',
      'reef',
      'polynesia',
      'durovidro',
    ]),
);

search(
  'cybernetic Sojourn/Echo/Genji (Medical Miracles-adjacent)',
  (x) =>
    has(x.blob, ['cybernetic', 'augment', 'rocket legs', 'extension of myself', 'ask to change', 'costly']),
);

search(
  'nuclear / fusion / reactor / industry',
  (x) => has(x.blob, ['nuclear', 'fusion', 'reactor', 'omnium', 'omnica factory']),
);

search(
  'Mei / Winston ecopoint climate',
  (x) =>
    (heroIn(x.heroes, ['Mei', 'Winston', 'Lifeweaver']) &&
      has(x.blob, ['ecopoint', 'climate', 'research', 'antarctica', 'station', 'environment'])) ||
    /ecopoint/i.test(x.name),
);
