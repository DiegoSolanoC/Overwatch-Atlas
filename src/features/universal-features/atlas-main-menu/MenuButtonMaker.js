import { wireLoadingAssetImage } from '../atlas-ui/loadingAssetSlot.js';

/**
 * Builds a single main-menu tile (button + external description label below).
 *
 * Used by `MenuButtonArrangement` to construct the Interactive Worldview,
 * Connection Codex, and Data Archive tiles in the main menu. Pure DOM
 * construction; no click handlers are wired here.
 *
 * @param {Object} config
 * @param {string} config.id          - DOM id for the inner `<button>`.
 * @param {string} config.title       - Tooltip / `title` attribute and `<img alt>`.
 * @param {string} config.imagePath   - Tile icon image path (URL-encoded).
 * @param {string} config.label       - Visible label text inside the tile.
 * @param {string} config.description - Caption shown beneath the tile.
 * @returns {HTMLDivElement} A wrapper element with `.button` pointing at the inner `<button>`.
 */
export function MenuButtonMaker({ id, title, imagePath, label, description }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'main-menu-btn-wrapper';

    const button = document.createElement('button');
    button.id = id;
    button.className = 'main-menu-btn';
    button.title = title;
    button.innerHTML = `
        <div class="main-menu-image-container">
            <img src="${imagePath}" alt="${title}">
        </div>
        <div class="main-menu-label-container">
            <div class="main-menu-label">${label}</div>
        </div>
    `;

    const externalLabel = document.createElement('div');
    externalLabel.className = 'main-menu-external-label';
    externalLabel.innerHTML = `<div class="main-menu-external-label__desc">${description}</div>`;

    button.appendChild(externalLabel);
    wrapper.appendChild(button);

    const menuImg = button.querySelector('.main-menu-image-container img');
    wireLoadingAssetImage(menuImg, {
        wrap: button.querySelector('.main-menu-image-container'),
    });

    wrapper.button = button;

    return wrapper;
}
