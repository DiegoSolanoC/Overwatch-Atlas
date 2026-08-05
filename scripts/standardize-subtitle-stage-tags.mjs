#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Standardize Dialogue Theater subtitle stage tags:
 *  - Wrecking Ball hamster/squeak SFX → "(Hamster Noises)" (same paren style as languages)
 *  - Ensure (Chinese)/(Japanese)/(French)/… appear in subtitles when present on the voice file
 *
 * Usage:
 *   node scripts/standardize-subtitle-stage-tags.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_PATH = path.join(__dirname, '../src/data/dialogue-theater/conversations.json');
const OUT_REPORT = auditPath('_audit-subtitle-stage-tags.json');

const HAMSTER_MARKER = '(Hamster Noises)';
const LANG_RE = /\((Chinese|Japanese|French|Spanish|Korean|Russian|German|Portuguese)\)/gi;

function isWreckingBallLine(line) {
    return /wrecking\s*ball/i.test(String(line.hero || '')) || /Wrecking_Ball/i.test(String(line.voice || ''));
}

function hasHamsterCue(line) {
    const blob = `${line.subtitles || ''} ${line.voice || ''} ${line.voicePrefix || ''}`;
    return /hamster|squeak/i.test(blob);
}

function canonicalLang(tag) {
    const m = String(tag || '').match(
        /Chinese|Japanese|French|Spanish|Korean|Russian|German|Portuguese/i,
    );
    if (!m) return '';
    return m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase();
}

function langsFromVoice(voice) {
    const found = [];
    const seen = new Set();
    for (const m of String(voice || '').matchAll(LANG_RE)) {
        const lang = canonicalLang(m[1]);
        if (!lang || seen.has(lang.toLowerCase())) continue;
        seen.add(lang.toLowerCase());
        found.push(lang);
    }
    return found;
}

/**
 * Strip ONLY hamster SFX markup tokens — never the spoken word "hamster".
 * @param {string} sub
 */
function stripLegacyHamsterMarkers(sub) {
    return String(sub || '')
        .replace(
            /\*\*\s*((?:scared|angry|unhappy|apologetic|excited)\s+)?(hamster(?:\s+noises?|\s+squeaks?)?|angry\s+squeaks?)\s*\*\*/gi,
            ' ',
        )
        .replace(
            /\*\s*((?:scared|angry|unhappy|apologetic|excited)\s+)?(hamster(?:\s+noises?|\s+squeaks?)?|angry\s+squeaks?)\s*\*/gi,
            ' ',
        )
        .replace(/\(\s*Hamster\s+Noises?\s*\)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {object} line
 * @returns {{ before: string, changed: boolean, reason: string }}
 */
function standardizeWreckingBallSubtitles(line) {
    const before = String(line.subtitles || '');
    if (!hasHamsterCue(line)) {
        return { before, changed: false, reason: 'no-hamster-cue' };
    }

    const langs = langsFromVoice(line.voice);
    let body = stripLegacyHamsterMarkers(before);

    // Drop leading language tags temporarily; re-add in order after hamster marker
    const bodyLangs = [];
    body = body
        .replace(LANG_RE, (full, lang) => {
            const c = canonicalLang(lang);
            if (c) bodyLangs.push(c);
            return ' ';
        })
        .replace(/\s+/g, ' ')
        .trim();

    const orderedLangs = [];
    const seen = new Set();
    for (const lang of [...langs, ...bodyLangs]) {
        const key = lang.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        orderedLangs.push(lang);
    }

    const parts = [HAMSTER_MARKER, ...orderedLangs.map((l) => `(${l})`)];
    if (body) parts.push(body);
    const next = parts.join(' ').replace(/\s+/g, ' ').trim();

    if (next === before) return { before, changed: false, reason: 'already-standard' };
    line.subtitles = next;
    return { before, changed: true, reason: 'wb-hamster' };
}

/**
 * Ensure language tags from the voice filename appear in subtitles.
 * @param {object} line
 */
function ensureLanguageTagsFromVoice(line) {
    const before = String(line.subtitles || '');
    const voice = String(line.voice || '');
    const langs = langsFromVoice(voice);
    if (!langs.length) return { before, changed: false, reason: 'no-lang-in-voice' };

    let sub = before;
    let changed = false;
    for (const lang of langs) {
        if (new RegExp(`\\(${lang}\\)`, 'i').test(sub)) continue;

        // Prefer inserting before the clause that follows the tag in the filename.
        const dialogue = voice
            .replace(/^.*?_-_/, '')
            .replace(/\.ogg$/i, '')
            .replace(/_/g, ' ');
        const tagRe = new RegExp(`\\(${lang}\\)`, 'i');
        const tagIdx = dialogue.search(tagRe);
        const afterTag = dialogue
            .slice(tagIdx)
            .replace(tagRe, '')
            .replace(/^\s+/, '')
            .trim();
        // First few words after the language tag
        const afterWords = afterTag
            .split(/\s+/)
            .filter((w) => w && !/^\(.*\)$/.test(w))
            .slice(0, 4)
            .join(' ');
        if (afterWords.length >= 6) {
            const needle = afterWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            const placed = new RegExp(`(${needle})`, 'i');
            if (placed.test(sub) && !new RegExp(`\\(${lang}\\)\\s*${needle}`, 'i').test(sub)) {
                sub = sub.replace(placed, `(${lang}) $1`);
                changed = true;
                continue;
            }
        }

        // Whole-line foreign VO: prepend
        sub = `(${lang}) ${sub}`.replace(/\s+/g, ' ').trim();
        changed = true;
    }

    if (!changed) return { before, changed: false, reason: 'langs-already-present' };
    line.subtitles = sub;
    return { before, changed: true, reason: 'lang-from-voice' };
}

const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const changes = [];

for (const conv of data.conversations || []) {
    for (const line of conv.lines || []) {
        if (isWreckingBallLine(line)) {
            const result = standardizeWreckingBallSubtitles(line);
            if (result.changed) {
                changes.push({
                    conversation: conv.name,
                    hero: line.hero,
                    reason: result.reason,
                    before: result.before,
                    after: line.subtitles,
                });
            }
        } else {
            const result = ensureLanguageTagsFromVoice(line);
            if (result.changed) {
                changes.push({
                    conversation: conv.name,
                    hero: line.hero,
                    reason: result.reason,
                    before: result.before,
                    after: line.subtitles,
                });
            }
        }
    }
}

if (!data._meta) data._meta = {};
data._meta.tagsResetAt = new Date().toISOString();

fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(
    OUT_REPORT,
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            changeCount: changes.length,
            byReason: changes.reduce((acc, row) => {
                acc[row.reason] = (acc[row.reason] || 0) + 1;
                return acc;
            }, {}),
            changes,
        },
        null,
        2,
    ) + '\n',
);

console.log('Updated', changes.length, 'subtitles');
const byReason = {};
for (const c of changes) byReason[c.reason] = (byReason[c.reason] || 0) + 1;
console.log(byReason);
console.log('\nSamples:');
for (const c of changes.slice(0, 20)) {
    console.log(`- ${c.conversation} [${c.reason}]`);
    console.log(`  before: ${JSON.stringify(c.before)}`);
    console.log(`  after:  ${JSON.stringify(c.after)}`);
}
console.log(`\nWrote ${OUT_REPORT}`);
