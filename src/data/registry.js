/**
 * Canonical fetch paths for JSON under src/data (browser / ESM).
 * Node scripts and server use registry.cjs (same layout).
 */

function publicPath(...segments) {
    return `src/data/${segments.join('/')}`;
}

export const FILES = {
    eventSystem: {
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

export const ARCHIVE_FILE_PATHS = {
    story: FILES.eventSystem.timelineEvents,
    heroes: FILES.storyArchive.heroes,
    factions: FILES.storyArchive.factions,
    npcs: FILES.storyArchive.npcs,
    locations: FILES.storyArchive.locations,
};
