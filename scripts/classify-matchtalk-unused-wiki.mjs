#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Rebuild wiki classification with STRICT matching + missing-interaction scan
 * + Favorite Animals gap report.
 *
 * Strict rules:
 * - exact core key match, OR
 * - prefix/contains only when shorter key length >= 28 and length ratio >= 0.9
 * - NO word-overlap matching (too many false PvE/Abilities/Cosmetics hits)
 *
 * Also parses Interactions sections into multi-speaker exchanges and flags
 * complete exchanges that are not present in conversations.json.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_JSON = auditPath('_audit-matchtalk-unused.json');
const CACHE_DIR = WIKI_QUOTES_CACHE_DIR;
const CONVERSATIONS_PATH = path.join(
    __dirname,
    '../src/data/dialogue-theater/conversations.json',
);
const OUT_JSON = auditPath('_audit-matchtalk-wiki-classify.json');
const OUT_CSV = auditPath('_audit-matchtalk-wiki-classify.csv');
const OUT_MISSING_INTERACTIONS = auditPath('_audit-matchtalk-missing-interactions.json');
const OUT_MISSING_INTERACTIONS_CSV = auditPath('_audit-matchtalk-missing-interactions.csv');
const OUT_FA_GAPS = auditPath('_audit-favorite-animals-gaps.json');

const SECTION_PRIORITY = [
    'Skin-Specific',
    'Map-Specific',
    'Event-Specific',
    'PvE',
    'Abilities',
    'Chatter',
    'Call-Outs',
    'Mission Specific',
    'Eliminations',
    'Communication',
    'Cosmetics',
    'Datamined',
    'Non-Verbal',
    'Interactions',
];

/** Buckets that previously had many false positives — exact-only. */
const EXACT_ONLY_BUCKETS = new Set([
    'Abilities',
    'PvE',
    'Cosmetics',
    'Mission Specific',
    'Eliminations',
    'Call-Outs',
    'Communication',
    'Datamined',
    'Non-Verbal',
]);

const SKIP_SECTIONS = new Set(['Trivia', 'References', 'Navigation', 'Gallery', 'See also']);

const WIKI_HERO_PAGE = {
    Ana: 'Ana',
    Anran: 'Anran',
    Ashe: 'Ashe',
    Baptiste: 'Baptiste',
    Bastion: 'Bastion',
    Brigitte: 'Brigitte',
    Cassidy: 'Cassidy',
    'D.Va': 'D.Va',
    Domina: 'Domina',
    Doomfist: 'Doomfist',
    Echo: 'Echo',
    Emre: 'Emre',
    Freja: 'Freja',
    Genji: 'Genji',
    Hanzo: 'Hanzo',
    Hazard: 'Hazard',
    Illari: 'Illari',
    'Jetpack Cat': 'Jetpack_Cat',
    'Junker Queen': 'Junker_Queen',
    Junkrat: 'Junkrat',
    Juno: 'Juno',
    Kiriko: 'Kiriko',
    Lifeweaver: 'Lifeweaver',
    Lúcio: 'Lúcio',
    Mauga: 'Mauga',
    Mei: 'Mei',
    Mercy: 'Mercy',
    Mizuki: 'Mizuki',
    Moira: 'Moira',
    Orisa: 'Orisa',
    Pharah: 'Pharah',
    Ramattra: 'Ramattra',
    Reaper: 'Reaper',
    Reinhardt: 'Reinhardt',
    Roadhog: 'Roadhog',
    Shion: 'Shion',
    Sierra: 'Sierra',
    Sigma: 'Sigma',
    Sojourn: 'Sojourn',
    'Soldier_ 76': 'Soldier:_76',
    Sombra: 'Sombra',
    Symmetra: 'Symmetra',
    Torbjörn: 'Torbjörn',
    Tracer: 'Tracer',
    Vendetta: 'Vendetta',
    Venture: 'Venture',
    Widowmaker: 'Widowmaker',
    Winston: 'Winston',
    'Wrecking Ball': 'Wrecking_Ball',
    Wuyang: 'Wuyang',
    Zarya: 'Zarya',
    Zenyatta: 'Zenyatta',
};

const FA_ID = '8974246a-ee27-4a5b-a5ec-132a459895a3';

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeSectionBucket(sectionTitle) {
    const raw = String(sectionTitle || '').replace(/_/g, ' ').trim();
    if (!raw) return 'Other';
    const lower = raw.toLowerCase();
    if (lower === 'voice lines' || lower.startsWith('cosmetics')) return 'Cosmetics';
    if (lower.includes('mission')) return 'Mission Specific';
    if (lower.includes('skin')) return 'Skin-Specific';
    if (lower.includes('map')) return 'Map-Specific';
    if (lower.includes('event')) return 'Event-Specific';
    if (lower.includes('call')) return 'Call-Outs';
    if (lower.includes('non-verbal') || lower.includes('non verbal')) return 'Non-Verbal';
    for (const known of SECTION_PRIORITY) {
        if (known.toLowerCase() === lower) return known;
    }
    return raw;
}

function splitWikitextSections(wikitext) {
    const text = String(wikitext || '');
    const parts = text.split(/\n(?=={2}\s*[^=].*?={2}\s*$)/m);
    /** @type {Array<{ title: string, body: string }>} */
    const sections = [];
    for (const part of parts) {
        const match = part.match(/^={2}\s*([^=]+?)\s*={2}\s*\n?([\s\S]*)$/);
        if (!match) continue;
        sections.push({ title: match[1].trim(), body: match[2] || '' });
    }
    return sections;
}

function extractQuoteCandidates(body) {
    const lines = String(body || '').split(/\n/);
    /** @type {string[]} */
    const out = [];
    for (const rawLine of lines) {
        let line = rawLine.trim();
        if (!line) continue;
        if (/^={2,}/.test(line)) continue;
        if (/^\[\[(?:File|Category):/i.test(line)) continue;
        if (/^(?:\{\{|<\/?|\|-|!)/.test(line)) continue;
        line = line
            .replace(/^\*+\s*/, '')
            .replace(/^:+\s*/, '')
            .replace(/^\|\s*/, '')
            .replace(/\{\{[^}]+\}\}/g, ' ')
            .replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1')
            .replace(/\[\[([^\]]+)\]\]/g, '$1')
            .replace(/'''?/g, '')
            .replace(/<\/?[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        // Strip "Hero: " speaker prefixes for matching spoken text
        line = line.replace(/^[A-Za-z0-9 .:'-]+?:\s*/, '');
        if (line.length < 6) continue;
        out.push(line);
        const quoted = line.match(/"([^"]{6,})"/g);
        if (quoted) for (const q of quoted) out.push(q.replace(/^"|"$/g, ''));
    }
    return out;
}

/**
 * Parse *'''Hero''': line exchanges from Interactions body.
 * @param {string} body
 * @returns {Array<{ speakers: string[], lines: Array<{ hero: string, text: string }>, fingerprint: string }>}
 */
function parseInteractionExchanges(body) {
    /** @type {Array<{ speakers: string[], lines: Array<{ hero: string, text: string }>, fingerprint: string }>} */
    const exchanges = [];
    /** @type {Array<{ hero: string, text: string }>} */
    let current = [];

    const flush = () => {
        if (current.length < 2) {
            current = [];
            return;
        }
        const speakers = [...new Set(current.map((l) => l.hero))];
        if (speakers.length < 2) {
            current = [];
            return;
        }
        // Cap runaway merges from broken table parsing
        if (current.length > 8 || speakers.length > 3) {
            current = [];
            return;
        }
        const fingerprint = current.map((l) => `${l.hero}:${coreKey(l.text)}`).join('|');
        exchanges.push({
            speakers,
            lines: current,
            fingerprint,
        });
        current = [];
    };

    for (const rawLine of String(body || '').split(/\n/)) {
        const trimmed = rawLine.trim();
        // Only end exchanges on table row boundaries — not on cell openers.
        if (trimmed === '|-' || trimmed === '|}') {
            flush();
            continue;
        }
        const m = rawLine.match(/^\*+\s*'''([^']+)'''\s*:\s*(.+)$/);
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
        current.push({ hero: m[1].trim(), text });
    }
    flush();
    return exchanges;
}

function buildSectionIndex(wikitext) {
    /** @type {Map<string, Array<{ section: string, quote: string, key: string }>>} */
    const index = new Map();
    for (const section of splitWikitextSections(wikitext)) {
        const bucket = normalizeSectionBucket(section.title);
        if (SKIP_SECTIONS.has(bucket) || !SECTION_PRIORITY.includes(bucket)) continue;
        const quotes = extractQuoteCandidates(section.body);
        const nested = section.body.split(/\n(?=={3}\s*[^=].*?={3}\s*$)/m);
        for (const nest of nested) {
            const nestMatch = nest.match(/^={3}\s*([^=]+?)\s*={3}\s*\n?([\s\S]*)$/);
            if (nestMatch) quotes.push(...extractQuoteCandidates(nestMatch[2] || ''));
        }
        if (!index.has(bucket)) index.set(bucket, []);
        const seen = new Set();
        for (const quote of quotes) {
            const key = coreKey(quote);
            if (!key || key.length < 10 || seen.has(key)) continue;
            seen.add(key);
            index.get(bucket).push({ section: bucket, quote, key });
        }
    }
    return index;
}

function matchLabelToWiki(label, indexBySection) {
    const labelKey = coreKey(label);
    if (!labelKey || labelKey.length < 10) return null;

    for (const section of SECTION_PRIORITY) {
        const rows = indexBySection.get(section) || [];
        for (const row of rows) {
            if (row.key === labelKey) {
                return { section, quote: row.quote, how: 'exact-core', score: 100 };
            }
        }
    }

    /** @type {{ section: string, quote: string, how: string, score: number }|null} */
    let best = null;
    for (const section of SECTION_PRIORITY) {
        if (EXACT_ONLY_BUCKETS.has(section)) continue;
        const rows = indexBySection.get(section) || [];
        for (const row of rows) {
            const shorter = Math.min(row.key.length, labelKey.length);
            const longer = Math.max(row.key.length, labelKey.length);
            if (shorter < 28) continue;
            if (longer / shorter > 1.12) continue;
            if (row.key.startsWith(labelKey) || labelKey.startsWith(row.key)) {
                const score = 92;
                if (!best || score > best.score) {
                    best = { section, quote: row.quote, how: 'strict-prefix', score };
                }
            }
        }
    }
    return best;
}

function loadCacheWikitext(pageKey) {
    const cacheFile = path.join(CACHE_DIR, `${pageKey.replace(/[\\/:*?"<>|]/g, '_')}.wikitext`);
    if (!fs.existsSync(cacheFile)) return null;
    return fs.readFileSync(cacheFile, 'utf8');
}

const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'));
const conversations = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8')).conversations || [];

/** Build conversation spoken-key set for coverage checks */
const conversationKeys = new Set();
const conversationFingerprints = new Set();
for (const conversation of conversations) {
    const lineKeys = [];
    for (const line of conversation.lines || []) {
        const clean = stripDialogueSubtitleMarkup(String(line.subtitles || ''));
        const key = coreKey(clean);
        if (key) {
            conversationKeys.add(key);
            lineKeys.push(`${String(line.hero || '').trim()}:${key}`);
        }
        const voicePart = String(line.voice || '');
        const idx = voicePart.indexOf('_-_');
        if (idx >= 0) {
            const vk = coreKey(voicePart.slice(idx + 3).replace(/_/g, ' '));
            if (vk) conversationKeys.add(vk);
        }
    }
    if (lineKeys.length >= 2) {
        conversationFingerprints.add(lineKeys.join('|'));
        // Also store unordered pair coverage via consecutive pairs
        for (let i = 0; i < lineKeys.length - 1; i += 1) {
            conversationFingerprints.add(`${lineKeys[i]}|${lineKeys[i + 1]}`);
        }
    }
}

const unused = audit.unusedDialogueNotImported || [];
const byHero = new Map();
for (const row of unused) {
    if (!byHero.has(row.hero)) byHero.set(row.hero, []);
    byHero.get(row.hero).push(row);
}

/** @type {Array<object>} */
const classified = [];
/** @type {Record<string, number>} */
const bucketCounts = {};
for (const known of [...SECTION_PRIORITY, 'Unmatched', 'No wiki page']) bucketCounts[known] = 0;

/** @type {Array<object>} */
const missingInteractions = [];
const seenMissingFp = new Set();

const heroes = [...byHero.keys()].sort((a, b) => a.localeCompare(b));
console.log(`Strict-classifying ${unused.length} extract-only unused lines…`);

for (const hero of heroes) {
    const pageKey = WIKI_HERO_PAGE[hero] || hero.replace(/ /g, '_');
    const wikitext = loadCacheWikitext(pageKey);
    const rows = byHero.get(hero) || [];

    if (!wikitext) {
        for (const row of rows) {
            classified.push({
                ...row,
                wikiBucket: 'No wiki page',
                wikiQuote: '',
                matchHow: 'no-page',
                matchScore: 0,
                wikiPage: `${pageKey}/Quotes`,
            });
            bucketCounts['No wiki page'] += 1;
        }
        continue;
    }

    const index = buildSectionIndex(wikitext);
    let matched = 0;
    for (const row of rows) {
        const hit = matchLabelToWiki(row.label, index);
        const wikiBucket = hit?.section || 'Unmatched';
        classified.push({
            hero: row.hero,
            label: row.label,
            atlasName: row.atlasName,
            sourceRel: row.sourceRel,
            wikiBucket,
            wikiQuote: hit?.quote || '',
            matchHow: hit?.how || 'none',
            matchScore: hit?.score || 0,
            wikiPage: `${pageKey}/Quotes`,
        });
        bucketCounts[wikiBucket] = (bucketCounts[wikiBucket] || 0) + 1;
        if (hit) matched += 1;
    }

    // Missing full interactions from this hero's Interactions section
    const interactionsSection = splitWikitextSections(wikitext).find(
        (s) => normalizeSectionBucket(s.title) === 'Interactions',
    );
    if (interactionsSection) {
        for (const exchange of parseInteractionExchanges(interactionsSection.body)) {
            if (exchange.lines.length < 2) continue;
            // Skip Favorite Animals opener exchanges (tracked separately)
            const texts = exchange.lines.map((l) => l.text.toLowerCase()).join(' ');
            if (texts.includes('favorite animal')) continue;
            if (exchange.lines.some((l) => /favorite animal/i.test(l.text))) continue;
            // Skip wiki template / stub garbage
            if (exchange.lines.some((l) => /one of the following/i.test(l.text))) continue;
            if (exchange.lines.every((l) => l.text.length < 12)) continue;

            const fp = exchange.fingerprint;
            if (seenMissingFp.has(fp)) continue;

            const covered =
                conversationFingerprints.has(fp) ||
                exchange.lines.every((l) => conversationKeys.has(coreKey(l.text)));

            // Partial: majority of lines present
            const hitCount = exchange.lines.filter((l) => conversationKeys.has(coreKey(l.text))).length;
            const ratio = hitCount / exchange.lines.length;
            if (covered || ratio >= 0.75) continue;

            // Only keep if at least one line appears in unused MatchTalk for involved heroes
            const unusedLabels = unused.filter((u) =>
                exchange.speakers.some(
                    (sp) =>
                        normalizeHeroRough(sp) === normalizeHeroRough(u.hero) &&
                        (coreKey(u.label) === coreKey(
                            exchange.lines.find((l) => normalizeHeroRough(l.hero) === normalizeHeroRough(u.hero))
                                ?.text || '',
                        ) ||
                            coreKey(u.label).includes(coreKey(
                                exchange.lines.find((l) => normalizeHeroRough(l.hero) === normalizeHeroRough(sp))
                                    ?.text || '',
                            ).slice(0, 24))),
                ),
            );

            const hasUnusedHit = exchange.lines.some((line) => {
                const key = coreKey(line.text);
                return unused.some(
                    (u) =>
                        normalizeHeroRough(u.hero) === normalizeHeroRough(line.hero) &&
                        (coreKey(u.label) === key ||
                            (key.length >= 20 &&
                                (coreKey(u.label).startsWith(key) || key.startsWith(coreKey(u.label))))),
                );
            });

            if (!hasUnusedHit && hitCount === 0) {
                // Still flag if none of the spoken lines exist in conversations at all
                const noneInConv = exchange.lines.every((l) => !conversationKeys.has(coreKey(l.text)));
                if (!noneInConv) continue;
            } else if (!hasUnusedHit) {
                continue;
            }

            seenMissingFp.add(fp);
            missingInteractions.push({
                speakers: exchange.speakers,
                lineCount: exchange.lines.length,
                coveredLineCount: hitCount,
                preview: exchange.lines.map((l) => `${l.hero}: ${l.text}`).join(' / '),
                lines: exchange.lines,
                sourceHeroPage: `${pageKey}/Quotes#Interactions`,
            });
        }
    }

    console.log(`  ${hero}: ${matched}/${rows.length} strict-matched`);
}

function normalizeHeroRough(name) {
    return String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

classified.sort(
    (a, b) =>
        String(a.wikiBucket).localeCompare(String(b.wikiBucket)) ||
        String(a.hero).localeCompare(String(b.hero)) ||
        String(a.label).localeCompare(String(b.label)),
);

missingInteractions.sort((a, b) => b.lineCount - a.lineCount || a.preview.localeCompare(b.preview));

const report = {
    generatedAt: new Date().toISOString(),
    matching: 'strict-exact-or-near-prefix; no word-overlap; exact-only for Abilities/PvE/Cosmetics/Mission/Eliminations/Call-Outs/Communication',
    sourceAudit: audit.generatedAt,
    summary: {
        classifiedTotal: classified.length,
        bucketCounts,
        inVoicelinesUnusedRemaining: audit.summary?.unusedDialogueInVoicelines ?? null,
        missingInteractions: missingInteractions.length,
    },
    rows: classified,
};

fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);

function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

fs.writeFileSync(
    OUT_CSV,
    [
        'wikiBucket,hero,label,matchHow,matchScore,wikiQuote,atlasName,sourceRel,wikiPage',
        ...classified.map((row) =>
            [
                row.wikiBucket,
                row.hero,
                row.label,
                row.matchHow,
                row.matchScore,
                row.wikiQuote,
                row.atlasName,
                row.sourceRel,
                row.wikiPage,
            ]
                .map(csvEscape)
                .join(','),
        ),
    ].join('\n') + '\n',
);

fs.writeFileSync(
    OUT_MISSING_INTERACTIONS,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), count: missingInteractions.length, exchanges: missingInteractions }, null, 2)}\n`,
);
fs.writeFileSync(
    OUT_MISSING_INTERACTIONS_CSV,
    [
        'speakers,lineCount,coveredLineCount,preview,sourceHeroPage',
        ...missingInteractions.map((row) =>
            [row.speakers.join('+'), row.lineCount, row.coveredLineCount, row.preview, row.sourceHeroPage]
                .map(csvEscape)
                .join(','),
        ),
    ].join('\n') + '\n',
);

// Favorite Animals gaps (recompute from live conversations after wiring)
const faLive = conversations.find((c) => c.id === FA_ID);
const faPathHeroes = new Set(
    (faLive?.paths || []).map((p) => String(p.label || '').split(' — ')[0].replace(/^D\.va$/i, 'D.Va')),
);
const expectedFaHeroes = [
    'Ana', 'Anran', 'Ashe', 'Baptiste', 'Bastion', 'Brigitte', 'Cassidy', 'D.Va', 'Domina',
    'Doomfist', 'Echo', 'Emre', 'Freja', 'Genji', 'Hanzo', 'Hazard', 'Illari', 'Jetpack Cat',
    'Junker Queen', 'Junkrat', 'Juno', 'Kiriko', 'Lifeweaver', 'Mauga', 'Mei', 'Mercy', 'Mizuki',
    'Moira', 'Orisa', 'Pharah', 'Ramattra', 'Reaper', 'Reinhardt', 'Roadhog', 'Shion', 'Sierra',
    'Sigma', 'Sojourn', 'Soldier 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer', 'Vendetta',
    'Venture', 'Widowmaker', 'Winston', 'Wrecking Ball', 'Wuyang', 'Zarya', 'Zenyatta',
];
const faGaps = {
    generatedAt: new Date().toISOString(),
    conversationId: FA_ID,
    pathCount: faLive?.paths?.length || 0,
    presentPathHeroes: [...faPathHeroes].sort((a, b) => a.localeCompare(b)),
    missingHeroes: expectedFaHeroes.filter((hero) => !faPathHeroes.has(hero)),
};
fs.writeFileSync(OUT_FA_GAPS, `${JSON.stringify(faGaps, null, 2)}\n`);

console.log('\nStrict bucket totals:');
for (const [bucket, count] of Object.entries(bucketCounts).sort((a, b) => b[1] - a[1])) {
    if (!count) continue;
    console.log(`  ${bucket}: ${count}`);
}
console.log(`\nMissing full interactions flagged: ${missingInteractions.length}`);
console.log(`Favorite Animals missing heroes: ${faGaps.missingHeroes.join(', ')}`);
console.log(`Wrote ${OUT_JSON}`);
console.log(`Wrote ${OUT_MISSING_INTERACTIONS_CSV}`);
console.log(`Wrote ${OUT_FA_GAPS}`);
