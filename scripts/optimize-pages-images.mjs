/**
 * GitHub Pages image pass — runs on `_site/` after prepare-github-pages.
 *
 * - Resizes / recompresses PNG+JPEG masters in place (smaller deploy + fallback)
 * - Writes sibling `.webp` when smaller/useful
 * - Emits `src/data/platform/image-asset-map.json` with content hashes
 *   so the client can cache aggressively and bust only when bytes change
 *
 * Skip: OPTIMIZE_PAGES_IMAGES=0
 * Limit (smoke): OPTIMIZE_PAGES_IMAGES_MAX=50
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, '_site');
const IMAGES_ROOT = path.join(SITE, 'src', 'assets', 'images');
const MAP_OUT = path.join(SITE, 'src', 'data', 'platform', 'image-asset-map.json');

const SKIP = String(process.env.OPTIMIZE_PAGES_IMAGES || '1').trim() === '0';
const MAX_FILES = Number(process.env.OPTIMIZE_PAGES_IMAGES_MAX || 0) || 0;
const MIN_BYTES = 12 * 1024;
const CONCURRENCY = Math.max(1, Number(process.env.OPTIMIZE_PAGES_IMAGES_CONCURRENCY || 4) || 4);

/** @type {Array<{ test: (rel: string) => boolean, maxEdge: number, webpQuality: number }>} */
const RULES = [
    { test: (r) => r.startsWith('Maps/'), maxEdge: 2048, webpQuality: 72 },
    { test: (r) => r.startsWith('Background Pattern/'), maxEdge: 2048, webpQuality: 72 },
    { test: (r) => r.startsWith('Archive/'), maxEdge: 1440, webpQuality: 74 },
    { test: (r) => r.startsWith('Theater/'), maxEdge: 1280, webpQuality: 74 },
    { test: (r) => r.startsWith('Bios/'), maxEdge: 1024, webpQuality: 76 },
    { test: (r) => r.startsWith('Menu'), maxEdge: 1280, webpQuality: 76 },
    { test: (r) => r.startsWith('World View/'), maxEdge: 2048, webpQuality: 74 },
    { test: (r) => r.startsWith('Filters/'), maxEdge: 512, webpQuality: 78 },
    { test: (r) => r.startsWith('Music/'), maxEdge: 512, webpQuality: 78 },
    { test: (r) => r.startsWith('Icons/'), maxEdge: 256, webpQuality: 80 },
    { test: (r) => r.startsWith('Codex/'), maxEdge: 256, webpQuality: 80 },
    { test: () => true, maxEdge: 1440, webpQuality: 75 },
];

function ruleFor(relPosix) {
    for (const rule of RULES) {
        if (rule.test(relPosix)) return rule;
    }
    return RULES[RULES.length - 1];
}

function walkRasterFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            walkRasterFiles(full, out);
            continue;
        }
        if (!/\.(png|jpe?g)$/i.test(ent.name)) continue;
        out.push(full);
    }
    return out;
}

function toPosixRel(abs) {
    return path.relative(IMAGES_ROOT, abs).split(path.sep).join('/');
}

function webKeyFromRel(relPosix) {
    return `src/assets/images/${relPosix}`;
}

function shortHash(buf) {
    return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
}

async function mapPool(items, limit, fn) {
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) {
            const idx = i++;
            await fn(items[idx], idx);
        }
    });
    await Promise.all(workers);
}

async function main() {
    if (SKIP) {
        console.log('optimize-pages-images: skipped (OPTIMIZE_PAGES_IMAGES=0)');
        fs.mkdirSync(path.dirname(MAP_OUT), { recursive: true });
        fs.writeFileSync(
            MAP_OUT,
            `${JSON.stringify({ generatedAt: null, skipped: true, assets: {} }, null, 2)}\n`,
            'utf8',
        );
        return;
    }

    if (!fs.existsSync(IMAGES_ROOT)) {
        throw new Error(`Missing images root: ${IMAGES_ROOT} (run prepare-github-pages first)`);
    }

    let sharp;
    try {
        sharp = (await import('sharp')).default;
    } catch (err) {
        throw new Error(
            'sharp is required for optimize-pages-images. Run npm install (see package.json). '
            + String(err?.message || err),
        );
    }

    let files = walkRasterFiles(IMAGES_ROOT);
    files = files.filter((f) => {
        try {
            return fs.statSync(f).size >= MIN_BYTES;
        } catch {
            return false;
        }
    });
    files.sort((a, b) => a.localeCompare(b));
    if (MAX_FILES > 0) files = files.slice(0, MAX_FILES);

    console.log(`optimize-pages-images: ${files.length} raster file(s), concurrency=${CONCURRENCY}`);

    /** @type {Record<string, { v: string, webp?: string }>} */
    const assets = {};
    let optimized = 0;
    let webpWritten = 0;
    let bytesBefore = 0;
    let masterBytesAfter = 0;
    let webpBytes = 0;
    let failures = 0;

    await mapPool(files, CONCURRENCY, async (abs) => {
        const rel = toPosixRel(abs);
        const key = webKeyFromRel(rel);
        const rule = ruleFor(rel);
        const beforeStat = fs.statSync(abs);
        bytesBefore += beforeStat.size;

        try {
            const input = fs.readFileSync(abs);
            const meta = await sharp(input, { failOn: 'none' }).rotate().metadata();
            const w = meta.width || 0;
            const h = meta.height || 0;
            const needsResize = w > rule.maxEdge || h > rule.maxEdge;
            const pipeline = sharp(input, { failOn: 'none' }).rotate();
            if (needsResize) {
                pipeline.resize({
                    width: rule.maxEdge,
                    height: rule.maxEdge,
                    fit: 'inside',
                    withoutEnlargement: true,
                });
            }

            const isJpeg = /\.jpe?g$/i.test(abs);
            const outBuf = isJpeg
                ? await pipeline.jpeg({ quality: Math.min(82, rule.webpQuality + 4), mozjpeg: true }).toBuffer()
                : await pipeline.png({ compressionLevel: 8, palette: false }).toBuffer();

            // Only replace master when we actually shrink (or resized).
            if (outBuf.length < beforeStat.size || needsResize) {
                fs.writeFileSync(abs, outBuf);
            }

            const finalMaster = fs.readFileSync(abs);
            masterBytesAfter += finalMaster.length;
            const v = shortHash(finalMaster);

            const webpPath = abs.replace(/\.(png|jpe?g)$/i, '.webp');
            const webpRel = rel.replace(/\.(png|jpe?g)$/i, '.webp');
            const webpBuf = await sharp(finalMaster, { failOn: 'none' })
                .webp({ quality: rule.webpQuality, effort: 4 })
                .toBuffer();

            let webpKey;
            if (webpBuf.length + 1024 < finalMaster.length) {
                fs.writeFileSync(webpPath, webpBuf);
                webpKey = webKeyFromRel(webpRel);
                webpWritten += 1;
                webpBytes += webpBuf.length;
            } else if (fs.existsSync(webpPath)) {
                fs.rmSync(webpPath, { force: true });
            }

            assets[key] = webpKey ? { v, webp: webpKey } : { v };
            if (webpKey) assets[webpKey] = { v, webp: webpKey };

            optimized += 1;
            if (optimized % 50 === 0) {
                console.log(`  … ${optimized}/${files.length} (${rel})`);
            }
        } catch (err) {
            failures += 1;
            console.warn(`  ! failed ${rel}:`, err?.message || err);
            try {
                const buf = fs.readFileSync(abs);
                masterBytesAfter += buf.length;
                assets[key] = { v: shortHash(buf) };
            } catch {
                /* ignore */
            }
        }
    });

    fs.mkdirSync(path.dirname(MAP_OUT), { recursive: true });
    const payload = {
        generatedAt: new Date().toISOString(),
        assetCount: Object.keys(assets).length,
        optimized,
        webpWritten,
        failures,
        bytesBefore,
        masterBytesAfter,
        webpBytes,
        assets,
    };
    fs.writeFileSync(MAP_OUT, `${JSON.stringify(payload)}\n`, 'utf8');

    const masterSaved = bytesBefore - masterBytesAfter;
    console.log(
        `optimize-pages-images: done — ${optimized} processed, ${webpWritten} webp, ${failures} failed`,
    );
    console.log(
        `  masters ${(bytesBefore / 1e6).toFixed(1)} → ${(masterBytesAfter / 1e6).toFixed(1)} MB `
        + `(saved ${(masterSaved / 1e6).toFixed(1)} MB); webp +${(webpBytes / 1e6).toFixed(1)} MB`,
    );
    console.log(`  wrote ${path.relative(ROOT, MAP_OUT)}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
