/**
 * Dismiss slide-out chrome: music, filters, event manager, palette.
 */
export function closeWorldviewAuxPanels() {
    let closedMusic = false;
    const musicPanel = document.getElementById('musicPanel');
    const musicBtn = document.getElementById('musicToggle');
    if (musicPanel && musicPanel.classList.contains('open')) {
        closedMusic = true;
        musicPanel.classList.remove('open');
        if (musicBtn) musicBtn.classList.remove('active');
    }

    const filtersPanel = document.getElementById('filtersPanel');
    const filtersBtn = document.getElementById('filtersToggle');
    if (filtersPanel && filtersPanel.classList.contains('open')) {
        filtersPanel.classList.remove('open');
        if (filtersBtn) filtersBtn.classList.remove('active');
    }

    const managePanel = document.getElementById('eventsManagePanel');
    const manageToggle = document.getElementById('eventsManageToggle');
    if (managePanel && managePanel.classList.contains('open')) {
        try {
            window.eventManager?.resetAllEventVariants?.();
        } catch (_) {}
        managePanel.classList.remove('open');
        if (manageToggle) manageToggle.classList.remove('active');
        try {
            window.SummaryInfoBadge?.hide?.();
        } catch (_) {}
    }

    const paletteMenu = document.getElementById('paletteMenu');
    if (paletteMenu && paletteMenu.classList.contains('open')) {
        if (typeof window._closePaletteMenu === 'function') {
            try {
                window._closePaletteMenu();
            } catch (_) {}
        } else {
            paletteMenu.classList.remove('open');
            const paletteToggle = document.getElementById('colorPaletteToggle');
            if (paletteToggle) paletteToggle.classList.remove('active');
        }
    }

    if (closedMusic && window.MusicManager && typeof window.MusicManager.updateNowPlaying === 'function') {
        try {
            window.MusicManager.updateNowPlaying();
        } catch (_) {}
    }
}
