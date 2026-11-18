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

var SXC_BOOST = { flicker: 0.18, smokeEvery: 0.05, light: 26, lightR: 9, sound: 0.55, ignite: 0.45 }

// layers of filtered noise, each scaled to unit RMS before the mix
function SXC_unit(b) {
  var e = 0
  for (var i = 0; i < b.length; i++) e += b[i] * b[i]
  var k = e > 0 ? 1 / Math.sqrt(e / b.length) : 0
  for (var j = 0; j < b.length; j++) b[j] *= k
  return b
}
function SXC_peak(s, p) {
  var m = 0
  for (var i = 0; i < s.length; i++) m = Math.max(m, Math.abs(s[i]))
  if (m > 0) for (var j = 0; j < s.length; j++) s[j] *= p / m
  return s
}
// The rocket roar loop for the sound table (2 s, seamless): a deep rumble, a
// low roar and a mid body, a breath of air on top, swelling with the burn's
// flutter (11 and 17.5 Hz: whole cycles in the loop, so the seam stays
// clean). Every noise layer comes from Zc, which crossfades its own tail into
// its head. (The first version, a hard-clipped mix with random crackle
// bursts, measured half its energy above 4 kHz, sample-to-sample jumps near
// full scale and a step at the loop seam: a hiss with pops and a tick every
// 2 s.)
function SXC_rocketGen() {
  return function (sr, rng) {
    var n = Math.round(sr * 2), s = new Float32Array(n)
    var rumble = SXC_unit(Zc(sr, 2, rng, function (b) { tn(b, 'lp', 95, 0.7, sr); tn(b, 'lp', 95, 0.7, sr) }, 0.3))
    var roar = SXC_unit(Zc(sr, 2, rng, function (b) { tn(b, 'lp', 380, 0.6, sr); tn(b, 'hp', 55, 0.7, sr) }, 0.3))
    var body = SXC_unit(Zc(sr, 2, rng, function (b) { tn(b, 'bp', 820, 0.8, sr) }, 0.3))
    var air = SXC_unit(Zc(sr, 2, rng, function (b) { tn(b, 'bp', 2300, 1.4, sr) }, 0.3))
    var w = 2 * Math.PI
    for (var i = 0; i < n; i++) {
      var t = i / sr
      var fl = 1 + 0.13 * Math.sin(w * 11 * t) + 0.07 * Math.sin(w * 17.5 * t + 1.3)
      s[i] = Math.tanh((rumble[i] * 0.8 + roar[i] * 0.8 + body[i] * 0.5 + air[i] * 0.12) * fl * 0.42)
    }
    return SXC_peak(s, 0.95)
  }
}
// the ignition: a soft thump and a short whoosh as the rockets light (0.8 s)
function SXC_igniteGen() {
  return function (sr, rng) {
    var n = Math.round(sr * 0.8), s = new Float32Array(n)
    var a = SXC_unit(tn(Qn(sr, 0.8, rng), 'lp', 1100, 0.7, sr))
    var b = SXC_unit(tn(tn(Qn(sr, 0.8, rng), 'lp', 220, 0.7, sr), 'lp', 220, 0.7, sr))
    for (var i = 0; i < n; i++) {
      var t = i / sr
      var env = Math.min(1, t / 0.025) * Math.exp(-t * 4.2)
      var thump = Math.sin(2 * Math.PI * (48 + 30 * Math.exp(-t * 20)) * t) * Math.exp(-t * 11)
      s[i] = Math.tanh((a[i] * 0.95 + b[i] * 0.7) * env * 0.5 + thump * 0.42)
    }
    return SXC_peak(s, 0.9)
  }
}
try {
  if (typeof Go !== 'undefined' && Go && typeof Zc === 'function' && typeof tn === 'function') {
    Go.sx_rocket = { gen: SXC_rocketGen(), n: 1, sr: Xn, peak: 0.6, loop: 1, ref: 12, roll: 0.8 }
    if (typeof Qn === 'function') Go.sx_rocket_ignite = { gen: SXC_igniteGen(), n: 1, sr: Xn, peak: 0.7, ref: 10, roll: 0.9 }
  }
} catch (e) { }
try { window.__sxRocketGen = SXC_rocketGen; window.__sxIgniteGen = SXC_igniteGen } catch (e) { } // tests

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
  var st = { k: 0, t: 0, smokeT: 0, snd: null, lit: false }
  var tmp = new V3(), back = new V3()
  function sound(k, pos) {
    if (!G.audio || !G.audio.loop) return
    // the rockets light: one thump-whoosh (not again until they have gone out)
    if (k > 0.05 && !st.lit) {
      st.lit = true
      try { G.audio.play && G.audio.play('sx_rocket_ignite', { pos: pos, gain: SXC_BOOST.ignite, pitch: 0.95 + Math.random() * 0.1 }) } catch (e) { }
    } else if (k < 0.01) st.lit = false
    if (k > 0.02 && !st.snd) {
      try { var h = G.audio.loop('sx_rocket', { gain: 0, pitch: 1, pos: pos, ref: 10 }); if (h && h.setGain) st.snd = h } catch (e) { }
    }
    if (st.snd) {
      try {
        // smooth: k is already eased; a per-frame random pitch made it warble
        st.snd.setGain(k * SXC_BOOST.sound)
        st.snd.setPitch(0.88 + k * 0.22)
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
