#!/usr/bin/env node
/**
 * Backfill gallery Phrases from wiki Cosmetics → Voice Lines (weirdgloop).
 *
 * Additive: keeps Hello / Thanks / Praise / Ultimate / Selection already on disk.
 * Skips lines whose spoken label already exists in the hero phrase folder.
 *
 * Usage:
 *   node scripts/import-gallery-voice-lines-from-wiki.mjs --dry-run
 *   node scripts/import-gallery-voice-lines-from-wiki.mjs
 *   node scripts/import-gallery-voice-lines-from-wiki.mjs --hero Doctrine
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { downloadWikiVoicelineFile } from './lib/wiki-voiceline-download.mjs';
import { stripWikiMarkup } from './lib/wiki-markup.mjs';
import { listWikiQuotesPages, wikiPageTitleForHero } from './lib/wiki-quotes-heroes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const PHRASES_ROOT = path.join(REPO, 'src', 'assets', 'audio', 'Phrases');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const VOICELINES_DIR = path.join(REPO, 'src', 'assets', 'audio', 'Theater', 'Voicelines');
const WIKI_ORIGIN = 'https://overwatch.weirdgloop.org';
const USER_AGENT = 'OverwatchAtlas/1.0 (gallery voice-lines backfill)';

const dryRun = process.argv.includes('--dry-run');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

const EXTRACT_FOLDER_ALIASES = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier_ 76',
};

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(
            /\((arabic|shona|korean|japanese|latin|french|spanish|german|chinese|mandarin|russian|portuguese|swedish|turkish|danish|italian)\)/gi,
            ' $1 ',
        )
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function cleanLabel(raw) {
    let s = String(raw || '').replace(/\{\{QuoteTranslation\|[\s\S]*?\}\}/gi, (m) => {
        const quote = m.match(/\|\s*quote\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
        const translation = m.match(/\|\s*translation\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
        const script = m.match(/\|\s*script\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
        if (translation && script) return `(${script}) ${translation}`;
        if (translation) return translation;
        return quote || '';
    });
    return stripWikiMarkup(s)
        .replace(/<small>[\s\S]*?<\/small>/gi, ' ')
        .replace(/''+/g, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function safeFileName(label) {
    let name = cleanLabel(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.\s]+$/g, '');
    if (!name) name = 'phrase';
    if (name.length > 160) name = name.slice(0, 160).trim();
    return name.toLowerCase().endsWith('.ogg') ? name : `${name}.ogg`;
}

function extractSection(wikitext, name) {
    const re = new RegExp(
        `(?:^|\\n)(={2,3})\\s*${name}\\s*\\1\\s*\\n([\\s\\S]*?)(?=\\n={2,3}\\s*[^=\\n]+\\s*={2,3}\\s*(?:\\n|$)|$)`,
        'i',
    );
    return String(wikitext || '').match(re)?.[2] || '';
}

function parseVoiceLines(wikitext) {
    const body = extractSection(wikitext, 'Voice Lines');
    const rows = String(body || '').split(/\n\|-/);
    /** @type {Array<{ spoken: string, wikiAudio: string, key: string }>} */
    const out = [];
    for (const row of rows) {
        const audios = [...row.matchAll(/\{\{Audio\|([^}]+)\}\}/gi)].map((m) => m[1].trim());
        if (!audios.length) continue;
        const spokens = [];
        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell || /rowspan|colspan|<center|<big|'''/i.test(cell)) continue;
            // Skip availability / price header cells.
            if (/credits|battle pass|progression|challenge|anniversary|halloween|lunar|summer|winter|archives|default|season\s*\d/i.test(cell) && cell.length < 80) {
                continue;
            }
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;
            const spoken = cleanLabel(cell);
            if (spoken.length >= 2) spokens.push(spoken);
        }
        for (let i = 0; i < audios.length; i += 1) {
            const spoken = spokens[i] || spokens[0] || '';
            const key = coreKey(spoken) || coreKey(audios[i]);
            if (!key || out.some((q) => q.key === key)) continue;
            out.push({ spoken, wikiAudio: audios[i], key });
        }
    }
    return out;
}

async function fetchQuotesWikitext(pageTitle) {
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
    return json.parse?.wikitext?.['*'] || '';
}

function existingPhraseKeys(heroDir) {
    /** @type {Set<string>} */
    const keys = new Set();
    if (!fs.existsSync(heroDir)) return keys;
    function walk(dir) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                if (ent.name === 'Ultimate' || ent.name === 'Hamster') continue;
                walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(ent.name)) continue;
            keys.add(coreKey(ent.name.replace(/\.ogg$/i, '')));
        }
    }
    walk(heroDir);
    return keys;
}

function isStubWikiAudio(wikiAudio) {
    const raw = String(wikiAudio || '').replace(/^File:/i, '').trim();
    return !raw || /-\s*\.ogg$/i.test(raw);
}

function wikiAudioTitleCandidates(wikiAudio) {
    const raw = String(wikiAudio || '').trim().replace(/^File:/i, '');
    if (!raw || isStubWikiAudio(raw)) return [];
    const titles = new Set([`File:${raw}`]);
    if (raw.includes(' - ')) titles.add(`File:${raw.replace(/ - /g, '_-_')}`);
    const underscored = raw.replace(/ - /g, '_-_').replace(/ /g, '_');
    titles.add(`File:${underscored}`);
    return [...titles];
}

function atlasFromWikiAudio(wikiAudio) {
    const raw = String(wikiAudio || '').replace(/^File:/i, '').trim();
    const m = raw.match(/^(.+?)\s-\s(.+\.ogg)$/i);
    if (!m) return '';
    return `${m[1].trim().replace(/ /g, '_')}_-_${m[2].trim().replace(/ /g, '_')}`;
}

function findExtractVoiceline(heroId, spoken) {
    const folder = EXTRACT_FOLDER_ALIASES[heroId] || heroId;
    const root = path.join(EXTRACT_ROOT, folder, 'Voicelines');
    if (!fs.existsSync(root)) return null;
    const want = coreKey(spoken);
    if (!want) return null;
    /** @type {string[]} */
    const files = [];
    function walk(dir) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (/\.0B2-.*\.ogg$/i.test(ent.name)) files.push(full);
        }
    }
    walk(root);
    for (const full of files) {
        const label = full.match(/\.0B2-(.+)\.ogg$/i)?.[1]?.replace(/_/g, ' ') || '';
        if (coreKey(label) === want) return full;
    }
    return null;
}

function uniqueName(used, base) {
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) {
        const m = base.match(/^(.*)(\.ogg)$/i);
        name = m ? `${m[1]} (${n})${m[2]}` : `${base} (${n})`;
        n += 1;
    }
    used.add(name.toLowerCase());
    return name;
}

async function downloadWiki(wikiAudio, destPath) {
    const errors = [];
    for (const title of wikiAudioTitleCandidates(wikiAudio)) {
        try {
            await downloadWikiVoicelineFile(title, destPath);
            return title;
        } catch (err) {
            errors.push(String(err instanceof Error ? err.message : err));
        }
    }
    for (const origin of [WIKI_ORIGIN, 'https://overwatch.fandom.com']) {
        for (const title of wikiAudioTitleCandidates(wikiAudio)) {
            try {
                const url = new URL('/api.php', origin);
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
                errors.push(String(err instanceof Error ? err.message : err));
            }
        }
    }
    throw new Error(errors.slice(0, 2).join(' | ') || 'download failed');
}

async function importHero(heroId, pageTitle) {
    process.stdout.write(`\n[${heroId}] `);
    let wikitext;
    try {
        wikitext = await fetchQuotesWikitext(pageTitle);
    } catch (err) {
        console.log(`FAIL wiki: ${err instanceof Error ? err.message : err}`);
        return { added: 0, skipped: 0, failed: 1 };
    }

    const lines = parseVoiceLines(wikitext);
    const heroDir = path.join(PHRASES_ROOT, heroId);
    const have = existingPhraseKeys(heroDir);
    const used = new Set(
        fs.existsSync(heroDir)
            ? fs.readdirSync(heroDir).filter((n) => /\.ogg$/i.test(n)).map((n) => n.toLowerCase())
            : [],
    );

    let added = 0;
    let skipped = 0;
    let failed = 0;
    const missing = lines.filter((l) => !have.has(l.key));
    console.log(`wikiVL=${lines.length} missing=${missing.length}`);

    if (!missing.length) return { added, skipped: lines.length, failed };

    if (!dryRun) await fsp.mkdir(heroDir, { recursive: true });

    for (const line of missing) {
        const leaf = uniqueName(used, safeFileName(line.spoken || 'voice-line'));
        const destPath = path.join(heroDir, leaf);

        // Prefer theater copy → extract Voicelines → wiki download
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
            const ex = findExtractVoiceline(heroId, line.spoken);
            if (ex) {
                source = ex;
                via = 'extract';
            }
        }

        if (dryRun) {
            console.log(`  DRY [${via || (isStubWikiAudio(line.wikiAudio) ? 'no-audio' : 'wiki')}] ${leaf}`);
            if (via || !isStubWikiAudio(line.wikiAudio)) added += 1;
            else failed += 1;
            continue;
        }

        try {
            if (source) {
                await fsp.copyFile(source, destPath);
            } else if (!isStubWikiAudio(line.wikiAudio)) {
                await downloadWiki(line.wikiAudio, destPath);
                via = 'wiki';
                await new Promise((r) => setTimeout(r, 60));
            } else {
                failed += 1;
                console.warn(`  SKIP no audio: ${line.spoken}`);
                continue;
            }
            added += 1;
            have.add(line.key);
            console.log(`  + [${via || 'wiki'}] ${leaf}`);
        } catch (err) {
            failed += 1;
            console.warn(`  FAIL ${leaf}: ${err instanceof Error ? err.message : err}`);
        }
    }

    return { added, skipped, failed };
}

async function main() {
    const pages = await listWikiQuotesPages();
    const targets = onlyHero
        ? pages.filter((p) => p.heroId.toLowerCase() === onlyHero.toLowerCase())
        : pages;

    console.log(
        `Backfill Cosmetics → Voice Lines (${dryRun ? 'DRY RUN' : 'WRITE'}) — ${targets.length} heroes`,
    );

    let added = 0;
    let failed = 0;
    for (const { heroId, pageTitle } of targets) {
        if (/^jetpack\s*cat$/i.test(heroId)) {
            console.log(`\n[${heroId}] SKIP — handled by import-jetpack-cat-phrases-from-wiki.mjs`);
            continue;
        }
        const result = await importHero(heroId, pageTitle || wikiPageTitleForHero(heroId));
        added += result.added;
        failed += result.failed;
    }

    console.log('\nDone.');
    console.log(`  lines added: ${added}`);
    console.log(`  failed: ${failed}`);
    if (!dryRun) {
        const gen = spawnSync(process.execPath, [path.join(__dirname, 'generate-manifest.js')], {
            cwd: REPO,
            stdio: 'inherit',
        });
        if (gen.status !== 0) process.exit(gen.status || 1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
