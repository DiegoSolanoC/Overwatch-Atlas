/**
 * Node.js HTTP Server for Overwatch Atlas
 * Handles custom routes and serves static files
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { syncStoryArchivesFromCodexEdges, diffStoryArchivesVsCodex } = require('../scripts/server-bio-codex-sync.js');
const {
    absFromPublic,
    FILES,
    STORY_ARCHIVE_WRITE_FILES,
} = require('./data/registry.cjs');

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

    const outPath = absFromPublic(FILES.eventSystem.timelineEvents);
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

function writeStoryArchiveJson(body, res) {
    const archive = body && typeof body.archive === 'string' ? body.archive.trim() : '';
    const events = Array.isArray(body?.events) ? body.events : null;
    const fileName = STORY_ARCHIVE_WRITE_FILES[archive];
    if (!fileName || !events) {
        sendJson(res, 400, {
            error: 'Expected { archive: "heroes"|"factions"|"npcs"|"locations", events: [...] }',
        });
        return;
    }

    const outPath = path.join(__dirname, 'data', 'story-archive', fileName);
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

    const outPath = absFromPublic(FILES.connectionCodex.codexLabels);
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
            const p = absFromPublic(FILES.eventSystem.timelineEvents);
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
            const p = absFromPublic(FILES.connectionCodex.codexLabels);
            const legacyPath = path.join(__dirname, 'data', 'codex-labels.json');
            let readPath = p;
            try {
                if (!fs.existsSync(p) && fs.existsSync(legacyPath)) {
                    console.warn('[server] GET /api/codex: using legacy path', legacyPath);
                    readPath = legacyPath;
                }
                const data = JSON.parse(fs.readFileSync(readPath, 'utf8'));
                if (Array.isArray(data)) {
                    sendJson(res, 200, { v: 1, labels: data, nodes: data, edges: [] });
                    return;
                }
                const nodes = Array.isArray(data.nodes) ? data.nodes : (Array.isArray(data.labels) ? data.labels : []);
                const edges = Array.isArray(data.edges) ? data.edges : [];
                sendJson(res, 200, { v: data.v || 2, nodes, edges, labels: nodes });
            } catch (e) {
                console.error('[server] GET /api/codex: failed to read', readPath, e.message);
                sendJson(res, 500, { ok: false, error: 'Failed to read codex labels', path: readPath });
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
    
    // Timeline app: single HTML entry (`index.html`). Legacy `/main*` URLs kept for bookmarks.
    if (
        decodedPath === '/' ||
        decodedPath === '/index' ||
        decodedPath === '/index.html' ||
        decodedPath === '/main' ||
        decodedPath === '/main/' ||
        decodedPath === '/main.html'
    ) {
        serveFile(res, './index.html', 'text/html');
        return;
    }

    // Legacy path compatibility: map old Event Images URLs to archive assets location
    // Requests like /Event%20Images/Foo.png → /src/assets/images/Archive/Events/Foo.png
    if (decodedPath.startsWith('/Event Images/')) {
        const rest = decodedPath.substring('/Event Images/'.length);
        decodedPath = '/src/assets/images/Archive/Events/' + rest;
    }

    // Old direct event image URLs (pre–Archive data layout)
    if (decodedPath.startsWith('/assets/images/events/')) {
        const rest = decodedPath.substring('/assets/images/events/'.length);
        decodedPath = '/src/assets/images/Archive/Events/' + rest;
    }

    // Legacy: root /assets/* now lives under /src/assets/*
    if (decodedPath.startsWith('/assets/')) {
        decodedPath = '/src' + decodedPath;
    }

    // Legacy URLs (older HTML / bookmarks)
    if (decodedPath === '/manifest.json') {
        decodedPath = '/src/data/platform/manifest.json';
    }
    if (decodedPath === '/script.js') {
        decodedPath = '/src/script.js';
    }

    // Legacy image paths (folder renames: Archive, Filters, Categories, patterns, favicon)
    if (decodedPath.startsWith('/src/assets/images/Archive%20data/')) {
        decodedPath = '/src/assets/images/Archive/' + decodedPath.slice('/src/assets/images/Archive%20data/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/Archive data/')) {
        decodedPath = '/src/assets/images/Archive/' + decodedPath.slice('/src/assets/images/Archive data/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/data/')) {
        decodedPath = '/src/assets/images/Archive/Categories/' + decodedPath.slice('/src/assets/images/data/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/heroes/')) {
        decodedPath = '/src/assets/images/Filters/Heroes/' + decodedPath.slice('/src/assets/images/heroes/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/factions/')) {
        decodedPath = '/src/assets/images/Filters/Factions/' + decodedPath.slice('/src/assets/images/factions/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/npcs/')) {
        decodedPath = '/src/assets/images/Filters/NPCs/' + decodedPath.slice('/src/assets/images/npcs/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/flags/')) {
        decodedPath = '/src/assets/images/Filters/Flags/' + decodedPath.slice('/src/assets/images/flags/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/pattern/')) {
        decodedPath = '/src/assets/images/Background Pattern/' + decodedPath.slice('/src/assets/images/pattern/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/world/')) {
        decodedPath = '/src/assets/images/World%20View/' + decodedPath.slice('/src/assets/images/world/'.length);
    }
    // Legacy lowercase / mixed-case image folder names → Title Case on disk
    const imageFolderLegacyRewrites = [
        ['/src/assets/images/icons/', '/src/assets/images/Icons/'],
        ['/src/assets/images/maps/', '/src/assets/images/Maps/'],
        ['/src/assets/images/misc/', '/src/assets/images/Misc/'],
        ['/src/assets/images/music/', '/src/assets/images/Music/'],
        ['/src/assets/images/menu/', '/src/assets/images/Menu/'],
        ['/src/assets/images/Background pattern/', '/src/assets/images/Background Pattern/'],
        ['/src/assets/images/Archive/events/', '/src/assets/images/Archive/Events/'],
        ['/src/assets/images/Archive/NPCS/', '/src/assets/images/Archive/NPCs/'],
        ['/src/assets/images/Filters/heroes/', '/src/assets/images/Filters/Heroes/'],
        ['/src/assets/images/Filters/factions/', '/src/assets/images/Filters/Factions/'],
        ['/src/assets/images/Filters/npcs/', '/src/assets/images/Filters/NPCs/'],
        ['/src/assets/images/Filters/flags/', '/src/assets/images/Filters/Flags/'],
    ];
    for (const [from, to] of imageFolderLegacyRewrites) {
        if (decodedPath.startsWith(from)) {
            decodedPath = to + decodedPath.slice(from.length);
        }
    }
    if (decodedPath === '/src/assets/images/Icons/Icon.png') {
        decodedPath = '/src/assets/images/Website%20Logo.png';
    }

    // Legacy flat `maps/` layout → subfolders (Earth Textures for palette MAPs; Utility for normal map)
    if (
        decodedPath === '/src/assets/images/Maps/MAP Normal.png' ||
        decodedPath === '/src/assets/images/Maps/Earth Textures/MAP Normal.png'
    ) {
        decodedPath = '/src/assets/images/Maps/Utility/MAP Normal.png';
    } else if (decodedPath.startsWith('/src/assets/images/Maps/MAP ')) {
        decodedPath = '/src/assets/images/Maps/Earth Textures/MAP ' + decodedPath.slice('/src/assets/images/Maps/MAP '.length);
    }
    if (decodedPath === '/src/assets/images/Maps/Alpha.png') {
        decodedPath = '/src/assets/images/Maps/Utility/Alpha.png';
    }
    if (decodedPath === '/src/assets/images/Maps/Gradient.png') {
        decodedPath = '/src/assets/images/Maps/Utility/Gradient.png';
    }
    if (decodedPath.startsWith('/src/assets/images/Maps/Cloud Map')) {
        decodedPath = '/src/assets/images/Maps/Cloud Textures/' + decodedPath.slice('/src/assets/images/Maps/'.length);
    }
    if (decodedPath.startsWith('/src/assets/images/Maps/Pattern ')) {
        decodedPath = '/src/assets/images/Maps/Pattern Overlay/Pattern ' + decodedPath.slice('/src/assets/images/Maps/Pattern '.length);
    }

    // Legacy flat `misc/` layout → Celestial Panels / UI / Website Icons
    const miscToCelestial = ['Moon.png', 'Mars.png', 'Orbit.png', 'Star.png'];
    for (const leaf of miscToCelestial) {
        if (decodedPath === `/src/assets/images/Misc/${leaf}`) {
            decodedPath = `/src/assets/images/Misc/Celestial Panels/${leaf}`;
            break;
        }
    }
    if (decodedPath === '/src/assets/images/Misc/Website.png' || decodedPath === '/src/assets/images/Misc/Website Crimson.png' || decodedPath === '/src/assets/images/Misc/Website Nulled.png') {
        const leaf = decodedPath.slice('/src/assets/images/Misc/'.length);
        decodedPath = '/src/assets/images/Misc/Website Icons/' + leaf;
    }
    const miscUiLeaves = [
        'Badge Underline.png',
        'Border.png',
        'Controller Border.png',
        'Cut Panel Border.png',
        'Dock Border.png',
        'Drag Border.png',
        'Mirrored Cut Panel Border.png',
        'Mirrored Middle Panel Border.png',
        'Mirrored Panel Border.png',
        'Panel Border.png',
    ];
    for (const leaf of miscUiLeaves) {
        if (decodedPath === `/src/assets/images/Misc/${leaf}`) {
            decodedPath = `/src/assets/images/Misc/UI/${leaf}`;
            break;
        }
    }
    if (decodedPath === '/src/assets/images/Misc/loading.gif') {
        decodedPath = '/src/assets/images/Misc/GIFs/loading.gif';
    }
    if (decodedPath === '/src/assets/images/Misc/loading asset.gif') {
        decodedPath = '/src/assets/images/Misc/GIFs/loading asset.gif';
    }

    const iconsRoot = '/src/assets/images/Icons/';
    if (decodedPath.startsWith(iconsRoot)) {
        if (decodedPath.startsWith(iconsRoot + 'Mode icons/')) {
            decodedPath = iconsRoot + 'Mode Icons/' + decodedPath.slice((iconsRoot + 'Mode icons/').length);
        }
        if (decodedPath === iconsRoot + 'Filter Icons/Image Display Icon.png') {
            decodedPath = iconsRoot + 'Utility Icons/Image Display Icon.png';
        }
        if (decodedPath === iconsRoot + 'Mode Icons/Music Icon.png') {
            decodedPath = iconsRoot + 'Music Icons/Music Icon.png';
        }
    }

    // Legacy flat `icons/` layout → category subfolders
    const iconLegacyToSubfolder = [
        ['Arrow Icon.png', 'Utility Icons'],
        ['Back Arrow.png', 'Utility Icons'],
        ['Double Arrow.png', 'Utility Icons'],
        ['Page Icon.png', 'Utility Icons'],
        ['Image Display Icon.png', 'Utility Icons'],
        ['Blue Palette Icon.png', 'Palette Icons'],
        ['Dark Palette Icon.png', 'Palette Icons'],
        ['Red Palette Icon.png', 'Palette Icons'],
        ['Purple Palette Icon.png', 'Palette Icons'],
        ['Playing Icon.png', 'Music Icons'],
        ['Pause Icon.png', 'Music Icons'],
        ['Play Icon.png', 'Music Icons'],
        ['Skip Icon.png', 'Music Icons'],
        ['Unmuted Icon.png', 'Music Icons'],
        ['Muted Icon.png', 'Music Icons'],
        ['Loop Icon.png', 'Music Icons'],
        ['Shuffle Icon.png', 'Music Icons'],
        ['Music Icon.png', 'Music Icons'],
        ['Filter Icon.png', 'Filter Icons'],
        ['Heroes Icon.png', 'Filter Icons'],
        ['Factions Icon.png', 'Filter Icons'],
        ['NPC Icon.png', 'Filter Icons'],
        ['Location Icon.png', 'Filter Icons'],
        ['Clear Filter Icon.png', 'Filter Icons'],
        ['Confirm Filter Icon.png', 'Filter Icons'],
        ['Empty Filter Icon.png', 'Filter Icons'],
        ['Rotation Icon.png', 'Worldview Icons'],
        ['Train Icon.png', 'Worldview Icons'],
        ['Weather Icon.png', 'Worldview Icons'],
        ['Lighting Icon.png', 'Worldview Icons'],
        ['Switch to Flat Icon.png', 'Worldview Icons'],
        ['Switch to Globe Icon.png', 'Worldview Icons'],
        ['Palette Icon.png', 'Mode Icons'],
        ['Timeline Icon.png', 'Mode Icons'],
        ['Codex Icon.png', 'Mode Icons'],
        ['Story Icon.png', 'Mode Icons'],
        ['Event Manager Icon.png', 'Mode Icons'],
        ['Home Button.png', 'Mode Icons'],
    ];
    const iconsLegacyPrefix = iconsRoot;
    if (decodedPath.startsWith(iconsLegacyPrefix)) {
        const iconsRest = decodedPath.slice(iconsLegacyPrefix.length);
        if (iconsRest.indexOf('/') === -1) {
            for (const [fileLeaf, sub] of iconLegacyToSubfolder) {
                if (iconsRest === fileLeaf) {
                    decodedPath = `${iconsLegacyPrefix}${sub}/${fileLeaf}`;
                    break;
                }
            }
        }
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
    console.log(`  - http://localhost:${PORT}/            → index.html (default; /main* aliases same)`);
    console.log(`  - http://localhost:${PORT}/index.html → index.html`);
    console.log(`  - http://localhost:${PORT}/main.html → index.html (legacy)`);
    console.log(`  - http://localhost:${PORT}/test      → test.html`);
    console.log(`  - http://localhost:${PORT}/test.html → test.html`);
    console.log(`  - http://localhost:${PORT}/api/events → GET/POST events.json`);
    console.log(`  - http://localhost:${PORT}/api/story-archive → POST story-archive-*.json (Heroes/Factions/NPCs/Locations)`);
    console.log(`  - http://localhost:${PORT}/api/codex → GET/POST codex-labels.json`);
    console.log(`\nPress Ctrl+C to stop the server\n`);
});

