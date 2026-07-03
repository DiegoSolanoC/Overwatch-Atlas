/**
 * Parse YouTube watch / share / embed / shorts URLs into a video id.
 * @param {string} url
 * @returns {string}
 */
export function parseYouTubeVideoId(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

        if (host === 'youtu.be') {
            return parsed.pathname.replace(/^\//, '').split('/')[0] || '';
        }

        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
            const parts = parsed.pathname.split('/').filter(Boolean);
            if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
                return parts[1] || '';
            }
            return parsed.searchParams.get('v') || '';
        }
    } catch {
        /* fall through to regex */
    }

    const match = raw.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : '';
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isYouTubeSourceUrl(url) {
    return Boolean(parseYouTubeVideoId(url));
}

/**
 * @param {string} videoId
 * @returns {string}
 */
export function youTubeEmbedUrl(videoId) {
    const id = String(videoId || '').trim();
    if (!id) return '';
    const params = new URLSearchParams({
        autoplay: '1',
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
        enablejsapi: '1',
        origin: typeof window !== 'undefined' ? window.location.origin : '',
    });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}
