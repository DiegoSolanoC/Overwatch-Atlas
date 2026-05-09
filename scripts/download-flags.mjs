/**
 * Downloads PNG flags from flagcdn.com (by ISO alpha-2), saves using English
 * common names: Title Case, spaces between words, no hyphens (e.g. "United States.png").
 * Writes flags-index.json.
 *
 * Usage: node scripts/download-flags.mjs
 * Requires: npm install sharp --save-dev
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'flags');
const INDEX_PATH = path.join(OUT_DIR, 'flags-index.json');

const TARGET_W = 640;
const TARGET_H = 400;

const REST = 'https://restcountries.com/v3.1/all?fields=cca2,name';

/** If REST ever omits these, merge manually */
const EXTRA = [{ cca2: 'XK', name: { common: 'Kosovo' } }];

/**
 * PNGs in this set are not deleted when re-running (custom / user artwork).
 */
const PRESERVE_CUSTOM_PNG = new Set([
    'Atlantic Arcology.png',
    'Numbani.png',
    'Horizon Lunar Colony.png',
    'Red Promise Colony.png',
    'Moon.png',
    'Mars.png',
    'Interstellar Journey Space Station.png',
    'Space Station.png',
]);

/**
 * Region & custom flags from Wikimedia Commons (raster thumbs), same resize pipeline as countries.
 */
const EXTRA_FLAG_ASSETS = [
    {
        cca2: 'X1',
        common: 'Scotland',
        fileSlug: 'Scotland',
        file: 'Scotland.png',
        /** ISO 3166-2:GB-SCT — same CDN as country flags */
        url: 'https://flagcdn.com/w1280/gb-sct.png',
    },
    {
        cca2: 'X2',
        common: 'Hawaii',
        fileSlug: 'Hawaii',
        file: 'Hawaii.png',
        /** Hawaii, U.S. state */
        url: 'https://flagcdn.com/w1280/us-hi.png',
    },
];

/** Index-only entries for assets we do not fetch (user-provided file on disk). */
const INDEX_ONLY_EXTRAS = [
    {
        cca2: 'X3',
        common: 'Atlantic Arcology',
        fileSlug: 'Atlantic Arcology',
        file: 'Atlantic Arcology.png',
    },
    {
        cca2: 'X4',
        common: 'Numbani',
        fileSlug: 'Numbani',
        file: 'Numbani.png',
    },
    {
        cca2: 'X5',
        common: 'Horizon Lunar Colony',
        fileSlug: 'Horizon Lunar Colony',
        file: 'Horizon Lunar Colony.png',
    },
    {
        cca2: 'X6',
        common: 'Red Promise Colony',
        fileSlug: 'Red Promise Colony',
        file: 'Red Promise Colony.png',
    },
];

function fetchText(url) {
    return fetch(url, { headers: { Accept: 'application/json' } }).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.text();
    });
}

function fetchBuffer(url) {
    return fetch(url, { headers: { Accept: 'image/png,*/*' } }).then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return Buffer.from(await r.arrayBuffer());
    });
}

/**
 * Capitalized initials, words separated by spaces, no hyphens (e.g. "DR Congo").
 */
function titleCaseToken(t) {
    if (!t) return '';
    if (t.length === 2 && t === t.toUpperCase() && /^[A-Z]{2}$/.test(t)) {
        return t;
    }
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function toSpacedFileBase(name) {
    if (!name || typeof name !== 'string') return 'Unknown';
    const deAccented = name
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    const tokens = deAccented.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    if (tokens.length === 0) return 'Unknown';
    return tokens.map(titleCaseToken).join(' ');
}

function buildCountryList() {
    return fetchText(REST).then((raw) => JSON.parse(raw)).then((data) => {
        const byCode = new Map();
        for (const row of data) {
            if (row.cca2 && /^[A-Za-z]{2}$/.test(row.cca2)) {
                const code = row.cca2.toUpperCase();
                const common = row.name && row.name.common ? String(row.name.common) : code;
                byCode.set(code, { cca2: code, common });
            }
        }
        for (const extra of EXTRA) {
            const code = extra.cca2.toUpperCase();
            if (!byCode.has(code)) {
                byCode.set(code, {
                    cca2: code,
                    common: extra.name.common
                });
            }
        }
        return [...byCode.values()].sort((a, b) => a.cca2.localeCompare(b.cca2));
    });
}

function assignFileNames(countries) {
    const baseCount = new Map();
    for (const c of countries) {
        const base = toSpacedFileBase(c.common);
        baseCount.set(base, (baseCount.get(base) || 0) + 1);
    }
    for (const c of countries) {
        let base = toSpacedFileBase(c.common);
        if (baseCount.get(base) > 1) {
            base = `${base} ${c.cca2}`;
        }
        c.fileSlug = base;
        c.file = `${base}.png`;
    }
    return countries;
}

function clearOutputPng() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const f of fs.readdirSync(OUT_DIR)) {
        if (f.endsWith('.png')) {
            if (PRESERVE_CUSTOM_PNG.has(f)) continue;
            fs.unlinkSync(path.join(OUT_DIR, f));
        }
    }
    if (fs.existsSync(INDEX_PATH)) {
        fs.unlinkSync(INDEX_PATH);
    }
}

async function processOne(country) {
    const lc = country.cca2.toLowerCase();
    const dest = path.join(OUT_DIR, country.file);
    const url = `https://flagcdn.com/w1280/${lc}.png`;
    const buf = await fetchBuffer(url);
    await sharp(buf)
        .resize(TARGET_W, TARGET_H, {
            fit: 'contain',
            position: 'centre',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ compressionLevel: 9, effort: 7 })
        .toFile(dest);
}

async function processFromUrl(url, fileName) {
    const dest = path.join(OUT_DIR, fileName);
    const buf = await fetchBuffer(url);
    await sharp(buf)
        .resize(TARGET_W, TARGET_H, {
            fit: 'contain',
            position: 'centre',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ compressionLevel: 9, effort: 7 })
        .toFile(dest);
}

async function main() {
    console.log('Output:', OUT_DIR);
    const list = assignFileNames(await buildCountryList());
    console.log('Countries:', list.length);

    clearOutputPng();

    let ok = 0;
    let fail = 0;
    let i = 0;
    const concurrency = 6;

    async function worker() {
        while (i < list.length) {
            const idx = i++;
            const country = list[idx];
            try {
                await processOne(country);
                ok++;
                process.stdout.write(`\r✓ ${ok}/${list.length} ${country.file}`);
            } catch (e) {
                fail++;
                console.error(`\n✗ ${country.cca2} ${country.file}: ${e.message}`);
            }
        }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const index = list.map((c) => ({
        cca2: c.cca2,
        common: c.common,
        file: c.file,
        fileSlug: c.fileSlug
    }));

    for (const extra of EXTRA_FLAG_ASSETS) {
        try {
            process.stdout.write(`\n→ ${extra.file} …`);
            await processFromUrl(extra.url, extra.file);
            index.push({
                cca2: extra.cca2,
                common: extra.common,
                file: extra.file,
                fileSlug: extra.fileSlug
            });
            console.log(' ✓');
        } catch (e) {
            console.error(`\n✗ ${extra.file}: ${e.message}`);
        }
    }

    for (const row of INDEX_ONLY_EXTRAS) {
        index.push({
            cca2: row.cca2,
            common: row.common,
            file: row.file,
            fileSlug: row.fileSlug
        });
    }

    index.sort((a, b) => a.cca2.localeCompare(b.cca2));

    fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

    console.log(`\nDone. OK: ${ok}, failed: ${fail}`);
    console.log('Index:', INDEX_PATH);
    console.log('Tip: run npm run flags:lookup (or node scripts/build-flags-lookup.mjs) to refresh window.FLAG_FILE_BY_COMMON');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
