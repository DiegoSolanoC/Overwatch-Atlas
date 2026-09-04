import fs from 'fs';

const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));

const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

function expand(c) {
  let lines = (c.lines || []).slice();
  for (const p of c.paths || []) if (p.lines) lines = lines.concat(p.lines);
  const heroes = [...new Set(lines.map((l) => l.hero).filter(Boolean))];
  const subs = lines.map((l) => `${l.hero || ''}: ${l.subtitles || ''}`).join(' | ');
  return { name: c.name, heroes, subs, status: c.status, entryType: c.entryType || 'dialogue' };
}

const all = convs
  .map(expand)
  .filter((x) => x.entryType !== 'chatter' && x.status !== 'removed');

function status(name) {
  const k = name.toLowerCase();
  if (usedRaw[k]) return `USED → ${usedRaw[k].join('; ')}`;
  return 'free';
}

const want = [
  // Illari / Children of the Sun
  'Expensive Upgrades',
  'Costly Augments',
  'Not Qualified',
  'Worth Conquering',
  'Keeping Tabs',
  'Dead man Walking',
  // Doomfist
  'Respect, Not Fear',
  'Past your Prime',
  'Automaton Was Taken',
  // Volskaya
  "Volskaya's Mechs",
  'Expectations',
  // Proposal / Overwatch founding - search by keyword dump
  // Heroic Five - thin
  // Ana
  'Best Sniper',
  'Your daugther',
  'Always Worry',
  'Like mother like daughter',
  // Defense Network
  'Digging up Old problems',
  'Firewall System',
  'Beautiful Inventions',
  'NO AI Mess',
  'Tin Cans',
  // Skycannon / NYC
  'Your Awakening',
  'A Ravager',
  // Building a Myth
  'Medieval History',
  'Sir Wilhelm',
  'Fantasy never hurt',
  'Real Glory',
  'Courage is Might',
  // Super Soldiers / SEP
  'Enhancement Program',
  'Enhanced Soldiers',
  'Naughton Vault',
  'Painful Memories',
];

console.log('=== CANDIDATE STATUS ===');
for (const name of want) {
  const h = all.find((x) => x.name === name);
  if (!h) {
    console.log(`MISSING theater name: ${name} | JSON status: ${status(name)}`);
    continue;
  }
  console.log(`${status(name).padEnd(42)} | ${h.name} [${h.heroes.join(', ')}]`);
  console.log(`  ${h.subs.slice(0, 220).replace(/\s+/g, ' ')}`);
}

// fuzzy: find Illari augment, Doomfist strength, SEP exact names
console.log('\n=== ILLARI AUGMENT-ISH ===');
for (const h of all.filter(
  (x) => x.heroes.includes('Illari') && /augment|cost|sun|inti|runasapi|warrior/i.test(x.subs + x.name),
)) {
  console.log(`${status(h.name)} | ${h.name}`);
  console.log(`  ${h.subs.slice(0, 200).replace(/\s+/g, ' ')}`);
}

console.log('\n=== DOOMFIST STRENGTH / TITLE ===');
for (const h of all.filter(
  (x) =>
    x.heroes.includes('Doomfist') &&
    /strength|struggle|gauntlet|power|heir|title|crisis|nigeria|strong/i.test(x.subs + x.name),
).slice(0, 15)) {
  console.log(`${status(h.name)} | ${h.name}`);
  console.log(`  ${h.subs.slice(0, 200).replace(/\s+/g, ' ')}`);
}

console.log('\n=== SEP / NAUGHTON EXACT ===');
for (const h of all.filter((x) => /enhancement|naughton|sep|super soldier/i.test(x.name + x.subs)).slice(0, 12)) {
  console.log(`${status(h.name)} | ${h.name}`);
  console.log(`  ${h.subs.slice(0, 200).replace(/\s+/g, ' ')}`);
}

console.log('\n=== VOLSKAYA MECH ===');
for (const h of all.filter((x) => /volskaya|svyatogor|mech/i.test(x.name + x.subs)).slice(0, 12)) {
  console.log(`${status(h.name)} | ${h.name}`);
  console.log(`  ${h.subs.slice(0, 200).replace(/\s+/g, ' ')}`);
}

console.log('\n=== OVERWATCH FOUNDING / ADAWE ===');
for (const h of all.filter((x) => /adawe|founding|strikeforce|strike team|formed overwatch|overwatch initiative/i.test(x.name + x.subs)).slice(0, 12)) {
  console.log(`${status(h.name)} | ${h.name}`);
  console.log(`  ${h.subs.slice(0, 200).replace(/\s+/g, ' ')}`);
}

console.log('\n=== ALL USED KEYS (for reference) ===');
console.log(Object.keys(usedRaw).sort().join('\n'));
