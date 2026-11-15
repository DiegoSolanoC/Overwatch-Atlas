import fs from 'node:fs';

const { conversations: list } = JSON.parse(
    fs.readFileSync('src/data/dialogue-theater/conversations.json', 'utf8'),
);

const batch = [
    'Bad Headlines',
    'Great Potential',
    'Reclaiming Talon',
    'Still Flopping',
    'Fun while it Lasted',
    'Ditching you',
    'Going away for a long time',
    'Dull fangs',
    'Your Hunt ended',
    'Through thick and Thin',
    'Expected of a Child',
    'Seen you Before',
    'View of the Stars',
    'Where to next',
    'Out of this world',
    'Abandoning Projects',
    'Training together',
    'Pierogis',
    'Turned In by Family',
    'Waned over time',
    'Performing',
    'Hope you Might change',
    'Enhanced Soldier Children',
    'Lock them up again',
    'Helix Pair',
    'Call it Even',
    'Not lost on me',
    'Peace breeds Complacency',
    'Letting Doomfist free',
    'Not as Simple as Cartoons',
    'Shore Leave',
    'Inexcusable',
    'Screw Loose',
    'Credibility',
    'Defeat the Robots first',
    'Wisdom of Age',
    'Wisdom to Understand',
    'Can\'t Hack your brain',
    'Never Forget',
    'Reuniting with Family',
    'Unforgiving Nature',
    'Significant Upgrades',
    'Busan was Nice',
    'Hope from our people',
    'Loving the Bleach look',
];

const out = [];
for (const name of batch) {
    const c = list.find((x) => x.name === name);
    if (!c) {
        out.push({ name, missing: true });
        continue;
    }
    out.push({
        name: c.name,
        id: c.id,
        heroes: [...new Set((c.lines || []).map((l) => l.hero))],
        lines: (c.lines || []).map((l) => ({
            hero: l.hero,
            text: String(l.subtitles || ''),
        })),
        paths: (c.paths || []).map((p) => p.label),
    });
}

// Vendetta & Ashe Midseason (cutting ties) — expected but missing
out.unshift({
    name: '(missing) Vendetta & Ashe — cutting ties / Grand Mesa',
    missing: true,
    note: 'Present in Midseason 5 video; not found in theater after audit',
});

fs.writeFileSync(
    'scripts/_cache/midseason5-batch-dialogues.json',
    `${JSON.stringify(out, null, 2)}\n`,
);
console.log('wrote', out.length, 'entries;', out.filter((x) => x.missing).length, 'missing');
