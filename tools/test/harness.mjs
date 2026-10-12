// Shared test harness: serves the repo over HTTP, routes three.js CDN to the local copy, boots the game.
import { chromium } from 'playwright';   // npm i playwright (a Chromium is preinstalled at /opt/pw-browsers/chromium in the cloud sandbox)
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';
import path from 'path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SP = process.env.SHOTS || path.join(HERE, 'out') + '/';            // screenshots land here (gitignored)
const T = (process.env.THREE_DIR || path.join(HERE, 'node_modules/three')) + '/';   // npm i three@0.160.0 inside tools/test (the CDN is blocked in the sandbox)
const ROOT = path.resolve(HERE, '../..') + '/';
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.bin': 'application/octet-stream' };
let server;
export function serve(port = 8123) {
  if (server) return;
  server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  }).listen(port);
}
export async function launch({ quality = 'high', file = null, w = 1280, h = 720, port = 8123, venue = null } = {}) {
  serve(port);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('http://localhost') || u.startsWith('file://') || u.startsWith('data:')) return r.continue();
    const m = u.match(/three@0\.160\.0\/(.*)$/);
    if (m) { const p = T + m[1]; if (fs.existsSync(p)) return r.fulfill({ path: p, contentType: 'application/javascript' }); }
    return r.abort();
  });
  await page.addInitScript(([q, v]) => { window.__noDynRes = true; localStorage.setItem('ld_settings', JSON.stringify({ quality: q })); if (v) localStorage.setItem('ld_venue', JSON.stringify(v)); }, [quality, venue]);
  await page.goto(file ? 'file://' + ROOT + file : `http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__ready || window.__bootError, null, { timeout: 240000 });
  const bootErr = await page.evaluate(() => window.__bootError || null);
  const ev = f => page.evaluate(f);
  const shot = async (dir, n) => { fs.mkdirSync(SP + dir, { recursive: true }); await page.waitForTimeout(300); await page.screenshot({ path: SP + dir + '/' + n + '.png', timeout: 240000 }); console.log('shot', n); };
  const startNight = async (diff = 'normal') => {
    await page.click('#btnNew'); await page.click(`.dcard[data-diff=${diff}]`); await page.click('#btnGo');
    await page.waitForTimeout(800); await ev('window.__sim(2)');
    await ev(`document.getElementById('fade').style.transition='none'; document.getElementById('fade').style.opacity=0;`);
  };
  const at = (x, z, yaw, pitch, t = 0.8, level = 0) => ev(`(()=>{ const g=window.__game; g.Game.paused=false; document.getElementById('resume').classList.add('hidden'); document.getElementById('subtitle').innerHTML=''; g.player.level=${level}; g.player.pos.set(${x},0,${z}); g.player.yaw=${yaw}; g.player.pitch=${pitch}; window.__sim(${t}); })()`);
  return { browser, page, errs, ev, shot, startNight, at, bootErr, close: async () => { await browser.close(); } };
}
export function done() { if (server) server.close(); }
