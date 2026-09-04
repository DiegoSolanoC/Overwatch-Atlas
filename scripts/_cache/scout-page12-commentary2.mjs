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

function show(name) {
  const h = all.find((x) => x.name === name);
  if (!h) {
    console.log(`MISSING: ${name} | ${status(name)}`);
    return;
  }
  console.log(`${status(h.name).padEnd(50)} | ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 260).replace(/\s+/g, ' ')}`);
}

function dumpHero(label, heroNames, limit = 18) {
  const set = new Set(heroNames.map((n) => n.toLowerCase()));
  const hits = all.filter((x) => x.heroes.some((h) => set.has(h.toLowerCase())));
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${status(h.name)}]`);
    console.log(`  ${h.subs.slice(0, 220).replace(/\s+/g, ' ')}`);
  }
}

function dumpRe(label, re, limit = 14) {
  const hits = all.filter((x) => re.test(x.blob) || re.test(x.name));
  console.log(`\n==== ${label} (${hits.length}) ====`);
  for (const h of hits.slice(0, limit)) {
    console.log(`- ${h.name} [${status(h.name)}] [${h.heroes.join(', ')}]`);
    console.log(`  ${h.subs.slice(0, 220).replace(/\s+/g, ' ')}`);
  }
}

console.log('==== KEY CANDIDATES ====');
[
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
  'Not an Omnic',
  'Strenght through Suffering',
  'Real Glory',
  'Back Home',
  'Thanks to your Parents',
  'Twice as Many Lindholms',
  'Lidnholm Spark',
  'Hard Bargain',
  'Dorothy',
  'Family Issues',
  'What part of Canada',
  'Applying to Vishkar',
  'Freeing your Servant',
  "B.O.B.'s Fire power",
  'Not a Toy',
  'Carrying Artifacts',
  'Cute Guy',
  'Jealous of you',
  'Complicated',
  'More Wires than Skin',
  'Killed Many',
  'New Chassis',
  'Seen you before',
  'In a Dream',
  'Sorry for your Doctor',
  'Special Order',
  'Show some respect',
  'Hashimoto Bounties',
  'Open her eyes',
  'Sorry enough to Help',
  'Fight Smarter',
  'Hope for more',
].forEach(show);

dumpHero('#112 Shion dialogues', ['Shion']);
dumpRe('#111/#112 hate/hunt/ravager/coexist', /hate omnics|ravager|hunted|coexist|forgiv|crisis.*people|people.*crisis|not himself|rotten few|new chassis|changed much/i);
dumpRe('#113 anubis/jailer/temple/locked', /anubis|jailer|temple of|quarantine|locked up|destroy it/i);
dumpRe('#114 toronto/canada/sojourn omnic', /toronto|ontario|canada|omnic rights|rebuild/i);
dumpRe('#115 numbani/adawe/harmony/orisa', /numbani|adawe|harmony|coward run|looking sharp/i);
dumpRe('#116 bob/ashe servant', /\bb\.?o\.?b\b|bob\b|servant|lead rose/i);
dumpRe('#117 emre/blackwatch/reyes/commander', /emre|blackwatch|reyes|strike commander|morrison/i);
dumpRe('#118 arm/eye/torbjorn injury/prosthetic', /lost.*(arm|eye)|prosthetic|upgrade that arm|white dome|istanbul|turkey/i);
dumpRe('#120 junker/outback/omnium/australia', /junkertown|junker|outback|australia|omnium|alf |liberation/i);
