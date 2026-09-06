/**
 * Page 18 commentary scout — dialogues + active chatter (incl. OW1 Classic map).
 */
import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
  mapLabelFromChatterDisclaimer,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const used = new Map(Object.entries(usedRaw));
const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations.filter((c) => String(c.status || 'active') !== 'removed');

function st(name) {
  const k = String(name || '').toLowerCase();
  if (used.has(k)) return `USED → ${(used.get(k) || []).join('; ')}`;
  return 'free';
}

function strip(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const dialogues = [];
const chatters = [];
const labelCounts = new Map();

for (const c of convs) {
  if (isChatterEntry(c)) {
    for (const line of c.lines || []) {
      if (!isActiveChatterLineForCommentary(line)) continue;
      const hero = String(line.hero || c.name || '').trim();
      const base = buildChatterCommentaryLabel(hero, line.subtitles, line.disclaimer);
      if (!base) continue;
      const n = (labelCounts.get(base) || 0) + 1;
      labelCounts.set(base, n);
      const label = n === 1 ? base : `${base} (${n})`;
      const map = mapLabelFromChatterDisclaimer(line.disclaimer);
      chatters.push({
        label,
        hero,
        map,
        text: strip(line.subtitles),
        blob: `${hero} ${map} ${strip(line.subtitles)} ${line.disclaimer || ''}`.toLowerCase(),
        era: String(line.era || ''),
      });
    }
    continue;
  }
  let lines = (c.lines || []).slice();
  for (const p of c.paths || []) {
    if (Array.isArray(p.lines)) lines = lines.concat(p.lines);
  }
  const heroes = [...new Set(lines.map((l) => l.hero).filter(Boolean))];
  const subs = lines.map((l) => `${l.hero}: ${strip(l.subtitles)}`).join(' | ');
  dialogues.push({
    name: c.name,
    heroes,
    blob: `${c.name} ${subs} ${(c.tags || []).join(' ')}`.toLowerCase(),
    preview: subs.slice(0, 240).replace(/\s+/g, ' '),
  });
}

function dumpDialogues(label, pred, limit = 12) {
  const hits = dialogues.filter(pred);
  console.log(`\n---- DIALOGUES: ${label} (${hits.length}) ----`);
  for (const h of hits.slice(0, limit)) {
    console.log(`[${st(h.name).padEnd(6)}] ${h.name}  [${h.heroes.join(', ')}]`);
    console.log(`         ${h.preview}`);
  }
}

function dumpChatters(label, pred, limit = 12) {
  const hits = chatters.filter(pred).sort((a, b) => a.label.localeCompare(b.label));
  console.log(`\n---- CHATTERS: ${label} (${hits.length}) ----`);
  for (const h of hits.slice(0, limit)) {
    const tag = h.era === 'Classic' ? ' [OW1]' : '';
    console.log(`[${st(h.label).padEnd(6)}]${tag} ${h.label}`);
  }
}

console.log(`Dialogues: ${dialogues.length} | Chatters: ${chatters.length}`);

console.log('\n' + '='.repeat(72));
console.log('#171 Omnic Liberation — Ramattra / Null Sector / Mondatta / Zenyatta / Europe');
dumpDialogues(
  'Ramattra / Null Sector / Mondatta / liberation',
  (d) =>
    d.heroes.includes('Ramattra')
    || /null sector|mondatta|ramattra|liberation|zenyatta|underworld|king.?s row/i.test(d.blob),
  18,
);
dumpChatters(
  'Ramattra / Null Sector / London / King\'s Row',
  (c) =>
    /^Ramattra$/i.test(c.hero)
    || /null sector|mondatta|king.?s row|london|underworld|liberation/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#172 Deep Rising — HAS commentary (Doomfist Busan Gwishin) — alts?');
dumpDialogues(
  'Gwishin / Busan / MEKA / Colossus / Anubis',
  (d) => /gwishin|busan|meka|colossus|anubis|d\.?va|soundquake|fusionator/i.test(d.blob),
  14,
);
dumpChatters(
  'Busan / Gwishin / MEKA / D.Va',
  (c) =>
    /busan|gwishin|meka|colossus|anubis/i.test(c.blob)
    || (/^D\.?Va$/i.test(c.hero) && /busan|korea|home/i.test(c.blob)),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#173 Harnessing the Harness — Sigma / De Kuiper / black hole / gravity / space');
dumpDialogues(
  'Sigma / gravity / black hole / melody / De Kuiper',
  (d) =>
    d.heroes.includes('Sigma')
    || /sigma|black hole|gravity|de kuiper|siebren|melody|harness/i.test(d.blob),
  16,
);
dumpChatters(
  'Sigma / gravity / black hole / space',
  (c) =>
    /^Sigma$/i.test(c.hero)
    || /black hole|gravity|sigma|siebren|de kuiper|melody|universe/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#174 Omnic Housing — Mondatta / King\'s Row / Turing Green / Underworld / London');
dumpDialogues(
  'Mondatta / King\'s Row / Underworld / London omnics',
  (d) =>
    /mondatta|king.?s row|underworld|turing|london|housing|segregation/i.test(d.blob)
    || (d.heroes.includes('Zenyatta') && /london|king|mondatta/i.test(d.blob)),
  16,
);
dumpChatters(
  'King\'s Row / London / Mondatta / Underworld',
  (c) => /king.?s row|london|mondatta|underworld|turing|omnic.*home|housing/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#175 Luxuries — Shion / Akihabara / Hashimoto / omnic culture / prisoner');
dumpDialogues(
  'Shion / Akihabara / Hashimoto / luxury',
  (d) =>
    d.heroes.some((h) => /^Shion$/i.test(h))
    || /akihabara|hashimoto|shion|luxury|fashion|captive|prisoner/i.test(d.blob),
  16,
);
dumpChatters(
  'Shion / Akihabara / Hanaoka / Kanezaka',
  (c) =>
    /^Shion$/i.test(c.hero)
    || /akihabara|hashimoto|hanaoka|kanezaka|shion/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#176 Subject Sigma — Sigma containment / New Mexico / melody / quarantine');
dumpDialogues(
  'Sigma / Subject / containment / quarantine / asylum',
  (d) =>
    d.heroes.includes('Sigma')
    || /subject.?sigma|contain|quarantine|asylum|talón|talon.*sigma|new mexico/i.test(d.blob),
  16,
);
dumpChatters(
  'Sigma / Subject / Talon / New Mexico',
  (c) =>
    /^Sigma$/i.test(c.hero)
    || /subject|contain|quarantine|asylum|talon|new mexico|melody|gravity/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#177 Storm Chaser — Freja / Copenhagen / search and rescue / criminology');
dumpDialogues(
  'Freja / Copenhagen / Denmark / tracker / rescue',
  (d) =>
    d.heroes.includes('Freja')
    || /freja|copenhagen|denmark|storm|tracker|search and rescue|bounty/i.test(d.blob),
  16,
);
dumpChatters(
  'Freja / Copenhagen / Denmark',
  (c) =>
    /^Freja$/i.test(c.hero)
    || /copenhagen|denmark|freja|storm chaser/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#178 Pressure Makes a Diamond — Domina / Vishkar / hard light / arms / Utopaea');
dumpDialogues(
  'Domina / Vishkar / hard light / Utopaea',
  (d) =>
    d.heroes.includes('Domina')
    || /domina|vishkar|hard light|utopaea|utopia|singhania|architect/i.test(d.blob),
  16,
);
dumpChatters(
  'Domina / Vishkar / Utopaea / hard light',
  (c) =>
    /^Domina$/i.test(c.hero)
    || /vishkar|utopaea|utopia|hard light|singhania|architect/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#179 Counter Measures — Numbani / OR15 / Adeyemi / Akande / Doomfist recruit');
dumpDialogues(
  'Numbani / Doomfist / Adeyemi / Orisa / OR15',
  (d) =>
    /numbani|adeyemi|orisa|or-?15|or-?14|doomfist|akande|ogundimu|gauntlet/i.test(d.blob)
    || d.heroes.includes('Orisa')
    || d.heroes.includes('Doomfist'),
  16,
);
dumpChatters(
  'Numbani / Orisa / Doomfist / Adeyemi',
  (c) =>
    /numbani|adeyemi|orisa|or-?15|doomfist|akande/i.test(c.blob)
    || /^Orisa$/i.test(c.hero)
    || /^Doomfist$/i.test(c.hero),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#180 Taking the Throne — Junker Queen / Reckoning / Mason / Scrapyard / crown');
dumpDialogues(
  'Junker Queen / Reckoning / Mason / crown / Scrapyard',
  (d) =>
    d.heroes.includes('Junker Queen')
    || /reckoning|mason|scrapyard|junker queen|throne|crown|wasteland/i.test(d.blob),
  16,
);
dumpChatters(
  'Junker Queen / Junkertown / Reckoning / Scrapyard',
  (c) =>
    /^Junker Queen$/i.test(c.hero)
    || /junkertown|reckoning|scrapyard|mason|queen|crown|wasteland/i.test(c.blob),
  18,
);
