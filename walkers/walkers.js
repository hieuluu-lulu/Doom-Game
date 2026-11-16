// ============================================================================
// DoomZone mod — WALKERS
//   warden   : ally bipedal mech (~4.8 m) the player can board and pilot.
//              Twin arm autocannons (LMB, heat), shoulder rocket pod (RMB,
//              6-rocket salvo, 6 s reload).
//   colossus : enemy hexapod walker (~9 m, boss). Circles the basin on the
//              berm/dunes, heavy cannon with a laser telegraph, arcing missile
//              barrage with ground warning rings, chin machine gun. Rear heat
//              core is its weak point.
// Both follow the UNIT CONTRACT in units/units.js and are spawned by its
// desert director (SXU_TYPES.warden / SXU_TYPES.colossus). Prefix SXW_.
// ============================================================================

var SXW = { mats: null, T: null, geo: null, shake: 0 }

var SXW_WARDEN = {
  hp: 1500, armor: 0.6, walk: 4.0, sprint: 6.6, accel: 8, legTurn: 2.4,
  hipH: 2.3, kneelH: 1.45, thigh: 1.42, shin: 1.48, hipX: 0.66, footX: 0.72, ankleH: 0.33,
  stepWalk: 0.36, stepSprint: 0.27, lift: 0.42,
  cannonDmg: 22, cannonRate: 8.5, heatPerShot: 0.055, cool: 0.34, spread: 0.009,
  rockets: 6, rocketDmg: 85, rocketRadius: 3.6, rocketReload: 6, rocketGap: 0.13,
  camDist: 8.5, camFov: 72,
}

var SXW_COL = {
  hp: 4500, speed: 2.7, turn: 0.45, headTurn: 1.15, bodyH: 5.9, ring: 12,
  stepDur: 0.9, lift: 1.5, femur: 4.0, tibia: 6.0, engage: 1.5,
  cannonCD: [7, 9.5], aim: 1.45, lock: 0.45, shellSpeed: 95, shellDmg: 45, shellR: 5,
  barrageCD: [14, 18], missiles: 5, missileDmg: 22, missileR: 4, missileFlight: 2.6,
  mgRange: 42, mgDmg: 3, mgCD: [2.4, 3.4], mgShots: 10, mgRate: 9, mgSpread: 0.04,
  legDamage: 0.55,
}

/* --------------------------------------------------------------- shared */

function SXW_temps() {
  if (!SXW.T) {
    var V = lt.Vector3
    SXW.T = { a: new V(), b: new V(), c: new V(), d: new V(), e: new V(), f: new V(), g: new V(), h: new V(), m4: new lt.Matrix4(), q: new lt.Quaternion(), UP: new V(0, 1, 0), Z: new V(0, 0, 1) }
  }
  return SXW.T
}

function SXW_materials(G) {
  if (SXW.mats && SXW.mats.G === G) return SXW.mats
  var fb = function (c) { return new lt.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3 }) }
  var get = function (name, scale, c) {
    try { return G.mats.get(name, { triplanar: true, scale: scale }) } catch (e) { return fb(c || 0x888888) }
  }
  var emi = function (c, k) {
    try { return G.mats.emissive(c, k) } catch (e) { return new lt.MeshBasicMaterial({ color: c }) }
  }
  var glass
  try { glass = G.mats.get('glass_dirty') } catch (e) { glass = fb(0x223344) }
  var add = function (c) {
    var m = new lt.MeshBasicMaterial({ color: new lt.Color(c[0], c[1], c[2]), transparent: true, blending: lt.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: lt.DoubleSide })
    return m
  }
  SXW.mats = {
    G: G,
    tan: get('polymer_tan', 0.55, 0x8a7653), olive: get('paint_green', 0.45, 0x4b5a33), steel: get('steel_dark', 0.5, 0x2a2c2e),
    worn: get('steel_worn', 0.55, 0x55585a), gun: get('gunmetal', 0.8, 0x333538), rubber: get('rubber', 0.8, 0x151515),
    hazard: get('hazard_stripes', 0.45, 0xc9a227), white: get('armor_white', 0.3, 0xd8d6cf), orange: get('armor_orange', 0.3, 0xc8561c),
    carbon: get('carbon', 0.6, 0x1a1b1d), glass: glass,
    lampW: emi(0xd8f2ff, 10), lampR: emi(0xff2a14, 16), core: emi(0xff6a1a, 24), rocketGlow: emi(0xffb050, 30),
    laser: add([9, 0.25, 0.12]), ring: add([5, 0.35, 0.18]), shellGlow: add([14, 7, 2.5]),
  }
  return SXW.mats
}

// Per-material geometry bucket -> Group of merged meshes.
function SXW_builder() {
  var map = new Map()
  return {
    add: function (mat, geo) {
      if (!geo || !mat) return
      var a = map.get(mat)
      if (!a) map.set(mat, (a = []))
      a.push(geo)
    },
    build: function (opts) {
      var g = new lt.Group()
      map.forEach(function (geos, mat) {
        var mesh = new lt.Mesh(Ii(geos), mat)
        mesh.castShadow = !(opts && opts.noShadow) && !mat.transparent
        mesh.receiveShadow = true
        g.add(mesh)
      })
      return g
    },
  }
}

// small geometry helpers (local frame: x right, y up, -z forward)
function SXW_box(w, h, d, r, x, y, z, rx, ry, rz) {
  var g = Wi(w, h, d, r)
  if (rx || ry || rz) g.applyMatrix4(new lt.Matrix4().makeRotationFromEuler(new lt.Euler(rx || 0, ry || 0, rz || 0)))
  return g.translate(x || 0, y || 0, z || 0)
}
function SXW_cyl(rt, rb, h, seg, x, y, z, axis, open) {
  var g = new lt.CylinderGeometry(rt, rb, h, seg || 12, 1, !!open)
  if (axis === 'x') g.rotateZ(Math.PI / 2)
  else if (axis === 'z') g.rotateX(Math.PI / 2)
  return g.translate(x || 0, y || 0, z || 0)
}
function SXW_ball(r, x, y, z, ws, hs) {
  return new lt.SphereGeometry(r, ws || 12, hs || 9).translate(x || 0, y || 0, z || 0)
}

// Place obj so its local +Y runs from a to b and local +X lies along `side`.
function SXW_orient(obj, a, b, side) {
  var T = SXW_temps()
  var y = T.a.subVectors(b, a), len = y.length()
  y.divideScalar(len || 1)
  var z = T.b.crossVectors(side, y)
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1)
  z.normalize()
  var x = T.c.crossVectors(y, z)
  T.m4.makeBasis(x, y, z)
  obj.quaternion.setFromRotationMatrix(T.m4)
  obj.position.copy(a)
  return len
}

// 2-bone IK: joint `mid` between root a and target b, bending toward pole.
// Writes the reachable end into `end`.
function SXW_ik(a, b, l1, l2, pole, mid, end) {
  var T = SXW_temps()
  var d = T.d.subVectors(b, a), dist = d.length()
  d.divideScalar(dist || 1)
  var dc = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, dist))
  end.copy(a).addScaledVector(d, dc)
  var x = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - x * x))
  var p = T.e.copy(pole).addScaledVector(d, -pole.dot(d))
  if (p.lengthSq() < 1e-8) p.set(0, 1, 0).addScaledVector(d, -d.y)
  p.normalize()
  mid.copy(a).addScaledVector(d, x).addScaledVector(p, h)
}

function SXW_raySphere(o, d, c, r, max) {
  var ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z
  var b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r
  var h = b * b - cc
  if (h < 0) return -1
  var t = -b - Math.sqrt(h)
  if (t < 0) t = -b + Math.sqrt(h)
  return t >= 0 && t <= max ? t : -1
}
// ray vs capsule (segment pa-pb, radius r); d normalised
function SXW_rayCapsule(o, d, pa, pb, r, max) {
  var bax = pb.x - pa.x, bay = pb.y - pa.y, baz = pb.z - pa.z
  var oax = o.x - pa.x, oay = o.y - pa.y, oaz = o.z - pa.z
  var baba = bax * bax + bay * bay + baz * baz, bard = bax * d.x + bay * d.y + baz * d.z
  var baoa = bax * oax + bay * oay + baz * oaz, rdoa = d.x * oax + d.y * oay + d.z * oaz, oaoa = oax * oax + oay * oay + oaz * oaz
  var a = baba - bard * bard, b = baba * rdoa - baoa * bard, c = baba * oaoa - baoa * baoa - r * r * baba
  var h = b * b - a * c
  if (h >= 0 && a > 1e-9) {
    var t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard
    if (y > 0 && y < baba) return t >= 0 && t <= max ? t : -1
    var ocx = y <= 0 ? oax : o.x - pb.x, ocy = y <= 0 ? oay : o.y - pb.y, ocz = y <= 0 ? oaz : o.z - pb.z
    var b2 = d.x * ocx + d.y * ocy + d.z * ocz, c2 = ocx * ocx + ocy * ocy + ocz * ocz - r * r, h2 = b2 * b2 - c2
    if (h2 > 0) { var t2 = -b2 - Math.sqrt(h2); return t2 >= 0 && t2 <= max ? t2 : -1 }
  }
  return -1
}

// Keep a big body out of tall colliders (walls, containers, tanks, buildings);
// low clutter (sandbags, barriers, crates) is stepped over.
// Surface normal under a foot: the desert height field, flat on boxes/elsewhere.
function SXW_groundNormal(G, x, y, z, out) {
  out.set(0, 1, 0)
  if (typeof SXD_TH === 'function' && SXD_TH && Math.abs(y - SXD_TH(x, z)) < 0.35) {
    var e = 0.5, gx = (SXD_TH(x + e, z) - SXD_TH(x - e, z)) / (2 * e), gz = (SXD_TH(x, z + e) - SXD_TH(x, z - e)) / (2 * e)
    out.set(-gx, 1, -gz).normalize()
  }
  return out
}
function SXW_terrainY(G, x, z) {
  // the bare ground (terrain), not the tops of the boxes it walks past
  return typeof SXD_TH === 'function' && SXD_TH ? SXD_TH(x, z) : G.physics.groundHeight(x, z, 0.5)
}
function SXW_pushOutBoxes(G, pos, r, vel) {
  var boxes = G.physics && G.physics.boxes || []
  var gy = SXW_terrainY(G, pos.x, pos.z)
  for (var k = 0; k < boxes.length; k++) {
    var b = boxes[k]
    if (b.bulletOnly || b.playerOnly) continue
    if (b.max.y - b.min.y < 1.6 || b.max.y < gy + 1.2) continue
    var cx = Math.max(b.min.x, Math.min(b.max.x, pos.x)), cz = Math.max(b.min.z, Math.min(b.max.z, pos.z))
    var dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz
    if (d2 >= r * r) continue
    var d = Math.sqrt(d2)
    if (d < 1e-4) {
      // centre inside the box: leave by the nearest face
      var l = pos.x - b.min.x, rr = b.max.x - pos.x, n = pos.z - b.min.z, f = b.max.z - pos.z, m = Math.min(l, rr, n, f)
      dx = m === l ? -1 : m === rr ? 1 : 0; dz = m === n ? -1 : m === f ? 1 : 0; d = 0
      pos.x += dx * (m + r); pos.z += dz * (m + r)
    } else {
      dx /= d; dz /= d
      pos.x += dx * (r - d); pos.z += dz * (r - d)
    }
    if (vel) { var vn = vel.x * dx + vel.z * dz; if (vn < 0) { vel.x -= dx * vn; vel.z -= dz * vn } }
  }
}
function SXW_damp(cur, target, k, dt) { return target + (cur - target) * Math.exp(-k * dt) }
function SXW_wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a }
function SXW_turn(cur, target, rate, dt) {
  var d = SXW_wrap(target - cur), s = rate * dt
  return cur + (Math.abs(d) <= s ? d : Math.sign(d) * s)
}
function SXW_ease(t) { return t * t * (3 - 2 * t) }
function SXW_rand(a, b) { return a + (b - a) * Math.random() }

// Projectiles owned by a unit (rockets, shells, missiles) + their rings.
function SXW_projectiles(parent) {
  var list = []
  return {
    list: list,
    add: function (p) { list.push(p); parent.add(p.mesh); if (p.ring) parent.add(p.ring) },
    update: function (dt) {
      for (var k = list.length - 1; k >= 0; k--) {
        var p = list[k], keep = true
        try { keep = p.step(dt) !== false } catch (e) { keep = false; console.error('[walkers] projectile', e) }
        if (!keep) { parent.remove(p.mesh); if (p.ring) parent.remove(p.ring); list.splice(k, 1) }
      }
    },
    clear: function () { list.forEach(function (p) { parent.remove(p.mesh); if (p.ring) parent.remove(p.ring) }); list.length = 0 },
  }
}

function SXW_geoCache(M) {
  if (SXW.geo && SXW.geo.M === M) return SXW.geo
  var rocket = SXW_builder()
  rocket.add(M.worn, SXW_cyl(0.085, 0.085, 0.8, 8, 0, 0, 0, 'z'))
  rocket.add(M.white, new lt.ConeGeometry(0.085, 0.22, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.51))
  rocket.add(M.rocketGlow, SXW_ball(0.07, 0, 0, 0.43, 8, 6))
  var missile = SXW_builder()
  missile.add(M.white, SXW_cyl(0.16, 0.16, 1.5, 10, 0, 0, 0, 'z'))
  missile.add(M.orange, new lt.ConeGeometry(0.16, 0.4, 10).rotateX(-Math.PI / 2).translate(0, 0, -0.95))
  missile.add(M.carbon, SXW_box(0.5, 0.04, 0.3, 0.01, 0, 0, 0.6))
  missile.add(M.carbon, SXW_box(0.04, 0.5, 0.3, 0.01, 0, 0, 0.6))
  missile.add(M.rocketGlow, SXW_ball(0.13, 0, 0, 0.8, 8, 6))
  SXW.geo = {
    M: M,
    rocket: rocket, missile: missile,
    beam: new lt.CylinderGeometry(0.035, 0.035, 1, 6, 1, true).translate(0, 0.5, 0),
    dot: new lt.SphereGeometry(0.22, 10, 8),
    ring: new lt.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
    ringIn: new lt.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    shell: new lt.SphereGeometry(0.22, 10, 8),
  }
  // the builders are templates: build once, clone per projectile
  SXW.geo.rocketMesh = rocket.build({ noShadow: true })
  SXW.geo.missileMesh = missile.build({ noShadow: true })
  return SXW.geo
}

function SXW_smoke(G, p, size, alpha) {
  try { G.fx && G.fx.smoke && G.fx.smoke(p, { size: size, life: 1.3, rise: 0.15, count: 1, alpha: alpha }) } catch (e) { }
}
function SXW_dust(G, p, size) {
  try { G.fx && G.fx.smoke && G.fx.smoke(p, { size: size, life: 1.6, rise: 0.25, count: 2, alpha: 0.2, color: 0xc9a47a }) } catch (e) { }
}
function SXW_flash(G, p, color, k, dist, dur) {
  try { G.render && G.render.lightPool && G.render.lightPool.flash(p, color, k, dist, dur) } catch (e) { }
}

// Footstep feel for whoever is near: piloted camera shake or player shake.
function SXW_quake(G, U, p, amount, range) {
  var P = G.player
  if (!P) return
  var d = P.pos.distanceTo(p)
  if (d > range) return
  var k = amount * (1 - d / range)
  if (U.pilot) SXW.shake = Math.max(SXW.shake, k)
  else if (P.addShake) P.addShake(k * 0.6)
}

/* ================================================================ WARDEN */

function SXW_buildWarden(M, C) {
  var parts = {}
  var b
  // pelvis (origin = hip line centre)
  b = SXW_builder()
  b.add(M.steel, SXW_box(1.36, 0.5, 0.9, 0.12, 0, 0, 0))
  b.add(M.gun, SXW_cyl(0.24, 0.24, 0.34, 16, -C.hipX, -0.04, 0, 'x'))
  b.add(M.gun, SXW_cyl(0.24, 0.24, 0.34, 16, C.hipX, -0.04, 0, 'x'))
  b.add(M.tan, SXW_box(1.1, 0.42, 0.16, 0.06, 0, -0.06, -0.5, 0.22))
  b.add(M.tan, SXW_box(1.0, 0.36, 0.14, 0.05, 0, -0.04, 0.5, -0.2))
  b.add(M.steel, SXW_cyl(0.5, 0.56, 0.22, 20, 0, 0.34, 0))
  parts.pelvis = b.build()
  // torso (origin = waist pivot)
  b = SXW_builder()
  b.add(M.tan, SXW_box(1.9, 1.12, 1.55, 0.22, 0, 1.0, 0.08))
  b.add(M.tan, SXW_box(1.55, 0.34, 0.95, 0.12, 0, 1.66, -0.22, -0.06))
  b.add(M.steel, SXW_box(1.5, 0.42, 1.2, 0.1, 0, 0.38, 0.02))
  b.add(M.hazard, SXW_box(0.06, 0.62, 1.05, 0.02, -0.97, 1.0, 0.1))
  b.add(M.hazard, SXW_box(0.06, 0.62, 1.05, 0.02, 0.97, 1.0, 0.1))
  b.add(M.steel, SXW_box(1.3, 0.9, 0.72, 0.12, 0, 1.05, 0.95))
  for (var v = 0; v < 5; v++) b.add(M.gun, SXW_box(1.1, 0.05, 0.06, 0.01, 0, 0.72 + v * 0.13, 1.33))
  b.add(M.worn, SXW_cyl(0.08, 0.1, 0.62, 10, -0.45, 1.75, 1.12))
  b.add(M.worn, SXW_cyl(0.08, 0.1, 0.62, 10, 0.45, 1.75, 1.12))
  b.add(M.lampW, SXW_box(0.2, 0.08, 0.05, 0.02, -0.5, 0.74, -0.72))
  b.add(M.lampW, SXW_box(0.2, 0.08, 0.05, 0.02, 0.5, 0.74, -0.72))
  b.add(M.lampR, SXW_box(0.1, 0.06, 0.04, 0.015, 0.55, 1.38, 1.32))
  b.add(M.steel, Ke(new lt.Vector3(0.62, 1.85, 0.62), new lt.Vector3(0.66, 2.75, 0.78), 0.014, 5))
  b.add(M.tan, SXW_box(0.5, 0.62, 0.72, 0.12, -1.15, 1.25, 0.02))
  b.add(M.tan, SXW_box(0.5, 0.62, 0.72, 0.12, 1.15, 1.25, 0.02))
  b.add(M.steel, SXW_box(1.1, 0.12, 0.5, 0.04, 0, 1.38, -0.62))
  // sensor head on the brow with a lit visor
  b.add(M.steel, SXW_box(0.62, 0.34, 0.5, 0.08, 0.32, 1.98, -0.5))
  b.add(M.lampW, SXW_box(0.46, 0.07, 0.04, 0.02, 0.32, 2.0, -0.76))
  // angled shoulder pauldrons
  b.add(M.tan, SXW_box(0.66, 0.16, 0.86, 0.06, -1.2, 1.66, 0.0, 0, 0, 0.28))
  b.add(M.tan, SXW_box(0.66, 0.16, 0.86, 0.06, 1.2, 1.66, 0.0, 0, 0, -0.28))
  b.add(M.hazard, SXW_box(0.67, 0.05, 0.3, 0.01, 1.2, 1.75, -0.3, 0, 0, -0.28))
  parts.torso = b.build()
  // canopy (hinged at its top edge so it can open when parked)
  b = SXW_builder()
  b.add(M.glass, SXW_box(1.12, 0.6, 0.07, 0.04, 0, -0.33, -0.06, -0.35))
  b.add(M.steel, SXW_box(1.24, 0.08, 0.14, 0.03, 0, 0.0, 0))
  b.add(M.steel, SXW_box(0.07, 0.66, 0.12, 0.02, -0.6, -0.31, -0.07, -0.35))
  b.add(M.steel, SXW_box(0.07, 0.66, 0.12, 0.02, 0.6, -0.31, -0.07, -0.35))
  b.add(M.steel, SXW_box(1.24, 0.08, 0.12, 0.03, 0, -0.62, -0.18))
  parts.canopy = b.build()
  // arms: local origin at the shoulder pivot; side = -1 left / +1 right
  var arm = function (s) {
    var a = SXW_builder()
    a.add(M.gun, SXW_cyl(0.22, 0.22, 0.3, 14, 0, 0, 0, 'x'))
    a.add(M.steel, SXW_box(0.32, 0.36, 0.55, 0.08, s * 0.12, -0.25, -0.08))
    a.add(M.tan, SXW_box(0.46, 0.46, 1.25, 0.1, s * 0.16, -0.46, -0.55))
    a.add(M.hazard, SXW_box(0.47, 0.08, 0.5, 0.02, s * 0.16, -0.2, -0.75))
    a.add(M.steel, SXW_box(0.36, 0.2, 0.4, 0.05, s * 0.16, -0.75, -0.4))
    for (var k = -1; k <= 1; k += 2) {
      a.add(M.gun, SXW_cyl(0.055, 0.065, 0.9, 10, s * 0.16 + k * 0.1, -0.46, -1.6, 'z'))
      a.add(M.gun, SXW_cyl(0.08, 0.08, 0.14, 10, s * 0.16 + k * 0.1, -0.46, -2.05, 'z'))
    }
    return a.build()
  }
  parts.armL = arm(-1)
  parts.armR = arm(1)
  // rocket pod on the left shoulder (local origin at its pivot)
  b = SXW_builder()
  b.add(M.worn, SXW_box(0.78, 0.56, 0.9, 0.08, 0, 0, 0))
  b.add(M.tan, SXW_box(0.82, 0.12, 0.94, 0.04, 0, 0.3, 0.02))
  b.add(M.steel, SXW_box(0.82, 0.08, 0.94, 0.02, 0, -0.3, 0))
  for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) b.add(M.carbon, SXW_cyl(0.09, 0.09, 0.06, 10, -0.24 + c * 0.24, 0.13 - r * 0.26, -0.44, 'z'))
  b.add(M.hazard, SXW_box(0.79, 0.06, 0.4, 0.01, 0, 0.29, 0.2))
  parts.pod = b.build()
  b = SXW_builder()
  for (var r2 = 0; r2 < 2; r2++) for (var c2 = 0; c2 < 3; c2++) b.add(M.rocketGlow, SXW_ball(0.05, -0.24 + c2 * 0.24, 0.13 - r2 * 0.26, -0.43, 8, 6))
  parts.podTips = b.build({ noShadow: true })
  // legs (local +Y along the segment, +Z = front face)
  var thigh = function () {
    var L = C.thigh, t = SXW_builder()
    t.add(M.tan, SXW_box(0.6, L * 0.8, 0.62, 0.12, 0, L * 0.45, 0.02))
    t.add(M.steel, SXW_box(0.42, L * 0.98, 0.38, 0.06, 0, L * 0.5, -0.1))
    t.add(M.gun, SXW_cyl(0.05, 0.05, L * 0.7, 8, 0.2, L * 0.5, -0.18))
    t.add(M.gun, SXW_cyl(0.2, 0.2, 0.52, 16, 0, L, 0, 'x'))
    t.add(M.hazard, SXW_box(0.51, 0.1, 0.2, 0.02, 0, L * 0.18, 0.2))
    return t.build()
  }
  var shin = function () {
    var L = C.shin, t = SXW_builder()
    t.add(M.steel, SXW_box(0.44, L * 0.96, 0.46, 0.08, 0, L * 0.5, 0))
    t.add(M.tan, SXW_box(0.54, L * 0.68, 0.14, 0.05, 0, L * 0.38, 0.26))
    t.add(M.tan, SXW_box(0.56, 0.32, 0.4, 0.08, 0, L * 0.02, 0.12))
    t.add(M.gun, SXW_cyl(0.045, 0.045, L * 0.6, 8, 0, L * 0.5, -0.22))
    t.add(M.gun, SXW_ball(0.17, 0, L, 0))
    return t.build()
  }
  var foot = function () {
    var t = SXW_builder()
    t.add(M.steel, SXW_box(0.62, 0.2, 1.05, 0.06, 0, -0.2, -0.12))
    t.add(M.tan, SXW_box(0.58, 0.16, 0.36, 0.05, 0, -0.08, -0.5))
    t.add(M.rubber, SXW_box(0.6, 0.06, 1.0, 0.02, 0, -0.31, -0.12))
    t.add(M.steel, SXW_box(0.2, 0.14, 0.36, 0.04, 0, -0.2, 0.46))
    return t.build()
  }
  parts.thighL = thigh(); parts.thighR = thigh()
  parts.shinL = shin(); parts.shinR = shin()
  parts.footL = foot(); parts.footR = foot()
  return parts
}

function SXW_makeWarden(G, U, opts) {
  var M = SXW_materials(G), C = SXW_WARDEN, T = SXW_temps()
  var V3 = lt.Vector3
  var P = SXW_buildWarden(M, C)
  var geo = SXW_geoCache(M)
  var root = new lt.Group()
  root.name = 'sx-warden'
  G.scene.add(root)
  // hierarchy: pelvis -> torso -> (canopy, shoulders -> arms, pod)
  var pelvis = P.pelvis, torso = P.torso
  root.add(pelvis)
  pelvis.add(torso)
  torso.position.set(0, 0.35, 0)
  var canopyPivot = new lt.Group()
  canopyPivot.position.set(0, 1.55, -0.72)
  canopyPivot.add(P.canopy)
  torso.add(canopyPivot)
  var shoulderL = new lt.Group(), shoulderR = new lt.Group()
  shoulderL.position.set(-1.28, 1.2, -0.02)
  shoulderR.position.set(1.28, 1.2, -0.02)
  shoulderL.add(P.armL)
  shoulderR.add(P.armR)
  torso.add(shoulderL, shoulderR)
  var podPivot = new lt.Group()
  podPivot.position.set(-0.78, 1.98, 0.32)
  podPivot.add(P.pod, P.podTips)
  torso.add(podPivot)
  var legs = [
    { s: -1, thigh: P.thighL, shin: P.shinL, foot: P.footL },
    { s: 1, thigh: P.thighR, shin: P.shinR, foot: P.footR },
  ]
  legs.forEach(function (l) {
    root.add(l.thigh, l.shin, l.foot)
    l.ground = new V3(); l.from = new V3(); l.to = new V3(); l.t = 1; l.hip = new V3(); l.knee = new V3(); l.ankle = new V3(); l.want = new V3()
  })
  var muzzles = [
    { arm: shoulderR, local: new V3(0.26, -0.46, -2.12) }, { arm: shoulderL, local: new V3(-0.26, -0.46, -2.12) },
    { arm: shoulderR, local: new V3(0.06, -0.46, -2.12) }, { arm: shoulderL, local: new V3(-0.06, -0.46, -2.12) },
  ]
  var projectiles = SXW_projectiles(root)

  var pos = (opts.pos ? opts.pos.clone() : new V3())
  pos.y = U.groundAt(pos.x, pos.z, pos.y + 3)
  var yaw0 = opts.yaw != null ? opts.yaw : 0
  var S = {
    hy: yaw0, ty: yaw0, pitch: 0, vel: new V3(), stand: 0, pelvisY: pos.y + C.kneelH, bob: 0,
    heat: 0, overheat: false, cool: 0, barrel: 0, rockets: C.rockets, reload: 0, salvo: 0, salvoT: 0,
    dying: -1, piloted: false, lean: 0, roll: 0, idleT: 0, canopy: 1,
  }
  var unit = {
    type: 'warden', label: 'Warden', faction: 'ally', vehicle: true, alive: true,
    pos: pos, hp: C.hp, maxHp: C.hp, radius: 3.4, armor: C.armor, enterRadius: 4,
    yaw: yaw0, root: root,
  }

  // plant both feet where it stands
  function footHome(l, out) {
    var c = Math.cos(S.hy), s = Math.sin(S.hy)
    out.set(pos.x + c * l.s * C.footX, 0, pos.z - s * l.s * C.footX)
    out.y = U.groundAt(out.x, out.z, pos.y + 1.5)
    return out
  }
  legs.forEach(function (l) { footHome(l, l.ground); l.from.copy(l.ground); l.to.copy(l.ground) })

  unit.center = function (out) { return (out || new V3()).set(pos.x, S.pelvisY + 0.9, pos.z) }
  unit.enterPoint = function (out) {
    return out.set(pos.x - Math.sin(S.hy) * 1.7, pos.y, pos.z - Math.cos(S.hy) * 1.7)
  }
  unit.anchor = function (out) { return out.set(pos.x, S.pelvisY - 0.2, pos.z) }
  unit.exitPoint = function (out) {
    var c = Math.cos(S.hy), s = Math.sin(S.hy)
    var p = U.spotOutside(pos.x - c * 2.8, pos.z + s * 2.8, 0.5)
    return out.copy(p)
  }

  // hit volumes (world): torso, pelvis, legs, arms
  var hv = { torso: new V3(), pelvis: new V3(), mA: new V3(), mB: new V3() }
  unit.raycast = function (o, d, max) {
    if (!unit.alive) return null
    var best = -1, bestPart = 'body', nrmFrom = null
    torso.getWorldPosition(hv.torso); hv.torso.y += 1.0
    pelvis.getWorldPosition(hv.pelvis)
    var t = SXW_raySphere(o, d, hv.torso, 1.25, max)
    if (t >= 0) { best = t; nrmFrom = hv.torso.clone() }
    t = SXW_raySphere(o, d, hv.pelvis, 0.8, best >= 0 ? best : max)
    if (t >= 0) { best = t; nrmFrom = hv.pelvis.clone() }
    for (var k = 0; k < legs.length; k++) {
      var l = legs[k]
      t = SXW_rayCapsule(o, d, l.hip, l.knee, 0.32, best >= 0 ? best : max)
      if (t >= 0) { best = t; nrmFrom = null }
      t = SXW_rayCapsule(o, d, l.knee, l.ankle, 0.3, best >= 0 ? best : max)
      if (t >= 0) { best = t; nrmFrom = null }
    }
    if (best < 0) return null
    var pt = o.clone().addScaledVector(d, best)
    var n = nrmFrom ? pt.clone().sub(nrmFrom).normalize() : d.clone().negate()
    return { dist: best, point: pt, normal: n, part: bestPart }
  }

  unit.damage = function (amount, point, dir, part, source) {
    if (!unit.alive || !(amount > 0)) return false
    unit.hp -= amount
    if (point && Math.random() < 0.3) { try { G.fx.sparks(point, T.f.set(Math.random() - 0.5, 0.6, Math.random() - 0.5).normalize(), 6) } catch (e) { } }
    if (U.pilot === unit) SXW.shake = Math.max(SXW.shake, Math.min(0.6, amount / 60))
    if (unit.hp <= 0) { die(); return true }
    return false
  }

  function die() {
    unit.alive = false
    unit.hp = 0
    S.dying = 0
    U.killed(unit)
    var c = unit.center(new V3())
    try { G.fx.explosion(c, 1.6) } catch (e) { }
    U.blast(c, 5, 30, 'enemy', { fx: false })
    try { S.fire = G.fx.addEmitter(c.clone().setY(c.y + 0.4), 'fire', { ttl: 45, scale: 1.4 }) } catch (e) { }
  }

  unit.onEnter = function () {
    S.piloted = true
    SXW.shake = 0
    U.sound('reload_bolt', { gain: 1, pitch: 0.55 })
  }
  unit.onExit = function () {
    S.piloted = false
    S.vel.set(0, 0, 0)
  }

  // ---- weapons ----
  var aim = new V3()
  function fireCannon() {
    var m = muzzles[S.barrel % muzzles.length]
    S.barrel++
    var o = m.arm.localToWorld(T.g.copy(m.local))
    var d = T.h.subVectors(aim, o)
    var len = d.length()
    if (len < 1e-3) return
    d.divideScalar(len)
    d.x += (Math.random() - 0.5) * C.spread * 2
    d.y += (Math.random() - 0.5) * C.spread * 2
    d.z += (Math.random() - 0.5) * C.spread * 2
    d.normalize()
    var origin = o.clone()
    U.shoot(origin, d.clone(), { damage: C.cannonDmg, range: 400, tracerFrom: origin })
    try { G.fx.muzzleFlash(origin, d, { scale: 1.7 }) } catch (e) { }
    G.events.emit('weapon:fire', { origin: origin, dir: d.clone(), muzzle: origin, ads: 0, pitch: 0.58, gain: 1.15, weapon: 'warden' })
    S.heat = Math.min(1, S.heat + C.heatPerShot)
    if (S.heat >= 1) { S.overheat = true; U.sound('relay_cut', { gain: 0.6, pitch: 1.4 }) }
    S.recoil = Math.min(1, (S.recoil || 0) + 0.35)
    SXW.shake = Math.max(SXW.shake, 0.08)
  }

  function fireRocket(k) {
    var row = k % 2, col = Math.floor(k / 2)
    var o = podPivot.localToWorld(new V3(-0.24 + (col % 3) * 0.24, 0.13 - row * 0.26, -0.5))
    var target = aim.clone().add(T.f.set(SXW_rand(-0.8, 0.8), SXW_rand(-0.3, 0.6), SXW_rand(-0.8, 0.8)))
    var dir = target.clone().sub(o).normalize()
    dir.y += 0.12
    dir.normalize()
    var mesh = geo.rocketMesh.clone()
    mesh.position.copy(o)
    var p = {
      mesh: mesh, pos: o, dir: dir, speed: 28, t: 0, trail: 0, target: target,
      step: function (dt) {
        p.t += dt
        if (p.t > 4) return boom(p.pos)
        var want = T.a.subVectors(p.target, p.pos).normalize()
        p.dir.lerp(want, Math.min(1, dt * 3.5)).normalize()
        p.speed = Math.min(78, p.speed + 90 * dt)
        var len = p.speed * dt
        var hit = U.cast(p.pos, p.dir, len, 'enemy')
        if (hit) return boom(hit.point)
        p.pos.addScaledVector(p.dir, len)
        p.mesh.position.copy(p.pos)
        p.mesh.quaternion.setFromUnitVectors(T.Z, T.b.copy(p.dir).negate())
        p.trail -= dt
        if (p.trail <= 0) { p.trail = 0.03; SXW_smoke(G, p.pos, 0.32, 0.32) }
      },
    }
    function boom(at) {
      U.blast(at.clone ? at.clone() : at, C.rocketRadius, C.rocketDmg, 'ally', { size: 0.95, selfScale: 0.35 })
      return false
    }
    projectiles.add(p)
    try { G.fx.muzzleFlash(o, dir, { scale: 1.2, color: 0xffb060 }) } catch (e) { }
    U.sound('jump', { pos: o, gain: 0.9, pitch: 0.5 })
    SXW.shake = Math.max(SXW.shake, 0.12)
  }

  // ---- driving (called by the framework while piloted) ----
  unit.drive = function (dt, inp, U2) {
    if (!unit.alive) return
    var mx = inp.move ? inp.move.x : 0, my = inp.move ? inp.move.y : 0
    var ly = U.look.yaw
    var fx = -Math.sin(ly), fz = -Math.cos(ly), rx = Math.cos(ly), rz = -Math.sin(ly)
    var wx = fx * my + rx * mx, wz = fz * my + rz * mx
    var wl = Math.hypot(wx, wz)
    if (wl > 1) { wx /= wl; wz /= wl }
    var sprint = !!inp.sprint && my > 0.5 && !inp.fire
    var speed = (sprint ? C.sprint : C.walk) * (my < -0.1 ? 0.6 : 1) * S.stand
    var tvx = wx * speed, tvz = wz * speed
    var a = C.accel * dt
    var dvx = tvx - S.vel.x, dvz = tvz - S.vel.z, dl = Math.hypot(dvx, dvz)
    if (dl > a) { dvx *= a / dl; dvz *= a / dl }
    S.vel.x += dvx
    S.vel.z += dvz
    S.vel.y -= 22 * dt
    S.sprint = sprint
    var res = G.physics.moveCapsule(pos, S.vel, dt, 1.25, 4.3, true) || {}
    if (res.onGround && S.vel.y < 0) S.vel.y = 0
    // torso follows the look; legs follow the movement (or swing round when twisted too far)
    S.ty = SXW_turn(S.ty, ly, 6, dt)
    var hs = Math.hypot(S.vel.x, S.vel.z)
    var twist = SXW_wrap(S.ty - S.hy)
    if (hs > 0.6 && my >= -0.1) S.hy = SXW_turn(S.hy, ly, C.legTurn, dt)
    else if (Math.abs(twist) > 1.3) S.hy = SXW_turn(S.hy, S.ty - Math.sign(twist) * 1.25, C.legTurn, dt)
    S.pitch = U.look.pitch
    unit.yaw = S.ty
    // weapons
    U.aimPoint(aim, 500)
    S.cool -= dt
    if (inp.fire && !S.overheat && S.cool <= 0 && S.stand > 0.9) { fireCannon(); S.cool += 1 / C.cannonRate; if (S.cool < 0) S.cool = 0 }
    if (S.cool < -0.1) S.cool = -0.1
    if (inp.ads && S.rockets === C.rockets && S.salvo === 0 && S.stand > 0.9) { S.salvo = C.rockets; S.salvoT = 0 }
  }

  unit.camera = function (cam, dt, U2) {
    // over-the-right-shoulder focus above the backpack; pull the shoulder
    // offset in when a dune wall or crate is right beside the mech
    var ly = U.look.yaw
    var c = camFocus.set(pos.x, S.pelvisY + 2.5, pos.z)
    var rx = Math.cos(ly), rz = -Math.sin(ly)
    var off = 1.45
    var hit = G.physics.raycast(c, camSide.set(rx, 0, rz), off + 0.6)
    if (hit) off = Math.max(0, hit.dist - 0.6)
    c.x += rx * off
    c.z += rz * off
    U.chaseCam(cam, c, ly, U.look.pitch, C.camDist, dt, C.camFov)
    if (SXW.shake > 0.002) {
      var k = SXW.shake * 0.22
      cam.position.x += (Math.random() - 0.5) * k
      cam.position.y += (Math.random() - 0.5) * k
      cam.position.z += (Math.random() - 0.5) * k
    }
  }

  unit.hud = function () {
    var heat = S.overheat ? 'OVERHEAT \u2014 COOLING' : 'HEAT ' + Math.round(S.heat * 100) + '%  LMB'
    var rk = S.rockets > 0 && S.salvo === 0 ? 'ROCKETS  ' + S.rockets + '/' + C.rockets + '  RMB' : S.salvo > 0 ? 'ROCKETS  FIRING' : 'ROCKETS  RELOAD ' + Math.max(0, S.reload).toFixed(1) + 's'
    return { hp: unit.hp, maxHp: unit.maxHp, lines: ['CANNONS  ' + heat, rk] }
  }

  // ---- per-frame: gait, pose, weapons cooldown, wreck ----
  var hipW = new V3(), pole = new V3(), tmpEnd = new V3(), side = new V3(), fwd = new V3(), camFocus = new V3(), camSide = new V3()
  unit.update = function (dt, U2) {
    projectiles.update(dt)
    SXW.shake = Math.max(0, SXW.shake - dt * 2.2)
    // weapons cooling / salvo / reload
    S.heat = Math.max(0, S.heat - C.cool * dt * (S.overheat ? 0.8 : 1))
    if (S.overheat && S.heat < 0.35) S.overheat = false
    if (S.salvo > 0) {
      S.salvoT -= dt
      if (S.salvoT <= 0 && unit.alive) { fireRocket(C.rockets - S.salvo); S.salvo--; S.rockets--; S.salvoT = C.rocketGap; if (S.salvo === 0) S.reload = C.rocketReload }
    } else if (S.rockets < C.rockets) {
      S.reload -= dt
      if (S.reload <= 0) { S.rockets = C.rockets; U.sound('reload_magin', { gain: 0.8, pitch: 0.6 }) }
    }
    P.podTips.visible = S.rockets > 0
    S.recoil = Math.max(0, (S.recoil || 0) - dt * 6)

    if (!unit.alive) {
      // wreck: slump onto its knees and lean over
      S.dying += dt
      var k = Math.min(1, S.dying / 1.6)
      S.pelvisY = SXW_damp(S.pelvisY, pos.y + 1.0, 3, dt)
      S.lean = SXW_damp(S.lean, 0.5, 2, dt)
      S.roll = SXW_damp(S.roll, 0.25, 2, dt)
      S.stand = 0
      S.vel.set(0, 0, 0)
      pose(dt, k)
      return
    }
    // stand up while piloted, kneel with the canopy open when parked
    var piloted = U.pilot === unit
    S.stand = SXW_damp(S.stand, piloted ? 1 : 0, piloted ? 3.2 : 2.2, dt)
    if (S.stand > 0.995) S.stand = 1
    S.canopy = SXW_damp(S.canopy, piloted ? 0 : 1, 4, dt)
    if (!piloted) {
      S.vel.x = SXW_damp(S.vel.x, 0, 6, dt)
      S.vel.z = SXW_damp(S.vel.z, 0, 6, dt)
      pos.y = SXW_damp(pos.y, U.groundAt(pos.x, pos.z, pos.y + 1.5), 8, dt)
      S.ty = SXW_turn(S.ty, S.hy, 1.5, dt)
      S.pitch = SXW_damp(S.pitch, 0, 3, dt)
    }
    gait(dt)
    pose(dt, 0)
  }

  function gait(dt) {
    var hs = Math.hypot(S.vel.x, S.vel.z)
    var stepDur = S.sprint ? C.stepSprint : C.stepWalk
    var stepping = null
    for (var k = 0; k < 2; k++) {
      var l = legs[k]
      footHome(l, l.want)
      l.want.x += S.vel.x * 0.3
      l.want.z += S.vel.z * 0.3
      l.want.y = U.groundAt(l.want.x, l.want.z, pos.y + 1.5)
      if (l.t < 1) stepping = l
    }
    if (!stepping) {
      var worst = null, err = 0
      for (var j = 0; j < 2; j++) {
        var e = Math.hypot(legs[j].ground.x - legs[j].want.x, legs[j].ground.z - legs[j].want.z)
        if (e > err) { err = e; worst = legs[j] }
      }
      var thresh = hs > 0.4 ? 0.3 : 0.16
      if (worst && err > thresh) {
        worst.t = 0
        worst.from.copy(worst.ground)
        worst.to.copy(worst.want)
        worst.to.x += S.vel.x * stepDur * 0.5
        worst.to.z += S.vel.z * stepDur * 0.5
        worst.to.y = U.groundAt(worst.to.x, worst.to.z, pos.y + 1.5)
        worst.dur = stepDur
        stepping = worst
      }
    }
    if (stepping) {
      var l2 = stepping
      l2.t = Math.min(1, l2.t + dt / l2.dur)
      var e2 = SXW_ease(l2.t)
      l2.ground.lerpVectors(l2.from, l2.to, e2)
      l2.lift = Math.sin(Math.PI * l2.t) * C.lift * Math.min(1, 0.4 + hs / 4)
      if (l2.t >= 1) {
        l2.lift = 0
        l2.ground.copy(l2.to)
        if (hs > 0.3 || S.stand > 0.5) {
          U.sound('hound_step', { pos: l2.ground, gain: 1, pitch: 0.5 })
          SXW_dust(G, l2.ground, 0.7)
          SXW_quake(G, U, l2.ground, S.sprint ? 0.32 : 0.22, 22)
        }
      }
    }
    // pelvis height & bob
    var gAvg = Math.max(pos.y, (legs[0].ground.y + legs[1].ground.y) / 2)
    var h = C.kneelH + (C.hipH - C.kneelH) * S.stand
    var bob = 0
    for (var b = 0; b < 2; b++) if (legs[b].t < 1) bob = Math.sin(Math.PI * legs[b].t) * 0.09 * Math.min(1, hs / 3)
    S.pelvisY = SXW_damp(S.pelvisY, gAvg + h - 0.1 + bob, 10, dt)
    // lean into acceleration
    var c = Math.cos(S.hy), s = Math.sin(S.hy)
    var vf = -S.vel.x * s - S.vel.z * c, vr = S.vel.x * c - S.vel.z * s
    S.lean = SXW_damp(S.lean, -vf * 0.012 + (1 - S.stand) * 0.18, 4, dt)
    S.roll = SXW_damp(S.roll, -vr * 0.012, 4, dt)
  }

  function pose(dt, wreck) {
    pelvis.position.set(pos.x, S.pelvisY, pos.z)
    pelvis.rotation.set(S.lean, S.hy, S.roll, 'YXZ')
    torso.rotation.set(-S.lean * 0.4 + (1 - S.stand) * 0.12 + wreck * 0.3, SXW_wrap(S.ty - S.hy), 0, 'YXZ')
    var ap = Math.max(-0.8, Math.min(0.7, S.pitch + 0.08)) * S.stand - (1 - S.stand) * 0.5 - wreck * 0.6
    shoulderL.rotation.x = ap + (S.recoil || 0) * 0.04
    shoulderR.rotation.x = ap + (S.recoil || 0) * 0.04
    podPivot.rotation.x = ap * 0.6
    canopyPivot.rotation.x = -1.05 * S.canopy
    pelvis.updateMatrixWorld(true)
    // legs (2-bone IK, knees forward)
    var c = Math.cos(S.hy), s = Math.sin(S.hy)
    side.set(c, 0, -s)
    fwd.set(-s, 0, -c)
    for (var k = 0; k < 2; k++) {
      var l = legs[k]
      l.hip.set(l.s * C.hipX, -0.05, 0)
      pelvis.localToWorld(l.hip)
      var target = T.f.copy(l.ground)
      target.y += C.ankleH + (l.lift || 0)
      pole.copy(fwd).addScaledVector(side, l.s * 0.12)
      pole.y += 0.1
      SXW_ik(l.hip, target, C.thigh, C.shin, pole, l.knee, l.ankle)
      SXW_orient(l.thigh, l.hip, l.knee, side)
      SXW_orient(l.shin, l.knee, l.ankle, side)
      l.foot.position.copy(l.ankle)
      // sole flat on the ground: pitch/roll from the surface normal in the foot's heading frame
      var gn = SXW_groundNormal(G, l.ground.x, l.ground.y, l.ground.z, T.g)
      var ch = Math.cos(-S.hy), sh = Math.sin(-S.hy)
      var nx = gn.x * ch + gn.z * sh, nz = -gn.x * sh + gn.z * ch
      var lift = Math.min(1, (l.lift || 0) / 0.4)
      var fa = Math.atan2(nz, gn.y) * (1 - lift), fb = Math.asin(Math.max(-1, Math.min(1, -nx))) * (1 - lift)
      l.foot.rotation.set(fa + wreck * 0.4, S.hy, fb, 'YXZ')
    }
  }

  unit.dispose = function () {
    projectiles.clear()
    G.scene.remove(root)
    try { S.fire && S.fire.stop() } catch (e) { }
  }

  gait(0.016)
  S.pelvisY = pos.y + C.kneelH
  pose(0, 0)
  return unit
}

/* ============================================================== COLOSSUS */

var SXW_COL_LEGS = [
  // [side, hipZ, restX, restZ]  (body-local; -z forward)
  [-1, -2.8, -5.9, -5.4], [-1, 0, -7.1, 0], [-1, 2.8, -5.9, 5.4],
  [1, -2.8, 5.9, -5.4], [1, 0, 7.1, 0], [1, 2.8, 5.9, 5.4],
]
var SXW_TRIPOD = [[0, 2, 4], [1, 3, 5]]
var SXW_COL_HIPX = 2.75

function SXW_buildColossus(M, C) {
  var parts = {}
  var b = SXW_builder()
  // carapace: armoured hull, dorsal plates, belly frame
  b.add(M.white, SXW_box(5.4, 2.1, 7.8, 0.6, 0, 0, 0))
  b.add(M.white, SXW_box(4.3, 0.6, 2.5, 0.25, 0, 1.25, -1.9, 0.08))
  b.add(M.white, SXW_box(4.5, 0.65, 2.8, 0.25, 0, 1.3, 1.0))
  b.add(M.carbon, SXW_box(4.0, 0.25, 0.5, 0.08, 0, 1.45, -0.45))
  b.add(M.orange, SXW_box(0.12, 0.6, 6.6, 0.05, -2.72, 0.2, 0))
  b.add(M.orange, SXW_box(0.12, 0.6, 6.6, 0.05, 2.72, 0.2, 0))
  b.add(M.orange, SXW_box(2.8, 0.1, 2.0, 0.03, 0, 1.64, 1.0))
  b.add(M.steel, SXW_box(4.2, 1.0, 6.6, 0.25, 0, -1.3, 0))
  b.add(M.gun, SXW_box(3.0, 0.5, 5.0, 0.12, 0, -1.9, 0))
  // armour skirts over the hips
  for (var k = 0; k < SXW_COL_LEGS.length; k++) {
    var L = SXW_COL_LEGS[k]
    b.add(M.carbon, SXW_box(1.1, 1.1, 1.3, 0.18, L[0] * 2.5, -0.55, L[1]))
    b.add(M.gun, SXW_cyl(0.52, 0.52, 0.7, 18, L[0] * SXW_COL_HIPX, -0.55, L[1]))
    b.add(M.white, SXW_box(0.9, 0.18, 1.6, 0.06, L[0] * 2.6, 0.25, L[1], 0, 0, -L[0] * 0.35))
  }
  // rear heat core housing + vents (the core itself is a separate glowing mesh)
  b.add(M.steel, SXW_cyl(1.25, 1.4, 1.0, 24, 0, -0.6, 3.95, 'z'))
  for (var v = 0; v < 4; v++) b.add(M.gun, SXW_box(2.2, 0.08, 0.14, 0.02, 0, -1.12 + v * 0.34, 4.66))
  b.add(M.hazard, SXW_box(1.8, 0.36, 0.07, 0.02, 0, 0.55, 3.92))
  // side running lights
  b.add(M.lampR, SXW_box(0.07, 0.12, 0.36, 0.02, -2.79, 0.75, -3.1))
  b.add(M.lampR, SXW_box(0.07, 0.12, 0.36, 0.02, 2.79, 0.75, -3.1))
  parts.body = b.build()
  b = SXW_builder()
  b.add(M.core, SXW_ball(0.72, 0, -0.6, 4.4, 16, 12))
  parts.core = b.build({ noShadow: true })
  // head (local origin = neck pivot)
  b = SXW_builder()
  b.add(M.white, SXW_box(2.5, 1.6, 2.4, 0.42, 0, 0, -0.7))
  b.add(M.orange, SXW_box(2.6, 0.28, 1.3, 0.1, 0, 0.78, -1.1))
  b.add(M.carbon, SXW_box(1.3, 0.62, 0.5, 0.12, 0, 0.06, -1.95))
  b.add(M.steel, SXW_box(0.8, 0.42, 0.7, 0.1, -0.78, -0.78, -1.6))
  b.add(M.gun, SXW_box(2.0, 0.3, 1.4, 0.08, 0, -0.85, -0.4))
  parts.head = b.build()
  b = SXW_builder()
  b.add(M.lampR, SXW_ball(0.26, 0, 0.08, -2.22, 12, 9))
  b.add(M.lampR, SXW_ball(0.14, -0.38, 0.14, -2.2, 10, 8))
  b.add(M.lampR, SXW_ball(0.14, 0.38, 0.14, -2.2, 10, 8))
  parts.eye = b.build({ noShadow: true })
  // heavy cannon (local origin = trunnion, barrel along -z)
  b = SXW_builder()
  b.add(M.steel, SXW_box(1.0, 1.0, 1.9, 0.18, 0, 0, -0.2))
  b.add(M.gun, SXW_cyl(0.25, 0.3, 4.4, 18, 0, 0, -3.3, 'z'))
  b.add(M.gun, SXW_cyl(0.34, 0.34, 0.9, 18, 0, 0, -1.6, 'z'))
  b.add(M.gun, SXW_box(0.78, 0.5, 0.6, 0.1, 0, 0, -5.55))
  b.add(M.orange, SXW_box(1.02, 0.2, 1.0, 0.05, 0, 0.42, -0.2))
  parts.cannon = b.build()
  // chin machine gun (twin barrels, along -z)
  b = SXW_builder()
  b.add(M.carbon, SXW_box(0.55, 0.46, 0.7, 0.1, 0, 0, 0))
  b.add(M.gun, SXW_cyl(0.07, 0.07, 1.1, 10, -0.12, 0, -0.85, 'z'))
  b.add(M.gun, SXW_cyl(0.07, 0.07, 1.1, 10, 0.12, 0, -0.85, 'z'))
  parts.mg = b.build()
  // missile pods (tilted back, tubes facing up-forward)
  var pod = function () {
    var p = SXW_builder()
    p.add(M.white, SXW_box(1.4, 1.0, 2.0, 0.14, 0, 0, 0))
    p.add(M.orange, SXW_box(1.42, 0.14, 2.02, 0.03, 0, -0.33, 0))
    for (var r = 0; r < 3; r++) for (var c = 0; c < 2; c++) p.add(M.carbon, SXW_cyl(0.18, 0.18, 0.06, 12, -0.33 + c * 0.66, 0.51, -0.62 + r * 0.62))
    return p.build()
  }
  parts.podL = pod(); parts.podR = pod()
  // legs: coxa, femur, tibia (local +Y along the segment, +Z = outer face)
  parts.legs = []
  for (var j = 0; j < 6; j++) {
    var cx = SXW_builder()
    cx.add(M.carbon, SXW_box(0.95, 1.4, 0.95, 0.18, 0, 0.6, 0))
    cx.add(M.gun, SXW_cyl(0.5, 0.5, 1.1, 16, 0, 1.36, 0, 'z'))
    var Lf = C.femur, fm = SXW_builder()
    fm.add(M.white, SXW_box(1.3, Lf * 0.86, 1.05, 0.3, 0, Lf * 0.5, 0))
    fm.add(M.orange, SXW_box(1.34, Lf * 0.44, 0.12, 0.05, 0, Lf * 0.56, 0.56))
    fm.add(M.steel, SXW_cyl(0.16, 0.16, Lf * 0.72, 10, 0, Lf * 0.5, -0.66))
    fm.add(M.gun, SXW_cyl(0.58, 0.58, 1.3, 18, 0, Lf, 0, 'x'))
    var Lt = C.tibia, tb = SXW_builder()
    tb.add(M.white, SXW_box(1.2, Lt * 0.46, 1.1, 0.3, 0, Lt * 0.26, 0))
    tb.add(M.steel, SXW_box(0.78, Lt * 0.95, 0.7, 0.15, 0, Lt * 0.5, 0))
    tb.add(M.carbon, SXW_box(0.86, Lt * 0.32, 0.8, 0.12, 0, Lt * 0.72, 0))
    tb.add(M.orange, SXW_box(1.22, 0.12, 1.12, 0.04, 0, Lt * 0.5, 0))
    tb.add(M.gun, new lt.ConeGeometry(0.45, 1.0, 10).rotateX(Math.PI).translate(0, Lt - 0.5, 0))
    tb.add(M.gun, SXW_cyl(0.75, 0.85, 0.22, 12, 0, Lt - 0.11, 0))
    parts.legs.push({ coxa: cx.build(), femur: fm.build(), tibia: tb.build() })
  }
  return parts
}

function SXW_makeColossus(G, U, opts) {
  var M = SXW_materials(G), C = SXW_COL, T = SXW_temps()
  var V3 = lt.Vector3
  var P = SXW_buildColossus(M, C)
  var geo = SXW_geoCache(M)
  var root = new lt.Group()
  root.name = 'sx-colossus'
  G.scene.add(root)
  var body = new lt.Group()
  body.add(P.body, P.core)
  root.add(body)
  var neck = new lt.Group()
  neck.position.set(0, 0.45, -3.95)
  neck.add(P.head, P.eye)
  body.add(neck)
  var cannonPivot = new lt.Group()
  cannonPivot.position.set(1.55, 0.05, -0.6)
  cannonPivot.add(P.cannon)
  neck.add(cannonPivot)
  var mgPivot = new lt.Group()
  mgPivot.position.set(-0.78, -0.78, -2.0)
  mgPivot.add(P.mg)
  neck.add(mgPivot)
  P.podL.position.set(-1.35, 1.85, 2.0)
  P.podR.position.set(1.35, 1.85, 2.0)
  P.podL.rotation.x = -0.35
  P.podR.rotation.x = -0.35
  body.add(P.podL, P.podR)
  var legs = []
  for (var k = 0; k < 6; k++) {
    var L = SXW_COL_LEGS[k], lp = P.legs[k]
    root.add(lp.coxa, lp.femur, lp.tibia)
    legs.push({ s: L[0], hipZ: L[1], rest: new V3(L[2], 0, L[3]), coxa: lp.coxa, femur: lp.femur, tibia: lp.tibia, hip: new V3(), troc: new V3(), knee: new V3(), foot: new V3(), ground: new V3(), from: new V3(), to: new V3(), want: new V3(), t: 1, lift: 0 })
  }
  // laser sight + end dot
  var laser = new lt.Mesh(geo.beam, M.laser)
  laser.visible = false
  laser.frustumCulled = false
  laser.renderOrder = 905
  var laserDot = new lt.Mesh(geo.dot, M.laser)
  laserDot.visible = false
  root.add(laser, laserDot)
  var projectiles = SXW_projectiles(root)

  var pos = opts.pos ? opts.pos.clone() : new V3(70, 0, 0)
  SXW_pushOutBoxes(G, pos, 3.4, null)
  pos.y = SXW_terrainY(G, pos.x, pos.z)
  var S = {
    by: opts.yaw != null ? opts.yaw : 0, hy: 0, cp: 0, bodyY: pos.y + C.bodyH, pitch: 0, roll: 0,
    vel: new V3(), state: 'walk', stun: 0, dying: -1,
    cannonT: SXW_rand(4.5, 6.5), barrageT: SXW_rand(9, 12), mgT: SXW_rand(1.5, 2.5),
    aimT: -1, aimPt: new V3(), lockPt: new V3(), mgLeft: 0, mgGap: 0, noLos: 0, sag: 0, booms: [], wreck: false, seen: false,
    // outpost guard: patrol round `home` until the player comes near or shoots it
    guard: !!opts.guard, alerted: !opts.guard, home: (opts.home || pos).clone(), patrol: new V3(), patrolT: 0,
    launchQ: [],
  }
  S.patrol.copy(S.home)
  var unit = {
    type: 'colossus', label: 'Colossus', faction: 'enemy', boss: true, alive: true,
    pos: pos, hp: C.hp, maxHp: C.hp, radius: 9.5, root: root, debug: S,
  }

  // basin geometry (desert): keep to the ring of berm/dunes around it
  var basin = null
  if (typeof SXD_basinSd === 'function' && typeof SXD_BOUND !== 'undefined') {
    var B = SXD_BOUND
    basin = { cx: (B.x0 + B.x1) / 2, cz: (B.z0 + B.z1) / 2, edge: [] }
    for (var a = 0; a < 72; a++) {
      var th = a / 72 * Math.PI * 2, lo = 0, hi = 160
      for (var it = 0; it < 24; it++) { var mid = (lo + hi) / 2; SXD_basinSd(basin.cx + Math.cos(th) * mid, basin.cz + Math.sin(th) * mid) > 0 ? (hi = mid) : (lo = mid) }
      basin.edge.push(hi)
    }
  }
  function edgeAt(th) {
    var f = ((th / (Math.PI * 2)) % 1 + 1) % 1 * 72, i = Math.floor(f) % 72, j = (i + 1) % 72, t = f - Math.floor(f)
    return basin.edge[i] * (1 - t) + basin.edge[j] * t
  }
  function insideBasin(x, z) { return basin ? SXD_basinSd(x, z) < 3 : false }

  // ---- world-space joints for hits / IK ----
  var tmpV = new V3(), tgt = new V3(), muzzle = new V3(), mgMuzzle = new V3(), corePos = new V3()
  var hull = [new V3(0, 0.1, -2.6), new V3(0, 0.3, 0.1), new V3(0, 0.3, 2.1)], hullR = [2.8, 3.0, 2.1], hullW = [new V3(), new V3(), new V3()]
  var headW = new V3(), cannonA = new V3(), cannonB = new V3()
  function refreshHitShapes() {
    for (var k = 0; k < 3; k++) body.localToWorld(hullW[k].copy(hull[k]))
    neck.localToWorld(headW.set(0, 0, -0.7))
    cannonPivot.localToWorld(cannonA.set(0, 0, -0.5))
    cannonPivot.localToWorld(cannonB.set(0, 0, -5.7))
    body.localToWorld(corePos.set(0, -0.6, 4.4))
  }

  unit.center = function (out) { return (out || new V3()).set(pos.x, S.bodyY + 0.6, pos.z) }
  unit.raycast = function (o, d, max) {
    if (!unit.alive) return null
    var best = max, part = null, nc = null
    var t = SXW_raySphere(o, d, corePos, 0.78, best)
    if (t >= 0) { best = t; part = 'weak'; nc = corePos }
    for (var k = 0; k < 3; k++) { t = SXW_raySphere(o, d, hullW[k], hullR[k], best); if (t >= 0) { best = t; part = 'body'; nc = hullW[k] } }
    t = SXW_raySphere(o, d, headW, 1.7, best)
    if (t >= 0) { best = t; part = 'body'; nc = headW }
    t = SXW_rayCapsule(o, d, cannonA, cannonB, 0.4, best)
    if (t >= 0) { best = t; part = 'body'; nc = null }
    for (var j = 0; j < legs.length; j++) {
      var l = legs[j]
      t = SXW_rayCapsule(o, d, l.troc, l.knee, 0.68, best)
      if (t >= 0) { best = t; part = 'leg'; nc = null }
      t = SXW_rayCapsule(o, d, l.knee, l.foot, 0.52, best)
      if (t >= 0) { best = t; part = 'leg'; nc = null }
    }
    if (!part) return null
    var pt = o.clone().addScaledVector(d, best)
    return { dist: best, point: pt, normal: nc ? pt.clone().sub(nc).normalize() : d.clone().negate(), part: part }
  }

  unit.damage = function (amount, point, dir, part, source) {
    if (!unit.alive || !(amount > 0)) return false
    if (part === 'leg') amount *= C.legDamage
    unit.hp -= amount
    S.seen = true
    S.hit = true
    S.alerted = true
    if (part === 'weak' && point) { try { G.fx.sparks(point, T.f.set(0, 0.4, 1).normalize(), 10) } catch (e) { } }
    if (unit.hp <= 0) { die(); return true }
    return false
  }

  unit.stun = function (sec) {
    if (!unit.alive) return
    S.stun = Math.max(S.stun, sec * 0.6)
    S.aimT = -1
    S.mgLeft = 0
    S.launchQ.length = 0
    laser.visible = laserDot.visible = false
    U.sound('relay_cut', { pos: pos, gain: 1, pitch: 0.7 })
  }

  function die() {
    unit.alive = false
    unit.hp = 0
    S.state = 'dying'
    S.dying = 0
    laser.visible = laserDot.visible = false
    P.eye.visible = false
    U.killed(unit)
    for (var k = 0; k < 7; k++) S.booms.push(0.25 + k * 0.48 + Math.random() * 0.2)
    U.radio('Control: the walker is down. Good kill.', 4)
  }

  // ---- attacks ----
  function fireShell() {
    cannonPivot.localToWorld(muzzle.set(0, 0, -5.9))
    var dir = T.a.subVectors(S.lockPt, muzzle).normalize().clone()
    var mesh = new lt.Mesh(geo.shell, M.shellGlow)
    mesh.position.copy(muzzle)
    var p = {
      mesh: mesh, pos: muzzle.clone(), vel: dir.multiplyScalar(C.shellSpeed), t: 0, trail: 0,
      step: function (dt) {
        p.t += dt
        if (p.t > 3) return false
        p.vel.y -= 3 * dt
        var len = p.vel.length() * dt
        var d = T.b.copy(p.vel).normalize()
        var hit = U.cast(p.pos, d, len, 'ally')
        if (hit) { U.blast(hit.point.clone(), C.shellR, C.shellDmg * (U.pilot ? 1.6 : 1), 'enemy', { size: 1.4 }); return false }
        p.pos.addScaledVector(d, len)
        p.mesh.position.copy(p.pos)
        p.trail -= dt
        if (p.trail <= 0) { p.trail = 0.02; SXW_smoke(G, p.pos, 0.45, 0.28) }
      },
    }
    projectiles.add(p)
    try { G.fx.muzzleFlash(muzzle, dir.clone().normalize(), { scale: 4 }) } catch (e) { }
    SXW_flash(G, muzzle, 0xffb060, 160, 18, 0.12)
    U.sound('explosion', { pos: muzzle, gain: 0.8, pitch: 1.55 })
    SXW_quake(G, U, muzzle, 0.25, 60)
    S.recoil = 1
  }

  function launchMissile(k, target) {
    var pod = k % 2 ? P.podR : P.podL
    var start = pod.localToWorld(new V3(-0.33 + (k % 2) * 0.66, 0.65, -0.62 + (k % 3) * 0.62))
    var end = target.clone().add(T.a.set(SXW_rand(-6, 6), 0, SXW_rand(-6, 6)))
    end.y = U.groundAt(end.x, end.z, end.y + 6)
    var apex = start.clone().lerp(end, 0.45)
    apex.y = Math.max(start.y, end.y) + 22 + Math.random() * 6
    var mesh = geo.missileMesh.clone()
    var ring = new lt.Group()
    var r1 = new lt.Mesh(geo.ring, M.ring), r2 = new lt.Mesh(geo.ringIn, M.ring)
    r2.scale.setScalar(0.001)
    ring.add(r1, r2)
    ring.position.copy(end).setY(end.y + 0.06)
    ring.scale.setScalar(C.missileR)
    ring.renderOrder = 900
    var dur = C.missileFlight + Math.random() * 0.5
    var p = {
      mesh: mesh, ring: ring, t: 0, trail: 0, prev: start.clone(), cur: start.clone(), whizzed: false, shot: false,
      step: function (dt) {
        if (p.shot) {
          // shot down: a small air burst, no damage to the ground below
          try { G.fx.explosion(p.cur.clone(), 0.55) } catch (e) { }
          U.removeTarget(p.target)
          return false
        }
        p.t += dt / dur
        var t = Math.min(1, p.t), u = 1 - t
        p.cur.set(u * u * start.x + 2 * u * t * apex.x + t * t * end.x, u * u * start.y + 2 * u * t * apex.y + t * t * end.y, u * u * start.z + 2 * u * t * apex.z + t * t * end.z)
        var d = T.b.subVectors(p.cur, p.prev), len = d.length()
        if (len > 1e-4) {
          d.divideScalar(len)
          if (t > 0.12) {
            var hit = U.cast(p.prev, d, len, 'ally')
            if (hit) { U.removeTarget(p.target); U.blast(hit.point.clone(), C.missileR, C.missileDmg * (U.pilot ? 1.4 : 1), 'enemy', { size: 1.0 }); return false }
          }
          p.mesh.quaternion.setFromUnitVectors(T.Z, T.c.copy(d).negate())
        }
        p.mesh.position.copy(p.cur)
        p.prev.copy(p.cur)
        p.trail -= dt
        if (p.trail <= 0) { p.trail = 0.035; SXW_smoke(G, p.cur, 0.5, 0.3) }
        r2.scale.setScalar(Math.max(0.001, t))
        r1.scale.setScalar(1 + Math.sin(p.t * 40) * 0.03)
        if (!p.whizzed && t > 0.82) { p.whizzed = true; U.sound('whiz', { pos: end, gain: 1, pitch: 0.6 }) }
        if (t >= 1) { U.removeTarget(p.target); U.blast(end.clone().setY(end.y + 0.2), C.missileR, C.missileDmg * (U.pilot ? 1.4 : 1), 'enemy', { size: 1.0 }); return false }
      },
    }
    p.target = U.addTarget({ pos: p.cur, r: 0.9, hit: function () { p.shot = true } })
    mesh.position.copy(start)
    projectiles.add(p)
    SXW_smoke(G, start, 1.0, 0.35)
    U.sound('jump', { pos: start, gain: 0.9, pitch: 0.42 })
  }

  function mgShot(target) {
    mgPivot.localToWorld(mgMuzzle.set((Math.random() < 0.5 ? -0.12 : 0.12), 0, -1.45))
    var d = T.a.subVectors(target, mgMuzzle).normalize()
    d.x += (Math.random() - 0.5) * C.mgSpread * 2
    d.y += (Math.random() - 0.5) * C.mgSpread * 2
    d.z += (Math.random() - 0.5) * C.mgSpread * 2
    d.normalize()
    var o = mgMuzzle.clone(), dir = d.clone()
    var h = U.enemyShot(o, dir, { damage: C.mgDmg, range: 140 })
    var end = h && h.point ? h.point : o.clone().addScaledVector(dir, 140)
    try { G.fx.tracer(o, end, { color: 0xff5a30, intensity: 22 }) } catch (e) { }
    try { G.fx.muzzleFlash(o, dir, { scale: 1.3, color: 0xff7040 }) } catch (e) { }
    U.sound('rifle_shot', { pos: o, gain: 0.7, pitch: 0.82 })
  }

  // ---- AI ----
  var desired = new V3(), moveDir = new V3(), laserEnd = new V3(), laserSide = new V3(1, 0, 0)
  // does the straight walk from pos to (x, z) cut through the basin?
  function crossesBasin(x, z) {
    if (!basin) return false
    for (var k = 1; k <= 6; k++) {
      var f = k / 7
      if (insideBasin(pos.x + (x - pos.x) * f, pos.z + (z - pos.z) * f)) return true
    }
    return false
  }
  // walk round the basin ring toward the angle of (x, z)
  function ringStepToward(x, z, extra) {
    var thT = Math.atan2(z - basin.cz, x - basin.cx)
    var thS = Math.atan2(pos.z - basin.cz, pos.x - basin.cx)
    var dth = SXW_wrap(thT - thS) + (extra || 0)
    var th = thS + Math.max(-0.35, Math.min(0.35, dth))
    var r = Math.max(edgeAt(th) + C.ring, Math.min(Math.hypot(pos.x - basin.cx, pos.z - basin.cz), edgeAt(th) + C.ring + 25))
    desired.set(basin.cx + Math.cos(th) * r, 0, basin.cz + Math.sin(th) * r)
  }

  function think(dt, target) {
    var dist = target ? Math.hypot(target.x - pos.x, target.z - pos.z) : 1e9
    // outpost guard: wake up when the player is within 120 m (or it gets shot)
    if (!S.alerted && target && dist < 120) S.alerted = true
    if (!S.alerted) target = null
    // where to stand
    if (!target && S.guard) {
      S.patrolT -= dt
      if (S.patrolT <= 0 || Math.hypot(S.patrol.x - pos.x, S.patrol.z - pos.z) < 3) {
        S.patrolT = SXW_rand(10, 16)
        var pa = Math.random() * Math.PI * 2, pr = SXW_rand(8, 40)
        S.patrol.set(S.home.x + Math.cos(pa) * pr, 0, S.home.z + Math.sin(pa) * pr)
      }
      desired.copy(S.patrol)
    } else if (target) {
      if (basin && insideBasin(target.x, target.z)) {
        var thT = Math.atan2(target.z - basin.cz, target.x - basin.cx)
        var thS = Math.atan2(pos.z - basin.cz, pos.x - basin.cx)
        // walk round the ring toward the target's side; drift along it when blind
        var dth = SXW_wrap(thT - thS)
        if (S.noLos > 4) dth += 0.6 * Math.sign(dth || 1)
        var step = Math.max(-0.35, Math.min(0.35, dth))
        var th = thS + step
        var r = edgeAt(th) + C.ring
        desired.set(basin.cx + Math.cos(th) * r, 0, basin.cz + Math.sin(th) * r)
      } else {
        desired.copy(target)
        tmpV.set(pos.x - target.x, 0, pos.z - target.z)
        if (tmpV.lengthSq() < 1e-4) tmpV.set(1, 0, 0)
        tmpV.normalize()
        desired.addScaledVector(tmpV, 38)
        if (basin && SXD_basinSd(desired.x, desired.z) < 6) {
          var th2 = Math.atan2(desired.z - basin.cz, desired.x - basin.cx)
          var r2 = edgeAt(th2) + C.ring
          desired.set(basin.cx + Math.cos(th2) * r2, 0, basin.cz + Math.sin(th2) * r2)
        }
      }
    } else desired.copy(pos)
    // never wade through the station: go round the ring instead
    if (basin && crossesBasin(desired.x, desired.z)) ringStepToward(desired.x, desired.z, 0)
    moveDir.set(desired.x - pos.x, 0, desired.z - pos.z)
    var md = moveDir.length()
    var walking = md > 2.5 && S.aimT < 0
    if (target && dist < 26 && !walking) {
      // too close: back off a bit
      moveDir.set(pos.x - target.x, 0, pos.z - target.z)
      md = moveDir.length()
      walking = md > 0.1
    }
    if (walking) {
      moveDir.divideScalar(md || 1)
      var want = Math.atan2(-moveDir.x, -moveDir.z)
      S.by = SXW_turn(S.by, want, C.turn, dt)
      var facing = Math.cos(SXW_wrap(want - S.by))
      var sp = C.speed * Math.max(0.15, facing)
      S.vel.x = SXW_damp(S.vel.x, moveDir.x * sp, 2, dt)
      S.vel.z = SXW_damp(S.vel.z, moveDir.z * sp, 2, dt)
    } else {
      S.vel.x = SXW_damp(S.vel.x, 0, 2.5, dt)
      S.vel.z = SXW_damp(S.vel.z, 0, 2.5, dt)
      if (target) S.by = SXW_turn(S.by, Math.atan2(-(target.x - pos.x), -(target.z - pos.z)), C.turn * 0.6, dt)
    }
    pos.x += S.vel.x * dt
    pos.z += S.vel.z * dt
    SXW_pushOutBoxes(G, pos, 3.4, S.vel)
    pos.y = SXW_damp(pos.y, SXW_terrainY(G, pos.x, pos.z), 3, dt)
    // head / cannon track the target
    if (target) {
      neck.updateMatrixWorld(true)
      var ty = Math.atan2(-(target.x - pos.x), -(target.z - pos.z))
      var rel = Math.max(-1.6, Math.min(1.6, SXW_wrap(ty - S.by)))
      S.hy = SXW_turn(S.hy, rel, C.headTurn, dt)
      cannonPivot.getWorldPosition(tmpV)
      var hd = Math.hypot(target.x - tmpV.x, target.z - tmpV.z)
      S.cp = SXW_damp(S.cp, Math.atan2(target.y - tmpV.y, hd), 3, dt)
    }
    if (!target) return
    // line of sight from the head
    neck.getWorldPosition(tmpV)
    var los = G.physics.lineOfSight(tmpV, target)
    S.noLos = los ? 0 : S.noLos + dt
    if (los) { S.seen = true; S.engT = (S.engT || 0) + dt } else S.engT = Math.max(0, (S.engT || 0) - dt * 0.5)
    if (!S.seen || (S.engT || 0) < C.engage && !S.hit) return
    // heavy cannon: track with a laser, lock, fire
    S.cannonT -= dt
    if (S.aimT < 0 && S.cannonT <= 0 && los && dist < 120 && Math.abs(SXW_wrap(Math.atan2(-(target.x - pos.x), -(target.z - pos.z)) - (S.by + S.hy))) < 0.35) {
      S.aimT = 0
      S.aimPt.copy(target)
      U.sound('relay_cut', { pos: pos, gain: 0.7, pitch: 0.55 })
    }
    if (S.aimT >= 0) {
      S.aimT += dt
      if (S.aimT < C.aim - C.lock) {
        S.aimPt.lerp(target, Math.min(1, dt * 2.6))
        S.lockPt.copy(S.aimPt)
      }
      cannonPivot.localToWorld(muzzle.set(0, 0, -5.9))
      var dd = T.b.subVectors(S.lockPt, muzzle), dl = dd.length()
      dd.divideScalar(dl || 1)
      var w = G.physics.raycast(muzzle, dd, dl + 30)
      var end = laserEnd.copy(muzzle).addScaledVector(dd, w ? w.dist : dl + 30)
      SXW_orient(laser, muzzle, end, laserSide)
      laser.scale.set(1, muzzle.distanceTo(end), 1)
      laser.visible = true
      laserDot.position.copy(end)
      laserDot.visible = true
      var blink = S.aimT > C.aim - C.lock ? (Math.sin(S.aimT * 50) > 0 ? 1.6 : 0.6) : 1
      laserDot.scale.setScalar(blink)
      if (S.aimT >= C.aim) {
        laser.visible = laserDot.visible = false
        S.aimT = -1
        S.cannonT = SXW_rand(C.cannonCD[0], C.cannonCD[1]) * (U.pilot ? 0.6 : 1)
        fireShell()
      }
    }
    // missile barrage
    S.barrageT -= dt
    if (S.barrageT <= 0 && dist > 18 && dist < 110) {
      S.barrageT = SXW_rand(C.barrageCD[0], C.barrageCD[1]) * (U.pilot ? 0.65 : 1)
      var tp = target.clone()
      tp.y = U.groundAt(tp.x, tp.z, tp.y + 1)
      for (var k = 0; k < C.missiles; k++) S.launchQ.push({ t: k * 0.19, k: k, tp: tp })
    }
    // chin gun bursts at close range
    S.mgT -= dt
    if (S.mgLeft <= 0 && S.mgT <= 0 && los && dist < C.mgRange) { S.mgLeft = C.mgShots; S.mgGap = 0 }
    if (S.mgLeft > 0) {
      S.mgGap -= dt
      if (S.mgGap <= 0) { mgShot(target); S.mgLeft--; S.mgGap = 1 / C.mgRate; if (S.mgLeft === 0) S.mgT = SXW_rand(C.mgCD[0], C.mgCD[1]) }
    }
  }

  // ---- gait ----
  function gait(dt) {
    var hs = Math.hypot(S.vel.x, S.vel.z)
    var c = Math.cos(S.by), s = Math.sin(S.by)
    var stepping = false
    for (var k = 0; k < 6; k++) {
      var l = legs[k]
      // body-local rest -> world (x right, -z forward)
      l.want.set(pos.x + c * l.rest.x + s * l.rest.z, 0, pos.z - s * l.rest.x + c * l.rest.z)
      l.want.x += S.vel.x * 0.55
      l.want.z += S.vel.z * 0.55
      if (l.t < 1) stepping = true
    }
    if (!stepping && S.state !== 'dying') {
      var bestG = -1, bestE = 0
      for (var g = 0; g < 2; g++) {
        var e = 0
        for (var i = 0; i < 3; i++) { var lg = legs[SXW_TRIPOD[g][i]]; e = Math.max(e, Math.hypot(lg.ground.x - lg.want.x, lg.ground.z - lg.want.z)) }
        if (e > bestE) { bestE = e; bestG = g }
      }
      var thr = hs > 0.3 ? 1.25 : 0.5
      if (bestG >= 0 && bestE > thr) {
        for (var i2 = 0; i2 < 3; i2++) {
          var lt2 = legs[SXW_TRIPOD[bestG][i2]]
          lt2.t = 0
          lt2.from.copy(lt2.ground)
          lt2.to.copy(lt2.want)
          lt2.to.x += S.vel.x * C.stepDur * 0.5
          lt2.to.z += S.vel.z * C.stepDur * 0.5
          lt2.to.y = U.groundAt(lt2.to.x, lt2.to.z, 999)
        }
      }
    }
    var planted = 0
    for (var j = 0; j < 6; j++) {
      var l2 = legs[j]
      if (l2.t < 1) {
        l2.t = Math.min(1, l2.t + dt / C.stepDur)
        l2.ground.lerpVectors(l2.from, l2.to, SXW_ease(l2.t))
        l2.lift = Math.sin(Math.PI * l2.t) * C.lift
        if (l2.t >= 1) {
          l2.lift = 0
          l2.ground.copy(l2.to)
          planted++
          SXW_dust(G, l2.ground, 1.6)
        }
      }
    }
    if (planted) {
      U.sound('hound_step', { pos: pos, gain: 1, pitch: 0.32 })
      U.sound('container_bang', { pos: pos, gain: 0.35, pitch: 0.45 })
      SXW_quake(G, U, pos, 0.42, 55)
    }
    // body height and tilt from the feet
    var gsum = 0, front = 0, rear = 0, left = 0, right = 0
    for (var q = 0; q < 6; q++) {
      var gy = legs[q].ground.y
      gsum += gy
      if (q % 3 === 0) front += gy
      if (q % 3 === 2) rear += gy
      if (q < 3) left += gy; else right += gy
    }
    var gAvg = gsum / 6
    var lift = 0
    for (var w = 0; w < 6; w++) lift += legs[w].lift
    var hTarget = gAvg + C.bodyH - S.sag + lift * 0.05
    S.bodyY = SXW_damp(S.bodyY, hTarget, 3, dt)
    S.pitch = SXW_damp(S.pitch, Math.atan2(rear / 2 - front / 2, 10), 2, dt)
    S.roll = SXW_damp(S.roll, Math.atan2(left / 3 - right / 3, 11), 2, dt)
  }

  function pose() {
    body.position.set(pos.x, S.bodyY, pos.z)
    body.rotation.set(S.pitch, S.by, S.roll, 'YXZ')
    neck.rotation.set(S.dying >= 0 ? 0.4 : -S.sag * 0.15, S.hy, 0, 'YXZ')
    cannonPivot.rotation.x = Math.max(-0.5, Math.min(0.35, S.cp)) + (S.recoil || 0) * 0.08
    P.cannon.position.z = (S.recoil || 0) * 0.5
    mgPivot.rotation.x = cannonPivot.rotation.x
    body.updateMatrixWorld(true)
    var upOut = T.g
    for (var k = 0; k < 6; k++) {
      var l = legs[k]
      l.hip.set(l.s * SXW_COL_HIPX, -0.55, l.hipZ)
      body.localToWorld(l.hip)
      // coxa swings toward the foot
      var ox = l.ground.x - l.hip.x, oz = l.ground.z - l.hip.z, ol = Math.hypot(ox, oz) || 1
      ox /= ol; oz /= ol
      l.troc.set(l.hip.x + ox * 1.3, l.hip.y + 0.3, l.hip.z + oz * 1.3)
      var side = T.h.set(-oz, 0, ox)
      SXW_orient(l.coxa, l.hip, l.troc, T.UP)
      var tgt2 = T.a.copy(l.ground)
      tgt2.y += l.lift
      upOut.set(ox * 0.6, 1, oz * 0.6)
      SXW_ik(l.troc, tgt2, C.femur, C.tibia, upOut, l.knee, l.foot)
      SXW_orient(l.femur, l.troc, l.knee, side)
      SXW_orient(l.tibia, l.knee, l.foot, side)
    }
    refreshHitShapes()
  }

  // plant feet
  ;(function () {
    var c = Math.cos(S.by), s = Math.sin(S.by)
    for (var k = 0; k < 6; k++) {
      var l = legs[k]
      l.ground.set(pos.x + c * l.rest.x + s * l.rest.z, 0, pos.z - s * l.rest.x + c * l.rest.z)
      l.ground.y = U.groundAt(l.ground.x, l.ground.z, 999)
      l.from.copy(l.ground); l.to.copy(l.ground)
    }
  })()

  unit.update = function (dt, U2) {
    projectiles.update(dt)
    S.recoil = Math.max(0, (S.recoil || 0) - dt * 2.5)
    if (S.state === 'dying') {
      S.dying += dt
      for (var k = S.booms.length - 1; k >= 0; k--) {
        if (S.booms[k] >= 0 && S.dying >= S.booms[k]) {
          S.booms.splice(k, 1)
          var bp = tmpV.set(pos.x + SXW_rand(-2.5, 2.5), S.bodyY + SXW_rand(-0.8, 1.2), pos.z + SXW_rand(-3, 3))
          try { G.fx.explosion(bp.clone(), SXW_rand(0.9, 1.5)) } catch (e) { }
        }
      }
      S.sag = Math.min(C.bodyH - 1.6, S.sag + dt * 1.5 * Math.min(1, S.dying / 1.5))
      S.vel.set(0, 0, 0)
      for (var j = 0; j < 6; j++) { var l = legs[j]; l.ground.x += (l.ground.x - pos.x) * dt * 0.15 * (S.dying < 3 ? 1 : 0); l.ground.z += (l.ground.z - pos.z) * dt * 0.15 * (S.dying < 3 ? 1 : 0) }
      S.pitch = SXW_damp(S.pitch, 0.18, 0.8, dt)
      S.roll = SXW_damp(S.roll, -0.12, 0.8, dt)
      S.bodyY = SXW_damp(S.bodyY, pos.y + C.bodyH - S.sag, 3, dt)
      if (S.dying > 3.6 && !S.wreck) {
        S.wreck = true
        var c = unit.center(new V3())
        try { G.fx.explosion(c, 3) } catch (e) { }
        U.blast(c, 9, 45, 'enemy', { fx: false })
        try { S.fires = [G.fx.addEmitter(c.clone().setY(S.bodyY + 0.6), 'fire', { ttl: 60, scale: 2.4 }), G.fx.addEmitter(corePos.clone(), 'fire', { ttl: 60, scale: 1.6 })] } catch (e) { }
        P.core.visible = false
      }
      body.position.set(pos.x, S.bodyY, pos.z)
      body.rotation.set(S.pitch, S.by, S.roll, 'YXZ')
      if (!S.wreck || S.dying < 4.5) pose()
      return
    }
    var target = U.target(tgt)
    if (S.stun > 0) {
      S.stun -= dt
      S.sag = SXW_damp(S.sag, 1.3, 3, dt)
      S.vel.x = SXW_damp(S.vel.x, 0, 4, dt)
      S.vel.z = SXW_damp(S.vel.z, 0, 4, dt)
      if (Math.random() < dt * 8) { try { G.fx.sparks(tmpV.set(pos.x + SXW_rand(-2, 2), S.bodyY + SXW_rand(-0.5, 1), pos.z + SXW_rand(-3, 3)), T.f.set(0, 1, 0), 8) } catch (e) { } }
      P.eye.visible = Math.random() > 0.4
    } else {
      S.sag = SXW_damp(S.sag, 0, 2, dt)
      P.eye.visible = true
      think(dt, target)
      for (var q = S.launchQ.length - 1; q >= 0; q--) {
        var L = S.launchQ[q]
        L.t -= dt
        if (L.t <= 0) { S.launchQ.splice(q, 1); launchMissile(L.k, L.tp) }
      }
    }
    // core pulse
    var pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.006)
    P.core.scale.setScalar(pulse)
    gait(dt)
    pose()
  }

  unit.dispose = function () {
    projectiles.clear()
    G.scene.remove(root)
    if (S.fires) S.fires.forEach(function (f) { try { f && f.stop() } catch (e) { } })
  }

  pose()
  return unit
}

if (typeof SXU_TYPES !== 'undefined') {
  SXU_TYPES.warden = function (G, U, opts) { return SXW_makeWarden(G, U, opts) }
  SXU_TYPES.colossus = function (G, U, opts) { return SXW_makeColossus(G, U, opts) }
}
