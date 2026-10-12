// Pool end to end, quickly: a staked frame won on the black (payout, close by click, HUD back, opponent released),
// a foul giving ball in hand to each side, a forfeit with Q, keyboard SPACE charging. VENUE=rsl|dive to try the others.
import { launch, done } from './harness.mjs';
const venue = process.env.VENUE || null, dir = 'pool3' + (venue ? '_' + venue : '');
const g = await launch({ quality: 'low', port: +(process.env.PORT || 8155), venue });
await g.startNight();
const { page } = g;
const log = [];
const ph = () => g.ev(`(()=>{const s=window.PoolGame.state(); return s? s.phase+':t'+s.match.turn+':w'+s.match.winner+':bih'+s.match.ballInHand:'closed'})()`);
const sim = s => g.ev(`window.__sim(${s})`);
const settle = async (max = 30) => { for (let i = 0; i < max; i++) { await sim(0.5); const p = await ph(); if (!/^roll|^ai/.test(p)) return p; } return ph(); };
await g.ev(`(()=>{ const G=window.__game; G.Game.entered=true; G.Game.closePanel(); G.Game.paused=false; G.Game.state.wallet=100; G.player.pos.set(-4.4,0,-13); window.__sim(0.5); })()`);

// ---- 1. staked frame, won on the black
await g.ev(`(()=>{ window.PoolGame.begin(10,'Spud'); window.__sim(0.3); })()`);
log.push('wallet after stake ' + await g.ev('window.__game.Game.state.wallet'));
const opp = await g.ev(`(()=>{ const s=window.PoolGame.state(); window.__opp=s.opp.n; return s.opp.name + ' locked=' + !!s.opp.n.mg; })()`);
log.push('opponent ' + opp);
// place the cue ball with SPACE, then break with a keyboard-charged shot
await page.keyboard.press('Space'); await sim(0.1); log.push('after place ' + await ph());
await page.keyboard.down('Space'); await sim(0.6); await page.keyboard.up('Space'); await sim(0.1);
log.push('after space shot ' + await ph());
await settle(); await g.shot(dir, '01_after_break');
// set up a winning black: the human on solids with all of them gone, the 8 sitting over a side pocket
await g.ev(`(()=>{ const s=window.PoolGame.state(), m=s.match, sim=s.sim; for (const b of sim.balls) { b.vx=b.vz=0; if (b.id>=1&&b.id<=7) { b.pocketed=true; } }
  m.isBreak=false; m.groups=['solids','stripes']; m.turn=0; m.ballInHand=false; s.phase='aim';
  const c=sim.balls[0], e=sim.balls[8]; c.pocketed=false; c.x=0.15; c.z=0; e.pocketed=false; e.x=0.42; e.z=0;
  for (const b of sim.balls) if (b.id>8 && !b.pocketed && Math.abs(b.z)<0.25) { b.z = 0.6; }
  s.angle=Math.PI/2; s.spin.top=0; s.spin.side=0; })()`);
await g.shot(dir, '02_black_setup');
await page.keyboard.down('Space'); await sim(0.35); await page.keyboard.up('Space');
const r1 = await settle(); log.push('after black ' + r1 + ' msg=' + await g.ev('window.PoolGame.state() && window.PoolGame.state().msg'));
log.push('wallet after win ' + await g.ev('window.__game.Game.state.wallet'));
await g.shot(dir, '03_over');
await sim(1); await page.mouse.click(640, 360); await sim(0.3);
log.push('after close ' + await ph() + ' MG=' + await g.ev('!!window.__MG.active') + ' hud=' + await g.ev(`getComputedStyle(document.getElementById('hud')).visibility`) + ' cv=' + await g.ev(`document.getElementById('poolCv').style.display`) + ' oppLocked=' + await g.ev('!!window.__opp.mg') + ' oppSpot=' + await g.ev('window.__opp.spot ? window.__opp.spot.kind : null'));
await sim(1.5); await g.at(-1.2, -11.2, -2.2, -0.15, 0.8); await g.shot(dir, '04_back_in_pub');

// ---- 2. foul -> ball in hand for the AI, then for the human
await g.ev(`(()=>{ window.PoolGame.begin(0,'A local'); window.__sim(0.3); })()`);
await page.keyboard.press('Space'); await sim(0.1);
await g.ev(`(()=>{ const s=window.PoolGame.state(); s.angle = Math.PI; })()`);   // straight back at the head cushion: no contact = foul
await page.keyboard.down('Space'); await sim(0.25); await page.keyboard.up('Space');
let p = await settle(); log.push('after human foul ' + p + ' msg=' + await g.ev('window.PoolGame.state().msg'));
await g.shot(dir, '05_ai_ball_in_hand');
for (let k = 0; k < 6 && !/^place:t0|^aim:t0|over|closed/.test(p); k++) p = await settle();
log.push('back to human ' + p);
// force a human ball in hand the way endShot does after an AI foul
await g.ev(`(()=>{ const s=window.PoolGame.state(), m=s.match; m.turn=1; m.lastShot=null; s.sim.shotEvents=[]; s.phase='roll'; s.rollT=1; s.sim._active=false; })()`);
await sim(0.2); p = await ph(); log.push('after AI no-contact foul ' + p + ' msg=' + await g.ev('window.PoolGame.state().msg'));
await g.shot(dir, '06_human_ball_in_hand');
if (p.startsWith('place')) { await page.mouse.move(700, 300); await sim(0.1); await page.mouse.click(700, 300); await sim(0.1); log.push('placed ' + await ph()); }
// ---- 3. forfeit with Q
const wallet0 = await g.ev('window.__game.Game.state.wallet');
await page.keyboard.press('KeyQ'); await sim(0.3);
log.push('after Q ' + await ph() + ' MG=' + await g.ev('!!window.__MG.active') + ' hud=' + await g.ev(`getComputedStyle(document.getElementById('hud')).visibility`) + ' wallet ' + wallet0 + '->' + await g.ev('window.__game.Game.state.wallet'));
console.log(log.join('\n'));
console.log('errors', g.errs.filter(e => !/Failed to load resource|BiquadFilter|Canvas2D/.test(e)).join('\n'));
await g.close(); done();
