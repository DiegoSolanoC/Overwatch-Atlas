import fs from 'fs';

const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;
for (const i of [83, 84, 85]) {
  const e = events[i];
  console.log(`\n==== #${i + 1} ${e.name} ====`);
  console.log(String(e.description || '').replace(/<br\s*\/?>/gi, '\n'));
}
