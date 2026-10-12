
// =====================================================================
//  POKIE IMMERSION: what you see when you're sat at a machine
//  LED edge lighting that reacts to the game, glass glare on the screen, the screen's light on your
//  hands, glowing deck buttons, a blinking note acceptor, head glances, and big-win celebrations.
// =====================================================================
const PokieFX = {
  m: null, t: 0, shake: 0, glanceX: 0, glanceY: 0, flash: 0, burstT: 0,
  build() {
    // one light that only shines while you're seated: the screen's glow on your hands, drink and the deck
    this.light = new THREE.PointLight(0xffffff, 0, 2.2, 2); scene.add(this.light);
    this.ledMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: new THREE.Color(1, 0.6, 0.2) }, uB: { value: new THREE.Color(1, 0.2, 0.4) }, uMode: { value: 0 }, uI: { value: 1 } },
      transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec2 vUv; uniform float uT, uMode, uI; uniform vec3 uA, uB;
        vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        void main(){
          float y = vUv.y, edge = smoothstep(0.,.35,vUv.x)*smoothstep(1.,.65,vUv.x);
          vec3 c; float b;
          if (uMode < .5) { b = .55 + .45*sin(uT*1.6 - y*3.); c = mix(uA, uB, .5+.5*sin(y*6.+uT*.7)); }            // idle: slow breathing
          else if (uMode < 1.5) { b = .35 + .65*pow(.5+.5*sin(y*28. - uT*22.), 3.); c = uA; }                          // spinning: chase
          else if (uMode < 2.5) { b = .6 + .4*sin(uT*14. + y*10.); c = mix(uA, vec3(1.,.95,.6), .5+.5*sin(uT*9.)); } // win
          else { b = .7 + .3*step(.5, fract(uT*8.)); c = hue(fract(y*.8 - uT*.9)); }                                   // big win / feature: rainbow strobe
          gl_FragColor = vec4(c * b * uI * 2.2, edge);
        }`
    });
    // glare: a soft diagonal sheen across the screen glass
    const gc = mkCanvas(256, 256), x = gc.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.38, 'rgba(255,255,255,0)'); g.addColorStop(0.46, 'rgba(255,255,255,.16)'); g.addColorStop(0.52, 'rgba(255,255,255,.05)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.04)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const vg = x.createRadialGradient(128, 128, 60, 128, 128, 190); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = vg; x.fillRect(0, 0, 256, 256);
    this.glareMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.NormalBlending });
    this.glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.02, metalness: 0.9, transparent: true, opacity: 0.12, depthWrite: false }); interiorMats.push(this.glassMat);
    addEventListener('mousemove', e => { this.mx = e.clientX / innerWidth * 2 - 1; this.my = e.clientY / innerHeight * 2 - 1; });
  },
  attach(m) {
    this.detach();
    this.m = m; const g = new THREE.Group(); m.root.add(g); this.group = g;
    const th = m.game.theme;
    this.ledMat.uniforms.uA.value.set(th.glow); this.ledMat.uniforms.uB.value.set(th.accent);
    // LED light bars hugging the screen and down the cabinet sides, plus an arc over the topper
    const bar = (w, h, x, y, z, rz = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.ledMat); p.position.set(x, y, z); p.rotation.z = rz; p.renderOrder = 4; g.add(p); return p; };
    for (const s of [-1, 1]) { bar(0.03, 0.62, s * 0.322, 1.44, 0.05); bar(0.026, 0.9, s * 0.338, 0.62, 0.315); }
    bar(0.03, 0.66, 0, 1.69, 0.05, Math.PI / 2); bar(0.03, 0.66, 0, 1.19, 0.05, Math.PI / 2);
    // glass + glare over the screen
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), this.glassMat); glass.position.set(0, 1.44, 0.047); glass.renderOrder = 3; g.add(glass);
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), this.glareMat); glare.position.set(0, 1.44, 0.049); glare.renderOrder = 4; g.add(glare); this.glare = glare;
    // proper glowing buttons on the deck (sit over the printed ones)
    this.caps = [];
    for (const b of DECK_BTNS) {
      const col = new THREE.Color(b.c);
      const cap = new THREE.Mesh(new RoundedBoxGeometry(0.074, 0.076, 0.014, 2, 0.006), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.25, transparent: true, opacity: 0.5 }));
      cap.position.set((b.x / 512 - 0.5) * 0.62, (0.5 - 178 / 264) * 0.32, 0.008); m.deck.add(cap); cap.userData.id = b.id; this.caps.push(cap);
    }
    // note acceptor bezel that blinks green
    this.acceptor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 0.6), toneMapped: false })); this.acceptor.position.set(0.2, 0.89, 0.342); g.add(this.acceptor);
    // the screen's own light
    m.screenW && this.light.position.copy(m.screenW).addScaledVector(m.fw, 0.45).add(V3(0, -0.1, 0));
    this.light.color.set(th.glow); this.flash = 0;
  },
  detach() {
    if (!this.m) return;
    this.m.root.remove(this.group); this.caps.forEach(c => this.m.deck.remove(c));
    this.group.traverse(o => { if (o.geometry && o.geometry !== MGEO.screen) o.geometry.dispose(); });
    this.m = null; this.light.intensity = 0; this.shake = 0;
  },
  celebrate(level) { this.shake = Math.min(1, 0.4 + level / 60); this.flash = 1; this.burstT = 2.5 + Math.min(4, level / 20); },
  press(id) { const c = this.caps && this.caps.find(c => c.userData.id === id); if (c) { c.position.z = 0.003; c.material.emissiveIntensity = 1.4; setTimeout(() => { c.position.z = 0.008; c.material.emissiveIntensity = 0.35; }, 140); } },
  update(dt) {
    const m = this.m; if (!m) return;
    this.t += dt; const u = this.ledMat.uniforms; u.uT.value = this.t;
    const st = m.state, bigWin = this.burstT > 0, feat = ['featIntro', 'holdspin', 'wheel', 'pick'].includes(st) || m.free;
    u.uMode.value = bigWin || feat ? 3 : st === 'spinning' ? 1 : (st === 'showWin' && m.win > 0) ? 2 : 0;
    u.uI.value = 0.8 + (st === 'spinning' ? 0.3 : 0) + this.flash;
    this.flash = Math.max(0, this.flash - dt * 0.8); this.burstT = Math.max(0, this.burstT - dt);
    // the screen's glow on your hands: brighter and warmer on wins
    const base = 0.55 + (st === 'spinning' ? 0.15 * Math.sin(this.t * 30) : 0) + this.flash * 2.2 + (bigWin ? 0.8 * (Math.sin(this.t * 20) > 0 ? 1 : 0.3) : 0);
    this.light.intensity = damp(this.light.intensity, base * 1.4, 10, dt);
    if (bigWin) this.light.color.setHSL((this.t * 0.8) % 1, 0.8, 0.6); else this.light.color.lerp(_c1.set(m.game.theme.glow), Math.min(1, dt * 3));
    this.acceptor.material.color.setRGB(0.2, (Math.sin(this.t * 4) > 0 ? 2.2 : 0.4), 0.6);
    // deck buttons: SPIN pulses when it's your go; gamble glows when it's on offer
    for (const c of this.caps) { const on = c.userData.id === 'gamble' ? (m.gambleOK && m.lastWin > 0 && st === 'showWin') : c.userData.id === 'collect' ? m.credit > 0 : true; c.material.opacity = on ? 0.55 : 0.18; }
    if (m.btns[5] && m.btns[5].material) m.btns[5].material.color.setRGB(0.35, (m.canSpin() ? 1.4 + Math.sin(this.t * 5) * 0.5 : 0.6), 0.55);
    // coins fountain on a big win
    if (bigWin && Math.random() < dt * 40) { const p = m.screenW.clone().addScaledVector(m.fw, 0.3).add(V3(rand(-0.25, 0.25), -0.45, rand(-0.05, 0.05))); sparkFX.emit(p, m.fw.clone().multiplyScalar(rand(0.3, 0.9)).add(V3(rand(-0.4, 0.4), rand(1.6, 2.6), 0)), 0.012, 1.4, 1, [1, 0.82, 0.25]); }
  },
  // applied on top of the seated camera: a glance toward the mouse, breathing, and shake on big wins
  cam(dt, t) {
    if (!this.m) return;
    const k = settings.reduceMotion ? 0 : 1;
    this.glanceX = damp(this.glanceX, (this.mx || 0) * 0.16 * k, 3, dt); this.glanceY = damp(this.glanceY, (this.my || 0) * 0.08 * k, 3, dt);
    camera.rotateY(-this.glanceX); camera.rotateX(-this.glanceY);
    camera.position.y += Math.sin(t * 1.1) * 0.003 * k;
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 0.6); const s = this.shake * 0.012 * k; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.rotateZ((Math.random() - 0.5) * s * 0.6); }
  },
};
const _c1 = new THREE.Color();
