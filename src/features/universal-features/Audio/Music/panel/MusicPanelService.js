/**
 * MusicPanelService — open/close wiring for the music UI inside `#filtersPanel`
 * (toggle button, close button, moving `.music-panel-content` into the panel).
 */

export class MusicPanelService {
    constructor(musicButton, musicPanel, musicPanelClose) {
        this.musicButton = musicButton;
        this.musicPanel = musicPanel;
        this.musicPanelClose = musicPanelClose;
        this._onToggle = null;
    }

    /**
     * Setup panel toggle button handlers
     */
    setupToggleButton(onToggle) {
        if (!this.musicButton) {
            console.error('MusicPanelService: musicButton is null in setupToggleButton!');
            return;
        }
        this._onToggle = (typeof onToggle === 'function') ? onToggle : null;

        // Handle button click/touch - unified handler
        const ensureMusicContentMounted = () => {
            const filtersPanel = document.getElementById('filtersPanel');
            const musicPanel = document.getElementById('musicPanel');
            if (!filtersPanel || !musicPanel) return;
            const existing = filtersPanel.querySelector('.music-panel-content');
            if (existing) return;
            const musicContent = musicPanel.querySelector('.music-panel-content');
            if (!musicContent) return;
            filtersPanel.appendChild(musicContent);
            musicPanel.style.display = 'none';
        };

        const handleMusicToggle = (event) => {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }

            // Play music button sound
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('music');
            }

            ensureMusicContentMounted();

            // Close event management panel if open
            const eventsManagePanel = document.getElementById('eventsManagePanel');
            const eventsManageToggle = document.getElementById('eventsManageToggle');
            if (eventsManagePanel && eventsManagePanel.classList.contains('open')) {
                eventsManagePanel.classList.remove('open');
                try {
                    window.SummaryInfoBadge?.hide();
                } catch (_) {}
                if (eventsManageToggle) {
                    eventsManageToggle.classList.remove('active');
                }
            }

            const filtersPanel = document.getElementById('filtersPanel');
            const filterService = window.FilterService;
            const isMusicOpen = !!(filtersPanel &&
                filtersPanel.classList.contains('open') &&
                filtersPanel.dataset.panelMode === 'music');
            if (isMusicOpen) {
                if (filterService && typeof filterService.closePanel === 'function') {
                    filterService.closePanel();
                } else if (filtersPanel) {
                    filtersPanel.classList.remove('open');
                }
                this.musicButton.classList.remove('active');
            } else if (filterService && typeof filterService.openPanelWithMode === 'function') {
                filterService.openPanelWithMode('music');
            } else if (filtersPanel) {
                filtersPanel.classList.add('open');
                filtersPanel.dataset.panelMode = 'music';
                filtersPanel.classList.add('filters-panel--music-mode');
                filtersPanel.classList.remove('filters-panel--filters-mode');
                this.musicButton.classList.add('active');
            }

            const nowOpen = !!(filtersPanel &&
                filtersPanel.classList.contains('open') &&
                filtersPanel.dataset.panelMode === 'music');
            if (onToggle) onToggle(nowOpen);
        };

        // Prevent button from interfering with globe controls (mouse)
        this.musicButton.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });

        this.musicButton.addEventListener('mouseup', (event) => {
            event.stopPropagation();
        });

        // Handle touch events for mobile
        let touchStartTime = 0;
        this.musicButton.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            touchStartTime = Date.now();
        });

        this.musicButton.addEventListener('touchend', (event) => {
            event.stopPropagation();
            event.preventDefault();
            // Only trigger if it was a quick tap (not a drag)
            if (Date.now() - touchStartTime < 300) {
                handleMusicToggle(event);
            }
        });

        // Handle click events (desktop and fallback)
        this.musicButton.addEventListener('click', handleMusicToggle);
    }

    /**
     * Setup close button handler
     */
    setupCloseButton() {
        const closeButton = this.musicPanelClose || document.getElementById('filtersPanelClose');
        if (!closeButton) return;

        closeButton.addEventListener('click', () => {
            const filterService = window.FilterService;
            if (filterService && typeof filterService.getPanelMode === 'function' && filterService.getPanelMode() !== 'music') {
                return;
            }
            // Play music button sound when closing panel
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('music');
            }
            if (filterService && typeof filterService.getPanelMode === 'function' && filterService.getPanelMode() === 'music') {
                if (typeof filterService.closePanel === 'function') {
                    filterService.closePanel();
                }
            } else if (this.musicPanel) {
                this.musicPanel.classList.remove('open');
            }
            if (this.musicButton) {
                this.musicButton.classList.remove('active');
            }
            if (this._onToggle) {
                this._onToggle(false);
            }
        });
    }
}
