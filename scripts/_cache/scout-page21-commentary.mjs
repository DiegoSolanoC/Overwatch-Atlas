/**
 * Page 21 commentary scout — dialogues (incl. Classic removed) + active chatter.
 */
import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
  isDialogueEligibleForCommentary,
  mapLabelFromChatterDisclaimer,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const used = new Map(Object.entries(usedRaw));
const allConvs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

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

for (const c of allConvs) {
  if (isChatterEntry(c)) {
    if (String(c.status || 'active') === 'removed') continue;
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
  if (!isDialogueEligibleForCommentary(c)) continue;
  let lines = (c.lines || []).slice();
  for (const p of c.paths || []) {
    if (Array.isArray(p.lines)) lines = lines.concat(p.lines);
  }
  const heroes = [...new Set(lines.map((l) => l.hero).filter(Boolean))];
  const subs = lines.map((l) => `${l.hero}: ${strip(l.subtitles)}`).join(' | ');
  const classic = String(c.status || '') === 'removed';
  dialogues.push({
    name: c.name,
    heroes,
    classic,
    blob: `${c.name} ${subs} ${(c.tags || []).join(' ')}`.toLowerCase(),
    preview: subs.slice(0, 240).replace(/\s+/g, ' '),
  });
}

function dumpDialogues(label, pred, limit = 14) {
  const hits = dialogues.filter(pred);
  console.log(`\n---- DIALOGUES: ${label} (${hits.length}) ----`);
  for (const h of hits.slice(0, limit)) {
    const tag = h.classic ? ' [OW1]' : '';
    console.log(`[${st(h.name).padEnd(6)}]${tag} ${h.name}  [${h.heroes.join(', ')}]`);
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

const jobs = [
  [
    '#201 Intrepid Adventurers — HAS commentary — Venture / Wayfinder / archaeology',
    () => {
      dumpDialogues(
        'Venture / Wayfinder / archaeology / dig / artifact',
        (d) =>
          d.heroes.includes('Venture')
          || /venture|wayfinder|archaeolog|artifact|dig|ruin|history/i.test(d.blob),
        14,
      );
      dumpChatters(
        'Venture / Wayfinder / dig',
        (c) => /^Venture$/i.test(c.hero) || /wayfinder|archaeolog|artifact|dig/i.test(c.blob),
        14,
      );
    },
  ],
  [
    '#202 Lunar Revolt — Winston / Hammond / Horizon uprising / Harold / apes',
    () => {
      dumpDialogues(
        'Winston / Wrecking Ball / Horizon / revolt / Harold',
        (d) =>
          d.heroes.includes('Winston')
          || d.heroes.includes('Wrecking Ball')
          || /horizon|harold|revolt|uprising|lunar|hammond|ape|gorilla/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Winston / Wrecking Ball / Horizon Lunar Colony',
        (c) =>
          (/^Winston$/i.test(c.hero) || /^Wrecking Ball$/i.test(c.hero))
          && /horizon|lunar|home|earth|escape|harold/i.test(c.blob),
        16,
      );
    },
  ],
  [
    '#203 Leverage — Mizuki / Shion / Toshiro / Hashimoto / training / anima',
    () => {
      dumpDialogues(
        'Mizuki / Shion / Toshiro / Hashimoto / leverage',
        (d) =>
          d.heroes.some((h) => /^Mizuki$/i.test(h) || /^Shion$/i.test(h))
          || /toshiro|hashimoto|mizuki|shion|leverage|curse|forge/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Mizuki / Shion / Toshiro / Hashimoto',
        (c) =>
          /^Mizuki$/i.test(c.hero)
          || /^Shion$/i.test(c.hero)
          || /toshiro|hashimoto|forge|curse/i.test(c.blob),
        14,
      );
    },
  ],
  [
    '#204 Escape Pod — Winston escape / Overwatch recruit / Gibraltar / Hammond separates',
    () => {
      dumpDialogues(
        'Winston / Overwatch join / escape / rocket / personhood',
        (d) =>
          d.heroes.includes('Winston')
          || /escape|rocket|pod|gibraltar|personhood|hammond|join.*overwatch/i.test(d.blob),
        14,
      );
      dumpChatters(
        'Winston / Gibraltar / Horizon escape',
        (c) =>
          /^Winston$/i.test(c.hero)
          || /gibraltar|horizon|escape|rocket|overwatch adventures/i.test(c.blob),
        14,
      );
    },
  ],
  [
    '#205 Shrine Maiden — Kiriko / Fox Spirit / grandma / Miko / Kanezaka',
    () => {
      dumpDialogues(
        'Kiriko / Fox / Miko / grandma / Kanezaka',
        (d) =>
          d.heroes.includes('Kiriko')
          || /fox|miko|shrine|grandma|kiriko|ofuda|yamagami/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Kiriko / Hanamura / Hanaoka / Fox / grandma',
        (c) =>
          /^Kiriko$/i.test(c.hero)
          || /fox|grandma|miko|shrine|kanezaka|hanaoka/i.test(c.blob),
        16,
      );
    },
  ],
  [
    '#206 Chronal Accelerator — Tracer / Winston / chronal / blink / call sign',
    () => {
      dumpDialogues(
        'Tracer / Winston / chronal / accelerator / blink',
        (d) =>
          (d.heroes.includes('Tracer') && d.heroes.includes('Winston'))
          || /chronal|accelerator|slipstream|blink|tracer|lena/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Tracer / chronal / Winston / Gibraltar',
        (c) =>
          /^Tracer$/i.test(c.hero)
          || /chronal|accelerator|blink|tracer/i.test(c.blob),
        14,
      );
    },
  ],
  [
    '#207 Champion — Wrecking Ball / Scrapyard / Junker Queen / Junkertown',
    () => {
      dumpDialogues(
        'Wrecking Ball / Junker Queen / Scrapyard / champion',
        (d) =>
          d.heroes.includes('Wrecking Ball')
          || d.heroes.includes('Junker Queen')
          || /scrapyard|champion|wrecking ball|junkertown|hamster/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Wrecking Ball / Junkertown / Scrapyard / Champ',
        (c) =>
          /^Wrecking Ball$/i.test(c.hero)
          || /scrapyard|champ|wrecking ball|junkertown.*hamster|hamster.*junker/i.test(c.blob)
          || (/^Junker Queen$/i.test(c.hero) && /champ|scrapyard|wrecking|hamster/i.test(c.blob)),
        16,
      );
    },
  ],
  [
    '#208 The Oslo Attack — Liao death / Echo / Cassidy / Mondatta / Talon',
    () => {
      dumpDialogues(
        'Echo / Cassidy / Liao / Mondatta / Oslo',
        (d) =>
          (d.heroes.includes('Echo') && d.heroes.includes('Cassidy'))
          || /liao|oslo|mondatta|echo.*death|funeral|mina/i.test(d.blob),
        16,
      );
      dumpChatters(
        'Echo / Cassidy / Liao / Oslo',
        (c) =>
          /liao|oslo|mondatta/i.test(c.blob)
          || (/^Echo$/i.test(c.hero) && /liao|doctor|creator/i.test(c.blob))
          || (/^Cassidy$/i.test(c.hero) && /liao|echo|reyes|forgive/i.test(c.blob)),
        14,
      );
    },
  ],
  [
    '#209 Retribution — Rome / Antonio / Gérard / Blackwatch / Reyes',
    () => {
      dumpDialogues(
        'Reaper / Cassidy / Antonio / Rome / Gérard / retribution',
        (d) =>
          /retribution|antonio|rome|gérard|gerard|rialto|blackwatch|reyes/i.test(d.blob)
          || (d.heroes.includes('Reaper') && d.heroes.includes('Cassidy')),
        16,
      );
      dumpChatters(
        'Reaper / Cassidy / Rialto / Rome / Blackwatch',
        (c) =>
          /rialto|rome|antonio|blackwatch|retribution|gérard|gerard/i.test(c.blob)
          || (/^Reaper$/i.test(c.hero) && /talon|revenge|retribution/i.test(c.blob)),
        14,
      );
    },
  ],
  [
    '#210 The Venice Incident — Rialto / Antonio kill / Blackwatch expose',
    () => {
      dumpDialogues(
        'Venice / Rialto / Antonio / Blackwatch / Genji Moira Cassidy Reaper',
        (d) =>
          /venice|rialto|antonio|blackwatch|bartalotti|déjà|deja vu/i.test(d.blob)
          || (d.heroes.includes('Reaper')
            && d.heroes.includes('Moira')
            && d.heroes.includes('Cassidy')),
        16,
      );
      dumpChatters(
        'Rialto / Venice / Blackwatch / Antonio',
        (c) => /rialto|venice|antonio|blackwatch|bartalotti/i.test(c.blob),
        16,
      );
    },
  ],
];

for (const [title, fn] of jobs) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  fn();
}
