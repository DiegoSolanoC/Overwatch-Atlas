/**
 * Minimal in-content shell for modes that are not yet fully built.
 * Exit via the header Home button (or Escape → Home), not an in-panel Cancel.
 */

import { triggerHomeExit } from '../atlas-header/triggerHomeExit.js';

const HOST_ID = 'atlasEmptyModeHost';

/**
 * @param {{ title: string, lead?: string }} options
 */
export function mountEmptyModeShell({ title, lead = '' }) {
    unmountEmptyModeShell();

    const testContainer = document.querySelector('.test-container');
    if (testContainer) {
        testContainer.style.display = 'none';
    }

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.setProperty('display', 'none', 'important');
    }
    const eventsManagePanel = document.getElementById('eventsManagePanel');
    if (eventsManagePanel) {
        eventsManagePanel.classList.remove('open');
    }

    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        globeContainer.style.display = 'none';
    }

    const content = document.getElementById('content');
    if (!content) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'story-viewer-container story-viewer-container--hub atlas-empty-mode-host';
    host.setAttribute('role', 'main');
    host.setAttribute('aria-label', title);

    const inner = document.createElement('div');
    inner.className = 'atlas-empty-mode-host__inner';

    const heading = document.createElement('h2');
    heading.id = 'atlasEmptyModeHostHeading';
    heading.className = 'story-archive-category-hub-heading atlas-empty-mode-host__heading';
    heading.textContent = title;

    inner.appendChild(heading);

    if (lead) {
        const sub = document.createElement('p');
        sub.className = 'story-archive-category-hub-lead atlas-empty-mode-host__lead';
        sub.textContent = lead;
        inner.appendChild(sub);
    }

    host.appendChild(inner);
    content.appendChild(host);

    const onEscape = (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        triggerHomeExit();
    };
    document.addEventListener('keydown', onEscape);
    host._atlasEmptyModeEscape = onEscape;

    requestAnimationFrame(() => {
        host.classList.add('active');
    });
}

export function unmountEmptyModeShell() {
    const host = document.getElementById(HOST_ID);
    if (host?._atlasEmptyModeEscape) {
        document.removeEventListener('keydown', host._atlasEmptyModeEscape);
    }
    host?.remove();

    const eventManagerBtn = document.getElementById('eventsManageToggle');
    if (eventManagerBtn) {
        eventManagerBtn.style.removeProperty('display');
    }
}
