#!/usr/bin/env node
/**
 * Jetpack Cat gallery Phrases — wiki Quotes labels + resolved audio.
 *
 * Wiki Voice Lines / Hero Selected / Catnapper carry spoken labels; many
 * {{Audio}} stubs are empty (`Jetpack Cat - .ogg`). Resolve audio by:
 *   1) valid wiki File: download
 *   2) wiki allimages fuzzy match on emotion token
 *   3) HeroVoice MatchTalk / Ultimate emotion folders (.03F / .0B2)
 *
 * Hello / Thanks / Praise have empty quote cells on the wiki — fill from
 * extract `(cat sounds)` packs, labeled with the Communication trigger.
 *
 * Usage:
 *   node scripts/import-jetpack-cat-phrases-from-wiki.mjs --dry-run
 *   node scripts/import-jetpack-cat-phrases-from-wiki.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { downloadWikiVoicelineFile } from './lib/wiki-voiceline-download.mjs';
import { stripWikiMarkup } from './lib/wiki-markup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const HERO_ID = 'Jetpack Cat';
const PHRASES_DIR = path.join(REPO, 'src/assets/audio/Phrases', HERO_ID);
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    HERO_ID,
);
const WIKI_ORIGIN = 'https://overwatch.weirdgloop.org';
const USER_AGENT = 'OverwatchAtlas/1.0 (jetpack cat gallery phrases)';

const dryRun = process.argv.includes('--dry-run');

/** Wiki Voice Line emotion → preferred MatchTalk / wiki file tokens. */
const EMOTION_TO_FOLDERS = {
    taunting: ['(Taunting) Meow meow me meow meow!', '(taunting)'],
    aggressive: ['(angry meows)', '(angry meow)', '(angry hiss)'],
    annoyed: ['(unamused meows)', '(grumbling meows)'],
    begrudging: ['(grumbling meows)', '(pouty meows)', '(unamused meows)'],
    excited: ['(eager meows)', '(eager meowing)', '(enthusiastic meows)', '(happy meows)'],
    innocent: ['(innocent meows)', '(innocent cat meows)'],
    inviting: ['(eager meowing)', '(eager meows)', '(happy meows)'],
    'pew pew': ['(provoking meows)', '(angry hiss)', '(hisses)'],
    shrugging: ['(matter-of-fact meows)', '(doubtful meows)'],
    questioning: ['(questioning meows)', '(question meows)', '(doubtful meows)'],
    singing: ['(contented meowing)', '(contented meows)', '(happy meows)'],
    tumbling: ['(chaotic yowls)'],
    surprised: ['(confused meows)', '(chaotic yowls)'],
};

function cleanLabel(raw) {
    let s = String(raw || '').replace(/\{\{QuoteTranslation\|[\s\S]*?\}\}/gi, (m) => {
        const quote = m.match(/\|\s*quote\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
        const translation = m.match(/\|\s*translation\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
        if (translation) return `(Swedish) ${translation}`;
        return quote || '';
    });
    s = stripWikiMarkup(s)
        .replace(/<small>[\s\S]*?<\/small>/gi, ' ')
        .replace(/''+/g, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return s;
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

function emotionFromSpoken(spoken) {
    const m = cleanLabel(spoken).match(/^\(([^)]+)\)/);
    return m ? m[1].toLowerCase().trim() : '';
}

function extractSection(wikitext, name) {
    const re = new RegExp(
        `(?:^|\\n)(={2,3})\\s*${name}\\s*\\1\\s*\\n([\\s\\S]*?)(?=\\n={2,3}\\s*[^=\\n]+\\s*={2,3}\\s*(?:\\n|$)|$)`,
        'i',
    );
    return String(wikitext || '').match(re)?.[2] || '';
}

function isStubWikiAudio(wikiAudio) {
    const raw = String(wikiAudio || '')
        .replace(/^File:/i, '')
        .trim();
    if (!raw) return true;
    // `Jetpack Cat - .ogg` / `JetpackCatULT.wav` handled specially
    if (/^jetpack\s*cat\s*-\s*\.ogg$/i.test(raw)) return true;
    return false;
}

/**
 * @param {string} sectionBody
 * @param {(ctx: { trigger: string }) => boolean} keepRow
 */
/**
 * Catnapper → Activation cast only (self/hostile). Skip Tether state lines —
 * those are ability chatter, not gallery ultimate phrases.
 * @param {string} abilitiesBody
 */
function parseCatnapperLines(abilitiesBody) {
    const rows = String(abilitiesBody || '').split(/\n\|-/);
    /** @type {Array<{ spoken: string, wikiAudio: string, trigger: string }>} */
    const out = [];
    let inCatnapper = false;
    let inActivation = false;

    for (const row of rows) {
        if (/rowspan/i.test(row) && /<center/i.test(row) && /'''/.test(row)) {
            const hits = [...row.matchAll(/'''([^']{2,100})'''/g)].map((m) =>
                m[1].replace(/<[^>]+>/g, '').replace(/\{\{[^}]+\}\}/g, '').trim(),
            );
            const primary = hits[0] || '';
            if (/catnapper/i.test(primary) || /catnapper/i.test(row)) {
                inCatnapper = true;
                inActivation = hits.some((h) => /activation/i.test(h));
            } else if (inCatnapper && /activation/i.test(primary)) {
                inActivation = true;
            } else if (inCatnapper && /tether/i.test(primary)) {
                inActivation = false;
            } else if (hits.length && !/catnapper|activation|tether/i.test(primary)) {
                inCatnapper = false;
                inActivation = false;
            }
        }
        if (!inCatnapper || !inActivation) continue;

        const audios = [...row.matchAll(/\{\{Audio\|([^}]+)\}\}/gi)].map((m) => m[1].trim());
        if (!audios.length) continue;
        /** @type {string[]} */
        const spokens = [];
        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell || /rowspan|colspan|<center|<big|'''/i.test(cell)) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;
            const spoken = cleanLabel(cell);
            if (spoken.length >= 1) spokens.push(spoken);
        }
        for (let i = 0; i < audios.length; i += 1) {
            out.push({
                spoken: spokens[i] || spokens[0] || 'Catnapper',
                wikiAudio: audios[i],
                trigger: 'Activation',
            });
        }
    }
    return out;
}

function parseTriggeredRows(sectionBody, keepRow) {
    const rows = String(sectionBody || '').split(/\n\|-/);
    /** @type {Array<{ spoken: string, wikiAudio: string, trigger: string }>} */
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

        const audios = [...row.matchAll(/\{\{Audio\|([^}]+)\}\}/gi)].map((m) => m[1].trim());
        if (!audios.length) continue;

        /** @type {string[]} */
        const spokens = [];
        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell || /rowspan|colspan|<center|<big|'''/i.test(cell)) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;
            const spoken = cleanLabel(cell);
            if (spoken.length >= 1) spokens.push(spoken);
        }

        for (let i = 0; i < audios.length; i += 1) {
            out.push({
                spoken: spokens[i] || spokens[0] || '',
                wikiAudio: audios[i],
                trigger,
            });
        }
    }
    return out;
}

async function fetchQuotesWikitext() {
    const apiUrl = new URL('/api.php', WIKI_ORIGIN);
    apiUrl.searchParams.set('action', 'parse');
    apiUrl.searchParams.set('page', 'Jetpack Cat/Quotes');
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('prop', 'wikitext');
    apiUrl.searchParams.set('redirects', '1');
    const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const wikitext = json.parse?.wikitext?.['*'] || '';
    if (!wikitext) throw new Error('empty wikitext');
    return wikitext;
}

/** @type {string[]|null} */
let wikiImageCache = null;

async function listWikiJetpackImages() {
    if (wikiImageCache) return wikiImageCache;
    /** @type {string[]} */
    const names = [];
    let cont = null;
    do {
        const url = new URL('/api.php', WIKI_ORIGIN);
        url.searchParams.set('action', 'query');
        url.searchParams.set('list', 'allimages');
        url.searchParams.set('aiprefix', 'Jetpack Cat -');
        url.searchParams.set('ailimit', '100');
        url.searchParams.set('format', 'json');
        if (cont) url.searchParams.set('aicontinue', cont);
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        const json = await res.json();
        for (const img of json.query?.allimages || []) {
            names.push(String(img.name || img.title || '').replace(/^File:/i, ''));
        }
        cont = json.continue?.aicontinue || null;
    } while (cont);
    wikiImageCache = names;
    return names;
}

function normalizeToken(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[_\s]+/g, ' ')
        .replace(/[^a-z0-9()!\s.-]/g, '')
        .trim();
}

async function findWikiFileForSpoken(spoken) {
    const emotion = emotionFromSpoken(spoken);
    const images = await listWikiJetpackImages();
    const want = normalizeToken(spoken);
    const wantEmotion = normalizeToken(emotion);
    // Avoid matching bare "Meow!" against every Swedish/meow file.
    if (!wantEmotion && want.replace(/meow/g, '').replace(/[^a-z0-9]/g, '').length < 4) {
        return null;
    }

    // Exact-ish: dialogue part of `Jetpack Cat - LABEL.ogg`
    for (const name of images) {
        const m = name.match(/^Jetpack[ _]Cat[ _]-[ _](.+)\.ogg$/i);
        if (!m) continue;
        const label = normalizeToken(m[1].replace(/_/g, ' '));
        if (label && want && label === want) return `File:${name}`;
        if (
            label
            && want
            && want.length >= 12
            && (label.includes(want) || want.includes(label))
        ) {
            return `File:${name}`;
        }
    }

    // Emotion token match against `(angry_hiss)` style files — only with an emotion tag.
    if (wantEmotion) {
        const candidates = EMOTION_TO_FOLDERS[wantEmotion] || [`(${wantEmotion})`];
        for (const cand of candidates) {
            const tok = normalizeToken(cand).replace(/[()]/g, '');
            if (tok.length < 4) continue;
            for (const name of images) {
                const label = normalizeToken(
                    name
                        .replace(/^Jetpack[ _]Cat[ _]-[ _]/i, '')
                        .replace(/\.ogg$/i, '')
                        .replace(/_/g, ' '),
                );
                const bare = label.replace(/[()]/g, '');
                if (bare === tok || bare.startsWith(tok) || tok.startsWith(bare)) {
                    return `File:${name}`;
                }
            }
        }
    }
    return null;
}

/**
 * @param {string} spoken
 * @returns {string|null} absolute path
 */
function findExtractAudioForSpoken(spoken) {
    const emotion = emotionFromSpoken(spoken);
    const candidates = [];
    if (emotion && EMOTION_TO_FOLDERS[emotion]) {
        candidates.push(...EMOTION_TO_FOLDERS[emotion]);
    }
    if (emotion) {
        candidates.push(`(${emotion} meows)`, `(${emotion} meowing)`, `(${emotion})`);
    }
    // Ultimate-ish
    if (/meoweoweew|meeeee?oooo+www/i.test(spoken)) {
        candidates.push('(friendly ultimate cat sounds)', '(ultimate cat sounds)', '(enemy ultimate cat sounds)');
    }
    if (/hostile|enemy/i.test(spoken) || /meeeeeooooowww/i.test(spoken)) {
        candidates.unshift('(enemy ultimate cat sounds)');
    }

    const searchRoots = [
        path.join(EXTRACT_ROOT, 'MatchTalk'),
        path.join(EXTRACT_ROOT, 'Ultimate'),
        path.join(EXTRACT_ROOT, 'HeroSelect'),
        path.join(EXTRACT_ROOT, 'Voicelines'),
    ];

    for (const cand of candidates) {
        const want = normalizeToken(cand);
        for (const root of searchRoots) {
            if (!fs.existsSync(root)) continue;
            for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
                if (!ent.isDirectory()) {
                    if (/\.0B2-/i.test(ent.name) && normalizeToken(ent.name).includes(want.replace(/[()]/g, ''))) {
                        return path.join(root, ent.name);
                    }
                    continue;
                }
                if (normalizeToken(ent.name) !== want && !normalizeToken(ent.name).includes(want.replace(/[()]/g, ''))) {
                    continue;
                }
                const dir = path.join(root, ent.name);
                const take =
                    fs.readdirSync(dir).find((n) => /\.03F\./i.test(n) && /\.ogg$/i.test(n))
                    || fs.readdirSync(dir).find((n) => /\.0B2-/i.test(n) && /\.ogg$/i.test(n));
                if (take) return path.join(dir, take);
            }
        }
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

async function clearPhraseAudio() {
    if (!fs.existsSync(PHRASES_DIR)) return;
    async function wipe(dir) {
        for (const ent of await fsp.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                await wipe(full);
                const left = await fsp.readdir(full);
                if (!left.length) await fsp.rmdir(full).catch(() => {});
            } else if (/\.(ogg|mp3|wav|m4a|webm)$/i.test(ent.name)) {
                await fsp.unlink(full);
            }
        }
    }
    await wipe(PHRASES_DIR);
}

/**
 * Copy numbered cat-sound takes into labeled Communication phrases.
 * @param {string} categoryFolder
 * @param {string} labelPrefix
 * @param {Set<string>} used
 * @param {string} [destSub]
 * @param {number} [maxTakes]
 */
async function importCatSoundPack(categoryFolder, labelPrefix, used, destSub = '', maxTakes = 4) {
    const dir = path.join(EXTRACT_ROOT, categoryFolder, '(cat sounds)');
    if (!fs.existsSync(dir)) return 0;
    const takes = fs
        .readdirSync(dir)
        .filter((n) => /\.03F\./i.test(n) && /\.ogg$/i.test(n))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .slice(0, Math.max(0, maxTakes));
    let n = 0;
    for (const take of takes) {
        n += 1;
        const leaf = uniqueName(used, safeFileName(`${labelPrefix} ${n}`));
        const rel = destSub ? `${destSub}/${leaf}` : leaf;
        if (dryRun) {
            console.log(`  DRY [${labelPrefix}] ${rel}`);
            continue;
        }
        const dest = path.join(PHRASES_DIR, ...rel.split('/'));
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.copyFile(path.join(dir, take), dest);
    }
    return takes.length;
}

/**
 * @param {{ spoken: string, wikiAudio: string, trigger: string }} line
 * @param {string} destRel
 * @param {{ wiki: number, extract: number, fail: number }} counters
 */
async function resolveAndSave(line, destRel, counters) {
    const destPath = path.join(PHRASES_DIR, ...destRel.split('/'));
    let via = '';

    // 1) Valid wiki audio title
    let wikiTitle = '';
    if (line.wikiAudio && !isStubWikiAudio(line.wikiAudio)) {
        const raw = line.wikiAudio.replace(/^File:/i, '').trim();
        if (/\.wav$/i.test(raw)) {
            // JetpackCatULT.wav — prefer extract ultimate friendly
            const extractUlt = findExtractAudioForSpoken(line.spoken || 'Meoweoweew!!!');
            if (extractUlt) {
                via = 'extract';
                if (!dryRun) {
                    await fsp.mkdir(path.dirname(destPath), { recursive: true });
                    await fsp.copyFile(extractUlt, destPath);
                }
                counters.extract += 1;
                console.log(`  [${via}] ${destRel}`);
                return true;
            }
        } else {
            wikiTitle = raw.startsWith('File:') ? raw : `File:${raw}`;
        }
    }

    // 2) Fuzzy wiki file from spoken label
    if (!wikiTitle && line.spoken) {
        const found = await findWikiFileForSpoken(line.spoken);
        if (found) wikiTitle = found.startsWith('File:') ? found : `File:${found}`;
    }

    if (wikiTitle) {
        try {
            if (dryRun) {
                console.log(`  [wiki] ${destRel} ← ${wikiTitle}`);
                counters.wiki += 1;
                return true;
            }
            await fsp.mkdir(path.dirname(destPath), { recursive: true });
            await downloadWikiVoicelineFile(wikiTitle, destPath);
            counters.wiki += 1;
            console.log(`  [wiki] ${destRel}`);
            return true;
        } catch (err) {
            console.warn(`  wiki fail ${destRel}: ${err instanceof Error ? err.message : err}`);
        }
    }

    // 3) Extract MatchTalk / Ultimate
    const extractPath = findExtractAudioForSpoken(line.spoken);
    if (extractPath) {
        via = 'extract';
        if (dryRun) {
            console.log(`  [extract] ${destRel} ← ${path.relative(EXTRACT_ROOT, extractPath)}`);
            counters.extract += 1;
            return true;
        }
        await fsp.mkdir(path.dirname(destPath), { recursive: true });
        await fsp.copyFile(extractPath, destPath);
        counters.extract += 1;
        console.log(`  [extract] ${destRel}`);
        return true;
    }

    counters.fail += 1;
    console.warn(`  FAIL ${destRel} (spoken="${line.spoken}" audio="${line.wikiAudio}")`);
    return false;
}

async function main() {
    console.log(`Jetpack Cat phrases from wiki (${dryRun ? 'DRY RUN' : 'WRITE'})`);
    if (!fs.existsSync(EXTRACT_ROOT)) {
        console.error(`Extract missing: ${EXTRACT_ROOT}`);
        process.exit(1);
    }

    const wikitext = await fetchQuotesWikitext();
    const selected = parseTriggeredRows(extractSection(wikitext, 'Chatter'), ({ trigger }) =>
        /^hero selected$/i.test(trigger),
    );
    const voiceLines = parseTriggeredRows(extractSection(wikitext, 'Voice Lines'), () => true);
    // Only Catnapper Activation + Tether lines (skip weapon / reload ability rows).
    const ultimates = parseCatnapperLines(extractSection(wikitext, 'Abilities'));

    console.log(
        `wiki rows: sel=${selected.length} voice=${voiceLines.length} ult=${ultimates.length}`,
    );

    if (!dryRun) {
        await clearPhraseAudio();
        await fsp.mkdir(PHRASES_DIR, { recursive: true });
    }

    const used = new Set();
    const counters = { wiki: 0, extract: 0, fail: 0 };
    /** @type {string|null} */
    let selectionSourceRel = null;

    for (const line of selected) {
        const label = line.spoken || '(Swedish) Terminal activated';
        const leaf = uniqueName(used, safeFileName(label));
        const ok = await resolveAndSave(line, leaf, counters);
        if (ok && !selectionSourceRel) selectionSourceRel = leaf;
    }

    for (const line of voiceLines) {
        const label = line.spoken || 'Voice line';
        const leaf = uniqueName(used, safeFileName(label));
        await resolveAndSave(line, leaf, counters);
    }

    for (const line of ultimates) {
        let label = line.spoken || line.trigger || 'Ultimate';
        if (/self and allies/i.test(line.spoken) || /meoweoweew/i.test(line.spoken)) {
            label = cleanLabel(line.spoken) || 'Meoweoweew!!!';
        }
        const leaf = uniqueName(used, `Ultimate/${safeFileName(label)}`);
        await resolveAndSave({ ...line, spoken: label }, leaf, counters);
    }

    // Communication — wiki cells are empty; keep a few labeled takes (not every .03F).
    const nHello = await importCatSoundPack('Hello', '(Hello)', used, '', 4);
    const nThanks = await importCatSoundPack('Thanks', '(Thanks)', used, '', 4);
    const nPraise = await importCatSoundPack(
        path.join('Unknown', '11E1.078'),
        '(Praise)',
        used,
        '',
        4,
    );
    console.log(`comm packs: hello=${nHello} thanks=${nThanks} praise=${nPraise}`);

    if (selectionSourceRel && !dryRun) {
        const src = path.join(PHRASES_DIR, selectionSourceRel);
        if (fs.existsSync(src)) {
            await fsp.copyFile(src, path.join(PHRASES_DIR, 'Selection.ogg'));
            console.log('Selection.ogg ←', selectionSourceRel);
        }
    } else if (selectionSourceRel && dryRun) {
        console.log('DRY Selection.ogg ←', selectionSourceRel);
    }

    console.log('\nDone.');
    console.log(`  wiki downloads: ${counters.wiki}`);
    console.log(`  extract copies: ${counters.extract}`);
    console.log(`  failed: ${counters.fail}`);

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
