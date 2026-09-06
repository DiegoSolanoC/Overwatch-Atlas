/**
 * Page 19 commentary scout — dialogues + active chatter (incl. OW1 Classic map).
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

console.log('\n' + '='.repeat(72));
console.log('#181 Project Echo Goes Online — Echo / Liao / Athena / hard light / Oslo');
dumpDialogues(
  'Echo / Liao / Athena / Aurora / duplicate',
  (d) =>
    d.heroes.includes('Echo')
    || /echo|liao|athena|aurora|hard.?light|duplicate|replicate|project/i.test(d.blob),
  16,
);
dumpChatters(
  'Echo / Liao / Athena / Oslo',
  (c) =>
    /^Echo$/i.test(c.hero)
    || /liao|athena|aurora|echo|oslo|hard.?light|duplicate/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#182 Out There — Winston / Hammond / Horizon / Specimen / peanut butter / Earth');
dumpDialogues(
  'Winston / Wrecking Ball / Horizon / Hammond / peanut',
  (d) =>
    d.heroes.includes('Winston')
    || d.heroes.includes('Wrecking Ball')
    || /horizon|hammond|peanut|specimen|lunar|gorilla|wrecking ball/i.test(d.blob),
  16,
);
dumpChatters(
  'Winston / Wrecking Ball / Horizon Lunar Colony',
  (c) =>
    /^Winston$/i.test(c.hero)
    || /^Wrecking Ball$/i.test(c.hero)
    || /horizon|hammond|peanut|lunar|specimen|gorilla/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#183 Cursed — Mizuki / Shion / Hashimoto / debt / curse / Tokyo');
dumpDialogues(
  'Mizuki / Shion / Hashimoto / curse / debt',
  (d) =>
    d.heroes.some((h) => /^Mizuki$/i.test(h) || /^Shion$/i.test(h))
    || /mizuki|shion|hashimoto|curse|debt|orphan|elder/i.test(d.blob),
  16,
);
dumpChatters(
  'Mizuki / Shion / Hashimoto / Kanezaka / Tokyo',
  (c) =>
    /^Mizuki$/i.test(c.hero)
    || /^Shion$/i.test(c.hero)
    || /hashimoto|curse|mizuki|shion|kanezaka|akihabara/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#184 When Dragons Fall — Genji / Hanzo / Sojiro / Blackwatch / Shimada duel');
dumpDialogues(
  'Genji / Hanzo / brother / Shimada / Blackwatch / duel',
  (d) =>
    (d.heroes.includes('Genji') && d.heroes.includes('Hanzo'))
    || /shimada|sojiro|blackwatch|brother.*genji|genji.*brother|dragon|duel|sword/i.test(d.blob),
  18,
);
dumpChatters(
  'Genji / Hanzo / Hanamura / Shimada',
  (c) =>
    (/^Genji$/i.test(c.hero) || /^Hanzo$/i.test(c.hero))
    && /hanamura|hanaoka|shimada|brother|dragon|father|sojiro/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#185 Search and Rescue — Freja / Ana recruit / tracker / Copenhagen / Overwatch');
dumpDialogues(
  'Freja / search and rescue / Ana / tracker / recruit',
  (d) =>
    d.heroes.includes('Freja')
    || /search and rescue|tracker|freja|recruit|bounty/i.test(d.blob),
  16,
);
dumpChatters(
  'Freja / Copenhagen / Overwatch SAR',
  (c) => /^Freja$/i.test(c.hero) || /copenhagen|search and rescue|freja|tracker/i.test(c.blob),
  14,
);

console.log('\n' + '='.repeat(72));
console.log('#186 Null Army — Ramattra / Null Sector / warbot army / liberator');
dumpDialogues(
  'Ramattra / Null Sector / army / warbot / liberat',
  (d) =>
    d.heroes.includes('Ramattra')
    || /null sector|warbot|army|liberator|ramattra/i.test(d.blob),
  16,
);
dumpChatters(
  'Ramattra / Null Sector / war',
  (c) =>
    /^Ramattra$/i.test(c.hero)
    || /null sector|warbot|liberator|omnium/i.test(c.blob),
  14,
);

console.log('\n' + '='.repeat(72));
console.log('#187 Cyber Ninja — Genji / Mercy / cybernetics / Blackwatch / Zurich');
dumpDialogues(
  'Genji / Mercy / cyber / rebuild / Blackwatch / Sojourn',
  (d) =>
    (d.heroes.includes('Genji') && (d.heroes.includes('Mercy') || d.heroes.includes('Reaper')))
    || /cyber|rebuild|blackwatch|cyborg|augment|almost dying|try dying/i.test(d.blob),
  16,
);
dumpChatters(
  'Genji / Mercy / cyber / Zurich',
  (c) =>
    (/^Genji$/i.test(c.hero) && /cyber|ninja|body|human|machine/i.test(c.blob))
    || (/^Mercy$/i.test(c.hero) && /genji|cyber|patient/i.test(c.blob))
    || /cyborg|cyber ninja|more machine/i.test(c.blob),
  14,
);

console.log('\n' + '='.repeat(72));
console.log('#188 Healing Nature — Lifeweaver / Biolight / Vishkar / hard light healing');
dumpDialogues(
  'Lifeweaver / Biolight / Vishkar / nature / healing',
  (d) =>
    d.heroes.includes('Lifeweaver')
    || /biolight|lifeweaver|niran|vishkar|biomass|botany|nature/i.test(d.blob),
  16,
);
dumpChatters(
  'Lifeweaver / Biolight / Vishkar / Utopaea',
  (c) =>
    /^Lifeweaver$/i.test(c.hero)
    || /biolight|vishkar|utopaea|nature|biomass/i.test(c.blob),
  14,
);

console.log('\n' + '='.repeat(72));
console.log('#189 Takeover — Doomfist / Adeyemi / gauntlet / Talon / conflict evolves');
dumpDialogues(
  'Doomfist / Adeyemi / gauntlet / Talon / conflict',
  (d) =>
    d.heroes.includes('Doomfist')
    || /adeyemi|gauntlet|doomfist|talon|conflict|evolve|stagnate/i.test(d.blob),
  16,
);
dumpChatters(
  'Doomfist / Numbani / Adeyemi / Talon / conflict',
  (c) =>
    /^Doomfist$/i.test(c.hero)
    || /adeyemi|gauntlet|numbani|conflict|evolve|stagnate/i.test(c.blob),
  16,
);

console.log('\n' + '='.repeat(72));
console.log('#190 Lost in Time — Tracer / chronal / Splitstream / Lena / Wexler');
dumpDialogues(
  'Tracer / chronal / time / pulse / Winston / Slipstream',
  (d) =>
    d.heroes.includes('Tracer')
    || /chronal|slipstream|splitstream|time travel|pulse bomb|desync|wexler|lena/i.test(d.blob),
  16,
);
dumpChatters(
  'Tracer / chronal / time / London / King\'s Row',
  (c) =>
    /^Tracer$/i.test(c.hero)
    || /chronal|slipstream|time|pulse|accelerator/i.test(c.blob),
  16,
);
