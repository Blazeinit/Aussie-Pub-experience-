
// =====================================================================
//  VENUES: which pub you're in tonight.
//  A venue is data: its name and signage, colours, machine lineup, prices, crowd, soundtrack and locals.
//  The world is built once at boot for the chosen venue; "catching a cab" to another pub saves the game
//  and reloads into it (so nothing needs unloading and the static batches stay valid).
// =====================================================================
const VENUES = {
  royal: {
    id: 'royal', name: 'THE ROYAL', hotel: 'ROYAL HOTEL', est: 'EST. 1888', short: 'the Royal', sub: 'FINE ALES · WINES · SPIRITS', terrazzo: 'ROYAL',
    blurb: "Wattle Creek's last proper pub. Pressed-tin ceilings, a full Dragon Link bank and Fire Mountain out the back, and everyone you know.",
    story: true, priceMul: 1, crowd: 1, exposure: 1, warm: 1, fare: 0,
    tint: { carpet: 0xffffff, gaming: 0x6a3a4a, paint: 0xffffff, ceiling: 0xc8bca0, wood: 0xffffff },
    fascia: ['#1f4d34', '#123222', '#f0cf6a'], roof: '#7a1f14', roofStroke: '#f3e2b8', deckLine: 'THE ROYAL · GAMING · 1c',
    machines: {
      back: ['am', 'gc', 'pm', 'hp', 'hp', 'am', 'gc', 'pm'], front: ['fm', 'fm', 'buffalo'], rear: ['qotn', 'bigred', 'buffalo'], terrace: ['dragon', 'outback', 'reef', 'sevens']
    },
    pal: { carpet: ['#3b0c14', '#c99a2e', '#1b6d73', '#d6a838', '#7a1424', '#e8c35a', '#2a8a7f'], damask: ['#d6c49a', '150,108,40', '120,80,25', '170,125,50'] },
    bartenders: ['Jacko', 'Rhonda', 'Mick'], songs: null, moments: null,
  },
  rsl: {
    id: 'rsl', name: 'WATTLE CREEK RSL', hotel: 'RSL SUB-BRANCH', est: 'EST. 1921', short: 'the RSL', sub: 'MEMBERS & GUESTS WELCOME', terrazzo: 'RSL',
    blurb: 'The club. Carpet you could land a plane on, a courtesy bus, $14 schnitty night, and the newest machines in town, only here: Lightning Dollar Link, Thunder Empire, Lightning Link (Magic Pearl, Happy Lantern), Dragon Train, Cash Express, Buffalo Gold and Timber Wolf.',
    story: false, priceMul: 0.82, crowd: 1.2, exposure: 1.08, warm: 0.5, fare: 12, unlock: 0,
    tint: { carpet: 0xffffff, gaming: 0x2a3a6a, paint: 0xffffff, ceiling: 0xd2d6dc, wood: 0xc8b8a8 },
    fascia: ['#14305a', '#0a1a3a', '#e8c56a'], roof: '#14305a', roofStroke: '#f1e4bd', deckLine: 'WATTLE CREEK RSL · GAMING · 1c',
    machines: {
      back: ['ldl1', 'ldl2', 'ldl3', 'ldl4', 'llmp', 'llhl', 'llmp', 'llhl'], front: ['te1', 'te2', 'cashx'], rear: ['dtrain', 'dtrain', 'cashx'], terrace: ['bgold', 'twolf', 'bgold', 'twolf']
    },
    pal: { carpet: ['#0f2350', '#b8c4e0', '#4a78d0', '#dcdcc0', '#243a78', '#f0e8c0', '#3a6ab0'], damask: ['#8fb2e6', '40,72,150', '28,52,115', '60,96,170'] },
    bartenders: ['Lorraine', 'Digger', 'Marg'], songs: [4, 6, 5, 0], moments: ['footy', 'inspector', 'busker', 'wake'],
  },
  dive: {
    id: 'dive', name: 'THE RUSTY ANCHOR', hotel: 'RUSTY ANCHOR', est: 'EST. 1964', short: 'the Rusty Anchor', sub: 'COLD BEER · HOT CHIPS · NO DRAMA', terrazzo: 'ANCHOR',
    blurb: "A sticky-carpet dive near the wharf. Cheap pots, old-school pokies (Queen of the Nile, Big Red, 5 Dragons), loud bands and a bouncer called Tiny.",
    story: false, priceMul: 0.7, crowd: 1.05, exposure: 0.84, warm: 1.15, fare: 8, unlock: 0,
    tint: { carpet: 0xffffff, gaming: 0x3a2a2a, paint: 0xffffff, ceiling: 0xa09074, wood: 0x9a8a78 },
    fascia: ['#2a1a14', '#140a08', '#e8a050'], roof: '#5a2a14', roofStroke: '#e8c88a', deckLine: 'THE RUSTY ANCHOR · POKIES · 1c',
    machines: {
      back: ['qotn', 'qotn', 'bigred', 'bigred', 'buffalo', 'dragon', 'outback', 'sevens'], front: ['reef', 'sevens', 'dragon'], rear: ['am', 'pm', 'gc'], terrace: ['outback', 'reef', 'qotn', 'bigred']
    },
    pal: { carpet: ['#2a1410', '#7a5030', '#5a4636', '#9a7a48', '#4a1a14', '#b89050', '#4a5a40'], damask: ['#8e9c78', '60,74,40', '45,58,30', '78,92,50'] },
    bartenders: ['Tiny', 'Shaz', 'Gaz'], songs: [2, 3, 7, 6], moments: ['bucks', 'blackout', 'busker', 'footy'],
  },
};
let VENUE = VENUES.royal;   // the building you're standing in (see Clubs.update); the world is built with the Royal's look
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
