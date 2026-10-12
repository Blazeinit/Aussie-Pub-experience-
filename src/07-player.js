
// =====================================================================
//  PLAYER: controller, viewmodel, drink physics, smoking, seating
// =====================================================================
const keys = {};
const input = { mx: 0, my: 0, locked: false };
const player = {
  pos: V3(-6, 0, 21), level: 0, yaw: 0, pitch: 0, vel: V3(), eye: 1.64, bob: 0, stepT: 0, lastStep: 0,
  drink: null, seated: null, seatT: 0, camFrom: null, sip: 0, sipping: false,
  cig: null, vm: null, food: null, standT: 0, swayT: 0, bump: 0, look: { yaw: 0, pitch: 0 },
};
const vm = { root: new THREE.Group(), R: null, L: null, lag: new THREE.Vector2(), lagV: new THREE.Vector2(), lighter: null, flame: null, light: null, pressT: 0 };

// ---------- first-person hands: tapered-tube fingers posed around real objects ----------
let skinVM, sleeveVM, nailVM;
function vmMats() {
  if (skinVM) return;
  skinVM = new THREE.MeshStandardMaterial({ color: 0xd59c7c, roughness: 0.52, metalness: 0 });
  skinVM.onBeforeCompile = sh => { // cheap subsurface-ish wrap lighting
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb += vec3(0.05, 0.012, 0.0) * (1.0 - abs(dot(normalize(vNormal), vec3(0.,0.,1.))));');
  };
  sleeveVM = flannelMat(0x1a4a8a);
  nailVM = new THREE.MeshStandardMaterial({ color: 0xe8c2b0, roughness: 0.3 });
}
function taperTube(pts, r0, r1, mat) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const seg = 14, rad = 9, geo = new THREE.TubeGeometry(curve, seg, r0, rad, false);
  const p = geo.attributes.position;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = curve.getPointAt(t), k = lerp(1, r1 / r0, t);
    for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; _v1.fromBufferAttribute(p, idx).sub(c).multiplyScalar(k).add(c); p.setXYZ(idx, _v1.x, _v1.y, _v1.z); }
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  const cap0 = new THREE.Mesh(new THREE.SphereGeometry(r0, 10, 8), mat); cap0.position.copy(pts[0]); g.add(cap0);
  const cap1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 10, 8), mat); cap1.position.copy(pts[pts.length - 1]); g.add(cap1);
  // fingernail on the tip
  const dir = curve.getTangentAt(1);
  const nail = new THREE.Mesh(new THREE.SphereGeometry(r1 * 0.85, 8, 6), nailVM); nail.scale.set(1, 0.45, 1.1);
  nail.position.copy(pts[pts.length - 1]).addScaledVector(dir, -r1 * 0.6); g.add(nail);
  return g;
}
function limbBetween(a, b, r0, r1, mat) {
  const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 16, 1, false), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), b.clone().sub(a).normalize());
  const g = new THREE.Group(); g.add(m);
  const j = new THREE.Mesh(new THREE.SphereGeometry(r0, 12, 10), mat); j.position.copy(a); g.add(j);
  return g;
}
function palmBox(c, w, h, d, ry, mat, rx = 0) { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.45), mat); m.position.copy(c); m.rotation.set(rx, ry, 0); return m; }
// Right hand wrapped around a cylinder (glass or lighter). Object origin = base of the cylinder.
function buildGripHand(rb, rt, h) {
  vmMats();
  const g = new THREE.Group();
  const Rat = y => lerp(rb, rt, clamp(y / h, 0, 1)) + 0.004;
  const gh = h * 0.42, Rg = Rat(gh), ap = 0.5;
  g.add(palmBox(V3(Math.cos(ap) * (Rg + 0.017), gh - 0.006, Math.sin(ap) * (Rg + 0.017)), 0.026, 0.088, 0.074, -ap, skinVM));
  const fh = [gh + 0.033, gh + 0.011, gh - 0.011, gh - 0.031], fe = [-2.2, -2.35, -2.25, -1.95], fr = [0.0088, 0.0094, 0.0088, 0.0076];
  fh.forEach((y, i) => {
    const R = Rat(y) + fr[i], pts = [V3(Math.cos(0.42) * (R + 0.012), y - 0.004, Math.sin(0.42) * (R + 0.012))];
    for (let k = 0; k <= 5; k++) { const a = lerp(0.12, fe[i], k / 5); pts.push(V3(Math.cos(a) * R, y + (k / 5) * 0.004, Math.sin(a) * R)); }
    g.add(taperTube(pts, fr[i], fr[i] * 0.82, skinVM));
  });
  const tR = Rat(gh + 0.03) + 0.011;
  g.add(taperTube([V3(Math.cos(0.95) * (Rg + 0.03), gh - 0.03, Math.sin(0.95) * (Rg + 0.03)), V3(Math.cos(1.25) * (tR + 0.006), gh + 0.004, Math.sin(1.25) * (tR + 0.006)), V3(Math.cos(1.62) * tR, gh + 0.03, Math.sin(1.62) * tR), V3(Math.cos(1.92) * tR, gh + 0.042, Math.sin(1.92) * tR)], 0.0112, 0.0094, skinVM));
  const wrist = V3(Math.cos(ap) * (Rg + 0.024), gh - 0.052, Math.sin(ap) * (Rg + 0.024) + 0.006);
  g.add(limbBetween(wrist, wrist.clone().add(V3(0.1, -0.24, 0.3)), 0.025, 0.031, skinVM));
  g.add(limbBetween(wrist.clone().add(V3(0.075, -0.18, 0.22)), wrist.clone().add(V3(0.2, -0.46, 0.62)), 0.046, 0.056, sleeveVM));
  return g;
}
// Right hand pointing; the index fingertip sits at the origin.
function buildPointHand() {
  vmMats();
  const g = new THREE.Group();
  g.add(palmBox(V3(0.032, 0.032, 0.09), 0.074, 0.027, 0.086, 0, skinVM, 0.15));
  g.add(taperTube([V3(0.009, 0.034, 0.046), V3(0.005, 0.026, 0.022), V3(0.001, 0.012, 0.006), V3(0, 0, 0)], 0.0092, 0.0076, skinVM));
  [[0.027, 0.0094], [0.045, 0.0088], [0.061, 0.0075]].forEach(([x, r], i) => g.add(taperTube([V3(x, 0.034, 0.047 + i * 0.003), V3(x + 0.001, 0.018, 0.03), V3(x + 0.002, 0.004, 0.04), V3(x + 0.002, 0.003, 0.058)], r, r * 0.85, skinVM)));
  g.add(taperTube([V3(0.004, 0.022, 0.105), V3(-0.012, 0.014, 0.075), V3(-0.012, 0.01, 0.052)], 0.0112, 0.0095, skinVM));
  g.add(limbBetween(V3(0.034, 0.034, 0.13), V3(0.095, -0.05, 0.42), 0.026, 0.032, skinVM));
  g.add(limbBetween(V3(0.08, -0.01, 0.34), V3(0.16, -0.18, 0.78), 0.048, 0.057, sleeveVM));
  return g;
}
// Left hand, fingers up, palm facing +x, thumb toward camera; cigarette wedged between index & middle.
function buildCigHand() {
  vmMats();
  const g = new THREE.Group();
  g.add(palmBox(V3(0, 0, 0), 0.027, 0.088, 0.074, 0, skinVM));
  g.add(taperTube([V3(0.004, 0.04, 0.025), V3(0.006, 0.068, 0.027), V3(0.012, 0.093, 0.028), V3(0.021, 0.11, 0.028)], 0.0088, 0.0074, skinVM));
  g.add(taperTube([V3(0.004, 0.042, 0.007), V3(0.006, 0.072, 0.007), V3(0.013, 0.098, 0.007), V3(0.023, 0.114, 0.007)], 0.0092, 0.0077, skinVM));
  g.add(taperTube([V3(0.004, 0.04, -0.011), V3(0.012, 0.062, -0.012), V3(0.027, 0.058, -0.012), V3(0.031, 0.042, -0.012)], 0.0086, 0.0072, skinVM));
  g.add(taperTube([V3(0.004, 0.035, -0.027), V3(0.012, 0.053, -0.028), V3(0.025, 0.05, -0.028), V3(0.028, 0.038, -0.027)], 0.0075, 0.0064, skinVM));
  g.add(taperTube([V3(0.008, -0.016, 0.03), V3(0.02, 0.012, 0.043), V3(0.03, 0.034, 0.041), V3(0.034, 0.05, 0.035)], 0.011, 0.0092, skinVM));
  g.add(limbBetween(V3(-0.003, -0.04, 0.008), V3(-0.07, -0.3, 0.26), 0.025, 0.031, skinVM));
  g.add(limbBetween(V3(-0.055, -0.22, 0.2), V3(-0.135, -0.5, 0.6), 0.046, 0.056, sleeveVM));
  return g;
}
function makeRightHand() {
  const g = new THREE.Group(), grips = {}, point = buildPointHand();
  g.add(point);
  const o = { g, point, grip: null, pose: 'point',
    setPose(pose, D) {
      if (pose === 'grip' && D) {
        const key = D.rb + '_' + D.rt + '_' + D.h;
        if (!grips[key]) { grips[key] = buildGripHand(D.rb, D.rt, D.h); g.add(grips[key]); }
        for (const k in grips) grips[k].visible = k === key;
        point.visible = false; this.grip = grips[key];
      } else { for (const k in grips) grips[k].visible = false; point.visible = true; }
      this.pose = pose;
    },
    curl() {}
  };
  return o;
}
function buildViewmodel() {
  camera.add(vm.root);
  vm.R = makeRightHand(); vm.L = { g: buildCigHand(), curl() {} };
  vm.root.add(vm.R.g); vm.root.add(vm.L.g);
  vm.R.g.position.set(0.3, -0.8, -0.45); vm.L.g.position.set(-0.3, -0.8, -0.4);
  // lighter, held in its own gripping hand
  vm.lighter = new THREE.Group();
  const lb = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.06, 0.013, 2, 0.004), M({ color: 0xc7352b, roughness: 0.3 })); lb.position.y = 0.03; vm.lighter.add(lb);
  const lt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.013), MAT.chrome); lt.position.y = 0.066; vm.lighter.add(lt);
  vm.lighter.add(buildGripHand(0.0105, 0.0105, 0.05));
  vm.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(3, 1.6, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  vm.flame.scale.set(0.025, 0.05, 1); vm.flame.position.y = 0.095; vm.flame.visible = false; vm.lighter.add(vm.flame);
  vm.lighter.visible = false; vm.root.add(vm.lighter);
  vm.light = new THREE.PointLight(0xff8a3a, 0, 3, 2); vm.root.add(vm.light); vm.light.position.set(0, -0.1, -0.3);
  // cigarette (wedged between index & middle of the left hand)
  const cig = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 1, 10), M({ color: 0xf4f2ec, roughness: 0.7 }));
  const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.0043, 0.0043, 0.025, 10), M({ color: 0xc9893a, roughness: 0.6 }));
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.0041, 0.0042, 1, 10), M({ color: 0x8a8884, roughness: 1 }));
  const ember = new THREE.Mesh(new THREE.CylinderGeometry(0.0043, 0.0043, 0.003, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.05, 0) }));
  [paper, filter, ash, ember].forEach(m => { m.rotation.x = Math.PI / 2; cig.add(m); });
  cig.visible = false; vm.L.g.add(cig); cig.position.set(0.022, 0.077, 0.0175); cig.rotation.set(0, Math.PI / 2, 0);
  player.cigMesh = { g: cig, paper, filter, ash, ember };
  vm.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  layoutCig(1, 0);
}
function layoutCig(len, ashLen) {
  // cigarette along local -z: filter at z=0, then paper, ash, ember at the tip
  const c = player.cigMesh, total = 0.065 * len;
  c.filter.position.z = 0.0;
  c.paper.scale.y = Math.max(0.001, total - ashLen); c.paper.position.z = -(0.0125 + (total - ashLen) / 2);
  c.ash.scale.y = Math.max(0.001, ashLen); c.ash.position.z = -(0.0125 + total - ashLen / 2);
  c.ember.position.z = -(0.0125 + total - ashLen) + 0.0015;
  c.tipZ = -(0.0125 + total);
}

// ---------- input ----------
function setupInput() {
  addEventListener('keydown', e => {
    if (e.code === 'Tab') e.preventDefault();
    if (e.code === 'F3') { e.preventDefault(); perf.show = !perf.show; return; }
    if (keys[e.code]) return; keys[e.code] = true;
    Game.onKey(e.code, e);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('mousemove', e => { if (input.locked) { input.mx += e.movementX; input.my += e.movementY * (settings.invertY ? -1 : 1); } });
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === renderer.domElement; Game.onLockChange(input.locked); });
  renderer.domElement.addEventListener('mousedown', e => Game.onCanvasClick(e));
  addEventListener('mouseup', e => { if (MG.active) MG.up(e); });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
}
function lockPointer() { if (TOUCH.on) { input.locked = true; if (typeof Game !== 'undefined') Game.onLockChange(true); return; } try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }

// ---------- body for mirror reflection ----------
let playerBody;
function buildPlayerBody() {
  playerBody = makeHuman({ fem: false, shirt: { tile: 'flannel', c: 0x2a5aa8 }, pants: { tile: 'denim', c: 0xffffff }, style: 'short', skinI: 1, scale: 1.02, girth: 1.05, shorts: false });
  playerBody.root.visible = false; scene.add(playerBody.root);
  playerBody.a = { seed: 0, walkPh: 0, sitH: 0.7, tapT: 0, talk: 0, holdDrink: false, sipT: 0, smoking: false, dragT: 0, drunk: 0 };
  if (backMirror) { const orig = backMirror.onBeforeRender; backMirror.onBeforeRender = function (...args) { playerBody.root.visible = true; orig.apply(this, args); playerBody.root.visible = false; }; }
}

// ---------- update ----------
const SMOKE_STEPS = { pull: 0.6, mouth: 0.45, light: 1.4, inhale: 1.4, away: 0.6, hold: 0, flick: 0.5, stub: 1.0 };
function startSmoke() {
  const s = Game.state;
  if (player.cig) { if (player.cig.phase === 'hold') { player.cig.phase = 'mouth2'; player.cig.t = 0; } return; }
  if (s.cigs <= 0) { Game.toast("You're out of smokes. The bar sells them."); return; }
  if (!smokingAllowed(player.pos.x, player.pos.z)) { Game.toast('No smoking inside — head out the front or to the gaming terrace.'); return; }
  s.cigs--; s.stats.cigs++;
  player.cig = { phase: 'pull', t: 0, len: 1, ash: 0, drags: 0, lit: false, glow: 0 };
  layoutCig(1, 0); player.cigMesh.g.visible = true;
}
function updateSmoking(dt, t) {
  const c = player.cig, cm_ = player.cigMesh;
  const seated = !!player.seated;
  const rest = seated ? V3(-0.21, -0.3, -0.46) : V3(-0.24, -0.29, -0.44);
  const mouth = V3(-0.04, -0.15, -0.1);
  let target = V3(-0.3, -0.9, -0.4), rot = V3(0, 0.35, 0);
  if (!c) { vm.L.g.position.lerp(target, 1 - Math.exp(-8 * dt)); vm.L.g.visible = vm.L.g.position.y > -0.8; vm.lighter.visible = false; vm.light.intensity = damp(vm.light.intensity, 0, 10, dt); return; }
  vm.L.g.visible = true;
  c.t += dt;
  const ph = c.phase;
  const tipWorld = () => { cm_.g.updateWorldMatrix(true, false); return V3(0, 0, cm_.tipZ).applyMatrix4(cm_.g.matrixWorld); };
  if (ph === 'pull') { target = rest; if (c.t > SMOKE_STEPS.pull) { c.phase = 'mouth'; c.t = 0; } }
  else if (ph === 'mouth' || ph === 'mouth2') { target = mouth; rot.set(0, 0.05, 0); if (c.t > SMOKE_STEPS.mouth) { c.phase = c.lit ? 'inhale' : 'light'; c.t = 0; if (c.lit) SFX.inhale(); } }
  else if (ph === 'light') {
    target = mouth; rot.set(0, 0.05, 0);
    vm.lighter.visible = true;
    const k = clamp(c.t / 0.35, 0, 1);
    vm.lighter.position.lerpVectors(V3(0.15, -0.5, -0.3), V3(-0.075, -0.215, -0.13), easeOut(k));
    if (c.t > 0.35 && !c.clicked) { c.clicked = true; SFX.lighterClick(); for (let i = 0; i < 8; i++) { vm.lighter.updateWorldMatrix(true, false); sparkFX.emit(V3(0, 0.085, 0).applyMatrix4(vm.lighter.matrixWorld), V3(rand(-.4, .4), rand(0.2, 0.9), rand(-.4, .4)), 0.004, 0.4, 1, [1, 0.7, 0.3]); } }
    if (c.t > 0.45 && !c.flamed) { c.flamed = true; SFX.flame(); SFX.inhale(); }
    vm.flame.visible = c.t > 0.45 && c.t < 1.15;
    if (vm.flame.visible) { vm.flame.scale.set(0.022 + Math.random() * 0.005, 0.045 + Math.random() * 0.012, 1); vm.light.intensity = 0.6 + Math.random() * 0.25; }
    if (c.t > 0.8) { c.lit = true; c.glow = 1; }
    if (c.t > SMOKE_STEPS.light) { c.phase = 'away'; c.t = 0; c.drags++; vm.lighter.visible = false; c.exhaleAt = 0.5; }
  } else if (ph === 'inhale') {
    target = mouth; rot.set(0, 0.05, 0);
    c.glow = 0.6 + 0.4 * Math.sin(c.t * 9) ** 2;
    c.len -= dt * 0.045; c.ash += dt * 0.004;
    if (c.t > SMOKE_STEPS.inhale) { c.phase = 'away'; c.t = 0; c.drags++; c.exhaleAt = 0.4; Game.onDrag(); }
  } else if (ph === 'away') {
    target = rest; c.glow = damp(c.glow, 0.25, 3, dt);
    if (c.t > SMOKE_STEPS.away) { c.phase = c.drags % 3 === 0 && c.ash > 0.004 ? 'flick' : 'hold'; c.t = 0; }
  } else if (ph === 'flick') {
    target = rest.clone().add(V3(0, 0.02 * Math.sin(c.t * 40), 0));
    if (c.t > 0.25 && c.ash > 0) { const tw = tipWorld(); for (let i = 0; i < 5; i++) dropFX.emit(tw, V3(rand(-.1, .1), -0.2, rand(-.1, .1)), 0.006, 1.5, 0.9, [0.45, 0.44, 0.42]); c.ash = 0; SFX.tone(3000, 0.02, { gain: 0.02 }); }
    if (c.t > SMOKE_STEPS.flick) { c.phase = 'hold'; c.t = 0; }
  } else if (ph === 'hold') {
    target = rest; c.glow = damp(c.glow, 0.25, 3, dt); c.len -= dt * 0.0025; c.ash += dt * 0.0006;
    if (c.len < 0.32 || c.drags >= 9) { c.phase = 'stub'; c.t = 0; }
  } else if (ph === 'stub') {
    const ashtray = seated && player.seated.def.smoke ? player.seated.ash : null;
    target = V3(-0.1, -0.5, -0.45); c.glow = damp(c.glow, 0, 4, dt);
    if (c.t > 0.5 && !c.dropped) {
      c.dropped = true;
      const tw = tipWorld();
      if (!ashtray) { // flick the butt — little physics arc with an ember
        for (let i = 0; i < 6; i++) sparkFX.emit(tw, V3(rand(-.3, .3), rand(0, .5), rand(-.3, .3)), 0.004, 0.5, 1, [1, 0.5, 0.1]);
        const fw = V3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(-1.2);
        dropFX.emit(tw, fw.add(V3(0, 1.2, 0)), 0.008, 3, 1, [1, 0.45, 0.1]);
      }
      SFX.tone(400, 0.1, { gain: 0.04 });
      cm_.g.visible = false;
    }
    if (c.t > SMOKE_STEPS.stub) { player.cig = null; Game.toast(ashtray ? 'Stubbed it out in the ashtray.' : 'Flicked the butt. Classy.'); }
  }
  // exhale puff
  if (c.exhaleAt != null) { c.exhaleAt -= dt; if (c.exhaleAt <= 0) { c.exhaleAt = null; c.exhaling = 1.3; SFX.exhale(); if (Math.random() < 0.08 + Game.state.cigsTonight * 0.01) setTimeout(() => SFX.cough(), 900); } }
  if (c.exhaling > 0) {
    c.exhaling -= dt;
    const fw = new THREE.Vector3(0, -0.15, -1).applyQuaternion(camera.quaternion);
    const mp = camera.position.clone().add(fw.clone().multiplyScalar(0.28)).add(V3(0, -0.06, 0));
    if (Math.random() < dt * 40) smokeFX.emit(mp, fw.clone().multiplyScalar(rand(0.7, 1.1)).add(V3(rand(-.08, .08), rand(0, .06), rand(-.08, .08))), rand(0.018, 0.03), rand(2.5, 4), 0.09 * Math.min(1, c.exhaling), [0.88, 0.88, 0.9], 0.16);
  }
  // ember / tip smoke
  if (c.lit && !c.dropped) {
    const g = c.glow;
    cm_.ember.material.color.setRGB(0.3 + g * 6, 0.05 + g * 1.4, g * 0.2);
    vm.light.intensity = Math.max(vm.flame.visible ? vm.light.intensity : 0, g * 0.25);
    if (Math.random() < dt * 14) smokeFX.emit(tipWorld(), V3(rand(-.01, .01), 0.1, rand(-.01, .01)), 0.012, rand(3, 5), 0.25, [0.8, 0.82, 0.88], 0.04);
  }
  layoutCig(clamp(c.len, 0.2, 1), clamp(c.ash, 0, 0.02));
  vm.L.g.position.lerp(target, 1 - Math.exp(-10 * dt));
  vm.L.g.rotation.x = damp(vm.L.g.rotation.x, rot.x, 10, dt); vm.L.g.rotation.y = damp(vm.L.g.rotation.y, rot.y, 10, dt);
  // walking inside with a lit dart
  if (c.lit && !c.dropped && !smokingAllowed(player.pos.x, player.pos.z) && c.phase !== 'stub') { c.phase = 'stub'; c.t = 0; Game.onIndoorSmoke(); }
}

function giveDrink(glass) {
  if (player.drink) return false;
  player.drink = glass;
  vm.R.g.add(glass.group); glass.group.position.set(0, 0, 0); glass.group.rotation.set(0, 0, 0);
  glass.lastPos = null; glass.slosh.set(0, 0); glass.sloshV.set(0, 0);
  vm.R.curl(0.85);
  return true;
}
function updateDrinkVM(dt, t, moving) {
  const d = player.drink, seated = player.seated, held = d && !d.onLedge;
  const R = vm.R;
  let target, tilt = 0, snap = 12;
  if (held) {
    if (R.pose !== 'grip' || R.gripD !== d.D) { R.setPose('grip', d.D); R.gripD = d.D; }
    target = seated ? V3(0.15, -0.33, -0.44) : V3(0.19, -0.27, -0.43);
  } else if (seated) {
    if (R.pose !== 'point') R.setPose('point');
    // rest the index finger just above the machine's spin button
    seated.btns[5].updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    target = camera.worldToLocal(_v2.setFromMatrixPosition(seated.btns[5].matrixWorld)).clone().add(V3(0, 0.022, 0.01));
    snap = 20;
  } else target = V3(0.3, -0.9, -0.4);
  R.g.visible = !!(held || seated) || R.g.position.y > -0.75;
  if (player.cig && (player.cig.phase === 'light')) target.y -= 0.5;
  if (player.sip > 0) {
    player.sip -= dt;
    const SD = player.chug ? 0.85 : 1.7, k = 1 - player.sip / SD, s = Math.sin(clamp(k, 0, 1) * Math.PI);
    target.lerp(V3(0.01, -0.125, -0.2), s);
    tilt = s * (0.95 + (1 - (d ? d.fill : 0)) * 0.75);
    if (k > 0.35 && k < 0.7 && d && d.fill > 0) { const take = Math.min(d.fill, dt * (player.chug ? 0.6 : 0.28)); d.fill -= take; Game.onSipAmount(take * d.D.std, take); if (Math.random() < dt * 4) SFX.gulp(); }
    if (player.sip <= 0) { SFX.ahh(); if (d && seated && d.wasLedge) { placeOnLedge(); } }
  }
  if (vm.pressT > 0) { vm.pressT -= dt; const k = Math.sin((1 - vm.pressT / 0.25) * Math.PI); target.add(V3(0, -0.018 * k, -0.004 * k)); }
  // sway & bob
  const bobA = moving ? 1 : 0;
  if (!seated) { target.x += Math.sin(player.bob) * 0.008 * bobA + vm.lag.x; target.y += Math.abs(Math.cos(player.bob)) * 0.01 * bobA + vm.lag.y; }
  R.g.position.lerp(target, 1 - Math.exp(-snap * dt));
  R.g.rotation.x = damp(R.g.rotation.x, tilt, 10, dt);
  R.g.rotation.y = damp(R.g.rotation.y, held ? -0.18 : 0, 8, dt);
  R.g.rotation.z = damp(R.g.rotation.z, held ? -vm.lag.x * 3 : 0, 8, dt);
  if (held) {
    const spill = d.physics(dt);
    if (spill > 0.002) { d.group.updateWorldMatrix(true, false); const rim = V3(0, d.D.h, 0).applyMatrix4(d.group.matrixWorld); spillDrops(rim, spill, d.D.col); Game.onSpill(spill); }
    d.update(dt, t);
  } else if (d) d.update(dt, t);
}
function placeOnLedge() {
  const d = player.drink, m = player.seated; if (!d || !m) return;
  scene.attach(d.group); d.group.position.copy(m.ledge); d.group.rotation.set(0, m.def.ry, 0); d.onLedge = true; d.wasLedge = true;
  vm.R.curl(0.2); SFX.glassDown(m.ledge);
}
function takeFromLedge() { const d = player.drink; if (!d || !d.onLedge) return; vm.R.g.add(d.group); d.group.position.set(0, 0, 0); d.group.rotation.set(0, 0, 0); d.onLedge = false; vm.R.curl(0.85); }
function sipDrink() {
  const d = player.drink;
  if (!d) { Game.toast(player.seated ? 'No drink. Stand up and grab one from the bar.' : 'Nothing in your hand. Order at the bar.'); return; }
  if (player.sip > 0 || (player.cig && ['mouth', 'mouth2', 'light', 'inhale'].includes(player.cig.phase))) return;
  if (d.fill < 0.02) { Game.toast('Glass is empty. Grab another at the bar, or G to drop it.'); return; }
  if (d.onLedge) takeFromLedge();
  player.sip = player.chug ? 0.85 : 1.7; SFX.clink(camera.position);
}
function dropHeld() {
  const d = player.drink; if (!d) return;
  if (d.onLedge) { Game.toast('Your drink is on the ledge.'); return; }
  player.drink = null; vm.R.curl(0.2);
  const v = V3(0, 0.5, 0).add(player.vel.clone().multiplyScalar(0.8)).add(new THREE.Vector3(0, 0, -1.2).applyQuaternion(camera.quaternion));
  dropGlass(d, v);
}

function sitAt(m) {
  player.seated = m; player.seatT = 0;
  player.camFrom = { pos: camera.position.clone(), q: camera.quaternion.clone() };
  m.occupiedBy = 'player'; m.setMode('player'); PokieFX.attach(m); document.body.classList.add('seated');
  if (player.drink && !player.drink.onLedge) placeOnLedge();
}
function standUp() {
  const m = player.seated; if (!m) return;
  if (player.drink && player.drink.onLedge) takeFromLedge();
  if (player.drink) player.drink.wasLedge = false;
  m.occupiedBy = null; m.setMode('idle'); PokieFX.detach(); document.body.classList.remove('seated');
  player.seated = null;
  player.pos.copy(m.seatW).addScaledVector(m.fw, 0.45);
  player.yaw = Math.atan2(m.fw.x, m.fw.z); player.pitch = -0.1;
}
function seatCam() {
  const m = player.seated;
  const eye = m.seatW.clone().add(V3(0, 1.37, 0)).addScaledVector(m.fw, 0.06);
  const look = m.screenW.clone().add(V3(0, -0.19, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, look, V3(0, 1, 0)));
  return { pos: eye, q };
}

function updatePlayer(dt, t) {
  const s = Game.state, drunk = s.drunk / 100;
  if (MG.active) { MG.update(dt, t); if (player.drink) player.drink.update(dt, t); return; }
  // look
  if (input.locked && !player.seated) {
    const sens = 0.0022 * settings.sens;
    player.yaw -= input.mx * sens; player.pitch -= input.my * sens;
    player.pitch = clamp(player.pitch, -1.45, 1.45);
    vm.lagV.x += -input.mx * 0.004; vm.lagV.y += input.my * 0.004;
  }
  input.mx = input.my = 0;
  vm.lagV.x += -vm.lag.x * 150 * dt; vm.lagV.y += -vm.lag.y * 150 * dt; vm.lagV.multiplyScalar(Math.exp(-12 * dt));
  vm.lag.addScaledVector(vm.lagV, dt); vm.lag.clampLength(0, 0.04);
  let moving = false;
  const wantFov = player.seated ? 55 : settings.fov;
  if (Math.abs(camera.fov - wantFov) > 0.05) { camera.fov = damp(camera.fov, wantFov, 5, dt); camera.updateProjectionMatrix(); }
  bloom.strength = damp(bloom.strength, player.seated ? Math.min(0.22, settings.bloomStr) : settings.bloomStr, 4, dt);
  if (player.seated) {
    player.seatT += dt;
    const k = smooth(clamp(player.seatT / 0.8, 0, 1)), sc = seatCam();
    camera.position.lerpVectors(player.camFrom.pos, sc.pos, k);
    camera.quaternion.slerpQuaternions(player.camFrom.q, sc.q, k);
    // drunk sway even when seated
    const swayK = settings.reduceMotion ? 0 : settings.drunkFx; camera.rotateZ(Math.sin(t * 0.6) * 0.03 * drunk * swayK); camera.rotateX(Math.sin(t * 0.43) * 0.02 * drunk * swayK);
    if (k >= 1) PokieFX.cam(dt, t);
    player.pos.copy(player.seated.seatW);
  } else {
    const fw = V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)), rt = V3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const wish = V3();
    if (Game.canMove()) {
      if (keys.KeyW || keys.ArrowUp) wish.add(fw); if (keys.KeyS || keys.ArrowDown) wish.sub(fw);
      if (TOUCH.on) { wish.addScaledVector(fw, -TOUCH.my); wish.addScaledVector(rt, TOUCH.mx); }
      if (keys.KeyD || keys.ArrowRight) wish.add(rt); if (keys.KeyA || keys.ArrowLeft) wish.sub(rt);
    }
    if (player.auto) { wish.set(player.auto.x - player.pos.x, 0, player.auto.z - player.pos.z); player.yaw += angleDiff(player.yaw, Math.atan2(-wish.x, -wish.z)) * Math.min(1, dt * 3); }
    const run = keys.ShiftLeft || keys.ShiftRight || (TOUCH.on && (TOUCH.run || Math.hypot(TOUCH.mx, TOUCH.my) > 0.97));
    const spd = (run ? 4.2 : 1.9) * (1 - drunk * 0.25);
    if (wish.lengthSq() > 0) { wish.normalize(); moving = true; }
    // drunk drift
    if (drunk > 0.4) wish.addScaledVector(rt, Math.sin(t * 0.9) * (drunk - 0.4) * 0.7 * (moving ? 1 : 0.3));
    const acc = moving ? 12 : 9;
    player.vel.x = damp(player.vel.x, wish.x * spd, acc, dt); player.vel.z = damp(player.vel.z, wish.z * spd, acc, dt);
    player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt;
    collideCircle(player.pos, 0.32, player.level);
    // bump into NPCs
    for (const n of NPCS) {
      if (player.level) break;
      const dx = player.pos.x - n.pos.x, dz = player.pos.z - n.pos.z, d = Math.hypot(dx, dz), r = 0.55;
      if (d < r && d > 0.001) {
        player.pos.x += dx / d * (r - d); player.pos.z += dz / d * (r - d);
        const sp = Math.hypot(player.vel.x, player.vel.z);
        if (sp > 2.6 && t - (n.lastBump || 0) > 3) { n.lastBump = t; if (player.drink && !player.drink.onLedge) { player.drink.sloshV.x += rand(-4, 4); player.drink.sloshV.y += rand(-4, 4); } bark(n, choice(['Oi! Watch it!', 'Steady on, mate!', 'Easy, champ.', 'Mate. Eyes up.']), true); Game.onBump(); }
      }
    }
    const sp = Math.hypot(player.vel.x, player.vel.z);
    player.bob += dt * sp * (run ? 2.6 : 3.3);
    const gy = player.level === 1 ? UP.y : groundY(player.pos.x, player.pos.z);
    player.groundY = damp(player.groundY ?? gy, gy, 12, dt);
    // footsteps
    if (sp > 0.4 && Math.floor(player.bob / Math.PI) !== player.lastStep) { player.lastStep = Math.floor(player.bob / Math.PI); SFX.step(surfaceAt(player.pos.x, player.pos.z, player.level), player.pos.clone()); }
    const bobK = settings.headBob && !settings.reduceMotion ? 1 : 0, bobY = Math.abs(Math.sin(player.bob)) * 0.045 * Math.min(1, sp / 2) * bobK, bobX = Math.cos(player.bob) * 0.025 * Math.min(1, sp / 2) * bobK;
    camera.position.set(player.pos.x + rt.x * bobX, player.groundY + player.eye - bobY + 0.02, player.pos.z + rt.z * bobX);
    const sway = drunk * drunk * (settings.reduceMotion ? 0 : settings.drunkFx);
    camera.rotation.set(player.pitch + Math.sin(t * 0.47) * 0.05 * sway, player.yaw + Math.sin(t * 0.31) * 0.06 * sway, Math.sin(t * 0.6) * 0.06 * sway + bobX * 0.15 - vm.lag.x * 0.5);
  }
  updateDrinkVM(dt, t, moving);
  updateSmoking(dt, t);
  // mirror body
  if (playerBody) {
    const b = playerBody, a = b.a;
    b.root.position.set(player.pos.x, player.seated ? 0 : (player.groundY || 0), player.pos.z);
    b.root.rotation.y = player.seated ? player.seated.def.ry + Math.PI : player.yaw + Math.PI;
    a.walkPh = player.bob * 1.0; a.holdDrink = !!player.drink && !player.drink.onLedge; a.sipT = player.sip; a.smoking = !!player.cig; a.dragT = player.cig && player.cig.phase === 'inhale' ? 1 : 0; a.sitH = 0.7;
    const kind = player.seated ? 'pokie' : moving ? 'walk' : 'stand';
    applyPose(b, poseFor(kind, t, a), dt, 12);
    b.J.head.visible = true;
  }
}
