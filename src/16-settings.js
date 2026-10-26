
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
const KEYS_HELP = [['W A S D', 'Walk'], ['Shift', 'Run'], ['Mouse', 'Look'], ['E', 'Interact'], ['F', 'Sip your drink'], ['C', 'Smoke'], ['G', 'Set your drink down (or drop it)'], ['R', 'Cheers'], ['Q', 'Stand up from a seat'], ['Tab', 'Phone'], ['Space', 'Spin / pick at a pokie'], ['↑ ↓', 'Change bet'], ['I', 'Insert cash'], ['Enter', 'Collect'], ['Q', 'Stand up / leave a game'], ['Esc', 'Pause'], ['F3', 'Performance overlay']];
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
