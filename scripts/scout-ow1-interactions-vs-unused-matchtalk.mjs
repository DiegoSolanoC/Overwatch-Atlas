#!/usr/bin/env node
/**
 * SCOUT ONLY — do not import/wire.
 *
 * Compare unused MatchTalk dialogue labels to Interactions on
 * `{Hero}/Quotes/Overwatch_1` wiki pages (OW1-era heroes only).
 *
 * Usage:
 *   node scripts/scout-ow1-interactions-vs-unused-matchtalk.mjs
 *
 * Writes (outside repo):
 *   …/overwatch-atlas-audits/_scout-ow1-interactions-vs-unused-matchtalk.json
 *   …/overwatch-atlas-audits/_scout-ow1-interactions-vs-unused-matchtalk.csv
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

ensureAuditWorkspace();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const UNUSED_AUDIT = auditPath('_audit-matchtalk-unused.json');
const OUT_JSON = auditPath('_scout-ow1-interactions-vs-unused-matchtalk.json');
const OUT_CSV = auditPath('_scout-ow1-interactions-vs-unused-matchtalk.csv');
const OW1_CACHE = path.join(WIKI_QUOTES_CACHE_DIR, 'overwatch_1');

const WIKI_ORIGIN = 'https://overwatch.fandom.com';
const USER_AGENT = 'OverwatchAtlasOw1Scout/1.0 (local read-only scout)';

/** Heroes that launched after the OW2 shift — skip OW1 pages. */
const POST_OW2_HEROES = new Set(
    [
        'Sojourn',
        'Junker Queen',
        'Kiriko',
        'Ramattra',
        'Lifeweaver',
        'Illari',
        'Mauga',
        'Venture',
        'Juno',
        'Hazard',
        'Freja',
        'Wuyang',
        'Vendetta',
        'Anran',
        'Emre',
        'Domina',
        'Mizuki',
        'Jetpack Cat',
        'Sierra',
        'Shion',
        'D.mon',
        'D.Mon',
    ].map((h) => heroKey(h)),
);

/** OW1-era heroes to scout (MatchTalk folder name → wiki page title stem). */
const OW1_HEROES = [
    { folder: 'Ana', wiki: 'Ana' },
    { folder: 'Ashe', wiki: 'Ashe' },
    { folder: 'Baptiste', wiki: 'Baptiste' },
    { folder: 'Bastion', wiki: 'Bastion' },
    { folder: 'Brigitte', wiki: 'Brigitte' },
    { folder: 'Cassidy', wiki: 'Cassidy' },
    { folder: 'D.Va', wiki: 'D.Va' },
    { folder: 'Doomfist', wiki: 'Doomfist' },
    { folder: 'Echo', wiki: 'Echo' },
    { folder: 'Genji', wiki: 'Genji' },
    { folder: 'Hanzo', wiki: 'Hanzo' },
    { folder: 'Junkrat', wiki: 'Junkrat' },
    { folder: 'Lúcio', wiki: 'Lúcio' },
    { folder: 'Mei', wiki: 'Mei' },
    { folder: 'Mercy', wiki: 'Mercy' },
    { folder: 'Moira', wiki: 'Moira' },
    { folder: 'Orisa', wiki: 'Orisa' },
    { folder: 'Pharah', wiki: 'Pharah' },
    { folder: 'Reaper', wiki: 'Reaper' },
    { folder: 'Reinhardt', wiki: 'Reinhardt' },
    { folder: 'Roadhog', wiki: 'Roadhog' },
    { folder: 'Sigma', wiki: 'Sigma' },
    { folder: 'Soldier_ 76', wiki: 'Soldier:_76' },
    { folder: 'Sombra', wiki: 'Sombra' },
    { folder: 'Symmetra', wiki: 'Symmetra' },
    { folder: 'Torbjörn', wiki: 'Torbjörn' },
    { folder: 'Tracer', wiki: 'Tracer' },
    { folder: 'Widowmaker', wiki: 'Widowmaker' },
    { folder: 'Winston', wiki: 'Winston' },
    { folder: 'Wrecking Ball', wiki: 'Wrecking_Ball' },
    { folder: 'Zarya', wiki: 'Zarya' },
    { folder: 'Zenyatta', wiki: 'Zenyatta' },
];

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

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function splitInteractionsBody(wikitext) {
    const sections = String(wikitext || '').split(/\n(?=={2}\s*[^=].*?={2}\s*$)/m);
    for (const part of sections) {
        const match = part.match(/^={2}\s*([^=]+?)\s*={2}\s*\n?([\s\S]*)$/);
        if (!match) continue;
        const title = match[1].trim();
        if (/^interactions(\s*\(removed\))?$/i.test(title)) return match[2] || '';
    }
    return '';
}

/**
 * @param {string} body
 * @param {string} pageHero
 */
function parseInteractionExchanges(body, pageHero) {
    /** @type {Array<object>} */
    const exchanges = [];
    /** @type {Array<{ hero: string, text: string }>} */
    let current = [];

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
        if (current.some((l) => /one of the following/i.test(l.text))) {
            current = [];
            return;
        }
        exchanges.push({
            pageHero,
            speakers,
            lines: current.slice(),
            fingerprint: current.map((l) => `${heroKey(l.hero)}:${coreKey(l.text)}`).join('|'),
            preview: current.map((l) => `${l.hero}: ${l.text}`).join(' / '),
        });
        current = [];
    };

    for (const rawLine of String(body || '').split(/\n/)) {
        const trimmed = rawLine.trim();
        if (trimmed === '|-' || trimmed === '|}') {
            flush();
            continue;
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
        const hero = normalizeHero(m[1].trim().replace(/:$/, ''));
        current.push({ hero, text });
    }
    flush();
    return exchanges;
}

async function fetchOw1Wikitext(pageTitle) {
    fs.mkdirSync(OW1_CACHE, { recursive: true });
    const cacheFile = path.join(
        OW1_CACHE,
        `${pageTitle.replace(/[\\/:*?"<>|]/g, '_')}.wikitext`,
    );
    if (fs.existsSync(cacheFile)) {
        return { wikitext: fs.readFileSync(cacheFile, 'utf8'), fromCache: true, missing: false };
    }

    const apiUrl = new URL('/api.php', WIKI_ORIGIN);
    apiUrl.searchParams.set('action', 'parse');
    apiUrl.searchParams.set('page', pageTitle);
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('prop', 'wikitext');
    apiUrl.searchParams.set('redirects', '1');

    const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
        return { wikitext: '', fromCache: false, missing: true, error: `HTTP ${res.status}` };
    }
    const json = await res.json();
    if (json.error) {
        return {
            wikitext: '',
            fromCache: false,
            missing: true,
            error: json.error.info || json.error.code,
        };
    }
    const wikitext = json.parse?.wikitext?.['*'] || '';
    if (!wikitext) {
        return { wikitext: '', fromCache: false, missing: true, error: 'empty wikitext' };
    }
    fs.writeFileSync(cacheFile, wikitext, 'utf8');
    return { wikitext, fromCache: false, missing: false };
}

function ensureUnusedAudit() {
    if (fs.existsSync(UNUSED_AUDIT)) {
        try {
            const ageMs = Date.now() - fs.statSync(UNUSED_AUDIT).mtimeMs;
            if (ageMs < 1000 * 60 * 60 * 12) return JSON.parse(fs.readFileSync(UNUSED_AUDIT, 'utf8'));
        } catch {
            /* rebuild */
        }
    }
    console.log('Running audit-matchtalk-unused.mjs (needed for unused pool)…');
    const r = spawnSync(process.execPath, [path.join(__dirname, 'audit-matchtalk-unused.mjs')], {
        cwd: REPO,
        stdio: 'inherit',
        env: process.env,
    });
    if (r.status !== 0) {
        throw new Error(`audit-matchtalk-unused.mjs failed with status ${r.status}`);
    }
    return JSON.parse(fs.readFileSync(UNUSED_AUDIT, 'utf8'));
}

function loadConversationKeys() {
    const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    /** @type {Set<string>} */
    const keys = new Set();
    /** @type {Set<string>} heroKey|coreKey */
    const heroLineKeys = new Set();
    const conversations = Array.isArray(data) ? data : data.conversations || [];
    for (const conv of conversations) {
        for (const line of conv.lines || []) {
            const voice = String(line.voice || line.voicePrefix || '');
            const sub = stripDialogueSubtitleMarkup(String(line.subtitles || ''));
            const label = voice.includes('_-_')
                ? voice.split('_-_').slice(1).join('_-_').replace(/\.ogg$/i, '').replace(/_/g, ' ')
                : sub;
            const ck = coreKey(label || sub);
            if (ck.length >= 6) keys.add(ck);
            const hk = heroKey(line.character || line.hero || '');
            if (hk && ck.length >= 6) heroLineKeys.add(`${hk}|${ck}`);
        }
    }
    return { keys, heroLineKeys };
}

/**
 * Index unused MatchTalk rows by heroKey → [{label, core, path, atlasName, …}]
 * @param {object} unusedAudit
 */
function indexUnusedByHero(unusedAudit) {
    /** @type {Map<string, Array<object>>} */
    const byHero = new Map();
    const pools = [
        ...(unusedAudit.unusedDialogueNotImported || []),
        ...(unusedAudit.unusedDialogueInVoicelines || []),
    ];
    for (const row of pools) {
        const hero = normalizeHero(
            row.hero === 'Soldier_ 76' || row.hero === 'Soldier: 76' ? 'Soldier 76' : row.hero,
        );
        if (POST_OW2_HEROES.has(heroKey(hero))) continue;
        const label = String(row.label || row.dialogue || '').trim();
        const ck = coreKey(label);
        if (ck.length < 6) continue;
        const hk = heroKey(hero);
        if (!byHero.has(hk)) byHero.set(hk, []);
        byHero.get(hk).push({
            hero,
            label,
            core: ck,
            sourcePath: row.sourcePath || row.path || '',
            atlasName: row.atlasName || row.filename || '',
            pool: row.inVoicelines ? 'inVoicelinesUnused' : 'notImported',
        });
    }
    return byHero;
}

/**
 * @param {string} quoteCore
 * @param {Array<object>} unusedRows
 */
function findUnusedMatch(quoteCore, unusedRows) {
    if (!quoteCore || quoteCore.length < 6) return null;
    let best = null;
    for (const row of unusedRows) {
        const u = row.core;
        if (u === quoteCore) return { ...row, how: 'exact', score: 1 };
        const shorter = u.length <= quoteCore.length ? u : quoteCore;
        const longer = u.length <= quoteCore.length ? quoteCore : u;
        if (shorter.length >= 18 && longer.startsWith(shorter)) {
            const score = shorter.length / longer.length;
            if (score >= 0.85 && (!best || score > best.score)) {
                best = { ...row, how: 'prefix', score };
            }
        } else if (shorter.length >= 22 && longer.includes(shorter)) {
            const score = shorter.length / longer.length;
            if (score >= 0.8 && (!best || score > best.score)) {
                best = { ...row, how: 'contains', score };
            }
        }
    }
    return best;
}

function csvEscape(value) {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

async function main() {
    const unusedAudit = ensureUnusedAudit();
    const unusedByHero = indexUnusedByHero(unusedAudit);
    const { keys: conversationKeys, heroLineKeys } = loadConversationKeys();

    /** @type {Array<object>} */
    const hits = [];
    /** @type {Array<object>} */
    const pageStatus = [];
    /** @type {Array<object>} */
    const ow1LinesNoUnused = [];

    let totalOw1Lines = 0;
    let totalExchanges = 0;
    let totalHits = 0;

    for (const { folder, wiki } of OW1_HEROES) {
        if (POST_OW2_HEROES.has(heroKey(folder))) continue;

        const pageTitle = `${wiki}/Quotes/Overwatch_1`;
        process.stdout.write(`Fetching ${pageTitle}… `);
        const fetched = await fetchOw1Wikitext(pageTitle);
        if (fetched.missing) {
            console.log(`MISSING (${fetched.error || 'n/a'})`);
            pageStatus.push({
                hero: folder,
                pageTitle,
                ok: false,
                error: fetched.error || 'missing',
            });
            continue;
        }
        console.log(fetched.fromCache ? 'cache' : 'ok');

        const body = splitInteractionsBody(fetched.wikitext);
        const exchanges = body ? parseInteractionExchanges(body, normalizeHero(folder === 'Soldier_ 76' ? 'Soldier 76' : folder)) : [];
        totalExchanges += exchanges.length;

        pageStatus.push({
            hero: folder,
            pageTitle,
            ok: true,
            interactionExchanges: exchanges.length,
            interactionLines: exchanges.reduce((n, e) => n + e.lines.length, 0),
            fromCache: fetched.fromCache,
        });

        for (const exchange of exchanges) {
            for (const line of exchange.lines) {
                if (POST_OW2_HEROES.has(heroKey(line.hero))) continue;
                const ck = coreKey(line.text);
                if (ck.length < 6) continue;
                totalOw1Lines += 1;

                const hk = heroKey(line.hero);
                const unusedRows = unusedByHero.get(hk) || [];
                const match = findUnusedMatch(ck, unusedRows);
                const inConversations =
                    conversationKeys.has(ck) || heroLineKeys.has(`${hk}|${ck}`);

                if (match) {
                    totalHits += 1;
                    hits.push({
                        pageHero: folder,
                        wikiPage: pageTitle,
                        speaker: line.hero,
                        quote: line.text,
                        unusedLabel: match.label,
                        matchHow: match.how,
                        matchScore: match.score,
                        unusedPool: match.pool,
                        unusedPath: match.sourcePath,
                        atlasName: match.atlasName,
                        alreadyInConversations: inConversations,
                        exchangePreview: exchange.preview,
                        partners: exchange.speakers.filter((s) => heroKey(s) !== hk),
                    });
                } else if (!inConversations) {
                    ow1LinesNoUnused.push({
                        pageHero: folder,
                        wikiPage: pageTitle,
                        speaker: line.hero,
                        quote: line.text,
                        exchangePreview: exchange.preview,
                    });
                }
            }
        }

        // be polite to the wiki API
        await new Promise((r) => setTimeout(r, 250));
    }

    // Deduplicate hits by speaker+quote core
    const seen = new Set();
    const uniqueHits = [];
    for (const h of hits) {
        const id = `${heroKey(h.speaker)}|${coreKey(h.quote)}|${coreKey(h.unusedLabel)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        uniqueHits.push(h);
    }
    uniqueHits.sort(
        (a, b) =>
            String(a.pageHero).localeCompare(String(b.pageHero)) ||
            String(a.speaker).localeCompare(String(b.speaker)) ||
            String(a.quote).localeCompare(String(b.quote)),
    );

    const byHero = {};
    for (const h of uniqueHits) {
        byHero[h.pageHero] = byHero[h.pageHero] || { hits: 0, alreadyWired: 0 };
        byHero[h.pageHero].hits += 1;
        if (h.alreadyInConversations) byHero[h.pageHero].alreadyWired += 1;
    }

    const unusedHitCount = uniqueHits.filter((h) => !h.alreadyInConversations).length;

    const report = {
        generatedAt: new Date().toISOString(),
        note: 'SCOUT ONLY — no imports, no conversation writes. OW1 Interactions vs unused MatchTalk.',
        unusedAuditGeneratedAt: unusedAudit.generatedAt || null,
        summary: {
            ow1HeroesScouted: pageStatus.filter((p) => p.ok).length,
            ow1PagesMissing: pageStatus.filter((p) => !p.ok).length,
            interactionExchanges: totalExchanges,
            interactionLinesParsed: totalOw1Lines,
            uniqueUnusedMatches: uniqueHits.length,
            unusedMatchesNotYetInConversations: unusedHitCount,
            unusedMatchesAlreadyInConversations: uniqueHits.length - unusedHitCount,
            ow1LinesMissingBothUnusedAndConversations: ow1LinesNoUnused.length,
        },
        byHero,
        pageStatus,
        matches: uniqueHits,
        // Cap orphan list in JSON for size; full list still useful as count
        ow1LinesWithNoUnusedMatchSample: ow1LinesNoUnused.slice(0, 80),
    };

    fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);

    const csvLines = [
        [
            'pageHero',
            'wikiPage',
            'speaker',
            'quote',
            'unusedLabel',
            'matchHow',
            'unusedPool',
            'alreadyInConversations',
            'partners',
            'exchangePreview',
        ].join(','),
    ];
    for (const h of uniqueHits) {
        csvLines.push(
            [
                h.pageHero,
                h.wikiPage,
                h.speaker,
                h.quote,
                h.unusedLabel,
                h.matchHow,
                h.unusedPool,
                h.alreadyInConversations,
                (h.partners || []).join('|'),
                h.exchangePreview,
            ]
                .map(csvEscape)
                .join(','),
        );
    }
    fs.writeFileSync(OUT_CSV, `${csvLines.join('\n')}\n`);

    console.log('\n=== SCOUT SUMMARY (no changes made) ===');
    console.log(JSON.stringify(report.summary, null, 2));
    console.log(`\nWrote:\n  ${OUT_JSON}\n  ${OUT_CSV}`);
    console.log('\nPer-hero unused MatchTalk ↔ OW1 Interaction hits:');
    for (const [hero, stats] of Object.entries(byHero).sort((a, b) => b[1].hits - a[1].hits)) {
        console.log(
            `  ${hero}: ${stats.hits} matches (${stats.hits - stats.alreadyWired} not in conversations, ${stats.alreadyWired} already wired)`,
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
