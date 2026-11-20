import fs from 'fs';import http from 'http';import path from 'path';import { fileURLToPath } from 'url';const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'atlas-ui-tweaks-from-chrome.json');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function cdpEval(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('open', () => {
      const send = (method, params = {}) => {
        const msgId = ++id;
        return new Promise((res, rej) => {
          pending.set(msgId, { res, rej });
          ws.send(JSON.stringify({ id: msgId, method, params }));
        });
      };
      (async () => {
        try {
          await send('Runtime.enable');
          const result = await send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
          });
          resolve(result);
          ws.close();
        } catch (err) {
          reject(err);
          ws.close();
        }
      })();
    });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
    ws.addEventListener('error', reject);
  });
}

const tabs = await getJson('http://127.0.0.1:9333/json/list');
const page = tabs.find((t) => t.type === 'page' && String(t.url).includes('localhost:8000'));
if (!page?.webSocketDebuggerUrl) {
  console.error('No localhost:8000 page found');
  process.exit(1);
}

const expr = `(() => {
  const keys = [
    'atlas.headerTitleBadge.tweak.v7',
    'atlas.headerSides.tweak.v1',
    'atlas.sidePanelsTrap.tweak.v2',
  ];
  const out = { version: 1, badge: null, sides: null, panels: null };
  const map = {
    'atlas.headerTitleBadge.tweak.v7': 'badge',
    'atlas.headerSides.tweak.v1': 'sides',
    'atlas.sidePanelsTrap.tweak.v2': 'panels',
  };
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      out[map[k]] = raw ? JSON.parse(raw) : null;
    } catch (e) {
      out[map[k]] = null;
    }
  }
  return out;
})()`;

const result = await cdpEval(page.webSocketDebuggerUrl, expr);
const value = result?.result?.value;
if (!value) {
  console.error('CDP evaluate failed', JSON.stringify(result, null, 2));
  process.exit(1);
}
fs.writeFileSync(outPath, JSON.stringify(value, null, 2));
console.log('badge', value.badge ? 'OK' : 'MISSING');
console.log('sides', value.sides ? 'OK' : 'MISSING');
console.log('panels', value.panels ? 'OK' : 'MISSING');
console.log('wrote', outPath);
