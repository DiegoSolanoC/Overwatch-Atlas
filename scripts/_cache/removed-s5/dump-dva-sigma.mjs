import fs from 'fs';
const vtt = fs.readFileSync('scripts/_cache/removed-s5/yt-qIJz7O5ZF_E.en.vtt', 'utf8');
function parseTs(ts) {
    const m = String(ts).trim().match(/^(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?$/);
    if (!m) {
        const s = String(ts).match(/^(\d+):(\d+)$/);
        return s ? Number(s[1]) * 60 + Number(s[2]) : 0;
    }
    return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4] || 0) / 1000;
}
function dump(lo, hi, label) {
    console.log('====', label);
    const seen = new Set();
    for (const block of vtt.split(/\n\n+/)) {
        const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
        const ti = lines.findIndex((l) => l.includes('-->'));
        if (ti < 0) continue;
        const [a] = lines[ti].split('-->').map((s) => s.trim().split(' ')[0]);
        const t = parseTs(a);
        if (t >= lo && t <= hi) {
            const body = lines
                .slice(ti + 1)
                .join(' ')
                .replace(/<[^>]+>/g, '')
                .replace(/&gt;/g, '>')
                .trim();
            if (seen.has(body)) continue;
            seen.add(body);
            console.log(t.toFixed(1), body.slice(0, 120));
        }
    }
}
dump(150, 188, 'Vendetta & D.Va');
dump(502, 559, 'Vendetta & Sigma');
