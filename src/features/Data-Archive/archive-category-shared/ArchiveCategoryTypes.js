/**
 * Data Archive category types and metadata.
 * Defines the 5 main categories and their properties.
 */

/**
 * @typedef {'story'|'heroes'|'factions'|'npcs'|'locations'} StoryArchiveSource
 */

/** @type {StoryArchiveSource[]} */
export const ARCHIVE_CATEGORIES = ['story', 'heroes', 'factions', 'npcs', 'locations'];

/** @type {Record<StoryArchiveSource, {label: string, icon: string, description: string}>} */
export const CATEGORY_METADATA = {
    story: {
        label: 'Story',
        icon: 'src/assets/images/Archive/Categories/Story.png',
        description: 'Timeline events and story entries',
        isFeature: true
    },
    heroes: {
        label: 'Heroes',
        icon: 'src/assets/images/Archive/Categories/Heroes.png',
        description: 'Hero characters and their information',
        isFeature: false
    },
    factions: {
        label: 'Factions',
        icon: 'src/assets/images/Archive/Categories/Factions.png',
        description: 'Organizations and groups',
        isFeature: false
    },
    npcs: {
        label: 'NPCs',
        icon: 'src/assets/images/Archive/Categories/NPCs.png',
        description: 'Non-player characters',
        isFeature: false
    },
    locations: {
        label: 'Locations',
        icon: 'src/assets/images/Archive/Categories/Locations.png',
        description: 'Places and geographic locations',
        isFeature: false
    }
};

/** @type {Record<StoryArchiveSource, {label: string, icon: string}>} */
export const STRIP_CATEGORIES = {
    story: { label: 'Story', icon: 'src/assets/images/Icons/Mode%20Icons/Story%20Icon.png' },
    heroes: { label: 'Heroes', icon: 'src/assets/images/Icons/Filter%20Icons/Heroes%20Icon.png' },
    factions: { label: 'Factions', icon: 'src/assets/images/Icons/Filter%20Icons/Factions%20Icon.png' },
    npcs: { label: 'NPCs', icon: 'src/assets/images/Icons/Filter%20Icons/NPC%20Icon.png' },
    locations: { label: 'Locations', icon: 'src/assets/images/Icons/Filter%20Icons/Location%20Icon.png' }
};

/**
 * Validate if a string is a valid archive category.
 * @param {string} category
 * @returns {category is StoryArchiveSource}
 */
export function isValidArchiveCategory(category) {
    return ARCHIVE_CATEGORIES.includes(category);
}

/**
 * Get metadata for a specific category.
 * @param {StoryArchiveSource} category
 * @returns {typeof CATEGORY_METADATA[StoryArchiveSource]}
 */
export function getCategoryMetadata(category) {
    return CATEGORY_METADATA[category] || null;
}
