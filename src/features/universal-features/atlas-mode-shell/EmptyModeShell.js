/**
 * Minimal in-content shell for modes that are not yet fully built.
 * Hides the main menu and shows a titled placeholder with Cancel → main menu.
 */

const HOST_ID = 'atlasEmptyModeHost';

/**
 * @param {{ title: string, lead?: string, onCancel?: () => void }} options
 */
export function mountEmptyModeShell({ title, lead = '', onCancel }) {
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
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-labelledby', 'atlasEmptyModeHostHeading');

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

    const dismissRow = document.createElement('div');
    dismissRow.className = 'story-archive-category-hub__dismiss-row';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'story-viewer-action-btn story-archive-category-hub-dismiss';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('title', 'Return to main menu');
    cancelBtn.addEventListener('click', () => {
        onCancel?.();
    });
    dismissRow.appendChild(cancelBtn);
    inner.appendChild(dismissRow);

    host.appendChild(inner);
    content.appendChild(host);

    const onEscape = (e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onCancel?.();
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
