#!/usr/bin/env node
/**
 * Diff two HeroVoice snapshots (baseline vs post-extract).
 *
 * Reports:
 *   - added: present only in post (new voicelines / folders)
 *   - removed: present only in baseline (gone from disk after extract)
 *   - updated: same path, different md5 and/or newer mtime / size change
 *   - stale: same path, same size+md5 (or size+mtime if no hash) — not touched by extract
 *
 * Usage:
 *   node scripts/diff-herovoice-extract.mjs
 *   node scripts/diff-herovoice-extract.mjs --baseline <folderName> --post <folderName>
 *   node scripts/diff-herovoice-extract.mjs --mtime-slop-ms 2000
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { auditPath, ensureAuditWorkspace } from './lib/auditWorkspace.mjs';

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    let baseline = '';
    let post = '';
    let mtimeSlopMs = 1500;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--baseline' && argv[i + 1]) baseline = argv[++i];
        else if (a === '--post' && argv[i + 1]) post = argv[++i];
        else if (a === '--mtime-slop-ms' && argv[i + 1]) mtimeSlopMs = Number(argv[++i]) || 1500;
    }
    return { baseline, post, mtimeSlopMs };
}

/**
 * @param {string} snapRoot
 * @param {string} kind
 */
async function resolvePointer(snapRoot, kind) {
    const pointer = path.join(snapRoot, `LATEST_${kind}.txt`);
    if (!fs.existsSync(pointer)) return '';
    return String(await fsp.readFile(pointer, 'utf8')).trim();
}

/**
 * @param {string} dir
 * @returns {Promise<Map<string, object>>}
 */
async function loadJsonlMap(dir) {
    const file = path.join(dir, 'files.jsonl');
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
    const text = await fsp.readFile(file, 'utf8');
    /** @type {Map<string, object>} */
    const map = new Map();
    for (const line of text.split(/\n/)) {
        if (!line.trim()) continue;
        const row = JSON.parse(line);
        map.set(String(row.rel).replace(/\\/g, '/'), row);
    }
    return map;
}

/**
 * @param {object} a
 * @param {object} b
 * @param {number} mtimeSlopMs
 */
function classifyChange(a, b, mtimeSlopMs) {
    const hashA = a.md5 || '';
    const hashB = b.md5 || '';
    if (hashA && hashB) {
        if (hashA !== hashB) return 'updated-hash';
        return 'stale';
    }
    if (a.size !== b.size) return 'updated-size';
    if (Math.abs((b.mtimeMs || 0) - (a.mtimeMs || 0)) > mtimeSlopMs) {
        return b.mtimeMs > a.mtimeMs ? 'updated-mtime' : 'mtime-older';
    }
    return 'stale';
}

/**
 * Interesting interaction / chatter categories for focused reports.
 */
const FOCUS_CATS = new Set([
    'MatchTalk',
    'MatchStartTalk',
    'HeroSelect',
    'Voicelines',
    'Unknown',
    'Hello',
    'Thanks',
    'Sorry',
    'Laugh',
]);

async function main() {
    const args = parseArgs(process.argv.slice(2));
    ensureAuditWorkspace();
    const snapRoot = auditPath('herovoice-snapshots');

    const baselineName = args.baseline || (await resolvePointer(snapRoot, 'BASELINE'));
    const postName = args.post || (await resolvePointer(snapRoot, 'POST'));
    if (!baselineName || !postName) {
        console.error('Need baseline + post snapshots.');
        console.error('  Run snapshot --kind baseline, extract, snapshot --kind post, then this.');
        console.error(`  Looking in: ${snapRoot}`);
        process.exit(1);
    }

    const baselineDir = path.join(snapRoot, baselineName);
    const postDir = path.join(snapRoot, postName);
    if (!fs.existsSync(baselineDir) || !fs.existsSync(postDir)) {
        console.error(`Missing snapshot folder(s):\n  ${baselineDir}\n  ${postDir}`);
        process.exit(1);
    }

    console.log(`Diffing:\n  baseline: ${baselineName}\n  post:     ${postName}`);

    const before = await loadJsonlMap(baselineDir);
    const after = await loadJsonlMap(postDir);

    /** @type {string[]} */
    const added = [];
    /** @type {string[]} */
    const removed = [];
    /** @type {Array<{ rel: string, why: string, before: object, after: object }>} */
    const updated = [];
    /** @type {string[]} */
    const stale = [];

    for (const [rel, row] of after) {
        if (!before.has(rel)) {
            added.push(rel);
            continue;
        }
        const why = classifyChange(before.get(rel), row, args.mtimeSlopMs);
        if (why === 'stale') stale.push(rel);
        else if (why === 'mtime-older') stale.push(rel);
        else updated.push({ rel, why, before: before.get(rel), after: row });
    }
    for (const rel of before.keys()) {
        if (!after.has(rel)) removed.push(rel);
    }

    added.sort();
    removed.sort();
    stale.sort();
    updated.sort((a, b) => a.rel.localeCompare(b.rel));

    const focus = (list) =>
        list.filter((rel) => {
            const cat = String(rel).split('/')[1] || '';
            return FOCUS_CATS.has(cat);
        });

    const outDir = path.join(
        snapRoot,
        `diff_${baselineName}_vs_${postName}`.replace(/[<>:"|?*]/g, '_').slice(0, 180),
    );
    await fsp.mkdir(outDir, { recursive: true });

    const summary = {
        comparedAt: new Date().toISOString(),
        baseline: baselineName,
        post: postName,
        baselineCount: before.size,
        postCount: after.size,
        added: added.length,
        removed: removed.length,
        updated: updated.length,
        stale: stale.length,
        focus: {
            added: focus(added).length,
            removed: focus(removed).length,
            updated: focus(updated.map((u) => u.rel)).length,
            stale: focus(stale).length,
        },
    };

    await fsp.writeFile(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fsp.writeFile(path.join(outDir, 'added.jsonl'), added.map((r) => `${JSON.stringify({ rel: r, ...after.get(r) })}\n`).join(''));
    await fsp.writeFile(
        path.join(outDir, 'removed.jsonl'),
        removed.map((r) => `${JSON.stringify({ rel: r, ...before.get(r) })}\n`).join(''),
    );
    await fsp.writeFile(
        path.join(outDir, 'updated.jsonl'),
        updated
            .map((u) =>
                `${JSON.stringify({
                    rel: u.rel,
                    why: u.why,
                    beforeSize: u.before.size,
                    afterSize: u.after.size,
                    beforeMtimeUtc: u.before.mtimeUtc,
                    afterMtimeUtc: u.after.mtimeUtc,
                    beforeMd5: u.before.md5 || null,
                    afterMd5: u.after.md5 || null,
                    hero: u.after.hero,
                    category: u.after.category,
                })}\n`,
            )
            .join(''),
    );
    await fsp.writeFile(
        path.join(outDir, 'stale.jsonl'),
        stale.map((r) => `${JSON.stringify({ rel: r, ...before.get(r) })}\n`).join(''),
    );

    // Focused interaction/chatter lists (easier to skim)
    await fsp.writeFile(
        path.join(outDir, 'focus-added.txt'),
        `${focus(added).join('\n')}${focus(added).length ? '\n' : ''}`,
    );
    await fsp.writeFile(
        path.join(outDir, 'focus-stale.txt'),
        `${focus(stale).join('\n')}${focus(stale).length ? '\n' : ''}`,
    );
    await fsp.writeFile(
        path.join(outDir, 'focus-removed.txt'),
        `${focus(removed).join('\n')}${focus(removed).length ? '\n' : ''}`,
    );
    await fsp.writeFile(
        path.join(outDir, 'focus-updated.txt'),
        `${focus(updated.map((u) => u.rel)).join('\n')}${focus(updated.map((u) => u.rel)).length ? '\n' : ''}`,
    );

    console.log('\nSummary');
    console.log(`  added:   ${summary.added}  (focus ${summary.focus.added})`);
    console.log(`  removed: ${summary.removed}  (focus ${summary.focus.removed})`);
    console.log(`  updated: ${summary.updated}  (focus ${summary.focus.updated})`);
    console.log(`  stale:   ${summary.stale}  (focus ${summary.focus.stale})`);
    console.log(`\nWrote: ${outDir}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
