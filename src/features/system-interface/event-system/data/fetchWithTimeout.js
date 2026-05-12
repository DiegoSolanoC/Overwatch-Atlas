/**
 * Cache-busted fetch with a hard timeout. Shared by all main + satellite archive loads.
 * Adds `v=<now>&_=<random>&nocache=true` to the URL so dev edits never cache-pin.
 *
 * @param {string} url
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<any>}
 */
export function fetchJsonWithTimeout(url, timeoutMs = 10000) {
    const separator = url.includes('?') ? '&' : '?';
    const cacheBuster = `${separator}v=${Date.now()}&_=${Math.random().toString(36).substr(2, 9)}&nocache=true`;
    const fullUrl = url + cacheBuster;
    return Promise.race([
        fetch(fullUrl).then((res) => {
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        }),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${url} took longer than ${timeoutMs}ms`)), timeoutMs)
        ),
    ]);
}
