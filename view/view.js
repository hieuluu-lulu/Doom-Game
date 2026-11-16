// ============================================================================
// DoomZone mod — VIEW: lean (peek)
//
// Hold Q / E (touch: L / R). After the stock player update, the eye
// (G.player.eye — every gun shoots from it, so shots leave from the leaned
// eye) and the camera move sideways up to 0.38 m and the camera rolls ~12°;
// the viewmodel rides the camera, so it tilts with it. A raycast from the eye
// stops the lean 0.24 m short of walls, so you can't peek through a container.
// Off while sprinting, dead, or driving a vehicle.
//
// window.SXV = { lean: -1..1, tps: false } (read-only, for multiplayer).
//
// Step smoothing: walking up/down stairs or a curb moves the body in small
// jumps (each step snaps the capsule up). While on the ground, a small sudden
// height change of the eye is eased out over ~0.06 s instead of jumping, so
// stairs feel like a slope. Jumps, falls, respawns and vehicles are not
// smoothed (the camera follows them at once).
// ============================================================================

var SXV_TUNE = { dist: 0.38, roll: 0.21, rate: 9, dip: 0.04, wall: 0.24, step: 10, stepMax: 0.75 }
var SXV = { lean: 0, tps: false }
window.SXV = SXV

;(function SXV_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || !G.player || !G.camera || !G.physics) { setTimeout(wait, 250); return }
    try { SXV_install(G) } catch (e) { console.error('[view] lean disabled', e) }
  }
  setTimeout(wait, 300)
})()

function SXV_install(G) {
  var T = SXV_TUNE, P = G.player, cam = G.camera
  var right = new lt.Vector3(), dir = new lt.Vector3(), errLogged = false
  var piloting = function () { return typeof SXU !== 'undefined' && SXU && SXU.pilot }
  var up0 = P.update
  P.update = function (dt) {
    var r = up0.apply(this, arguments)
    try { lean(dt || 0) } catch (e) { if (!errLogged) { errLogged = true; console.error('[view] lean', e) } }
    try { smoothStep(dt || 0) } catch (e) { if (!errLogged) { errLogged = true; console.error('[view] step', e) } }
    return r
  }
  // eased eye height on stairs (see header)
  var sy = null
  function smoothStep(dt) {
    var e = P.eye
    if (!e) return
    if (sy == null || piloting() || !P.alive || !(dt > 0)) { sy = e.y; return }
    var d = e.y - sy
    if (Math.abs(d) > T.stepMax || P.onGround === false) { sy = e.y; return }
    sy += d * (1 - Math.exp(-dt * T.step))
    var off = sy - e.y
    if (Math.abs(off) < 1e-4) return
    e.y += off
    cam.position.y += off
  }
  function lean(dt) {
    var inp = G.input
    var can = P.alive && P.enabled !== false && !P.sprinting && !piloting()
    var want = can && inp && inp.down ? (inp.down('leanR') ? 1 : 0) - (inp.down('leanL') ? 1 : 0) : 0
    SXV.lean += (want - SXV.lean) * Math.min(1, dt * T.rate)
    if (Math.abs(SXV.lean) < 0.002) { SXV.lean = 0; return }
    right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw))
    var side = SXV.lean > 0 ? 1 : -1
    dir.copy(right).multiplyScalar(side)
    var h = null
    try { h = G.physics.raycast(P.eye, dir, T.dist + T.wall + 0.1) } catch (e) { }
    var room = h ? Math.max(0, h.dist - T.wall) : T.dist
    var off = Math.min(Math.abs(SXV.lean) * T.dist, room) * side
    P.eye.addScaledVector(right, off)
    P.eye.y -= Math.abs(SXV.lean) * T.dip
    cam.position.copy(P.eye)
    // less roll when a wall leaves little room
    cam.rotation.z -= SXV.lean * T.roll * Math.min(1, room / (0.3 * T.dist))
  }
  console.log('[view] lean ready: hold Q / E')
}
