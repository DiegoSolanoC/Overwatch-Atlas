/**
 * Data Archive category types and metadata.
 * Story timeline lives in Story Timeline mode; Data Archive hub uses bio archives only.
 */

/**
 * @typedef {'story'|'heroes'|'factions'|'npcs'|'locations'} StoryArchiveSource
 */

/** All archive buckets the Event Manager can load (including story timeline). */
export const ARCHIVE_CATEGORIES = ['story', 'heroes', 'factions', 'npcs', 'locations'];

/** Data Archive category hub tiles (no story — use Story Timeline mode). */
export const BIO_ARCHIVE_CATEGORIES = ['heroes', 'factions', 'npcs', 'locations'];

/** @type {Record<StoryArchiveSource, {label: string, icon: string, description: string, isFeature?: boolean}>} */
export const CATEGORY_METADATA = {
    story: {
        label: 'Story',
        icon: 'src/assets/images/Archive/Categories/Story.png',
        description: 'Timeline events and story entries',
        isFeature: true,
    },
    heroes: {
        label: 'Heroes',
        icon: 'src/assets/images/Archive/Categories/Heroes.png',
        description: 'Hero characters and their information',
        isFeature: false,
    },
    factions: {
        label: 'Factions',
        icon: 'src/assets/images/Archive/Categories/Factions.png',
        description: 'Organizations and groups',
        isFeature: false,
    },
    npcs: {
        label: 'NPCs',
        icon: 'src/assets/images/Archive/Categories/NPCs.png',
        description: 'Non-player characters',
        isFeature: false,
    },
    locations: {
        label: 'Locations',
        icon: 'src/assets/images/Archive/Categories/Locations.png',
        description: 'Places and geographic locations',
        isFeature: false,
    },
};

/** Toolbar strip icons (compact UI icons — not the large hub category art). */
export const STRIP_CATEGORY_ICONS = Object.freeze({
    heroes: 'src/assets/images/Icons/Filter Icons/Heroes Icon.png',
    factions: 'src/assets/images/Icons/Filter Icons/Factions Icon.png',
    npcs: 'src/assets/images/Icons/Filter Icons/NPC Icon.png',
    locations: 'src/assets/images/Icons/Filter Icons/Location Icon.png',
});

/** Category strip in embedded Data Archive (bio archives only). */
export const STRIP_CATEGORIES = Object.freeze(
    Object.fromEntries(
        BIO_ARCHIVE_CATEGORIES.map((key) => [
            key,
            {
                label: CATEGORY_METADATA[key].label,
                icon: STRIP_CATEGORY_ICONS[key],
            },
        ]),
    ),
);

/**
 * @param {string} category
 * @returns {category is StoryArchiveSource}
 */
export function isValidArchiveCategory(category) {
    return ARCHIVE_CATEGORIES.includes(category);
}

/**
 * @param {string} category
 * @returns {boolean}
 */
export function isBioArchiveCategory(category) {
    return BIO_ARCHIVE_CATEGORIES.includes(category);
}

/**
 * @param {StoryArchiveSource} category
 * @returns {typeof CATEGORY_METADATA[StoryArchiveSource]}
 */
export function getCategoryMetadata(category) {
    return CATEGORY_METADATA[category] || null;
}
