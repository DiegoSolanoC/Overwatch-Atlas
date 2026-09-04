import fs from 'fs';
const events = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events;
for (const i of [104, 105]) {
  const e = events[i];
  console.log('====', i + 1, e.name);
  console.log(String(e.description || '').replace(/<br\s*\/?>/gi, '\n'));
  console.log();
}
