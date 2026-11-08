/**
 * Gallery-owned filter categorization options (heroes / factions / NPCs).
 * Defaults from Workshop helpers + custom labels persisted in localStorage,
 * merged with values already used on archive rows.
 */

const CUSTOM_TAXONOMY_KEY = 'atlasGalleryFilterTaxonomy.v1';

/**
 * @typedef {{
 *   heroRoles?: string[],
 *   heroSubrolesByRole?: Record<string, string[]>,
 *   factionTypes?: string[],
 *   npcCategories?: string[],
 * }} GalleryFilterTaxonomy
 */

/** @returns {GalleryFilterTaxonomy} */
function readCustomTaxonomy() {
    try {
        const raw = localStorage.getItem(CUSTOM_TAXONOMY_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/** @param {GalleryFilterTaxonomy} next */
function writeCustomTaxonomy(next) {
    try {
        localStorage.setItem(CUSTOM_TAXONOMY_KEY, JSON.stringify(next || {}));
    } catch (err) {
        console.warn('[gallery] Could not persist filter taxonomy:', err);
    }
}

/**
 * @param {string[]} base
 * @param {string[]} extra
 * @returns {string[]}
 */
function mergeUniqueLabels(base, extra) {
    const out = [];
    const seen = new Set();
    for (const list of [base, extra]) {
        for (const raw of list || []) {
            const n = String(raw || '').trim();
            if (!n) continue;
            const key = n.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(n);
        }
    }
    return out;
}

function heroHelpers() {
    return typeof window !== 'undefined' ? window.HeroArchiveRoleOrderHelpers || null : null;
}

function factionHelpers() {
    return typeof window !== 'undefined' ? window.FactionArchiveGroupOrderHelpers || null : null;
}

function npcHelpers() {
    return typeof window !== 'undefined' ? window.NpcArchiveGroupOrderHelpers || null : null;
}

/**
 * @param {object[]} [archiveEvents]
 * @returns {string[]}
 */
export function listHeroRoleOptions(archiveEvents = []) {
    const H = heroHelpers();
    const defaults = Array.isArray(H?.HERO_ARCHIVE_ROLE_ORDER)
        ? [...H.HERO_ARCHIVE_ROLE_ORDER]
        : ['Tank', 'Damage', 'Support'];
    const custom = readCustomTaxonomy().heroRoles || [];
    const fromArchive = (archiveEvents || [])
        .map((e) => String(e?.heroRole ?? '').trim())
        .filter(Boolean);
    return mergeUniqueLabels(defaults, [...custom, ...fromArchive]);
}

/**
 * @param {string} role
 * @param {object[]} [archiveEvents]
 * @returns {string[]}
 */
export function listHeroSubroleOptions(role, archiveEvents = []) {
    const H = heroHelpers();
    const roleNorm =
        H && typeof H.normalizeHeroArchiveRole === 'function'
            ? H.normalizeHeroArchiveRole(role)
            : String(role || '').trim();
    const defaults =
        (roleNorm && H?.HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE?.[roleNorm])
            ? [...H.HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE[roleNorm]]
            : [];
    const customMap = readCustomTaxonomy().heroSubrolesByRole || {};
    const custom = customMap[roleNorm] || customMap[String(role || '').trim()] || [];
    const fromArchive = (archiveEvents || [])
        .filter((e) => {
            const er =
                H && typeof H.normalizeHeroArchiveRole === 'function'
                    ? H.normalizeHeroArchiveRole(e?.heroRole)
                    : String(e?.heroRole ?? '').trim();
            return er === roleNorm;
        })
        .map((e) => String(e?.heroSubRole ?? '').trim())
        .filter(Boolean);
    return mergeUniqueLabels(defaults, [...custom, ...fromArchive]);
}

/**
 * @param {object[]} [archiveEvents]
 * @returns {string[]}
 */
export function listFactionTypeOptions(archiveEvents = []) {
    const F = factionHelpers();
    const defaults = Array.isArray(F?.FACTION_ARCHIVE_TYPE_ORDER)
        ? [...F.FACTION_ARCHIVE_TYPE_ORDER]
        : [
            'Major Player',
            'Criminal Groups',
            'Military Initiatives',
            'Research Institutions',
            'Independent Coalitions',
        ];
    const custom = readCustomTaxonomy().factionTypes || [];
    const fromArchive = (archiveEvents || [])
        .map((e) => String(e?.factionType ?? '').trim())
        .filter(Boolean);
    return mergeUniqueLabels(defaults, [...custom, ...fromArchive]);
}

/**
 * @param {object[]} [archiveEvents]
 * @returns {string[]}
 */
export function listNpcCategoryOptions(archiveEvents = []) {
    const N = npcHelpers();
    const defaults = Array.isArray(N?.NPC_ARCHIVE_CATEGORY_ORDER)
        ? [...N.NPC_ARCHIVE_CATEGORY_ORDER]
        : ['Other'];
    const custom = readCustomTaxonomy().npcCategories || [];
    const fromArchive = (archiveEvents || [])
        .map((e) => String(e?.npcCategory ?? '').trim())
        .filter(Boolean);
    return mergeUniqueLabels(defaults, [...custom, ...fromArchive]);
}

/**
 * Persist a brand-new category label for Gallery + Filters dropdowns.
 *
 * @param {'heroRole'|'heroSubrole'|'factionType'|'npcCategory'} kind
 * @param {string} label
 * @param {{ role?: string }} [ctx] — required for heroSubrole
 * @returns {string} normalized label (or '')
 */
export function addCustomGalleryCategory(kind, label, ctx = {}) {
    const trimmed = String(label || '').trim().replace(/\s+/g, ' ');
    if (!trimmed) return '';

    const custom = readCustomTaxonomy();

    if (kind === 'heroRole') {
        custom.heroRoles = mergeUniqueLabels(custom.heroRoles || [], [trimmed]);
        writeCustomTaxonomy(custom);
        return trimmed;
    }

    if (kind === 'heroSubrole') {
        const role = String(ctx.role || '').trim();
        if (!role) return '';
        const map = { ...(custom.heroSubrolesByRole || {}) };
        map[role] = mergeUniqueLabels(map[role] || [], [trimmed]);
        custom.heroSubrolesByRole = map;
        writeCustomTaxonomy(custom);
        return trimmed;
    }

    if (kind === 'factionType') {
        custom.factionTypes = mergeUniqueLabels(custom.factionTypes || [], [trimmed]);
        writeCustomTaxonomy(custom);
        return trimmed;
    }

    if (kind === 'npcCategory') {
        custom.npcCategories = mergeUniqueLabels(custom.npcCategories || [], [trimmed]);
        writeCustomTaxonomy(custom);
        return trimmed;
    }

    return '';
}
