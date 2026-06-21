import { parseQuoteListWithRoutes } from './lib/wiki-quote-list-parser.mjs';

const html = `<ul><li><b>Hazard</b>: Alright, doc... diagnose me. I dare ye!</li>
<li><i>(with Mercy on the team):</i>
<ul><li><b>Mercy</b>: <i>*sigh*</i> Whatever your issue is, it seems quite clear I can't treat it.</li>
<li><b>Hazard</b>: What makes you think I'm lookin' for a cure?</li></ul></li>
<li><i>(with Moira on the team):</i>
<ul><li><b>Moira</b>: Sharp spine, dull wit, and chronic overconfidence.</li>
<li><b>Hazard</b>: Pfft! Says the numpty with the nasty hand.</li></ul></li></ul>`;

console.log(JSON.stringify(parseQuoteListWithRoutes(html), null, 2));
