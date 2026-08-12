/**
 * Tag Atlas conversations Map Specific from wiki Interaction "On [[Map]]…" cells.
 * Fills mapChoices from wiki. Writes conversations.json.
 *
 * Usage: node scripts/tag-map-specific-from-wiki.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';
import {
    DIALOGUE_THEATER_MAP_SPECIFIC_TAG,
    finalizeDialogueTheaterTags,
    normalizeDialogueTheaterChoiceList,
} from '../src/features/dialogue-theater/dialogue-theater-list/dialogueTheaterEraFilter.js';

ensureAuditWorkspace();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CACHE = WIKI_QUOTES_CACHE_DIR;
const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const OUT_JSON = auditPath('_tag-map-specific-report.json');
const DRY_RUN = process.argv.includes('--dry-run');

const MAP_TAG = DIALOGUE_THEATER_MAP_SPECIFIC_TAG;

/** Known map/event titles — prefer these when parsing headers. */
const KNOWN_PLACES = [
    'Watchpoint: Gibraltar',
    'Temple of Anubis',
    'Throne of Anubis',
    'New Junk City',
    'Blizzard World',
    'Winter Wonderland',
    'Antarctic Peninsula',
    'Circuit Royal',
    "King's Row",
    'New Queen Street',
    'Junkertown',
    'Hanamura',
    'Hanaoka',
    'Eichenwalde',
    'Esperança',
    'Paraíso',
    'Colosseo',
    'Midtown',
    'Dorado',
    'Havana',
    'Ilios',
    'Samoa',
    'Oasis',
    'Rialto',
    'Busan',
    'Nepal',
    'Numbani',
    'Hollywood',
    'Paris',
    'Lijiang Tower',
    'Runasapi',
    'Suravasa',
    'Shambali Monastery',
    'Castillo',
    'Black Forest',
    'Kanezaka',
    'Petra',
    'Ayutthaya',
    'Château Guillard',
    'Route 66',
    'Horizon Lunar Colony',
    'Practice Range',
];

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(
            /\b(sighs?|chuckles?|laughs?|laugh|scoffs?|gasps?|groans?|grunts?|nervous|soft|tired|quietly|disrespectful)\b/g,
            ' ',
        )
        .replace(/\bcap['']?n\b/g, 'captain')
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeHero(name) {
    return String(name || '')
        .trim()
        .replace(/^Soldier:\s*/i, 'Soldier ')
        .replace(/^Soldier_+\s*/i, 'Soldier ')
        .replace(/\s+/g, ' ');
}

function cleanWikiText(raw) {
    return String(raw || '')
        .replace(/\{\{[^}]+\}\}/g, ' ')
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/'''?/g, '')
        .replace(/''/g, '')
        .replace(/&amp;/gi, '&')
        .replace(/&nbsp;/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const HERO_NAMES = new Set(
    fs
        .readdirSync(CACHE)
        .filter((f) => /quotes\.wikitext$/i.test(f) || f.endsWith('.wikitext'))
        .map((f) =>
            f
                .replace(/_Quotes\.wikitext$/i, '')
                .replace(/\.wikitext$/i, '')
                .replace(/_/g, ' ')
                .toLowerCase(),
        )
        .concat(['soldier: 76', 'd.va', 'lucio', 'lúcio', 'torbjorn', 'torbjörn']),
);

const NON_MAP_ON =
    /^(on (fire|my way|the (attack|point|move|payload|table|backlog|objective)|second thought|it|team|our|me|you)\b)/i;

function extractWikiLinks(trimmed) {
    return [...String(trimmed).matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1].trim());
}

function mapsFromHeader(trimmed) {
    const plain = cleanWikiText(trimmed);
    const plainStart = plain.replace(/^\|\s*(?:rowspan\s*=\s*"?\d+"?\s*\|)?\s*/i, '').trim();

    const looksLikeConstraint =
        /\bOn\s+\[\[/i.test(trimmed) ||
        /\bOn\s+an\s+\[\[/i.test(trimmed) ||
        /\bduring\s+\[\[/i.test(trimmed) ||
        /\bOnly\s+on\s+/i.test(trimmed) ||
        /\bMaps?:\s*\[\[/i.test(trimmed) ||
        /\(on\s+\[\[/i.test(trimmed) ||
        (/^on\b/i.test(plainStart) && /\[\[/.test(trimmed));

    if (!looksLikeConstraint) return null;
    if (NON_MAP_ON.test(plainStart)) return null;

    // Prefer ALL wiki links in an On-… constraint cell (skip hero names).
    let maps = extractWikiLinks(trimmed).filter((name) => !HERO_NAMES.has(name.toLowerCase()));

    // Nested spawn-room pattern: On an [[MV-261 Orca]] Spawn Room Map ([[Ilios]], …)
    // Keep vehicle/room + nested maps.

    if (!maps.length) {
        const m = plainStart.match(/^(?:on(?:\s+an)?|during|only on)\s+(.+)$/i);
        if (m) {
            let rest = m[1].replace(/\b(REMOVED|Generic|Team Kill.*)$/i, '').trim();
            const parsed = [];
            for (const place of KNOWN_PLACES) {
                const re = new RegExp(place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                if (re.test(rest)) parsed.push(place);
            }
            if (parsed.length) maps = parsed;
            else {
                maps = rest
                    .split(/\s*(?:,|&|\/|\bor\b|\band\b)\s*/i)
                    .map((s) => s.replace(/^on\s+/i, '').trim())
                    .filter(Boolean)
                    .filter((s) => !/^(generic|removed|team kill|during|an|spawn room map)$/i.test(s));
            }
        }
    }

    const cleaned = maps
        .map((name) => name.replace(/^(?:[A-Za-z0-9. ']+)\s+On\s+/i, '').trim())
        .map((name) => name.replace(/\s+REMOVED$/i, '').trim())
        .filter(Boolean)
        .filter((name) => !HERO_NAMES.has(name.toLowerCase()))
        .filter((name) => !/^(overwatch|talon|null sector|generic|removed|spawn room map)$/i.test(name));

    if (!cleaned.length) return null;

    const isHeaderCell =
        /<center>/i.test(trimmed) ||
        /rowspan/i.test(trimmed) ||
        /^\|/i.test(trimmed.trim()) ||
        /\(on\s+\[\[/i.test(trimmed);
    if (!isHeaderCell && !/^on\b/i.test(plainStart) && !/^during\b/i.test(plainStart)) return null;

    return [...new Set(cleaned)];
}

function splitInteractionSections(wikitext) {
    const sections = String(wikitext || '').split(/\n(?=={2}\s*[^=].*?={2}\s*$)/m);
    const bodies = [];
    for (const part of sections) {
        const match = part.match(/^={2}\s*([^=]+?)\s*={2}\s*\n?([\s\S]*)$/);
        if (!match) continue;
        const title = match[1].trim();
        if (/^interactions/i.test(title)) bodies.push({ title, body: match[2] || '' });
    }
    return bodies;
}

function parseMapAwareExchanges(body, pageHero) {
    const exchanges = [];
    let current = [];
    let mapSlotsRemaining = 0;
    /** @type {string[]} */
    let currentMaps = [];
    let headerSource = '';

    const flush = () => {
        if (current.length < 2) {
            current = [];
            return;
        }
        const speakers = [...new Set(current.map((l) => l.hero))];
        if (speakers.length < 2 || current.length > 12 || speakers.length > 5) {
            current = [];
            return;
        }
        const texts = current.map((l) => l.text.toLowerCase()).join(' ');
        if (texts.includes('favorite animal')) {
            current = [];
            return;
        }
        const keys = current.map((l) => coreKey(l.text)).filter((k) => k.length >= 6);
        if (currentMaps.length) {
            exchanges.push({
                pageHero,
                maps: [...currentMaps],
                headerSource,
                speakers,
                lines: current,
                keys,
                preview: current.map((l) => `${l.hero}: ${l.text}`).join(' / '),
            });
        }
        if (mapSlotsRemaining > 0) {
            mapSlotsRemaining -= 1;
            if (mapSlotsRemaining <= 0) {
                currentMaps = [];
                headerSource = '';
            }
        } else if (currentMaps.length) {
            currentMaps = [];
            headerSource = '';
        }
        current = [];
    };

    for (const rawLine of String(body || '').split(/\n/)) {
        const trimmed = rawLine.trim();
        if (trimmed === '|-' || trimmed === '|}') {
            flush();
            continue;
        }

        if (trimmed.startsWith('|') || /<center>/i.test(trimmed) || /\(on\s+\[\[/i.test(trimmed)) {
            const maps = mapsFromHeader(trimmed);
            if (maps) {
                const rowspan = trimmed.match(/rowspan\s*=\s*"?(\d+)"?/i);
                mapSlotsRemaining = rowspan ? Number(rowspan[1]) : 1;
                currentMaps = maps;
                headerSource = cleanWikiText(trimmed).slice(0, 160);
            }
            if (!/^\*+\s*'''/.test(trimmed)) continue;
        }

        const m = rawLine.match(/^\*+\s*'''([^']+?)'''\s*:?\s*(.+)$/);
        if (!m) continue;
        const text = cleanWikiText(m[2]);
        if (!text || text.length < 3) continue;
        const hero = normalizeHero(m[1].trim().replace(/:$/, ''));
        current.push({ hero, text });
    }
    flush();
    return exchanges;
}

function conversationLineKeys(conversation) {
    const rows = [];
    for (const line of conversation.lines || []) {
        const sub = stripDialogueSubtitleMarkup(String(line.subtitles || '')).trim();
        let key = coreKey(sub);
        if (!key || key.length < 6) {
            const voice = String(line.voice || '');
            const idx = voice.indexOf('_-_');
            if (idx >= 0) key = coreKey(voice.slice(idx + 3).replace(/_/g, ' '));
        }
        if (!key || key.length < 6) continue;
        rows.push(key);
    }
    return rows;
}

function heroSetKey(names) {
    return [...new Set((names || []).map((h) => normalizeHero(h).toLowerCase()))].sort().join('|');
}

function scoreExchangeVsConv(exchange, conversation) {
    const convKeys = conversationLineKeys(conversation);
    if (convKeys.length < 2) return 0;
    const exKeys = exchange.keys.filter((k) => k.length >= 8);
    if (exKeys.length < 1) return 0;

    let hits = 0;
    for (const key of exKeys) {
        if (convKeys.includes(key)) {
            hits += 1;
            continue;
        }
        const near = convKeys.some((ck) => {
            const shorter = Math.min(ck.length, key.length);
            if (shorter < 12) return false;
            return (
                ck.startsWith(key) ||
                key.startsWith(ck) ||
                ck.includes(key.slice(0, 16)) ||
                key.includes(ck.slice(0, 16))
            );
        });
        if (near) hits += 1;
    }
    let ratio = hits / exKeys.length;

    // Speaker overlap bonus / penalty
    const convHeroes = heroSetKey((conversation.lines || []).map((l) => l.hero));
    const exHeroes = heroSetKey(exchange.speakers);
    const convSet = new Set(convHeroes.split('|').filter(Boolean));
    const exSet = new Set(exHeroes.split('|').filter(Boolean));
    let overlap = 0;
    for (const h of exSet) if (convSet.has(h)) overlap += 1;
    if (overlap >= 2) ratio += 0.15;
    else if (overlap === 1) ratio += 0.05;
    else ratio -= 0.25;

    return Math.max(0, Math.min(1.2, ratio));
}

function normalizeMapChoices(maps) {
    // Drop event-only labels that aren't maps? Keep Winter Wonderland if wiki listed it with Blizzard World.
    return normalizeDialogueTheaterChoiceList(
        maps.map((m) => String(m).replace(/\s+REMOVED$/i, '').trim()).filter(Boolean),
    );
}

// ---- main ----
const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const conversations = (data.conversations || []).filter(
    (c) => !c.entryType || c.entryType === 'dialogue',
);

const cacheFiles = fs
    .readdirSync(CACHE)
    .filter((f) => /quotes\.wikitext$/i.test(f) || f.endsWith('.wikitext'));

/** @type {object[]} */
const mapExchanges = [];
for (const cacheFile of cacheFiles) {
    const pageHero = cacheFile
        .replace(/_Quotes\.wikitext$/i, '')
        .replace(/\.wikitext$/i, '')
        .replace(/_/g, ' ')
        .replace(/^Soldier\s+76$/i, 'Soldier 76');
    const wikitext = fs.readFileSync(path.join(CACHE, cacheFile), 'utf8');
    for (const sec of splitInteractionSections(wikitext)) {
        for (const ex of parseMapAwareExchanges(sec.body, pageHero)) {
            mapExchanges.push(ex);
        }
    }
}

const byFp = new Map();
for (const ex of mapExchanges) {
    const fp = ex.keys.slice(0, 6).join('|');
    if (!byFp.has(fp)) byFp.set(fp, { ...ex, pages: [ex.pageHero] });
    else {
        const row = byFp.get(fp);
        if (!row.pages.includes(ex.pageHero)) row.pages.push(ex.pageHero);
        for (const m of ex.maps) if (!row.maps.includes(m)) row.maps.push(m);
    }
}
const unique = [...byFp.values()];

const matched = [];
const unmatched = [];
for (const ex of unique) {
    let best = null;
    for (const conv of conversations) {
        const ratio = scoreExchangeVsConv(ex, conv);
        if (ratio >= 0.55 && (!best || ratio > best.ratio)) best = { conv, ratio };
    }
    if (best) {
        matched.push({
            conversationId: best.conv.id,
            conversationName: best.conv.name,
            ratio: best.ratio,
            maps: normalizeMapChoices(ex.maps),
            headerSource: ex.headerSource,
            pages: ex.pages,
            speakers: ex.speakers,
            preview: ex.preview.slice(0, 220),
        });
    } else {
        unmatched.push({
            maps: ex.maps,
            pages: ex.pages,
            speakers: ex.speakers,
            preview: ex.preview.slice(0, 220),
            headerSource: ex.headerSource,
        });
    }
}

/** @type {Map<string, { maps: Set<string>, pages: Set<string>, ratio: number, name: string, preview: string, header: string }>} */
const byId = new Map();
for (const row of matched) {
    if (!byId.has(row.conversationId)) {
        byId.set(row.conversationId, {
            maps: new Set(row.maps),
            pages: new Set(row.pages),
            ratio: row.ratio,
            name: row.conversationName,
            preview: row.preview,
            header: row.headerSource,
        });
    } else {
        const cur = byId.get(row.conversationId);
        for (const m of row.maps) cur.maps.add(m);
        for (const p of row.pages) cur.pages.add(p);
        if (row.ratio > cur.ratio) {
            cur.ratio = row.ratio;
            cur.preview = row.preview;
            cur.header = row.headerSource;
        }
    }
}

const convById = new Map(conversations.map((c) => [c.id, c]));
const tagged = [];
let taggedNow = 0;
let updatedChoices = 0;

for (const [id, info] of byId) {
    const c = convById.get(id);
    if (!c) continue;
    const maps = normalizeMapChoices([...info.maps]);
    if (!maps.length) continue;

    const tags = new Set(Array.isArray(c.tags) ? c.tags : ['Overwatch']);
    tags.add(MAP_TAG);
    // drop legacy if present (finalize also remaps)
    tags.delete('Map Exclusive');
    const hasPaths = Array.isArray(c.paths) && c.paths.length > 0;
    const nextTags = finalizeDialogueTheaterTags([...tags], hasPaths);

    const hadTag = (c.tags || []).includes(MAP_TAG) || (c.tags || []).includes('Map Exclusive');
    const prevChoices = normalizeDialogueTheaterChoiceList(c.mapChoices || []);
    const choicesChanged =
        prevChoices.length !== maps.length || prevChoices.some((m, i) => m !== maps[i]);

    if (!DRY_RUN) {
        c.tags = nextTags;
        c.mapChoices = maps;
    }
    if (!hadTag) taggedNow += 1;
    if (choicesChanged) updatedChoices += 1;

    tagged.push({
        id,
        name: c.name,
        maps,
        pages: [...info.pages],
        ratio: info.ratio,
        tags: nextTags,
        preview: info.preview,
        header: info.header,
    });
}

tagged.sort((a, b) => a.name.localeCompare(b.name));

if (!DRY_RUN) {
    if (!data._meta) data._meta = {};
    data._meta.tagsResetAt = new Date().toISOString();
    fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

const report = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    summary: {
        wikiUniqueMapExchanges: unique.length,
        matchedConversations: tagged.length,
        unmatchedWikiExchanges: unmatched.length,
        newlyTagged: taggedNow,
        mapChoicesUpdated: updatedChoices,
    },
    tagged,
    unmatched,
};
fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report.summary, null, 2));
console.log(`\nTagged ${tagged.length} conversations (${DRY_RUN ? 'dry-run' : 'written'}):\n`);
for (const t of tagged) {
    console.log(`- ${t.name} → [${t.maps.join(', ')}] (${t.ratio.toFixed(2)})`);
}
if (unmatched.length) {
    console.log(`\nUnmatched (${unmatched.length}):`);
    for (const u of unmatched) {
        console.log(`- [${u.maps.join(', ')}] ${u.pages.join(',')}`);
        console.log(`  ${u.preview}`);
    }
}
console.log(`\nReport: ${OUT_JSON}`);
if (!DRY_RUN) console.log(`Wrote ${CONVERSATIONS_PATH}`);
