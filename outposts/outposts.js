// ============================================================================
// DoomZone mod — OUTPOSTS (desert map only)
// Four sites out on the dunes, each in a flat bowl carved into the terrain
// (SXD_terrainHeight reads SXO_SITES). Camp Mirage is ours from the start;
// Ridge Post, Radar Station and the Fuel Depot are held by machines.
//   * SXO_layout(api)      builds the structures inside SXD_level (colliders,
//                          merged meshes, same builders as the basin)
//   * SXU_TYPES.turret     enemy gun emplacement (static, telegraphed bursts)
//   * SXU_TYPES.sentinel   ally six-wheeled gun robot (patrols, shoots machines)
//   * plugin               garrisons wake up when you come close, a site is
//                          captured when its garrison is down: allies roll in,
//                          supplies appear; on-screen markers for every site
// ============================================================================

var SXO_SITES = [
  {
    id: 'mirage', name: 'Camp Mirage', side: 'ally', x: -175, z: -35, r: 22,
    sentinels: [[4, 5], [-7, -3], [3, -9]], supplies: [['ammo', -3, 7], ['grenade', -0.6, 8.6], ['med', -6.2, 7.2], ['med_l', -8.6, 5], ['ammo', 7, -2], ['att:x4', -1.5, 4.6], ['att:grip', 1.2, 6.2], ['att:stock', 0.2, 3.4], ['att:extmag', -3.4, 3.2], ['att:comp', 2.6, 4.4], ['vest2', -4.6, 9.2], ['helm2', -2.8, 10.4], ['bag1', -6.8, 9.8], ['bag2', 1.4, 9.6]],
    vehicles: [['rhino', 13, 6, -1.57], ['sandcat', 12, -3, -1.57]],
  },
  {
    id: 'ridge', name: 'Ridge Post', side: 'enemy', x: 150, z: -70, r: 20,
    turrets: [[-9, 6], [9, -5], [2, 12], [-4, -12]], gulls: 3, guard: 'colossus',
    sentinels: [[3, 4], [-5, -3]], supplies: [['ammo', 0, -6], ['med', 2, -7.5], ['grenade', -2, -7.4], ['att:supp', 3.5, -5.5], ['att:comp', -3.6, -5.2], ['helm3', 0.5, -9.4], ['bag2', -2.6, -9.8]],
  },
  {
    id: 'radar', name: 'Radar Station', side: 'enemy', x: 30, z: 210, r: 22,
    turrets: [[-11, -6], [9, 9], [11, -9], [-3, 13]], gulls: 3, guard: 'skua',
    sentinels: [[-4, -4], [5, 3]], supplies: [['ammo', -6, 2], ['med_l', -8, 3.5], ['grenade', -6, 5], ['sniper', -3, 9.5], ['att:x8', -9.5, 6.4], ['vest3', -10.5, 2.5], ['bag2', -11.6, 5.2]],
  },
  {
    id: 'depot', name: 'Fuel Depot', side: 'enemy', x: -70, z: -240, r: 24,
    turrets: [[-13, 4], [13, -4], [0, 15], [0, -15], [-10, -11]], gulls: 4,
    sentinels: [[4, 2], [-4, -2], [0, 7]], supplies: [['ammo', 5, 8], ['med', 7, 8], ['grenade', 3, 9.5], ['ammo', -8, 2], ['att:extmag', 9, 9.6], ['att:holo', 6.5, 10.4], ['att:stock', 4.5, 11.2], ['vest3', -9.5, 5.5], ['helm3', -7, 7.4], ['bag3', -5, 9.6]],
  },
]

// ---------------------------------------------------------------- layout
function SXO_layout(api) {
  var t = api.t, place = api.place, M = api.M, ts = api.ts
  var tarp = M('tarp'), plaster = M('sxd_plaster'), steel = M('steel_dark'), white = M('paint_white'), conc = M('concrete_dirty'), blue = M('paint_blue')
  var seed = 500
  var S = function () { return ++seed }

  function tent(x, z, yaw, len, w, h) {
    var shape = new lt.Shape()
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, h); shape.lineTo(-w / 2, 0)
    var g = new lt.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 1 })
    g.translate(0, 0, -len / 2)
    g.rotateY(yaw)
    g.translate(x, 0, z)
    t.add(g, tarp, {})
    // ridge pole + guy ropes
    var c = Math.cos(yaw), s = Math.sin(yaw)
    t.rod(steel, [x - s * len * 0.55, 0, z - c * len * 0.55], [x - s * len * 0.55, h + 0.15, z - c * len * 0.55], 0.03, { seg: 5 })
    t.rod(steel, [x + s * len * 0.55, 0, z + c * len * 0.55], [x + s * len * 0.55, h + 0.15, z + c * len * 0.55], 0.03, { seg: 5 })
    var hx = Math.abs(c) * w / 2 + Math.abs(s) * len / 2, hz = Math.abs(s) * w / 2 + Math.abs(c) * len / 2
    t.col(x - hx, 0, z - hz, x + hx, h * 0.85, z + hz, 'concrete')
  }
  function helipad(x, z) {
    t.box(conc, 9, 0.08, 9, x, 0.04, z)
    t.box(white, 0.5, 0.012, 3.6, x - 1, 0.085, z)
    t.box(white, 0.5, 0.012, 3.6, x + 1, 0.085, z)
    t.box(white, 2, 0.012, 0.45, x, 0.085, z)
    for (var k = 0; k < 4; k++) t.box(white, k % 2 ? 0.3 : 8.6, 0.012, k % 2 ? 8.6 : 0.3, x + (k === 1 ? 4.15 : k === 3 ? -4.15 : 0), 0.085, z + (k === 0 ? 4.15 : k === 2 ? -4.15 : 0))
  }
  function flag(x, z, mat) {
    t.rod(steel, [x, 0, z], [x, 7, z], 0.05, { seg: 6 })
    t.box(mat, 0.02, 0.9, 1.5, x, 6.45, z - 0.78)
  }
  function hut(x, z, w, d, h, yaw, doorSide) {
    // four plaster walls with a door gap + a flat roof slab
    var hw = w / 2, hd = d / 2
    api.wall(x - hw, z - hd, x + hw, z - hd, h, S(), doorSide === 'n' ? { gaps: [Math.round(w / 0.9 / 2)] } : {})
    api.wall(x - hw, z + hd, x + hw, z + hd, h, S(), doorSide === 's' ? { gaps: [Math.round(w / 0.9 / 2)] } : {})
    api.wall(x - hw, z - hd, x - hw, z + hd, h, S())
    api.wall(x + hw, z - hd, x + hw, z + hd, h, S())
    t.box(plaster, w + 0.6, 0.18, d + 0.6, x, h + 0.1, z)
    t.col(x - hw - 0.3, h, z - hd - 0.3, x + hw + 0.3, h + 0.2, z + hd + 0.3, 'concrete')
  }
  function dish(x, z, yaw) {
    t.cyl(steel, 0.35, 3.2, x, 1.6, z, { seg: 10 })
    var pts = []
    for (var k = 0; k <= 10; k++) { var r = (k / 10) * 2.4; pts.push(new lt.Vector2(r, r * r * 0.16)) }
    var g = new lt.LatheGeometry(pts, 28)
    g.rotateX(-1.0)
    g.rotateY(yaw)
    g.translate(x, 3.6, z)
    t.add(g, white, {})
    t.col(x - 0.4, 0, z - 0.4, x + 0.4, 3.4, z + 0.4, 'metal')
  }

  SXO_SITES.forEach(function (site) {
    var X = site.x, Z = site.z
    var P = function (dx, dz) { return [X + dx, Z + dz] }
    var p
    if (site.id === 'mirage') {
      tent(X - 8, Z + 6, 0.1, 6, 4, 2.6)
      tent(X - 1, Z + 11, ts, 5, 3.6, 2.4)
      tent(X - 12, Z - 4, -0.2, 5, 3.6, 2.4)
      helipad(X + 8, Z - 11)
      p = P(-13, 10); t.stack(p[0], p[1], [[20, 'green', { wear: 0.6 }]], 0.1)
      p = P(-15, -12); t.stack(p[0], p[1], [[20, 'white', { wear: 0.7 }], [20, 'green', { wear: 0.6 }]], ts)
      p = P(-4, -15); api.fuelTank(p[0], p[1], true, 6, 1.1, 'paint_white', 'JET A-1')
      flag(X + 2, Z + 2, blue)
      api.sandbagRow(X + 17, Z + 4, ts, 3, S())
      api.sandbagRow(X + 17, Z - 6, ts, 2, S())
      api.sandbagRow(X - 4, Z + 17, 0, 4, S())
      api.sandbagRow(X - 6, Z - 19, 0, 3, S())
      place('light_mast', X + 4, Z + 14, 0, { seed: S() })
      place('light_mast', X - 16, Z + 1, 0, { seed: S() })
      place('generator', X - 9, Z - 9, 0.3, { seed: S() })
      place('crate_stack', X - 4, Z + 4.2, 0.2, { seed: S() })
      place('pallet_stack', X - 2.5, Z + 3, 0.1, { seed: S() })
      place('jerry_can', X - 5.5, Z + 3.4, 0.4, { seed: S() })
      place('barrel', X + 14, Z - 9, 0, { seed: S(), color: 'blue' })
      place('barrel', X + 14.6, Z - 8.2, 0.4, { seed: S() })
      place('jersey_barrier', X + 19, Z + 10, ts, { seed: S() })
      place('jersey_barrier', X + 19, Z - 13, ts, { seed: S() })
    } else if (site.id === 'ridge') {
      api.wall(X - 14, Z - 14, X + 6, Z - 14, 2.2, S(), { gaps: [10] })
      api.wall(X - 14, Z - 14, X - 14, Z + 8, 2.2, S(), { gaps: [12] })
      api.wall(X + 6, Z + 14, X + 14, Z + 14, 2.0, S())
      api.mast(X - 2, Z + 1, 14)
      p = P(6, 4); t.stack(p[0], p[1], [[20, 'red', { wear: 0.9 }], [20, 'grey', { wear: 0.9 }]], 0.3)
      p = P(-7, -4); t.stack(p[0], p[1], [[20, 'yellow', { wear: 0.9 }]], ts + 0.1)
      api.truck(X + 11, Z - 10, 0.8, { burnt: true })
      api.sandbagRow(X - 9, Z + 9, 0.3, 3, S())
      api.sandbagRow(X + 10, Z - 2, ts, 2, S())
      api.sandbagRow(X + 1, Z + 15, 0, 3, S())
      place('generator', X + 1, Z - 5, 0.1, { seed: S() })
      place('barrel', X - 3, Z - 9, 0, { seed: S(), color: 'red' })
      place('barrel', X - 2.2, Z - 9.6, 0.5, { seed: S() })
      place('crate_wood', X + 3, Z + 8, 0.4, { seed: S() })
      place('floodlight_stand', X - 11, Z + 2, 0.6, { seed: S() })
      api.rockCluster(X + 16, Z + 8, 3, 1.4, S())
      api.rockCluster(X - 17, Z - 6, 3, 1.3, S())
      api.scrub(X + 13, Z + 4, 1, S())
    } else if (site.id === 'radar') {
      api.mast(X + 3, Z - 3, 30)
      dish(X - 6, Z - 8, 0.6)
      hut(X - 7, Z + 6, 7, 5.4, 2.7, 0, 's')
      p = P(9, 3); api.fuelTank(p[0], p[1], false, 5, 1.0, 'paint_white', 'DIESEL')
      p = P(12, -12); t.stack(p[0], p[1], [[40, 'white', { wear: 0.85 }]], 0.6)
      api.sandbagRow(X - 15, Z - 2, ts, 3, S())
      api.sandbagRow(X + 2, Z + 16, 0, 3, S())
      api.sandbagRow(X + 15, Z + 6, ts, 2, S())
      place('light_mast', X - 14, Z + 12, 0, { seed: S() })
      place('generator', X + 5, Z + 9, 0.2, { seed: S() })
      place('cable_reel', X - 2, Z - 12, 0.3, { seed: S() })
      place('barrel', X + 7, Z - 6, 0, { seed: S(), color: 'yellow' })
      place('jersey_barrier', X - 4, Z - 17, 0.05, { seed: S() })
      api.rockCluster(X + 18, Z - 2, 4, 1.5, S())
      api.scrub(X - 12, Z - 13, 1.1, S())
    } else if (site.id === 'depot') {
      var tanks = [[-8, -7, 1.5], [-8, 0, 1.5], [6, -9, 1.3], [8, 6, 1.4]]
      tanks.forEach(function (k, n) { var q = P(k[0], k[1]); api.fuelTank(q[0], q[1], true, 8, k[2], n % 2 ? 'paint_white' : 'paint_grey', n % 2 ? 'FUEL' : 'CRUDE') })
      api.pipeline(X - 16, X + 16, Z + 3.4, S())
      api.pipeline(X - 14, X + 12, Z - 3.6, S())
      p = P(-14, 11); t.stack(p[0], p[1], [[20, 'orange', { wear: 0.9 }]], 0.2)
      p = P(14, 12); t.stack(p[0], p[1], [[20, 'blue', { wear: 0.9 }], [20, 'white', { wear: 0.85 }]], ts)
      api.truck(X - 2, Z + 12, Math.PI / 2, { canopy: true, paint: 'paint_grey' })
      api.sandbagRow(X - 19, Z, ts, 3, S())
      api.sandbagRow(X + 19, Z, ts, 3, S())
      api.sandbagRow(X, Z - 19, 0, 3, S())
      place('jersey_barrier', X + 4, Z + 19, 0.05, { seed: S() })
      place('jersey_barrier', X - 4, Z + 19, -0.04, { seed: S() })
      place('gas_cylinders', X + 12, Z - 1, 0.3, { seed: S() })
      place('barrel', X + 2, Z - 12, 0, { seed: S(), color: 'red' })
      place('barrel', X + 2.8, Z - 12.4, 0.6, { seed: S(), color: 'red' })
      place('light_mast', X + 16, Z - 14, 0, { seed: S() })
      place('light_mast', X - 16, Z + 16, 0, { seed: S() })
      api.rockCluster(X + 20, Z + 18, 3, 1.4, S())
    }
  })
}

// ----------------------------------------------------- shared unit helpers
function SXO_sphereHit(o, d, c, r, max) {
  var ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z
  var b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc
  if (h < 0) return -1
  var tt = -b - Math.sqrt(h)
  if (tt < 0 || tt > max) return -1
  return tt
}

// Fire one ally round at the machines: world + robots + enemy units (no
// hitmarkers / accuracy stats — that is the player's, not the robot's).
function SXO_allyShot(G, U, o, d, dmg, range) {
  var w = G.physics.raycast(o, d, range), dist = w ? w.dist : range
  var e = null
  try { e = G.enemies.raycast(o, d, dist) } catch (er) { }
  var end = new lt.Vector3()
  if (e && e.dist <= dist) {
    end.copy(e.point)
    try { e.enemy.damage(dmg, e.point, d, e.part === 'weak' ? 'body' : e.part) } catch (er) { }
    G.events.emit('impact', { point: e.point, normal: e.normal || d.clone().negate(), dist: e.dist, surface: 'enemy', enemy: e.enemy, dir: d, from: 'ally' })
  } else if (w) {
    end.copy(w.point)
    G.events.emit('impact', { point: w.point, normal: w.normal, dist: w.dist, surface: w.surface, enemy: null, dir: d, from: 'ally' })
  } else end.copy(o).addScaledVector(d, range)
  return end
}

// ------------------------------------------------------------ enemy turret
SXU_TYPES.turret = function (G, U, opts) {
  var V3 = lt.Vector3
  var mats = { conc: G.mats.get('concrete_dirty'), steel: G.mats.get('steel_dark'), gun: G.mats.get('gunmetal'), paint: G.mats.get('paint_grey'), hazard: G.mats.get('hazard_stripes'), eye: G.mats.emissive(0xff2a12, 18) }
  var root = new lt.Group()
  var pos = opts.pos.clone()
  root.position.copy(pos)
  var mk = function (geo, mat, parent) { var m = new lt.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; (parent || root).add(m); return m }
  mk(new lt.CylinderGeometry(1.05, 1.2, 0.7, 16).translate(0, 0.35, 0), mats.conc)
  mk(new lt.CylinderGeometry(1.08, 1.08, 0.12, 16).translate(0, 0.62, 0), mats.hazard)
  mk(new lt.CylinderGeometry(0.22, 0.28, 0.7, 10).translate(0, 1.0, 0), mats.steel)
  var yawG = new lt.Group(); yawG.position.y = 1.4; root.add(yawG)
  mk(Wi(0.95, 0.5, 0.85, 0.06), mats.paint, yawG)
  mk(Wi(1.05, 0.12, 0.6, 0.03).translate(0, 0.3, 0.05), mats.steel, yawG)
  var pitchG = new lt.Group(); pitchG.position.set(0, 0.02, -0.25); yawG.add(pitchG)
  for (var s = -1; s <= 1; s += 2) {
    mk(new lt.CylinderGeometry(0.055, 0.065, 1.05, 10).rotateX(Math.PI / 2).translate(s * 0.15, 0, -0.55), mats.gun, pitchG)
    mk(new lt.CylinderGeometry(0.08, 0.08, 0.18, 10).rotateX(Math.PI / 2).translate(s * 0.15, 0, -1.02), mats.steel, pitchG)
  }
  var eye = mk(new lt.SphereGeometry(0.09, 12, 8).translate(0, 0.16, -0.45), mats.eye, yawG)
  // laser sight while telegraphing
  var laserGeo = new lt.CylinderGeometry(0.012, 0.012, 1, 6).rotateX(Math.PI / 2).translate(0, 0, -0.5)
  var laser = new lt.Mesh(laserGeo, new lt.MeshBasicMaterial({ color: new lt.Color(6, 0.3, 0.15), transparent: true, opacity: 0.85, depthWrite: false, fog: false }))
  laser.visible = false
  pitchG.add(laser)
  root.rotation.y = opts.yaw || 0
  G.scene.add(root)

  var tmp = new V3(), tmp2 = new V3(), aim = new V3(), muzzle = new V3(), dir = new V3()
  var st = { mode: 'idle', t: 0, cool: 1 + Math.random() * 2, shots: 0, shotT: 0, stun: 0, yaw: 0, pitch: 0, sinceSeen: 9 }
  var unit = {
    type: 'turret', label: 'Turret', faction: 'enemy', alive: true, pos: pos, hp: 260, maxHp: 260, radius: 1.5,
    center: function (o) { return (o || new V3()).set(pos.x, pos.y + 1.1, pos.z) },
    raycast: function (o, d, max) {
      eye.getWorldPosition(tmp)
      var te = SXO_sphereHit(o, d, tmp, 0.2, max)
      yawG.getWorldPosition(tmp2)
      var th = SXO_sphereHit(o, d, tmp2, 0.62, max)
      var tb = SXO_sphereHit(o, d, tmp.set(pos.x, pos.y + 0.45, pos.z), 1.1, max)
      var best = -1, part = 'body'
      if (te >= 0) { best = te; part = 'weak' }
      if (th >= 0 && (best < 0 || th < best - 0.05)) { best = th; part = 'body' }
      if (tb >= 0 && (best < 0 || tb < best)) { best = tb; part = 'body' }
      if (best < 0) return null
      var pt = o.clone().addScaledVector(d, best)
      return { dist: best, point: pt, normal: d.clone().negate(), part: part }
    },
    damage: function (amount, point, d, part) {
      if (!unit.alive || !(amount > 0)) return false
      unit.hp -= amount
      st.sinceSeen = 0
      if (G.fx && G.fx.sparks && point) G.fx.sparks(point, d ? d.clone().negate() : new V3(0, 1, 0), 6)
      if (unit.hp <= 0) { die(); return true }
      return false
    },
    stun: function (sec) { st.stun = Math.max(st.stun, sec) },
    update: update,
    dispose: function () { G.scene.remove(root) },
  }
  function die() {
    unit.alive = false
    laser.visible = false
    eye.visible = false
    var c = unit.center(new V3())
    try { G.fx.explosion(c, 0.9) } catch (e) { }
    yawG.rotation.z = 0.5; yawG.position.y = 1.05; yawG.rotation.x = 0.35
    U.killed(unit)
  }
  function update(dt) {
    if (!unit.alive) return
    if (st.stun > 0) {
      st.stun -= dt
      laser.visible = false
      if (Math.random() < dt * 6 && G.fx && G.fx.sparks) G.fx.sparks(unit.center(tmp), new V3(0, 1, 0), 5)
      return
    }
    var tgt = U.target(aim)
    if (!tgt) return
    yawG.getWorldPosition(muzzle)
    var dx = tgt.x - muzzle.x, dy = tgt.y - muzzle.y, dz = tgt.z - muzzle.z, dist = Math.hypot(dx, dy, dz)
    st.t += dt
    var sees = false
    if (dist < 78) {
      st.losT = (st.losT || 0) - dt
      if (st.losT <= 0) { st.losT = 0.2; st.los = G.physics.lineOfSight(muzzle, tgt) }
      sees = st.los
    }
    if (sees) st.sinceSeen = 0; else st.sinceSeen += dt
    // aim: yaw is world yaw minus the root yaw
    var wantYaw = Math.atan2(-dx, -dz) - root.rotation.y
    var wantPitch = Math.atan2(dy, Math.hypot(dx, dz))
    if (sees || st.sinceSeen < 2) {
      var dyaw = Math.atan2(Math.sin(wantYaw - st.yaw), Math.cos(wantYaw - st.yaw))
      st.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dyaw))
      st.pitch += Math.max(-1.5 * dt, Math.min(1.5 * dt, wantPitch - st.pitch))
    } else st.yaw += dt * 0.35
    yawG.rotation.y = st.yaw
    pitchG.rotation.x = st.pitch
    var aligned = Math.abs(Math.atan2(Math.sin(wantYaw - st.yaw), Math.cos(wantYaw - st.yaw))) < 0.12
    st.cool -= dt
    if (st.mode === 'idle' && sees && aligned && st.cool <= 0) { st.mode = 'tele'; st.t = 0 }
    if (st.mode === 'tele') {
      laser.visible = true
      laser.scale.set(1, 1, Math.min(dist, 80))
      if (st.t > 0.55) { st.mode = 'fire'; st.t = 0; st.shots = 0; st.shotT = 0 }
      if (!sees) { st.mode = 'idle'; laser.visible = false }
    } else laser.visible = false
    if (st.mode === 'fire') {
      st.shotT -= dt
      if (st.shotT <= 0 && st.shots < 7) {
        st.shotT = 0.085
        st.shots++
        var side = st.shots % 2 ? -0.15 : 0.15
        muzzle.set(side, 0, -1.1)
        pitchG.localToWorld(muzzle)
        dir.copy(tgt).sub(muzzle).normalize()
        dir.x += (Math.random() - 0.5) * 0.05; dir.y += (Math.random() - 0.5) * 0.04; dir.z += (Math.random() - 0.5) * 0.05
        dir.normalize()
        var h = U.enemyShot(muzzle, dir, { damage: 4, range: 95 })
        if (G.fx && G.fx.tracer) G.fx.tracer(muzzle, h && h.point ? h.point : tmp.copy(muzzle).addScaledVector(dir, 90))
        try { G.render.lightPool.flash(muzzle, 0xffb060, 30, 6, 0.04) } catch (e) { }
        G.events.emit('enemy:fire', { pos: muzzle.clone(), type: 'hound' })
      }
      if (st.shots >= 7) { st.mode = 'idle'; st.cool = 1.6 + Math.random() * 1.2 }
    }
  }
  return unit
}

// ---------------------------------------------------------- ally sentinel
SXU_TYPES.sentinel = function (G, U, opts) {
  var V3 = lt.Vector3
  var mats = { body: G.mats.get('paint_blue'), white: G.mats.get('paint_white'), steel: G.mats.get('steel_dark'), tire: G.mats.get('tire'), gun: G.mats.get('gunmetal'), light: G.mats.emissive(0x55c8ff, 10) }
  var root = new lt.Group()
  var pos = opts.pos.clone()
  var home = (opts.home || pos).clone()
  root.position.copy(pos)
  var mk = function (geo, mat, parent) { var m = new lt.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; (parent || root).add(m); return m }
  var body = new lt.Group(); root.add(body)
  mk(Wi(1.15, 0.42, 1.7, 0.08).translate(0, 0.62, 0), mats.body, body)
  mk(Wi(1.0, 0.16, 1.2, 0.05).translate(0, 0.9, 0.1), mats.steel, body)
  mk(Wi(0.5, 0.05, 0.36, 0.02).translate(0, 0.86, -0.82), mats.light, body)
  var wheels = []
  for (var wz = -1; wz <= 1; wz++)
    for (var wx = -1; wx <= 1; wx += 2) {
      var w = mk(new lt.CylinderGeometry(0.3, 0.3, 0.24, 14).rotateZ(Math.PI / 2), mats.tire, body)
      w.position.set(wx * 0.68, 0.3, wz * 0.62)
      wheels.push(w)
    }
  var yawG = new lt.Group(); yawG.position.y = 1.0; body.add(yawG)
  mk(Wi(0.62, 0.32, 0.66, 0.05).translate(0, 0.16, 0), mats.white, yawG)
  mk(new lt.CylinderGeometry(0.045, 0.05, 0.8, 8).rotateX(Math.PI / 2).translate(0.12, 0.2, -0.62), mats.gun, yawG)
  mk(new lt.SphereGeometry(0.06, 10, 8).translate(-0.18, 0.3, -0.3), mats.light, yawG)
  mk(new lt.CylinderGeometry(0.012, 0.012, 0.9, 5).translate(-0.24, 0.75, 0.22), mats.steel, yawG)
  G.scene.add(root)

  var tmp = new V3(), tmp2 = new V3(), muzzle = new V3(), dir = new V3(), vel = new V3()
  var st = { yaw: opts.yaw || 0, gunYaw: 0, wp: null, wpT: 0, target: null, scanT: 0, burst: 0, shotT: 0, cool: 0.5, wreckT: 0 }
  var unit = {
    type: 'sentinel', label: 'Sentinel', faction: 'ally', alive: true, pos: pos, hp: 420, maxHp: 420, radius: 1.3,
    center: function (o) { return (o || new V3()).set(pos.x, pos.y + 0.75, pos.z) },
    raycast: function (o, d, max) {
      var tt = SXO_sphereHit(o, d, unit.center(tmp), 0.95, max)
      return tt < 0 ? null : { dist: tt, point: o.clone().addScaledVector(d, tt), normal: d.clone().negate(), part: 'body' }
    },
    damage: function (amount, point) {
      if (!unit.alive || !(amount > 0)) return false
      unit.hp -= amount
      if (point && G.fx && G.fx.sparks) G.fx.sparks(point, new V3(0, 1, 0), 4)
      if (unit.hp <= 0) {
        unit.alive = false
        try { G.fx.explosion(unit.center(new V3()), 0.7) } catch (e) { }
        body.rotation.z = 0.25
        yawG.visible = false
        U.killed(unit)
        return true
      }
      return false
    },
    update: update,
    dispose: function () { G.scene.remove(root) },
  }
  function pickTarget() {
    var best = null, bd = 52 * 52
    unit.center(tmp)
    var en = G.enemies && G.enemies.list || []
    for (var k = 0; k < en.length; k++) {
      var e = en[k]
      if (!e.alive) continue
      var d2 = e.pos.distanceToSquared(tmp)
      if (d2 < bd) { bd = d2; best = { obj: e, unit: false } }
    }
    U.list.forEach(function (u) {
      if (!u.alive || u.faction !== 'enemy') return
      var d2 = u.center(tmp2).distanceToSquared(tmp)
      if (d2 < bd * 1.4) { bd = d2; best = { obj: u, unit: true } }
    })
    if (best) {
      var c = best.unit ? best.obj.center(tmp2) : tmp2.copy(best.obj.pos).setY(best.obj.pos.y + (best.obj.type === 'hound' ? 0.6 : 0))
      if (!G.physics.lineOfSight(tmp.set(pos.x, pos.y + 1.25, pos.z), c)) best = null
    }
    return best
  }
  function update(dt) {
    if (!unit.alive) return
    // targets
    st.scanT -= dt
    if (st.scanT <= 0) { st.scanT = 0.35; st.target = pickTarget() }
    var tg = st.target && st.target.obj && st.target.obj.alive ? st.target : null
    // patrol around home (stop to shoot)
    if (!st.wp || pos.distanceTo(st.wp) < 1.2 || (st.wpT -= dt) <= 0) {
      var a = Math.random() * 6.28, r = 3 + Math.random() * 9
      st.wp = new V3(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r)
      st.wpT = 9
    }
    var speed = tg ? 0 : 2.6
    var dx = st.wp.x - pos.x, dz = st.wp.z - pos.z, dl = Math.hypot(dx, dz) || 1
    var want = Math.atan2(-dx, -dz)
    if (speed > 0) {
      var dyaw = Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw))
      st.yaw += Math.max(-1.8 * dt, Math.min(1.8 * dt, dyaw))
      var fwdK = Math.max(0, Math.cos(dyaw))
      vel.set(-Math.sin(st.yaw) * speed * fwdK, -9, -Math.cos(st.yaw) * speed * fwdK)
      G.physics.moveCapsule(pos, vel, dt, 0.8, 1.3, true)
      wheels.forEach(function (w) { w.rotation.x -= speed * fwdK * dt / 0.3 })
    } else {
      pos.y = G.physics.groundHeight(pos.x, pos.z, pos.y + 0.6)
    }
    root.position.copy(pos)
    body.rotation.y = st.yaw
    // turret
    var aimYaw = st.yaw
    if (tg) {
      var c = tg.unit ? tg.obj.center(tmp2) : tmp2.copy(tg.obj.pos).setY(tg.obj.pos.y + (tg.obj.type === 'hound' ? 0.6 : 0))
      aimYaw = Math.atan2(-(c.x - pos.x), -(c.z - pos.z))
    }
    var gy = aimYaw - st.yaw
    var dg = Math.atan2(Math.sin(gy - st.gunYaw), Math.cos(gy - st.gunYaw))
    st.gunYaw += Math.max(-3 * dt, Math.min(3 * dt, dg))
    yawG.rotation.y = st.gunYaw
    st.cool -= dt
    if (tg && Math.abs(dg) < 0.1 && st.cool <= 0) { st.burst = 6; st.cool = 1.4 + Math.random() * 0.8 }
    if (st.burst > 0) {
      st.shotT -= dt
      if (st.shotT <= 0) {
        st.shotT = 0.1
        st.burst--
        muzzle.set(0.12, 0.2, -1.02)
        yawG.localToWorld(muzzle)
        var c2 = tg ? (tg.unit ? tg.obj.center(tmp2) : tmp2.copy(tg.obj.pos).setY(tg.obj.pos.y + (tg.obj.type === 'hound' ? 0.6 : 0.1))) : null
        if (c2) {
          dir.copy(c2).sub(muzzle).normalize()
          dir.x += (Math.random() - 0.5) * 0.04; dir.y += (Math.random() - 0.5) * 0.03; dir.z += (Math.random() - 0.5) * 0.04
          dir.normalize()
          var end = SXO_allyShot(G, U, muzzle, dir, 9, 70)
          if (G.fx && G.fx.tracer) G.fx.tracer(muzzle, end)
          try { G.render.lightPool.flash(muzzle, 0xffc070, 20, 5, 0.04) } catch (e) { }
          U.sound('rifle_shot', { pos: muzzle.clone(), gain: 0.35, pitch: 1.25 })
        } else st.burst = 0
      }
    }
  }
  return unit
}

// ------------------------------------------------------------- the plugin
SXU_PLUGINS.push(function SXO_plugin(U, G) {
  if (!U.desert) return
  var V3 = lt.Vector3
  var sites = SXO_SITES.map(function (s) { return { def: s, status: s.side === 'ally' ? 'ally' : 'hostile', active: false, garrison: [], gulls: [], allies: [], told: false } })
  var groundPos = function (x, z) { return new V3(x, U.groundAt(x, z, 999), z) }
  var arsenal = function () { return G.weapon && G.weapon.arsenal }
  var hud = function () { return U.hud() }
  var introT = -1

  function spawnAllies(site) {
    var s = site.def
    ;(s.sentinels || []).forEach(function (p, k) {
      var u = U.spawn('sentinel', { pos: groundPos(s.x + p[0], s.z + p[1]), yaw: k * 2.1, home: new V3(s.x, 0, s.z) })
      u && site.allies.push(u)
    })
  }
  function spawnSupplies(site) {
    var a = arsenal()
    if (!a || !a.spawnPickup) return
    ;(site.def.supplies || []).forEach(function (q) { a.spawnPickup(q[0], groundPos(site.def.x + q[1], site.def.z + q[2])) })
  }
  // the big guard comes once the boss ladder (units/units.js) reaches its kind
  function spawnGuard(site) {
    var s = site.def
    if (!site.guardDue || !site.active || site.status === 'captured') return
    if (U.ladderOk && !U.ladderOk(s.guard)) return
    site.guardDue = false
    var gp = s.guard === 'skua' ? new V3(s.x, 50, s.z + 30) : groundPos(s.x + 26, s.z + 10)
    var gu = U.spawn(s.guard, { pos: gp, yaw: 0, guard: true, home: new V3(s.x, 0, s.z) })
    gu && site.garrison.push(gu)
  }
  U.hooks.update.push(function () { ;(U.outposts || []).forEach(function (site) { if (site.guardDue) spawnGuard(site) }) })
  function activate(site) {
    var s = site.def
    site.active = true
    ;(s.turrets || []).forEach(function (p) {
      var u = U.spawn('turret', { pos: groundPos(s.x + p[0], s.z + p[1]), yaw: Math.atan2(p[0], p[1]) })
      u && site.garrison.push(u)
    })
    for (var k = 0; k < (s.gulls || 0); k++) {
      var a = (k / s.gulls) * 6.28
      var g = null
      try { g = G.enemies.spawn('gull', new V3(s.x + Math.cos(a) * 8, 9 + k, s.z + Math.sin(a) * 8), { state: 'patrol', hover: 9 + k, patrolRadius: 10 }) } catch (e) { }
      g && site.gulls.push(g)
    }
    site.guardDue = !!(s.guard && SXU_TYPES[s.guard])
    spawnGuard(site)
    if (!site.told) {
      site.told = true
      U.radio('Control: ' + s.name + ' is held by machines. Clear it and we will move people in.', 5)
    }
  }
  function capture(site) {
    site.status = 'captured'
    var h = hud()
    h && h.warn(site.def.name + ' captured', 3)
    h && h.feed('<b class="sx-pk">' + site.def.name + '</b> captured — allies inbound')
    U.radio('Control: good work. ' + site.def.name + ' is ours — Sentinels are rolling in, supplies dropped.', 5)
    spawnAllies(site)
    spawnSupplies(site)
    U.sound('objective', { gain: 0.9 })
  }

  U.hooks.reset.push(function () {
    sites.forEach(function (site) {
      site.status = site.def.side === 'ally' ? 'ally' : 'hostile'
      site.active = false
      site.garrison = []; site.gulls = []; site.allies = []
      site.told = false
      if (site.def.side === 'ally') {
        spawnAllies(site)
        spawnSupplies(site)
        ;(site.def.vehicles || []).forEach(function (v) { if (SXU_TYPES[v[0]]) U.spawn(v[0], { pos: U.spotOutside(site.def.x + v[1], site.def.z + v[2], v[0] === 'rhino' ? 3.6 : 2.6), yaw: v[3] }) })
      }
    })
    introT = 26
  })

  // ---- markers (screen-space, every site)
  var ui = null, proj = new V3()
  function buildUi() {
    var h = hud()
    if (!h || !h.root) return
    ui = document.createElement('div')
    ui.className = 'sxo-marks'
    h.root.appendChild(ui)
    sites.forEach(function (site) {
      var el = document.createElement('div')
      el.className = 'sxo-mark'
      el.innerHTML = '<i></i><b></b><span></span>'
      el._b = el.querySelector('b'); el._s = el.querySelector('span')
      el._b.textContent = site.def.name
      ui.appendChild(el)
      site.el = el
    })
  }

  U.hooks.update.push(function (dt) {
    var P = G.player
    if (!P) return
    if (introT > 0) {
      introT -= dt
      if (introT <= 0) U.radio('Control: Camp Mirage holds the west dunes. Machines hold Ridge Post, Radar Station and the Fuel Depot — take them if you can.', 6)
    }
    if (!ui) buildUi()
    var cam = G.camera, W = innerWidth, H = innerHeight
    // a site wakes when you come within 150 m on foot / in a ground vehicle,
    // 400 m in an aircraft (so a jet can strike it from stand-off range)
    var pv = U.pilot, wakeR = pv && pv.alive && (pv.solid && pv.solid.air || pv.type === 'kestrel') ? 400 : 150
    sites.forEach(function (site) {
      var s = site.def
      var d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z)
      var netGuest = typeof SXN !== 'undefined' && SXN.active && SXN.role === 'guest'
      var dw = typeof SXN_nearestOps === 'function' ? SXN_nearestOps(s.x, s.z, d) : d
      if (!netGuest && site.status === 'hostile' && !site.active && dw < wakeR) activate(site)
      if (!netGuest && site.status === 'hostile' && site.active) {
        var left = site.garrison.filter(function (u) { return u.alive }).length + site.gulls.filter(function (g) { return g.alive && g.active !== false }).length
        site.left = left
        if (left === 0) capture(site)
      }
      if (site.def.side === 'ally' && !site.told && d < 70) {
        site.told = true
        U.radio('Mirage: Breacher, welcome to Camp Mirage. Take what you need — the Rhino is fuelled.', 5)
      }
      // marker
      if (!site.el) return
      var show = d > 28 && d < 900
      if (show) {
        proj.set(s.x, 14, s.z).project(cam)
        show = proj.z < 1 && Math.abs(proj.x) < 1.02 && Math.abs(proj.y) < 1.02
        if (show) site.el.style.transform = 'translate3d(' + Math.round((proj.x * 0.5 + 0.5) * W) + 'px,' + Math.round((-proj.y * 0.5 + 0.5) * H) + 'px,0)'
      }
      if (site.el._on !== show) { site.el._on = show; site.el.classList.toggle('on', show) }
      var cls = site.status === 'hostile' ? 'hostile' : 'friendly'
      if (site.el._c !== cls) { site.el._c = cls; site.el.classList.toggle('hostile', cls === 'hostile') }
      var label = Math.round(d) + 'm' + (site.status === 'hostile' && site.active ? ' · ' + (site.left || 0) + ' left' : site.status === 'captured' ? ' · ours' : '')
      if (site.el._l !== label) { site.el._l = label; site.el._s.textContent = label }
    })
  })
  U.outposts = sites
  // online rooms: guests mirror the host's sites (captured → allies + supplies here too)
  U.outpostNet = {
    capture: function (site) { if (site.status === 'hostile') capture(site) },
    setActive: function (site, on, left) {
      if (on && !site.active && !site.told) { site.told = true; U.radio('Control: ' + site.def.name + ' is held by machines. Clear it and we will move people in.', 5) }
      site.active = !!on; site.left = left
    },
  }
})
