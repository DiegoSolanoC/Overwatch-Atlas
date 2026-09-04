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
  return { name: c.name, entryType: c.entryType || 'dialogue', heroes, subs, blob, status: c.status };
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
    console.log(`  ${h.subs.slice(0, 250).replace(/\s+/g, ' ')}`);
  }
}

search(
  'Ingrid / Lindholm wife / family / textile',
  (x) =>
    has(x.blob, ['ingrid', 'wife', 'married', 'brigitte', 'lindholm']) &&
    heroIn(x.heroes, ['Torbjörn', 'Torbjorn', 'Brigitte', 'Reinhardt']),
);

search(
  'Sigma gravity / mag-lev / holocar / flying',
  (x) =>
    heroIn(x.heroes, ['Sigma']) &&
    has(x.blob, ['gravity', 'mag', 'lev', 'cape', 'holo', 'fly', 'float', 'attract', 'black hole']),
);

search(
  'God Program / Anubis / AI control / automation',
  (x) =>
    has(x.blob, [
      'god program',
      'anubis',
      'chernobog',
      'xibalba',
      'xibalbá',
      'macaria',
      'god ai',
      'artificial intelligence',
    ]),
);

search(
  'Torb vs AI / Bastion autonomy / destroyer',
  (x) =>
    (heroIn(x.heroes, ['Torbjörn', 'Torbjorn', 'Bastion']) &&
      has(x.blob, ['ai', 'automat', 'bastion', 'machine', 'control', 'weapon', 'build', 'omnic'])) ||
    has(x.blob, ['siege automaton', 'e54', 'destroyer of worlds']),
);

search(
  'Vincent / Jack dating / painful memories',
  (x) =>
    has(x.blob, ['vincent']) ||
    (heroIn(x.heroes, ['Soldier 76']) &&
      has(x.blob, ['love', 'heart', 'date', 'boyfriend', 'partner', 'someone once', 'painful'])),
);

search(
  'Bastion on our side / Grave Wounds / siege',
  (x) =>
    has(x.blob, ['bastion', 'siege', 'e54', 'automaton']) ||
    /bastion/i.test(x.name),
);
