// ============================================================================
// DoomZone mod — OUTPOSTS (desert map only)
// Eleven sites out on the dunes, each in a flat bowl carved into the terrain
// (SXD_terrainHeight reads SXO_SITES). Camp Mirage and, far out, Camp Oasis
// are ours from the start; Ridge Post, Radar Station and the Fuel Depot near
// the basin and six posts in the deep desert (1-1.2 km out) are held by machines.
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
    hello: 'Mirage: Breacher, welcome to Camp Mirage. Take what you need — the Rhino is fuelled.',
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
  // ---- the deep desert, 1-1.2 km from the basin (the map reaches 1.5 km):
  // clear of the highway (> 120 m), the mesas and each other
  {
    id: 'saltpan', name: 'Salt Pan Relay', side: 'enemy', x: 820, z: -520, r: 22,
    turrets: [[-13, 6], [11, -10], [13, 10], [-8, -13]], gulls: 3,
    sentinels: [[4, -4], [-2, 2]], supplies: [['ammo', 2, 6], ['med', 4, 6.5], ['grenade', 0, 7.2], ['att:x4', -1.5, 6.2], ['helm2', 3.4, 8.4], ['med_s', 5.6, 5.4]],
  },
  {
    id: 'wells', name: 'Sunken Wells', side: 'enemy', x: -850, z: -700, r: 24,
    turrets: [[-13, 6], [14, -4], [2, 15], [-2, -15]], gulls: 3, guard: 'colossus',
    sentinels: [[4, 3], [-5, -2]], supplies: [['ammo', -4, 8.6], ['med_l', -2, 9.2], ['grenade', -6, 9.4], ['att:extmag', 0, 8.8], ['vest2', -8.2, 8], ['bag2', 2, 9.8]],
  },
  {
    id: 'scrapyard', name: 'Scrapyard', side: 'enemy', x: 900, z: 520, r: 26,
    turrets: [[-13, -6], [13, 6], [-4, 15], [6, -15], [16, -10]], gulls: 4,
    sentinels: [[2, 3], [-3, -4], [6, -1]], supplies: [['ammo', -6, -2], ['ammo', 5, 9], ['med', -7, -0.5], ['grenade', 7, 9.6], ['att:supp', -8.4, -3], ['att:grip', 6, 10.8], ['vest3', 3, 11], ['helm3', -9, 1], ['shotgun', -4.6, 1.2]],
  },
  {
    id: 'checkpoint', name: 'Checkpoint Nine', side: 'enemy', x: -80, z: 980, r: 22,
    turrets: [[-11, 6], [11, 6], [-8, -12], [9, -11]], gulls: 2,
    sentinels: [[0, 4], [-4, -5]], supplies: [['ammo', 6, -4], ['med', 7.5, -2.6], ['grenade', 6.2, -6.2], ['att:holo', 4.6, -2], ['att:comp', 8.6, -5.4], ['helm2', 4, -6.4], ['bag1', 9.2, -1]],
  },
  {
    id: 'quarry', name: 'West Quarry', side: 'enemy', x: -1050, z: 250, r: 26,
    turrets: [[-14, 4], [14, -4], [-2, 16], [9, 14], [-9, -13]], gulls: 3, guard: 'skua',
    sentinels: [[3, -2], [-3, 4]], supplies: [['ammo', 4, -9], ['med_l', 6, -8.4], ['grenade', 2, -10.4], ['sniper', 8, -10], ['att:x8', 9.4, -8.2], ['vest3', 3.4, -12]],
  },
  {
    id: 'bunker', name: 'Bunker Line', side: 'enemy', x: 420, z: -1120, r: 24,
    turrets: [[-14, -8], [14, -8], [-14, 8], [14, 8], [0, -16], [0, 16]], gulls: 3, guard: 'colossus',
    sentinels: [[6, 0], [-6, 0], [0, -11]], supplies: [['ammo', -6, -4], ['ammo', 6, -4], ['med_l', -6, -6], ['grenade', 6, -6], ['att:supp', -4, -7.4], ['att:extmag', 4, -7.4], ['vest3', -1.2, -8], ['helm3', 1.2, -8], ['bag3', 0, -5.4]],
  },
  {
    id: 'oasis', name: 'Camp Oasis', side: 'ally', x: -760, z: 820, r: 22,
    hello: 'Oasis: Breacher, you made it all the way out here. Water, ammo and a Sandcat — help yourself.',
    sentinels: [[5, 4], [-6, -4]], supplies: [['ammo', -2, 6.4], ['ammo', 2, 6.4], ['grenade', 0, 7.6], ['med_l', -4.2, 6.6], ['med', 4.2, 6.6], ['att:x4', -1, 8.6], ['att:supp', 1.2, 8.6], ['vest2', -3.4, 9.6], ['helm2', 3.4, 9.6], ['bag2', 0, 10.4]],
    vehicles: [['sandcat', 12, -4, -1.57]],
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
  var wood = M('wood_dark'), plank = M('wood_pallet'), roofM = M('corrugated_roof'), galv = M('steel_galv'), rust = M('steel_rust'), dirt = M('concrete_dirty')
  // timber watchtower: splayed legs, braces, a boarded platform, tin roof, ladder
  function watchtower(x, z) {
    var H = 4.8, b = 1.55, tp = 1.25
    for (var k = 0; k < 4; k++) {
      var sx = k & 1 ? 1 : -1, sz = k & 2 ? 1 : -1
      t.rod(wood, [x + sx * b, 0, z + sz * b], [x + sx * tp, H, z + sz * tp], 0.1, { seg: 6 })
      t.rod(wood, [x + sx * tp, H, z + sz * tp], [x + sx * tp, H + 2.3, z + sz * tp], 0.06, { seg: 5 })
      t.col(x + sx * b - 0.2, 0, z + sz * b - 0.2, x + sx * b + 0.2, 2.4, z + sz * b + 0.2, 'wood')
    }
    for (var y of [1.4, 3.2]) {
      var r0 = b + (tp - b) * (y / H), r1 = b + (tp - b) * ((y + 1.5) / H)
      t.rod(wood, [x - r0, y, z - r0], [x + r1, y + 1.5, z - r1], 0.045, { seg: 4 })
      t.rod(wood, [x - r0, y, z + r0], [x + r1, y + 1.5, z + r1], 0.045, { seg: 4 })
      t.rod(wood, [x - r0, y, z - r0], [x - r1, y + 1.5, z + r1], 0.045, { seg: 4 })
      t.rod(wood, [x + r0, y, z - r0], [x + r1, y + 1.5, z + r1], 0.045, { seg: 4 })
    }
    t.box(plank, 3.1, 0.14, 3.1, x, H, z, { bevel: 0.02 })
    t.box(plank, 3.1, 0.9, 0.08, x, H + 0.52, z - 1.52)
    t.box(plank, 3.1, 0.9, 0.08, x, H + 0.52, z + 1.52)
    t.box(plank, 0.08, 0.9, 3.1, x - 1.52, H + 0.52, z)
    t.box(plank, 0.08, 0.9, 1.6, x + 1.52, H + 0.52, z - 0.75)
    t.box(roofM, 3.7, 0.06, 3.7, x, H + 2.35, z, { r: [0.08, 0, 0] })
    for (var s of [-0.24, 0.24]) t.rod(wood, [x + b + 0.35, 0, z + 0.6 + s], [x + tp + 0.12, H, z + 0.6 + s], 0.03, { seg: 4 })
    for (var ry = 0.4; ry < H; ry += 0.4) {
      var fx = b + 0.35 + (tp + 0.12 - b - 0.35) * (ry / H)
      t.rod(wood, [x + fx, ry, z + 0.36], [x + fx, ry, z + 0.84], 0.02, { seg: 4 })
    }
    t.col(x - 1.6, H - 0.08, z - 1.6, x + 1.6, H + 0.1, z + 1.6, 'wood')
  }
  // reinforced-concrete bunker, door in the south (-z) wall, gun slit in the north one
  function bunker(x, z, w, d, h) {
    var th = 0.6, hw = w / 2, hd = d / 2, door = 0.9
    var B = function (bw, bh, bd, cx, cy, cz) {
      t.box(dirt, bw, bh, bd, cx, cy, cz, { bevel: 0.04 })
      t.col(cx - bw / 2, cy - bh / 2, cz - bd / 2, cx + bw / 2, cy + bh / 2, cz + bd / 2, 'concrete')
    }
    B(w, 1.25, th, x, 0.625, z + hd - th / 2)
    B(w, h - 1.7, th, x, (h + 1.7) / 2, z + hd - th / 2)
    B(0.9, 0.45, th, x - hw + 0.45, 1.475, z + hd - th / 2)
    B(0.9, 0.45, th, x + hw - 0.45, 1.475, z + hd - th / 2)
    B(0.9, 0.45, th, x, 1.475, z + hd - th / 2)
    B(th, h, d, x - hw + th / 2, h / 2, z)
    B(th, h, d, x + hw - th / 2, h / 2, z)
    B(hw - door, h, th, x - (hw + door) / 2, h / 2, z - hd + th / 2)
    B(hw - door, h, th, x + (hw + door) / 2, h / 2, z - hd + th / 2)
    B(door * 2, h - 2.1, th, x, (h + 2.1) / 2, z - hd + th / 2)
    B(w + 0.8, 0.5, d + 0.8, x, h + 0.25, z)
    t.box(M('hazard_stripes'), door * 2 + 0.2, 0.16, 0.05, x, 2.18, z - hd - 0.02)
    api.sandbagRow(x - hw + 1.2, z + hd + 0.9, 0, 2, S())
    api.sandbagRow(x + hw - 1.2, z + hd + 0.9, 0, 2, S())
  }
  function pillbox(x, z) {
    t.cyl(dirt, 2.0, 1.95, x, 0.975, z, { seg: 18 })
    t.cyl(dirt, 2.35, 0.36, x, 2.13, z, { seg: 18 })
    t.box(steel, 2.4, 0.2, 0.12, x, 1.5, z + 1.96)
    t.col(x - 1.7, 0, z - 1.7, x + 1.7, 2.3, z + 1.7, 'concrete')
  }
  // anti-tank "dragon's teeth"
  function tooth(x, z) {
    t.cyl(dirt, 0.72, 1.15, x, 0.575, z, { seg: 4, rTop: 0.12 })
    t.col(x - 0.45, 0, z - 0.45, x + 0.45, 1.05, z + 0.45, 'concrete')
  }
  // a pile of gravel / spoil (stepped colliders, too steep to climb)
  function gravel(x, z, R, H) {
    t.cyl(dirt, R, H, x, H / 2, z, { seg: 18, rTop: 0.5 })
    t.col(x - R * 0.72, 0, z - R * 0.72, x + R * 0.72, H * 0.38, z + R * 0.72, 'concrete')
    t.col(x - R * 0.42, 0, z - R * 0.42, x + R * 0.42, H * 0.72, z + R * 0.42, 'concrete')
  }
  // flattened car hulks stacked up
  function crushed(x, z, yaw, n) {
    var paints = ['steel_rust', 'paint_teal', 'steel_rust', 'paint_red', 'paint_white', 'steel_rust']
    for (var k = 0; k < n; k++) {
      var j = ((k * 37) % 7) / 7 - 0.5
      t.box(M(paints[(k + Math.round(x)) % paints.length]), 4.1, 0.52, 1.85, x + j * 0.4, 0.27 + k * 0.54, z - j * 0.3, { bevel: 0.06, r: [0, yaw + j * 0.5, 0] })
    }
    t.col(x - 2.2, 0, z - 2.2, x + 2.2, n * 0.54, z + 2.2, 'metal')
  }
  // a scrap crane: lattice tower, jib along +x, a magnet hanging off it
  function crane(x, z, H, L) {
    var yel = M('paint_yellow')
    var c = [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]]
    for (var k = 0; k < 4; k++) t.rod(yel, [x + c[k][0], 0, z + c[k][1]], [x + c[k][0], H, z + c[k][1]], 0.07, { seg: 5 })
    for (var y = 0; y < H - 0.1; y += 1.6) {
      for (var k2 = 0; k2 < 4; k2++) {
        var a = c[k2], b2 = c[(k2 + 1) % 4]
        t.rod(galv, [x + a[0], y, z + a[1]], [x + b2[0], y + 1.6, z + b2[1]], 0.025, { seg: 3 })
        t.rod(galv, [x + a[0], y + 1.6, z + a[1]], [x + b2[0], y + 1.6, z + b2[1]], 0.025, { seg: 3 })
      }
    }
    t.box(yel, 2.4, 1.6, 2.0, x - 0.6, H + 0.8, z, { bevel: 0.04 })
    t.box(M('glass_dirty'), 0.05, 0.7, 1.4, x + 0.62, H + 1.0, z)
    t.box(dirt, 1.6, 1.1, 1.8, x - 2.4, H + 0.6, z)
    t.rod(yel, [x - 1.6, H + 1.4, z - 0.45], [x + L, H + 1.4, z - 0.45], 0.07, { seg: 5 })
    t.rod(yel, [x - 1.6, H + 1.4, z + 0.45], [x + L, H + 1.4, z + 0.45], 0.07, { seg: 5 })
    t.rod(yel, [x - 1.6, H + 2.4, z], [x + L * 0.98, H + 1.45, z], 0.06, { seg: 5 })
    for (var jx = -1; jx < L; jx += 1.4) t.rod(galv, [x + jx, H + 1.4, z - 0.45], [x + jx + 0.7, H + 1.4 + 0.95 * (1 - (jx + 0.7) / L), z], 0.02, { seg: 3 })
    var hx = x + L * 0.82, hy = 6.2
    t.rod(steel, [hx, H + 1.35, z - 0.08], [hx, hy + 0.5, z - 0.08], 0.018, { seg: 4 })
    t.rod(steel, [hx, H + 1.35, z + 0.08], [hx, hy + 0.5, z + 0.08], 0.018, { seg: 4 })
    t.cyl(steel, 0.85, 0.35, hx, hy, z, { seg: 18 })
    t.cyl(M('paint_orange'), 0.2, 0.3, hx, hy + 0.32, z, { seg: 10 })
    t.col(x - 0.8, 0, z - 0.8, x + 0.8, H, z + 0.8, 'metal')
  }
  // still oasis water: dark teal, glossy, a fixed ripple in the normal
  var waterM = new lt.MeshStandardMaterial({ color: 0x1c4446, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.4 })
  waterM.name = 'sxo_water'
  waterM.onBeforeCompile = function (sh) {
    sh.vertexShader = 'varying vec3 vSxoW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSxoW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = 'varying vec3 vSxoW;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\n  { vec2 q = vSxoW.xz; float a = sin(q.x * 2.3) + sin(q.y * 3.1 + q.x * 0.7) * 0.7 + sin((q.x + q.y) * 6.1) * 0.3;\n    float b = cos(q.y * 2.6) + cos(q.x * 3.4 - q.y * 0.9) * 0.6 + cos((q.x - q.y) * 5.7) * 0.3;\n    normal = normalize(normal + mat3(viewMatrix) * vec3(a * 0.025, 0.0, b * 0.025)); }')
  }
  waterM.customProgramCacheKey = function () { return 'sxo-water-1' }
  var frondM = new lt.MeshStandardMaterial({ color: 0x5c7330, roughness: 0.85, side: lt.DoubleSide })
  frondM.name = 'sxo_frond'
  // one palm frond: a tapering strip arching out and down, folded into a shallow V
  function frondGeo(L, W, droop) {
    var n = 9, pos = [], idx = []
    for (var k = 0; k <= n; k++) {
      var u = k / n, x = L * u, y = L * (0.18 * u - droop * u * u)
      var w = W * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.04)), 0.7) * (1 - u * 0.45)
      pos.push(x, y - w * 0.4, -w, x, y, 0, x, y - w * 0.4, w)
      if (k < n) {
        var a = k * 3
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5)
      }
    }
    var g = new lt.BufferGeometry()
    g.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new lt.Float32BufferAttribute(new Array((n + 1) * 6).fill(0), 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  // stone well with a windlass and a bucket
  function well(x, z) {
    t.cyl(M('sxd_adobe'), 1.3, 0.85, x, 0.425, z, { seg: 20 })
    t.cyl(waterM, 1.02, 0.02, x, 0.86, z, { seg: 20 })
    for (var s of [-1, 1]) t.rod(wood, [x + s * 1.12, 0.85, z], [x + s * 1.12, 2.3, z], 0.07, { seg: 5 })
    t.rod(wood, [x - 1.3, 2.18, z], [x + 1.3, 2.18, z], 0.07, { seg: 6 })
    t.rod(M('rope'), [x, 2.12, z], [x, 1.25, z], 0.014, { seg: 4 })
    t.cyl(M('steel_worn'), 0.18, 0.3, x, 1.1, z, { seg: 10 })
    t.col(x - 1.25, 0, z - 1.25, x + 1.25, 0.85, z + 1.25, 'concrete')
  }
  // a small pond ringed with stones
  function pond(x, z, R, seed) {
    t.cyl(waterM, R, 0.04, x, 0.02, z, { seg: 36 })
    var r = SXD_rng(seed)
    for (var k = 0; k < 14; k++) {
      var a = (k / 14) * 6.28 + r() * 0.3, s = 0.35 + r() * 0.35
      api.rock(x + Math.cos(a) * (R + 0.1), z + Math.sin(a) * (R + 0.1), s * 1.3, s * 0.55, s, r() * 6.28, seed * 7 + k, { noCol: true })
    }
  }
  // date palm: a leaning, tapering trunk and a crown of drooping fronds
  function palm(x, z, H, lean, seed) {
    var r = SXD_rng(seed), la = r() * 6.28, top = null, prev = [x, 0, z]
    for (var k = 1; k <= 6; k++) {
      var f = k / 6, off = lean * f * f
      var p = [x + Math.cos(la) * off, H * f, z + Math.sin(la) * off]
      t.rod(wood, prev, p, 0.2 - 0.08 * f, { seg: 7, cast: true })
      prev = p
    }
    top = prev
    for (var n = 0; n < 11; n++) {
      var a = (n / 11) * 6.28 + r() * 0.4, g = frondGeo(2.6 + r() * 0.9, 0.42 + r() * 0.12, 0.45 + r() * 0.35)
      g.rotateY(-a)
      t.add(g, frondM, { p: [top[0], top[1] - 0.1, top[2]] })
    }
    t.cyl(wood, 0.24, 0.5, top[0], top[1] - 0.3, top[2], { seg: 8, rTop: 0.14 })
    t.col(x - 0.25, 0, z - 0.25, x + 0.25, H * 0.5, z + 0.25, 'wood')
  }
  // a belt conveyor between two points (low end → high end) on trestles
  function conveyor(x0, y0, x1, y1, z) {
    var len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan((y1 - y0) / (x1 - x0)) // tilt in (-90°, 90°): the box's +y stays up
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    t.box(steel, len, 0.18, 1.0, cx, cy, z, { r: [0, 0, ang] })
    t.box(M('rubber'), len, 0.04, 0.8, cx - Math.sin(ang) * 0.11, cy + Math.cos(ang) * 0.11, z, { r: [0, 0, ang] })
    for (var f = 0.15; f < 0.95; f += 0.32) {
      var px = x0 + (x1 - x0) * f, py = y0 + (y1 - y0) * f
      for (var s of [-0.45, 0.45]) t.rod(galv, [px, 0, z + s], [px, py - 0.1, z + s], 0.05, { seg: 5 })
      t.col(px - 0.15, 0, z - 0.55, px + 0.15, py, z + 0.55, 'metal')
    }
    t.box(steel, 1.7, 1.3, 1.7, x0 + Math.sign(x0 - x1) * 0.6, 0.85, z, { bevel: 0.03 })
    t.col(x0 + Math.sign(x0 - x1) * 0.6 - 0.85, 0, z - 0.85, x0 + Math.sign(x0 - x1) * 0.6 + 0.85, 1.5, z + 0.85, 'metal')
  }
  function guyWires(x, z, y, R, angs) {
    angs.forEach(function (a) {
      var gx = x + Math.cos(a) * R, gz = z + Math.sin(a) * R
      t.rod(galv, [x, y, z], [gx, 0.25, gz], 0.012, { seg: 3 })
      t.box(dirt, 0.5, 0.25, 0.5, gx, 0.12, gz)
    })
  }

  SXO_GROUPS = []
  SXO_SITES.forEach(function (site) {
    var X = site.x, Z = site.z
    var P = function (dx, dz) { return [X + dx, Z + dz] }
    var p
    var n0 = t.staticRoot.children.length
    SXO_GROUPS.push({ site: site, from: n0 })
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
    } else if (site.id === 'saltpan') {
      // a relay mast on the salt flat: guyed lattice, two dishes, an equipment hut
      api.mast(X, Z - 2, 24)
      guyWires(X, Z - 2, 18, 13, [0.8, 2.9, 4.6])
      dish(X - 8, Z - 6, 0.9)
      dish(X + 7, Z - 9, -0.5)
      hut(X - 6, Z + 7, 6, 5, 2.7, 0, 'n')
      p = P(13, -1); t.stack(p[0], p[1], [[20, 'white', { wear: 0.8 }]], ts)
      place('generator', X + 7, Z + 1, 0.2, { seed: S() })
      place('cable_reel', X - 3, Z - 8, 0.3, { seed: S() })
      place('cable_reel', X + 3.5, Z - 11, 1.2, { seed: S() })
      place('light_mast', X - 16, Z - 4, 0, { seed: S() })
      place('light_mast', X + 9, Z + 15, 0, { seed: S() })
      place('barrel', X + 9, Z + 4, 0, { seed: S(), color: 'yellow' })
      place('barrel', X + 9.7, Z + 4.6, 0.5, { seed: S() })
      place('jersey_barrier', X - 2, Z + 18, 0.05, { seed: S() })
      place('jersey_barrier', X + 3, Z + 18.2, -0.04, { seed: S() })
      api.sandbagRow(X - 18, Z + 2, ts, 3, S())
      api.sandbagRow(X + 18, Z - 6, ts, 3, S())
      api.sandbagRow(X + 2, Z - 18, 0, 3, S())
      api.rockCluster(X + 22, Z + 14, 3, 1.4, S())
      api.rockCluster(X - 22, Z - 15, 4, 1.6, S())
      api.scrub(X + 17, Z - 16, 1.1, S())
    } else if (site.id === 'wells') {
      // pumping station round an old well: two pumpjacks, a water tower, pipes
      well(X, Z - 1)
      api.pumpjack(X - 9, Z - 8, 0.3, 'paint_red', S())
      api.pumpjack(X + 8, Z - 11, -0.5, 'paint_blue', S())
      api.waterTower(X + 10, Z + 7)
      p = P(-8, 13); api.fuelTank(p[0], p[1], true, 6, 1.1, 'paint_white', 'WATER')
      api.pipeline(X - 20, X - 2, Z + 3, S())
      api.truck(X - 15, Z - 3, ts + 0.2, { canopy: true, paint: 'paint_yellow' })
      place('generator', X + 6, Z - 3, 0.4, { seed: S() })
      place('ibc_tote', X - 12, Z + 9, 0.1, { seed: S() })
      place('ibc_tote', X - 13.4, Z + 9.3, 0.05, { seed: S() })
      place('gas_cylinders', X + 15, Z + 13, 0.3, { seed: S() })
      place('pipe_stack', X - 16, Z - 14, 0.4, { seed: S() })
      place('barrel', X + 3, Z - 6, 0, { seed: S(), color: 'blue' })
      place('barrel', X + 3.7, Z - 6.5, 0.4, { seed: S() })
      place('light_mast', X + 17, Z - 15, 0, { seed: S() })
      place('light_mast', X - 18, Z + 16, 0, { seed: S() })
      api.sandbagRow(X - 21, Z - 9, ts, 3, S())
      api.sandbagRow(X + 21, Z + 2, ts, 3, S())
      api.sandbagRow(X + 6, Z + 21, 0, 3, S())
      api.sandbagRow(X - 6, Z - 21, 0, 3, S())
      api.rockCluster(X + 24, Z - 17, 3, 1.5, S())
      api.rockCluster(X - 25, Z + 17, 4, 1.4, S())
      api.scrub(X - 19, Z + 21, 1.2, S())
    } else if (site.id === 'scrapyard') {
      // a scrap yard: rusted container stacks, burnt trucks, crushed hulks, a magnet crane
      p = P(-11, -13); t.stack(p[0], p[1], [[40, 'red', { wear: 0.95 }], [40, 'grey', { wear: 0.95 }]], 0.15)
      p = P(12, -2); t.stack(p[0], p[1], [[20, 'blue', { wear: 0.9 }]], ts)
      p = P(18, 16); t.stack(p[0], p[1], [[20, 'orange', { wear: 0.95 }], [20, 'green', { wear: 0.9 }], [20, 'white', { wear: 0.9 }]], 0.4)
      api.truck(X - 2, Z + 8, 0.4, { burnt: true })
      api.truck(X - 17, Z + 7, 1.3, { burnt: true })
      api.truck(X + 9, Z + 18, 2.5, { burnt: true })
      crushed(X - 18, Z + 16, 0.3, 4)
      crushed(X + 20, Z - 18, 1.2, 3)
      crushed(X + 2, Z - 20, 0.1, 5)
      crane(X - 7, Z - 21, 12, 10)
      place('tire_stack', X + 3, Z - 6, 0.3, { seed: S() })
      place('tire_stack', X + 4.3, Z - 7.3, 1, { seed: S() })
      place('tire_stack', X - 10, Z + 12, 0.2, { seed: S() })
      place('dumpster', X - 14, Z + 1, ts, { seed: S() })
      place('pipe_stack', X + 9, Z + 3, 0.2, { seed: S() })
      place('cable_reel', X - 1, Z - 10, 0.5, { seed: S() })
      place('barrel', X + 1.2, Z - 12, 0, { seed: S(), color: 'red' })
      place('barrel', X + 0.4, Z - 12.7, 0.4, { seed: S() })
      place('light_mast', X + 21, Z + 3, 0, { seed: S() })
      place('light_mast', X - 21, Z - 4, 0, { seed: S() })
      api.sandbagRow(X + 1, Z + 23, 0, 3, S())
      api.rockCluster(X + 28, Z + 9, 3, 1.4, S())
      api.scrub(X - 26, Z - 14, 1.2, S())
    } else if (site.id === 'checkpoint') {
      // a road checkpoint watching the highway (west): towers, a booth, a chicane
      watchtower(X - 15, Z - 13)
      watchtower(X + 14, Z + 12)
      hut(X + 5, Z + 14, 6, 4.4, 2.6, 0, 'n')
      p = P(-5, 15); t.stack(p[0], p[1], [[20, 'yellow', { wear: 0.8 }]], 0)
      flag(X - 2, Z, M('paint_red'))
      api.truck(X + 15, Z - 3, ts, { canopy: true, paint: 'paint_grey' })
      place('guard_booth', X - 17, Z + 3, ts, { seed: S() })
      place('gate_arm', X - 19, Z - 1, ts, { seed: S() })
      place('jersey_barrier', X - 20, Z - 6, ts, { seed: S() })
      place('jersey_barrier', X - 20, Z + 9, ts, { seed: S() })
      place('jersey_barrier', X - 14, Z + 6.5, 0.05, { seed: S() })
      for (var c = 0; c < 4; c++) place('traffic_cone', X - 22, Z - 3 + c * 1.6, 0, { seed: S() })
      place('sign_post', X - 21, Z + 12, ts, { seed: S() })
      place('floodlight_stand', X - 12, Z - 4, 0.8, { seed: S() })
      place('crate_stack', X + 10.5, Z + 1.5, 0.2, { seed: S() })
      place('barrel', X + 11, Z - 8, 0, { seed: S(), color: 'red' })
      place('light_mast', X + 3, Z - 18, 0, { seed: S() })
      api.sandbagRow(X + 2, Z - 9, 0, 3, S())
      api.sandbagRow(X - 9, Z + 1, ts, 3, S())
      api.sandbagRow(X + 18, Z + 4, ts, 2, S())
      api.rockCluster(X + 24, Z - 14, 3, 1.3, S())
      api.scrub(X - 24, Z - 16, 1.2, S())
      api.scrub(X + 22, Z + 20, 1, S())
    } else if (site.id === 'quarry') {
      // an open quarry: cut rock faces, spoil heaps, a conveyor, the site office
      api.rock(X - 22, Z - 3, 4, 6, 9, 0.12, S())
      api.rock(X - 15, Z - 22, 7, 5, 4, 0.5, S())
      api.rock(X + 6, Z - 24, 5, 4, 3, 1.2, S())
      gravel(X + 8, Z + 4, 4, 3)
      gravel(X - 6, Z + 13, 3.4, 2.4)
      conveyor(X + 17, 0.8, X + 10, 3.4, Z + 4)
      api.truck(X - 8, Z + 3, 0.3, { paint: 'paint_yellow' })
      api.truck(X + 3, Z + 21, 1.4, { burnt: true })
      hut(X + 15, Z - 15, 5, 4, 2.5, 0, 'n')
      place('cable_reel', X + 12, Z - 9.5, 0.3, { seed: S() })
      place('pipe_stack', X - 6, Z - 8, 0.3, { seed: S() })
      place('generator', X + 1, Z - 5.5, 0.2, { seed: S() })
      place('tire_stack', X - 11, Z - 5, 0, { seed: S() })
      place('light_mast', X - 18, Z + 14, 0, { seed: S() })
      place('light_mast', X + 20, Z + 10, 0, { seed: S() })
      place('jersey_barrier', X + 21, Z - 3, ts, { seed: S() })
      place('jersey_barrier', X + 21, Z - 8, ts, { seed: S() })
      api.sandbagRow(X + 6, Z - 15, 0, 3, S())
      api.rockCluster(X + 3, Z - 20, 3, 1.6, S())
      api.rockCluster(X - 24, Z + 12, 4, 1.8, S())
      api.scrub(X + 24, Z + 18, 1.2, S())
    } else if (site.id === 'bunker') {
      // a fortified line: a command bunker, two pillboxes, dragon's teeth to the south
      bunker(X, Z + 6, 9, 6, 2.6)
      pillbox(X - 17, Z - 17)
      pillbox(X + 17, Z - 17)
      for (var tx = -15; tx <= 15; tx += 3) if (Math.abs(tx) > 3) tooth(X + tx, Z - 21.5 + (Math.abs(tx) % 2) * 0.8)
      api.mast(X + 10, Z + 15, 18)
      flag(X + 6, Z + 11, M('paint_red'))
      api.truck(X - 11, Z + 16, 0.2, { canopy: true, paint: 'paint_grey' })
      api.sandbagRow(X - 8, Z - 11, 0, 3, S())
      api.sandbagRow(X + 8, Z - 11, 0, 3, S())
      api.sandbagRow(X - 20, Z, ts, 4, S())
      api.sandbagRow(X + 20, Z, ts, 4, S())
      place('generator', X + 7, Z + 4.5, ts, { seed: S() })
      place('crate_stack', X - 7, Z + 4, 0.2, { seed: S() })
      place('barrel', X + 8.6, Z + 8.4, 0, { seed: S(), color: 'red' })
      place('barrel', X + 9.3, Z + 7.8, 0.4, { seed: S() })
      place('light_mast', X - 18, Z - 9, 0, { seed: S() })
      place('floodlight_stand', X + 10, Z - 14, 2.6, { seed: S() })
      place('jersey_barrier', X - 4, Z - 20, 0.04, { seed: S() })
      place('jersey_barrier', X + 4, Z - 20, -0.05, { seed: S() })
      api.rockCluster(X - 26, Z + 16, 3, 1.4, S())
      api.rockCluster(X + 27, Z - 10, 4, 1.6, S())
    } else if (site.id === 'oasis') {
      // a far camp at a palm oasis: tents, a pond, a water tank, our flag
      pond(X + 1, Z - 11, 3.6, S())
      palm(X - 3.6, Z - 13.4, 7.5, 1.4, S())
      palm(X + 5.4, Z - 14.4, 8.5, 1.8, S())
      palm(X + 6, Z - 8.6, 6.5, 1.2, S())
      palm(X - 3, Z - 7.2, 7, 1.0, S())
      tent(X - 10, Z + 6, 0.1, 6, 4, 2.6)
      tent(X - 11, Z - 4, -0.15, 5, 3.6, 2.4)
      tent(X + 1, Z + 15, ts, 5, 3.6, 2.4)
      p = P(-8, 15); api.fuelTank(p[0], p[1], true, 5, 1.0, 'paint_white', 'WATER')
      flag(X - 4, Z + 2, blue)
      place('generator', X + 7, Z + 13, 0.3, { seed: S() })
      place('crate_stack', X - 6, Z + 11.5, 0.2, { seed: S() })
      place('jerry_can', X + 5.5, Z + 8.5, 0.3, { seed: S() })
      place('jerry_can', X + 6, Z + 9.2, 1.1, { seed: S() })
      place('barrel', X + 8, Z + 2, 0, { seed: S(), color: 'blue' })
      place('pallet_stack', X - 14, Z + 13, 0.2, { seed: S() })
      place('light_mast', X + 16, Z + 15, 0, { seed: S() })
      place('light_mast', X - 16, Z - 12, 0, { seed: S() })
      api.sandbagRow(X + 18, Z + 3, ts, 3, S())
      api.sandbagRow(X - 18, Z + 3, ts, 3, S())
      api.sandbagRow(X, Z + 20, 0, 4, S())
      api.sandbagRow(X - 6, Z - 20, 0, 3, S())
      api.scrub(X - 1, Z - 15.6, 1.2, S())
      api.scrub(X + 4.6, Z - 6.4, 1, S())
      api.scrub(X - 5, Z - 10, 0.9, S())
      api.rockCluster(X + 24, Z - 12, 3, 1.4, S())
      api.rockCluster(X - 23, Z + 18, 3, 1.3, S())
    }
    SXO_GROUPS[SXO_GROUPS.length - 1].nodes = t.staticRoot.children.slice(n0)
  })
}

// Each site's meshes get their own merged group instead of joining the
// map-wide 'level-merged' one (whose bounds span the whole desert, so it is
// drawn — and shadow-cast — every frame from anywhere). Per site, frustum
// culling works and a site past SXO_DRAW m from the camera is not drawn at
// all (the haze has swallowed it by then; the marker still shows). Called by
// SXD_level after the label atlas, before the big merge.
var SXO_GROUPS = []
var SXO_DRAW = 1000
function SXO_split(t, root) {
  var groups = SXO_GROUPS
  SXO_GROUPS = []
  var parts = []
  groups.forEach(function (gr) {
    if (!gr.nodes || !gr.nodes.length) return
    var g = new lt.Group()
    gr.nodes.forEach(function (n) { if (n.parent === t.staticRoot) g.attach(n) })
    var m = By(g)
    m.name = 'outpost-' + gr.site.id
    root.add(m)
    parts.push({ obj: m, x: gr.site.x, z: gr.site.z, r: gr.site.r })
  })
  var cam = t.G.camera
  t.updaters.push(function () {
    var e = cam.matrixWorld.elements, cx = e[12], cz = e[14]
    for (var k = 0; k < parts.length; k++) {
      var q = parts[k], on = Math.hypot(cx - q.x, cz - q.z) - q.r < SXO_DRAW
      if (q.obj.visible !== on) q.obj.visible = on
    }
  })
  return parts
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
      if (introT <= 0) U.radio('Control: Camp Mirage holds the west dunes, Camp Oasis the far south-west. Machines hold Ridge Post, Radar Station, the Fuel Depot and six posts out in the deep desert — take them if you can.', 7)
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
        if (s.hello) U.radio(s.hello, 5)
      }
      // marker (the whole map is 1.5 km: every site shows; far ones dimmed)
      if (!site.el) return
      var show = d > 28 && d < 2200
      var far = d > 650
      if (site.el._f !== far) { site.el._f = far; site.el.classList.toggle('far', far) }
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
