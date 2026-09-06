/**
 * Page 20 commentary scout — dialogues + active chatter.
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

function dumpDialogues(label, pred, limit = 14) {
  const hits = dialogues.filter(pred);
  console.log(`\n---- DIALOGUES: ${label} (${hits.length}) ----`);
  for (const h of hits.slice(0, limit)) {
    console.log(`[${st(h.name).padEnd(6)}] ${h.name}  [${h.heroes.join(', ')}]`);
    console.log(`         ${h.preview}`);
  }
}

function dumpChatters(label, pred, limit = 14) {
  const hits = chatters.filter(pred).sort((a, b) => a.label.localeCompare(b.label));
  console.log(`\n---- CHATTERS: ${label} (${hits.length}) ----`);
  for (const h of hits.slice(0, limit)) {
    const tag = h.era === 'Classic' ? ' [OW1]' : '';
    console.log(`[${st(h.label).padEnd(6)}]${tag} ${h.label}`);
  }
}

console.log(`Dialogues: ${dialogues.length} | Chatters: ${chatters.length}`);

const sections = [
  [
    '#191 Shimada Takedown — Genji / Hanzo / Blackwatch / Cassidy / Hanamura',
    () => {
      dumpDialogues(
        'Genji / Hanzo / Shimada / Blackwatch / Cassidy',
        (d) =>
          (d.heroes.includes('Genji') && (d.heroes.includes('Hanzo') || d.heroes.includes('Cassidy') || d.heroes.includes('Reaper')))
          || /shimada|blackwatch|hanamura|honor|vagabond|father.?s bow/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Genji / Hanzo / Hanamura / Shimada',
        (c) =>
          (/^Genji$/i.test(c.hero) || /^Hanzo$/i.test(c.hero))
          && /hanamura|hanaoka|shimada|honor|brother|home|clan/i.test(c.blob),
        16,
      );
    },
  ],
  [
    '#192 Blacklisted — Moira / Dublin / genetic / Mercy / Reyes / Blackwatch',
    () => {
      dumpDialogues(
        'Moira / Mercy / genetics / Blackwatch / Dublin',
        (d) =>
          d.heroes.includes('Moira')
          || /moira|o.?deorain|genetic|blacklist|dublin|ethics|cellular/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Moira / Oasis / Dublin / genetics',
        (c) => /^Moira$/i.test(c.hero) || /genetic|dublin|oasis|blacklist|ethics/i.test(c.blob),
        14,
      );
    },
  ],
  [
    '#193 Cold Snap — Mei / Antarctica / Ecopoint / cryo / blizzard',
    () => {
      dumpDialogues(
        'Mei / Antarctica / cryo / storm / Ecopoint',
        (d) =>
          d.heroes.includes('Mei')
          || /antarctica|ecopoint|cryo|blizzard|cold snap|mei|snowball|frozen/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Mei / Antarctic Peninsula / Ecopoint / ice',
        (c) =>
          /^Mei$/i.test(c.hero)
          || /antarctic|ecopoint|blizzard|cryo|frozen|iceberg/i.test(c.blob),
        16,
      );
    },
  ],
  [
    '#194 Uneasy Alliance — Maximillien / Doomfist / Monaco / Talon / Coterie',
    () => {
      dumpDialogues(
        'Maximillien / Doomfist / Monaco / casino / Talon',
        (d) =>
          /maxim|monaco|coterie|casino|doomfist.*talon|talon.*doomfist|outside hire|where max/i.test(d.blob)
          || (d.heroes.includes('Doomfist') && /money|deal|talon|max/i.test(d.blob)),
        14,
      );
      dumpChatters(
        'Maximillien / Circuit Royal / Monaco / Doomfist',
        (c) => /maxim|monaco|circuit royal|coterie|casino/i.test(c.blob) || /^Doomfist$/i.test(c.hero),
        14,
      );
    },
  ],
  [
    '#195 Bodily Entropy — Moira / Reyes / Blackwatch / SEP / regeneration',
    () => {
      dumpDialogues(
        'Moira / Reaper / Reyes / regenerate / SEP / experiment',
        (d) =>
          (d.heroes.includes('Moira') && (d.heroes.includes('Reaper') || d.heroes.includes('Soldier 76')))
          || /reaper|reyes|regenerat|entropy|wraith|sep|experiment.*moira|moira.*gabriel/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Moira / Reaper / Blackwatch / regenerate',
        (c) =>
          (/^Moira$/i.test(c.hero) || /^Reaper$/i.test(c.hero))
          && /blackwatch|talon|experiment|death|regenerat|wraith|fade/i.test(c.blob),
        14,
      );
    },
  ],
  [
    '#196 Hacking Spree — Sombra / Los Muertos / Dorado / Lumérico / Olivia',
    () => {
      dumpDialogues(
        'Sombra / Los Muertos / Dorado / Lumérico',
        (d) =>
          d.heroes.includes('Sombra')
          || /los muertos|dorado|lum[eé]rico|sombra|olivia|hack/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Sombra / Dorado / Los Muertos / Lumérico',
        (c) =>
          /^Sombra$/i.test(c.hero)
          || /dorado|los muertos|lum[eé]rico|hack/i.test(c.blob),
        16,
      );
    },
  ],
  [
    '#197 Biolight — Lifeweaver flees Vishkar / Arcology / Martins / Satya',
    () => {
      dumpDialogues(
        'Lifeweaver / Biolight / Vishkar / Arcology / Martins',
        (d) =>
          d.heroes.includes('Lifeweaver')
          || /biolight|vishkar|arcology|martins|leaving vishkar|cutting hands|returning to vishkar/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Lifeweaver / Arcology / Vishkar / Biolight',
        (c) =>
          /^Lifeweaver$/i.test(c.hero)
          || /biolight|arcology|martins|vishkar/i.test(c.blob),
        14,
      );
    },
  ],
  [
    '#198 Hostage — Kiriko / Hashimoto / Toshiro / Asa / Kanezaka / Yamagami',
    () => {
      dumpDialogues(
        'Kiriko / Hashimoto / Yamagami / Toshiro / Asa',
        (d) =>
          d.heroes.includes('Kiriko')
          || /hashimoto|yamagami|toshiro|asa|kiriko|kanezaka|hostage|fox/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Kiriko / Hashimoto / Kanezaka / Hanaoka',
        (c) =>
          /^Kiriko$/i.test(c.hero)
          || /hashimoto|kanezaka|toshiro|yamagami|asa|grandma|kamori/i.test(c.blob),
        16,
      );
    },
  ],
  [
    '#199 Deep Sea Raiders — Mauga / Samoa / coral / pirates / Polynesian',
    () => {
      dumpDialogues(
        'Mauga / Samoa / coral / pirate / raider',
        (d) =>
          d.heroes.includes('Mauga')
          || /samoa|mauga|coral|pirate|raider|polynesia|deep.?sea/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Mauga / Samoa / coral / pirate',
        (c) =>
          /^Mauga$/i.test(c.hero)
          || /samoa|coral|pirate|raider|polynesia|deep.?sea/i.test(c.blob),
        16,
      );
    },
  ],
  [
    '#200 White Canvas — Echo / Cassidy / Liao / Oslo / laugh / Project Echo',
    () => {
      dumpDialogues(
        'Echo / Cassidy / Liao / mistake / laugh',
        (d) =>
          (d.heroes.includes('Echo') && d.heroes.includes('Cassidy'))
          || /echo.*cassidy|cassidy.*echo|white canvas|liao|laugh|mistake/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Echo / Cassidy / Oslo / Liao',
        (c) =>
          (/^Echo$/i.test(c.hero) && /cassidy|liao|laugh|mistake|cowboy/i.test(c.blob))
          || (/^Cassidy$/i.test(c.hero) && /echo|liao|oslo|bot/i.test(c.blob))
          || /liao|project.?echo/i.test(c.blob),
        14,
      );
    },
  ],
];

for (const [title, fn] of sections) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  fn();
}
