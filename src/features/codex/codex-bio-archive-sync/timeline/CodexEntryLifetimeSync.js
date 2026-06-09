/**
 * Portrait tinting from bio archive entry lifetime ranges vs dock timeline page.
 */

import { s } from '../../codex-canvas/core/canvasSession.js';
import { findCodexNodeIdForBioEntity } from '../../codex-edge-cords/topology/CodexBioEntityMatching.js';
import { getDockTimelineEventsForPagination } from '../../../gallery/gallery-mode/heroBiographyDockTimeline.js';
import {
    buildStoryEventIndexByName,
    resolveEntryLifetimePageStatus,
} from '../../../system-interface/interface-shared/bio-archive/bioArchiveEntryLifetime.js';
import {
    getBioArchiveEntryLifetimeEntries,
    getCodexDockPageIndexSpan,
} from './codexBioConnectionDockTimeline.js';

/** @type {Map<string, 'before' | 'after'>} */
let lastLifetimeNodeStatuses = new Map();

/**
 * @returns {Map<string, 'before' | 'after'>}
 */
function buildNodeLifetimeStatuses(allNodes) {
    /** @type {Map<string, 'before' | 'after'>} */
    const out = new Map();
    const span = getCodexDockPageIndexSpan();
    if (!span) return out;

    const events = getDockTimelineEventsForPagination();
    const indexByEventName = buildStoryEventIndexByName(events);
    const entries = getBioArchiveEntryLifetimeEntries();

    for (const { kind, name, lifetime } of entries) {
        const nodeId = findCodexNodeIdForBioEntity(kind, name, allNodes);
        if (!nodeId) continue;
        const status = resolveEntryLifetimePageStatus(
            lifetime,
            span.start,
            span.end,
            indexByEventName,
        );
        if (status === 'before' || status === 'after') {
            out.set(nodeId, status);
        }
    }
    return out;
}

export function applyCodexEntryLifetimeNodeClassesNow() {
    if (!s.root) return;

    const statuses = buildNodeLifetimeStatuses(s.codexAllNodes);
    s.codexEntryLifetimeNodeStatuses = statuses;

    const prev = lastLifetimeNodeStatuses;
    const touched = new Set([...prev.keys(), ...statuses.keys()]);

    for (const nodeId of touched) {
        const nodeEl = s.codexNodeElements.get(nodeId);
        if (!nodeEl) continue;

        const next = statuses.get(nodeId);
        const was = prev.get(nodeId);

        if (was === next) continue;

        nodeEl.classList.remove('codex-node--lifetime-before', 'codex-node--lifetime-after');
        if (next === 'before') nodeEl.classList.add('codex-node--lifetime-before');
        else if (next === 'after') nodeEl.classList.add('codex-node--lifetime-after');
    }

    lastLifetimeNodeStatuses = new Map(statuses);
}

export function resetCodexEntryLifetimeVisualState() {
    lastLifetimeNodeStatuses = new Map();
    if (!s.root) return;
    for (const nodeEl of s.codexNodeElements.values()) {
        nodeEl.classList.remove('codex-node--lifetime-before', 'codex-node--lifetime-after');
    }
}
