/**
 * PaletteMenuDom — builds `#paletteMenu` + option swatches, updates the header
 * toggle icon, and reflects the active palette on the menu buttons.
 */

const SWATCH_INNER =
    '<span style="display: block; width: 100%; height: 100%; border-radius: 50%;"></span>';

const ICON_BLUE = 'src/assets/images/Icons/Palette%20Icons/Blue%20Palette%20Icon.png';
const ICON_GRAY = 'src/assets/images/Icons/Palette%20Icons/Dark%20Palette%20Icon.png';
const ICON_CRIMSON = 'src/assets/images/Icons/Palette%20Icons/Red%20Palette%20Icon.png';
const ICON_NULLED = 'src/assets/images/Icons/Palette%20Icons/Purple%20Palette%20Icon.png';

/**
 * @param {{ paletteId: string, cssClass: string, title: string }} spec
 * @returns {HTMLButtonElement}
 */
export function createPaletteOptionButton({ paletteId, cssClass, title }) {
    const btn = document.createElement('button');
    btn.className = `palette-option-btn ${cssClass}`;
    btn.dataset.palette = paletteId;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = SWATCH_INNER;
    return btn;
}

/**
 * Ensures `#paletteMenu` exists with blue, gray, crimson, and nulled options.
 * Appends missing crimson/nulled rows for older saved DOM.
 *
 * @returns {HTMLDivElement}
 */
export function ensurePaletteMenuDom() {
    let paletteMenu = document.getElementById('paletteMenu');
    if (!paletteMenu) {
        paletteMenu = document.createElement('div');
        paletteMenu.id = 'paletteMenu';
        paletteMenu.className = 'palette-menu';
        paletteMenu.appendChild(
            createPaletteOptionButton({ paletteId: 'blue', cssClass: 'blue', title: 'Blue Palette' })
        );
        paletteMenu.appendChild(
            createPaletteOptionButton({ paletteId: 'gray', cssClass: 'black', title: 'Gray Palette' })
        );
        paletteMenu.appendChild(
            createPaletteOptionButton({ paletteId: 'crimson', cssClass: 'crimson', title: 'Crimson Palette' })
        );
        paletteMenu.appendChild(
            createPaletteOptionButton({ paletteId: 'nulled', cssClass: 'nulled', title: 'Nulled Palette' })
        );
        document.body.appendChild(paletteMenu);
        return paletteMenu;
    }
    if (!paletteMenu.querySelector('[data-palette="crimson"]')) {
        paletteMenu.appendChild(
            createPaletteOptionButton({ paletteId: 'crimson', cssClass: 'crimson', title: 'Crimson Palette' })
        );
    }
    if (!paletteMenu.querySelector('[data-palette="nulled"]')) {
        paletteMenu.appendChild(
            createPaletteOptionButton({ paletteId: 'nulled', cssClass: 'nulled', title: 'Nulled Palette' })
        );
    }
    return paletteMenu;
}

/**
 * @param {'blue'|'gray'|'crimson'|'nulled'|string} palette
 */
export function updatePaletteButtonIcon(palette) {
    const colorPaletteToggle = document.getElementById('colorPaletteToggle');
    if (!colorPaletteToggle) return;

    const iconSpan = colorPaletteToggle.querySelector('#colorPaletteIcon');
    if (!iconSpan) return;

    let iconPath = ICON_BLUE;
    if (palette === 'gray') iconPath = ICON_GRAY;
    else if (palette === 'crimson') iconPath = ICON_CRIMSON;
    else if (palette === 'nulled') iconPath = ICON_NULLED;

    let img = iconSpan.querySelector('img');
    if (img) {
        img.src = iconPath;
        img.alt = 'Color Palette';
        img.className = img.className || 'header-hub-icon';
    } else {
        iconSpan.innerHTML = '';
        img = document.createElement('img');
        img.src = iconPath;
        img.alt = 'Color Palette';
        img.className = 'header-hub-icon';
        iconSpan.appendChild(img);
    }
}

/**
 * @param {'blue'|'gray'|'crimson'|'nulled'|string} palette
 */
export function updatePaletteMenuActiveState(palette) {
    const menu = document.getElementById('paletteMenu');
    if (!menu) return;

    menu.querySelectorAll('.palette-option-btn').forEach((btn) => {
        if (btn.dataset.palette === palette) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    updatePaletteButtonIcon(palette);
}
