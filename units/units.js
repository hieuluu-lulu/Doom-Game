// ============================================================================
// DoomZone mod — UNITS framework (SXU)
// Big units (enemy walkers / gunships) and pilotable ally vehicles (mech,
// helicopter). Unit types live in other features and register a factory in
// SXU_TYPES; this file owns everything they share:
//   * hit routing: player bullets (combat.playerShot → enemies.raycast) also
//     hit enemy units; grenades/rockets use SXU.blast
//   * piloting: E to board / leave, player follows the vehicle (so the stock
//     Gulls/Hounds shoot at it), damage to the player goes to the vehicle,
//     third-person chase camera, vehicle HUD
//   * boss bar, kill feed (enemy:killed), drops
//   * the desert director: allies parked outside the west gate; the enemy
//     bosses come one by one as humanoid robots fall (the boss ladder below)
//
// UNIT CONTRACT (what a factory returns; all fields required unless noted)
//   type        'warden' | 'kestrel' | 'colossus' | 'skua' | ...
//   label       display name, e.g. 'Colossus'
//   faction     'enemy' | 'ally'
//   alive       false once destroyed (wreck may stay in the world)
//   pos         THREE.Vector3, ground/feet position (aircraft: body centre)
//   hp, maxHp
//   radius      bounding-sphere radius around center() (quick ray reject)
//   center(out)                 -> out = bounding-sphere centre (world)
//   raycast(origin, dir, max)   -> { dist, point, normal, part } | null
//                                  part 'weak' = weak point (×2.2 from player bullets)
//   damage(amount, point, dir, part, source) -> true when this hit destroyed it
//                                  (call SXU.killed(this) once when it dies)
//   update(dt, U)               every frame while playing (AI, animation, wreck)
//   dispose()                   remove meshes/lights (reset / retry)
//   boss        (optional) true -> top-of-screen health bar when engaged
//   stun(sec)   (optional) EMP grenades call it on enemy units in range
//   armor       (optional) multiplier on damage that reaches a piloted vehicle
// VEHICLE extras (faction 'ally', vehicle: true)
//   vehicle: true, enterRadius (m), enterPoint(out) -> where the player boards
//   anchor(out)   -> point the player is moved to while piloting (enemies aim here)
//   canLeave()    (optional) false keeps the pilot in (e.g. a helicopter in the air)
//   push(dx, dz)  (optional) when the unit keeps its own position (collisions)
//   solid         (optional) { r, h, m, air } collision cylinder, else per-type defaults
//   exitPoint(out)-> free spot to drop the player when leaving
//   onEnter(U), onExit(U)
//   drive(dt, input, U)  movement + weapons while piloted (U.look has yaw/pitch)
//   camera(cam, dt, U)   place the camera (U.chaseCam helps)
//   hud()        -> { hp, maxHp, lines: ['CANNON  240', 'ROCKETS 6/6'] }
// ============================================================================

var SXU_TYPES = {}
var SXU_PLUGINS = [] // function (U, G): other features hook U.hooks.reset / U.hooks.update
var SXU = null

function SXU_init(G) {
  try {
    SXU = SXU_build(G)
    G.units = SXU
    console.log('[units] ready; types: ' + Object.keys(SXU_TYPES).join(', '))
  } catch (err) {
    console.error('[units] disabled: ' + (err && err.stack || err))
  }
}

function SXU_build(G) {
  var V3 = lt.Vector3
  var tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), UP = new V3(0, 1, 0)
  var desert = typeof SX_MAP !== 'undefined' && SX_MAP === 'desert'
  var U = {
    G: G, list: [], pilot: null, pilotT: 0, desert: desert,
    look: { yaw: 0, pitch: 0 },
    stats: { spawned: 0 },
    hooks: { reset: [], update: [] },
  }

  // ---------------------------------------------------------------- basics
  U.add = function (unit) {
    unit.id = ++U.stats.spawned
    U.list.push(unit)
    return unit
  }
  U.spawn = function (type, opts) {
    var f = SXU_TYPES[type]
    if (!f) { console.warn('[units] no factory for ' + type); return null }
    try { return U.add(f(G, U, opts || {})) } catch (e) { console.error('[units] spawn ' + type + ' failed', e); return null }
  }
  U.remove = function (unit) {
    var k = U.list.indexOf(unit)
    if (k >= 0) U.list.splice(k, 1)
    try { unit.dispose && unit.dispose() } catch (e) { }
  }
  U.enemies = function () { return U.list.filter(function (u) { return u.faction === 'enemy' && u.alive }) }
  // Small things the player side can shoot down (enemy missiles):
  // { pos: Vector3 (live), r, alive, hit() } — hit() is called once.
  U.targets = []
  U.addTarget = function (t) { t.alive = true; U.targets.push(t); return t }
  U.removeTarget = function (t) { var k = U.targets.indexOf(t); if (k >= 0) U.targets.splice(k, 1); t.alive = false }
  function targetProxy(t) {
    if (t._proxy) return t._proxy
    var px = {
      type: 'missile', label: 'Missile', faction: 'enemy', pos: t.pos,
      get alive() { return t.alive },
      damage: function () { if (!t.alive) return false; U.removeTarget(t); try { t.hit() } catch (e) { } return true },
    }
    t._proxy = px
    return px
  }
  U.raycastTargets = function (o, d, max) {
    var best = null
    for (var k = 0; k < U.targets.length; k++) {
      var t = U.targets[k]
      if (!t.alive) continue
      var ox = o.x - t.pos.x, oy = o.y - t.pos.y, oz = o.z - t.pos.z, r = t.r || 0.8
      var b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, h = b * b - c
      if (h < 0) continue
      var tt = -b - Math.sqrt(h)
      if (tt < 0 || tt > (best ? best.dist : max)) continue
      best = { dist: tt, point: o.clone().addScaledVector(d, tt), normal: d.clone().negate(), enemy: targetProxy(t), part: 'body' }
    }
    return best
  }
  U.groundAt = function (x, z, maxY) { return G.physics.groundHeight(x, z, maxY == null ? 999 : maxY) }
  U.sound = function (name, o) { try { G.audio && G.audio.play && G.audio.play(name, o || {}) } catch (e) { } }
  U.radio = function (text, secs) { try { G.hud && G.hud.radio && G.hud.radio(text, secs || 4.5) } catch (e) { } }
  U.hud = function () { return G.hud && !G.hud.stub ? G.hud : null }

  // Nearest unit of `faction` hit by the ray.
  U.raycast = function (o, d, max, faction) {
    var best = null
    for (var k = 0; k < U.list.length; k++) {
      var u = U.list[k]
      if (!u.alive || (faction && u.faction !== faction)) continue
      var c = u.center(tmp), r = u.radius || 3
      var ox = c.x - o.x, oy = c.y - o.y, oz = c.z - o.z
      var t = ox * d.x + oy * d.y + oz * d.z
      if (t < -r || t > max + r) continue
      if (ox * ox + oy * oy + oz * oz - t * t > r * r) continue
      var h = u.raycast(o, d, best ? best.dist : max)
      if (h && h.dist <= (best ? best.dist : max)) best = { dist: h.dist, point: h.point, normal: h.normal || d.clone().negate(), part: h.part || 'body', unit: u }
    }
    return best
  }

  // A ray against everything one side can hit.
  //   against 'enemy': world + robots + enemy units (player / ally shots)
  //   against 'ally' : world + the player or piloted vehicle + ally units
  U.cast = function (o, d, max, against) {
    var w = G.physics.raycast(o, d, max), dist = w ? w.dist : max
    var out = w ? { dist: w.dist, point: w.point, normal: w.normal, surface: w.surface, kind: 'world' } : null
    if (against === 'enemy') {
      var e = null
      try { e = G.enemies.raycast(o, d, dist) } catch (er) { }
      if (e && e.dist <= dist) out = { dist: e.dist, point: e.point, normal: e.normal, surface: 'enemy', kind: e.enemy && e.enemy.faction ? 'unit' : 'enemy', enemy: e.enemy, part: e.part }
    } else {
      var a = U.raycast(o, d, dist, 'ally')
      if (a) { out = { dist: a.dist, point: a.point, normal: a.normal, surface: 'metal', kind: 'unit', unit: a.unit, part: a.part }; dist = a.dist }
      if (!U.pilot) {
        var P = G.player
        if (P && P.alive) {
          // the player as a capsule (same test as combat.enemyShot)
          tmp.copy(P.pos); tmp.y += 1
          var t = tmp.sub(o).dot(d)
          if (t > 0 && t < dist) {
            tmp2.copy(o).addScaledVector(d, t)
            if (Math.hypot(tmp2.x - P.pos.x, tmp2.z - P.pos.z) < 0.42 && Math.abs(tmp2.y - (P.pos.y + 0.95)) < 0.95) out = { dist: t, point: tmp2.clone(), normal: d.clone().negate(), surface: 'player', kind: 'player' }
          }
        }
      }
    }
    return out
  }

  // Hitscan fired by the player side (piloted vehicles). Same bookkeeping as
  // the player's guns: hitmarkers, impacts, accuracy stats.
  U.shoot = function (o, d, opts) {
    opts = opts || {}
    var hit = null
    try { hit = G.combat.playerShot(o, d, { damage: opts.damage || 30, range: opts.range || 300 }) } catch (e) { }
    if (opts.tracerFrom && G.fx && G.fx.tracer) G.fx.tracer(opts.tracerFrom, hit && hit.point ? hit.point : tmp.copy(o).addScaledVector(d, opts.range || 300))
    return hit
  }

  // Hitscan fired by enemy units at the player side.
  U.enemyShot = function (o, d, opts) {
    opts = opts || {}
    var range = opts.range || 200, dmg = opts.damage || 6
    var h = U.cast(o, d, range, 'ally')
    if (U.pilot && U.pilot.alive) {
      var ph = U.pilot.raycast(o, d, h ? h.dist : range)
      if (ph) {
        U.pilot.damage(dmg * (U.pilot.armor || 1), ph.point, d, ph.part, 'enemy')
        G.events.emit('impact', { point: ph.point, normal: ph.normal || d.clone().negate(), dist: ph.dist, surface: 'metal', enemy: null, dir: d, from: 'enemy' })
        return { kind: 'vehicle', point: ph.point }
      }
    }
    if (h && h.kind === 'player') { G.player.damage(dmg, o.clone ? o.clone() : o); return h }
    if (h && h.kind === 'unit') { h.unit.damage(dmg, h.point, d, h.part, 'enemy'); return h }
    if (h) G.events.emit('impact', { point: h.point, normal: h.normal, dist: h.dist, surface: h.surface, enemy: null, dir: d, from: 'enemy' })
    return h
  }

  // Explosion damage. side 'ally' hurts robots + enemy units (+ the player
  // when not piloting, at selfScale); side 'enemy' hurts the player/vehicle
  // and ally units. opts: { size (fx.explosion size), fx:false, selfScale,
  // unitsOnly (skip robots + player: the arsenal grenades do those), ignore }.
  U.blast = function (pos, radius, damage, side, opts) {
    opts = opts || {}
    var hits = 0
    var los = function (target) { return G.physics.lineOfSight(tmp3.copy(pos).setY(pos.y + 0.3), target) }
    if (side !== 'enemy' && !opts.unitsOnly) {
      var en = G.enemies && G.enemies.list || []
      for (var k = 0; k < en.length; k++) {
        var e = en[k]
        if (!e.alive) continue
        var c = tmp.copy(e.pos); c.y += e.type === 'hound' ? 0.6 : 0
        var dd = c.distanceTo(pos)
        if (dd > radius || !los(c)) continue
        var killed = e.damage(damage * (0.3 + 0.7 * (1 - dd / radius)), c.clone(), c.clone().sub(pos).normalize(), 'body') === true
        hits++
        G.events.emit('player:hitEnemy', { enemy: e, part: 'body', killed: killed, weak: false, explosive: true })
      }
    }
    for (var j = 0; j < U.list.length; j++) {
      var u = U.list[j]
      if (!u.alive || u === opts.ignore) continue
      if (side !== 'enemy' && u.faction !== 'enemy') continue
      if (side === 'enemy' && u.faction !== 'ally') continue
      var uc = u.center(tmp), du = Math.max(0, uc.distanceTo(pos) - (u.radius || 3) * 0.6)
      if (du > radius) continue
      var k2 = u.damage(damage * (0.3 + 0.7 * (1 - du / radius)) * (u === U.pilot ? u.armor || 1 : 1), pos.clone(), uc.clone().sub(pos).normalize(), 'body', side) === true
      hits++
      if (side !== 'enemy') G.events.emit('player:hitEnemy', { enemy: u, part: 'body', killed: k2, weak: false, explosive: true })
    }
    if (side !== 'enemy') {
      for (var t2 = U.targets.length - 1; t2 >= 0; t2--) {
        var tg = U.targets[t2]
        if (tg.alive && tg.pos.distanceTo(pos) < radius + (tg.r || 0.8)) { U.removeTarget(tg); try { tg.hit() } catch (e) { } }
      }
    }
    var P = G.player
    var selfScale = side === 'enemy' ? 1 : opts.selfScale == null ? 0.5 : opts.selfScale
    if (P && P.alive && !U.pilot && selfScale > 0 && !opts.unitsOnly) {
      var pc = tmp.copy(P.pos).setY(P.pos.y + 1), pd = pc.distanceTo(pos)
      if (pd < radius && los(pc)) P.damage(damage * selfScale * (1 - pd / radius), pos.clone())
    }
    if (opts.fx !== false && opts.size && G.fx && G.fx.explosion) {
      try { G.fx.explosion(pos, opts.size) } catch (e) { }
    }
    return hits
  }

  U.killed = function (unit) {
    if (unit._sxuKilled) return
    unit._sxuKilled = true
    if (unit.faction === 'enemy') G.events.emit('enemy:killed', { enemy: unit, pos: unit.pos, type: unit.label || unit.type, big: !!(unit.boss || unit.big) })
    else G.events.emit('ally:destroyed', { unit: unit })
  }

  // Where the player (or the piloted vehicle) is, for enemy unit AI. In an
  // online room (net/net.js) the unit being updated (U.cur) goes for the
  // nearest player of either team: only that player's own machine applies the
  // damage, everywhere else the shots are just visual.
  U.target = function (out) {
    var P = G.player, have = false
    out = out || new V3()
    if (P && P.alive) {
      have = true
      if (U.pilot && U.pilot.alive) U.pilot.center(out)
      else out.copy(P.pos).setY(P.pos.y + 1.1)
    }
    var c = U.cur
    if (c && c.pos && typeof SXN_otherTargets === 'function') {
      var others = SXN_otherTargets()
      if (others.length) {
        var best = have ? out.distanceToSquared(c.pos) : Infinity
        for (var k = 0; k < others.length; k++) {
          var d = others[k].distanceToSquared(c.pos)
          if (d < best) { best = d; out.copy(others[k]); have = true }
        }
      }
    }
    return have ? out : null
  }

  // Point under the crosshair (world, robots, enemy units).
  U.aimPoint = function (out, max) {
    var cam = G.camera
    var d = tmp2.set(0, 0, -1).applyQuaternion(cam.quaternion)
    max = max || 600
    var h = U.cast(cam.position, d, max, 'enemy')
    return (out || new V3()).copy(cam.position).addScaledVector(d, h ? h.dist : max)
  }

  // Smooth third-person camera: orbit `focus` at (yaw, pitch), pull in on walls.
  var camState = { pos: new V3(), init: false }
  U.chaseCam = function (cam, focus, yaw, pitch, dist, dt, fov) {
    var dir = tmp.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
    var want = tmp2.copy(focus).addScaledVector(dir, -dist)
    var back = tmp3.copy(want).sub(focus), bl = back.length()
    if (bl > 1e-4) {
      back.divideScalar(bl)
      var hit = G.physics.raycast(focus, back, bl)
      if (hit) want.copy(focus).addScaledVector(back, Math.max(1.2, hit.dist - 0.4))
    }
    var minY = U.groundAt(want.x, want.z, want.y + 2) + 0.5
    if (want.y < minY) want.y = minY
    if (!camState.init) { camState.pos.copy(want); camState.init = true }
    camState.pos.lerp(want, 1 - Math.exp(-14 * dt))
    cam.position.copy(camState.pos)
    cam.quaternion.setFromEuler(new lt.Euler(pitch, yaw, 0, 'YXZ'))
    if (fov && Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix() }
  }

  // ---------------------------------------------------- hook the stock game
  var origRay = G.enemies.raycast
  G.enemies.raycast = function (o, d, max) {
    if (max == null) max = 300
    var a = origRay(o, d, max)
    var b = U.raycast(o, d, a ? a.dist : max, 'enemy')
    if (b) a = { dist: b.dist, point: b.point, normal: b.normal, enemy: b.unit, part: b.part }
    var m = U.targets.length ? U.raycastTargets(o, d, a ? a.dist : max) : null
    return m || a
  }
  var origDamage = G.player.damage
  G.player.damage = function (amount, from) {
    if (U.pilot && U.pilot.alive) {
      if (!(amount > 0)) return
      U.pilot.damage(amount * (U.pilot.armor || 1), from || null, null, 'body', 'enemy')
      G.events.emit('player:hit', { amount: 0, fromPos: from || null, vehicle: true })
      return
    }
    return origDamage.apply(this, arguments)
  }
  var origEnemyShot = G.combat.enemyShot
  G.combat.enemyShot = function (o, d, opts) {
    if (U.pilot && U.pilot.alive) {
      var range = opts && opts.range || 200
      var w = G.physics.raycast(o, d, range)
      var ph = U.pilot.raycast(o, d, w ? w.dist : range)
      if (ph) {
        U.pilot.damage((opts && opts.damage || 6) * (U.pilot.armor || 1), ph.point, d, ph.part, 'enemy')
        G.events.emit('impact', { point: ph.point, normal: ph.normal || d.clone().negate(), dist: ph.dist, surface: 'metal', enemy: null, dir: d, from: 'enemy' })
        return true
      }
    }
    return origEnemyShot.apply(this, arguments)
  }
  // retries / new runs reset the units too
  var origReset = G.weapon.reset
  G.weapon.reset = function () { var r = origReset.apply(this, arguments); U.reset(); return r }
  G.events.on('game:state', function (ev) { if (ev && ev.state === 'title') U.clear() })

  // ------------------------------------------------------------- piloting
  function enter(v) {
    var P = G.player
    U.pilot = v
    U.pilotT = 0
    U._camSaved = false
    camState.init = false
    U.look.yaw = v.yaw != null ? v.yaw : P.yaw
    U.look.pitch = -0.12
    P.enabled = false
    try { G.weapon.setVisible(false) } catch (e) { }
    document.documentElement.classList.add('sx-piloting')
    try { v.onEnter && v.onEnter(U) } catch (e) { console.error('[units] onEnter', e) }
    var h = U.hud()
    h && h.message((G.input.touch ? 'USE' : 'F') + ' — leave the ' + v.label, 2.5)
    U.sound('reload_bolt', { gain: 0.9, pitch: 0.7 })
  }
  function leave(destroyed) {
    var v = U.pilot, P = G.player
    if (!v) return
    U.pilot = null
    var at = tmp.copy(P.pos)
    try { v.exitPoint ? v.exitPoint(at) : at.copy(v.pos).add(tmp2.set(2.5, 0, 0)) } catch (e) { }
    at.y = U.groundAt(at.x, at.z, at.y + 1.5)
    P.pos.copy(at)
    P.vel.set(0, 0, 0)
    P.yaw = U.look.yaw
    P.pitch = 0
    P.enabled = true
    try { G.weapon.setVisible(true) } catch (e) { }
    document.documentElement.classList.remove('sx-piloting')
    try { v.onExit && v.onExit(U) } catch (e) { console.error('[units] onExit', e) }
    var cam = G.camera
    if (Math.abs(cam.fov - P.baseFov) > 0.01) { cam.fov = P.baseFov; cam.updateProjectionMatrix() }
    if (destroyed) {
      origDamage.call(P, 35, v.pos.clone())
      var h = U.hud()
      h && h.warn(v.label + ' destroyed', 2.5)
    }
  }
  U.enter = enter
  U.leave = leave

  // ------------------------------------------------------------------ HUD
  var ui = null
  function buildUi() {
    var h = U.hud()
    if (!h || !h.root || ui) return
    var root = h.root
    var mk = function (cls, html) { var e = document.createElement('div'); e.className = cls; e.innerHTML = html || ''; root.appendChild(e); return e }
    ui = {
      prompt: mk('sx-vprompt', '<span class="h-key">F</span><span class="sx-vp-t"></span>'),
      vhud: mk('sx-vhud', '<div class="sx-vh-name"></div><div class="sx-vh-bar"><i></i></div><div class="sx-vh-hp"></div><div class="sx-vh-lines"></div>'),
      boss: mk('sx-boss', '<div class="sx-boss-name"></div><div class="sx-boss-bar"><i></i></div>'),
      marks: mk('sx-vmarks', ''),
      last: {},
    }
    ui.promptT = ui.prompt.querySelector('.sx-vp-t')
    ui.promptKey = ui.prompt.querySelector('.h-key')
    ui.vName = ui.vhud.querySelector('.sx-vh-name')
    ui.vBar = ui.vhud.querySelector('.sx-vh-bar i')
    ui.vHp = ui.vhud.querySelector('.sx-vh-hp')
    ui.vLines = ui.vhud.querySelector('.sx-vh-lines')
    ui.bName = ui.boss.querySelector('.sx-boss-name')
    ui.bBar = ui.boss.querySelector('.sx-boss-bar i')
  }
  function setText(el, key, text) { if (ui.last[key] !== text) { ui.last[key] = text; el.textContent = text } }
  function toggle(el, key, on) { if (ui.last[key] !== on) { ui.last[key] = on; el.classList.toggle('on', on) } }

  var bossFocus = null, bossT = 0
  G.events.on('player:hitEnemy', function (ev) { if (ev && ev.enemy && ev.enemy.boss) { bossFocus = ev.enemy; bossT = 12 } })
  var markEls = new Map()
  var proj = new V3()
  function updateHud(dt, nearVehicle) {
    if (!ui) buildUi()
    if (!ui) return
    var touch = G.input && G.input.touch
    // board prompt
    var showPrompt = !!nearVehicle && !U.pilot
    toggle(ui.prompt, 'p', showPrompt)
    if (showPrompt) { setText(ui.promptKey, 'pk', touch ? 'USE' : 'F'); setText(ui.promptT, 'pt', 'Board ' + nearVehicle.label) }
    // vehicle HUD
    toggle(ui.vhud, 'v', !!U.pilot)
    if (U.pilot) {
      var info = {}
      try { info = U.pilot.hud ? U.pilot.hud() : {} } catch (e) { }
      var hp = Math.max(0, info.hp != null ? info.hp : U.pilot.hp), mx = info.maxHp || U.pilot.maxHp || 1
      setText(ui.vName, 'vn', U.pilot.label)
      var pct = Math.round(hp / mx * 100)
      if (ui.last.vb !== pct) { ui.last.vb = pct; ui.vBar.style.width = pct + '%'; ui.vhud.classList.toggle('crit', pct <= 25) }
      setText(ui.vHp, 'vh', 'HULL ' + Math.ceil(hp) + ' / ' + mx)
      setText(ui.vLines, 'vl', (info.lines || []).join('\n'))
    }
    // boss bar: the last boss you hit, else the nearest one within 140 m
    bossT -= dt
    var boss = bossFocus && bossFocus.alive && bossT > 0 ? bossFocus : null
    if (!boss) {
      var best = 140 * 140, P = G.player
      for (var k = 0; k < U.list.length; k++) {
        var u = U.list[k]
        if (!u.alive || !u.boss || u.faction !== 'enemy' || !P) continue
        var d2 = u.pos.distanceToSquared(P.pos)
        if (d2 < best) { best = d2; boss = u }
      }
    }
    toggle(ui.boss, 'b', !!boss)
    if (boss) {
      setText(ui.bName, 'bn', boss.label)
      var bp = Math.round(Math.max(0, boss.hp) / boss.maxHp * 1000) / 10
      if (ui.last.bb !== bp) { ui.last.bb = bp; ui.bBar.style.width = bp + '%' }
    }
    // world markers for parked ally vehicles
    var cam = G.camera
    var W = innerWidth, H = innerHeight
    for (var j = 0; j < U.list.length; j++) {
      var v = U.list[j]
      if (!v.vehicle) continue
      var el = markEls.get(v)
      if (!el) { el = document.createElement('div'); el.className = 'sx-vmark'; el.innerHTML = '<i></i><b></b><span></span>'; ui.marks.appendChild(el); markEls.set(v, el); el._b = el.querySelector('b'); el._s = el.querySelector('span'); el._b.textContent = v.label }
      var P2 = G.player
      var dist = P2 ? v.pos.distanceTo(P2.pos) : 0
      var show = v.alive && !U.pilot && dist > 4 && dist < 160
      if (show) {
        v.center(proj); proj.y += (v.radius || 3) * 0.7
        proj.project(cam)
        show = proj.z < 1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05
        if (show) {
          el.style.transform = 'translate3d(' + Math.round((proj.x * 0.5 + 0.5) * W) + 'px,' + Math.round((-proj.y * 0.5 + 0.5) * H) + 'px,0)'
          var dm = Math.round(dist) + 'm'
          if (el._dm !== dm) { el._dm = dm; el._s.textContent = dm }
        }
      }
      if (el._on !== show) { el._on = show; el.classList.toggle('on', show) }
    }
    markEls.forEach(function (el, v) { if (U.list.indexOf(v) < 0) { el.remove(); markEls.delete(v) } })
  }

  // ------------------------------------------------------------- director
  var D = { spawned: {} }
  function spotOutside(x, z, r) {
    // a sand spot near (x, z) clear of boxes, for parking / spawning
    for (var k = 0; k < 40; k++) {
      var a = k * 2.39996, rr = k === 0 ? 0 : 1.5 + k * 0.6
      var px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, clear = true
      var boxes = G.physics.boxes || []
      for (var b = 0; b < boxes.length && clear; b++) {
        var bx = boxes[b]
        if (bx.bulletOnly) continue
        if (px + r > bx.min.x && px - r < bx.max.x && pz + r > bx.min.z && pz - r < bx.max.z) clear = false
      }
      if (clear) return new V3(px, U.groundAt(px, pz, 999), pz)
    }
    return new V3(x, U.groundAt(x, z, 999), z)
  }
  U.spotOutside = spotOutside
  function directorReset() {
    D.spawned = {}
    if (U.ladder) U.ladder.forEach(function (r) { r.done = false })
    if (!U.desert) return
    var lv = G.level || {}
    var vs = lv.vehicleSpots || {}
    var mechAt = vs.warden ? vs.warden.clone() : spotOutside(-47, -3, 3)
    var heliAt = vs.kestrel ? vs.kestrel.clone() : spotOutside(-50, 15, 6)
    var carAt = vs.sandcat ? vs.sandcat.clone() : spotOutside(-44, 5, 3)
    if (SXU_TYPES.warden) U.spawn('warden', { pos: mechAt, yaw: -Math.PI / 2 })
    if (SXU_TYPES.kestrel) U.spawn('kestrel', { pos: heliAt, yaw: -Math.PI / 2 })
    if (SXU_TYPES.sandcat) U.spawn('sandcat', { pos: carAt, yaw: -Math.PI / 2 })
  }
  // Boss ladder (desert): nothing big at the start; each rung arrives once
  // enough humanoid robots (troopers) are down — solo: all of them, online:
  // the leading team's own kills (SXK_count in score/score.js). In a room
  // only the host spawns; guests get twins from its snapshots.
  var LADDER = [
    { n: 5, id: 'c1', label: 'Heavy walker', go: function () {
      if (SXU_TYPES.colossus) U.spawn('colossus', { pos: spotOutside(78, 6, 4), yaw: -Math.PI / 2 })
      U.radio('Control: heavy walker coming over the east dunes. The Warden is parked outside the west gate.', 6)
    } },
    { n: 10, id: 'p1', label: 'Enemy jet', go: function () {
      if (SXU_TYPES.petrel) U.spawn('petrel', { pos: new V3(260, 170, 430), yaw: 0 })
      U.radio('Control: fast mover inbound from the north-east — a Petrel interceptor. Get a fighter up.', 6)
    } },
    { n: 15, id: 's1', label: 'Gunship', go: function () {
      if (SXU_TYPES.skua) U.spawn('skua', { pos: new V3(40, 45, -120), yaw: Math.PI })
      U.radio('Control: gunship inbound from the north. The Kestrel can take it.', 6)
    } },
    { n: 20, id: 'c2', label: 'Walker + jet', go: function () {
      if (SXU_TYPES.colossus) U.spawn('colossus', { pos: spotOutside(-12, -70, 4), yaw: 0 })
      if (SXU_TYPES.petrel) U.spawn('petrel', { pos: new V3(-300, 170, -320), yaw: Math.PI })
      U.radio('Control: they are throwing everything at you — a second walker from the south and another Petrel.', 6)
    } },
  ]
  U.ladder = LADDER.map(function (t) { return { n: t.n, label: t.label } })
  // outpost guards (Ridge Post's walker, Radar Station's gunship) wait for
  // the same rung as the wave of their kind
  var RUNG = { colossus: 5, petrel: 10, skua: 15 }, RUNG_ID = { colossus: 'c1', petrel: 'p1', skua: 's1' }
  U.ladderOk = function (type) { return (typeof SXK_count === 'function' ? SXK_count() : 0) >= (RUNG[type] || 0) || !!D.spawned[RUNG_ID[type]] }
  function rungGo(t) {
    D.spawned[t.id] = true
    U.ladder.forEach(function (r) { if (r.n === t.n) r.done = true })
    try { t.go() } catch (e) { console.error('[units] ladder', e) }
  }
  // cutting a relay also calls in the next boss that hasn't come yet (the
  // kill count can still bring the later ones sooner)
  G.events.on('objective:done', function () {
    if (!U.desert) return
    if (typeof SXN !== 'undefined' && SXN.active && SXN.role === 'guest') return
    for (var k = 0; k < LADDER.length; k++) if (!D.spawned[LADDER[k].id]) { rungGo(LADDER[k]); return }
  })
  function ladderTick() {
    if (!U.desert || !G.game || G.game.state !== 'playing') return
    if (typeof SXN !== 'undefined' && SXN.active && SXN.role === 'guest') return
    var c = typeof SXK_count === 'function' ? SXK_count() : 0
    for (var k = 0; k < LADDER.length; k++) {
      var t = LADDER[k]
      if (!D.spawned[t.id] && c >= t.n) rungGo(t)
    }
  }

  U.clear = function () {
    if (U.pilot) leave(false)
    U.list.slice().forEach(U.remove)
    U.list.length = 0
    U.targets.length = 0
    bossFocus = null
  }
  U.reset = function () {
    U.clear()
    directorReset()
    U.hooks.reset.forEach(function (f) { try { f() } catch (e) { console.error('[units] reset hook', e) } })
  }

  // ------------------------------------------------------------ collisions
  // Every unit is a vertical cylinder (aircraft: centred on center()). Pairs
  // push apart by mass, fast closing speed hurts both; on foot the player is
  // pushed out (and hurt by a fast hit); a moving ally vehicle rams Gulls and
  // Hounds (the cars run Hounds over themselves).
  var SOLID = {
    warden: { r: 1.9, h: 5, m: 20 }, colossus: { r: 4.4, h: 9, m: 400 }, kestrel: { r: 3.4, h: 3.2, m: 6, air: true },
    skua: { r: 3.6, h: 3, m: 9, air: true }, sandcat: { r: 2.0, h: 2, m: 6 }, rhino: { r: 3.0, h: 3, m: 25 },
    sentinel: { r: 1.0, h: 1.4, m: 3 }, turret: { r: 1.25, h: 2, m: Infinity },
  }
  U.solidOf = function (u) { return u.solid || SOLID[u.type] || { r: Math.min(2, (u.radius || 2) * 0.5), h: 2, m: 5 } }
  var VA = {}, VB = {}, pairT = new Map(), now = 0
  function vol(u, out) {
    var sd = U.solidOf(u)
    if (sd.air) { var c = u.center(tmp3); out.x = c.x; out.z = c.z; out.y0 = c.y - sd.h / 2; out.y1 = c.y + sd.h / 2 }
    else { out.x = u.pos.x; out.z = u.pos.z; out.y0 = u.pos.y; out.y1 = u.pos.y + sd.h }
    out.r = sd.r; out.m = sd.m
    return out
  }
  function shove(u, dx, dz) {
    if (u.push) u.push(dx, dz)
    else { u.pos.x += dx; u.pos.z += dz }
  }
  function stopInto(u, nx, nz) {
    if (!u.vel) return
    var vn = u.vel.x * nx + u.vel.z * nz
    if (vn < 0) { u.vel.x -= nx * vn; u.vel.z -= nz * vn }
  }
  function bump(at, amount) {
    U.sound('container_bang', { pos: at, gain: Math.min(1, 0.35 + amount * 0.01), pitch: 0.7 })
    if (G.fx && G.fx.sparks) G.fx.sparks(at, UP, 10)
  }
  function collide(dt) {
    now += dt
    var L = []
    for (var k = 0; k < U.list.length; k++) if (U.list[k].alive) L.push(U.list[k])
    for (var a = 0; a < L.length; a++) {
      var u = L[a]
      vol(u, VA)
      if (!u._sxp) { u._sxp = new V3(VA.x, VA.y0, VA.z); u._sxv = new V3() }
      u._sxv.set((VA.x - u._sxp.x) / dt, (VA.y0 - u._sxp.y) / dt, (VA.z - u._sxp.z) / dt)
      u._sxp.set(VA.x, VA.y0, VA.z)
    }
    // unit vs unit
    for (var i = 0; i < L.length; i++)
      for (var j = i + 1; j < L.length; j++) {
        var A = L[i], B = L[j]
        vol(A, VA); vol(B, VB)
        if (VA.y1 < VB.y0 || VB.y1 < VA.y0) continue
        var dx = VA.x - VB.x, dz = VA.z - VB.z, d = Math.hypot(dx, dz), rr = VA.r + VB.r
        if (d >= rr) continue
        if (VA.m === Infinity && VB.m === Infinity) continue
        if (d < 1e-4) { dx = 1; dz = 0; d = 1 }
        var nx = dx / d, nz = dz / d, pen = rr - d
        var wa = VA.m === Infinity ? 0 : VB.m === Infinity ? 1 : VB.m / (VA.m + VB.m), wb = 1 - wa
        shove(A, nx * pen * wa, nz * pen * wa)
        shove(B, -nx * pen * wb, -nz * pen * wb)
        stopInto(A, nx, nz); stopInto(B, -nx, -nz)
        var closing = -((A._sxv.x - B._sxv.x) * nx + (A._sxv.z - B._sxv.z) * nz)
        var key = A.id + ':' + B.id
        if (closing > 6.5 && (pairT.get(key) || 0) < now) {
          pairT.set(key, now + 0.7)
          var hit = (closing - 6.5) * 18
          var at = tmp.set(VB.x + nx * VB.r, Math.max(VA.y0, VB.y0) + 1, VB.z + nz * VB.r).clone()
          var ka = VA.m === Infinity ? 0 : VB.m === Infinity ? 1 : VB.m / (VA.m + VB.m)
          A.damage(hit * ka, at, tmp2.set(nx, 0, nz).clone(), 'body', 'collision')
          B.damage(hit * (1 - ka), at, tmp2.set(-nx, 0, -nz).clone(), 'body', 'collision')
          bump(at, hit)
        }
      }
    var P = G.player
    if (P && P.alive && !U.pilot) {
      // the player on foot cannot walk through units
      for (var q = 0; q < L.length; q++) {
        var w = L[q]
        vol(w, VA)
        if (P.pos.y + 1.8 < VA.y0 || P.pos.y > VA.y1) continue
        var px = P.pos.x - VA.x, pz = P.pos.z - VA.z, pd = Math.hypot(px, pz), pr = VA.r + 0.35
        if (pd >= pr) continue
        if (pd < 1e-4) { px = 1; pz = 0; pd = 1 }
        P.pos.x += (px / pd) * (pr - pd); P.pos.z += (pz / pd) * (pr - pd)
        var cl = (w._sxv.x * px + w._sxv.z * pz) / pd
        if (cl > 5 && (w._sxPlayerT || 0) < now) {
          w._sxPlayerT = now + 0.8
          P.damage((cl - 5) * 7, tmp.set(VA.x, P.pos.y + 1, VA.z).clone())
          if (P.addShake) P.addShake(0.4)
        }
      }
    }
    // moving ally vehicles ram robots
    var en = G.enemies && G.enemies.list || []
    for (var r2 = 0; r2 < L.length; r2++) {
      var v = L[r2]
      if (v.faction !== 'ally' || !v.vehicle) continue
      var sp = Math.hypot(v._sxv.x, v._sxv.y, v._sxv.z)
      if (sp < 4) continue
      vol(v, VA)
      var cars = v.type === 'sandcat' || v.type === 'rhino'
      for (var e2 = 0; e2 < en.length; e2++) {
        var e = en[e2]
        if (!e.alive || (cars && e.type === 'hound')) continue
        var ey = e.pos.y + (e.type === 'hound' ? 0.6 : 0), er = e.type === 'hound' ? 0.9 : 0.75
        if (ey + er < VA.y0 || ey - er > VA.y1) continue
        if (Math.hypot(e.pos.x - VA.x, e.pos.z - VA.z) > VA.r + er) continue
        if ((e._sxRamT || 0) > now) continue
        e._sxRamT = now + 0.5
        var dir = tmp2.set(e.pos.x - VA.x, 0, e.pos.z - VA.z).normalize().clone()
        var killed = e.damage(e.type === 'gull' && SOLID[v.type] && SOLID[v.type].air ? 999 : sp * 8, e.pos.clone(), dir, 'body') === true
        if (v === U.pilot) G.events.emit('player:hitEnemy', { enemy: e, part: 'body', killed: killed, weak: false })
        v.damage(e.type === 'gull' ? 25 : 10, e.pos.clone(), dir.clone().negate(), 'body', 'collision')
        bump(e.pos.clone(), 20)
      }
    }
  }

  // --------------------------------------------------------------- update
  U.update = function (dt) {
    if (!(dt > 0)) return
    var P = G.player, inp = G.input
    for (var k = 0; k < U.list.length; k++) {
      var u = U.list[k]
      U.cur = u
      try { u.update(dt, U) } catch (e) { if (!u._errLogged) { u._errLogged = true; console.error('[units] ' + u.type + '.update threw', e) } }
    }
    U.cur = null
    try { collide(dt) } catch (e) { if (!U._colErr) { U._colErr = true; console.error('[units] collide threw', e) } }
    var near = null
    if (U.pilot) {
      var v = U.pilot
      U.pilotT += dt
      if (!v.alive || !P.alive) leave(!v.alive)
      else if (inp.pressed && inp.pressed('interact') && U.pilotT > 0.35 && (!v.canLeave || v.canLeave())) leave(false)
      else {
        var lk = P.lookScale || 1
        if (U._camSaved) { G.camera.position.copy(U._camPos); G.camera.quaternion.copy(U._camQuat); G.camera.updateMatrixWorld() }
        U.look.yaw -= inp.look.dx * lk
        U.look.pitch = Math.max(-1.2, Math.min(1.1, U.look.pitch - inp.look.dy * lk))
        try { v.drive(dt, inp, U) } catch (e) { if (!v._dErr) { v._dErr = true; console.error('[units] drive threw', e) } }
        v.anchor(P.pos)
        P.vel.set(0, 0, 0)
        P.yaw = U.look.yaw
        try { v.camera(G.camera, dt, U) } catch (e) { if (!v._cErr) { v._cErr = true; console.error('[units] camera threw', e) } }
        G.camera.updateMatrixWorld()
        U._camPos = (U._camPos || new V3()).copy(G.camera.position)
        U._camQuat = (U._camQuat || new lt.Quaternion()).copy(G.camera.quaternion)
        U._camSaved = true
      }
    } else if (P && P.alive) {
      // nearest boardable vehicle; the relay prompt wins when both apply
      var best = Infinity
      var relayPrompt = document.querySelector('.h-prompt.on')
      for (var j = 0; j < U.list.length && !relayPrompt; j++) {
        var c = U.list[j]
        if (!c.vehicle || !c.alive || c.__netPilot) continue
        var ep = c.enterPoint(tmp)
        var d = Math.hypot(ep.x - P.pos.x, ep.z - P.pos.z)
        if (d < (c.enterRadius || 3) && Math.abs(ep.y - P.pos.y) < 3 && d < best) { best = d; near = c }
      }
      if (near && inp.pressed && inp.pressed('interact')) { enter(near); near = null }
    }
    updateHud(dt, near)
    try { ladderTick() } catch (e) { }
    for (var h = 0; h < U.hooks.update.length; h++) {
      try { U.hooks.update[h](dt) } catch (e) { if (!U._hookErr) { U._hookErr = true; console.error('[units] update hook', e) } }
    }
  }

  SXU_PLUGINS.forEach(function (plug) { try { plug(U, G) } catch (e) { console.error('[units] plugin failed', e) } })
  return U
}
