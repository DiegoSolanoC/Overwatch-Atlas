/**
 * Canonical paths for JSON under src/data (Node: server, scripts).
 * Browser code imports registry.js (same constants).
 */
const path = require('path');

const DATA_ROOT = __dirname;
const PUBLIC_PREFIX = 'src/data';

function publicPath(...segments) {
    return `${PUBLIC_PREFIX}/${segments.join('/')}`;
}

function absFromPublic(publicPathStr) {
    const rel = publicPathStr.replace(/^src\/data\/?/, '');
    return path.join(DATA_ROOT, rel);
}

const FILES = {
    eventSystem: {
        /** Main story timeline (Event Manager "story" archive source). */
        timelineEvents: publicPath('event-system', 'timeline-events.json'),
    },
    storyArchive: {
        heroes: publicPath('story-archive', 'heroes.json'),
        factions: publicPath('story-archive', 'factions.json'),
        npcs: publicPath('story-archive', 'npcs.json'),
        locations: publicPath('story-archive', 'locations.json'),
    },
    connectionCodex: {
        codexLabels: publicPath('connection-codex', 'codex-labels.json'),
        connections: publicPath('connection-codex', 'connections.json'),
    },
    worldview: {
        locations: publicPath('worldview', 'locations.json'),
        locationDisplayNames: publicPath('worldview', 'location-display-names.json'),
        earthLightsHubs: publicPath('worldview', 'earth-lights-hubs.json'),
    },
    platform: {
        manifest: publicPath('platform', 'manifest.json'),
    },
};

/** Event Manager archive bucket → fetch URL (story = timeline). */
const ARCHIVE_FILE_PATHS = {
    story: FILES.eventSystem.timelineEvents,
    heroes: FILES.storyArchive.heroes,
    factions: FILES.storyArchive.factions,
    npcs: FILES.storyArchive.npcs,
    locations: FILES.storyArchive.locations,
};

/** Dev server POST /api/story-archive body.archive → filename under src/data/story-archive/ */
const STORY_ARCHIVE_WRITE_FILES = {
    heroes: 'heroes.json',
    factions: 'factions.json',
    npcs: 'npcs.json',
    locations: 'locations.json',
};

/** Bio codex sync: archive key → filename under story-archive/ */
const STORY_ARCHIVE_BIO_SYNC_FILES = {
    heroes: 'heroes.json',
    factions: 'factions.json',
    npcs: 'npcs.json',
};

module.exports = {
    DATA_ROOT,
    PUBLIC_PREFIX,
    FILES,
    ARCHIVE_FILE_PATHS,
    STORY_ARCHIVE_WRITE_FILES,
    STORY_ARCHIVE_BIO_SYNC_FILES,
    publicPath,
    absFromPublic,
};
