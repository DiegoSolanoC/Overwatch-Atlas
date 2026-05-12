/**
 * wireBackgroundMusicPlayback — listeners on `<audio id="backgroundMusic">`
 * for end-of-track behavior and browser autoplay policy.
 *
 * - `wireNearEndFadeAndTrackEnded` — `timeupdate` pre-end fade + `ended`
 *   (startup→ambient, loop, shuffle advance, catalog→ambient).
 * - `wireAutoplayUnlockOnFirstGesture` — first user gesture starts playback
 *   if a track is already queued; self-detaches once `playing` fires.
 */

/**
 * @param {import('../MusicService.js').MusicService} service
 * @param {{ fadeOut: Function, playNextSong: Function, transitionToAmbient: Function }} opts
 */
export function wireNearEndFadeAndTrackEnded(service, opts) {
    const { fadeOut, playNextSong, transitionToAmbient } = opts;
    const bg = service.backgroundMusic;
    const progress = service.progressService;
    const shuffle = service.shuffleService;
    const vol = service.volumeService;

    bg.addEventListener('timeupdate', () => {
        if (service._musicMode === 'ambient' || service._musicMode === 'startup') return;
        if (progress.isInteracting()) return;
        const fadeDuration = 2000;
        const timeRemaining = bg.duration - bg.currentTime;
        if (timeRemaining <= (fadeDuration / 1000) && timeRemaining > 0.1 && !vol.isFading()) {
            fadeOut();
        }
    });

    bg.addEventListener('ended', () => {
        if (service._musicMode === 'startup' && transitionToAmbient) {
            transitionToAmbient();
            return;
        }
        if (service.isLooping && service._musicMode === 'catalog' && !shuffle.isShuffling) {
            bg.currentTime = 0;
            bg.play();
            return;
        }
        if (shuffle.isShuffling && shuffle.shuffleQueue.length > 0) {
            playNextSong();
            return;
        }
        if (service._musicMode === 'catalog' && transitionToAmbient) {
            transitionToAmbient();
        }
    });
}

/**
 * @param {import('../MusicService.js').MusicService} service
 * @param {Function} playMusic
 */
export function wireAutoplayUnlockOnFirstGesture(service, playMusic) {
    const events = ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown', 'wheel'];
    const handler = () => {
        if (!service.hasStartedPlaying && service.backgroundMusic.paused && service.currentSong) {
            playMusic();
            service.hasStartedPlaying = true;
            events.forEach((ev) => document.removeEventListener(ev, handler));
        }
    };
    events.forEach((ev) => document.addEventListener(ev, handler, { passive: true, once: false }));
    service.backgroundMusic.addEventListener('playing', () => {
        service.hasStartedPlaying = true;
        events.forEach((ev) => document.removeEventListener(ev, handler));
    });
}
