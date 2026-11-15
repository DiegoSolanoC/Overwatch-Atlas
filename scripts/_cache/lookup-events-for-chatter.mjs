import fs from 'node:fs';

const events = JSON.parse(
    fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;

const needles = [
    'Grave Devotion',
    "Life's Battery",
    'Cost of Life',
    'Masterpiece',
    "Wolf's Mouth",
    'Final Verdict',
    'All That Follows',
    'Terms of Justice',
    'Bastet',
    'Cat Training',
    'Fire Star',
    'Partnership',
    'Vested Interests',
    'Reign of Talon',
    'A New Empire',
    'Lost Family',
    'Duty Calls',
    'Eye of Horus',
    'Free the Phreaks',
    'Reconciliation',
    'Jetpack',
    'Growing Pains',
    'Helix',
    'Enhanced Soldier',
    'Deliverance',
    'Doctrine',
    'Emre',
    'Vendetta',
    'Marzia',
    'Juno',
    'Fika',
    'Wuyang',
    'Niran',
    'Domina',
    'Dorothy',
    'astronaut',
    'Icarus',
    'Ogundimu',
    'Elaine',
    'Busan',
    'MEKA',
    'D.Mon',
    'Hashimoto',
    'Widow',
    'Sojourn',
    'Gibraltar',
    'Sending a Message',
    'Closed Fist',
    'Water Fighter',
    'Against the Tide',
    'Zero Hour',
    'New Heights',
    'Summit Breach',
    'Crossroads',
];

for (const n of needles) {
    const hits = [];
    events.forEach((e, i) => {
        const blob = `${e.name} ${e.description || ''} ${(e.sources || []).map((s) => s.text || '').join(' ')}`;
        if (new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(blob)) {
            hits.push(`#${i + 1} p${Math.floor(i / 10) + 1} ${e.name}`);
        }
    });
    console.log(`\n[${n}] ${hits.length}`);
    for (const h of hits.slice(0, 8)) console.log(' ', h);
}
