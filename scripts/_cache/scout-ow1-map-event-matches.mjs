/**
 * Scout OW1 Classic map-specific chatters against all timeline events.
 * Prefer literal map / hero / topic hits.
 */
import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  mapLabelFromChatterDisclaimer,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;
const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;

function collectCommentary(e) {
  /** @type {string[]} */
  const names = [];
  const push = (c) => {
    let n = '';
    if (typeof c === 'string') n = c.trim();
    else if (c && typeof c === 'object') n = String(c.name || c.label || '').trim();
    if (n) names.push(n);
  };
  if (Array.isArray(e.commentary)) e.commentary.forEach(push);
  if (Array.isArray(e.variants)) {
    for (const v of e.variants) {
      if (Array.isArray(v?.commentary)) v.commentary.forEach(push);
    }
  }
  return names;
}

/** @type {Map<string, string[]>} */
const usedBy = new Map();
events.forEach((e, idx) => {
  for (const n of collectCommentary(e)) {
    const key = n.toLowerCase();
    if (!usedBy.has(key)) usedBy.set(key, []);
    usedBy.get(key).push(`#${idx + 1} ${e.name}`);
  }
});

function strip(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @type {{ label: string, hero: string, map: string, text: string }[]} */
const ow1Maps = [];
const labelCounts = new Map();
for (const row of convs) {
  if (!isChatterEntry(row)) continue;
  for (const line of row.lines || []) {
    if (String(line.era || '') !== 'Classic') continue;
    if (!String(line.disclaimer || '').trim()) continue;
    const hero = String(line.hero || row.name || '').trim();
    const base = buildChatterCommentaryLabel(hero, line.subtitles, line.disclaimer);
    if (!base) continue;
    const n = (labelCounts.get(base) || 0) + 1;
    labelCounts.set(base, n);
    const label = n === 1 ? base : `${base} (${n})`;
    const map = mapLabelFromChatterDisclaimer(line.disclaimer) || String(line.disclaimer || '').trim();
    ow1Maps.push({
      label,
      hero,
      map,
      text: strip(line.subtitles),
    });
  }
}

const MAP_EVENT = [
  [/hanamura/i, /hanamura|shimada|kanezaka|japan|clan|genji|hanzo|kiriko/i],
  [/numbani/i, /numbani|adawe|orisa|doomfist|nigeria|eka|oladele|scourge|harmony/i],
  [/king.?s.?row/i, /king.?s.?row|london|underworld|omnic right|mondatta|uprising/i],
  [/eichenwalde/i, /eichenwalde|crusader|balderich|germany|reinhardt/i],
  [/dorado/i, /dorado|mexico|los muertos|sombra/i],
  [/route\s*66/i, /route\s*66|deadlock|ashe|cassidy|train|heist|outlaw/i],
  [/volskaya/i, /volskaya|russia|zarya|katya|siberia/i],
  [/lijiang/i, /lijiang|china|lucheng|mei|juno|mars|shanghai/i],
  [/ilios/i, /ilios|greece/i],
  [/nepal|shambali/i, /nepal|shambali|zenyatta|mondatta|iris|ramattra/i],
  [/oasis/i, /oasis|iraq|moira/i],
  [/junkertown|outback|australia/i, /junkertown|junker|australia|outback|omnium|junkrat|roadhog/i],
  [/horizon|lunar|moon/i, /horizon|lunar|moon|winston|hammond/i],
  [/busan|korea/i, /busan|korea|meka|d\.?va|gwishin/i],
  [/rialto|venice/i, /rialto|venice|italy|talon|gérard|am[eé]lie/i],
  [/havana|cuba/i, /havana|cuba|baptiste|caribbean/i],
  [/paris|france/i, /paris|france|widow|am[eé]lie/i],
  [/anubis|egypt|cairo|temple of anubis/i, /anubis|egypt|cairo|helwan|ana|pharah/i],
  [/gibraltar|watchpoint/i, /gibraltar|watchpoint|recall|overwatch/i],
  [/hollywood/i, /hollywood/i],
  [/chateau|guillard/i, /chateau|guillard|widow|am[eé]lie|france/i],
  [/petras/i, /petras|overwatch.*disband|recall|ban/i],
];

function eventBlob(e, idx) {
  const heroes = (e.heroFilterPlaces || [])
    .map((r) => `${r.locationName || ''} ${r.country || ''}`)
    .join(' ');
  const places = [
    ...(e.secondaryCountryPlaces || []),
    ...(e.factionFilterPlaces || []),
    ...(e.npcFilterPlaces || []),
  ]
    .map((r) => `${r.locationName || ''} ${r.country || ''} ${r.reasoning || ''}`)
    .join(' ');
  return strip(
    `#${idx + 1} ${e.name} ${e.cityDisplayName || ''} ${e.description || ''} ${heroes} ${places}`,
  ).toLowerCase();
}

function heroInEvent(hero, eventText) {
  if (hero === 'D.va' || hero === 'D.Va') return /d\.?va\b/i.test(eventText);
  if (hero === 'Soldier 76') return /soldier:?\s*76|morrison|jack morrison/i.test(eventText);
  if (hero === 'Wrecking Ball') return /wrecking ball|hammond/i.test(eventText);
  if (hero === 'Lúcio') return /l[uú]cio/i.test(eventText);
  if (hero === 'Torbjörn') return /torbj/i.test(eventText);
  const re = new RegExp(`\\b${hero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(eventText);
}

function scorePair(chatter, eventText) {
  let score = 0;
  /** @type {string[]} */
  const reasons = [];

  if (heroInEvent(chatter.hero, eventText)) {
    score += 35;
    reasons.push('hero');
  }

  let mapHit = false;
  for (const [mapRe, eventRe] of MAP_EVENT) {
    if (mapRe.test(chatter.map) && eventRe.test(eventText)) {
      score += 45;
      reasons.push('map');
      mapHit = true;
      break;
    }
  }

  const eTokens = new Set(eventText.split(/[^a-z0-9']+/).filter((t) => t.length >= 5));
  const cTokens = `${chatter.map} ${chatter.text}`
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((t) => t.length >= 5);
  let shared = 0;
  for (const t of cTokens) {
    if (eTokens.has(t)) shared += 1;
  }
  if (shared) {
    score += Math.min(28, shared * 5);
    reasons.push(`tokens:${shared}`);
  }

  // Soft lines with only map+hero are ok; require something meaningful
  if (!reasons.includes('hero') && !mapHit) return { score: 0, reasons };
  if (reasons.includes('hero') && !mapHit && shared < 2) return { score: 0, reasons };
  if (mapHit && !reasons.includes('hero') && shared < 1) {
    // map-only without hero is weak unless very specific map event
    score -= 15;
  }

  return { score, reasons };
}

console.log(`OW1 Classic map chatters: ${ow1Maps.length}`);
console.log(`Events: ${events.length}\n`);

/** @type {any[]} */
const results = [];

for (const c of ow1Maps) {
  /** @type {any[]} */
  const matches = [];
  events.forEach((e, idx) => {
    if (/is Born/i.test(e.name)) return;
    const blob = eventBlob(e, idx);
    const { score, reasons } = scorePair(c, blob);
    if (score < 60) return;
    matches.push({
      num: idx + 1,
      name: e.name,
      score,
      reasons,
      existing: collectCommentary(e),
    });
  });
  matches.sort((a, b) => b.score - a.score || a.num - b.num);
  if (!matches.length) continue;
  results.push({
    label: c.label,
    map: c.map,
    text: c.text,
    matches: matches.slice(0, 4),
  });
}

results.sort(
  (a, b) => (b.matches[0]?.score || 0) - (a.matches[0]?.score || 0) || a.label.localeCompare(b.label),
);

console.log('=== STRONG OW1 MAP CHATTER → EVENT MATCHES ===\n');
for (const row of results.slice(0, 55)) {
  const used = usedBy.has(row.label.toLowerCase())
    ? `USED → ${(usedBy.get(row.label.toLowerCase()) || []).join('; ')}`
    : 'free';
  console.log(`• ${row.label}`);
  console.log(`  ${used}`);
  console.log(`  “${row.text.slice(0, 140)}”`);
  for (const m of row.matches.slice(0, 3)) {
    const ex = m.existing.length
      ? ` | already has commentary`
      : '';
    console.log(`    → #${m.num} ${m.name}  [${m.score}] (${m.reasons.join(',')})${ex}`);
  }
  console.log('');
}

fs.writeFileSync(
  'scripts/_cache/scout-ow1-map-event-matches.json',
  JSON.stringify({ count: ow1Maps.length, matched: results.length, results }, null, 2),
);
console.log(`Wrote scripts/_cache/scout-ow1-map-event-matches.json (${results.length} with hits)`);
