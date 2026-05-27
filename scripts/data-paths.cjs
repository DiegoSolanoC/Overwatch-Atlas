/** Node scripts: re-export src/data/registry.cjs with absolute paths from repo root. */
const path = require('path');
const registry = require('../src/data/registry.cjs');

const REPO_ROOT = path.join(__dirname, '..');

function abs(publicPathStr) {
    return registry.absFromPublic(publicPathStr);
}

module.exports = {
    ...registry,
    REPO_ROOT,
    abs,
    timelineEvents: abs(registry.FILES.eventSystem.timelineEvents),
    storyArchive: {
        heroes: abs(registry.FILES.storyArchive.heroes),
        factions: abs(registry.FILES.storyArchive.factions),
        npcs: abs(registry.FILES.storyArchive.npcs),
        locations: abs(registry.FILES.storyArchive.locations),
    },
    codexLabels: abs(registry.FILES.connectionCodex.codexLabels),
    connections: abs(registry.FILES.connectionCodex.connections),
    locations: abs(registry.FILES.worldview.locations),
    manifest: abs(registry.FILES.platform.manifest),
};
