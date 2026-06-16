import fs from 'fs';

const { events } = JSON.parse(
    fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
);

const names = [
    'Resource Management', 'Hostage', 'When Dragons Fall', 'The Oslo Attack', 'Ecological Initiative',
    'Biolight', 'Black Ops', 'Building Coalitions', 'Gwishin', "Mother's Guidance",
    'The Scourge of Numbani', 'Takeover', 'Deep Rising', 'Early Missions', 'The Original Strike Team',
    'Dead Gods', 'To Hell With Them', 'The Battle of the Bridges', 'Operation White Dome',
    'Wuxing University', 'Failure at Sea', 'Uneasy Alliance', 'Cleaning the leftovers',
    'The Ironclad Guild', 'Super Soldiers', 'The Lagos Attack', 'The Caribbean Coalition',
    'One with the Iris', 'Shimada Takedown', 'Retribution', 'Chronal Dissociation',
    'The Awakening', 'Force the Sun to Set', 'Playing God', 'Vancouver Floods',
    'Knights in Shining Armor', 'Defense Network', 'The Heroic Five', 'Capturing a God',
    'The Skycannon', 'Bombardment', 'Australian Liberation', 'Liao\'s Renaissance',
];

for (const n of names) {
    const e = events.find((x) => x.name === n);
    if (!e) {
        console.log('MISSING', n);
        continue;
    }
    const d = (e.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`\n=== #${events.indexOf(e) + 1} ${e.name} (${e.yearStart}) @ ${e.cityDisplayName}`);
    console.log(d);
}
