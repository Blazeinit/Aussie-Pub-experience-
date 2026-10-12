# Design pass: deeper nights, real machines, more pubs

One page, kept honest. What changed, in what order, and the risks.

## Done in this pass
1. **Night director** (`src/21-night.js`, `22-moments.js`): a night has beats (settle in, rush, last-call set piece), three goals drawn from a pool, a standing at the Royal with perks (tab, mates' rates, "the usual", own darts, free schooner, plaque), a tip jar, a log that feeds the end-of-night summary, and one **Night Moment** per night (blackout, bucks-party skull dare, wake, footy final, licensing inspector, busker).
2. **Real machine screens** (`src/23-skins.js`, `assets/slots`, `tools/slots/extract.py`): the supplied screenshots (Dragon Link x4, Konami Fire Mountain, Lightning Dollar Link x4, Thunder Empire x2) are used as-is. The exact screen art is the display; reel symbols are cut out of those screens; credit/bet/win and jackpot values are painted over the baked ones; hold & spin plays on the real medal-and-coin-grid art. Portrait cabinets with top boxes, a Lightning Dollar Link header sign, LED bezels.
3. **Pub classics** (`src/24-classics.js`): Queen of the Nile (free games x3), Big Red, Buffalo (original art, real-world mechanics); the house games are retitled 5 Dragons and Where's the Gold. Every game's return is calibrated to about 90% (`window.__rtp`, `__rtpCal`, `__rtpLine` in the page).
4. **Real HDRI skies** (`assets/env`): Poly Haven CC0 HDRIs from the `@pmndrs/assets` npm package drive the reflections (the network policy allows npm and PyPI only).
5. **Gents rebuilt, entry doors rebuilt, main street shopfronts** (`src/14-world2.js`, `03-world.js`, `25-town.js`).
6. **Venues** (`src/01-venue.js`): the Royal, Wattle Creek RSL and the Rusty Anchor are data (palette, signage, machine lineups, prices, crowd, soundtrack, locals, which Night Moments can fire). Travelling saves, stores `ld_venue` and reloads, because the static batches can't be unloaded. The day card has a venue picker; the dive unlocks at standing 15.
7. **Dialogue + cinematics** (`26-dialogue.js`, `27-conversations.js`, `28-cine.js`): a graph runner with charm/nerve checks, costs, answer timers, per-character memory and "dig deeper" arcs; about 30 graphs. The cinematic director plays skippable shots (opening, last call, jackpot, council, cab) and respects `settings.cinematics`.
8. **Food** (`29-food.js`): 16 dishes with chunk-based models, kitchen-pass service (the bartender carries the plate), first-person eating with fork/knife/hand animations, steam, partial eating applies partial stats.
9. **Overheard** (`30-overheard.js`): eight patron-to-patron rumours with small effects (a hot machine, an inspector warning, a racing tip).
10. **Pool** (`10-pool-sim.js` physics/rules/AI + `31-pool-game.js` top-down game): eight-ball on the house table, ball in hand, spin dial, stakes, an AI with a per-opponent skill. Interact at the table or via Spud / Slick Rick conversations.
11. Bug found and fixed on the way: patrons walking in from the street got stuck on a collider in front of the pub.

## Risks / known gaps
- The skin art is third-party artwork supplied by the user for a non-commercial game. Do not publish it publicly without swapping it out.
- Lightning Dollar Link and Thunder Empire screens were supplied at low resolution (about 140px wide): they are upscaled and look soft up close.
- Pokie realism pass 2 (hand-to-button IK, screen reflections, TITO printer) was not done. Venue-specific events (RSL members' draw, dive pool league) are not done. NPCs don't yet eat props at tables.

## Testing
`tools/test`: `npm i`, then `node skins.mjs`, `node classics.mjs`, `node machines-bug.mjs`, `node rtp.mjs`, `node night.mjs`, `node moments.mjs`, `node gents.mjs`, `node ext.mjs`. Screenshots land in `tools/test/out/` (gitignored). Run one browser test at a time (they share a CPU and the machines test is slow).
