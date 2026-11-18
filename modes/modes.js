// ============================================================================
// DoomZone mod — MODES (solo play): difficulty, the Survival mode and the extra
// rows of the Settings panel.
//  * Difficulty Easy / Normal / Hard (SXQ_TUNE.diff): how much damage the player
//    takes and deals, and how big Survival waves are. Title LEVEL button or
//    Settings → Difficulty. Online rooms always play Normal.
//  * Survival (title MODE button, or ?play=survival): no relays, no boat —
//    endless waves of hounds, gulls and troopers from the map's enemy spawns,
//    a breather with a top-up between waves; the best run per map and
//    difficulty is kept on this device (doomzone.survival.v1). The mission
//    director in game/js/10_game.js skips relays / markers / the intro radio
//    while window.SXQ_SURV is set; troopers/troopers.js skips its own squads.
//  * Settings rows: Difficulty, Aim sensitivity (scales the ADS look slow-down
//    Mt.adsLook of the game's player), FPS counter.
// Choices live in doomzone.modes.v1.
// ============================================================================

var SXQ_TUNE = {
  diff: {
    easy: { label: 'Easy', taken: 0.5, dealt: 1.25, wave: 0.75 },
    normal: { label: 'Normal', taken: 1, dealt: 1, wave: 1 },
    hard: { label: 'Hard', taken: 1.5, dealt: 0.8, wave: 1.3 },
  },
  surv: {
    first: 8, // s before wave 1
    breather: 15, // s between waves
    cap: 12, // robots of the wave alive at once; the rest wait their turn
    tough: 0.04, // each wave past the first: the player's bullets do 4 % less
    toughMax: 0.45,
    heal: 35, // HP back after a cleared wave
    mags: 2, // every owned gun's calibre topped up to this many magazines
    stray: { t: 150, d: 60 }, // a robot still out after t s and farther than d m stops counting
  },
  adsLook: 0.6, // the game's own Mt.adsLook, scaled by the Aim sensitivity setting
}
var SXQ_KEY = 'doomzone.modes.v1'
var SXQ_REC = 'doomzone.survival.v1'
var SXQ = { G: null, opts: null, run: null, ui: null, fps: null }

function SXQ_load() {
  var o = { mode: 'mission', diff: 'normal', aim: 1, fps: false }
  try {
    var s = JSON.parse(localStorage.getItem(SXQ_KEY) || 'null')
    if (s && typeof s === 'object') {
      if (s.mode === 'survival') o.mode = 'survival'
      if (SXQ_TUNE.diff[s.diff]) o.diff = s.diff
      if (Number.isFinite(s.aim)) o.aim = Math.min(1.5, Math.max(0.3, s.aim))
      o.fps = !!s.fps
    }
  } catch (e) { }
  try {
    var p = new URLSearchParams(location.search)
    if (p.get('play') === 'survival' || p.get('play') === 'mission') o.mode = p.get('play')
    if (SXQ_TUNE.diff[p.get('diff')]) o.diff = p.get('diff')
  } catch (e) { }
  return o
}
function SXQ_save() { try { localStorage.setItem(SXQ_KEY, JSON.stringify(SXQ.opts)) } catch (e) { } }
SXQ.opts = SXQ_load()

function SXQ_online() { return !!window.SXN_MP || (typeof SXN !== 'undefined' && SXN.active) }
function SXQ_diff() { return SXQ_online() ? SXQ_TUNE.diff.normal : SXQ_TUNE.diff[SXQ.opts.diff] || SXQ_TUNE.diff.normal }
function SXQ_mapName() { return typeof SX_MAP !== 'undefined' ? SX_MAP : 'port' }
// the director (game/js/10_game.js) reads this flag before every run
function SXQ_apply() { window.SXQ_SURV = SXQ.opts.mode === 'survival' && !SXQ_online() }
SXQ_apply()
// Survival is running: solo with the MODE button, or an online room whose host
// picked Survival (co-op, net/net.js SXN.mode 'surv'). troopers/troopers.js
// holds its own squads then. Online only the host runs the waves; every guest
// keeps a mirror of the host's run (SXQ_mirror) for the HUD and the resupply.
function SXQ_room() { return typeof SXN !== 'undefined' && !!SXN.active && SXN.mode === 'surv' }
function SXQ_survOn() { return SXQ_online() ? SXQ_room() : !!window.SXQ_SURV }
function SXQ_isHost() { return !SXQ_online() || (SXQ_room() && SXN.role === 'host') }
// co-op: bigger waves with more players in the room
function SXQ_players() { return SXQ_online() && typeof SXN_playerCount === 'function' ? SXN_playerCount() : 1 }
function SXQ_coopScale() { return 1 + 0.5 * (SXQ_players() - 1) }

// ---------------------------------------------------------------- records
function SXQ_records() {
  try { var r = JSON.parse(localStorage.getItem(SXQ_REC) || 'null'); return r && typeof r === 'object' ? r : {} } catch (e) { return {} }
}
function SXQ_best(map, diff) { return SXQ_records()[map + '|' + diff] || null }
// a run is better with more waves cleared, then more kills
function SXQ_keep(map, diff, res) {
  var all = SXQ_records(), k = map + '|' + diff, old = all[k]
  var better = !old || res.cleared > old.cleared || (res.cleared === old.cleared && res.kills > old.kills)
  if (better) { all[k] = res; try { localStorage.setItem(SXQ_REC, JSON.stringify(all)) } catch (e) { } }
  return better
}
function SXQ_mmss(t) { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2) }

// ---------------------------------------------------------------- survival
// wave n (from 1): how many of each kind, before the difficulty's size factor
function SXQ_waveMix(n, scale) {
  var total = Math.max(3, Math.round((4 + 2 * (n - 1)) * scale))
  var tr = n < 2 ? 1 : Math.round(total * Math.min(0.5, 0.15 + 0.05 * n))
  var gu = n < 2 ? 0 : Math.round(total * 0.2)
  var ho = Math.max(1, total - tr - gu)
  return { hound: ho, gull: gu, trooper: tr, heavy: n % 5 === 0 }
}
function SXQ_kills() { return typeof SXK !== 'undefined' ? SXK.kills | 0 : 0 }
function SXQ_newRun() {
  // a guest's run only mirrors the host's (SXQ_mirror)
  var mirror = SXQ_online() && !SXQ_isHost()
  return { wave: 0, cleared: 0, state: 'wait', t: SXQ_TUNE.surv.first, waveT: 0, queue: [], live: [], kills0: SXQ_kills(), time: 0, over: false, said: '', mirror: mirror, synced: false, left: 0 }
}
function SXQ_left(R) { return R.mirror ? R.left | 0 : R.queue.length + R.live.length }
function SXQ_objective() {
  var R = SXQ.run
  if (!R) return 'Survive'
  if (R.over) return (SXQ_online() ? 'Survival · the squad is down at wave ' : 'Survival · down at wave ') + R.wave
  // in 5 s steps: every new text re-types the HUD line (and flashes it)
  if (R.state === 'wait') {
    var s = Math.max(5, Math.ceil(R.t / 5) * 5)
    return (R.wave ? 'Wave ' + R.wave + ' cleared · next wave in under ' : 'Survival · first wave in under ') + s + ' s'
  }
  var left = SXQ_left(R)
  return 'Survival · wave ' + R.wave + ' · ' + left + (left === 1 ? ' machine left' : ' machines left')
}
// the living players' feet: me, and online the others' last known spots
function SXQ_livePlayers() {
  var G = SXQ.G, out = []
  if (G.player && G.player.alive) out.push(G.player.pos)
  if (SXQ_online() && typeof SXN_remoteSpots === 'function') SXN_remoteSpots().forEach(function (s) { out.push(new lt.Vector3(s.x, s.y, s.z)) })
  return out
}
function SXQ_nearest(pos) {
  var d = Infinity
  SXQ_livePlayers().forEach(function (p) { d = Math.min(d, Math.hypot(p.x - pos.x, p.z - pos.z)) })
  return d
}
// who the next robot is sent at: online each living player in turn (net/net.js)
function SXQ_focus() {
  var G = SXQ.G, f = SXQ_online() && typeof SXN_spawnFocus === 'function' ? SXN_spawnFocus() : null
  return f || (G.player ? G.player.pos : null)
}

// a spawn point of the map for `kind` ('air' / 'ground'), away from the player
// sent at (`F`) and out of sight if it can
function SXQ_spawnAt(kind, F) {
  var G = SXQ.G, lv = G.level || {}
  var all = (lv.enemySpawns || []).filter(function (s) { return s.type === kind })
  if (!all.length) all = (lv.enemySpawns || []).filter(function (s) { return s.type === 'ground' })
  if (!all.length || !F) return null
  var V3 = lt.Vector3, best = null, bestS = -1e9, eye = new V3(F.x, F.y + 1.6, F.z)
  all.forEach(function (s) {
    var d = Math.hypot(s.pos.x - F.x, s.pos.z - F.z)
    var sc = Math.random() * 1.5 + (d >= 18 && d <= 75 ? 3 : d < 18 ? -(18 - d) / 3 : -(d - 75) / 30)
    try { if (!G.physics.lineOfSight(new V3(s.pos.x, s.pos.y + 1, s.pos.z), eye)) sc += 2 } catch (e) { }
    if (sc > bestS) { bestS = sc; best = s }
  })
  var p = best.pos.clone(), jx = (Math.random() - 0.5) * 2.4, jz = (Math.random() - 0.5) * 2.4
  if (kind === 'air') { if (p.y < 2.5) p.y = 6 + Math.random() * 3; p.x += jx; p.z += jz }
  else { try { if (G.physics.nav.isWalkable(p.x + jx, p.z + jz)) { p.x += jx; p.z += jz } } catch (e) { } }
  return p
}
function SXQ_startWave() {
  var G = SXQ.G, R = SXQ.run
  R.wave++
  R.state = 'fight'
  R.waveT = 0
  var mix = SXQ_waveMix(R.wave, SXQ_diff().wave * SXQ_coopScale())
  var q = []
  for (var i = 0; i < mix.hound; i++) q.push('hound')
  for (var j = 0; j < mix.gull; j++) q.splice(Math.min(q.length, 1 + j * 2), 0, 'gull')
  for (var k = 0; k < mix.trooper; k++) q.splice(Math.min(q.length, k * 3), 0, mix.heavy && k % 2 === 0 ? 'heavy' : 'trooper')
  R.queue = q
  try { G.hud.message('Wave ' + R.wave + (mix.heavy ? ' · heavy troopers' : ''), 3) } catch (e) { }
  try { G.hud.radio && G.hud.radio(R.wave === 1 ? 'Control: here they come. Hold your ground.' : mix.heavy ? 'Control: armour in this one — heavy troopers.' : 'Control: wave ' + R.wave + ' inbound.', 3.4) } catch (e) { }
  G.events.emit('survival:wave', { wave: R.wave })
}
function SXQ_spawnOne(type) {
  var G = SXQ.G
  if (type === 'trooper' || type === 'heavy') {
    var T = G.units && G.units.troopers
    if (!T) return []
    var n = Math.random() < 0.15 + 0.03 * SXQ.run.wave ? 'marksman' : 'rifle'
    return T.spawnSquad(1, null, { variant: type === 'heavy' ? 'heavy' : n }) || []
  }
  var F = SXQ_focus()
  var at = SXQ_spawnAt(type === 'gull' ? 'air' : 'ground', F)
  if (!at) return []
  var e = null
  try { e = G.enemies.spawn(type, at, { state: 'alert', target: F }) } catch (err) { console.error('[modes] spawn ' + type, err) }
  try { G.enemies.alert && G.enemies.alert(F, 60) } catch (err) { }
  return e ? [e] : []
}
function SXQ_tick(dt) {
  var G = SXQ.G, R = SXQ.run, T = SXQ_TUNE.surv
  // the HUD's relay row has nothing to count in Survival (modes.css)
  var cls = !!R && SXQ_survOn()
  if (SXQ._cls !== cls) { SXQ._cls = cls; document.documentElement.classList.toggle('sxq-surv', cls) }
  if (!R || !SXQ_survOn() || !G.game) return
  // online the room plays on behind the pause menu
  var st = G.game.state
  if (st !== 'playing' && !(SXQ_online() && st === 'paused')) return
  if (R.over) { SXQ_said(R); return }
  R.time += dt
  if (R.mirror) {
    // a guest: the host's state, its clock run down here between messages
    if (R.state === 'wait') R.t = Math.max(0, R.t - dt)
  } else if (R.state === 'wait') {
    R.t -= dt
    if (R.t <= 0) SXQ_startWave()
  } else {
    R.waveT += dt
    // stragglers: dead, or stuck far from every player long after the wave began
    R.live = R.live.filter(function (u) {
      if (!u || !u.alive) return false
      if (R.waveT > T.stray.t && u.pos && SXQ_nearest(u.pos) > T.stray.d) return false
      return true
    })
    // the rest of the wave comes in as room frees up (the trooper module caps its own count too)
    var guard = 4, cap = Math.min(20, T.cap + 3 * (SXQ_players() - 1))
    while (R.queue.length && R.live.length < cap && guard-- > 0) {
      var type = R.queue[0]
      var got = SXQ_spawnOne(type)
      if (!got.length) {
        // no room (trooper cap) or no spawn: retry this one later
        R.queue.push(R.queue.shift())
        break
      }
      R.queue.shift()
      got.forEach(function (u) { R.live.push(u) })
    }
    if (!R.queue.length && !R.live.length) {
      R.cleared = R.wave
      R.state = 'wait'
      R.t = T.breather
      SXQ_resupply()
      try { G.hud.message('Wave ' + R.wave + ' cleared', 3) } catch (e) { }
      G.events.emit('survival:cleared', { wave: R.wave })
    }
  }
  SXQ_said(R)
}
function SXQ_said(R) {
  var obj = SXQ_objective()
  if (obj !== R.said) { R.said = obj; try { SXQ.G.hud.setObjective(obj) } catch (e) { } }
}
// a guest: the host's run state (net/net.js 'sv' {w, s 1 fight / 0 breather,
// tt s left, l machines left, c waves cleared}). The first message after
// joining only syncs; later ones announce the new wave / the cleared one and
// resupply this player, as the host's own run does.
function SXQ_mirror(m) {
  var G = SXQ.G, R = SXQ.run
  if (!G || !R || !R.mirror || R.over) return
  var w0 = R.wave, c0 = R.cleared
  R.wave = m.w | 0; R.state = m.s ? 'fight' : 'wait'; R.t = +m.tt || 0; R.left = m.l | 0; R.cleared = m.c | 0
  if (!R.synced) { R.synced = true; SXQ_said(R); return }
  if (R.state === 'fight' && R.wave > w0) {
    try { G.hud.message('Wave ' + R.wave + (R.wave % 5 === 0 ? ' · heavy troopers' : ''), 3) } catch (e) { }
    G.events.emit('survival:wave', { wave: R.wave })
  }
  if (R.cleared > c0) {
    SXQ_resupply()
    try { G.hud.message('Wave ' + R.cleared + ' cleared', 3) } catch (e) { }
    G.events.emit('survival:cleared', { wave: R.cleared })
  }
  SXQ_said(R)
}
// online: the squad is down (every client, from the host's 'sv' over). My
// best co-op run per map is kept as '<map>|coop'.
function SXQ_coopOver(m) {
  var G = SXQ.G, R = SXQ.run
  if (!R || R.over) return null
  R.over = true
  if (m) { R.wave = m.w | 0; R.cleared = m.c | 0 }
  // kills: the host's tally for me when it sent one (m.kills), else my counter's
  var kills = m && m.kills != null ? m.kills | 0 : SXQ_kills() - R.kills0
  var res = { cleared: R.cleared, wave: R.wave, kills: kills, time: Math.round(R.time), at: Date.now(), players: SXQ_players() }
  var map = SXQ_mapName(), old = SXQ_best(map, 'coop')
  R.record = SXQ_keep(map, 'coop', res)
  R.result = res
  R.best = R.record ? res : old
  SXQ_said(R)
  G.events.emit('survival:over', { wave: R.wave, cleared: R.cleared, kills: res.kills, time: res.time, diff: 'coop', map: map })
  return R
}
// after a cleared wave: some health, every owned gun's calibre to `mags` magazines
function SXQ_resupply() {
  var G = SXQ.G, T = SXQ_TUNE.surv
  try { G.player.heal(T.heal) } catch (e) { }
  try {
    var A = G.weapon.arsenal, L = A.loadout
    Object.keys(A.guns).forEach(function (k) {
      var g = A.guns[k]
      if (!L.owned[k] || !g) return
      var want = (g.magSize | 0) * T.mags
      if (g.reserve < want) g.reserve = want
    })
  } catch (e) { }
}
function SXQ_over() {
  var G = SXQ.G, R = SXQ.run
  if (!R || R.over) return
  R.over = true
  var res = { cleared: R.cleared, wave: R.wave, kills: SXQ_kills() - R.kills0, time: Math.round(R.time), at: Date.now() }
  var map = SXQ_mapName(), diff = SXQ.opts.diff
  var old = SXQ_best(map, diff)
  R.record = SXQ_keep(map, diff, res)
  R.result = res
  R.best = R.record ? res : old
  G.events.emit('survival:over', { wave: R.wave, cleared: R.cleared, kills: res.kills, time: res.time, diff: diff, map: map })
}

// the death screen: wave / kills / best instead of the relays
function SXQ_deadScreen() {
  var root = document.querySelector('#ui .menu [data-s="dead"]')
  if (!root) return
  var dd = root.querySelector('[data-f="dead-relays"]'), dt = dd && dd.previousElementSibling
  var stats = root.querySelector('.m-stats')
  var extra = root.querySelectorAll('.sxq-dead')
  var R = SXQ.run, on = !!(window.SXQ_SURV && R && R.result)
  if (dt) { if (dt._sxq == null) dt._sxq = dt.textContent; dt.textContent = on ? 'Waves cleared' : dt._sxq }
  extra.forEach(function (n) { n.remove() })
  if (!on || !stats) return
  dd.textContent = String(R.result.cleared)
  var b = R.best
  var rows = [['Kills', String(R.result.kills)], ['Best · ' + SXQ_diff().label, R.record ? 'New best!' : b ? 'Wave ' + b.cleared + ' · ' + b.kills + ' kills' : '—']]
  rows.forEach(function (r) {
    var d = document.createElement('div')
    d.className = 'sxq-dead' + (r[1] === 'New best!' ? ' sxq-new' : '')
    d.innerHTML = '<dt></dt><dd></dd>'
    d.firstChild.textContent = r[0]
    d.lastChild.textContent = r[1]
    stats.appendChild(d)
  })
}

// ---------------------------------------------------------------- title screen
function SXQ_title() {
  var menu = document.querySelector('#ui .menu')
  var acts = menu && menu.querySelector('.m-title .m-actions')
  if (!acts || acts.querySelector('.sxq-mode')) return
  var mk = function (cls, k) {
    var b = document.createElement('button')
    b.className = 'btn sxd-map ' + cls
    b.innerHTML = '<span class="sxd-map-k"></span><span class="sxd-map-v"></span>'
    b.firstChild.textContent = k
    return b
  }
  var mode = mk('sxq-mode', 'Mode'), lvl = mk('sxq-lvl', 'Level')
  var after = acts.querySelector('.sxd-mapwrap') || acts.lastElementChild
  acts.insertBefore(lvl, after ? after.nextSibling : null)
  acts.insertBefore(mode, lvl)
  var best = document.createElement('p')
  best.className = 'm-note sxq-best'
  acts.parentNode.insertBefore(best, acts.nextSibling)
  mode.addEventListener('click', function () {
    SXQ.opts.mode = SXQ.opts.mode === 'survival' ? 'mission' : 'survival'
    SXQ_save(); SXQ_apply(); SXQ_titleSync()
  })
  lvl.addEventListener('click', function () {
    var order = ['easy', 'normal', 'hard']
    SXQ.opts.diff = order[(order.indexOf(SXQ.opts.diff) + 1) % 3]
    SXQ_save(); SXQ_titleSync(); SXQ_panelSync()
  })
  SXQ_titleSync()
}
function SXQ_titleSync() {
  var menu = document.querySelector('#ui .menu')
  if (!menu) return
  var surv = SXQ.opts.mode === 'survival'
  var mv = menu.querySelector('.sxq-mode .sxd-map-v'), lv = menu.querySelector('.sxq-lvl .sxd-map-v')
  mv && (mv.textContent = surv ? 'Survival' : 'Mission')
  lv && (lv.textContent = SXQ_TUNE.diff[SXQ.opts.diff].label)
  var pr = menu.querySelector('.m-title .m-premise')
  if (pr) {
    if (pr._sxq == null || (!surv && pr.textContent !== pr._sxqSurv)) pr._sxq = pr.textContent
    pr._sxqSurv = 'Survival: no relays, no boat. The machines come in waves, each one bigger. Hold out as long as you can.'
    pr.textContent = surv ? pr._sxqSurv : pr._sxq
  }
  // the stock note under the buttons gives its room to the best-run line
  menu.querySelectorAll('.m-title .m-note:not(.sxq-best)').forEach(function (n) { n.hidden = surv })
  var best = menu.querySelector('.sxq-best')
  if (best) {
    var b = SXQ_best(SXQ_mapName(), SXQ.opts.diff)
    best.hidden = !surv
    best.textContent = b ? 'Best here on ' + SXQ_TUNE.diff[SXQ.opts.diff].label + ': wave ' + b.cleared + ' cleared · ' + b.kills + ' kills · ' + SXQ_mmss(b.time) : 'No Survival run on this map at ' + SXQ_TUNE.diff[SXQ.opts.diff].label + ' yet.'
  }
}

// ---------------------------------------------------------------- settings rows
function SXQ_panel() {
  var pane = document.querySelector('#ui .menu .panel-b[data-pane="settings"]')
  if (!pane || pane.querySelector('.sxq-row')) return
  var note = pane.querySelector('.panel-note')
  var html =
    '<div class="row sxq-row"><label id="l-sxq-diff">Difficulty</label><div class="seg" role="group" aria-labelledby="l-sxq-diff">' +
    ['easy', 'normal', 'hard'].map(function (k) { return '<button data-sxq-diff="' + k + '" aria-pressed="false">' + SXQ_TUNE.diff[k].label + '</button>' }).join('') + '</div></div>' +
    '<div class="row sxq-row"><label for="s-sxq-aim">Aim sensitivity</label><div class="slider"><input id="s-sxq-aim" type="range" min="0.3" max="1.5" step="0.05"><output data-o="sxq-aim"></output></div></div>' +
    '<div class="row sxq-row"><label id="l-sxq-fps">FPS counter</label><button class="toggle" data-sxq-fps aria-labelledby="l-sxq-fps" aria-pressed="false"><i></i><span>Off</span></button></div>' +
    '<p class="panel-note sxq-row" data-sxq-dnote></p>'
  var box = document.createElement('div')
  box.innerHTML = html
  while (box.firstChild) pane.insertBefore(box.firstChild, note || null)
  pane.querySelectorAll('[data-sxq-diff]').forEach(function (b) {
    b.addEventListener('click', function () { SXQ.opts.diff = b.dataset.sxqDiff; SXQ_save(); SXQ_panelSync(); SXQ_titleSync() })
  })
  var aim = pane.querySelector('#s-sxq-aim')
  aim.addEventListener('input', function () { SXQ.opts.aim = +aim.value; SXQ_save(); SXQ_applyAim(); SXQ_panelSync() })
  pane.querySelector('[data-sxq-fps]').addEventListener('click', function () { SXQ.opts.fps = !SXQ.opts.fps; SXQ_save(); SXQ_panelSync() })
  SXQ_panelSync()
}
function SXQ_panelSync() {
  var pane = document.querySelector('#ui .menu .panel-b[data-pane="settings"]')
  if (!pane) return
  pane.querySelectorAll('[data-sxq-diff]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sxqDiff === SXQ.opts.diff)) })
  var aim = pane.querySelector('#s-sxq-aim'), out = pane.querySelector('[data-o="sxq-aim"]')
  if (aim) aim.value = SXQ.opts.aim
  if (out) out.textContent = SXQ.opts.aim.toFixed(2) + '×'
  var f = pane.querySelector('[data-sxq-fps]')
  if (f) { f.setAttribute('aria-pressed', String(SXQ.opts.fps)); f.querySelector('span').textContent = SXQ.opts.fps ? 'On' : 'Off' }
  var n = pane.querySelector('[data-sxq-dnote]')
  if (n) {
    var D = SXQ_TUNE.diff[SXQ.opts.diff]
    n.textContent = SXQ_online() ? 'Online rooms always play Normal.' : D.label + ': you take ' + Math.round(D.taken * 100) + ' % damage and deal ' + Math.round(D.dealt * 100) + ' %; Survival waves ×' + D.wave + '. Applies from the next shot.'
  }
}
function SXQ_applyAim() { try { Mt.adsLook = SXQ_TUNE.adsLook * SXQ.opts.aim } catch (e) { } }

// a small frame counter, top left
function SXQ_fpsTick(dt) {
  var on = SXQ.opts.fps
  if (!SXQ.fps) {
    if (!on) return
    var el = document.createElement('div')
    el.className = 'sxq-fps'
    ;(document.getElementById('app') || document.body).appendChild(el)
    SXQ.fps = { el: el, n: 0, t: 0 }
  }
  var F = SXQ.fps
  F.el.hidden = !on
  if (!on) return
  F.n++; F.t += dt
  if (F.t >= 0.5) { F.el.textContent = Math.round(F.n / F.t) + ' FPS'; F.n = 0; F.t = 0 }
}

// ---------------------------------------------------------------- install
;(function SXQ_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || !G.events || !G.player || !G.combat) { setTimeout(wait, 250); return }
    SXQ.G = G
    window.__sxq = SXQ // tests
    // difficulty: damage the player takes / deals (solo)
    var dmg = G.player.damage
    G.player.damage = function (amount, from) { return dmg.call(this, amount * SXQ_diff().taken, from) }
    var shot = G.combat.playerShot
    G.combat.playerShot = function (o, d, opts) {
      var k = SXQ_diff().dealt
      var R = SXQ.run
      if (SXQ_survOn() && R && R.wave > 1) k /= 1 + Math.min(SXQ_TUNE.surv.toughMax, SXQ_TUNE.surv.tough * (R.wave - 1))
      if (k !== 1 && opts && opts.damage != null) opts = Object.assign({}, opts, { damage: opts.damage * k })
      else if (k !== 1 && !opts) opts = { damage: 28 * k }
      return shot.call(this, o, d, opts)
    }
    SXQ_applyAim()
    SXQ_title()
    SXQ_panel()
    G.events.on('game:state', function (ev) {
      if (!ev) return
      if (ev.state === 'title') { SXQ_title(); SXQ_titleSync() }
      // a fresh run (Start, Retry, Restart)
      if (ev.state === 'playing' && (ev.prev === 'intro' || ev.prev === 'title')) {
        SXQ_apply()
        // (online: Survival room, the host's run or a guest's mirror of it)
        SXQ.run = SXQ_survOn() ? SXQ_newRun() : null
        if (SXQ.run) {
          try { G.hud.setRelays && G.hud.setRelays(0, 0) } catch (e) { }
          try { G.hud.radio && G.hud.radio(SXQ_online() ? 'Control: no relays tonight. They come in waves — stick together.' : 'Control: no relays tonight. They come in waves — stay alive.', 4) } catch (e) { }
        }
      }
    })
    G.events.on('player:dead', function () {
      // solo: the run ends; online the host ends it once the whole squad is down (net/net.js)
      if (window.SXQ_SURV && SXQ.run && !SXQ_online()) SXQ_over()
      setTimeout(SXQ_deadScreen, 0)
    })
    // ?autostart can be playing before this hooked in
    if (G.game && G.game.state === 'playing' && SXQ_survOn() && !SXQ.run) {
      SXQ.run = SXQ_newRun()
      try { G.hud.setRelays && G.hud.setRelays(0, 0) } catch (e) { }
    }
    var last = performance.now()
    var loop = function () {
      var now = performance.now(), dt = Math.min(0.1, (now - last) / 1000)
      last = now
      try { SXQ_tick(dt); SXQ_fpsTick(dt) } catch (e) { if (!SXQ._err) { SXQ._err = 1; console.error('[modes] tick', e) } }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }
  setTimeout(wait, 300)
})()
