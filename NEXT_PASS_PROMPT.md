# Prompt: "Last Drinks" gameplay pass (for Sonnet 5.5, effort: high)

Paste everything below the line into a fresh Claude Code session on this repo. The session should stay on branch `claude/last-drinks-pub`.

---

You are continuing development of **Last Drinks**, a first-person Australian pub game in three.js (r160, no framework). The repo is `Aussie-Pub-experience-`. The game is playable and polished visually; your job is to make it **deeper and more fun** and to make the first-person experience feel real. Work like a senior gameplay engineer with a designer's taste. Verify everything in the browser. Do not guess.

## 0. Orient first (30 min budget, then plan)

1. Read `README.md`, `build.mjs`, and skim every file in `src/` (about 8,500 lines, concatenated in filename order into one ES module, so everything shares one scope). Key files:
   - `01-core` settings, audio, music (`Music`, `SONGS`, `SFX`) · `03-world` pub shell and materials · `05-pokies` + `20-pokiefx` machines
   - `06-actors` humans, drinks, food (`makeFood`), bartender · `07-player` controller, viewmodel, seating
   - `08-game` state, day loop, bar menu, `Game.eat`, `endNight` · `13-activities` Needs, Shops, Racing, Scratchie, BarShift, Karaoke
   - `15-story` regulars, `REG.talk`, random events · `17-mainstory` the 7-day save-the-pub story (`STORY`, `CHAPTERS`) · `19-service` ATM and jukebox · `16-settings` / `18-touch`
2. Set up testing: `cd tools/test && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i && node example.mjs`. This boots the real game in headless Chromium (SwiftShader), fakes the CDN, and saves screenshots to `tools/test/out/`. The page exposes `window.__game` (`Game`, `player`, `MACHINES`, `NPCS`, `scene`, ...), `window.__sim(seconds)` to advance the loop deterministically, `__MG`, `__X`. Copy `example.mjs` for each new scenario. **Long tests exceed the tool timeout, so run them with `run_in_background` and wait on the output file.**
3. Lint after every build: `node build.mjs && tools/test/lint.sh`. The only accepted error is `'Pool' is not defined` (guarded). `node build.mjs --offline` makes the single-file `Last-Drinks-offline.html` (embeds `assets/`, about 10 MB).
4. Write a short design doc `docs/DESIGN_PASS.md` (one page): what you will change, the order, and the risks. Then keep `docs/PROGRESS.md` updated with checkboxes as you finish slices, so a later session can resume.

## Rules of engagement

- **Vertical slices.** Finish one thing end to end (code, test, screenshot you actually look at, commit, push) before starting the next. Commit messages end with the trailer lines given in your system reminder. Do not open a PR unless asked.
- **Look at your screenshots** (Read the PNG) and fix what looks wrong. Several earlier bugs (an invisible ATM, a "broken" parma, a blocked doorway) were only caught this way.
- **Performance budget.** `low` preset must stay playable and `high` must hold 60 fps on a mid GPU. Reuse geometry and materials, never allocate per frame, and put new static meshes through the static batcher (`SB`) like the rest of the world. Add anything expensive behind `settings.quality`/`HIGH()`.
- **Parity.** Every new interaction needs: a keyboard path, a touch-controls path (`18-touch.js` context buttons), subtitles for new dialogue/VO (`#subtitle`), and respect for `settings.reduceMotion`, `settings.hints`, `settings.subtitles`.
- **Save compatibility.** Game state is in localStorage. Add fields with defaults, never rename existing ones.
- **No network at runtime.** Assets are procedural (canvas textures, code-built meshes) or files under `assets/`. Keep the offline build under about 25 MB.
- Match the surrounding code's style: terse, commented where non-obvious, same helper names (`V3`, `damp`, `rand`, `mkCanvas`, `addInteract`, `SFX`, ...).
- Keep the humour: dry, affectionate, true-blue Aussie. Real-feeling dialogue beats generic dialogue. No real brands beyond what already exists.

## Workstreams (do them in this order; each is a set of slices)

### A. Gameplay loop: make "one more night" compelling
Today a night is: arrive, drink, play pokies/darts/etc., get home. Make the loop self-reinforcing:
- **Night structure with beats:** arrival → settle in → mid-night event/rumour → rush → last drinks bell → drunk walk home. Give each beat a clear moment, and let the bartender's "last drinks" call become a small set piece (lights up, bell, stragglers, a decision: one more or go).
- **Goals and tension:** per-night optional goals (3 cards drawn from a pool: "win a game of darts vs X", "get Bev's raffle", "leave with ≥ $50 more than you came with", "don't get cut off", ...), plus a visible risk meter set (RSA/cut-off, bladder, hunger, wallet, last-train/taxi fare). Failing should be funny and recoverable, not punishing.
- **Meta-progression across the week:** reputation with the pub and with individual regulars, a "tab" you can run (and must clear), unlockable perks (a favourite stool, a named schooner glass, a darts flight set, a reserved machine), cosmetic home-screen trophies. Economy: tune prices, wages, ATM fee, pokie RTP perception so a week is winnable without being trivial. Add a short **end-of-night summary** that shows what mattered (stories advanced, relationships changed, money), not just totals.
- **Variety:** at least 6 distinct nightly *events* (trivia, meat raffle, band night, footy final, wake, a dodgy bloke selling "TVs") with their own rules and ambient changes, selected so back-to-back nights differ.
- Instrument it: log per-night stats to the console in a debug flag so you can balance by simulation (`__sim`) rather than by feel.

### B. More pubs (data-driven venues)
The Royal Hotel is currently hand-built at fixed coordinates in `03-world` / `14-world2`. Introduce a **Venue** abstraction so new pubs are mostly data plus a few builders:
- Define `VENUES = { royal: {...}, ... }` with: name, theme (palette, signage, wall/carpet textures), layout builder, staff, menu (food and drinks with prices), machines (game mix and count), regulars (who drinks there), nightly event pool, music pool, ambient mix, and its position in the story.
- Implement load/unload so only the current venue is in the scene (dispose geometry/materials/lights, rebuild colliders, nav nodes, interactables, zone lights, static batch). Travel between venues via the existing walk/taxi system with a short cinematic (see D) and a fare.
- Ship **at least two new pubs** with a genuinely different feel and different mechanics emphasis, for example:
  1. **The Surfie / RSL-style club:** big bistro, meat raffle, Keno, poker-machine bank, members' sign-in, courtesy bus, cheap schnitty night.
  2. **A sticky-carpet city dive:** tiny, loud, pool table (finish the already-written engine in `src/10-pool-sim.js`: it is tested but not integrated, so build the table, cues, and UI around it), cover band, bouncer interactions.
  Optionally a country pub with a bush-telegraph rumour mill and a utes-in-the-carpark exterior.
- Unlocks: new venues open through reputation, story chapters, or a mate's invite, with a map/phone screen to pick where to go.
- Each venue needs its own screenshot test and a performance check. Don't copy-paste the Royal; share builders.

### C. Food: animations and variety for every food type
Currently only parma, roast, and chips have real models (`makeFood`, `foodTextures`). The kebab shop and bottle-o have more items. Make **every** food/snack item a first-class object:
- Models (code-built, textured, convincing): chicken parma, schnitty, Sunday roast, chips with chicken salt, burger with the lot, pie and sauce, sausage roll, snags in bread, kebab, dim sim, potato scallop, bar nuts and Mi Goreng-style packet snacks, cheese platter, pavlova (Sunday dessert).
- **Serving animation:** kitchen pass bell, plate carried by a staff member with proper arm IK (reuse `armIK` and the bartender's phase machine), plate placed with a settle, steam and sizzle for hot items.
- **Eating animation, first person:** per food a distinct, readable sequence: cut/fork or pick-up, bite (the model visibly loses volume in stages using clip planes or scaled sub-meshes), chew with slight camera bob and crunch/squelch audio, sauce and crumb particles, a finger lick, napkin wipe. Eating should take a few seconds, be interruptible, and respect `reduceMotion`.
- **NPC eating:** seated regulars eat from the same models with simple loops. Dropped chips on the floor; a dog-less pub still has a hungry seagull outside.
- Hunger system integration: food quality matters (hot vs cold, wait time), leftovers can be taken home, and the kebab on the walk home stays a funny late-night choice.

### D. Encounters, dialogue, and cinematics
- **Dialogue system upgrade.** Replace one-off `opts.push` chains with a reusable tree/graph runner: nodes, conditions (drunk level, reputation, flags, time, money, who is nearby), effects (stat changes, flags, items, schedule an event), skill-check-style moments (charm vs drunk), timed responses, and per-character memory so they remember last night's choices. Aim for **6+ meaningful options** across the regulars, with different outcomes, not flavour. Give every regular a 3-beat arc across the week that pays off, and make bad ideas (arguing with a bloke at the wrong time) have consequences.
- **Overheard conversations** and NPC-to-NPC interactions you can eavesdrop on (walk close, subtitles appear, they react if you stare).
- **Cinematic director.** Build a small system: a timeline of camera moves/cuts with easing, letterbox bars, optional slow-mo, music ducking, subtitles, and player-input lock that always **allows skip (hold E / tap)** and cleans up state on skip. Use it for: opening shot of the pub at dusk on night 1, the "last drinks" bell, chapter intros, the council meeting and each ending, a jackpot celebration, a taxi ride, a fight breaking out and the bouncer stepping in, and the first time you enter a new venue. Keep each under about 15 seconds.

### E. First-person pokies: more realistic and immersive
A first pass exists (`20-pokiefx.js`: LED edge lighting, glass glare, glowing deck buttons, speaker panel, camera glance and shake, HUD fade). Go much further:
- **Your body:** visible forearms/hands are there, so add torso/thigh/knee peeking at the bottom edge, shoulder sway on spin, and **a hand that really moves to and presses the physical button** you clicked (IK to the button, finger curl, button depress), plus a resting hand on the ledge/drink.
- **Screen realism:** pixel/LCD grid and subpixel moiré at distance, slight screen curvature and vignette, reflections of the pub (a cheap fake: a blurred env/reflection layer on the glass that shifts with head position), dust/fingerprint smudges, a bit of bloom bleed onto the bezel, refresh shimmer on spin.
- **Cabinet realism:** wear (scuffs, sticker residue, cigarette-burn on the ledge), a header that animates (marquee lamps chasing), a **ticket (TITO) printer** with paper feed animation and a physical ticket you carry to the cashier, the note acceptor accepting a physical banknote (use `CashFX`), a player card slot.
- **Atmosphere:** neighbouring machines in attract mode lighting your face, ambient room reflection, silhouettes of patrons behind you, a barmaid walking past with your drink, and proper spatial audio: mechanical reel clunk, button clicks (material-correct), coin hopper, bell, the machine's distinct fanfare per game, a hushed room vs a hot-streak crowd gathering behind you.
- **Game feel:** reel anticipation (slow last reel with a near-miss tease and rumble), screen-shake only on big wins, a satisfying count-up with escalating audio, bonus-game camera push-ins, "nearly!" micro-feedback. Keep the existing responsible-gambling flavour (limits, "Gambling Help" signage, loss tracking in the nightly summary); the game can poke fun at pokies, not glamorise them.
- Make it all scale with quality presets and respect `reduceMotion`.

### F. Polish the rest as you go
Bug-hunt while testing: collisions at doorways, NPCs stuck on nav nodes, UI overlap at small sizes, touch mode, audio clipping, and anything that feels bad. Update `README.md` (new venues, systems, controls) when you finish.

## Definition of done

For each workstream: working in-game, covered by at least one scripted scenario in `tools/test/` with screenshots you reviewed, lint clean, no new console errors, `low` preset still smooth, touch path works, committed and pushed. At the end:

1. `node build.mjs --offline` and verify the single-file build boots from `file://` with the music working.
2. Run a full 7-night playthrough script (auto-play via `__game`/`__sim`) to prove nothing soft-locks, including every ending and each new venue.
3. Update `docs/PROGRESS.md`, commit, and push. If the Artifact tool is available, republish the offline build to the existing artifact URL. Then give me a concise summary: what changed, what is verified, and what you did not get to.

If you run out of room, **stop at a clean slice boundary** with everything committed, and list the remaining work in `docs/PROGRESS.md` so the next session can pick it up. Do not leave half-finished systems in the build.
