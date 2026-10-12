// Builds the game from src/ (code) and assets/ (textures, character meshes, baked lighting).
//   node build.mjs            -> index.html + game.js  (hosted build: GitHub Pages or any static web server)
//   node build.mjs --offline  -> also Last-Drinks-offline.html (one self-contained file you can double-click)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, extname } from 'path';

const shell = readFileSync('src/shell.html', 'utf8');
const css = readFileSync('src/style.css', 'utf8');
const js = readdirSync('src').filter(f => /^\d\d-.*\.js$/.test(f)).sort().map(f => `// ---- src/${f} ----\n` + readFileSync('src/' + f, 'utf8')).join('\n');
const head = shell.replace('/*@CSS@*/', css);
const ver = createHash('sha1').update(js).digest('hex').slice(0, 10);

writeFileSync('game.js', js);
writeFileSync('index.html', head + `<script type="module" src="game.js?v=${ver}"></script>\n</body>\n</html>\n`);
console.log(`index.html + game.js written (${(js.length / 1024).toFixed(0)} KB of code)`);

if (process.argv.includes('--offline')) {
  const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream' };
  const files = {};
  const walk = dir => { if (!existsSync(dir)) return; for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (MIME[extname(f).toLowerCase()]) files[p.slice('assets/'.length).split('\\').join('/')] = `data:${MIME[extname(f).toLowerCase()]};base64,` + readFileSync(p).toString('base64'); } };
  walk('assets');
  const out = head + `<script>window.__ASSETS=${JSON.stringify(files)};</script>\n<script type="module">\n${js}\n</script>\n</body>\n</html>\n`;
  writeFileSync('Last-Drinks-offline.html', out);
  console.log(`Last-Drinks-offline.html written (${(out.length / 1048576).toFixed(1)} MB, ${Object.keys(files).length} embedded assets)`);
}
