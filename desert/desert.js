/* ==========================================================================
 * Dust Basin — desert map for DoomZone (?map=desert).
 *
 * Lives inside the bundle's IIFE (inserted before the boot function QC), so
 * it uses the bundle's internals directly: three.js as `lt`, the level
 * builder `ob`, the pump-hall builder `ab`, the merge/label helpers `By`/`rb`,
 * the material tables `Tn`/`c3`/`l1`/`Nt`, sky chunks `Ug`/`Ng`, the world
 * constants `oi`/`Mn`/`en`, radio lines `_l`, etc.  Every top-level name added
 * here is prefixed SXD_, except the shared map switch SX_MAP.
 *
 * map=port (the default) never calls anything below except SXD_T (identity)
 * and SXD_afterGame (adds the map toggle to the title menu).
 * ========================================================================== */

var SX_MAP = (function () {
  var m = null
  try {
    m = new URLSearchParams(location.search).get('map')
  } catch (e) {
    m = null
  }
  if (m !== 'desert' && m !== 'port' && m !== 'crossroads' && m !== 'waterworks') {
    try {
      m = localStorage.getItem('doomzone.map')
    } catch (e) {
      m = null
    }
  }
  return m === 'desert' || m === 'crossroads' || m === 'waterworks' ? m : 'port'
})()
// players per room for maps whose level object is the stock one (port);
// desert/crossroads/waterworks declare maxPlayers in their own level data
var SX_MAP_MAX = { port: 12, desert: 16, crossroads: 10, waterworks: 10 }
var SXD_ON = SX_MAP === 'desert'

/* ---------------------------------------------------------------- text --- */

var SXD_TEXT = {
  'Raising the terminal': 'Raising the outpost',
  'Mixing paint, rust and rain': 'Mixing paint, rust and dust',
  'Stacking containers': 'Laying out the wellfield',
  'Raising the cranes': 'Raising the radio mast',
  'Flooding the apron': 'Drifting the sand',
  'Waking the Harbormaster': 'Waking the Warden',
  'Waiting for first light': 'Waiting for the heat to break',
  'Get to the boat': 'Get to the evac truck',
  Boat: 'Evac',
  'Relays still live — the boat will not wait under fire':
    'Relays still live — the truck will not wait under fire',
  'Hauled out of the water': 'Back on solid ground',
}
function SXD_T(s) {
  if (SX_MAP === 'crossroads' && typeof CXR_TEXT !== 'undefined' && Object.prototype.hasOwnProperty.call(CXR_TEXT, s)) return CXR_TEXT[s]
  if (SX_MAP === 'waterworks' && typeof WW_TEXT !== 'undefined' && Object.prototype.hasOwnProperty.call(WW_TEXT, s)) return WW_TEXT[s]
  return SXD_ON && Object.prototype.hasOwnProperty.call(SXD_TEXT, s) ? SXD_TEXT[s] : s
}
if (SXD_ON) {
  try {
    var SXD_bootMsg = document.getElementById('boot-msg')
    SXD_bootMsg && (SXD_bootMsg.textContent = SXD_T(SXD_bootMsg.textContent))
  } catch (e) {}
}

/* ------------------------------------------------------------ palette --- */

var SXD_SUN_DIR = [-0.6, 0.4, 0.69] // late afternoon, from the south-west
var SXD_WIND = [0.8, 0.6]

/* ----------------------------------------------------------------- sky --- */

var SXD_SKY =
  '\n// DOOMZONE_SKY (desert)\nprecision highp float;\nvarying vec3 vDir;\nuniform float uTime, uEnv, uFlash;\nuniform vec3 uFlashDir;\n' +
  Ug +
  Ng +
  `
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float mu = dot(d, uSunDir);
  float s = max(mu, 0.0);
  float ts = skyToSun(d);
  // clear desert sky: deep zenith, pale dusty horizon, warmer toward the sun
  vec3 hor = mix(uHorAway, uHor, pow(ts, 3.0) * 0.9);
  float hz = pow(1.0 - h, 4.0);
  vec3 col = mix(uZen, hor, hz);
  col = mix(col, uZen * 0.8, smoothstep(0.45, 1.0, h) * 0.45);
  // dust band hugging the horizon
  float band = pow(1.0 - h, 24.0);
  col = mix(col, hor * 1.1 + vec3(0.035, 0.025, 0.012), band * 0.8);
  // mie aureole round the sun
  col += uSunCol * vec3(1.0, 0.88, 0.72) * (pow(s, 5.0) * 0.06 + pow(s, 32.0) * 0.26 + pow(s, 320.0) * 1.2 + pow(s, 4000.0) * 8.0);
  // thin high cirrus, sheared by the wind
  vec2 cuv = d.xz / (h + 0.09);
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * (cuv * vec2(0.24, 0.85)) + vec2(uTime * 0.004, 0.0);
  float c1 = fbm5(q + 3.1);
  float c2 = fbm3(q * vec2(3.0, 0.6) + 11.0);
  float cir = smoothstep(0.56, 0.9, c1 * 0.72 + c2 * 0.36) * smoothstep(0.05, 0.24, h) * (1.0 - smoothstep(0.7, 1.0, h));
  vec3 cirC = mix(uHorAway * 1.5 + vec3(0.05), uSunCol * 0.45 + vec3(0.3, 0.26, 0.22), pow(s, 3.0));
  col = mix(col, cirC, cir * 0.4);
  // sun disk (not in the environment capture: the directional light is the sun there)
  float disk = smoothstep(0.99988, 0.99994, mu);
  col += vec3(1.0, 0.93, 0.80) * disk * 150.0 * (1.0 - uEnv) * (1.0 - cir * 0.4);
  // below the horizon: warm sand bounce (mostly hidden by terrain, but it lights the capture)
  if (d.y < 0.0) {
    float t = clamp(-d.y * 6.0, 0.0, 1.0);
    vec3 low = mix(hor * 0.85, vec3(0.30, 0.22, 0.14), uEnv);
    col = mix(hor, low, smoothstep(0.0, 1.0, t));
  }
  col = mix(col, min(col, vec3(6.0)), uEnv);
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`

/* ------------------------------------------------- rock texture set --- */

var SXD_ROCK_GLSL = `
void surf(vec2 uv){
  float big = fbm(uv, vec2(2.0), 5, 1.0), mid = fbm(uv, vec2(9.0), 5, 2.0), fine = fbm(uv, vec2(64.0), 4, 3.0);
  float warp = (fbm(uv, vec2(3.0, 1.0), 4, 4.0) - 0.5) * 0.25;
  float sv = uv.y * 14.0 + warp * 6.0 + (mid - 0.5) * 0.8;
  float layer = fract(sv);
  vec3 lh = h3(vec2(floor(sv), 0.0), vec2(14.0, 1.0), 5.0);
  float ledge = smoothstep(0.0, 0.09, layer) * smoothstep(1.0, 0.88, layer);
  vec4 cr = vor(uv * vec2(5.0, 3.0) + warp, vec2(5.0, 3.0), 7.0);
  float crack = smoothstep(0.035, 0.008, cr.y - cr.x);
  vec4 po = vor(uv * 90.0, vec2(90.0), 9.0); float pit = step(po.z, 0.3) * smoothstep(0.25, 0.05, po.x);
  float h = 0.55 + (mid - 0.5) * 0.3 + (fine - 0.5) * 0.18 + (lh.x - 0.5) * 0.12;
  h = mix(h * 0.82, h, ledge); h -= crack * 0.35 + pit * 0.08;
  vec3 cA = L(0.74, 0.55, 0.39), cB = L(0.64, 0.43, 0.29), cC = L(0.82, 0.67, 0.50);
  vec3 col = mix(cA, cB, lh.y); col = mix(col, cC, smoothstep(0.7, 1.0, lh.z) * 0.7);
  col *= 0.8 + 0.32 * big + 0.15 * (fine - 0.5);
  float varn = smoothstep(0.55, 0.85, fbm(uv, vec2(18.0, 2.0), 4, 12.0)) * smoothstep(0.4, 0.7, big);
  col = mix(col, col * vec3(0.46, 0.37, 0.31), varn * 0.55);
  col *= 1.0 - crack * 0.55 - pit * 0.25;
  col *= mix(0.84, 1.0, ledge);
  float r = 0.88 + (fine - 0.5) * 0.12 - varn * 0.12;
  float ao = 1.0 - crack * 0.6 - pit * 0.3 - (1.0 - ledge) * 0.25;
  emit(col, 1.0, h, ao, r, 0.0);
}`

/* ----------------------------------------------------------- set-up --- */

// Called from QC with the URL params before any module boots.
function SXD_params(p) {
  if (!SXD_ON) return p
  try {
    SXD_apply()
  } catch (e) {
    console.error('[desert] apply failed', e)
  }
  if (p.wet === undefined) p.wet = '0'
  return p
}

function SXD_apply() {
  // sun + sky palette (read when the render/sky/fx modules are created)
  Mn.dir.set(SXD_SUN_DIR[0], SXD_SUN_DIR[1], SXD_SUN_DIR[2]).normalize()
  Mn.color.setRGB(1.0, 0.83, 0.64)
  Mn.intensity = 10.5
  en.zenith.setRGB(0.15, 0.29, 0.56)
  en.horizon.setRGB(1.15, 0.86, 0.6)
  en.horizonAway.setRGB(0.6, 0.62, 0.64)
  en.fog.setRGB(0.66, 0.56, 0.44)
  // no sea anywhere: the whole basin is solid ground
  oi.quayX = 1e4
  // radio
  _l.intro = 'Breacher, this is Control. The Warden holds Kessler Station. Cut its three uplinks — wellfield, pump hall, mast.'
  _l.all = 'All three dark. The evac truck is idling at the east breach. Run.'
  _l.done = 'Breacher is aboard. Kessler is dark. Good work.'
  // materials: sandstone set + adobe/plaster variants
  Tn.sxd_rock = SXD_ROCK_GLSL
  c3.sxd_rock = { fn: 'sxd_rock', size: 0.5, tile: 3, bump: 9 }
  l1.sxd_sandstone = Nt('sxd_rock', { macro: [0.22, 0.12, 0.35, 0.25] })
  l1.sxd_adobe = Nt('concrete', { color: 0xd9b48c, macro: [0.28, 0.14, 0.4, 0.55] })
  l1.sxd_plaster = Nt('concrete', { tint: 2, color: 0xc7a47e, rough: 0.95, macro: [0.2, 0.12, 0.5, 0.45] })
}

/* --------------------------------------------------------- utilities --- */

function SXD_rng(seed) {
  var s = (seed | 0) * 2654435761 || 1
  return function () {
    s = (s + 1831565813) | 0
    var t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function SXD_h(x, y, z) {
  var n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return n - Math.floor(n)
}
function SXD_n3(x, y, z) {
  var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  var fx = x - ix, fy = y - iy, fz = z - iz
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  fz = fz * fz * (3 - 2 * fz)
  var l = function (a, b, t) {
    return a + (b - a) * t
  }
  var h = SXD_h
  return l(
    l(l(h(ix, iy, iz), h(ix + 1, iy, iz), fx), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), fx), fy),
    l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), fx), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), fx), fy),
    fz,
  )
}
function SXD_n2(x, z) {
  return SXD_n3(x, 0.5, z)
}
function SXD_fbm2(x, z, oct) {
  var a = 0.5, s = 0, t = 0
  for (var k = 0; k < (oct || 4); k++) {
    s += a * SXD_n3(x, k * 7.31 + 0.5, z)
    t += a
    a *= 0.5
    x *= 2.03
    z *= 2.03
  }
  return s / t
}
function SXD_smooth(a, b, x) {
  var t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Irregular sandstone boulder: an icosphere pushed around by noise and cut by a
// few random planes (blocky fracture faces), flat-bottomed, base at y = 0.
function SXD_rockGeo(seed, sx, sy, sz) {
  var g = new lt.IcosahedronGeometry(1, 3)
  var pos = g.attributes.position
  var rnd = SXD_rng(seed * 977 + 13)
  var cuts = []
  for (var c = 0; c < 6; c++) {
    var th = rnd() * Math.PI * 2, ph = (rnd() - 0.35) * 1.6
    cuts.push([Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph), 0.62 + rnd() * 0.3])
  }
  var off = seed * 3.17
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    var r = 1 + (SXD_n3(x * 1.3 + off, y * 1.3, z * 1.3) - 0.5) * 0.55 + (SXD_n3(x * 3.7, y * 3.7 + off, z * 3.7) - 0.5) * 0.16
    x *= r
    y *= r
    z *= r
    for (var k = 0; k < cuts.length; k++) {
      var cp = cuts[k], d = x * cp[0] + y * cp[1] + z * cp[2]
      if (d > cp[3]) {
        var e = d - cp[3]
        x -= cp[0] * e
        y -= cp[1] * e
        z -= cp[2] * e
      }
    }
    if (y < -0.35) y = -0.35 - (y + 0.35) * 0.05
    pos.setXYZ(i, x * sx, (y + 0.35) * sy * 0.78 - 0.08 * sy, z * sz)
  }
  // weld duplicated corners so the normals come out smooth
  var map = new Map(), idx = [], verts = []
  for (var j = 0; j < pos.count; j++) {
    var key = Math.round(pos.getX(j) * 1e4) + ',' + Math.round(pos.getY(j) * 1e4) + ',' + Math.round(pos.getZ(j) * 1e4)
    var at = map.get(key)
    if (at === undefined) {
      at = verts.length / 3
      map.set(key, at)
      verts.push(pos.getX(j), pos.getY(j), pos.getZ(j))
    }
    idx.push(at)
  }
  var out = new lt.BufferGeometry()
  out.setAttribute('position', new lt.Float32BufferAttribute(verts, 3))
  out.setIndex(idx)
  out.computeVertexNormals()
  out.setAttribute('uv', new lt.Float32BufferAttribute(new Float32Array((verts.length / 3) * 2), 2))
  g.dispose()
  return out
}

/* ============================================================ LEVEL ===== */

// Layout of the playable basin (the berms start right outside it).
var SXD_BOUND = { x0: -38, x1: 29.5, z0: -30.5, z1: 28.8 }

async function SXD_level(i) {
  var root = new lt.Group()
  root.name = 'level'
  i.scene.add(root)
  var t = ob(i)
  var place = t.place
  var M = t.M
  var ts = Math.PI / 2
  var rockMat = M('sxd_sandstone', { triplanar: true, scale: 1 })
  var adobe = M('sxd_adobe')
  var plaster = M('sxd_plaster')
  var updaters = []
  var lamps = pb()

  /* ---- props ---------------------------------------------------------- */

  function rock(x, z, sx, sy, sz, yaw, seed, opts) {
    opts = opts || {}
    var g = SXD_rockGeo(seed, sx, sy, sz)
    g.rotateY(yaw || 0)
    var m = t.add(g, rockMat, { p: [x, opts.y || 0, z] })
    g.computeBoundingBox()
    var b = g.boundingBox
    if (!opts.noCol && sy > 0.3) {
      var kx = (b.max.x - b.min.x) * 0.12, kz = (b.max.z - b.min.z) * 0.12
      t.col(x + b.min.x + kx, 0, z + b.min.z + kz, x + b.max.x - kx, (opts.y || 0) + b.max.y * 0.9, z + b.max.z - kz, 'concrete')
    }
    return m
  }
  function rockCluster(x, z, n, size, seed) {
    var r = SXD_rng(seed)
    rock(x, z, size, size * 0.85, size * 0.9, r() * 6.28, seed)
    for (var k = 1; k < n; k++) {
      var a = r() * 6.28, d = size * (0.9 + r() * 0.8), s = size * (0.35 + r() * 0.45)
      rock(x + Math.cos(a) * d, z + Math.sin(a) * d, s * (0.9 + r() * 0.4), s * (0.6 + r() * 0.5), s, r() * 6.28, seed * 31 + k)
    }
  }
  function scrub(x, z, s, seed) {
    var r = SXD_rng(seed + 5)
    var mat = M('wood_dark')
    var n = 9 + ((r() * 6) | 0)
    for (var k = 0; k < n; k++) {
      var a = r() * 6.28, up = 0.35 + r() * 0.55, len = (0.25 + r() * 0.45) * s
      var b = [x + Math.cos(a) * len * 0.8, len * up + 0.02, z + Math.sin(a) * len * 0.8]
      t.rod(mat, [x + (r() - 0.5) * 0.08, 0, z + (r() - 0.5) * 0.08], b, 0.008 + r() * 0.006, { seg: 4, cast: true })
      if (r() < 0.6) {
        var a2 = a + (r() - 0.5) * 1.4, l2 = len * 0.45
        t.rod(mat, b, [b[0] + Math.cos(a2) * l2, b[1] + l2 * 0.4, b[2] + Math.sin(a2) * l2], 0.005, { seg: 3 })
      }
    }
  }
  // Low adobe wall along an axis with a broken, uneven top and a few gaps.
  function wall(x0, z0, x1, z1, h, seed, opts) {
    opts = opts || {}
    var r = SXD_rng(seed)
    var alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
    var len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0)
    var n = Math.max(1, Math.round(len / 0.9))
    var th = opts.thick || 0.42
    var seg = len / n
    var ph0 = r() * 10
    for (var k = 0; k < n; k++) {
      if (opts.gaps && opts.gaps.indexOf(k) >= 0) continue
      var edgeK = k === 0 || k === n - 1 || (opts.gaps && (opts.gaps.indexOf(k - 1) >= 0 || opts.gaps.indexOf(k + 1) >= 0))
      var hh = h * (0.5 + 0.5 * SXD_n2(ph0 + k * 0.45, seed)) * (edgeK ? 0.8 : 1)
      if (r() < 0.08) hh *= 0.5
      hh = Math.max(0.5, hh)
      var c = (k + 0.5) / n
      var cx = x0 + (x1 - x0) * c, cz = z0 + (z1 - z0) * c
      var w = alongX ? seg + 0.04 : th, d = alongX ? th : seg + 0.04
      t.box(adobe, w, hh, d, cx, hh / 2, cz)
      // a ragged course on top
      t.box(adobe, w * (0.4 + r() * 0.5), 0.1 + r() * 0.12, d * 0.9, cx + (alongX ? (r() - 0.5) * seg * 0.4 : 0), hh + 0.05, cz + (alongX ? 0 : (r() - 0.5) * seg * 0.4), { bevel: 0.02 })
      if (k % 4 === 2) t.box(plaster, alongX ? seg * 0.8 : 0.02, hh * 0.55, alongX ? 0.02 : seg * 0.8, cx + (alongX ? 0 : th / 2 + 0.01), hh * 0.35, cz + (alongX ? th / 2 + 0.01 : 0))
      // crumbled lumps at the foot
      if (r() < 0.35) t.box(adobe, 0.25 + r() * 0.2, 0.12 + r() * 0.1, 0.22 + r() * 0.2, cx + (alongX ? 0 : th * 0.9), 0.06, cz + (alongX ? th * 0.9 : 0), { bevel: 0.03, r: [0, r() * 3, 0] })
      if (hh > 0.45) t.col(cx - w / 2, 0, cz - d / 2, cx + w / 2, hh, cz + d / 2, 'concrete')
    }
  }
  function sandbagRow(x, z, yaw, n, seed) {
    for (var k = 0; k < n; k++) {
      var dx = Math.cos(yaw) * (k - (n - 1) / 2) * 1.25, dz = -Math.sin(yaw) * (k - (n - 1) / 2) * 1.25
      place('sandbags', x + dx, z + dz, yaw + (k % 2 ? 0.05 : -0.04), { seed: seed + k })
    }
  }

  // Pumpjack ("nodding donkey"): static skid/frame, animated beam + cranks.
  function pumpjack(x, z, yaw, paint, seed) {
    var g = new lt.Group()
    g.position.set(x, 0, z)
    g.rotation.y = yaw
    t.staticRoot.add(g)
    var dark = M('steel_dark'), worn = M('steel_worn'), pnt = M(paint), conc = M('concrete_dirty')
    var B = function (mat, w, h, d, px, py, pz, bevel, rot) {
      return Rn(t, g, mat, w, h, d, px, py, pz, bevel || 0, rot || null)
    }
    B(conc, 7.2, 0.18, 2.4, 0.2, 0.09, 0)
    B(dark, 6.4, 0.24, 0.22, 0.2, 0.3, 0.68, 0.01)
    B(dark, 6.4, 0.24, 0.22, 0.2, 0.3, -0.68, 0.01)
    for (var k = -2; k <= 3; k++) B(dark, 0.16, 0.16, 1.5, k * 1.1, 0.3, 0)
    // samson post (A-frame)
    for (var s of [-1, 1]) {
      t.rod(dark, [x + Math.cos(yaw) * -0.5 + Math.sin(yaw) * s * 0.75, 0.42, z - Math.sin(yaw) * -0.5 + Math.cos(yaw) * s * 0.75], [x + Math.sin(yaw) * s * 0.12, 3.62, z + Math.cos(yaw) * s * 0.12], 0.07, { seg: 6 })
      t.rod(dark, [x + Math.cos(yaw) * 0.6 + Math.sin(yaw) * s * 0.75, 0.42, z - Math.sin(yaw) * 0.6 + Math.cos(yaw) * s * 0.75], [x + Math.sin(yaw) * s * 0.12, 3.62, z + Math.cos(yaw) * s * 0.12], 0.06, { seg: 6 })
    }
    B(dark, 0.5, 0.25, 0.5, 0, 3.66, 0, 0.02)
    // gearbox + motor at the back
    B(pnt, 1.0, 1.0, 0.9, 2.1, 0.92, 0, 0.04)
    B(dark, 0.9, 0.5, 0.7, 3.1, 0.67, 0, 0.03)
    ov(t, g, worn, 0.22, 0.6, 3.1, 0.75, 0.42, [Math.PI / 2, 0, 0], 12)
    // wellhead + stuffing box at the front
    ov(t, g, worn, 0.12, 1.2, -2.75, 0.6, 0, null, 10)
    B(M('paint_red'), 0.34, 0.12, 0.34, -2.75, 1.0, 0, 0.02)
    ov(t, g, M('paint_red'), 0.16, 0.04, -2.75, 0.75, 0.2, [Math.PI / 2, 0, 0], 12)
    t.rod(worn, [x + Math.cos(yaw) * -2.75, 0.45, z - Math.sin(yaw) * -2.75], [x + Math.cos(yaw) * -1.3 + Math.sin(yaw) * 0.9, 0.18, z - Math.sin(yaw) * -1.3 + Math.cos(yaw) * 0.9], 0.05, { seg: 8 })
    // colliders (world space, rotated footprints)
    rv(t, x + Math.cos(yaw) * 0.2, z - Math.sin(yaw) * 0.2, yaw, 6.6, 1.7, 0.45, 'metal')
    rv(t, x, z, yaw, 1.4, 1.7, 3.6, 'metal')
    rv(t, x + Math.cos(yaw) * 2.5, z - Math.sin(yaw) * 2.5, yaw, 1.9, 1.9, 1.9, 'metal')

    // ---- moving parts (kept out of the static merge) ----
    var dyn = new lt.Group()
    dyn.position.copy(g.position)
    dyn.rotation.y = yaw
    t.dynRoot.add(dyn)
    var mk = function (geo, mat, parent) {
      var m = new lt.Mesh(geo, mat)
      m.castShadow = m.receiveShadow = true
      ;(parent || dyn).add(m)
      return m
    }
    var beam = new lt.Group()
    beam.position.set(0, 3.82, 0)
    dyn.add(beam)
    mk(Wi(5.6, 0.36, 0.26, 0.02), pnt, beam).position.set(0.15, 0, 0)
    // horsehead: arc band centred on the pivot, so the bridle stays plumb over the well
    var hs = new lt.Shape(), a0 = Math.PI - 0.25, a1 = Math.PI + 0.48, rO = 2.92, rI = 2.58
    for (var ha = 0; ha <= 12; ha++) {
      var aa = a0 + ((a1 - a0) * ha) / 12
      ha ? hs.lineTo(Math.cos(aa) * rO, Math.sin(aa) * rO) : hs.moveTo(Math.cos(aa) * rO, Math.sin(aa) * rO)
    }
    for (var hb = 12; hb >= 0; hb--) {
      var ab2 = a0 + ((a1 - a0) * hb) / 12
      hs.lineTo(Math.cos(ab2) * rI, Math.sin(ab2) * rI)
    }
    var hg = new lt.ExtrudeGeometry(hs, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 4 })
    hg.translate(0, 0, -0.15)
    mk(hg, pnt, beam)
    mk(Wi(0.5, 0.3, 0.3, 0.02), pnt, beam).position.set(-2.45, 0.1, 0)
    mk(Wi(0.3, 0.5, 0.36, 0.02), dark, beam).position.set(2.85, -0.1, 0)
    var tail = new lt.Vector3(2.85, -0.3, 0)
    var crank = new lt.Group()
    crank.position.set(2.1, 1.35, 0)
    dyn.add(crank)
    var cwGeo = Wi(1.15, 0.5, 0.18, 0.03)
    var cw1 = mk(cwGeo, dark, crank), cw2 = mk(cwGeo, dark, crank)
    cw1.position.set(-0.45, 0, 0.62)
    cw2.position.set(-0.45, 0, -0.62)
    var pitGeo = new lt.CylinderGeometry(0.045, 0.045, 1, 6)
    var pit1 = mk(pitGeo, worn), pit2 = mk(pitGeo, worn)
    var rodLine = mk(new lt.CylinderGeometry(0.03, 0.03, 1, 6), M('steel_bare'))
    var tmpA = new lt.Vector3(), tmpB = new lt.Vector3(), up = new lt.Vector3(0, 1, 0), q = new lt.Quaternion()
    var place2 = function (mesh, a, b) {
      tmpB.subVectors(b, a)
      var len = tmpB.length()
      mesh.position.addVectors(a, b).multiplyScalar(0.5)
      mesh.scale.set(1, len, 1)
      q.setFromUnitVectors(up, tmpB.normalize())
      mesh.quaternion.copy(q)
    }
    var ph = seed * 1.7, w = 0.85 + (seed % 3) * 0.12
    updaters.push(function (dt) {
      ph += dt * w
      crank.rotation.z = -ph
      var th = 0.21 * Math.sin(ph + 0.35)
      beam.rotation.z = th
      beam.updateMatrix()
      // pitman arms: crank pins to the beam tail
      tmpA.set(-0.95 * Math.cos(-ph) + 2.1, 1.35 - 0.95 * Math.sin(-ph), 0)
      var tw = tail.clone().applyAxisAngle(new lt.Vector3(0, 0, 1), th).add(beam.position)
      place2(pit1, new lt.Vector3(tmpA.x, tmpA.y, 0.74), new lt.Vector3(tw.x, tw.y, 0.2))
      place2(pit2, new lt.Vector3(tmpA.x, tmpA.y, -0.74), new lt.Vector3(tw.x, tw.y, -0.2))
      // polished rod hangs straight from the horsehead into the stuffing box
      var hy = 3.82 - 0.1 + Math.sin(th) * -2.8 - 1.15
      place2(rodLine, new lt.Vector3(-2.75, 1.06, 0), new lt.Vector3(-2.75, Math.max(1.3, hy), 0))
    })
    return g
  }

  function waterTower(x, z) {
    var galv = M('steel_galv'), rust = M('steel_rust'), dark = M('steel_dark')
    var legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    var bot = 2.3, top = 1.75, H = 9.2
    for (var k = 0; k < 4; k++) {
      var l = legs[k]
      t.rod(galv, [x + l[0] * bot, 0, z + l[1] * bot], [x + l[0] * top, H, z + l[1] * top], 0.11, { seg: 8 })
      t.box(M('concrete'), 0.7, 0.3, 0.7, x + l[0] * bot, 0.15, z + l[1] * bot, { bevel: 0.03 })
      t.col(x + l[0] * bot - 0.35, 0, z + l[1] * bot - 0.35, x + l[0] * bot + 0.35, 2.2, z + l[1] * bot + 0.35, 'metal')
    }
    for (var lv of [2.6, 5.4, 8.0]) {
      var f = lv / H, rr = bot + (top - bot) * f, f2 = (lv + 2.5) / H, rr2 = bot + (top - bot) * Math.min(1, f2)
      for (var k2 = 0; k2 < 4; k2++) {
        var a = legs[k2], b = legs[(k2 + 1) % 4]
        t.rod(galv, [x + a[0] * rr, lv, z + a[1] * rr], [x + b[0] * rr, lv, z + b[1] * rr], 0.035, { seg: 5 })
        if (lv < 8) {
          t.rod(rust, [x + a[0] * rr, lv, z + a[1] * rr], [x + b[0] * rr2, Math.min(H, lv + 2.5), z + b[1] * rr2], 0.02, { seg: 4 })
          t.rod(rust, [x + b[0] * rr, lv, z + b[1] * rr], [x + a[0] * rr2, Math.min(H, lv + 2.5), z + a[1] * rr2], 0.02, { seg: 4 })
        }
      }
    }
    t.cyl(dark, 2.95, 0.12, x, H + 0.06, z, { seg: 28 })
    t.cyl(M('paint_white'), 2.6, 3.8, x, H + 0.12 + 1.9, z, { seg: 32 })
    t.cyl(rust, 2.68, 0.14, x, H + 0.12 + 3.8, z, { seg: 32 })
    t.cyl(M('paint_white'), 2.68, 1.1, x, H + 4.06 + 0.55, z, { seg: 32, rTop: 0.25 })
    t.cyl(dark, 0.25, 0.3, x, H + 5.3, z, { seg: 10 })
    // railing round the walkway
    for (var k3 = 0; k3 < 24; k3++) {
      var a3 = (k3 / 24) * Math.PI * 2
      t.rod(galv, [x + Math.cos(a3) * 2.9, H + 0.1, z + Math.sin(a3) * 2.9], [x + Math.cos(a3) * 2.9, H + 1.1, z + Math.sin(a3) * 2.9], 0.018, { seg: 4 })
    }
    t.tube(galv, Array.from({ length: 25 }, function (_, k4) {
      var a4 = (k4 / 24) * Math.PI * 2
      return [x + Math.cos(a4) * 2.9, H + 1.1, z + Math.sin(a4) * 2.9]
    }), 0.02, { radial: 5 })
    // ladder up one leg
    for (var s of [-0.22, 0.22]) t.rod(galv, [x + bot + 0.15, 0, z + s], [x + top + 0.15, H, z + s], 0.02, { seg: 4 })
    for (var ry = 0.4; ry < H; ry += 0.32) {
      var fx = bot + (top - bot) * (ry / H) + 0.15
      t.rod(galv, [x + fx, ry, z - 0.22], [x + fx, ry, z + 0.22], 0.012, { seg: 4 })
    }
    t.label('KESSLER 7', 0.6, x, H + 2.2, z + 2.63, 'z+', { color: 'black', font: 'stencil', distress: 0.55 })
    t.col(x - 2.7, H, z - 2.7, x + 2.7, H + 5.4, z + 2.7, 'metal')
  }

  // Self-supporting triangular lattice radio mast with a blinking beacon.
  function mast(x, z, H) {
    var galv = M('steel_galv'), pr = M('paint_red'), pw = M('paint_white')
    var R0 = 1.6, R1 = 0.45
    var leg = function (k, y) {
      var a = (k / 3) * Math.PI * 2 + 0.3, r = R0 + (R1 - R0) * (y / H)
      return [x + Math.cos(a) * r, y, z + Math.sin(a) * r]
    }
    var step = 1.6
    for (var k = 0; k < 3; k++) {
      for (var y = 0; y < H - 0.01; y += step) {
        var y2 = Math.min(H, y + step)
        var band = Math.floor(y / 4.8) % 2 ? pw : pr
        t.rod(band, leg(k, y), leg(k, y2), 0.05 - 0.025 * (y / H), { seg: 5 })
        t.rod(galv, leg(k, y), leg((k + 1) % 3, y2), 0.016, { seg: 3 })
        t.rod(galv, leg(k, y2), leg((k + 1) % 3, y2), 0.018, { seg: 3 })
      }
    }
    for (var k5 = 0; k5 < 3; k5++) {
      var p = leg(k5, 0)
      t.box(M('concrete'), 0.8, 0.4, 0.8, p[0], 0.2, p[2], { bevel: 0.03 })
    }
    // antennas + dishes
    t.cyl(galv, 0.05, 4.5, x, H + 2.25, z, { seg: 6 })
    for (var ay of [H - 3, H - 6.5]) {
      for (var k6 = 0; k6 < 3; k6++) {
        var a6 = (k6 / 3) * Math.PI * 2 + 0.8, rr6 = R0 + (R1 - R0) * (ay / H) + 0.35
        t.box(pw, 0.32, 1.6, 0.12, x + Math.cos(a6) * rr6, ay, z + Math.sin(a6) * rr6, { bevel: 0.02, r: [0, -a6, 0] })
      }
    }
    var dish = new lt.SphereGeometry(0.8, 18, 8, 0, Math.PI * 2, 0, 0.75)
    dish.rotateZ(Math.PI / 2)
    t.add(dish, M('paint_white'), { p: [x - 0.9, H * 0.62, z - 0.2], r: [0, 2.6, 0] })
    // beacon (blinks via the shared lamp shader)
    lamps.add(Bn(x, H + 4.6, z, 0.16), [24, 1.2, 0.6], 1.5, 0.1, 0.4)
    lamps.add(Bn(x, H * 0.5, z + 0.9, 0.1), [16, 0.8, 0.4], 1.5, 0.6, 0.4)
    t.col(x - 1.4, 0, z - 1.4, x + 1.4, H, z + 1.4, 'metal')
  }

  function fuelTank(x, z, alongX, len, r, paint, label) {
    var mat = M(paint), dark = M('steel_dark')
    var ax = alongX ? 'x' : 'z'
    var y = r + 0.45
    t.cyl(mat, r, len, x, y, z, { axis: ax, seg: 28 })
    for (var s of [-1, 1]) {
      var ex = alongX ? x + s * (len / 2 + 0.06) : x, ez = alongX ? z : z + s * (len / 2 + 0.06)
      t.cyl(mat, r * 0.96, 0.14, ex, y, ez, { axis: ax, seg: 28 })
      var sx = alongX ? x + s * len * 0.32 : x, sz = alongX ? z : z + s * len * 0.32
      t.box(dark, alongX ? 0.35 : r * 1.7, 0.55, alongX ? r * 1.7 : 0.35, sx, 0.28, sz, { bevel: 0.02 })
    }
    for (var k = -2; k <= 2; k++) t.cyl(dark, r + 0.02, 0.06, alongX ? x + k * len * 0.2 : x, y, alongX ? z : z + k * len * 0.2, { axis: ax, seg: 28 })
    t.cyl(dark, 0.3, 0.2, x, y + r + 0.08, z, { seg: 12 })
    if (label) t.label(label, 0.5, alongX ? x : x + r + 0.02, y + 0.15, alongX ? z + r + 0.02 : z, alongX ? 'z+' : 'x+', { color: 'black', font: 'stencil', distress: 0.5 })
    var hx = alongX ? len / 2 + 0.15 : r, hz = alongX ? r : len / 2 + 0.15
    t.col(x - hx, 0, z - hz, x + hx, y + r, z + hz, 'metal')
  }

  // Pipeline on H supports along x (low enough to vault).
  function pipeline(x0, x1, z, seed) {
    var y = 0.62, r = 0.26, len = x1 - x0, cx = (x0 + x1) / 2
    var mat = M(seed % 2 ? 'steel_rust' : 'paint_grey'), dark = M('steel_dark')
    t.cyl(mat, r, len, cx, y, z, { axis: 'x', seg: 18 })
    for (var px = x0 + 1.2; px < x1 - 0.5; px += 4) {
      t.box(dark, 0.12, y, 0.12, px, y / 2, z - r - 0.08)
      t.box(dark, 0.12, y, 0.12, px, y / 2, z + r + 0.08)
      t.box(dark, 0.14, 0.1, 2 * r + 0.4, px, y - r - 0.05, z)
      t.box(M('concrete'), 0.4, 0.12, 2 * r + 0.6, px, 0.06, z, { bevel: 0.02 })
    }
    for (var fx = x0 + 3; fx < x1; fx += 6) t.cyl(dark, r + 0.07, 0.14, fx, y, z, { axis: 'x', seg: 18 })
    t.cyl(M('paint_red'), 0.2, 0.04, x0 + len * 0.5 + 0.8, y + r + 0.32, z, { seg: 12 })
    t.rod(dark, [x0 + len * 0.5 + 0.8, y + r, z], [x0 + len * 0.5 + 0.8, y + r + 0.3, z], 0.03)
    t.col(x0, 0, z - r - 0.15, x1, y + r, z + r + 0.15, 'metal')
  }

  // Box-built pickup/utility truck. burnt: rusted shell, no glass, no tyres.
  function truck(x, z, yaw, opts) {
    opts = opts || {}
    var g = Hc(t, x, z, yaw)
    var body = M(opts.burnt ? 'steel_rust' : opts.paint || 'paint_green'), dark = M('steel_dark')
    var R = function (mat, w, h, d, px, py, pz, b, rot) {
      return Rn(t, g, mat, w, h, d, px, py, pz, b || 0, rot || null)
    }
    R(dark, 5.2, 0.22, 1.1, 0, 0.62, 0)
    R(body, 1.9, 1.05, 2.1, 1.55, 1.25, 0, 0.06)
    R(body, 1.4, 0.7, 2.0, 1.75, 2.12, 0, 0.08)
    R(body, 0.12, 0.5, 2.05, 2.52, 1.0, 0, 0.03)
    if (!opts.burnt) R(M('glass_dirty'), 0.05, 0.55, 1.75, 2.42, 2.12, 0, 0, [0, 0, -0.25])
    R(body, 3.2, 0.12, 2.2, -1.1, 0.82, 0, 0.02)
    for (var s of [-1, 1]) R(body, 3.2, 0.55, 0.08, -1.1, 1.15, s * 1.06, 0.02)
    R(body, 0.08, 0.55, 2.2, -2.66, 1.15, 0, 0.02)
    if (opts.canopy) {
      R(M('tarp'), 3.1, 1.25, 2.24, -1.1, 2.03, 0, 0.12)
    }
    for (var wx of [1.7, -0.6, -1.8]) {
      for (var s2 of [-1, 1]) {
        if (opts.burnt) {
          ov(t, g, dark, 0.32, 0.18, wx, 0.36, s2 * 0.98, [Math.PI / 2, 0, 0], 12)
        } else {
          ov(t, g, M('tire'), 0.46, 0.34, wx, 0.46, s2 * 0.96, [Math.PI / 2, 0, 0], 16)
          ov(t, g, M('steel_worn'), 0.24, 0.36, wx, 0.46, s2 * 0.96, [Math.PI / 2, 0, 0], 10)
        }
      }
    }
    if (opts.burnt) for (var k = 0; k < 6; k++) R(M('steel_dark'), 0.3 + k * 0.05, 0.05, 0.25, -1.4 + k * 0.3, 0.9, (k % 2 - 0.5) * 0.8, 0.01, [0.3 * k, k, 0.2])
    rv(t, x, z, yaw, 5.3, 2.25, 1.9, 'metal')
    return g
  }

  function wellhead(x, z) {
    var g = Hc(t, x, z, 0.2)
    var red = M('paint_red'), worn = M('steel_worn'), dark = M('steel_dark')
    Rn(t, g, M('concrete_dirty'), 1.4, 0.15, 1.4, 0, 0.075, 0, 0.02)
    ov(t, g, worn, 0.16, 1.5, 0, 0.9, 0, null, 12)
    for (var y of [0.55, 1.05, 1.45]) {
      ov(t, g, red, 0.22, 0.18, 0, y, 0, null, 12)
      ov(t, g, dark, 0.13, 0.5, 0.3, y, 0, [0, 0, Math.PI / 2], 10)
      ov(t, g, red, 0.17, 0.03, 0.56, y, 0, [0, 0, Math.PI / 2], 14)
    }
    ov(t, g, worn, 0.07, 1.6, 0, 1.3, 0.8, [Math.PI / 2, 0, 0], 8)
    rv(t, x, z, 0.2, 1.0, 1.0, 1.6, 'metal')
  }

  /* ---- layout ----------------------------------------------------------- */

  // Pump hall (the bundle's warehouse builder) on the north side.
  var hall = ab(t)

  // No perimeter walls: the berms and dunes are real ground now (SXD_TH,
  // patched into the physics). Steep mesa faces and SXD_PLAY_R (the map edge) stop the player.
  SXD_buildHeightGrid()

  // --- west checkpoint (player start) ---
  place('guard_booth', -35.2, 0.35, 0, { seed: 1 })
  place('gate_arm', -36.3, 5, ts, { seed: 2 })
  for (var bp of [[-37, 1.75], [-34.4, 2.3], [-37, 8.3], [-35.6, 8.9]]) place('bollard_post', bp[0], bp[1], 0, { seed: Math.round(bp[0] * 11 + bp[1] * 7) })
  place('jersey_barrier', -34.7, 3.75, ts + 0.08, { seed: 3 })
  place('jersey_barrier', -33.3, 8.6, ts - 0.06, { seed: 4 })
  place('jersey_barrier', -30.6, 10.6, 0.03, { seed: 5 })
  place('jersey_barrier', -31.6, 1.2, -0.04, { seed: 7 })
  sandbagRow(-29.4, 3.0, 0.25, 2, 40)
  place('sign_post', -33.2, 9.6, ts, { seed: 8, sign: 'no_entry' })
  place('sign_post', -36.6, -1.6, ts, { seed: 10, sign: 'hazard_general' })
  place('barrel', -33.9, 2, 0, { seed: 13, color: 'yellow' })
  place('barrel', -27.9, 9.4, 0.3, { seed: 14, color: 'red' })
  place('light_mast', -27.6, -0.9, 0, { seed: 11 })
  truck(-27.5, -5.2, 0.6, { burnt: true })
  wall(-31, 12.4, -25, 12.4, 2.1, 71, { gaps: [3] })
  wall(-25, 12.4, -25, 17.5, 2.1, 72)
  rockCluster(-34, -14.5, 4, 1.6, 81)
  rockCluster(-33.5, 22.5, 3, 1.3, 82)
  scrub(-31.5, 16, 1, 1)
  scrub(-36.2, 13.5, 0.8, 2)
  scrub(-29.8, -9.5, 1.1, 3)

  // --- south-west container yard ---
  t.stack(-30.2, -19.4, [[20, 'yellow', { doors: 0.5 }]], 0.35, 0)
  t.stack(-22.6, -20.2, [[40, 'red', { wear: 0.9 }], [40, 'white', { wear: 0.85 }]], ts)
  t.stack(-31.5, -26.2, [[20, 'orange', { wear: 0.9 }]], 0.1)
  place('tarp_cargo', -27.5, -11.6, 0.3, { seed: 59 })
  place('pipe_stack', -30.5, -29.0, 0.03, { seed: 56 })
  place('tire_stack', -25.4, -28.4, 0, { seed: 65 })
  place('gas_cylinders', -17.6, -24.4, ts, { seed: 66 })
  place('crate_stack', -34.8, -21.5, 0.2, { seed: 67 })
  place('barrel', -33.6, -23, 0, { seed: 68 })
  place('generator', -19.5, -13.2, 0.15, { seed: 71 })
  Lr(t, [[-19.5, -12.6], [-18.4, -12.1], [-16.6, -12.4]], 0.02)

  // --- wellfield (centre): relay A at the wellhead ---
  wellhead(3.2, 9.8)
  place('generator', 6.2, 9.0, 0.1, { seed: 90 })
  place('floodlight_stand', 6.6, 6.6, 0.4, { seed: 91 })
  Lr(t, [[5.6, 8.6], [4.2, 8.1], [2.6, 7.6]], 0.024)
  sandbagRow(-0.8, 10.6, 0.45, 2, 92)
  sandbagRow(4.6, 4.6, -0.15, 2, 94)
  truck(-4.8, 3.6, 0.28, { burnt: true })
  pumpjack(-11, 13.6, 0, 'paint_orange', 1)
  pumpjack(7, 20.2, Math.PI, 'paint_blue', 2)
  pumpjack(-3.5, 25.3, 0.12, 'paint_grey', 3)
  waterTower(-21, 21.5)
  fuelTank(11, 3.0, true, 7, 1.25, 'paint_white', 'DIESEL')
  fuelTank(11, 6.8, true, 6, 1.15, 'paint_white', 'WATER')
  pipeline(-14.5, -4.2, 0.4, 1)
  pipeline(-1.4, 6.4, 0.4, 2)
  t.stack(-8.5, -5.7, [[20, 'orange', { wear: 0.9 }], [20, 'grey', { wear: 0.9 }]], 0.02)
  t.stack(4.6, -5.6, [[20, 'blue', { doors: 0.8, wear: 0.85 }]], -0.03)
  t.stack(-21.2, 1.0, [[40, 'white', { wear: 0.95 }]], 0.04)
  t.stack(18.4, 14.6, [[20, 'teal', { wear: 0.9 }], [20, 'red', { wear: 0.9 }]], ts)
  wall(-9.2, 16.8, -3.2, 16.8, 2.2, 73, { gaps: [4] })
  wall(-9.2, 16.8, -9.2, 21.2, 2.2, 74)
  wall(12.6, 27.2, 19.4, 27.2, 1.9, 75)
  wall(12.6, 23.4, 12.6, 27.2, 1.9, 76)
  place('crate_stack', -14.6, 8.4, 0.04, { seed: 95 })
  place('crate_wood', -13.3, 9.2, 0.3, { seed: 96 })
  place('pallet_stack', -12.7, 4.6, 0.1, { seed: 97 })
  place('barrel', -2.4, 13.4, 0, { seed: 98, color: 'blue' })
  place('barrel', -1.7, 13.9, 0.6, { seed: 99 })
  place('jerry_can', 5.2, 11.0, 0.4, { seed: 100 })
  place('ibc_tote', 8.9, 12.2, 0.1, { seed: 101 })
  place('cable_reel', -6.8, 9.6, 0.3, { seed: 102 })
  place('tire_stack', -19.4, 15.8, 0, { seed: 103 })
  place('light_mast', -26, 4, 0, { seed: 104 })
  place('light_mast', 16.6, 9.4, 0, { seed: 105 })
  rockCluster(-14.5, 26, 4, 1.4, 83)
  rockCluster(2.5, 15.4, 2, 0.9, 84)
  rockCluster(8.6, -8.6, 3, 1.2, 85)
  rockCluster(-23.5, 27, 3, 1.1, 86)
  for (var sc of [[-6, 6.8], [9.5, 15.5], [-16, 18], [3, 23], [-28, 8], [-12, -8], [15, 21], [0.5, 1.8], [-24, 1.5], [20, 27]]) scrub(sc[0], sc[1], 0.9, sc[0] * 7 + sc[1])

  // --- east compound: radio mast, relay C, evac ---
  mast(21, -4.2, 30)
  t.stack(26.2, -6.5, [[20, 'white', { doors: 0.3, wear: 0.8 }]], ts)
  for (var fz = -12; fz < -7; fz += 3.2) place('fence_panel', 16.8, fz + 1.6, ts, { seed: 200 + fz, posts: 'left' }, 0, { noCol: true })
  t.col(16.75, 0, -12, 16.85, 2.4, -6.6, 'metal')
  place('fence_panel', 18.6, 1.4, 0, { seed: 210, posts: 'both' }, 0, { noCol: true })
  t.col(17, 0, 1.35, 20.2, 2.4, 1.45, 'metal')
  sandbagRow(23.0, 10.2, 0.0, 3, 220)
  place('jersey_barrier', 20.5, 4.6, ts + 0.12, { seed: 31 })
  place('barrel', 26.5, 3.3, 0, { seed: 34, color: 'red' })
  place('barrel', 26.9, 2.6, 0.5, { seed: 35 })
  fuelTank(26.8, 15.2, false, 6, 1.2, 'paint_white', 'FUEL')
  t.stack(20.6, 21, [[20, 'green', { wear: 0.85 }]], 0.1)
  truck(27.6, 24.6, Math.PI / 2 + 0.12, { canopy: true, paint: 'paint_green' })
  place('crate_wood', 24.2, 20.8, 0.3, { seed: 230 })
  place('pallet_stack', 22.7, 25.6, 0.2, { seed: 231 })
  rockCluster(24.5, -26, 4, 1.5, 87)
  rockCluster(27, -15, 2, 1.0, 88)
  t.stack(21.5, -21.5, [[20, 'yellow', { wear: 0.9 }]], 0.25)
  place('pallet_stack', 15.5, -15.8, 0.1, { seed: 232 })
  place('tire_stack', 17.2, -27.4, 0, { seed: 233 })
  place('dumpster', 14.6, -24.6, ts, { seed: 234 })
  scrub(28, 8, 0.9, 30)
  scrub(16, -14, 1, 31)

  // --- relays ---
  var relayA = place('relay_node', 1.5, 7.5, 0.35, { seed: 1 }, 0)
  var relayB = place('relay_node', hall.relayPos.x, hall.relayPos.z, ts * 0.9, { seed: 2 }, no.FLOOR)
  var relayC = place('relay_node', 25.5, 7.4, -0.2, { seed: 3 }, 0)
  Lr(t, [[-2, -27.5, 1.2], [-2, -27.55, 0.08], [-1.4, -25.6], [-2.4, -23], [-1.9, -20.3]], 0.03, t.MI('rubber'), no.FLOOR + 0.028)
  Lr(t, [[21.6, -2.6], [23.2, 1.5], [24.6, 5], [25.2, 6.8]], 0.03)
  lv(t, 23.3, 1.9, 0.4)

  // --- outposts out on the dunes (outposts feature) ---
  if (typeof SXO_layout === 'function') {
    try {
      SXO_layout({ t: t, place: place, M: M, ts: ts, rock: rock, rockCluster: rockCluster, scrub: scrub, wall: wall, sandbagRow: sandbagRow, truck: truck, fuelTank: fuelTank, waterTower: waterTower, mast: mast, pipeline: pipeline, lamps: lamps })
    } catch (e) {
      console.error('[desert] outposts layout failed', e)
    }
  }

  var lampMesh = lamps.build()
  if (lampMesh) {
    lampMesh.frustumCulled = false
    t.dynRoot.add(lampMesh)
  }

  /* ---- merge (same post-process as the port level) ---------------------- */

  t.staticRoot.updateMatrixWorld(true)
  var loose = []
  t.staticRoot.traverse(function (z) {
    z.userData && z.userData.noMerge && !(z.parent && dR(z.parent, t.staticRoot)) && loose.push(z)
  })
  for (var lz of loose) t.dynRoot.attach(lz)
  var mats = new Set()
  t.staticRoot.traverse(function (z) {
    z.isMesh && !Array.isArray(z.material) && mats.add(z.material)
  })
  var swap = new Map()
  for (var m0 of mats) {
    if (!m0.isMeshStandardMaterial || m0.vertexColors || m0.transparent || !m0.name || !(i.mats.names || []).includes(m0.name)) continue
    try {
      var opt = m0.userData && m0.userData.interior ? { interior: true } : {}
      if (i.mats.get(m0.name, opt) !== m0) continue
      var vc = i.mats.get(m0.name, Object.assign({}, opt, { vertexColors: true }))
      vc !== m0 && mats.has(vc) && swap.set(m0, vc)
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
  try {
    atlas = rb(t.staticRoot)
  } catch (e) {
    console.error('[desert] label atlas failed', e)
  }
  var merged = By(t.staticRoot)
  merged.name = 'level-merged'
  root.add(merged)
  root.add(t.dynRoot)
  for (var rel of [relayA, relayB, relayC]) {
    for (var c = rel.children.length - 1; c >= 0; c--) rel.remove(rel.children[c])
    t.dynRoot.add(rel)
  }
  var tris = 0
  merged.traverse(function (z) {
    if (z.isMesh) tris += (z.geometry.index ? z.geometry.index.count : z.geometry.attributes.position.count) / 3
  })

  /* ---- gameplay data ----------------------------------------------------- */

  var V = function (x, y, z) {
    return new lt.Vector3(x, y, z)
  }
  var playerStart = { pos: V(-33, 0, 6), yaw: -ts }
  var objectives = [
    { id: 'relay_a', label: 'Relay A — Wellfield', zone: 'yard', pos: V(1.5, 0, 7.5), object: relayA },
    { id: 'relay_b', label: 'Relay B — Pump hall', zone: 'shed', pos: V(hall.relayPos.x, no.FLOOR, hall.relayPos.z), object: relayB },
    { id: 'relay_c', label: 'Relay C — Mast', zone: 'quay', pos: V(25.5, 0, 7.4), object: relayC },
  ]
  var gnd = function (x, z, zone) {
    return { pos: V(x, 0, z), zone: zone, type: 'ground' }
  }
  var air = function (x, y, z, zone) {
    return { pos: V(x, y, z), zone: zone, type: 'air' }
  }
  var enemySpawns = [
    gnd(-20, -3, 'yard'), gnd(3.5, -1.8, 'yard'), gnd(14, 18.8, 'yard'), gnd(-3.2, 19.6, 'yard'), gnd(-16, 24.5, 'yard'),
    gnd(6, 25.5, 'yard'), gnd(-0.5, -8.5, 'yard'), gnd(-7.8, 22.4, 'yard'), gnd(-12.4, 18.6, 'yard'), gnd(16.4, 24.4, 'yard'),
    air(10, 11, 23.5, 'yard'), air(2, 11, 21.5, 'yard'), air(13, 9, 11, 'yard'), air(-4, 12.5, -4.5, 'yard'), air(-10, 12, 24.5, 'yard'),
    gnd(-12.4, -24.8, 'shed'), gnd(9.6, -25.3, 'shed'), gnd(-13.4, -19.6, 'shed'), gnd(4.6, -13.8, 'shed'), gnd(-21, -27.2, 'shed'),
    gnd(-26.6, -15, 'shed'), gnd(13.6, -20, 'shed'),
    air(-8, 5.4, -20.5, 'shed'), air(5, 5.2, -18, 'shed'), air(-20, 10.5, -20, 'shed'), air(14.5, 10, -22, 'shed'),
    gnd(27.7, -24.2, 'quay'), gnd(18.3, -25.4, 'quay'), gnd(27.2, -11.6, 'quay'), gnd(19.4, 8.4, 'quay'), gnd(23.4, 18.2, 'quay'),
    gnd(17, 23.6, 'quay'), gnd(27.4, 11.6, 'quay'),
    air(36, 9, 4, 'quay'), air(38, 11, -6, 'quay'), air(35, 8.5, 16, 'quay'), air(24, 12.5, 10.5, 'quay'), air(22, 13, -14, 'quay'),
  ]
  var zones = [
    { name: 'gate', min: [-40, -30], max: [-24, 30] },
    { name: 'yard', min: [-24, -10], max: [16, 30] },
    { name: 'shed', min: [-24, -30], max: [16, -10] },
    { name: 'quay', min: [16, -30], max: [40, 30] },
  ]
  var interiorBoxes = [{ min: V(no.X0, 0, no.Z0), max: V(no.X1, no.RIDGE, no.Z1) }]
  var cinematicPath = [
    { pos: [-35, 1.7, 6.2], look: [-14, 2.6, 7.4] },
    { pos: [-25, 1.5, 4.4], look: [-5, 2.2, 8.4] },
    { pos: [-13.5, 2.2, 8.2], look: [1.5, 1.8, 7.6] },
    { pos: [-5.5, 2.6, 11.4], look: [-11, 3.4, 13.6] },
    { pos: [0.5, 3.0, 17.5], look: [-3.5, 4.2, 25.3] },
    { pos: [7.5, 2.6, 12.5], look: [21, 13, -4.2] },
    { pos: [15.5, 2.0, 6.4], look: [25.5, 1.4, 7.4] },
    { pos: [20.5, 1.9, 13.8], look: [26.5, 1.4, 21.5] },
    { pos: [23.6, 1.9, 18.6], look: [28.6, 1.2, 24.6] },
  ]
  var coverPoints = [
    V(-33.9, 0, 3.6), V(-31.2, 0, 2.2), V(-29.4, 0, 4.2), V(-28.6, 0, 9.8), V(-26.2, 0, 11.4), V(-24.2, 0, 14.6),
    V(-18.9, 0, 3.4), V(-18.9, 0, 9.4), V(-16, 0, 1.2), V(-13.8, 0, -0.6), V(-9.6, 0, -0.6), V(-12.2, 0, 7.6),
    V(-6.9, 0, 4.9), V(-3, 0, 2.4), V(-1.4, 0, 9.6), V(0.4, 0, -0.6), V(4.2, 0, -0.6), V(5.2, 0, 5.6),
    V(7.4, 0, 1.4), V(7.4, 0, 8.6), V(14.9, 0, 5), V(-2.6, 0, 12.6), V(-5.6, 0, 15.8), V(-10.2, 0, 18.6),
    V(-8, 0, 12.2), V(-14, 0, 13.2), V(3.6, 0, 18.8), V(10.8, 0, 18.4), V(-4, 0, 23.6), V(-12.6, 0, 24.2),
    V(14, 0, 25.6), V(16.8, 0, 13.4), V(-18.4, 0, 19.6), V(-6.6, 0, -4.2), V(-10.4, 0, -7.2), V(3, 0, -4.2),
    V(6.4, 0, -7), V(9.8, 0, -9.6), V(18, 0, -2.4), V(23.4, 0, -6.6), V(19.6, 0, 5.6), V(23, 0, 11.4),
    V(25.2, 0, 13.4), V(20.6, 0, 19.4), V(24.8, 0, 22.6), V(-21.4, 0, -12.6), V(-24.6, 0, -18.4), V(-29, 0, -17.6),
    V(-1.2, 0, -13.6), V(4.4, 0, -15.6), V(-6.8, 0, -16.2), V(9.6, 0, -21.6), V(-12.4, 0, -21), V(15.4, 0, -19.4),
  ]
  var nav = i.physics.nav
  var fix = function (z) {
    if (!(!nav || !nav.isWalkable || z.y > 0.2 || nav.isWalkable(z.x, z.z)))
      for (var r of [0.5, 1, 1.5, 2, 2.5])
        for (var k = 0; k < 8; k++) {
          var q = z.x + Math.cos(k * 0.7854) * r, u = z.z + Math.sin(k * 0.7854) * r
          if (nav.isWalkable(q, u)) {
            z.x = q
            z.z = u
            return
          }
        }
  }
  coverPoints.forEach(fix)
  enemySpawns.forEach(function (z) {
    z.type === 'ground' && fix(z.pos)
  })
  // where the arsenal mod drops its crates (y = surface the item rests on)
  var pickupSpots = [
    { pos: V(-30.4, 0, 5.2), kind: 'ammo' },
    { pos: V(-26.6, 0, 6.6), kind: 'shotgun' },
    { pos: V(-28.4, 0, 8.4), kind: 'grenade' },
    { pos: V(-15.8, 0, 9.8), kind: 'ammo' },
    { pos: V(-9.2, 0, 2.6), kind: 'grenade' },
    { pos: V(-3.1, 0, 11.4), kind: 'ammo' },
    { pos: V(2.4, 0, 4.0), kind: 'ammo' },
    { pos: V(-1.4, no.FLOOR, -14.2), kind: 'ammo' },
    { pos: V(16.4, 0, 2.8), kind: 'grenade' },
    { pos: V(22.4, 0, 8.6), kind: 'ammo' },
    { pos: V(-9.6, 0, -9.2), kind: 'grenade' },
  ]
  var warned = false
  var lt0 = 0
  return {
    root: root,
    map: 'desert',
    maxPlayers: 16, // the big map (room size cap, net/net.js)
    playerStart: playerStart,
    objectives: objectives,
    extraction: { pos: V(26.4, 0, 21.4), radius: 2.5 },
    enemySpawns: enemySpawns,
    zones: zones,
    interiorBoxes: interiorBoxes,
    cinematicPath: cinematicPath,
    coverPoints: coverPoints,
    skylights: hall.skylights,
    shedLights: hall.lights,
    vantage: { stairsFoot: V(-12, 0, 8), roof: V(-21, 9.2, 21.5) },
    pickupSpots: pickupSpots,
    stats: { labelsAtlased: atlas.count, props: t.placed.length, tris: Math.round(tris), meshes: merged.children.length + pR(t.dynRoot) },
    placed: t.placed,
    groundSurfaceAt: function (x, z) {
      if (t.isMetal(x, z)) return 'metal'
      if (x > no.X0 && x < no.X1 && z > no.Z0 && z < no.Z1) return 'concrete'
      if (SXD_ROAD && SXD_roadAt(x, z) && Math.abs(SXD_RQ.d) < 6) return 'concrete' // highway asphalt
      return 'dirt'
    },
    update: function (dt) {
      lt0 += dt
      lamps.uTime.value = lt0
      hall.update(dt)
      atlas.update(dt)
      for (var k = 0; k < t.updaters.length; k++) {
        try {
          t.updaters[k](dt)
        } catch (e) {
          warned || ((warned = true), console.error('[desert] prop update threw', e))
        }
      }
      for (var k2 = 0; k2 < updaters.length; k2++) {
        try {
          updaters[k2](dt)
        } catch (e) {
          warned || ((warned = true), console.error('[desert] prop update threw', e))
        }
      }
    },
  }
}

/* =========================================================== GROUND ===== */

var SXD_MASK = { x0: -56, z0: -48, size: 96 }

// Shared sand albedo/ripple GLSL (used by the ground and the far terrain).
// sharpness knobs: texture anisotropy cap, sand grain contrast, distance haze
// (start in m, density per m) of the far dunes and mesas
var SXD_SHARP = { aniso: 16, grain: 0.32, hazeStart: 140, hazeK: 0.0014 }

var SXD_SAND_COMMON = `
float sdH1(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 sdH2(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float sdVN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sdH1(i), sdH1(i + vec2(1.0, 0.0)), f.x), mix(sdH1(i + vec2(0.0, 1.0)), sdH1(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 sdVor(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 o = vec2(float(x), float(y)); vec2 dv = o + sdH2(i + o) - f; float dd = dot(dv, dv);
    if (dd < d1){ d2 = d1; d1 = dd; id = sdH1(i + o + 3.7); } else if (dd < d2) d2 = dd; }
  return vec3(sqrt(d1), sqrt(d2), id); }
// base sand colour + wind ripple slope at a world xz; loose = how much loose sand is there
vec3 sdSand(vec2 xz, float grain, float detail, float loose, float dist, out vec2 nxz){
  float big = sdVN(xz * 0.045) * 0.6 + sdVN(xz * 0.13 + 7.0) * 0.4;
  vec3 sandA = vec3(0.50, 0.345, 0.205), sandB = vec3(0.40, 0.265, 0.155), sandC = vec3(0.57, 0.41, 0.26);
  vec3 alb = mix(sandB, sandA, smoothstep(0.25, 0.75, big * 0.7 + detail * 0.3));
  alb = mix(alb, sandC, loose * 0.45 * smoothstep(0.35, 0.8, sdVN(xz * 0.21 + 3.0)));
  alb *= ${(1 - SXD_SHARP.grain / 2).toFixed(3)} + ${SXD_SHARP.grain.toFixed(3)} * grain;
  vec2 wd = normalize(vec2(${SXD_WIND[0].toFixed(2)}, ${SXD_WIND[1].toFixed(2)}));
  float warp = (sdVN(xz * 0.35) - 0.5) * 3.2 + (sdVN(xz * 1.1 + 5.0) - 0.5) * 0.9;
  float ph = dot(xz, wd) * 3.2 + warp;
  float rip = 1.0 - smoothstep(0.3, 0.8, fwidth(ph));
  float s1 = sin(ph * 6.2832), c1 = cos(ph * 6.2832), c2 = cos(ph * 12.566);
  nxz = wd * (c1 + 0.6 * c2) * 0.1 * rip * loose;
  alb *= 1.0 + s1 * 0.045 * rip * loose;
  float ph2 = dot(xz, wd) * 0.55 + warp * 0.6;
  float rip2 = 1.0 - smoothstep(0.3, 0.8, fwidth(ph2));
  nxz += wd * cos(ph2 * 6.2832) * 0.05 * loose * rip2;
  alb *= 1.0 + sin(ph2 * 6.2832) * 0.03 * loose * rip2;
  return alb;
}
`

var SXD_GROUND_HEAD = `
uniform sampler2D uSdMask, uSdTracks, uSdDetail, uSdDetailN;
uniform vec3 uSdRect; uniform float uSdMaskRes;
varying vec3 vGWorld;
float sdRough; vec2 sdNxz;
${SXD_SAND_COMMON}
vec4 sdBicubic(sampler2D t, vec2 uv, float res){
  vec2 p = uv * res - 0.5; vec2 i = floor(p); vec2 f = p - i; vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i + w1 / g0 - 0.5) / res, h1 = (i + w3 / g1 + 1.5) / res;
  return (textureLod(t, vec2(h0.x, h0.y), 0.0) * g0.x + textureLod(t, vec2(h1.x, h0.y), 0.0) * g1.x) * g0.y
       + (textureLod(t, vec2(h0.x, h1.y), 0.0) * g0.x + textureLod(t, vec2(h1.x, h1.y), 0.0) * g1.x) * g1.y;
}
`

var SXD_GROUND_BODY = `
{
  vec2 xz = vGWorld.xz;
  float dist = length(cameraPosition - vGWorld);
  vec2 muv = (xz - uSdRect.xy) * uSdRect.z;
  float mIn = smoothstep(0.0, 0.03, min(min(muv.x, 1.0 - muv.x), min(muv.y, 1.0 - muv.y)));
  vec4 mk = mix(vec4(0.0, 0.0, 0.7, 0.5), sdBicubic(uSdMask, muv, uSdMaskRes), mIn);
  vec4 tk = texture2D(uSdTracks, clamp(muv, 0.0, 1.0)) * mIn;
  vec4 d1 = texture2D(uSdDetail, xz * 0.21);
  vec4 d2 = texture2D(uSdDetail, xz * 1.37 + 0.37);
  vec4 n1 = texture2D(uSdDetailN, xz * 1.37 + 0.37);
  vec4 n0 = texture2D(uSdDetailN, xz * 0.21);
  float grain = d2.r;
  float hp = smoothstep(0.3, 0.62, mk.r);
  float gv = smoothstep(0.25, 0.7, mk.g);
  float rut = clamp(tk.r * 1.15, 0.0, 1.0);
  float loose = clamp(1.0 - gv * 1.3 - hp * 1.4 - rut, 0.0, 1.0) * (0.4 + 0.6 * mk.b);
  vec2 nxz;
  vec3 alb = sdSand(xz, grain, d1.g, loose, dist, nxz);
  // ---- cracked clay pan ----
  if (hp > 0.002) {
    vec2 cxz = xz * 2.6 + (vec2(sdVN(xz * 3.1), sdVN(xz * 3.1 + 9.0)) - 0.5) * 0.45;
    vec3 v = sdVor(cxz);
    float e = v.y - v.x;
    float cw = 0.05 + 0.05 * sdVN(xz * 0.8);
    float cfw = fwidth(e) * 1.2 + 1e-4;
    float crack = 1.0 - smoothstep(cw - cfw, cw + cfw, e);
    vec3 v2 = sdVor(cxz * 3.1 + 17.0);
    float e2 = v2.y - v2.x;
    float crack2 = (1.0 - smoothstep(0.03, 0.07 + fwidth(e2), e2)) * 0.5 * (1.0 - smoothstep(6.0, 18.0, dist));
    vec3 clay = mix(vec3(0.40, 0.285, 0.19), vec3(0.47, 0.34, 0.235), v.z) * (0.9 + 0.2 * grain);
    clay *= 1.0 - 0.1 * smoothstep(0.0, 0.5, v.x);
    float cfade = 0.25 + 0.75 * (1.0 - smoothstep(6.0, 26.0, dist));
    vec3 hpc = mix(clay, vec3(0.15, 0.105, 0.07), max(crack, crack2) * 0.8 * cfade);
    alb = mix(alb, hpc, hp);
    nxz = mix(nxz, (n1.rg - 0.5) * 0.35, hp * 0.8) + hp * crack * (n0.ba - 0.5) * 0.5;
  }
  // ---- gravel / hard-packed ground ----
  vec3 grav = mix(vec3(0.40, 0.29, 0.19), vec3(0.52, 0.40, 0.28), smoothstep(0.45, 0.8, d2.a)) * (0.82 + 0.36 * d2.g);
  grav = mix(grav, vec3(0.22, 0.16, 0.11), smoothstep(0.62, 0.8, d2.b) * 0.45);
  alb = mix(alb, grav, gv * 0.7);
  nxz = mix(nxz, (n1.rg - 0.5) * 1.5, gv * 0.7);
  // ---- tyre ruts + tread ----
  alb *= 1.0 - rut * 0.14;
  alb = mix(alb, alb * 0.74, clamp(tk.g * 1.4, 0.0, 1.0) * rut * (1.0 - smoothstep(10.0, 40.0, dist)));
  nxz *= 1.0 - rut * 0.6;
  alb *= 0.9 + 0.2 * mk.a;
  diffuseColor.rgb *= alb;
  sdRough = clamp(0.94 - gv * 0.05 - rut * 0.07 - hp * 0.06 + (grain - 0.5) * 0.06, 0.5, 1.0);
  nxz += (n0.ba - 0.5) * 0.22 + (n1.rg - 0.5) * 0.3 * (1.0 - gv) * (1.0 - hp);
  sdNxz = nxz;
}
`

function SXD_maskData(res) {
  var data = new Uint8Array(res * res * 4)
  var R = SXD_MASK, cell = R.size / res
  var B = SXD_BOUND
  // hard-packed areas: road, aprons round buildings, pads
  var pads = [
    [-34.5, 5.5, 5, 4.5], [1.5, 8.2, 5.5, 4], [21, -4.2, 4.5, 4.5], [25.5, 7.4, 3.5, 3.2],
    [26.4, 22.5, 4.5, 4], [-3.5, -9.6, 4, 2.2], [13.2, -19.5, 2.4, 4], [-11, 13.6, 4.2, 1.9], [7, 20.2, 4.2, 1.9], [-3.5, 25.3, 4.2, 1.9],
  ]
  for (var r = 0; r < res; r++) {
    var z = R.z0 + (r + 0.5) * cell
    for (var c = 0; c < res; c++) {
      var x = R.x0 + (c + 0.5) * cell
      var o = (r * res + c) * 4
      // dry clay pans in a few low patches (away from the road)
      var edge = (SXD_fbm2(x / 3.2 + 7, z / 3.2 - 2, 4) - 0.5) * 5
      var pan = Math.max(SXD_smooth(6.5, 3, Math.hypot(x + 8, z - 21.5) + edge), SXD_smooth(5.5, 2.5, Math.hypot(x + 31, z - 19) + edge), SXD_smooth(5, 2, Math.hypot(x - 23.5, z + 15) + edge), SXD_smooth(4.5, 2, Math.hypot(x + 29, z + 6.5) + edge), SXD_smooth(4, 1.5, Math.hypot(x - 9, z - 25.5) + edge))
      pan *= SXD_smooth(0.3, 0.55, SXD_fbm2(x / 4, z / 4, 3))
      var g = 0
      for (var k = 0; k < pads.length; k++) {
        var p = pads[k], dx = (x - p[0]) / p[2], dz = (z - p[1]) / p[3]
        g = Math.max(g, SXD_smooth(1.15, 0.55, Math.sqrt(dx * dx + dz * dz)))
      }
      g = g * SXD_smooth(0.25, 0.65, SXD_fbm2(x / 2.6, z / 2.6, 3) + g * 0.25)
      // the hall's concrete footprint
      if (x > -16.5 && x < 12.5 && z > -28.5 && z < -10.5) g = Math.max(g, 0.8)
      // loose drift sand piles against the berm foot and in the open
      var inside = Math.min(x - B.x0, B.x1 - x, z - B.z0, B.z1 - z)
      var drift = Math.max(SXD_smooth(4, 0, inside), SXD_smooth(0.45, 0.75, SXD_fbm2(x / 9 - 5, z / 9 + 2, 3)))
      data[o] = Math.round(Math.min(1, pan * (1 - g)) * 255)
      data[o + 1] = Math.round(Math.min(1, g) * 255)
      data[o + 2] = Math.round(Math.min(1, drift) * 255)
      data[o + 3] = Math.round(SXD_fbm2(x / 22 + 9, z / 22 - 4, 3) * 255)
    }
  }
  return data
}

function SXD_trackTexture(size, aniso) {
  var cv = document.createElement('canvas')
  cv.width = cv.height = size
  var g = cv.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, size, size)
  var R = SXD_MASK, k = size / R.size
  g.setTransform(k, 0, 0, k, -R.x0 * k, -R.z0 * k)
  g.globalCompositeOperation = 'lighter'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  var rnd = SXD_rng(4242)
  var offsetPath = function (pts, off) {
    var out = []
    for (var n = 0; n < pts.length; n++) {
      var a = pts[Math.max(0, n - 1)], b = pts[Math.min(pts.length - 1, n + 1)]
      var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1
      out.push([pts[n][0] - (dz / l) * off, pts[n][1] + (dx / l) * off])
    }
    return out
  }
  var smoothPath = function (pts) {
    var out = []
    for (var n = 0; n < pts.length - 1; n++) {
      var p0 = pts[Math.max(0, n - 1)], p1 = pts[n], p2 = pts[n + 1], p3 = pts[Math.min(pts.length - 1, n + 2)]
      for (var s = 0; s < 8; s++) {
        var u = s / 8, u2 = u * u, u3 = u2 * u
        var f = function (a, b, c, d) {
          return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3)
        }
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
      }
    }
    out.push(pts[pts.length - 1])
    return out
  }
  var stroke = function (pts, w, color, dash) {
    g.strokeStyle = color
    g.lineWidth = w
    g.setLineDash(dash || [])
    g.beginPath()
    g.moveTo(pts[0][0], pts[0][1])
    for (var n = 1; n < pts.length; n++) g.lineTo(pts[n][0], pts[n][1])
    g.stroke()
    g.setLineDash([])
  }
  var drive = function (route, passes, gauge) {
    var base = smoothPath(route)
    for (var p = 0; p < passes; p++) {
      var jitter = (rnd() - 0.5) * 0.5
      for (var s of [-1, 1]) {
        var path = offsetPath(base, s * gauge * 0.5 + jitter)
        stroke(path, 0.55, 'rgba(110,0,0,0.35)')
        stroke(path, 0.3, 'rgba(160,0,0,0.6)')
        stroke(path, 0.3, 'rgba(0,200,0,0.75)', [0.05, 0.07])
      }
    }
  }
  drive([[-60, 6.2], [-40, 6.0], [-30, 6.4], [-20, 7.6], [-10, 8.6], [-2, 8.0], [5, 7.0], [12, 9.5], [19, 13], [24, 18], [27, 23], [40, 24]], 3, 1.75)
  drive([[-20, 7.6], [-12, 4], [-6, -4], [-3.5, -9.5]], 2, 1.75)
  drive([[5, 7], [12, 1.2], [17, -1.5], [21, -2]], 1, 1.6)
  drive([[-30, 6.4], [-27, 0], [-26, -8], [-24, -14]], 1, 1.7)
  var tex = new lt.CanvasTexture(cv)
  tex.flipY = false
  tex.colorSpace = lt.NoColorSpace
  tex.wrapS = tex.wrapT = lt.ClampToEdgeWrapping
  tex.minFilter = lt.LinearMipmapLinearFilter
  tex.magFilter = lt.LinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = aniso
  tex.needsUpdate = true
  return tex
}

async function SXD_ground(i) {
  var hi = (i.quality.tex || 512) >= 1024
  // the GPU's full anisotropy (was capped at 8): the sand detail stays crisp at grazing angles
  var aniso = Math.min(SXD_SHARP.aniso, i.renderer.capabilities.getMaxAnisotropy ? i.renderer.capabilities.getMaxAnisotropy() : 1)
  var mres = hi ? 1024 : 512
  var mask = N1(SXD_maskData(mres), mres, { repeat: false, aniso: 2 })
  var dres = hi ? 512 : 256
  var det = Cb(dres)
  var detail = N1(det.det, dres, { aniso: aniso })
  var detailN = N1(det.nrm, dres, { aniso: aniso })
  var tracks = SXD_trackTexture(hi ? 2048 : 1024, aniso)
  var uniforms = {
    uSdMask: { value: mask },
    uSdTracks: { value: tracks },
    uSdDetail: { value: detail },
    uSdDetailN: { value: detailN },
    uSdRect: { value: new lt.Vector3(SXD_MASK.x0, SXD_MASK.z0, 1 / SXD_MASK.size) },
    uSdMaskRes: { value: mres },
  }
  var mat = new lt.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
  mat.name = 'desert_sand'
  mat.onBeforeCompile = function (sh) {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = 'varying vec3 vGWorld;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SXD_GROUND_HEAD)
      .replace('#include <map_fragment>', SXD_GROUND_BODY)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = sdRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(mat3(viewMatrix) * normalize(vec3(-sdNxz.x, 1.0, -sdNxz.y)));')
  }
  mat.customProgramCacheKey = function () {
    return 'sxd-sand-1'
  }
  var geo = new lt.PlaneGeometry(700, 700, 1, 1).rotateX(-Math.PI / 2).translate(-4.5, 0, 0)
  var mesh = new lt.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.name = 'desert-ground'
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()
  var root = new lt.Group()
  root.name = 'ground'
  root.add(mesh)
  i.scene.add(root)

  // drifting dust: a few faint sand puffs blown across the basin round the camera
  var dustT = 0, warnT = 0, rnd = SXD_rng(77)
  var wind = new lt.Vector3(SXD_WIND[0] * 2.4, 0, SXD_WIND[1] * 2.4)
  var tmp = new lt.Vector3()
  return {
    root: root,
    apron: mesh,
    sea: null,
    rain: null,
    planar: null,
    maskTexture: mask,
    uniforms: uniforms,
    desert: true,
    puddleDepth: function () {
      return -0.2
    },
    isPuddle: function () {
      return false
    },
    wetnessAt: function () {
      return 0
    },
    seaHeight: function () {
      return -50
    },
    setRain: function () {},
    get rainLevel() {
      return 0
    },
    setReflections: function () {},
    update: function (dt) {
      // nearing the edge of the roaming radius: tell the player to turn back
      warnT -= dt
      if (SXD_HG && i.player && i.hud && i.hud.message && i.game && i.game.state === 'playing' && warnT <= 0) {
        var pr = Math.hypot(i.player.pos.x - SXD_HG.cx, i.player.pos.z - SXD_HG.cz)
        if (pr > SXD_PLAY_R - 22) {
          warnT = 2.5
          i.hud.message('Leaving the operation area — turn back', 2.4)
        }
      }
      dustT -= dt
      if (dustT > 0 || !i.fx || !i.fx.smoke || !i.camera) return
      dustT = 0.22 + rnd() * 0.25
      var cam = i.camera.position
      var a = rnd() * Math.PI * 2, d = 5 + rnd() * 16
      tmp.set(cam.x + Math.cos(a) * d - wind.x * 2, 0.15 + rnd() * 0.5, cam.z + Math.sin(a) * d - wind.z * 2)
      if (tmp.x > no.X0 - 1 && tmp.x < no.X1 + 1 && tmp.z > no.Z0 - 1 && tmp.z < no.Z1 + 1) return
      try {
        i.fx.smoke(tmp, { size: 1.6 + rnd() * 2.2, life: 3.5 + rnd() * 2, rise: 0.08, count: 1, alpha: 0.05 + rnd() * 0.05, color: 0xc9a47a, vel: wind })
      } catch (e) {}
    },
  }
}

/* ========================================================= BACKDROP ===== */

var SXD_TERRAIN_HEAD = `
varying vec3 vSdW; varying vec3 vSdN;
uniform vec3 uSdHazeA, uSdHazeB, uSdSun;
float sdRoughT; vec2 sdNxzT; vec3 sdRockN; float sdRockW;
${SXD_SAND_COMMON}
// value noise on a cliff face: projected on the x and z planes (the face's
// horizontal axis) and blended by how the face is turned, so no smear where
// it bends; k = (horizontal, vertical) frequency
float sdFace(vec3 p, float yv, float wx, vec2 k){
  return mix(sdVN(vec2(p.x * k.x, yv * k.y)), sdVN(vec2(p.z * k.x + 17.3, yv * k.y)), wx);
}
`

var SXD_TERRAIN_BODY = `
{
  vec2 xz = vSdW.xz;
  float dist = length(cameraPosition - vSdW);
  vec3 wn = normalize(vSdN);
  float slope = 1.0 - wn.y;
  vec2 nxz;
  float grain = sdVN(xz * 23.0) * 0.5 + sdVN(xz * 61.0) * 0.5;
  vec3 sand = sdSand(xz, grain, sdVN(xz * 0.9), 0.9 * (1.0 - smoothstep(0.25, 0.5, slope)), dist, nxz);
  // ---- sandstone on the steep faces (mesa cliffs, cut banks) ----
  // strata ~4.8 m apart, gently warped, each its own colour (cream, salmon,
  // rust, chocolate, pale) with thin bands inside
  float yw = vSdW.y + (sdVN(xz * 0.035) - 0.5) * 5.0 + (sdVN(xz * 0.12) - 0.5) * 1.2;
  float yl = yw * 0.21, bid = floor(yl), fb = fract(yl);
  float thick = 0.55 + 0.9 * sdH1(vec2(bid, 11.0));
  float pick = sdH1(vec2(bid, 3.0));
  vec3 rock = pick < 0.25 ? vec3(0.78, 0.60, 0.42) : pick < 0.5 ? vec3(0.72, 0.44, 0.28) : pick < 0.72 ? vec3(0.60, 0.31, 0.18) : pick < 0.86 ? vec3(0.44, 0.25, 0.15) : vec3(0.86, 0.72, 0.54);
  float sub = fract(yl * 3.0 + sdVN(xz * 0.5) * 0.3);
  rock *= 0.92 + 0.12 * smoothstep(0.2, 0.5, sub) * (1.0 - smoothstep(0.6, 0.9, sub));
  vec3 aw = abs(wn);
  float wx = aw.x / (aw.x + aw.z + 1e-4);
  // desert varnish: dark streaks running down the face from each ledge
  float st = sdFace(vSdW, yw, wx, vec2(0.55, 0.035)) * 0.65 + sdFace(vSdW, yw, wx, vec2(1.7, 0.08)) * 0.35;
  float steep = smoothstep(0.45, 0.75, slope); // varnish and joints on the cliffs, not the benches
  float varn = smoothstep(0.55, 0.85, st) * (0.45 + 0.55 * smoothstep(0.9, 0.2, fb)) * steep;
  rock = mix(rock, rock * vec3(0.36, 0.27, 0.21), varn * 0.75);
  // joints: near-vertical fractures (straight up: low vertical frequency)
  float jn = sdFace(vSdW, yw, wx, vec2(0.9, 0.012));
  float joint = (1.0 - smoothstep(0.0, 0.03 + fwidth(jn) * 1.5, abs(jn - 0.5))) * steep;
  // relief (m) for the bump: each layer bulges with its base undercut, the
  // joints cut in, a rough grain over all
  // (the fine grain fades out with distance: it shimmered into a grid far off)
  float rough = mix(sdFace(vSdW, yw, wx, vec2(1.3, 1.3)) * 0.6 + sdFace(vSdW, yw, wx, vec2(4.1, 4.1)) * 0.4, 0.5, smoothstep(35.0, 140.0, dist));
  float ledge = smoothstep(0.0, 0.08, fb) * (1.0 - smoothstep(0.86, 1.0, fb));
  float relief = ledge * 0.35 * thick + rough * 0.18 - joint * 0.25;
  // shade in the undercuts and the joints
  rock *= 1.0 - ((1.0 - smoothstep(0.0, 0.1, fb)) * 0.5 + joint * 0.55) * 0.45;
  rock *= 0.9 + 0.2 * rough;
  float rk = smoothstep(0.32, 0.55, slope + (sdVN(xz * 0.3) - 0.5) * 0.2);
  // bump from the relief (screen-space derivatives, Mikkelsen), rock only,
  // fading out with distance; the derivatives are taken on every fragment
  vec3 dpx = dFdx(vSdW), dpy = dFdy(vSdW);
  float dhx = dFdx(relief), dhy = dFdy(relief);
  vec3 r1 = cross(dpy, wn), r2 = cross(wn, dpx);
  float det = dot(dpx, r1);
  vec3 bg = sign(det) * (dhx * r1 + dhy * r2);
  float bl = length(bg), bm = abs(det) * 0.85; // no steeper than ~40° off the face (sharp mesh edges spiked it)
  if (bl > bm) bg *= bm / bl;
  vec3 bn = abs(det) * wn - bg;
  sdRockN = dot(bn, bn) > 1e-14 ? normalize(bn) : wn;
  sdRockW = rk * (1.0 - smoothstep(60.0, 220.0, dist));
  vec3 alb = mix(sand, rock, rk);
  diffuseColor.rgb *= alb;
  sdRoughT = mix(0.95, 0.9, rk);
  sdNxzT = nxz * (1.0 - rk) * (1.0 - smoothstep(25.0, 80.0, dist));
}
`

var SXD_TERRAIN_HAZE = `
{
  float dist = length(cameraPosition - vSdW);
  vec3 dir = normalize(vSdW - cameraPosition);
  float ts = clamp(dot(normalize(dir.xz + vec2(1e-5)), normalize(uSdSun.xz)) * 0.5 + 0.5, 0.0, 1.0);
  vec3 haze = mix(uSdHazeA, uSdHazeB, pow(ts, 3.0));
  float hz = 1.0 - exp(-max(dist - ${SXD_SHARP.hazeStart.toFixed(1)}, 0.0) * ${SXD_SHARP.hazeK.toFixed(5)});
  hz *= 1.0 - 0.45 * smoothstep(20.0, 120.0, vSdW.y);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, haze, clamp(hz, 0.0, 0.92));
}
`

// Signed distance (x/z) to the basin's rounded rectangle; > 0 outside.
function SXD_basinSd(x, z) {
  var B = SXD_BOUND
  var cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2
  var hx = (B.x1 - B.x0) / 2 - 4, hz = (B.z1 - B.z0) / 2 - 4, rr = 4
  var qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz
  var ox = Math.max(qx, 0), oz = Math.max(qz, 0)
  return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - rr
}

var SXD_MESAS = [
  [250, -190, 110, 62], [-330, 150, 150, 52], [60, 430, 120, 80], [-140, -390, 95, 58], [430, 140, 140, 46], [-470, -150, 120, 72], [300, 380, 90, 40], [-420, 380, 140, 66],
]

// Mesa tracks: a straight embankment ramp per mesa, from the plain up to the
// caprock at `grade` (0.32 ≈ 18°: the Sandcat and, slower, the Rhino make it),
// `half` m of flat bed each side of the axis, then `bank` m drop per m. The
// direction is picked once (SXD_mesaRamps): clear of the basin, the other
// mesas, the outposts and the highway, and as much towards the basin as that
// allows, so it is in sight from the base.
var SXD_RAMP_TUNE = { grade: 0.32, half: 4, bank: 1.5, dirs: 36 }
var SXD_RAMPS = null
function SXD_polyDist(x, z, P) {
  var best = Infinity
  for (var k = 0; k + 1 < P.length; k++) {
    var ax = P[k][0], az = P[k][1], bx = P[k + 1][0] - ax, bz = P[k + 1][1] - az
    var t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz)))
    best = Math.min(best, Math.hypot(x - ax - bx * t, z - az - bz * t))
  }
  return best
}
function SXD_mesaRamps() {
  if (SXD_RAMPS) return SXD_RAMPS
  var B = SXD_BOUND, bcx = (B.x0 + B.x1) / 2, bcz = (B.z0 + B.z1) / 2, T = SXD_RAMP_TUNE
  var sites = typeof SXO_SITES !== 'undefined' ? SXO_SITES : []
  SXD_RAMPS = SXD_MESAS.map(function (m, k) {
    var toC = Math.atan2(bcz - m[1], bcx - m[0]), best = null
    for (var c = 0; c < T.dirs; c++) {
      var a = (c / T.dirs) * Math.PI * 2, ax = Math.cos(a), az = Math.sin(a)
      var edge = m[2] * (1 + (SXD_fbm2(a * 2.2 + k * 3.3, k * 1.7, 4) - 0.5) * 0.55)
      var s0 = edge - 4, s1 = edge + m[3] / T.grade, bad = 0
      for (var s = edge; s <= s1; s += 8)
        for (var o = -1; o <= 1; o++) {
          var x = m[0] + ax * s - az * o * 10, z = m[1] + az * s + ax * o * 10
          if (SXD_basinSd(x, z) < 25) bad++
          for (var q = 0; q < SXD_MESAS.length; q++) if (q !== k && Math.hypot(x - SXD_MESAS[q][0], z - SXD_MESAS[q][1]) < SXD_MESAS[q][2] * 1.3 + 10) bad++
          for (var p = 0; p < sites.length; p++) if (Math.hypot(x - sites[p].x, z - sites[p].z) < sites[p].r + 45) bad++
          if (SXD_polyDist(x, z, SXD_ROAD_PTS) < 40) bad++
        }
      var score = Math.cos(a - toC) - bad * 10
      if (!best || score > best.score) best = { score: score, ax: ax, az: az, s0: s0, s1: s1, bad: bad }
    }
    return { cx: m[0], cz: m[1], ax: best.ax, az: best.az, s0: best.s0, s1: best.s1, top: m[3], bad: best.bad }
  })
  return SXD_RAMPS
}
// the embankment falls away at `bank` sideways and past the caprock end too,
// so it always meets the ground (no wall where it is cut off)
function SXD_rampLift(x, z, h) {
  var R = SXD_mesaRamps(), T = SXD_RAMP_TUNE
  for (var k = 0; k < R.length; k++) {
    var r = R[k], dx = x - r.cx, dz = z - r.cz, fall = r.top / T.bank
    var s = dx * r.ax + dz * r.az
    if (s < r.s0 - fall || s > r.s1) continue
    var t = Math.abs(-dx * r.az + dz * r.ax)
    if (t > T.half + fall) continue
    var rh = r.top * Math.max(0, Math.min(1, (r.s1 - s) / (r.s1 - r.s0))) - Math.max(0, t - T.half) * T.bank - Math.max(0, r.s0 - s) * T.bank
    if (rh > h) h = rh
  }
  return h
}

// One mesa's height at distance d / angle a from its centre:
//  * the caprock: flat out to `edge` (an fbm outline, as before), with a few
//    erosion gullies notched into the rim (none near the mesa's track)
//  * the cliff: over cliffW m it drops `drop` of the height in 3-5 layers,
//    each a steep riser (the first `riser` of the layer) then a sloping
//    bench where sand collects (`stepped` of the drop in the steps, the rest
//    an even slope); the benches wobble in and out round the mesa. Knife-
//    edged steps narrower than the 2 m height grid came out as a sawtooth of
//    pleats along the curved rim, so the fine ledges are the shader's
//  * the talus: from the cliff foot down to the plain over talusLen m,
//    strewn with rubble (`scree` m of fbm bumps)
var SXD_MESA_TUNE = { cliffW: 40, drop: 0.62, riser: 0.7, stepped: 0.7, gullies: 4, talusLen: 100, scree: 2.6 }
function SXD_angDist(a, b) { var d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d }
function SXD_mesaH(k, m, d, a, x, z) {
  var T = SXD_MESA_TUNE, top = m[3]
  var edge = m[2] * (1 + (SXD_fbm2(a * 2.2 + k * 3.3, k * 1.7, 4) - 0.5) * 0.55)
  var R = SXD_RAMPS && SXD_RAMPS[k], ra = R ? Math.atan2(R.az, R.ax) : null
  for (var j = 0; j < T.gullies; j++) {
    var ga = SXD_h(k, j, 1.3) * Math.PI * 2
    if (ra != null && SXD_angDist(ga, ra) < 0.55) continue
    var hw = (5 + 6 * SXD_h(k, j, 2.7)) / m[2] // half width, in rad of the rim
    var ad = SXD_angDist(a, ga)
    if (ad < hw) edge -= (1 - ad / hw) * (9 + 13 * SXD_h(k, j, 4.1))
  }
  if (d <= edge) return top
  var W = T.cliffW * (0.8 + 0.4 * SXD_fbm2(a * 1.7 + k, 3.1, 2))
  var t = (d - edge) / W + (SXD_fbm2(a * 7 + k * 2, d * 0.05, 2) - 0.5) * 0.18
  var lowTop = top * (1 - T.drop), cliff = 0
  if (t < 1) {
    var N = 3 + (k % 3), tc = Math.max(0, t), lay = tc * N, li = Math.floor(lay), lf = lay - li
    var rs = T.riser * (0.8 + 0.4 * SXD_h(k, li, 7.7))
    // `stepped` of the drop in the layers, the rest an even slope (no knife-edged benches)
    var sd = ((li + SXD_smooth(0, rs, lf)) / N) * T.stepped + tc * (1 - T.stepped)
    cliff = top * (1 - T.drop * sd)
  }
  var talus = lowTop * (1 - SXD_smooth(edge + W, edge + W + T.talusLen, d))
  if (talus > 0.3) talus += (SXD_fbm2(x / 7 + k, z / 7 - k, 3) - 0.5) * T.scree * Math.min(1, (talus / lowTop) * 2)
  return Math.max(cliff, talus)
}

function SXD_terrainBase(x, z) {
  var u = SXD_basinSd(x, z)
  if (u <= 0) return 0
  var B = SXD_BOUND
  // road cuts through the berm: west at z~6, east breach at z~23
  var cutW = x < B.x0 + 2 ? SXD_smooth(7, 4, Math.abs(z - 6.2)) * SXD_smooth(120, 60, u) : 0
  var cutE = x > B.x1 - 2 ? SXD_smooth(6.5, 3.6, Math.abs(z - 23.2)) * SXD_smooth(90, 40, u) : 0
  var cut = Math.max(cutW, cutE)
  var th = Math.atan2(z, x)
  var bh = 4.6 + 2.8 * SXD_fbm2(th * 3 + 1.3, 0.7, 3)
  var berm = bh * SXD_smooth(0, 12, u) * (1 - 0.35 * SXD_smooth(14, 32, u))
  // dune field: ridges across the wind, growing with distance
  var wx = x * SXD_WIND[0] + z * SXD_WIND[1], wz = -x * SXD_WIND[1] + z * SXD_WIND[0]
  var s = SXD_fbm2(wx / 46 + 4.1, wz / 120 - 2.3, 4)
  var ridge = 1 - Math.abs(2 * s - 1)
  ridge = Math.pow(ridge, 1.7)
  var amp = 1.2 + 15 * SXD_smooth(14, 240, u)
  var dunes = amp * (ridge * 0.85 + SXD_fbm2(x / 70, z / 70, 3) * 0.4) * SXD_smooth(5, 16, u)
  var h = (berm + dunes) * (1 - cut * 0.93)
  // mesas: flat caprock, layered cliff, gullies, rubbly talus (SXD_mesaH)
  SXD_mesaRamps() // their tracks keep the gullies away
  for (var k = 0; k < SXD_MESAS.length; k++) {
    var m = SXD_MESAS[k], dx = x - m[0], dz = z - m[1]
    var d = Math.hypot(dx, dz)
    if (d > m[2] + 230) continue
    h = Math.max(h, SXD_mesaH(k, m, d, Math.atan2(dz, dx), x, z))
  }
  // a dirt track up each mesa, so vehicles can drive onto the caprock
  h = SXD_rampLift(x, z, h)
  // outposts (outposts feature): carve a flat bowl, floor at y = 0
  if (typeof SXO_SITES !== 'undefined') {
    for (var q = 0; q < SXO_SITES.length; q++) {
      var site = SXO_SITES[q], sd = Math.hypot(x - site.x, z - site.z)
      if (sd < site.r + 34) h *= SXD_smooth(site.r, site.r + 34, sd)
    }
  }
  return h
}

/* ============================================================ HIGHWAY ===== */
// A two-lane desert highway crosses the dunes north–south, west of the basin:
// down the valley between the Fuel Depot and the Ridge Post mesas, under the
// power line, past Camp Mirage, across the west road (the Talon's runway) and
// on south between the Radar Station and the big western mesa. Its surface
// texture is baked from a photogrammetry scan of a real desert highway (see
// CREDITS.md). The road is part of the ground: SXD_terrainHeight levels a
// flat bed along it (smoothed profile, max 5 % grade, pinned to the runway
// where they cross) with 1:2 cut/fill banks, so walking, wheels, bullets and
// the minimap all see the same road the ribbon draws.
var SXD_ROAD_PTS = [
  [118, -1150], [92, -830], [75, -640], [60, -480], [30, -330], [0, -210], [-75, -95], [-95, 6],
  [-105, 120], [-125, 260], [-160, 420], [-185, 640], [-202, 830], [-222, 1150],
]
var SXD_ROAD_TUNE = { half: 8, flat: 8.6, bank: 3, batter: 2, grade: 0.05, sigma: 36, step: 2, reach: 56, cell: 16, tile: 96, pole: 55, poleOff: 11.5 }
var SXD_ROAD = null
var SXD_RQ = { d: 0, s: 0, y: 0, k: 0 } // last SXD_roadAt result

function SXD_roadData() {
  if (SXD_ROAD) return SXD_ROAD
  var T = SXD_ROAD_TUNE, P = SXD_ROAD_PTS
  // centripetal Catmull–Rom through the control points, then resampled every T.step m
  var dense = []
  var pt = function (k) {
    if (k < 0) return [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]]
    if (k >= P.length) { var a = P[P.length - 1], b = P[P.length - 2]; return [2 * a[0] - b[0], 2 * a[1] - b[1]] }
    return P[k]
  }
  var lerp = function (a, b, ta, tb, t) { var u = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u] }
  for (var k = 0; k < P.length - 1; k++) {
    var p0 = pt(k - 1), p1 = pt(k), p2 = pt(k + 1), p3 = pt(k + 2)
    var t0 = 0, t1 = t0 + Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])), t2 = t1 + Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])), t3 = t2 + Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]))
    for (var j = 0; j < 120; j++) {
      var t = t1 + ((t2 - t1) * j) / 120
      var A1 = lerp(p0, p1, t0, t1, t), A2 = lerp(p1, p2, t1, t2, t), A3 = lerp(p2, p3, t2, t3, t)
      var B1 = lerp(A1, A2, t0, t2, t), B2 = lerp(A2, A3, t1, t3, t)
      dense.push(lerp(B1, B2, t1, t2, t))
    }
  }
  dense.push(P[P.length - 1])
  var xs = [dense[0][0]], zs = [dense[0][1]], acc = 0, want = T.step
  for (var d = 1; d < dense.length; d++) {
    var ax = dense[d - 1][0], az = dense[d - 1][1], seg = Math.hypot(dense[d][0] - ax, dense[d][1] - az)
    while (acc + seg >= want) {
      var u = (want - acc) / seg
      xs.push(ax + (dense[d][0] - ax) * u); zs.push(az + (dense[d][1] - az) * u)
      want += T.step
    }
    acc += seg
  }
  var n = xs.length
  var R = { n: n, x: new Float32Array(xs), z: new Float32Array(zs), tx: new Float32Array(n), tz: new Float32Array(n), y: new Float32Array(n), pins: [] }
  for (var i = 0; i < n; i++) {
    var i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), dx = R.x[i1] - R.x[i0], dz = R.z[i1] - R.z[i0], l = Math.hypot(dx, dz) || 1
    R.tx[i] = dx / l; R.tz[i] = dz / l
  }
  // height profile: the ground under the bed, smoothed, grade-limited, pinned
  var raw = new Float32Array(n)
  for (var i2 = 0; i2 < n; i2++) {
    var sx = R.tz[i2], sz = -R.tx[i2], m = 0
    for (var o = -6; o <= 6; o += 6) m += SXD_terrainBase(R.x[i2] + sx * o, R.z[i2] + sz * o)
    raw[i2] = m / 3
  }
  var sg = T.sigma / T.step, W = Math.ceil(sg * 3)
  for (var i3 = 0; i3 < n; i3++) {
    var sw = 0, sv = 0
    for (var q = -W; q <= W; q++) { var ii = Math.min(n - 1, Math.max(0, i3 + q)), w = Math.exp(-(q * q) / (2 * sg * sg)); sw += w; sv += raw[ii] * w }
    R.y[i3] = sv / sw
  }
  // where it crosses the west road (the Talon's runway, z ≈ 6.2) it sits on the runway
  for (var i4 = 0; i4 + 1 < n; i4++)
    if ((R.z[i4] - 6.2) * (R.z[i4 + 1] - 6.2) <= 0 && R.x[i4] < -40 && R.x[i4] > -200) R.pins.push([i4, SXD_terrainBase(R.x[i4], 6.2)])
  // grade limit: each pin's cone first, then a forward and a backward pass (both keep the cones)
  var g = T.grade * T.step
  for (var pn = 0; pn < R.pins.length; pn++)
    for (var c0 = 0; c0 < n; c0++) { var py = R.pins[pn][1], pr = g * Math.abs(c0 - R.pins[pn][0]); R.y[c0] = Math.min(py + pr, Math.max(py - pr, R.y[c0])) }
  for (var f = 1; f < n; f++) R.y[f] = Math.min(R.y[f - 1] + g, Math.max(R.y[f - 1] - g, R.y[f]))
  for (var b2 = n - 2; b2 >= 0; b2--) R.y[b2] = Math.min(R.y[b2 + 1] + g, Math.max(R.y[b2 + 1] - g, R.y[b2]))
  // segment buckets for the nearest-point lookups
  var x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
  for (var i5 = 0; i5 < n; i5++) { x0 = Math.min(x0, R.x[i5]); x1 = Math.max(x1, R.x[i5]); z0 = Math.min(z0, R.z[i5]); z1 = Math.max(z1, R.z[i5]) }
  x0 -= T.reach + T.cell; z0 -= T.reach + T.cell
  var C = T.cell, cw = Math.ceil((x1 + T.reach + C - x0) / C), ch = Math.ceil((z1 + T.reach + C - z0) / C)
  var cells = new Array(cw * ch)
  for (var s6 = 0; s6 + 1 < n; s6++) {
    var ca = Math.floor((Math.min(R.x[s6], R.x[s6 + 1]) - T.reach - x0) / C), cb = Math.floor((Math.max(R.x[s6], R.x[s6 + 1]) + T.reach - x0) / C)
    var ra = Math.floor((Math.min(R.z[s6], R.z[s6 + 1]) - T.reach - z0) / C), rb = Math.floor((Math.max(R.z[s6], R.z[s6 + 1]) + T.reach - z0) / C)
    for (var r = ra; r <= rb; r++) for (var c = ca; c <= cb; c++) { var key = r * cw + c; (cells[key] || (cells[key] = [])).push(s6) }
  }
  R.grid = { x0: x0, z0: z0, cw: cw, ch: ch, cells: cells }
  SXD_ROAD = R
  return R
}

// Nearest point of the road centre line to (x, z) within T.reach: fills SXD_RQ
// (d = signed distance, + to the road's right; s = metres along; y = bed
// height; k = segment) and returns true, or false when the road is further.
function SXD_roadAt(x, z) {
  var R = SXD_ROAD || SXD_roadData(), G = R.grid, C = SXD_ROAD_TUNE.cell
  var c = Math.floor((x - G.x0) / C), r = Math.floor((z - G.z0) / C)
  if (c < 0 || r < 0 || c >= G.cw || r >= G.ch) return false
  var list = G.cells[r * G.cw + c]
  if (!list) return false
  var best = Infinity, bk = -1, bt = 0
  for (var q = 0; q < list.length; q++) {
    var k = list[q], ax = R.x[k], az = R.z[k], dx = R.x[k + 1] - ax, dz = R.z[k + 1] - az
    var t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)
    t = t < 0 ? 0 : t > 1 ? 1 : t
    var ex = x - ax - dx * t, ez = z - az - dz * t, dd = ex * ex + ez * ez
    if (dd < best) { best = dd; bk = k; bt = t }
  }
  var reach = SXD_ROAD_TUNE.reach
  if (bk < 0 || best > reach * reach) return false
  var ax2 = R.x[bk], az2 = R.z[bk], dx2 = R.x[bk + 1] - ax2, dz2 = R.z[bk + 1] - az2
  var side = (x - ax2) * dz2 - (z - az2) * dx2 // > 0: right of the direction of travel
  SXD_RQ.d = (side >= 0 ? 1 : -1) * Math.sqrt(best)
  SXD_RQ.s = (bk + bt) * SXD_ROAD_TUNE.step
  SXD_RQ.y = R.y[bk] + (R.y[bk + 1] - R.y[bk]) * bt
  SXD_RQ.k = bk
  return true
}

// does the road (its bed, flat to T.flat) come within the square of half-size h at (x, z)?
function SXD_roadNearBox(x, z, h) {
  var R = SXD_roadData(), r = h + SXD_ROAD_TUNE.flat
  for (var k = 0; k < R.n; k++) if (Math.abs(R.x[k] - x) < r && Math.abs(R.z[k] - z) < r) return true
  return false
}

// Ground height: the dunes/berms/mesas (SXD_terrainBase) with the highway's bed
// levelled into them.
function SXD_terrainHeight(x, z) {
  var h = SXD_terrainBase(x, z)
  if (!SXD_roadAt(x, z)) return h
  var T = SXD_ROAD_TUNE, ad = Math.abs(SXD_RQ.d), y = SXD_RQ.y
  if (ad <= T.flat) return y
  var dh = h - y, w = Math.min(T.reach - T.flat - 0.5, T.bank + Math.abs(dh) * T.batter)
  var t = (ad - T.flat) / w
  if (t >= 1) return h
  return y + dh * t * t * (3 - 2 * t)
}

// Utility poles along the east verge, like the scan's: every T.pole m, not on
// the runway crossing, the basin berm or near an outpost, inside the walkable grid.
function SXD_roadPoles() {
  var R = SXD_roadData(), T = SXD_ROAD_TUNE, out = [], every = Math.round(T.pole / T.step)
  var cx = (SXD_BOUND.x0 + SXD_BOUND.x1) / 2, cz = (SXD_BOUND.z0 + SXD_BOUND.z1) / 2
  for (var k = 0; k < R.n; k += every) {
    var x = R.x[k] + R.tz[k] * T.poleOff, z = R.z[k] - R.tx[k] * T.poleOff
    var ok = Math.abs(x - cx) < 585 && Math.abs(z - cz) < 585 && SXD_basinSd(x, z) > 30
    for (var p = 0; ok && p < R.pins.length; p++) if (Math.abs(R.pins[p][0] - k) * T.step < 40) ok = false
    if (ok && typeof SXO_SITES !== 'undefined') for (var q = 0; q < SXO_SITES.length; q++) if (Math.hypot(x - SXO_SITES[q].x, z - SXO_SITES[q].z) < SXO_SITES[q].r + 40) ok = false
    out.push(ok ? { x: x, z: z, k: k, yaw: Math.atan2(R.tx[k], R.tz[k]) } : null) // null = a gap in the line
  }
  return out
}

// The road ribbon (one mesh) + the poles/wires (into the backdrop builder).
// farY(x, z) = height of the coarse far terrain mesh, for the stretch past the grid.
// hideU: the far mesh's cut-away circle (SXD_streamer). Past the baked grid a
// vertex has two heights: on the 2 m terrain (aFine, used inside the circle,
// where the streamed tiles are drawn) and lifted over the coarse far mesh
// (position.y, used beyond it).
async function SXD_roadBuild(i, root, bld, farY, hideU) {
  var R = SXD_roadData(), T = SXD_ROAD_TUNE
  var offs = [-T.half, -T.half / 2, 0, T.half / 2, T.half], nO = offs.length
  var g = SXD_HG, lim = 594, wl = SXD_WORLD_R - 4
  var pos = [], fine = [], uv = [], idx = [], rows = 0
  for (var k = 0; k < R.n; k++) {
    var x = R.x[k], z = R.z[k], nx = R.tz[k], nz = -R.tx[k]
    var near = Math.abs(x - g.cx) < wl && Math.abs(z - g.cz) < wl
    if (!near && k % 4 && k !== R.n - 1) continue // 8 m rows out past the drivable world
    for (var o = 0; o < nO; o++) {
      var px = x + nx * offs[o], pz = z + nz * offs[o]
      var inG = Math.abs(px - g.cx) < lim && Math.abs(pz - g.cz) < lim
      var fy = (inG ? SXD_heightAt(px, pz) : SXD_terrainHeight(px, pz)) + 0.03
      pos.push(px, inG ? fy : Math.max(farY(px, pz), fy - 0.03) + 0.35, pz)
      fine.push(fy)
      uv.push((offs[o] + T.half) / (2 * T.half), (k * T.step) / T.tile)
    }
    if (rows) for (var o2 = 0; o2 < nO - 1; o2++) { var a = (rows - 1) * nO + o2, b = a + nO; idx.push(a, b, a + 1, a + 1, b, b + 1) }
    rows++
  }
  var geo = new lt.BufferGeometry()
  geo.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aFine', new lt.Float32BufferAttribute(fine, 1))
  geo.setAttribute('uv', new lt.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  var tex = null
  try {
    var img = await SX_timeout(SX_image(SX_ASSET_road_ludlow, 'image/webp'), 8000, 'road texture')
    tex = new lt.Texture(img)
    tex.colorSpace = lt.SRGBColorSpace
    tex.wrapS = lt.ClampToEdgeWrapping
    tex.wrapT = lt.RepeatWrapping
    tex.anisotropy = i.renderer && i.renderer.capabilities ? Math.min(SXD_SHARP.aniso, i.renderer.capabilities.getMaxAnisotropy()) : 4
    tex.needsUpdate = true
  } catch (e) {
    console.error('[desert] road texture', e)
  }
  var mat = new lt.MeshStandardMaterial({ color: tex ? 0xffffff : 0x5c5852, map: tex, roughness: 0.9, metalness: 0, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })
  mat.name = 'desert_road'
  var tu = { uSdHazeA: { value: new lt.Vector3() }, uSdHazeB: { value: new lt.Vector3() }, uSdSun: { value: Mn.dir.clone() } }
  var hzA = en.horizonAway.clone().multiplyScalar(1.05), hzB = en.horizon.clone().multiplyScalar(0.95)
  tu.uSdHazeA.value.set(hzA.r, hzA.g, hzA.b)
  tu.uSdHazeB.value.set(hzB.r, hzB.g, hzB.b)
  if (hideU) Object.assign(tu, hideU)
  mat.onBeforeCompile = function (sh) {
    Object.assign(sh.uniforms, tu)
    // inside the far mesh's cut-away circle the road lies on the streamed 2 m terrain
    var pick = hideU
      ? '\n  { vec2 wq = abs(transformed.xz - uSdWorldC); if (max(wq.x, wq.y) < uSdHide.w && length(transformed.xz - uSdHide.xy) < uSdHide.z) transformed.y = aFine; }'
      : ''
    sh.vertexShader = 'varying vec3 vSdW;\n' + (hideU ? 'attribute float aFine; uniform vec4 uSdHide; uniform vec2 uSdWorldC;\n' : '') +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + pick + '\n  vSdW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSdW;\nuniform vec3 uSdHazeA, uSdHazeB, uSdSun;\nvec2 sdRoadN;\n' + SXD_SAND_COMMON)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(normal + mat3(viewMatrix) * vec3(sdRoadN.x, 0.0, sdRoadN.y));')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  {
    // ragged verges: the gravel shoulder fades into the sand
    float e = abs(vMapUv.x - 0.5) * 2.0;
    float jag = (sdVN(vSdW.xz * 0.45) - 0.5) * 0.09 + (sdVN(vSdW.xz * 2.3) - 0.5) * 0.04;
    diffuseColor.a *= 1.0 - smoothstep(0.80, 0.97, e + jag);
    // warm the scan's grey gravel toward the basin's sand at the very edge
    diffuseColor.rgb *= mix(vec3(1.03, 1.0, 0.95), vec3(1.1, 0.95, 0.8), smoothstep(0.7, 0.95, e));
    // fine grain up close (the scan is ~6 cm a texel): aggregate speckle + tar patches
    float rd = length(cameraPosition - vSdW);
    float fade = 1.0 - smoothstep(4.0, 22.0, rd);
    float gr = sdVN(vSdW.xz * 19.0) * 0.6 + sdVN(vSdW.xz * 47.0 + 3.1) * 0.4;
    diffuseColor.rgb *= 1.0 + (gr - 0.5) * 0.32 * fade;
    sdRoadN = vec2(sdVN(vSdW.xz * 31.0) - 0.5, sdVN(vSdW.xz * 31.0 + 7.7) - 0.5) * 0.35 * fade;
  }`,
      )
      .replace('#include <fog_fragment>', '#include <fog_fragment>\n' + SXD_TERRAIN_HAZE)
  }
  mat.customProgramCacheKey = function () {
    return 'sxd-road-2'
  }
  var road = new lt.Mesh(geo, mat)
  road.name = 'desert-road'
  road.receiveShadow = true
  road.castShadow = false
  road.renderOrder = -1 // first of the transparent pass (smoke and tracers draw over it)
  road.matrixAutoUpdate = false
  road.updateMatrix()
  root.add(road)

  // poles: weathered wood, a cross-arm with three insulators, three sagging wires
  var wood = i.mats.get('wood_dark'), wire = i.mats.get('steel_rust'), white = i.mats.get('paint_white')
  var V = function (x, y, z) { return new lt.Vector3(x, y, z) }
  var poles = SXD_roadPoles(), prev = null, nPoles = 0
  for (var p = 0; p < poles.length; p++) {
    var P = poles[p]
    if (!P) { prev = null; continue }
    var y0 = SXD_heightAt(P.x, P.z) - 0.4, H = 10.4
    var c = Math.cos(P.yaw), s = Math.sin(P.yaw) // c,s: across the road (x,z)
    var lean = (SXD_h(P.x, 1, P.z) - 0.5) * 0.25
    var top = V(P.x + lean * c, y0 + H, P.z - lean * s)
    bld.add(wood, Ke(V(P.x, y0, P.z), top, 0.15, 6))
    var ay = y0 + H - 0.7
    var aL = V(top.x - 1.3 * c, ay, top.z + 1.3 * s), aR = V(top.x + 1.3 * c, ay, top.z - 1.3 * s)
    bld.add(wood, Ke(aL, aR, 0.07, 4))
    var tips = []
    for (var w = -1; w <= 1; w++) {
      var ip = V(top.x + w * 1.1 * c, ay + 0.07, top.z - w * 1.1 * s)
      bld.add(white, Ke(ip, V(ip.x, ip.y + 0.22, ip.z), 0.045, 5))
      tips.push(V(ip.x, ip.y + 0.22, ip.z))
    }
    if (prev) for (var w2 = 0; w2 < 3; w2++) {
      var pts = ua(prev[w2], tips[w2], 0.9, 10)
      for (var s2 = 0; s2 < pts.length - 1; s2++) bld.add(wire, Ke(pts[s2], pts[s2 + 1], 0.018, 3))
    }
    prev = tips
    i.physics.addBox([P.x - 0.17, y0, P.z - 0.17], [P.x + 0.17, y0 + H, P.z + 0.17], { surface: 'wood' })
    nPoles++
  }
  window.__sxdRoad = { R: R, at: function (x, z) { return SXD_roadAt(x, z) ? Object.assign({}, SXD_RQ) : null }, h: SXD_heightAt, base: SXD_terrainBase, mesh: road, THREE: lt } // tests
  console.log('[desert] highway ' + Math.round(R.n * T.step) + ' m, ' + rows + ' rows, ' + nPoles + ' poles')
  return road
}

// Near terrain: 100 m chunks built straight from the physics grid (so what
// you see is what you stand on), two LODs (2 m / 8 m) with skirts against
// cracks. Inside the basin and outpost bowls it sits just under the sand plane.
function SXD_buildChunks(mat) {
  var g = SXD_HG, n = g.n, step = g.step, CH = 50
  var nc = Math.floor((n - 1) / CH)
  var group = new lt.Group()
  group.name = 'desert-terrain-near'
  var hAt = function (i, j) {
    var h = g.data[j * n + i]
    return h > 0.15 ? h : h - 0.12
  }
  var nrmAt = function (i, j, out) {
    var i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1)
    var dx = (g.data[j * n + i1] - g.data[j * n + i0]) / ((i1 - i0) * step)
    var dz = (g.data[j1 * n + i] - g.data[j0 * n + i]) / ((j1 - j0) * step)
    var l = Math.hypot(dx, 1, dz)
    out[0] = -dx / l; out[1] = 1 / l; out[2] = -dz / l
  }
  var nn = [0, 0, 0]
  function build(ci, cj, stride) {
    var cells = CH / stride, side = cells + 1
    var pos = [], nor = [], idx = []
    var vert = function (gi, gj, drop) {
      pos.push(g.x0 + gi * step, hAt(gi, gj) - (drop || 0), g.z0 + gj * step)
      nrmAt(gi, gj, nn)
      nor.push(nn[0], nn[1], nn[2])
      return pos.length / 3 - 1
    }
    for (var j = 0; j <= cells; j++) for (var i = 0; i <= cells; i++) vert(ci * CH + i * stride, cj * CH + j * stride)
    for (var j2 = 0; j2 < cells; j2++)
      for (var i2 = 0; i2 < cells; i2++) {
        var a = j2 * side + i2, b = a + side, c = a + 1, d = b + 1
        idx.push(a, b, c, c, b, d)
      }
    // skirts down each edge (both windings: they are only ever seen edge-on)
    var edge = function (list) {
      var prevTop = -1, prevLow = -1
      for (var k = 0; k < list.length; k++) {
        var top = list[k][0], gi = list[k][1], gj = list[k][2]
        var low = vert(gi, gj, 4)
        if (prevTop >= 0) idx.push(prevTop, prevLow, top, top, prevLow, low, prevTop, top, prevLow, top, low, prevLow)
        prevTop = top; prevLow = low
      }
    }
    var e0 = [], e1 = [], e2 = [], e3 = []
    for (var q = 0; q <= cells; q++) {
      e0.push([q, ci * CH + q * stride, cj * CH])
      e1.push([cells * side + q, ci * CH + q * stride, cj * CH + CH])
      e2.push([q * side, ci * CH, cj * CH + q * stride])
      e3.push([q * side + cells, ci * CH + CH, cj * CH + q * stride])
    }
    edge(e0); edge(e1); edge(e2); edge(e3)
    var geo = new lt.BufferGeometry()
    geo.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
    geo.setAttribute('normal', new lt.Float32BufferAttribute(nor, 3))
    geo.setIndex(idx)
    geo.computeBoundingSphere()
    var m = new lt.Mesh(geo, mat)
    m.castShadow = true
    m.receiveShadow = true
    m.matrixAutoUpdate = false
    return m
  }
  var chunks = []
  for (var cj = 0; cj < nc; cj++)
    for (var ci = 0; ci < nc; ci++) {
      var hi = build(ci, cj, 1), lo = build(ci, cj, 5) // 10 m: 50 cells / 5 (a stride of 4 left 12.5 cells and a garbled mesh)
      lo.visible = false
      group.add(hi, lo)
      var ccx = g.x0 + (ci + 0.5) * CH * step, ccz = g.z0 + (cj + 0.5) * CH * step
      chunks.push({ hi: hi, lo: lo, x: ccx, z: ccz, near: true, road: SXD_roadNearBox(ccx, ccz, (CH * step) / 2 + 12) })
    }
  return { group: group, chunks: chunks, half: (nc * CH * step) / 2 }
}

// Streamed terrain past the baked grid: every 100 m tile (SXD_tile) within
// SXD_STREAM.r of the camera and inside the world gets a mesh — 2 m cells
// within `hi`, 10 m beyond (and on the far side of `hi` the 2 m one is
// dropped) — a few per frame, nearest first; tiles behind `drop` are freed.
// hide (the far mesh's uSdHide) gets the radius they fully cover.
var SXD_STREAM = { r: 560, hi: 230, drop: 720, hiPerFrame: 1, loPerFrame: 3 }
function SXD_streamer(root, mat, hide) {
  var g = SXD_HG, T = SXD_TILE, step = g.step, size = T * step
  var group = new lt.Group()
  group.name = 'desert-terrain-stream'
  root.add(group)
  var live = new Map()
  // heights with a 1-sample border, for the normals across the tile edge
  function block(ti, tj, stride) {
    var cells = T / stride, n = cells + 3, out = new Float32Array(n * n)
    var x0 = g.x0 + ti * size - stride * step, z0 = g.z0 + tj * size - stride * step
    var t = stride === 1 ? SXD_tile(ti, tj) : null
    for (var j = 0; j < n; j++)
      for (var k = 0; k < n; k++) {
        var inner = t && j >= 1 && k >= 1 && j <= cells + 1 && k <= cells + 1
        out[j * n + k] = inner ? t.d[(j - 1) * (T + 1) + (k - 1)] : SXD_terrainHeight(x0 + k * stride * step, z0 + j * stride * step)
      }
    return { h: out, n: n, cells: cells, x0: x0, z0: z0, d: stride * step }
  }
  function build(ti, tj, stride) {
    var B = block(ti, tj, stride), n = B.n, cells = B.cells, side = cells + 1
    var pos = [], nor = [], idx = []
    var vert = function (k, j, drop) {
      var h = B.h[j * n + k]
      pos.push(B.x0 + k * B.d, (h > 0.15 ? h : h - 0.12) - (drop || 0), B.z0 + j * B.d)
      var dx = (B.h[j * n + k + 1] - B.h[j * n + k - 1]) / (2 * B.d), dz = (B.h[(j + 1) * n + k] - B.h[(j - 1) * n + k]) / (2 * B.d)
      var l = Math.hypot(dx, 1, dz)
      nor.push(-dx / l, 1 / l, -dz / l)
      return pos.length / 3 - 1
    }
    for (var j = 1; j <= cells + 1; j++) for (var k = 1; k <= cells + 1; k++) vert(k, j)
    for (var j2 = 0; j2 < cells; j2++)
      for (var i2 = 0; i2 < cells; i2++) {
        var a = j2 * side + i2, b = a + side, c = a + 1, d = b + 1
        idx.push(a, b, c, c, b, d)
      }
    // skirts down each edge, as SXD_buildChunks
    var edge = function (list) {
      var pt = -1, pl = -1
      for (var q = 0; q < list.length; q++) {
        var top = list[q][0], low = vert(list[q][1], list[q][2], 4)
        if (pt >= 0) idx.push(pt, pl, top, top, pl, low, pt, top, pl, top, low, pl)
        pt = top; pl = low
      }
    }
    var e0 = [], e1 = [], e2 = [], e3 = []
    for (var q = 0; q <= cells; q++) {
      e0.push([q, q + 1, 1]); e1.push([cells * side + q, q + 1, cells + 1])
      e2.push([q * side, 1, q + 1]); e3.push([q * side + cells, cells + 1, q + 1])
    }
    edge(e0); edge(e1); edge(e2); edge(e3)
    var geo = new lt.BufferGeometry()
    geo.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
    geo.setAttribute('normal', new lt.Float32BufferAttribute(nor, 3))
    geo.setIndex(idx)
    geo.computeBoundingSphere()
    var m = new lt.Mesh(geo, mat)
    m.castShadow = true
    m.receiveShadow = true
    m.matrixAutoUpdate = false
    group.add(m)
    return m
  }
  function free(e) {
    ;[e.hi, e.lo].forEach(function (m) { if (m) { group.remove(m); m.geometry.dispose() } })
  }
  var S = SXD_STREAM, want = []
  return {
    group: group,
    live: live,
    update: function (cam) {
      var ci = Math.floor((cam.x - g.x0) / size), cj = Math.floor((cam.z - g.z0) / size)
      var rt = Math.ceil(S.r / size) + 1, wr = SXD_WORLD_R, half = size / 2
      // tiles that should exist: in reach, not baked, overlapping the world square
      want.length = 0
      for (var dj = -rt; dj <= rt; dj++)
        for (var di = -rt; di <= rt; di++) {
          var ti = ci + di, tj = cj + dj
          if (SXD_isBaked(ti, tj)) continue
          var tx = g.x0 + (ti + 0.5) * size, tz = g.z0 + (tj + 0.5) * size
          if (Math.abs(tx - g.cx) > wr + half || Math.abs(tz - g.cz) > wr + half) continue
          var d = Math.hypot(tx - cam.x, tz - cam.z)
          if (d - half * 1.42 > S.r) continue
          want.push({ ti: ti, tj: tj, d: d, k: SXD_tileKey(ti, tj) })
        }
      want.sort(function (a, b) { return a.d - b.d })
      var hiLeft = S.hiPerFrame, loLeft = S.loPerFrame, cover = S.r
      for (var w = 0; w < want.length; w++) {
        var t = want[w], e = live.get(t.k)
        if (!e) { e = { ti: t.ti, tj: t.tj, hi: null, lo: null, d: t.d }; live.set(t.k, e) }
        e.d = t.d
        if (!e.lo && loLeft > 0) { e.lo = build(t.ti, t.tj, 5); loLeft-- }
        var nearT = t.d < S.hi
        if (nearT && !e.hi && hiLeft > 0) { e.hi = build(t.ti, t.tj, 1); hiLeft-- }
        if (!nearT && e.hi && t.d > S.hi + 60) { group.remove(e.hi); e.hi.geometry.dispose(); e.hi = null }
        var showHi = !!e.hi && nearT
        if (e.hi) e.hi.visible = showHi
        if (e.lo) e.lo.visible = !showHi
        if (!e.lo) cover = Math.min(cover, t.d - half * 1.42)
      }
      // tiles left far behind
      live.forEach(function (e, k) {
        var tx = g.x0 + (e.ti + 0.5) * size, tz = g.z0 + (e.tj + 0.5) * size
        if (Math.hypot(tx - cam.x, tz - cam.z) > S.drop) { free(e); live.delete(k) }
      })
      hide.value.set(cam.x, cam.z, Math.max(0, cover - 8), wr)
    },
  }
}

/* ================================================= WALKABLE TERRAIN ===== */
// When SXD_TH is set, the bundle's physics (moveCapsule, groundHeight,
// raycast in game/js/10_game.js) stands on this height field instead of the flat
// y=0 plane, so the berms and dunes can be climbed and stop bullets/grenades.
// SXD_terrainHeight is baked into a 2 m grid (±600 m) once, sampled
// bilinearly; the near terrain mesh (SXD_buildChunks) uses the same samples.
var SXD_TH = null
var SXD_HG = null
var SXD_PLAY_R = 1500 // metres from the basin centre the player may roam: the whole map (was 560, the baked grid)
var SXD_MAX_SLOPE = 1.05 // rise/run (~46°); steeper faces (mesa cliffs) block

function SXD_buildHeightGrid() {
  var B = SXD_BOUND
  var cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2
  var half = 600, step = 2, n = Math.ceil((half * 2) / step) + 1
  var x0 = cx - half, z0 = cz - half
  var data = new Float32Array(n * n), hmax = 0
  var t0 = performance.now()
  for (var j = 0; j < n; j++)
    for (var k = 0; k < n; k++) {
      var h = SXD_terrainHeight(x0 + k * step, z0 + j * step)
      data[j * n + k] = h
      if (h > hmax) hmax = h
    }
  SXD_HG = { x0: x0, z0: z0, step: step, n: n, data: data, hmax: hmax + 0.5, cx: cx, cz: cz }
  SXD_TH = SXD_heightAt
  console.log('[desert] walkable terrain ' + n + '×' + n + ' in ' + Math.round(performance.now() - t0) + 'ms, peak ' + hmax.toFixed(1) + 'm')
}

// Ground height at (x, z): the baked grid (±600 m), then the 100 m tiles of the
// same 2 m lattice out to SXD_WORLD_R (SXD_tile), then a flat floor (only
// reachable by long rays, which stop there).
function SXD_heightAt(x, z) {
  var g = SXD_HG
  var fx = (x - g.x0) / g.step, fz = (z - g.z0) / g.step
  if (fx < 0 || fz < 0 || fx >= g.n - 1 || fz >= g.n - 1) return SXD_heightOut(x, z, fx, fz)
  var i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, n = g.n, d = g.data, k = j * n + i
  var a = d[k] + (d[k + 1] - d[k]) * tx
  var b = d[k + n] + (d[k + n + 1] - d[k + n]) * tx
  return a + (b - a) * tz
}

// ---- the terrain past the baked grid. The whole map is drivable: out to
// SXD_WORLD_R the ground comes in 100 m tiles (51×51 samples, the baked grid's
// own 2 m lattice) computed from SXD_terrainHeight the first time anything
// asks — wheels, feet, bullets, the streamed mesh round the camera
// (SXD_streamer). The baked grid itself is tiles 0..11 on both axes.
var SXD_WORLD_R = 1560 // half-size of the square that has terrain detail (≥ SXD_PLAY_R + margin)
var SXD_TILE = 50 // cells per tile side
var SXD_TILES = new Map()
function SXD_tileKey(ti, tj) { return (ti + 1024) * 2048 + (tj + 1024) }
function SXD_isBaked(ti, tj) { var m = (SXD_HG.n - 1) / SXD_TILE; return ti >= 0 && tj >= 0 && ti < m && tj < m }
function SXD_tile(ti, tj) {
  var key = SXD_tileKey(ti, tj)
  var t = SXD_TILES.get(key)
  if (t) return t
  var g = SXD_HG, n = SXD_TILE + 1, d = new Float32Array(n * n)
  var x0 = g.x0 + ti * SXD_TILE * g.step, z0 = g.z0 + tj * SXD_TILE * g.step
  for (var j = 0; j < n; j++) for (var k = 0; k < n; k++) d[j * n + k] = SXD_terrainHeight(x0 + k * g.step, z0 + j * g.step)
  t = { ti: ti, tj: tj, x0: x0, z0: z0, d: d }
  SXD_TILES.set(key, t)
  return t
}
function SXD_inWorld(x, z) {
  var g = SXD_HG
  return Math.abs(x - g.cx) < SXD_WORLD_R && Math.abs(z - g.cz) < SXD_WORLD_R
}
function SXD_heightOut(x, z, fx, fz) {
  if (!SXD_inWorld(x, z)) return 0
  var ti = Math.floor(fx / SXD_TILE), tj = Math.floor(fz / SXD_TILE)
  var t = SXD_tile(ti, tj), lx = fx - ti * SXD_TILE, lz = fz - tj * SXD_TILE
  var i = Math.min(SXD_TILE - 1, lx | 0), j = Math.min(SXD_TILE - 1, lz | 0), tx = lx - i, tz = lz - j, n = SXD_TILE + 1, d = t.d, k = j * n + i
  var a = d[k] + (d[k + 1] - d[k]) * tx
  var b = d[k + n] + (d[k + n + 1] - d[k + n]) * tx
  return a + (b - a) * tz
}

// rays march the terrain anywhere it has detail (was: the baked grid only)
function SXD_inGrid(x, z) { return SXD_inWorld(x, z) }

function SXD_grad(x, z, out) {
  var e = 0.35
  out[0] = (SXD_heightAt(x + e, z) - SXD_heightAt(x - e, z)) / (2 * e)
  out[1] = (SXD_heightAt(x, z + e) - SXD_heightAt(x, z - e)) / (2 * e)
  return out
}
var SXD_G2 = [0, 0]

// Called by moveCapsule after each horizontal sub-step: undo the step when it
// climbs a face steeper than SXD_MAX_SLOPE or leaves the roaming radius, and
// drop the velocity component pushing into it.
function SXD_slope(p, v, footY, dx, dz) {
  var g = SXD_HG
  var ox = p.x - g.cx, oz = p.z - g.cz, r2 = ox * ox + oz * oz
  var nx = 0, nz = 0, blocked = false
  if (r2 > SXD_PLAY_R * SXD_PLAY_R) {
    var r = Math.sqrt(r2)
    nx = ox / r; nz = oz / r; blocked = true
  } else {
    var h = SXD_heightAt(p.x, p.z)
    if (h <= footY + 0.06) return
    SXD_grad(p.x, p.z, SXD_G2)
    var s = Math.hypot(SXD_G2[0], SXD_G2[1])
    if (s < SXD_MAX_SLOPE && h - footY < 0.75) return
    if (s > 1e-4) { nx = SXD_G2[0] / s; nz = SXD_G2[1] / s }
    blocked = true
  }
  if (!blocked) return
  p.x -= dx
  p.z -= dz
  var vd = v.x * nx + v.z * nz
  if (vd > 0) { v.x -= nx * vd; v.z -= nz * vd }
}

// Distance along a ray to the terrain surface (Infinity when it misses within
// maxT or leaves the grid). Height-field march + bisection.
function SXD_rayT(ox, oy, oz, dx, dy, dz, maxT) {
  if (!SXD_inGrid(ox, oz)) return Infinity
  var hmax = SXD_HG.hmax
  var h = SXD_heightAt(ox, oz)
  if (oy < h - 0.03) return 0
  var t = 0, y = oy, it = 0
  while (t < maxT && it++ < 360) {
    if (y > hmax && dy >= 0) return Infinity
    var step = (y - h) * 0.55
    if (step < 0.3) step = 0.3
    else if (step > 6) step = 6
    if (y > hmax && dy < 0) { var drop = (y - hmax) / -dy; if (drop > step) step = drop }
    var pt = t
    t += step
    if (t > maxT) t = maxT
    var x = ox + dx * t, z = oz + dz * t
    if (!SXD_inGrid(x, z)) return Infinity
    y = oy + dy * t
    h = SXD_heightAt(x, z)
    if (y <= h) {
      var a = pt, b = t
      for (var k = 0; k < 12; k++) {
        var m = (a + b) * 0.5
        if (oy + dy * m <= SXD_heightAt(ox + dx * m, oz + dz * m)) b = m
        else a = m
      }
      return b
    }
  }
  return Infinity
}

function SXD_nrm(x, z) {
  SXD_grad(x, z, SXD_G2)
  return new lt.Vector3(-SXD_G2[0], 1, -SXD_G2[1]).normalize()
}

async function SXD_backdrop(i) {
  var root = new lt.Group()
  root.name = 'backdrop'
  var B = SXD_BOUND
  var cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2

  // ---- terrain: polar grid from the basin edge out to ~2.5 km (the play
  // radius + the camera's 900 m far plane, so the edge never shows) ----
  var NT = 360, NR = 108
  var ring = []
  for (var k = 0; k <= NR; k++) ring.push(6 * (Math.pow(1.0575, k) - 1))
  var pos = new Float32Array((NT + 1) * (NR + 1) * 3)
  var r0s = new Float32Array(NT + 1)
  var p = 0
  for (var a = 0; a <= NT; a++) {
    var th = (a / NT) * Math.PI * 2, dx = Math.cos(th), dz = Math.sin(th)
    // walk out to the basin edge along this ray
    var lo = 0, hi = 200
    for (var it = 0; it < 40; it++) {
      var mid = (lo + hi) / 2
      SXD_basinSd(cx + dx * mid, cz + dz * mid) > 0 ? (hi = mid) : (lo = mid)
    }
    var r0 = hi - 0.4
    r0s[a] = r0
    for (var k2 = 0; k2 <= NR; k2++) {
      var rr = r0 + ring[k2]
      var x = cx + dx * rr, z = cz + dz * rr
      pos[p++] = x
      var inNear = SXD_HG && Math.abs(x - SXD_HG.cx) < 596 && Math.abs(z - SXD_HG.cz) < 596
      pos[p++] = k2 === 0 ? -0.02 : SXD_terrainHeight(x, z) - (inNear ? 40 : 0)
      pos[p++] = z
    }
  }
  var idx = []
  for (var a2 = 0; a2 < NT; a2++)
    for (var k3 = 0; k3 < NR; k3++) {
      var i0 = a2 * (NR + 1) + k3, i1 = i0 + 1, i2 = i0 + NR + 1, i3 = i2 + 1
      idx.push(i0, i2, i1, i1, i2, i3)
    }
  var geo = new lt.BufferGeometry()
  geo.setAttribute('position', new lt.BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  var hazeA = en.horizonAway.clone().multiplyScalar(1.05), hazeB = en.horizon.clone().multiplyScalar(0.95)
  var tu = {
    uSdHazeA: { value: new lt.Vector3(hazeA.r, hazeA.g, hazeA.b) },
    uSdHazeB: { value: new lt.Vector3(hazeB.r, hazeB.g, hazeB.b) },
    uSdSun: { value: Mn.dir.clone() },
  }
  var mat = new lt.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
  mat.name = 'desert_terrain'
  mat.onBeforeCompile = function (sh) {
    Object.assign(sh.uniforms, tu)
    sh.vertexShader = 'varying vec3 vSdW; varying vec3 vSdN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSdW = (modelMatrix * vec4(transformed, 1.0)).xyz; vSdN = normalize(mat3(modelMatrix) * objectNormal);')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SXD_TERRAIN_HEAD)
      .replace('#include <map_fragment>', SXD_TERRAIN_BODY)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = sdRoughT;')
      // sand ripples (xz nudge), then the rock relief bump on the cliffs (world normal → view)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(normal + mat3(viewMatrix) * vec3(-sdNxzT.x, 0.0, -sdNxzT.y));\n  normal = normalize(mix(normal, normalize(mat3(viewMatrix) * sdRockN), sdRockW));')
      .replace('#include <fog_fragment>', '#include <fog_fragment>\n' + SXD_TERRAIN_HAZE)
  }
  mat.customProgramCacheKey = function () {
    return 'sxd-terrain-2'
  }
  // the coarse far mesh: the same look, but cut away (discard) inside the
  // circle the streamed 2 m tiles fully cover round the camera (SXD_streamer
  // keeps uSdHide = centre x/z, radius, world half-size up to date), so the
  // driveable detail is what shows there. It casts no shadow: the shadow box
  // round the camera always sits on the near / streamed terrain, and a far
  // facet poking above them would shade them.
  var farMat = mat.clone()
  farMat.name = 'desert_terrain_far'
  var hideU = { uSdHide: { value: new lt.Vector4(0, 0, 0, SXD_WORLD_R) }, uSdWorldC: { value: new lt.Vector2(SXD_HG ? SXD_HG.cx : cx, SXD_HG ? SXD_HG.cz : cz) } }
  farMat.onBeforeCompile = function (sh) {
    mat.onBeforeCompile(sh)
    Object.assign(sh.uniforms, hideU)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uSdHide; uniform vec2 uSdWorldC;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  { vec2 wq = abs(vSdW.xz - uSdWorldC); if (max(wq.x, wq.y) < uSdHide.w && length(vSdW.xz - uSdHide.xy) < uSdHide.z) discard; }')
  }
  farMat.customProgramCacheKey = function () {
    return 'sxd-terrain-far-1'
  }
  var terrain = new lt.Mesh(geo, farMat)
  terrain.name = 'desert-terrain'
  terrain.castShadow = false
  terrain.receiveShadow = true
  terrain.matrixAutoUpdate = false
  terrain.updateMatrix()
  root.add(terrain)
  var near = SXD_HG ? SXD_buildChunks(mat) : null
  if (near) root.add(near.group)
  var stream = SXD_HG ? SXD_streamer(root, mat, hideU.uSdHide) : null
  window.__sxdWorld = { ramps: SXD_mesaRamps(), h: SXD_heightAt, tiles: SXD_TILES, stream: stream, hide: hideU.uSdHide.value, playR: SXD_PLAY_R, worldR: SXD_WORLD_R } // tests
  // the sun's shadow box was fitted to the basin; out on the dunes it follows
  // the camera (same size, so the PCSS constants stay valid)
  var sun = i.render && i.render.sun
  var sunBase = sun ? sun.target.position.clone() : null
  var sunOff = sun ? sun.position.clone().sub(sun.target.position) : null
  var sunAt = sunBase ? sunBase.clone() : null

  // ---- man-made silhouettes: power line, derrick, tank farm ----
  var lamps = pb()
  var bld = new io()
  var galv = i.mats.get('steel_galv'), rust = i.mats.get('steel_rust'), white = i.mats.get('paint_white')
  var V = function (x, y, z) {
    return new lt.Vector3(x, y, z)
  }
  var groundAt = function (x, z) {
    return SXD_terrainHeight(x, z)
  }
  // lattice pylon: 4 tapered legs, cross arms, X bracing
  var pylon = function (x, z, H, yaw) {
    var y0 = groundAt(x, z) - 0.3
    var c = Math.cos(yaw), s = Math.sin(yaw)
    var P = function (lx, ly, lz) {
      return V(x + lx * c - lz * s, y0 + ly, z + lx * s + lz * c)
    }
    var w0 = 3.2, w1 = 0.9
    var legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    var at = function (l, y) {
      var w = w0 + (w1 - w0) * Math.min(1, y / (H * 0.8))
      return P(l[0] * w * 0.5, y, l[1] * w * 0.5)
    }
    for (var k = 0; k < 4; k++) bld.add(galv, Ke(at(legs[k], 0), at(legs[k], H), 0.09, 4))
    for (var y = 0; y < H * 0.8; y += 3.4) {
      for (var k2 = 0; k2 < 4; k2++) {
        var la = legs[k2], lb = legs[(k2 + 1) % 4]
        bld.add(galv, Ke(at(la, y), at(lb, y + 3.4), 0.03, 3))
        bld.add(galv, Ke(at(lb, y), at(la, y + 3.4), 0.03, 3))
      }
    }
    for (var ay of [H * 0.72, H * 0.88]) {
      bld.add(galv, Ke(P(-6.5, ay, 0), P(6.5, ay, 0), 0.08, 4))
      bld.add(galv, Ke(P(-6.5, ay, 0), at([-1, 0], ay - 2.2), 0.05, 3))
      bld.add(galv, Ke(P(6.5, ay, 0), at([1, 0], ay - 2.2), 0.05, 3))
    }
    return [P(-6.2, H * 0.72 - 1.2, 0), P(6.2, H * 0.72 - 1.2, 0), P(-6.2, H * 0.88 - 1.2, 0), P(6.2, H * 0.88 - 1.2, 0)]
  }
  var prev = null
  for (var px = -300; px <= 320; px += 62) {
    var pz = -78 + Math.sin(px * 0.01) * 6
    var tips = pylon(px, pz, 24, Math.PI / 2 + 0.05)
    if (prev)
      for (var w = 0; w < 4; w++) {
        var pts = ua(prev[w], tips[w], 2.6, 12)
        for (var s2 = 0; s2 < pts.length - 1; s2++) bld.add(rust, Ke(pts[s2], pts[s2 + 1], 0.035, 3))
      }
    prev = tips
  }
  // derrick (oil drilling tower) beyond the east berm
  var der = function (x, z, H) {
    var y0 = groundAt(x, z) - 0.5
    var w0 = 4.2, w1 = 1.1
    var legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    var at = function (l, y) {
      var w = w0 + (w1 - w0) * (y / H)
      return V(x + l[0] * w * 0.5, y0 + y, z + l[1] * w * 0.5)
    }
    for (var k = 0; k < 4; k++) bld.add(rust, Ke(at(legs[k], 0), at(legs[k], H), 0.12, 5))
    for (var y = 0; y < H; y += 2.6) {
      for (var k2 = 0; k2 < 4; k2++) {
        var la = legs[k2], lb = legs[(k2 + 1) % 4]
        bld.add(rust, Ke(at(la, y), at(lb, y), 0.05, 3))
        y + 2.6 <= H && bld.add(rust, Ke(at(la, y), at(lb, y + 2.6), 0.035, 3))
      }
    }
    bld.add(rust, Ee(x - 3.4, y0 + 5, z - 3.4, x + 3.4, y0 + 5.5, z + 3.4))
    bld.add(rust, Ee(x - 1.2, y0 + H, z - 1.2, x + 1.2, y0 + H + 1.4, z + 1.2))
    lamps.add(Bn(x, y0 + H + 1.9, z, 0.3), [26, 1.4, 0.7], 2.2, 0.35, 0.35)
  }
  der(70, 46, 36)
  der(-120, -112, 30)
  // tank farm to the south-west
  for (var tk of [[-170, 105, 11, 12], [-146, 118, 9, 10], [-188, 132, 13, 11], [-160, 140, 8, 9]]) {
    var ty = groundAt(tk[0], tk[1]) - 0.4
    bld.add(white, xt(tk[2], tk[2], tk[3], 'y', tk[0], ty + tk[3] / 2, tk[1], 36))
    bld.add(rust, xt(tk[2] + 0.2, tk[2] + 0.2, 0.5, 'y', tk[0], ty + tk[3], tk[1], 36))
    bld.add(white, xt(tk[2] * 0.15, tk[2] + 0.2, 1.6, 'y', tk[0], ty + tk[3] + 1.05, tk[1], 36))
  }
  // a few far rock stacks (hoodoos) on the dunes
  var rockMat = i.mats.get('sxd_sandstone', { triplanar: true, scale: 0.25 })
  var rr2 = SXD_rng(909)
  for (var h = 0; h < 14; h++) {
    var ang = rr2() * Math.PI * 2, dist = 90 + rr2() * 260
    var hx = cx + Math.cos(ang) * dist, hz = cz + Math.sin(ang) * dist
    if (Math.abs(Math.sin(ang)) < 0.12 && Math.cos(ang) < 0) continue
    var sz = 2.5 + rr2() * 4.5
    var g = SXD_rockGeo(500 + h, sz * 0.7, sz * (2.2 + rr2() * 2.2), sz * (0.6 + rr2() * 0.3))
    if (SXD_roadAt(hx, hz) && Math.abs(SXD_RQ.d) < 24) continue // not on the highway
    g.translate(hx, groundAt(hx, hz) - sz * 0.6, hz)
    bld.add(rockMat, g)
  }
  // ---- the highway (ribbon + poles); past the grid it lies on the coarse far mesh ----
  var lnR = Math.log(1.0575)
  var farY = function (x, z) {
    var th = Math.atan2(z - cz, x - cx)
    if (th < 0) th += Math.PI * 2
    var fa = (th / (Math.PI * 2)) * NT, a0 = Math.min(NT - 1, Math.floor(fa)), ta = fa - a0, rr = Math.hypot(x - cx, z - cz)
    var yAt = function (a) {
      var q = (rr - r0s[a]) / 6 + 1, fk = q <= 1 ? 0 : Math.min(NR - 1e-4, Math.log(q) / lnR), k = Math.floor(fk), tk = fk - k, o = (a * (NR + 1) + k) * 3 + 1
      return pos[o] * (1 - tk) + pos[o + 3] * tk
    }
    return yAt(a0) * (1 - ta) + yAt(a0 + 1) * ta
  }
  var road = null
  if (SXD_HG) {
    try {
      road = await SXD_roadBuild(i, root, bld, farY, hideU)
    } catch (e) {
      console.error('[desert] highway failed', e)
    }
  }
  var built = bld.build({ cast: true, recv: true })
  built.name = 'backdrop-structures'
  root.add(built)
  var lampMesh = lamps.build()
  if (lampMesh) {
    lampMesh.frustumCulled = false
    root.add(lampMesh)
  }
  i.scene.add(root)
  var tt = 0
  return {
    root: root,
    terrain: terrain,
    update: function (dt) {
      tt += dt
      lamps.uTime.value = tt
      var cam = i.camera && i.camera.position
      if (!cam) return
      if (stream) stream.update(cam)
      if (near) {
        for (var c = 0; c < near.chunks.length; c++) {
          // chunks the highway crosses keep the 2 m mesh (the 10 m one would bury the road bed)
          var ch = near.chunks[c], d = Math.hypot(ch.x - cam.x, ch.z - cam.z), want = d < 200 || (ch.road && d < 700)
          if (want !== ch.near) { ch.near = want; ch.hi.visible = want; ch.lo.visible = !want }
        }
      }
      if (sun && SXD_HG) {
        var far = Math.hypot(cam.x - sunBase.x, cam.z - sunBase.z) > 42
        var tx = far ? Math.round(cam.x / 6) * 6 : sunBase.x, tz = far ? Math.round(cam.z / 6) * 6 : sunBase.z
        if (tx !== sunAt.x || tz !== sunAt.z) {
          sunAt.set(tx, sunBase.y + (far ? SXD_heightAt(tx, tz) : 0), tz)
          sun.target.position.copy(sunAt)
          sun.position.copy(sunAt).add(sunOff)
          sun.updateMatrixWorld(true)
          sun.target.updateMatrixWorld(true)
          if (i.renderer && i.renderer.shadowMap) i.renderer.shadowMap.needsUpdate = true
        }
      }
    },
    stats: { terrainTris: idx.length / 3, nearChunks: near ? near.chunks.length : 0, roadChunks: near ? near.chunks.filter(function (c) { return c.road }).length : 0 },
  }
}

/* ============================================================ MENUS ===== */

// Called by the menu builder (pM) with its root: desert copy + the map toggle.
function SXD_afterGame(menu) {
  try {
    menu = menu && menu.querySelector ? menu : document.querySelector('#ui .menu')
    if (!menu) return
    if (SXD_ON) {
      var eb = menu.querySelector('.m-title .m-eyebrow')
      eb && (eb.innerHTML = '<span class="m-tag">K7</span><span>Desert Breach Unit</span><span class="m-dim">Kessler Station · 16:40</span>')
      var pr = menu.querySelector('.m-title .m-premise')
      pr && (pr.textContent = 'A dead pumping station in the Dust Basin is running its own war. Cut its three uplinks. Reach the evac truck.')
      var lc = menu.querySelector('.loc-card')
      if (lc) {
        var b = lc.querySelector('b'), s = lc.querySelector('span')
        b && (b.textContent = 'Kessler Station · Dust Basin · 16:40')
        s && (s.textContent = 'Desert Breach Unit — one breacher, no backup')
      }
      var db = menu.querySelector('.m-debrief')
      if (db) {
        var k = db.querySelector('.m-k'), h = db.querySelector('.m-h')
        k && (k.textContent = 'Kessler · Debrief')
        h && (h.textContent = 'Kessler is dark')
      }
    }
    if (SX_MAP === 'crossroads') {
      var eb2 = menu.querySelector('.m-title .m-eyebrow')
      eb2 && (eb2.innerHTML = '<span class="m-tag">X4</span><span>Urban Breach Unit</span><span class="m-dim">Crossroads · 17:20</span>')
      var pr2 = menu.querySelector('.m-title .m-premise')
      pr2 && (pr2.textContent = 'A walled city block where four streets meet. The machines hold it. Cut the three relays and reach the evac van — or fight it out, Blue against Red.')
      var lc2 = menu.querySelector('.loc-card')
      if (lc2) {
        var b2 = lc2.querySelector('b'), s2 = lc2.querySelector('span')
        b2 && (b2.textContent = 'Crossroads · city block · 17:20')
        s2 && (s2.textContent = 'Urban Breach Unit — streets, a market alley, a plaza')
      }
      var db2 = menu.querySelector('.m-debrief')
      if (db2) {
        var k2 = db2.querySelector('.m-k'), h2 = db2.querySelector('.m-h')
        k2 && (k2.textContent = 'Crossroads · Debrief')
        h2 && (h2.textContent = 'The block is dark')
      }
    }
    if (SX_MAP === 'waterworks') {
      var eb3 = menu.querySelector('.m-title .m-eyebrow')
      eb3 && (eb3.innerHTML = '<span class="m-tag">W2</span><span>Plant Security Unit</span><span class="m-dim">Waterworks · 11:40</span>')
      var pr3 = menu.querySelector('.m-title .m-premise')
      pr3 && (pr3.textContent = 'A walled water-treatment yard: a pipe gallery, a flooded settling basin, a pump hall. The machines hold it. Cut the three relays and reach the evac van — or fight it out, Blue against Red.')
      var lc3 = menu.querySelector('.loc-card')
      if (lc3) {
        var b3 = lc3.querySelector('b'), s3 = lc3.querySelector('span')
        b3 && (b3.textContent = 'Waterworks · treatment yard · 11:40')
        s3 && (s3.textContent = 'Plant Security Unit — gallery, basin, pump hall')
      }
      var db3 = menu.querySelector('.m-debrief')
      if (db3) {
        var k3 = db3.querySelector('.m-k'), h3 = db3.querySelector('.m-h')
        k3 && (k3.textContent = 'Waterworks · Debrief')
        h3 && (h3.textContent = 'The plant is dark')
      }
    }
    var actions = menu.querySelector('.m-title .m-actions')
    if (!actions || actions.querySelector('.sxd-map')) return
    // map picker: the button opens a list of the maps (name, blurb, room size);
    // picking one reloads into it
    var MAPS = [
      { id: 'port', name: 'DoomZone Port', blurb: 'Container port at dusk — the original mission' },
      { id: 'desert', name: 'Dust Basin', blurb: 'Huge desert: vehicles, jets, outposts, bosses' },
      { id: 'crossroads', name: 'Crossroads', blurb: 'Small city block for close duels' },
      { id: 'waterworks', name: 'Waterworks', blurb: 'Treatment yard: sniper gallery, flooded basin, pump hall' },
    ]
    var cur = MAPS.filter(function (m) { return m.id === SX_MAP })[0] || MAPS[0]
    var wrap = document.createElement('span')
    wrap.className = 'sxd-mapwrap'
    var btn = document.createElement('button')
    btn.className = 'btn sxd-map'
    btn.type = 'button'
    btn.setAttribute('aria-haspopup', 'listbox')
    btn.setAttribute('aria-expanded', 'false')
    btn.innerHTML = '<span class="sxd-map-k">Map</span><span class="sxd-map-v">' + cur.name + '</span><span class="sxd-map-caret" aria-hidden="true">▾</span>'
    btn.title = 'Choose the map'
    var list = document.createElement('div')
    list.className = 'sxd-maplist'
    list.setAttribute('role', 'listbox')
    list.hidden = true
    list.innerHTML = MAPS.map(function (m) {
      var on = m.id === cur.id
      return '<button type="button" role="option" aria-selected="' + on + '" data-map="' + m.id + '"' + (on ? ' class="on"' : '') + '>' +
        '<b>' + m.name + '</b><span>' + m.blurb + '</span><i>Up to ' + (SX_MAP_MAX[m.id] || 16) + ' players' + (on ? ' · current' : '') + '</i></button>'
    }).join('')
    var setOpen = function (on) {
      list.hidden = !on
      btn.setAttribute('aria-expanded', String(on))
      wrap.classList.toggle('open', on)
      if (on) { var f = list.querySelector('.on') || list.querySelector('button'); f && f.focus() }
    }
    btn.addEventListener('click', function (ev) {
      ev.preventDefault()
      ev.stopPropagation()
      setOpen(list.hidden)
    })
    list.addEventListener('click', function (ev) {
      var o = ev.target.closest && ev.target.closest('button[data-map]')
      if (!o) return
      ev.preventDefault()
      ev.stopPropagation()
      var next = o.dataset.map
      if (next === SX_MAP) { setOpen(false); return }
      // in a multiplayer room the host switches the whole room (net/net.js)
      if (typeof SXN_roomMap === 'function' && SXN_roomMap(next)) { setOpen(false); return }
      try {
        localStorage.setItem('doomzone.map', next)
      } catch (e) {}
      try {
        var u = new URL(location.href)
        u.searchParams.set('map', next)
        location.href = u.toString()
      } catch (e) {
        location.reload()
      }
    })
    // keyboard: arrows move, Esc closes; keys never reach the title screen
    list.addEventListener('keydown', function (ev) {
      ev.stopPropagation()
      var opts = Array.prototype.slice.call(list.querySelectorAll('button')), i = opts.indexOf(document.activeElement)
      if (ev.code === 'Escape') { ev.preventDefault(); setOpen(false); btn.focus() }
      else if (ev.code === 'ArrowDown') { ev.preventDefault(); opts[(i + 1) % opts.length].focus() }
      else if (ev.code === 'ArrowUp') { ev.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus() }
    })
    document.addEventListener('mousedown', function (ev) { if (!list.hidden && !wrap.contains(ev.target)) setOpen(false) }, true)
    wrap.appendChild(btn)
    wrap.appendChild(list)
    actions.appendChild(wrap)
  } catch (e) {
    console.error('[desert] menu hook failed', e)
  }
}
