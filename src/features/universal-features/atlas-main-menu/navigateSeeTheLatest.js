function nextPaintCommitted() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}

function waitUntil(predicate, timeoutMs = 20000, intervalMs = 40) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
            try {
                if (predicate()) {
                    resolve();
                    return;
                }
            } catch {
                // keep polling
            }
            if (Date.now() - started > timeoutMs) {
                reject(new Error('See the Latest: timeline not ready'));
                return;
            }
            setTimeout(tick, intervalMs);
        };
        tick();
    });
}

/**
 * Jumps the dock timeline to its last page and opens the latest event slide.
 * Keeps the main menu visible — dock and timeline stay usable on the hub.
 */
export async function navigateSeeTheLatest() {
    const dockEarly = window.eventManager?.getDockTimelineEvents?.() || [];
    if (!dockEarly.length) return;

    await waitUntil(() => {
        const dock = window.eventManager?.getDockTimelineEvents?.() || [];
        return (
            dock.length > 0 &&
            typeof window.standaloneDockPagination?.goToPage === 'function' &&
            typeof window.standaloneEventSlide?.showEvent === 'function'
        );
    });

    const dockEvents = window.eventManager.getDockTimelineEvents();
    const latestIndex = dockEvents.length - 1;
    const { goToPage, getTotalPages } = window.standaloneDockPagination;

    goToPage(getTotalPages());
    await nextPaintCommitted();

    window.standaloneEventSlide.showEvent(latestIndex);

    if (window.SoundEffectsManager?.play) {
        window.SoundEffectsManager.play('eventClick');
    }
}
