/**
 * Keep story-archive heroes / factions / npcs in sync with Filters image folders.
 * Called from generate-manifest.js whenever filter assets are scanned.
 *
 * - Add: create a default intel stub if the filter image/folder is new
 * - Remove: drop archive rows whose filter asset is gone
 * - Rename: if exactly one name left and one appeared, migrate the row
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {object} row
 * @returns {string}
 */
function rowName(row) {
    if (!row || typeof row !== 'object') return '';
    if (Array.isArray(row.variants) && row.variants[0]) {
        const v0 = row.variants[0];
        return String(v0.name != null ? v0.name : row.name || '').trim();
    }
    return String(row.name != null ? row.name : '').trim();
}

/**
 * @param {object} row
 * @param {string} nextName
 */
function renameRow(row, nextName) {
    const name = String(nextName || '').trim();
    if (!row || !name) return row;
    const next = { ...row, name };
    if (Array.isArray(row.variants) && row.variants.length) {
        next.variants = row.variants.map((v, i) =>
            i === 0 && v && typeof v === 'object' ? { ...v, name } : v,
        );
    }
    return next;
}

/**
 * @param {'heroes'|'factions'|'npcs'} kind
 * @param {string} name
 */
function makeStub(kind, name) {
    const n = String(name || '').trim();
    if (kind === 'heroes') {
        return {
            name: n,
            description: '',
            relevantLocations: [],
            heroRole: 'Unassigned',
            heroSubRole: '',
            connections: [],
        };
    }
    if (kind === 'factions') {
        return {
            name: n,
            description: '',
            factionType: 'Independent Coalitions',
            connections: [],
        };
    }
    return {
        name: n,
        description: '',
        npcCategory: 'Unassigned',
        connections: [],
    };
}

/**
 * @param {string} archiveJsonPath
 * @param {'heroes'|'factions'|'npcs'} kind
 * @param {string[]} diskNames — filter basenames / faction folder names
 * @returns {{ added: string[], removed: string[], renamed: string|null, total: number }}
 */
function syncArchiveFile(archiveJsonPath, kind, diskNames) {
    const disk = [...new Set((diskNames || []).map((x) => String(x || '').trim()).filter(Boolean))];
    const diskSet = new Set(disk);

    let data = { events: [] };
    try {
        data = JSON.parse(fs.readFileSync(archiveJsonPath, 'utf8'));
    } catch {
        data = { events: [] };
    }
    if (!Array.isArray(data.events)) data.events = [];

    /** @type {Map<string, object>} */
    const byName = new Map();
    for (const row of data.events) {
        const n = rowName(row);
        if (n && !byName.has(n)) byName.set(n, row);
    }

    const archiveNames = [...byName.keys()];
    const missing = disk.filter((n) => !byName.has(n));
    const orphans = archiveNames.filter((n) => !diskSet.has(n));

    /** @type {string[]} */
    const added = [];
    /** @type {string[]} */
    const removed = [];
    /** @type {string|null} */
    let renamed = null;

    if (orphans.length === 1 && missing.length === 1) {
        const from = orphans[0];
        const to = missing[0];
        const prev = byName.get(from);
        byName.delete(from);
        byName.set(to, renameRow(prev, to));
        renamed = `${from} → ${to}`;
    } else {
        for (const n of orphans) {
            byName.delete(n);
            removed.push(n);
        }
        for (const n of missing) {
            byName.set(n, makeStub(kind, n));
            added.push(n);
        }
    }

    /*
     * Keep existing archive order (Filters folder scan order is not a stable
     * editorial sort). Drop orphans, then append new stubs in disk order.
     */
    const nextEvents = [];
    const seen = new Set();
    for (const row of data.events) {
        const n = rowName(row);
        if (!n || !diskSet.has(n) || seen.has(n)) continue;
        const kept = byName.get(n);
        if (!kept) continue;
        nextEvents.push(kept);
        seen.add(n);
    }
    for (const n of disk) {
        if (seen.has(n)) continue;
        const row = byName.get(n);
        if (!row) continue;
        nextEvents.push(row);
        seen.add(n);
    }

    const changed =
        added.length > 0
        || removed.length > 0
        || Boolean(renamed)
        || nextEvents.length !== data.events.length;

    if (changed) {
        const out = { ...data, events: nextEvents };
        fs.writeFileSync(archiveJsonPath, `${JSON.stringify(out, null, 2)}\n`);
    }

    return {
        added,
        removed,
        renamed,
        total: nextEvents.length,
    };
}

/**
 * @param {object} opts
 * @param {string} opts.dataDir — src/data
 * @param {string[]} opts.heroes
 * @param {Array<{ filename: string, displayName: string }>} opts.factions
 * @param {string[]} opts.npcs
 */
function syncGalleryArchivesFromFilters(opts) {
    const dataDir = opts.dataDir;
    const storyDir = path.join(dataDir, 'story-archive');

    const heroNames = opts.heroes || [];
    const npcNames = opts.npcs || [];
    const factionNames = (opts.factions || [])
        .map((f) => String(f?.displayName || f?.filename || '').trim())
        .filter(Boolean);

    const results = {
        heroes: syncArchiveFile(path.join(storyDir, 'heroes.json'), 'heroes', heroNames),
        factions: syncArchiveFile(path.join(storyDir, 'factions.json'), 'factions', factionNames),
        npcs: syncArchiveFile(path.join(storyDir, 'npcs.json'), 'npcs', npcNames),
    };

    for (const [kind, r] of Object.entries(results)) {
        const bits = [];
        if (r.added.length) bits.push(`+${r.added.length}`);
        if (r.removed.length) bits.push(`-${r.removed.length}`);
        if (r.renamed) bits.push(`rename ${r.renamed}`);
        if (bits.length) {
            console.log(`  [gallery-archive] ${kind}: ${bits.join(', ')} → ${r.total} entries`);
        }
    }

    return results;
}

module.exports = {
    syncGalleryArchivesFromFilters,
    makeStub,
    syncArchiveFile,
};
