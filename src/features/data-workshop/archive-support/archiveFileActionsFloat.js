/**
 * Float Story / Dialogue Theater Add·Save·Export·Import(/Merge) into
 * `#dockGlobeRailRight` — same fixed dock band as `#dockGlobeRailLeft`
 * (list/timeline toggle sits on the dock border images).
 */

const RAIL_ID = 'dockGlobeRailRight';
const ROW_CLASS = 'archive-file-actions-row';

/**
 * @returns {HTMLElement|null}
 */
function getRail() {
    return document.getElementById(RAIL_ID);
}

/**
 * @param {HTMLElement|null|undefined} actionsEl
 * @param {string} ownerKey
 */
export function floatArchiveFileActions(actionsEl, ownerKey) {
    if (!(actionsEl instanceof HTMLElement)) return;
    const key = String(ownerKey || '').trim() || 'archive';
    const rail = getRail();
    if (!(rail instanceof HTMLElement)) {
        console.warn('[archiveFileActions] #dockGlobeRailRight missing — cannot float actions');
        return;
    }

    const prior = rail.dataset.archiveFileOwner;
    if (prior && prior !== key) {
        unfloatArchiveFileActions(prior);
    }

    if (actionsEl.parentElement !== rail) {
        rail._floatReturnParent = actionsEl.parentElement;
        rail._floatReturnNext = actionsEl.nextSibling;
        rail.appendChild(actionsEl);
    }

    actionsEl.classList.add(ROW_CLASS);
    rail.dataset.archiveFileOwner = key;
    rail.classList.add('dock-globe-rail--archive-file-actions');
}

/**
 * @param {string} [ownerKey] If set, only restore when owned by this key.
 */
export function unfloatArchiveFileActions(ownerKey) {
    const rail = getRail();
    if (!(rail instanceof HTMLElement)) return;

    const key = String(ownerKey || '').trim();
    if (key && rail.dataset.archiveFileOwner && rail.dataset.archiveFileOwner !== key) return;

    const actions = rail.querySelector(`:scope > .events-manage-actions.${ROW_CLASS}`)
        || rail.querySelector(':scope > .events-manage-actions');
    const parent = rail._floatReturnParent;
    if (actions instanceof HTMLElement) {
        actions.classList.remove(ROW_CLASS);
        if (parent instanceof HTMLElement) {
            const next = rail._floatReturnNext;
            if (next instanceof Node && next.parentNode === parent) {
                parent.insertBefore(actions, next);
            } else {
                parent.appendChild(actions);
            }
        }
    }

    rail._floatReturnParent = null;
    rail._floatReturnNext = null;
    delete rail.dataset.archiveFileOwner;
    rail.classList.remove('dock-globe-rail--archive-file-actions');
}

/** @deprecated No-op — rail CSS owns vertical position. Kept for call-site compat. */
export function syncArchiveFileActionsToZoomSlot() {}

/** @deprecated Prefer float into the dock rail; kept for call-site compat. */
export function ensureArchiveFileActionsHost() {
    return getRail();
}
