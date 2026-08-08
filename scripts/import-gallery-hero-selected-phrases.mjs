#!/usr/bin/env node
/**
 * Import gallery Phrases from wiki Chatter → '''Hero Selected''' lines.
 *
 * For each manifest hero:
 *   1) Fetch/cache Quotes wikitext
 *   2) Collect spoken lines + {{Audio|…}} under Hero Selected
 *   3) Resolve audio: Theater Voicelines → MatchTalk → wiki download
 *   4) Write into src/assets/audio/Phrases/<heroId>/
 *      - quote-named .ogg files
 *      - Selection.ogg (copy of the first Hero Selected line, for gallery pick)
 *
 * Usage:
 *   node scripts/import-gallery-hero-selected-phrases.mjs --dry-run
 *   node scripts/import-gallery-hero-selected-phrases.mjs
 *   node scripts/import-gallery-hero-selected-phrases.mjs --hero Brigitte
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    downloadWikiVoicelineFile,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
import {
    listWikiQuotesPages,
    wikiPageTitleForHero,
} from './lib/wiki-quotes-heroes.mjs';
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';

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
const USER_AGENT = 'OverwatchAtlas/1.0 (gallery Hero Selected phrases importer)';

const dryRun = process.argv.includes('--dry-run');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

/** Manifest / Phrases folder id → MatchTalk extract folder name */
const MATCHTALK_FOLDER_ALIASES = {
    'D.va': 'D.Va',
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

/** Like coreKey, but keeps parenthetical-only lines (e.g. Bastion beeps). */
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
            return quote || translation || '';
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

    spoken = spoken.replace(/\s+/g, ' ').trim();
    return { spoken, disclaimer };
}

/**
 * @param {string} wikitext
 * @returns {Array<{ spoken: string, disclaimer: string, wikiAudio: string, key: string }>}
 */
function parseHeroSelectedFromChatter(wikitext) {
    const sectionMatch = String(wikitext || '').match(
        /==\s*Chatter\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i,
    );
    if (!sectionMatch) return [];
    const body = sectionMatch[1];
    const rows = body.split(/\n\|-/);
    /** @type {Array<{ spoken: string, disclaimer: string, wikiAudio: string, key: string }>} */
    const out = [];
    let heroSelectedActive = false;

    for (const row of rows) {
        const triggerHits = [...row.matchAll(/'''([^']{2,80})'''/g)].map((m) =>
            m[1].replace(/<[^>]+>/g, '').trim(),
        );
        for (const hit of triggerHits) {
            if (/^hero selected$/i.test(hit)) {
                heroSelectedActive = true;
            } else if (
                /during set[- ]?up|set[- ]?up chatter|match start|respawn|health|healed|on fire|nano|perk|voted|reinforcement|negative|discord|hacked|resurrect|ultimate|damage boost|booster/i.test(
                    hit,
                )
            ) {
                heroSelectedActive = false;
            } else if (
                hit.length > 2 &&
                hit.length < 48 &&
                /[A-Za-z]/.test(hit) &&
                !/^(general|won previous|lost previous|final round|minor|major|unused)$/i.test(hit)
            ) {
                // Other major chatter headers end Hero Selected.
                if (!/^hero selected$/i.test(hit)) heroSelectedActive = false;
            }
        }

        if (!heroSelectedActive) continue;

        const audioMatch = row.match(/\{\{Audio\|([^}]+)\}\}/i);
        const wikiAudio = audioMatch ? String(audioMatch[1]).trim() : '';

        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell) continue;
            // Trigger / header cells (not spoken quotes).
            if (/rowspan|colspan|<center|<big|'''/i.test(cell)) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;

            const { spoken, disclaimer } = splitQuoteAndDisclaimer(cell);
            if (spoken.length < 3) continue;
            if (/^trigger$/i.test(spoken) || /^quote$/i.test(spoken)) continue;
            if (/^hero selected$/i.test(spoken)) continue;
            const key = phraseKey(spoken);
            if (!key || out.some((q) => q.key === key)) continue;
            out.push({ spoken, disclaimer, wikiAudio, key });
        }
    }
    return out;
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

function sanitizePhraseFilename(spoken) {
    let name = String(spoken || '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    // Windows trailing dots/spaces
    name = name.replace(/[.\s]+$/g, '');
    if (!name) name = 'Selection';
    if (name.length > 180) name = name.slice(0, 180).trim();
    return `${name}.ogg`;
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

function atlasFromWikiAudio(wikiAudio) {
    const title = String(wikiAudio || '').trim();
    if (!title) return '';
    try {
        return wikiFileTitleToTheaterFilename(title.startsWith('File:') ? title : `File:${title}`);
    } catch {
        return '';
    }
}

/**
 * @param {string} wikiAudio
 * @returns {string[]}
 */
function wikiAudioTitleCandidates(wikiAudio) {
    const raw = String(wikiAudio || '').trim().replace(/^File:/i, '');
    if (!raw) return [];
    const titles = new Set([`File:${raw}`]);
    if (raw.includes(' - ')) {
        titles.add(`File:${raw.replace(/ - /g, '_-_')}`);
    }
    // Common fandom storage form: Hero_-_Words_With_Underscores.ogg
    const underscored = raw
        .replace(/ - /g, '_-_')
        .replace(/ /g, '_');
    titles.add(`File:${underscored}`);
    // Drop trailing !/? sometimes absent from the file title.
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

    // Some quote files are flagged "missing" in MediaWiki but still expose imageinfo.url.
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

async function sleep(ms) {
    await new Promise((r) => setTimeout(r, ms));
}

async function main() {
    const pages = await listWikiQuotesPages();
    const targets = onlyHero
        ? pages.filter((p) => p.heroId.toLowerCase() === onlyHero.toLowerCase())
        : pages;

    if (!targets.length) {
        console.error(onlyHero ? `No hero matched --hero ${onlyHero}` : 'No heroes in manifest');
        process.exit(1);
    }

    let downloaded = 0;
    let copiedTheater = 0;
    let copiedMatchTalk = 0;
    let failed = 0;
    let heroesWithLines = 0;
    let totalLines = 0;

    /** @type {Map<string, Awaited<ReturnType<typeof indexMatchTalk>>>} */
    const matchTalkCache = new Map();

    for (const { heroId, pageTitle } of targets) {
        process.stdout.write(`\n[${heroId}] ${pageTitle} … `);
        let wikitext;
        try {
            const fetched = await fetchQuotesWikitext(pageTitle);
            wikitext = fetched.wikitext;
            process.stdout.write(fetched.fromCache ? 'cache ' : 'fetch ');
        } catch (err) {
            console.log(`FAIL wiki: ${err instanceof Error ? err.message : err}`);
            failed += 1;
            continue;
        }

        const lines = parseHeroSelectedFromChatter(wikitext);
        totalLines += lines.length;
        if (!lines.length) {
            console.log('no Hero Selected lines');
            continue;
        }
        heroesWithLines += 1;
        console.log(`${lines.length} line(s)`);

        const heroDir = path.join(PHRASES_ROOT, heroId);
        if (!dryRun) await fsp.mkdir(heroDir, { recursive: true });

        const mtFolder = MATCHTALK_FOLDER_ALIASES[heroId] || heroId;
        if (!matchTalkCache.has(mtFolder)) {
            matchTalkCache.set(mtFolder, await indexMatchTalk(mtFolder));
        }
        const mtPool = matchTalkCache.get(mtFolder) || [];

        /** @type {string|null} */
        let firstDest = null;

        for (const line of lines) {
            const destName = sanitizePhraseFilename(line.spoken);
            const destPath = path.join(heroDir, destName);
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

            if (!source && line.wikiAudio) {
                via = 'wiki';
            }

            if (dryRun) {
                console.log(`  DRY ${via || 'missing'} → ${destName}`);
                if (!firstDest) firstDest = destPath;
                continue;
            }

            try {
                if (source) {
                    await fsp.copyFile(source, destPath);
                    if (via === 'theater') copiedTheater += 1;
                    else copiedMatchTalk += 1;
                } else if (line.wikiAudio) {
                    await downloadWikiAudioWithFallback(line.wikiAudio, destPath);
                    downloaded += 1;
                    await sleep(120);
                } else {
                    console.warn(`  SKIP (no audio): ${line.spoken}`);
                    failed += 1;
                    continue;
                }
                console.log(`  OK [${via}] ${destName}`);
                if (!firstDest) firstDest = destPath;
            } catch (err) {
                console.warn(`  FAIL ${destName}: ${err instanceof Error ? err.message : err}`);
                failed += 1;
            }
        }

        if (firstDest && !dryRun && fs.existsSync(firstDest)) {
            const selectionPath = path.join(heroDir, 'Selection.ogg');
            if (path.resolve(firstDest) !== path.resolve(selectionPath)) {
                await fsp.copyFile(firstDest, selectionPath);
                console.log('  OK Selection.ogg (from first Hero Selected)');
            }
        } else if (firstDest && dryRun) {
            console.log('  DRY Selection.ogg (from first Hero Selected)');
        }
    }

    console.log('\nDone.');
    console.log(`  heroes with Hero Selected: ${heroesWithLines}/${targets.length}`);
    console.log(`  lines found: ${totalLines}`);
    console.log(`  copied theater: ${copiedTheater}`);
    console.log(`  copied matchtalk: ${copiedMatchTalk}`);
    console.log(`  downloaded wiki: ${downloaded}`);
    console.log(`  failed/skipped: ${failed}`);
    if (!dryRun) {
        console.log('\nNext: node scripts/generate-manifest.js');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
