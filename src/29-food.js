
// =====================================================================
//  FOOD: a model for every dish, plates carried out from the kitchen pass, steam on the hot ones,
//  and first-person eating: knife and fork (or bare hands) with a visible bite out of it each time.
//  Every model is built from CHUNKS: one is taken (or hidden) per bite, in the order they'd really be eaten.
// =====================================================================
// type: plate = knife & fork · hand = held in your right hand · pick = fingers.  Numbers are what it does for you.
const FOODS = {
  parma:      { name: 'Chicken parma', type: 'plate', price: 26, hunger: 55, drunk: 14, mood: 10, crunch: 1, hot: 1, line: 'Crumbed chook, napoli, melted cheese, chips and salad. The size of a hubcap. You feel human again.' },
  schnitty:   { name: 'Chicken schnitty', type: 'plate', price: 22, hunger: 50, drunk: 13, mood: 8, crunch: 1, hot: 1, line: 'Golden, crunchy, a wedge of lemon and chips on the side. Simple. Perfect.' },
  roast:      { name: 'Sunday roast', type: 'plate', price: 22, hunger: 60, drunk: 14, mood: 12, crunch: 0.4, hot: 1, line: 'Roast lamb, crispy spuds, gravy. Sunday sorted.' },
  chips:      { name: 'Bowl of chips', type: 'pick', price: 9, hunger: 25, drunk: 6, mood: 5, crunch: 0.7, hot: 1, line: 'Hot chips with chicken salt. Perfection.' },
  burger:     { name: 'Burger with the lot', type: 'hand', price: 19, hunger: 48, drunk: 11, mood: 9, crunch: 0.2, hot: 1, line: 'Beetroot, egg, bacon, the lot. It ran down your wrist. Worth every napkin.' },
  pie:        { name: 'Pie & sauce', type: 'hand', price: 9, hunger: 28, drunk: 7, mood: 6, crunch: 0.3, hot: 1, line: 'Mince and onion, tomato sauce, burnt tongue. The Australian dream.' },
  sausageroll:{ name: 'Sausage roll', type: 'hand', price: 6, hunger: 20, drunk: 5, mood: 4, crunch: 0.6, hot: 1, line: 'Flaky pastry on your jumper. Nobody will ever know.' },
  snags:      { name: 'Snag in bread', type: 'hand', price: 7, hunger: 24, drunk: 6, mood: 7, crunch: 0.1, hot: 1, line: 'Onions on the bottom, sauce on top. The correct way.' },
  nuts:       { name: 'Bar nuts', type: 'pick', price: 5, hunger: 10, drunk: 3, mood: 3, crunch: 0.9, hot: 0, line: 'Salty, then a bit too salty, then you want another beer.' },
  cheese:     { name: 'Cheese platter', type: 'pick', price: 24, hunger: 40, drunk: 9, mood: 8, crunch: 0.5, hot: 0, line: 'Brie, cheddar, quince paste and the good crackers. Classy.' },
  pav:        { name: 'Pavlova', type: 'plate', price: 12, hunger: 22, drunk: 5, mood: 12, crunch: 0.5, hot: 0, line: 'Meringue, cream, passionfruit. Nan would approve.' },
  kebab:      { name: 'Doner kebab', type: 'hand', price: 14, hunger: 50, drunk: 10, mood: 10, crunch: 0.1, hot: 1, line: 'Absolutely demolished that kebab. Garlic sauce on your chin. Worth it.' },
  hsp:        { name: 'HSP', type: 'plate', price: 18, hunger: 65, drunk: 16, mood: 12, crunch: 0.4, hot: 1, line: 'The holy trinity: chips, meat, sauce. You feel almost sober.' },
  pizza:      { name: 'Slice of pizza', type: 'hand', price: 5, hunger: 20, drunk: 4, mood: 4, crunch: 0.3, hot: 1, line: 'Cold-ish pizza. Somehow perfect.' },
  dimsim:     { name: 'Dim sims (3)', type: 'plate', price: 5, hunger: 24, drunk: 5, mood: 6, crunch: 0.1, hot: 1, line: 'Soy sauce, steamed, three of them gone in a minute.' },
  scallop:    { name: 'Potato scallop', type: 'hand', price: 2, hunger: 14, drunk: 3, mood: 4, crunch: 0.7, hot: 1, line: 'Crispy outside, fluffy inside. A cheap little miracle.' },
};
const BOXG = new THREE.BoxGeometry(1, 1, 1), SPHG = new THREE.SphereGeometry(1, 14, 10), CYLG = new THREE.CylinderGeometry(1, 1, 1, 18);
const _fm = {};
function fmat(key, o) { return _fm[key] || (_fm[key] = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7 }, o))); }
function foodTex(name) {
  if (_fm['t_' + name]) return _fm['t_' + name];
  const rn = (n, f) => { for (let i = 0; i < n; i++) f(); };
  const t = mkTex(128, 128, (x, W, H) => {
    if (name === 'bun') { x.fillStyle = '#d99a4a'; x.fillRect(0, 0, W, H); rn(600, () => { x.fillStyle = `hsl(${rand(28, 38)},${rand(55, 70)}%,${rand(42, 62)}%)`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }); rn(34, () => { x.fillStyle = '#f6e6b8'; x.beginPath(); x.ellipse(Math.random() * W, Math.random() * H, 3, 1.6, rand(0, 3), 0, 7); x.fill(); }); }
    else if (name === 'pastry') { x.fillStyle = '#d6a050'; x.fillRect(0, 0, W, H); rn(700, () => { x.fillStyle = `hsla(${rand(30, 42)},${rand(55, 75)}%,${rand(35, 68)}%,${rand(0.4, 0.9)})`; x.fillRect(Math.random() * W, Math.random() * H, rand(2, 8), rand(1, 3)); }); }
    else if (name === 'pizza') { x.fillStyle = '#f2c860'; x.fillRect(0, 0, W, H); rn(60, () => { x.fillStyle = `rgba(${randi(210, 255)},${randi(120, 170)},40,${rand(0.3, 0.8)})`; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, rand(3, 10), 0, 7); x.fill(); }); rn(10, () => { x.fillStyle = '#b02a1a'; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, 9, 0, 7); x.fill(); x.fillStyle = 'rgba(80,10,5,.5)'; x.beginPath(); x.arc(0, 0, 0, 0, 7); }); }
    else if (name === 'meat') { x.fillStyle = '#9a6a3a'; x.fillRect(0, 0, W, H); rn(500, () => { x.fillStyle = `hsl(${rand(20, 34)},${rand(35, 60)}%,${rand(22, 52)}%)`; x.fillRect(Math.random() * W, Math.random() * H, rand(2, 6), rand(1, 3)); }); }
    else if (name === 'cheese') { x.fillStyle = '#f2d878'; x.fillRect(0, 0, W, H); rn(14, () => { x.fillStyle = 'rgba(160,110,30,.55)'; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, rand(2, 6), 0, 7); x.fill(); }); }
    else if (name === 'meringue') { x.fillStyle = '#f8f4ea'; x.fillRect(0, 0, W, H); rn(120, () => { x.fillStyle = `rgba(230,210,170,${rand(0.1, 0.35)})`; x.fillRect(Math.random() * W, Math.random() * H, rand(3, 12), rand(2, 5)); }); }
  });
  return (_fm['t_' + name] = t);
}
// ------------------------------------------------------------------ builders: (g, chunks) -> populate. y up, origin at the plate centre / the bottom of a held item
const FB = {};
const put = (c, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); c.add(m); return m; };
const mkChunk = (g, chunks, at) => { const c = new THREE.Group(); if (at) c.userData.at = V3(...at); g.add(c); chunks.push(c); return c; };
// a wedge of a stack of round layers: cylinder segment plus two flat cut faces so the inside shows once a neighbour is gone
function wedge(c, r, y, h, th0, dth, mat, rTop = r, capMat = mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, 14, 1, false, th0, dth), mat); m.position.y = y + h / 2; c.add(m);
  for (const th of [th0, th0 + dth]) { const p = new THREE.Mesh(new THREE.PlaneGeometry((r + rTop) / 2, h), capMat); p.material.side = THREE.DoubleSide; p.position.set(Math.sin(th) * (r + rTop) / 4, y + h / 2, Math.cos(th) * (r + rTop) / 4); p.rotation.y = th - Math.PI / 2; c.add(p); }
}
function foodChips(c, n, cx, cz, sp, y0 = 0.02) { for (let i = 0; i < n; i++) put(c, BOXG, fmat('chip' + (i % 3), { color: [0xe8b84a, 0xdca33a, 0xf0c860][i % 3], roughness: 0.6 }), cx + rand(-sp, sp), y0 + (i % 5) * 0.006 + rand(0, 0.004), cz + rand(-sp, sp), 0.011, 0.011, rand(0.05, 0.075), 0, rand(0, 3), rand(-0.2, 0.2)); }
function plateBase(g) {
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.115, 0.016, 32), MAT.white); plate.position.y = 0.008; g.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.143, 0.006, 6, 32), MAT.white); rim.rotation.x = Math.PI / 2; rim.position.y = 0.017; g.add(rim);
}
function schnitzel(g, chunks, sauce) {
  const crumb = fmat('crumb', { map: foodTex('pastry'), roughness: 0.8, color: 0xe8b070 }), sauceM = fmat('sauce', { map: foodTexSauce(), roughness: 0.35 });
  const strips = [];
  for (let i = 0; i < 6; i++) { const c = mkChunk(g, chunks, [-0.085 + i * 0.03, 0.03, -0.03]); put(c, BOXG, crumb, -0.085 + i * 0.03, 0.026, -0.03, 0.029, 0.016, 0.115); if (sauce) put(c, BOXG, sauceM, -0.085 + i * 0.03, 0.036, -0.03, 0.027, 0.006, 0.108); strips.push(c); }
  g.userData.strips = strips; return strips;
}
function foodTexSauce() { return foodTextures().sauce; }
FB.parma = (g, chunks) => {
  plateBase(g); schnitzel(g, chunks, true);
  const sal = mkChunk(g, chunks, [0.08, 0.03, 0.09]); for (let i = 0; i < 7; i++) put(sal, SPHG, fmat('leaf' + (i % 3), { color: [0x5a9a2a, 0x7ab83a, 0x4a8a2a][i % 3], roughness: 0.7 }), -0.08 + rand(-0.03, 0.03), 0.027 + rand(0, 0.01), 0.1 + rand(-0.02, 0.02), 0.02, 0.008, 0.016, rand(-0.5, 0.5), rand(0, 3), 0);
  put(sal, SPHG, fmat('tom', { color: 0xc02a18, roughness: 0.4 }), -0.1, 0.03, 0.09, 0.013, 0.013, 0.013);
  const c1 = mkChunk(g, chunks, [0.1, 0.03, 0.03]); foodChips(c1, 12, 0.095, 0.03, 0.035);
  const c2 = mkChunk(g, chunks, [0.1, 0.03, -0.05]); foodChips(c2, 10, 0.1, -0.06, 0.03);
};
FB.schnitty = (g, chunks) => { plateBase(g); schnitzel(g, chunks, false); const lm = mkChunk(g, chunks, [-0.1, 0.03, 0.1]); put(lm, SPHG, fmat('lemon', { color: 0xf2d23a, roughness: 0.5 }), -0.1, 0.03, 0.1, 0.02, 0.012, 0.012, 0, 0.4, 0); const c1 = mkChunk(g, chunks, [0.1, 0.03, 0.0]); foodChips(c1, 16, 0.095, 0.0, 0.045); const c2 = mkChunk(g, chunks, [0.07, 0.03, 0.08]); foodChips(c2, 10, 0.07, 0.085, 0.03); };
FB.roast = (g, chunks) => {
  plateBase(g);
  const gravy = put(g, CYLG, fmat('gravy', { color: 0x5a2e12, roughness: 0.2 }), -0.03, 0.0185, 0, 0.085, 0.003, 0.07);
  for (let i = 0; i < 3; i++) { const c = mkChunk(g, chunks, [-0.05 + i * 0.012, 0.035, -0.02 + i * 0.02]); put(c, CYLG, fmat('lamb', { color: 0xb88068, roughness: 0.7 }), -0.05 + i * 0.012, 0.024 + i * 0.008, -0.02 + i * 0.02, 0.05, 0.007, 0.036, 0, 0, 0.12); put(c, CYLG, fmat('lambE', { color: 0x6a3a22, roughness: 0.8 }), -0.05 + i * 0.012, 0.0282 + i * 0.008, -0.02 + i * 0.02, 0.046, 0.001, 0.03); }
  for (let i = 0; i < 4; i++) { const c = mkChunk(g, chunks, [0.07, 0.03, -0.07 + i * 0.045]); put(c, SPHG, fmat('spud', { color: 0xd8a050, roughness: 0.6 }), 0.07 + rand(-0.01, 0.01), 0.03, -0.07 + i * 0.045, 0.026, 0.02, 0.024, rand(-0.3, 0.3), rand(0, 3), 0); }
  const peas = mkChunk(g, chunks, [-0.09, 0.03, 0.09]); for (let i = 0; i < 16; i++) put(peas, SPHG, fmat('pea', { color: 0x5aa83a, roughness: 0.5 }), -0.1 + rand(-0.03, 0.03), 0.024 + rand(0, 0.008), 0.09 + rand(-0.025, 0.025), 0.007, 0.007, 0.007);
  const car = mkChunk(g, chunks, [0.0, 0.03, 0.1]); for (let i = 0; i < 5; i++) put(car, CYLG, fmat('carrot', { color: 0xe8801a, roughness: 0.5 }), -0.02 + i * 0.018, 0.024, 0.1 + rand(-0.01, 0.01), 0.011, 0.006, 0.011);
};
FB.hsp = (g, chunks) => {
  const tray = put(g, BOXG, fmat('foam', { color: 0xf2f0e8, roughness: 0.9 }), 0, 0.02, 0, 0.26, 0.04, 0.2);
  foodChips(g, 0, 0, 0); const base = new THREE.Group(); g.add(base);
  const chipsC = []; for (let i = 0; i < 3; i++) { const c = mkChunk(g, chunks, [-0.06 + i * 0.06, 0.06, 0.05]); foodChips(c, 12, -0.08 + i * 0.07, 0.045, 0.045, 0.045); chipsC.push(c); }
  for (let i = 0; i < 5; i++) { const c = mkChunk(g, chunks, [-0.07 + i * 0.035, 0.07, -0.02]); for (let k = 0; k < 4; k++) put(c, BOXG, fmat('doner', { map: foodTex('meat'), roughness: 0.65 }), -0.09 + i * 0.04 + rand(-0.015, 0.015), 0.055 + rand(0, 0.015), -0.025 + rand(-0.03, 0.03), 0.04, 0.012, 0.016, rand(-0.2, 0.2), rand(0, 3), 0); }
  put(g, CYLG, fmat('garlic', { color: 0xf8f4e4, roughness: 0.3 }), -0.02, 0.087, -0.01, 0.07, 0.002, 0.014, 0, 0.5, 0); put(g, CYLG, fmat('chilli', { color: 0xc02a14, roughness: 0.3 }), 0.02, 0.089, 0.01, 0.06, 0.002, 0.01, 0, -0.4, 0);
  // a plastic fork stuck upright for authenticity
  put(g, BOXG, fmat('pfork', { color: 0xf4f4f0, roughness: 0.4 }), 0.12, 0.09, 0.1, 0.008, 0.11, 0.004, 0, 0, 0.15);
};
FB.dimsim = (g, chunks) => {
  const tray = put(g, BOXG, fmat('paperTray', { color: 0xf0e8d0, roughness: 0.95 }), 0, 0.012, 0, 0.26, 0.02, 0.12);
  for (let i = 0; i < 3; i++) for (const h of [0, 1]) { const c = mkChunk(g, chunks, [-0.075 + i * 0.075, 0.04, 0]); put(c, CYLG, fmat('dim', { color: 0xe8c880, roughness: 0.75 }), -0.075 + i * 0.075 + (h ? 0.0225 : -0.0225), 0.04, 0, 0.0225, 0.03, 0.03); put(c, SPHG, fmat('dimT', { color: 0xdcb870, roughness: 0.75 }), -0.075 + i * 0.075 + (h ? 0.0225 : -0.0225), 0.058, 0, 0.0225, 0.01, 0.03); }
  const dish = put(g, CYLG, fmat('soy', { color: 0x1a0a04, roughness: 0.1 }), 0.14, 0.012, 0.09, 0.03, 0.006, 0.03);
};
FB.pav = (g, chunks) => {
  plateBase(g); const mer = fmat('mer', { map: foodTex('meringue'), roughness: 0.9 });
  for (let i = 0; i < 5; i++) { const c = mkChunk(g, chunks, [Math.sin((i + 0.5) * 1.256) * 0.05, 0.06, Math.cos((i + 0.5) * 1.256) * 0.05]); const a0 = i * 1.2566;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 8, a0, 1.2566, 0, Math.PI / 2), mer); m.scale.set(1, 0.65, 1); m.position.y = 0.016; m.material.side = THREE.DoubleSide; c.add(m);
    const cr = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8, a0, 1.2566, 0, Math.PI / 2.2), fmat('cream', { color: 0xfffaf0, roughness: 0.4, side: THREE.DoubleSide })); cr.scale.set(1, 0.5, 1); cr.position.y = 0.05; c.add(cr);
    const fx = Math.sin((i + 0.5) * 1.256) * 0.035, fz = Math.cos((i + 0.5) * 1.256) * 0.035; put(c, SPHG, fmat(['straw', 'kiwi', 'pass', 'straw', 'kiwi'][i], { color: [0xc01830, 0x6aa82a, 0xe8a030, 0xc01830, 0x6aa82a][i], roughness: 0.4 }), fx, 0.07, fz, 0.011, 0.009, 0.011); }
};
// ---------- the pickable ones
FB.chips = (g, chunks) => {
  const paper = put(g, CYLG, fmat('paper', { color: 0xf0e4c4, roughness: 0.95 }), 0, 0.03, 0, 0.1, 0.06, 0.1); paper.scale.set(0.1, 0.06, 0.07);
  plateBase(g); g.children[0].scale.set(0.8, 1, 0.8); g.children[1].scale.set(0.8, 1, 0.8);
  for (let i = 0; i < 7; i++) { const c = mkChunk(g, chunks, [-0.06 + (i % 4) * 0.04, 0.05, -0.03 + Math.floor(i / 4) * 0.06]); foodChips(c, 6, -0.06 + (i % 4) * 0.04, -0.03 + Math.floor(i / 4) * 0.06, 0.03, 0.025 + (i % 3) * 0.006); }
  put(g, CYLG, fmat('salt', { color: 0xfff8e0, roughness: 0.3 }), 0, 0.0, 0, 0, 0, 0);
};
FB.nuts = (g, chunks) => {
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([V3(0, 0), V3(0.06, 0), V3(0.085, 0.03), V3(0.095, 0.05), V3(0.09, 0.052), V3(0.08, 0.03), V3(0.055, 0.01), V3(0, 0.008)], 20), fmat('bowl', { color: 0xf0ece0, roughness: 0.1, side: THREE.DoubleSide })); g.add(bowl);
  for (let b = 0; b < 6; b++) { const c = mkChunk(g, chunks, [Math.cos(b) * 0.04, 0.045, Math.sin(b) * 0.04]); for (let i = 0; i < 8; i++) put(c, SPHG, fmat('nut', { color: 0xc89858, roughness: 0.55 }), Math.cos(b) * 0.04 + rand(-0.035, 0.035), 0.026 + rand(0, 0.025), Math.sin(b) * 0.04 + rand(-0.035, 0.035), 0.014, 0.01, 0.01, rand(0, 3), rand(0, 3), 0); }
};
FB.cheese = (g, chunks) => {
  const board = put(g, BOXG, fmat('board', { color: 0x8a5a34, roughness: 0.5 }), 0, 0.012, 0, 0.34, 0.024, 0.2); const top = 0.03;
  const w = mkChunk(g, chunks, [-0.1, top, 0.0]); const wedgeShape = new THREE.Shape(); wedgeShape.moveTo(0, 0); wedgeShape.lineTo(0.09, 0); wedgeShape.lineTo(0.09, 0.035); wedgeShape.lineTo(0, 0); const wg = new THREE.Mesh(new THREE.ExtrudeGeometry(wedgeShape, { depth: 0.07, bevelEnabled: false }), fmat('brie', { map: foodTex('cheese'), roughness: 0.6 })); wg.rotation.x = -Math.PI / 2; wg.position.set(-0.145, 0.024, 0.04); wg.rotation.set(0, 0, 0); wg.scale.set(1, 1, 1); wg.rotation.x = 0; wg.position.set(-0.145, 0.025, -0.035); w.add(wg);
  const b = mkChunk(g, chunks, [-0.03, top, 0.05]); put(b, BOXG, fmat('cheddar', { color: 0xe89a2a, roughness: 0.55 }), -0.03, 0.04, 0.05, 0.07, 0.03, 0.045, 0, 0.2, 0);
  const b2 = mkChunk(g, chunks, [-0.01, top, -0.05]); put(b2, BOXG, fmat('blue', { color: 0xdcdcc8, roughness: 0.7 }), -0.01, 0.04, -0.05, 0.05, 0.028, 0.04, 0, -0.3, 0); for (let i = 0; i < 6; i++) put(b2, SPHG, fmat('mould', { color: 0x4a6a8a, roughness: 0.8 }), -0.01 + rand(-0.02, 0.02), 0.055, -0.05 + rand(-0.015, 0.015), 0.005, 0.004, 0.005);
  for (let i = 0; i < 4; i++) { const c = mkChunk(g, chunks, [0.06 + (i % 2) * 0.04, top, -0.06 + Math.floor(i / 2) * 0.06]); put(c, CYLG, fmat('cracker', { color: 0xdcb878, roughness: 0.8 }), 0.06 + (i % 2) * 0.045, 0.03, -0.06 + Math.floor(i / 2) * 0.07, 0.022, 0.004, 0.022); }
  const gr = mkChunk(g, chunks, [0.1, top, 0.06]); for (let i = 0; i < 10; i++) put(gr, SPHG, fmat('grape', { color: 0x6a2a7a, roughness: 0.3 }), 0.1 + rand(-0.025, 0.025), 0.04 + rand(0, 0.02), 0.07 + rand(-0.02, 0.02), 0.012, 0.012, 0.012);
  const qp = mkChunk(g, chunks, [0.13, top, -0.02]); put(qp, BOXG, fmat('quince', { color: 0x8a2a2a, roughness: 0.3 }), 0.13, 0.036, -0.01, 0.03, 0.02, 0.03);
};
// ---------- held in the hand: long axis up, bottom at y = 0
FB.burger = (g, chunks) => {
  const bun = fmat('bun', { map: foodTex('bun'), roughness: 0.65 }), layers = [['bunB', 0xd99a4a, 0.05, 0.014, 0], ['beet', 0x8a1a4a, 0.045, 0.004, 0], ['lett', 0x5aa82a, 0.056, 0.007, 0], ['patty', 0x4a2a1a, 0.049, 0.016, 0], ['cheese', 0xf2c830, 0.052, 0.003, 0], ['egg', 0xfff0c8, 0.04, 0.004, 0], ['tom', 0xc82a1a, 0.046, 0.005, 0]];
  for (let s = 0; s < 6; s++) {
    const c = mkChunk(g, chunks, [0, 0.04, 0]); const th0 = s * 1.0472, dth = 1.0472; let y = 0;
    layers.forEach(([k, col, r, h], i) => { wedge(c, r, y, h, th0, dth, k === 'bunB' ? bun : fmat('bl' + k, { color: col, roughness: 0.6 })); y += h; });
    wedge(c, 0.05, y, 0.026, th0, dth, bun, 0.034, bun);
    if (s % 2) put(c, SPHG, fmat('bsauce', { color: 0xc01a10, roughness: 0.3 }), Math.sin(th0 + 0.5) * 0.03, y + 0.002, Math.cos(th0 + 0.5) * 0.03, 0.012, 0.004, 0.012);
  }
  put(g, CYLG, fmat('wrap', { color: 0xf4f0e0, roughness: 0.9 }), 0, 0.007, 0, 0.056, 0.022, 0.056);
};
FB.pie = (g, chunks) => {
  const past = fmat('pastry', { map: foodTex('pastry'), roughness: 0.75 });
  for (let s = 0; s < 5; s++) { const c = mkChunk(g, chunks, [0, 0.02, 0]); const th0 = s * 1.2566, dth = 1.2566; wedge(c, 0.052, 0, 0.026, th0, dth, past, 0.046); wedge(c, 0.045, 0.026, 0.01, th0, dth, fmat('meat2', { color: 0x6a3a22, roughness: 0.6 }), 0.04); wedge(c, 0.052, 0.036, 0.01, th0, dth, past, 0.046); if (s === 0) put(c, SPHG, fmat('tsauce', { color: 0xc01a10, roughness: 0.25 }), Math.sin(th0 + 0.6) * 0.022, 0.047, Math.cos(th0 + 0.6) * 0.022, 0.014, 0.005, 0.014); }
};
FB.sausageroll = (g, chunks) => {
  const past = fmat('pastry', { map: foodTex('pastry'), roughness: 0.75 }), meat = fmat('srmeat', { color: 0xa8604a, roughness: 0.7 });
  put(g, CYLG, fmat('bag', { color: 0xf0e8cc, roughness: 0.95 }), 0, 0.02, 0, 0.034, 0.04, 0.034);
  for (let i = 0; i < 6; i++) { const c = mkChunk(g, chunks, [0, 0.05 + i * 0.026, 0]); put(c, CYLG, past, 0, 0.05 + i * 0.026, 0, 0.0245, 0.026, 0.0245); put(c, CYLG, meat, 0, 0.0635 + i * 0.026, 0, 0.0185, 0.001, 0.0185); if (i < 2) put(c, SPHG, fmat('flake', { color: 0xf0d8a0, roughness: 0.6 }), rand(-0.01, 0.01), 0.07 + i * 0.026, rand(-0.01, 0.01), 0.004, 0.002, 0.004); }
};
FB.snags = (g, chunks) => {
  const bread = fmat('bread', { color: 0xf0e0b8, roughness: 0.85 }), sau = fmat('snag', { color: 0x8a4a2a, roughness: 0.55 });
  for (let i = 0; i < 6; i++) { const c = mkChunk(g, chunks, [0, 0.025 + i * 0.024, 0]); const y = 0.03 + i * 0.024; put(c, BOXG, bread, 0, y, 0, 0.07, 0.024, 0.032); put(c, CYLG, sau, 0, y, 0.004, 0.014, 0.026, 0.014); put(c, CYLG, sau, 0.02, y, 0.004, 0.012, 0.026, 0.012); put(c, BOXG, fmat('onion', { color: 0xe8d8a8, roughness: 0.6 }), -0.006, y, 0.019, 0.045, 0.013, 0.005); put(c, BOXG, fmat('ssauce', { color: 0xc01a10, roughness: 0.3 }), 0.0, y + 0.002, 0.021, 0.04, 0.005, 0.004); }
};
FB.kebab = (g, chunks) => {
  put(g, CYLG, fmat('foil', { color: 0xc8ccd0, metalness: 0.85, roughness: 0.3 }), 0, 0.03, 0, 0.034, 0.06, 0.034);
  const pita = fmat('pita', { color: 0xe8d4a8, roughness: 0.85 }), lamb = fmat('klamb', { map: foodTex('meat'), roughness: 0.65 });
  for (let i = 0; i < 5; i++) { const c = mkChunk(g, chunks, [0, 0.07 + i * 0.026, 0]); const y = 0.065 + i * 0.026; put(c, new THREE.CylinderGeometry(0.036 + i * 0.002, 0.033 + i * 0.002, 0.028, 16), pita, 0, y, 0, 1, 1, 1);
    if (i === 4) { for (let k = 0; k < 5; k++) put(c, BOXG, lamb, rand(-0.015, 0.015), y + 0.014, rand(-0.015, 0.015), 0.02, 0.012, 0.012, 0, rand(0, 3), 0); put(c, SPHG, fmat('klett', { color: 0x6ab82a, roughness: 0.6 }), 0.012, y + 0.017, 0.01, 0.016, 0.006, 0.012); put(c, CYLG, fmat('kgarlic', { color: 0xfaf6ea, roughness: 0.3 }), 0, y + 0.0155, 0, 0.026, 0.002, 0.026); } }
};
FB.pizza = (g, chunks) => {
  const mk = (y0, y1, hw0, hw1) => { const s = new THREE.Shape(); s.moveTo(-hw0, y0); s.lineTo(hw0, y0); s.lineTo(hw1, y1); s.lineTo(-hw1, y1); s.closePath(); return s; };
  const bands = [[-0.12, -0.075, 0.0, 0.025], [-0.075, -0.03, 0.025, 0.05], [-0.03, 0.02, 0.05, 0.075], [0.02, 0.08, 0.075, 0.1]];
  bands.forEach(([z0, z1, w0, w1], i) => {
    const c = mkChunk(g, chunks, [0, 0.01, (z0 + z1) / 2 + 0.05]); const shp = mk(z0, z1, w0, w1);
    const base = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.008, bevelEnabled: false }), fmat('pizzaBase', { color: 0xd8a860, roughness: 0.8 })); base.rotation.x = -Math.PI / 2; base.position.y = 0; c.add(base);
    const top = new THREE.Mesh(new THREE.ShapeGeometry(shp), fmat('pizzaTop', { map: foodTex('pizza'), roughness: 0.55 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.0085; c.add(top);
    if (i % 2 === 0) put(c, CYLG, fmat('pep', { color: 0x9a2418, roughness: 0.5 }), (i - 1) * 0.004, 0.011, (z0 + z1) / 2, 0.014, 0.003, 0.014);
    if (i === 3) { put(c, CYLG, fmat('crust', { color: 0xd8a050, roughness: 0.75 }), 0, 0.007, 0.08, 0.1, 0.011, 0.012).rotation.z = Math.PI / 2; }
  });
  g.rotation.set(0, 0, 0); g.userData.flat = true;
};
FB.scallop = (g, chunks) => {
  const bat = fmat('batter', { map: foodTex('pastry'), roughness: 0.8, color: 0xf0d090 });
  put(g, CYLG, fmat('spaper', { color: 0xf0e8cc, roughness: 0.95 }), 0, 0.02, 0, 0.034, 0.04, 0.034);
  for (let s = 0; s < 4; s++) { const c = mkChunk(g, chunks, [0, 0.07, 0]); const th0 = s * 1.5708; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.016, 14, 1, false, th0, 1.5708), bat); m.scale.set(1, 1, 0.8); m.position.y = 0.07; c.add(m); const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.016, 14, 1, false, th0, 1.5708), fmat('batter2', { color: 0xf6e4b0, roughness: 0.9, side: THREE.DoubleSide })); m2.scale.set(0.96, 0.6, 0.76); m2.position.y = 0.07; c.add(m2); }
  g.rotation.x = 0;
};
const _foodCache = {};
function makeFood(kind) {
  const FDef = FOODS[kind] || FOODS.chips, g = new THREE.Group(), chunks = [];
  (FB[kind] || FB.chips)(g, chunks);
  g.userData.kind = kind; g.userData.chunks = chunks; g.userData.type = FDef.type; g.userData.bites = chunks;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
// map the old two-dish names
const legacyFood = (k, ev) => (k === 'parma' && ev === 'sunday') ? 'roast' : k;

// ================================================================== EATING (first person)
const Eat = {
  active: null,
  utensils: null,
  build() {
    // a fork and a knife that live in the viewmodel's hands while you eat
    const metal = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.35, roughness: 0.25, emissive: 0x606068, emissiveIntensity: 0.6 });
    const fork = new THREE.Group(); put(fork, BOXG, metal, 0, 0.07, 0, 0.012, 0.14, 0.003); for (let i = -1; i <= 1; i++) put(fork, BOXG, metal, i * 0.0045, 0.155, 0, 0.0012, 0.04, 0.0024); put(fork, BOXG, metal, 0, 0.138, 0, 0.012, 0.006, 0.0024);
    const knife = new THREE.Group(); put(knife, BOXG, metal, 0, 0.06, 0, 0.012, 0.12, 0.002); put(knife, BOXG, metal, 0.002, 0.15, 0, 0.012, 0.07, 0.0016);
    fork.visible = knife.visible = false; vm.R.g.add(fork); vm.L.g.add(knife);
    fork.position.set(0, 0, 0); fork.rotation.set(0, 0, 0); knife.position.set(0.022, 0.077, 0.0175); knife.rotation.set(Math.PI / 2, 0, 0);
    this.utensils = { fork, knife };
    const nap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.004, 0.09), fmat('napkin', { color: 0xf4f0ea, roughness: 0.95 })); nap.visible = false; vm.L.g.add(nap); nap.position.set(0.02, 0.05, 0.02); this.napkin = nap;
    this.tip = new THREE.Object3D(); fork.add(this.tip); this.tip.position.set(0, 0.17, 0);
  },
  // can the player start eating something right now?
  can() { return !this.active && Game.mode === 'play' && !player.seated && !MG.active && !(player.cig && player.cig.phase !== 'hold'); },
  // begin: model is a food group (already built); hungerKey = food id; from = { place(model) } puts leftovers back
  begin(kind, model, from = {}) {
    if (!this.can()) return false;
    const F = FOODS[kind] || FOODS.chips; if (!this.utensils) this.build();
    if (player.drink && !player.drink.onLedge) { player.sip = 0; }
    model.userData.chunks.forEach(c => c.visible = true);
    const A = this.active = { kind, F, m: model, from, chunks: model.userData.chunks.slice(), n: model.userData.chunks.length, bite: 0, t: 0, phase: 'serve', pt: 0, took: 0, cut: 0, holder: null, rest: V3(), done: false };
    if (model.parent) model.parent.remove(model);
    vm.root.add(model); A.restPlate = V3(0, -0.3, -0.5);
    model.position.copy(A.restPlate); model.rotation.set(0.62, 0, 0); model.scale.setScalar(1);
    if (player.drink && !player.drink.onLedge) { player.drink.group.visible = false; A.hidDrink = true; }
    if (F.type === 'hand') { vm.R.g.add(model); model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); this.hold(model, kind); }
    else { this.utensils.fork.visible = F.type === 'plate'; vm.R.setPose('grip', { rb: 0.009, rt: 0.009, h: 0.09 }); vm.R.gripD = null; }
    this.utensils.knife.visible = F.type === 'plate' && kind !== 'dimsim' && kind !== 'pav' && kind !== 'hsp';
    vm.R.g.visible = true; document.body.classList.add('eating'); A.pitch0 = player.pitch;
    Game.toast(`${F.type === 'hand' ? '' : 'Knife and fork. '}Q to put it down.`);
    SFX.noise(0.4, { freq: 3500, q: 1.2, gain: F.hot ? 0.04 : 0, pos: camera.position });
    return true;
  },
  hold(model, kind) {
    const D = { burger: { rb: 0.05, rt: 0.05, h: 0.06 }, pie: { rb: 0.05, rt: 0.05, h: 0.04 }, sausageroll: { rb: 0.03, rt: 0.03, h: 0.1 }, snags: { rb: 0.036, rt: 0.036, h: 0.1 }, kebab: { rb: 0.036, rt: 0.036, h: 0.1 }, pizza: { rb: 0.03, rt: 0.03, h: 0.02 }, scallop: { rb: 0.03, rt: 0.03, h: 0.06 } }[kind] || { rb: 0.04, rt: 0.04, h: 0.05 };
    vm.R.setPose('grip', D); vm.R.gripD = D;
    if (kind === 'pizza') { model.rotation.set(0, 0, 0); model.position.set(0, 0.012, -0.02); }
  },
  stop(cancel) {
    const A = this.active; if (!A) return; this.active = null;
    // good for you in proportion to how much you ate
    const frac = clamp(A.took / Math.max(1, A.n), 0, 1), s = Game.state, F = A.F;
    s.hunger = Math.max(0, s.hunger - F.hunger * frac); s.drunk = Math.max(0, s.drunk - F.drunk * frac); s.mood = Math.min(100, s.mood + F.mood * frac); SFX.eat();
    if (frac > 0.5) Night.ev('ate'); if (!A.counted && frac > 0.5) { A.counted = true; }
    document.body.classList.remove('eating');
    this.utensils.fork.visible = this.utensils.knife.visible = false; this.napkin.visible = false;
    vm.R.setPose('point'); vm.R.gripD = null; vm.L.g.visible = false;
    if (A.m.parent) A.m.parent.remove(A.m);
    if (A.hidDrink && player.drink) player.drink.group.visible = true;
    if (A.from.place) A.from.place(A.m, frac); else if (A.m.parent) A.m.parent.remove(A.m);
    if (frac > 0.9) { Game.toast(F.line); if (A.from.hotPlate) { } } else if (cancel && frac > 0) Game.toast('Pushed the rest aside.');
    if (this.finalize) this.finalize(A, frac);
  },
  update(dt, t) {
    const A = this.active; if (!A) return;
    A.t += dt; A.pt += dt; const F = A.F, R = vm.R.g, L = vm.L.g, mouth = V3(0.02, -0.12, -0.19), I = this.utensils;
    camera.updateMatrixWorld();
    // look down at the plate
    const wantPitch = F.type === 'hand' ? -0.12 : F.type === 'plate' ? -0.55 : -0.4; player.pitch += (wantPitch - player.pitch) * Math.min(1, dt * 3);
    const ph = A.phase;
    const goHand = (tgt, rot, k = 11) => { R.position.lerp(tgt, 1 - Math.exp(-k * dt)); R.rotation.x = damp(R.rotation.x, rot.x, 9, dt); R.rotation.y = damp(R.rotation.y, rot.y ?? 0, 9, dt); R.rotation.z = damp(R.rotation.z, rot.z ?? 0, 9, dt); };
    const goL = (tgt, rot, k = 10) => { L.visible = true; L.position.lerp(tgt, 1 - Math.exp(-k * dt)); L.rotation.x = damp(L.rotation.x, rot.x, 9, dt); L.rotation.y = damp(L.rotation.y, rot.y ?? 0, 9, dt); };
    const chunk = A.chunks[A.bite];
    // plate position in camera space (chunks wander so the fork has to find them)
    const chunkCam = c => { c.updateWorldMatrix(true, false); const at = c.userData.at ? c.userData.at.clone() : V3(); return camera.worldToLocal(A.m.localToWorld(at.clone())); };
    const bite = () => {
      const c = A.chunks[A.bite]; if (c) c.visible = false; A.bite++; A.took++;
      // crumbs / steam / a crunch
      const wp = camera.localToWorld(mouth.clone().add(V3(0, 0, -0.02)));
      const crisp = F.crunch;
      for (let i = 0; i < 4 + crisp * 5; i++) dropFX.emit(wp, V3(rand(-0.25, 0.25), rand(-0.1, 0.35), rand(-0.25, 0.25)), rand(0.004, 0.009), 1.4, 0.9, crisp > 0.5 ? [0.85, 0.65, 0.3] : [0.7, 0.4, 0.2]);
      SFX.noise(0.1 + crisp * 0.06, { freq: 900 + crisp * 2600, q: 1 + crisp * 1.5, gain: 0.05 + crisp * 0.04 }); SFX.noise(0.18, { delay: 0.12, freq: 600 + crisp * 1200, q: 1, gain: 0.04 });
      A.chew = 0.8; if (A.kind === 'kebab' && Math.random() < 0.5) dropFX.emit(wp.clone().add(V3(0, -0.1, 0)), V3(0, -0.2, 0), 0.01, 1.2, 0.9, [0.98, 0.96, 0.9]);
    };
    if (A.chew > 0) { A.chew -= dt; const k = Math.sin(A.chew * 22); camera.position.y += k * 0.002; camera.rotateX(k * 0.004); }
    if (F.type === 'hand') {
      // lift to the mouth, take a bite, chew, lower
      const rest = V3(0.17, -0.31, -0.44), restRot = V3(-0.25, 0, 0), liftRot = V3(-1.15, 0.0, 0);
      if (ph === 'serve') { goHand(rest, restRot); if (A.pt > 0.7) { A.phase = 'lift'; A.pt = 0; } }
      else if (ph === 'lift') { goHand(mouth.clone().add(V3(0.0, 0.0, -0.04)), liftRot, 8); if (A.pt > 0.62) { A.phase = 'bite'; A.pt = 0; bite(); } }
      else if (ph === 'bite') { goHand(mouth.clone().add(V3(0.0, 0.0, -0.01)), liftRot, 14); if (A.pt > 0.28) { A.phase = 'chew'; A.pt = 0; } }
      else if (ph === 'chew') { goHand(rest.clone().add(V3(0, 0.03, 0)), V3(-0.6, 0, 0), 7); if (A.pt > 0.95) { if (A.bite >= A.n) { A.phase = 'wipe'; A.pt = 0; } else { A.phase = 'lift'; A.pt = 0; } } }
      else if (ph === 'wipe') { this.napkin.visible = true; goHand(rest.clone().add(V3(0.1, -0.1, 0)), restRot); goL(V3(-0.02, -0.14, -0.2).add(V3(Math.sin(A.pt * 18) * 0.02, 0, 0)), V3(-0.9, 0, 0)); if (A.pt > 1.0) { this.stop(false); return; } }
    } else {
      // knife & fork (or fingers): cut, then fork down, lift, bite, chew
      const forkRot = V3(-0.95, 0, -0.1), mouthRot = V3(-1.35, 0, 0);
      const doCut = F.type === 'plate' && A.kind !== 'pav' && A.kind !== 'hsp' && A.kind !== 'dimsim';
      if (ph === 'serve') { goHand(V3(0.1, -0.3, -0.42), forkRot); if (doCut) goL(V3(-0.07, -0.27, -0.42), V3(-0.9, 0, 0)); if (A.pt > 0.8) { A.phase = doCut && A.kind !== 'roast' ? 'cut' : 'dip'; A.pt = 0; } }
      else if (ph === 'cut') {
        goHand(V3(0.08, -0.29, -0.44), forkRot); goL(V3(-0.06 + Math.sin(A.pt * 14) * 0.035, -0.27, -0.45), V3(-1.0, 0, 0.1));
        // the schnitzel parts as it's cut
        const sp = A.m.userData.strips; if (sp) sp.forEach((c, i) => { c.position.x = damp(c.position.x, (i - 2.5) * 0.004 * 2.2, 3, dt); });
        if (Math.random() < dt * 8) SFX.noise(0.05, { freq: 2500, q: 2, gain: 0.025 });
        if (A.pt > 1.5) { A.phase = 'dip'; A.pt = 0; }
      } else if (ph === 'dip') {
        const c = chunk; if (!c) { A.phase = 'wipe'; A.pt = 0; return; }
        const cp = chunkCam(c); goHand(cp.clone().add(V3(0.0, 0.05, 0.06)), forkRot, 12); if (doCut) goL(V3(-0.1, -0.3, -0.4), V3(-0.8, 0, 0));
        if (A.pt > 0.55) { A.phase = 'lift'; A.pt = 0; if (c) { A.speared = c; c.visible = false; this.spear(A, c); } }
      } else if (ph === 'lift') { goHand(mouth.clone().add(V3(0.03, -0.02, -0.04)), mouthRot, 9); if (A.pt > 0.55) { A.phase = 'bite'; A.pt = 0; if (A.spearM) { A.spearM.visible = false; } bite(); } }
      else if (ph === 'bite') { goHand(mouth.clone().add(V3(0.03, -0.02, -0.01)), mouthRot, 14); if (A.pt > 0.25) { A.phase = 'chew'; A.pt = 0; } }
      else if (ph === 'chew') { goHand(V3(0.12, -0.2, -0.3), V3(-0.7, 0, 0), 7); if (A.pt > 0.85) { if (A.bite >= A.n) { A.phase = 'wipe'; A.pt = 0; } else { A.phase = 'dip'; A.pt = 0; } } }
      else if (ph === 'wipe') { this.napkin.visible = true; goHand(V3(0.15, -0.34, -0.4), V3(-0.4, 0, 0)); goL(V3(-0.02, -0.14, -0.2).add(V3(Math.sin(A.pt * 18) * 0.02, 0, 0)), V3(-0.9, 0, 0)); if (A.pt > 1.0) { this.stop(false); return; } }
    }
  },
  // a copy of the chunk impaled on the fork tip, riding up to the mouth
  spear(A, c) {
    if (A.spearM && A.spearM.parent) A.spearM.parent.remove(A.spearM);
    const m = c.clone(true); m.visible = true; m.position.set(0, 0, 0); m.traverse(o => { if (o.position && o.parent === m && c.userData.at) { o.position.sub(c.userData.at); } });
    m.position.set(0, F_TIP(this, A), 0); m.scale.setScalar(0.8); m.rotation.set(0, 0, 0); (A.F.type === 'pick' ? vm.R.g : this.utensils.fork).add(m); A.spearM = m; A.spearM.userData.spear = true;
  },
  // drop a chunk copy from the fork once it's eaten
  finalize(A) { if (A.spearM && A.spearM.parent) A.spearM.parent.remove(A.spearM); },
};
// the plate's chunks need their local centre so the fork can find them: the builders record it in userData.at
// (chunks created without one fall back to the plate centre)

function F_TIP(E, A) { return A.F.type === 'pick' ? 0.04 : 0.17; }

// ================================================================== PATRONS EATING
// Some patrons who sit down at a lounge table or a beer-garden bench have a feed: the plate sits on the table in front
// of them (hand food is held), and they eat it a forkful / a bite at a time with the same chunk-per-bite models.
// The empty plate stays until they get up.
const NpcMeals = {
  list: [],
  seat(n) {
    const s = n.spot; if (!s || s.kind !== 'chair' || (s.area !== 'lounge' && s.area !== 'garden') || n.meal || n.role !== 'patron') return;
    const ev = Game.state.event, late = Game.state.time > 21.5;
    if (Math.random() > (ev === 'parma' ? 0.5 : 0.22) * (late ? 0.35 : 1)) return;
    const kind = ev === 'parma' && Math.random() < 0.6 ? 'parma' : ev === 'sunday' && Math.random() < 0.5 ? 'roast' : choice(['parma', 'schnitty', 'hsp', 'chips', 'chips', 'burger', 'pie', 'cheese', 'nuts', 'sausageroll', 'pav']);
    n.meal = { kind, type: FOODS[kind].type, spot: s, m: null, next: rand(3, 8), bites: 0, pending: true };
    this.list.push(n);
  },
  // put the food out: on the table (a plate or a bowl) or in the right hand (a pie, a burger)
  serve(n) {
    const M = n.meal, s = M.spot, m = makeFood(M.kind); M.m = m; M.pending = false; M.chunks = m.userData.chunks.slice();
    if (M.type === 'hand') { n.h.J.rH.add(m); m.position.set(0, -0.07, 0.05); m.scale.setScalar(0.9); }
    else { const fw = V3(Math.sin(s.ry), 0, Math.cos(s.ry)); m.position.copy(s.pos).addScaledVector(fw, s.area === 'garden' ? 0.3 : 0.42); m.position.y = 0.79; m.rotation.set(0, s.ry + Math.PI, 0); scene.add(m); }
    M.hadDrink = n.a.holdDrink; n.a.holdDrink = false; n.a.phone = false; n.glass.group.visible = false; n.a.dine = M.type === 'plate' ? 'plate' : 'hand';
  },
  leave(n) {
    const M = n.meal; if (!M) return; n.meal = null; if (n.a.dine && M.hadDrink) { n.a.holdDrink = true; n.glass.group.visible = true; } n.a.dine = null; n.a.eatT = 0;
    if (M.m) { if (M.type === 'hand' || !M.m.parent) { M.m.parent && M.m.parent.remove(M.m); } else { M.left = elapsed; this.left.push(M); } }
    const i = this.list.indexOf(n); if (i >= 0) this.list.splice(i, 1);
  },
  left: [],
  clear() { for (const n of this.list.slice()) this.leave(n); for (const M of this.left) M.m.parent && M.m.parent.remove(M.m); this.left = []; },
  update(dt) {
    for (const n of this.list.slice()) {
      const M = n.meal, a = n.a;
      if (!M || n.spot !== M.spot || n.state !== 'idle' || n.mg) { this.leave(n); continue; }
      // it arrives while nobody's looking straight at the table
      if (M.pending) { if ((M.next -= dt) <= 0 && n.dist2 > 30) this.serve(n); continue; }
      if (M.type === 'hand' && M.m) uprightInHand(M.m, n.ry, a.eatT > 0 ? Math.sin(clamp(a.eatT / 1.4, 0, 1) * Math.PI) * 0.9 : 0.25);
      if (a.eatT > 0) {
        const was = a.eatT; a.eatT = Math.max(0, a.eatT - dt);
        if (was > 0.7 && a.eatT <= 0.7) { const c = M.chunks[M.bites++]; if (c) c.visible = false; }
        continue;
      }
      if (M.bites >= M.chunks.length) { if (a.dine) { a.dine = null; if (M.type === 'hand') { M.m.parent && M.m.parent.remove(M.m); M.m = null; } n.a.holdDrink = !!M.hadDrink; n.glass.group.visible = !!M.hadDrink; } continue; }
      if (a.talk > 0 || a.laughT > 0) continue;
      if ((M.next -= dt) <= 0) { M.next = rand(3.5, 9); a.eatT = 1.4; }
    }
    // empty plates left behind are cleared once you're not right there
    for (let i = this.left.length - 1; i >= 0; i--) { const M = this.left[i]; if (elapsed - M.left > 45 || M.m.position.distanceTo(camera.position) > 9) { M.m.parent && M.m.parent.remove(M.m); this.left.splice(i, 1); } }
  },
};

const Food = {
  t: 0,
  // steam off hot plates sitting on the bar, only while you can see them
  update(dt) {
    this.t += dt; if (this.t < 0.18) return; this.t = 0;
    for (const it of Game.items) {
      if (it.kind !== 'food' || !it.mesh.userData.placedAt) continue; const age = elapsed - it.mesh.userData.placedAt;
      const F = FOODS[it.mesh.userData.kind]; if (!F.hot || age > 60 || it.mesh.position.distanceTo(camera.position) > 7) continue;
      smokeFX.emit(it.mesh.position.clone().add(V3(rand(-0.06, 0.06), 0.05, rand(-0.06, 0.06))), V3(rand(-0.015, 0.015), 0.13, rand(-0.015, 0.015)), 0.03, rand(1.6, 2.4), 0.1 * (1 - age / 60), [1, 1, 1], 0.05);
    }
  },
};
