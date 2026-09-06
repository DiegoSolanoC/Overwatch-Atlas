/**
 * Page 16 commentary scout — dialogues + active chatter.
 * Prefer literal name/map/topic hits; flag USED.
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

/** @type {{ kind:'dialogue', name:string, heroes:string[], blob:string, preview:string }[]} */
const dialogues = [];
/** @type {{ kind:'chatter', label:string, hero:string, text:string, map:string, blob:string, preview:string }[]} */
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
      const text = strip(line.subtitles);
      chatters.push({
        kind: 'chatter',
        label,
        hero,
        text,
        map,
        blob: `${hero} ${map} ${text} ${line.disclaimer || ''}`.toLowerCase(),
        preview: text.slice(0, 160),
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
    kind: 'dialogue',
    name: c.name,
    heroes,
    blob: `${c.name} ${subs} ${(c.tags || []).join(' ')} ${c.scene || ''}`.toLowerCase(),
    preview: subs.slice(0, 220).replace(/\s+/g, ' '),
  });
}

/**
 * @param {RegExp[]} patterns
 * @param {{ limit?: number, requireHero?: string|RegExp }} [opts]
 */
function dumpDialogues(label, patterns, opts = {}) {
  const limit = opts.limit ?? 12;
  const hits = dialogues.filter((d) => {
    if (opts.requireHero) {
      const rh = opts.requireHero;
      const ok =
        typeof rh === 'string'
          ? d.heroes.some((h) => h.toLowerCase() === rh.toLowerCase())
          : d.heroes.some((h) => rh.test(h));
      if (!ok) return false;
    }
    return patterns.some((re) => re.test(d.blob) || re.test(d.name));
  });
  console.log(`\n---- DIALOGUES: ${label} (${hits.length}) ----`);
  for (const h of hits.slice(0, limit)) {
    console.log(`[${st(h.name).padEnd(6)}] ${h.name}  [${h.heroes.join(', ')}]`);
    console.log(`         ${h.preview}`);
  }
}

/**
 * @param {RegExp[]} patterns
 * @param {{ limit?: number, requireHero?: string|RegExp, mapHint?: RegExp }} [opts]
 */
function dumpChatters(label, patterns, opts = {}) {
  const limit = opts.limit ?? 12;
  const hits = chatters
    .filter((c) => {
      if (opts.requireHero) {
        const rh = opts.requireHero;
        const ok =
          typeof rh === 'string'
            ? c.hero.toLowerCase() === rh.toLowerCase()
            : rh.test(c.hero);
        if (!ok) return false;
      }
      if (opts.mapHint && !opts.mapHint.test(c.map || c.blob)) return false;
      return patterns.some((re) => re.test(c.blob) || re.test(c.label));
    })
    .sort((a, b) => {
      // Prefer map-literal / stronger literal matches first (longer label)
      const am = opts.mapHint && opts.mapHint.test(a.map || '') ? 1 : 0;
      const bm = opts.mapHint && opts.mapHint.test(b.map || '') ? 1 : 0;
      return bm - am || a.label.localeCompare(b.label);
    });
  console.log(`\n---- CHATTERS: ${label} (${hits.length}) ----`);
  for (const h of hits.slice(0, limit)) {
    console.log(`[${st(h.label).padEnd(6)}] ${h.label}`);
    if (h.map) console.log(`         map: ${h.map}`);
  }
}

console.log(`Dialogues: ${dialogues.length} | Chatters: ${chatters.length}`);

// ─── #151 The Scourge of Numbani ───────────────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log('#151 The Scourge of Numbani — Doomfist / Adeyemi / Numbani / Kisangani / gauntlet');
dumpDialogues(
  'Numbani / Doomfist / Adeyemi / gauntlet / scourge',
  [/numbani/, /doomfist/, /adeyemi/, /gauntlet/, /scourge/, /wildebeest/, /kisangani/, /africa.*doom|doom.*africa/],
  { limit: 18 },
);
dumpChatters(
  'Numbani map / Doomfist / Adeyemi',
  [/numbani/, /doomfist/, /adeyemi/, /gauntlet/, /scourge/, /nigeria/],
  { limit: 16, mapHint: /numbani/i },
);
dumpChatters('Numbani-ish without map filter', [/numbani/, /doomfist/, /adeyemi/, /scourge/], {
  limit: 14,
});

// ─── #152 The Red Promise (has existing) ───────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log('#152 The Red Promise — Lucheng / Mars / Juno parents / Lijiang (HAS existing)');
dumpDialogues(
  'Mars / Red Promise / Lucheng / Lijiang / Juno parents',
  [/mars/, /red promise/, /lucheng/, /lijiang/, /juno/, /teo|minh|jiayi|chao/],
  { limit: 16 },
);
dumpChatters(
  'Mars / Lucheng / Lijiang / Red Promise',
  [/mars/, /lucheng/, /lijiang/, /red promise/, /colony/, /space.*ship|satellite/],
  { limit: 14 },
);

// ─── #153 Yearning ─────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log('#153 Yearning — Ana + Reinhardt romance / Cairo');
dumpDialogues(
  'Ana + Reinhardt',
  [/ana.*reinhardt|reinhardt.*ana/, /yearn|fond of|lieutenant reinhardt|amari/],
  { limit: 20 },
);
dumpDialogues('Ana/Reinhardt co-presence', [/./], {
  limit: 20,
  requireHero: /^(Ana|Reinhardt)$/,
});
// Filter Ana+Reinhardt both present
{
  const hits = dialogues.filter(
    (d) => d.heroes.includes('Ana') && d.heroes.includes('Reinhardt'),
  );
  console.log(`\n---- DIALOGUES: both Ana+Reinhardt (${hits.length}) ----`);
  for (const h of hits.slice(0, 20)) {
    console.log(`[${st(h.name).padEnd(6)}] ${h.name}`);
    console.log(`         ${h.preview}`);
  }
}
dumpChatters('Ana Cairo / Reinhardt fondness', [/cairo|egypt|reinhardt|yearn|fond|amor|love|husband|marriage/], {
  requireHero: /^Ana$/i,
  limit: 14,
});
dumpChatters('Reinhardt Ana / Cairo', [/ana|amari|cairo|egypt|love|fond|yearn/], {
  requireHero: /^Reinhardt$/i,
  limit: 14,
});

// ─── #154 The Xie Incident ─────────────────────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log('#154 The Xie Incident — Ana banned from Russia / Morrison / Moscow');
dumpDialogues(
  'Russia / Moscow / Xie / ban / Ana Russia',
  [/xie/, /russia/, /moscow/, /banned from russia|ban.*russia|russia.*ban/, /volskaya/, /katya/],
  { limit: 18 },
);
dumpChatters(
  'Ana Russia / Moscow / ban',
  [/russia/, /moscow/, /volskaya/, /banned/, /xie/, /katya/],
  { limit: 14 },
);
dumpChatters('Ana map Russia', [/russia|moscow|volskaya/], { requireHero: /^Ana$/i, limit: 12 });

// ─── #156 Omnic Rights (has existing) ──────────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log('#156 Omnic Rights — UN / Liao / personhood / King\'s Row (HAS existing)');
dumpDialogues(
  'Omnic rights / personhood / Liao / Aurora / UN',
  [/omnic right|personhood|aurora/, /liao/, /tin can/, /equal/, /sentien/, /discrimination|prejudic/],
  { limit: 18 },
);
dumpChatters(
  'Omnic rights / King\'s Row / prejudice',
  [/omnic/, /rights/, /personhood/, /king.?s.?row/, /prejudic|discrimination|claptrap|tin can|equal/],
  { limit: 16 },
);

// ─── #158 Black Ops ────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log('#158 Black Ops — Reyes / Gérard vacation / Cape Town / Blackwatch / Cassidy');
dumpDialogues(
  'Blackwatch / vacation / Cape Town / Reyes / Gérard / Anubis',
  [/blackwatch/, /vacation/, /cape.?town|capetown/, /gérard|gerard/, /reyes/, /anubis/, /covert|black ops|off.?books/],
  { limit: 20 },
);
dumpChatters(
  'Blackwatch / vacation / Cape Town / Reyes',
  [/blackwatch/, /vacation/, /cape.?town/, /reyes/, /gerard|gérard/, /anubis/, /covert/],
  { limit: 14 },
);
{
  const hits = dialogues.filter(
    (d) =>
      (d.heroes.includes('Reaper') || d.heroes.includes('Cassidy')) &&
      /blackwatch|reyes|vacation|covert|cape|anubis|gerard|gérard/i.test(d.blob),
  );
  console.log(`\n---- DIALOGUES: Reaper/Cassidy black ops-ish (${hits.length}) ----`);
  for (const h of hits.slice(0, 16)) {
    console.log(`[${st(h.name).padEnd(6)}] ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`         ${h.preview}`);
  }
}

// ─── #159 Growing with the Clan ────────────────────────────────────────────
console.log('\n' + '='.repeat(72));
console.log('#159 Growing with the Clan — Kiriko / Shimada / Genji / Hanzo / Kanezaka / Asa');
dumpDialogues(
  'Kiriko / Shimada / Kanezaka / Genji Hanzo childhood',
  [/kiriko/, /shimada/, /kanezaka/, /yamagami/, /fox spirit|kitsune/, /sojiro/, /asa |toshiro/],
  { limit: 20 },
);
{
  const hits = dialogues.filter(
    (d) =>
      d.heroes.includes('Kiriko') &&
      (d.heroes.includes('Genji') || d.heroes.includes('Hanzo')),
  );
  console.log(`\n---- DIALOGUES: Kiriko + Genji/Hanzo (${hits.length}) ----`);
  for (const h of hits.slice(0, 18)) {
    console.log(`[${st(h.name).padEnd(6)}] ${h.name} [${h.heroes.join(', ')}]`);
    console.log(`         ${h.preview}`);
  }
}
dumpChatters(
  'Kanezaka / Shimada / Kiriko fox / Genji sweets',
  [/kanezaka/, /shimada/, /kiriko/, /fox/, /arcade|sweets|niece|training|clan/],
  { limit: 16 },
);
dumpChatters('Kanezaka map', [/kanezaka/], { limit: 12, mapHint: /kanezaka/i });
