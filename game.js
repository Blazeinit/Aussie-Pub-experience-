// ---- src/01-core.js ----
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
function loadImage(p) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = assetURL(p); }); }
const ENVHDR = {};   // real HDRI skies (Poly Haven, CC0, via the @pmndrs/assets npm package) used for reflections; see assets/env
const SLOTSKIN = {};   // licensed machine skins (assets/slots): exact screen art + symbol sprites, filled in by loadAssets
async function loadAssets(progress) {
  const work = (async () => {
    const [man, bodies, lm] = await Promise.all([fetchJSON('tex/manifest.json'), fetchJSON('char/bodies.json'), fetchJSON('light/lightmaps.json')]);
    ASSETS.manifest = man; ASSETS.bodies = bodies; ASSETS.lightmaps = lm;
    const jobs = [];
    const skins = await fetchJSON('slots/skins.json');
    if (skins) for (const id in skins) {
      const S = SLOTSKIN[id] = skins[id]; S.k = Math.min(1, 1100 / Math.max(S.mw, S.mh));
      jobs.push(loadImage(S.main).then(i => S.imgMain = i)); if (S.top) jobs.push(loadImage(S.top).then(i => S.imgTop = i));
      if (S.front) jobs.push(loadImage(S.front).then(i => S.imgFront = i)); if (S.sprites) jobs.push(loadImage(S.sprites.img).then(i => S.imgSprites = i));
    }
    for (const k of ['sunset', 'night', 'park']) jobs.push(new EXRLoader().loadAsync(assetURL('env/' + k + '.exr')).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; ENVHDR[k] = t; }).catch(() => {}));
    if (skins) { jobs.push(loadImage('slots/hs_bg.jpg').then(i => SLOTSKIN.hsImg = i)); jobs.push(loadImage('slots/ldl_banner.jpg').then(i => SLOTSKIN.bannerImg = i)); }
    if (man) for (const k in man) for (const ch of ['c', 'n', 'r']) if (man[k][ch]) jobs.push(loadTexture('tex/' + man[k][ch], ch === 'c').then(t => { (ASSETS.tex[k] = ASSETS.tex[k] || {})[ch] = t; }));
    if (lm) for (const k in lm.maps || {}) jobs.push(loadTexture('light/' + lm.maps[k].file, false).then(t => { if (t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.channel = 1; t.flipY = false; lm.maps[k].tex = t; } }));
    let done = 0; jobs.forEach(j => j.then(() => progress && progress(++done / jobs.length)));
    await Promise.all(jobs);
  })();
  await Promise.race([work, new Promise(r => setTimeout(r, 30000))]);
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
  function tone(f, dur, o = {}) {
    if (!started) return;
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
    if (!started) return;
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

// ---- src/01-venue.js ----

// =====================================================================
//  VENUES: which pub you're in tonight.
//  A venue is data: its name and signage, colours, machine lineup, prices, crowd, soundtrack and locals.
//  The world is built once at boot for the chosen venue; "catching a cab" to another pub saves the game
//  and reloads into it (so nothing needs unloading and the static batches stay valid).
// =====================================================================
const VENUES = {
  royal: {
    id: 'royal', name: 'THE ROYAL', hotel: 'ROYAL HOTEL', est: 'EST. 1888', short: 'the Royal', sub: 'FINE ALES · WINES · SPIRITS', terrazzo: 'ROYAL',
    blurb: "Wattle Creek's last proper pub. Pressed-tin ceilings, a Dragon Link bank out the back, and everyone you know.",
    story: true, priceMul: 1, crowd: 1, exposure: 1, warm: 1, fare: 0,
    tint: { carpet: 0xffffff, gaming: 0x6a3a4a, paint: 0xffffff, ceiling: 0xc8bca0, wood: 0xffffff },
    fascia: ['#1f4d34', '#123222', '#f0cf6a'], roof: '#7a1f14', roofStroke: '#f3e2b8', deckLine: 'THE ROYAL · GAMING · 1c',
    machines: {
      back: ['am', 'gc', 'pm', 'hp', 'ldl1', 'ldl2', 'ldl3', 'ldl4'], front: ['fm', 'te1', 'te2'], rear: ['qotn', 'bigred', 'buffalo'], terrace: ['dragon', 'outback', 'reef', 'sevens']
    },
    pal: { carpet: ['#3b0c14', '#c99a2e', '#1b6d73', '#d6a838', '#7a1424', '#e8c35a', '#2a8a7f'], damask: ['#d6c49a', '150,108,40', '120,80,25', '170,125,50'] },
    bartenders: ['Jacko', 'Rhonda', 'Mick'], songs: null, moments: null,
  },
  rsl: {
    id: 'rsl', name: 'WATTLE CREEK RSL', hotel: 'RSL SUB-BRANCH', est: 'EST. 1921', short: 'the RSL', sub: 'MEMBERS & GUESTS WELCOME', terrazzo: 'RSL',
    blurb: 'The club. Carpet you could land a plane on, a courtesy bus, $14 schnitty night, and the newest machines in town: Lightning Dollar Link, Thunder Empire and Fire Mountain.',
    story: false, priceMul: 0.82, crowd: 1.2, exposure: 1.08, warm: 0.5, fare: 12, unlock: 0,
    tint: { carpet: 0xffffff, gaming: 0x2a3a6a, paint: 0xffffff, ceiling: 0xd2d6dc, wood: 0xc8b8a8 },
    fascia: ['#14305a', '#0a1a3a', '#e8c56a'], roof: '#14305a', roofStroke: '#f1e4bd', deckLine: 'WATTLE CREEK RSL · GAMING · 1c',
    machines: {
      back: ['ldl1', 'ldl2', 'ldl3', 'ldl4', 'te1', 'te2', 'fm', 'fm'], front: ['fm', 'te1', 'te2'], rear: ['am', 'gc', 'hp'], terrace: ['bigred', 'qotn', 'buffalo', 'dragon']
    },
    pal: { carpet: ['#0f2350', '#b8c4e0', '#4a78d0', '#dcdcc0', '#243a78', '#f0e8c0', '#3a6ab0'], damask: ['#8fb2e6', '40,72,150', '28,52,115', '60,96,170'] },
    bartenders: ['Lorraine', 'Digger', 'Marg'], songs: [4, 6, 5, 0], moments: ['footy', 'inspector', 'busker', 'wake'],
  },
  dive: {
    id: 'dive', name: 'THE RUSTY ANCHOR', hotel: 'RUSTY ANCHOR', est: 'EST. 1964', short: 'the Rusty Anchor', sub: 'COLD BEER · HOT CHIPS · NO DRAMA', terrazzo: 'ANCHOR',
    blurb: "A sticky-carpet dive near the wharf. Cheap pots, old-school pokies (Queen of the Nile, Big Red, 5 Dragons), loud bands and a bouncer called Tiny.",
    story: false, priceMul: 0.7, crowd: 1.05, exposure: 0.84, warm: 1.15, fare: 8, unlock: 15,
    tint: { carpet: 0xffffff, gaming: 0x3a2a2a, paint: 0xffffff, ceiling: 0xa09074, wood: 0x9a8a78 },
    fascia: ['#2a1a14', '#140a08', '#e8a050'], roof: '#5a2a14', roofStroke: '#e8c88a', deckLine: 'THE RUSTY ANCHOR · POKIES · 1c',
    machines: {
      back: ['qotn', 'qotn', 'bigred', 'bigred', 'buffalo', 'dragon', 'outback', 'sevens'], front: ['reef', 'sevens', 'dragon'], rear: ['am', 'pm', 'gc'], terrace: ['outback', 'reef', 'qotn', 'bigred']
    },
    pal: { carpet: ['#2a1410', '#7a5030', '#5a4636', '#9a7a48', '#4a1a14', '#b89050', '#4a5a40'], damask: ['#8e9c78', '60,74,40', '45,58,30', '78,92,50'] },
    bartenders: ['Tiny', 'Shaz', 'Gaz'], songs: [2, 3, 7, 6], moments: ['bucks', 'blackout', 'busker', 'footy'],
  },
};
const VENUE = VENUES[store('ld_venue')] || VENUES.royal;
function venueOpen(id) { const V = VENUES[id]; if (!V) return false; const f = store('ld_save'); const rep = (f && f.flags && f.flags.rep) || 0; return rep >= (V.unlock || 0) || !!window.__unlockVenues; }
// the colour of the place: tint the shared materials once they exist
function applyVenueMaterials() {
  const T = VENUE.tint; if (!T) return;
  MAT.carpet.color.setHex(T.carpet); MAT.gamingWall.color.setHex(T.gaming); MAT.paintCream.color.setHex(T.paint); MAT.ceiling.color.setHex(T.ceiling);
  for (const k of ['timber', 'darkWood', 'wainscot', 'barTop']) if (MAT[k] && T.wood !== 0xffffff) MAT[k].color.multiply(new THREE.Color(T.wood));
}
// take a cab to another pub: save, remember the choice and reload into it
function travelTo(id) {
  const V = VENUES[id]; if (!V || id === VENUE.id) return;
  const s = Game.state, fare = V.fare || 0;
  if (fare) { s.wallet >= fare ? s.wallet -= fare : (s.bank -= fare); }
  Game.save(); store('ld_venue', id); store('ld_resume', 1);
  const f = $('fade'); f.style.transition = 'opacity .8s'; f.style.opacity = 1;
  $('loading').classList.remove('hidden'); $('loadtxt').textContent = `Catching a cab to ${V.name}…`;
  setTimeout(() => location.reload(), 900);
}

// ---- src/02-textures.js ----

// =====================================================================
//  PROCEDURAL TEXTURES  (+ optional online upgrades with graceful fallback)
// =====================================================================
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = maxAniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }
function noiseFill(ctx, w, h, amt, mono = true) {
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += mono ? n : (Math.random() - .5) * amt; d[i + 2] += mono ? n : (Math.random() - .5) * amt; }
  ctx.putImageData(id, 0, 0);
}
const TEX = {};
function tryOnline(url, apply) {
  const l = new THREE.TextureLoader(); l.setCrossOrigin('anonymous');
  l.load(url, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; apply(t); }, undefined, () => {});
}
const ONLINE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/';

function texTimber() {
  const W = 1024, H = 1024, c = mkCanvas(W, H), x = c.getContext('2d');
  const r = mkCanvas(W, H), rx = r.getContext('2d');
  const planks = 20, pw = W / planks;
  rx.fillStyle = '#7a7a7a'; rx.fillRect(0, 0, W, H);
  for (let i = 0; i < planks; i++) {
    let y = -Math.random() * H;
    while (y < H) {
      const len = rand(H * 0.35, H * 0.9);
      const hue = rand(24, 31), light = rand(27, 34), sat = rand(48, 58);
      const g = x.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
      g.addColorStop(0, hsl(hue, sat, light - 3)); g.addColorStop(.5, hsl(hue, sat, light + 2)); g.addColorStop(1, hsl(hue, sat, light - 4));
      x.fillStyle = g; x.fillRect(i * pw, y, pw, len);
      // grain
      for (let k = 0; k < 14; k++) {
        x.strokeStyle = hsl(hue - 4, sat, light - rand(6, 14), rand(.15, .45)); x.lineWidth = rand(0.5, 2.2);
        x.beginPath(); const gx = i * pw + rand(2, pw - 2); x.moveTo(gx, y);
        for (let s = 0; s <= 12; s++) x.lineTo(gx + Math.sin(s * rand(.3, .8) + k) * rand(1, 4), y + len * s / 12);
        x.stroke();
      }
      // knots
      if (Math.random() < 0.35) { const kx = i * pw + rand(10, pw - 10), ky = y + rand(20, len - 20); const kg = x.createRadialGradient(kx, ky, 1, kx, ky, rand(5, 11)); kg.addColorStop(0, hsl(hue - 6, 60, 12, .9)); kg.addColorStop(1, hsl(hue, 50, light, 0)); x.fillStyle = kg; x.beginPath(); x.ellipse(kx, ky, 5, 10, 0, 0, 7); x.fill(); }
      // joints
      x.fillStyle = 'rgba(15,8,3,.85)'; x.fillRect(i * pw, y + len - 2, pw, 3);
      rx.fillStyle = `rgb(${randi(70, 140)},0,0)`; rx.fillRect(i * pw, y, pw, len);
      y += len;
    }
    x.fillStyle = 'rgba(10,5,2,.85)'; x.fillRect(i * pw, 0, 1.6, H);
  }
  // wear: lighter, rougher traffic path
  noiseFill(x, W, H, 14);
  const rid = rx.getImageData(0, 0, W, H), d = rid.data;
  for (let i = 0; i < d.length; i += 4) { const v = clamp(d[i] * 0.6 + 30 + (Math.random() - .5) * 40, 0, 255); d[i] = d[i + 1] = d[i + 2] = v; }
  rx.putImageData(rid, 0, 0);
  return { map: canvasTex(c, 3, 3), rough: canvasTex(r, 3, 3, false) };
}
function texBrick(dark = false) {
  const W = 512, H = 512, c = mkCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = dark ? '#3b3632' : '#8e8478'; x.fillRect(0, 0, W, H);
  const bw = 64, bh = 24, m = 4;
  for (let row = 0; row < H / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < W / bw + 1; col++) {
      const h = rand(4, 16), s = rand(40, 62), l = dark ? rand(14, 22) : rand(26, 40);
      x.fillStyle = hsl(h, s, l); x.fillRect(col * bw + off + m / 2, row * bh + m / 2, bw - m, bh - m);
      x.fillStyle = hsl(h, s, l - 8, .5); x.fillRect(col * bw + off + m / 2, row * bh + bh - m - 3, bw - m, 3);
      if (Math.random() < .2) { x.fillStyle = hsl(h, 20, l + 15, .25); x.fillRect(col * bw + off + rand(5, 40), row * bh + rand(4, 12), rand(5, 20), rand(2, 6)); }
    }
  }
  noiseFill(x, W, H, 26);
  return canvasTex(c, 1, 1);
}
function texTiles(base = '#1f5a3a', w = 256) {
  const c = mkCanvas(w, w), x = c.getContext('2d');
  x.fillStyle = '#d8d2c0'; x.fillRect(0, 0, w, w);
  const n = 4, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const g = x.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
    const col = new THREE.Color(base); const hs = {}; col.getHSL(hs);
    g.addColorStop(0, hsl(hs.h * 360, hs.s * 100, hs.l * 100 + rand(2, 8))); g.addColorStop(1, hsl(hs.h * 360, hs.s * 100, hs.l * 100 - rand(2, 8)));
    x.fillStyle = g; x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  noiseFill(x, w, w, 8);
  return canvasTex(c);
}
function texCarpet() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d'), P = VENUE.pal.carpet;
  x.fillStyle = P[0]; x.fillRect(0, 0, W, W);
  const cell = 128;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
    x.save(); x.translate(cx, cy);
    // diamond lattice
    x.strokeStyle = P[1]; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -cell / 2); x.lineTo(cell / 2, 0); x.lineTo(0, cell / 2); x.lineTo(-cell / 2, 0); x.closePath(); x.stroke();
    // floral rosette
    for (let p = 0; p < 8; p++) { x.rotate(Math.PI / 4); x.fillStyle = p % 2 ? P[2] : P[3]; x.beginPath(); x.ellipse(0, -20, 7, 18, 0, 0, 7); x.fill(); }
    x.fillStyle = P[4]; x.beginPath(); x.arc(0, 0, 10, 0, 7); x.fill();
    x.fillStyle = P[5]; x.beginPath(); x.arc(0, 0, 4, 0, 7); x.fill();
    // swirls
    x.strokeStyle = P[6]; x.lineWidth = 2.5;
    for (let q = 0; q < 4; q++) { x.rotate(Math.PI / 2); x.beginPath(); x.arc(cell / 2 - 18, 0, 12, Math.PI * .5, Math.PI * 1.8); x.stroke(); }
    x.restore();
  }
  noiseFill(x, W, W, 30, false);
  return canvasTex(c, 6, 6);
}
function texPressedMetal() {
  const W = 256, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, W, W);
  x.strokeStyle = '#c8c8c8'; x.lineWidth = 6;
  x.strokeRect(8, 8, W - 16, W - 16);
  x.strokeStyle = '#555'; x.lineWidth = 3; x.strokeRect(20, 20, W - 40, W - 40);
  x.save(); x.translate(W / 2, W / 2);
  for (let i = 0; i < 8; i++) { x.rotate(Math.PI / 4); x.fillStyle = '#cfcfcf'; x.beginPath(); x.ellipse(0, -46, 12, 34, 0, 0, 7); x.fill(); x.fillStyle = '#666'; x.beginPath(); x.ellipse(3, -44, 6, 26, 0, 0, 7); x.fill(); }
  x.fillStyle = '#ddd'; x.beginPath(); x.arc(0, 0, 18, 0, 7); x.fill();
  x.restore();
  for (const [px, py] of [[0, 0], [W, 0], [0, W], [W, W]]) { x.fillStyle = '#d0d0d0'; x.beginPath(); x.arc(px, py, 22, 0, 7); x.fill(); }
  return canvasTex(c, 1, 1, false);
}
function texAsphalt() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = '#2b2b2d'; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 9000; i++) { const v = randi(20, 80); x.fillStyle = `rgb(${v},${v},${v + 2})`; x.fillRect(rand(0, W), rand(0, W), rand(1, 2.5), rand(1, 2.5)); }
  for (let i = 0; i < 12; i++) { x.fillStyle = `rgba(0,0,0,${rand(.05, .18)})`; x.beginPath(); x.ellipse(rand(0, W), rand(0, W), rand(20, 90), rand(10, 40), rand(0, 3), 0, 7); x.fill(); }
  noiseFill(x, W, W, 16);
  return canvasTex(c, 1, 1);
}
function texConcrete() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = '#8f8b84'; x.fillRect(0, 0, W, W);
  noiseFill(x, W, W, 30);
  for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(40,35,30,${rand(.04, .12)})`; x.beginPath(); x.ellipse(rand(0, W), rand(0, W), rand(10, 70), rand(8, 50), rand(0, 3), 0, 7); x.fill(); }
  // chewing gum spots
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(30,30,30,${rand(.3, .6)})`; x.beginPath(); x.arc(rand(0, W), rand(0, W), rand(2, 5), 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(30,28,25,.7)'; x.lineWidth = 3; x.strokeRect(0, 0, W, W);
  x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, W); x.stroke();
  return canvasTex(c, 1, 1);
}
function texWainscot() {
  const W = 256, H = 256, c = mkCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#3a1d0d'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const g = x.createLinearGradient(i * 64, 0, i * 64 + 64, 0); g.addColorStop(0, '#4b2812'); g.addColorStop(.5, '#5d3418'); g.addColorStop(1, '#40210e');
    x.fillStyle = g; x.fillRect(i * 64 + 2, 0, 60, H);
    x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(i * 64, 0, 2, H);
    for (let k = 0; k < 18; k++) { x.strokeStyle = `rgba(20,8,2,${rand(.1, .35)})`; x.beginPath(); const gx = i * 64 + rand(4, 60); x.moveTo(gx, 0); x.bezierCurveTo(gx + rand(-4, 4), H / 3, gx + rand(-4, 4), H * 2 / 3, gx + rand(-3, 3), H); x.stroke(); }
  }
  return canvasTex(c, 1, 1);
}
function texPaint(col = '#d9cfae', streaks = true) {
  const W = 256, c = mkCanvas(W, W), x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, W, W); noiseFill(x, W, W, 10);
  if (streaks) for (let i = 0; i < 20; i++) { x.fillStyle = `rgba(80,60,30,${rand(.02, .05)})`; x.fillRect(rand(0, W), 0, rand(2, 20), W); }
  return canvasTex(c, 1, 1);
}
function texFelt() { const W = 256, c = mkCanvas(W, W), x = c.getContext('2d'); x.fillStyle = '#145a32'; x.fillRect(0, 0, W, W); noiseFill(x, W, W, 22); return canvasTex(c, 2, 2); }
function texDeck() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { const l = rand(28, 38); x.fillStyle = hsl(30, 12, l); x.fillRect(0, i * 64, W, 62); for (let k = 0; k < 30; k++) { x.fillStyle = hsl(30, 10, l - rand(4, 9), .3); x.fillRect(0, i * 64 + rand(0, 60), W, rand(.5, 1.5)); } x.fillStyle = '#111'; x.fillRect(0, i * 64 + 62, W, 2); }
  noiseFill(x, W, W, 12);
  return canvasTex(c, 2, 2);
}
function texCorrugated() {
  const W = 64, H = 256, c = mkCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#2a2a2a'); g.addColorStop(.25, '#f0f0f0'); g.addColorStop(.5, '#7a7a7a'); g.addColorStop(.75, '#151515'); g.addColorStop(1, '#2a2a2a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return canvasTex(c, 30, 2, false);
}
function texLace() {
  const W = 256, H = 128, c = mkCanvas(W, H), x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 5;
  x.strokeRect(2, 2, W - 4, H - 4);
  x.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const cx = i * 64 + 32;
    x.beginPath(); x.arc(cx, 64, 22, 0, 7); x.stroke();
    x.beginPath(); x.arc(cx, 64, 10, 0, 7); x.stroke();
    for (let p = 0; p < 4; p++) { const a = p * Math.PI / 2 + Math.PI / 4; x.beginPath(); x.moveTo(cx + Math.cos(a) * 22, 64 + Math.sin(a) * 22); x.quadraticCurveTo(cx + Math.cos(a) * 40, 64 + Math.sin(a) * 30, cx + Math.cos(a) * 32 + (p % 3 ? 0 : 0), p < 2 ? 124 : 4); x.stroke(); }
    x.beginPath(); x.moveTo(i * 64, 4); x.lineTo(i * 64, 124); x.stroke();
    x.beginPath(); x.arc(cx, 10, 6, 0, 7); x.fill(); x.beginPath(); x.arc(cx, 118, 6, 0, 7); x.fill();
  }
  return canvasTex(c, 1, 1);
}
function texSoft(stops = [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']], size = 128) {
  const c = mkCanvas(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); return t;
}
function texSmoke() {
  const s = 128, c = mkCanvas(s, s), x = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const px = s / 2 + rand(-22, 22), py = s / 2 + rand(-22, 22), r = rand(14, 40);
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(255,255,255,${rand(.08, .2)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }
  return new THREE.CanvasTexture(c);
}

// Text sign texture (lightbox / neon / painted)
function signTex(lines, o = {}) {
  const W = o.w || 1024, H = o.h || 256, c = mkCanvas(W, H), x = c.getContext('2d');
  if (o.bg) { if (Array.isArray(o.bg)) { const g = x.createLinearGradient(0, 0, 0, H); o.bg.forEach((col, i) => g.addColorStop(i / (o.bg.length - 1), col)); x.fillStyle = g; } else x.fillStyle = o.bg; x.fillRect(0, 0, W, H); }
  if (o.border) { x.strokeStyle = o.border; x.lineWidth = o.borderW || 10; x.strokeRect(x.lineWidth / 2 + 4, x.lineWidth / 2 + 4, W - x.lineWidth - 8, H - x.lineWidth - 8); }
  const arr = Array.isArray(lines) ? lines : [lines];
  const fs = o.size || H * 0.6 / arr.length;
  arr.forEach((ln, i) => {
    const sz = Array.isArray(o.sizes) ? o.sizes[i] : fs;
    x.font = `${o.weight || 'bold'} ${sz}px ${o.font || "'Bebas Neue', Impact, sans-serif"}`;
    x.textAlign = o.align || 'center'; x.textBaseline = 'middle';
    const ty = H / 2 + (i - (arr.length - 1) / 2) * (o.lh || fs * 1.08);
    const tx = o.align === 'left' ? (o.pad || 40) : W / 2;
    if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.glowB || 30; }
    if (o.stroke) { x.lineWidth = o.strokeW || 8; x.strokeStyle = o.stroke; x.strokeText(ln, tx, ty); }
    x.fillStyle = Array.isArray(o.color) ? o.color[i] : (o.color || '#fff'); x.fillText(ln, tx, ty);
    x.shadowBlur = 0;
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}

// Victorian damask wallpaper: cream ground, gilt motif, two motifs per tile
function texDamask() {
  const W = 512, c = mkCanvas(W, W), x = c.getContext('2d'), P = VENUE.pal.damask;
  x.fillStyle = P[0]; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '90,60,20' : '255,245,220'},${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
  const motif = (cx, cy, s) => {
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.fillStyle = `rgba(${P[1]},.55)`; x.strokeStyle = `rgba(${P[2]},.5)`; x.lineWidth = 3;
    for (const m of [1, -1]) {
      x.save(); x.scale(m, 1);
      x.beginPath(); x.moveTo(0, -110); x.bezierCurveTo(40, -90, 60, -40, 20, -10); x.bezierCurveTo(70, 10, 70, 70, 0, 110); x.bezierCurveTo(30, 60, 30, 20, 0, 0); x.closePath(); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(20, -60); x.bezierCurveTo(70, -80, 90, -30, 60, -10); x.stroke();
      x.beginPath(); x.arc(46, 40, 12, 0, 7); x.stroke();
      x.restore();
    }
    x.fillStyle = `rgba(${P[3]},.6)`; x.beginPath(); x.ellipse(0, 0, 12, 22, 0, 0, 7); x.fill();
    x.restore();
  };
  motif(W / 4, W / 4, 0.95); motif(W * 3 / 4, W * 3 / 4, 0.95); motif(W * 3 / 4, W / 4, 0.45); motif(W / 4, W * 3 / 4, 0.45);
  x.strokeStyle = 'rgba(110,80,30,.15)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * W / 4, 0); x.lineTo(i * W / 4, W); x.stroke(); }
  return canvasTex(c, 1, 1);
}
// soft ground shadow + vertical ambient-occlusion gradient
function texLaceCurtain() {
  const W = 256, H = 420, c = mkCanvas(W, H), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, W); g.addColorStop(0, 'rgba(255,214,150,.95)'); g.addColorStop(1, 'rgba(200,130,60,.75)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,248,230,.55)'; x.lineWidth = 1.2;
  for (let yy = 0; yy < H; yy += 18) for (let xx = 0; xx < W; xx += 18) { x.beginPath(); x.arc(xx + (yy / 18 % 2) * 9, yy, 6, 0, 7); x.stroke(); }
  x.fillStyle = 'rgba(60,30,10,.35)'; x.fillRect(W * 0.47, 0, W * 0.06, H); // gap between the curtains
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texBlob() { const c = mkCanvas(128, 128), x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(0.5, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function texAO() { const c = mkCanvas(8, 128), x = c.getContext('2d'); const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(0.35, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(c); }
function buildTextures() {
  TEX.timber = texTimber();
  TEX.brick = texBrick(); TEX.brickDark = texBrick(true);
  TEX.tileGreen = texTiles('#1d5b3c'); TEX.tileCream = texTiles('#d9c79a'); TEX.tileRed = texTiles('#7a2318');
  TEX.carpet = texCarpet();
  TEX.pressed = texPressedMetal();
  TEX.asphalt = texAsphalt();
  TEX.concrete = texConcrete();
  TEX.wainscot = texWainscot();
  TEX.paintCream = texDamask(); TEX.blob = texBlob(); TEX.ao = texAO(); TEX.paintGreen = texPaint('#2f4a3a'); TEX.paintRed = texPaint('#5a1f1a'); TEX.paintDark = texPaint('#2a2622', false);
  TEX.felt = texFelt(); TEX.deck = texDeck(); TEX.corr = texCorrugated(); TEX.lace = texLace();
  TEX.smoke = texSmoke();
  TEX.glow = texSoft([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,240,200,.6)'], [1, 'rgba(255,200,120,0)']]);
  TEX.dot = texSoft([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']], 32);
}

// ---- src/03-world.js ----

// =====================================================================
//  WORLD: layout constants, collision, materials, builders
// =====================================================================
const PUB = { x0: -13, x1: 13, z0: -18, z1: 2, ceil: 4.0 };
// covered rooms beyond the main bar: the toilets, the drive-through bottle shop and the kebab shop over the road
const ROOMS = [
  { id: 'toilets', x0: -13, x1: -9.4, z0: -22.6, z1: -18, ceil: 2.9, surface: 'tile' },
  { id: 'bottleo', x0: 13, x1: 19.6, z0: -7.85, z1: 2, ceil: 3.4, surface: 'concrete' },
  { id: 'kebab', x0: 7.6, x1: 12.4, z0: 24.05, z1: 27.6, ceil: 3.0, surface: 'tile' },
];
const UP = { y: 4.29, x0: -13, x1: 13, z0: -2.0, z1: 9.5 }; // level 1: Room 4 upstairs + the verandah balcony
function roomAt(x, z) { for (const r of ROOMS) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r; return null; }
function isInside(x, z) { return (x > PUB.x0 && x < PUB.x1 && z > PUB.z0 && z < PUB.z1) || !!roomAt(x, z); }
function inGaming(x, z) { return x > 3 && x < 13 && z > -18 && z < -4; }
function onTerrace(x, z) { return x >= 13 && x < 19.6 && z > -18 && z < -8; }
function inGarden(x, z) { return x > -9.4 && x < 19.6 && z > -29 && z <= -18.1 && !roomAt(x, z); }
function smokingAllowed(x, z) { return !isInside(x, z); }
// y (optional) lets particles find the upstairs floor
function groundY(x, z, y) { if (y !== undefined && y > UP.y - 0.2 && x > UP.x0 && x < UP.x1 && z > UP.z0 && z < UP.z1) return UP.y; return (z > 10.05 && z < 17.95) ? -0.15 : 0; }
function surfaceAt(x, z, lv = 0) {
  if (lv === 1) return z > 2 ? 'timber' : 'carpet';
  const r = roomAt(x, z); if (r) return r.surface;
  if (onTerrace(x, z)) return 'deck';
  if (inGarden(x, z)) return 'gravel';
  if (isInside(x, z)) return inGaming(x, z) ? 'carpet' : 'timber';
  if (z > 10.05 && z < 17.95) return 'road';
  return 'concrete';
}

const colliders = [];   // 2D AABBs {x0,x1,z0,z1,lv}; lv 1 = upstairs
let colLevel = 0;      // builders set this while adding upstairs walls
function addCol(cx, cz, w, d) { colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, lv: colLevel }); }
function addColBox(x0, x1, z0, z1) { const c = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), lv: colLevel }; colliders.push(c); return c; }
function collideCircle(p, r, lv = 0) {
  for (let it = 0; it < 2; it++) for (const c of colliders) {
    if (c.lv !== lv || c.off) continue;
    const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1);
    const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // centre inside box: push out along smallest axis
        const l = p.x - c.x0, rr = c.x1 - p.x, b = p.z - c.z0, f = c.z1 - p.z, m = Math.min(l, rr, b, f);
        if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === b) p.z = c.z0 - r; else p.z = c.z1 + r;
      }
    }
  }
}

const interactables = [];
function addInteract(o) { interactables.push(Object.assign({ r: 2.0, enabled: () => true }, o)); return o; }

const SPOTS = [];
function addSpot(o) { const s = Object.assign({ occ: null, sitH: 0, kind: 'stand' }, o); SPOTS.push(s); return s; }

const MAT = {};
const interiorMats = [];
// identical untextured materials are shared, so the static batcher can merge their geometry into one draw call
const _matCache = new Map();
function M(o, interior = true) {
  const key = Object.values(o).some(v => v && v.isTexture) ? null : JSON.stringify(o) + '|' + interior;
  if (key && _matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial(o); if (interior) interiorMats.push(m);
  if (key) _matCache.set(key, m);
  return m;
}
function buildMaterials() {
  MAT.timber = M({ map: TEX.timber.map, roughnessMap: TEX.timber.rough, bumpMap: TEX.timber.map, bumpScale: 1.4, roughness: 0.85, metalness: 0, color: 0xffffff });
  MAT.carpet = M({ map: TEX.carpet, bumpMap: TEX.carpet, bumpScale: 2.2, roughness: 1 });
  MAT.blob = new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -3 });
  MAT.ao = new THREE.MeshBasicMaterial({ map: TEX.ao, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  MAT.deck = M({ map: TEX.deck, roughness: 0.85 }, false);
  MAT.concrete = M({ map: TEX.concrete, roughness: 0.92 }, false);
  MAT.asphalt = M({ map: TEX.asphalt, roughness: 0.82, color: 0xbbbbbb }, false);
  MAT.brick = M({ map: TEX.brick, roughness: 0.9 }, false);
  MAT.brickDark = M({ map: TEX.brickDark, roughness: 0.95 }, false);
  MAT.tileGreen = M({ map: TEX.tileGreen, roughness: 0.12, metalness: 0.05 }, false);
  MAT.tileCream = M({ map: TEX.tileCream, roughness: 0.15, metalness: 0.05 }, false);
  MAT.wainscot = M({ map: TEX.wainscot, roughness: 0.45 });
  MAT.paintCream = M({ map: TEX.paintCream, bumpMap: TEX.paintCream, bumpScale: 0.6, roughness: 0.82 });
  MAT.paintGreen = M({ map: TEX.paintGreen, roughness: 0.85 });
  MAT.paintRed = M({ map: TEX.paintRed, roughness: 0.85 });
  MAT.gamingWall = M({ map: TEX.paintDark, color: 0x6a3a4a, roughness: 0.8 });
  MAT.ceiling = M({ color: 0xc8bca0, bumpMap: TEX.pressed, bumpScale: 2.5, roughness: 0.75, metalness: 0.0 });
  MAT.barTop = M({ map: TEX.wainscot, color: 0x9a6a4a, roughness: 0.18, metalness: 0.05 });
  MAT.darkWood = M({ map: TEX.wainscot, color: 0x7a5a48, roughness: 0.4 });
  MAT.brass = M({ color: 0xd4a94e, metalness: 1, roughness: 0.28 });
  MAT.chrome = M({ color: 0xe8e8ee, metalness: 1, roughness: 0.12 });
  MAT.iron = M({ color: 0x1a1d1c, metalness: 0.6, roughness: 0.5 }, false);
  MAT.creamPaint = M({ color: 0xe9dfc6, roughness: 0.6 }, false);
  MAT.greenPaint = M({ color: 0x1f4d34, roughness: 0.55 }, false);
  MAT.redPaint = M({ color: 0x8c2a1f, roughness: 0.55 }, false);
  MAT.blackPlastic = M({ color: 0x111114, roughness: 0.35, metalness: 0.2 });
  MAT.greyPlastic = M({ color: 0x55575c, roughness: 0.45, metalness: 0.2 });
  MAT.vinylRed = M({ color: 0x8e1a1a, roughness: 0.35 });
  MAT.vinylBlack = M({ color: 0x1b1716, roughness: 0.4 });
  MAT.felt = M({ map: TEX.felt, roughness: 1 });
  MAT.corr = M({ color: 0xbfc4c4, map: TEX.corr, metalness: 0.7, roughness: 0.4 }, false);
  MAT.lace = M({ map: TEX.lace, color: 0x1f2a24, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.15, roughness: 0.65 }, false);
  MAT.window = new THREE.MeshStandardMaterial({ color: 0x9fb8c0, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  MAT.mirrorFake = M({ color: 0x8a9496, metalness: 1, roughness: 0.05 });
  MAT.leaf = M({ color: 0x2f5a2a, roughness: 0.8, side: THREE.DoubleSide }, false);
  MAT.pot = M({ color: 0x7a4a2a, roughness: 0.9 }, false);
  MAT.rubber = M({ color: 0x151515, roughness: 0.9 });
  MAT.skin = M({ color: 0xd9a383, roughness: 0.6 });
  MAT.white = M({ color: 0xf2f2ee, roughness: 0.5 });
  MAT.bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 1.25) });
  MAT.bulbCool = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.8, 3.2) });
  MAT.sodium = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.6, 0.9) });
  MAT.ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 1.6, 0.3) });
  MAT.darkWindow = M({ color: 0x0a0c10, roughness: 0.1, metalness: 0.8 }, false);
  MAT.litWindow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.55) });
  MAT.shutter = M({ map: TEX.corr, color: 0x5c6060, metalness: 0.6, roughness: 0.6 }, false);
  // online upgrades (keep procedural if blocked/offline)
  applyVenueMaterials();
  tryOnline(ONLINE + 'hardwood2_diffuse.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1, 1); t.rotation = Math.PI / 2; MAT.timber.map = t; MAT.timber.color.set(0xd8b090); MAT.timber.needsUpdate = true; });
  tryOnline(ONLINE + 'hardwood2_roughness.jpg', t => { MAT.timber.roughnessMap = t; t.rotation = Math.PI / 2; MAT.timber.roughness = 0.7; MAT.timber.needsUpdate = true; });
  tryOnline(ONLINE + 'brick_diffuse.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; MAT.brick.map = t; MAT.brick.needsUpdate = true; });
  tryOnline(ONLINE + 'brick_bump.jpg', t => { MAT.brick.bumpMap = t; MAT.brick.bumpScale = 3; MAT.brick.needsUpdate = true; });
}

// world-scale UV helpers
function uvBox(geo, w, h, d, s = 1) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); }
  return geo;
}
function uvScale(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return geo; }

// ---- static batcher: merges static props per material (huge draw-call saver)
class Batcher {
  constructor() { this.map = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m1.compose(_v1.set(x, y, z), _q1.setFromEuler(_e1.set(rx, ry, rz, 'YXZ')), _v2.set(sx, sy, sz));
    return this.addM(geo, mat, _m1);
  }
  addM(geo, mat, m) {
    let g = geo.clone(); g.applyMatrix4(m);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
  }
  flush(parent, cast = false, receive = true) {
    for (const [mat, list] of this.map) {
      const merged = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh); list.forEach(g => g.dispose());
    }
    this.map.clear();
  }
}
const SB = new Batcher();      // interior static
const SBX = new Batcher();     // exterior static (casts shadows)

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  sph: new THREE.SphereGeometry(1, 16, 12),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 24),
  plane: new THREE.PlaneGeometry(1, 1),
};
function addBoxS(b, mat, x, y, z, w, h, d, ry = 0, uvs = 0) {
  const g = uvs ? uvBox(new THREE.BoxGeometry(w, h, d), w, h, d, uvs) : G.box;
  if (uvs) b.add(g, mat, x, y, z, ry); else b.add(g, mat, x, y, z, ry, 0, 0, w, h, d);
}
function addCylS(b, mat, x, y, z, r, h, seg = 20, ry = 0, rx = 0, rz = 0) { b.add(seg > 10 ? G.cyl : G.cyl8, mat, x, y, z, ry, rx, rz, r, h, r); }

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
function signPlane(tex, w, h, x, y, z, ry = 0, o = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !!o.transparent, toneMapped: o.toneMapped ?? true, side: o.side || THREE.FrontSide, depthWrite: !o.transparent });
  if (o.intensity) mat.color.setScalar(o.intensity);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
}

// split a multi-material box into per-face pieces so each face can join its material's batch
function addBoxFaces(batch, geo, mats, matrix) {
  for (const g of geo.groups) {
    const sub = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) sub.setAttribute(k, geo.attributes[k]);
    sub.setIndex(Array.from(geo.index.array.slice(g.start, g.start + g.count)));
    batch.addM(sub, mats[g.materialIndex], matrix);
  }
}
// ---- walls with openings --------------------------------------------------
// axis 'x': wall runs along X at fixed z; 'z': wall runs along Z at fixed x.
// mats: {low:[inMat,outMat], high:[inMat,outMat]}, outSign: which side (+1/-1) is "out"
function buildWall(axis, fixed, a0, a1, h, mats, outSign = 1, openings = [], t = 0.22, split = 1.1, collide = true, yBase = 0) {
  const segs = []; let cur = a0;
  openings = openings.slice().sort((p, q) => p.a - q.a);
  for (const o of openings) { if (o.a > cur) segs.push({ a: cur, b: o.a, y0: 0, y1: h }); if (o.bottom > 0) segs.push({ a: o.a, b: o.b, y0: 0, y1: o.bottom, sill: true }); if (o.top < h) segs.push({ a: o.a, b: o.b, y0: o.top, y1: h }); cur = o.b; }
  if (cur < a1) segs.push({ a: cur, b: a1, y0: 0, y1: h });
  for (const s of segs) {
    const pieces = [];
    if (s.y0 < split && s.y1 > split) { pieces.push([s.y0, split, 'low'], [split, s.y1, 'high']); }
    else pieces.push([s.y0, s.y1, s.y1 <= split ? 'low' : 'high']);
    for (const [y0, y1, k] of pieces) {
      const len = s.b - s.a, hh = y1 - y0, mid = (s.a + s.b) / 2;
      const [mi, mo] = mats[k];
      let geo, arr, pos;
      if (axis === 'x') {
        geo = uvBox(new THREE.BoxGeometry(len, hh, t), len, hh, t, 1.2);
        arr = [mi, mi, mi, mi, outSign > 0 ? mo : mi, outSign > 0 ? mi : mo]; pos = V3(mid, yBase + y0 + hh / 2, fixed);
      } else {
        geo = uvBox(new THREE.BoxGeometry(t, hh, len), t, hh, len, 1.2);
        arr = [outSign > 0 ? mo : mi, outSign > 0 ? mi : mo, mi, mi, mi, mi]; pos = V3(fixed, yBase + y0 + hh / 2, mid);
      }
      addBoxFaces(SBX, geo, arr, new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z));
    }
    if (collide && s.y0 < 1.0) { if (axis === 'x') addColBox(s.a, s.b, fixed - t / 2, fixed + t / 2); else addColBox(fixed - t / 2, fixed + t / 2, s.a, s.b); }
  }
}

// ---- lights -------------------------------------------------------------
const LIGHTS = { interior: [], street: [], flicker: [] };
function pLight(col, inten, dist, x, y, z, group = 'interior') {
  const l = new THREE.PointLight(col, inten, dist, 2); l.position.set(x, y, z); scene.add(l);
  (LIGHTS[group] || LIGHTS.interior).push(l); return l;
}
function optionalLight(l) { (window.__optionalLights = window.__optionalLights || []).push(l); return l; }
function pendant(x, z, y = 3.1, shade = 0x1f4d34) {
  atmo.pendants.push(V3(x, y, z));
  addCylS(SB, MAT.brass, x, (PUB.ceil + y + 0.2) / 2, z, 0.008, PUB.ceil - y - 0.2, 6);
  SB.add(new THREE.ConeGeometry(0.22, 0.2, 18, 1, true), M({ color: shade, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }), x, y + 0.1, z);
  SB.add(G.sph, MAT.bulb, x, y + 0.02, z, 0, 0, 0, 0.06, 0.06, 0.06);
}

// =====================================================================
//  BUILD: STREET & EXTERIOR
// =====================================================================
const dynamic = { doors: [], fans: [], tvs: [], boards: {}, neon: [], heater: null, fire: null, streetBulbs: [], winLit: [] };
let skyObj, sun, hemi, stars, moon, rainSys;

function buildStreet() {
  // ground planes
  const fp = uvScale(new THREE.PlaneGeometry(120, 8), 60, 4); fp.rotateX(-Math.PI / 2);
  mesh(fp, MAT.concrete, 0, 0, 6).receiveShadow = true;
  const road = uvScale(new THREE.PlaneGeometry(120, 7.9), 20, 1.3); road.rotateX(-Math.PI / 2);
  mesh(road, MAT.asphalt, 0, -0.15, 14).receiveShadow = true;
  const fp2 = uvScale(new THREE.PlaneGeometry(120, 8), 60, 4); fp2.rotateX(-Math.PI / 2);
  mesh(fp2, MAT.concrete, 0, 0, 22).receiveShadow = true;
  const dirt = new THREE.PlaneGeometry(400, 400); dirt.rotateX(-Math.PI / 2);
  mesh(dirt, M({ color: 0x1a1814, roughness: 1 }, false), 0, -0.2, 0);
  // kerbs + gutters
  const kerbMat = M({ color: 0x8d8a83, roughness: 0.9 }, false);
  addBoxS(SBX, kerbMat, 0, -0.06, 10.05, 120, 0.18, 0.18);
  addBoxS(SBX, kerbMat, 0, -0.06, 17.95, 120, 0.18, 0.18);
  // lane markings
  const lm = new THREE.MeshStandardMaterial({ color: 0xe8e4d0, roughness: 0.6 });
  for (let x = -58; x < 60; x += 6) addBoxS(SBX, lm, x, -0.145, 14, 3, 0.005, 0.12);
  addBoxS(SBX, lm, 0, -0.145, 11.0, 120, 0.005, 0.1); addBoxS(SBX, lm, 0, -0.145, 17.0, 120, 0.005, 0.1);
  // parking bay lines
  for (let x = -14; x <= 14; x += 6) addBoxS(SBX, lm, x, -0.145, 10.6, 0.1, 0.005, 1.0);

  // ---- street lights (cobra head, sodium) ----
  const pole = M({ color: 0x6d7275, metalness: 0.7, roughness: 0.4 }, false);
  for (const sx of [-26, -8, 16, 34]) {
    atmo.streetHeads.push(V3(sx, 6.85, 12.4));
    addCylS(SBX, pole, sx, 3.5, 10.4, 0.08, 7, 10);
    SBX.add(G.box, pole, sx, 7.0, 11.4, 0, 0, 0, 0.08, 0.08, 2.0);
    SBX.add(G.box, pole, sx, 6.95, 12.4, 0, 0, 0, 0.3, 0.12, 0.55);
    SBX.add(G.box, MAT.sodium, sx, 6.88, 12.4, 0, 0, 0, 0.22, 0.02, 0.4);
    if (sx === -8 || sx === 16) dynamic.streetBulbs.push(pLight(0xff9a3c, 0, 26, sx, 6.6, 12.4, 'street'));
  }
  // ---- power poles + sagging wires ----
  const timberPole = M({ color: 0x4a3a2c, roughness: 0.95 }, false);
  const polesX = [-44, -20, 4, 28, 52];
  for (const px of polesX) { addCylS(SBX, timberPole, px, 4.5, 10.6, 0.13, 9, 10); SBX.add(G.box, timberPole, px, 8.6, 10.6, 0, 0, 0, 0.12, 0.12, 2.2); for (const dz of [-0.9, -0.3, 0.3, 0.9]) SBX.add(G.cyl8, MAT.white, px, 8.72, 10.6 + dz, 0, 0, 0, 0.03, 0.12, 0.03); }
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  for (let i = 0; i < polesX.length - 1; i++) for (const dz of [-0.9, -0.3, 0.3, 0.9]) {
    const a = V3(polesX[i], 8.78, 10.6 + dz), b = V3(polesX[i + 1], 8.78, 10.6 + dz), pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * 0.9, 0))); }
    SBX.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4), wireMat);
  }
  // ---- parked ute + sedan ----
  buildUte(-5.2, 11.35, 0x9a2b1f);
  buildUte(22, 16.65, 0x2b3f5a, Math.PI, true);
  // ---- bins, bench, bus stop ----
  for (const [bx, lid] of [[-14.5, 0xc23b22], [-13.8, 0xe2c22b]]) { addBoxS(SBX, M({ color: 0x1f4d2a, roughness: 0.6 }, false), bx, 0.5, 9.2, 0.58, 1.0, 0.7); addBoxS(SBX, M({ color: lid, roughness: 0.5 }, false), bx, 1.03, 9.2, 0.62, 0.06, 0.74); addCol(-14.15, 9.2, 1.4, 0.8); }
  // bus stop pole on far side
  addCylS(SBX, pole, -12, 1.4, 18.6, 0.04, 2.8, 8);
  const bs = signTex(['BUS STOP', 'ROUTE 412'], { w: 256, h: 256, bg: '#f2d42e', color: '#111', sizes: [64, 44] });
  signPlane(bs, 0.45, 0.45, -12, 2.6, 18.64, 0); signPlane(bs, 0.45, 0.45, -12, 2.6, 18.56, Math.PI);
  // bench far side
  addBoxS(SBX, MAT.darkWood, -9.5, 0.45, 19.0, 1.8, 0.06, 0.45); addBoxS(SBX, MAT.darkWood, -9.5, 0.75, 19.22, 1.8, 0.4, 0.05);
  for (const dx of [-0.8, 0.8]) addBoxS(SBX, MAT.iron, -9.5 + dx, 0.22, 19.0, 0.05, 0.45, 0.45);
  addCol(-9.5, 19.05, 1.9, 0.5);

  // ---- the neighbours: painted shopfronts with lit windows, awnings and signs (see 25-town.js) ----
  townBlock(-46, -27, 2, 12, 7.0, 1, 'offices');
  townBlock(-27, -14, 2, 12, 4.6, 1, 'vacant');
  townBlock(19.6, 33, 2, 22, 4.8, 1, 'hardware');
  townBlock(33, 50, 2, 14, 6.6, 1, 'bakery');
  townBlock(-50, -30, 24, 12, 7.2, -1, 'offices');
  townBlock(-30, -12, 24, 10, 4.6, -1, 'newsagent');
  townBlock(-12, 6, 24, 10, 5.4, -1, 'chemist');
  townBlock(6, 7.6, 24, 12, 7.0, -1, 'brick');
  townBlock(12.4, 26, 24, 12, 7.0, -1, 'opshop');   // the gap in between is the kebab shop (buildKebab)
  townBlock(26, 50, 24, 10, 5.0, -1, 'hardware');
  // FOR LEASE sign
  const fl = signTex(['FOR LEASE', '0400 000 000'], { w: 512, h: 256, bg: '#f4f4f0', color: ['#c7352b', '#222'], sizes: [110, 50], border: '#c7352b' });
  signPlane(fl, 1.6, 0.8, -20, 2.2, 2.09, 0);
  signPlane(fl, 1.6, 0.8, 16, 2.2, 23.9, Math.PI);
  // side lane wall between pub and neighbour
  // (the side lane is now the drive-through bottle shop; see buildBottleO)
  // world bounds
  addColBox(-60, 60, 26, 27); addColBox(-61, -60, -30, 30); addColBox(60, 61, -30, 30);
  addColBox(-14, -13, -18, 2); addColBox(13, 15.6, -18.2, -17.9); addColBox(17.0, 19.7, -18.2, -17.9); addColBox(19.6, 19.9, -18.2, 2.1); addColBox(13, 19.6, -8.1, -7.85);
}

function buildUte(x, z, col, ry = 0, sedan = false) {
  const g = new THREE.Group(); g.position.set(x, -0.15, z); g.rotation.y = ry; scene.add(g);
  const paint = new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.25, envMapIntensity: 1.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0e12, metalness: 0.9, roughness: 0.05 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const add = (geo, m, px, py, pz, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
  add(new RoundedBoxGeometry(1, 1, 1, 2, 0.08), paint, 0, 0.62, 0, 4.9, 0.55, 1.82);
  if (sedan) { add(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), paint, -0.1, 1.1, 0, 2.5, 0.5, 1.66); add(G.box, glass, -0.1, 1.12, 0, 2.3, 0.4, 1.68); }
  else { add(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), paint, 0.55, 1.12, 0, 1.6, 0.55, 1.7); add(G.box, glass, 0.55, 1.15, 0, 1.45, 0.42, 1.72); add(G.box, glass, 1.34, 1.13, 0, 0.05, 0.4, 1.5); add(G.box, paint, -1.4, 1.0, 0.86, 2.0, 0.22, 0.05); add(G.box, paint, -1.4, 1.0, -0.86, 2.0, 0.22, 0.05); add(G.box, paint, -2.42, 1.0, 0, 0.05, 0.22, 1.7); add(G.box, MAT.chrome, 0, 1.24, 0, 0.04, 0.04, 1.7).position.set(-0.3, 1.38, 0); }
  for (const [wx, wz] of [[1.5, 0.82], [1.5, -0.82], [-1.5, 0.82], [-1.5, -0.82]]) { const w = add(G.cyl, tyre, wx, 0.36, wz, 0.36, 0.26, 0.36); w.rotation.x = Math.PI / 2; const h = add(G.cyl, MAT.chrome, wx, 0.36, wz * 1.02, 0.2, 0.26, 0.2); h.rotation.x = Math.PI / 2; }
  add(G.box, new THREE.MeshBasicMaterial({ color: 0x400808 }), -2.46, 0.72, 0.65, 0.03, 0.12, 0.22); add(G.box, new THREE.MeshBasicMaterial({ color: 0x400808 }), -2.46, 0.72, -0.65, 0.03, 0.12, 0.22);
  add(G.box, MAT.chrome, 2.46, 0.6, 0, 0.05, 0.18, 1.6);
  add(G.box, new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x222222 }), 2.46, 0.78, 0.6, 0.03, 0.12, 0.3); add(G.box, new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x222222 }), 2.46, 0.78, -0.6, 0.03, 0.12, 0.3);
  const c = _v1.set(x, 0, z); const w = Math.abs(Math.cos(ry)) > 0.5 ? 5.0 : 1.9, d = Math.abs(Math.cos(ry)) > 0.5 ? 1.9 : 5.0; addCol(c.x, c.z, w, d);
  // parked cars never move: fold them into the static batch
  g.updateMatrixWorld(true);
  g.traverse(o => { if (o.isMesh) SBX.addM(o.geometry, o.material, o.matrixWorld.clone()); });
  scene.remove(g);
}

function buildFacade() {
  const H1 = 4.2, H2 = 8.4;
  // ---- ground floor front wall (tiles outside, timber/paint inside) ----
  const front = { low: [MAT.wainscot, MAT.tileGreen], high: [MAT.paintCream, MAT.tileCream] };
  buildWall('x', 2, -13.1, 13.1, H1, front, 1, [
    { a: -10.5, b: -4.5, bottom: 1.0, top: 3.2 }, { a: -1.3, b: 1.3, bottom: 0, top: 2.75 }, { a: 4.5, b: 10.5, bottom: 1.0, top: 3.2 }], 0.3);
  // window glass + frames + gold-leaf lettering
  for (const [cx, txt] of [[-7.5, 'PUBLIC BAR'], [7.5, 'LOUNGE · BISTRO']]) {
    const gl = mesh(new THREE.PlaneGeometry(6, 2.2), MAT.window, cx, 2.1, 2.0);
    for (const dx of [-3, -1, 1, 3]) addBoxS(SBX, MAT.greenPaint, cx + dx, 2.1, 2.0, 0.08, 2.2, 0.12);
    addBoxS(SBX, MAT.greenPaint, cx, 3.2, 2.0, 6.1, 0.1, 0.14); addBoxS(SBX, MAT.creamPaint, cx, 1.0, 2.05, 6.2, 0.08, 0.3);
    const lt = signTex([txt], { w: 1024, h: 160, color: '#e8c56a', font: "Rye, serif", size: 90, stroke: '#4a2a08', strokeW: 4 });
    signPlane(lt, 3.6, 0.56, cx, 2.75, 2.02, 0, { transparent: true });
    signPlane(lt, 3.6, 0.56, cx, 2.75, 1.98, Math.PI, { transparent: true });
  }
  // neon OPEN in lounge window
  const open = signTex(['OPEN'], { w: 512, h: 200, color: '#ff4a5a', glow: '#ff0022', glowB: 40, font: "Bungee, sans-serif", size: 130, transparent: true });
  const openSign = signPlane(open, 1.0, 0.4, 9.4, 2.5, 1.9, 0, { transparent: true, toneMapped: false, intensity: 2.2 });
  dynamic.neon.push(openSign);
  // upper storey: brick with sash windows. Room 4 (behind windows 4 & 5) is real: a glass window and French doors onto the balcony.
  colLevel = 1;
  buildWall('x', 2, -13.1, 13.1, H2 - H1, { low: [MAT.paintCream, MAT.brick], high: [MAT.paintCream, MAT.brick] }, 1, [{ a: 5.64, b: 6.84, bottom: 0.9, top: 2.9 }, { a: 9.8, b: 11.0, bottom: 0, top: 2.42 }], 0.3, 99, true, H1);
  colLevel = 0;
  for (let i = 0; i < 6; i++) {
    const wx = -10.4 + i * 4.16, lit = i === 1;
    if (i === 4) { // real glass, with a warm lace curtain that glows when you're not in the room
      mesh(new THREE.PlaneGeometry(1.2, 2.0), MAT.window, wx, 6.1, 2.1);
      dynamic.roomGlow = signPlane(texLaceCurtain(), 1.18, 1.96, wx, 6.1, 1.95, 0, { transparent: true, intensity: 1.0 });
    } else if (i === 5) { // French doors standing open onto the balcony
      for (const sd of [-1, 1]) { addBoxS(SBX, MAT.creamPaint, wx + sd * 0.64, 5.47, 2.17, 0.1, 2.36, 0.12); const leaf = new THREE.Group(); leaf.position.set(wx + sd * 0.6, 4.3, 2.22); leaf.rotation.y = sd * 1.25; scene.add(leaf); const fr = new THREE.Mesh(new THREE.BoxGeometry(0.58, 2.3, 0.05), MAT.greenPaint); fr.position.set(-sd * 0.29, 1.15, 0); leaf.add(fr); const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 1.7), MAT.window); gl.position.set(-sd * 0.29, 1.3, 0.03); leaf.add(gl); }
      addBoxS(SBX, MAT.creamPaint, wx, 6.68, 2.17, 1.4, 0.12, 0.12); addBoxS(SBX, MAT.creamPaint, wx, 7.15, 2.2, 1.5, 0.14, 0.12);
      continue;
    } else SBX.add(G.box, lit ? MAT.litWindow : MAT.darkWindow, wx, 6.1, 2.16, 0, 0, 0, 1.2, 2.0, 0.04);
    addBoxS(SBX, MAT.creamPaint, wx, 6.1, 2.17, 1.36, 0.08, 0.06); addBoxS(SBX, MAT.creamPaint, wx, 7.15, 2.2, 1.5, 0.14, 0.12); addBoxS(SBX, MAT.creamPaint, wx, 5.05, 2.2, 1.5, 0.1, 0.16);
    addBoxS(SBX, MAT.creamPaint, wx - 0.64, 6.1, 2.17, 0.08, 2.1, 0.06); addBoxS(SBX, MAT.creamPaint, wx + 0.64, 6.1, 2.17, 0.08, 2.1, 0.06);
  }
  // string courses + parapet
  addBoxS(SBX, MAT.creamPaint, 0, H1 + 0.05, 2.18, 26.6, 0.2, 0.4);
  addBoxS(SBX, MAT.creamPaint, 0, H2 + 0.1, 2.15, 26.8, 0.25, 0.5);
  const par = new THREE.Mesh(uvBox(new THREE.BoxGeometry(26.4, 1.4, 0.3), 26.4, 1.4, .3, 1.5), MAT.creamPaint); par.position.set(0, H2 + 0.9, 2); par.castShadow = true; scene.add(par);
  // pediment
  const ped = new THREE.Shape(); ped.moveTo(-3.2, 0); ped.lineTo(3.2, 0); ped.lineTo(0, 1.5); ped.lineTo(-3.2, 0);
  const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.3, bevelEnabled: false }); const pm = new THREE.Mesh(pg, MAT.creamPaint); pm.position.set(0, H2 + 1.6, 1.85); pm.castShadow = true; scene.add(pm);
  const est = signTex([VENUE.est], { w: 512, h: 128, color: '#6b2a18', font: "Rye, serif", size: 72 });
  signPlane(est, 1.8, 0.45, 0, H2 + 2.05, 2.17, 0, { transparent: true });
  const name = signTex([VENUE.hotel], { w: 2048, h: 256, color: VENUE.roof, font: "Rye, serif", size: VENUE.hotel.length > 12 ? 170 : 200, stroke: VENUE.roofStroke, strokeW: 6 });
  signPlane(name, 14, 1.75, 0, H2 + 0.92, 2.16, 0, { transparent: true });
  // rear/upper volume so the building has depth from the street
  // (stops short of the front rooms upstairs so the real room behind the facade isn't buried in it)
  const body = new THREE.Mesh(uvBox(new THREE.BoxGeometry(26.2, 4.4, 15.85), 26.2, 4.4, 15.85, 2.4), MAT.brick);
  body.position.set(0, H1 + 2.2, -10.075); body.castShadow = true; scene.add(body);
  for (const sx of [-13.05, 13.05]) addBoxS(SBX, MAT.brick, sx, H1 + 2.2, -0.15, 0.1, 4.4, 4.0, 0, 2.4);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.15, 20.4), MAT.corr); roof.position.set(0, H2 + 0.08, -8); scene.add(roof);
  // side walls (exterior only visible from lane)
  buildWall('z', -13, -18, 2, H1, { low: [MAT.wainscot, MAT.brick], high: [MAT.paintCream, MAT.brick] }, -1, [], 0.3);
  buildWall('x', -18, -13.1, 13.1, H1, { low: [MAT.wainscot, MAT.brick], high: [MAT.paintCream, MAT.brick] }, -1, [{ a: -12.45, b: -11.55, bottom: 0, top: 2.1 }], 0.3);

  // ---- two-storey verandah with cast-iron lace ----
  const postX = [-12.8, -8.6, -4.3, 4.3, 8.6, 12.8];
  for (const px of postX) {
    addCylS(SBX, MAT.greenPaint, px, H1 / 2 - 0.1, 9.5, 0.07, H1 - 0.2, 10);
    addCylS(SBX, MAT.greenPaint, px, 0.12, 9.5, 0.12, 0.24, 10);
    addCylS(SBX, MAT.greenPaint, px, 6.0, 9.5, 0.06, 3.8, 10);
    addCol(px, 9.5, 0.2, 0.2);
  }
  // balcony floor + fascia
  addBoxS(SBX, MAT.creamPaint, 0, H1, 5.85, 26.4, 0.18, 7.6);
  addBoxS(SBX, MAT.greenPaint, 0, H1 - 0.05, 9.62, 26.4, 0.3, 0.06);
  // lace frieze under balcony and balustrade above
  const laceGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < postX.length - 1; i++) {
    const a = postX[i], b = postX[i + 1], w = b - a, cx = (a + b) / 2;
    const fr = new THREE.Mesh(laceGeo, MAT.lace); fr.scale.set(w - 0.15, 0.45, 1); fr.position.set(cx, H1 - 0.42, 9.55); scene.add(fr);
    const bal = new THREE.Mesh(laceGeo, MAT.lace); bal.scale.set(w - 0.15, 0.95, 1); bal.position.set(cx, H1 + 0.6, 9.55); scene.add(bal);
    addBoxS(SBX, MAT.greenPaint, cx, H1 + 1.1, 9.55, w, 0.08, 0.12);
    const fr2 = new THREE.Mesh(laceGeo, MAT.lace); fr2.scale.set(w - 0.15, 0.4, 1); fr2.position.set(cx, 7.55, 9.55); scene.add(fr2);
  }
  // centre span over the door
  const cs = new THREE.Mesh(laceGeo, MAT.lace); cs.scale.set(8.4, 0.45, 1); cs.position.set(0, H1 - 0.42, 9.55); scene.add(cs);
  // bullnose-ish corrugated roof (two sloped planes)
  const r1 = new THREE.Mesh(new THREE.PlaneGeometry(26.6, 7.9), MAT.corr); r1.rotation.x = -Math.PI / 2 - 0.08; r1.position.set(0, 7.95, 5.9); r1.castShadow = true; scene.add(r1);
  const r1b = r1.clone(); r1b.rotation.x = Math.PI / 2 - 0.08; r1b.position.y = 7.94; scene.add(r1b);
  const ceilV = new THREE.Mesh(new THREE.PlaneGeometry(26.4, 7.5), MAT.creamPaint); ceilV.rotation.x = Math.PI / 2; ceilV.position.set(0, H1 - 0.1, 5.85); scene.add(ceilV);
  // verandah lamps + under-verandah lightbox signs
  for (const lx of [-6.5, 6.5]) { SBX.add(G.sph, MAT.bulb, lx, 3.7, 5.5, 0, 0, 0, 0.12, 0.12, 0.12); optionalLight(pLight(0xffc27a, 14, 12, lx, 3.5, 5.6, 'street')); atmo.verandahLamps.push(V3(lx, 3.7, 5.5)); }
  const blade = [['COLD BEER', '#ffffff', ['#8a1a12', '#c7352b']], ['TAB · KENO', '#fff', ['#1a4d1a', '#2f8a3a']], ['GAMING', '#ffe27a', ['#2a0d3a', '#6a1d8a']], ['BISTRO', '#2a1d10', ['#f4e3b0', '#e3c47a']]];
  blade.forEach(([t, c, bg], i) => {
    const tx = signTex([t], { w: 512, h: 128, bg, color: c, size: 92, border: '#e8c56a', borderW: 6 });
    const sx = [-11, -3.1, 3.1, 11][i];
    const s1 = signPlane(tx, 1.6, 0.4, sx, 3.55, 7.2, 0, { intensity: 1.6, toneMapped: false });
    const s2 = signPlane(tx, 1.6, 0.4, sx, 3.55, 7.16, Math.PI, { intensity: 1.6, toneMapped: false });
    addBoxS(SBX, MAT.iron, sx, 3.78, 7.18, 1.65, 0.04, 0.1); addBoxS(SBX, MAT.iron, sx, 3.55, 7.18, 1.68, 0.44, 0.03);
    s1.position.z = 7.2; s2.position.z = 7.16; dynamic.neon.push(s1, s2);
  });
  // fascia sign over the door
  const fas = signTex([VENUE.name], { w: 1024, h: 200, bg: [VENUE.fascia[0], VENUE.fascia[1]], color: VENUE.fascia[2], font: 'Rye, serif', size: VENUE.name.length > 12 ? 92 : 130, border: VENUE.fascia[2], borderW: 8 });
  signPlane(fas, 3.4, 0.66, 0, 3.4, 2.17, 0, { intensity: 1.3, toneMapped: false });
  // door frame + front step (terrazzo)
  addBoxS(SBX, MAT.greenPaint, -1.38, 1.4, 2.0, 0.12, 2.8, 0.36); addBoxS(SBX, MAT.greenPaint, 1.38, 1.4, 2.0, 0.12, 2.8, 0.36); addBoxS(SBX, MAT.greenPaint, 0, 2.8, 2.0, 2.9, 0.1, 0.36);
  const terr = signTex([VENUE.terrazzo], { w: 512, h: 256, bg: '#b9ae9a', color: '#7a1f14', font: 'Rye, serif', size: 100, border: '#2f4a3a', borderW: 16 });
  const step = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshStandardMaterial({ map: terr, roughness: 0.3 })); step.rotation.x = -Math.PI / 2; step.position.set(0, 0.006, 2.8); step.receiveShadow = true; scene.add(step);
  // A-frame chalk board (updated each day)
  const ab = new THREE.Group(); ab.position.set(2.6, 0, 6.2); ab.rotation.y = -0.4; scene.add(ab);
  const bc = mkCanvas(512, 720); dynamic.boards.aframe = { c: bc, tex: canvasTex(bc, 1, 1) };
  const abm = new THREE.MeshStandardMaterial({ map: dynamic.boards.aframe.tex, roughness: 0.9 });
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.03), [MAT.darkWood, MAT.darkWood, MAT.darkWood, MAT.darkWood, s > 0 ? abm : MAT.darkWood, s > 0 ? MAT.darkWood : abm]); p.position.set(0, 0.47, 0.17 * s); p.rotation.x = -0.18 * s; p.castShadow = true; ab.add(p); }
  addCol(2.6, 6.2, 0.7, 0.5);
  // pot plants by the door
  for (const px of [-2.2, 2.2]) { addCylS(SBX, MAT.pot, px, 0.3, 2.6, 0.28, 0.6, 12); for (let k = 0; k < 7; k++) SBX.add(new THREE.ConeGeometry(0.12, 0.9, 5), MAT.leaf, px + rand(-.12, .12), 0.95, 2.6 + rand(-.12, .12), rand(0, 6), rand(-.5, .5), rand(-.5, .5)); addCol(px, 2.6, 0.6, 0.6); }
  // smoker's butt bin on a post
  addCylS(SBX, MAT.chrome, -3.4, 0.55, 3.2, 0.09, 1.1, 12); addCol(-3.4, 3.2, 0.25, 0.25);
}

// ---- double swing doors with spring physics ----
// timber-framed leaves with glazing bars, brass push plates and kick plates outside, long brass pull handles inside, hinge barrels and overhead closers
function buildDoors() {
  const timber = new THREE.MeshStandardMaterial({ color: 0x1f4d34, roughness: 0.4, metalness: 0.05 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9fb8c0, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  interiorMats.push(timber);
  const brass = MAT.brass, w = 1.28, h = 2.62;
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(1.3 * s, 0, 2.0); scene.add(pivot);
    const leaf = new THREE.Group(); pivot.add(leaf);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(-s * x, y, z); m.castShadow = true; leaf.add(m); return m; };
    // frame: stiles, top and bottom rails, mid rail
    add(new THREE.BoxGeometry(0.1, h, 0.06), timber, 0.05, h / 2, 0); add(new THREE.BoxGeometry(0.1, h, 0.06), timber, w - 0.05, h / 2, 0);
    add(new THREE.BoxGeometry(w, 0.12, 0.06), timber, w / 2, h - 0.06, 0); add(new THREE.BoxGeometry(w, 0.18, 0.06), timber, w / 2, 0.09, 0); add(new THREE.BoxGeometry(w, 0.1, 0.06), timber, w / 2, 1.2, 0);
    // lower panel with a raised moulding
    add(new THREE.BoxGeometry(w - 0.2, 0.9, 0.035), timber, w / 2, 0.65, 0.0); add(new THREE.BoxGeometry(w - 0.34, 0.74, 0.02), timber, w / 2, 0.65, 0.03); add(new THREE.BoxGeometry(w - 0.34, 0.74, 0.02), timber, w / 2, 0.65, -0.03);
    // glazing with bars
    add(new THREE.PlaneGeometry(w - 0.2, 1.3), glassM, w / 2, 1.9, 0);
    add(new THREE.BoxGeometry(0.03, 1.3, 0.04), timber, w / 2, 1.9, 0); for (const gy of [1.58, 2.22]) add(new THREE.BoxGeometry(w - 0.2, 0.03, 0.04), timber, w / 2, gy, 0);
    // brass: kick plates both sides, push plate outside, pull bar inside
    add(new THREE.BoxGeometry(w - 0.24, 0.22, 0.012), brass, w / 2, 0.2, 0.034); add(new THREE.BoxGeometry(w - 0.24, 0.22, 0.012), brass, w / 2, 0.2, -0.034);
    add(new THREE.BoxGeometry(0.22, 0.46, 0.014), brass, w - 0.24, 1.05, 0.035);
    const bar = add(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 10), brass, w - 0.2, 1.05, -0.085); for (const by of [-0.24, 0.24]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.05, 6), brass); post.rotation.x = Math.PI / 2; post.position.set(0, by, 0.04); bar.add(post); }
    // PUSH outside, PULL inside
    const et = signTex(['PUSH'], { w: 256, h: 64, color: '#e8c56a', size: 40 }), pt = signTex(['PULL'], { w: 256, h: 64, color: '#e8c56a', size: 40 });
    const ep = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshBasicMaterial({ map: et, transparent: true })); ep.position.set(-s * (w - 0.24), 1.34, 0.037); leaf.add(ep);
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshBasicMaterial({ map: pt, transparent: true })); pp.position.set(-s * (w - 0.2), 1.46, -0.037); pp.rotation.y = Math.PI; leaf.add(pp);
    // hinge barrels and a spring closer on the head
    for (const hy of [0.35, 1.3, 2.3]) { const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8), brass); hg.position.set(0, hy, 0); pivot.add(hg); }
    const clo = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.6, roughness: 0.4 })); clo.position.set(-s * 0.28, h + 0.05, -0.1); leaf.add(clo);
    pivot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    dynamic.doors.push({ pivot, s, w, ang: 0, vel: 0, lastSound: 0 });
  }
  // brass threshold strip and a stainless kick-guard on the jambs
  addBoxS(SBX, brass, 0, 0.012, 2.0, 2.7, 0.025, 0.2);
}
function updateDoors(dt, actors) {
  for (const d of dynamic.doors) {
    let torque = -d.ang * 9 - d.vel * 3.2; // spring + damper
    for (const a of actors) {
      // open a little before you reach it, so the leaf never swings through the camera: the nearer you are, the further it eases open
      const az = a.z - d.pivot.position.z, ax = a.x;
      if (Math.abs(az) < 1.5 && Math.abs(ax) < 1.6) torque += -Math.sign(az || 1) * (1.5 - Math.abs(az)) * 6.5;
      // test against leaf segment
      const hx = d.pivot.position.x, hz = d.pivot.position.z;
      const tipx = hx - d.s * Math.cos(d.ang) * d.w, tipz = hz + Math.sin(d.ang) * d.w;
      const ex = tipx - hx, ez = tipz - hz, len2 = ex * ex + ez * ez;
      const t = clamp(((a.x - hx) * ex + (a.z - hz) * ez) / len2, 0.05, 1);
      const px = hx + ex * t, pz = hz + ez * t, dx = a.x - px, dz = a.z - pz, dist = Math.hypot(dx, dz);
      const r = a.r + 0.08;
      if (dist < r) {
        // direction the tip moves for +ang; push the leaf away from the actor
        const mx = d.s * Math.sin(d.ang), mz = Math.cos(d.ang);
        const side = Math.sign(dx * mx + dz * mz) || Math.sign(a.z - hz) || 1;
        torque += -side * (r - dist) * 70 * t;
      }
    }
    d.vel += torque * dt; d.ang += d.vel * dt; d.ang = clamp(d.ang, -1.6, 1.6);
    if (Math.abs(d.vel) > 1.6 && performance.now() - d.lastSound > 700) { d.lastSound = performance.now(); SFX.door(d.pivot.position); }
    d.pivot.rotation.y = d.ang * d.s;
  }
}

// =====================================================================
//  BUILD: INTERIOR
// =====================================================================
let backMirror;
const BAR = { front: -8.5, taps: [], z0: -14.5, z1: -2.5, tender: null, shelfZ: [] };
const MACHINES = [];
const MACHINE_DEFS = [];

function buildInterior() {
  // floors
  const fl = new THREE.PlaneGeometry(26, 20); fl.rotateX(-Math.PI / 2); uvScale(fl, 26 / 3, 20 / 3);
  const floor = mesh(fl, MAT.timber, 0, 0.002, -8); floor.receiveShadow = true;
  const cp = new THREE.PlaneGeometry(10, 14); cp.rotateX(-Math.PI / 2); uvScale(cp, 10 / 6 * 6 / 6, 14 / 6);
  const carpet = mesh(cp, MAT.carpet, 8, 0.006, -11); carpet.receiveShadow = true;
  MAT.carpet.map.repeat.set(1.7, 1.7);
  const dk = new THREE.PlaneGeometry(6.6, 10); dk.rotateX(-Math.PI / 2); uvScale(dk, 1.6, 2.5);
  mesh(dk, MAT.deck, 16.3, 0.004, -13).receiveShadow = true;
  // ceiling
  const cg = new THREE.PlaneGeometry(26, 20); cg.rotateX(Math.PI / 2); uvScale(cg, 26 / 0.9, 20 / 0.9);
  mesh(cg, MAT.ceiling, 0, PUB.ceil, -8);
  addBoxS(SB, MAT.darkWood, 0, PUB.ceil - 0.08, 1.85, 26, 0.16, 0.12);
  // interior partitions: gaming room
  const gmat = { low: [MAT.wainscot, MAT.gamingWall], high: [MAT.paintCream, MAT.gamingWall] };
  buildWall('z', 3, -18, -4, PUB.ceil, gmat, 1, [{ a: -11, b: -9, bottom: 0, top: 2.6 }], 0.18);
  buildWall('x', -4, 3, 13, PUB.ceil, { low: [MAT.gamingWall, MAT.wainscot], high: [MAT.gamingWall, MAT.paintGreen] }, 1, [{ a: 6.5, b: 8.5, bottom: 0, top: 2.6 }], 0.18);
  // right exterior wall with terrace door + fireplace
  buildWall('z', 13, -18, 2, PUB.ceil, { low: [MAT.wainscot, MAT.brick], high: [MAT.paintGreen, MAT.brick] }, 1, [{ a: -14, b: -12, bottom: 0, top: 2.6 }], 0.3);
  // gaming room inner walls colour (inside faces of right wall in gaming area) — overlay panels
  addBoxS(SB, MAT.gamingWall, 12.84, 2.0, -16, 0.02, 4.0, 4.0); addBoxS(SB, MAT.gamingWall, 12.84, 2.0, -8, 0.02, 4.0, 8.0);
  addBoxS(SB, MAT.gamingWall, 8, 2.0, -17.84, 10, 4.0, 0.02);
  // sliding glass terrace door frame
  addBoxS(SB, MAT.chrome, 13, 2.62, -13, 0.32, 0.06, 2.0);
  const tdg = mesh(new THREE.PlaneGeometry(1.0, 2.55), MAT.window, 13, 1.3, -13.5); tdg.rotation.y = Math.PI / 2;
  // dado rail on walls
  for (const [x, z, w, d] of [[-12.88, -8, 0.04, 20], [0, -17.88, 26, 0.04], [0, 1.84, 26, 0.04]]) addBoxS(SB, MAT.darkWood, x, 1.12, z, w, 0.06, d);

  buildBar();
  buildPublicBar();
  buildLounge();
  buildGamingRoom();
  buildTerrace();
  buildBarClutter();
  // lights
  pLight(0xffc98a, 15, 16, -9.6, 2.9, -10.5);
  pLight(0xffc98a, 15, 16, -9.6, 2.9, -4.5);
  spotShadow(0xffcf98, 70, -4.6, 3.95, -7.6, 1.15);
  pLight(0xfff0d8, 16, 6, -3.0, 2.2, -13.2);
  pLight(0xffbf7a, 13, 14, 7.5, 3.0, -0.8);
  spotShadow(0xe0b8ff, 85, 7.3, 3.95, -11.0, 1.25);
  optionalLight(pLight(0xffc0d8, 17, 12, 7.5, 3.0, -15));
  dynamic.fire = pLight(0xff7a2a, 8, 7, 12.2, 0.7, -1.2);
  dynamic.heater = pLight(0xff6a2a, 16, 9, 15.6, 2.3, -10.5);
  optionalLight(pLight(0xffd29a, 9, 10, 16.5, 2.9, -14.5));
  // ceiling fans
  for (const [fx, fz] of [[-3.5, -4], [-3.5, -11], [8, -0.5]]) {
    const g = new THREE.Group(); g.position.set(fx, PUB.ceil - 0.5, fz); scene.add(g);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 16), MAT.brass); g.add(hub);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), MAT.brass); rod.position.y = 0.3; g.add(rod);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.14), MAT.darkWood); b.position.set(Math.cos(i * Math.PI / 2) * 0.4, -0.02, Math.sin(i * Math.PI / 2) * 0.4); b.rotation.y = -i * Math.PI / 2; b.rotation.x = 0.12; g.add(b); }
    dynamic.fans.push(g);
  }
  // pendants
  for (const [px, pz] of [[-9.6, -12.5], [-9.6, -9], [-9.6, -5.5], [-5.5, -10.5], [-5.5, -6.5], [-5.5, -2.5], [5.5, -1.5], [9.5, -1.5], [5.5, 0.8], [9.5, 0.8]]) pendant(px, pz);
  // pool table lamp
  SB.add(G.box, MAT.greenPaint, -3, 2.45, -13.2, 0, 0, 0, 0.5, 0.18, 1.5); SB.add(G.box, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.2, 1.0) }), -3, 2.35, -13.2, 0, 0, 0, 0.4, 0.02, 1.3);
}

function buildBar() {
  const F = BAR.front, z0 = BAR.z0, z1 = BAR.z1, L = z1 - z0;
  // counter body
  const body = uvBox(new THREE.BoxGeometry(0.55, 1.05, L), 0.55, 1.05, L, 1);
  SB.add(body, MAT.wainscot, F - 0.3, 0.525, (z0 + z1) / 2);
  // returns to wall
  SB.add(uvBox(new THREE.BoxGeometry(4.5, 1.05, 0.55), 4.5, 1.05, .55, 1), MAT.wainscot, -10.75, 0.525, z0 + 0.27);
  SB.add(uvBox(new THREE.BoxGeometry(4.5, 1.05, 0.55), 4.5, 1.05, .55, 1), MAT.wainscot, -10.75, 0.525, z1 - 0.27);
  // polished top with overhang
  SB.add(uvBox(new THREE.BoxGeometry(0.8, 0.06, L + 0.3), .8, .06, L, 1), MAT.barTop, F - 0.25, 1.08, (z0 + z1) / 2);
  SB.add(uvBox(new THREE.BoxGeometry(4.6, 0.06, 0.8), 4.6, .06, .8, 1), MAT.barTop, -10.75, 1.08, z0 + 0.27);
  SB.add(uvBox(new THREE.BoxGeometry(4.6, 0.06, 0.8), 4.6, .06, .8, 1), MAT.barTop, -10.75, 1.08, z1 - 0.27);
  // brass foot rail
  addCylS(SB, MAT.brass, F + 0.12, 0.22, (z0 + z1) / 2, 0.025, L, 12, 0, Math.PI / 2);
  for (let z = z0 + 0.5; z < z1; z += 1.6) SB.add(G.box, MAT.brass, F + 0.06, 0.22, z, 0, 0, 0, 0.12, 0.03, 0.03);
  // trough / drip rail line
  addBoxS(SB, MAT.chrome, F - 0.42, 1.115, (z0 + z1) / 2, 0.12, 0.012, L - 0.4);
  addColBox(F - 0.65, F + 0.05, z0, z1); addColBox(-13, F, z0 - 0.05, z0 + 0.55); addColBox(-13, F, z1 - 0.55, z1 + 0.05);
  addColBox(-13, F, z0, z1); // staff-only area
  // tap towers (T-bar with 4 handles)
  const tapNames = [['GOLDEN', 'LAGER', '#d9a12a'], ['SOUTHERLY', 'BITTER', '#2a6b2f'], ['LARRIKIN', 'PALE ALE', '#b5541b'], ['DROVER\'S', 'DRAUGHT', '#22477a']];
  for (const tz of [-11.5, -6.5]) {
    // T-bar tower: badges face the customer, spouts and drip tray face the bartender
    SB.add(G.box, MAT.chrome, F - 0.38, 1.26, tz, 0, 0, 0, 0.06, 0.3, 0.06);
    SB.add(G.box, MAT.chrome, F - 0.38, 1.42, tz, 0, 0, 0, 0.07, 0.07, 1.1);
    SB.add(G.box, MAT.chrome, F - 0.53, 1.12, tz, 0, 0, 0, 0.2, 0.02, 1.15); // drip tray
    SB.add(G.box, MAT.iron, F - 0.53, 1.131, tz, 0, 0, 0, 0.17, 0.004, 1.1); // drip grate
    for (let k = 0; k < 4; k++) {
      const z = tz - 0.42 + k * 0.28, [a, b, col] = tapNames[k];
      SB.add(G.cyl8, MAT.chrome, F - 0.45, 1.42, z, 0, 0, Math.PI / 2, 0.016, 0.14, 0.016);
      SB.add(G.cyl8, MAT.chrome, F - 0.52, 1.39, z, 0, 0, 0, 0.011, 0.06, 0.011);
      // handle (dynamic so it can be pulled)
      const hg = new THREE.Group(); hg.position.set(F - 0.38, 1.455, z); scene.add(hg);
      const ht = signTex([a, b], { w: 128, h: 256, bg: ['#111', col], color: '#fff', sizes: [30, 34], border: '#d4a94e', borderW: 6 });
      const hm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.05), [MAT.blackPlastic, MAT.blackPlastic, MAT.blackPlastic, MAT.blackPlastic, MAT.blackPlastic, MAT.blackPlastic]);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.2), new THREE.MeshBasicMaterial({ map: ht })); face.rotation.y = Math.PI / 2; face.position.x = 0.019;
      hm.position.y = 0.1; face.position.y = 0.1; hg.add(hm); hg.add(face);
      BAR.taps.push({ handle: hg, spout: V3(F - 0.52, 1.355, z), z, name: a + ' ' + b, col });
    }
  }
  // beer mats & bar runners along counter
  const runner = M({ color: 0x1a3a6a, roughness: 0.95 });
  for (let z = z0 + 0.8; z < z1 - 0.3; z += 1.05) SB.add(G.box, runner, F - 0.12, 1.116, z, 0, 0, 0, 0.3, 0.006, 0.42);
  // till / register
  SB.add(G.box, MAT.blackPlastic, F - 0.55, 1.25, -9, 0, 0, 0, 0.35, 0.25, 0.4); SB.add(G.box, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.4, 0.3) }), F - 0.4, 1.38, -9, 0, 0.5, 0, 0.01, 0.15, 0.25); // till display
  // back bar: cabinets, fridges, shelves, mirror
  SB.add(uvBox(new THREE.BoxGeometry(0.6, 0.95, 12), .6, .95, 12, 1), MAT.darkWood, -12.6, 0.475, -8.5);
  SB.add(uvBox(new THREE.BoxGeometry(0.66, 0.05, 12), .66, .05, 12, 1), MAT.barTop, -12.6, 0.97, -8.5);
  // fridges with glowing glass doors
  for (let i = 0; i < 3; i++) {
    const fz = -13.6 + i * 0.9;
    SB.add(G.box, MAT.chrome, -12.62, 1.6, fz, 0, 0, 0, 0.6, 1.3, 0.86);
    SB.add(G.box, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.48, 0.55) }), -12.3, 1.6, fz, 0, 0, 0, 0.02, 1.15, 0.74);
    for (let sh = 0; sh < 4; sh++) for (let b = 0; b < 6; b++) SB.add(G.cyl8, M({ color: choice([0x2a5a1a, 0x7a4a10, 0x10305a, 0xa8a8a0]), roughness: 0.2, metalness: 0.3 }), -12.4, 1.1 + sh * 0.3, fz - 0.3 + b * 0.12, 0, 0, 0, 0.03, 0.22, 0.03);
  }
  // spirit shelves with bottles in front of mirror
  const mirrorZ0 = -10.6, mirrorZ1 = -2.9;
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(mirrorZ1 - mirrorZ0, 1.5), MAT.mirrorFake); mm.rotation.y = Math.PI / 2; mm.position.set(-12.86, 1.95, (mirrorZ0 + mirrorZ1) / 2); scene.add(mm);
  for (let s = 0; s < 3; s++) {
    const y = 1.25 + s * 0.42;
    SB.add(G.box, MAT.glassShelf || (MAT.glassShelf = M({ color: 0xbcd8d8, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.5 })), -12.7, y, (mirrorZ0 + mirrorZ1) / 2, 0, 0, 0, 0.3, 0.015, mirrorZ1 - mirrorZ0);
    for (let z = mirrorZ0 + 0.15; z < mirrorZ1 - 0.1; z += rand(0.11, 0.16)) {
      const col = choice([0x6a3a10, 0x8a5a14, 0x1a4a2a, 0xd8d8c8, 0x3a1010, 0x101010, 0xb8a050, 0x5a1a4a]);
      const h = rand(0.24, 0.34), r = rand(0.03, 0.045);
      const bm = M({ color: col, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
      SB.add(G.cyl8, bm, -12.7 + rand(-0.06, 0.06), y + h / 2 + 0.01, z, 0, 0, 0, r, h, r);
      SB.add(G.cyl8, bm, -12.7, y + h + 0.04, z, 0, 0, 0, r * 0.35, 0.08, r * 0.35);
      if (Math.random() < 0.5) SB.add(G.cyl8, MAT.white, -12.68, y + h * 0.45, z, 0, 0, 0, r * 1.02, h * 0.35, r * 1.02);
    }
  }
  // gilt mirror frame + bar sign
  addBoxS(SB, MAT.brass, -12.84, 2.72, (mirrorZ0 + mirrorZ1) / 2, 0.04, 0.08, mirrorZ1 - mirrorZ0 + 0.1);
  const barSign = signTex(['PUBLIC BAR'], { w: 1024, h: 160, color: '#f0cf6a', font: 'Rye, serif', size: 100 });
  signPlane(barSign, 3.6, 0.56, -12.84, 3.2, -6.7, Math.PI / 2, { transparent: true });
  // glass racks below counter (dish of schooners)
  for (let i = 0; i < 10; i++) SB.add(G.cyl8, MAT.glassShelf, F - 0.75, 1.0 - 0.15, -4 - i * 0.12, 0, 0, 0, 0.035, 0.15, 0.035);
  // bartender spots
  BAR.tender = { home: V3(-10.0, 0, -8), ry: Math.PI / 2 };
  addInteract({ id: 'bar', pos: V3(F - 0.1, 1.2, -8.5), r: 0, label: () => 'Order at the bar', zone: { x0: F, x1: F + 1.9, z0: z0 + 0.3, z1: z1 - 0.3 }, action: () => Game.openBar() });
}

function blob(x, z, s, y = 0.004) { SB.add(G.plane, MAT.blob, x, y, z, 0, -Math.PI / 2, 0, s, s, 1); }
function stool(b, x, z, h = 0.76, mat = MAT.vinylRed) {
  blob(x, z, 0.62);
  addCylS(b, mat, x, h, z, 0.19, 0.07, 18);
  addCylS(b, MAT.chrome, x, h / 2, z, 0.025, h, 8);
  b.add(G.torus, MAT.chrome, x, 0.3, z, 0, Math.PI / 2, 0, 0.17, 0.17, 0.17);
  addCylS(b, MAT.chrome, x, 0.015, z, 0.2, 0.03, 16);
}
function roundTable(b, x, z, h, r = 0.38) {
  blob(x, z, 1.1);
  addCylS(b, MAT.barTop, x, h, z, r, 0.05, 24);
  addCylS(b, MAT.iron, x, h / 2, z, 0.04, h, 8);
  addCylS(b, MAT.iron, x, 0.02, z, 0.3, 0.04, 16);
  addCol(x, z, r * 1.6, r * 1.6);
}
function chair(b, x, z, ry) {
  blob(x, z, 0.75);
  const s = Math.sin(ry), c = Math.cos(ry);
  b.add(G.box, MAT.darkWood, x, 0.46, z, ry, 0, 0, 0.44, 0.05, 0.44);
  for (const [lx, lz] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) b.add(G.box, MAT.darkWood, x + lx * c + lz * s, 0.23, z - lx * s + lz * c, ry, 0, 0, 0.04, 0.46, 0.04);
  const bx = x - s * 0.2, bz = z - c * 0.2;
  b.add(G.box, MAT.darkWood, bx, 0.72, bz, ry, 0, 0, 0.44, 0.5, 0.04);
}

function buildPublicBar() {
  // bar stools
  for (let i = 0; i < 11; i++) {
    const z = -13.6 + i * 1.05; stool(SB, -7.9, z);
    addSpot({ kind: 'stool', pos: V3(-7.9, 0, z), ry: -Math.PI / 2, sitH: 0.8, area: 'bar', node: 'P3', group: 'bs' + Math.floor(i / 2) });
  }
  // high tables
  for (const tz of [-10.5, -6.5, -2.5]) {
    roundTable(SB, -5.4, tz, 1.05);
    for (const dz of [-0.6, 0.6]) { stool(SB, -5.4, tz + dz, 0.72, MAT.vinylBlack); addSpot({ kind: 'stool', pos: V3(-5.4, 0, tz + dz), ry: dz > 0 ? Math.PI : 0, sitH: 0.76, area: 'bar', group: 'ht' + tz }); }
  }
  // standing spots near bar ends / poles
  addSpot({ kind: 'lean', pos: V3(-7.6, 0, -1.8), ry: -2.3, area: 'bar' });
  addSpot({ kind: 'stand', pos: V3(-2.5, 0, -8.2), ry: 1.2, area: 'bar' });
  addSpot({ kind: 'stand', pos: V3(-1.6, 0, -7.2), ry: -2.2, area: 'bar' });
  // pool table
  const px = -3, pz = -13.2;
  SB.add(uvBox(new THREE.BoxGeometry(1.5, 0.12, 2.7), 1.5, .12, 2.7, 1), MAT.darkWood, px, 0.78, pz);
  SB.add(G.box, MAT.felt, px, 0.845, pz, 0, 0, 0, 1.28, 0.01, 2.48);
  for (const [cx, cz] of [[-.68, 0], [.68, 0]]) SB.add(G.box, MAT.darkWood, px + cx, 0.88, pz, 0, 0, 0, 0.14, 0.08, 2.7);
  for (const cz of [-1.3, 1.3]) SB.add(G.box, MAT.darkWood, px, 0.88, pz + cz, 0, 0, 0, 1.5, 0.08, 0.14);
  for (const [lx, lz] of [[-.6, -1.2], [.6, -1.2], [-.6, 1.2], [.6, 1.2]]) SB.add(G.box, MAT.darkWood, px + lx, 0.36, pz + lz, 0, 0, 0, 0.16, 0.72, 0.16);
  const ballCols = [0xf2f2ee, 0xe8c52a, 0x1a3aa8, 0xc7352b, 0x5a1a8a, 0xe8772a, 0x1a7a3a, 0x7a1a1a, 0x111111, 0xe8c52a, 0x1a3aa8, 0xc7352b];
  ballCols.forEach((c, i) => SB.add(G.sph, M({ color: c, roughness: 0.15 }), px + rand(-0.5, 0.5), 0.877, pz + rand(-1.0, 1.0), 0, 0, 0, 0.028, 0.028, 0.028));
  addCol(px, pz, 1.5, 2.7);
  SB.add(G.plane, MAT.blob, px, 0.004, pz, 0, -Math.PI / 2, 0, 2.3, 3.6, 1);
  addSpot({ kind: 'pool', pos: V3(px + 1.1, 0, pz - 0.6), ry: -Math.PI / 2, area: 'bar' });
  addSpot({ kind: 'pool', pos: V3(px - 1.1, 0, pz + 0.8), ry: Math.PI / 2, area: 'bar' });
  // cue rack + dartboard + toilets on back wall
  SB.add(G.box, MAT.darkWood, 0.2, 1.4, -17.85, 0, 0, 0, 0.8, 1.2, 0.06);
  for (let i = 0; i < 5; i++) SB.add(G.cyl8, MAT.darkWood, -0.1 + i * 0.15, 1.35, -17.8, 0, 0, 0.0, 0.012, 1.4, 0.012);
  SB.add(G.box, MAT.darkWood, -7.0, 1.73, -17.87, 0, 0, 0, 0.78, 0.78, 0.04); // backboard (the board itself is built by the darts game)
  addSpot({ kind: 'stand', pos: V3(-7.0, 0, -15.6), ry: Math.PI, area: 'bar', anim: 'darts' });
  for (const [tx, t] of [[-12.0, 'GENTS'], [-10.3, 'LADIES']]) {
    if (t === 'LADIES') { SB.add(G.box, MAT.darkWood, tx, 1.05, -17.86, 0, 0, 0, 0.9, 2.1, 0.06); SB.add(G.box, MAT.brass, tx + 0.32, 1.0, -17.82, 0, 0, 0, 0.04, 0.12, 0.04); }
    else { addBoxS(SB, MAT.darkWood, tx, 2.16, -17.83, 1.06, 0.12, 0.08); for (const dx of [-0.49, 0.49]) addBoxS(SB, MAT.darkWood, tx + dx, 1.05, -17.83, 0.08, 2.1, 0.08); }
    signPlane(signTex([t], { w: 256, h: 96, bg: '#1a1a1a', color: '#e8c56a', size: 64 }), 0.5, 0.18, tx, 1.75, -17.82, 0);
  }
  addSpot({ kind: 'toilet', pos: V3(-11.1, 0, -17.2), ry: Math.PI, area: 'bar', hidden: true });
  // big vintage mirror on back wall — reflects the windows & street (real reflection)
  const mw = 3.4, mh = 1.5, mx = -3.4, my = 2.35;
  backMirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { clipBias: 0.003, textureWidth: 640, textureHeight: 320, color: 0xb8b0a0 });
  backMirror.position.set(mx, my, -17.84); scene.add(backMirror); window.__mirror = backMirror;
  const fb = mesh(new THREE.PlaneGeometry(mw, mh), MAT.mirrorFake, mx, my, -17.845); window.__mirrorFallback = fb; fb.visible = false;
  const frameM = M({ color: 0xb8902e, metalness: 1, roughness: 0.35 });
  for (const [fx, fy, fw, fh] of [[0, mh / 2 + 0.08, mw + 0.3, 0.16], [0, -mh / 2 - 0.08, mw + 0.3, 0.16], [-mw / 2 - 0.08, 0, 0.16, mh], [mw / 2 + 0.08, 0, 0.16, mh]]) SB.add(G.box, frameM, mx + fx, my + fy, -17.82, 0, 0, 0, fw, fh, 0.06);
  const mt = signTex([VENUE.id === 'royal' ? 'THE ROYAL HOTEL' : VENUE.name, VENUE.sub], { w: 1024, h: 256, color: ['#f3d27a', '#e8dcc0'], font: 'Rye, serif', sizes: [86, 40] });
  signPlane(mt, 2.4, 0.6, mx, my + 0.35, -17.83, 0, { transparent: true });
  // TVs: racing above bar end, footy over door
  const tvA = makeTV(-8.65, 3.0, -0.6, Math.PI / 2 * 0 + Math.PI, 'racing'); // facing -z? placed near bar return
  tvA.group.position.set(-8.4, 3.0, -15.3); tvA.group.rotation.y = 0.35;
  makeTV(0, 3.15, 1.75, Math.PI, 'footy');
  makeTV(12.85, 2.6, -2.6, -Math.PI / 2, 'footy');
  // Keno screen on partition (bar side) + keno counter
  const kc = mkCanvas(512, 384); dynamic.keno = { c: kc, tex: canvasTex(kc, 1, 1) };
  const ks = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), new THREE.MeshBasicMaterial({ map: dynamic.keno.tex, toneMapped: true })); ks.material.color.setScalar(1.2);
  ks.position.set(2.88, 2.3, -14.2); ks.rotation.y = -Math.PI / 2; scene.add(ks);
  SB.add(G.box, MAT.blackPlastic, 2.92, 2.3, -14.2, 0, 0, 0, 0.06, 1.15, 1.5);
  SB.add(G.box, MAT.darkWood, 2.6, 0.55, -14.2, 0, 0, 0, 0.5, 1.1, 1.2); SB.add(G.box, MAT.barTop, 2.55, 1.12, -14.2, 0, 0, 0, 0.62, 0.04, 1.3);
  signPlane(signTex(['KENO'], { w: 256, h: 96, bg: ['#c7352b', '#7a1f14'], color: '#fff', size: 72 }), 0.6, 0.22, 2.3, 1.0, -14.2, -Math.PI / 2);
  addColBox(2.3, 3, -14.85, -13.55);
  addInteract({ id: 'keno', pos: V3(2.4, 1.3, -14.2), r: 2.2, label: () => 'Play Keno', action: () => Game.openKeno() });
  // jukebox
  const jx = 1.6, jz = -17.45;
  SB.add(new RoundedBoxGeometry(0.9, 1.5, 0.6, 3, 0.12), MAT.darkWood, jx, 0.75, jz);
  addCol(jx, jz, 1.0, 0.7);
  dynamic.jukePos = V3(jx, 1.2, jz);
  addInteract({ id: 'juke', pos: V3(jx, 1.1, jz + 0.3), r: 2.0, label: () => `Jukebox — ♫ ${Music.SONGS[Music.song].name}`, action: () => Game.openJukebox() });
  // memorabilia frames on left & back walls
  [[-3.9, 1.84, Math.PI], [-2.3, 1.84, Math.PI], [2.2, 1.84, Math.PI]].forEach(([fx, fz, fr], i) => framed(fx, 2.4, fz, fr, i));
  framed(2.9, 2.3, -8.1, -Math.PI / 2, 3); framed(2.9, 2.3, -4.75, -Math.PI / 2, 4);
  // fridge magnet style specials chalkboard on partition (bar side)
  const cb = mkCanvas(512, 640); dynamic.boards.specials = { c: cb, tex: canvasTex(cb, 1, 1) };
  const cbm = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), new THREE.MeshStandardMaterial({ map: dynamic.boards.specials.tex, roughness: 0.9 }));
  cbm.position.set(2.88, 2.1, -6.0); cbm.rotation.y = -Math.PI / 2; scene.add(cbm);
  SB.add(G.box, MAT.darkWood, 2.9, 2.1, -6.0, 0, 0, 0, 0.04, 1.35, 1.1);
}
function framed(x, y, z, ry, i) {
  const c = mkCanvas(256, 320), g = c.getContext('2d');
  const themes = [['#1a1a5a', '#fff', '1977'], ['#7a1f14', '#e8c56a', 'PREMIERS'], ['#0a3a1a', '#e8dcc0', 'CUP DAY'], ['#222', '#ddd', 'FIRST PINT'], ['#3a2a10', '#e8c56a', '1956']];
  const [bg, fg, t] = themes[i % themes.length];
  g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, 256, 320); g.fillStyle = bg; g.fillRect(24, 24, 208, 230);
  if (i % 2 === 0) { // footy jersey silhouette
    g.fillStyle = fg; g.beginPath(); g.moveTo(80, 60); g.lineTo(176, 60); g.lineTo(215, 100); g.lineTo(190, 125); g.lineTo(176, 112); g.lineTo(176, 230); g.lineTo(80, 230); g.lineTo(80, 112); g.lineTo(66, 125); g.lineTo(41, 100); g.closePath(); g.fill();
    g.fillStyle = bg; g.font = 'bold 60px Bebas Neue, Impact'; g.textAlign = 'center'; g.fillText(String(randi(1, 44)), 128, 170);
  } else { // sepia photo
    const gr = g.createLinearGradient(0, 24, 0, 254); gr.addColorStop(0, '#9a8a6a'); gr.addColorStop(1, '#4a3a2a'); g.fillStyle = gr; g.fillRect(24, 24, 208, 230);
    g.fillStyle = 'rgba(30,20,10,.7)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(50 + k * 32, 150, 14, 0, 7); g.fill(); g.fillRect(38 + k * 32, 162, 24, 70); }
  }
  g.fillStyle = '#2a1d10'; g.font = 'bold 34px Bebas Neue, Impact'; g.textAlign = 'center'; g.fillText(t, 128, 295);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })); p.position.set(x + Math.sin(ry) * 0.02, y, z + Math.cos(ry) * 0.02); p.rotation.y = ry; scene.add(p);
  SB.add(G.box, MAT.darkWood, x, y, z, ry, 0, 0, 0.58, 0.7, 0.03);
}

function buildLounge() {
  for (const [tx, tz] of [[5.5, -1.7], [9.4, -1.7], [5.5, 0.6], [9.4, 0.6]]) {
    SB.add(uvBox(new THREE.BoxGeometry(1.2, 0.05, 0.9), 1.2, .05, .9, 1), MAT.barTop, tx, 0.76, tz);
    addCylS(SB, MAT.iron, tx, 0.38, tz, 0.05, 0.76, 8); SB.add(G.box, MAT.iron, tx, 0.02, tz, 0, 0, 0, 0.6, 0.04, 0.6);
    addCol(tx, tz, 1.2, 0.9);
    for (const [dx, dz, ry] of [[-0.75, 0, Math.PI / 2], [0.75, 0, -Math.PI / 2]]) {
      chair(SB, tx + dx, tz + dz, ry);
      addSpot({ kind: 'chair', pos: V3(tx + dx, 0, tz + dz), ry, sitH: 0.48, area: 'lounge', group: 'lt' + tx + '_' + tz });
    }
    // salt/pepper + menu + condiments
    SB.add(G.cyl8, MAT.white, tx - 0.1, 0.83, tz, 0, 0, 0, 0.02, 0.09, 0.02); SB.add(G.cyl8, MAT.iron, tx + 0.1, 0.83, tz, 0, 0, 0, 0.02, 0.09, 0.02);
  }
  // fireplace
  const fx = 12.75, fz = -1.2;
  SB.add(uvBox(new THREE.BoxGeometry(0.5, 1.3, 1.8), .5, 1.3, 1.8, 1), MAT.brickDark, fx, 0.65, fz);
  SB.add(G.box, MAT.darkWood, fx - 0.05, 1.35, fz, 0, 0, 0, 0.62, 0.1, 2.0);
  SB.add(G.box, new THREE.MeshBasicMaterial({ color: 0x050302 }), fx - 0.26, 0.45, fz, 0, 0, 0, 0.02, 0.7, 1.0);
  for (let i = 0; i < 4; i++) SB.add(G.cyl8, MAT.darkWood, fx - 0.3, 0.16, fz - 0.3 + i * 0.2, 0, Math.PI / 2, 0.3, 0.05, 0.6, 0.05);
  const flameMat = new THREE.MeshBasicMaterial({ map: TEX.glow, color: new THREE.Color(3, 1.2, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  dynamic.flames = [];
  for (let i = 0; i < 5; i++) { const f = new THREE.Sprite(flameMat.clone()); f.position.set(fx - 0.32, 0.35, fz - 0.35 + i * 0.18); f.scale.set(0.3, 0.5, 1); scene.add(f); dynamic.flames.push(f); }
  addColBox(12.5, 13, fz - 0.9, fz + 0.9);
  dynamic.firePos = V3(fx - 0.4, 0.5, fz);
  // ATM
  const ax = 12.6, az = -3.3;
  ATM.build(ax, az);   // the machine itself lives with the ATM logic (19-service.js)
  addCol(ax, az, 0.62, 0.7);
  addInteract({ id: 'atm', pos: V3(ax - 0.3, 1.2, az), r: 1.8, label: () => 'Use ATM', action: () => Game.openATM() });
  // lounge standing spot + fireside
  addSpot({ kind: 'stand', pos: V3(11.4, 0, -2.6), ry: 2.6, area: 'lounge' });
  // potted palm
  addCylS(SB, MAT.pot, 3.6, 0.3, 1.4, 0.25, 0.6, 12); for (let k = 0; k < 9; k++) SB.add(new THREE.ConeGeometry(0.1, 1.1, 4), MAT.leaf, 3.6 + rand(-.1, .1), 1.1, 1.4 + rand(-.1, .1), rand(0, 6), rand(-.7, .7), rand(-.7, .7)); addCol(3.6, 1.4, 0.5, 0.5);
}

function buildGamingRoom() {
  // signage
  const gs = signTex(['GAMING ROOM'], { w: 1024, h: 200, color: '#ffd84a', glow: '#ff7a00', glowB: 30, font: 'Bungee, sans-serif', size: 110 });
  const g1 = signPlane(gs, 2.4, 0.47, 7.5, 3.15, -3.89, 0, { transparent: true, toneMapped: false, intensity: 2 }); dynamic.neon.push(g1);
  const g2 = signPlane(gs, 2.0, 0.39, 3.11, 2.9, -10, Math.PI / 2, { transparent: true, toneMapped: false, intensity: 2 }); dynamic.neon.push(g2);
  const rg = signTex(['THINK! ABOUT YOUR CHOICES', 'Set a limit. Stick to it.', 'Gambling Help: 24/7 · free · confidential'], { w: 1024, h: 384, bg: '#f4f0e6', color: ['#7a1f14', '#222', '#333'], sizes: [72, 56, 40], border: '#7a1f14', borderW: 10 });
  signPlane(rg, 1.2, 0.45, 11.5, 1.7, -17.82, 0);
  signPlane(rg, 1.0, 0.375, 3.11, 1.6, -15.5, Math.PI / 2);
  const ns = signTex(['NO SMOKING', 'Smokers: use the gaming terrace →'], { w: 1024, h: 256, bg: '#c7352b', color: '#fff', sizes: [100, 46] });
  signPlane(ns, 1.0, 0.25, 12.83, 2.85, -13, -Math.PI / 2);
  // machines: back row facing +z, island bank (both faces)
  const games = ['outback', 'dragon', 'sevens', 'reef'];
  let gi = 0;
  // lineup comes from the venue: back wall bank of 8, the island (front / rear faces) and the terrace
  VENUE.machines.back.forEach((id, i) => MACHINE_DEFS.push({ game: id, pos: V3(4.5 + i * 1.08, 0, -17.45), ry: 0, smoke: false }));
  VENUE.machines.front.forEach((id, i) => MACHINE_DEFS.push({ game: id, pos: V3(5.6 + i * 1.1, 0, -11.62), ry: 0, smoke: false }));
  VENUE.machines.rear.forEach((id, i) => MACHINE_DEFS.push({ game: id, pos: V3(5.6 + i * 1.1, 0, -12.38), ry: Math.PI, smoke: false }));
  addColBox(5.0, 8.2, -12.75, -11.25);
  SB.add(G.box, MAT.blackPlastic, 6.7, 1.0, -12, 0, 0, 0, 3.4, 2.0, 0.12);
  // jackpot LED board above island
  const jc = mkCanvas(1024, 256); dynamic.jpBoard = { c: jc, tex: canvasTex(jc, 1, 1) };
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: dynamic.jpBoard.tex, toneMapped: false })); p.material.color.setScalar(1.5); p.position.set(6.7, 3.0, -12 + 0.05 * s); p.rotation.y = s > 0 ? 0 : Math.PI; scene.add(p); dynamic.neon.push(p); }
  SB.add(G.box, MAT.blackPlastic, 6.7, 3.0, -12, 0, 0, 0, 3.3, 0.9, 0.08); addCylS(SB, MAT.chrome, 6.7, 3.7, -12, 0.02, 0.6, 6);
  // cash redemption terminal
  const cx = 12.55, cz = -6.2;
  SB.add(new RoundedBoxGeometry(0.75, 1.75, 0.65, 2, 0.06), MAT.blackPlastic, cx, 0.875, cz);
  const crt = signTex(['CASH', 'REDEMPTION', 'insert ticket'], { w: 256, h: 256, bg: ['#1a1a1a', '#2a6a2a'], color: ['#7dff9a', '#7dff9a', '#ccc'], sizes: [60, 40, 28] });
  const crs = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: crt, toneMapped: false })); crs.position.set(cx - 0.33, 1.3, cz); crs.rotation.y = -Math.PI / 2; scene.add(crs);
  addCol(cx, cz, 0.8, 0.7);
  addInteract({ id: 'crt', pos: V3(cx - 0.3, 1.2, cz), r: 1.8, label: () => Game.state.tickets.length ? `Redeem ${Game.state.tickets.length} ticket(s) — ${fmt$(Game.state.tickets.reduce((a, b) => a + b, 0))}` : 'Cash redemption (no tickets)', action: () => Game.redeem() });
  // stand spot + attendant post
  addSpot({ kind: 'stand', pos: V3(11.5, 0, -9.5), ry: -2.4, area: 'gaming' });
}

function buildTerrace() {
  // louvre roof slats
  for (let i = 0; i < 18; i++) SB.add(G.box, MAT.creamPaint, 16.3, 3.2, -17.7 + i * 0.55, 0, 0.6, 0, 6.6, 0.02, 0.22);
  for (const [x, z] of [[13.3, -8.3], [19.3, -8.3], [19.3, -17.7]]) addCylS(SB, MAT.creamPaint, x, 1.6, z, 0.06, 3.2, 8);
  SB.add(G.box, MAT.creamPaint, 16.3, 3.25, -8.3, 0, 0, 0, 6.6, 0.12, 0.12); SB.add(G.box, MAT.creamPaint, 19.3, 3.25, -13, 0, 0, 0, 0.12, 0.12, 9.6);
  // slatted screens
  for (let y = 0.1; y < 2.4; y += 0.16) { SB.add(G.box, MAT.darkWood, 19.45, y, -13, 0, 0, 0, 0.04, 0.1, 10); SB.add(G.box, MAT.darkWood, 16.3, y, -8.1, 0, 0, 0, 6.6, 0.1, 0.04); }
  // back wall with a gate through to the beer garden
  SB.add(uvBox(new THREE.BoxGeometry(2.6, 3.2, 0.25), 2.6, 3.2, .25, 1.2), MAT.brick, 14.3, 1.6, -18.05);
  SB.add(uvBox(new THREE.BoxGeometry(2.6, 3.2, 0.25), 2.6, 3.2, .25, 1.2), MAT.brick, 18.3, 1.6, -18.05);
  SB.add(uvBox(new THREE.BoxGeometry(1.4, 0.9, 0.25), 1.4, 0.9, .25, 1.2), MAT.brick, 16.3, 2.75, -18.05);
  // festoon lights strung across the terrace
  for (const zz of [-16.5, -13.5, -10.5]) {
    const a = V3(13.3, 3.0, zz), b = V3(19.3, 3.0, zz + 0.6), pts = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * 0.35, 0))); }
    SB.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.006, 4), MAT.iron);
    for (let k = 1; k < 10; k++) SB.add(G.sph, MAT.bulb, pts[k].x, pts[k].y - 0.05, pts[k].z, 0, 0, 0, 0.035, 0.045, 0.035);
  }
  // signage
  const ss = signTex(['GAMING TERRACE', 'Smoking permitted in this area'], { w: 1024, h: 256, bg: ['#1a3a1a', '#0e220e'], color: ['#e8c56a', '#ddd'], sizes: [96, 44], border: '#e8c56a', borderW: 6 });
  signPlane(ss, 1.6, 0.4, 16.3, 2.5, -17.9, 0);
  // machines along slatted wall facing -x
  for (let i = 0; i < 4; i++) MACHINE_DEFS.push({ game: VENUE.machines.terrace[i], pos: V3(19.0, 0, -16.9 + i * 1.1), ry: -Math.PI / 2, smoke: true });
  // mushroom heater
  const hx = 15.6, hz = -10.5;
  addCylS(SB, MAT.chrome, hx, 1.1, hz, 0.05, 2.2, 8); addCylS(SB, MAT.chrome, hx, 0.15, hz, 0.25, 0.3, 16);
  SB.add(new THREE.ConeGeometry(0.55, 0.25, 20, 1, true), MAT.chrome, hx, 2.35, hz);
  SB.add(G.cyl, MAT.ember, hx, 2.15, hz, 0, 0, 0, 0.12, 0.25, 0.12);
  addCol(hx, hz, 0.5, 0.5);
  // bench + milk crate + ashtray stands + bin
  SB.add(G.box, MAT.darkWood, 16.3, 0.45, -8.55, 0, 0, 0, 3.5, 0.06, 0.4); for (const dx of [-1.5, 1.5]) SB.add(G.box, MAT.iron, 16.3 + dx, 0.22, -8.55, 0, 0, 0, 0.06, 0.45, 0.4);
  addColBox(14.5, 18.1, -8.8, -8.3);
  addSpot({ kind: 'chair', pos: V3(15.6, 0, -8.6), ry: Math.PI, sitH: 0.48, area: 'terrace', smoke: true, group: 'tb' });
  addSpot({ kind: 'chair', pos: V3(17.0, 0, -8.6), ry: Math.PI, sitH: 0.48, area: 'terrace', smoke: true, group: 'tb' });
  SB.add(G.box, M({ color: 0x1a4aa8, roughness: 0.6 }), 14.2, 0.17, -17.4, 0.3, 0, 0, 0.36, 0.34, 0.36);
  for (const [ax, az] of [[14.0, -10.2], [17.6, -10.9]]) { addCylS(SB, MAT.chrome, ax, 0.5, az, 0.03, 1.0, 8); addCylS(SB, MAT.chrome, ax, 1.0, az, 0.16, 0.06, 16); }
  addSpot({ kind: 'stand', pos: V3(14.3, 0, -11.0), ry: 0.6, area: 'terrace', smoke: true });
  addSpot({ kind: 'stand', pos: V3(17.2, 0, -11.6), ry: -2.4, area: 'terrace', smoke: true });
  // out-front smoker spot (classic)
  addSpot({ kind: 'stand', pos: V3(-3.0, 0, 3.7), ry: 2.6, area: 'street', smoke: true });
  addSpot({ kind: 'stand', pos: V3(3.8, 0, 4.4), ry: -2.2, area: 'street', smoke: true });
}

// ---- TVs with animated content ----
function makeTV(x, y, z, ry, kind) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = ry; scene.add(group);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.76, 0.06), MAT.blackPlastic); group.add(body);
  const c = mkCanvas(320, 180), tex = canvasTex(c, 1, 1);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.7), new THREE.MeshBasicMaterial({ map: tex })); scr.material.color.setScalar(1.3); scr.position.z = 0.031; group.add(scr);
  const tv = { group, c, tex, kind, t: Math.random() * 100 };
  dynamic.tvs.push(tv); return tv;
}
function drawTV(tv, dt) {
  tv.t += dt; const x = tv.c.getContext('2d'), W = 320, H = 180, t = tv.t;
  if (tv.kind === 'racing' && Racing.races.length) { Racing.drawTV(x, W, H, t); }
  else if (tv.kind === 'racing') {
    const race = t % 40, prog = clamp(race / 32, 0, 1);
    x.fillStyle = '#4a8a3a'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#7fb8e8'; x.fillRect(0, 0, W, 40);
    x.fillStyle = '#c8a878'; x.fillRect(0, 70, W, 90);
    x.fillStyle = '#fff'; for (let i = 0; i < 12; i++) x.fillRect(((i * 40 - t * 120 * (prog < 1 ? 1 : 0)) % 480 + 480) % 480 - 80, 66, 3, 8);
    for (let h = 0; h < 8; h++) {
      const off = Math.sin(h * 7.3 + t * 0.3) * 18 + h * 4 * prog;
      const hx = 60 + off + (h === 3 ? prog * 40 : 0), hy = 82 + h * 9;
      x.fillStyle = ['#d22', '#22d', '#dd2', '#fff', '#2a2', '#f80', '#a2a', '#222'][h];
      x.fillRect(hx, hy - 4, 10, 4);
      x.fillStyle = '#3a2210'; x.fillRect(hx - 8, hy, 22, 7); const leg = Math.sin(t * 20 + h) * 3; x.fillRect(hx - 6 + leg, hy + 7, 2, 6); x.fillRect(hx + 10 - leg, hy + 7, 2, 6);
    }
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, H - 26, W, 26); x.fillStyle = '#fff'; x.font = 'bold 14px Inter, sans-serif';
    x.fillText(race > 32 ? 'RESULT: 4 - 7 - 1 - 2' : `R${(Math.floor(t / 40) % 8) + 1} FLEMINGTON 1200m   ${Math.floor(prog * 1200)}m`, 8, H - 9);
    x.fillStyle = '#1a7a3a'; x.fillRect(W - 60, 6, 54, 20); x.fillStyle = '#fff'; x.fillText('LIVE', W - 48, 21);
  } else {
    x.fillStyle = '#2f7a2a'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#2a722a' : '#338533'; x.fillRect(0, i * 24 + ((t * 10) % 24) - 24, W, 24); }
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); x.ellipse(160 + Math.sin(t * .2) * 60, 90, 100, 60, 0, 0, 7); x.stroke();
    for (let p = 0; p < 14; p++) { const px = 160 + Math.sin(t * 0.7 + p * 2.1) * 120, py = 90 + Math.cos(t * 0.5 + p * 1.3) * 60; x.fillStyle = p < 7 ? '#fff' : '#111'; x.fillRect(px, py, 5, 8); x.fillStyle = p < 7 ? '#1a3a8a' : '#c7352b'; x.fillRect(px, py + 8, 5, 4); }
    const bx = 160 + Math.sin(t * 1.3) * 110, by = 90 + Math.sin(t * 0.9) * 55; x.fillStyle = '#c8461a'; x.beginPath(); x.ellipse(bx, by, 4, 2.6, t, 0, 7); x.fill();
    x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(6, 6, 170, 22); x.fillStyle = '#fff'; x.font = 'bold 13px Inter, sans-serif';
    const q = Math.floor((t / 60) % 4) + 1, ha = 30 + Math.floor(t / 9) % 60, aw = 24 + Math.floor(t / 11) % 60;
    x.fillText(`MAGPIES ${Math.floor(ha / 6)}.${ha % 6} (${ha + Math.floor(ha / 6) * 0})  Q${q}`, 12, 21);
    x.fillText(`SWANS ${Math.floor(aw / 6)}.${aw % 6}`, 12, 44);
  }
  tv.tex.needsUpdate = true;
}

// =====================================================================
//  SKY, SUN, STARS, RAIN  + time of day
// =====================================================================
function buildSky() {
  skyObj = new Sky(); skyObj.scale.setScalar(900); scene.add(skyObj);
  const u = skyObj.material.uniforms; u.turbidity.value = 6; u.rayleigh.value = 2.2; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.82;
  sun = new THREE.DirectionalLight(0xffe2c0, 2.5);
  sun.castShadow = true; sun.shadow.mapSize.setScalar(settings.preset === 'ultra' ? 4096 : HIGH() ? 2048 : 1024);
  const sc = sun.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 160; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target); sun.target.position.set(0, 0, 4);
  hemi = new THREE.HemisphereLight(0xa8c0e0, 0x2a2018, 0.4); scene.add(hemi);
  // stars
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.02) v.y = Math.abs(v.y) + 0.02; v.multiplyScalar(420); sp.push(v.x, v.y, v.z); }
  // southern cross, roughly
  for (const [a, e] of [[2.2, .55], [2.32, .62], [2.26, .48], [2.15, .58], [2.28, .56]]) { const v = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(420); sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
  moon = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.0), fog: false, transparent: true, opacity: 0 }));
  moon.position.set(-170, 200, 320); moon.scale.setScalar(0.3); moon.lookAt(0, 0, 0); scene.add(moon);
  // rain streaks
  const rc = 5000, rg = new THREE.BufferGeometry(), rp = new Float32Array(rc * 6);
  for (let i = 0; i < rc; i++) { const x = rand(-30, 30), y = rand(0, 20), z = rand(-10, 30); rp.set([x, y, z, x + 0.02, y - 0.5, z], i * 6); }
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rainSys = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9aa8b8, transparent: true, opacity: 0.35 }));
  rainSys.visible = false; rainSys.frustumCulled = false; scene.add(rainSys);
}
let skyEnvRT = null, lastEnvHour = -99;
const lastShadowSun = new THREE.Vector3();
let lastEnvKey = '';
function setTimeOfDay(h, weather) {
  // Autumn in Oz: sunset ~17:50. elevation in degrees
  const dayLen = 11.2, rise = 6.6;
  const tday = (h - rise) / dayLen;
  const elev = tday >= -0.15 && tday <= 1.15 ? Math.sin(tday * Math.PI) * 46 : -30;
  const az = lerp(-80, 85, clamp(tday, 0, 1)) * Math.PI / 180;
  const phi = THREE.MathUtils.degToRad(90 - elev), theta = Math.PI / 2 + az * 0.6 + 1.2;
  const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyObj.material.uniforms.sunPosition.value.copy(sunPos);
  const rainy = weather === 'rain', cloudy = weather === 'cloudy' || rainy;
  skyObj.material.uniforms.turbidity.value = rainy ? 18 : cloudy ? 12 : 6;
  skyObj.material.uniforms.rayleigh.value = elev < 8 ? 3.2 : 2.0;
  const dayF = clamp((elev + 4) / 18, 0, 1), duskF = clamp(1 - Math.abs(elev - 2) / 10, 0, 1);
  const nightF = 1 - clamp((elev + 8) / 10, 0, 1);
  // sun / moon light
  if (elev > -2) {
    sun.position.copy(sunPos).multiplyScalar(80).add(sun.target.position);
    sun.color.setHSL(0.08 + 0.05 * dayF, 0.8 - 0.4 * dayF, 0.6 + 0.2 * dayF);
    sun.intensity = 3.2 * dayF * (cloudy ? 0.45 : 1) + 0.3 * duskF;
  } else {
    sun.position.set(-40, 70, 60).add(sun.target.position);
    sun.color.set(0x8aa0d8); sun.intensity = 0.35 * nightF * (cloudy ? 0.4 : 1);
  }
  hemi.intensity = 0.08 + 0.55 * dayF * (cloudy ? 0.8 : 1);
  hemi.color.setHSL(0.6, 0.4, 0.25 + 0.45 * dayF);
  hemi.groundColor.setHSL(0.08, 0.3, 0.06 + 0.15 * dayF);
  const fogC = new THREE.Color().setHSL(0.6 - duskF * 0.53, 0.3 + duskF * 0.25, 0.05 + 0.42 * dayF * (cloudy ? 0.75 : 1));
  if (nightF > 0.5) fogC.setHSL(0.62, 0.3, 0.035);
  scene.fog.color.copy(fogC); scene.fog.density = rainy ? 0.03 : lerp(0.016, 0.0045, dayF) + nightF * 0.004;
  stars.material.opacity = nightF * (cloudy ? 0.15 : 0.9);
  moon.material.opacity = nightF * (rainy ? 0.1 : 0.9);
  window.__dayF = dayF;
  const streetOn = elev < 6 ? 1 : 0;
  dynamic.streetBulbs.forEach(l => l.intensity = streetOn * 55);
  atmo.night = streetOn; atmo.nightF = nightF;
  window.__fogOut = { c: fogC.clone(), d: scene.fog.density };
  // re-render shadow maps only when the sun has visibly moved
  dynamic.winLit.forEach(l => l.intensity = streetOn * 3);
  MAT.sodium.color.setRGB(streetOn ? 5 : 0.4, streetOn ? 2.6 : 0.35, streetOn ? 0.9 : 0.3);
  AudioSys.amp.outdoorNight = nightF;
  rainSys.visible = rainy;
  AudioSys.amp.rain = rainy ? 1 : 0;
  MAT.asphalt.roughness = rainy ? 0.18 : 0.82; MAT.asphalt.color.setScalar(rainy ? 0.45 : 0.73);
  MAT.concrete.roughness = rainy ? 0.35 : 0.92;
  _v1.copy(sun.position).sub(sun.target.position).normalize();
  if (_v1.angleTo(lastShadowSun) > 0.012 || lastShadowSun.lengthSq() === 0) { lastShadowSun.copy(_v1); if (typeof shadowDirty !== 'undefined') shadowDirty = 1; }
  // refresh the sky reflection rarely, and only while indoors so the change is never seen popping
  const camIn = isInside(camera.position.x, camera.position.z);
  // real HDRI skies for reflections when we have them: night / dusk / day, swapped while you're indoors so it never pops
  if (ENVHDR.night && ENVHDR.sunset) {
    const key = nightF > 0.55 ? 'night' : dayF > 0.6 ? (ENVHDR.park ? 'park' : 'sunset') : (elev < 0 ? 'dusk' : 'dawn');
    if (key !== lastEnvKey && (camIn || lastEnvKey === '')) {
      lastEnvKey = key; const nm = key === 'dusk' ? 'sunset' : key;
      if (!ENVHDR['_p' + nm]) ENVHDR['_p' + nm] = pmrem.fromEquirectangular(ENVHDR[nm] || ENVHDR.sunset).texture;
      scene.environment = ENVHDR['_p' + nm]; scene.environmentIntensity = { night: 0.55, sunset: 0.6, dusk: 0.6, dawn: 0.6, park: 0.75 }[key] || 0.6;
    }
  } else
  if (lastEnvHour < -50 || (Math.abs(h - lastEnvHour) > 1.0 && camIn)) {
    lastEnvHour = h;
    const envScene = new THREE.Scene(); const s2 = new Sky(); s2.scale.setScalar(100); s2.material.uniforms.sunPosition.value.copy(sunPos);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) s2.material.uniforms[k].value = skyObj.material.uniforms[k].value;
    envScene.add(s2);
    if (skyEnvRT) skyEnvRT.dispose();
    skyEnvRT = pmrem.fromScene(envScene, 0, 0.1, 200);
    scene.environment = skyEnvRT.texture;
    scene.environmentIntensity = 0.5;
    s2.material.dispose(); s2.geometry.dispose();
  }
  return { elev, dayF, nightF };
}
function updateRain(dt, camPos) {
  if (!rainSys.visible) return;
  const p = rainSys.geometry.attributes.position, a = p.array;
  for (let i = 0; i < a.length; i += 6) {
    a[i + 1] -= 18 * dt; a[i + 4] -= 18 * dt;
    if (a[i + 4] < 0 || isInside(a[i], a[i + 2]) && a[i + 1] < PUB.ceil + 4.6 || (a[i + 2] > 1.8 && a[i + 2] < 9.6 && Math.abs(a[i]) < 13.2 && a[i + 1] < 7.9)) {
      const x = camPos.x + rand(-25, 25), z = camPos.z + rand(-20, 25), y = rand(10, 20);
      a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = x + 0.02; a[i + 4] = y - 0.5; a[i + 5] = z;
    }
  }
  p.needsUpdate = true;
}

// interior env-map capture (real reflections of the room on varnish, glass & cabinets)
function captureInteriorEnv() {
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.1, 100, cubeRT); cc.position.set(0, 1.8, -8); scene.add(cc);
  const wasMirror = backMirror.visible; backMirror.visible = false;
  cc.update(renderer, scene);
  backMirror.visible = wasMirror;
  const env = pmrem.fromCubemap(cubeRT.texture).texture;
  for (const m of interiorMats) { m.envMap = env; m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.6; m.needsUpdate = true; }
  cubeRT.dispose(); scene.remove(cc);
  return env;
}

// =====================================================================
//  ATMOSPHERE: shadowed spots, light shafts, dust, neon, spill, moths
// =====================================================================
const atmo = { pendants: [], streetHeads: [], verandahLamps: [], streetCones: [], cones: [], dust: null, moths: null, spill: [], flicker: null, neonFlicker: null, night: 1, nightF: 1, halosOut: [] };
const spots = [];
function spotShadow(col, inten, x, y, z, angle) {
  const l = new THREE.SpotLight(col, inten, 15, angle, 0.85, 2);
  l.position.set(x, y, z); l.target.position.set(x, 0, z); scene.add(l); scene.add(l.target);
  l.castShadow = true; l.shadow.mapSize.set(HIGH() ? 1024 : 512, HIGH() ? 1024 : 512); l.shadow.bias = -0.0006; l.shadow.normalBias = 0.02; l.shadow.radius = 4;
  spots.push(l); return l;
}
function coneMaterial(col, str) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(col) }, uStr: { value: str } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vD; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); vD=length(mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uStr; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.8); float fall = pow(vUv.y, 1.6); float near = smoothstep(0.35, 1.8, vD);
        gl_FragColor = vec4(uCol * edge * fall * near * uStr, 1.0); }`
  });
}
function lightCone(x, yTop, z, rTop, rBot, col, str, seg = 24, sx = 1, sz = 1, ry = 0) {
  const h = yTop, m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, true), coneMaterial(col, str));
  m.position.set(x, yTop / 2, z); m.scale.set(sx, 1, sz); m.rotation.y = ry; m.renderOrder = 6; scene.add(m); atmo.cones.push(m); return m;
}
function haloSprite(p, scale, col, str = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(col).multiplyScalar(str), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.position.copy(p); s.scale.setScalar(scale); s.renderOrder = 7; scene.add(s); return s;
}
function neonSign(lines, x, y, z, ry, w, h, col, glow, font = 'Bungee, Impact, sans-serif', sizes) {
  const t = signTex(lines, { w: 1024, h: Math.round(1024 * h / w), color: col, glow, glowB: 36, font, sizes, stroke: 'rgba(255,255,255,.55)', strokeW: 2 });
  const p = signPlane(t, w, h, x, y, z, ry, { transparent: true, toneMapped: false, intensity: 2.1 });
  // dark backing board + soft wall wash
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, h * 2.2), new THREE.MeshBasicMaterial({ map: TEX.glow, color: new THREE.Color(glow).multiplyScalar(0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  wash.position.copy(p.position).add(new THREE.Vector3(0, 0, -0.005).applyAxisAngle(V3(0, 1, 0), ry)); wash.rotation.y = ry; scene.add(wash);
  dynamic.neon.push(p); return p;
}
function poster(lines, colors, bg, x, y, z, ry, accent) {
  const c = mkCanvas(320, 440), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 320, 440);
  if (accent === 'sun') { g.save(); g.translate(160, 300); for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.fillStyle = i % 2 ? '#f6b23a' : '#e8772a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(400, -40); g.lineTo(400, 40); g.closePath(); g.fill(); } g.restore(); g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(160, 300, 70, 0, 7); g.fill(); }
  if (accent === 'checks') { for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) if ((i + j) % 2) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(j * 54, 220 + i * 28, 54, 28); } }
  if (accent === 'stripes') { for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'; g.fillRect(0, i * 50, 320, 25); } }
  g.textAlign = 'center';
  lines.forEach((l, i) => { g.font = `${i === 0 ? 64 : 30}px 'Bebas Neue', Impact, sans-serif`; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; const yy = 90 + i * (i === 0 ? 0 : 52) + (i > 0 ? 40 : 0); g.strokeText(l, 160, yy); g.fillStyle = colors[i % colors.length]; g.fillText(l, 160, yy); });
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,240,210'},${Math.random() * 0.07})`; g.fillRect(Math.random() * 320, Math.random() * 440, 2, 2); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const n = V3(Math.sin(ry), 0, Math.cos(ry));
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.85), M({ map: tex, roughness: 0.35 })); pm.position.set(x + n.x * 0.025, y, z + n.z * 0.025); pm.rotation.y = ry; scene.add(pm);
  SB.add(G.box, MAT.darkWood, x, y, z, ry, 0, 0, 0.7, 0.93, 0.03);
}
function pennants(a, b, sag) {
  const cols = [0x111111, 0xf2f2ee, 0x1a3a8a, 0xc7352b, 0xe8c52a, 0x6a1a2a].map(c => M({ color: c, roughness: 0.9, side: THREE.DoubleSide }));
  const pts = [], n = Math.round(a.distanceTo(b) / 0.32);
  for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * sag, 0))); }
  SB.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.004, 4), MAT.iron);
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.11, 0, 0, 0.11, 0, 0, 0, -0.24, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, .5, 0], 2)); tri.computeVertexNormals();
  const ry = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
  for (let i = 1; i < n; i++) { const t = i / n, p = new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * sag, 0)); SB.add(tri, cols[i % cols.length], p.x, p.y, p.z, ry, rand(-0.08, 0.08)); }
}
function spillTex() {
  const c = mkCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const side = g.createLinearGradient(0, 0, 128, 0); side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.18, 'rgba(0,0,0,0)'); side.addColorStop(0.82, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = side; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
// fake ambient occlusion: soft dark gradients where walls meet floor and ceiling
function aoStrip(x1, z1, x2, z2, nx, nz, h = 0.5, ceiling = false) {
  const len = Math.hypot(x2 - x1, z2 - z1), cx = (x1 + x2) / 2 + nx * 0.012, cz = (z1 + z2) / 2 + nz * 0.012;
  const ry = Math.atan2(nx, nz);
  if (!ceiling) SB.add(G.plane, MAT.ao, cx, h / 2 + 0.002, cz, ry, 0, 0, len, h, 1);
  else SB.add(G.plane, MAT.ao, cx, PUB.ceil - h / 2 - 0.002, cz, ry, 0, Math.PI, len, h, 1);
}
function buildAO() {
  const segs = [ // [x1,z1,x2,z2, normal x, normal z]
    [-12.84, -17.8, -12.84, 1.8, 1, 0], [12.84, -17.8, 12.84, 1.8, -1, 0], [-12.9, -17.84, 12.9, -17.84, 0, 1],
    [-12.9, 1.84, -10.5, 1.84, 0, -1], [-4.5, 1.84, -1.3, 1.84, 0, -1], [1.3, 1.84, 4.5, 1.84, 0, -1], [10.5, 1.84, 12.9, 1.84, 0, -1],
    [2.9, -17.8, 2.9, -11, -1, 0], [2.9, -9, 2.9, -4.1, -1, 0], [3.1, -17.8, 3.1, -11, 1, 0], [3.1, -9, 3.1, -4.1, 1, 0],
    [3.1, -4.1, 6.5, -4.1, 0, -1], [8.5, -4.1, 12.9, -4.1, 0, -1], [3.1, -3.9, 6.5, -3.9, 0, 1], [8.5, -3.9, 12.9, -3.9, 0, 1],
  ];
  for (const [x1, z1, x2, z2, nx, nz] of segs) { aoStrip(x1, z1, x2, z2, nx, nz, 0.5); aoStrip(x1, z1, x2, z2, nx, nz, 0.4, true); }
  aoStrip(BAR.front, BAR.z0, BAR.front, BAR.z1, 1, 0, 0.35); // foot of the bar
}
function buildAtmosphere() {
  buildAO();
  // light shafts under pendants, pool lamp, gaming rows
  for (const p of atmo.pendants) lightCone(p.x, p.y, p.z, 0.13, 1.05, 0xffc890, 0.055);
  lightCone(-3, 2.35, -13.2, 0.42, 1.0, 0xfff0d0, 0.05, 4, 0.75, 1.9, Math.PI / 4);
  lightCone(7.1, 3.9, -16.2, 0.5, 1.6, 0xc890ff, 0.035, 24, 2.2, 0.8);
  lightCone(6.7, 3.9, -12, 0.4, 1.4, 0xff90c8, 0.03, 24, 1.8, 0.9);
  for (const p of atmo.pendants) haloSprite(p.clone().add(V3(0, -0.03, 0)), 0.5, 0xffc890, 0.6);
  // streetlights: sodium shafts + halos + moths
  for (const h of atmo.streetHeads) { atmo.streetCones.push(lightCone(h.x, h.y - 0.1, h.z, 0.22, 3.4, 0xff9a3c, 0.04, 20)); atmo.halosOut.push(haloSprite(h.clone().add(V3(0, -0.1, 0)), 2.2, 0xffa050, 1)); }
  for (const h of atmo.verandahLamps) atmo.halosOut.push(haloSprite(h, 1.1, 0xffc27a, 0.9));
  // dust motes floating in the warm air
  const dn = 700, dg = new THREE.BufferGeometry(), dp = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) { dp[i * 3] = rand(-12.5, 12.5); dp[i * 3 + 1] = rand(0.4, 3.8); dp[i * 3 + 2] = rand(-17.5, 1.5); }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  atmo.dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.011, map: TEX.dot, color: 0xffd6a0, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  atmo.dust.frustumCulled = false; atmo.dustBase = dp.slice(); scene.add(atmo.dust);
  const mn = 40, mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mn * 3), 3));
  atmo.moths = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.035, map: TEX.dot, color: 0xffe0b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  atmo.moths.frustumCulled = false; atmo.mothSeed = Array.from({ length: mn }, () => [Math.random() * 10, rand(0.3, 0.9), rand(1.5, 3.5), Math.floor(Math.random() * 6)]); scene.add(atmo.moths);
  // warm window light pooling on the footpath
  const st = spillTex();
  for (const [cx, w] of [[-7.5, 6.6], [0, 3.0], [7.5, 6.6]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.4), new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(1.0, 0.62, 0.3), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.014, 3.7); scene.add(m); atmo.spill.push(m);
  }
  // dead shop with a flickering fluoro tube
  const fl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.0) }));
  fl.position.set(-33.5, 2.55, 2.12); scene.add(fl); atmo.flicker = fl;
  atmo.flickerGlow = haloSprite(V3(-33.5, 2.4, 2.3), 2.0, 0xa8d8ff, 0.5);
  // neon on the walls
  neonSign(['COLD BEER'], -9.0, 1.72, 1.83, 0, 1.5, 0.4, '#ff5a6a', '#ff1030');
  neonSign(['SOUTHERLY', 'BITTER'], -8.7, 2.95, -17.83, 0, 1.2, 0.5, ['#7dff9a', '#ffffff'], '#18ff60', 'Bungee, Impact', [150, 110]);
  neonSign(['BISTRO'], 11.1, 3.0, -3.88, 0, 1.2, 0.35, '#ffcf5a', '#ff9a10', 'Rye, serif');
  neonSign(['TAB'], 2.87, 3.05, -11.3, -Math.PI / 2, 0.75, 0.38, '#5aff8a', '#10c040');
  atmo.neonFlicker = neonSign(['JACKPOTS'], 5.2, 3.3, -17.82, 0, 1.4, 0.34, '#ff7ad8', '#ff10a0');
  // posters + pennants
  poster(['GOLDEN', 'LAGER', 'brewed under the southern sun'], ['#7a1f14', '#7a1f14', '#2a1d10'], '#f3d27a', -9.2, 2.0, -17.84, 0, 'sun');
  poster(['MEAT', 'RAFFLE', 'EVERY SATURDAY · 5PM', '3 TICKETS $5'], ['#fff', '#fff', '#ffe27a', '#fff'], '#9b2216', 12.84, 2.25, 0.9, -Math.PI / 2, 'checks');
  poster(['TRIVIA', 'WEDNESDAYS', '8:30PM · $50 BAR TAB'], ['#ffe27a', '#fff', '#fff'], '#1a3a6a', 4.7, 2.25, -3.88, 0, 'stripes');
  poster(['PARMA', '& POT', 'TUESDAYS · $15'], ['#fff6d8', '#fff6d8', '#ffe27a'], '#3a5a1a', 9.4, 2.25, -3.88, 0, 'stripes');
  poster(['LARRIKIN', 'PALE ALE', 'a beer with a grin'], ['#2a1d10', '#b5541b', '#2a1d10'], '#efe2c4', 3.12, 2.15, -6.6, Math.PI / 2, 'sun');
  pennants(V3(-12.8, 3.85, -9.5), V3(2.8, 3.85, -9.5), 0.45);
  pennants(V3(-8.2, 3.8, -14.3), V3(-8.2, 3.8, -2.7), 0.35);
}
function updateAtmosphere(dt, t, camPos, inside) {
  // dust drifts slowly, only simulated when you can see it
  if (inside && atmo.dust && settings.shafts) {
    const a = atmo.dust.geometry.attributes.position, b = atmo.dustBase;
    for (let i = 0; i < a.count; i++) { const k = i * 3; a.array[k] = b[k] + Math.sin(t * 0.13 + i) * 0.25; a.array[k + 1] = b[k + 1] + Math.sin(t * 0.09 + i * 1.7) * 0.18; a.array[k + 2] = b[k + 2] + Math.cos(t * 0.11 + i * 0.6) * 0.25; }
    a.needsUpdate = true;
  }
  if (atmo.dust) atmo.dust.visible = inside && settings.shafts;
  for (const c of atmo.cones) if (!atmo.streetCones.includes(c)) c.visible = settings.shafts;
  const night = atmo.night;
  if (atmo.moths) {
    atmo.moths.visible = night > 0.5 && !inside;
    if (atmo.moths.visible) {
      const lamps = atmo.streetHeads.concat(atmo.verandahLamps), a = atmo.moths.geometry.attributes.position;
      atmo.mothSeed.forEach((m, i) => { const c = lamps[m[3] % lamps.length], tt = t * m[2] + m[0]; a.setXYZ(i, c.x + Math.cos(tt) * m[1] + Math.sin(tt * 3.7) * 0.08, c.y - 0.2 + Math.sin(tt * 1.3) * m[1] * 0.6, c.z + Math.sin(tt) * m[1]); });
      a.needsUpdate = true;
    }
  }
  for (const c of atmo.streetCones) c.visible = night > 0.5 && settings.shafts;
  for (const h of atmo.halosOut) h.visible = night > 0.5;
  for (const sp of atmo.spill) sp.material.opacity = 0.08 + 0.3 * atmo.nightF;
  if (atmo.flickerGlow) atmo.flickerGlow.visible = night > 0.5;
}

// =====================================================================
//  BAR CLUTTER: glasses, mats, towels, tips, snacks, wine rack, bell
// =====================================================================
function buildBarClutter() {
  const F = BAR.front;
  const glassL = new THREE.LatheGeometry([V3(0, 0), V3(0.032, 0), V3(0.032, 0.006), V3(0.041, 0.15), V3(0.039, 0.15)], 14);
  const potL = new THREE.LatheGeometry([V3(0, 0), V3(0.029, 0), V3(0.029, 0.006), V3(0.037, 0.118), V3(0.035, 0.118)], 14);
  const wineL = new THREE.LatheGeometry([V3(0, 0), V3(0.034, 0), V3(0.034, 0.004), V3(0.004, 0.008), V3(0.004, 0.085), V3(0.022, 0.097), V3(0.038, 0.128), V3(0.035, 0.168), V3(0.033, 0.172)], 14);
  const decoGlass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  interiorMats.push(decoGlass);
  const beer = M({ color: 0xc8780e, roughness: 0.2, transparent: true, opacity: 0.88, emissive: 0x3a1a00 });
  const foam = M({ color: 0xf2e8d2, roughness: 0.9 });
  const matCols = [0x9b2216, 0x1a3a8a, 0x1f6b2a, 0xe8c52a, 0x222222].map(c => M({ color: c, roughness: 0.95 }));
  const glassAt = (x, y, z, fill, pot = false, mat = true) => {
    const G2 = pot ? potL : glassL, h = pot ? 0.118 : 0.15, rb = pot ? 0.029 : 0.032, rt = pot ? 0.037 : 0.041;
    if (mat) SB.add(G.cyl, choice(matCols), x, y + 0.0015, z, 0, 0, 0, 0.048, 0.003, 0.048);
    SB.add(G2, decoGlass, x, y + 0.003, z);
    if (fill > 0.05) { const fh = h * fill * 0.95, r = lerp(rb, rt, fill * 0.5) * 0.92; SB.add(G.cyl, beer, x, y + 0.009 + fh / 2, z, 0, 0, 0, r, fh, r); SB.add(G.cyl, foam, x, y + 0.009 + fh + 0.006, z, 0, 0, 0, lerp(rb, rt, fill) * 0.93, 0.012, lerp(rb, rt, fill) * 0.93); }
    else SB.add(G.cyl, foam, x, y + 0.012, z, 0, 0, 0, rb * 0.9, 0.004, rb * 0.9);
  };
  // half-finished drinks along the customer side of the bar
  [-13.6, -12.55, -10.45, -9.4, -7.3, -5.2, -4.15].forEach(z => glassAt(F - 0.13 + rand(-0.03, 0.03), 1.119, z + rand(-0.15, 0.15), choice([0, 0.2, 0.45, 0.7]), Math.random() < 0.4));
  // inverted glasses drying on a rubber mat by the till
  SB.add(G.box, MAT.rubber, F - 0.45, 1.114, -3.8, 0, 0, 0, 0.3, 0.008, 0.62);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) SB.add(glassL, decoGlass, F - 0.55 + r * 0.09, 1.268, -4.05 + k * 0.095, 0, Math.PI, 0);
  // tip jar with coins, lemon & lime tray, form guide, bar towel
  const tip = new THREE.LatheGeometry([V3(0, 0), V3(0.06, 0), V3(0.06, 0.16), V3(0.055, 0.17)], 16);
  SB.add(tip, decoGlass, F - 0.22, 1.112, -9.55);
  for (let i = 0; i < 18; i++) SB.add(G.cyl8, i % 3 ? MAT.brass : MAT.chrome, F - 0.22 + rand(-0.04, 0.04), 1.118 + i * 0.0035, -9.55 + rand(-0.04, 0.04), rand(0, 3), rand(-0.3, 0.3), 0, 0.012, 0.002, 0.012);
  const tipSign = signTex(['TIPS'], { w: 128, h: 64, bg: '#f4ead6', color: '#7a1f14', size: 44 });
  signPlane(tipSign, 0.07, 0.035, F - 0.159, 1.2, -9.55, Math.PI / 2);
  SB.add(G.box, MAT.blackPlastic, F - 0.45, 1.135, -8.4, 0, 0, 0, 0.12, 0.04, 0.3);
  for (let i = 0; i < 8; i++) SB.add(G.cyl, M({ color: i % 2 ? 0xe8d83a : 0x6ab83a, roughness: 0.6 }), F - 0.45 + rand(-0.03, 0.03), 1.16, -8.5 + i * 0.03, 0, Math.PI / 2, rand(-0.5, 0.5), 0.018, 0.006, 0.018);
  const fg = mkCanvas(256, 360), fx = fg.getContext('2d'); fx.fillStyle = '#ede6d4'; fx.fillRect(0, 0, 256, 360); fx.fillStyle = '#1a1a1a'; fx.font = 'bold 34px "Bebas Neue", Impact'; fx.fillText('FORM GUIDE', 18, 44); fx.font = '13px Georgia, serif';
  for (let i = 0; i < 18; i++) { fx.fillStyle = '#333'; fx.fillText(`${i + 1}. ${choice(['Southern Belle', 'Larrikin Lad', 'Red Dust', 'Bush Telegraph', 'Mate\'s Rates', 'Last Drinks', 'Blue Heeler', 'Stubby Holder'])}  ${randi(2, 30)}/1`, 18, 72 + i * 16); }
  const fgm = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(fg), roughness: 0.9 })); fgm.material.map.colorSpace = THREE.SRGBColorSpace;
  fgm.rotation.set(-Math.PI / 2, 0, 0.25); fgm.position.set(F - 0.2, 1.121, -11.0); scene.add(fgm);
  SB.add(G.box, M({ color: 0xe8e2d0, roughness: 1 }), F + 0.02, 1.0, -12.05, 0, 0, 0, 0.05, 0.22, 0.3);
  SB.add(G.box, M({ color: 0x9b2216, roughness: 1 }), F + 0.025, 0.93, -12.05, 0, 0, 0, 0.05, 0.03, 0.3);
  // overhead rack of hanging wine glasses above the counter
  SB.add(G.box, MAT.darkWood, -9.25, 2.6, -7.5, 0, 0, 0, 0.42, 0.07, 5.6);
  for (const dz of [-10.25, -4.75]) SB.add(G.box, MAT.brass, -9.25, 3.3, dz, 0, 0, 0, 0.02, 1.36, 0.02);
  for (const rx of [-9.37, -9.13]) for (let z = -10.1; z < -4.9; z += 0.17) SB.add(wineL, decoGlass, rx, 2.565, z + (rx > -9.2 ? 0.085 : 0), 0, Math.PI, 0);
  // brass last-drinks bell at the end of the bar
  SB.add(G.box, MAT.brass, -8.55, 2.32, -2.6, 0, 0, 0, 0.3, 0.025, 0.025);
  SB.add(new THREE.LatheGeometry([V3(0, 0), V3(0.085, 0), V3(0.075, 0.03), V3(0.05, 0.11), V3(0.02, 0.135), V3(0, 0.14)], 18), MAT.brass, -8.42, 2.12, -2.6);
  SB.add(G.cyl8, M({ color: 0xc8b08a, roughness: 1 }), -8.42, 1.92, -2.6, 0, 0, 0, 0.006, 0.3, 0.006);
  // RSA notice + snack clip strip on the back bar
  signPlane(signTex(['WE PRACTISE THE RESPONSIBLE', 'SERVICE OF ALCOHOL', 'Intoxicated persons will not be served · No ID, no service'], { w: 768, h: 256, bg: '#f4f0e6', color: ['#111', '#111', '#555'], sizes: [46, 46, 26], border: '#1f4d34', borderW: 8 }), 0.6, 0.2, -12.82, 1.22, -10.0, Math.PI / 2);
  SB.add(G.box, MAT.chrome, -12.86, 1.85, -11.3, 0, 0, 0, 0.01, 0.7, 0.03);
  [0xd02020, 0x2050d0, 0xe0c020, 0x20a040, 0xe07020].forEach((c, i) => SB.add(new RoundedBoxGeometry(0.03, 0.17, 0.12, 2, 0.012), M({ color: c, roughness: 0.25, metalness: 0.4 }), -12.83, 2.12 - i * 0.12, -11.3 + (i % 2 ? 0.02 : -0.02), 0, 0, (i % 2 ? 0.08 : -0.08)));
  // high tables: drinks, mats, peanuts
  for (const tz of [-10.5, -6.5, -2.5]) {
    glassAt(-5.4 + rand(-0.15, 0.15), 1.077, tz + 0.12, choice([0.25, 0.6, 0.85]));
    if (Math.random() < 0.7) glassAt(-5.4 + rand(-0.15, 0.15), 1.077, tz - 0.14, choice([0, 0.4]), true);
    SB.add(G.cyl, MAT.darkWood, -5.25, 1.095, tz, 0, 0, 0, 0.06, 0.035, 0.06);
    for (let i = 0; i < 10; i++) SB.add(G.sph, M({ color: 0xb8823a, roughness: 0.8 }), -5.25 + rand(-0.035, 0.035), 1.115, tz + rand(-0.035, 0.035), 0, 0, 0, 0.012, 0.009, 0.009);
  }
  // lounge tables: rolled cutlery, sauce bottles, a menu card
  for (const [tx, tz] of [[5.5, -1.7], [9.4, -1.7], [5.5, 0.6], [9.4, 0.6]]) {
    for (const dx of [-0.35, 0.35]) SB.add(G.cyl8, MAT.white, tx + dx, 0.795, tz + 0.2, 0, Math.PI / 2, 0, 0.014, 0.2, 0.014);
    SB.add(G.cyl8, M({ color: 0xb01a10, roughness: 0.4 }), tx + 0.02, 0.84, tz - 0.25, 0, 0, 0, 0.022, 0.11, 0.022);
    SB.add(G.cyl8, M({ color: 0x4a2a10, roughness: 0.4 }), tx + 0.08, 0.84, tz - 0.25, 0, 0, 0, 0.022, 0.11, 0.022);
    SB.add(G.box, M({ color: 0xf4ead6, roughness: 0.9 }), tx - 0.15, 0.85, tz - 0.25, 0, 0.2, 0, 0.1, 0.13, 0.004);
    if (Math.random() < 0.6) glassAt(tx + rand(-0.3, 0.3), 0.785, tz + rand(-0.1, 0.1), choice([0.3, 0.7]), Math.random() < 0.5);
  }
  // kegs stacked in the terrace corner
  for (const [kx, kz, ky] of [[18.9, -9.0, 0.3], [18.9, -9.48, 0.3], [18.9, -9.24, 0.9]]) { SB.add(G.cyl, MAT.chrome, kx, ky, kz, 0, 0, 0, 0.21, 0.6, 0.21); for (const dy of [-0.2, 0.2]) SB.add(G.torus, MAT.chrome, kx, ky + dy, kz, 0, Math.PI / 2, 0, 0.215, 0.215, 0.215); }
  addColBox(18.6, 19.3, -9.8, -8.7);
}

// ---- src/04-pokie-math.js ----
// =====================================================================
//  POKIE MATHS ENGINE  (pure logic — no rendering)
// =====================================================================
const BETS = [0.5, 1, 2, 3, 5, 7.5, 10];
const LINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],
  [2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,0,2,0],
  [2,0,2,0,2],[1,0,2,0,1],[1,2,0,2,1],[0,2,2,2,0],[2,0,0,0,2]];
let rtpMod = 1; // difficulty modifier
const JP_NAMES = ['MINI', 'MINOR', 'MAJOR', 'GRAND'];
const JP_SEED = { MINI: 15, MINOR: 75, MAJOR: 750, GRAND: 7500 };
const JP_INC = { MINI: 0.004, MINOR: 0.003, MAJOR: 0.002, GRAND: 0.001 }; // fraction of each bet

function wpick(items, weights) {
  let t = 0; for (const w of weights) t += w;
  let r = Math.random() * t;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function jpScaleFor(bet) { return 1; }
// jackpot pools are quoted for a $2 bet; the award scales with the bet played
function jpFactor(bet) { return Math.max(0.25, Math.min(2.5, bet / 2)); }

const ROYAL_PAYS = { '9': [0,0,0,4,10,40], '10': [0,0,0,4,10,40], 'J': [0,0,0,5,15,50], 'Q': [0,0,0,5,15,60], 'K': [0,0,0,8,20,80], 'A': [0,0,0,8,25,100] };

const GAMES = {
  outback: {
    id: 'outback', name: 'OUTBACK GOLD', sub: 'LINK', feature: 'holdspin', payScale: 5.5,
    theme: { bg1: '#3a0d05', bg2: '#b5410f', frame: '#f6c445', accent: '#ff7a18', glow: '#ffd36b', text: '#fff3cf' },
    tag: '6 OR MORE GOLD NUGGETS TRIGGER HOLD & SPIN',
    syms: ['9','10','J','Q','K','A','BOOM','KOALA','ULURU','ROO','WILD','COIN'],
    pays: Object.assign({}, ROYAL_PAYS, { BOOM: [0,0,0,12,40,150], KOALA: [0,0,0,15,50,200], ULURU: [0,0,0,20,75,300], ROO: [0,0,0,30,120,600], WILD: [0,0,0,30,120,800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, BOOM: 6, KOALA: 5, ULURU: 4.5, ROO: 3.5, WILD: 2.2, COIN: 11.3 },
    noWild: [0], wild: 'WILD', bonusSym: 'COIN'
  },
  dragon: {
    id: 'dragon', name: 'DRAGON PEARL', sub: 'FORTUNE', feature: 'freegames', payScale: 3.6,
    theme: { bg1: '#2a0208', bg2: '#9c0f1d', frame: '#f2c14e', accent: '#ff3045', glow: '#ffdf7e', text: '#fff1d6' },
    tag: '3 GOLD COINS = FREE GAMES · WILD MULTIPLIERS x2 x3 x5',
    syms: ['9','10','J','Q','K','A','LANTERN','ENVELOPE','KOI','INGOT','WILD','SCAT'],
    pays: Object.assign({}, ROYAL_PAYS, { LANTERN: [0,0,0,12,40,150], ENVELOPE: [0,0,0,15,50,200], KOI: [0,0,0,20,80,300], INGOT: [0,0,0,30,120,500], WILD: [0,0,0,30,120,750] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, LANTERN: 6, ENVELOPE: 5, KOI: 4.5, INGOT: 3.5, WILD: 2.4, SCAT: 2.2 },
    free: { WILD: 6 },
    noWild: [0], wild: 'WILD', scatter: 'SCAT', mystery: 1 / 650
  },
  sevens: {
    id: 'sevens', name: 'LUCKY 7s', sub: 'WHEEL', feature: 'wheel', payScale: 1,
    theme: { bg1: '#06103a', bg2: '#1b3fb8', frame: '#e8e8f8', accent: '#ff2b5a', glow: '#8fd3ff', text: '#ffffff' },
    tag: '3 BONUS WHEELS ON REELS 1, 3 & 5 SPIN THE JACKPOT WHEEL',
    syms: ['CHERRY','BELL','BAR','DIAMOND','SEVENB','SEVENR','WILD','BONUS'],
    pays: { CHERRY: [0,0,0,4,10,40], BELL: [0,0,0,6,15,60], BAR: [0,0,0,8,25,100], DIAMOND: [0,0,0,12,40,160], SEVENB: [0,0,0,20,80,300], SEVENR: [0,0,0,40,150,1000], WILD: [0,0,0,40,150,1000] },
    base: { CHERRY: 22, BELL: 18, BAR: 15, DIAMOND: 9, SEVENB: 6, SEVENR: 3.8, WILD: 2.3, BONUS: 4.9 },
    noWild: [0], wild: 'WILD', bonusSym: 'BONUS', bonusReels: [0, 2, 4]
  },
  reef: {
    id: 'reef', name: 'REEF RICHES', sub: 'TREASURE', feature: 'pick', payScale: 3.8,
    theme: { bg1: '#011f2e', bg2: '#05829a', frame: '#7ff3e4', accent: '#ffcf3d', glow: '#9ffcff', text: '#e9ffff' },
    tag: '3 TREASURE CHESTS = JACKPOT PICK · MATCH 3 TO WIN',
    syms: ['9','10','J','Q','K','A','SHELL','STAR','FISH','TURTLE','WILD','CHEST'],
    pays: Object.assign({}, ROYAL_PAYS, { SHELL: [0,0,0,12,40,150], STAR: [0,0,0,15,50,200], FISH: [0,0,0,20,80,300], TURTLE: [0,0,0,30,120,500], WILD: [0,0,0,30,120,750] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, SHELL: 6, STAR: 5, FISH: 4.5, TURTLE: 3.5, WILD: 2.4, CHEST: 1.9 },
    noWild: [0], wild: 'WILD', scatter: 'CHEST'
  }
};

// ---- LICENSED SKIN GAMES: the supplied machine screens, played with this engine --------------------
// Each one is a hold & spin "link" game (6+ fireballs start it, 3 respins, fill all 15 for the Grand). The art, symbols and layout come
// from assets/slots (see tools/slots/extract.py); the sym names here must match the keys in each skin's sprite atlas.
const ROYAL_W = { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9 };
const THEMED_W = [6, 5, 4.5, 3.5, 3, 2.6], THEMED_P = [[12, 40, 150], [15, 50, 200], [20, 75, 300], [30, 120, 600], [40, 150, 800], [50, 200, 1000]];
function skinGame(id, name, sub, royals, themed, theme, extra = {}) {
  const base = {}, pays = Object.assign({}, ROYAL_PAYS);
  royals.forEach(r => base[r] = ROYAL_W[r]);
  themed.forEach((t, i) => { base[t] = THEMED_W[i]; pays[t] = [0, 0, 0, ...THEMED_P[i]]; });
  const T = Object.values(base).reduce((a, b) => a + b, 0);   // fireballs and wilds keep the same share of the reel whatever the symbol count, so every game triggers hold & spin about as often
  base.WILD = 0.0289 * T; base.COIN = 0.1481 * T; pays.WILD = [0, 0, 0, 30, 120, 800];
  GAMES[id] = Object.assign({ id, name, sub, skin: true, feature: 'holdspin', link: true, payScale: 3.67, theme, tag: '6 OR MORE FIREBALLS START HOLD & SPIN · FILL ALL 15 FOR THE GRAND',
    syms: [...royals, ...themed, 'WILD', 'COIN'], pays, base, noWild: [0], wild: 'WILD', bonusSym: 'COIN' }, extra);
}
const TH_DL = { bg1: '#2a0408', bg2: '#8a1a10', frame: '#f6c445', accent: '#ff3a1a', glow: '#ffd36b', text: '#fff3cf' };
skinGame('am', 'AUTUMN MOON', 'DRAGON LINK', ['9', '10', 'J', 'Q', 'K'], ['PIPA', 'MOONCAKE', 'RABBIT', 'LADY'], Object.assign({}, TH_DL, { bg2: '#3a2a8a', led: [0.4, 0.5, 1] }));
skinGame('pm', 'PANDA MAGIC', 'DRAGON LINK', ['9', '10', 'J', 'K'], ['LOTUS', 'JUNK', 'LANTERN'], Object.assign({}, TH_DL, { bg2: '#2a8a2a', led: [1, 0.2, 0.2] }), { payScale: 2.42 });
skinGame('gc', 'GOLDEN CENTURY', 'DRAGON LINK', ['9', '10', 'J', 'Q', 'K'], ['WALL', 'SUN', 'CROWN', 'EMPEROR'], Object.assign({}, TH_DL, { bg2: '#d8780a', led: [1, 0.6, 0.1] }));
skinGame('hp', 'HAPPY & PROSPEROUS', 'DRAGON LINK', ['9', '10', 'J', 'Q', 'K'], ['LOTUS', 'JUNK', 'LANTERN', 'INGOT'], Object.assign({}, TH_DL, { led: [1, 0.35, 0.1] }));
skinGame('fm', 'FIRE MOUNTAIN', 'KONAMI', ['J', 'Q', 'K', 'A'], ['FAN', 'GOURD', 'CHEST', 'MALLET', 'INGOT', 'BULL'], { bg1: '#3a0505', bg2: '#d8301a', frame: '#ff8a1a', accent: '#ff4a1a', glow: '#ffd36b', text: '#fff3cf', led: [1, 0.25, 0.1] }, { payScale: 2.72 });
const TH_LDL = { bg1: '#04103a', bg2: '#1a4ad8', frame: '#4aa8ff', accent: '#3a8aff', glow: '#bfe0ff', text: '#fff', led: [0.15, 0.4, 1] };
for (const [id, nm] of [['ldl1', 'CHECKERED FLAG'], ['ldl2', 'CHICA BONITA'], ['ldl3', 'CORRIDA DE TOROS'], ['ldl4', 'KUNG FU MASTER']]) skinGame(id, nm, 'LIGHTNING DOLLAR LINK', ['9', '10', 'J', 'Q', 'K'], ['S2', 'S3', 'S1', 'LOGO'], TH_LDL);
const TH_TE = { bg1: '#1a0438', bg2: '#7a1ad8', frame: '#e07aff', accent: '#c03aff', glow: '#f0c0ff', text: '#fff', led: [0.8, 0.2, 1] };
for (const [id, nm] of [['te1', 'INCA DIAMONDS'], ['te2', 'MAGIC EMPEROR']]) skinGame(id, nm, 'THUNDER EMPIRE', ['9', '10', 'J', 'Q', 'K'], ['S2', 'S3', 'S1', 'LOGO'], TH_TE);

function reelWeights(game, reel, free) {
  const w = [];
  for (const s of game.syms) {
    let v = (free && game.free && game.free[s] != null) ? game.free[s] : game.base[s];
    if (s === game.wild && game.noWild.includes(reel)) v = 0;
    if (game.bonusReels && s === game.bonusSym && !game.bonusReels.includes(reel)) v = 0;
    w.push(v);
  }
  return w;
}

function coinValue(bet) {
  const js = jpScaleFor(bet);
  const r = Math.random();
  if (r < 0.0015 * js) return { jp: 'MAJOR' };
  if (r < 0.0015 * js + 0.008 * js) return { jp: 'MINOR' };
  if (r < 0.0015 * js + 0.008 * js + 0.03) return { jp: 'MINI' };
  const m = wpick([1, 2, 3, 5, 8, 10, 15, 25], [24, 26, 20, 12, 8, 5, 3, 2]);
  return { m };
}

// spin one grid. returns {grid, mults, coins}
function spinGrid(game, bet, free) {
  const grid = [], mults = [], coins = [];
  for (let r = 0; r < 5; r++) {
    const w = reelWeights(game, r, free);
    const col = [], mc = [], cc = [];
    for (let row = 0; row < 3; row++) {
      const s = wpick(game.syms, w);
      col.push(s);
      mc.push(free && s === game.wild && game.wildMults && r > 0 && r < 4 ? wpick([1, 2, 3, 5], game.wildMults) : 1);
      cc.push(s === 'COIN' ? coinValue(bet) : null);
    }
    grid.push(col); mults.push(mc); coins.push(cc);
  }
  return { grid, mults, coins };
}

function evalLines(game, res, bet, free) {
  const lineBet = bet / 25 * (game.payScale || 1) * rtpMod;
  const wins = [];
  let total = 0;
  for (let li = 0; li < LINES.length; li++) {
    const L = LINES[li];
    const seq = L.map((row, r) => res.grid[r][row]);
    const ms = L.map((row, r) => res.mults[r][row]);
    // wild-only run
    let wn = 0; while (wn < 5 && seq[wn] === game.wild) wn++;
    let best = null;
    if (wn >= 3 && game.pays[game.wild]) {
      let m = 1; for (let i = 0; i < wn; i++) m *= ms[i];
      best = { sym: game.wild, n: wn, pay: game.pays[game.wild][wn] * lineBet * m };
    }
    const first = seq.find(s => s !== game.wild);
    if (first && game.pays[first]) {
      let n = 0, m = 1;
      while (n < 5 && (seq[n] === first || seq[n] === game.wild)) { m *= ms[n]; n++; }
      if (n >= 3) {
        const pay = game.pays[first][n] * lineBet * m;
        if (!best || pay > best.pay) best = { sym: first, n, pay };
      }
    }
    if (best && best.pay > 0) {
      if (free && game.freeMult) best.pay *= game.freeMult;   // Queen of the Nile: every free game win is tripled
      best.line = li; best.mult = 1;
      wins.push(best); total += best.pay;
    }
  }
  return { wins, total };
}

function countSym(res, s) {
  let n = 0; const pos = [];
  for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) if (res.grid[r][row] === s) { n++; pos.push([r, row]); }
  return { n, pos };
}

// ---- features (pure simulations; the renderer replays these step lists) ----
function playHoldSpin(game, bet, res) {
  const cells = [];
  for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) cells.push(res.coins[r][row]);
  const steps = []; // each step: array of {idx, val}
  let respins = 3;
  while (respins > 0) {
    respins--;
    const landed = [];
    for (let i = 0; i < 15; i++) if (!cells[i] && Math.random() < 0.055) { const v = coinValue(bet); cells[i] = v; landed.push({ idx: i, val: v }); }
    if (landed.length) respins = 3;
    steps.push({ landed, respins });
    if (cells.every(c => c)) break;
  }
  let credit = 0; const jps = [];
  for (const c of cells) { if (!c) continue; if (c.jp) jps.push(c.jp); else credit += c.m * bet; }
  const full = cells.every(c => c);
  if (full) jps.push('GRAND');
  return { cells, steps, credit, jps, full };
}

const WHEEL_SEGS = [
  { m: 10 }, { jp: 'MINI' }, { m: 20 }, { m: 8 }, { jp: 'MINOR' }, { m: 15 }, { m: 50 }, { m: 10 },
  { jp: 'MAJOR' }, { m: 25 }, { m: 8 }, { jp: 'MINI' }, { m: 100 }, { m: 12 }, { jp: 'GRAND' }, { m: 30 }];
function wheelWeights(bet) {
  const js = jpScaleFor(bet);
  return WHEEL_SEGS.map(s => s.jp ? ({ MINI: 7, MINOR: 4 * js, MAJOR: 0.5 * js, GRAND: 0.06 * js })[s.jp] : ({ 8: 14, 10: 13, 12: 10, 15: 9, 20: 7, 25: 5, 30: 4, 50: 2.5, 100: 0.8 })[s.m]);
}
function playWheel(bet) {
  const idx = wpick(WHEEL_SEGS.map((_, i) => i), wheelWeights(bet));
  const seg = WHEEL_SEGS[idx];
  return { idx, seg, credit: seg.m ? seg.m * bet : 0, jps: seg.jp ? [seg.jp] : [] };
}

function playPick(bet, mystery) {
  const js = jpScaleFor(bet);
  const win = mystery
    ? wpick(JP_NAMES, [55, 33, 10 * js, 1.2 * js])
    : wpick(JP_NAMES, [70, 24, 5 * js, 0.6 * js]);
  // build reveal sequence: winner appears 3 times, others at most 2, winner's 3rd is last
  const counts = { MINI: 0, MINOR: 0, MAJOR: 0, GRAND: 0 };
  const seq = [];
  const others = JP_NAMES.filter(j => j !== win);
  const decoys = Math.floor(Math.random() * 6);
  const pool = [];
  for (const o of others) { pool.push(o, o); }
  pool.sort(() => Math.random() - 0.5);
  const dec = pool.slice(0, decoys);
  const body = [win, win, ...dec].sort(() => Math.random() - 0.5);
  for (const b of body) { seq.push(b); counts[b]++; }
  seq.push(win);
  // fill the rest (unrevealed at end) with a plausible board
  const rest = [];
  for (const j of JP_NAMES) { const lim = j === win ? 3 : 2; for (let k = counts[j] + (j === win ? 1 : 0); k < lim; k++) rest.push(j); }
  while (seq.length + rest.length < 12) rest.push(others[Math.floor(Math.random() * others.length)]);
  rest.sort(() => Math.random() - 0.5);
  return { win, seq, rest: rest.slice(0, 12 - seq.length), jps: [win], credit: mystery ? 0 : bet * wpick([5, 10, 15, 20, 30], [30, 30, 20, 12, 8]) };
}

// Full spin incl. features — used by NPC machines + RTP sim. Player machine uses
// the same pieces but replays features visually.
function fullSpin(game, bet, jpValues, free) {
  const res = spinGrid(game, bet, free);
  const lw = evalLines(game, res, bet, free);
  const out = { res, lw, win: lw.total, feature: null };
  if (game.feature === 'holdspin') {
    const c = countSym(res, 'COIN');
    if (c.n >= 6) { const f = playHoldSpin(game, bet, res); out.feature = { type: 'holdspin', f }; out.win += f.credit + f.jps.reduce((a, j) => a + jpValues[j] * jpFactor(bet), 0); }
  } else if (game.feature === 'freegames') {
    const c = countSym(res, game.scatter);
    if (!free && c.n >= 3) {
      out.win += bet * [0, 0, 0, 2, 10, 50][Math.min(5, c.n)];
      let left = [0, 0, 0, 8, 12, 20][Math.min(5, c.n)], fw = 0, played = 0;
      while (left > 0 && played < 200) { left--; played++; const s = fullSpin(game, bet, jpValues, true); fw += s.win; if (countSym(s.res, game.scatter).n >= 3) left += 5; }
      out.feature = { type: 'freegames', games: played, win: fw }; out.win += fw;
    } else if (free && c.n >= 2) {
      out.win += c.n >= 3 ? bet * 2 : 0;
    }
    if (!free && !out.feature && Math.random() < game.mystery * jpScaleFor(bet)) {
      const p = playPick(bet, true); out.feature = { type: 'pick', f: p }; out.win += jpValues[p.win] * jpFactor(bet);
    }
  } else if (game.feature === 'wheel') {
    const c = countSym(res, 'BONUS');
    if (c.n >= 3) { const f = playWheel(bet); out.feature = { type: 'wheel', f }; out.win += f.credit + f.jps.reduce((a, j) => a + jpValues[j] * jpFactor(bet), 0); }
  } else if (game.feature === 'pick') {
    const c = countSym(res, game.scatter);
    if (c.n >= 3) { out.win += bet * [0, 0, 0, 3, 15, 60][Math.min(5, c.n)]; const f = playPick(bet, false); out.feature = { type: 'pick', f }; out.win += jpValues[f.win] * jpFactor(bet) + f.credit; }
  }
  return out;
}

// ---- src/05-pokies.js ----

// =====================================================================
//  POKIES: symbol art, screen rendering, machine state machine
// =====================================================================
const JP = Object.assign({}, JP_SEED);           // live linked progressive pools (quoted @ $2 bet)
const SW = 1024, SH = 768;                        // logical screen resolution
const RX = 52, RY = 172, CW = 184, CH = 160;      // reel window
const symCache = {};

function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function lg(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }
function rg(x, cx, cy, r0, r1, stops) { const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }
function outlineText(x, txt, X, Y, size, fill, stroke = '#120a04', sw = 10, font = 'Bungee, Impact, sans-serif') {
  x.font = `${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = sw; x.strokeStyle = stroke; x.strokeText(txt, X, Y); x.fillStyle = fill; x.fillText(txt, X, Y);
}
const ROYAL_COL = { '9': ['#5ff0e0', '#0a6a7a'], '10': ['#7ab8ff', '#103a8a'], 'J': ['#8aff7a', '#16701a'], 'Q': ['#ff8ae8', '#7a1070'], 'K': ['#ff7a6a', '#8a1010'], 'A': ['#ffe07a', '#a85a08'] };

const ART = {
  royal(x, ch) {
    const [c1, c2] = ROYAL_COL[ch];
    x.font = `${ch === '10' ? 84 : 104}px Bungee, Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 14; x.strokeStyle = '#0d0703'; x.strokeText(ch, 0, 8);
    x.fillStyle = lg(x, 0, -50, 0, 60, ['#ffffff', c1, c2]); x.fillText(ch, 0, 8);
    x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.7)'; x.strokeText(ch, 0, 8);
  },
  BOOM(x) {
    x.rotate(-0.25);
    x.beginPath(); x.moveTo(-66, 28); x.quadraticCurveTo(-30, -30, 0, -44); x.quadraticCurveTo(30, -30, 66, 28); x.quadraticCurveTo(58, 40, 48, 34); x.quadraticCurveTo(22, -6, 0, -16); x.quadraticCurveTo(-22, -6, -48, 34); x.quadraticCurveTo(-58, 40, -66, 28); x.closePath();
    x.fillStyle = lg(x, -60, -40, 60, 40, ['#e8a050', '#a85a20', '#5a2a0a']); x.fill(); x.lineWidth = 5; x.strokeStyle = '#2a1204'; x.stroke();
    x.fillStyle = '#fff2d8'; for (let i = 0; i < 14; i++) { const t = i / 13, px = lerp(-54, 54, t), py = 22 - Math.sin(t * Math.PI) * 50; x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill(); }
    x.fillStyle = '#ffd24a'; for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, px = lerp(-50, 50, t), py = 26 - Math.sin(t * Math.PI) * 42; x.beginPath(); x.arc(px, py, 2.2, 0, 7); x.fill(); }
  },
  KOALA(x) {
    for (const s of [-1, 1]) { x.fillStyle = '#7d8187'; x.beginPath(); x.arc(s * 46, -32, 28, 0, 7); x.fill(); x.fillStyle = '#efe9df'; x.beginPath(); x.arc(s * 46, -30, 17, 0, 7); x.fill(); }
    x.fillStyle = rg(x, -10, -10, 5, 60, ['#b8bcc2', '#8a8e94', '#5e6268']); x.beginPath(); x.ellipse(0, 6, 50, 46, 0, 0, 7); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#2a2c30'; x.stroke();
    x.fillStyle = '#eee'; x.beginPath(); x.ellipse(0, 34, 26, 14, 0, 0, 7); x.fill();
    x.fillStyle = '#111'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 20, -4, 6, 0, 7); x.fill(); }
    x.fillStyle = '#fff'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 20 + 2, -6, 2, 0, 7); x.fill(); }
    x.fillStyle = lg(x, 0, 2, 0, 40, ['#3a3a40', '#0a0a0c']); x.beginPath(); x.ellipse(0, 18, 15, 21, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(-5, 8, 4, 7, -0.3, 0, 7); x.fill();
  },
  ULURU(x) {
    x.save(); x.beginPath(); x.arc(0, 0, 64, 0, 7); x.clip();
    x.fillStyle = lg(x, 0, -64, 0, 64, ['#3a1a5a', '#ff6a3a', '#ffcf5a']); x.fillRect(-64, -64, 128, 128);
    x.fillStyle = '#fff3a0'; x.beginPath(); x.arc(30, 14, 22, 0, 7); x.fill();
    x.beginPath(); x.moveTo(-70, 34); x.bezierCurveTo(-60, -2, -46, -10, -30, -12); x.lineTo(30, -16); x.bezierCurveTo(46, -12, 58, 4, 70, 34); x.closePath();
    x.fillStyle = lg(x, 0, -16, 0, 34, ['#e0602a', '#a0361a', '#5a1a0a']); x.fill();
    x.strokeStyle = 'rgba(60,15,5,.6)'; x.lineWidth = 2; for (let i = -4; i <= 4; i++) { x.beginPath(); x.moveTo(i * 12, -12); x.quadraticCurveTo(i * 13, 10, i * 14, 34); x.stroke(); }
    x.fillStyle = '#5a2a10'; x.fillRect(-70, 30, 140, 40);
    x.restore(); x.lineWidth = 5; x.strokeStyle = '#f6c445'; x.beginPath(); x.arc(0, 0, 64, 0, 7); x.stroke();
  },
  ROO(x) {
    x.fillStyle = rg(x, 0, 0, 10, 64, ['#fff6a0', '#ffb02a', '#e0501a']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill();
    x.save(); x.scale(1.15, 1.15); x.translate(-4, 0);
    x.beginPath(); x.moveTo(-55, 40); x.quadraticCurveTo(-30, 30, -12, 22); x.bezierCurveTo(-22, -5, -5, -22, 12, -20); x.lineTo(18, -34); x.lineTo(16, -46); x.lineTo(22, -38); x.lineTo(26, -48); x.lineTo(28, -36);
    x.quadraticCurveTo(42, -34, 44, -28); x.lineTo(30, -24); x.lineTo(24, -14); x.lineTo(31, -4); x.lineTo(27, -1); x.lineTo(18, -6); x.quadraticCurveTo(22, 10, 14, 22); x.lineTo(30, 38); x.lineTo(30, 42); x.lineTo(2, 42); x.lineTo(0, 34); x.quadraticCurveTo(-14, 34, -20, 30); x.lineTo(-55, 44); x.closePath();
    x.fillStyle = '#1a0a04'; x.fill(); x.restore();
    x.lineWidth = 5; x.strokeStyle = '#7a2a08'; x.beginPath(); x.arc(0, 0, 62, 0, 7); x.stroke();
  },
  WILD(x, g) {
    const t = g.theme;
    rr(x, -78, -48, 156, 96, 18); x.fillStyle = lg(x, 0, -48, 0, 48, [t.bg2, t.bg1]); x.fill(); x.lineWidth = 7; x.strokeStyle = t.frame; x.stroke();
    if (g.id === 'dragon') { x.fillStyle = rg(x, -10, -12, 4, 46, ['#ffffff', '#ffd6f0', '#9ad0ff', '#4a2a8a']); x.beginPath(); x.arc(0, 0, 44, 0, 7); x.fill(); }
    if (g.id === 'reef') { x.fillStyle = '#ffb8c8'; x.beginPath(); x.ellipse(0, 18, 60, 24, 0, 0, Math.PI); x.fill(); x.fillStyle = rg(x, -6, -6, 2, 24, ['#fff', '#e8e8ff', '#b8b8d8']); x.beginPath(); x.arc(0, 4, 22, 0, 7); x.fill(); }
    if (g.link) { x.fillStyle = rg(x, -8, -10, 4, 44, ['#fffbe0', g.theme.glow, g.theme.accent]); x.beginPath(); x.arc(0, 0, 40, 0, 7); x.fill(); }
    if (g.id === 'sevens') { x.fillStyle = '#ffd84a'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 22 : 50; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }
    outlineText(x, 'WILD', 0, 4, 46, lg(x, 0, -20, 0, 24, ['#fffbe0', t.glow, t.accent]), '#1a0802', 9);
  },
  COIN(x, g) {
    if (g && g.link) { ART.FIREBALL(x); return; }
    x.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 52 + Math.sin(i * 2.7) * 7; x.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.9); } x.closePath();
    x.fillStyle = rg(x, -18, -18, 4, 64, ['#fffbe0', '#ffd84a', '#c88a10', '#6a4004']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#4a2a02'; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(-20, -20, 10, 6, -0.6, 0, 7); x.fill();
  },
  // ---------- FORTUNE LINK art ----------
  FIREBALL(x) {
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + 0.2, r = 62 + (i % 3) * 6; x.fillStyle = i % 2 ? 'rgba(255,90,10,.85)' : 'rgba(255,170,30,.85)'; x.beginPath(); x.moveTo(Math.cos(a - 0.25) * 44, Math.sin(a - 0.25) * 44); x.quadraticCurveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15, Math.cos(a + 0.3) * 46, Math.sin(a + 0.3) * 46); x.fill(); }
    x.fillStyle = rg(x, -14, -16, 4, 58, ['#fffbe0', '#ffe27a', '#f0a010', '#a04a04']); x.beginPath(); x.arc(0, 0, 52, 0, 7); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#ff7a10'; x.stroke(); x.lineWidth = 2; x.strokeStyle = 'rgba(120,40,0,.5)'; x.beginPath(); x.arc(0, 0, 44, 0, 7); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(-18, -22, 12, 6, -0.6, 0, 7); x.fill();
  },
  PIPA(x) {
    x.rotate(0.5);
    x.fillStyle = lg(x, -40, 0, 40, 0, ['#6a3a10', '#c88a3a', '#6a3a10']); x.beginPath(); x.ellipse(0, 22, 40, 48, 0, 0, 7); x.fill(); x.lineWidth = 4; x.strokeStyle = '#2a1204'; x.stroke();
    x.fillStyle = '#3a1a04'; x.fillRect(-7, -72, 14, 66); x.beginPath(); x.arc(0, 30, 9, 0, 7); x.fill();
    x.strokeStyle = '#f0e0c0'; x.lineWidth = 1.5; for (const sx of [-4, -1.5, 1.5, 4]) { x.beginPath(); x.moveTo(sx, -66); x.lineTo(sx * 1.4, 50); x.stroke(); }
    x.fillStyle = '#d8b070'; for (const py of [-58, -50]) for (const s of [-1, 1]) { x.fillRect(s * 7, py, s * 9, 4); }
  },
  MOONCAKE(x) {
    x.fillStyle = lg(x, 0, -50, 0, 50, ['#f0c070', '#c07a2a', '#6a3a0a']); x.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = 54 + (i % 2) * 6; x.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9); } x.closePath(); x.fill(); x.lineWidth = 3; x.strokeStyle = '#4a2204'; x.stroke();
    x.strokeStyle = 'rgba(80,30,0,.55)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 34, 0, 7); x.stroke();
    for (let i = 0; i < 4; i++) { x.save(); x.rotate(i * Math.PI / 2); x.beginPath(); x.moveTo(0, -8); x.quadraticCurveTo(14, -22, 0, -30); x.quadraticCurveTo(-14, -22, 0, -8); x.stroke(); x.restore(); }
    x.fillStyle = 'rgba(255,240,200,.4)'; x.beginPath(); x.ellipse(-18, -20, 14, 7, -0.5, 0, 7); x.fill();
  },
  RABBIT(x) {
    x.fillStyle = '#fbfbff'; x.strokeStyle = '#8a8ab0'; x.lineWidth = 3;
    x.beginPath(); x.ellipse(8, 18, 46, 30, -0.1, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.ellipse(-34, -6, 22, 20, 0, 0, 7); x.fill(); x.stroke();
    for (const [ex, a] of [[-40, -0.35], [-28, -0.15]]) { x.save(); x.translate(ex, -22); x.rotate(a); x.beginPath(); x.ellipse(0, -24, 8, 26, 0, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#ffb8c8'; x.beginPath(); x.ellipse(0, -24, 4, 18, 0, 0, 7); x.fill(); x.fillStyle = '#fbfbff'; x.restore(); }
    x.fillStyle = '#c0101a'; x.beginPath(); x.arc(-40, -8, 3.5, 0, 7); x.fill(); x.fillStyle = '#ff9ab0'; x.beginPath(); x.arc(-54, 0, 3, 0, 7); x.fill();
    x.strokeStyle = '#d82a2a'; x.lineWidth = 2; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(10 + i * 9, 12, 6, 0, Math.PI); x.stroke(); }
  },
  LADY(x) {
    x.save(); rr(x, -70, -62, 140, 124, 10); x.clip();
    x.fillStyle = lg(x, 0, -62, 0, 62, ['#1a1a6a', '#4a3aa8']); x.fillRect(-70, -62, 140, 124);
    x.fillStyle = '#f0f0ff'; x.beginPath(); x.arc(44, -36, 16, 0, 7); x.fill();
    x.fillStyle = '#1a0a0a'; x.beginPath(); x.ellipse(0, -14, 34, 36, 0, 0, 7); x.fill();
    x.fillStyle = lg(x, 0, -30, 0, 30, ['#ffe8d8', '#f0c8a8']); x.beginPath(); x.ellipse(0, 2, 22, 28, 0, 0, 7); x.fill();
    x.fillStyle = '#1a0a0a'; x.beginPath(); x.ellipse(-8, -2, 4, 2, 0, 0, 7); x.ellipse(8, -2, 4, 2, 0, 0, 7); x.fill();
    x.fillStyle = '#c0101a'; x.beginPath(); x.ellipse(0, 16, 5, 2.5, 0, 0, 7); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = '#d8201a'; x.beginPath(); x.arc(s * 26, -38, 14, 0, 7); x.fill(); x.fillStyle = '#ff6a5a'; x.beginPath(); x.arc(s * 26, -40, 7, 0, 7); x.fill(); }
    x.fillStyle = '#ffd84a'; x.beginPath(); x.moveTo(-14, -42); x.lineTo(0, -56); x.lineTo(14, -42); x.closePath(); x.fill(); x.fillStyle = '#3ad8c8'; for (let i = -2; i <= 2; i++) { x.beginPath(); x.arc(i * 6, -36 + Math.abs(i) * 2, 2.5, 0, 7); x.fill(); }
    x.fillStyle = lg(x, -40, 30, 40, 62, ['#7ad8f0', '#ffb8d8', '#7ad8f0']); x.beginPath(); x.moveTo(-50, 62); x.quadraticCurveTo(-30, 30, 0, 32); x.quadraticCurveTo(30, 30, 50, 62); x.fill();
    x.restore(); x.lineWidth = 5; x.strokeStyle = '#f6c445'; rr(x, -70, -62, 140, 124, 10); x.stroke();
  },
  FAN(x) {
    for (let i = 0; i < 11; i++) { const a = -Math.PI * 0.85 + i * Math.PI * 0.7 / 10; x.fillStyle = i % 2 ? '#c0141a' : '#e8302a'; x.beginPath(); x.moveTo(0, 40); x.arc(0, 40, 84, a, a + Math.PI * 0.07); x.closePath(); x.fill(); }
    x.strokeStyle = '#ffd84a'; x.lineWidth = 3; x.beginPath(); x.arc(0, 40, 84, -Math.PI * 0.85, -Math.PI * 0.15); x.stroke(); x.beginPath(); x.arc(0, 40, 40, -Math.PI * 0.85, -Math.PI * 0.15); x.stroke();
    x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(0, -10, 14, 0, 7); x.fill(); outlineText(x, '福', 0, -8, 18, '#c0141a', '#ffd84a', 1, 'serif');
    x.fillStyle = '#5a2a0a'; x.beginPath(); x.arc(0, 40, 7, 0, 7); x.fill();
  },
  VASE(x) {
    x.beginPath(); x.moveTo(-16, -60); x.lineTo(16, -60); x.quadraticCurveTo(12, -40, 30, -20); x.quadraticCurveTo(56, 10, 30, 50); x.lineTo(-30, 50); x.quadraticCurveTo(-56, 10, -30, -20); x.quadraticCurveTo(-12, -40, -16, -60); x.closePath();
    x.fillStyle = lg(x, -50, 0, 50, 0, ['#c8d8f0', '#ffffff', '#b8c8e8']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#1a2a6a'; x.stroke();
    x.strokeStyle = '#2a4ab8'; x.lineWidth = 3; x.beginPath(); x.moveTo(-36, 0); x.quadraticCurveTo(-10, -20, 0, 6); x.quadraticCurveTo(14, 26, 36, 4); x.stroke();
    for (const [px, py] of [[-14, 20], [18, -6], [-2, 34]]) { x.fillStyle = '#2a4ab8'; x.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 7; x.ellipse(px + Math.cos(a) * 5, py + Math.sin(a) * 5, 4, 2.5, a, 0, 7); } x.fill(); }
    x.fillStyle = '#ffd84a'; x.fillRect(-30, 44, 60, 8); x.fillRect(-18, -62, 36, 6);
  },
  WALL(x) {
    x.save(); rr(x, -70, -60, 140, 120, 10); x.clip();
    x.fillStyle = lg(x, 0, -60, 0, 60, ['#ffcf5a', '#ff8a2a', '#c04a1a']); x.fillRect(-70, -60, 140, 120);
    x.fillStyle = '#ffeaa0'; x.beginPath(); x.arc(30, -20, 16, 0, 7); x.fill();
    x.fillStyle = '#3a5a1a'; x.beginPath(); x.moveTo(-70, 60); x.lineTo(-70, 10); x.quadraticCurveTo(-30, -20, 0, 6); x.quadraticCurveTo(30, 26, 70, -6); x.lineTo(70, 60); x.fill();
    x.strokeStyle = '#c8a878'; x.lineWidth = 9; x.beginPath(); x.moveTo(-70, 30); x.quadraticCurveTo(-34, -6, 0, 18); x.quadraticCurveTo(34, 40, 70, 8); x.stroke();
    x.fillStyle = '#c8a878'; for (const [tx, ty] of [[-44, 4], [8, 18], [48, 22]]) { x.fillRect(tx - 7, ty - 16, 14, 16); x.fillStyle = '#8a6a48'; x.fillRect(tx - 7, ty - 18, 14, 3); x.fillStyle = '#c8a878'; }
    x.restore(); x.lineWidth = 5; x.strokeStyle = '#f6c445'; rr(x, -70, -60, 140, 120, 10); x.stroke();
  },
  EMPEROR(x) {
    x.save(); rr(x, -70, -62, 140, 124, 10); x.clip();
    x.fillStyle = lg(x, 0, -62, 0, 62, ['#ffcf5a', '#e8781a']); x.fillRect(-70, -62, 140, 124);
    x.fillStyle = lg(x, -50, 0, 50, 0, ['#c8901a', '#ffe27a', '#c8901a']); x.beginPath(); x.moveTo(-60, 62); x.quadraticCurveTo(-50, 22, 0, 24); x.quadraticCurveTo(50, 22, 60, 62); x.fill();
    x.fillStyle = '#c0141a'; x.fillRect(-12, 26, 24, 36);
    x.fillStyle = lg(x, 0, -30, 0, 30, ['#ffe0c0', '#e0b088']); x.beginPath(); x.ellipse(0, -2, 22, 27, 0, 0, 7); x.fill();
    x.fillStyle = '#1a0a04'; x.beginPath(); x.moveTo(-6, 14); x.quadraticCurveTo(0, 44, 0, 52); x.quadraticCurveTo(0, 44, 6, 14); x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#1a0a04'; x.beginPath(); x.moveTo(-3, 10); x.quadraticCurveTo(-18, 12, -22, 26); x.moveTo(3, 10); x.quadraticCurveTo(18, 12, 22, 26); x.stroke();
    x.beginPath(); x.moveTo(-14, -6); x.lineTo(-5, -4); x.moveTo(14, -6); x.lineTo(5, -4); x.stroke();
    x.fillStyle = '#1a1a1a'; x.fillRect(-34, -48, 68, 10); x.fillStyle = '#ffd84a'; x.fillRect(-10, -60, 20, 14);
    x.strokeStyle = '#ffd84a'; x.lineWidth = 1.5; for (let i = -6; i <= 6; i++) { x.beginPath(); x.moveTo(i * 5, -38); x.lineTo(i * 5, -18); x.stroke(); x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(i * 5, -18, 1.8, 0, 7); x.fill(); }
    x.restore(); x.lineWidth = 5; x.strokeStyle = '#f6c445'; rr(x, -70, -62, 140, 124, 10); x.stroke();
  },
  LOTUS(x) {
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.36; x.save(); x.rotate(a + Math.PI / 2); x.fillStyle = lg(x, 0, -60, 0, 0, ['#ffffff', '#ffe8f0', '#f0b8d0']); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-22, -30, 0, -60); x.quadraticCurveTo(22, -30, 0, 0); x.fill(); x.lineWidth = 2; x.strokeStyle = '#c87a9a'; x.stroke(); x.restore(); }
    x.fillStyle = rg(x, 0, 0, 2, 18, ['#fff8a0', '#f0b81a']); x.beginPath(); x.arc(0, 0, 16, 0, 7); x.fill();
    x.fillStyle = '#3a8a2a'; x.beginPath(); x.ellipse(0, 34, 60, 12, 0, 0, 7); x.fill();
  },
  JUNK(x) {
    x.fillStyle = '#3a5aa8'; x.fillRect(-70, 36, 140, 26); x.strokeStyle = '#fff'; x.lineWidth = 2; for (let i = -3; i <= 3; i++) { x.beginPath(); x.arc(i * 22, 42, 9, Math.PI, 0); x.stroke(); }
    x.fillStyle = lg(x, 0, 14, 0, 40, ['#8a4a1a', '#4a2204']); x.beginPath(); x.moveTo(-60, 14); x.lineTo(60, 10); x.lineTo(44, 40); x.lineTo(-48, 40); x.closePath(); x.fill();
    x.fillStyle = '#4a2204'; x.fillRect(-2, -64, 4, 78); x.fillRect(-34, -40, 3, 54);
    for (const [cx, w, h] of [[16, 46, 70], [-20, 32, 46]]) { x.fillStyle = lg(x, cx - w / 2, 0, cx + w / 2, 0, ['#e8c06a', '#f8e0a0']); x.beginPath(); x.moveTo(cx - w / 2, -64 + (70 - h)); x.lineTo(cx + w / 2, -60 + (70 - h)); x.lineTo(cx + w / 2 - 4, 8); x.lineTo(cx - w / 2 + 4, 8); x.closePath(); x.fill(); x.strokeStyle = '#8a5a1a'; x.lineWidth = 1.5; for (let k = 1; k < 5; k++) { const yy = -64 + (70 - h) + k * h / 5; x.beginPath(); x.moveTo(cx - w / 2 + 2, yy); x.lineTo(cx + w / 2 - 2, yy); x.stroke(); } }
  },
  PANDA(x) {
    for (const s of [-1, 1]) { x.fillStyle = '#111'; x.beginPath(); x.arc(s * 42, -40, 18, 0, 7); x.fill(); }
    x.fillStyle = rg(x, -10, -10, 6, 70, ['#ffffff', '#f0f0f0', '#c8c8c8']); x.beginPath(); x.ellipse(0, 0, 56, 50, 0, 0, 7); x.fill(); x.lineWidth = 3; x.strokeStyle = '#555'; x.stroke();
    for (const s of [-1, 1]) { x.fillStyle = '#111'; x.save(); x.translate(s * 20, -6); x.rotate(s * 0.5); x.beginPath(); x.ellipse(0, 0, 13, 17, 0, 0, 7); x.fill(); x.restore(); x.fillStyle = '#fff'; x.beginPath(); x.arc(s * 19, -8, 4.5, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(s * 19, -8, 2.5, 0, 7); x.fill(); }
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(0, 14, 9, 6, 0, 0, 7); x.fill();
    x.strokeStyle = '#111'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 20); x.lineTo(0, 27); x.moveTo(-10, 30); x.quadraticCurveTo(0, 38, 10, 30); x.stroke();
    x.fillStyle = '#4ab83a'; x.save(); x.translate(44, 30); x.rotate(-0.6); x.fillRect(-4, -34, 8, 60); x.restore();
  },
  LANTERN(x) {
    x.strokeStyle = '#ffd84a'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -66); x.lineTo(0, -50); x.stroke();
    x.fillStyle = lg(x, -44, 0, 44, 0, ['#7a0a0a', '#ff3a2a', '#7a0a0a']); x.beginPath(); x.ellipse(0, 0, 46, 46, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,210,80,.6)'; x.lineWidth = 2; for (let i = -2; i <= 2; i++) { x.beginPath(); x.ellipse(0, 0, Math.abs(i) * 11 + 2, 46, 0, 0, 7); x.stroke(); }
    x.fillStyle = lg(x, 0, -56, 0, -42, ['#fff2a0', '#c88a10']); rr(x, -28, -54, 56, 12, 3); x.fill(); rr(x, -28, 42, 56, 12, 3); x.fill();
    x.strokeStyle = '#ff3a2a'; x.lineWidth = 3; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 5, 54); x.lineTo(i * 6, 70); x.stroke(); }
  },
  ENVELOPE(x) {
    rr(x, -44, -56, 88, 112, 8); x.fillStyle = lg(x, 0, -56, 0, 56, ['#ff4a3a', '#a00a0a']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#ffd84a'; x.stroke();
    x.beginPath(); x.moveTo(-44, -30); x.lineTo(0, 0); x.lineTo(44, -30); x.strokeStyle = 'rgba(255,210,80,.6)'; x.stroke();
    x.fillStyle = rg(x, -6, -6, 2, 24, ['#fffbe0', '#ffd84a', '#a86a08']); x.beginPath(); x.arc(0, 6, 22, 0, 7); x.fill();
    outlineText(x, '8', 0, 9, 30, '#a00a0a', '#ffeaa0', 2);
  },
  KOI(x) {
    x.rotate(-0.35);
    x.fillStyle = '#ff7a2a'; x.beginPath(); x.moveTo(36, 0); x.lineTo(66, -24); x.quadraticCurveTo(56, 0, 66, 24); x.closePath(); x.fill();
    x.fillStyle = lg(x, 0, -24, 0, 24, ['#ffffff', '#ffe8d8', '#ff9a5a']); x.beginPath(); x.ellipse(-4, 0, 48, 24, 0, 0, 7); x.fill();
    x.fillStyle = '#ff4a1a'; for (const [px, py, r] of [[-10, -8, 12], [12, 6, 10], [-28, 8, 7]]) { x.beginPath(); x.ellipse(px, py, r * 1.3, r, 0.4, 0, 7); x.fill(); }
    x.fillStyle = '#ff9a5a'; x.beginPath(); x.ellipse(0, 22, 14, 6, 0.6, 0, 7); x.fill(); x.beginPath(); x.ellipse(0, -22, 14, 6, -0.6, 0, 7); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(-36, -5, 4, 0, 7); x.fill();
    x.lineWidth = 3; x.strokeStyle = '#7a2a08'; x.beginPath(); x.ellipse(-4, 0, 48, 24, 0, 0, 7); x.stroke();
  },
  INGOT(x) {
    x.beginPath(); x.moveTo(-66, -4); x.quadraticCurveTo(-60, 40, 0, 42); x.quadraticCurveTo(60, 40, 66, -4); x.quadraticCurveTo(40, 6, 26, -8); x.quadraticCurveTo(26, -42, 0, -42); x.quadraticCurveTo(-26, -42, -26, -8); x.quadraticCurveTo(-40, 6, -66, -4); x.closePath();
    x.fillStyle = lg(x, 0, -42, 0, 42, ['#fffbe0', '#ffd84a', '#c88a10', '#6a4004']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#4a2a02'; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(-8, -26, 8, 5, -0.5, 0, 7); x.fill();
  },
  SCAT(x) {
    x.fillStyle = rg(x, -16, -16, 6, 70, ['#fffbe0', '#ffd84a', '#c88a10', '#6a4004']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#4a2a02'; x.stroke(); x.beginPath(); x.arc(0, 0, 50, 0, 7); x.stroke();
    x.fillStyle = '#7a0a0a'; x.fillRect(-14, -14, 28, 28); x.strokeRect(-14, -14, 28, 28);
    outlineText(x, 'FREE', 0, -32, 20, '#a00a0a', '#ffeaa0', 3); outlineText(x, 'GAMES', 0, 32, 18, '#a00a0a', '#ffeaa0', 3);
  },
  CHERRY(x) {
    x.strokeStyle = '#3a6a1a'; x.lineWidth = 5; x.beginPath(); x.moveTo(-22, 14); x.quadraticCurveTo(-8, -30, 14, -50); x.moveTo(24, 22); x.quadraticCurveTo(22, -20, 14, -50); x.stroke();
    x.fillStyle = '#4aa02a'; x.beginPath(); x.ellipse(32, -48, 22, 10, -0.3, 0, 7); x.fill();
    for (const [cx, cy] of [[-24, 24], [24, 30]]) { x.fillStyle = rg(x, cx - 8, cy - 8, 2, 30, ['#ffb0b0', '#e0101a', '#5a0005']); x.beginPath(); x.arc(cx, cy, 26, 0, 7); x.fill(); x.lineWidth = 3; x.strokeStyle = '#3a0002'; x.stroke(); }
  },
  BELL(x) {
    x.beginPath(); x.moveTo(-50, 36); x.quadraticCurveTo(-40, 20, -38, -10); x.quadraticCurveTo(-36, -52, 0, -54); x.quadraticCurveTo(36, -52, 38, -10); x.quadraticCurveTo(40, 20, 50, 36); x.closePath();
    x.fillStyle = lg(x, -40, 0, 40, 0, ['#a86a08', '#ffe88a', '#ffd84a', '#8a5004']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#4a2a02'; x.stroke();
    x.fillStyle = '#c88a10'; rr(x, -54, 32, 108, 12, 6); x.fill(); x.stroke();
    x.fillStyle = '#8a5004'; x.beginPath(); x.arc(0, 52, 10, 0, 7); x.fill();
  },
  BAR(x) {
    rr(x, -72, -34, 144, 68, 10); x.fillStyle = lg(x, 0, -34, 0, 34, ['#333', '#000']); x.fill(); x.lineWidth = 6; x.strokeStyle = '#ffd84a'; x.stroke();
    outlineText(x, 'BAR', 0, 4, 46, lg(x, 0, -20, 0, 20, ['#fff', '#ddd', '#888']), '#000', 4);
  },
  DIAMOND(x) {
    const pts = [[-56, -14], [-30, -42], [30, -42], [56, -14], [0, 52]];
    x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath();
    x.fillStyle = lg(x, -50, -40, 50, 50, ['#d8f4ff', '#3ab0ff', '#0a3a9a']); x.fill(); x.lineWidth = 3; x.strokeStyle = '#04205a'; x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-56, -14); x.lineTo(56, -14); x.moveTo(-30, -42); x.lineTo(-14, -14); x.lineTo(0, 52); x.lineTo(14, -14); x.lineTo(30, -42); x.moveTo(-14, -14); x.lineTo(0, -42); x.lineTo(14, -14); x.stroke();
  },
  seven(x, c1, c2) {
    x.font = '150px Bungee, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 16; x.strokeStyle = '#000'; x.strokeText('7', 0, 10);
    x.lineWidth = 8; x.strokeStyle = '#fff'; x.strokeText('7', 0, 10);
    x.fillStyle = lg(x, 0, -60, 0, 70, ['#fff', c1, c2]); x.fillText('7', 0, 10);
  },
  SEVENB(x) { ART.seven(x, '#5ab0ff', '#0a2a8a'); },
  SEVENR(x) { ART.seven(x, '#ff6a5a', '#8a0a0a'); },
  BONUS(x) {
    const cols = ['#ff3a4a', '#ffd84a', '#3ab0ff', '#4ae07a'];
    for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.beginPath(); x.moveTo(0, -6); x.arc(0, -6, 50, i * Math.PI / 4, (i + 1) * Math.PI / 4); x.closePath(); x.fill(); }
    x.lineWidth = 5; x.strokeStyle = '#fff'; x.beginPath(); x.arc(0, -6, 50, 0, 7); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -6, 10, 0, 7); x.fill();
    rr(x, -60, 30, 120, 34, 8); x.fillStyle = '#c0102a'; x.fill(); x.strokeStyle = '#ffd84a'; x.lineWidth = 4; x.stroke();
    outlineText(x, 'BONUS', 0, 48, 24, '#fff', '#5a0010', 4);
  },
  SHELL(x) {
    x.beginPath(); x.moveTo(0, 46);
    for (let i = 0; i <= 8; i++) { const a = Math.PI + i / 8 * Math.PI, r = 58; x.quadraticCurveTo(Math.cos(a - 0.2) * r * 1.1, Math.sin(a - 0.2) * r * 1.1 + 10, Math.cos(a) * r, Math.sin(a) * r + 10); }
    x.closePath(); x.fillStyle = lg(x, 0, -50, 0, 46, ['#fff0e0', '#ffb08a', '#e0604a']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#7a2a1a'; x.stroke();
    x.strokeStyle = 'rgba(120,40,20,.6)'; x.lineWidth = 2; for (let i = 1; i < 8; i++) { const a = Math.PI + i / 8 * Math.PI; x.beginPath(); x.moveTo(0, 46); x.lineTo(Math.cos(a) * 56, Math.sin(a) * 56 + 10); x.stroke(); }
    x.fillStyle = '#e0604a'; x.fillRect(-20, 40, 40, 12);
  },
  STAR(x) {
    x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 24 : 62; const px = Math.cos(a) * r, py = Math.sin(a) * r + 4; if (i === 0) x.moveTo(px, py); else x.quadraticCurveTo(Math.cos(a - Math.PI / 10) * (r + 10) * 0.7, Math.sin(a - Math.PI / 10) * (r + 10) * 0.7 + 4, px, py); }
    x.closePath(); x.fillStyle = rg(x, 0, 0, 4, 64, ['#fff0a0', '#ff8a2a', '#c0401a']); x.fill(); x.lineWidth = 4; x.strokeStyle = '#6a1a04'; x.stroke();
    x.fillStyle = 'rgba(255,240,200,.85)'; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; for (let k = 1; k < 4; k++) { x.beginPath(); x.arc(Math.cos(a) * k * 13, Math.sin(a) * k * 13 + 4, 3, 0, 7); x.fill(); } }
  },
  FISH(x) {
    x.fillStyle = '#ff7a1a'; x.beginPath(); x.moveTo(36, 0); x.lineTo(64, -24); x.lineTo(58, 0); x.lineTo(64, 24); x.closePath(); x.fill();
    x.fillStyle = lg(x, 0, -30, 0, 30, ['#ffb04a', '#ff6a0a', '#c03a00']); x.beginPath(); x.ellipse(-6, 0, 46, 30, 0, 0, 7); x.fill();
    x.save(); x.beginPath(); x.ellipse(-6, 0, 46, 30, 0, 0, 7); x.clip();
    for (const sx of [-28, 0, 26]) { x.fillStyle = '#111'; x.fillRect(sx - 9, -40, 18, 80); x.fillStyle = '#fff'; x.fillRect(sx - 6, -40, 12, 80); }
    x.restore(); x.lineWidth = 3; x.strokeStyle = '#5a1a00'; x.beginPath(); x.ellipse(-6, 0, 46, 30, 0, 0, 7); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(-36, -6, 7, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(-37, -6, 4, 0, 7); x.fill();
  },
  TURTLE(x) {
    x.fillStyle = '#5aa04a'; for (const [fx, fy, a] of [[-40, -30, -0.8], [40, -30, 0.8], [-36, 34, 0.6], [36, 34, -0.6]]) { x.beginPath(); x.ellipse(fx, fy, 24, 11, a, 0, 7); x.fill(); }
    x.beginPath(); x.arc(0, -52, 14, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(-5, -55, 2.5, 0, 7); x.arc(5, -55, 2.5, 0, 7); x.fill();
    x.fillStyle = rg(x, -10, -10, 4, 50, ['#9ae07a', '#3a8a2a', '#1a4a12']); x.beginPath(); x.ellipse(0, 0, 40, 46, 0, 0, 7); x.fill(); x.lineWidth = 4; x.strokeStyle = '#123a0a'; x.stroke();
    x.strokeStyle = 'rgba(220,255,180,.6)'; x.lineWidth = 2;
    const hex = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.stroke(); };
    hex(0, 0, 14); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; hex(Math.cos(a) * 26, Math.sin(a) * 28, 11); }
  },
  CHEST(x) {
    x.fillStyle = rg(x, 0, -30, 4, 50, ['rgba(255,240,150,.9)', 'rgba(255,200,60,0)']); x.beginPath(); x.arc(0, -24, 50, 0, 7); x.fill();
    x.fillStyle = lg(x, 0, -10, 0, 50, ['#a0602a', '#5a300a']); x.fillRect(-60, -6, 120, 56);
    x.beginPath(); x.moveTo(-60, -6); x.quadraticCurveTo(0, -60, 60, -6); x.closePath(); x.fillStyle = lg(x, 0, -50, 0, -6, ['#c0783a', '#7a4010']); x.fill();
    x.fillStyle = '#ffd84a'; for (const bx of [-44, 36]) x.fillRect(bx, -30, 8, 80); x.fillRect(-60, -10, 120, 8);
    x.fillStyle = '#fff0a0'; for (let i = 0; i < 7; i++) { x.beginPath(); x.ellipse(-30 + i * 10, -18 - Math.sin(i) * 6, 8, 4, 0, 0, 7); x.fill(); }
    x.fillStyle = '#ffd84a'; rr(x, -10, 4, 20, 24, 4); x.fill(); x.fillStyle = '#3a1a04'; x.beginPath(); x.arc(0, 13, 4, 0, 7); x.fill();
    x.lineWidth = 4; x.strokeStyle = '#2a1202'; x.strokeRect(-60, -6, 120, 56);
  },
};
function buildSymbolCache(g) {
  const out = {}, S = g.skin ? SLOTSKIN[g.id] : null;
  for (const s of g.syms) {
    const c = mkCanvas(CW, CH), x = c.getContext('2d');
    const m = S && S.sprites.map[s];
    if (m) x.drawImage(S.imgSprites, m[0], m[1], m[2], m[3], 0, 0, CW, CH);   // the supplied artwork, cut out of the screenshot
    else {
      x.translate(CW / 2, CH / 2);
      if (ROYAL_COL[s]) ART.royal(x, s); else if (s === 'WILD') ART.WILD(x, g); else if (ART[s]) ART[s](x, g);
      else { x.fillStyle = g.theme.accent; x.beginPath(); x.arc(0, 0, 56, 0, 7); x.fill(); outlineText(x, String(s).slice(0, 4), 0, 4, 36, '#fff', '#000', 6); }
    }
    const b = mkCanvas(CW, CH), bx = b.getContext('2d');
    for (let k = -5; k <= 5; k++) { bx.globalAlpha = 0.16; bx.drawImage(c, 0, k * 7); }
    out[s] = { sharp: c, blur: b };
  }
  symCache[g.id] = out;
}

// ---------- shared attract & topper canvases per game ----------
const shared = {};
function drawLogo(x, g, cx, cy, sc, t) {
  x.save(); x.translate(cx, cy); x.scale(sc, sc);
  const th = g.theme;
  x.shadowColor = th.glow; x.shadowBlur = 24 + Math.sin(t * 3) * 8;
  outlineText(x, g.name, 0, 0, 74, lg(x, 0, -40, 0, 40, ['#fffbe8', th.glow, th.accent]), '#1a0802', 14);
  x.shadowBlur = 0;
  rr(x, -110, 34, 220, 42, 21); x.fillStyle = lg(x, 0, 34, 0, 76, [th.accent, th.bg1]); x.fill(); x.lineWidth = 4; x.strokeStyle = th.frame; x.stroke();
  outlineText(x, g.sub, 0, 56, 30, '#fff', '#1a0802', 6);
  x.restore();
}
function drawBG(x, g, t) {
  const th = g.theme;
  x.fillStyle = rg(x, SW / 2, SH * 0.45, 40, SW * 0.75, [th.bg2, th.bg1, '#000']); x.fillRect(0, 0, SW, SH);
  x.save(); x.translate(SW / 2, 300); x.rotate(t * 0.08); x.globalAlpha = 0.07;
  for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, 0); x.lineTo(900, -70); x.lineTo(900, 70); x.closePath(); x.fill(); }
  x.restore(); x.globalAlpha = 1;
  if (th.scene) drawScene(x, th.scene, t);
}
// painted backdrops for the Fortune Link games (sits behind the reels and the attract screen)
function drawScene(x, scene, t) {
  if (scene === 'moon') {
    x.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 90; i++) { const sx = (i * 137.5) % SW, sy = (i * 71.3) % (SH * 0.7); x.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + i); x.fillRect(sx, sy, 2, 2); }
    x.globalAlpha = 1; x.fillStyle = rg(x, 830, 230, 20, 150, ['#ffffff', '#e8e8ff', 'rgba(200,200,255,0)']); x.beginPath(); x.arc(830, 230, 150, 0, 7); x.fill();
    x.fillStyle = '#f4f2ff'; x.beginPath(); x.arc(830, 230, 88, 0, 7); x.fill(); x.fillStyle = 'rgba(160,160,200,.35)'; for (const [cx, cy, r] of [[800, 200, 18], [860, 250, 24], [820, 270, 10]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  } else if (scene === 'sunset') {
    x.fillStyle = 'rgba(255,240,160,.9)'; x.beginPath(); x.arc(820, 300, 70, Math.PI, 0); x.fill();
    x.fillStyle = 'rgba(40,70,20,.7)'; x.beginPath(); x.moveTo(0, 520); for (let i = 0; i <= 10; i++) x.lineTo(i * SW / 10, 330 + Math.sin(i * 1.7) * 60); x.lineTo(SW, 768); x.lineTo(0, 768); x.fill();
    x.strokeStyle = 'rgba(200,170,120,.8)'; x.lineWidth = 10; x.beginPath(); for (let i = 0; i <= 10; i++) x.lineTo(i * SW / 10, 350 + Math.sin(i * 1.7) * 60); x.stroke();
  } else if (scene === 'bamboo') {
    for (let i = 0; i < 14; i++) { const bx = (i * 79) % SW + 10, w = 14 + (i % 3) * 6; x.fillStyle = `rgba(${40 + (i % 3) * 20},${120 + (i % 4) * 20},${30},.55)`; x.fillRect(bx, 0, w, SH); x.fillStyle = 'rgba(20,60,10,.5)'; for (let k = 0; k < 6; k++) x.fillRect(bx - 2, k * 140 + (i * 37) % 140, w + 4, 5); }
  }
}
function jpVal(name, bet) { return JP[name] * (bet ? jpFactor(bet) : 1); }
function drawJackpotBar(x, g, bet, t, y = 104) {
  const names = ['GRAND', 'MAJOR', 'MINOR', 'MINI'], cols = [['#ff3a5a', '#7a0018'], ['#b05aff', '#3a0a7a'], ['#3ab0ff', '#0a3a7a'], ['#4ae07a', '#0a5a1a']];
  names.forEach((n, i) => {
    const w = 232, X = 30 + i * 246;
    rr(x, X, y, w, 60, 10); x.fillStyle = lg(x, 0, y, 0, y + 60, cols[i]); x.fill(); x.lineWidth = 3; x.strokeStyle = g.theme.frame; x.stroke();
    outlineText(x, n, X + w / 2, y + 16, 20, '#fff', '#000', 4);
    outlineText(x, fmt$(jpVal(n, bet)), X + w / 2, y + 42, 28, '#ffe98a', '#000', 5, 'Bebas Neue, Impact, sans-serif');
  });
}
function buildShared() {
  skinInit();
  for (const id in GAMES) {
    const g = GAMES[id]; buildSymbolCache(g);
    const S = g.skin && SLOTSKIN[id];
    const ac = S ? mkCanvas(Math.round(S.mw * S.k * 0.5), Math.round(S.mh * S.k * 0.5)) : mkCanvas(512, 384), tc = S ? mkCanvas(S.imgTop ? Math.round(S.tw * 0.75) : 64, S.imgTop ? Math.round(S.th * 0.75) : 64) : mkCanvas(512, 256);
    shared[id] = { attract: ac, at: canvasTex(ac, 1, 1), topper: tc, tt: canvasTex(tc, 1, 1), t: Math.random() * 10 };
  }
}
function drawAttract(id, dt) {
  if (GAMES[id].skin) return skinAttract(id, dt);
  const s = shared[id], g = GAMES[id], x = s.attract.getContext('2d'); s.t += dt;
  x.setTransform(0.5, 0, 0, 0.5, 0, 0);
  drawBG(x, g, s.t); drawLogo(x, g, SW / 2, 54, 0.85, s.t); drawJackpotBar(x, g, 0, s.t, 140);
  // symbol parade
  const syms = g.syms.filter(q => !ROYAL_COL[q]);
  for (let i = 0; i < 5; i++) { const k = syms[(Math.floor(s.t * 0.7) + i) % syms.length]; const bob = Math.sin(s.t * 2 + i) * 10; x.drawImage(symCache[id][k].sharp, RX + i * CW, 260 + bob); }
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 600, SW, 168);
  outlineText(x, 'INSERT CASH TO PLAY', SW / 2, 638, 36, g.theme.glow, '#000', 6);
  outlineText(x, g.tag, SW / 2, 688, 21, '#fff', '#000', 4);
  outlineText(x, '1c · 25 LINES · BETS $0.50 – $10', SW / 2, 732, 21, '#ddd', '#000', 4);
  s.at.needsUpdate = true;
}
function drawTopper(id) {
  if (GAMES[id].skin) return skinTopper(id);
  const s = shared[id], g = GAMES[id], x = s.topper.getContext('2d');
  x.setTransform(0.5, 0, 0, 0.5, 0, 0);
  x.fillStyle = rg(x, SW / 2, 256, 30, 700, [g.theme.bg2, g.theme.bg1, '#000']); x.fillRect(0, 0, SW, 512);
  if (g.link) { drawLinkTopper(x, g, s.t); s.tt.needsUpdate = true; return; }
  drawLogo(x, g, SW / 2, 120, 1.3, s.t);
  rr(x, 180, 300, 664, 150, 20); x.fillStyle = 'rgba(0,0,0,.6)'; x.fill(); x.lineWidth = 5; x.strokeStyle = g.theme.frame; x.stroke();
  outlineText(x, 'GRAND', SW / 2, 336, 40, '#ff6a7a', '#000', 6);
  outlineText(x, fmt$(JP.GRAND), SW / 2, 400, 80, '#ffe98a', '#000', 8, 'Bebas Neue, Impact, sans-serif');
  s.tt.needsUpdate = true;
}
function drawLinkTopper(x, g, t) {
  x.fillStyle = '#0a0202'; x.fillRect(0, 0, SW, 512);
  x.save(); x.shadowColor = '#ff7a10'; x.shadowBlur = 30; outlineText(x, 'FORTUNE LINK', SW / 2, 62, 86, lg(x, 0, 20, 0, 100, ['#ffe27a', '#ff6a10', '#a0100a']), '#2a0400', 12, 'Rye, serif'); x.restore();
  const row = (label, val, y, w, cx, col, sz) => { rr(x, cx - w / 2, y, w, sz + 26, 12); x.fillStyle = '#000'; x.fill(); x.lineWidth = 5; x.strokeStyle = col; x.stroke(); outlineText(x, fmt$(val), cx + 28, y + (sz + 26) / 2 + 2, sz, col, '#000', 6, 'Bebas Neue, Impact'); x.fillStyle = rg(x, cx - w / 2 + 34, y + (sz + 26) / 2, 4, 40, ['#fff6a0', '#f0b81a', '#a06a04']); x.beginPath(); x.arc(cx - w / 2 + 34, y + (sz + 26) / 2, 34, 0, 7); x.fill(); outlineText(x, label, cx - w / 2 + 34, y + (sz + 26) / 2, 15, col, '#000', 3); };
  row('GRAND', JP.GRAND, 120, 900, SW / 2, '#ff3a2a', 96);
  row('MAJOR', JP.MAJOR, 262, 820, SW / 2, '#3aff4a', 78);
  row('MINOR', JP.MINOR, 384, 470, SW / 2 - 250, '#3a8aff', 64); row('MINI', JP.MINI, 384, 470, SW / 2 + 250, '#ff9a1a', 64);
}
function drawJPBoard(t) {
  const b = dynamic.jpBoard, x = b.c.getContext('2d');
  x.fillStyle = '#050208'; x.fillRect(0, 0, 1024, 256);
  // LED dot texture
  const names = ['GRAND', 'MAJOR', 'MINOR', 'MINI'], cols = ['#ff3a5a', '#c07aff', '#5ac0ff', '#5aff8a'];
  names.forEach((n, i) => {
    const X = 20 + i * 250;
    x.fillStyle = cols[i]; x.font = '34px Bungee, Impact'; x.textAlign = 'center'; x.fillText(n, X + 115, 70);
    x.shadowColor = cols[i]; x.shadowBlur = 18; x.fillStyle = '#ffe98a'; x.font = '64px Bebas Neue, Impact'; x.fillText(fmt$(JP[n]), X + 115, 150); x.shadowBlur = 0;
  });
  x.fillStyle = '#ffd84a'; x.font = '26px Bungee, Impact'; x.textAlign = 'center';
  const msgs = ['LINKED PROGRESSIVE JACKPOTS', 'JACKPOTS QUOTED FOR A $2 BET', 'ANY MACHINE CAN WIN!', Game.state.event === 'jackpot' ? 'JACKPOT THURSDAY: DOUBLE INCREMENTS' : 'THINK! SET A LIMIT'];
  x.fillText(msgs[Math.floor(t / 3) % msgs.length], 512, 220);
  x.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < 256; y += 4) x.fillRect(0, y, 1024, 1.5);
  b.tex.needsUpdate = true;
}

// ---------- machine meshes ----------
let _cab, _deckMat, _spinMat, MGEO = null;
const _gameMats = {};
function gameMats(id) {
  if (_gameMats[id]) return _gameMats[id];
  const th = GAMES[id].theme;
  const topper = new THREE.MeshBasicMaterial({ map: shared[id].tt }); topper.color.setScalar(1.2);
  const belly = new THREE.MeshBasicMaterial({ map: shared[id].tt }); belly.color.setScalar(0.85);
  if (!MGEO) MGEO = {
    body: new RoundedBoxGeometry(0.66, 0.92, 0.62, 2, 0.04), deckBox: new THREE.BoxGeometry(0.66, 0.1, 0.36), head: new RoundedBoxGeometry(0.66, 0.8, 0.3, 2, 0.04), top: new RoundedBoxGeometry(0.62, 0.42, 0.22, 2, 0.04),
    strip: new THREE.BoxGeometry(0.015, 1.4, 0.03), crown: new THREE.BoxGeometry(0.62, 0.05, 0.2), topper: new THREE.PlaneGeometry(0.56, 0.28), belly: new THREE.PlaneGeometry(0.58, 0.29),
    bezH: new THREE.BoxGeometry(0.61, 0.012, 0.012), bezV: new THREE.BoxGeometry(0.012, 0.46, 0.012), bezB: new THREE.BoxGeometry(0.6, 0.012, 0.012), note: new THREE.BoxGeometry(0.12, 0.05, 0.04),
    ledge: new THREE.BoxGeometry(0.2, 0.025, 0.24), ashtray: new THREE.CylinderGeometry(0.06, 0.05, 0.03, 16), seat: new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18), back: new RoundedBoxGeometry(0.4, 0.35, 0.06, 2, 0.03),
    leg: new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8), base: new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), screen: new THREE.PlaneGeometry(0.58, 0.435), plate: new THREE.PlaneGeometry(0.6, 0.13), deck: new THREE.PlaneGeometry(0.62, 0.32), spin: new RoundedBoxGeometry(0.105, 0.135, 0.026, 3, 0.012)
  };
  // the panel between the screen and the deck: speaker grilles either side of the game's badge
  const pc = mkCanvas(512, 128), px = pc.getContext('2d'), G0 = GAMES[id];
  px.fillStyle = lg(px, 0, 0, 0, 128, ['#26262c', '#0e0e12']); px.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 512; i += 2) { px.fillStyle = `rgba(255,255,255,${0.012 + Math.random() * 0.02})`; px.fillRect(i, 0, 1, 128); }   // brushed metal
  for (const cx of [62, 450]) {
    const ring = px.createRadialGradient(cx, 64, 30, cx, 64, 50); ring.addColorStop(0, '#111'); ring.addColorStop(0.8, '#9a9aa4'); ring.addColorStop(1, '#2a2a30');
    px.fillStyle = ring; px.beginPath(); px.arc(cx, 64, 50, 0, 7); px.fill(); px.fillStyle = '#08080a'; px.beginPath(); px.arc(cx, 64, 42, 0, 7); px.fill();
    px.fillStyle = '#2c2c34'; for (let y = -38; y <= 38; y += 7) for (let x = -38; x <= 38; x += 7) if (x * x + y * y < 38 * 38) { px.beginPath(); px.arc(cx + x, 64 + y, 2.2, 0, 7); px.fill(); }
  }
  px.textAlign = 'center'; px.textBaseline = 'middle';
  px.fillStyle = 'rgba(0,0,0,.6)'; rr(px, 128, 22, 256, 84, 14); px.fill(); px.strokeStyle = th.frame; px.lineWidth = 3; rr(px, 128, 22, 256, 84, 14); px.stroke();
  px.font = 'bold 34px Bungee, Impact, sans-serif'; px.lineWidth = 6; px.strokeStyle = th.accent; px.strokeText(G0.name, 256, 56, 236); px.fillStyle = th.glow; px.fillText(G0.name, 256, 56, 236);
  px.font = 'bold 15px Inter, sans-serif'; px.fillStyle = th.text || '#fff'; px.fillText((G0.sub || '').toUpperCase(), 256, 90, 230);
  const plateT = new THREE.CanvasTexture(pc); plateT.colorSpace = THREE.SRGBColorSpace; plateT.anisotropy = maxAniso;
  const plate = new THREE.MeshBasicMaterial({ map: plateT }); plate.color.setScalar(0.9);
  return (_gameMats[id] = { plate, accent: new THREE.MeshBasicMaterial({ color: new THREE.Color(th.accent).multiplyScalar(1.5) }), bez: new THREE.MeshBasicMaterial({ color: new THREE.Color(th.frame).multiplyScalar(1.25) }), topper, belly });
}
function cabMat() { if (!_cab) { _cab = new THREE.MeshStandardMaterial({ color: 0x17171c, metalness: 0.65, roughness: 0.28 }); interiorMats.push(_cab); } return _cab; }
function spinMat() { return _spinMat || (_spinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.7, 0.55) })); }
// deck layout in canvas pixels (512 x 264); top of the canvas is the edge nearest the screen
const DECK_BTNS = [{ id: 'cash', x: 52, label: 'CASH', c: '#d8d8e0' }, { id: 'betdn', x: 132, label: 'BET −', c: '#5aa7f3' }, { id: 'betup', x: 212, label: 'BET +', c: '#5aa7f3' }, { id: 'gamble', x: 292, label: 'GAMBLE', c: '#ffd84a' }, { id: 'collect', x: 372, label: 'COLLECT', c: '#ffd84a' }];
function deckMat() {
  if (_deckMat) return _deckMat;
  const c = mkCanvas(512, 264), x = c.getContext('2d');
  x.fillStyle = lg(x, 0, 0, 0, 264, ['#1c1c22', '#0c0c10']); x.fillRect(0, 0, 512, 264);
  x.fillStyle = '#05050a'; rr(x, 14, 14, 484, 40, 8); x.fill();
  x.fillStyle = '#ff6a3a'; x.font = 'bold 22px Bungee, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(VENUE.deckLine, 256, 35, 470);
  for (const b of DECK_BTNS) {
    x.fillStyle = '#000'; rr(x, b.x - 37, 140, 74, 78, 12); x.fill();
    x.fillStyle = lg(x, 0, 146, 0, 212, ['#ffffff', b.c]); rr(x, b.x - 32, 145, 64, 66, 10); x.fill();
    x.fillStyle = '#111'; x.font = 'bold 15px Inter, sans-serif'; x.fillText(b.label, b.x, 179);
  }
  x.fillStyle = '#000'; rr(x, 403, 54, 104, 156, 16); x.fill();
  x.fillStyle = '#7dff9a'; x.font = 'bold 16px Inter, sans-serif'; x.fillText('SPIN', 455, 228);
  x.fillStyle = '#555'; x.font = '12px Inter, sans-serif'; x.textAlign = 'left'; x.fillText('Gambling Help 24/7 · Set a limit', 20, 248);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  _deckMat = new THREE.MeshBasicMaterial({ map: t }); _deckMat.color.setScalar(1.05);
  return _deckMat;
}
function deckHit(uv) {
  const px = uv.x * 512, py = (1 - uv.y) * 264;
  if (px > 400 && py > 50 && py < 214) return 'spin';
  for (const b of DECK_BTNS) if (Math.abs(px - b.x) < 38 && py > 138 && py < 220) return b.id;
  return null;
}
function buildMachineMesh(def, idx) {
  const g = GAMES[def.game], th = g.theme;
  const root = new THREE.Group(); root.position.copy(def.pos); root.rotation.y = def.ry; scene.add(root);
  const cab = cabMat(), gm = gameMats(def.game);
  root.updateMatrixWorld(true);
  const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; root.add(o); return o; };
  // static parts go into the shared static batch (merged per material across ALL machines)
  const addS = (geo, m, x, y, z, rx = 0) => { const lm = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), V3(1, 1, 1)); SB.addM(geo, m, new THREE.Matrix4().multiplyMatrices(root.matrixWorld, lm)); };
  const S = g.skin ? SLOTSKIN[def.game] : null, D = S ? S.dims : _STD_DIMS;
  addS(MGEO.body, cab, 0, 0.46, 0);
  addS(MGEO.deckBox, cab, 0, 0.98, 0.16, -0.25);
  if (S) skinHead(addS, S, gm); else {
  addS(MGEO.head, cab, 0, 1.42, -0.12);
  addS(MGEO.top, cab, 0, 2.08, -0.15);
  for (const sx of [-0.335, 0.335]) addS(MGEO.strip, gm.accent, sx, 1.45, 0.03);
  addS(MGEO.crown, gm.accent, 0, 2.32, -0.15);
  addS(MGEO.topper, gm.topper, 0, 2.08, -0.035);
  addS(MGEO.belly, gm.belly, 0, 0.6, 0.312);
  addS(MGEO.plate, gm.plate, 0, 1.148, 0.0315);
  for (const [x, y, k] of [[0, 1.664, 'bezH'], [0, 1.216, 'bezH'], [-0.299, 1.44, 'bezV'], [0.299, 1.44, 'bezV'], [0, 0.75, 'bezB'], [0, 0.45, 'bezB']]) addS(MGEO[k], gm.bez, x, y, y < 1 ? 0.312 : 0.044);
  }
  addS(MGEO.note, MAT.chrome, 0.2, 0.86, 0.32);
  addS(MGEO.ledge, MAT.darkWood, -0.45, 0.98, 0.18);
  if (def.smoke) { addS(MGEO.ashtray, MAT.chrome, 0.45, 0.99, 0.18); addS(MGEO.ledge, MAT.darkWood, 0.45, 0.965, 0.18); }
  // stool
  addS(MGEO.seat, MAT.vinylBlack, 0, 0.66, 0.82); addS(MGEO.back, MAT.vinylBlack, 0, 0.95, 1.02);
  addS(MGEO.leg, MAT.chrome, 0, 0.31, 0.82); addS(MGEO.base, MAT.chrome, 0, 0.015, 0.82);
  { const bm = new THREE.Matrix4().compose(V3(0, 0.005, 0.25), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), V3(1.0, 1.7, 1)); SB.addM(G.plane, MAT.blob, new THREE.Matrix4().multiplyMatrices(root.matrixWorld, bm)); }
  // live parts: the screen, the clickable deck and the pressable SPIN button
  const scrMat = new THREE.MeshBasicMaterial({ map: shared[def.game].at }); scrMat.color.setScalar(1.12);
  const scr = S ? skinScreen(add, S) : add(MGEO.screen, scrMat, 0, 1.44, 0.04, 0);
  const deck = add(MGEO.deck, deckMat(), 0, 1.0295, 0.1476, -Math.PI / 2 - 0.25);
  const spinB = new THREE.Mesh(MGEO.spin, spinMat()); spinB.position.set(0.241, 0, 0.012); deck.add(spinB);
  const btns = [deck, deck, deck, deck, deck, spinB];
  // world-space helpers
  const toW = (x, y, z) => new THREE.Vector3(x, y, z).applyEuler(new THREE.Euler(0, def.ry, 0)).add(def.pos);
  const fw = toW(0, 0, 1).sub(def.pos);
  addColBox(...(() => { const c = toW(0, 0, -0.02); const w = Math.abs(fw.x) > 0.5 ? 0.7 : 0.72, d = Math.abs(fw.x) > 0.5 ? 0.72 : 0.7; return [c.x - w / 2, c.x + w / 2, c.z - d / 2, c.z + d / 2]; })());
  const seatW = toW(0, 0, 0.82);
  const m = new Machine(def, idx, { root, scr, btns, deck, seatW, fw, ledge: toW(-0.45, 0.995, 0.18), ash: toW(0.45, 1.01, 0.18), screenW: toW(0, D.cy, 0.04), dims: D, ashLocal: V3(0.45, 1.01, 0.18) });
  MACHINES.push(m);
  addSpot({ kind: 'pokie', pos: seatW.clone(), ry: def.ry + Math.PI, sitH: 0.7, area: def.smoke ? 'terrace' : 'gaming', machine: m, smoke: def.smoke });
  addInteract({ id: 'machine' + idx, pos: toW(0, 1.3, 0.3), r: 1.7, label: () => m.occupiedBy ? `${g.name} ${g.sub} — in use` : `Sit at ${g.name} ${g.sub}${def.smoke ? '  (smoking area)' : ''}`, enabled: () => !m.occupiedBy, action: () => Game.sitAt(m) });
  return m;
}

// ---------- the machine ----------
class Machine {
  constructor(def, idx, parts) {
    Object.assign(this, parts);
    this.def = def; this.idx = idx; this.game = GAMES[def.game]; this.skin = this.game.skin ? SLOTSKIN[def.game] : null; this.mode = 'idle'; this.occupiedBy = null;
    this.credit = 0; this.betIdx = 1; this.state = 'ready'; this.t = 0; this.st = 0;
    this.reels = [0, 1, 2, 3, 4].map(() => ({ pos: 0, v: 0, strip: {}, phase: 'idle', t0: 0, p0: 0, P: 0, dur: 0, stopAt: 0 }));
    this.grid = null; this.wins = []; this.win = 0; this.shownWin = 0; this.msg = ''; this.particles = [];
    this.lastWin = 0; this.gambleAmt = 0; this.npcTimer = rand(2, 5);
    this.rand0();
  }
  get bet() { return BETS[this.betIdx]; }
  rand0() { const res = spinGrid(this.game, 1, false); this.grid = res.grid; this.res = res; for (let r = 0; r < 5; r++) { const R = this.reels[r]; R.pos = 100; R.strip = {}; for (let k = 0; k < 3; k++) R.strip[100 - k] = res.grid[r][k]; } }
  symAt(r, j) { const R = this.reels[r]; if (R.strip[j] == null) R.strip[j] = wpick(this.game.syms, reelWeights(this.game, r, this.free)); return R.strip[j]; }
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'idle') { this.scr.material.map = shared[this.def.game].at; }
    else {
      const res = mode === 'player' ? 1 : 0.5;
      if (!this.canvas || this.res_ !== res) { const S = this.skin; this.canvas = S ? mkCanvas(Math.round(S.mw * S.k * res), Math.round(S.mh * S.k * res)) : mkCanvas(SW * res, SH * res); this.ctx = this.canvas.getContext('2d'); this.tex = canvasTex(this.canvas, 1, 1); this.res_ = res; }
      this.scr.material.map = this.tex;
    }
    this.scr.material.needsUpdate = true;
  }
  // ---------------- spin flow ----------------
  canSpin() { return this.state === 'ready' || this.state === 'showWin'; }
  spin(free = false) {
    if (this.state === 'showWin') this.endShowWin();
    if (!this.canSpin() && !free) return false;
    const bet = this.bet;
    if (!free) {
      if (this.credit + 1e-9 < bet) { this.msg = 'INSERT CASH'; return false; }
      this.credit -= bet; this.wagered = (this.wagered || 0) + bet;
      const inc = Game.state.event === 'jackpot' ? 2 : 1;
      for (const k of JP_NAMES) JP[k] += bet * JP_INC[k] * inc;
      if (this.mode === 'player') Game.onPlayerBet(bet);
    }
    this.free = free;
    this.res = spinGrid(this.game, bet, free);
    this.lw = evalLines(this.game, this.res, bet, free);
    this.wins = this.lw.wins; this.win = this.lw.total; if (this.hotTip && this.mode === 'player' && this.win > 0 && (this.hotN = (this.hotN || 0) + 1) <= 25) this.win = Math.round(this.win * 1.1 * 100) / 100; this.shownWin = 0; this.winLineI = -1; this.lastWin = 0; this.gambleOK = false;
    // decide anticipation
    const trig = this.game.scatter || this.game.bonusSym;
    let antFrom = 9;
    if (trig) {
      let cnt = 0;
      for (let r = 0; r < 5; r++) { if (cnt >= 2 && antFrom === 9) antFrom = r; cnt += this.res.grid[r].filter(s => s === trig).length; }
      if (this.game.bonusSym === 'COIN') { let c = 0; for (let r = 0; r < 3; r++) c += this.res.grid[r].filter(s => s === 'COIN').length; antFrom = c >= 4 ? 3 : 9; }
    }
    const fast = this.mode === 'npc' ? 0.7 : 1;
    let t = 0.5 * fast;
    this.reels.forEach((R, r) => {
      R.phase = 'spin'; R.v = 0; R.t0 = this.t + r * 0.05; t += (r >= antFrom ? 1.1 : 0.22) * fast;
      R.stopAt = this.t + t; R.ant = r >= antFrom;
    });
    this.state = 'spinning'; this.msg = free ? '' : 'GOOD LUCK!';
    if (this.mode === 'player') SFX.button();
    return true;
  }
  slam() { if (this.state !== 'spinning') return; this.reels.forEach((R, r) => { if (R.phase === 'spin') R.stopAt = Math.min(R.stopAt, this.t + r * 0.04); }); }
  stopReel(r) {
    const R = this.reels[r];
    const P = Math.ceil(R.pos) + 5;
    for (let k = 0; k < 3; k++) R.strip[P - k] = this.res.grid[r][k];
    R.phase = 'stopping'; R.p0 = R.pos; R.P = P; R.ts = this.t; R.dur = 0.32;
  }
  update(dt) {
    this.t += dt;
    for (let r = 0; r < 5; r++) {
      const R = this.reels[r];
      if (R.phase === 'spin') {
        if (this.t < R.t0) { R.pos -= dt * 1.5; continue; }
        R.v = Math.min(R.v + dt * 90, R.ant ? 30 : 22); R.pos += R.v * dt;
        if (this.mode === 'player' && Math.random() < dt * 14) SFX.spinTick();
        if (this.mode === 'player' && R.ant && Math.random() < dt * 4) SFX.anticip(r * 2 + Math.floor((this.t * 4) % 4));
        if (this.t >= R.stopAt) this.stopReel(r);
      } else if (R.phase === 'stopping') {
        const k = clamp((this.t - R.ts) / R.dur, 0, 1);
        R.pos = R.p0 + (R.P - R.p0) * easeOutBack(k);
        if (k >= 1) {
          R.pos = R.P; R.phase = 'idle';
          if (this.mode === 'player') { SFX.reelStop(r); const trig = this.game.scatter || this.game.bonusSym; if (trig && this.res.grid[r].includes(trig)) SFX.tone(880 + r * 110, 0.25, { gain: 0.08, type: 'triangle' }); }
          else if (this.mode === 'npc' && Math.random() < 0.3) SFX.tone(150, 0.08, { gain: 0.03, pos: this.screenW });
        }
      }
    }
    if (this.state === 'spinning' && this.reels.every(R => R.phase === 'idle')) this.onStopped();
    this.updateState(dt);
    // particles (coin shower)
    for (const p of this.particles) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
    this.particles = this.particles.filter(p => p.y < SH + 60);
  }
  onStopped() {
    this.grid = this.res.grid;
    const g = this.game, bet = this.bet;
    // features
    let feat = null;
    if (g.feature === 'holdspin' && countSym(this.res, 'COIN').n >= 6) feat = 'holdspin';
    if (g.feature === 'freegames' && countSym(this.res, g.scatter).n >= 3) feat = this.free ? 'retrigger' : 'freegames';
    if (g.feature === 'wheel' && countSym(this.res, 'BONUS').n >= 3) feat = 'wheel';
    if (g.feature === 'pick' && countSym(this.res, g.scatter).n >= 3) feat = 'pick';
    if (!feat && !this.free && g.mystery && Math.random() < g.mystery) feat = 'mystery';
    let scatPay = 0;
    if (feat === 'freegames') scatPay = bet * [0, 0, 0, 2, 10, 50][Math.min(5, countSym(this.res, g.scatter).n)];
    if (feat === 'pick') scatPay = bet * [0, 0, 0, 3, 15, 60][Math.min(5, countSym(this.res, g.scatter).n)];
    if (this.free && countSym(this.res, g.scatter).n >= 3) scatPay = bet * 2;
    this.win += scatPay;
    if (this.free) { this.featWin += this.win; }
    if (feat === 'retrigger') { this.freeLeft += 5; this.flash('+5 FREE GAMES', 1.6); if (this.mode === 'player') SFX.fanfare(); }
    if (feat && feat !== 'retrigger') { this.pendingFeat = feat; this.state = 'featIntro'; this.st = 0; if (this.mode === 'player') { SFX.fanfare(); Game.onFeature(feat, this); } this.featBaseWin = this.win; return; }
    this.state = 'showWin'; this.st = 0;
    if (this.win > 0) {
      this.winLevel = this.win / bet;
      if (this.mode === 'player') { SFX.win(Math.min(4, Math.floor(Math.log2(1 + this.winLevel)))); if (this.winLevel >= 15 && !this.free) this.bigWin(); }
      else if (this.mode === 'npc') { if (this.winLevel > 4) SFX.chimeAt(this.screenW, 1.2); }
    } else if (!this.free) this.msg = this.credit < bet ? 'INSERT CASH' : 'PLAY AGAIN';
  }
  bigWin() {
    const lvl = this.winLevel >= 100 ? 'EPIC WIN' : this.winLevel >= 50 ? 'MEGA WIN' : 'BIG WIN';
    this.flash(lvl, 3.5); SFX.fanfare(); this.coinShower(80);
    Game.onBigWin(this, lvl); if (this.mode === 'player') PokieFX.celebrate(this.winLevel || 20);
  }
  coinShower(n) { for (let i = 0; i < n; i++) this.particles.push({ x: rand(0, SW), y: rand(-400, -20), vx: rand(-80, 80), vy: rand(0, 200), r: rand(0, 6), vr: rand(-8, 8), s: rand(18, 34) }); }
  flash(txt, dur) { this.flashTxt = txt; this.flashT = dur; this.flashT0 = dur; }
  endShowWin() {
    if (this.shownWin < this.win) this.shownWin = this.win;
    if (!this.free && this.win > 0 && !this.credited) { this.credit += this.win; this.credited = true; if (this.mode === 'player') Game.onPlayerWin(this.win); }
  }
  updateState(dt) {
    this.st += dt;
    if (this.flashT > 0) this.flashT -= dt;
    const bet = this.bet;
    if (this.state === 'showWin') {
      if (this.win > 0) {
        const rollDur = clamp(0.4 + Math.log2(1 + this.win / bet) * 0.6, 0.5, 6);
        const prev = this.shownWin; this.shownWin = Math.min(this.win, this.win * (this.st / rollDur));
        if (this.mode === 'player' && this.shownWin < this.win && Math.floor(prev * 20) !== Math.floor(this.shownWin * 20)) SFX.rollTick();
        if (this.wins.length) this.winLineI = Math.floor(this.st / 1.1) % (this.wins.length + 1) - 1;
        if (this.shownWin >= this.win && !this.credited && !this.free) { this.credited = true; this.credit += this.win; this.lastWin = this.win; this.gambleOK = this.mode === 'player'; if (this.mode === 'player') Game.onPlayerWin(this.win); }
        this.msg = this.free ? '' : 'WIN ' + fmt$(this.shownWin);
      }
      if (this.free && this.st > (this.win > 0 ? 1.6 : 0.6)) this.nextFree();
    } else this.credited = false;
    if (this.state === 'featIntro' && this.st > 2.2) this.startFeature();
    if (this.state === 'holdspin') this.updateHold(dt);
    if (this.state === 'wheel') this.updateWheel(dt);
    if (this.state === 'pick') this.updatePick(dt);
    if (this.state === 'featOutro') {
      const total = this.featTotal, dur = clamp(1 + Math.log2(1 + total / bet) * 0.6, 1.5, 7);
      const prev = this.shownWin; this.shownWin = Math.min(total, total * this.st / dur);
      if (this.mode === 'player' && Math.floor(prev * 10) !== Math.floor(this.shownWin * 10)) SFX.rollTick();
      if (this.st > dur + 2.2) { this.credit += total; if (this.mode === 'player') Game.onPlayerWin(total, true); this.win = total; this.shownWin = total; this.credited = true; this.state = 'showWin'; this.st = 99; this.free = false; this.wins = []; this.msg = 'FEATURE WIN ' + fmt$(total); this.lastWin = total; this.gambleOK = false; if (this.mode === 'player' && total / bet >= 15) { this.winLevel = total / bet; this.bigWin(); } }
    }
    if (this.state === 'gamble' && this.gambleRes && this.st > 1.6) {
      const r = this.gambleRes; this.gambleRes = null;
      if (r.win) { this.gambleAmt *= 2; this.gambleN++; if (this.gambleN >= 5) this.takeGamble(); }
      else { this.gambleAmt = 0; this.state = 'ready'; this.msg = 'GAMBLE LOST'; this.lastWin = 0; }
    }
  }
  // ---------------- free games ----------------
  nextFree() {
    if (this.freeLeft > 0) { this.freeLeft--; this.freeN++; this.spin(true); }
    else { this.featTotal = this.featWin; this.state = 'featOutro'; this.st = 0; this.shownWin = 0; this.free = false; }
  }
  startFeature() {
    const f = this.pendingFeat, bet = this.bet; this.pendingFeat = null; this.st = 0;
    this.featTotal = this.featBaseWin || 0;
    if (f === 'freegames') { this.freeLeft = [0, 0, 0, 8, 12, 20][Math.min(5, countSym(this.res, this.game.scatter).n)]; this.freeN = 0; this.featWin = this.win; this.state = 'showWin'; this.free = true; this.win = 0; this.st = 99; }
    else if (f === 'holdspin') { this.hs = playHoldSpin(this.game, bet, this.res); this.hs.cells0 = []; for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) this.hs.cells0.push(this.res.coins[r][row]); this.hs.shown = this.hs.cells0.slice(); this.hs.step = 0; this.hs.respins = 3; this.hs.t = -1; this.hs.collect = -1; this.state = 'holdspin'; }
    else if (f === 'wheel') { this.wh = playWheel(bet); this.wh.ang = 0; const segA = Math.PI * 2 / 16; this.wh.target = Math.PI * 2 * 6 + this.wh.idx * segA; this.wh.dur = 6; this.wh.done = false; this.wh.lastSeg = 0; this.state = 'wheel'; }
    else if (f === 'pick' || f === 'mystery') { this.pk = playPick(bet, f === 'mystery'); this.pk.tiles = new Array(12).fill(null); this.pk.n = 0; this.pk.done = false; this.pk.mystery = f === 'mystery'; this.state = 'pick'; this.pk.autoT = this.mode === 'npc' ? 0.6 : 999; }
  }
  // ---------------- hold & spin ----------------
  updateHold(dt) {
    const h = this.hs;
    h.t += dt;
    if (h.collect < 0) {
      if (h.t >= 1.15) {
        h.t = 0;
        if (h.step < h.steps.length) {
          const s = h.steps[h.step++];
          for (const l of s.landed) { h.shown[l.idx] = l.val; }
          h.respins = s.respins; h.lastLanded = s.landed.map(l => l.idx); h.landT = 0;
          if (this.mode === 'player') { if (s.landed.length) { s.landed.forEach((l, i) => SFX.coin()); SFX.tone(660, 0.2, { gain: 0.1, type: 'triangle' }); } else SFX.tone(200, 0.15, { gain: 0.06 }); }
        } else { h.collect = 0; h.ct = 0; h.acc = 0; }
      }
      h.landT = (h.landT || 0) + dt;
    } else {
      h.ct += dt;
      if (h.ct > 0.28) {
        h.ct = 0;
        while (h.collect < 15 && !h.shown[h.collect]) h.collect++;
        if (h.collect < 15) {
          const c = h.shown[h.collect];
          const v = c.jp ? JP[c.jp] * jpFactor(this.bet) : c.m * this.bet;
          if (c.jp) this.awardJP(c.jp);
          h.acc += v; h.collect++;
          if (this.mode === 'player') SFX.coin();
        } else {
          if (h.full) { const v = JP.GRAND * jpFactor(this.bet); this.awardJP('GRAND'); h.acc += v; }
          this.featTotal += h.acc; this.state = 'featOutro'; this.st = 0; this.shownWin = 0;
        }
      }
    }
  }
  awardJP(name) {
    const amt = JP[name] * jpFactor(this.bet);
    JP[name] = JP_SEED[name] * (0.95 + Math.random() * 0.1);
    this.flash(name + ' JACKPOT!', 3); this.coinShower(name === 'MINI' ? 30 : 120);
    Game.onJackpot(this, name, amt);
    return amt;
  }
  // ---------------- wheel ----------------
  updateWheel(dt) {
    const w = this.wh;
    if (!w.done) {
      const k = clamp(this.st / w.dur, 0, 1);
      w.ang = w.target * easeOut(Math.min(1, k * 1.0)) ;
      const seg = Math.floor((w.ang / (Math.PI * 2 / 16)) + 0.5);
      if (seg !== w.lastSeg) { w.lastSeg = seg; if (this.mode === 'player') SFX.tone(1800, 0.03, { gain: 0.05, type: 'square' }); }
      if (k >= 1) { w.done = true; w.doneT = this.st; if (w.seg.jp) w.jpAmt = this.awardJP(w.seg.jp); else if (this.mode === 'player') SFX.win(3); }
    } else if (this.st - w.doneT > 2.5) {
      this.featTotal += w.seg.jp ? (w.jpAmt || 0) : w.credit; this.state = 'featOutro'; this.st = 0; this.shownWin = 0;
    }
  }
  // ---------------- pick ----------------
  pickTile(i) {
    const p = this.pk; if (!p || p.done || p.tiles[i]) return;
    p.tiles[i] = { v: p.seq[p.n++], t: 0 };
    if (this.mode === 'player') SFX.tone(700 + p.n * 60, 0.2, { gain: 0.1, type: 'triangle' });
    if (p.n >= p.seq.length) {
      p.done = true; p.doneT = this.st;
      // reveal remaining
      let ri = 0; for (let k = 0; k < 12; k++) if (!p.tiles[k]) p.tiles[k] = { v: p.rest[ri++] || 'MINI', t: 0, dim: true };
    }
  }
  updatePick(dt) {
    const p = this.pk;
    p.tiles.forEach(t => { if (t) t.t += dt; });
    if (!p.done) { p.autoT -= dt; if (p.autoT <= 0) { p.autoT = this.mode === 'npc' ? 0.5 : 999; const free = p.tiles.map((t, i) => t ? -1 : i).filter(i => i >= 0); this.pickTile(choice(free)); } }
    else if (!p.awarded && this.st - p.doneT > 0.8) { p.awarded = true; const amt = this.awardJP(p.win); this.featTotal += amt + p.credit; }
    else if (p.awarded && this.st - p.doneT > 3.4) { this.state = 'featOutro'; this.st = 0; this.shownWin = 0; }
  }
  // ---------------- gamble ----------------
  startGamble() { if (!this.gambleOK || this.lastWin <= 0 || this.state !== 'showWin') return; this.credit -= this.lastWin; this.gambleAmt = this.lastWin; this.gambleN = 0; this.state = 'gamble'; this.st = 0; this.gambleHist = this.gambleHist || []; this.gambleOK = false; this.gambleRes = null; this.msg = 'PICK RED OR BLACK'; }
  gamble(color) {
    if (this.state !== 'gamble' || this.gambleRes) return;
    const suit = choice(['♥', '♦', '♣', '♠']), red = suit === '♥' || suit === '♦';
    const win = (color === 'red') === red;
    this.gambleRes = { suit, red, win, card: choice(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) };
    this.gambleHist.unshift(suit); this.gambleHist = this.gambleHist.slice(0, 6); this.st = 0;
    if (win) { SFX.win(2); this.msg = 'WIN ' + fmt$(this.gambleAmt * 2); } else { SFX.tone(160, 0.5, { gain: 0.12, type: 'sawtooth', fEnd: 80 }); this.msg = 'BAD LUCK'; }
    Game.onGamble(win, this.gambleAmt);
  }
  takeGamble() { if (this.state !== 'gamble' || this.gambleRes) return; this.credit += this.gambleAmt; Game.onPlayerWin(this.gambleAmt, false, true); this.msg = 'COLLECTED ' + fmt$(this.gambleAmt); this.lastWin = 0; this.gambleAmt = 0; this.state = 'ready'; SFX.coin(); }

  // ---------------- NPC autoplay ----------------
  npcTick(dt) {
    this.update(dt);
    if (this.state === 'ready' || (this.state === 'showWin' && this.st > 1.8)) {
      this.npcTimer -= dt;
      if (this.npcTimer <= 0) { this.npcTimer = rand(1.0, 3.0); if (this.credit < this.bet) this.credit += choice([20, 20, 50]); this.spin(); }
    }
  }

  // =================== RENDER ===================
  draw() {
    if (this.mode === 'idle') return;
    if (this.skin) return this.drawSkin();
    const x = this.ctx, sc = this.res_;
    x.setTransform(sc, 0, 0, sc, 0, 0);
    const g = this.game, t = this.t, bet = this.bet;
    drawBG(x, g, t);
    drawLogo(x, g, SW / 2, 42, 0.7, t);
    drawJackpotBar(x, g, bet, t);
    if (this.state === 'holdspin') this.drawHold(x);
    else if (this.state === 'wheel') this.drawWheel(x);
    else if (this.state === 'pick') this.drawPick(x);
    else if (this.state === 'gamble') this.drawGamble(x);
    else this.drawReels(x);
    if (this.state === 'featIntro') {
      const k = clamp(this.st / 0.4, 0, 1);
      x.fillStyle = `rgba(0,0,0,${0.55 * k})`; x.fillRect(0, RY, SW, CH * 3);
      const names = { holdspin: 'HOLD & SPIN', freegames: 'FREE GAMES', wheel: 'JACKPOT WHEEL', pick: 'TREASURE PICK', mystery: 'MYSTERY JACKPOT' };
      x.save(); x.translate(SW / 2, RY + CH * 1.5); x.scale(0.5 + easeOutBack(k) * 0.5, 0.5 + easeOutBack(k) * 0.5);
      x.shadowColor = g.theme.glow; x.shadowBlur = 40; outlineText(x, names[this.pendingFeat] || 'FEATURE', 0, -20, 92, lg(x, 0, -60, 0, 40, ['#fff', g.theme.glow, g.theme.accent]), '#1a0802', 14); x.shadowBlur = 0;
      outlineText(x, 'TRIGGERED!', 0, 70, 50, '#fff', '#000', 8);
      x.restore();
    }
    if (this.state === 'featOutro') {
      x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(0, RY, SW, CH * 3);
      outlineText(x, 'FEATURE COMPLETE', SW / 2, RY + 120, 60, g.theme.glow, '#000', 10);
      x.shadowColor = '#ffb000'; x.shadowBlur = 30; outlineText(x, fmt$(this.shownWin), SW / 2, RY + 260, 110, lg(x, 0, RY + 200, 0, RY + 320, ['#fff', '#ffe27a', '#ff9d00']), '#3a1a00', 12, 'Bebas Neue, Impact'); x.shadowBlur = 0;
    }
    if (this.free && this.state !== 'featOutro') {
      rr(x, SW / 2 - 230, RY - 6, 460, 46, 12); x.fillStyle = 'rgba(0,0,0,.75)'; x.fill(); x.strokeStyle = g.theme.frame; x.lineWidth = 3; x.stroke();
      outlineText(x, `FREE GAME ${this.freeN} OF ${this.freeN + this.freeLeft}   ·   ${fmt$(this.featWin || 0)}`, SW / 2, RY + 17, 26, '#fff', '#000', 5);
    }
    this.drawInfo(x);
    // flash text
    if (this.flashT > 0) {
      const k = 1 - this.flashT / this.flashT0, s = k < 0.15 ? easeOutBack(k / 0.15) : 1, a = this.flashT < 0.4 ? this.flashT / 0.4 : 1;
      x.save(); x.globalAlpha = a; x.translate(SW / 2, SH / 2 - 20); x.scale(s, s); x.rotate(Math.sin(this.t * 6) * 0.03);
      x.shadowColor = '#ff9d00'; x.shadowBlur = 50; outlineText(x, this.flashTxt, 0, 0, 120, lg(x, 0, -60, 0, 60, ['#fff', '#ffe27a', '#ff7a00']), '#3a1000', 16); x.restore();
    }
    for (const p of this.particles) { x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(Math.cos(p.r * 2), 1); x.fillStyle = rg(x, -4, -4, 1, p.s, ['#fffbe0', '#ffd84a', '#a86a08']); x.beginPath(); x.arc(0, 0, p.s / 2, 0, 7); x.fill(); x.strokeStyle = '#6a4004'; x.lineWidth = 2; x.stroke(); x.restore(); }
    this.tex.needsUpdate = true;
  }
  drawReels(x) {
    const g = this.game, cache = symCache[g.id];
    // reel window
    if (!this.skin) { rr(x, RX - 14, RY - 10, CW * 5 + 28, CH * 3 + 20, 18); x.fillStyle = g.theme.frame; x.fill(); rr(x, RX - 6, RY - 4, CW * 5 + 12, CH * 3 + 8, 12); x.fillStyle = '#000'; x.fill(); }
    const showing = this.state === 'showWin' && this.win > 0 && this.wins.length;
    const cur = showing && this.winLineI >= 0 ? this.wins[this.winLineI] : null;
    const hot = new Set();
    if (showing) { const list = cur ? [cur] : this.wins; for (const w of list) for (let r = 0; r < w.n; r++) hot.add(r * 3 + LINES[w.line][r]); }
    for (let r = 0; r < 5; r++) {
      const R = this.reels[r], X = RX + r * CW;
      x.fillStyle = this.skin ? lg(x, 0, RY, 0, RY + CH * 3, [this.skin.strip[0], this.skin.strip[1], this.skin.strip[0]]) : lg(x, 0, RY, 0, RY + CH * 3, ['#1a1a24', '#2c2c3a', '#1a1a24']); x.fillRect(X, RY, CW - 4, CH * 3);
      if (R.ant && R.phase !== 'idle') { x.fillStyle = `rgba(255,200,40,${0.25 + 0.2 * Math.sin(this.t * 20)})`; x.fillRect(X, RY, CW - 4, CH * 3); }
      x.save(); x.beginPath(); x.rect(X, RY, CW - 4, CH * 3); x.clip();
      const fast = R.phase === 'spin' && R.v > 8;
      const base = Math.floor(R.pos);
      for (let j = base + 1; j >= base - 3; j--) {
        const y = RY + (R.pos - j) * CH;
        if (y < RY - CH || y > RY + CH * 3) continue;
        const s = this.symAt(r, j), img = cache[s][fast ? 'blur' : 'sharp'];
        const row = Math.round(R.pos - j);
        const isHot = R.phase === 'idle' && hot.has(r * 3 + row);
        if (isHot) {
          const pulse = 1 + Math.sin(this.t * 10) * 0.06;
          x.save(); x.translate(X + CW / 2 - 2, y + CH / 2); x.scale(pulse, pulse);
          x.shadowColor = g.theme.glow; x.shadowBlur = 30; x.drawImage(img, -CW / 2, -CH / 2); x.restore();
        } else {
          if (showing && R.phase === 'idle') x.globalAlpha = 0.45;
          x.drawImage(img, X - 2, y);
          x.globalAlpha = 1;
        }
        // coin values (hold & spin game) on nuggets
        if (s === 'COIN' && R.phase === 'idle' && this.res && row >= 0 && row < 3 && this.res.coins[r][row]) {
          const c = this.res.coins[r][row];
          if (this.skin) outlineText(x, c.jp || String(Math.round(c.m * this.bet * 100)), X + CW / 2 - 2, y + CH / 2 + 4, c.jp ? 28 : 54, c.jp ? '#ff4a6a' : '#1b0b04', '#ffd84a', 3, c.jp ? 'Bungee, Impact' : 'Bebas Neue, Impact');
          else outlineText(x, c.jp || fmt$(c.m * this.bet), X + CW / 2 - 2, y + CH / 2 + 4, c.jp ? 28 : 30, c.jp ? '#ff4a6a' : '#fff', '#3a1a00', 6, c.jp ? 'Bungee, Impact' : 'Bebas Neue, Impact');
        }
        if (s === 'WILD' && this.free && this.res && row >= 0 && row < 3 && this.res.mults[r][row] > 1 && R.phase === 'idle') {
          rr(x, X + CW - 70, y + 6, 60, 40, 10); x.fillStyle = '#c00'; x.fill(); outlineText(x, 'x' + this.res.mults[r][row], X + CW - 40, y + 27, 28, '#fff', '#000', 5);
        }
      }
      x.restore();
      // reel shading
      x.fillStyle = lg(x, 0, RY, 0, RY + CH * 3, ['rgba(0,0,0,.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.55)']); x.fillRect(X, RY, CW - 4, CH * 3);
    }
    // win lines
    if (showing) {
      const list = cur ? [cur] : this.wins;
      for (const w of list) {
        const L = LINES[w.line], col = `hsl(${(w.line * 47) % 360},100%,60%)`;
        x.lineWidth = 7; x.strokeStyle = col; x.shadowColor = col; x.shadowBlur = 16; x.lineJoin = 'round';
        x.beginPath(); for (let r = 0; r < 5; r++) { const px = RX + r * CW + CW / 2 - 2, py = RY + L[r] * CH + CH / 2; if (r === 0) x.moveTo(px - CW / 2, py); x.lineTo(px, py); if (r === 4) x.lineTo(px + CW / 2, py); } x.stroke(); x.shadowBlur = 0;
        for (let r = 0; r < w.n; r++) { x.lineWidth = 5; x.strokeRect(RX + r * CW + 4, RY + L[r] * CH + 6, CW - 12, CH - 12); }
      }
      if (cur) { rr(x, SW / 2 - 200, RY + CH * 3 - 54, 400, 46, 10); x.fillStyle = 'rgba(0,0,0,.8)'; x.fill(); outlineText(x, `LINE ${cur.line + 1}: ${cur.n} × ${cur.sym} = ${fmt$(cur.pay)}`, SW / 2, RY + CH * 3 - 31, 24, '#fff', '#000', 4); }
    }
  }
  drawInfo(x) {
    const g = this.game;
    x.fillStyle = lg(x, 0, 660, 0, SH, ['#111', '#000']); x.fillRect(0, 660, SW, SH - 660);
    x.fillStyle = g.theme.frame; x.fillRect(0, 660, SW, 4);
    const cols = [['CREDIT', fmt$(this.credit)], ['BET · 25 LINES', fmt$(this.bet)], ['WIN', fmt$(this.state === 'gamble' ? this.gambleAmt : (this.shownWin || 0))]];
    cols.forEach(([l, v], i) => { const X = 30 + i * 330; x.fillStyle = '#ffcf4a'; x.font = '22px Bungee, Impact'; x.textAlign = 'left'; x.fillText(l, X, 698); x.fillStyle = '#fff'; x.font = '48px Bebas Neue, Impact'; x.fillText(v, X, 744); });
    const showMsg = this.msg && (this.state === 'ready' || this.state === 'gamble' || (this.state === 'showWin' && !(this.win > 0 && this.wins.length && this.winLineI >= 0)));
    if (showMsg && !this.free) { rr(x, SW / 2 - 210, RY + CH * 3 - 50, 420, 40, 10); x.fillStyle = 'rgba(0,0,0,.72)'; x.fill(); outlineText(x, this.msg, SW / 2, RY + CH * 3 - 30, 24, '#8aff9a', '#000', 4); }
  }
  drawHold(x) {
    const g = this.game, h = this.hs, cache = symCache[g.id];
    if (!this.skin) { rr(x, RX - 14, RY - 10, CW * 5 + 28, CH * 3 + 20, 18); x.fillStyle = g.theme.frame; x.fill(); } else { x.fillStyle = '#2a1004'; x.fillRect(RX - 8, RY - 6, CW * 5 + 12, CH * 3 + 12); }
    for (let i = 0; i < 15; i++) {
      const r = Math.floor(i / 3), row = i % 3, X = RX + r * CW, Y = RY + row * CH, c = h.shown[i];
      x.fillStyle = c ? '#3a1a04' : '#0a0a12'; x.fillRect(X, Y, CW - 4, CH - 4);
      if (c) {
        const isNew = h.lastLanded && h.lastLanded.includes(i) && h.landT < 0.5;
        const sc = isNew ? easeOutBack(clamp(h.landT / 0.35, 0, 1)) : 1;
        const col = h.collect >= 0 && i < h.collect;
        x.save(); x.translate(X + CW / 2 - 2, Y + CH / 2); x.scale(sc, sc); x.globalAlpha = col ? 0.35 : 1;
        x.shadowColor = '#ffd84a'; x.shadowBlur = 20; x.drawImage(cache.COIN.sharp, -CW / 2, -CH / 2); x.shadowBlur = 0;
        if (this.skin) outlineText(x, c.jp || String(Math.round(c.m * this.bet * 100)), 0, 4, c.jp ? 28 : 56, c.jp ? '#ff4a6a' : '#1b0b04', '#ffd84a', 3, c.jp ? 'Bungee, Impact' : 'Bebas Neue, Impact');
        else outlineText(x, c.jp || fmt$(c.m * this.bet), 0, 4, c.jp ? 28 : 34, c.jp ? '#ff4a6a' : '#fff', '#3a1a00', 6, c.jp ? 'Bungee, Impact' : 'Bebas Neue, Impact');
        x.restore();
      } else if (h.collect < 0) {
        // spinning blank cells
        const s = cache[choice(['COIN', 'COIN', g.syms[0]])].blur; x.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 30 + i); x.drawImage(s, X - 2, Y + ((this.t * 900 + i * 50) % CH) - CH / 2); x.globalAlpha = 1;
      }
    }
    const bw = g.link ? 820 : 400; if (!this.skin) rr(x, SW / 2 - bw / 2, RY + CH * 3 + 14, bw, 50, 12); else rr(x, SW / 2 - bw / 2, RY + CH * 3 - 40, bw, 38, 12); x.fillStyle = 'rgba(0,0,0,.8)'; x.fill(); x.strokeStyle = g.theme.frame; x.lineWidth = 3; x.stroke();
    const ty = this.skin ? RY + CH * 3 - 21 : RY + CH * 3 + 40;
    if (h.collect < 0) outlineText(x, g.link ? `${this.skin ? '' : h.shown.filter(Boolean).length + ' COLLECTED · 15 WINS THE GRAND · '}RESPINS ${h.respins}` : `RESPINS: ${h.respins}`, SW / 2, ty, g.link ? 24 : 30, h.respins === 3 ? '#8aff9a' : '#fff', '#000', 5);
    else outlineText(x, `COLLECTING: ${fmt$(h.acc || 0)}`, SW / 2, ty, 30, '#ffe27a', '#000', 5);
  }
  drawWheel(x) {
    const g = this.game, w = this.wh, cx = SW / 2, cy = RY + 250, R = 230;
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, RY - 10, SW, CH * 3 + 20);
    x.save(); x.translate(cx, cy); x.rotate(-w.ang);
    const segA = Math.PI * 2 / 16;
    WHEEL_SEGS.forEach((s, i) => {
      const a0 = -Math.PI / 2 + (i - 0.5) * segA;
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, a0, a0 + segA); x.closePath();
      x.fillStyle = s.jp ? ({ MINI: '#2a9a4a', MINOR: '#2a6aca', MAJOR: '#8a2aca', GRAND: '#d01a3a' })[s.jp] : (i % 2 ? '#f2f2f8' : '#ffd84a'); x.fill();
      x.strokeStyle = '#333'; x.lineWidth = 2; x.stroke();
      x.save(); x.rotate(a0 + segA / 2); x.translate(R * 0.66, 0); x.rotate(Math.PI / 2);
      x.font = s.jp ? '22px Bungee, Impact' : '30px Bebas Neue, Impact'; x.fillStyle = s.jp ? '#fff' : '#222'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(s.jp || fmt$(s.m * this.bet), 0, 0); x.restore();
    });
    for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (i - 0.5) * segA; x.fillStyle = (Math.floor(this.t * 6) + i) % 2 ? '#fff' : '#ffd84a'; x.beginPath(); x.arc(Math.cos(a) * (R + 8), Math.sin(a) * (R + 8), 6, 0, 7); x.fill(); }
    x.lineWidth = 10; x.strokeStyle = g.theme.frame; x.beginPath(); x.arc(0, 0, R + 4, 0, 7); x.stroke();
    x.restore();
    x.fillStyle = rg(x, cx - 10, cy - 10, 4, 50, ['#fff', '#ffd84a', '#a86a08']); x.beginPath(); x.arc(cx, cy, 44, 0, 7); x.fill();
    outlineText(x, 'SPIN', cx, cy + 2, 26, '#c00', '#fff', 3);
    // pointer
    x.fillStyle = '#ff2a4a'; x.beginPath(); x.moveTo(cx - 22, cy - R - 30); x.lineTo(cx + 22, cy - R - 30); x.lineTo(cx, cy - R + 14); x.closePath(); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke();
    if (w.done) { const s = w.seg; outlineText(x, s.jp ? s.jp + '!' : fmt$(w.credit), SW / 2, RY + 470, 70, '#ffe27a', '#000', 10); }
  }
  drawPick(x) {
    const g = this.game, p = this.pk;
    x.fillStyle = 'rgba(0,10,30,.6)'; x.fillRect(0, RY - 10, SW, CH * 3 + 20);
    outlineText(x, p.mystery ? 'MYSTERY JACKPOT — PICK TO MATCH 3' : 'PICK THE PEARLS — MATCH 3 TO WIN', SW / 2, RY + 18, 30, g.theme.glow, '#000', 6);
    const jcol = { MINI: '#4ae07a', MINOR: '#3ab0ff', MAJOR: '#b05aff', GRAND: '#ff3a5a' };
    const counts = { MINI: 0, MINOR: 0, MAJOR: 0, GRAND: 0 }; p.tiles.forEach(t => { if (t && !t.dim) counts[t.v]++; });
    for (let i = 0; i < 12; i++) {
      const cx = RX + 70 + (i % 6) * 154, cy = RY + 120 + Math.floor(i / 6) * 190, t = p.tiles[i];
      if (!t) {
        const bob = Math.sin(this.t * 2 + i) * 6;
        x.fillStyle = rg(x, cx - 18, cy - 18 + bob, 4, 64, ['#ffffff', '#e8e0ff', '#9a8ac8', '#3a2a6a']); x.beginPath(); x.arc(cx, cy + bob, 58, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.ellipse(cx - 20, cy - 22 + bob, 14, 8, -0.6, 0, 7); x.fill();
        outlineText(x, '?', cx, cy + bob + 4, 44, '#5a3a9a', '#fff', 4);
      } else {
        const s = easeOutBack(clamp(t.t / 0.35, 0, 1)), win = p.done && t.v === p.win && !t.dim;
        x.save(); x.translate(cx, cy); x.scale(s, s); x.globalAlpha = t.dim ? 0.35 : 1;
        if (win) { x.shadowColor = jcol[t.v]; x.shadowBlur = 40 + Math.sin(this.t * 10) * 15; }
        x.fillStyle = rg(x, -10, -10, 4, 64, ['#fff', jcol[t.v], '#111']); x.beginPath(); x.arc(0, 0, 60, 0, 7); x.fill(); x.shadowBlur = 0;
        x.lineWidth = 4; x.strokeStyle = '#fff'; x.stroke();
        outlineText(x, t.v, 0, 4, 24, '#fff', '#000', 5);
        x.restore();
      }
    }
    const tip = p.done ? `${p.win} JACKPOT  ${fmt$(JP[p.win] * jpFactor(this.bet))}${p.credit ? ' + ' + fmt$(p.credit) + ' BONUS' : ''}` : (this.mode === 'player' ? 'CLICK A PEARL ON THE SCREEN (or press SPIN)' : '');
    outlineText(x, tip, SW / 2, RY + CH * 3 - 6, 28, '#fff', '#000', 5);
  }
  drawGamble(x) {
    const g = this.game, r = this.gambleRes;
    x.fillStyle = 'rgba(0,30,10,.85)'; x.fillRect(0, RY - 10, SW, CH * 3 + 20);
    outlineText(x, 'GAMBLE — RED OR BLACK DOUBLES YOUR WIN', SW / 2, RY + 24, 30, '#fff', '#000', 6);
    const cx = SW / 2, cy = RY + 250;
    rr(x, cx - 100, cy - 140, 200, 280, 18);
    if (r && this.st > 0.3) {
      x.fillStyle = '#fafafa'; x.fill(); x.strokeStyle = '#333'; x.lineWidth = 4; x.stroke();
      x.fillStyle = r.red ? '#d01a2a' : '#111'; x.font = '120px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(r.suit, cx, cy + 20);
      x.font = 'bold 48px Georgia, serif'; x.fillText(r.card, cx - 60, cy - 95);
    } else {
      x.fillStyle = (Math.floor(this.t * 4) % 2) ? '#b01a2a' : '#1a1a2a'; x.fill(); x.strokeStyle = '#ffd84a'; x.lineWidth = 6; x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 2; for (let i = 0; i < 10; i++) { x.beginPath(); x.moveTo(cx - 90, cy - 130 + i * 28); x.lineTo(cx + 90, cy - 102 + i * 28); x.stroke(); }
    }
    outlineText(x, 'HISTORY', 170, RY + 120, 22, '#ffd84a', '#000', 4);
    (this.gambleHist || []).forEach((s, i) => { x.fillStyle = (s === '♥' || s === '♦') ? '#ff3a4a' : '#ddd'; x.font = '40px Georgia, serif'; x.textAlign = 'center'; x.fillText(s, 120 + (i % 3) * 50, RY + 180 + Math.floor(i / 3) * 56); });
    outlineText(x, 'GAMBLE AMOUNT', SW - 190, RY + 120, 22, '#ffd84a', '#000', 4);
    outlineText(x, fmt$(this.gambleAmt), SW - 190, RY + 180, 50, '#fff', '#000', 6, 'Bebas Neue, Impact');
    outlineText(x, 'TO WIN ' + fmt$(this.gambleAmt * 2), SW - 190, RY + 230, 24, '#8aff9a', '#000', 4);
  }
}

// ---- src/06-actors.js ----

// =====================================================================
//  DRINKS: liquid shader (world-plane clip + back-face surface trick)
// =====================================================================
const DRINKS = {
  pot:      { name: 'Pot of Golden Lager', short: 'pot', price: 6.5, std: 0.9, h: 0.118, rb: 0.026, rt: 0.035, col: [0.95, 0.55, 0.08], col2: [0.55, 0.25, 0.02], foam: 0.012, beer: true },
  schooner: { name: 'Schooner of Southerly Bitter', short: 'schooner', price: 9.5, std: 1.4, h: 0.15, rb: 0.029, rt: 0.04, col: [0.9, 0.45, 0.06], col2: [0.45, 0.18, 0.02], foam: 0.014, beer: true },
  pint:     { name: "Pint of Drover's Draught", short: 'pint', price: 12.5, std: 2.0, h: 0.165, rb: 0.032, rt: 0.045, col: [0.85, 0.38, 0.05], col2: [0.4, 0.14, 0.01], foam: 0.016, beer: true },
  pale:     { name: 'Larrikin Pale Ale (schooner)', short: 'pale', price: 10.5, std: 1.5, h: 0.15, rb: 0.029, rt: 0.04, col: [1.0, 0.62, 0.18], col2: [0.7, 0.35, 0.06], foam: 0.016, beer: true, cloudy: 0.5 },
  scotch:   { name: 'Scotch on the rocks', short: 'scotch', price: 12, std: 1.1, h: 0.088, rb: 0.037, rt: 0.041, col: [0.85, 0.42, 0.08], col2: [0.5, 0.2, 0.02], foam: 0.0, beer: false, spirit: 'scotch', ice: 3, pourTo: 0.45 },
  bourbon:  { name: 'Bourbon & Coke', short: 'bourbon & coke', price: 11, std: 1.2, h: 0.135, rb: 0.033, rt: 0.035, col: [0.3, 0.1, 0.03], col2: [0.09, 0.03, 0.0], foam: 0.0, beer: false, spirit: 'bourbon', mixer: 'coke', ice: 4, pourTo: 0.2 },
  rum:      { name: 'Rum & Coke', short: 'rum & coke', price: 11, std: 1.2, h: 0.135, rb: 0.033, rt: 0.035, col: [0.25, 0.08, 0.02], col2: [0.08, 0.02, 0.0], foam: 0.0, beer: false, spirit: 'rum', mixer: 'coke', ice: 4, pourTo: 0.2 },
  vodka:    { name: 'Vodka, lime & soda', short: 'vodka soda', price: 11, std: 1.0, h: 0.135, rb: 0.033, rt: 0.035, col: [0.88, 0.95, 0.82], col2: [0.7, 0.85, 0.65], foam: 0.0, beer: false, cloudy: 0.25, spirit: 'vodka', mixer: 'soda', ice: 4, pourTo: 0.2 },
  llb:      { name: 'Lemon Lime & Bitters', short: 'LLB', price: 5, std: 0, h: 0.135, rb: 0.033, rt: 0.035, col: [1.0, 0.55, 0.45], col2: [0.8, 0.3, 0.25], foam: 0.0, beer: false, cloudy: 0.7, mixer: 'lemonade', ice: 3 },
  water:    { name: 'Glass of tap water', short: 'water', price: 0, std: 0, h: 0.12, rb: 0.03, rt: 0.034, col: [0.75, 0.85, 0.9], col2: [0.6, 0.75, 0.85], foam: 0.0, beer: false, clear: true, mixer: 'water', ice: 2 },
};
const liquidVS = `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`;
const liquidFS = `
uniform vec3 uP, uN, uCol, uCol2, uFoamCol; uniform float uFoamH, uTime, uCloudy, uClear, uLight;
varying vec3 vW; varying vec3 vN;
float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  float d = dot(vW - uP, uN);
  if (d > 0.0) discard;
  vec3 V = normalize(cameraPosition - vW);
  if (!gl_FrontFacing) {
    // inside surface seen through the cut: the liquid's top
    vec3 top = uFoamH > 0.0005 ? uFoamCol : mix(uCol, vec3(1.), .15);
    float spec = pow(max(dot(reflect(-V, uN), normalize(vec3(.3,1.,.2))), 0.), 30.);
    gl_FragColor = vec4(top * (0.38 + 0.3*uLight) + spec*.25, 1.0); return;
  }
  float depth = -d;
  vec3 c = mix(uCol2, uCol, smoothstep(0.0, 0.12, depth*3.0 + 0.2));
  float fres = pow(1.0 - abs(dot(V, vN)), 2.5);
  c = mix(c, c*1.25 + 0.02, fres*0.45);
  // rising bubbles
  vec2 g = vec2(atan(vN.z, vN.x)*12.0, vW.y*90.0 - uTime*25.0);
  vec2 cell = floor(g); vec2 f = fract(g) - .5;
  float b = step(0.92, h1(cell)) * smoothstep(.25, .05, length(f));
  c += b * 0.22 * (1.0 - uClear*0.5);
  c = mix(c, vec3(dot(c,vec3(.33)))*1.1, uCloudy*0.25);
  if (uFoamH > 0.0005 && depth < uFoamH) c = uFoamCol * (0.85 + 0.15*h1(floor(vW.xy*900.)));
  c *= 0.3 + 0.42*uLight;
  gl_FragColor = vec4(c, uClear > 0.5 ? 0.5 : 0.96);
}`;
const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 2.2 });
interiorMats.push(glassMat);
let _iceGeo, _iceMat;
function iceGeo() { return _iceGeo || (_iceGeo = new RoundedBoxGeometry(0.022, 0.02, 0.022, 2, 0.004)); }
function iceMat() { if (!_iceMat) { _iceMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }); interiorMats.push(_iceMat); } return _iceMat; }
function makeGlass(type) {
  const D = DRINKS[type];
  const g = new THREE.Group();
  const outer = new THREE.LatheGeometry([V3(0, 0), V3(D.rb + 0.003, 0), V3(D.rb + 0.003, 0.006), V3(D.rt + 0.002, D.h), V3(D.rt, D.h)], 24);
  const gm = new THREE.Mesh(outer, glassMat); gm.renderOrder = 3; g.add(gm);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(D.rb + 0.003, D.rb + 0.004, 0.008, 20), glassMat); base.position.y = 0.004; base.renderOrder = 3; g.add(base);
  const y0 = 0.009, y1 = D.h * 0.985;
  const inner = new THREE.LatheGeometry([V3(0, y0), V3(D.rb - 0.001, y0), V3(D.rt - 0.002, y1)], 24);
  const mat = new THREE.ShaderMaterial({
    vertexShader: liquidVS, fragmentShader: liquidFS, side: THREE.DoubleSide, transparent: !!D.clear,
    uniforms: { uP: { value: V3() }, uN: { value: V3(0, 1, 0) }, uCol: { value: new THREE.Color(...D.col) }, uCol2: { value: new THREE.Color(...D.col2) }, uFoamCol: { value: new THREE.Color(0.86, 0.8, 0.68) }, uFoamH: { value: D.foam }, uTime: { value: 0 }, uCloudy: { value: D.cloudy || 0 }, uClear: { value: D.clear ? 1 : 0 }, uLight: { value: 1 } }
  });
  const lm = new THREE.Mesh(inner, mat); lm.renderOrder = 2; lm.frustumCulled = false; g.add(lm);
  const ice = new THREE.Group(); g.add(ice);
  const o = { type, D, group: g, mat, liquid: lm, ice, fill: 1, y0, y1,
    addIce(n) { for (let i = 0; i < n; i++) { const c = new THREE.Mesh(iceGeo(), iceMat()); const a = i * 2.3 + Math.random(); c.position.set(Math.cos(a) * D.rb * 0.45, 0.02 + i * 0.012, Math.sin(a) * D.rb * 0.45); c.rotation.set(rand(0, 1), rand(0, 3), rand(0, 1)); c.renderOrder = 3; ice.add(c); } }, slosh: new THREE.Vector2(), sloshV: new THREE.Vector2(), lastPos: null, lastVel: V3(), foam: D.foam,
    update(dt, t) {
      const u = mat.uniforms; u.uTime.value = t;
      g.updateWorldMatrix(true, false);
      const up = _v1.set(0, 1, 0).transformDirection(g.matrixWorld);
      const base = _v2.setFromMatrixPosition(g.matrixWorld);
      // volume-ish: tilted glass raises the level along its axis a little
      const tilt = Math.acos(clamp(up.y, -1, 1));
      const hh = this.y0 + (this.y1 - this.y0) * this.fill;
      u.uP.value.copy(base).addScaledVector(up, hh + Math.min(0.03, tilt * 0.02 * this.fill));
      u.uN.value.set(this.slosh.x, 1, this.slosh.y).normalize();
      u.uFoamH.value = this.fill > 0.02 ? this.foam : 0;
      lm.visible = this.fill > 0.004;
      // ice floats on whatever's in the glass
      const top = this.y0 + (this.y1 - this.y0) * this.fill;
      ice.children.forEach((c, i) => { c.position.y = Math.max(0.018 + (i % 2) * 0.012, Math.min(top - 0.008 - (i % 3) * 0.01, this.D.h - 0.02)); });
    },
    // spring-damper slosh driven by acceleration of the glass
    physics(dt) {
      g.updateWorldMatrix(true, false);
      const p = _v3.setFromMatrixPosition(g.matrixWorld);
      if (!this.lastPos) { this.lastPos = p.clone(); return 0; }
      const vel = p.clone().sub(this.lastPos).divideScalar(Math.max(dt, 1e-4));
      const acc = vel.clone().sub(this.lastVel).divideScalar(Math.max(dt, 1e-4));
      this.lastPos.copy(p); this.lastVel.copy(vel);
      acc.clampLength(0, 40);
      const k = 140, c = 4.5;
      this.sloshV.x += (-k * this.slosh.x - c * this.sloshV.x - acc.x * 0.9) * dt;
      this.sloshV.y += (-k * this.slosh.y - c * this.sloshV.y - acc.z * 0.9) * dt;
      this.slosh.addScaledVector(this.sloshV, dt);
      this.slosh.clampLength(0, 1.2);
      // spill when the surface reaches the rim
      const margin = (1 - this.fill) * 1.6 + 0.12;
      const amp = this.slosh.length();
      if (amp > margin && this.fill > 0.02) { const spill = Math.min(this.fill, (amp - margin) * 0.25); this.fill -= spill; return spill; }
      return 0;
    }
  };
  return o;
}

// =====================================================================
//  PARTICLES: smoke (soft billboard) + droplets/sparks; puddles; shards
// =====================================================================
class Particles {
  constructor(n, tex, opts) {
    this.n = n; this.i = 0; this.opts = opts;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.col = new Float32Array(n * 3); this.grow = new Float32Array(n); this.a0 = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: tex }, uScale: { value: innerHeight / 2 } }, transparent: true, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); float z=-mv.z; vA=alpha*smoothstep(0.12,0.7,z); gl_PointSize = min(size*uScale/max(0.05,z), 420.0); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D tex; varying float vA; varying vec3 vC; void main(){ vec4 t=texture2D(tex,gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA); if(gl_FragColor.a<0.004) discard; }`
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5; scene.add(this.points);
    this.onHit = null;
  }
  emit(p, v, size, life, alpha, col = [1, 1, 1], grow = 0) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.a0[i] = alpha; this.alpha[i] = alpha; this.col.set(col, i * 3); this.grow[i] = grow;
  }
  update(dt, t) {
    const o = this.opts;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3, f = this.life[i] / this.max[i];
      if (o.smoke) {
        this.vel[k] += Math.sin(t * 1.7 + i * 0.37 + this.pos[k + 1] * 4) * 0.25 * dt;
        this.vel[k + 2] += Math.cos(t * 1.3 + i * 0.71 + this.pos[k + 1] * 3) * 0.25 * dt;
        this.vel[k + 1] += 0.08 * dt;
        const drag = Math.exp(-1.6 * dt); this.vel[k] *= drag; this.vel[k + 1] *= Math.exp(-0.6 * dt); this.vel[k + 2] *= drag;
        this.size[i] += this.grow[i] * dt;
        this.alpha[i] = this.a0[i] * Math.min(1, (1 - f) * 6) * f;
        if (this.pos[k + 1] > PUB.ceil - 0.1 && isInside(this.pos[k], this.pos[k + 2])) { this.vel[k + 1] = 0; this.pos[k + 1] = PUB.ceil - 0.1; this.vel[k] *= 1.02; }
      } else {
        this.vel[k + 1] -= 9.8 * dt;
        this.alpha[i] = this.a0[i] * Math.min(1, f * 3);
        const gy = groundY(this.pos[k], this.pos[k + 2], this.pos[k + 1]);
        if (this.pos[k + 1] < gy + 0.005 && this.vel[k + 1] < 0) {
          if (this.onHit) this.onHit(this.pos[k], gy, this.pos[k + 2], i);
          this.life[i] = 0; this.alpha[i] = 0;
        }
      }
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = a.color.needsUpdate = true;
  }
}
let smokeFX, dropFX, sparkFX;
const puddles = [];
const puddleMat = new THREE.MeshStandardMaterial({ color: 0x3a2008, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
function addPuddle(x, y, z, s) {
  for (const p of puddles) if (Math.hypot(p.position.x - x, p.position.z - z) < p.scale.x * 0.7) { p.userData.target = Math.min(0.6, p.userData.target + s * 0.3); return; }
  if (puddles.length > 40) { const old = puddles.shift(); scene.remove(old); }
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), puddleMat); m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.008, z);
  m.scale.setScalar(0.01); m.userData.target = s; scene.add(m); puddles.push(m);
}
function initFX() {
  smokeFX = new Particles(700, TEX.smoke, { smoke: true });
  dropFX = new Particles(300, TEX.dot, {});
  sparkFX = new Particles(120, TEX.dot, { additive: true });
  dropFX.onHit = (x, y, z, i) => { if (Math.random() < 0.35) addPuddle(x, y, z, rand(0.04, 0.09)); };
}
function updatePuddles(dt) { for (const p of puddles) { const s = p.scale.x; p.scale.setScalar(damp(s, p.userData.target, 2, dt)); } }
function spillDrops(pos, amount, col) {
  const n = Math.min(40, Math.ceil(amount * 120));
  for (let i = 0; i < n; i++) dropFX.emit(pos, V3(rand(-0.6, 0.6), rand(-0.2, 0.8), rand(-0.6, 0.6)), rand(0.006, 0.014), 2, 0.9, col);
}

// glass shards — tiny rigid bodies with floor bounce + friction
const shards = [];
function shatterGlass(pos, glass) {
  const D = glass.D;
  for (let i = 0; i < 22; i++) {
    const s = rand(0.012, 0.035);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, s, rand(-s, s), 0, rand(0, s), s, rand(-s / 2, s / 2)], 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, glassMat); m.position.copy(pos).add(V3(rand(-.03, .03), rand(0, .1), rand(-.03, .03))); m.renderOrder = 3; scene.add(m);
    shards.push({ m, v: V3(rand(-2, 2), rand(0.5, 2.8), rand(-2, 2)), w: V3(rand(-20, 20), rand(-20, 20), rand(-20, 20)), life: 25 + rand(0, 10) });
  }
  if (glass.fill > 0.02) { spillDrops(pos, glass.fill * 0.8, [D.col[0] * 0.8, D.col[1] * 0.8, D.col[2] * 0.8]); addPuddle(pos.x, groundY(pos.x, pos.z, pos.y), pos.z, 0.25 + glass.fill * 0.35); }
  SFX.smash(pos);
}
function updateShards(dt) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i]; s.life -= dt;
    const gy = groundY(s.m.position.x, s.m.position.z, s.m.position.y) + 0.004;
    s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt);
    s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt; s.m.rotation.z += s.w.z * dt;
    if (s.m.position.y < gy) { s.m.position.y = gy; if (s.v.y < -0.3) { s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; s.w.multiplyScalar(0.5); if (Math.random() < 0.3) SFX.tone(rand(4000, 7000), 0.05, { gain: 0.02, pos: s.m.position }); } else { s.v.set(0, 0, 0); s.w.multiplyScalar(0.8); } }
    if (s.life <= 0) { scene.remove(s.m); s.m.geometry.dispose(); shards.splice(i, 1); }
  }
}
// free-falling dropped glass (until impact)
const fallingGlasses = [];
function dropGlass(glass, vel) {
  glass.group.updateWorldMatrix(true, false);
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion(); glass.group.matrixWorld.decompose(wp, wq, _v3);
  glass.group.parent && glass.group.parent.remove(glass.group);
  scene.add(glass.group); glass.group.position.copy(wp); glass.group.quaternion.copy(wq); glass.group.scale.set(1, 1, 1);
  fallingGlasses.push({ glass, v: vel.clone(), w: V3(rand(-6, 6), rand(-2, 2), rand(-6, 6)) });
}
function updateFalling(dt, t) {
  for (let i = fallingGlasses.length - 1; i >= 0; i--) {
    const f = fallingGlasses[i], g = f.glass.group;
    f.v.y -= 9.8 * dt; g.position.addScaledVector(f.v, dt);
    g.rotateX(f.w.x * dt); g.rotateZ(f.w.z * dt);
    f.glass.update(dt, t);
    if (f.glass.fill > 0.02 && Math.random() < 0.6) { dropFX.emit(g.position.clone().add(V3(0, 0.12, 0)), V3(rand(-.3, .3), 0, rand(-.3, .3)), 0.01, 2, 0.9, f.glass.D.col); f.glass.fill -= dt * 0.5; }
    if (g.position.y < groundY(g.position.x, g.position.z, g.position.y) + 0.02) { shatterGlass(g.position.clone(), f.glass); scene.remove(g); fallingGlasses.splice(i, 1); Game.onGlassSmash(g.position.clone()); }
  }
}

// beer stream from tap to glass
function makeStream() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(1, 0.6, 0.1) } }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; uniform float uTime; void main(){ vUv=uv; vec3 p=position; p.x += sin(uv.y*20.+uTime*30.)*0.0008; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uCol; void main(){ float s = 0.75+0.25*sin(vUv.y*60.-uTime*40.); float edge = smoothstep(0.,.3,vUv.x)*smoothstep(1.,.7,vUv.x); gl_FragColor=vec4(uCol*s*1.3, .85*edge); }`
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.004, 1, 8, 1, true), mat); m.visible = false; m.renderOrder = 4; scene.add(m);
  return m;
}

// =====================================================================
//  HUMANS: procedural rig, poses, IK
// =====================================================================
const NPC_NAMES = ['Davo', 'Shazza', 'Gazza', 'Kev', 'Bazza', 'Trev', 'Macca', 'Robbo', 'Jonesy', 'Tracey', 'Kylie', 'Big Sue', 'Old Mick', 'Nev', 'Dazza', 'Steve-O', 'Brenda', 'Noddy', 'Spud', 'Fitzy', 'Wazza', 'Lorraine', 'Bev', 'Sticks', 'Kenno', 'Deb', 'Mully', 'Chook'];
const SKIN = [0xf0c4a0, 0xd9a383, 0xc68a64, 0x9a6440, 0x6a4028, 0xe8b894];
// outfit = { tile: atlas pattern, c: tint }
const SHIRTS = [{ tile: 'hivis', c: 0xff7a1a }, { tile: 'hivis', c: 0xe8e01a }, { tile: 'flannel', c: 0xb02424 }, { tile: 'flannel', c: 0x2a5aa8 }, { tile: 'flannel', c: 0x2f7a34 },
  { tile: 'collar', c: 0x1a2a4a }, { tile: 'collar', c: 0x161616 }, { tile: 'cloth', c: 0xe8e8e8 }, { tile: 'hoops', c: 0xffffff }, { tile: 'hoops', c: 0xb03040 }, { tile: 'collar', c: 0x4a2a5a }, { tile: 'hivis', c: 0xff7a1a }, { tile: 'cloth', c: 0x2a5a2a }];
const PANTS = [{ tile: 'denim', c: 0xffffff }, { tile: 'denim', c: 0xcfd6e0 }, { tile: 'cloth', c: 0x6a5a3a }, { tile: 'cloth', c: 0x222222 }, { tile: 'cloth', c: 0x1a2440 }, { tile: 'denim', c: 0xffffff }];
const HAIR = [0x1a120a, 0x3a2412, 0x6a4a2a, 0xa8a8a8, 0xd8c08a, 0x2a1a0a, 0x8a3a18];
const capsGeo = new THREE.CapsuleGeometry(1, 1, 5, 14);
const sphGeoH = new THREE.SphereGeometry(1, 24, 18);
const matCache = {};
function cm(col, rough = 0.7) { const k = col + '_' + rough; if (!matCache[k]) { matCache[k] = M({ color: col, roughness: rough }); } return matCache[k]; }
function flannelMat(col) {
  const k = 'fl' + col; if (matCache[k]) return matCache[k];
  const c = mkCanvas(64, 64), x = c.getContext('2d'); const base = new THREE.Color(col);
  x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 64; i += 16) { x.fillRect(i, 0, 6, 64); x.fillRect(0, i, 64, 6); }
  x.fillStyle = 'rgba(255,255,255,.15)'; for (let i = 8; i < 64; i += 16) { x.fillRect(i, 0, 2, 64); x.fillRect(0, i, 64, 2); }
  const fm = M({ map: canvasTex(c, 3, 3), roughness: 0.9 }); fm.userData.base = col;
  return (matCache[k] = fm);
}

// ---------- character texture atlas: fabrics, hair, painted faces (one texture for everyone) ----------
const ATLAS = { tex: null, rect: {} };
function buildAtlas() {
  const N = 4, T = 256, c = mkCanvas(N * T, N * T), x = c.getContext('2d');
  const names = ['cloth', 'skin', 'flannel', 'hivis', 'hoops', 'denim', 'hair', 'shoe', 'collar', 'face0', 'face1', 'face2', 'face3', 'face4', 'face5', 'mouth'];
  const grain = (x0, y0, amt, a = 0.08) => { for (let i = 0; i < amt; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; x.fillRect(x0 + Math.random() * T, y0 + Math.random() * T, rand(1, 3), rand(1, 3)); } };
  names.forEach((n, i) => {
    const x0 = (i % N) * T, y0 = Math.floor(i / N) * T;
    x.save(); x.beginPath(); x.rect(x0, y0, T, T); x.clip();
    if (n === 'cloth' || n === 'collar') { x.fillStyle = '#f2f2f2'; x.fillRect(x0, y0, T, T); grain(x0, y0, 2500, 0.06); for (let k = 0; k < T; k += 3) { x.fillStyle = 'rgba(0,0,0,.035)'; x.fillRect(x0, y0 + k, T, 1); }
      if (n === 'collar') { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(x0, y0 + 8, T, 5); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(x0 + T * 0.24, y0 + 14, 3, 40); for (let b = 0; b < 3; b++) { x.fillStyle = '#ddd'; x.beginPath(); x.arc(x0 + T * 0.25 + 6, y0 + 24 + b * 14, 3, 0, 7); x.fill(); } } }
    if (n === 'skin') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); grain(x0, y0, 1800, 0.035); }
    if (n === 'flannel') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); for (let k = 0; k < T; k += 42) { x.fillStyle = 'rgba(0,0,0,.42)'; x.fillRect(x0 + k, y0, 16, T); x.fillRect(x0, y0 + k, T, 16); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(x0 + k + 26, y0, 3, T); x.fillRect(x0, y0 + k + 26, T, 3); } grain(x0, y0, 2000, 0.07); }
    if (n === 'hivis') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); grain(x0, y0, 1500, 0.05); for (const yy of [0.42, 0.62]) { x.fillStyle = '#5a5a5a'; x.fillRect(x0, y0 + T * (1 - yy) - 9, T, 18); x.fillStyle = '#a8a8a8'; x.fillRect(x0, y0 + T * (1 - yy) - 6, T, 12); } }
    if (n === 'hoops') { for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#262626' : '#ffffff'; x.fillRect(x0, y0 + k * T / 8, T, T / 8); } grain(x0, y0, 1500, 0.06); }
    if (n === 'denim') { x.fillStyle = '#3c5a86'; x.fillRect(x0, y0, T, T); for (let k = 0; k < 3000; k++) { x.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,30,60' : '170,190,220'},.18)`; const px = x0 + Math.random() * T, py = y0 + Math.random() * T; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 4, py + 4); x.stroke(); } x.fillStyle = 'rgba(200,150,60,.6)'; x.fillRect(x0 + T * 0.5, y0, 2, T); }
    if (n === 'hair') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); for (let k = 0; k < 900; k++) { x.strokeStyle = `rgba(0,0,0,${rand(0.05, 0.25)})`; x.lineWidth = rand(0.5, 1.5); const px = x0 + Math.random() * T; x.beginPath(); x.moveTo(px, y0); x.bezierCurveTo(px + rand(-6, 6), y0 + T / 3, px + rand(-6, 6), y0 + T * 2 / 3, px + rand(-8, 8), y0 + T); x.stroke(); } }
    if (n === 'shoe') { x.fillStyle = '#ffffff'; x.fillRect(x0, y0, T, T); grain(x0, y0, 1500, 0.08); x.fillStyle = '#222'; x.fillRect(x0, y0 + T * 0.82, T, T * 0.18); x.fillStyle = 'rgba(0,0,0,.4)'; for (let k = 0; k < 6; k++) x.fillRect(x0 + T * 0.2 + k * 10, y0 + T * 0.3, 5, 3); }
    if (n === 'mouth') { x.fillStyle = '#5a1a18'; x.fillRect(x0, y0, T, T); x.fillStyle = '#e8e0d4'; x.fillRect(x0, y0 + T * 0.4, T, T * 0.14); }
    if (n.startsWith('face')) {
      const tone = new THREE.Color(SKIN[+n[4]]), hex = '#' + tone.getHexString(), dark = '#' + tone.clone().multiplyScalar(0.62).getHexString();
      x.fillStyle = hex; x.fillRect(x0, y0, T, T); grain(x0, y0, 1600, 0.03);
      // head sphere UVs: front of the face sits at u = 0.25; v = 1 - polar/π
      const U = u => x0 + u * T, Vy = v => y0 + (1 - v) * T;
      const blush = x.createRadialGradient(U(0.25), Vy(0.45), 2, U(0.25), Vy(0.45), 40); blush.addColorStop(0, 'rgba(190,70,60,.18)'); blush.addColorStop(1, 'rgba(190,70,60,0)'); x.fillStyle = blush; x.fillRect(x0, y0, T, T);
      for (const s of [-1, 1]) {
        const ex = U(0.25 + s * 0.052), ey = Vy(0.555);
        x.fillStyle = dark; x.beginPath(); x.ellipse(ex, ey + 1, 10, 6.5, 0, 0, 7); x.fill(); // socket shadow
        x.fillStyle = '#f4f0ea'; x.beginPath(); x.ellipse(ex, ey, 8, 4.6, 0, 0, 7); x.fill();
        x.fillStyle = choice(['#4a2a14', '#2a4a7a', '#3a5a2a', '#1a1208']); x.beginPath(); x.arc(ex + s * -0.8, ey, 3.6, 0, 7); x.fill();
        x.fillStyle = '#050505'; x.beginPath(); x.arc(ex + s * -0.8, ey, 1.7, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(ex + s * -0.8 + 1, ey - 2, 1.5, 1.5);
        x.strokeStyle = '#2a1a10'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(ex - 9, ey - 9 + s * 0); x.quadraticCurveTo(ex, ey - 13, ex + 9, ey - 9); x.stroke();
      }
      x.strokeStyle = dark; x.lineWidth = 2; x.beginPath(); x.moveTo(U(0.25), Vy(0.53)); x.lineTo(U(0.255), Vy(0.46)); x.stroke(); // nose ridge shade
      x.strokeStyle = '#7a3a30'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(U(0.25) - 13, Vy(0.392)); x.quadraticCurveTo(U(0.25), Vy(0.385), U(0.25) + 13, Vy(0.392)); x.stroke();
      x.strokeStyle = 'rgba(150,70,60,.6)'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(U(0.25) - 9, Vy(0.375)); x.quadraticCurveTo(U(0.25), Vy(0.366), U(0.25) + 9, Vy(0.375)); x.stroke();
    }
    x.restore();
    ATLAS.rect[n] = [(i % N) / N, 1 - (Math.floor(i / N) + 1) / N, (i % N + 1) / N, 1 - Math.floor(i / N) / N];
  });
  ATLAS.tex = new THREE.CanvasTexture(c); ATLAS.tex.colorSpace = THREE.SRGBColorSpace; ATLAS.tex.anisotropy = 4;
}

function limb(parent, r, len, tile, col, y = 0, sx = 1) {
  const m = new THREE.Mesh(capsGeo); m.scale.set(r * sx, len / 2, r); m.position.y = -len / 2 + y;
  m.userData = { tile, col }; parent.add(m); return m;
}
function part(parent, geo, tile, col, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.userData = { tile, col }; parent.add(m); return m;
}
function makeHuman(o = {}) {
  if (!ATLAS.tex) buildAtlas();
  const fem = o.fem ?? Math.random() < 0.38;
  const skinI = o.skinI ?? randi(0, SKIN.length - 1), skin = SKIN[skinI];
  const sh = o.shirt ?? choice(SHIRTS), pa = o.pants ?? choice(PANTS);
  const hairC = o.hair ?? choice(HAIR), shoeC = o.shoes ?? choice([0x2a1a0a, 0x161616, 0x6a4a2a, 0xe8e8e8]);
  const sc = o.scale ?? (fem ? rand(0.92, 0.99) : rand(0.97, 1.08)), girth = o.girth ?? (fem ? rand(0.88, 1.02) : rand(0.95, 1.3));
  const gC = Math.min(girth, 1.15), shorts = o.shorts ?? (!fem && Math.random() < 0.45), skirt = o.skirt ?? (fem && Math.random() < 0.45);
  const root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(sc); root.add(body);
  const J = {};
  J.hips = new THREE.Group(); J.hips.position.y = 0.92; body.add(J.hips);
  part(J.hips, sphGeoH, pa.tile, pa.c, 0, 0, 0, 0.165 * girth * (fem ? 1.08 : 1), 0.11, 0.12 * girth);
  part(J.hips, new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), 'cloth', 0x2a1a10, 0, 0.05, 0, 0.158 * girth * (fem ? 1.06 : 1), 0.03, 0.118 * girth); // belt
  if (skirt) part(J.hips, new THREE.CylinderGeometry(0.6, 1, 1, 20, 1, false), pa.tile === 'denim' ? 'denim' : 'cloth', pa.c, 0, -0.16, 0, 0.21 * girth, 0.3, 0.17 * girth);
  J.spine = new THREE.Group(); J.spine.position.y = 0.05; J.hips.add(J.spine);
  part(J.spine, capsGeo, sh.tile, sh.c, 0, 0.12, girth > 1.15 ? 0.02 : 0, 0.15 * girth, 0.08, 0.125 * girth * (girth > 1.15 ? 1.12 : 1));
  J.chest = new THREE.Group(); J.chest.position.y = 0.24; J.spine.add(J.chest);
  part(J.chest, capsGeo, sh.tile, sh.c, 0, 0.07, 0, 0.19 * gC * (fem ? 0.92 : 1), 0.075, 0.118 * Math.min(girth, 1.1));
  if (fem) for (const s of [-1, 1]) part(J.chest, sphGeoH, sh.tile, sh.c, s * 0.06, 0.06, 0.075, 0.06, 0.055, 0.05);
  part(J.chest, sphGeoH, sh.tile, sh.c, 0, 0.16, 0, 0.21 * gC * (fem ? 0.9 : 1), 0.06, 0.11); // shoulders
  J.neck = new THREE.Group(); J.neck.position.y = 0.24; J.chest.add(J.neck);
  limb(J.neck, 0.047, 0.07, 'skin', skin, 0.055);
  if (sh.tile === 'collar') part(J.neck, new THREE.CylinderGeometry(1, 1.1, 1, 16, 1, true), 'collar', sh.c, 0, -0.005, 0, 0.058, 0.035, 0.058);
  J.head = new THREE.Group(); J.head.position.y = 0.07; J.neck.add(J.head);
  part(J.head, sphGeoH, 'face' + skinI, 0xffffff, 0, 0.085, 0, 0.093, 0.115, 0.104);
  part(J.head, sphGeoH, 'skin', skin, 0, 0.03, 0.03, 0.075, 0.05, 0.075); // jaw / chin
  part(J.head, sphGeoH, 'skin', skin, 0, 0.074, 0.103, 0.015, 0.024, 0.02); // nose
  for (const s of [-1, 1]) part(J.head, sphGeoH, 'skin', skin, s * 0.092, 0.085, -0.005, 0.014, 0.026, 0.02); // ears
  // eyelids (blink) and mouth (talk) get their own bones
  J.lids = new THREE.Group(); J.lids.position.set(0, 0.101, 0.083); J.head.add(J.lids);
  for (const s of [-1, 1]) part(J.lids, sphGeoH, 'skin', skin, s * 0.034, 0, 0.004, 0.019, 0.011, 0.012);
  J.jaw = new THREE.Group(); J.jaw.position.set(0, 0.046, 0.09); J.head.add(J.jaw);
  part(J.jaw, sphGeoH, 'mouth', 0xffffff, 0, 0, 0.004, 0.016, 0.009, 0.01);
  // hair / hats / facial hair / glasses
  const style = o.style ?? (fem ? choice(['long', 'bob', 'pony', 'long']) : choice(['short', 'short', 'bald', 'cap', 'bucket', 'mullet', 'short']));
  if (style !== 'bald') {
    part(J.head, sphGeoH, 'hair', hairC, 0, 0.122, -0.01, 0.099, 0.095, 0.11);
    if (style === 'long' || style === 'mullet') part(J.head, sphGeoH, 'hair', hairC, 0, style === 'long' ? 0.0 : 0.03, -0.065, 0.098, style === 'long' ? 0.17 : 0.1, 0.06);
    if (style === 'pony') part(J.head, capsGeo, 'hair', hairC, 0, 0.06, -0.12, 0.03, 0.06, 0.03, 0.5);
    if (style === 'bob') part(J.head, sphGeoH, 'hair', hairC, 0, 0.065, -0.02, 0.108, 0.1, 0.1);
    if (fem) part(J.head, sphGeoH, 'hair', hairC, 0, 0.16, 0.06, 0.08, 0.035, 0.05, 0.3); // fringe
  } else part(J.head, sphGeoH, 'hair', hairC, 0, 0.07, -0.03, 0.098, 0.05, 0.09); // fringe of a bald head
  if (style === 'cap') { const cc = choice([0x1a2a5a, 0x8a1a1a, 0x161616, 0x2a5a2a, 0xe8e8e8]); part(J.head, sphGeoH, 'cloth', cc, 0, 0.14, 0, 0.102, 0.075, 0.112); part(J.head, new THREE.CylinderGeometry(1, 1, 1, 18), 'cloth', cc, 0, 0.145, 0.1, 0.07, 0.008, 0.056, 0.15); if (Math.random() < 0.4) part(J.head, new THREE.BoxGeometry(1, 1, 1), 'cloth', 0x111111, 0, 0.17, 0.06, 0.12, 0.03, 0.03, 0.2); }
  if (style === 'bucket') { const hc = choice([0xd8c8a0, 0x3a4a2a]); part(J.head, new THREE.CylinderGeometry(0.85, 1, 1, 18), 'cloth', hc, 0, 0.175, 0, 0.1, 0.08, 0.1); part(J.head, new THREE.CylinderGeometry(1, 1, 1, 20), 'cloth', hc, 0, 0.14, 0, 0.15, 0.008, 0.15, 0.08); }
  const beard = o.beard ?? (!fem && Math.random() < 0.4 ? (Math.random() < 0.6 ? 'full' : 'mo') : null);
  if (beard) { const full = beard === 'full'; part(J.head, sphGeoH, 'hair', hairC, 0, full ? 0.022 : 0.05, full ? 0.05 : 0.093, full ? 0.083 : 0.03, full ? 0.06 : 0.009, full ? 0.068 : 0.012); }
  if (o.glasses ?? Math.random() < 0.18) { const gc = Math.random() < 0.5 ? 0x111111 : 0x6a4a2a; for (const s of [-1, 1]) part(J.head, new THREE.TorusGeometry(1, 0.18, 6, 16), 'cloth', gc, s * 0.034, 0.1, 0.104, 0.018, 0.014, 0.01); part(J.head, new THREE.BoxGeometry(1, 1, 1), 'cloth', gc, 0, 0.103, 0.106, 0.03, 0.003, 0.003); }
  // arms & legs
  for (const s of [1, -1]) {
    const side = s > 0 ? 'l' : 'r';
    const ua = new THREE.Group(); ua.position.set(s * 0.2 * Math.min(girth, 1.12) * (fem ? 0.92 : 1), 0.18, 0); J.chest.add(ua);
    limb(ua, 0.05 * (fem ? 0.88 : 1), 0.27, sh.tile, sh.c);
    const el = new THREE.Group(); el.position.y = -0.29; ua.add(el);
    const longSleeve = sh.tile === 'flannel' || sh.tile === 'hivis';
    limb(el, 0.042 * (fem ? 0.88 : 1), 0.23, longSleeve ? sh.tile : 'skin', longSleeve ? sh.c : skin);
    const hand = new THREE.Group(); hand.position.y = -0.26; el.add(hand);
    part(hand, sphGeoH, 'skin', skin, 0, -0.035, 0, 0.034, 0.05, 0.02);
    part(hand, capsGeo, 'skin', skin, s * -0.02, -0.03, 0.012, 0.009, 0.018, 0.009, 0.5, 0, s * -0.5); // thumb
    J[side + 'UA'] = ua; J[side + 'EL'] = el; J[side + 'H'] = hand;
    const th = new THREE.Group(); th.position.set(s * 0.09 * (fem ? 1.05 : 1), -0.04, 0); J.hips.add(th);
    limb(th, 0.072 * Math.min(girth, 1.15), 0.41, skirt ? 'skin' : pa.tile, skirt ? skin : pa.c);
    const kn = new THREE.Group(); kn.position.y = -0.43; th.add(kn);
    limb(kn, 0.054, 0.38, shorts || skirt ? 'skin' : pa.tile, shorts || skirt ? skin : pa.c);
    if (shorts) part(kn, new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), 'cloth', 0xe8e8e8, 0, -0.33, 0, 0.056, 0.05, 0.056); // footy socks
    const ft = new THREE.Group(); ft.position.y = -0.42; kn.add(ft);
    part(ft, new RoundedBoxGeometry(0.09, 0.07, 0.25, 2, 0.03), 'shoe', shoeC, 0, -0.035, 0.05, 1, 1, 1);
    J[side + 'TH'] = th; J[side + 'KN'] = kn; J[side + 'FT'] = ft;
  }
  return skinify({ root, J, fem, scale: sc, style });
}

// Collapse the procedural body into ONE skinned mesh (rigid weights) using the shared atlas:
// identical animation code (it drives Bones instead of Groups), one draw call per person.
let npcSkinMat = null;
function skinify(h) {
  if (!npcSkinMat) { npcSkinMat = new THREE.MeshStandardMaterial({ map: ATLAS.tex, vertexColors: true, roughness: 0.78, metalness: 0 }); interiorMats.push(npcSkinMat); }
  const body = h.root.children[0], groups = [body], names = ['body'];
  for (const k in h.J) { groups.push(h.J[k]); names.push(k); }
  h.root.updateMatrixWorld(true);
  const bones = groups.map(g => { const b = new THREE.Bone(); b.position.copy(g.position); b.quaternion.copy(g.quaternion); b.scale.copy(g.scale); return b; });
  groups.forEach((g, i) => { if (i === 0) h.root.add(bones[0]); else bones[groups.indexOf(g.parent)].add(bones[i]); });
  const inv = new THREE.Matrix4().copy(h.root.matrixWorld).invert(), geos = [], col = new THREE.Color();
  groups.forEach((g, bi) => {
    for (const m of g.children) {
      if (!m.isMesh) continue;
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      const n = geo.attributes.position.count, ca = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const ud = m.userData || {}, r = ATLAS.rect[ud.tile || 'cloth'];
      col.set(ud.col ?? 0xffffff);
      const pad = 0.004, uv = geo.attributes.uv;
      for (let i = 0; i < n; i++) {
        ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; si[i * 4] = bi; sw[i * 4] = 1;
        if (uv) uv.setXY(i, lerp(r[0] + pad, r[2] - pad, clamp(uv.getX(i), 0, 1)), lerp(r[1] + pad, r[3] - pad, clamp(uv.getY(i), 0, 1)));
      }
      if (!uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2).fill((r[0] + r[2]) / 2), 2));
      geo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      geos.push(geo);
    }
  });
  const sm = new THREE.SkinnedMesh(mergeGeometries(geos), npcSkinMat);
  geos.forEach(g => g.dispose());
  h.root.remove(body); h.root.add(sm);
  h.root.updateMatrixWorld(true);
  sm.bind(new THREE.Skeleton(bones));
  const J = {}; names.forEach((n, i) => { if (i > 0) J[n] = bones[i]; });
  J.lids.scale.y = 0.05; J.jaw.scale.y = 0.35;
  h.J = J; h.mesh = sm;
  return h;
}

// pose targets in radians. Convention: x<0 swings a limb forward (+z).
function poseFor(kind, t, a) {
  const p = { hipsY: 0.92, hipsX: 0, hipsZ: 0, spineZ: 0, spine: 0, chest: 0, neck: 0, headX: 0, headY: 0, lUAx: 0.05, lUAz: 0.12, lEL: -0.15, rUAx: 0.05, rUAz: -0.12, rEL: -0.15, lTH: 0, lKN: 0, rTH: 0, rKN: 0, lFT: 0, rFT: 0 };
  const breath = Math.sin(t * 1.6) * 0.02;
  p.chest = breath; p.headX = Math.sin(t * 0.3) * 0.05; p.headY = Math.sin(t * 0.21 + a.seed) * 0.3;
  if (kind === 'walk') {
    const ph = a.walkPh, sw = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
    p.lTH = -sw * 0.5; p.rTH = -s2 * 0.5;
    p.lKN = Math.max(0, Math.sin(ph - 1.2)) * 0.9 + 0.05; p.rKN = Math.max(0, Math.sin(ph + Math.PI - 1.2)) * 0.9 + 0.05;
    p.lUAx = sw * 0.38; p.rUAx = s2 * 0.38; p.lEL = -0.3; p.rEL = -0.3;
    p.hipsY = 0.92 - Math.abs(Math.cos(ph)) * 0.025 + 0.012; p.spine = 0.05; p.headY = 0;
    if (a.drunk > 0.5) { p.hipsX = Math.sin(t * 1.3) * 0.08; p.headX = 0.2; }
  } else if (kind === 'sit' || kind === 'pokie' || kind === 'sitTable') {
    p.hipsY = a.sitH + 0.08; p.lTH = -1.5; p.rTH = -1.5; p.lKN = 1.45; p.rKN = 1.45; p.spine = 0.1; p.lFT = 0.1; p.rFT = 0.1;
    if (kind === 'pokie') {
      p.spine = 0.18; p.chest = 0.05 + breath; p.headX = 0.05; p.headY = 0;
      const tap = a.tapT > 0 ? Math.sin(a.tapT * 18) * 0.5 + 0.5 : 0;
      p.rUAx = -0.9 - tap * 0.15; p.rUAz = 0.15; p.rEL = -0.9 + tap * 0.25;
      p.lUAx = -0.5; p.lUAz = 0.2; p.lEL = -1.4;
    } else { p.lUAx = -0.35; p.rUAx = -0.35; p.lEL = -1.0; p.rEL = -1.0; p.lUAz = 0.1; p.rUAz = -0.1; }
  } else if (kind === 'lean') { p.spine = 0.08; p.lUAx = -0.6; p.lEL = -1.3; p.rUAx = -0.2; p.rEL = -1.1; p.lTH = -0.1; p.rKN = 0.2; p.rTH = 0.15; }
  else if (kind === 'pool') { p.spine = 0.65; p.chest = 0.25; p.headX = -0.6; p.rUAx = 0.3 + Math.sin(t * 2) * 0.25; p.rEL = -1.4; p.lUAx = -1.2; p.lEL = -0.2; p.lTH = -0.3; p.lKN = 0.3; p.rTH = 0.25; }
  else if (kind === 'darts') { const th = a.dartT != null ? (a.dartT > 0 ? Math.sin((1 - a.dartT / 0.5) * Math.PI) : 0) : (t % 4) < 0.5 ? Math.sin(((t % 4) / 0.5) * Math.PI) : 0; p.rUAx = -1.6 + th * 0.4; p.rEL = -1.8 + th * 1.6; p.lUAx = 0; p.headX = -0.05; p.rTH = 0.15; }
  else if (kind === 'cheer') { p.lUAx = -2.8; p.rUAx = -2.8; p.lUAz = 0.3; p.rUAz = -0.3; p.lEL = -0.3 + Math.sin(t * 12) * 0.3; p.rEL = -0.3 + Math.sin(t * 12 + 1) * 0.3; p.headX = -0.3; }
  else if (kind === 'wipe') { p.spine = 0.2; p.rUAx = -0.9; p.rEL = -0.6 + Math.sin(t * 5) * 0.4; p.rUAz = -0.2 + Math.sin(t * 5) * 0.25; p.headX = 0.3; }
  else if (kind === 'stand') {
    // weight shift from foot to foot
    const w = Math.sin(t * 0.32 + a.seed * 3);
    p.lUAz = 0.1 + Math.sin(t * 0.7) * 0.02; p.hipsZ = w * 0.05; p.spineZ = -w * 0.04; p.lKN = Math.max(0, w) * 0.18; p.rKN = Math.max(0, -w) * 0.18; p.lTH = -Math.max(0, w) * 0.08; p.rTH = -Math.max(0, -w) * 0.08;
    if (a.crossed && !a.holdDrink && !a.smoking && !a.phone) { p.lUAx = -0.55; p.lUAz = 0.38; p.lEL = -1.95; p.rUAx = -0.6; p.rUAz = -0.38; p.rEL = -1.9; }
  }
  // overlays
  if (a.phone && kind !== 'walk' && kind !== 'pokie' && !a.smoking) { p.lUAx = -0.42; p.lUAz = 0.15; p.lEL = -1.8; p.headX = 0.42; p.headY = 0.12; }
  if (a.talk > 0 && !a.phone) { p.lUAx = -0.6 + Math.sin(t * 4) * 0.25; p.lEL = -1.2 + Math.sin(t * 5.3) * 0.3; p.lUAz = 0.3; }
  if (a.listen) { p.headX += Math.max(0, Math.sin(t * 2.6)) * 0.08; }
  if (a.laughT > 0) { const k = Math.min(1, a.laughT); p.spine -= 0.12 * k; p.headX = -0.35 * k; p.chest += Math.sin(t * 22) * 0.05 * k; p.hipsY += Math.abs(Math.sin(t * 22)) * 0.006 * k; }
  if (a.holdDrink && kind !== 'pokie' && kind !== 'pool' && kind !== 'darts' && kind !== 'wipe' && kind !== 'cheer') { p.rUAx = -0.25; p.rEL = -1.35; p.rUAz = -0.08; }
  if (a.sipT > 0) { const k = Math.sin(clamp(a.sipT / 1.6, 0, 1) * Math.PI); p.rUAx = lerp(p.rUAx, -1.1, k); p.rEL = lerp(p.rEL, -2.2, k); p.rUAz = lerp(p.rUAz, 0.35, k); p.headX = lerp(p.headX, -0.35, k); }
  if (a.smoking) { const k = a.dragT > 0 ? Math.sin(clamp(a.dragT / 2, 0, 1) * Math.PI) : 0; p.lUAx = lerp(-0.2, -0.9, k); p.lEL = lerp(-1.5, -2.35, k); p.lUAz = lerp(0.15, -0.3, k); }
  return p;
}
const JOINT_MAP = [['hips', 'x', 'hipsX'], ['hips', 'z', 'hipsZ'], ['spine', 'z', 'spineZ'], ['spine', 'x', 'spine'], ['chest', 'x', 'chest'], ['head', 'x', 'headX'], ['head', 'y', 'headY'], ['lUA', 'x', 'lUAx'], ['lUA', 'z', 'lUAz'], ['lEL', 'x', 'lEL'], ['rUA', 'x', 'rUAx'], ['rUA', 'z', 'rUAz'], ['rEL', 'x', 'rEL'], ['lTH', 'x', 'lTH'], ['lKN', 'x', 'lKN'], ['rTH', 'x', 'rTH'], ['rKN', 'x', 'rKN'], ['lFT', 'x', 'lFT'], ['rFT', 'x', 'rFT']];
function applyPose(h, p, dt, speed = 10, skip = {}) {
  const J = h.J;
  J.hips.position.y = damp(J.hips.position.y, p.hipsY, speed, dt);
  for (const [j, ax, k] of JOINT_MAP) { if (skip[j]) continue; J[j].rotation[ax] = damp(J[j].rotation[ax], p[k], speed, dt); }
  // keep shoulders rotating around x before z, so arm swing reads naturally
}
// analytic two-bone IK for an arm, target in world space
const _ikA = new THREE.Vector3(), _ikB = new THREE.Vector3(), _ikM = new THREE.Matrix4();
function armIK(h, side, target, pole = V3(0, -0.6, -1)) {
  const J = h.J, ua = J[side + 'UA'], el = J[side + 'EL'];
  const s = h.scale, L1 = 0.29 * s, L2 = 0.29 * s;
  J.chest.updateWorldMatrix(true, false);
  const tl = J.chest.worldToLocal(_ikA.copy(target)).sub(ua.position);
  // work in chest-local units (chest inherits body scale)
  const ws = new THREE.Vector3(); J.chest.getWorldScale(ws); const l1 = 0.29, l2 = 0.29;
  const d = clamp(tl.length(), 0.05, l1 + l2 - 0.001);
  const dir = tl.clone().normalize();
  const a1 = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const pl = pole.clone().applyAxisAngle(V3(0, 1, 0), 0); pl.x *= side === 'l' ? 1 : -1;
  const n = new THREE.Vector3().crossVectors(dir, pl).normalize();
  if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
  const u = dir.clone().applyAxisAngle(n, -a1); // upper arm direction (bent toward pole)
  const yAx = u.clone().negate(), xAx = n.clone(), zAx = new THREE.Vector3().crossVectors(xAx, yAx).normalize(); xAx.crossVectors(yAx, zAx).normalize();
  _ikM.makeBasis(xAx, yAx, zAx); ua.quaternion.setFromRotationMatrix(_ikM);
  const elbow = u.clone().multiplyScalar(l1); const f = tl.clone().sub(elbow).normalize();
  const fl = f.applyQuaternion(ua.quaternion.clone().invert());
  el.rotation.set(Math.atan2(-fl.z, -fl.y), 0, 0);
}

// =====================================================================
//  NPC NAVIGATION GRAPH
// =====================================================================
const NODES = {
  S2: V3(-6, 0, 8), S0: V3(0, 0, 6), S1: V3(0, 0, 3.4), D0: V3(0, 0, 0.6), D1: V3(2.6, 0, -0.6), P1: V3(-2, 0, -2.2), P2: V3(-6.9, 0, -2.4), P3: V3(-6.9, 0, -8), P4: V3(-6.9, 0, -13.2),
  P5: V3(-3.4, 0, -8.2), P6: V3(-0.6, 0, -11), P7: V3(1.6, 0, -10), P8: V3(-6.5, 0, -16.3), G1: V3(4.3, 0, -10), G2: V3(4.0, 0, -15.2), G3: V3(9.6, 0, -15.2), G4: V3(9.6, 0, -9.2),
  G5: V3(7.5, 0, -5.6), L1: V3(7.5, 0, -2.9), L2: V3(4.4, 0, -0.5), L3: V3(11.0, 0, -0.5), G6: V3(11.6, 0, -13), T1: V3(14.5, 0, -13), T2: V3(16.4, 0, -10.6), T3: V3(16.2, 0, -15.6),
  FB: V3(-10.4, 0, -8)
};
const EDGES = [['S2', 'S0'], ['S0', 'S1'], ['S1', 'D0'], ['D0', 'P1'], ['D0', 'D1'], ['D1', 'L2'], ['L2', 'L1'], ['L2', 'L3'], ['L3', 'L1'], ['L1', 'G5'], ['P1', 'P2'], ['P2', 'P3'], ['P3', 'P4'], ['P4', 'P8'], ['P1', 'P5'], ['P5', 'P3'], ['P5', 'P6'], ['P6', 'P4'], ['P6', 'P7'], ['P5', 'P7'], ['P7', 'G1'], ['G1', 'G2'], ['G1', 'G4'], ['G2', 'G3'], ['G3', 'G4'], ['G3', 'G6'], ['G4', 'G6'], ['G4', 'G5'], ['G6', 'T1'], ['T1', 'T2'], ['T1', 'T3'], ['T2', 'T3'], ['P6', 'P8']];
const ADJ = {}; for (const k in NODES) ADJ[k] = []; for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }
function nearestNode(p, filter) {
  let best = null, bd = 1e9;
  for (const k in NODES) { if (k === 'FB') continue; if (filter && !filter(k)) continue; const n = NODES[k]; const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < bd) { bd = d; best = k; } }
  return best;
}
function nodeRegion(k) { return k[0] === 'S' ? 'out' : k[0] === 'T' ? 'ter' : k[0] === 'G' ? 'gam' : k[0] === 'L' ? 'lou' : k[0] === 'Y' ? 'gar' : 'bar'; }
function regionOf(p) { if (onTerrace(p.x, p.z)) return 'ter'; if (inGarden(p.x, p.z)) return 'gar'; if (!isInside(p.x, p.z)) return 'out'; if (inGaming(p.x, p.z)) return 'gam'; if (p.x > 3 && p.z > -4) return 'lou'; return 'bar'; }
function findPath(from, to) {
  const rf = regionOf(from), rt = regionOf(to);
  const a = nearestNode(from, k => nodeRegion(k) === rf || (rf === 'lou' && k === 'D1')) || nearestNode(from);
  const b = nearestNode(to, k => nodeRegion(k) === rt || (rt === 'lou' && k === 'D1')) || nearestNode(to);
  const prev = { [a]: null }, q = [a];
  while (q.length) { const c = q.shift(); if (c === b) break; for (const n of ADJ[c]) if (!(n in prev)) { prev[n] = c; q.push(n); } }
  const path = []; let c = b; while (c) { path.unshift(NODES[c].clone()); c = prev[c]; }
  return path;
}

// =====================================================================
//  NPCs
// =====================================================================
const NPCS = [];
const BARKS = {
  any: ["G'day.", "How ya goin'?", "Flat out like a lizard drinkin'.", "Not bad, not bad. Yourself?", "Strewth, what a week.", "Have a good one, mate.", "Yeah, nah. Nah, yeah.", "Fair dinkum, the prices in here.", "She'll be right."],
  bar: ["These schooners are gettin' smaller, I swear.", "Your shout next, mate.", "Nine-fifty for a schooner? Daylight robbery.", "Tap beer's cold tonight, at least.", "Barry reckons the bitter's off. Barry reckons a lot of things."],
  pokie: ["This thing's eaten fifty already.", "She's due. She's GOTTA be due.", "Don't sit at that one, it's cursed.", "Got the feature and it paid forty cents. Forty cents!", "Told meself twenty bucks. That was a hundred ago.", "Missus thinks I'm at footy training."],
  smoke: ["Got a light, mate?", "Forty-five bucks a pack now. Forty-five!", "Gonna quit after this one. Again.", "Only place left you can have a dart and a punt."],
  lounge: ["Chips are ripper here.", "Parma's the size of a hubcap.", "Kids are at their nan's. Freedom."],
  street: ["Cold one tonight.", "Bloody bus never came.", "Just havin' a quick dart before I go in."],
};
function mkNPC(o = {}) {
  const h = makeHuman(o);
  const n = {
    h, name: o.name || choice(NPC_NAMES), pos: (o.pos || V3()).clone(), ry: o.ry || 0, vel: V3(), state: 'idle', spot: null, path: [], timer: rand(20, 80),
    a: { seed: Math.random() * 10, walkPh: 0, sitH: 0.75, tapT: 0, talk: 0, holdDrink: false, sipT: 0, smoking: false, dragT: 0, drunk: rand(0, 0.6) },
    kind: 'stand', speed: rand(1.0, 1.3), barkT: rand(5, 30), cheerT: 0, prop: null, cig: null, role: o.role || 'patron', smoker: o.smoker ?? Math.random() < 0.3, gambler: o.gambler ?? Math.random() < 0.45, hasPhone: false
  };
  h.root.position.copy(n.pos); h.root.rotation.y = n.ry; scene.add(h.root);
  // drink prop
  n.glass = makeGlass(choice(['schooner', 'schooner', 'pot', 'pint', 'rum']));
  n.glass.fill = rand(0.3, 1);
  h.J.rH.add(n.glass.group); n.glass.group.position.set(0, -0.08, 0.03); n.glass.group.rotation.x = 0;
  n.glass.group.visible = false;
  // cigarette prop in left hand
  const cig = new THREE.Group(); const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 6), MAT.white); cb.rotation.z = Math.PI / 2; cig.add(cb);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), MAT.ember); tip.position.x = 0.036; cig.add(tip);
  cig.position.set(0, -0.07, 0.02); cig.visible = false; h.J.lH.add(cig); n.cig = cig; n.cigTip = tip;
  // phone (a glowing screen in the left hand) and face animation state
  const ph = new THREE.Mesh(phoneGeo(), phoneMats()); ph.position.set(0.0, -0.075, 0.025); ph.rotation.x = -1.2; ph.visible = false; h.J.lH.add(ph); n.phone = ph;
  n.blinkT = rand(1, 5); n.idleT = rand(8, 25);
  if (Math.random() < 0.35) n.a.crossed = true;
  NPCS.push(n);
  return n;
}
function freeSpots(filter) { return SPOTS.filter(s => !s.occ && !s.hidden && filter(s)); }
function claim(n, s) { if (n.spot) n.spot.occ = null; n.spot = s; s.occ = n; if (s.machine) s.machine.occupiedBy = n; }
function release(n) { if (n.spot) { if (n.spot.machine && n.spot.machine.occupiedBy === n) { n.spot.machine.occupiedBy = null; n.spot.machine.setMode('idle'); } n.spot.occ = null; } n.spot = null; }
function chooseNextSpot(n) {
  const ev = Game.state.event;
  const w = [];
  const add = (f, weight) => { const list = freeSpots(f); if (list.length) w.push([list, weight]); };
  if (n.gambler) add(s => s.kind === 'pokie' && (!s.smoke || n.smoker), 4);
  add(s => s.area === 'bar' && (s.kind === 'stool' || s.kind === 'stand' || s.kind === 'lean'), 3);
  add(s => s.area === 'lounge', ev === 'parma' ? 4 : 1.5);
  add(s => s.kind === 'pool' || s.anim === 'darts', 0.8);
  if (n.smoker) add(s => s.smoke && s.kind !== 'pokie', 1.6);
  add(s => s.area === 'garden', Game.state.time < 19 ? 2.2 : 1.1);
  if (!w.length) return null;
  const list = wpick(w.map(x => x[0]), w.map(x => x[1]));
  return choice(list);
}
// people walking in from the street go round the parked ute / planter in front of the pub (box x -7.7..-2.7, z 10.4..12.3)
function streetApproach(n) { const w = [V3(-8.6, 0, 13.0), V3(-8.6, 0, 9.4), NODES.S2.clone(), NODES.S0.clone()]; if (n.pos.z < 12.9 || n.pos.x < -9) return w.slice(2); return w; }
function sendTo(n, s) {
  claim(n, s);
  n.path = findPath(n.pos, s.pos); n.path.push(s.pos.clone());
  n.state = 'walk'; n.kind = 'walk';
  n.a.holdDrink = Math.random() < 0.6; n.glass.group.visible = n.a.holdDrink;
}
function spawnPatrons(count) {
  // pre-seat most people; a couple arrive from the street over time
  for (let i = 0; i < count; i++) {
    const n = mkNPC();
    const s = chooseNextSpot(n);
    if (!s) { scene.remove(n.h.root); NPCS.pop(); continue; }
    claim(n, s); n.pos.copy(s.pos); n.ry = s.ry; seatNPC(n);
  }
}
function seatNPC(n) {
  const s = n.spot; n.state = 'idle'; n.pos.copy(s.pos); n.ry = s.ry; n.vel.set(0, 0, 0);
  n.a.sitH = s.sitH || 0.75;
  n.kind = s.kind === 'pokie' ? 'pokie' : (s.kind === 'stool' || s.kind === 'chair') ? 'sit' : s.kind === 'lean' ? 'lean' : s.kind === 'pool' ? 'pool' : s.anim === 'darts' ? 'darts' : 'stand';
  n.timer = s.kind === 'pokie' ? rand(60, 200) : rand(40, 160);
  n.a.smoking = n.smoker && !!s.smoke; n.cig.visible = n.a.smoking;
  n.a.holdDrink = n.kind !== 'pokie' && n.kind !== 'pool' && n.kind !== 'darts' && Math.random() < 0.8; n.glass.group.visible = n.a.holdDrink || n.kind === 'pokie';
  if (n.kind === 'pokie') { s.machine.occupiedBy = n; s.machine.setMode('npc'); s.machine.betIdx = choice([0, 1, 1, 2, 3]); s.machine.credit = choice([20, 50, 50, 100]);
    // glass sits on the ledge
    n.h.root.attach(n.glass.group); n.glass.group.position.copy(s.machine.ledge).sub(n.pos).applyAxisAngle(V3(0, 1, 0), -n.ry); n.glass.group.position.y = s.machine.ledge.y; n.glass.group.rotation.set(0, 0, 0); n.glassOnLedge = true;
  } else if (n.glassOnLedge) { n.h.J.rH.attach(n.glass.group); n.glass.group.position.set(0, -0.08, 0.03); n.glass.group.rotation.set(0, 0, 0); n.glassOnLedge = false; }
}
function updateNPC(n, dt, t, player) {
  const a = n.a;
  a.tapT = Math.max(0, a.tapT - dt); a.sipT = Math.max(0, a.sipT - dt); a.talk = Math.max(0, a.talk - dt); a.dragT = Math.max(0, a.dragT - dt); n.cheerT = Math.max(0, n.cheerT - dt);
  if (n.role === 'bartender') return updateBartender(n, dt, t, player);
  if (n.mg) return updateMGNPC(n, dt, t, player);
  if (n.state === 'walk') {
    if (n.glassOnLedge) { n.h.J.rH.attach(n.glass.group); n.glass.group.position.set(0, -0.08, 0.03); n.glass.group.rotation.set(0, 0, 0); n.glassOnLedge = false; }
    const tgt = n.path[0];
    if (!tgt) { seatNPC(n); }
    else {
      const dx = tgt.x - n.pos.x, dz = tgt.z - n.pos.z, d = Math.hypot(dx, dz);
      const last = n.path.length === 1;
      if (d < (last ? 0.08 : 0.45)) { n.path.shift(); if (!n.path.length) seatNPC(n); }
      else {
        let vx = dx / d * n.speed, vz = dz / d * n.speed;
        // separation from player + others
        const sep = (ox, oz, r) => { const ex = n.pos.x - ox, ez = n.pos.z - oz, e = Math.hypot(ex, ez); if (e < r && e > 0.01) { vx += ex / e * (r - e) * 3; vz += ez / e * (r - e) * 3; } };
        sep(player.x, player.z, 0.9);
        for (const o of NPCS) if (o !== n && o.state === 'walk') sep(o.pos.x, o.pos.z, 0.6);
        n.vel.x = damp(n.vel.x, vx, 8, dt); n.vel.z = damp(n.vel.z, vz, 8, dt);
        n.pos.x += n.vel.x * dt; n.pos.z += n.vel.z * dt;
        if (!last || d > 0.9) collideCircle(n.pos, 0.22);
        n.ry = n.ry + angleDiff(n.ry, Math.atan2(n.vel.x, n.vel.z)) * Math.min(1, dt * 8);
        a.walkPh += dt * n.speed * 5.4;
      }
    }
    if (n.leaving && !isInside(n.pos.x, n.pos.z) && n.pos.z > 7.5) { n.gone = true; }
  } else {
    // idle at spot
    const s = n.spot;
    if (s) n.ry = n.ry + angleDiff(n.ry, s.ry) * Math.min(1, dt * 5);
    n.timer -= dt;
    if (n.kind === 'pokie' && s && s.machine) {
      const m = s.machine; m.npcTick(dt); if (m.state === 'spinning' && m.st < 0.1) a.tapT = 0.35;
      if (m.state === 'showWin' && m.win > m.bet * 10 && m.st < 0.1) { n.cheerT = 2; bark(n, choice(["Get in!", "YES! About bloody time!", "Come on!"]), true); }
      if (m.credit < m.bet && m.state === 'ready' && Math.random() < dt * 0.1) n.timer = 0;
    }
    // social life: chat with whoever shares your table / neighbouring stool
    const partner = s && s.group ? SPOTS.find(o => o !== s && o.group === s.group && o.occ && o.occ !== n && o.occ.state === 'idle' && o.occ.role !== 'bartender') : null;
    n.partner = partner ? partner.occ : null;
    if (n.partner) {
      const cv = CONVS[s.group] || (CONVS[s.group] = { talker: n, t: rand(2, 5) });
      cv.t -= dt / 2; // two members tick it
      if (cv.t <= 0) { cv.talker = cv.talker === n ? n.partner : n; cv.t = rand(2.5, 6); if (Math.random() < 0.22) { n.a.laughT = 1.3; n.partner.a.laughT = 1.3; if (n.dist2 < 60) SFX.laugh(n.pos.clone().add(V3(0, 1.6, 0))); } }
      a.listen = cv.talker !== n; if (!a.listen) a.talk = Math.max(a.talk, 0.25);
      a.phone = false;
    } else {
      a.listen = false;
      n.idleT -= dt;
      if (n.idleT <= 0) { n.idleT = rand(10, 30); a.phone = n.kind !== 'pokie' && !a.smoking && Math.random() < 0.4; }
    }
    if (a.holdDrink && a.sipT <= 0 && Math.random() < dt * 0.06) { a.sipT = 1.6; n.glass.fill = Math.max(0.1, n.glass.fill - 0.08); }
    if (a.smoking) { if (a.dragT <= 0 && Math.random() < dt * 0.08) a.dragT = 2; n.cigTip.material = MAT.ember; if (Math.random() < dt * 6) { n.cigTip.updateWorldMatrix(true, false); smokeFX.emit(_v1.setFromMatrixPosition(n.cigTip.matrixWorld), V3(rand(-.02, .02), 0.12, rand(-.02, .02)), 0.02, rand(3, 5), 0.22, [0.85, 0.85, 0.88], 0.06); }
      if (a.dragT > 0 && a.dragT < 0.3 && Math.random() < dt * 30) { n.h.J.head.updateWorldMatrix(true, false); const hp = _v1.setFromMatrixPosition(n.h.J.head.matrixWorld).add(V3(0, 0.08, 0)); const fw = V3(Math.sin(n.ry), 0.15, Math.cos(n.ry)); smokeFX.emit(hp.addScaledVector(fw, 0.12), fw.multiplyScalar(0.5), 0.05, 3, 0.18, [0.9, 0.9, 0.92], 0.18); } }
    if (n.timer <= 0) {
      const ns = Math.random() < 0.1 ? SPOTS.find(s => s.kind === 'toilet') : chooseNextSpot(n);
      if (ns && ns !== n.spot && !ns.occ) { release(n); sendTo(n, ns); }
      else n.timer = rand(20, 60);
      if (ns && ns.kind === 'toilet') ns.occ = null;
    }
  }
  // barks when player nearby
  const pd = Math.hypot(player.x - n.pos.x, player.z - n.pos.z);
  n.barkT -= dt;
  if (pd < 3.2 && n.barkT <= 0 && n.state === 'idle') { n.barkT = rand(25, 60); const ar = n.spot ? (n.spot.kind === 'pokie' ? 'pokie' : n.a.smoking ? 'smoke' : n.spot.area) : 'any'; bark(n, choice((BARKS[ar] || []).concat(BARKS.any, Game.dayBarks()))); }
  // look at player when close
  const lookAt = pd < 2.6 && n.state === 'idle';
  const kind = n.cheerT > 0 ? 'cheer' : n.kind;
  const p = poseFor(kind, t + a.seed, a);
  if (lookAt) { const ang = angleDiff(n.ry, Math.atan2(player.x - n.pos.x, player.z - n.pos.z)); p.headY = clamp(ang, -1.1, 1.1); p.headX = -0.05; }
  else if (n.partner && n.state === 'idle') { const ang = angleDiff(n.ry, Math.atan2(n.partner.pos.x - n.pos.x, n.partner.pos.z - n.pos.z)); p.headY = clamp(ang, -1.1, 1.1); }
  if (n.glassOnLedge) { p.rUAx = kind === 'pokie' ? p.rUAx : p.rUAx; }
  applyPose(n.h, p, dt, n.state === 'walk' ? 14 : 6);
  faceAnim(n, dt, t);
  n.phone.visible = !!a.phone && n.state === 'idle' && n.dist2 < 600;
  n.h.root.position.set(n.pos.x, groundY(n.pos.x, n.pos.z), n.pos.z); n.h.root.rotation.y = n.ry;
  if (!n.glassOnLedge && n.glass.group.visible && n.dist2 < 400) uprightInHand(n.glass.group, n.ry, a.sipT > 0 ? Math.sin(clamp(a.sipT / 1.6, 0, 1) * Math.PI) * 1.3 : 0);
  if (n.glass.group.visible && n.dist2 < 400) n.glass.update(dt, t);
}
const CONVS = {};
// soft contact shadows under every person (one instanced draw call)
let peopleShadows = null;
function updatePeopleShadows() {
  if (!peopleShadows) { peopleShadows = new THREE.InstancedMesh(G.plane, MAT.blob, 64); peopleShadows.frustumCulled = false; peopleShadows.renderOrder = 1; scene.add(peopleShadows); }
  let i = 0;
  for (const n of NPCS) { if (i >= 64) break; const s = n.state === 'walk' ? 0.75 : (n.kind === 'sit' || n.kind === 'pokie') ? 0.95 : 0.8; _m1.compose(_v1.set(n.pos.x, groundY(n.pos.x, n.pos.z) + 0.006, n.pos.z), _q1.setFromEuler(_e1.set(-Math.PI / 2, 0, 0)), _v2.set(s, s, 1)); peopleShadows.setMatrixAt(i++, _m1); }
  peopleShadows.count = i; peopleShadows.instanceMatrix.needsUpdate = true;
}
let _phoneGeo, _phoneMats;
function phoneGeo() { return _phoneGeo || (_phoneGeo = new THREE.BoxGeometry(0.07, 0.14, 0.009)); }
function phoneMats() { if (_phoneMats) return _phoneMats; const body = M({ color: 0x111114, roughness: 0.3, metalness: 0.4 }); const scr = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.7, 0.95) }); return (_phoneMats = [body, body, body, body, scr, body]); }
// blinking eyelids and a jaw that moves while talking / laughing
function faceAnim(n, dt, t) {
  const J = n.h.J, a = n.a;
  if (!J.lids) return;
  n.blinkT -= dt;
  if (n.blinkT < 0) { n.blinkT = rand(2.2, 6); n.blinkLeft = 0.14; }
  if (n.blinkLeft > 0) n.blinkLeft -= dt;
  J.lids.scale.y = n.blinkLeft > 0 ? 1 : 0.05;
  const open = a.laughT > 0 ? 1.5 + Math.abs(Math.sin(t * 20)) * 0.4 : a.talk > 0 ? 0.35 + Math.abs(Math.sin(t * 13 + a.seed)) * 0.95 * (Math.sin(t * 2.3 + a.seed) > -0.6 ? 1 : 0.2) : 0.35;
  J.jaw.scale.y = damp(J.jaw.scale.y, open, 20, dt);
  if (a.laughT > 0) a.laughT -= dt;
}
const _uq = new THREE.Quaternion(), _uq2 = new THREE.Quaternion();
function uprightInHand(g, yaw, tiltToFace) {
  g.parent.updateWorldMatrix(true, false);
  g.parent.getWorldQuaternion(_uq).invert();
  _uq2.setFromEuler(_e1.set(-tiltToFace, yaw, 0, 'YXZ'));
  g.quaternion.copy(_uq).multiply(_uq2);
}
function bark(n, line, loud = false) {
  if (!line) return;
  n.a.talk = 2.2;
  const pd = Game.player ? Math.hypot(Game.player.pos.x - n.pos.x, Game.player.pos.z - n.pos.z) : 0;
  if (pd < (loud ? 8 : 4.5)) Game.subtitle(`<b>${n.name}:</b> ${line}`, 3.5);
  // murmur blip
  SFX.noise(0.5, { freq: rand(400, 900), q: 4, gain: 0.05, attack: 0.05, pos: n.pos.clone().add(V3(0, 1.6, 0)) });
}

// ---------------- bartender: serves & pours ----------------
let bartender = null, beerStream = null;
function makeBartender() {
  bartender = mkNPC({ name: choice(VENUE.bartenders), shirt: { tile: 'collar', c: 0x161616 }, pants: { tile: 'cloth', c: 0x161616 }, role: 'bartender', smoker: false, gambler: false, pos: BAR.tender.home, ry: BAR.tender.ry });
  bartender.glass.group.visible = false;
  // apron
  const ap = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.5), cm(0x1f4d34, 0.9)); ap.position.set(0, -0.05, 0.135); bartender.h.J.spine.add(ap);
  bartender.queue = []; bartender.job = null; bartender.kind = 'wipe';
  beerStream = makeStream();
  return bartender;
}
// order: {type, food, forZ, cb}
function bartenderOrder(o) { bartender.queue.push(o); }
// which tap pours which beer (each T-bar tower has the same four handles)
const TAP_FOR = { pot: 0, schooner: 1, pale: 2, pint: 3 };
const SPIRIT_Z = { scotch: -9.6, bourbon: -8.4, rum: -7.0, vodka: -5.6 }; // where each bottle lives on the back-bar shelves
const SPIRIT_COL = { scotch: 0x8a5a14, bourbon: 0x7a3010, rum: 0x2a1206, vodka: 0xd8e4e8 };
const MIXER_COL = { coke: [0.18, 0.06, 0.02], soda: [0.85, 0.92, 0.95], lemonade: [0.95, 0.95, 0.85], water: [0.8, 0.88, 0.95] };
const BAR_WORK = { iceZ: -10.35, pourZ: -9.85, gunZ: -10.85 };
let iceScoop = null, sodaGun = null;
function buildBarService() {
  const F = BAR.front;
  // ice well set into the back of the counter, full of ice, with the scoop in it
  addBoxS(SB, MAT.chrome, F - 0.5, 1.07, BAR_WORK.iceZ, 0.3, 0.1, 0.42);
  for (let i = 0; i < 26; i++) SB.add(iceGeo(), iceMat(), F - 0.5 + rand(-0.12, 0.12), 1.115 + rand(0, 0.012), BAR_WORK.iceZ + rand(-0.18, 0.18), rand(0, 3), rand(0, 1), rand(0, 1));
  iceScoop = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe8e8ee, metalness: 1, roughness: 0.15, side: THREE.DoubleSide })); cup.rotation.z = Math.PI / 2; iceScoop.add(cup);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), MAT.chrome); handle.rotation.z = Math.PI / 2; handle.position.x = -0.08; iceScoop.add(handle);
  iceScoop.userData.home = V3(F - 0.45, 1.13, BAR_WORK.iceZ + 0.1); iceScoop.position.copy(iceScoop.userData.home); iceScoop.rotation.set(0.4, 0, 0); scene.add(iceScoop);
  // soda gun in its holster by the drip tray
  sodaGun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), MAT.chrome); sodaGun.add(body);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.04, 8), MAT.blackPlastic); nozzle.position.y = -0.075; sodaGun.add(nozzle);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.012), M({ color: [0xc8201a, 0x2a8a3a, 0xf0d040, 0x3a6ad8, 0xffffff][i], roughness: 0.4 })); b.position.set(0.022, 0.04 - i * 0.016, 0); sodaGun.add(b); }
  sodaGun.userData.home = V3(F - 0.62, 1.22, BAR_WORK.gunZ); sodaGun.position.copy(sodaGun.userData.home); scene.add(sodaGun);
  addBoxS(SB, MAT.chrome, F - 0.64, 1.17, BAR_WORK.gunZ, 0.05, 0.1, 0.06);
  // the kitchen pass: a stainless hot bench with heat lamps and the order-up bell, at the lounge end of the back bar
  addBoxS(SB, MAT.chrome, -11.3, 0.9, -2.72, 1.0, 0.05, 0.42); addBoxS(SB, MAT.chrome, -11.3, 0.45, -2.72, 0.96, 0.9, 0.4);
  for (const dx of [-0.3, 0.3]) { addCylS(SB, MAT.blackPlastic, -11.3 + dx, 1.62, -2.72, 0.07, 0.12, 12); SB.add(G.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0.25) }), -11.3 + dx, 1.54, -2.72, 0, 0, 0, 0.055, 0.025, 0.055); addCylS(SB, MAT.chrome, -11.3 + dx, 1.9, -2.72, 0.012, 0.6, 6); }
  addCylS(SB, MAT.brass, -10.95, 0.95, -2.72, 0.04, 0.035, 14); addBoxS(SB, MAT.brass, -10.95, 0.99, -2.72, 0.012, 0.012, 0.012);
  signPlane(signTex(['ORDER UP'], { w: 256, h: 64, bg: '#7a1f14', color: '#f3e2b8', size: 38 }), 0.5, 0.12, -11.3, 1.32, -2.52, Math.PI);
  // a black rubber hose snaking down under the bar
  SB.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(F - 0.64, 1.12, BAR_WORK.gunZ), V3(F - 0.7, 0.9, BAR_WORK.gunZ - 0.05), V3(F - 0.68, 0.5, BAR_WORK.gunZ - 0.1)]), 10, 0.008, 5), MAT.rubber);
}
function makeBottle(kind) {
  const g = new THREE.Group(), col = SPIRIT_COL[kind] || 0x6a3a10;
  const glass = M({ color: col, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.2, 14), glass); body.position.y = 0.1; g.add(body);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.038, 0.05, 14), glass); sh.position.y = 0.225; g.add(sh);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.06, 10), glass); neck.position.y = 0.28; g.add(neck);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.007, 0.045, 8), MAT.chrome); spout.position.set(0, 0.33, 0); spout.rotation.z = 0.35; g.add(spout);
  const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0385, 0.08, 14, 1, true, -0.9, 1.8), M({ color: kind === 'vodka' ? 0x1a3a8a : kind === 'rum' ? 0xe8c070 : 0xf2e6c8, roughness: 0.8 })); lbl.position.y = 0.1; g.add(lbl);
  g.userData.tip = V3(0.012, 0.35, 0);
  return g;
}
function updateBartender(n, dt, t, player) {
  const a = n.a; let p;
  const F = BAR.front;
  const goTo = (x, z, spd = 1.5) => { const dx = x - n.pos.x, dz = z - n.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) return true; const s = Math.min(d, spd * dt); n.pos.x += dx / d * s; n.pos.z += dz / d * s; n.ry += angleDiff(n.ry, Math.atan2(dx, dz)) * Math.min(1, dt * 10); a.walkPh += dt * 7; return false; };
  const face = (ry, k = 8) => { n.ry += angleDiff(n.ry, ry) * Math.min(1, dt * k); };
  if (!n.job && n.queue.length) {
    const j = n.job = n.queue.shift(); j.t = 0;
    const D = j.type ? DRINKS[j.type] : null;
    if (D && D.beer) { // right beer, right tap, nearest tower
      const base = Math.abs(-11.5 - j.forZ) < Math.abs(-6.5 - j.forZ) ? 0 : 4;
      j.tap = BAR.taps[base + (TAP_FOR[j.type] ?? 1)]; j.phase = 'toTap';
    } else if (D) j.phase = D.ice ? 'toIce' : 'toShelf';
    else j.phase = j.food ? 'toPass' : 'toCustomer';
  }
  const j = n.job;
  let ik = null, ikL = null, walking = false, pole = V3(0.6, -0.8, -0.6);
  const glassAt = V3(F - 0.5, 1.115, BAR_WORK.pourZ);
  const newGlass = () => { if (!j.glass) { j.glass = makeGlass(j.type); j.glass.fill = 0; j.glass.foam = 0; scene.add(j.glass.group); j.glass.group.position.copy(glassAt); } };
  const stream = (from, toY, col) => { beerStream.visible = true; beerStream.material.uniforms.uTime.value = t; beerStream.material.uniforms.uCol.value.setRGB(...col); const len = Math.max(0.01, from.y - toY); beerStream.position.set(from.x, from.y - len / 2, from.z); beerStream.scale.set(1, len, 1); };
  if (!j) {
    walking = !goTo(BAR.tender.home.x, BAR.shift ? -12.6 : clamp(player.z, BAR.z0 + 1, BAR.z1 - 1) * 0.3 + BAR.tender.home.z * 0.7, 0.8);
    if (!walking) face(Math.PI / 2, 4);
    p = poseFor(walking ? 'walk' : (Math.sin(t * 0.13) > 0.2 ? 'wipe' : 'stand'), t, a);
  } else {
    j.t += dt;
    const D = j.type ? DRINKS[j.type] : null;
    // ---------------- beer from the tap
    if (j.phase === 'toTap') { if (goTo(-9.42, j.tap.z)) { face(Math.PI / 2); if (j.t > 0.5) { j.phase = 'grab'; j.t = 0; } } else walking = true; }
    else if (j.phase === 'grab') { newGlass(); if (j.t > 0.45) { j.phase = 'pour'; j.t = 0; SFX.pourStart(); } }
    else if (j.phase === 'pour') {
      const dur = 4.2, k = clamp(j.t / dur, 0, 1);
      j.glass.fill = k;
      const tilt = lerp(0.75, 0.0, smooth(clamp((k - 0.15) / 0.6, 0, 1)));
      j.glass.foam = D.foam * smooth(clamp((k - 0.55) / 0.45, 0, 1)) * 1.4;
      const spout = j.tap.spout;
      ik = V3(spout.x - 0.01, spout.y - 0.16 + 0.03 * (1 - k), spout.z); j.tilt = tilt;
      ikL = V3(F - 0.43, 1.62, spout.z + 0.02);
      j.tap.handle.rotation.z = damp(j.tap.handle.rotation.z, 0.7, 10, dt);
      j.glass.group.updateWorldMatrix(true, false);
      stream(V3(spout.x, spout.y - 0.005, spout.z), _v1.setFromMatrixPosition(j.glass.group.matrixWorld).y + j.glass.y0 + (j.glass.y1 - j.glass.y0) * k, D.col);
      SFX.pourUpdate(k);
      if (Math.random() < dt * 30) dropFX.emit(V3(spout.x, ik.y, spout.z), V3(rand(-.1, .1), rand(0.2, 0.5), rand(-.1, .1)), 0.004, 0.3, 0.5, [1, 0.95, 0.85]);
      if (k >= 1) { j.phase = 'settle'; j.t = 0; SFX.pourStop(); beerStream.visible = false; }
    } else if (j.phase === 'settle') { j.tap.handle.rotation.z = damp(j.tap.handle.rotation.z, 0, 10, dt); if (j.t > 0.5) { j.phase = 'toCustomer'; j.t = 0; } }
    // ---------------- spirits & mixers: ice → bottle → pour → mixer → bottle back → serve
    else if (j.phase === 'toIce') { if (goTo(-9.42, BAR_WORK.iceZ)) { face(Math.PI / 2); newGlass(); if (j.t > 0.3) { j.phase = 'scoop'; j.t = 0; } } else walking = true; }
    else if (j.phase === 'scoop') {
      const k = j.t;
      const well = V3(F - 0.5, 1.12, BAR_WORK.iceZ), above = glassAt.clone().add(V3(0, 0.22, 0));
      ik = k < 0.5 ? well.clone().add(V3(0, 0.08 - k * 0.1, 0)) : above.clone().lerp(well.clone().add(V3(0, 0.1, 0)), Math.max(0, 1 - (k - 0.5) * 2.5));
      iceScoop.position.copy(ik).add(V3(0.02, -0.04, 0)); iceScoop.rotation.set(0.4, 0, k > 0.9 ? -1.2 : 0);
      if (k > 0.5 && !j.scooped) { j.scooped = true; SFX.noise(0.25, { freq: 2600, q: 1.2, gain: 0.08, pos: well }); }
      if (k > 1.05 && !j.iced) { j.iced = true; j.glass.addIce(D.ice || 3); for (let i = 0; i < 3; i++) SFX.tone(rand(2800, 4200), 0.12, { delay: i * 0.06, gain: 0.04, pos: glassAt }); }
      if (k > 1.5) { iceScoop.position.copy(iceScoop.userData.home); iceScoop.rotation.set(0.4, 0, 0); j.phase = D.spirit ? 'toShelf' : 'mixer'; j.t = 0; }
    } else if (j.phase === 'toShelf') {
      const z = SPIRIT_Z[D.spirit] ?? -8;
      if (goTo(-12.05, z)) { face(-Math.PI / 2); ik = V3(-12.62, 1.78, z); if (j.t > 0.6 && !j.bottle) { j.bottle = makeBottle(D.spirit); scene.add(j.bottle); SFX.tone(1800, 0.05, { gain: 0.04, pos: ik }); } if (j.t > 0.9) { j.phase = 'toPour'; j.t = 0; } } else walking = true;
    } else if (j.phase === 'toPour') { if (goTo(-9.42, BAR_WORK.pourZ + 0.08)) { face(Math.PI / 2); if (j.t > 0.3) { j.phase = 'pourSpirit'; j.t = 0; } } else walking = true; }
    else if (j.phase === 'pourSpirit') {
      const dur = 1.8, k = clamp(j.t / dur, 0, 1), tilt = smooth(clamp(j.t / 0.35, 0, 1)) * (1 - smooth(clamp((j.t - dur) / 0.3, 0, 1)));
      ik = glassAt.clone().add(V3(-0.06, 0.25, 0.05)); j.bottleTilt = tilt * 2.1;
      ikL = glassAt.clone().add(V3(0.02, 0.07, -0.03)); // steadying the glass
      if (tilt > 0.8 && k < 1) { j.glass.fill = Math.max(j.glass.fill, (D.pourTo || 0.3) * clamp((j.t - 0.3) / (dur - 0.3), 0, 1)); j.pouring = true; SFX.pourUpdate(0.3); if (!j.glug) { j.glug = true; SFX.pourStart(); } } else j.pouring = false;
      if (j.t > dur + 0.35) { SFX.pourStop(); beerStream.visible = false; j.phase = D.mixer ? 'mixer' : 'putBack'; j.t = 0; }
    } else if (j.phase === 'mixer') {
      if (!goTo(-9.42, BAR_WORK.pourZ + 0.08)) { walking = true; }
      else {
        face(Math.PI / 2);
        const dur = 2.0, k = clamp(j.t / dur, 0, 1), aboveGlass = glassAt.clone().add(V3(0, 0.24, 0));
        ikL = aboveGlass.clone().add(V3(0, 0.07, 0)); sodaGun.position.copy(ikL).add(V3(0, -0.02, 0)); sodaGun.rotation.set(0, 0, 0);
        if (j.t > 0.3 && k < 1) { if (!j.gun) { j.gun = true; SFX.pourStart(); } const from = (D.pourTo || 0); j.glass.fill = from + (0.95 - from) * clamp((j.t - 0.3) / (dur - 0.3), 0, 1); stream(aboveGlass, glassAt.y + j.glass.y0 + (j.glass.y1 - j.glass.y0) * j.glass.fill, MIXER_COL[D.mixer] || [0.8, 0.8, 0.8]); SFX.pourUpdate(0.6); }
        if (k >= 1) { SFX.pourStop(); beerStream.visible = false; sodaGun.position.copy(sodaGun.userData.home); j.phase = j.bottle ? 'putBack' : 'toCustomer'; j.t = 0; }
      }
    } else if (j.phase === 'putBack') {
      const z = SPIRIT_Z[D.spirit] ?? -8;
      if (goTo(-12.05, z)) { face(-Math.PI / 2); ik = V3(-12.62, 1.78, z); if (j.t > 0.5 && j.bottle) { scene.remove(j.bottle); j.bottle = null; SFX.tone(1500, 0.05, { gain: 0.04, pos: ik }); } if (j.t > 0.8) { j.phase = 'fetchGlass'; j.t = 0; } } else walking = true;
    } else if (j.phase === 'fetchGlass') { if (goTo(-9.42, BAR_WORK.pourZ)) { face(Math.PI / 2); ik = glassAt.clone().add(V3(0, 0.07, 0)); if (j.t > 0.4) { j.phase = 'toCustomer'; j.t = 0; j.carry = true; } } else walking = true; }
    // ---------------- food: out to the kitchen pass, ding the bell, collect the plate, carry it back
    else if (j.phase === 'toPass') {
      const PX = -11.3, PZ = -3.05;
      if (goTo(PX, PZ)) { face(Math.PI); ik = V3(PX + 0.1, 1.2, PZ - 0.45); if (j.t > 0.25 && !j.dinged) { j.dinged = true; SFX.bell(V3(PX, 1.3, PZ - 0.5), 1); SFX.noise(0.7, { freq: 3500, q: 1.5, gain: 0.05, pos: V3(PX, 1.2, PZ - 0.5) }); } if (j.t > 1.15) { j.plate = makeFood(legacyFood(j.food, Game.state.event)); scene.add(j.plate); j.hot = FOODS[j.plate.userData.kind].hot; j.phase = 'toCustomer'; j.t = 0; } } else walking = true;
    }
    // ---------------- serve
    else if (j.phase === 'toCustomer') {
      j.tap && (j.tap.handle.rotation.z = damp(j.tap.handle.rotation.z, 0, 10, dt));
      if (j.glass && !j.tap) j.carry = true;
      if (j.plate) ik = V3(n.pos.x + Math.sin(n.ry) * 0.36, 1.12, n.pos.z + Math.cos(n.ry) * 0.36);
      if (goTo(-9.35, clamp(j.forZ, BAR.z0 + 0.6, BAR.z1 - 0.6))) { face(Math.PI / 2); j.phase = 'place'; j.t = 0; } else walking = true;
    } else if (j.phase === 'place') {
      const spot = V3(BAR.front - 0.18, 1.115, clamp(j.forZ, BAR.z0 + 0.6, BAR.z1 - 0.6));
      ik = spot.clone().add(V3(0, 0.07, 0));
      if (j.t > 0.6) {
        let item;
        if (j.glass) { j.glass.group.position.copy(spot); j.glass.group.rotation.set(0, 0, 0); item = { kind: 'drink', glass: j.glass }; SFX.glassDown(spot); }
        else { const plate = j.plate || makeFood(legacyFood(j.food, Game.state.event)); plate.position.copy(spot); plate.rotation.set(0, 0, 0); if (!plate.parent) scene.add(plate); plate.userData.placedAt = elapsed + 0.001; item = { kind: 'food', food: j.food, mesh: plate, spot: spot.clone() }; SFX.glassDown(spot); SFX.noise(0.9, { freq: 4200, q: 1.2, gain: FOODS[plate.userData.kind].hot ? 0.035 : 0, pos: spot }); j.plate = null; }
        bark(n, choice(["There ya go, love.", "Enjoy, mate.", "Cheers.", "There you are.", "Get that into ya."]));
        j.cb && j.cb(item, spot);
        n.job = null;
      }
    }
    p = poseFor(walking ? 'walk' : 'stand', t, a);
  }
  if (walking) p = poseFor('walk', t, a);
  applyPose(n.h, p, dt, 10, ik ? (ikL ? { rUA: 1, rEL: 1, lUA: 1, lEL: 1 } : { rUA: 1, rEL: 1 }) : ikL ? { lUA: 1, lEL: 1 } : {});
  n.h.root.position.set(n.pos.x, 0, n.pos.z); n.h.root.rotation.y = n.ry;
  n.h.root.updateMatrixWorld(true);
  if (ik) armIK(n.h, 'r', ik, pole);
  if (ikL) armIK(n.h, 'l', ikL, pole);
  if (j && j.plate) { n.h.J.rH.updateWorldMatrix(true, false); const hp = _v1.setFromMatrixPosition(n.h.J.rH.matrixWorld); j.plate.position.set(hp.x, hp.y - 0.025, hp.z); j.plate.rotation.set(0, n.ry, 0); }
  if (j) {
    // the bottle sits in his right hand, tipped up while pouring
    if (j.bottle) {
      n.h.J.rH.updateWorldMatrix(true, false);
      const hp = _v1.setFromMatrixPosition(n.h.J.rH.matrixWorld);
      j.bottle.position.copy(hp).add(V3(0, -0.12, 0)); j.bottle.rotation.set(0, 0, -(j.bottleTilt || 0));
      j.bottle.updateMatrixWorld(true);
      if (j.phase === 'pourSpirit' && j.pouring) { const tip = j.bottle.userData.tip.clone().applyMatrix4(j.bottle.matrixWorld); stream(tip, glassAt.y + j.glass.y0 + (j.glass.y1 - j.glass.y0) * j.glass.fill, DRINKS[j.type].col); }
    }
    if (j.glass) {
      const g = j.glass.group;
      if (j.phase === 'pour' && ik) { g.position.copy(ik).add(V3(0, -0.075, 0)); g.rotation.set(0, 0, -(j.tilt || 0)); }
      else if (j.phase === 'place' && ik) { g.position.copy(ik).add(V3(0, -0.07, 0)); g.rotation.set(0, 0, 0); }
      else if (j.carry || j.tap) { n.h.J.rH.updateWorldMatrix(true, false); g.position.setFromMatrixPosition(n.h.J.rH.matrixWorld).add(V3(0, -0.1, 0)); g.rotation.set(0, 0, 0); }
      else { g.position.copy(glassAt); g.rotation.set(0, 0, 0); }
      j.glass.update(dt, t);
    }
  }
}
// food on a plate: a crumbed schnitzel with napoli + melted cheese, chips and salad (parma); a roast; or a bowl of chips
let _foodTex = null;
function foodTextures() {
  if (_foodTex) return _foodTex;
  const crumb = mkCanvas(128, 128), c = crumb.getContext('2d');
  c.fillStyle = '#c8862e'; c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { c.fillStyle = `hsl(${rand(28, 40)},${rand(55, 75)}%,${rand(30, 58)}%)`; c.fillRect(Math.random() * 128, Math.random() * 128, rand(1, 3), rand(1, 3)); }
  const sauce = mkCanvas(128, 128), x = sauce.getContext('2d');
  x.fillStyle = '#b3240f'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${randi(200, 255)},${randi(190, 220)},${randi(90, 140)},${rand(0.55, 0.95)})`; x.beginPath(); x.ellipse(Math.random() * 128, Math.random() * 128, rand(5, 16), rand(4, 12), rand(0, 3), 0, 7); x.fill(); }
  for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(120,60,10,.5)'; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, rand(1, 3), 0, 7); x.fill(); }
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  _foodTex = { crumb: mk(crumb), sauce: mk(sauce) };
  return _foodTex;
}
function makeFoodOld(kind) {
  const g = new THREE.Group(), T = foodTextures();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.115, 0.016, 32), MAT.white); plate.position.y = 0.008; g.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.143, 0.006, 6, 32), MAT.white); rim.rotation.x = Math.PI / 2; rim.position.y = 0.017; g.add(rim);
  g.userData.bites = [];
  const chips = (cx, cz, n, spread) => { for (let i = 0; i < n; i++) { const c = new THREE.Mesh(G.box, cm(choice([0xe8b84a, 0xdca33a, 0xf0c860]), 0.6)); c.scale.set(0.011, 0.011, rand(0.05, 0.075)); c.position.set(cx + rand(-spread, spread), 0.024 + (i % 3) * 0.009, cz + rand(-spread, spread)); c.rotation.set(rand(-0.25, 0.25), rand(0, 3.14), rand(-0.2, 0.2)); g.add(c); g.userData.bites.push(c); } };
  if (kind === 'parma' || kind === 'roast') {
    if (kind === 'parma') {
      // a schnitzel: an irregular flat crumbed shape, sauce and cheese on top
      const sh = new THREE.Shape(); const pts = 14;
      for (let i = 0; i <= pts; i++) { const a = i / pts * Math.PI * 2, r = 0.075 + Math.sin(a * 3 + 1) * 0.008 + Math.sin(a * 5) * 0.005; const px = Math.cos(a) * r * 1.35, pz = Math.sin(a) * r * 0.9; i ? sh.lineTo(px, pz) : sh.moveTo(px, pz); }
      const sch = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.005, bevelSegments: 2, curveSegments: 6 }), new THREE.MeshStandardMaterial({ map: T.crumb, roughness: 0.85 }));
      sch.geometry.rotateX(-Math.PI / 2); sch.position.set(-0.035, 0.02, 0.0); g.add(sch);
      const top = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ map: T.sauce, roughness: 0.35 }));
      top.geometry.rotateX(-Math.PI / 2); top.scale.set(0.86, 1, 0.84); top.position.set(-0.035, 0.0375, 0.0); g.add(top);
      g.userData.main = [sch, top];
    } else {
      for (let i = 0; i < 3; i++) { const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.008, 16), cm(0xc8a088, 0.7)); sl.scale.set(1.3, 1, 0.8); sl.position.set(-0.05 + i * 0.012, 0.022 + i * 0.006, -0.01 + i * 0.02); sl.rotation.z = 0.12; g.add(sl); g.userData.bites.push(sl); }
      for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(G.sph, cm(0xd8a050, 0.6)); p.scale.set(0.022, 0.017, 0.02); p.position.set(0.06 + rand(-0.02, 0.02), 0.03, rand(-0.06, 0.06)); g.add(p); g.userData.bites.push(p); }
      const gravy = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), cm(0x5a2e12, 0.25)); gravy.rotation.x = -Math.PI / 2; gravy.position.set(-0.04, 0.0175, 0); g.add(gravy);
      g.userData.main = [];
    }
    chips(0.085, 0.045, 12, 0.03);
    // salad: a few leaves and a tomato wedge
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.018, 7), new THREE.MeshStandardMaterial({ color: choice([0x5a9a2a, 0x7ab83a, 0x4a8a2a]), roughness: 0.7, side: THREE.DoubleSide })); l.position.set(0.075 + rand(-0.02, 0.02), 0.022 + i * 0.002, -0.06 + rand(-0.015, 0.015)); l.rotation.set(-Math.PI / 2 + rand(-0.4, 0.4), 0, rand(0, 6)); g.add(l); g.userData.bites.push(l); }
    const tom = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6, 0, Math.PI), cm(0xc02a18, 0.4)); tom.position.set(0.1, 0.024, -0.055); tom.rotation.x = -Math.PI / 2; g.add(tom); g.userData.bites.push(tom);
    const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6, 0, Math.PI), cm(0xf2d23a, 0.5)); lemon.position.set(-0.11, 0.024, 0.07); lemon.rotation.set(-Math.PI / 2, 0, 0.6); g.add(lemon);
  } else chips(0, 0, 28, 0.07);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- src/07-player.js ----

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
  if (Eat.active) return;
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
  if (Eat.active) return;
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
  const D = m.dims || _STD_DIMS;
  const eye = m.seatW.clone().add(V3(0, D.eyeY, 0)).addScaledVector(m.fw, 0.06 + D.eyeBack);
  const look = m.screenW.clone().add(V3(0, D.lookY != null ? D.lookY - m.screenW.y : -0.19, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, look, V3(0, 1, 0)));
  return { pos: eye, q };
}

function updatePlayer(dt, t) {
  const s = Game.state, drunk = s.drunk / 100;
  if (Cine.active) { Cine.update(dt); input.mx = input.my = 0; return; }
  if (MG.active) { MG.update(dt, t); if (player.drink) player.drink.update(dt, t); return; }
  // look
  if (input.locked && !player.seated && !Eat.active) {
    const sens = 0.0022 * settings.sens;
    player.yaw -= input.mx * sens; player.pitch -= input.my * sens;
    player.pitch = clamp(player.pitch, -1.45, 1.45);
    vm.lagV.x += -input.mx * 0.004; vm.lagV.y += input.my * 0.004;
  }
  input.mx = input.my = 0;
  vm.lagV.x += -vm.lag.x * 150 * dt; vm.lagV.y += -vm.lag.y * 150 * dt; vm.lagV.multiplyScalar(Math.exp(-12 * dt));
  vm.lag.addScaledVector(vm.lagV, dt); vm.lag.clampLength(0, 0.04);
  let moving = false;
  const wantFov = player.seated ? (player.seated.dims ? player.seated.dims.fov : 55) : settings.fov;
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

// ---- src/08-game.js ----

// =====================================================================
//  GAME: the week loop, economy, menus, events, HUD, main loop
// =====================================================================
const DIFF = {
  easy: { label: 'The Tradie', wallet: 220, bank: 1600, pay: 310, rent: 480, rtp: 1.04, hang: 0.75, cigs: 14 },
  normal: { label: 'The Shiftie', wallet: 120, bank: 650, pay: 190, rent: 420, rtp: 1.0, hang: 1.0, cigs: 9 },
  hard: { label: 'The Uni Student', wallet: 55, bank: 140, pay: 95, rent: 330, rtp: 0.95, hang: 1.3, cigs: 4 },
};
const DAYS = [
  { name: 'MONDAY', start: 19.0, close: 23.0, event: 'monday', title: 'Quiet Monday', weather: 'clear', crowd: 10, work: true,
    desc: "Knocked off from a long shift. The Royal's quiet tonight — a few regulars at the bar, the racing on the telly, and the pokies chiming away out the back.", board: ['MONDAY', '$6.50 POTS', 'TILL 9PM'] },
  { name: 'TUESDAY', start: 18.5, close: 23.0, event: 'parma', title: 'Parma Night', weather: 'cloudy', crowd: 13, work: true,
    desc: "Tuesday means $15 Parma & Pot. The bistro's pumping and you can smell the chips from the footpath.", board: ['TUESDAY', 'PARMA & POT', '$15'] },
  { name: 'WEDNESDAY', start: 19.5, close: 23.5, event: 'trivia', title: 'Trivia Night · 8:30pm', weather: 'rain', crowd: 12, work: true,
    desc: "It's bucketing down. Trivia kicks off at 8:30 — a $50 bar tab for anyone who can name the first PM.", board: ['WEDNESDAY', 'TRIVIA 8:30', '$50 BAR TAB'] },
  { name: 'THURSDAY', start: 17.5, close: 24.0, event: 'jackpot', title: 'Payday · Jackpot Thursday', weather: 'clear', crowd: 16, work: true, payday: true,
    desc: "Payday! Jackpot Thursday — linked jackpots grow twice as fast tonight. Every bloke with a pay slip is in.", board: ['THURSDAY', 'JACKPOT', 'THURSDAY'] },
  { name: 'FRIDAY', start: 16.5, close: 25.0, event: 'knockoff', title: 'Knock-off Drinks', weather: 'clear', crowd: 22, work: true,
    desc: "Knock-off drinks with the crew. It's packed, the jukebox is up, and someone's always shouting a round. $8 schooners 4–6.", board: ['FRIDAY', 'KNOCK-OFF', '$8 SCHOONERS 4-6'] },
  { name: 'SATURDAY', start: 14.0, close: 25.0, event: 'raffle', title: 'Footy + Meat Raffle · 5pm', weather: 'clear', crowd: 24, work: false,
    desc: "Big game on the telly this arvo and the famous Royal meat raffle at 5pm. Tickets $2 each or three for $5 at the bar.", board: ['SATURDAY', 'MEAT RAFFLE', '5PM'] },
  { name: 'SUNDAY', start: 15.0, close: 22.0, event: 'sunday', title: 'Sunday Session · Rent Due', weather: 'clear', crowd: 14, work: false,
    desc: "The Sunday sesh. Rent comes out of the account tonight. Don't do anything stupid.", board: ['SUNDAY', 'SESSION', 'ROAST $22'] },
];
const TRIVIA = [
  ['What is a "schooner" in a NSW pub?', ['A 425ml glass of beer', 'A 285ml glass of beer', 'A jug', 'A small sailing boat']],
  ['Which city is called the "City of Churches"?', ['Adelaide', 'Hobart', 'Perth', 'Brisbane']],
  ['In what year did Australia federate?', ['1901', '1788', '1854', '1915']],
  ['Which race "stops the nation" in November?', ['The Melbourne Cup', 'The Golden Slipper', 'The Cox Plate', 'The Caulfield Cup']],
  ["Who was Australia's first Prime Minister?", ['Edmund Barton', 'Robert Menzies', 'Alfred Deakin', 'John Curtin']],
  ['Phar Lap was a famous what?', ['Racehorse', 'Shipwreck', 'Footy club', 'Pie shop']],
  ["What's the longest river in Australia?", ['The Murray', 'The Darling', 'The Murrumbidgee', 'The Yarra']],
  ['What does "arvo" mean?', ['Afternoon', 'Avocado', 'Evening', 'A long weekend']],
  ['Uluru is in which state or territory?', ['The Northern Territory', 'South Australia', 'Western Australia', 'Queensland']],
  ['Which animal shares the coat of arms with the emu?', ['Kangaroo', 'Koala', 'Wombat', 'Platypus']],
  ['How many states does Australia have?', ['Six', 'Seven', 'Five', 'Eight']],
  ['What is a "pot" in a Victorian pub?', ['A 285ml beer', 'A 425ml beer', 'A pint', 'A jug']],
  ['The Big Banana is in which state?', ['New South Wales', 'Queensland', 'Victoria', 'Tasmania']],
  ['What is the capital of Australia?', ['Canberra', 'Sydney', 'Melbourne', 'Albury']],
];
const KENO_PAY = { 0: 2, 5: 2, 6: 15, 7: 50, 8: 400, 9: 4000, 10: 100000 };

const Game = {
  mode: 'loading', paused: false, uiOpen: false, player, time: 0, frameN: 0, entered: false,
  state: { day: 0, time: 19, wallet: 0, bank: 0, drunk: 0, mood: 60, crave: 30, hunger: 20, bladder: 0, cigs: 0, tickets: [], event: null, stats: {}, night: {}, debts: [], next: {}, cigsTonight: 0, strikes: 0, rel: {}, flags: {}, tonight: {} },
  items: [], // drinks/food sitting on the bar for the player
  keno: { next: 0, drawing: false, drawn: [], shown: 0, t: 0, game: 412, tickets: [] },
  trivia: { done: false }, raffle: { tickets: 0, drawn: false },
  // -------------------------------------------------- lifecycle
  newWeek(diff) {
    const D = DIFF[diff];
    Object.assign(this.state, { diff, day: 0, wallet: D.wallet, bank: D.bank, cigs: D.cigs, tickets: [], debts: [], next: {}, mood: 60, rel: {}, flags: {},
      stats: { wagered: 0, won: 0, drinks: 0, spentDrinks: 0, spentFood: 0, spentSmokes: 0, cigs: 0, jackpots: 0, biggest: 0, glasses: 0, meat: 0, keno: 0, trivia: 0, shouts: 0, atmFees: 0, startWorth: D.wallet + D.bank } });
    rtpMod = D.rtp;
    this.save(); this.showDayCard();
  },
  netWorth() { const s = this.state; return s.wallet + s.bank + s.tickets.reduce((a, b) => a + b, 0) + this.machineCredit(); },
  machineCredit() { return player.seated ? player.seated.credit : 0; },
  save() { const s = this.state; store('ld_save', { diff: s.diff, day: s.day, wallet: s.wallet, bank: s.bank, cigs: s.cigs, tickets: s.tickets, debts: s.debts, next: s.next, stats: s.stats, mood: s.mood, rel: s.rel, flags: s.flags, JP, morningDone: s.morningDone, startHang: s.startHang, startEarly: s.startEarly, morningMsgs: s.morningMsgs }); },
  load() { const d = store('ld_save'); if (!d || d.day == null || d.day > 6) return false; Object.assign(this.state, d); if (d.JP) Object.assign(JP, d.JP); rtpMod = DIFF[d.diff].rtp; return true; },
  showDayCard() {
    const s = this.state, D = DAYS[s.day], dd = DIFF[s.diff];
    const msgs = [];
    // morning: wages, hangover, early-night bonus, debts
    if (!s.morningDone) {
      if (s.day > 0) {
        const prev = DAYS[s.day - 1];
        if (prev.work) {
          let pay = dd.pay * (D.payday ? 1.0 : 1.0);
          if (s.next.hang) { const dock = Math.round(pay * 0.4 * dd.hang); pay -= dock; msgs.push(`<span class="neg">Rolled into work hungover — docked ${fmt0(dock)}.</span>`); }
          if (s.next.early) { const ot = Math.round(dd.pay * 0.5); pay += ot; msgs.push(`<span class="pos">Early night paid off: picked up an overtime shift, +${fmt0(ot)}.</span>`); }
          s.bank += pay; msgs.push(`Pay for ${prev.name[0] + prev.name.slice(1).toLowerCase()}: <b>${fmt0(pay)}</b> into the bank.`);
        } else if (s.next.early) { s.mood = Math.min(100, s.mood + 15); msgs.push('<span class="pos">Slept like a log after an early night. Feeling sharp.</span>'); }
        if (D.payday) { const bonus = Math.round(dd.pay * 0.6); s.bank += bonus; msgs.push(`<span class="pos">Payday top-up (penalty rates): +${fmt0(bonus)}.</span>`); }
        for (const d of s.debts.filter(d => d.day < s.day)) { if (Math.random() < d.chance) { s.wallet += d.amt + 5; msgs.push(`<span class="pos">${d.name} paid back the ${fmt0(d.amt)} he owed you, plus a fiver for your trouble. Legend.</span>`); } else msgs.push(`<span class="neg">${d.name} still hasn't paid back your ${fmt0(d.amt)}. Classic.</span>`); }
        s.debts = s.debts.filter(d => d.day >= s.day);
      }
      s.morningDone = true; s.startHang = !!s.next.hang; s.startEarly = !!s.next.early; s.morningMsgs = msgs.slice();
    } else msgs.push(...(s.morningMsgs || []));
    const start = D.start + (s.startHang ? 1 : 0);
    s.startTime = start;
    const hh = h => { const hr = Math.floor(h) % 24, m = Math.round((h % 1) * 60); return `${hr % 12 === 0 ? 12 : hr % 12}:${String(m).padStart(2, '0')} ${hr >= 12 ? 'PM' : 'AM'}`; };
    $('dayCardInner').innerHTML = `
      <div class="dname">${D.name}</div><div class="dtime">${hh(start)} · DAY ${s.day + 1} OF 7 · ${dd.label.toUpperCase()}</div>
      <div class="event">${D.title}</div>
      <div class="chapter"><small>${CHAPTERS[s.day].title.toUpperCase()}</small>${CHAPTERS[s.day].narr}</div>
      ${s.day < 6 ? `<div class="venues"><small>WHERE TO TONIGHT?</small>${Object.values(VENUES).map(v => { const ok = venueOpen(v.id), here = v.id === VENUE.id; return `<button class="vchip ${here ? 'on' : ''} ${ok ? '' : 'off'}" data-v="${v.id}" ${ok ? '' : 'disabled'}><b>${v.name}</b><span>${ok ? v.blurb : `Locked: build your standing at the Royal first (${v.unlock}+).`}</span><i>${here ? 'you are here' : v.fare ? `cab $${v.fare}` : 'home turf'}${v.story ? ' · story night' : ' · a night off'}</i></button>`; }).join('')}</div>` : ''}
      <p>${D.desc}</p>
      ${s.startHang ? '<p class="neg"><b>Hungover.</b> You got going an hour late and everything is a bit too loud.</p>' : ''}
      ${msgs.map(m => `<p style="margin:4px 0">${m}</p>`).join('')}
      <div class="stats"><div>Wallet<b>${fmt0(s.wallet)}</b></div><div>Bank<b>${fmt0(s.bank)}</b></div><div>Smokes<b>${s.cigs}</b></div><div>Standing<b style="font-size:15px">${Night.tier().name}</b></div><div>Rent (Sun)<b>${fmt0(dd.rent)}</b></div></div>
      <div class="note">Pub shuts at ${hh(D.close)}. Leave early & sober for a bonus tomorrow.</div>
      <div style="margin-top:18px"><button class="cbtn" id="btnGo">HEAD TO THE PUB →</button></div>`;
    $('title').classList.add('hidden'); $('summary').classList.add('hidden'); $('dayCard').classList.remove('hidden');
    $('btnGo').onclick = () => { AudioSys.init(); $('dayCard').classList.add('hidden'); this.startNight(); };
    document.querySelectorAll('.vchip').forEach(b => b.onclick = () => { if (b.dataset.v !== VENUE.id) { AudioSys.init(); travelTo(b.dataset.v); } });
    this.mode = 'card';
  },
  startNight() {
    const s = this.state, D = DAYS[s.day];
    s.event = D.event; s.time = s.startTime; s.drunk = s.startHang ? 12 : 0; s.crave = 40; s.hunger = 35; s.bladder = 5; s.cigsTonight = 0; s.strikes = 0; s.kicked = false; s.tonight = {}; s.rel = s.rel || {}; s.flags = s.flags || {};
    s.night = { startWallet: s.wallet, startBank: s.bank, startTickets: s.tickets.reduce((a, b) => a + b, 0), drinks: 0, spentDrinks: 0, spentFood: 0, spentSmokes: 0, wagered: 0, won: 0, atm: 0, fees: 0, keno: 0, extra: 0, glasses: 0 };
    s.next = {}; s.morningDone = false;
    this.trivia = { done: false }; this.raffle = { tickets: 0, drawn: false }; this.keno.tickets = []; this.keno.next = s.time + 0.05; this.lastDrinks = false; this.entered = false; this.footyT = 0;
    // reset world
    for (const n of NPCS.slice()) if (n !== bartender) { release(n); scene.remove(n.h.root); }
    NPCS.length = 0; NPCS.push(bartender); bartender.queue = []; bartender.job = null; bartender.pos.copy(BAR.tender.home);
    for (const it of this.items) { scene.remove(it.glass ? it.glass.group : it.mesh); }
    this.items = []; interactables.splice(0, interactables.length, ...interactables.filter(i => !i.temp));
    MACHINES.forEach(m => { m.setMode('idle'); m.occupiedBy = null; m.state = 'ready'; m.credit = 0; m.free = false; });
    SPOTS.forEach(sp => sp.occ = null);
    if (player.drink) { player.drink.group.parent && player.drink.group.parent.remove(player.drink.group); player.drink = null; }
    player.cig = null; player.cigMesh.g.visible = false; player.seated = null; player.sip = 0;
    puddles.forEach(p => scene.remove(p)); puddles.length = 0;
    REG.spawnAll(); VenueLocals.spawn(); Shops.spawnStaff(); STORY.spawn();
    spawnPatrons(Math.round(D.crowd * VENUE.crowd * (0.85 + Math.random() * 0.3) * settings.crowd));
    Night.start(); RANDOM.plan(); Racing.setup(); Karaoke.started = Karaoke.awarded = false; Karaoke.scores = []; Karaoke.draw(); BAR.shift = false; player.level = 0; player.auto = null;
    this.arrivals = Math.round(D.crowd * 0.35); this.arriveT = 20;
    AudioSys.amp.crowd = clamp(D.crowd / 18, 0.4, 1.4);
    Music.song = Music.pick(D.event); Music.level = D.event === 'knockoff' || D.event === 'raffle' ? 0.9 : 0.45;
    // player on the far footpath, facing the pub
    player.pos.set(-7.5, 0, 21.2); player.yaw = 0.12; player.pitch = 0.04; player.vel.set(0, 0, 0);
    updateBoards(D);
    setTimeOfDay(s.time, D.weather);
    this.mode = 'play'; this.paused = false;
    $('hud').classList.remove('hidden'); $('deck').classList.add('hidden');
    this.fade(1, 0); lockPointer(); this.useTab = false;
    this.objective();
    { const seen = s.flags.seen = s.flags.seen || {}; const first = !seen[VENUE.id]; seen[VENUE.id] = 1; Cine.opening(first); }
    setTimeout(() => this.subtitle(s.startHang ? '<i>Head\'s pounding. The street\'s too quiet. Only thing lit up is ' + VENUE.short + '.</i>' : '<i>The street\'s dead. Only thing lit up for blocks is ' + VENUE.short + '.</i>', 5), 600);
  },
  endNight(reason) {
    if (this.mode !== 'play') return;
    const s = this.state, D = DAYS[s.day], dd = DIFF[s.diff];
    if (MG.active) MG.stop(true);
    if (player.seated) this.collect(true), standUp();
    Moments.cleanup(); this.mode = 'ending'; this.fade(0, 1); document.exitPointerLock && document.exitPointerLock();
    setTimeout(() => {
      $('hud').classList.add('hidden'); $('deck').classList.add('hidden'); this.closePanel();
      const early = s.time < 22 && s.drunk < 35 && ['home', 'taxi', 'room'].includes(reason);
      if (early) achieve('early'); if (reason === 'kicked') achieve('legless');
      const hung = s.drunk > 62 || reason === 'kicked';
      s.next = { early, hang: hung, room: reason === 'room' };
      const n = s.night, tick = s.tickets.reduce((a, b) => a + b, 0);
      const worthNow = s.wallet + s.bank + tick, worthStart = n.startWallet + n.startBank + n.startTickets;
      const isSunday = s.day === 6;
      const tabHtml = Night.settleTab(); const nsum = Night.finish(reason);
      const reasonTxt = { home: early ? 'You called it early and walked home under the streetlights.' : 'You wandered home.', close: '"Righto folks, time to go!" — you got turfed out at close.', kicked: 'The bouncer walked you out. Not your finest hour.', broke: 'Skint. Nothing left but the walk home.', taxi: 'You caught a cab home. The driver had opinions about the footy.', room: 'You crashed in Room 4 upstairs. The pub hummed through the floorboards.' }[reason] || '';
      const rows = [['Started with (wallet + bank)', fmt$(n.startWallet + n.startBank)], ['Drinks (' + n.drinks + ')', fmt$(-n.spentDrinks)], ['Food', fmt$(-n.spentFood)], ['Smokes', fmt$(-n.spentSmokes)], ['Pokies — wagered', fmt$(-n.wagered)], ['Pokies — won', fmt$(n.won)], ['Keno / raffle / trivia', fmt$(n.keno + n.extra)], ['ATM fees', fmt$(-n.fees)]];
      let rentHtml = '';
      if (isSunday) {
        let rent = dd.rent; const fromBank = Math.min(s.bank, rent); s.bank -= fromBank; rent -= fromBank;
        const fromWallet = Math.min(s.wallet, rent); s.wallet -= fromWallet; rent -= fromWallet;
        s.evicted = rent > 0.01;
        rentHtml = s.evicted ? `<p class="neg"><b>Rent bounced.</b> You were ${fmt$(rent)} short. The landlord's not having it.</p>` : `<p class="pos">Rent of ${fmt0(dd.rent)} paid. Roof over your head for another week.</p>`;
      }
      $('summaryInner').innerHTML = `
        <div class="dname">${D.name} NIGHT</div><div class="dtime">${this.clockText()} · ${reasonTxt}</div>
        <table class="ledger">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}
        <tr class="tot"><td>Net for the night</td><td class="${worthNow - worthStart >= 0 ? 'pos' : 'neg'}">${fmt$(worthNow - worthStart)}</td></tr></table>
        ${rentHtml}${tabHtml}
        ${nsum}
        <p>${hung ? '<span class="neg">You\'re going to feel this tomorrow.</span>' : early ? '<span class="pos">Early night — you\'ll be fresh tomorrow (bonus).</span>' : 'You\'ll be right tomorrow.'}</p>
        <div class="stats"><div>Wallet<b>${fmt0(s.wallet)}</b></div><div>Bank<b>${fmt0(s.bank)}</b></div><div>Tickets<b>${fmt0(tick)}</b></div><div>Mood<b>${Math.round(s.mood)}</b></div></div>
        <button class="cbtn" id="btnNext">${isSunday ? 'SEE YOUR WEEK →' : 'SLEEP IT OFF →'}</button>`;
      $('summary').classList.remove('hidden'); this.fade(1, 0);
      $('btnNext').onclick = () => { if (isSunday) this.weekSummary(); else { s.day++; this.save(); this.showDayCard(); } };
      this.mode = 'summary';
    }, 900);
  },
  weekSummary() {
    const s = this.state, st = s.stats, worth = s.wallet + s.bank + s.tickets.reduce((a, b) => a + b, 0), net = worth - st.startWorth;
    let grade, line;
    if (s.evicted) { grade = 'EVICTED'; line = 'Couldn\'t make rent. Maybe give the pokies a miss next week, champ.'; }
    else if (net >= 400) { grade = 'LEGEND OF THE ROYAL'; line = 'Walked out of the week ahead. The house always wins — just not this time. Don\'t push your luck.'; }
    else if (net >= -150) { grade = 'A BATTLER\'S WEEK'; line = 'Rent paid, a few laughs, a few beers. That\'s a good week at the local.'; }
    else { grade = 'SKINT BUT HOUSED'; line = 'Rent\'s paid but the account\'s crying. Something to think about.'; }
    $('summaryInner').innerHTML = `<div class="dname">${grade}</div><div class="dtime">THE WEEK AT THE ROYAL · ${DIFF[s.diff].label.toUpperCase()}</div><p>${line}</p>
      <table class="ledger"><tr><td>Started the week with</td><td>${fmt$(st.startWorth)}</td></tr><tr><td>Ended the week with</td><td>${fmt$(worth)}</td></tr>
      <tr><td>Drinks (${st.drinks})</td><td>${fmt$(-st.spentDrinks)}</td></tr><tr><td>Food</td><td>${fmt$(-st.spentFood)}</td></tr><tr><td>Smokes (${st.cigs} smoked)</td><td>${fmt$(-st.spentSmokes)}</td></tr>
      <tr><td>Total wagered on pokies</td><td>${fmt$(-st.wagered)}</td></tr><tr><td>Total pokie wins</td><td>${fmt$(st.won)}</td></tr><tr><td>Biggest single win</td><td>${fmt$(st.biggest)}</td></tr>
      <tr><td>Jackpots / meat trays / trivia wins</td><td>${st.jackpots} / ${st.meat} / ${st.trivia}</td></tr><tr><td>Glasses smashed</td><td>${st.glasses}</td></tr><tr><td>ATM fees</td><td>${fmt$(-st.atmFees)}</td></tr>
      <tr class="tot"><td>Net for the week</td><td class="${net >= 0 ? 'pos' : 'neg'}">${fmt$(net)}</td></tr></table>
      <p class="note">Pokies returned ${st.wagered > 0 ? Math.round(st.won / st.wagered * 100) : 0}c in the dollar this week.</p>
      ${STORY.epilogue()}
      <button class="cbtn" id="btnAgain">ANOTHER WEEK →</button>`;
    store('ld_save', null);
    $('btnAgain').onclick = () => { $('summary').classList.add('hidden'); this.toTitle(); };
  },
  toTitle() {
    this.mode = 'title'; $('hud').classList.add('hidden'); $('deck').classList.add('hidden'); $('resume').classList.add('hidden'); this.closePanel();
    $('title').classList.remove('hidden'); $('diffMenu').classList.add('hidden'); $('mainMenu').classList.remove('hidden');
    const sv = store('ld_save'); $('btnContinue').classList.toggle('hidden', !(sv && sv.day != null && sv.day <= 6));
    $('achInfo').textContent = `${Object.keys(ACH.got).length} of ${ACH_LIST.length} unlocked`;
    if (sv && sv.day != null) $('contInfo').textContent = `${DAYS[Math.min(6, sv.day)].name} · ${DIFF[sv.diff].label} · ${fmt0(sv.wallet + sv.bank)}`;
    setTimeOfDay(18.4, 'clear'); this.fade(1, 0);
  },
  fade(from, to) { const f = $('fade'); f.style.transition = 'none'; f.style.opacity = from; void f.offsetWidth; f.style.transition = 'opacity .9s'; f.style.opacity = to; },
  // -------------------------------------------------- HUD
  clockText() { const h = this.state.time, hr = Math.floor(h) % 24, m = Math.floor((h % 1) * 60); return `${hr % 12 === 0 ? 12 : hr % 12}:${String(m).padStart(2, '0')}${hr >= 12 ? 'pm' : 'am'}`; },
  _hud: {},
  setText(id, v) { if (this._hud[id] !== v) { this._hud[id] = v; $(id).innerHTML = v; } },
  updateHUD() {
    const s = this.state;
    this.setText('clock', this.clockText());
    this.setText('daylbl', DAYS[s.day].name + ' · ' + DAYS[s.day].title.toUpperCase());
    this.setText('walletv', fmt$(s.wallet)); this.setText('bankvv', fmt$(s.bank));
    const tk = s.tickets.reduce((a, b) => a + b, 0);
    this.setText('items', `${s.cigs} smokes${tk > 0 ? ` · ${s.tickets.length} ticket${s.tickets.length > 1 ? 's' : ''} (${fmt$(tk)})` : ''}${player.drink ? ` · ${player.drink.D.short} ${Math.round(player.drink.fill * 100)}%` : ''}`);
    $('mDrunk').querySelector('i').style.width = s.drunk + '%'; $('mMood').querySelector('i').style.width = s.mood + '%'; $('mCrave').querySelector('i').style.width = s.crave + '%';
    $('mHunger').querySelector('i').style.width = s.hunger + '%'; $('mBladder').querySelector('i').style.width = s.bladder + '%';
    this.setText('hungerTxt', s.hunger > 80 ? 'Starving' : s.hunger > 55 ? 'Peckish' : 'Fed'); this.setText('bladderTxt', s.bladder > 80 ? 'Busting' : s.bladder > 50 ? 'Could go' : '');
    this.setText('drunkTxt', s.drunk < 12 ? 'Sober' : s.drunk < 30 ? 'Merry' : s.drunk < 50 ? 'Tipsy' : s.drunk < 70 ? 'Pissed' : s.drunk < 85 ? 'Maggot' : 'Legless');
    this.setText('moodTxt', s.mood > 75 ? 'Stoked' : s.mood > 50 ? 'Good' : s.mood > 30 ? 'Meh' : s.mood > 15 ? 'Cranky' : 'Gutted');
    if (player.seated) {
      const m = player.seated;
      this.setText('dkCredit', fmt$(m.credit)); this.setText('dkBet', fmt$(m.bet));
      const gm = m.state === 'gamble';
      this.setText('dkBetDn', gm ? 'RED' : 'Bet −'); this.setText('dkBetUp', gm ? 'BLACK' : 'Bet +');
      this.setText('dkCollect', gm ? 'Take<small>win</small>' : 'Collect');
      this.setText('dkAuto', `Gamble<small>${m.gambleOK && m.lastWin > 0 ? fmt$(m.lastWin) : '—'}</small>`);
      $('dkAuto').disabled = !(m.gambleOK && m.lastWin > 0 && m.state === 'showWin');
      $('dkSpin').textContent = m.state === 'pick' ? 'PICK' : m.state === 'spinning' ? 'STOP' : 'SPIN';
      $('dkBetDn').className = 'dk ' + (gm ? 'red' : 'blue'); $('dkBetUp').className = 'dk ' + (gm ? 'grey' : 'blue');
      $('dkSmoke').disabled = !m.def.smoke;
    }
  },
  objective() {
    const s = this.state, D = DAYS[s.day];
    let o;
    if (!this.entered) o = `Cross the road and head into ${VENUE.short}.`;
    else {
      const tips = { monday: 'Grab a pot at the bar (pots $6.50 till 9). Machines are out the back.', parma: 'Parma & Pot is $15 tonight — order at the bar.', trivia: this.trivia.done ? 'Trivia\'s done. Enjoy the night.' : 'Trivia starts at 8:30pm. Stay inside.', jackpot: 'Jackpots grow twice as fast tonight.', knockoff: 'Shout the crew a round, or let them shout you.', raffle: this.raffle.drawn ? 'Footy\'s on. Have a good one.' : 'Meat raffle draws at 5pm. Tickets at the bar.', sunday: `Rent of ${fmt0(DIFF[s.diff].rent)} comes out tonight. Bank: ${fmt0(s.bank)}.` };
      o = tips[D.event] || '';
      if (s.drunk > 75) o = 'You\'re very drunk. Bar staff may cut you off. Water\'s free.';
    }
    const html = `<span class="storygoal">★ ${STORY.goal()}</span><br>` + o + '<br><span style="opacity:.6">Leave early & sober = bonus tomorrow. Close: ' + (() => { const c = DAYS[s.day].close, h = Math.floor(c) % 24, m = Math.round((c % 1) * 60); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`; })() + '</span>';
    if (this._hud.objective !== html) { this.objShownAt = elapsed; $('objective').style.opacity = 1; }
    this.setText('objective', html);
  },
  toast(msg, big = false) {
    const el = document.createElement('div'); el.className = 'toast' + (big ? ' big' : ''); el.innerHTML = msg; $('toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = 0; setTimeout(() => el.remove(), 500); }, big ? 3800 : 2800);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  },
  subT: 0,
  subtitle(html, dur = 3) { if (!settings.subtitles && !/^<i>/.test(html)) return; $('subtitle').innerHTML = html; this.subT = dur; },
  dayBarks() {
    return ({ monday: ['Mondays, eh.', 'Quiet one tonight.'], parma: ["Parma's ripper tonight.", 'Get the parma, mate. Trust me.'], trivia: ["Reckon we'll win trivia this week?", 'Who was the first PM again? Barton?', 'Bloody rain.'], jackpot: ["Grand's getting up there, isn't it?", 'Payday! Shout ya one later.'], knockoff: ['Thank God it\'s Friday.', 'Whose shout is it?', 'Big week. Big week.'], raffle: ['Come on the Pies!', "Ump, you're blind!", 'Got me raffle tickets. Feelin\' lucky.'], sunday: ['Sunday sesh, can\'t beat it.', 'Back to work tomorrow. Don\'t remind me.'] })[this.state.event] || [];
  },
  // -------------------------------------------------- panels
  openPanel(title, sub, body, btns = [{ label: 'Close', fn: () => this.closePanel() }]) {
    this.uiOpen = true; document.exitPointerLock && document.exitPointerLock();
    $('pTitle').innerHTML = title; $('pSub').innerHTML = sub || ''; $('pBody').innerHTML = ''; if (typeof body === 'string') $('pBody').innerHTML = body; else $('pBody').appendChild(body);
    $('pBtns').innerHTML = ''; for (const b of btns) { const e = document.createElement('button'); e.className = 'pbtn'; e.textContent = b.label; e.onclick = b.fn; $('pBtns').appendChild(e); }
    $('panel').classList.remove('hidden');
  },
  closePanel() { $('panel').classList.add('hidden'); $('panel').classList.remove('wide'); if (this.uiOpen) { this.uiOpen = false; if (this.mode === 'play' && !player.seated && !(MG.active && MG.active.cursor)) lockPointer(); } },
  optList(opts) {
    const wrap = document.createElement('div'); wrap.className = 'opts';
    for (const o of opts) { const b = document.createElement('button'); b.className = 'opt'; b.disabled = !!o.disabled; b.innerHTML = `<span>${o.label}${o.d ? `<span class="d">${o.d}</span>` : ''}</span>${o.price != null ? `<span class="price">${o.price}</span>` : ''}`; b.onclick = () => { SFX.click(); o.fn(); }; wrap.appendChild(b); }
    return wrap;
  },
  spend(amt, cat) { const s = this.state; if (this.useTab && amt > 0 && (cat === 'spentDrinks' || cat === 'spentFood') && Night.tabOK(amt)) { Night.tabAdd(amt); s.night[cat] += amt; s.stats[cat] += amt; this.toast(`On the tab: ${fmt$(Night.tab())} of ${fmt0(Night.tabLimit())}.`); return true; }
    if (s.wallet + 1e-9 < amt) { this.toast(`Not enough cash (${fmt$(s.wallet)}). ATM's in the lounge.`); return false; } s.wallet -= amt; if (cat) { s.night[cat] += amt; s.stats[cat] += amt; } if (amt > 0) CashFX.pay(amt); return true; },
  drinkPrice(type) {
    const s = this.state, D = DRINKS[type];
    if (s.event === 'knockoff' && type === 'schooner' && s.time >= 16 && s.time < 18) return 8;
    let p = D.price;
    if (s.event === 'monday' && type === 'pot' && s.time < 21) p = 6.5;
    p = Math.round(p * VENUE.priceMul * 4) / 4;
    if (p > 1 && Night.hasPerk(2)) p = Math.max(1, p - 0.5);
    if (p > 1 && s.flags.spudMates) p = Math.max(1, p - 0.5);
    return p;
  },
  openBar() {
    const s = this.state;
    if (bartender.job || bartender.queue.length) { this.toast('Hang on, the bartender\'s pouring.'); return; }
    if (this.items.length) { this.toast('Your order\'s waiting on the bar.'); return; }
    if (s.drunk >= 95) { this.kickOut(); return; }
    const rsa = s.drunk >= 80;
    const holding = player.drink && player.drink.fill > 0.08;
    const opts = [];
    for (const type of ['pot', 'schooner', 'pint', 'pale', 'scotch', 'bourbon', 'rum', 'vodka', 'llb', 'water']) {
      const D = DRINKS[type], price = this.drinkPrice(type);
      opts.push({ label: D.name, d: type === 'water' ? 'Free. Hydrate, legend.' : D.std ? `${D.std} std drinks` : 'No alcohol', price: price ? fmt$(price) : 'FREE', disabled: holding || (rsa && D.std > 0), fn: () => this.order(type, price) });
    }
    const dish = (k, extra = {}) => { const F = FOODS[k]; return Object.assign({ label: F.name, d: this.foodBlurb(k), price: fmt$(F.price), disabled: rsa && false, fn: () => this.order(null, F.price, k, 'spentFood') }, extra); };
    if (s.event === 'parma') opts.push({ label: 'Parma & Pot (Tuesday special)', d: 'Chicken parmigiana, chips, salad + a pot', price: '$15.00', disabled: holding || rsa, fn: () => this.order('pot', 15, 'parma', 'spentFood') });
    opts.push(dish(s.event === 'sunday' ? 'roast' : 'parma'), dish('schnitty'), dish('burger'), dish('pie'), dish('sausageroll'), dish('snags'), dish('chips'), dish('nuts'), dish('cheese'));
    if (s.event === 'sunday' || s.event === 'raffle' || s.event === 'knockoff') opts.push(dish('pav'));
    if (!s.tonight.shift && s.drunk < 25 && s.day < 5 && s.time < DAYS[s.day].close - 2) opts.push({ label: 'Ask about a shift behind the bar', d: 'Cash in hand + tips. You need to be sober.', fn: () => { this.closePanel(); BarShift.offer(); } });
    opts.push({ label: 'Pack of smokes (20)', d: `You have ${s.cigs}. Yes, they're really this much.`, price: '$45.00', fn: () => { if (this.spend(45, 'spentSmokes')) { s.cigs += 20; SFX.register(V3(-9, 1.2, -9)); this.toast('20 smokes. Your wallet weeps.'); this.closePanel(); } } });
    if (s.event === 'raffle' && !this.raffle.drawn) opts.push({ label: 'Meat raffle tickets ×3', d: `Draw at 5pm. You have ${this.raffle.tickets}.`, price: '$5.00', fn: () => { if (this.spend(5)) { s.night.extra -= 5; this.raffle.tickets += 3; SFX.register(V3(-9, 1.2, -9)); this.toast('Three raffle tickets. Come on, meat tray!'); this.closePanel(); } } });
    if (s.event === 'knockoff') opts.push({ label: 'Shout the crew a round', d: 'Five schooners. Mateship +, wallet −', price: '$45.00', fn: () => { if (this.spend(45, 'spentDrinks')) { s.stats.shouts++; s.mood = Math.min(100, s.mood + 18); this.crewOwes = true; Night.ev('shouted'); SFX.cheer(V3(-5, 1.5, -6), 1); this.toast('"Legend!" — the crew owes you one.', true); this.closePanel(); } } });
    Moments.barOptions(opts, holding, rsa);
    if (Night.tabLimit() > 0) opts.push({ label: this.useTab ? 'Paying: on the TAB' : 'Paying: cash', d: `Tab ${fmt$(Night.tab())} of ${fmt0(Night.tabLimit())} — settled from your account at the end of the night`, fn: () => { this.useTab = !this.useTab; this.closePanel(); this.openBar(); } });
    if (Night.hasPerk(3) && s.flags.lastDrink && !holding && !rsa && DRINKS[s.flags.lastDrink]) { const t = s.flags.lastDrink, pr = this.drinkPrice(t); opts.unshift({ label: `The usual (${DRINKS[t].name})`, d: `${bartender.name} already has the glass out`, price: pr ? fmt$(pr) : 'FREE', fn: () => this.order(t, pr) }); }
    if (Night.hasPerk(4) && !s.night.freeUsed && !holding && !rsa) opts.unshift({ label: 'Your free schooner', d: 'Local Legend perk: on the house, once a night', price: 'FREE', fn: () => { s.night.freeUsed = true; this.order('schooner', 0); } });
    this.openPanel('THE BAR', rsa ? '<span style="color:#ff8a7a">"Sorry mate, I can\'t serve you any more alcohol. Have a water."</span>' : `Wallet ${fmt$(s.wallet)} · ${bartender.name}'s behind the bar`, this.optList(opts));
  },
  foodBlurb(k) { return ({ parma: 'Chicken parmigiana, chips and salad. The size of a hubcap.', schnitty: 'Golden crumbed chook, lemon, chips.', roast: 'Lamb, crispy spuds, peas, gravy.', burger: 'Beetroot, egg, bacon, the lot.', pie: 'Mince and onion. Tomato sauce.', sausageroll: 'Hot, flaky, a bit dangerous.', snags: 'Sausage in bread, onions underneath.', chips: 'With chicken salt, obviously.', nuts: 'A bowl of salty peanuts.', cheese: 'Brie, cheddar, blue, quince, crackers, grapes.', pav: 'Meringue, cream and passionfruit.' })[k] || ''; },
  order(type, price, food, cat = 'spentDrinks') {
    if (price > 0 && !this.spend(price, cat)) return;
    this.useTab = false; if (type === 'water') Night.ev('water');
    this.closePanel();
    SFX.register(V3(-9, 1.2, player.pos.z));
    if (player.drink && player.drink.fill <= 0.08) { const g = player.drink; player.drink = null; g.group.parent && g.group.parent.remove(g.group); vm.R.curl(0.2); this.toast('Handed back your empty.'); }
    const z = clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6);
    if (type) { if (DRINKS[type].std) { this.state.night.drinks++; this.state.stats.drinks++; this.state.flags.lastDrink = type; } bartenderOrder({ type, forZ: z, cb: (item, spot) => this.placeItem(item, spot) }); }
    if (food) setTimeout(() => bartenderOrder({ food, forZ: z + (type ? 0.35 : 0), cb: (item, spot) => this.placeItem(item, spot) }), 400);
    this.subtitle(`<b>${bartender.name}:</b> ${choice(['No worries.', 'Coming right up.', 'Yep, can do.', 'Easy.'])}`, 2);
  },
  placeItem(item, spot) {
    this.items.push(item);
    const kind = item.kind === 'food' ? legacyFood(item.food, this.state.event) : null;
    const lbl = item.kind === 'drink' ? `Take your ${item.glass.D.short}` : `Eat your ${FOODS[kind].name.toLowerCase()}`;
    const ia = addInteract({ id: 'item', temp: true, pos: spot.clone().add(V3(0, 0.08, 0)), r: 2.0, label: () => lbl, action: () => {
      if (item.kind === 'drink') { if (player.drink) { this.toast('Hands full — finish or drop (G) what you\'ve got.'); return; } giveDrink(item.glass); SFX.clink(spot); }
      else if (!this.eat(item, spot)) return;
      this.items.splice(this.items.indexOf(item), 1); interactables.splice(interactables.indexOf(ia), 1);
    } });
  },
  // sit the plate in front of you and eat it, knife and fork or bare hands
  eat(item, spot) {
    const kind = legacyFood(item.food, this.state.event), model = item.mesh;
    const ok = Eat.begin(kind, model, { place: (m, frac) => { scene.add(m); m.position.copy(spot); m.rotation.set(0, 0, 0); m.scale.setScalar(1); player.drink && (player.drink.group.visible = true); setTimeout(() => scene.remove(m), frac > 0.9 ? 25000 : 90000); } });
    if (!ok) { this.toast('Not now.'); return false; }
    if (kind === 'chips' || kind === 'parma') Needs.ateKind = kind;
    return true;
  },
  openATM() { ATM.open(); },
  openJukebox() { Juke.open(); },
  openKeno() {
    const s = this.state, k = this.keno;
    const picked = new Set();
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div style="font-size:13px;opacity:.75">Pick up to 10 numbers (or Quick Pick). $5 per game. Next draw in ${Math.max(0, Math.round((k.next - s.time) * 60))} min. Pays: 0 hits ×2, 5×2, 6×15, 7×50, 8×400, 9×4000, 10 = $100k per $1.</div>`;
    const grid = document.createElement('div'); grid.className = 'kgrid';
    for (let i = 1; i <= 80; i++) { const b = document.createElement('button'); b.textContent = i; b.onclick = () => { if (picked.has(i)) { picked.delete(i); b.classList.remove('on'); } else if (picked.size < 10) { picked.add(i); b.classList.add('on'); } SFX.click(); }; grid.appendChild(b); }
    wrap.appendChild(grid);
    const buy = nums => { if (!nums.length) { this.toast('Pick some numbers first.'); return; } if (!this.spend(5)) return; s.night.keno -= 5; k.tickets.push({ nums, bet: 5, game: k.game }); SFX.print(); this.toast(`Keno ticket for game ${k.game}: ${nums.join(', ')}`); this.closePanel(); };
    this.openPanel('KENO', `Game ${k.game} · ${k.tickets.length} ticket(s) in play`, wrap, [
      { label: 'Quick Pick 10 ($5)', fn: () => { const a = []; while (a.length < 10) { const n = randi(1, 80); if (!a.includes(n)) a.push(n); } buy(a.sort((x, y) => x - y)); } },
      { label: 'Buy my numbers ($5)', fn: () => buy([...picked].sort((x, y) => x - y)) }, { label: 'Close', fn: () => this.closePanel() }]);
  },
  updateKeno(dt) {
    const s = this.state, k = this.keno;
    if (!k.drawing && s.time >= k.next) { k.drawing = true; k.drawn = []; while (k.drawn.length < 20) { const n = randi(1, 80); if (!k.drawn.includes(n)) k.drawn.push(n); } k.shown = 0; k.t = 0; }
    if (k.drawing) {
      k.t += dt;
      if (k.t > 0.55 && k.shown < 20) { k.t = 0; k.shown++; if (Math.hypot(player.pos.x - 2.5, player.pos.z + 14) < 8) SFX.tone(900 + k.drawn[k.shown - 1] * 6, 0.08, { gain: 0.03, pos: V3(2.8, 2.3, -14.2) }); }
      if (k.shown >= 20 && k.t > 6) {
        for (const tk of k.tickets.filter(t => t.game === k.game)) {
          const hits = tk.nums.filter(n => k.drawn.includes(n)).length, mult = tk.nums.length === 10 ? (KENO_PAY[hits] || 0) : (hits >= Math.ceil(tk.nums.length * 0.6) ? hits : 0);
          const win = mult * tk.bet / 1 * (tk.nums.length === 10 ? 1 : 0.5);
          if (win > 0) { s.wallet += win; s.night.keno += win; s.stats.keno += win; s.mood = Math.min(100, s.mood + 6); this.toast(`Keno game ${k.game}: ${hits} hits — won ${fmt$(win)}!`, win > 50); SFX.win(2); }
          else this.toast(`Keno game ${k.game}: ${hits} hit${hits === 1 ? '' : 's'}. No luck.`);
        }
        k.tickets = k.tickets.filter(t => t.game !== k.game);
        k.drawing = false; k.game++; k.next = s.time + 4 / 60 * 1.0 + 0.04;
      }
    }
  },
  drawKeno() {
    const k = this.keno, x = dynamic.keno.c.getContext('2d');
    x.fillStyle = '#100808'; x.fillRect(0, 0, 512, 384);
    x.fillStyle = '#c7352b'; x.fillRect(0, 0, 512, 44); x.fillStyle = '#fff'; x.font = '30px Bungee, Impact'; x.textAlign = 'left'; x.fillText('KENO', 14, 34);
    x.textAlign = 'right'; x.font = '18px Inter, sans-serif'; x.fillText(k.drawing ? `GAME ${k.game} · DRAWING ${k.shown}/20` : `GAME ${k.game} · NEXT DRAW ${Math.max(0, Math.round((k.next - this.state.time) * 60))}m`, 500, 30);
    const shown = new Set(k.drawn.slice(0, k.drawing ? k.shown : 20));
    for (let i = 0; i < 80; i++) {
      const cx = 14 + (i % 10) * 49, cy = 56 + Math.floor(i / 10) * 40, on = shown.has(i + 1), last = k.drawing && k.drawn[k.shown - 1] === i + 1;
      x.fillStyle = on ? (last ? '#ffe27a' : (i < 40 ? '#ff4a3a' : '#3a8aff')) : '#2a1a1a'; x.beginPath(); x.arc(cx + 20, cy + 16, 17, 0, 7); x.fill();
      x.fillStyle = on ? '#000' : '#7a6a6a'; x.font = 'bold 16px Inter, sans-serif'; x.textAlign = 'center'; x.fillText(i + 1, cx + 20, cy + 22);
    }
    dynamic.keno.tex.needsUpdate = true;
  },
  // -------------------------------------------------- pokies glue
  sitAt(m) {
    if (player.cig && !m.def.smoke) { this.toast('Can\'t smoke in the gaming room — finish it outside first.'); return; }
    sitAt(m); this.uiOpen = false; document.exitPointerLock && document.exitPointerLock();
    $('deck').classList.remove('hidden'); $('hints').classList.add('hidden'); $('cross').classList.add('hidden');
    if (m.credit <= 0) this.toast('Insert cash to play (I).');
    this.state.mood = Math.max(0, this.state.mood - 0);
  },
  leaveMachine() {
    const m = player.seated; if (!m) return;
    if (!m.canSpin() && m.state !== 'gamble') { this.toast('Wait for the game to finish.'); return; }
    if (m.state === 'gamble') m.takeGamble();
    if (m.state === 'showWin') m.endShowWin();
    if (m.credit > 0.004) this.collect(true);
    standUp(); $('deck').classList.add('hidden'); $('hints').classList.remove('hidden'); $('cross').classList.remove('hidden');
    lockPointer();
  },
  insertCash() {
    const s = this.state, m = player.seated; if (!m) return;
    const opts = [10, 20, 50, 100].map(a => ({ label: `Insert ${fmt0(a)} note`, price: fmt0(a), disabled: s.wallet < a, fn: () => { s.wallet -= a; m.credit += a; SFX.print(); this.closePanel(); m.msg = 'PRESS SPIN TO PLAY'; CashFX.pay(a, 'insert'); } }));
    if (s.wallet >= 1) opts.push({ label: 'Insert everything in your wallet', price: fmt$(Math.floor(s.wallet)), fn: () => { const a = Math.floor(s.wallet); s.wallet -= a; m.credit += a; SFX.print(); this.closePanel(); } });
    if (s.tickets.length) opts.push({ label: `Insert ticket(s)`, price: fmt$(s.tickets.reduce((a, b) => a + b, 0)), fn: () => { m.credit += s.tickets.reduce((a, b) => a + b, 0); s.tickets = []; SFX.print(); this.closePanel(); } });
    this.openPanel('INSERT CASH', `Wallet ${fmt$(s.wallet)} · Max $5,000 credit · <i>Set a limit. Stick to it.</i>`, this.optList(opts));
  },
  collect(silent) {
    const m = player.seated; if (!m || m.credit <= 0.004) { if (!silent) this.toast('No credit to collect.'); return; }
    if (!m.canSpin()) return;
    if (m.state === 'showWin') m.endShowWin();
    const amt = Math.round(m.credit * 100) / 100; m.credit = 0; this.state.tickets.push(amt);
    SFX.print(); this.toast(`Ticket printed: ${fmt$(amt)} — redeem at the cash machine in the gaming room.`);
  },
  redeem() {
    const s = this.state; if (!s.tickets.length) { this.toast('No tickets to redeem.'); return; }
    const amt = s.tickets.reduce((a, b) => a + b, 0); s.tickets = []; s.wallet += amt; SFX.atm(); CashFX.receive(amt); this.toast(`Redeemed ${fmt$(amt)} cash.`);
  },
  onPlayerBet(bet) { const s = this.state; s.night.wagered += bet; s.stats.wagered += bet; s.mood = Math.max(0, s.mood - 0.15); },
  onPlayerWin(amt, feature, gambleCollect) {
    if (gambleCollect) return;
    const s = this.state; s.night.won += amt; s.stats.won += amt; s.stats.biggest = Math.max(s.stats.biggest, amt);
    const m = player.seated; if (m) s.mood = Math.min(100, s.mood + Math.min(15, amt / m.bet * 0.4));
  },
  onGamble(win, amt) { const s = this.state; if (win) { s.night.won += amt; s.stats.won += amt; s.mood = Math.min(100, s.mood + 4); } else { s.night.won -= amt; s.stats.won -= amt; s.mood = Math.max(0, s.mood - 8); } },
  onFeature(f, m) { this.state.mood = Math.min(100, this.state.mood + 6); },
  onBigWin(m, lvl) { Night.log('🎰', `${lvl} on ${m.game.name} (${fmt$(m.win || 0)})`); $('bigwin').textContent = lvl + '!'; $('bigwin').style.opacity = 1; setTimeout(() => $('bigwin').style.opacity = 0, 2500); SFX.cheer(m.screenW, 1); NPCS.forEach(n => { if (n.pos.distanceTo(m.seatW) < 6 && n.role !== 'bartender') { n.cheerT = 2; } }); },
  onJackpot(m, name, amt) {
    const who = m.mode === 'player' ? 'You' : (m.occupiedBy && m.occupiedBy.name) || 'Someone';
    if (m.mode === 'player' && (name === 'GRAND' || name === 'MAJOR')) Cine.jackpot(m, name);
    if (m.mode === 'player') { this.state.stats.jackpots++; Night.log('🔔', `${name} jackpot: ${fmt$(amt)}`); SFX.jackpotBell(); this.toast(`${name} JACKPOT! ${fmt$(amt)}`, true); }
    else if (name !== 'MINI') { SFX.jackpotBell(); this.toast(`🔔 ${who} just hit the ${name} — ${fmt$(amt)} on ${m.game.name}!`, name === 'GRAND' || name === 'MAJOR'); SFX.cheer(m.screenW, 2); }
  },
  onDrag() { const s = this.state; s.crave = Math.max(0, s.crave - 12); s.mood = Math.min(100, s.mood + 2.5); s.cigsTonight++; },
  onIndoorSmoke() { this.state.strikes++; this.subtitle(`<b>${bartender.name}:</b> ${this.state.strikes > 1 ? 'Last warning! Out the front with that or you\'re out!' : 'Oi! Not inside, mate! Put that out!'}`, 3.5); this.state.mood -= 5; if (this.state.strikes >= 3) this.kickOut(); },
  onSipAmount(std, vol = 0) { const s = this.state; s.drunk = Math.min(100, s.drunk + std * 7.2 * DIFF[s.diff].hang ** 0.5 * (s.hunger > 70 ? 1.3 : s.hunger < 25 ? 0.85 : 1)); s.mood = Math.min(100, s.mood + std * 2.2); s.bladder = Math.min(100, s.bladder + vol * 30); },
  walkHome() { if (this.mode !== 'play' || player.auto) return; player.auto = V3(player.pos.x - 30, 0, 21.2); this.subtitle('<i>The street\'s quiet. The Royal hums behind you.</i>', 3); setTimeout(() => { player.auto = null; this.endNight('home'); }, 3600); },
  onSpill(a) { if (a > 0.05) this.toast(choice(['Whoa — sloshed half your beer.', 'Steady! You\'re wearing it.', 'That\'s a waste of good beer.'])); },
  onBump() { this.state.mood = Math.max(0, this.state.mood - 2); },
  onGlassSmash(pos) {
    const s = this.state; s.stats.glasses++; s.night.glasses++; if (s.night.glasses === 1) Night.log('🥴', 'Smashed a glass. WAHEY!'); s.mood = Math.max(0, s.mood - 3);
    if (isInside(pos.x, pos.z)) {
      setTimeout(() => { SFX.cheer(pos, 3); NPCS.forEach(n => { if (n.role !== 'bartender' && n.pos.distanceTo(pos) < 14) n.cheerT = 1.6; }); this.subtitle('<b>The whole pub:</b> WAHEYYYYY!', 2.5); }, 350);
      if (s.night.glasses >= 3) setTimeout(() => this.subtitle(`<b>${bartender.name}:</b> Right, that's three. Maybe call it a night, champ.`, 3), 3000);
    }
  },
  kickOut() { Night.log('🚪', 'Bouncer walked you out'); this.closePanel(); this.subtitle('<b>Bouncer:</b> Alright mate, you\'ve had enough. Out you go.', 3); this.state.kicked = true; setTimeout(() => this.endNight('kicked'), 2200); },
  // -------------------------------------------------- talking
  talkTo(n) {
    const s = this.state; n.a.talk = 2; Night.ev('talk', n.regular || n.name);
    if (n.regular) { REG.talk(n); return; }
    if (n.eventTalk) { n.eventTalk(); return; }
    const line = choice((BARKS[n.spot ? (n.spot.kind === 'pokie' ? 'pokie' : n.a.smoking ? 'smoke' : n.spot.area) : 'any'] || BARKS.any).concat(this.dayBarks()));
    const opts = [{ label: 'Have a yarn', d: 'Chew the fat for a bit', fn: () => { this.closePanel(); if (!n.yarned) { s.mood = Math.min(100, s.mood + 4); n.yarned = true; } bark(n, choice(["Ha! Too right.", "You're alright, you know that?", "Heard the Grand went off at the Commercial last week. Forty grand!", "My cousin won a meat tray three weeks running. Rigged, I reckon.", "Nah you're dreamin', mate.", "Machine four's due. Trust me. (It isn't.)"]), true); } }];
    if (n.smoker && s.cigs > 0 && !n.gotCig) opts.push({ label: 'Offer a smoke', d: 'They look like they need one', fn: () => { this.closePanel(); s.cigs--; n.gotCig = true; s.mood = Math.min(100, s.mood + 5); bark(n, 'Ahh, you beauty. Owe ya one.', true); } });
    if (!n.asked && Math.random() < 0.3 && s.wallet >= 20) { n.asked = true; opts.push({ label: `Lend ${n.name} $20 till tomorrow`, d: '"Pay ya back, I promise."', fn: () => { this.closePanel(); s.wallet -= 20; s.debts.push({ name: n.name, amt: 20, day: s.day, chance: 0.65 }); bark(n, 'Legend. Tomorrow, I swear on me mum.', true); } }); }
    if (s.event === 'knockoff' && this.crewOwes && !this.crewPaid) opts.push({ label: 'Remind them it\'s their shout', fn: () => { this.closePanel(); this.crewPaid = true; bark(n, 'Fair call! Schooner for this one, thanks!', true); bartenderOrder({ type: 'schooner', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (item, spot) => this.placeItem(item, spot) }); this.toast('The crew shouted you a schooner. It\'s at the bar.'); } });
    opts.push({ label: 'See ya', fn: () => this.closePanel() });
    this.openPanel(n.name.toUpperCase(), `"${line}"`, this.optList(opts), []);
  },
  // -------------------------------------------------- scheduled events
  updateEvents(dt) {
    const s = this.state, D = DAYS[s.day];
    // trivia
    if (s.event === 'trivia' && !this.trivia.done && s.time >= 20.5) {
      this.trivia.done = true;
      if (isInside(player.pos.x, player.pos.z) && !player.seated) this.runTrivia(); else this.toast('Trivia started without you. Oh well.');
      SFX.bell(V3(-9, 2.5, -8), 1);
    }
    // meat raffle
    if (s.event === 'raffle' && !this.raffle.drawn && s.time >= 17) {
      this.raffle.drawn = true; SFX.bell(V3(-9, 2.5, -8), 2);
      this.subtitle('<b>Raffle lady:</b> Righto everyone, MEAT RAFFLE! First tray goes to… green ticket, number forty-two!', 5);
      const sold = 160, trays = 10; let won = 0; for (let i = 0; i < this.raffle.tickets; i++) if (Math.random() < trays / sold) won++;
      setTimeout(() => { if (won) { s.stats.meat += won; s.night.extra += 40 * won; s.bank += 40 * won; s.mood = Math.min(100, s.mood + 25); SFX.cheer(player.pos, 2); this.toast(`🥩 YOU WON ${won > 1 ? won + ' MEAT TRAYS' : 'A MEAT TRAY'}! (~$${40 * won} of groceries saved)`, true); } else if (this.raffle.tickets) this.toast('No meat tray this week. Next Saturday…'); }, 4500);
    }
    // footy noise on Saturday
    if (s.event === 'raffle' && s.time < 18 && isInside(player.pos.x, player.pos.z)) { this.footyT -= dt; if (this.footyT <= 0) { this.footyT = rand(25, 60); SFX.cheer(V3(0, 2.5, 0), 2); bark(choice(NPCS.filter(n => n.role !== 'bartender')) || bartender, choice(['GOOOAL!', 'Ump! Are you blind?!', 'Kick it!', 'BALL!']), true); } }
    // last drinks + close
    if (!this.lastDrinks && s.time >= D.close - 0.25) { this.lastDrinks = true; Night.lastCall(); SFX.bell(V3(-9, 2.5, -8), 3); this.subtitle(`<b>${bartender.name}:</b> LAST DRINKS, EVERYBODY! LAST DRINKS!`, 4); NPCS.forEach(n => { if (n.role !== 'bartender' && Math.random() < 0.4 && n.state === 'idle') { n.leaving = true; release(n); n.state = 'walk'; n.kind = 'walk'; n.path = findPath(n.pos, NODES.S2); } }); }
    if (s.time >= D.close) { this.subtitle(`<b>${bartender.name}:</b> Righto folks, time to go home!`, 3); this.endNight('close'); }
    Night.update(dt); Moments.update(dt); RANDOM.update(dt); STORY.update(); Needs.update(dt); Racing.update(dt); Karaoke.tick(dt);
    // arrivals
    this.arriveT -= dt;
    if (this.arrivals > 0 && this.arriveT <= 0 && s.time < D.close - 1) {
      this.arriveT = rand(25, 70); this.arrivals--;
      const n = mkNPC({ pos: V3(rand(-20, 20), 0, 21) }); const sp = chooseNextSpot(n);
      if (sp) { sendTo(n, sp); n.path.unshift(...streetApproach(n)); } else { scene.remove(n.h.root); NPCS.pop(); }
    }
    // gone NPCs
    for (let i = NPCS.length - 1; i >= 0; i--) if (NPCS[i].gone) { scene.remove(NPCS[i].h.root); NPCS.splice(i, 1); }
    // leaving NPCs walk off down the street
    for (const n of NPCS) if (n.leaving && n.state === 'walk' && n.path.length === 0) { n.path = [V3(n.pos.x < 0 ? -40 : 40, 0, 21)]; }
    // drink/smoke/mood dynamics (per game minute)
    const gm = dt * this.timeScale * 60;
    s.drunk = Math.max(0, s.drunk - 0.11 * gm);
    s.crave = Math.min(100, s.crave + 0.18 * gm);
    if (s.crave > 75) s.mood = Math.max(0, s.mood - 0.04 * gm);
    if (s.drunk >= 98 && !s.kicked) this.kickOut();
    // leaving via the street
    if (this.entered && player.pos.z > 18.6 && !this.askedHome && !this.uiOpen) { this.askedHome = true; this.openPanel('HEAD HOME?', `It's ${this.clockText()}. ${s.time < 22 && s.drunk < 35 ? 'An early, sober night means a bonus tomorrow.' : ''}`, '', [{ label: 'Walk home', fn: () => { this.closePanel(); this.walkHome(); } }, { label: 'One more', fn: () => { this.closePanel(); } }]); }
    if (player.pos.z < 17 && this.askedHome) this.askedHome = false;
    if (!this.entered && isInside(player.pos.x, player.pos.z)) { this.entered = true; this.toast(`Welcome to ${VENUE.id === 'royal' ? 'the Royal' : VENUE.name.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')}.`); this.objective(); this.subtitle(`<b>${bartender.name}:</b> ${choice(["G'day! What can I get ya?", 'Evenin\'! Bar\'s open.', "How ya goin', mate?"])}`, 3); }
    if (s.wallet + s.bank + s.tickets.reduce((a, b) => a + b, 0) + this.machineCredit() < 0.5 && !this.brokeWarned) { this.brokeWarned = true; this.toast('You\'re completely skint. Water\'s free, the walk home is too.', true); }
  },
  runTrivia() {
    const qs = TRIVIA.slice().sort(() => Math.random() - 0.5).slice(0, 5); let i = 0, score = 0;
    const ask = () => {
      if (i >= qs.length) {
        const s = this.state; let prize = '';
        if (score >= 4) { s.wallet += 50; s.night.extra += 50; s.stats.trivia++; s.mood = Math.min(100, s.mood + 15); prize = 'Your table WINS! $50 bar tab (cash).'; SFX.cheer(player.pos, 2); if (s.day === 2) STORY.addFund(50, 'Bev matched your trivia prize'); }
        else if (score === 3) { prize = 'Second place — a free schooner on the house.'; bartenderOrder({ type: 'schooner', forZ: clamp(player.pos.z, BAR.z0 + .6, BAR.z1 - .6), cb: (it, sp) => this.placeItem(it, sp) }); }
        else prize = 'Wooden spoon. Better luck next week.';
        Night.ev('trivia', score); Night.log('❓', `Trivia: ${score}/5`);
        this.openPanel('TRIVIA RESULTS', `${score} / 5`, `<p>${prize}</p>`); return;
      }
      const [q, a] = qs[i], right = a[0], opts = a.slice().sort(() => Math.random() - 0.5);
      this.openPanel(`TRIVIA · Q${i + 1}`, 'Host: "Pens down in thirty!"', this.optList(opts.map(o => ({ label: o, fn: () => { if (o === right) { score++; SFX.win(1); this.toast('Correct!'); } else { SFX.tone(160, 0.3, { gain: 0.1, type: 'sawtooth' }); this.toast(`Nope — ${right}.`); } i++; ask(); } }))), []);
      $('pTitle').insertAdjacentHTML('afterend', '');
      $('pSub').innerHTML = `<b style="font-size:17px;color:#fff">${q}</b>`;
    };
    this.subtitle('<b>Host:</b> Welcome to Royal Trivia! Five questions, fifty-dollar bar tab!', 3);
    ask();
  },
  // -------------------------------------------------- input
  canMove() { return this.mode === 'play' && !this.uiOpen && !this.paused && !player.seated && !MG.active && !Cine.active && !Eat.active; },
  onKey(code) {
    if (this.mode !== 'play') return;
    if (DLG.active) { DLG.key(code); return; }
    if (Cine.active) return;
    if (Eat.active) { if (code === 'KeyQ' || code === 'Escape') Eat.stop(true); return; }
    if (code === 'Escape') { if (!$('panel').classList.contains('hidden')) { this.closePanel(); return; } if (player.seated) { this.leaveMachine(); return; } return; }
    if (this.uiOpen || this.paused) return;
    if (MG.active) { MG.key(code); return; }
    const m = player.seated;
    if (m) {
      if (code === 'Space') { this.deckSpin(); }
      else if (code === 'ArrowUp' || code === 'Equal') this.betUp();
      else if (code === 'ArrowDown' || code === 'Minus') this.betDn();
      else if (code === 'KeyQ' || code === 'Backspace') this.leaveMachine();
      else if (code === 'KeyI') this.insertCash();
      else if (code === 'Enter') { if (m.state === 'gamble') m.takeGamble(); else this.collect(); }
      else if (code === 'KeyG') m.startGamble();
      else if (code === 'KeyR') m.gamble('red');
      else if (code === 'KeyB') m.gamble('black');
      else if (code === 'KeyF') sipDrink();
      else if (code === 'KeyC') { if (m.def.smoke) startSmoke(); else this.toast('No smoking in the gaming room. The terrace machines allow it.'); }
      return;
    }
    if (code === 'KeyE') this.interact();
    else if (code === 'KeyF') sipDrink();
    else if (code === 'KeyG') dropHeld();
    else if (code === 'KeyC') startSmoke();
    else if (code === 'Tab') this.phone();
  },
  deckSpin() {
    const m = player.seated; if (!m) return;
    vm.pressT = 0.25; m.btns[5].position.z = 0.003; setTimeout(() => m.btns[5].position.z = 0.012, 140);
    if (m.state === 'spinning') { m.slam(); return; }
    if (m.state === 'pick') { const free = m.pk.tiles.map((t, i) => t ? -1 : i).filter(i => i >= 0); if (free.length) m.pickTile(choice(free)); return; }
    if (m.state === 'gamble') return;
    if (m.credit + 1e-9 < m.bet) { if (m.credit > 0 && m.betIdx > 0) { this.toast('Not enough credit for that bet — lower it.'); } else this.insertCash(); return; }
    m.spin();
  },
  betUp() { const m = player.seated; if (!m) return; if (m.state === 'gamble') { m.gamble('black'); return; } if (!m.canSpin()) return; m.betIdx = Math.min(BETS.length - 1, m.betIdx + 1); SFX.button(); },
  betDn() { const m = player.seated; if (!m) return; if (m.state === 'gamble') { m.gamble('red'); return; } if (!m.canSpin()) return; m.betIdx = Math.max(0, m.betIdx - 1); SFX.button(); },
  onLockChange(locked) {
    if (this.mode !== 'play') return;
    if (!locked && !this.uiOpen && (!player.seated || MG.active) && !(MG.active && MG.active.cursor) && this.mode === 'play') { this.paused = true; $('resume').classList.remove('hidden'); }
    if (locked) { this.paused = false; $('resume').classList.add('hidden'); }
  },
  onCanvasClick(e) {
    if (this.mode !== 'play') return;
    if (MG.active) { if (!this.uiOpen && !this.paused) MG.down(e); return; }
    if (player.seated) {
      const m = player.seated;
      const ray = new THREE.Raycaster(), nd = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(nd, camera);
      const hit = ray.intersectObjects([m.btns[5], m.deck, m.scr], false)[0];
      if (!hit) return;
      if (hit.object === m.scr && m.state === 'pick' && hit.uv) { const px = hit.uv.x * SW, py = (1 - hit.uv.y) * SH; for (let i = 0; i < 12; i++) { const cx = RX + 70 + (i % 6) * 154, cy = RY + 120 + Math.floor(i / 6) * 190; if (Math.hypot(px - cx, py - cy) < 64) { m.pickTile(i); break; } } }
      else if (hit.object === m.scr) this.deckSpin();
      else {
        const id = hit.object === m.btns[5] ? 'spin' : deckHit(hit.uv);
        if (id === 'spin') this.deckSpin(); else if (id === 'betup') this.betUp(); else if (id === 'betdn') this.betDn();
        else if (id === 'cash') this.insertCash(); else if (id === 'gamble') m.startGamble();
        else if (id === 'collect') { if (m.state === 'gamble') m.takeGamble(); else this.collect(); }
        if (id) { SFX.button(); PokieFX.press(id); }
      }
      return;
    }
    if (!input.locked && !this.uiOpen) lockPointer();
  },
  // -------------------------------------------------- interaction targeting
  target: null,
  findTarget() {
    if (player.seated || this.uiOpen || MG.active) return null;
    const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), cp = camera.position;
    let best = null, bs = 0;
    for (const it of interactables) {
      if (!it.enabled()) continue;
      if (it.zone) { const z = it.zone; if (player.pos.x > z.x0 && player.pos.x < z.x1 && player.pos.z > z.z0 && player.pos.z < z.z1 && fw.x < -0.35) { const sc = 0.5; if (sc > bs) { bs = sc; best = it; } } continue; }
      const d = _v1.copy(it.pos).sub(cp), dist = d.length(); if (dist > it.r) continue;
      const dot = d.normalize().dot(fw); if (dot < 0.8) continue;
      const sc = dot - dist * 0.08 + (it.temp ? 0.3 : 0); if (sc > bs) { bs = sc; best = it; }
    }
    // NPCs to talk to
    for (const n of NPCS) {
      if (n.role === 'bartender' || n.state === 'walk') continue;
      const hp = _v2.set(n.pos.x, 1.45, n.pos.z), d = hp.clone().sub(cp), dist = d.length(); if (dist > 1.9) continue;
      const dot = d.normalize().dot(fw); if (dot < 0.88) continue;
      const sc = dot - dist * 0.08 + 0.05; if (sc > bs) { bs = sc; best = { npc: n, label: () => `Talk to ${n.name}`, action: () => this.talkTo(n) }; }
    }
    return best;
  },
  interact() { const t = this.target; if (t) { SFX.click(); t.action(); } },
  phone() {
    const s = this.state, dd = DIFF[s.diff], n = s.night;
    this.openPanel('YOUR PHONE', `${DAYS[s.day].name} ${this.clockText()} · 23% battery`, `
      ${Night.phoneHTML()}
      <div class="setrow"><span>Wallet</span><b>${fmt$(s.wallet)}</b></div><div class="setrow"><span>Bank</span><b>${fmt$(s.bank)}</b></div>
      <div class="setrow"><span>Rent due Sunday</span><b>${fmt0(dd.rent)}</b></div><div class="setrow"><span>Tonight: drinks / pokies in / pokies won</span><b>${fmt$(n.spentDrinks)} / ${fmt$(n.wagered)} / ${fmt$(n.won)}</b></div>
      <div class="setrow"><span>Week so far: wagered / won</span><b>${fmt$(s.stats.wagered)} / ${fmt$(s.stats.won)}</b></div>
      <p style="font-size:13px;opacity:.75;margin-top:10px">💬 <b>Mum:</b> Don't stay out too late love xx<br>💬 <b>Landlord:</b> Reminder rent is due Sunday.<br>${['💬 <b>Jess (sis):</b> Heard the Royal\'s up for sale?? Isn\'t that your local?', '💬 <b>Bev:</b> There\'s a bloke in a suit sniffing around. Keep an eye out.', `💬 <b>Bev:</b> Jar\'s on the bar. ${fmt0(STORY.st().fund)} so far!`, '💬 <b>Old Mick:</b> (voicemail, 4 minutes long, mostly about 1977)', '💬 <b>Shazza:</b> KARAOKE TONIGHT!!! 🎤🎤🎤 every point = $1 for the jar', '💬 <b>Bev:</b> Petition\'s ready. Come see me.', '💬 <b>Bev:</b> Council\'s at the pub at 8. Don\'t be late.'][s.day]}<br>${s.debts.length ? `💬 <b>You:</b> ${s.debts.map(d => d.name).join(', ')} owe${s.debts.length === 1 ? 's' : ''} you money.` : ''}</p>`);
  },
  timeScale: 0.8 / 60 * settings.timeSpeed, // game hours per real second (0.8 game-min / sec at normal speed)
};

function updateBoards(D) {
  const draw = (b, lines, big) => {
    const x = b.c.getContext('2d'), W = b.c.width, H = b.c.height;
    x.fillStyle = '#1a1e1c'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; x.fillRect(Math.random() * W, Math.random() * H, rand(20, 120), rand(1, 4)); }
    x.textAlign = 'center'; x.fillStyle = '#f2efe6';
    lines.forEach((l, i) => { let fs = i === 0 ? 70 : 60; x.font = `${fs}px 'Permanent Marker', cursive`; while (fs > 24 && x.measureText(l).width > W - 48) { fs -= 4; x.font = `${fs}px 'Permanent Marker', cursive`; } x.fillStyle = ['#f2efe6', '#ffd84a', '#ff8a7a', '#8ad8ff', '#f2efe6'][i % 5]; x.fillText(l, W / 2, 110 + i * (H - 160) / Math.max(1, lines.length - 1) * 0.85); });
    b.tex.needsUpdate = true;
  };
  draw(dynamic.boards.aframe, [VENUE.name, ...D.board, 'POKIES · TAB · KENO']);
  draw(dynamic.boards.specials, ['SPECIALS', 'PARMA $26', 'CHIPS $9', D.event === 'parma' ? 'PARMA+POT $15' : D.event === 'sunday' ? 'ROAST $22' : 'SCHOONER $9.50', 'NO SHIRT NO SERVICE']);
}

// =====================================================================
//  MAIN LOOP
// =====================================================================
const clock = new THREE.Clock();
const _hazeCol = new THREE.Color();
let elapsed = 0, titleT = 0, attractT = 0, topT = 0, tvT = 0, jpT = 0, kenoT = 0, envT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  if (Game.mode === 'loading') return;
  simulate(dt);
  fxPass.uniforms.uTime.value = elapsed;
  // shadows are static-ish: refresh a couple of times a second instead of every frame
  if (shadowDirty > 0) { renderer.shadowMap.needsUpdate = true; shadowDirty--; }
  renderer.info.reset();
  composer.render();
  perfOverlay(dt);
  // dynamic resolution: keep ~55-60fps by trading pixels for frames
  perf.ema = perf.ema * 0.95 + dt * 0.05; perf.t += dt;
  // one-way: only ever steps DOWN after sustained slowness, so it can't oscillate or pop back and forth
  if (Game.mode === 'play' && perf.t > 3 && !window.__noDynRes && settings.dynres) {
    perf.t = 0;
    perf.slow = perf.ema > 1 / 42 ? perf.slow + 1 : 0;
    if (perf.slow >= 3 && renderScale > 0.62) { setRenderScale(renderScale - 0.15); perf.slow = 0; }
  }
}
const perf = { ema: 1 / 60, t: 0, slow: 0, show: /[?&]perf/.test(location.search), ot: 0, frames: 0, worst: 0 };
// F3: frame rate, frame time, draw calls and triangles (counted across every post-processing pass)
function perfOverlay(dt) {
  perf.frames++; perf.ot += dt; perf.worst = Math.max(perf.worst, dt);
  if (perf.ot < 0.5) return;
  const el = $('perf');
  if (perf.show) {
    const i = renderer.info;
    el.innerHTML = `<b>${Math.round(perf.frames / perf.ot)}</b> fps · ${(perf.ot / perf.frames * 1000).toFixed(1)} ms (worst ${(perf.worst * 1000).toFixed(0)})<br>${i.render.calls} draws · ${(i.render.triangles / 1000).toFixed(0)}k tris · ${i.memory.textures} tex<br>${settings.quality.toUpperCase()} · res ${Math.round(renderScale * 100)}% · ${renderer.getPixelRatio().toFixed(2)}x${ASSETS.lightmaps ? ' · baked light' : ''}${window.__gpu ? '<br><span>' + window.__gpu.slice(0, 48) + '</span>' : ''}`;
  }
  el.classList.toggle('hidden', !perf.show);
  perf.frames = 0; perf.ot = 0; perf.worst = 0;
}
// debug/test helper: fast-forward the simulation without rendering
window.__sim = (sec, step = 1 / 30) => { for (let i = 0; i < sec / step; i++) simulate(step); };
function simulate(dt) {
  if (Cine.active) { Cine.rdt = dt; dt *= Cine.slow; }
  elapsed += dt;
  const s = Game.state;
  const playing = Game.mode === 'play' && !Game.paused;
  if (Game.mode === 'title' || Game.mode === 'card') {
    titleT += dt;
    const a = -0.35 + Math.sin(titleT * 0.05) * 0.3;
    camera.position.set(Math.sin(a) * 19 + 2, 2.4 + Math.sin(titleT * 0.1) * 0.4, 6 + Math.cos(a) * 15);
    camera.lookAt(0, 4.2, 1);
  }
  vm.root.visible = Game.mode === 'play' && !MG.active;
  if (playing) {
    if (!Cine.active) s.time += dt * Game.timeScale;
    updatePlayer(dt, elapsed);
    Game.updateEvents(dt); DLG.update(dt); Overheard.update(dt); Eat.update(dt, elapsed); Food.update(dt);
    Game.updateKeno(dt);
    setTimeOfDay(s.time, DAYS[s.day].weather); // every frame: lighting changes smoothly, no steps
    const t = Game.findTarget(); Game.target = t;
    const pr = $('prompt');
    if (t) { pr.innerHTML = `<kbd>E</kbd>${t.label()}`; pr.classList.remove('hidden'); $('cross').classList.add('on'); } else { pr.classList.add('hidden'); $('cross').classList.remove('on'); }
    if (Game.subT > 0) { Game.subT -= dt; if (Game.subT <= 0) $('subtitle').innerHTML = ''; }
    if (Game.objShownAt != null && elapsed - Game.objShownAt > 9) $('objective').style.opacity = keys.Tab ? 1 : 0;
    if (Game.frameN % 6 === 0) { Game.updateHUD(); if (Game.frameN % 120 === 0) Game.objective(); }
    // FX uniforms
    fxPass.uniforms.uDrunk.value = damp(fxPass.uniforms.uDrunk.value, clamp((s.drunk - 25) / 70, 0, 1) * (settings.reduceMotion ? 0 : settings.drunkFx), 1, dt);
    fxPass.uniforms.uHang.value = s.startHang ? Math.max(0, 0.5 - (s.time - s.startTime) * 0.4) : 0;
  }
  if (Game.mode === 'play' || Game.mode === 'title' || Game.mode === 'card') {
    // world simulation (also runs behind title for ambience)
    const pp = Game.mode === 'play' ? player.pos : camera.position;
    const actors = [{ x: pp.x, z: pp.z, r: 0.32 }];
    for (const n of NPCS) { n.dist2 = (n.pos.x - camera.position.x) ** 2 + (n.pos.z - camera.position.z) ** 2; if (Game.mode !== 'play' || !Game.paused) updateNPC(n, dt, elapsed, pp); if (n.state === 'walk') actors.push({ x: n.pos.x, z: n.pos.z, r: 0.25 }); }
    updateDoors(dt, actors);
    for (const m of MACHINES) {
      if (m.mode === 'player') { m.update(dt); m.draw(); }
      else if (m.mode === 'npc') { const d2 = (m.def.pos.x - camera.position.x) ** 2 + (m.def.pos.z - camera.position.z) ** 2; if (d2 < 140 && (Game.frameN + m.idx) % 4 === 0) m.draw(); }
    }
    attractT += dt; if (attractT > 0.16) { attractT = 0; for (const id in shared) drawAttract(id, 0.16); }
    topT += dt; if (topT > 0.5) { topT = 0; for (const id in shared) drawTopper(id); }
    jpT += dt; if (jpT > 0.25) { jpT = 0; drawJPBoard(elapsed); }
    tvT += dt; if (tvT > 0.1) { for (const tv of dynamic.tvs) drawTV(tv, tvT); tvT = 0; }
    kenoT += dt; if (kenoT > 0.25) { kenoT = 0; Game.drawKeno(); Racing.drawBoard(); }
    for (const f of dynamic.fans) f.rotation.y += dt * 3.2;
    if (dynamic.flames) dynamic.flames.forEach((f, i) => { f.scale.set(0.28 + Math.sin(elapsed * 2.1 + i) * 0.03, 0.44 + Math.sin(elapsed * 3.3 + i * 2) * 0.06, 1); });
    dynamic.fire.intensity = 7.5 + Math.sin(elapsed * 1.9) * 0.6 + Math.sin(elapsed * 3.1) * 0.3; dynamic.heater.intensity = 9;
    smokeFX.update(dt, elapsed); dropFX.update(dt, elapsed); sparkFX.update(dt, elapsed);
    updateShards(dt); updateFalling(dt, elapsed); updatePuddles(dt);
    updateRain(dt, camera.position);
    const inside = isInside(camera.position.x, camera.position.z);
    // warm, smoky indoor haze vs the outdoor sky fog
    const gam = inGaming(camera.position.x, camera.position.z);
    atmo.iF = damp(atmo.iF || 0, inside ? 1 : 0, 3, dt);
    if (window.__fogOut) { scene.fog.color.copy(window.__fogOut.c).lerp(_hazeCol.set(gam ? 0x26131f : 0x2c1c11), atmo.iF); scene.fog.density = lerp(window.__fogOut.d, gam ? 0.032 : 0.026, atmo.iF); }
    Town.glow(atmo.nightF); fxPass.uniforms.uWarm.value = atmo.iF * VENUE.warm * (1 - Night.house * 0.55); fxPass.uniforms.uDim.value = Night.dark * 0.5 * atmo.iF; fxPass.uniforms.uNight.value = atmo.nightF;
    updateAtmosphere(dt, elapsed, camera.position, inside);
    updateZones(dt); updateTraffic(dt); TOUCH.update(); PokieFX.update(dt); CashFX.update(dt); ATM.update(dt); Juke.update(dt);
    updatePeopleShadows();
    bloom.threshold = damp(bloom.threshold, inside ? 0.82 : lerp(0.82, 4.0, window.__dayF || 0), 3, dt);
    renderer.toneMappingExposure = damp(renderer.toneMappingExposure, (inside ? (1.15 * VENUE.exposure + Night.house * 0.55) * (1 - Night.dark * 0.8) : lerp(1.25, 0.62, window.__dayF || 0)) * settings.brightness, 2, dt);
    fxPass.uniforms.uSmoke.value = damp(fxPass.uniforms.uSmoke.value, onTerrace(camera.position.x, camera.position.z) ? 0.6 : 0, 1, dt);
    AudioSys.update(dt, { inside, gaming: inGaming(camera.position.x, camera.position.z), pos: camera.position, machinePositions: MACHINES.filter(m => m.mode !== 'idle' || Math.random() < 0.3).map(m => m.screenW), firePos: dynamic.firePos, jukePos: dynamic.jukePos });
  }
  Game.frameN++;
}

// =====================================================================
//  UI WIRING
// =====================================================================
function wireUI() {
  $('btnNew').onclick = () => { AudioSys.init(); $('mainMenu').classList.add('hidden'); $('diffMenu').classList.remove('hidden'); };
  document.querySelectorAll('.dcard').forEach(c => c.onclick = () => { AudioSys.init(); SFX.click(); Game.newWeek(c.dataset.diff); });
  $('btnContinue').onclick = () => { AudioSys.init(); if (Game.load()) Game.showDayCard(); };
  $('btnAch').onclick = () => { $('title').classList.add('hidden'); achievementsPanel(() => $('title').classList.remove('hidden')); };
  $('btnControls').onclick = () => {
    $('title').classList.add('hidden');
    Game.openPanel('HOW TO PLAY', 'A week at the Royal Hotel. Make rent on Sunday. Have a good time.', `
      <div class="ctrls"><span class="kbd">WASD</span><span>Walk (SHIFT to run — careful, you'll slosh your beer)</span><span class="kbd">MOUSE</span><span>Look</span>
      <span class="kbd">E</span><span>Interact: bar, ATM, Keno, jukebox, machines, talk to locals, pick up drinks</span><span class="kbd">F</span><span>Sip your drink</span>
      <span class="kbd">C</span><span>Smoke (outside, or at the terrace machines). Press again for another drag.</span><span class="kbd">G</span><span>Drop your glass (the pub will cheer)</span><span class="kbd">TAB</span><span>Phone: money & messages</span>
      <span class="kbd">SPACE</span><span>At a pokie: spin / slam-stop / pick</span><span class="kbd">↑ ↓</span><span>Change bet</span><span class="kbd">I</span><span>Insert cash</span><span class="kbd">ENTER</span><span>Collect a ticket</span><span class="kbd">G R B</span><span>Gamble a win: red or black</span><span class="kbd">Q</span><span>Stand up</span></div>
      <p style="font-size:13px;opacity:.75;line-height:1.5">Each night starts at a different time with its own event. Leave early & sober and you'll pick up overtime tomorrow. Get legless and you'll be docked pay and start late. The pokies are tuned like real ones — about 85–95% return. Over a week, the house wins.</p>`, [{ label: 'Back', fn: () => { Game.closePanel(); $('title').classList.remove('hidden'); } }]);
  };
  $('btnSettings').onclick = () => { $('title').classList.add('hidden'); openSettings(() => $('title').classList.remove('hidden')); };
  $('btnPauseSettings').onclick = () => { $('resume').classList.add('hidden'); openSettings(() => { $('resume').classList.remove('hidden'); }); };
  $('btnResume').onclick = () => { lockPointer(); };
  $('btnHome').onclick = () => { $('resume').classList.add('hidden'); Game.paused = false; Game.endNight('home'); };
  $('btnQuit').onclick = () => { $('resume').classList.add('hidden'); Game.paused = false; Game.save(); Game.mode = 'title'; Game.toTitle(); };
  // deck
  const D = (id, fn) => { $(id).onclick = e => { e.stopPropagation(); AudioSys.init(); fn(); }; };
  D('dkSpin', () => Game.deckSpin()); D('dkBetUp', () => Game.betUp()); D('dkBetDn', () => Game.betDn());
  D('dkCash', () => Game.insertCash()); D('dkCollect', () => { const m = player.seated; if (m && m.state === 'gamble') m.takeGamble(); else Game.collect(); });
  D('dkAuto', () => player.seated && player.seated.startGamble());
  D('dkSip', () => sipDrink()); D('dkSmoke', () => { const m = player.seated; if (m && m.def.smoke) startSmoke(); else Game.toast('No smoking in here — use the terrace machines.'); });
  D('dkLeave', () => Game.leaveMachine());
}


// ---- src/09-minigames.js ----

// =====================================================================
//  MINIGAMES: shared framework (camera, input, HUD) + DARTS
// =====================================================================
// A minigame owns the camera and input while it runs. It implements any of:
//   enter(), exit(silent), update(dt,t), key(code), down(e), up(e), quit()
const MG = {
  active: null, hideHands: true,
  start(g) {
    if (this.active) this.stop(true);
    this.active = g; Game.closePanel();
    $('mg').classList.remove('hidden'); $('hints').classList.add('hidden'); $('prompt').classList.add('hidden'); $('cross').classList.add('hidden');
    this.camPos = camera.position.clone(); this.camQ = camera.quaternion.clone();
    g.enter && g.enter(); if (!g.cursor) lockPointer();
  },
  stop(silent) {
    const g = this.active; if (!g) return;
    this.active = null; g.exit && g.exit(silent);
    for (const id of ['mg', 'mgRet', 'mgPow']) $(id).classList.add('hidden');
    $('hints').classList.remove('hidden'); $('cross').classList.remove('hidden');
    Game.setText('mgTop', ''); Game.setText('mgHelp', '');
    if (Game.mode === 'play') lockPointer();
  },
  update(dt, t) { const g = this.active; if (g) g.update(dt, t); input.mx = input.my = 0; },
  top(html) { Game.setText('mgTop', html); },
  help(html) { Game.setText('mgHelp', html); },
  key(code) { const g = this.active; if (!g) return; if (code === 'KeyQ') { g.quit ? g.quit() : this.stop(); return; } g.key && g.key(code); },
  down(e) { const g = this.active; if (g && g.down) g.down(e); else if (!input.locked) lockPointer(); },
  up(e) { const g = this.active; if (g && g.up) g.up(e); },
  // smooth camera move towards pos, looking at look
  cam(pos, look, dt, k = 5, fov = null) {
    const q = _q1.setFromRotationMatrix(_m1.lookAt(pos, look, V3(0, 1, 0)));
    camera.position.lerp(pos, 1 - Math.exp(-k * dt)); camera.quaternion.slerp(q, 1 - Math.exp(-k * dt));
    if (fov && Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
  },
  // put a DOM element over a world point
  pin(el, p) { _v1.copy(p).project(camera); el.style.left = ((_v1.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _v1.y) / 2 * innerHeight) + 'px'; },
  // take an NPC out of the crowd simulation and drive them directly
  lockNPC(n, pos, ry, kind = 'stand') { n.mg = { pos: pos.clone(), ry, kind, look: null }; n.a.holdDrink = false; n.glass.group.visible = false; n.a.phone = false; n.cig.visible = false; n.a.smoking = false; },
  unlockNPC(n, spot) {
    if (!n.mg) return; n.mg = null;
    if (spot && (!spot.occ || spot.occ.reserved)) { spot.occ = null; claim(n, spot); seatNPC(n); }
    else { n.timer = 0; n.state = 'idle'; n.kind = 'stand'; }
  },
  // find someone to play: whoever is at the spot, a regular who is in tonight, or a fresh local
  opponent(spotFilter, preferName) {
    const sp = SPOTS.find(spotFilter);
    let n = sp && sp.occ && sp.occ.role === 'patron' ? sp.occ : null;
    if (!n && preferName) n = NPCS.find(o => o.name === preferName && o.state === 'idle' && !o.mg && o.role !== 'bartender');
    if (!n) { n = mkNPC({ pos: NODES.P8.clone().add(V3(0.6, 0, 0.4)) }); n.state = 'idle'; n.kind = 'stand'; }
    release(n);
    if (sp) sp.occ = { reserved: true };
    return { n, sp };
  },
};
function updateMGNPC(n, dt, t, pl) {
  const m = n.mg, a = n.a;
  const dx = m.pos.x - n.pos.x, dz = m.pos.z - n.pos.z, d = Math.hypot(dx, dz);
  let kind = m.kind;
  if (d > 0.04) { const sp = Math.min(d, 1.2 * dt); n.pos.x += dx / d * sp; n.pos.z += dz / d * sp; n.ry += angleDiff(n.ry, Math.atan2(dx, dz)) * Math.min(1, dt * 8); a.walkPh += dt * 6.5; kind = 'walk'; }
  else n.ry += angleDiff(n.ry, m.ry) * Math.min(1, dt * 6);
  const p = poseFor(n.cheerT > 0 ? 'cheer' : kind, t + a.seed, a);
  const lk = m.look || (Math.hypot(pl.x - n.pos.x, pl.z - n.pos.z) < 3 ? pl : null);
  if (lk && kind !== 'walk') { p.headY = clamp(angleDiff(n.ry, Math.atan2(lk.x - n.pos.x, lk.z - n.pos.z)), -1.1, 1.1); }
  applyPose(n.h, p, dt, 10); faceAnim(n, dt, t);
  n.phone.visible = false;
  n.h.root.position.set(n.pos.x, groundY(n.pos.x, n.pos.z), n.pos.z); n.h.root.rotation.y = n.ry;
}

// ---------------------------------------------------------------------
//  DARTS — 3 rounds of 3 darts, highest total wins, against a local
// ---------------------------------------------------------------------
const DARTS = {
  C: V3(-7.0, 1.73, -17.8), R: 0.2255, OCHE_Z: -17.8 + 2.37,
  SEG: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5],
  RAD: { bullIn: 0.00635, bullOut: 0.0159, trebIn: 0.099, trebOut: 0.107, dblIn: 0.162, dblOut: 0.170 },
  board: null, darts: [], skill: 0,
};
function texDartboard() {
  const S = 1024, c = mkCanvas(S, S), x = c.getContext('2d'), cx = S / 2, k = (S / 2) / DARTS.R, R = DARTS.RAD;
  x.fillStyle = '#0d0d0d'; x.beginPath(); x.arc(cx, cx, S / 2, 0, 7); x.fill();
  const seg = (r0, r1, a0, a1, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cx, r1 * k, a0, a1); x.arc(cx, cx, r0 * k, a1, a0, true); x.closePath(); x.fill(); };
  for (let i = 0; i < 20; i++) {
    // canvas angles: 0 = +x, clockwise. segment i is centred i*18° clockwise from the top.
    const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + Math.PI / 10, dark = i % 2 === 0;
    seg(R.bullOut, R.trebIn, a0, a1, dark ? '#151311' : '#efe3c2');
    seg(R.trebOut, R.dblIn, a0, a1, dark ? '#151311' : '#efe3c2');
    seg(R.trebIn, R.trebOut, a0, a1, dark ? '#c0281f' : '#1d7a3c');
    seg(R.dblIn, R.dblOut, a0, a1, dark ? '#c0281f' : '#1d7a3c');
  }
  x.fillStyle = '#1d7a3c'; x.beginPath(); x.arc(cx, cx, R.bullOut * k, 0, 7); x.fill();
  x.fillStyle = '#c0281f'; x.beginPath(); x.arc(cx, cx, R.bullIn * k, 0, 7); x.fill();
  // sisal fibre: tiny radial specks
  const id = x.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(id, 0, 0);
  // spider wire
  x.strokeStyle = 'rgba(205,205,210,.9)'; x.lineWidth = 2.2;
  for (const r of [R.bullIn, R.bullOut, R.trebIn, R.trebOut, R.dblIn, R.dblOut]) { x.beginPath(); x.arc(cx, cx, r * k, 0, 7); x.stroke(); }
  for (let i = 0; i < 20; i++) { const a = (-90 - 9 + i * 18) * Math.PI / 180; x.beginPath(); x.moveTo(cx + Math.cos(a) * R.bullOut * k, cx + Math.sin(a) * R.bullOut * k); x.lineTo(cx + Math.cos(a) * R.dblOut * k, cx + Math.sin(a) * R.dblOut * k); x.stroke(); }
  // number ring
  x.fillStyle = '#f2f0ea'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 54px "Bebas Neue", Impact, sans-serif';
  for (let i = 0; i < 20; i++) { const a = (-90 + i * 18) * Math.PI / 180, r = 0.197 * k; x.save(); x.translate(cx + Math.cos(a) * r, cx + Math.sin(a) * r); x.rotate(a + Math.PI / 2); x.fillText(DARTS.SEG[i], 0, 0); x.restore(); }
  x.strokeStyle = 'rgba(205,205,210,.6)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cx, 0.181 * k, 0, 7); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function buildDartboard() {
  const g = new THREE.Group(); g.position.copy(DARTS.C); scene.add(g);
  const bt = texDartboard(); // the board's own little lamp: a touch of self-light instead of another real light
  const face = new THREE.Mesh(new THREE.CircleGeometry(DARTS.R, 72), new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.95 }));
  face.position.z = 0.021; g.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(DARTS.R + 0.004, DARTS.R + 0.004, 0.042, 64, 1, true), MAT.blackPlastic); rim.rotation.x = Math.PI / 2; g.add(rim);
  // surround ring (protects the wall) + little lamp
  const sur = new THREE.Mesh(new THREE.RingGeometry(DARTS.R + 0.004, 0.3, 48), M({ color: 0x2a2624, roughness: 0.9 })); sur.position.z = 0.004; g.add(sur);
  SB.add(G.box, MAT.iron, -7.0, 2.14, -17.7, 0, 0, 0, 0.6, 0.03, 0.22);
  const lampGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.02), MAT.bulb); lampGlow.rotation.x = Math.PI / 2; lampGlow.position.set(-7.0, 2.124, -17.66); scene.add(lampGlow);
  // oche: brass strip on the floor 2.37 m from the face
  SB.add(G.box, MAT.brass, -7.0, 0.004, DARTS.OCHE_Z, 0, 0, 0, 0.6, 0.008, 0.04);
  // chalk scoreboard beside the board
  const sc = mkCanvas(512, 640); DARTS.chalk = { c: sc, tex: canvasTex(sc, 1, 1) };
  const cb = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.75), new THREE.MeshStandardMaterial({ map: DARTS.chalk.tex, roughness: 0.95 })); cb.position.set(-6.25, 1.65, -17.83); scene.add(cb);
  SB.add(G.box, MAT.darkWood, -6.25, 1.65, -17.86, 0, 0, 0, 0.66, 0.81, 0.03);
  drawDartChalk(null);
  DARTS.board = g;
  addInteract({ id: 'darts', pos: V3(-7.0, 1.5, DARTS.OCHE_Z - 0.6), r: 3.2, label: () => 'Play darts', enabled: () => !MG.active, action: () => Darts.offer() });
}
function drawDartChalk(gm) {
  const b = DARTS.chalk; if (!b) return;
  const x = b.c.getContext('2d'), W = 512, H = 640;
  x.fillStyle = '#1b201d'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * W, Math.random() * H, rand(20, 140), rand(1, 3)); }
  x.fillStyle = '#efeee6'; x.textAlign = 'center'; x.font = "54px 'Permanent Marker', cursive"; x.fillText(gm ? 'GAME ON' : 'DARTS', W / 2, 70);
  x.font = "34px 'Permanent Marker', cursive";
  if (!gm) { ['Winner stays on', 'Highest score', '3 rounds · 3 darts', 'Ask at the oche'].forEach((l, i) => { x.fillStyle = ['#ffd84a', '#efeee6', '#8ad8ff', '#efeee6'][i]; x.fillText(l, W / 2, 170 + i * 80); }); }
  else {
    x.fillStyle = '#ffd84a'; x.fillText('YOU', W * 0.3, 140); x.fillText(gm.opp.name.toUpperCase().slice(0, 9), W * 0.72, 140);
    x.fillStyle = '#efeee6';
    for (let r = 0; r < 3; r++) { x.fillText(gm.rounds[0][r] ?? '–', W * 0.3, 210 + r * 70); x.fillText(gm.rounds[1][r] ?? '–', W * 0.72, 210 + r * 70); }
    x.strokeStyle = '#efeee6'; x.lineWidth = 3; x.beginPath(); x.moveTo(40, 420); x.lineTo(W - 40, 420); x.moveTo(W / 2, 110); x.lineTo(W / 2, 500); x.stroke();
    x.fillStyle = '#7dff9a'; x.fillText(gm.total(0), W * 0.3, 480); x.fillText(gm.total(1), W * 0.72, 480);
    if (gm.stake) { x.fillStyle = '#ff9a7a'; x.fillText(`$${gm.stake} a side`, W / 2, 590); }
  }
  b.tex.needsUpdate = true;
}
function dartScore(dx, dy) {
  const R = DARTS.RAD, r = Math.hypot(dx, dy);
  if (r <= R.bullIn) return { pts: 50, label: 'BULLSEYE' };
  if (r <= R.bullOut) return { pts: 25, label: 'OUTER BULL' };
  if (r > R.dblOut) return { pts: 0, label: r > DARTS.R ? 'MISSED THE BOARD' : 'NO SCORE' };
  const ang = (Math.atan2(dx, dy) * 180 / Math.PI + 360 + 9) % 360, base = DARTS.SEG[Math.floor(ang / 18)];
  if (r > R.trebIn && r <= R.trebOut) return { pts: base * 3, label: 'TREBLE ' + base };
  if (r > R.dblIn) return { pts: base * 2, label: 'DOUBLE ' + base };
  return { pts: base, label: String(base) };
}
// board-plane offset (right, up) of a segment target
function dartTarget(num, ring) { const i = DARTS.SEG.indexOf(num), a = i * 18 * Math.PI / 180, r = ring === 't' ? 0.103 : ring === 'd' ? 0.166 : ring === 'bull' ? 0 : 0.135; return [Math.sin(a) * r, Math.cos(a) * r]; }
const _dartGeo = {};
function makeDart(col) {
  if (!_dartGeo.tip) {
    _dartGeo.tip = new THREE.CylinderGeometry(0.0006, 0.0012, 0.032, 6).rotateX(Math.PI / 2).translate(0, 0, -0.016);
    _dartGeo.barrel = new THREE.CylinderGeometry(0.0034, 0.0028, 0.048, 10).rotateX(Math.PI / 2).translate(0, 0, -0.056);
    _dartGeo.shaft = new THREE.CylinderGeometry(0.0017, 0.0017, 0.036, 6).rotateX(Math.PI / 2).translate(0, 0, -0.098);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.016, 0.006); sh.lineTo(0.016, 0.034); sh.lineTo(0.003, 0.04); sh.lineTo(0, 0.04);
    const fl = new THREE.ShapeGeometry(sh); fl.rotateY(-Math.PI / 2); fl.translate(0, 0, -0.084);
    _dartGeo.flight = fl;
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(_dartGeo.tip, MAT.chrome), new THREE.Mesh(_dartGeo.barrel, M({ color: 0x6a6c72, metalness: 0.9, roughness: 0.35 })), new THREE.Mesh(_dartGeo.shaft, M({ color: col, roughness: 0.4 })));
  const fm = M({ color: col, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(_dartGeo.flight, fm); f.rotation.z = i * Math.PI / 2; g.add(f); }
  return g;
}
SFX.dartThunk = pos => { SFX.noise(0.05, { freq: 900, q: 1.5, gain: 0.22, pos }); SFX.tone(140, 0.07, { gain: 0.12, fEnd: 90, pos }); };
SFX.whoosh = () => SFX.noise(0.18, { freq: 1800, q: 0.8, gain: 0.05, fEnd: 700 });

const Darts = {
  offer() {
    const s = Game.state;
    const preferred = (typeof REG !== 'undefined' && REG.here('Kenno')) ? 'Kenno' : null;
    const sp = SPOTS.find(o => o.anim === 'darts');
    const who = sp && sp.occ && sp.occ.role === 'patron' ? sp.occ.name : preferred || 'A local';
    const opts = [0, 5, 10, 20].map(st => ({ label: st ? `Play for $${st}` : 'Friendly game', d: st ? 'Winner takes the lot' : 'Just for bragging rights', price: st ? fmt0(st) : '', disabled: st > s.wallet, fn: () => { Game.closePanel(); this.begin(st, preferred); } }));
    Game.openPanel('DARTS', `${who} is keen for a game. Three rounds, three darts each — highest total wins.`, Game.optList(opts));
  },
  begin(stake, preferName, comp) {
    const { n, sp } = MG.opponent(o => o.anim === 'darts', preferName);
    const regular = typeof REG !== 'undefined' ? REG.get(n.name) : null;
    const skill = regular && regular.dartSkill != null ? regular.dartSkill : rand(0.35, 0.7);
    const gm = this.gm = {
      opp: n, sp, stake, comp, skill, rounds: [[], []], cur: 0, round: 0, phase: 'intro', t: 0, darts: [], thrown: 0, roundPts: 0,
      aimX: 0, aimY: 0.103, power: 0, charging: false, breath: 1, steady: false, sway: rand(0, 10), msg: '',
      total(i) { return this.rounds[i].reduce((a, b) => a + b, 0); },
    };
    if (stake) { Game.state.wallet -= stake; }
    MG.lockNPC(n, V3(-8.2, 0, DARTS.OCHE_Z + 0.3), Math.PI * 0.85);
    MG.start(this);
    bark(n, choice(["Righto, let's have ya.", "You're on, mate.", "Hope you've been practising.", "Loser shouts, yeah?"]), true);
  },
  enter() { drawDartChalk(this.gm); this.setPhase('player'); },
  exit(silent) {
    const gm = this.gm; if (!gm) return;
    for (const d of gm.darts) scene.remove(d.g);
    if (gm.inHand) camera.remove(gm.inHand);
    MG.unlockNPC(gm.opp, gm.sp);
    drawDartChalk(null);
    this.gm = null;
    if (!silent) { player.pos.set(-7.0, 0, DARTS.OCHE_Z + 0.6); player.yaw = 0; player.pitch = 0.05; }
  },
  quit() {
    const gm = this.gm;
    if (gm && gm.phase !== 'done' && gm.stake) { Game.toast(`Forfeited — ${gm.opp.name} keeps your $${gm.stake}.`); }
    else if (gm && gm.phase !== 'done') Game.toast('Called it off.');
    MG.stop();
  },
  setPhase(ph) {
    const gm = this.gm; gm.phase = ph; gm.t = 0;
    if (ph === 'player' || ph === 'ai') { gm.thrown = 0; gm.roundPts = 0; gm.cur = ph === 'player' ? 0 : 1; }
    if (ph === 'player') {
      MG.lockNPC(gm.opp, V3(-8.25, 0, DARTS.OCHE_Z + 0.5), Math.PI * 0.8);
      gm.opp.mg.look = V3(-7, 0, -17.8);
      if (!gm.inHand) { gm.inHand = makeDart(0x1d7a3c); gm.inHand.traverse(o => { o.frustumCulled = false; }); camera.add(gm.inHand); }
      gm.inHand.visible = true;
    }
    if (ph === 'ai') { MG.lockNPC(gm.opp, V3(-7.05, 0, DARTS.OCHE_Z + 0.08), Math.PI, 'darts'); gm.opp.a.dartT = 0; if (gm.inHand) gm.inHand.visible = false; }
    this.hud();
  },
  hud() {
    const gm = this.gm; if (!gm) return;
    const name = gm.opp.name;
    MG.top(`<div class="mgscore"><span>ROUND ${Math.min(3, gm.round + 1)} / 3</span><span><b>YOU</b> ${gm.total(0)}</span><span><b>${name.toUpperCase()}</b> ${gm.total(1)}</span>${gm.stake ? `<span class="stk">$${gm.stake} a side</span>` : ''}</div>${gm.msg ? `<div class="mgmsg">${gm.msg}</div>` : ''}`);
    MG.help(gm.phase === 'player' ? '<kbd>MOUSE</kbd> aim · hold <kbd>LMB</kbd> to wind up, release in the gold · hold <kbd>SHIFT</kbd> to steady your breath · <kbd>Q</kbd> forfeit' : gm.phase === 'ai' ? `${name} is throwing…` : '');
    drawDartChalk(gm);
  },
  down(e) { const gm = this.gm; if (!gm || gm.phase !== 'player' || gm.flying || e.button !== 0) return; gm.charging = true; gm.power = 0; gm.pdir = 1; },
  up(e) { const gm = this.gm; if (!gm || !gm.charging) return; gm.charging = false; this.playerThrow(); },
  key(code) { if (code === 'Space') { const gm = this.gm; if (gm && gm.phase === 'player' && !gm.flying) { if (!gm.charging) { gm.charging = true; gm.power = 0; gm.pdir = 1; } else { gm.charging = false; this.playerThrow(); } } } },
  boardPoint(dx, dy) { return V3(DARTS.C.x + dx, DARTS.C.y + dy, DARTS.C.z + 0.021); },
  throwDart(from, dx, dy, col, who) {
    const gm = this.gm, to = this.boardPoint(dx, dy);
    const g = makeDart(col); g.position.copy(from); scene.add(g);
    const d = { g, from: from.clone(), to, t: 0, T: from.distanceTo(to) / 9.5, h: 0.09 + from.distanceTo(to) * 0.025, dx, dy, who, stuck: false, wob: 0 };
    gm.darts.push(d); gm.flying = d; SFX.whoosh();
    return d;
  },
  playerThrow() {
    const gm = this.gm, drunk = Game.state.drunk / 100;
    // release error: power off the sweet spot moves the dart up/down; hands shake with the grog
    const perr = (gm.power - 0.62) * 0.33;
    const spread = 0.006 + 0.026 * drunk * drunk + 0.006 * drunk - (typeof REG !== 'undefined' ? REG.dartBonus() : 0);
    const dx = gm.aimX + gm.swX + gaussian() * spread, dy = gm.aimY + gm.swY + perr + gaussian() * spread;
    const from = camera.localToWorld(V3(0.11, -0.08, -0.25));
    this.throwDart(from, dx, dy, 0x1d7a3c, 0);
    gm.inHand.visible = false;
    gm.thrown++;
  },
  aiThrow() {
    const gm = this.gm, n = gm.opp, sk = gm.skill;
    // pick a target: mostly treble 20; good players switch to 19 when the 20 bed is crowded; the bull when chasing late
    let tgt = dartTarget(20, 't');
    const behind = gm.round === 2 && gm.total(0) - gm.total(1) > 120 - gm.thrown * 20;
    if (behind && Math.random() < 0.3) tgt = dartTarget(20, 't');
    else if (gm.darts.filter(d => d.who === 1 && Math.hypot(d.dx - tgt[0], d.dy - tgt[1]) < 0.012).length >= 2 && sk > 0.6) tgt = dartTarget(19, 't');
    const sigma = lerp(0.045, 0.012, sk);
    n.h.J.rH.updateWorldMatrix(true, false);
    const from = _v1.setFromMatrixPosition(n.h.J.rH.matrixWorld).clone().add(V3(0, 0.05, -0.1));
    this.throwDart(from, tgt[0] + gaussian() * sigma, tgt[1] + gaussian() * sigma, 0x111111, 1);
    gm.thrown++;
  },
  land(d) {
    const gm = this.gm;
    d.stuck = true; d.g.position.copy(d.to); d.wob = 1;
    const sc = dartScore(d.dx, d.dy);
    // bounce-outs off the wire, now and then
    const nearWire = Object.values(DARTS.RAD).some(r => Math.abs(Math.hypot(d.dx, d.dy) - r) < 0.0012);
    if (nearWire && Math.random() < 0.5) { d.bounce = true; d.v = V3(rand(-0.3, 0.3), 0.6, 1.2); sc.pts = 0; sc.label = 'BOUNCE-OUT!'; SFX.tone(2400, 0.05, { gain: 0.05, pos: d.to }); }
    else SFX.dartThunk(d.to);
    gm.roundPts += sc.pts;
    gm.msg = `<b>${d.who === 0 ? 'You' : gm.opp.name}:</b> ${sc.label}${sc.pts ? ` — ${sc.pts}` : ''}`;
    if (d.who === 0) {
      if (sc.pts === 50) { achieve('bullseye'); Game.state.mood = Math.min(100, Game.state.mood + 4); }
      if (gm.thrown === 3 && gm.roundPts === 180) { achieve('oneeighty'); SFX.cheer(d.to, 3); gm.msg = '<b>ONE HUNDRED AND EIGHTYYYY!</b>'; }
      else if (gm.thrown === 3 && gm.roundPts >= 100) { achieve('tonup'); SFX.cheer(d.to, 1); gm.msg += ` · <b>TON${gm.roundPts > 100 ? '-' + (gm.roundPts - 100) : ''}!</b>`; }
    } else if (sc.pts >= 57) bark(gm.opp, choice(['Get in there!', 'Too easy.', 'Treble top, baby!']), true);
    this.hud();
  },
  update(dt, t) {
    const gm = this.gm; if (!gm) return;
    gm.t += dt;
    const drunk = Game.state.drunk / 100;
    // darts in flight / wobbling / bouncing out
    for (const d of gm.darts) {
      if (!d.stuck) {
        d.t += dt; const s = clamp(d.t / d.T, 0, 1);
        const p = _v2.lerpVectors(d.from, d.to, s); p.y += d.h * 4 * s * (1 - s);
        const s2 = clamp(s + 0.02, 0, 1), p2 = _v3.lerpVectors(d.from, d.to, s2); p2.y += d.h * 4 * s2 * (1 - s2);
        d.g.position.copy(p); if (s < 0.999) d.g.lookAt(p2);
        if (s >= 1) { this.land(d); if (gm.flying === d) gm.flying = null; }
      } else if (d.bounce) {
        d.v.y -= 9.8 * dt; d.g.position.addScaledVector(d.v, dt); d.g.rotation.x += dt * 9;
        if (d.g.position.y < 0.02) { d.g.position.y = 0.02; d.v.set(0, 0, 0); d.bounce = false; d.dead = true; SFX.tone(1800, 0.04, { gain: 0.04, pos: d.g.position }); }
      } else if (d.wob > 0 && !d.dead) {
        d.wob = Math.max(0, d.wob - dt * 2.2);
        const w = Math.sin(t * 60) * 0.06 * d.wob; d.g.lookAt(d.g.position.x + w, d.g.position.y - 0.05 + w * 0.5, d.g.position.z - 1);
      }
    }
    const opp = gm.opp;
    opp.a.dartT = Math.max(0, (opp.a.dartT || 0) - dt);
    if (gm.phase === 'player') {
      // camera at the oche, right eye over the dart
      const eye = V3(-6.93, 1.64, DARTS.OCHE_Z + 0.05);
      MG.cam(eye, V3(-7.0, DARTS.C.y - 0.01, DARTS.C.z), dt, 6, 52);
      // aim with the mouse (pointer locked), sway grows with the drink
      gm.aimX = clamp(gm.aimX + input.mx * 0.00022 * settings.sens, -0.3, 0.3);
      gm.aimY = clamp(gm.aimY - input.my * 0.00022 * settings.sens, -0.3, 0.3);
      gm.steady = !!(keys.ShiftLeft || keys.ShiftRight) && gm.breath > 0;
      gm.breath = clamp(gm.breath + (gm.steady ? -dt / 2.6 : dt / 4), 0, 1);
      const amp = (0.0035 + 0.042 * Math.pow(drunk, 1.25)) * (gm.steady ? 0.35 : 1) * (gm.breath <= 0.01 ? 1.6 : 1);
      gm.sway += dt;
      gm.swX = (Math.sin(gm.sway * 0.9) + Math.sin(gm.sway * 2.3 + 1) * 0.35) * amp;
      gm.swY = (Math.cos(gm.sway * 0.7) + Math.sin(gm.sway * 1.9) * 0.4) * amp;
      if (gm.charging) { gm.power += gm.pdir * dt * (1.05 + drunk * 0.8); if (gm.power >= 1) { gm.power = 1; gm.pdir = -1; } if (gm.power <= 0) { gm.power = 0; gm.pdir = 1; } }
      // dart in hand follows the aim; pulls back while winding up
      if (gm.inHand) { const bp = this.boardPoint(gm.aimX + gm.swX, gm.aimY + gm.swY); camera.worldToLocal(bp); const dir = bp.clone().normalize(); gm.inHand.position.set(0.09 + dir.x * 0.05, -0.07 + dir.y * 0.05, -0.22 + (gm.charging ? gm.power * 0.07 : 0)); gm.inHand.quaternion.setFromUnitVectors(_v3.set(0, 0, 1), bp.sub(gm.inHand.position).normalize()); }
      const ret = $('mgRet'), pow = $('mgPow');
      ret.classList.toggle('hidden', !!gm.flying || gm.thrown >= 3); MG.pin(ret, this.boardPoint(gm.aimX + gm.swX, gm.aimY + gm.swY));
      pow.classList.toggle('hidden', !gm.charging); pow.firstElementChild.style.height = (gm.power * 100) + '%';
      ret.style.opacity = gm.steady ? 1 : 0.75;
      if (gm.thrown < 3 && !gm.flying && gm.inHand) gm.inHand.visible = true;
      if (gm.thrown >= 3 && !gm.flying && gm.t > 0.5 && !gm.endT) gm.endT = gm.t;
      if (gm.endT && gm.t - gm.endT > 1.6) { gm.endT = null; this.endTurn(); }
    } else if (gm.phase === 'ai') {
      $('mgRet').classList.add('hidden'); $('mgPow').classList.add('hidden');
      MG.cam(V3(-5.35, 1.72, DARTS.OCHE_Z + 1.25), V3(-7.0, 1.42, -16.7), dt, 3, 58);
      if (Math.hypot(opp.pos.x - opp.mg.pos.x, opp.pos.z - opp.mg.pos.z) < 0.06 && !gm.flying && gm.thrown < 3 && gm.t > 1.2 + gm.thrown * 1.5) {
        if (!gm.windT) { gm.windT = 0.32; opp.a.dartT = 0.5; }
      }
      if (gm.windT) { gm.windT -= dt; if (gm.windT <= 0) { gm.windT = 0; this.aiThrow(); } }
      if (gm.thrown >= 3 && !gm.flying && !gm.endT) gm.endT = gm.t;
      if (gm.endT && gm.t - gm.endT > 1.8) { gm.endT = null; this.endTurn(); }
    } else if (gm.phase === 'done') {
      MG.cam(V3(-5.9, 1.62, DARTS.OCHE_Z + 0.4), V3(-7.0, 1.5, -17.2), dt, 3, 58);
      if (gm.t > 4.5) MG.stop();
    }
  },
  endTurn() {
    const gm = this.gm;
    gm.rounds[gm.cur].push(gm.roundPts);
    // pull the darts out
    for (const d of gm.darts) scene.remove(d.g); gm.darts = [];
    if (gm.cur === 0) { gm.msg = `You scored <b>${gm.roundPts}</b>.`; this.setPhase('ai'); return; }
    gm.msg = `${gm.opp.name} scored <b>${gm.roundPts}</b>.`;
    gm.round++;
    if (gm.round < 3) { this.setPhase('player'); return; }
    const a = gm.total(0), b = gm.total(1);
    if (a === b) { gm.msg = 'Dead heat! One more round each.'; gm.rounds[0].pop(); gm.rounds[1].pop(); gm.round = 2; this.setPhase('player'); return; }
    this.finish(a > b);
  },
  finish(won) {
    const gm = this.gm, s = Game.state;
    gm.phase = 'done'; gm.t = 0; $('mgRet').classList.add('hidden');
    MG.lockNPC(gm.opp, V3(-7.6, 0, DARTS.OCHE_Z + 0.6), Math.PI * 0.75);
    if (won) {
      if (gm.stake) { s.wallet += gm.stake * 2; s.night.extra += gm.stake; }
      s.mood = Math.min(100, s.mood + 10); s.stats.dartsWon = (s.stats.dartsWon || 0) + 1; achieve('darts');
      if (gm.comp) { s.wallet += 60; s.night.extra += 60; s.flags.compWon = true; achieve('champ'); Night.addRep(5, 'Won the Royal darts comp'); Night.log('🏆', 'Won the Royal darts comp (+$60)'); Game.toast('🏆 ROYAL DARTS CHAMPION! The trophy and $60 prize pool are yours.', true); } Night.ev('dartsWon'); Night.log('🎯', `Beat ${gm.opp.name} at darts`);
      gm.msg = `<b>YOU WIN</b> ${gm.total(0)} to ${gm.total(1)}${gm.stake ? ` — +$${gm.stake}` : ''}`;
      bark(gm.opp, choice(['Fair play. Good arrows.', 'Bloody hell. Rematch next week.', 'Beginner\'s luck, that.']), true); SFX.cheer(DARTS.C, 1);
      if (typeof REG !== 'undefined') REG.bump(gm.opp.name, 4);
    } else {
      if (gm.stake) s.night.extra -= gm.stake;
      s.mood = Math.max(0, s.mood - 4);
      gm.msg = `<b>${gm.opp.name.toUpperCase()} WINS</b> ${gm.total(1)} to ${gm.total(0)}${gm.stake ? ` — −$${gm.stake}` : ''}`;
      gm.opp.cheerT = 1.6; bark(gm.opp, choice(['Too easy!', 'Thanks for the donation, mate.', 'Unlucky. Close one.']), true);
      if (typeof REG !== 'undefined') REG.bump(gm.opp.name, 2);
    }
    this.hud(); MG.help('');
  },
};
function gaussian() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---- src/10-pool-sim.js ----
// =====================================================================
//  POOL (8-BALL) — 2D physics, rules and AI. Pure logic: no three.js, no DOM.
//  Table-local coords in metres: x across (width), z along (length), y up.
// =====================================================================
const POOL = (() => {
  const BALL_R = 0.0286;
  const HALF_W = 0.61, HALF_L = 1.23;
  const GRAV = 9.81;
  const SQ2 = Math.SQRT2;
  const hyp = (a, b) => Math.sqrt(a * a + b * b);

  const PHYS = {
    tick: 1 / 240,          // fixed simulation tick (substepped further by speed)
    maxDisp: 0.4 * BALL_R,  // max travel of any ball per substep (anti-tunnelling)
    muSlide: 0.2,           // sliding friction (cloth)
    rollDecel: 0.12,        // m/s^2 when rolling
    spinDecel: 12,          // rad/s^2 decay of vertical-axis (side) spin
    ballE: 0.94,            // ball-ball restitution (isolated contacts)
    clusterE: 0.99,         // per-contact restitution inside touching clusters (rack) — offsets multi-contact losses
    contactTime: 0.00015,   // contact duration used by the cluster solver (s)
    cushionE: 0.75,         // cushion restitution (normal)
    cushionMu: 0.2,         // cushion friction (tangential loss / side-spin effect)
    slipEps: 0.002,         // m/s, below which sliding is considered rolling
    maxShotSpeed: 7,
  };

  // ------------------------------------------------------------------
  //  TABLE GEOMETRY
  // ------------------------------------------------------------------
  const TABLE = (() => {
    const cornerMouth = 0.115, middleMouth = 0.125;
    const dC = cornerMouth / SQ2;          // jaw point distance from the corner along each rail
    const hm = middleMouth / 2;
    const cornerJawAng = 38 * Math.PI / 180, cornerJawLen = 0.055;
    const midJawAng = 14 * Math.PI / 180, midJawLen = 0.04;
    const pockets = [], cushions = [];
    const P = (x, z) => ({ x, z });
    const seg = (a, b, jaw, pocket) => cushions.push({ a, b, jaw, pocket });

    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 1 : -1, row = Math.floor(i / 2), sz = row - 1;
      if (sz !== 0) {
        const cx = sx * HALF_W, cz = sz * HALF_L;
        const a = P(cx, sz * (HALF_L - dC)), b = P(sx * (HALF_W - dC), cz);
        const s = Math.sin(cornerJawAng), c = Math.cos(cornerJawAng);
        const a2 = P(a.x + sx * s * cornerJawLen, a.z + sz * c * cornerJawLen);
        const b2 = P(b.x + sx * c * cornerJawLen, b.z + sz * s * cornerJawLen);
        seg(a, a2, true, i); seg(b, b2, true, i);
        pockets.push({
          id: i, kind: 'corner', x: cx, z: cz,
          dir: P(sx / SQ2, sz / SQ2),                  // unit vector pointing out of the table into the pocket
          mouth: { a, b, width: cornerMouth },
          jaws: [{ a, b: a2 }, { a: b, b: b2 }],
          capture: { x: cx + sx * 0.01, z: cz + sz * 0.01, r: 0.058 },
          aim: P(cx - sx * 0.012, cz - sz * 0.012),    // point the AI aims object balls at
          minCos: Math.cos(60 * Math.PI / 180),
        });
      } else {
        const cx = sx * HALF_W;
        const a = P(cx, -hm), b = P(cx, hm);
        const s = Math.sin(midJawAng), c = Math.cos(midJawAng);
        const a2 = P(cx + sx * c * midJawLen, -hm + s * midJawLen);
        const b2 = P(cx + sx * c * midJawLen, hm - s * midJawLen);
        seg(a, a2, true, i); seg(b, b2, true, i);
        pockets.push({
          id: i, kind: 'middle', x: cx, z: 0,
          dir: P(sx, 0),
          mouth: { a, b, width: middleMouth },
          jaws: [{ a, b: a2 }, { a: b, b: b2 }],
          capture: { x: cx + sx * 0.03, z: 0, r: 0.032 },
          aim: P(cx + sx * 0.006, 0),
          minCos: Math.cos(50 * Math.PI / 180),
        });
      }
    }
    // straight cushion noses
    for (const sx of [-1, 1]) {
      seg(P(sx * HALF_W, -(HALF_L - dC)), P(sx * HALF_W, -hm), false, null);
      seg(P(sx * HALF_W, hm), P(sx * HALF_W, HALF_L - dC), false, null);
    }
    for (const sz of [-1, 1]) seg(P(-(HALF_W - dC), sz * HALF_L), P(HALF_W - dC, sz * HALF_L), false, null);
    for (const c of cushions) {
      c.dx = c.b.x - c.a.x; c.dz = c.b.z - c.a.z; c.len2 = c.dx * c.dx + c.dz * c.dz;
    }
    return {
      halfWidth: HALF_W, halfLength: HALF_L, width: 2 * HALF_W, length: 2 * HALF_L,
      bounds: { minX: -HALF_W, maxX: HALF_W, minZ: -HALF_L, maxZ: HALF_L },
      ballRadius: BALL_R,
      headString: 0.615,                 // kitchen is z > headString
      headSpot: P(0, 0.615),
      footSpot: P(0, -0.615),
      cueStart: P(0, 0.85),
      pockets, cushions,
    };
  })();

  const groupOf = id => (id >= 1 && id <= 7) ? 'solids' : (id >= 9 && id <= 15) ? 'stripes' : null;
  const otherGroup = g => g === 'solids' ? 'stripes' : 'solids';

  function randomQuat(rng) {
    const u1 = rng(), u2 = rng() * 2 * Math.PI, u3 = rng() * 2 * Math.PI;
    const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
  }

  // returns pocket index if a ball centre at (x, z) has dropped, else -1
  function pocketAt(x, z) {
    const ax = Math.abs(x), az = Math.abs(z);
    if (ax < HALF_W - 0.05 && az < HALF_L - 0.05) return -1;
    const pk = TABLE.pockets;
    for (let i = 0; i < 6; i++) {
      const c = pk[i].capture, dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r) return i;
    }
    if (ax > HALF_W + 0.6 * BALL_R || az > HALF_L + 0.6 * BALL_R) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < 6; i++) { const d = (x - pk[i].x) ** 2 + (z - pk[i].z) ** 2; if (d < bd) { bd = d; best = i; } }
      return best;
    }
    return -1;
  }

  // closest cushion contact (penetration > 0) for a ball centre; writes into out
  function cushionContact(x, z, out) {
    if (Math.abs(x) < HALF_W - BALL_R && Math.abs(z) < HALF_L - BALL_R) return false;
    let best = 0, found = false;
    for (const c of TABLE.cushions) {
      let t = ((x - c.a.x) * c.dx + (z - c.a.z) * c.dz) / c.len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = x - (c.a.x + c.dx * t), pz = z - (c.a.z + c.dz * t);
      const d2 = px * px + pz * pz;
      if (d2 < BALL_R * BALL_R) {
        const d = Math.sqrt(d2), pen = BALL_R - d;
        if (pen > best) {
          best = pen; found = true;
          out.pen = pen; out.nx = d > 1e-9 ? px / d : 0; out.nz = d > 1e-9 ? pz / d : 0; out.seg = c;
          if (d <= 1e-9) { out.nx = -Math.sign(x); out.nz = 0; }
        }
      }
    }
    return found;
  }

  // ------------------------------------------------------------------
  //  PHYSICS
  // ------------------------------------------------------------------
  class Sim {
    constructor(opts = {}) {
      this.rng = opts.rng || Math.random;
      this.balls = [];
      for (let id = 0; id < 16; id++) {
        this.balls.push({ id, x: 0, z: 0, vx: 0, vz: 0, w: { x: 0, y: 0, z: 0 }, pocketed: false, pocket: null, q: [0, 0, 0, 1] });
      }
      this.time = 0;
      this.shotEvents = [];
      this._acc = 0;
      this._active = false;
      this._c = { pen: 0, nx: 0, nz: 0, seg: null };
      if (opts.rack !== false) this.rack();
    }

    get cue() { return this.balls[0]; }

    rack() {
      const rng = this.rng, R = BALL_R;
      const solids = [1, 2, 3, 4, 5, 6, 7], stripes = [9, 10, 11, 12, 13, 14, 15];
      const take = (arr) => arr.splice(Math.floor(rng() * arr.length), 1)[0];
      const cs = take(solids), ct = take(stripes);
      const rest = solids.concat(stripes);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const flip = rng() < 0.5;
      const sp = 2 * R + 0.0002 + rng() * 0.0002;   // spacing with a small gap
      const rowDz = sp * Math.sqrt(3) / 2;
      let k = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          let id;
          if (row === 2 && i === 1) id = 8;
          else if (row === 4 && i === 0) id = flip ? cs : ct;
          else if (row === 4 && i === 4) id = flip ? ct : cs;
          else id = rest[k++];
          const b = this.balls[id];
          b.x = TABLE.footSpot.x + (i - row / 2) * sp + (rng() - 0.5) * 0.00012;
          b.z = TABLE.footSpot.z - row * rowDz + (rng() - 0.5) * 0.00012;
        }
      }
      const c = this.balls[0];
      c.x = TABLE.cueStart.x; c.z = TABLE.cueStart.z;
      for (const b of this.balls) {
        b.vx = b.vz = 0; b.w.x = b.w.y = b.w.z = 0; b.pocketed = false; b.pocket = null;
        b.q = randomQuat(rng);
      }
      this.shotEvents = [];
      this._acc = 0; this._active = false;
    }

    clone() {
      const s = new Sim({ rng: this.rng, rack: false });
      for (let i = 0; i < 16; i++) {
        const a = this.balls[i], b = s.balls[i];
        b.x = a.x; b.z = a.z; b.vx = a.vx; b.vz = a.vz; b.w.x = a.w.x; b.w.y = a.w.y; b.w.z = a.w.z;
        b.pocketed = a.pocketed; b.pocket = a.pocket; b.q = a.q.slice();
      }
      s.time = this.time; s._acc = this._acc; s._active = this._active;
      return s;
    }

    moving() {
      for (const b of this.balls) if (!b.pocketed && isMoving(b)) return true;
      return false;
    }

    canPlaceCue(x, z, behindHeadString = false) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      if (Math.abs(x) > HALF_W - BALL_R || Math.abs(z) > HALF_L - BALL_R) return false;
      if (behindHeadString && z <= TABLE.headString) return false;
      if (pocketAt(x, z) >= 0 || cushionContact(x, z, this._c)) return false;
      for (const b of this.balls) {
        if (b.id === 0 || b.pocketed) continue;
        if ((b.x - x) ** 2 + (b.z - z) ** 2 < (2 * BALL_R + 0.0005) ** 2) return false;
      }
      return true;
    }

    placeCue(x, z, behindHeadString = false) {
      if (!this.canPlaceCue(x, z, behindHeadString)) return false;
      const c = this.balls[0];
      c.x = x; c.z = z; c.vx = c.vz = 0; c.w.x = c.w.y = c.w.z = 0; c.pocketed = false; c.pocket = null;
      return true;
    }

    // nearest valid cue spot to (x, z), searching outward in rings
    findCueSpot(x = TABLE.cueStart.x, z = TABLE.cueStart.z, behindHeadString = false) {
      if (this.canPlaceCue(x, z, behindHeadString)) return { x, z };
      for (let r = 0.02; r < 2.6; r += 0.02) {
        const n = Math.max(8, Math.round(2 * Math.PI * r / 0.02));
        for (let k = 0; k < n; k++) {
          const a = k / n * 2 * Math.PI, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
          if (this.canPlaceCue(px, pz, behindHeadString)) return { x: px, z: pz };
        }
      }
      return null;
    }

    // angle: direction (sin a, cos a) in (x, z). power: cue speed m/s. spin.top/side in [-1, 1].
    shoot({ angle, power, spin = {} }) {
      const c = this.balls[0];
      const v = Math.max(0, Math.min(PHYS.maxShotSpeed, +power || 0));
      const top = Math.max(-1, Math.min(1, +spin.top || 0)), side = Math.max(-1, Math.min(1, +spin.side || 0));
      const dx = Math.sin(angle), dz = Math.cos(angle);
      c.vx = dx * v; c.vz = dz * v;
      // tip offset up to half a radius => spin up to 1.25 v/R
      const k = 1.25 * v / BALL_R;
      c.w.x = top * k * dz; c.w.z = -top * k * dx; c.w.y = -side * k * 0.8;
      this.shotEvents = [];
      this._acc = 0;
      this._active = true;
    }

    // advance by dt seconds of real time (fixed internal ticks); returns events for this call
    step(dt) {
      const ev = [];
      if (!this._active) { this._acc = 0; return ev; }
      this._acc += Math.min(Math.max(dt || 0, 0), 0.1);
      while (this._acc >= PHYS.tick && this._active) {
        this._acc -= PHYS.tick;
        this._tick(ev);
      }
      for (const e of ev) this.shotEvents.push(e);
      return ev;
    }

    simulateUntilRest(maxSeconds = 20) {
      const ev = [];
      const end = this.time + maxSeconds;
      while (this._active && this.time < end) this._tick(ev);
      if (this._active) {
        for (const b of this.balls) { b.vx = b.vz = 0; b.w.x = b.w.y = b.w.z = 0; }
        this._active = false;
        ev.push({ type: 'stopped' });
      }
      this._acc = 0;
      for (const e of ev) this.shotEvents.push(e);
      return ev;
    }

    _tick(ev) {
      let rem = PHYS.tick;
      while (rem > 1e-12) {
        let vmax = 0, any = false;
        for (const b of this.balls) {
          if (b.pocketed) continue;
          if (isMoving(b)) { any = true; const s = hyp(b.vx, b.vz); if (s > vmax) vmax = s; }
          else if (b.vx || b.vz || b.w.x || b.w.y || b.w.z) { b.vx = b.vz = 0; b.w.x = b.w.y = b.w.z = 0; }
        }
        if (!any) {
          if (this._active) { this._active = false; ev.push({ type: 'stopped' }); }
          return;
        }
        const n = Math.max(1, Math.ceil(rem * vmax / PHYS.maxDisp));
        const h = rem / n;
        this._substep(h, ev);
        rem -= h;
        this.time += h;
      }
    }

    _substep(h, ev) {
      const balls = this.balls, R = BALL_R;
      for (const b of balls) {
        if (b.pocketed || !isMoving(b)) continue;
        friction(b, h);
        b.x += b.vx * h; b.z += b.vz * h;
        rotate(b, h);
      }
      // ball-ball: resolve contacts that happened during this substep, earliest first
      const done = this._done || (this._done = new Uint8Array(256));
      if (this._dirty) { done.fill(0); this._dirty = false; }
      let hits = 0;
      const R2 = 4 * R * R;
      for (let iter = 0; iter < 48; iter++) {
        let bs = -1, bi = -1, bj = -1;
        for (let i = 0; i < 16; i++) {
          const a = balls[i];
          if (a.pocketed) continue;
          for (let j = i + 1; j < 16; j++) {
            const b = balls[j];
            if (b.pocketed) continue;
            const dvx = b.vx - a.vx, dvz = b.vz - a.vz;
            if (dvx === 0 && dvz === 0) continue;
            const px = b.x - a.x, pz = b.z - a.z;
            const reach = 2 * R + (Math.abs(dvx) + Math.abs(dvz)) * h + 1e-6;
            if (px > reach || px < -reach || pz > reach || pz < -reach) continue;
            const pp = px * px + pz * pz, pd = px * dvx + pz * dvz, dd = dvx * dvx + dvz * dvz;
            const c = pp - R2;
            if (done[i * 16 + j]) { if (!(c < -1e-8 && pd < 0)) continue; }
            const disc = pd * pd - dd * c;
            if (disc <= 0) continue;
            let s = (pd + Math.sqrt(disc)) / dd;      // time back to first touch
            if (s < 0) continue;                      // contact lies in the future
            if (s > h) { if (c < 0 && pd < 0) s = 0; else continue; }
            if (s > bs) { bs = s; bi = i; bj = j; }
          }
        }
        if (bi < 0) break;
        hits++; this._dirty = true;
        const a = balls[bi], b = balls[bj];
        a.x -= a.vx * bs; a.z -= a.vz * bs; b.x -= b.vx * bs; b.z -= b.vz * bs;
        const cl = this._cluster(bi, bj, bs);
        if (cl) {
          this._softCollide(cl, bs, ev);
          for (const i of cl) for (const j of cl) if (i < j) done[i * 16 + j] = 1;
          continue;
        }
        const sp = collide(a, b);
        a.x += a.vx * bs; a.z += a.vz * bs; b.x += b.vx * bs; b.z += b.vz * bs;
        done[bi * 16 + bj] = 1;
        if (sp > 0) ev.push({ type: 'ball', a: a.id, b: b.id, speed: sp });
      }
      // positional safety: separate any residual overlap
      if (hits) for (let i = 0; i < 16; i++) {
        const a = balls[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < 16; j++) {
          const b = balls[j];
          if (b.pocketed) continue;
          const px = b.x - a.x, pz = b.z - a.z, pp = px * px + pz * pz;
          if (pp < R2 - 1e-9 && pp > 1e-14) {
            const d = Math.sqrt(pp), push = (2 * R - d) / 2 + 1e-7;
            a.x -= px / d * push; a.z -= pz / d * push; b.x += px / d * push; b.z += pz / d * push;
          }
        }
      }
      this._cushionsAndPockets(h, ev);
    }

    // Balls (a, b already rewound to contact) touching or nearly touching others: returns the
    // cluster (array of indices, others rewound by s too) or null when the contact is isolated.
    _cluster(ia, ib, s) {
      const balls = this.balls, lim = (2 * BALL_R + 0.002) ** 2;
      const px = this._px || (this._px = new Float64Array(16)), pz = this._pz || (this._pz = new Float64Array(16));
      for (let k = 0; k < 16; k++) {
        const b = balls[k];
        if (k === ia || k === ib) { px[k] = b.x; pz[k] = b.z; } else { px[k] = b.x - b.vx * s; pz[k] = b.z - b.vz * s; }
      }
      let near = false;
      for (let k = 0; k < 16 && !near; k++) {
        if (k === ia || k === ib || balls[k].pocketed) continue;
        near = (px[k] - px[ia]) ** 2 + (pz[k] - pz[ia]) ** 2 < lim || (px[k] - px[ib]) ** 2 + (pz[k] - pz[ib]) ** 2 < lim;
      }
      if (!near) return null;
      const list = [ia, ib], inSet = new Uint8Array(16);
      inSet[ia] = inSet[ib] = 1;
      for (let q = 0; q < list.length; q++) {
        const i = list[q];
        for (let k = 0; k < 16; k++) {
          if (inSet[k] || balls[k].pocketed) continue;
          if ((px[k] - px[i]) ** 2 + (pz[k] - pz[i]) ** 2 < lim) { inSet[k] = 1; list.push(k); }
        }
      }
      for (let q = 2; q < list.length; q++) { const k = balls[list[q]]; k.x = px[list[q]]; k.z = pz[list[q]]; }
      return list;
    }

    // Short stiff spring-damper simulation of a contact cluster (racked balls, frozen balls):
    // spreads impulses the way near-simultaneous real collisions do. Advances the cluster by s.
    _softCollide(list, s, ev) {
      const balls = this.balls, n = list.length, R2 = 2 * BALL_R;
      const omega = Math.PI / PHYS.contactTime, lnE = Math.log(PHYS.clusterE);
      const zeta = -lnE / Math.sqrt(Math.PI * Math.PI + lnE * lnE);
      const km = omega * omega / 2, cm = zeta * omega;
      const dt = PHYS.contactTime / 40;
      const x = new Float64Array(n), z = new Float64Array(n), vx = new Float64Array(n), vz = new Float64Array(n);
      for (let i = 0; i < n; i++) { const b = balls[list[i]]; x[i] = b.x; z[i] = b.z; vx[i] = b.vx; vz[i] = b.vz; }
      const touching = new Uint8Array(n * n);
      let t = 0;
      for (let step = 0; step < 1200; step++) {
        let active = false;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const px = x[j] - x[i], pz = z[j] - z[i], d2 = px * px + pz * pz;
          if (d2 >= (R2 + 0.0005) ** 2) { touching[i * n + j] = 0; continue; }
          const d = Math.sqrt(d2), nx = px / d, nz = pz / d;
          const vr = (vx[j] - vx[i]) * nx + (vz[j] - vz[i]) * nz;
          const pen = R2 - d;
          if (pen <= 0) { touching[i * n + j] = 0; if (vr < 0 && -pen < -vr * dt * 8) active = true; continue; }
          active = true;
          if (!touching[i * n + j]) {
            touching[i * n + j] = 1;
            if (vr < 0) ev.push({ type: 'ball', a: balls[list[i]].id, b: balls[list[j]].id, speed: -vr });
          }
          let f = km * pen - cm * vr;
          if (f < 0) f = 0;
          const ix = f * nx * dt, iz = f * nz * dt;
          vx[i] -= ix; vz[i] -= iz; vx[j] += ix; vz[j] += iz;
        }
        for (let i = 0; i < n; i++) { x[i] += vx[i] * dt; z[i] += vz[i] * dt; }
        t += dt;
        if (!active) break;
      }
      const rest = Math.max(0, s - t);
      for (let i = 0; i < n; i++) {
        const b = balls[list[i]];
        b.vx = vx[i]; b.vz = vz[i];
        b.x = x[i] + vx[i] * rest; b.z = z[i] + vz[i] * rest;
      }
    }

    _cushionsAndPockets(h, ev) {
      const balls = this.balls;
      const C = this._c;
      for (const b of balls) {
        if (b.pocketed) continue;
        for (let it = 0; it < 4 && cushionContact(b.x, b.z, C); it++) {
          const vn = b.vx * C.nx + b.vz * C.nz;
          if (vn < 0 && it < 3) {
            const s = Math.min(C.pen / -vn, h);
            b.x -= b.vx * s; b.z -= b.vz * s;
            cushionBounce(b, C.nx, C.nz, vn);
            b.x += b.vx * s; b.z += b.vz * s;
            ev.push(C.seg.jaw ? { type: 'cushion', id: b.id, speed: -vn, jaw: true, pocket: C.seg.pocket } : { type: 'cushion', id: b.id, speed: -vn });
          } else {
            b.x += C.nx * (C.pen + 1e-7); b.z += C.nz * (C.pen + 1e-7);
          }
        }
        if (b.vx || b.vz) {
          const p = pocketAt(b.x, b.z);
          if (p >= 0) {
            b.pocketed = true; b.pocket = p; b.vx = b.vz = 0; b.w.x = b.w.y = b.w.z = 0;
            ev.push({ type: 'pocket', id: b.id, pocket: p });
          }
        }
      }
    }
  }

  function isMoving(b) {
    if (b.vx !== 0 || b.vz !== 0) return true;
    return Math.abs(b.w.x) * BALL_R > PHYS.slipEps || Math.abs(b.w.z) * BALL_R > PHYS.slipEps;
  }

  function friction(b, h) {
    const R = BALL_R, w = b.w;
    const ux = b.vx + R * w.z, uz = b.vz - R * w.x;
    const us = hyp(ux, uz);
    let rest = h;
    if (us > PHYS.slipEps) {
      const a = PHYS.muSlide * GRAV;
      const tRoll = us / (3.5 * a);
      const t = tRoll < h ? tRoll : h;
      const fx = ux / us, fz = uz / us;
      b.vx -= fx * a * t; b.vz -= fz * a * t;
      w.x += 2.5 * a * fz * t / R;
      w.z -= 2.5 * a * fx * t / R;
      rest = h - t;
      if (tRoll >= h) rest = 0;
    }
    if (rest > 0) {
      const s = hyp(b.vx, b.vz), dv = PHYS.rollDecel * rest;
      if (s <= dv) { b.vx = b.vz = 0; }
      else { const k = (s - dv) / s; b.vx *= k; b.vz *= k; }
      w.x = b.vz / R; w.z = -b.vx / R;
    }
    if (w.y) { const d = PHYS.spinDecel * h; w.y = Math.abs(w.y) <= d ? 0 : w.y - Math.sign(w.y) * d; }
    if (b.vx === 0 && b.vz === 0 && Math.abs(w.x) * R <= PHYS.slipEps && Math.abs(w.z) * R <= PHYS.slipEps) {
      w.x = w.y = w.z = 0;
    }
  }

  function rotate(b, h) {
    const w = b.w, wl = Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
    if (wl < 1e-9) return;
    const half = wl * h / 2, s = Math.sin(half) / wl;
    const ax = w.x * s, ay = w.y * s, az = w.z * s, aw = Math.cos(half);
    const q = b.q, bx = q[0], by = q[1], bz = q[2], bw = q[3];
    let x = aw * bx + ax * bw + ay * bz - az * by;
    let y = aw * by - ax * bz + ay * bw + az * bx;
    let z = aw * bz + ax * by - ay * bx + az * bw;
    let ww = aw * bw - ax * bx - ay * by - az * bz;
    const l = 1 / Math.sqrt(x * x + y * y + z * z + ww * ww);
    q[0] = x * l; q[1] = y * l; q[2] = z * l; q[3] = ww * l;
  }

  // equal-mass, frictionless contact; returns approach speed (0 if separating)
  function collide(a, b) {
    let nx = b.x - a.x, nz = b.z - a.z;
    const d = hyp(nx, nz) || 1e-9;
    nx /= d; nz /= d;
    const vrel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (vrel >= 0) return 0;
    const j = (1 + PHYS.ballE) / 2 * vrel;
    a.vx += j * nx; a.vz += j * nz;
    b.vx -= j * nx; b.vz -= j * nz;
    return -vrel;
  }

  function cushionBounce(b, nx, nz, vn) {
    const R = BALL_R, e = PHYS.cushionE, w = b.w;
    b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz;
    // tangential friction at the contact (couples with side spin)
    const tx = -nz, tz = nx;
    const s = b.vx * tx + b.vz * tz + R * w.y;
    const J = Math.min(PHYS.cushionMu * (1 + e) * -vn, Math.abs(s) / 3.5);
    const sg = s > 0 ? 1 : -1;
    b.vx -= sg * J * tx; b.vz -= sg * J * tz;
    w.y -= sg * 2.5 * J / R;
    // cushion nose sits above centre: kills roll spin into the rail
    const comp = w.x * nz - w.z * nx;
    w.x -= comp * nz; w.z += comp * nx;
  }

  // ------------------------------------------------------------------
  //  RULES
  // ------------------------------------------------------------------
  function targetsFor(sim, group) {
    const ids = [];
    for (const b of sim.balls) {
      if (b.pocketed || b.id === 0 || b.id === 8) continue;
      if (group === null || groupOf(b.id) === group) ids.push(b.id);
    }
    if (ids.length === 0 && !sim.balls[8].pocketed) ids.push(8);
    return ids;
  }

  const ballName = id => id === 8 ? 'the black' : id === 0 ? 'the cue ball' : `the ${id}`;

  class Match {
    constructor(sim, names = ['Player 1', 'Player 2'], opts = {}) {
      this.sim = sim;
      this.names = names;
      this.newGame(opts.breaker || 0, opts.rack === true);
    }

    newGame(breaker = 0, rack = true) {
      if (rack) this.sim.rack();
      this.turn = breaker;
      this.groups = [null, null];
      this.winner = null;
      this.isBreak = true;
      this.ballInHand = true;     // on the break the cue ball may be placed behind the head string
      this.kitchen = true;
      this.shots = 0;
      this.fouls = [0, 0];
      this.lastShot = null;
      this.lastMessage = `${this._n(breaker)} to break.`;
    }

    _n(p) { return this.names[p]; }
    _is(p) { const n = this.names[p]; return n === 'You' ? "You're" : `${n}'s`; }
    _has(p) { const n = this.names[p]; return n === 'You' ? 'You have' : `${n} has`; }
    _v(p, you, other) { return `${this.names[p]} ${this.names[p] === 'You' ? you : other}`; }
    _your(p) { const n = this.names[p]; return n === 'You' ? 'Your' : `${n}'s`; }

    legalTargets(player = this.turn) {
      if (this.isBreak) return targetsFor(this.sim, null);
      return targetsFor(this.sim, this.groups[player]);
    }

    remaining(player = this.turn) {
      const g = this.groups[player];
      let n = 0;
      for (const b of this.sim.balls) if (!b.pocketed && b.id !== 0 && b.id !== 8 && (g === null || groupOf(b.id) === g)) n++;
      return n;
    }

    beginShot() {
      this.ballInHand = false;
      this.kitchen = false;
      this._pre = this.sim.balls.filter(b => !b.pocketed).map(b => b.id);
    }

    // Pure adjudication of a finished shot (no state change). Used by endShot and by the AI on clones.
    evaluate(events, sim = this.sim, player = this.turn) {
      const potted = [];
      let first = null, firstIdx = -1, cushionAfter = false;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type === 'pocket') { if (!potted.includes(e.id)) potted.push(e.id); }
        else if (e.type === 'ball' && first === null && (e.a === 0 || e.b === 0)) { first = e.a === 0 ? e.b : e.a; firstIdx = i; }
        else if (e.type === 'cushion' && firstIdx >= 0) cushionAfter = true;
      }
      const scratch = potted.includes(0), eight = potted.includes(8);
      const obj = potted.filter(id => id !== 0 && id !== 8);
      const group = this.groups[player];
      const out = { player, potted, objPotted: obj, firstContact: first, scratch, eight, foul: null, win: false, lose: false, rerack: false, assign: null, continues: false };
      if (this.isBreak) {
        out.foul = scratch ? 'scratch' : first === null ? 'no contact' : null;
        if (eight) { out.rerack = true; return out; }
        out.continues = !out.foul && obj.length > 0;
        return out;
      }
      // what was legal before the shot
      let preRemaining = 0;
      for (const b of sim.balls) if (!b.pocketed && b.id !== 0 && b.id !== 8 && (group === null || groupOf(b.id) === group)) preRemaining++;
      for (const id of obj) if (group === null || groupOf(id) === group) preRemaining++;
      const onEight = preRemaining === 0;
      const legalFirst = id => onEight ? id === 8 : (id !== 8 && (group === null || groupOf(id) === group));
      if (scratch) out.foul = 'scratch';
      else if (first === null) out.foul = 'no contact';
      else if (!legalFirst(first)) out.foul = 'wrong ball first';
      else if (potted.length === 0 && !cushionAfter) out.foul = 'no cushion';
      if (eight) {
        if (!out.foul && onEight) out.win = true; else out.lose = true;
        return out;
      }
      if (out.foul) return out;
      let g = group;
      if (g === null && obj.length) { g = groupOf(obj[0]); out.assign = g; }
      out.continues = g === null ? obj.length > 0 : obj.some(id => groupOf(id) === g);
      return out;
    }

    endShot(events = this.sim.shotEvents) {
      if (this.winner !== null) return this.lastShot;
      const p = this.turn, o = 1 - p, r = this.evaluate(events, this.sim, p);
      this.shots++;
      if (r.foul) this.fouls[p]++;
      this.lastShot = r;
      const foulTxt = { 'scratch': 'scratch', 'no contact': 'no ball hit', 'wrong ball first': 'wrong ball first', 'no cushion': 'no cushion after contact' };
      if (r.rerack) {
        const breaker = r.foul ? o : p;
        this.sim.rack();
        this.isBreak = true; this.ballInHand = true; this.kitchen = true; this.turn = breaker;
        this.lastMessage = `Black off the break — re-rack. ${this._n(breaker)} to break.`;
        return r;
      }
      if (r.win) { this.winner = p; this.lastMessage = `${this._v(p, 'sink', 'sinks')} the black. ${this._v(p, 'win', 'wins')}!`; return r; }
      if (r.lose) {
        this.winner = o;
        const why = r.foul ? `Black down on a foul (${foulTxt[r.foul]})` : 'Black down early';
        this.lastMessage = `${why}. ${this._v(o, 'win', 'wins')}!`;
        return r;
      }
      this.isBreak = false;
      if (r.assign) { this.groups[p] = r.assign; this.groups[o] = otherGroup(r.assign); }
      if (r.foul) {
        this.turn = o; this.ballInHand = true; this.kitchen = false;
        if (r.scratch || this.sim.balls[0].pocketed) {
          const spot = this.sim.findCueSpot(TABLE.cueStart.x, TABLE.cueStart.z) || { x: 0, z: 0.85 };
          const c = this.sim.balls[0];
          c.pocketed = false; c.pocket = null; c.x = spot.x; c.z = spot.z; c.vx = c.vz = 0; c.w.x = c.w.y = c.w.z = 0;
        }
        this.lastMessage = `Foul — ${foulTxt[r.foul]}. ${this._has(o)} ball in hand.`;
        return r;
      }
      if (r.continues) {
        this.lastMessage = r.assign ? `${this._is(p)} on ${r.assign}.` : `${this._v(p, 'pot', 'pots')} ${r.objPotted.map(ballName).join(' and ')}.`;
        if (this.remaining(p) === 0 && this.groups[p]) this.lastMessage += ` ${this._is(p)} on the black.`;
        return r;
      }
      this.turn = o;
      this.lastMessage = `${this._your(o)} shot.`;
      return r;
    }
  }

  // ------------------------------------------------------------------
  //  AI
  // ------------------------------------------------------------------
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function gauss(rng) {
    let u = 0; while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }
  const aimNoise = skill => 0.0005 + 0.04 * Math.pow(1 - Math.max(0, Math.min(1, skill)), 2);

  // is the segment (x1,z1)->(x2,z2) clear of balls by `clear` (centre distance)?
  function pathClear(sim, x1, z1, x2, z2, skipA, skipB, clear = 2 * BALL_R) {
    const dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz;
    for (const b of sim.balls) {
      if (b.pocketed || b.id === skipA || b.id === skipB) continue;
      let t = L2 > 0 ? ((b.x - x1) * dx + (b.z - z1) * dz) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = b.x - (x1 + dx * t), pz = b.z - (z1 + dz * t);
      if (px * px + pz * pz < clear * clear - 1e-9) return false;
    }
    return true;
  }

  // cue speed so the object ball reaches the pocket with a little pace to spare
  function potPower(d1, d2, cosCut) {
    const ur = Math.sqrt(2 * PHYS.rollDecel * (d2 + 0.12) + 0.09);
    const u0 = ur * 7 / 5;
    const vc = u0 / (cosCut * (1 + PHYS.ballE) / 2);
    const f = 5 / 7 + (2 / 7) * Math.exp(-d1 / (0.125 * vc * vc + 0.05));
    return Math.max(0.5, Math.min(5.5, Math.sqrt(vc * vc + 2 * PHYS.rollDecel * d1) / f));
  }

  // geometric pot evaluation of ball `id` into pocket `pi` from cue at (cx, cz)
  function potGeom(sim, cx, cz, id, pi, sigma) {
    const o = sim.balls[id], pk = TABLE.pockets[pi], R = BALL_R;
    const tx = pk.aim.x, tz = pk.aim.z;
    let dx = tx - o.x, dz = tz - o.z;
    const d2 = hyp(dx, dz);
    if (d2 < 1e-6) return null;
    dx /= d2; dz /= d2;
    const entry = dx * pk.dir.x + dz * pk.dir.z;
    if (entry < pk.minCos) return null;
    const gx = o.x - dx * 2 * R, gz = o.z - dz * 2 * R;
    if (Math.abs(gx) > HALF_W - R + 0.002 || Math.abs(gz) > HALF_L - R + 0.002) return null;
    let ex = gx - cx, ez = gz - cz;
    const d1 = hyp(ex, ez);
    if (d1 < 1e-6) return null;
    ex /= d1; ez /= d1;
    const cosCut = ex * dx + ez * dz;
    if (cosCut < 0.2) return null;
    if (!pathClear(sim, cx, cz, gx, gz, 0, id)) return null;
    if (!pathClear(sim, o.x, o.z, tx, tz, 0, id)) return null;
    const half = pk.mouth.width / 2 * (pk.kind === 'corner' ? entry : entry * entry);
    const tol = Math.max(0.003, half - 0.5 * R) / (d2 + 0.03);
    const sObj = sigma * d1 / (2 * R * cosCut) + 0.004 + 0.01 * (1 - cosCut);
    const p = erf(tol / (sObj * SQ2));
    return { id, pocket: pi, angle: Math.atan2(ex, ez), d1, d2, cosCut, p, power: potPower(d1, d2, cosCut), gx, gz };
  }

  function potOptions(sim, cx, cz, targets, sigma) {
    const out = [];
    for (const id of targets) for (let pi = 0; pi < 6; pi++) { const g = potGeom(sim, cx, cz, id, pi, sigma); if (g) out.push(g); }
    out.sort((a, b) => b.p - a.p);
    return out;
  }

  // how good is the table for `group`'s shooter with the cue where it lies (0..~1.5)
  function positionValue(sim, group, sigma) {
    const c = sim.balls[0];
    if (c.pocketed) return 0;
    const opts = potOptions(sim, c.x, c.z, targetsFor(sim, group), sigma);
    if (!opts.length) return 0;
    let v = opts[0].p;
    const others = new Set(opts.filter(o => o.p > 0.5).map(o => o.id));
    v += Math.min(3, others.size) * 0.12;
    return v;
  }

  function postGroup(match, player, outcome) {
    if (outcome.assign) return outcome.assign;
    return match.isBreak ? null : match.groups[player];
  }

  const AI = {
    aimNoise,
    potOptions,

    // returns { angle, power, spin:{top, side}, place:{x,z}|null, kind, target, pocket }
    // When `place` is set, call sim.placeCue(place.x, place.z, match.kitchen) before sim.shoot(shot).
    chooseShot(sim, match, player = match.turn, skill = 0.6, opts = {}) {
      const rng = opts.rng || sim.rng || Math.random;
      const t0 = now(), budget = opts.budgetMs || 18, maxSims = opts.maxSims || 14;
      const hardStop = () => now() - t0 > budget * 1.3;
      const sigma = aimNoise(skill);
      const R = BALL_R;
      let sims = 0;
      const finish = (shot) => {
        const n = aimNoise(skill);
        shot.angle += gauss(rng) * n;
        shot.power = Math.max(0.2, Math.min(PHYS.maxShotSpeed, shot.power * (1 + gauss(rng) * 0.04 * (1 - skill))));
        shot.spin = shot.spin || { top: 0, side: 0 };
        shot.spin.top = Math.max(-1, Math.min(1, (shot.spin.top || 0) + gauss(rng) * 0.05 * (1 - skill)));
        shot.spin.side = shot.spin.side || 0;
        shot.thinkMs = now() - t0;
        shot.sims = sims;
        return shot;
      };

      // ---- break
      if (match.isBreak) {
        let place = null;
        const cue = sim.balls[0];
        let cx = cue.x, cz = cue.z;
        if (match.ballInHand) {
          const want = { x: (rng() - 0.5) * 0.25, z: 0.86 + rng() * 0.1 };
          const s = sim.findCueSpot(want.x, want.z, true);
          if (s) { place = s; cx = s.x; cz = s.z; }
        }
        // aim at the apex ball (closest ball to the foot spot)
        let apex = null, bd = Infinity;
        for (const b of sim.balls) {
          if (b.pocketed || b.id === 0) continue;
          const d = (b.x - TABLE.footSpot.x) ** 2 + (b.z - TABLE.footSpot.z) ** 2;
          if (d < bd) { bd = d; apex = b; }
        }
        const ang = apex ? Math.atan2(apex.x - cx, apex.z - cz) : Math.PI;
        return finish({ kind: 'break', angle: ang + gauss(rng) * 0.002, power: 6.0 + 0.4 * skill + rng() * 0.1, spin: { top: -0.1, side: 0 }, place, target: apex ? apex.id : null, pocket: null });
      }

      const targets = match.legalTargets(player);
      const myGroupNow = match.groups[player];

      const runTrial = (shot, place) => {
        const s = sim.clone();
        if (place) s.placeCue(place.x, place.z);
        s.shoot(shot);
        const ev = s.simulateUntilRest(20);
        sims++;
        const out = match.evaluate(ev, s, player);
        return { sim: s, ev, out };
      };
      const overBudget = () => sims >= maxSims || now() - t0 > budget;

      // ---- ball in hand: pick a placement giving an easy pot
      let place = null;
      if (match.ballInHand) {
        const cands = [];
        for (const id of targets) {
          const o = sim.balls[id];
          for (let pi = 0; pi < 6; pi++) {
            const pk = TABLE.pockets[pi];
            let dx = pk.aim.x - o.x, dz = pk.aim.z - o.z;
            const d2 = hyp(dx, dz); dx /= d2; dz /= d2;
            if (dx * pk.dir.x + dz * pk.dir.z < pk.minCos) continue;
            if (!pathClear(sim, o.x, o.z, pk.aim.x, pk.aim.z, 0, id)) continue;
            const gx = o.x - dx * 2 * R, gz = o.z - dz * 2 * R;
            for (const phi of [0.12, -0.12, 0.3, -0.3, 0]) {
              for (const L of [0.3, 0.5]) {
                const cdx = dx * Math.cos(phi) - dz * Math.sin(phi), cdz = dx * Math.sin(phi) + dz * Math.cos(phi);
                const px = gx - cdx * L, pz = gz - cdz * L;
                if (!sim.canPlaceCue(px, pz, match.kitchen)) continue;
                const g = potGeom(sim, px, pz, id, pi, sigma);
                if (g) cands.push({ g, place: { x: px, z: pz } });
              }
            }
          }
        }
        cands.sort((a, b) => b.g.p - a.g.p);
        // try the best few placements by simulation
        let best = null;
        const seen = new Set();
        for (const c of cands) {
          if (seen.has(c.g.id * 10 + c.g.pocket)) continue;
          seen.add(c.g.id * 10 + c.g.pocket);
          for (const top of [0, 0.3]) {
            const shot = { angle: c.g.angle, power: c.g.power, spin: { top, side: 0 } };
            const tr = runTrial(shot, c.place);
            const sc = scoreTrial(tr, c.g.p, match, player, sigma);
            if (!best || sc > best.sc) best = { sc, shot, place: c.place, g: c.g };
            if (overBudget()) break;
          }
          if (overBudget() || seen.size >= 4) break;
        }
        if (best && best.sc > 0.5) {
          return finish(Object.assign(best.shot, { kind: 'pot', place: best.place, target: best.g.id, pocket: best.g.pocket }));
        }
        // fall back to a decent spot near the head spot
        const s = sim.findCueSpot(0, 0.75, match.kitchen) || { x: sim.balls[0].x, z: sim.balls[0].z };
        place = s;
      }
      const cueX = place ? place.x : sim.balls[0].x, cueZ = place ? place.z : sim.balls[0].z;

      // ---- pot attempts
      const opts0 = potOptions(sim, cueX, cueZ, targets, sigma).slice(0, 5);
      let best = null;
      const variants = [{ m: 1, top: 0.2 }, { m: 1, top: -0.35 }, { m: 1.3, top: 0.4 }];
      const queue = [];
      for (let v = 0; v < variants.length; v++) for (let k = 0; k < opts0.length; k++) if (v === 0 || k < 2) queue.push([opts0[k], variants[v]]);
      for (const [g, v] of queue) {
        if (sims > 0 && overBudget()) break;
        const shot = { angle: g.angle, power: Math.min(6, g.power * v.m), spin: { top: v.top, side: 0 } };
        const tr = runTrial(shot, place);
        const sc = scoreTrial(tr, g.p, match, player, sigma);
        if (!best || sc > best.sc) best = { sc, shot, g };
      }
      // weaker players have a go at most things; strong players prefer a safety over a low-percentage pot
      if (best && best.sc > 0 && (best.g.p > 0.4 * skill * skill || best.sc > 1)) {
        return finish(Object.assign(best.shot, { kind: 'pot', place, target: best.g.id, pocket: best.g.pocket }));
      }

      // ---- safety: soft legal contact leaving the opponent little
      let safe = null;
      const cue = { x: cueX, z: cueZ };
      const direct = targets.filter(id => pathClear(sim, cueX, cueZ, sim.balls[id].x, sim.balls[id].z, 0, id, 2 * R - 0.001));
      const tryList = [];
      for (const id of direct) {
        const o = sim.balls[id];
        const base = Math.atan2(o.x - cue.x, o.z - cue.z), d = hyp(o.x - cue.x, o.z - cue.z);
        const off = Math.asin(Math.min(1, R / Math.max(d, 2 * R)));
        for (const da of [0, off * 0.9, -off * 0.9]) tryList.push({ id, angle: base + da, power: Math.min(3, 0.9 + d * 0.9) });
      }
      // one-cushion kicks when nothing is directly visible
      if (!tryList.length) {
        for (const id of targets) {
          const o = sim.balls[id];
          const mirrors = [
            { x: 2 * (HALF_W - R) - o.x, z: o.z }, { x: -2 * (HALF_W - R) - o.x, z: o.z },
            { x: o.x, z: 2 * (HALF_L - R) - o.z }, { x: o.x, z: -2 * (HALF_L - R) - o.z },
          ];
          for (const m of mirrors) tryList.push({ id, angle: Math.atan2(m.x - cue.x, m.z - cue.z), power: Math.min(4.5, 1.6 + hyp(m.x - cue.x, m.z - cue.z) * 0.8) });
        }
      }
      for (let i = 0; i < tryList.length; i++) {
        if (safe && (overBudget() || sims > maxSims + 6)) break;
        if (hardStop() && (safe || best)) break;
        const t = tryList[i];
        const shot = { angle: t.angle, power: t.power, spin: { top: 0, side: 0 } };
        const tr = runTrial(shot, place);
        const o = tr.out;
        let sc;
        if (o.lose) sc = -100;
        else if (o.win) sc = 100;
        else if (o.foul) sc = -10;
        else if (o.continues) sc = 2 + positionValue(tr.sim, postGroup(match, player, o), sigma);
        else {
          const og = o.assign ? otherGroup(o.assign) : (myGroupNow ? match.groups[1 - player] : null);
          sc = 1 - positionValue(tr.sim, og, sigma) * 0.8;
        }
        if (!safe || sc > safe.sc) safe = { sc, shot, id: t.id };
      }
      if (best && (!safe || best.sc >= safe.sc || safe.sc < 0)) return finish(Object.assign(best.shot, { kind: 'pot', place, target: best.g.id, pocket: best.g.pocket }));
      if (safe && safe.sc > -5) return finish(Object.assign(safe.shot, { kind: 'safety', place, target: safe.id, pocket: null }));
      // last resort: straight at the nearest legal ball
      let nb = null, nd = Infinity;
      for (const id of targets) { const o = sim.balls[id], d = hyp(o.x - cueX, o.z - cueZ); if (d < nd) { nd = d; nb = o; } }
      const ang = nb ? Math.atan2(nb.x - cueX, nb.z - cueZ) : rng() * 2 * Math.PI;
      return finish({ kind: 'fallback', angle: ang, power: 2.5, spin: { top: 0, side: 0 }, place, target: nb ? nb.id : null, pocket: null });
    },
  };

  function scoreTrial(tr, p, match, player, sigma) {
    const o = tr.out;
    if (o.lose) return -100;
    if (o.win) return 50 * p;
    if (o.foul) return -10;
    if (o.continues) return p * (1.2 + 0.6 * positionValue(tr.sim, postGroup(match, player, o), sigma));
    return 0.05 * p;
  }

  return { Sim, Match, AI, TABLE, BALL_R, PHYS, groupOf, targetsFor };
})();

// ---- src/13-activities.js ----

// =====================================================================
//  ACTIVITIES: needs, shops (bottle-o, kebabs, Room 4, cabs), TAB racing,
//  scratchies, a shift behind the bar, Friday karaoke
// =====================================================================

// ---------------------------------------------------------------- needs: hunger & bladder
const Needs = {
  update(dt) {
    const s = Game.state, gm = dt * Game.timeScale * 60;
    s.hunger = Math.min(100, s.hunger + 0.11 * gm);
    s.bladder = Math.min(100, s.bladder + 0.025 * gm);
    if (s.hunger > 75) s.mood = Math.max(0, s.mood - 0.03 * gm);
    if (s.bladder > 80) { s.mood = Math.max(0, s.mood - 0.05 * gm); if (!this.warned) { this.warned = true; Game.toast('You\'re busting. The gents is out the back, past the dartboard.'); } }
    if (s.bladder < 60) this.warned = false;
    if (s.bladder >= 100 && !MG.active && !Game.uiOpen) { s.mood = Math.max(0, s.mood - 10); Game.toast('Couldn\'t hold it any longer — you sprint for the gents. Just made it.', true); this.toilet(true); }
    if (s.hunger > 85 && !this.hungry) { this.hungry = true; Game.toast('Your stomach\'s growling. A parma, chips, or a kebab over the road would sort you out.'); }
    if (s.hunger < 60) this.hungry = false;
  },
  toilet(rushed) {
    const s = Game.state;
    Game.fade(0, 1);
    setTimeout(() => {
      if (rushed) { player.level = 0; player.pos.set(-12.0, 0, -21.4); player.yaw = Math.PI; }
      s.bladder = 0; achieve('toilet'); s.mood = Math.min(100, s.mood + 4);
      SFX.noise(2.2, { freq: 2600, q: 0.8, gain: 0.05, attack: 0.3 }); SFX.noise(0.4, { delay: 2.3, freq: 600, q: 0.5, gain: 0.1 });
      Game.fade(1, 0); Game.subtitle(choice(['<i>Ahh. That\'s better.</i>', '<i>You read the graffiti twice. Kenno is, apparently, a dart god.</i>', '<i>Breaking the seal. It\'s all downhill from here.</i>']), 3);
    }, 900);
  },
  eat(food) {
    const s = Game.state, F = { parma: [55, 14, 10], roast: [60, 14, 12], chips: [25, 6, 5], kebab: [50, 10, 10], hsp: [65, 16, 12], pizza: [20, 4, 4], can: [0, 0, 2] }[food] || [20, 5, 5];
    s.hunger = Math.max(0, s.hunger - F[0]); s.drunk = Math.max(0, s.drunk - F[1]); s.mood = Math.min(100, s.mood + F[2]);
    SFX.eat();
  },
};

// ---------------------------------------------------------------- shops & places
const Shops = {
  staff: [],
  spawnStaff() {
    this.staff = [];
    const mk = (name, look, pos, ry, open) => { const n = mkNPC(Object.assign({ name, role: 'staff', smoker: false, gambler: false }, look)); n.pos.copy(pos); n.ry = ry; MG.lockNPC(n, pos, ry, 'stand'); n.eventTalk = open; this.staff.push(n); return n; };
    mk('Raj', { shirt: { tile: 'collar', c: 0xc7352b }, pants: { tile: 'cloth', c: 0x222222 }, skinI: 3 }, V3(13.6, 0, -0.6), Math.PI / 2, () => this.bottleO());
    mk('Tony', { shirt: { tile: 'cloth', c: 0xf2f2ee }, pants: { tile: 'cloth', c: 0x333333 }, skinI: 2, style: 'short', beard: 'full' }, V3(10.4, 0, 27.3), Math.PI, () => this.kebab());
  },
  bottleO() {
    const s = Game.state;
    const buy = (price, fn) => () => { if (!Game.spend(price)) return; s.night.extra -= price; SFX.register(V3(14.3, 1.2, -1.2)); fn(); };
    Game.openPanel('ROYAL CELLARS', '<b>Raj:</b> "G\'day boss. What can I get ya?"', Game.optList([
      { label: 'Lucky 7s scratchie', d: 'Match three to win up to $1,000', price: '$2.00', disabled: s.wallet < 2, fn: buy(2, () => Scratchie.start(2)) },
      { label: 'Cash Splash scratchie', d: 'Match three to win up to $5,000', price: '$5.00', disabled: s.wallet < 5, fn: buy(5, () => Scratchie.start(5)) },
      { label: 'Golden Ticket scratchie', d: 'Match three to win up to $25,000', price: '$10.00', disabled: s.wallet < 10, fn: buy(10, () => Scratchie.start(10)) },
      { label: 'Six-pack to take home', d: 'For the couch tomorrow arvo (+mood tomorrow)', price: '$24.00', disabled: s.wallet < 24 || s.next.sixpack, fn: buy(24, () => { s.flags.sixpack = true; Game.closePanel(); Game.toast('Six-pack of Golden for tomorrow. Responsible.'); }) },
      { label: 'Pack of smokes (20)', d: `Cheaper than the bar. You have ${s.cigs}.`, price: '$42.00', disabled: s.wallet < 42, fn: buy(42, () => { s.cigs += 20; s.night.extra += 42; s.night.spentSmokes += 42; s.stats.spentSmokes += 42; Game.closePanel(); Game.toast('20 smokes.'); }) },
      { label: 'Nah, all good', fn: () => Game.closePanel() }]));
  },
  kebab() {
    const s = Game.state;
    const food = (name, price, kind, line) => ({ label: name, price: fmt$(price), disabled: s.wallet < price, fn: () => { if (!Game.spend(price, 'spentFood')) return; Game.closePanel(); SFX.register(V3(10.4, 1.2, 26.7)); Game.subtitle('<b>Tony:</b> ' + choice(['Garlic and chilli? Of course garlic and chilli.', 'Coming up, boss.', 'Best kebab in the state. Every night.']), 3); setTimeout(() => { if (kind === 'can') { Needs.eat(kind); Game.toast(line); } else { const mdl = makeFood(kind); if (!Eat.begin(kind, mdl, { place: () => {} })) { Needs.eat(kind); Game.toast(line); } else if (s.time >= 23) achieve('kebab'); } }, 1800); } });
    Game.openPanel('KEBAB PALACE', `<b>Tony:</b> "What'll it be, my friend?" · Wallet ${fmt$(s.wallet)}`, Game.optList([
      food('Doner kebab — lamb, garlic, chilli', 14, 'kebab', 'Absolutely demolished that kebab. Garlic sauce on your chin. Worth it.'),
      food('HSP — halal snack pack', 18, 'hsp', 'The holy trinity: chips, meat, sauce. You feel almost sober.'),
      food('Hot chips', 6, 'chips', 'Chicken salt. Always chicken salt.'),
      food('Slice of pizza', 5, 'pizza', 'Cold-ish pizza. Somehow perfect.'),
      food('Dim sims (3)', 5, 'dimsim', 'Soy sauce, steamed.'),
      food('Potato scallop', 2, 'scallop', 'Crispy and fluffy.'),
      food('Can of soft drink', 3.5, 'can', 'Ice cold. Bliss.'),
      { label: 'Just looking', fn: () => Game.closePanel() }]));
  },
  room() {
    const s = Game.state;
    if (s.tonight.room) { this.goStairs(1); return; }
    Game.openPanel('ROOM 4', 'Single iron bed, a telly from 1994 and a balcony over the street. $45 the night — sleep here instead of going home.', Game.optList([
      { label: 'Take the room', price: '$45.00', disabled: s.wallet < 45, fn: () => { if (!Game.spend(45)) return; s.night.extra -= 45; s.tonight.room = true; Game.closePanel(); this.goStairs(1); } },
      { label: 'Not tonight', fn: () => Game.closePanel() }]));
  },
  goStairs(lv) {
    Game.fade(0, 1); SFX.step('timber', player.pos.clone());
    setTimeout(() => {
      player.level = lv;
      if (lv === 1) { player.pos.set(7.0, 0, -1.3); player.yaw = Math.PI; } else { player.pos.set(12.0, 0, 1.1); player.yaw = 0; }
      player.groundY = lv ? UP.y : 0; player.vel.set(0, 0, 0); player.pitch = 0;
      Game.fade(1, 0);
      if (lv === 1) Game.subtitle('<i>Room 4. The carpet\'s seen things. The balcony\'s through the French doors.</i>', 4);
    }, 650);
  },
  fare() { return Game.state.time >= 24 ? 38 : 28; },
  callTaxi() {
    const s = Game.state, f = this.fare(), u = Traffic.taxi.userData;
    if (s.wallet >= f) { s.wallet -= f; s.night.extra -= f; }
    else if (s.bank >= f) { s.bank -= f; s.night.extra -= f; Game.toast('Paid the fare on card.'); }
    else { Game.toast('Can\'t afford a cab. It\'s shanks\'s pony tonight.'); return; }
    u.state = 'arriving'; u.x = 75; u.stopX = -11.5; Traffic.taxi.visible = true; Traffic.taxi.position.set(75, -0.15, 11.4);
    Game.subtitle('<b>Dispatch:</b> Cab\'s on its way, love. Two minutes.', 3);
  },
};

// ---------------------------------------------------------------- TAB: horse racing on every telly
const HORSES = ['Southern Belle', 'Larrikin Lad', 'Red Dust', 'Bush Telegraph', "Mate's Rates", 'Last Drinks', 'Blue Heeler', 'Stubby Holder', 'Thongs at Dawn', 'Servo Pie', 'Big Wet', 'Drop Bear', 'Fair Dinkum', 'Ute Muster', 'Barbie Queen', 'Sunburnt Country', 'Two-Up Tommy', 'Chook Raffle', 'No Worries', 'Yeah Nah', 'Dunny Door', 'Esky Lid', 'Pav Night', 'Bottle-O'];
const SILKS = ['#d22', '#22d', '#dd2', '#fff', '#2a2', '#f80', '#a2a', '#222'];
const Racing = {
  venue: '', races: [], bets: [], next: 0, cur: null, caller: 0,
  setup() {
    const s = Game.state, D = DAYS[s.day];
    this.venue = ['RANDWICK', 'FLEMINGTON', 'EAGLE FARM', 'MORPHETTVILLE', 'ROSEHILL', 'CAULFIELD', 'DOOMBEN'][s.day];
    this.races = []; this.bets = []; this.cur = null;
    const n = Math.max(3, Math.floor((D.close - s.startTime - 0.4) / 0.45));
    for (let i = 0; i < Math.min(8, n); i++) {
      const names = HORSES.slice().sort(() => Math.random() - 0.5).slice(0, 8);
      const runners = names.map((nm, k) => ({ no: k + 1, name: nm, r: gaussian() }));
      const race = { no: i + 1, dist: choice([1000, 1200, 1400, 1600, 2000]), jump: s.startTime + 0.35 + i * 0.45, runners, state: 'betting', t: 0, result: null };
      if (s.day === 3 && i === Math.min(8, n) - 1) { runners[5].name = "Joan's Delight"; runners[5].r = -1.2; race.mick = true; }
      const ex = runners.map(r => Math.exp(1.4 * r.r)), sum = ex.reduce((a, b) => a + b, 0);
      runners.forEach((r, k) => { r.p = ex[k] / sum; r.div = Math.max(1.3, Math.round(0.85 / r.p * 10) / 10); r.pos = 0; r.v = 0; r.ph = Math.random() * 10; });
      this.races.push(race);
    }
  },
  upcoming() { return this.races.find(r => r.state === 'betting') || null; },
  update(dt) {
    const s = Game.state;
    for (const r of this.races) {
      if (r.state === 'betting' && s.time >= r.jump) { r.state = 'running'; r.t = 0; this.cur = r; this.caller = 0; }
      if (r.state === 'running') {
        r.t += dt; const T = 42, L = r.dist;
        for (const h of r.runners) {
          const prog = h.pos / L, kick = prog > 0.7 ? 1 : 0;
          const boost = r.mick && Game.state.flags.mickTip && h.no === 6 ? (prog > 0.65 ? 2.6 : 0) : 0;
          const target = L / T * (1 + 0.035 * h.r + 0.02 * Math.sin(r.t * 0.7 + h.ph) + kick * 0.03 * (h.r + gaussian() * 0.6) + boost * 0.05);
          h.v = damp(h.v, target, 0.8, dt); h.pos = Math.min(L, h.pos + h.v * dt);
        }
        this.commentary(r);
        if (r.runners.every(h => h.pos >= L)) { r.state = 'result'; r.t = 0; r.result = r.runners.slice().sort((a, b) => a.finT - b.finT).map(h => h.no); this.settle(r); }
        for (const h of r.runners) if (h.pos >= L && h.finT == null) h.finT = r.t + Math.random() * 0.01;
      }
      if (r.state === 'result') { r.t += dt; if (r.t > 30) r.state = 'done'; }
    }
  },
  near() { const p = camera.position; return dynamic.tvs.some(tv => tv.kind === 'racing' && tv.group.position.distanceTo(p) < 9) || p.distanceTo(V3(2.6, 1.5, -12.45)) < 7; },
  commentary(r) {
    const L = r.dist, ord = r.runners.slice().sort((a, b) => b.pos - a.pos), lead = ord[0].pos / L;
    const marks = [0.01, 0.3, 0.62, 0.86, 0.995];
    if (this.caller < marks.length && lead >= marks[this.caller]) {
      const c = this.caller++;
      const lines = [`And they're racing in race ${r.no} at ${this.venue}!`, `${ord[0].name} leads, ${ord[1].name} sits second, ${ord[2].name} handy on the rail.`, `Round the turn — ${ord[0].name} kicks clear, ${ord[1].name} chasing!`, `${ord[1].name} is FLYING down the outside! ${ord[0].name} hanging on!`, `${ord[0].name} WINS IT! ${ord[1].name} second, ${ord[2].name} third.`];
      if (this.near() && Game.mode === 'play') { Game.subtitle(`<b>Race caller:</b> ${lines[c]}`, 4); if (c >= 3) SFX.cheer(V3(-8.4, 2.5, -15.3), 1); }
    }
  },
  settle(r) {
    const s = Game.state;
    for (const b of this.bets.filter(b => b.race === r.no && !b.done)) {
      b.done = true; const h = r.runners[b.runner - 1], place = r.result.indexOf(b.runner);
      let win = 0;
      if (b.type === 'win' && place === 0) win = b.amt * h.div;
      if (b.type === 'place' && place >= 0 && place < 3) win = b.amt * Math.max(1.1, 1 + (h.div - 1) / 3.5);
      if (win > 0) { win = Math.round(win * 100) / 100; s.wallet += win; s.night.extra += win; s.mood = Math.min(100, s.mood + 12); SFX.win(3); Game.toast(`🐎 ${h.name} ${b.type === 'win' ? 'won' : 'placed'}! TAB pays ${fmt$(win)}.`, true); if (b.type === 'win' && h.div >= 11) achieve('longshot'); if (r.mick && b.runner === 6) { relUp('Old Mick', 15); Game.subtitle('<b>Old Mick:</b> That\'s my Joanie! HA! That\'s my girl!', 5); } }
      else Game.toast(`${h.name} ran ${['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', 'last'][place]}. Ticket's in the bin.`);
    }
  },
  open() {
    const s = Game.state, r = this.upcoming();
    if (!r) { Game.openPanel('TAB', 'That\'s the last race for tonight. Back tomorrow.'); return; }
    const mins = Math.max(0, Math.round((r.jump - s.time) * 60));
    const wrap = document.createElement('div');
    let sel = null, type = 'win';
    const pending = this.bets.filter(b => !b.done).map(b => `R${b.race} #${b.runner} ${b.type} ${fmt0(b.amt)}`).join(' · ');
    wrap.innerHTML = `<div style="font-size:13px;opacity:.75;margin-bottom:8px">${this.venue} · Race ${r.no} · ${r.dist}m · jumps in ${mins} min${pending ? `<br>Your tickets: ${pending}` : ''}</div>`;
    const list = document.createElement('div'); list.className = 'opts';
    r.runners.forEach(h => { const b = document.createElement('button'); b.className = 'opt'; b.innerHTML = `<span><b style="color:${SILKS[h.no - 1]};text-shadow:0 0 2px #000">■</b> ${h.no}. ${h.name}<span class="d">Win $${h.div.toFixed(2)} · Place $${Math.max(1.1, 1 + (h.div - 1) / 3.5).toFixed(2)}</span></span>`; b.onclick = () => { sel = h.no; list.querySelectorAll('.opt').forEach(o => o.style.outline = ''); b.style.outline = '2px solid var(--gold)'; SFX.click(); }; list.appendChild(b); });
    wrap.appendChild(list);
    const place = amt => () => { if (!sel) { Game.toast('Pick a runner first.'); return; } if (!Game.spend(amt)) return; s.night.extra -= amt; this.bets.push({ race: r.no, runner: sel, type, amt }); SFX.print(); Night.ev('horse'); Game.toast(`TAB ticket: R${r.no} #${sel} ${r.runners[sel - 1].name} — ${type.toUpperCase()} ${fmt0(amt)}`); Game.closePanel(); };
    Game.openPanel('TAB', 'Pick a runner, then a bet. <span style="opacity:.6">Odds are fixed when you bet. Gamble responsibly.</span>', wrap, [
      { label: 'Win / Place: WIN', fn: e => { type = type === 'win' ? 'place' : 'win'; $('pBtns').firstChild.textContent = 'Win / Place: ' + type.toUpperCase(); } },
      { label: '$5', fn: place(5) }, { label: '$10', fn: place(10) }, { label: '$20', fn: place(20) }, { label: '$50', fn: place(50) }, { label: 'Close', fn: () => Game.closePanel() }]);
  },
  // drawn onto every racing telly + the TAB screen
  drawTV(x, W, H, t) {
    const r = this.races.find(q => q.state === 'running') || this.races.find(q => q.state === 'result');
    if (r && r.state === 'running') {
      const L = r.dist, ord = r.runners.slice().sort((a, b) => b.pos - a.pos), lead = ord[0].pos;
      x.fillStyle = '#4a8a3a'; x.fillRect(0, 0, W, H); x.fillStyle = '#7fb8e8'; x.fillRect(0, 0, W, H * 0.22);
      x.fillStyle = '#c8a878'; x.fillRect(0, H * 0.38, W, H * 0.5);
      x.fillStyle = '#fff'; for (let i = 0; i < 12; i++) x.fillRect(((i * 40 - lead * 3) % 480 + 480) % 480 - 80, H * 0.36, 3, 8);
      r.runners.forEach((h, k) => {
        const hx = W * 0.62 + (h.pos - lead) * 6, hy = H * 0.45 + k * H * 0.05;
        x.fillStyle = SILKS[k]; x.fillRect(hx, hy - 4, W * 0.03, 4);
        x.fillStyle = '#3a2210'; x.fillRect(hx - 8, hy, W * 0.07, 7); const leg = Math.sin(t * 20 + k) * 3; x.fillRect(hx - 6 + leg, hy + 7, 2, 6); x.fillRect(hx + 10 - leg, hy + 7, 2, 6);
      });
      x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(0, H - 26, W, 26); x.fillStyle = '#fff'; x.font = 'bold 13px Inter, sans-serif'; x.textAlign = 'left';
      x.fillText(`R${r.no} ${this.venue} ${r.dist}m · ${ord.slice(0, 3).map(h => h.no).join('-')}  ${Math.round(lead)}m`, 8, H - 9);
      x.fillStyle = '#1a7a3a'; x.fillRect(W - 60, 6, 54, 20); x.fillStyle = '#fff'; x.fillText('LIVE', W - 48, 21);
      return;
    }
    const nx = this.upcoming();
    x.fillStyle = '#062a16'; x.fillRect(0, 0, W, H); x.fillStyle = '#0f8a3a'; x.fillRect(0, 0, W, H * 0.16);
    x.fillStyle = '#fff'; x.font = `bold ${Math.round(H * 0.1)}px Inter, sans-serif`; x.textAlign = 'left';
    if (r && r.state === 'result') { x.fillText(`R${r.no} ${this.venue} — RESULT`, 8, H * 0.12); r.result.slice(0, 4).forEach((no, i) => { const h = r.runners[no - 1]; x.fillStyle = i === 0 ? '#ffd84a' : '#fff'; x.fillText(`${['1st', '2nd', '3rd', '4th'][i]}  ${no}. ${h.name}  ${i === 0 ? '$' + h.div.toFixed(2) : ''}`, 10, H * (0.3 + i * 0.16)); }); return; }
    if (!nx) { x.fillText(`${this.venue} — RACING COMPLETE`, 8, H * 0.12); return; }
    const mins = Math.max(0, Math.round((nx.jump - Game.state.time) * 60));
    x.fillText(`R${nx.no} ${this.venue} ${nx.dist}m · ${mins}m`, 8, H * 0.12);
    x.font = `${Math.round(H * 0.075)}px Inter, sans-serif`;
    nx.runners.forEach((h, k) => { const yy = H * (0.25 + k * 0.095); x.fillStyle = SILKS[k]; x.fillRect(8, yy - H * 0.06, H * 0.06, H * 0.06); x.fillStyle = '#fff'; x.fillText(`${h.no}. ${h.name}`, 14 + H * 0.06, yy); x.textAlign = 'right'; x.fillStyle = '#ffd84a'; x.fillText('$' + h.div.toFixed(2), W - 8, yy); x.textAlign = 'left'; });
  },
  drawBoard() { if (!dynamic.tab) return; const c = dynamic.tab.c; this.drawTV(c.getContext('2d'), c.width, c.height, elapsed); dynamic.tab.tex.needsUpdate = true; },
};

// ---------------------------------------------------------------- scratchies (scratch with the mouse)
const Scratchie = {
  cursor: true,
  start(price) {
    Game.closePanel();
    const mult = price / 2, table = [[2, 0.2], [4, 0.06], [10, 0.03], [20, 0.01], [100, 0.0015], [1000, 0.0001]];
    let prize = 0, r = Math.random(); for (const [a, p] of table) { if (r < p) { prize = a * mult; break; } r -= p; }
    const amounts = [...new Set(table.map(t => t[0] * mult))];
    const grid = []; if (prize) grid.push(prize, prize, prize);
    while (grid.length < 9) { const a = choice(amounts); if (grid.filter(g => g === a).length < 2 && !(a === prize)) grid.push(a); }
    grid.sort(() => Math.random() - 0.5);
    this.g = { price, prize, grid, scratched: false, done: false, name: { 2: 'LUCKY 7s', 5: 'CASH SPLASH', 10: 'GOLDEN TICKET' }[price] };
    MG.start(this);
  },
  enter() {
    const g = this.g; document.exitPointerLock && document.exitPointerLock();
    const wrap = document.createElement('div'); wrap.id = 'scratch';
    wrap.innerHTML = `<div class="sch">${g.name}<small>MATCH 3 AMOUNTS — WIN THAT AMOUNT</small></div><div class="scg"><canvas width="330" height="330"></canvas><canvas width="330" height="330"></canvas></div><div class="scf"><button class="pbtn" id="scAll">Reveal all</button><button class="pbtn" id="scDone">Done</button></div>`;
    document.body.appendChild(wrap);
    const [under, over] = wrap.querySelectorAll('canvas');
    const u = under.getContext('2d'); u.fillStyle = '#fff8e0'; u.fillRect(0, 0, 330, 330);
    g.grid.forEach((a, i) => { const cx = (i % 3) * 110 + 55, cy = Math.floor(i / 3) * 110 + 55; u.fillStyle = a === g.prize && g.prize ? '#c7352b' : '#2a2a2a'; u.font = `bold ${a >= 1000 ? 26 : 34}px Bungee, Impact`; u.textAlign = 'center'; u.textBaseline = 'middle'; u.fillText('$' + a.toLocaleString('en-AU'), cx, cy); });
    const o = over.getContext('2d'); const gr = o.createLinearGradient(0, 0, 330, 330); gr.addColorStop(0, '#c8c8cc'); gr.addColorStop(0.5, '#efeff2'); gr.addColorStop(1, '#a8a8ae'); o.fillStyle = gr; o.fillRect(0, 0, 330, 330);
    o.fillStyle = 'rgba(120,120,130,.6)'; o.font = 'bold 18px Bungee, Impact'; for (let i = 0; i < 9; i++) o.fillText('★ SCRATCH ★', (i % 3) * 110 + 8, Math.floor(i / 3) * 110 + 60);
    let down = false, scratchT = 0;
    const scratch = e => { if (!down) return; const b = over.getBoundingClientRect(), x = (e.clientX - b.left) * 330 / b.width, y = (e.clientY - b.top) * 330 / b.height; o.globalCompositeOperation = 'destination-out'; o.beginPath(); o.arc(x, y, 17, 0, 7); o.fill(); o.globalCompositeOperation = 'source-over'; if (performance.now() - scratchT > 60) { scratchT = performance.now(); SFX.noise(0.05, { freq: rand(2500, 4500), q: 1.2, gain: 0.05 }); } g.scratched = true; };
    over.onmousedown = e => { down = true; scratch(e); }; addEventListener('mouseup', this._up = () => { down = false; this.check(o); }); over.onmousemove = scratch;
    over.addEventListener('touchstart', e => { e.preventDefault(); down = true; scratch(e.touches[0]); }, { passive: false }); over.addEventListener('touchmove', e => { e.preventDefault(); scratch(e.touches[0]); }, { passive: false }); over.addEventListener('touchend', () => { down = false; this.check(o); });
    wrap.querySelector('#scAll').onclick = () => { o.clearRect(0, 0, 330, 330); this.check(o, true); };
    wrap.querySelector('#scDone').onclick = () => { if (!g.done) { o.clearRect(0, 0, 330, 330); this.check(o, true); } MG.stop(); };
    this.el = wrap;
    MG.top(''); MG.help('Click and drag to scratch · <kbd>Q</kbd> to put it away');
  },
  check(o, force) {
    const g = this.g; if (g.done) return;
    const d = o.getImageData(0, 0, 330, 330).data; let clear = 0; for (let i = 3; i < d.length; i += 64) if (d[i] < 20) clear++;
    if (!force && clear / (d.length / 64) < 0.62) return;
    g.done = true;
    const s = Game.state;
    if (g.prize) { s.wallet += g.prize; s.night.extra += g.prize; s.mood = Math.min(100, s.mood + 10); SFX.win(g.prize >= 20 ? 4 : 2); MG.top(`<div class="mgscore"><span><b>WINNER!</b> ${fmt$(g.prize)}</span></div>`); achieve('scratchie'); }
    else { s.mood = Math.max(0, s.mood - 2); MG.top('<div class="mgscore"><span>No luck. Better luck next time.</span></div>'); }
  },
  exit() { if (this.el) this.el.remove(); removeEventListener('mouseup', this._up); this.el = null; },
  update() { MG.cam(V3(15.2, 1.6, -0.6), V3(14.4, 1.0, -0.6), 1 / 60, 3); },
  quit() { MG.stop(); },
};

// ---------------------------------------------------------------- a shift behind the bar
const TAP_BEERS = ['GOLDEN LAGER', 'SOUTHERLY BITTER', 'LARRIKIN PALE ALE', "DROVER'S DRAUGHT"];
const BarShift = {
  hideHands: true,
  offer() {
    const s = Game.state, bev = rel('Bev') >= 15 || s.flags.shiftOK, wage = bev ? 40 : 32;
    Game.openPanel('A SHIFT ON THE BAR?', `<b>${bartender.name}:</b> "We're short tonight. ${wage} bucks for a couple of hours plus whatever tips you earn. Pour 'em right — glass on an angle, straighten it up, two fingers of head."`, Game.optList([
      { label: 'Get behind the bar', d: '1/2/3 glass · aim at a tap · hold mouse to pour · mouse up/down tilts · SPACE serves', fn: () => { Game.closePanel(); this.start(wage); } },
      { label: 'Nah, I\'m here to drink', fn: () => Game.closePanel() }]));
  },
  start(wage) {
    const s = Game.state; s.tonight.shift = true;
    this.g = { wage, t: 0, T: 120, served: 0, tips: 0, orders: [], spawnT: 2, glass: null, tilt: 0.75, pouring: null, foam: 0, best: 0, lookYaw: 0, lookPitch: -0.25, slots: [-7.82, -6.77, -5.72, -4.67].map(z => ({ z, n: null })) };
    if (player.drink) { const d = player.drink; player.drink = null; d.group.parent && d.group.parent.remove(d.group); }
    BAR.shift = true; Game.fade(0, 1);
    setTimeout(() => { MG.start(this); Game.fade(1, 0); }, 700);
  },
  enter() { this.stream = this.stream || makeStream(); this.hud(); },
  exit() {
    const g = this.g; BAR.shift = false;
    if (g.glass) scene.remove(g.glass.group);
    if (this.stream) this.stream.visible = false;
    for (const o of g.orders) { if (o.n) { o.n.mg = null; o.n.leaving = true; o.n.state = 'walk'; o.n.kind = 'walk'; o.n.path = findPath(o.n.pos, NODES.S2); } if (o.tag) o.tag.remove(); }
    BAR.taps.forEach(t => t.handle.rotation.z = 0);
    player.pos.set(-7.4, 0, -6.5); player.yaw = -Math.PI / 2; player.level = 0;
    const s = Game.state, pay = g.wage + g.tips; s.wallet += pay; s.night.extra += pay;
    if (g.served >= 3) achieve('shift');
    Game.openPanel('SHIFT OVER', `Served ${g.served} · Tips ${fmt$(g.tips)} · Wage ${fmt0(g.wage)}`, `<p><b>${bartender.name}:</b> ${g.served >= 6 ? '"You\'re a natural. Come back any time."' : g.served >= 3 ? '"Not bad. You\'ll get there."' : '"Right. Maybe stick to drinking."'}</p><p>${fmt$(pay)} cash in hand.</p>`);
    SFX.register(V3(-9, 1.2, -9));
  },
  quit() { MG.stop(); },
  hud() {
    const g = this.g, left = Math.max(0, g.T - g.t);
    MG.top(`<div class="mgscore"><span>SHIFT ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}</span><span><b>SERVED</b> ${g.served}</span><span><b>TIPS</b> ${fmt$(g.tips)}</span></div>${g.msg ? `<div class="mgmsg">${g.msg}</div>` : ''}`);
    MG.help(`<kbd>1</kbd> pot <kbd>2</kbd> schooner <kbd>3</kbd> pint · look at a tap and hold <kbd>LMB</kbd> to pour · <kbd>MOUSE ↑↓</kbd> tilt the glass · <kbd>SPACE</kbd> serve · <kbd>Q</kbd> clock off`);
  },
  key(code) {
    const g = this.g, type = { Digit1: 'pot', Digit2: 'schooner', Digit3: 'pint' }[code];
    if (type && !g.pouring) { if (g.glass) scene.remove(g.glass.group); g.glass = makeGlass(type); g.glass.fill = 0; g.glass.foam = 0; g.foam = 0; g.tilt = 0.75; scene.add(g.glass.group); g.tap = null; SFX.clink(V3(-9, 1.2, -6.5)); }
    if (code === 'Space') this.serve();
  },
  aimTap() { // which handle is under the crosshair?
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    let best = null, bd = 0.07;
    for (const tp of BAR.taps) { tp.handle.updateWorldMatrix(true, false); const hp = _v1.setFromMatrixPosition(tp.handle.matrixWorld).add(V3(0, 0.1, 0)); const d = ray.ray.distanceToPoint(hp); if (d < bd) { bd = d; best = tp; } }
    return best;
  },
  down(e) { const g = this.g; if (e.button !== 0 || !g.glass) return; const tp = this.aimTap(); if (!tp) { g.msg = 'Look at a tap handle, then hold the mouse.'; this.hud(); return; } g.pouring = tp; g.tap = tp; SFX.pourStart(); },
  up() { const g = this.g; if (g.pouring) { g.pouring = null; SFX.pourStop(); } },
  serve() {
    const g = this.g; if (!g.glass || g.pouring || g.glass.fill < 0.05) return;
    const beer = g.tapIdx != null ? TAP_BEERS[g.tapIdx] : null, type = g.glass.type;
    const o = g.orders.filter(o => o.state === 'waiting').sort((a, b) => (b.beer === beer && b.type === type) - (a.beer === beer && a.type === type) || a.t0 - b.t0)[0];
    if (!o) { g.msg = 'Nobody\'s waiting for that one.'; this.hud(); return; }
    const right = o.beer === beer && o.type === type;
    const fillQ = 1 - clamp(Math.abs(g.glass.fill - 0.93) * 6, 0, 1), headQ = 1 - clamp(Math.abs(g.foam - 0.016) * 60, 0, 1);
    const q = Math.round((fillQ * 0.55 + headQ * 0.45) * 100);
    const tip = right ? Math.round((q / 100) * (1.5 + Math.random() * 2.5) * 2) / 2 : 0;
    g.served++; g.tips += tip; o.state = 'served';
    if (right && q >= 92) { achieve('pour'); }
    g.msg = right ? `${q >= 92 ? 'Perfect pour!' : q >= 70 ? 'Good pour.' : q >= 40 ? 'Bit rough.' : 'Ugly. They drink it anyway.'} (${q}%)${tip ? ` · tip ${fmt$(tip)}` : ''}` : `Wrong drink — they wanted a ${o.type} of ${o.beer.toLowerCase()}.`;
    bark(o.n, right ? (q >= 70 ? choice(['Beautiful. Cheers.', 'That\'s a proper pour.', 'Lovely, ta.']) : 'Ehh. She\'ll do.') : 'That\'s not what I ordered, mate.', true);
    // hand it over
    o.n.glass.group.visible = true; o.n.a.holdDrink = true; o.n.glass.fill = g.glass.fill;
    scene.remove(g.glass.group); g.glass = null;
    setTimeout(() => { if (o.tag) o.tag.remove(); if (o.n) { o.slot.n = null; o.n.mg = null; o.n.timer = 0; o.n.state = 'idle'; o.n.kind = 'stand'; } g.orders.splice(g.orders.indexOf(o), 1); }, 1200);
    this.hud();
  },
  spawnOrder() {
    const g = this.g, slot = g.slots.find(s => !s.n); if (!slot) return;
    const n = mkNPC({ pos: choice([V3(-6.9, 0, -2.4), V3(-4.6, 0, -4.0), V3(-5.5, 0, -8.6)]) });
    n.state = 'idle'; MG.lockNPC(n, V3(-7.72, 0, slot.z), -Math.PI / 2); n.mg.look = null;
    slot.n = n;
    const beer = choice(TAP_BEERS), type = choice(['pot', 'schooner', 'schooner', 'pint']);
    const tag = document.createElement('div'); tag.className = 'otag'; tag.innerHTML = `<b>${type.toUpperCase()}</b><br>${beer}<i></i>`; document.body.appendChild(tag);
    g.orders.push({ n, slot, beer, type, t0: g.t, pat: 38, state: 'waiting', tag });
  },
  update(dt, t) {
    const g = this.g; g.t += dt;
    // camera behind the bar, looking at the customers; the mouse looks around a little
    g.lookYaw = clamp(g.lookYaw - input.mx * 0.0022 * settings.sens, -1.0, 1.0);
    if (!g.pouring) g.lookPitch = clamp(g.lookPitch - input.my * 0.0022 * settings.sens, -0.7, 0.3);
    const eye = V3(-9.55, 1.62, -6.5), dir = V3(Math.cos(g.lookYaw) * Math.cos(g.lookPitch), Math.sin(g.lookPitch), -Math.sin(g.lookYaw) * Math.cos(g.lookPitch));
    MG.cam(eye, eye.clone().add(dir), dt, 14, 62);
    $('cross').classList.remove('hidden');
    // orders
    g.spawnT -= dt;
    if (g.spawnT <= 0 && g.t < g.T - 10) { g.spawnT = rand(7, 13); this.spawnOrder(); }
    for (const o of g.orders) {
      if (o.state !== 'waiting') continue;
      const left = 1 - (g.t - o.t0) / o.pat;
      o.n.h.root.updateWorldMatrix(true, false); MG.pin(o.tag, _v1.set(o.n.pos.x, 2.05, o.n.pos.z));
      o.tag.querySelector('i').style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) { o.state = 'gone'; g.msg = 'A customer gave up and left.'; bark(o.n, 'Forget it. I\'ll go to the Commercial.', true); setTimeout(() => { o.tag.remove(); o.slot.n = null; o.n.mg = null; o.n.leaving = true; o.n.state = 'walk'; o.n.kind = 'walk'; o.n.path = findPath(o.n.pos, NODES.S2); g.orders.splice(g.orders.indexOf(o), 1); }, 600); this.hud(); }
    }
    // the glass under the spout, tilted toward the tap
    if (g.glass) {
      const tap = g.tap || BAR.taps[6];
      g.tapIdx = BAR.taps.indexOf(tap) % 4;
      if (g.pouring) { g.tilt = clamp(g.tilt + input.my * 0.004, 0, 0.85); }
      const gp = V3(tap.spout.x + 0.02, 1.13 + 0.03 * g.tilt, tap.spout.z);
      g.glass.group.position.copy(gp); g.glass.group.rotation.set(0, 0, -g.tilt);
      if (g.pouring) {
        const D = g.glass.D, rate = 0.3 * dt;
        g.glass.fill = Math.min(1.05, g.glass.fill + rate);
        g.foam += rate * (0.004 + 0.07 * Math.pow(1 - g.tilt / 0.85, 2) * (g.glass.fill > 0.3 ? 1 : 0.5));
        g.pouring.handle.rotation.z = damp(g.pouring.handle.rotation.z, 0.7, 12, dt);
        const st = this.stream; st.visible = true; st.material.uniforms.uTime.value = t; st.material.uniforms.uCol.value.setRGB(...D.col);
        const surf = gp.y + g.glass.y0 + (g.glass.y1 - g.glass.y0) * Math.min(1, g.glass.fill), top = tap.spout.y - 0.005, len = Math.max(0.01, top - surf);
        st.position.set(tap.spout.x, top - len / 2, tap.spout.z); st.scale.set(1, len, 1);
        SFX.pourUpdate(g.glass.fill);
        if (g.glass.fill + g.foam / D.h > 1.02) { g.glass.fill = Math.min(g.glass.fill, 1.0); g.foam = Math.max(0, D.h * (1.02 - g.glass.fill)); if (Math.random() < dt * 20) dropFX.emit(V3(gp.x, gp.y + D.h, gp.z), V3(rand(-.2, .2), 0, rand(-.2, .2)), 0.008, 1.5, 0.8, [0.95, 0.9, 0.8]); g.msg = 'Overflowing! Let go!'; }
      } else { this.stream.visible = false; BAR.taps.forEach(tp => tp.handle.rotation.z = damp(tp.handle.rotation.z, 0, 10, dt)); g.foam = Math.max(0, g.foam - dt * 0.0006); }
      g.glass.foam = Math.min(g.foam, g.glass.D.h * 0.5); g.glass.fill = clamp(g.glass.fill, 0, 1); g.glass.update(dt, t);
    }
    if (Game.frameN % 10 === 0) this.hud();
    if (g.t >= g.T && !g.pouring) MG.stop();
  },
};

// ---------------------------------------------------------------- Friday karaoke
const SONG = {
  name: 'Last Drinks at the Royal', bpm: 108,
  lines: ['Knocked off at five with me pay in me hand', 'Down to the Royal to hear the old band', 'Schooner of bitter and a bowl of hot chips', 'Shazza on the mic with a song on her lips',
    'Oh oh, last drinks at the Royal', 'Oh oh, we\'re here till they call it', 'Mick on his stool and the pokies are singing', 'Bev\'s got the raffle and the bell is still ringing',
    'Oh oh, last drinks at the Royal', 'Oh oh, one more and we\'ll go'],
};
function songNotes() {
  const beat = 60 / SONG.bpm, notes = [], scale = [0, 2, 4, 7, 9, 12];
  SONG.lines.forEach((ln, li) => {
    const words = ln.split(' '), t0 = 4 * beat + li * 8 * beat, step = Math.min(0.5, 6.5 / words.length) * beat * 2;
    words.forEach((w, wi) => notes.push({ t: t0 + wi * step, w, line: li, pitch: scale[(li * 3 + wi * 2 + (wi % 3)) % scale.length], hit: null }));
  });
  return notes;
}
const Karaoke = {
  hideHands: true,
  build() {
    // mic stand + speaker + lyric screen in the lounge, by the gaming room wall
    addCylS(SB, MAT.iron, 11.2, 0.75, -3.15, 0.012, 1.5, 6); addCylS(SB, MAT.iron, 11.2, 0.01, -3.15, 0.18, 0.02, 12); SB.add(G.sph, MAT.blackPlastic, 11.2, 1.52, -3.15, 0, 0, 0, 0.025, 0.04, 0.025);
    addBoxS(SB, MAT.blackPlastic, 10.1, 0.45, -3.62, 0.45, 0.9, 0.4); addCol(10.1, -3.62, 0.5, 0.45); // PA speaker (well clear of the ATM)
    const c = mkCanvas(512, 288); this.screen = { c, tex: canvasTex(c, 1, 1) };
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.68), new THREE.MeshBasicMaterial({ map: this.screen.tex })); scr.position.set(11.2, 2.05, -3.86); scene.add(scr);
    SB.add(G.box, MAT.blackPlastic, 11.2, 2.05, -3.9, 0, 0, 0, 1.26, 0.74, 0.04);
    addInteract({ id: 'mic', pos: V3(11.2, 1.4, -3.15), r: 2.2, enabled: () => !MG.active, label: () => DAYS[Game.state.day].event === 'knockoff' && Game.state.time >= 20.5 ? (Game.state.tonight.sang ? 'Karaoke (you\'ve had your go)' : 'Get up and sing (karaoke)') : 'Karaoke — Fridays from 8:30pm', action: () => this.offer() });
    this.draw();
  },
  scores: [],
  draw(live) {
    const x = this.screen.c.getContext('2d'), W = 512, H = 288;
    x.fillStyle = '#16063a'; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#ff3a9a'); g.addColorStop(1, '#3ad8ff'); x.fillStyle = g; x.fillRect(0, 0, W, 50);
    x.fillStyle = '#fff'; x.font = '30px Bungee, Impact'; x.textAlign = 'center'; x.fillText('ROYAL KARAOKE', W / 2, 38);
    x.font = '20px Inter, sans-serif';
    if (live) { x.fillStyle = '#ffd84a'; x.fillText(live, W / 2, 150); }
    else if (!this.scores.length) { x.fillText('FRIDAYS FROM 8:30PM', W / 2, 130); x.fillText('Best singer wins a $50 bar tab', W / 2, 170); }
    else { x.fillText('TONIGHT\'S SCORES', W / 2, 90); this.scores.slice().sort((a, b) => b.s - a.s).slice(0, 5).forEach((r, i) => { x.fillStyle = i ? '#fff' : '#ffd84a'; x.fillText(`${r.name} — ${r.s}%`, W / 2, 130 + i * 30); }); }
    this.screen.tex.needsUpdate = true;
  },
  tick(dt) { // NPCs take turns on Friday night
    const s = Game.state;
    if (MG.active === this || DAYS[s.day].event !== 'knockoff' || s.time < 20.5) return;
    if (!this.started) { this.started = true; this.scores = []; this.nextT = 6; Game.subtitle('<b>MC:</b> Righto Royal, KARAOKE TIME! Sign up at the mic!', 4); }
    if (s.time > 23.6 && !this.awarded) { this.awarded = true; const best = this.scores.slice().sort((a, b) => b.s - a.s)[0]; if (best) { Game.subtitle(`<b>MC:</b> And the winner of the fifty-dollar bar tab is… ${best.name.toUpperCase()}!`, 5); SFX.cheer(V3(11.2, 1.5, -3.1), 2); if (best.name === 'You') { s.wallet += 50; s.night.extra += 50; achieve('karaoke'); } } return; }
    this.nextT -= dt;
    if (this.nextT <= 0 && !this.awarded) {
      this.nextT = rand(70, 120);
      const n = this.scores.length === 0 ? REG.here('Shazza') : choice(NPCS.filter(o => o.role === 'patron' && o.state === 'idle' && !o.mg));
      if (!n) return;
      const sc = n.regular === 'Shazza' ? randi(80, 93) : randi(38, 82);
      this.scores.push({ name: n.name, s: sc }); this.draw(`${n.name.toUpperCase()} IS SINGING`); STORY.st().fund += Math.round(sc / 3); STORY.refreshCoins();
      if (camera.position.distanceTo(V3(11.2, 1.5, -3.1)) < 14) { Game.subtitle(`<b>${n.name}:</b> ♪ ${choice(SONG.lines)} ♪`, 4); SFX.cheer(V3(11.2, 1.5, -3.1), 1); }
      n.cheerT = 3; setTimeout(() => this.draw(), 9000);
    }
  },
  offer() {
    const s = Game.state;
    if (DAYS[s.day].event !== 'knockoff' || s.time < 20.5) { Game.toast('Karaoke\'s on Friday night from 8:30.'); return; }
    if (s.tonight.sang) { Game.toast('You\'ve had your turn. The crowd remembers.'); return; }
    Game.openPanel('KARAOKE', `"${SONG.name}" — press <b>SPACE</b> (or click) on each word as it hits the line. Best score of the night wins a $50 bar tab.`, Game.optList([{ label: 'Grab the mic', fn: () => { Game.closePanel(); s.tonight.sang = true; this.begin(); } }, { label: 'Maybe after another schooner', fn: () => Game.closePanel() }]));
  },
  begin() { this.g = { t: -1.5, notes: songNotes(), beat: 60 / SONG.bpm, nextBeat: 0, score: 0, hits: 0 }; Music.level = 0; MG.start(this); },
  enter() {
    const el = document.createElement('div'); el.id = 'kara'; el.innerHTML = '<div class="klane"><div class="kline"></div></div><div class="klyr"></div>'; document.body.appendChild(el); this.el = el;
    this.noteEls = this.g.notes.map(n => { const d = document.createElement('div'); d.className = 'knote'; d.textContent = n.w; d.style.top = (70 - n.pitch * 4.5) + '%'; el.querySelector('.klane').appendChild(d); return d; });
    player.level = 0; MG.help('<kbd>SPACE</kbd> or click on each word as it crosses the line · <kbd>Q</kbd> chicken out');
  },
  exit() {
    if (this.el) this.el.remove(); this.el = null; Music.level = 0.9;
    const g = this.g; let pct = Math.round(g.score / g.notes.length * 100);
    const duet = Game.state.flags.shazDuet && Game.state.day === 4; if (duet) { pct = Math.min(100, pct + 12); Game.toast('Shazza joined in on the chorus. The roof lifts.'); }
    this.scores.push({ name: 'You', s: pct }); this.draw(); Night.ev('sang'); Night.log('🎤', `Karaoke: ${pct}%`);
    if (DAYS[Game.state.day].event === 'knockoff') STORY.addFund(pct, `The crowd chipped in $${pct} for your performance`);
    const s = Game.state; s.mood = Math.min(100, s.mood + (pct > 60 ? 15 : 5));
    Game.toast(`You scored ${pct}%. ${pct >= 85 ? 'The room is on its feet!' : pct >= 60 ? 'Solid effort. Shazza gives you a nod.' : 'The crowd was… supportive.'}`, true);
    player.pos.set(10.6, 0, -2.2); player.yaw = -2.4;
  },
  quit() { MG.stop(); },
  sing(n, good) {
    const f = 220 * Math.pow(2, n.pitch / 12) * (good ? 1 : 1.06);
    // a vowel-ish voice: saw through two formant bandpasses
    SFX.tone(f, 0.32, { type: 'sawtooth', gain: 0.05, attack: 0.03 }); SFX.noise(0.3, { freq: 800 + n.pitch * 20, q: 6, gain: 0.05, attack: 0.03 }); SFX.noise(0.3, { freq: 1200 + n.pitch * 30, q: 8, gain: 0.04, attack: 0.03 });
  },
  press() {
    const g = this.g, drunk = Game.state.drunk / 100;
    const n = g.notes.filter(n => n.hit === null).sort((a, b) => Math.abs(a.t - g.t) - Math.abs(b.t - g.t))[0];
    if (!n) return;
    const err = Math.abs(n.t - g.t), win = 0.09 + drunk * 0.04;
    if (err < win) { n.hit = 1; g.score += 1; this.sing(n, true); }
    else if (err < win * 2.2) { n.hit = 0.6; g.score += 0.6; this.sing(n, true); }
    else { SFX.tone(160, 0.15, { type: 'sawtooth', gain: 0.05 }); }
  },
  key(code) { if (code === 'Space') this.press(); },
  down(e) { if (e.button === 0) this.press(); },
  update(dt) {
    const g = this.g; g.t += dt;
    MG.cam(V3(11.2, 1.62, -3.0), V3(7.5, 1.3, -0.2), dt, 3, 64);
    // backing band: kick + chord stab on every beat
    if (g.t >= g.nextBeat * g.beat && g.t > 0) { const b = g.nextBeat++; SFX.tone(70, 0.18, { gain: 0.18, fEnd: 40 }); if (b % 2) SFX.noise(0.08, { freq: 1800, q: 0.8, gain: 0.07 }); const root = [196, 147, 165, 131][Math.floor(b / 4) % 4]; [1, 1.26, 1.5].forEach(m => SFX.tone(root * m, 0.25, { type: 'triangle', gain: 0.03 })); }
    for (const n of g.notes) if (n.hit === null && g.t - n.t > 0.25) n.hit = 0;
    const lane = 0.42; // seconds per 10% of the lane
    this.g.notes.forEach((n, i) => { const el = this.noteEls[i], x = 20 + (n.t - g.t) / lane * 10; el.style.left = x + '%'; el.style.display = x < -10 || x > 110 ? 'none' : ''; el.className = 'knote' + (n.hit === 1 ? ' hit' : n.hit === 0.6 ? ' ok' : n.hit === 0 ? ' miss' : ''); });
    const cur = g.notes.find(n => n.t > g.t - 0.3) || g.notes[g.notes.length - 1];
    this.el.querySelector('.klyr').textContent = SONG.lines[cur.line];
    const done = g.notes.filter(n => n.hit !== null);
    MG.top(`<div class="mgscore"><span>♪ ${SONG.name}</span><span><b>SCORE</b> ${Math.round(g.score / Math.max(1, done.length) * 100)}%</span></div>`);
    if (Math.random() < dt * 0.6) SFX.cheer(V3(8, 1.5, -1), 0.3);
    if (g.t > g.notes[g.notes.length - 1].t + 2) MG.stop();
  },
};

// ---- src/14-world2.js ----

// =====================================================================
//  MORE OF THE MAP: gents, beer garden, TAB corner, drive-thru bottle-o,
//  Room 4 upstairs + balcony, the kebab shop over the road, taxis & traffic
// =====================================================================
const ZONES = {}; // per-area light rigs, played through a fixed pool of lights (constant light count = no shader recompiles)
function zoneLight(zone, x, y, z, col, inten, dist) { (ZONES[zone] = ZONES[zone] || []).push({ p: V3(x, y, z), col: new THREE.Color(col), inten, dist }); }
function plane(w, d, mat, x, y, z, rx = -Math.PI / 2, ry = 0, uvs = 0) { const g = new THREE.PlaneGeometry(w, d); if (uvs) uvScale(g, w / uvs, d / uvs); const m = new THREE.Mesh(g, mat); m.rotation.set(rx, ry, 0, 'YXZ'); m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; }
function addSwingDoor(x, z, s, w, mat, h = 2.1) {
  const pivot = new THREE.Group(); pivot.position.set(x, 0, z); scene.add(pivot);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h, 0.045), mat); leaf.position.set(-s * w / 2, h / 2, 0); pivot.add(leaf);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.06), MAT.brass); plate.position.set(-s * (w - 0.12), 1.05, 0); pivot.add(plate);
  dynamic.doors.push({ pivot, s, w, ang: 0, vel: 0, lastSound: 0 });
  return pivot;
}
function mkTex(w, h, draw, srgb = true) { const c = mkCanvas(w, h); draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ---------------------------------------------------------------- the gents
let gentsMirror = null;
function texSubway(band = '#2a7a58') {
  return mkTex(256, 256, (x, W, H) => {
    x.fillStyle = '#b8b4a6'; x.fillRect(0, 0, W, H);                       // grout
    const rh = H / 8;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
      const ox = (r % 2) * W / 8, X = c * W / 4 - ox, Y = r * rh, bandRow = r === 2;
      const g = x.createLinearGradient(0, Y, 0, Y + rh); g.addColorStop(0, bandRow ? band : '#fbfaf4'); g.addColorStop(1, bandRow ? '#1e5a40' : '#e2dfd2');
      x.fillStyle = g; x.fillRect(X + 2, Y + 2, W / 4 - 4, rh - 4); if (X < 0) x.fillRect(X + W + 2, Y + 2, W / 4 - 4, rh - 4);
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X + 3, Y + 3, W / 4 - 6, 2);
    }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,100,60,${Math.random() * 0.06})`; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, rand(4, 20), 0, 7); x.fill(); }
  });
}
function texToiletFloor() {
  return mkTex(256, 256, (x, W, H) => {
    x.fillStyle = '#7a776c'; x.fillRect(0, 0, W, H);
    const n = 8, s = W / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const l = 62 + rand(-4, 5); x.fillStyle = `hsl(${40 + rand(-4, 4)},8%,${l}%)`; x.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3); }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(50,40,20,${Math.random() * 0.08})`; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, rand(6, 24), 0, 7); x.fill(); }
  });
}
function buildToilets() {
  const subway = M({ map: texSubway(), roughness: 0.22, metalness: 0.02 }), paint = M({ color: 0xe9e5d3, roughness: 0.85 }), ceilM = M({ color: 0xdcd9cb, roughness: 0.9 });
  const floorM = M({ map: texToiletFloor(), roughness: 0.32 }), ceramic = M({ color: 0xf7f7f3, roughness: 0.08 }), lam = M({ color: 0xa9b8b2, roughness: 0.5 });
  floorM.map.wrapS = floorM.map.wrapT = THREE.RepeatWrapping; subway.map.wrapS = subway.map.wrapT = THREE.RepeatWrapping;
  plane(3.6, 4.6, floorM, -11.2, 0.004, -20.3, -Math.PI / 2, 0, 0.5);
  plane(3.6, 4.6, ceilM, -11.2, 2.88, -20.3, Math.PI / 2);        // just under the roof block so the two never z-fight
  const wm = { low: [subway, MAT.brick], high: [paint, MAT.brick] };
  buildWall('z', -13, -22.6, -18.15, 2.9, wm, -1, [], 0.3, 1.5);
  buildWall('z', -9.4, -22.6, -18.15, 2.9, wm, 1, [], 0.3, 1.5);
  buildWall('x', -22.6, -13.1, -9.3, 2.9, wm, -1, [], 0.3, 1.5);
  buildWall('z', -11.0, -22.45, -18.15, 2.9, { low: [subway, subway], high: [paint, paint] }, 1, [], 0.12, 1.5);
  addBoxS(SBX, MAT.corr, -11.2, 3.0, -20.35, 3.9, 0.2, 4.8); // roof of the block, seen from the garden
  addSwingDoor(-12.45, -18.0, -1, 0.9, M({ color: 0x3a2618, roughness: 0.5 }));
  // ---- three wall-hung ceramic urinals with modesty dividers, a flush pipe each, a drain and a urinal cake
  for (const ux of [-12.5, -12.0, -11.5]) {
    addBoxS(SB, ceramic, ux, 1.0, -22.4, 0.36, 0.8, 0.06);
    SB.add(G.sph, ceramic, ux, 0.74, -22.28, 0, 0, 0, 0.2, 0.3, 0.17);                                          // the bowl
    addBoxS(SB, ceramic, ux, 0.92, -22.34, 0.28, 0.5, 0.1);                                                      // back slab it hangs from
    addBoxS(SB, M({ color: 0x2c2e32, roughness: 0.3 }), ux, 0.58, -22.2, 0.09, 0.02, 0.05);                      // drain grate
    addCylS(SB, MAT.chrome, ux, 1.78, -22.4, 0.012, 0.8, 8);                       // flush pipe from the ceiling
    addBoxS(SB, MAT.chrome, ux, 1.45, -22.38, 0.07, 0.07, 0.03);                   // flush sensor
    addCylS(SB, M({ color: 0xf0a8c0, roughness: 0.6 }), ux, 0.7, -22.22, 0.035, 0.015, 10);
    addCylS(SB, MAT.chrome, ux, 0.55, -22.24, 0.03, 0.01, 8);
  }
  for (const dx of [-12.25, -11.75]) addBoxS(SB, M({ color: 0xcfd8d4, roughness: 0.2 }), dx, 1.12, -22.25, 0.025, 0.74, 0.4);
  addColBox(-12.95, -11.15, -22.45, -22.15);
  // ---- the cubicle: laminate partitions with a gap at the floor, a door standing ajar, a proper pedestal and cistern
  const PY = 0.17 + 0.88;   // partition centre: 17cm off the floor, 1.76m tall
  addBoxS(SB, lam, -12.45, PY, -19.2, 0.8, 1.76, 0.035); addBoxS(SB, lam, -12.45, PY, -20.8, 0.8, 1.76, 0.035);
  const pivot = new THREE.Group(); pivot.position.set(-12.04, PY, -19.24); pivot.rotation.y = -0.32; scene.add(pivot);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.76, 1.5), lam); leaf.position.z = -0.75; leaf.castShadow = true; pivot.add(leaf);
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.04), M({ color: 0x1ea040, roughness: 0.4 })); latch.position.set(0.03, 0.05, -1.38); pivot.add(latch);
  addCylS(SB, MAT.chrome, -12.04, 1.9, -19.24, 0.016, 0.16, 8); addCylS(SB, MAT.chrome, -12.04, 0.3, -19.24, 0.016, 0.16, 8);   // hinges
  addCylS(SB, ceramic, -12.7, 0.19, -20.0, 0.11, 0.38, 14);                                                                    // pedestal
  SB.add(G.sph, ceramic, -12.52, 0.4, -20.0, 0, 0, 0, 0.2, 0.15, 0.27);                                                         // bowl
  SB.add(G.sph, M({ color: 0xeeeeea, roughness: 0.15 }), -12.52, 0.46, -20.0, 0, 0, 0, 0.19, 0.05, 0.25);                       // seat
  addBoxS(SB, ceramic, -12.76, 0.78, -20.0, 0.17, 0.4, 0.44); addBoxS(SB, MAT.chrome, -12.66, 0.99, -20.0, 0.04, 0.03, 0.07);   // cistern + button
  addCylS(SB, MAT.chrome, -12.42, 0.7, -19.22, 0.02, 0.12, 8, 0, 0, Math.PI / 2); addCylS(SB, MAT.white, -12.42, 0.7, -19.22, 0.055, 0.1, 12, 0, 0, Math.PI / 2);   // loo roll
  addBoxS(SB, MAT.chrome, -12.8, 1.6, -20.78, 0.05, 0.05, 0.05);                                                                // coat hook
  addColBox(-13, -12.05, -20.8, -19.2);
  // ---- basin with taps and soap, sticker-covered mirror, hand dryer, condom machine, bin, floor drain
  addBoxS(SB, ceramic, -11.3, 0.86, -19.1, 0.4, 0.16, 0.5); addBoxS(SB, M({ color: 0x9aa0a4, roughness: 0.4 }), -11.3, 0.78, -19.1, 0.3, 0.02, 0.4);
  addCylS(SB, MAT.chrome, -11.13, 1.0, -19.1, 0.012, 0.16, 8); addBoxS(SB, MAT.chrome, -11.2, 1.07, -19.1, 0.12, 0.02, 0.02);
  addBoxS(SB, M({ color: 0x5a9a5a, roughness: 0.3 }), -11.12, 1.05, -18.8, 0.06, 0.14, 0.08);                                  // soap pump
  addColBox(-11.5, -11.0, -19.4, -18.8);
  gentsMirror = new Reflector(new THREE.PlaneGeometry(0.55, 0.7), { clipBias: 0.003, textureWidth: 256, textureHeight: 320, color: 0x9a9890 });
  gentsMirror.position.set(-11.07, 1.62, -19.1); gentsMirror.rotation.y = -Math.PI / 2; scene.add(gentsMirror); window.__gentsMirror = gentsMirror;
  const mob = gentsMirror.onBeforeRender;
  gentsMirror.onBeforeRender = function (...a) { const c = camera.position; if (Game.frameN % 2 || !roomAt(c.x, c.z) || roomAt(c.x, c.z).id !== 'toilets') return; if (playerBody) playerBody.root.visible = true; mob.apply(this, a); if (playerBody) playerBody.root.visible = false; };
  const stick = mkTex(256, 320, (x, W, H) => { x.clearRect(0, 0, W, H); [['#e8c52a', 'PIES'], ['#c7352b', 'XXXX'], ['#1a3a8a', 'NRL'], ['#fff', 'LOVE YA MUM']].forEach(([c, t], i) => { x.save(); x.translate(30 + (i % 2) * 180, 30 + i * 80); x.rotate(rand(-0.4, 0.4)); x.fillStyle = c; x.fillRect(-26, -12, 70, 24); x.fillStyle = '#111'; x.font = 'bold 14px Inter'; x.fillText(t, -20, 5); x.restore(); }); });
  signPlane(stick, 0.6, 0.75, -11.06, 1.62, -19.1, -Math.PI / 2, { transparent: true });
  addBoxS(SB, M({ color: 0xb8bcc2, metalness: 0.6, roughness: 0.25 }), -11.1, 1.25, -20.0, 0.16, 0.3, 0.26);                  // hand dryer
  addBoxS(SB, M({ color: 0x8a1a1a, roughness: 0.4 }), -12.8, 1.35, -18.75, 0.1, 0.6, 0.35);                                   // condom machine
  addCylS(SB, MAT.chrome, -11.35, 0.27, -21.0, 0.15, 0.54, 14); addColBox(-11.5, -11.2, -21.15, -20.85);                       // steel bin
  addCylS(SB, M({ color: 0x25272a, roughness: 0.5 }), -12.0, 0.006, -21.2, 0.1, 0.012, 14);                                  // floor drain
  // hygiene notices
  const hy = signTex(['PLEASE WASH', 'YOUR HANDS'], { w: 256, h: 128, bg: '#2a6ab8', color: '#fff', sizes: [40, 40] }); signPlane(hy, 0.3, 0.15, -11.065, 1.55, -18.55, -Math.PI / 2);
  // high frosted window on the back wall: the only daylight in here
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.6, 0.78), toneMapped: false })); win.position.set(-11.6, 2.35, -22.44); scene.add(win); dynamic.toiletWin = win;
  addBoxS(SB, MAT.chrome, -11.6, 2.35, -22.45, 0.66, 0.41, 0.02);
  // graffiti, of course
  const graf = mkTex(512, 256, (x, W, H) => {
    x.clearRect(0, 0, W, H); const lines = [['DAZZA WOZ ERE 09', '#222', 0.1], ['KENNO IS A DART GOD', '#1a3a8a', -0.05], ['the pies will win a flag (lol)', '#7a1f14', 0.03], ['IIII IIII III', '#333', 0], ['don\'t eat the yellow snow - mgmt', '#2a5a2a', -0.08]];
    lines.forEach(([t, c, r], i) => { x.save(); x.translate(20 + (i % 2) * 60, 40 + i * 46); x.rotate(r); x.fillStyle = c; x.font = `${rand(22, 30)}px 'Permanent Marker', cursive`; x.fillText(t, 0, 0); x.restore(); });
  });
  signPlane(graf, 1.4, 0.7, -12.84, 1.75, -21.4, Math.PI / 2, { transparent: true });
  signPlane(graf, 1.2, 0.6, -11.1, 1.9, -21.6, -Math.PI / 2, { transparent: true });
  SB.add(G.box, M({ color: 0xe8f0ff, emissive: 0xcfe0ff, emissiveIntensity: 0.8, roughness: 0.4 }), -12.0, 2.84, -20.3, 0, 0, 0, 0.08, 0.04, 1.2);
  zoneLight('toilets', -12.0, 2.5, -20.4, 0xf0f6ff, 3.6, 6);
  addInteract({ id: 'urinal', pos: V3(-12.0, 1.0, -22.1), r: 1.9, label: () => 'Use the urinal', action: () => Needs.toilet() });
  addInteract({ id: 'cubicle', pos: V3(-12.3, 1.0, -20.0), r: 1.5, label: () => 'Use the cubicle', action: () => Needs.toilet() });
}

// ---------------------------------------------------------------- beer garden
function texGravel() {
  return mkTex(512, 512, (x, W, H) => {
    x.fillStyle = '#8a8070'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const l = rand(30, 78); x.fillStyle = `hsl(${rand(20, 45)},${rand(5, 20)}%,${l}%)`; x.beginPath(); x.ellipse(Math.random() * W, Math.random() * H, rand(1, 3.5), rand(1, 3), rand(0, 3), 0, 7); x.fill(); }
    for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(40,30,20,.12)'; x.beginPath(); x.arc(Math.random() * W, Math.random() * H, rand(10, 40), 0, 7); x.fill(); }
  });
}
function texGumLeaves() {
  const t = mkTex(256, 256, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {
      const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 110, px = W / 2 + Math.cos(a) * r, py = H / 2 + Math.sin(a) * r * 0.8;
      x.save(); x.translate(px, py); x.rotate(rand(1.2, 1.9) + Math.sin(a) * 0.4);
      x.fillStyle = `hsl(${rand(85, 110)},${rand(14, 30)}%,${rand(24, 44)}%)`;
      x.beginPath(); x.ellipse(0, 0, rand(2.2, 3.4), rand(9, 15), 0, 0, 7); x.fill(); x.restore();
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
function gumTree(x, z, h = 8, seed = 0) {
  const bark = M({ color: 0xd2c9b8, roughness: 0.85 }, false);
  const lean = V3(Math.sin(seed) * 0.6, 0, Math.cos(seed) * 0.4);
  const trunk = [V3(x, 0, z), V3(x + lean.x * 0.3, h * 0.35, z + lean.z * 0.3), V3(x + lean.x, h * 0.65, z + lean.z), V3(x + lean.x * 1.3, h * 0.85, z + lean.z * 1.2)];
  const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunk), 12, 0.2, 8); SBX.add(tg, bark);
  const leafM = new THREE.MeshStandardMaterial({ map: TEX.gum, alphaTest: 0.45, side: THREE.DoubleSide, color: 0xa8b8a0, roughness: 0.85 });
  const top = trunk[3];
  for (let i = 0; i < 5; i++) {
    const a = seed + i * 1.3, br = [trunk[2].clone(), trunk[2].clone().add(V3(Math.cos(a) * 1.4, 1.2 + i * 0.25, Math.sin(a) * 1.4)), top.clone().add(V3(Math.cos(a) * 2.4, 0.4 + i * 0.3, Math.sin(a) * 2.4))];
    SBX.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(br), 8, 0.07, 5), bark);
  }
  for (let i = 0; i < 14; i++) {
    const a = rand(0, 6.28), r = rand(0.3, 2.6), c = top.clone().add(V3(Math.cos(a) * r, rand(-1.2, 1.6), Math.sin(a) * r)), s = rand(1.8, 3.0);
    for (let k = 0; k < 2; k++) SBX.add(G.plane, leafM, c.x, c.y, c.z, a + k * Math.PI / 2, rand(-0.3, 0.3), 0, s, s * 0.8, 1);
  }
  addCol(x, z, 0.5, 0.5);
}
function picnicTable(i, x, z, umbrella) {
  const pine = M({ color: 0x8a6a48, map: TEX.deck, roughness: 0.85 }, false);
  addBoxS(SBX, pine, x, 0.76, z, 1.8, 0.05, 0.75, 0, 0.6);
  for (const dz of [-0.62, 0.62]) addBoxS(SBX, pine, x, 0.45, z + dz, 1.8, 0.05, 0.28, 0, 0.6);
  for (const dx of [-0.7, 0.7]) { SBX.add(G.box, pine, x + dx, 0.38, z, 0, 0.55, 0, 0.07, 0.86, 0.07); SBX.add(G.box, pine, x + dx, 0.38, z, 0, -0.55, 0, 0.07, 0.86, 0.07); SBX.add(G.box, pine, x + dx, 0.42, z, 0, 0, 0, 0.07, 0.05, 1.5); }
  SBX.add(G.plane, MAT.blob, x, 0.006, z, 0, -Math.PI / 2, 0, 2.6, 2.0, 1);
  addCol(x, z, 1.85, 1.55);
  for (const dz of [-0.62, 0.62]) for (const dx of [-0.45, 0.45]) addSpot({ kind: 'chair', pos: V3(x + dx, 0, z + dz), ry: dz > 0 ? Math.PI : 0, sitH: 0.47, area: 'garden', smoke: true, group: 'pt' + i });
  if (umbrella) {
    addCylS(SBX, MAT.creamPaint, x, 1.3, z, 0.025, 2.6, 8);
    const ut = mkTex(256, 64, (c, W, H) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#c7352b' : '#f3d27a'; c.fillRect(k * W / 8, 0, W / 8, H); } c.fillStyle = '#fff'; c.font = 'bold 16px Bebas Neue, Impact'; c.fillText('GOLDEN LAGER', 10, H - 8); });
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ map: ut, side: THREE.DoubleSide, roughness: 0.8 }));
    canopy.position.set(x, 2.45, z); canopy.castShadow = true; scene.add(canopy);
  }
}
function festoon(a, b, sag, every = 0.55) {
  const pts = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * sag, 0))); }
  SBX.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 4), MAT.iron);
  const n = Math.round(a.distanceTo(b) / every);
  for (let k = 1; k < n; k++) { const t = k / n, p = new THREE.Vector3().lerpVectors(a, b, t).add(V3(0, -Math.sin(t * Math.PI) * sag - 0.05, 0)); SBX.add(G.sph, MAT.bulb, p.x, p.y, p.z, 0, 0, 0, 0.035, 0.045, 0.035); if (k % 3 === 0) atmo.gardenHalos.push(haloSprite(p, 0.45, 0xffc890, 0.55)); }
}
function buildGarden() {
  TEX.gravel = texGravel(); TEX.gravel.wrapS = TEX.gravel.wrapT = THREE.RepeatWrapping; TEX.gum = texGumLeaves();
  atmo.gardenHalos = [];
  plane(29.2, 10.9, M({ map: TEX.gravel, roughness: 0.95 }, false), 5.1, 0.003, -23.57, -Math.PI / 2, 0, 2.2);
  // Colorbond fence (Woodland Grey, naturally)
  const cb = M({ color: 0x5c615a, map: TEX.corr, metalness: 0.45, roughness: 0.5 }, false);
  const fence = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2; SBX.add(uvBox(new THREE.BoxGeometry(len, 1.8, 0.04), len, 1.8, 0.04, 0.8), cb, (x0 + x1) / 2, 0.9, (z0 + z1) / 2, ry); addColBox(Math.min(x0, x1) - 0.05, Math.max(x0, x1) + 0.05, Math.min(z0, z1) - 0.05, Math.max(z0, z1) + 0.05); for (let k = 0; k <= len / 2.4; k++) { const t = k * 2.4 / len; SBX.add(G.box, cb, lerp(x0, x1, t), 0.92, lerp(z0, z1, t), ry, 0, 0, 0.06, 1.84, 0.06); } };
  fence(-9.4, -29, 19.6, -29); fence(19.6, -29, 19.6, -18.2); fence(-9.4, -29, -9.4, -22.75);
  // tables, umbrellas, a shade sail, a couple of gums, the barbie
  [[-6, -21.6], [-2, -21.6], [2, -21.6], [-6, -26.1], [-2, -26.1], [2, -26.1], [8.8, -21.9], [8.8, -26.3], [13.4, -24.4]].forEach(([x, z], i) => picnicTable(i, x, z, i === 1 || i === 4 || i === 6));
  const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([-8.6, 3.3, -19.4, 3.8, 3.0, -19.6, -3.2, 3.5, -28.4], 3)); sail.computeVertexNormals();
  const sm = new THREE.Mesh(sail, new THREE.MeshStandardMaterial({ color: 0xd8c8a0, side: THREE.DoubleSide, roughness: 0.9 })); sm.castShadow = true; scene.add(sm);
  for (const [px, pz, h] of [[-8.6, -19.4, 3.3], [3.8, -19.6, 3.0], [-3.2, -28.4, 3.5]]) { addCylS(SBX, MAT.iron, px, h / 2, pz, 0.05, h, 8); addCol(px, pz, 0.2, 0.2); }
  gumTree(16.8, -27.2, 8.5, 0.6); gumTree(-7.8, -27.8, 7.2, 2.4); gumTree(6.2, -28.4, 6.5, 4.1);
  addBoxS(SBX, MAT.chrome, 11.2, 0.5, -28.4, 1.3, 0.9, 0.6); addBoxS(SBX, MAT.blackPlastic, 11.2, 1.05, -28.4, 1.25, 0.2, 0.58); addCylS(SBX, M({ color: 0xc7352b, roughness: 0.4 }, false), 12.2, 0.32, -28.4, 0.15, 0.64, 12); addColBox(10.5, 12.4, -28.8, -28);
  addBoxS(SBX, M({ color: 0x2a6ab8, roughness: 0.4 }, false), -8.6, 0.25, -24.2, 0.7, 0.45, 0.45); addBoxS(SBX, MAT.white, -8.6, 0.5, -24.2, 0.72, 0.06, 0.47); addCol(-8.6, -24.2, 0.8, 0.55);
  // festoon lights
  for (const [px, pz] of [[-9.1, -18.6], [5, -18.6], [19.3, -18.6], [-9.1, -28.7], [5, -28.7], [19.3, -28.7]]) { addCylS(SBX, MAT.iron, px, 1.7, pz, 0.04, 3.4, 6); }
  festoon(V3(-9.1, 3.35, -18.6), V3(5, 3.35, -28.7), 0.5); festoon(V3(-9.1, 3.35, -28.7), V3(5, 3.35, -18.6), 0.5);
  festoon(V3(5, 3.35, -18.6), V3(19.3, 3.35, -28.7), 0.5); festoon(V3(5, 3.35, -28.7), V3(19.3, 3.35, -18.6), 0.5);
  zoneLight('garden', -2, 2.9, -23.6, 0xffc890, 16, 15); zoneLight('garden', 12, 2.9, -23.6, 0xffc890, 14, 14);
  // sign over the gate
  const gs = signTex(['BEER GARDEN'], { w: 512, h: 128, bg: ['#1f4d34', '#123222'], color: '#f0cf6a', font: 'Rye, serif', size: 70, border: '#f0cf6a', borderW: 6 });
  signPlane(gs, 1.4, 0.35, 16.3, 3.4, -17.9, 0); signPlane(gs, 1.4, 0.35, 16.3, 3.4, -18.2, Math.PI);
}

// ---------------------------------------------------------------- TAB corner
function buildTABCorner() {
  SB.add(new RoundedBoxGeometry(0.5, 1.3, 0.55, 2, 0.04), M({ color: 0x0f5a2a, roughness: 0.45 }), 2.62, 0.65, -12.45);
  const kt = signTex(['TAB', 'BET HERE'], { w: 256, h: 256, bg: ['#0f8a3a', '#085a22'], color: '#fff', sizes: [100, 40] });
  const ks = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.3), new THREE.MeshBasicMaterial({ map: kt, toneMapped: false })); ks.position.set(2.36, 1.08, -12.45); ks.rotation.y = -Math.PI / 2; scene.add(ks);
  addColBox(2.35, 2.9, -12.75, -12.15);
  const c = mkCanvas(512, 288); dynamic.tab = { c, tex: canvasTex(c, 1, 1) };
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), new THREE.MeshBasicMaterial({ map: dynamic.tab.tex })); scr.material.color.setScalar(1.25); scr.position.set(2.87, 2.25, -12.45); scr.rotation.y = -Math.PI / 2; scene.add(scr);
  SB.add(G.box, MAT.blackPlastic, 2.92, 2.25, -12.45, 0, 0, 0, 0.05, 0.68, 1.16);
  addInteract({ id: 'tab', pos: V3(2.4, 1.2, -12.45), r: 2.2, label: () => 'TAB — bet on the races', action: () => Racing.open() });
}

// ---------------------------------------------------------------- drive-thru bottle-o in the side lane
function buildBottleO() {
  plane(6.6, 9.85, MAT.concrete, 16.3, 0.004, -2.93, -Math.PI / 2, 0, 3);
  plane(6.6, 9.85, M({ color: 0x9a9e9a, map: TEX.corr, roughness: 0.6, metalness: 0.4 }), 16.3, 3.4, -2.93, Math.PI / 2, 0, 1.5);
  addBoxS(SBX, MAT.corr, 16.3, 3.5, -2.93, 6.8, 0.1, 10);
  // lightbox over the entry
  const lb = signTex(['ROYAL CELLARS', 'DRIVE-THRU BOTTLE-O'], { w: 1024, h: 200, bg: ['#c7352b', '#8a1a12'], color: ['#fff', '#ffd84a'], sizes: [86, 52], font: 'Bungee, Impact' });
  const s1 = signPlane(lb, 4.6, 0.9, 16.3, 3.05, 2.06, 0, { intensity: 1.6, toneMapped: false }); dynamic.neon.push(s1);
  addBoxS(SBX, MAT.iron, 16.3, 3.05, 1.98, 4.7, 1.0, 0.12);
  // coolroom doors along the far wall: a backlit image of the shelves behind glass
  const fridgeTex = mkTex(1024, 256, (x, W, H) => {
    x.fillStyle = '#cfe4ee'; x.fillRect(0, 0, W, H);
    const brands = ['#d9a12a', '#2a6b2f', '#b5541b', '#22477a', '#c7352b', '#f2f2ee', '#111'];
    for (let row = 0; row < 5; row++) for (let i = 0; i < 64; i++) { x.fillStyle = choice(brands); const bx = i * 16 + 2, by = 10 + row * 49; x.fillRect(bx, by, 13, 36); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(bx + 2, by + 3, 2, 30); }
    x.fillStyle = 'rgba(150,170,180,.9)'; for (let row = 0; row < 5; row++) x.fillRect(0, 47 + row * 49, W, 4);
    x.fillStyle = '#7a8a90'; for (let d = 1; d < 7; d++) x.fillRect(d * W / 7 - 3, 0, 6, H);
  });
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 2.2), new THREE.MeshBasicMaterial({ map: fridgeTex })); fr.material.color.setScalar(1.15); fr.position.set(19.45, 1.2, -3.0); fr.rotation.y = -Math.PI / 2; scene.add(fr);
  addColBox(19.2, 19.6, -6.6, 0.6);
  // carton stacks and pallets
  const cartonTex = col => mkTex(256, 128, (x, W, H) => { x.fillStyle = col; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.font = 'bold 34px Bebas Neue, Impact'; x.fillText('GOLDEN LAGER', 16, 52); x.font = '22px Inter'; x.fillText('24 × 375ml CANS', 16, 92); });
  const cartons = [M({ map: cartonTex('#c7352b'), roughness: 0.8 }, false), M({ map: cartonTex('#1a5a2a'), roughness: 0.8 }, false), M({ map: cartonTex('#22477a'), roughness: 0.8 }, false)];
  for (let st = 0; st < 3; st++) { const px = 14.6 + st * 1.6, pz = -6.8; addBoxS(SBX, MAT.darkWood, px, 0.07, pz, 1.2, 0.14, 1.0); for (let k = 0; k < 4 + st; k++) for (let j = 0; j < 2; j++) SBX.add(G.box, cartons[(k + st) % 3], px + (j - 0.5) * 0.52, 0.27 + k * 0.26, pz + rand(-0.03, 0.03), rand(-0.05, 0.05), 0, 0, 0.5, 0.25, 0.4); addCol(px, pz, 1.3, 1.1); }
  // counter with the till and the scratchie dispenser
  addBoxS(SBX, MAT.darkWood, 14.4, 0.5, -0.6, 0.8, 1.0, 2.6); addBoxS(SBX, MAT.barTop, 14.4, 1.02, -0.6, 0.9, 0.05, 2.7);
  addBoxS(SBX, MAT.blackPlastic, 14.3, 1.18, -1.2, 0.35, 0.26, 0.4);
  const scr = mkTex(256, 256, (x, W, H) => { const cols = ['#ffd84a', '#ff4a8a', '#4ad8ff', '#7dff9a', '#ff8a2a', '#c48aff']; for (let i = 0; i < 6; i++) { x.fillStyle = cols[i]; x.fillRect((i % 3) * 85, Math.floor(i / 3) * 128, 82, 124); x.fillStyle = '#111'; x.font = 'bold 18px Bungee, Impact'; x.fillText(['$2', '$5', '$10', 'LUCKY', 'CASH', 'GOLD'][i], (i % 3) * 85 + 10, Math.floor(i / 3) * 128 + 60); } });
  const sd = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false })); sd.position.set(14.86, 1.32, 0.2); sd.rotation.y = Math.PI / 2; scene.add(sd);
  addColBox(13.95, 14.9, -1.95, 0.75);
  signPlane(signTex(['NO ID', 'NO SALE'], { w: 256, h: 256, bg: '#f4f0e6', color: '#c7352b', sizes: [80, 70], border: '#c7352b', borderW: 10 }), 0.4, 0.4, 13.17, 2.0, -0.6, Math.PI / 2);
  signPlane(signTex(['CARTON $58', '6 PACK $24', 'SMOKES $42'], { w: 512, h: 384, bg: '#111', color: ['#ffd84a', '#fff', '#ff8a7a'], sizes: [80, 80, 80], font: 'Bebas Neue, Impact' }), 1.1, 0.82, 13.17, 2.35, -3.4, Math.PI / 2);
  SB.add(G.box, MAT.bulbCool, 16.3, 3.36, -2.9, 0, 0, 0, 0.08, 0.04, 2.4);
  zoneLight('street', 16.3, 3.0, -2.6, 0xe8f4ff, 10, 11);
  addInteract({ id: 'bottleo', pos: V3(14.9, 1.15, -0.6), r: 2.2, label: () => 'Bottle-O: scratchies, smokes & takeaway', action: () => Shops.bottleO() });
}

// ---------------------------------------------------------------- Room 4 upstairs + the balcony
function buildUpstairs() {
  const y = UP.y;
  colLevel = 1;
  const wall = { low: [MAT.paintCream, MAT.brick], high: [MAT.paintCream, MAT.brick] };
  buildWall('z', 5.0, -2.0, 1.85, 3.0, wall, -1, [], 0.15, 99, true, y);
  buildWall('z', 12.6, -2.0, 1.85, 3.0, wall, 1, [], 0.15, 99, true, y);
  buildWall('x', -2.0, 4.9, 12.7, 3.0, wall, -1, [], 0.15, 99, true, y);
  // balcony edges
  addColBox(-13.1, 13.1, 9.38, 9.6); addColBox(-13.3, -13.0, 2.0, 9.6); addColBox(13.0, 13.3, 2.0, 9.6);
  // furniture
  addColBox(10.6, 12.6, -1.0, 0.45); addColBox(5.0, 6.05, -2.0, -1.35); addColBox(7.7, 9.3, -2.0, -1.45); addColBox(12.0, 12.6, -1.6, -1.05);
  colLevel = 0;
  const carpet = M({ map: TEX.carpet, color: 0x8a7070, roughness: 1 });
  plane(7.6, 3.85, carpet, 8.8, y + 0.003, -0.075, -Math.PI / 2, 0, 1.2);
  plane(7.6, 3.85, M({ color: 0xe0d8c4, roughness: 0.9 }), 8.8, y + 3.0, -0.075, Math.PI / 2);
  addBoxS(SB, MAT.darkWood, 8.8, y + 2.55, -1.92, 7.6, 0.05, 0.03); // picture rail
  // iron double bed with a chenille spread
  const iron = M({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
  addBoxS(SB, MAT.white, 11.6, y + 0.48, -0.28, 1.95, 0.22, 1.4); addBoxS(SB, M({ color: 0xd9c9a8, roughness: 0.95 }), 11.45, y + 0.6, -0.28, 1.6, 0.04, 1.46);
  for (const dz of [-0.4, 0.4]) addBoxS(SB, MAT.white, 12.3, y + 0.66, -0.28 + dz, 0.38, 0.12, 0.55);
  for (const bx of [10.6, 12.55]) { for (const dz of [-0.7, 0.7]) addCylS(SB, iron, bx, y + 0.55, -0.28 + dz, 0.02, 1.1, 8); addCylS(SB, iron, bx, y + 1.05, -0.28, 0.015, 1.4, 6, 0, Math.PI / 2); addCylS(SB, iron, bx, y + 0.8, -0.28, 0.012, 1.4, 6, 0, Math.PI / 2); }
  // bedside table + lamp, wardrobe, dresser + old telly, armchair, basin
  addBoxS(SB, MAT.darkWood, 12.3, y + 0.3, -1.35, 0.45, 0.6, 0.45);
  SB.add(new THREE.ConeGeometry(0.14, 0.18, 12, 1, true), M({ color: 0xf2dca8, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x5a3a10 }), 12.3, y + 0.86, -1.35); addCylS(SB, MAT.brass, 12.3, y + 0.7, -1.35, 0.012, 0.22, 6);
  addBoxS(SB, MAT.darkWood, 5.55, y + 1.0, -1.65, 1.0, 2.0, 0.6);
  addBoxS(SB, MAT.darkWood, 8.5, y + 0.4, -1.72, 1.4, 0.8, 0.5); addBoxS(SB, MAT.blackPlastic, 8.5, y + 1.05, -1.72, 0.55, 0.45, 0.45);
  addBoxS(SB, M({ color: 0x2a3a3a, roughness: 0.2 }), 8.5, y + 1.05, -1.49, 0.42, 0.32, 0.01);
  addBoxS(SB, M({ color: 0x5a3a2a, roughness: 0.9 }), 6.6, y + 0.25, 1.05, 0.75, 0.5, 0.7); addBoxS(SB, M({ color: 0x5a3a2a, roughness: 0.9 }), 6.6, y + 0.6, 1.36, 0.75, 0.6, 0.12);
  addBoxS(SB, MAT.white, 5.25, y + 0.85, 0.6, 0.4, 0.14, 0.5);
  framed(12.57, y + 1.8, -0.3, -Math.PI / 2, 2);
  signPlane(signTex(['CHECKOUT 10AM', 'No visitors after midnight', '— Mgmt'], { w: 512, h: 256, bg: '#f4ead6', color: ['#7a1f14', '#222', '#555'], sizes: [52, 34, 30] }), 0.4, 0.2, 7.2, y + 1.5, -1.92, 0);
  // door back down to the bar
  addBoxS(SB, MAT.darkWood, 7.0, y + 1.05, -1.95, 0.9, 2.1, 0.06);
  zoneLight('upstairs', 12.1, y + 1.1, -1.3, 0xffb870, 6, 7); zoneLight('upstairs', 8.6, y + 2.7, 0, 0xffd8a8, 5, 9);
  addInteract({ id: 'bed', pos: V3(11.4, y + 0.7, -0.28), r: 2.4, enabled: () => player.level === 1, label: () => 'Get some kip (end the night)', action: () => { Game.closePanel(); achieve('upstairs'); Game.endNight('room'); } });
  addInteract({ id: 'downstairs', pos: V3(7.0, y + 1.1, -1.9), r: 2.0, enabled: () => player.level === 1, label: () => 'Head back down to the bar', action: () => Shops.goStairs(0) });
  // ground floor: the residents' door in the lounge
  addBoxS(SB, MAT.darkWood, 12.0, 1.05, 1.83, 0.9, 2.1, 0.06); SB.add(G.box, MAT.brass, 11.66, 1.0, 1.79, 0, 0, 0, 0.04, 0.12, 0.04);
  signPlane(signTex(['ACCOMMODATION', 'Residents only'], { w: 512, h: 160, bg: '#1a1a1a', color: ['#e8c56a', '#ccc'], sizes: [60, 36] }), 0.6, 0.19, 12.0, 2.3, 1.79, Math.PI);
  addInteract({ id: 'upstairs', pos: V3(12.0, 1.2, 1.7), r: 2.0, enabled: () => player.level === 0, label: () => Game.state.tonight.room ? 'Go up to Room 4' : 'Room 4 upstairs ($45 a night)', action: () => Shops.room() });
}

// ---------------------------------------------------------------- the kebab shop over the road
function buildKebab() {
  const x0 = 7.6, x1 = 12.4, zf = 24.0, zb = 27.75;
  const shell = M({ map: TEX.paintDark, color: 0x6a645a, roughness: 0.95 }, false);
  // building mass around the shop: upper floor + the back of house
  SBX.add(uvBox(new THREE.BoxGeometry(x1 - x0, 3.8, 12), x1 - x0, 3.8, 12, 2.5), shell, (x0 + x1) / 2, 5.1, zf + 6);
  SBX.add(uvBox(new THREE.BoxGeometry(x1 - x0, 3.2, 36 - zb), x1 - x0, 3.2, 36 - zb, 2.5), shell, (x0 + x1) / 2, 1.6, (zb + 36) / 2);
  addColBox(x0, x1, zb, 36);
  const white = M({ map: TEX.tileCream, color: 0xf2f2ee, roughness: 0.3 }, false);
  plane(x1 - x0, zb - zf, M({ map: TEX.tileRed, roughness: 0.4 }, false), (x0 + x1) / 2, 0.004, (zf + zb) / 2, -Math.PI / 2, 0, 0.6);
  plane(x1 - x0, zb - zf, M({ color: 0xe8e8e4, roughness: 0.8 }, false), (x0 + x1) / 2, 3.0, (zf + zb) / 2, Math.PI / 2);
  for (const sx of [x0 + 0.02, x1 - 0.02]) plane(zb - zf, 3.0, white, sx, 1.5, (zf + zb) / 2, 0, sx < 10 ? Math.PI / 2 : -Math.PI / 2, 0.6);
  plane(x1 - x0, 3.0, white, (x0 + x1) / 2, 1.5, zb - 0.02, 0, Math.PI, 0.6);
  // shopfront: glass with a doorway on the left, tiled stallriser, big lightbox
  addBoxS(SBX, M({ map: TEX.tileRed, roughness: 0.3 }, false), 10.6, 0.45, zf, 3.6, 0.9, 0.12);
  mesh(new THREE.PlaneGeometry(3.6, 2.0), MAT.window, 10.6, 1.9, zf).rotation.y = Math.PI;
  for (const fx of [7.65, 8.8, 12.35]) addBoxS(SBX, MAT.chrome, fx, 1.5, zf, 0.08, 3.0, 0.1);
  addBoxS(SBX, MAT.chrome, 10.0, 2.95, zf, 4.8, 0.1, 0.1);
  addColBox(8.8, x1, zf - 0.1, zf + 0.1);
  const sign = signTex(['KEBAB PALACE', 'OPEN LATE · HSP · PIZZA'], { w: 1024, h: 220, bg: ['#ffd84a', '#ff9a1a'], color: ['#b0140a', '#2a1a0a'], sizes: [110, 46], font: 'Bungee, Impact' });
  const sg = signPlane(sign, 4.6, 1.0, 10.0, 3.55, zf - 0.08, Math.PI, { intensity: 1.5, toneMapped: false }); dynamic.neon.push(sg);
  // counter with a glowing bain-marie, the spit, menu boards, drinks fridge
  addBoxS(SBX, MAT.chrome, 10.4, 0.5, 26.7, 3.6, 1.0, 0.6); addColBox(8.5, x1, 26.35, 27.05);
  const bm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.6) })); bm.position.set(10.6, 1.15, 26.7); scene.add(bm);
  addBoxS(SBX, MAT.window, 10.6, 1.35, 26.45, 2.5, 0.4, 0.02);
  const meat = mkTex(128, 128, (x, W, H) => { x.fillStyle = '#7a4018'; x.fillRect(0, 0, W, H); for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${rand(18, 32)},${rand(40, 70)}%,${rand(18, 42)}%)`; x.fillRect(Math.random() * W, Math.random() * H, rand(2, 8), rand(1, 3)); } });
  dynamic.doner = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.55, 16), new THREE.MeshStandardMaterial({ map: meat, roughness: 0.6, emissive: 0x3a1000, emissiveIntensity: 0.6 }));
  dynamic.doner.position.set(11.6, 1.3, 27.35); scene.add(dynamic.doner);
  addCylS(SBX, MAT.chrome, 11.6, 1.3, 27.35, 0.008, 0.9, 6);
  const heater = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.9, 0.2) })); heater.position.set(11.6, 1.3, 27.68); heater.rotation.y = Math.PI; scene.add(heater);
  const menu = mkTex(1024, 256, (x, W, H) => {
    x.fillStyle = '#111'; x.fillRect(0, 0, W, H);
    [['DONER KEBAB', '$14'], ['HSP (SNACK PACK)', '$18'], ['HOT CHIPS', '$6'], ['PIZZA SLICE', '$5'], ['CAN OF DRINK', '$3.50']].forEach(([t, p], i) => { x.fillStyle = ['#ffd84a', '#ff7a5a', '#fff', '#fff', '#8ad8ff'][i]; x.font = 'bold 34px Bebas Neue, Impact'; x.fillText(t, 30 + (i % 3) * 330, 70 + Math.floor(i / 3) * 110); x.fillStyle = '#fff'; x.fillText(p, 230 + (i % 3) * 330, 70 + Math.floor(i / 3) * 110); x.fillStyle = choice(['#c87a2a', '#a8501a', '#e8c040']); x.fillRect(30 + (i % 3) * 330, 82 + Math.floor(i / 3) * 110, 260, 10); });
  });
  const mb = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: menu, toneMapped: false })); mb.material.color.setScalar(1.3); mb.position.set(10.2, 2.45, zb - 0.04); mb.rotation.y = Math.PI; scene.add(mb);
  const fridge = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), new THREE.MeshBasicMaterial({ map: mkTex(128, 256, (x, W, H) => { x.fillStyle = '#dff'; x.fillRect(0, 0, W, H); for (let r = 0; r < 5; r++) for (let i = 0; i < 6; i++) { x.fillStyle = choice(['#c7352b', '#1a5aa8', '#e8c52a', '#2a8a3a', '#f2f2ee']); x.fillRect(6 + i * 20, 10 + r * 50, 15, 34); } }) }));
  fridge.position.set(x0 + 0.05, 1.1, 25.0); fridge.rotation.y = Math.PI / 2; scene.add(fridge);
  for (const tz of [25.3, 26.0]) SBX.add(G.box, MAT.bulbCool, 10.0, 2.97, tz, 0, 0, 0, 3.0, 0.03, 0.06);
  // a plastic table by the window
  addCylS(SBX, MAT.white, 11.5, 0.72, 24.75, 0.35, 0.03, 16); addCylS(SBX, MAT.white, 11.5, 0.36, 24.75, 0.03, 0.72, 6); addCol(11.5, 24.75, 0.6, 0.6);
  zoneLight('street', 10.0, 2.6, 25.6, 0xe8f6ff, 18, 14);
  // a little cool light spills onto the footpath
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.2), new THREE.MeshBasicMaterial({ map: spillTex(), color: new THREE.Color(0.55, 0.75, 0.8), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  spill.rotation.x = -Math.PI / 2; spill.rotation.z = Math.PI; spill.position.set(10.0, 0.015, 22.4); scene.add(spill);
  addInteract({ id: 'kebab', pos: V3(10.2, 1.2, 26.3), r: 2.4, label: () => 'Kebab Palace — order', action: () => Shops.kebab() });
}

// ---------------------------------------------------------------- taxis and the odd passing car
const Traffic = { cars: [], taxi: null };
function makeCar(col, taxi = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0e12, metalness: 0.9, roughness: 0.05 });
  const add = (geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  add(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), paint, 0, 0.6, 0, 4.5, 0.55, 1.8);
  add(new RoundedBoxGeometry(1, 1, 1, 2, 0.12), paint, -0.2, 1.08, 0, 2.4, 0.5, 1.64); add(G.box, glass, -0.2, 1.1, 0, 2.2, 0.38, 1.66);
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[1.4, 0.82], [1.4, -0.82], [-1.4, 0.82], [-1.4, -0.82]]) { const w = add(G.cyl, tyre, wx, 0.34, wz, 0.34, 0.24, 0.34); w.rotation.x = Math.PI / 2; }
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.0) }), tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.15, 0.1) });
  for (const s of [-0.62, 0.62]) { add(G.box, head, 2.26, 0.68, s, 0.03, 0.12, 0.3); add(G.box, tail, -2.26, 0.7, s, 0.03, 0.1, 0.28); }
  g.userData.halos = [-0.62, 0.62].map(s => { const h = haloSprite(V3(0, 0, 0), 1.2, 0xfff0d0, 0.8); scene.remove(h); h.position.set(2.4, 0.68, s); g.add(h); return h; });
  if (taxi) { const ts = signTex(['TAXI'], { w: 256, h: 96, bg: '#ffd84a', color: '#111', size: 70 }); const sgn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.2), new THREE.MeshBasicMaterial({ map: ts, toneMapped: false })); sgn.position.set(-0.2, 1.42, 0); g.add(sgn); add(G.box, new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 0.7, 0.905, 3.6, 0.12, 0.01); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.visible = false; scene.add(g);
  return g;
}
function buildTraffic() {
  Traffic.cars = [makeCar(0x8a8a90), makeCar(0x2a3a5a)];
  Traffic.cars.forEach(c => c.userData.active = false);
  Traffic.taxi = makeCar(0xf2f2ee, true); Traffic.taxi.userData.state = 'idle';
  // taxi rank on our footpath
  addCylS(SBX, MAT.chrome, -11.5, 1.3, 9.6, 0.04, 2.6, 8);
  const ts = signTex(['TAXI'], { w: 256, h: 128, bg: '#ffd84a', color: '#111', size: 92, border: '#111', borderW: 8 });
  signPlane(ts, 0.5, 0.25, -11.5, 2.5, 9.64, 0); signPlane(ts, 0.5, 0.25, -11.5, 2.5, 9.56, Math.PI);
  addInteract({ id: 'taxi', pos: V3(-11.5, 1.4, 9.4), r: 2.4, enabled: () => Traffic.taxi.userData.state === 'idle', label: () => `Call a cab home (${fmt0(Shops.fare())})`, action: () => Shops.callTaxi() });
  SFX.carHook = () => { const c = Traffic.cars.find(c => !c.userData.active); if (!c || Game.mode !== 'play') return; const dir = Math.random() < 0.5 ? 1 : -1; c.userData = Object.assign(c.userData, { active: true, dir, x: -dir * 70, z: dir > 0 ? 15.6 : 12.2, v: rand(12, 16) }); c.visible = true; c.rotation.y = dir > 0 ? 0 : Math.PI; };
}
function updateTraffic(dt) {
  const night = atmo.night > 0.5;
  for (const c of Traffic.cars) {
    const u = c.userData; if (!u.active) continue;
    u.x += u.dir * u.v * dt; c.position.set(u.x, -0.15, u.z);
    u.halos.forEach(h => h.visible = night);
    if (Math.abs(u.x) > 72) { u.active = false; c.visible = false; }
  }
  const t = Traffic.taxi, u = t.userData;
  u.halos.forEach(h => h.visible = night);
  if (u.state === 'arriving') {
    const dx = u.stopX - u.x, sp = Math.min(14, Math.max(1.2, Math.abs(dx) * 0.9));
    u.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt); t.position.set(u.x, -0.15, 11.4); t.rotation.y = Math.PI;
    if (Math.abs(dx) < 0.05) { u.state = 'waiting'; SFX.tone(420, 0.15, { gain: 0.06, pos: t.position, type: 'square' }); SFX.tone(420, 0.15, { delay: 0.3, gain: 0.06, pos: t.position, type: 'square' }); Game.toast('Your cab\'s here.'); u.ia = addInteract({ id: 'getin', temp: true, pos: V3(u.x, 1.0, 10.6), r: 3.0, label: () => 'Get in the cab', action: () => { interactables.splice(interactables.indexOf(u.ia), 1); u.state = 'leaving'; achieve('taxi'); if (!Cine.taxi(() => Game.endNight('taxi'))) Game.endNight('taxi'); } }); }
  } else if (u.state === 'leaving') { u.x -= 10 * dt; t.position.x = u.x; if (u.x < -75) { u.state = 'idle'; t.visible = false; } }
}

// ---------------------------------------------------------------- zone lights
const ZL = { lights: [], zone: null, k: 0 };
function buildZoneLights() { for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); ZL.lights.push(l); } }
function zoneFor(c) {
  if (player.level === 1 && Game.mode === 'play' && c.y > UP.y + 0.5) return c.z < 2.1 ? 'upstairs' : 'street';
  const r = roomAt(c.x, c.z);
  if (r) return r.id === 'toilets' ? 'toilets' : 'street';
  if (inGarden(c.x, c.z) || onTerrace(c.x, c.z)) return 'garden';
  if (!isInside(c.x, c.z)) return 'street';
  return 'pub';
}
function updateZones(dt) {
  const want = zoneFor(camera.position);
  if (want !== ZL.zone) { ZL.k = Math.max(0, ZL.k - dt * 6); if (ZL.k <= 0) { ZL.zone = want; const specs = ZONES[want] || []; ZL.lights.forEach((l, i) => { const s = specs[i]; if (s) { l.position.copy(s.p); l.color.copy(s.col); l.distance = s.dist; l.userData.inten = s.inten; } else l.userData.inten = 0; }); } }
  else ZL.k = Math.min(1, ZL.k + dt * 3);
  const night = clamp(atmo.nightF * 1.4 + 0.25, 0, 1);
  ZL.lights.forEach(l => { l.intensity = (l.userData.inten || 0) * ZL.k * (ZL.zone === 'garden' || ZL.zone === 'street' ? night : 1); });
  if (dynamic.doner) dynamic.doner.rotation.y += dt * 0.8;
  if (atmo.gardenHalos) { const v = atmo.night > 0.5; for (const h of atmo.gardenHalos) h.visible = v; }
  if (dynamic.roomGlow) dynamic.roomGlow.visible = atmo.night > 0.5 || player.level !== 1;
}

// ---------------------------------------------------------------- nav graph additions
Object.assign(NODES, { Y0: V3(16.3, 0, -19.3), Y1: V3(11.0, 0, -24.1), Y2: V3(4.6, 0, -23.9), Y3: V3(-3.8, 0, -23.9) });
for (const [a, b] of [['T3', 'Y0'], ['Y0', 'Y1'], ['Y1', 'Y2'], ['Y2', 'Y3']]) { ADJ[a] = ADJ[a] || []; ADJ[b] = ADJ[b] || []; ADJ[a].push(b); ADJ[b].push(a); }

// ---- src/15-story.js ----

// =====================================================================
//  ACHIEVEMENTS (saved in this browser across weeks)
// =====================================================================
const ACH_LIST = [
  ['firstpot', 'First of Many', 'Buy your first drink.'],
  ['bullseye', 'Bullseye', 'Hit the bull in a game of darts.'],
  ['tonup', 'Ton-Up', 'Score 100 or more in one round of darts.'],
  ['oneeighty', 'ONE-HUNDRED-AND-EIGHTY', 'Three treble twenties.'],
  ['darts', 'Good Arrows', 'Win a game of darts.'],
  ['pool', 'Pot Luck', 'Win a game of pool.'],
  ['shark', 'Pool Shark', 'Win three games of pool in one week.'],
  ['jackpot', 'Ding Ding Ding', 'Win a linked jackpot on the pokies.'],
  ['grand', 'The Grand', 'Win the Grand jackpot.'],
  ['feature', 'Feature Presentation', 'Trigger a pokie feature.'],
  ['early', 'Responsible Adult', 'Leave early and sober.'],
  ['legless', 'Legless', 'Get walked out by the bouncer.'],
  ['wahey', 'WAHEYYY', 'Smash five glasses in one week.'],
  ['meat', 'Meat Tray Royalty', 'Win the Saturday meat raffle.'],
  ['trivia', 'Trivia Buff', 'Win trivia night.'],
  ['shift', 'Hospo Life', 'Finish a shift behind the bar.'],
  ['pour', 'Perfect Pour', 'Pour a perfect beer on shift.'],
  ['longshot', 'Long Shot', 'Win a race bet at 10/1 or longer.'],
  ['karaoke', 'Karaoke Legend', 'Win karaoke night.'],
  ['samaritan', 'Good Samaritan', 'Hand in a lost wallet.'],
  ['kebab', "Kebab O'Clock", 'Eat a kebab after 11pm.'],
  ['scratchie', 'Scratch and Win', 'Win on a scratchie.'],
  ['regular', 'One of Us', 'Become proper mates with a regular.'],
  ['toilet', 'Breaking the Seal', 'Visit the gents.'],
  ['upstairs', 'Room With a View', 'Sleep in a room upstairs.'],
  ['taxi', 'Home, James', 'Catch a cab home.'],
  ['rent', 'Roof Over Your Head', 'Make rent on Sunday.'],
  ['legend', 'Legend of the Royal', 'Finish a week ahead of where you started.'],
];
const ACH = { got: store('ld_ach') || {} };
function achieve(id) {
  if (ACH.got[id]) return;
  const a = ACH_LIST.find(x => x[0] === id); if (!a) return;
  ACH.got[id] = Date.now(); store('ld_ach', ACH.got);
  const el = document.createElement('div'); el.className = 'ach';
  el.innerHTML = `<small>ACHIEVEMENT UNLOCKED</small><b>${a[1]}</b><span>${a[2]}</span>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 600); }, 4200);
  [784, 988, 1175, 1568].forEach((f, i) => SFX.tone(f, 0.4, { delay: i * 0.08, gain: 0.07, type: 'triangle' }));
}
function achievementsPanel(back) {
  const n = Object.keys(ACH.got).length;
  const grid = `<div class="achgrid">${ACH_LIST.map(([id, t, d]) => `<div class="achc ${ACH.got[id] ? 'on' : ''}"><b>${ACH.got[id] ? t : '???'}</b><span>${d}</span></div>`).join('')}</div>`;
  Game.openPanel('ACHIEVEMENTS', `${n} of ${ACH_LIST.length} unlocked`, grid, [{ label: 'Back', fn: () => { Game.closePanel(); back && back(); } }]);
}

// =====================================================================
//  REGULARS: the same six faces every night, each with a week-long story
// =====================================================================
// lines[day] is what they say when you have a yarn (Mon = 0). Choices can change flags and relationships.
const REGULARS = {
  'Old Mick': {
    look: { fem: false, skinI: 0, shirt: { tile: 'collar', c: 0x5a4632 }, pants: { tile: 'cloth', c: 0x3a3a40 }, hair: 0xd8d8d8, style: 'cap', scale: 0.95, girth: 1.0, shorts: false, beard: 'mo', glasses: true },
    spot: s => s.kind === 'stool' && s.area === 'bar' && s.pos.z < -13.3, bio: 'Drinking at the Royal since 1968. Same stool.',
    lines: [
      "Been drinking here since '68. Same stool. They put a plaque on it once. Somebody nicked the plaque.",
      "My Joanie loved the parma here. Said it was the only thing in this town bigger than my ego.",
      "Trivia? I AM the trivia, son. First PM — Barton. Next question.",
      "Today would've been Joanie's eightieth birthday.",
      "We had six o'clock closing when I started. The six o'clock swill. Animals, we were.",
      "Footy's not what it was. Nothing is. Except the beer. Beer's the same.",
      "Rumour is the owners are selling up. Where'll I go? Me stool's here.",
    ],
    extra(n, s, opts) {
      if (s.day === 3 && rel('Old Mick') >= 25 && !s.flags.mickTip) opts.push({ label: 'Ask about Joan', d: 'He looks like he wants to talk', fn: () => { s.flags.mickTip = true; relUp('Old Mick', 10); Game.closePanel(); bark(n, "She always backed the grey in the last race. Here — race eight tonight, number six, Joan's Delight. Put a tenner on her for me.", true); Game.toast('Tip: Race 8 tonight, #6 Joan\'s Delight (TAB terminal by the Keno).', true); } });
    },
  },
  'Shazza': {
    look: { fem: true, skinI: 5, shirt: { tile: 'collar', c: 0xd04a8a }, pants: { tile: 'denim', c: 0xffffff }, hair: 0xe8d080, style: 'bob', skirt: false, girth: 1.0 },
    spot: s => s.kind === 'stool' && s.group === 'ht-6.5', bio: 'Loudest laugh in the pub. Saving for Bali.',
    lines: [
      "Darl! You look like you need a bevvie. Mondays, honestly.",
      "Saving every cent for Bali. Every cent. Except this one. And this one.",
      "If anyone asks, I was NOT the one who answered 'Kylie' for every trivia question.",
      "Payday! Don't let me near the pokies. Seriously, physically stop me.",
      "KARAOKE tonight, baby! I'm doing the big ballad. You should get up too!",
      "Bali's booked!! Ten days in Kuta. I'm never coming back. (I'm back Tuesday.)",
      "Bev reckons there's an offer on the pub. Over my dead body.",
    ],
    extra(n, s, opts) {
      if (rel('Shazza') >= 20 && !s.tonight.shazShout) opts.push({ label: '"Your shout, is it Shaz?"', d: 'Worth a try', fn: () => { s.tonight.shazShout = true; Game.closePanel(); bark(n, 'Ahh go on then, you charmer. Schooner for this one!', true); bartenderOrder({ type: 'schooner', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (it, sp) => Game.placeItem(it, sp) }); Game.toast('Shazza shouted you a schooner. It\'s at the bar.'); } });
    },
  },
  'Davo': {
    look: { fem: false, skinI: 2, shirt: { tile: 'hivis', c: 0xff7a1a }, pants: { tile: 'cloth', c: 0x2a3a5a }, hair: 0x3a2412, style: 'cap', girth: 1.25, shorts: true, beard: 'full' },
    spot: s => s.kind === 'pokie' && !s.smoke && s.machine && s.machine.idx === 7, bio: 'Concreter. Three kids. Always "due" on the Dragon.',
    lines: [
      "Up two hundred on the Dragon, mate! TWO HUNDRED! Tonight's the night.",
      "Gave it all back last night. And then some. She's due though. She's gotta be due.",
      "Lend us fifty? Just till tomorrow. Payday. Promise.",
      "Payday. Gonna win it all back tonight. All of it.",
      null, null, null,
    ],
    good: () => Game.state.flags.davoGood || 0,
    line(s) {
      const g = this.good();
      if (s.day === 4) return g >= 3 ? "Took the kids to the beach instead of coming here early. Best arvo in ages. Thanks for being straight with me." : "Down six hundred this week. Don't tell Kylie. Please.";
      if (s.day === 5) return g >= 3 ? "Haven't touched a machine in two days. Feels weird. Good weird." : "Had to sell the ute. Don't wanna talk about it.";
      if (s.day === 6) return g >= 3 ? "Rang the Gambling Help line today. Should've done it years ago. Cheers, mate." : "Rent's gonna bounce. Again. Yeah. I know.";
      return this.lines[s.day];
    },
    extra(n, s, opts) {
      const f = s.flags, push = (good, bad) => {
        opts.push({ label: good[0], d: good[1], fn: () => { f.davoGood = (f.davoGood || 0) + 1; s.tonight.davoChoice = 1; relUp('Davo', 6); Game.closePanel(); bark(n, good[2], true); } });
        opts.push({ label: bad[0], d: bad[1], fn: () => { s.tonight.davoChoice = 1; relUp('Davo', 3); Game.closePanel(); bark(n, bad[2], true); } });
      };
      if (s.tonight.davoChoice) return;
      if (s.day === 0) push(['"Cash out while you\'re ahead, mate."', 'Be straight with him', 'Yeah… yeah, maybe you\'re right. Maybe.'], ['"Let it ride!"', 'Egg him on', 'THAT\'S what I\'m talkin\' about!']);
      if (s.day === 1) push(['"Go home to the kids, Davo."', 'Be straight with him', '…Yeah. Kylie\'s been on me about it. Fair enough.'], ['"Yeah, she\'s due."', 'Tell him what he wants to hear', 'See! You get it.']);
      if (s.day === 2) {
        opts.push({ label: 'Lend him $50', d: '"Just till tomorrow"', disabled: s.wallet < 50, fn: () => { s.tonight.davoChoice = 1; s.wallet -= 50; s.debts.push({ name: 'Davo', amt: 50, day: s.day, chance: (f.davoGood || 0) >= 2 ? 0.95 : 0.35 }); relUp('Davo', 8); Game.closePanel(); bark(n, 'You\'re a legend. Tomorrow, I swear on me kids.', true); } });
        push(['"Not for the pokies, mate. Sorry."', 'Say no', '…Nah, you\'re right. Wasn\'t a fair ask.'], ['"Ask someone else, mate."', 'Brush him off', 'Yeah, righto. Cheers for nothing.']);
      }
      if (s.day === 3) push(['"Your kids need that money more than the machine does."', 'Be straight with him', '…Bloody hell. Yeah. Yeah, they do.'], ['"Go get \'em, champ."', 'Egg him on', 'Too right!']);
    },
  },
  'Kenno': {
    look: { fem: false, skinI: 1, shirt: { tile: 'collar', c: 0x161616 }, pants: { tile: 'denim', c: 0xffffff }, hair: 0x6a4a2a, style: 'mullet', girth: 1.1, beard: 'mo' },
    spot: s => s.anim === 'darts', dartSkill: 0.85, bio: 'Two-time Royal darts champion (2009, 2014).',
    lines: [
      "Kenno. Two-time Royal darts champ. Oh-nine and fourteen. Fancy a game?",
      "Darts is ninety percent mental. The other half's physical.",
      "Trivia's for nerds. Arrows is for legends.",
      "You're getting better, I'll give ya that.",
      "Big crowd tonight. Good night to take someone's money on the oche.",
      "Footy's on. Board's free. You and me?",
      "If they sell the Royal, where's the board go? Some bloody wine bar?",
    ],
    extra(n, s, opts) {
      opts.push({ label: 'Challenge him to darts', d: 'He\'s good. Really good.', fn: () => { Game.closePanel(); Darts.offer(); } });
      if (rel('Kenno') >= 20 && !s.flags.dartTip) opts.push({ label: 'Ask for a tip', d: 'Swallow your pride', fn: () => { s.flags.dartTip = true; Game.closePanel(); bark(n, 'Elbow up, eyes on the treble, and follow through like you\'re posting a letter.', true); Game.toast('Kenno\'s tip: your darts are steadier now.'); } });
    },
  },
  'Bev': {
    look: { fem: true, skinI: 0, shirt: { tile: 'cloth', c: 0x7a3a5a }, pants: { tile: 'cloth', c: 0x2a2a2a }, hair: 0xb8b8b8, style: 'bob', scale: 0.93, girth: 1.08, glasses: true },
    spot: s => s.kind === 'chair' && s.group === 'lt9.4_0.6' && s.pos.x > 9.4, bio: 'Runs the raffle and trivia. Knows everything.',
    lines: [
      "I'm Bev. I've run the raffle and the trivia here since before you were born, love.",
      "Parma night keeps this place alive. Without it we'd be a pokies den with a carpet.",
      "Trivia starts at half eight. Phones away. I WILL check.",
      "Between you and me, the owners have had an offer. Developers. Apartments.",
      "If you're ever short, the bar could use a hand some nights. I'll put in a word with the boss.",
      "Raffle's at five. Here, have a ticket on me.",
      "I've got a petition to heritage-list the Royal. The council needs enough of us to sign.",
    ],
    extra(n, s, opts) {
      if (s.day === 4 && !s.flags.shiftOK) { s.flags.shiftOK = true; }
      if (s.day === 5 && rel('Bev') >= 15 && !s.tonight.bevTicket && !Game.raffle.drawn) opts.push({ label: 'Take the raffle ticket', fn: () => { s.tonight.bevTicket = true; Game.raffle.tickets++; Game.closePanel(); bark(n, 'Green forty-two. Lucky number.', true); } });
      if (s.day === 6 && !s.flags.petition) opts.push({ label: 'Sign the petition', d: 'Save the Royal', fn: () => { s.flags.petition = true; relUp('Bev', 12); Game.closePanel(); bark(n, 'Good on you, love. Every name counts.', true); } });
    },
  },
  'Spud': {
    look: { fem: false, skinI: 3, shirt: { tile: 'hoops', c: 0xb03040 }, pants: { tile: 'cloth', c: 0x222222 }, hair: 0x2a1a0a, style: 'bucket', scale: 1.02, girth: 0.9, beard: null },
    spot: s => s.kind === 'pool', poolSkill: 0.72, bio: 'Apprentice sparky. Pool shark. Always skint.',
    lines: [
      "Spud. Apprentice sparky. Wanna play pool? Ten bucks?",
      "Lend us twenty? I'll pay ya back Wednesday. Promise.",
      "Got paid today!",
      "I'm the best pool player in this pub. Ask anyone. Don't ask Kenno.",
      "Knock-off drinks! Apprentices don't knock off, we just get told to go home.",
      "Tip: aim at where the cue ball needs to BE, not at the ball. Changed my life.",
      "Sunday sesh, then TAFE tomorrow. Kill me.",
    ],
    extra(n, s, opts) {
      opts.push({ label: 'Challenge him to pool', d: 'Eight-ball, on the house table', fn: () => { Game.closePanel(); startPool('Spud'); } });
      if (s.day === 1 && !s.flags.spudLoan) opts.push({ label: 'Lend him $20', disabled: s.wallet < 20, fn: () => { s.flags.spudLoan = 1; s.wallet -= 20; relUp('Spud', 6); Game.closePanel(); bark(n, 'Champion. Wednesday. On me nan\'s life.', true); } });
      if (s.day === 2 && s.flags.spudLoan === 1) { s.flags.spudLoan = 2; s.wallet += 30; Game.toast('Spud paid back your $20 — plus a tenner. Legend.', true); relUp('Spud', 6); }
      if (s.day >= 5 && rel('Spud') >= 15 && !s.flags.poolTip) { s.flags.poolTip = true; Game.toast('Spud\'s tip: your pool aim line is longer now.'); }
    },
  },
};
function rel(name) { return (Game.state.rel && Game.state.rel[name]) || 0; }
function relUp(name, k) { const s = Game.state; s.rel[name] = clamp(rel(name) + k, 0, 100); if (s.rel[name] >= 60) achieve('regular'); }
const REG = {
  get(name) { return REGULARS[name] || null; },
  here(name) { return NPCS.find(n => n.regular === name && !n.gone) || null; },
  bump(name, k) { if (REGULARS[name]) relUp(name, k); },
  dartBonus() { return (Game.state.flags.dartTip ? 0.004 : 0) + (Night.hasPerk(4) ? 0.004 : 0); },
  spawnAll() {
    if (!VENUE.story) return;   // the Royal's locals drink at the Royal
    for (const name in REGULARS) {
      const R = REGULARS[name];
      const n = mkNPC(Object.assign({ name, smoker: name === 'Davo', gambler: name === 'Davo' }, R.look));
      n.regular = name;
      const sp = SPOTS.find(s => !s.occ && R.spot(s));
      if (sp) { claim(n, sp); n.pos.copy(sp.pos); n.ry = sp.ry; seatNPC(n); }
      else { n.pos.copy(NODES.P5); n.state = 'idle'; n.kind = 'stand'; }
      n.timer = 1e9; // regulars stay put
    }
  },
  talk(n) {
    const s = Game.state, R = REGULARS[n.regular], name = n.regular; Night.ev('talk', name);
    const line = (R.line ? R.line(s) : R.lines[s.day]) || choice(BARKS.any);
    const first = !s.tonight['talk_' + name];
    if (first) { s.tonight['talk_' + name] = 1; relUp(name, 5); s.mood = Math.min(100, s.mood + 3); }
    const opts = [];
    const beat = DLG.nextBeat(name);
    if (beat) opts.push({ label: 'Dig deeper', d: beat.title, fn: () => { Game.closePanel(); DLG.playBeat(name, n); } });
    R.extra && R.extra(n, s, opts);
    STORY.talkOpts(n, opts);
    const price = Game.drinkPrice('schooner');
    if (!s.tonight['shout_' + name]) opts.push({ label: `Shout ${name} a drink`, d: 'Mateship is a currency', price: fmt$(price), disabled: s.wallet < price, fn: () => { if (!Game.spend(price, 'spentDrinks')) return; s.tonight['shout_' + name] = 1; Night.ev('shouted'); Night.log('🍺', `Shouted ${name} a drink`); relUp(name, 10); n.glass.fill = 1; Game.closePanel(); bark(n, choice(['You beauty! Cheers.', 'Ahh, you\'re a gentleman and a scholar.', 'Legend. Owe ya one.']), true); SFX.register(V3(-9, 1.2, -9)); } });
    opts.push({ label: 'See ya', fn: () => Game.closePanel() });
    const hearts = '♥'.repeat(Math.round(rel(name) / 20)) + '♡'.repeat(5 - Math.round(rel(name) / 20));
    Game.openPanel(name.toUpperCase(), `<span style="opacity:.7">${R.bio} · <span style="color:#ff8a9a">${hearts}</span></span><br><br>"${line}"`, Game.optList(opts), []);
    bark(n, '…', false); n.a.talk = 3;
  },
};

// =====================================================================
//  RANDOM EVENTS: a couple each night (wallet, birthday, scuffle, charity tin, dodgy seller)
// =====================================================================
const RANDOM = {
  queue: [], live: [],
  plan() {
    const s = Game.state, D = DAYS[s.day];
    this.queue = []; this.live.forEach(e => e.cleanup && e.cleanup()); this.live = [];
    const pool = ['wallet', 'birthday', 'scuffle', 'charity', 'dodgy'].sort(() => Math.random() - 0.5);
    const n = D.crowd > 18 ? 3 : 2;
    for (let i = 0; i < n; i++) this.queue.push({ kind: pool[i], at: s.startTime + 0.4 + i * (D.close - s.startTime - 1) / n + rand(0, 0.5) });
  },
  update(dt) {
    const s = Game.state;
    for (const e of this.queue) if (!e.started && s.time >= e.at && Game.entered) { e.started = true; const ev = this[e.kind](); if (ev) this.live.push(ev); }
    for (const e of this.live) e.update && e.update(dt);
  },
  patron(filter = () => true) { return choice(NPCS.filter(n => n.role === 'patron' && !n.regular && !n.mg && n.state === 'idle' && n.spot && filter(n))); },
  wallet() {
    const spots = [V3(-4.6, 0, -4.3), V3(-6.2, 0, -11.6), V3(6.9, 0, -0.4), V3(-1.2, 0, -14.8), V3(10.6, 0, -2.6)];
    const p = choice(spots), cash = choice([120, 150, 180, 220]);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.09), M({ color: 0x3a2412, roughness: 0.6 })); w.position.set(p.x, 0.01, p.z); w.rotation.y = rand(0, 3); scene.add(w);
    const ia = addInteract({ id: 'wallet', temp: true, pos: V3(p.x, 0.3, p.z), r: 2.2, label: () => 'Pick up the wallet', action: () => {
      interactables.splice(interactables.indexOf(ia), 1); scene.remove(w);
      Game.openPanel('A WALLET', `Brown leather. ${fmt0(cash)} in cash, a licence for one <b>Graham Pike</b>, a photo of a kelpie.`, Game.optList([
        { label: 'Hand it in at the bar', d: 'The right thing', fn: () => { Game.closePanel(); achieve('samaritan'); Game.state.mood = Math.min(100, Game.state.mood + 10); for (const k in REGULARS) relUp(k, 3); Game.subtitle(`<b>${bartender.name}:</b> Good on ya. That's Pikey's — he'll be stoked.`, 4); setTimeout(() => { if (Game.mode !== 'play') return; Game.state.wallet += 40; Game.state.night.extra += 40; Game.toast('Graham Pike came back for his wallet and left you $40 at the bar. "Legend."', true); }, 45000); } },
        { label: `Keep the cash (${fmt0(cash)})`, d: 'Finders keepers…', fn: () => { Game.closePanel(); Game.state.wallet += cash; Game.state.night.extra += cash; Game.state.mood = Math.max(0, Game.state.mood - 12); if (Math.random() < 0.5) { for (const k in REGULARS) relUp(k, -8); setTimeout(() => Game.subtitle('<b>Bev:</b> I saw that. Shame on you.', 4), 2500); } Game.toast('You pocket the cash and bin the wallet. Feels grubby.'); } },
      ]));
    } });
    return { cleanup() { scene.remove(w); const i = interactables.indexOf(ia); if (i >= 0) interactables.splice(i, 1); } };
  },
  birthday() {
    const n = this.patron(); if (!n) return null;
    const age = choice([30, 40, 50, 60, 21]);
    SFX.bell(V3(-9, 2.5, -8), 1);
    Game.subtitle(`<b>${bartender.name}:</b> Oi! It's ${n.name}'s ${age}th! Everybody!`, 4);
    setTimeout(() => { NPCS.forEach(o => { if (o.role === 'patron' && o.state === 'idle' && Math.random() < 0.6) o.cheerT = 2.4; }); SFX.cheer(n.pos, 2); Music.level = 0.9; }, 2500);
    n.eventTalk = () => {
      const s = Game.state, price = Game.drinkPrice('schooner');
      Game.openPanel(n.name.toUpperCase(), `"It's me ${age}th! Can you believe it?"`, Game.optList([
        { label: 'Shout the birthday legend a drink', price: fmt$(price), disabled: s.wallet < price, fn: () => { if (!Game.spend(price, 'spentDrinks')) return; n.eventTalk = null; Game.closePanel(); s.mood = Math.min(100, s.mood + 10); n.cheerT = 2; bark(n, 'You absolute LEGEND! Cheers!', true); } },
        { label: '"Happy birthday, mate."', fn: () => { n.eventTalk = null; Game.closePanel(); s.mood = Math.min(100, s.mood + 2); bark(n, 'Cheers, mate!', true); } }]), []);
    };
    return { cleanup() { n.eventTalk = null; } };
  },
  scuffle() {
    const a = this.patron(o => o.spot.area === 'bar'), b = a && this.patron(o => o !== a && o.spot.area === 'bar');
    if (!a || !b) return null;
    const lines = [[a, 'Oi, that was MY schooner, champ.'], [b, 'Wasn\'t. Sit down.'], [a, 'You wanna say that again?'], [b, 'Yeah I do. Sit. Down.'], [a, 'Right, OUTSIDE.']];
    const ev = { t: 0, k: 0, done: false, update(dt) {
      if (this.done) return;
      this.t -= dt;
      if (this.t <= 0 && this.k < lines.length) { const [who, l] = lines[this.k++]; bark(who, l, true); who.cheerT = 0; this.t = 4; }
      else if (this.t <= 0 && this.k >= lines.length) { this.done = true; Game.subtitle('<b>Bouncer:</b> Right, you two. Out. Now.', 4); if (player.pos.distanceTo(a.pos) < 11 && !Game.uiOpen && !MG.active && !player.seated) Cine.follow(a, 4.5, '<b>Bouncer:</b> Right, you two. Out. Now.'); for (const n of [a, b]) { n.leaving = true; release(n); n.state = 'walk'; n.kind = 'walk'; n.path = findPath(n.pos, NODES.S2); } }
    } };
    const calm = () => {
      if (ev.done) return; ev.done = true; a.eventTalk = b.eventTalk = null; Game.closePanel();
      const drunk = Game.state.drunk / 100;
      if (Math.random() < 0.75 - drunk * 0.4) { Game.subtitle('<b>You:</b> Settle down fellas, it\'s not worth it. I\'ll get the next one.', 3); setTimeout(() => { bark(a, '…Yeah. Fair enough. Sorry, mate.', true); }, 2500); Game.state.mood = Math.min(100, Game.state.mood + 8); for (const k in REGULARS) relUp(k, 2); }
      else { Game.subtitle(`<b>${a.name}:</b> Stay out of it!`, 3); setTimeout(() => { if (player.drink && !player.drink.onLedge) dropHeld(); Game.toast('You got shoved and lost your drink.'); Game.state.mood = Math.max(0, Game.state.mood - 8); }, 600); }
    };
    a.eventTalk = b.eventTalk = () => Game.openPanel('A BLUE BREWING', `${a.name} and ${b.name} are squaring up.`, Game.optList([{ label: '"Settle down, fellas."', d: 'Step in', fn: calm }, { label: 'Stay out of it', fn: () => Game.closePanel() }]));
    return ev;
  },
  charity() {
    const n = mkNPC({ name: 'Lions Club volunteer', shirt: { tile: 'collar', c: 0xe8c52a }, pants: { tile: 'cloth', c: 0x1a2440 }, fem: Math.random() < 0.5 });
    n.pos.copy(NODES.S0); const sp = SPOTS.find(s => !s.occ && s.area === 'bar' && s.kind === 'stand');
    if (sp) sendTo(n, sp); n.timer = 140; n.role = 'patron';
    n.eventTalk = () => Game.openPanel('LIONS CLUB', '"Collecting for the local hospital, love. Every gold coin helps."', Game.optList([
      { label: 'Drop in $5', price: '$5.00', disabled: Game.state.wallet < 5, fn: () => { Game.state.wallet -= 5; Game.state.night.extra -= 5; Game.state.mood = Math.min(100, Game.state.mood + 6); n.eventTalk = null; Game.closePanel(); bark(n, 'Bless you, darl.', true); SFX.coin(n.pos); } },
      { label: 'Drop in a gold coin', price: '$2.00', disabled: Game.state.wallet < 2, fn: () => { Game.state.wallet -= 2; Game.state.night.extra -= 2; Game.state.mood = Math.min(100, Game.state.mood + 3); n.eventTalk = null; Game.closePanel(); bark(n, 'Thank you!', true); SFX.coin(n.pos); } },
      { label: 'Sorry, no cash', fn: () => { n.eventTalk = null; Game.closePanel(); } }]));
    return null;
  },
  dodgy() {
    const n = this.patron(); if (!n) return null;
    n.eventTalk = () => Game.openPanel(n.name.toUpperCase(), '"Psst. Wanna buy a Rolex? Genuine. Fell off a truck. Sixty bucks."', Game.optList([
      { label: 'Buy the "Rolex"', price: '$60.00', disabled: Game.state.wallet < 60, fn: () => { Game.state.wallet -= 60; Game.state.night.extra -= 60; n.eventTalk = null; Game.closePanel(); setTimeout(() => { Game.toast('The "Rolex" says ROLAX on the face. And it\'s already stopped.', true); Game.state.mood = Math.max(0, Game.state.mood - 8); }, 4000); } },
      { label: '"Nah, you\'re right."', fn: () => { n.eventTalk = null; Game.closePanel(); bark(n, 'Your loss, mate.', true); } }]));
    return { cleanup() { n.eventTalk = null; } };
  },
};

// ---- src/16-settings.js ----

// =====================================================================
//  SETTINGS: tabbed options menu (graphics, display, audio, controls, gameplay, accessibility)
// =====================================================================
// each row: [key, label, type, options, help, onChange]; type: select | range | toggle
const SETTINGS_TABS = {
  GRAPHICS: [
    ['preset', 'Quality preset', 'select', [['low', 'Low — laptops & integrated graphics'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra — sharper image, bigger shadows, busier pub'], ['custom', 'Custom']], 'Sets everything below in one go.'],
    ['resScale', 'Render resolution', 'range', [0.5, 1, 0.05, v => Math.round(v * 100) + '%'], 'Lower is faster. 100% is native.'],
    ['dynres', 'Dynamic resolution', 'toggle', null, 'Drops the resolution a notch if the frame rate stays low.'],
    ['shadows', 'Shadows', 'select', [['off', 'Off'], ['low', 'Low (hard)'], ['high', 'High (soft)']], ''],
    ['aa', 'Anti-aliasing (MSAA 4×)', 'toggle', null, 'Applies after a reload.'],
    ['reflections', 'Real-time mirror reflections', 'toggle', null, 'The back-bar and gents mirrors.'],
    ['shafts', 'Light shafts & dust', 'toggle', null, ''],
    ['bloom', 'Bloom (glow)', 'toggle', null, ''],
    ['bloomStr', 'Bloom strength', 'range', [0.1, 1, 0.05, v => v.toFixed(2)], ''],
    ['crowd', 'Crowd size', 'range', [0.5, 1.4, 0.05, v => Math.round(v * 100) + '%'], 'Applies from the next night.'],
    ['showFps', 'Show performance (F3)', 'toggle', null, 'Frame rate, frame time and draw calls.'],
  ],
  DISPLAY: [
    ['fov', 'Field of view', 'range', [60, 100, 1, v => v + '°'], ''],
    ['brightness', 'Brightness', 'range', [0.6, 1.6, 0.05, v => Math.round(v * 100) + '%'], ''],
    ['vignette', 'Vignette', 'range', [0, 1.5, 0.05, v => Math.round(v * 100) + '%'], 'Darkened screen edges.'],
    ['headBob', 'Head bob', 'toggle', null, ''],
    ['drunkFx', 'Drunk effects', 'range', [0, 1, 0.05, v => Math.round(v * 100) + '%'], 'Wobble, double vision and sway when you\'ve had a few.'],
  ],
  AUDIO: [
    ['vol', 'Master volume', 'range', [0, 1, 0.05, v => Math.round(v * 100) + '%'], ''],
    ['music', 'Music (jukebox)', 'range', [0, 1, 0.05, v => Math.round(v * 100) + '%'], ''],
    ['sfx', 'Effects', 'range', [0, 1, 0.05, v => Math.round(v * 100) + '%'], 'Pokies, glasses, darts, footsteps.'],
    ['amb', 'Ambience', 'range', [0, 1, 0.05, v => Math.round(v * 100) + '%'], 'Crowd murmur, rain, crickets, traffic.'],
  ],
  CONTROLS: [
    ['sens', 'Mouse sensitivity', 'range', [0.2, 3, 0.05, v => v.toFixed(2)], ''],
    ['invertY', 'Invert mouse Y', 'toggle', null, ''],
    ['touch', 'Touch controls (mobile)', 'select', [['auto', 'Auto — on for phones & tablets'], ['on', 'On'], ['off', 'Off']], 'On-screen stick, look by dragging, action buttons.'],
    ['_keys', 'Key bindings', 'keys', null, ''],
  ],
  GAMEPLAY: [
    ['timeSpeed', 'Clock speed', 'select', [[0.6, 'Relaxed — nights last longer'], [1, 'Normal'], [1.5, 'Fast']], 'How quickly the pub clock runs.'],
    ['cinematics', 'Cinematics', 'select', [['full', 'Full — opening shots, last drinks, big wins, the council'], ['short', 'Short — only the quick ones'], ['off', 'Off']], 'Hold E to skip any of them.'],
    ['subtitles', 'Dialogue subtitles', 'toggle', null, ''],
    ['subSize', 'Subtitle size', 'range', [0.8, 1.6, 0.05, v => Math.round(v * 100) + '%'], ''],
    ['hints', 'Control hints & objectives', 'toggle', null, ''],
  ],
  ACCESSIBILITY: [
    ['reduceMotion', 'Reduce motion', 'toggle', null, 'Turns off head bob, camera sway and the drunk wobble.'],
    ['drunkFx', 'Drunk effects', 'range', [0, 1, 0.05, v => Math.round(v * 100) + '%'], ''],
    ['subSize', 'Subtitle size', 'range', [0.8, 1.6, 0.05, v => Math.round(v * 100) + '%'], ''],
    ['timeSpeed', 'Clock speed', 'select', [[0.6, 'Relaxed'], [1, 'Normal'], [1.5, 'Fast']], ''],
  ],
};
const PRESET_KEYS = ['quality', 'resScale', 'shadows', 'aa', 'bloom', 'bloomStr', 'reflections', 'shafts', 'crowd'];
const KEYS_HELP = [['W A S D', 'Walk'], ['Shift', 'Run'], ['Mouse', 'Look'], ['E', 'Interact'], ['F', 'Sip your drink'], ['C', 'Smoke'], ['G', 'Drop your glass'], ['Tab', 'Phone'], ['Space', 'Spin / pick at a pokie'], ['↑ ↓', 'Change bet'], ['I', 'Insert cash'], ['Enter', 'Collect'], ['Q', 'Stand up / leave a game'], ['Esc', 'Pause'], ['F3', 'Performance overlay']];
let settingsTab = 'GRAPHICS';
function openSettings(back) {
  const wrap = document.createElement('div'); wrap.className = 'settings';
  const tabs = document.createElement('div'); tabs.className = 'stabs';
  const body = document.createElement('div'); body.className = 'sbody';
  wrap.append(tabs, body);
  const render = () => {
    tabs.innerHTML = ''; body.innerHTML = '';
    for (const t in SETTINGS_TABS) { const b = document.createElement('button'); b.textContent = t; b.className = t === settingsTab ? 'on' : ''; b.onclick = () => { settingsTab = t; SFX.click(); render(); }; tabs.appendChild(b); }
    for (const [key, label, type, opts, help] of SETTINGS_TABS[settingsTab]) {
      const row = document.createElement('div'); row.className = 'srow';
      row.innerHTML = `<div class="sl"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div>`;
      const ctl = document.createElement('div'); ctl.className = 'sc';
      if (type === 'keys') { row.classList.add('keys'); ctl.innerHTML = `<div class="kgrid2">${KEYS_HELP.map(([k, d]) => `<span class="kbd">${k}</span><span>${d}</span>`).join('')}</div>`; }
      else if (type === 'select') {
        const sel = document.createElement('select');
        for (const [v, l] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o); }
        sel.value = String(settings[key]);
        sel.onchange = () => { const v = isNaN(+sel.value) ? sel.value : +sel.value; set(key, v); };
        ctl.appendChild(sel);
      } else if (type === 'range') {
        const [mn, mx, st, fmt] = opts, r = document.createElement('input'), val = document.createElement('span');
        r.type = 'range'; r.min = mn; r.max = mx; r.step = st; r.value = settings[key]; val.className = 'sv'; val.textContent = fmt(+settings[key]);
        r.oninput = () => { val.textContent = fmt(+r.value); set(key, +r.value, true); };
        r.onchange = () => render();
        ctl.append(r, val);
      } else if (type === 'toggle') {
        const b = document.createElement('button'); b.className = 'tog' + (settings[key] ? ' on' : ''); b.textContent = settings[key] ? 'ON' : 'OFF';
        b.onclick = () => { set(key, !settings[key]); SFX.click(); };
        ctl.appendChild(b);
      }
      row.appendChild(ctl); body.appendChild(row);
    }
  };
  const set = (key, v, live) => {
    if (key === 'preset') { if (v !== 'custom') applyPreset(v); else settings.preset = 'custom'; }
    else { settings[key] = v; if (PRESET_KEYS.includes(key)) settings.preset = 'custom'; }
    if (key === 'reduceMotion' && v) settings.headBob = false;
    saveSettings(); applySettings();
    if (!live) render();
  };
  render();
  Game.openPanel('SETTINGS', 'Changes save automatically.', wrap, [
    { label: 'Reset to defaults', fn: () => { localStorage.removeItem('ld_settings'); Object.assign(settings, { sens: 1, vol: 0.8, music: 0.6, sfx: 1, amb: 1, fov: 72, dynres: true, showFps: false, brightness: 1, vignette: 1, drunkFx: 1, headBob: true, reduceMotion: false, invertY: false, subtitles: true, subSize: 1, timeSpeed: 1, hints: true }); applyPreset('high'); saveSettings(); applySettings(); render(); } },
    { label: 'Done', fn: () => { Game.closePanel(); back && back(); } }]);
  $('panel').classList.add('wide');
}
function applySettings() {
  applyQuality();
  AudioSys.setVolume();
  if (settings.quality === 'low') (window.__optionalLights || []).forEach(l => l.visible = false);
  TOUCH.apply();
  $('hints').style.display = settings.hints && !TOUCH.on ? '' : 'none'; $('objective').style.display = settings.hints ? '' : 'none';
}

// ---- src/17-mainstory.js ----

// =====================================================================
//  MAIN STORY: "Save the Royal" — seven chapters, one per night, three endings
// =====================================================================
// The Royal's owner is selling to a developer. Over the week you can raise money,
// dig up the pub's 1888 licence, gather signatures, and turn down a bribe.
// On Sunday night the council comes to the pub and decides.
const CHAPTERS = [
  { title: 'Chapter 1 — New in Town', narr: 'Six months since you moved to Wattle Creek for the warehouse job. You don\'t know many people yet. Everyone, it turns out, knows the Royal.', goal: 'Meet the regulars. Bev runs the raffle and knows everything — she\'s in the lounge.' },
  { title: 'Chapter 2 — The Suit', narr: 'Word\'s out: old Frank is selling the Royal. Tonight there\'s a bloke in a suit in the lounge, and he isn\'t here for the parma.', goal: 'There\'s a man in a suit in the lounge. Find out what he wants.' },
  { title: 'Chapter 3 — The Jar', narr: 'Bev has had enough. A big jar has appeared on the bar with SAVE THE ROYAL written on it in texta. Trivia proceeds go in the jar tonight.', goal: 'Chip in to the Save the Royal jar on the bar. Win trivia and the prize goes in too.' },
  { title: 'Chapter 4 — 1888', narr: 'Old Mick swears the pub\'s original 1888 licence still exists. Joan\'s grandfather framed it, and Frank hung a footy photo over the top years ago.', goal: 'Find the 1888 licence. Mick reckons it\'s behind an old footy photo on the front wall of the bar.' },
  { title: 'Chapter 5 — The Big Night', narr: 'Friday. Karaoke\'s a fundraiser tonight — every point you score, the crowd puts a dollar in the jar. Shazza\'s been warming up since lunch.', goal: 'Karaoke fundraiser from 8:30pm: sing at the mic in the lounge. Points become dollars for the jar.' },
  { title: 'Chapter 6 — Signatures', narr: 'The council will only heritage-list the Royal if the locals put their names to it. Bev has a petition. The suit is back, with a fatter envelope.', goal: 'Get the petition from Bev, then get the regulars to sign it.' },
  { title: 'Chapter 7 — Last Drinks', narr: 'Sunday. The council is coming to the Royal at 8pm to decide its future. Rent\'s due tonight too. No pressure.', goal: 'The council meeting starts at 8pm in the bar. Be there.' },
];
const STORY = {
  st() { const f = Game.state.flags; return f.story || (f.story = { fund: 0, letter: null, licence: false, sigs: {}, sheet: false, bribe2: null, ending: null, met: false }); },
  chapter() { return CHAPTERS[Game.state.day]; },
  goal() {
    const s = Game.state, S = this.st(), d = s.day;
    if (!VENUE.story) return `A night out at ${VENUE.name}. The Royal's story can wait a night. Make some mates, back a few winners.`;
    if (d === 0 && S.met) return 'Have a yarn with the regulars. Shout one a drink.';
    if (d === 1 && S.letter) return S.letter === 'signed' ? 'You signed the suit\'s letter. Hope nobody finds out.' : 'You told the suit where to go. The regulars will hear about it.';
    if (d === 2) return `Chip in to the Save the Royal jar on the bar. Fund: ${fmt0(S.fund)}.`;
    if (d === 3 && S.licence) return 'You found the 1888 licence. Bev will want to see that.';
    if (d === 5) { const n = Object.keys(S.sigs).length; return S.sheet ? `Get the regulars to sign the petition (${n}/6, including you).` : 'Get the petition from Bev in the lounge.'; }
    if (d === 6 && S.ending) return 'The meeting\'s over. Enjoy the rest of the night.';
    return this.chapter().goal;
  },
  // ---------------------------------------------------------- world bits
  build() {
    // the jar on the bar
    const F = BAR.front, jar = new THREE.Group(); jar.position.set(F - 0.16, 1.112, -5.3); scene.add(jar);
    const glass = new THREE.Mesh(new THREE.LatheGeometry([V3(0, 0), V3(0.075, 0), V3(0.08, 0.02), V3(0.08, 0.2), V3(0.06, 0.22), V3(0.06, 0.24)], 20), glassMat); jar.add(glass);
    this.coins = new THREE.Group(); jar.add(this.coins);
    const lbl = signTex(['SAVE THE', 'ROYAL!'], { w: 256, h: 160, bg: '#f4ead6', color: ['#c7352b', '#c7352b'], sizes: [56, 64], font: "'Permanent Marker', cursive" });
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), new THREE.MeshBasicMaterial({ map: lbl, transparent: true })); lp.position.set(0.083, 0.11, 0); lp.rotation.y = Math.PI / 2; jar.add(lp);
    this.jar = jar; jar.visible = false;
    addInteract({ id: 'jar', pos: V3(F - 0.16, 1.25, -5.3), r: 2.2, enabled: () => this.jar.visible && !MG.active, label: () => `Save the Royal jar — ${fmt0(this.st().fund)} so far`, action: () => this.donate() });
    // the licence behind the footy photo
    addInteract({ id: 'licence', pos: V3(2.2, 2.4, 1.7), r: 2.4, enabled: () => VENUE.story && (Game.state.day >= 3 || Game.state.flags.mickLicenceHint) && !this.st().licence, label: () => 'Look behind the old footy photo', action: () => this.findLicence() });
  },
  spawn() {
    const s = Game.state, S = this.st();
    this.jar.visible = VENUE.story && s.day >= 2 && S.ending !== 'sold';
    this.refreshCoins();
    this.clive = null; this.meetingDone = !!S.ending;
    if (VENUE.story && (s.day === 1 || s.day === 5)) {
      const n = mkNPC({ name: 'Clive Marsh', role: 'staff', shirt: { tile: 'collar', c: 0x2a2c34 }, pants: { tile: 'cloth', c: 0x2a2c34 }, hair: 0x8a8a8a, style: 'short', glasses: true, beard: null, skinI: 0, girth: 1.05 });
      const p = V3(7.6, 0, -2.9); n.pos.copy(p); n.ry = Math.PI * 0.85; MG.lockNPC(n, p, Math.PI * 0.85, 'stand');
      n.eventTalk = () => this.talkClive(n); this.clive = n;
    }
  },
  refreshCoins() {
    const c = this.coins; while (c.children.length) c.remove(c.children[0]);
    const n = Math.min(60, Math.round(this.st().fund / 6));
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(G.cyl8, i % 4 ? MAT.brass : M({ color: 0x3a8a4a, roughness: 0.8 })); const a = rand(0, 6.28), r = rand(0, 0.06); m.position.set(Math.cos(a) * r, 0.01 + i * 0.0028, Math.sin(a) * r); m.scale.set(i % 4 ? 0.013 : 0.03, 0.002, i % 4 ? 0.013 : 0.015); m.rotation.set(rand(-0.3, 0.3), rand(0, 3), 0); c.add(m); }
  },
  addFund(amt, why) { const S = this.st(); S.fund += amt; this.refreshCoins(); if (why) Game.toast(`${why} — the Save the Royal fund is at ${fmt0(S.fund)}.`); },
  donate() {
    const s = Game.state;
    const give = a => () => { if (!Game.spend(a)) return; s.night.extra -= a; this.addFund(a, `You put ${fmt0(a)} in the jar`); relUp('Bev', Math.min(12, a / 5)); s.mood = Math.min(100, s.mood + 3); SFX.coin(V3(BAR.front, 1.2, -5.3)); Game.closePanel(); };
    Game.openPanel('SAVE THE ROYAL', `Bev's jar. ${fmt0(this.st().fund)} so far. Every dollar goes to the community bid for the freehold.`, Game.optList([5, 20, 50, 100].map(a => ({ label: `Put in ${fmt0(a)}`, price: fmt0(a), disabled: s.wallet < a, fn: give(a) })).concat([{ label: 'Not right now', fn: () => Game.closePanel() }])));
  },
  findLicence() {
    const S = this.st(); S.licence = true;
    SFX.noise(0.4, { freq: 900, q: 0.8, gain: 0.08 });
    achieve('historian');
    Game.openPanel('THE 1888 LICENCE', '<i>Behind the footy photo, taped to the backing board, a brittle yellow document in copperplate:</i>', `<p style="font-family:Rye,serif;font-size:17px;line-height:1.6;text-align:center;padding:10px;background:#efe2c0;color:#3a2410;border-radius:4px">COLONY OF NEW SOUTH WALES<br>PUBLICAN'S GENERAL LICENSE<br><b>THE ROYAL HOTEL, WATTLE CREEK</b><br>granted this 14th day of March, 1888</p><p>That's exactly the kind of thing a heritage council loves. Mick's going to cry.</p>`);
    const mick = REG.here('Old Mick'); if (mick) setTimeout(() => bark(mick, 'You FOUND it? Joanie\'s grandad\'s licence! Well I\'ll be…', true), 1500);
  },
  talkClive(n) {
    const s = Game.state, S = this.st();
    if (s.day === 1) {
      if (S.letter) { Game.openPanel('CLIVE MARSH', '"Pleasure doing business." / "Your loss, champ."'); return; }
      Game.openPanel('CLIVE MARSH', '<span style="opacity:.7">Marsh Living · "Boutique apartments for the modern country lifestyle"</span><br><br>"You look like a reasonable person. Frank\'s selling, the council\'s dithering, and I need a few locals to sign a little letter of support. Hundred and fifty bucks for your trouble. Cash."', Game.optList([
        { label: 'Sign the letter', d: 'Easy money. Nobody will know. Probably.', price: '+$150', fn: () => { S.letter = 'signed'; s.wallet += 150; s.night.extra += 150; Game.closePanel(); bark(n, 'Smart. Very smart.', true); Game.toast('You signed. $150 cash. It feels heavier than it should.'); } },
        { label: '"Not for sale, mate."', d: 'Turn him down', fn: () => { S.letter = 'refused'; achieve('incorruptible'); for (const k in REGULARS) relUp(k, 4); Game.closePanel(); bark(n, 'Suit yourself. Everyone\'s got a price.', true); } },
        { label: '"Get out of our pub."', d: 'Loudly. In front of everyone.', fn: () => { S.letter = 'refused'; achieve('incorruptible'); for (const k in REGULARS) relUp(k, 7); s.mood = Math.min(100, s.mood + 8); Game.closePanel(); SFX.cheer(n.pos, 1); Game.subtitle('<b>Shazza:</b> YEAH! You tell him!', 3); bark(n, 'You\'ll regret this.', true); } }]), []);
    } else {
      if (S.bribe2) { Game.openPanel('CLIVE MARSH', '"…"'); return; }
      Game.openPanel('CLIVE MARSH', '"Last offer. Five hundred dollars for that petition sheet. It gets lost, nobody\'s the wiser, everyone moves on."', Game.optList([
        { label: 'Hand over the sheet', d: 'Five hundred dollars is five hundred dollars', price: '+$500', disabled: !S.sheet, fn: () => { S.bribe2 = 'took'; S.sheet = false; S.sigs = {}; s.wallet += 500; s.night.extra += 500; for (const k in REGULARS) relUp(k, -25); Game.closePanel(); bark(n, 'Pleasure.', true); Game.toast('The petition is gone. So is the trust of everyone who signed it.', true); } },
        { label: '"Shove it, Clive."', fn: () => { S.bribe2 = 'refused'; achieve('incorruptible'); for (const k in REGULARS) relUp(k, 5); Game.closePanel(); bark(n, 'Fine. See you at the meeting.', true); } }]), []);
    }
  },
  // extra options when you yarn with a regular
  talkOpts(n, opts) {
    const s = Game.state, S = this.st(), name = n.regular;
    if (s.day === 0 && name === 'Bev') S.met = true;
    if (s.day === 5 && name === 'Bev' && !S.sheet && S.bribe2 !== 'took') opts.unshift({ label: 'Take the petition', d: 'Get the regulars to sign it', fn: () => { S.sheet = true; S.sigs.Bev = true; Game.closePanel(); bark(n, 'Every name counts, love. Start with Mick — he\'d sign anything for this place.', true); } });
    if (s.day >= 5 && S.sheet && !S.sigs[name]) {
      const ok = rel(name) >= 15 || (name === 'Old Mick');
      opts.unshift({ label: `Ask ${name} to sign the petition`, d: ok ? 'They\'ll sign' : 'They don\'t know you well enough yet', fn: () => { Game.closePanel(); if (ok) { S.sigs[name] = true; bark(n, choice(['Give it here. Where do I sign?', 'For the Royal? Too right.', 'Done. Bloody developers.']), true); SFX.tone(1400, 0.1, { gain: 0.04 }); } else bark(n, 'Dunno, mate. I barely know ya. Ask me after a schooner or two.', true); } });
    }
    if (s.day === 3 && name === 'Old Mick' && !S.licence) opts.unshift({ label: 'Ask about the 1888 licence', fn: () => { Game.closePanel(); bark(n, 'Front wall of the bar, by the door. Frank stuck a footy photo over it in \'92. It\'s still under there, I\'d put money on it.', true); } });
    if (S.licence && name === 'Bev' && !S.showedBev) opts.unshift({ label: 'Show Bev the 1888 licence', fn: () => { S.showedBev = true; relUp('Bev', 15); Game.closePanel(); bark(n, 'Oh my word. Oh, that changes EVERYTHING. The council can\'t ignore this.', true); } });
  },
  // ---------------------------------------------------------- nightly hooks
  update() {
    const s = Game.state, S = this.st();
    if (VENUE.story && s.day === 6 && !this.meetingDone && s.time >= 20) { this.meetingDone = true; this.meeting(); }
  },
  score() { const S = this.st(), sigs = Object.keys(S.sigs).length + (Game.state.flags.petition ? 1 : 0); return Math.min(6, sigs) + (S.licence ? 3 : 0) + Math.min(3, Math.floor(S.fund / 100)) + Math.min(3, Game.state.flags.goodwill || 0) + (S.letter === 'signed' ? -2 : 0) + (S.bribe2 === 'took' ? -4 : 0); },
  meeting() {
    const S = this.st(), sc = this.score(), there = isInside(player.pos.x, player.pos.z) && player.level === 0;
    S.ending = sc >= 7 ? 'saved' : sc >= 4 ? 'reprieve' : 'sold';
    const sigs = Object.keys(S.sigs).length + (Game.state.flags.petition ? 1 : 0);
    const lines = [
      ['Councillor Hayes', 'Right. We\'re here to decide on the Marsh Living application for the Royal Hotel site.'],
      ['Clive Marsh', 'Forty-two boutique apartments. Jobs. Progress. Frankly this building is past it.'],
      ['Bev', `We've got a petition with ${sigs} signature${sigs === 1 ? '' : 's'}${S.fund ? `, and ${fmt0(S.fund)} raised by the people who drink here` : ''}.`],
      S.licence ? ['Bev', 'And THIS. The original publican\'s licence. Eighteen eighty-eight. This pub is older than Federation.'] : ['Old Mick', 'This pub\'s older than all of us. That ought to count for something.'],
      S.letter === 'signed' ? ['Clive Marsh', 'I also have letters of support from locals. Including one from somebody in this very room.'] : ['Shazza', 'And nobody in here took his dirty money, either!'],
      ['Councillor Hayes', { saved: 'Given the heritage evidence and the community\'s support, council will list the Royal. The application is refused.', reprieve: 'Council will defer the decision for twelve months to look at the heritage question properly.', sold: 'I\'m sorry. Without more support, council can\'t stand in the way of the sale.' }[S.ending]],
    ];
    if (!there) { Game.toast(`📱 <b>Bev:</b> ${S.ending === 'saved' ? 'WE DID IT!!! The Royal is SAVED. Where ARE you?!' : S.ending === 'reprieve' ? 'Twelve months reprieve. We fight on. Missed you there, love.' : 'It\'s over. They\'re selling. Wish you\'d been there.'}`, true); this.finale(); return; }
    Game.fade(0, 0.7); SFX.bell(V3(-9, 2.5, -8), 2);
    if (Cine.council(lines, () => { Game.fade(0.7, 0); this.finale(); })) return;
    let i = 0;
    const next = () => {
      if (i >= lines.length) { Game.closePanel(); Game.fade(0.7, 0); this.finale(); return; }
      const [who, l] = lines[i++];
      Game.openPanel('THE COUNCIL MEETING', `<span style="opacity:.6">The bar is packed. Even the pokies have gone quiet.</span>`, `<p style="font-size:18px;line-height:1.5"><b style="color:var(--gold)">${who}:</b> ${l}</p>`, [{ label: i < lines.length ? 'Continue' : 'And…', fn: next }]);
    };
    next();
  },
  finale() {
    const S = this.st();
    if (S.ending === 'saved') { achieve('saved'); SFX.cheer(V3(-5, 1.5, -8), 3); NPCS.forEach(n => { if (n.role === 'patron') n.cheerT = 3; }); Game.subtitle('<b>The whole pub:</b> ROYAL! ROYAL! ROYAL!', 5); Music.song = 0; Music.level = 1; Game.state.mood = 100; }
    else if (S.ending === 'reprieve') { SFX.cheer(V3(-5, 1.5, -8), 1); Game.subtitle('<b>Bev:</b> Twelve months. We\'ll take it. Drinks are on me — well, one each.', 5); Game.state.mood = Math.min(100, Game.state.mood + 15); }
    else { Game.subtitle('<b>Old Mick:</b> …Well. Last drinks, then.', 5); Game.state.mood = Math.max(0, Game.state.mood - 20); Music.song = 1; }
  },
  // shown in the end-of-week summary
  epilogue() {
    const S = this.st(), f = Game.state.flags, e = S.ending || (this.score() >= 7 ? 'saved' : this.score() >= 4 ? 'reprieve' : 'sold');
    const head = { saved: ['THE ROYAL IS SAVED', 'Council heritage-listed the Royal. With the community fund behind her, Bev put in a bid for the freehold — and got it. The Royal pours on.'], reprieve: ['A TWELVE-MONTH REPRIEVE', 'The council kicked the can down the road. The fight for the Royal goes on, and so do the Thursday raffles.'], sold: ['LAST DRINKS', 'Marsh Living got its apartments. The Royal poured its final beer in March. Somebody nicked the bell on the way out.'] }[e];
    const lines = [
      ['Old Mick', e === 'sold' ? 'Drinks at the RSL now. Says the stools are wrong.' : 'Got his plaque back on the stool. Bolted down this time.'],
      ['Davo', (f.davoGood || 0) >= 3 ? 'Four months off the pokies. Took the kids to the Gold Coast.' : 'Still says she\'s due.'],
      ['Shazza', 'Went to Bali. Came back Tuesday. Telling everyone about it still.'],
      ['Kenno', f.dartTip ? 'Reckons you\'re the only one who\'s ever been worth teaching.' : 'Won the Royal darts comp again. Third title.'],
      ['Spud', 'Finished his apprenticeship. Still owes everyone money.'],
      ['Bev', e === 'saved' ? 'The new licensee of the Royal Hotel. First rule: no suits.' : 'Still runs the raffle. Somewhere.'],
    ];
    return `<div class="epi"><h3>${head[0]}</h3><p>${head[1]}</p><ul>${lines.map(([n, l]) => `<li><b>${n}</b> — ${l}</li>`).join('')}</ul></div>`;
  },
};
ACH_LIST.push(['historian', 'History Buff', 'Find the Royal\'s 1888 licence.'], ['incorruptible', 'Not For Sale', 'Turn down the developer\'s money.'], ['saved', 'Save the Royal', 'Win the council vote and save the pub.']);

// ---- src/18-touch.js ----

// =====================================================================
//  TOUCH CONTROLS: left stick to walk, drag anywhere else to look, context buttons
// =====================================================================
const TOUCH = {
  on: false, mx: 0, my: 0, run: false, stickId: null, lookId: null, lx: 0, ly: 0, mode: '',
  detect() { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0; },
  apply() {
    this.on = settings.touch === 'on' || (settings.touch === 'auto' && this.detect());
    document.body.classList.toggle('touchmode', this.on);
    $('touch').classList.toggle('hidden', !this.on || Game.mode !== 'play');
    if (this.on) { input.locked = true; }
    this.mode = '';
  },
  build() {
    const st = $('tStick'), knob = st.firstElementChild;
    const stickMove = t => { const r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2; let dx = (t.clientX - cx) / R, dy = (t.clientY - cy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.mx = dx; this.my = dy; knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`; };
    st.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; this.stickId = t.identifier; stickMove(t); }, { passive: false });
    addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) { e.preventDefault(); stickMove(t); }
        else if (t.identifier === this.lookId) { e.preventDefault(); input.mx += (t.clientX - this.lx) * 1.7; input.my += (t.clientY - this.ly) * 1.7 * (settings.invertY ? -1 : 1); this.lx = t.clientX; this.ly = t.clientY; }
      }
    }, { passive: false });
    const end = e => { for (const t of e.changedTouches) { if (t.identifier === this.stickId) { this.stickId = null; this.mx = this.my = 0; knob.style.transform = ''; } if (t.identifier === this.lookId) this.lookId = null; } };
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    // drag on the 3D view to look (not while sat at a pokie or scratching a card — those need taps)
    renderer.domElement.addEventListener('touchstart', e => {
      if (!this.on || Game.mode !== 'play' || player.seated || (MG.active && MG.active.cursor)) return;
      const t = e.changedTouches[0]; this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY; e.preventDefault();
    }, { passive: false });
    $('tMenu').onclick = () => { if (Game.mode !== 'play') return; if (!$('panel').classList.contains('hidden')) { Game.closePanel(); return; } Game.paused = true; $('resume').classList.remove('hidden'); };
  },
  // buttons change with what you're doing
  buttons() {
    let mode = 'walk';
    if (Game.mode !== 'play') mode = 'none';
    else if (player.seated) mode = 'pokie';
    else if (MG.active) mode = MG.active === Darts ? 'darts' : MG.active === BarShift ? 'shift' : MG.active === Karaoke ? 'karaoke' : 'mg';
    if (mode === this.mode) return;
    this.mode = mode;
    const B = $('tBtns'); B.innerHTML = '';
    const btn = (label, cls, down, up) => { const b = document.createElement('button'); b.innerHTML = label; b.className = cls || ''; b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); AudioSys.init(); down && down(); }, { passive: false }); b.addEventListener('touchend', e => { e.preventDefault(); b.classList.remove('on'); up && up(); }, { passive: false }); b.onclick = () => { if (!('ontouchstart' in window)) { down && down(); up && up(); } }; B.appendChild(b); return b; };
    const key = code => () => Game.onKey(code);
    $('tStick').style.display = mode === 'walk' ? '' : 'none';
    if (mode === 'walk') {
      btn('USE<small>E</small>', 'big', key('KeyE'));
      btn('SIP', '', key('KeyF')); btn('SMOKE', '', key('KeyC')); btn('DROP', '', key('KeyG'));
      const r = btn('RUN', 'tog', () => { this.run = !this.run; r.classList.toggle('lit', this.run); });
      btn('📱', '', key('Tab'));
    } else if (mode === 'darts') {
      btn('THROW<small>hold, release in the gold</small>', 'big', () => MG.down({ button: 0 }), () => MG.up({ button: 0 }));
      btn('STEADY', '', () => { keys.ShiftLeft = true; }, () => { keys.ShiftLeft = false; });
      btn('QUIT', '', key('KeyQ'));
    } else if (mode === 'shift') {
      btn('POUR<small>hold</small>', 'big', () => MG.down({ button: 0 }), () => MG.up({ button: 0 }));
      btn('POT', '', key('Digit1')); btn('SCHOONER', '', key('Digit2')); btn('PINT', '', key('Digit3'));
      btn('SERVE', '', key('Space')); btn('CLOCK OFF', '', key('KeyQ'));
    } else if (mode === 'karaoke') {
      btn('SING!', 'big huge', key('Space')); btn('QUIT', '', key('KeyQ'));
    } else if (mode === 'mg') {
      btn('DONE', '', key('KeyQ'));
    }
  },
  update() {
    if (!this.on) return;
    $('touch').classList.toggle('hidden', Game.mode !== 'play');
    this.buttons();
  },
};

// ---- src/19-service.js ----

// =====================================================================
//  CASH, THE ATM AND THE JUKEBOX
// =====================================================================
// ---------------------------------------------------------------- banknotes
const NOTE_COL = { 5: ['#e8a8d8', '#a0408a'], 10: ['#7ab0f0', '#1a4aa8'], 20: ['#f08a5a', '#a8301a'], 50: ['#f0d85a', '#a8800a'], 100: ['#7ad8a0', '#1a7a4a'] };
const _noteTex = {};
function noteTex(d) {
  if (_noteTex[d]) return _noteTex[d];
  const [c1, c2] = NOTE_COL[d], c = mkCanvas(256, 128), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 128); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(70, 64, 8 + i * 4, 0, 7); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(70, 64, 26, 32, 0, 0, 7); x.fill();
  x.fillStyle = 'rgba(40,20,40,.45)'; x.beginPath(); x.ellipse(70, 58, 12, 15, 0, 0, 7); x.fill(); x.fillRect(56, 72, 28, 18);
  x.fillStyle = 'rgba(220,240,255,.75)'; x.fillRect(196, 14, 44, 100); // the clear window
  x.fillStyle = '#fff'; x.font = 'bold 44px Bebas Neue, Impact'; x.textAlign = 'right'; x.fillText(d, 188, 50);
  x.font = 'bold 12px Inter, sans-serif'; x.fillText('AUSTRALIA', 188, 112);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (_noteTex[d] = t);
}
function notesFor(amount) { const out = []; let a = Math.round(amount); for (const d of [100, 50, 20, 10, 5]) while (a >= d && out.length < 8) { out.push(d); a -= d; } if (!out.length) out.push(5); return out; }
const noteGeo = new THREE.PlaneGeometry(0.15, 0.075);

const CashFX = {
  vm: null, anim: null,
  build() {
    // a first-person hand holding a fan of notes
    const g = new THREE.Group(); g.visible = false;
    const hand = buildGripHand(0.005, 0.005, 0.03); hand.rotation.set(0, 0, Math.PI / 2); hand.position.set(-0.01, -0.02, 0); g.add(hand);
    this.notes = new THREE.Group(); g.add(this.notes);
    g.traverse(o => { o.frustumCulled = false; });
    vm.root.add(g); this.vm = g;
  },
  fan(amount) {
    while (this.notes.children.length) this.notes.remove(this.notes.children[0]);
    notesFor(amount).slice(0, 5).forEach((d, i, a) => { const m = new THREE.Mesh(noteGeo, new THREE.MeshBasicMaterial({ map: noteTex(d), side: THREE.DoubleSide })); m.rotation.set(-0.15, 0, (i - (a.length - 1) / 2) * 0.18); m.position.set(0.03 + i * 0.006, 0.03, -0.002 * i); this.notes.add(m); });
  },
  // hand the money over (paying at the bar, feeding a pokie)
  pay(amount, style = 'hand') {
    if (!this.vm || player.cig || MG.active || Game.mode !== 'play') return;
    this.fan(amount); this.anim = { t: 0, T: style === 'insert' ? 1.0 : 1.15, style, dir: 1 };
    SFX.noise(0.12, { freq: 3500, q: 1, gain: 0.05 });
  },
  // take money (ATM, winnings)
  receive(amount) {
    if (!this.vm || Game.mode !== 'play') return;
    this.fan(amount); this.anim = { t: 0, T: 1.2, style: 'receive', dir: -1 };
    SFX.noise(0.18, { freq: 3200, q: 1, gain: 0.06 });
  },
  update(dt) {
    const a = this.anim; if (!a || !this.vm) return;
    a.t += dt; const k = clamp(a.t / a.T, 0, 1), up = Math.sin(k * Math.PI);
    const v = this.vm; v.visible = true;
    if (a.style === 'insert') { v.position.set(0.02, -0.32 + up * 0.12, -0.42 - k * 0.12); v.rotation.set(-0.9 * up, 0, 0); v.scale.setScalar(1); this.notes.scale.set(1, 1 - Math.max(0, k - 0.5) * 1.6, 1); }
    else if (a.style === 'receive') { v.position.set(-0.05, -0.45 + up * 0.22, -0.48 + k * 0.1); v.rotation.set(-0.5, 0.2, 0.15 * up); this.notes.scale.set(1, 1, 1); }
    else { v.position.set(-0.04, -0.45 + up * 0.24, -0.4 - up * 0.12); v.rotation.set(-0.6 * up, 0.15, -0.2 * up); this.notes.scale.set(1, 1, 1); this.notes.visible = k < 0.62; }
    if (k >= 1) { this.anim = null; v.visible = false; this.notes.visible = true; }
  },
};

// ---------------------------------------------------------------- the ATM: card, PIN, menu, dispense
const ATM = {
  pos: V3(12.6, 0, -3.3), FEE: 2.5,
  // the machine: charcoal cabinet, lit topper, hooded screen that mirrors what you're doing, keypad deck, slots
  build(ax, az) {
    const g = new THREE.Group(); g.position.set(ax, 0, az); g.rotation.y = -Math.PI / 2; scene.add(g); this.root = g;   // local +z faces the room
    const body = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.55 }), dark = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.3, metalness: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x0b4fb3, roughness: 0.35, metalness: 0.3 }), steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.22, metalness: 1 });
    interiorMats.push(body, dark, blue, steel);
    const add = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    const rb = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, r);
    add(rb(0.64, 0.08, 0.56, 0.01), dark, 0, 0.04, 0);                        // plinth
    add(rb(0.62, 0.92, 0.55), body, 0, 0.52, 0);                               // lower safe
    add(rb(0.62, 0.62, 0.42), body, 0, 1.28, -0.065);                         // upper head, set back
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.012, 1.5, 0.5), blue, sx * 0.311, 0.78, -0.02);   // brand stripes down the sides
    // lit topper
    add(rb(0.64, 0.2, 0.46), blue, 0, 1.69, -0.06);
    const topT = signTex(['ATM', 'ROYAL CREDIT UNION'], { w: 512, h: 160, bg: ['#1065e0', '#0a3c8e'], color: '#fff', sizes: [86, 26] });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.18), new THREE.MeshBasicMaterial({ map: topT, toneMapped: false })); top.material.color.setScalar(1.4); top.position.set(0, 1.69, 0.172); g.add(top);
    // screen hood + screen (tilted back a touch)
    add(rb(0.46, 0.38, 0.1, 0.015), dark, 0, 1.33, 0.17, -0.12);
    const c = mkCanvas(512, 400); this.scr = { c, tex: canvasTex(c, 1, 1) };
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), new THREE.MeshBasicMaterial({ map: this.scr.tex, toneMapped: false })); scr.position.set(0, 1.335, 0.222); scr.rotation.x = -0.12; g.add(scr);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.3), new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.03, metalness: 1, transparent: true, opacity: 0.18, depthWrite: false })); glass.position.set(0, 1.335, 0.224); glass.rotation.x = -0.12; g.add(glass);
    // keypad deck: angled shelf with a printed keypad
    add(rb(0.62, 0.05, 0.22, 0.01), body, 0, 1.0, 0.27, 0.35);
    const kc = mkCanvas(256, 160), k = kc.getContext('2d');
    k.fillStyle = '#1a1c20'; k.fillRect(0, 0, 256, 160);
    const keys = ['1', '2', '3', 'X', '4', '5', '6', '<', '7', '8', '9', 'O', '', '0', '', ''];
    keys.forEach((t, i) => { const cx = 18 + (i % 4) * 58, cy = 8 + Math.floor(i / 4) * 37; if (i === 12 || i === 14 || i === 15) return;
      k.fillStyle = t === 'X' ? '#c0282d' : t === '<' ? '#d6b21c' : t === 'O' ? '#1f9a46' : '#9ea3ab'; k.fillRect(cx, cy, 48, 30); k.fillStyle = 'rgba(255,255,255,.35)'; k.fillRect(cx, cy, 48, 4);
      k.fillStyle = t === 'X' || t === 'O' ? '#fff' : '#111'; k.font = 'bold 20px sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(t, cx + 24, cy + 16); });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125), new THREE.MeshStandardMaterial({ map: canvasTex(kc, 1, 1), roughness: 0.4, metalness: 0.4 })); pad.position.set(-0.04, 1.03, 0.27); pad.rotation.x = -Math.PI / 2 + 0.35; g.add(pad);
    add(new THREE.BoxGeometry(0.26, 0.05, 0.012), steel, -0.04, 1.075, 0.2, -0.2);   // privacy shield lip behind the keypad
    // card slot with a breathing green light, receipt slot
    add(new THREE.BoxGeometry(0.11, 0.035, 0.03), dark, 0.2, 1.06, 0.31, 0.35);
    this.cardLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.006), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2, 0.6), toneMapped: false })); this.cardLed.position.set(0.2, 1.076, 0.33); this.cardLed.rotation.x = 0.35; g.add(this.cardLed);
    add(new THREE.BoxGeometry(0.1, 0.012, 0.012), dark, 0.2, 0.97, 0.36);
    // cash slot: steel bezel, black mouth, amber light
    add(rb(0.3, 0.07, 0.03, 0.008), steel, 0, 0.86, 0.285);
    add(new THREE.BoxGeometry(0.22, 0.022, 0.02), dark, 0, 0.86, 0.297);
    this.cashLed = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.006, 0.004), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.2, 0.05), toneMapped: false })); this.cashLed.position.set(0, 0.84, 0.302); g.add(this.cashLed);
    // safe door seam, lock and a sticker
    add(new THREE.BoxGeometry(0.5, 0.004, 0.004), dark, 0, 0.72, 0.277); add(new THREE.BoxGeometry(0.004, 0.62, 0.004), dark, 0.25, 0.41, 0.277);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), steel, 0.2, 0.5, 0.28, Math.PI / 2);
    const stT = signTex(['FEE $2.50', 'per withdrawal'], { w: 256, h: 128, bg: ['#f2c230', '#e0a81a'], color: '#1a1405', sizes: [44, 22] });
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.085), new THREE.MeshStandardMaterial({ map: stT, roughness: 0.6 })); st.position.set(-0.13, 0.62, 0.277); g.add(st);
    this.slot = V3(ax - 0.29, 0.86, az);
    this.drawScreen(); this.scrT = 0;
  },
  // the 3D screen mirrors the panel, so the machine looks alive from across the room
  drawScreen() {
    if (!this.scr) return;
    const x = this.scr.c.getContext('2d'), W = 512, H = 400, st = this.st || null, t = performance.now() / 1000;
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0f4fae'); gr.addColorStop(1, '#06224f'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, 0, W, 54); x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('ROYAL CREDIT UNION', W / 2, 28);
    const stage = this.disp ? 'take' : this.active ? st && st.stage : 'idle';
    const msg = { idle: ['WELCOME', 'Insert your card to begin'], card: ['WELCOME', 'Please insert your card'], reading: ['PLEASE WAIT', 'Reading card…'], pin: ['ENTER PIN', '●'.repeat(st ? st.pin.length : 0) + '○'.repeat(4 - (st ? st.pin.length : 0))], menu: ['SELECT', 'Withdrawal · Balance'], balance: ['BALANCE', st ? fmt$(Game.state.bank) : ''], amount: ['WITHDRAWAL', 'Select an amount'], confirm: ['FEE NOTICE', `$${this.FEE.toFixed(2)} fee applies`], processing: ['PROCESSING', 'Please wait…'], take: ['PLEASE TAKE', 'YOUR CASH'] }[stage] || ['WELCOME', ''];
    x.font = 'bold 60px sans-serif'; x.fillText(msg[0], W / 2, 170); x.font = '32px sans-serif'; x.fillStyle = '#cfe0ff'; x.fillText(msg[1], W / 2, 240);
    if (stage === 'idle' && Math.sin(t * 3) > 0) { x.fillStyle = '#ffd34d'; x.beginPath(); x.moveTo(W / 2 - 18, 300); x.lineTo(W / 2 + 18, 300); x.lineTo(W / 2, 330); x.fill(); }
    if (stage === 'processing' || stage === 'reading') { x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(W / 2, 315, 22, t * 6, t * 6 + 4.2); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '16px sans-serif'; x.fillText('Visa · Mastercard · eftpos · fees apply', W / 2, H - 22);
    this.scr.tex.needsUpdate = true;
  },
  open() {
    const s = Game.state; this.st = { stage: 'card', pin: '', amt: 0 };
    const wrap = document.createElement('div'); wrap.className = 'atm';
    wrap.innerHTML = `<div class="atmscr"><div class="atmhead">ROYAL CREDIT UNION · ATM 2047</div><div class="atmbody"></div></div>
      <div class="atmpad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CANCEL', '0', 'ENTER'].map(k => `<button data-k="${k}" class="${isNaN(+k) ? 'w ' + k.toLowerCase() : ''}">${k}</button>`).join('')}</div>`;
    this.el = wrap;
    wrap.querySelectorAll('.atmpad button').forEach(b => b.onclick = () => this.key(b.dataset.k));
    Game.openPanel('ATM', 'Royal Credit Union · this machine charges $2.50 per withdrawal', wrap, []);
    this.active = true; this.render(); SFX.beep();
  },
  render() {
    const s = Game.state, st = this.st, body = this.el.querySelector('.atmbody'); this.drawScreen();
    const opt = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'atmopt ' + cls; b.innerHTML = label; b.onclick = () => { SFX.beep(); fn(); }; return b; };
    body.innerHTML = '';
    if (st.stage === 'card') { body.innerHTML = '<p class="big">WELCOME</p><p>Please insert your card</p><div class="cardslot"></div>'; body.appendChild(opt('Insert card ▸', () => { SFX.noise(0.4, { freq: 600, q: 1, gain: 0.08 }); st.stage = 'reading'; this.render(); setTimeout(() => { st.stage = 'pin'; this.render(); }, 900); })); }
    else if (st.stage === 'reading') body.innerHTML = '<p class="big">READING CARD…</p><div class="spin"></div>';
    else if (st.stage === 'pin') body.innerHTML = `<p>Enter your PIN, then press ENTER</p><p class="pin">${'●'.repeat(st.pin.length)}${'○'.repeat(4 - st.pin.length)}</p><p class="small">Cover the keypad when entering your PIN</p>`;
    else if (st.stage === 'menu') { body.innerHTML = '<p>Select a transaction</p>'; const g = document.createElement('div'); g.className = 'atmgrid'; g.append(opt('Withdrawal', () => { st.stage = 'amount'; this.render(); }), opt('Balance', () => { st.stage = 'balance'; this.render(); }), opt('Cancel', () => this.close())); body.appendChild(g); }
    else if (st.stage === 'balance') { body.innerHTML = `<p>Available balance</p><p class="big">${fmt$(s.bank)}</p><p class="small">Withdrawn today: ${fmt0(s.night.atm || 0)} of $500 limit</p>`; body.appendChild(opt('Back', () => { st.stage = 'menu'; this.render(); })); }
    else if (st.stage === 'amount') {
      body.innerHTML = '<p>Select amount</p>'; const g = document.createElement('div'); g.className = 'atmgrid';
      for (const a of [20, 50, 100, 200, 300, 500]) g.appendChild(opt(fmt0(a), () => { st.amt = a; st.stage = 'confirm'; this.render(); }, s.bank < a + this.FEE || (s.night.atm || 0) + a > 500 ? 'off' : ''));
      body.appendChild(g); body.appendChild(opt('Back', () => { st.stage = 'menu'; this.render(); }));
    } else if (st.stage === 'confirm') {
      const bad = s.bank < st.amt + this.FEE ? 'Insufficient funds.' : (s.night.atm || 0) + st.amt > 500 ? 'Daily limit of $500 exceeded.' : null;
      if (bad) { body.innerHTML = `<p class="big err">${bad}</p>`; body.appendChild(opt('Back', () => { st.stage = 'amount'; this.render(); })); return; }
      body.innerHTML = `<p>This ATM operator charges a fee of <b>${fmt$(this.FEE)}</b> for this withdrawal.</p><p class="big">${fmt0(st.amt)} + ${fmt$(this.FEE)}</p><p>Do you accept?</p>`;
      const g = document.createElement('div'); g.className = 'atmgrid'; g.append(opt('Accept', () => this.withdraw()), opt('Decline', () => { st.stage = 'menu'; this.render(); })); body.appendChild(g);
    } else if (st.stage === 'processing') body.innerHTML = '<p class="big">PROCESSING…</p><p>Please wait</p><div class="spin"></div>';
    else if (st.stage === 'take') { body.innerHTML = '<p class="big">PLEASE TAKE YOUR CASH</p><p>Then take your card</p>'; }
  },
  key(k) {
    const st = this.st; SFX.tone(1300, 0.06, { gain: 0.05, type: 'square' });
    if (k === 'CANCEL') { this.close(); return; }
    if (st.stage === 'pin') {
      if (/\d/.test(k) && st.pin.length < 4) st.pin += k;
      if (k === 'ENTER' && st.pin.length === 4) { st.stage = 'reading'; this.render(); setTimeout(() => { st.stage = 'menu'; this.render(); }, 700); return; }
      this.render();
    }
  },
  withdraw() {
    const s = Game.state, st = this.st, a = st.amt;
    s.bank -= a + this.FEE; s.night.atm = (s.night.atm || 0) + a; s.night.fees += this.FEE; s.stats.atmFees += this.FEE;
    st.stage = 'processing'; this.render(); SFX.atm();
    setTimeout(() => { st.stage = 'take'; this.render(); setTimeout(() => { this.active = false; Game.closePanel(); this.dispense(a); }, 600); }, 1500);
  },
  close() { this.active = false; this.drawScreen(); Game.closePanel(); SFX.noise(0.3, { freq: 600, q: 1, gain: 0.06 }); },
  // notes slide out of the slot, then you take them
  dispense(a) {
    const slot = (this.slot || V3(this.pos.x - 0.29, 0.86, this.pos.z)).clone();
    const stack = new THREE.Group(); scene.add(stack);
    notesFor(a).forEach((d, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.002, 0.075), [0, 1, 2, 3, 4, 5].map(f => f === 2 || f === 3 ? new THREE.MeshStandardMaterial({ map: noteTex(d), roughness: 0.7 }) : new THREE.MeshStandardMaterial({ color: NOTE_COL[d][0], roughness: 0.7 }))); m.position.y = i * 0.0025; m.rotation.y = rand(-0.05, 0.05); stack.add(m); });
    stack.position.copy(slot); stack.rotation.y = -Math.PI / 2;   // notes read the right way up from the front
    this.disp = { stack, t: 0, a, from: slot.clone(), state: 'out' };
    for (let i = 0; i < 14; i++) SFX.noise(0.04, { delay: 0.1 + i * 0.05, freq: 2200, q: 2, gain: 0.05, pos: slot });
    const ia = addInteract({ id: 'cash', temp: true, pos: slot.clone().add(V3(-0.1, 0.1, 0)), r: 2.4, label: () => `Take your ${fmt0(a)}`, action: () => { interactables.splice(interactables.indexOf(ia), 1); this.disp.state = 'take'; this.disp.t = 0; } });
    this.disp.ia = ia;
    setTimeout(() => { if (this.disp && this.disp.state === 'out') { interactables.splice(interactables.indexOf(ia), 1); this.disp.state = 'take'; this.disp.t = 0; } }, 6000);
  },
  update(dt) {
    // screen + lights tick over a few times a second; the cash light flashes while notes are waiting
    this.scrT = (this.scrT || 0) + dt; if (this.scrT > 0.2) { this.scrT = 0; if ($('panel').classList.contains('hidden')) this.active = false; this.drawScreen(); }
    const tt = performance.now() / 1000;
    if (this.cardLed) this.cardLed.material.color.setRGB(0.2, 1.1 + Math.sin(tt * 3) * 0.9, 0.5);
    if (this.cashLed) this.cashLed.material.color.setRGB(this.disp ? (Math.sin(tt * 10) > 0 ? 2.4 : 0.4) : 0.3, this.disp ? (Math.sin(tt * 10) > 0 ? 1.5 : 0.25) : 0.2, 0.05);
    const d = this.disp; if (!d) return;
    d.t += dt;
    if (d.state === 'out') { const k = easeOut(clamp(d.t / 0.9, 0, 1)); d.stack.position.copy(d.from).add(V3(-0.1 * k, 0, 0)); }
    else if (d.state === 'take') {
      const k = clamp(d.t / 0.35, 0, 1), cam = camera.position.clone().add(V3(0, -0.25, 0));
      d.stack.position.lerp(cam, k * 0.5);
      if (k >= 1) { scene.remove(d.stack); const s = Game.state; s.wallet += d.a; CashFX.receive(d.a); Game.toast(`Took ${fmt0(d.a)} from the ATM (${fmt$(this.FEE)} fee).`); this.disp = null; }
    }
  },
};

// ---------------------------------------------------------------- the jukebox
const Juke = {
  build() {
    const c = mkCanvas(512, 512); this.screen = { c, tex: canvasTex(c, 1, 1) };
    const jx = 1.6, jz = -17.45;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshBasicMaterial({ map: this.screen.tex, toneMapped: false })); m.material.color.setScalar(1.3); m.position.set(jx, 1.05, jz + 0.315); scene.add(m);
    this.lastSong = -1; this.draw(0);
  },
  draw(t) {
    const x = this.screen.c.getContext('2d'), W = 512, S = Music.SONGS[Music.song] || Music.SONGS[0];
    const g = x.createLinearGradient(0, 0, W, W); g.addColorStop(0, '#ff8a2a'); g.addColorStop(0.5, '#d01a6a'); g.addColorStop(1, '#3a1aa8'); x.fillStyle = g; x.fillRect(0, 0, W, W);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(30, 150, W - 60, 220);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '62px Bungee, Impact'; x.fillText('JUKEBOX', W / 2, 90);
    x.font = '22px Inter, sans-serif'; x.fillStyle = '#ffd84a'; x.fillText('♫ NOW PLAYING ♫', W / 2, 195);
    x.fillStyle = '#fff'; let fs = 44; x.font = `bold ${fs}px Inter, sans-serif`; while (x.measureText(S.name).width > W - 90 && fs > 20) { fs -= 2; x.font = `bold ${fs}px Inter, sans-serif`; } x.fillText(S.name, W / 2, 262);
    x.font = '24px Inter, sans-serif'; x.fillStyle = '#ddd'; x.fillText(S.file ? S.artist : 'The Royal House Band', W / 2, 305);
    for (let i = 0; i < 24; i++) { const h = 10 + Math.abs(Math.sin(t * 6 + i * 0.7) * Math.cos(t * 2.3 + i)) * 40; x.fillStyle = `hsl(${i * 15},90%,65%)`; x.fillRect(48 + i * 17.5, 345 - h * 0.5, 12, h * 0.5); }
    x.fillStyle = '#fff'; x.font = '30px Bebas Neue, Impact'; x.fillText('$2 A SONG · PICK ONE', W / 2, 440);
    this.screen.tex.needsUpdate = true;
  },
  update(dt) { this.t = (this.t || 0) + dt; if (camera.position.distanceTo(V3(1.6, 1.2, -17.45)) < 12 && Game.frameN % 6 === 0) this.draw(this.t); },
  open() {
    const s = Game.state;
    const list = Music.SONGS.map((sg, i) => ({ sg, i })).sort((a, b) => (b.sg.file ? 1 : 0) - (a.sg.file ? 1 : 0));
    const wrap = document.createElement('div'); wrap.className = 'opts juke';
    for (const { sg, i } of list) {
      const b = document.createElement('button'); b.className = 'opt' + (Music.song === i ? ' playing' : '');
      b.innerHTML = `<span>${Music.song === i ? '▶ ' : ''}${sg.name}<span class="d">${sg.file ? `${sg.artist} · ${sg.feel}` : `The Royal House Band · ${sg.bpm} bpm ${sg.feel}`}</span></span><span class="price">$2.00</span>`;
      b.onclick = () => { SFX.click(); if (!Game.spend(2)) return; s.night.extra -= 2; Music.song = i; Music.level = 0.95; s.mood = Math.min(100, s.mood + 4); SFX.coin(V3(1.6, 1.0, -17.2)); Game.toast('♫ ' + sg.name + (sg.file ? ' — ' + sg.artist : '')); Game.closePanel(); };
      wrap.appendChild(b);
    }
    Game.openPanel('JUKEBOX', `Now playing: <b>${Music.SONGS[Music.song].name}</b> · two bucks a song`, wrap);
  },
};

// ---- src/20-pokiefx.js ----

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
    // button geometry: the cap's top face is the legend (a box with the label on +z), sat in a thin chrome bezel
    this.capGeo = new THREE.BoxGeometry(0.066, 0.068, 0.01); this.bezGeo = new RoundedBoxGeometry(0.08, 0.082, 0.008, 2, 0.004);
    this._legend = {};
    addEventListener('mousemove', e => { this.mx = e.clientX / innerWidth * 2 - 1; this.my = e.clientY / innerHeight * 2 - 1; });
  },
  attach(m) {
    this.detach();
    this.m = m; const g = new THREE.Group(); m.root.add(g); this.group = g;
    const th = m.game.theme;
    this.ledMat.uniforms.uA.value.set(th.glow); this.ledMat.uniforms.uB.value.set(th.accent);
    // LED light bars hugging the screen and down the cabinet sides, plus an arc over the topper
    const bar = (w, h, x, y, z, rz = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.ledMat); p.position.set(x, y, z); p.rotation.z = rz; p.renderOrder = 4; g.add(p); return p; };
    const D = m.dims || _STD_DIMS;
    for (const s of [-1, 1]) { bar(0.03, D.h + 0.18, s * (D.w / 2 + 0.032), D.cy, 0.05); bar(0.026, 0.9, s * 0.338, 0.62, 0.315); }
    bar(0.03, D.w + 0.08, 0, D.cy + D.h / 2 + 0.05, 0.05, Math.PI / 2); bar(0.03, D.w + 0.08, 0, D.cy - D.h / 2 - 0.05, 0.05, Math.PI / 2);
    // glass + glare over the screen
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(D.w + 0.02, D.h + 0.02), this.glassMat); glass.position.set(0, D.cy, 0.047); glass.renderOrder = 3; g.add(glass);
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(D.w + 0.02, D.h + 0.02), this.glareMat); glare.position.set(0, D.cy, 0.049); glare.renderOrder = 4; g.add(glare); this.glare = glare;
    // real illuminated push-buttons on the deck: a chrome bezel, a solid lit cap and its printed legend
    this.caps = [];
    for (const b of DECK_BTNS) {
      const x = (b.x / 512 - 0.5) * 0.62, y = (0.5 - 178 / 264) * 0.32;
      const bez = new THREE.Mesh(this.bezGeo, MAT.chrome); bez.position.set(x, y, 0.003); m.deck.add(bez); this.caps.push(bez);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: this.legend(b), emissive: 0xffffff, emissiveMap: this.legend(b), emissiveIntensity: 0.45, roughness: 0.2, metalness: 0 });
      const cap = new THREE.Mesh(this.capGeo, mat); cap.position.set(x, y, 0.009); m.deck.add(cap); cap.userData.id = b.id; cap.userData.lit = true; this.caps.push(cap);
    }
    // this machine's SPIN gets its own material so its pulse doesn't light up the whole room's machines
    if (m.btns[5]) { this.spinShared = m.btns[5].material; m.btns[5].material = this.spinShared.clone(); }
    // note acceptor bezel that blinks green
    this.acceptor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 0.6), toneMapped: false })); this.acceptor.position.set(0.2, 0.89, 0.342); g.add(this.acceptor);
    // the screen's own light
    m.screenW && this.light.position.copy(m.screenW).addScaledVector(m.fw, 0.45).add(V3(0, -0.1, 0));
    this.light.color.set(th.glow); this.flash = 0;
  },
  detach() {
    if (!this.m) return;
    this.m.root.remove(this.group); this.caps.forEach(c => { this.m.deck.remove(c); if (c.material !== MAT.chrome) c.material.dispose(); });
    if (this.spinShared && this.m.btns[5]) { this.m.btns[5].material.dispose(); this.m.btns[5].material = this.spinShared; this.spinShared = null; }
    this.group.traverse(o => { if (o.geometry && o.geometry !== MGEO.screen) o.geometry.dispose(); }); this.caps = [];
    this.m = null; this.light.intensity = 0; this.shake = 0;
  },
  // printed legend for a deck button: glossy gradient in the button's colour with its label
  legend(b) {
    if (this._legend[b.id]) return this._legend[b.id];
    const c = mkCanvas(128, 128), x = c.getContext('2d');
    x.fillStyle = lg(x, 0, 0, 0, 128, ['#ffffff', b.c, b.c]); x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(64, 22, 54, 16, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122);
    x.fillStyle = '#111'; x.font = 'bold 26px Inter, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const words = b.label.split(' '); words.forEach((w, i) => x.fillText(w, 64, 70 + (i - (words.length - 1) / 2) * 28, 116));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    return (this._legend[b.id] = t);
  },
  celebrate(level) { this.shake = Math.min(1, 0.4 + level / 60); this.flash = 1; this.burstT = 2.5 + Math.min(4, level / 20); },
  press(id) { const c = this.caps && this.caps.find(c => c.userData.id === id); if (c) { c.position.z = 0.004; c.userData.pressT = 0.14; } },
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
    for (const c of this.caps) {
      const id = c.userData.id; if (!id) continue;
      const on = id === 'gamble' ? (m.gambleOK && m.lastWin > 0 && st === 'showWin') : id === 'collect' ? m.credit > 0 : true;
      if (c.userData.pressT > 0) { c.userData.pressT -= dt; if (c.userData.pressT <= 0) c.position.z = 0.009; }
      const pulse = id === 'gamble' && on ? 0.5 + 0.5 * Math.sin(this.t * 8) : 0;
      c.material.emissiveIntensity = damp(c.material.emissiveIntensity, c.userData.pressT > 0 ? 1.6 : on ? 0.45 + pulse : 0.04, 14, dt);
      c.material.color.setScalar(on ? 1 : 0.35);
    }
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

// ---- src/21-night.js ----

// =====================================================================
//  NIGHT DIRECTOR: the shape of an evening, nightly goals, your standing at the Royal,
//  the bar tab, and the log that feeds the end-of-night summary.
//  (Night Moments, the one-off events, live in 22-moments.js)
// =====================================================================
const STANDING = [
  { name: 'Blow-in', at: 0, perk: null },
  { name: 'Local', at: 15, perk: 'You can run a tab at the bar (up to $40).' },
  { name: 'Familiar Face', at: 30, perk: 'Mates\' rates: 50c off every drink.' },
  { name: 'Regular', at: 50, perk: 'Bigger tab ($120) and "The usual" one-tap orders.' },
  { name: 'Local Legend', at: 70, perk: 'Your own set of darts (steadier) and a free schooner every night.' },
  { name: 'Royal Royalty', at: 85, perk: 'Your name on the brass plaque behind the bar.' },
];
// goals: 'live' ones tick over as you play, 'end' ones are judged when you leave
const GOALS = [
  { id: 'mates', text: 'Have a yarn with 3 different locals', cash: 10, rep: 3, prog: (s, n) => `${Object.keys(n.talked).length}/3`, test: (s, n) => Object.keys(n.talked).length >= 3 },
  { id: 'shout', text: 'Shout someone a drink', cash: 0, rep: 4, test: (s, n) => n.shouted },
  { id: 'feed', text: 'Get a proper feed in you', cash: 5, rep: 2, test: (s, n) => n.ate },
  { id: 'water', text: 'Have a water between drinks', cash: 5, rep: 2, test: (s, n) => n.water },
  { id: 'darts', text: 'Beat someone at darts', cash: 25, rep: 5, test: (s, n) => n.dartsWon },
  { id: 'tab', text: 'Back a horse at the TAB', cash: 10, rep: 2, test: (s, n) => n.horse },
  { id: 'tip', text: 'Tip the bartender', cash: 0, rep: 3, test: (s, n) => n.tipped },
  { id: 'garden', text: 'Check out the beer garden', cash: 5, rep: 2, test: (s, n) => n.visited.garden },
  { id: 'trivia', text: 'Get 4 out of 5 at trivia', cash: 20, rep: 4, avail: s => s.event === 'trivia', test: (s, n) => n.triviaScore >= 4 },
  { id: 'sing', text: 'Get up and sing karaoke', cash: 15, rep: 4, avail: s => s.event === 'knockoff' || s.day === 4, test: (s, n) => n.sang },
  { id: 'sober', text: 'Leave without ever getting past "Tipsy"', cash: 20, rep: 4, type: 'end', prog: (s, n) => n.maxDrunk < 50 ? 'on track' : 'blown', test: (s, n) => n.maxDrunk < 50 },
  { id: 'ahead', text: 'Walk out ahead on the pokies', cash: 15, rep: 3, type: 'end', avail: s => s.day !== 2, prog: (s, n) => n.wagered > 0 ? `${fmt$(n.won - n.wagered)}` : 'play a few', test: (s, n) => n.wagered > 0 && n.won >= n.wagered },
  { id: 'frugal', text: 'Spend less than $60 all night', cash: 15, rep: 3, type: 'end', prog: (s, n) => `${fmt0(n.spentDrinks + n.spentFood + n.wagered - n.won)}`, test: (s, n) => n.spentDrinks + n.spentFood + Math.max(0, n.wagered - n.won) < 60 },
  { id: 'early', text: 'Be on your way home before 10pm', cash: 20, rep: 3, type: 'end', prog: s => Game.clockText(), test: s => s.time < 22 },
];
const Night = {
  house: 0, dark: 0, banner_t: 0,
  // ---------------------------------------------------------- standing
  rep() { return clamp((Game.state.flags.rep || 0), 0, 100); },
  tierIdx(r = this.rep()) { let k = 0; STANDING.forEach((t, i) => { if (r >= t.at) k = i; }); return k; },
  tier() { return STANDING[this.tierIdx()]; },
  addRep(k, why) {
    const f = Game.state.flags, was = this.tierIdx(); f.rep = clamp((f.rep || 0) + k, 0, 100);
    const now = this.tierIdx();
    if (why) this.log(k >= 0 ? '★' : '▼', `${why} (${k >= 0 ? '+' : ''}${Math.round(k * 10) / 10} standing)`);
    if (now > was) {
      const T = STANDING[now];
      this.log('★', `New standing: ${T.name}`);
      Game.toast(`<small style="display:block;font-size:12px;letter-spacing:3px;opacity:.7">STANDING UP</small>${T.name.toUpperCase()}`, true);
      if (T.perk) setTimeout(() => Game.toast('Perk unlocked: ' + T.perk), 1200);
      [523, 659, 784, 1047].forEach((fq, i) => SFX.tone(fq, 0.5, { delay: i * 0.1, gain: 0.07, type: 'triangle' }));
      if (now >= 5) achieve('royalty');
      this.refreshPlaque();
    } else if (now < was) Game.toast(`Your standing at the Royal slipped: ${STANDING[now].name}.`);
  },
  hasPerk(i) { return this.tierIdx() >= i; },
  // ---------------------------------------------------------- tab
  tabLimit() { return this.hasPerk(3) ? 120 : this.hasPerk(1) ? 40 : 0; },
  tab() { return Game.state.flags.tab || 0; },
  tabOK(amt) { return this.tab() + amt <= this.tabLimit() + 1e-9; },
  tabAdd(amt) { Game.state.flags.tab = this.tab() + amt; },
  settleTab() {
    const s = Game.state, owed = this.tab(); if (owed <= 0) return '';
    let rest = owed; const fromBank = Math.min(s.bank, rest); s.bank -= fromBank; rest -= fromBank;
    const fromW = Math.min(s.wallet, rest); s.wallet -= fromW; rest -= fromW;
    s.flags.tab = Math.round(rest * 100) / 100;
    if (rest > 0.01) { this.addRep(-8, `Couldn't clear the tab (${fmt$(rest)} still owing)`); return `<p class="neg">Tab: you paid ${fmt$(owed - rest)} of ${fmt$(owed)}. ${fmt$(rest)} carries over and ${bartender.name} noticed.</p>`; }
    this.addRep(1.5, 'Tab cleared'); return `<p class="pos">Tab of ${fmt$(owed)} settled from the account. ${bartender.name} gives you a nod.</p>`;
  },
  // ---------------------------------------------------------- log (feeds the summary)
  log(icon, text) { const n = Game.state.night; if (!n || !n.log) return; n.log.push({ icon, text, t: Game.state.time }); },
  // ---------------------------------------------------------- nightly set-up
  start() {
    const s = Game.state, n = s.night;
    Object.assign(n, { maxDrunk: 0, talked: {}, ate: false, water: false, dartsWon: false, shouted: false, tipped: false, visited: {}, horse: false, triviaScore: 0, sang: false, log: [], relStart: Object.assign({}, s.rel), repStart: this.rep(), tabStart: this.tab(), freeUsed: false });
    // three goals: one social, one skill/activity, one end-of-night
    const ok = g => !g.avail || g.avail(s);
    const pick = (list, k) => list.filter(ok).sort(() => Math.random() - 0.5).slice(0, k);
    const social = ['mates', 'shout', 'tip', 'garden', 'water'].map(id => GOALS.find(g => g.id === id)), skill = GOALS.filter(g => ['feed', 'darts', 'tab', 'trivia', 'sing'].includes(g.id));
    const end = GOALS.filter(g => g.type === 'end');
    const sel = [...pick(social, 1), ...pick(skill.filter(g => g.avail), 1).concat(pick(skill.filter(g => !g.avail), 1)).slice(0, 1), ...pick(end, 1)];
    // event-specific goals win a slot when they exist (trivia on Wednesday, karaoke on Friday)
    s.tonight.goals = sel.map(g => ({ id: g.id, done: false, failed: false }));
    this.beat = 0; this.beatsDone = {}; this.house = 0; this.dark = 0; this.rushed = false; this.lastCalled = false; this.tickT = 0;
    if (!this.plaqueBuilt) this.buildPlaque();
    this.refreshPlaque(); this.hud(true);
    Moments.plan();
  },
  goalDef(id) { return GOALS.find(g => g.id === id); },
  // an in-game thing happened: remember it and re-judge
  ev(name, v = true) {
    const n = Game.state.night; if (!n || !n.log) return;
    if (name === 'talk') n.talked[v] = 1; else if (name === 'trivia') n.triviaScore = v; else if (name === 'visit') n.visited[v] = 1; else n[name] = v;
    this.judge();
  },
  judge() {
    const s = Game.state, n = s.night, gs = s.tonight.goals; if (!gs) return;
    for (const g of gs) {
      const d = this.goalDef(g.id); if (g.done || g.failed || d.type === 'end') continue;
      if (d.test(s, n)) this.complete(g, d);
    }
  },
  complete(g, d) {
    const s = Game.state; g.done = true; g.paid = true;
    if (d.cash) { s.wallet += d.cash; s.night.extra += d.cash; }
    this.addRep(d.rep);
    this.log('✔', `Goal: ${d.text}${d.cash ? ` (+${fmt0(d.cash)})` : ''}`);
    Game.toast(`<small style="display:block;font-size:12px;letter-spacing:3px;opacity:.7">GOAL COMPLETE</small>${d.text}${d.cash ? ` · +${fmt0(d.cash)}` : ''}`, true);
    [659, 880, 1109].forEach((fq, i) => SFX.tone(fq, 0.3, { delay: i * 0.08, gain: 0.06, type: 'triangle' }));
    this.hud(true);
  },
  // end-of-night: judge the 'end' goals, pay out, adjust standing for how the night went. Returns summary html.
  finish(reason) {
    const s = Game.state, n = s.night, gs = s.tonight.goals || [];
    const early = s.time < 22 && s.drunk < 35 && ['home', 'taxi', 'room'].includes(reason);
    const rows = [];
    for (const g of gs) {
      const d = this.goalDef(g.id);
      if (d.type === 'end' && !g.done) {
        const good = !['kicked'].includes(reason) && d.test(s, n);
        if (good) { g.done = true; if (d.cash) { s.bank += d.cash; n.extra += d.cash; } this.addRep(d.rep); this.log('✔', `Goal: ${d.text}${d.cash ? ` (+${fmt0(d.cash)} to the account)` : ''}`); } else g.failed = true;
      }
      rows.push(`<li class="${g.done ? 'ok' : 'no'}"><span>${g.done ? '✔' : '✘'}</span>${d.text}${g.done && d.cash ? `<b>+${fmt0(d.cash)}</b>` : ''}</li>`);
    }
    if (reason === 'kicked') this.addRep(-10, 'Turfed out by the bouncer');
    else if (early) this.addRep(3, 'Called it early and sober');
    else if (s.drunk < 35 && ['home', 'taxi', 'room', 'close'].includes(reason)) this.addRep(1, 'Held your drink');
    if (n.glasses >= 3) this.addRep(-3, 'Smashed three glasses');
    // relationships that moved tonight
    const moved = [];
    for (const k in REGULARS) { const a = rel(k), b = n.relStart[k] || 0, d = Math.round((a - b) / 5); if (d !== 0) moved.push(`<span class="${d > 0 ? 'ok' : 'no'}">${k} ${d > 0 ? '▲' : '▼'}</span>`); }
    const T = this.tier(), next = STANDING[this.tierIdx() + 1], gain = this.rep() - n.repStart;
    const bar = next ? Math.round((this.rep() - T.at) / (next.at - T.at) * 100) : 100;
    const log = n.log.filter(l => !/standing\)$/.test(l.text) || /^New/.test(l.text)).slice(-6);
    const hh = h => { const hr = Math.floor(h) % 24, m = Math.floor((h % 1) * 60); return `${hr % 12 === 0 ? 12 : hr % 12}:${String(m).padStart(2, '0')}${hr >= 12 ? 'pm' : 'am'}`; };
    return `<div class="nsum">
      <div class="nsgoals"><h4>TONIGHT'S GOALS</h4><ul>${rows.join('')}</ul></div>
      <div class="nsrep"><h4>YOUR STANDING</h4><div class="nsname">${T.name}<small>${gain >= 0 ? '+' : ''}${Math.round(gain * 10) / 10} tonight</small></div>
        <div class="nsbar"><i style="width:${bar}%"></i></div><div class="nsnext">${next ? `Next: ${next.name} at ${next.at}` : 'Top of the tree.'}</div>${moved.length ? `<div class="nsrel">${moved.join(' ')}</div>` : ''}</div>
      ${log.length ? `<div class="nslog"><h4>THE NIGHT IN BRIEF</h4>${log.map(l => `<p><span>${hh(l.t)}</span>${l.icon} ${l.text}</p>`).join('')}</div>` : ''}
    </div>`;
  },
  phoneHTML() {
    const s = Game.state, T = this.tier(), next = STANDING[this.tierIdx() + 1], gs = s.tonight.goals || [];
    return `<div class="setrow"><span>Standing at the Royal</span><b>${T.name} · ${Math.round(this.rep())}${next ? ` / ${next.at}` : ''}</b></div>
      ${this.tab() > 0 ? `<div class="setrow"><span>Bar tab</span><b>${fmt$(this.tab())} / ${fmt0(this.tabLimit())}</b></div>` : ''}
      <div style="font-size:13px;margin:6px 0 10px;line-height:1.6">${gs.map(g => { const d = this.goalDef(g.id); return `<div style="opacity:${g.done ? .5 : 1}">${g.done ? '✔' : g.failed ? '✘' : '○'} ${d.text}${d.cash ? ` <span style="opacity:.6">(+${fmt0(d.cash)})</span>` : ''}</div>`; }).join('')}</div>`;
  },
  // ---------------------------------------------------------- HUD
  hud(force) {
    const s = Game.state, gs = s.tonight && s.tonight.goals; if (!gs || !$('goals')) return;
    const n = s.night;
    let html = gs.map(g => { const d = this.goalDef(g.id), p = !g.done && !g.failed && d.prog ? ` <i>${d.prog(s, n)}</i>` : ''; return `<div class="g ${g.done ? 'ok' : ''}"><span>${g.done ? '✔' : d.type === 'end' ? '◷' : '○'}</span><div>${d.text}${p}</div></div>`; }).join('');
    if (this.ticker) html += `<div class="tick">${this.ticker}</div>`;
    if (this._hudHtml !== html) { this._hudHtml = html; $('goals').innerHTML = html; }
  },
  banner(title, sub, dur = 4) {
    const el = $('beat'); if (!el) return;
    el.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`; el.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => el.classList.remove('on'), dur * 1000);
  },
  // ---------------------------------------------------------- the shape of the night
  compPrompt() {
    const s = Game.state, stake = s.flags.kennoBet && s.wallet >= 50 ? 50 : 0;
    Game.openPanel('ROYAL DARTS COMP', `Kenno's chalked up the final. ${stake ? 'Fifty dollars says he wins.' : 'Winner takes the trophy and the $60 prize pool.'} Sixteen entries, two left standing.`, Game.optList([
      { label: 'Step up to the oche', d: stake ? `Your $${stake} bet is on` : 'Three rounds, three darts each', fn: () => { Game.closePanel(); Darts.begin(stake, 'Kenno', true); } },
      { label: 'Forfeit', d: 'Kenno will be very quiet about it', fn: () => { Game.closePanel(); Night.addRep(-2, 'Forfeited the darts comp'); } }]), []);
  },
  update(dt) {
    const s = Game.state, D = DAYS[s.day]; if (!Game.entered) return;
    if (VENUE.story && s.day === 5 && s.flags.compEntered && !s.tonight.comp && s.time >= s.startTime + 1.5 && !Game.uiOpen && !MG.active && !player.seated && isInside(player.pos.x, player.pos.z)) { s.tonight.comp = 1; this.compPrompt(); }
    const span = D.close - s.startTime, f = (s.time - s.startTime) / span, B = this.beatsDone;
    s.night.maxDrunk = Math.max(s.night.maxDrunk || 0, s.drunk);
    this.tickT -= dt;
    if (this.tickT <= 0) { this.tickT = 0.6; this.judge(); this.hud(); this.visit(); }
    if (!B.settle && f > 0.04) { B.settle = 1; this.banner('SETTLE IN', `${D.title}. ${STORY.chapter().title.split('— ')[1] || ''}`, 4); }
    if (!B.rush && f > 0.58 && D.crowd >= 12) { B.rush = 1; this.rush(); }
    if (!B.warn && s.time >= D.close - 0.5) { B.warn = 1; this.banner('LAST CALL IN 30', 'Order now, or don\'t', 4); SFX.bell(V3(-9, 2.5, -8), 1); }
    // house lights: up for the last drinks bell, then back down
    const target = this.lastCalled ? 1 : 0; this.house = damp(this.house, target, 1.6, dt);
    this.dark = damp(this.dark, Moments.dark ? 1 : 0, 3, dt);
  },
  visit() {
    const p = player.pos;
    if (inGarden(p.x, p.z)) this.ev('visit', 'garden');
  },
  rush() {
    this.banner('THE RUSH', 'The bar\'s three deep. Somebody\'s shouting a round.', 5);
    Game.arrivals += Math.round(DAYS[Game.state.day].crowd * 0.25); Game.arriveT = 3;
    Music.level = Math.min(1.1, Music.level + 0.25); AudioSys.amp.crowd = Math.min(1.6, AudioSys.amp.crowd + 0.25);
    this.log('🍻', 'The Friday-night rush hit');
  },
  // the lights come up, the bell goes, and you decide how this ends
  lastCall() {
    if (this.lastCalled) return; this.lastCalled = true;
    const s = Game.state;
    this.banner('LAST DRINKS', 'House lights up. The bell\'s gone. Make it count.', 6);
    Music.level = Math.max(0.2, Music.level - 0.3);
    this.log('🔔', 'Last drinks called');
    if (Game.mode !== 'play' || Game.uiOpen || MG.active || player.seated) { if (player.seated) Game.toast('Last drinks! Wrap it up, champ.'); return; }
    if (Cine.lastCall(bartender)) { const iv = setInterval(() => { if (!Cine.active) { clearInterval(iv); if (Game.mode === 'play' && !Game.uiOpen && !MG.active) setTimeout(() => this.lastCallPanel(), 400); } }, 300); return; }
    setTimeout(() => { if (Game.mode !== 'play' || Game.uiOpen || MG.active) return; this.lastCallPanel(); }, 3600);
  },
  lastCallPanel() {
    const s = Game.state, price = Game.drinkPrice('schooner'), rsa = s.drunk >= 80, holding = player.drink && player.drink.fill > 0.08;
    const opts = [
      { label: 'One for the road', d: rsa ? '"Sorry mate, I can\'t."' : 'A schooner, last of the night', price: fmt$(price), disabled: rsa || holding, fn: () => { Game.closePanel(); Game.order('schooner', price); } },
      { label: 'Grab a kebab on the way home', d: 'Soaks it up. Clive\'s Kebabs is still open', fn: () => { Game.closePanel(); Game.toast('Kebab shop\'s on the corner. Walk out the front, turn left.'); } },
      { label: 'Call a taxi', d: Shops.fare ? `About ${fmt0(Shops.fare())}` : '', fn: () => { Game.closePanel(); if (Shops.callTaxi) Shops.callTaxi(); else Game.walkHome(); } },
      { label: 'Walk home', d: 'Head out the front', fn: () => { Game.closePanel(); Game.walkHome(); } },
      { label: 'Stay until they chuck you out', fn: () => Game.closePanel() }];
    Game.openPanel('LAST DRINKS', `${bartender.name}: "Last drinks, folks! Get em in!" — ${Game.clockText()}`, Game.optList(opts), []);
  },
  // ---------------------------------------------------------- the brass plaque and the tip jar
  buildPlaque() {
    this.plaqueBuilt = true;
    const F = BAR.front;
    this.plaqueTex = { c: mkCanvas(512, 256) }; this.plaqueTex.tex = canvasTex(this.plaqueTex.c, 1, 1);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshStandardMaterial({ map: this.plaqueTex.tex, roughness: 0.4, metalness: 0.7 }));
    p.position.set(-12.85, 2.65, -4.2); p.rotation.y = Math.PI / 2; scene.add(p); this.plaque = p; p.visible = false;
    // tip jar by the till
    const jar = new THREE.Group(); jar.position.set(F - 0.12, 1.112, -9.35); scene.add(jar);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.16, 18, 1, true), glassMat); glass.position.y = 0.08; jar.add(glass);
    const lbl = signTex(['TIPS'], { w: 128, h: 64, bg: '#f4ead6', color: '#7a1f18', sizes: [46], font: "'Permanent Marker', cursive" });
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshBasicMaterial({ map: lbl })); lp.position.set(0.071, 0.09, 0); lp.rotation.y = Math.PI / 2; jar.add(lp);
    this.tipCoins = new THREE.Group(); jar.add(this.tipCoins);
    addInteract({ id: 'tipjar', pos: V3(F - 0.12, 1.25, -9.35), r: 2.1, label: () => 'Tip the bartender', action: () => this.tip() });
  },
  refreshPlaque() {
    if (!this.plaque) return;
    this.plaque.visible = this.tierIdx() >= 5;
    const x = this.plaqueTex.c.getContext('2d'); x.fillStyle = lg(x, 0, 0, 512, 256, ['#8a6a22', '#d9b24a', '#8a6a22']); x.fillRect(0, 0, 512, 256);
    x.strokeStyle = '#5a4210'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 236); x.fillStyle = '#2b1e06'; x.textAlign = 'center';
    x.font = 'bold 30px Rye, serif'; x.fillText('ROYAL HOTEL · ROLL OF HONOUR', 256, 78, 460); x.font = 'bold 60px Rye, serif'; x.fillText('YOU', 256, 158); x.font = '22px Inter, sans-serif'; x.fillText('"Pulled up a stool and never left"', 256, 208, 460);
    this.plaqueTex.tex.needsUpdate = true;
  },
  tip() {
    const s = Game.state, n = s.night;
    const give = a => () => { if (!Game.spend(a)) return; n.extra -= a; n.tipped = true; Game.closePanel(); SFX.coin(V3(BAR.front, 1.2, -9.35)); bark(bartender, choice(['Cheers, legend.', 'Ripper. Cheers mate.', 'You\'re too kind.', 'Appreciate it!']), true); this.addRep(a >= 5 ? 2 : 1, 'Tipped the bartender'); this.judge(); this.log('🪙', `Tipped ${bartender.name} ${fmt0(a)}`); this.refreshTips(); };
    Game.openPanel('TIP JAR', 'Nobody expects it in Australia. Everybody notices.', Game.optList([{ label: 'Chuck in a gold coin', price: '$2.00', disabled: s.wallet < 2, fn: give(2) }, { label: 'Leave a fiver', price: '$5.00', disabled: s.wallet < 5, fn: give(5) }, { label: 'Not tonight', fn: () => Game.closePanel() }]));
  },
  refreshTips() {
    if (!this.tipCoins) return;
    const c = this.tipCoins; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(G.cyl8, MAT.brass); m.scale.set(0.014, 0.002, 0.014); m.position.set(rand(-0.03, 0.03), 0.01 + c.children.length * 0.0028, rand(-0.03, 0.03)); m.rotation.set(rand(-0.3, 0.3), rand(0, 3), 0); c.add(m); }
    while (c.children.length > 40) c.remove(c.children[0]);
  },
};
ACH_LIST.push(['royalty', 'Royal Royalty', 'Reach the top standing at the Royal.'], ['champ', 'Royal Darts Champion', 'Win the Saturday darts comp.']);

// ---- src/22-moments.js ----

// =====================================================================
//  NIGHT MOMENTS: one-off events that make each night different.
//  Each night (Mon-Sat) rolls one moment that hasn't happened yet this week.
//    blackout  the power goes; phone torch and candles
//    bucks     a bucks party dares you to skull a schooner
//    wake      a wake in the lounge; keep your voice down, raise a glass
//    footy     a preliminary final; back a team, watch the scoreboard
//    inspector the licensing inspector does the rounds; stay presentable
//    busker    a bloke with a guitar sets up by the fire; take requests
// =====================================================================
const Moments = {
  dark: false, cur: null, at: 0, started: false,
  names: ['blackout', 'bucks', 'wake', 'footy', 'inspector', 'busker'],
  plan() {
    const s = Game.state, f = s.flags; this.cleanup();
    this.started = false; this.id = null;
    if (s.day === 6) return;   // Sunday is the council meeting
    const used = f.momentsUsed || (f.momentsUsed = []);
    const allowed = VENUE.moments ? this.names.filter(n => VENUE.moments.includes(n)) : this.names;
    let pool = allowed.filter(n => !used.includes(n)); if (!pool.length) { used.length = 0; pool = allowed.slice(); }
    this.id = window.__moment || choice(pool);
    const D = DAYS[s.day]; this.at = s.startTime + (D.close - s.startTime) * rand(0.3, 0.5);
    window.__moment = null;
  },
  cleanup() { if (this.cur && this.cur.cleanup) this.cur.cleanup(); this.cur = null; this.dark = false; player.chug = false; Night.ticker = ''; Night.house = 0; if (this.torch) this.torch.visible = false; this.setScreens(true); },
  update(dt) {
    const s = Game.state;
    if (!this.started && this.id && Game.entered && s.time >= this.at) { this.started = true; (s.flags.momentsUsed = s.flags.momentsUsed || []).push(this.id); this.cur = this[this.id](); }
    if (this.cur && this.cur.update) { if (this.cur.update(dt) === 'done') { if (this.cur.cleanup) this.cur.cleanup(); this.cur = null; } }
    Night.hud();
  },
  // ---------------------------------------------------------- helpers
  arrive(opts, spotFilter) {
    const n = mkNPC(Object.assign({ pos: V3(rand(-4, 4), 0, 21) }, opts)); n.timer = 1e9;
    const sp = freeSpots(spotFilter)[0] || freeSpots(s => s.area === 'bar' || s.area === 'lounge')[0];
    if (sp) { sendTo(n, sp); n.path.unshift(...streetApproach(n)); n.a.holdDrink = true; n.glass.group.visible = true; } else { scene.remove(n.h.root); NPCS.pop(); return null; }
    return n;
  },
  leave(list) { for (const n of list) { if (!n || n.gone) continue; n.leaving = true; release(n); n.state = 'walk'; n.kind = 'walk'; n.path = findPath(n.pos, NODES.S2); n.timer = 20; } },
  setScreens(on) { for (const m of MACHINES) if (m.scr) m.scr.visible = on; if (PokieFX.group) PokieFX.group.visible = on; },

  // ---------------------------------------------------------- 1. BLACKOUT
  blackout() {
    Game.fade(1, 0); SFX.noise(0.5, { freq: 120, q: 0.6, gain: 0.2 });
    this.dark = true; this.setScreens(false); Music.level = 0.05;
    Night.banner('BLACKOUT', 'The power\'s gone. Dead quiet, then somebody laughs.', 5);
    if (!this.torch) { const t = new THREE.SpotLight(0xfff0d8, 0, 16, 0.55, 0.65, 1.3); t.position.set(0.15, -0.1, 0); t.target.position.set(0, 0, -1); camera.add(t); camera.add(t.target); if (!camera.parent) scene.add(camera); this.torch = t; }
    this.torch.visible = true; this.torch.intensity = 26;
    Night.log('⚡', 'The power went out');
    const e = { t: 0, said: 0, lines: [['Shazza', 'WHO TURNED OFF THE LIGHTS?!'], ['Kenno', 'Ahh, bloody council.'], ['Old Mick', 'Eighty-one blackouts I\'ve sat through. This is a good one.'], ['Davo', 'My machine was about to go OFF!']],
      update: dt => {
        e.t += dt;
        if (e.t > 6 * (e.said + 1) && e.said < e.lines.length) { const [who, l] = e.lines[e.said++]; const n = REG.here(who) || choice(NPCS.filter(n => n.role === 'patron')); if (n) bark(n, l, true); }
        this.torch.intensity = 22 + Math.sin(e.t * 2.1) * 1.5;
        if (e.t > 50) { this.back(); return 'done'; }
      }, cleanup: () => { this.dark = false; this.setScreens(true); this.torch.visible = false; this.torch.intensity = 0; } };
    return e;
  },
  back() {
    Game.fade(0.9, 0); this.dark = false; this.setScreens(true); this.torch.visible = false; this.torch.intensity = 0; Music.level = 0.5;
    SFX.cheer(V3(-4, 1.5, -6), 3); SFX.noise(0.4, { freq: 3000, q: 0.5, gain: 0.1 });
    Night.banner('POWER\'S BACK', 'Every machine reboots at once. The pub cheers.', 4);
    NPCS.forEach(n => { if (n.role === 'patron') n.cheerT = 1.8; });
    bark(bartender, 'First one\'s on the house — candlelit special!', true);
    if (!Game.items.length && !(player.drink && player.drink.fill > 0.08)) bartenderOrder({ type: 'pot', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (item, spot) => Game.placeItem(item, spot) });
    Night.log('💡', 'Power came back; free pot on the house'); Night.addRep(1);
  },

  // ---------------------------------------------------------- 2. BUCKS PARTY: the skull dare
  bucks() {
    const col = 0xff4fa0, look = { shirt: { tile: 'collar', c: col }, pants: { tile: 'cloth', c: 0x2a2a30 }, girth: 1.1 };
    const names = ['Tezza (the groom)', 'Gaz', 'Brodie'];
    const lads = names.map(nm => this.arrive(Object.assign({ name: nm }, look), s => s.area === 'bar' && (s.kind === 'stand' || s.kind === 'lean'))).filter(Boolean);
    if (!lads.length) return null;
    Night.banner('BUCKS PARTY', 'Three blokes in matching pink shirts have taken over the bar.', 5);
    Night.log('👔', 'A bucks party rolled in');
    const e = { lads, skull: null, done: false };
    const dare = () => {
      const s = Game.state, holding = player.drink && player.drink.fill > 0.08;
      Game.openPanel('THE DARE', `<b>Tezza:</b> "Oi! Fresh face! Twenty bucks says you can't skull a schooner in twenty-five seconds. Win and the lads pay <b>$60</b>."`, Game.optList([
        { label: 'Take the dare', d: holding ? 'Finish or drop your drink first' : 'Hold F to chug. Don\'t spill it', price: '$20.00', disabled: s.wallet < 20 || holding || s.drunk > 70, fn: () => { if (!Game.spend(20)) return; s.night.extra -= 20; Game.closePanel(); e.skull = { state: 'wait', stake: 20, t: 0, tick: 0 }; bark(lads[0], 'ON! Barkeep, a schooner for the champ!', true); bartenderOrder({ type: 'schooner', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (item, spot) => Game.placeItem(item, spot) }); Night.banner('THE DARE', 'Pick up your schooner. The clock starts when you do.', 4); } },
        { label: '"Nah, I\'ve got a bit of self-respect."', fn: () => { Game.closePanel(); bark(lads[0], 'Weak as, mate!', true); } }]), []);
    };
    for (const n of lads) n.eventTalk = () => { if (e.skull) { Game.toast('The lads are waiting on you.'); return; } if (e.over) { bark(n, 'Legends never die, mate.', true); return; } dare(); };
    e.update = dt => {
      const k = e.skull; const s = Game.state;
      if (e.over && s.time > e.leaveAt) { this.leave(lads); return 'done'; }
      if (!k) return;
      if (k.state === 'wait') { k.t += dt; Night.ticker = 'DARE: grab your schooner'; if (player.drink && player.drink.fill > 0.8 && !player.drink.onLedge) { k.state = 'go'; k.t = 25; player.chug = true; Night.ticker = ''; Night.banner('SKULL! SKULL! SKULL!', 'Hold F. Twenty-five seconds.', 3); SFX.cheer(lads[0].pos, 2); lads.forEach(n => n.cheerT = 3); } else if (k.t > 90) { e.skull = null; Game.state.wallet += k.stake; Game.toast('The lads got bored. Stake refunded.'); Night.ticker = ''; } }
      else if (k.state === 'go') {
        k.t -= dt; k.tick -= dt; Night.ticker = `SKULL! ${Math.ceil(k.t)}s`;
        if (k.tick <= 0) { k.tick = 3; Game.subtitle('<b>The lads:</b> SKULL! SKULL! SKULL!', 2); }
        const d = player.drink;
        if (!d) { this.skullEnd(e, false, 'You dropped it. Tezza claps you on the back. "Mate."'); }
        else if (d.fill < 0.04) this.skullEnd(e, true);
        else if (k.t <= 0) this.skullEnd(e, false, 'Time! Half a glass left. The lads are howling.');
      }
    };
    e.cleanup = () => { player.chug = false; Night.ticker = ''; for (const n of lads) n.eventTalk = null; };
    return e;
  },
  skullEnd(e, win, why) {
    const k = e.skull, s = Game.state; player.chug = false; Night.ticker = ''; e.skull = null; e.over = true; e.leaveAt = s.time + 0.45;
    if (win) { s.wallet += k.stake * 3; s.night.extra += k.stake * 2; s.mood = Math.min(100, s.mood + 15); SFX.cheer(e.lads[0].pos, 3); e.lads.forEach(n => n.cheerT = 3); Game.toast(`SKULLED IT! The lads pay up: +${fmt0(k.stake * 3)}`, true); Game.subtitle('<b>Tezza:</b> ABSOLUTE LEGEND! Get this bloke a medal!', 4); Night.log('🍺', 'Skulled a schooner for the bucks party (+$40 net)'); Night.addRep(3); achieve('skull'); }
    else { s.mood = Math.max(0, s.mood - 3); Game.toast(why, true); Night.log('🍺', 'Lost the skull dare ($20 down)'); }
  },

  // ---------------------------------------------------------- 3. A WAKE in the lounge
  wake() {
    const dark = { shirt: { tile: 'collar', c: 0x101012 }, pants: { tile: 'cloth', c: 0x15151a } };
    const mourners = ['Pam', 'Rob', 'Jill', 'Col', 'Meg'].map(nm => this.arrive(Object.assign({ name: nm }, dark, { fem: ['Pam', 'Jill', 'Meg'].includes(nm) }), s => s.area === 'lounge')).filter(Boolean);
    if (!mourners.length) return null;
    Night.banner('A WAKE', 'They\'re farewelling Terry "Tezza" Dwyer, 71. Keep your voice down.', 6);
    Night.log('🕯', 'A wake for Tezza Dwyer in the lounge');
    const saved = { music: Music.level, crowd: AudioSys.amp.crowd }; Music.level = 0.12; AudioSys.amp.crowd = Math.max(0.35, saved.crowd * 0.6);
    const e = { mourners, done: false, toast: false, start: Game.state.time, toasted: false, paid: false };
    const raise = () => {
      if (e.toasted) return; e.toasted = true;
      Game.fade(0.5, 0); Game.subtitle('<b>Pam:</b> To Tezza. Never bought a round in his life, bless him.', 4);
      setTimeout(() => { SFX.cheer(mourners[0].pos, 3); NPCS.forEach(n => { if (n.role === 'patron') n.cheerT = 3; }); Music.level = saved.music; AudioSys.amp.crowd = saved.crowd; Game.subtitle('<b>The whole pub:</b> TO TEZZA!', 3.5); Game.state.mood = Math.min(100, Game.state.mood + 8); }, 2200);
      Night.log('🥃', 'Raised a glass to Tezza'); Night.addRep(2); relUp('Old Mick', 5);
    };
    for (const n of mourners) n.eventTalk = () => {
      const s = Game.state;
      Game.openPanel(n.name.toUpperCase(), '<span style="opacity:.7">Black ties, a photo of a grinning bloke with a kelpie, a jar for the funeral fund.</span><br><br>"Thanks for coming, love. He\'d have wanted a big turnout. And free beer."', Game.optList([
        { label: 'Chip in $20 to the kitty', d: 'For the funeral costs', price: '$20.00', disabled: e.paid || s.wallet < 20, fn: () => { if (!Game.spend(20)) return; s.night.extra -= 20; e.paid = true; Game.closePanel(); bark(n, 'God bless you. Tezza would\'ve loved you.', true); Night.addRep(4, 'Chipped in for Tezza\'s wake'); s.mood = Math.min(100, s.mood + 6); for (const k in REGULARS) relUp(k, 2); } },
        { label: 'Raise a glass to Tezza', d: e.toasted ? 'You already have' : 'The whole room will join in', disabled: e.toasted, fn: () => { Game.closePanel(); raise(); } },
        { label: '"Sorry for your loss."', fn: () => { Game.closePanel(); s.mood = Math.min(100, s.mood + 2); bark(n, 'Thanks, love.', true); } }]), []);
    };
    e.update = dt => {
      if (!e.toasted && Game.state.time > e.start + 0.5) raise();
      if (Game.state.time > e.start + 0.75) { this.leave(mourners); return 'done'; }
    };
    e.cleanup = () => { for (const n of mourners) n.eventTalk = null; Music.level = saved.music; AudioSys.amp.crowd = saved.crowd; };
    return e;
  },

  // ---------------------------------------------------------- 4. FOOTY: a preliminary final on the big screen
  footy() {
    const f = { Swans: { g: 0, b: 0 }, Pies: { g: 0, b: 0 } }, pts = k => f[k].g * 6 + f[k].b;
    const e = { f, q: 1, qt: 0, bet: null, t: 3, done: false, start: Game.state.time };
    Night.banner('PRELIMINARY FINAL', 'Swans v Pies on every screen. Back a team at the bar.', 6);
    Night.log('🏉', 'Swans v Pies prelim final on the telly');
    Music.level = Math.max(0.15, Music.level - 0.2);
    e.options = (opts, holding, rsa) => { if (e.done || e.bet) return; const s = Game.state; for (const t of ['Swans', 'Pies']) opts.push({ label: `Back the ${t} ($10)`, d: `Pays $19 if they win. ${t === 'Swans' ? 'Favourites.' : 'Underdogs, if you believe in them.'}`, price: '$10.00', disabled: s.wallet < 10, fn: () => { if (!Game.spend(10)) return; s.night.extra -= 10; e.bet = t; Game.closePanel(); Night.log('🏉', `$10 on the ${t}`); Game.toast(`$10 on the ${t}. Come on!`); } }); };
    e.tick = () => `Q${e.q} · SWANS ${f.Swans.g}.${f.Swans.b}.${pts('Swans')} – PIES ${f.Pies.g}.${f.Pies.b}.${pts('Pies')}`;
    e.update = dt => {
      e.t -= dt; e.qt += dt; Night.ticker = e.done ? Night.ticker : e.tick() + (e.bet ? ` · you: ${e.bet}` : '');
      if (e.done) { if (Game.state.time > e.endAt + 0.25) { Night.ticker = ''; return 'done'; } return; }
      if (e.t <= 0) {
        e.t = rand(3, 7); const team = Math.random() < 0.52 ? 'Swans' : 'Pies', goal = Math.random() < 0.45;
        if (goal) { f[team].g++; SFX.cheer(V3(0, 2.5, 0), 2); bark(choice(NPCS.filter(n => n.role !== 'bartender')) || bartender, choice(['GOAAAL!', 'Get in!', 'Ump! Was that out?!', 'Beauty!', 'Kick it long!']), true); NPCS.forEach(n => { if (n.role === 'patron' && Math.random() < 0.4) n.cheerT = 1.4; }); } else f[team].b++;
      }
      if (e.qt > 15) { e.qt = 0; e.q++; Night.banner(`QUARTER ${e.q > 4 ? 'TIME' : 'TIME'}`, e.tick(), 2.5); if (e.q > 4) { e.done = true; e.endAt = Game.state.time; const a = pts('Swans'), b = pts('Pies'), w = a === b ? (Math.random() < 0.5 ? 'Swans' : 'Pies') : a > b ? 'Swans' : 'Pies'; Night.ticker = `FULL TIME · SWANS ${a} – PIES ${b}`; Night.banner('FULL TIME', `${w} win ${Math.max(a, b)} to ${Math.min(a, b)}`, 5); SFX.cheer(V3(0, 2.5, 0), 3);
        if (e.bet) { if (e.bet === w) { Game.state.wallet += 19; Game.state.night.extra += 19; Game.state.mood = Math.min(100, Game.state.mood + 12); Game.toast(`The ${w} got up! +$19`, true); Night.log('🏉', `The ${w} won: $10 became $19`); Night.addRep(1); } else { Game.state.mood = Math.max(0, Game.state.mood - 4); Game.toast(`The ${w} won. $10 down the drain.`); Night.log('🏉', `The ${w} won. Lost the $10`); } } else Night.log('🏉', `The ${w} won, ${Math.max(a, b)}–${Math.min(a, b)}`); } }
    };
    e.cleanup = () => { Night.ticker = ''; };
    this.footyE = e; return e;
  },
  barOptions(opts, holding, rsa) { if (this.cur && this.cur.options) this.cur.options(opts, holding, rsa); },

  // ---------------------------------------------------------- 5. LICENSING INSPECTOR
  inspector() {
    const n = this.arrive({ name: 'Ms Whitlock', fem: true, shirt: { tile: 'collar', c: 0x2a4a6a }, pants: { tile: 'cloth', c: 0x20242c }, hair: 0x3a3030, style: 'bob', glasses: true, role: 'patron' }, s => s.area === 'bar' && s.kind === 'stand');
    if (!n) return null;
    n.smoker = false; n.a.holdDrink = false; n.glass.group.visible = false;
    Night.banner('LICENSING INSPECTOR', 'Ms Whitlock is doing the rounds with a clipboard. Stay presentable.', 6);
    Night.log('📋', 'The licensing inspector came through');
    const e = { n, flagged: false, watch: 5, end: Game.state.time + 0.55, offered: false };
    n.eventTalk = () => {
      const s = Game.state;
      Game.openPanel('MS WHITLOCK', '<span style="opacity:.7">Office of Liquor &amp; Gaming. Lanyard. Clipboard. Expressionless.</span><br><br>"Evening. Routine inspection. RSA signage, responsible-service records, and patrons. Nothing to worry about, if everyone\'s behaving."', Game.optList([
        { label: 'Offer her a water', d: 'Hospitality', disabled: e.offered, fn: () => { e.offered = true; Game.closePanel(); bark(n, 'Very kind. Noted.', true); Night.addRep(1); } },
        { label: 'Ask what she\'s looking for', fn: () => { Game.closePanel(); bark(n, 'Anyone visibly intoxicated being served. Machines unattended. You know. The fun stuff.', true); } },
        { label: '"Have a lovely evening."', fn: () => Game.closePanel() }]), []);
    };
    e.update = dt => {
      const s = Game.state; e.watch -= dt;
      if (e.watch <= 0) { e.watch = 4; if (!e.flagged && n.pos.distanceTo(player.pos) < 9 && s.drunk >= 58) { e.flagged = true; bark(n, `Excuse me, sir. Have you had a few tonight? ${bartender.name}, I'd like a word.`, true); Game.toast('The inspector has clocked you. Water. Now.', true); } }
      if (e.flagged && s.drunk < 40 && !e.cleared) { e.cleared = true; bark(n, 'Better. I\'ll let it go.', true); }
      if (s.time > e.end) {
        if (e.flagged && !e.cleared) { const fine = 80; const from = Math.min(s.wallet, fine); s.wallet -= from; s.bank -= Math.min(s.bank, fine - from); s.night.extra -= fine; Game.toast(`The pub copped a warning, and you got a ${fmt0(fine)} on-the-spot fine for being intoxicated on licensed premises.`, true); Night.log('📋', `Fined ${fmt0(fine)} by the inspector`); Night.addRep(-6); }
        else { Game.subtitle(`<b>Ms Whitlock:</b> A clean venue. Well done, ${bartender.name}.`, 3.5); bark(bartender, 'Cheers. Have one on us.', true); Night.log('📋', 'Passed the inspection with flying colours'); Night.addRep(3); if (!Game.items.length) bartenderOrder({ type: 'water', forZ: clamp(player.pos.z, BAR.z0 + 0.6, BAR.z1 - 0.6), cb: (it, sp) => Game.placeItem(it, sp) }); }
        this.leave([n]); return 'done';
      }
    };
    e.cleanup = () => { n.eventTalk = null; };
    return e;
  },

  // ---------------------------------------------------------- 6. BUSKER by the fire
  busker() {
    const n = this.arrive({ name: 'Sparrow', shirt: { tile: 'collar', c: 0x6a4a2a }, pants: { tile: 'denim', c: 0xffffff }, hair: 0x4a3a2a, style: 'mullet', beard: 'full', glasses: false }, s => s.area === 'lounge' && (s.kind === 'chair' || s.kind === 'stool'));
    if (!n) return null;
    // a guitar across his lap
    const gt = new THREE.Group(), wood = M({ color: 0xb7772e, roughness: 0.5 }), dk = M({ color: 0x2a1608, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), wood); body.scale.set(1, 0.18, 0.78); gt.add(body);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), dk); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.03; gt.add(hole);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.04), dk); neck.position.set(0.3, 0, 0); gt.add(neck);
    gt.position.set(0, 0.62, 0.2); gt.rotation.set(0.1, 0.3, 0.45); n.h.root.add(gt); n.guitar = gt;
    Night.banner('LIVE MUSIC', 'A busker\'s set up by the fire. Requests are $5.', 5);
    Night.log('🎸', 'Sparrow busked by the fire');
    Music.level = Math.max(0.12, Music.level - 0.25);
    const scale = [196, 220, 261.6, 293.7, 329.6, 392, 440], melody = [0, 2, 4, 2, 3, 1, 2, 0, 4, 5, 4, 3, 2, 1, 0, 0];
    const MATILDA = [392, 392, 392, 329.6, 392, 392, 329.6, 392, 440, 392, 329.6, 293.7, 261.6];
    const e = { n, i: 0, t: 0, song: null, end: Game.state.time + 0.85, tipped: false };
    n.eventTalk = () => {
      const s = Game.state;
      Game.openPanel('SPARROW', '<span style="opacity:.7">Beard like a bush fire. Guitar case open for coins.</span><br><br>"Evenin\'. Got a request? I know three songs and one of them\'s Waltzing Matilda."', Game.optList([
        { label: 'Request a song', d: 'A proper singalong', price: '$5.00', disabled: s.wallet < 5, fn: () => { if (!Game.spend(5)) return; s.night.extra -= 5; Game.closePanel(); e.song = { i: 0, t: 0 }; bark(n, 'Righto — everyone knows this one!', true); Night.log('🎸', 'Requested Waltzing Matilda'); Night.addRep(2); s.mood = Math.min(100, s.mood + 8); } },
        { label: 'Chuck a gold coin in the case', price: '$2.00', disabled: s.wallet < 2, fn: () => { if (!Game.spend(2)) return; s.night.extra -= 2; Game.closePanel(); SFX.coin(n.pos); bark(n, 'Ta, mate.', true); s.mood = Math.min(100, s.mood + 2); } },
        { label: '"Sounds great."', fn: () => Game.closePanel() }]), []);
    };
    const pluck = (f, g = 0.05) => { SFX.tone(f, 0.9, { gain: g, type: 'triangle', pos: n.pos.clone().add(V3(0, 1, 0)) }); SFX.tone(f * 2, 0.5, { gain: g * 0.3, type: 'sine', pos: n.pos.clone().add(V3(0, 1, 0)) }); };
    e.update = dt => {
      const s = Game.state; e.t -= dt;
      if (e.t <= 0) {
        if (e.song) { pluck(MATILDA[e.song.i++]); e.t = e.song.i % 4 === 0 ? 0.7 : 0.38; if (e.song.i >= MATILDA.length) { e.song = null; SFX.cheer(n.pos, 2); NPCS.forEach(o => { if (o.role === 'patron' && Math.random() < 0.5) o.cheerT = 1.6; }); } }
        else { pluck(scale[melody[e.i++ % melody.length]], 0.04); e.t = rand(0.45, 0.9); }
      }
      if (s.time > e.end) { bark(n, 'That\'s me. Thanks, folks!', true); this.leave([n]); return 'done'; }
    };
    e.cleanup = () => { n.eventTalk = null; if (n.guitar) n.h.root.remove(n.guitar); };
    return e;
  },
};
ACH_LIST.push(['skull', 'Skull! Skull! Skull!', 'Win the bucks party skull dare.']);

// ---- src/23-skins.js ----

// =====================================================================
//  LICENSED MACHINE SKINS
//  The supplied machine screenshots (Dragon Link family, Konami Fire Mountain, Lightning Dollar Link,
//  Thunder Empire) are used as-is: the exact screen art is the machine's display, the symbols on the
//  reels are cut out of those screens, and the game only paints live values (credit / bet / win /
//  jackpots) over the numbers that were baked into the pictures.  Assets: assets/slots, tools/slots/extract.py
// =====================================================================
const SKIN_STRIP = { am: ['#140a2e', '#2a1a5a'], pm: ['#1a0505', '#3a0a0a'], gc: ['#1a0505', '#3a0a0a'], hp: ['#0a0000', '#3a0808'], fm: ['#0a1030', '#1a2a5a'] };
const JP_COL = { GRAND: ['#ff1a1a', '#4a0000'], MAJOR: ['#1ad81a', '#003a00'], MINOR: ['#2a7aff', '#001050'], MINI: ['#ff8a1a', '#4a1c00'], MEGA: ['#ff2a2a', '#400000'] };
function skinOK(id) { const S = SLOTSKIN[id]; return !!(S && S.imgMain && S.imgSprites); }
// prepare every skin: sample the background behind each HUD value so the live numbers blend in, build the belly decal
function skinInit() {
  for (const id in GAMES) {
    const g = GAMES[id]; if (!g.skin) continue;
    if (!skinOK(id)) { g.skin = false; continue; }
    const S = SLOTSKIN[id]; S.id = id; S.hudBg = {};
    const c = mkCanvas(S.mw, S.mh), x = c.getContext('2d'); x.drawImage(S.imgMain, 0, 0, S.mw, S.mh);
    const px = (X, Y) => x.getImageData(clamp(Math.round(X), 0, S.mw - 1), clamp(Math.round(Y), 0, S.mh - 1), 1, 1).data;
    for (const k in S.hud) { const r = S.hud[k], a = px(r[0] - 3, r[1] + r[3] / 2), b = px(r[0] + r[2] + 3, r[1] + r[3] / 2); S.hudBg[k] = `rgb(${(a[0] + b[0]) >> 1},${(a[1] + b[1]) >> 1},${(a[2] + b[2]) >> 1})`; }
    S.strip = SKIN_STRIP[id] || ['#0a1030', '#1a2a5a'];
    // the belly decal on the front of the cabinet: the Konami front panel, or the logo strip from the top screen
    const bc = mkCanvas(512, 256), bx = bc.getContext('2d'); bx.fillStyle = '#0a0a10'; bx.fillRect(0, 0, 512, 256);
    if (S.imgFront) bx.drawImage(S.imgFront, 0, 0, 512, 256);
    else if (S.imgTop) { const lh = S.th * 0.30; bx.drawImage(S.imgTop, 0, 0, S.tw, lh, 20, 60, 472, 472 * lh / S.tw); }
    S.belly = canvasTex(bc, 1, 1);
    S.dims = skinDims(S); S.useHS = ['am', 'pm', 'gc', 'hp'].includes(id);
  }
}
// physical size of the screens (metres) and how the player's eye frames them
function skinDims(S) {
  let h = 0.9, w = h * S.mw / S.mh; if (w > 0.6) { w = 0.6; h = w * S.mh / S.mw; }
  const th = S.imgTop ? 0.58 * S.th / S.tw : 0, tw = 0.58;
  const headH = h + 0.1, headCy = 1.045 + headH / 2, top = headCy + headH / 2;
  return { w, h, cy: 1.05 + 0.05 + h / 2, headH, headCy, tw, th, topCy: top + 0.03 + th / 2, portrait: true, eyeY: 1.3, eyeBack: 0.14, fov: 62 + (h > 0.8 ? 3 : 0), lookY: Math.min(1.58, (1.03 + 1.1 + h) / 2 + 0.02) };
}
const _STD_DIMS = { w: 0.58, h: 0.435, cy: 1.44, portrait: false, eyeY: 1.37, eyeBack: 0, fov: 55, lookY: null };

// ---------------------------------------------------------------- painting the live numbers over the baked ones
function skinText(x, txt, cx, cy, size, fill, stroke, maxW, font = "'Bebas Neue', Impact, sans-serif") {
  x.font = `bold ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  let s = size; while (s > 8 && x.measureText(txt).width > maxW) { s -= 2; x.font = `bold ${s}px ${font}`; }
  if (stroke) { x.lineJoin = 'round'; x.lineWidth = Math.max(3, s * 0.14); x.strokeStyle = stroke; x.strokeText(txt, cx, cy + s * 0.04); }
  x.fillStyle = fill; x.fillText(txt, cx, cy + s * 0.04);
}
function skinJP(x, S, rects, bet) {
  for (const name in rects) {
    const r = rects[name], key = name === 'MEGA' ? 'MAJOR' : name, col = JP_COL[name] || JP_COL.GRAND;
    x.fillStyle = '#000'; x.fillRect(r[0], r[1], r[2], r[3]);
    const v = bet ? jpVal(key, bet) : JP[key];
    skinText(x, fmt$(v), r[0] + r[2] / 2, r[1] + r[3] / 2, Math.round(r[3] * 0.98), S.id === 'fm' && name === 'GRAND' ? '#ffe27a' : col[0], col[1], r[2] - 8);
  }
}
function skinHUD(x, S, m, hud = S.hud) {
  const credits = { credit: m.credit * 100, bet: m.bet * 100, win: (m.state === 'gamble' ? m.gambleAmt : (m.shownWin || 0)) * 100 };
  for (const k in hud) {
    const r = hud[k]; x.fillStyle = S.hudBg[k] || '#000'; x.fillRect(r[0] - 4, r[1] - 1, r[2] + 8, r[3] + 2);
    skinText(x, String(Math.round(credits[k])), r[0] + r[2] / 2, r[1] + r[3] / 2, Math.round(r[3] * 1.0), '#fff', '#000', r[2] + 4);
  }
}

// Happy & Prosperous: the supplied screen is its hold & spin screen, so the big gold coin carries the game's name between features
function skinTitle(x, S) {
  if (S.id !== 'hp' || !S.medal) return;
  const cx = S.medal[0] + S.medal[2] / 2, cy = S.medal[1] + S.medal[3] / 2;
  skinText(x, 'HAPPY &', cx, cy - 40, 92, '#1a0a00', '#ffd84a', 400, "Bungee, Impact, sans-serif");
  skinText(x, 'PROSPEROUS', cx, cy + 48, 74, '#1a0a00', '#ffd84a', 420, "Bungee, Impact, sans-serif");
  skinText(x, 'DRAGON LINK', cx, cy + 128, 34, '#8a1a00', null, 380, "Bungee, Impact, sans-serif");
}

// ---------------------------------------------------------------- Machine: draw with the skin
Machine.prototype.drawSkin = function () {
  const S = this.skin, x = this.ctx, sc = this.res_ * S.k, g = this.game, st = this.state, W = S.mw, H = S.mh;
  // a big canvas: when nothing is moving (waiting for a spin, nothing flashing) repaint only a few times a second
  if (st === 'ready' && !(this.flashT > 0) && !this.particles.length) { this._idleN = (this._idleN || 0) + 1; if (this._idleN % 10 !== 1 && this._lastCredit === this.credit && this._lastBet === this.bet) return; }
  this._lastCredit = this.credit; this._lastBet = this.bet;
  x.setTransform(sc, 0, 0, sc, 0, 0);
  const hs = st === 'holdspin' && S.useHS && SLOTSKIN.hsImg;
  const win = hs ? SLOTSKIN.hp.win.map((v, i) => v * (i % 2 ? H / SLOTSKIN.hp.mh : W / SLOTSKIN.hp.mw)) : S.win;
  x.drawImage(hs ? SLOTSKIN.hsImg : S.imgMain, 0, 0, W, H);
  skinHUD(x, S, this, hs ? SLOTSKIN.hp.hud : S.hud);
  if (!hs) skinTitle(x, S);
  if (S.jpm) skinJP(x, S, { GRAND: S.jpm.GRAND, MEGA: S.jpm.MEGA }, 0);
  // the reel stage: the engine's normal reel / hold & spin / gamble drawing, squeezed into the screen's own reel window
  x.save(); x.beginPath(); x.rect(win[0] - 3, win[1] - 3, win[2] + 6, win[3] + 6); x.clip();
  x.translate(win[0], win[1]); x.scale(win[2] / (5 * CW), win[3] / (3 * CH)); x.translate(-RX, -RY);
  if (st === 'holdspin') this.drawHold(x); else if (st === 'gamble') this.drawGamble(x); else this.drawReels(x);
  if (st === 'featIntro') {
    const k = clamp(this.st / 0.4, 0, 1);
    x.fillStyle = `rgba(0,0,0,${0.6 * k})`; x.fillRect(0, RY, SW, CH * 3);
    x.save(); x.translate(SW / 2, RY + CH * 1.5); x.scale(0.5 + easeOutBack(k) * 0.5, 0.5 + easeOutBack(k) * 0.5);
    x.shadowColor = g.theme.glow; x.shadowBlur = 40; outlineText(x, 'HOLD & SPIN', 0, -20, 96, lg(x, 0, -60, 0, 40, ['#fff', g.theme.glow, g.theme.accent]), '#1a0802', 14); x.shadowBlur = 0;
    outlineText(x, 'TRIGGERED!', 0, 70, 50, '#fff', '#000', 8); x.restore();
  }
  if (st === 'featOutro') {
    x.fillStyle = 'rgba(0,0,0,.72)'; x.fillRect(0, RY, SW, CH * 3);
    outlineText(x, 'FEATURE COMPLETE', SW / 2, RY + 120, 60, g.theme.glow, '#000', 10);
    x.shadowColor = '#ffb000'; x.shadowBlur = 30; outlineText(x, fmt$(this.shownWin), SW / 2, RY + 260, 110, lg(x, 0, RY + 200, 0, RY + 320, ['#fff', '#ffe27a', '#ff9d00']), '#3a1a00', 12, 'Bebas Neue, Impact'); x.shadowBlur = 0;
  }
  if (this.free && st !== 'featOutro') { outlineText(x, `FREE GAME ${this.freeN} OF ${this.freeN + this.freeLeft}`, SW / 2, RY + 17, 26, '#fff', '#000', 5); }
  const showMsg = this.msg && (st === 'ready' || st === 'gamble' || (st === 'showWin' && !(this.win > 0 && this.wins.length && this.winLineI >= 0)));
  if (showMsg && !this.free && st !== 'holdspin') { rr(x, SW / 2 - 210, RY + CH * 3 - 50, 420, 40, 10); x.fillStyle = 'rgba(0,0,0,.72)'; x.fill(); outlineText(x, this.msg, SW / 2, RY + CH * 3 - 30, 24, '#8aff9a', '#000', 4); }
  x.restore();
  // hold & spin medal: the live count in the big gold coin
  if (hs) {
    const h = this.hs, n = h.shown.filter(Boolean).length, M = SLOTSKIN.hp.medal, cx = (M[0] + M[2] / 2) * W / SLOTSKIN.hp.mw, cy = (M[1] + M[3] / 2) * H / SLOTSKIN.hp.mh;
    const ink = '#1a0a00', gold = '#ffd84a';
    skinText(x, String(h.collect >= 0 ? Math.min(15, n) : n), cx, cy - 36, 190, ink, gold, 300, "Bungee, Impact, sans-serif");
    skinText(x, h.collect >= 0 ? 'COLLECTING' : 'COLLECTED', cx, cy + 70, 46, ink, gold, 360, "Bungee, Impact, sans-serif");
    skinText(x, h.collect >= 0 ? fmt$(h.acc || 0) : '15 WIN GRAND JACKPOT', cx, cy + 135, 32, ink, null, 330, "Bungee, Impact, sans-serif");
  }
  // big win / jackpot text and the coin shower, in screen space
  x.save(); x.scale(W / SW, H / SH);
  if (this.flashT > 0) {
    const k = 1 - this.flashT / this.flashT0, s = k < 0.15 ? easeOutBack(k / 0.15) : 1, a = this.flashT < 0.4 ? this.flashT / 0.4 : 1;
    x.save(); x.globalAlpha = a; x.translate(SW / 2, SH * 0.38); x.scale(s, s); x.rotate(Math.sin(this.t * 6) * 0.03);
    x.shadowColor = '#ff9d00'; x.shadowBlur = 50; outlineText(x, this.flashTxt, 0, 0, 120, lg(x, 0, -60, 0, 60, ['#fff', '#ffe27a', '#ff7a00']), '#3a1000', 16); x.restore();
  }
  for (const p of this.particles) { x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(Math.cos(p.r * 2), 1); x.fillStyle = rg(x, -4, -4, 1, p.s, ['#fffbe0', '#ffd84a', '#a86a08']); x.beginPath(); x.arc(0, 0, p.s / 2, 0, 7); x.fill(); x.strokeStyle = '#6a4004'; x.lineWidth = 2; x.stroke(); x.restore(); }
  x.restore();
  this.tex.needsUpdate = true;
};

// ---------------------------------------------------------------- attract (idle) screen and top screen, shared per game
function skinAttract(id, dt) {
  const s = shared[id]; s.acc = (s.acc || 0) + dt; if (s.acc < 0.45) return; dt = s.acc; s.acc = 0;   // the idle screens only need a refresh now and then
  const S = SLOTSKIN[id], g = GAMES[id], x = s.attract.getContext('2d'); s.t += dt;
  const sc = s.attract.width / S.mw; x.setTransform(sc, 0, 0, sc, 0, 0);
  x.drawImage(S.imgMain, 0, 0, S.mw, S.mh);
  skinHUD(x, S, { credit: 0, bet: 0.5, shownWin: 0, state: 'ready' }); skinTitle(x, S);
  if (S.jpm) skinJP(x, S, { GRAND: S.jpm.GRAND, MEGA: S.jpm.MEGA }, 0);
  // a soft sheen sweeps the glass now and then
  const k = (s.t % 6) / 6; if (k < 0.35) { const X = (k / 0.35) * (S.mw + 400) - 200; const gr = x.createLinearGradient(X - 120, 0, X + 120, S.mh); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, S.mw, S.mh); }
  s.at.needsUpdate = true;
}
function skinTopper(id) {
  const s = shared[id], S = SLOTSKIN[id]; if (!S.imgTop) return;
  const x = s.topper.getContext('2d'), sc = s.topper.width / S.tw; x.setTransform(sc, 0, 0, sc, 0, 0);
  x.drawImage(S.imgTop, 0, 0, S.tw, S.th);
  if (S.jp) skinJP(x, S, S.jp, 0);
  s.tt.needsUpdate = true;
}

// ---------------------------------------------------------------- the cabinet: portrait screen, top box, LED bezel
const _skinGeo = {};
function skinHead(addS, S, gm) {
  const D = S.dims, th = GAMES[S.id].theme, hw = Math.max(0.66, D.w + 0.08), cab = cabMat();
  const led = S.led || (S.led = new THREE.MeshBasicMaterial({ color: new THREE.Color(...(th.led || [1, 0.3, 0.1])).multiplyScalar(1.4) }));
  addS(new THREE.BoxGeometry(hw, D.headH, 0.3), cab, 0, D.headCy, -0.12);
  addS(new THREE.BoxGeometry(D.w + 0.04, 0.012, 0.012), led, 0, D.cy + D.h / 2 + 0.01, 0.047); addS(new THREE.BoxGeometry(D.w + 0.04, 0.012, 0.012), led, 0, D.cy - D.h / 2 - 0.01, 0.047);
  for (const sx of [-1, 1]) { addS(new THREE.BoxGeometry(0.012, D.h + 0.04, 0.012), led, sx * (D.w / 2 + 0.01), D.cy, 0.047); addS(new THREE.BoxGeometry(0.016, D.headH, 0.03), led, sx * hw / 2, D.headCy, 0.03); }
  if (S.imgTop) {
    addS(new THREE.BoxGeometry(hw, D.th + 0.07, 0.22), cab, 0, D.topCy, -0.15);
    addS(new THREE.PlaneGeometry(D.tw, D.th), gm.topper, 0, D.topCy, -0.035);
    addS(new THREE.BoxGeometry(hw, 0.03, 0.2), led, 0, D.topCy + D.th / 2 + 0.05, -0.15);
  } else addS(new THREE.BoxGeometry(hw, 0.05, 0.2), led, 0, D.headCy + D.headH / 2 + 0.03, -0.12);
  const bm = S.bellyMat || (S.bellyMat = new THREE.MeshBasicMaterial({ map: S.belly })); bm.color.setScalar(0.85);
  addS(new THREE.PlaneGeometry(0.58, 0.29), bm, 0, 0.6, 0.312);
}
function skinScreen(add, S) {
  const D = S.dims, mat = new THREE.MeshBasicMaterial({ map: shared[S.id].at }); mat.color.setScalar(1.12);
  return add(new THREE.PlaneGeometry(D.w, D.h), mat, 0, D.cy, 0.04, 0);
}

// the Lightning Dollar Link header sign over the four-machine bank (the supplied banner, as is)
function buildSkinSigns() {
  const img = SLOTSKIN.bannerImg; if (!img) return;
  const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
  const row = VENUE.machines.back, i0 = row.indexOf('ldl1'); if (i0 < 0 || row[i0 + 3] !== 'ldl4') return;   // only over a Lightning Dollar Link run
  const w = 4.36, h = w * img.height / img.width, cx = 4.5 + (i0 + 1.5) * 1.08;
  signPlane(t, w, h, cx, 2.8, -17.82, 0, { toneMapped: false, intensity: 1.1 });
  addBoxS(SB, MAT.blackPlastic, cx, 2.8, -17.86, w + 0.08, h + 0.08, 0.04);
}

// ---- src/24-classics.js ----

// =====================================================================
//  PUB CLASSICS: the machines that have been in Aussie pubs and clubs for decades.
//  Queen of the Nile (the free-games-times-three original), Big Red, Buffalo, plus 5 Dragons /
//  Where's the Gold re-titles of the house games.  Original art, same engine.
// =====================================================================
Object.assign(GAMES, {
  qotn: {
    id: 'qotn', name: 'QUEEN OF THE NILE', sub: 'CLASSIC', feature: 'freegames', payScale: 4.7, freeMult: 3,
    theme: { bg1: '#06143a', bg2: '#1a5aa8', frame: '#f6c445', accent: '#e8a020', glow: '#ffe9a0', text: '#fff3cf', scene: 'nile' },
    tag: '3 PYRAMIDS = FREE GAMES · EVERY FREE GAME WIN PAYS TRIPLE', syms: ['9', '10', 'J', 'Q', 'K', 'A', 'ANKH', 'SCARAB', 'EYE', 'PHARAOH', 'WILD', 'PYRAMID'],
    pays: Object.assign({}, ROYAL_PAYS, { ANKH: [0, 0, 0, 12, 40, 150], SCARAB: [0, 0, 0, 15, 50, 200], EYE: [0, 0, 0, 20, 75, 300], PHARAOH: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, ANKH: 6, SCARAB: 5, EYE: 4.5, PHARAOH: 3.5, WILD: 2.4, PYRAMID: 2.2 }, noWild: [0], wild: 'WILD', scatter: 'PYRAMID',
    wildArt(x, g) { // Cleopatra
      rr(x, -78, -48, 156, 96, 18); x.fillStyle = lg(x, 0, -48, 0, 48, ['#1a5aa8', '#06143a']); x.fill(); x.lineWidth = 7; x.strokeStyle = g.theme.frame; x.stroke();
      x.fillStyle = '#1a1a22'; x.beginPath(); x.moveTo(-30, -30); x.lineTo(30, -30); x.lineTo(38, 40); x.lineTo(-38, 40); x.closePath(); x.fill();
      x.fillStyle = '#e8b890'; x.beginPath(); x.ellipse(0, -2, 20, 26, 0, 0, 7); x.fill();
      x.fillStyle = lg(x, 0, -40, 0, -20, ['#ffe27a', '#c08a10']); x.fillRect(-32, -36, 64, 12);
      x.fillStyle = '#0a1a3a'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 8, -4, 5, 3, 0, 0, 7); x.fill(); } x.fillStyle = '#c0282d'; x.beginPath(); x.ellipse(0, 12, 7, 3, 0, 0, 7); x.fill();
      outlineText(x, 'WILD', 0, 36, 30, lg(x, 0, 20, 0, 44, ['#fffbe0', g.theme.glow, g.theme.accent]), '#1a0802', 7);
    }
  },
  bigred: {
    id: 'bigred', name: 'BIG RED', sub: 'CLASSIC', feature: 'freegames', payScale: 4.5, wildMults: [40, 35, 18, 7], free: { WILD: 6 },
    theme: { bg1: '#3a0d05', bg2: '#c8421a', frame: '#f6c445', accent: '#ff7a18', glow: '#ffd36b', text: '#fff3cf', scene: 'outback' },
    tag: '3 ULURU = FREE GAMES · WILD ROOS MULTIPLY x2 x3 x5', syms: ['9', '10', 'J', 'Q', 'K', 'A', 'BOOM', 'KOALA', 'EMU', 'ROO', 'WILD', 'ULURU'],
    pays: Object.assign({}, ROYAL_PAYS, { BOOM: [0, 0, 0, 12, 40, 150], KOALA: [0, 0, 0, 15, 50, 200], EMU: [0, 0, 0, 20, 75, 300], ROO: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, BOOM: 6, KOALA: 5, EMU: 4.5, ROO: 3.5, WILD: 2.4, ULURU: 2.2 }, noWild: [0], wild: 'WILD', scatter: 'ULURU'
  },
  buffalo: {
    id: 'buffalo', name: 'BUFFALO', sub: 'GOLD', feature: 'freegames', payScale: 4.55, wildMults: [40, 35, 18, 7], free: { WILD: 6 },
    theme: { bg1: '#2a0a14', bg2: '#d8601a', frame: '#e8c060', accent: '#c8301a', glow: '#ffd890', text: '#fff0d8', scene: 'prairie' },
    tag: '3 GOLD PAWS = FREE GAMES · WILD SUNSETS MULTIPLY x2 x3 x5', syms: ['9', '10', 'J', 'Q', 'K', 'A', 'COUGAR', 'WOLF', 'EAGLE', 'BUFFALO', 'WILD', 'PAW'],
    pays: Object.assign({}, ROYAL_PAYS, { COUGAR: [0, 0, 0, 12, 40, 150], WOLF: [0, 0, 0, 15, 50, 200], EAGLE: [0, 0, 0, 20, 75, 300], BUFFALO: [0, 0, 0, 30, 120, 600], WILD: [0, 0, 0, 30, 120, 800] }),
    base: { '9': 12, '10': 12, J: 11, Q: 11, K: 9, A: 9, COUGAR: 6, WOLF: 5, EAGLE: 4.5, BUFFALO: 3.5, WILD: 2.4, PAW: 2.2 }, noWild: [0], wild: 'WILD', scatter: 'PAW',
    wildArt(x, g) {
      rr(x, -78, -48, 156, 96, 18); x.fillStyle = lg(x, 0, -48, 0, 48, ['#ff9a3a', '#7a1a0a']); x.fill(); x.lineWidth = 7; x.strokeStyle = g.theme.frame; x.stroke();
      x.fillStyle = rg(x, 0, 14, 4, 52, ['#fff6a0', '#ffb02a', '#e0501a']); x.beginPath(); x.arc(0, 14, 44, Math.PI, 0); x.fill();
      x.fillStyle = '#3a0a10'; x.beginPath(); x.moveTo(-78, 30); x.lineTo(-40, 6); x.lineTo(-20, 22); x.lineTo(10, 0); x.lineTo(40, 24); x.lineTo(78, 8); x.lineTo(78, 48); x.lineTo(-78, 48); x.fill();
      outlineText(x, 'WILD', 0, -18, 38, lg(x, 0, -34, 0, -2, ['#fffbe0', g.theme.glow, g.theme.accent]), '#1a0802', 8);
    }
  }
});
// the house games under their pub names
Object.assign(GAMES.dragon, { name: '5 DRAGONS', sub: 'CLASSIC', wildMults: [40, 35, 18, 7], payScale: 3.75 });
Object.assign(GAMES.outback, { name: "WHERE'S THE GOLD", sub: 'LINK', payScale: 6.1 });

// wild art can be game-specific
const _wildArt = ART.WILD; ART.WILD = (x, g) => g.wildArt ? g.wildArt(x, g) : _wildArt(x, g);

Object.assign(ART, {
  ANKH(x) {
    x.fillStyle = lg(x, 0, -60, 0, 60, ['#fff0a0', '#e8b020', '#8a5a08']); x.strokeStyle = '#2a1604'; x.lineWidth = 5;
    x.beginPath(); x.ellipse(0, -30, 20, 28, 0, 0, 7); x.ellipse(0, -30, 9, 17, 0, 0, 7, true); x.fill('evenodd'); x.stroke();
    rr(x, -9, -4, 18, 70, 5); x.fill(); x.stroke(); rr(x, -40, 6, 80, 17, 6); x.fill(); x.stroke();
  },
  SCARAB(x) {
    x.fillStyle = rg(x, 0, 0, 4, 70, ['#4ad8d0', '#1a8a9a', '#0a3a5a']); x.beginPath(); x.ellipse(0, 6, 42, 52, 0, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#06203a'; x.stroke();
    x.strokeStyle = '#06203a'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -46); x.lineTo(0, 58); x.stroke();
    x.fillStyle = '#e8b020'; x.beginPath(); x.ellipse(0, -46, 20, 12, 0, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = '#e8b020'; x.lineWidth = 5; for (const s of [-1, 1]) for (const dy of [-18, 8, 34]) { x.beginPath(); x.moveTo(s * 40, dy); x.lineTo(s * 62, dy + 10); x.stroke(); }
  },
  EYE(x) {
    x.fillStyle = '#f4f0e0'; x.strokeStyle = '#06203a'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(-64, 0); x.quadraticCurveTo(0, -56, 64, 0); x.quadraticCurveTo(0, 44, -64, 0); x.fill(); x.stroke();
    x.fillStyle = rg(x, 0, 0, 2, 22, ['#101010', '#1a4a9a', '#e8b020']); x.beginPath(); x.arc(0, -2, 20, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(6, -10, 5, 0, 7); x.fill();
    x.strokeStyle = '#e8b020'; x.lineWidth = 6; x.beginPath(); x.moveTo(-60, 4); x.quadraticCurveTo(-70, 30, -40, 56); x.stroke(); x.beginPath(); x.moveTo(20, 24); x.quadraticCurveTo(40, 40, 36, 62); x.stroke();
  },
  PHARAOH(x) {
    x.fillStyle = lg(x, 0, -64, 0, 64, ['#2a60c8', '#f6d040', '#2a60c8', '#f6d040']);
    x.beginPath(); x.moveTo(-44, -56); x.lineTo(44, -56); x.lineTo(56, 56); x.lineTo(-56, 56); x.closePath(); x.fill(); x.lineWidth = 5; x.strokeStyle = '#1a0a02'; x.stroke();
    x.fillStyle = '#d8a070'; x.beginPath(); x.ellipse(0, -4, 26, 34, 0, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#0a0a14'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 10, -10, 6, 3.5, 0, 0, 7); x.fill(); } x.fillRect(-9, 12, 18, 4);
    x.fillStyle = '#d8a020'; x.beginPath(); x.moveTo(-10, 34); x.lineTo(10, 34); x.lineTo(6, 56); x.lineTo(-6, 56); x.fill();
  },
  PYRAMID(x) {
    x.save(); x.beginPath(); x.arc(0, 0, 64, 0, 7); x.clip();
    x.fillStyle = lg(x, 0, -64, 0, 64, ['#1a2a6a', '#ff9a3a', '#ffe08a']); x.fillRect(-64, -64, 128, 128);
    x.fillStyle = '#fff6b0'; x.beginPath(); x.arc(30, -18, 15, 0, 7); x.fill();
    x.fillStyle = lg(x, -40, 0, 40, 40, ['#e8b050', '#a8721a']); x.beginPath(); x.moveTo(-58, 40); x.lineTo(0, -34); x.lineTo(58, 40); x.closePath(); x.fill();
    x.fillStyle = 'rgba(80,40,0,.5)'; x.beginPath(); x.moveTo(0, -34); x.lineTo(58, 40); x.lineTo(14, 40); x.closePath(); x.fill();
    x.fillStyle = '#c8943a'; x.fillRect(-64, 38, 128, 30); x.restore();
    x.lineWidth = 5; x.strokeStyle = '#f6c445'; x.beginPath(); x.arc(0, 0, 64, 0, 7); x.stroke();
  },
  EMU(x) {
    x.fillStyle = rg(x, 0, 0, 10, 64, ['#fff6a0', '#d8b070', '#8a5a2a']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill();
    x.fillStyle = '#4a3a2a'; x.beginPath(); x.ellipse(-8, 24, 36, 24, 0, 0, 7); x.fill();
    x.strokeStyle = '#4a3a2a'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(16, 14); x.quadraticCurveTo(40, -6, 26, -34); x.stroke();
    x.fillStyle = '#4a3a2a'; x.beginPath(); x.ellipse(28, -38, 15, 10, -0.4, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, -42, 4, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(33, -42, 2, 0, 7); x.fill();
    x.fillStyle = '#e8a020'; x.beginPath(); x.moveTo(40, -36); x.lineTo(54, -34); x.lineTo(40, -30); x.fill();
    x.strokeStyle = '#6a4a22'; x.lineWidth = 5; for (const dx of [-16, 0]) { x.beginPath(); x.moveTo(dx, 44); x.lineTo(dx + 4, 66); x.stroke(); }
    x.lineWidth = 5; x.strokeStyle = '#7a2a08'; x.beginPath(); x.arc(0, 0, 62, 0, 7); x.stroke();
  },
  BUFFALO(x) {
    x.fillStyle = rg(x, -6, -6, 6, 70, ['#8a5a3a', '#4a2a16', '#1a0c06']); x.beginPath(); x.ellipse(0, 6, 56, 54, 0, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#0a0402'; x.stroke();
    x.strokeStyle = '#eadcc0'; x.lineWidth = 11; x.lineCap = 'round'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 44, -22); x.quadraticCurveTo(s * 70, -34, s * 62, -62); x.stroke(); }
    x.fillStyle = '#2a1608'; x.beginPath(); x.ellipse(0, 30, 24, 20, 0, 0, 7); x.fill(); x.fillStyle = '#0a0402'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 9, 32, 4, 6, 0, 0, 7); x.fill(); }
    x.fillStyle = '#f6d040'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 24, -4, 7, 5, 0, 0, 7); x.fill(); } x.fillStyle = '#000'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 24, -4, 2.5, 0, 7); x.fill(); }
  },
  WOLF(x) {
    x.fillStyle = rg(x, 0, 0, 4, 64, ['#e0e4ea', '#8a909c', '#3a3e48']); x.beginPath(); x.moveTo(-50, -54); x.lineTo(-28, -30); x.lineTo(28, -30); x.lineTo(50, -54); x.lineTo(54, 4); x.lineTo(14, 56); x.lineTo(-14, 56); x.lineTo(-54, 4); x.closePath(); x.fill(); x.lineWidth = 5; x.strokeStyle = '#14161a'; x.stroke();
    x.fillStyle = '#f2f4f8'; x.beginPath(); x.moveTo(-14, 26); x.lineTo(14, 26); x.lineTo(8, 56); x.lineTo(-8, 56); x.fill();
    x.fillStyle = '#f6c820'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 20, -6, 8, 5, s * 0.3, 0, 7); x.fill(); } x.fillStyle = '#000'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 20, -6, 3, 0, 7); x.fill(); }
    x.fillStyle = '#111'; x.beginPath(); x.ellipse(0, 36, 9, 6, 0, 0, 7); x.fill();
  },
  EAGLE(x) {
    x.fillStyle = rg(x, 0, 0, 4, 64, ['#f6f2e8', '#c8b898', '#6a4a22']); x.beginPath(); x.ellipse(0, -4, 34, 44, 0, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#1a0e06'; x.stroke();
    x.fillStyle = '#4a2a10'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 30, 0); x.quadraticCurveTo(s * 80, -10, s * 74, 54); x.quadraticCurveTo(s * 50, 30, s * 30, 40); x.fill(); x.stroke(); }
    x.fillStyle = '#f6b81a'; x.beginPath(); x.moveTo(-9, -4); x.lineTo(9, -4); x.lineTo(0, 22); x.fill(); x.stroke();
    x.fillStyle = '#fff'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 14, -16, 6, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(s * 14, -16, 3, 0, 7); x.fill(); x.fillStyle = '#fff'; }
  },
  COUGAR(x) {
    x.fillStyle = rg(x, 0, 0, 4, 64, ['#f0d098', '#c89858', '#7a4a1a']); x.beginPath(); x.ellipse(0, 4, 50, 48, 0, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = '#2a1608'; x.stroke();
    for (const s of [-1, 1]) { x.fillStyle = '#c89858'; x.beginPath(); x.moveTo(s * 30, -34); x.lineTo(s * 46, -62); x.lineTo(s * 52, -20); x.fill(); x.stroke(); }
    x.fillStyle = '#f2e6c8'; x.beginPath(); x.ellipse(0, 28, 22, 16, 0, 0, 7); x.fill();
    x.fillStyle = '#9ad040'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 20, -6, 8, 5, 0, 0, 7); x.fill(); } x.fillStyle = '#000'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 20, -6, 2, 5, 0, 0, 7); x.fill(); }
    x.fillStyle = '#c05a4a'; x.beginPath(); x.moveTo(-7, 16); x.lineTo(7, 16); x.lineTo(0, 26); x.fill();
  },
  PAW(x) {
    x.fillStyle = rg(x, -10, -10, 4, 66, ['#fff6a0', '#f0b020', '#a86a08']); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill(); x.lineWidth = 6; x.strokeStyle = '#6a3a04'; x.stroke();
    x.fillStyle = '#3a1a04'; x.beginPath(); x.ellipse(0, 16, 24, 20, 0, 0, 7); x.fill();
    for (const [dx, dy] of [[-30, -10], [-12, -30], [12, -30], [30, -10]]) { x.beginPath(); x.ellipse(dx, dy, 9, 12, dx * 0.02, 0, 7); x.fill(); }
  }
});

// backdrops
const _drawScene = drawScene;
drawScene = function (x, scene, t) {
  if (scene === 'nile') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#0a1a4a', '#2a6ac8', '#f6c070']); x.fillRect(0, 0, SW, SH);
    x.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { x.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + i); x.fillRect((i * 151) % SW, (i * 67) % 260, 2, 2); } x.globalAlpha = 1;
    x.fillStyle = rg(x, 800, 250, 10, 120, ['#fff6b0', 'rgba(255,230,140,.4)', 'rgba(255,200,100,0)']); x.beginPath(); x.arc(800, 250, 120, 0, 7); x.fill();
    for (const [px, s] of [[160, 1.2], [420, 0.9], [650, 1.6]]) { x.fillStyle = '#c8943a'; x.beginPath(); x.moveTo(px - 110 * s, 470); x.lineTo(px, 470 - 150 * s); x.lineTo(px + 110 * s, 470); x.fill(); x.fillStyle = 'rgba(90,50,0,.45)'; x.beginPath(); x.moveTo(px, 470 - 150 * s); x.lineTo(px + 110 * s, 470); x.lineTo(px + 20 * s, 470); x.fill(); }
    x.fillStyle = '#d8b060'; x.fillRect(0, 470, SW, 300);
  } else if (scene === 'prairie') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#2a0a2a', '#d8501a', '#ffc860']); x.fillRect(0, 0, SW, SH);
    x.fillStyle = rg(x, 520, 330, 10, 200, ['#fff6a0', 'rgba(255,200,80,.5)', 'rgba(255,160,40,0)']); x.beginPath(); x.arc(520, 330, 200, 0, 7); x.fill();
    x.fillStyle = '#3a1020'; x.beginPath(); x.moveTo(0, 470); for (let i = 0; i <= 8; i++) x.lineTo(i * SW / 8, 340 + ((i * 53) % 90)); x.lineTo(SW, 470); x.fill();
    x.fillStyle = '#1a0610'; x.fillRect(0, 470, SW, 300);
  } else if (scene === 'outback') {
    x.fillStyle = lg(x, 0, 0, 0, SH, ['#4a1a3a', '#ff6a3a', '#ffcf5a']); x.fillRect(0, 0, SW, SH);
    x.fillStyle = '#fff3a0'; x.beginPath(); x.arc(760, 260, 70, 0, 7); x.fill();
    x.fillStyle = '#a0361a'; x.beginPath(); x.moveTo(0, 470); x.bezierCurveTo(120, 380, 260, 350, 420, 360); x.lineTo(640, 360); x.bezierCurveTo(780, 360, 900, 400, SW, 470); x.fill();
    x.fillStyle = '#5a2a10'; x.fillRect(0, 470, SW, 300);
  } else _drawScene(x, scene, t);
};

// ---- src/25-town.js ----

// =====================================================================
//  WATTLE CREEK MAIN STREET: the buildings either side of the Royal.
//  Every shopfront gets a painted facade (windows, awning, signage, plinth) with a matching emissive map so lit
//  windows and lightbox signs glow after dark; rooftop plant, downpipes and a parapet make the roofline read.
// =====================================================================
const Town = {
  mats: [], lastGlow: -1,
  glow(night) { if (Math.abs(night - this.lastGlow) < 0.02) return; this.lastGlow = night; for (const m of this.mats) m.emissiveIntensity = 0.04 + night * 1.3; },
};
const TOWN_KINDS = {
  hardware: { wall: '#6f808c', trim: '#e6e6e0', sign: ['#1a4a8a', '#fff', "CAMPBELL & SON HARDWARE"], shutter: true, awning: ['#1a4a8a', '#e8e8e8'] },
  bakery: { wall: '#8e3c2c', trim: '#f2e6c8', sign: ['#f2e8c8', '#5a2a14', 'WATTLE CREEK BAKERY'], awning: ['#c7352b', '#f4ead6'] },
  vacant: { wall: '#7b756a', trim: '#cfc8b8', sign: null, shutter: true, closed: true },
  newsagent: { wall: '#d9c9a2', trim: '#8a7a5a', sign: ['#c7352b', '#fff', 'NEWSAGENCY · LOTTO'], awning: ['#2a2a30', '#f2c230'] },
  chemist: { wall: '#c9d9cd', trim: '#5a7a66', sign: ['#1a8a4a', '#fff', 'WATTLE CHEMIST'], awning: ['#1a8a4a', '#f4f4ee'] },
  opshop: { wall: '#a9b9d1', trim: '#e8e8f0', sign: ['#8a2a6a', '#fff', 'SECOND CHANCE OP SHOP'], awning: ['#8a2a6a', '#f4ead6'] },
  offices: { wall: '#b9a98f', trim: '#6a5a44', sign: ['#2a2c34', '#e8c56a', 'GREENE & PARTNERS · SOLICITORS'], awning: null },
  brick: { wall: '#7a3a2a', trim: '#4a2a20', sign: null, awning: null },
};
function townRng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function texFacade(kind, wM, hM, seed) {
  const K = TOWN_KINDS[kind], rnd = townRng(seed), PX = 36, W = Math.min(1024, Math.round(wM * PX)), H = Math.round(hM * PX), s = W / wM;
  const c = mkCanvas(W, H), x = c.getContext('2d'), e = mkCanvas(W, H), ex = e.getContext('2d');
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  x.fillStyle = K.wall; x.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 500; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.05})`; x.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 10, 1 + rnd() * 4); }
  if (kind === 'brick') for (let y = 0; y < H; y += 5) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y, W, 1); for (let xx = (y / 5 % 2) * 8; xx < W; xx += 16) x.fillRect(xx, y, 1, 5); }
  const groundH = 3.3 * s, plinth = 0.5 * s;
  // parapet cap + cornice
  x.fillStyle = K.trim; x.fillRect(0, 0, W, 0.35 * s); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0.35 * s, W, 3);
  // upper floor windows
  if (hM > 4.8) {
    const ww = 1.1 * s, wh = 1.5 * s, gap = 2.6 * s, y0 = H - groundH - 0.5 * s - wh - 0.3 * s;
    for (let wx = 0.9 * s; wx + ww < W - 0.5 * s; wx += gap) {
      const lit = rnd() < 0.3;
      x.fillStyle = K.trim; x.fillRect(wx - 5, y0 - 5, ww + 10, wh + 10);
      x.fillStyle = lit ? '#ffcf80' : '#10141c'; x.fillRect(wx, y0, ww, wh);
      if (lit) { ex.fillStyle = '#ffb860'; ex.fillRect(wx, y0, ww, wh); x.fillStyle = 'rgba(80,40,10,.35)'; for (let by = y0 + 4; by < y0 + wh; by += 7) x.fillRect(wx, by, ww, 2); }
      x.fillStyle = K.trim; x.fillRect(wx + ww / 2 - 1, y0, 2, wh); x.fillRect(wx, y0 + wh * 0.45, ww, 2); x.fillRect(wx - 7, y0 + wh + 5, ww + 14, 5);
    }
  }
  // ground floor
  const gy = H - groundH;
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, H - plinth, W, plinth); x.fillStyle = 'rgba(255,255,255,.08)'; for (let tx = 0; tx < W; tx += 0.45 * s) x.fillRect(tx, H - plinth, 1, plinth);
  if (K.sign) { // lightbox sign band
    const sy = gy + 0.1 * s, sh = 0.75 * s;
    x.fillStyle = K.sign[0]; x.fillRect(0.5 * s, sy, W - s, sh); x.strokeStyle = K.trim; x.lineWidth = 3; x.strokeRect(0.5 * s, sy, W - s, sh);
    ex.fillStyle = K.sign[0]; ex.fillRect(0.5 * s, sy, W - s, sh);
    for (const g of [x, ex]) { g.fillStyle = K.sign[1]; g.font = `${Math.round(sh * 0.58)}px Rye, Bungee, Impact, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(K.sign[2], W / 2, sy + sh / 2 + 2, W - 1.4 * s); }
  }
  if (K.shutter) { // roller shutter
    x.fillStyle = '#7d8284'; x.fillRect(0.5 * s, gy + 1 * s, W - s, groundH - 1 * s - plinth); x.fillStyle = 'rgba(0,0,0,.28)'; for (let ry = gy + 1 * s; ry < H - plinth; ry += 5) x.fillRect(0.5 * s, ry, W - s, 1.5);
    if (K.closed) { x.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 6; i++) x.fillRect(rnd() * W, gy + rnd() * groundH, 30 + rnd() * 90, 3); }   // graffiti tags and grime
  } else { // shop window and door
    const wy = gy + (K.sign ? 1.0 : 0.5) * s, wh = groundH - (K.sign ? 1.0 : 0.5) * s - plinth - 0.1 * s, doorW = 1.1 * s, doorX = W * 0.3;
    x.fillStyle = K.trim; x.fillRect(0.4 * s, wy - 4, W - 0.8 * s, wh + 8);
    const gl = x.createLinearGradient(0, wy, 0, wy + wh); gl.addColorStop(0, '#2a323c'); gl.addColorStop(1, '#10151c'); x.fillStyle = gl; x.fillRect(0.5 * s, wy, W - s, wh);
    ex.fillStyle = '#ffcf90'; ex.globalAlpha = kind === 'offices' ? 0.2 : 0.55; ex.fillRect(0.5 * s, wy + wh * 0.3, W - s, wh * 0.7); ex.globalAlpha = 1;   // shop lights spilling through the glass
    x.fillStyle = 'rgba(255,255,255,.10)'; x.beginPath(); x.moveTo(0.5 * s, wy + wh); x.lineTo(0.5 * s + 80, wy); x.lineTo(0.5 * s + 150, wy); x.lineTo(0.5 * s + 70, wy + wh); x.fill();
    x.fillStyle = K.trim; x.fillRect(doorX - 3, wy, doorW + 6, wh); x.fillStyle = '#0a0d12'; x.fillRect(doorX, wy + 4, doorW, wh - 4); x.fillStyle = '#d8b050'; x.fillRect(doorX + doorW - 8, wy + wh * 0.5, 3, 24);
    for (let mx = 0.5 * s + 40; mx < W - 0.6 * s; mx += 70 + rnd() * 90) { if (mx > doorX - 10 && mx < doorX + doorW + 10) continue; x.fillStyle = K.trim; x.fillRect(mx, wy, 3, wh); }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const emap = new THREE.CanvasTexture(e); emap.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.9 }); Town.mats.push(mat);
  return mat;
}
function awningTex(a, b) { return mkTex(128, 64, (x, W, H) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * W / 8, 0, W / 8, H); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, H - 6, W, 6); }); }
function townBlock(x0, x1, zf, depth, h, facing, kind) {
  const K = TOWN_KINDS[kind], w = x1 - x0, cx = (x0 + x1) / 2, cz = zf + depth / 2 * (facing > 0 ? -1 : 1), seed = Math.round(x0 * 7 + zf * 3);
  const fac = texFacade(kind, w, h, seed), side = M({ map: TEX.brickDark, color: 0x9a8a80, roughness: 0.95 }, false), roof = M({ color: 0x4a4c50, roughness: 0.8 }, false);
  const faces = [side, side, roof, side, facing > 0 ? fac : side, facing > 0 ? side : fac];
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), faces); body.position.set(cx, h / 2, cz); body.castShadow = body.receiveShadow = true; scene.add(body);
  addColBox(x0, x1, cz - depth / 2, cz + depth / 2);
  const fz = zf + 0.0 * facing, rnd = townRng(seed + 11);
  // awning over the footpath
  if (K.awning) {
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w - 1.0, 0.06, 1.7), new THREE.MeshStandardMaterial({ map: awningTex(...K.awning), roughness: 0.8 })); aw.position.set(cx, 3.05, fz + 0.85 * facing); aw.rotation.x = 0.12 * facing; aw.castShadow = true; scene.add(aw);
    for (const ax of [x0 + 0.7, x1 - 0.7]) addCylS(SBX, MAT.iron, ax, 1.5, fz + 1.6 * facing, 0.03, 3.0, 8);
  }
  // parapet lip, downpipes, rooftop plant and an aerial
  SBX.add(G.box, MAT.iron, cx, h + 0.1, cz, 0, 0, 0, w + 0.1, 0.2, depth + 0.1);
  for (const px of [x0 + 0.25, x1 - 0.25]) addCylS(SBX, M({ color: 0x4a4e52, roughness: 0.6 }, false), px, h / 2, fz + 0.06 * facing, 0.04, h, 8);
  for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n; i++) SBX.add(G.box, MAT.shutter, x0 + 1.5 + rnd() * (w - 3), h + 0.55, cz + (rnd() - 0.5) * depth * 0.5, 0, 0, 0, 1.0 + rnd(), 0.7 + rnd() * 0.5, 0.9 + rnd() * 0.6);
  if (rnd() < 0.7) { const ax = x0 + 1 + rnd() * (w - 2); addCylS(SBX, MAT.iron, ax, h + 1.4, cz, 0.02, 2.4, 6); SBX.add(G.box, MAT.iron, ax, h + 2.3, cz, 0, 0, 0, 1.0, 0.03, 0.03); }
  return body;
}

// ---- src/26-dialogue.js ----

// =====================================================================
//  DIALOGUE: a small graph runner for real conversations.
//  A graph is { start, nodes: { id: { say, who?, mood?, do?, opts?, next?, end?, time?, timeout? } } }.
//  say   string | (ctx) => string | [lines]    {name} is replaced by the NPC's name
//  opts  [{ t, d?, if?(ctx), off?(ctx) => reason|false, cost?, check?: {stat, dc?}, go, pass?, fail?, do?(ctx), once? }]
//  A node with no opts shows Continue (-> next) or Leave (end).  time: seconds to answer, timeout: option index picked when it runs out.
//  ctx: { s, n, name, rel, drunk, mood, day, time, money, rep, mem (this NPC's persistent memory), flags, charm() }
//  Choices are remembered per character (flags.mem[key]) and arcs advance on flags.arc[key], both saved with the game.
// =====================================================================
const DLG = {
  graphs: {}, active: null, node: null, timer: 0, typed: 0, line: '', lineFull: '',
  def(id, g) { this.graphs[id] = g; return g; },
  mem(key) { const f = Game.state.flags; f.mem = f.mem || {}; return f.mem[key] || (f.mem[key] = {}); },
  arc(key) { const f = Game.state.flags; f.arc = f.arc || {}; return f.arc[key] || 0; },
  setArc(key, v) { const f = Game.state.flags; f.arc = f.arc || {}; f.arc[key] = v; },
  ctx(n, key) {
    const s = Game.state, name = (n && (n.regular || n.local || n.name)) || '', k = key || name, me = this;
    const c = { s, n, name, key: k, get rel() { return rel(k); }, drunk: s.drunk, mood: s.mood, day: s.day, time: s.time, money: s.wallet, rep: Night.rep(), mem: me.mem(k), flags: s.flags, venue: VENUE.id,
      done() { me.mem(k)['done_' + (me.active && me.active.id)] = 1; }, up(v) { relUp(k, v); }, cash(v) { s.wallet = Math.max(0, s.wallet + v); s.night.extra += v; if (v > 0) CashFX.receive(v); }, mood_(v) { s.mood = clamp(s.mood + v, 0, 100); }, standing(v, why) { Night.addRep(v, why); }, log(i, t) { Night.log(i, t); },
      // how persuasive you are right now: knowing them, a good mood and being only a little merry all help
      charm() { return clamp(45 + rel(k) * 0.35 + (s.mood - 50) * 0.25 - Math.abs(s.drunk - 22) * 0.45, 5, 95); } };
    return c;
  },
  // ------------------------------------------------------------ open / close
  open(id, n, opts = {}) {
    const g = this.graphs[id]; if (!g) { console.warn('no dialogue', id); return false; }
    const key = opts.key || (n && (n.regular || n.local || n.name)) || id;
    this.active = { id, g, n, key, opts, hist: [] };
    if (n) { n.a.talk = 999; }
    Game.uiOpen = true; document.exitPointerLock && document.exitPointerLock();
    $('talk').classList.remove('hidden'); document.body.classList.add('talking');
    const name = opts.name || (n && (n.regular || n.local || n.name)) || 'Someone';
    $('tName').textContent = name.toUpperCase();
    const p = $('tPort'); p.textContent = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2); p.style.background = opts.col || this.colour(name);
    this.go(g.start || 'start'); return true;
  },
  colour(name) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h},45%,38%)`; },
  close() {
    const A = this.active; if (!A) return;
    if (A.n) A.n.a.talk = 0;
    this.active = null; this.node = null; $('talk').classList.add('hidden'); document.body.classList.remove('talking');
    if (A.opts.onEnd) A.opts.onEnd();
    Game.uiOpen = false; if (Game.mode === 'play' && !player.seated && !MG.active) lockPointer();
  },
  // ------------------------------------------------------------ the runner
  say(v, c) { let t = typeof v === 'function' ? v(c) : v; if (Array.isArray(t)) t = t.join('<br><br>'); return String(t || '').replace(/\{name\}/g, c.name); },
  go(id) {
    const A = this.active; if (!A) return;
    const node = A.g.nodes[id]; if (!node) { this.close(); return; }
    const c = this.ctx(A.n, A.key); A.hist.push(id); this.node = node; this.nodeId = id;
    if (node.do) node.do(c);
    $('tSub').innerHTML = this.sub(A, c, node);
    this.lineFull = this.say(node.say, c); this.typed = 0; $('tLine').innerHTML = '';
    // build the options
    const box = $('tOpts'); box.innerHTML = ''; this.opts = [];
    const raw = node.opts || [{ t: node.next ? 'Continue' : 'Leave', go: node.next || null, end: !node.next }];
    for (const o of raw) {
      if (o.if && !o.if(c)) continue; if (o.once && c.mem['o_' + id + '_' + o.t]) continue;
      const off = o.off ? o.off(c) : (o.cost && c.money < o.cost ? `Need $${o.cost}` : false);
      const chance = o.check ? Math.round(this.chance(o.check, c)) : null;
      this.opts.push({ o, off, chance });
    }
    this.opts.forEach((it, i) => {
      const b = document.createElement('button'); b.className = 'topt' + (it.off ? ' off' : '') + (it.chance != null ? ' chk' : ''); b.disabled = !!it.off;
      const label = typeof it.o.t === 'function' ? it.o.t(c) : it.o.t, hint = typeof it.o.d === 'function' ? it.o.d(c) : it.o.d;
      b.innerHTML = `<kbd>${i + 1}</kbd><span>${label}${hint ? `<em>${hint}</em>` : ''}${it.off ? `<em class="why">${it.off}</em>` : ''}</span>${it.o.cost ? `<i class="cost">$${it.o.cost}</i>` : ''}${it.chance != null ? `<i class="chance">${it.o.check.stat || 'Charm'} ${it.chance}%</i>` : ''}`;
      b.onclick = () => this.pick(i); b.style.animationDelay = (0.15 + i * 0.07) + 's'; box.appendChild(b);
    });
    // the clock
    this.timer = node.time || 0; this.timerMax = this.timer; $('tTimer').style.display = this.timer ? '' : 'none';
  },
  sub(A, c, node) {
    const hearts = (A.opts.hearts !== false && rel(A.key) > 0) ? `<span class="hearts">${'♥'.repeat(Math.round(rel(A.key) / 20))}${'♡'.repeat(5 - Math.round(rel(A.key) / 20))}</span>` : '';
    return `${A.opts.bio || ''}${A.opts.bio && hearts ? ' · ' : ''}${hearts}${node.who ? ` · <b>${node.who}</b>` : ''}`;
  },
  chance(ch, c) { const st = String(ch.stat || 'Charm').toLowerCase(), base = st === 'nerve' ? clamp(40 + c.mood * 0.2 - c.drunk * 0.3, 5, 95) : st === 'luck' ? 50 : c.charm(); return clamp(base + (ch.dc ? 50 - ch.dc : 0) + (ch.bonus ? ch.bonus(c) : 0), 4, 96); },
  pick(i) {
    const A = this.active; if (!A) return; const it = this.opts[i]; if (!it || it.off) return;
    const o = it.o, c = this.ctx(A.n, A.key); SFX.click();
    if (o.once) c.mem['o_' + this.nodeId + '_' + o.t] = 1;
    if (o.cost) { if (!Game.spend(o.cost, o.cat || null)) return; if (!o.cat) Game.state.night.extra -= o.cost; }
    let dest = o.go;
    if (o.check) { const roll = Math.random() * 100, ok = roll < it.chance; dest = ok ? (o.pass || o.go) : (o.fail || o.go); this.flashRoll(ok, it.chance, Math.round(roll)); c.passed = ok; }
    if (o.do) o.do(c);
    if (this.active !== A) return;   // the option opened something else (another conversation, a game)
    if (o.end || !dest) { this.close(); return; }
    this.go(dest);
  },
  flashRoll(ok, chance, roll) { const e = $('tRoll'); e.textContent = ok ? `SUCCESS · ${chance}%` : `MISSED · ${chance}%`; e.className = ok ? 'ok on' : 'no on'; clearTimeout(this._rt); this._rt = setTimeout(() => e.classList.remove('on'), 1300); ok ? SFX.tone(880, 0.12, { gain: 0.05, type: 'triangle' }) : SFX.tone(180, 0.2, { gain: 0.06, type: 'sawtooth' }); },
  key(code) {
    if (!this.active) return false;
    if (code === 'Escape') { this.close(); return true; }
    if (code === 'Space' && this.typed < this.lineFull.length) { this.typed = this.lineFull.length; return true; }
    const m = /^(?:Digit|Numpad)(\d)$/.exec(code); if (m) { this.pick(+m[1] - 1); return true; }
    if (code === 'Space' || code === 'Enter') { if (this.opts.length === 1) this.pick(0); return true; }
    return true;
  },
  // typewriter + answer clock, called every frame while a conversation is open
  update(dt) {
    const A = this.active; if (!A) return;
    if (this.typed < this.lineFull.length) {
      this.typed = Math.min(this.lineFull.length, this.typed + dt * 70);
      const t = this.lineFull.slice(0, Math.floor(this.typed)), cut = t.lastIndexOf('<'), cl = t.lastIndexOf('>'); $('tLine').innerHTML = cut > cl ? t.slice(0, cut) : t;
      if (Math.floor(this.typed) % 3 === 0 && A.n) SFX.noise(0.03, { freq: rand(500, 900), q: 3, gain: 0.012, pos: A.n.pos.clone().add(V3(0, 1.6, 0)) });
    } else if ($('tLine').innerHTML !== this.lineFull) $('tLine').innerHTML = this.lineFull;
    if (this.timer > 0 && this.typed >= this.lineFull.length) {
      this.timer -= dt; $('tTimer').firstElementChild.style.width = (this.timer / this.timerMax * 100) + '%';
      if (this.timer <= 0) { const k = this.node.timeout; if (k != null && this.opts[k] && !this.opts[k].off) this.pick(k); else { const c = this.ctx(A.n, A.key); c.up(-2); this.close(); Game.toast(`${c.name} gets tired of waiting.`); } }
    }
    // face them
    if (A.n) { const dx = A.n.pos.x - camera.position.x, dz = A.n.pos.z - camera.position.z, want = Math.atan2(-dx, -dz); player.yaw += angleDiff(player.yaw, want) * Math.min(1, dt * 3); player.pitch += (-0.04 - player.pitch) * Math.min(1, dt * 3); }
  },
  // ------------------------------------------------------------ arcs: "dig deeper" beats for a character
  // arcs[key] = [{ id, need: (c) => bool, title }] in order; the next beat is offered when its condition holds and none was played tonight
  arcs: {},
  addArc(key, beats) { this.arcs[key] = beats; },
  nextBeat(key) {
    const list = this.arcs[key]; if (!list) return null; const s = Game.state; s.tonight.arcDone = s.tonight.arcDone || {};
    if (s.tonight.arcDone[key]) return null;
    const b = list[this.arc(key)]; if (!b) return null; const c = this.ctx(null, key);
    return b.need(c) ? b : null;
  },
  playBeat(key, n) {
    const b = this.nextBeat(key); if (!b) return false; Game.state.tonight.arcDone[key] = 1;
    return this.open(b.id, n, { key, bio: b.title, onEnd: () => { if (this.mem(key)['done_' + b.id]) this.setArc(key, this.arc(key) + 1); } });
  },
};
// a beat counts as played once one of its nodes calls c.done(), so walking off mid-conversation doesn't burn it

// ---- src/27-conversations.js ----

// =====================================================================
//  CONVERSATIONS: three "dig deeper" beats for each of the Royal's regulars, and the locals at the other pubs.
//  The choices matter: they move relationships, unlock things (the licence hint, a karaoke duet, the lucky flights,
//  mates' rates), shift the Save the Royal fund and the council vote ("goodwill"), and are remembered across nights.
// =====================================================================
function startPool(who) { const P = globalThis.PoolGame; if (P) P.offer(who); else Game.toast(`The table's booked tonight. ${who} says next week.`); }
const GW = c => { c.flags.goodwill = (c.flags.goodwill || 0) + 1; };   // community goodwill: counts towards the council vote
const need = (rl, arc, day = 0) => c => c.rel >= rl && DLG.arc(c.key) >= arc && c.day >= day;

// ---------------------------------------------------------------- OLD MICK
DLG.def('mick1', { start: 'a', nodes: {
  a: { say: ["He turns a creased photograph over in his big hands before he'll let you see it.", '"That\'s Joanie. Christmas dance at the Royal, nineteen seventy-one. She told me I danced like a bloke killing snakes."'], opts: [
    { t: '"She looks like she could handle you."', go: 'b', do: c => c.up(4) },
    { t: '"Is that why they pinched your plaque?" (a joke)', check: { stat: 'Charm', dc: 55 }, pass: 'c', fail: 'd' },
    { t: 'Say nothing. Buy him Joanie\'s drink.', d: 'A sweet sherry. She always had one.', cost: 7, cat: 'spentDrinks', go: 'e' }] },
  b: { say: '"Handle me? She ran me. Fifty-one years. Wouldn\'t let me pay a bill late, wouldn\'t let me skip church, and she\'d never ask for a thing. Best woman in the district."', next: 'z1' },
  c: { say: '"Ha! Ha! The PLAQUE. Joanie nicked it herself — said I\'d been warming that stool so long it deserved a medal. She hid it in the cellar. Still down there, I reckon."', do: c => { c.up(8); c.mem.plaque = 1; }, next: 'z1' },
  d: { say: '"That\'s not funny, son." He puts the photo away. "Not today."', do: c => c.up(-5), end: true },
  e: { say: ['You set the little glass on the bar in front of the empty stool beside him.', 'He doesn\'t say anything for a long time. Then he nods once, very slowly.', '"…Thanks, mate."'], do: c => { c.up(14); c.mem.sherry = 1; c.mood_(6); }, next: 'z1' },
  z1: { say: '"Come and see me again. I\'ve got something to show you. About the pub."', do: c => c.done(), end: true },
} });
DLG.def('mick2', { start: 'a', nodes: {
  a: { say: ['"You know the licence story? Joanie\'s grandad framed the Royal\'s original licence in eighteen eighty-eight. When Frank took over he stuck a footy photo on top of it. Front wall, by the door."', '"I\'m too old to get up there. Do us a favour. Have a look."'], opts: [
    { t: '"Leave it with me, Mick."', d: 'You can look behind the photo from tonight', go: 'b' },
    { t: '"That\'s just a pub legend, mate."', go: 'c' },
    { t: '"What\'s in it for the pub?"', go: 'd' }] },
  b: { say: '"Good lad. If it\'s there, it proves she\'s older than Federation. A council can\'t ignore that."', do: c => { c.up(10); c.flags.mickLicenceHint = true; c.done(); }, end: true },
  c: { say: '"Legend, is it." He looks at you for a bit. "Everything\'s a legend till someone checks."', do: c => { c.up(-6); c.flags.mickLicenceHint = true; c.done(); }, end: true },
  d: { say: '"A heritage listing is what\'s in it. Can\'t knock down a listed pub. Not even Clive Marsh can."', do: c => { c.up(4); c.flags.mickLicenceHint = true; c.done(); }, end: true },
} });
DLG.def('mick3', { start: 'a', nodes: {
  a: { say: ['Mick\'s sitting very straight tonight, hands flat on the bar.', '"I\'ve put it in writing. When I go — and it\'ll be soon, don\'t pretend — I want my ashes under the gum tree in the beer garden. Joanie\'s there already. Frank knows. But Frank\'s selling."', '"Will you make sure it happens? Whatever happens to this place."'], opts: [
    { t: '"I promise, Mick."', d: 'A promise is a promise', go: 'b' },
    { t: '"You\'ve got years left, mate."', go: 'c' },
    { t: '"I\'ll fight for the pub. Then you won\'t need to ask."', check: { stat: 'Nerve', dc: 50 }, pass: 'd', fail: 'c' }] },
  b: { say: '"Then I can rest easy." He pushes the plaque across the bar, the one Joanie hid. "This goes on the stool. Bolted down."', do: c => { c.up(25); c.flags.mickPromise = true; GW(c); c.log('🌳', 'Promised Mick the gum tree'); Night.addRep(3); c.done(); }, end: true },
  c: { say: '"Years." He chuckles. "Righto. Years."', do: c => { c.up(6); c.done(); }, end: true },
  d: { say: '"Then fight for her. Properly. Not just with a petition — with your feet. Turn up."', do: c => { c.up(20); c.flags.mickPromise = true; GW(c); c.mood_(10); c.done(); }, end: true },
} });
DLG.addArc('Old Mick', [{ id: 'mick1', title: "Joanie's photo", need: need(8, 0) }, { id: 'mick2', title: 'Behind the footy photo', need: need(25, 1, 1) }, { id: 'mick3', title: 'The gum tree', need: need(40, 2, 3) }]);

// ---------------------------------------------------------------- SHAZZA
DLG.def('shaz1', { start: 'a', nodes: {
  a: { say: ['Shazza slaps a glossy Bali brochure on the bar. There are Post-it flags in it.', '"Ten days in Kuta. I\'m $400 short and the flights go up Monday. Don\'t say anything. I know. I know."'], opts: [
    { t: 'Lend her $50', d: 'She\'ll pay you back', cost: 50, go: 'b' },
    { t: '"Maybe skip the third schooner a night?"', check: { stat: 'Charm', dc: 60 }, pass: 'c', fail: 'd' },
    { t: '"Bali sounds amazing, Shaz."', go: 'e' }] },
  b: { say: '"You ABSOLUTE legend. I\'ll pay you back with interest and a bracelet."', do: c => { c.up(14); c.flags.shazLoan = 1; c.log('🌴', 'Lent Shazza $50 for Bali'); c.done(); }, end: true },
  c: { say: '"Ugh. Fine. FINE. You\'re right. Water. For one whole night."', do: c => { c.up(10); c.mood_(3); c.flags.shazWater = 1; c.done(); }, end: true },
  d: { say: '"Oh, are you my mum now?" She laughs but it\'s sharp. "Sorry. Touchy subject."', do: c => { c.up(-4); c.done(); }, end: true },
  e: { say: '"RIGHT?! The beaches! The smoothies! I\'m going to be someone different over there."', do: c => { c.up(7); c.done(); }, end: true },
} });
DLG.def('shaz2', { start: 'a', nodes: {
  a: { say: ['"Karaoke, Friday. I need a duet partner. And it\'s you. I\'ve decided."', '"It\'s \'Islands In The Stream\'. You\'re Kenny. No arguments."'], opts: [
    { t: '"Deal. I\'ll be Kenny."', d: 'Your Friday karaoke score gets a boost', go: 'b' },
    { t: '"I can\'t sing, Shaz."', check: { stat: 'Charm', dc: 50 }, pass: 'c', fail: 'd' },
    { t: '"Only if you pay for the first round."', go: 'e' }] },
  b: { say: '"YES. We\'re going to bring the house DOWN."', do: c => { c.up(14); c.flags.shazDuet = true; c.done(); }, end: true },
  c: { say: '"Nobody can, babe, that\'s what the Dolly part\'s for. You\'ll be a lovely terrible Kenny."', do: c => { c.up(8); c.flags.shazDuet = true; c.done(); }, end: true },
  d: { say: '"…fine, I\'ll ask Davo." She does not look pleased.', do: c => { c.up(-3); c.done(); }, end: true },
  e: { say: '"Cheeky! …Deal."', do: c => { c.up(6); c.flags.shazDuet = true; c.done(); }, end: true },
} });
DLG.def('shaz3', { start: 'a', nodes: {
  a: { say: ['Shazza is not laughing. That\'s how you know it\'s serious.', '"Can I tell you something? That Bali money? Eleven years I\'ve been putting a twenty a week in the jar behind the bar. For the roof fund. Never told anyone. Bev knows."', '"If they sell, I\'ll have been paying for somebody else\'s apartment block."'], opts: [
    { t: '"You\'re the heart of this place, Shaz."', go: 'b' },
    { t: '"Then let\'s make sure they can\'t."', go: 'c' },
    { t: 'Squeeze her hand. Say nothing.', go: 'd' }] },
  b: { say: '"Stop it, I\'ll ruin my eyeliner."', do: c => { c.up(12); STORY.addFund(60, 'Shazza emptied her Bali envelope into the jar'); GW(c); c.done(); }, end: true },
  c: { say: '"There it is. There\'s the person Bev said you were."', do: c => { c.up(15); STORY.addFund(100, 'Shazza matched your pledge'); GW(c); c.done(); }, end: true },
  d: { say: 'She squeezes back, hard. Then she sniffs, grabs a napkin, and is Shazza again. "Right. Who\'s getting the drinks?"', do: c => { c.up(10); STORY.addFund(30); c.done(); }, end: true },
} });
DLG.addArc('Shazza', [{ id: 'shaz1', title: 'The Bali fund', need: need(8, 0) }, { id: 'shaz2', title: 'The duet', need: need(25, 1) }, { id: 'shaz3', title: 'Eleven years of twenties', need: need(40, 2, 3) }]);

// ---------------------------------------------------------------- DAVO
DLG.def('davo1', { start: 'a', nodes: {
  a: { say: ['Davo\'s phone lights up on the ledge. KYLIE ♥. He stares at it until it stops. It starts again.', '"She knows. About last week. Don\'t say anything to her if she comes in, yeah?"'], time: 20, timeout: 1, opts: [
    { t: '"Answer it, Davo."', go: 'b' },
    { t: '"Not my business, mate."', go: 'c' },
    { t: '"If she asks, I haven\'t seen you."', d: 'Cover for him', go: 'd' }] },
  b: { say: 'He stares at you. Then he answers. "Yeah. …Yeah, I\'m at the Royal. …I know. I KNOW. …Okay. Okay. I\'ll come home." He hangs up, shaking.', do: c => { c.up(12); c.flags.davoGood = (c.flags.davoGood || 0) + 1; c.log('📞', 'Told Davo to answer Kylie'); c.done(); }, next: 'b2' },
  b2: { say: '"Cheers. I\'d have let it ring out. Again."', end: true },
  c: { say: '"Yeah. Yeah. Fair enough." The phone rings out.', do: c => { c.up(-2); c.done(); }, end: true },
  d: { say: '"You\'re a good bloke." He doesn\'t look at you when he says it.', do: c => { c.up(5); c.flags.davoGood = Math.max(0, (c.flags.davoGood || 0) - 1); c.done(); }, end: true },
} });
DLG.def('davo2', { start: 'a', nodes: {
  a: { say: ['Davo\'s slumped at the machine, credit meter blinking $0.00.', '"I\'ve got a card in my wallet. Gambling Help. Somebody put it there. I haven\'t… I don\'t…"', 'He holds it out like it\'s hot.'], opts: [
    { t: '"I\'ll walk you out front. Let\'s ring them."', d: 'Be there for him', go: 'b' },
    { t: '"Keep it. Just in case."', go: 'c' },
    { t: '"Last go. She\'s due."', d: 'Tell him what he wants to hear', go: 'd' }] },
  b: { say: ['You stand on the footpath while he talks to a stranger on the phone for twenty minutes. His voice gets steadier.', '"They\'ve got a counsellor Thursday. I\'m going."'], do: c => { c.up(20); c.flags.davoGood = (c.flags.davoGood || 0) + 2; c.mood_(8); c.log('📞', 'Walked Davo out to ring Gambling Help'); GW(c); c.done(); }, end: true },
  c: { say: '"Yeah. In case." He tucks it in his wallet, behind the photo of the kids.', do: c => { c.up(8); c.flags.davoGood = (c.flags.davoGood || 0) + 1; c.done(); }, end: true },
  d: { say: '"…Yeah. Last go." He feeds the machine his last twenty. You watch it go.', do: c => { c.up(-8); c.flags.davoGood = Math.max(0, (c.flags.davoGood || 0) - 2); c.mood_(-5); c.done(); }, end: true },
} });
DLG.def('davo3', { start: 'a', nodes: {
  a: { say: ['Davo\'s in a clean shirt. He smells of soap. He is holding a Coke.', '"Thirteen days. I wanted you to be first to know. Kylie\'s picking me up at ten and she\'s bringing the kids. We\'re doing pizza."'], opts: [
    { t: '"Mate. I\'m proud of you."', go: 'b' },
    { t: 'Shout him a lemon squash. "To thirteen."', cost: 4, go: 'c' },
    { t: '"Don\'t let the pub drag you back in."', check: { stat: 'Charm', dc: 55 }, pass: 'd', fail: 'e' }] },
  b: { say: '"Don\'t. You\'ll set me off."', do: c => { c.up(15); GW(c); c.done(); }, end: true },
  c: { say: 'He holds it up. "Thirteen." You clink.', do: c => { c.up(18); GW(c); c.done(); }, end: true },
  d: { say: '"I know. I\'ve told the boys. Not here after dark. Not yet." He grins. "I\'ll come for the parma."', do: c => { c.up(12); GW(c); c.done(); }, end: true },
  e: { say: '"Hey. Easy. I\'m doing the work."', do: c => { c.up(-3); c.done(); }, end: true },
} });
DLG.addArc('Davo', [{ id: 'davo1', title: "Kylie's calling", need: need(8, 0) }, { id: 'davo2', title: 'The card in his wallet', need: need(22, 1, 1) }, { id: 'davo3', title: 'Thirteen days', need: c => c.rel >= 35 && DLG.arc(c.key) >= 2 && c.day >= 4 && (c.flags.davoGood || 0) >= 3 }]);

// ---------------------------------------------------------------- KENNO
DLG.def('kenno1', { start: 'a', nodes: {
  a: { say: ['Kenno\'s chalking up the board with great ceremony.', '"Royal Darts Comp. Saturday arvo. Sixteen entries. I\'ve won it twice. You\'re not on the sheet. Why aren\'t you on the sheet?"'], opts: [
    { t: '"Put me down."', d: 'You\'ll play in the Saturday comp', go: 'b' },
    { t: '"I\'d embarrass myself."', check: { stat: 'Charm', dc: 55 }, pass: 'c', fail: 'd' },
    { t: '"Fifty bucks says I beat you."', go: 'e' }] },
  b: { say: '"Atta boy. Elbow up. Eyes on the treble."', do: c => { c.up(12); c.flags.compEntered = true; c.done(); }, end: true },
  c: { say: '"Everyone\'s embarrassed their first time, mate. Ask me about 2006." He writes your name down anyway.', do: c => { c.up(10); c.flags.compEntered = true; c.done(); }, end: true },
  d: { say: '"Suit yourself. More glory for me."', do: c => { c.up(-3); c.done(); }, end: true },
  e: { say: 'He laughs for a very long time. "You\'re on. Not tonight — Saturday. Bring your wallet."', do: c => { c.up(8); c.flags.compEntered = true; c.flags.kennoBet = true; c.done(); }, end: true },
} });
DLG.def('kenno2', { start: 'a', nodes: {
  a: { say: ['"See that bloke in the RSL jersey? Big Terry. Pinched my trophy off me in \'14 at the Surfie. Never forgave him."', '"I\'m not saying you should sabotage his arrows. I\'m saying a man should have a hobby."'], opts: [
    { t: '"We could challenge him properly."', go: 'b' },
    { t: '"Let it go, Kenno."', go: 'c' },
    { t: '"What did he do exactly?"', go: 'd' }] },
  b: { say: '"A challenge match at the RSL. Winner takes the trophy and the bragging rights. Oh, I like you."', do: c => { c.up(14); c.flags.kennoRival = true; c.done(); }, end: true },
  c: { say: '"Easy for you to say. Your trophy wasn\'t used as a doorstop."', do: c => { c.up(2); c.done(); }, end: true },
  d: { say: '"He said — in front of everybody — that my grouping was \'agricultural\'." He is still hurt.', do: c => { c.up(6); c.done(); }, end: true },
} });
DLG.def('kenno3', { start: 'a', nodes: {
  a: { say: ['Kenno puts his case on the bar and opens it. Three arrows nest in worn red felt, flights frayed.', '"Forty years. Never lent them to anyone. They\'ve found a lot of trebles and a lot of dartboards\' edges."', '"You throw like a bloke who\'s listening. Take them."'], opts: [
    { t: '"I can\'t take your arrows, Kenno."', go: 'b' },
    { t: 'Take them. Carefully.', go: 'c' }] },
  b: { say: '"You can and you will. Rule is: they stay at the Royal. Whoever plays for the Royal, plays with those."', next: 'c' },
  c: { say: 'They\'re warm from his hand and heavier than they look.', do: c => { c.up(25); c.flags.dartTip = true; c.flags.luckyFlights = true; GW(c); c.log('🎯', "Kenno handed over his lucky flights"); c.done(); }, end: true },
} });
DLG.addArc('Kenno', [{ id: 'kenno1', title: 'The Royal darts comp', need: need(8, 0) }, { id: 'kenno2', title: 'Big Terry', need: need(25, 1, 1) }, { id: 'kenno3', title: 'Forty years of arrows', need: need(42, 2, 3) }]);

// ---------------------------------------------------------------- BEV
DLG.def('bev1', { start: 'a', nodes: {
  a: { say: ['Bev has a ledger open, a pencil behind her ear and a very flat expression.', '"Frank hasn\'t paid the cleaning bill since March. The roof fund\'s forty dollars. I do the books for free, love, and I\'m telling you: this pub could be saved by one good year."'], opts: [
    { t: '"What\'s the one good year look like?"', go: 'b' },
    { t: '"Can I help with the books?"', check: { stat: 'Charm', dc: 50 }, pass: 'c', fail: 'd' },
    { t: 'Put $20 in the roof fund jar.', cost: 20, go: 'e' }] },
  b: { say: '"Busy Thursdays. A proper Friday. Trivia that fills the lounge. And somebody sensible running the raffle." She taps the ledger. "Me. I can do that."', do: c => { c.up(8); c.done(); }, end: true },
  c: { say: 'She slides the ledger to you. You find $340 of double-billed beer deliveries. She stares at it. Then at you. "Oh, you are GOOD."', do: c => { c.up(16); STORY.addFund(40, 'You found $340 in double-billed deliveries'); GW(c); c.done(); }, end: true },
  d: { say: '"Thanks, love. I\'ve got it." She closes the ledger.', do: c => { c.up(-2); c.done(); }, end: true },
  e: { say: '"Bless you."', do: c => { c.up(10); STORY.addFund(20); c.done(); }, end: true },
} });
DLG.def('bev2', { start: 'a', nodes: {
  a: { say: ['"Frank\'s in the office with Clive Marsh\'s lawyer. He won\'t look at me. He\'s sixty-eight and tired and he\'s got an offer for four million."', '"If someone — a friendly face — took him a schooner and reminded him whose pub it was…"'], opts: [
    { t: 'Take Frank a schooner and talk to him.', d: 'Check: Charm', check: { stat: 'Charm', dc: 55 }, pass: 'b', fail: 'c' },
    { t: '"I\'m not going near that."', go: 'd' }] },
  b: { say: ['You find Frank staring at a photograph of the Royal\'s centenary. You don\'t say much. You don\'t need to.', 'He lets out a long breath. "Tell Bev I\'ll hold off on signing till the council\'s had a look."'], do: c => { c.up(18); c.flags.frankStalls = true; GW(c); c.done(); }, end: true },
  c: { say: 'Frank takes the schooner, thanks you politely, and doesn\'t change a single thing.', do: c => { c.up(4); c.done(); }, end: true },
  d: { say: '"No, love. Fair enough. I\'ll try Mick."', do: c => { c.up(-4); c.done(); }, end: true },
} });
DLG.def('bev3', { start: 'a', nodes: {
  a: { say: ['"Here\'s the thing. A community trust can bid for the freehold. The bank wants a guarantor to put his name behind the first hundred. Not hand it over, love — just have your name on the paper."', '"You\'d be on the hook if it all goes wrong. It\'s a lot to ask."'], opts: [
    { t: '"Put my name down."', d: 'A real risk: it costs $100 now', cost: 100, go: 'b' },
    { t: '"I can\'t. I\'m skint."', go: 'c' },
    { t: '"What if I just come to the meeting?"', go: 'd' }] },
  b: { say: 'She writes your name in careful capitals. "Wattle Creek Hotel Community Trust. Founding member number one."', do: c => { c.up(30); STORY.addFund(100, 'You put your name on the trust'); c.flags.guarantor = true; GW(c); GW(c); c.log('📜', 'Became founding member of the community trust'); Night.addRep(5); achieve('trust'); c.done(); }, end: true },
  c: { say: '"Course you are, love. No shame in it."', do: c => { c.up(2); c.done(); }, end: true },
  d: { say: '"Oh, I\'ll take that. A warm body at that meeting is worth its weight."', do: c => { c.up(10); c.done(); }, end: true },
} });
DLG.addArc('Bev', [{ id: 'bev1', title: 'The books', need: need(8, 0) }, { id: 'bev2', title: 'Frank in the office', need: need(25, 1, 2) }, { id: 'bev3', title: 'The guarantor', need: need(42, 2, 4) }]);

// ---------------------------------------------------------------- SPUD
DLG.def('spud1', { start: 'a', nodes: {
  a: { say: ['Spud has his work boots up on the stool and his phone in his hand. He looks about twelve.', '"Boss says he\'s \'letting me go at the end of the month\'. I\'m two years into a four year apprenticeship. What do I do?"'], opts: [
    { t: '"Ask for it in writing. It\'s not legal otherwise."', go: 'b' },
    { t: '"Tell him to get stuffed. Find a better sparky."', go: 'c' },
    { t: '"Want me to come and have a chat with him?"', check: { stat: 'Nerve', dc: 50 }, pass: 'd', fail: 'e' }] },
  b: { say: '"Writing. Right. That\'s smart. I\'ll ask in the morning."', do: c => { c.up(12); c.flags.spudWriting = true; c.done(); }, end: true },
  c: { say: '"I… yeah. Can\'t afford to, though."', do: c => { c.up(4); c.done(); }, end: true },
  d: { say: 'You do. You\'re polite and extremely patient. The boss goes grey. Spud keeps his job.', do: c => { c.up(25); GW(c); c.done(); }, end: true },
  e: { say: 'You go in too hard. The boss laughs at you. Spud looks at his boots. "…Cheers for trying."', do: c => { c.up(2); c.done(); }, end: true },
} });
DLG.def('spud2', { start: 'a', nodes: {
  a: { say: ['"I\'ve been practising. Eight ball, Saturday, a tenner. You and me." He\'s grinning but the grin\'s thin.', '"Honestly, I need the win. Rent."'], opts: [
    { t: 'Play him.', d: 'On the house table', go: 'b' },
    { t: 'Give him $10 and say you lost.', cost: 10, go: 'c' },
    { t: '"Rent comes from a job, mate. Not pool."', go: 'd' }] },
  b: { say: '"You beauty. I\'ll rack."', do: c => { c.up(8); startPool('Spud'); c.done(); }, end: true },
  c: { say: '"Oh. Oh, mate. You didn\'t have to…" He takes it. His ears go red.', do: c => { c.up(16); c.done(); }, end: true },
  d: { say: '"…Yeah." He looks at the table. "Yeah. That\'s fair."', do: c => { c.up(6); c.flags.spudNoGamble = true; c.done(); }, end: true },
} });
DLG.def('spud3', { start: 'a', nodes: {
  a: { say: ['Spud pulls a fistful of electrical tape and a multimeter out of his back pocket.', '"Right. The Royal\'s wiring is a crime. Bev says I can rewire the neon and the fuse board, on the cheap, as a favour. Needs a second pair of hands, one night. Interested?"'], opts: [
    { t: '"Count me in."', d: 'Spud\'s mates\' rates at the bar for you', go: 'b' },
    { t: '"I\'d probably electrocute us both."', go: 'c' }] },
  b: { say: 'You hold a torch for two hours. Nothing explodes. Afterwards Spud gets the boss to knock fifty cents off every round "for the sparkies".', do: c => { c.up(25); c.flags.spudMates = true; GW(c); c.log('⚡', 'Helped Spud rewire the neon'); c.done(); }, end: true },
  c: { say: '"Fair call. Probably."', do: c => { c.up(3); c.done(); }, end: true },
} });
DLG.addArc('Spud', [{ id: 'spud1', title: 'Skint sparky', need: need(8, 0) }, { id: 'spud2', title: 'Eight ball for rent', need: need(25, 1) }, { id: 'spud3', title: 'The rewire', need: need(42, 2, 3) }]);
ACH_LIST.push(['trust', 'Founding Member', 'Put your name on the community trust.']);

// ---------------------------------------------------------------- LOCALS AT THE OTHER PUBS
const LOCALS = {
  rsl: [
    { name: 'Digger Dave', look: { fem: false, skinI: 1, shirt: { tile: 'collar', c: 0x1a2a4a }, pants: { tile: 'cloth', c: 0x2a2a30 }, hair: 0xe8e8e8, style: 'short', scale: 0.96, girth: 1.0, beard: 'mo', glasses: false }, spot: s => s.kind === 'stool' && s.area === 'bar', bio: 'Vietnam. Two-up Tuesdays. Sixty-one years a member.' },
    { name: 'Lorraine', look: { fem: true, skinI: 0, shirt: { tile: 'collar', c: 0x2a5a8a }, pants: { tile: 'cloth', c: 0x1a1a22 }, hair: 0xcfa070, style: 'bob', scale: 0.95, girth: 1.0, glasses: true }, spot: s => s.kind === 'chair' && s.area === 'lounge', bio: 'Runs the Members\' Draw. Sees everything.' },
  ],
  dive: [
    { name: 'Tiny', look: { fem: false, skinI: 3, shirt: { tile: 'collar', c: 0x121212 }, pants: { tile: 'cloth', c: 0x15151a }, hair: 0x1a1210, style: 'short', scale: 1.08, girth: 1.4, beard: 'full', glasses: false }, spot: s => s.kind === 'stand' && s.area === 'bar', bio: "The bouncer. Six foot six. Won't hurt a fly. Will hurt a bloke who hurts a fly." },
    { name: 'Slick Rick', look: { fem: false, skinI: 2, shirt: { tile: 'hoops', c: 0x203060 }, pants: { tile: 'denim', c: 0xffffff }, hair: 0x2a1a0a, style: 'mullet', girth: 0.9, beard: 'mo' }, spot: s => s.kind === 'pool' || (s.kind === 'stool' && s.area === 'bar'), bio: 'Pool hustler. Has never once lost a game he cared about.' },
  ],
};
// generic hub for a local: yarn (their arc), shout them a drink, ask about the place, a tip
function localHub(key, lore, tipLines) {
  DLG.def(key + '.hub', { start: 'a', nodes: {
    a: { say: c => c.mem.met ? choice(['Back again. Good.', 'Mate. Pull up a stool.', "Look who it is."]) : (c.mem.met = 1, `"${choice(['New face. Welcome.', "Haven't seen you in here before.", 'G\'day. First time?'])}"`), opts: [
      { t: 'Have a proper yarn', d: () => (DLG.nextBeat(key) || {}).title, do: c => { DLG.close(); DLG.playBeat(key, c.n); }, end: true, if: c => !!DLG.nextBeat(key) },
      { t: 'Have a yarn', go: 'chat', if: c => !DLG.nextBeat(key) },
      { t: c => `Shout ${c.name} a drink`, go: 'shout', cost: 6, if: c => !c.s.tonight['shout_' + key] },
      { t: 'Ask about the place', go: 'lore' },
      { t: 'Ask for a tip', go: 'tip', if: c => c.rel >= 15 },
      { t: 'See ya', end: true }] },
    chat: { say: () => `"${choice(tipLines.chat)}"`, do: c => { if (!c.s.tonight['talk_' + key]) { c.s.tonight['talk_' + key] = 1; c.up(5); c.mood_(3); } }, next: 'a' },
    shout: { say: () => `"${choice(['You beauty.', "Cheers, mate. I'll get the next one.", 'A gentleman and a scholar.'])}"`, do: c => { c.s.tonight['shout_' + key] = 1; c.up(10); Night.ev('shouted'); Night.log('🍺', `Shouted ${c.name} a drink`); }, next: 'a' },
    lore: { say: lore, next: 'a' },
    tip: { say: () => `"${choice(tipLines.tip)}"`, do: c => c.up(1), next: 'a' },
  } });
}
localHub('Digger Dave', '"Wattle Creek RSL opened in 1921. We\'ve got a courtesy bus, a meat raffle on Fridays and a plaque with the names of every local who went. I read it every Anzac Day. All of them."', {
  chat: ['Two-up Tuesdays used to be illegal except Anzac Day. We played anyway.', "The schnitty's the best in the shire. Don't tell the Royal I said so.", 'Marg runs the bistro like a drill sergeant. We love her.'],
  tip: ["Number four on the Thunder Empire's been paying better than the rest. Doesn't mean a thing, mind.", "Bet small and leave while you're up. That's the only system there is."]
});
localHub('Lorraine', '"I\'ve run the Members\' Draw since 1994. Every Friday: the badge draw, the raffle, the jackpot. If your name\'s in the drum and you\'re not here, it goes back in. Rules."', {
  chat: ["I know everyone's business and I'll take it to my grave. Mostly.", 'The club puts back more than the pokies take out. Ask me about the netball courts.', 'You look like you need a cuppa more than a pot.'],
  tip: ['Back the 4 horse in race 3. Not advice. I just like his name.', 'Never leave your handbag on the floor in this place. Not because of thieves. Because of the dogs.']
});
localHub('Tiny', '"Rusty Anchor\'s been here since \'64. Fishermen first, then wharfies, then everyone. I keep it quiet. I ask nicely first, twice, and then I\'m not so nice."', {
  chat: ["Don't mind the stickiness. It's heritage.", 'Last bloke who tried to take a stool outside brought it back himself, apologising.', 'You can leave your drink if you want a dance. I\'ll watch it.'],
  tip: ["If you get in a barney, don't swing first. I see everything.", "Cab rank's on the corner. Don't walk past the bait shop on your own."]
});
localHub('Slick Rick', '"Table\'s level, cues are straight, the felt\'s older than me. It\'s the best table in three towns, and I\'d tell you why but then you\'d be better."', {
  chat: ["I play a dollar a game and I never lose. Funny, that.", 'Everything\'s angles, mate. Pool. Life. The odds on the TAB. Angles.', 'I once played a bloke for his ute. I won the ute. Gave it back. Never touched pool again. For a week.'],
  tip: ["Don't play for money until you can run a rack. Never play for the rent.", "Machine three on the left's due. Joking. They're all random. Remember that."]
});
DLG.def('digger1', { start: 'a', nodes: {
  a: { say: ['Digger Dave rubs a thumb over a worn brass badge on his lapel.', '"Fifty-four years old when I got this. Can you believe that? I thought the Army was over for me. Then came the call, and then the jungle."', '"Do you know what I came home to? A bloke in a tie telling me to take my medals off on the bus."'], opts: [
    { t: '"I\'m sorry, Dave."', go: 'b' },
    { t: '"What did you do?"', go: 'c' },
    { t: 'Buy him a pot.', cost: 6, cat: 'spentDrinks', go: 'd' }] },
  b: { say: '"No need, son. It\'s the ones who didn\'t come home. I\'m just the one who did."', do: c => { c.up(10); c.done(); }, end: true },
  c: { say: '"Took them off, got on the bus, rang my mum from the pay phone, and cried my eyes out. First and last time. Then I joined the RSL."', do: c => { c.up(14); c.done(); }, end: true },
  d: { say: 'He takes the pot, holds it up to the empty chair next to him, and drinks half of it in one go. "Ta."', do: c => { c.up(16); c.done(); }, end: true },
} });
DLG.def('digger2', { start: 'a', nodes: {
  a: { say: ['"Two-up. Tuesdays. Fifty cents a spin, kids play for lollies. It\'s the one day of the year it\'s legal and the one day I\'d like to beat Kev Jones. Will you spin for me?"', 'He holds out two pennies and a wooden kip.'], opts: [
    { t: 'Spin for him. "Heads!"', check: { stat: 'Luck', dc: 50, bonus: () => 0 }, pass: 'b', fail: 'c' },
    { t: '"I don\'t gamble, Dave."', go: 'd' }] },
  b: { say: 'Two heads. Dave whoops like a man half his age. "Beat Kev! BEAT KEV!" He buys you a schooner.', do: c => { c.up(18); c.cash(0); c.mood_(10); c.done(); }, end: true },
  c: { say: 'Tails. Dave shrugs. "Well, Kev\'s a prick anyway."', do: c => { c.up(10); c.done(); }, end: true },
  d: { say: '"Good on you. Smartest man in the room." He pockets the pennies.', do: c => { c.up(12); c.done(); }, end: true },
} });
DLG.addArc('Digger Dave', [{ id: 'digger1', title: 'The brass badge', need: need(8, 0) }, { id: 'digger2', title: 'Two-up', need: need(25, 1) }]);
DLG.def('lorraine1', { start: 'a', nodes: {
  a: { say: ['"Raffle\'s down on tickets. And I\'ll tell you why. There\'s a poker machine room out the back that doesn\'t need a raffle to fill it."', '"The club\'s paid for a minibus, a netball court and the footy club\'s lights with that money. I know what it costs, too. I see it every Friday."'], opts: [
    { t: '"It\'s complicated, Lorraine."', go: 'b' },
    { t: '"Maybe a cap on how much a person can lose a night?"', go: 'c' },
    { t: 'Buy ten tickets.', cost: 10, go: 'd' }] },
  b: { say: '"Isn\'t it just."', do: c => { c.up(8); c.done(); }, end: true },
  c: { say: '"Pre-commitment cards. Yes. Don\'t think I haven\'t pushed. The board says it\'s \'bad for the experience\'." She says the last words like they taste of metal.', do: c => { c.up(14); c.done(); }, end: true },
  d: { say: 'She counts them out slowly. "Good on you. Doesn\'t fix the problem. But it\'s a start."', do: c => { c.up(12); Game.raffle.tickets += 5; c.done(); }, end: true },
} });
DLG.def('lorraine2', { start: 'a', nodes: {
  a: { say: ['"I\'m retiring in June. After thirty years. Nobody\'s lined up to run the Draw. Would you ever consider it?"'], opts: [
    { t: '"I\'ll help. A couple of Fridays."', go: 'b' },
    { t: '"I\'m only in town a week."', go: 'c' }] },
  b: { say: '"Ha! A couple of Fridays. That\'s how it starts. Here — hold the drum."', do: c => { c.up(16); c.standing(3, 'Held the drum at the Members\' Draw'); c.done(); }, end: true },
  c: { say: '"Course. Well. If you ever change your mind."', do: c => { c.up(4); c.done(); }, end: true },
} });
DLG.addArc('Lorraine', [{ id: 'lorraine1', title: 'The Members\' Draw', need: need(8, 0) }, { id: 'lorraine2', title: 'Who takes over', need: need(25, 1) }]);
DLG.def('tiny1', { start: 'a', nodes: {
  a: { say: ['"Everyone thinks I\'m paid to throw people out. I\'m paid to make sure nobody has to get thrown out. That\'s the job."', '"Last week I walked a lad home. Nineteen. Drank too much, couldn\'t stand. I put him in a cab and stood on the footpath till it turned the corner. That\'s the job."'], opts: [
    { t: '"That\'s a good job, Tiny."', go: 'b' },
    { t: '"Do you ever get scared?"', go: 'c' },
    { t: '"Could you walk me home tonight?"', go: 'd' }] },
  b: { say: '"It is." He nods. "It really is."', do: c => { c.up(12); c.done(); }, end: true },
  c: { say: '"Every night. Fear\'s what keeps you honest." He grins. "Don\'t tell anyone."', do: c => { c.up(14); c.done(); }, end: true },
  d: { say: '"Of course. Just say when."', do: c => { c.up(10); c.flags.tinyWalk = true; c.done(); }, end: true },
} });
DLG.def('tiny2', { start: 'a', nodes: {
  a: { say: ['A bloke at the bar is getting loud. Tiny puts a hand flat on the bar, not looking at him.', '"Watch this. Lesson one." He steps over, says three quiet words, and the bloke deflates like a tyre. He comes back.', '"You try."'], opts: [
    { t: 'Try it on the next loud bloke.', check: { stat: 'Nerve', dc: 55 }, pass: 'b', fail: 'c' },
    { t: '"I\'ll leave that to the professionals."', go: 'd' }] },
  b: { say: 'You walk up. You don\'t quite know what you say. But the bloke apologises, shakes your hand and goes to the toilets. Tiny stares at you. "…Where did you learn that?"', do: c => { c.up(20); c.standing(2, 'Cooled things down at the Rusty Anchor'); c.done(); }, end: true },
  c: { say: 'The bloke laughs at you. Tiny walks over, says three words, and the pub is quiet again. "Practice."', do: c => { c.up(8); c.done(); }, end: true },
  d: { say: '"Probably wise."', do: c => { c.up(6); c.done(); }, end: true },
} });
DLG.addArc('Tiny', [{ id: 'tiny1', title: 'The job', need: need(8, 0) }, { id: 'tiny2', title: 'Lesson one', need: need(25, 1) }]);
DLG.def('rick1', { start: 'a', nodes: {
  a: { say: ['Rick racks without looking, a cigarette that isn\'t lit behind his ear.', '"Ten bucks a game. Winner stays on. You\'ll lose, but you\'ll learn."'], opts: [
    { t: '"Let\'s play."', go: 'b' },
    { t: '"What\'s your secret?"', go: 'c' },
    { t: '"Not for money."', go: 'd' }] },
  b: { say: '"Righto. Rack\'s yours."', do: c => { c.up(6); startPool('Slick Rick'); c.done(); }, end: true },
  c: { say: '"Never play a bloke who\'s better than you. And never show them you\'re better than they think. Boom. Secret."', do: c => { c.up(10); c.done(); }, end: true },
  d: { say: '"Smart. Now you\'re learning."', do: c => { c.up(10); c.done(); }, end: true },
} });
DLG.def('rick2', { start: 'a', nodes: {
  a: { say: ['Rick isn\'t playing. He\'s watching a bloke at the machines drop hundreds into a Big Red and he\'s got a thin look on his face.', '"Seen him in here every night for a month. Wife left in June. Won\'t talk to anyone. I\'d say something. Not my business."'], opts: [
    { t: '"Maybe somebody should."', go: 'b' },
    { t: '"Not my business either."', go: 'c' },
    { t: 'Go and talk to him.', check: { stat: 'Charm', dc: 55 }, pass: 'd', fail: 'e' }] },
  b: { say: '"Maybe. Yeah." He puts the cue down. "I\'ll buy him a pot."', do: c => { c.up(10); c.done(); }, end: true },
  c: { say: '"Yeah." He goes back to the table. His shoulders are tight.', do: c => { c.up(2); c.done(); }, end: true },
  d: { say: 'You sit next to the bloke at the machine for a while. He talks. You listen. At the end he feeds the machine his last five and doesn\'t buy more. He takes a card from your hand. Rick nods at you across the room.', do: c => { c.up(25); c.standing(4, 'Talked a bloke away from the pokies'); c.mood_(10); achieve('listener'); c.done(); }, end: true },
  e: { say: 'He waves you off. "Mind your business, mate." He doesn\'t say it unkindly.', do: c => { c.up(6); c.done(); }, end: true },
} });
DLG.addArc('Slick Rick', [{ id: 'rick1', title: 'Ten bucks a game', need: need(8, 0) }, { id: 'rick2', title: 'The bloke at the machine', need: need(25, 1) }]);
ACH_LIST.push(['listener', 'A Good Listener', 'Talk someone away from the pokies.']);

const VenueLocals = {
  spawn() {
    for (const L of LOCALS[VENUE.id] || []) {
      const n = mkNPC(Object.assign({ name: L.name, smoker: false, gambler: false }, L.look)); n.local = L.name;
      const sp = SPOTS.find(s => !s.occ && L.spot(s));
      if (sp) { claim(n, sp); n.pos.copy(sp.pos); n.ry = sp.ry; seatNPC(n); } else { n.pos.copy(NODES.P5); n.state = 'idle'; n.kind = 'stand'; }
      n.timer = 1e9; n.eventTalk = () => { Night.ev('talk', L.name); DLG.open(L.name + '.hub', n, { key: L.name, bio: L.bio }); };
    }
  },
};

// ---- src/28-cine.js ----

// =====================================================================
//  CINEMATIC DIRECTOR: skippable camera moves over the live world.
//  Cine.play([{ dur, a: {p, l, fov}, b: {p, l, fov}, ease, sub, title, shake, slow, duck, fn }], { onEnd, bars, skippable })
//  p / l are [x, y, z] (position, look-at).  A shot moves from a to b (or holds a when b is omitted).
//  Hold E / SPACE (or tap the screen on a phone) to skip: the world is left exactly as the cinematic's end would leave it.
//  settings.cinematics: 'full' | 'short' (only the quick ones) | 'off'.
// =====================================================================
const Cine = {
  active: null, bars: 0, slow: 1, skipT: 0, saved: null, t: 0,
  ok(kind = 'full') { const m = settings.cinematics || 'full'; return m === 'off' ? false : m === 'short' ? kind !== 'long' : true; },
  play(shots, o = {}) {
    if (this.active) this.end(true);
    if (!this.ok(o.kind)) { o.onEnd && o.onEnd(); return false; }
    const A = this.active = { shots, i: -1, t: 0, o, seen: 0, fovStart: camera.fov };
    this.saved = { fov: camera.fov, music: Music.level, uiOpen: Game.uiOpen };
    this.skipT = 0; this.slow = 1; document.body.classList.add('cine'); $('lbT').style.height = $('lbB').style.height = (o.bars === 0 ? 0 : 11) + 'vh';
    $('cineHint').classList.toggle('hidden', o.skippable === false); this.next();
    return true;
  },
  next() {
    const A = this.active; if (!A) return;
    const prev = A.shots[A.i]; if (prev && prev.end) prev.end();
    A.i++; A.t = 0; const s = A.shots[A.i];
    if (!s) { this.end(false); return; }
    if (s.sub) Game.subtitle(s.sub, s.dur + 0.4);
    if (s.title) this.title(s.title[0], s.title[1], Math.min(s.dur, 4.5));
    if (s.fn) s.fn();
    if (s.duck != null) Music.level = Math.max(0.05, this.saved.music * s.duck);
  },
  title(a, b, dur) { const e = $('cineTitle'); e.innerHTML = `<b>${a}</b>${b ? `<span>${b}</span>` : ''}`; e.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => e.classList.remove('on'), dur * 1000); },
  // the camera for this frame
  update(dt) {
    const A = this.active; if (!A) return;
    dt = this.rdt || dt; A.t += dt; const s = A.shots[A.i]; if (!s) return;
    const k = clamp(A.t / s.dur, 0, 1), e = s.ease === 'lin' ? k : s.ease === 'out' ? easeOut(k) : smooth(k);
    const a = s.a, b = s.b || s.a;
    const pos = V3(lerp(a.p[0], b.p[0], e), lerp(a.p[1], b.p[1], e), lerp(a.p[2], b.p[2], e));
    const look = V3(lerp(a.l[0], b.l[0], e), lerp(a.l[1], b.l[1], e), lerp(a.l[2], b.l[2], e));
    // handheld breath so a locked-off shot never feels dead
    const t = elapsed; if (!settings.reduceMotion) { pos.x += Math.sin(t * 0.9) * 0.012; pos.y += Math.sin(t * 1.3) * 0.01; }
    if (s.shake) { const sh = s.shake * (1 - k); pos.x += (Math.random() - 0.5) * 0.03 * sh; pos.y += (Math.random() - 0.5) * 0.03 * sh; }
    camera.position.copy(pos); camera.lookAt(look);
    const fov = lerp(a.fov || 60, b.fov || a.fov || 60, e); if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
    this.slow = s.slow != null ? s.slow : 1;
    // skipping: hold the key
    const held = keys.KeyE || keys.Space || keys.Enter || this.touchHeld;
    this.skipT = held ? this.skipT + dt : Math.max(0, this.skipT - dt * 2);
    $('cineSkip').style.width = Math.min(100, this.skipT / 0.7 * 100) + '%';
    if (A.o.skippable !== false && this.skipT >= 0.7) { this.end(true); return; }
    if (A.t >= s.dur) this.next();
  },
  end(skipped) {
    const A = this.active; if (!A) return; this.active = null;
    // run any remaining shots' end hooks so state is left as the full cinematic would have left it
    for (let i = Math.max(0, A.i); i < A.shots.length; i++) { const s = A.shots[i]; if (skipped && i > A.i && s.fn) s.fn(); if (s.end) s.end(); }
    if (skipped) { Game.subtitle('', 0); $('subtitle').innerHTML = ''; }
    document.body.classList.remove('cine'); $('lbT').style.height = $('lbB').style.height = 0; $('cineTitle').classList.remove('on'); $('cineSkip').style.width = 0;
    camera.fov = this.saved.fov; camera.updateProjectionMatrix(); Music.level = this.saved.music; this.slow = 1; this.skipT = 0; this.touchHeld = false;
    if (A.o.onEnd) A.o.onEnd(skipped);
  },
  // ------------------------------------------------------------ ready-made sequences
  // the establishing shot at the start of a night: the street, a drift in towards the door, then you
  opening(first) {
    const D = DAYS[Game.state.day];
    return this.play([
      { dur: first ? 5.5 : 3.6, ease: 'lin', a: { p: [-34, 5.8, 21], l: [-4, 3.2, 2], fov: 50 }, b: { p: [-17, 3.6, 19.5], l: [0, 2.6, 2], fov: 52 }, title: first ? [VENUE.name, `${DAYS[Game.state.day].name} · ${CHAPTERS[Game.state.day].title.split('— ')[1] || ''}`] : [VENUE.name, D.title], sub: first ? '<i>The street\'s dead. Only thing lit up for blocks is ' + VENUE.short + '.</i>' : null, duck: 0.6 },
      { dur: first ? 3 : 2.2, a: { p: [-17, 3.6, 19.5], l: [0, 2.6, 2], fov: 52 }, b: { p: [-8.5, 1.9, 22], l: [-2, 2.2, 3], fov: 60 }, ease: 'out' },
    ], { kind: 'short', onEnd: () => { player.pos.set(-7.5, 0, 21.2); player.yaw = 0.12; player.pitch = 0.04; } });
  },
  // last drinks: the bell, the lights come up, the whole bar turns
  lastCall(bt) {
    const p = bt.pos, bell = [-9.0, 1.3, -8.0];
    return this.play([
      { dur: 2.4, a: { p: [-6.3, 1.55, -7.2], l: [bell[0], bell[1] + 0.1, bell[2]], fov: 38 }, b: { p: [-6.6, 1.5, -7.6], l: [bell[0], bell[1], bell[2]], fov: 34 }, slow: 0.55, sub: `<b>${bt.name}:</b> LAST DRINKS, EVERYBODY!`, fn: () => { SFX.bell(V3(-9, 2.5, -8), 3); }, duck: 0.35 },
      { dur: 3.2, a: { p: [-5.2, 1.7, -4.5], l: [-9, 1.5, -8], fov: 60 }, b: { p: [-1.5, 2.2, 0.2], l: [-7, 1.6, -9], fov: 66 }, ease: 'out', fn: () => { Music.level = Math.max(0.2, this.saved.music * 0.5); } },
    ], { kind: 'short' });
  },
  // a pokie jackpot: the screen fills your view, the room goes quiet for a second
  jackpot(m, name) {
    const s = m.screenW, f = m.fw, up = V3(0, 1, 0), eye = player.pos.clone().add(V3(0, 1.3, 0)).addScaledVector(f, 0.2);
    const near = s.clone().addScaledVector(f, 0.42).add(V3(0, -0.02, 0));
    return this.play([
      { dur: 3.4, a: { p: [eye.x, eye.y, eye.z], l: [s.x, s.y - 0.1, s.z], fov: 55 }, b: { p: [near.x, near.y, near.z], l: [s.x, s.y, s.z], fov: 42 }, slow: 0.5, shake: 1.2, ease: 'out', sub: `<b>${name} JACKPOT!</b>`, duck: 0.3 },
      { dur: 1.2, a: { p: [near.x, near.y, near.z], l: [s.x, s.y, s.z], fov: 42 }, b: { p: [eye.x, eye.y, eye.z], l: [s.x, s.y - 0.1, s.z], fov: 55 } },
    ], { kind: 'short', bars: 11 });
  },
  // follow somebody for a few seconds (a scuffle being walked out, a patron leaving)
  follow(n, dur = 4, sub) {
    const tgt = () => [n.pos.x, 1.4, n.pos.z];
    const a = n.pos.clone().add(V3(-2.2, 0.4, 2.8));
    return this.play([{ dur, a: { p: [a.x, 1.7, a.z], l: tgt(), fov: 50 }, b: { p: [a.x + 1.4, 1.5, a.z - 0.6], l: tgt(), fov: 46 }, sub, ease: 'lin' }], { kind: 'short' });
  },
  // the council decides: slow shots across the packed bar, one line per beat
  council(lines, then) {
    const poses = [
      { a: { p: [-3.5, 1.7, -3.2], l: [-9, 1.5, -8], fov: 52 }, b: { p: [-4.5, 1.7, -4.5], l: [-9, 1.5, -8], fov: 48 } },
      { a: { p: [0, 1.6, -9], l: [-6, 1.6, -4], fov: 55 }, b: { p: [-1.2, 1.6, -8.4], l: [-6, 1.6, -4], fov: 50 } },
      { a: { p: [-6.5, 1.5, -3.5], l: [-1, 1.5, -7], fov: 58 }, b: { p: [-5.5, 1.6, -4], l: [-1, 1.5, -7], fov: 50 } },
    ];
    const shots = lines.map(([who, l], i) => ({ dur: Math.max(3.2, 1.4 + l.length * 0.045), ease: 'lin', ...poses[i % poses.length], sub: `<b>${who}:</b> ${l}`, duck: 0.2 }));
    return this.play(shots, { kind: 'long', onEnd: then });
  },
  // the cab ride home
  taxi(then) {
    return this.play([
      { dur: 2.2, a: { p: [-4, 1.3, 9.2], l: [-11.5, 1.1, 11.4], fov: 55 }, b: { p: [-9, 1.25, 10.3], l: [-11.5, 1.1, 11.4], fov: 45 }, ease: 'out', sub: '<i>The back seat smells of pine and last night.</i>', duck: 0.5 },
      { dur: 3.6, ease: 'lin', a: { p: [-12.5, 1.15, 12.6], l: [-30, 1.4, 12], fov: 62 }, b: { p: [-24, 1.15, 12.6], l: [-44, 1.4, 12], fov: 62 }, sub: '<b>Driver:</b> Big night, mate? You want me to drop you at the corner?' },
    ], { kind: 'short', onEnd: then });
  },
};
addEventListener('touchstart', () => { if (Cine.active) Cine.touchHeld = true; }, { passive: true });
addEventListener('touchend', () => { Cine.touchHeld = false; });

// ---- src/29-food.js ----

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

// ---- src/30-overheard.js ----

// =====================================================================
//  OVERHEARD: wander near two patrons who are talking and you catch the gist.
//  Each rumour is worth something small: a tip on a machine, a warning, a nudge to your mood.
//  What you've heard is kept in flags.gossip so it isn't repeated.
// =====================================================================
const GOSSIP = [
  { id: 'hot', lines: [['{a}', "Dragon Link out the back paid {b} three hundred last night. Three hundred!"], ['{b}', "Yeah, then I put it all back in. Don't tell the missus."]], act() { const m = choice(MACHINES.filter(x => !x.def.smoke && x.skin)); if (m) { m.hotTip = true; Game.toast(`Tip: ${m.game.name} has been paying lately.`); Night.log('👂', `Heard ${m.game.name} was running hot`); } } },
  { id: 'inspector', lines: [['{a}', "Reckon there's a liquor inspector doing the rounds tonight."], ['{b}', "Then somebody tell Dazza to stop doing shots off the bar."]], act() { Game.state.flags.inspectorWarn = true; Game.toast('Heard: an inspector is about. Keep it tidy.'); Night.log('👂', 'Heard an inspector might be about'); } },
  { id: 'raffle', lines: [['{a}', "Bev's meat tray raffle is rigged, you know."], ['{b}', "Every Friday for six years and I've never won a snag."]], act() { Game.state.mood = clamp(Game.state.mood + 3, 0, 100); } },
  { id: 'footy', lines: [['{a}', "Reckon the Tigers get up by two goals."], ['{b}', "Mate, they couldn't get up off the couch."]], act() { Game.state.mood = clamp(Game.state.mood + 3, 0, 100); } },
  { id: 'council', lines: [['{a}', "They want to knock the Royal down and put up units."], ['{b}', "Over my dead body. Well. Over my cold beer."]], act() { Night.log('👂', 'Heard the council wants the Royal'); } },
  { id: 'cabbie', lines: [['{a}', "Left me car at the servo. Cabbie knows the whole town's business."], ['{b}', "Cabbie knows YOUR business."]], act() { Game.state.mood = clamp(Game.state.mood + 2, 0, 100); } },
  { id: 'tab', lines: [['{a}', "Got a tip on the fifth at Flemington. Bloke at the TAB swears by it."], ['{b}', "The bloke at the TAB swears by everything."]], act() { Game.state.flags.tabTip = true; Game.toast('Heard a racing tip. Maybe worth a flutter at the TAB.'); Night.log('👂', 'Heard a racing tip'); } },
  { id: 'kid', lines: [['{a}', "My boy reckons he's going to be a streamer. Playing video games. For money."], ['{b}', "Mate, that's what you do at the pokies."]], act() { Game.state.mood = clamp(Game.state.mood + 3, 0, 100); } },
];
const Overheard = {
  cd: 25, cur: null,
  update(dt) {
    if (Game.mode !== 'play' || Game.uiOpen || Cine.active || DLG.active || MG.active) return;
    const c = this.cur;
    if (c) { c.t += dt; const L = c.g.lines[c.i]; if (L && c.t > c.i * 3.6) { Game.subtitle(`<i>(overheard)</i> <b>${L[0].replace('{a}', c.a.name).replace('{b}', c.b.name)}:</b> ${L[1]}`, 3.4); c.i++; } if (c.i >= c.g.lines.length && c.t > c.g.lines.length * 3.6) { this.cur = null; c.g.act && c.g.act(); } return; }
    this.cd -= dt; if (this.cd > 0) return;
    this.cd = rand(35, 70);
    const heard = (Game.state.flags.gossip = Game.state.flags.gossip || []);
    const near = NPCS.filter(n => n !== bartender && n.state !== 'walk' && n.dist2 > 2 && n.dist2 < 20);
    for (const a of near) { const b = near.find(o => o !== a && (o.pos.x - a.pos.x) ** 2 + (o.pos.z - a.pos.z) ** 2 < 5); if (!b) continue;
      const pool = GOSSIP.filter(g => !heard.includes(g.id)); if (!pool.length) return;
      const g = choice(pool); heard.push(g.id); a.a.talk = b.a.talk = 12; this.cur = { a, b, g, i: 0, t: 0 }; return; }
  },
};

// ---- src/99-boot.js ----

// =====================================================================
//  BOOT
// =====================================================================
const tick = () => new Promise(r => setTimeout(r, 0));
async function boot() {
  try {
    setLoad(0.05, 'Waiting for the signwriter…');
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]);
    try { await Promise.all(['Bebas Neue', 'Bungee', 'Rye', 'Permanent Marker'].map(f => document.fonts.load(`40px "${f}"`))); } catch (e) {}
    setLoad(0.08, 'Unloading the delivery truck…');
    await loadAssets(p => setLoad(0.08 + p * 0.06));
    setLoad(0.15, 'Sanding the floorboards…'); await tick();
    buildTextures(); buildMaterials();
    setLoad(0.25, 'Painting the street…'); await tick();
    buildSky(); buildStreet();
    setLoad(0.4, 'Hanging the cast-iron lace…'); await tick();
    buildFacade(); buildDoors();
    setLoad(0.55, 'Tapping the kegs…'); await tick();
    buildShared(); buildInterior(); buildBarService(); buildDartboard();
    buildToilets(); buildGarden(); buildTABCorner(); buildBottleO(); buildUpstairs(); buildKebab(); buildTraffic(); buildZoneLights(); Karaoke.build(); STORY.build(); Juke.build();
    setLoad(0.7, 'Wiring up the pokies…'); await tick();
    MACHINE_DEFS.forEach((d, i) => buildMachineMesh(d, i)); buildSkinSigns();
    buildAtmosphere();
    SB.flush(scene, true, true); SBX.flush(scene, true, true);
    setLoad(0.8, 'Hiring the locals…'); await tick();
    initFX(); buildViewmodel(); Eat.build(); CashFX.build(); PokieFX.build(); makeBartender(); buildPlayerBody();
    { // the back mirror re-renders the room: do it every other frame and only when you're near enough to see it
      const mob = backMirror.onBeforeRender;
      backMirror.onBeforeRender = function (...a) { const c = camera.position; if (Game.frameN % 2 || c.distanceTo(backMirror.position) > 15 || !isInside(c.x, c.z)) return; mob.apply(this, a); };
    }
    setupInput(); wireUI(); TOUCH.build();
    setTimeOfDay(18.4, 'clear');
    Game.state.day = 0; Game.state.event = 'monday';
    spawnPatrons(10);
    setLoad(0.9, 'Polishing the mirrors…'); await tick();
    // warm up shaders + bake interior reflections
    renderer.compile(scene, camera);
    captureInteriorEnv();
    applySettings();
    setLoad(1, 'Doors open.');
    await new Promise(r => setTimeout(r, 300));
    $('loading').classList.add('hidden');
    Game.toTitle();
    if (store('ld_resume')) { store('ld_resume', null); if (Game.load()) Game.showDayCard(); }   // we just caught a cab to another pub
    window.__ready = true;
  } catch (e) {
    console.error(e); $('loadtxt').textContent = 'Error: ' + e.message; window.__bootError = e.message;
  }
}
requestAnimationFrame(frame);
boot();
window.__touchOn = () => { settings.touch = 'on'; applySettings(); }; window.__music = Music; window.__MG = MG; window.__Darts = Darts; window.__X = { Racing, BarShift, Karaoke, Scratchie, Shops, Needs, Traffic, RANDOM, POOL: typeof POOL !== 'undefined' ? POOL : null };
window.__rtp = (id, n = 100000, bet = 1) => { const g = GAMES[id]; let w = 0, hit = 0, feat = 0; for (let i = 0; i < n; i++) { const s = fullSpin(g, bet, JP, false); w += s.win; if (s.win > 0) hit++; if (s.feature) feat++; } return { rtp: +(w / (n * bet)).toFixed(3), hit: +(hit / n).toFixed(3), feat: +(feat / n).toFixed(4) }; };
window.__rtpCal = (id, n = 120000, target = 0.9) => { const g = GAMES[id], keep = g.payScale || 1; g.payScale = 1; const a = window.__rtp(id, n).rtp; g.payScale = 2; const b = window.__rtp(id, n).rtp; g.payScale = keep; const L = b - a, F = 2 * a - b; return { id, line: +L.toFixed(3), feature: +F.toFixed(3), payScale: +((target - F) / L).toFixed(2), was: keep }; };
window.__rtpLine = (id, n = 400000) => { const g = GAMES[id], keep = g.payScale || 1; g.payScale = 1; let w = 0; for (let i = 0; i < n; i++) { const r = spinGrid(g, 1, false); w += evalLines(g, r, 1, false).total; } g.payScale = keep; return +(w / n).toFixed(4); };
window.__game = { FOODS, makeFood, Eat, Cine, Overheard, DLG, VenueLocals, TEX, MAT, VENUE, colliders, keys, dynamic, Game, REG, Night, Moments, STORY, DAYS, bartender: () => bartender, renderer, player, scene, camera, MACHINES, NPCS, JP, setTimeOfDay, interactables, sipDrink, startSmoke, dropHeld };
