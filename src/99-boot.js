
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
    MACHINE_DEFS.forEach((d, i) => buildMachineMesh(d, i));
    buildAtmosphere();
    SB.flush(scene, true, true); SBX.flush(scene, true, true);
    setLoad(0.8, 'Hiring the locals…'); await tick();
    initFX(); buildViewmodel(); CashFX.build(); makeBartender(); buildPlayerBody();
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
    window.__ready = true;
  } catch (e) {
    console.error(e); $('loadtxt').textContent = 'Error: ' + e.message; window.__bootError = e.message;
  }
}
requestAnimationFrame(frame);
boot();
window.__touchOn = () => { settings.touch = 'on'; applySettings(); }; window.__music = Music; window.__MG = MG; window.__Darts = Darts; window.__X = { Racing, BarShift, Karaoke, Scratchie, Shops, Needs, Traffic, RANDOM, POOL: typeof POOL !== 'undefined' ? POOL : null };
window.__game = { Game, REG, renderer, player, scene, camera, MACHINES, NPCS, JP, setTimeOfDay, interactables, sipDrink, startSmoke, dropHeld };
