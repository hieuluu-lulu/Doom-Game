// ============================================================================
// DoomZone mod — STATS: lifetime numbers and achievements, kept on this device
// only (localStorage doomzone.stats.v1). STATS on the title screen and in the
// pause menu opens the sheet; an unlock shows a toast at the top.
//  * kills: solo, the player's own bullet / blast / vehicle gun finished the
//    robot (player:hitEnemy killed); online, the room's credit (net:myKill from
//    net/net.js), players downed counted apart
//  * headshot kills: the killing hit was on the weak point (part 'weak')
//  * shots / hits: every ray of G.combat.playerShot (a shotgun blast counts its
//    pellets, like the game's own debrief accuracy)
//  * longest kill, kills per weapon, deaths, missions finished (map, Hard,
//    accuracy), best Survival run (waves cleared), time played
// ============================================================================

var SXR_KEY = 'doomzone.stats.v1'
var SXR_TUNE = { triple: { n: 3, s: 4 }, toast: 4.5, saveEvery: 5 }
var SXR = { G: null, s: null, dirty: false, saveT: 0, recent: [], toasts: [], toastT: 0, ui: null, open: false }

function SXR_blank() {
  return { kills: 0, heads: 0, shots: 0, hits: 0, deaths: 0, pvp: 0, longest: 0, weapons: {}, missions: 0, missionMaps: {}, missionHard: 0, bestAcc: 0, waves: 0, time: 0, ach: {}, since: Date.now() }
}
function SXR_load() {
  var s = SXR_blank()
  try {
    var o = JSON.parse(localStorage.getItem(SXR_KEY) || 'null')
    if (o && typeof o === 'object') for (var k in s) if (o[k] != null && typeof o[k] === typeof s[k]) s[k] = o[k]
  } catch (e) { }
  return s
}
function SXR_save() {
  SXR.dirty = false
  try { localStorage.setItem(SXR_KEY, JSON.stringify(SXR.s)) } catch (e) { }
}
SXR.s = SXR_load()

var SXR_ACH = [
  { id: 'first', name: 'First blood', desc: 'Destroy your first machine', test: function (s) { return s.kills >= 1 } },
  { id: 'k100', name: 'Scrap dealer', desc: 'Destroy 100 machines', test: function (s) { return s.kills >= 100 } },
  { id: 'k500', name: 'Machine breaker', desc: 'Destroy 500 machines', test: function (s) { return s.kills >= 500 } },
  { id: 'hs25', name: 'Sharpshooter', desc: '25 headshot kills', test: function (s) { return s.heads >= 25 } },
  { id: 'long', name: 'Long shot', desc: 'A kill from 100 m or more', test: function (s) { return s.longest >= 100 } },
  { id: 'knife', name: 'Up close', desc: 'A knife kill', test: function (s) { return (s.weapons.Knife | 0) >= 1 } },
  { id: 'triple', name: 'Triple', desc: '3 kills within 4 seconds' },
  { id: 'mission', name: 'Lights out', desc: 'Finish a mission', test: function (s) { return s.missions >= 1 } },
  { id: 'tour', name: 'World tour', desc: 'Finish a mission on all 4 maps', test: function (s) { return Object.keys(s.missionMaps).length >= 4 } },
  { id: 'hard', name: 'The hard way', desc: 'Finish a mission on Hard', test: function (s) { return s.missionHard >= 1 } },
  { id: 'steady', name: 'Steady hands', desc: 'Finish a mission with 50 % accuracy or better', test: function (s) { return s.bestAcc >= 0.5 } },
  { id: 'w5', name: 'Holding the line', desc: 'Clear 5 Survival waves in one run', test: function (s) { return s.waves >= 5 } },
  { id: 'w10', name: 'Last one standing', desc: 'Clear 10 Survival waves in one run', test: function (s) { return s.waves >= 10 } },
  { id: 'pvp', name: 'Rival', desc: 'Down another player online', test: function (s) { return s.pvp >= 1 } },
]

function SXR_online() { return typeof SXN !== 'undefined' && !!SXN.active }
function SXR_unlock(id) {
  var s = SXR.s
  if (s.ach[id]) return
  var a = SXR_ACH.find(function (x) { return x.id === id })
  if (!a) return
  s.ach[id] = Date.now()
  SXR.dirty = true
  SXR.toasts.push(a)
  try { SXR.G.events.emit('stats:achievement', { id: id }) } catch (e) { }
}
function SXR_check() { SXR_ACH.forEach(function (a) { if (a.test && !SXR.s.ach[a.id] && a.test(SXR.s)) SXR_unlock(a.id) }) }
function SXR_bump() { SXR.dirty = true; SXR_check() }

// a kill of mine: robot or player, the weapon, how far
function SXR_kill(opts) {
  var s = SXR.s
  if (opts.pvp) s.pvp++
  else s.kills++
  var w = opts.weapon || 'Other'
  s.weapons[w] = (s.weapons[w] | 0) + 1
  if (opts.dist > s.longest) s.longest = Math.round(opts.dist)
  var now = performance.now() / 1000
  SXR.recent.push(now)
  SXR.recent = SXR.recent.filter(function (t) { return now - t <= SXR_TUNE.triple.s })
  if (SXR.recent.length >= SXR_TUNE.triple.n) SXR_unlock('triple')
  SXR_bump()
}
function SXR_weapon(explosive) {
  if (explosive) return 'Explosive'
  var w = typeof SXK_weapon === 'function' ? SXK_weapon() : ''
  return w || 'Other'
}

// ---------------------------------------------------------------- the sheet
function SXR_fmtTime(t) {
  t = Math.floor(t)
  var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60)
  return h ? h + ' h ' + m + ' min' : m + ' min'
}
function SXR_pct(a, b) { return b > 0 ? Math.round((100 * a) / b) + ' %' : '—' }
function SXR_rows() {
  var s = SXR.s
  var fav = null
  for (var w in s.weapons) if (!fav || s.weapons[w] > s.weapons[fav]) fav = w
  var all = s.kills + s.pvp
  return [
    ['Machines destroyed', String(s.kills)],
    ['Players downed (online)', String(s.pvp)],
    ['Deaths', String(s.deaths)],
    ['K / D', s.deaths ? (all / s.deaths).toFixed(2) : String(all)],
    ['Accuracy', SXR_pct(s.hits, s.shots)],
    ['Headshot kills', s.heads + (s.kills ? ' · ' + SXR_pct(s.heads, s.kills) : '')],
    ['Longest kill', s.longest ? s.longest + ' m' : '—'],
    ['Favourite weapon', fav ? fav + ' · ' + s.weapons[fav] : '—'],
    ['Missions finished', s.missions + (s.missionHard ? ' · ' + s.missionHard + ' on Hard' : '')],
    ['Best Survival run', s.waves ? s.waves + (s.waves === 1 ? ' wave' : ' waves') + ' cleared' : '—'],
    ['Time played', SXR_fmtTime(s.time)],
  ]
}
function SXR_build() {
  if (SXR.ui && SXR.ui.root.isConnected) return SXR.ui
  var root = document.createElement('div')
  root.className = 'sxr'
  root.hidden = true
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-label', 'Service record')
  root.innerHTML =
    '<div class="sxr-card">' +
    '<header class="sxr-h"><div><div class="m-k">Kept on this device</div><h2 class="m-h">Service record</h2></div><button class="btn small" data-sxr="close">Close</button></header>' +
    '<div class="sxr-b"><dl class="sxr-stats"></dl><h3 class="sxr-ah">Achievements <span></span></h3><ul class="sxr-ach"></ul>' +
    '<div class="sxr-f"><button class="btn small" data-sxr="reset">Reset stats</button></div></div></div>'
  var toast = document.createElement('div')
  toast.className = 'sxr-toast'
  toast.setAttribute('aria-live', 'polite')
  toast.innerHTML = '<small>Achievement unlocked</small><b></b><span></span>'
  var app = document.getElementById('app') || document.body
  app.appendChild(root)
  app.appendChild(toast)
  var q = function (s) { return root.querySelector(s) }
  SXR.ui = { root: root, stats: q('.sxr-stats'), ach: q('.sxr-ach'), count: q('.sxr-ah span'), reset: q('[data-sxr="reset"]'), toast: toast, tb: toast.querySelector('b'), ts: toast.querySelector('span') }
  root.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sxr]')
    if (e.target === root) { SXR_show(false); return }
    if (!b) return
    if (b.dataset.sxr === 'close') SXR_show(false)
    if (b.dataset.sxr === 'reset') {
      if (b.dataset.armed) {
        SXR.s = SXR_blank(); SXR_save(); SXR_fill()
        b.textContent = 'Reset stats'; delete b.dataset.armed
      } else { b.dataset.armed = '1'; b.textContent = 'Click again to wipe everything' }
    }
  })
  return SXR.ui
}
function SXR_fill() {
  var ui = SXR_build(), s = SXR.s
  ui.stats.innerHTML = ''
  SXR_rows().forEach(function (r) {
    var d = document.createElement('div')
    d.innerHTML = '<dt></dt><dd></dd>'
    d.firstChild.textContent = r[0]
    d.lastChild.textContent = r[1]
    ui.stats.appendChild(d)
  })
  ui.ach.innerHTML = ''
  var got = 0
  SXR_ACH.forEach(function (a) {
    var li = document.createElement('li'), t = s.ach[a.id]
    if (t) got++
    li.className = t ? 'on' : ''
    li.innerHTML = '<b></b><span></span><time></time>'
    li.children[0].textContent = a.name
    li.children[1].textContent = a.desc
    li.children[2].textContent = t ? new Date(t).toLocaleDateString() : 'Locked'
    ui.ach.appendChild(li)
  })
  ui.count.textContent = got + ' / ' + SXR_ACH.length
}
function SXR_show(on) {
  var ui = SXR_build()
  SXR.open = !!on
  if (on) { if (SXR.dirty) SXR_save(); SXR_fill(); ui.reset.textContent = 'Reset stats'; delete ui.reset.dataset.armed }
  ui.root.hidden = !on
  if (on) { var c = ui.root.querySelector('[data-sxr="close"]'); c && c.focus() }
}
// STATS buttons: the title's row and the pause menu
function SXR_buttons() {
  var menu = document.querySelector('#ui .menu')
  if (!menu) return
  var mk = function () {
    var b = document.createElement('button')
    b.className = 'btn sxr-open'
    b.textContent = 'Stats'
    b.addEventListener('click', function () { SXR_show(true) })
    return b
  }
  var acts = menu.querySelector('.m-title .m-actions')
  if (acts) {
    var b = acts.querySelector('.sxr-open') || mk()
    if (b !== acts.lastElementChild) acts.appendChild(b) // after the buttons other mods add
  }
  var pa = menu.querySelector('[data-s="paused"] .m-actions')
  if (pa && !pa.querySelector('.sxr-open')) {
    var mm = pa.querySelector('[data-act="sx-mainmenu"]')
    pa.insertBefore(mk(), mm || null)
  }
}

function SXR_tick(dt) {
  var G = SXR.G
  if (G.game && G.game.state === 'playing') {
    SXR.s.time += dt
    SXR.saveT += dt
    if (SXR.saveT >= SXR_TUNE.saveEvery) { SXR.saveT = 0; SXR.dirty = true }
  }
  if (SXR.dirty) SXR_save()
  // toasts, one at a time
  var ui = SXR.ui
  if (SXR.toastT > 0) {
    SXR.toastT -= dt
    if (SXR.toastT <= 0 && ui) ui.toast.classList.remove('on')
  } else if (SXR.toasts.length) {
    ui = SXR_build()
    var a = SXR.toasts.shift()
    ui.tb.textContent = a.name
    ui.ts.textContent = a.desc
    ui.toast.classList.remove('on'); void ui.toast.offsetWidth; ui.toast.classList.add('on')
    SXR.toastT = SXR_TUNE.toast
  }
}

;(function SXR_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || !G.events || !G.combat) { setTimeout(wait, 250); return }
    SXR.G = G
    window.__sxr = SXR // tests
    var shot = G.combat.playerShot
    G.combat.playerShot = function () {
      var r = shot.apply(this, arguments)
      SXR.s.shots++
      if (r && r.enemy) SXR.s.hits++
      return r
    }
    G.events.on('player:hitEnemy', function (ev) {
      var e = ev && ev.enemy
      if (!ev || !ev.killed || !e || typeof e !== 'object' || e.__sxrK) return
      e.__sxrK = true
      if (ev.weak || ev.part === 'weak') SXR.s.heads++
      if (SXR_online()) { SXR_bump(); return } // online the room's credit counts the kill (net:myKill)
      var P = G.player, d = 0
      try { if (!ev.explosive && e.pos && P) d = Math.hypot(e.pos.x - P.pos.x, e.pos.y - P.pos.y, e.pos.z - P.pos.z) } catch (er) { }
      SXR_kill({ weapon: SXR_weapon(ev.explosive), dist: d })
    })
    G.events.on('net:myKill', function (ev) { SXR_kill({ pvp: !!(ev && ev.pvp), weapon: SXR_weapon(false), dist: 0 }) })
    G.events.on('player:dead', function () { SXR.s.deaths++; SXR_bump() })
    G.events.on('extraction:reached', function () {
      var s = SXR.s, st = (G.combat && G.combat.stats) || {}
      s.missions++
      var map = typeof SX_MAP !== 'undefined' ? SX_MAP : 'port'
      s.missionMaps[map] = (s.missionMaps[map] | 0) + 1
      if (typeof SXQ !== 'undefined' && SXQ.opts && SXQ.opts.diff === 'hard') s.missionHard++
      if (st.shots >= 20) s.bestAcc = Math.max(s.bestAcc, st.hits / st.shots)
      SXR_bump()
    })
    G.events.on('survival:cleared', function (ev) { if (ev && ev.wave > SXR.s.waves) { SXR.s.waves = ev.wave; SXR_bump() } })
    G.events.on('game:state', function (ev) { if (ev && ev.state === 'title') SXR_buttons() })
    // Esc closes the sheet without also resuming the game under it
    addEventListener('keydown', function (e) {
      if (!SXR.open || (e.key !== 'Escape' && e.code !== 'KeyP')) return
      e.preventDefault(); e.stopPropagation()
      SXR_show(false)
    }, true)
    addEventListener('pagehide', function () { if (SXR.dirty) SXR_save() })
    SXR_buttons()
    setTimeout(SXR_buttons, 1500) // after the title buttons other mods add late
    SXR_check()
    var last = performance.now()
    var loop = function () {
      var now = performance.now(), dt = Math.min(0.1, (now - last) / 1000)
      last = now
      try { SXR_tick(dt) } catch (e) { if (!SXR._err) { SXR._err = 1; console.error('[stats] tick', e) } }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }
  setTimeout(wait, 300)
})()
