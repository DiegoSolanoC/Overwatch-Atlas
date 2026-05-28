/**
 * Resolve hero / faction / NPC portrait keys for gallery connection canvas (matches slide + codex).
 */

import { matchHeroManifestToArchiveRowName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { factionNodeMatchesToken } from '../../codex/codex-edge-cords/topology/CodexBioEntityMatching.js';

/**
 * @param {string} token
 */
function normalizeKey(token) {
    return String(token || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * @param {string} token
 */
export function resolveGalleryHeroPortraitKey(token) {
    const t = String(token || '').trim();
    if (!t) return '';
    const heroes = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
    for (let i = 0; i < heroes.length; i += 1) {
        const h = String(heroes[i] || '').trim();
        if (!h) continue;
        if (matchHeroManifestToArchiveRowName(h, [t]) === t) return h;
        if (normalizeKey(h) === normalizeKey(t)) return h;
    }
    return t;
}

/**
 * @param {string} token
 */
export function resolveGalleryNpcPortraitKey(token) {
    const t = String(token || '').trim();
    if (!t) return '';
    const list = window.eventManager?.npcs || [];
    const nk = normalizeKey(t);
    for (let i = 0; i < list.length; i += 1) {
        if (normalizeKey(list[i]) === nk) return String(list[i]);
    }
    return t;
}

/**
 * @param {string} rawFaction
 * @returns {string|null}
 */
export function resolveGalleryFactionFilename(rawFaction) {
    const raw = String(rawFaction || '').trim();
    if (!raw) return null;
    const factions =
        window.eventManager?.factions?.length > 0
            ? window.eventManager.factions
            : window.globeController?.dataModel?.factions || [];
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    for (let i = 0; i < factions.length; i += 1) {
        const f = factions[i];
        const fn = f && f.filename ? String(f.filename).trim() : '';
        const dn = f && f.displayName ? String(f.displayName).trim() : '';
        if (!fn) continue;
        if (fn === raw || dn === raw) return fn;
        if (fh && typeof fh.factionIdsMatch === 'function') {
            if (fh.factionIdsMatch(fn, raw) || fh.factionIdsMatch(dn, raw)) return fn;
        }
    }
    const bare = raw.replace(/^\d+/, '').trim();
    for (let j = 0; j < factions.length; j += 1) {
        const f2 = factions[j];
        const fn2 = f2 && f2.filename ? String(f2.filename).trim() : '';
        if (!fn2) continue;
        if (normalizeKey(fn2.replace(/^\d+/, '').trim()) === normalizeKey(bare)) return fn2;
    }
    return null;
}

/**
 * @param {'hero'|'faction'|'npc'} kind
 * @param {string} nameToken
 * @param {object[]} codexNodes
 */
export function findCodexNodeForGalleryEntity(kind, nameToken, codexNodes) {
    const token = String(nameToken || '').trim();
    if (!token || !Array.isArray(codexNodes)) return null;
    const k = String(kind || 'hero').toLowerCase();

    for (let i = 0; i < codexNodes.length; i += 1) {
        const n = codexNodes[i];
        if (!n || n.kind === 'junction') continue;
        if (k === 'hero' && n.kind === 'hero') {
            const hn = String(n.heroName || '').trim();
            if (hn && matchHeroManifestToArchiveRowName(hn, [token]) === token) return n;
            if (normalizeKey(hn) === normalizeKey(token)) return n;
        }
        if (k === 'npc' && n.kind === 'npc') {
            if (normalizeKey(n.npcName) === normalizeKey(token)) return n;
        }
        if (k === 'faction' && n.kind === 'faction' && factionNodeMatchesToken(n, token)) {
            return n;
        }
    }
    return null;
}

/**
 * @param {object} node
 * @param {object[]} codexNodes
 */
export function enrichGalleryCanvasNodeEntity(node, codexNodes) {
    if (!node || node.kind === 'junction') return;
    const kind = node.entityKind || node.kind;
    const name = node.entityName || '';
    const codex = findCodexNodeForGalleryEntity(kind, name, codexNodes);

    if (codex?.bgColor && node.bgColor == null) node.bgColor = codex.bgColor;
    if (node.scale == null && codex?.scale != null) node.scale = codex.scale;

    if (kind === 'hero') {
        node.portraitKey =
            (codex?.heroName && String(codex.heroName).trim())
            || resolveGalleryHeroPortraitKey(name);
    } else if (kind === 'npc') {
        node.portraitKey =
            (codex?.npcName && String(codex.npcName).trim())
            || resolveGalleryNpcPortraitKey(name);
    } else if (kind === 'faction') {
        const ff =
            (codex?.factionFilename && String(codex.factionFilename).trim())
            || resolveGalleryFactionFilename(name);
        if (ff) node.factionFilename = ff;
        node.factionDisplay =
            (codex?.factionDisplay && String(codex.factionDisplay).trim())
            || name;
    }
}
