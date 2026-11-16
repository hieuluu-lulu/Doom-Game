// ============================================================================
// DoomZone mod — SCORE: PUBG-style kill counter and "YOU KILLED" popup, the
// count that drives the boss ladder (units/units.js), and the team score bar
// of an online room (net/net.js keeps the numbers, this file draws them).
//
// Solo: a robot counts as your kill when you hit it within the last 4 s
// (player:hitEnemy); the boss ladder counts every humanoid robot that falls.
// Online: the host credits each robot to whoever hit it last and sends the
// tallies (SXN.score), so every machine shows the same numbers.
// ============================================================================

var SXK_TUNE = { credit: 4000, popup: 2.4 }
var SXK = { G: null, kills: 0, troopers: 0, ui: null, popT: 0 }

function SXK_mp() { return typeof SXN !== 'undefined' && SXN.active }
// what the boss ladder reads: solo every trooper down, online the leading team's
function SXK_count() {
  if (SXK_mp() && typeof SXN_ffa === 'function' && SXN_ffa()) {
    // free-for-all: the player with the most humanoid robots down
    var m = 0
    for (var id in SXN.players) m = Math.max(m, SXN.players[id].tk | 0)
    return m
  }
  if (SXK_mp() && SXN.score) return Math.max(SXN.score.blue.tk | 0, SXN.score.red.tk | 0)
  return SXK.troopers
}
function SXK_isTrooper(e, type) { return (e && e.type === 'trooper') || /trooper/i.test(String(type || '')) }
function SXK_name(e, type) {
  var n = String((e && (e.label || e.type)) || type || 'robot')
  return n.charAt(0).toUpperCase() + n.slice(1)
}
function SXK_weapon() {
  var G = SXK.G
  try { if (G.units && G.units.pilot) return G.units.pilot.label || G.units.pilot.type } catch (e) { }
  try {
    var L = G.weapon.arsenal.loadout
    if (L.knifeHitT && performance.now() - L.knifeHitT < 900) return 'Knife' // the last hit was a slash
    return { rifle: 'Rifle', pistol: 'Pistol', shotgun: 'Shotgun', sniper: 'Sniper' }[L.cur] || ''
  } catch (e) { return '' }
}
// the local player scored: counter + popup (online the host's tally is set separately)
function SXK_popup(victim, opts) {
  var ui = SXK_buildUi()
  if (!ui) return
  opts = opts || {}
  var w = opts.weapon != null ? opts.weapon : SXK_weapon()
  ui.popV.textContent = String(victim || 'Robot').toUpperCase()
  ui.popW.textContent = (w ? 'WITH ' + w.toUpperCase() + ' · ' : '') + SXK.kills + (SXK.kills === 1 ? ' KILL' : ' KILLS')
  ui.pop.classList.toggle('pvp', !!opts.pvp)
  ui.pop.classList.remove('on'); void ui.pop.offsetWidth; ui.pop.classList.add('on')
  SXK.popT = SXK_TUNE.popup
}

function SXK_buildUi() {
  if (SXK.ui && SXK.ui.root.isConnected) return SXK.ui
  var app = document.getElementById('app') || document.body
  var root = document.createElement('div')
  root.className = 'sxk'
  root.innerHTML =
    '<div class="sxk-count"><b>0</b><span>KILLS</span></div>' +
    '<div class="sxk-team"><span class="sxk-b">BLUE <b>0</b></span><i></i><span class="sxk-r"><b>0</b> RED</span></div>' +
    '<div class="sxk-ffa"><span class="sxk-me">YOU <b>0</b></span><i></i><span class="sxk-lead"></span></div>' +
    '<div class="sxk-next"></div>' +
    '<div class="sxk-pop"><small>YOU KILLED</small><b></b><span></span></div>'
  app.appendChild(root)
  var q = function (s) { return root.querySelector(s) }
  SXK.ui = {
    root: root, count: q('.sxk-count b'), team: q('.sxk-team'), ffa: q('.sxk-ffa'), me: q('.sxk-me b'), lead: q('.sxk-lead'), fi: q('.sxk-ffa i'), tb: q('.sxk-b b'), tr: q('.sxk-r b'), ti: q('.sxk-team i'),
    next: q('.sxk-next'), pop: q('.sxk-pop'), popV: q('.sxk-pop b'), popW: q('.sxk-pop span'),
  }
  return SXK.ui
}
function SXK_set(el, key, v) { if (el[key] !== v) { el[key] = v; el.textContent = v } }

function SXK_tick(dt) {
  var G = SXK.G, ui = SXK_buildUi()
  if (!ui) return
  var st = G.game && G.game.state, on = st === 'playing' || st === 'paused'
  if (ui._on !== on) { ui._on = on; ui.root.classList.toggle('on', on) }
  if (!on) return
  SXK_set(ui.count, '_v', String(SXK.kills))
  // online with both teams in: the score bar
  var mp = SXK_mp() && SXN.score
  var vs = mp && typeof SXN_versus === 'function' && SXN_versus()
  var ffa = vs && typeof SXN_ffa === 'function' && SXN_ffa()
  if (ui._vs !== vs || ui._ffa !== ffa) {
    ui._vs = vs; ui._ffa = ffa
    ui.team.classList.toggle('on', !!vs && !ffa)
    ui.ffa.classList.toggle('on', !!ffa)
  }
  // round wins (net/net.js rounds): the round, the target, the lead it needs
  // (rooms only: SXN.score is null solo) the round, its clock, the target
  var left = vs && typeof SXN_roundLeft === 'function' ? SXN_roundLeft() : null
  var clock = left == null ? 'ROUND OVER' : Math.floor(left / 60) + ':' + ('0' + Math.floor(left % 60)).slice(-2)
  var goal = vs ? 'ROUND ' + (SXN.score.round | 0 || 1) + ' · ' + clock + ' · FIRST TO ' + SXN.winRounds + ' · BY ' + SXN_TUNE.rounds.by : ''
  if (ffa) {
    // you vs whoever leads in round wins; this round's clock and kills
    var me = SXN.players[SXN.myId], best = null, topK = 0
    for (var id in SXN.players) { var q = SXN.players[id]; topK = Math.max(topK, q.rk | 0); if (id !== SXN.myId && (!best || (q.rw | 0) > (best.rw | 0))) best = q }
    SXK_set(ui.me, '_v', String(me ? me.rw | 0 : 0))
    SXK_set(ui.lead, '_v', best ? best.name.toUpperCase() + ' ' + (best.rw | 0) : '')
    SXK_set(ui.fi, '_v', 'ROUND ' + (SXN.score.round | 0 || 1) + ' · ' + clock + ' · KILLS ' + (me ? me.rk | 0 : 0) + ' / TOP ' + topK + ' · FIRST TO ' + SXN.winRounds + ' BY ' + SXN_TUNE.rounds.by)
  } else if (vs) {
    SXK_set(ui.tb, '_v', String(SXN.score.blue.rw | 0))
    SXK_set(ui.tr, '_v', String(SXN.score.red.rw | 0))
    SXK_set(ui.ti, '_v', goal)
  }
  // the boss ladder: what comes next
  var lad = G.units && G.units.desert && G.units.ladder, txt = ''
  if (lad) {
    var c = SXK_count()
    for (var k = 0; k < lad.length; k++) if (!lad[k].done && c < lad[k].n) { txt = 'ROBOTS DOWN ' + c + ' / ' + lad[k].n + ' · ' + lad[k].label.toUpperCase() + ' NEXT'; break }
    if (!txt) txt = 'ROBOTS DOWN ' + c + ' · ALL BOSSES OUT'
  }
  SXK_set(ui.next, '_v', txt)
  if (ui._nx !== !!txt) { ui._nx = !!txt; ui.next.classList.toggle('on', !!txt) }
  if (SXK.popT > 0) { SXK.popT -= dt; if (SXK.popT <= 0) ui.pop.classList.remove('on') }
}

;(function SXK_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || !G.events) { setTimeout(wait, 250); return }
    SXK.G = G
    window.__sxk = SXK // tests
    G.events.on('player:hitEnemy', function (ev) {
      var e = ev && ev.enemy
      if (!e || typeof e !== 'object') return
      e.__sxkT = performance.now()
      if (ev.killed) e.__sxkMine = true
    })
    G.events.on('enemy:killed', function (ev) {
      var e = ev && ev.enemy
      if (e && e.__sxkCounted) return
      if (e) e.__sxkCounted = true
      if (SXK_mp()) { if (typeof SXN_robotDown === 'function') SXN_robotDown(e, ev.type); return }
      if (SXK_isTrooper(e, ev.type)) SXK.troopers++
      var mine = e && (e.__sxkMine || (e.__sxkT && performance.now() - e.__sxkT < SXK_TUNE.credit))
      if (!mine) return
      SXK.kills++
      SXK_popup(SXK_name(e, ev.type))
    })
    G.events.on('game:state', function (ev) {
      // a fresh run: the counters start over (online the host's tallies win)
      if (ev && ev.state === 'playing' && (ev.prev === 'intro' || ev.prev === 'title') && !SXK_mp()) { SXK.kills = 0; SXK.troopers = 0 }
    })
    var last = performance.now()
    var loop = function () {
      var now = performance.now(), dt = Math.min(0.1, (now - last) / 1000)
      last = now
      try { SXK_tick(dt) } catch (e) { if (!SXK._err) { SXK._err = 1; console.error('[score] tick', e) } }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }
  setTimeout(wait, 300)
})()
