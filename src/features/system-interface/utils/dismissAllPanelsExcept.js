/**
 * dismissAllPanelsExcept — closes all floating panels except the one specified.
 * Prevents multiple panels from being open simultaneously.
 *
 * @param {string|null} exceptPanelId - ID of the panel to leave open, or null to close all.
 */
export function dismissAllPanelsExcept(exceptPanelId) {
    const panels = [
        { panelId: 'musicPanel',        toggleId: 'musicToggle' },
        { panelId: 'filtersPanel',      toggleId: 'filtersToggle' },
        { panelId: 'eventsManagePanel', toggleId: 'eventsManageToggle' },
        { panelId: 'eventSlide',        toggleId: null },
    ];

    panels.forEach(({ panelId, toggleId }) => {
        if (panelId === exceptPanelId) return;
        const panel = document.getElementById(panelId);
        if (panel?.classList.contains('open')) {
            panel.classList.remove('open');
            if (toggleId) {
                document.getElementById(toggleId)?.classList.remove('active');
            }
        }
    });
}
