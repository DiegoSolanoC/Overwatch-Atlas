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

function search(label, pred, limit = 15) {
  const hits = all.filter(pred).slice(0, limit);
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits) {
    console.log(`- ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 260).replace(/\s+/g, ' ')}`);
  }
}

search(
  'Sigma origin/astronomy/before',
  (x) =>
    heroIn(x.heroes, ['Sigma']) &&
    has(x.blob, [
      'child',
      'born',
      'young',
      'astronom',
      'hubris',
      'netherlands',
      'before',
      'professor',
      'university',
      'gravity',
      'black hole',
      'seminar',
      'years ago',
      'siebren',
    ]),
);

search(
  'Reinhardt knight/child/germany',
  (x) =>
    heroIn(x.heroes, ['Reinhardt']) &&
    has(x.blob, ['child', 'young', 'knight', 'crusader', 'germany', 'dream', 'army', 'honor', 'grew']),
);

search(
  'Ana egypt/young/marksman',
  (x) =>
    heroIn(x.heroes, ['Ana']) &&
    has(x.blob, [
      'child',
      'young',
      'egypt',
      'cairo',
      'rifle',
      'marksm',
      'el-sa',
      'fareeha',
      'daughter',
      'army',
    ]),
);

search(
  'Reaper LA/police/family',
  (x) =>
    heroIn(x.heroes, ['Reaper']) &&
    has(x.blob, ['los angeles', 'lapd', 'police', 'crimin', 'family', 'young', 'before', 'sepultura']),
);

search(
  'Torb engineer/sweden/invent',
  (x) =>
    heroIn(x.heroes, ['Torbjörn', 'Torbjorn']) &&
    has(x.blob, ['child', 'young', 'engineer', 'sweden', 'invent', 'build', 'university', 'bright', 'lindholm']),
);

search(
  'Soldier farm/army/football',
  (x) =>
    heroIn(x.heroes, ['Soldier 76']) &&
    has(x.blob, ['farm', 'indiana', 'football', 'enlist', 'army', 'young', 'before', 'bloomington', 'athlete']),
);

search(
  'cybernetics/prosthetic/omnica',
  (x) =>
    has(x.blob, [
      'cybernetic',
      'prosthetic',
      'mechanical',
      'omnica',
      'ogundimu',
      'artificial',
      'augment',
      'limb',
      'genji',
    ]) &&
    has(x.blob, ['cyber', 'prosthetic', 'omnica', 'ogundimu', 'augment', 'limb', 'arm', 'leg']),
);

search(
  'water/ocean/climate/ecopoint/hawaii',
  (x) =>
    has(x.blob, [
      'purif',
      'filtration',
      'drought',
      'potable',
      'ocean',
      'pollution',
      'ecopoint',
      'polynesian',
      'hawaii',
      'algae',
      'climate change',
      'clean water',
      'water scarcity',
    ]),
);

search(
  'Doomfist company/family/cyber',
  (x) =>
    heroIn(x.heroes, ['Doomfist']) &&
    has(x.blob, ['company', 'synergies', 'cyber', 'prosthetic', 'family business', 'ogundimu', 'legacy']),
);

search(
  'Birds and Music / Before Crisis',
  (x) =>
    /birds and music|before the crisis/i.test(x.name) ||
    (heroIn(x.heroes, ['Mercy', 'Sigma']) && has(x.blob, ['seminar', 'siebren', 'years ago'])),
);

search(
  'Lucheng / Horizon / Water College',
  (x) => has(x.blob, ['lucheng', 'horizon', 'water college', 'juno', 'lunar colony', 'mars']),
);

search(
  'Ecopoint / Winston / Mei eco',
  (x) => has(x.blob, ['ecopoint', 'antarctica', 'climate', 'research station', 'mei']),
);
