// ============================================================================
// DoomZone mod — JETS (desert map)
//   talon  : ALLY aerobatic fighter — cannon + heat-seeking air-to-air missiles
//   harrow : ALLY VTOL strike jet — hovers, transitions to wing-borne flight,
//            FLIR targeting pod (hold right mouse) + guided air-to-ground missiles
//   petrel : ENEMY interceptor — strafing runs, missiles at aircraft, can guard
//            an outpost (opts.guard / opts.home like the Skua)
// Built on the units framework (units/units.js): factories in SXU_TYPES, a
// plugin in SXU_PLUGINS parks the jets and brings the Petrels in. Geometry is
// procedural, merged per material with the bundle's `io` builder. Local frame:
// x right, y up, forward = -z. Every top-level name starts with SXJ_.
// ============================================================================

var SXJ_TUNE = {
  arena: { x: -4.25, z: -0.85, half: 575, soft: 45 },
  ceiling: 350,
  talon: {
    label: 'Talon', hp: 760, armor: 0.85, gearH: 1.62, radius: 8,
    thrust: 30, ab: 26, drag: 0.00248, vStall: 34, vFly: 58, vRot: 44, vLand: 62, maxSink: 9,
    pitchRate: 2.0, rollRate: 3.6, yawRate: 0.6, align: 2.8,
    gunDmg: 13, gunRate: 20, gunSpread: 0.006, gunRange: 900, heat: 0.018, cool: 0.3,
    aam: 4, aamReload: 12, aamDmg: 490, aamR: 6, aamSpeed: 300, aamTurn: 2.7, aamFuse: 7,
    lockCone: 0.22, lockTime: 1.1, lockRange: 1400,
    // RMB sight: zoomed view along the aim, lock whatever sits in its circle
    scopeFov: 18, scopeCone: 0.065, scopeLockTime: 0.6, scopeRange: 2000,
  },
  harrow: {
    label: 'Harrow', hp: 1150, armor: 0.75, gearH: 1.5, radius: 7, vtol: true,
    hoverSpd: 24, strafe: 13, climb: 11, sink: 11, transition: 32,
    thrust: 22, ab: 10, drag: 0.003, vStall: 30, vFly: 46, vRot: 36, vLand: 55, maxSink: 6,
    pitchRate: 1.45, rollRate: 2.5, yawRate: 0.55, align: 2.3,
    gunDmg: 20, gunRate: 11, gunSpread: 0.008, gunRange: 800, heat: 0.03, cool: 0.3,
    agm: 8, agmReload: 10, agmDmg: 330, agmR: 8, agmSpeed: 165, agmTurn: 3.2, scopeFov: 11,
  },
  petrel: {
    label: 'Petrel Interceptor', hp: 950, speed: 104, extendSpeed: 122, guardSpeed: 72, turn: 0.8,
    alt: [120, 170], guardR: 160, guardAlt: 175, wake: 165, wakeHome: 210,
    cannonDmg: 7, cannonRange: 480, burst: 16, burstGap: 0.06, cannonCd: [2.4, 3.6], spread: 0.014,
    missileCd: [10, 14], missileDmg: 42, missileR: 6, missileSpeed: 150, missileTurn: 1.5,
  },
}

/* ------------------------------------------------------------ helpers ---- */

function SXJ_mats(G) {
  if (G.__sxjMats) return G.__sxjMats
  var get = function (name, o) {
    try { return G.mats.get(name, o) } catch (e) { return new lt.MeshStandardMaterial({ color: 0x777777, roughness: 0.6 }) }
  }
  var emi = function (hex, k) {
    var c = new lt.Color(hex)
    return new lt.MeshBasicMaterial({ color: new lt.Color(c.r * k, c.g * k, c.b * k) })
  }
  var M = {
    grey: get('paint_grey', { triplanar: true, scale: 1.2 }),
    tan: get('polymer_tan', { triplanar: true, scale: 1.4 }),
    white: get('paint_white', { triplanar: true }),
    blue: get('paint_blue', { triplanar: true }),
    red: get('paint_red', { triplanar: true }),
    dark: get('steel_dark', { triplanar: true, scale: 1.4 }),
    gun: get('gunmetal', { triplanar: true, scale: 2.2 }),
    hull: get('gunmetal', { triplanar: true, scale: 0.7 }),
    black: get('polymer_black', { triplanar: true, scale: 2 }),
    glass: get('glass', { doubleSide: true }),
    rubber: get('rubber', { triplanar: true }),
    hazard: get('hazard_stripes', { triplanar: true, scale: 1.4 }),
  }
  M.navRed = emi(0xff2a18, 14)
  M.navGreen = emi(0x30ff70, 10)
  M.strobe = emi(0xffffff, 30)
  M.burner = new lt.MeshBasicMaterial({ color: new lt.Color(6, 2.6, 0.9), transparent: true, opacity: 0.85, depthWrite: false })
  M.burnerCore = new lt.MeshBasicMaterial({ color: new lt.Color(9, 7, 4), transparent: true, opacity: 0.9, depthWrite: false })
  M.eye = emi(0xff2a10, 9)
  M.lens = emi(0x2a90ff, 2.4)
  G.__sxjMats = M
  return M
}

// Chamfered-rectangle loft. stations: [z, yCenter, halfW, halfH, chamfer 0..0.5]
function SXJ_loft(st, xOff) {
  xOff = xOff || 0
  var rings = st.map(function (s) {
    var z = s[0], y = s[1], hw = s[2], hh = s[3], ch = Math.min(hw, hh) * s[4] * 2
    return [[hw - ch, hh], [hw, hh - ch], [hw, -hh + ch], [hw - ch, -hh], [-hw + ch, -hh], [-hw, -hh + ch], [-hw, hh - ch], [-hw + ch, hh]].map(function (p) {
      return [p[0] + xOff, p[1] + y, z]
    })
  })
  var pos = []
  var tri = function (a, b, c, cx, cy, cz) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    var mx = (a[0] + b[0] + c[0]) / 3 - cx, my = (a[1] + b[1] + c[1]) / 3 - cy, mz = (a[2] + b[2] + c[2]) / 3 - cz
    if (nx * mx + ny * my + nz * mz < 0) { var t = b; b = c; c = t }
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  }
  for (var k = 0; k < rings.length - 1; k++) {
    var A = rings[k], B = rings[k + 1]
    var cy = (st[k][1] + st[k + 1][1]) / 2, cz = (st[k][0] + st[k + 1][0]) / 2
    for (var i = 0; i < 8; i++) {
      var j = (i + 1) % 8
      tri(A[i], A[j], B[j], xOff, cy, cz)
      tri(A[i], B[j], B[i], xOff, cy, cz)
    }
  }
  var cap = function (R, s, dir) {
    for (var i = 0; i < 8; i++) tri([xOff, s[1], s[0]], R[i], R[(i + 1) % 8], xOff, s[1], s[0] - dir)
  }
  cap(rings[0], st[0], -1)
  cap(rings[rings.length - 1], st[st.length - 1], 1)
  var g = new lt.BufferGeometry()
  g.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new lt.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2))
  g.computeVertexNormals()
  return g
}

// Flat horizontal surface (wing, canard, stabiliser): outline [[x, z], ...].
function SXJ_wing(pts, t, y) {
  var sh = new lt.Shape()
  pts.forEach(function (p, i) { i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]) })
  sh.closePath()
  var g = new lt.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: Math.min(0.05, t * 0.35), bevelSegments: 1, curveSegments: 3 })
  g.rotateX(Math.PI / 2)
  g.translate(0, (y || 0) + t / 2, 0)
  return g
}

// Vertical plate (fin): outline [[z, y], ...], thickness t, centred on x.
function SXJ_plate(pts, t, x) {
  var sh = new lt.Shape()
  pts.forEach(function (p, i) { i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]) })
  sh.closePath()
  var g = new lt.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: Math.min(0.02, t * 0.3), bevelSize: Math.min(0.03, t * 0.3), bevelSegments: 1, curveSegments: 3 })
  g.rotateY(-Math.PI / 2)
  g.translate((x || 0) + t / 2, 0, 0)
  return g
}

function SXJ_raySphere(o, d, c, r) {
  var ox = o.x - c[0], oy = o.y - c[1], oz = o.z - c[2]
  var b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc
  if (h < 0) return -1
  var t = -b - Math.sqrt(h)
  return t >= 0 ? t : -1
}
function SXJ_rayCapsule(o, d, a, b, r) {
  var bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2]
  var oax = o.x - a[0], oay = o.y - a[1], oaz = o.z - a[2]
  var baba = bax * bax + bay * bay + baz * baz, bard = bax * d.x + bay * d.y + baz * d.z
  var baoa = bax * oax + bay * oay + baz * oaz, rdoa = d.x * oax + d.y * oay + d.z * oaz, oaoa = oax * oax + oay * oay + oaz * oaz
  var aa = baba - bard * bard, bb = baba * rdoa - baoa * bard, cc = baba * oaoa - baoa * baoa - r * r * baba
  var h = bb * bb - aa * cc
  if (h >= 0 && aa > 1e-9) {
    var t = (-bb - Math.sqrt(h)) / aa, y = baoa + t * bard
    if (y > 0 && y < baba) return t >= 0 ? t : -1
    var ocx = y <= 0 ? oax : o.x - b[0], ocy = y <= 0 ? oay : o.y - b[1], ocz = y <= 0 ? oaz : o.z - b[2]
    var b2 = d.x * ocx + d.y * ocy + d.z * ocz, c2 = ocx * ocx + ocy * ocy + ocz * ocz - r * r, h2 = b2 * b2 - c2
    if (h2 > 0) { var t2 = -b2 - Math.sqrt(h2); return t2 >= 0 ? t2 : -1 }
  }
  return -1
}
var SXJ_inv = new lt.Matrix4(), SXJ_lo = new lt.Vector3(), SXJ_ld = new lt.Vector3()
function SXJ_hitShapes(root, shapes, o, d, max) {
  root.updateMatrixWorld()
  SXJ_inv.copy(root.matrixWorld).invert()
  SXJ_lo.copy(o).applyMatrix4(SXJ_inv)
  SXJ_ld.copy(d).transformDirection(SXJ_inv)
  var best = -1, bs = null
  for (var k = 0; k < shapes.length; k++) {
    var s = shapes[k]
    var t = s.c ? SXJ_raySphere(SXJ_lo, SXJ_ld, s.c, s.r) : SXJ_rayCapsule(SXJ_lo, SXJ_ld, s.a, s.b, s.r)
    if (t >= 0 && t <= max && (best < 0 || t < best)) { best = t; bs = s }
  }
  if (best < 0) return null
  return { dist: best, point: new lt.Vector3().copy(o).addScaledVector(d, best), normal: d.clone().negate(), part: bs.part || 'body' }
}

function SXJ_loop(G, names, opts) {
  for (var k = 0; k < names.length; k++) {
    try {
      if (G.audio && typeof G.audio.loop === 'function') {
        var h = G.audio.loop(names[k], opts)
        if (h && h.setGain && h.name) return h
      }
    } catch (e) { }
  }
  return { setGain: function () {}, setPitch: function () {}, setPos: function () {}, stop: function () {} }
}

function SXJ_damp(a, b, k, dt) { return b + (a - b) * Math.exp(-k * dt) }
function SXJ_clamp(v, a, b) { return v < a ? a : v > b ? b : v }

// Jet turbine loop for the bundle's sound table: roar + hiss + whine, 2 s, seamless.
function SXJ_turbineGen() {
  return function (sr, rng) {
    var n = Math.round(sr * 2), s = new Float32Array(n)
    var roar = Zc(sr, 2, rng, function (b) { tn(b, 'lp', 900, 0.7, sr) }, 0.25)
    var hiss = Zc(sr, 2, rng, function (b) { tn(b, 'bp', 3400, 0.8, sr) }, 0.25)
    var rumble = Zc(sr, 2, rng, function (b) { tn(b, 'lp', 110, 0.7, sr) }, 0.25)
    for (var i = 0; i < n; i++) {
      var t = i / sr
      var whine = Math.sin(vt * 2200 * t) * 0.045 + Math.sin(vt * 3300.5 * t) * 0.022 + Math.sin(vt * 1100 * t) * 0.035
      s[i] = Math.tanh((roar[i] * 1.15 + hiss[i] * 0.4 + rumble[i] * 0.8 + whine) * 1.4)
    }
    return s
  }
}
try {
  if (typeof Go !== 'undefined' && Go && typeof Zc === 'function' && typeof tn === 'function') {
    Go.sx_jet_turbine = { gen: SXJ_turbineGen(), n: 1, sr: Xn, peak: 0.6, loop: 1, ref: 16, roll: 0.7 }
  }
} catch (e) { }

// Look-rotation quaternion: -z along `fwd`, rolled `bank` about it.
var SXJ_m4 = new lt.Matrix4(), SXJ_o = new lt.Vector3(), SXJ_upv = new lt.Vector3(0, 1, 0), SXJ_qr = new lt.Quaternion(), SXJ_zAx = new lt.Vector3(0, 0, 1)
function SXJ_lookQuat(fwd, bank, out) {
  SXJ_upv.set(0, 1, 0)
  if (Math.abs(fwd.y) > 0.995) SXJ_upv.set(0, 0, 1)
  SXJ_m4.lookAt(SXJ_o, fwd, SXJ_upv)
  out.setFromRotationMatrix(SXJ_m4)
  if (bank) out.multiply(SXJ_qr.setFromAxisAngle(SXJ_zAx, bank))
  return out
}

/* ============================================================== MODELS === */

function SXJ_missileGeo(M, long) {
  var L = long ? 3.0 : 2.4, R = long ? 0.13 : 0.1
  var B = new io()
  B.add(M.white, xt(R, R, L, 'z', 0, 0, 0, 10))
  B.add(M.dark, xt(0.0, R, 0.42, 'z', 0, 0, -L / 2 - 0.2, 10))
  B.add(M.red, xt(R * 1.02, R * 1.02, 0.12, 'z', 0, 0, -L / 2 + 0.3, 10))
  B.add(M.dark, Ee(-R * 3, -0.012, L / 2 - 0.5, R * 3, 0.012, L / 2 - 0.05))
  B.add(M.dark, Ee(-0.012, -R * 3, L / 2 - 0.5, 0.012, R * 3, L / 2 - 0.05))
  B.add(M.dark, Ee(-R * 2.2, -0.01, -L / 2 + 0.2, R * 2.2, 0.01, -L / 2 + 0.45))
  return B.build({ cast: true, recv: false })
}

function SXJ_talonModel(G) {
  var M = SXJ_mats(G)
  var root = new lt.Group()
  root.name = 'talon'
  var B = new io()
  // fuselage, dorsal spine, nose
  B.add(M.grey, SXJ_loft([
    [-7.6, 0.02, 0.04, 0.04, 0.5], [-6.8, 0.0, 0.26, 0.24, 0.45], [-5.4, 0.02, 0.5, 0.44, 0.4], [-3.8, 0.06, 0.72, 0.58, 0.36],
    [-1.8, 0.06, 0.92, 0.64, 0.34], [1.0, 0.06, 1.06, 0.64, 0.32], [4.0, 0.08, 1.02, 0.6, 0.32], [6.3, 0.1, 0.92, 0.54, 0.34], [7.2, 0.1, 0.86, 0.5, 0.36],
  ]))
  B.add(M.grey, SXJ_loft([[-1.2, 0.62, 0.3, 0.12, 0.42], [4.8, 0.6, 0.36, 0.14, 0.42], [6.4, 0.55, 0.2, 0.08, 0.42]]))
  B.add(M.dark, SXJ_loft([[-7.65, 0.02, 0.05, 0.05, 0.5], [-7.0, 0.01, 0.2, 0.18, 0.45]]))
  // canopy, frame, seat
  B.add(M.glass, SXJ_loft([[-5.1, 0.4, 0.1, 0.04, 0.4], [-4.4, 0.62, 0.36, 0.2, 0.45], [-3.4, 0.8, 0.42, 0.28, 0.45], [-2.3, 0.76, 0.38, 0.22, 0.45], [-1.5, 0.6, 0.2, 0.06, 0.45]]))
  B.add(M.dark, Ee(-0.42, 0.62, -3.82, 0.42, 1.1, -3.74, 0.02))
  B.add(M.black, Ee(-0.32, 0.3, -3.3, 0.32, 0.95, -2.9, 0.06))
  // side intakes
  ;[-1, 1].forEach(function (s) {
    B.add(M.grey, SXJ_loft([[-3.1, -0.16, 0.34, 0.38, 0.3], [1.2, -0.1, 0.4, 0.44, 0.3]], s * 1.2))
    B.add(M.black, Ee(s * 1.2 - 0.3, -0.5, -3.16, s * 1.2 + 0.3, 0.2, -3.04))
  })
  // cropped-delta wings with blue tips, canards, stabilators
  ;[-1, 1].forEach(function (s) {
    B.add(M.grey, SXJ_wing([[s * 0.9, -1.4], [s * 5.4, 3.6], [s * 5.4, 4.9], [s * 0.9, 5.4]], 0.16, -0.12))
    B.add(M.blue, SXJ_wing([[s * 4.9, 2.9], [s * 5.42, 3.62], [s * 5.42, 4.88], [s * 4.9, 4.95]], 0.17, -0.125))
    B.add(M.grey, SXJ_wing([[s * 0.95, -3.5], [s * 2.6, -2.55], [s * 2.6, -2.05], [s * 0.95, -2.15]], 0.08, 0.18))
    B.add(M.grey, SXJ_wing([[s * 1.0, 5.6], [s * 3.4, 7.0], [s * 3.4, 7.7], [s * 1.0, 7.5]], 0.09, -0.05))
    // canted twin fins
    var fin = SXJ_plate([[4.2, 0.6], [6.7, 0.6], [7.5, 3.1], [6.5, 3.15]], 0.12, 0)
    fin.rotateZ(-s * 0.28).translate(s * 1.05, 0, 0)
    B.add(M.grey, fin)
    var finTip = SXJ_plate([[6.9, 2.6], [7.36, 2.62], [7.5, 3.1], [7.1, 3.12]], 0.13, 0)
    finTip.rotateZ(-s * 0.28).translate(s * 1.05, 0, 0)
    B.add(M.blue, finTip)
    // nozzles
    B.add(M.gun, xt(0.6, 0.52, 1.1, 'z', s * 0.56, 0.08, 7.55, 18))
    B.add(M.black, xt(0.5, 0.5, 0.05, 'z', s * 0.56, 0.08, 8.08, 16))
    // wing pylons
    B.add(M.dark, Ee(s * 3.0 - 0.05, -0.5, 1.3, s * 3.0 + 0.05, -0.12, 3.0, 0.02))
    B.add(M.dark, Ee(s * 5.4 - 0.05, -0.2, 3.4, s * 5.4 + 0.05, 0.0, 5.0, 0.02))
  })
  // nav lights
  B.add(M.navRed, new lt.SphereGeometry(0.06, 8, 6).translate(-5.45, -0.05, 4.4))
  B.add(M.navGreen, new lt.SphereGeometry(0.06, 8, 6).translate(5.45, -0.05, 4.4))
  root.add(B.build({ cast: true, recv: true }))
  // landing gear (retracts)
  var gear = new lt.Group()
  var GB = new io()
  ;[[0, -4.8, 0.32], [-1.6, 1.4, 0.4], [1.6, 1.4, 0.4]].forEach(function (g) {
    GB.add(M.dark, Ke([g[0], -0.4, g[1]], [g[0], -1.3, g[1]], 0.08, 8))
    GB.add(M.rubber, xt(g[2], g[2], 0.24, 'x', g[0], -1.62 + g[2], g[1], 14))
  })
  gear.add(GB.build({ cast: true, recv: true }))
  root.add(gear)
  // afterburner flames
  var flames = []
  ;[-1, 1].forEach(function (s) {
    var f = new lt.Mesh(new lt.ConeGeometry(0.42, 3.2, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 1.6), M.burner)
    f.position.set(s * 0.56, 0.08, 8.1)
    var c = new lt.Mesh(new lt.ConeGeometry(0.24, 1.6, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.8), M.burnerCore)
    c.position.copy(f.position)
    f.renderOrder = c.renderOrder = 880
    root.add(f, c)
    flames.push(f, c)
  })
  // missiles: 2 under the wings, 2 on the tips
  var mg = SXJ_missileGeo(M, false)
  var rails = [[-3.0, -0.62, 2.1], [3.0, -0.62, 2.1], [-5.4, -0.22, 4.1], [5.4, -0.22, 4.1]].map(function (p) {
    var mm = mg.clone()
    mm.position.set(p[0], p[1], p[2])
    root.add(mm)
    return { mesh: mm, local: new lt.Vector3(p[0], p[1], p[2]) }
  })
  var strobe = new lt.Mesh(new lt.SphereGeometry(0.07, 8, 6), M.strobe)
  strobe.position.set(0, 0.7, 5.6)
  root.add(strobe)
  return {
    root: root, gear: gear, flames: flames, rails: rails, strobe: strobe, missileMesh: mg,
    muzzle: new lt.Vector3(0.7, 0.35, -4.6), pod: null,
    cockpit: new lt.Vector3(0, 0.95, -3.2),
    shapes: [
      { a: [0, 0.05, -7.2], b: [0, 0.08, 7.2], r: 1.0 },
      { a: [-5.0, -0.05, 3.6], b: [5.0, -0.05, 3.6], r: 0.7 },
      { a: [-3.0, -0.05, 6.8], b: [3.0, -0.05, 6.8], r: 0.45 },
      { a: [0, 0.6, 5.0], b: [0, 2.6, 6.9], r: 0.6 },
    ],
  }
}

// ------------------------------------------------- TALON: the Su-57 model
// From sukhoi_su-57_felon_-_fighter_jet_-_free.glb, embedded as assets/su57.glb (23 MB → 0.9 MB: extra UV sets /
// tangents dropped, lightly simplified, 1024 px WebP textures, quantised).
// GLB frame: nose +X, up +Y, right wing +Z, 0.1 m units (19.6 m long); it is
// scaled to the Talon's 16.4 m. Parts: airframe, canopy, cockpit, hud,
// instrGlass, landingOn (gear down, + landing light), landingOff (gear doors shut).
var SXJ_SU = { ready: false, failed: false, started: false, scene: null }
var SXJ_SUT = { s: 0.0837, wheelsY: -24.21, midX: 11 }
SXJ_SUT.oy = -1.62 - SXJ_SUT.wheelsY * SXJ_SUT.s   // wheels on the ground (Talon gearH)
SXJ_SUT.oz = 0.25 + SXJ_SUT.midX * SXJ_SUT.s       // centred like the old Talon
function SXJ_suStart() {
  if (SXJ_SU.started) return
  SXJ_SU.started = true
  if (typeof SX_ASSET_su57 !== 'string' || typeof SX_parseGLB !== 'function') { SXJ_SU.failed = true; return }
  SX_parseGLB(SX_ASSET_su57).then(function (g) { SXJ_SU.scene = g.scene; SXJ_SU.ready = true }, function (e) { SXJ_SU.failed = true; console.warn('[jets] Su-57 model failed, procedural Talon', e) })
}
// GLB point → Talon frame (nose -Z, origin gearH above the wheels)
function SXJ_suP(x, y, z) { var T = SXJ_SUT; return new lt.Vector3(z * T.s, y * T.s + T.oy, -x * T.s + T.oz) }
function SXJ_su57Model(G) {
  var M = SXJ_mats(G), T = SXJ_SUT
  var root = new lt.Group()
  root.name = 'talon'
  var hold = new lt.Group()
  hold.rotation.y = Math.PI / 2
  hold.scale.setScalar(T.s)
  hold.position.set(0, T.oy, T.oz)
  var body = SXJ_SU.scene.clone(true)
  body.traverse(function (o) { if (o.isMesh) { o.castShadow = !(o.material && o.material.transparent); o.receiveShadow = true } })
  hold.add(body)
  root.add(hold)
  root.updateMatrixWorld(true)
  // landing gear: legs + light retract up into the belly (scale about the belly line)
  var gear = new lt.Group()
  gear.position.set(0, -1.7, 0)
  hold.add(gear)
  root.updateMatrixWorld(true)
  ;['SU57-landingOn_6', 'SU57-landingOnLight_7'].forEach(function (n) { var o = body.getObjectByName(n); if (o) gear.attach(o) })
  var doors = body.getObjectByName('SU57-landingOff_5')
  if (doors) doors.visible = false
  // afterburner flames at the two nozzles
  var flames = []
  ;[-1, 1].forEach(function (sd) {
    var at = SXJ_suP(-73.8, -0.83, sd * 14.73)
    var f = new lt.Mesh(new lt.ConeGeometry(0.42, 3.2, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 1.6), M.burner)
    f.position.copy(at)
    var c = new lt.Mesh(new lt.ConeGeometry(0.24, 1.6, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.8), M.burnerCore)
    c.position.copy(at)
    f.scale.setScalar(0.82); c.scale.setScalar(0.82)
    f.renderOrder = c.renderOrder = 880
    root.add(f, c)
    flames.push(f, c)
  })
  // missiles: two under each wing
  var mg = SXJ_missileGeo(M, false)
  var rails = [[-35, -5.6, -33], [-35, -5.6, 33], [-42, -4.2, -46], [-42, -4.2, 46]].map(function (q) {
    var p = SXJ_suP(q[0], q[1], q[2]), mm = mg.clone()
    mm.position.copy(p)
    root.add(mm)
    return { mesh: mm, local: p.clone() }
  })
  var strobe = new lt.Mesh(new lt.SphereGeometry(0.07, 8, 6), M.strobe)
  strobe.position.copy(SXJ_suP(-80, 3.5, 0))
  root.add(strobe)
  var P = function (x, y, z) { var v = SXJ_suP(x, y, z); return [v.x, v.y, v.z] }
  return {
    su57: true,
    root: root, gear: gear, gearDoors: doors, flames: flames, rails: rails, strobe: strobe, missileMesh: mg,
    muzzle: SXJ_suP(55, 3, 9), pod: null,
    cockpit: SXJ_suP(71.6, 9.8, 0),
    shapes: [
      { a: P(105, 0, 0), b: P(-84, 0, 0), r: 1.1 },          // fuselage + nacelles
      { a: P(-40, -1, -66), b: P(-40, -1, 66), r: 0.7 },     // wings
      { a: P(10, 0, -24), b: P(10, 0, 24), r: 0.5 },         // leading-edge roots
      { a: P(-72, -1, -40), b: P(-72, -1, 40), r: 0.4 },     // stabilators
      { a: P(-62, 6, -18), b: P(-56, 20, -32), r: 0.45 },    // canted fins
      { a: P(-62, 6, 18), b: P(-56, 20, 32), r: 0.45 },
    ],
  }
}

// ------------------------------------------- HARROW / PETREL: GLB models
// Harrow: av-8b_harrier_ii.glb → assets/harrow.glb (0.4 MB). Petrel:
// jasdf_f-2a_low_poly_model.glb → assets/petrel.glb (0.2 MB, repainted
// charcoal, red markings kept, pilot + landing gear removed). Both GLBs: nose
// +Z, up +Y, metres. The Harrier's merged mesh was split into nozF / nozR (the
// front and rear swivel-nozzle pairs, each one lateral piece) and gear; its
// under-wing stores were removed (the game's own AGMs hang there instead).
var SXJ_GLB = {
  harrow: { asset: 'harrow', ready: false, failed: false, started: false, scene: null },
  petrel: { asset: 'petrel', ready: false, failed: false, started: false, scene: null },
}
function SXJ_glbStart(key) {
  var L = SXJ_GLB[key]
  if (!L || L.started) return
  L.started = true
  var b64 = typeof SX_ASSET_harrow !== 'undefined' && key === 'harrow' ? SX_ASSET_harrow : typeof SX_ASSET_petrel !== 'undefined' && key === 'petrel' ? SX_ASSET_petrel : null
  if (typeof b64 !== 'string' || typeof SX_parseGLB !== 'function') { L.failed = true; return }
  SX_parseGLB(b64).then(function (g) { L.scene = g.scene; L.ready = true }, function (e) { L.failed = true; console.warn('[jets] ' + key + ' model failed, procedural one stays', e) })
}
// GLB → game frame: turned 180° (nose -Z), scaled, origin where the game wants it
var SXJ_HVT = { s: 0.95, oz: 0.3 }
SXJ_HVT.oy = -1.5 - 0.02 * SXJ_HVT.s // wheels on the ground (Harrow gearH 1.5)
var SXJ_PET = { s: 0.9, cy: 2.0, cz: -0.2 } // fuselage axis on the origin
function SXJ_hvP(x, y, z) { var T = SXJ_HVT; return new lt.Vector3(-x * T.s, y * T.s + T.oy, -z * T.s + T.oz) }
function SXJ_peP(x, y, z) { var T = SXJ_PET; return new lt.Vector3(-x * T.s, (y - T.cy) * T.s, -(z - T.cz) * T.s) }
function SXJ_glbHold(key, s, oy, oz) {
  var hold = new lt.Group()
  hold.rotation.y = Math.PI
  hold.scale.setScalar(s)
  hold.position.set(0, oy, oz)
  var body = SXJ_GLB[key].scene.clone(true)
  body.traverse(function (o) { if (o.isMesh) { o.castShadow = !(o.material && o.material.transparent); o.receiveShadow = true } })
  hold.add(body)
  return { hold: hold, body: body }
}
function SXJ_harrierModel(G) {
  var M = SXJ_mats(G), T = SXJ_HVT
  var root = new lt.Group()
  root.name = 'harrow'
  var h = SXJ_glbHold('harrow', T.s, T.oy, 0), body = h.body
  h.hold.position.z = T.oz
  root.add(h.hold)
  root.updateMatrixWorld(true)
  // swivel nozzles: each pair turns about its own lateral axis; 0 = aft
  // (wing-borne), +1.45 rad = straight down (hover)
  var nozzles = [], box = new lt.Box3(), c = new lt.Vector3(), sz = new lt.Vector3()
  ;['nozF', 'nozR'].forEach(function (n) {
    var o = body.getObjectByName(n)
    if (!o) return
    box.setFromObject(o); box.getCenter(c); box.getSize(sz)
    var piv = new lt.Group()
    piv.position.copy(c)
    root.add(piv)
    root.updateMatrixWorld(true)
    piv.attach(o)
    var fl = []
    ;[-1, 1].forEach(function (sd) {
      var f = new lt.Mesh(new lt.ConeGeometry(0.22, 1.7, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.85), M.burner)
      f.position.set(sd * (sz.x / 2 - 0.16), -0.02, sz.z * 0.42)
      f.renderOrder = 880
      piv.add(f)
      fl.push(f)
    })
    piv.userData = { aft: true, flames: fl }
    nozzles.push(piv)
  })
  // landing gear: retracts up into the belly
  var gear = new lt.Group()
  gear.position.copy(SXJ_hvP(0, 1.05, 0))
  root.add(gear)
  root.updateMatrixWorld(true)
  var go = body.getObjectByName('gear')
  if (go) gear.attach(go)
  // air-to-ground missiles: two per pylon, inner + outer station each side
  var mg = SXJ_missileGeo(M, true)
  var rails = [], PB = new io()
  ;[-1, 1].forEach(function (sd) {
    ;[1.92, 3.2].forEach(function (x) {
      var top = SXJ_hvP(sd * x, 1.62, -0.2), bot = SXJ_hvP(sd * x, 1.2, -0.2)
      PB.add(M.dark, Ee(top.x - 0.05, bot.y, top.z - 0.75, top.x + 0.05, top.y, top.z + 0.75, 0.02))
      ;[-0.22, 0.22].forEach(function (o) {
        var p = SXJ_hvP(sd * x + o, 1.02, -0.2), mm = mg.clone()
        mm.position.copy(p)
        root.add(mm)
        rails.push({ mesh: mm, local: p.clone() })
      })
    })
  })
  root.add(PB.build({ cast: true, recv: true }))
  var strobe = new lt.Mesh(new lt.SphereGeometry(0.07, 8, 6), M.strobe)
  strobe.position.copy(SXJ_hvP(0, 3.75, -6.1))
  root.add(strobe)
  var P = function (x, y, z) { var v = SXJ_hvP(x, y, z); return [v.x, v.y, v.z] }
  return {
    glb: true,
    root: root, gear: gear, nozzles: nozzles, rails: rails, strobe: strobe, missileMesh: mg,
    muzzle: SXJ_hvP(-0.5, 0.85, 2.6), pod: SXJ_hvP(0, 0.45, 5.2),
    cockpit: SXJ_hvP(0, 2.65, 4.3),
    shapes: [
      { a: P(0, 1.75, 7.2), b: P(0, 1.9, -6.9), r: 1.1 },        // fuselage
      { a: P(-4.5, 1.65, -0.7), b: P(4.5, 1.65, -0.7), r: 0.75 }, // wings
      { a: P(0, 2.4, -5.0), b: P(0, 3.6, -6.4), r: 0.6 },        // fin
      { a: P(-2.6, 1.6, -5.6), b: P(2.6, 1.6, -5.6), r: 0.4 },   // tailplane
    ],
  }
}
function SXJ_f2Model(G) {
  var M = SXJ_mats(G), T = SXJ_PET
  var root = new lt.Group()
  root.name = 'petrel'
  var h = SXJ_glbHold('petrel', T.s, -T.cy * T.s, T.cz * T.s)
  root.add(h.hold)
  // no pilot: a red sensor eye glows in the cockpit (its weak point)
  var eye = new lt.Mesh(new lt.SphereGeometry(0.2, 14, 10), M.eye)
  eye.position.copy(SXJ_peP(0, 2.45, 3.55))
  root.add(eye)
  var flame = new lt.Mesh(new lt.ConeGeometry(0.5, 3.6, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 1.8), M.burner)
  flame.position.copy(SXJ_peP(0, 1.93, -7.55))
  flame.renderOrder = 880
  root.add(flame)
  var strobe = new lt.Mesh(new lt.SphereGeometry(0.08, 8, 6), M.navRed)
  strobe.position.copy(SXJ_peP(0, 5.15, -7.7))
  root.add(strobe)
  var P = function (x, y, z) { var v = SXJ_peP(x, y, z); return [v.x, v.y, v.z] }
  var E = SXJ_peP(0, 2.45, 3.55), N = SXJ_peP(0, 1.93, -7.2)
  return {
    glb: true,
    root: root, eye: eye, flame: flame, strobe: strobe,
    muzzle: SXJ_peP(-0.8, 2.15, 4.2),
    shapes: [
      { a: P(0, 2.0, 7.6), b: P(0, 1.95, -7.4), r: 1.0 },       // fuselage
      { a: P(-5.6, 1.9, -2.0), b: P(5.6, 1.9, -2.0), r: 0.7 },  // wings
      { a: P(0, 2.8, -5.2), b: P(0, 5.0, -7.4), r: 0.5 },       // fin
      { c: [E.x, E.y, E.z], r: 0.36, part: 'weak' },
      { c: [N.x, N.y, N.z], r: 0.7, part: 'weak' },
    ],
  }
}

function SXJ_harrowModel(G) {
  var M = SXJ_mats(G)
  var root = new lt.Group()
  root.name = 'harrow'
  var B = new io()
  // stocky fuselage, sand over grey
  B.add(M.tan, SXJ_loft([
    [-6.6, -0.05, 0.05, 0.05, 0.5], [-5.9, -0.08, 0.34, 0.34, 0.45], [-4.6, 0.0, 0.62, 0.62, 0.38], [-2.6, 0.08, 0.86, 0.84, 0.34],
    [0.0, 0.1, 1.0, 0.92, 0.32], [2.6, 0.12, 0.84, 0.78, 0.34], [4.8, 0.3, 0.52, 0.5, 0.38], [6.4, 0.42, 0.3, 0.3, 0.42],
  ]))
  B.add(M.grey, SXJ_loft([[-6.65, -0.05, 0.06, 0.06, 0.5], [-6.0, -0.07, 0.3, 0.3, 0.45]]))
  // canopy
  B.add(M.glass, SXJ_loft([[-4.7, 0.5, 0.14, 0.05, 0.4], [-4.0, 0.82, 0.42, 0.26, 0.45], [-3.0, 0.98, 0.46, 0.3, 0.45], [-2.0, 0.92, 0.4, 0.2, 0.45], [-1.4, 0.8, 0.2, 0.05, 0.45]]))
  B.add(M.black, Ee(-0.34, 0.4, -3.4, 0.34, 1.08, -3.0, 0.06))
  // big side intakes
  ;[-1, 1].forEach(function (s) {
    B.add(M.tan, SXJ_loft([[-2.8, 0.18, 0.42, 0.62, 0.32], [0.6, 0.14, 0.5, 0.7, 0.3]], s * 1.15))
    B.add(M.black, Ee(s * 1.15 - 0.36, -0.4, -2.86, s * 1.15 + 0.36, 0.76, -2.74))
  })
  // shoulder wing with anhedral, tips + pylons
  ;[-1, 1].forEach(function (s) {
    var w = SXJ_wing([[s * 0.8, -0.6], [s * 4.9, 1.6], [s * 4.9, 2.5], [s * 0.8, 2.9]], 0.18, 0)
    w.rotateZ(s * 0.12).translate(0, 0.85, 0)
    B.add(M.tan, w)
    var tip = SXJ_wing([[s * 4.5, 1.4], [s * 4.95, 1.62], [s * 4.95, 2.5], [s * 4.5, 2.6]], 0.19, 0)
    tip.rotateZ(s * 0.12).translate(0, 0.85, 0)
    B.add(M.red, tip)
    B.add(M.tan, SXJ_wing([[s * 0.4, 4.6], [s * 2.6, 5.6], [s * 2.6, 6.2], [s * 0.4, 6.1]], 0.1, 0.42))
    ;[2.0, 3.4].forEach(function (x) {
      var yy = 0.85 - x * 0.12 - 0.1
      B.add(M.dark, Ee(s * x - 0.05, yy - 0.42, 0.6, s * x + 0.05, yy, 2.0, 0.02))
    })
  })
  // tail fin
  B.add(M.tan, SXJ_plate([[3.8, 0.6], [6.2, 0.6], [7.0, 3.0], [6.0, 3.05]], 0.14, 0))
  B.add(M.red, SXJ_plate([[6.55, 2.55], [6.9, 2.58], [7.0, 3.0], [6.65, 3.02]], 0.15, 0))
  // targeting pod under the nose
  B.add(M.dark, new lt.SphereGeometry(0.34, 16, 12).translate(0, -0.78, -4.3))
  B.add(M.lens, new lt.CircleGeometry(0.15, 14).translate(0, -0.78, -4.66))
  B.add(M.navRed, new lt.SphereGeometry(0.06, 8, 6).translate(-5.0, 0.32, 2.0))
  B.add(M.navGreen, new lt.SphereGeometry(0.06, 8, 6).translate(5.0, 0.32, 2.0))
  root.add(B.build({ cast: true, recv: true }))
  // four swivelling nozzles
  var nozzles = []
  ;[[-1.12, -1.1], [1.12, -1.1], [-1.12, 1.4], [1.12, 1.4]].forEach(function (p) {
    var g = new lt.Group()
    g.position.set(p[0], -0.25, p[1])
    var NB = new io()
    NB.add(M.gun, xt(0.36, 0.42, 0.9, 'y', 0, -0.45, 0, 14))
    NB.add(M.black, xt(0.32, 0.32, 0.04, 'y', 0, -0.92, 0, 12))
    g.add(NB.build({ cast: true, recv: true }))
    var fl = new lt.Mesh(new lt.ConeGeometry(0.3, 2.0, 12, 1, true).translate(0, -1.0, 0).rotateX(Math.PI), M.burner)
    fl.position.y = -0.95
    fl.renderOrder = 880
    g.add(fl)
    g.userData.flame = fl
    root.add(g)
    nozzles.push(g)
  })
  // bicycle gear + outriggers
  var gear = new lt.Group()
  var GB = new io()
  ;[[0, -3.6, 0.36], [0, 2.4, 0.42], [-4.3, 1.9, 0.18], [4.3, 1.9, 0.18]].forEach(function (g) {
    var top = Math.abs(g[0]) > 1 ? 0.55 : -0.5
    GB.add(M.dark, Ke([g[0], top, g[1]], [g[0], -1.2, g[1]], 0.08, 8))
    GB.add(M.rubber, xt(g[2], g[2], 0.26, 'x', g[0], -1.5 + g[2], g[1], 14))
  })
  gear.add(GB.build({ cast: true, recv: true }))
  root.add(gear)
  // air-to-ground missiles, two per pylon
  var mg = SXJ_missileGeo(M, true)
  var rails = []
  ;[-1, 1].forEach(function (s) {
    ;[2.0, 3.4].forEach(function (x) {
      var yy = 0.85 - x * 0.12 - 0.62
      ;[-0.24, 0.24].forEach(function (o) {
        var mm = mg.clone()
        mm.position.set(s * x + o, yy, 1.3)
        root.add(mm)
        rails.push({ mesh: mm, local: mm.position.clone() })
      })
    })
  })
  var strobe = new lt.Mesh(new lt.SphereGeometry(0.07, 8, 6), M.strobe)
  strobe.position.set(0, 3.1, 6.6)
  root.add(strobe)
  return {
    root: root, gear: gear, nozzles: nozzles, rails: rails, strobe: strobe, missileMesh: mg,
    muzzle: new lt.Vector3(0, -0.55, -5.2), pod: new lt.Vector3(0, -1.05, -4.3),
    cockpit: new lt.Vector3(0, 1.0, -3.2),
    shapes: [
      { a: [0, 0.05, -6.2], b: [0, 0.2, 6.0], r: 1.1 },
      { a: [-4.6, 0.4, 1.4], b: [4.6, 0.4, 1.4], r: 0.75 },
      { a: [0, 0.8, 4.6], b: [0, 2.7, 6.5], r: 0.6 },
    ],
  }
}

function SXJ_petrelModel(G) {
  var M = SXJ_mats(G)
  var root = new lt.Group()
  root.name = 'petrel'
  var B = new io()
  B.add(M.hull, SXJ_loft([
    [-7.0, 0.0, 0.05, 0.05, 0.5], [-6.0, 0.0, 0.42, 0.3, 0.45], [-4.0, 0.05, 0.78, 0.55, 0.36], [-1.0, 0.08, 1.05, 0.66, 0.32],
    [2.6, 0.1, 1.0, 0.62, 0.32], [5.4, 0.12, 0.78, 0.56, 0.36], [6.6, 0.12, 0.7, 0.5, 0.4],
  ]))
  B.add(M.red, SXJ_loft([[-3.2, 0.06, 0.8, 0.58, 0.36], [-2.8, 0.07, 0.84, 0.6, 0.36]]))
  B.add(M.hazard, SXJ_loft([[3.6, 0.11, 0.92, 0.6, 0.33], [4.1, 0.115, 0.9, 0.59, 0.33]]))
  // sensor head instead of a canopy
  B.add(M.dark, SXJ_loft([[-4.6, 0.5, 0.2, 0.08, 0.4], [-3.8, 0.7, 0.36, 0.16, 0.45], [-2.6, 0.66, 0.3, 0.12, 0.45]]))
  ;[-1, 1].forEach(function (s) {
    // forward-swept wings, canards, ventral fins
    B.add(M.hull, SXJ_wing([[s * 0.9, 1.6], [s * 5.6, -0.6], [s * 5.6, 0.4], [s * 0.9, 4.2]], 0.16, -0.08))
    B.add(M.red, SXJ_wing([[s * 5.1, -0.38], [s * 5.62, -0.62], [s * 5.62, 0.42], [s * 5.1, 0.62]], 0.17, -0.085))
    B.add(M.hull, SXJ_wing([[s * 0.8, -4.0], [s * 2.4, -3.3], [s * 2.4, -2.9], [s * 0.8, -2.9]], 0.08, 0.15))
    var fin = SXJ_plate([[3.8, 0.4], [6.2, 0.4], [6.9, 2.6], [6.0, 2.6]], 0.12, 0)
    fin.rotateZ(-s * 0.42).translate(s * 0.8, 0, 0)
    B.add(M.hull, fin)
  })
  B.add(M.gun, xt(0.8, 0.66, 1.1, 'z', 0, 0.12, 7.0, 18))
  B.add(M.black, xt(0.64, 0.64, 0.05, 'z', 0, 0.12, 7.56, 16))
  B.add(M.gun, xt(0.1, 0.1, 1.2, 'z', 0, -0.42, -5.2, 8))
  root.add(B.build({ cast: true, recv: true }))
  var eye = new lt.Mesh(new lt.SphereGeometry(0.22, 14, 10), M.eye)
  eye.position.set(0, 0.62, -4.2)
  root.add(eye)
  var flame = new lt.Mesh(new lt.ConeGeometry(0.6, 3.6, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 1.8), M.burner)
  flame.position.set(0, 0.12, 7.56)
  flame.renderOrder = 880
  root.add(flame)
  var strobe = new lt.Mesh(new lt.SphereGeometry(0.08, 8, 6), M.navRed)
  strobe.position.set(0, 2.4, 6.4)
  root.add(strobe)
  return {
    root: root, eye: eye, flame: flame, strobe: strobe,
    muzzle: new lt.Vector3(0, -0.42, -5.9),
    shapes: [
      { a: [0, 0.05, -6.6], b: [0, 0.1, 6.6], r: 1.0 },
      { a: [-5.2, -0.05, 0.6], b: [5.2, -0.05, 0.6], r: 0.7 },
      { c: [0, 0.62, -4.2], r: 0.36, part: 'weak' },
      { c: [0, 0.12, 6.9], r: 0.7, part: 'weak' },
    ],
  }
}

/* ======================================================= ALLY JET CORE === */

function SXJ_makeJet(G, U, opts, kind) {
  var T = SXJ_TUNE[kind]
  var V3 = lt.Vector3, Q = lt.Quaternion
  if (kind === 'talon') SXJ_suStart(); else SXJ_glbStart('harrow')
  var m = kind === 'talon' ? (SXJ_SU.ready ? SXJ_su57Model(G) : SXJ_talonModel(G)) : (SXJ_GLB.harrow.ready ? SXJ_harrierModel(G) : SXJ_harrowModel(G))
  G.scene.add(m.root)
  var UP = new V3(0, 1, 0)
  var tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), aim = new V3(), fwdV = new V3(), upV = new V3(), rightV = new V3()
  var pos = opts.pos ? opts.pos.clone() : new V3()
  var q = new Q().setFromAxisAngle(UP, opts.yaw || 0)
  var vel = new V3(), w = new V3()
  pos.y = U.groundAt(pos.x, pos.z, pos.y + 3) + T.gearH
  var engine = null, missiles = [], wreckFire = null
  var st = {
    landed: true, throttle: 0, ab: false, hover: !!T.vtol, nozzle: T.vtol ? 1 : 0, piloted: false,
    heat: 0, overheat: false, gunCd: 0, ammo: T.agm || T.aam, reloadT: 0, fireCd: 0, rail: 0,
    scope: false, desig: null, desigObj: null, lockT: 0, lockTgt: null, locked: false, beepT: 0,
    adsPrev: false, crash: null, warnT: 0, strobeT: 0, smokeT: 0, dustT: 0, gearOut: 1, leaveMsgT: 0,
  }
  var ctl = { dx: 0, dy: 0, dt: 0.016, fwd: 0, side: 0, up: 0, boost: false }

  var u = {
    _missiles: missiles,
    type: kind, label: T.label, faction: 'ally', vehicle: true, alive: true,
    hp: T.hp, maxHp: T.hp, radius: T.radius, armor: T.armor, enterRadius: 4.6,
    pos: pos, vel: vel, q: q, st: st,
    solid: kind === 'talon' ? { r: 4.2, h: 2.4, m: 10, air: true } : { r: 4.6, h: 3, m: 14, air: true },
  }
  Object.defineProperty(u, 'yaw', { get: heading })

  function frame() {
    fwdV.set(0, 0, -1).applyQuaternion(q)
    upV.set(0, 1, 0).applyQuaternion(q)
    rightV.set(1, 0, 0).applyQuaternion(q)
  }
  function heading() { frame(); return Math.atan2(-fwdV.x, -fwdV.z) }
  function toWorld(local, out) { m.root.updateMatrixWorld(); return out.copy(local).applyMatrix4(m.root.matrixWorld) }
  function groundY(x, z) { return U.groundAt(x, z, pos.y + 1) }
  function altitude() { return pos.y - T.gearH - groundY(pos.x, pos.z) }
  // mouse aim: U.look is a free direction the jet steers toward when wing-borne
  function aimDir(out) {
    var cp = Math.cos(U.look.pitch)
    return out.set(-Math.sin(U.look.yaw) * cp, Math.sin(U.look.pitch), -Math.cos(U.look.yaw) * cp)
  }
  function aimFly() { return st.piloted && !st.hover && !st.landed }
  function levelTo(h, pitch) {
    q.setFromEuler(new lt.Euler(pitch || 0, h, 0, 'YXZ'))
  }

  u.center = function (out) { return (out || new V3()).copy(pos) }
  u.raycast = function (o, d, max) { return SXJ_hitShapes(m.root, m.shapes, o, d, max) }
  u.anchor = function (out) { return out.copy(pos).setY(pos.y - 1.0) }
  u.enterPoint = function (out) {
    frame()
    var c = toWorld(m.cockpit, tmp3)
    return out.copy(c).addScaledVector(rightV, -3.2).setY(groundY(c.x, c.z))
  }
  u.exitPoint = function (out) {
    frame()
    var c = toWorld(m.cockpit, tmp3)
    out.copy(c).addScaledVector(rightV, -5.6)
    if (G.physics.raycast(tmp2.copy(pos).setY(pos.y - 0.5), tmp.copy(out).setY(pos.y - 0.5).sub(tmp2).normalize(), 6)) out.copy(c).addScaledVector(rightV, 5.6)
    return out
  }
  u.canLeave = function () {
    var ok = (st.landed && vel.length() < 4) || (st.hover && altitude() < 3.5 && vel.length() < 5)
    if (!ok && st.leaveMsgT <= 0) {
      st.leaveMsgT = 1.5
      var h = U.hud()
      h && h.message(T.vtol ? 'Hover low (under 3 m) or land to leave the ' + T.label : 'Land and stop to leave the ' + T.label, 1.6)
    }
    return ok
  }
  u.onEnter = function () {
    st.piloted = true
    U.look.yaw = heading()
    U.look.pitch = -0.1
    camInit = false
  }
  u.onExit = function () {
    st.piloted = false
    st.scope = false
    ctl.fwd = ctl.side = ctl.up = 0
    ctl.boost = false
    setScope(false)
    showAim(false)
    showLock(null)
  }

  /* -------------------------------------------------------- weapons ---- */
  function fireGun() {
    var mz = toWorld(m.muzzle, new V3())
    frame()
    var d = tmp.copy(aim).sub(mz).normalize()
    // keep the gun near the nose (it is fixed / turret-limited)
    if (d.dot(fwdV) < 0.985) d.lerp(fwdV, 0.7).normalize()
    var sp = T.gunSpread
    d.x += (Math.random() - 0.5) * sp * 2; d.y += (Math.random() - 0.5) * sp * 2; d.z += (Math.random() - 0.5) * sp * 2
    d.normalize()
    U.shoot(mz, d, { damage: T.gunDmg, range: T.gunRange, tracerFrom: mz.clone() })
    st.gunN = (st.gunN || 0) + 1
    if (st.gunN % 2 === 0) G.events.emit('weapon:fire', { origin: mz.clone(), dir: d.clone(), muzzle: mz.clone(), ads: 0, pitch: kind === 'talon' ? 1.45 : 1.1, gain: 0.8, weapon: kind })
    try { G.render.lightPool.flash(mz, 16756832, 55, 8, 0.04) } catch (e) { }
    st.heat = Math.min(1, st.heat + T.heat)
    if (st.heat >= 1) { st.overheat = true; U.sound('rifle_dry', { gain: 0.8, pitch: 0.6 }) }
  }

  function railReady() { return m.rails.filter(function (r) { return r.mesh.visible }) }
  function launch(target, targetObj) {
    var ready = railReady()
    if (!ready.length) return false
    var rail = ready[st.rail++ % ready.length]
    rail.mesh.visible = false
    var p = toWorld(rail.local, new V3())
    frame()
    var mesh = m.missileMesh.clone()
    mesh.visible = true
    mesh.position.copy(p)
    mesh.quaternion.copy(q)
    var fl = new lt.Mesh(new lt.SphereGeometry(0.16, 8, 6).scale(1, 1, 2.6), SXJ_mats(G).burnerCore)
    fl.position.z = 1.7
    mesh.add(fl)
    G.scene.add(mesh)
    var aamMode = kind === 'talon'
    var ms = {
      mesh: mesh, pos: p, dir: fwdV.clone(), speed: Math.max(20, vel.length()), vel: vel.clone().addScaledVector(upV, -4), t: 0, smokeT: 0,
      target: target ? target.clone() : null, obj: targetObj || null, air: aamMode, top: vel.length() + 140,
    }
    missiles.push(ms)
    st.ammo = railReady().length
    U.sound('gull_fire', { pos: p, gain: 1, pitch: aamMode ? 0.7 : 0.5 })
    U.sound('explosion', { pos: p, gain: 0.22, pitch: 2.4 })
    G.events.emit('weapon:fire', { origin: p.clone(), dir: fwdV.clone(), muzzle: p.clone(), ads: 0, pitch: 0.5, gain: 0.25, weapon: kind + '-missile' })
    return true
  }
  function objPos(o, out) {
    if (!o) return null
    if (o.center) return o.center(out)
    return out.copy(o.pos).setY(o.pos.y + (o.type === 'hound' ? 0.6 : 0))
  }
  function updateMissiles(dt) {
    for (var k = missiles.length - 1; k >= 0; k--) {
      var ms = missiles[k]
      ms.t += dt
      var boom = null
      if (ms.t < 0.28) {
        // drop clear of the jet, then the motor lights
        ms.vel.y -= 9.8 * dt
        ms.pos.addScaledVector(ms.vel, dt)
      } else {
        ms.speed = Math.min(ms.air ? Math.max(T.aamSpeed, ms.top || 0) : T.agmSpeed, ms.speed + (ms.air ? 200 : 140) * dt)
        var tp = ms.obj && ms.obj.alive !== false ? objPos(ms.obj, tmp2) : ms.target
        var step = ms.speed * dt
        if (tp) {
          var dist = tp.distanceTo(ms.pos)
          // lead the target (air-to-air: aim where it will be)
          var want = tmp.copy(tp)
          if (ms.air && ms.obj && ms.obj.vel) want.addScaledVector(ms.obj.vel, Math.min(2.5, dist / Math.max(60, ms.speed)) * 0.85)
          want.sub(ms.pos).normalize()
          var ang = Math.acos(SXJ_clamp(ms.dir.dot(want), -1, 1))
          var maxA = (ms.air ? T.aamTurn : T.agmTurn) * dt
          if (ang > 1e-4) ms.dir.lerp(want, Math.min(1, maxA / ang)).normalize()
          // proximity fuse over this frame's whole path (fast closure skips a point test)
          var along = SXJ_clamp(tmp3.copy(tp).sub(ms.pos).dot(ms.dir), 0, step)
          var near = tmp3.copy(ms.pos).addScaledVector(ms.dir, along)
          if (near.distanceTo(tp) < (ms.air ? T.aamFuse : 2.5)) boom = near.clone()
        }
        var h = boom ? null : U.cast(ms.pos, ms.dir, step + 0.6, 'enemy')
        if (h && !(h.enemy && h.enemy.type === 'missile' && !ms.air)) boom = h.point.clone()
        if (!boom) ms.pos.addScaledVector(ms.dir, step)
        if (ms.t > 14) boom = ms.pos.clone()
      }
      if (boom) {
        var dmg = ms.air ? T.aamDmg : T.agmDmg, rad = ms.air ? T.aamR : T.agmR
        if (ms.air && ms.obj && ms.obj.alive && ms.obj.damage) {
          // proximity warhead: most of it lands on the target itself
          var killed = ms.obj.damage(dmg * 0.6, boom.clone(), ms.dir.clone(), 'body', 'ally') === true
          G.events.emit('player:hitEnemy', { enemy: ms.obj, part: 'body', killed: killed, weak: false, explosive: true })
        }
        U.blast(boom.addScaledVector(ms.dir, -0.3), rad, ms.air ? dmg * 0.5 : dmg, 'ally', { size: ms.air ? 1.2 : 1.7, selfScale: st.piloted ? 0 : 0.5 })
        if (!ms.air && G.fx && G.fx.debris) G.fx.debris(boom.clone(), { count: 18, speed: 10, size: 0.1 })
        G.scene.remove(ms.mesh)
        missiles.splice(k, 1)
        continue
      }
      ms.mesh.position.copy(ms.pos)
      ms.mesh.quaternion.setFromUnitVectors(tmp3.set(0, 0, -1), ms.t < 0.28 ? fwdV : ms.dir)
      ms.smokeT -= dt
      if (ms.t > 0.28 && ms.smokeT <= 0 && G.fx && G.fx.smoke) {
        ms.smokeT = 0.03
        G.fx.smoke(tmp3.copy(ms.pos).addScaledVector(ms.dir, -1.6), { size: 0.45, life: 2.2, rise: 0.1, count: 1, alpha: 0.26, color: 0xb0aba2 })
      }
    }
  }

  // Talon: heat-seeker lock on air targets inside a cone ahead
  function lockCandidates() {
    var list = []
    U.list.forEach(function (o) { if (o.alive && o.faction === 'enemy' && U.solidOf(o).air) list.push(o) })
    ;(G.enemies && G.enemies.list || []).forEach(function (e) { if (e.alive && e.type === 'gull') list.push(e) })
    return list
  }
  // Outside the sight the diamond only marks the target nearest the nose; the
  // RMB sight locks what sits inside its circle (cone around the aim).
  var lockAxis = new V3()
  function updateLock(dt) {
    frame()
    var sight = st.scope && !T.agm
    if (sight) aimDir(lockAxis); else lockAxis.copy(fwdV)
    var cone = sight ? T.scopeCone : T.lockCone, range = sight ? T.scopeRange : T.lockRange
    var best = null, bestA = cone
    lockCandidates().forEach(function (o) {
      var c = objPos(o, tmp2)
      var d = tmp.copy(c).sub(pos), dist = d.length()
      if (dist > range || dist < 20) return
      d.divideScalar(dist)
      var a = Math.acos(SXJ_clamp(d.dot(lockAxis), -1, 1))
      if (a < bestA && G.physics.lineOfSight(pos, c)) { bestA = a; best = o }
    })
    if (best && best === st.lockTgt && sight) st.lockT += dt
    else if (best !== st.lockTgt || !sight) { st.lockTgt = best; st.lockT = 0 }
    var was = st.locked
    st.locked = sight && !!best && st.lockT >= T.scopeLockTime
    if (st.piloted && best && sight) {
      st.beepT -= dt
      if (st.beepT <= 0) {
        st.beepT = st.locked ? 0.09 : 0.32
        U.sound('ui_click', { gain: st.locked ? 0.45 : 0.3, pitch: st.locked ? 2.8 : 2.1 })
      }
      if (st.locked && !was) { var h = U.hud(); h && h.message('LOCK — ' + (best.label || best.type || 'target').toUpperCase(), 1) }
    }
    showLock(st.piloted ? best : null)
  }

  /* -------------------------------------------------------- piloting --- */
  u.drive = function (dt, inp, U2) {
    st.leaveMsgT -= dt
    ctl.dt = dt
    ctl.dx = inp.look ? inp.look.dx : 0
    ctl.dy = inp.look ? inp.look.dy : 0
    ctl.fwd = inp.move ? inp.move.y : 0
    ctl.side = inp.move ? inp.move.x : 0
    ctl.up = (inp.down && inp.down('jump') ? 1 : 0) - (inp.down && inp.down('crouch') ? 1 : 0)
    ctl.boost = !!inp.sprint
    if (G.input && G.input.touch && ctl.up === 0 && st.hover && ctl.fwd < -0.75) ctl.up = -1
    // throttle (wing-borne): W/S move it, it stays where you leave it
    if (!st.hover) st.throttle = SXJ_clamp(st.throttle + ctl.fwd * 0.6 * dt, 0, 1)
    st.ab = ctl.boost && !st.hover
    // hold right mouse: the Harrow's targeting pod, the Talon's missile sight
    // (airborne only)
    var wasScope = st.scope
    st.scope = !!inp.ads && st.alive !== false && (!!T.agm || (!st.landed && !st.hover))
    if (st.scope && !wasScope && T.agm) {
      // start looking where the nose/camera looks
      var cf = tmp.set(0, 0, -1).applyQuaternion(G.camera.quaternion)
      U.look.yaw = Math.atan2(-cf.x, -cf.z)
      U.look.pitch = SXJ_clamp(Math.asin(SXJ_clamp(cf.y, -1, 1)), -1.15, 0.3)
    } else if (st.scope) {
      // zoomed: slow the look down to the field of view
      var lk = G.player.lookScale || 1, kz = T.scopeFov / 70
      U.look.yaw += ctl.dx * lk * (1 - kz)
      U.look.pitch = SXJ_clamp(U.look.pitch + ctl.dy * lk * (1 - kz), T.agm ? -1.2 : -1.1, T.agm ? 0.35 : 1.0)
    }
    frame()
    var fwdPitch = Math.asin(SXJ_clamp(fwdV.y, -1, 1))
    if (!st.scope && wasScope && T.agm) {
      // pod closed: aim back along the nose, not where the pod was looking
      U.look.yaw = heading()
      U.look.pitch = SXJ_clamp(fwdPitch, -1.1, 1.0)
    }
    if (!st.hover && st.landed) {
      // on the wheels: the look follows the nose (mouse up rotates at speed)
      U.look.yaw = heading()
      U.look.pitch = SXJ_clamp(fwdPitch, -1.1, 1.0) - 0.08
      st.aimInit = false
    } else if (aimFly() && !st.aimInit) {
      // just airborne / left the hover: start the aim along the nose
      st.aimInit = true
      U.look.yaw = heading()
      U.look.pitch = SXJ_clamp(Math.max(fwdPitch + 0.1, 0.3), -1.1, 1.0)
    }
    if (st.hover) st.aimInit = false
    // aerobatics: holding Space/C hands the stick back to you (pull/push past
    // vertical, loops); the aim rides on the nose meanwhile, and on release the
    // jet rolls upright and holds the heading it ended on
    var man = aimFly() && ctl.up !== 0
    if (man || st.manual) {
      frame()
      U.look.yaw = heading()
      U.look.pitch = Math.asin(SXJ_clamp(fwdV.y, -1, 1))
      if (!man) U.look.pitch = SXJ_clamp(U.look.pitch, -1.1, 1.0)
    }
    st.manual = man
    U.aimPoint(aim, 1800)
    // designation through the pod
    if (st.scope && wasScope) {
      var cd = tmp.set(0, 0, -1).applyQuaternion(G.camera.quaternion)
      var h = U.cast(G.camera.position, cd, 3000, 'enemy')
      st.desig = h ? h.point.clone() : null
      st.desigObj = h && (h.kind === 'unit' || h.kind === 'enemy') && h.enemy && h.enemy.type !== 'missile' ? h.enemy : null
    } else if (!st.scope) { st.desig = null; st.desigObj = null }
    // weapons
    st.gunCd -= dt
    st.fireCd -= dt
    if (inp.pressed && inp.pressed('reload') && st.reloadT <= 0 && railReady().length < m.rails.length) {
      st.reloadT = T.agm ? T.agmReload : T.aamReload
      U.sound('reload_magout', { gain: 0.8, pitch: 0.6 })
    }
    st.adsPrev = !!inp.ads
    if (st.scope && T.agm) {
      if (inp.fire && st.fireCd <= 0 && st.reloadT <= 0 && st.desig) {
        if (launch(st.desig, st.desigObj)) st.fireCd = 0.6
        else { U.sound('rifle_dry', { gain: 0.6, pitch: 0.7 }); st.fireCd = 0.5 }
      }
    } else if (st.scope) {
      // Talon sight: LMB sends a heat-seeker at the locked target
      if (inp.fire && st.fireCd <= 0) {
        var hm = U.hud()
        if (st.reloadT > 0 || !railReady().length) { U.sound('rifle_dry', { gain: 0.6, pitch: 0.7 }); st.fireCd = 0.5 }
        else if (st.locked && st.lockTgt && st.lockTgt.alive !== false) {
          if (launch(objPos(st.lockTgt, new V3()), st.lockTgt)) { st.fireCd = 0.7; st.shots = (st.shots || 0) + 1 }
        } else {
          U.sound('rifle_dry', { gain: 0.6, pitch: 0.7 })
          st.fireCd = 0.5
          hm && hm.message('No lock — hold the enemy jet inside the circle', 1.2)
        }
      }
    } else {
      if (inp.fire && !st.overheat) {
        while (st.gunCd <= 0) { fireGun(); st.gunCd += 1 / T.gunRate; if (st.overheat) break }
      } else if (st.gunCd < 0) st.gunCd = 0
    }
    if (railReady().length === 0 && st.reloadT <= 0 && !missiles.length) st.reloadT = T.agm ? T.agmReload : T.aamReload
  }

  /* -------------------------------------------------------- camera ----- */
  var camPos = new V3(), camQ = new Q(), camInit = false, wantQ = new Q(), eul = new lt.Euler(), chaseQ = new Q(), upC = new V3()
  u.camera = function (cam, dt, U2) {
    frame()
    var fov = 72
    if (st.scope) {
      var pp = toWorld(m.pod || m.cockpit, tmp)
      // the Talon's sight sits just ahead of the canopy so the nose never fills it
      if (!T.agm) pp.addScaledVector(upV, 1.1).addScaledVector(aimDir(tmp2), 6)
      cam.position.copy(pp)
      cam.quaternion.setFromEuler(eul.set(U.look.pitch, U.look.yaw, 0, 'YXZ'))
      fov = T.scopeFov
      camInit = false
      setScope(true, !!T.agm)
    } else {
      setScope(false)
      var want = tmp, look = tmp2
      if (st.hover || (st.landed && vel.length() < 8)) {
        // orbit, like the helicopter
        var dist = st.hover ? 19 : 21
        var dir = tmp3.set(-Math.sin(U.look.yaw) * Math.cos(U.look.pitch), Math.sin(U.look.pitch), -Math.cos(U.look.yaw) * Math.cos(U.look.pitch))
        look.copy(pos).setY(pos.y + 2.2)
        want.copy(look).addScaledVector(dir, -dist)
        wantQ.setFromEuler(eul.set(U.look.pitch, U.look.yaw, 0, 'YXZ'))
      } else if (aimFly() && !st.manual) {
        // mouse aim: the camera looks where you aim (horizon kept level), the
        // jet turns to follow; the gun fires along the nose (the small cross)
        var spd2 = vel.length(), ad = aimDir(tmp3)
        want.copy(pos).addScaledVector(ad, -(18 + spd2 * 0.03)).addScaledVector(UP, 4.2)
        look.copy(pos).addScaledVector(ad, 140)
        SXJ_m4.lookAt(want, look, UP)
        wantQ.setFromRotationMatrix(SXJ_m4)
        fov = 70 + Math.min(16, spd2 * 0.09) + (st.ab ? 4 : 0)
        st.chaseInit = false
      } else {
        // chase: behind and above in the jet's own frame, rolls with it
        var spd = vel.length()
        want.copy(pos).addScaledVector(fwdV, -(17 + spd * 0.035)).addScaledVector(upV, 3.6)
        look.copy(pos).addScaledVector(fwdV, 40).addScaledVector(upV, 1.5)
        // smoothed jet attitude drives the offset, so the camera never trails at speed
        if (!st.chaseInit) { chaseQ.copy(q); st.chaseInit = true }
        chaseQ.slerp(q, 1 - Math.exp(-6 * dt))
        var cf = tmp3.set(0, 0, -1).applyQuaternion(chaseQ), cu = upC.set(0, 1, 0).applyQuaternion(chaseQ)
        want.copy(pos).addScaledVector(cf, -(17 + spd * 0.03)).addScaledVector(cu, 3.6)
        look.copy(pos).addScaledVector(cf, 40).addScaledVector(cu, 1.5)
        SXJ_m4.lookAt(want, look, cu)
        wantQ.setFromRotationMatrix(SXJ_m4)
        fov = 70 + Math.min(16, spd * 0.09) + (st.ab ? 4 : 0)
      }
      if (st.hover || st.landed) st.chaseInit = false
      var chase = !(st.hover || (st.landed && vel.length() < 8))
      var gy = U.groundAt(want.x, want.z, want.y + 3) + 1.2
      if (want.y < gy) want.y = gy
      if (!camInit) { camPos.copy(want); camQ.copy(wantQ); camInit = true }
      camPos.lerp(want, 1 - Math.exp(-(chase ? 30 : 12) * dt))
      camQ.slerp(wantQ, 1 - Math.exp(-(chase ? 22 : 16) * dt))
      cam.position.copy(camPos)
      cam.quaternion.copy(camQ)
    }
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix() }
    if (st.scope && T.agm) updateScopeUi()
    else if (st.scope) updateSightUi(cam)
    if (aimFly() && !st.scope && !st.manual) updateAimUi(cam); else showAim(false)
  }

  u.hud = function () {
    var alt = Math.max(0, altitude())
    var spd = Math.round(vel.length() * 3.6)
    var lines = []
    if (st.hover) lines.push('VTOL HOVER  ALT ' + Math.round(alt) + ' M  ' + spd + ' KM/H')
    else lines.push(spd + ' KM/H  ALT ' + Math.round(alt) + ' M  THR ' + Math.round(st.throttle * 100) + '%' + (st.ab ? ' AB' : ''))
    lines.push(st.overheat ? 'CANNON  OVERHEAT' : 'CANNON  ' + Math.round(st.heat * 100) + '% HEAT')
    var n = railReady().length
    var wpn = kind === 'talon' ? 'AAM' : 'AGM'
    lines.push(st.reloadT > 0 ? wpn + '  RELOAD ' + st.reloadT.toFixed(1) + 'S' : wpn + '  ' + n + '/' + m.rails.length + (kind === 'talon' ? (st.scope ? (st.locked ? '  LOCKED · LMB FIRE' : st.lockTgt ? '  LOCKING' : '  SIGHT') : '  RMB SIGHT') : st.scope ? '  POD' : '  RMB POD'))
    if (st.landed && !st.hover && vel.length() < 5) lines.push(kind === 'talon' ? 'W THROTTLE · SPACE ROTATE AT ' + Math.round(T.vRot * 3.6) + ' KM/H' : 'SPACE LIFT')
    if (T.vtol && st.hover && !st.landed) lines.push('SHIFT  TRANSITION TO FLIGHT')
    return { hp: u.hp, maxHp: u.maxHp, lines: lines }
  }

  /* -------------------------------------------------------- damage ----- */
  u.damage = function (amount, point, dir, part, source) {
    if (!u.alive || !(amount > 0)) return false
    u.hp -= amount
    if (point && G.fx && G.fx.sparks && Math.random() < 0.5) G.fx.sparks(point, dir ? tmp.copy(dir).negate() : UP, 6)
    if (u.hp <= 0) { destroy(); return true }
    return false
  }
  function destroy() {
    if (!u.alive) return
    u.hp = 0
    u.alive = false
    st.crash = { t: 0, spin: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random()), done: false }
    U.killed(u)
    U.sound('explosion', { pos: pos, gain: 1, pitch: 1.1 })
    try { G.fx.explosion(pos.clone(), 1.2) } catch (e) { }
    setScope(false)
    showAim(false)
    showLock(null)
  }
  function wreck() {
    st.crash.done = true
    vel.set(0, 0, 0)
    w.set(0, 0, 0)
    try { G.fx.explosion(pos.clone(), 2.4) } catch (e) { }
    U.blast(pos.clone(), 9, 90, 'ally', { fx: false, selfScale: 0.2 })
    if (G.fx && G.fx.debris) G.fx.debris(pos.clone(), { count: 30, speed: 14, size: 0.14 })
    try { wreckFire = G.fx.addEmitter(pos.clone(), 'fire', { ttl: 35, scale: 1.4 }) } catch (e) { }
    var h = heading()
    pos.y = groundY(pos.x, pos.z) + 0.7
    q.setFromEuler(new lt.Euler(0.08, h, 0.4, 'YXZ'))
    m.flames && m.flames.forEach(function (f) { f.visible = false })
  }

  /* -------------------------------------------------------- flight ----- */
  var qd = new Q(), qInv = new Q()
  function rotateBody(dt) {
    var a = w.length() * dt
    if (a < 1e-7) return
    qd.setFromAxisAngle(tmp3.copy(w).normalize(), a)
    q.multiply(qd).normalize()
  }
  function edgeSteer(dt) {
    // soft map edge + ceiling: nose gently turned back in
    var A = SXJ_TUNE.arena, push = 0, dx = 0, dz = 0
    var ox = pos.x - A.x, oz = pos.z - A.z
    var lim = A.half - A.soft
    if (Math.abs(ox) > lim) { push = Math.max(push, (Math.abs(ox) - lim) / A.soft); dx = -Math.sign(ox) }
    if (Math.abs(oz) > lim) { push = Math.max(push, (Math.abs(oz) - lim) / A.soft); dz = -Math.sign(oz) }
    var dy = 0
    if (pos.y > SXJ_TUNE.ceiling - 30) { push = Math.max(push, (pos.y - (SXJ_TUNE.ceiling - 30)) / 30); dy = -0.6 }
    if (push <= 0) return
    var want = tmp3.set(dx, dy, dz)
    if (want.lengthSq() < 1e-6) return
    want.normalize()
    frame()
    var target = SXJ_lookQuat(want, 0, new Q())
    q.slerp(target, Math.min(1, push * 1.2 * dt))
    if (aimFly()) {
      // swing the mouse aim back in with the nose, or the two would fight
      var k = Math.min(1, push * 1.2 * dt)
      if (dx || dz) { var wy = Math.atan2(-want.x, -want.z), dy2 = Math.atan2(Math.sin(wy - U.look.yaw), Math.cos(wy - U.look.yaw)); U.look.yaw += dy2 * k }
      if (dy) U.look.pitch += (Math.min(U.look.pitch, -0.15) - U.look.pitch) * k
    }
    if (Math.abs(ox) > A.half) pos.x = A.x + Math.sign(ox) * A.half
    if (Math.abs(oz) > A.half) pos.z = A.z + Math.sign(oz) * A.half
    if (pos.y > SXJ_TUNE.ceiling + 20) { pos.y = SXJ_TUNE.ceiling + 20; if (vel.y > 0) vel.y = 0 }
    if (st.piloted && st.warnT <= 0) { st.warnT = 3; var h = U.hud(); h && h.message('Edge of the operating area — turning back', 1.8) }
  }

  function flyWingborne(dt) {
    frame()
    var s = vel.length()
    // control inputs: mouse = rate, Space/C = pull/push, A/D = roll
    var ddt = Math.max(ctl.dt, 1 / 240)
    var piloted = st.piloted
    var tP = piloted ? SXJ_clamp(-ctl.dy / ddt, -T.pitchRate, T.pitchRate) + ctl.up * T.pitchRate * 0.85 : 0
    var tY = piloted ? SXJ_clamp(-ctl.dx / ddt * 0.6, -T.yawRate * 2.2, T.yawRate * 2.2) : 0
    var tR = piloted ? -ctl.side * T.rollRate : 0
    // bank angle, + = right wing up (w.z > 0 lifts the right wing)
    var roll = Math.atan2(rightV.y, upV.y)
    if (st.scope && T.agm) {
      // pod in use: a simple autopilot holds wings level and the nose near the horizon
      tR = SXJ_clamp(-roll * 2.2, -T.rollRate, T.rollRate)
      tP = SXJ_clamp(-Math.asin(SXJ_clamp(fwdV.y, -1, 1)) * 1.6, -0.6, 0.6)
      tY = 0
    } else if (piloted && st.manual) {
      // Space/C held: direct stick, like the old controls (mouse = pitch/yaw rate, A/D roll)
      tP = ctl.up * T.pitchRate + SXJ_clamp(-ctl.dy / ddt, -T.pitchRate, T.pitchRate)
    } else if (piloted) {
      // mouse aim: steer the nose onto the aim direction. Far off the nose the
      // jet banks toward it and pulls (bank-and-pull), near it the wings level
      // and pitch/yaw trim the last degrees. A/D still rolls by hand.
      var la = aimDir(tmp3).applyQuaternion(qInv.copy(q).invert())
      var pe = Math.atan2(la.y, -la.z), ye = Math.atan2(la.x, -la.z)
      var off = Math.acos(SXJ_clamp(-la.z, -1, 1))
      var bank = Math.atan2(la.x, Math.max(la.y, 0) + 0.03)
      var wB = SXJ_clamp((off - 0.05) / 0.3, 0, 1)
      tP = SXJ_clamp(pe * 3.4, -T.pitchRate, T.pitchRate) + ctl.up * T.pitchRate * 0.85
      tY = -ye * 1.8
      tR = SXJ_clamp(-bank * 3.2 * wB - roll * 2.4 * (1 - wB), -T.rollRate, T.rollRate)
      if (Math.abs(ctl.side) > 0.1) tR = -ctl.side * T.rollRate
    }
    tP = SXJ_clamp(tP, -T.pitchRate * 1.2, T.pitchRate * 1.2)
    tY = SXJ_clamp(tY, -T.yawRate * 2.2, T.yawRate * 2.2)
    var auth = SXJ_clamp((s - 8) / T.vStall, 0.18, 1)
    // stall: below stall speed the nose drops
    if (s < T.vStall * 0.85) tP -= (1 - s / (T.vStall * 0.85)) * 1.1
    w.x = SXJ_damp(w.x, tP * auth, 6, dt)
    w.y = SXJ_damp(w.y, tY * auth, 5, dt)
    w.z = SXJ_damp(w.z, tR * Math.max(0.35, auth), 7, dt)
    rotateBody(dt)
    edgeSteer(dt)
    frame()
    // speed: thrust, drag, gravity along the path
    var thrust = T.thrust * st.throttle + (st.ab ? T.ab : 0)
    s += (thrust - T.drag * s * s - 9.8 * fwdV.y * 0.9) * dt
    s = Math.max(0, s)
    // lift grows with speed squared: full at vFly, so bleeding speed makes the jet sink
    var lift = SXJ_clamp((s * s) / (T.vFly * T.vFly), 0, 1)
    // the Harrow's swivelling nozzles hold it up at low speed
    if (T.vtol) lift = Math.max(lift, 0.9)
    var dirV = vel.lengthSq() > 1 ? tmp.copy(vel).normalize() : tmp.copy(fwdV)
    dirV.lerp(fwdV, Math.min(1, (0.3 + T.align * lift) * dt)).normalize()
    vel.copy(dirV).multiplyScalar(s)
    vel.y -= 9.8 * (1 - lift) * dt
  }

  function flyHover(dt) {
    // VTOL: thrust vectored down, flies like the helicopter
    var h = heading()
    var want = st.piloted && !st.scope ? U.look.yaw : h
    var dh = Math.atan2(Math.sin(want - h), Math.cos(want - h))
    var mt = 1.5 * dt
    h += SXJ_clamp(dh, -mt, mt)
    var fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h)
    var f = st.piloted && !st.scope ? ctl.fwd : 0, sd = st.piloted && !st.scope ? ctl.side : 0
    var up = st.piloted ? ctl.up : (st.landed ? 0 : -0.45)
    var tx = 0, tz = 0
    if (!st.landed || up > 0) { tx = fx * f * T.hoverSpd + rx * sd * T.strafe; tz = fz * f * T.hoverSpd + rz * sd * T.strafe }
    var kh = st.landed ? 8 : 1.4
    vel.x = SXJ_damp(vel.x, tx, kh, dt)
    vel.z = SXJ_damp(vel.z, tz, kh, dt)
    var vyWant = up > 0 ? up * T.climb : up < 0 ? up * T.sink : 0
    // auto-flare: the last few metres always come down gently
    var agl = altitude()
    if (agl < 9) vyWant = Math.max(vyWant, -(1.6 + agl * 0.45))
    vel.y = SXJ_damp(vel.y, vyWant, 2.6, dt)
    // attitude: lean into the motion
    var vf = vel.x * fx + vel.z * fz, vr = vel.x * rx + vel.z * rz
    var tp = st.landed ? 0 : SXJ_clamp(-vf / T.hoverSpd * 0.16, -0.2, 0.16)
    var tr = st.landed ? 0 : SXJ_clamp(-vr / T.strafe * 0.18, -0.25, 0.25)
    st.hp_ = SXJ_damp(st.hp_ || 0, tp, 4, dt)
    st.hr_ = SXJ_damp(st.hr_ || 0, tr, 4, dt)
    q.setFromEuler(new lt.Euler(st.hp_, h, st.hr_, 'YXZ'))
    w.set(0, 0, 0)
    // shift: transition to wing-borne flight
    if (st.piloted && ctl.boost && !st.landed && altitude() > 4) {
      st.hover = false
      st.throttle = 0.8
      var sp = Math.max(T.transition + 4, Math.hypot(vel.x, vel.z))
      vel.set(fx * sp, Math.max(vel.y, 1), fz * sp)
      q.setFromEuler(new lt.Euler(0.05, h, 0, 'YXZ'))
      var hh = U.hud(); hh && hh.message('Wing-borne — W/S throttle, slow below ' + Math.round(T.transition * 3.6) + ' km/h with S to hover', 2.6)
    }
  }

  function groundRoll(dt) {
    // wheels on the ground, nose-wheel steering, brakes when throttle is off
    var h = heading()
    var fx = -Math.sin(h), fz = -Math.cos(h)
    var s = vel.x * fx + vel.z * fz
    var ddt = Math.max(ctl.dt, 1 / 240)
    var steer = st.piloted ? SXJ_clamp(-ctl.dx / ddt * 0.25 - ctl.side * 0.7, -0.8, 0.8) : 0
    h += steer * dt * Math.min(1, Math.abs(s) / 6 + 0.25)
    var thrust = T.thrust * st.throttle + (st.ab ? T.ab : 0)
    var brake = st.throttle < 0.05 && st.piloted && ctl.fwd < 0 ? 12 : 0
    s += (thrust - 0.8 * Math.sign(s) - brake * Math.sign(s) - T.drag * s * s) * dt
    if (!st.piloted || (st.throttle < 0.02 && Math.abs(s) < 0.6)) s = SXJ_damp(s, 0, 3, dt)
    vel.set(fx * s, 0, fz * s)
    var gy = groundY(pos.x, pos.z)
    // rotate + lift off
    var pull = st.piloted && (ctl.up > 0 || -ctl.dy / ddt > 0.4)
    if (s > T.vRot && pull) {
      st.landed = false
      vel.y = 3
      q.setFromEuler(new lt.Euler(0.12, h, 0, 'YXZ'))
      U.sound('jump', { pos: pos, gain: 0.5, pitch: 0.5 })
      return
    }
    q.setFromEuler(new lt.Euler(0, h, 0, 'YXZ'))
    pos.y = gy + T.gearH
    w.set(0, 0, 0)
  }

  function touchdown(gy) {
    frame()
    var vy = vel.y, s = vel.length()
    var roll = Math.asin(SXJ_clamp(rightV.y, -1, 1)), pitch = Math.asin(SXJ_clamp(fwdV.y, -1, 1))
    var soft = vy > -T.maxSink && Math.abs(roll) < 0.45 && pitch > -0.22 && pitch < 0.5 && (st.hover || s < T.vLand)
    pos.y = gy + T.gearH
    if (soft) {
      st.landed = true
      vel.y = 0
      if (!st.hover) q.setFromEuler(new lt.Euler(0, heading(), 0, 'YXZ'))
      if (vy < -2) U.sound('land', { pos: pos, gain: 0.8, pitch: 0.5 })
      return
    }
    var impact = Math.max(-vy, s * Math.max(0.15, Math.abs(roll) * 0.6, -pitch))
    if (impact > 26 || s > T.vLand * 1.6) { destroy(); return }
    u.damage((impact - 3) * 26, pos.clone(), UP, 'body', 'crash')
    vel.y = Math.abs(vy) * 0.25
    vel.multiplyScalar(0.6)
    U.sound('container_bang', { pos: pos, gain: 1, pitch: 0.5 })
  }

  u.update = function (dt) {
    // the Su-57 finished loading after this Talon was built: swap the look
    if (kind === 'talon' && !m.su57 && SXJ_SU.ready) {
      var nm = SXJ_su57Model(G)
      nm.rails.forEach(function (r, i) { if (m.rails[i]) r.mesh.visible = m.rails[i].mesh.visible })
      nm.root.position.copy(m.root.position); nm.root.quaternion.copy(m.root.quaternion)
      G.scene.remove(m.root); G.scene.add(nm.root)
      m = nm
    }
    // same for the Harrier
    if (kind === 'harrow' && !m.glb && SXJ_GLB.harrow.ready) {
      var nh = SXJ_harrierModel(G)
      nh.rails.forEach(function (r, i) { if (m.rails[i]) r.mesh.visible = m.rails[i].mesh.visible })
      nh.root.position.copy(m.root.position); nh.root.quaternion.copy(m.root.quaternion)
      G.scene.remove(m.root); G.scene.add(nh.root)
      m = nh
    }
    st.warnT -= dt
    if (!u.alive) {
      // crashing: fall, roll, burn
      if (st.crash && !st.crash.done) {
        st.crash.t += dt
        vel.y -= 9.8 * dt
        vel.multiplyScalar(Math.exp(-0.15 * dt))
        w.set(0.3, 0, st.crash.spin)
        rotateBody(dt)
        pos.addScaledVector(vel, dt)
        var gy0 = groundY(pos.x, pos.z)
        if (pos.y - 1 <= gy0 || st.crash.t > 12) wreck()
        st.smokeT -= dt
        if (st.smokeT <= 0 && G.fx && G.fx.smoke) { st.smokeT = 0.04; G.fx.smoke(pos.clone(), { size: 1.6, life: 2.6, rise: 0.6, count: 1, alpha: 0.6, color: 0x1e1e1e }) }
      }
      m.root.position.copy(pos)
      m.root.quaternion.copy(q)
      updateMissiles(dt)
      if (engine) { engine.stop(0.5); engine = null }
      return
    }
    if (!st.piloted) {
      // parked / abandoned: throttle off, settle
      st.throttle = Math.max(0, st.throttle - dt * 0.5)
      st.ab = false
      ctl.fwd = ctl.side = ctl.up = 0
      ctl.dx = ctl.dy = 0
      if (T.vtol && !st.landed && vel.length() < 25) st.hover = true
    }
    // mode switches: Harrow slowing down → hover
    if (T.vtol && !st.hover && !st.landed && vel.length() < T.transition && (st.throttle < 0.25 || ctl.fwd < -0.5)) {
      st.hover = true
      if (st.piloted) { U.look.yaw = heading(); U.look.pitch = -0.12; var hh = U.hud(); hh && hh.message('VTOL hover — WASD move, Space/C up/down, Shift to fly', 2.4) }
    }
    if (st.landed && !st.hover) groundRoll(dt)
    else if (st.hover) flyHover(dt)
    else flyWingborne(dt)
    if (!st.landed || st.hover) {
      // integrate + collide with the world
      var s = vel.length()
      if (s > 0.1) {
        var dir = tmp.copy(vel).divideScalar(s)
        var hit = G.physics.raycast(pos, dir, s * dt + 2.5)
        if (hit && hit.dist < s * dt + 2.5) {
          var into = -(vel.x * hit.normal.x + vel.y * hit.normal.y + vel.z * hit.normal.z)
          if (hit.normal.y > 0.6 && (st.hover || into < T.maxSink * 1.6)) {
            // grazing the ground: let touchdown judge it below
          } else if (into > 38) destroy()
          else if (into > 0) {
            u.damage(Math.max(0, into - 6) * 22, hit.point.clone(), dir.clone(), 'body', 'crash')
            vel.addScaledVector(hit.normal, into * 1.25)
            U.sound('container_bang', { pos: pos, gain: 1, pitch: 0.6 })
          }
        }
      }
      pos.addScaledVector(vel, dt)
      var gy = groundY(pos.x, pos.z)
      if (pos.y - T.gearH <= gy && u.alive) {
        if (st.hover) {
          pos.y = gy + T.gearH
          if (vel.y < -T.maxSink) u.damage((-vel.y - T.maxSink) * 30, pos.clone(), UP, 'body', 'crash')
          if (vel.y < 0) vel.y = 0
          st.landed = true
        } else touchdown(gy)
      } else if (st.hover && pos.y - T.gearH > gy + 0.3) st.landed = false
    } else {
      pos.addScaledVector(vel, dt)
      pos.y = groundY(pos.x, pos.z) + T.gearH
    }
    if (!u.alive) return
    // visuals
    m.root.position.copy(pos)
    m.root.quaternion.copy(q)
    var alt = altitude()
    st.gearOut = SXJ_damp(st.gearOut, (st.landed || alt < 14 || st.hover) ? 1 : 0, 3, dt)
    m.gear.visible = st.gearOut > 0.2
    if (m.gearDoors) m.gearDoors.visible = st.gearOut <= 0.2
    m.gear.scale.y = Math.max(0.2, st.gearOut)
    var burn = st.piloted ? st.throttle * 0.8 + (st.ab ? 0.9 : 0) : 0
    if (m.flames) m.flames.forEach(function (f, i) {
      f.visible = burn > 0.08
      var k = i % 2 ? 0.7 + 0.3 * Math.random() : 0.8 + 0.25 * Math.random()
      f.scale.set(0.6 + burn * 0.5, 0.6 + burn * 0.5, Math.max(0.05, burn * k))
    })
    if (m.nozzles) {
      st.nozzle = SXJ_damp(st.nozzle, st.hover ? 1 : 0, 2.5, dt)
      m.nozzles.forEach(function (n) {
        var hb = st.piloted ? (st.hover ? 0.5 + 0.4 * Math.max(0, ctl.up) : st.throttle * 0.6 + (st.ab ? 0.5 : 0)) : 0
        if (n.userData.aft) {
          // Harrier model: the pair points aft at 0, down when hovering
          n.rotation.x = st.nozzle * 1.45
          n.userData.flames.forEach(function (f) {
            f.visible = hb > 0.08
            f.scale.set(0.8 + hb * 0.4, 0.8 + hb * 0.4, Math.max(0.05, hb * (0.85 + 0.25 * Math.random())))
          })
          return
        }
        n.rotation.x = -(1 - st.nozzle) * 1.45
        var f = n.userData.flame
        f.visible = hb > 0.08
        f.scale.set(0.8 + hb * 0.4, Math.max(0.05, hb * (0.85 + 0.25 * Math.random())), 0.8 + hb * 0.4)
      })
    }
    st.strobeT += dt
    m.strobe.visible = (st.strobeT % 1.2) < 0.08
    // weapons housekeeping
    st.heat = Math.max(0, st.heat - T.cool * dt)
    if (st.overheat && st.heat < 0.35) st.overheat = false
    if (st.reloadT > 0) {
      st.reloadT -= dt
      if (st.reloadT <= 0) { st.reloadT = 0; m.rails.forEach(function (r) { r.mesh.visible = true }); st.ammo = m.rails.length; U.sound('reload_magin', { pos: pos, gain: 0.9, pitch: 0.7 }) }
    }
    if (kind === 'talon' && st.piloted && !st.landed) updateLock(dt)
    else if (kind === 'talon') { st.lockTgt = null; st.locked = false; showLock(null) }
    updateMissiles(dt)
    // jet wash / dust when low and hovering or rolling
    st.dustT -= dt
    if (st.piloted && alt < 9 && st.dustT <= 0 && G.fx && G.fx.smoke && (st.hover || vel.length() > 10)) {
      st.dustT = 0.07
      var a = Math.random() * Math.PI * 2, rr = 2 + Math.random() * 5
      var gx = pos.x + Math.cos(a) * rr, gz = pos.z + Math.sin(a) * rr
      var k2 = 1 - alt / 9
      G.fx.smoke(tmp3.set(gx, U.groundAt(gx, gz, pos.y) + 0.3, gz), { size: 1.4 + Math.random() * 1.6, life: 1.4, rise: 0.25, count: 1, alpha: 0.26 * k2, color: 0xc9a47a, vel: tmp2.set(Math.cos(a) * 8 * k2, 0.4, Math.sin(a) * 8 * k2) })
    }
    // damage smoke
    st.smokeT -= dt
    if (u.hp < u.maxHp * 0.4 && st.smokeT <= 0 && G.fx && G.fx.smoke) {
      st.smokeT = 0.1
      G.fx.smoke(pos.clone(), { size: 0.9, life: 2.2, rise: 0.8, count: 1, alpha: 0.35, color: 0x262626 })
    }
    // turbine sound
    var spool = st.piloted ? 0.35 + st.throttle * 0.55 + (st.ab ? 0.2 : 0) + (st.hover ? 0.25 : 0) : 0
    if (spool > 0.02 && !engine) engine = SXJ_loop(G, ['sx_jet_turbine', 'wind', 'gull_rotor'], { pos: pos, gain: 0, pitch: 0.6, ref: 16 })
    if (engine) {
      engine.setPos(pos)
      engine.setGain(spool * (st.piloted ? 1.1 : 1.6))
      engine.setPitch(0.55 + spool * 0.55)
      if (spool <= 0.02) { engine.stop(0.6); engine = null }
    }
  }

  u.dispose = function () {
    G.scene.remove(m.root)
    missiles.forEach(function (ms) { G.scene.remove(ms.mesh) })
    missiles.length = 0
    if (engine) { engine.stop(0.1); engine = null }
    try { wreckFire && wreckFire.stop && wreckFire.stop() } catch (e) { }
    setScope(false)
    showAim(false)
    showLock(null)
  }

  /* -------------------------------------------------------- overlays --- */
  function updateScopeUi() {
    var ui = SXJ_ui(G)
    if (!ui) return
    if (ui.ret._r) { ui.ret._r = 0; ui.ret.style.width = ui.ret.style.height = ui.ret.style.margin = '' }
    var rng = st.desig ? Math.round(st.desig.distanceTo(G.camera.position)) : null
    var name = st.desigObj ? (st.desigObj.label || st.desigObj.type || 'target').toUpperCase() : st.desig ? 'GROUND' : 'NO RETURN'
    var n = railReady().length
    var top = 'FLIR WHT · ' + Math.round(70 / T.scopeFov) + '× · ' + T.label.toUpperCase() + ' POD'
    var bot = (rng != null ? 'RNG ' + rng + ' M · ' : '') + 'TGT ' + name + ' · AGM ' + (st.reloadT > 0 ? 'RELOAD ' + st.reloadT.toFixed(1) + 'S' : n + '/' + m.rails.length) + ' · LMB FIRE'
    if (ui.scopeT._t !== top) { ui.scopeT._t = top; ui.scopeT.textContent = top }
    if (ui.scopeB._t !== bot) { ui.scopeB._t = bot; ui.scopeB.textContent = bot }
    ui.scope.classList.toggle('lock', !!st.desigObj)
  }
  // the sight overlay; `flir` (Harrow pod) also turns the picture grey
  function setScope(on, flir) {
    var ui = SXJ_ui(G)
    if (ui) {
      ui.scope.classList.toggle('on', !!on)
      ui.scope.classList.toggle('aam', !!on && !flir)
      ui.flirT = on ? performance.now() : 0
    }
    SXJ_canvasFilter(G, !!on && !!flir)
  }
  function setFlir(on) { setScope(on, true) }
  function updateSightUi(cam) {
    var ui = SXJ_ui(G)
    if (!ui) return
    // the circle is the lock cone at this zoom
    var r = Math.round(Math.tan(T.scopeCone) / Math.tan(cam.fov * Math.PI / 360) * innerHeight / 2)
    if (ui.ret._r !== r) { ui.ret._r = r; ui.ret.style.width = ui.ret.style.height = 2 * r + 'px'; ui.ret.style.margin = -r + 'px 0 0 ' + -r + 'px' }
    var tg = st.lockTgt
    var rng = tg ? Math.round(objPos(tg, tmp2).distanceTo(pos)) : null
    var n = railReady().length
    var top = 'AAM SIGHT · ' + Math.round(70 / T.scopeFov) + '× · ' + T.label.toUpperCase()
    var bot = (tg ? (tg.label || tg.type || 'target').toUpperCase() + ' · ' + rng + ' M · ' + (st.locked ? 'LOCKED' : 'LOCKING') : 'NO TARGET') +
      ' · AAM ' + (st.reloadT > 0 ? 'RELOAD ' + st.reloadT.toFixed(1) + 'S' : n + '/' + m.rails.length) + (st.locked ? ' · LMB FIRE' : '')
    if (ui.scopeT._t !== top) { ui.scopeT._t = top; ui.scopeT.textContent = top }
    if (ui.scopeB._t !== bot) { ui.scopeB._t = bot; ui.scopeB.textContent = bot }
    ui.scope.classList.toggle('lock', !!st.locked)
    ui.scope.classList.toggle('track', !!tg && !st.locked)
  }
  var noseP = new V3()
  function updateAimUi(cam) {
    var ui = SXJ_ui(G)
    if (!ui) return
    showAim(true)
    // where the nose (and the cannon) points, 600 m out
    noseP.copy(pos).addScaledVector(fwdV, 600).project(cam)
    var vis = noseP.z < 1 && Math.abs(noseP.x) < 1.2 && Math.abs(noseP.y) < 1.2
    ui.nose.style.visibility = vis ? 'visible' : 'hidden'
    if (vis) ui.nose.style.transform = 'translate3d(' + Math.round((noseP.x * 0.5 + 0.5) * innerWidth) + 'px,' + Math.round((-noseP.y * 0.5 + 0.5) * innerHeight) + 'px,0)'
  }
  function showAim(on) {
    var ui = SXJ_ui(G)
    if (!ui) return
    if (on) ui.aimT = performance.now()
    if (ui.aim._on !== !!on) { ui.aim._on = !!on; ui.aim.classList.toggle('on', !!on); ui.nose.classList.toggle('on', !!on) }
  }
  var proj = new V3()
  function showLock(o) {
    var ui = SXJ_ui(G)
    if (!ui) return
    if (!o) { if (ui.lock._on) { ui.lock._on = false; ui.lock.classList.remove('on') } return }
    objPos(o, proj)
    proj.project(G.camera)
    var vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1
    if (ui.lock._on !== vis) { ui.lock._on = vis; ui.lock.classList.toggle('on', vis) }
    if (vis) { ui.lockT = performance.now(); ui.lock.style.transform = 'translate3d(' + Math.round((proj.x * 0.5 + 0.5) * innerWidth) + 'px,' + Math.round((-proj.y * 0.5 + 0.5) * innerHeight) + 'px,0)' }
    ui.lock.classList.toggle('locked', !!st.locked)
  }

  // initial pose
  m.root.position.copy(pos)
  m.root.quaternion.copy(q)
  m.root.updateMatrixWorld()
  return u
}

var SXJ_UI = null
function SXJ_ui(G) {
  if (SXJ_UI && SXJ_UI.root.isConnected) return SXJ_UI
  var h = G.hud && !G.hud.stub ? G.hud : null
  if (!h || !h.root) return null
  var scope = document.createElement('div')
  scope.className = 'sxj-scope'
  scope.innerHTML = '<i class="sxj-ret"></i><i class="sxj-br tl"></i><i class="sxj-br tr"></i><i class="sxj-br bl"></i><i class="sxj-br br"></i><div class="sxj-scope-t"></div><div class="sxj-scope-b"></div>'
  var lock = document.createElement('div')
  lock.className = 'sxj-lock'
  // mouse-aim flight: the circle is where you aim, the cross where the nose points
  var aim = document.createElement('div')
  aim.className = 'sxj-aim'
  var nose = document.createElement('div')
  nose.className = 'sxj-nose'
  h.root.appendChild(scope)
  h.root.appendChild(lock)
  h.root.appendChild(aim)
  h.root.appendChild(nose)
  SXJ_UI = { root: scope, scope: scope, lock: lock, aim: aim, nose: nose, ret: scope.querySelector('.sxj-ret'), scopeT: scope.querySelector('.sxj-scope-t'), scopeB: scope.querySelector('.sxj-scope-b'), flirT: 0, lockT: 0, aimT: 0 }
  // watchdog: the pod view and the lock box are refreshed every flown frame; if
  // that stops (pause, quit to title, death screen) they switch themselves off
  if (!SXJ_ui.raf) {
    SXJ_ui.raf = true
    var tick = function () {
      var u = SXJ_UI, now = performance.now()
      if (u) {
        if (u.flirT && now - u.flirT > 250) { u.flirT = 0; u.scope.classList.remove('on'); SXJ_canvasFilter(G, false) }
        if (u.lock._on && now - u.lockT > 250) { u.lock._on = false; u.lock.classList.remove('on') }
        if (u.aim._on && now - u.aimT > 250) { u.aim._on = false; u.aim.classList.remove('on'); u.nose.classList.remove('on') }
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  return SXJ_UI
}
function SXJ_canvasFilter(G, on) {
  try {
    var c = (G.render && G.render.renderer || G.renderer || {}).domElement
    if (!c) return
    var f = on ? 'grayscale(1) contrast(1.45) brightness(1.12)' : ''
    if (c.style.filter !== f) c.style.filter = f
  } catch (e) { }
}

SXU_TYPES.talon = function (G, U, opts) { return SXJ_makeJet(G, U, opts, 'talon') }
SXU_TYPES.harrow = function (G, U, opts) { return SXJ_makeJet(G, U, opts, 'harrow') }

/* =========================================================== PETREL ==== */

SXU_TYPES.petrel = function (G, U, opts) {
  var T = SXJ_TUNE.petrel
  var V3 = lt.Vector3, Q = lt.Quaternion
  SXJ_glbStart('petrel')
  var m = SXJ_GLB.petrel.ready ? SXJ_f2Model(G) : SXJ_petrelModel(G)
  G.scene.add(m.root)
  var UP = new V3(0, 1, 0)
  var tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), tgt = new V3()
  var rnd = function (a, b) { return a + (b - a) * Math.random() }
  var A = SXJ_TUNE.arena
  var pos = opts.pos ? opts.pos.clone() : new V3(200, 160, 400)
  var dir0 = new V3(A.x - pos.x, 0, A.z - pos.z).normalize()
  var u = {
    type: 'petrel', label: T.label, faction: 'enemy', boss: true, alive: true,
    hp: T.hp, maxHp: T.hp, radius: 8, pos: pos, vel: dir0.clone().multiplyScalar(T.speed),
    solid: { r: 3.8, h: 2, m: 10, air: true },
    mode: opts.guard ? 'guard' : 'approach', guard: !!opts.guard, home: (opts.home || pos).clone(),
    orbitA: opts.guard && opts.home ? Math.atan2(pos.z - opts.home.z, pos.x - opts.home.x) : Math.random() * 6.28, alt: rnd(T.alt[0], T.alt[1]), extendT: 0, extendDir: new V3(),
    cannonCd: 2, missileCd: 7, burst: 0, burstT: 0, stunT: 0, bank: 0, dying: 0, crashed: false, smokeT: 0, strobeT: 0, flash: 0,
  }
  var q = new Q()
  var missiles = []
  var loop = null, fire = null
  // a guard starts on its orbit, flying along it
  if (u.mode === 'guard') u.vel.set(-Math.sin(u.orbitA), 0, Math.cos(u.orbitA)).multiplyScalar(T.guardSpeed)

  u.center = function (out) { return (out || new V3()).copy(pos) }
  u.raycast = function (o, d, max) { return SXJ_hitShapes(m.root, m.shapes, o, d, max) }
  u.stun = function (sec) { if (u.alive) { u.stunT = Math.max(u.stunT, sec); U.sound('relay_cut', { pos: pos, gain: 1, pitch: 0.9 }) } }
  u.damage = function (amount, point, dir, part, source) {
    if (!u.alive || !(amount > 0)) return false
    u.hp -= amount
    u.flash = 0.08
    if (u.mode === 'guard' && source !== 'enemy') { u.mode = 'approach'; u.guard = false }
    if (u.hp <= 0) {
      u.hp = 0
      u.alive = false
      U.killed(u)
      U.sound('gull_die', { pos: pos, gain: 1, pitch: 0.5 })
      try { G.fx.explosion(pos.clone(), 1.1) } catch (e) { }
      return true
    }
    return false
  }
  function toWorld(v, out) { m.root.updateMatrixWorld(); return out.copy(v).applyMatrix4(m.root.matrixWorld) }

  function cannonShot() {
    if (!U.target(tgt)) return
    var mz = toWorld(m.muzzle, new V3())
    var d = tmp.copy(tgt).sub(mz).normalize()
    var sp = T.spread
    d.x += (Math.random() - 0.5) * sp * 2; d.y += (Math.random() - 0.5) * sp * 2; d.z += (Math.random() - 0.5) * sp * 2
    d.normalize()
    var h = U.enemyShot(mz, d, { damage: T.cannonDmg, range: T.cannonRange })
    var end = h && h.point ? h.point : tmp2.copy(mz).addScaledVector(d, T.cannonRange)
    if (G.fx && G.fx.tracer) G.fx.tracer(mz, end, { color: 0xff5a3a, intensity: 22, speed: 260, width: 0.05 })
    G.events.emit('enemy:fire', { type: 'gull', pos: mz.clone() })
    try { G.render.lightPool.flash(mz, 16737843, 45, 8, 0.04) } catch (e) { }
  }
  function launchMissile(side) {
    var p = toWorld(tmp.set(side * 2.6, -0.3, 0.4), new V3())
    var mesh = SXJ_missileGeo(SXJ_mats(G), false)
    mesh.position.copy(p)
    G.scene.add(mesh)
    var ms = { mesh: mesh, pos: p, dir: tmp2.copy(u.vel).normalize().clone(), speed: u.vel.length(), t: 0, smokeT: 0, shot: false }
    ms.target = U.addTarget({ pos: p, r: 0.9, hit: function () { ms.shot = true } })
    missiles.push(ms)
    U.sound('gull_fire', { pos: p, gain: 1, pitch: 0.45 })
  }
  function updateMissiles(dt) {
    var hasT = !!U.target(tgt)
    for (var k = missiles.length - 1; k >= 0; k--) {
      var ms = missiles[k]
      if (ms.shot) { try { G.fx.explosion(ms.pos.clone(), 0.5) } catch (e) { } G.scene.remove(ms.mesh); missiles.splice(k, 1); continue }
      ms.t += dt
      ms.speed = Math.min(T.missileSpeed, ms.speed + 40 * dt)
      if (hasT && ms.t > 0.3) {
        var want = tmp.copy(tgt).sub(ms.pos).normalize()
        var ang = Math.acos(SXJ_clamp(ms.dir.dot(want), -1, 1))
        if (ang > 1e-4) ms.dir.lerp(want, Math.min(1, T.missileTurn * dt / ang)).normalize()
      }
      var step = ms.speed * dt, boom = null
      var h = U.cast(ms.pos, ms.dir, step + 0.4, 'ally')
      if (h) boom = h.point
      if (!boom && U.pilot && U.pilot.alive) { var ph = U.pilot.raycast(ms.pos, ms.dir, step + 0.4); if (ph) boom = ph.point }
      if (!boom && hasT && ms.pos.distanceTo(tgt) < 4) boom = ms.pos.clone()
      if (!boom && ms.t > 9) boom = ms.pos.clone()
      if (boom) {
        U.removeTarget(ms.target)
        U.blast(boom.clone().addScaledVector(ms.dir, -0.3), T.missileR, T.missileDmg, 'enemy', { size: 1.1 })
        G.scene.remove(ms.mesh)
        missiles.splice(k, 1)
        continue
      }
      ms.pos.addScaledVector(ms.dir, step)
      ms.mesh.position.copy(ms.pos)
      ms.mesh.quaternion.setFromUnitVectors(tmp3.set(0, 0, -1), ms.dir)
      ms.smokeT -= dt
      if (ms.smokeT <= 0 && G.fx && G.fx.smoke) { ms.smokeT = 0.04; G.fx.smoke(tmp3.copy(ms.pos).addScaledVector(ms.dir, -1.2), { size: 0.4, life: 1.8, rise: 0.1, count: 1, alpha: 0.24, color: 0x8c877f }) }
    }
  }
  function pilotIsAircraft() { return !!(U.pilot && U.pilot.alive && U.solidOf(U.pilot).air) }

  var curDir = new V3(), axis = new V3(), qa = new Q()
  u.update = function (dt) {
    var hasT = !!U.target(tgt)
    if (u.alive) {
      u.stunT = Math.max(0, u.stunT - dt)
      if (u.mode === 'guard' && hasT && (tgt.distanceTo(pos) < T.wake || Math.hypot(tgt.x - u.home.x, tgt.z - u.home.z) < T.wakeHome)) { u.mode = 'approach'; u.guard = false; U.radio('Control: interceptor breaking off its patrol — it is coming for you.', 4) }
      var speed = u.mode === 'guard' ? T.guardSpeed : u.mode === 'extend' ? T.extendSpeed : T.speed
      var goal = tmp2
      if (u.mode === 'guard') {
        u.orbitA += (speed / T.guardR) * dt
        goal.set(u.home.x + Math.cos(u.orbitA) * T.guardR, u.home.y + T.guardAlt, u.home.z + Math.sin(u.orbitA) * T.guardR)
      } else if (u.mode === 'extend' || !hasT) {
        u.extendT += dt
        goal.copy(pos).addScaledVector(u.extendDir, 300)
        goal.y = Math.max(goal.y, U.groundAt(goal.x, goal.z, 999) + u.alt)
        if (!hasT || u.extendT > 5.5 || (hasT && Math.hypot(tgt.x - pos.x, tgt.z - pos.z) > 650)) { u.mode = hasT ? 'approach' : 'extend'; u.extendT = 0; if (!hasT) u.extendDir.set(A.x - pos.x, 0, A.z - pos.z).normalize() }
      } else {
        goal.copy(tgt)
        goal.y += pilotIsAircraft() ? 0 : 18
        var hd = Math.hypot(tgt.x - pos.x, tgt.z - pos.z)
        var air = pilotIsAircraft()
        if (hd < (air ? 230 : 140)) {
          // break off: carry on past the target, offset to one side, then extend and turn back
          u.mode = 'extend'; u.extendT = 0
          var side = Math.random() < 0.5 ? -1 : 1
          u.extendDir.set(u.vel.x, 0, u.vel.z).normalize().applyAxisAngle(UP, side * (air ? 0.9 : 0.55))
          u.alt = rnd(T.alt[0], T.alt[1])
        }
      }
      // terrain + map safety
      var vd = tmp3.copy(u.vel).normalize()
      var gAhead = Math.max(U.groundAt(pos.x, pos.z, 999), U.groundAt(pos.x + vd.x * 120, pos.z + vd.z * 120, 999), U.groundAt(pos.x + vd.x * 260, pos.z + vd.z * 260, 999))
      // turn back well inside the edge: at this speed a reversal needs ~300 m
      var lim = A.half - 170
      if (Math.abs(pos.x - A.x) > lim || Math.abs(pos.z - A.z) > lim) goal.set(A.x, Math.max(goal.y, 140), A.z)
      if (goal.y < gAhead + 35) goal.y = gAhead + 35
      if (pos.y < gAhead + 30) goal.y = Math.max(goal.y, pos.y + 60)
      if (goal.y > SXJ_TUNE.ceiling - 20) goal.y = SXJ_TUNE.ceiling - 20
      // steer the velocity toward the goal at a limited turn rate
      curDir.copy(u.vel).normalize()
      var want = tmp.copy(goal).sub(pos).normalize()
      var ang = Math.acos(SXJ_clamp(curDir.dot(want), -1, 1))
      // steer harder the further past the turn-back line it is
      var over = Math.max(Math.abs(pos.x - A.x), Math.abs(pos.z - A.z)) - lim
      var turn = u.stunT > 0 ? 0.15 : T.turn * (over > 0 ? 1 + over / 50 : 1)
      var step = Math.min(ang, turn * dt)
      axis.crossVectors(curDir, want)
      var al = axis.length()
      if (al > 1e-6 && step > 0) { axis.divideScalar(al); curDir.applyQuaternion(qa.setFromAxisAngle(axis, step)) }
      if (u.stunT > 0) curDir.y = Math.max(-0.4, curDir.y - 0.3 * dt)
      curDir.normalize()
      var sgn = axis.y >= 0 ? 1 : -1
      u.bank = SXJ_damp(u.bank, SXJ_clamp(sgn * (step / Math.max(dt, 1e-4)) * 1.4, -1.25, 1.25), 3, dt)
      var spNow = SXJ_damp(u.vel.length(), speed, 0.6, dt)
      u.vel.copy(curDir).multiplyScalar(spNow)
      // attacks
      if (u.stunT <= 0 && hasT && u.mode === 'approach') {
        var mz = toWorld(m.muzzle, tmp3)
        var dT = mz.distanceTo(tgt)
        var face = tmp.copy(tgt).sub(mz).normalize().dot(curDir)
        u.cannonCd -= dt
        u.missileCd -= dt
        if (u.burst <= 0 && u.cannonCd <= 0 && dT < T.cannonRange && face > 0.94 && G.physics.lineOfSight(mz, tgt)) {
          u.burst = T.burst; u.burstT = 0; u.cannonCd = rnd(T.cannonCd[0], T.cannonCd[1])
          G.events.emit('enemy:telegraph', { enemy: { type: 'gull', pos: pos }, type: 'gull', pos: pos.clone(), time: 0.3 })
        }
        if (u.missileCd <= 0 && dT < 800 && dT > 220 && face > 0.8) {
          // a pair at aircraft, a single slower shot at people and vehicles on the ground
          if (pilotIsAircraft()) { launchMissile(-1); launchMissile(1); u.missileCd = rnd(T.missileCd[0], T.missileCd[1]) }
          else { launchMissile(Math.random() < 0.5 ? -1 : 1); u.missileCd = rnd(T.missileCd[0], T.missileCd[1]) * 1.3 }
        }
      }
      if (u.burst > 0) {
        u.burstT -= dt
        while (u.burstT <= 0 && u.burst > 0) { cannonShot(); u.burst--; u.burstT += T.burstGap }
      }
    } else if (!u.crashed) {
      // going down: smoke, roll, dive
      u.dying += dt
      u.vel.y -= 9.8 * dt
      u.bank += 3 * dt
      u.smokeT -= dt
      if (u.smokeT <= 0 && G.fx && G.fx.smoke) { u.smokeT = 0.035; G.fx.smoke(pos.clone(), { size: 1.8, life: 2.8, rise: 0.6, count: 1, alpha: 0.6, color: 0x1e1e1e }) }
    }
    pos.addScaledVector(u.vel, dt)
    if (u.alive) {
      // hard floor: never inside a dune or a mesa wall
      var gf = U.groundAt(pos.x, pos.z, 999) + 12
      if (pos.y < gf) { pos.y = gf; if (u.vel.y < 0) u.vel.y = 0 }
      pos.x = SXJ_clamp(pos.x, A.x - A.half, A.x + A.half)
      pos.z = SXJ_clamp(pos.z, A.z - A.half, A.z + A.half)
    }
    if (!u.alive && !u.crashed) {
      var gh = U.groundAt(pos.x, pos.z, 999)
      if (pos.y - 1 <= gh || u.dying > 14) crash(gh)
    }
    // orientation from the flight path
    if (!u.crashed) {
      tmp.copy(u.vel).normalize()
      SXJ_lookQuat(tmp, u.bank, q)
    }
    if (!m.glb && SXJ_GLB.petrel.ready) {
      // the F-2 finished loading after this Petrel was built
      var nm = SXJ_f2Model(G)
      G.scene.remove(m.root); G.scene.add(nm.root)
      m = nm
    }
    m.root.position.copy(pos)
    m.root.quaternion.copy(q)
    var k = u.flash > 0 ? 18 : 9
    u.flash -= dt
    if (!u.alive) k = 0.2
    m.eye.material.color.setRGB(k, k * 0.1, k * 0.04)
    m.flame.visible = u.alive
    if (u.alive) { var fb = u.mode === 'extend' ? 1.2 : 0.8; m.flame.scale.set(1, 1, fb * (0.85 + 0.3 * Math.random())) }
    u.strobeT += dt
    m.strobe.visible = u.alive && (u.strobeT % 0.9) < 0.08
    if (u.alive && u.hp < u.maxHp * 0.5) {
      u.smokeT -= dt
      if (u.smokeT <= 0 && G.fx && G.fx.smoke) { u.smokeT = 0.12; G.fx.smoke(pos.clone(), { size: 0.9, life: 2.2, rise: 0.8, count: 1, alpha: 0.32, color: 0x262626 }) }
    }
    updateMissiles(dt)
    if (!loop && !u.crashed) loop = SXJ_loop(G, ['sx_jet_turbine', 'wind', 'gull_rotor'], { pos: pos, gain: 0, pitch: 0.7, ref: 30, roll: 0.6 })
    if (loop) {
      loop.setPos(pos)
      loop.setGain(u.crashed ? 0 : 1.8)
      loop.setPitch(u.alive ? 0.75 + (u.mode === 'extend' ? 0.12 : 0) : 0.5)
      if (u.crashed) { loop.stop(0.6); loop = null }
    }
  }
  function crash(gh) {
    u.crashed = true
    pos.y = gh + 0.8
    u.vel.set(0, 0, 0)
    try { G.fx.explosion(pos.clone(), 2.4) } catch (e) { }
    U.blast(pos.clone(), 9, 70, 'enemy', { fx: false })
    U.sound('explosion', { pos: pos, gain: 1.1, pitch: 0.7 })
    if (G.fx && G.fx.debris) G.fx.debris(pos.clone(), { count: 30, speed: 13, size: 0.12 })
    try { fire = G.fx.addEmitter(pos.clone(), 'fire', { ttl: 35, scale: 1.5 }) } catch (e) { }
  }
  u.dispose = function () {
    G.scene.remove(m.root)
    missiles.forEach(function (ms) { G.scene.remove(ms.mesh); U.removeTarget(ms.target) })
    missiles.length = 0
    if (loop) { loop.stop(0.1); loop = null }
    try { fire && fire.stop && fire.stop() } catch (e) { }
  }
  SXJ_lookQuat(tmp.copy(u.vel).normalize(), 0, q)
  m.root.position.copy(pos)
  m.root.quaternion.copy(q)
  return u
}

/* =========================================================== PLUGIN ==== */
// Parks the Harrow on Camp Mirage's helipad and the Talon on the west road
// (facing out along the cut, a natural runway). Enemy Petrels come from the
// boss ladder in units/units.js (10 and 20 humanoid robots down).
SXU_PLUGINS.push(function SXJ_plugin(U, G) {
  if (!U.desert) return
  SXJ_suStart() // parse the Su-57 now; the Talon is parked at the first deploy
  SXJ_glbStart('harrow'); SXJ_glbStart('petrel')
  var V3 = lt.Vector3
  var D = { tipT: -1 }
  U.hooks.reset.push(function () {
    D = { tipT: 48 }
    if (SXU_TYPES.harrow) U.spawn('harrow', { pos: U.spotOutside(-167, -46, 6.8), yaw: 0 })
    if (SXU_TYPES.talon) U.spawn('talon', { pos: U.spotOutside(-68, 6.2, 7.8), yaw: Math.PI / 2 })
  })
  U.hooks.update.push(function (dt) {
    if (D.tipT > 0) {
      D.tipT -= dt
      if (D.tipT <= 0) U.radio('Control: air support is yours — a Talon fighter on the west road and a Harrow strike jet on the Mirage pad. Use the Harrow pod on those outposts.', 7)
    }
  })
})
