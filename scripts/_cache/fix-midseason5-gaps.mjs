import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { auditPath, ensureAuditWorkspace } from '../lib/auditWorkspace.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../../src/data/registry.cjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');

const { conversations: list } = JSON.parse(fs.readFileSync(absFromPublic(FILES.dialogueTheater.conversations), 'utf8'));

function dump(nameOrPred) {
    const hits = typeof nameOrPred === 'function' ? list.filter(nameOrPred) : list.filter((c) => c.name === nameOrPred);
    for (const c of hits) {
        console.log(`\n==== ${c.name} (${c.id}) era=${JSON.stringify(c.eraName)}`);
        for (const l of c.lines || []) {
            console.log(`  [${l.id.slice(0, 8)}] ${String(l.hero).padEnd(14)} ${JSON.stringify(l.subtitles)}`);
            console.log(`           voice=${l.voice || ''}`);
        }
        if (c.paths?.length) {
            for (const p of c.paths) {
                console.log(`  PATH ${p.label}:`, p.lineIds.map((id) => {
                    const l = c.lines.find((x) => x.id === id);
                    return l ? `${l.hero}` : '?';
                }).join(' → '));
            }
        }
    }
}

dump((c) => /^[0-9]+$/.test(String(c.name)) && ['13', '17', '20', '21', '22', '36', '44'].includes(c.name));
dump('Loving the Bleach look');
dump((c) => /evasive|doctrine|template|Busan/i.test(String(c.name)));

// truncated midseason lines
console.log('\n=== Truncated Midseason subtitles (likely cut) ===');
for (const c of list.filter((x) => /^[0-9]+$/.test(String(x.name)) || String(x.eraName || '').includes('Midseason'))) {
    for (const l of c.lines || []) {
        const s = String(l.subtitles || '');
        if (/(\.\.\.|…)$/.test(s.trim()) || /\b(th|healt|the|a|to|for|and|of|in)$/i.test(s.trim()) || s.length > 90 && !/[.!?…"')]$/.test(s.trim())) {
            console.log(`${c.name} | ${l.hero} | ${JSON.stringify(s)}`);
        }
    }
}

ensureAuditWorkspace();
const snapRoot = auditPath('herovoice-snapshots');
const baseline = fs.readFileSync(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8').trim();
const post = fs.readFileSync(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8').trim();
const added = [];
for (const line of fs.readFileSync(path.join(snapRoot, `diff_${baseline}_vs_${post}`, 'added.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const rel = String(JSON.parse(line).rel || '').replace(/\\/g, '/');
    if (/Jetpack|Wrecking|Roadhog|Lucio|Lúcio|Ana|Doctrine|Juno|D\.Mon/i.test(rel)) added.push(rel);
}
console.log('\n=== Relevant added extract files ===');
for (const rel of added.sort()) console.log(rel);

// list Jetpack Cat MatchTalk new + all meow-like
function listHeroMatchTalk(heroFolder) {
    const root = path.join(EXTRACT, heroFolder);
    if (!fs.existsSync(root)) return [];
    const out = [];
    const walk = (dir) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (/\.ogg$/i.test(ent.name) && /MatchTalk|Chatter/i.test(full)) {
                const rel = path.relative(EXTRACT, full).replace(/\\/g, '/');
                out.push({ rel, isNew: added.includes(rel), name: ent.name });
            }
        }
    };
    walk(root);
    return out;
}

for (const hero of ['Jetpack Cat', 'Wrecking Ball', 'Roadhog', 'Lúcio', 'Lucio', 'Ana', 'Doctrine']) {
    const rows = listHeroMatchTalk(hero).filter((r) => r.isNew || /meow|hamster|Really|Sorry|special|naive|performing|Beirut/i.test(r.name));
    if (!rows.length) continue;
    console.log(`\n=== ${hero} candidates ===`);
    for (const r of rows) console.log((r.isNew ? 'NEW' : 'old'), r.rel);
}
