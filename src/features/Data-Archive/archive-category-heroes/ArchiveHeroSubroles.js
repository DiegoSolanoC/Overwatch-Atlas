/**
 * Heroes archive: canonical Subrole order definitions and normalization.
 * Extracted from the massive HeroArchiveRoleOrder.js file.
 */

/** Subrole order by role */
export const HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE = {
    Tank: ['Initiator', 'Bruiser', 'Stalwart'],
    Damage: ['Specialist', 'Sharpshooter', 'Flanker', 'Recon'],
    Support: ['Tactician', 'Medic', 'Survivor']
};

/** Subrole aliases for normalization */
export const HERO_ARCHIVE_SUBROLE_ALIASES = {
    initiator: 'Initiator',
    bruiser: 'Bruiser',
    stalwart: 'Stalwart',
    specialist: 'Specialist',
    sharpshooter: 'Sharpshooter',
    flanker: 'Flanker',
    recon: 'Recon',
    tactician: 'Tactician',
    medic: 'Medic',
    survivor: 'Survivor'
};

/**
 * Normalize hero subrole to canonical form.
 * @param {string} subrole
 * @returns {string}
 */
export function normalizeHeroArchiveSubrole(subrole) {
    if (subrole == null) return '';
    const collapsed = String(subrole).trim().replace(/\s+/g, ' ');
    if (!collapsed) return '';
    const l = collapsed.toLowerCase();
    if (HERO_ARCHIVE_SUBROLE_ALIASES[l]) return HERO_ARCHIVE_SUBROLE_ALIASES[l];
    
    // Check against known subroles in all roles
    for (const roleSubroles of Object.values(HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE)) {
        for (const canon of roleSubroles) {
            if (l === canon.toLowerCase()) return canon;
        }
    }
    
    return collapsed;
}

/**
 * Get display label for hero subrole.
 * @param {string} subrole
 * @returns {string}
 */
export function displayLabelForHeroArchiveSubrole(subrole) {
    const normalized = normalizeHeroArchiveSubrole(subrole);
    return normalized || 'None';
}

/**
 * Get rank index for hero subrole within its role.
 * @param {string} subrole
 * @param {string} role - Role context for subrole ordering
 * @returns {number}
 */
export function heroArchiveSubroleRank(subrole, role) {
    const normalized = normalizeHeroArchiveSubrole(subrole);
    const roleSubroles = HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE[role] || [];
    const index = roleSubroles.indexOf(normalized);
    return index === -1 ? roleSubroles.length + 1 : index;
}
