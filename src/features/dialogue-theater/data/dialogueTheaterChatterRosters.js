/**
 * Curated chatter partner pools for wiki conditions that omit full lists.
 * Prefer wiki named heroes / footnotes when present; these fill category gaps.
 */

/** Modern + classic Overwatch (group) strike-team style pool (wiki list seeds). */
export const ROSTER_OVERWATCH_GROUP = Object.freeze([
    'Ana',
    'Cassidy',
    'Echo',
    'Genji',
    'Mei',
    'Mercy',
    'Reinhardt',
    'Soldier 76',
    'Sojourn',
    'Torbjörn',
    'Tracer',
    'Winston',
]);

/** Former / veteran Overwatch agents (classic core). */
export const ROSTER_FORMER_OVERWATCH = Object.freeze([
    'Ana',
    'Cassidy',
    'Genji',
    'Mei',
    'Mercy',
    'Reinhardt',
    'Soldier 76',
    'Torbjörn',
    'Tracer',
    'Winston',
]);

/** Talon-aligned heroes (wiki set-up lists + Vendetta when noted). */
export const ROSTER_TALON = Object.freeze([
    'Doomfist',
    'Mauga',
    'Moira',
    'Reaper',
    'Sigma',
    'Sombra',
    'Vendetta',
    'Widowmaker',
]);

/** “Old / veteran” heroes (wiki old-heroes lists). */
export const ROSTER_OLD = Object.freeze([
    'Ana',
    'Reaper',
    'Reinhardt',
    'Sigma',
    'Soldier 76',
    'Torbjörn',
]);

/** Younger / new-generation pool for “only young heroes”. */
export const ROSTER_YOUNG = Object.freeze([
    'Anran',
    'Brigitte',
    'D.va',
    'Freja',
    'Hazard',
    'Illari',
    'Junkrat',
    'Juno',
    'Kiriko',
    'Lúcio',
    'Mizuki',
    'Shion',
    'Sierra',
    'Venture',
    'Wuyang',
]);

/**
 * She/her heroes used for “female teammates” conditions.
 * Venture is nonbinary and excluded. Lifeweaver is male but may substitute per wiki.
 */
export const ROSTER_FEMALE = Object.freeze([
    'Ana',
    'Anran',
    'Ashe',
    'Brigitte',
    'D.va',
    'Domina',
    'Echo',
    'Freja',
    'Illari',
    'Junker Queen',
    'Juno',
    'Kiriko',
    'Mei',
    'Mercy',
    'Mizuki',
    'Moira',
    'Orisa',
    'Pharah',
    'Sierra',
    'Sojourn',
    'Sombra',
    'Symmetra',
    'Tracer',
    'Vendetta',
    'Widowmaker',
    'Zarya',
]);

export const ROSTER_GENDER_SUBSTITUTE_FEMALE = Object.freeze(['Lifeweaver']);

export const ROSTER_NONBINARY = Object.freeze(['Venture']);

/**
 * @param {string[]} roster
 * @param {string} [excludeHero]
 * @returns {string[]}
 */
export function rosterExcludingSpeaker(roster, excludeHero = '') {
    const skip = String(excludeHero || '')
        .trim()
        .toLowerCase();
    if (!skip) return [...roster];
    return roster.filter((h) => h.toLowerCase() !== skip);
}
