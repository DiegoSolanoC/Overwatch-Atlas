/**
 * Node.js HTTP Server for Overwatch Atlas
 * Handles custom routes and serves static files
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { syncStoryArchivesFromCodexEdges, diffStoryArchivesVsCodex } = require('./server-bio-codex-sync.js');

const PORT = 8000;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.glb': 'model/gltf-binary',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

function sendJson(res, code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2) + '\n');
}

function readJsonBody(req, res, cb) {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
        // Basic size guard (10MB)
        if (body.length > 10 * 1024 * 1024) {
            sendJson(res, 413, { error: 'Payload too large' });
            req.destroy();
        }
    });
    req.on('end', () => {
        try {
            const parsed = body ? JSON.parse(body) : null;
            cb(parsed);
        } catch (e) {
            sendJson(res, 400, { error: 'Invalid JSON' });
        }
    });
}

function writeEventsJson(events, res) {
    if (!Array.isArray(events)) {
        sendJson(res, 400, { error: 'Expected { events: [...] } or an array' });
        return;
    }

    const outPath = path.join(__dirname, 'data', 'events.json');
    const payload = { events };
    const json = JSON.stringify(payload, null, 2) + '\n';

    // Atomic write: temp then rename
    const tmpPath = outPath + '.tmp';
    try {
        fs.writeFileSync(tmpPath, json, 'utf8');
        fs.renameSync(tmpPath, outPath);
        sendJson(res, 200, { ok: true, eventsCount: events.length });
    } catch (e) {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
        sendJson(res, 500, { ok: false, error: 'Write failed' });
    }
}

/** Data Archive satellite JSONs (Heroes / Factions / NPCs / Locations) — same shape as shipped files: { events: [...] } */
const STORY_ARCHIVE_WRITE_MAP = {
    heroes: 'story-archive-heroes.json',
    factions: 'story-archive-factions.json',
    npcs: 'story-archive-npcs.json',
    locations: 'story-archive-locations.json',
};

function writeStoryArchiveJson(body, res) {
    const archive = body && typeof body.archive === 'string' ? body.archive.trim() : '';
    const events = Array.isArray(body?.events) ? body.events : null;
    const fileName = STORY_ARCHIVE_WRITE_MAP[archive];
    if (!fileName || !events) {
        sendJson(res, 400, {
            error: 'Expected { archive: "heroes"|"factions"|"npcs"|"locations", events: [...] }',
        });
        return;
    }

    const outPath = path.join(__dirname, 'data', fileName);
    const payload = { events };
    const json = JSON.stringify(payload, null, 2) + '\n';
    const tmpPath = outPath + '.tmp';
    try {
        fs.writeFileSync(tmpPath, json, 'utf8');
        fs.renameSync(tmpPath, outPath);
        sendJson(res, 200, { ok: true, archive, eventsCount: events.length });
    } catch (e) {
        try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (_) {}
        sendJson(res, 500, { ok: false, error: 'Write failed' });
    }
}

function writeCodexStateJson(body, res) {
    let nodes = null;
    let edges = [];
    if (Array.isArray(body)) {
        nodes = body;
    } else if (body && typeof body === 'object') {
        if (Array.isArray(body.nodes)) nodes = body.nodes;
        else if (Array.isArray(body.labels)) nodes = body.labels;
        if (Array.isArray(body.edges)) edges = body.edges;
    }
    if (!Array.isArray(nodes)) {
        sendJson(res, 400, { error: 'Expected { nodes: [...], edges?: [...] } or { labels: [...] }' });
        return;
    }

    const outPath = path.join(__dirname, 'data', 'codex-labels.json');
    const vOut = typeof body.v === 'number' && body.v >= 4 ? body.v : 4;
    const payload = { v: vOut, nodes, edges };
    const json = JSON.stringify(payload, null, 2) + '\n';
    const tmpPath = outPath + '.tmp';
    try {
        fs.writeFileSync(tmpPath, json, 'utf8');
        fs.renameSync(tmpPath, outPath);
        const dataDir = path.join(__dirname, 'data');
        let bio = {};
        try {
            // Always reconcile every entity↔entity edge (not only “new” keys). Otherwise a link
            // already present in codex-labels.json never gets mirrored into satellite archive JSONs.
            bio = syncStoryArchivesFromCodexEdges(dataDir, nodes, edges);
        } catch (syncErr) {
            bio = {
                bioArchiveSync: false,
                bioArchiveError: syncErr && syncErr.message ? syncErr.message : String(syncErr),
            };
        }
        sendJson(res, 200, {
            ok: true,
            nodesCount: nodes.length,
            edgesCount: edges.length,
            ...bio,
        });
    } catch (e) {
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
        sendJson(res, 500, { ok: false, error: 'Write failed' });
    }
}

const server = http.createServer((req, res) => {
    // Parse URL and decode it to handle spaces and special characters
    const parsedUrl = url.parse(req.url, true);
    let decodedPath = decodeURIComponent(parsedUrl.pathname);
    
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${decodedPath}`);
    
    // Handle custom routes
    // Local API: persist events to data/events.json (works only when running this server)
    if (decodedPath === '/api/events') {
        if (req.method === 'GET') {
            const p = path.join(__dirname, 'data', 'events.json');
            try {
                const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                const events = Array.isArray(data) ? data : (Array.isArray(data?.events) ? data.events : []);
                sendJson(res, 200, { events });
            } catch (e) {
                sendJson(res, 500, { error: 'Failed to read events.json' });
            }
            return;
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            readJsonBody(req, res, (body) => {
                const events = Array.isArray(body) ? body : body?.events;
                writeEventsJson(events, res);
            });
            return;
        }

        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    if (decodedPath === '/api/story-archive') {
        if (req.method === 'POST' || req.method === 'PUT') {
            readJsonBody(req, res, (body) => {
                writeStoryArchiveJson(body, res);
            });
            return;
        }
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    if (decodedPath === '/api/codex/bio-sync-preview') {
        if (req.method === 'POST' || req.method === 'PUT') {
            readJsonBody(req, res, (body) => {
                try {
                    let nodes = null;
                    let edges = [];
                    if (Array.isArray(body)) {
                        nodes = body;
                    } else if (body && typeof body === 'object') {
                        if (Array.isArray(body.nodes)) nodes = body.nodes;
                        else if (Array.isArray(body.labels)) nodes = body.labels;
                        if (Array.isArray(body.edges)) edges = body.edges;
                    }
                    if (!Array.isArray(nodes)) {
                        sendJson(res, 400, { ok: false, error: 'Expected { nodes: [...], edges?: [...] }' });
                        return;
                    }
                    const dataDir = path.join(__dirname, 'data');
                    const out = diffStoryArchivesVsCodex(dataDir, nodes, edges);
                    sendJson(res, 200, out);
                } catch (e) {
                    sendJson(res, 500, {
                        ok: false,
                        error: e && e.message ? e.message : String(e),
                    });
                }
            });
            return;
        }

        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    if (decodedPath === '/api/codex') {
        if (req.method === 'GET') {
            const p = path.join(__dirname, 'data', 'codex-labels.json');
            try {
                const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                if (Array.isArray(data)) {
                    sendJson(res, 200, { v: 1, labels: data, nodes: data, edges: [] });
                    return;
                }
                const nodes = Array.isArray(data.nodes) ? data.nodes : (Array.isArray(data.labels) ? data.labels : []);
                const edges = Array.isArray(data.edges) ? data.edges : [];
                sendJson(res, 200, { v: data.v || 2, nodes, edges, labels: nodes });
            } catch (e) {
                sendJson(res, 200, { v: 2, nodes: [], edges: [], labels: [] });
            }
            return;
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            readJsonBody(req, res, (body) => {
                writeCodexStateJson(body, res);
            });
            return;
        }

        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    if (decodedPath === '/test' || decodedPath === '/test/') {
        serveFile(res, './test.html', 'text/html');
        return;
    }
    
    if (decodedPath === '/main' || decodedPath === '/main/' || decodedPath === '/main.html') {
        serveFile(res, './main.html', 'text/html');
        return;
    }
    
    // Default route serves main.html
    if (decodedPath === '/' || decodedPath === '/index' || decodedPath === '/index.html') {
        serveFile(res, './main.html', 'text/html');
        return;
    }

    // Legacy path compatibility: map old Event Images URLs to archive assets location
    // Requests like /Event%20Images/Foo.png → /assets/images/Archive data/events/Foo.png
    if (decodedPath.startsWith('/Event Images/')) {
        const rest = decodedPath.substring('/Event Images/'.length);
        decodedPath = '/assets/images/Archive data/events/' + rest;
    }

    // Old direct event image URLs (pre–Archive data layout)
    if (decodedPath.startsWith('/assets/images/events/')) {
        const rest = decodedPath.substring('/assets/images/events/'.length);
        decodedPath = '/assets/images/Archive data/events/' + rest;
    }
    
    // Serve static files
    let filePath = '.' + decodedPath;
    
    // Security: prevent directory traversal
    if (filePath.includes('..')) {
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<h1>403 - Forbidden</h1>', 'utf-8');
        return;
    }
    
    // Get file extension for MIME type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    serveFile(res, filePath, contentType);
});

function serveFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - Internal Server Error</h1>', 'utf-8');
            }
        } else {
            // Add cache-busting headers for JS files to prevent stale module cache
            const headers = { 'Content-Type': contentType };
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.js') {
                headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                headers['Pragma'] = 'no-cache';
                headers['Expires'] = '0';
            }
            res.writeHead(200, headers);
            res.end(data, 'utf-8');
        }
    });
}

server.listen(PORT, () => {
    console.log(`\n=== Overwatch Atlas Server ===`);
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`\nAvailable routes:`);
    console.log(`  - http://localhost:${PORT}/          → main.html (default)`);
    console.log(`  - http://localhost:${PORT}/main      → main.html`);
    console.log(`  - http://localhost:${PORT}/main.html → main.html`);
    console.log(`  - http://localhost:${PORT}/test      → test.html`);
    console.log(`  - http://localhost:${PORT}/test.html → test.html`);
    console.log(`  - http://localhost:${PORT}/api/events → GET/POST events.json`);
    console.log(`  - http://localhost:${PORT}/api/story-archive → POST story-archive-*.json (Heroes/Factions/NPCs/Locations)`);
    console.log(`  - http://localhost:${PORT}/api/codex → GET/POST codex-labels.json`);
    console.log(`\nPress Ctrl+C to stop the server\n`);
});

