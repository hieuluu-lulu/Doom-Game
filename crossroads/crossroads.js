/* ==========================================================================
 * Crossroads — compact urban team-deathmatch map for DoomZone (?map=crossroads).
 *
 * An original, tight duel map (playable 84×59 m), mirrored west↔east: Blue's
 * courtyard base at the west end, Red's at the east end (spawns 52 m apart),
 * each with an open container yard behind it that the side lanes run into.
 * A main street runs between them through an 18×18 m four-way plaza; a narrow
 * market alley runs along the north side, a street with a gas station along
 * the south side; each base opens onto all three. Each half has a two-storey
 * corner house on the plaza you can walk through, with an upper floor and a
 * balcony over the plaza (the sniper perch). Most cover sits 10–35 m apart;
 * the north edge of the main street (z = -3.5) is kept clear base to base.
 *
 * The crossing in the middle is sunk 0.6 m and flooded (murky water, see
 * CXR_POOL). Same plumbing as desert/desert.js: the bundle's level builder `ob` (boxes
 * merged per material by `By`), physics boxes for everything solid, the stub
 * ground (a flat asphalt plane) and the port sky with an overcast palette.
 * North is -z (the compass), the sun sits low in the west.
 * Top-level names are prefixed CXR_.
 * ========================================================================== */

var CXR_ON = typeof SX_MAP !== 'undefined' && SX_MAP === 'crossroads'
var CXR_TEXT = {
  'Raising the terminal': 'Raising the city block',
  'Mixing paint, rust and rain': 'Mixing brick, soot and plaster',
  'Stacking containers': 'Laying out the streets',
  'Raising the cranes': 'Raising the rooftops',
  'Flooding the apron': 'Paving the plaza',
  'Waking the Harbormaster': 'Waking the machines',
  'Waiting for first light': 'Waiting for the evening',
  'Get to the boat': 'Get to the evac van',
  Boat: 'Evac',
  'Relays still live — the boat will not wait under fire': 'Relays still live — the van will not wait under fire',
  'Hauled out of the water': 'Back on your feet',
}
// world extents of the walkable block (physics bounds, nav grid, shadow box);
// z reaches into the ring buildings, which are enterable
var CXR_B = { x0: -42.6, x1: 42.6, z0: -29.5, z1: 29.5 }

function CXR_params(p) {
  if (!CXR_ON) return p
  try {
    // overcast day: a high, cold, diffuse sun under a flat grey sky; dusty grey haze
    Mn.dir.set(-0.55, 0.62, 0.36).normalize()
    Mn.color.setRGB(0.9, 0.93, 1.0)
    Mn.intensity = 5.2
    en.zenith.setRGB(0.36, 0.39, 0.43)
    en.horizon.setRGB(0.66, 0.67, 0.68)
    en.horizonAway.setRGB(0.55, 0.57, 0.6)
    en.fog.setRGB(0.55, 0.56, 0.57)
    // the sunken crossing: a walkable height field for the physics
    CXR_heightGrid()
    // no sea: the whole block is street
    oi.quayX = 1e4
    oi.min.set(CXR_B.x0, 0, CXR_B.z0)
    oi.max.set(CXR_B.x1, 30, CXR_B.z1)
    // the enemies' nav grid covers the whole block (0.5 m cells)
    Ya = CXR_B.x0 - 2; EA = CXR_B.x1 + 2; ol = CXR_B.z0 - 2; SA = CXR_B.z1 + 2
    qt = Math.round((EA - Ya) / Ls); Qs = Math.round((SA - ol) / Ls)
    _l.intro = 'Breacher, Control. The machines hold the Crossroads block. Cut the three relays — market, plaza, gas station.'
    _l.all = 'All three dark. The evac van is waiting at the east courtyard. Go.'
    _l.done = 'Breacher is out. The block is dark. Good work.'
  } catch (e) {
    console.error('[crossroads] params', e)
  }
  if (p.wet === undefined) p.wet = '0'
  return p
}

function CXR_ground() {
  // the stub ground (the bundle lays a flat asphalt plane, re-cut by
  // CXR_poolBuild around the sunken crossing); water = the flooded crossing
  return {
    stub: true, update: function () {},
    wetnessAt: function (x, z) { var h = CXR_height(x, z); return h < CXR_POOL.water ? 1 : h < -0.02 ? 0.7 : 0 },
    isPuddle: function (x, z) { return CXR_height(x, z) < CXR_POOL.water - 0.01 },
  }
}

/* ---- the sunken, flooded crossing ------------------------------------- */
// A square bowl with rounded corners: flat bottom out to r0, smooth ramps up
// to street level at r1 (r = the superellipse radius, p = 4). Baked into the
// shared height field (SXD_HG / SXD_TH, see desert.js) so walking, wheels,
// bullets, grenades and the robots all stand in the same bowl.
var CXR_POOL = { r0: 5.0, r1: 8.6, depth: 0.62, water: -0.3, half: 9.6 }
function CXR_height(x, z) {
  var P = CXR_POOL, ax = Math.abs(x), az = Math.abs(z)
  if (ax >= P.r1 || az >= P.r1) return 0
  var r = Math.pow(ax * ax * ax * ax + az * az * az * az, 0.25)
  if (r >= P.r1) return 0
  var t = r <= P.r0 ? 0 : (r - P.r0) / (P.r1 - P.r0)
  return -P.depth * (1 - t * t * (3 - 2 * t))
}
function CXR_heightGrid() {
  var half = 60, step = 0.5, n = Math.ceil((half * 2) / step) + 1, data = new Float32Array(n * n)
  for (var j = 0; j < n; j++) for (var k = 0; k < n; k++) data[j * n + k] = CXR_height(-half + k * step, -half + j * step)
  SXD_HG = { x0: -half, z0: -half, step: step, n: n, data: data, hmax: 0.5, cx: 0, cz: 0 }
  SXD_TH = SXD_heightAt
}
// the visible ground: the stub asphalt plane gets a hole at the crossing and
// a bowl mesh in it (same material); the water is a murky sheet with ripples
function CXR_poolBuild(G) {
  var P = CXR_POOL, plane = null
  G.scene.traverse(function (o) { if (!plane && o.isMesh && o.material && o.material.name === 'asphalt' && o.geometry && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters && o.geometry.parameters.width >= 200) plane = o })
  if (!plane) return false
  var W = plane.geometry.parameters.width / 2, B = P.half, step = 0.3
  var pos = [], uv = [], idx = []
  var uvOf = function (x, z) { uv.push((x + W) / (2 * W), 1 - (z + W) / (2 * W)) }
  var quad = function (x0, z0, x1, z1) {
    var b = pos.length / 3
    ;[[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(function (q) { pos.push(q[0], 0, q[1]); uvOf(q[0], q[1]) })
    idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 2)
  }
  quad(-W, -W, W, -B); quad(-W, B, W, W); quad(-W, -B, -B, B); quad(B, -B, W, B)
  var n = Math.round((2 * B) / step), b0 = pos.length / 3
  for (var j = 0; j <= n; j++) for (var k = 0; k <= n; k++) {
    var x = -B + (2 * B * k) / n, z = -B + (2 * B * j) / n
    pos.push(x, CXR_height(x, z), z); uvOf(x, z)
  }
  for (var j2 = 0; j2 < n; j2++) for (var k2 = 0; k2 < n; k2++) {
    var a = b0 + j2 * (n + 1) + k2
    idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2)
  }
  var geo = new lt.BufferGeometry()
  geo.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new lt.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  plane.geometry.dispose()
  plane.geometry = geo
  // murky water: dark olive-grey, glossy, slow ripples in the normal
  var u = { uT: { value: 0 } }
  var wm = new lt.MeshStandardMaterial({ color: 0x3e4036, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.88, envMapIntensity: 1.4 })
  wm.name = 'cx_pool'
  wm.onBeforeCompile = function (sh) {
    sh.uniforms.uT = u.uT
    sh.vertexShader = 'varying vec3 vCxW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vCxW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = 'varying vec3 vCxW;\nuniform float uT;\n' + sh.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\n  { vec2 q = vCxW.xz; float a = sin(q.x * 2.3 + uT * 1.1) + sin(q.y * 2.9 - uT * 0.8) * 0.8 + sin((q.x + q.y) * 5.1 + uT * 1.9) * 0.35;\n    float b = cos(q.y * 2.1 + uT * 0.9) + cos(q.x * 3.3 - uT * 1.3) * 0.7 + cos((q.x - q.y) * 4.7 - uT * 1.6) * 0.35;\n    normal = normalize(normal + mat3(viewMatrix) * vec3(a * 0.035, 0.0, b * 0.035)); }')
  }
  wm.customProgramCacheKey = function () { return 'cx-pool-1' }
  var water = new lt.Mesh(new lt.PlaneGeometry(2 * 8.2, 2 * 8.2).rotateX(-Math.PI / 2), wm)
  water.position.set(0, P.water, 0)
  water.name = 'cx-pool-water'
  water.receiveShadow = true
  water.renderOrder = -2
  G.scene.add(water)
  CXR_POOL.u = u
  return true
}



/* ============================================================ MODELS ===== */
// Visual-only models (CC-BY, see CREDITS.md), optimised into crossroads/assets:
//   cx_oldap  old apartment block  → the non-enterable blocks (instanced)
//   cx_ap13   brick 2-storey house → the corner houses' skin + roof
//   cx_shops  shopfront pack       → the market alley shops (instanced rows)
//   cx_fence  graffiti fence pack  → base back walls, lane ends, south street
//   cx_street modular street kit   → roads, sidewalks, alley paving, streetlights, manholes
//   cx_stair  C-channel steel stair → every staircase (a tread per step + stretched stringers)
// The procedural physics boxes stay authoritative; until the models load the
// procedural facades show (hot swap in the level's update).
var CXR_GLB = { started: false, ready: false, failed: false, tex: {} }
function CXR_glbStart() {
  if (CXR_GLB.started) return
  CXR_GLB.started = true
  var need = ['cx_oldap', 'cx_ap13', 'cx_shops', 'cx_fence', 'cx_street', 'cx_stair']
  var imgs = ['brick', 'quoin', 'win', 'sash', 'cornice', 'band', 'oabrick']
  try {
    if (typeof SX_parseGLB !== 'function' || need.some(function (k) { return typeof CXR_asset(k) !== 'string' })) { CXR_GLB.failed = true; return }
    var jobs = need.map(function (k) { return SX_parseGLB(CXR_asset(k)).then(function (g) { CXR_GLB[k] = g.scene }) })
    imgs.forEach(function (k) {
      jobs.push(SX_image(CXR_asset('cx_skin_' + k), 'image/webp').then(function (img) {
        var tx = new lt.Texture(img)
        tx.colorSpace = lt.SRGBColorSpace
        tx.wrapS = tx.wrapT = lt.MirroredRepeatWrapping
        tx.anisotropy = 4
        tx.needsUpdate = true
        CXR_GLB.tex[k] = tx
      }))
    })
    SX_timeout(Promise.all(jobs), 20000, 'crossroads models').then(function () { CXR_GLB.ready = true }, function (e) { CXR_GLB.failed = true; console.warn('[crossroads] models unavailable, procedural facades', e) })
  } catch (e) { CXR_GLB.failed = true; console.warn('[crossroads] models', e) }
}
function CXR_asset(k) {
  var m = { cx_oldap: typeof SX_ASSET_cx_oldap !== 'undefined' && SX_ASSET_cx_oldap, cx_ap13: typeof SX_ASSET_cx_ap13 !== 'undefined' && SX_ASSET_cx_ap13,
    cx_shops: typeof SX_ASSET_cx_shops !== 'undefined' && SX_ASSET_cx_shops, cx_street: typeof SX_ASSET_cx_street !== 'undefined' && SX_ASSET_cx_street, cx_stair: typeof SX_ASSET_cx_stair !== 'undefined' && SX_ASSET_cx_stair, cx_fence: typeof SX_ASSET_cx_fence !== 'undefined' && SX_ASSET_cx_fence,
    cx_skin_brick: typeof SX_ASSET_cx_skin_brick !== 'undefined' && SX_ASSET_cx_skin_brick, cx_skin_quoin: typeof SX_ASSET_cx_skin_quoin !== 'undefined' && SX_ASSET_cx_skin_quoin,
    cx_skin_win: typeof SX_ASSET_cx_skin_win !== 'undefined' && SX_ASSET_cx_skin_win, cx_skin_sash: typeof SX_ASSET_cx_skin_sash !== 'undefined' && SX_ASSET_cx_skin_sash,
    cx_skin_cornice: typeof SX_ASSET_cx_skin_cornice !== 'undefined' && SX_ASSET_cx_skin_cornice, cx_skin_band: typeof SX_ASSET_cx_skin_band !== 'undefined' && SX_ASSET_cx_skin_band,
    cx_skin_oabrick: typeof SX_ASSET_cx_skin_oabrick !== 'undefined' && SX_ASSET_cx_skin_oabrick }
  return m[k] || null
}
if (CXR_ON) CXR_glbStart()

// every mesh of a model, baked into the model root's space as float, indexed
// geometry with position/normal/uv; `top` = the child of the root it hangs under
function CXR_bake(scene) {
  scene.updateMatrixWorld(true)
  var inv = new lt.Matrix4().copy(scene.matrixWorld).invert(), out = []
  scene.traverse(function (o) {
    if (!o.isMesh) return
    var src = o.geometry, g = new lt.BufferGeometry()
    ;['position', 'normal', 'uv'].forEach(function (name) {
      var a = src.attributes[name]
      if (!a) return
      var arr = new Float32Array(a.count * a.itemSize)
      for (var i = 0; i < a.count; i++) for (var c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c)
      g.setAttribute(name, new lt.BufferAttribute(arr, a.itemSize))
    })
    if (src.index) g.setIndex(src.index.clone())
    if (!g.attributes.uv) g.setAttribute('uv', new lt.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    g.applyMatrix4(new lt.Matrix4().multiplyMatrices(inv, o.matrixWorld))
    if (!g.attributes.normal) g.computeVertexNormals()
    var p = o
    var names = []
    while (p && p !== scene) { names.push(p.name || ''); p = p.parent }
    out.push({ geo: g, mat: o.material, name: o.name, path: names.join('/') })
  })
  return out
}
// keep the triangles of a geometry for which keep(cx, cy, cz, minY, maxY)
// says so (centroid + vertical extent), as a new non-indexed geometry
function CXR_filter(geo, keep) {
  var g = geo.index ? geo.toNonIndexed() : geo, pa = g.attributes.position, ids = []
  for (var k = 0; k < pa.count; k += 3) {
    var ya = pa.getY(k), yb = pa.getY(k + 1), yc = pa.getY(k + 2)
    if (keep((pa.getX(k) + pa.getX(k + 1) + pa.getX(k + 2)) / 3, (ya + yb + yc) / 3, (pa.getZ(k) + pa.getZ(k + 1) + pa.getZ(k + 2)) / 3, Math.min(ya, yb, yc), Math.max(ya, yb, yc))) ids.push(k)
  }
  var out = new lt.BufferGeometry()
  ;['position', 'normal', 'uv'].forEach(function (nm) {
    var a = g.attributes[nm]
    if (!a) return
    var arr = new Float32Array(ids.length * 3 * a.itemSize), o = 0
    ids.forEach(function (k) { for (var j = 0; j < 3; j++) for (var c = 0; c < a.itemSize; c++) arr[o++] = a.getComponent(k + j, c) })
    out.setAttribute(nm, new lt.BufferAttribute(arr, a.itemSize))
  })
  return out
}
function CXR_box(parts) {
  var b = new lt.Box3()
  parts.forEach(function (p) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox) })
  return b
}
// merge parts by material (geometries must share attributes)
function CXR_byMat(parts) {
  var m = new Map()
  parts.forEach(function (p) { if (!m.has(p.mat)) m.set(p.mat, []); m.get(p.mat).push(p.geo.index ? p.geo.toNonIndexed() : p.geo) })
  var out = []
  m.forEach(function (geos, mat) { var g = geos.length > 1 ? Ii(geos) : geos[0]; if (g) out.push({ geo: g, mat: mat }) })
  return out
}
function CXR_inst(geo, mat, mats, shadow) {
  var im = new lt.InstancedMesh(geo, mat, mats.length)
  mats.forEach(function (m, k) { im.setMatrixAt(k, m) })
  im.instanceMatrix.needsUpdate = true
  im.castShadow = shadow !== false
  im.receiveShadow = true
  im.computeBoundingSphere && im.computeBoundingSphere()
  return im
}
// world matrix: translate (x, y, z) · rotY(yaw) · scale(sx, sy, sz)
function CXR_trs(x, y, z, yaw, sx, sy, sz) {
  var q = new lt.Quaternion().setFromAxisAngle(new lt.Vector3(0, 1, 0), yaw)
  return new lt.Matrix4().compose(new lt.Vector3(x, y, z), q, new lt.Vector3(sx, sy, sz))
}

/* ============================================================ LEVEL ===== */

async function CXR_level(i) {
  var root = new lt.Group()
  root.name = 'level'
  i.scene.add(root)
  var t = ob(i)
  var place = t.place
  var M = t.M
  var ts = Math.PI / 2
  var rnd = SXD_rng(4242)
  var V = function (x, y, z) { return new lt.Vector3(x, y, z) }

  var brick = M('brick'), plaster = M('concrete_painted'), conc = M('concrete'), dirty = M('concrete_dirty')
  var dark = M('steel_dark'), rust = M('steel_rust'), worn = M('steel_worn'), galv = M('steel_galv')
  var wood = M('wood_dark'), tire = M('tire'), roofM = M('corrugated_roof'), asph = M('asphalt')
  var glow = i.mats.emissive ? i.mats.emissive(0xffcf8f, 2.6) : M('paint_yellow')
  var glowCool = i.mats.emissive ? i.mats.emissive(0xbfe0ff, 1.6) : M('paint_white')
  var blueM = M('paint_blue'), redM = M('paint_red'), whiteM = M('paint_white'), greenM = M('paint_green')
  var yellowM = M('paint_yellow'), orangeM = M('paint_orange'), tealM = M('paint_teal'), greyM = M('paint_grey')

  /* ---- primitives ------------------------------------------------------ */

  // procedural facades the models replace: built into their own groups (fb:
  // city blocks + their shopfronts, fbHouse: the corner houses' flat roof,
  // parapet and sign), merged separately and hidden once the models are in
  var fb = new lt.Group(), fbHouse = new lt.Group(), CUR = null
  var P = function (o) { var r = Object.assign({}, o || {}); if (CUR) r.parent = CUR; return r }
  var lab = function (m) { if (m && CUR) CUR.attach(m); return m }
  var blocks = [] // {a, b, c, d, h, front} of every replaced building

  // world-aligned block from corners; optional collider
  function blk(mat, x0, y0, z0, x1, y1, z1, col, opts) {
    var a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(z0, z1), d = Math.max(z0, z1)
    t.slab(mat, a, y0, c, b, y1, d, P(opts))
    if (col) t.col(a, y0, c, b, y1, d, col === true ? 'concrete' : col)
  }

  // windows along one facade: side 'n'|'s'|'e'|'w' of a building box
  function windows(x0, z0, x1, z1, h, side, opts) {
    opts = opts || {}
    var floors = Math.max(1, Math.floor((h - 1.2) / 3.2))
    var alongX = side === 'n' || side === 's'
    var a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1
    var len = a1 - a0, n = Math.floor((len - 1.4) / 3.2)
    if (n < 1) return
    var pad = (len - (n - 1) * 3.2) / 2
    var out = side === 'n' ? z0 : side === 's' ? z1 : side === 'w' ? x0 : x1
    var sgn = side === 'n' || side === 'w' ? -1 : 1
    for (var f = opts.from || 0; f < floors; f++) {
      var y = 1.6 + f * 3.2 + (opts.lift || 0)
      if (y + 1.7 > h - 0.4) break
      for (var k = 0; k < n; k++) {
        var a = a0 + pad + k * 3.2
        if (opts.skip && opts.skip(a, f)) continue
        var lit = rnd() < 0.1
        var pane = lit ? (rnd() < 0.5 ? glow : glowCool) : dark
        if (alongX) {
          t.box(pane, 1.3, 1.6, 0.06, a, y + 0.8, out + sgn * 0.02, P())
          t.box(conc, 1.6, 0.12, 0.22, a, y - 0.06, out + sgn * 0.09, P())
          if (rnd() < 0.35) t.box(wood, 0.32, 1.6, 0.05, a - 0.82, y + 0.8, out + sgn * 0.05, P())
        } else {
          t.box(pane, 0.06, 1.6, 1.3, out + sgn * 0.02, y + 0.8, a, P())
          t.box(conc, 0.22, 0.12, 1.6, out + sgn * 0.09, y - 0.06, a, P())
          if (rnd() < 0.35) t.box(wood, 0.05, 1.6, 0.32, out + sgn * 0.05, y + 0.8, a - 0.82, P())
        }
      }
    }
  }
  // a solid city building: body + collider, cornice, plinth, windows on the
  // listed street faces, a few roof bits
  function building(x0, z0, x1, z1, h, mat, faces, opts) {
    opts = opts || {}
    var a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(z0, z1), d = Math.max(z0, z1)
    var keep = !!opts.keep, prev = CUR
    solidsFP.push([a, c, b, d])
    if (!keep) {
      // the street-facing side gets the model's front (main street / plaza / courtyard)
      var f = faces || 's', cz = (c + d) / 2
      var front = f.indexOf('s') >= 0 && cz < 0 ? 's' : f.indexOf('n') >= 0 && cz > 0 ? 'n' : f.charAt(0)
      blocks.push({ a: a, b: b, c: c, d: d, h: h, front: front })
      CUR = fb
    }
    blk(mat, a, 0, c, b, h, d, true)
    // cornice + plinth
    t.slab(conc, a - 0.2, h - 0.35, c - 0.2, b + 0.2, h, d + 0.2, P())
    t.slab(dirty, a - 0.06, 0, c - 0.06, b + 0.06, 0.6, d + 0.06, P())
    if (h > 7) t.slab(conc, a - 0.1, 3.0, c - 0.1, b + 0.1, 3.2, d + 0.1, P())
    ;(faces || '').split('').forEach(function (s) { windows(a, c, b, d, h, s, opts.win) })
    // roof clutter
    if (!opts.flatRoof && (b - a) > 5 && (d - c) > 5) {
      var n = 1 + ((rnd() * 3) | 0)
      for (var k = 0; k < n; k++) {
        var rx = a + 1.5 + rnd() * (b - a - 3), rz = c + 1.5 + rnd() * (d - c - 3)
        if (rnd() < 0.5) t.box(galv, 1.4, 0.9, 1.0, rx, h + 0.45, rz, P({ bevel: 0.04 }))
        else { t.cyl(rust, 0.8, 1.6, rx, h + 1.3, rz, P({ seg: 12 })); for (var q of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) t.box(dark, 0.08, 0.5, 0.08, rx + q[0], h + 0.25, rz + q[1], P()) }
      }
    }
    CUR = prev
  }
  // shopfront at street level on a facade: awning + sign + shutter
  // (keep = stays when the models load: the plaza kiosks and the mini mart)
  function shop(x, z, side, w, name, paint, keep) {
    var alongX = side === 'n' || side === 's'
    var sgn = side === 'n' || side === 'w' ? -1 : 1
    var pm = M(paint || 'paint_red')
    var prev = CUR
    CUR = keep ? null : fb
    if (alongX) {
      t.box(dark, w, 2.4, 0.08, x, 1.2 + 0.6, z + sgn * 0.04, P())
      t.box(galv, w - 0.4, 2.0, 0.05, x, 1.6, z + sgn * 0.09, P())
      t.box(pm, w + 0.4, 0.12, 1.4, x, 3.3, z + sgn * 0.7, P({ r: [sgn * -0.2, 0, 0] }))
      lab(t.label(name, 0.42, x, 2.85, z + sgn * 0.1, sgn > 0 ? 'z+' : 'z-', { color: 'white', font: 'sans' }))
    } else {
      t.box(dark, 0.08, 2.4, w, x + sgn * 0.04, 1.8, z, P())
      t.box(galv, 0.05, 2.0, w - 0.4, x + sgn * 0.09, 1.6, z, P())
      t.box(pm, 1.4, 0.12, w + 0.4, x + sgn * 0.7, 3.3, z, P({ r: [0, 0, sgn * 0.2] }))
      lab(t.label(name, 0.42, x + sgn * 0.1, 2.85, z, sgn > 0 ? 'x+' : 'x-', { color: 'white', font: 'sans' }))
    }
    CUR = prev
  }
  // street lamp: collider + procedural pole (fallback; the street kit's
  // streetlight takes its place once the models are in)
  function lamp(x, z, yaw) {
    var prev = CUR
    CUR = fb
    t.cyl(dark, 0.09, 6.2, x, 3.1, z, P({ seg: 8 }))
    t.box(dark, 0.32, 0.5, 0.32, x, 0.25, z, P({ bevel: 0.03 }))
    var ax = Math.sin(yaw) * 1.1, az = Math.cos(yaw) * 1.1
    t.rod(dark, [x, 6.0, z], [x + ax, 6.25, z + az], 0.05, P({ seg: 6 }))
    t.box(dark, 0.5, 0.16, 0.3, x + ax, 6.2, z + az, P())
    t.box(glow, 0.38, 0.05, 0.2, x + ax, 6.1, z + az, P())
    CUR = prev
    t.col(x - 0.08, 0, z - 0.08, x + 0.08, 6.2, z + 0.08, 'metal') // the kit pole is ~0.1 m thick
    road.lamp.push([x, z, yaw])
  }
  // the street kit (models, visual): tiles as [kind, centre x, z, length along
  // the street (local x), depth across (local z), yaw]; straight tiles have the
  // sidewalk on local -z. Laid out here, instanced in buildStreet().
  var road = { straight: [], drain: [], patch: [], plane: [], corner: [], lamp: [], manhole: [], pilar: [] }
  function tile(kind, cx, cz, len, dep, yaw) { road[kind].push([cx, cz, len, dep, yaw || 0]) }
  var KIT = { lift: 0.03, sy: 0.6 / 160, side: 0.03 + 17 * 0.6 / 160 } // road surface, height scale, sidewalk top
  // the fallback's own pavement (hidden with the other procedural facades)
  function fbSlab(mat, x0, y0, z0, x1, y1, z1) { var prev = CUR; CUR = fb; blk(mat, x0, y0, z0, x1, y1, z1, false); CUR = prev }
  // bollard on a sidewalk (the kit's pilar; a concrete post until it loads)
  function pilar(x, z) {
    fbSlab(conc, x - 0.14, 0, z - 0.14, x + 0.14, 0.95, z + 0.14)
    t.col(x - 0.12, 0, z - 0.12, x + 0.12, 0.95, z + 0.12, 'concrete')
    road.pilar.push([x, z])
  }
  // a rotated box as axis-aligned colliders: sliced along its length when
  // the yaw is off-axis, so the boxes hug the drawn shape (lx = offset of
  // the box centre along the local x axis)
  function rvn(x, z, yaw, lx, w, d, y0, y1, surface) {
    var c = Math.cos(yaw), s = Math.sin(yaw), n = Math.abs(Math.sin(2 * yaw)) > 0.2 ? Math.max(2, Math.round(w / 0.6)) : 1
    for (var k = 0; k < n; k++) {
      var a = lx - w / 2 + (k + 0.5) * w / n, cx = x + c * a, cz = z - s * a, sw = w / n
      var hx = (sw * Math.abs(c) + d * Math.abs(s)) / 2 * (n > 1 ? 0.85 : 1), hz = (sw * Math.abs(s) + d * Math.abs(c)) / 2 * (n > 1 ? 0.85 : 1)
      t.col(cx - hx, y0, cz - hz, cx + hx, y1, cz + hz, surface)
    }
  }
  // burnt-out car (rotated group), with a rotated collider
  function wreck(x, z, yaw, paint, y) {
    y = y || 0
    var g = new lt.Group()
    g.position.set(x, y, z)
    g.rotation.y = yaw
    t.staticRoot.add(g)
    var body = M(paint || 'steel_rust')
    t.box(body, 4.3, 0.7, 1.8, 0, 0.62, 0, { parent: g, bevel: 0.06 })
    t.box(body, 2.2, 0.6, 1.66, -0.25, 1.25, 0, { parent: g, bevel: 0.08 })
    t.box(dark, 2.0, 0.5, 1.7, -0.25, 1.25, 0, { parent: g })
    t.box(rust, 1.2, 0.12, 1.7, 1.45, 1.0, 0, { parent: g, r: [0, 0, -0.18] })
    for (var wx of [-1.35, 1.35]) for (var wz of [-0.82, 0.82]) t.cyl(rnd() < 0.5 ? tire : dark, 0.34, 0.22, wx, 0.3, wz, { parent: g, axis: 'z', seg: 12 })
    // colliders as drawn: the body to the bonnet line, the cabin on top
    rvn(x, z, yaw, 0, 4.3, 1.8, y, y + 0.97, 'metal')
    rvn(x, z, yaw, -0.25, 2.2, 1.66, y + 0.95, y + 1.55, 'metal')
  }
  function truck(x, z, yaw, paint) {
    var g = new lt.Group()
    g.position.set(x, 0, z)
    g.rotation.y = yaw
    t.staticRoot.add(g)
    var p = M(paint || 'paint_white')
    t.box(p, 5.2, 2.6, 2.4, -1.0, 2.15, 0, { parent: g, bevel: 0.05 })
    t.box(dark, 5.4, 0.3, 2.2, -0.6, 0.75, 0, { parent: g })
    t.box(M('paint_blue'), 1.9, 1.7, 2.3, 2.6, 1.55, 0, { parent: g, bevel: 0.08 })
    t.box(dark, 0.06, 0.8, 2.0, 3.56, 1.9, 0, { parent: g })
    for (var wx of [-2.6, -1.4, 2.6]) for (var wz of [-1.0, 1.0]) t.cyl(tire, 0.48, 0.32, wx, 0.48, wz, { parent: g, axis: 'z', seg: 14 })
    // colliders as drawn: chassis + wheels, the cargo box, the cab
    var at = function (lx) { return [x + Math.cos(yaw) * lx, z - Math.sin(yaw) * lx] }, q
    q = at(-0.1); rv(t, q[0], q[1], yaw, 6.4, 2.2, 0.9, 'metal')
    q = at(-1.0); rv(t, q[0], q[1], yaw, 5.2, 2.4, 2.6, 'metal', 0.85)
    q = at(2.6); rv(t, q[0], q[1], yaw, 1.9, 2.3, 1.7, 'metal', 0.7)
  }
  function sandbags(x, z, yaw, n, y) {
    for (var k = 0; k < n; k++) {
      var dx = Math.cos(yaw) * (k - (n - 1) / 2) * 1.95, dz = -Math.sin(yaw) * (k - (n - 1) / 2) * 1.95
      place('sandbags', x + dx, z + dz, yaw + (k % 2 ? 0.04 : -0.03), { seed: ((x * 13 + z * 7 + k) | 0) & 1023 }, y || 0)
    }
  }
  function stall(x, z, yaw, paint) {
    var g = new lt.Group()
    g.position.set(x, 0, z)
    g.rotation.y = yaw
    t.staticRoot.add(g)
    t.box(wood, 2.4, 0.9, 1.0, 0, 0.45, 0, { parent: g })
    t.box(M('cardboard'), 2.2, 0.25, 0.8, 0, 1.02, 0, { parent: g })
    for (var px of [-1.15, 1.15]) for (var pz of [-0.6, 0.6]) t.box(dark, 0.06, 2.3, 0.06, px, 1.15, pz, { parent: g })
    t.box(M(paint), 2.7, 0.06, 1.7, 0, 2.35, 0.1, { parent: g, r: [0.12, 0, 0] })
    rv(t, x, z, yaw, 2.4, 0.95, 1.0, 'wood')
  }
  function planter(x0, z0, x1, z1) {
    blk(dirty, x0, 0, z0, x1, 0.95, z1, true)
    t.slab(M('wood_dark'), Math.min(x0, x1) + 0.15, 0.95, Math.min(z0, z1) + 0.15, Math.max(x0, x1) - 0.15, 1.0, Math.max(z0, z1) - 0.15)
  }

  /* ---- enterable buildings --------------------------------------------- */
  // Every apartment block inside the walls is a real building. The old
  // apartment model is its facade (its walls already have the window holes;
  // its glass, recessed door and roof surface are left out) and inside,
  // matching its four storeys: walls with the same openings, floors, a
  // two-lane switchback stair from the ground floor to the roof, a parapet,
  // a crate per floor and a shop fit-out on the shop ground floors.
  // Model wall extents (model units) and its storey/opening grid:
  var OAP = { x0: -327, x1: 274, z0: -132, z1: 108, h: 441, roof: 445,
    rows: [[25, 90], [135, 200], [245, 310], [355, 420]], floors: [0, 110, 220, 330],
    cols: [[-280, -250], [-160, -130], [-40, -10], [80, 110], [200, 230]], side: [[-85, -55], [35, 65]], door: [-87, 34, 0, 93] }
  var units = [], solidsFP = [], coverFP = []
  // team spawn samples: no window may look straight at them
  var spawnPts = []
  ;[-1, 1].forEach(function (s) { [[26, 0], [26, 2.5], [26, -2.5], [23.5, 0], [28.5, 0]].forEach(function (p) { spawnPts.push([s * p[0], p[1]]) }) })
  var YAW = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }
  // register a building: world rect, model front ('s' = +z … 'w' = -x), height
  function enterable(x0, z0, x1, z1, front, h, o) {
    o = o || {}
    var a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(z0, z1), d = Math.max(z0, z1)
    var alongX = front === 's' || front === 'n'
    var u = { a: a, b: b, c: c, d: d, cx: (a + b) / 2, cz: (c + d) / 2, W: alongX ? b - a : d - c, D: alongX ? d - c : b - a, h: h,
      yaw: YAW[front], front: front, shop: !!o.shop, tag: o.tag || '' }
    units.push(u)
    return u
  }
  function L2W(u, x, z) { var c = Math.cos(u.yaw), s = Math.sin(u.yaw); return [u.cx + x * c + z * s, u.cz - x * s + z * c] }
  function L2Wd(u, x, z) { var c = Math.cos(u.yaw), s = Math.sin(u.yaw); return [x * c + z * s, -x * s + z * c] }
  // local box → world slab (+ collider); yaws are quarter turns, so it stays axis-aligned
  function lbox(u, mat, x0, y0, z0, x1, y1, z1, col) {
    var p = L2W(u, x0, z0), q = L2W(u, x1, z1)
    var X0 = Math.min(p[0], q[0]), X1 = Math.max(p[0], q[0]), Z0 = Math.min(p[1], q[1]), Z1 = Math.max(p[1], q[1])
    if (mat) t.slab(mat, X0, y0, Z0, X1, y1, Z1, P())
    if (col) t.col(X0, y0, Z0, X1, y1, Z1, col === true ? 'concrete' : col)
  }
  // every flight of stairs, for the stair model: bottom centre (world), unit
  // direction up the run, width, run and rise per step, steps, base height
  var stairRuns = []
  function inR(x, z, r) { return x > r[0] && x < r[2] && z > r[1] && z < r[3] }
  function blocked(x, z, self) {
    if (units.some(function (o) { return o !== self && inR(x, z, [o.a, o.c, o.b, o.d]) })) return true
    return solidsFP.some(function (r) { return inR(x, z, r) })
  }
  // a rectangle minus holes as few rectangles as possible (columns between
  // the hole edges, runs merged sideways): [w0, w1, y0, y1]
  function rectsR(w0, w1, y0, y1, holes) {
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
  // is this window bricked up? (inner wall stays solid behind the model's
  // hole) — when it faces another building or the outside, sits behind a
  // fence panel, or looks straight into a team spawn
  function closedAt(u, lx, lz, ln, ym, wid) {
    var w = L2W(u, lx, lz), n = L2Wd(u, ln[0], ln[1])
    var px = w[0] + n[0] * 0.7, pz = w[1] + n[1] * 0.7
    var why = unitStats.why
    if (Math.abs(px) > 41.8 || Math.abs(pz) > 28.6) return (why.outside++, true)
    if (blocked(px, pz, u)) return (why.wall++, true)
    if (ym < 2.7 && coverFP.some(function (r) { return inR(px, pz, r) })) return (why.fence++, true)
    if (wid < 0) return false // caller handles the spawn view (spawnFins)
    var cosLim = 0.22 / Math.hypot(0.22, wid)
    return spawnPts.some(function (s) {
      var dx = s[0] - w[0], dz = s[1] - w[1], L = Math.hypot(dx, dz)
      if ((dx * n[0] + dz * n[1]) / L < cosLim) return false
      for (var d = 0.7; d < L; d += 0.5) if (blocked(w[0] + dx * d / L, w[1] + dz * d / L, u)) return false
      return true
    }) ? (why.spawn++, true) : false
  }
  // upper-floor window that would see a team spawn: the side fin it needs
  // (concrete, a collider) so it doesn't. Through an opening w wide in a
  // 0.22 m wall with a fin F deep on one side, the most oblique view on that
  // side is tan φ = w / (0.22 + F). Returns null (no view), 'shut' (a fin
  // over 1.2 m would be needed), or { neg: F, pos: F } along the face
  function spawnFins(u, lx, lz, ln, la, wid) {
    var w = L2W(u, lx, lz), n = L2Wd(u, ln[0], ln[1]), a = L2Wd(u, la[0], la[1]), need = { neg: 0, pos: 0 }, any = false
    for (var i = 0; i < spawnPts.length; i++) {
      var s = spawnPts[i], dx = s[0] - w[0], dz = s[1] - w[1], L = Math.hypot(dx, dz)
      var vn = dx * n[0] + dz * n[1], va = dx * a[0] + dz * a[1]
      if (vn <= 0 || Math.abs(va) / vn > wid / 0.22) continue // behind the wall / outside the bare opening's view
      var clear = true
      for (var d = 0.7; d < L; d += 0.5) if (blocked(w[0] + dx * d / L, w[1] + dz * d / L, u)) { clear = false; break }
      if (!clear) continue
      if (Math.abs(va) < 1e-3) return 'shut'
      var F = wid * vn / Math.abs(va) - 0.22 + 0.08
      if (F > 1.2) return 'shut'
      var k = va > 0 ? 'pos' : 'neg'
      if (F > need[k]) need[k] = F
      any = true
    }
    return any ? need : null
  }
  var intWall = M('concrete_painted'), intFloor = M('concrete'), stepM = M('concrete_dirty')
  var skirt = t.MI('wood_dark'), roofTop = M('concrete_dirty')
  var unitStats = { windows: 0, closed: 0, finned: 0, why: { outside: 0, wall: 0, fence: 0, spawn: 0 } }
  var WIN = { w: 1.3, h: 1.4, sill: 1.0 }
  var sillM = M('concrete'), frameM = M('steel_dark'), shutM = M('steel_worn')
  // one stair rise for the whole map: the corner houses' 3.25 m / 11 steps
  // (0.295 m, under the 0.42 m step-up), so every climb has the same rhythm
  var STEP = 3.25 / 11
  function buildUnit(u, ui) {
    var W = u.W, D = u.D, h = u.h, T = 0.2, e = 0.02
    var mx = function (x) { return ((x - OAP.x0) / (OAP.x1 - OAP.x0) - 0.5) * W }
    var mz = function (z) { return ((z - OAP.z0) / (OAP.z1 - OAP.z0) - 0.5) * D }
    var my = function (y) { return y / OAP.h * h }
    // floor tops: 0, 1, 2, 3, roof — each a whole number of stair steps
    // (STEP, the corner houses' rise), within ~0.13 m of the model's storey lines
    var lv = OAP.floors.map(my).concat([my(OAP.roof)]).map(function (y) { return Math.round(y / STEP) * STEP })
    var ix0 = -W / 2 + T + e, ix1 = W / 2 - T - e, iz0 = -D / 2 + T + e, iz1 = D / 2 - T - e
    // faces: front (+z, the door), back, left (-x), right (+x); holes along the face
    var faces = [
      { n: [0, 1], at: D / 2, lo: -W / 2, hi: W / 2, x: true, holes: [] },
      { n: [0, -1], at: -D / 2, lo: -W / 2, hi: W / 2, x: true, holes: [] }, // back: a second door where it opens onto a street
      { n: [-1, 0], at: -W / 2, lo: iz0 - e, hi: iz1 + e, x: false, holes: [] },
      { n: [1, 0], at: W / 2, lo: iz0 - e, hi: iz1 + e, x: false, holes: [] },
    ]
    // firing windows on every floor: 1.3 × 1.4 m, sill 1.0 m above the floor
    // (a standing player, eye 1.68 m, shoots over it down to ~50°; a crouching
    // one, 1.15 m, is covered from the street below by the sill and the wall
    // depth), centred on the model's window columns so its hoods
    // sit over them. The facade is procedural (model brick skin, frames,
    // sills, lintels); a window that would face a wall, the outside, a fence
    // panel or a team spawn is shuttered (inner wall solid behind it)
    var big = W >= 9
    var colsX = (big ? OAP.cols : [OAP.cols[1], OAP.cols[3]]).map(function (c) { return mx((c[0] + c[1]) / 2) })
    var wX = Math.min(WIN.w, W * (big ? 120 : 240) / 601 - 0.7)
    var colsZ = OAP.side.map(function (c) { return mz((c[0] + c[1]) / 2) })
    var wZ = Math.min(WIN.w, colsZ[1] - colsZ[0] - 0.6)
    var dx0 = mx(OAP.door[0]), dx1 = mx(OAP.door[1]), doorH = my(OAP.door[3])
    u.backDoor = !closedAt(u, (dx0 + dx1) / 2, -D / 2, [0, -1], 1.2, dx1 - dx0)
    faces.forEach(function (f) { f.shut = []; f.doors = []; f.fins = [] })
    var addWin = function (f, c, w, k) {
      var a0 = c - w / 2, a1 = c + w / 2, y0 = lv[k] + WIN.sill, y1 = y0 + WIN.h
      if (a0 < f.lo + 0.3 || a1 > f.hi - 0.3) return
      if (k === 0 && (f === faces[0] || (f === faces[1] && u.backDoor)) && a1 > dx0 - 0.3 && a0 < dx1 + 0.3) return
      unitStats.windows++
      var lx = f.x ? c : f.at, lz = f.x ? f.at : c
      if (closedAt(u, lx, lz, f.n, (y0 + y1) / 2, -1)) { unitStats.closed++; f.shut.push([a0, a1, y0, y1]); return }
      // a spawn in view: shutter on the ground floor (a fin would block the
      // sidewalk), a side fin upstairs
      var fin = spawnFins(u, lx, lz, f.n, f.x ? [1, 0] : [0, 1], w)
      if (fin === 'shut' || (fin && k === 0)) { unitStats.closed++; unitStats.why.spawn++; f.shut.push([a0, a1, y0, y1]); return }
      if (fin) { unitStats.finned++; f.fins.push([a0, a1, y0, y1, fin.neg, fin.pos]) }
      f.holes.push([a0, a1, y0, y1])
    }
    for (var k0 = 0; k0 < 4; k0++) {
      colsX.forEach(function (c) { addWin(faces[0], c, wX, k0); addWin(faces[1], c, wX, k0) })
      colsZ.forEach(function (c) { addWin(faces[2], c, wZ, k0); addWin(faces[3], c, wZ, k0) })
    }
    faces[0].doors.push([dx0, dx1, 0, doorH]); faces[0].holes.push([dx0, dx1, 0, doorH])
    if (u.backDoor) { faces[1].doors.push([dx0, dx1, 0, doorH]); faces[1].holes.push([dx0, dx1, 0, doorH]) }
    // frames, sills, lintels, shutters (static, merged per material)
    var trim = function (f, mat, a0, a1, y0, y1, d0, d1) { // d: outward from the wall plane
      if (f.x) lbox(u, mat, a0, y0, f.at + f.n[1] * d0, a1, y1, f.at + f.n[1] * d1, false)
      else lbox(u, mat, f.at + f.n[0] * d0, y0, a0, f.at + f.n[0] * d1, y1, a1, false)
    }
    faces.forEach(function (f) {
      var isDoor = function (o) { return f.doors.indexOf(o) >= 0 }
      f.holes.concat(f.shut).forEach(function (o) {
        var door = isDoor(o)
        if (!door) trim(f, sillM, o[0] - 0.1, o[1] + 0.1, o[2] - 0.09, o[2], -0.02, 0.09)
        trim(f, sillM, o[0] - 0.1, o[1] + 0.1, o[3], o[3] + 0.16, -0.02, 0.05)
        trim(f, frameM, o[0] - 0.06, o[0], o[2], o[3], -0.02, 0.04)
        trim(f, frameM, o[1], o[1] + 0.06, o[2], o[3], -0.02, 0.04)
      })
      f.shut.forEach(function (o) { trim(f, shutM, o[0], o[1], o[2], o[3], -0.019, -0.006) })
      // view fins (colliders: they stop sight lines and bullets alike)
      f.fins.forEach(function (o) {
        var fin = function (b0, b1, F) {
          // a storey tall: a sight line leaving low through the opening
          // still has to clear it on the way down
          var fy0 = Math.max(0.3, o[2] - 1.2), fy1 = o[3] + 0.3
          if (f.x) lbox(u, sillM, b0, fy0, f.at, b1, fy1, f.at + f.n[1] * F, true)
          else lbox(u, sillM, f.at, fy0, b0, f.at + f.n[0] * F, fy1, b1, true)
        }
        if (o[4] > 0) fin(o[0] - 0.18, o[0] - 0.06, Math.max(0.25, o[4]))
        if (o[5] > 0) fin(o[1] + 0.06, o[1] + 0.18, Math.max(0.25, o[5]))
      })
    })
    u.faces = faces
    u.doorW = L2W(u, (dx0 + dx1) / 2, D / 2 + 0.9)
    u.doorIn = L2W(u, (dx0 + dx1) / 2, D / 2 - 1.2)
    // walls: 2 cm inside the model's wall planes, 20 cm thick, same openings
    faces.forEach(function (f) {
      rectsR(f.lo, f.hi, 0, h, f.holes).forEach(function (r) {
        if (f.x) lbox(u, intWall, r[0], r[2], f.at - f.n[1] * (T + e), r[1], r[3], f.at - f.n[1] * e, true)
        else lbox(u, intWall, f.at - f.n[0] * (T + e), r[2], r[0], f.at - f.n[0] * e, r[3], r[1], true)
      })
    })
    // stairs: two 1 m lanes along the back wall from the left end. Flight f
    // (level f → f+1; the 4th comes out on the roof) runs in lane f%2: odd
    // flights rise -x and top out at the end wall, beside a 0.8 m landing
    // (plain floor) where the next, even flight starts rising +x; even
    // flights top out onto the room, beside the next odd flight's foot. A
    // player only ever steps onto a flight along it (sideways onto stairs,
    // the capsule would catch the second step)
    var LW = Math.min(1.0, (iz1 - iz0 - 1.4) / 2), run = 0.34, LAND = 0.8, flights = []
    for (var f = 0; f < 4; f++) {
      var rise = lv[f + 1] - lv[f], n = Math.round(rise / STEP), Lf = n * run
      var z0 = iz0 + (f % 2) * LW, z1 = z0 + LW, xs = f % 2 === 0 ? ix0 + LAND : ix0
      CUR = fb // the concrete steps are the fallback look; the colliders stay
      for (var j = 0; j < n; j++) {
        var top = lv[f] + (j + 1) * rise / n
        var xa = f % 2 === 0 ? xs + j * run : xs + Lf - (j + 1) * run
        lbox(u, stepM, xa, lv[f] - 0.01, z0, xa + run, top, z1, true)
      }
      CUR = null
      stairRuns.push({ p: L2W(u, f % 2 === 0 ? xs : xs + Lf, (z0 + z1) / 2), d: L2Wd(u, f % 2 === 0 ? 1 : -1, 0), w: LW, run: run, rise: rise / n, n: n, y: lv[f] })
      flights.push([xs, xs + Lf, z0, z1, rise / n])
    }
    // floors 1–3 and the roof, each open over the flight that arrives there
    lbox(u, intFloor, ix0, 0, iz0, ix1, 0.02, iz1, false)
    for (var L = 1; L <= 4; L++) {
      var fl = flights[L - 1], y = lv[L]
      rectsR(ix0, ix1, iz0, iz1, [[fl[0], fl[1], fl[2], fl[3]]]).forEach(function (r) {
        lbox(u, L === 4 ? roofTop : intFloor, r[0], y - T, r[2], r[1], y, r[3], true)
      })
      if (L < 4) lbox(u, glow, W / 4 - 0.35, y - T - 0.04, -0.25, W / 4 + 0.35, y - T, 0.25, false) // lamp, ceiling below
    }
    // skirting on the front wall of each storey
    for (var S = 0; S < 4; S++) lbox(u, skirt, ix0, lv[S], iz1 - 0.03, ix1, lv[S] + 0.1, iz1, false)
    // parapet on the roof (the model's own roof edge is only ankle-high)
    var R = lv[4], P = 0.25, PH = 1.0
    lbox(u, conc, -W / 2, R, -D / 2, W / 2, R + PH, -D / 2 + P, true)
    lbox(u, conc, -W / 2, R, D / 2 - P, W / 2, R + PH, D / 2, true)
    lbox(u, conc, -W / 2, R, -D / 2 + P, -W / 2 + P, R + PH, D / 2 - P, true)
    lbox(u, conc, W / 2 - P, R, -D / 2 + P, W / 2, R + PH, D / 2 - P, true)
    // cover: a crate in the front-right corner of every floor (clear of the
    // door and the stairs); shops get a counter, a shelf and boxes instead
    for (var k = 0; k < 4; k++) {
      if (k === 0 && u.shop) continue
      var cp = L2W(u, ix1 - 0.6, iz1 - 0.6)
      place('crate_wood', cp[0], cp[1], u.yaw, { seed: 300 + ui * 7 + k }, lv[k])
    }
    // a low table (0.8 m: covers a crouching player) 1.35 m in from a front
    // window on each floor, leaving room to step back from the window
    if (D >= 6) for (var tk = 0; tk < 4; tk++) {
      if (tk === 0 && u.shop) continue
      var ys = lv[tk] + WIN.sill, best = null
      faces[0].holes.forEach(function (o) {
        var c = (o[0] + o[1]) / 2
        if (Math.abs(o[2] - ys) > 0.01 || Math.abs(c - (ix1 - 0.6)) < 1.5 || (tk === 0 && Math.abs(c) < 2.2) || c - 0.6 < ix0 + 0.1) return
        if (!best || Math.abs(c - W / 4) < Math.abs(best - W / 4)) best = c
      })
      if (best !== null) lbox(u, wood, best - 0.6, lv[tk], iz1 - 1.62, best + 0.6, lv[tk] + 0.8, iz1 - 1.08, 'wood')
    }
    if (u.shop) {
      lbox(u, wood, ix1 - 2.0, 0, -0.9, ix1 - 1.2, 1.05, Math.min(1.1, iz1 - 1.0), 'wood')
      lbox(u, worn, ix1 - 2.05, 1.05, -0.95, ix1 - 1.15, 1.09, Math.min(1.15, iz1 - 0.95), false)
      var s0 = Math.max(iz0 + 2.2, -D / 2 + 1.8), s1 = Math.min(iz1 - 1.6, D / 2 - 1.4)
      if (s1 - s0 > 0.8) {
        lbox(u, wood, ix1 - 0.45, 0, s0, ix1, 2.0, s1, 'wood')
        for (var sy = 0.45; sy < 2.0; sy += 0.5) lbox(u, M('cardboard'), ix1 - 0.42, sy, s0 + 0.1, ix1 - 0.05, sy + 0.26, s1 - 0.1, false)
      }
      var cb = L2W(u, ix1 - 0.8, iz0 + 0.8)
      place('cardboard_boxes', cb[0], cb[1], u.yaw, { seed: 330 + ui }, 0)
    }
    u.levels = lv
    u.local = function (x, z) { return L2W(u, x, z) }
    u.ix0 = ix0; u.ix1 = ix1; u.iz0 = iz0; u.iz1 = iz1; u.LW = LW; u.flights = flights
  }
  // roofs: where a player standing at the parapet could look down into a
  // team spawn, that side of the parapet becomes a 2.3 m screen wall (rays
  // from eye height along the roof edges, against the colliders built so far)
  function screenRoof(u) {
    var R = u.levels[4], P = 0.25, eye = R + 1.75, raised = {}, W = u.W, D = u.D
    var ph = i.physics
    if (!ph || !ph.raycast) return
    var pts = []
    for (var x = -W / 2 + 0.6; x <= W / 2 - 0.6 + 1e-6; x += 0.9) pts.push([x, -D / 2 + 0.6], [x, D / 2 - 0.6])
    for (var z = -D / 2 + 0.6; z <= D / 2 - 0.6 + 1e-6; z += 0.9) pts.push([-W / 2 + 0.6, z], [W / 2 - 0.6, z])
    pts.forEach(function (p) {
      var w = L2W(u, p[0], p[1])
      spawnPts.forEach(function (sp) {
        var d = new lt.Vector3(sp[0] - w[0], 1.2 - eye, sp[1] - w[1]), L = d.length()
        var h = ph.raycast(new lt.Vector3(w[0], eye, w[1]), d.clone().normalize(), L)
        if (h && h.dist < L - 0.3) return
        // which edge does it leave the roof by? (local direction)
        var c = Math.cos(u.yaw), s = Math.sin(u.yaw), lx = d.x * c - d.z * s, lz = d.x * s + d.z * c
        var tx = lx > 0 ? (W / 2 - p[0]) / lx : lx < 0 ? (-W / 2 - p[0]) / lx : 1e9
        var tz = lz > 0 ? (D / 2 - p[1]) / lz : lz < 0 ? (-D / 2 - p[1]) / lz : 1e9
        raised[tx < tz ? (lx > 0 ? 'r' : 'l') : (lz > 0 ? 'f' : 'b')] = true
      })
    })
    var H0 = R + 1.0, H1 = R + 2.3
    if (raised.b) lbox(u, conc, -W / 2, H0, -D / 2, W / 2, H1, -D / 2 + P, true)
    if (raised.f) lbox(u, conc, -W / 2, H0, D / 2 - P, W / 2, H1, D / 2, true)
    if (raised.l) lbox(u, conc, -W / 2, H0, -D / 2 + P, -W / 2 + P, H1, D / 2 - P, true)
    if (raised.r) lbox(u, conc, W / 2 - P, H0, -D / 2 + P, W / 2, H1, D / 2 - P, true)
    u.screens = Object.keys(raised).join('')
  }
  // a shop sign + awning over a building's door (no shutter: the door is open)
  function unitSign(u, name, paint) {
    var y = u.h * 112 / OAP.h + 0.05, pm = M(paint)
    var a = L2W(u, -1.9, u.D / 2 + 0.06), b = L2W(u, 1.9, u.D / 2 + 0.16), nn = L2Wd(u, 0, 1)
    t.slab(pm, Math.min(a[0], b[0]), y, Math.min(a[1], b[1]), Math.max(a[0], b[0]), y + 0.55, Math.max(a[1], b[1]))
    var c = L2W(u, 0, u.D / 2 + 0.17)
    var face = nn[1] > 0.5 ? 'z+' : nn[1] < -0.5 ? 'z-' : nn[0] > 0.5 ? 'x+' : 'x-'
    t.label(name, 0.4, c[0], y + 0.28, c[1], face, { color: 'white', font: 'sans' })
  }
  // the plaza kiosk: a one-storey shop, door on the plaza, window on the S street
  function kiosk(sx, name, paint) {
    var X = function (x) { return sx < 0 ? x : -x }
    var w = function (a, y0, c, b, y1, d, m) { blk(m || plaster, X(a), y0, c, X(b), y1, d, true) }
    w(-9, 0, 9, -6.9, 3.6, 9.25); w(-5.1, 0, 9, -3, 3.6, 9.25); w(-6.9, 2.4, 9, -5.1, 3.6, 9.25)
    w(-3.25, 0, 9.25, -3, 3.6, 10.3); w(-3.25, 0, 11.7, -3, 3.6, 13); w(-3.25, 0, 10.3, -3, 1.0, 11.7); w(-3.25, 2.2, 10.3, -3, 3.6, 11.7)
    w(-9, 0, 12.75, -3.25, 3.6, 13); w(-9, 0, 9.25, -8.75, 3.6, 12.75)
    blk(conc, X(-9.15), 3.6, 8.85, X(-2.85), 3.95, 13.15, true)
    blk(dirty, X(-9.06), 0, 8.94, X(-2.94), 0.5, 9.0, false)
    blk(intFloor, X(-8.75), 0, 9.25, X(-3.25), 0.02, 12.75, false)
    blk(wood, X(-8.6), 0, 11.5, X(-6.6), 1.0, 12.2, 'wood')
    blk(wood, X(-8.7), 0, 9.6, X(-8.3), 2.0, 11.2, 'wood')
    for (var sy = 0.5; sy < 2.0; sy += 0.5) blk(M('cardboard'), X(-8.68), sy, 9.7, X(-8.35), sy + 0.25, 11.1, false)
    t.box(glow, 0.8, 0.05, 0.4, X(-6), 3.56, 11)
    var pm = M(paint)
    t.box(pm, 4.4, 0.12, 1.2, X(-6), 3.2, 8.4, { r: [0.2, 0, 0] })
    t.label(name, 0.42, X(-6), 2.85, 8.94, 'z-', { color: 'white', font: 'sans' })
    solidsFP.push([Math.min(X(-9), X(-3)), 9, Math.max(X(-9), X(-3)), 13])
  }

  /* ---- the block (playable x ±34, z ±23; north = -z) ------------------- */
  // x: outer [-39,-33] | base [-33,-21] | blocks [-21,-9] | plaza [-9,9]
  // (the half below is written in the old, longer layout's coordinates: X()
  // pulls everything at x ≤ -20 in by 11 m; Xn() places new-layout spots)
  // z: outer [-29,-23] | market alley [-23,-17] | north blocks [-17,-5] |
  //    main street [-5,5] | south blocks [5,13] | south street [13,23] | outer [23,29]
  // The line z = -3.5 (north edge of the main street) is kept clear of cover
  // from base to base: the one long sightline (~42 m street, ~54 m overall).
  // the ring: five enterable buildings along the market alley (shops on the
  // ground floor) and five along the south street, solid corners beyond x ±33
  // only four buildings stand on the block (the two by the crossing on each
  // side, built in half()); a 5.5 m brick wall runs round the whole block
  for (var wz0 of [-29.5, 29.1]) {
    blk(brick, -42.5, 0, wz0, 42.5, 5.5, wz0 + 0.4, true)
    blk(conc, -42.58, 5.5, wz0 - 0.08, 42.58, 5.75, wz0 + 0.48, false)
    for (var px0 = -39; px0 <= 39; px0 += 6) blk(brick, px0 - 0.3, 0, wz0 < 0 ? wz0 + 0.4 : wz0 - 0.4, px0 + 0.3, 5.6, wz0 < 0 ? wz0 + 0.8 : wz0, false) // piers
  }
  // behind each base: an open yard x[±33.4, ±42] the whole depth of the block
  // (the market alley and the south street run into it), walled in by a
  // 5.5 m brick wall; the base itself keeps a back wall, so nobody shoots a
  // spawn in the back from the yard
  for (var sx of [-1, 1]) {
    var wx0 = Math.min(sx * 42, sx * 42.5), wx1 = Math.max(sx * 42, sx * 42.5)
    blk(brick, wx0, 0, -29.5, wx1, 5.5, 29.5, true)
    blk(conc, wx0 - 0.08, 5.5, -29.5, wx1 + 0.08, 5.75, 29.5, false)
    for (var pz = -27; pz <= 27; pz += 6) blk(brick, Math.min(sx * 41.6, sx * 42), 0, pz - 0.3, Math.max(sx * 41.6, sx * 42), 5.6, pz + 0.3, false) // piers
    blk(brick, Math.min(sx * 33, sx * 33.4), 0, -7, Math.max(sx * 33, sx * 33.4), 4.2, 7, true) // the base's back wall
    blk(conc, Math.min(sx * 32.95, sx * 33.45), 4.2, -7.05, Math.max(sx * 32.95, sx * 33.45), 4.4, 7.05, false)
  }

  // one half; sx = -1 west (Blue), +1 east (Red)
  function half(sx) {
    // coordinates are written for the west half, in the old layout (x ≤ -20 moves in by 11 m)
    var X = function (x) { var y = x <= -20 ? x + 11 : x; return sx < 0 ? y : -y }
    var Xn = function (x) { return sx < 0 ? x : -x } // a spot in the new layout
    var mx = function (a, b) { return [Math.min(X(a), X(b)), Math.max(X(a), X(b))] }
    // an enterable building, written for the west half (front e/w mirrored)
    var E = function (x0, z0, x1, z1, fr, h, o) {
      var r = mx(x0, x1), f = sx > 0 && (fr === 'e' || fr === 'w') ? (fr === 'e' ? 'w' : 'e') : fr
      return enterable(r[0], z0, r[1], z1, f, h, o)
    }
    var team = sx < 0 ? blueM : redM, teamName = sx < 0 ? 'BLUE' : 'RED'
    var sl = function (mat, a, y0, c, b, y1, d) { t.slab(mat, Math.min(X(a), X(b)), y0, c, Math.max(X(a), X(b)), y1, d) }
    var sln = function (mat, a, y0, c, b, y1, d) { t.slab(mat, Math.min(Xn(a), Xn(b)), y0, c, Math.max(Xn(a), Xn(b)), y1, d) }

    // north + south blocks between the base and the plaza, doors on the main street
    // the only buildings on the map: one north and one south of the main
    // street on each side, between the base and the crossing
    unitSign(E(-32, -17, -20, -5, 's', 12.8, { shop: true, tag: 'NA' }), sx < 0 ? 'CAFE 24' : 'NOODLE BAR', sx < 0 ? 'paint_red' : 'paint_teal')
    unitSign(E(-32, 5, -20, 13, 'n', 12.0, { shop: true, tag: 'SA' }), sx < 0 ? 'HARDWARE' : 'TAILOR', 'paint_blue')
    // (no blocks round the base, no corner kiosk: open ground, see the cover below)
    place('container20', Xn(-27.4), -12.6, ts, { color: sx < 0 ? 'blue' : 'red', wear: 1, seed: 140 + sx })
    place('pallet_stack', Xn(-30.6), -16.4, 0.15, { seed: 141 + sx })
    place('container20', Xn(-27.0), 11.0, ts, { color: 'green', wear: 1, seed: 142 + sx })
    place('crate_stack', Xn(-30.6), 7.8, -0.1, { seed: 143 + sx })
    sandbags(Xn(-23.6), -9.6, ts, 1)
    sandbags(Xn(-23.6), 9.6, ts, 1)
    place('pallet_stack', Xn(-6.0), 11.2, 0.3, { seed: 144 + sx })
    place('crate_wood', Xn(-5.6), -12.4, 0.2, { seed: 145 + sx })
    place('jersey_barrier', Xn(-6.2), -15.4, 0, { seed: 146 + sx })

    /* -- base courtyard x[-44,-32] z[-7,7] -- */
    sl(team, -43.98, 1.2, -6.5, -43.9, 1.6, 6.5)
    blk(brick, X(-32.6), 0, -7, X(-32), 4.2, -5, true)
    blk(brick, X(-32.6), 0, 5, X(-32), 4.2, 7, true)
    sl(team, -32.62, 3.6, -7, -31.98, 3.9, -5)
    sl(team, -32.62, 3.6, 5, -31.98, 3.9, 7)
    t.label(teamName + ' BASE', 0.7, X(-32.0) + (sx < 0 ? 0.04 : -0.04), 2.4, 6, sx < 0 ? 'x+' : 'x-', { color: 'white', font: 'stencil', distress: 0.3 })
    sl(dirty, -44, 0, -7, -32.6, 0.04, 7)
    sl(team, -39, 0.04, -2, -35, 0.06, 2)
    t.cyl(galv, 0.07, 9, X(-42.6), 4.5, -6.2, { seg: 8 })
    t.box(team, 0.04, 1.4, 2.2, X(-42.6) + sx * -0.06, 8.1, -5.1)
    // spawn cover at the mouth (off the z=-3.5 sightline)
    place('jersey_barrier', X(-34.4), 1.6, ts, { seed: 11 + (sx > 0 ? 50 : 0) })
    place('jersey_barrier', X(-34.4), -1.6, ts, { seed: 12 + (sx > 0 ? 50 : 0) })
    sandbags(X(-35.4), -5.9, ts, 1)
    sandbags(X(-35.4), 5.9, ts, 1)
    place('container20', X(-42.4), 3.8, ts, { color: sx < 0 ? 'blue' : 'red', seed: 21 + sx })
    place('crate_stack', X(-38.6), -5.8, 0.2, { seed: 23 + sx })

    /* -- the yard behind the base x[-42,-33.4] z[-29.5,29.5]: containers, wrecks, crates -- */
    sln(dirty, -42, 0, -29.4, -33.4, 0.025, 29.4)
    place('container40', Xn(-38.4), -9.5, ts, { color: sx < 0 ? 'green' : 'blue', wear: 1, seed: 91 + sx })
    place('container20', Xn(-37.6), 9.2, ts, { color: 'red', wear: 1, seed: 92 + sx })
    place('pallet_stack', Xn(-40.6), 15.0, 0.1, { seed: 100 + sx })
    place('crate_stack', Xn(-40.4), 2.6, 0.15, { seed: 93 + sx })
    place('jersey_barrier', Xn(-35.6), -0.6, ts, { seed: 94 + sx })
    place('barrel', Xn(-35.2), -20.6, 0, { seed: 95 + sx, color: 'blue' })
    place('barrel', Xn(-35.9), -21.3, 0.4, { seed: 96 + sx, color: 'yellow' })
    wreck(Xn(-38.2), 19.0, sx < 0 ? 0.35 : Math.PI - 0.35, 'paint_grey')
    sandbags(Xn(-39.4), -20.4, sx < 0 ? 0.25 : -0.25, 1)
    place('crate_wood', Xn(-36.4), 26.0, 0.4, { seed: 97 + sx })
    place('cardboard_boxes', Xn(-40.6), -26.4, 0.1, { seed: 98 + sx })
    place('tarp_cargo', Xn(-38.0), 25.2, ts, { seed: 99 + sx })
    lamp(Xn(-41.5), -14, sx < 0 ? -ts : ts); lamp(Xn(-41.5), 14, sx < 0 ? -ts : ts)

    /* -- main street x[-32,-9] z[-5,5] -- */
    fbSlab(dirty, X(-32), 0, -5, X(-9), 0.08, -3.0); t.col(Math.min(X(-32), X(-9)), 0, -5, Math.max(X(-32), X(-9)), 0.07, -3.0, 'concrete')
    fbSlab(dirty, X(-32), 0, 3.0, X(-9), 0.08, 5); t.col(Math.min(X(-32), X(-9)), 0, 3.0, Math.max(X(-32), X(-9)), 0.07, 5, 'concrete')
    for (var tk = 0; tk < 3; tk++) {
      var tx = Xn(-21 + 4 * (tk + 0.5))
      tile(tk === 1 ? 'drain' : 'straight', tx, -3, 4, 4, 0)
      tile(tk === 2 ? 'drain' : 'straight', tx, 3, 4, 4, Math.PI)
      tile('patch', tx, 0, 4, 2, 0)
    }
    road.manhole.push([Xn(-13), -1.8])
    pilar(Xn(-10.2), 3.4); pilar(Xn(-19.8), 3.4)
    lamp(Xn(-16), -4.45, 0); lamp(Xn(-12), 4.45, Math.PI)
    wreck(Xn(-13.4), 1.5, sx < 0 ? 0.12 : Math.PI - 0.12, 'steel_rust')
    place('crate_wood', Xn(-17.4), 2.8, 0.3, { seed: 33 + sx })
    place('dumpster', Xn(-18.6), -1.6, 0, { seed: 34 + sx })
    for (var dx = -20; dx < -10; dx += 4) sln(whiteM, dx, 0.034, -0.08, dx + 2, 0.04, 0.08)

    /* -- market alley (north) z[-23,-17] -- */
    fbSlab(dirty, Xn(-42), 0, -23, X(-3), 0.03, -17)
    road.manhole.push([Xn(-14), -20])
    var stallPaints = ['paint_red', 'paint_blue', 'paint_yellow', 'paint_green']
    ;[-23, -20, -6.4].forEach(function (x, k) { var kk = k === 2 ? 3 : k; stall(Xn(x), kk % 2 ? -21.9 : -18.1, kk % 2 ? 0 : Math.PI, stallPaints[kk]) })
    place('crate_stack', Xn(-14.4), -21.8, 0.1, { seed: 41 + sx })
    place('barrel', X(-22.2), -18.2, 0, { seed: 42 + sx, color: 'blue' })
    place('barrel', X(-21.6), -18.7, 0.5, { seed: 43 + sx, color: 'red' })
    place('cardboard_boxes', X(-9.0), -21.9, 0.2, { seed: 44 + sx })
    place('tarp_cargo', X(-41.2), -21.6, 0, { seed: 46 + sx })

    /* -- south street z[13,23] -- */
    truck(Xn(-17.5), 16.0, sx < 0 ? 0.04 : Math.PI - 0.04, sx < 0 ? 'paint_white' : 'paint_yellow')
    wreck(X(-35.5), 20.4, sx < 0 ? -0.3 : Math.PI + 0.3, 'paint_grey')
    planter(X(-12.5), 14.2, X(-10.5), 15.6)
    planter(X(-33.6), 21.2, X(-30.8), 22.4)
    place('jersey_barrier', X(-41.2), 16.4, ts, { seed: 51 + sx })
    lamp(Xn(-19), 22.4, Math.PI); lamp(Xn(-9), 22.4, Math.PI)
    for (var dz = -40; dz < -8; dz += 4) sln(yellowM, dz, 0.034, 17.9, dz + 2, 0.04, 18.1)
    // south street x[-42,-7] (into the yard): sidewalks on both sides, the gas station in the middle
    for (var sk = 0; sk < 8; sk++) {
      var sxk = Xn(-42 + (35 / 8) * (sk + 0.5))
      tile(sk === 6 ? 'drain' : 'straight', sxk, 15, 35 / 8, 4, 0)
      tile(sk === 2 ? 'drain' : 'straight', sxk, 21, 35 / 8, 4, Math.PI)
      tile('patch', sxk, 18, 35 / 8, 2, 0)
    }
    road.manhole.push([Xn(-24), 18])
    // N street x[-3,3] z[-17,-9] and S street z[9,13]: sidewalks on both sides
    if (sx < 0) {
      for (var nz of [-15, -11, 11]) { tile('straight', -1.5, nz, 4, 3, Math.PI / 2); tile('straight', 1.5, nz, 4, 3, -Math.PI / 2) }
      tile('patch', 0, 13.8, 14, 1.6, 0) // where the S street meets the south street
      for (var ak = 0; ak < 14; ak++) tile('plane', -42 + 6 * (ak + 0.5), -20, 6, 6, 0) // market alley paving (into both yards)
      // where the ring rows stood: paving out to the north and south walls
      for (var rk2 = 0; rk2 < 11; rk2++) {
        tile('plane', -33 + 6 * (rk2 + 0.5), -26.2, 6, 5.8, 0)
        tile('plane', -33 + 6 * (rk2 + 0.5), 26.15, 6, 5.9, 0)
      }
    }

    /* -- where the base blocks stood (x[-33,-21], north and south of the
       base): asphalt lots; where the corner house and the kiosk stood
       (x[-9,-3]): paving like the alley -- */
    for (var lx = 0; lx < 3; lx++) {
      var lcx = Xn(-33 + 4 * (lx + 0.5))
      tile('patch', lcx, -14.5, 4, 5, 0); tile('patch', lcx, -9.5, 4, 5, 0)
      tile('patch', lcx, 10, 4, 6, 0)
    }
    tile('plane', Xn(-6), -15, 6, 4, 0); tile('plane', Xn(-6), -11, 6, 4, 0)
    tile('plane', Xn(-6), 11, 6, 4, 0)

    /* -- N street x[-3,3] z[-17,-9] and S street z[9,13] -- */
    place('barrel', X(-2.2), -15.6, 0, { seed: 71 + sx, color: 'yellow' })
    place('cable_reel', X(-2.0), 11.2, 0.4, { seed: 72 + sx })

  }

  // x[-9,-3] z[-17,-9] (west half; mirrored for the east): three doors,
  // stairs up the west wall, upper floor + balcony over the plaza
  var houseInside = []
  function cornerHouse(sx) {
    var X = function (x) { return sx < 0 ? x : -x }
    var x0 = -9, x1 = -3, z0 = -17, z1 = -9, F = 3.0, FT = 3.25, H2 = 6.2, W = 0.3
    var wallM = sx < 0 ? plaster : brick
    var w = function (a, y0, b, y1, c, d) { blk(wallM, X(a), y0, c, X(b), y1, d, true) }
    // ground floor: doors south (plaza) x[-6.6,-5], east (N street) z[-14.2,-12.6], north (market) x[-5.8,-4.2]
    w(x0, 0, -6.6, F, z1 - W, z1); w(-5.0, 0, x1, F, z1 - W, z1); w(-6.6, 2.3, -5.0, F, z1 - W, z1)
    w(x1 - W, 0, x1, F, z0, -14.2); w(x1 - W, 0, x1, F, -12.6, z1); w(x1 - W, 2.3, x1, F, -14.2, -12.6)
    w(x0, 0, -5.8, F, z0, z0 + W); w(-4.2, 0, x1, F, z0, z0 + W); w(-5.8, 2.3, -4.2, F, z0, z0 + W)
    w(x0, 0, x0 + W, F, z0, z1)
    // floor with the stair hole x[-8.7,-7.3] z[-16.7,-11.6]
    blk(conc, X(x0), F, -11.6, X(-7.3), FT, z1, true)
    blk(conc, X(-7.3), F, z0, X(x1), FT, z1, true)
    var steps = 11, rise = FT / steps, run = 4.7 / steps
    CUR = fb
    for (var k = 0; k < steps; k++) {
      var za = -11.6 - (k + 1) * run, zb = -11.6 - k * run
      blk(conc, X(-8.7), 0, za, X(-7.3), (k + 1) * rise, zb, true)
    }
    CUR = null
    stairRuns.push({ p: [X(-8.0), -11.6], d: [0, -1], w: 1.4, run: run, rise: rise, n: steps, y: 0 })
    blk(dark, X(-7.32), FT, -15.3, X(-7.26), FT + 1.0, -11.8, true) // rail, open at the top
    // upper walls: plaza side window x[-8.4,-7.2] + balcony door x[-6.4,-4.2]; east windows
    var U0 = FT, U1 = H2
    w(x0, U0, -8.4, U1, z1 - W, z1); w(-7.2, U0, -6.4, U1, z1 - W, z1); w(-4.2, U0, x1, U1, z1 - W, z1)
    w(-8.4, U0, -7.2, U0 + 0.9, z1 - W, z1); w(-8.4, U0 + 2.3, -7.2, U1, z1 - W, z1)
    w(-6.4, U0 + 2.3, -4.2, U1, z1 - W, z1)
    w(x1 - W, U0, x1, U1, z0, -15.6); w(x1 - W, U0, x1, U1, -14.2, -12.2); w(x1 - W, U0, x1, U1, -10.8, z1)
    w(x1 - W, U0, x1, U0 + 0.9, -15.6, -14.2); w(x1 - W, U0 + 2.3, x1, U1, -15.6, -14.2)
    w(x1 - W, U0, x1, U0 + 0.9, -12.2, -10.8); w(x1 - W, U0 + 2.3, x1, U1, -12.2, -10.8)
    w(x0, U0, x1, U1, z0, z0 + W)
    w(x0, U0, x0 + W, U1, z0, z1)
    // roof + parapet (visuals swap for the model's tiled roof)
    blk(conc, X(x0 - 0.2), H2, z0 - 0.2, X(x1 + 0.2), H2 + 0.3, z1 + 0.2, true) // stays: the ceiling
    CUR = fbHouse
    // (no colliders: the roof can't be reached and the model's tiled roof replaces them)
    blk(wallM, X(x0 - 0.2), H2 + 0.3, z0 - 0.2, X(x1 + 0.2), H2 + 1.0, z0 + 0.1, false)
    blk(wallM, X(x0 - 0.2), H2 + 0.3, z1 - 0.1, X(x1 + 0.2), H2 + 1.0, z1 + 0.2, false)
    CUR = null
    // balcony over the plaza z[-9,-7.6]
    blk(conc, X(-6.9), F, z1, X(-3.4), FT, z1 + 1.4, true)
    blk(dark, X(-6.9), FT, z1 + 1.32, X(-3.4), FT + 1.0, z1 + 1.4, true)
    blk(dark, X(-6.9), FT, z1, X(-6.82), FT + 1.0, z1 + 1.4, true)
    blk(dark, X(-3.48), FT, z1, X(-3.4), FT + 1.0, z1 + 1.4, true)
    for (var bx of [-6.6, -3.8]) t.slab(dark, Math.min(X(bx), X(bx + 0.12)), 2.2, z1, Math.max(X(bx), X(bx + 0.12)), F, z1 + 1.0)
    // furniture to hide behind
    blk(wood, X(-5.2), 0, -15.6, X(-3.6), 0.8, -14.6, 'wood')
    blk(wood, X(-8.5), FT, -10.7, X(-7.5), FT + 1.1, -9.9, 'wood')
    CUR = fbHouse
    lab(t.label(sx < 0 ? 'HOTEL WEST' : 'HOTEL EAST', 0.45, X(-6), H2 - 0.6, z1 + 0.05, 'z+', { color: 'white', font: 'sans', distress: 0.35 }))
    CUR = null
    houseInterior(sx)
    t.box(glow, 1.0, 0.08, 0.5, X(-5), FT - 0.1, -13)
    var a = Math.min(X(x0), X(x1)), b = Math.max(X(x0), X(x1))
    houseInside.push({ min: V(a, 0, z0), max: V(b, H2, z1) })
    solidsFP.push([a, z0, b, z1])
  }


  // the corner house inside: floors, skirting, lights, a few props — all
  // visual (no colliders, kept out of the walking lines)
  function houseInterior(sx) {
    var X = function (x) { return sx < 0 ? x : -x }
    var sl = function (mat, a, y0, c, b, y1, d) { t.slab(mat, Math.min(X(a), X(b)), y0, c, Math.max(X(a), X(b)), y1, d) }
    var floorW = M('wood_pallet'), trim = M('wood_dark'), rug = M(sx < 0 ? 'paint_teal' : 'paint_red')
    // plank floors (ground + upstairs, leaving the stair hole)
    sl(floorW, -8.7, 0.0, -16.7, -3.3, 0.02, -9.3)
    sl(floorW, -7.3, 3.25, -16.7, -3.3, 3.27, -9.3)
    sl(floorW, -8.7, 3.25, -11.6, -7.3, 3.27, -9.3)
    sl(rug, -6.6, 0.02, -12.8, -4.6, 0.03, -10.6)
    // skirting boards
    for (var y of [0, 3.25]) {
      sl(trim, -8.7, y, -16.7, -3.3, y + 0.12, -16.66)
      sl(trim, -8.7, y, -9.34, -3.3, y + 0.12, -9.3)
      sl(trim, -3.34, y, -16.7, -3.3, y + 0.12, -9.3)
    }
    // ceiling lights + wall sconces
    t.box(glow, 0.6, 0.05, 0.6, X(-5.5), 6.15, -13)
    t.box(glow, 0.12, 0.25, 0.08, X(-6.0), 2.1, -16.62)
    t.box(glow, 0.12, 0.25, 0.08, X(-4.6), 5.3, -16.62)
    // pictures on the walls
    t.box(M('paint_white'), 0.9, 0.6, 0.03, X(-6.4), 1.7, -16.66)
    t.box(M(sx < 0 ? 'paint_blue' : 'paint_orange'), 0.76, 0.46, 0.035, X(-6.4), 1.7, -16.66)
    t.box(M('paint_white'), 0.03, 0.7, 1.0, X(-3.36), 4.7, -13.2)
    // props: boxes in the corner by the stairs, a mattress under the east window upstairs
    place('cardboard_boxes', X(-6.9), -10.0, 0.3, { seed: 91 + sx }, 0, { noCol: true })
    place('crate_wood', X(-3.9), -9.9, 0.1, { seed: 92 + sx }, 0, { noCol: true })
    sl(M('tarp'), -4.1, 3.27, -16.4, -3.4, 3.5, -14.4)
    sl(M('cardboard'), -4.05, 3.5, -16.3, -3.45, 3.62, -15.8)
    place('jerry_can', X(-8.4), -13.8, 0.4, { seed: 93 + sx }, 3.27, { noCol: true })
  }

  // swap the procedural facades for the models (once, when they are parsed)
  var applied = false
  function applyModels() {
    if (applied || !CXR_GLB.ready) return
    applied = true
    try {
      var add = new lt.Group()
      add.name = 'cx-models'
      buildApartments(add)
      buildShops(add)
      buildFences(add)
      if (houseInside.length) buildHouseSkins(add) // (no corner houses on this layout)
      buildStreet(add)
      buildStairs(add)
      buildFacades(add)
      root.add(add)
      if (fbMerged) fbMerged.visible = false
      if (fbHouseMerged) fbHouseMerged.visible = false
      if (i.renderer && i.renderer.shadowMap) i.renderer.shadowMap.needsUpdate = true
      modelsOn = true
    } catch (e) {
      console.error('[crossroads] models failed, keeping the procedural facades', e)
    }
  }
  var modelsOn = false

  // old apartment blocks: one unit-cube model, an instance per block (long
  // rows tiled every ~13 m), the model's front on the street side
  function buildApartments(add) {
    var parts = CXR_bake(CXR_GLB.cx_oldap), B = CXR_box(parts), sz = B.getSize(new lt.Vector3())
    var norm = new lt.Matrix4().makeScale(1 / sz.x, 1 / sz.y, 1 / sz.z).multiply(new lt.Matrix4().makeTranslation(-(B.min.x + B.max.x) / 2, -B.min.y, -(B.min.z + B.max.z) / 2))
    var mats = []
    blocks.forEach(function (k) {
      var alongX = k.front === 's' || k.front === 'n'
      var L = alongX ? k.b - k.a : k.d - k.c, D = alongX ? k.d - k.c : k.b - k.a
      var n = Math.max(1, Math.round(L / 13)), w = L / n
      var yaw = k.front === 's' ? 0 : k.front === 'n' ? Math.PI : k.front === 'e' ? Math.PI / 2 : -Math.PI / 2
      for (var j = 0; j < n; j++) {
        var cx = alongX ? k.a + w * (j + 0.5) : (k.a + k.b) / 2, cz = alongX ? (k.c + k.d) / 2 : k.c + w * (j + 0.5)
        mats.push(CXR_trs(cx, 0, cz, yaw, w + 0.02, k.h, D + 0.02))
      }
    })
    if (mats.length) parts.forEach(function (p) {
      var g = p.geo.clone().applyMatrix4(norm)
      add.add(CXR_inst(g, p.mat, mats))
    })
    // the enterable buildings: one instance each, scaled by the wall planes
    // (so the window holes land on the inner walls' openings); no glass, no
    // recessed door (the doorway is open), no roof surface, no hoods on the
    // party walls (they would poke into the next building)
    if (!units.length) return
    var un = new lt.Matrix4().makeScale(1 / (OAP.x1 - OAP.x0), 1 / OAP.h, 1 / (OAP.z1 - OAP.z0)).multiply(new lt.Matrix4().makeTranslation(-(OAP.x0 + OAP.x1) / 2, 0, -(OAP.z0 + OAP.z1) / 2))
    // two sets: back on a street (back door, hoods) / back against a
    // building or the outside (no back hoods, they would poke into the next one)
    ;[true, false].forEach(function (open) {
      var us = units.filter(function (u) { return !!u.backDoor === open })
      if (!us.length) return
      var umats = us.map(function (u) { return CXR_trs(u.cx, 0, u.cz, u.yaw, u.W, u.h, u.D) })
      parts.forEach(function (p) {
        if (/glass/i.test(p.mat && p.mat.name || '')) return
        var g = CXR_filter(p.geo, function (x, y, z, y0, y1) {
          if (x > -88 && x < 35 && y < 94 && ((z > 74 && z < 107) || (z > -131 && z < -99))) return false // front/back vestibules + doors
          if (y1 < 2 && x > -326 && x < 273 && z > -131 && z < 107) return false // hallway strip
          if (y0 > 444 && y1 < 446) return false // roof surface
          if ((x < -328 || x > 275) && y1 < 440) return false // side hoods
          if (!open && z < -133 && y1 < 440) return false // back hoods
          // the wall planes and their small window reveals: the procedural
          // facade with the firing windows replaces them (hoods, fins,
          // cornice, roof edge and the door canopy stay)
          if (y1 < 441.5 && x > -328 && x < 275 && ((z > 101.5 && z < 108.7) || (z < -125.5 && z > -132.7))) return false
          if (y1 < 441.5 && z > -133 && z < 109 && ((x < -320.5 && x > -327.7) || (x > 267.5 && x < 274.7))) return false
          return true
        })
        add.add(CXR_inst(g.applyMatrix4(un), p.mat, umats))
      })
    })
  }

  // market alley shops: two rows cut from the pack, instanced along both walls
  function buildShops(add) {
    var parts = CXR_bake(CXR_GLB.cx_shops)
    var rowA = /(^|\/)Plane(100|101|102|103|104|116|123|131)_/, rowB = /(^|\/)Plane(111|114|115|118|119|120|126|127|130|133)_/
    var rows = [{ re: rowA, at: [] }, { re: rowB, at: [] }]
    // the north buildings' alley faces (z=-17, facing -z): the first 11.6 m
    // of row A (west building) and of row B (east building)
    rows.forEach(function (r, k) {
      var ps = parts.filter(function (p) { return r.re.test(p.path) })
      if (!ps.length) return
      var B = CXR_box(ps)
      r.len = B.max.x - B.min.x
      var shift = new lt.Matrix4().makeTranslation(-B.min.x, -B.min.y, 0)
      // the shop fronts sit on enterable buildings: keep the sign bands and
      // awnings, drop the shutters/doors below 2.3 m and everything behind
      // the wall plane, so the building's own door and windows show through
      var crop = function (x, y, z) { return !(z < -0.2 || (y < 2.3 && z < 0.75)) }
      r.geos = CXR_byMat(ps.map(function (p) { return { geo: CXR_filter(p.geo.clone().applyMatrix4(shift), function (x, y, z) { return x < 11.6 && crop(x, y, z) }), mat: p.mat } }))
      r.at.push(k === 0 ? [-9.2, -17, Math.PI] : [20.8, -17, Math.PI])
    })
    rows.forEach(function (r, k) {
      if (!r.geos) return
      var mats = r.at.map(function (q) { return CXR_trs(q[0], 0, q[1], q[2], q[3] || 1, 1, 1) })
      r.geos.forEach(function (gm) { add.add(CXR_inst(gm.geo, gm.mat, mats)) })
    })
  }

  // graffiti fence panels (4 m) + concrete posts, one instanced mesh per graffiti
  function buildFences(add) {
    var parts = CXR_bake(CXR_GLB.cx_fence)
    var find = function (re, mre) { return parts.filter(function (p) { return re.test(p.path) && (!mre || mre.test(p.mat && p.mat.name || '')) }) }
    var face = find(/PanelStyle_A/, /graffiti/)[0], frame = find(/PanelStyle_A/, /wood/)[0], post = find(/Post_concrete/)[0]
    if (!face || !frame) return
    var variants = []
    parts.forEach(function (p) { var nm = p.mat && p.mat.name || ''; if (/graffiti\d/.test(nm) && !variants.some(function (v) { return v.name === nm })) variants.push(p.mat) })
    var cen = new lt.Matrix4().makeTranslation(-0.5, 0, 0.7), pcen = new lt.Matrix4().makeTranslation(2.5, 0, 0.69)
    var spots = fenceSpots
    var frameM = [], postM = [], byVar = variants.map(function () { return [] })
    spots.forEach(function (q, k) {
      var m = CXR_trs(q[0], 0, q[1], q[2], 1, 1, 1)
      frameM.push(m)
      byVar[k % byVar.length].push(m)
      var dx = Math.cos(q[2]) * 2, dz = -Math.sin(q[2]) * 2
      postM.push(CXR_trs(q[0] + dx, 0, q[1] + dz, q[2], 1, 1, 1))
    })
    add.add(CXR_inst(frame.geo.clone().applyMatrix4(cen), frame.mat, frameM))
    variants.forEach(function (mat, k) { if (byVar[k].length) add.add(CXR_inst(face.geo.clone().applyMatrix4(cen), mat, byVar[k])) })
    if (post) add.add(CXR_inst(post.geo.clone().applyMatrix4(pcen), post.mat, postM))
  }

  // the street kit: one instanced mesh per piece (single shared material)
  function buildStreet(add) {
    var parts = CXR_bake(CXR_GLB.cx_street)
    var piece = function (nm) { var re = new RegExp('(^|/)' + nm + '(_streets_0)?(/|$)'); return parts.filter(function (p) { return re.test(p.path) || re.test(p.name || '') })[0] }
    var M4 = function () { return new lt.Matrix4() }
    // geometry → unit tile: centre on its bbox, x/z by the tile size, y by the height scale
    var unit = function (geo, size, y0, sy) {
      geo.computeBoundingBox()
      var b = geo.boundingBox, sx = size ? 1 / size[0] : 1 / (b.max.x - b.min.x), sz = size ? 1 / size[1] : 1 / (b.max.z - b.min.z)
      return geo.applyMatrix4(M4().makeScale(sx, sy, sz).multiply(M4().makeTranslation(-(b.min.x + b.max.x) / 2, -y0, -(b.min.z + b.max.z) / 2)))
    }
    var tiles = function (list, geo, mat) {
      if (!list.length || !geo) return
      add.add(CXR_inst(geo, mat, list.map(function (q) { return CXR_trs(q[0], KIT.lift, q[1], q[4], q[2], 1, q[3]) }), false))
    }
    var st = piece('streetstraight_4'), dr = piece('streetstraight'), pl = piece('streetplane'), co = piece('streetcornerOUt')
    var li = piece('streetlight1'), mh = piece('manhole'), pi = piece('pilar')
    if (!st) return
    var mat = st.mat
    tiles(road.straight, unit(st.geo.clone(), [800, 800], 0, KIT.sy), mat)
    if (dr) tiles(road.drain, unit(dr.geo.clone(), [800, 800], 0, KIT.sy), mat)
    // road only: the asphalt half of a straight tile, stretched over the patch
    var asphalt = CXR_filter(st.geo, function (x, y, z) { return y > -2 && y < 2 && z > 846 })
    tiles(road.patch, unit(asphalt, null, 0, KIT.sy), mat)
    if (pl) tiles(road.plane, unit(pl.geo.clone(), [800, 800], 17.342, 1), mat)
    if (co) tiles(road.corner, unit(co.geo.clone(), [800, 800], 0, KIT.sy), mat)
    var props = function (list, geo, y, s, sy) {
      if (!list.length || !geo) return
      geo.computeBoundingBox()
      add.add(CXR_inst(geo, mat, list.map(function (q) { return CXR_trs(q[0], y, q[1], q[2] || 0, s, sy || s, s) })))
    }
    // streetlight: pole foot at the origin, arm towards +z (the lamp's yaw)
    if (li) props(road.lamp, li.geo.clone().applyMatrix4(M4().makeTranslation(-250, -10.2, -700)), KIT.side, 6.2 / 461)
    if (mh) props(road.manhole, unit(mh.geo.clone(), [160, 160], 0, KIT.sy), KIT.lift, 1, 1)
    if (pi) props(road.pilar, unit(pi.geo.clone(), [130, 130], 15.7, 1 / 130), KIT.side, 1, 1)
  }

  // the enterable buildings' facades: the apartment model's brick (a strip
  // cropped from its atlas, mirrored-tiled) over each wall minus its openings
  function buildFacades(add) {
    var tex = CXR_GLB.tex.oabrick
    if (!tex || !units.length) return
    var pos = [], nrm = [], uv = []
    units.forEach(function (u) {
      (u.faces || []).forEach(function (f) {
        var lo = f.x ? -u.W / 2 : -u.D / 2, hi = -lo
        var n = L2Wd(u, f.n[0], f.n[1]), alongX = Math.abs(n[1]) > 0.5, off = 0.004
        var P = function (a, y) { var w = f.x ? L2W(u, a, f.at) : L2W(u, f.at, a); return [w[0] + n[0] * off, y, w[1] + n[1] * off] }
        rectsR(lo, hi, 0, u.h, f.holes.concat(f.shut)).forEach(function (r) {
          var A = P(r[0], r[2]), B = P(r[1], r[2]), C = P(r[1], r[3]), Dd = P(r[0], r[3])
          // wind so the face points outwards
          var e1 = [B[0] - A[0], B[2] - A[2]], cz = e1[0] * n[1] - e1[1] * n[0] // sign of (B-A)×up·n
          var quad = cz > 0 ? [A, B, C, A, C, Dd] : [A, Dd, C, A, C, B]
          quad.forEach(function (q) {
            pos.push(q[0], q[1], q[2]); nrm.push(n[0], 0, n[1])
            uv.push((alongX ? q[0] : q[2]) / 1.5, q[1] / 12.3)
          })
        })
      })
    })
    var g = new lt.BufferGeometry()
    g.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new lt.Float32BufferAttribute(nrm, 3))
    g.setAttribute('uv', new lt.Float32BufferAttribute(uv, 2))
    var me = new lt.Mesh(g, new lt.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 }))
    me.name = 'cx-facades'
    me.castShadow = true; me.receiveShadow = true
    add.add(me)
  }

  // stairs: the steel C-channel stair model, a tread (+ its two brackets)
  // instanced on every collision step and the stringers stretched over every
  // flight; recoloured to the street kit's greys and curb stone
  function buildStairs(add) {
    var parts = CXR_bake(CXR_GLB.cx_stair)
    var by = function (re) { return parts.filter(function (p) { return re.test(p.mat && p.mat.name || '') }) }
    var tread = by(/material_3/)[0], brk = by(/material_2/)[0], str = by(/material_4/)[0]
    if (!tread || !str || !stairRuns.length) return
    var mk = function (c, rough, metal) { return new lt.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal || 0 }) }
    var mTread = mk(0x8e8b85, 0.92), mBrk = mk(0x9d8b6b, 0.85), mSteel = mk(0x3b3f43, 0.55, 0.45)
    tread.geo.computeBoundingBox(); str.geo.computeBoundingBox()
    var tb = tread.geo.boundingBox, sb = str.geo.boundingBox, M4 = function () { return new lt.Matrix4() }
    // model: width along x (stringer to stringer, centred on the treads), up the run = -z, y up
    var cx = (sb.min.x + sb.max.x) / 2, W0 = sb.max.x - sb.min.x
    var tShift = M4().makeTranslation(-cx, -tb.max.y, -(tb.min.z + tb.max.z) / 2)
    var sShift = M4().makeTranslation(-cx, -sb.min.y, -(sb.min.z + sb.max.z) / 2)
    var PITCH = 11, RISE = (sb.max.y - sb.min.y) / 20 // the model: 19 treads, 20 rises
    var tm = [], sm = []
    stairRuns.forEach(function (r) {
      var yaw = Math.atan2(-r.d[0], -r.d[1]), Lf = r.n * r.run
      for (var j = 0; j < r.n; j++) {
        var a = (j + 0.5) * r.run
        tm.push(CXR_trs(r.p[0] + r.d[0] * a, r.y + (j + 1) * r.rise, r.p[1] + r.d[1] * a, yaw, r.w / W0, r.rise / RISE, r.run / PITCH))
      }
      sm.push(CXR_trs(r.p[0] + r.d[0] * Lf / 2, r.y, r.p[1] + r.d[1] * Lf / 2, yaw, r.w / W0, r.n * r.rise / (sb.max.y - sb.min.y), Lf / (sb.max.z - sb.min.z)))
    })
    // indoors: no shadow casting (an instanced set spans the whole map, so it
    // would be drawn into every shadow pass)
    var g = new lt.Group()
    g.name = 'cx-stairs'
    g.add(CXR_inst(tread.geo.clone().applyMatrix4(tShift), mTread, tm, false))
    if (brk) g.add(CXR_inst(brk.geo.clone().applyMatrix4(tShift), mBrk, tm, false))
    g.add(CXR_inst(str.geo.clone().applyMatrix4(sShift), mSteel, sm, false))
    add.add(g)
    stairStats = { flights: stairRuns.length, treads: tm.length }
  }
  var stairStats = null

  // corner houses: brick + quoins + stone bands + white trims + sash windows
  // from the brick house's atlas over the procedural shell (openings left
  // open), and its tiled roof on top
  function buildHouseSkins(add) {
    var T = CXR_GLB.tex
    var mk = function (map, rough) { var m = new lt.MeshStandardMaterial({ map: map || null, color: map ? 0xffffff : 0xe4dfd4, roughness: rough || 0.9, metalness: 0 }); return m }
    var mBrick = mk(T.brick), mQuoin = mk(T.quoin), mBand = mk(T.band), mCorn = mk(T.cornice), mSash = mk(T.sash, 0.5), mTrim = mk(null, 0.75)
    var Q = { brick: [], quoin: [], band: [], corn: [], sash: [] }, trims = []
    // quad on a face: n = outward axis ('+z','-z','+x','-x'), p = plane coord,
    // [w0,w1] along the face (world), [y0,y1]; uv tiles (tu, tv) or 0..1
    function quad(list, n, p, w0, w1, y0, y1, off, tu, tv) {
      var sg = n.charAt(0) === '+' ? 1 : -1, ax = n.charAt(1), pp = p + sg * off
      // "right" seen from outside: +z→+x, -z→-x, +x→-z, -x→+z
      var right = ax === 'z' ? sg : -sg, L = right > 0 ? w0 : w1, R = right > 0 ? w1 : w0
      var P = function (w, y) { return ax === 'z' ? [w, y, pp] : [pp, y, w] }
      var a = P(L, y0), b = P(R, y0), c = P(R, y1), d = P(L, y1)
      var nx = ax === 'x' ? sg : 0, nz = ax === 'z' ? sg : 0
      var U = function (w) { return tu ? Math.abs(w - L) / tu : (w === L ? 0 : 1) }
      var Vv = function (y) { return tv ? y / tv : (y === y0 ? 0 : 1) }
      var ua = U(L), ub = U(R)
      if (!tu) { ua = 0; ub = 1 }
      var va = tv ? Vv(y0) : 0, vb = tv ? Vv(y1) : 1
      list.push([a, b, c, d, [nx, 0, nz], [ua, va, ub, va, ub, vb, ua, vb]])
    }
    // the face minus its openings, as cells
    function cells(w0, w1, y0, y1, holes) {
      var xs = [w0, w1], ys = [y0, y1]
      holes.forEach(function (h) { xs.push(Math.max(w0, Math.min(w1, h[0])), Math.max(w0, Math.min(w1, h[1]))); ys.push(Math.max(y0, Math.min(y1, h[2])), Math.max(y0, Math.min(y1, h[3]))) })
      xs = xs.sort(function (a, b) { return a - b }).filter(function (v, k, A) { return k === 0 || v - A[k - 1] > 1e-4 })
      ys = ys.sort(function (a, b) { return a - b }).filter(function (v, k, A) { return k === 0 || v - A[k - 1] > 1e-4 })
      var out = []
      for (var a = 0; a + 1 < xs.length; a++) for (var b = 0; b + 1 < ys.length; b++) {
        var cx = (xs[a] + xs[a + 1]) / 2, cy = (ys[b] + ys[b + 1]) / 2
        if (holes.some(function (h) { return cx > h[0] && cx < h[1] && cy > h[2] && cy < h[3] })) continue
        out.push([xs[a], xs[a + 1], ys[b], ys[b + 1]])
      }
      return out
    }
    function trimBox(n, p, w0, w1, y0, y1) {
      var ax = n.charAt(1), sg = n.charAt(0) === '+' ? 1 : -1, d = 0.07
      var g = new lt.BoxGeometry(ax === 'z' ? w1 - w0 : d, y1 - y0, ax === 'z' ? d : w1 - w0)
      g.translate(ax === 'z' ? (w0 + w1) / 2 : p + sg * d / 2, (y0 + y1) / 2, ax === 'z' ? p + sg * d / 2 : (w0 + w1) / 2)
      trims.push(g.toNonIndexed())
    }
    function frameHole(n, p, h, sill) {
      var t2 = 0.12
      trimBox(n, p, h[0] - t2, h[0], h[2], h[3] + t2)
      trimBox(n, p, h[1], h[1] + t2, h[2], h[3] + t2)
      trimBox(n, p, h[0] - t2, h[1] + t2, h[3], h[3] + t2)
      if (sill) trimBox(n, p, h[0] - 0.18, h[1] + 0.18, h[2] - 0.1, h[2])
    }
    ;[-1, 1].forEach(function (sx) {
      var X = function (x) { return sx < 0 ? x : -x }
      var R = function (a, b) { return [Math.min(X(a), X(b)), Math.max(X(a), X(b))] }
      var hx = function (a, b, y0, y1) { var r = R(a, b); return [r[0], r[1], y0, y1] }
      var hz = function (a, b, y0, y1) { return [Math.min(a, b), Math.max(a, b), y0, y1] }
      var faces = [
        { n: '+z', p: -9, w: R(-9, -3), holes: [hx(-6.6, -5.0, 0, 2.3), hx(-8.4, -7.2, 4.15, 5.55), hx(-6.4, -4.2, 3.25, 5.55)], fakes: [hx(-8.4, -7.2, 0.8, 2.45)], sills: [1] },
        { n: sx < 0 ? '+x' : '-x', p: X(-3), w: [-17, -9], holes: [hz(-14.2, -12.6, 0, 2.3), hz(-15.6, -14.2, 4.15, 5.55), hz(-12.2, -10.8, 4.15, 5.55)], fakes: [hz(-16.4, -15.2, 0.8, 2.45), hz(-11.6, -10.4, 0.8, 2.45)], sills: [1, 2] },
        { n: '-z', p: -17, w: R(-9, -3), holes: [hx(-5.8, -4.2, 0, 2.3)], fakes: [hx(-8.2, -7.0, 0.8, 2.45), hx(-8.0, -6.8, 4.0, 5.65), hx(-5.6, -4.4, 4.0, 5.65)], sills: [] },
      ]
      faces.forEach(function (f) {
        var w0 = f.w[0], w1 = f.w[1], H = 6.2
        var cut = f.holes.concat(f.fakes)
        cells(w0, w1, 0.45, 2.92, cut).concat(cells(w0, w1, 3.38, 5.85, cut)).forEach(function (c) { quad(Q.brick, f.n, f.p, c[0], c[1], c[2], c[3], 0.02, 0.93, 2.07) })
        cells(w0, w1, 0, 0.45, f.holes).forEach(function (c) { quad(Q.band, f.n, f.p, c[0], c[1], c[2], c[3], 0.03, 3.9, 0.5) })
        cells(w0, w1, 2.92, 3.38, f.holes).forEach(function (c) { quad(Q.band, f.n, f.p, c[0], c[1], c[2], c[3], 0.05, 3.9, 0.5) })
        cells(w0, w1, 5.85, H, f.holes).forEach(function (c) { quad(Q.corn, f.n, f.p, c[0], c[1], c[2], c[3], 0.04, 5.0, 0.35) })
        // quoins up both corners
        quad(Q.quoin, f.n, f.p, w0 - 0.02, w0 + 0.42, 0.45, 5.85, 0.035, 0.44, 2.87)
        quad(Q.quoin, f.n, f.p, w1 - 0.42, w1 + 0.02, 0.45, 5.85, 0.035, 0.44, 2.87)
        f.holes.forEach(function (h, k) { frameHole(f.n, f.p, h, f.sills.indexOf(k) >= 0) })
        f.fakes.forEach(function (h) { quad(Q.sash, f.n, f.p, h[0], h[1], h[2], h[3], 0.025, 0, 0); frameHole(f.n, f.p, h, true) })
      })
    })
    var geoOf = function (list) {
      var pos = [], nrm = [], uv = []
      list.forEach(function (q) {
        var v = [q[0], q[1], q[2], q[0], q[2], q[3]], u = q[5], ui = [[u[0], u[1]], [u[2], u[3]], [u[4], u[5]], [u[0], u[1]], [u[4], u[5]], [u[6], u[7]]]
        for (var k = 0; k < 6; k++) { pos.push(v[k][0], v[k][1], v[k][2]); nrm.push(q[4][0], q[4][1], q[4][2]); uv.push(ui[k][0], ui[k][1]) }
      })
      var g = new lt.BufferGeometry()
      g.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
      g.setAttribute('normal', new lt.Float32BufferAttribute(nrm, 3))
      g.setAttribute('uv', new lt.Float32BufferAttribute(uv, 2))
      return g
    }
    var addMesh = function (g, m) { var me = new lt.Mesh(g, m); me.castShadow = true; me.receiveShadow = true; add.add(me) }
    addMesh(geoOf(Q.brick), mBrick); addMesh(geoOf(Q.quoin), mQuoin); addMesh(geoOf(Q.band), mBand); addMesh(geoOf(Q.corn), mCorn); addMesh(geoOf(Q.sash), mSash)
    if (trims.length) addMesh(Ii(trims), mTrim)
    // the tiled roof: the brick house's cornice + roof (model y ≥ 470), on the flat roof
    var parts = CXR_bake(CXR_GLB.cx_ap13), roof = []
    parts.forEach(function (p) {
      var g = p.geo.index ? p.geo.toNonIndexed() : p.geo, pa = g.attributes.position, keep = []
      for (var k = 0; k < pa.count; k += 3) if (pa.getY(k) >= 470 && pa.getY(k + 1) >= 470 && pa.getY(k + 2) >= 470) keep.push(k)
      if (!keep.length) return
      var out = new lt.BufferGeometry()
      ;['position', 'normal', 'uv'].forEach(function (nm) {
        var a = g.attributes[nm]; if (!a) return
        var arr = new Float32Array(keep.length * 3 * a.itemSize), o = 0
        keep.forEach(function (k) { for (var j = 0; j < 3; j++) for (var c = 0; c < a.itemSize; c++) arr[o++] = a.getComponent(k + j, c) })
        out.setAttribute(nm, new lt.BufferAttribute(arr, a.itemSize))
      })
      roof.push({ geo: out, mat: p.mat })
    })
    if (roof.length) {
      var RB = CXR_box(roof), rs = RB.getSize(new lt.Vector3())
      var s = 6.5 / rs.x
      roof.forEach(function (r) {
        var mats = [-1, 1].map(function (sx) { return CXR_trs(sx * 6, 6.2, -13, 0, s, s, 8.5 / rs.z) })
        var g = r.geo.clone().applyMatrix4(new lt.Matrix4().makeTranslation(-(RB.min.x + RB.max.x) / 2, -RB.min.y, -(RB.min.z + RB.max.z) / 2))
        add.add(CXR_inst(g, r.mat, mats))
      })
    }
  }

  half(-1)
  half(1)

  // graffiti fence panels (models, visual) — [x, z, yaw] centres; the south
  // street row leaves the ring doors clear, and windows behind a panel stay shut
  var fenceSpots = []
  ;[-1, 1].forEach(function (s) {
    var inward = s < 0 ? Math.PI / 2 : -Math.PI / 2
    fenceSpots.push([s * 32.86, -5.0, inward], [s * 32.86, 5.0, inward]) // base back wall corners (team stripe stays visible)
    fenceSpots.push([s * 41.86, -20.0, inward], [s * 41.86, -24.5, inward]) // the yard wall
    fenceSpots.push([s * 41.86, 15.6, inward], [s * 41.86, 19.6, inward], [s * 41.86, 6.0, inward])
  })
  units.forEach(buildUnit)
  units.forEach(screenRoof)

  // window glass: a pane in every open window of the enterable buildings
  // (doors and shutters have none); see CXR_glassBuild below
  var panes = []
  units.forEach(function (u) {
    ;(u.faces || []).forEach(function (f) {
      f.holes.forEach(function (o) {
        if (f.doors.indexOf(o) >= 0 || o[3] - o[2] > 1.9) return // doors / shop doorways: no glass
        var mid = (o[0] + o[1]) / 2, lx = f.x ? mid : f.at, lz = f.x ? f.at : mid
        var w = L2W(u, lx, lz), n = L2Wd(u, f.n[0], f.n[1]), ax = L2Wd(u, f.x ? 1 : 0, f.x ? 0 : 1)
        var nn = V(n[0], 0, n[1]).normalize()
        // mid-wall (the inner walls are 20 cm thick, 2 cm inside the facade plane)
        panes.push({ c: V(w[0] - nn.x * 0.12, (o[2] + o[3]) / 2, w[1] - nn.z * 0.12), n: nn, ax: V(ax[0], 0, ax[1]).normalize(), w: o[1] - o[0], h: o[3] - o[2], y0: o[2] })
      })
    })
  })

  /* ---- the crossing x[-9,9] z[-9,9]: sunk and flooded --------------------- */
  // The intersection is a shallow basin (CXR_POOL, the walkable height field
  // CXR_heightGrid): a 0.6 m deep square bowl with gentle ramps from all four
  // streets, flooded to 0.3 m with murky water (CXR_poolBuild). Wading slows
  // nobody, but every step and every bullet splashes. Cover in the water:
  // the two wrecks, sandbag nests, a crate stack and the relay's plinth.
  var hP = CXR_height
  wreck(-5.8, 5.2, -0.45, 'steel_rust', hP(-5.8, 5.2))
  wreck(5.8, 5.2, Math.PI + 0.45, 'steel_rust', hP(5.8, 5.2))
  sandbags(-4.4, -6.4, 0.35, 1, hP(-4.4, -6.4))
  sandbags(4.4, -6.4, -0.35, 1, hP(4.4, -6.4))
  place('crate_stack', -3.3, -1.2, 0.2, { seed: 85 }, hP(-3.3, -1.2))
  place('pallet_stack', 3.3, -1.0, -0.15, { seed: 86 }, hP(3.3, -1.0))
  place('pallet', 1.6, 1.8, 0.6, { seed: 87 }, hP(1.6, 1.8))
  // the relay stands on a concrete plinth, just clear of the water
  blk(conc, -0.75, hP(0, 5.4) - 0.02, 4.65, 0.75, -0.06, 6.15, true)
  for (var lp of [[-8.3, -8.3], [8.3, -8.3], [-8.3, 8.3], [8.3, 8.3]]) lamp(lp[0], lp[1], Math.atan2(-lp[0], -lp[1]))
  place('traffic_cone', -1.8, -7.6, 0, { seed: 81 }, hP(-1.8, -7.6))
  place('bollard_post', -3.6, 8.6, 0, { seed: 83 })
  place('bollard_post', 3.6, 8.6, 0, { seed: 84 })
  // crossing stripes on the rim (where the streets meet the slope)
  for (var cs = -2.4; cs <= 2.4; cs += 1.2) {
    t.slab(whiteM, cs - 0.3, 0.045, -8.8, cs + 0.3, 0.055, -7.9)
    t.slab(whiteM, cs - 0.3, 0.045, 7.9, cs + 0.3, 0.055, 8.8)
    t.slab(whiteM, -8.8, 0.045, cs - 0.3, -7.9, 0.055, cs + 0.3)
    t.slab(whiteM, 7.9, 0.045, cs - 0.3, 8.8, 0.055, cs + 0.3)
  }
  // pallets on the main street's south sidewalk (the north edge, z = -3.5, stays clear)
  ;[-1, 1].forEach(function (s2) {
    place('pallet_stack', s2 * 11.6, 4.25, 0.05 * s2, { seed: 120 + s2 })
    place('pallet', s2 * 15.2, 4.4, -0.1 * s2, { seed: 122 + s2 })
  })

  /* ---- south street: the gas station (centre) z[14.6,23] -------------- */
  t.slab(dirty, -6.4, 0, 14.6, 6.4, 0.12, 22.6)
  t.col(-6.4, 0, 14.6, 6.4, 0.12, 22.6, 'concrete')
  for (var px of [-5.4, 5.4]) for (var pz of [15.6, 21.0]) { t.cyl(whiteM, 0.2, 4.4, px, 2.2, pz, { seg: 10 }); t.col(px - 0.15, 0, pz - 0.15, px + 0.15, 4.4, pz + 0.15, 'metal') }
  t.slab(whiteM, -6.2, 4.4, 14.9, 6.2, 4.95, 21.7)
  t.slab(redM, -6.3, 4.4, 14.8, 6.3, 4.7, 14.9)
  t.label('FUEL · SNACKS', 0.45, 0, 4.55, 14.76, 'z-', { color: 'white', font: 'sans' })
  for (var gx of [-2.6, 2.6]) {
    t.slab(conc, gx - 0.5, 0.12, 17.4, gx + 0.5, 0.32, 19.6)
    for (var gz of [17.9, 19.1]) {
      t.box(M('paint_red'), 0.6, 1.5, 0.45, gx, 1.07, gz, { bevel: 0.04 })
      t.box(dark, 0.45, 0.35, 0.06, gx, 1.4, gz - 0.25)
    }
    t.col(gx - 0.5, 0, 17.4, gx + 0.5, 0.32, 19.6, 'concrete') // the island, then each pump
    for (var gz2 of [17.9, 19.1]) t.col(gx - 0.3, 0.32, gz2 - 0.25, gx + 0.3, 1.82, gz2 + 0.23, 'metal')
  }

  // (no skyline of unreachable towers beyond the walls: the block is the whole map)

  /* ---- relays + evac van ----------------------------------------------- */
  var relayA = place('relay_node', 0, -20.2, 0.1, { seed: 1 }, 0)
  var relayB = place('relay_node', 0, 5.4, Math.PI, { seed: 2 }, -0.06) // on its plinth in the flooded crossing
  var relayC = place('relay_node', 0, 18.5, 0, { seed: 3 }, 0.12)
  // evac van against the east courtyard wall
  ;(function () {
    var g = new lt.Group()
    g.position.set(31.4, 0, -3.9)
    g.rotation.y = ts
    t.staticRoot.add(g)
    t.box(whiteM, 4.6, 2.0, 2.0, 0, 1.4, 0, { parent: g, bevel: 0.1 })
    t.box(dark, 1.0, 0.8, 1.9, 1.95, 1.75, 0, { parent: g })
    t.box(redM, 4.62, 0.25, 2.02, 0, 1.2, 0, { parent: g })
    for (var wx of [-1.5, 1.5]) for (var wz of [-0.9, 0.9]) t.cyl(tire, 0.38, 0.25, wx, 0.38, wz, { parent: g, axis: 'z', seg: 12 })
    t.label('EVAC', 0.6, 31.4 - 1.03, 1.6, -3.9, 'x-', { color: 'black', font: 'stencil' })
    rv(t, 31.4, -3.9, ts, 4.6, 2.4, 2.0, 'metal')
  })()

  /* ---- merge (same post-process as the port / desert levels) ---------- */
  t.staticRoot.updateMatrixWorld(true)
  var loose = []
  t.staticRoot.traverse(function (z) {
    z.userData && z.userData.noMerge && !(z.parent && dR(z.parent, t.staticRoot)) && loose.push(z)
  })
  for (var lz of loose) t.dynRoot.attach(lz)
  var mset = new Set()
  t.staticRoot.traverse(function (z) { z.isMesh && !Array.isArray(z.material) && mset.add(z.material) })
  var swap = new Map()
  for (var m0 of mset) {
    if (!m0.isMeshStandardMaterial || m0.vertexColors || m0.transparent || !m0.name || !(i.mats.names || []).includes(m0.name)) continue
    try {
      var opt = m0.userData && m0.userData.interior ? { interior: true } : {}
      if (i.mats.get(m0.name, opt) !== m0) continue
      var vc = i.mats.get(m0.name, Object.assign({}, opt, { vertexColors: true }))
      vc !== m0 && mset.has(vc) && swap.set(m0, vc)
    } catch (e) {}
  }
  t.staticRoot.traverse(function (z) {
    if (!z.isMesh || Array.isArray(z.material)) return
    var s2 = swap.get(z.material)
    s2 && (z.material = s2)
    var cast = !z.material.transparent && !z.material.isMeshBasicMaterial
    z.castShadow = cast
    z.receiveShadow = !z.material.isMeshBasicMaterial
  })
  var atlas = { count: 0, update: function () {} }
  try { atlas = rb(t.staticRoot) } catch (e) { console.error('[crossroads] label atlas failed', e) }
  var merged = By(t.staticRoot)
  merged.name = 'level-merged'
  root.add(merged)
  // the replaceable procedural facades, merged on their own so they can hide
  var prepFb = function (G0) {
    G0.updateMatrixWorld(true)
    G0.traverse(function (z) {
      if (!z.isMesh || Array.isArray(z.material)) return
      z.castShadow = !z.material.transparent && !z.material.isMeshBasicMaterial
      z.receiveShadow = !z.material.isMeshBasicMaterial
    })
    var mg = By(G0)
    root.add(mg)
    return mg
  }
  var fbMerged = prepFb(fb), fbHouseMerged = prepFb(fbHouse)
  fbMerged.name = 'cx-facades-procedural'
  root.add(t.dynRoot)
  for (var rel of [relayA, relayB, relayC]) {
    for (var c = rel.children.length - 1; c >= 0; c--) rel.remove(rel.children[c])
    t.dynRoot.add(rel)
  }
  var tris = 0
  merged.traverse(function (z) { if (z.isMesh) tris += (z.geometry.index ? z.geometry.index.count : z.geometry.attributes.position.count) / 3 })

  /* ---- gameplay data ------------------------------------------------------ */
  var playerStart = { pos: V(-26, 0, 0), yaw: -ts }
  var teamSpawns = { blue: { pos: V(-26, 0, 0), yaw: -ts }, red: { pos: V(26, 0, 0), yaw: ts } }
  var objectives = [
    { id: 'relay_a', label: 'Relay A — Market', zone: 'north', pos: V(0, 0, -20.2), object: relayA },
    { id: 'relay_b', label: 'Relay B — Crossing', zone: 'plaza', pos: V(0, -0.06, 5.4), object: relayB },
    { id: 'relay_c', label: 'Relay C — Gas station', zone: 'south', pos: V(0, 0.12, 18.5), object: relayC },
  ]
  var gnd = function (x, z, zone) { return { pos: V(x, 0, z), zone: zone, type: 'ground' } }
  var air = function (x, y, z, zone) { return { pos: V(x, y, z), zone: zone, type: 'air' } }
  // fewer robots on a duel map, all at the lane edges (none in the bases)
  var enemySpawns = []
  ;[-1, 1].forEach(function (s) {
    enemySpawns.push(
      gnd(s * 29, -20.4, 'north'), gnd(s * 13, -20, 'north'),
      gnd(s * 15, -0.4, 'plaza'), gnd(s * 6.8, 2.6, 'plaza'),
      gnd(s * 29.6, 19.8, 'south'), gnd(s * 12, 19.6, 'south'), gnd(s * 38, -24, 'north'), gnd(s * 37, 23.5, 'south'),
      air(s * 18, 10, -20, 'north'), air(s * 13, 11, 0, 'plaza'), air(s * 18, 10, 18, 'south'))
  })
  enemySpawns.push(gnd(0, -13, 'north'), gnd(0, 11, 'south'))
  var zones = [
    { name: 'north', min: [-42, -29], max: [42, -9] },
    { name: 'plaza', min: [-21, -9], max: [21, 9] },
    { name: 'south', min: [-42, 9], max: [42, 29] },
    { name: 'west', min: [-42, -9], max: [-21, 9] },
    { name: 'east', min: [21, -9], max: [42, 9] },
  ]
  var cinematicPath = [
    { pos: [-30, 1.8, 1.2], look: [-19, 2.2, 0] },
    { pos: [-19, 2.2, 3.0], look: [-9, 2.4, 0] },
    { pos: [-12, 2.8, 3.4], look: [0, 2.4, 0] },
    { pos: [-6, 4.2, 7.6], look: [0, 1.8, -4] },
    { pos: [0, 4.8, 8.4], look: [0, 2.0, -16] },
  ]
  var coverPoints = []
  ;[-1, 1].forEach(function (s) {
    coverPoints.push(
      V(s * 22.2, 0, 1.6), V(s * 22.2, 0, -1.6), V(s * 23.4, 0, 5.0), V(s * 23.4, 0, -5.0),
      V(s * 13.4, 0, 3.0), V(s * 13.4, 0, 0.1), V(s * 18.6, 0, -2.8), V(s * 16.2, 0, 3.6),
      V(s * 4.4, 0, -7.4), V(s * 5.8, 0, 3.0), V(s * 5.8, 0, 7.2), V(s * 3.2, 0, 2.6), V(s * 3.2, 0, -2.6),
      V(s * 23, 0, -19.4), V(s * 18, 0, -20.6), V(s * 14.4, 0, -20.6), V(s * 10, 0, -20.6), V(s * 19, 0, -19.4),
      V(s * 17.5, 0, 14.2), V(s * 17.5, 0, 18.0), V(s * 24.5, 0, 18.6), V(s * 11.5, 0, 16.4), V(s * 22, 0, 20.2), V(s * 3.8, 0.12, 16.6),
      V(s * 36.4, 0, -9.5), V(s * 40.4, 0, -9.5), V(s * 35.6, 0, 9.2), V(s * 39.2, 0, 2.6), V(s * 35.6, 0, 19.0), V(s * 38.2, 0, -20.4))
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
  // supplies, mirrored per half (+ a little bait in the plaza)
  var pickupSpots = [
    { pos: V(0, 0, -7.2), kind: 'med_l' },
    { pos: V(0, 0, 7.6), kind: 'grenade' },
  ]
  ;[-1, 1].forEach(function (s) {
    pickupSpots.push(
      { pos: V(s * 28.6, 0, 5.8), kind: 'ammo' }, { pos: V(s * 29.4, 0, -1.0), kind: 'grenade' }, { pos: V(s * 31.4, 0, 0.4), kind: 'med' },
      { pos: V(s * 26.2, 0, 5.6), kind: 'vest1' }, { pos: V(s * 25, 0, -5.8), kind: 'helm1' },
      { pos: V(s * 15, 0, -2.4), kind: 'ammo' }, { pos: V(s * 11, 0, 3.2), kind: 'med_s' },
      { pos: V(s * 21, 0, -19.4), kind: 'shotgun' }, { pos: V(s * 12, 0, -20.4), kind: 'att:grip' }, { pos: V(s * 7.0, 0, -20.6), kind: 'med_s' },
      { pos: V(s * 13, 0, 21.6), kind: 'vest2' }, { pos: V(s * 21, 0, 15.0), kind: 'att:extmag' }, { pos: V(s * 29, 0, 21.4), kind: 'ammo' },
      { pos: V(s * 31.2, 0, -12.2), kind: 'att:stock' }, { pos: V(s * 31.0, 0, 12.4), kind: 'grenade' },
      { pos: V(s * 36, 0, -1.4), kind: 'ammo' }, { pos: V(s * 40, 0, 25.6), kind: 'med_s' }, { pos: V(s * 39.6, 0, -26.6), kind: 'att:comp' })
  })
  // a few supplies upstairs (beside the corner crate of that floor)
  var upPick = { NA: [2, 'sniper'], SA: [1, 'med_s'] }
  units.forEach(function (u) {
    var q = upPick[u.tag]
    if (!q || !u.levels) return
    var p = u.local(u.ix1 - 1.9, u.iz1 - 0.7)
    pickupSpots.push({ pos: V(p[0], u.levels[q[0]] + 0.01, p[1]), kind: q[1] })
  })
  // free-for-all spawn spots (net/net.js): both bases + the lane ends and middles
  var ffaSpawns = [teamSpawns.blue, teamSpawns.red,
    { pos: V(-27, 0, -20.2), yaw: -ts }, { pos: V(27, 0, -20.2), yaw: ts }, { pos: V(-27, 0, 18.8), yaw: -ts }, { pos: V(27, 0, 18.8), yaw: ts },
    { pos: V(4.6, 0, -20.4), yaw: Math.PI }, { pos: V(-4.6, 0, 20.4), yaw: 0 },
    // lane middles, so a 10-player free-for-all still spreads out
    { pos: V(-14, 0, -20.6), yaw: -ts }, { pos: V(14, 0, 20.6), yaw: ts }, { pos: V(14, 0, -20.6), yaw: ts }, { pos: V(-14, 0, 20.6), yaw: -ts },
    // the yards behind the bases
    { pos: V(-38.5, 0, -25.5), yaw: -ts }, { pos: V(38.5, 0, 25.5), yaw: ts }]
  try { CXR_glassBuild(root, panes) } catch (e) { console.error('[crossroads] glass', e) }
  t.updaters.push(CXR_glassTick)
  // spots at street level inside the sunken crossing sit on its floor
  var sink = function (v) { if (v && v.y < 0.05) v.y = Math.min(v.y, CXR_height(v.x, v.z)) }
  pickupSpots.forEach(function (q) { sink(q.pos) })
  coverPoints.forEach(sink)
  enemySpawns.forEach(function (q) { q.type === 'ground' && sink(q.pos) })
  ffaSpawns.forEach(function (q) { sink(q.pos) })
  var warned = false, lt0 = 0
  applyModels() // already parsed (the usual case): no procedural flash
  return {
    root: root,
    map: 'crossroads',
    maxPlayers: 10, // small map: up to 5 vs 5 (room size cap, net/net.js)
    playerStart: playerStart,
    teamSpawns: teamSpawns,
    ffaSpawns: ffaSpawns,
    objectives: objectives,
    extraction: { pos: V(28.8, 0, -3.9), radius: 2.4 },
    enemySpawns: enemySpawns,
    zones: zones,
    interiorBoxes: houseInside,
    buildings: units, // the enterable buildings (rects, storeys, stairs)
    cinematicPath: cinematicPath,
    coverPoints: coverPoints,
    skylights: [],
    pickupSpots: pickupSpots,
    get modelsOn() { return modelsOn },
    get stairs() { return stairStats },
    stats: { units: units.length, windows: unitStats.windows, windowsShut: unitStats.closed, windowsFinned: unitStats.finned, shutWhy: unitStats.why, labelsAtlased: atlas.count, props: t.placed.length, tris: Math.round(tris), meshes: merged.children.length + pR(t.dynRoot) },
    placed: t.placed,
    groundSurfaceAt: function (x, z) {
      if (t.isMetal(x, z)) return 'metal'
      return 'concrete'
    },
    update: function (dt) {
      lt0 += dt
      if (!applied && CXR_GLB.ready) applyModels()
      atlas.update(dt)
      for (var k = 0; k < t.updaters.length; k++) {
        try { t.updaters[k](dt) } catch (e) { warned || ((warned = true), console.error('[crossroads] prop update threw', e)) }
      }
    },
  }
}


/* ==========================================================================
 * Window glass + vaulting (the enterable buildings' windows)
 *
 * Every open window has a pane (one InstancedMesh for all of them). A shot
 * whose trace crosses a pane before it hits anything shatters it (the
 * player's, the robots' — through shots/shots.js SXB.trace — and the other
 * players' in a room, net/net.js); so do explosions nearby and a player
 * vaulting through. Shards fly along the shot, fall and settle, then fade.
 * Vault: stand at a window (inside or out, on that floor), look through it
 * and press jump — you duck over the sill and drop out the other side
 * (upstairs that is a fall: the game's own landing damage applies).
 * Panes come back when a new run starts.
 * ========================================================================== */
var CXR_GL = { panes: [], mesh: null, shards: null, sh: [], on: false, vault: null, hint: null, cand: null, m: null }
var CXR_GLT = { vaultReach: 1.25, vaultFacing: 0.45, vaultT: 0.55, shards: 22, shardLife: 7, pool: 520, blast: 2.6 }

function CXR_paneMatrix(p, m) {
  var q = new lt.Quaternion().setFromAxisAngle(new lt.Vector3(0, 1, 0), Math.atan2(p.n.x, p.n.z))
  return m.compose(p.c, q, p.broken ? new lt.Vector3(0, 0, 0) : new lt.Vector3(p.w, p.h, 1))
}
function CXR_glassBuild(root, panes) {
  var GL = CXR_GL
  GL.panes = panes; GL.m = new lt.Matrix4()
  var mat = new lt.MeshStandardMaterial({ color: 0xa8c3cd, roughness: 0.04, metalness: 0.25, transparent: true, opacity: 0.32, side: lt.DoubleSide, depthWrite: false })
  mat.name = 'cx_glass'
  var mesh = new lt.InstancedMesh(new lt.PlaneGeometry(1, 1), mat, Math.max(1, panes.length))
  mesh.name = 'cx-window-glass'
  mesh.castShadow = mesh.receiveShadow = false
  panes.forEach(function (p, k) { p.k = k; p.broken = false; mesh.setMatrixAt(k, CXR_paneMatrix(p, GL.m)) })
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  root.add(mesh)
  GL.mesh = mesh
  // shard pool: small triangles
  var sg = new lt.BufferGeometry()
  sg.setAttribute('position', new lt.Float32BufferAttribute([-0.07, -0.05, 0, 0.08, -0.04, 0, 0.0, 0.1, 0], 3))
  sg.computeVertexNormals()
  var smat = new lt.MeshStandardMaterial({ color: 0xd2e4ea, roughness: 0.05, metalness: 0.35, transparent: true, opacity: 0.6, side: lt.DoubleSide, depthWrite: false })
  var sm = new lt.InstancedMesh(sg, smat, CXR_GLT.pool)
  sm.name = 'cx-glass-shards'
  sm.frustumCulled = false
  sm.castShadow = sm.receiveShadow = false
  var zero = new lt.Matrix4().makeScale(0, 0, 0)
  GL.sh = []
  for (var i = 0; i < CXR_GLT.pool; i++) { sm.setMatrixAt(i, zero); GL.sh.push({ life: 0, p: new lt.Vector3(), v: new lt.Vector3(), r: new lt.Euler(), rv: new lt.Vector3(), floor: 0, s: 1 }) }
  sm.instanceMatrix.needsUpdate = true
  root.add(sm)
  GL.shards = sm
  GL.next = 0
}
function CXR_glassRestore() {
  var GL = CXR_GL
  if (!GL.mesh) return
  GL.panes.forEach(function (p) { if (p.broken) { p.broken = false; GL.mesh.setMatrixAt(p.k, CXR_paneMatrix(p, GL.m)) } })
  GL.mesh.instanceMatrix.needsUpdate = true
}
// shatter one pane: hit point (or its centre) and the direction it was struck
function CXR_glassBreak(p, at, dir) {
  var GL = CXR_GL, T = CXR_GLT, G = window.__G
  if (!p || p.broken || !GL.mesh) return
  p.broken = true
  GL.mesh.setMatrixAt(p.k, CXR_paneMatrix(p, GL.m))
  GL.mesh.instanceMatrix.needsUpdate = true
  var d = (dir || p.n).clone().setY(0)
  if (d.lengthSq() < 1e-6) d.copy(p.n)
  d.normalize()
  // where the shards land: the floor (or street) on the far side of the pane
  var floor = 0
  try {
    var from = p.c.clone().addScaledVector(d, 0.7); from.y = p.y0 + 0.2
    var h = G && G.physics.raycast(from, new lt.Vector3(0, -1, 0), 40)
    floor = h ? h.point.y : 0
  } catch (e) { }
  var c = at || p.c
  for (var i = 0; i < T.shards; i++) {
    var sd = GL.sh[GL.next]; GL.next = (GL.next + 1) % GL.sh.length
    var u = (Math.random() - 0.5) * p.w, v = (Math.random() - 0.5) * p.h
    sd.p.copy(p.c).addScaledVector(p.ax, u); sd.p.y += v
    // the shards near the hit fly hardest
    var near = 1 - Math.min(1, sd.p.distanceTo(c) / Math.max(0.4, p.w))
    var sp = 0.8 + 3.2 * near * Math.random()
    sd.v.copy(d).multiplyScalar(sp).addScaledVector(p.ax, (Math.random() - 0.5) * 1.6)
    sd.v.y = Math.random() * 1.2 - 0.2
    sd.r.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28)
    sd.rv.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18)
    sd.s = 0.5 + Math.random() * 1.1
    sd.floor = floor + 0.006 + Math.random() * 0.004
    sd.life = T.shardLife * (0.7 + Math.random() * 0.6)
    sd.rest = false
  }
  try {
    G.audio.play('impact_glass', { pos: c.clone(), gain: 1.5, pitch: 0.62 + Math.random() * 0.12 })
    setTimeout(function () { try { G.audio.play('impact_glass', { pos: c.clone(), gain: 1.1, pitch: 0.9 + Math.random() * 0.2 }) } catch (e) { } }, 70)
  } catch (e) { }
}
// a traced shot from o along unit d, stopped at dist: shatter the panes it crosses
function CXR_glassTrace(o, d, dist) {
  var GL = CXR_GL
  if (!GL.mesh || !o || !d) return
  var tmp = CXR_glassTrace.v || (CXR_glassTrace.v = new lt.Vector3())
  for (var i = 0; i < GL.panes.length; i++) {
    var p = GL.panes[i]
    if (p.broken) continue
    var den = d.x * p.n.x + d.z * p.n.z
    if (Math.abs(den) < 1e-4) continue
    var t = ((p.c.x - o.x) * p.n.x + (p.c.z - o.z) * p.n.z) / den
    if (t < 0.05 || t > dist + 0.05) continue
    tmp.copy(o).addScaledVector(d, t)
    var u = (tmp.x - p.c.x) * p.ax.x + (tmp.z - p.c.z) * p.ax.z, v = tmp.y - p.c.y
    if (Math.abs(u) <= p.w / 2 && Math.abs(v) <= p.h / 2) CXR_glassBreak(p, tmp.clone(), d)
  }
}
// a shot known only by origin + direction (another player's, in a room)
function CXR_glassShot(o, d, max) {
  var G = window.__G
  if (!CXR_GL.mesh || !G) return
  var h = null
  try { h = G.physics.raycast(o, d, max || 300) } catch (e) { }
  CXR_glassTrace(o, d, h ? h.dist : max || 300)
}

// the window the player could vault through right now (or null)
function CXR_vaultFind(G) {
  var P = G.player, T = CXR_GLT, f = P.forward || new lt.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw))
  var fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), best = null, bd = 9
  for (var i = 0; i < CXR_GL.panes.length; i++) {
    var p = CXR_GL.panes[i]
    var rx = P.pos.x - p.c.x, rz = P.pos.z - p.c.z
    if (rx * rx + rz * rz > 9) continue
    var sd = rx * p.n.x + rz * p.n.z // + outside, - inside
    var ad = Math.abs(sd)
    if (ad < 0.2 || ad > T.vaultReach) continue
    var lat = rx * p.ax.x + rz * p.ax.z
    if (Math.abs(lat) > p.w / 2 - 0.12) continue
    // feet on the floor this window belongs to (sill 1.0 m above it)
    var dy = p.y0 - P.pos.y
    if (dy < 0.55 || dy > 1.3) continue
    var into = sd > 0 ? -1 : 1 // direction through the window, along n
    if ((fx * p.n.x + fz * p.n.z) * into < T.vaultFacing) continue
    if (ad < bd) { bd = ad; best = { p: p, into: into, lat: Math.max(-p.w / 2 + 0.36, Math.min(p.w / 2 - 0.36, lat)) } }
  }
  if (!best) return null
  // the landing spot on the far side must be free for a crouched player
  var p2 = best.p, ex = p2.c.x + p2.n.x * best.into * 0.75 + p2.ax.x * best.lat, ez = p2.c.z + p2.n.z * best.into * 0.75 + p2.ax.z * best.lat
  var y = p2.y0 + 0.03, r = 0.3, boxes = G.physics.boxes || []
  for (var k = 0; k < boxes.length; k++) {
    var b = boxes[k]
    if (b.bulletOnly) continue
    if (ex + r < b.min.x || ex - r > b.max.x || ez + r < b.min.z || ez - r > b.max.z) continue
    if (b.min.y < y + 1.15 && b.max.y > y + 0.02) return null
  }
  best.end = new lt.Vector3(ex, y, ez)
  best.sill = new lt.Vector3(p2.c.x + p2.ax.x * best.lat - p2.n.x * best.into * 0.05, y, p2.c.z + p2.ax.z * best.lat - p2.n.z * best.into * 0.05)
  return best
}
function CXR_glassInstall(G) {
  var GL = CXR_GL, P = G.player, ph = G.physics
  if (GL.on || !P || !ph || typeof P.update !== 'function' || typeof ph.moveCapsule !== 'function') return
  GL.on = true
  window.__cxGlass = GL // tests
  GL.shot = CXR_glassShot
  // shots: player, robots (shots/shots.js traces), explosions
  if (typeof SXB !== 'undefined' && SXB && SXB.trace) SXB.trace.push(CXR_glassTrace)
  G.events.on('explosion', function (e) {
    if (!e || !e.pos) return
    var r = CXR_GLT.blast * (1 + (e.size || 1))
    GL.panes.forEach(function (p) {
      if (p.broken) return
      var dd = p.c.distanceTo(e.pos)
      if (dd < r) CXR_glassBreak(p, null, p.c.clone().sub(e.pos).normalize())
    })
  })
  G.events.on('game:state', function (e) { if (e && e.state === 'playing' && e.prev && e.prev !== 'paused') CXR_glassRestore() })
  // vault: the player's capsule is carried over the sill while it runs
  var mc = ph.moveCapsule
  ph.moveCapsule = function (pos, vel) {
    var v = GL.vault
    if (v && pos === P.pos) {
      var k = Math.min(1, v.t / CXR_GLT.vaultT)
      if (k < 0.45) pos.lerpVectors(v.from, v.sill, k / 0.45)
      else pos.lerpVectors(v.sill, v.end, (k - 0.45) / 0.55)
      vel.set(0, 0, 0)
      return { onGround: true }
    }
    return mc.apply(this, arguments)
  }
  var upd = P.update
  P.update = function (dt) {
    try { CXR_vaultStep(G, dt || 0) } catch (e) { if (!GL._err) { GL._err = 1; console.error('[crossroads] vault', e) } }
    return upd.apply(this, arguments)
  }
  var hud = (G.hud && G.hud.root) || document.getElementById('app') || document.body
  var hint = document.createElement('div')
  hint.className = 'sx-vprompt cx-vault'
  hint.innerHTML = '<span class="h-key">SPACE</span><span class="sx-vp-t">Vault through window</span>'
  hud.appendChild(hint)
  GL.hint = hint
}
function CXR_vaultStep(G, dt) {
  var GL = CXR_GL, P = G.player, inp = G.input
  var busy = !P.alive || !P.enabled || (G.units && G.units.pilot) || (G.game && G.game.state !== 'playing')
  if (GL.vault) {
    var v = GL.vault
    v.t += dt
    if (inp) inp.crouch = true // duck under the lintel
    if (v.t >= CXR_GLT.vaultT || busy) {
      GL.vault = null
      P.vel.set(v.dir.x * 2.2, 0, v.dir.z * 2.2)
    }
    if (GL.hint && GL.hint._on) { GL.hint._on = false; GL.hint.classList.remove('on') }
    return
  }
  var cand = busy || !P.onGround ? null : CXR_vaultFind(G)
  var on = !!cand
  if (GL.hint && GL.hint._on !== on) { GL.hint._on = on; GL.hint.classList.toggle('on', on) }
  if (cand && inp && inp.pressed && inp.pressed('jump')) {
    var p = cand.p
    if (!p.broken) CXR_glassBreak(p, cand.sill.clone().setY(p.c.y), p.n.clone().multiplyScalar(cand.into))
    GL.vault = { t: 0, from: P.pos.clone(), sill: cand.sill, end: cand.end, dir: p.n.clone().multiplyScalar(cand.into) }
    inp.crouch = true
    try { G.events.emit('player:jump', { pos: P.pos }) } catch (e) { }
  }
}
function CXR_glassTick(dt) {
  var GL = CXR_GL, G0 = window.__G
  if (!GL.on && G0 && window.__ready && G0.player && G0.physics) CXR_glassInstall(G0)
  if (!CXR_POOL.built && G0 && G0.scene && (CXR_POOL.tries = (CXR_POOL.tries || 0) + 1) < 400) { try { CXR_POOL.built = CXR_poolBuild(G0) } catch (e) { CXR_POOL.built = true; console.error('[crossroads] pool', e) } }
  if (CXR_POOL.u) CXR_POOL.u.uT.value += dt
  if (G0 && G0.player) { var pp = G0.player.pos; pp.x = Math.max(CXR_B.x0 + 0.4, Math.min(CXR_B.x1 - 0.4, pp.x)); pp.z = Math.max(CXR_B.z0 + 0.4, Math.min(CXR_B.z1 - 0.4, pp.z)) }
  var sm = GL.shards
  if (!sm) return
  var m = GL.m, q = CXR_glassTick.q || (CXR_glassTick.q = new lt.Quaternion()), sc = CXR_glassTick.s || (CXR_glassTick.s = new lt.Vector3())
  var any = false
  for (var i = 0; i < GL.sh.length; i++) {
    var s = GL.sh[i]
    if (s.life <= 0) continue
    any = true
    s.life -= dt
    if (!s.rest) {
      s.v.y -= 9.8 * dt
      s.p.addScaledVector(s.v, dt)
      s.r.x += s.rv.x * dt; s.r.y += s.rv.y * dt; s.r.z += s.rv.z * dt
      if (s.p.y <= s.floor) { s.p.y = s.floor; s.rest = true; s.r.set(-Math.PI / 2, s.r.y, 0) }
    }
    var k = s.life <= 0 ? 0 : s.s * Math.min(1, s.life / 1.5)
    q.setFromEuler(s.r)
    m.compose(s.p, q, sc.set(k, k, k))
    sm.setMatrixAt(i, m)
  }
  if (any || GL._any) sm.instanceMatrix.needsUpdate = true
  GL._any = any
}
