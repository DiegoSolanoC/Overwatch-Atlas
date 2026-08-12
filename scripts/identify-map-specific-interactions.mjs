/**
 * Identify-only: scan all cached hero Quotes wikitext for Interaction rows
 * marked map-specific (On [[Map]]… and alternate formats). Match to Atlas
 * Overwatch-era dialogue entries. Does NOT modify conversations.json.
 *
 * Usage: node scripts/identify-map-specific-interactions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

ensureAuditWorkspace();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CACHE = WIKI_QUOTES_CACHE_DIR;
const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const OUT_JSON = auditPath('_identify-map-specific.json');
const OUT_CSV = auditPath('_identify-map-specific.csv');

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
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
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const HERO_NAMES = new Set(
    fs
        .readdirSync(CACHE)
        .filter((f) => f.endsWith('_Quotes.wikitext') || f.endsWith('.wikitext'))
        .map((f) =>
            f
                .replace(/_Quotes\.wikitext$/i, '')
                .replace(/\.wikitext$/i, '')
                .replace(/_/g, ' ')
                .replace(/^Soldier\s+76$/i, 'Soldier 76')
                .replace(/^Soldier:\s*76$/i, 'Soldier 76'),
        )
        .map((h) => h.toLowerCase()),
);

const NON_MAP_ON = /^(on (fire|my way|the (attack|point|move|payload|table|backlog|objective)|second thought|it|team|our|me|you)\b)/i;

function extractMapsFromHeader(trimmed) {
    const plain = cleanWikiText(trimmed);
    const plainStart = plain.trim();

    // Primary: On [[Map]]…
    // Alternates: during [[Event/Map]], Only on [[Map]], Map-specific: [[Map]], (on [[Map]])
    const looksLikeConstraint =
        /\bOn\s+\[\[/i.test(trimmed) ||
        /\bOn\s+'''?\s*\[\[/i.test(trimmed) ||
        /\bduring\s+\[\[/i.test(trimmed) ||
        /\bOnly\s+on\s+/i.test(trimmed) ||
        /\bMaps?:\s*\[\[/i.test(trimmed) ||
        /\(on\s+\[\[/i.test(trimmed) ||
        (/^on\b/i.test(plainStart) && /\[\[/.test(trimmed));

    if (!looksLikeConstraint) return null;
    if (NON_MAP_ON.test(plainStart)) return null;

    const maps = [];
    const re = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
    let m;
    while ((m = re.exec(trimmed))) {
        const title = m[1].trim();
        const before = trimmed.slice(Math.max(0, m.index - 16), m.index);
        if (
            /\bOn\s*$/i.test(before) ||
            /\b(?:or|&|,|and|\/)\s*$/i.test(before) ||
            /during\s*$/i.test(before) ||
            /only\s+on\s*$/i.test(before) ||
            /maps?:\s*$/i.test(before) ||
            /\(\s*on\s*$/i.test(before)
        ) {
            maps.push(title);
        }
    }
    if (!maps.length && (/^on\b/i.test(plainStart) || /^during\b/i.test(plainStart) || /^only on\b/i.test(plainStart))) {
        maps.push(
            ...[...trimmed.matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g)].map((x) => x[1].trim()),
        );
    }

    const filtered = maps.filter((name) => {
        const low = name.toLowerCase();
        if (HERO_NAMES.has(low)) return false;
        if (/^(overwatch|talon|null sector)$/i.test(name)) return false;
        return true;
    });
    if (!filtered.length) return null;

    // Prefer header cells (center / rowspan), but allow italic parenthetical notes too
    const isHeaderCell =
        /<center>/i.test(trimmed) ||
        /rowspan/i.test(trimmed) ||
        /^\|/i.test(trimmed.trim()) ||
        /\(on\s+\[\[/i.test(trimmed);
    if (!isHeaderCell && !/^on\b/i.test(plainStart) && !/^during\b/i.test(plainStart)) return null;

    return filtered;
}

function splitInteractionSections(wikitext) {
    const sections = String(wikitext || '').split(/\n(?=={2}\s*[^=].*?={2}\s*$)/m);
    const bodies = [];
    for (const part of sections) {
        const match = part.match(/^={2}\s*([^=]+?)\s*={2}\s*\n?([\s\S]*)$/);
        if (!match) continue;
        const title = match[1].trim();
        if (/^interactions/i.test(title)) {
            bodies.push({ title, body: match[2] || '' });
        }
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
        const keys = current.map((l) => coreKey(l.text)).filter((k) => k.length >= 8);
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
            const maps = extractMapsFromHeader(trimmed);
            if (maps) {
                const rowspan = trimmed.match(/rowspan\s*=\s*"?(\d+)"?/i);
                mapSlotsRemaining = rowspan ? Number(rowspan[1]) : 1;
                currentMaps = maps;
                headerSource = cleanWikiText(trimmed).slice(0, 120);
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

function scoreExchangeVsConv(exchange, conversation) {
    const convKeys = conversationLineKeys(conversation);
    if (convKeys.length < 2) return 0;
    const exKeys = exchange.keys.filter((k) => k.length >= 10);
    if (exKeys.length < 2) return 0;
    let hits = 0;
    for (const key of exKeys) {
        if (convKeys.includes(key)) {
            hits += 1;
            continue;
        }
        const near = convKeys.some((ck) => {
            const shorter = Math.min(ck.length, key.length);
            if (shorter < 14) return false;
            return (
                ck.startsWith(key) ||
                key.startsWith(ck) ||
                ck.includes(key.slice(0, 18)) ||
                key.includes(ck.slice(0, 18))
            );
        });
        if (near) hits += 1;
    }
    return hits / exKeys.length;
}

function csvEscape(v) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const conversations = (data.conversations || []).filter(
    (c) => !c.entryType || c.entryType === 'dialogue',
);

const cacheFiles = fs.readdirSync(CACHE).filter((f) => /quotes\.wikitext$/i.test(f) || f.endsWith('.wikitext'));
/** @type {object[]} */
const mapExchanges = [];
/** @type {{file:string, line:string}[]} */
const rawHeaderHits = [];

for (const cacheFile of cacheFiles) {
    const pageHero = cacheFile
        .replace(/_Quotes\.wikitext$/i, '')
        .replace(/\.wikitext$/i, '')
        .replace(/_/g, ' ')
        .replace(/^Soldier\s+76$/i, 'Soldier 76');
    const full = path.join(CACHE, cacheFile);
    const wikitext = fs.readFileSync(full, 'utf8');

    // Raw header inventory (Interactions only preferred, but also log outside for format discovery)
    for (const line of wikitext.split(/\n/)) {
        if (
            /\bOn\s+\[\[/i.test(line) ||
            /\bduring\s+\[\[/i.test(line) ||
            /\bOnly\s+on\s+/i.test(line) ||
            /\(on\s+\[\[/i.test(line)
        ) {
            const plain = cleanWikiText(line);
            if (NON_MAP_ON.test(plain)) continue;
            rawHeaderHits.push({ file: cacheFile, line: line.trim().slice(0, 200) });
        }
    }

    for (const sec of splitInteractionSections(wikitext)) {
        for (const ex of parseMapAwareExchanges(sec.body, pageHero)) {
            mapExchanges.push(ex);
        }
    }
}

const byFp = new Map();
for (const ex of mapExchanges) {
    const fp = ex.keys.slice(0, 5).join('|');
    if (!byFp.has(fp)) byFp.set(fp, { ...ex, pages: [ex.pageHero] });
    else {
        const row = byFp.get(fp);
        if (!row.pages.includes(ex.pageHero)) row.pages.push(ex.pageHero);
        for (const m of ex.maps) if (!row.maps.includes(m)) row.maps.push(m);
    }
}
const uniqueMapExchanges = [...byFp.values()];

const matched = [];
const unmatched = [];
for (const ex of uniqueMapExchanges) {
    let best = null;
    for (const conv of conversations) {
        const ratio = scoreExchangeVsConv(ex, conv);
        if (ratio >= 0.55 && (!best || ratio > best.ratio)) best = { conv, ratio };
    }
    if (best) {
        matched.push({
            conversationId: best.conv.id,
            conversationName: best.conv.name,
            status: best.conv.status,
            tags: best.conv.tags || [],
            maps: ex.maps,
            wikiHeader: ex.headerSource,
            pages: ex.pages,
            speakers: ex.speakers,
            ratio: best.ratio,
            preview: ex.preview.slice(0, 240),
        });
    } else {
        unmatched.push({
            maps: ex.maps,
            wikiHeader: ex.headerSource,
            pages: ex.pages,
            speakers: ex.speakers,
            preview: ex.preview.slice(0, 240),
        });
    }
}

// Dedupe matched by conversation id (keep highest ratio / merge maps)
const matchedById = new Map();
for (const row of matched) {
    if (!matchedById.has(row.conversationId)) {
        matchedById.set(row.conversationId, {
            ...row,
            maps: [...row.maps],
            pages: [...row.pages],
        });
    } else {
        const cur = matchedById.get(row.conversationId);
        for (const m of row.maps) if (!cur.maps.includes(m)) cur.maps.push(m);
        for (const p of row.pages) if (!cur.pages.includes(p)) cur.pages.push(p);
        if (row.ratio > cur.ratio) {
            cur.ratio = row.ratio;
            cur.preview = row.preview;
            cur.wikiHeader = row.wikiHeader;
        }
    }
}
const matchedUnique = [...matchedById.values()].sort((a, b) =>
    a.conversationName.localeCompare(b.conversationName),
);

const report = {
    generatedAt: new Date().toISOString(),
    note: 'Identify-only. No conversations.json writes.',
    summary: {
        cacheFiles: cacheFiles.length,
        rawHeaderLikeLines: rawHeaderHits.length,
        wikiMapExclusiveExchangesRaw: mapExchanges.length,
        wikiMapExclusiveUnique: uniqueMapExchanges.length,
        matchedAtlasConversations: matchedUnique.length,
        unmatchedWikiExchanges: unmatched.length,
    },
    matched: matchedUnique,
    unmatched,
    sampleRawHeaders: rawHeaderHits.slice(0, 40),
};

fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
const csv = [
    ['theater_name', 'status', 'tags', 'locations', 'wiki_header', 'wiki_pages', 'ratio', 'preview'].join(','),
    ...matchedUnique.map((r) =>
        [
            csvEscape(r.conversationName),
            csvEscape(r.status),
            csvEscape((r.tags || []).join('|')),
            csvEscape(r.maps.join(' | ')),
            csvEscape(r.wikiHeader || ''),
            csvEscape(r.pages.join(' | ')),
            r.ratio.toFixed(2),
            csvEscape(r.preview),
        ].join(','),
    ),
].join('\n');
fs.writeFileSync(OUT_CSV, `${csv}\n`);

console.log(JSON.stringify(report.summary, null, 2));
console.log(`\nMatched ${matchedUnique.length} Atlas conversations:\n`);
for (const r of matchedUnique) {
    console.log(`- ${r.conversationName}  [${r.maps.join(', ')}]  (${r.tags.join(', ')})`);
}
console.log(`\nUnmatched wiki exchanges: ${unmatched.length}`);
for (const u of unmatched.slice(0, 30)) {
    console.log(`- [${u.maps.join(', ')}] pages=${u.pages.join(',')}`);
    console.log(`  ${u.preview}`);
}
if (unmatched.length > 30) console.log(`  … +${unmatched.length - 30} more`);
console.log(`\nWrote ${OUT_JSON}`);
console.log(`Wrote ${OUT_CSV}`);
