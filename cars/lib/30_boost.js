// ============================================================================
// DoomZone mod — car BOOST rockets (cars/cars.js): Shift fires a pair of
// rocket nozzles on the tail. SXC_boostRig(G, spec) builds them in the car's
// body frame from spec.boost.nozzles ([x, y, z, r], pointing back, +Z) and
// set(k, dt) drives the burn, k 0..1:
//   * flames: a white-hot core, an orange sheath and a long faint plume
//     (HDR colours, so the bloom picks them up), shock diamonds along the
//     core; all flicker and stretch with k
//   * a glow in each nozzle, a pooled flash light (render.lightPool) on the
//     ground behind, smoke puffs and the odd spark from the plume tip
//   * a rocket roar loop (Go.sx_rocket) that fades in and out with k
// The nozzles themselves (dark steel cans) are always there.
// ============================================================================

var SXC_BOOST = { flicker: 0.18, smokeEvery: 0.05, light: 26, lightR: 9, sound: 0.75 }

// rocket roar for the sound table: a low torn roar + crackle + hiss, 2 s, seamless
function SXC_rocketGen() {
  return function (sr, rng) {
    var n = Math.round(sr * 2), s = new Float32Array(n)
    var roar = Zc(sr, 2, rng, function (b) { tn(b, 'lp', 520, 0.8, sr) }, 0.25)
    var rumble = Zc(sr, 2, rng, function (b) { tn(b, 'lp', 70, 0.7, sr) }, 0.25)
    var hiss = Zc(sr, 2, rng, function (b) { tn(b, 'bp', 2600, 0.9, sr) }, 0.25)
    var crack = Zc(sr, 2, rng, function (b) { tn(b, 'hp', 1500, 0.7, sr) }, 0.25)
    var gate = 0
    for (var i = 0; i < n; i++) {
      // sparse crackle bursts (seamless: the gate restarts each 2 s)
      if (rng() < 0.0016) gate = 1
      gate *= 0.992
      s[i] = Math.tanh((roar[i] * 1.5 + rumble[i] * 1.1 + hiss[i] * 0.35 + crack[i] * gate * 1.6) * 1.5)
    }
    return s
  }
}
try {
  if (typeof Go !== 'undefined' && Go && typeof Zc === 'function' && typeof tn === 'function') {
    Go.sx_rocket = { gen: SXC_rocketGen(), n: 1, sr: Xn, peak: 0.6, loop: 1, ref: 12, roll: 0.8 }
  }
} catch (e) { }

var SXC_BOOST_MATS = null
function SXC_boostMats() {
  if (SXC_BOOST_MATS) return SXC_BOOST_MATS
  var add = function (r, g, b, op) {
    return new lt.MeshBasicMaterial({ color: new lt.Color(r, g, b), transparent: true, opacity: op, depthWrite: false, blending: lt.AdditiveBlending, side: lt.DoubleSide, toneMapped: true })
  }
  SXC_BOOST_MATS = {
    core: add(8, 5.6, 2.4, 0.9), // yellow-white
    sheath: add(7, 2.4, 0.45, 0.7), // orange
    plume: add(2.6, 0.75, 0.16, 0.4), // long faint red-orange
    diamond: add(10, 8, 6, 0.85),
    glow: add(8, 4, 1.2, 0.9),
    can: new lt.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.45, metalness: 0.85 }),
    lip: new lt.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.35, metalness: 0.9 }), // heat-blued / scorched rim
  }
  return SXC_BOOST_MATS
}

function SXC_boostRig(G, spec) {
  var B = spec.boost
  if (!B || !B.nozzles) return null
  var M = SXC_boostMats(), V3 = lt.Vector3
  var root = new lt.Group()
  root.name = 'sx-boost'
  var cone = function (r, len, seg) { return new lt.ConeGeometry(r, len, seg || 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, len / 2) }
  var noz = B.nozzles.map(function (n) {
    var r = n[3], g = new lt.Group()
    g.position.set(n[0], n[1], n[2])
    // the can: a short barrel with a flared bell, open at the back
    var can = new lt.Mesh(new lt.CylinderGeometry(r * 0.85, r * 0.75, r * 2.6, 16, 1, false).rotateX(Math.PI / 2).translate(0, 0, -r * 0.9), M.can)
    var bell = new lt.Mesh(new lt.CylinderGeometry(r * 1.05, r * 0.8, r * 0.9, 18, 1, true).rotateX(Math.PI / 2).translate(0, 0, r * 0.4), M.lip)
    can.castShadow = bell.castShadow = true
    g.add(can, bell)
    // the throat glow, seen when looking into the bell
    var glow = new lt.Mesh(new lt.CircleGeometry(r * 0.78, 18).translate(0, 0, r * 0.3), M.glow)
    g.add(glow)
    // flames (pointing back along +Z from the bell)
    var fl = new lt.Group()
    fl.position.z = r * 0.85
    var core = new lt.Mesh(cone(r * 0.55, 1), M.core)
    var sheath = new lt.Mesh(cone(r * 1.2, 1), M.sheath)
    var plume = new lt.Mesh(cone(r * 1.9, 1, 12), M.plume)
    var dia = []
    for (var k = 0; k < 3; k++) {
      var d = new lt.Mesh(new lt.SphereGeometry(r * 0.32, 10, 6), M.diamond)
      d.scale.z = 0.55
      fl.add(d)
      dia.push(d)
    }
    fl.add(core, sheath, plume)
    ;[core, sheath, plume, glow].concat(dia).forEach(function (m) { m.renderOrder = 870; m.frustumCulled = false })
    g.add(fl)
    root.add(g)
    return { g: g, fl: fl, core: core, sheath: sheath, plume: plume, dia: dia, glow: glow, r: r, tip: new V3() }
  })
  var st = { k: 0, t: 0, smokeT: 0, snd: null }
  var tmp = new V3(), back = new V3()
  function sound(k, pos) {
    if (!G.audio || !G.audio.loop) return
    if (k > 0.02 && !st.snd) {
      try { var h = G.audio.loop('sx_rocket', { gain: 0, pitch: 1, pos: pos, ref: 10 }); if (h && h.setGain) st.snd = h } catch (e) { }
    }
    if (st.snd) {
      try {
        st.snd.setGain(k * SXC_BOOST.sound)
        st.snd.setPitch(0.85 + k * 0.35 + (Math.random() - 0.5) * 0.04)
        st.snd.setPos && st.snd.setPos(pos)
      } catch (e) { }
      if (k <= 0.01) { try { st.snd.stop(0.25) } catch (e) { } st.snd = null }
    }
  }
  return {
    root: root,
    // k: 0..1 burn; pos: the car's position (sound); speed: m/s (plume length)
    set: function (k, dt, pos, speed) {
      st.t += dt
      st.k = k
      var on = k > 0.02
      noz.forEach(function (n, i) {
        n.fl.visible = on
        n.glow.visible = on
        if (!on) return
        var f = 1 + (Math.random() - 0.5) * 2 * SXC_BOOST.flicker
        var len = (1.1 + 0.9 * k + Math.min(1.2, (speed || 0) * 0.03)) * n.r * 7 * f
        n.core.scale.set(0.8 + 0.2 * k, 0.8 + 0.2 * k, len * 0.38)
        n.sheath.scale.set(0.85 + 0.25 * k * f, 0.85 + 0.25 * k * f, len * 0.7)
        n.plume.scale.set(0.9 + 0.3 * k, 0.9 + 0.3 * k, len * (1.2 + 0.25 * Math.sin(st.t * 31 + i)))
        // shock diamonds march along the core, flickering
        n.dia.forEach(function (d, j) {
          d.position.z = len * (0.1 + j * 0.1)
          d.scale.setScalar((0.9 - j * 0.18) * k * (0.75 + 0.5 * Math.random()))
          d.scale.z *= 0.55
        })
        n.glow.material.opacity = 0.6 + 0.35 * k
        n.tip.set(0, 0, len * 0.9)
        n.fl.localToWorld(n.tip)
      })
      if (!on) { sound(0, pos); return }
      // light on the ground behind, smoke and sparks off the plume tip
      try {
        if (G.render && G.render.lightPool) {
          noz[0].g.localToWorld(tmp.set(0, 0, noz[0].r * 4))
          G.render.lightPool.flash(tmp, 0xff8a3a, SXC_BOOST.light * (0.7 + 0.3 * Math.random()) * k, SXC_BOOST.lightR, 0.07)
        }
      } catch (e) { }
      st.smokeT -= dt
      if (st.smokeT <= 0 && G.fx) {
        st.smokeT = SXC_BOOST.smokeEvery
        noz.forEach(function (n) {
          try {
            if (G.fx.smoke) G.fx.smoke(n.tip, { size: 0.5 + k * 0.7, life: 0.9 + k * 0.8, rise: 0.4, count: 1, alpha: 0.18 + 0.12 * k, color: 0x6e6862, vel: back.set(0, 0.3, 0) })
            // the odd spark, thrown back along the plume (not up into the sky)
            if (G.fx.sparks && Math.random() < 0.08 * k) G.fx.sparks(n.tip, n.g.getWorldDirection(tmp).setY(0.25).normalize(), 1)
          } catch (e) { }
        })
      }
      sound(k, pos)
    },
    stop: function () { this.set(0, 0) },
    dispose: function () { if (st.snd) { try { st.snd.stop(0.2) } catch (e) { } st.snd = null } },
  }
}
