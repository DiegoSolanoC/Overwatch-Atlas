import { wireLoadingAssetImage } from '../atlas-ui/loadingAssetSlot.js';

/**
 * Side-column menu tile — same DOM as primary menu buttons (image, title, description in-button).
 *
 * @param {Object} config
 * @param {string} [config.id]
 * @param {string} config.title
 * @param {string} [config.imagePath]
 * @param {string} config.label
 * @param {string} [config.description]
 * @param {string} [config.href] - When set, renders an `<a>` instead of `<button>`.
 * @param {boolean} [config.pending] - Disabled placeholder (no navigation).
 * @returns {HTMLDivElement}
 */
export function MenuSideButtonMaker({
    id,
    title,
    imagePath,
    label,
    description = '',
    href,
    pending = false,
}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'main-menu-side-btn-wrapper';

    const isLink = Boolean(href) && !pending;
    const el = document.createElement(isLink ? 'a' : 'button');
    el.className = 'main-menu-btn main-menu-side-btn';
    if (id) el.id = id;
    el.title = title;

    if (isLink) {
        el.href = href;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
    } else {
        el.type = 'button';
    }

    if (pending) {
        el.setAttribute('disabled', '');
        el.setAttribute('aria-disabled', 'true');
        el.classList.add('main-menu-side-btn--pending');
    }

    const imgBlock = imagePath
        ? `<div class="main-menu-image-container">
            <img src="${imagePath}" alt="${title}">
           </div>`
        : `<div class="main-menu-image-container main-menu-image-container--placeholder" aria-hidden="true"></div>`;

    el.innerHTML = `
        ${imgBlock}
        <div class="main-menu-label-container">
            <div class="main-menu-label">${label}</div>
        </div>
    `;

    if (description) {
        const externalLabel = document.createElement('div');
        externalLabel.className = 'main-menu-external-label';
        externalLabel.innerHTML = `<div class="main-menu-external-label__desc">${description}</div>`;
        el.appendChild(externalLabel);
    }

    wrapper.appendChild(el);

    const menuImg = el.querySelector('.main-menu-image-container img');
    if (menuImg) {
        wireLoadingAssetImage(menuImg, {
            wrap: el.querySelector('.main-menu-image-container'),
        });
    }

    wrapper.button = el;
    return wrapper;
}
