/**
 * Group-section dividers injected between event cards when the Event Manager is showing a
 * grouped archive (factions by `factionType`, or heroes by `heroRole` + `heroSubRole`).
 *
 * Each separator carries the corresponding `data-drop*` attribute so the drag/drop layer
 * (`drag-drop/wireArchiveSeparatorDrop.js`) can use the divider itself as a drop target — dropping
 * onto a "Tanks" header re-assigns the dropped hero into the Tanks bucket without needing a
 * sibling item to anchor onto.
 */

/**
 * Faction archive type divider.
 * @param {string} displayLabel    User-visible label (e.g. "Government").
 * @param {string} typeKey         Normalized faction type; `''` = "None" bucket.
 */
export function createFactionArchiveTypeSeparator(displayLabel, typeKey) {
    const el = document.createElement('div');
    el.className = 'event-archive-type-separator';
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-label', displayLabel);
    el.textContent = displayLabel;
    el.dataset.dropFactionType = typeKey;
    el.draggable = false;
    return el;
}

/**
 * Hero archive role divider (top level).
 * @param {string} displayLabel    User-visible label (e.g. "Damage").
 * @param {string} roleKey         Normalized role; `''` = "None" bucket.
 */
export function createHeroArchiveRoleSeparator(displayLabel, roleKey) {
    const el = document.createElement('div');
    el.className = 'event-archive-type-separator';
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-label', displayLabel);
    el.textContent = displayLabel;
    el.dataset.dropHeroRole = roleKey;
    el.draggable = false;
    return el;
}

/**
 * Hero archive subrole divider (nested under a role separator).
 * @param {string} displayLabel User-visible label (e.g. "Hitscan").
 * @param {string} roleKey      Normalized role (the parent bucket).
 * @param {string} subKey       Normalized subrole; `''` = "None" subbucket.
 */
export function createHeroArchiveSubroleSeparator(displayLabel, roleKey, subKey) {
    const el = document.createElement('div');
    el.className = 'event-archive-type-separator event-archive-hero-subrole-separator';
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-label', displayLabel);
    el.textContent = displayLabel;
    el.dataset.dropHeroRole = roleKey;
    el.dataset.dropHeroSubRole = subKey;
    el.draggable = false;
    return el;
}
