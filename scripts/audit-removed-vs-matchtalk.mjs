#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Cross-check conversations against:
 *  1) Wiki Interactions marked REMOVED
 *  2) MatchTalk extract coverage (line audio present under HeroVoice MatchTalk folders)
 *  3) Overlap of (1) and (2)
 *
 * Usage:
 *   node scripts/audit-removed-vs-matchtalk.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CACHE_DIR = WIKI_QUOTES_CACHE_DIR;
const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const OUT_JSON = auditPath('_audit-removed-vs-matchtalk.json');
const OUT_CSV = auditPath('_audit-removed-vs-matchtalk.csv');

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

/** HeroVoice folder names for MatchTalk scan */
const MATCHTALK_FOLDERS = [
    'Ana', 'Anran', 'Ashe', 'Baptiste', 'Bastion', 'Brigitte', 'Cassidy', 'D.Va', 'Domina',
    'Doomfist', 'Echo', 'Emre', 'Freja', 'Genji', 'Hanzo', 'Hazard', 'Illari', 'Jetpack Cat',
    'Junker Queen', 'Junkrat', 'Juno', 'Kiriko', 'Lifeweaver', 'Lúcio', 'Mauga', 'Mei', 'Mercy',
    'Mizuki', 'Moira', 'Orisa', 'Pharah', 'Ramattra', 'Reaper', 'Reinhardt', 'Roadhog', 'Shion',
    'Sierra', 'Sigma', 'Sojourn', 'Soldier_ 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer',
    'Vendetta', 'Venture', 'Widowmaker', 'Winston', 'Wrecking Ball', 'Wuyang', 'Zarya', 'Zenyatta',
];

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeHero(name) {
    return String(name || '')
        .trim()
        .replace(/^Soldier:\s*/i, 'Soldier ')
        .replace(/^Soldier_+\s*/i, 'Soldier ')
        .replace(/\s+/g, ' ');
}

function heroKey(name) {
    return normalizeHero(name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

function splitInteractionsBody(wikitext) {
    const sections = String(wikitext || '').split(/\n(?=={2}\s*[^=].*?={2}\s*$)/m);
    for (const part of sections) {
        const match = part.match(/^={2}\s*([^=]+?)\s*={2}\s*\n?([\s\S]*)$/);
        if (!match) continue;
        if (/^interactions$/i.test(match[1].trim())) return match[2] || '';
    }
    return '';
}

/**
 * Parse Interactions table into exchanges, with removed flag from header cells.
 * @param {string} body
 * @param {string} pageHero
 */
function parseRemovedAwareExchanges(body, pageHero) {
    /** @type {Array<object>} */
    const exchanges = [];
    /** @type {Array<{ hero: string, text: string }>} */
    let current = [];
    let removedSlotsRemaining = 0;
    let currentIsRemoved = false;

    const flush = () => {
        if (current.length < 2) {
            current = [];
            return;
        }
        const speakers = [...new Set(current.map((l) => l.hero))];
        if (speakers.length < 2 || current.length > 10 || speakers.length > 4) {
            current = [];
            return;
        }
        const texts = current.map((l) => l.text.toLowerCase()).join(' ');
        if (texts.includes('favorite animal')) {
            current = [];
            return;
        }
        const fingerprint = current.map((l) => `${heroKey(l.hero)}:${coreKey(l.text)}`).join('|');
        const keys = current.map((l) => coreKey(l.text)).filter((k) => k.length >= 8);
        exchanges.push({
            pageHero,
            removed: currentIsRemoved,
            speakers,
            lines: current,
            fingerprint,
            keys,
            preview: current.map((l) => `${l.hero}: ${l.text}`).join(' / '),
        });
        if (currentIsRemoved && removedSlotsRemaining > 0) {
            removedSlotsRemaining -= 1;
            if (removedSlotsRemaining <= 0) currentIsRemoved = false;
        } else if (currentIsRemoved && removedSlotsRemaining <= 0) {
            // single-slot removed already consumed
            currentIsRemoved = false;
        }
        current = [];
    };

    for (const rawLine of String(body || '').split(/\n/)) {
        const trimmed = rawLine.trim();
        if (trimmed === '|-' || trimmed === '|}') {
            flush();
            continue;
        }

        // Header / note cells that mark REMOVED
        if (/removed/i.test(trimmed) && !/removed set-up chatter/i.test(trimmed)) {
            // Only treat as interaction-removed marker when it's a centered/header cell,
            // not a line of dialogue containing the word "removed".
            const isHeaderCell =
                trimmed.startsWith('|') ||
                /<center>/i.test(trimmed) ||
                /'{3,}REMOVED'{3,}/i.test(trimmed) ||
                /'{3,}Removed'{3,}/i.test(trimmed);
            const isDialogue = /^\*+\s*'''/.test(trimmed);
            if (isHeaderCell && !isDialogue) {
                const rowspan = trimmed.match(/rowspan\s*=\s*"?(\d+)"?/i);
                removedSlotsRemaining = rowspan ? Number(rowspan[1]) : Math.max(removedSlotsRemaining, 1);
                currentIsRemoved = true;
                continue;
            }
        }

        const m = rawLine.match(/^\*+\s*'''([^']+?)'''\s*:?\s*(.+)$/);
        if (!m) continue;
        let text = m[2]
            .replace(/\{\{[^}]+\}\}/g, ' ')
            .replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1')
            .replace(/\[\[([^\]]+)\]\]/g, '$1')
            .replace(/'''?/g, '')
            .replace(/''/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text || text.length < 3) continue;
        let hero = m[1].trim().replace(/:$/, '');
        current.push({ hero: normalizeHero(hero), text });
    }
    flush();
    return exchanges;
}

async function collectMatchTalkKeys() {
    /** @type {Map<string, Set<string>>} heroKey → coreKeys */
    const byHero = new Map();
    /** @type {Set<string>} */
    const all = new Set();

    async function walk(dir, heroFolder) {
        let dirents;
        try {
            dirents = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        const hk = heroKey(
            heroFolder === 'Soldier_ 76' ? 'Soldier 76' : heroFolder === 'D.Va' ? 'D.Va' : heroFolder,
        );
        if (!byHero.has(hk)) byHero.set(hk, new Set());
        for (const entry of dirents) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full, heroFolder);
                continue;
            }
            if (!/\.ogg$/i.test(entry.name)) continue;
            if (!/\.0B2-/i.test(entry.name)) continue;
            const match = entry.name.match(/^[^-]+-(.+)\.ogg$/i);
            if (!match) continue;
            const key = coreKey(match[1]);
            if (key.length < 6) continue;
            byHero.get(hk).add(key);
            all.add(key);
        }
    }

    for (const folder of MATCHTALK_FOLDERS) {
        const mt = path.join(EXTRACT_ROOT, folder, 'MatchTalk');
        if (!fs.existsSync(mt)) continue;
        await walk(mt, folder);
    }
    return { byHero, all };
}

function conversationLineKeys(conversation) {
    /** @type {Array<{ hero: string, key: string, subtitles: string, voice: string }>} */
    const rows = [];
    for (const line of conversation.lines || []) {
        const hero = normalizeHero(line.hero);
        const sub = stripDialogueSubtitleMarkup(String(line.subtitles || '')).trim();
        let key = coreKey(sub);
        if (!key || key.length < 6) {
            const voice = String(line.voice || '');
            const idx = voice.indexOf('_-_');
            if (idx >= 0) key = coreKey(voice.slice(idx + 3).replace(/_/g, ' '));
        }
        if (!key || key.length < 6) continue;
        // Skip pure short SFX tokens
        if (key.length < 8 && /^(beep|sigh|laugh|chuckle|nod)/i.test(sub)) continue;
        rows.push({
            hero,
            key,
            subtitles: sub,
            voice: String(line.voice || ''),
        });
    }
    return rows;
}

function matchExchangeToConversation(exchange, conversations) {
    const exKeys = exchange.keys.filter((k) => k.length >= 10);
    if (exKeys.length < 2) return null;

    let best = null;
    for (const conversation of conversations) {
        const lines = conversationLineKeys(conversation);
        if (lines.length < 2) continue;
        const convKeys = new Set(lines.map((l) => l.key));
        let hits = 0;
        for (const key of exKeys) {
            if (convKeys.has(key)) {
                hits += 1;
                continue;
            }
            // near prefix for truncated wiki vs wired
            const near = [...convKeys].some((ck) => {
                const shorter = Math.min(ck.length, key.length);
                if (shorter < 16) return false;
                return ck.startsWith(key) || key.startsWith(ck);
            });
            if (near) hits += 1;
        }
        const ratio = hits / exKeys.length;
        if (ratio >= 0.75 && (!best || ratio > best.ratio)) {
            best = { conversation, hits, ratio, total: exKeys.length };
        }
    }
    return best;
}

function scoreMatchTalkCoverage(conversation, matchTalk) {
    const lines = conversationLineKeys(conversation);
    if (lines.length === 0) {
        return {
            lineCount: 0,
            present: 0,
            missing: 0,
            ratio: 1,
            missingLines: [],
            status: 'no-dialogue-lines',
        };
    }
    /** @type {string[]} */
    const missingLines = [];
    let present = 0;
    for (const line of lines) {
        const heroSet = matchTalk.byHero.get(heroKey(line.hero));
        const inHero = heroSet?.has(line.key);
        const inAny =
            inHero ||
            [...(heroSet || [])].some((k) => {
                const shorter = Math.min(k.length, line.key.length);
                if (shorter < 16) return false;
                return k.startsWith(line.key) || line.key.startsWith(k);
            });
        if (inAny) present += 1;
        else missingLines.push(`${line.hero}: ${line.subtitles || line.voice}`);
    }
    const missing = lines.length - present;
    const ratio = present / lines.length;
    let status = 'full-matchtalk';
    if (present === 0) status = 'none-in-matchtalk';
    else if (missing > 0) status = 'partial-matchtalk';
    return { lineCount: lines.length, present, missing, ratio, missingLines, status };
}

// ---- main ----
const conversations = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8')).conversations || [];
const matchTalk = await collectMatchTalkKeys();

/** @type {Array<object>} */
const wikiRemovedExchanges = [];
const seenFp = new Set();

for (const [pageHero, cacheFile] of Object.entries(WIKI_CACHE_FILES)) {
    const full = path.join(CACHE_DIR, cacheFile);
    if (!fs.existsSync(full)) continue;
    const wikitext = fs.readFileSync(full, 'utf8');
    const body = splitInteractionsBody(wikitext);
    if (!body) continue;
    for (const exchange of parseRemovedAwareExchanges(body, pageHero)) {
        if (!exchange.removed) continue;
        if (seenFp.has(exchange.fingerprint)) continue;
        seenFp.add(exchange.fingerprint);
        wikiRemovedExchanges.push(exchange);
    }
}

/** Wiki REMOVED that match a conversation we have */
/** @type {Array<object>} */
const wikiRemovedInAtlas = [];
/** Wiki REMOVED we do not have */
/** @type {Array<object>} */
const wikiRemovedMissingFromAtlas = [];

for (const exchange of wikiRemovedExchanges) {
    const hit = matchExchangeToConversation(exchange, conversations);
    if (hit) {
        wikiRemovedInAtlas.push({
            conversationId: hit.conversation.id,
            conversationName: hit.conversation.name,
            tags: hit.conversation.tags || [],
            matchRatio: hit.ratio,
            speakers: exchange.speakers,
            preview: exchange.preview,
            pageHero: exchange.pageHero,
        });
    } else {
        wikiRemovedMissingFromAtlas.push({
            speakers: exchange.speakers,
            preview: exchange.preview,
            pageHero: exchange.pageHero,
        });
    }
}

/** Conversations lacking MatchTalk coverage */
/** @type {Array<object>} */
const notInMatchTalk = [];
/** @type {Array<object>} */
const partialMatchTalk = [];

for (const conversation of conversations) {
    const coverage = scoreMatchTalkCoverage(conversation, matchTalk);
    if (coverage.status === 'none-in-matchtalk') {
        notInMatchTalk.push({
            conversationId: conversation.id,
            conversationName: conversation.name,
            tags: conversation.tags || [],
            ...coverage,
        });
    } else if (coverage.status === 'partial-matchtalk') {
        partialMatchTalk.push({
            conversationId: conversation.id,
            conversationName: conversation.name,
            tags: conversation.tags || [],
            ...coverage,
        });
    }
}

const removedIds = new Set(wikiRemovedInAtlas.map((r) => r.conversationId));
const noneIds = new Set(notInMatchTalk.map((r) => r.conversationId));
const partialIds = new Set(partialMatchTalk.map((r) => r.conversationId));

const overlapNone = wikiRemovedInAtlas.filter((r) => noneIds.has(r.conversationId));
const overlapPartial = wikiRemovedInAtlas.filter((r) => partialIds.has(r.conversationId));
const overlapAnyMissingMt = wikiRemovedInAtlas.filter(
    (r) => noneIds.has(r.conversationId) || partialIds.has(r.conversationId),
);
const wikiRemovedButHasMatchTalk = wikiRemovedInAtlas.filter(
    (r) => !noneIds.has(r.conversationId) && !partialIds.has(r.conversationId),
);
const noneInMatchTalkNotWikiRemoved = notInMatchTalk.filter((r) => !removedIds.has(r.conversationId));

const report = {
    generatedAt: new Date().toISOString(),
    summary: {
        wikiRemovedExchangesFound: wikiRemovedExchanges.length,
        wikiRemovedMatchedToAtlasConversations: wikiRemovedInAtlas.length,
        wikiRemovedNotInAtlas: wikiRemovedMissingFromAtlas.length,
        conversationsWithNoMatchTalkAudio: notInMatchTalk.length,
        conversationsWithPartialMatchTalkAudio: partialMatchTalk.length,
        overlap_wikiRemoved_and_noMatchTalk: overlapNone.length,
        overlap_wikiRemoved_and_partialMatchTalk: overlapPartial.length,
        overlap_wikiRemoved_and_anyMatchTalkGap: overlapAnyMissingMt.length,
        wikiRemoved_but_fullMatchTalkPresent: wikiRemovedButHasMatchTalk.length,
        noMatchTalk_but_notWikiRemoved: noneInMatchTalkNotWikiRemoved.length,
        totalConversations: conversations.length,
        matchTalkKeysIndexed: matchTalk.all.size,
    },
    wikiRemovedInAtlas: wikiRemovedInAtlas.sort((a, b) =>
        String(a.conversationName).localeCompare(String(b.conversationName)),
    ),
    wikiRemovedMissingFromAtlas: wikiRemovedMissingFromAtlas.sort((a, b) =>
        a.preview.localeCompare(b.preview),
    ),
    conversationsNoMatchTalk: notInMatchTalk.sort((a, b) =>
        String(a.conversationName).localeCompare(String(b.conversationName)),
    ),
    conversationsPartialMatchTalk: partialMatchTalk.sort((a, b) => a.ratio - b.ratio),
    overlapWikiRemovedAndNoMatchTalk: overlapNone,
    overlapWikiRemovedAndPartialMatchTalk: overlapPartial,
    wikiRemovedButFullMatchTalk: wikiRemovedButHasMatchTalk,
    noMatchTalkNotWikiRemoved: noneInMatchTalkNotWikiRemoved,
};

fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);

function csvEscape(v) {
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

const csvRows = [
    'bucket,conversationId,conversationName,speakers,matchTalkStatus,matchTalkPresent,matchTalkMissing,wikiRemoved,preview',
];

function pushCsv(bucket, row, mtStatus = '', present = '', missing = '', wikiRemoved = '', preview = '') {
    csvRows.push(
        [
            bucket,
            row.conversationId || '',
            row.conversationName || '',
            (row.speakers || []).join(' + '),
            mtStatus,
            present,
            missing,
            wikiRemoved,
            preview || row.preview || '',
        ]
            .map(csvEscape)
            .join(','),
    );
}

for (const row of overlapNone) {
    const mt = notInMatchTalk.find((c) => c.conversationId === row.conversationId);
    pushCsv('OVERLAP: wiki-REMOVED + no MatchTalk', row, 'none', mt?.present, mt?.missing, 'yes', row.preview);
}
for (const row of overlapPartial) {
    const mt = partialMatchTalk.find((c) => c.conversationId === row.conversationId);
    pushCsv(
        'OVERLAP: wiki-REMOVED + partial MatchTalk',
        row,
        'partial',
        mt?.present,
        mt?.missing,
        'yes',
        row.preview,
    );
}
for (const row of wikiRemovedButHasMatchTalk) {
    pushCsv('wiki-REMOVED but MatchTalk present', row, 'full', '', '', 'yes', row.preview);
}
for (const row of noneInMatchTalkNotWikiRemoved) {
    pushCsv(
        'no MatchTalk (not wiki-REMOVED)',
        row,
        'none',
        row.present,
        row.missing,
        'no',
        (row.missingLines || []).slice(0, 3).join(' | '),
    );
}
for (const row of wikiRemovedMissingFromAtlas) {
    pushCsv(
        'wiki-REMOVED not in Atlas',
        { conversationId: '', conversationName: '', speakers: row.speakers, preview: row.preview },
        '',
        '',
        '',
        'yes',
        row.preview,
    );
}

fs.writeFileSync(OUT_CSV, `${csvRows.join('\n')}\n`);

console.log(JSON.stringify(report.summary, null, 2));
console.log('\nOverlap (wiki REMOVED ∩ no MatchTalk):');
for (const row of overlapNone.slice(0, 30)) {
    console.log(`  - ${row.conversationName}: ${row.preview.slice(0, 100)}`);
}
if (overlapNone.length > 30) console.log(`  … +${overlapNone.length - 30} more`);
console.log(`\nWrote ${OUT_JSON}`);
console.log(`Wrote ${OUT_CSV}`);
