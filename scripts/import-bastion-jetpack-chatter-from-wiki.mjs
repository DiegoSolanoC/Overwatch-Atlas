#!/usr/bin/env node
/**
 * Rebuild Bastion + Jetpack Cat theater chatters from wiki Quotes.
 *
 * Bastion: wiki Audio titles are labeled — download those; fill empty stub
 * rows (won/lost/final round, …) from HeroVoice .0B2 folders.
 *
 * Jetpack Cat: many {{Audio|Jetpack Cat - .ogg}} stubs — keep wiki spoken
 * labels, pull .03F takes from the matching extract category folder; download
 * real File: titles (Swedish lines, etc.) when present.
 *
 * Preserves map / skin / partner / non-core disclaimer lines.
 *
 * Usage:
 *   node scripts/import-bastion-jetpack-chatter-from-wiki.mjs --dry-run
 *   node scripts/import-bastion-jetpack-chatter-from-wiki.mjs
 *   node scripts/import-bastion-jetpack-chatter-from-wiki.mjs --hero Bastion
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    downloadWikiVoicelineFile,
    wikiFileTitleToTheaterFilename,
    WIKI_USER_AGENT,
} from './lib/wiki-voiceline-download.mjs';
import { stripWikiMarkup } from './lib/wiki-markup.mjs';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import { DEFAULT_DIALOGUE_SCENE } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import {
    THEATER_CHATTER_CORE_DISCLAIMERS,
    THEATER_CHATTER_DATAMINE_SOURCES,
} from './lib/theater-chatter-datamine-map.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const WIKI_CACHE = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'interactions',
    'overwatch-atlas-audits',
    '_wiki-quotes-cache',
);

const dryRun = process.argv.includes('--dry-run');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

/** @type {Record<string, { wikiPage: string, extract: string, voicePrefix: string }>} */
const HEROES = {
    Bastion: { wikiPage: 'Bastion/Quotes', extract: 'Bastion', voicePrefix: 'Bastion' },
    'Jetpack Cat': {
        wikiPage: 'Jetpack Cat/Quotes',
        extract: 'Jetpack Cat',
        voicePrefix: 'Jetpack_Cat',
    },
};

/** Wiki trigger → atlas disclaimer (+ extract folders for stub fill). */
const TRIGGER_MAP = [
    { re: /^hero\s*selected$/i, disclaimer: 'Hero Selected', folders: ['HeroSelect'] },
    { re: /set[- ]?up/i, disclaimer: '', folders: ['SetupHere'] },
    { re: /^match\s*start$/i, disclaimer: 'Match Start', folders: ['MatchStartTalk'] },
    { re: /^general$/i, disclaimer: null, folders: [] }, // sub-trigger under Match Start
    {
        re: /won\s*previous/i,
        disclaimer: 'Won Previous Round',
        folders: ['Match/MatchStartRoundWin'],
    },
    {
        re: /lost\s*previous/i,
        disclaimer: 'Lost Previous Round',
        folders: ['Match/MatchStartRoundLoss'],
    },
    {
        re: /final\s*round/i,
        disclaimer: 'Final Round',
        folders: ['Match/MatchStartFinalRound'],
    },
    { re: /^respawn$/i, disclaimer: 'Respawn', folders: ['Respawn'] },
    { re: /waiting/i, disclaimer: 'Waiting on Reinforcements', folders: ['NeedHealer'] },
    { re: /^perk/i, disclaimer: 'Perk Selected', folders: [] },
    { re: /^(minor|major)$/i, disclaimer: null, folders: [] },
    {
        re: /health\s*pack|pick\s*up\s*health/i,
        disclaimer: 'Health Pack',
        folders: ['HealthPack'],
    },
    {
        re: /fully\s*healed/i,
        disclaimer: 'Fully Healed',
        folders: ['HealthRestoredFriendly'],
    },
    { re: /damage\s*boost/i, disclaimer: 'Damage Boosted', folders: ['DamageBoosted'] },
    { re: /on\s*fire/i, disclaimer: 'On Fire', folders: ['OnFire'] },
    { re: /nano/i, disclaimer: 'Nano Boosted', folders: ['NanoBoosted'] },
    {
        re: /negative\s*status|discord|hacked/i,
        disclaimer: 'Negative Status',
        folders: ['Discorded'],
    },
    { re: /^resurrected$/i, disclaimer: 'Resurrected', folders: ['Resurrected'] },
    {
        re: /enemy\s*resurrect/i,
        disclaimer: 'Enemy Resurrected',
        folders: ['EnemyResurrect'],
    },
    { re: /voted\s*epic/i, disclaimer: 'Voted Epic', folders: ['VotedEpic'] },
    {
        re: /voted\s*legendary/i,
        disclaimer: 'Voted Legendary',
        folders: ['VotedLegendary'],
    },
    {
        re: /^final\s*blow$/i,
        disclaimer: 'Elimination — Final Blow',
        folders: ['Elimination'],
    },
    { re: /^scenario$/i, disclaimer: null, folders: [] },
    {
        re: /^assist$/i,
        disclaimer: 'Elimination — Assist',
        folders: ['Teammate/KillSeen'],
    },
    {
        re: /kill\s*streak/i,
        disclaimer: 'Elimination — Kill Streak',
        folders: ['KillStreak'],
    },
    {
        re: /multi\s*kill/i,
        disclaimer: 'Elimination — Multi Kill',
        folders: ['Multikill'],
    },
    {
        re: /team\s*kill/i,
        disclaimer: 'Elimination — Team Kill',
        folders: ['TeamKill'],
    },
    {
        re: /^revenge$/i,
        disclaimer: 'Elimination — Revenge',
        folders: ['Revenge'],
    },
    {
        re: /rescuing\s*ally|low\s*hp/i,
        disclaimer: 'Elimination — Rescuing Ally on Low HP',
        folders: ['Teammate/Rescue', 'Teammate/Killed'],
    },
    {
        re: /melee/i,
        disclaimer: 'Elimination — Melee Final Blow',
        folders: ['MeleeEnemyKilledRemark'],
    },
    {
        re: /environmental/i,
        disclaimer: 'Elimination — Environmental Final Blow',
        folders: ['ScreamFall', 'Knockdown'],
    },
    {
        re: /deployable|turret|teleporter|shield\s*gen/i,
        disclaimer: 'Elimination — Deployable Eliminated',
        folders: [
            'Turret/EnemyTurretDestroyed',
            'Teleporter/EnemyTeleporterDestroyed',
            'ShieldGenerator/EnemyShieldGenDestroyed',
        ],
    },
    {
        re: /compliment/i,
        disclaimer: 'Elimination — Final Blow Compliment',
        folders: ['Teammate/KillSeen'],
    },
    {
        re: /looking\s*at\s*earth/i,
        disclaimer: 'Looking At Earth',
        folders: ['LookingAtEarth'],
    },
];

const EXTRA_CORE = new Set([
    ...THEATER_CHATTER_CORE_DISCLAIMERS,
    'Waiting on Reinforcements',
    'Perk Selected',
    'Elimination — Assist',
    'Elimination — Rescuing Ally on Low HP',
    'Elimination — Environmental Final Blow',
]);

async function sleep(ms) {
    await new Promise((r) => setTimeout(r, ms));
}

async function retry(fn, attempts = 12) {
    let last;
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await fn();
        } catch (err) {
            last = err;
            await sleep(400 * (i + 1));
        }
    }
    throw last;
}

async function atomicWriteJson(filePath, data) {
    const tmp = path.join(process.env.TEMP || REPO, `ow-wiki-chatter-${process.pid}.json`);
    await fsp.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await retry(() => fsp.copyFile(tmp, filePath));
    await fsp.unlink(tmp).catch(() => {});
}

function coreKey(text) {
    const raw = String(text || '');
    const cleaned = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const onlyParen = /^\([^)]+\)$/.test(cleaned);
    let s = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ');
    if (onlyParen) s = s.replace(/[()]/g, ' ');
    else {
        s = s
            .replace(
                /\((swedish|korean|japanese|arabic|latin|turkish|danish|italian|swedish|french|spanish|portuguese)\)/gi,
                ' $1 ',
            )
            .replace(/\([^)]*\)/g, ' ');
    }
    return s.replace(/[\u2018\u2019\u201C\u201D`']/g, '').replace(/[^a-z0-9]+/g, '');
}

function isStubWikiAudio(wikiAudio) {
    const raw = String(wikiAudio || '')
        .replace(/^File:/i, '')
        .trim();
    if (!raw) return true;
    return /^(bastion|jetpack\s*cat)\s*-\s*\.ogg$/i.test(raw);
}

function cleanSpoken(cell, heroId = '') {
    const raw = String(cell || '').trim();
    if (!raw) return { spoken: '', note: '' };

    let note = '';
    const small =
        raw.match(/<small>\s*''?\(([\s\S]*?)\)''?\s*<\/small>/i)
        || raw.match(/<small>\s*''([\s\S]*?)''\s*<\/small>/i)
        || raw.match(/<small>([\s\S]*?)<\/small>/i);
    if (small) {
        note = String(small[1] || '')
            .replace(/\{\{al\|([^}|]+)(?:\|[^}]*)?\}\}/gi, '$1')
            .replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1')
            .replace(/\[\[([^\]]+)\]\]/g, '$1');
        note = stripWikiMarkup(note).replace(/^['"()]+|['"()]+$/g, '').trim();
    }

    let spoken = '';
    if (/\{\{QuoteTranslation/i.test(raw)) {
        const quote = raw.match(/\|\s*quote\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
        const translation = raw.match(/\|\s*translation\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
        const script = raw.match(/\|\s*script\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
        let q = quote
            .replace(/''\*([^*]+)\*''/g, '($1)')
            .replace(/'\*([^*]+)\*'/g, '($1)')
            .replace(/\*([^*]+)\*/g, '($1)');
        q = stripWikiMarkup(q);
        if (translation && script) {
            spoken = stripWikiMarkup(`(${script}) ${translation}`);
        } else if (heroId === 'Bastion' || /\bbeeps?\b|\*beep/i.test(quote)) {
            spoken = q || stripWikiMarkup(translation);
        } else if (translation && q && coreKey(translation) !== coreKey(q)) {
            // Jetpack Cat Swedish → English translation rows.
            spoken = `(Swedish) ${stripWikiMarkup(translation)}`;
        } else if (translation) {
            spoken = stripWikiMarkup(translation);
        } else {
            spoken = q;
        }
    } else {
        spoken = raw
            .replace(/<small>[\s\S]*?<\/small>/gi, ' ')
            .replace(/''\*([^*]+)\*''/g, '($1)')
            .replace(/'\*([^*]+)\*'/g, '($1)')
            .replace(/\*([^*]+)\*/g, '($1)');
        spoken = stripWikiMarkup(spoken);
    }

    spoken = spoken.replace(/\s+/g, ' ').trim();
    return { spoken, note };
}

function classifyTrigger(hit) {
    const t = String(hit || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t) return null;
    for (const row of TRIGGER_MAP) {
        if (row.re.test(t)) {
            return { hit: t, disclaimer: row.disclaimer, folders: row.folders };
        }
    }
    return null;
}

function composeDisclaimer(base, note, scenarioMode) {
    const n = String(note || '').trim();
    if (scenarioMode) {
        const body = n || 'Scenario';
        return `Elimination — Scenario — ${body.replace(/^eliminating\s+/i, 'eliminating ')}`;
    }
    if (!base && !n) return '';
    if (!n) return base;
    if (/^elimination/i.test(base)) {
        return `${base} — ${n}`;
    }
    if (coreKey(base) === coreKey(n)) return base;
    return `${base} — ${n}`;
}

/**
 * @param {string} wikitext
 * @param {'chatter'|'eliminations'} mode
 */
function parseSection(wikitext, mode, heroId = '') {
    const body =
        mode === 'chatter'
            ? String(wikitext || '').match(/==\s*Chatter\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i)?.[1]
                || ''
            : String(wikitext || '').match(
                /==\s*Eliminations\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i,
            )?.[1] || '';

    const rows = body.split(/\n\|-/);
    /** @type {Array<{ disclaimer: string, spoken: string, wikiAudios: string[], folders: string[] }>} */
    const out = [];

    let baseDisclaimer = '';
    let folders = /** @type {string[]} */ ([]);
    let scenarioMode = false;
    let active = mode === 'eliminations';

    for (const row of rows) {
        const hits = [...row.matchAll(/'''([^']{2,120})'''/g)].map((m) =>
            m[1].replace(/<[^>]+>/g, '').trim(),
        );

        for (const hit of hits) {
            if (/^(trigger|quote|audio|unused)$/i.test(hit)) continue;
            const classified = classifyTrigger(hit);
            if (!classified) {
                if (mode === 'chatter' && /call[- ]?out|enemy sighted|hero change/i.test(hit)) {
                    active = false;
                }
                continue;
            }
            if (classified.disclaimer === null) {
                if (/^scenario$/i.test(hit)) scenarioMode = true;
                if (/^general$/i.test(hit)) scenarioMode = false;
                if (/^(minor|major)$/i.test(hit) && !baseDisclaimer) {
                    baseDisclaimer = 'Perk Selected';
                }
                continue;
            }
            baseDisclaimer = classified.disclaimer;
            folders = classified.folders || [];
            scenarioMode = false;
            active = true;
            if (/^final\s*blow$/i.test(hit)) scenarioMode = false;
        }

        if (!active || (baseDisclaimer === '' && mode === 'eliminations' && !scenarioMode)) {
            // Set-Up can be empty disclaimer — still active for chatter.
            if (!(mode === 'chatter' && active && baseDisclaimer === '')) continue;
        }
        if (!active) continue;

        const wikiAudios = [...row.matchAll(/\{\{Audio\|([^}]+)\}\}/gi)].map((m) =>
            String(m[1]).trim(),
        );

        /** @type {string[]} */
        const spokens = [];
        /** @type {string[]} */
        const notes = [];
        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell) continue;
            if (/rowspan|colspan|<center|<big/i.test(cell) && !/\{\{QuoteTranslation/i.test(cell)) {
                continue;
            }
            if (/'''/.test(cell) && cell.length < 90 && !/\{\{QuoteTranslation/i.test(cell)) {
                continue;
            }
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;
            const { spoken, note } = cleanSpoken(cell, heroId);
            if (spoken.length >= 2) {
                spokens.push(spoken);
                notes.push(note);
            } else if (note) {
                notes.push(note);
            }
        }

        if (!spokens.length && !wikiAudios.length) continue;

        if (!spokens.length) {
            // Empty quote + audio stubs → fill later from extract folders.
            out.push({
                disclaimer: composeDisclaimer(baseDisclaimer, notes[0] || '', scenarioMode),
                spoken: '',
                wikiAudios,
                folders,
            });
            continue;
        }

        for (let i = 0; i < spokens.length; i += 1) {
            const spoken = spokens[i];
            const note = notes[i] || notes[0] || '';
            const disclaimer = composeDisclaimer(baseDisclaimer, note, scenarioMode);
            // Pair spoken with audio(s) on same row: if multiple audios and one spoken, all audios are variants.
            const audios =
                spokens.length === 1
                    ? wikiAudios
                    : wikiAudios[i]
                      ? [wikiAudios[i]]
                      : wikiAudios.length
                        ? [wikiAudios[Math.min(i, wikiAudios.length - 1)]]
                        : [];
            out.push({ disclaimer, spoken, wikiAudios: audios, folders });
        }
    }

    return out;
}

async function fetchWiki(pageTitle, cacheStem) {
    fs.mkdirSync(WIKI_CACHE, { recursive: true });
    const cachePath = path.join(WIKI_CACHE, `${cacheStem}.wikitext`);
    if (fs.existsSync(cachePath) && !process.argv.includes('--refresh-wiki')) {
        return fs.readFileSync(cachePath, 'utf8');
    }

    const origins = [
        'https://overwatch.weirdgloop.org',
        'https://overwatch.fandom.com',
    ];
    let lastErr;
    for (const origin of origins) {
        try {
            const api = new URL('/api.php', origin);
            api.searchParams.set('action', 'parse');
            api.searchParams.set('page', pageTitle);
            api.searchParams.set('prop', 'wikitext');
            api.searchParams.set('format', 'json');
            api.searchParams.set('redirects', '1');
            const res = await fetch(api, { headers: { 'User-Agent': WIKI_USER_AGENT } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const text = json?.parse?.wikitext?.['*'] || json?.parse?.wikitext;
            if (!text) throw new Error('empty wikitext');
            await fsp.writeFile(cachePath, String(text), 'utf8');
            return String(text);
        } catch (err) {
            lastErr = err;
        }
    }
    if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath, 'utf8');
    throw lastErr || new Error(`Failed to fetch ${pageTitle}`);
}

function listExtractClips(extractRoot, folder) {
    const abs = path.join(extractRoot, folder);
    if (!fs.existsSync(abs)) return [];
    /** @type {Array<{ source: string, label: string }>} */
    const out = [];
    function walk(dir) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(ent.name)) continue;
            const m0 = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            if (m0) {
                out.push({ source: full, label: m0[1] });
                continue;
            }
            if (/\.03F\./i.test(ent.name)) {
                out.push({ source: full, label: '' });
            }
        }
    }
    walk(abs);
    return out;
}

function findExtractByLabel(extractRoot, folders, spoken) {
    const want = coreKey(spoken);
    if (!want) return [];
    /** @type {Array<{ source: string, label: string, score: number }>} */
    const hits = [];
    for (const folder of folders) {
        for (const clip of listExtractClips(extractRoot, folder)) {
            if (!clip.label) continue;
            const k = coreKey(clip.label);
            let score = 0;
            if (k === want) score = 100;
            else if (k.startsWith(want) || want.startsWith(k)) score = 80;
            else if (k.includes(want) || want.includes(k)) score = 50;
            if (score) hits.push({ ...clip, score });
        }
    }
    hits.sort((a, b) => b.score - a.score);
    const best = hits[0]?.score || 0;
    return hits.filter((h) => h.score >= Math.min(80, best));
}

function atlasName(prefix, spoken, variantIndex = 0) {
    const body = String(spoken || 'line')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_')
        .slice(0, 160);
    if (variantIndex <= 0) return `${prefix}_-_${body}.ogg`;
    return `${prefix}_-_${body}_(${variantIndex + 1}).ogg`;
}

function atlasFromWiki(wikiAudio) {
    try {
        const title = wikiAudio.startsWith('File:') ? wikiAudio : `File:${wikiAudio}`;
        return wikiFileTitleToTheaterFilename(title);
    } catch {
        return '';
    }
}

async function copyVoice(src, dest) {
    if (fs.existsSync(dest)) return;
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await retry(() => fsp.copyFile(src, dest));
}

function preserveNonCore(lines) {
    return (Array.isArray(lines) ? lines : []).filter((line) => {
        const d = String(line?.disclaimer ?? '').trim();
        if (EXTRA_CORE.has(d)) return false;
        if (/^Elimination — (Final Blow|Kill Streak|Multi Kill|Team Kill|Revenge|Melee|Deployable|Final Blow Compliment|Assist|Environmental|Rescuing|Scenario)\b/i.test(d)
            && !/eliminating|after |scenario —/i.test(d)) {
            // Generic core elim buckets — replaced.
            if (
                d === 'Elimination — Final Blow'
                || d === 'Elimination — Kill Streak'
                || d === 'Elimination — Multi Kill'
                || d === 'Elimination — Team Kill'
                || d === 'Elimination — Revenge'
                || d === 'Elimination — Melee Final Blow'
                || d === 'Elimination — Deployable Eliminated'
                || d === 'Elimination — Final Blow Compliment'
                || d === 'Elimination — Assist'
                || d === 'Elimination — Environmental Final Blow'
                || d === 'Elimination — Rescuing Ally on Low HP'
            ) {
                return false;
            }
        }
        if (!d) {
            return Array.isArray(line.partners) && line.partners.length > 0;
        }
        // Scenario / hero-specific elim notes kept if not exact core.
        if (THEATER_CHATTER_CORE_DISCLAIMERS.has(d)) return false;
        return true;
    });
}

/**
 * @param {string} heroId
 * @param {object} conversationsData
 */
async function rebuildHero(heroId, conversationsData) {
    const cfg = HEROES[heroId];
    const extractRoot = path.join(EXTRACT_ROOT, cfg.extract);
    const wikitext = await fetchWiki(cfg.wikiPage, heroId.replace(/ /g, '_'));
    const quotes = [
        ...parseSection(wikitext, 'chatter', heroId),
        ...parseSection(wikitext, 'eliminations', heroId),
    ];

    /** @type {object[]} */
    const coreLines = [];
    /** @type {Map<string, number>} */
    const spokenVariant = new Map();
    /** @type {Map<string, number>} */
    const byDisclaimer = new Map();
    let downloaded = 0;
    let fromExtract = 0;
    let stubsFilled = 0;
    let skippedEmpty = 0;

    /** @type {Set<string>} */
    const usedFolderSources = new Set();

    for (const q of quotes) {
        const disclaimer = q.disclaimer;
        const folders =
            q.folders?.length
                ? q.folders
                : THEATER_CHATTER_DATAMINE_SOURCES.filter((s) => s.disclaimer === disclaimer).map(
                    (s) => s.folder,
                );

        const realAudios = q.wikiAudios.filter((a) => !isStubWikiAudio(a));
        const hasStub = q.wikiAudios.some((a) => isStubWikiAudio(a)) || !q.wikiAudios.length;

        if (q.spoken && realAudios.length) {
            for (let i = 0; i < realAudios.length; i += 1) {
                const wikiAudio = realAudios[i];
                let voice = atlasFromWiki(wikiAudio);
                const dest = path.join(VOICELINES_DIR, voice || atlasName(cfg.voicePrefix, q.spoken, i));
                voice = path.basename(dest);
                if (!dryRun) {
                    try {
                        if (!fs.existsSync(dest)) {
                            const title = wikiAudio.startsWith('File:')
                                ? wikiAudio
                                : `File:${wikiAudio}`;
                            await downloadWikiVoicelineFile(title, dest);
                            downloaded += 1;
                        }
                    } catch {
                        const hits = findExtractByLabel(extractRoot, folders, q.spoken);
                        const hit = hits[i] || hits[0];
                        if (hit) {
                            voice = atlasName(cfg.voicePrefix, q.spoken, i);
                            await copyVoice(hit.source, path.join(VOICELINES_DIR, voice));
                            fromExtract += 1;
                        }
                    }
                }
                const line = {
                    id: randomUUID(),
                    hero: heroId,
                    voice,
                    voicePrefix: '',
                    subtitles: q.spoken,
                    render: 'Heroic.png',
                    era: 'Overwatch',
                    status: 'active',
                };
                if (disclaimer) line.disclaimer = disclaimer;
                coreLines.push(line);
                byDisclaimer.set(disclaimer || '(Set Up)', (byDisclaimer.get(disclaimer || '(Set Up)') || 0) + 1);
            }
            continue;
        }

        if (q.spoken && hasStub) {
            const hits = findExtractByLabel(extractRoot, folders, q.spoken);
            if (hits.length) {
                for (let i = 0; i < hits.length; i += 1) {
                    const hit = hits[i];
                    if (usedFolderSources.has(hit.source)) continue;
                    usedFolderSources.add(hit.source);
                    const vIdx = spokenVariant.get(coreKey(q.spoken)) || 0;
                    spokenVariant.set(coreKey(q.spoken), vIdx + 1);
                    const voice = atlasName(cfg.voicePrefix, q.spoken, vIdx);
                    if (!dryRun) await copyVoice(hit.source, path.join(VOICELINES_DIR, voice));
                    fromExtract += 1;
                    const line = {
                        id: randomUUID(),
                        hero: heroId,
                        voice,
                        voicePrefix: '',
                        subtitles: q.spoken,
                        render: 'Heroic.png',
                        era: 'Overwatch',
                        status: 'active',
                    };
                    if (disclaimer) line.disclaimer = disclaimer;
                    coreLines.push(line);
                    byDisclaimer.set(
                        disclaimer || '(Set Up)',
                        (byDisclaimer.get(disclaimer || '(Set Up)') || 0) + 1,
                    );
                }
                continue;
            }

            // Jetpack: unlabeled .03F — take next unused take from category folder(s).
            /** @type {string[]} */
            const takes = [];
            for (const folder of folders) {
                for (const clip of listExtractClips(extractRoot, folder)) {
                    if (clip.label) continue; // prefer labeled path above
                    if (usedFolderSources.has(clip.source)) continue;
                    takes.push(clip.source);
                }
            }
            if (takes.length) {
                const src = takes[0];
                usedFolderSources.add(src);
                const vIdx = spokenVariant.get(coreKey(q.spoken)) || 0;
                spokenVariant.set(coreKey(q.spoken), vIdx + 1);
                const voice = atlasName(cfg.voicePrefix, q.spoken, vIdx);
                if (!dryRun) await copyVoice(src, path.join(VOICELINES_DIR, voice));
                fromExtract += 1;
                stubsFilled += 1;
                const line = {
                    id: randomUUID(),
                    hero: heroId,
                    voice,
                    voicePrefix: '',
                    subtitles: q.spoken,
                    render: 'Heroic.png',
                    era: 'Overwatch',
                    status: 'active',
                };
                if (disclaimer) line.disclaimer = disclaimer;
                coreLines.push(line);
                byDisclaimer.set(
                    disclaimer || '(Set Up)',
                    (byDisclaimer.get(disclaimer || '(Set Up)') || 0) + 1,
                );
                continue;
            }

            // Keep subtitle even if audio missing (placeholder).
            const voice = atlasName(cfg.voicePrefix, q.spoken);
            const line = {
                id: randomUUID(),
                hero: heroId,
                voice,
                voicePrefix: '',
                subtitles: q.spoken,
                render: 'Heroic.png',
                era: 'Overwatch',
                status: 'active',
            };
            if (disclaimer) line.disclaimer = disclaimer;
            coreLines.push(line);
            byDisclaimer.set(
                disclaimer || '(Set Up)',
                (byDisclaimer.get(disclaimer || '(Set Up)') || 0) + 1,
            );
            skippedEmpty += 1;
            continue;
        }

        // Empty spoken + stub → fill labeled extract clips (Bastion round start, etc.).
        if (!q.spoken && folders.length) {
            let added = 0;
            for (const folder of folders) {
                for (const clip of listExtractClips(extractRoot, folder)) {
                    if (!clip.label) continue;
                    if (usedFolderSources.has(clip.source)) continue;
                    usedFolderSources.add(clip.source);
                    const spoken = `(${clip.label.replace(/^\(|\)$/g, '')})`.replace(/^\(\(/, '(');
                    const label = clip.label.startsWith('(') ? clip.label : `(${clip.label})`;
                    const vIdx = spokenVariant.get(coreKey(label)) || 0;
                    spokenVariant.set(coreKey(label), vIdx + 1);
                    const voice = atlasName(cfg.voicePrefix, label, vIdx);
                    if (!dryRun) await copyVoice(clip.source, path.join(VOICELINES_DIR, voice));
                    fromExtract += 1;
                    stubsFilled += 1;
                    added += 1;
                    const line = {
                        id: randomUUID(),
                        hero: heroId,
                        voice,
                        voicePrefix: '',
                        subtitles: label,
                        render: 'Heroic.png',
                        era: 'Overwatch',
                        status: 'active',
                    };
                    if (disclaimer) line.disclaimer = disclaimer;
                    coreLines.push(line);
                    byDisclaimer.set(
                        disclaimer || '(Set Up)',
                        (byDisclaimer.get(disclaimer || '(Set Up)') || 0) + 1,
                    );
                }
            }
            if (!added) skippedEmpty += 1;
            continue;
        }

        skippedEmpty += 1;
    }

    const chatterId = chatterIdForHero(heroId);
    let row = (conversationsData.conversations || []).find((c) => c.id === chatterId);
    if (!row) {
        row = {
            id: chatterId,
            entryType: 'chatter',
            name: heroId,
            status: 'active',
            eraName: '',
            tags: [],
            scene: DEFAULT_DIALOGUE_SCENE,
            lines: [],
        };
        conversationsData.conversations.push(row);
    }

    const preserved = preserveNonCore(row.lines);
    // Drop preserved lines that duplicate wiki-imported spoken under a more generic key.
    const coreSpoken = new Set(coreLines.map((l) => coreKey(l.subtitles)));
    const preservedFiltered = preserved.filter((l) => {
        const k = coreKey(l.subtitles);
        if (!k) return true;
        // Keep map/skin/partner regardless.
        const d = String(l.disclaimer || '');
        if (/map|skin|horizon|grímsvötn|iliós|scoring/i.test(d) || (l.partners || []).length) {
            return true;
        }
        // Prefer new wiki scenario/hero-specific; drop old dupes of same spoken.
        if (coreSpoken.has(k) && !/eliminating|scenario/i.test(d)) return false;
        return true;
    });

    const before = Array.isArray(row.lines) ? row.lines.length : 0;
    const next = [...coreLines, ...preservedFiltered];

    console.log(
        `\n[${heroId}] wikiQuotes≈${quotes.length} core=${coreLines.length} preserved=${preservedFiltered.length} (${before} → ${next.length})`,
    );
    console.log(
        `  audio: wikiDL=${downloaded} extract=${fromExtract} stubFill=${stubsFilled} weak=${skippedEmpty}`,
    );
    for (const [k, v] of [...byDisclaimer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
        console.log(`  ${v}\t${k}`);
    }

    if (!dryRun) {
        row.entryType = 'chatter';
        row.name = heroId;
        row.status = 'active';
        row.scene = row.scene || DEFAULT_DIALOGUE_SCENE;
        row.tags = Array.isArray(row.tags) ? row.tags : [];
        row.lines = next;
        delete row.paths;
        delete row.selectedPathId;
    }

    return { core: coreLines.length, total: next.length };
}

async function main() {
    const targets = onlyHero
        ? Object.keys(HEROES).filter((h) => h.toLowerCase() === onlyHero.toLowerCase())
        : Object.keys(HEROES);
    if (!targets.length) {
        console.error(`Unknown hero: ${onlyHero}`);
        process.exit(1);
    }

    console.log(
        `Bastion/Jetpack wiki chatter (${dryRun ? 'DRY RUN' : 'WRITE'}) — ${targets.join(', ')}`,
    );

    const conversationsData = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    if (!Array.isArray(conversationsData.conversations)) {
        conversationsData.conversations = [];
    }

    for (const heroId of targets) {
        await rebuildHero(heroId, conversationsData);
    }

    if (!dryRun) {
        conversationsData._meta = conversationsData._meta || {};
        conversationsData._meta.bastionJetpackWikiChatterAt = new Date().toISOString();
        await atomicWriteJson(CONVERSATIONS_PATH, conversationsData);
        const assets = await scanTheaterAssets();
        await atomicWriteJson(THEATER_MANIFEST, assets);
        console.log(`\nWrote conversations + theater manifest (${assets.voicelines?.length ?? 0} voices)`);
    }

    console.log('\nDone.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
