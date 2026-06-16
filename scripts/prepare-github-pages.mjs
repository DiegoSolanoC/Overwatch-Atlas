/**
 * Copies the static site into _site/ for GitHub Pages, excluding dev-only paths.
 * Run after scripts/generate-manifest.js: npm run build:pages
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_site');

const EXCLUDE_NAMES = new Set([
    '.git',
    '.github',
    'node_modules',
    '_site',
    '.cursor',
    'terminals',
    'scripts',
    'docs',
]);

const MIN_CODEX_SAVE_VERSION = 5;

function shouldCopyName(name) {
    if (EXCLUDE_NAMES.has(name)) return false;
    if (name === '.env' || name === '.env.local') return false;
    return true;
}

function copyRecursive(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const ent of entries) {
        if (!shouldCopyName(ent.name)) continue;
        const from = path.join(srcDir, ent.name);
        const to = path.join(destDir, ent.name);
        if (ent.isDirectory()) {
            copyRecursive(from, to);
        } else if (ent.isSymbolicLink()) {
            continue;
        } else {
            fs.copyFileSync(from, to);
        }
    }
}

function escapeHtmlAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function injectStaticDeployMeta(siteIndex) {
    if (!fs.existsSync(siteIndex)) {
        throw new Error('Missing _site/index.html');
    }
    let html = fs.readFileSync(siteIndex, 'utf8');
    if (!/name=["']timeline-deploy["']/i.test(html)) {
        const marker = '<meta name="timeline-deploy" content="static">';
        if (/<meta\s+charset=/i.test(html)) {
            html = html.replace(/(<meta\s+charset=["']UTF-8["']\s*\/?>)/i, `$1\n    ${marker}`);
        } else {
            html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${marker}`);
        }
    }
    fs.writeFileSync(siteIndex, html, 'utf8');
}

function injectTimelineBundleMeta(siteIndex) {
    const timelinePath = path.join(OUT, 'src', 'data', 'event-system', 'timeline-events.json');
    if (!fs.existsSync(timelinePath)) {
        throw new Error('Missing _site/src/data/event-system/timeline-events.json');
    }
    const data = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
    const events = Array.isArray(data.events) ? data.events : [];
    const count = events.length;
    const lastName = count > 0 ? String(events[count - 1]?.name ?? '').trim() : '';
    const stamp = `${count}:${lastName}`;
    const countMeta = `<meta name="timeline-bundle-events" content="${count}">`;
    const stampMeta = `<meta name="timeline-bundle-stamp" content="${escapeHtmlAttr(stamp)}">`;

    let html = fs.readFileSync(siteIndex, 'utf8');
    html = html.replace(/\s*<meta name=["']timeline-bundle-events["'][^>]*>\s*/gi, '\n');
    html = html.replace(/\s*<meta name=["']timeline-bundle-stamp["'][^>]*>\s*/gi, '\n');

    const anchor = /<meta name=["']timeline-deploy["'][^>]*>/i;
    if (anchor.test(html)) {
        html = html.replace(anchor, (m) => `${m}\n    ${countMeta}\n    ${stampMeta}`);
    } else if (/<meta\s+charset=/i.test(html)) {
        html = html.replace(
            /(<meta\s+charset=["']UTF-8["']\s*\/?>)/i,
            `$1\n    ${countMeta}\n    ${stampMeta}`,
        );
    } else {
        html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${countMeta}\n    ${stampMeta}`);
    }

    fs.writeFileSync(siteIndex, html, 'utf8');
}

function removeDevOnlyArtifacts() {
    const paths = [
        path.join(OUT, 'src', 'server.js'),
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) fs.rmSync(p, { force: true });
    }
}

function validateStaticSite() {
    const errors = [];

    if (!fs.existsSync(path.join(OUT, '.nojekyll'))) {
        errors.push('Missing _site/.nojekyll');
    }

    const siteIndex = path.join(OUT, 'index.html');
    if (!fs.existsSync(siteIndex)) {
        errors.push('Missing _site/index.html');
    } else {
        const html = fs.readFileSync(siteIndex, 'utf8');
        if (!/name=["']timeline-deploy["']/i.test(html)) {
            errors.push('index.html missing <meta name="timeline-deploy" content="static">');
        }
        if (!/name=["']timeline-bundle-stamp["']/i.test(html)) {
            errors.push('index.html missing <meta name="timeline-bundle-stamp" …> (run build:pages)');
        }
        if (!/name=["']timeline-bundle-events["']/i.test(html)) {
            errors.push('index.html missing <meta name="timeline-bundle-events" …> (run build:pages)');
        }
    }

    const timelinePath = path.join(OUT, 'src', 'data', 'event-system', 'timeline-events.json');
    if (!fs.existsSync(timelinePath)) {
        errors.push('Missing _site/src/data/event-system/timeline-events.json');
    } else {
        try {
            const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
            const n = Array.isArray(timeline.events) ? timeline.events.length : 0;
            if (n === 0) errors.push('timeline-events.json has zero events');
        } catch (e) {
            errors.push(`timeline-events.json is not valid JSON: ${e?.message || e}`);
        }
    }

    const codexPath = path.join(OUT, 'src', 'data', 'codex', 'codex-labels.json');
    if (!fs.existsSync(codexPath)) {
        errors.push('Missing _site/src/data/codex/codex-labels.json');
    } else {
        try {
            const codex = JSON.parse(fs.readFileSync(codexPath, 'utf8'));
            const v = typeof codex.v === 'number' ? codex.v : 0;
            if (v < MIN_CODEX_SAVE_VERSION) {
                errors.push(
                    `codex-labels.json v${v} is below v${MIN_CODEX_SAVE_VERSION} (connection metadata requires v5+)`,
                );
            }
            if (!Array.isArray(codex.connections)) {
                errors.push('codex-labels.json missing connections[] array (commit Codex v5 export before deploy)');
            }
            const nodeCount = Array.isArray(codex.nodes) ? codex.nodes.length : 0;
            if (nodeCount === 0) {
                errors.push('codex-labels.json has zero nodes');
            }
        } catch (e) {
            errors.push(`codex-labels.json is not valid JSON: ${e?.message || e}`);
        }
    }

    const manifestPath = path.join(OUT, 'src', 'data', 'platform', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        errors.push('Missing _site/src/data/platform/manifest.json (run generate-manifest first)');
    }

    if (fs.existsSync(path.join(OUT, 'src', 'server.js'))) {
        errors.push('Dev server file should not be published: _site/src/server.js');
    }

    if (errors.length) {
        console.error('GitHub Pages build validation failed:');
        for (const msg of errors) {
            console.error(`  - ${msg}`);
        }
        process.exit(1);
    }
}

function printSummary() {
    const codexPath = path.join(OUT, 'src', 'data', 'codex', 'codex-labels.json');
    const codex = JSON.parse(fs.readFileSync(codexPath, 'utf8'));
    const manifest = JSON.parse(
        fs.readFileSync(path.join(OUT, 'src', 'data', 'platform', 'manifest.json'), 'utf8'),
    );
    const timeline = JSON.parse(
        fs.readFileSync(path.join(OUT, 'src', 'data', 'event-system', 'timeline-events.json'), 'utf8'),
    );
    console.log('GitHub Pages output:', OUT);
    console.log(`  timeline-events.json: ${timeline.events?.length ?? 0} events`);
    console.log(
        `  codex-labels.json: v${codex.v}, ${codex.nodes?.length ?? 0} nodes, `
            + `${codex.edges?.length ?? 0} edges, ${codex.connections?.length ?? 0} connection row(s)`,
    );
    console.log(
        `  manifest: ${manifest.heroes?.length ?? 0} heroes, `
            + `${manifest.factions?.length ?? 0} factions, ${manifest.npcs?.length ?? 0} npcs`,
    );
    console.log('  static deploy meta injected; dev-only paths excluded');
}

fs.rmSync(OUT, { recursive: true, force: true });
copyRecursive(ROOT, OUT);

fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

injectStaticDeployMeta(path.join(OUT, 'index.html'));
injectTimelineBundleMeta(path.join(OUT, 'index.html'));
removeDevOnlyArtifacts();
validateStaticSite();
printSummary();
