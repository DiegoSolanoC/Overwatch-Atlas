/**
 * Heroes archive: canonical Role order definitions and normalization.
 * Extracted from the massive HeroArchiveRoleOrder.js file.
 */

/** Canonical hero role order */
export const HERO_ARCHIVE_ROLE_ORDER = ['Tank', 'Damage', 'Support'];

/** Role aliases for normalization */
export const HERO_ARCHIVE_ROLE_ALIASES = {
    tank: 'Tank',
    damage: 'Damage',
    dps: 'Damage',
    support: 'Support'
};

/**
 * Normalize hero role to canonical form.
 * @param {string} role
 * @returns {string}
 */
export function normalizeHeroArchiveRole(role) {
    if (role == null) return '';
    const collapsed = String(role).trim().replace(/\s+/g, ' ');
    if (!collapsed) return '';
    const l = collapsed.toLowerCase();
    if (HERO_ARCHIVE_ROLE_ALIASES[l]) return HERO_ARCHIVE_ROLE_ALIASES[l];
    for (let i = 0; i < HERO_ARCHIVE_ROLE_ORDER.length; i++) {
        const canon = HERO_ARCHIVE_ROLE_ORDER[i];
        if (l === canon.toLowerCase()) return canon;
    }
    return collapsed;
}

/**
 * Get display label for hero role.
 * @param {string} role
 * @returns {string}
 */
export function displayLabelForHeroArchiveRole(role) {
    const normalized = normalizeHeroArchiveRole(role);
    return normalized || 'None';
}

/**
 * Get rank index for hero role.
 * @param {string} role
 * @returns {number}
 */
export function heroArchiveRoleRank(role) {
    const normalized = normalizeHeroArchiveRole(role);
    const index = HERO_ARCHIVE_ROLE_ORDER.indexOf(normalized);
    return index === -1 ? HERO_ARCHIVE_ROLE_ORDER.length + 1 : index;
}
