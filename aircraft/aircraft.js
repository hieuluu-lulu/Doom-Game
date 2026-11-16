// ============================================================================
// DoomZone mod — AIRCRAFT
//   kestrel : ALLY attack helicopter the player can fly (SXU vehicle)
//   skua    : ENEMY gunship (SXU boss unit): AH-64D Apache model, procedural
//             ducted-fan fallback
// Both register a factory in SXU_TYPES (units/units.js owns hit routing,
// piloting, HUD and the desert director). Geometry is built procedurally and
// merged per material with the bundle's `io` builder; materials come from the
// game's material library in object-space triplanar mode so the paint does not
// swim while the aircraft moves. Local frame: x right, y up, forward = -z.
// Every top-level name starts with SXH_.
// ============================================================================

var SXH_TUNE = {
  kestrel: {
    hp: 900, speed: 24, boost: 37, strafe: 15, climb: 9.5, sink: 10, ceiling: 120,
    yawRate: 1.9, skid: 1.55, exitAlt: 4.5,
    gunDmg: 22, gunRate: 11, gunSpread: 0.01, gunRange: 420, heatPerShot: 0.042, cool: 0.34,
    rockets: 14, rocketGap: 0.2, rocketReload: 6, rocketDmg: 120, rocketRadius: 5.5, rocketSpeed: 88,
  },
  skua: {
    hp: 1800, speed: 18, approach: 30, orbitR: [44, 64], alt: [24, 40],
    cannonCd: [3.2, 5.2], burst: 10, burstGap: 0.09, cannonDmg: 5, cannonSpread: 0.03, cannonRange: 170,
    missileCd: [8, 11.5], missileDmg: 34, missileRadius: 5.5, missileTurn: 1.15,
    telegraphCannon: 0.6, telegraphMissile: 0.95,
  },
  // the roamable map: a square around the basin centre with a soft edge
  arena: { x: -4.25, z: -0.85, half: 575, soft: 30 },
}

/* ------------------------------------------------------------ helpers ---- */

function SXH_mats(G) {
  if (G.__sxhMats) return G.__sxhMats
  var get = function (name, o) {
    try { return G.mats.get(name, o) } catch (e) { return new lt.MeshStandardMaterial({ color: 0x777777, roughness: 0.6 }) }
  }
  var M = {
    body: get('paint_grey', { triplanar: true, scale: 1.1 }),
    dark: get('steel_dark', { triplanar: true, scale: 1.4 }),
    stripe: get('paint_orange', { triplanar: true }),
    white: get('paint_white', { triplanar: true }),
    glass: get('glass', { doubleSide: true }),
    blade: get('carbon', { triplanar: true, scale: 2 }),
    black: get('polymer_black', { triplanar: true, scale: 2 }),
    rubber: get('rubber', { triplanar: true }),
    gun: get('gunmetal', { triplanar: true, scale: 2.5 }),
    hull: get('gunmetal', { triplanar: true, scale: 0.7 }),
    plate: get('steel_worn', { triplanar: true, scale: 0.9 }),
    red: get('paint_red', { triplanar: true }),
    hazard: get('hazard_stripes', { triplanar: true, scale: 1.5 }),
  }
  var emi = function (hex, k) {
    var c = new lt.Color(hex)
    return new lt.MeshBasicMaterial({ color: new lt.Color(c.r * k, c.g * k, c.b * k) })
  }
  M.navRed = emi(0xff2a18, 14)
  M.navGreen = emi(0x30ff70, 10)
  M.beacon = emi(0xff3018, 30)
  M.lens = emi(0x2a90ff, 2.2)
  M.hub = emi(0xff7a1a, 7)
  M.exhaust = emi(0xff7a30, 4)
  M.heat = emi(0xff5a20, 0.55)
  G.__sxhMats = M
  return M
}

// Chamfered-rectangle loft, flat shaded. stations: [z, yCenter, halfW, halfH, chamfer(0..0.5)]
function SXH_loft(st, xOff) {
  xOff = xOff || 0
  var rings = st.map(function (s) {
    var z = s[0], y = s[1], hw = s[2], hh = s[3], ch = Math.min(hw, hh) * s[4] * 2
    return [[hw - ch, hh], [hw, hh - ch], [hw, -hh + ch], [hw - ch, -hh], [-hw + ch, -hh], [-hw, -hh + ch], [-hw, hh - ch], [-hw + ch, hh]].map(function (p) {
      return [p[0] + xOff, p[1] + y, z]
    })
  })
  var pos = []
  var tri = function (a, b, c, cx, cy, cz) {
    // keep faces pointing away from the loft axis
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
  // end caps (fans), pointing outward along z
  var cap = function (R, s, dir) {
    var c = [xOff, s[1], s[0] + dir * 0.5]
    for (var i = 0; i < 8; i++) tri([xOff, s[1], s[0]], R[i], R[(i + 1) % 8], c[0], c[1], c[2] - dir * 1.0)
  }
  cap(rings[0], st[0], -1)
  cap(rings[rings.length - 1], st[st.length - 1], 1)
  var g = new lt.BufferGeometry()
  g.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new lt.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2))
  g.computeVertexNormals()
  return g
}

// Extruded side plate: points [[z, y], ...], thickness t, centred on x.
function SXH_plate(pts, t, x) {
  var sh = new lt.Shape()
  pts.forEach(function (p, i) { i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]) })
  sh.closePath()
  var g = new lt.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: Math.min(0.02, t * 0.3), bevelSize: Math.min(0.02, t * 0.3), bevelSegments: 1, curveSegments: 4 })
  g.rotateY(-Math.PI / 2)
  g.translate((x || 0) + t / 2, 0, 0)
  return g
}

function SXH_lathe(pts, segs) {
  return new lt.LatheGeometry(pts.map(function (p) { return new lt.Vector2(p[0], p[1]) }), segs || 20)
}

// Ray vs sphere / capsule (local space). Returns the entry distance or -1.
function SXH_raySphere(o, d, c, r) {
  var ox = o.x - c[0], oy = o.y - c[1], oz = o.z - c[2]
  var b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc
  if (h < 0) return -1
  var t = -b - Math.sqrt(h)
  return t >= 0 ? t : -1
}
function SXH_rayCapsule(o, d, a, b, r) {
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

// Hit test a list of local shapes against a world ray; returns world hit.
var SXH_inv = new lt.Matrix4(), SXH_lo = new lt.Vector3(), SXH_ld = new lt.Vector3()
function SXH_hitShapes(root, shapes, o, d, max) {
  root.updateMatrixWorld()
  SXH_inv.copy(root.matrixWorld).invert()
  SXH_lo.copy(o).applyMatrix4(SXH_inv)
  SXH_ld.copy(d).transformDirection(SXH_inv)
  var best = -1, bs = null
  for (var k = 0; k < shapes.length; k++) {
    var s = shapes[k]
    var t = s.c ? SXH_raySphere(SXH_lo, SXH_ld, s.c, s.r) : SXH_rayCapsule(SXH_lo, SXH_ld, s.a, s.b, s.r)
    if (t >= 0 && t <= max && (best < 0 || t < best - (s.part === 'weak' ? 0.25 : 0))) { best = t; bs = s }
  }
  if (best < 0) return null
  var p = new lt.Vector3().copy(o).addScaledVector(d, best)
  return { dist: best, point: p, normal: d.clone().negate(), part: bs.part || 'body' }
}

function SXH_loop(G, name, opts) {
  try {
    if (G.audio && typeof G.audio.loop === 'function') {
      var h = G.audio.loop(name, opts)
      if (h && h.setGain) return h
    }
  } catch (e) { }
  return { setGain: function () {}, setPitch: function () {}, setPos: function () {}, stop: function () {} }
}

// Rotor blur: a translucent disc with angular streaks.
function SXH_blurMat(tint, opacity) {
  return new lt.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uT: { value: 0 }, uC: { value: new lt.Color(tint) }, uO: { value: opacity } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; uniform float uT; uniform vec3 uC; uniform float uO; varying vec2 vP; void main(){ float r = length(vP); float R = ' + '1.0' + '; float a = atan(vP.y, vP.x); float s = 0.55 + 0.45 * sin(a * 4.0 + uT * 3.0); float hub = smoothstep(0.06, 0.18, r); float tip = 1.0 - smoothstep(0.92, 1.0, r); float ring = 1.0 + 1.6 * smoothstep(0.86, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r)); gl_FragColor = vec4(uC * ring, uA * uO * s * hub * tip); }',
    transparent: true, depthWrite: false, side: lt.DoubleSide, fog: false,
  })
}

function SXH_damp(a, b, k, dt) { return b + (a - b) * Math.exp(-k * dt) }

// Soft square map edge: past (half - soft) the velocity is pushed back in,
// and nothing goes beyond half.
function SXH_edge(pos, vel, dt) {
  var A = SXH_TUNE.arena
  var axes = [['x', A.x], ['z', A.z]]
  for (var k = 0; k < 2; k++) {
    var key = axes[k][0], c = axes[k][1], o = pos[key] - c, ao = Math.abs(o), s = Math.sign(o)
    if (ao > A.half - A.soft) {
      var over = (ao - (A.half - A.soft)) / A.soft
      if (vel[key] * s > 0) vel[key] -= vel[key] * Math.min(1, over * 6 * dt + over * 0.1)
      vel[key] -= s * over * 12 * dt
    }
    if (ao > A.half) pos[key] = c + s * A.half
  }
}
function SXH_angDiff(a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d }

/* ============================================================ KESTREL ==== */

function SXH_kestrelModel(G) {
  var M = SXH_mats(G)
  var root = new lt.Group()
  root.name = 'kestrel'
  var B = new io()
  // fuselage + boom
  B.add(M.body, SXH_loft([
    [-4.78, -0.08, 0.2, 0.2, 0.45], [-4.4, -0.06, 0.46, 0.42, 0.42], [-3.6, -0.02, 0.6, 0.58, 0.38],
    [-2.2, 0.04, 0.66, 0.7, 0.34], [-0.9, 0.1, 0.74, 0.8, 0.34], [0.6, 0.16, 0.78, 0.84, 0.34],
    [1.8, 0.24, 0.62, 0.66, 0.38], [2.6, 0.42, 0.34, 0.36, 0.42], [6.25, 0.62, 0.17, 0.2, 0.45], [6.6, 0.64, 0.1, 0.12, 0.45],
  ]))
  // orange recognition band round the boom + nose tip
  B.add(M.stripe, SXH_loft([[3.35, 0.47, 0.315, 0.335, 0.42], [3.75, 0.49, 0.30, 0.32, 0.42]]))
  B.add(M.stripe, SXH_loft([[5.75, 0.6, 0.2, 0.225, 0.45], [5.95, 0.61, 0.19, 0.215, 0.45]]))
  // stepped tandem canopy
  B.add(M.glass, SXH_loft([
    [-4.0, 0.36, 0.26, 0.06, 0.4], [-3.55, 0.6, 0.47, 0.22, 0.45], [-2.75, 0.76, 0.52, 0.27, 0.45], [-2.25, 0.8, 0.52, 0.27, 0.45],
    [-1.55, 0.98, 0.5, 0.3, 0.45], [-0.85, 0.96, 0.44, 0.22, 0.45], [-0.4, 0.86, 0.3, 0.07, 0.45],
  ]))
  // canopy frame bows + spine
  ;[-2.55, -1.85, -0.75].forEach(function (z, k) {
    var y = [0.8, 0.96, 0.95][k]
    B.add(M.dark, Ee(-0.52, y - 0.24, z - 0.035, 0.52, y + 0.27, z + 0.035, 0.015))
  })
  B.add(M.dark, Ee(-0.025, 0.95, -3.4, 0.025, 1.3, -0.5, 0.01))
  // cockpit interior under the glass: seats, coaming
  B.add(M.black, Ee(-0.36, 0.45, -2.45, 0.36, 0.95, -2.2, 0.05))
  B.add(M.black, Ee(-0.36, 0.6, -1.25, 0.36, 1.12, -1.0, 0.05))
  B.add(M.black, Ee(-0.42, 0.62, -3.4, 0.42, 0.78, -3.05, 0.04))
  B.add(M.black, Ee(-0.42, 0.78, -2.1, 0.42, 0.92, -1.8, 0.04))
  // engines, fairing, intakes, exhausts
  ;[-1, 1].forEach(function (s) {
    B.add(M.body, xt(0.36, 0.38, 2.1, 'z', s * 0.64, 0.96, 0.66, 18))
    B.add(M.dark, xt(0.29, 0.29, 0.06, 'z', s * 0.64, 0.96, -0.42, 18))
    B.add(M.black, xt(0.12, 0.12, 0.08, 'z', s * 0.64, 0.96, -0.44, 12))
    B.add(M.dark, xt(0.3, 0.36, 0.5, 'z', s * 0.72, 1.0, 1.95, 16).rotateY(s * 0.25))
    B.add(M.heat, xt(0.2, 0.2, 0.04, 'z', s * 0.79, 1.0, 2.15, 14).rotateY(s * 0.25))
  })
  B.add(M.body, Ee(-0.42, 0.88, -0.55, 0.42, 1.28, 1.55, 0.14))
  B.add(M.dark, Ee(-0.5, 1.1, 1.2, 0.5, 1.2, 1.5, 0.03))
  // mast + hub
  B.add(M.dark, xt(0.13, 0.18, 0.5, 'y', 0, 1.5, 0.05, 14))
  B.add(M.gun, xt(0.3, 0.3, 0.12, 'y', 0, 1.62, 0.05, 18))
  // stub wings, pylons, rocket pods, missiles
  B.add(M.body, Ee(-2.2, -0.08, -0.15, 2.2, 0.06, 0.78, 0.04))
  B.add(M.dark, Ee(-2.24, -0.09, 0.62, 2.24, 0.07, 0.8, 0.02))
  ;[-1, 1].forEach(function (s) {
    B.add(M.dark, Ee(s * 1.5 - 0.06, -0.3, 0.0, s * 1.5 + 0.06, -0.05, 0.6, 0.02))
    B.add(M.body, xt(0.24, 0.24, 1.42, 'z', s * 1.5, -0.44, 0.15, 16))
    B.add(M.dark, xt(0.255, 0.255, 0.12, 'z', s * 1.5, -0.44, -0.5, 16))
    B.add(M.dark, xt(0.255, 0.255, 0.1, 'z', s * 1.5, -0.44, 0.82, 16))
    B.add(M.black, xt(0.2, 0.2, 0.02, 'z', s * 1.5, -0.44, -0.57, 16))
    for (var k = 0; k < 7; k++) {
      var a = k / 7 * Math.PI * 2, rr = k === 6 ? 0 : 0.12
      B.add(M.gun, xt(0.045, 0.045, 0.02, 'z', s * 1.5 + (k === 6 ? 0 : Math.cos(a) * rr), -0.44 + (k === 6 ? 0 : Math.sin(a) * rr), -0.585, 8))
    }
    B.add(M.dark, Ee(s * 2.02 - 0.03, -0.2, -0.05, s * 2.02 + 0.03, -0.06, 0.6, 0.01))
    ;[-0.11, 0.11].forEach(function (o) {
      B.add(M.white, xt(0.065, 0.065, 1.2, 'z', s * 2.02 + o, -0.28, 0.25, 10))
      B.add(M.dark, xt(0.0, 0.065, 0.18, 'z', s * 2.02 + o, -0.28, -0.44, 10).rotateX(0))
    })
  })
  // tail: fin, stabiliser, tail-rotor gearbox
  B.add(M.body, SXH_plate([[5.35, 0.62], [6.55, 0.62], [6.95, 2.05], [6.5, 2.1], [5.9, 1.05]], 0.12, -0.06))
  B.add(M.stripe, SXH_plate([[6.62, 1.6], [6.86, 1.6], [6.95, 2.05], [6.72, 2.08]], 0.13, -0.065))
  B.add(M.body, Ee(-1.05, 0.56, 5.15, 1.05, 0.64, 5.62, 0.03))
  B.add(M.dark, xt(0.12, 0.12, 0.3, 'x', 0.18, 1.62, 6.5, 12))
  // skids
  ;[-1, 1].forEach(function (s) {
    B.add(M.dark, Ke([s * 1.05, -1.5, -2.35], [s * 1.05, -1.5, 1.7], 0.055, 8))
    B.add(M.dark, Ke([s * 1.05, -1.5, -2.35], [s * 1.05, -1.32, -2.75], 0.055, 8))
    B.add(M.dark, Ke([s * 1.05, -1.48, -1.45], [s * 0.55, -0.6, -1.35], 0.05, 8))
    B.add(M.dark, Ke([s * 1.05, -1.48, 0.95], [s * 0.6, -0.55, 0.85], 0.05, 8))
  })
  // sensor ball under the nose
  B.add(M.dark, new lt.SphereGeometry(0.23, 16, 12).translate(0, -0.3, -4.45))
  B.add(M.lens, new lt.CircleGeometry(0.1, 14).translate(0, -0.3, -4.69))
  // nav lights
  B.add(M.navRed, new lt.SphereGeometry(0.05, 8, 6).translate(-2.22, 0, 0.3))
  B.add(M.navGreen, new lt.SphereGeometry(0.05, 8, 6).translate(2.22, 0, 0.3))
  var body = B.build({ cast: true, recv: true })
  root.add(body)

  // main rotor (blades + blur disc)
  var rotor = new lt.Group()
  rotor.position.set(0, 1.74, 0.05)
  var RB = new io()
  for (var b = 0; b < 4; b++) {
    var bl = Wi(5.15, 0.06, 0.4, 0.02).translate(0.35 + 2.575, 0, 0).rotateX(0.06).rotateY(b * Math.PI / 2)
    RB.add(M.blade, bl)
    RB.add(M.stripe, Wi(0.3, 0.065, 0.405, 0.02).translate(5.3, 0, 0).rotateY(b * Math.PI / 2))
  }
  RB.add(M.gun, xt(0.36, 0.3, 0.14, 'y', 0, 0.02, 0, 18))
  var blades = RB.build({ cast: true, recv: false })
  rotor.add(blades)
  var blurMat = SXH_blurMat(0x1c1f22, 0.22)
  // CircleGeometry lies in XY (the shader reads position.xy); a holder lays it flat
  var blur = new lt.Mesh(new lt.CircleGeometry(1, 48), blurMat)
  blur.scale.set(5.6, 5.6, 1)
  var blurHold = new lt.Group()
  blurHold.rotation.x = -Math.PI / 2
  blurHold.position.copy(rotor.position)
  blurHold.add(blur)
  blur.renderOrder = 870
  root.add(rotor, blurHold)

  // tail rotor
  var tail = new lt.Group()
  tail.position.set(0.36, 1.62, 6.5)
  var TB = new io()
  for (var t = 0; t < 3; t++) TB.add(M.blade, Wi(0.05, 1.0, 0.18, 0.015).translate(0, 0.55, 0).rotateX(t * Math.PI * 2 / 3))
  TB.add(M.gun, xt(0.1, 0.1, 0.12, 'x', 0, 0, 0, 10))
  tail.add(TB.build({ cast: false, recv: false }))
  var tailBlurMat = SXH_blurMat(0x1c1f22, 0.3)
  var tailBlur = new lt.Mesh(new lt.CircleGeometry(1, 32), tailBlurMat)
  tailBlur.scale.set(1.08, 1.08, 1)
  tailBlur.rotation.y = Math.PI / 2
  tailBlur.position.copy(tail.position)
  tailBlur.renderOrder = 871
  root.add(tail, tailBlur)

  // chin gun turret: yaw → pitch → triple barrel
  var turYaw = new lt.Group()
  turYaw.position.set(0, -0.62, -3.6)
  var TU = new io()
  TU.add(M.dark, SXH_lathe([[0, -0.12], [0.26, -0.1], [0.3, 0.05], [0.24, 0.18], [0, 0.2]], 18))
  turYaw.add(TU.build({ cast: true, recv: true }))
  var turPitch = new lt.Group()
  turPitch.position.set(0, -0.05, 0)
  var TP = new io()
  TP.add(M.gun, xt(0.13, 0.13, 0.42, 'z', 0, 0, -0.15, 14))
  for (var g = 0; g < 3; g++) {
    var ga = g / 3 * Math.PI * 2
    TP.add(M.gun, xt(0.032, 0.032, 1.05, 'z', Math.cos(ga) * 0.06, Math.sin(ga) * 0.06, -0.85, 8))
  }
  TP.add(M.dark, xt(0.11, 0.11, 0.06, 'z', 0, 0, -1.1, 14))
  turPitch.add(TP.build({ cast: true, recv: true }))
  turYaw.add(turPitch)
  root.add(turYaw)

  // anti-collision beacon on the fin
  var beacon = new lt.Mesh(new lt.SphereGeometry(0.07, 8, 6), M.beacon)
  beacon.position.set(0, 2.12, 6.62)
  root.add(beacon)

  return {
    root: root, rotor: rotor, blades: blades, blur: blur, blurMat: blurMat, tail: tail, tailBlurMat: tailBlurMat,
    turYaw: turYaw, turPitch: turPitch, beacon: beacon,
    muzzle: new lt.Vector3(0, -0.67, -4.75),
    pods: [new lt.Vector3(-1.5, -0.44, -0.62), new lt.Vector3(1.5, -0.44, -0.62)],
    shapes: [
      { a: [0, -0.02, -4.4], b: [0, 0.14, 1.4], r: 0.8 },
      { a: [0, 0.36, 1.8], b: [0, 0.62, 6.4], r: 0.33 },
      { a: [0, 0.75, -3.5], b: [0, 0.95, -0.6], r: 0.45 },
      { a: [-0.64, 0.96, -0.4], b: [-0.64, 0.96, 1.8], r: 0.4 },
      { a: [0.64, 0.96, -0.4], b: [0.64, 0.96, 1.8], r: 0.4 },
      { a: [-2.1, -0.1, 0.3], b: [2.1, -0.1, 0.3], r: 0.32 },
      { a: [0, 0.8, 5.6], b: [0, 1.95, 6.6], r: 0.28 },
    ],
  }
}

/* ===================================================== KESTREL: GAZELLE ==== */
// The Kestrel's look: the SA342M Gazelle model (models/sa342m_dcs_world.glb),
// cut down for the game:
// cockpit interior dropped, simplified, 768 px WebP textures, quantised
// (assets/gazelle.glb, 2.8 MB instead of 95). GLB frame: nose +Z, skids at
// y = -0.93, main rotor hub (0, 1.726, 0.032), fenestron disc Object_21.
// It keeps the Kestrel's gameplay: chin turret, two rocket pods (on the HOT
// launchers), hit shapes rebuilt for the Gazelle. The procedural Kestrel is the
// fallback, and is swapped for the Gazelle if the model finishes loading late.
var SXH_GZ = { ready: false, failed: false, started: false, scene: null }
var SXH_GZT = {
  y: -1.55 + 0.93,              // skids on the ground (the Kestrel's origin is 1.55 above it)
  hub: [0, 1.726, 0.032],       // GLB frame
  rotorNodes: ['Object_38', 'Object_82', 'Object_83'],
  fan: 'Object_21', fanAt: [0.09, 0.775, -6.015],
  rotorR: 5.2,
}
function SXH_gzStart() {
  if (SXH_GZ.started) return
  SXH_GZ.started = true
  if (typeof SX_ASSET_gazelle !== 'string' || typeof SX_parseGLB !== 'function') { SXH_GZ.failed = true; return }
  SX_parseGLB(SX_ASSET_gazelle).then(function (g) { SXH_GZ.scene = g.scene; SXH_GZ.ready = true }, function (e) { SXH_GZ.failed = true; console.warn('[aircraft] Gazelle model failed, procedural Kestrel', e) })
}
// GLB frame → Kestrel frame (nose -Z, origin 1.55 above the skids)
function SXH_gzPoint(p) { return new lt.Vector3(-p[0], p[1] + SXH_GZT.y, -p[2]) }
function SXH_chinTurret(M) {
  var turYaw = new lt.Group()
  var TU = new io()
  TU.add(M.dark, SXH_lathe([[0, -0.12], [0.26, -0.1], [0.3, 0.05], [0.24, 0.18], [0, 0.2]], 18))
  turYaw.add(TU.build({ cast: true, recv: true }))
  var turPitch = new lt.Group()
  turPitch.position.set(0, -0.05, 0)
  var TP = new io()
  TP.add(M.gun, xt(0.13, 0.13, 0.42, 'z', 0, 0, -0.15, 14))
  for (var g = 0; g < 3; g++) {
    var ga = g / 3 * Math.PI * 2
    TP.add(M.gun, xt(0.032, 0.032, 1.05, 'z', Math.cos(ga) * 0.06, Math.sin(ga) * 0.06, -0.85, 8))
  }
  TP.add(M.dark, xt(0.11, 0.11, 0.06, 'z', 0, 0, -1.1, 14))
  turPitch.add(TP.build({ cast: true, recv: true }))
  turYaw.add(turPitch)
  return { turYaw: turYaw, turPitch: turPitch }
}
function SXH_gazelleModel(G) {
  var M = SXH_mats(G), Z = SXH_GZT
  var root = new lt.Group()
  root.name = 'kestrel'
  var body = SXH_GZ.scene.clone(true)
  body.rotation.y = Math.PI
  body.position.y = Z.y
  body.traverse(function (o) { if (o.isMesh) { o.castShadow = !(o.material && o.material.transparent); o.receiveShadow = true } })
  root.add(body)
  root.updateMatrixWorld(true)
  // main rotor: blades + head spin about the mast
  var rotor = new lt.Group()
  rotor.position.copy(SXH_gzPoint(Z.hub))
  root.add(rotor)
  root.updateMatrixWorld(true)
  Z.rotorNodes.forEach(function (n) { var o = body.getObjectByName(n); if (o) rotor.attach(o) })
  var blurMat = SXH_blurMat(0x1c1f22, 0.2)
  var blur = new lt.Mesh(new lt.CircleGeometry(1, 48), blurMat)
  blur.scale.set(Z.rotorR, Z.rotorR, 1)
  var blurHold = new lt.Group()
  blurHold.rotation.x = -Math.PI / 2
  blurHold.position.copy(rotor.position).add(new lt.Vector3(0, 0.05, 0))
  blurHold.add(blur)
  blur.renderOrder = 870
  root.add(blurHold)
  // fenestron fan in the tail duct
  var tail = new lt.Group()
  tail.position.copy(SXH_gzPoint(Z.fanAt))
  root.add(tail)
  root.updateMatrixWorld(true)
  var fan = body.getObjectByName(Z.fan)
  if (fan) tail.attach(fan)
  var tailBlurMat = SXH_blurMat(0x1c1f22, 0.25)
  // chin gun turret (the Kestrel's, a little smaller) under the cabin
  var tt = SXH_chinTurret(M)
  tt.turYaw.position.set(0, -1.02, -2.05)
  tt.turYaw.scale.setScalar(0.85)
  root.add(tt.turYaw)
  // anti-collision beacon on top of the fin
  var beacon = new lt.Mesh(new lt.SphereGeometry(0.07, 8, 6), M.beacon)
  beacon.position.copy(SXH_gzPoint([0, 2.47, -6.62]))
  root.add(beacon)
  return {
    gazelle: true,
    root: root, rotor: rotor, blades: rotor, blur: blur, blurMat: blurMat, tail: tail, tailBlurMat: tailBlurMat,
    turYaw: tt.turYaw, turPitch: tt.turPitch, beacon: beacon,
    muzzle: new lt.Vector3(0, -1.07, -3.0),
    pods: [SXH_gzPoint([1.55, -0.05, 0.5]), SXH_gzPoint([-1.55, -0.05, 0.5])],
    shapes: [
      { a: [0, -0.4, -2.35], b: [0, -0.3, 0.3], r: 0.74 },     // cabin bubble
      { a: [0, 0.3, -0.9], b: [0, 0.35, 1.2], r: 0.45 },       // sight, engine, gearbox
      { a: [0, 0.0, 1.3], b: [0, 0.15, 5.7], r: 0.3 },         // tail boom
      { a: [0, 0.2, 5.8], b: [0, 1.75, 6.5], r: 0.32 },        // fin + fenestron
      { a: [-1.65, -0.67, -0.1], b: [1.65, -0.67, -0.1], r: 0.25 }, // HOT launchers
    ],
  }
}

SXU_TYPES.kestrel = function (G, U, opts) {
  var T = SXH_TUNE.kestrel
  var V3 = lt.Vector3
  SXH_gzStart()
  var m = SXH_GZ.ready ? SXH_gazelleModel(G) : SXH_kestrelModel(G)
  G.scene.add(m.root)
  var pos = (opts.pos ? opts.pos.clone() : new V3(-50, 0, 15))
  pos.y = U.groundAt(pos.x, pos.z, pos.y + 2) + T.skid
  var tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), aim = new V3(), UP = new V3(0, 1, 0)
  var rotorLoop = null
  var rockets = []
  var rocketGeo = null, rocketMat = null, flameMat = null

  var u = {
    type: 'kestrel', label: 'Kestrel', faction: 'ally', vehicle: true, alive: true,
    hp: T.hp, maxHp: T.hp, radius: 6.2, armor: 1, enterRadius: 4.2,
    pos: pos, vel: new V3(), yaw: opts.yaw != null ? opts.yaw : 0, pitchV: 0, rollV: 0,
    spool: 0, landed: true, piloted: false, heat: 0, overheat: false, gunCd: 0,
    rockets: T.rockets, rocketCd: 0, reloadT: 0, podSide: 0, crash: null,
    ctl: { fwd: 0, strafe: 0, up: 0, boost: false, yaw: 0 }, smokeT: 0, washT: 0, beaconT: 0,
  }
  u.ctl.yaw = u.yaw

  function fwdVec(out) { return out.set(-Math.sin(u.yaw), 0, -Math.cos(u.yaw)) }
  function rightVec(out) { return out.set(Math.cos(u.yaw), 0, -Math.sin(u.yaw)) }
  function localToWorld(v, out) { m.root.updateMatrixWorld(); return out.copy(v).applyMatrix4(m.root.matrixWorld) }
  function groundUnder(x, z) { return U.groundAt(x, z, u.pos.y - 0.6) }

  u.center = function (out) { return (out || new V3()).copy(u.pos).add(tmp3.set(0, 0.2, 0)) }
  u.raycast = function (o, d, max) { return SXH_hitShapes(m.root, m.shapes, o, d, max) }
  u.enterPoint = function (out) {
    // the gunner's door, left side of the cockpit, at ground level
    rightVec(tmp)
    fwdVec(tmp2)
    return out.copy(u.pos).addScaledVector(tmp, -1.4).addScaledVector(tmp2, 1.6).setY(u.pos.y - T.skid)
  }
  u.anchor = function (out) { return out.copy(u.pos).setY(u.pos.y - 1.0) }
  u.exitPoint = function (out) {
    rightVec(tmp)
    fwdVec(tmp2)
    var side = [-1, 1]
    for (var k = 0; k < side.length; k++) {
      out.copy(u.pos).addScaledVector(tmp, side[k] * 2.9).addScaledVector(tmp2, 1.4)
      if (!G.physics.raycast(tmp3.copy(u.pos).setY(u.pos.y - 0.6), tmp2.copy(out).setY(u.pos.y - 0.6).sub(tmp3).normalize(), 3.2)) return out
      fwdVec(tmp2)
    }
    return out.copy(u.pos).addScaledVector(fwdVec(tmp2), -8)
  }

  u.onEnter = function () {
    u.piloted = true
    u.ctl.yaw = u.yaw
    U.look.yaw = u.yaw
    U.look.pitch = -0.08
  }
  u.onExit = function () {
    u.piloted = false
    u.ctl.fwd = u.ctl.strafe = u.ctl.up = 0
  }

  // ------------------------------------------------------------ weapons
  function fireGun(dt) {
    var mz = localToWorld(m.muzzle, tmp)
    var d = tmp2.copy(aim).sub(mz)
    var len = d.length()
    if (len < 1e-3) return
    d.divideScalar(len)
    // spread
    var sp = T.gunSpread
    d.x += (Math.random() - 0.5) * sp * 2; d.y += (Math.random() - 0.5) * sp * 2; d.z += (Math.random() - 0.5) * sp * 2
    d.normalize()
    U.shoot(mz, d, { damage: T.gunDmg, range: T.gunRange, tracerFrom: mz.clone() })
    G.events.emit('weapon:fire', { origin: mz.clone(), dir: d.clone(), muzzle: mz.clone(), ads: 0, pitch: 0.82, gain: 0.95, weapon: 'kestrel' })
    try { G.render.lightPool.flash(mz, 16756832, 60, 9, 0.05) } catch (e) { }
    if (Math.random() < 0.5 && G.fx && G.fx.shell) {
      tmp3.set((Math.random() - 0.5) * 2, -1.5, (Math.random() - 0.5) * 2).add(u.vel)
      G.fx.shell(localToWorld(new V3(0.2, -0.75, -3.6), new V3()), tmp3)
    }
    u.heat = Math.min(1, u.heat + T.heatPerShot)
    if (u.heat >= 1) { u.overheat = true; U.sound('rifle_dry', { gain: 0.8, pitch: 0.6 }) }
  }

  function ensureRocketAssets() {
    if (rocketGeo) return
    var RB = new io(), M = SXH_mats(G)
    RB.add(M.white, xt(0.055, 0.055, 0.9, 'z', 0, 0, 0, 8))
    RB.add(M.dark, xt(0.0, 0.055, 0.16, 'z', 0, 0, -0.53, 8))
    RB.add(M.dark, Ee(-0.14, -0.01, 0.3, 0.14, 0.01, 0.45))
    RB.add(M.dark, Ee(-0.01, -0.14, 0.3, 0.01, 0.14, 0.45))
    rocketGeo = RB
    flameMat = M.exhaust
  }
  function fireRocket() {
    ensureRocketAssets()
    var side = u.podSide = 1 - u.podSide
    var p = localToWorld(m.pods[side], new V3())
    var d = new V3().copy(aim).sub(p).normalize()
    // keep rockets roughly forward even when aiming far off-axis
    var f = fwdVec(tmp)
    if (d.dot(f) < 0.2) d.addScaledVector(f, 0.6).normalize()
    var RB = new io(), M = SXH_mats(G)
    RB.add(M.white, xt(0.055, 0.055, 0.9, 'z', 0, 0, 0, 8))
    RB.add(M.dark, xt(0.0, 0.055, 0.16, 'z', 0, 0, -0.53, 8))
    RB.add(M.dark, Ee(-0.14, -0.01, 0.3, 0.14, 0.01, 0.45))
    var mesh = RB.build({ cast: false, recv: false })
    var fl = new lt.Mesh(new lt.SphereGeometry(0.09, 8, 6).scale(1, 1, 2.2), flameMat)
    fl.position.z = 0.55
    mesh.add(fl)
    mesh.position.copy(p)
    mesh.quaternion.setFromUnitVectors(tmp.set(0, 0, -1), d)
    G.scene.add(mesh)
    rockets.push({ mesh: mesh, pos: p, vel: d.clone().multiplyScalar(T.rocketSpeed).add(u.vel), t: 0, smokeT: 0 })
    u.rockets--
    U.sound('gull_fire', { pos: p, gain: 1, pitch: 0.55 })
    U.sound('explosion', { pos: p, gain: 0.18, pitch: 2.6 })
    try { G.render.lightPool.flash(p, 16750640, 40, 7, 0.06) } catch (e) { }
    G.events.emit('weapon:fire', { origin: p.clone(), dir: d.clone(), muzzle: p.clone(), ads: 0, pitch: 0.5, gain: 0.25, weapon: 'kestrel-rocket' })
  }
  function updateRockets(dt) {
    for (var k = rockets.length - 1; k >= 0; k--) {
      var r = rockets[k]
      r.t += dt
      r.vel.y -= 2.5 * dt
      var step = r.vel.length() * dt
      var d = tmp.copy(r.vel).normalize()
      var hit = U.cast(r.pos, d, step + 0.2, 'enemy')
      var boom = null
      if (hit) boom = hit.point
      else if (r.t > 4) boom = r.pos
      if (boom) {
        var bp = boom.clone().addScaledVector(d, -0.25)
        U.blast(bp, T.rocketRadius, T.rocketDmg, 'ally', { size: 1.05, selfScale: u.piloted ? 0 : 0.5 })
        G.scene.remove(r.mesh)
        rockets.splice(k, 1)
        continue
      }
      r.pos.addScaledVector(r.vel, dt)
      r.mesh.position.copy(r.pos)
      r.mesh.quaternion.setFromUnitVectors(tmp2.set(0, 0, -1), d)
      r.smokeT -= dt
      if (r.smokeT <= 0 && G.fx && G.fx.smoke) {
        r.smokeT = 0.04
        G.fx.smoke(tmp3.copy(r.pos).addScaledVector(d, -0.6), { size: 0.3, life: 1.3, rise: 0.15, count: 1, alpha: 0.2, color: 0xa29d94 })
      }
    }
  }

  // ------------------------------------------------------------ piloting
  u.drive = function (dt, inp, U2) {
    u.ctl.fwd = inp.move ? inp.move.y : 0
    u.ctl.strafe = inp.move ? inp.move.x : 0
    u.ctl.up = (inp.down && inp.down('jump') ? 1 : 0) - (inp.down && inp.down('crouch') ? 1 : 0)
    u.ctl.boost = !!inp.sprint
    // touch has no crouch button: pulling the stick hard back also descends
    if (G.input && G.input.touch && u.ctl.up === 0 && u.ctl.fwd < -0.75) u.ctl.up = -1
    u.ctl.yaw = U.look.yaw
    U.aimPoint(aim, 900)
    // weapons
    u.gunCd -= dt
    if (inp.fire && !u.overheat && u.spool > 0.7) {
      while (u.gunCd <= 0) { fireGun(dt); u.gunCd += 1 / T.gunRate; if (u.overheat) break }
    } else if (u.gunCd < 0) u.gunCd = 0
    if (inp.pressed && inp.pressed('reload') && u.rockets < T.rockets && u.reloadT <= 0) u.reloadT = T.rocketReload
    u.rocketCd -= dt
    if (inp.ads && u.rockets > 0 && u.reloadT <= 0 && u.rocketCd <= 0 && u.spool > 0.7) {
      fireRocket()
      u.rocketCd = T.rocketGap
      if (u.rockets <= 0) u.reloadT = T.rocketReload
    }
    // leaving only near the ground: hold the framework's E timer at zero up high
    var alt = u.pos.y - T.skid - groundUnder(u.pos.x, u.pos.z)
    if (alt > T.exitAlt) {
      U.pilotT = 0
      if (inp.pressed && inp.pressed('interact')) {
        var h = U.hud()
        h && h.message('Descend below ' + T.exitAlt + ' m to leave the Kestrel', 1.6)
      }
    }
  }
  u.camera = function (cam, dt, U2) {
    // orbit a point above the rotor so the aircraft sits under the crosshair
    var f = tmp.copy(u.pos)
    f.y += 3.4
    U.chaseCam(cam, f, U.look.yaw, U.look.pitch, 15, dt, 72)
  }
  u.hud = function () {
    var alt = Math.max(0, u.pos.y - T.skid - groundUnder(u.pos.x, u.pos.z))
    var spd = Math.round(Math.hypot(u.vel.x, u.vel.z) * 3.6)
    var gun = u.overheat ? 'GUN  OVERHEAT' : 'GUN  ' + Math.round(u.heat * 100) + '% HEAT'
    var rk = u.reloadT > 0 ? 'ROCKETS  RELOAD ' + u.reloadT.toFixed(1) + 'S' : 'ROCKETS  ' + u.rockets + '/' + T.rockets
    var lines = ['ALT ' + Math.round(alt) + ' M   SPD ' + spd + ' KM/H', gun, rk]
    if (u.spool < 0.7) lines.unshift('ROTOR SPOOL ' + Math.round(u.spool / 0.7 * 100) + '%')
    return { hp: u.hp, maxHp: u.maxHp, lines: lines }
  }

  // ------------------------------------------------------------ damage
  u.damage = function (amount, point, dir, part, source) {
    if (!u.alive || !(amount > 0)) return false
    u.hp -= amount
    if (point && G.fx && G.fx.sparks && Math.random() < 0.5) G.fx.sparks(point, dir ? tmp.copy(dir).negate() : UP, 6)
    if (u.hp <= 0) {
      u.hp = 0
      u.alive = false
      u.crash = { t: 0, spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random()), boomed: false }
      U.killed(u)
      U.sound('explosion', { pos: u.pos, gain: 0.8, pitch: 1.3 })
      try { G.fx.explosion(u.pos.clone(), 0.8) } catch (e) { }
      return true
    }
    return false
  }

  // ------------------------------------------------------------ simulation
  var prevVel = new V3()
  u.update = function (dt) {
    // the Gazelle model finished loading after this Kestrel was built: swap the look
    if (!m.gazelle && SXH_GZ.ready) {
      var nm = SXH_gazelleModel(G)
      nm.root.position.copy(m.root.position); nm.root.quaternion.copy(m.root.quaternion)
      G.scene.remove(m.root); G.scene.add(nm.root)
      m = nm
    }
    var M = SXH_mats(G)
    // rotor spool: up while piloted or airborne, down when parked
    var airborne = !u.landed
    var spoolTarget = u.alive && (u.piloted || airborne) ? 1 : 0
    u.spool += (spoolTarget - u.spool) * Math.min(1, dt / (spoolTarget > u.spool ? 2.2 : 4.5))
    if (!u.piloted && u.alive) {
      // empty and airborne: settle and auto-land
      u.ctl.fwd = 0; u.ctl.strafe = 0; u.ctl.up = airborne ? -0.45 : 0; u.ctl.boost = false
    }
    if (u.alive) {
      // heading follows the pilot's look
      var dy = SXH_angDiff(u.yaw, u.ctl.yaw)
      var maxTurn = T.yawRate * dt * (u.landed ? 0.4 : 1)
      var turn = Math.max(-maxTurn, Math.min(maxTurn, dy))
      if (u.spool > 0.5) u.yaw += turn
      var f = fwdVec(tmp), r = rightVec(tmp2)
      var lift = u.spool > 0.72
      var spd = u.ctl.boost ? T.boost : T.speed
      var tx = 0, tz = 0
      if (lift && (airborne || u.ctl.up > 0)) {
        tx = f.x * u.ctl.fwd * spd + r.x * u.ctl.strafe * T.strafe
        tz = f.z * u.ctl.fwd * spd + r.z * u.ctl.strafe * T.strafe
      }
      var kh = airborne ? 1.35 : 7
      u.vel.x = SXH_damp(u.vel.x, tx, kh, dt)
      u.vel.z = SXH_damp(u.vel.z, tz, kh, dt)
      var ty = lift ? (u.ctl.up > 0 ? u.ctl.up * T.climb : u.ctl.up < 0 ? u.ctl.up * T.sink : 0) : -3
      u.vel.y = SXH_damp(u.vel.y, ty, 2.6, dt)
      turnRate = turn / Math.max(dt, 1e-4)
    } else {
      // crashing: lose lift, spin, drift
      u.crash.t += dt
      u.vel.y -= 9.8 * dt
      u.vel.x *= Math.exp(-0.4 * dt); u.vel.z *= Math.exp(-0.4 * dt)
      if (!u.crash.boomed) u.yaw += u.crash.spin * dt
    }
    u.pos.addScaledVector(u.vel, dt)

    // --- collisions ---
    var gh = groundUnder(u.pos.x, u.pos.z)
    var skidY = u.pos.y - T.skid
    if (skidY <= gh) {
      var vy = u.vel.y
      u.pos.y = gh + T.skid
      if (vy < -9 && u.alive) u.damage((-vy - 9) * 28, u.pos.clone(), UP, 'body', 'crash')
      if (vy < 0) u.vel.y = 0
      u.landed = true
      if (!u.alive && !u.crash.boomed) wreck()
    } else if (skidY > gh + 0.25) u.landed = false
    var alt = skidY - gh
    if (alt > T.ceiling) { if (u.vel.y > 0) u.vel.y = 0; u.vel.y -= (alt - T.ceiling) * 2 * dt }
    // walls / dunes / masts ahead
    var hs = Math.hypot(u.vel.x, u.vel.z)
    if (hs > 0.5) {
      var dir = tmp3.set(u.vel.x / hs, 0, u.vel.z / hs)
      var probe = G.physics.raycast(u.pos, dir, hs * dt + 3.2)
      if (probe) {
        var into = u.vel.x * probe.normal.x + u.vel.z * probe.normal.z
        if (into < 0) {
          if (-into > 11 && u.alive) u.damage((-into - 11) * 22, probe.point, dir, 'body', 'crash')
          u.vel.x -= probe.normal.x * into * 1.3
          u.vel.z -= probe.normal.z * into * 1.3
        }
        u.pos.addScaledVector(dir, -Math.max(0, hs * dt + 3.2 - probe.dist) * 0.5)
      }
    }
    if (u.vel.y > 0) {
      var up = G.physics.raycast(u.pos, UP, 2.4)
      if (up) { u.vel.y = 0; u.pos.y -= 2.4 - up.dist }
    }
    // soft map edge
    SXH_edge(u.pos, u.vel, dt)

    // --- attitude (visual tilt) ---
    var f2 = fwdVec(tmp), r2 = rightVec(tmp2)
    var vf = u.vel.x * f2.x + u.vel.z * f2.z, vr = u.vel.x * r2.x + u.vel.z * r2.z
    var af = ((u.vel.x - prevVel.x) * f2.x + (u.vel.z - prevVel.z) * f2.z) / Math.max(dt, 1e-4)
    var ar = ((u.vel.x - prevVel.x) * r2.x + (u.vel.z - prevVel.z) * r2.z) / Math.max(dt, 1e-4)
    prevVel.copy(u.vel)
    var tp = u.landed ? 0 : Math.max(-0.38, Math.min(0.3, -vf / T.boost * 0.32 - af * 0.012))
    var tr = u.landed ? 0 : Math.max(-0.42, Math.min(0.42, -vr / T.strafe * 0.22 - ar * 0.012 - (u.alive ? turnRate * 0.12 : 0)))
    if (!u.alive && u.crash && !u.crash.boomed) { tp = -0.25; tr = 0.5 * Math.sin(u.crash.t * 2) }
    u.pitchV = SXH_damp(u.pitchV, tp, 4, dt)
    u.rollV = SXH_damp(u.rollV, tr, 4, dt)
    m.root.position.copy(u.pos)
    m.root.rotation.set(u.pitchV, u.yaw, u.rollV, 'YXZ')
    m.root.updateMatrixWorld()

    // --- rotors ---
    var spin = u.spool * (u.alive ? 30 : 12)
    m.rotor.rotation.y += spin * dt
    m.tail.rotation.x += spin * 3.2 * dt
    var blurA = Math.max(0, Math.min(1, (u.spool - 0.35) / 0.45))
    m.blurMat.uniforms.uA.value = blurA
    m.blurMat.uniforms.uT.value += dt * 4
    m.tailBlurMat.uniforms.uA.value = blurA
    u.beaconT += dt
    m.beacon.visible = u.alive && (u.beaconT % 1.1) < 0.12

    // --- chin turret tracks the aim (pilot) or rests ---
    var wantYaw = 0, wantPitch = 0.1
    if (u.piloted) {
      var lt2 = tmp3.copy(aim)
      m.turYaw.parent.worldToLocal(lt2)
      var dx = lt2.x - m.turYaw.position.x, dyy = lt2.y - m.turYaw.position.y, dz = lt2.z - m.turYaw.position.z
      wantYaw = Math.max(-1.9, Math.min(1.9, Math.atan2(-dx, -dz)))
      wantPitch = Math.max(-0.25, Math.min(1.2, -Math.atan2(dyy, Math.hypot(dx, dz))))
    }
    m.turYaw.rotation.y = SXH_damp(m.turYaw.rotation.y, wantYaw, 10, dt)
    m.turPitch.rotation.x = SXH_damp(m.turPitch.rotation.x, -wantPitch, 10, dt)

    // --- gun heat / rocket reload ---
    u.heat = Math.max(0, u.heat - T.cool * dt)
    if (u.overheat && u.heat < 0.35) u.overheat = false
    if (u.reloadT > 0) {
      u.reloadT -= dt
      if (u.reloadT <= 0) { u.rockets = T.rockets; u.reloadT = 0; U.sound('reload_magin', { pos: u.pos, gain: 0.9, pitch: 0.7 }) }
    }
    updateRockets(dt)

    // --- rotor wash: sand kicked up under a low hover ---
    u.washT -= dt
    if (u.alive && u.spool > 0.6 && alt < 10 && u.washT <= 0 && G.fx && G.fx.smoke) {
      u.washT = 0.07
      var a = Math.random() * Math.PI * 2, rr = 2 + Math.random() * 4
      var gx = u.pos.x + Math.cos(a) * rr, gz = u.pos.z + Math.sin(a) * rr
      var gy = U.groundAt(gx, gz, u.pos.y)
      var k2 = 1 - alt / 10
      G.fx.smoke(tmp3.set(gx, gy + 0.3, gz), { size: 1.4 + Math.random() * 1.6, life: 1.4, rise: 0.25, count: 1, alpha: 0.24 * k2, color: 0xc9a47a, vel: tmp2.set(Math.cos(a) * 7 * k2, 0.4, Math.sin(a) * 7 * k2) })
    }
    // --- damage smoke ---
    u.smokeT -= dt
    if (u.hp < u.maxHp * 0.45 && u.smokeT <= 0 && G.fx && G.fx.smoke) {
      u.smokeT = u.alive ? 0.12 : 0.06
      var sp = localToWorld(tmp3.set(0.6, 1.0, 1.9), new V3())
      G.fx.smoke(sp, { size: u.alive ? 0.7 : 1.4, life: 2.2, rise: 0.9, count: 1, alpha: u.alive ? 0.32 : 0.55, color: 0x262626 })
    }

    // --- rotor sound ---
    var audible = u.spool > 0.04
    if (audible && !rotorLoop) rotorLoop = SXH_loop(G, 'gull_rotor', { pos: u.pos, gain: 0, pitch: 0.4 })
    if (rotorLoop) {
      rotorLoop.setPos(u.pos)
      rotorLoop.setGain((u.piloted ? 1.25 : 1.7) * u.spool)
      rotorLoop.setPitch(0.3 + 0.16 * u.spool + Math.min(0.06, hs / 600))
      if (!audible) { rotorLoop.stop(0.4); rotorLoop = null }
    }
  }
  var turnRate = 0

  function wreck() {
    u.crash.boomed = true
    u.vel.set(0, 0, 0)
    try { G.fx.explosion(u.pos.clone(), 2.1) } catch (e) { }
    U.blast(u.pos.clone(), 7, 80, 'ally', { fx: false, selfScale: 0.15 })
    try { u.fire = G.fx.addEmitter(u.pos.clone().setY(u.pos.y - 0.4), 'fire', { ttl: 30, scale: 1.3 }) } catch (e) { }
    m.root.rotation.z = 0.35
    m.blades.visible = true
    u.spool = 0
  }

  u.dispose = function () {
    G.scene.remove(m.root)
    rockets.forEach(function (r) { G.scene.remove(r.mesh) })
    rockets.length = 0
    if (rotorLoop) { rotorLoop.stop(0.1); rotorLoop = null }
    try { u.fire && u.fire.stop && u.fire.stop() } catch (e) { }
    m.blurMat.dispose(); m.tailBlurMat.dispose()
  }

  m.root.position.copy(u.pos)
  m.root.rotation.set(0, u.yaw, 0, 'YXZ')
  m.root.updateMatrixWorld()
  return u
}

/* =============================================================== SKUA ==== */

function SXH_skuaModel(G) {
  var M = SXH_mats(G)
  var root = new lt.Group()
  root.name = 'skua'
  var B = new io()
  // angular hull (wedge), armour plates, red hazard bands
  B.add(M.hull, SXH_loft([
    [-3.7, -0.12, 0.24, 0.2, 0.5], [-3.05, -0.02, 0.72, 0.52, 0.42], [-1.8, 0.04, 1.08, 0.74, 0.34],
    [0.2, 0.1, 1.18, 0.82, 0.3], [1.8, 0.16, 0.98, 0.66, 0.34], [3.0, 0.26, 0.52, 0.36, 0.42], [3.7, 0.32, 0.2, 0.16, 0.5],
  ]))
  B.add(M.plate, SXH_loft([[-2.6, 0.62, 0.62, 0.12, 0.5], [-0.4, 0.82, 0.8, 0.14, 0.5], [1.4, 0.74, 0.62, 0.12, 0.5]]))
  B.add(M.hazard, SXH_loft([[-0.25, 0.1, 1.2, 0.84, 0.3], [0.25, 0.11, 1.2, 0.84, 0.3]]))
  B.add(M.red, SXH_loft([[2.45, 0.22, 0.76, 0.52, 0.38], [2.62, 0.23, 0.7, 0.48, 0.38]]))
  // sensor eye socket
  B.add(M.dark, xt(0.42, 0.42, 0.3, 'z', 0, 0.04, -3.1, 20))
  // twin canted tail fins + antenna spikes
  ;[-1, 1].forEach(function (s) {
    var fin = SXH_plate([[2.2, 0.6], [3.4, 0.55], [3.9, 1.85], [3.45, 1.9]], 0.1, 0)
    fin.rotateZ(-s * 0.32).translate(s * 0.45, 0, 0)
    B.add(M.hull, fin)
    B.add(M.dark, Ke([s * 0.3, 0.9, -1.2], [s * 0.42, 1.75, -0.6], 0.025, 5))
  })
  // pylons to the fan ducts
  ;[-1, 1].forEach(function (s) {
    B.add(M.hull, Ee(s * 1.05 - (s > 0 ? 0 : 1.55), -0.05, -0.6, s * 1.05 + (s > 0 ? 1.55 : 0), 0.35, 1.0, 0.08))
    // missile rack under the body + two missile noses
    B.add(M.dark, Ee(s * 0.75 - 0.32, -0.98, -0.4, s * 0.75 + 0.32, -0.7, 1.4, 0.05))
    ;[-0.14, 0.14].forEach(function (o) {
      B.add(M.white, xt(0.11, 0.11, 1.6, 'z', s * 0.75 + o, -1.06, 0.45, 10))
      B.add(M.red, xt(0.0, 0.11, 0.3, 'z', s * 0.75 + o, -1.06, -0.5, 10))
    })
  })
  // chin cannon housing
  B.add(M.dark, Ee(-0.5, -0.9, -2.3, 0.5, -0.6, -1.2, 0.1))
  var body = B.build({ cast: true, recv: true })
  root.add(body)

  // the eye (emissive, flares on telegraph)
  var eyeMat = new lt.MeshBasicMaterial({ color: new lt.Color(5, 0.45, 0.2) })
  var eye = new lt.Mesh(new lt.SphereGeometry(0.31, 18, 12), eyeMat)
  eye.position.set(0, 0.04, -3.34)
  root.add(eye)
  ;[-1, 1].forEach(function (s) {
    var strip = new lt.Mesh(new lt.BoxGeometry(0.07, 0.07, 1.9), eyeMat)
    strip.position.set(s * 0.72, 0.36, -1.7)
    strip.rotation.y = s * 0.08
    root.add(strip)
  })

  // fan ducts (tilt with speed) with spinning fans and glowing hubs (weak points)
  var ducts = []
  ;[-1, 1].forEach(function (s) {
    var g = new lt.Group()
    g.position.set(s * 3.15, 0.15, 0.2)
    var DB = new io()
    DB.add(M.hull, SXH_lathe([[1.55, -0.38], [1.72, -0.3], [1.78, 0.0], [1.7, 0.34], [1.5, 0.4], [1.42, 0.0], [1.5, -0.36], [1.55, -0.38]], 36))
    DB.add(M.red, SXH_lathe([[1.785, -0.1], [1.79, 0.0], [1.785, 0.1], [1.775, 0.1], [1.775, -0.1], [1.785, -0.1]], 36))
    // stator struts
    for (var k = 0; k < 4; k++) DB.add(M.dark, Ee(-1.48, -0.05, -0.05, 1.48, 0.05, 0.05).rotateY(k * Math.PI / 4))
    g.add(DB.build({ cast: true, recv: true }))
    var fan = new lt.Group()
    var FB = new io()
    for (var b = 0; b < 7; b++) FB.add(M.dark, Wi(1.12, 0.04, 0.32, 0.01).translate(0.85, 0.08, 0).rotateX(0.35).rotateY(b * Math.PI * 2 / 7))
    fan.add(FB.build({ cast: false, recv: false }))
    var hub = new lt.Mesh(new lt.CylinderGeometry(0.4, 0.46, 0.42, 18), M.hub)
    var hubCap = new lt.Mesh(new lt.CylinderGeometry(0.3, 0.4, 0.12, 18).translate(0, 0.27, 0), M.dark)
    fan.add(hub, hubCap)
    g.add(fan)
    var blurMat = SXH_blurMat(0x2c2c2e, 0.2)
    var bl = new lt.Mesh(new lt.CircleGeometry(1, 36), blurMat)
    bl.rotation.x = -Math.PI / 2
    bl.position.y = 0.08
    bl.scale.set(1.45, 1.45, 1)
    bl.renderOrder = 872
    g.add(bl)
    root.add(g)
    ducts.push({ g: g, fan: fan, blurMat: blurMat, s: s })
  })

  // chin cannon (yaw → pitch → twin barrels)
  var cYaw = new lt.Group()
  cYaw.position.set(0, -0.95, -1.75)
  var CB = new io()
  CB.add(M.dark, SXH_lathe([[0, -0.15], [0.3, -0.12], [0.34, 0.06], [0.0, 0.1]], 16))
  cYaw.add(CB.build({ cast: true, recv: true }))
  var cPitch = new lt.Group()
  var CP = new io()
  CP.add(M.gun, Ee(-0.2, -0.12, -0.45, 0.2, 0.12, 0.15, 0.04))
  CP.add(M.gun, xt(0.05, 0.05, 1.4, 'z', -0.09, 0, -1.1, 8))
  CP.add(M.gun, xt(0.05, 0.05, 1.4, 'z', 0.09, 0, -1.1, 8))
  cPitch.add(CP.build({ cast: true, recv: true }))
  cYaw.add(cPitch)
  root.add(cYaw)

  // belly strobe
  var strobe = new lt.Mesh(new lt.SphereGeometry(0.08, 8, 6), M.beacon)
  strobe.position.set(0, -0.86, 0.9)
  root.add(strobe)

  return {
    root: root, eye: eye, eyeMat: eyeMat, ducts: ducts, cYaw: cYaw, cPitch: cPitch, strobe: strobe,
    muzzle: new lt.Vector3(0, -0.95, -3.55),
    racks: [new lt.Vector3(-0.75, -1.06, -0.4), new lt.Vector3(0.75, -1.06, -0.4)],
    shapes: [
      { a: [0, 0, -3.3], b: [0, 0.2, 3.2], r: 0.95 },
      { a: [-2.6, 0.15, 0.2], b: [2.6, 0.15, 0.2], r: 0.35 },
      { c: [-3.15, 0.15, 0.2], r: 1.8 },
      { c: [3.15, 0.15, 0.2], r: 1.8 },
      { c: [-3.15, 0.15, 0.2], r: 0.55, part: 'weak' },
      { c: [3.15, 0.15, 0.2], r: 0.55, part: 'weak' },
      { c: [0, 0.04, -3.2], r: 0.32, part: 'weak' },
    ],
  }
}

// --- Skua: AH-64D Apache model (aircraft/assets/apache.glb) ---------------
// The GLB was split offline (sx_rotor / sx_tail / sx_gun nodes) so the main
// rotor, the scissor tail rotor and the chin gun move; its paint is toned to a
// darker hostile grey-olive. Same gameplay as the procedural Skua (which stays
// as the fallback): hp, speed, cannon/missiles, the glowing eye that flares
// before an attack (now on the nose sensor), weak points = rotor head, tail
// rotor, nose sensor. Points below are in the GLB's own frame (x nose, z up,
// y left), mapped to the Skua frame (nose -Z) by SXH_apP.
var SXH_AP = { ready: false, failed: false, started: false, scene: null }
var SXH_APT = {
  s: 4.8, x0: -0.12, z0: -0.12,          // scale; GLB point that becomes the Skua origin
  hub: [0.265, 0, 0.17], rotorR: 0.98,
  tail: [-1.057, 0.1, 0.077], tailR: 0.18,
  gun: [0.56, 0, -0.272], muzzle: [0.87, 0, -0.272],
  racks: [[0.3, 0.25, -0.24], [0.3, -0.25, -0.24]],
  eye: [0.975, 0, -0.135], strobe: [0.2, 0, -0.27],
  exhaust: [[0.06, 0.17, 0.0], [0.06, -0.17, 0.0]],
}
function SXH_apStart() {
  if (SXH_AP.started) return
  SXH_AP.started = true
  if (typeof SX_ASSET_apache !== 'string' || typeof SX_parseGLB !== 'function') { SXH_AP.failed = true; return }
  SX_parseGLB(SX_ASSET_apache).then(function (g) { SXH_AP.scene = g.scene; SXH_AP.ready = true }, function (e) { SXH_AP.failed = true; console.warn('[aircraft] Apache model failed, procedural Skua', e) })
}
function SXH_apP(p, out) {
  var A = SXH_APT
  return (out || new lt.Vector3()).set(-p[1] * A.s, (p[2] - A.z0) * A.s, -(p[0] - A.x0) * A.s)
}
function SXH_apacheModel(G) {
  var M = SXH_mats(G), A = SXH_APT
  var root = new lt.Group()
  root.name = 'skua'
  var body = SXH_AP.scene.clone(true)
  body.rotation.y = Math.PI / 2
  body.scale.setScalar(A.s)
  body.position.set(0, -A.z0 * A.s, A.x0 * A.s)
  body.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  root.add(body)
  root.updateMatrixWorld(true)
  var pivot = function (p, node) {
    var g = new lt.Group()
    g.position.copy(SXH_apP(p))
    root.add(g)
    root.updateMatrixWorld(true)
    var o = body.getObjectByName(node)
    if (o) g.attach(o)
    return g
  }
  var blurs = []
  // main rotor + blur disc
  var rotor = pivot(A.hub, 'sx_rotor')
  var bm = SXH_blurMat(0x2a2c2e, 0.22)
  var bl = new lt.Mesh(new lt.CircleGeometry(1, 48), bm)
  bl.rotation.x = -Math.PI / 2
  bl.scale.set(A.rotorR * A.s, A.rotorR * A.s, 1)
  bl.position.copy(rotor.position).add(new lt.Vector3(0, 0.04, 0))
  bl.renderOrder = 872
  root.add(bl)
  blurs.push({ mat: bm, k: 1 })
  // tail rotor (axis across the boom) + blur
  var tail = pivot(A.tail, 'sx_tail')
  var tm = SXH_blurMat(0x2a2c2e, 0.3)
  var tb = new lt.Mesh(new lt.CircleGeometry(1, 28), tm)
  tb.rotation.y = Math.PI / 2
  tb.scale.set(A.tailR * A.s, A.tailR * A.s, 1)
  tb.position.copy(tail.position)
  tb.renderOrder = 872
  root.add(tb)
  blurs.push({ mat: tm, k: 1.6 })
  // chin gun: yaw → pitch, the barrel GLB part rides on the pitch group
  var cYaw = new lt.Group()
  cYaw.position.copy(SXH_apP(A.gun))
  root.add(cYaw)
  var cPitch = new lt.Group()
  cYaw.add(cPitch)
  root.updateMatrixWorld(true)
  var gun = body.getObjectByName('sx_gun')
  if (gun) cPitch.attach(gun)
  // the eye on the nose sensor (emissive, flares on telegraph)
  var eyeMat = new lt.MeshBasicMaterial({ color: new lt.Color(5, 0.45, 0.2) })
  var eye = new lt.Mesh(new lt.SphereGeometry(0.17, 16, 10), eyeMat)
  eye.position.copy(SXH_apP(A.eye))
  root.add(eye)
  var strobe = new lt.Mesh(new lt.SphereGeometry(0.08, 8, 6), M.beacon)
  strobe.position.copy(SXH_apP(A.strobe))
  root.add(strobe)
  var P = function (a) { return SXH_apP(a).toArray() }
  var wingY = -0.11
  return {
    apache: true,
    root: root, eye: eye, eyeMat: eyeMat, rotor: rotor, tail: tail, blurs: blurs, cYaw: cYaw, cPitch: cPitch, strobe: strobe,
    muzzle: SXH_apP(A.muzzle),
    racks: A.racks.map(function (r) { return SXH_apP(r) }),
    smokeAt: A.exhaust.map(function (r) { return SXH_apP(r) }),
    shapes: [
      { a: P([0.88, 0, -0.15]), b: P([-0.15, 0, -0.1]), r: 0.85 },   // cockpits, cabin, engines
      { a: P([-0.15, 0, -0.08]), b: P([-1.0, 0, -0.08]), r: 0.4 },   // tail boom
      { a: P([-1.1, 0, -0.2]), b: P([-1.18, 0, 0.14]), r: 0.32 },    // fin
      { a: P([0.19, 0.41, wingY]), b: P([0.19, -0.41, wingY]), r: 0.3 }, // stub wings
      { a: P([0.3, 0.29, -0.24]), b: P([0.3, -0.29, -0.24]), r: 0.32 },  // pylons + missiles
      { c: P([0.17, 0.17, -0.02]), r: 0.5 }, { c: P([0.17, -0.17, -0.02]), r: 0.5 }, // engine pods
      { c: P(A.hub), r: 0.62, part: 'weak' },                         // rotor head
      { c: P(A.tail), r: 0.5, part: 'weak' },                         // tail rotor
      { c: P(A.eye), r: 0.32, part: 'weak' },                         // nose sensor
    ],
  }
}

SXU_TYPES.skua = function (G, U, opts) {
  var T = SXH_TUNE.skua
  var V3 = lt.Vector3
  SXH_apStart()
  var m = SXH_AP.ready ? SXH_apacheModel(G) : SXH_skuaModel(G)
  G.scene.add(m.root)
  var tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), tgt = new V3(), UP = new V3(0, 1, 0)
  var rnd = function (a, b) { return a + (b - a) * Math.random() }
  var loop = null
  var missiles = []
  var u = {
    type: 'skua', label: 'Skua Gunship', faction: 'enemy', boss: true, alive: true,
    hp: T.hp, maxHp: T.hp, radius: 5.4,
    pos: opts.pos ? opts.pos.clone() : new V3(40, 45, -120), vel: new V3(), yaw: opts.yaw != null ? opts.yaw : Math.PI,
    pitchV: 0, rollV: 0, mode: 'arrive', orbitA: Math.random() * 6.28, orbitDir: Math.random() < 0.5 ? -1 : 1,
    orbitR: rnd(T.orbitR[0], T.orbitR[1]), alt: rnd(T.alt[0], T.alt[1]), cannonCd: 3, missileCd: 6,
    atk: null, stunT: 0, flash: 0, dyingT: 0, crashed: false, smokeT: 0, strobeT: 0, sparkT: 0, rethinkT: 4,
    // outpost guard: circles opts.home until the player closes in or shoots it
    guard: !!opts.guard, home: (opts.home || opts.pos || new V3()).clone(),
  }
  if (u.guard) { u.mode = 'guard'; u.orbitR = rnd(48, 62); u.alt = rnd(26, 34) }
  var prevVel = new V3()

  u.center = function (out) { return (out || new V3()).copy(u.pos) }
  u.raycast = function (o, d, max) { return SXH_hitShapes(m.root, m.shapes, o, d, max) }
  u.stun = function (sec) {
    if (!u.alive) return
    u.stunT = Math.max(u.stunT, sec)
    u.atk = null
    U.sound('relay_cut', { pos: u.pos, gain: 1, pitch: 0.8 })
  }
  u.damage = function (amount, point, dir, part, source) {
    if (!u.alive || !(amount > 0)) return false
    u.hp -= amount
    u.flash = 0.08
    if ((u.mode === 'arrive' || u.mode === 'guard') && source !== 'enemy') { u.mode = 'orbit'; u.guard = false }
    if (u.hp <= 0) {
      u.hp = 0
      u.alive = false
      u.mode = 'dying'
      u.atk = null
      U.killed(u)
      U.sound('gull_die', { pos: u.pos, gain: 1, pitch: 0.55 })
      try { G.fx.explosion(u.pos.clone(), 1.0) } catch (e) { }
      u.vel.y = Math.max(u.vel.y, 2)
      return true
    }
    return false
  }

  function localToWorld(v, out) { m.root.updateMatrixWorld(); return out.copy(v).applyMatrix4(m.root.matrixWorld) }
  function hasLos(from, to) { return G.physics.lineOfSight(from, to) }

  // ------------------------------------------------------------ attacks
  function startAttack(kind) {
    u.atk = { kind: kind, t: 0, n: 0, next: 0 }
    var tt = kind === 'cannon' ? T.telegraphCannon : T.telegraphMissile
    G.events.emit('enemy:telegraph', { enemy: { type: 'hound', pos: u.pos }, type: kind === 'cannon' ? 'gull' : 'hound', pos: u.pos.clone(), time: tt })
  }
  function cannonShot() {
    var mz = localToWorld(m.muzzle, new V3())
    if (!U.target(tgt)) return
    // lead the target a little, then spray
    var P = G.player
    if (P && P.vel && !U.pilot) tgt.addScaledVector(P.vel, Math.min(0.5, mz.distanceTo(tgt) / 400))
    var d = tmp.copy(tgt).sub(mz).normalize()
    var sp = T.cannonSpread
    d.x += (Math.random() - 0.5) * sp * 2; d.y += (Math.random() - 0.5) * sp * 2; d.z += (Math.random() - 0.5) * sp * 2
    d.normalize()
    var h = U.enemyShot(mz, d, { damage: T.cannonDmg, range: T.cannonRange })
    var end = h && h.point ? h.point : tmp2.copy(mz).addScaledVector(d, T.cannonRange)
    if (G.fx && G.fx.tracer) G.fx.tracer(mz, end, { color: 0xff5a3a, intensity: 22, speed: 220, width: 0.04 })
    G.events.emit('enemy:fire', { type: 'hound', pos: mz.clone() })
    try { G.render.lightPool.flash(mz, 16737843, 50, 8, 0.05) } catch (e) { }
  }
  function launchMissile(side) {
    var p = localToWorld(m.racks[side], new V3())
    var f = tmp.set(-Math.sin(u.yaw), -0.35, -Math.cos(u.yaw)).normalize()
    var M = SXH_mats(G)
    var mb = new io()
    mb.add(M.white, xt(0.11, 0.11, 1.4, 'z', 0, 0, 0, 10))
    mb.add(M.red, xt(0.0, 0.11, 0.3, 'z', 0, 0, -0.85, 10))
    mb.add(M.dark, Ee(-0.26, -0.015, 0.4, 0.26, 0.015, 0.68))
    mb.add(M.dark, Ee(-0.015, -0.26, 0.4, 0.015, 0.26, 0.68))
    var mesh = mb.build({ cast: false, recv: false })
    var fl = new lt.Mesh(new lt.SphereGeometry(0.13, 8, 6).scale(1, 1, 2.4), M.exhaust)
    fl.position.z = 0.85
    mesh.add(fl)
    mesh.position.copy(p)
    G.scene.add(mesh)
    var ms0 = { mesh: mesh, pos: p, dir: f.clone(), speed: 22, t: 0, smokeT: 0, shot: false }
    ms0.target = U.addTarget({ pos: p, r: 0.85, hit: function () { ms0.shot = true } })
    missiles.push(ms0)
    U.sound('gull_fire', { pos: p, gain: 1, pitch: 0.42 })
  }
  function updateMissiles(dt) {
    var haveT = U.target(tgt)
    for (var k = missiles.length - 1; k >= 0; k--) {
      var ms = missiles[k]
      if (ms.shot) {
        // shot down mid-air
        try { G.fx.explosion(ms.pos.clone(), 0.5) } catch (e) { }
        G.scene.remove(ms.mesh)
        missiles.splice(k, 1)
        continue
      }
      ms.t += dt
      ms.speed = Math.min(46, ms.speed + 16 * dt)
      if (haveT && ms.t > 0.25) {
        var want = tmp.copy(tgt).sub(ms.pos).normalize()
        var ang = Math.acos(Math.max(-1, Math.min(1, ms.dir.dot(want))))
        var maxA = T.missileTurn * dt
        if (ang > 1e-4) {
          var k2 = Math.min(1, maxA / ang)
          ms.dir.lerp(want, k2).normalize()
        }
      }
      var step = ms.speed * dt
      var boom = null
      var h = U.cast(ms.pos, ms.dir, step + 0.3, 'ally')
      if (h) boom = h.point
      if (!boom && U.pilot && U.pilot.alive) {
        var ph = U.pilot.raycast(ms.pos, ms.dir, step + 0.3)
        if (ph) boom = ph.point
      }
      if (!boom && haveT && ms.pos.distanceTo(tgt) < 2.2) boom = ms.pos.clone()
      if (!boom && ms.t > 7) boom = ms.pos.clone()
      if (boom) {
        U.removeTarget(ms.target)
        U.blast(boom.clone().addScaledVector(ms.dir, -0.3), T.missileRadius, T.missileDmg, 'enemy', { size: 1.05 })
        G.scene.remove(ms.mesh)
        missiles.splice(k, 1)
        continue
      }
      ms.pos.addScaledVector(ms.dir, step)
      ms.mesh.position.copy(ms.pos)
      ms.mesh.quaternion.setFromUnitVectors(tmp2.set(0, 0, -1), ms.dir)
      ms.smokeT -= dt
      if (ms.smokeT <= 0 && G.fx && G.fx.smoke) {
        ms.smokeT = 0.045
        G.fx.smoke(tmp3.copy(ms.pos).addScaledVector(ms.dir, -0.9), { size: 0.34, life: 1.6, rise: 0.12, count: 1, alpha: 0.2, color: 0x9a948c })
      }
    }
  }

  // ------------------------------------------------------------ brain
  function flyTo(want, maxSpd, dt, k) {
    var d = tmp.copy(want).sub(u.pos)
    var dist = d.length()
    if (dist > 1e-3) d.multiplyScalar(Math.min(maxSpd, dist * 0.9) / dist)
    else d.set(0, 0, 0)
    u.vel.x = SXH_damp(u.vel.x, d.x, k, dt)
    u.vel.y = SXH_damp(u.vel.y, d.y, k * 1.4, dt)
    u.vel.z = SXH_damp(u.vel.z, d.z, k, dt)
  }
  function clearance(x, z) { return U.groundAt(x, z, 999) }

  u.update = function (dt) {
    // the Apache finished loading after this Skua was built: swap the look
    if (!m.apache && SXH_AP.ready) {
      var nm = SXH_apacheModel(G)
      nm.root.position.copy(m.root.position); nm.root.rotation.copy(m.root.rotation)
      G.scene.remove(m.root); G.scene.add(nm.root)
      if (m.ducts) m.ducts.forEach(function (dc) { dc.blurMat.dispose() })
      m.eyeMat.dispose()
      m = nm
    }
    var hasT = !!U.target(tgt)
    var A = SXH_TUNE.arena
    if (u.alive) {
      u.stunT = Math.max(0, u.stunT - dt)
      if (u.mode === 'guard' && hasT && tgt.distanceTo(u.pos) < 150) { u.mode = 'orbit'; u.guard = false; u.rethinkT = 0 }
      var center = u.mode === 'guard' ? u.home : hasT ? tgt : tmp3.set(A.x, 10, A.z)
      if (u.stunT > 0) {
        // EMP: rotors stutter, it sags towards the ground
        var g = clearance(u.pos.x, u.pos.z)
        u.vel.x *= Math.exp(-1.2 * dt); u.vel.z *= Math.exp(-1.2 * dt)
        u.vel.y = SXH_damp(u.vel.y, u.pos.y > g + 9 ? -4 : 0, 2, dt)
        u.sparkT -= dt
        if (u.sparkT <= 0 && G.fx && G.fx.sparks) {
          u.sparkT = 0.15 + Math.random() * 0.2
          G.fx.sparks(localToWorld(m.smokeAt ? m.smokeAt[Math.random() < 0.5 ? 0 : 1] : tmp2.set((Math.random() < 0.5 ? -1 : 1) * 3.15, 0.3, 0.2), new V3()), UP, 8)
        }
      } else {
        // where to be: arrive along the spawn line, then orbit / swing around the target
        if (u.mode === 'arrive') {
          var dist = Math.hypot(center.x - u.pos.x, center.z - u.pos.z)
          if (dist < 75) u.mode = 'orbit'
        }
        u.rethinkT -= dt
        if (u.rethinkT <= 0 && u.mode !== 'guard') {
          u.rethinkT = rnd(5, 9)
          if (Math.random() < 0.4) u.orbitDir *= -1
          u.orbitR = rnd(T.orbitR[0], T.orbitR[1])
          u.alt = rnd(T.alt[0], T.alt[1])
        }
        var spd = u.mode === 'arrive' ? T.approach : u.mode === 'guard' ? T.speed * 0.7 : T.speed
        u.orbitA += u.orbitDir * (spd * 0.75 / u.orbitR) * dt
        var want = tmp2.set(center.x + Math.cos(u.orbitA) * u.orbitR, 0, center.z + Math.sin(u.orbitA) * u.orbitR)
        if (u.mode === 'arrive') want.set(center.x, 0, center.z)
        // keep within the map
        var lim = A.half - A.soft - 10
        want.x = Math.max(A.x - lim, Math.min(A.x + lim, want.x))
        want.z = Math.max(A.z - lim, Math.min(A.z + lim, want.z))
        // altitude over the terrain ahead and below
        var gNow = clearance(u.pos.x, u.pos.z), gAhead = clearance(u.pos.x + u.vel.x * 2, u.pos.z + u.vel.z * 2)
        want.y = Math.max(gNow, gAhead, hasT && u.mode !== 'guard' ? tgt.y - 1 : 0) + u.alt
        want.y = Math.min(want.y, 95)
        flyTo(want, spd, dt, u.mode === 'arrive' ? 0.8 : 1.1)
        // obstacle probe (mast, mesa, hall roof)
        var hs = Math.hypot(u.vel.x, u.vel.z)
        if (hs > 1) {
          var pr = G.physics.raycast(u.pos, tmp3.set(u.vel.x / hs, 0, u.vel.z / hs), 28)
          if (pr) u.vel.y = Math.max(u.vel.y, 10)
        }
        if (u.pos.y < gNow + 8) u.vel.y = Math.max(u.vel.y, 8)
      }
      // face the target (body yaw); a guard faces along its circuit
      if (u.mode === 'guard') {
        var hsg = Math.hypot(u.vel.x, u.vel.z)
        if (hsg > 1) u.yaw += Math.max(-1.3 * dt, Math.min(1.3 * dt, SXH_angDiff(u.yaw, Math.atan2(-u.vel.x, -u.vel.z))))
      } else if (hasT) {
        var wantYaw = Math.atan2(-(tgt.x - u.pos.x), -(tgt.z - u.pos.z))
        var dy = SXH_angDiff(u.yaw, wantYaw)
        var mt = 1.3 * dt
        u.yaw += Math.max(-mt, Math.min(mt, dy))
      }
      // attacks
      if (u.stunT <= 0 && hasT && u.mode !== 'arrive' && u.mode !== 'guard') {
        var eyeP = localToWorld(m.muzzle, new V3())
        var dT = eyeP.distanceTo(tgt)
        u.cannonCd -= dt
        u.missileCd -= dt
        if (!u.atk && dT < 140) {
          var los = hasLos(eyeP, tgt)
          if (los && u.missileCd <= 0 && dT > 18) { startAttack('missile'); u.missileCd = rnd(T.missileCd[0], T.missileCd[1]) }
          else if (los && u.cannonCd <= 0) { startAttack('cannon'); u.cannonCd = rnd(T.cannonCd[0], T.cannonCd[1]) }
        }
        if (u.atk) {
          var a = u.atk
          a.t += dt
          if (a.kind === 'cannon') {
            if (a.t >= T.telegraphCannon) {
              a.next -= dt
              while (a.next <= 0 && a.n < T.burst) { cannonShot(); a.n++; a.next += T.burstGap }
              if (a.n >= T.burst) u.atk = null
            }
          } else if (a.t >= T.telegraphMissile) {
            launchMissile(0)
            launchMissile(1)
            u.atk = null
          }
        }
      }
    } else if (!u.crashed) {
      // dying: smoke trail, spiral down, explode on the ground
      u.dyingT += dt
      u.vel.y -= 9.8 * dt * 0.8
      u.vel.x = SXH_damp(u.vel.x, -Math.sin(u.dyingT * 2.2) * 9, 1, dt)
      u.vel.z = SXH_damp(u.vel.z, Math.cos(u.dyingT * 2.2) * 9, 1, dt)
      u.yaw += 3.2 * dt
      if (G.fx && Math.random() < 0.5 && G.fx.sparks) G.fx.sparks(u.pos, UP, 6)
    }
    u.pos.addScaledVector(u.vel, dt)
    if (u.alive) SXH_edge(u.pos, u.vel, dt)
    if (!u.alive && !u.crashed) {
      var gh = clearance(u.pos.x, u.pos.z)
      if (u.pos.y - 1.0 <= gh) crash(gh)
    }

    // attitude
    var f = tmp.set(-Math.sin(u.yaw), 0, -Math.cos(u.yaw)), r = tmp2.set(Math.cos(u.yaw), 0, -Math.sin(u.yaw))
    var vf = u.vel.x * f.x + u.vel.z * f.z, vr = u.vel.x * r.x + u.vel.z * r.z
    var ar = ((u.vel.x - prevVel.x) * r.x + (u.vel.z - prevVel.z) * r.z) / Math.max(dt, 1e-4)
    prevVel.copy(u.vel)
    var tp = u.crashed ? 0.12 : Math.max(-0.3, Math.min(0.25, -vf * 0.012))
    var tr = u.crashed ? 0.42 : Math.max(-0.5, Math.min(0.5, -vr * 0.018 - ar * 0.01))
    if (!u.alive && !u.crashed) tr = 0.6
    u.pitchV = SXH_damp(u.pitchV, tp, 3, dt)
    u.rollV = SXH_damp(u.rollV, tr, 3, dt)
    m.root.position.copy(u.pos)
    m.root.rotation.set(u.pitchV, u.yaw, u.rollV, 'YXZ')
    m.root.updateMatrixWorld()

    // fans: spin, blur, tilt with forward speed; EMP stutter
    var spinOn = u.crashed ? 0 : u.stunT > 0 ? 0.35 + 0.3 * Math.sin(performance.now() * 0.02) : 1
    if (m.ducts) m.ducts.forEach(function (dc) {
      dc.fan.rotation.y += dc.s * 26 * spinOn * dt
      dc.blurMat.uniforms.uA.value = Math.max(0, spinOn - 0.2)
      dc.blurMat.uniforms.uT.value += dt * 4 * dc.s
      dc.g.rotation.x = SXH_damp(dc.g.rotation.x, Math.max(-0.45, Math.min(0.3, -vf * 0.02)), 3, dt)
    })
    if (m.rotor) {
      // dying: the rotor winds down as it spirals in
      var rs = spinOn * (u.alive ? 1 : Math.max(0.25, 1 - u.dyingT * 0.2))
      m.rotor.rotation.y += 24 * rs * dt
      m.tail.rotation.x += 70 * rs * dt
      m.blurs.forEach(function (b) { b.mat.uniforms.uA.value = Math.max(0, rs - 0.2); b.mat.uniforms.uT.value += dt * 4 * b.k })
    }
    // eye: steady glow, flares while telegraphing, flickers when stunned
    var k = 5
    if (u.atk) k = 5 + 22 * Math.min(1, u.atk.t / (u.atk.kind === 'cannon' ? T.telegraphCannon : T.telegraphMissile))
    if (u.stunT > 0) k = Math.random() < 0.5 ? 0.6 : 4
    if (!u.alive) k = 0.15
    if (u.flash > 0) { u.flash -= dt; k += 6 }
    m.eyeMat.color.setRGB(k, k * 0.09, k * 0.04)
    // cannon tracks the target
    if (hasT && u.alive) {
      var lt2 = tmp3.copy(tgt)
      m.root.worldToLocal(lt2)
      var dx = lt2.x - m.cYaw.position.x, dyy = lt2.y - m.cYaw.position.y, dz = lt2.z - m.cYaw.position.z
      m.cYaw.rotation.y = SXH_damp(m.cYaw.rotation.y, Math.max(-1.6, Math.min(1.6, Math.atan2(-dx, -dz))), 6, dt)
      m.cPitch.rotation.x = SXH_damp(m.cPitch.rotation.x, Math.max(-1.3, Math.min(0.3, Math.atan2(dyy, Math.hypot(dx, dz)))), 6, dt)
    }
    u.strobeT += dt
    m.strobe.visible = u.alive && (u.strobeT % 0.9) < 0.08
    // damage smoke
    u.smokeT -= dt
    if ((u.hp < u.maxHp * 0.5 || !u.alive) && u.smokeT <= 0 && G.fx && G.fx.smoke && !(u.crashed && u.dyingT > 30)) {
      u.smokeT = !u.alive ? 0.04 : 0.14
      var side = Math.random() < 0.5 ? -1 : 1
      G.fx.smoke(localToWorld(m.smokeAt ? m.smokeAt[side > 0 ? 0 : 1] : tmp3.set(side * 3.15, 0.5, 0.4), new V3()), { size: !u.alive ? 1.8 : 0.9, life: 2.6, rise: 1.0, count: 1, alpha: !u.alive ? 0.6 : 0.35, color: 0x1e1e1e })
    }
    updateMissiles(dt)
    // fan sound
    if (!loop && !u.crashed) loop = SXH_loop(G, 'gull_rotor', { pos: u.pos, gain: 0, pitch: 0.6, ref: 12 })
    if (loop) {
      loop.setPos(u.pos)
      loop.setGain(u.crashed ? 0 : 2.2 * (u.stunT > 0 ? 0.5 : 1))
      loop.setPitch(u.alive ? 0.52 + Math.min(0.12, Math.hypot(u.vel.x, u.vel.z) / 200) : 0.38)
      if (u.crashed) { loop.stop(0.6); loop = null }
    }
  }

  function crash(gh) {
    u.crashed = true
    u.pos.y = gh + 0.9
    u.vel.set(0, 0, 0)
    try { G.fx.explosion(u.pos.clone(), 2.4) } catch (e) { }
    U.blast(u.pos.clone(), 9, 70, 'enemy', { fx: false })
    U.sound('explosion', { pos: u.pos, gain: 1.1, pitch: 0.7 })
    if (G.fx && G.fx.debris) G.fx.debris(u.pos.clone(), { count: 30, speed: 12, size: 0.12 })
    try { u.fire = G.fx.addEmitter(u.pos.clone(), 'fire', { ttl: 35, scale: 1.6 }) } catch (e) { }
  }

  u.dispose = function () {
    G.scene.remove(m.root)
    missiles.forEach(function (ms) { G.scene.remove(ms.mesh); U.removeTarget(ms.target) })
    missiles.length = 0
    if (loop) { loop.stop(0.1); loop = null }
    try { u.fire && u.fire.stop && u.fire.stop() } catch (e) { }
    if (m.ducts) m.ducts.forEach(function (dc) { dc.blurMat.dispose() })
    if (m.blurs) m.blurs.forEach(function (b) { b.mat.dispose() })
    m.eyeMat.dispose()
  }

  m.root.position.copy(u.pos)
  m.root.rotation.set(0, u.yaw, 0, 'YXZ')
  m.root.updateMatrixWorld()
  return u
}

// start parsing the Gazelle (Kestrel, parked at the first deploy) and the Apache (Skua) at boot
SXU_PLUGINS.push(function (U, G) { SXH_gzStart(); SXH_apStart() })
