/**
 * Web Worker for parsing large Codex JSON without blocking the main thread.
 */

let codexParseWorker = null;

function getCodexParseWorker() {
    if (codexParseWorker) return codexParseWorker;
    const workerCode = `
        self.onmessage = function(e) {
            try {
                const data = JSON.parse(e.data.json);
                self.postMessage({ ok: true, data });
            } catch (err) {
                self.postMessage({ ok: false, error: err.message });
            }
        };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    codexParseWorker = new Worker(URL.createObjectURL(blob));
    return codexParseWorker;
}

export function terminateCodexJsonParseWorker() {
    if (codexParseWorker) {
        codexParseWorker.terminate();
        codexParseWorker = null;
    }
}

/**
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false, error?: string }>}
 */
export function parseCodexJsonInWorker(json) {
    return new Promise((resolve) => {
        const worker = getCodexParseWorker();
        const onMessage = (e) => {
            worker.removeEventListener('message', onMessage);
            if (e.data.ok) {
                resolve({ ok: true, data: e.data.data });
            } else {
                resolve({ ok: false, error: e.data.error });
            }
        };
        worker.addEventListener('message', onMessage);
        worker.postMessage({ json });
    });
}
