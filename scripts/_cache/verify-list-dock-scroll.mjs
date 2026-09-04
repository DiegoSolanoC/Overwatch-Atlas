import fs from 'fs';

const list = fs.readFileSync('src/features/story/story-mode/StoryListDockScroll.js', 'utf8');
const pag = fs.readFileSync(
  'src/features/system-interface/interface-event-slide/standalone-slide/pagination/setupStandalonePagination.js',
  'utf8',
);
const toggle = fs.readFileSync('src/features/story/story-mode/StoryViewToggle.js', 'utf8');

console.log('exports', [...list.matchAll(/export function (\w+)/g)].map((m) => m[1]));
const imp = pag.match(/import \{[\s\S]*?\} from '\.\.\/\.\.\/\.\.\/\.\.\/story\/story-mode\/StoryListDockScroll\.js';/);
console.log(imp ? imp[0] : 'NO IMPORT');
console.log('toggle has scrollStoryListToDockPage', toggle.includes('scrollStoryListToDockPage'));
console.log('pageChange list branch', pag.includes('skipListScroll') && pag.includes('isStoryListViewActive()'));
console.log('slider list branch', pag.includes('scrollStoryListToDockSliderProgress(progress)'));
