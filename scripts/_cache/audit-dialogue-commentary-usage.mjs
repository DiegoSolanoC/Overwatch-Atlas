/**
 * Audit: which Dialogue Theater *dialogue* entries are cited in timeline
 * event commentary (skip chatters).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

const CHATTER_SEP = ' · ';

function normalizeForPredictiveMatch(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function looksLikeChatterCommentaryName(name) {
    return String(name || '').trim().includes(CHATTER_SEP);
}

function isChatterRow(row) {
    const t = String(row?.entryType || '').trim().toLowerCase();
    return t === 'chatter' || t === 'chatters';
}

function getEntries(obj) {
    const raw = obj?.commentary;
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        if (typeof item === 'string') {
            const name = item.trim();
            if (name) out.push({ name });
            continue;
        }
        if (!item || typeof item !== 'object') continue;
        const name = String(item.name || '').trim();
        const theaterId = String(item.theaterId || item.conversationId || '').trim();
        if (!name && !theaterId) continue;
        /** @type {{ name: string, theaterId?: string, lineId?: string }} */
        const e = { name: name || theaterId };
        if (theaterId) e.theaterId = theaterId;
        const lineId = String(item.lineId || '').trim();
        if (lineId) e.lineId = lineId;
        out.push(e);
    }
    return out;
}

const events = JSON.parse(
    readFileSync(join(root, 'src/data/event-system/timeline-events.json'), 'utf8'),
).events;
const conversations = JSON.parse(
    readFileSync(join(root, 'src/data/dialogue-theater/conversations.json'), 'utf8'),
).conversations;

const dialogues = conversations.filter((r) => !isChatterRow(r));
const chatters = conversations.filter((r) => isChatterRow(r));
const chatterIds = new Set(chatters.map((c) => c.id));

const byId = new Map(dialogues.map((d) => [d.id, d]));
/** @type {Map<string, typeof dialogues>} */
const byName = new Map();
for (const d of dialogues) {
    const n = normalizeForPredictiveMatch(d.name);
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(d);
}

const usedIds = new Set();
/** @type {{ eventName: string, where: string, name: string, theaterId: string }[]} */
const commentaryRefs = [];
/** @type {{ eventName: string, where: string, name: string, theaterId: string, reason: string }[]} */
const unresolved = [];
let chatterSkipped = 0;
let totalDialogueCommentarySlots = 0;

/**
 * @param {{ name: string, theaterId?: string }} entry
 * @param {string} eventName
 * @param {string} where
 */
function consider(entry, eventName, where) {
    const name = String(entry.name || '').trim();
    const tid = String(entry.theaterId || '').trim();

    if (name && looksLikeChatterCommentaryName(name)) {
        chatterSkipped += 1;
        return;
    }
    if (tid && chatterIds.has(tid)) {
        chatterSkipped += 1;
        return;
    }

    totalDialogueCommentarySlots += 1;
    commentaryRefs.push({ eventName, where, name, theaterId: tid });

    if (tid && byId.has(tid)) {
        usedIds.add(tid);
        return;
    }

    const nn = normalizeForPredictiveMatch(name);
    if (nn && byName.has(nn)) {
        for (const d of byName.get(nn)) usedIds.add(d.id);
        return;
    }

    if (tid && !byId.has(tid)) {
        unresolved.push({
            eventName,
            where,
            name,
            theaterId: tid,
            reason: 'theaterId not in dialogues',
        });
    } else if (name) {
        unresolved.push({
            eventName,
            where,
            name,
            theaterId: tid,
            reason: 'name not matched to dialogue',
        });
    }
}

for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const ename = event.name || `event#${i}`;
    for (const e of getEntries(event)) consider(e, ename, 'root');
    const variants = Array.isArray(event.variants) ? event.variants : [];
    for (let v = 0; v < variants.length; v += 1) {
        for (const e of getEntries(variants[v])) consider(e, ename, `variant:${v}`);
    }
}

const unused = dialogues
    .filter((d) => !usedIds.has(d.id))
    .map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        eraName: d.eraName || '',
        tags: Array.isArray(d.tags) ? d.tags.join(', ') : '',
    }))
    .sort((a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }),
    );

const used = dialogues.filter((d) => usedIds.has(d.id));

const report = {
    dialogueTotal: dialogues.length,
    chatterTotal: chatters.length,
    usedCount: used.length,
    unusedCount: unused.length,
    usedActive: used.filter((d) => d.status === 'active').length,
    unusedActive: unused.filter((d) => d.status === 'active').length,
    unusedRemoved: unused.filter((d) => d.status === 'removed').length,
    dialogueCommentarySlots: totalDialogueCommentarySlots,
    chatterCommentarySkipped: chatterSkipped,
    unresolvedCount: unresolved.length,
    eventsTotal: events.length,
    eventsWithAnyCommentary: events.filter((ev) => {
        if (getEntries(ev).length) return true;
        return (ev.variants || []).some((v) => getEntries(v).length);
    }).length,
};

mkdirSync(__dirname, { recursive: true });
writeFileSync(
    join(__dirname, 'unused-dialogues-commentary.json'),
    JSON.stringify({ report, unused, unresolved }, null, 2),
);
writeFileSync(
    join(__dirname, 'unused-dialogues-commentary.txt'),
    unused
        .map(
            (d, i) =>
                `${String(i + 1).padStart(4, ' ')}. ${d.name}${
                    d.status !== 'active' ? ` [${d.status}]` : ''
                }`,
        )
        .join('\n') + '\n',
);
writeFileSync(
    join(__dirname, 'used-dialogues-commentary.txt'),
    used
        .slice()
        .sort((a, b) =>
            String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }),
        )
        .map((d, i) => `${String(i + 1).padStart(4, ' ')}. ${d.name}`)
        .join('\n') + '\n',
);

console.log(JSON.stringify(report, null, 2));
console.log(`Unused list: scripts/_cache/unused-dialogues-commentary.txt (${unused.length})`);
if (unresolved.length) {
    console.log('Unresolved sample:', unresolved.slice(0, 15));
}
