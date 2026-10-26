import { launch, done } from './harness.mjs';
const g = await launch({ quality: 'low', port: 8196 });
console.log('boot', g.bootErr || 'ok');
const st = await g.page.evaluate(() => window.__bootStack || null);
console.log(st);
console.log(g.errs.filter(e => !/Canvas2D|Failed to load/.test(e)).join('\n').slice(0, 3000));
await g.close(); done();
