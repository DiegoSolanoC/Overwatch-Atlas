import fs from 'fs';
const e = JSON.parse(
  fs.readFileSync('src/data/event-system/timeline-events.json', 'utf8'),
).events[133];
console.log(e.name);
console.log(String(e.description || '').replace(/<br\s*\/?>/gi, '\n'));
