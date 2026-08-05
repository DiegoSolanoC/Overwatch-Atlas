#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Audit MatchTalk extracts vs conversations.json usage.
 *
 * A MatchTalk file counts as USED if:
 *   1) its atlas filename equals any line.voice / voicePrefix, OR
 *   2) its dialogue label (text after _-_) matches any used voice's label
 *      after punctuation/spacing normalization (handles Soldier__76 vs Soldier_76).
 *
 * Usage:
 *   node scripts/audit-matchtalk-unused.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLikelyDialogueVoiceline, normalizeHeroKey } from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
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
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const OUT_JSON = auditPath('_audit-matchtalk-unused.json');

/** HeroVoice folder name → preferred atlas filename prefix(es) also accepted as matches. */
const HERO_PREFIX_ALIASES = {
    'Soldier_ 76': ['Soldier_76', 'Soldier__76'],
    'Soldier: 76': ['Soldier_76', 'Soldier__76'],
    'Wrecking Ball': ['Wrecking_Ball'],
    'Junker Queen': ['Junker_Queen'],
    'Jetpack Cat': ['Jetpack_Cat'],
    'D.Va': ['D.Va', 'D_Va'],
};

/**
 * @param {string} folderName
 * @returns {string}
 */
function heroFolderToFilenamePrefix(folderName) {
    // "Soldier_ 76" extract folder → prefer Soldier_76 (matches most wired files)
    if (folderName === 'Soldier_ 76' || folderName === 'Soldier: 76') return 'Soldier_76';
    return String(folderName || '').trim().replace(/ /g, '_');
}

/**
 * @param {string} heroPrefix
 * @param {string} label
 * @returns {string}
 */
function labelToAtlasFilename(heroPrefix, label) {
    const safe = String(label || '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${heroPrefix}_-_${safe}.ogg`;
}

/**
 * Collapse dialogue text for cross-prefix matching.
 * @param {string} text
 * @returns {string}
 */
function dialogueKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\.ogg$/i, '')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * Strip leading stage-direction parentheses: "(chuckle) Hello" → "Hello"
 * Also handles filename form "(chuckle)_Hello".
 * @param {string} text
 * @returns {string}
 */
function stripLeadingStageDirections(text) {
    let out = String(text || '').trim();
    out = out.replace(/^(\([^)]+\)_)+/g, '');
    while (/^\([^)]+\)\s*/.test(out)) {
        out = out.replace(/^\([^)]+\)\s*/, '').trim();
    }
    return out;
}

/**
 * Strip every parenthetical stage beat: "Hello. (pause) There" → "Hello. There"
 * @param {string} text
 * @returns {string}
 */
function stripAllParenDirections(text) {
    return String(text || '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Spoken-core key: ignore stage directions, fillers, dialect spelling variants.
 * @param {string} text
 * @returns {string}
 */
function coreKeyFromText(text) {
    const normalized = normalizeDialectSpellings(stripAllParenDirections(text));
    const withoutFillers = stripLeadingFillers(normalized);
    return dialogueKey(withoutFillers || normalized);
}

/**
 * Significant words for fuzzy same-hero matching.
 * @param {string} text
 * @returns {string[]}
 */
function significantWords(text) {
    return stripAllParenDirections(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9\s]+/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2);
}

/**
 * Drop leading filler / reaction words that often differ between extract + wired files.
 * @param {string} text
 * @returns {string}
 */
function stripLeadingFillers(text) {
    return String(text || '')
        .trim()
        .replace(/^(ah|oh|uh|um|hmm+|heh|ha|haha|hahaha|well|so|yeah)\b[\s.,…]*/gi, '')
        .trim();
}

/**
 * Normalize dialect spellings that create duplicate extract filenames.
 * @param {string} text
 * @returns {string}
 */
function normalizeDialectSpellings(text) {
    return String(text || '')
        .replace(/int[_ ]?it_?/gi, 'init')
        .replace(/in['’]?it_?/gi, 'init')
        .replace(/\bin_it\b/gi, 'init');
}

/**
 * All match keys for a MatchTalk label or wired filename dialogue part.
 * @param {string} text
 * @returns {string[]}
 */
function dialogueKeysFromText(text) {
    /** @type {Set<string>} */
    const keys = new Set();
    const raw = String(text || '').trim();
    if (!raw) return [];
    const full = dialogueKey(raw);
    if (full) keys.add(full);
    const leadingStripped = stripLeadingStageDirections(raw);
    if (leadingStripped && leadingStripped !== raw) {
        const key = dialogueKey(leadingStripped);
        if (key) keys.add(key);
    }
    const core = coreKeyFromText(raw);
    if (core) keys.add(core);
    return [...keys];
}

/**
 * @param {string} filename
 * @returns {string}
 */
function dialoguePartFromAtlasFilename(filename) {
    const name = String(filename || '');
    const idx = name.indexOf('_-_');
    return idx >= 0 ? name.slice(idx + 3).replace(/\.ogg$/i, '') : name.replace(/\.ogg$/i, '');
}

/**
 * @param {string} filename
 * @returns {string[]}
 */
function dialogueKeysFromAtlasFilename(filename) {
    return dialogueKeysFromText(dialoguePartFromAtlasFilename(filename).replace(/_/g, ' '));
}

/**
 * @param {string} heroFolder
 * @param {string} lineHero
 * @returns {boolean}
 */
function heroesRoughlyMatch(heroFolder, lineHero) {
    const a = normalizeHeroKey(heroFolder === 'Soldier_ 76' ? 'Soldier 76' : heroFolder);
    const b = normalizeHeroKey(lineHero);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
}

/**
 * @param {string} dir
 * @param {string} heroFolder
 * @param {Array<object>} entries
 */
async function walkMatchTalk(dir, heroFolder, entries) {
    let dirents;
    try {
        dirents = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }
    const heroPrefix = heroFolderToFilenamePrefix(heroFolder);
    for (const entry of dirents) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const isParenFolder = /^\([^)]+\)$/.test(entry.name);
            if (isParenFolder && heroFolder === 'Jetpack Cat') {
                const files = (await fsp.readdir(fullPath)).filter((n) => /\.ogg$/i.test(n));
                if (files.length) {
                    const label = entry.name;
                    const atlasName = labelToAtlasFilename(heroPrefix, label);
                    entries.push({
                        heroFolder,
                        label,
                        atlasName,
                        sourceRel: path.relative(EXTRACT_ROOT, path.join(fullPath, files[0])),
                        variantCount: files.length,
                        kind: 'sfx-folder',
                    });
                }
                continue;
            }
            await walkMatchTalk(fullPath, heroFolder, entries);
            continue;
        }
        if (!/\.ogg$/i.test(entry.name)) continue;
        if (!/\.0B2-/i.test(entry.name)) continue;
        const match = entry.name.match(/^[^-]+-(.+)\.ogg$/i);
        if (!match) continue;
        const label = match[1];
        const atlasName = labelToAtlasFilename(heroPrefix, label);
        const kind = isLikelyDialogueVoiceline(atlasName) ? 'dialogue' : 'sfx-paren';
        entries.push({
            heroFolder,
            label,
            atlasName,
            sourceRel: path.relative(EXTRACT_ROOT, fullPath),
            variantCount: 1,
            kind,
        });
    }
}

/**
 * @param {string} heroFolder
 * @param {string} label
 * @returns {string[]}
 */
function candidateAtlasNames(heroFolder, label) {
    const primary = heroFolderToFilenamePrefix(heroFolder);
    const aliases = HERO_PREFIX_ALIASES[heroFolder] || [primary];
    const prefixes = [...new Set([primary, ...aliases])];
    return prefixes.map((prefix) => labelToAtlasFilename(prefix, label));
}

const usedExact = new Set();
/** @type {Map<string, string>} dialogueKey → example used filename / subtitle */
const usedByDialogueKey = new Map();
/** @type {string[]} long core keys for truncated-filename contains matching */
const usedCoreKeys = [];
/** @type {Array<{ hero: string, words: string[], ref: string }>} */
const usedHeroWordRows = [];

/**
 * @param {string} key
 * @param {string} ref
 */
function rememberKey(key, ref) {
    if (!key) return;
    if (!usedByDialogueKey.has(key)) usedByDialogueKey.set(key, ref);
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
for (const conversation of raw.conversations || []) {
    for (const line of conversation.lines || []) {
        const lineHero = String(line.hero || '').trim();
        for (const field of [line.voice, line.voicePrefix]) {
            const voice = String(field || '').trim();
            if (!voice) continue;
            usedExact.add(voice);
            const dialoguePart = dialoguePartFromAtlasFilename(voice).replace(/_/g, ' ');
            for (const key of dialogueKeysFromText(dialoguePart)) rememberKey(key, voice);
            const core = coreKeyFromText(dialoguePart);
            if (core.length >= 16) usedCoreKeys.push(core);
            const wordList = significantWords(dialoguePart);
            if (wordList.length >= 4) {
                usedHeroWordRows.push({ hero: lineHero, words: wordList, ref: voice });
            }
        }
        const subtitles = stripDialogueSubtitleMarkup(String(line.subtitles || '')).trim();
        if (subtitles) {
            for (const key of dialogueKeysFromText(subtitles)) {
                if (key.length >= 12) rememberKey(key, `subtitle:${subtitles.slice(0, 80)}`);
            }
            const core = coreKeyFromText(subtitles);
            if (core.length >= 16) usedCoreKeys.push(core);
            const wordList = significantWords(subtitles);
            if (wordList.length >= 4) {
                usedHeroWordRows.push({
                    hero: lineHero,
                    words: wordList,
                    ref: `subtitle:${subtitles.slice(0, 80)}`,
                });
            }
        }
    }
}

const usedCoreKeySet = new Set(usedCoreKeys);

const voicelineFiles = fs.readdirSync(VOICELINES_DIR).filter((name) => /\.ogg$/i.test(name));
const voicelineSet = new Set(voicelineFiles);
/** @type {Map<string, string>} */
const voicelineByDialogueKey = new Map();
for (const file of voicelineFiles) {
    for (const key of dialogueKeysFromAtlasFilename(file)) {
        if (!voicelineByDialogueKey.has(key)) voicelineByDialogueKey.set(key, file);
    }
}

const heroDirs = (await fsp.readdir(EXTRACT_ROOT, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort((a, b) => a.localeCompare(b));

/** @type {Array<object>} */
const allEntries = [];
for (const hero of heroDirs) {
    const matchTalkDir = path.join(EXTRACT_ROOT, hero, 'MatchTalk');
    if (!fs.existsSync(matchTalkDir)) continue;
    await walkMatchTalk(matchTalkDir, hero, allEntries);
}

/** @type {Map<string, object>} */
const byAtlas = new Map();
for (const entry of allEntries) {
    const prev = byAtlas.get(entry.atlasName);
    if (!prev) {
        byAtlas.set(entry.atlasName, { ...entry, extractCopies: 1 });
    } else {
        prev.extractCopies += 1;
        prev.variantCount += entry.variantCount;
    }
}

const unused = [];
let usedExactCount = 0;
let usedLabelCount = 0;
let usedFuzzyCount = 0;

/**
 * @param {string} label
 * @param {string} heroFolder
 * @returns {string|null}
 */
function findFuzzyUsage(label, heroFolder) {
    const core = coreKeyFromText(label);
    if (core.length >= 20) {
        if (usedCoreKeySet.has(core)) return `core:${core.slice(0, 40)}`;
        for (const used of usedCoreKeys) {
            if (used.length < 20) continue;
            // Truncated MatchTalk/repo names vs longer wired files (or vice versa).
            if (used.startsWith(core) || core.startsWith(used)) {
                const shorter = Math.min(used.length, core.length);
                if (shorter >= 20) return `core-prefix:${used.slice(0, 40)}`;
            }
            if (used.includes(core) && core.length >= 28) return `core-in:${used.slice(0, 40)}`;
            if (core.includes(used) && used.length >= 28) return `core-has:${used.slice(0, 40)}`;
        }
    }

    const labelWords = significantWords(label);
    if (labelWords.length < 5) return null;
    let bestRef = null;
    let bestRatio = 0;
    let bestHits = 0;
    for (const row of usedHeroWordRows) {
        if (!heroesRoughlyMatch(heroFolder, row.hero)) continue;
        const set = new Set(row.words);
        const hits = labelWords.filter((word) => set.has(word)).length;
        const ratio = hits / Math.min(labelWords.length, row.words.length);
        if (hits >= 5 && ratio >= 0.75 && ratio > bestRatio) {
            bestRatio = ratio;
            bestHits = hits;
            bestRef = row.ref;
        }
    }
    if (bestRef) return `words-${bestHits}:${bestRef}`;
    return null;
}

for (const entry of byAtlas.values()) {
    const candidates = candidateAtlasNames(entry.heroFolder, entry.label);
    const exactHit = candidates.find((name) => usedExact.has(name)) || null;
    const labelKeys = dialogueKeysFromText(entry.label);
    let labelHit = null;
    if (!exactHit) {
        for (const key of labelKeys) {
            if (usedByDialogueKey.has(key)) {
                labelHit = usedByDialogueKey.get(key);
                break;
            }
        }
    }
    let fuzzyHit = null;
    if (!exactHit && !labelHit) {
        fuzzyHit = findFuzzyUsage(entry.label, entry.heroFolder);
    }
    const matchedAs = exactHit || labelHit || fuzzyHit;
    const inVoicelines =
        candidates.some((name) => voicelineSet.has(name)) ||
        labelKeys.some((key) => voicelineByDialogueKey.has(key)) ||
        Boolean(coreKeyFromText(entry.label) && voicelineByDialogueKey.has(coreKeyFromText(entry.label)));
    const repoFilename =
        candidates.find((name) => voicelineSet.has(name)) ||
        labelKeys.map((key) => voicelineByDialogueKey.get(key)).find(Boolean) ||
        voicelineByDialogueKey.get(coreKeyFromText(entry.label)) ||
        '';

    if (exactHit) usedExactCount += 1;
    else if (labelHit) usedLabelCount += 1;
    else if (fuzzyHit) usedFuzzyCount += 1;

    if (matchedAs) continue;

    unused.push({
        hero: entry.heroFolder,
        label: entry.label,
        atlasName: entry.atlasName,
        kind: entry.kind,
        inVoicelines,
        repoFilename,
        extractCopies: entry.extractCopies,
        sourceRel: String(entry.sourceRel).replace(/\\/g, '/'),
    });
}

unused.sort((a, b) => a.hero.localeCompare(b.hero) || a.label.localeCompare(b.label));

/** @type {Record<string, { dialogue: number, sfx: number, total: number, inRepoDialogue: number }>} */
const byHero = {};
for (const row of unused) {
    if (!byHero[row.hero]) {
        byHero[row.hero] = { dialogue: 0, sfx: 0, total: 0, inRepoDialogue: 0 };
    }
    byHero[row.hero].total += 1;
    if (row.kind === 'dialogue') {
        byHero[row.hero].dialogue += 1;
        if (row.inVoicelines) byHero[row.hero].inRepoDialogue += 1;
    } else {
        byHero[row.hero].sfx += 1;
    }
}

const unusedDialogue = unused.filter((row) => row.kind === 'dialogue');
const unusedSfx = unused.filter((row) => row.kind !== 'dialogue');
const unusedDialogueInRepo = unusedDialogue.filter((row) => row.inVoicelines);
const unusedDialogueNotImported = unusedDialogue.filter((row) => !row.inVoicelines);

const summary = {
    matchTalkUniqueAtlasNames: byAtlas.size,
    matchTalkRawEntries: allEntries.length,
    usedExactFilename: usedExactCount,
    usedViaLabelMatch: usedLabelCount,
    usedViaFuzzyMatch: usedFuzzyCount,
    usedInConversations: usedExactCount + usedLabelCount + usedFuzzyCount,
    unusedTotal: unused.length,
    unusedDialogue: unusedDialogue.length,
    unusedDialogueInVoicelines: unusedDialogueInRepo.length,
    unusedDialogueNotImported: unusedDialogueNotImported.length,
    unusedSfx: unusedSfx.length,
    conversationVoiceRefs: usedExact.size,
    heroesScanned: heroDirs.filter((hero) =>
        fs.existsSync(path.join(EXTRACT_ROOT, hero, 'MatchTalk')),
    ).length,
};

const report = {
    generatedAt: new Date().toISOString(),
    summary,
    unusedByHero: byHero,
    // Priority list: dialogue present in theater Voicelines but never wired
    unusedDialogueInVoicelines: unusedDialogueInRepo,
    // Dialogue still only in MatchTalk extract (never copied / never wired)
    unusedDialogueNotImported: unusedDialogueNotImported,
    unusedSfx,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`Wrote ${OUT_JSON}`);
console.log('\nUnused dialogue by hero (inRepo / total):');
Object.entries(byHero)
    .filter(([, counts]) => counts.dialogue > 0)
    .sort((a, b) => b[1].dialogue - a[1].dialogue)
    .forEach(([hero, counts]) => {
        console.log(
            `  ${hero}: ${counts.inRepoDialogue}/${counts.dialogue} dialogue unused` +
                (counts.sfx ? ` (+${counts.sfx} sfx)` : ''),
        );
    });
