/**
 * Page 17 commentary scout — dialogues + active chatter (incl. OW1 Classic map).
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
console.log('#161 Survivor — Junker Queen / Outback / feral omnics / wasteland');
dumpDialogues(
  'Junker Queen / wasteland / outback / feral',
  (d) =>
    d.heroes.includes('Junker Queen')
    || /junker queen|wasteland|outback|feral|junkertown|scrap|omnium/i.test(d.blob),
  16,
);
dumpChatters(
  'Junker Queen / Junkertown / Australia / outback',
  (c) =>
    /^Junker Queen$/i.test(c.hero)
    || /junkertown|outback|australia|wasteland|feral|omnium/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#162 Risen in Blood — Shion / Hashimoto / elders / Akihabara');
dumpDialogues(
  'Shion / Hashimoto',
  (d) => d.heroes.some((h) => /^Shion$/i.test(h)) || /hashimoto|shion|elder/i.test(d.blob),
  18,
);
dumpChatters(
  'Shion / Hashimoto / Kanezaka / Hanaoka',
  (c) => /^Shion$/i.test(c.hero) || /hashimoto|shion|kanezaka|hanaoka|akihabara/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#164 Atlantic Arcology — Martins / Collective / whales / omnic haven');
dumpDialogues(
  'Martins / Arcology / whales / Collective',
  (d) => /martin|arcology|whale|collective|atlantic|hector|claudio/i.test(d.blob),
  16,
);
dumpChatters(
  'Martins / Arcology / whales',
  (c) => /martin|arcology|whale|atlantic|collective/i.test(c.blob),
  12,
);

console.log('\n' + '='.repeat(72));
console.log('#165 Pocket King — Maximillien / Monaco / casino / La Coterie');
dumpDialogues(
  'Maximillien / Monaco / casino / Coterie',
  (d) => /maximillien|monaco|monte.?carlo|casino|coterie|rumbotico|money|launder/i.test(d.blob),
  16,
);
dumpChatters(
  'Maximillien / Monaco / casino',
  (c) => /maximillien|monaco|monte.?carlo|casino|coterie|rumbotico/i.test(c.blob),
  12,
);

console.log('\n' + '='.repeat(72));
console.log('#166 Valkyrie — Mercy / Angela / nanobiotic / strike team / Zurich');
dumpDialogues(
  'Mercy join Overwatch / Valkyrie / nanobiotic / call sign',
  (d) =>
    (d.heroes.includes('Mercy')
      && (/valkyrie|nanobiotic|call.?sign|strike team|morrison|recruit|doctor|heal/i.test(d.blob)
        || d.heroes.includes('Soldier 76')
        || d.heroes.includes('Ana')))
    || /valkyrie|mercy.*overwatch|angela.*overwatch/i.test(d.name + d.blob),
  18,
);
{
  const hits = dialogues.filter(
    (d) => d.heroes.includes('Mercy') && (d.heroes.includes('Soldier 76') || d.heroes.includes('Ana')),
  );
  console.log(`\n---- DIALOGUES: Mercy + 76/Ana (${hits.length}) ----`);
  for (const h of hits.slice(0, 14)) {
    console.log(`[${st(h.name).padEnd(6)}] ${h.name}`);
    console.log(`         ${h.preview}`);
  }
}
dumpChatters(
  'Mercy Zurich / Valkyrie / Overwatch medic',
  (c) =>
    /^Mercy$/i.test(c.hero)
    && (/zurich|valkyrie|overwatch|medic|heal|swiss|switzerland|nanobiotic/i.test(c.blob)
      || !c.map),
  14,
);

console.log('\n' + '='.repeat(72));
console.log('#167 Sparrow — HAS commentary (Genji arcade/youth) — alts?');
dumpDialogues(
  'Genji playboy / Hanzo brother / arcade / Shimada youth',
  (d) =>
    (d.heroes.includes('Genji') || d.heroes.includes('Hanzo') || d.heroes.includes('Kiriko'))
    && /arcade|youth|brother|father|clan|sparrow|playboy|training|hanamura|sojiro/i.test(d.blob),
  14,
);
dumpChatters(
  'Genji/Hanzo/Kiriko Hanamura / arcade / youth',
  (c) =>
    /^(Genji|Hanzo|Kiriko)$/i.test(c.hero)
    && /hanamura|arcade|youth|ramen|sparrow|shimada|kanezaka|neon/i.test(c.blob),
  14,
);

console.log('\n' + '='.repeat(72));
console.log('#168 Captivate — Amélie / Gérard / ballet / Paris / Widowmaker');
dumpDialogues(
  'Widowmaker / Gérard / ballet / Amélie / Paris',
  (d) =>
    d.heroes.includes('Widowmaker')
    || /gérard|gerard|amélie|amelie|ballet|lacroix|widow|paris|marry|marriage/i.test(d.blob),
  18,
);
dumpChatters(
  'Widowmaker Paris / ballet / Gérard',
  (c) =>
    /^Widowmaker$/i.test(c.hero)
    || /paris|ballet|gérard|gerard|amélie|chateau|guillard/i.test(c.blob),
  14,
);

console.log('\n' + '='.repeat(72));
console.log('#169 Radiation Poisoning — Mercy Australia / Junkers / Sojourn / Emre');
dumpDialogues(
  'Mercy Australia / radiation / Junkers / Sojourn medical',
  (d) =>
    /radiation|australia|junker|melbourne|zealandia|nanobiotic/i.test(d.blob)
    || (d.heroes.includes('Mercy') && d.heroes.includes('Sojourn'))
    || (d.heroes.includes('Mercy') && /australia|junker|heal|campaign/i.test(d.blob)),
  16,
);
dumpChatters(
  'Mercy / Sojourn / Australia / Junkertown / Outback',
  (c) =>
    (/^(Mercy|Sojourn|Emre|Ana)$/i.test(c.hero)
      && /australia|junkertown|outback|melbourne|radiation|heal|medic/i.test(c.blob))
    || /junkertown|outback|australia|radiation/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#170 When you Wish — Sojourn / sick child / Toronto / Mercy limits');
dumpDialogues(
  'Sojourn / child / Toronto / Canada / wish / disease',
  (d) =>
    d.heroes.includes('Sojourn')
    || /toronto|canada|wish|child|disease|cybernetic|palliative|jada/i.test(d.blob),
  16,
);
dumpChatters(
  'Sojourn Toronto / Canada / New Queen Street',
  (c) =>
    /^Sojourn$/i.test(c.hero)
    || /toronto|canada|new queen|sojourn|wish|child/i.test(c.blob),
  14,
);
{
  const hits = dialogues.filter(
    (d) => d.heroes.includes('Sojourn') && d.heroes.includes('Mercy'),
  );
  console.log(`\n---- DIALOGUES: Sojourn+Mercy (${hits.length}) ----`);
  for (const h of hits.slice(0, 12)) {
    console.log(`[${st(h.name).padEnd(6)}] ${h.name}`);
    console.log(`         ${h.preview}`);
  }
}
