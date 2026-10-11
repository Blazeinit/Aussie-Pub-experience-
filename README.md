# Last Drinks — A Week at the Royal Hotel

An Aussie pub experience built with **three.js**, shipped as a **single HTML file** (`index.html`).
Open it in a modern desktop browser (Chrome, Edge or Firefox). It loads three.js from a CDN, so you need an internet connection.

> Fictional venue, machines and money. If gambling stops being a game for you or someone you know, free confidential help is available 24/7 through the Gambling Help service in your state.

## The loop

You play one week, Monday to Sunday. Each night starts at a different time with its own event:

| Night | Starts | Event |
|---|---|---|
| Monday | 7:00pm | Quiet night, $6.50 pots till 9 |
| Tuesday | 6:30pm | $15 Parma & Pot |
| Wednesday | 7:30pm | Trivia at 8:30pm (it's raining) |
| Thursday | 5:30pm | Payday + Jackpot Thursday (jackpots grow twice as fast) |
| Friday | 4:30pm | Knock-off drinks: shout the crew, cheap schooners 4–6 |
| Saturday | 2:00pm | Footy on the telly + meat raffle at 5pm |
| Sunday | 3:00pm | Sunday session, and rent comes out tonight |

- **Leave early and sober** (before 10pm, not drunk) and you pick up overtime the next day.
- **Get legless or kicked out** and you're hungover: pay is docked and the next night starts an hour late.
- Work days pay into your bank each morning. The ATM charges a fee.
- **Sunday:** rent is due. If you can't make it, you're evicted. The week is graded at the end.
- Locals can ask to borrow $20. Some pay you back the next day and some don't.

Three difficulties: **Tradie** (easy), **Shiftie** (normal), **Uni Student** (hard). They set your starting money, pay, rent, machine returns and how bad the hangovers are.

## Features

- **Streetscape:** a deliberately bland, empty street with power lines, a parked ute and sodium streetlights. The pub is a two-storey Federation-style corner pub with cast-iron lace, a tiled facade, lightbox signs and a chalk A-frame. Swing doors use spring physics.
- **Interior:** timber floorboards, a pressed-metal ceiling, a bar with T-bar taps, a back bar with bottles and fridges, a pool table, a dartboard, TVs showing racing and footy, Keno, a jukebox, a fireplace and ceiling fans. There's a lounge, a gaming room with garish carpet, and a smokers' gaming terrace.
- **Real reflections:** the vintage mirror on the back wall reflects the room and the street outside, including your own body. The varnish, glass and cabinets use a reflection map baked from inside the pub.
- **Dynamic sky:** the sun sets during the night. You get stars, the Southern Cross and rain on Wednesday (wet roads, rain on the roof).
- **Drink physics:** a liquid shader with a spring-damper slosh model. Running or bumping into people makes your drink slosh and spill, and the drips leave puddles on the floor. Drop a glass (G) and it falls, shatters into shards with physics, and the whole pub yells "WAHEYYY!"
- **Pouring:** the bartender walks to the tap, holds the glass at 45°, pulls the handle and pours a stream. The glass straightens as it fills and the head forms. Arms use two-bone IK.
- **Smoking:** pull out a cigarette, light it (lighter flick, sparks, flame glow), take drags (the ember brightens and crackles), exhale smoke, flick the ash and stub it out in the ashtray. Smoking is only allowed outside or at the terrace machines. Smoke inside and you get warned, then kicked out.
- **Pokies:** four original games, 25 lines each, bets $0.50–$10, with a linked progressive jackpot (Mini/Minor/Major/Grand) shared across the room and an LED jackpot board. NPCs play too, and can win jackpots.
  - *Outback Gold Link:* Hold & Spin (6+ nuggets, 3 respins, fill the screen for the Grand)
  - *Dragon Pearl Fortune:* Free Games with x2/x3/x5 wild multipliers, retriggers, and a mystery jackpot pick
  - *Lucky 7s Wheel:* jackpot wheel bonus
  - *Reef Riches Treasure:* match-3 jackpot pick (click the pearls on the screen)
  - Plus: Gamble (red or black), anticipation spins, slam-stop, win lines, big win celebrations, TITO tickets and a cash redemption terminal.
  - Returns were tuned by simulation to about 85–95%, like real machines.
- **NPCs:** procedural skeletons with walk, sit, pokie, pool, darts, smoking, drinking and cheering animations. They navigate a waypoint graph, chat ("Machine four's due. Trust me."), look at you, come and go, and react to your wins and smashed glasses.
- **Also:** Keno draws every few game minutes, Wednesday trivia, the Saturday meat raffle, and the jukebox. Audio is fully synthesised in WebAudio: crowd murmur, pokie chimes, crickets, rain, footsteps by surface, and Karplus-Strong pub rock from the jukebox.

## Controls

| Key | Action |
|---|---|
| WASD / mouse | Move / look (Shift to run, but you'll slosh your beer) |
| E | Interact: bar, ATM, Keno, jukebox, machines, talk, pick up drinks |
| F | Sip |
| C | Smoke (press again for another drag) |
| G | Drop your glass |
| Tab | Phone (money, messages) |
| At a pokie | Space spin / stop / pick · ↑↓ bet · I insert cash · Enter collect · G/R/B gamble · Q stand up |

## Project structure

`index.html` is the game: one self-contained file you can double-click to play. It's **generated** from the source files in `src/`; don't edit it directly.

| File | What's in it |
|---|---|
| `src/shell.html` | Page markup: menus, HUD, panels, pokie button bar |
| `src/style.css` | All styling |
| `src/01-core.js` | Renderer, post-processing, audio engine, jukebox |
| `src/02-textures.js` | Procedural textures (timber, brick, carpet, signs…) |
| `src/03-world.js` | Street, pub building, interior, lighting, sky, atmosphere, bar clutter |
| `src/04-pokie-math.js` | Reel maths, paytables, features, jackpots (RTP-tuned) |
| `src/05-pokies.js` | Pokie artwork, screen rendering, machine state machine |
| `src/06-actors.js` | Drinks/liquid physics, particles, NPC skeletons, AI, bartender |
| `src/07-player.js` | First-person controller, hands, drinking, smoking, seating |
| `src/08-game.js` | The week loop, menus, events, HUD, main loop, boot |

After editing anything in `src/`, rebuild with:

```
node build.mjs
```

The output stays a single file on purpose. Browsers block separate script files when a page is opened straight from disk, so a split build would need a local web server to run.

## Performance

- **Graphics → Low** is chosen automatically on first launch if your GPU looks integrated or mobile (Intel UHD/Iris, Mali, Adreno, software rendering). Low renders at 80% resolution with no anti-aliasing, uses cheaper shadows, drops three lights and the light shafts/dust, and has 25% fewer people. You can switch presets any time in Settings.
- NPCs are single skinned meshes, and all static props, walls and pokie cabinets are merged into shared batches. A frame costs roughly 100–500 draw calls depending on where you're looking.
- Shadow maps re-render only when the sun moves. The back-bar mirror updates every other frame, and only when you're inside and close enough to see it.
- If the frame rate stays below about 42 fps, the resolution steps down a notch. It never steps back up on its own, so it can't flicker between sizes.

## Online assets

Textures are generated procedurally. When the network allows, the floor and brick textures upgrade to the three.js example textures from jsDelivr. If those fail to load, the game keeps the procedural ones.
