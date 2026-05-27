/**
 * waitForFiniteAudioDuration — poll + event listeners until `<audio>` exposes a
 * finite `duration`, then invoke the callback exactly once and tear down.
 */

/**
 * @param {HTMLMediaElement} audioEl
 * @param {(duration: number, readyState: number) => void} onReady
 */
export function onceFiniteDurationReady(audioEl, onReady) {
    if (!onReady) return;

    let done = false;
    let metadataCheckInterval = null;

    const cleanup = () => {
        audioEl.removeEventListener('loadedmetadata', handleMetadataLoaded);
        audioEl.removeEventListener('canplay', handleMetadataLoaded);
        audioEl.removeEventListener('loadeddata', handleMetadataLoaded);
        audioEl.removeEventListener('canplaythrough', handleMetadataLoaded);
        if (metadataCheckInterval != null) {
            clearInterval(metadataCheckInterval);
            metadataCheckInterval = null;
        }
    };

    const finish = (duration, readyState) => {
        if (done) return;
        done = true;
        cleanup();
        onReady(duration, readyState);
    };

    const handleMetadataLoaded = () => {
        const duration = audioEl.duration;
        const readyState = audioEl.readyState;

        if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
            finish(duration, readyState);
        }
    };

    audioEl.addEventListener('loadedmetadata', handleMetadataLoaded);
    audioEl.addEventListener('canplay', handleMetadataLoaded);
    audioEl.addEventListener('loadeddata', handleMetadataLoaded);
    audioEl.addEventListener('canplaythrough', handleMetadataLoaded);

    let metadataCheckCount = 0;
    const maxMetadataChecks = 100;
    metadataCheckInterval = setInterval(() => {
        if (done) return;
        metadataCheckCount++;
        const duration = audioEl.duration;

        if (duration && !isNaN(duration) && isFinite(duration) && duration > 0) {
            finish(duration, audioEl.readyState);
        } else if (metadataCheckCount >= maxMetadataChecks) {
            clearInterval(metadataCheckInterval);
            metadataCheckInterval = null;
        }
    }, 100);
}
