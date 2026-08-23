#!/usr/bin/env node
/**
 * Snapshot HeroVoice extract tree before / after a tool dump.
 *
 * Writes under overwatch-atlas-audits/herovoice-snapshots/<label>/ :
 *   meta.json          — root, timing, counts
 *   files.jsonl        — one JSON object per audio file
 *   by-hero.json       — per-hero folder counts + newest/oldest mtime
 *   LATEST_<kind>.txt  — pointer at snapshots root (baseline | post)
 *
 * Usage:
 *   node scripts/snapshot-herovoice-extract.mjs
 *   node scripts/snapshot-herovoice-extract.mjs --kind baseline
 *   node scripts/snapshot-herovoice-extract.mjs --kind post --label after-sXX
 *   node scripts/snapshot-herovoice-extract.mjs --no-hash   (faster; size+mtime only)
 *   node scripts/snapshot-herovoice-extract.mjs --root "C:/path/to/HeroVoice"
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { auditPath, ensureAuditWorkspace } from './lib/auditWorkspace.mjs';

const DEFAULT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const AUDIO_RE = /\.(ogg|wem|wav|mp3|flac)$/i;

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    let root = DEFAULT_ROOT;
    let kind = 'baseline';
    let label = '';
    let hash = true;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--root' && argv[i + 1]) {
            root = argv[++i];
        } else if (a === '--kind' && argv[i + 1]) {
            kind = String(argv[++i]).trim().toLowerCase() || 'baseline';
        } else if (a === '--label' && argv[i + 1]) {
            label = String(argv[++i]).trim();
        } else if (a === '--no-hash') {
            hash = false;
        } else if (a === '--hash') {
            hash = true;
        }
    }
    if (kind !== 'baseline' && kind !== 'post') kind = 'baseline';
    return { root, kind, label, hash };
}

function stampLocal() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * @param {string} rel
 */
function splitHeroCategory(rel) {
    const parts = String(rel || '').replace(/\\/g, '/').split('/').filter(Boolean);
    return {
        hero: parts[0] || '',
        category: parts[1] || '',
        leafFolder: parts.length >= 3 ? parts[parts.length - 2] : '',
    };
}

/**
 * @param {string} filePath
 */
function fileMd5(filePath) {
    return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * @param {string} root
 * @param {boolean} doHash
 * @param {(n: number, rel: string) => void} onProgress
 */
async function walkAudioFiles(root, doHash, onProgress) {
    /** @type {Array<object>} */
    const rows = [];
    /** @type {Map<string, { files: number, bytes: number, newestMtimeMs: number, oldestMtimeMs: number, categories: Record<string, number> }>} */
    const byHero = new Map();

    async function walk(dir, relBase) {
        let ents;
        try {
            ents = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of ents) {
            const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                await walk(full, rel);
                continue;
            }
            if (!ent.isFile() || !AUDIO_RE.test(ent.name)) continue;

            let st;
            try {
                st = await fsp.stat(full);
            } catch {
                continue;
            }

            const { hero, category, leafFolder } = splitHeroCategory(rel);
            const mtimeMs = st.mtimeMs;
            const row = {
                rel: rel.replace(/\\/g, '/'),
                size: st.size,
                mtimeMs,
                mtimeUtc: new Date(mtimeMs).toISOString(),
                hero,
                category,
                leafFolder,
                name: ent.name,
                typeHint: /\.0B2[-.]/i.test(ent.name)
                    ? '0B2'
                    : /\.03F[-.]/i.test(ent.name)
                      ? '03F'
                      : 'other',
            };
            if (doHash) {
                try {
                    row.md5 = fileMd5(full);
                } catch {
                    row.md5 = '';
                }
            }
            rows.push(row);

            if (!byHero.has(hero)) {
                byHero.set(hero, {
                    files: 0,
                    bytes: 0,
                    newestMtimeMs: mtimeMs,
                    oldestMtimeMs: mtimeMs,
                    categories: {},
                });
            }
            const h = byHero.get(hero);
            h.files += 1;
            h.bytes += st.size;
            if (mtimeMs > h.newestMtimeMs) h.newestMtimeMs = mtimeMs;
            if (mtimeMs < h.oldestMtimeMs) h.oldestMtimeMs = mtimeMs;
            h.categories[category || '(root)'] = (h.categories[category || '(root)'] || 0) + 1;

            if (rows.length % 2500 === 0) onProgress(rows.length, rel);
        }
    }

    await walk(root, '');
    return { rows, byHero };
}

async function main() {
    const { root, kind, label, hash } = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(root)) {
        console.error(`HeroVoice root not found: ${root}`);
        process.exit(1);
    }

    ensureAuditWorkspace();
    const snapRoot = auditPath('herovoice-snapshots');
    await fsp.mkdir(snapRoot, { recursive: true });

    const folderName = [kind, label || stampLocal()].filter(Boolean).join('_');
    const outDir = path.join(snapRoot, folderName);
    await fsp.mkdir(outDir, { recursive: true });

    const started = Date.now();
    console.log(`Snapshot kind=${kind}`);
    console.log(`  root: ${root}`);
    console.log(`  out:  ${outDir}`);
    console.log(`  hash: ${hash ? 'md5' : 'off (size+mtime only)'}`);
    console.log('Walking…');

    const { rows, byHero } = await walkAudioFiles(root, hash, (n, rel) => {
        process.stdout.write(`  … ${n} files (last: ${rel.slice(0, 80)})\n`);
    });

    rows.sort((a, b) => a.rel.localeCompare(b.rel, undefined, { sensitivity: 'base' }));

    const jsonlPath = path.join(outDir, 'files.jsonl');
    const ws = fs.createWriteStream(jsonlPath, { encoding: 'utf8' });
    for (const row of rows) ws.write(`${JSON.stringify(row)}\n`);
    await new Promise((resolve, reject) => {
        ws.end(() => resolve());
        ws.on('error', reject);
    });

    /** @type {Record<string, object>} */
    const byHeroOut = {};
    for (const [hero, stats] of [...byHero.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        byHeroOut[hero] = {
            files: stats.files,
            bytes: stats.bytes,
            newestMtimeUtc: new Date(stats.newestMtimeMs).toISOString(),
            oldestMtimeUtc: new Date(stats.oldestMtimeMs).toISOString(),
            categories: stats.categories,
        };
    }
    await fsp.writeFile(path.join(outDir, 'by-hero.json'), `${JSON.stringify(byHeroOut, null, 2)}\n`);

    const mtimes = rows.map((r) => r.mtimeMs).sort((a, b) => a - b);
    const meta = {
        kind,
        label: label || null,
        capturedAt: new Date().toISOString(),
        elapsedMs: Date.now() - started,
        root: path.resolve(root),
        hashed: hash,
        fileCount: rows.length,
        totalBytes: rows.reduce((s, r) => s + r.size, 0),
        heroCount: Object.keys(byHeroOut).length,
        oldestMtimeUtc: mtimes.length ? new Date(mtimes[0]).toISOString() : null,
        newestMtimeUtc: mtimes.length ? new Date(mtimes[mtimes.length - 1]).toISOString() : null,
        matchTalkFiles: rows.filter((r) => r.category === 'MatchTalk').length,
        matchStartTalkFiles: rows.filter((r) => r.category === 'MatchStartTalk').length,
        unknownFiles: rows.filter((r) => r.category === 'Unknown').length,
        typeCounts: rows.reduce((acc, r) => {
            acc[r.typeHint] = (acc[r.typeHint] || 0) + 1;
            return acc;
        }, {}),
        snapshotDir: outDir,
        filesJsonl: jsonlPath,
    };
    await fsp.writeFile(path.join(outDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);

    const pointer = path.join(snapRoot, `LATEST_${kind.toUpperCase()}.txt`);
    await fsp.writeFile(pointer, `${folderName}\n`, 'utf8');

    const readme = [
        `HeroVoice snapshot (${kind})`,
        `captured: ${meta.capturedAt}`,
        `root: ${meta.root}`,
        `files: ${meta.fileCount}`,
        `hash: ${hash ? 'md5' : 'none'}`,
        '',
        'Next:',
        '  1) Extract / overwrite HeroVoice',
        '  2) node scripts/snapshot-herovoice-extract.mjs --kind post',
        '  3) node scripts/diff-herovoice-extract.mjs',
        '',
    ].join('\n');
    await fsp.writeFile(path.join(outDir, 'README.txt'), readme, 'utf8');

    console.log('\nDone.');
    console.log(`  files: ${meta.fileCount}`);
    console.log(`  heroes: ${meta.heroCount}`);
    console.log(`  MatchTalk: ${meta.matchTalkFiles}`);
    console.log(`  MatchStartTalk: ${meta.matchStartTalkFiles}`);
    console.log(`  Unknown: ${meta.unknownFiles}`);
    console.log(`  oldest: ${meta.oldestMtimeUtc}`);
    console.log(`  newest: ${meta.newestMtimeUtc}`);
    console.log(`  elapsed: ${(meta.elapsedMs / 1000).toFixed(1)}s`);
    console.log(`  pointer: ${pointer}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
