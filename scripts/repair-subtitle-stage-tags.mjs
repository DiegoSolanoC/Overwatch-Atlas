#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Repair damaged hamster subtitle pass + re-apply safe standardization.
 * Uses scripts/_audit-subtitle-stage-tags.json "before" values where available.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_PATH = path.join(__dirname, '../src/data/dialogue-theater/conversations.json');
const AUDIT_PATH = auditPath('_audit-subtitle-stage-tags.json');

const HAMSTER = '(Hamster Noises)';
const LANG_RE = /\((Chinese|Japanese|French|Spanish|Korean|Russian|German|Portuguese)\)/gi;

function canonLang(s) {
    const m = String(s || '').match(/Chinese|Japanese|French|Spanish|Korean|Russian|German|Portuguese/i);
    return m ? m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase() : '';
}

function langsFromVoice(voice) {
    const out = [];
    const seen = new Set();
    for (const match of String(voice || '').matchAll(LANG_RE)) {
        const lang = canonLang(match[1]);
        if (!lang || seen.has(lang.toLowerCase())) continue;
        seen.add(lang.toLowerCase());
        out.push(lang);
    }
    return out;
}

/** Strip ONLY SFX markup tokens — never the spoken word "hamster". */
function stripSfxMarkersOnly(sub) {
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

function buildWbSubtitle(spokenRaw, voice) {
    let body = stripSfxMarkersOnly(spokenRaw);

    const langs = [];
    const seen = new Set();
    for (const lang of [
        ...langsFromVoice(voice),
        ...[...body.matchAll(LANG_RE)].map((m) => canonLang(m[1])),
    ]) {
        if (!lang || seen.has(lang.toLowerCase())) continue;
        seen.add(lang.toLowerCase());
        langs.push(lang);
    }
    body = body.replace(LANG_RE, ' ').replace(/\s+/g, ' ').trim();

    const parts = [HAMSTER, ...langs.map((lang) => `(${lang})`)];
    if (body) parts.push(body);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function ensureLangTags(subtitles, voice) {
    const langs = langsFromVoice(voice);
    if (!langs.length) return { text: subtitles, changed: false };

    let sub = String(subtitles || '');
    let changed = false;

    for (const lang of langs) {
        if (new RegExp(`\\(${lang}\\)`, 'i').test(sub)) continue;

        const dialogue = String(voice || '')
            .replace(/^.*?_-_/, '')
            .replace(/\.ogg$/i, '')
            .replace(/_/g, ' ');
        const tagIdx = dialogue.search(new RegExp(`\\(${lang}\\)`, 'i'));
        const afterTag = dialogue
            .slice(tagIdx)
            .replace(new RegExp(`\\(${lang}\\)`, 'i'), '')
            .trim();
        const afterWords = afterTag
            .split(/\s+/)
            .filter((word) => word && !/^\(.*\)$/.test(word))
            .slice(0, 4)
            .join(' ');

        if (afterWords.length >= 6) {
            const esc = afterWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            const placed = new RegExp(`(${esc})`, 'i');
            if (placed.test(sub) && !new RegExp(`\\(${lang}\\)\\s*${esc}`, 'i').test(sub)) {
                sub = sub.replace(placed, `(${lang}) $1`);
                changed = true;
                continue;
            }
        }

        sub = `(${lang}) ${sub}`;
        changed = true;
    }

    return { text: sub.replace(/\s+/g, ' ').trim(), changed };
}

const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const report = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));

/** @type {Map<string, string>} current damaged after → original before */
const wbBeforeByAfter = new Map();
/** conversation|before → before (for matching restored) */
const wbBeforesByConv = new Map();
for (const change of report.changes || []) {
    if (change.reason === 'wb-hamster') {
        wbBeforeByAfter.set(`${change.conversation}::${change.after}`, change.before);
        if (!wbBeforesByConv.has(change.conversation)) wbBeforesByConv.set(change.conversation, []);
        wbBeforesByConv.get(change.conversation).push(change.before);
    }
}

let wbFixed = 0;
let langFixed = 0;

for (const conv of data.conversations || []) {
    const pendingBefores = [...(wbBeforesByConv.get(conv.name) || [])];
    for (const line of conv.lines || []) {
        const isWb =
            /wrecking\s*ball/i.test(String(line.hero || '')) ||
            /Wrecking_Ball/i.test(String(line.voice || ''));
        if (isWb) {
            const cue = /hamster|squeak/i.test(
                `${line.subtitles || ''} ${line.voice || ''} ${line.voicePrefix || ''}`,
            );
            if (!cue) continue;

            const current = String(line.subtitles || '');
            let spoken = wbBeforeByAfter.get(`${conv.name}::${current}`);
            if (!spoken) {
                // Already repaired or unmatched — use current after stripping bad SFX only
                spoken = current;
                // If current looks damaged ("The says"), try unused before from this conversation
                if (/\bThe says\b|\bThe is not\b|\bThe will get\b|\bThe would like\b|\bMistaking the for\b/i.test(current)) {
                    const idx = pendingBefores.findIndex((before) => {
                        const rebuilt = buildWbSubtitle(before, line.voice);
                        // rough: same ending words
                        return rebuilt.includes(current.replace(/^\(Hamster Noises\)\s*/i, '').slice(-20));
                    });
                    // simpler: pop sequential befores for damaged lines in order
                    if (pendingBefores.length) spoken = pendingBefores.shift();
                }
            } else {
                // consume matching before from pending
                const i = pendingBefores.indexOf(spoken);
                if (i >= 0) pendingBefores.splice(i, 1);
            }

            const next = buildWbSubtitle(spoken, line.voice);
            if (next !== current) {
                line.subtitles = next;
                wbFixed += 1;
            }
        } else {
            // Restore language from audit before when present
            const current = String(line.subtitles || '');
            const langChange = (report.changes || []).find(
                (change) =>
                    change.reason === 'lang-from-voice' &&
                    change.conversation === conv.name &&
                    (change.after === current || change.before === current),
            );
            const base = langChange ? langChange.before : current;
            const { text, changed } = ensureLangTags(base, line.voice);
            if (changed && text !== line.subtitles) {
                line.subtitles = text;
                langFixed += 1;
            }
        }
    }
}

if (!data._meta) data._meta = {};
data._meta.tagsResetAt = new Date().toISOString();
fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(data, null, 2) + '\n');

let bad = 0;
const samples = [];
for (const conv of data.conversations || []) {
    for (const line of conv.lines || []) {
        const sub = String(line.subtitles || '');
        if (/\bThe says\b|\bThe is not\b|\bThe will get\b|\bThe would like\b|\bMistaking the for\b/i.test(sub)) {
            bad += 1;
            console.log('BAD', conv.name, sub);
        }
        if (/wrecking/i.test(String(line.hero || '')) && /\(Hamster Noises\)/i.test(sub) && samples.length < 12) {
            samples.push(`${conv.name}: ${sub}`);
        }
    }
}

console.log({ wbFixed, langFixed, badRemaining: bad });
console.log(samples.join('\n'));
