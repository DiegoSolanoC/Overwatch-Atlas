import {
    connectionRowHasNarrativeText,
    normalizeBioArchiveConnectionRow,
} from '../../../interface-shared/bio-archive/bioArchiveConnectionRanges.js';
import { resolveNpcCategoryFromArchiveRow } from '../../../../data-workshop/archive-category-npcs/ArchiveNpcOrdering.js';

/**
 * Normalization helpers for bio archives (Heroes / Factions / NPCs):
 *   - `relevantLocations`: array of `{ locationName, country, reasoning }`.
 *     Migrates legacy `string[]` (one "Place, Country" per line) and mixed object shapes.
 *   - `connections`: linked entity + optional `ranges[]` (`startEvent`, `endEvent?`, directional reasoning).
 *     Legacy single `reasoning` field is duplicated to both directions when the directional fields are absent.
 *   - `normalizeSatelliteArchiveEntry`: slim `{ name, description, ... }` shape used by every satellite entry.
 *     Heroes get `heroRole`/`heroSubRole`, factions get `factionType`.
 *
 * Output is filtered to drop fully-empty entries so the UI doesn't have to.
 */

/** Strip trailing ", ," so "Cairo, Egypt," parses to Egypt (matches LocationFlagHelpers). */
function stripTrailingCommaSep(s) {
    return String(s == null ? '' : s)
        .replace(/\u00a0/g, ' ')
        .replace(/,+\s*$/g, '')
        .trim();
}

/** If name already ends with ", Country" matching `country`, keep only the place part (avoids "Cairo, Egypt" + Egypt). */
function dedupeHeroLocationNameCountry(locationName, country) {
    const ln = stripTrailingCommaSep(locationName);
    const c = stripTrailingCommaSep(country);
    if (!ln || !c) return ln;
    const idx = ln.lastIndexOf(',');
    if (idx < 0) return ln;
    const lastSeg = stripTrailingCommaSep(ln.slice(idx + 1));
    if (lastSeg.toLowerCase() === c.toLowerCase()) {
        return stripTrailingCommaSep(ln.slice(0, idx));
    }
    return ln;
}

/**
 * One hero relevant-location entry: display name, country token for flag, optional note.
 * @param {unknown} item
 * @returns {{ locationName: string, country: string, reasoning: string }}
 */
function normalizeHeroRelevantLocationItem(item) {
    if (typeof item === 'string') {
        const s = stripTrailingCommaSep(item);
        if (!s) return { locationName: '', country: '', reasoning: '' };
        const idx = s.lastIndexOf(',');
        if (idx >= 0) {
            const locationName = stripTrailingCommaSep(s.slice(0, idx));
            const country = stripTrailingCommaSep(s.slice(idx + 1));
            return {
                locationName: dedupeHeroLocationNameCountry(locationName, country),
                country,
                reasoning: ''
            };
        }
        return { locationName: s, country: '', reasoning: '' };
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
        let locationName = stripTrailingCommaSep(
            item.locationName != null ? String(item.locationName) : item.name != null ? String(item.name) : ''
        );
        let country = stripTrailingCommaSep(
            item.country != null ? String(item.country) : ''
        );
        const reasoning = String(item.reasoning != null ? item.reasoning : '').trim();
        if (!country && locationName) {
            const ix = locationName.lastIndexOf(',');
            if (ix >= 0) {
                const tail = stripTrailingCommaSep(locationName.slice(ix + 1));
                if (tail) {
                    country = tail;
                    locationName = stripTrailingCommaSep(locationName.slice(0, ix));
                }
            }
        }
        locationName = dedupeHeroLocationNameCountry(locationName, country);
        return { locationName, country, reasoning };
    }
    return { locationName: '', country: '', reasoning: '' };
}

/**
 * Hero/faction/npc archive `relevantLocations`: array of { locationName, country, reasoning }.
 * Accepts string[] (legacy, newline-separated per item) or array-of-mixed-shapes.
 * @param {unknown} raw
 */
export function normalizeHeroRelevantLocations(raw) {
    if (raw == null) return [];
    if (typeof raw === 'string') {
        return raw
            .split(/\r?\n/)
            .map((line) => normalizeHeroRelevantLocationItem(line))
            .filter((e) => e.locationName || e.country || e.reasoning);
    }
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => normalizeHeroRelevantLocationItem(item))
        .filter((e) => e.locationName || e.country || e.reasoning);
}

/** Strip trailing punctuation often pasted from list/autocomplete (e.g. "Pharah,"). */
function sanitizeBioConnectionEntityName(s) {
    let t = s != null ? String(s).trim() : '';
    while (t.length > 0 && /[,;]\s*$/.test(t)) {
        t = t.replace(/[,;]\s*$/, '').trim();
    }
    return t;
}

/**
 * Bio archive `connections`: linked hero/faction/npc + relationship text each direction.
 * Optional `ranges[]` — story-event spans with per-period reasoning (see bioArchiveConnectionRanges.js).
 * @param {unknown} raw
 */
export function normalizeBioArchiveConnections(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) =>
            normalizeBioArchiveConnectionRow(item, sanitizeBioConnectionEntityName),
        )
        .filter(
            (c) =>
                c
                && (c.name
                    || connectionRowHasNarrativeText(c)
                    || (Array.isArray(c.ranges) && c.ranges.length > 0)),
        );
}

/**
 * Non-story archives (Heroes / Factions / NPCs / Locations): title + description.
 * Heroes/Factions/NPCs additionally carry `relevantLocations` + `connections`.
 * Heroes get `heroRole` / `heroSubRole`; factions get `factionType`; NPCs get `npcCategory`.
 * Collapses legacy full-event shapes (with `variants`) down to the slim shape.
 * @param {unknown} raw
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} archiveSource
 */
export function normalizeSatelliteArchiveEntry(raw, archiveSource) {
    if (!raw || typeof raw !== 'object') {
        return { name: '', description: '' };
    }
    let name = '';
    let description = '';
    const variants = raw.variants;
    if (Array.isArray(variants) && variants.length > 0) {
        const v0 = variants[0];
        name = v0 && v0.name != null ? String(v0.name) : '';
        description = v0 && v0.description != null ? String(v0.description) : '';
    } else {
        name = raw.name != null ? String(raw.name) : '';
        description = raw.description != null ? String(raw.description) : '';
    }
    const base = { name, description };
    const bioArchives = new Set(['heroes', 'factions', 'npcs']);
    if (bioArchives.has(archiveSource)) {
        base.relevantLocations = normalizeHeroRelevantLocations(raw.relevantLocations);
        base.connections = normalizeBioArchiveConnections(raw.connections);
    }
    if (archiveSource === 'factions') {
        let factionType = '';
        if (Array.isArray(variants) && variants.length > 0) {
            const v0 = variants[0];
            factionType = v0?.factionType != null ? String(v0.factionType) : '';
        } else {
            factionType = raw.factionType != null ? String(raw.factionType) : '';
        }
        base.factionType = factionType;
    }
    if (archiveSource === 'heroes') {
        let heroRole = '';
        let heroSubRole = '';
        let birthday = '';
        if (Array.isArray(variants) && variants.length > 0) {
            const v0 = variants[0];
            heroRole = v0?.heroRole != null ? String(v0.heroRole) : '';
            heroSubRole = v0?.heroSubRole != null ? String(v0.heroSubRole) : '';
            birthday = v0?.birthday != null ? String(v0.birthday) : '';
        } else {
            heroRole = raw.heroRole != null ? String(raw.heroRole) : '';
            heroSubRole = raw.heroSubRole != null ? String(raw.heroSubRole) : '';
            birthday = raw.birthday != null ? String(raw.birthday) : '';
        }
        base.heroRole = heroRole;
        base.heroSubRole = heroSubRole;
        base.birthday = birthday;
    }
    if (archiveSource === 'npcs') {
        base.npcCategory = resolveNpcCategoryFromArchiveRow(raw);
    }
    return base;
}
