#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * 1) Persist voice-audit buckets into conversations.json _meta (theater-only etc.)
 * 2) Find wiki Interactions marked "On [[Map]]..." and tag matching Atlas
 *    conversations as "Map Exclusive".
 *
 * Usage:
 *   node scripts/tag-map-exclusive-and-voice-buckets.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CACHE = WIKI_QUOTES_CACHE_DIR;
const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const VOICE_AUDIT_PATH = auditPath('_audit-no-matchtalk-full-voice.json');
const OUT_MAP_JSON = auditPath('_audit-map-exclusive.json');
const OUT_MAP_CSV = auditPath('_audit-map-exclusive.csv');

const WIKI_CACHE_FILES = {
    Ana: 'Ana.wikitext',
    Anran: 'Anran.wikitext',
    Ashe: 'Ashe.wikitext',
    Baptiste: 'Baptiste.wikitext',
    Bastion: 'Bastion.wikitext',
    Brigitte: 'Brigitte.wikitext',
    Cassidy: 'Cassidy.wikitext',
    'D.Va': 'D.Va.wikitext',
    Domina: 'Domina.wikitext',
    Doomfist: 'Doomfist.wikitext',
    Echo: 'Echo.wikitext',
    Emre: 'Emre.wikitext',
    Freja: 'Freja.wikitext',
    Genji: 'Genji.wikitext',
    Hanzo: 'Hanzo.wikitext',
    Hazard: 'Hazard.wikitext',
    Illari: 'Illari.wikitext',
    'Junker Queen': 'Junker_Queen.wikitext',
    Junkrat: 'Junkrat.wikitext',
    Juno: 'Juno.wikitext',
    Kiriko: 'Kiriko.wikitext',
    Lifeweaver: 'Lifeweaver.wikitext',
    Lúcio: 'Lúcio.wikitext',
    Mauga: 'Mauga.wikitext',
    Mei: 'Mei.wikitext',
    Mercy: 'Mercy.wikitext',
    Mizuki: 'Mizuki.wikitext',
    Moira: 'Moira.wikitext',
    Orisa: 'Orisa.wikitext',
    Pharah: 'Pharah.wikitext',
    Ramattra: 'Ramattra.wikitext',
    Reaper: 'Reaper.wikitext',
    Reinhardt: 'Reinhardt.wikitext',
    Roadhog: 'Roadhog.wikitext',
    Shion: 'Shion.wikitext',
    Sierra: 'Sierra.wikitext',
    Sigma: 'Sigma.wikitext',
    Sojourn: 'Sojourn.wikitext',
    'Soldier 76': 'Soldier__76.wikitext',
    Sombra: 'Sombra.wikitext',
    Symmetra: 'Symmetra.wikitext',
    Torbjörn: 'Torbjörn.wikitext',
    Tracer: 'Tracer.wikitext',
    Vendetta: 'Vendetta.wikitext',
    Venture: 'Venture.wikitext',
    Widowmaker: 'Widowmaker.wikitext',
    Winston: 'Winston.wikitext',
    'Wrecking Ball': 'Wrecking_Ball.wikitext',
    Wuyang: 'Wuyang.wikitext',
    Zarya: 'Zarya.wikitext',
    Zenyatta: 'Zenyatta.wikitext',
};

const MAP_TAG = 'Map Exclusive';

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

function extractMapsFromHeader(trimmed) {
    // "On [[Esperança]], [[Ilios]] or [[Samoa]]" / "On [[Havana]] & [[Paraíso]]"
    // Also "during [[Winter Wonderland]]" — keep as map/event context
    if (!/\bOn\s+\[\[/i.test(trimmed) && !/\bOn\s+'''?\[\[/i.test(trimmed)) {
        // after bold strip sometimes: On [[Map]]
        if (!/\bOn\s+/i.test(trimmed) || !/\[\[/.test(trimmed)) return null;
    }
    const plain = cleanWikiText(trimmed);
    // Must look like a map constraint header, not dialogue
    if (!/^on\b/i.test(plain.trim()) && !/on\s+[A-Z]/i.test(plain)) {
        // center cells usually start with On after clean
    }
    if (!/\bon\b/i.test(plain)) return null;
    // Reject chatter like "On Fire", "On My Way", "On second thought"
    if (/^on (fire|my way|the (attack|point|move|payload|table|backlog)|second thought)\b/i.test(plain)) {
        return null;
    }
    const maps = [];
    const re = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
    let m;
    while ((m = re.exec(trimmed))) {
        const title = m[1].trim();
        // Skip hero links that appear in same cell as map (partner + On Map pattern)
        // Heuristic: if the match is immediately after "On " or after or/&/, keep it.
        const before = trimmed.slice(Math.max(0, m.index - 12), m.index);
        if (/\bOn\s*$/i.test(before) || /\b(?:or|&|,)\s*$/i.test(before) || /during\s*$/i.test(before)) {
            maps.push(title);
        } else if (/^On\b/i.test(plain) && maps.length === 0) {
            // first wiki link after On in a map-only cell
            maps.push(title);
        }
    }
    // Fallback: if cell is primarily "On Map..." take all links
    if (!maps.length && /^on\b/i.test(plain.trim())) {
        const all = [...trimmed.matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g)].map((x) => x[1].trim());
        maps.push(...all);
    }
    // Filter out obvious non-maps (heroes sometimes wrongly captured)
    const heroish = new Set(
        Object.keys(WIKI_CACHE_FILES).map((h) => h.toLowerCase()).concat(['soldier: 76', 'bastion', 'echo']),
    );
    const filtered = maps.filter((name) => {
        const low = name.toLowerCase();
        if (heroish.has(low)) return false;
        if (/^(overwatch|talon|null sector|winter wonderland)$/i.test(name)) {
            // Winter Wonderland is event — keep as context
            return /winter wonderland/i.test(name);
        }
        return true;
    });
    if (!filtered.length) return null;
    // Require the cleaned text to start with On (map header cell)
    if (!/^on\b/i.test(plain.trim()) && !/<center>.*\bon\s+\[\[/i.test(trimmed)) return null;
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
    let removedSlots = 0;
    let currentRemoved = false;

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
        exchanges.push({
            pageHero,
            maps: [...currentMaps],
            mapExclusive: currentMaps.length > 0,
            removed: currentRemoved,
            speakers,
            lines: current,
            keys,
            preview: current.map((l) => `${l.hero}: ${l.text}`).join(' / '),
        });
        if (mapSlotsRemaining > 0) {
            mapSlotsRemaining -= 1;
            if (mapSlotsRemaining <= 0) currentMaps = [];
        } else if (currentMaps.length) {
            currentMaps = [];
        }
        if (currentRemoved) {
            if (removedSlots > 0) {
                removedSlots -= 1;
                if (removedSlots <= 0) currentRemoved = false;
            } else {
                currentRemoved = false;
            }
        }
        current = [];
    };

    for (const rawLine of String(body || '').split(/\n/)) {
        const trimmed = rawLine.trim();
        if (trimmed === '|-' || trimmed === '|}') {
            flush();
            continue;
        }

        if (trimmed.startsWith('|') || /<center>/i.test(trimmed)) {
            const maps = extractMapsFromHeader(trimmed);
            if (maps) {
                const rowspan = trimmed.match(/rowspan\s*=\s*"?(\d+)"?/i);
                mapSlotsRemaining = rowspan ? Number(rowspan[1]) : 1;
                currentMaps = maps;
                // continue — may also have REMOVED in same cell
            }
            if (/removed/i.test(trimmed) && !/removed set-up chatter/i.test(trimmed)) {
                const isDialogue = /^\*+\s*'''/.test(trimmed);
                if (!isDialogue) {
                    const rowspan = trimmed.match(/rowspan\s*=\s*"?(\d+)"?/i);
                    removedSlots = rowspan ? Number(rowspan[1]) : Math.max(removedSlots, 1);
                    currentRemoved = true;
                }
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

// ---- main ----
const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const conversations = data.conversations || [];
const voiceAudit = fs.existsSync(VOICE_AUDIT_PATH)
    ? JSON.parse(fs.readFileSync(VOICE_AUDIT_PATH, 'utf8'))
    : null;

/** @type {object[]} */
const mapExchanges = [];
for (const [pageHero, cacheFile] of Object.entries(WIKI_CACHE_FILES)) {
    const full = path.join(CACHE, cacheFile);
    if (!fs.existsSync(full)) continue;
    const wikitext = fs.readFileSync(full, 'utf8');
    for (const sec of splitInteractionSections(wikitext)) {
        for (const ex of parseMapAwareExchanges(sec.body, pageHero)) {
            if (ex.mapExclusive) mapExchanges.push(ex);
        }
    }
}

// Dedupe by key fingerprint
const byFp = new Map();
for (const ex of mapExchanges) {
    const fp = ex.keys.slice(0, 5).join('|');
    if (!byFp.has(fp)) byFp.set(fp, { ...ex, pages: [ex.pageHero] });
    else {
        const row = byFp.get(fp);
        if (!row.pages.includes(ex.pageHero)) row.pages.push(ex.pageHero);
        // merge maps
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
        if (ratio >= 0.6 && (!best || ratio > best.ratio)) best = { conv, ratio };
    }
    if (best) {
        matched.push({
            conversationId: best.conv.id,
            conversationName: best.conv.name,
            tags: best.conv.tags || [],
            maps: ex.maps,
            pages: ex.pages,
            ratio: best.ratio,
            removed: ex.removed,
            preview: ex.preview.slice(0, 200),
        });
    } else {
        unmatched.push({
            maps: ex.maps,
            pages: ex.pages,
            speakers: ex.speakers,
            preview: ex.preview.slice(0, 200),
        });
    }
}

// Tag Map Exclusive on matched conversations (unique by id)
const byId = new Map(conversations.map((c) => [c.id, c]));
const toTag = new Map();
for (const row of matched) {
    if (!toTag.has(row.conversationId)) {
        toTag.set(row.conversationId, { maps: new Set(row.maps), pages: new Set(row.pages) });
    } else {
        const t = toTag.get(row.conversationId);
        for (const m of row.maps) t.maps.add(m);
        for (const p of row.pages) t.pages.add(p);
    }
}

let taggedNow = 0;
let alreadyHad = 0;
const taggedNames = [];
for (const [id, info] of toTag) {
    const c = byId.get(id);
    if (!c) continue;
    if (!Array.isArray(c.tags)) c.tags = ['Overwatch'];
    if (c.tags.includes(MAP_TAG)) {
        alreadyHad += 1;
    } else {
        c.tags.push(MAP_TAG);
        taggedNow += 1;
    }
    taggedNames.push({
        name: c.name,
        id: c.id,
        maps: [...info.maps],
        pages: [...info.pages],
        tags: [...c.tags],
    });
}

// Voice audit buckets into _meta (no Removed tagging for theater-only)
if (!data._meta) data._meta = {};
data._meta.tagsResetAt = new Date().toISOString();

if (voiceAudit) {
    const bucket = (list) =>
        (list || []).map((r) => ({
            id: r.conversationId,
            name: r.conversationName,
            buckets: r.buckets || [],
            theaterHits: r.theaterHits,
            lineCount: r.lineCount,
        }));
    data._meta.voiceAuditBuckets = {
        updatedAt: voiceAudit.generatedAt || new Date().toISOString(),
        summary: voiceAudit.summary?.byCategory || {},
        falseNegativeMatchTalk: bucket(voiceAudit.falseNegatives),
        foundOutsideMatchTalk: bucket(voiceAudit.foundOutsideMatchTalk),
        partialExtract: bucket(voiceAudit.partial),
        /** Wired in Theater but not found in any HeroVoice extract — confirm before Removed */
        theaterOnlyNoExtract: bucket(voiceAudit.theaterOnly),
        trulyMissing: bucket(voiceAudit.trulyMissing),
    };
}

const mapReport = {
    generatedAt: new Date().toISOString(),
    summary: {
        wikiMapExclusiveExchangesRaw: mapExchanges.length,
        wikiMapExclusiveUnique: uniqueMapExchanges.length,
        matchedToAtlas: matched.length,
        unmatched: unmatched.length,
        conversationsTaggedNow: taggedNow,
        conversationsAlreadyHadTag: alreadyHad,
        conversationsWithMapExclusiveTag: taggedNames.length,
    },
    tagged: taggedNames.sort((a, b) => a.name.localeCompare(b.name)),
    matched,
    unmatched,
};

fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(OUT_MAP_JSON, JSON.stringify(mapReport, null, 2) + '\n');

const csv = [
    ['name', 'maps', 'pages', 'tags', 'ratio', 'preview'].join(','),
    ...matched
        .sort((a, b) => a.conversationName.localeCompare(b.conversationName))
        .map((r) =>
            [
                csvEscape(r.conversationName),
                csvEscape(r.maps.join(' | ')),
                csvEscape(r.pages.join(' | ')),
                csvEscape((r.tags || []).concat(r.tags?.includes(MAP_TAG) ? [] : [MAP_TAG]).join('|')),
                r.ratio.toFixed(2),
                csvEscape(r.preview),
            ].join(','),
        ),
].join('\n');
fs.writeFileSync(OUT_MAP_CSV, csv + '\n');

console.log('=== Voice buckets (_meta.voiceAuditBuckets) ===');
if (data._meta.voiceAuditBuckets) {
    const s = data._meta.voiceAuditBuckets.summary;
    console.log(s);
    console.log('theaterOnlyNoExtract:', data._meta.voiceAuditBuckets.theaterOnlyNoExtract.length);
}

console.log('\n=== Map Exclusive ===');
console.log(mapReport.summary);
console.log('\nTagged conversations:');
for (const t of taggedNames) {
    console.log(` - ${t.name} | maps: ${t.maps.join(', ')} | pages: ${t.pages.join(', ')}`);
}
console.log('\nUnmatched wiki map exchanges:');
for (const u of unmatched) {
    console.log(` - maps=${u.maps.join(', ')} pages=${u.pages.join(', ')}`);
    console.log(`   ${u.preview}`);
}
console.log(`\nWrote ${CONVERSATIONS_PATH}`);
console.log(`Wrote ${OUT_MAP_JSON}`);
