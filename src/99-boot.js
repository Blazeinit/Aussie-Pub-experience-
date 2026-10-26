
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
    Clubs.build();   // Wattle Creek RSL and the Rusty Anchor, on the same street
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
    console.error(e); $('loadtxt').textContent = 'Error: ' + e.message; window.__bootError = e.message; window.__bootStack = e.stack;
  }
}
requestAnimationFrame(frame);
boot();
window.__touchOn = () => { settings.touch = 'on'; applySettings(); }; window.__music = Music; window.__MG = MG; window.__Darts = Darts; window.__X = { Racing, BarShift, Karaoke, Scratchie, Shops, Needs, Traffic, RANDOM, POOL: typeof POOL !== 'undefined' ? POOL : null };
window.__rtp = (id, n = 100000, bet = 1) => { const g = GAMES[id]; let w = 0, hit = 0, feat = 0; for (let i = 0; i < n; i++) { const s = fullSpin(g, bet, JP, false); w += s.win; if (s.win > 0) hit++; if (s.feature) feat++; } return { rtp: +(w / (n * bet)).toFixed(3), hit: +(hit / n).toFixed(3), feat: +(feat / n).toFixed(4) }; };
window.__rtpCal = (id, n = 120000, target = 0.9) => { const g = GAMES[id], keep = g.payScale || 1; g.payScale = 1; const a = window.__rtp(id, n).rtp; g.payScale = 2; const b = window.__rtp(id, n).rtp; g.payScale = keep; const L = b - a, F = 2 * a - b; return { id, line: +L.toFixed(3), feature: +F.toFixed(3), payScale: +((target - F) / L).toFixed(2), was: keep }; };
window.__rtpLine = (id, n = 400000) => { const g = GAMES[id], keep = g.payScale || 1; g.payScale = 1; let w = 0; for (let i = 0; i < n; i++) { const r = spinGrid(g, 1, false); w += evalLines(g, r, 1, false).total; } g.payScale = keep; return +(w / n).toFixed(4); };
window.__game = { get VENUE() { return VENUE; }, CLUBS, Clubs, SPOTS, claim, release, seatNPC, NpcMeals, FOODS, makeFood, Eat, Cine, Overheard, DLG, VenueLocals, TEX, MAT, colliders, keys, dynamic, Game, REG, Night, Moments, STORY, DAYS, bartender: () => bartender, renderer, player, scene, camera, MACHINES, NPCS, JP, setTimeOfDay, interactables, sipDrink, startSmoke, dropHeld };
