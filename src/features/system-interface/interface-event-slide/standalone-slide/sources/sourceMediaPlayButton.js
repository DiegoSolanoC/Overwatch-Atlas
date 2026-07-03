/** Story mode header icon — used for in-panel PDF sources. */
export const STORY_MODE_ICON_PATH = 'src/assets/images/Icons/Mode%20Icons/Story%20Timeline.png';

/**
 * @param {HTMLButtonElement} btn
 * @param {'youtube'|'pdf'} mediaKind
 * @param {boolean} isActive
 */
export function renderSourceMediaPlayButtonFace(btn, mediaKind, isActive) {
    btn.replaceChildren();
    btn.classList.toggle('event-source-media-play--pdf', mediaKind === 'pdf' && !isActive);

    if (isActive) {
        btn.textContent = '×';
        return;
    }

    if (mediaKind === 'pdf') {
        const img = document.createElement('img');
        img.src = STORY_MODE_ICON_PATH;
        img.alt = '';
        img.className = 'event-source-media-play__icon';
        img.width = 20;
        img.height = 20;
        img.decoding = 'async';
        img.draggable = false;
        btn.appendChild(img);
        return;
    }

    btn.textContent = '▶';
}
