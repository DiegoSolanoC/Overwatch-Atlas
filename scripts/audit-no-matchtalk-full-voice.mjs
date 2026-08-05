#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Re-audit conversations previously flagged as "no MatchTalk" against:
 *  1) MatchTalk (improved matching: voice filename + Cap'n/Captain + fuzzy)
 *  2) All other HeroVoice extract folders (Unknown, Ultimate, PVE, etc.)
 *  3) Whether Theater Voicelines files already exist on disk
 *
 * Usage:
 *   node scripts/audit-no-matchtalk-full-voice.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const PRIOR_AUDIT_PATH = auditPath('_audit-removed-vs-matchtalk.json');
const THEATER_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const OUT_JSON = auditPath('_audit-no-matchtalk-full-voice.json');
const OUT_CSV = auditPath('_audit-no-matchtalk-full-voice.csv');

/** Folders treated as interaction-dialogue likely homes */
const PRIORITY_BUCKETS = new Set([
    'MatchTalk',
    'MatchStartTalk',
    'Unknown',
    'Ultimate',
    'PVE',
    'Voicelines',
    'Junkenstein',
    'Karaoke',
    'CTF',
    'Retribution',
    'Teammate',
    'HeroSelect',
    'HeroChange',
]);

function heroKey(name) {
    return String(name || '')
        .trim()
        .replace(/^Soldier:\s*/i, 'Soldier ')
        .replace(/^Soldier_+\s*/i, 'Soldier ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

function normalizeHeroFolder(folder) {
    if (folder === 'Soldier_ 76' || folder === 'Soldier: 76') return 'Soldier 76';
    return folder;
}

function expandContractions(text) {
    return String(text || '')
        .replace(/\bcap['’]?n\b/gi, 'captain')
        .replace(/\bcannot\b/gi, 'cant')
        .replace(/\bwon't\b/gi, 'wont')
        .replace(/\bdon't\b/gi, 'dont')
        .replace(/\bdoesn't\b/gi, 'doesnt')
        .replace(/\bdidn't\b/gi, 'didnt')
        .replace(/\bisn't\b/gi, 'isnt')
        .replace(/\baren't\b/gi, 'arent')
        .replace(/\bwasn't\b/gi, 'wasnt')
        .replace(/\bweren't\b/gi, 'werent')
        .replace(/\bhasn't\b/gi, 'hasnt')
        .replace(/\bhaven't\b/gi, 'havent')
        .replace(/\bhadn't\b/gi, 'hadnt')
        .replace(/\bwouldn't\b/gi, 'wouldnt')
        .replace(/\bcouldn't\b/gi, 'couldnt')
        .replace(/\bshouldn't\b/gi, 'shouldnt')
        .replace(/\bit's\b/gi, 'its')
        .replace(/\bthat's\b/gi, 'thats')
        .replace(/\bwhat's\b/gi, 'whats')
        .replace(/\blet's\b/gi, 'lets')
        .replace(/\byou're\b/gi, 'youre')
        .replace(/\bwe're\b/gi, 'were')
        .replace(/\bthey're\b/gi, 'theyre')
        .replace(/\bi'm\b/gi, 'im')
        .replace(/\bhell'd\b/gi, 'helld')
        .replace(/\bin['’]?it\b/gi, 'init')
        .replace(/\bint[_ ]?it\b/gi, 'init');
}

function coreKey(text) {
    return expandContractions(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function significantWords(text) {
    return expandContractions(stripDialogueSubtitleMarkup(String(text || '')))
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9\s]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^(the|and|you|for|that|this|with|have|from|just|not|are|was|were|but|all|any|can|out|our|your)$/.test(w));
}

function dialoguePartFromAtlasFilename(filename) {
    const name = String(filename || '');
    const idx = name.indexOf('_-_');
    let part = idx >= 0 ? name.slice(idx + 3) : name;
    part = part.replace(/\.ogg$/i, '').replace(/_\(\d+\)$/i, '');
    return part.replace(/_/g, ' ');
}

function extractLabelFromExtractFilename(filename) {
    const name = String(filename || '');
    // Common: 00000002B8BB.0B2-Label text.ogg
    const m02 = name.match(/\.0B2-(.+)\.ogg$/i);
    if (m02) return m02[1];
    // Fallback: anything after first hyphen-like split past hex id
    const m = name.match(/^[^.]+(?:\.[^-]+)?-(.+)\.ogg$/i);
    if (m) return m[1];
    return name.replace(/\.ogg$/i, '');
}

function bucketFromRel(relPath) {
    const parts = relPath.split(/[/\\]/).filter(Boolean);
    // hero / bucket / ...
    return parts[1] || 'root';
}

/**
 * @param {string} dir
 * @param {string} heroFolder
 * @param {string} relBase
 * @param {Array<object>} out
 */
async function walkExtract(dir, heroFolder, relBase, out) {
    let dirents;
    try {
        dirents = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of dirents) {
        const full = path.join(dir, entry.name);
        const rel = path.join(relBase, entry.name);
        if (entry.isDirectory()) {
            await walkExtract(full, heroFolder, rel, out);
            continue;
        }
        if (!/\.ogg$/i.test(entry.name)) continue;
        const label = extractLabelFromExtractFilename(entry.name);
        const key = coreKey(label);
        if (!key || key.length < 6) continue;
        const bucket = bucketFromRel(rel);
        out.push({
            heroFolder: normalizeHeroFolder(heroFolder),
            heroKey: heroKey(normalizeHeroFolder(heroFolder)),
            bucket,
            priority: PRIORITY_BUCKETS.has(bucket),
            label,
            key,
            relPath: rel.replace(/\\/g, '/'),
            filename: entry.name,
        });
    }
}

function keysForLine(line) {
    /** @type {Set<string>} */
    const keys = new Set();
    const sub = stripDialogueSubtitleMarkup(String(line.subtitles || '')).trim();
    const voicePart = dialoguePartFromAtlasFilename(line.voice || '');
    for (const text of [sub, voicePart]) {
        if (!text) continue;
        const k = coreKey(text);
        if (k.length >= 6) keys.add(k);
        // also without trailing punctuation noise already handled by coreKey
    }
    return [...keys];
}

/**
 * Score how well an extract entry matches line keys / words.
 * @returns {{ score: number, mode: string } | null}
 */
function scoreEntryAgainstLine(entry, lineKeys, lineWords) {
    for (const lk of lineKeys) {
        if (entry.key === lk) return { score: 1, mode: 'exact' };
    }
    for (const lk of lineKeys) {
        const shorter = Math.min(entry.key.length, lk.length);
        if (shorter < 14) continue;
        if (entry.key.startsWith(lk) || lk.startsWith(entry.key)) {
            return { score: 0.92, mode: 'prefix' };
        }
        // mid truncation / trailing underscore noise
        if (shorter >= 18 && (entry.key.includes(lk.slice(0, 18)) || lk.includes(entry.key.slice(0, 18)))) {
            return { score: 0.85, mode: 'contains' };
        }
    }
    if (lineWords.length >= 4) {
        const ew = significantWords(entry.label);
        if (ew.length >= 4) {
            const set = new Set(ew);
            let hit = 0;
            for (const w of lineWords) if (set.has(w)) hit += 1;
            const ratio = hit / lineWords.length;
            if (ratio >= 0.75 && hit >= 4) return { score: 0.7 * ratio, mode: 'words' };
        }
    }
    return null;
}

function pickBest(entries, lineKeys, lineWords, preferHeroKey = null) {
    let best = null;
    for (const entry of entries) {
        const scored = scoreEntryAgainstLine(entry, lineKeys, lineWords);
        if (!scored) continue;
        const sameHeroBonus = preferHeroKey && entry.heroKey === preferHeroKey ? 5 : 0;
        const bucketRank = entry.bucket === 'MatchTalk' ? 3 : entry.priority ? 2 : 1;
        const rank = sameHeroBonus + bucketRank * 10 + scored.score;
        if (!best || rank > best.rank) best = { ...entry, ...scored, rank };
    }
    return best;
}

function bestMatchForLine(line, indexByHero, exactKeyIndex) {
    const hk = heroKey(line.hero);
    const pool = indexByHero.get(hk) || [];
    const lineKeys = keysForLine(line);
    const lineWords = significantWords(line.subtitles || dialoguePartFromAtlasFilename(line.voice || ''));
    if (!lineKeys.length && lineWords.length < 3) {
        return { found: false, reason: 'no-usable-line-text' };
    }

    // Fast path: exact key lookup across all heroes
    /** @type {object[]} */
    const exactCandidates = [];
    for (const lk of lineKeys) {
        const hits = exactKeyIndex.get(lk);
        if (hits) exactCandidates.push(...hits);
    }
    let best = pickBest(exactCandidates, lineKeys, lineWords, hk);

    // Fuzzy / prefix only within same hero (avoids O(all-files) scans)
    if (!best || best.score < 1) {
        const fuzzy = pickBest(pool, lineKeys, lineWords, hk);
        if (fuzzy && (!best || fuzzy.rank > best.rank)) best = fuzzy;
    }

    if (!best) return { found: false, reason: 'not-in-extract' };
    return {
        found: true,
        bucket: best.bucket,
        mode: best.mode,
        score: best.score,
        relPath: best.relPath,
        label: best.label,
        crossHero: best.heroKey !== hk,
        inMatchTalk: best.bucket === 'MatchTalk',
    };
}

async function buildTheaterSet() {
    /** @type {Set<string>} */
    const names = new Set();
    async function walk(dir) {
        let dirents;
        try {
            dirents = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of dirents) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (/\.ogg$/i.test(entry.name)) names.add(entry.name.toLowerCase());
        }
    }
    await walk(THEATER_DIR);
    return names;
}

function csvEscape(v) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

// ---- main ----
console.log('Loading conversations + prior no-MatchTalk list...');
const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const prior = JSON.parse(fs.readFileSync(PRIOR_AUDIT_PATH, 'utf8'));
const theaterNames = await buildTheaterSet();

const removedIds = new Set(
    data.conversations.filter((c) => (c.tags || []).includes('Removed')).map((c) => c.id),
);

const candidates = prior.noMatchTalkNotWikiRemoved
    .map((r) => data.conversations.find((c) => c.id === r.conversationId))
    .filter(Boolean)
    .filter((c) => !removedIds.has(c.id));

console.log(`Candidates: ${candidates.length}`);
console.log('Indexing HeroVoice extracts (all folders)...');

const indexByHero = new Map();
let indexedFiles = 0;
const heroDirs = await fsp.readdir(EXTRACT_ROOT, { withFileTypes: true });
for (const entry of heroDirs) {
    if (!entry.isDirectory()) continue;
    const heroFolder = entry.name;
    const files = [];
    await walkExtract(path.join(EXTRACT_ROOT, heroFolder), heroFolder, heroFolder, files);
    const hk = heroKey(normalizeHeroFolder(heroFolder));
    if (!indexByHero.has(hk)) indexByHero.set(hk, []);
    indexByHero.get(hk).push(...files);
    indexedFiles += files.length;
}
console.log(`Indexed ${indexedFiles} extract .ogg files across ${indexByHero.size} heroes`);

/** @type {Map<string, object[]>} */
const exactKeyIndex = new Map();
for (const entries of indexByHero.values()) {
    for (const entry of entries) {
        if (!exactKeyIndex.has(entry.key)) exactKeyIndex.set(entry.key, []);
        exactKeyIndex.get(entry.key).push(entry);
    }
}

const results = [];
const bucketHitCounts = {};

for (const conv of candidates) {
    const lineResults = [];
    let matchTalkHits = 0;
    let otherHits = 0;
    let missing = 0;
    let theaterHits = 0;
    const buckets = new Set();

    for (const line of conv.lines || []) {
        const voice = String(line.voice || '');
        const inTheater = voice ? theaterNames.has(voice.toLowerCase()) : false;
        if (inTheater) theaterHits += 1;

        const match = bestMatchForLine(line, indexByHero, exactKeyIndex);
        if (match.found) {
            buckets.add(match.bucket);
            bucketHitCounts[match.bucket] = (bucketHitCounts[match.bucket] || 0) + 1;
            if (match.inMatchTalk) matchTalkHits += 1;
            else otherHits += 1;
            lineResults.push({
                hero: line.hero,
                subtitles: stripDialogueSubtitleMarkup(String(line.subtitles || '')),
                voice,
                inTheater,
                ...match,
            });
        } else {
            missing += 1;
            lineResults.push({
                hero: line.hero,
                subtitles: stripDialogueSubtitleMarkup(String(line.subtitles || '')),
                voice,
                inTheater,
                found: false,
                reason: match.reason,
            });
        }
    }

    const lineCount = (conv.lines || []).length;
    const found = matchTalkHits + otherHits;
    let category = 'truly-missing';
    if (lineCount === 0) category = 'no-lines';
    else if (missing === 0 && matchTalkHits === lineCount) category = 'false-negative-matchtalk';
    else if (missing === 0 && otherHits > 0) category = 'found-outside-matchtalk';
    else if (missing === 0) category = 'found-mixed-buckets';
    else if (found > 0) category = 'partial';
    else if (theaterHits === lineCount) category = 'theater-only-no-extract';
    else category = 'truly-missing';

    results.push({
        conversationId: conv.id,
        conversationName: conv.name,
        tags: conv.tags || [],
        lineCount,
        matchTalkHits,
        otherHits,
        missing,
        theaterHits,
        foundRatio: lineCount ? found / lineCount : 0,
        buckets: [...buckets].sort(),
        category,
        lines: lineResults,
        preview: lineResults
            .slice(0, 2)
            .map((l) => `${l.hero}: ${l.subtitles || l.voice}`)
            .join(' / '),
    });
}

results.sort((a, b) => a.category.localeCompare(b.category) || a.conversationName.localeCompare(b.conversationName));

const summary = {
    candidates: candidates.length,
    indexedExtractFiles: indexedFiles,
    byCategory: {},
    bucketHitCounts,
};
for (const r of results) {
    summary.byCategory[r.category] = (summary.byCategory[r.category] || 0) + 1;
}

const report = {
    generatedAt: new Date().toISOString(),
    summary,
    results,
    falseNegatives: results.filter((r) => r.category === 'false-negative-matchtalk'),
    foundOutsideMatchTalk: results.filter((r) => r.category === 'found-outside-matchtalk'),
    partial: results.filter((r) => r.category === 'partial'),
    theaterOnly: results.filter((r) => r.category === 'theater-only-no-extract'),
    trulyMissing: results.filter((r) => r.category === 'truly-missing'),
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + '\n');

const csvLines = [
    [
        'category',
        'name',
        'tags',
        'lineCount',
        'matchTalkHits',
        'otherHits',
        'missing',
        'theaterHits',
        'buckets',
        'preview',
    ].join(','),
];
for (const r of results) {
    csvLines.push(
        [
            r.category,
            csvEscape(r.conversationName),
            csvEscape((r.tags || []).join('|')),
            r.lineCount,
            r.matchTalkHits,
            r.otherHits,
            r.missing,
            r.theaterHits,
            csvEscape(r.buckets.join('|')),
            csvEscape(r.preview),
        ].join(','),
    );
}
fs.writeFileSync(OUT_CSV, csvLines.join('\n') + '\n');

console.log('\n=== SUMMARY ===');
console.log(summary);
console.log('\nFalse negatives (actually in MatchTalk):', report.falseNegatives.length);
for (const r of report.falseNegatives.slice(0, 15)) {
    console.log(`  - ${r.conversationName}`);
}
console.log('\nFound outside MatchTalk (full coverage):', report.foundOutsideMatchTalk.length);
for (const r of report.foundOutsideMatchTalk.slice(0, 25)) {
    console.log(`  - ${r.conversationName} | buckets=${r.buckets.join(',')}`);
}
console.log('\nPartial:', report.partial.length);
console.log('Theater-only (no extract):', report.theaterOnly.length);
console.log('Truly missing from all extracts:', report.trulyMissing.length);
for (const r of report.trulyMissing.slice(0, 40)) {
    console.log(`  - ${r.conversationName} | theater ${r.theaterHits}/${r.lineCount}`);
}
if (report.trulyMissing.length > 40) console.log(`  ... +${report.trulyMissing.length - 40} more`);

console.log(`\nWrote ${OUT_JSON}`);
console.log(`Wrote ${OUT_CSV}`);
