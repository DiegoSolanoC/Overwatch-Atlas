const fs = require('fs');
const path = require('path');

const eventsPath = path.join(__dirname, '..', 'src', 'data', 'events.json');
const data = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
const events = data.events || [];

const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const groups = [
  {
    yearStart: 2053,
    yearEnd: 2060,
    names: ['undercover', 'australian liberation', 'anima weaponry', 'miracle worker', 'rebuilding the past'],
  },
  {
    yearStart: 2056,
    yearEnd: 2060,
    names: [
      'vancouver floods',
      'building coalitions',
      'the architect academy',
      "liao's renaissance",
      'ecological initiative',
      'the scourge of numbani',
      'gwishin',
      'black ops',
    ],
  },
  {
    yearStart: 2060,
    yearEnd: 2068,
    names: [
      'growing with the clan',
      'pocket king',
      'the red promise',
      'deep rising',
      'harnessing the harness',
      'the atlantic arcology',
      'search and rescue',
      'biolight',
      'takeover',
      'pressure makes a diamond',
      'uneasy alliance',
      'blacklisted',
      'cold snap',
    ],
  },
];

const byNorm = new Map();
for (let i = 0; i < events.length; i++) {
  const key = normalize(events[i].name || '');
  if (!byNorm.has(key)) byNorm.set(key, []);
  byNorm.get(key).push(i);
}

const applied = [];
const unmatched = [];

for (const group of groups) {
  for (const rawName of group.names) {
    const key = normalize(rawName);
    const hits = byNorm.get(key) || [];
    if (!hits.length) {
      unmatched.push(rawName);
      continue;
    }
    for (const idx of hits) {
      events[idx].yearStart = group.yearStart;
      events[idx].yearEnd = group.yearEnd;
      applied.push(`${events[idx].name} => ${group.yearStart}-${group.yearEnd}`);
    }
  }
}

fs.writeFileSync(eventsPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log(`Applied ${applied.length} event updates.`);
for (const line of applied) console.log(line);
if (unmatched.length) {
  console.log('UNMATCHED:');
  for (const name of unmatched) console.log(name);
}
