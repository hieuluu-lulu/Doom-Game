// ============================================================================
// DoomZone mod — HOUSES (desert map only)
// Towns, a walled ranch, small groups and lone houses out on the dunes, each
// on a level pad cut into them. Every building is enterable: rooms on every
// floor with window openings, a front (and back) door, a switchback stair
// from the ground floor up (to the roof on a flat roof), a crate and a table
// per floor, a shop on some ground floors.
//   apt     the Crossroads map's apartment block: the same four-storey brick
//           building (its old-apartment model as the facade, its brick)
//   block   plaster buildings of 1-5 storeys in desert colours, flat roofs
//           with a parapet (water tanks, a fire escape on some) or tiled
//           hip / gable roofs (the ranch)
//   SXH_SITES   {id, kind: town|ranch|group, x, z, r, n, name}
//   SXH_pad     the pads (SXD_terrainBase reads it): the dunes' mean height
//   SXH_layout  builds every site at y = 0 (SXD_level), then lifts it onto its
//               pad; the outside is a merged group per site (SXD_GROUPS), the
//               insides another one drawn within SXH_INSIDE m only
//   models      the old-apartment model and its brick download after boot
//               (preload.js ALSO) and swap in; until then plain brick shows
//   colliders   a site's boxes are only in the physics while a player is
//               within SXH_ACTIVE m (the physics tests every box, every ray)
// ============================================================================

var SXH_SITES = [
  { id: 't1', kind: 'town', name: 'Dustwater', x: 230, z: -640, r: 80 },
  { id: 't2', kind: 'town', name: 'Copper Flats', x: 380, z: 760, r: 75 },
  { id: 'v1', kind: 'ranch', name: 'Old Ranch', x: -380, z: 1060, r: 52 },
  { id: 'g3', kind: 'group', x: -560, z: -760, r: 38, n: 3 },
  { id: 'g4', kind: 'group', x: -820, z: 420, r: 32, n: 2 },
  { id: 'g5', kind: 'group', x: 1050, z: -470, r: 38, n: 3 },
  { id: 'g7', kind: 'group', x: 650, z: -300, r: 38, n: 3 },
  // alone (spread out by farthest-point sampling over the free ground)
  { id: 'l1', x: -175, z: -1375 }, { id: 'l2', x: -800, z: -200 }, { id: 'l3', x: -1390, z: -75 }, { id: 'l4', x: 850, z: -1100 },
  { id: 'l5', x: 800, z: 100 }, { id: 'l6', x: 25, z: 1375 }, { id: 'l7', x: 1050, z: 900 }, { id: 'l8', x: -175, z: -700 },
  { id: 'l9', x: 20, z: -1025 }, { id: 'l10', x: -1225, z: -675 }, { id: 'l11', x: -925, z: -1050 }, { id: 'l12', x: 175, z: -1375 },
]
SXH_SITES.forEach(function (s) {
  if (!s.kind) { s.kind = 'group'; s.n = 1; s.r = 13 }
  s.blend = s.r > 20 ? 30 : 20
})
var SXH_ACTIVE = 450 // m: a site's colliders join the physics inside this (a sniper's range)
var SXH_ACTIVE_IN = 160 // m: …and its stairs, floors and furniture inside this
var SXH_INSIDE = 220 // m: the rooms, stairs and furniture are drawn inside this
var SXH_SIGNS = [['CAFE 24', 'paint_red'], ['NOODLE BAR', 'paint_teal'], ['HARDWARE', 'paint_blue'], ['TAILOR', 'paint_blue'], ['MOTEL', 'paint_red'],
  ['PHARMACY', 'paint_green'], ['GARAGE', 'paint_orange'], ['BAKERY', 'paint_red'], ['MARKET', 'paint_teal'], ['RADIO', 'paint_blue'], ['DINER', 'paint_red'], ['BARBER', 'paint_teal']]
// loot on the floors: [kind, weight] (arsenal pickup kinds); about one floor in two has something
var SXH_LOOT_KINDS = [['ammo', 20], ['ammo:556', 10], ['ammo:12g', 6], ['ammo:50ae', 6], ['ammo:338', 3], ['grenade', 9], ['med_s', 10], ['med', 7], ['med_l', 2],
  ['vest1', 4], ['helm1', 4], ['vest2', 3], ['helm2', 3], ['vest3', 1], ['helm3', 1], ['bag1', 3], ['bag2', 2], ['bag3', 0.5], ['shotgun', 2], ['rifle', 2], ['sniper', 1],
  ['att:x4', 1.5], ['att:holo', 1.5], ['att:grip', 1.5], ['att:extmag', 1.5], ['att:supp', 1], ['att:comp', 1], ['att:stock', 1], ['att:x8', 0.5]]
var SXH_LOOT = [] // {kind, pos} for the level's extraPickups (arsenal/arsenal.js)
// plaster colours of the desert buildings: sand, tan, cream, terracotta, dusty pink, grey
var SXH_TINTS = [0xd9c19a, 0xc79c74, 0xe6dccb, 0xb9775a, 0xcf9f8c, 0xaaa49a, 0xd8b483]

// ---------------------------------------------------------------- the pads
// A pad is level at a bit under the mean height of the dunes it sits in (more
// cut than fill), blended back into them over `blend` m.
var SXH_BUSY = false
function SXH_y(s) {
  if (s.y0 != null) return s.y0
  SXH_BUSY = true
  var sum = 0, n = 0
  try {
    for (var k = 0; k < 24; k++) {
      var a = (k / 24) * Math.PI * 2
      for (var f of [0.35, 0.7, 1.0, 1.3]) { sum += SXD_terrainBase(s.x + Math.cos(a) * s.r * f, s.z + Math.sin(a) * s.r * f); n++ }
    }
    sum += SXD_terrainBase(s.x, s.z) * 4; n += 4
  } finally { SXH_BUSY = false }
  s.y0 = Math.max(0.3, (sum / n) * 0.85)
  return s.y0
}
function SXH_pad(x, z, h) {
  if (SXH_BUSY) return h
  for (var k = 0; k < SXH_SITES.length; k++) {
    var s = SXH_SITES[k], dx = x - s.x, dz = z - s.z, R = s.r + s.blend
    if (dx >= R || dx <= -R || dz >= R || dz <= -R) continue
    var d = Math.hypot(dx, dz)
    if (d >= R) continue
    h += (SXH_y(s) - h) * (1 - SXD_smooth(s.r, s.r + s.blend, d))
  }
  return h
}

// ------------------------------------------------- the building (Crossroads)
// The old-apartment model's wall extents (model units) and its storey and
// opening grid — the same numbers as crossroads/crossroads.js (OAP).
var SXH_OAP = { x0: -327, x1: 274, z0: -132, z1: 108, h: 441, roof: 445,
  floors: [0, 110, 220, 330], cols: [[-280, -250], [-160, -130], [-40, -10], [80, 110], [200, 230]], side: [[-85, -55], [35, 65]], door: [-87, 34, 0, 93] }
var SXH_STEP = 3.25 / 11 // the stair rise of the Crossroads map (under the 0.42 m step-up)
var SXH_WIN = { w: 1.3, h: 1.4, sill: 1.0 }
var SXH_YAW = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

// a rectangle minus holes as few rectangles as possible: [w0, w1, y0, y1]
// (the Crossroads map's rectsR)
function SXH_rects(w0, w1, y0, y1, holes) {
  var xs = [w0, w1], ys = [y0, y1]
  holes.forEach(function (h) { xs.push(Math.max(w0, Math.min(w1, h[0])), Math.max(w0, Math.min(w1, h[1]))); ys.push(Math.max(y0, Math.min(y1, h[2])), Math.max(y0, Math.min(y1, h[3]))) })
  var uniq = function (A) { return A.sort(function (a, b) { return a - b }).filter(function (v, k, B) { return k === 0 || v - B[k - 1] > 1e-4 }) }
  xs = uniq(xs); ys = uniq(ys)
  var out = [], open = {}
  for (var i = 0; i + 1 < xs.length; i++) {
    var runs = [], r0 = null
    for (var j = 0; j + 1 < ys.length; j++) {
      var cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2
      var solid = !holes.some(function (h) { return cx > h[0] && cx < h[1] && cy > h[2] && cy < h[3] })
      if (solid && r0 === null) r0 = ys[j]
      if (!solid && r0 !== null) { runs.push([r0, ys[j]]); r0 = null }
    }
    if (r0 !== null) runs.push([r0, ys[ys.length - 1]])
    var next = {}
    runs.forEach(function (r) {
      var k = r[0].toFixed(4) + ',' + r[1].toFixed(4)
      if (open[k]) { open[k][1] = xs[i + 1]; next[k] = open[k] } else { var q = [xs[i], xs[i + 1], r[0], r[1]]; out.push(q); next[k] = q }
    })
    open = next
  }
  return out
}
// triangles → a bucket {pos, nrm, uv}, each wound to face away from `out` (a point inside)
function SXH_tris(bk, tris, out) {
  tris.forEach(function (tr) {
    var a = tr[0], b = tr[1], c = tr[2]
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    var mx = (a[0] + b[0] + c[0]) / 3 - out[0], my = (a[1] + b[1] + c[1]) / 3 - out[1], mz = (a[2] + b[2] + c[2]) / 3 - out[2]
    if (nx * mx + ny * my + nz * mz < 0) { var tmp = b; b = c; c = tmp; nx = -nx; ny = -ny; nz = -nz }
    var L = Math.hypot(nx, ny, nz) || 1
    ;[a, b, c].forEach(function (p) { bk.pos.push(p[0], p[1], p[2]); bk.nrm.push(nx / L, ny / L, nz / L); bk.uv.push(p[0] / 2, p[2] / 2) })
  })
}

var SXH_ST = { built: [], facadeM: null, models: false }

// ---------------------------------------------------------------- layout
function SXH_layout(api) {
  var t = api.t, place = api.place, M = api.M, G = t.G, ts = Math.PI / 2
  var K = typeof SXO_kit === 'function' ? SXO_kit(api) : null
  var OAP = SXH_OAP, STEP = SXH_STEP, WIN = SXH_WIN
  var intWall = M('concrete_painted'), intFloor = M('concrete'), stepM = M('concrete_dirty'), skirt = M('wood_dark'), roofTop = M('concrete_dirty')
  var sillM = M('concrete'), frameM = M('steel_dark'), conc = M('concrete'), wood = M('wood_dark'), worn = M('steel_worn'), dirty = M('concrete_dirty')
  var rust = M('steel_rust'), galv = M('steel_galv'), steel = M('steel_dark'), asph = M('asphalt')
  var glow = G.mats.emissive ? G.mats.emissive(0xffcf8f, 2.6) : M('paint_yellow')
  var tileM = M('brick', { triplanar: true, scale: 1, color: 0xc0704e })
  var mk = function (c, rough, nm, o) { var m = new lt.MeshStandardMaterial(Object.assign({ color: c, roughness: rough, metalness: 0 }, o || {})); m.name = nm; return m }
  var darkM = mk(0x24211e, 1, 'sxh_far_inside')
  var leafM = mk(0x56603a, 0.9, 'sxh_leaf', { flatShading: true }), barkM = mk(0x6f6252, 0.95, 'sxh_bark')
  var spikeM = mk(0x66773f, 0.85, 'sxh_spike', { side: lt.DoubleSide }), deadM = mk(0x7a6648, 0.95, 'sxh_dead', { side: lt.DoubleSide })
  var shrubM = mk(0x7d8858, 0.9, 'sxh_shrub', { side: lt.DoubleSide })
  var SHUT = ['paint_teal', 'paint_green', 'paint_blue', 'wood_dark', 'paint_red'].map(function (n) { return M(n) })
  var cropM = mk(0x6c7a36, 0.9, 'sxh_crop'), strawM = mk(0xb59a5c, 0.95, 'sxh_straw')
  // the outside brick: plain until the model's brick texture lands (SXH_models)
  var facadeM = mk(0x8a5446, 0.92, 'sxh_brick')
  // stucco: an even colour with a faint mottle and rain streaks down the walls
  // (world-space noise, so it needs no UVs and suits the merged skins)
  var tintM = {}
  var plaster = function (c) {
    if (tintM[c]) return tintM[c]
    var m = mk(c, 0.93, 'sxh_stucco')
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = 'varying vec3 vSxhW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSxhW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      sh.fragmentShader = 'varying vec3 vSxhW;\nfloat sxhH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat sxhN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sxhH(i), sxhH(i + vec2(1.0, 0.0)), f.x), mix(sxhH(i + vec2(0.0, 1.0)), sxhH(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
        sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  { float a = vSxhW.x + vSxhW.z; float mot = sxhN(vec2(a, vSxhW.y) * 1.3) * 0.6 + sxhN(vec2(a, vSxhW.y) * 4.1) * 0.4;\n    float streak = sxhN(vec2(a * 2.3, vSxhW.y * 0.18)) * sxhN(vec2(a * 7.0, 3.1));\n    diffuseColor.rgb *= 0.93 + 0.1 * mot - 0.16 * smoothstep(0.45, 0.85, streak); }')
    }
    m.customProgramCacheKey = function () { return 'sxh-stucco-1' }
    tintM[c] = m
    return m
  }
  SXH_ST = { built: [], facadeM: facadeM, models: false, trees: [] }
  SXH_LOOT.length = 0
  var lootW = SXH_LOOT_KINDS.reduce(function (a, k) { return a + k[1] }, 0)
  var lootKind = function (r) { var x = r() * lootW; for (var i = 0; i < SXH_LOOT_KINDS.length; i++) { x -= SXH_LOOT_KINDS[i][1]; if (x <= 0) return SXH_LOOT_KINDS[i][0] } return 'ammo' }
  var seed = 900
  var S = function () { return ++seed }

  // ---- one building. u: {cx, cz, W (along the front), D, front, yaw, kind,
  // F, h (apt), tint, shop, roof flat|hip|gable, tanks, escape, porch, doorW,
  // back, sh (storey height, no stairs only)}; ctx: {bucket(mat), inner, far}
  function house(u, ui, ctx) {
    var model = u.kind === 'apt', F = model ? 4 : u.F, T = 0.2, e = 0.02, W = u.W, D = u.D
    var flat = !u.roof || u.roof === 'flat'
    var cy = Math.cos(u.yaw), sy = Math.sin(u.yaw)
    var L2W = function (x, z) { return [u.cx + x * cy + z * sy, u.cz - x * sy + z * cy] }
    var L2Wd = function (x, z) { return [x * cy + z * sy, -x * sy + z * cy] }
    var L3 = function (x, y, z) { var p = L2W(x, z); return [p[0], y, p[1]] }
    // local box → world slab (+ collider); yaws are quarter turns: axis-aligned.
    // into: a group (the site's insides, its far stand-ins) instead of the outside
    var lbox = function (mat, x0, y0, z0, x1, y1, z1, col, into, wall) {
      var p = L2W(x0, z0), q = L2W(x1, z1)
      var X0 = Math.min(p[0], q[0]), X1 = Math.max(p[0], q[0]), Z0 = Math.min(p[1], q[1]), Z1 = Math.max(p[1], q[1])
      if (mat) t.slab(mat, X0, y0, Z0, X1, y1, Z1, into ? { parent: into } : undefined)
      if (col) { var bx = t.col(X0, y0, Z0, X1, y1, Z1, col === true ? 'concrete' : col); if (into === inner && !wall && bx) bx.sxhIn = 1 }
    }
    // a prop inside: into the insides group, its colliders tagged as inside ones
    var inner = ctx.inner, BX = G.physics.boxes
    var inside = function (kind, x, z, yaw, opts, y) {
      var n0 = BX.length, o = place(kind, x, z, yaw, opts, y)
      for (var k = n0; k < BX.length; k++) BX[k].sxhIn = 1
      if (o) inner.attach(o)
      return o
    }
    var mx = function (x) { return ((x - OAP.x0) / (OAP.x1 - OAP.x0) - 0.5) * W }
    var mz = function (z) { return ((z - OAP.z0) / (OAP.z1 - OAP.z0) - 0.5) * D }
    var my = function (y) { return (y / OAP.h) * u.h }
    var sh = u.sh || 11 * STEP, lv = []
    if (model) lv = OAP.floors.map(my).concat([my(OAP.roof)]).map(function (y) { return Math.round(y / STEP) * STEP })
    else for (var k0 = 0; k0 <= F; k0++) lv.push(k0 * sh)
    var h = model ? u.h : lv[F] // wall top
    var ix0 = -W / 2 + T + e, ix1 = W / 2 - T - e, iz0 = -D / 2 + T + e, iz1 = D / 2 - T - e
    // faces: front (+z, the door), back, left (-x), right (+x)
    var faces = [
      { n: [0, 1], at: D / 2, lo: -W / 2, hi: W / 2, x: true, holes: [], doors: [] },
      { n: [0, -1], at: -D / 2, lo: -W / 2, hi: W / 2, x: true, holes: [], doors: [] },
      { n: [-1, 0], at: -W / 2, lo: iz0 - e, hi: iz1 + e, x: false, holes: [], doors: [] },
      { n: [1, 0], at: W / 2, lo: iz0 - e, hi: iz1 + e, x: false, holes: [], doors: [] },
    ]
    var colsX, wX, colsZ, wZ, dx0, dx1, doorH
    if (model) {
      // on the model's window columns
      var big = W >= 9
      colsX = (big ? OAP.cols : [OAP.cols[1], OAP.cols[3]]).map(function (c) { return mx((c[0] + c[1]) / 2) })
      wX = Math.min(WIN.w, (W * (big ? 120 : 240)) / 601 - 0.7)
      colsZ = OAP.side.map(function (c) { return mz((c[0] + c[1]) / 2) })
      wZ = Math.min(WIN.w, colsZ[1] - colsZ[0] - 0.6)
      dx0 = mx(OAP.door[0]); dx1 = mx(OAP.door[1]); doorH = my(OAP.door[3])
    } else {
      // evenly, about every 3.1 m
      var cols = function (lo, hi) { var L = hi - lo, n = Math.max(1, Math.floor((L - 0.8) / 3.1)), out = []; for (var i = 0; i < n; i++) out.push(lo + ((i + 0.5) * L) / n); return out }
      colsX = cols(-W / 2, W / 2); wX = Math.min(WIN.w, W / colsX.length - 1.2)
      colsZ = cols(iz0, iz1); wZ = Math.min(WIN.w, (iz1 - iz0) / colsZ.length - 1.2)
      var dw = (u.doorW || 1.6) / 2
      dx0 = -dw; dx1 = dw; doorH = Math.min(u.doorW > 3 ? 3.1 : 2.4, lv[1] - 0.45)
    }
    // the back door clear of the stairs (they run along the back wall from the left)
    var nF = flat ? F : F - 1, bx0 = dx0, bx1 = dx1
    if (!model && nF > 0) {
      var stairEnd = ix0 + 0.8 + 11 * 0.34 + 0.4
      if (bx0 < stairEnd) { bx1 = stairEnd + (dx1 - dx0); bx0 = stairEnd }
      if (bx1 > ix1 - 0.4) u.back = false
    }
    var addWin = function (f, c, w, k) {
      var a0 = c - w / 2, a1 = c + w / 2, y0 = lv[k] + WIN.sill, y1 = y0 + WIN.h
      if (w < 0.6 || a0 < f.lo + 0.3 || a1 > f.hi - 0.3) return
      if (k === 0 && f === faces[0] && a1 > dx0 - 0.3 && a0 < dx1 + 0.3) return
      if (k === 0 && f === faces[1] && u.back !== false && a1 > bx0 - 0.3 && a0 < bx1 + 0.3) return
      if (!flat && k === F - 1 && y1 > h - 0.25) return
      f.holes.push([a0, a1, y0, y1])
    }
    for (var k1 = 0; k1 < F; k1++) {
      colsX.forEach(function (c) { addWin(faces[0], c, wX, k1); addWin(faces[1], c, wX, k1) })
      colsZ.forEach(function (c) { addWin(faces[2], c, wZ, k1); addWin(faces[3], c, wZ, k1) })
    }
    faces[0].doors.push([dx0, dx1, 0, doorH]); faces[0].holes.push(faces[0].doors[0])
    if (u.back !== false) { faces[1].doors.push([bx0, bx1, 0, doorH]); faces[1].holes.push(faces[1].doors[0]) }
    // frames, sills, lintels
    // into: a group (fine detail: ctx.inner, drawn near only)
    var trim = function (f, mat, a0, a1, y0, y1, d0, d1, into) {
      if (f.x) lbox(mat, a0, y0, f.at + f.n[1] * d0, a1, y1, f.at + f.n[1] * d1, false, into)
      else lbox(mat, f.at + f.n[0] * d0, y0, a0, f.at + f.n[0] * d1, y1, a1, false, into)
    }
    var shut = !model && ctx.r() < 0.45 ? SHUT[(ctx.r() * SHUT.length) | 0] : null
    faces.forEach(function (f, fi) {
      f.holes.forEach(function (o) {
        var door = f.doors.indexOf(o) >= 0
        if (!door) trim(f, sillM, o[0] - 0.1, o[1] + 0.1, o[2] - 0.09, o[2], -0.02, 0.09)
        trim(f, sillM, o[0] - 0.1, o[1] + 0.1, o[3], o[3] + 0.16, -0.02, 0.05)
        trim(f, frameM, o[0] - 0.06, o[0], o[2], o[3], -0.02, 0.04)
        trim(f, frameM, o[1], o[1] + 0.06, o[2], o[3], -0.02, 0.04)
        if (door) {
          // a step at the door, the leaf standing open inside
          if (f === faces[0] || f === faces[1]) { trim(f, sillM, o[0] - 0.3, o[1] + 0.3, 0, 0.14, 0, 0.6); var st = f.x ? [o[0] - 0.3, f.at, o[1] + 0.3, f.at + f.n[1] * 0.6] : null; if (st) lbox(null, st[0], 0, Math.min(st[1], st[3]), st[2], 0.14, Math.max(st[1], st[3]), true) }
          if (!u.shop || f !== faces[0]) lbox(wood, o[1] - 0.05, 0.02, f.at - f.n[1] * 0.25, o[1], o[3] - 0.04, f.at - f.n[1] * (0.25 + (o[1] - o[0]) * 0.92), false, inner)
          return
        }
        // the frame round the glass (mid-wall), a mullion and a transom
        var mid = (o[0] + o[1]) / 2, ty = o[2] + (o[3] - o[2]) * 0.62
        trim(f, frameM, o[0], o[1], o[2], o[2] + 0.05, -0.15, -0.09, inner)
        trim(f, frameM, o[0], o[1], o[3] - 0.05, o[3], -0.15, -0.09, inner)
        trim(f, frameM, mid - 0.025, mid + 0.025, o[2], o[3], -0.15, -0.09, inner)
        trim(f, frameM, o[0], o[1], ty - 0.025, ty + 0.025, -0.15, -0.09, inner)
        // shutters folded back beside the window (plaster houses, some of them)
        var lw = (o[1] - o[0]) / 2
        if (shut && o[0] - lw - 0.08 > f.lo + 0.15 && o[1] + lw + 0.08 < f.hi - 0.15) {
          trim(f, shut, o[0] - lw - 0.07, o[0] - 0.07, o[2] - 0.02, o[3] + 0.02, 0.01, 0.05)
          trim(f, shut, o[1] + 0.07, o[1] + lw + 0.07, o[2] - 0.02, o[3] + 0.02, 0.01, 0.05)
          for (var sl = o[2] + 0.18; sl < o[3] - 0.1; sl += 0.22) { trim(f, frameM, o[0] - lw - 0.05, o[0] - 0.09, sl, sl + 0.03, 0.05, 0.06, inner); trim(f, frameM, o[1] + 0.09, o[1] + lw + 0.05, sl, sl + 0.03, 0.05, 0.06, inner) }
        }
        // an air-conditioner under some side windows upstairs
        if (fi >= 2 && o[2] > 3 && ctx.r() < 0.3) {
          trim(f, galv, mid - 0.42, mid + 0.42, o[2] - 0.72, o[2] - 0.22, 0, 0.45)
          trim(f, frameM, mid - 0.36, mid + 0.36, o[2] - 0.66, o[2] - 0.28, 0.45, 0.46, inner)
        }
      })
    })
    // the outside skin over each wall minus its openings (into the site's buckets)
    var skinM = model ? facadeM : plaster(u.tint), bk = ctx.bucket(skinM)
    faces.forEach(function (f) {
      var lo = f.x ? -W / 2 : -D / 2, hi = -lo
      var n = L2Wd(f.n[0], f.n[1]), alongX = Math.abs(n[1]) > 0.5, off = 0.004
      var P = function (a, y) { var w = f.x ? L2W(a, f.at) : L2W(f.at, a); return [w[0] + n[0] * off, y, w[1] + n[1] * off] }
      SXH_rects(lo, hi, 0, h, f.holes).forEach(function (r) {
        var A = P(r[0], r[2]), B = P(r[1], r[2]), C = P(r[1], r[3]), Dd = P(r[0], r[3])
        var e1 = [B[0] - A[0], B[2] - A[2]], cz = e1[0] * n[1] - e1[1] * n[0]
        var quad = cz > 0 ? [A, B, C, A, C, Dd] : [A, Dd, C, A, C, B]
        quad.forEach(function (q) {
          bk.pos.push(q[0], q[1], q[2]); bk.nrm.push(n[0], 0, n[1])
          bk.uv.push((alongX ? q[0] : q[2]) / 1.5, q[1] / 12.3)
        })
      })
    })
    // walls: 2 cm inside the skin, 20 cm thick, same openings
    faces.forEach(function (f) {
      SXH_rects(f.lo, f.hi, 0, h, f.holes).forEach(function (r) {
        if (f.x) lbox(intWall, r[0], r[2], f.at - f.n[1] * (T + e), r[1], r[3], f.at - f.n[1] * e, true, inner, true)
        else lbox(intWall, f.at - f.n[0] * (T + e), r[2], r[0], f.at - f.n[0] * e, r[3], r[1], true, inner, true)
      })
    })
    // stairs: two 1 m lanes along the back wall; flight f (level f → f+1, onto
    // the roof on a flat roof) runs in lane f%2, odd flights rising -x to a
    // landing at the end wall, even ones rising +x (the Crossroads switchback)
    var LW = Math.min(1.0, (iz1 - iz0 - 1.4) / 2), run = 0.34, LAND = 0.8, flights = []
    for (var f = 0; f < nF; f++) {
      var rise = lv[f + 1] - lv[f], n = Math.round(rise / STEP), Lf = n * run
      var z0 = iz0 + (f % 2) * LW, z1 = z0 + LW, xs = f % 2 === 0 ? ix0 + LAND : ix0
      for (var j = 0; j < n; j++) {
        var top = lv[f] + ((j + 1) * rise) / n
        var xa = f % 2 === 0 ? xs + j * run : xs + Lf - (j + 1) * run
        lbox(stepM, xa, lv[f] - 0.01, z0, xa + run, top, z1, true, inner)
      }
      flights.push([xs, xs + Lf, z0, z1])
    }
    // floors 1..F, each open over the flight that arrives there; on a flat
    // roof the top one is the roof (outside), else the top floor's ceiling
    lbox(intFloor, ix0, 0, iz0, ix1, 0.02, iz1, false, inner)
    for (var L = 1; L <= F; L++) {
      var fl = flights[L - 1], y = lv[L], isRoof = flat && L === F
      SXH_rects(ix0, ix1, iz0, iz1, fl ? [[fl[0], fl[1], fl[2], fl[3]]] : []).forEach(function (r) {
        lbox(isRoof ? roofTop : intFloor, r[0], y - T, r[2], r[1], y, r[3], true, isRoof ? null : inner)
      })
      if (!isRoof) lbox(glow, W / 4 - 0.35, y - T - 0.04, -0.25, W / 4 + 0.35, y - T, 0.25, false, inner) // lamp, ceiling below
    }
    for (var Sk = 0; Sk < F; Sk++) lbox(skirt, ix0, lv[Sk], iz1 - 0.03, ix1, lv[Sk] + 0.1, iz1, false, inner)
    // seen from afar (insides not drawn): a dark block just inside the walls
    lbox(darkM, ix0 - 0.02, 0.05, iz0 - 0.02, ix1 + 0.02, lv[F] - T - 0.02, iz1 + 0.02, false, ctx.far)
    // ---- the outside
    if (!model) {
      // plinth, storey bands
      var ring = function (mat, y0, y1, o) {
        lbox(mat, -W / 2 - o, y0, -D / 2 - o, W / 2 + o, y1, -D / 2 + 0.01, false)
        lbox(mat, -W / 2 - o, y0, D / 2 - 0.01, W / 2 + o, y1, D / 2 + o, false)
        lbox(mat, -W / 2 - o, y0, -D / 2, -W / 2 + 0.01, y1, D / 2, false)
        lbox(mat, W / 2 - 0.01, y0, -D / 2, W / 2 + o, y1, D / 2, false)
      }
      var holesAt = function (y0, y1) { return faces.some(function (f) { return f.holes.some(function (o) { return o[2] < y1 && o[3] > y0 }) }) }
      faces.forEach(function (f) {
        var lo = f.x ? -W / 2 - 0.05 : -D / 2, hi = -lo
        SXH_rects(lo, hi, 0, 0.55, f.doors).forEach(function (rr) { trim(f, dirty, rr[0], rr[1], 0, 0.55, 0, 0.05) })
        // pilasters at the corners
        ;[[lo, lo + 0.45], [hi - 0.45, hi]].forEach(function (c) { trim(f, sillM, c[0], c[1], 0.55, h - 0.3, 0, 0.035) })
      })
      for (var bL = 1; bL < F; bL++) if (!holesAt(lv[bL] - 0.12, lv[bL] + 0.06)) ring(sillM, lv[bL] - 0.12, lv[bL] + 0.06, 0.05)
      if (flat) ring(sillM, h - 0.3, h + 0.05, 0.14) // cornice
    }
    if (flat) {
      // parapet (the model's own roof edge is only ankle-high)
      var R = lv[F], PP = 0.25, PH = 1.0, pm = model ? conc : plaster(u.tint)
      lbox(pm, -W / 2, R, -D / 2, W / 2, R + PH, -D / 2 + PP, true)
      lbox(pm, -W / 2, R, D / 2 - PP, W / 2, R + PH, D / 2, true)
      lbox(pm, -W / 2, R, -D / 2 + PP, -W / 2 + PP, R + PH, D / 2 - PP, true)
      lbox(pm, W / 2 - PP, R, -D / 2 + PP, W / 2, R + PH, D / 2 - PP, true)
      lbox(sillM, -W / 2 - 0.04, R + PH, -D / 2 - 0.04, W / 2 + 0.04, R + PH + 0.06, -D / 2 + PP + 0.04, false)
      lbox(sillM, -W / 2 - 0.04, R + PH, D / 2 - PP - 0.04, W / 2 + 0.04, R + PH + 0.06, D / 2 + 0.04, false)
      // water tanks on a steel stand, AC boxes (clear of the stair hole at the back left)
      for (var tk = 0; tk < (u.tanks || 0); tk++) {
        var tx = W / 2 - 2.0 - tk * 2.6, tz = D / 2 - 2.0
        if (tx - 1.2 < ix0 + LAND + 4.2 && tz - 1.2 < iz0 + 2 * LW) continue
        for (var lg = 0; lg < 4; lg++) { var q = L3(tx + (lg & 1 ? 0.75 : -0.75), R, tz + (lg & 2 ? 0.75 : -0.75)); t.rod(steel, q, [q[0], R + 1.2, q[2]], 0.05, { seg: 5 }) }
        lbox(steel, tx - 0.9, R + 1.1, tz - 0.9, tx + 0.9, R + 1.22, tz + 0.9, false)
        var c3 = L2W(tx, tz), tm = tk % 2 ? galv : rust
        t.cyl(tm, 1.0, 1.7, c3[0], R + 2.07, c3[1], { seg: 16 })
        t.cyl(tm, 1.02, 0.35, c3[0], R + 3.1, c3[1], { seg: 16, rTop: 0.25 })
        for (var hb = 0; hb < 3; hb++) t.cyl(steel, 1.03, 0.05, c3[0], R + 1.45 + hb * 0.55, c3[1], { seg: 16 })
        lbox(null, tx - 1.0, R + 1.2, tz - 1.0, tx + 1.0, R + 3.2, tz + 1.0, 'metal')
      }
      if (!model && W >= 8) { lbox(galv, -W / 2 + 1.0, R, D / 2 - 1.6, -W / 2 + 1.9, R + 0.7, D / 2 - 0.9, 'metal'); lbox(galv, -W / 2 + 2.2, R, D / 2 - 1.6, -W / 2 + 3.1, R + 0.7, D / 2 - 0.9, 'metal') }
      // a TV antenna and a satellite dish on some roofs
      if (ctx.r() < 0.6) {
        var an = L3(-W / 2 + 1.2, R, D / 2 - 3.0)
        t.rod(steel, an, [an[0], R + 3.2, an[2]], 0.025, { seg: 4 })
        for (var ab = 0; ab < 3; ab++) { var aa = L3(-W / 2 + 1.2 - 0.5 + ab * 0.06, R + 2.4 + ab * 0.3, D / 2 - 3.0), ab2 = L3(-W / 2 + 1.2 + 0.5 - ab * 0.06, R + 2.4 + ab * 0.3, D / 2 - 3.0); t.rod(steel, aa, ab2, 0.012, { seg: 3 }) }
      }
      if (ctx.r() < 0.5) {
        var dp = L3(-W / 2 + 0.9, R + PH - 0.2, -D / 2 + 1.6), dg = new lt.SphereGeometry(0.42, 14, 6, 0, Math.PI * 2, 0, 0.9)
        dg.rotateX(-1.2); dg.rotateY(u.yaw + ctx.r() * 2)
        t.add(dg, M('paint_white'), { p: dp })
        t.rod(steel, [dp[0], R, dp[2]], dp, 0.03, { seg: 4 })
      }
    } else {
      // tiled roof over the walls, a little overhang; gable ends in plaster
      var o = 0.45, Hr = Math.min(W, D) * 0.28
      var a = L2W(-W / 2 - o, -D / 2 - o), b = L2W(W / 2 + o, D / 2 + o)
      var X0 = Math.min(a[0], b[0]), X1 = Math.max(a[0], b[0]), Z0 = Math.min(a[1], b[1]), Z1 = Math.max(a[1], b[1])
      SXH_roof(ctx.bucket(tileM), ctx.bucket(plaster(u.tint)), X0, Z0, X1, Z1, h, Hr, u.roof, o)
      t.col(X0 + o, h, Z0 + o, X1 - o, h + Hr * 0.55, Z1 - o, 'concrete')
    }
    // balconies on the front (plaster houses of 3+ storeys, some): a slab and
    // a railing under every other upper window, reachable through the window
    if (!model && F >= 3 && ctx.r() < 0.55) {
      var bal = steel
      for (var bk = 1; bk < F; bk++) faces[0].holes.forEach(function (o, oi) {
        if (oi % 2 || Math.abs(o[2] - (lv[bk] + WIN.sill)) > 0.01) return
        var c0 = (o[0] + o[1]) / 2 - 1.0, c1 = (o[0] + o[1]) / 2 + 1.0, by = lv[bk]
        if (c0 < -W / 2 + 0.3 || c1 > W / 2 - 0.3) return
        lbox(sillM, c0, by - 0.16, D / 2, c1, by, D / 2 + 1.1, true)
        lbox(null, c0, by, D / 2 + 1.04, c1, by + 1.0, D / 2 + 1.1, true)
        lbox(null, c0, by, D / 2, c0 + 0.06, by + 1.0, D / 2 + 1.1, true)
        lbox(null, c1 - 0.06, by, D / 2, c1, by + 1.0, D / 2 + 1.1, true)
        lbox(bal, c0, by + 0.96, D / 2 + 1.04, c1, by + 1.0, D / 2 + 1.1, false)
        lbox(bal, c0, by + 0.96, D / 2, c0 + 0.05, by + 1.0, D / 2 + 1.1, false)
        lbox(bal, c1 - 0.05, by + 0.96, D / 2, c1, by + 1.0, D / 2 + 1.1, false)
        for (var px2 = c0 + 0.05; px2 <= c1 - 0.04; px2 += 0.16) lbox(bal, px2, by, D / 2 + 1.06, px2 + 0.025, by + 0.96, D / 2 + 1.085, false, inner)
      })
    }
    // fire escape on the right side: landings at every upper floor, steep
    // flights between them, a drop ladder (no climbing: it is the look)
    if (u.escape && F >= 3) {
      var ex = W / 2, rail = rust
      for (var lk = 1; lk < F; lk++) {
        var ly = lv[lk]
        lbox(rail, ex, ly - 0.08, -1.7, ex + 1.05, ly, 1.7, true)
        ;[[ex + 1.02, -1.7, ex + 1.02, 1.7], [ex, -1.7, ex + 1.02, -1.7], [ex, 1.7, ex + 1.02, 1.7]].forEach(function (rl) { t.rod(rail, L3(rl[0], ly + 1.0, rl[1]), L3(rl[2], ly + 1.0, rl[3]), 0.025, { seg: 4 }) })
        for (var pz = -1.7; pz <= 1.71; pz += 0.85) t.rod(rail, L3(ex + 1.02, ly, pz), L3(ex + 1.02, ly + 1.0, pz), 0.018, { seg: 4 })
        if (lk + 1 < F) {
          var s0 = lk % 2 ? -1.45 : 1.45, s1 = -s0, ny = lv[lk + 1]
          ;[ex + 0.2, ex + 0.82].forEach(function (sx) { t.rod(rail, L3(sx, ly, s0), L3(sx, ny, s1), 0.035, { seg: 4 }) })
          for (var st = 1; st < 10; st++) { var fz = s0 + ((s1 - s0) * st) / 10, fy = ly + ((ny - ly) * st) / 10; lbox(rail, ex + 0.2, fy - 0.03, fz - 0.12, ex + 0.82, fy, fz + 0.12, false) }
        }
      }
      ;[ex + 0.35, ex + 0.75].forEach(function (sx) { t.rod(rail, L3(sx, lv[1], 1.3), L3(sx, 1.2, 1.3), 0.025, { seg: 4 }) })
      for (var rg = 1.5; rg < lv[1]; rg += 0.35) t.rod(rail, L3(ex + 0.35, rg, 1.3), L3(ex + 0.75, rg, 1.3), 0.015, { seg: 3 })
    }
    // a colonnade along the front (the ranch house)
    if (u.porch) {
      var pd = 2.6, pyT = Math.min(3.0, lv[1] - 0.15), white = plaster(0xeee7d8)
      for (var px = -W / 2 + 1.0; px <= W / 2 - 0.9; px += (W - 2) / Math.max(1, Math.round((W - 2) / 3.2))) {
        var pc = L2W(px, D / 2 + pd - 0.35)
        t.cyl(white, 0.2, pyT, pc[0], pyT / 2, pc[1], { seg: 12 })
        t.cyl(sillM, 0.3, 0.18, pc[0], 0.09, pc[1], { seg: 12 })
        t.col(pc[0] - 0.2, 0, pc[1] - 0.2, pc[0] + 0.2, pyT, pc[1] + 0.2, 'concrete')
      }
      lbox(white, -W / 2 + 0.6, pyT, D / 2, W / 2 - 0.6, pyT + 0.22, D / 2 + pd, true)
      lbox(tileM, -W / 2 + 0.5, pyT + 0.22, D / 2, W / 2 - 0.5, pyT + 0.34, D / 2 + pd + 0.1, false)
      lbox(dirty, -W / 2 + 0.4, 0, D / 2, W / 2 - 0.4, 0.12, D / 2 + pd + 0.05, false)
    }
    // cover: a crate in the front-right corner of every floor, a low table
    // in from a front window (shops: a counter, a shelf and boxes downstairs)
    for (var kc = 0; kc < F; kc++) {
      if (kc === 0 && u.shop) continue
      var cp = L2W(ix1 - 0.6, iz1 - 0.6)
      inside('crate_wood', cp[0], cp[1], u.yaw, { seed: S() }, lv[kc])
    }
    if (D >= 6) for (var tb = 0; tb < F; tb++) {
      if (tb === 0 && u.shop) continue
      var ys = lv[tb] + WIN.sill, best = null
      faces[0].holes.forEach(function (oo) {
        var c = (oo[0] + oo[1]) / 2
        if (Math.abs(oo[2] - ys) > 0.01 || Math.abs(c - (ix1 - 0.6)) < 1.5 || (tb === 0 && Math.abs(c) < 2.2) || c - 0.6 < ix0 + 0.1) return
        if (best === null || Math.abs(c - W / 4) < Math.abs(best - W / 4)) best = c
      })
      if (best !== null) lbox(wood, best - 0.6, lv[tb], iz1 - 1.62, best + 0.6, lv[tb] + 0.8, iz1 - 1.08, 'wood', inner)
    }
    if (u.shop) {
      lbox(wood, ix1 - 2.0, 0, -0.9, ix1 - 1.2, 1.05, Math.min(1.1, iz1 - 1.0), 'wood', inner)
      lbox(worn, ix1 - 2.05, 1.05, -0.95, ix1 - 1.15, 1.09, Math.min(1.15, iz1 - 0.95), false, inner)
      var s0b = Math.max(iz0 + 2.2, -D / 2 + 1.8), s1b = Math.min(iz1 - 1.6, D / 2 - 1.4)
      if (s1b - s0b > 0.8) {
        lbox(wood, ix1 - 0.45, 0, s0b, ix1, 2.0, s1b, 'wood', inner)
        for (var shv = 0.45; shv < 2.0; shv += 0.5) lbox(M('cardboard'), ix1 - 0.42, shv, s0b + 0.1, ix1 - 0.05, shv + 0.26, s1b - 0.1, false, inner)
      }
      var cb = L2W(ix1 - 0.8, iz0 + 0.8)
      inside('cardboard_boxes', cb[0], cb[1], u.yaw, { seed: S() }, 0)
      // the sign over the door (the Crossroads map's unitSign)
      var sg = SXH_SIGNS[ui % SXH_SIGNS.length], syY = model ? (u.h * 112) / OAP.h + 0.05 : doorH + 0.22
      var sa = L2W(-1.9, D / 2 + 0.06), sb = L2W(1.9, D / 2 + 0.16), nn = L2Wd(0, 1)
      t.slab(M(sg[1]), Math.min(sa[0], sb[0]), syY, Math.min(sa[1], sb[1]), Math.max(sa[0], sb[0]), syY + 0.55, Math.max(sa[1], sb[1]))
      var c2 = L2W(0, D / 2 + 0.17)
      t.label(sg[0], 0.4, c2[0], syY + 0.28, c2[1], nn[1] > 0.5 ? 'z+' : nn[1] < -0.5 ? 'z-' : nn[0] > 0.5 ? 'x+' : 'x-', { color: 'white', font: 'sans' })
      // awning
      if (!model) lbox(M(sg[1]), -2.2, doorH + 0.85, D / 2, 2.2, doorH + 0.95, D / 2 + 1.2, false)
    }
    // glass in every window (mid-wall, like the Crossroads map's: shots break
    // it, the player can vault through), local y: the site lifts it
    faces.forEach(function (f) {
      f.holes.forEach(function (o) {
        if (f.doors.indexOf(o) >= 0) return
        var mid = (o[0] + o[1]) / 2, w = f.x ? L2W(mid, f.at) : L2W(f.at, mid), n = L2Wd(f.n[0], f.n[1]), ax = L2Wd(f.x ? 1 : 0, f.x ? 0 : 1)
        ctx.panes.push({ c: new lt.Vector3(w[0] - n[0] * 0.12, (o[2] + o[3]) / 2, w[1] - n[1] * 0.12), n: new lt.Vector3(n[0], 0, n[1]), ax: new lt.Vector3(ax[0], 0, ax[1]), w: o[1] - o[0], h: o[3] - o[2], y0: o[2] })
      })
    })
    // loot: about one floor in two, somewhere in the room (clear of the stairs,
    // the crate, the table and the shop counter)
    for (var lk2 = 0; lk2 < F; lk2++) {
      var nl = ctx.r() < 0.5 ? 1 : 0
      if (nl && ctx.r() < 0.2) nl = 2
      for (var li = 0; li < nl; li++) {
        var xa0 = ix0 + 0.8, xa1 = ix1 - (u.shop && lk2 === 0 ? 2.5 : 1.5), za0 = iz0 + (nF ? 2 * LW : 0) + 0.6, za1 = iz1 - 1.9
        if (xa1 <= xa0 || za1 <= za0) continue
        var lp = L2W(xa0 + ctx.r() * (xa1 - xa0), za0 + ctx.r() * (za1 - za0))
        ctx.loot.push({ kind: lootKind(ctx.r), pos: new lt.Vector3(lp[0], lv[lk2] + 0.03, lp[1]) })
      }
    }
    // posts for a garrison (the plugin below): behind the windows (upper floors
    // first), on a flat roof by the parapet; clear of the stairs and the crate
    var post = function (lx, lz, y, nx, nz, pri) { var w = L2W(lx, lz), n = L2Wd(nx, nz); ctx.posts.push({ x: w[0], y: y, z: w[1], yaw: Math.atan2(-n[0], -n[1]), pri: pri, u: ui }) }
    faces.forEach(function (f, fi) {
      f.holes.forEach(function (o) {
        if (f.doors.indexOf(o) >= 0) return
        var k = -1
        for (var q = 0; q < F; q++) if (Math.abs(lv[q] + WIN.sill - o[2]) < 0.02) k = q
        if (k < 0) return
        var mid = (o[0] + o[1]) / 2, inset = 0.22 + 0.75
        var lx = f.x ? mid : f.at - f.n[0] * inset, lz = f.x ? f.at - f.n[1] * inset : mid
        if (nF && lz < iz0 + 2 * LW + 0.5) return
        if (lx > ix1 - 1.3 && lz > iz1 - 1.3) return
        // the front looks onto the street: those first
        post(lx, lz, lv[k], f.n[0], f.n[1], (k > 0 ? 1 : 0) + (fi === 0 ? 0.6 : fi === 1 ? -0.3 : 0))
      })
    })
    // the doorways stop vehicles (people and bullets go through): SXH_carBlocks
    faces.forEach(function (f) {
      f.doors.forEach(function (o) {
        var p0 = f.x ? L2W(o[0], f.at - f.n[1] * 0.24) : L2W(f.at - f.n[0] * 0.24, o[0]), p1 = f.x ? L2W(o[1], f.at + f.n[1] * 0.02) : L2W(f.at + f.n[0] * 0.02, o[1])
        ctx.doors.push({ min: { x: Math.min(p0[0], p1[0]), y: 0, z: Math.min(p0[1], p1[1]) }, max: { x: Math.max(p0[0], p1[0]), y: o[3], z: Math.max(p0[1], p1[1]) }, surface: 'concrete' })
      })
    })
    if (flat) faces.forEach(function (f) {
      var lx = f.x ? W / 4 : f.at - f.n[0] * 0.9, lz = f.x ? f.at - f.n[1] * 0.9 : D / 4
      post(lx, lz, lv[F], f.n[0], f.n[1], f === faces[0] ? 2.2 : 1.7)
    })
  }

  // ---- desert trees
  // a burst of thin crossed blades from a centre: directions with y in [u0, u1]
  function spikes(R, n, u0, u1, sd) {
    var rr = SXD_rng(sd), pos = []
    for (var k = 0; k < n; k++) {
      var u = u0 + rr() * (u1 - u0), a = rr() * Math.PI * 2, cu = Math.sqrt(Math.max(0, 1 - u * u)), dx = Math.cos(a) * cu, dz = Math.sin(a) * cu
      var L = R * (0.65 + rr() * 0.5), tip = [dx * L, u * L, dz * L], pl = Math.hypot(dx, dz) || 1, wx = (-dz / pl) * 0.04, wz = (dx / pl) * 0.04
      pos.push(wx, 0, wz, -wx, 0, -wz, tip[0], tip[1], tip[2], 0, 0.04, 0, 0, -0.04, 0, tip[0], tip[1], tip[2])
    }
    var g = new lt.BufferGeometry()
    g.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new lt.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
    g.computeVertexNormals()
    return g
  }
  // Joshua tree: a crooked trunk thick at the foot, limbs that bend up and
  // fork once or twice, all shaggy with dead leaves pointing down, a spiky
  // rosette at every tip with a brown skirt under it
  var tubeOr = function (pts, rad) {
    if (K && K.tube) { K.tube(pts, rad, barkM, 7); return }
    for (var i = 1; i < pts.length; i++) t.rod(barkM, pts[i - 1], pts[i], rad[i], { seg: 7, cast: true })
  }
  function joshua(x, z, sd) {
    if (SXH_ST.trees) SXH_ST.trees.push([x, z])
    var r = SXD_rng(sd), H = 1.5 + r() * 1.6, lx = (r() - 0.5) * 0.45, lz = (r() - 0.5) * 0.45
    var tp = [], tr = []
    for (var i = 0; i <= 6; i++) {
      var f = i / 6
      tp.push([x + lx * f * f + (i ? (r() - 0.5) * 0.05 : 0), H * f, z + lz * f * f + (i ? (r() - 0.5) * 0.05 : 0)])
      tr.push((0.27 - 0.09 * f) * (1 + 0.25 * Math.max(0, 1 - f * 5)) + (r() - 0.5) * 0.025)
    }
    tubeOr(tp, tr)
    var shag = function (pts, from, size) {
      for (var j = 1; j < pts.length; j++) {
        if (j / (pts.length - 1) < from) continue
        var q = pts[j]
        t.add(spikes(size, 10, -1, -0.5, S()), deadM, { p: [q[0], q[1] - 0.04, q[2]] })
      }
    }
    shag(tp, 0.5, 0.36)
    var branch = function (p, az, el, len, rad, depth) {
      var pts = [p], rr = [rad], q = p
      for (var k = 1; k <= 4; k++) {
        var bend = (k / 4) * 0.55, dx = Math.cos(az) * Math.cos(el) * (1 - bend), dy = Math.sin(el) + bend, dz = Math.sin(az) * Math.cos(el) * (1 - bend), dl = Math.hypot(dx, dy, dz)
        q = [q[0] + (dx / dl) * (len / 4), q[1] + (dy / dl) * (len / 4), q[2] + (dz / dl) * (len / 4)]
        pts.push(q); rr.push(rad * (1 - (0.28 * k) / 4))
      }
      tubeOr(pts, rr)
      shag(pts, 0.2, 0.3)
      var end = pts[4]
      if (depth < 1 && r() < 0.65) {
        for (var c = 0; c < 2; c++) branch(end, az + (c ? 0.65 : -0.65) + (r() - 0.5) * 0.4, 0.65 + r() * 0.35, 0.45 + r() * 0.5, rad * 0.78, depth + 1)
      } else {
        t.add(spikes(0.5 + r() * 0.2, 60, -0.3, 1, S()), spikeM, { p: [end[0], end[1] + 0.05, end[2]] })
        t.add(spikes(0.42, 22, -1, -0.35, S()), deadM, { p: [end[0], end[1] - 0.12, end[2]] })
      }
    }
    var nB = 2 + ((r() * 3) | 0), a0 = r() * 6.28
    for (var b = 0; b < nB; b++) branch(tp[6], a0 + (b / nB) * 6.28 + (r() - 0.5) * 0.6, 0.45 + r() * 0.4, 0.8 + r() * 0.8, 0.16, 0)
    t.col(x - 0.24, 0, z - 0.24, x + 0.24, H, z + 0.24, 'wood')
  }
  // a low desert shrub: a rounded tuft of grey-green blades and a few dry stems
  function shrub(x, z) {
    var r = SXD_rng(S()), R = 0.35 + r() * 0.4
    t.add(spikes(R, 34, -0.1, 1, S()), shrubM, { p: [x, 0.02, z] })
    t.add(spikes(R * 0.9, 10, 0.2, 1, S()), deadM, { p: [x, 0.02, z] })
  }
  function tree(x, z, r) {
    if (K && r() < 0.35) K.palm(x, z, 6 + r() * 3, 0.6 + r() * 1.2, S())
    else joshua(x, z, S())
  }
  // power line: wooden poles with a crossarm, three wires span to span
  function poles(pts) {
    var tops = pts.map(function (p) {
      t.rod(wood, [p[0], 0, p[1]], [p[0], 7.6, p[1]], 0.12, { seg: 7 })
      t.col(p[0] - 0.14, 0, p[1] - 0.14, p[0] + 0.14, 7.6, p[1] + 0.14, 'wood')
      var c = Math.cos(p[2]), s = Math.sin(p[2])
      t.rod(wood, [p[0] - c * 1.0, 7.2, p[1] - s * 1.0], [p[0] + c * 1.0, 7.2, p[1] + s * 1.0], 0.06, { seg: 5 })
      return [-0.85, 0, 0.85].map(function (o) { return [p[0] + c * o, 7.3, p[1] + s * o] })
    })
    for (var k = 0; k + 1 < tops.length; k++) for (var w = 0; w < 3; w++) t.rod(steel, tops[k][w], tops[k + 1][w], 0.012, { seg: 3 })
  }

  // ---- planners: the buildings of a site (world coords) + what goes round them
  function unit(o) {
    var alongX = o.front === 's' || o.front === 'n'
    o.yaw = SXH_YAW[o.front]
    o.a = o.cx - (alongX ? o.W : o.D) / 2; o.b = o.cx + (alongX ? o.W : o.D) / 2
    o.c = o.cz - (alongX ? o.D : o.W) / 2; o.d = o.cz + (alongX ? o.D : o.W) / 2
    return o
  }
  var pick = function (r, A) { return A[(r() * A.length) | 0] }
  function planGroup(s, r) {
    var spots = s.n === 1 ? [[0, 0]] : s.n === 2 ? [[-9.5, 0], [9.5, 0]] : s.n === 3 ? [[0, -12], [-11.5, 8.5], [11.5, 8.5]] : [[-11.5, -11.5], [11.5, -11.5], [-11.5, 11.5], [11.5, 11.5]]
    var turn = (r() * 4) | 0
    var units = spots.map(function (sp) {
      var c = Math.cos((turn * Math.PI) / 2), sn = Math.sin((turn * Math.PI) / 2)
      var lx = sp[0] * c - sp[1] * sn + (r() - 0.5) * 3, lz = sp[0] * sn + sp[1] * c + (r() - 0.5) * 3
      var fr = s.n === 1 ? 'nsew'.charAt((r() * 4) | 0) : Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? 'e' : 'w') : lz > 0 ? 's' : 'n'
      if (r() < 0.6) {
        var dims = pick(r, [[12, 12], [13, 10], [11, 12], [12, 11]])
        return unit({ cx: s.x + lx, cz: s.z + lz, W: dims[0], D: dims[1], front: fr, kind: 'apt', h: pick(r, [12.0, 12.4, 12.8]), shop: r() < 0.45 })
      }
      var F = 2 + ((r() * 3) | 0)
      return unit({ cx: s.x + lx, cz: s.z + lz, W: 10 + r() * 3, D: 9 + r() * 3, front: fr, kind: 'block', F: F, tint: pick(r, SXH_TINTS), shop: r() < 0.4, tanks: r() < 0.6 ? 1 + (r() < 0.4 ? 1 : 0) : 0, escape: F >= 3 && r() < 0.5 })
    })
    return { units: units, extra: function (free) {
      var props = s.n === 1 ? ['barrel', 'tire_stack', 'pallet_stack'] : ['jersey_barrier', 'jersey_barrier', 'barrel', 'barrel', 'pallet_stack', 'tire_stack', 'crate_stack', 'dumpster', 'cable_reel']
      scatter(s, r, free, props, s.n === 1 ? 2 : 5)
      if (s.n > 1) car(s, r, free)
    } }
  }
  // things lying about + desert trees in the free ground
  function scatter(s, r, free, props, trees) {
    props.forEach(function (kind) {
      for (var tries = 0; tries < 30; tries++) {
        var a = r() * Math.PI * 2, d = (s.r > 20 ? 6 : 9) + r() * (s.r - (s.r > 20 ? 8 : 10)), x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d
        if (!free(x, z, kind === 'dumpster' ? 3 : 2)) continue
        place(kind, x, z, r() * Math.PI * 2, { seed: S(), color: ['red', 'blue', 'yellow'][(r() * 3) | 0] })
        break
      }
    })
    for (var k = 0; k < trees; k++) for (var tries2 = 0; tries2 < 30; tries2++) {
      var a2 = r() * Math.PI * 2, d2 = 4 + r() * (s.r - 6), x2 = s.x + Math.cos(a2) * d2, z2 = s.z + Math.sin(a2) * d2
      if (!free(x2, z2, 3)) continue
      tree(x2, z2, r)
      break
    }
    for (var k3 = 0; k3 < Math.round(trees * 1.6); k3++) for (var tries3 = 0; tries3 < 20; tries3++) {
      var a3 = r() * Math.PI * 2, d3 = 3 + r() * (s.r - 4), x3 = s.x + Math.cos(a3) * d3, z3 = s.z + Math.sin(a3) * d3
      if (!free(x3, z3, 1.5)) continue
      shrub(x3, z3)
      break
    }
  }
  function car(s, r, free) {
    for (var tries = 0; tries < 30; tries++) {
      var a = r() * Math.PI * 2, d = 10 + r() * (s.r - 14), x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d
      if (!free(x, z, 4.5)) continue
      api.truck(x, z, r() * Math.PI * 2, { burnt: r() < 0.6, paint: pick(r, ['paint_white', 'paint_blue', 'paint_green']) })
      return
    }
  }
  // a town: a paved main street and a cross street, buildings fronting them
  // (taller in the middle), parked cars, a power line, trees round about
  function planTown(s, r) {
    var R = s.r - 7, turn = (r() * 2) | 0, xc = (r() - 0.5) * 20, MH = 4.5, CH = 3.5, SET = 2.5
    var toW = function (x, z) { return turn ? [s.x - z, s.z + x] : [s.x + x, s.z + z] }
    var fW = function (f) { return turn ? { s: 'w', n: 'e', e: 's', w: 'n' }[f] : f }
    var inPad = function (x0, z0, x1, z1) { return [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].every(function (p) { return Math.hypot(p[0], p[1]) < R }) }
    var lots = []
    ;[-1, 1].forEach(function (side) {
      var x = -R
      while (x < R) {
        var W = 10 + r() * 4, D = 9 + r() * 3, gap = 3.5 + r() * 4.5, cx = x + W / 2
        if (Math.abs(cx - xc) < CH + SET + W / 2) { x = xc + CH + SET; continue }
        var cz = side * (MH + SET + D / 2)
        if (inPad(cx - W / 2, cz - D / 2, cx + W / 2, cz + D / 2) && r() > 0.12) lots.push({ x: cx, z: cz, W: W, D: D, f: side < 0 ? 's' : 'n', core: Math.abs(cx) < R * 0.4 })
        x += W + gap
      }
    })
    var Z0 = MH + SET + 12 + 3.5
    ;[-1, 1].forEach(function (side) {
      ;[-1, 1].forEach(function (half) {
        var z = Z0
        while (z < R) {
          var W = 10 + r() * 3, D = 9 + r() * 3, gap = 3.5 + r() * 4.5, cz = half * (z + W / 2), cx = xc + side * (CH + SET + D / 2)
          if (inPad(cx - D / 2, cz - W / 2, cx + D / 2, cz + W / 2) && r() > 0.25) lots.push({ x: cx, z: cz, W: W, D: D, f: side < 0 ? 'e' : 'w', core: false })
          z += W + gap
        }
      })
    })
    while (lots.length > 18) lots.splice((r() * lots.length) | 0, 1)
    var units = lots.map(function (L) {
      var p = toW(L.x, L.z), fr = fW(L.f)
      if (L.W >= 11 && L.D >= 10 && r() < (L.core ? 0.45 : 0.3)) {
        return unit({ cx: p[0], cz: p[1], W: Math.min(13, L.W), D: Math.min(12, L.D), front: fr, kind: 'apt', h: pick(r, [12.0, 12.4, 12.8]), shop: r() < 0.55 })
      }
      var F = L.core ? 3 + ((r() * 3) | 0) : r() < 0.6 ? 1 + ((r() * 2) | 0) : 3
      return unit({ cx: p[0], cz: p[1], W: L.W, D: L.D, front: fr, kind: 'block', F: F, tint: pick(r, SXH_TINTS), shop: r() < 0.45,
        tanks: F >= 2 && r() < 0.65 ? 1 + (r() < 0.45 ? 1 : 0) : 0, escape: F >= 3 && r() < 0.55 })
    })
    return { units: units, extra: function (free) {
      // the streets (asphalt, worn), clipped to the pad
      var slabL = function (mat, x0, z0, x1, z1, y, col) {
        var a = toW(x0, z0), b = toW(x1, z1)
        t.slab(mat, Math.min(a[0], b[0]), 0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), y, Math.max(a[1], b[1]))
        if (col) t.col(Math.min(a[0], b[0]), 0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), y, Math.max(a[1], b[1]), 'concrete')
      }
      slabL(asph, -R - 3, -MH, R + 3, MH, 0.035)
      var zc = Math.sqrt(Math.max(0, (R + 3) * (R + 3) - xc * xc))
      slabL(asph, xc - CH, -zc, xc + CH, -MH, 0.035)
      slabL(asph, xc - CH, MH, xc + CH, zc, 0.035)
      // kerbs / sidewalks along the main street
      ;[-1, 1].forEach(function (sd) { slabL(dirty, -R - 1, sd < 0 ? -MH - 2.2 : MH, R + 1, sd < 0 ? -MH : MH + 2.2, 0.12, true) })
      // a power line along the north sidewalk (the crossarms across the street)
      var pts = []
      for (var px = -R + 4; px < R - 2; px += 17) if (Math.abs(px - xc) > CH + 1.5) { var q = toW(px, -MH - 1.2); pts.push([q[0], q[1], turn ? 0 : Math.PI / 2]) }
      poles(pts)
      // parked cars along the kerbs, a wreck or two
      for (var k = 0; k < 5; k++) for (var tries = 0; tries < 20; tries++) {
        var lx = (r() * 2 - 1) * (R - 6), sd2 = r() < 0.5 ? -1 : 1
        if (Math.abs(lx - xc) < CH + 4) continue
        var w = toW(lx, sd2 * (MH - 1.3)), yaw = (turn ? Math.PI / 2 : 0) + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.15
        api.truck(w[0], w[1], yaw, { burnt: r() < 0.3, canopy: r() < 0.3, paint: pick(r, ['paint_white', 'paint_blue', 'paint_green', 'paint_grey', 'paint_red']) })
        break
      }
      var props = ['dumpster', 'dumpster', 'barrel', 'barrel', 'barrel', 'pallet_stack', 'tire_stack', 'crate_stack', 'jersey_barrier', 'cardboard_boxes', 'jerry_can']
      scatter(s, r, function (x, z, m) {
        var l = turn ? [z - s.z, -(x - s.x)] : [x - s.x, z - s.z]
        return free(x, z, m) && Math.abs(l[1]) > MH + 2.4 && Math.abs(l[0] - xc) > CH + 1
      }, props, 14)
    } }
  }
  // a walled ranch: a two-storey house with a colonnade and a tiled hip roof,
  // two wings with gable roofs round a courtyard and its fountain; a barn, a
  // shed, a water tower, fields and a corral outside the walls
  function planRanch(s, r) {
    var turn = (r() * 2) | 0
    var toW = function (x, z) { return turn ? [s.x - z, s.z + x] : [s.x + x, s.z + z] }
    var fW = function (f) { return turn ? { s: 'w', n: 'e', e: 's', w: 'n' }[f] : f }
    var white = 0xe9e2d2, U = function (lx, lz, o) { var p = toW(lx, lz); o.cx = p[0]; o.cz = p[1]; o.front = fW(o.front); o.kind = 'block'; return unit(o) }
    var units = [
      U(0, -9, { W: 20, D: 10, front: 's', F: 2, tint: white, roof: 'hip', porch: true, doorW: 1.8 }),
      U(-15.5, 5.5, { W: 13, D: 7, front: 'e', F: 1, tint: white, roof: 'gable', back: false }),
      U(15.5, 5.5, { W: 13, D: 7, front: 'w', F: 1, tint: white, roof: 'gable', back: false }),
      U(36, -6, { W: 14, D: 10, front: 'w', F: 1, sh: 4.4, tint: 0xa9825f, roof: 'gable', doorW: 3.6 }),
      U(-36, 27, { W: 8, D: 6, front: 'e', F: 1, tint: 0xcdb08a, roof: 'gable', back: false }),
    ]
    return { units: units, extra: function (free) {
      var wm = plaster(0xe3d6bd), wTrim = plaster(0xd3c3a4)
      var slabL = function (mat, x0, y0, z0, x1, y1, z1, col) {
        var a = toW(x0, z0), b = toW(x1, z1)
        var X0 = Math.min(a[0], b[0]), X1 = Math.max(a[0], b[0]), Z0 = Math.min(a[1], b[1]), Z1 = Math.max(a[1], b[1])
        if (mat) t.slab(mat, X0, y0, Z0, X1, y1, Z1)
        if (col) t.col(X0, y0, Z0, X1, y1, Z1, 'concrete')
      }
      // the walls: 2.6 m, tiled coping, a gate in front (pillars, a beam), a back
      // gate by the house and a side gate to the barn
      var HW = 2.6, th = 0.25
      // a wall run (along x at z, or along z at x): plaster, a dark plinth, a tiled
      // coping, pilasters every ~6 m with tiled caps
      var wallRun = function (alongX, at, a0, a1) {
        var B = function (mat, a, y0, o, b, y1, o2, col) { if (alongX) slabL(mat, a, y0, at - o, b, y1, at + o2, col); else slabL(mat, at - o, y0, a, at + o2, y1, b, col) }
        B(wm, a0, 0, th, a1, HW, th, true)
        B(dirty, a0, 0, th + 0.04, a1, 0.45, th + 0.04)
        B(tileM, a0 - 0.05, HW, th + 0.12, a1 + 0.05, HW + 0.14, th + 0.12)
        var n = Math.max(1, Math.round((a1 - a0) / 6))
        for (var j = 0; j <= n; j++) {
          var pa = a0 + ((a1 - a0) * j) / n
          B(wTrim, pa - 0.3, 0.45, th + 0.08, pa + 0.3, HW + 0.1, th + 0.08)
          B(tileM, pa - 0.38, HW + 0.1, th + 0.16, pa + 0.38, HW + 0.26, th + 0.16)
        }
      }
      var cutsOf = function (a0, a1, gaps) { return [a0].concat(gaps.reduce(function (A, g) { return A.concat(g) }, [])).concat([a1]) }
      var wallX = function (z, x0, x1, gaps) { var c = cutsOf(x0, x1, gaps); for (var k = 0; k + 1 < c.length; k += 2) wallRun(true, z, c[k], c[k + 1]) }
      var wallZ = function (x, z0, z1, gaps) { var c = cutsOf(z0, z1, gaps); for (var k = 0; k + 1 < c.length; k += 2) wallRun(false, x, c[k], c[k + 1]) }
      wallX(19, -24, 24, [[-2.6, 2.6]])
      wallX(-19, -24, 24, [[11, 14.5]])
      wallZ(-24, -19, 19, [])
      wallZ(24, -19, 19, [[-8, -4]])
      ;[-3.1, 3.1].forEach(function (gx) { slabL(wm, gx - 0.5, 0, 18.5, gx + 0.5, 3.4, 19.5, true); slabL(tileM, gx - 0.62, 3.4, 18.38, gx + 0.62, 3.55, 19.62) })
      slabL(wm, -3.6, 3.0, 18.7, 3.6, 3.4, 19.3, true)
      // over the gate: a little tiled roof, a sign; the two wooden leaves stand open inward
      var rb = { pos: [], nrm: [], uv: [] }, wb = { pos: [], nrm: [], uv: [] }, ga = toW(-3.95, 18.25), gb = toW(3.95, 19.75)
      SXH_roof(rb, wb, Math.min(ga[0], gb[0]), Math.min(ga[1], gb[1]), Math.max(ga[0], gb[0]), Math.max(ga[1], gb[1]), 3.55, 0.75, 'gable', 0.2)
      ;[[rb, tileM], [wb, wm]].forEach(function (q) {
        if (!q[0].pos.length) return
        var g = new lt.BufferGeometry()
        g.setAttribute('position', new lt.Float32BufferAttribute(q[0].pos, 3)); g.setAttribute('normal', new lt.Float32BufferAttribute(q[0].nrm, 3)); g.setAttribute('uv', new lt.Float32BufferAttribute(q[0].uv, 2))
        t.add(g, q[1], {})
      })
      slabL(wood, -1.9, 2.35, 19.32, 1.9, 2.92, 19.42)
      ;[-1.6, 1.6].forEach(function (cx2) { slabL(steel, cx2 - 0.02, 2.92, 19.35, cx2 + 0.02, 3.0, 19.39) })
      var sc = toW(0, 19.47)
      t.label('OLD RANCH', 0.42, sc[0], 2.64, sc[1], turn ? 'x-' : 'z+', { color: 'white', font: 'stencil', distress: 0.35 })
      var leafA = 1.25, dTurn = turn ? -Math.PI / 2 : 0
      ;[[2.55, -1], [-2.55, 1]].forEach(function (h) {
        var dx = h[1] < 0 ? -Math.cos(leafA) : Math.cos(leafA), dz = -Math.sin(leafA), c = toW(h[0] + dx * 1.27, 19 + dz * 1.27)
        var yawL = (h[1] < 0 ? Math.PI - leafA : leafA) + dTurn
        t.box(wood, 2.5, 2.5, 0.08, c[0], 1.32, c[1], { r: [0, yawL, 0] })
        ;[0.5, 1.9].forEach(function (by) { t.box(steel, 2.46, 0.08, 0.03, c[0], by, c[1], { r: [0, yawL, 0] }) })
      })
      // a dirt path from the gate between the fields
      slabL(mk(0x9a8162, 1, 'sxh_path'), -2.4, 0, 19.6, 2.4, 0.025, 46)
      // the courtyard: terracotta paving, a fountain, palms, planted beds
      slabL(M('brick', { triplanar: true, scale: 1, color: 0xd2aa84 }), -11.5, 0, -3.6, 11.5, 0.04, 18.6)
      var fc = toW(0, 7)
      t.cyl(wm, 2.4, 0.55, fc[0], 0.275, fc[1], { seg: 28 })
      if (K) t.cyl(K.waterM, 2.12, 0.02, fc[0], 0.5, fc[1], { seg: 28 })
      t.cyl(wm, 0.32, 1.5, fc[0], 0.75, fc[1], { seg: 12 })
      t.cyl(wm, 0.85, 0.2, fc[0], 1.55, fc[1], { seg: 18, rTop: 0.95 })
      if (K) t.cyl(K.waterM, 0.8, 0.02, fc[0], 1.66, fc[1], { seg: 18 })
      t.col(fc[0] - 2.1, 0, fc[1] - 2.1, fc[0] + 2.1, 0.55, fc[1] + 2.1, 'concrete')
      t.col(fc[0] - 0.95, 0.55, fc[1] - 0.95, fc[0] + 0.95, 1.75, fc[1] + 0.95, 'concrete')
      ;[[-8, 2.5], [8, 2.5], [-8, 15], [8, 15]].forEach(function (p) { var q = toW(p[0], p[1]); if (K) K.palm(q[0], q[1], 7 + r() * 2, 0.5 + r(), S()) })
      ;[[-10.5, 12, -6.5, 17.5], [6.5, 12, 10.5, 17.5]].forEach(function (b) { slabL(dirty, b[0], 0, b[1], b[2], 0.3, b[3]); for (var k = 0; k < 3; k++) { var q = toW(b[0] + 1 + k * 1.4, (b[1] + b[3]) / 2); api.scrub(q[0], q[1], 0.9, S()) } })
      // outside: the water tower, fields with fences, a corral by the barn, hay
      var wt = toW(-33, -12); api.waterTower(wt[0], wt[1])
      var fence = function (x0, z0, x1, z1, gapAt) {
        var pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]
        for (var k = 0; k < 4; k++) {
          var a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 3.5))
          for (var j = 0; j <= n; j++) { var px = a[0] + ((b[0] - a[0]) * j) / n, pz = a[1] + ((b[1] - a[1]) * j) / n, w = toW(px, pz); t.rod(wood, [w[0], 0, w[1]], [w[0], 1.15, w[1]], 0.06, { seg: 5 }) }
          if (gapAt === k) continue
          ;[0.55, 1.0].forEach(function (y) { var wa = toW(a[0], a[1]), wb = toW(b[0], b[1]); t.rod(wood, [wa[0], y, wa[1]], [wb[0], y, wb[1]], 0.035, { seg: 4 }) })
        }
      }
      // fields: dark soil, raised rows, a tuft of leaves (or wheat) every 0.4-0.6 m
      var soilM = mk(0x6a523d, 1, 'sxh_soil'), ridgeM = mk(0x7b5f45, 1, 'sxh_ridge')
      var cropG = mk(0x6e8e3a, 0.85, 'sxh_crop2', { side: lt.DoubleSide }), wheatM = mk(0xcfae60, 0.9, 'sxh_wheat', { side: lt.DoubleSide })
      var tufts = function (pts, R, n, u0, u1, mat) {
        var pos = []
        pts.forEach(function (p) {
          var a = spikes(R * (0.75 + r() * 0.5), n, u0, u1, S()).attributes.position.array
          for (var i = 0; i < a.length; i += 3) pos.push(a[i] + p[0], a[i + 1] + p[1], a[i + 2] + p[2])
        })
        var g = new lt.BufferGeometry()
        g.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
        g.setAttribute('uv', new lt.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
        g.computeVertexNormals()
        t.add(g, mat, {})
      }
      var field = function (x0, z0, x1, z1, kind, gapAt) {
        fence(x0, z0, x1, z1, gapAt)
        slabL(soilM, x0 + 0.25, 0, z0 + 0.25, x1 - 0.25, 0.035, z1 - 0.25)
        var pts = [], wheat = kind === 'wheat'
        for (var rx = x0 + 1.0; rx < x1 - 0.6; rx += 1.3) {
          slabL(ridgeM, rx - 0.32, 0.035, z0 + 0.7, rx + 0.32, 0.17, z1 - 0.7)
          for (var pz = z0 + 1.0; pz < z1 - 0.9; pz += wheat ? 0.4 : 0.6) { var w = toW(rx + (r() - 0.5) * 0.16, pz + (r() - 0.5) * 0.16); pts.push([w[0], 0.17, w[1]]) }
        }
        if (wheat) tufts(pts, 0.8, 7, 0.78, 1, wheatM)
        else tufts(pts, 0.5, 11, 0.2, 1, cropG)
        // a few round bales lying in the wheat
        if (wheat) for (var hb = 0; hb < 3; hb++) {
          var q = toW(x0 + 2 + r() * (x1 - x0 - 4), z0 + 2 + r() * (z1 - z0 - 4))
          t.cyl(strawM, 0.75, 1.2, q[0], 0.75, q[1], { axis: r() < 0.5 ? 'x' : 'z', seg: 16 })
          t.col(q[0] - 0.7, 0, q[1] - 0.7, q[0] + 0.7, 1.45, q[1] + 0.7, 'wood')
        }
      }
      field(-22, 23, -3.5, 42, 'crop', 3)
      field(3.5, 23, 22, 42, 'wheat', 3)
      field(-44, -2, -30, 19, 'crop', 1)
      fence(30, 5, 43, 16, 3)
      ;[[29, -15], [31, -15.5], [30, -17]].forEach(function (p) { var q = toW(p[0], p[1]); t.cyl(strawM, 0.7, 1.2, q[0], 0.7, q[1], { axis: turn ? 'x' : 'z', seg: 14 }); t.col(q[0] - 0.7, 0, q[1] - 0.7, q[0] + 0.7, 1.4, q[1] + 0.7, 'wood') })
      var tc = toW(27.5, 4); api.truck(tc[0], tc[1], (turn ? 0 : Math.PI / 2) + 0.2, { paint: 'paint_white' })
      scatter(s, r, function (x, z, m) {
        var l = turn ? [z - s.z, -(x - s.x)] : [x - s.x, z - s.z]
        return free(x, z, m) && !(Math.abs(l[0]) < 26 && Math.abs(l[1]) < 21) && !(l[1] > 21 && Math.abs(l[0]) < 24) && !(l[0] < -28 && l[1] > -4 && l[1] < 21)
      }, ['barrel', 'pallet_stack', 'jerry_can'], 8)
    } }
  }

  // ---- every site: plan, build, lift onto its pad
  var ui = 0, allPanes = []
  SXH_SITES.forEach(function (s) {
    var r = SXD_rng(s.id.length * 131 + Math.round(s.x * 7 + s.z * 3))
    var Y = SXH_y(s)
    var n0 = t.staticRoot.children.length, d0 = t.dynRoot.children.length, b0 = G.physics.boxes.length, p0 = t.placed.length
    var plan = s.kind === 'town' ? planTown(s, r) : s.kind === 'ranch' ? planRanch(s, r) : planGroup(s, r)
    var buckets = new Map(), inner = new lt.Group(), far = new lt.Group()
    var ctx = { r: r, panes: [], loot: [], posts: [], doors: [], inner: inner, far: far, bucket: function (m) { if (!buckets.has(m)) buckets.set(m, { pos: [], nrm: [], uv: [] }); return buckets.get(m) } }
    plan.units.forEach(function (u) { house(u, ui++, ctx) })
    buckets.forEach(function (bk, m) {
      if (!bk.pos.length) return
      var g = new lt.BufferGeometry()
      g.setAttribute('position', new lt.Float32BufferAttribute(bk.pos, 3))
      g.setAttribute('normal', new lt.Float32BufferAttribute(bk.nrm, 3))
      g.setAttribute('uv', new lt.Float32BufferAttribute(bk.uv, 2))
      t.add(g, m, {})
    })
    var free = function (x, z, m) { return plan.units.every(function (u) { return x < u.a - m || x > u.b + m || z < u.c - m || z > u.d + m }) && Math.hypot(x - s.x, z - s.z) < s.r - 3 }
    try { plan.extra(free) } catch (e) { console.error('[houses] ' + s.id + ' surroundings', e) }
    // lift the lot onto the pad: meshes, props, their colliders
    var lift = function (o) { o.position.y += Y; o.updateMatrix(); o.updateMatrixWorld(true) }
    var nodes = t.staticRoot.children.slice(n0)
    nodes.forEach(lift)
    t.dynRoot.children.slice(d0).forEach(lift)
    t.placed.slice(p0).forEach(function (p) { p.y += Y })
    var boxes = G.physics.boxes.splice(b0, G.physics.boxes.length - b0)
    boxes.forEach(function (b) { b.min.y += Y; b.max.y += Y })
    ctx.panes.forEach(function (p) { p.c.y += Y; p.y0 += Y; allPanes.push(p) })
    ctx.loot.forEach(function (l) { l.pos.y += Y; SXH_LOOT.push(l) })
    ctx.posts.forEach(function (q) { q.y += Y })
    ctx.doors.forEach(function (q) { q.min.y += Y; q.max.y += Y })
    if (typeof SXD_GROUPS !== 'undefined') SXD_GROUPS.push({ site: s, nodes: nodes })
    // the insides (merged on their own: drawn near only) and their far stand-in
    var mi = By(inner), mf = By(far)
    mi.name = 'houses-in-' + s.id; mf.name = 'houses-far-' + s.id
    mi.position.y = Y; mf.position.y = Y
    mf.traverse(function (o) { if (o.isMesh) o.castShadow = false })
    mi.visible = false
    t.dynRoot.add(mi); t.dynRoot.add(mf)
    SXH_ST.built.push({ site: s, y: Y, units: plan.units, shell: boxes.filter(function (b) { return !b.sxhIn }), ins: boxes.filter(function (b) { return b.sxhIn }),
      on: false, onIn: false, holder: null, inner: mi, far: mf, near: false, posts: ctx.posts, doors: ctx.doors, gar: [], garOn: false, cleared: false })
  })

  // colliders in and out of the physics with the players' distance; the
  // insides / far stand-ins and the models with the camera's
  var cam = G.camera, B = G.physics.boxes
  var swap = function (list, on) {
    if (G.physics.markDirty) G.physics.markDirty() // its broadphase grid (game/js/10_game.js)
    if (on) { for (var k = 0; k < list.length; k++) B.push(list[k]); return }
    var set = new Set(list), w = 0
    for (var q = 0; q < B.length; q++) if (!set.has(B[q])) B[w++] = B[q]
    B.length = w
  }
  t.updaters.push(function () {
    var e = cam.matrixWorld.elements, cx = e[12], cz = e[14]
    var P = G.player, px = P ? P.pos.x : cx, pz = P ? P.pos.z : cz
    SXH_ST.built.forEach(function (b) {
      var s = b.site, d = Math.hypot(px - s.x, pz - s.z) - s.r
      if (typeof SXN_nearestOps === 'function') d = SXN_nearestOps(s.x, s.z, d + s.r) - s.r
      // the walls and roofs within a sniper's range, the stairs, floors and furniture close by
      var want = b.on ? d < SXH_ACTIVE + 50 : d < SXH_ACTIVE
      if (want !== b.on) { b.on = want; swap(b.shell, want) }
      var held = b.gar && b.gar.some(function (u) { return u.alive }) && d < SXH_ACTIVE + 50 // its garrison stands on those floors
      var wantIn = held || (b.onIn ? d < SXH_ACTIVE_IN + 30 : d < SXH_ACTIVE_IN)
      if (wantIn !== b.onIn) { b.onIn = wantIn; swap(b.ins, wantIn) }
      var dc = Math.hypot(cx - s.x, cz - s.z) - s.r, vis = dc < SXD_GROUP_DRAW
      var near = b.near ? dc < SXH_INSIDE + 30 : dc < SXH_INSIDE
      b.near = near
      if (b.inner.visible !== near) b.inner.visible = near
      if (b.far.visible !== (vis && !near)) b.far.visible = vis && !near
      if (b.holder && b.holder.visible !== vis) b.holder.visible = vis
    })
  })
  // the glass: the Crossroads map's panes, shards and window vault (crossroads/crossroads.js)
  if (typeof CXR_glassBuild === 'function' && allPanes.length) {
    try {
      CXR_glassBuild(t.dynRoot, allPanes)
      t.updaters.push(function (dt) {
        if (!CXR_GL.on && window.__ready && G.player && G.physics) CXR_glassInstall(G)
        CXR_shardTick(dt)
      })
    } catch (e) { console.error('[houses] glass', e) }
  }
  SXH_ST.panes = allPanes.length; SXH_ST.loot = SXH_LOOT.length
  SXH_models(t)
  window.__sxh = SXH_ST // tests
}

// a tiled roof over [X0,X1]×[Z0,Z1] (overhang o included) from y up H: hip
// (four slopes) or gable (two slopes along the long side, plaster gable ends
// at the walls)
function SXH_roof(tileB, wallB, X0, Z0, X1, Z1, y, H, kind, o) {
  var alongX = X1 - X0 >= Z1 - Z0, out
  if (alongX) {
    var zc = (Z0 + Z1) / 2, hd = (Z1 - Z0) / 2, xa = kind === 'hip' ? X0 + hd : X0, xb = kind === 'hip' ? X1 - hd : X1
    var A = [X0, y, Z0], B = [X1, y, Z0], C = [X1, y, Z1], D = [X0, y, Z1], R1 = [xa, y + H, zc], R2 = [xb, y + H, zc]
    out = [(X0 + X1) / 2, y + H * 0.3, zc]
    var tris = [[A, B, R2], [A, R2, R1], [C, D, R1], [C, R1, R2]]
    if (kind === 'hip') tris.push([D, A, R1], [B, C, R2])
    SXH_tris(tileB, tris, out)
    if (kind !== 'hip') {
      var wz0 = Z0 + o, wz1 = Z1 - o, Hw = H * (hd - o) / hd
      SXH_tris(wallB, [[[X0 + o, y, wz0], [X0 + o, y, wz1], [X0 + o, y + Hw, zc]], [[X1 - o, y, wz0], [X1 - o, y, wz1], [X1 - o, y + Hw, zc]]], out)
    }
  } else {
    var xc = (X0 + X1) / 2, hw = (X1 - X0) / 2, za = kind === 'hip' ? Z0 + hw : Z0, zb = kind === 'hip' ? Z1 - hw : Z1
    var A2 = [X0, y, Z0], B2 = [X0, y, Z1], C2 = [X1, y, Z1], D2 = [X1, y, Z0], S1 = [xc, y + H, za], S2 = [xc, y + H, zb]
    out = [xc, y + H * 0.3, (Z0 + Z1) / 2]
    var tris2 = [[A2, B2, S2], [A2, S2, S1], [C2, D2, S1], [C2, S1, S2]]
    if (kind === 'hip') tris2.push([D2, A2, S1], [B2, C2, S2])
    SXH_tris(tileB, tris2, out)
    if (kind !== 'hip') {
      var wx0 = X0 + o, wx1 = X1 - o, Hw2 = H * (hw - o) / hw
      SXH_tris(wallB, [[[wx0, y, Z0 + o], [wx1, y, Z0 + o], [xc, y + Hw2, Z0 + o]], [[wx0, y, Z1 - o], [wx1, y, Z1 - o], [xc, y + Hw2, Z1 - o]]], out)
    }
  }
}

// ---------------------------------------------------------------- models
// The old-apartment model (one instance per apt house, per site, scaled to
// its wall planes so the window holes land on the openings) and its brick on
// the facade quads. Cut like the Crossroads map's enterable blocks: no glass,
// no recessed doors (the doorways are open), no roof surface, no wall planes
// and small reveals (the brick quads with the openings replace them).
function SXH_models(t) {
  if (typeof SX_assetLater !== 'function' || typeof CXR_bake !== 'function') return
  var st = SXH_ST
  SX_assetLater('cx_skin_oabrick', typeof SX_ASSET_cx_skin_oabrick === 'string' && SX_ASSET_cx_skin_oabrick).then(function (b64) {
    if (!b64 || st !== SXH_ST) return null
    return SX_image(b64, 'image/webp').then(function (img) {
      var tx = new lt.Texture(img)
      tx.colorSpace = lt.SRGBColorSpace
      tx.wrapS = tx.wrapT = lt.MirroredRepeatWrapping
      tx.anisotropy = 4
      tx.needsUpdate = true
      st.facadeM.map = tx
      st.facadeM.color.set(0xffffff)
      st.facadeM.needsUpdate = true
    })
  }).catch(function (e) { console.warn('[houses] brick texture', e) })
  SX_assetLater('cx_oldap', typeof SX_ASSET_cx_oldap === 'string' && SX_ASSET_cx_oldap).then(function (b64) {
    if (!b64 || st !== SXH_ST) return null
    return SX_parseGLB(b64).then(function (gltf) {
      if (st !== SXH_ST) return
      var OAP = SXH_OAP, parts = CXR_bake(gltf.scene)
      var un = new lt.Matrix4().makeScale(1 / (OAP.x1 - OAP.x0), 1 / OAP.h, 1 / (OAP.z1 - OAP.z0)).multiply(new lt.Matrix4().makeTranslation(-(OAP.x0 + OAP.x1) / 2, 0, -(OAP.z0 + OAP.z1) / 2))
      var cut = []
      parts.forEach(function (p) {
        if (/glass/i.test((p.mat && p.mat.name) || '')) return
        var g = CXR_filter(p.geo, function (x, y, z, y0, y1) {
          if (x > -88 && x < 35 && y < 94 && ((z > 74 && z < 107) || (z > -131 && z < -99))) return false // front/back vestibules + doors
          if (y1 < 2 && x > -326 && x < 273 && z > -131 && z < 107) return false // hallway strip
          if (y0 > 444 && y1 < 446) return false // roof surface
          if (y1 < 441.5 && x > -328 && x < 275 && ((z > 101.5 && z < 108.7) || (z < -125.5 && z > -132.7))) return false // front/back wall planes
          if (y1 < 441.5 && z > -133 && z < 109 && ((x < -320.5 && x > -327.7) || (x > 267.5 && x < 274.7))) return false // side wall planes
          return true
        })
        if (g.attributes.position.count) cut.push({ geo: g.applyMatrix4(un), mat: p.mat })
      })
      var root = t.dynRoot
      st.built.forEach(function (b) {
        var apts = b.units.filter(function (u) { return u.kind === 'apt' })
        if (!apts.length) return
        var holder = new lt.Group()
        holder.name = 'houses-' + b.site.id
        holder.position.y = b.y
        var mats = apts.map(function (u) { return CXR_trs(u.cx, 0, u.cz, u.yaw, u.W, u.h, u.D) })
        cut.forEach(function (c) { holder.add(CXR_inst(c.geo, c.mat, mats)) })
        root.add(holder)
        b.holder = holder
      })
      st.models = true
      try { if (t.G.renderer && t.G.renderer.shadowMap) t.G.renderer.shadowMap.needsUpdate = true } catch (e) { }
    })
  }).catch(function (e) { console.warn('[houses] apartment model unavailable, plain walls stay', e) })
}

// ---------------------------------------------------------------- garrisons
// The towns, the ranch and the small groups are held: when a player comes
// within SXH_ACTIVE_IN m, troopers take posts behind the windows (upper floors
// first) and on the roofs (troopers/troopers.js spawnPost: they fight from
// there and never leave). All down: the place is clear (radio). Everybody
// gone past SXH_ACTIVE + 100 m: the rest stand down, and the place is held
// again on the next visit. Online only the host spawns (guests get twins).
var SXH_GARRISON = { town: 7, ranch: 5, group: 3 } // troopers per place (groups of 2+ houses only)
var SXH_VARIANTS = [['rifle', 0.6], ['marksman', 0.25], ['heavy', 0.15]]
if (typeof SXU_PLUGINS !== 'undefined') SXU_PLUGINS.push(function SXH_garrisons(U, G) {
  if (!U.desert) return
  var V3 = lt.Vector3
  U.hooks.reset.push(function () { (SXH_ST.built || []).forEach(function (b) { b.gar = []; b.garOn = false; b.cleared = false }) })
  var pickVariant = function () { var x = Math.random(); for (var i = 0; i < SXH_VARIANTS.length; i++) { x -= SXH_VARIANTS[i][1]; if (x <= 0) return SXH_VARIANTS[i][0] } return 'rifle' }
  U.hooks.update.push(function () {
    if (!G.game || G.game.state !== 'playing' || !U.troopers || !U.troopers.spawnPost) return
    if (typeof SXN !== 'undefined' && SXN.active && SXN.role === 'guest') return
    var P = G.player
    if (!P) return
    ;(SXH_ST.built || []).forEach(function (b) {
      var s = b.site, n = s.kind === 'group' ? (s.n > 1 ? SXH_GARRISON.group : 0) : SXH_GARRISON[s.kind] || 0
      if (!n || !b.posts || !b.posts.length) return
      var d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z) - s.r
      if (typeof SXN_nearestOps === 'function') d = SXN_nearestOps(s.x, s.z, d + s.r) - s.r
      if (!b.garOn && !b.cleared && d < SXH_ACTIVE_IN && b.onIn) {
        // roofs and upper windows first, at most two per building
        var posts = b.posts.map(function (p) { return { p: p, k: p.pri + Math.random() * 0.8 } }).sort(function (a, c) { return c.k - a.k }).map(function (a) { return a.p }), per = {}
        b.gar = []
        for (var k = 0; k < posts.length && b.gar.length < n; k++) {
          var q = posts[k]
          if ((per[q.u] = (per[q.u] || 0) + 1) > 2) continue
          var u = U.troopers.spawnPost(new V3(q.x, q.y, q.z), q.yaw, pickVariant())
          if (u) b.gar.push(u)
        }
        b.garOn = b.gar.length > 0
        if (b.garOn && s.name) U.radio('Control: contact — ' + s.name + ' is held. Watch the windows and the roofs.', 5)
      } else if (b.garOn) {
        var left = b.gar.filter(function (u) { return u.alive })
        if (!left.length) {
          b.garOn = false; b.cleared = true
          if (s.name) {
            U.radio('Control: ' + s.name + ' is clear. Good work.', 4)
            var h = U.hud && U.hud()
            h && h.feed && h.feed('<b class="sx-pk">' + s.name + '</b> cleared')
          }
        } else if (d > SXH_ACTIVE + 100) {
          // everybody left: stand down, held again next time
          left.forEach(function (u) { try { U.remove(u) } catch (e) { } })
          b.gar = []; b.garOn = false
        }
      }
    })
  })
})

// Vehicles can't drive into the houses: the doorways are wide enough for a
// buggy (an apartment block's is 2.4 m), so cars/cars.js gatherBoxes also takes
// a box across every doorway near it from here — not in the physics, so people
// and bullets still go through
function SXH_carBlocks(pos, r, out) {
  var B = SXH_ST.built || []
  for (var k = 0; k < B.length; k++) {
    var b = B[k], s = b.site
    if (!b.on || !b.doors || Math.hypot(pos.x - s.x, pos.z - s.z) > s.r + r + 5) continue
    for (var j = 0; j < b.doors.length; j++) {
      var d = b.doors[j]
      if (pos.x + r < d.min.x || pos.x - r > d.max.x || pos.z + r < d.min.z || pos.z - r > d.max.z || pos.y + r < d.min.y || pos.y - r > d.max.y) continue
      out.push(d)
    }
  }
}
