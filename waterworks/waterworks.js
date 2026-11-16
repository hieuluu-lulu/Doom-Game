/* ==========================================================================
 * Waterworks — compact industrial team-deathmatch map for DoomZone (?map=waterworks).
 *
 * An original layout (playable 50×46 m, mirrored west↔east only): a water-
 * treatment yard with three lanes between the two team yards.
 *   * Team yards (Blue west, Red east): long walled yards, 4 m walls nobody
 *     jumps or lobs over; three doorways each (gallery, basin, pump hall),
 *     a baffle wall inside the basin doorway and one inside the gallery
 *     doorway, so nothing sees or hits the spawn from outside.
 *   * North: the pipe gallery — a 7 m wide service lane along the outer wall,
 *     48 m end to end: the long sniper line. Pipe run along the wall
 *     (crouch cover), two valve stations, one low block in the middle.
 *   * Middle: the settling basin — sunk 0.5 m, a few centimetres of water on
 *     the floor (every step splashes). In it the clarifier tank on a stepped
 *     round plinth (the mid cover), valve boxes and pipe manifolds around it,
 *     and a steel catwalk 2.6 m up across the basin with stairs at both ends.
 *     A steel gantry frame overhead, open to the sky.
 *   * South: the pump hall — roofed, skylights, three pump units, cabinets:
 *     the close-quarters lane.
 * Same plumbing as crossroads/crossroads.js: the bundle's level builder `ob`,
 * physics boxes for everything solid, a height field for the sunken basin
 * (SXD_HG / SXD_TH), the stub ground re-cut around the playable floor.
 * North is -z, the sun sits high in the south-west. Top-level names: WW_.
 * ========================================================================== */

var WW_ON = typeof SX_MAP !== 'undefined' && SX_MAP === 'waterworks'
var WW_TEXT = {
  'Raising the terminal': 'Pouring the basins',
  'Mixing paint, rust and rain': 'Mixing concrete, rust and silt',
  'Stacking containers': 'Laying the pipe gallery',
  'Raising the cranes': 'Raising the clarifier',
  'Flooding the apron': 'Flooding the settling basin',
  'Waking the Harbormaster': 'Waking the machines',
  'Waiting for first light': 'Waiting for the shift change',
  'Get to the boat': 'Get to the evac van',
  Boat: 'Evac',
  'Relays still live — the boat will not wait under fire': 'Relays still live — the van will not wait under fire',
  'Hauled out of the water': 'Back on your feet',
}
// the walkable floor (inside faces of the perimeter walls)
var WW_B = { x0: -25, x1: 25, z0: -23, z1: 23 }
// the settling basin: a rounded rectangle, ramps `ramp` m wide, `depth` m deep,
// water surface at `water` (the floor is at -depth: a few cm of water)
var WW_BASIN = { x0: -11, x1: 11, z0: -11.5, z1: 5.5, ramp: 1.8, depth: 0.5, water: -0.43 }
var WW_FLOOR = { built: false, tries: 0, u: null }

function WW_params(p) {
  if (!WW_ON) return p
  try {
    // cold, bright overcast: the sun high in the south-west, hard shadows
    // across the gallery and under the gantry
    Mn.dir.set(-0.36, 0.8, 0.48).normalize()
    Mn.color.setRGB(0.96, 0.97, 1.0)
    Mn.intensity = 6.2
    en.zenith.setRGB(0.33, 0.39, 0.46)
    en.horizon.setRGB(0.63, 0.66, 0.69)
    en.horizonAway.setRGB(0.54, 0.57, 0.61)
    en.fog.setRGB(0.5, 0.53, 0.55)
    WW_heightGrid()
    oi.quayX = 1e4
    oi.min.set(WW_B.x0, 0, WW_B.z0)
    oi.max.set(WW_B.x1, 30, WW_B.z1)
    Ya = WW_B.x0 - 2; EA = WW_B.x1 + 2; ol = WW_B.z0 - 2; SA = WW_B.z1 + 2
    qt = Math.round((EA - Ya) / Ls); Qs = Math.round((SA - ol) / Ls)
    _l.intro = 'Breacher, Control. The machines took the waterworks. Cut the three relays — gallery, basin, pump hall.'
    _l.all = 'All three dark. The evac van is waiting in the east yard. Go.'
    _l.done = 'Breacher is out. The waterworks is dark. Good work.'
  } catch (e) {
    console.error('[waterworks] params', e)
  }
  if (p.wet === undefined) p.wet = '0.45'
  return p
}

function WW_height(x, z) {
  var B = WW_BASIN, r = B.ramp
  var dx = Math.max(B.x0 + r - x, 0, x - (B.x1 - r)), dz = Math.max(B.z0 + r - z, 0, z - (B.z1 - r))
  var d = Math.hypot(dx, dz)
  if (d >= r) return 0
  var t = d / r
  return -B.depth * (1 - t * t * (3 - 2 * t))
}
function WW_heightGrid() {
  var half = 60, step = 0.5, n = Math.ceil((half * 2) / step) + 1, data = new Float32Array(n * n)
  for (var j = 0; j < n; j++) for (var k = 0; k < n; k++) data[j * n + k] = WW_height(-half + k * step, -half + j * step)
  SXD_HG = { x0: -half, z0: -half, step: step, n: n, data: data, hmax: 0.5, cx: 0, cz: 0 }
  SXD_TH = SXD_heightAt
}
function WW_ground() {
  return {
    stub: true, update: function () {},
    wetnessAt: function (x, z) { var h = WW_height(x, z); return h < WW_BASIN.water ? 1 : h < -0.02 ? 0.8 : 0.3 },
    isPuddle: function (x, z) { return WW_height(x, z) < WW_BASIN.water - 0.005 },
  }
}

// The stub ground (a 400 m asphalt plane, added after the level) gets a hole
// over the playable floor — the level lays its own floor there — and the basin
// gets its bowl mesh and a sheet of murky water.
function WW_floorBuild(G) {
  var plane = null
  G.scene.traverse(function (o) { if (!plane && o.isMesh && o.material && o.material.name === 'asphalt' && o.geometry && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters && o.geometry.parameters.width >= 200) plane = o })
  if (!plane) return false
  var W = plane.geometry.parameters.width / 2, X = WW_B.x1 + 0.7, Z = WW_B.z1 + 0.7
  var pos = [], uv = [], idx = []
  var quad = function (x0, z0, x1, z1) {
    var b = pos.length / 3
    ;[[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(function (q) { pos.push(q[0], 0, q[1]); uv.push((q[0] + W) / (2 * W), 1 - (q[1] + W) / (2 * W)) })
    idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 2)
  }
  quad(-W, -W, W, -Z); quad(-W, Z, W, W); quad(-W, -Z, -X, Z); quad(X, -Z, W, Z)
  var g0 = new lt.BufferGeometry()
  g0.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
  g0.setAttribute('uv', new lt.Float32BufferAttribute(uv, 2))
  g0.setAttribute('normal', new lt.Float32BufferAttribute(pos.map(function (v, k) { return k % 3 === 1 ? 1 : 0 }), 3))
  g0.setIndex(idx)
  g0.computeBoundingSphere()
  plane.geometry.dispose()
  plane.geometry = g0
  // the basin bowl: a grid over the basin rect following WW_height, uv in metres
  var B = WW_BASIN, step = 0.25
  var nx = Math.round((B.x1 - B.x0) / step), nz = Math.round((B.z1 - B.z0) / step)
  var p2 = [], u2 = [], i2 = []
  var c2 = []
  for (var j = 0; j <= nz; j++) for (var k = 0; k <= nx; k++) {
    var x = B.x0 + (k * (B.x1 - B.x0)) / nx, z = B.z0 + (j * (B.z1 - B.z0)) / nz, h = WW_height(x, z)
    p2.push(x, h, z); u2.push(x, z)
    // dry concrete → a green-brown algae line at the water's edge → dark sludge under the water
    var n = 0.5 + 0.5 * Math.sin(x * 1.7 + Math.sin(z * 0.9) * 2.1) * Math.sin(z * 1.3 - x * 0.4)
    var wet = Math.max(0, Math.min(1, (B.water + 0.12 - h) / 0.12)), deep = Math.max(0, Math.min(1, (B.water - 0.01 - h) / 0.04))
    var r0 = 1 - wet * 0.38, g0 = 1 - wet * 0.3, b0 = 1 - wet * 0.48
    r0 = r0 * (1 - deep) + (0.46 + 0.06 * n) * deep; g0 = g0 * (1 - deep) + (0.48 + 0.07 * n) * deep; b0 = b0 * (1 - deep) + (0.38 + 0.04 * n) * deep
    c2.push(r0, g0, b0)
  }
  for (var j2 = 0; j2 < nz; j2++) for (var k2 = 0; k2 < nx; k2++) {
    var a = j2 * (nx + 1) + k2
    i2.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2)
  }
  var bowl = new lt.BufferGeometry()
  bowl.setAttribute('position', new lt.Float32BufferAttribute(p2, 3))
  bowl.setAttribute('uv', new lt.Float32BufferAttribute(u2, 2))
  bowl.setAttribute('color', new lt.Float32BufferAttribute(c2, 3))
  bowl.setIndex(i2)
  bowl.computeVertexNormals()
  bowl.computeBoundingSphere()
  var bm = new lt.Mesh(bowl, G.mats.get('concrete_dirty', { color: 0x8e9688, vertexColors: true }))
  bm.name = 'ww-basin-floor'
  bm.receiveShadow = true
  G.scene.add(bm)
  // murky water: grey-green, glossy, slow ripples in the normal
  var u = { uT: { value: 0 } }
  var wm = new lt.MeshStandardMaterial({ color: 0x394136, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.82, envMapIntensity: 1.3 })
  wm.name = 'ww_water'
  wm.onBeforeCompile = function (sh) {
    sh.uniforms.uT = u.uT
    // scum: pale drifting patches that dull the gloss
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  float wwScum = 0.0;\n  { vec2 q = vWwW.xz + vec2(uT * 0.04, uT * 0.025); float n = sin(q.x * 0.83 + 1.7) * sin(q.y * 1.13) + sin(q.x * 2.9 - q.y * 2.1) * 0.35 + sin(q.x * 6.1 + q.y * 5.3) * 0.12;\n    wwScum = smoothstep(0.5, 0.88, n * 0.5 + 0.5); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.35, 0.28), wwScum * 0.5); diffuseColor.a = mix(diffuseColor.a, 0.95, wwScum * 0.5); }')
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.55, wwScum);')
    sh.vertexShader = 'varying vec3 vWwW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWwW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = 'varying vec3 vWwW;\nuniform float uT;\n' + sh.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\n  { vec2 q = vWwW.xz; float a = sin(q.x * 2.1 + uT * 1.0) + sin(q.y * 2.7 - uT * 0.7) * 0.8 + sin((q.x + q.y) * 5.3 + uT * 1.7) * 0.35;\n    float b = cos(q.y * 2.3 + uT * 0.8) + cos(q.x * 3.1 - uT * 1.2) * 0.7 + cos((q.x - q.y) * 4.9 - uT * 1.5) * 0.35;\n    normal = normalize(normal + mat3(viewMatrix) * vec3(a * 0.03, 0.0, b * 0.03)); }')
  }
  wm.customProgramCacheKey = function () { return 'ww-water-2' }
  var water = new lt.Mesh(new lt.PlaneGeometry(B.x1 - B.x0 - 0.6, B.z1 - B.z0 - 0.6).rotateX(-Math.PI / 2), wm)
  water.position.set((B.x0 + B.x1) / 2, B.water, (B.z0 + B.z1) / 2)
  water.name = 'ww-water'
  water.receiveShadow = true
  water.renderOrder = -2
  G.scene.add(water)
  WW_FLOOR.u = u
  return true
}

/* ============================================================ LEVEL ===== */

async function WW_level(i) {
  var root = new lt.Group()
  root.name = 'level'
  i.scene.add(root)
  var t = ob(i)
  var place = t.place
  var M = t.M
  var ts = Math.PI / 2
  var rnd = SXD_rng(5151)
  var V = function (x, y, z) { return new lt.Vector3(x, y, z) }
  var hB = WW_height

  var conc = M('concrete'), dirty = M('concrete_dirty'), painted = M('concrete_painted')
  var moss = M('concrete_dirty', { color: 0xa3ab96 }), stain = M('concrete_dirty', { color: 0x7d8479 })
  var dark = M('steel_dark'), rust = M('steel_rust'), worn = M('steel_worn'), galv = M('steel_galv'), bare = M('steel_bare')
  var plate = M('diamond_plate'), roofM = M('corrugated_roof'), glass = M('glass_dirty'), epoxy = M('floor_epoxy')
  var hazard = M('hazard_stripes'), wood = M('wood_dark'), tire = M('tire')
  var yellowM = M('paint_yellow'), blueM = M('paint_blue'), redM = M('paint_red'), whiteM = M('paint_white')
  var greyM = M('paint_grey'), greenM = M('paint_green'), tealM = M('paint_teal'), orangeM = M('paint_orange')
  var glow = i.mats.emissive ? i.mats.emissive(0xffe6bf, 2.4) : whiteM
  var glowCool = i.mats.emissive ? i.mats.emissive(0xd6ebff, 2.2) : whiteM

  /* ---- helpers ----------------------------------------------------------- */
  // world-aligned block from corners; col: true = concrete collider, or a surface name
  function blk(mat, x0, y0, z0, x1, y1, z1, col, opts) {
    var a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(z0, z1), d = Math.max(z0, z1)
    t.slab(mat, a, y0, c, b, y1, d, opts)
    if (col) t.col(a, y0, c, b, y1, d, col === true ? 'concrete' : col)
  }
  // a round thing as axis-aligned colliders: n strips across z, each as wide
  // as the circle at the strip's widest (the hull, so strafing along it is smooth)
  function roundCol(cx, cz, r, y0, y1, surface, n) {
    n = n || 9
    for (var k = 0; k < n; k++) {
      var za = -r + (2 * r * k) / n, zb = -r + (2 * r * (k + 1)) / n
      var zin = za < 0 && zb > 0 ? 0 : Math.min(Math.abs(za), Math.abs(zb))
      var hw = Math.sqrt(Math.max(0, r * r - zin * zin))
      t.col(cx - hw, y0, cz + za, cx + hw, y1, cz + zb, surface || 'concrete')
    }
  }
  // a wall along x or z with door openings: openings = [[from, to, height], ...]
  // along the wall's run; the wall above an opening (the lintel) is kept
  function wallX(z0, z1, x0, x1, h, mat, openings, trim) {
    var cuts = (openings || []).slice().sort(function (a, b) { return a[0] - b[0] }), at = x0
    cuts.forEach(function (o) {
      if (o[0] > at) blk(mat, at, 0, z0, o[0], h, z1, true)
      blk(mat, o[0], o[2], z0, o[1], h, z1, true)
      if (trim) doorFrame('x', o[0], o[1], (z0 + z1) / 2, z1 - z0, o[2])
      at = o[1]
    })
    if (at < x1) blk(mat, at, 0, z0, x1, h, z1, true)
  }
  function wallZ(x0, x1, z0, z1, h, mat, openings, trim) {
    var cuts = (openings || []).slice().sort(function (a, b) { return a[0] - b[0] }), at = z0
    cuts.forEach(function (o) {
      if (o[0] > at) blk(mat, x0, 0, at, x1, h, o[0], true)
      blk(mat, x0, o[2], o[0], x1, h, o[1], true)
      if (trim) doorFrame('z', o[0], o[1], (x0 + x1) / 2, x1 - x0, o[2])
      at = o[1]
    })
    if (at < z1) blk(mat, x0, 0, at, x1, h, z1, true)
  }
  // steel door frame round an opening (visual)
  function doorFrame(axis, a, b, c, thick, h) {
    var w = thick + 0.08
    if (axis === 'x') {
      t.slab(dark, a - 0.1, 0, c - w / 2, a, h + 0.1, c + w / 2)
      t.slab(dark, b, 0, c - w / 2, b + 0.1, h + 0.1, c + w / 2)
      t.slab(dark, a - 0.1, h, c - w / 2, b + 0.1, h + 0.12, c + w / 2)
      t.slab(hazard, a, 0.004, c - w / 2, b, 0.012, c + w / 2)
    } else {
      t.slab(dark, c - w / 2, 0, a - 0.1, c + w / 2, h + 0.1, a)
      t.slab(dark, c - w / 2, 0, b, c + w / 2, h + 0.1, b + 0.1)
      t.slab(dark, c - w / 2, h, a - 0.1, c + w / 2, h + 0.12, b + 0.1)
      t.slab(hazard, c - w / 2, 0.004, a, c + w / 2, 0.012, b)
    }
  }
  // steel stair along x, real steps: from xBottom (ground y0) rising toward
  // dir (+1 = +x, -1 = -x) to `top`, `w` wide centred on zc. Every tread is
  // solid to the ground (a collider each); stringers and handrails drawn
  function stairX(xBottom, dir, zc, w, top, y0) {
    y0 = y0 || 0
    var n = Math.max(2, Math.round((top - y0) / 0.26)), rise = (top - y0) / n, run = 0.3
    for (var k = 1; k <= n; k++) {
      var xa = xBottom + dir * run * (k - 1), xb = xBottom + dir * run * k
      var a = Math.min(xa, xb), b = Math.max(xa, xb), y = y0 + rise * k
      t.slab(plate, a, y - 0.05, zc - w / 2, b, y, zc + w / 2)
      t.slab(dark, a + 0.02, y - 0.12, zc - w / 2 + 0.03, b - 0.02, y - 0.05, zc + w / 2 - 0.03)
      t.col(a, y0, zc - w / 2, b, y, zc + w / 2, 'metal')
      // the handrails: no stepping off the side (from the floor up to rail height)
      t.col(a, y0, zc - w / 2 - 0.08, b, y + 1.0, zc - w / 2, 'metal')
      t.col(a, y0, zc + w / 2, b, y + 1.0, zc + w / 2 + 0.08, 'metal')
    }
    var L = n * run, len = Math.hypot(L, top - y0), ang = Math.atan2(top - y0, L), mid = xBottom + (dir * L) / 2
    t.metalRects.push([Math.min(xBottom, xBottom + dir * L), zc - w / 2, Math.max(xBottom, xBottom + dir * L), zc + w / 2])
    for (var s of [-1, 1]) {
      var zz = zc + s * (w / 2 + 0.04)
      t.box(dark, len + 0.2, 0.26, 0.06, mid, (y0 + top) / 2 - 0.16, zz, { r: [0, 0, dir * ang] })
      t.rod(yellowM, [xBottom, y0 + 0.95, zz], [xBottom + dir * L, top + 0.95, zz], 0.024, { seg: 7 })
      for (var q = 0; q <= 2; q++) {
        var px = xBottom + (dir * L * q) / 2, py = y0 + ((top - y0) * q) / 2
        t.box(yellowM, 0.045, 0.95, 0.045, px, py + 0.475, zz)
      }
    }
  }
  function label(text, size, x, y, z, face, color, font) {
    try { return t.label(text, size, x, y, z, face, { color: color || 'white', font: font || 'stencil' }) } catch (e) { return null }
  }

  /* ---- the floor ---------------------------------------------------------- */
  // (physics ground = the height field; these are the visible floor, no colliders)
  var BS = WW_BASIN
  ;[
    [dirty, -25.7, -23.7, 25.7, BS.z0],       // gallery, north rim, the yards' north ends
    [dirty, -25.7, BS.z0, BS.x0, BS.z1],      // west rim + west yard
    [dirty, BS.x1, BS.z0, 25.7, BS.z1],       // east rim + east yard
    [dirty, -25.7, BS.z1, 25.7, 10.8],        // south rim + yards
    [dirty, -25.7, 10.8, -18.2, 23.7],        // west yard, south end
    [dirty, 18.2, 10.8, 25.7, 23.7],          // east yard, south end
    [epoxy, -18.2, 10.8, 18.2, 23.7],         // pump hall
  ].forEach(function (f) { t.slab(f[0], f[1], -0.12, f[2], f[3], 0, f[4]) })
  // hazard edge round the basin, drains, painted walkway lines
  t.slab(hazard, BS.x0 - 0.35, 0.002, BS.z0 - 0.35, BS.x1 + 0.35, 0.01, BS.z0)
  t.slab(hazard, BS.x0 - 0.35, 0.002, BS.z1, BS.x1 + 0.35, 0.01, BS.z1 + 0.35)
  t.slab(hazard, BS.x0 - 0.35, 0.002, BS.z0, BS.x0, 0.01, BS.z1)
  t.slab(hazard, BS.x1, 0.002, BS.z0, BS.x1 + 0.35, 0.01, BS.z1)
  for (var dx of [-14, -4, 4, 14]) t.slab(dark, dx - 0.5, 0.002, -16.9, dx + 0.5, 0.012, -16.5) // gallery drains
  t.slab(yellowM, -24.6, 0.002, -16.75, 24.6, 0.008, -16.65) // gallery: the walk line
  t.slab(yellowM, -24.6, 0.002, -21.55, 24.6, 0.008, -21.45)

  /* ---- perimeter: 7 m concrete walls --------------------------------------- */
  var H0 = 7
  blk(moss, -25.6, 0, -23.6, 25.6, H0, -23, true)
  blk(moss, -25.6, 0, 23, 25.6, H0, 23.6, true)
  blk(moss, -25.6, 0, -23, -25, H0, 23, true)
  blk(moss, 25, 0, -23, 25.6, H0, 23, true)
  // plinth band, joints, coping, pilasters (inside faces)
  t.slab(stain, -25, 0, -23.04, 25, 1.1, -23)
  t.slab(stain, -25, 0, 23, 25, 1.1, 23.04)
  t.slab(stain, -25.04, 0, -23, -25, 1.1, 23)
  t.slab(stain, 25, 0, -23, 25.04, 1.1, 23)
  for (var jy of [2.4, 4.7]) {
    t.slab(conc, -25, jy, -23.03, 25, jy + 0.06, -23)
    t.slab(conc, -25, jy, 23, 25, jy + 0.06, 23.03)
    t.slab(conc, -25.03, jy, -23, -25, jy + 0.06, 23)
    t.slab(conc, 25, jy, -23, 25.03, jy + 0.06, 23)
  }
  t.slab(conc, -25.8, H0, -23.8, 25.8, H0 + 0.25, -22.9)
  t.slab(conc, -25.8, H0, 22.9, 25.8, H0 + 0.25, 23.8)
  t.slab(conc, -25.8, H0, -22.9, -24.9, H0 + 0.25, 22.9)
  t.slab(conc, 24.9, H0, -22.9, 25.8, H0 + 0.25, 22.9)
  for (var px = -24; px <= 24.01; px += 6) {
    t.slab(conc, px - 0.25, 0, -23, px + 0.25, H0, -22.72)
    t.slab(conc, px - 0.25, 0, 22.72, px + 0.25, H0, 23)
  }
  for (var pz = -18; pz <= 18.01; pz += 6) {
    t.slab(conc, -25, 0, pz - 0.25, -24.72, H0, pz + 0.25)
    t.slab(conc, 24.72, 0, pz - 0.25, 25, H0, pz + 0.25)
  }
  // rust streaks under the coping
  for (var k0 = 0; k0 < 26; k0++) {
    var sx = -24 + rnd() * 48, sh = 1.2 + rnd() * 2.2
    t.slab(rust, sx - 0.06, H0 - sh, -23.006, sx + 0.06, H0 - 0.05, -23)
    var sx2 = -24 + rnd() * 48
    t.slab(rust, sx2 - 0.06, H0 - sh, 23, sx2 + 0.06, H0 - 0.05, 23.006)
  }

  /* ---- the gallery wall (z = -16), the yard walls (x = ±18) -------------- */
  var HI = 4 // inner walls: over the head and the hand — no jumping, no lobbing
  wallX(-16.2, -15.8, -25, 25, HI, moss, [[-23, -20.5, 2.8], [-9.5, -7, 2.8], [7, 9.5, 2.8], [20.5, 23, 2.8]], true)
  ;[-1, 1].forEach(function (s) {
    // yard wall, gallery → hall: one doorway onto the basin rim
    var xa = s < 0 ? -18.2 : 17.8, xb = xa + 0.4
    wallZ(xa, xb, -15.8, 10.8, HI, moss, [[-1.5, 1.5, 3.0]], true)
    // pump hall end wall, a doorway from the yard
    wallZ(xa, xb, 10.8, 23, 5.5, conc, [[15.5, 18, 2.8]], true)
    // coping on the inner walls
    t.slab(conc, xa - 0.08, HI, -15.8, xb + 0.08, HI + 0.12, 10.8)
  })
  t.slab(conc, -25, HI, -16.28, 25, HI + 0.12, -15.72)

  /* ---- team yards --------------------------------------------------------- */
  ;[-1, 1].forEach(function (s) {
    // X(-x): this yard's side (s = -1 → Blue, west)
    var X = function (x) { return -s * x }
    var team = s < 0 ? blueM : redM
    // baffle in front of the basin doorway (the spawn sits behind it)
    blk(moss, X(-21.0), 0, -4.5, X(-20.6), HI, 4.5, true)
    t.slab(conc, Math.min(X(-21.08), X(-20.52)), HI, -4.58, Math.max(X(-21.08), X(-20.52)), HI + 0.12, 4.58)
    // baffle inside the gallery doorway
    blk(moss, X(-23.2), 0, -13.4, X(-20.0), HI, -13.0, true)
    // team colour: a band round the yard and the letter on the baffle
    var xin = s < 0 ? -18.2 : 18.2, xout = s < 0 ? -25 : 25
    // (the inner band stops at the doorways)
    ;[[-15.8, -1.6], [1.6, 15.4], [18.1, 23]].forEach(function (r) { t.slab(team, Math.min(xin, xin + s * 0.02), 2.0, r[0], Math.max(xin, xin + s * 0.02), 2.35, r[1]) })
    t.slab(team, Math.min(xout, xout + s * -0.02) , 2.0, -23, Math.max(xout, xout + s * -0.02), 2.35, 23)
    t.slab(team, Math.min(X(-20.6), X(-20.58)), 0.6, -4.3, Math.max(X(-20.6), X(-20.58)), 3.4, 4.3)
    label(s < 0 ? 'BLUE' : 'RED', 0.9, X(-20.56), 2.0, 0, s < 0 ? 'x+' : 'x-', 'white', 'stencil')
    label(s < 0 ? 'YARD W' : 'YARD E', 0.45, X(-24.98), 3.0, 8, s < 0 ? 'x+' : 'x-', 'white', 'stencil')
    // yard kit at the south end (the east yard's van stands there too)
    if (s < 0) {
      place('crate_wood', -23.9, 12.8, -0.2, { seed: 35 })
      place('barrel', -24.1, 14.4, 0, { seed: 37 })
      place('barrel', -23.4, 14.8, 0, { seed: 39 })
      place('generator', -23.8, 17.4, 0, { seed: 33 })
      place('pallet_stack', -23.6, 21.8, -0.1, { seed: 43 })
    } else {
      place('barrel', 24.1, 18.2, 0, { seed: 41 })
      place('barrel', 23.4, 18.6, 0, { seed: 45 })
      place('pallet_stack', 23.6, 21.9, 0.1, { seed: 47 })
    }
    place('cable_reel', X(-20.0), 21.8, 0.3 * s, { seed: 42 + s })
    // supply zones: AMMO on the left of the yard as you face out, ARMOUR · MED on
    // the right (Blue faces east: left = north; Red faces west: left = south)
    ;[['ammo', s], ['gear', -s]].forEach(function (zd) {
      var zs = zd[1], za = zs * 5.6, zb = zs * 11.0, z0 = Math.min(za, zb), z1 = Math.max(za, zb)
      var x0 = Math.min(X(-24.4), X(-19.0)), x1 = Math.max(X(-24.4), X(-19.0)), ammo = zd[0] === 'ammo'
      var edge = ammo ? yellowM : greenM
      t.slab(edge, x0, 0.002, z0, x1, 0.008, z0 + 0.14)
      t.slab(edge, x0, 0.002, z1 - 0.14, x1, 0.008, z1)
      t.slab(edge, x0, 0.002, z0, x0 + 0.14, 0.008, z1)
      t.slab(edge, x1 - 0.14, 0.002, z0, x1, 0.008, z1)
      for (var hz = z0 + 0.6; hz < z1 - 0.3; hz += 0.9) t.box(edge, 0.7, 0.006, 0.1, (x0 + x1) / 2 + (s < 0 ? 2.1 : -2.1), 0.005, hz, { r: [0, 0.75, 0] })
      label(ammo ? 'AMMO' : 'ARMOUR · MED', ammo ? 0.7 : 0.48, (x0 + x1) / 2, 0.009, (z0 + z1) / 2, 'y+', 'white', 'stencil')
      // the sign on the outer wall and a steel rack under it
      var wx = X(-25), io = -s, face = s < 0 ? 'x+' : 'x-', zc = (z0 + z1) / 2
      t.slab(edge, Math.min(wx, wx + io * 0.07), 2.75, zc - 1.5, Math.max(wx, wx + io * 0.07), 3.55, zc + 1.5)
      label(ammo ? 'AMMO' : 'ARMOUR · MEDICAL', ammo ? 0.55 : 0.36, wx + io * 0.075, 3.15, zc, face, ammo ? 'black' : 'white', 'stencil')
      var rx0 = Math.min(wx, wx + io * 0.55), rx1 = Math.max(wx, wx + io * 0.55)
      for (var ry2 of [0.12, 0.8, 1.5]) t.slab(galv, rx0, ry2, zc - 1.4, rx1, ry2 + 0.04, zc + 1.4)
      for (var rp of [-1.4, 0, 1.4]) for (var rq of [0.03, 0.52]) t.slab(dark, Math.min(wx + io * rq - 0.025, wx + io * rq + 0.025), 0, zc + rp - 0.025, Math.max(wx + io * rq - 0.025, wx + io * rq + 0.025), 2.0, zc + rp + 0.025)
      t.col(rx0, 0, zc - 1.45, rx1, 2.0, zc + 1.45, 'metal')
      for (var bi = 0; bi < 7; bi++) {
        var bz = zc - 1.2 + bi * 0.4, by = [0.16, 0.84, 1.54][bi % 3], bx = wx + io * 0.28
        if (ammo) { t.box(M('paint_green', { color: 0x4a5a32 }), 0.32, 0.2, 0.3, bx, by + 0.1, bz, { bevel: 0.015 }); t.box(yellowM, 0.33, 0.03, 0.31, bx, by + 0.15, bz) }
        else { t.box(bi % 2 ? M('paint_green', { color: 0x2c7a43 }) : M('polymer_black'), 0.36, 0.26, 0.3, bx, by + 0.13, bz, { bevel: 0.02 }); if (bi % 2) t.box(whiteM, 0.12, 0.04, 0.31, bx, by + 0.18, bz) }
      }
    })
  })
  // the evac van in the east yard (the solo mission's way out)
  ;(function () {
    var g = new lt.Group()
    g.position.set(23.2, 0, 13.6)
    g.rotation.y = ts
    t.staticRoot.add(g)
    t.box(whiteM, 4.6, 2.0, 2.0, 0, 1.4, 0, { parent: g, bevel: 0.1 })
    t.box(dark, 1.0, 0.8, 1.9, 1.95, 1.75, 0, { parent: g })
    t.box(orangeM, 4.62, 0.25, 2.02, 0, 1.2, 0, { parent: g })
    for (var wx of [-1.5, 1.5]) for (var wz of [-0.9, 0.9]) t.cyl(tire, 0.38, 0.25, wx, 0.38, wz, { parent: g, axis: 'z', seg: 12 })
    label('EVAC', 0.6, 23.2 - 1.03, 1.6, 13.6, 'x-', 'black', 'stencil')
    rv(t, 23.2, 13.6, ts, 4.6, 2.4, 2.0, 'metal')
  })()

  /* ---- north: the pipe gallery z[-23,-16.2] ------------------------------- */
  // the pipe run along the outer wall: crouch cover the whole way
  // [height, radius, material, z]
  for (var pp of [[0.34, 0.26, rust, -22.45], [0.82, 0.22, greenM, -22.45], [0.36, 0.2, dark, -21.95]]) t.cyl(pp[2], pp[1], 49.8, 0, pp[0], pp[3], { axis: 'x', seg: 14 })
  for (var fx = -24; fx <= 24.01; fx += 3) {
    t.cyl(dark, 0.32, 0.1, fx, 0.34, -22.45, { axis: 'x', seg: 14 })
    t.cyl(dark, 0.28, 0.1, fx, 0.82, -22.45, { axis: 'x', seg: 14 })
    t.box(dark, 0.12, 1.1, 0.9, fx + 1.5, 0.55, -22.4)
  }
  t.col(-25, 0, -23, 25, 1.08, -21.7, 'metal')
  // overhead: a pipe rack on brackets off the inner wall, I-beams across to the outer wall
  for (var rx = -24; rx <= 24.01; rx += 6) {
    t.ibeam(dark, 'z', 7.2, rx, 6.75, -19.6, { depth: 0.36, width: 0.2 })
    t.box(dark, 0.22, 2.8, 0.22, rx, HI + 1.4, -16.0)
    t.box(dark, 0.12, 0.12, 1.2, rx, 4.35, -16.8)
  }
  t.cyl(galv, 0.18, 49.8, 0, 4.55, -16.75, { axis: 'x', seg: 12 })
  t.cyl(tealM, 0.14, 49.8, 0, 4.55, -17.2, { axis: 'x', seg: 12 })
  // two valve stations off the inner wall, a low block in the middle
  ;[-1, 1].forEach(function (s) {
    var x0 = s * 12.2, x1 = s * 13.9
    blk(greyM, x0, 0, -17.8, x1, 2.1, -16.2, 'metal', { bevel: 0.03 })
    t.slab(dark, Math.min(x0, x1) - 0.05, 2.1, -17.85, Math.max(x0, x1) + 0.05, 2.18, -16.2)
    t.cyl(redM, 0.32, 0.06, s * 13.05, 1.25, -17.84, { axis: 'z', seg: 16 })
    t.cyl(dark, 0.12, 0.6, s * 13.05, 1.6, -17.5, { seg: 10 })
    label('V-' + (s < 0 ? '3' : '4'), 0.3, s * 13.05, 1.85, -17.82, 'z-', 'white', 'stencil')
    place('pallet', s * 18.4, -21.2, 0.2 * s, { seed: 50 + s })
  })
  blk(conc, -1.2, 0, -20.0, 1.2, 1.0, -19.2, true, { bevel: 0.04 })
  t.slab(hazard, -1.22, 1.0, -20.02, 1.22, 1.04, -19.18)
  label('GALLERY B', 0.55, 0, 3.4, -22.98, 'z+', 'white', 'stencil')
  label('NO STANDING ON PIPES', 0.28, -8, 1.7, -22.98, 'z+', 'white', 'stencil')
  label('NO STANDING ON PIPES', 0.28, 8, 1.7, -22.98, 'z+', 'white', 'stencil')

  /* ---- middle: the settling basin x[-11,11] z[-11.5,5.5] ---------------------- */
  var TK = { x: 0, z: -3, r: 3.3, top: 7.6 }
  var fl = -BS.depth
  // the clarifier: a stepped round plinth, the tank, ring stiffeners, a ladder, a railing on top
  t.cyl(stain, 4.1, 0.85, TK.x, fl + 0.425, TK.z, { seg: 32 })
  t.cyl(conc, 3.7, 0.75, TK.x, fl + 0.85 + 0.375, TK.z, { seg: 32 })
  roundCol(TK.x, TK.z, 4.1, fl - 0.1, fl + 0.85, 'concrete', 11)
  roundCol(TK.x, TK.z, 3.7, fl + 0.85, fl + 1.6, 'concrete', 9)
  var ty0 = fl + 1.6
  t.cyl(greyM, TK.r, TK.top - ty0, TK.x, (ty0 + TK.top) / 2, TK.z, { seg: 40 })
  roundCol(TK.x, TK.z, TK.r, ty0, TK.top, 'metal', 9)
  for (var ry of [ty0 + 0.1, 2.9, 4.6, 6.3, TK.top - 0.08]) t.cyl(dark, TK.r + 0.06, 0.14, TK.x, ry, TK.z, { seg: 40 })
  for (var a0 = 0; a0 < 16; a0++) {
    var aa = (a0 / 16) * Math.PI * 2, ab = ((a0 + 1) / 16) * Math.PI * 2, rr = TK.r - 0.1
    var ax = TK.x + Math.sin(aa) * rr, az = TK.z + Math.cos(aa) * rr
    t.box(yellowM, 0.05, 1.0, 0.05, ax, TK.top + 0.5, az)
    t.rod(yellowM, [ax, TK.top + 1.0, az], [TK.x + Math.sin(ab) * rr, TK.top + 1.0, TK.z + Math.cos(ab) * rr], 0.025, { seg: 6 })
  }
  // ladder on the south side (facing the pump hall)
  for (var lr of [-0.24, 0.24]) t.box(dark, 0.05, TK.top - ty0 + 1, 0.05, TK.x + lr, (ty0 + TK.top + 1) / 2, TK.z + TK.r + 0.2)
  for (var ly = ty0 + 0.3; ly < TK.top + 0.9; ly += 0.3) t.box(dark, 0.5, 0.03, 0.03, TK.x, ly, TK.z + TK.r + 0.2)
  for (var hy = 2.6; hy < TK.top + 0.9; hy += 0.75) t.cyl(dark, 0.42, 0.04, TK.x, hy, TK.z + TK.r + 0.32, { seg: 12, open: true, rTop: 0.42 })
  // flat labels on a round shell: kept small so their ends stay close to it (the ladder side has none)
  label('CLARIFIER 2', 0.32, TK.x, 3.8, TK.z - TK.r - 0.01, 'z-', 'white', 'stencil')
  label('CLARIFIER 2', 0.32, TK.x + TK.r + 0.01, 3.8, TK.z, 'x+', 'white', 'stencil')
  label('CLARIFIER 2', 0.32, TK.x - TK.r - 0.01, 3.8, TK.z, 'x-', 'white', 'stencil')
  // the inlet: a big pipe from the tank north to the gallery wall, on H frames
  var ipY = 2.75
  t.cyl(greenM, 0.34, 15.8 + TK.z - TK.r, 0, ipY, (-15.8 + TK.z - TK.r) / 2, { axis: 'z', seg: 16 })
  for (var fz = -14.5; fz <= -7.5; fz += 2.5) t.cyl(dark, 0.44, 0.1, 0, ipY, fz, { axis: 'z', seg: 16 })
  t.col(-0.36, ipY - 0.36, -15.8, 0.36, ipY + 0.36, TK.z - TK.r, 'metal')
  for (var hz of [-13.6, -9.6]) {
    var gy = hB(0, hz)
    for (var hx of [-0.55, 0.55]) { t.box(dark, 0.14, ipY - 0.34 - gy, 0.14, hx, (gy + ipY - 0.34) / 2, hz); t.col(hx - 0.07, gy, hz - 0.07, hx + 0.07, ipY - 0.34, hz + 0.07, 'metal') }
    t.box(dark, 1.3, 0.14, 0.18, 0, ipY - 0.41, hz)
  }
  // valve boxes round the plinth (nooks to crouch in beside it)
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
    var cx = TK.x + q[0] * 3.75, cz = TK.z + q[1] * 4.1, y0 = hB(cx, cz)
    blk(stain, cx - 0.6, y0, cz - 0.55, cx + 0.6, y0 + 1.05, cz + 0.55, true, { bevel: 0.04 })
    t.slab(dark, cx - 0.5, y0 + 1.05, cz - 0.45, cx + 0.5, y0 + 1.09, cz + 0.45)
    t.cyl(yellowM, 0.22, 0.05, cx, y0 + 1.13, cz, { seg: 12 })
  })
  // pipe manifolds in the north half of the basin (crouch cover, low)
  ;[-1, 1].forEach(function (s) {
    var cx = s * 6.6, cz = -9.0, y0 = fl
    for (var sx2 of [-1.3, 1.3]) blk(conc, cx + sx2 - 0.25, y0, cz - 0.45, cx + sx2 + 0.25, y0 + 0.5, cz + 0.45, false)
    t.cyl(rust, 0.24, 3.6, cx, y0 + 0.62, cz - 0.2, { axis: 'x', seg: 12 })
    t.cyl(galv, 0.2, 3.6, cx, y0 + 0.62, cz + 0.25, { axis: 'x', seg: 12 })
    t.cyl(dark, 0.12, 0.7, cx, y0 + 1.1, cz - 0.2, { seg: 10 })
    t.cyl(redM, 0.22, 0.05, cx, y0 + 1.46, cz - 0.2, { seg: 14 })
    t.col(cx - 1.8, y0, cz - 0.5, cx + 1.8, y0 + 0.9, cz + 0.5, 'metal')
  })
  // the catwalk across the basin, 2.6 m up, south of the tank, stairs down at both ends
  var CW = { z: 2.5, y: 2.6, x: 12 }
  for (var cx2 = -CW.x + 1.5; cx2 < CW.x; cx2 += 3) t.catwalk(cx2, CW.z, 0, CW.y - 0.05, { seed: 60 + Math.round(cx2 + 12) }, [true, true])
  for (var cx3 = -CW.x + 3; cx3 <= CW.x - 2.99; cx3 += 3) {
    for (var cz3 of [CW.z - 0.62, CW.z + 0.62]) {
      var gy3 = hB(cx3, cz3)
      t.box(dark, 0.14, CW.y - 0.12 - gy3, 0.14, cx3, (gy3 + CW.y - 0.12) / 2, cz3)
      t.col(cx3 - 0.07, gy3, cz3 - 0.07, cx3 + 0.07, CW.y - 0.12, cz3 + 0.07, 'metal')
    }
    t.box(dark, 0.12, 0.12, 1.3, cx3, CW.y - 0.18, CW.z)
  }
  stairX(-CW.x - 3.0, 1, CW.z, 1.2, CW.y)
  stairX(CW.x + 3.0, -1, CW.z, 1.2, CW.y)
  // cover on the rims
  ;[-1, 1].forEach(function (s) {
    // north rim: two blocks off the gallery doorways, pallets in the corners
    blk(conc, s * 3.0, 0, -14.0, s * 5.4, 1.15, -13.2, true, { bevel: 0.04 })
    t.slab(hazard, Math.min(s * 3.0, s * 5.4) - 0.02, 1.15, -14.02, Math.max(s * 3.0, s * 5.4) + 0.02, 1.19, -13.18)
    place('pallet_stack', s * 14.4, -13.9, 0.1 * s, { seed: 70 + s })
    place('ibc_tote', s * 16.4, -9.6, 0, { seed: 72 + s })
    place('ibc_tote', s * 16.4, -11.0, 0.05 * s, { seed: 74 + s })
    // west/east rim: a low wall chunk, barrels
    blk(stain, s * 13.8, 0, -6.6, s * 14.6, 1.3, -3.4, true, { bevel: 0.04 })
    place('barrel', s * 16.6, 6.4, 0, { seed: 76 + s })
    place('barrel', s * 16.9, 7.3, 0, { seed: 78 + s })
    // south rim: a lying tank on saddles
    var lx2 = s * 13.2, lz2 = 8.2
    for (var sd of [-1.6, 1.6]) blk(conc, lx2 + sd - 0.3, 0, lz2 - 0.9, lx2 + sd + 0.3, 0.6, lz2 + 0.9, false)
    t.cyl(whiteM, 1.1, 5.0, lx2, 1.65, lz2, { axis: 'x', seg: 28 })
    for (var ex of [-2.5, 2.5]) t.cyl(whiteM, 0.9, 0.3, lx2 + ex + Math.sign(ex) * 0.15, 1.65, lz2, { axis: 'x', seg: 28, rTop: 0.6 })
    for (var bx of [-1.6, 1.6]) t.cyl(dark, 1.14, 0.12, lx2 + bx, 1.65, lz2, { axis: 'x', seg: 28 })
    label('NaOCl', 0.4, lx2, 1.75, lz2 + 1.11, 'z+', 'black', 'stencil')
    t.col(Math.min(lx2 - 2.7, lx2 + 2.7), 0, lz2 - 1.12, Math.max(lx2 - 2.7, lx2 + 2.7), 2.76, lz2 + 1.12, 'metal')
  })
  // south rim: a block before the hall's main door
  blk(conc, -1.6, 0, 7.0, 1.6, 1.1, 7.8, true, { bevel: 0.04 })
  t.slab(hazard, -1.62, 1.1, 6.98, 1.62, 1.14, 7.82)
  // relay B sits on a low plinth in the water, north of the tank
  blk(conc, -0.7, fl - 0.02, -9.3, 0.7, fl + 0.2, -7.9, true)
  // the gantry: four columns at the rim corners, girders round, beams across
  var GY = 8.4
  ;[[-16.7, -15.2], [16.7, -15.2], [-16.7, 10.2], [16.7, 10.2]].forEach(function (c) {
    t.ibeam(dark, 'y', GY, c[0], GY / 2, c[1], { depth: 0.4, width: 0.3 })
    t.col(c[0] - 0.2, 0, c[1] - 0.2, c[0] + 0.2, GY, c[1] + 0.2, 'metal')
    t.slab(conc, c[0] - 0.4, 0, c[1] - 0.4, c[0] + 0.4, 0.25, c[1] + 0.4)
  })
  t.ibeam(dark, 'x', 33.8, 0, GY, -15.2, { depth: 0.5, width: 0.26 })
  t.ibeam(dark, 'x', 33.8, 0, GY, 10.2, { depth: 0.5, width: 0.26 })
  for (var gx of [-16.7, -8.4, 0, 8.4, 16.7]) t.ibeam(dark, 'z', 25.8, gx, GY + 0.36, -2.5, { depth: 0.32, width: 0.2 })
  // a crane rail with a trolley parked over the north manifolds
  t.ibeam(yellowM, 'x', 33.4, 0, GY - 0.45, -9.0, { depth: 0.36, width: 0.22 })
  t.box(yellowM, 1.2, 0.6, 0.9, -6.6, GY - 1.0, -9.0, { bevel: 0.04 })
  t.rod(dark, [-6.6, GY - 1.3, -9.0], [-6.6, 3.0, -9.0], 0.02, { seg: 5 })
  t.box(dark, 0.3, 0.3, 0.3, -6.6, 2.85, -9.0)
  label('DANGER — SLUDGE', 0.32, -10.6, 1.4, -15.78, 'z+', 'black', 'sans')
  label('DANGER — SLUDGE', 0.32, 10.6, 1.4, -15.78, 'z+', 'black', 'sans')

  /* ---- south: the pump hall x[-17.8,17.8] z[11.2,23] ----------------------- */
  var HH = 5.5
  wallX(10.8, 11.2, -17.8, 17.8, HH, conc, [[-10, -7.5, 2.8], [-1.75, 1.75, 3.2], [7.5, 10, 2.8]], true)
  ;[[-17.8, -10], [-7.5, -1.75], [1.75, 7.5], [10, 17.8]].forEach(function (r) { t.slab(stain, r[0], 0, 10.76, r[1], 1.0, 10.8) })
  label('PUMP HALL', 0.6, 0, 4.2, 10.77, 'z-', 'white', 'stencil')
  label('PUMP HALL', 0.6, 0, 4.2, 11.23, 'z+', 'white', 'stencil')
  // roof: corrugated, three skylights; one collider (tag roof: off the minimap)
  var RY = HH
  var sk = [[-13, -7], [-3, 3], [7, 13]], skz = [14.2, 19.8]
  t.slab(roofM, -18.3, RY, 10.7, 18.3, RY + 0.22, skz[0])
  t.slab(roofM, -18.3, RY, skz[1], 18.3, RY + 0.22, 23.7)
  var at2 = -18.3
  sk.forEach(function (o) { t.slab(roofM, at2, RY, skz[0], o[0], RY + 0.22, skz[1]); t.slab(glass, o[0], RY + 0.1, skz[0], o[1], RY + 0.14, skz[1]); at2 = o[1] })
  t.slab(roofM, at2, RY, skz[0], 18.3, RY + 0.22, skz[1])
  i.physics.addBox([-18.3, RY, 10.7], [18.3, RY + 0.22, 23.7], { surface: 'metal', tag: 'roof' })
  for (var tx = -16; tx <= 16.01; tx += 4) t.ibeam(dark, 'z', 12.2, tx, RY - 0.2, 16.9, { depth: 0.36, width: 0.18 })
  // lamps under the trusses
  for (var lx3 of [-14, -6, 6, 14]) for (var lz3 of [13.0, 21.0]) {
    t.box(dark, 1.3, 0.1, 0.3, lx3, RY - 0.5, lz3)
    t.box(glow, 1.15, 0.04, 0.22, lx3, RY - 0.56, lz3)
    t.rod(dark, [lx3, RY - 0.45, lz3], [lx3, RY - 0.2, lz3], 0.012, { seg: 4 })
  }
  // three pump units on plinths, their risers and the header along the south wall
  ;[-9, 0, 9].forEach(function (x, k) {
    var z = 16.8
    blk(conc, x - 1.7, 0, z - 1.15, x + 1.7, 0.3, z + 1.15, true, { bevel: 0.03 })
    t.box(tealM, 1.6, 1.1, 1.0, x - 0.55, 0.85, z, { bevel: 0.05 })
    t.cyl(tealM, 0.5, 1.5, x - 0.55, 0.9, z, { axis: 'x', seg: 18 })
    for (var fn = -0.6; fn <= 0.61; fn += 0.15) t.cyl(dark, 0.53, 0.03, x - 0.55 + fn, 0.9, z, { axis: 'x', seg: 18 })
    t.cyl(blueM, 0.62, 0.7, x + 0.95, 0.95, z, { axis: 'z', seg: 22 })
    t.cyl(blueM, 0.24, 0.9, x + 0.95, 0.95, z + 0.75, { axis: 'z', seg: 12 })
    t.cyl(galv, 0.24, 3.0, x + 0.95, 2.95, z + 1.1, { seg: 14 })
    t.cyl(galv, 0.24, 3.8, x + 0.95, 4.3, z + 3.0, { axis: 'z', seg: 14 })
    t.cyl(redM, 0.28, 0.06, x + 0.95, 2.1, z + 1.1, { seg: 14 })
    label('P-' + (k + 1), 0.4, x - 0.55, 1.15, z + 0.52, 'z+', 'white', 'stencil')
    t.col(x - 1.45, 0.3, z - 0.75, x + 1.6, 1.62, z + 0.75, 'metal')
    t.col(x + 0.7, 0.3, z + 0.75, x + 1.2, 4.55, z + 1.35, 'metal')
  })
  t.cyl(galv, 0.32, 35.4, 0, 4.3, 22.3, { axis: 'x', seg: 16 })
  for (var bx2 = -16; bx2 <= 16.01; bx2 += 4) t.box(dark, 0.12, 1.2, 0.9, bx2, 4.9, 22.55)
  // cabinets along the south wall, crates by the side doors
  ;[-1, 1].forEach(function (s) {
    for (var cx4 of [4.6, 13.2]) {
      blk(greyM, s * cx4 - 0.7, 0, 22.25, s * cx4 + 0.7, 2.1, 22.95, 'metal', { bevel: 0.025 })
      t.slab(dark, s * cx4 - 0.02, 0.2, 22.22, s * cx4 + 0.02, 1.9, 22.25)
      t.box(glowCool, 0.08, 0.05, 0.02, s * cx4 + 0.4, 1.8, 22.22)
    }
    place('crate_stack', s * 15.9, 12.7, 0.08 * s, { seed: 80 + s })
    place('crate_wood', s * 16.4, 21.0, -0.15 * s, { seed: 82 + s })
    place('pallet_stack', s * 4.4, 12.6, 0.06, { seed: 84 + s })
  })
  var hallInside = [{ min: V(-17.8, 0, 11.2), max: V(17.8, HH, 23) }]

  /* ==== DETAIL PASS ========================================================
   * Everything below is visual (thin, close to the surfaces, no colliders):
   * board-formed concrete (panel joints, tie holes), moss and grime at the
   * wall feet, streaks under the copings, razor-wire fences on the perimeter,
   * sawcut floor joints, trench drains, oil stains, the clarifier's seams,
   * manways, nozzles and its rake bridge, gantry bracing, cable trays,
   * caged wall lamps, pump trim (couplings, gauges, handwheels), real roof
   * trusses, wainscot inside the hall. Merged per material with the rest. */
  var jointM = M('concrete', { color: 0x80857d }), holeM = M('concrete', { color: 0x3b3e3a })
  var mossM = M('concrete_dirty', { color: 0x6c7a55 }), mossDk = M('concrete_dirty', { color: 0x4f5a40 })
  var chain = M('chainlink'), wainM = M('paint_green', { color: 0x46564a }), boltM = M('steel_worn')
  // a thin box on a wall face: the face lies at (axis 'z': z = c | axis 'x': x = c),
  // u runs along the face (x | z), nrm = the face's outward side (+1 / -1)
  function faceBox(axis, c, nrm, u0, u1, y0, y1, depth, mat, off) {
    var d0 = c + nrm * (off || 0), d1 = d0 + nrm * depth
    if (axis === 'z') t.slab(mat, Math.min(u0, u1), y0, Math.min(d0, d1), Math.max(u0, u1), y1, Math.max(d0, d1))
    else t.slab(mat, Math.min(d0, d1), y0, Math.min(u0, u1), Math.max(d0, d1), y1, Math.max(u0, u1))
  }
  function inOpen(u, y, skips) {
    for (var k = 0; k < (skips || []).length; k++) { var o = skips[k]; if (u > o[0] - 0.08 && u < o[1] + 0.08 && y < o[2] + 0.1) return true }
    return false
  }
  function faceName(axis, nrm) { return axis + (nrm > 0 ? '+' : '-') }
  // board-formed concrete: 2.4 × 1.2 m panels, four tie holes each
  function formwork(axis, c, nrm, a0, a1, h, skips, off) {
    off = off || 0
    for (var y = 1.2; y < h - 0.15; y += 1.2) {
      var cuts = (skips || []).filter(function (o) { return y < o[2] + 0.1 }).sort(function (p, q) { return p[0] - q[0] }), at = a0
      cuts.forEach(function (o) { if (o[0] - 0.1 > at) faceBox(axis, c, nrm, at, o[0] - 0.1, y - 0.012, y + 0.012, 0.008, jointM, off); at = Math.max(at, o[1] + 0.1) })
      if (at < a1) faceBox(axis, c, nrm, at, a1, y - 0.012, y + 0.012, 0.008, jointM, off)
    }
    for (var u = a0 + 2.4; u < a1 - 0.2; u += 2.4) {
      var y0 = 0.02
      for (var k = 0; k < (skips || []).length; k++) { var o = skips[k]; if (u > o[0] - 0.1 && u < o[1] + 0.1) y0 = Math.max(y0, o[2] + 0.1) }
      if (y0 < h - 0.1) faceBox(axis, c, nrm, u - 0.012, u + 0.012, y0, h - 0.05, 0.008, jointM, off)
    }
    for (var u2 = a0 + 0.6; u2 < a1 - 0.3; u2 += 1.2) for (var y2 = 0.3; y2 < h - 0.2; y2 += 0.6) {
      if (inOpen(u2, y2, skips)) continue
      faceBox(axis, c, nrm, u2 - 0.035, u2 + 0.035, y2 - 0.035, y2 + 0.035, 0.012, holeM, off)
    }
  }
  // moss and wet grime along a wall foot: irregular patches
  function mossFoot(axis, c, nrm, a0, a1, skips, hmax, off) {
    var u = a0
    while (u < a1) {
      var w = 0.5 + rnd() * 2.4, u1 = Math.min(a1, u + w), hh = 0.1 + rnd() * (hmax || 0.55)
      if (!inOpen((u + u1) / 2, 0, skips) && !inOpen(u, 0, skips) && !inOpen(u1, 0, skips)) {
        faceBox(axis, c, nrm, u, u1, 0, hh, 0.006, rnd() < 0.5 ? mossM : mossDk, off)
        if (rnd() < 0.45) faceBox(axis, c, nrm, u + w * 0.2, u + w * 0.2 + 0.3 + rnd() * 0.5, hh, hh + 0.15 + rnd() * 0.35, 0.007, mossDk, off)
      }
      u = u1 + rnd() * 1.2
    }
  }
  // grime streaks under a coping, rust runs, leak stains (the game's decals)
  function streaks(axis, c, nrm, a0, a1, top, n, skips, off) {
    for (var k = 0; k < n; k++) {
      var u = a0 + 0.5 + rnd() * (a1 - a0 - 1), sz = 0.9 + rnd() * 1.4, y = top - sz * 0.75
      if (inOpen(u, y, skips)) continue
      var nm = rnd() < 0.6 ? 'grime_streak' : rnd() < 0.5 ? 'rust_run' : 'leak_stain'
      var d = c + nrm * ((off || 0) + 0.014)
      try { axis === 'z' ? t.decal(nm, sz, u, y, d, faceName(axis, nrm)) : t.decal(nm, sz, d, y, u, faceName(axis, nrm)) } catch (e) { }
    }
  }
  function wallDress(axis, c, nrm, a0, a1, h, skips, off, nStreak) {
    formwork(axis, c, nrm, a0, a1, h, skips, off)
    mossFoot(axis, c, nrm, a0, a1, skips, 0.6, off)
    streaks(axis, c, nrm, a0, a1, h - 0.1, nStreak == null ? Math.round((a1 - a0) / 4) : nStreak, skips, off)
  }

  /* -- walls ------------------------------------------------------------- */
  // perimeter (in front of the plinth band: off 0.04); the hall's stretch of
  // the south wall is dressed inside the hall below
  wallDress('z', -23, 1, -25, 25, H0, [], 0.04)
  wallDress('z', 23, -1, -25, -18.2, H0, [], 0.04)
  wallDress('z', 23, -1, 18.2, 25, H0, [], 0.04)
  formwork('z', 23, -1, -18.2, 18.2, H0, [[-18.2, 18.2, HH + 0.25]], 0.04) // above the hall roof
  wallDress('x', -25, 1, -23, 23, H0, [], 0.04)
  wallDress('x', 25, -1, -23, 23, H0, [], 0.04)
  // the gallery wall, both faces
  var gOpen = [[-23, -20.5, 2.8], [-9.5, -7, 2.8], [7, 9.5, 2.8], [20.5, 23, 2.8]]
  wallDress('z', -16.2, -1, -25, 25, HI, gOpen)
  wallDress('z', -15.8, 1, -17.8, 17.8, HI, gOpen)
  ;[-1, 1].forEach(function (s) {
    var yard = s < 0 ? -18.2 : 18.2, rim = s < 0 ? -17.8 : 17.8, io = s < 0 ? -1 : 1
    // gallery wall seen from inside the yards
    wallDress('z', -15.8, 1, s < 0 ? -25 : 18.2, s < 0 ? -18.2 : 25, HI, [s < 0 ? [-23, -20.5, 2.8] : [20.5, 23, 2.8]])
    // the yard wall: yard face, basin face; the hall end wall, yard face
    wallDress('x', yard, io, -15.8, 10.8, HI, [[-1.5, 1.5, 3.0]])
    wallDress('x', rim, -io, -15.8, 10.8, HI, [[-1.5, 1.5, 3.0]])
    wallDress('x', yard, io, 10.8, 23, HH, [[15.5, 18, 2.8]])
    // baffles
    formwork('x', s * 21.0, s, -4.5, 4.5, HI, [])
    formwork('x', s * 20.6, -s, -4.5, 4.5, HI, [[-4.3, 4.3, 3.45]])
    mossFoot('x', s * 21.0, s, -4.5, 4.5, [], 0.5)
    formwork('z', -13.4, -1, Math.min(s * 23.2, s * 20.0), Math.max(s * 23.2, s * 20.0), HI, [])
    formwork('z', -13.0, 1, Math.min(s * 23.2, s * 20.0), Math.max(s * 23.2, s * 20.0), HI, [])
  })
  // the hall's north wall, basin side
  var hOpen = [[-10, -7.5, 2.8], [-1.75, 1.75, 3.2], [7.5, 10, 2.8]]
  wallDress('z', 10.8, -1, -17.8, 17.8, HH, hOpen)

  /* -- perimeter tops: posts, chain-link, razor wire leaning out ----------- */
  ;[['z', -23.3, -1, -25.6, 25.6], ['z', 23.3, 1, -25.6, 25.6], ['x', -25.3, -1, -23.6, 23.6], ['x', 25.3, 1, -23.6, 23.6]].forEach(function (w) {
    var axis = w[0], c = w[1], out = w[2], a0 = w[3], a1 = w[4], y0 = H0 + 0.25
    var P3 = function (u, y, o) { return axis === 'z' ? [u, y, c + out * (o || 0)] : [c + out * (o || 0), y, u] }
    for (var u = a0 + 0.1; u <= a1 + 0.01; u += 3) {
      var q = P3(u, y0 + 0.9)
      t.box(galv, 0.07, 1.8, 0.07, q[0], q[1], q[2])
      t.rod(galv, P3(u, y0 + 1.8), P3(u, y0 + 2.25, 0.42), 0.025, { seg: 5 })
    }
    if (axis === 'z') t.slab(chain, a0, y0 + 0.05, c - 0.006, a1, y0 + 1.75, c + 0.006)
    else t.slab(chain, c - 0.006, y0 + 0.05, a0, c + 0.006, y0 + 1.75, a1)
    for (var k = 0; k < 3; k++) t.rod(dark, P3(a0, y0 + 1.86 + k * 0.13, 0.12 + k * 0.13), P3(a1, y0 + 1.86 + k * 0.13, 0.12 + k * 0.13), 0.008, { seg: 4 })
    // coiled razor wire: a helix along the top of the posts
    var pts = [], L = a1 - a0, turns = Math.round(L / 0.35)
    for (var i2 = 0; i2 <= turns * 8; i2++) {
      var f = i2 / (turns * 8), ang = f * turns * Math.PI * 2
      var p = P3(a0 + f * L, y0 + 2.0 + Math.sin(ang) * 0.22, 0.25 + Math.cos(ang) * 0.22)
      pts.push(new lt.Vector3(p[0], p[1], p[2]))
    }
    try { t.add(new lt.TubeGeometry(new lt.CatmullRomCurve3(pts), pts.length, 0.009, 4, false), galv) } catch (e) { }
  })

  /* -- floor: sawcut joints every 3 m, stains, manholes, trench drains ------- */
  var cutM = M('concrete', { color: 0x4a4e49 })
  var inBasin = function (x, z) { return x > BS.x0 - 0.4 && x < BS.x1 + 0.4 && z > BS.z0 - 0.4 && z < BS.z1 + 0.4 }
  var inHall = function (x, z) { return x > -18.2 && x < 18.2 && z > 10.8 }
  for (var gz = -21; gz <= 22; gz += 3) {
    var x = -24.9
    while (x < 24.9) {
      var xe = Math.min(24.9, x + 0.5)
      if (!inBasin((x + xe) / 2, gz) && !inHall((x + xe) / 2, gz)) {
        var xs = x
        while (xe < 24.9 && !inBasin(xe + 0.25, gz) && !inHall(xe + 0.25, gz)) xe = Math.min(24.9, xe + 0.5)
        t.slab(cutM, xs, 0, gz - 0.012, xe, 0.003, gz + 0.012)
        x = xe
      }
      x += 0.5
    }
  }
  for (var gx2 = -24; gx2 <= 24; gx2 += 3) {
    var z = -22.9
    while (z < 22.9) {
      var ze = Math.min(22.9, z + 0.5)
      if (!inBasin(gx2, (z + ze) / 2) && !inHall(gx2, (z + ze) / 2)) {
        var zs = z
        while (ze < 22.9 && !inBasin(gx2, ze + 0.25) && !inHall(gx2, ze + 0.25)) ze = Math.min(22.9, ze + 0.5)
        t.slab(cutM, gx2 - 0.012, 0, zs, gx2 + 0.012, 0.003, ze)
        z = ze
      }
      z += 0.5
    }
  }
  // oil and water stains
  for (var k1 = 0; k1 < 34; k1++) {
    var sx3 = -24 + rnd() * 48, sz3 = -22.5 + rnd() * 45
    if (inBasin(sx3, sz3)) continue
    try { t.decal('scorch', 0.8 + rnd() * 1.6, sx3, 0.006 + k1 * 0.0002, sz3, 'y+', rnd() * 6.28) } catch (e) { }
  }
  // manholes
  ;[[-21.6, -14.5], [20.6, 17.0], [-16.8, 9.9], [11.6, -14.6], [0, -18.4]].forEach(function (m) {
    t.cyl(dark, 0.42, 0.03, m[0], 0.006, m[1], { seg: 20 })
    t.cyl(boltM, 0.36, 0.035, m[0], 0.01, m[1], { seg: 20 })
    for (var r3 = -0.25; r3 <= 0.26; r3 += 0.125) t.slab(dark, m[0] - 0.3, 0.025, m[1] + r3 - 0.015, m[0] + 0.3, 0.032, m[1] + r3 + 0.015)
  })
  // trench drain along the gallery (inside the pipe run) and round the basin's north rim
  function trench(x0, z0, x1, z1) {
    t.slab(dark, x0, -0.005, z0, x1, 0.002, z1)
    var alongX = x1 - x0 > z1 - z0
    if (alongX) for (var u = x0 + 0.04; u < x1; u += 0.07) t.slab(galv, u - 0.012, 0.002, z0 + 0.01, u + 0.012, 0.012, z1 - 0.01)
    else for (var v = z0 + 0.04; v < z1; v += 0.07) t.slab(galv, x0 + 0.01, 0.002, v - 0.012, x1 - 0.01, 0.012, v + 0.012)
    if (alongX) { t.slab(galv, x0, 0.002, z0, x1, 0.014, z0 + 0.02); t.slab(galv, x0, 0.002, z1 - 0.02, x1, 0.014, z1) }
    else { t.slab(galv, x0, 0.002, z0, x0 + 0.02, 0.014, z1); t.slab(galv, x1 - 0.02, 0.002, z0, x1, 0.014, z1) }
  }
  trench(-24.6, -21.45, 24.6, -21.15)
  trench(BS.x0 - 0.9, BS.z0 - 0.95, BS.x1 + 0.9, BS.z0 - 0.65)
  // painted marks: spawn chevrons in the team colour, walk arrows in the gallery
  ;[-1, 1].forEach(function (s) {
    var team = s < 0 ? blueM : redM
    // the spawn pocket behind the baffle: team chevrons pointing out
    for (var k2 = 0; k2 < 3; k2++) {
      var cz = -1.2 + k2 * 1.2
      t.box(team, 0.8, 0.006, 0.18, s * 23.0, 0.004, cz - 0.3, { r: [0, -s * 0.7, 0] })
      t.box(team, 0.8, 0.006, 0.18, s * 23.0, 0.004, cz + 0.3, { r: [0, s * 0.7, 0] })
    }
  })
  for (var bay = 0; bay < 8; bay++) {
    var bxp = -21 + bay * 6
    label('B-0' + (bay + 1), 0.3, bxp, 2.05, -22.95, 'z+', 'black', 'stencil')
    t.slab(yellowM, bxp - 0.85, 1.85, -22.96, bxp + 0.85, 2.25, -22.952)
  }

  /* -- gallery: cable tray, conduits, caged lamps, hose cabinets, valves -- */
  t.slab(galv, -24.9, 3.25, -16.62, 24.9, 3.3, -16.2)
  t.slab(galv, -24.9, 3.25, -16.64, 24.9, 3.42, -16.6)
  for (var cb = 0; cb < 4; cb++) t.cyl(cb % 2 ? dark : M('polymer_black'), 0.028, 49.6, 0, 3.33, -16.55 + cb * 0.075, { axis: 'x', seg: 6 })
  for (var tb = -24; tb <= 24; tb += 1.5) t.box(dark, 0.05, 0.3, 0.42, tb, 3.12, -16.41)
  ;[-1, 1].forEach(function (s) {
    // hose cabinet + fire point sign on the inner wall
    blk(redM, s * 4.0, 0.9, -16.42, s * 5.0, 1.9, -16.2, false, { bevel: 0.02 })
    t.slab(whiteM, Math.min(s * 4.1, s * 4.9), 1.65, -16.43, Math.max(s * 4.1, s * 4.9), 1.8, -16.42)
    label('FIRE HOSE', 0.12, s * 4.5, 1.72, -16.435, 'z-', 'red', 'sans')
    // handwheel valves on the pipe run
    for (var vx of [6, 18]) {
      t.cyl(dark, 0.06, 0.5, s * vx, 1.25, -22.45, { seg: 8 })
      try { t.add(new lt.TorusGeometry(0.2, 0.022, 6, 18).rotateX(Math.PI / 2), redM, { p: [s * vx, 1.52, -22.45] }) } catch (e) { }
      t.cyl(redM, 0.2, 0.02, s * vx, 1.52, -22.45, { seg: 18, open: true })
      t.box(dark, 0.42, 0.02, 0.03, s * vx, 1.52, -22.45)
      t.box(dark, 0.03, 0.02, 0.42, s * vx, 1.52, -22.45)
    }
  })
  // caged wall lamps (gallery, yards, basin face of the hall)
  function cagedLamp(x, y, z, face) {
    var n = face === 'z+' ? [0, 1] : face === 'z-' ? [0, -1] : face === 'x+' ? [1, 0] : [-1, 0]
    var bx = x + n[0] * 0.08, bz = z + n[1] * 0.08
    t.box(dark, n[0] ? 0.16 : 0.5, 0.2, n[1] ? 0.16 : 0.5, bx, y, bz, { bevel: 0.02 })
    t.box(glowCool, n[0] ? 0.08 : 0.42, 0.1, n[1] ? 0.08 : 0.42, x + n[0] * 0.17, y - 0.02, z + n[1] * 0.17)
    for (var k = -1; k <= 1; k++) {
      var ax = x + n[0] * 0.22 + (n[1] ? k * 0.2 : 0), az = z + n[1] * 0.22 + (n[0] ? k * 0.2 : 0)
      t.box(dark, n[0] ? 0.012 : 0.012, 0.16, n[1] ? 0.012 : 0.012, ax, y - 0.02, az)
    }
    t.box(dark, n[0] ? 0.012 : 0.5, 0.012, n[1] ? 0.012 : 0.5, x + n[0] * 0.22, y + 0.06, z + n[1] * 0.22)
    t.box(dark, n[0] ? 0.012 : 0.5, 0.012, n[1] ? 0.012 : 0.5, x + n[0] * 0.22, y - 0.1, z + n[1] * 0.22)
  }
  for (var lx4 = -21; lx4 <= 21.01; lx4 += 7) cagedLamp(lx4, 5.5, -23 + 0.0, 'z+')
  ;[-1, 1].forEach(function (s) {
    for (var lz4 of [-12, -6, 6, 13, 20]) cagedLamp(s * 25, 3.6, lz4, s < 0 ? 'x+' : 'x-')
    cagedLamp(s * 12.5, 4.4, 10.8, 'z-')
  })

  /* -- the clarifier: weld seams, plinth bolts, manways, nozzles, the bridge -- */
  for (var sa = 0; sa < 24; sa++) {
    var aS = (sa / 24) * Math.PI * 2 + 0.07
    if (Math.abs(Math.sin(aS)) < 0.12 && Math.cos(aS) > 0) continue // the ladder
    t.box(dark, 0.025, TK.top - ty0 - 0.2, 0.03, TK.x + Math.sin(aS) * (TK.r + 0.01), (ty0 + TK.top) / 2, TK.z + Math.cos(aS) * (TK.r + 0.01), { r: [0, aS, 0] })
  }
  for (var ba = 0; ba < 32; ba++) {
    var aB = (ba / 32) * Math.PI * 2
    t.cyl(boltM, 0.03, 0.06, TK.x + Math.sin(aB) * (TK.r + 0.16), ty0 + 0.03, TK.z + Math.cos(aB) * (TK.r + 0.16), { seg: 6 })
  }
  t.cyl(yellowM, 3.72, 0.04, TK.x, fl + 1.6, TK.z, { seg: 40, open: true })
  t.cyl(yellowM, 4.12, 0.04, TK.x, fl + 0.85, TK.z, { seg: 40, open: true })
  ;[-1, 1].forEach(function (s) {
    // manway: flange, cover, bolt ring, davit arm
    var mx = TK.x + s * (TK.r + 0.07), my = 2.45
    t.cyl(greyM, 0.46, 0.16, mx, my, TK.z, { axis: 'x', seg: 24 })
    t.cyl(galv, 0.4, 0.06, mx + s * 0.1, my, TK.z, { axis: 'x', seg: 24 })
    for (var bb = 0; bb < 12; bb++) { var a3 = (bb / 12) * Math.PI * 2; t.cyl(boltM, 0.022, 0.05, mx + s * 0.14, my + Math.sin(a3) * 0.36, TK.z + Math.cos(a3) * 0.36, { axis: 'x', seg: 6 }) }
    t.rod(dark, [mx + s * 0.05, my - 0.55, TK.z + 0.5], [mx + s * 0.05, my + 0.6, TK.z + 0.5], 0.03, { seg: 6 })
    t.rod(dark, [mx + s * 0.05, my + 0.6, TK.z + 0.5], [mx + s * 0.18, my + 0.6, TK.z], 0.03, { seg: 6 })
    // nozzle with a flange and a valve, low on the shell toward the valve pits
    var aN = s * 0.75, nx = TK.x + Math.sin(aN) * TK.r, nz = TK.z + Math.cos(aN) * TK.r, ny = ty0 + 0.7
    var ox = Math.sin(aN), oz = Math.cos(aN)
    t.rod(greyM, [nx, ny, nz], [nx + ox * 0.6, ny, nz + oz * 0.6], 0.16, { seg: 12 })
    t.rod(dark, [nx + ox * 0.55, ny, nz + oz * 0.55], [nx + ox * 0.66, ny, nz + oz * 0.66], 0.24, { seg: 14 })
    t.rod(blueM, [nx + ox * 0.66, ny, nz + oz * 0.66], [nx + ox * 0.95, ny, nz + oz * 0.95], 0.2, { seg: 12 })
    t.rod(dark, [nx + ox * 0.8, ny + 0.2, nz + oz * 0.8], [nx + ox * 0.8, ny + 0.5, nz + oz * 0.8], 0.03, { seg: 6 })
    try { t.add(new lt.TorusGeometry(0.16, 0.018, 6, 16).rotateX(Math.PI / 2), redM, { p: [nx + ox * 0.8, ny + 0.5, nz + oz * 0.8] }) } catch (e) { }
  })
  ;(function () { // level gauge: a graduated strip on the north-east
    var aG = 2.3, gx3 = TK.x + Math.sin(aG) * (TK.r + 0.04), gz3 = TK.z + Math.cos(aG) * (TK.r + 0.04)
    t.box(whiteM, 0.12, 4.6, 0.03, gx3, ty0 + 2.9, gz3, { r: [0, aG, 0] })
    for (var gy4 = ty0 + 0.8; gy4 < ty0 + 5.1; gy4 += 0.25) t.box(M('polymer_black'), 0.13, 0.03, 0.035, gx3, gy4, gz3, { r: [0, aG, 0] })
  })()
  // the inlet meets the shell with a flange
  t.cyl(dark, 0.46, 0.12, 0, ipY, TK.z - TK.r - 0.04, { axis: 'z', seg: 18 })
  t.cyl(dark, 0.46, 0.12, 0, ipY, -15.86, { axis: 'z', seg: 18 })
  // the rake bridge across the top: walkway from the ladder to the centre drive
  var BY = TK.top + 0.05
  t.slab(plate, -0.45, BY, TK.z, 0.45, BY + 0.05, TK.z + TK.r + 0.1)
  for (var s4 of [-1, 1]) {
    t.slab(dark, s4 * 0.45 - 0.05, BY - 0.22, TK.z - 0.2, s4 * 0.45 + 0.05, BY + 0.03, TK.z + TK.r + 0.15)
    for (var rz = TK.z + 0.2; rz <= TK.z + TK.r + 0.12; rz += 0.8) t.box(yellowM, 0.04, 1.0, 0.04, s4 * 0.5, BY + 0.55, rz)
    t.rod(yellowM, [s4 * 0.5, BY + 1.05, TK.z + 0.2], [s4 * 0.5, BY + 1.05, TK.z + TK.r + 0.1], 0.022, { seg: 6 })
    t.rod(yellowM, [s4 * 0.5, BY + 0.55, TK.z + 0.2], [s4 * 0.5, BY + 0.55, TK.z + TK.r + 0.1], 0.016, { seg: 6 })
  }
  t.cyl(tealM, 0.75, 0.6, TK.x, BY + 0.35, TK.z, { seg: 20 })
  t.box(tealM, 0.7, 0.55, 0.9, TK.x + 0.65, BY + 0.55, TK.z, { bevel: 0.03 })
  t.cyl(greyM, 0.26, 0.7, TK.x + 0.65, BY + 0.55, TK.z - 0.75, { axis: 'z', seg: 14 })
  t.cyl(dark, 0.95, 0.12, TK.x, BY + 0.05, TK.z, { seg: 20 })

  /* -- gantry: knee braces, base plates, hanging floodlights -------------- */
  ;[[-16.7, -15.2, 1, 1], [16.7, -15.2, -1, 1], [-16.7, 10.2, 1, -1], [16.7, 10.2, -1, -1]].forEach(function (c) {
    t.rod(dark, [c[0], GY - 1.6, c[1]], [c[0] + c[2] * 1.6, GY - 0.2, c[1]], 0.06, { seg: 6 })
    t.rod(dark, [c[0], GY - 1.6, c[1]], [c[0], GY - 0.2, c[1] + c[3] * 1.6], 0.06, { seg: 6 })
    t.slab(boltM, c[0] - 0.32, 0.25, c[1] - 0.32, c[0] + 0.32, 0.29, c[1] + 0.32)
    for (var q2 of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) t.cyl(boltM, 0.03, 0.08, c[0] + q2[0] * 0.24, 0.31, c[1] + q2[1] * 0.24, { seg: 6 })
  })
  for (var fx2 of [-8.4, 8.4]) for (var fz2 of [-12.5, 6.5]) {
    t.box(dark, 0.5, 0.3, 0.4, fx2, GY + 0.0, fz2, { bevel: 0.03 })
    t.box(glow, 0.42, 0.04, 0.32, fx2, GY - 0.16, fz2)
    t.rod(dark, [fx2, GY + 0.15, fz2], [fx2, GY + 0.36, fz2], 0.02, { seg: 4 })
  }
  // crane: hook block on the trolley's rope
  t.cyl(yellowM, 0.18, 0.4, -6.6, 2.75, -9.0, { axis: 'z', seg: 12 })
  try { t.add(new lt.TorusGeometry(0.12, 0.035, 6, 14, Math.PI * 1.4).rotateZ(Math.PI * 0.8), dark, { p: [-6.6, 2.45, -9.0] }) } catch (e) { }

  /* -- the basin: floating debris ------------------------------------------ */
  var wy = BS.water + 0.005
  t.box(wood, 1.3, 0.05, 0.16, 7.8, wy, -1.2, { r: [0, 0.6, 0] })
  t.box(wood, 0.9, 0.05, 0.14, -8.4, wy, 1.4, { r: [0, -0.3, 0] })
  t.box(M('plastic_blue'), 0.5, 0.06, 0.35, 5.2, wy, 3.0, { r: [0, 1.1, 0] })
  t.cyl(M('steel_rust'), 0.3, 0.88, -7.0, fl + 0.3, -3.6, { axis: 'z', seg: 14, r: [0, 0.5, 0] })
  place('traffic_cone', 8.8, -5.2, 0.4, { seed: 91 }, fl)

  /* -- pump hall: wainscot, trusses, pump trim, floor paint, hangers --------- */
  var hallFaces = [['z', 23, -1, -17.8, 17.8, []], ['z', 11.2, 1, -17.8, 17.8, hOpen], ['x', -17.8, 1, 11.2, 23, [[15.5, 18, 2.8]]], ['x', 17.8, -1, 11.2, 23, [[15.5, 18, 2.8]]]]
  hallFaces.forEach(function (f) {
    var cuts = (f[5] || []).slice().sort(function (a, b) { return a[0] - b[0] }), at = f[3]
    cuts.forEach(function (o) { if (o[0] > at) { faceBox(f[0], f[1], f[2], at, o[0], 0, 1.2, 0.01, wainM); faceBox(f[0], f[1], f[2], at, o[0], 1.2, 1.3, 0.012, yellowM) } at = o[1] })
    if (at < f[4]) { faceBox(f[0], f[1], f[2], at, f[4], 0, 1.2, 0.01, wainM); faceBox(f[0], f[1], f[2], at, f[4], 1.2, 1.3, 0.012, yellowM) }
    formwork(f[0], f[1], f[2], f[3], f[4], HH, f[5].concat([[f[3] - 1, f[4] + 1, 1.3]]))
  })
  // trusses: a bottom chord under each top beam, diagonals between
  // (the bottom chords stop short of the header pipe along the south wall)
  for (var tx2 = -16; tx2 <= 16.01; tx2 += 4) {
    t.ibeam(dark, 'z', 10.7, tx2, RY - 1.05, 16.55, { depth: 0.2, width: 0.14 })
    for (var dz2 = 11.2; dz2 < 21.0; dz2 += 1.5) {
      t.rod(dark, [tx2, RY - 1.0, dz2], [tx2, RY - 0.38, dz2 + 0.75], 0.03, { seg: 5 })
      t.rod(dark, [tx2, RY - 0.38, dz2 + 0.75], [tx2, RY - 1.0, dz2 + 1.5], 0.03, { seg: 5 })
    }
  }
  // skylight muntins
  sk.forEach(function (o) {
    for (var mx2 = o[0]; mx2 <= o[1] + 0.01; mx2 += 1.5) t.slab(dark, mx2 - 0.03, RY + 0.08, skz[0], mx2 + 0.03, RY + 0.2, skz[1])
    for (var mz2 of [skz[0], (skz[0] + skz[1]) / 2, skz[1]]) t.slab(dark, o[0], RY + 0.08, mz2 - 0.03, o[1], RY + 0.2, mz2 + 0.03)
  })
  // pump trim
  ;[-9, 0, 9].forEach(function (x, k) {
    var z = 16.8
    t.slab(hazard, x - 1.85, 0.002, z - 1.3, x + 1.85, 0.008, z - 1.18)
    t.slab(hazard, x - 1.85, 0.002, z + 1.18, x + 1.85, 0.008, z + 1.3)
    t.slab(hazard, x - 1.85, 0.002, z - 1.18, x - 1.73, 0.008, z + 1.18)
    t.slab(hazard, x + 1.73, 0.002, z - 1.18, x + 1.85, 0.008, z + 1.18)
    // base frame and anchor bolts
    t.slab(dark, x - 1.5, 0.3, z - 0.62, x + 1.55, 0.42, z - 0.5)
    t.slab(dark, x - 1.5, 0.3, z + 0.5, x + 1.55, 0.42, z + 0.62)
    for (var ab of [-1.35, 0, 1.35]) for (var az2 of [-0.56, 0.56]) t.cyl(boltM, 0.03, 0.1, x + ab, 0.45, z + az2, { seg: 6 })
    // coupling guard between motor and pump
    t.box(yellowM, 0.36, 0.5, 0.56, x + 0.33, 0.92, z, { bevel: 0.02 })
    // motor: terminal box, end cap, lifting eye
    t.box(greyM, 0.3, 0.26, 0.3, x - 0.6, 1.5, z + 0.25, { bevel: 0.015 })
    t.cyl(tealM, 0.44, 0.1, x - 1.32, 0.9, z, { axis: 'x', seg: 18 })
    try { t.add(new lt.TorusGeometry(0.06, 0.015, 5, 10), dark, { p: [x - 0.55, 1.47, z] }) } catch (e) { }
    // discharge: flange rings, a check valve, a gauge, a handwheel
    for (var fy of [1.6, 2.6, 3.8]) t.cyl(dark, 0.32, 0.06, x + 0.95, fy, z + 1.1, { seg: 16 })
    t.box(blueM, 0.5, 0.42, 0.5, x + 0.95, 2.1, z + 1.1, { bevel: 0.03 })
    t.cyl(whiteM, 0.08, 0.03, x + 1.24, 2.95, z + 1.1, { axis: 'x', seg: 14 })
    t.cyl(dark, 0.09, 0.03, x + 1.225, 2.95, z + 1.1, { axis: 'x', seg: 14, open: true })
    t.rod(dark, [x + 1.2, 2.95, z + 1.1], [x + 1.12, 2.95, z + 1.1], 0.012, { seg: 4 })
    t.rod(dark, [x + 0.95, 3.2, z + 1.36], [x + 0.95, 3.2, z + 1.62], 0.03, { seg: 6 })
    try { t.add(new lt.TorusGeometry(0.22, 0.022, 6, 18), redM, { p: [x + 0.95, 3.2, z + 1.64] }) } catch (e) { }
    // suction elbow into the floor
    t.cyl(blueM, 0.24, 0.5, x + 0.95, 0.55, z - 0.75, { axis: 'z', seg: 12 })
    t.cyl(dark, 0.3, 0.06, x + 0.95, 0.55, z - 1.0, { axis: 'z', seg: 14 })
    // conduit from the motor to the cable tray
    t.rod(M('polymer_black'), [x - 0.6, 1.62, z + 0.25], [x - 0.6, 4.7, z + 0.25], 0.025, { seg: 6 })
    label('PUMP ' + (k + 1), 0.22, x - 0.6, 1.5, z + 0.41, 'z+', 'white', 'stencil')
  })
  // header hangers and the cable tray along the hall
  for (var hx2 = -15; hx2 <= 15.01; hx2 += 3) t.rod(dark, [hx2, 4.62, 22.3], [hx2, RY - 0.05, 22.3], 0.02, { seg: 5 })
  t.slab(galv, -17.7, 4.68, 20.9, 17.7, 4.72, 21.4)
  t.slab(galv, -17.7, 4.68, 20.86, 17.7, 4.82, 20.9)
  t.slab(galv, -17.7, 4.68, 21.4, 17.7, 4.82, 21.44)
  // the panels: voltage signs, labels
  ;[-1, 1].forEach(function (s) {
    for (var cx5 of [4.6, 13.2]) {
      try { t.decal('hazard_voltage', 0.22, s * cx5 - 0.35, 1.75, 22.218, 'z-') } catch (e) { }
      label('MCC-' + (cx5 < 10 ? (s < 0 ? '1' : '2') : (s < 0 ? '3' : '4')), 0.13, s * cx5 + 0.2, 1.95, 22.218, 'z-', 'white', 'sans')
      t.rod(M('polymer_black'), [s * cx5, 2.1, 22.6], [s * cx5, 4.7, 22.6], 0.03, { seg: 6 })
    }
  })
  // walk lines on the epoxy
  t.slab(yellowM, -17.4, 0.002, 13.4, 17.4, 0.007, 13.5)
  t.slab(yellowM, -17.4, 0.002, 20.0, 17.4, 0.007, 20.1)
  // the roller shutter over the main door (rolled up) and its housing
  t.cyl(greyM, 0.28, 3.8, 0, 3.55, 10.55, { axis: 'x', seg: 14 })
  t.slab(greyM, -1.95, 3.25, 10.7, 1.95, 3.9, 10.8)
  try { t.decal('hazard_general', 0.32, -2.4, 2.2, 10.785, 'z-') } catch (e) { }

  /* -- yards: more kit ---------------------------------------------------- */
  ;[-1, 1].forEach(function (s) {
    // X(-x): this yard's side (s = -1 → Blue, west)
    var X = function (x) { return -s * x }
    place('gas_cylinders', X(-24.3), 4.0, s < 0 ? ts : -ts, { seed: 100 + s })
    if (s < 0) place('tire_stack', -24.2, 19.6, 0, { seed: 101 })
    else place('tire_stack', 24.2, 20.2, 0, { seed: 103 })
    place('jerry_can', X(-19.0), 12.8, 0.4, { seed: 104 + s })
    place('cardboard_boxes', X(-23.9), -3.4, 0.1 * s, { seed: 106 + s })
    // electrical box + conduit on the yard wall
    var wx2 = s < 0 ? -18.2 : 18.2, io2 = s < 0 ? -1 : 1
    faceBox('x', wx2, io2, -8.4, -7.6, 1.2, 2.2, 0.25, greyM)
    try { t.decal('hazard_voltage', 0.2, wx2 + io2 * 0.26, 1.95, -8.0, s < 0 ? 'x-' : 'x+') } catch (e) { }
    faceBox('x', wx2, io2, -8.05, -7.95, 2.2, 3.95, 0.06, M('polymer_black'))
  })

  /* ---- relays ------------------------------------------------------------ */
  var relayA = place('relay_node', 0, -17.3, Math.PI, { seed: 1 }, 0)
  var relayB = place('relay_node', 0, -8.6, 0, { seed: 2 }, fl + 0.2)
  var relayC = place('relay_node', 0, 20.6, 0, { seed: 3 }, 0)

  /* ---- merge (same post-process as the other levels) ------------------- */
  t.staticRoot.updateMatrixWorld(true)
  var loose = []
  t.staticRoot.traverse(function (z) { z.userData && z.userData.noMerge && !(z.parent && dR(z.parent, t.staticRoot)) && loose.push(z) })
  for (var lz of loose) t.dynRoot.attach(lz)
  var mset = new Set()
  t.staticRoot.traverse(function (z) { z.isMesh && !Array.isArray(z.material) && mset.add(z.material) })
  var swap = new Map()
  for (var m0 of mset) {
    if (!m0.isMeshStandardMaterial || m0.vertexColors || m0.transparent || !m0.name || !(i.mats.names || []).includes(m0.name)) continue
    try {
      if (i.mats.get(m0.name) !== m0) continue
      var vc = i.mats.get(m0.name, { vertexColors: true })
      vc !== m0 && mset.has(vc) && swap.set(m0, vc)
    } catch (e) {}
  }
  t.staticRoot.traverse(function (z) {
    if (!z.isMesh || Array.isArray(z.material)) return
    var s2 = swap.get(z.material)
    s2 && (z.material = s2)
    z.castShadow = !z.material.transparent && !z.material.isMeshBasicMaterial
    z.receiveShadow = !z.material.isMeshBasicMaterial
  })
  var atlas = { count: 0, update: function () {} }
  try { atlas = rb(t.staticRoot) } catch (e) { console.error('[waterworks] label atlas failed', e) }
  var merged = By(t.staticRoot)
  merged.name = 'level-merged'
  root.add(merged)
  root.add(t.dynRoot)
  for (var rel of [relayA, relayB, relayC]) {
    for (var c = rel.children.length - 1; c >= 0; c--) rel.remove(rel.children[c])
    t.dynRoot.add(rel)
  }
  var tris = 0
  merged.traverse(function (z) { if (z.isMesh) tris += (z.geometry.index ? z.geometry.index.count : z.geometry.attributes.position.count) / 3 })

  /* ---- gameplay data ------------------------------------------------------ */
  var playerStart = { pos: V(-23, 0, 0), yaw: 0 }
  // r: spawn spread (net/net.js) — kept inside the pocket behind the baffle
  var teamSpawns = { blue: { pos: V(-23, 0, 0), yaw: 0, r: 1.4 }, red: { pos: V(23, 0, 0), yaw: 0, r: 1.4 } }
  var objectives = [
    { id: 'relay_a', label: 'Relay A — Gallery', zone: 'gallery', pos: V(0, 0, -17.3), object: relayA },
    { id: 'relay_b', label: 'Relay B — Basin', zone: 'basin', pos: V(0, fl + 0.2, -8.6), object: relayB },
    { id: 'relay_c', label: 'Relay C — Pump hall', zone: 'hall', pos: V(0, 0, 20.6), object: relayC },
  ]
  var gnd = function (x, z, zone) { return { pos: V(x, 0, z), zone: zone, type: 'ground' } }
  var air = function (x, y, z, zone) { return { pos: V(x, y, z), zone: zone, type: 'air' } }
  var enemySpawns = [gnd(0, -21.4, 'gallery'), gnd(21.6, -11.5, 'east'), gnd(21.6, 19.5, 'east'), air(0, 10, -19.6, 'gallery'), air(0, 11, 6, 'basin')]
  ;[-1, 1].forEach(function (s) {
    enemySpawns.push(gnd(s * 11, -19.4, 'gallery'), gnd(s * 15.2, -13.4, 'basin'), gnd(s * 15.6, 7.8, 'basin'),
      gnd(s * 6.4, -5.6, 'basin'), gnd(s * 13.4, 13.8, 'hall'), gnd(s * 5.8, 20.6, 'hall'), air(s * 8, 11, -4, 'basin'))
  })
  var zones = [
    { name: 'gallery', min: [-25, -23], max: [25, -16] },
    { name: 'basin', min: [-18, -16], max: [18, 11] },
    { name: 'hall', min: [-18, 11], max: [18, 23] },
    { name: 'west', min: [-25, -16], max: [-18, 23] },
    { name: 'east', min: [18, -16], max: [25, 23] },
  ]
  var cinematicPath = [
    { pos: [-19.3, 1.8, 0.2], look: [-10, 2.0, -0.5] },
    { pos: [-15.6, 2.3, 0.4], look: [-4, 2.8, -2.6] },
    { pos: [-10, 3.4, 4.1], look: [0, 3.6, -3] },
    { pos: [-4, 3.3, 4.7], look: [4, 2.8, -6.5] },
    { pos: [3, 3.6, 4.9], look: [11, 2.2, -11] },
  ]
  var coverPoints = []
  ;[-1, 1].forEach(function (s) {
    coverPoints.push(
      V(s * 12, 0, -19.0), V(s * 14.2, 0, -18.8), V(s * 1.8, 0, -19.6), V(s * 3, 0, -21.2),
      V(s * 4.2, 0, -14.6), V(s * 4.2, 0, -12.6), V(s * 13.4, 0, -12.6),
      V(s * 13.2, 0, -5.0), V(s * 15.2, 0, -5.0), V(s * 6.6, fl, -8.0), V(s * 6.6, fl, -10.2),
      V(s * 4.6, fl, -6.8), V(s * 4.6, fl, 0.9), V(s * 2.6, fl, 1.6),
      V(s * 13.2, 0, 6.6), V(s * 10.4, 0, 8.2), V(s * 2.4, 0, 7.4),
      V(s * 9, 0, 14.8), V(s * 9, 0, 18.6), V(s * 2.2, 0, 15.0), V(s * 15.4, 0, 14.0), V(s * 13.2, 0, 21.4),
      V(s * 21.8, 0, -6), V(s * 22.4, 0, 6))
  })
  var nav = i.physics.nav
  var fix = function (z) {
    if (!(!nav || !nav.isWalkable || z.y > 0.2 || nav.isWalkable(z.x, z.z)))
      for (var r2 of [0.5, 1, 1.5, 2, 2.5])
        for (var k5 = 0; k5 < 8; k5++) {
          var q = z.x + Math.cos(k5 * 0.7854) * r2, u = z.z + Math.sin(k5 * 0.7854) * r2
          if (nav.isWalkable(q, u)) { z.x = q; z.z = u; return }
        }
  }
  coverPoints.forEach(fix)
  enemySpawns.forEach(function (z) { z.type === 'ground' && fix(z.pos) })
  // supplies, mirrored. Rooms start on knife + pistol here (mpKit): PAC-9 rifles
  // right outside the spawn, in the gallery, in the hall and at the basin's
  // north edge; snipers in the gallery doorways, shotguns at the turns into the
  // middle (rim, hall). Each yard: AMMO zone on the left (crates, calibre boxes,
  // grenades), ARMOUR · MED zone on the right (vest, helmet, medkits).
  var pickupSpots = [
    { pos: V(0, fl, 3.6), kind: 'med_l' },
    { pos: V(0, 0, -14.6), kind: 'grenade' },
    { pos: V(0, 0, 14.4), kind: 'ammo' },
  ]
  ;[-1, 1].forEach(function (s) {
    pickupSpots.push(
      { pos: V(s * 21.8, 0, -17.4), kind: 'sniper' }, { pos: V(s * 15.6, 0, 14.6), kind: 'shotgun' }, { pos: V(s * 15.6, 0, 3.8), kind: 'shotgun' },
      { pos: V(s * 19.4, 0, 0), kind: 'rifle' }, { pos: V(s * 17.0, 0, -19.4), kind: 'rifle' }, { pos: V(s * 15.4, 0, 18.8), kind: 'rifle' }, { pos: V(s * 9.6, 0, -12.6), kind: 'rifle' },
      // AMMO zone (z on the side s: Blue north, Red south) and ARMOUR · MED zone (the other side)
      { pos: V(s * 23.0, 0, s * 7.0), kind: 'ammo' }, { pos: V(s * 20.4, 0, s * 7.0), kind: 'ammo' },
      { pos: V(s * 23.0, 0, s * 9.6), kind: 'grenade' }, { pos: V(s * 20.4, 0, s * 9.6), kind: 'ammo:556' }, { pos: V(s * 21.7, 0, s * 8.3), kind: 'ammo:12g' },
      { pos: V(s * 23.0, 0, -s * 7.0), kind: 'vest1' }, { pos: V(s * 20.4, 0, -s * 7.0), kind: 'helm1' },
      { pos: V(s * 23.0, 0, -s * 9.6), kind: 'med' }, { pos: V(s * 20.4, 0, -s * 9.6), kind: 'med_s' },
      { pos: V(s * 9.6, 0, -19.4), kind: 'att:grip' }, { pos: V(s * 13.6, 0, 20.4), kind: 'att:extmag' }, { pos: V(s * 15.4, 0, -12.6), kind: 'att:stock' },
      { pos: V(s * 10.4, 0, 9.8), kind: 'med_s' }, { pos: V(s * 16.6, 0, 22.0), kind: 'vest2' }, { pos: V(s * 6.6, fl, -7.6), kind: 'ammo' },
      { pos: V(s * 16.2, 0, -4.8), kind: 'att:comp' })
  })
  // free-for-all spawn spots (net/net.js): both yards (three each), the gallery,
  // the rim corners, the hall corners
  var ffaSpawns = [teamSpawns.blue, teamSpawns.red,
    { pos: V(-22.4, 0, -10.5), yaw: 0 }, { pos: V(22.4, 0, -10.5), yaw: 0 }, { pos: V(-22.4, 0, 18.5), yaw: Math.PI }, { pos: V(22.4, 0, 18.5), yaw: Math.PI },
    { pos: V(-13, 0, -20.2), yaw: -ts }, { pos: V(13, 0, -20.2), yaw: ts },
    { pos: V(-14.6, 0, -11.6), yaw: -ts }, { pos: V(14.6, 0, -11.6), yaw: ts }, { pos: V(-15.4, 0, 5.9), yaw: -ts }, { pos: V(15.4, 0, 5.9), yaw: ts },
    { pos: V(-14.2, 0, 19.6), yaw: -ts }, { pos: V(14.2, 0, 19.6), yaw: ts }]
  var warned = false
  return {
    root: root,
    map: 'waterworks',
    maxPlayers: 10, // small map: up to 5 vs 5 (room size cap, net/net.js)
    mpKit: 'pistol', // rooms start on knife + pistol (arsenal/arsenal.js); solo keeps the rifle
    playerStart: playerStart,
    teamSpawns: teamSpawns,
    ffaSpawns: ffaSpawns,
    objectives: objectives,
    extraction: { pos: V(21.0, 0, 13.6), radius: 2.4 },
    enemySpawns: enemySpawns,
    zones: zones,
    interiorBoxes: hallInside,
    arena: { x0: WW_B.x0, x1: WW_B.x1, z0: WW_B.z0, z1: WW_B.z1 },
    cinematicPath: cinematicPath,
    coverPoints: coverPoints,
    skylights: [],
    pickupSpots: pickupSpots,
    stats: { labelsAtlased: atlas.count, props: t.placed.length, tris: Math.round(tris), meshes: merged.children.length + pR(t.dynRoot) },
    placed: t.placed,
    groundSurfaceAt: function (x, z) {
      if (t.isMetal(x, z)) return 'metal'
      return 'concrete'
    },
    update: function (dt) {
      atlas.update(dt)
      var G0 = window.__G
      if (!WW_FLOOR.built && G0 && G0.scene && (WW_FLOOR.tries = WW_FLOOR.tries + 1) < 400) { try { WW_FLOOR.built = WW_floorBuild(G0) } catch (e) { WW_FLOOR.built = true; console.error('[waterworks] floor', e) } }
      if (WW_FLOOR.u) WW_FLOOR.u.uT.value += dt
      // the walls hold everyone in; this is the backstop (the height field turns the game's own clamp off)
      if (G0 && G0.player) { var pp2 = G0.player.pos; pp2.x = Math.max(WW_B.x0 + 0.35, Math.min(WW_B.x1 - 0.35, pp2.x)); pp2.z = Math.max(WW_B.z0 + 0.35, Math.min(WW_B.z1 - 0.35, pp2.z)) }
      for (var k = 0; k < t.updaters.length; k++) {
        try { t.updaters[k](dt) } catch (e) { warned || ((warned = true), console.error('[waterworks] prop update threw', e)) }
      }
    },
  }
}
