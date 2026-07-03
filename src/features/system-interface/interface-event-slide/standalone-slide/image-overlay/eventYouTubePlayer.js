/**
 * YouTube IFrame API player for in-app source embeds (play/pause state callbacks).
 */

import {
    pauseMusicForSourceMedia,
    resumeMusicAfterSourceMedia,
} from './eventSourceMediaMusic.js';

const MOUNT_ID = 'eventYouTubePlayerMount';

/** @type {YT.Player|null} */
let activePlayer = null;

/**
 * @returns {Promise<typeof YT|undefined>}
 */
function loadYouTubeIframeApi() {
    if (window.YT?.Player) {
        return Promise.resolve(window.YT);
    }

    return new Promise((resolve) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve(window.YT);
        };

        if (!document.querySelector('script[data-yt-iframe-api]')) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.async = true;
            tag.dataset.ytIframeApi = '1';
            document.head.appendChild(tag);
        }
    });
}

/**
 * @param {number} state
 */
function handlePlayerStateChange(state) {
    const YTGlobal = window.YT;
    if (!YTGlobal?.PlayerState) return;

    if (state === YTGlobal.PlayerState.PLAYING) {
        pauseMusicForSourceMedia();
        return;
    }

    if (
        state === YTGlobal.PlayerState.PAUSED
        || state === YTGlobal.PlayerState.ENDED
    ) {
        resumeMusicAfterSourceMedia();
    }
}

export function destroyYouTubeEmbedPlayer() {
    if (activePlayer) {
        try {
            activePlayer.destroy();
        } catch {
            /* player may already be detached */
        }
        activePlayer = null;
    }

    const mount = document.getElementById(MOUNT_ID);
    mount?.remove();
}

/**
 * @param {HTMLElement} host
 * @param {string} videoId
 */
export async function mountYouTubeEmbedPlayer(host, videoId) {
    destroyYouTubeEmbedPlayer();

    host.innerHTML = '';
    const mount = document.createElement('div');
    mount.id = MOUNT_ID;
    mount.className = 'event-youtube-embed__frame';
    host.appendChild(mount);

    const YTGlobal = await loadYouTubeIframeApi();
    if (!YTGlobal?.Player || !document.getElementById(MOUNT_ID)) return;

    pauseMusicForSourceMedia();

    activePlayer = new YTGlobal.Player(MOUNT_ID, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
        },
        events: {
            onStateChange: (event) => handlePlayerStateChange(event.data),
        },
    });
}
