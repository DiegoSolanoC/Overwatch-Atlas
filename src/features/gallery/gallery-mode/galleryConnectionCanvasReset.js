/**
 * Reset gallery personal connection canvases to live Codex ego layouts.
 * Codex is the source of truth for the new default.
 */

import { ensureCodexConnectionPayload } from '../../codex/codex-connections/CodexConnectionAccess.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import {
    buildGalleryConnectionCanvasModel,
    listDisplayableConnectionEntities,
    snapshotGalleryConnectionCanvas,
} from './galleryConnectionCanvasModel.js';
import {
    clearBioArchiveEventsCache,
    loadBioArchiveEvents,
} from './heroBiographyArchiveData.js';
import { saveBioArchiveConnectionCanvasFromGallery } from './heroBiographyArchivePersist.js';

/** @typedef {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} BioBiographyArchiveCategory */

const RESET_ARCHIVES = /** @type {const} */ (['heroes', 'factions', 'npcs']);

/**
 * @param {unknown} payload
 * @returns {{ nodes: object[], edges: object[], connections: object[] } | null}
 */
function codexGraphFromPayload(payload) {
    if (!payload?.nodes?.length) return null;
    return {
        nodes: payload.nodes,
        edges: payload.edges || [],
        connections: payload.connections || [],
    };
}

/**
 * @param {object|null|undefined} entry
 * @param {BioBiographyArchiveCategory} category
 * @param {string} displayName
 * @param {string} filterKey
 * @param {{ nodes?: object[], edges?: object[], connections?: object[] } | null} codexGraph
 * @returns {object|null}
 */
export function buildCodexDefaultConnectionCanvasSnapshot(
    entry,
    category,
    displayName,
    filterKey,
    codexGraph,
) {
    const model = buildGalleryConnectionCanvasModel(
        entry,
        category,
        displayName,
        filterKey,
        null,
        codexGraph,
    );
    if (!model?.nodes?.length) return null;
    return snapshotGalleryConnectionCanvas(model);
}

/**
 * @param {object|null|undefined} entry
 * @returns {string}
 */
function filterKeyFromArchiveEntry(entry) {
    return String(entry?.name != null ? entry.name : '').trim();
}

/**
 * Rebuild + persist the current entry's canvas from Codex.
 *
 * @param {{
 *   category: BioBiographyArchiveCategory,
 *   filterKey: string,
 *   displayName: string,
 *   entry?: object|null,
 * }} args
 * @returns {Promise<{ ok: boolean, entry?: object, snapshot?: object|null, error?: string }>}
 */
export async function resetGalleryConnectionCanvasToCodex(args) {
    const category = normalizeBioBiographyCategory(args.category);
    const filterKey = String(args.filterKey || '').trim();
    const displayName = String(args.displayName || filterKey).trim();
    if (!filterKey) return { ok: false, error: 'No entry selected.' };
    if (category === 'locations') {
        return { ok: false, error: 'Locations do not support connection canvas.' };
    }

    let payload;
    try {
        payload = await ensureCodexConnectionPayload(true);
    } catch (err) {
        return {
            ok: false,
            error: `Could not load Codex graph: ${err instanceof Error ? err.message : err}`,
        };
    }
    const codexGraph = codexGraphFromPayload(payload);
    if (!codexGraph) {
        return { ok: false, error: 'Codex has no connection graph to use as default.' };
    }

    clearBioArchiveEventsCache(category);
    const events = await loadBioArchiveEvents(category);
    const entry =
        args.entry
        || events.find((row) => {
            const n = String(row?.name != null ? row.name : '').trim().toLowerCase();
            return n && n === filterKey.toLowerCase();
        })
        || null;

    const snapshot = buildCodexDefaultConnectionCanvasSnapshot(
        entry,
        category,
        displayName,
        filterKey,
        codexGraph,
    );
    if (!snapshot) {
        return { ok: false, error: 'Could not build a Codex default layout for this entry.' };
    }

    const result = await saveBioArchiveConnectionCanvasFromGallery(
        category,
        filterKey,
        displayName,
        { connectionCanvas: snapshot },
    );
    if (!result.ok) return { ok: false, error: result.error || 'Save failed.' };
    return { ok: true, entry: result.entry, snapshot };
}

/**
 * Rebuild every gallery canvas that has links (or an existing personal layout)
 * from the live Codex ego graph.
 *
 * @returns {Promise<{ ok: boolean, updated: number, skipped: number, error?: string }>}
 */
export async function resetAllGalleryConnectionCanvasesToCodex() {
    let payload;
    try {
        payload = await ensureCodexConnectionPayload(true);
    } catch (err) {
        return {
            ok: false,
            updated: 0,
            skipped: 0,
            error: `Could not load Codex graph: ${err instanceof Error ? err.message : err}`,
        };
    }
    const codexGraph = codexGraphFromPayload(payload);
    if (!codexGraph) {
        return {
            ok: false,
            updated: 0,
            skipped: 0,
            error: 'Codex has no connection graph to use as default.',
        };
    }

    let updated = 0;
    let skipped = 0;

    for (const category of RESET_ARCHIVES) {
        clearBioArchiveEventsCache(category);
        const events = await loadBioArchiveEvents(category);
        for (let i = 0; i < events.length; i += 1) {
            const entry = events[i];
            const name = filterKeyFromArchiveEntry(entry);
            if (!name) {
                skipped += 1;
                continue;
            }
            const hasLinks = listDisplayableConnectionEntities(entry).length > 0;
            const hasCanvas =
                entry?.connectionCanvas
                && typeof entry.connectionCanvas === 'object'
                && Array.isArray(entry.connectionCanvas.nodes)
                && entry.connectionCanvas.nodes.length > 0;
            if (!hasLinks && !hasCanvas) {
                skipped += 1;
                continue;
            }

            const snapshot = buildCodexDefaultConnectionCanvasSnapshot(
                entry,
                category,
                name,
                name,
                codexGraph,
            );
            if (!snapshot) {
                skipped += 1;
                continue;
            }

            const result = await saveBioArchiveConnectionCanvasFromGallery(
                category,
                name,
                name,
                { connectionCanvas: snapshot },
            );
            if (result.ok) updated += 1;
            else skipped += 1;
        }
    }

    return { ok: true, updated, skipped };
}
