#!/usr/bin/env node
/**
 * Import gallery Phrases from Overwatch wiki Quotes pages.
 *
 * Categories:
 *   - Chatter → Hero Selected  (+ Selection.ogg for gallery pick)
 *   - Voice Lines              (main randomizer pool)
 *   - Communication → Hello, Thank/Thanks, Praise
 *   - Abilities → ultimate only (mapped / last non-outcome ability)
 *     Ultimate clips go in Phrases/<hero>/Ultimate/ and are weighted 2× in-app.
 *
 * Audio resolve order: Theater Voicelines → MatchTalk → wiki download.
 *
 * Usage:
 *   node scripts/import-gallery-hero-phrases.mjs --dry-run
 *   node scripts/import-gallery-hero-phrases.mjs
 *   node scripts/import-gallery-hero-phrases.mjs --hero Brigitte
 *   node scripts/import-gallery-hero-phrases.mjs --clear
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    downloadWikiVoicelineFile,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
import { listWikiQuotesPages } from './lib/wiki-quotes-heroes.mjs';
import {
    GALLERY_ABILITY_OUTCOME_RE,
    GALLERY_ULTIMATE_BY_HERO,
} from './lib/gallery-phrase-ultimates.mjs';
import { ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';

ensureAuditWorkspace();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const PHRASES_ROOT = path.join(REPO, 'src', 'assets', 'audio', 'Phrases');
const VOICELINES_DIR = path.join(REPO, 'src', 'assets', 'audio', 'Theater', 'Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const WIKI_ORIGIN = 'https://overwatch.fandom.com';
const USER_AGENT = 'OverwatchAtlas/1.0 (gallery hero phrases importer)';

const dryRun = process.argv.includes('--dry-run');
const clearFirst = process.argv.includes('--clear');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

const MATCHTALK_FOLDER_ALIASES = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier_ 76',
    'Wrecking Ball': 'Wrecking Ball',
    'Junker Queen': 'Junker Queen',
    'Jetpack Cat': 'Jetpack Cat',
};

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*([^*]+)\*/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function phraseKey(text) {
    const primary = coreKey(text);
    if (primary) return primary;
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[\u2018\u2019\u201C\u201D`'"()]/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function dialogueNorm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function stripWikiMarkup(raw) {
    return String(raw || '')
        .replace(/\{\{Audio\|[^}]+\}\}/gi, ' ')
        .replace(/\{\{QuoteTranslation\|[\s\S]*?\}\}/gi, (m) => {
            const quote = m.match(/\|\s*quote\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
            const translation = m.match(/\|\s*translation\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
            const script = m.match(/\|\s*script\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
            if (quote && translation && script) return `${quote} (${script}) ${translation}`;
            if (translation) return translation;
            return quote || '';
        })
        .replace(/\{\{[^}]+\}\}/g, ' ')
        .replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/'''?/g, '')
        .replace(/<\/?[^>]+>/g, ' ')
        .replace(/\*([^*]+)\*/g, '($1)')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitQuoteAndDisclaimer(rawCell) {
    const cell = String(rawCell || '').trim();
    let disclaimer = '';
    const smallMatch =
        cell.match(/<small>\s*''?\(([\s\S]*?)\)''?\s*<\/small>/i) ||
        cell.match(/<small>\s*''([\s\S]*?)''\s*<\/small>/i) ||
        cell.match(/<small>([\s\S]*?)<\/small>/i);
    if (smallMatch) disclaimer = stripWikiMarkup(smallMatch[1]);

    let spoken = cell.replace(/<small>[\s\S]*?<\/small>/gi, ' ');
    spoken = stripWikiMarkup(spoken);

    if (!disclaimer) {
        const trailing =
            spoken.match(/\s*\((with[\s\S]+)\)\s*$/i) ||
            spoken.match(/\s*\((during[\s\S]+)\)\s*$/i) ||
            spoken.match(/\s*\((while[\s\S]+)\)\s*$/i) ||
            spoken.match(/\s*\((if[\s\S]+)\)\s*$/i) ||
            spoken.match(/\s*\((when[\s\S]+)\)\s*$/i) ||
            spoken.match(/\s*\((only[\s\S]+)\)\s*$/i);
        if (trailing) {
            disclaimer = stripWikiMarkup(trailing[1]);
            spoken = spoken.slice(0, trailing.index).trim();
        }
    }

    return { spoken: spoken.replace(/\s+/g, ' ').trim(), disclaimer };
}

function extractSection(wikitext, name) {
    const re = new RegExp(
        `==\\s*${name}\\s*==([\\s\\S]*?)(?=\\n==\\s*[^=]|$)`,
        'i',
    );
    return String(wikitext || '').match(re)?.[1] || '';
}

function extractAudios(row) {
    return [...String(row || '').matchAll(/\{\{Audio\|([^}]+)\}\}/gi)].map((m) =>
        String(m[1]).trim(),
    );
}

function isHeaderCell(cell) {
    return /rowspan|colspan|<center|<big|'''/i.test(cell);
}

function parseSpokenFromRow(row) {
    /** @type {string[]} */
    const spokens = [];
    for (const line of String(row || '')
        .split(/\n/)
        .map((l) => l.trim())) {
        if (!line.startsWith('|')) continue;
        if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
        if (/^\|\s*!/.test(line)) continue;
        const cell = line.replace(/^\|\s*/, '').trim();
        if (!cell || isHeaderCell(cell)) continue;
        if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;
        const { spoken } = splitQuoteAndDisclaimer(cell);
        if (spoken.length < 2) continue;
        if (/^(trigger|quote|availability|wheel option|ability)$/i.test(spoken)) continue;
        spokens.push(spoken);
    }
    return spokens;
}

/**
 * @param {string} sectionBody
 * @param {(ctx: { trigger: string, triggers: string[] }) => boolean} keepRow
 * @returns {Array<{ spoken: string, wikiAudio: string, key: string, trigger: string }>}
 */
function parseTriggeredQuoteTable(sectionBody, keepRow) {
    const rows = String(sectionBody || '').split(/\n\|-/);
    /** @type {Array<{ spoken: string, wikiAudio: string, key: string, trigger: string }>} */
    const out = [];
    let currentTriggers = [];

    for (const row of rows) {
        const triggerHits = [...row.matchAll(/'''([^']{2,100})'''/g)].map((m) =>
            m[1].replace(/<[^>]+>/g, '').trim(),
        );
        if (triggerHits.length && /rowspan|<center|<big/i.test(row)) {
            currentTriggers = triggerHits;
        }

        const trigger = currentTriggers[0] || '';
        if (!keepRow({ trigger, triggers: currentTriggers })) continue;

        const audios = extractAudios(row);
        if (!audios.length) continue;
        const spokens = parseSpokenFromRow(row);
        const spoken = spokens[0] || '';

        for (let i = 0; i < audios.length; i += 1) {
            const wikiAudio = audios[i];
            const label =
                spokens[i] ||
                spoken ||
                wikiAudio.replace(/^[^-\n]+-\s*/i, '').replace(/\.ogg$/i, '').trim();
            const key = phraseKey(`${label}::${wikiAudio}`);
            if (!key || out.some((q) => q.key === key)) continue;
            out.push({
                spoken: label,
                wikiAudio,
                key,
                trigger,
            });
        }
    }
    return out;
}

function parseHeroSelected(wikitext) {
    return parseTriggeredQuoteTable(extractSection(wikitext, 'Chatter'), ({ trigger }) =>
        /^hero selected$/i.test(trigger),
    );
}

function parseVoiceLines(wikitext) {
    return parseTriggeredQuoteTable(extractSection(wikitext, 'Voice Lines'), () => true);
}

function parseCommunication(wikitext) {
    return parseTriggeredQuoteTable(extractSection(wikitext, 'Communication'), ({ trigger }) =>
        /^(hello|thank|thanks|praise)$/i.test(String(trigger || '').trim()),
    );
}

function normalizeAbilityLabel(raw) {
    return String(raw || '')
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/#/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function abilityMatch(a, b) {
    const na = normalizeAbilityLabel(a).toLowerCase();
    const nb = normalizeAbilityLabel(b).toLowerCase();
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
}

function resolveUltimateName(heroId, abilitiesBody) {
    const mapped = GALLERY_ULTIMATE_BY_HERO[heroId];
    if (mapped) return mapped;

    const rows = String(abilitiesBody || '').split(/\n\|-/);
    /** @type {string[]} */
    const primaries = [];
    for (const row of rows) {
        if (!/rowspan/i.test(row) || !/<center/i.test(row)) continue;
        const hits = [...row.matchAll(/'''([^']{2,100})'''/g)].map((m) =>
            normalizeAbilityLabel(m[1]),
        );
        if (!hits.length) continue;
        const primary = hits[0];
        if (GALLERY_ABILITY_OUTCOME_RE.test(primary)) continue;
        primaries.push(primary);
    }
    return primaries.at(-1) || '';
}

function parseUltimateLines(wikitext, heroId) {
    const body = extractSection(wikitext, 'Abilities');
    const ultimateName = resolveUltimateName(heroId, body);
    if (!ultimateName) return { ultimateName: '', lines: [] };

    const rows = String(body || '').split(/\n\|-/);
    let active = false;
    /** @type {Array<{ spoken: string, wikiAudio: string, key: string, trigger: string }>} */
    const out = [];

    for (const row of rows) {
        if (/rowspan/i.test(row) && /<center/i.test(row)) {
            const hits = [...row.matchAll(/'''([^']{2,100})'''/g)].map((m) =>
                normalizeAbilityLabel(m[1]),
            );
            if (hits.length) {
                const primary = hits[0];
                if (abilityMatch(primary, ultimateName)) {
                    active = true;
                } else if (active) {
                    // Next distinct ability / post-ultimate outcome block.
                    active = false;
                }
            }
        }

        if (!active) continue;
        const audios = extractAudios(row);
        if (!audios.length) continue;
        const spokens = parseSpokenFromRow(row);
        const spoken = spokens[0] || '';
        for (let i = 0; i < audios.length; i += 1) {
            const wikiAudio = audios[i];
            const label =
                spokens[i] ||
                spoken ||
                wikiAudio.replace(/^[^-\n]+-\s*/i, '').replace(/\.ogg$/i, '').trim();
            const key = phraseKey(`ult::${label}::${wikiAudio}`);
            if (!key || out.some((q) => q.key === key)) continue;
            out.push({ spoken: label, wikiAudio, key, trigger: ultimateName });
        }
    }

    return { ultimateName, lines: out };
}

async function fetchQuotesWikitext(pageTitle) {
    fs.mkdirSync(WIKI_QUOTES_CACHE_DIR, { recursive: true });
    const cacheFile = path.join(
        WIKI_QUOTES_CACHE_DIR,
        `${pageTitle.replace(/[\\/:*?"<>|]/g, '_')}.wikitext`,
    );
    if (fs.existsSync(cacheFile)) {
        return { wikitext: fs.readFileSync(cacheFile, 'utf8'), fromCache: true };
    }
    const apiUrl = new URL('/api.php', WIKI_ORIGIN);
    apiUrl.searchParams.set('action', 'parse');
    apiUrl.searchParams.set('page', pageTitle);
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('prop', 'wikitext');
    apiUrl.searchParams.set('redirects', '1');
    const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.info || json.error.code);
    const wikitext = json.parse?.wikitext?.['*'] || '';
    if (!wikitext) throw new Error('empty wikitext');
    fs.writeFileSync(cacheFile, wikitext, 'utf8');
    return { wikitext, fromCache: false };
}

function filenameFromWikiAudio(wikiAudio, spoken) {
    const raw = String(wikiAudio || '').replace(/^File:/i, '').trim();
    const m = raw.match(/^(.+?)\s-_-\s(.+\.ogg)$/i) || raw.match(/^(.+?)\s-\s(.+\.ogg)$/i);
    if (m) {
        return m[2].replace(/[\\/:*?"<>|]/g, '').trim();
    }
    let name = String(spoken || 'phrase')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.\s]+$/g, '');
    if (!name) name = 'phrase';
    if (name.length > 160) name = name.slice(0, 160).trim();
    return name.toLowerCase().endsWith('.ogg') ? name : `${name}.ogg`;
}

function wikiAudioTitleCandidates(wikiAudio) {
    const raw = String(wikiAudio || '').trim().replace(/^File:/i, '');
    if (!raw) return [];
    const titles = new Set([`File:${raw}`]);
    if (raw.includes(' - ')) titles.add(`File:${raw.replace(/ - /g, '_-_')}`);
    const underscored = raw.replace(/ - /g, '_-_').replace(/ /g, '_');
    titles.add(`File:${underscored}`);
    const noBang = underscored.replace(/([!?]+)\.ogg$/i, '.ogg');
    if (noBang !== underscored) titles.add(`File:${noBang}`);
    const rawNoBang = raw.replace(/([!?]+)\.ogg$/i, '.ogg');
    if (rawNoBang !== raw) {
        titles.add(`File:${rawNoBang}`);
        titles.add(`File:${rawNoBang.replace(/ - /g, '_-_').replace(/ /g, '_')}`);
    }
    return [...titles];
}

async function downloadWikiAudioWithFallback(wikiAudio, destPath) {
    const errors = [];
    for (const title of wikiAudioTitleCandidates(wikiAudio)) {
        try {
            await downloadWikiVoicelineFile(title, destPath);
            return title;
        } catch (err) {
            errors.push(`${title}: ${err instanceof Error ? err.message : err}`);
        }
    }
    for (const title of wikiAudioTitleCandidates(wikiAudio)) {
        try {
            const url = new URL('https://overwatch.fandom.com/api.php');
            url.searchParams.set('action', 'query');
            url.searchParams.set('titles', title);
            url.searchParams.set('prop', 'imageinfo');
            url.searchParams.set('iiprop', 'url');
            url.searchParams.set('format', 'json');
            const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
            if (!res.ok) continue;
            const json = await res.json();
            const page = Object.values(json.query?.pages || {})[0];
            const fileUrl = page?.imageinfo?.[0]?.url;
            if (!fileUrl) continue;
            const dl = await fetch(fileUrl, { headers: { 'User-Agent': USER_AGENT } });
            if (!dl.ok) continue;
            await fsp.writeFile(destPath, Buffer.from(await dl.arrayBuffer()));
            return title;
        } catch (err) {
            errors.push(`fallback ${title}: ${err instanceof Error ? err.message : err}`);
        }
    }
    throw new Error(errors.join(' | ') || 'no wiki audio candidates');
}

function atlasFromWikiAudio(wikiAudio) {
    const title = String(wikiAudio || '').trim();
    if (!title) return '';
    try {
        return wikiFileTitleToTheaterFilename(title.startsWith('File:') ? title : `File:${title}`);
    } catch {
        return '';
    }
}

async function indexMatchTalk(folder) {
    /** @type {Array<{ label: string, sourceOgg: string, core: string, dialogueNorm: string }>} */
    const entries = [];
    const root = path.join(EXTRACT_ROOT, folder, 'MatchTalk');

    async function walk(dir) {
        let dirents;
        try {
            dirents = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of dirents) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(entry.name) || !/\.0B2-/i.test(entry.name)) continue;
            const match = entry.name.match(/^[^-]+-(.+)\.ogg$/i);
            if (!match) continue;
            const label = match[1];
            entries.push({
                label,
                sourceOgg: full,
                core: coreKey(label),
                dialogueNorm: dialogueNorm(label),
            });
        }
    }
    await walk(root);
    return entries;
}

function findMatchTalk(pool, spoken) {
    const want = coreKey(spoken);
    const wantNorm = dialogueNorm(spoken);
    for (const row of pool) {
        if (row.core === want || row.dialogueNorm === wantNorm) return row;
    }
    for (const row of pool) {
        const shorter = row.core.length <= want.length ? row.core : want;
        const longer = row.core.length <= want.length ? want : row.core;
        if (shorter.length >= 18 && longer.startsWith(shorter) && shorter.length / longer.length >= 0.85) {
            return row;
        }
    }
    return null;
}

async function sleep(ms) {
    await new Promise((r) => setTimeout(r, ms));
}

async function clearHeroPhraseFiles(heroId) {
    const heroDir = path.join(PHRASES_ROOT, heroId);
    if (!fs.existsSync(heroDir)) return;
    async function wipe(dir) {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await wipe(full);
                await fsp.rmdir(full).catch(() => {});
            } else if (/\.(ogg|mp3|wav|m4a|webm)$/i.test(entry.name)) {
                await fsp.unlink(full);
            }
        }
    }
    await wipe(heroDir);
}

async function clearAllPhraseFiles() {
    const heroes = await fsp.readdir(PHRASES_ROOT, { withFileTypes: true });
    for (const entry of heroes) {
        if (entry.isDirectory()) await clearHeroPhraseFiles(entry.name);
    }
}

/**
 * @param {string} heroDir
 * @param {string} relName — e.g. `foo.ogg` or `Ultimate/foo.ogg`
 * @param {{ spoken: string, wikiAudio: string }} line
 * @param {Array} mtPool
 */
async function saveLine(heroDir, relName, line, mtPool, counters) {
    const destPath = path.join(heroDir, ...relName.split('/'));
    if (!dryRun) await fsp.mkdir(path.dirname(destPath), { recursive: true });

    let source = null;
    let via = '';
    const theaterName = atlasFromWikiAudio(line.wikiAudio);
    if (theaterName) {
        const theaterPath = path.join(VOICELINES_DIR, theaterName);
        if (fs.existsSync(theaterPath)) {
            source = theaterPath;
            via = 'theater';
        }
    }
    if (!source) {
        const mt = findMatchTalk(mtPool, line.spoken);
        if (mt?.sourceOgg && fs.existsSync(mt.sourceOgg)) {
            source = mt.sourceOgg;
            via = 'matchtalk';
        }
    }
    if (!source && line.wikiAudio) via = 'wiki';

    if (dryRun) {
        console.log(`  DRY [${via || 'missing'}] ${relName}`);
        return true;
    }

    if (source) {
        await fsp.copyFile(source, destPath);
        if (via === 'theater') counters.copiedTheater += 1;
        else counters.copiedMatchTalk += 1;
    } else if (line.wikiAudio) {
        try {
            await downloadWikiAudioWithFallback(line.wikiAudio, destPath);
            counters.downloaded += 1;
            await sleep(80);
        } catch (err) {
            counters.failed += 1;
            console.warn(`  FAIL ${relName}: ${err instanceof Error ? err.message : err}`);
            return false;
        }
    } else {
        counters.failed += 1;
        console.warn(`  SKIP (no audio): ${line.spoken}`);
        return false;
    }
    return true;
}

function uniqueDestName(used, baseName) {
    let name = baseName;
    let n = 2;
    while (used.has(name.toLowerCase())) {
        const m = baseName.match(/^(.*)(\.ogg)$/i);
        name = m ? `${m[1]} (${n})${m[2]}` : `${baseName} (${n})`;
        n += 1;
    }
    used.add(name.toLowerCase());
    return name;
}

async function main() {
    if (clearFirst && !onlyHero && !dryRun) {
        console.log('Clearing existing phrase audio…');
        await clearAllPhraseFiles();
    }

    const pages = await listWikiQuotesPages();
    const targets = onlyHero
        ? pages.filter((p) => p.heroId.toLowerCase() === onlyHero.toLowerCase())
        : pages;

    if (!targets.length) {
        console.error(onlyHero ? `No hero matched --hero ${onlyHero}` : 'No heroes in manifest');
        process.exit(1);
    }

    const counters = {
        downloaded: 0,
        copiedTheater: 0,
        copiedMatchTalk: 0,
        failed: 0,
        heroesOk: 0,
        lines: 0,
    };

    /** @type {Map<string, Awaited<ReturnType<typeof indexMatchTalk>>>} */
    const matchTalkCache = new Map();

    for (const { heroId, pageTitle } of targets) {
        process.stdout.write(`\n[${heroId}] ${pageTitle} … `);
        if (!dryRun) await clearHeroPhraseFiles(heroId);

        let wikitext;
        try {
            const fetched = await fetchQuotesWikitext(pageTitle);
            wikitext = fetched.wikitext;
            process.stdout.write(fetched.fromCache ? 'cache ' : 'fetch ');
        } catch (err) {
            console.log(`FAIL wiki: ${err instanceof Error ? err.message : err}`);
            counters.failed += 1;
            continue;
        }

        const selected = parseHeroSelected(wikitext);
        const voiceLines = parseVoiceLines(wikitext);
        const communication = parseCommunication(wikitext);
        const { ultimateName, lines: ultimates } = parseUltimateLines(wikitext, heroId);

        const total =
            selected.length + voiceLines.length + communication.length + ultimates.length;
        counters.lines += total;
        console.log(
            `sel=${selected.length} voice=${voiceLines.length} comm=${communication.length} ult(${ultimateName || '?'})=${ultimates.length}`,
        );
        if (!total) continue;
        counters.heroesOk += 1;

        const heroDir = path.join(PHRASES_ROOT, heroId);
        if (!dryRun) await fsp.mkdir(heroDir, { recursive: true });

        const mtFolder = MATCHTALK_FOLDER_ALIASES[heroId] || heroId;
        if (!matchTalkCache.has(mtFolder)) {
            matchTalkCache.set(mtFolder, await indexMatchTalk(mtFolder));
        }
        const mtPool = matchTalkCache.get(mtFolder) || [];
        const usedNames = new Set();

        /** @type {string|null} */
        let firstSelectionDest = null;

        for (const line of selected) {
            const base = uniqueDestName(usedNames, filenameFromWikiAudio(line.wikiAudio, line.spoken));
            const ok = await saveLine(heroDir, base, line, mtPool, counters);
            if (ok && !firstSelectionDest) firstSelectionDest = path.join(heroDir, base);
        }

        for (const line of [...voiceLines, ...communication]) {
            const base = uniqueDestName(usedNames, filenameFromWikiAudio(line.wikiAudio, line.spoken));
            await saveLine(heroDir, base, line, mtPool, counters);
        }

        for (const line of ultimates) {
            const base = uniqueDestName(
                usedNames,
                `Ultimate/${filenameFromWikiAudio(line.wikiAudio, line.spoken)}`,
            );
            // uniqueDestName with slash — fix: track leaf only for Ultimate/
            await saveLine(heroDir, base, line, mtPool, counters);
        }

        if (firstSelectionDest && !dryRun && fs.existsSync(firstSelectionDest)) {
            const selectionPath = path.join(heroDir, 'Selection.ogg');
            if (path.resolve(firstSelectionDest) !== path.resolve(selectionPath)) {
                await fsp.copyFile(firstSelectionDest, selectionPath);
            }
        } else if (firstSelectionDest && dryRun) {
            console.log('  DRY Selection.ogg');
        }
    }

    console.log('\nDone.');
    console.log(`  heroes with clips: ${counters.heroesOk}/${targets.length}`);
    console.log(`  quote rows saved attempt: ${counters.lines}`);
    console.log(`  theater copies: ${counters.copiedTheater}`);
    console.log(`  matchtalk copies: ${counters.copiedMatchTalk}`);
    console.log(`  wiki downloads: ${counters.downloaded}`);
    console.log(`  failed/skipped: ${counters.failed}`);
    if (!dryRun) console.log('\nNext: node scripts/generate-manifest.js');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
