/**
 * Score active Hero Chatter lines against story events for commentary second-pass.
 * Usage: node scripts/_cache/scout-chatter-pass-match.mjs [page] [minScore]
 */
import fs from 'fs';
import { isChatterEntry } from '../../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import {
  buildChatterCommentaryLabel,
  isActiveChatterLineForCommentary,
} from '../../src/features/system-interface/interface-shared/storyEventCommentaryTheater.js';

const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;
const convs = JSON.parse(
  fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;
const usedRaw = JSON.parse(fs.readFileSync('scripts/_cache/used-commentary.json', 'utf8'));
const used = new Map(Object.entries(usedRaw));

/** @type {{ label: string, hero: string, text: string, blob: string }[]} */
const chatters = [];
const labelCounts = new Map();
for (const row of convs) {
  if (!isChatterEntry(row) || String(row.status || 'active') === 'removed') continue;
  for (const line of row.lines || []) {
    if (!isActiveChatterLineForCommentary(line)) continue;
    const hero = String(line.hero || row.name || '').trim();
    const base = buildChatterCommentaryLabel(hero, line.subtitles);
    if (!base) continue;
    const n = (labelCounts.get(base) || 0) + 1;
    labelCounts.set(base, n);
    const label = n === 1 ? base : `${base} (${n})`;
    const text = base.slice(hero.length + 3);
    chatters.push({
      label,
      hero,
      text,
      blob: `${hero} ${text}`.toLowerCase(),
    });
  }
}

function collectCommentary(e) {
  /** @type {string[]} */
  const names = [];
  const push = (c) => {
    const n = String(c || '').trim();
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  };
  if (Array.isArray(e.commentary)) e.commentary.forEach(push);
  if (Array.isArray(e.variants)) {
    for (const v of e.variants) {
      if (Array.isArray(v?.commentary)) v.commentary.forEach(push);
    }
  }
  return names;
}

function heroesFromEvent(e) {
  const out = new Set();
  for (const row of e.heroFilterPlaces || []) {
    const n = String(row?.locationName || '').trim();
    if (n) out.add(n);
  }
  const desc = `${e.name || ''} ${e.description || ''}`;
  // Common hero name hits in text
  for (const h of [
    'Ana', 'Ashe', 'Baptiste', 'Bastion', 'Brigitte', 'Cassidy', 'D.Va', 'Doomfist',
    'Echo', 'Genji', 'Hanzo', 'Hazard', 'Illari', 'Junker Queen', 'Junkrat', 'Juno',
    'Kiriko', 'Lifeweaver', 'Lúcio', 'Lucio', 'Mauga', 'Mei', 'Mercy', 'Moira',
    'Orisa', 'Pharah', 'Ramattra', 'Reaper', 'Reinhardt', 'Roadhog', 'Sigma',
    'Sojourn', 'Soldier: 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer', 'Venture',
    'Widowmaker', 'Winston', 'Wrecking Ball', 'Zarya', 'Zenyatta', 'Freja', 'Wuyang',
    'Vendetta', 'Emre',
  ]) {
    const re = new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(desc)) out.add(h === 'Lucio' ? 'Lúcio' : h);
  }
  return [...out];
}

/** Theme keyword bags → boost when present in chatter text */
const THEME_BAGS = [
  [/omnium|omnic|god program|aurora|anubis|iris|null sector/i, /omnic|omnium|iris|aurora|anubis|null.?sector|god.?program|machine|robot/i],
  [/overwatch.*(found|form|creat)|united nations|strike team/i, /overwatch|mission|team|protect|world/i],
  [/blackwatch|reyes|talon/i, /blackwatch|talon|reyes|gabriel|covert|shadow/i],
  [/sep|soldier enhancement|morrison|bland|garcia/i, /enhancement|soldier|sep|serum|experiment/i],
  [/crisis|uprising|war/i, /war|fight|battle|survive|mission|enemy/i],
  [/egypt|cairo|giza|helwan|anubis/i, /egypt|cairo|home|desert|sand/i],
  [/nepal|shambali|zenyatta|mondatta|iris/i, /iris|shambali|monk|peace|enlighten|harmony/i],
  [/numbani|orisa|eka|adawe/i, /numbani|orisa|africa|home|protect/i],
  [/korea|busan|meka|gwishin|d\.?va/i, /korea|busan|meka|home|game/i],
  [/antarctica|ecopoint|mei|climate|ice/i, /ice|cold|climate|research|science|antarctica/i],
  [/junker|australia|outback|junkrat|roadhog/i, /junk|australia|outback|scrap|queen/i],
  [/russia|volskaya|zarya|katya/i, /russia|volskaya|home|protect|family/i],
  [/japan|shimada|hanzo|genji|kiriko/i, /clan|family|honor|brother|dragon|japan/i],
  [/mexico|dorado|sombra|lucio|brazil/i, /home|family|mexico|brazil|dorado/i],
  [/china|mei|liao|echo|shanghai/i, /china|home|family|science/i],
  [/germany|eichenwalde|reinhardt|brigitte|torbj/i, /honor|crusader|armor|hammer|germany|home/i],
  [/canada|vancouver|sojourn|toronto/i, /canada|home|command|leader/i],
  [/uk|britain|tracer|king.?s.?row|london/i, /london|home|time|britain/i],
  [/swiss|switzerland|mercy|angela|moira/i, /heal|doctor|science|ethics|patient/i],
  [/oasis|iraq|moira|sombra/i, /oasis|science|research/i],
  [/deadlock|ashe|cassidy|bob/i, /deadlock|outlaw|gang|train|heist/i],
  [/lash|illari|inti|peru|solar/i, /inti|solar|sun|peru|home|temple/i],
  [/mauga|samoa|talofa|baptiste/i, /samoa|home|brother|island/i],
  [/winston|luna|horizon|gorilla/i, /moon|luna|horizon|science|banana|home/i],
  [/sigma|siebren|talon|gravity/i, /gravity|science|mind|control|space/i],
  [/doomfist|akande|gauntlet|nigeria/i, /doom|fist|power|change|nigeria/i],
  [/widow|am[eé]lie|talon|assassin/i, /talon|spider|kill|target|paris|france/i],
  [/reaper|reyes|death|wraith/i, /death|revenge|ghost|wraith|reyes/i],
  [/pharah|fareeha|ana|helwan/i, /daughter|mother|protect|sky|mission/i],
  [/venture|archaeolog|omnic.*archae/i, /dig|ruin|history|adventure|archae/i],
  [/freja|harding|denmark/i, /hunt|track|arrow|home/i],
  [/kiriko|kanezaka|fox|kitsune/i, /fox|spirit|protect|home|family/i],
  [/baptiste|caribbean|talon.*medic/i, /heal|medic|talon|home|caribbean/i],
  [/lifeweaver|thailand|bhumi|vishkar/i, /life|garden|thailand|create|beauty/i],
  [/symmetra|vishkar|architect/i, /order|architect|perfect|vishkar/i],
  [/ball|hammond|junker|wrecking/i, /hammond|ball|science|mech/i],
  [/echo|liao|adapt/i, /echo|adapt|learn|created|liao/i],
  [/juno|mars|space|family/i, /mars|space|family|home|earth/i],
  [/hazard|glasgow|riot/i, /riot|fight|street|home/i],
  [/wuyang|china|wave/i, /wave|water|home|family/i],
];

function scoreChatter(eventBlob, eventHeroes, chatter) {
  let score = 0;
  const reasons = [];
  const heroHit = eventHeroes.some(
    (h) => h.toLowerCase() === chatter.hero.toLowerCase()
      || (h === 'D.Va' && /d\.?va/i.test(chatter.hero))
      || (h === 'Torbjörn' && /torbj/i.test(chatter.hero))
      || (h === 'Lúcio' && /l[uú]cio/i.test(chatter.hero)),
  );
  if (heroHit) {
    score += 40;
    reasons.push('hero');
  } else {
    return { score: 0, reasons };
  }

  for (const [eventRe, chatterRe] of THEME_BAGS) {
    if (eventRe.test(eventBlob) && chatterRe.test(chatter.blob)) {
      score += 12;
      reasons.push('theme');
    }
  }

  // Shared contentful tokens (len>=5)
  const eTokens = new Set(
    eventBlob
      .toLowerCase()
      .replace(/<[^>]+>/g, ' ')
      .split(/[^a-z0-9']+/)
      .filter((t) => t.length >= 5),
  );
  const cTokens = chatter.blob.split(/[^a-z0-9']+/).filter((t) => t.length >= 5);
  let shared = 0;
  for (const t of cTokens) {
    if (eTokens.has(t)) shared += 1;
  }
  if (shared) {
    score += Math.min(24, shared * 6);
    reasons.push(`tokens:${shared}`);
  }

  // Penalize ultra-generic mission pep
  if (/^(let.?s|okay|alright|ready|here we|time to|good luck)/i.test(chatter.text)
    && shared < 2
    && !reasons.includes('theme')) {
    score -= 15;
  }

  return { score, reasons };
}

function status(label) {
  const k = label.toLowerCase();
  if (used.has(k)) return `USED → ${(used.get(k) || []).join('; ')}`;
  // also check if any used key is this chatter already
  return 'free';
}

const pageArg = Number(process.argv[2] || 1);
const minScore = Number(process.argv[3] || 45);
const start = (pageArg - 1) * 10;
const end = pageArg * 10;
const slice = events.slice(start, end);

console.log(`Chatters loaded: ${chatters.length}`);
console.log(`Page ${pageArg} (#${start + 1}–${end}), minScore=${minScore}\n`);

slice.forEach((e, i) => {
  const num = start + i + 1;
  if (/is Born/i.test(e.name)) {
    console.log(`#${num} ${e.name} — BIRTHDAY skip\n`);
    return;
  }
  const heroes = heroesFromEvent(e);
  const blob = `${e.name || ''} ${e.description || ''} ${heroes.join(' ')}`;
  const existing = collectCommentary(e);
  const scored = chatters
    .map((c) => ({ ...c, ...scoreChatter(blob, heroes, c) }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  console.log(`==== #${num} ${e.name} ====`);
  console.log(`heroes: ${heroes.join(', ') || '(none)'}`);
  if (existing.length) console.log(`existing: ${existing.join(' | ')}`);
  if (!scored.length) {
    console.log('(no strong chatter candidates)\n');
    return;
  }
  for (const c of scored.slice(0, 10)) {
    console.log(
      `  [${String(c.score).padStart(3)}] ${status(c.label).padEnd(8)} | ${c.label}`,
    );
    console.log(`         reasons: ${c.reasons.join(',')}`);
  }
  console.log('');
});
