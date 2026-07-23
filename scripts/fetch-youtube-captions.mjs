#!/usr/bin/env node
/**
 * Fetch YouTube timed captions for a video and write JSON.
 * Usage: node scripts/fetch-youtube-captions.mjs VIDEO_ID
 */
import fs from 'node:fs/promises';

const videoId = process.argv[2] || 'ehYZUjeyAeQ';
const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

const html = await fetch(watchUrl, {
    headers: {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    },
}).then((r) => r.text());

const captionTracksMatch = html.match(/"captionTracks":(\[.*?\])/);
if (!captionTracksMatch) {
    console.error('No captionTracks found in page HTML');
    // fallback: try player response
    const pr = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (pr) {
        const json = JSON.parse(pr[1]);
        const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        console.log('tracks from playerResponse', tracks?.length || 0);
        if (tracks?.[0]?.baseUrl) {
            await dumpCaptions(tracks[0].baseUrl);
            process.exit(0);
        }
    }
    process.exit(1);
}

const tracks = JSON.parse(captionTracksMatch[1].replace(/\\u0026/g, '&'));
console.log(
    'tracks:',
    tracks.map((t) => `${t.languageCode}/${t.kind || 'manual'}`).join(', '),
);
const preferred =
    tracks.find((t) => t.languageCode === 'en' && t.kind !== 'asr') ||
    tracks.find((t) => t.languageCode === 'en') ||
    tracks[0];

await dumpCaptions(preferred.baseUrl.replace(/\\u0026/g, '&'));

async function dumpCaptions(baseUrl) {
    const clean = baseUrl.replace(/\\u0026/g, '&');
    for (const fmt of ['srv3', 'vtt', 'ttml', 'json3']) {
        const url = new URL(clean);
        url.searchParams.set('fmt', fmt);
        const res = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
        });
        const text = await res.text();
        console.log(`fmt=${fmt} status=${res.status} bytes=${text.length}`);
        if (!res.ok || !text.trim()) continue;

        let events = [];
        if (fmt === 'json3') {
            try {
                const data = JSON.parse(text);
                events = (data.events || [])
                    .filter((e) => e.segs)
                    .map((e) => ({
                        startMs: e.tStartMs || 0,
                        durationMs: e.dDurationMs || 0,
                        text: e.segs
                            .map((s) => s.utf8 || '')
                            .join('')
                            .replace(/\n/g, ' ')
                            .trim(),
                    }))
                    .filter((e) => e.text);
            } catch {
                continue;
            }
        } else if (fmt === 'vtt') {
            events = parseVtt(text);
        } else if (fmt === 'srv3') {
            events = parseSrv3(text);
        } else {
            continue;
        }

        if (!events.length) continue;
        const out = `scripts/_cache/youtube-${videoId}-captions.json`;
        await fs.mkdir('scripts/_cache', { recursive: true });
        await fs.writeFile(out, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
        console.log(`Wrote ${events.length} caption cues → ${out}`);
        return;
    }
    throw new Error('Could not download captions in any format');
}

function parseVtt(text) {
    const cues = [];
    const blocks = text.replace(/\r/g, '').split(/\n\n+/);
    for (const block of blocks) {
        const lines = block.split('\n').filter(Boolean);
        const timeLine = lines.find((l) => l.includes('-->'));
        if (!timeLine) continue;
        const [startRaw] = timeLine.split('-->');
        const startMs = vttTimeToMs(startRaw.trim());
        const textLines = lines.filter((l) => !l.includes('-->') && !/^\d+$/.test(l));
        const cueText = textLines.join(' ').replace(/<[^>]+>/g, '').trim();
        if (cueText) cues.push({ startMs, durationMs: 0, text: cueText });
    }
    return cues;
}

function parseSrv3(xml) {
    const cues = [];
    const re = /<p[^>]*t="(\d+)"[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = re.exec(xml))) {
        const startMs = Number(match[1]) || 0;
        const text = match[2]
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
        if (text) cues.push({ startMs, durationMs: 0, text });
    }
    return cues;
}

function vttTimeToMs(value) {
    const parts = value.split(':');
    if (parts.length === 3) {
        const [h, m, s] = parts;
        return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
    }
    if (parts.length === 2) {
        const [m, s] = parts;
        return (Number(m) * 60 + Number(s)) * 1000;
    }
    return 0;
}
