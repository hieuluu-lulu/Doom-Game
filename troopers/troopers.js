// ============================================================================
// DoomZone mod — TROOPERS (enemy humanoid gun robots)
// SXU_TYPES.trooper: a ~1.9 m biped machine in the Gull/Hound livery (white
// shell, gunmetal joints, orange stripes, red visor). One rigid-skinned
// SkinnedMesh with a flat skeleton (one draw per material slot), procedural
// animation: 2-bone IK legs with planted feet, torso twist, arms on the
// weapon, recoil, flinch, collapse into a wreck.
// Variants (opts.variant): 'rifle' (bursts), 'heavy' (armoured LMG
// suppression), 'marksman' (laser telegraph, one hard shot).
// AI: sight cone + line of sight, hears gunfire, patrol / search / engage /
// cover / flank, strafes and crouches, attack tokens (max 3 shooting), nav
// paths inside the nav grid, direct steering outside it.
// Plugin: squads on both maps (start, each relay, all relays, reinforcements),
// outpost garrisons on the desert (pushed into site.garrison).
// ============================================================================

var SXT_TUNE = {
  rifle: { label: 'Trooper', hp: 120, armor: 1, walk: 1.7, run: 3.7, sight: 58, burst: [4, 6], gap: 0.09, dmg: 6, range: 110, spread: 0.075, rest: [1.3, 2.3], prefer: [14, 30], crouch: 0.4, scale: 1 },
  heavy: { label: 'Heavy Trooper', hp: 320, armor: 0.8, walk: 1.3, run: 2.6, sight: 55, burst: [10, 14], gap: 0.075, dmg: 5, range: 100, spread: 0.085, rest: [2.0, 3.0], prefer: [12, 24], crouch: 0.15, scale: 1.08 },
  marksman: { label: 'Marksman', hp: 100, armor: 1, walk: 1.6, run: 3.4, sight: 85, burst: [1, 1], gap: 0.1, dmg: 22, range: 160, spread: 0.006, rest: [3.2, 4.4], prefer: [32, 60], crouch: 0.6, scale: 1, aim: 1.15 },
  tokens: 3, tokenGap: 0.35, hear: 45, think: 0.2, wreckLife: 40,
}

// bones: all children of the root (flat), bind = standing, arms down
var SXT_BONES = [
  ['root', 0, 0, 0], ['pelvis', 0, 0.98, 0], ['chest', 0, 1.12, 0], ['head', 0, 1.6, 0],
  ['uarmL', -0.25, 1.48, 0], ['farmL', -0.25, 1.18, 0], ['handL', -0.25, 0.9, 0],
  ['uarmR', 0.25, 1.48, 0], ['farmR', 0.25, 1.18, 0], ['handR', 0.25, 0.9, 0],
  ['thighL', -0.1, 0.94, 0], ['shinL', -0.1, 0.52, 0], ['footL', -0.1, 0.1, 0],
  ['thighR', 0.1, 0.94, 0], ['shinR', 0.1, 0.52, 0], ['footR', 0.1, 0.1, 0],
  ['gun', 0.16, 1.3, -0.24],
]
var SXT_B = {}
SXT_BONES.forEach(function (b, i) { SXT_B[b[0]] = i })
var SXT_SLOTS = ['shell', 'metal', 'orange', 'visor']

// ---------------------------------------------------------------- geometry
function SXT_geometry(variant) {
  var parts = []
  var add = function (slot, bone, geo) { parts.push({ slot: slot, bone: SXT_B[bone], geo: geo }) }
  var box = function (w, h, d, r, x, y, z) { return Wi(w, h, d, r).translate(x, y, z) }
  var cyl = function (r1, r2, h, seg, x, y, z, axis) {
    var g = new lt.CylinderGeometry(r1, r2, h, seg)
    if (axis === 'z') g.rotateX(Math.PI / 2)
    if (axis === 'x') g.rotateZ(Math.PI / 2)
    return g.translate(x, y, z)
  }
  var ball = function (r, x, y, z) { return new lt.SphereGeometry(r, 10, 8).translate(x, y, z) }
  var heavy = variant === 'heavy'
  // pelvis + waist
  add('metal', 'pelvis', box(0.32, 0.16, 0.22, 0.04, 0, 0.98, 0))
  add('shell', 'pelvis', box(0.34, 0.08, 0.24, 0.03, 0, 1.04, 0))
  add('shell', 'pelvis', box(0.14, 0.14, 0.04, 0.02, 0, 0.94, -0.12))
  // torso (pivot at the lower spine 1.12)
  add('metal', 'chest', box(0.24, 0.2, 0.18, 0.04, 0, 1.2, 0.01))
  add('shell', 'chest', box(heavy ? 0.5 : 0.44, 0.36, heavy ? 0.32 : 0.28, 0.07, 0, 1.42, 0))
  add('orange', 'chest', box(heavy ? 0.51 : 0.45, 0.045, heavy ? 0.33 : 0.29, 0.015, 0, 1.33, 0))
  add('metal', 'chest', box(0.3, 0.32, 0.14, 0.04, 0, 1.42, 0.2))
  add('metal', 'chest', cyl(0.008, 0.008, 0.42, 5, -0.1, 1.72, 0.24))
  add('metal', 'chest', box(0.12, 0.08, 0.12, 0.03, 0, 1.6, 0))
  if (heavy) {
    add('shell', 'chest', box(0.4, 0.22, 0.06, 0.03, 0, 1.4, -0.18))
    add('metal', 'chest', box(0.32, 0.1, 0.08, 0.02, 0, 1.24, -0.16))
  }
  // head
  add('shell', 'head', box(0.22, 0.22, 0.25, 0.07, 0, 1.75, 0.01))
  add('metal', 'head', box(0.18, 0.08, 0.18, 0.03, 0, 1.64, 0.02))
  add('visor', 'head', box(0.19, 0.055, 0.03, 0.012, 0, 1.765, -0.118))
  add('orange', 'head', box(0.04, 0.05, 0.2, 0.012, 0, 1.87, 0.02))
  // shoulders (on the chest so they follow the torso)
  ;[-1, 1].forEach(function (s) {
    add('shell', 'chest', box(heavy ? 0.2 : 0.16, 0.12, heavy ? 0.24 : 0.2, 0.04, s * 0.27, 1.56, 0))
    add('orange', 'chest', box(heavy ? 0.205 : 0.165, 0.03, 0.06, 0.01, s * 0.27, 1.6, -0.06))
  })
  // arms
  ;['L', 'R'].forEach(function (k) {
    var s = k === 'L' ? -1 : 1, x = s * 0.25
    add('metal', 'uarm' + k, ball(0.06, x, 1.48, 0))
    add('metal', 'uarm' + k, cyl(0.045, 0.04, 0.26, 8, x, 1.33, 0))
    add('shell', 'uarm' + k, box(0.1, 0.16, 0.1, 0.03, x, 1.36, 0))
    add('metal', 'farm' + k, ball(0.045, x, 1.18, 0))
    add('shell', 'farm' + k, box(0.1, 0.24, 0.1, 0.03, x, 1.04, 0))
    add('metal', 'hand' + k, box(0.07, 0.1, 0.08, 0.02, x, 0.86, 0))
  })
  // legs
  ;['L', 'R'].forEach(function (k) {
    var s = k === 'L' ? -1 : 1, x = s * 0.1
    add('metal', 'thigh' + k, ball(0.07, x, 0.94, 0))
    add('shell', 'thigh' + k, box(heavy ? 0.16 : 0.14, 0.34, heavy ? 0.17 : 0.15, 0.04, x, 0.74, 0))
    add('metal', 'shin' + k, ball(0.06, x, 0.52, 0))
    add('orange', 'shin' + k, box(0.1, 0.1, 0.05, 0.02, x, 0.5, -0.07))
    add('shell', 'shin' + k, box(0.12, 0.34, 0.13, 0.035, x, 0.3, 0.01))
    add('metal', 'foot' + k, box(0.12, 0.08, 0.26, 0.025, x, 0.05, -0.04))
  })
  // weapon around the gun pivot (0.16, 1.3, -0.24), muzzle along -z
  var G0 = [0.16, 1.3, -0.24]
  var gb = function (slot, w, h, d, r, x, y, z) { add(slot, 'gun', box(w, h, d, r, G0[0] + x, G0[1] + y, G0[2] - z)) }
  var gc = function (slot, r, len, z0) { add(slot, 'gun', cyl(r, r, len, 8, G0[0], G0[1] + 0.01, G0[2] - z0 - len / 2, 'z')) }
  var muzzle, grip = [0, -0.08, 0.02], fore
  if (variant === 'heavy') {
    gb('metal', 0.1, 0.14, 0.62, 0.02, 0, 0, 0.2)
    gb('metal', 0.13, 0.13, 0.13, 0.02, 0, -0.12, 0.08)
    gb('orange', 0.102, 0.025, 0.3, 0.008, 0, 0.06, 0.25)
    gb('metal', 0.06, 0.1, 0.18, 0.02, 0, -0.02, -0.16)
    gc('metal', 0.026, 0.36, 0.5)
    muzzle = [0, 0.01, -0.88]; fore = [0, -0.06, -0.38]
  } else if (variant === 'marksman') {
    gb('metal', 0.06, 0.1, 0.62, 0.015, 0, 0, 0.2)
    gb('metal', 0.05, 0.12, 0.08, 0.015, 0, -0.1, 0.05)
    gb('metal', 0.05, 0.1, 0.22, 0.02, 0, -0.03, -0.18)
    gc('metal', 0.016, 0.5, 0.5)
    add('metal', 'gun', cyl(0.026, 0.026, 0.24, 8, G0[0], G0[1] + 0.09, G0[2] + 0.06 - 0.2, 'z'))
    add('visor', 'gun', cyl(0.02, 0.02, 0.01, 8, G0[0], G0[1] + 0.09, G0[2] - 0.26, 'z'))
    gb('orange', 0.062, 0.02, 0.18, 0.006, 0, 0.055, 0.15)
    muzzle = [0, 0.01, -1.0]; fore = [0, -0.05, -0.36]
  } else {
    gb('metal', 0.07, 0.11, 0.5, 0.015, 0, 0, 0.18)
    gb('metal', 0.05, 0.14, 0.07, 0.012, 0, -0.1, 0.12)
    gb('metal', 0.05, 0.09, 0.2, 0.02, 0, -0.02, -0.14)
    gb('orange', 0.072, 0.02, 0.2, 0.006, 0, 0.06, 0.2)
    gc('metal', 0.018, 0.3, 0.43)
    muzzle = [0, 0.01, -0.74]; fore = [0, -0.05, -0.34]
  }
  // merge into one skinned geometry, one group per material slot
  var pos = [], nor = [], uv = [], si = [], sw = [], idx = [], base = 0
  var geo = new lt.BufferGeometry()
  SXT_SLOTS.forEach(function (slot, mi) {
    var start = idx.length
    parts.forEach(function (p) {
      if (p.slot !== slot) return
      var g = p.geo, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv
      for (var i = 0; i < P.count; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i))
        nor.push(N.getX(i), N.getY(i), N.getZ(i))
        uv.push(UV ? UV.getX(i) : 0, UV ? UV.getY(i) : 0)
        si.push(p.bone, 0, 0, 0)
        sw.push(1, 0, 0, 0)
      }
      if (g.index) for (var k = 0; k < g.index.count; k++) idx.push(base + g.index.getX(k))
      else for (var k2 = 0; k2 < P.count; k2++) idx.push(base + k2)
      base += P.count
    })
    geo.addGroup(start, idx.length - start, mi)
  })
  geo.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new lt.Float32BufferAttribute(nor, 3))
  geo.setAttribute('uv', new lt.Float32BufferAttribute(uv, 2))
  // the stock robot shell/metal materials use vertex colours: plain white here
  geo.setAttribute('color', new lt.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3))
  geo.setAttribute('skinIndex', new lt.Uint16BufferAttribute(si, 4))
  geo.setAttribute('skinWeight', new lt.Float32BufferAttribute(sw, 4))
  geo.setIndex(idx)
  return { geo: geo, muzzle: muzzle, grip: grip, fore: fore }
}
var SXT_GEO = {}
function SXT_geo(variant) { return SXT_GEO[variant] || (SXT_GEO[variant] = SXT_geometry(variant)) }

var SXT_MATS = null
function SXT_mats(G) {
  if (SXT_MATS) return SXT_MATS
  var em = G.enemies && G.enemies.debug && G.enemies.debug.mats || {}
  var get = function (n) { try { return G.mats.get(n) } catch (e) { return new lt.MeshStandardMaterial({ color: 0x888888 }) } }
  SXT_MATS = [em.shell || get('armor_white'), em.metal || get('gunmetal'), get('armor_orange'), G.mats.emissive ? G.mats.emissive(0xff3c1c, 10) : new lt.MeshBasicMaterial({ color: 0xff3c1c })]
  return SXT_MATS
}

// ------------------------------------------------------------------- math
var SXT_tmp = { a: null }
function SXT_ik(a, t, l1, l2, pole, mid, end) {
  // two-bone IK in model space: a = root joint, t = target; writes mid + end
  var dx = t.x - a.x, dy = t.y - a.y, dz = t.z - a.z, len = Math.hypot(dx, dy, dz) || 1e-4
  var L = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.002, len))
  dx /= len; dy /= len; dz /= len
  end.set(a.x + dx * L, a.y + dy * L, a.z + dz * L)
  var x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x))
  var pd = pole.x * dx + pole.y * dy + pole.z * dz
  var px = pole.x - dx * pd, py = pole.y - dy * pd, pz = pole.z - dz * pd, pl = Math.hypot(px, py, pz) || 1
  mid.set(a.x + dx * x + (px / pl) * h, a.y + dy * x + (py / pl) * h, a.z + dz * x + (pz / pl) * h)
}
var SXT_M4 = null, SXT_VX = null, SXT_VY = null, SXT_VZ = null
function SXT_orient(q, from, to, xref) {
  // bone bind: limb along -Y, x sideways → +Y back toward the parent joint
  if (!SXT_M4) { SXT_M4 = new lt.Matrix4(); SXT_VX = new lt.Vector3(); SXT_VY = new lt.Vector3(); SXT_VZ = new lt.Vector3() }
  var y = SXT_VY.subVectors(from, to)
  if (y.lengthSq() < 1e-8) y.set(0, 1, 0)
  y.normalize()
  var x = SXT_VX.copy(xref).addScaledVector(y, -xref.dot(y))
  if (x.lengthSq() < 1e-6) x.set(0, 0, 1).addScaledVector(y, -y.z)
  x.normalize()
  var z = SXT_VZ.crossVectors(x, y)
  SXT_M4.makeBasis(x, y, z)
  q.setFromRotationMatrix(SXT_M4)
}
function SXT_segRay(o, d, a, b, r, max) {
  // ray vs capsule (a→b, radius r); distance or -1
  var bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z, oax = o.x - a.x, oay = o.y - a.y, oaz = o.z - a.z
  var baba = bax * bax + bay * bay + baz * baz, bard = bax * d.x + bay * d.y + baz * d.z, baoa = bax * oax + bay * oay + baz * oaz
  var rdoa = d.x * oax + d.y * oay + d.z * oaz, oaoa = oax * oax + oay * oay + oaz * oaz
  var A = baba - bard * bard, B = baba * rdoa - baoa * bard, C = baba * oaoa - baoa * baoa - r * r * baba, h = B * B - A * C
  if (h >= 0 && A > 1e-9) {
    var t = (-B - Math.sqrt(h)) / A, y = baoa + t * bard
    if (y > 0 && y < baba && t >= 0 && t <= max) return t
    var ocx = y <= 0 ? oax : o.x - b.x, ocy = y <= 0 ? oay : o.y - b.y, ocz = y <= 0 ? oaz : o.z - b.z
    var bb = d.x * ocx + d.y * ocy + d.z * ocz, cc = ocx * ocx + ocy * ocy + ocz * ocz - r * r, hh = bb * bb - cc
    if (hh > 0) { var t2 = -bb - Math.sqrt(hh); if (t2 >= 0 && t2 <= max) return t2 }
  }
  return -1
}
function SXT_sphere(o, d, c, r, max) {
  var ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc
  if (h < 0) return -1
  var t = -b - Math.sqrt(h)
  return t >= 0 && t <= max ? t : -1
}
function SXT_wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
function SXT_ease(t) { return t * t * (3 - 2 * t) }

// shared squad state (attack tokens)
var SXT_STATE = { tokens: new Set(), lastStart: -9, now: 0 }

// ----------------------------------------------------------------- the unit
SXU_TYPES.trooper = function (G, U, opts) {
  var V3 = lt.Vector3
  var variant = SXT_TUNE[opts.variant] ? opts.variant : 'rifle'
  var C = SXT_TUNE[variant]
  var GEO = SXT_geo(variant)
  var mats = SXT_mats(G)
  // the three.js soldier (lib/20_soldier.js) once its model is loaded; the robot rig otherwise
  var SV = SXS.ready && !opts.robot ? SXS_make(G, variant, C.scale) : null

  // rig
  var group = new lt.Group()
  var bones = SXT_BONES.map(function (b) { var bn = new lt.Bone(); bn.name = b[0]; bn.position.set(b[1], b[2], b[3]); return bn })
  for (var k = 1; k < bones.length; k++) bones[0].add(bones[k])
  var mesh = new lt.SkinnedMesh(GEO.geo, mats)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.add(bones[0])
  group.add(SV ? SV.holder : mesh)
  group.scale.setScalar(C.scale)
  group.updateMatrixWorld(true)
  var skel = new lt.Skeleton(bones)
  mesh.bind(skel)
  mesh.boundingSphere = new lt.Sphere(new V3(0, 1, 0), 1.6)
  mesh.boundingBox = new lt.Box3(new V3(-1, -0.2, -1.4), new V3(1, 2.2, 1))
  G.scene.add(group)

  // marksman laser
  var laser = null
  if (variant === 'marksman') {
    laser = new lt.Mesh(new lt.CylinderGeometry(0.012, 0.012, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), new lt.MeshBasicMaterial({ color: new lt.Color(7, 0.3, 0.15), transparent: true, opacity: 0.8, depthWrite: false, fog: false }))
    laser.visible = false
    laser.frustumCulled = false
    G.scene.add(laser)
  }

  var pos = opts.pos.clone()
  pos.y = G.physics.groundHeight(pos.x, pos.z, pos.y + 1)
  var home = (opts.home || pos).clone()
  var tmp = new V3(), tmp2 = new V3(), tmp3 = new V3(), aim = new V3(), muzzle = new V3(), dir = new V3(), vel = new V3()
  var M = {} // model-space joint positions
  ;['pelvis', 'chest', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR', 'gun', 'gripR', 'gripL', 'ftL', 'ftR'].forEach(function (n) { M[n] = new V3() })
  var Q = { chest: new lt.Quaternion(), head: new lt.Quaternion(), gun: new lt.Quaternion(), pelvis: new lt.Quaternion(), e: new lt.Euler() }
  var XREF = new V3(1, 0, 0), POLE_LEG = new V3(0, 0.1, -1), POLE_AL = new V3(-0.7, -1, 0.5), POLE_AR = new V3(0.7, -1, 0.5)
  var gq = new lt.Quaternion(), UPV = new V3(0, 1, 0)

  var S = {
    yaw: opts.yaw || 0, state: opts.state || 'patrol', stateT: 0, thinkT: Math.random() * C.rest[0], seeT: 0, sees: false, lostT: 9,
    lastKnown: opts.lastKnown ? opts.lastKnown.clone() : null, wp: null, path: null, pathI: 0, pathT: 0, act: 'hold', actT: 0,
    crouch: 0, crouchWant: 0, aimYaw: 0, aimPitch: 0, recoil: 0, flinch: 0, flinchV: 0, cool: 1 + Math.random(), burst: 0, shotT: 0, token: false,
    tele: -1, stun: 0, dyingT: -1, wreckT: 0, hurtT: 9, strafe: 0, stepPhase: 0, guard: !!opts.guard,
    feet: [
      { s: -1, plant: new V3(), from: new V3(), to: new V3(), t: 1, lift: 0 },
      { s: 1, plant: new V3(), from: new V3(), to: new V3(), t: 1, lift: 0 },
    ],
  }
  S.feet.forEach(function (f) { footHome(f, f.plant) })

  var unit = {
    type: 'trooper', model: SV ? 'soldier' : 'robot', soldier: SV, variant: variant, label: C.label, faction: 'enemy', alive: true, pos: pos, hp: C.hp, maxHp: C.hp,
    radius: 1.3, solid: { r: 0.4, h: 1.9, m: variant === 'heavy' ? 6 : 4 },
    center: function (o) { return (o || new V3()).set(pos.x, pos.y + 1.0 * C.scale, pos.z) },
    raycast: raycast, damage: damage, update: update, stun: function (sec) { S.stun = Math.max(S.stun, sec) },
    alert: function (at) { if (!unit.alive) return; S.lastKnown = (S.lastKnown || new V3()).copy(at); if (S.state === 'patrol') setState('search') },
    dispose: function () { G.scene.remove(group); if (laser) G.scene.remove(laser); if (SV) SV.dispose(); releaseToken() },
    debug: S,
  }

  // ------------------------------------------------------------ helpers
  function setState(s) { if (S.state !== s) { S.state = s; S.stateT = 0; S.path = null } }
  function toModel(w, out) {
    // world → model space of the group (yaw + scale)
    var c = Math.cos(-S.yaw), s = Math.sin(-S.yaw), dx = (w.x - pos.x) / C.scale, dy = (w.y - pos.y) / C.scale, dz = (w.z - pos.z) / C.scale
    return out.set(dx * c + dz * s, dy, -dx * s + dz * c)
  }
  function toWorld(m, out) {
    var c = Math.cos(S.yaw), s = Math.sin(S.yaw)
    return out.set(pos.x + (m.x * c + m.z * s) * C.scale, pos.y + m.y * C.scale, pos.z + (-m.x * s + m.z * c) * C.scale)
  }
  function footHome(f, out) {
    var c = Math.cos(S.yaw), s = Math.sin(S.yaw), off = f.s * 0.12 * C.scale
    out.set(pos.x + c * off + vel.x * 0.14, 0, pos.z - s * off + vel.z * 0.14)
    out.y = G.physics.groundHeight(out.x, out.z, pos.y + 0.6)
    return out
  }
  function releaseToken() { if (S.token) { SXT_STATE.tokens.delete(unit); S.token = false } }
  function takeToken() {
    if (S.token) return true
    if (SXT_STATE.tokens.size >= SXT_TUNE.tokens || SXT_STATE.now - SXT_STATE.lastStart < SXT_TUNE.tokenGap) return false
    SXT_STATE.tokens.add(unit); SXT_STATE.lastStart = SXT_STATE.now; S.token = true
    return true
  }
  function headWorld(out) { if (SV) return SV.head(out); return toWorld(M.head.y ? tmp3.set(M.head.x, M.head.y + 0.16, M.head.z) : tmp3.set(0, 1.76, 0), out) }

  // ------------------------------------------------------------- hits
  var hA = new V3(), hB = new V3(), hC = new V3()
  function raycast(o, d, max) {
    if (!unit.alive) return null
    if (SV) return SV.raycast(o, d, max)
    var best = -1, part = 'body'
    // head (weak)
    toWorld(tmp.set(M.head.x, M.head.y + 0.15, M.head.z), hC)
    var t = SXT_sphere(o, d, hC, 0.15 * C.scale, max)
    if (t >= 0) { best = t; part = 'weak' }
    // torso
    toWorld(M.pelvis, hA); toWorld(tmp.set(M.chest.x, M.chest.y + 0.42, M.chest.z), hB)
    t = SXT_segRay(o, d, hA, hB, 0.24 * C.scale, best >= 0 ? best : max)
    if (t >= 0 && (best < 0 || t < best)) { best = t; part = 'body' }
    // legs + arms
    var segs = [['hipL', 'knL', 0.09], ['knL', 'anL', 0.08], ['hipR', 'knR', 0.09], ['knR', 'anR', 0.08], ['shL', 'elL', 0.06], ['elL', 'wrL', 0.06], ['shR', 'elR', 0.06], ['elR', 'wrR', 0.06]]
    for (var k = 0; k < segs.length; k++) {
      toWorld(M[segs[k][0]], hA); toWorld(M[segs[k][1]], hB)
      t = SXT_segRay(o, d, hA, hB, segs[k][2] * C.scale, best >= 0 ? best : max)
      if (t >= 0 && (best < 0 || t < best)) { best = t; part = 'limb' }
    }
    if (best < 0) return null
    return { dist: best, point: o.clone().addScaledVector(d, best), normal: d.clone().negate(), part: part }
  }
  function damage(amount, point, d, part, source) {
    if (!unit.alive || !(amount > 0)) return false
    var k = part === 'weak' ? 1 : part === 'limb' ? 0.75 * C.armor : C.armor
    unit.hp -= amount * k
    S.hurtT = 0
    S.flinchV += Math.min(4, amount * 0.06)
    if (point && G.fx && G.fx.sparks) G.fx.sparks(point, d ? tmp.copy(d).negate() : tmp.set(0, 1, 0), part === 'weak' ? 10 : 5)
    // being shot at: we know where it came from
    if (source !== 'enemy' && source !== 'collision') {
      var tg = U.target(tmp2)
      if (tg) { S.lastKnown = (S.lastKnown || new V3()).copy(tg); if (S.state === 'patrol' || S.state === 'search') setState('engage') }
    }
    if (unit.hp <= 0) { die(d); return true }
    return false
  }
  function die(d) {
    unit.alive = false
    releaseToken()
    if (laser) laser.visible = false
    S.dyingT = 0
    S.fallDir = d ? Math.atan2(d.x, d.z) - S.yaw : Math.random() * 6.28
    try {
      var c = unit.center(new V3())
      G.fx && G.fx.sparks && G.fx.sparks(c, new V3(0, 1, 0), 18)
      G.fx && G.fx.smoke && G.fx.smoke(c, { size: 0.8, life: 2.2, rise: 0.5, count: 2, alpha: 0.3 })
      G.render && G.render.lightPool && G.render.lightPool.flash(c, 0xffa060, 30, 5, 0.12)
    } catch (e) { }
    U.sound('hound_die', { pos: unit.center(new V3()), gain: 0.7, pitch: 1.35 })
    U.killed(unit)
  }

  // ------------------------------------------------------------ movement
  var nav = G.physics.nav
  function inNav(p) { try { return nav && nav.isWalkable(p.x, p.z) } catch (e) { return false } }
  function moveToward(goal, speed, dt, faceMove) {
    if (!goal) { vel.x *= Math.exp(-8 * dt); vel.z *= Math.exp(-8 * dt); return true }
    // nav path inside the grid, straight steering outside
    S.pathT -= dt
    if ((!S.path || S.pathT <= 0) && inNav(pos) && inNav(goal)) {
      S.pathT = 1.4
      var p = null
      try { p = nav.findPath(pos, goal) } catch (e) { p = null }
      S.path = p && p.length ? p : null
      S.pathI = 0
    }
    var wp = goal
    if (S.path) {
      while (S.pathI < S.path.length - 1 && Math.hypot(S.path[S.pathI].x - pos.x, S.path[S.pathI].z - pos.z) < 0.6) S.pathI++
      wp = S.path[S.pathI]
    }
    var dx = wp.x - pos.x, dz = wp.z - pos.z, dl = Math.hypot(dx, dz)
    var gd = Math.hypot(goal.x - pos.x, goal.z - pos.z)
    if (gd < 0.7) { vel.x *= Math.exp(-8 * dt); vel.z *= Math.exp(-8 * dt); return true }
    dx /= dl || 1; dz /= dl || 1
    var sp = speed * (1 - S.crouch * 0.55)
    vel.x += (dx * sp - vel.x) * Math.min(1, 7 * dt)
    vel.z += (dz * sp - vel.z) * Math.min(1, 7 * dt)
    if (faceMove) S.yawWant = Math.atan2(-dx, -dz)
    return false
  }

  // ------------------------------------------------------------- brain
  function pickCover(tg) {
    var lv = G.level || {}, best = null, bs = 1e9
    var cps = lv.coverPoints || []
    for (var k = 0; k < cps.length; k++) {
      var c = cps[k], d = Math.hypot(c.x - pos.x, c.z - pos.z)
      if (d > 16 || d < 1.5) continue
      var dt = Math.hypot(c.x - tg.x, c.z - tg.z)
      if (dt < 6) continue
      if (G.physics.lineOfSight(tmp.set(c.x, (c.y || 0) + 0.9, c.z), tg)) continue
      var score = d + Math.abs(dt - (C.prefer[0] + C.prefer[1]) / 2) * 0.3
      if (score < bs) { bs = score; best = c }
    }
    if (best) return new V3(best.x, best.y || 0, best.z)
    // no authored cover near: step behind the nearest box on the far side
    var boxes = G.physics.boxes || [], bb = null, bd = 14
    for (var j = 0; j < boxes.length; j++) {
      var b = boxes[j]
      if (b.bulletOnly || b.playerOnly || b.max.y < pos.y + 0.9 || b.max.x - b.min.x > 14 || b.max.z - b.min.z > 14) continue
      var cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, d2 = Math.hypot(cx - pos.x, cz - pos.z)
      if (d2 < bd) { bd = d2; bb = b }
    }
    if (!bb) return null
    var cx2 = (bb.min.x + bb.max.x) / 2, cz2 = (bb.min.z + bb.max.z) / 2, ax = cx2 - tg.x, az = cz2 - tg.z, al = Math.hypot(ax, az) || 1
    var hw = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 + 0.8
    return new V3(cx2 + (ax / al) * hw, 0, cz2 + (az / al) * hw)
  }
  function flankPoint(tg) {
    var ang = Math.atan2(pos.x - tg.x, pos.z - tg.z) + (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.6)
    var r = C.prefer[0] + Math.random() * (C.prefer[1] - C.prefer[0])
    return new V3(tg.x + Math.sin(ang) * r, 0, tg.z + Math.cos(ang) * r)
  }
  function think(tg) {
    var dist = tg ? Math.hypot(tg.x - pos.x, tg.z - pos.z) : 1e9
    // perception
    var sees = false
    if (tg && dist < C.sight) {
      var fwdAng = Math.abs(SXT_wrap(Math.atan2(-(tg.x - pos.x), -(tg.z - pos.z)) - S.yaw))
      if (fwdAng < 1.35 || dist < 9 || S.state === 'engage') sees = G.physics.lineOfSight(headWorld(tmp), tg)
    }
    S.sees = sees
    if (sees) { S.lastKnown = (S.lastKnown || new V3()).copy(tg); S.lostT = 0; S.seeT = Math.min(6, S.seeT + SXT_TUNE.think); if (S.state !== 'engage' && S.state !== 'cover') { setState('engage'); S.cool = Math.max(S.cool, 0.8 + Math.random() * 0.7); U.sound('alert', { pos: pos.clone(), gain: 0.5, pitch: 1.4 }) } }
    else { S.lostT += SXT_TUNE.think; S.seeT = Math.max(0, S.seeT - SXT_TUNE.think * 2) }
    // tactics
    S.actT -= SXT_TUNE.think
    if (S.state === 'engage') {
      if (S.lostT > 3.2) { setState('search'); return }
      if (S.actT <= 0) {
        S.actT = 2.6 + Math.random() * 2.4
        var r = Math.random(), hurt = unit.hp < unit.maxHp * 0.55 || S.hurtT < 1.5
        if (hurt && r < 0.55) { var cp = pickCover(tg || S.lastKnown); if (cp) { S.goal = cp; setState('cover'); S.coverT = 2.5 + Math.random() * 2; return } }
        if (dist > C.prefer[1]) { S.act = 'advance'; S.goal = S.lastKnown.clone() }
        else if (dist < C.prefer[0] * 0.6) { S.act = 'retreat'; S.goal = flankPoint(tg || S.lastKnown) }
        else if (r < 0.3) { S.act = 'flank'; S.goal = flankPoint(tg || S.lastKnown) }
        else if (r < 0.65) { S.act = 'strafe'; S.strafe = Math.random() < 0.5 ? -1 : 1 }
        else { S.act = 'hold' }
        S.crouchWant = S.act === 'hold' && Math.random() < C.crouch ? 1 : 0
      }
    } else if (S.state === 'search') {
      if (!S.lastKnown) { setState('patrol'); return }
      S.goal = S.lastKnown
      if (Math.hypot(S.lastKnown.x - pos.x, S.lastKnown.z - pos.z) < 2 && S.stateT > 1) {
        if (S.stateT > 6) { S.lastKnown = null; setState('patrol') }
      }
    } else if (S.state === 'patrol') {
      if (!S.goal || Math.hypot(S.goal.x - pos.x, S.goal.z - pos.z) < 1 || S.stateT > 12) {
        S.stateT = 0
        var a = Math.random() * 6.28, rr = S.guard ? 4 + Math.random() * 12 : 3 + Math.random() * 8
        var g = new V3(home.x + Math.sin(a) * rr, 0, home.z + Math.cos(a) * rr)
        if (inNav(home) && !inNav(g)) g.copy(home)
        S.goal = g
      }
    } else if (S.state === 'cover') {
      if (sees && S.stateT > S.coverT) setState('engage')
      if (S.stateT > S.coverT + 3) setState('engage')
    }
  }

  // ------------------------------------------------------------- weapon
  function muzzleWorld(out) {
    if (SV) return SV.muzzle(out)
    var m = GEO.muzzle
    tmp3.set(m[0], m[1], m[2]).applyQuaternion(Q.gun).add(M.gun)
    return toWorld(tmp3, out)
  }
  function fire(tg) {
    muzzleWorld(muzzle)
    var spread = C.spread * (1 - Math.min(0.55, S.seeT / 5)) + (Math.hypot(vel.x, vel.z) > 0.8 ? 0.02 : 0)
    var P = G.player
    if (P && P.vel && Math.hypot(P.vel.x, P.vel.z) > 4.5) spread += 0.012
    dir.copy(tg).sub(muzzle).normalize()
    dir.x += (Math.random() - 0.5) * 2 * spread; dir.y += (Math.random() - 0.5) * 2 * spread * 0.8; dir.z += (Math.random() - 0.5) * 2 * spread
    dir.normalize()
    var h = null
    try { h = U.enemyShot(muzzle, dir, { damage: C.dmg, range: C.range }) } catch (e) { }
    var end = h && h.point ? h.point : tmp.copy(muzzle).addScaledVector(dir, C.range)
    if (G.fx && G.fx.tracer) G.fx.tracer(muzzle, end)
    try { G.render.lightPool.flash(muzzle, 0xffb070, variant === 'marksman' ? 50 : 26, 6, 0.04) } catch (e) { }
    G.events.emit('enemy:fire', { pos: muzzle.clone(), type: variant === 'heavy' ? 'hound' : 'gull' })
    if (variant === 'marksman') U.sound('rifle_shot', { pos: muzzle.clone(), gain: 0.55, pitch: 0.72 })
    S.recoil = Math.min(1, S.recoil + (variant === 'marksman' ? 1 : 0.45))
  }

  // ------------------------------------------------------------- pose
  var SVS = SV ? { group: group, alive: true, y: 0, yaw: 0, vx: 0, vz: 0, crouch: 0, aim: 0, aimYaw: 0, aimPitch: 0, recoil: 0, flinch: 0,
    groundY: function (x, z) { return G.physics.groundHeight(x, z, pos.y + 0.8) } } : null
  function poseSoldier(dt) {
    group.position.copy(pos)
    group.rotation.set(0, S.yaw, 0)
    // the body has settled: wreck() only moves the group from here on
    if (!unit.alive && S.dyingT > 1.6) return
    var cam = G.camera && G.camera.position
    SVS.far = !!cam && unit.alive && (pos.x - cam.x) * (pos.x - cam.x) + (pos.z - cam.z) * (pos.z - cam.z) > 3600
    var fast = Math.hypot(vel.x, vel.z) > C.run * 0.8 && S.burst <= 0 && S.tele < 0
    SVS.alive = unit.alive; SVS.y = pos.y; SVS.yaw = S.yaw; SVS.vx = vel.x; SVS.vz = vel.z; SVS.crouch = S.crouch
    SVS.aim = S.state === 'patrol' ? 0 : fast ? 0.35 : 1
    SVS.aimYaw = S.aimYaw; SVS.aimPitch = S.aimPitch; SVS.recoil = S.recoil; SVS.flinch = S.flinch
    SV.update(dt, SVS)
  }
  function pose(dt) {
    if (SV) return poseSoldier(dt)
    var c = S.crouch
    // pelvis + bob from the stepping foot
    var lift = Math.max(S.feet[0].lift, S.feet[1].lift)
    M.pelvis.set(0, 0.98 - c * 0.3 - lift * 0.25 + Math.sin(SXT_STATE.now * 1.7 + (unit.id || 0)) * 0.004, 0.02 * c)
    // torso: twist to the aim, lean when running / crouched, flinch + recoil
    var speed = Math.hypot(vel.x, vel.z)
    var twist = Math.max(-0.9, Math.min(0.9, S.aimYaw))
    Q.e.set(0.06 * Math.min(1, speed / 3) + c * 0.18 - S.flinch * 0.35 - S.recoil * 0.06, twist * 0.7, 0, 'YXZ')
    Q.chest.setFromEuler(Q.e)
    M.chest.set(0, M.pelvis.y + 0.14, M.pelvis.z)
    M.head.copy(tmp.set(0, 0.48, 0).applyQuaternion(Q.chest)).add(M.chest)
    Q.e.set(S.aimPitch * 0.6, twist * 0.3, 0, 'YXZ')
    Q.head.setFromEuler(Q.e).premultiply(Q.chest)
    M.shL.copy(tmp.set(-0.25, 0.36, 0).applyQuaternion(Q.chest)).add(M.chest)
    M.shR.copy(tmp.set(0.25, 0.36, 0).applyQuaternion(Q.chest)).add(M.chest)
    // weapon pointed at the target
    Q.e.set(Math.max(-0.9, Math.min(0.9, S.aimPitch)) + S.recoil * 0.12 - S.flinch * 0.1, twist, 0, 'YXZ')
    Q.gun.setFromEuler(Q.e)
    M.gun.copy(tmp.set(0.16, 0.18 - S.recoil * 0.01, -0.22 + S.recoil * 0.05).applyQuaternion(gq.setFromAxisAngle(UPV, twist))).add(M.chest)
    M.gripR.copy(tmp.fromArray(GEO.grip).applyQuaternion(Q.gun)).add(M.gun)
    M.gripL.copy(tmp.fromArray(GEO.fore).applyQuaternion(Q.gun)).add(M.gun)
    if (!unit.alive) { M.gripL.y -= 0.25; M.gripR.y -= 0.1 }
    SXT_ik(M.shL, M.gripL, 0.3, 0.28, POLE_AL, M.elL, M.wrL)
    SXT_ik(M.shR, M.gripR, 0.3, 0.28, POLE_AR, M.elR, M.wrR)
    // legs to the planted feet
    M.hipL.set(-0.1, M.pelvis.y - 0.04, M.pelvis.z)
    M.hipR.set(0.1, M.pelvis.y - 0.04, M.pelvis.z)
    toModel(S.feet[0].plant, M.ftL); M.ftL.y += 0.1 + S.feet[0].lift
    toModel(S.feet[1].plant, M.ftR); M.ftR.y += 0.1 + S.feet[1].lift
    SXT_ik(M.hipL, M.ftL, 0.42, 0.42, POLE_LEG, M.knL, M.anL)
    SXT_ik(M.hipR, M.ftR, 0.42, 0.42, POLE_LEG, M.knR, M.anR)
    // write bones
    var B = bones
    B[SXT_B.pelvis].position.copy(M.pelvis); B[SXT_B.pelvis].quaternion.identity()
    B[SXT_B.chest].position.copy(M.chest); B[SXT_B.chest].quaternion.copy(Q.chest)
    B[SXT_B.head].position.copy(M.head); B[SXT_B.head].quaternion.copy(Q.head)
    B[SXT_B.gun].position.copy(M.gun); B[SXT_B.gun].quaternion.copy(Q.gun)
    var limb = function (name, a, b) { var bn = B[SXT_B[name]]; bn.position.copy(a); SXT_orient(bn.quaternion, a, b, XREF) }
    limb('uarmL', M.shL, M.elL); limb('farmL', M.elL, M.wrL)
    limb('uarmR', M.shR, M.elR); limb('farmR', M.elR, M.wrR)
    B[SXT_B.handL].position.copy(M.wrL); B[SXT_B.handL].quaternion.copy(B[SXT_B.farmL].quaternion)
    B[SXT_B.handR].position.copy(M.wrR); B[SXT_B.handR].quaternion.copy(B[SXT_B.farmR].quaternion)
    limb('thighL', M.hipL, M.knL); limb('shinL', M.knL, M.anL)
    limb('thighR', M.hipR, M.knR); limb('shinR', M.knR, M.anR)
    B[SXT_B.footL].position.copy(M.anL); B[SXT_B.footL].quaternion.identity()
    B[SXT_B.footR].position.copy(M.anR); B[SXT_B.footR].quaternion.identity()
    group.position.copy(pos)
    group.rotation.set(0, S.yaw, 0)
  }

  // -------------------------------------------------------------- update
  function stepFeet(dt) {
    var speed = Math.hypot(vel.x, vel.z)
    var stride = 0.2 + speed * 0.12, dur = Math.max(0.17, 0.32 - speed * 0.035)
    var turning = Math.abs(SXT_wrap((S.yawWant != null ? S.yawWant : S.yaw) - S.yaw)) > 0.3
    for (var k = 0; k < 2; k++) {
      var f = S.feet[k], o = S.feet[1 - k]
      if (f.t < 1) {
        f.t = Math.min(1, f.t + dt / dur)
        var e = SXT_ease(f.t)
        f.plant.lerpVectors(f.from, f.to, e)
        f.lift = Math.sin(Math.PI * f.t) * Math.min(0.16, 0.06 + speed * 0.03)
        if (f.t >= 1) { f.lift = 0; if (speed > 2.5 && Math.random() < 0.5) G.events.emit('enemy:step', { pos: f.plant.clone(), type: 'hound' }) }
        continue
      }
      if (o.t < 1) continue
      footHome(f, tmp)
      if (tmp.distanceTo(f.plant) > stride || (turning && tmp.distanceTo(f.plant) > 0.08)) {
        f.from.copy(f.plant)
        f.to.copy(tmp).add(tmp2.set(vel.x * dur * 0.5, 0, vel.z * dur * 0.5))
        f.to.y = G.physics.groundHeight(f.to.x, f.to.z, pos.y + 0.6)
        f.t = 0
        break
      }
    }
  }

  function update(dt) {
    if (!unit.alive) { wreck(dt); return }
    S.stateT += dt
    S.hurtT += dt
    S.flinchV += (-S.flinch * 120 - S.flinchV * 14) * dt
    S.flinch += S.flinchV * dt
    S.recoil = Math.max(0, S.recoil - dt * 4)
    if (S.stun > 0) {
      S.stun -= dt
      releaseToken()
      vel.set(0, 0, 0)
      if (Math.random() < dt * 8 && G.fx && G.fx.sparks) G.fx.sparks(unit.center(tmp), tmp2.set(0, 1, 0), 5)
      S.crouch += (0.8 - S.crouch) * Math.min(1, dt * 4)
      pose(dt)
      return
    }
    var tg = U.target(aim)
    S.thinkT -= dt
    if (S.thinkT <= 0) { S.thinkT = SXT_TUNE.think; think(tg) }

    // movement per state
    var speed = 0, faceMove = true
    if (S.state === 'patrol') { speed = C.walk; moveToward(S.goal, speed, dt, true) }
    else if (S.state === 'search') { speed = C.run * 0.8; moveToward(S.goal, speed, dt, true) }
    else if (S.state === 'cover') { speed = C.run; var arrived = moveToward(S.goal, speed, dt, true); S.crouchWant = arrived ? 1 : 0 }
    else if (S.state === 'engage') {
      faceMove = false
      if (S.act === 'advance' || S.act === 'flank' || S.act === 'retreat') {
        if (moveToward(S.goal, S.act === 'advance' ? C.run * 0.85 : C.run, dt, false)) S.act = 'hold'
      } else if (S.act === 'strafe' && tg) {
        var ax = tg.x - pos.x, az = tg.z - pos.z, al = Math.hypot(ax, az) || 1
        var sx = -az / al * S.strafe, sz = ax / al * S.strafe
        vel.x += (sx * C.walk * 1.2 - vel.x) * Math.min(1, 6 * dt)
        vel.z += (sz * C.walk * 1.2 - vel.z) * Math.min(1, 6 * dt)
      } else moveToward(null, 0, dt, false)
      // face the target when engaging
      if (S.lastKnown) S.yawWant = Math.atan2(-(S.lastKnown.x - pos.x), -(S.lastKnown.z - pos.z))
    }
    S.crouch += (S.crouchWant - S.crouch) * Math.min(1, dt * 5)
    if (S.state !== 'engage' && S.state !== 'cover') S.crouchWant = 0
    // turn
    if (S.yawWant != null) {
      var dy = SXT_wrap(S.yawWant - S.yaw), rate = (S.state === 'engage' ? 3.2 : 4.5) * dt
      S.yaw += Math.max(-rate, Math.min(rate, dy))
    }
    // physics
    vel.y = -9
    var res = null
    try { res = G.physics.moveCapsule(pos, vel, dt, 0.34, 1.8 - S.crouch * 0.6, true) } catch (e) { }
    if (res && res.hitWall && (S.state === 'patrol' || S.act === 'strafe')) { S.strafe = -S.strafe; if (S.state === 'patrol') S.goal = null }
    vel.y = 0
    stepFeet(dt)

    // aim (relative to the body) at the target / last known
    var look = S.sees && tg ? tg : S.lastKnown
    if (look) {
      var want = Math.atan2(-(look.x - pos.x), -(look.z - pos.z))
      S.aimYaw += (SXT_wrap(want - S.yaw) - S.aimYaw) * Math.min(1, dt * 8)
      var hy = pos.y + 1.35 * C.scale
      S.aimPitch += (Math.atan2(look.y - hy, Math.hypot(look.x - pos.x, look.z - pos.z)) - S.aimPitch) * Math.min(1, dt * 6)
    } else { S.aimYaw *= Math.exp(-3 * dt); S.aimPitch *= Math.exp(-3 * dt) }

    // shooting
    S.cool -= dt
    var canShoot = S.state === 'engage' || (S.state === 'cover' && S.stateT > S.coverT * 0.5)
    if (S.burst <= 0 && S.tele < 0 && canShoot && S.sees && tg && S.cool <= 0 && Math.abs(SXT_wrap(Math.atan2(-(tg.x - pos.x), -(tg.z - pos.z)) - S.yaw - S.aimYaw)) < 0.2) {
      if (takeToken()) {
        if (variant === 'marksman') S.tele = 0
        else { S.burst = C.burst[0] + Math.floor(Math.random() * (C.burst[1] - C.burst[0] + 1)); S.shotT = 0.05 }
        if (S.state === 'cover') S.crouchWant = 0
      }
    }
    if (S.tele >= 0) {
      S.tele += dt
      if (laser && tg) {
        muzzleWorld(muzzle)
        laser.position.copy(muzzle)
        laser.lookAt(tg)
        laser.scale.set(1, 1, muzzle.distanceTo(tg))
        laser.visible = Math.sin(S.tele * (S.tele > C.aim - 0.35 ? 60 : 12)) > -0.3
      }
      if (!S.sees || !tg) { S.tele = -1; if (laser) laser.visible = false; releaseToken(); S.cool = 0.8 }
      else if (S.tele >= C.aim) { fire(tg); S.tele = -1; if (laser) laser.visible = false; releaseToken(); S.cool = C.rest[0] + Math.random() * (C.rest[1] - C.rest[0]) }
    }
    if (S.burst > 0) {
      S.shotT -= dt
      if (S.shotT <= 0 && tg) { S.shotT = C.gap; S.burst--; fire(tg) }
      if (S.burst <= 0 || !tg) { S.burst = 0; releaseToken(); S.cool = C.rest[0] + Math.random() * (C.rest[1] - C.rest[0]) }
    }
    pose(dt)
  }

  function wreck(dt) {
    S.dyingT += dt
    var k = SXT_ease(Math.min(1, S.dyingT / 0.75))
    // collapse: knees give, then the body tips over away from the shot
    S.crouch = Math.min(1, S.crouch + dt * 3)
    pose(dt)
    var fx = Math.cos(S.fallDir || 0), fz = Math.sin(S.fallDir || 0)
    group.rotation.set(-fx * 1.45 * k, S.yaw, fz * 1.45 * k * 0.6, 'YXZ')
    group.position.set(pos.x, pos.y + 0.05 * k, pos.z)
    S.wreckT += dt
    if (S.wreckT > 0.8 && S.wreckT - dt <= 0.8) U.sound('container_bang', { pos: pos.clone(), gain: 0.5, pitch: 1.6 })
    if (S.wreckT > SXT_TUNE.wreckLife) {
      group.position.y = pos.y - (S.wreckT - SXT_TUNE.wreckLife) * 0.4
      if (S.wreckT > SXT_TUNE.wreckLife + 4) U.remove(unit)
    }
  }

  // first pose so hit shapes exist before the first update
  S.yawWant = S.yaw
  pose(0)
  return unit
}

// ------------------------------------------------------------- the plugin
SXU_PLUGINS.push(function SXT_plugin(U, G) {
  SXS_start() // parse the soldier model now; the first squad comes ~9 s into the mission
  var V3 = lt.Vector3
  var mission = [], pending = [], now = 0, reinfT = 60, spawned = 0
  var mine = function (u) { return u && u.type === 'trooper' }
  function alive(list) { return list.filter(function (u) { return u.alive }).length }
  function playing() { return G.game && G.game.state === 'playing' }

  // who a squad is sent at: the local player, or online (host) each player in
  // turn so both teams get robots (SXN_spawnFocus in net/net.js)
  function focusPos() {
    var f = typeof SXN_spawnFocus === 'function' ? SXN_spawnFocus() : null
    if (f) return f
    return G.player && G.player.alive ? G.player.pos : null
  }
  function players() { return typeof SXN_playerCount === 'function' ? SXN_playerCount() : 1 }
  // online the host picks Many / Few / Off robots (SXN_botScale in net/net.js)
  function botScale() { return typeof SXN_botScale === 'function' ? SXN_botScale() : 1 }
  function spawnPoint(F) {
    var lv = G.level || {}, P = { pos: F }
    var pts = (lv.enemySpawns || []).filter(function (s) { return s.type === 'ground' })
    if (!pts.length || !F) return null
    var good = [], ok = []
    pts.forEach(function (s) {
      var d = Math.hypot(s.pos.x - P.pos.x, s.pos.z - P.pos.z)
      if (d < 22 || d > 80) return
      ok.push(s)
      if (!G.physics.lineOfSight(new V3(s.pos.x, s.pos.y + 1.4, s.pos.z), new V3(P.pos.x, P.pos.y + 1.6, P.pos.z))) good.push(s)
    })
    var list = good.length ? good : ok.length ? ok : pts
    return list[Math.floor(Math.random() * list.length)].pos
  }
  function variantFor(k, n) {
    if (k === 0) return 'rifle'
    var r = Math.random()
    return r < 0.22 ? 'heavy' : r < 0.42 ? 'marksman' : 'rifle'
  }
  function spawnSquad(n, at, opts) {
    opts = opts || {}
    var sc = botScale()
    if (sc <= 0) return []
    if (sc < 1) n = Math.max(1, Math.round(n * sc))
    var F = focusPos()
    var base = at || spawnPoint(F)
    if (!base) return []
    var cap = Math.max(1, Math.round(Math.min(16, 6 + 3 * (players() - 1)) * sc)) // 8 players: still ≤ 16 alive
    var out = []
    for (var k = 0; k < n; k++) {
      if (!opts.garrison && alive(mission) >= cap) break
      var a = (k / Math.max(1, n)) * 6.28 + Math.random() * 0.8, r = 1.6 + Math.random() * 1.8
      var p = U.spotOutside ? U.spotOutside(base.x + Math.sin(a) * r, base.z + Math.cos(a) * r, 0.5) : new V3(base.x + Math.sin(a) * r, 0, base.z + Math.cos(a) * r)
      var u = U.spawn('trooper', {
        pos: p, yaw: F ? Math.atan2(-(F.x - p.x), -(F.z - p.z)) : 0,
        variant: opts.variant || variantFor(k, n), home: opts.home || p, guard: !!opts.garrison,
        state: opts.garrison ? 'patrol' : 'search', lastKnown: opts.garrison ? null : F ? F.clone() : null,
      })
      if (u) { out.push(u); spawned++; if (!opts.garrison) mission.push(u) }
    }
    return out
  }

  U.hooks.reset.push(function () {
    mission = []; pending = [{ t: 9, n: 2 }]; now = 0; reinfT = 60
    SXT_STATE.tokens.clear(); SXT_STATE.lastStart = -9
    ;(U.outposts || []).forEach(function (s) { s._sxt = false })
  })
  G.events.on('objective:done', function (ev) { pending.push({ t: now + 3.5, n: ev && ev.index >= 2 ? 3 : 2 }) })
  G.events.on('objective:all', function () { pending.push({ t: now + 4, n: 3 }) })
  // gunfire draws them in
  G.events.on('weapon:fire', function (ev) {
    var o = ev && (ev.origin || ev.muzzle)
    if (!o) return
    U.list.forEach(function (u) {
      if (!mine(u) || !u.alive) return
      if (u.pos.distanceTo(o) < SXT_TUNE.hear) u.alert(o)
    })
  })

  U.hooks.update.push(function (dt) {
    now += dt
    SXT_STATE.now += dt
    if (!playing()) return
    mission = mission.filter(function (u) { return u.alive })
    for (var k = pending.length - 1; k >= 0; k--) {
      if (pending[k].t <= now) { spawnSquad(pending[k].n); pending.splice(k, 1) }
    }
    reinfT -= dt
    if (reinfT <= 0) {
      // online the waves come faster and bigger, one per player in turn
      var np = players(), bs = botScale()
      reinfT = (50 + Math.random() * 25) / Math.min(2.5, np) / Math.max(0.35, bs)
      if (bs > 0 && alive(mission) < Math.max(1, Math.round(2 * np * bs))) spawnSquad(np > 1 ? 3 : 2)
    }
    // desert outposts: a garrison of troopers when a site wakes up
    ;(U.outposts || []).forEach(function (site) {
      if (site._sxt || site.def.side !== 'enemy' || !site.active || site.status !== 'hostile') return
      site._sxt = true
      var n = 3 + Math.floor(Math.random() * 3)
      var g = spawnSquad(n, new V3(site.def.x, 0, site.def.z), { garrison: true, home: new V3(site.def.x, 0, site.def.z) })
      g.forEach(function (u) { site.garrison.push(u) })
    })
  })
  U.troopers = { spawnSquad: spawnSquad, mission: function () { return mission }, tune: SXT_TUNE }
})
