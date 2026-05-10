import { isGitHubPages } from './isGitHubPages.js';

const AUTO_PRELOAD_STORAGE_KEY = 'autoPreloadEventSystem';

/**
 * Builds the "Auto preload" checkbox row that lives on the main menu.
 *
 * Behavior:
 * - On first run the checkbox defaults to **on** for GitHub Pages and **off**
 *   for everywhere else. The chosen value is persisted under
 *   `localStorage.autoPreloadEventSystem`.
 * - When the user toggles it, the new value is persisted immediately.
 * - On GitHub Pages the entire row is hidden (auto-preload is forced on
 *   silently for public viewers).
 *
 * The orchestrator reads the same `localStorage` key in
 * `autoPreloadEventSystemIfEnabled()` to decide whether to pre-build the
 * Event System when launching a mode.
 *
 * @returns {HTMLLabelElement} The toggle row, ready to be appended to the menu.
 */
export function createAutoPreloadToggle() {
    const onGitHubPages = isGitHubPages();

    const container = document.createElement('label');
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #aaa;
        cursor: pointer;
        user-select: none;
    `;
    container.title =
        'Automatically load Event System when opening Data Archive, Interactive Worldview, or Connection Codex';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'autoPreloadEventSystem';
    checkbox.style.cssText = `
        width: 14px;
        height: 14px;
        cursor: pointer;
    `;

    const saved = localStorage.getItem(AUTO_PRELOAD_STORAGE_KEY);
    if (saved === null) {
        checkbox.checked = onGitHubPages;
        localStorage.setItem(AUTO_PRELOAD_STORAGE_KEY, String(checkbox.checked));
    } else {
        checkbox.checked = saved === 'true';
    }

    const labelText = document.createElement('span');
    labelText.textContent = 'Auto preload';

    container.appendChild(checkbox);
    container.appendChild(labelText);

    if (onGitHubPages) {
        container.style.display = 'none';
    }

    checkbox.addEventListener('change', () => {
        localStorage.setItem(AUTO_PRELOAD_STORAGE_KEY, String(checkbox.checked));
    });

    return container;
}
