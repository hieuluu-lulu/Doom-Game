// ============================================================================
// DoomZone mod — GUNFX: muzzle flashes that light things up.
//
// The renderer keeps a pool of 6 point lights (render.lightPool) and every shot
// calls lightPool.flash(muzzle, 0xffb060, …) — the PAC-9, the arsenal's guns,
// the robots' guns, the other players' shots (0xffb070). Those flashes were
// ~45 cd for 0.05 s: a couple of lux on a wall 5 m off in daylight, so nothing
// visibly lit up; and the pool lights sit on layer 0 while the viewmodel draws
// on its own layer (zc), so the gun in your hands never caught its own flash.
// Here:
//   * gun-coloured flashes are scaled up (SXF_TUNE.gain) and held a little
//     longer (minDur), so walls, floor and people around a shooter flash;
//   * a shot from the local player also fires a viewmodel-only light (layer
//     zc) at the muzzle, so the gun and the gloves light up on every shot;
//   * other flashes (EMP blue, explosions) are left alone.
// ============================================================================

var SXF_TUNE = {
  colors: [0xffb060, 0xffb070], // what the game's gun flashes use
  // gun flashes fall off linearly (decay 1) instead of with the square of the
  // distance: a wall 5–6 m off still lights up, while a pillar half a metre
  // from the muzzle no longer burns white. gain is relative to the game's own
  // flash strength (decay 2), tuned for that
  gain: 1.6, decay: 1, maxIntensity: 200, distMul: 1.4, minDur: 0.07,
  // the viewmodel light: intensity (cd), reach (m), time (s); only for shots
  // fired within `near` m of the camera (the local player's own)
  vm: { intensity: 9, distance: 2.4, dur: 0.07, near: 1.6, color: 0xffb468 },
}
var SXF = { on: false, vm: null, vmT: 0, stats: { boosted: 0, vm: 0 } }

;(function SXF_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || !G.render || !G.render.lightPool || !G.camera) { setTimeout(wait, 250); return }
    try { SXF_install(G) } catch (e) { console.error('[gunfx] disabled', e) }
  }
  setTimeout(wait, 300)
})()

function SXF_install(G) {
  if (SXF.on) return
  SXF.on = true
  var T = SXF_TUNE, pool = G.render.lightPool, flash0 = pool.flash
  // the viewmodel light: layer zc only, so it lights the gun and hands, not the world
  var vm = new lt.PointLight(T.vm.color, 0, T.vm.distance, 2)
  vm.layers.set(zc)
  vm.name = 'gunfx-viewmodel-flash'
  G.render.scene.add(vm)
  SXF.vm = vm
  var camP = new lt.Vector3()
  // the pool's own lights (the scene's point lights with its bookkeeping)
  var lights = []
  G.render.scene.traverse(function (o) { if (o.isPointLight && o.userData && 'persistent' in o.userData) lights.push(o) })
  // the light a flash() call just took: at that spot, fresh (ttl === dur)
  var taken = function (pos, dur) {
    for (var i = 0; i < lights.length; i++) { var l = lights[i], u = l.userData; if (u.busy && !u.persistent && u.ttl === dur && l.position.equals(pos)) return l }
    return null
  }
  pool.flash = function (pos, color, intensity, distance, dur) {
    var gun = color == null || T.colors.indexOf(color) >= 0
    if (!gun) {
      var r0 = flash0.apply(this, arguments), l0 = pos && taken(pos, dur == null ? 0.06 : dur)
      if (l0) l0.decay = 2 // a pool light last used by a gun flash: back to the default fall-off
      return r0
    }
    SXF.stats.boosted++
    var d2 = Math.max(dur == null ? 0.06 : dur, T.minDur)
    var r = flash0.call(this, pos, color, Math.min(T.maxIntensity, (intensity == null ? 30 : intensity) * T.gain), (distance == null ? 10 : distance) * T.distMul, d2)
    var l1 = pos && taken(pos, d2)
    if (l1) l1.decay = T.decay
    try {
      G.camera.getWorldPosition(camP)
      if (pos && camP.distanceTo(pos) < T.vm.near) {
        // the light rides the muzzle; strength follows the shot's own flash (suppressor = dim)
        vm.position.copy(pos)
        SXF.vmPeak = T.vm.intensity * Math.min(2.2, (intensity == null ? 38 : intensity) / 38)
        SXF.vmT = T.vm.dur
        SXF.stats.vm++
      }
    } catch (e) { }
    return r
  }
  var last = performance.now()
  var tick = function () {
    var now = performance.now(), dt = Math.min(0.1, (now - last) / 1000)
    last = now
    if (SXF.vmT > 0) {
      SXF.vmT -= dt
      var k = Math.max(0, SXF.vmT / T.vm.dur)
      vm.intensity = (SXF.vmPeak || T.vm.intensity) * k * k
    } else if (vm.intensity) vm.intensity = 0
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  window.__sxf = SXF // tests
  console.log('[gunfx] gun flashes ×' + T.gain + ' and a viewmodel light')
}
