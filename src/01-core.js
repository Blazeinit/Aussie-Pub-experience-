import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// =====================================================================
//  UTILITIES
// =====================================================================
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const smooth = t => t * t * (3 - 2 * t);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const fmt$ = v => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = v => (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-AU');
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _e1 = new THREE.Euler(), _m1 = new THREE.Matrix4();
function angleDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

const savedSettings = store('ld_settings');
const settings = Object.assign({
  quality: 'high', preset: 'high', sens: 1, vol: 0.8, music: 0.6, sfx: 1, amb: 1, fov: 72,
  resScale: 1, shadows: 'high', aa: true, bloom: true, bloomStr: 0.55, reflections: true, shafts: true, crowd: 1, dynres: true, showFps: false,
  cinematics: 'full', touch: 'auto', brightness: 1, vignette: 1, drunkFx: 1, headBob: true, reduceMotion: false, invertY: false, subtitles: true, subSize: 1, timeSpeed: 1, hints: true,
}, savedSettings || {});
// graphics presets: each sets a bundle of individual options (changing one by hand makes it 'custom')
const PRESETS = {
  low: { quality: 'low', resScale: 0.85, shadows: 'low', aa: false, bloom: true, bloomStr: 0.4, reflections: false, shafts: false, crowd: 0.7 },
  medium: { quality: 'high', resScale: 0.9, shadows: 'low', aa: false, bloom: true, bloomStr: 0.5, reflections: false, shafts: true, crowd: 0.85 },
  high: { quality: 'high', resScale: 1, shadows: 'high', aa: true, bloom: true, bloomStr: 0.55, reflections: true, shafts: true, crowd: 1 },
  ultra: { quality: 'high', resScale: 1, shadows: 'high', aa: true, bloom: true, bloomStr: 0.6, reflections: true, shafts: true, crowd: 1.25 },
};
function applyPreset(name) { if (PRESETS[name]) Object.assign(settings, PRESETS[name]); settings.preset = name; }
if (savedSettings && !savedSettings.preset && savedSettings.quality) applyPreset(savedSettings.quality === 'low' ? 'low' : 'high');
// first time on a phone or tablet: start on the lighter preset (no reflections, cheaper shadows, no MSAA) instead of 'high'
else if (!savedSettings && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) applyPreset('medium');
function saveSettings() { store('ld_settings', settings); }
const HIGH = () => settings.quality === 'high';

function setLoad(p, t) { $('loadbar').firstElementChild.style.width = (p * 100) + '%'; if (t) $('loadtxt').textContent = t; }

// ---- asset files (assets/…): served next to index.html, or embedded as data: URIs in the offline build.
// Every asset is optional: if one fails to load, the game falls back to its procedural version.
const ASSETS = { tex: {}, manifest: null, bodies: null, lightmaps: null };
function assetURL(p) { const E = window.__ASSETS; return (E && E[p]) || 'assets/' + p; }
async function fetchJSON(p) { try { const r = await fetch(assetURL(p)); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function loadTexture(p, srgb = true) {
  return new Promise(res => new THREE.TextureLoader().load(assetURL(p), t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t);
  }, undefined, () => res(null)));
}
// (retried: iOS Safari occasionally fails to decode a large embedded image under memory pressure)
function loadImage(p, tries = 3) { return new Promise(res => { const i = new Image(); i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => res(i)); i.onerror = () => tries > 1 ? setTimeout(() => loadImage(p, tries - 1).then(res), 400) : res(null); i.src = assetURL(p); }); }
const ENVHDR = {};   // real HDRI skies (Poly Haven, CC0, via the @pmndrs/assets npm package) used for reflections; see assets/env
const SLOTSKIN = {};   // licensed machine skins (assets/slots): exact screen art + symbol sprites, filled in by loadAssets
async function loadAssets(progress) {
  let skinsReady = Promise.resolve();
  const work = (async () => {
    const [man, bodies, lm] = await Promise.all([fetchJSON('tex/manifest.json'), fetchJSON('char/bodies.json'), fetchJSON('light/lightmaps.json')]);
    ASSETS.manifest = man; ASSETS.bodies = bodies; ASSETS.lightmaps = lm;
    const jobs = [];
    // the real machine screens are loaded first and waited for in full (a slow phone must never end up with blank generic
    // machines because the general asset timeout ran out), at a lower canvas resolution on phones to spare their memory
    const skins = await fetchJSON('slots/skins.json'), sj = [], phone = matchMedia('(pointer: coarse)').matches;
    if (skins) for (const id in skins) {
      const S = SLOTSKIN[id] = skins[id]; S.k = Math.min(1, (phone ? 820 : 1100) / Math.max(S.mw, S.mh));
      sj.push(loadImage(S.main).then(i => S.imgMain = i)); if (S.top) sj.push(loadImage(S.top).then(i => S.imgTop = i));
      if (S.front) sj.push(loadImage(S.front).then(i => S.imgFront = i)); if (S.sprites) sj.push(loadImage(S.sprites.img).then(i => S.imgSprites = i));
    }
    if (skins) { sj.push(loadImage('slots/hs_bg.jpg').then(i => SLOTSKIN.hsImg = i)); sj.push(loadImage('slots/ldl_banner.jpg').then(i => SLOTSKIN.bannerImg = i)); }
    skinsReady = Promise.all(sj); jobs.push(...sj);
    for (const k of ['sunset', 'night', 'park']) jobs.push(new EXRLoader().loadAsync(assetURL('env/' + k + '.exr')).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; ENVHDR[k] = t; }).catch(() => {}));
    if (man) for (const k in man) for (const ch of ['c', 'n', 'r']) if (man[k][ch]) jobs.push(loadTexture('tex/' + man[k][ch], ch === 'c').then(t => { (ASSETS.tex[k] = ASSETS.tex[k] || {})[ch] = t; }));
    if (lm) for (const k in lm.maps || {}) jobs.push(loadTexture('light/' + lm.maps[k].file, false).then(t => { if (t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.channel = 1; t.flipY = false; lm.maps[k].tex = t; } }));
    let done = 0; jobs.forEach(j => j.then(() => progress && progress(++done / jobs.length)));
    await Promise.all(jobs);
  })();
  await Promise.race([work, new Promise(r => setTimeout(r, 30000))]);
  await Promise.race([skinsReady, new Promise(r => setTimeout(r, 90000))]);
}
// physical-size aware texture: repeat so one tile covers its real-world size given UVs in metres/k
function pbr(name) { const t = ASSETS.tex[name]; return t && t.c ? t : null; }

// =====================================================================
//  RENDERER / SCENE / POST
// =====================================================================
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, powerPreference: 'high-performance', stencil: false });
// dynamic resolution: renderScale is adjusted at runtime to hold the frame rate
let renderScale = 1;
const basePR = () => Math.min(window.devicePixelRatio, settings.preset === 'ultra' ? 1.6 : HIGH() ? 1.25 : 0.9) * settings.resScale;
renderer.setPixelRatio(basePR());
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
// first launch: pick Low automatically on integrated / mobile / software GPUs
try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); window.__gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { window.__gpu = ''; }
if ((!savedSettings || !savedSettings.quality) && /intel|uhd|hd graphics|iris|mali|adreno|powervr|swiftshader|llvmpipe|basic render/i.test(window.__gpu)) { applyPreset('low'); renderer.setPixelRatio(basePR()); }
renderer.shadowMap.type = HIGH() ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // static world: shadow maps are refreshed on demand (big perf win)
renderer.info.autoReset = false; // counted per frame across all post passes (see the F3 overlay)
let shadowDirty = 3;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a1f2a, 0.018);
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.03, 1200);
// camera.fov is the vertical FOV as designed for a landscape screen.  On a narrow screen (a phone held upright) keep the
// horizontal view instead, so the bar, a pokie screen or a conversation partner isn't cropped off the sides.
{ const upd = camera.updateProjectionMatrix.bind(camera); camera.updateProjectionMatrix = function () {
  const ref = 1.25, f = this.fov; if (this.aspect >= ref) return upd();
  this.fov = Math.min(100, 2 * Math.atan(Math.tan(f * Math.PI / 360) * ref / this.aspect) * 180 / Math.PI); upd(); this.fov = f;
}; camera.updateProjectionMatrix(); }
camera.rotation.order = 'YXZ';
scene.add(camera);

const composerRT = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: settings.aa ? 4 : 0 });
const composer = new EffectComposer(renderer, composerRT);
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
// guard pass: kills NaN/Inf pixels and clamps extreme HDR before bloom (prevents black/white bloom boxes)
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; if (c.r != c.r || c.g != c.g || c.b != c.b) c = vec3(0.); gl_FragColor = vec4(clamp(c, 0.0, 40.0), 1.); }`
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.45, 0.82);
composer.addPass(bloom);
const fxPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uDrunk: { value: 0 }, uVig: { value: 0.35 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) }, uSmoke: { value: 0 }, uHang: { value: 0 }, uWarm: { value: 0 }, uNight: { value: 1 }, uDim: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uDrunk,uVig,uSmoke,uHang,uWarm,uNight,uDim; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv=vUv; float d=uDrunk;
      uv += vec2(sin(uv.y*7.+uTime*1.3), cos(uv.x*6.+uTime*1.1))*0.006*d;
      vec2 off = vec2(sin(uTime*.7), cos(uTime*.53))*0.012*d*d;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      if(d>0.05){ vec3 c2 = texture2D(tDiffuse, uv+off).rgb; c = mix(c, c2, .45*smoothstep(.05,.8,d)); }
      float ca = (0.0015 + 0.004*d) * smoothstep(.12, .7, length(vUv-.5)*1.4);   // fringe only toward the edges: the centre (pokie screen, faces) stays crisp
      c.r = mix(c.r, texture2D(tDiffuse, uv+vec2(ca,0.)).r, .6);
      c.b = mix(c.b, texture2D(tDiffuse, uv-vec2(ca,0.)).b, .6);
      // grade: warm amber pub interior, cool sodium-and-moonlight night outside
      float lum = dot(c, vec3(.2126,.7152,.0722));
      vec3 warm = c * vec3(1.06, 1.0, 0.9) + vec3(0.018, 0.009, 0.0) * (1. - smoothstep(0., .6, lum));
      vec3 cool = c * vec3(0.96, 1.0, 1.06) + vec3(0.0, 0.004, 0.014) * (1. - smoothstep(0., .5, lum)) * uNight;
      c = mix(cool, warm, uWarm);
      // smoke haze
      c = mix(c, vec3(dot(c,vec3(.3,.5,.2)))*1.05+0.02, uSmoke*.25);
      vec2 q = vUv-.5; float vig = 1. - dot(q,q)*(uVig*2.2 + d*1.2 + uHang*1.5);
      c *= clamp(vig,0.,1.) * (1. - uDim);
      gl_FragColor = vec4(c,1.);
    }`
});
composer.addPass(fxPass);
composer.addPass(new OutputPass());

const pmrem = new THREE.PMREMGenerator(renderer);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  fxPass.uniforms.uRes.value.set(innerWidth, innerHeight);
});
function setRenderScale(k) {
  renderScale = clamp(k, 0.5, 1);
  renderer.setPixelRatio(basePR() * renderScale);
  composer.setPixelRatio(renderer.getPixelRatio());
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
}
function applyQuality() {
  renderer.setPixelRatio(basePR() * renderScale);
  composer.setPixelRatio(renderer.getPixelRatio());
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.enabled = settings.bloom; bloom.strength = settings.bloomStr;
  const shadowsOn = settings.shadows !== 'off', type = settings.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.enabled !== shadowsOn || renderer.shadowMap.type !== type) { renderer.shadowMap.enabled = shadowsOn; renderer.shadowMap.type = type; scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); }); }
  if (window.__mirror) window.__mirror.visible = settings.reflections;
  if (window.__mirrorFallback) window.__mirrorFallback.visible = !settings.reflections;
  if (window.__gentsMirror) window.__gentsMirror.visible = settings.reflections;
  fxPass.uniforms.uVig.value = 0.35 * settings.vignette;
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--subsize', settings.subSize);
  if (typeof perf !== 'undefined') perf.show = settings.showFps || /[?&]perf/.test(location.search);
  if (typeof Game !== 'undefined') Game.timeScale = 0.8 / 60 * settings.timeSpeed;
  // Low: drop the optional lights and the decorative light shafts/dust
  (window.__optionalLights || []).forEach(l => l.visible = HIGH());
  if (typeof shadowDirty !== 'undefined') shadowDirty = 2;
}

// =====================================================================
//  AUDIO ENGINE  (fully synthesised WebAudio — no files needed)
// =====================================================================
const AudioSys = (() => {
  let ctx = null, master, comp, sfx, amb, mus, verb, verbSend, noiseBuf, started = false;
  const loops = {};
  const listener = { inside: false, gaming: false, pos: new THREE.Vector3() };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = settings.vol;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = settings.sfx; sfx.connect(master);
    amb = ctx.createGain(); amb.gain.value = settings.amb; amb.connect(master);
    mus = ctx.createGain(); mus.gain.value = settings.music; mus.connect(master);
    // reverb
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; verbSend = ctx.createGain(); verbSend.gain.value = 0.25; verbSend.connect(verb); verb.connect(master);
    sfx.connect(verbSend);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    started = true;
    startAmbience();
    Music.init();
  }
  function now() { return ctx ? ctx.currentTime : 0; }
  function spatial(pos, ref = 1) {
    if (!pos) return { g: 1, pan: 0 };
    _v1.copy(pos).applyMatrix4(camera.matrixWorldInverse);
    const d = _v1.length();
    let g = ref / (ref + Math.max(0, d - 1) * 0.55);
    const srcInside = isInside(pos.x, pos.z);
    if (srcInside !== listener.inside) g *= 0.25;
    return { g, pan: clamp(_v1.x / (d + 0.5), -0.9, 0.9) };
  }
  function out(pan, dest) {
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(dest || sfx); return p;
  }
  let hush = 0;   // SFX.quiet(): run something without a sound (fast-forwarding a feature, for one)
  function tone(f, dur, o = {}) {
    if (!started || hush) return;
    const t = now() + (o.delay || 0), sp = spatial(o.pos, o.ref);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const peak = (o.gain ?? 0.2) * sp.g;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(out(sp.pan + (o.pan || 0), o.dest)); osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }
  function noise(dur, o = {}) {
    if (!started || hush) return;
    const t = now() + (o.delay || 0), sp = spatial(o.pos, o.ref);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q ?? 1;
    if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur);
    const g = ctx.createGain(); const peak = (o.gain ?? 0.2) * sp.g;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out(sp.pan + (o.pan || 0), o.dest)); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  // --- SFX library ---
  const S = {
    step(surface, pos) {
      const m = { concrete: [900, 0.09, 0.07], timber: [420, 0.12, 0.12], carpet: [260, 0.05, 0.08], deck: [520, 0.12, 0.1], road: [700, 0.08, 0.07], tile: [1500, 0.08, 0.06], gravel: [1300, 0.16, 0.12] }[surface] || [600, .08, .08];
      noise(m[2], { freq: m[0] * rand(.85, 1.15), q: 1.2, gain: m[1], pos });
      if (surface === 'timber' || surface === 'deck') tone(rand(85, 110), 0.08, { gain: 0.06, pos });
    },
    quiet(f) { hush++; try { return f(); } finally { hush--; } },
    click() { noise(0.03, { freq: 3200, q: 3, gain: 0.12 }); tone(1800, 0.03, { gain: 0.05, type: 'square' }); },
    button() { tone(660, 0.06, { gain: 0.08, type: 'triangle' }); noise(0.02, { freq: 2500, gain: 0.08 }); },
    reelStop(i) { tone(140 - i * 6, 0.12, { gain: 0.22, fEnd: 60 }); noise(0.05, { freq: 1800, q: 2, gain: 0.1 }); },
    spinTick() { tone(rand(1100, 1300), 0.025, { gain: 0.035, type: 'square' }); },
    anticip(step) { tone(330 * Math.pow(1.06, step), 0.18, { gain: 0.07, type: 'sawtooth' }); },
    win(level) {
      const base = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
      const n = clamp(2 + level, 3, 6);
      for (let i = 0; i < n; i++) { tone(base[i], 0.35, { delay: i * 0.075, gain: 0.12, type: 'triangle' }); tone(base[i] * 2, 0.2, { delay: i * 0.075, gain: 0.03, type: 'sine' }); }
    },
    rollTick() { tone(rand(1500, 1700), 0.04, { gain: 0.03, type: 'triangle' }); },
    coin(pos) { const f = rand(2200, 3000); tone(f, 0.25, { gain: 0.06, pos }); tone(f * 1.51, 0.18, { gain: 0.04, pos }); },
    fanfare() { const seq = [523, 659, 784, 1046, 784, 1046, 1318]; seq.forEach((f, i) => { tone(f, 0.5, { delay: i * 0.12, gain: 0.12, type: 'sawtooth' }); tone(f / 2, 0.5, { delay: i * 0.12, gain: 0.08, type: 'triangle' }); }); },
    bell(pos, n = 1) { for (let k = 0; k < n; k++) { const d = k * 0.55; tone(880, 2.2, { delay: d, gain: 0.14, pos, ref: 4 }); tone(880 * 2.76, 1.4, { delay: d, gain: 0.05, pos, ref: 4 }); tone(880 * 5.4, 0.6, { delay: d, gain: 0.025, pos, ref: 4 }); } },
    jackpotBell() { for (let k = 0; k < 10; k++) { tone(1200, 0.12, { delay: k * 0.09, gain: 0.08, type: 'square' }); tone(1500, 0.12, { delay: k * 0.09 + 0.045, gain: 0.06, type: 'square' }); } },
    lighterClick() { noise(0.02, { freq: 4000, q: 4, gain: 0.25 }); tone(2600, 0.03, { gain: 0.05 }); },
    flame() { noise(0.6, { freq: 900, q: 0.6, gain: 0.08, attack: 0.04, filter: 'lowpass' }); },
    inhale() { noise(1.3, { freq: 2500, q: 0.4, gain: 0.04, attack: 0.3, filter: 'highpass' }); for (let i = 0; i < 14; i++) noise(0.012, { delay: rand(0.1, 1.2), freq: rand(3000, 6000), q: 5, gain: rand(0.04, 0.09) }); },
    exhale() { noise(1.4, { freq: 600, q: 0.5, gain: 0.07, attack: 0.08, fEnd: 300 }); },
    cough() { for (let i = 0; i < 3; i++) { noise(0.16, { delay: i * 0.28, freq: 380, q: 1.5, gain: 0.25, attack: 0.01 }); tone(140, 0.15, { delay: i * 0.28, gain: 0.08, type: 'sawtooth' }); } },
    clink(pos) { [2900, 4100, 5300].forEach((f, i) => tone(f * rand(.97, 1.03), 0.3 - i * 0.06, { gain: 0.05, pos })); },
    glassDown(pos) { tone(rand(180, 220), 0.06, { gain: 0.14, pos }); tone(3200, 0.12, { gain: 0.025, pos }); },
    gulp() { tone(rand(160, 210), 0.09, { gain: 0.12, fEnd: 90 }); noise(0.1, { freq: 500, q: 2, gain: 0.05 }); },
    ahh() { noise(0.5, { freq: 700, q: 3, gain: 0.05, attack: 0.05 }); },
    smash(pos) {
      noise(0.5, { freq: 3500, q: 0.5, gain: 0.5, filter: 'highpass', pos, ref: 3 });
      for (let i = 0; i < 12; i++) tone(rand(2500, 7000), rand(0.15, 0.5), { delay: rand(0, 0.25), gain: 0.05, pos, ref: 3 });
      tone(90, 0.15, { gain: 0.3, fEnd: 40, pos, ref: 3 });
    },
    cheer(pos, big = 1) {
      for (let i = 0; i < 6 * big; i++) noise(rand(0.8, 1.6), { delay: rand(0, 0.25), freq: rand(500, 1300), q: rand(3, 7), gain: 0.07, attack: 0.15, pos, ref: 5, fEnd: rand(800, 1700) });
      noise(1.6, { freq: 1500, q: 0.5, gain: 0.05, attack: 0.3, pos, ref: 5 });
    },
    door(pos) { tone(rand(140, 170), 0.5, { gain: 0.06, type: 'sawtooth', fEnd: 110, pos }); noise(0.3, { freq: 300, q: 1, gain: 0.08, pos }); },
    register(pos) { tone(2400, 0.08, { gain: 0.07, pos }); tone(3600, 0.6, { delay: 0.08, gain: 0.07, pos }); noise(0.15, { freq: 2000, q: 1, gain: 0.08, delay: 0.02, pos }); },
    beep() { tone(1400, 0.08, { gain: 0.06, type: 'square' }); },
    print() { for (let i = 0; i < 14; i++) noise(0.03, { delay: i * 0.05, freq: 2200, q: 3, gain: 0.06 }); },
    chimeAt(pos, scale = 1) {
      const pent = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5];
      const n = randi(3, 6), st = randi(0, 3), dirn = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) tone(pent[clamp(st + i * dirn + 3, 0, 7)] * scale, 0.3, { delay: i * 0.09, gain: 0.05, type: 'triangle', pos, ref: 2 });
    },
    pourStart() {
      if (!started || loops.pour) return;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.4;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.09, now(), 0.05);
      src.connect(f); f.connect(g); g.connect(sfx); src.start();
      loops.pour = { src, f, g };
    },
    pourUpdate(fill) { if (loops.pour) loops.pour.f.frequency.setTargetAtTime(500 + fill * 1400, now(), 0.1); },
    pourStop() { if (!loops.pour) return; const l = loops.pour; l.g.gain.setTargetAtTime(0, now(), 0.06); l.src.stop(now() + 0.4); loops.pour = null; },
    car() {
      if (S.carHook) S.carHook();
      if (!started) return;
      const dur = 6, t = now();
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1200, t + dur / 2); f.frequency.linearRampToValueAtTime(250, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(listener.inside ? 0.03 : 0.12, t + dur / 2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.9, t); p.pan.linearRampToValueAtTime(0.9, t + dur);
      src.connect(f); f.connect(g); g.connect(p); p.connect(amb); src.start(t); src.stop(t + dur);
    },
    atm() { [0, 0.15, 0.3].forEach(d => tone(1250, 0.07, { delay: d, gain: 0.06, type: 'square' })); for (let i = 0; i < 20; i++) noise(0.02, { delay: 0.6 + i * 0.03, freq: 1500, q: 2, gain: 0.05 }); },
    laugh(pos) { const f0 = rand(220, 340); for (let i = 0; i < randi(3, 5); i++) { noise(0.11, { delay: i * 0.16, freq: f0 * 3.2, q: 6, gain: 0.08, attack: 0.01, pos, ref: 2 }); tone(f0 * (1 + i * 0.03), 0.1, { delay: i * 0.16, gain: 0.03, type: 'triangle', pos, ref: 2 }); } },
    eat() { for (let i = 0; i < 5; i++) noise(0.08, { delay: i * 0.22, freq: 1800, q: 1, gain: 0.07 }); },
  };
  // --- continuous ambience ---
  function mkNoiseLoop(type, freq, q, dest) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(dest || amb); src.start(0, Math.random() * 2);
    return { src, f, g, target: 0, base: freq, phase: Math.random() * 10 };
  }
  function startAmbience() {
    loops.murmur = [];
    for (let i = 0; i < 6; i++) loops.murmur.push(mkNoiseLoop('bandpass', 350 + i * 260, 3 + Math.random() * 3));
    loops.wind = mkNoiseLoop('lowpass', 380, 0.6);
    loops.rain = mkNoiseLoop('highpass', 2500, 0.4);
    loops.rainRoof = mkNoiseLoop('lowpass', 700, 0.5);
    loops.hum = mkNoiseLoop('lowpass', 120, 1);
    loops.fire = mkNoiseLoop('bandpass', 1800, 1.5);
  }
  let chimeT = 0, cricketT = 0, carT = 8, clinkT = 3;
  const amp = { crowd: 0.5, rain: 0, outdoorNight: 1 };
  function update(dt, state) {
    if (!started) return;
    const t = now();
    listener.inside = state.inside; listener.gaming = state.gaming; listener.pos.copy(state.pos);
    const insideF = state.inside ? 1 : 0.18;
    const crowd = amp.crowd;
    loops.murmur.forEach((m, i) => {
      m.phase += dt * (0.7 + i * 0.23);
      const mod = 0.55 + 0.45 * Math.sin(m.phase) * Math.sin(m.phase * 0.37 + i);
      m.g.gain.setTargetAtTime(0.022 * crowd * insideF * mod * (state.gaming ? 0.6 : 1), t, 0.15);
      m.f.frequency.setTargetAtTime(m.base * (0.9 + 0.2 * Math.sin(m.phase * 1.7)), t, 0.2);
    });
    loops.wind.g.gain.setTargetAtTime(state.inside ? 0.01 : 0.05 + 0.03 * Math.sin(t * 0.3), t, 0.5);
    loops.rain.g.gain.setTargetAtTime(amp.rain * (state.inside ? 0.015 : 0.09), t, 0.5);
    loops.rainRoof.g.gain.setTargetAtTime(amp.rain * (state.inside ? 0.06 : 0.02), t, 0.5);
    loops.hum.g.gain.setTargetAtTime(state.gaming ? 0.05 : (state.inside ? 0.02 : 0.0), t, 0.3);
    const fd = state.firePos ? state.pos.distanceTo(state.firePos) : 99;
    loops.fire.g.gain.setTargetAtTime(state.inside ? 0.04 / (1 + fd * 0.5) * (0.6 + Math.random() * 0.8) : 0, t, 0.05);
    verbSend.gain.setTargetAtTime(state.inside ? 0.22 : 0.05, t, 0.3);
    // gaming room chimes
    chimeT -= dt;
    if (chimeT <= 0 && state.machinePositions && state.machinePositions.length) {
      chimeT = state.gaming ? rand(0.4, 1.6) : rand(1.5, 4);
      S.chimeAt(choice(state.machinePositions), choice([1, 1, 1.122, 0.891]));
    }
    // crickets outside at night
    cricketT -= dt;
    if (cricketT <= 0 && amp.outdoorNight > 0.3 && amp.rain < 0.5) {
      cricketT = rand(0.6, 2.2);
      const g = state.inside ? 0.004 : 0.018, pan = rand(-0.8, 0.8);
      for (let i = 0; i < randi(3, 6); i++) tone(4600 + rand(-80, 80), 0.035, { delay: i * 0.06, gain: g, pan });
    }
    carT -= dt; if (carT <= 0) { carT = rand(25, 60); S.car(); }
    clinkT -= dt;
    if (clinkT <= 0 && state.inside) { clinkT = rand(2, 7) / Math.max(0.3, crowd); S.clink(V3(rand(-10, 10), 1, rand(-16, 0))); }
    Music.update(dt, state);
  }
  function setVolume() { if (master) master.gain.value = settings.vol; if (mus) mus.gain.value = settings.music; if (sfx) sfx.gain.value = settings.sfx; if (amb) amb.gain.value = settings.amb; }
  return { init, S, update, amp, setVolume, get ctx() { return ctx; }, get mus() { return mus; }, get started() { return started; }, spatial, tone, noise };
})();
const SFX = AudioSys.S;
SFX.tone = AudioSys.tone; SFX.noise = AudioSys.noise;

// ---- Jukebox: Karplus-Strong pub rock, scheduled with lookahead ----
const Music = (() => {
  let ctx, out, pan, gainNode, buffers = {}, nextBar = 0, bar = 0, song = 0, ready = false;
  const SONGS = [
    { name: 'Knock-Off Boogie', bpm: 124, prog: ['E', 'E', 'A', 'B'], feel: 'straight' },
    { name: 'Sunday Arvo Shuffle', bpm: 104, prog: ['A', 'D', 'E', 'D'], feel: 'shuffle' },
    { name: 'Back of the Ute', bpm: 138, prog: ['G', 'C', 'D', 'C'], feel: 'straight' },
    { name: 'Bush Telegraph', bpm: 96, prog: ['D', 'G', 'A', 'G'], feel: 'shuffle' },
    // real recordings (assets/music) — the jukebox falls back to the synth band if a file can't load
    { name: 'Friday Knock-Off', file: 'music/friday-knock-off.mp3', artist: 'cyelune', feel: '6 min · the Friday anthem' },
    { name: 'Maccas Farm', file: 'music/maccas-farm.mp3', artist: 'cyelune', feel: '2:52' },
    { name: 'The Uni People Have No Clue', file: 'music/the-uni-people-have-no-clue.mp3', artist: 'cyelune', feel: '3:10' },
    { name: 'One Nation, Pauline', file: 'music/one-nation-pauline.mp3', artist: 'cyelune', feel: '3:46' }];
  let audioEl = null, audioSrc = null, broken = {};
  // play a recorded track through the same spatial jukebox chain as the synth band
  function playFile(i) {
    const S = SONGS[i];
    if (!ctx || !S.file || broken[i]) return false;
    if (!audioEl) { audioEl = new Audio(); audioEl.crossOrigin = 'anonymous'; audioEl.preload = 'auto'; audioSrc = ctx.createMediaElementSource(audioEl); audioSrc.connect(out); audioEl.onended = () => { const files = SONGS.map((s, k) => s.file && !broken[k] ? k : -1).filter(k => k >= 0 && k !== song); setSong(files.length ? choice(files) : 0); }; }
    audioEl.onerror = () => { broken[i] = true; if (song === i) setSong(0); };
    audioEl.src = assetURL(S.file); audioEl.currentTime = 0;
    const p = audioEl.play(); if (p && p.catch) p.catch(() => {});
    return true;
  }
  function setSong(v) {
    song = ((v % SONGS.length) + SONGS.length) % SONGS.length; bar = 0;
    if (SONGS[song].file) { if (!playFile(song)) { pendingFile = true; } }
    else if (audioEl) audioEl.pause();
  }
  let pendingFile = false;
  const ROOT = { E: 82.41, A: 110, B: 123.47, D: 73.42, G: 98, C: 65.41 };
  function ks(freq, dur, bright = 0.5) {
    const sr = ctx.sampleRate, n = Math.floor(sr * dur), b = new Float32Array(n);
    const P = Math.round(sr / freq), buf = new Float32Array(P);
    for (let i = 0; i < P; i++) buf[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const a = buf[idx], c = buf[(idx + 1) % P];
      const v = (a * (1 - bright * 0.5) + c * (0.5 + bright * 0.5)) * 0.996 * 0.5 + (a + c) * 0.25;
      buf[idx] = v * 0.998; b[i] = a; idx = (idx + 1) % P;
    }
    return b;
  }
  function chord(rootF) {
    const sr = ctx.sampleRate, dur = 0.9, n = Math.floor(sr * dur);
    const ab = ctx.createBuffer(1, n, sr), d = ab.getChannelData(0);
    [1, 1.4983, 2].forEach((m, k) => {
      const s = ks(rootF * 2 * m, dur, 0.7), off = Math.floor(k * 0.008 * sr);
      for (let i = 0; i + off < n; i++) d[i + off] += s[i] * 0.33;
    });
    // gentle overdrive
    for (let i = 0; i < n; i++) d[i] = Math.tanh(d[i] * 2.6) * 0.5;
    return ab;
  }
  function init() {
    ctx = AudioSys.ctx; if (!ctx) return;
    gainNode = ctx.createGain(); gainNode.gain.value = 0;
    pan = ctx.createStereoPanner();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; out = lp;
    lp.connect(gainNode); gainNode.connect(pan); pan.connect(AudioSys.mus);
    for (const k in ROOT) buffers[k] = chord(ROOT[k]);
    nextBar = ctx.currentTime + 0.5; ready = true;
  }
  function play(buf, t, g, rate = 1) { const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; const gg = ctx.createGain(); gg.gain.value = g; s.connect(gg); gg.connect(out); s.start(t); }
  function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); }
  function snare(t) {
    const nb = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
    const s = ctx.createBufferSource(); s.buffer = nb; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; const g = ctx.createGain(); g.gain.value = 0.35; s.connect(f); f.connect(g); g.connect(out); s.start(t);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(0.18, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12);
  }
  function hat(t, g = 0.06) {
    const nb = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    const s = ctx.createBufferSource(); s.buffer = nb; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const gg = ctx.createGain(); gg.gain.value = g; s.connect(f); f.connect(gg); gg.connect(out); s.start(t);
  }
  function bass(f, t, dur) { const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; o.type = 'sawtooth'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); }
  function scheduleBar(t) {
    const S = SONGS[song], beat = 60 / S.bpm, key = S.prog[bar % 4];
    for (let e = 0; e < 8; e++) {
      const sw = S.feel === 'shuffle' && e % 2 === 1 ? beat * 0.17 : 0;
      const tt = t + e * beat / 2 + sw;
      play(buffers[key], tt, e % 2 ? 0.5 : 0.75);
      bass(ROOT[key], tt, beat / 2 * 0.9);
      hat(tt, e % 2 ? 0.035 : 0.06);
      if (e === 0 || e === 4 || (e === 5 && bar % 2)) kick(tt);
      if (e === 2 || e === 6) snare(tt);
    }
    bar++;
    return t + beat * 4;
  }
  let level = 0.5;
  function update(dt, state) {
    if (!ready) return;
    if (pendingFile) { pendingFile = false; if (!playFile(song)) setSong(0); }
    if (!SONGS[song].file) while (nextBar < ctx.currentTime + 0.3) nextBar = scheduleBar(Math.max(nextBar, ctx.currentTime + 0.05));
    else nextBar = ctx.currentTime + 0.1;
    const sp = AudioSys.spatial(state.jukePos || V3(), 3);
    gainNode.gain.setTargetAtTime(level * sp.g * 0.6, ctx.currentTime, 0.2);
    pan.pan.setTargetAtTime(sp.pan, ctx.currentTime, 0.2);
    out.frequency.setTargetAtTime(state.inside ? 4200 : 900, ctx.currentTime, 0.3);
  }
  return { init, update, SONGS, get audio() { return audioEl; }, set song(v) { setSong(v); }, get song() { return song; }, set level(v) { level = v; }, get level() { return level; }, get file() { return !!SONGS[song].file; }, pick(event) { if (typeof VENUE !== 'undefined' && VENUE.songs && Math.random() < 0.85) { const o = VENUE.songs.filter(k => !broken[k]); if (o.length) return choice(o); } const f = SONGS.map((s, k) => s.file && !broken[k] ? k : -1).filter(k => k >= 0); if (event === 'knockoff' && f.includes(4)) return 4; return f.length && Math.random() < 0.75 ? choice(f) : randi(0, 3); } };
})();
