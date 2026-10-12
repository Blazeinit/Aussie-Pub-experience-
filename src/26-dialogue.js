
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
