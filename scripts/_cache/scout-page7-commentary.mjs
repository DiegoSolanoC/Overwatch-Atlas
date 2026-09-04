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
    console.log(`  ${h.subs.slice(0, 270).replace(/\s+/g, ' ')}`);
  }
}

dump(
  'Crusader / knight / Reinhardt armor / hardlight barrier',
  (x) =>
    /crusader|balderich|knight|honor and glory|shield|hard.?light|parade/i.test(x.blob) ||
    (heroIn(x.heroes, ['Reinhardt', 'Brigitte']) &&
      /armor|shield|knight|crusader|glory|honor|defend/i.test(x.blob)),
);

dump(
  'SEP / Soldier Enhancement / Naughton / gene therapy',
  (x) =>
    /enhancement|sep|naughton|gene therap|super.?soldier|experiment|camp hale/i.test(x.blob) ||
    (heroIn(x.heroes, ['Soldier 76', 'Reaper']) &&
      /enhanc|experiment|program|soldier|strength|inject|serum/i.test(x.blob)),
);

dump(
  'Aurora Shambali / Answers / pilgrimage / meditation',
  (x) =>
    /shambali|aurora|pilgrim|meditat|monastery|iris|existential|answers/i.test(x.blob) ||
    (heroIn(x.heroes, ['Zenyatta', 'Ramattra', 'Echo', 'Venture']) &&
      /aurora|shambali|monastery|iris/i.test(x.blob)),
);

dump(
  'Shion made / Anubis weapon / form / awakening',
  (x) =>
    heroIn(x.heroes, ['Shion']) &&
    /anubis|made|creat|weapon|war|awakening|form|design|human|omnic|crisis/i.test(x.blob),
);

dump(
  'Ramattra made / Ravager / R-7000 / Anubis image',
  (x) =>
    /ravager|r-7000|squad killer|anubis|command/i.test(x.blob) ||
    (heroIn(x.heroes, ['Ramattra']) &&
      /made|creat|war|anubis|crisis|ravager|midtown|new york|purpose|built/i.test(x.blob)),
);
