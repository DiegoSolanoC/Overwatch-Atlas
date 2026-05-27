/**
 * PaletteMenuPositioning — open/close `#paletteMenu` anchored to `#colorPaletteToggle`,
 * accounting for `body { transform: scale(...) }` on desktop and scroll/resize.
 */

function getBodyScale() {
    try {
        const t = window.getComputedStyle(document.body).transform;
        if (!t || t === 'none') return 1;
        const m = t.match(/^matrix\(([^)]+)\)$/);
        if (!m) return 1;
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
        const a = parts[0];
        return Number.isFinite(a) && a > 0 ? a : 1;
    } catch {
        return 1;
    }
}

function positionMenuUnderToggle(menu, toggle) {
    if (!toggle) return;
    const gap = 8;

    const scale = getBodyScale();
    const rect = toggle.getBoundingClientRect();
    const cx = (rect.left + rect.width / 2) / scale;
    const belowY = (rect.bottom + gap) / scale;
    const aboveY = (rect.top - gap) / scale;

    const vw = Math.max(1, (window.innerWidth || 1) / scale);
    const vh = Math.max(1, (window.innerHeight || 1) / scale);

    const optionBtns = menu.querySelectorAll('.palette-option-btn');
    const btnN = optionBtns.length || 4;
    const firstBtn = menu.querySelector('.palette-option-btn');
    const btnW = firstBtn ? parseFloat(window.getComputedStyle(firstBtn).width) : 45;
    const btnH = firstBtn ? parseFloat(window.getComputedStyle(firstBtn).height) : 45;
    const menuGap = parseFloat(window.getComputedStyle(menu).gap) || 10;
    const menuWidth = btnW * btnN + menuGap * Math.max(0, btnN - 1);
    const menuHeight = btnH;
    const halfW = menuWidth / 2;
    const margin = 8;

    let left = cx;
    let top = belowY;

    if (left - halfW < margin) left = halfW + margin;
    if (left + halfW > vw - margin) left = vw - halfW - margin;

    if (top + menuHeight > vh - margin) {
        top = aboveY - menuHeight;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
}

export function openPaletteMenu() {
    const menu = document.getElementById('paletteMenu');
    const toggle = document.getElementById('colorPaletteToggle');
    if (!menu) return;

    const positionMenuUnderToggleBound = () => positionMenuUnderToggle(menu, toggle);

    positionMenuUnderToggleBound();
    menu.classList.add('open');
    menu.style.opacity = '1';
    menu.style.visibility = 'visible';
    menu.style.transform = '';
    menu.style.pointerEvents = 'auto';
    menu.style.display = 'flex';
    menu.style.position = 'fixed';
    menu.style.zIndex = '300';
    menu.style.flexDirection = 'row';
    menu.style.gap = '';
    menu.style.alignItems = '';

    try {
        if (menu._paletteRepositionCleanup) menu._paletteRepositionCleanup();
    } catch {
        /* ignore */
    }

    let menuReposRaf = null;
    const scheduleMenuReposition = () => {
        if (menuReposRaf != null) return;
        menuReposRaf = requestAnimationFrame(() => {
            menuReposRaf = null;
            if (!menu.classList.contains('open')) return;
            positionMenuUnderToggleBound();
        });
    };

    const onWinScroll = () => scheduleMenuReposition();
    const onWinResize = () => scheduleMenuReposition();
    window.addEventListener('scroll', onWinScroll, true);
    window.addEventListener('resize', onWinResize);

    const headerHub = toggle ? toggle.closest('.header-hub') : null;
    if (headerHub) headerHub.addEventListener('scroll', onWinScroll);

    scheduleMenuReposition();

    menu._paletteRepositionCleanup = () => {
        window.removeEventListener('scroll', onWinScroll, true);
        window.removeEventListener('resize', onWinResize);
        if (headerHub) headerHub.removeEventListener('scroll', onWinScroll);
        if (menuReposRaf != null) {
            cancelAnimationFrame(menuReposRaf);
            menuReposRaf = null;
        }
        menu._paletteRepositionCleanup = null;
    };

    if (toggle) toggle.classList.add('active');
}

export function closePaletteMenu() {
    const menu = document.getElementById('paletteMenu');
    const toggle = document.getElementById('colorPaletteToggle');
    if (menu) {
        menu.classList.remove('open');
        try {
            if (menu._paletteRepositionCleanup) menu._paletteRepositionCleanup();
        } catch {
            /* ignore */
        }
        menu.style.opacity = '';
        menu.style.visibility = '';
        menu.style.transform = '';
        menu.style.pointerEvents = '';
    }
    if (toggle) toggle.classList.remove('active');
}
