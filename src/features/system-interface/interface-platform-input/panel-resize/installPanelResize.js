/**
 * Entry point for the desktop-only panel-width resize system.
 *
 * Responsibilities:
 *   - Boot once the DOM is ready (or immediately if it's already past `loading`).
 *   - Coalesce the body-subtree MutationObserver into a single rAF so dock /
 *     filter renders that mutate the DOM in bursts only trigger one rescan.
 *   - On mobile, strip any inline user widths so the CSS-only mobile layout wins.
 *   - Reclamp widths when the viewport resizes so a panel never sticks beyond
 *     a newly-smaller `--panel-*-width-max` cap.
 *
 * Exposes the small `window.*` aliases (gear-tick play hook, filters-trap-icon
 * sync) that other subsystems still call.
 */

import {
    PANELS,
    MOBILE_MQ,
    isMobile,
    clampWidth,
    clearUserWidth,
    purgeLegacyStorage
} from './panelResizeConfig.js';
import { installGearTickWindowApi } from './panelResizeGearTicks.js';
import {
    installFiltersTrapIconWindowApi,
    syncFiltersPanelTrapIconFromWindow
} from './filtersPanelTrapIcon.js';
import { ensureHandle, ensureWatchPanelClose } from './panelResizeHandle.js';

function tryAttachAll() {
    if (isMobile()) return;
    PANELS.forEach(function (cfg) {
        const panel = document.getElementById(cfg.id);
        if (panel) {
            ensureWatchPanelClose(panel, cfg);
            ensureHandle(panel, cfg);
        }
    });
    syncFiltersPanelTrapIconFromWindow();
}

/** Body subtree mutations can fire in huge bursts; coalesce to one rAF. */
let tryAttachScheduled = false;
function scheduleTryAttachAll() {
    if (tryAttachScheduled) return;
    tryAttachScheduled = true;
    requestAnimationFrame(function () {
        tryAttachScheduled = false;
        tryAttachAll();
    });
}

function onResize() {
    if (isMobile()) return;
    PANELS.forEach(function (cfg) {
        const raw = document.documentElement.style.getPropertyValue(cfg.cssVar).trim();
        if (!raw) return;
        const px = parseInt(raw, 10);
        if (!Number.isFinite(px)) return;
        const c = clampWidth(px, cfg);
        if (c !== px) {
            document.documentElement.style.setProperty(cfg.cssVar, c + 'px');
        }
    });
}

function removeInlineUserWidthsForMobileCss() {
    PANELS.forEach(clearUserWidth);
}

function init() {
    purgeLegacyStorage();
    tryAttachAll();
    if (!isMobile()) {
        const mo = new MutationObserver(scheduleTryAttachAll);
        if (document.body) {
            mo.observe(document.body, { childList: true, subtree: true });
        }
    }
    window.addEventListener('resize', onResize);
    window.matchMedia(MOBILE_MQ).addEventListener('change', function () {
        if (isMobile()) {
            removeInlineUserWidthsForMobileCss();
        } else {
            tryAttachAll();
        }
    });
}

installGearTickWindowApi();
installFiltersTrapIconWindowApi();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
