/**
 * One-shot: stamp theaterId/lineId on all story commentary and refresh drifted labels.
 * Run: node scripts/repair-story-commentary-matches.mjs
 */
import fs from 'fs';
import { pathToFileURL } from 'url';

const mod = await import(
    pathToFileURL(
        `${process.cwd()}/src/features/system-interface/interface-shared/storyEventCommentaryTheater.js`,
    ).href,
);

const eventsPath = 'src/data/event-system/timeline-events.json';
const data = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
const list = JSON.parse(
    fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
).conversations;
const events = data.events || [];

let stamped = 0;
let refreshed = 0;
let removedEmpty = 0;
const failed = [];

for (const ev of events) {
    if (!Array.isArray(ev.commentary)) continue;
    const next = [];
    for (const raw of ev.commentary) {
        let entry =
            typeof raw === 'string'
                ? { name: raw.trim() }
                : raw && typeof raw === 'object'
                  ? { ...raw }
                  : null;
        if (!entry) continue;
        entry.name = String(entry.name || '').trim();
        if (!entry.name && !entry.theaterId) {
            removedEmpty += 1;
            continue;
        }

        const target = mod.resolveStoryCommentaryTheaterTarget(entry, list);
        if (!target?.conversation?.id) {
            failed.push({ event: ev.name, name: entry.name, label: entry.label || '' });
            next.push(entry);
            continue;
        }

        const before = JSON.stringify(entry);
        entry.theaterId = String(target.conversation.id);
        if (target.kind === 'chatter-line' && target.line?.id) {
            entry.lineId = String(target.line.id);
            const live = mod.buildChatterCommentaryLabel(
                target.line.hero || target.conversation.name,
                target.line.subtitles,
                target.line.disclaimer,
            );
            if (live) entry.name = live;
        } else if (target.kind === 'dialogue') {
            delete entry.lineId;
            if (target.conversation.name) entry.name = String(target.conversation.name);
        } else if (target.kind === 'chatter-hub') {
            delete entry.lineId;
            if (target.conversation.name) entry.name = String(target.conversation.name);
        }
        const after = JSON.stringify(entry);
        if (before !== after) {
            if (!String(before).includes('"theaterId"')) stamped += 1;
            else refreshed += 1;
        }
        next.push(entry);
    }
    ev.commentary = next;
}

fs.writeFileSync(eventsPath, `${JSON.stringify(data, null, 2)}\n`);

let noChip = 0;
let total = 0;
const stillBroken = [];
for (const ev of events) {
    for (const entry of ev.commentary || []) {
        total += 1;
        const target = mod.resolveStoryCommentaryTheaterTarget(entry, list);
        const speakers = mod.speakersForCommentaryTheaterTarget(target);
        if (!target || !speakers.length) {
            noChip += 1;
            stillBroken.push({
                event: ev.name,
                name: entry.name,
                label: entry.label || '',
                reason: !target ? 'no-resolve' : 'no-speakers',
            });
        }
    }
}

console.log(
    JSON.stringify(
        {
            stamped,
            refreshed,
            removedEmpty,
            failedDuringStamp: failed,
            total,
            noChip,
            stillBroken,
            adawe: events.find((e) => e.name === 'Adawe Departs')?.commentary,
            intervention: events.find((e) => e.name === 'Intervention')?.commentary,
        },
        null,
        2,
    ),
);
