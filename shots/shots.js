// ============================================================================
// DoomZone mod — SHOTS: bullets stop on what you can see, not on the padding of
// collision boxes.
//
// The level's collision boxes serve movement and bullets alike. Some are bigger
// than what is drawn (sandbags, crates), and some fill open structures that you
// can see through (crane gantries, lattice towers, chain-link fences, poles).
// While a shot is traced (player shots incl. vehicle guns, robot shots), the
// physics raycast is wrapped:
//   * graze  — a hit within SXB_TUNE.graze of an edge of the face it struck
//              does not stop the bullet when its path through the box is
//              short (≤ grazeDepth: it only clips the corner) — it carries on;
//   * see-through boxes (bullets pass, you still can't walk through):
//       - tag 'backdrop' (the port's cranes and other set dressing),
//       - thin metal sheets ≤ 0.12 m thick, ≤ 2.5 m tall, ≥ 8 m long (chain-link
//         fences; container panels are taller/shorter and stay solid),
//       - slender metal boxes taller than 6 m on a squarish ≤ 3 m footprint
//         (lattice towers, pylons, masts, light poles), and any box a map marks
//         `bulletPass: true`.
// Movement, AI line of sight, wheels and cameras keep the plain raycast.
// ============================================================================

var SXB_TUNE = { graze: 0.1, grazeDepth: 0.35, maxPass: 6, fenceThin: 0.12, fenceTall: 2.5, fenceLong: 8, towerTall: 6, towerFoot: 3 }
var SXB = { on: 0, see: new WeakMap(), stats: { graze: 0, see: 0 }, trace: [] } // trace: fn(origin, dir, dist) per traced shot (crossroads glass)

;(function SXB_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || !G.physics || !G.combat || typeof G.physics.raycast !== 'function') { setTimeout(wait, 250); return }
    try { SXB_install(G) } catch (e) { console.error('[shots] disabled', e) }
  }
  setTimeout(wait, 300)
})()

// is this collision box something bullets should fly through?
function SXB_seeThrough(b) {
  var T = SXB_TUNE
  if (SXB.see.has(b)) return SXB.see.get(b)
  var sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z, metal = b.surface === 'metal', r = false
  if (b.bulletPass || b.tag === 'backdrop') r = true
  else if (metal && Math.min(sx, sz) <= T.fenceThin && sy <= T.fenceTall && Math.max(sx, sz) >= T.fenceLong) r = true // chain-link
  else if (metal && sy > T.towerTall && Math.max(sx, sz) <= T.towerFoot && Math.min(sx, sz) >= 0.5 * Math.max(sx, sz)) r = true // lattice tower / pole / mast
  SXB.see.set(b, r)
  return r
}

function SXB_install(G) {
  var T = SXB_TUNE, V3 = lt.Vector3, ph = G.physics, ray0 = ph.raycast
  window.__sxb = SXB // tests

  // did the ray graze the box (struck the face near one of its edges)?
  function grazes(h, b) {
    var n = h.normal, q = h.point, g = T.graze
    if (!n || !q) return false
    var axes = Math.abs(n.x) > 0.5 ? ['y', 'z'] : Math.abs(n.y) > 0.5 ? ['x', 'z'] : ['x', 'y']
    for (var i = 0; i < 2; i++) {
      var a = axes[i], lo = b.min[a], hi = b.max[a]
      if (hi - lo < 0.8) continue // narrow sides (window jambs, posts) keep their full width
      if (a === 'y' && lo <= 0.05) { if (hi - q[a] < g) return true; continue } // standing on the ground: only the top edge
      if (q[a] - lo < g || hi - q[a] < g) return true
    }
    return false
  }
  // how far along the ray from o it leaves box b
  function exitDist(o, d, b) {
    var t = Infinity
    for (var i = 0; i < 3; i++) {
      var a = i === 0 ? 'x' : i === 1 ? 'y' : 'z'
      if (Math.abs(d[a]) < 1e-9) continue
      var e = ((d[a] > 0 ? b.max[a] : b.min[a]) - o[a]) / d[a]
      if (e < t) t = e
    }
    return isFinite(t) ? Math.max(0, t) : 0
  }
  var org = new V3()
  ph.raycast = function (o, d, max) {
    if (!SXB.on) return ray0.apply(this, arguments)
    var r = shotRay.call(this, o, d, max)
    // listeners (window glass) learn where the shot went
    for (var i = 0; i < SXB.trace.length; i++) try { SXB.trace[i](o, d, r ? r.dist : max == null ? 500 : max) } catch (e) { }
    return r
  }
  function shotRay(o, d, max) {
    if (max == null) max = 500
    org.copy(o)
    var gone = 0
    for (var k = 0; k <= T.maxPass; k++) {
      var h = ray0.call(this, org, d, max - gone)
      if (!h || !h.box) { if (h) h.dist += gone; return h }
      var b = h.box, pass = false
      if (SXB_seeThrough(b)) { pass = true; SXB.stats.see++ }
      var ex = exitDist(org, d, b) + 0.02
      if (!pass && grazes(h, b) && ex - h.dist <= T.grazeDepth) { pass = true; SXB.stats.graze++ }
      if (!pass) { h.dist += gone; return h }
      org.addScaledVector(d, ex)
      gone += ex
      if (gone >= max) return null
    }
    return null
  }
  // shot tracers: the player's (U.shoot / vehicle guns go through playerShot) and the robots'
  function wrap(obj, name) {
    var f = obj && obj[name]
    if (typeof f !== 'function' || f.__sxb) return
    var w = function () { SXB.on++; try { return f.apply(this, arguments) } finally { SXB.on-- } }
    w.__sxb = true
    obj[name] = w
  }
  wrap(G.combat, 'playerShot')
  wrap(G.combat, 'enemyShot')
  var waitUnits = function () { if (G.units && typeof G.units.enemyShot === 'function') wrap(G.units, 'enemyShot'); else setTimeout(waitUnits, 500) }
  waitUnits()
  console.log('[shots] bullets slip past box edges (' + T.graze + ' m) and through see-through structures')
}
