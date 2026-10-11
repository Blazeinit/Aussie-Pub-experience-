// Assembles the single playable file (index.html) from src/.
// Usage: node build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'fs';
const shell = readFileSync('src/shell.html', 'utf8');
const css = readFileSync('src/style.css', 'utf8');
const js = readdirSync('src').filter(f => /^\d\d-.*\.js$/.test(f)).sort().map(f => `// ---- src/${f} ----\n` + readFileSync('src/' + f, 'utf8')).join('\n');
const out = shell.replace('/*@CSS@*/', css) + '<script type="module">\n' + js + '\n</script>\n</body>\n</html>\n';
writeFileSync('index.html', out);
console.log(`index.html written (${(out.length / 1024).toFixed(0)} KB)`);
