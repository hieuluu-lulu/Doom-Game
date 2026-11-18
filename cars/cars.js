// ============================================================================
// DoomZone mod — CARS (desert ground vehicles)
//   sandcat  light dune buggy / technical, rear pintle MG
//   rhino    armoured 6x6 (TMV 6x6 model, cars/assets/tmv.glb) with a roof twin gun + heavy shell
// Both are SXU vehicles (see units/units.js UNIT CONTRACT): the framework does
// boarding (E), damage redirect and the vehicle HUD; this file owns the model,
// a raycast-wheel rigid-body car physics core, weapons and wrecks.
//
// Local frame of a car: x right, y up, forward = -z (same as the camera, so a
// yaw of θ faces (-sin θ, 0, -cos θ), matching SXU.look.yaw). The body origin
// sits at wheel-mount height.
// ============================================================================

// hill assist: the share of the slope's pull the drive adds going uphill
var SXC_HILL = 0.8

// Driving view: first person from the driver's seat (the default) or the
// chase camera; the crouch key (C) switches while driving, and the choice is
// kept (doomzone.drivecam). The driver at the wheel: driver/driver.js.
var SXC_VIEW = { fpv: true, fov: 80, look: 2.2 }
try { if (localStorage.getItem('doomzone.drivecam') === 'chase') SXC_VIEW.fpv = false } catch (e) { }
function SXC_toggleView() {
  SXC_VIEW.fpv = !SXC_VIEW.fpv
  try { localStorage.setItem('doomzone.drivecam', SXC_VIEW.fpv ? 'fpv' : 'chase') } catch (e) { }
}
function SXC_wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)) }
function SXC_viewKey() { try { return typeof SXKB_label === 'function' ? SXKB_label('crouch') : 'C' } catch (e) { return 'C' } }

var SXC_SPECS = {
  sandcat: {
    type: 'sandcat', label: 'Sandcat',
    hp: 600, armor: 1, radius: 2.7, enterRadius: 3.5,
    mass: 900, gravity: 14, inertia: [950, 1150, 420],
    // wheel mounts [x, z, steers]
    wheels: [[-0.98, -1.28, true], [0.98, -1.28, true], [-0.98, 1.22, false], [0.98, 1.22, false]],
    mountY: -0.05, rest: 0.5, wheelR: 0.46, wheelW: 0.36, spring: 21000, damper: 1700,
    accel: 11, topSpeed: 28, boostMul: 1.35, boostAccel: 2.0, reverseTop: 9, brake: 20, steerMax: 0.6, steerMin: 0.15, steerRate: 3.4,
    grip: 1.45, gripHandbrake: 0.42, latStiff: 0.32, tireLift: 0.95, downforce: 1.1, antiRoll: 26000,
    // collision spheres [x, y, z, r] (body frame)
    hull: [[-0.6, 0.0, -1.55, 0.45], [0.6, 0.0, -1.55, 0.45], [-0.6, 0.0, 1.45, 0.45], [0.6, 0.0, 1.45, 0.45], [0, 0.2, 0, 0.62], [-0.55, 1.05, 0.15, 0.35], [0.55, 1.05, 0.15, 0.35]],
    box: { min: [-1.0, -0.35, -2.0], max: [1.0, 1.32, 1.8] },
    camDist: 6.6, camHeight: 1.5, fov: 72,
    runOver: { radius: 2.0, damage: 10, selfDamage: 6 },
    // the Buggy model's single centre seat and its steering wheel (STIR), body
    // frame (driver/driver.js)
    cockpit: { hip: [0, 0.08, 0.36], wheel: [0, 0.4, -0.2], tilt: 0.78, r: 0.17, feet: [0.13, -0.3, -0.62], eye: [0, 0.9, 0.4], pitch: -0.16, ratio: 2.6 },
    // boost rockets on the tail [x, y, z, r] (cars/lib/30_boost.js)
    boost: { nozzles: [[-0.4, 0.42, 2.2, 0.11], [0.4, 0.42, 2.2, 0.11]] },
  },
  rhino: {
    type: 'rhino', label: 'Rhino',
    hp: 1600, armor: 0.6, radius: 4.2, enterRadius: 3.8,
    mass: 3400, gravity: 14, inertia: [5200, 6400, 2600],
    wheels: [[-1.22, -1.95, true], [1.22, -1.95, true], [-1.22, 0.3, false], [1.22, 0.3, false], [-1.22, 2.05, false], [1.22, 2.05, false]],
    mountY: -0.1, rest: 0.6, wheelR: 0.58, wheelW: 0.44, spring: 62000, damper: 6400,
    accel: 6.2, topSpeed: 16, boostMul: 1.25, boostAccel: 1.8, reverseTop: 6, brake: 14, steerMax: 0.5, steerMin: 0.17, steerRate: 2.4,
    grip: 1.25, gripHandbrake: 0.5, latStiff: 0.3, tireLift: 0.95, downforce: 1.4, antiRoll: 70000,
    hull: [[-1.0, 0.1, -2.6, 0.65], [1.0, 0.1, -2.6, 0.65], [-1.0, 0.1, 2.6, 0.65], [1.0, 0.1, 2.6, 0.65], [0, 0.3, 0, 1.0], [-0.85, 1.25, -1.6, 0.55], [0.85, 1.25, -1.6, 0.55], [-0.85, 1.25, 2.2, 0.55], [0.85, 1.25, 2.2, 0.55]],
    box: { min: [-1.32, -0.4, -3.1], max: [1.32, 1.65, 3.05] },
    camDist: 9.2, camHeight: 2.3, fov: 70,
    runOver: { radius: 2.8, damage: 14, selfDamage: 3 },
    // the TMV's open cab, left seat (cushion y 0.45 at z -1.3..-0.85, dash top
    // 0.96 at z -1.75..-1.45, footwell 0.2); the model has no steering wheel:
    // driver/driver.js adds one
    cockpit: { hip: [-0.5, 0.56, -0.92], wheel: [-0.5, 1.0, -1.36], tilt: 0.62, r: 0.2, feet: [0.14, 0.24, -1.68], eye: [-0.5, 1.34, -0.86], pitch: -0.08, ratio: 2.4 },
    boost: { nozzles: [[-0.62, 0.5, 3.12, 0.15], [0.62, 0.5, 3.12, 0.15]] },
  },
}

// ---------------------------------------------------------------- materials
// Engine loops for the sound table (Go): 2 s, seamless (whole cycles), played
// pitched by revs. Buggy: 4-cylinder petrol at 60 Hz firing. Rhino: diesel
// at 30 Hz with injector clatter.
function SXC_engineGen(f0, diesel) {
  return function (sr, rng) {
    var n = Math.round(sr * 2), s = new Float32Array(n), ph = []
    for (var h = 0; h < 16; h++) ph.push(rng() * vt)
    for (var i = 0; i < n; i++) {
      var t = i / sr, v = 0
      for (var k = 1; k <= 16; k++) v += Math.sin(vt * f0 * k * t + ph[k - 1]) / Math.pow(k, diesel ? 0.55 : 0.85)
      v += (diesel ? 0.8 : 0.35) * Math.sin(vt * f0 * 0.5 * t + 0.4)
      var fire = Math.max(0, Math.sin(vt * f0 * t))
      s[i] = v * 0.16 * (0.5 + 0.5 * fire)
    }
    var hiss = Zc(sr, 2, rng, function (b) { tn(b, 'bp', diesel ? 2600 : 1300, 0.8, sr) }, 0.25)
    var rumble = Zc(sr, 2, rng, function (b) { tn(b, 'lp', diesel ? 160 : 260, 0.7, sr) }, 0.25)
    for (var j = 0; j < n; j++) {
      var f2 = Math.max(0, Math.sin(vt * f0 * j / sr))
      s[j] += hiss[j] * (diesel ? 0.7 : 0.35) * (0.35 + 0.65 * f2 * f2) + rumble[j] * (diesel ? 0.45 : 0.22)
      s[j] = Math.tanh(s[j] * 1.7)
    }
    return s
  }
}
try { window.__sxEngineGen = SXC_engineGen } catch (e) { }
try { window.__sxc = { BG: function () { return SXC_BG }, TMV: function () { return SXC_TMV }, SPECS: SXC_SPECS } } catch (e) { } // tests
if (typeof Go !== 'undefined' && Go) {
  Go.sx_engine_buggy = { gen: SXC_engineGen(60, false), n: 1, sr: Xn, peak: 0.55, loop: 1, ref: 7, roll: 0.9 }
  Go.sx_engine_diesel = { gen: SXC_engineGen(30, true), n: 1, sr: Xn, peak: 0.6, loop: 1, ref: 9, roll: 0.8 }
}

var SXC_MAT = null
function SXC_mats(G) {
  if (SXC_MAT) return SXC_MAT
  var get = function (name, opts, fallback) {
    try { return G.mats.get(name, opts) } catch (e) { return fallback }
  }
  var std = function (c, r, m) { return new lt.MeshStandardMaterial({ color: c, roughness: r, metalness: m }) }
  var emis = function (c, k) { try { return G.mats.emissive(c, k) } catch (e) { return new lt.MeshBasicMaterial({ color: c }) } }
  SXC_MAT = {
    orange: get('armor_orange', null, std(0xc0602a, 0.6, 0.2)),
    sand: get('paint_white', { vertexColors: true }, std(0xa8916a, 0.7, 0.2)),
    steel: get('steel_dark', null, std(0x2c2e30, 0.5, 0.8)),
    worn: get('steel_worn', null, std(0x55575a, 0.5, 0.8)),
    gun: get('gunmetal', null, std(0x2a2c2f, 0.4, 0.85)),
    rubber: get('rubber', null, std(0x151515, 0.9, 0)),
    tire: get('tire', null, std(0x141414, 0.95, 0)),
    glass: get('glass', null, std(0x223038, 0.1, 0.6)),
    seat: get('tarp', null, std(0x3a3a2c, 0.9, 0)),
    lamp: emis(0xffe4b8, 7),
    lampRed: emis(0xff2a18, 4),
    bar: emis(0xfff2d8, 9),
    burnt: std(0x161412, 0.95, 0.15),
  }
  return SXC_MAT
}

// tint helper for the vertex-coloured sand paint
function SXC_tint(geo, c) { return Lc(geo, c) }
var SXC_SAND = [0.74, 0.63, 0.45]
var SXC_SAND_DK = [0.6, 0.51, 0.36]

// A balloon tyre + rim around the local X axle, centred at the origin.
function SXC_wheelGroup(G, M, R, W, opts) {
  opts = opts || {}
  var bld = new io()
  var pts = []
  var rimR = R * 0.56, half = W / 2
  // tyre profile (r, y) around the Y axis, then turned onto X
  var prof = [[rimR, -half * 0.86], [R * 0.86, -half], [R * 0.97, -half * 0.8], [R, -half * 0.45], [R, half * 0.45], [R * 0.97, half * 0.8], [R * 0.86, half], [rimR, half * 0.86]]
  for (var k = 0; k < prof.length; k++) pts.push(new lt.Vector2(prof[k][0], prof[k][1]))
  var tyre = new lt.LatheGeometry(pts, 28).rotateZ(Math.PI / 2)
  bld.add(M.tire, tyre)
  // chunky tread blocks
  var lugs = []
  for (var j = 0; j < 18; j++) {
    var a = (j / 18) * Math.PI * 2
    var lug = Wi(W * 0.42, R * 0.07, R * 0.16, 0.01).translate((j % 2 ? 1 : -1) * W * 0.22, R + R * 0.02, 0)
    lug.rotateX(a)
    lugs.push(lug)
  }
  bld.add(M.tire, Ii(lugs))
  // rim, hub, nuts
  bld.add(opts.rim || M.worn, xt(rimR * 0.98, rimR * 0.98, W * 0.8, 'x', 0, 0, 0, 20))
  bld.add(M.steel, xt(rimR * 0.4, rimR * 0.5, W * 0.9, 'x', 0, 0, 0, 12))
  var g = bld.build({ cast: true, recv: true })
  return g
}

// ------------------------------------------------------------------ models
// Each builder returns { body: Group, wheel: Group (template), turret: { yaw,
// pitch, muzzles: [Vector3 in pitch space], pivot: Vector3 (body space) },
// lights: [] }
function SXC_buildSandcat(G, M) {
  var bld = new io()
  var add = function (mat, geo) { bld.add(mat, geo) }
  var tube = function (a, b, r) { var g = Ke(a, b, r || 0.034, 8); if (g) add(M.steel, g) }
  // tub / floor pan and belly skid
  add(M.steel, Ee(-0.62, -0.28, -1.55, 0.62, 0.02, 1.5, 0.04))
  add(M.worn, Ee(-0.5, -0.34, -1.2, 0.5, -0.26, 1.0, 0.02))
  // nose with a sloped bonnet, side pods, rear engine deck
  add(M.orange, Ee(-0.62, -0.18, -1.98, 0.62, 0.16, -1.15, 0.07))
  add(M.orange, Wi(1.24, 0.07, 0.95, 0.03).rotateX(0.26).translate(0, 0.27, -1.42))
  add(M.orange, Ee(-0.74, -0.22, -0.95, -0.56, 0.3, 0.86, 0.05))
  add(M.orange, Ee(0.56, -0.22, -0.95, 0.74, 0.3, 0.86, 0.05))
  add(M.orange, Ee(-0.62, -0.2, 0.84, 0.62, 0.36, 1.72, 0.06))
  add(M.steel, Ee(-0.5, -0.1, 1.72, 0.5, 0.3, 1.78, 0.01)) // radiator grille
  for (var gk = 0; gk < 6; gk++) add(M.worn, Ee(-0.46, -0.06 + gk * 0.06, 1.775, 0.46, -0.04 + gk * 0.06, 1.79))
  // mud flaps behind the front wheels
  add(M.rubber, Wi(0.3, 0.32, 0.03, 0.01).translate(-0.98, 0.0, -0.78))
  add(M.rubber, Wi(0.3, 0.32, 0.03, 0.01).translate(0.98, 0.0, -0.78))
  // bumper and nudge bar
  add(M.steel, Ee(-0.8, -0.2, -2.1, 0.8, -0.04, -1.98, 0.02))
  tube([-0.55, -0.12, -2.1], [-0.55, 0.32, -2.04], 0.04); tube([0.55, -0.12, -2.1], [0.55, 0.32, -2.04], 0.04); tube([-0.55, 0.32, -2.04], [0.55, 0.32, -2.04], 0.04)
  // seats + steering wheel
  for (var sx of [-0.3, 0.3]) {
    add(M.seat, Wi(0.46, 0.12, 0.46, 0.04).translate(sx, 0.08, 0.05))
    add(M.seat, Wi(0.46, 0.62, 0.11, 0.04).rotateX(-0.16).translate(sx, 0.42, 0.33))
  }
  add(M.rubber, new lt.TorusGeometry(0.17, 0.024, 6, 18).rotateX(-1.12).translate(-0.3, 0.46, -0.42))
  tube([-0.3, 0.46, -0.42], [-0.3, 0.12, -0.9], 0.025)
  add(M.steel, Ee(-0.55, 0.0, -0.95, 0.55, 0.32, -0.78, 0.03)) // dash
  // roll cage
  var Lx = 0.66
  for (var s of [-1, 1]) {
    tube([s * 0.7, 0.05, 0.48], [s * 0.64, 1.22, 0.42])
    tube([s * 0.7, 0.16, -0.78], [s * 0.6, 1.14, -0.32])
    tube([s * 0.6, 1.14, -0.32], [s * 0.64, 1.22, 0.42])
    tube([s * 0.64, 1.22, 0.42], [s * 0.6, 0.36, 1.62])
    tube([s * 0.7, 0.16, -0.78], [s * 0.62, 0.16, -1.9], 0.03)
  }
  tube([-0.64, 1.22, 0.42], [0.64, 1.22, 0.42]); tube([-0.6, 1.14, -0.32], [0.6, 1.14, -0.32])
  tube([-0.64, 1.22, 0.42], [0.6, 1.14, -0.32], 0.026); tube([-0.68, 0.62, 0.45], [0.68, 0.62, 0.45], 0.03)
  // light bar on the cage roof
  add(M.steel, Ee(-0.56, 1.17, -0.43, 0.56, 1.29, -0.31, 0.02))
  for (var lb = 0; lb < 4; lb++) add(M.bar, Ee(-0.5 + lb * 0.26, 1.19, -0.44, -0.3 + lb * 0.26, 1.27, -0.43))
  // headlights + tail lights
  for (var hx of [-0.42, 0.42]) {
    add(M.steel, xt(0.1, 0.1, 0.07, 'z', hx, 0.07, -1.99, 14))
    add(M.lamp, xt(0.075, 0.075, 0.02, 'z', hx, 0.07, -2.03, 14))
    add(M.lampRed, Ee(hx - 0.07, 0.15, 1.78, hx + 0.07, 0.24, 1.8))
  }
  // exhausts
  tube([0.3, 0.2, 1.6], [0.36, 0.42, 1.95], 0.045); tube([-0.3, 0.2, 1.6], [-0.36, 0.42, 1.95], 0.045)
  // spare wheel lying on the engine deck
  var spare = SXC_wheelGroup(G, M, 0.4, 0.3)
  spare.rotation.z = Math.PI / 2
  spare.position.set(0, 0.52, 1.3)
  // gun post
  tube([0, 0.36, 0.76], [0, 1.12, 0.76], 0.05)
  add(M.steel, xt(0.11, 0.13, 0.08, 'y', 0, 1.14, 0.76, 14))
  var body = bld.build({ cast: true, recv: true })
  body.add(spare)

  // pintle MG: yaw on the post, pitch at the cradle
  var tb = new io()
  tb.add(M.steel, xt(0.07, 0.07, 0.12, 'y', 0, 0.04, 0, 12))
  var yaw = tb.build({ cast: true, recv: true })
  yaw.position.set(0, 1.18, 0.76)
  var pb = new io()
  pb.add(M.gun, Wi(0.12, 0.15, 0.56, 0.02).translate(0, 0, -0.05))
  pb.add(M.gun, xt(0.026, 0.026, 0.62, 'z', 0, 0.02, -0.62, 10))
  pb.add(M.steel, xt(0.04, 0.04, 0.12, 'z', 0, 0.02, -0.9, 10))
  pb.add(M.worn, Wi(0.12, 0.13, 0.17, 0.01).translate(0.13, -0.03, -0.05)) // ammo can
  pb.add(M.steel, Wi(0.5, 0.32, 0.025, 0.01).translate(0, 0.06, -0.36)) // shield
  pb.add(M.steel, Wi(0.06, 0.12, 0.05, 0.01).translate(-0.07, -0.02, 0.26)); pb.add(M.steel, Wi(0.06, 0.12, 0.05, 0.01).translate(0.07, -0.02, 0.26))
  var pitch = pb.build({ cast: true, recv: true })
  pitch.position.set(0, 0.12, 0)
  yaw.add(pitch)
  var wheel = SXC_wheelGroup(G, M, 0.46, 0.36)
  return { body: body, wheel: wheel, turret: { yaw: yaw, pitch: pitch, muzzles: [new lt.Vector3(0, 0.02, -0.97)], rate: 3.2, pitchMin: -0.35, pitchMax: 0.75 } }
}

// ---------------------------------------------- SANDCAT: the Buggy_2 model
// From buggy_2.glb — assets/buggy.glb (9.6 MB → 1.8 MB, 1024 px WebP, quantised; the
// orange paint hue-shifted to the Sandcat's red). GLB frame: cm, front +Z.
// Scaled so its tyres have the Sandcat's 0.46 m radius; the one tyre mesh (BAN)
// and the brake hubs (REM) are split per wheel: tyres spin + steer, hubs steer.
// The physics spec takes the model's wheel positions and size when it loads.
var SXC_BG = { ready: false, failed: false, started: false, scene: null, geo: null }
var SXC_BG_TYRE = /(^|[_\s])BAN($|[_\s])/, SXC_BG_HUB = /(^|[_\s])REM($|[_\s])/
var SXC_BGT = { s: 0.00664, wheelY: 36.09, midZ: -130.88, at: [-0.24, -0.03], gun: [0, 1.12, 1.18] }
function SXC_bgStart() {
  if (SXC_BG.started) return
  SXC_BG.started = true
  // a split build downloads it after boot (common/common.js SX_assetLater); the Sandcat swaps when it lands
  SX_assetLater('buggy', typeof SX_ASSET_buggy === 'string' && SX_ASSET_buggy).then(function (b64) {
    if (typeof b64 !== 'string' || typeof SX_parseGLB !== 'function') { SXC_BG.failed = true; return }
    SX_parseGLB(b64).then(function (g) {
      try { SXC_BG.scene = g.scene; SXC_BG.geo = SXC_bgGeometry(g.scene); SXC_bgSpec(SXC_BG.geo); SXC_BG.ready = true }
      catch (e) { SXC_BG.failed = true; console.warn('[sx-cars] Buggy model unusable, procedural Sandcat', e) }
    }, function (e) { SXC_BG.failed = true; console.warn('[sx-cars] Buggy model failed, procedural Sandcat', e) })
  })
}
// the model in the Sandcat body frame (front -Z, wheel centres at y = at[0])
function SXC_bgHold(scene) {
  var T = SXC_BGT, hold = new lt.Group()
  hold.rotation.y = Math.PI
  hold.scale.setScalar(T.s)
  hold.position.set(0, T.at[0] - T.wheelY * T.s, T.at[1] + T.midZ * T.s)
  hold.add(scene)
  return hold
}
// a geometry with plain float attributes, in `frame` space (the GLB is quantised)
function SXC_floatGeo(mesh, frame) {
  var src = mesh.geometry, g = new lt.BufferGeometry()
  for (var name in src.attributes) {
    var a = src.attributes[name], n = a.count, arr = new Float32Array(n * a.itemSize)
    for (var i = 0; i < n; i++) for (var c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c)
    g.setAttribute(name, new lt.BufferAttribute(arr, a.itemSize))
  }
  if (src.index) g.setIndex(src.index.clone())
  frame.updateMatrixWorld(true)
  g.applyMatrix4(new lt.Matrix4().copy(frame.matrixWorld).invert().multiply(mesh.matrixWorld))
  return g.index ? g.toNonIndexed() : g
}
// split a mesh's triangles into the four wheel corners: (-x front, +x front, -x rear, +x rear)
function SXC_splitQuad(g, midZ) {
  var pos = g.attributes.position, buckets = [[], [], [], []]
  for (var t = 0; t < pos.count; t += 3) {
    var cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3
    buckets[(cz < midZ ? 0 : 2) + (cx < 0 ? 0 : 1)].push(t)
  }
  return buckets.map(function (tris) {
    var out = new lt.BufferGeometry()
    for (var name in g.attributes) {
      var a = g.attributes[name], arr = new Float32Array(tris.length * 3 * a.itemSize), o = 0
      tris.forEach(function (t) { for (var v = 0; v < 3; v++) for (var c = 0; c < a.itemSize; c++) arr[o++] = a.getComponent(t + v, c) })
      out.setAttribute(name, new lt.BufferAttribute(arr, a.itemSize))
    }
    out.computeBoundingBox()
    var ctr = out.boundingBox.getCenter(new lt.Vector3()), size = out.boundingBox.getSize(new lt.Vector3())
    out.translate(-ctr.x, -ctr.y, -ctr.z)
    out.computeBoundingSphere()
    return { geo: out, center: ctr, size: size }
  })
}
function SXC_bgGeometry(scene) {
  var frame = new lt.Group(), hold = SXC_bgHold(scene.clone(true))
  frame.add(hold)
  // GLTFLoader turns the spaces in node names into underscores ("1 BAN" → "1_BAN")
  var find = function (re) { var f = null; hold.traverse(function (o) { if (!f && o.isMesh && o.parent && re.test(o.parent.name)) f = o }); return f }
  var ban = find(SXC_BG_TYRE), rem = find(SXC_BG_HUB)
  if (!ban) throw new Error('tyre mesh missing')
  var tyres = SXC_splitQuad(SXC_floatGeo(ban, frame), SXC_BGT.at[1])
  var hubs = rem ? SXC_splitQuad(SXC_floatGeo(rem, frame), SXC_BGT.at[1]) : null
  var box = new lt.Box3().setFromObject(frame)
  // the steering wheel (STIR) and the seats (KURSI), in the body frame: the
  // driver sits on the -x seat (driver/driver.js)
  var stir = find(/(^|[_\s])STIR($|[_\s])/), kursi = find(/(^|[_\s])KURSI($|[_\s])/)
  var bbOf = function (m) { if (!m) return null; var g = SXC_floatGeo(m, frame); g.computeBoundingBox(); return g.boundingBox }
  return { tyres: tyres, hubs: hubs, tyreMat: ban.material, hubMat: rem && rem.material, box: box, stir: bbOf(stir), kursi: bbOf(kursi), stirMesh: stir && stir.parent.name }
}
// the physics follows the model: wheel mounts, tyre radius, hull and box
function SXC_bgSpec(geo) {
  var S = SXC_SPECS.sandcat, t = geo.tyres, b = geo.box
  S.wheels = t.map(function (w, k) { return [+w.center.x.toFixed(3), +w.center.z.toFixed(3), k < 2] })
  S.wheelR = +(t[0].size.y / 2).toFixed(3)
  S.wheelW = +t[0].size.x.toFixed(3)
  var zf = b.min.z, zr = b.max.z
  S.box = { min: [+b.min.x.toFixed(2), -0.35, +zf.toFixed(2)], max: [+b.max.x.toFixed(2), +Math.min(1.3, b.max.y).toFixed(2), +zr.toFixed(2)] }
  S.hull = [[-0.6, 0.0, zf + 0.5, 0.45], [0.6, 0.0, zf + 0.5, 0.45], [-0.6, 0.0, zr - 0.55, 0.45], [0.6, 0.0, zr - 0.55, 0.45], [0, 0.2, 0, 0.62], [-0.55, 0.72, 0.4, 0.35], [0.55, 0.72, 0.4, 0.35]]
}
function SXC_buildSandcatGLB(G, M) {
  var T = SXC_BGT, geo = SXC_BG.geo
  var body = new lt.Group()
  var hold = SXC_bgHold(SXC_BG.scene.clone(true))
  body.add(hold)
  var steer = typeof SXDR_wheel === 'function' ? SXDR_wheel(M, SXC_SPECS.sandcat.cockpit) : null
  hold.traverse(function (o) {
    if (!o.isMesh) return
    if (o.parent && (SXC_BG_TYRE.test(o.parent.name) || SXC_BG_HUB.test(o.parent.name))) { o.visible = false; return }
    // the modelled steering wheel can't turn: a separate one does (driver/driver.js)
    if (steer && o.parent && /(^|[_\s])STIR($|[_\s])/.test(o.parent.name)) { o.visible = false; return }
    o.castShadow = true; o.receiveShadow = true
  })
  if (steer) body.add(steer)
  var mk = function (part, mat) { var g = new lt.Group(), m = new lt.Mesh(part.geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return g }
  var wheels = geo.tyres.map(function (p) { return mk(p, geo.tyreMat) })
  // hubs ride the wheel holder (steer + suspension) at their offset from the tyre centre
  var hubs = geo.hubs ? geo.hubs.map(function (p, k) { var h = mk(p, geo.hubMat); h.position.copy(p.center).sub(geo.tyres[k].center); return h }) : null
  // the Sandcat's pintle MG on a post behind the seats
  var old = SXC_buildSandcat(G, M), tur = old.turret
  tur.yaw.position.set(T.gun[0], T.gun[1], T.gun[2])
  var post = Ke([T.gun[0], 0.55, T.gun[2]], [T.gun[0], T.gun[1] - 0.04, T.gun[2]], 0.05, 8)
  if (post) { var pm = new lt.Mesh(post, M.steel); pm.castShadow = true; body.add(pm) }
  return { glb: true, body: body, wheels: wheels, hubs: hubs, turret: tur, steer: steer }
}

function SXC_buildRhino(G, M) {
  var bld = new io()
  var sand = function (geo, dark) { bld.add(M.sand, SXC_tint(geo, dark ? SXC_SAND_DK : SXC_SAND)) }
  var steel = function (geo) { bld.add(M.steel, geo) }
  var tube = function (a, b, r) { var g = Ke(a, b, r || 0.05, 8); if (g) bld.add(M.steel, g) }
  // lower hull + V belly
  sand(Ee(-1.12, -0.32, -2.55, 1.12, 0.48, 2.9, 0.08))
  steel(Wi(1.6, 0.3, 4.8, 0.06).translate(0, -0.38, 0.15))
  // engine bay / cab front: stepped nose
  sand(Ee(-1.08, 0.46, -2.9, 1.08, 1.0, -1.85, 0.08))
  sand(Wi(2.12, 0.08, 1.1, 0.03).rotateX(0.22).translate(0, 1.04, -2.36), true)
  sand(Ee(-1.18, 0.46, -1.9, 1.18, 1.62, -0.6, 0.08))
  // slanted windscreen + side windows (armoured glass)
  for (var wx of [-0.52, 0.52]) bld.add(M.glass, Wi(0.86, 0.5, 0.05, 0.02).rotateX(-0.5).translate(wx, 1.3, -1.98))
  for (var sw of [-1, 1]) bld.add(M.glass, Wi(0.05, 0.36, 0.7, 0.02).translate(sw * 1.185, 1.25, -1.25))
  steel(Ee(-1.1, 1.0, -2.08, 1.1, 1.06, -1.92, 0.01)) // screen frame
  // troop compartment with side armour panels
  sand(Ee(-1.22, 0.46, -0.62, 1.22, 1.58, 2.95, 0.08))
  for (var sd of [-1, 1]) {
    for (var p = 0; p < 3; p++) sand(Wi(0.06, 0.82, 1.1, 0.02).translate(sd * 1.255, 1.0, -0.15 + p * 1.15), true)
    // fenders / skirts
    sand(Wi(0.32, 0.08, 1.15, 0.03).translate(sd * 1.22, 0.42, -1.95), true)
    sand(Wi(0.32, 0.08, 2.9, 0.03).translate(sd * 1.22, 0.42, 1.18), true)
    // grab rails, jerrycans
    tube([sd * 1.29, 1.42, -0.3], [sd * 1.29, 1.42, 2.6], 0.025)
    bld.add(M.worn, Wi(0.16, 0.45, 0.32, 0.03).translate(sd * 1.33, 0.95, 2.62))
  }
  // roof hatch + rear door with spare wheel
  steel(xt(0.62, 0.66, 0.14, 'y', 0, 1.63, 0.6, 24)) // turret ring
  sand(Ee(-0.9, 1.56, 1.5, 0.9, 1.66, 2.8, 0.04), true)
  steel(Ee(-0.6, 0.55, 2.95, 0.6, 1.45, 3.0, 0.02))
  var spare = SXC_wheelGroup(G, M, 0.5, 0.36)
  spare.rotation.y = Math.PI / 2
  spare.position.set(0.0, 1.0, 3.2)
  // front: V-bumper, bull bar, tow hooks, lights
  steel(Ee(-1.15, -0.28, -3.05, 1.15, 0.36, -2.82, 0.03))
  tube([-0.9, 0.36, -3.1], [-0.9, 0.95, -2.98], 0.055); tube([0.9, 0.36, -3.1], [0.9, 0.95, -2.98], 0.055); tube([-0.9, 0.95, -2.98], [0.9, 0.95, -2.98], 0.055)
  tube([-0.9, 0.62, -3.06], [0.9, 0.62, -3.06], 0.045)
  for (var hx of [-0.78, 0.78]) {
    steel(Ee(hx - 0.17, 0.7, -2.94, hx + 0.17, 0.86, -2.88))
    bld.add(M.lamp, Ee(hx - 0.14, 0.72, -2.95, hx + 0.14, 0.84, -2.94))
    bld.add(M.lampRed, Ee(hx - 0.1, 1.2, 2.95, hx + 0.1, 1.32, 2.97))
  }
  // antennae + smoke dischargers on the cab roof
  tube([-0.9, 1.62, -0.9], [-0.98, 3.4, -0.85], 0.012)
  for (var sk = 0; sk < 3; sk++) {
    steel(xt(0.06, 0.06, 0.24, 'z', -0.85 + sk * 0.14, 1.72, -1.72, 8).rotateX(0))
    steel(xt(0.06, 0.06, 0.24, 'z', 0.57 + sk * 0.14, 1.72, -1.72, 8))
  }
  var body = bld.build({ cast: true, recv: true })
  body.add(spare)

  // roof turret: yaw housing + pitching twin autocannon
  var ty = new io()
  ty.add(M.sand, SXC_tint(Wi(1.15, 0.46, 1.4, 0.08).translate(0, 0.26, 0.05), SXC_SAND))
  ty.add(M.sand, SXC_tint(Wi(1.18, 0.1, 1.0, 0.04).rotateX(-0.3).translate(0, 0.42, -0.62), SXC_SAND_DK))
  ty.add(M.steel, Wi(0.2, 0.16, 0.24, 0.03).translate(0.42, 0.56, 0.3)) // sight
  ty.add(M.glass, Wi(0.16, 0.08, 0.02, 0.01).translate(0.42, 0.58, 0.17))
  var yaw = ty.build({ cast: true, recv: true })
  yaw.position.set(0, 1.68, 0.6)
  var tp = new io()
  tp.add(M.steel, Wi(0.52, 0.26, 0.5, 0.04).translate(0, 0, -0.1)) // mantlet
  for (var bx of [-0.13, 0.13]) {
    tp.add(M.gun, xt(0.055, 0.055, 1.5, 'z', bx, 0, -1.05, 12))
    tp.add(M.steel, xt(0.085, 0.085, 0.2, 'z', bx, 0, -1.78, 12))
  }
  var pitch = tp.build({ cast: true, recv: true })
  pitch.position.set(0, 0.3, -0.42)
  yaw.add(pitch)
  var wheel = SXC_wheelGroup(G, M, 0.58, 0.44)
  return { body: body, wheel: wheel, turret: { yaw: yaw, pitch: pitch, muzzles: [new lt.Vector3(-0.13, 0, -1.9), new lt.Vector3(0.13, 0, -1.9)], rate: 1.7, pitchMin: -0.2, pitchMax: 0.6 } }
}

// ------------------------------------------------ Rhino: the TMV 6x6 model
// cars/assets/tmv.glb (tmv_6x6.glb optimised: 1024 px WebP, simplified,
// quantised). Its body is one merged mesh, so the six tyres and the roof gun
// are cut out of it by region, in the model frame (y up, front +z, metres):
// the tyres spin / steer / ride the suspension, the shield + twin MG traverse
// and the guns elevate as the Rhino's turret. Scaled ×1.29: the wheelbase,
// tyre size and hull then match the old Rhino (track 2.1 m instead of 2.4 m).
var SXC_TMV = { ready: false, failed: false, started: false, parts: null }
var SXC_TMVT = {
  s: 1.29, at: [-0.57, 0.05], yc: 0.335, zMid: -2.27, // model wheel-centre height / axle midpoint → body (y, z)
  axles: [[0.335, -0.70, 0.485], [0.332, -2.292, 0.48], [0.332, -3.839, 0.48]], // front → rear: model y, z, cut radius
  tyreX: 0.58, gunY: 2.12, gunX: 0.13, shieldY: 2.06, mountY: 2.03,
  ring: -2.50, pivot: [2.16, -2.20], tips: [[-0.05, 2.206, -1.424], [0.05, 2.206, -1.424]],
}
function SXC_tmvStart() {
  if (SXC_TMV.started) return
  SXC_TMV.started = true
  SX_assetLater('tmv', typeof SX_ASSET_tmv === 'string' && SX_ASSET_tmv).then(function (b64) {
    if (typeof b64 !== 'string' || typeof SX_parseGLB !== 'function') { SXC_TMV.failed = true; return }
    SX_parseGLB(b64).then(function (g) {
      try { SXC_TMV.parts = SXC_tmvParts(g.scene); SXC_tmvSpec(SXC_TMV.parts); SXC_TMV.ready = true }
      catch (e) { SXC_TMV.failed = true; console.warn('[sx-cars] TMV model unusable, procedural Rhino', e) }
    }, function (e) { SXC_TMV.failed = true; console.warn('[sx-cars] TMV model failed, procedural Rhino', e) })
  })
}
// model frame → Rhino body frame (front -Z, wheel centres at y = at[0])
function SXC_tmvMatrix() {
  var T = SXC_TMVT
  return new lt.Matrix4().compose(new lt.Vector3(0, T.at[0] - T.yc * T.s, T.at[1] + T.zMid * T.s),
    new lt.Quaternion().setFromAxisAngle(new lt.Vector3(0, 1, 0), Math.PI), new lt.Vector3(T.s, T.s, T.s))
}
function SXC_tmvPoint(x, y, z) { return new lt.Vector3(x, y, z).applyMatrix4(SXC_tmvMatrix()) }
// the triangles `tris` (first-vertex indices) of a non-indexed geometry
function SXC_triGeo(g, tris) {
  var out = new lt.BufferGeometry()
  for (var name in g.attributes) {
    var a = g.attributes[name], arr = new Float32Array(tris.length * 3 * a.itemSize), o = 0
    for (var i = 0; i < tris.length; i++) for (var v = 0; v < 3; v++) for (var c = 0; c < a.itemSize; c++) arr[o++] = a.getComponent(tris[i] + v, c)
    out.setAttribute(name, new lt.BufferAttribute(arr, a.itemSize))
  }
  return out
}
function SXC_tmvParts(scene) {
  var T = SXC_TMVT, frame = new lt.Group(), sc = scene.clone(true), mat = null
  frame.add(sc)
  var keys = ['body', 'yaw', 'gun', 'w0', 'w1', 'w2', 'w3', 'w4', 'w5'], bins = {}
  keys.forEach(function (k) { bins[k] = { geos: [], tris: [] } })
  var meshes = []
  sc.traverse(function (o) { if (o.isMesh) meshes.push(o) })
  meshes.forEach(function (o) {
    mat = mat || o.material
    var g = SXC_floatGeo(o, frame), P = g.attributes.position
    var local = {}
    keys.forEach(function (k) { local[k] = [] })
    for (var t = 0; t < P.count; t += 3) {
      var x = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, y = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, z = (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3
      var key = 'body'
      if (y > T.gunY && Math.abs(x) < T.gunX) key = 'gun'
      else if (y > T.shieldY || (y > T.mountY && Math.abs(x) < T.gunX)) key = 'yaw'
      else if (Math.abs(x) > T.tyreX) {
        for (var k = 0; k < 3; k++) {
          var a = T.axles[k]
          // spec order per axle: body left (-x) then right; the model's +x is the body's -x
          if (Math.hypot(y - a[0], z - a[1]) < a[2]) { key = 'w' + (k * 2 + (x > 0 ? 0 : 1)); break }
        }
      }
      local[key].push(t)
    }
    keys.forEach(function (k) { if (local[k].length) bins[k].geos.push(SXC_triGeo(g, local[k])) })
  })
  var M4 = SXC_tmvMatrix()
  var merge = function (k) {
    var list = bins[k].geos
    if (!list.length) throw new Error('TMV part missing: ' + k)
    var g = list.length > 1 ? SXC_mergeGeos(list) : list[0]
    g.applyMatrix4(M4)
    return g
  }
  var parts = { mat: mat, body: merge('body'), wheels: [] }
  for (var w = 0; w < 6; w++) {
    var wg = merge('w' + w)
    wg.computeBoundingBox()
    var ctr = wg.boundingBox.getCenter(new lt.Vector3()), size = wg.boundingBox.getSize(new lt.Vector3())
    wg.translate(-ctr.x, -ctr.y, -ctr.z)
    wg.computeBoundingSphere()
    parts.wheels.push({ geo: wg, center: ctr, size: size })
  }
  // turret: traverses about the shield ring, elevates at the gun trunnion
  parts.yawAt = SXC_tmvPoint(0, T.shieldY, T.ring)
  parts.pivotAt = SXC_tmvPoint(0, T.pivot[0], T.pivot[1])
  parts.yaw = merge('yaw').translate(-parts.yawAt.x, -parts.yawAt.y, -parts.yawAt.z)
  parts.gun = merge('gun').translate(-parts.pivotAt.x, -parts.pivotAt.y, -parts.pivotAt.z)
  parts.tips = T.tips.map(function (p) { return SXC_tmvPoint(p[0], p[1], p[2]).sub(parts.pivotAt) })
  parts.body.computeBoundingBox()
  parts.box = parts.body.boundingBox.clone()
  return parts
}
function SXC_mergeGeos(list) {
  var names = Object.keys(list[0].attributes).filter(function (n) { return list.every(function (g) { return g.attributes[n] }) })
  var out = new lt.BufferGeometry()
  names.forEach(function (n) {
    var size = list[0].attributes[n].itemSize, total = 0
    list.forEach(function (g) { total += g.attributes[n].count })
    var arr = new Float32Array(total * size), o = 0
    list.forEach(function (g) { arr.set(g.attributes[n].array.subarray(0, g.attributes[n].count * size), o); o += g.attributes[n].count * size })
    out.setAttribute(n, new lt.BufferAttribute(arr, size))
  })
  return out
}
// the physics follows the model's tyres (mounts, radius, width); hull and box already match
function SXC_tmvSpec(parts) {
  var S = SXC_SPECS.rhino, w = parts.wheels
  S.wheels = w.map(function (p, k) { return [+p.center.x.toFixed(3), +p.center.z.toFixed(3), k < 2] })
  S.wheelR = +((w[2].size.y + w[3].size.y) / 4).toFixed(3)
  S.wheelW = +w[2].size.x.toFixed(3)
}
function SXC_buildRhinoGLB(G, M) {
  var P = SXC_TMV.parts
  var mk = function (geo) { var m = new lt.Mesh(geo, P.mat); m.castShadow = true; m.receiveShadow = true; return m }
  var body = new lt.Group()
  body.add(mk(P.body))
  var wheels = P.wheels.map(function (w) { var g = new lt.Group(); g.add(mk(w.geo)); return g })
  var yaw = new lt.Group()
  yaw.position.copy(P.yawAt)
  yaw.add(mk(P.yaw))
  var pitch = new lt.Group()
  pitch.position.copy(P.pivotAt).sub(P.yawAt)
  pitch.add(mk(P.gun))
  yaw.add(pitch)
  var tips = P.tips.map(function (t) { return t.clone() })
  // the cab has no steering wheel of its own (driver/driver.js)
  var steer = typeof SXDR_wheel === 'function' ? SXDR_wheel(M, SXC_SPECS.rhino.cockpit) : null
  if (steer) body.add(steer)
  return { glb: true, body: body, wheels: wheels, steer: steer, turret: { yaw: yaw, pitch: pitch, muzzles: tips, rate: 1.7, pitchMin: -0.2, pitchMax: 0.6, z0: pitch.position.z } }
}

// --------------------------------------------------------- the car itself
function SXC_vehicle(G, U, spec, opts, build) {
  var V3 = lt.Vector3, Q = lt.Quaternion
  var M = SXC_mats(G)
  var UP = new V3(0, 1, 0)
  var model = build(G, M)
  var root = new lt.Group()
  root.name = 'sx-' + spec.type
  var bodyG = new lt.Group()
  bodyG.add(model.body)
  root.add(bodyG)
  var tur = model.turret
  bodyG.add(tur.yaw)
  var wheels = spec.wheels.map(function (w, wi) {
    var g = model.wheels ? model.wheels[wi] : model.wheel.clone()
    var holder = new lt.Group()
    holder.add(g)
    if (model.hubs && model.hubs[wi]) holder.add(model.hubs[wi])
    if (!model.wheels && w[0] > 0) g.rotation.y = Math.PI // hub faces out on both sides
    bodyG.add(holder)
    return { x: w[0], z: w[1], steers: !!w[2], comp: 0, prev: 0, touch: false, spin: 0, holder: holder, tyre: g, point: new V3(), normal: new V3(0, 1, 0), mount: new V3(), load: 0, slip: 0 }
  })
  G.scene.add(root)

  // ---- state
  var restOffset = spec.rest * 0.62 + spec.wheelR // body origin above ground at rest
  var pos = opts.pos ? opts.pos.clone() : new V3()
  pos.y += restOffset - spec.mountY + 0.1
  var q = new Q().setFromAxisAngle(UP, opts.yaw || 0)
  var vel = new V3(), ang = new V3()
  var st = { steer: 0, sleep: 0, beachT: 0, hullTouch: false, asleep: false, flipT: 0, heat: 0, overheat: false, fireT: 0, shellT: 0, adsPrev: false, grounded: 0, speed: 0, fwdSpeed: 0, idleLookT: 0, lastLookYaw: 0, dustT: 0, engine: null, landV: 0, hitT: 0, bangT: 0, runT: new Map(), wreckT: 0, smokeT: 0 }
  var shells = []
  var driver = null // the player at the wheel (driver/driver.js)
  // the boost rockets on the tail (cars/lib/30_boost.js); st.boostK 0..1 is the burn
  var rockets = typeof SXC_boostRig === 'function' ? SXC_boostRig(G, spec) : null
  if (rockets) bodyG.add(rockets.root)
  var fpvE = new lt.Euler(0, 0, 0, 'YXZ'), fpvQ = new Q()
  var fireFx = null

  // scratch
  var t1 = new V3(), t2 = new V3(), t3 = new V3(), t4 = new V3(), t5 = new V3(), t6 = new V3()
  var fwd = new V3(), right = new V3(), up = new V3()
  var qInv = new Q(), qd = new Q()

  function frame() {
    fwd.set(0, 0, -1).applyQuaternion(q)
    right.set(1, 0, 0).applyQuaternion(q)
    up.set(0, 1, 0).applyQuaternion(q)
  }
  function headingYaw() { frame(); return Math.atan2(-fwd.x, -fwd.z) }
  function toWorld(local, out) { return out.copy(local).applyQuaternion(q).add(pos) }

  // Ground ray that ignores bullet-only boxes (fences, berm stops).
  function castDown(o, d, max) {
    var start = t6.copy(o), acc = 0, rem = max
    for (var k = 0; k < 3; k++) {
      var h = G.physics.raycast(start, d, rem)
      if (!h) return null
      if (!(h.box && h.box.bulletOnly)) { h.dist += acc; return h }
      var stp = h.dist + 0.02
      acc += stp; rem -= stp
      if (rem <= 0) return null
      start.addScaledVector(d, stp)
    }
    return null
  }

  // nearby boxes for the hull collision (refreshed once per frame)
  var near = []
  function gatherBoxes(dt) {
    near.length = 0
    var boxes = G.physics.boxes || []
    var r = spec.radius + 1 + vel.length() * dt
    for (var k = 0; k < boxes.length; k++) {
      var b = boxes[k]
      if (b.bulletOnly) continue
      if (pos.x + r < b.min.x || pos.x - r > b.max.x || pos.z + r < b.min.z || pos.z - r > b.max.z || pos.y + r < b.min.y || pos.y - r > b.max.y) continue
      near.push(b)
    }
  }

  function applyAt(force, point, F, T) {
    F.add(force)
    t5.subVectors(point, pos)
    T.add(t4.crossVectors(t5, force))
  }

  var Fsum = new V3(), Tsum = new V3()
  // One physics sub-step. ctl = { throttle -1..1, steer -1..1, handbrake, boost }
  function step(h, ctl) {
    frame()
    var m = spec.mass
    Fsum.set(0, -m * spec.gravity, 0)
    Tsum.set(0, 0, 0)
    var speed = vel.length()
    var vF = vel.dot(fwd)
    st.speed = speed
    st.fwdSpeed = vF
    // steering lock shrinks with speed
    var lock = spec.steerMax + (spec.steerMin - spec.steerMax) * Math.min(1, Math.abs(vF) / spec.topSpeed)
    var target = ctl.steer * lock
    st.steer += Math.max(-spec.steerRate * h, Math.min(spec.steerRate * h, target - st.steer))
    var n = wheels.length, nTouch = 0
    var top = spec.topSpeed * (ctl.boost ? spec.boostMul : 1)
    var reversing = vF < 0.6 && ctl.throttle < 0
    for (var k = 0; k < n; k++) {
      var w = wheels[k]
      var mount = toWorld(t1.set(w.x, spec.mountY, w.z), t1)
      var down = t2.copy(up).negate()
      var hit = castDown(mount, down, spec.rest + spec.wheelR)
      w.prev = w.comp
      w.mount.copy(mount)
      if (!hit) { w.touch = false; w.comp = Math.max(0, w.comp - h * 6); w.load = 0; continue }
      nTouch++
      w.touch = true
      w.comp = spec.rest + spec.wheelR - hit.dist
      var compV = (w.comp - w.prev) / h
      var Fs = spec.spring * w.comp + spec.damper * compV
      Fs = Math.max(0, Math.min(Fs, m * spec.gravity * 2.4))
      w.load = Fs
      w.point.copy(hit.point)
      w.normal.copy(hit.normal || UP)
      applyAt(t3.copy(up).multiplyScalar(Fs), mount, Fsum, Tsum)
      // tyre frame on the ground plane
      var nrm = w.normal
      var wf = t3.copy(fwd)
      if (w.steers && st.steer !== 0) wf.applyAxisAngle(up, st.steer)
      wf.addScaledVector(nrm, -wf.dot(nrm)).normalize()
      var wr = t4.crossVectors(wf, nrm).normalize()
      // contact velocity
      var arm = t5.subVectors(hit.point, pos)
      var vC = t6.crossVectors(ang, arm).add(vel)
      var vLong = vC.dot(wf), vLat = vC.dot(wr)
      var share = m / n
      // longitudinal: drive / brake / reverse / engine braking
      var Flong = 0
      var rear = !w.steers
      if (ctl.handbrake && rear) Flong = -Math.sign(vLong) * Math.min(Math.abs(vLong) * share / h * 0.5, spec.brake * share)
      else if (ctl.throttle > 0.05 && vF > -0.6) {
        Flong = ctl.throttle * spec.accel * share * Math.max(0, 1 - Math.pow(Math.max(0, vF) / top, 2)) * (ctl.boost ? spec.boostAccel || 1.35 : 1)
        // hill assist ("low range"): uphill the drive also covers most of the
        // slope's pull, so dunes and the mesa tracks are climbable at any
        // speed (the tyre grip cap below still limits it on very steep faces)
        if (fwd.y > 0.02) Flong += ctl.throttle * spec.gravity * fwd.y * SXC_HILL * share
      }
      else if (ctl.throttle < -0.05 && !reversing) Flong = -Math.sign(vLong) * Math.min(Math.abs(vLong) * share / h * 0.5, spec.brake * share * -ctl.throttle)
      else if (reversing) Flong = -vF > spec.reverseTop ? -vLong * share * 0.6 : ctl.throttle * spec.accel * 0.7 * share * Math.max(0, 1 - Math.pow(Math.max(0, -vF) / spec.reverseTop, 2))
      else if (ctl.throttle > 0.05 && vF <= -0.6) Flong = Math.min(Math.abs(vLong) * share / h * 0.5, spec.brake * share)
      else Flong = -vLong * share * 0.35 // engine braking / rolling
      // lateral grip (drifts when it saturates; handbrake frees the rear)
      var mu = (ctl.handbrake && rear ? spec.gripHandbrake : spec.grip)
      var Flat = -vLat * share / h * spec.latStiff
      var cap = mu * Fs
      var mag = Math.hypot(Flong, Flat)
      if (mag > cap && mag > 1e-6) { var sc = cap / mag; Flong *= sc; Flat *= sc }
      w.slip = Math.abs(vLat)
      // apply the tyre force a little above the contact (less body roll)
      var at = t5.copy(hit.point).addScaledVector(up, (hit.dist - spec.wheelR) * spec.tireLift)
      var tf = t1.copy(wf).multiplyScalar(Flong).addScaledVector(wr, Flat)
      applyAt(tf, at, Fsum, Tsum)
      w.spin += vLong / spec.wheelR * h
    }
    st.grounded = nTouch
    // anti-roll bars: wheels are listed in left/right pairs per axle
    for (var p = 0; p + 1 < n; p += 2) {
      var wl = wheels[p], wr2 = wheels[p + 1]
      if (!wl.touch && !wr2.touch) continue
      var Far = (wl.comp - wr2.comp) * spec.antiRoll
      if (wl.touch) applyAt(t3.copy(up).multiplyScalar(Far), wl.mount, Fsum, Tsum)
      if (wr2.touch) applyAt(t3.copy(up).multiplyScalar(-Far), wr2.mount, Fsum, Tsum)
    }
    // aero drag + downforce
    Fsum.addScaledVector(vel, -0.9 * speed * m / 900)
    if (nTouch >= 2) Fsum.addScaledVector(up, -spec.downforce * speed * speed * m / 900)
    // upright assist (strong on the ground, gentle in the air) + air control
    var tilt = t3.crossVectors(up, UP)
    var I = spec.inertia
    if (nTouch >= 2) Tsum.addScaledVector(tilt, 6 * I[2])
    else if (st.hullTouch) {
      // lying on the hull with the wheels up: tip back onto the wheels
      Tsum.addScaledVector(tilt, 10 * I[2])
    } else {
      // airborne: level out for the landing, light pitch / yaw control
      Tsum.addScaledVector(tilt, 3.2 * I[2])
      Tsum.addScaledVector(right, -ctl.throttle * 0.7 * I[0])
      Tsum.addScaledVector(up, ctl.steer * 1.1 * I[1])
    }
    // integrate
    vel.addScaledVector(Fsum, h / m)
    qInv.copy(q).invert()
    var tb = t4.copy(Tsum).applyQuaternion(qInv)
    tb.set(tb.x / I[0], tb.y / I[1], tb.z / I[2]).applyQuaternion(q)
    ang.addScaledVector(tb, h)
    // damping: roll/pitch harder on the ground
    var damp = nTouch >= 2 ? 3.2 : 0.6
    var aUp = ang.dot(up)
    t5.copy(up).multiplyScalar(aUp)
    ang.sub(t5).multiplyScalar(Math.exp(-damp * h)).add(t5.multiplyScalar(Math.exp(-(nTouch >= 2 ? 1.6 : 0.4) * h)))
    if (ang.length() > 7) ang.setLength(7)
    pos.addScaledVector(vel, h)
    qd.set(ang.x * h * 0.5, ang.y * h * 0.5, ang.z * h * 0.5, 0).multiply(q)
    q.x += qd.x; q.y += qd.y; q.z += qd.z; q.w += qd.w
    q.normalize()
    collide(h)
    // desert: the roaming radius that stops players on foot (desert.js
    // SXD_PLAY_R, the edge of the map) holds vehicles too; the ground goes on
    // a little further (SXD_WORLD_R), so a car never reaches the flat void
    if (typeof SXD_HG !== 'undefined' && SXD_HG && typeof SXD_PLAY_R !== 'undefined') {
      var bx = pos.x - SXD_HG.cx, bz = pos.z - SXD_HG.cz, br = Math.hypot(bx, bz), lim = SXD_PLAY_R - 6
      if (br > lim) {
        var nx = bx / br, nz = bz / br
        pos.x = SXD_HG.cx + nx * lim
        pos.z = SXD_HG.cz + nz * lim
        var vo = vel.x * nx + vel.z * nz
        if (vo > 0) { vel.x -= nx * vo * 1.3; vel.z -= nz * vo * 1.3 }
      }
    }
  }

  // hull spheres vs boxes and the ground
  var hs = new V3(), cp = new V3()
  function collide(h) {
    var impact = 0
    st.hullTouch = false
    for (var k = 0; k < spec.hull.length; k++) {
      var s = spec.hull[k], r = s[3]
      toWorld(hs.set(s[0], s[1], s[2]), hs)
      for (var b = 0; b < near.length; b++) {
        var bx = near[b]
        cp.set(Math.max(bx.min.x, Math.min(bx.max.x, hs.x)), Math.max(bx.min.y, Math.min(bx.max.y, hs.y)), Math.max(bx.min.z, Math.min(bx.max.z, hs.z)))
        var dx = hs.x - cp.x, dy = hs.y - cp.y, dz = hs.z - cp.z, d2 = dx * dx + dy * dy + dz * dz
        if (d2 >= r * r) continue
        var d = Math.sqrt(d2), nx, ny, nz, pen
        if (d > 1e-5) { nx = dx / d; ny = dy / d; nz = dz / d; pen = r - d }
        else {
          // centre inside the box: leave by the face it came in through (the
          // shallowest of the faces the car is moving into), not just the
          // nearest one — past the middle of a thin wall that is the far side
          var ex = [hs.x - bx.min.x, bx.max.x - hs.x, hs.y - bx.min.y, bx.max.y - hs.y, hs.z - bx.min.z, bx.max.z - hs.z]
          var into = [vel.x > 0.5, vel.x < -0.5, vel.y > 0.5, vel.y < -0.5, vel.z > 0.5, vel.z < -0.5]
          var mi = -1
          for (var e = 0; e < 6; e++) if (into[e] && (mi < 0 || ex[e] < ex[mi])) mi = e
          if (mi < 0) { mi = 0; for (var e2 = 1; e2 < 6; e2++) if (ex[e2] < ex[mi]) mi = e2 }
          nx = mi === 0 ? -1 : mi === 1 ? 1 : 0; ny = mi === 2 ? -1 : mi === 3 ? 1 : 0; nz = mi === 4 ? -1 : mi === 5 ? 1 : 0
          pen = ex[mi] + r
        }
        pos.x += nx * pen; pos.y += ny * pen; pos.z += nz * pen
        st.hullTouch = true
        hs.x += nx * pen; hs.y += ny * pen; hs.z += nz * pen
        var vn = vel.x * nx + vel.y * ny + vel.z * nz
        if (vn < 0) {
          vel.x -= 1.25 * vn * nx; vel.y -= 1.25 * vn * ny; vel.z -= 1.25 * vn * nz
          // scrub some sideways speed and spin off the wall
          vel.multiplyScalar(0.97)
          t1.set(nx, ny, nz)
          t2.subVectors(hs, pos)
          ang.addScaledVector(t3.crossVectors(t2, t1), -vn * 0.25)
          impact = Math.max(impact, -vn)
        }
      }
      // ground under the sphere (terrain or a box top)
      var g = G.physics.groundHeight(hs.x, hs.z, hs.y + r)
      var low = hs.y - r
      if (low < g) {
        st.hullTouch = true
        var p2 = g - low
        pos.y += p2
        if (vel.y < 0) { impact = Math.max(impact, -vel.y * 0.6); vel.y *= -0.15 }
        vel.x *= Math.exp(-2.5 * h); vel.z *= Math.exp(-2.5 * h)
        ang.multiplyScalar(Math.exp(-3 * h))
      }
    }
    if (impact > 7.5 && st.bangT <= 0) {
      st.bangT = 0.35
      var dmg = (impact - 7.5) * (spec.mass > 2000 ? 5 : 10)
      api.damage(dmg, pos.clone(), null, 'body', 'crash')
      U.sound('container_bang', { pos: pos, gain: Math.min(1, 0.4 + impact * 0.04), pitch: spec.mass > 2000 ? 0.7 : 1 })
    }
  }

  // ---- control + simulation per frame
  var idleCtl = { throttle: 0, steer: 0, handbrake: true, boost: false }
  function simulate(dt, ctl) {
    if (st.asleep) return
    gatherBoxes(dt)
    // sub-steps: at least 120 a second, and short enough that no hull sphere
    // moves more than 0.15 m in one (thin walls: 0.2 m house walls, poles)
    var nSub = Math.min(16, Math.max(1, Math.ceil(dt / (1 / 120)), Math.ceil((vel.length() * dt) / 0.15)))
    var h = dt / nSub
    var vy0 = vel.y
    for (var k = 0; k < nSub; k++) step(h, ctl)
    // landing thump / dust
    if (st.grounded >= 2 && st.landV < -6) {
      landFx(-st.landV)
    }
    st.landV = st.grounded >= 2 ? 0 : Math.min(st.landV, vel.y)
    if (!(st.grounded >= 2)) st.landV = Math.min(st.landV, vy0)
    // flip recovery: stuck on the side/roof for a moment -> set it back on its wheels
    frame()
    if (up.y < 0.5 && st.speed < 4) st.flipT += dt
    else st.flipT = 0
    if (st.flipT > 1.8) { unflip(); st.flipT = 0 }
    // beached on an obstacle (wheels hanging, hull resting on a box)
    if (api.alive && st.grounded <= 1 && st.hullTouch && st.speed < 2.5) st.beachT += dt
    else st.beachT = 0
    if (st.beachT > 2.5) { unflip(); st.beachT = 0 }
    // sleep when parked and still
    if (U.pilot !== api && st.grounded >= wheels.length - 1 && vel.lengthSq() < 0.01 && ang.lengthSq() < 0.01) {
      st.sleep += dt
      if (st.sleep > 1.2) { st.asleep = true; vel.set(0, 0, 0); ang.set(0, 0, 0) }
    } else st.sleep = 0
    // safety: never fall through the world
    var gy = U.groundAt(pos.x, pos.z, pos.y + 3)
    if (pos.y < gy - 2) { pos.y = gy + restOffset + 0.5; vel.set(0, 0, 0); ang.set(0, 0, 0) }
  }
  // Put the car back on its wheels at the nearest spot clear of boxes.
  function unflip() {
    var yaw = headingYaw()
    q.setFromAxisAngle(UP, yaw)
    var half = Math.max(Math.abs(spec.box.min[0]), spec.box.max[0], Math.abs(spec.box.min[2]), spec.box.max[2])
    var spot = U.spotOutside ? U.spotOutside(pos.x, pos.z, half + 0.3) : null
    if (spot) { pos.x = spot.x; pos.z = spot.z }
    pos.y = U.groundAt(pos.x, pos.z, 999) + restOffset + 0.5
    vel.set(0, 0, 0); ang.set(0, 0, 0)
    U.sound('reload_bolt', { pos: pos, gain: 0.6, pitch: 0.6 })
  }
  function landFx(v) {
    for (var k = 0; k < wheels.length; k++) {
      var w = wheels[k]
      if (!w.touch || !G.fx || !G.fx.dust) continue
      try { G.fx.dust(w.point, w.normal, Math.min(1.6, 0.5 + v * 0.08), 0.62, 0.52, 0.38) } catch (e) { }
    }
    U.sound('land', { pos: pos, gain: Math.min(1, 0.4 + v * 0.05), pitch: spec.mass > 2000 ? 0.5 : 0.7 })
  }

  // ---- visuals: body transform, wheels, turret, dust, engine
  var turretYaw = 0, turretPitch = 0
  var aimPt = new V3(), localAim = new V3()
  function syncVisual(dt, aiming) {
    root.position.copy(pos)
    root.quaternion.copy(q)
    root.updateMatrixWorld(true)
    api.pos.copy(pos)
    api.pos.y -= restOffset - spec.mountY
    for (var k = 0; k < wheels.length; k++) {
      var w = wheels[k]
      var drop = spec.rest + spec.wheelR - w.comp - spec.wheelR
      w.holder.position.set(w.x, spec.mountY - Math.max(0, drop), w.z)
      w.holder.rotation.set(0, w.steers ? st.steer : 0, 0)
      w.tyre.rotation.x = -w.spin
    }
    // the steering wheel turns with the steering; the player sits at it while
    // driving (driver/driver.js: made the first time, once the soldier model is in)
    var ck = spec.cockpit, sw = model.steer
    var driving = U.pilot === api && api.alive
    // online, another player driving this car (net/net.js pins it: __netPilot)
    var netP = !driving && api.alive && api.__netPilot && typeof SXN !== 'undefined' && SXN.active && SXN.players ? SXN.players[api.__netPilot] : null
    var steerNow = st.steer, lookRel = 0, lookP = 0, hyNow = headingYaw()
    if (driving) { lookRel = SXC_wrap(U.look.yaw - hyNow); lookP = U.look.pitch }
    else if (netP) {
      // their steering, read off how fast the car turns at its speed (bicycle model)
      var dyaw = st.netHy == null ? 0 : SXC_wrap(hyNow - st.netHy), mv = st.netPos ? Math.hypot(pos.x - st.netPos.x, pos.z - st.netPos.z) : 0
      st.netHy = hyNow
      st.netPos = (st.netPos || new V3()).copy(pos)
      var base = Math.abs(spec.wheels[0][1] - spec.wheels[spec.wheels.length - 1][1]) || 2.6
      var est = dt > 0 && mv > 0.02 ? Math.atan(((dyaw / dt) * base) / Math.max(2, mv / dt)) : 0
      st.netSteer = (st.netSteer || 0) + (Math.max(-spec.steerMax, Math.min(spec.steerMax, est)) - (st.netSteer || 0)) * (1 - Math.exp(-8 * dt))
      steerNow = st.netSteer
      var ls = netP.buf && netP.buf[netP.buf.length - 1]
      if (ls) { lookRel = SXC_wrap((ls.yaw || 0) - hyNow); lookP = ls.pitch || 0 }
    } else st.netHy = null
    if (sw) sw.userData.spin.rotation.z = steerNow * (ck ? ck.ratio : 2.5)
    var seated = driving || !!netP
    var look = driving ? (typeof SXDR_variant === 'function' ? SXDR_variant() : 'net_blue') : netP && netP.team === 'red' ? 'net_red' : 'net_blue'
    if (driver && seated && driver.variant !== look) { driver.dispose(); driver = null } // someone else at the wheel
    if (seated && !driver && sw && ck && typeof SXDR_make === 'function') {
      driver = SXDR_make(G, ck, look)
      if (driver) { driver.variant = look; bodyG.add(driver.root) }
    }
    if (driver) {
      driver.show(seated && !!sw)
      if (seated && sw) driver.pose(sw, sw.userData.spin.rotation.z, lookRel, lookP, driving && SXC_VIEW.fpv)
    }
    // boost rockets: the driver's Shift here (drive() sets st.boostWant); another
    // player's car burns while it runs past the normal top speed
    if (netP) st.boostWant = dt > 0 && mv / dt > spec.topSpeed * 1.04
    else if (!driving) st.boostWant = false
    var bw = st.boostWant && api.alive ? 1 : 0
    st.boostK = (st.boostK || 0) + (bw - (st.boostK || 0)) * (1 - Math.exp(-(bw > (st.boostK || 0) ? 9 : 5) * dt))
    if (st.boostK < 0.005) st.boostK = 0
    if (rockets) rockets.set(st.boostK, dt, pos, Math.abs(st.fwdSpeed || 0))
    // turret tracks the crosshair while piloted, rests forward otherwise
    var wantYaw = 0, wantPitch = 0.05
    if (aiming) {
      // aimPt comes from camera() (the chase camera of the previous frame):
      // during drive() G.camera still holds the player's first-person pose.
      tur.yaw.updateMatrixWorld()
      localAim.copy(aimPt)
      tur.yaw.parent.worldToLocal(localAim)
      localAim.sub(tur.yaw.position)
      wantYaw = Math.atan2(-localAim.x, -localAim.z)
      wantPitch = Math.atan2(localAim.y - tur.pitch.position.y, Math.hypot(localAim.x, localAim.z))
    }
    if (!api.alive) { wantYaw = turretYaw; wantPitch = -0.25 }
    var dyaw = Math.atan2(Math.sin(wantYaw - turretYaw), Math.cos(wantYaw - turretYaw))
    turretYaw += Math.max(-tur.rate * dt, Math.min(tur.rate * dt, dyaw))
    turretPitch += Math.max(-tur.rate * dt, Math.min(tur.rate * dt, Math.max(tur.pitchMin, Math.min(tur.pitchMax, wantPitch)) - turretPitch))
    tur.yaw.rotation.y = turretYaw
    tur.pitch.rotation.x = turretPitch
    // dust from the tyres
    st.dustT -= dt
    if (st.dustT <= 0 && api.alive && G.fx && G.fx.smoke) {
      var spd = st.speed
      var slipping = 0
      for (var j = 0; j < wheels.length; j++) if (wheels[j].touch) slipping = Math.max(slipping, wheels[j].slip)
      if ((spd > 4 || slipping > 2.5) && st.grounded >= 2) {
        st.dustT = 0.05 + 0.25 / (1 + spd * 0.25)
        for (var r = 0; r < wheels.length; r++) {
          var ww = wheels[r]
          if (!ww.touch || ww.steers) continue
          try {
            G.fx.smoke(t1.copy(ww.point).addScaledVector(fwd, -0.4).setY(ww.point.y + 0.3), { size: 1.3 + spd * 0.08 + slipping * 0.08, life: 2.2 + spd * 0.04, rise: 0.65, count: 1, alpha: Math.min(0.5, 0.16 + spd * 0.012 + slipping * 0.03), color: 0xd8bf92, vel: t2.copy(vel).multiplyScalar(0.12) })
            if ((spd > 10 || slipping > 3) && Math.random() < 0.6 && G.fx.dust) G.fx.dust(ww.point, ww.normal, 0.8 + Math.min(0.6, slipping * 0.06), 0.8, 0.7, 0.54)
          } catch (e) { }
        }
      } else st.dustT = 0.15
    }
  }

  // ---- engine sound (a pitched loop when the audio module has one)
  function engineStart() {
    if (st.engine || !G.audio || !G.audio.loop) return
    var names = spec.mass > 2000 ? ['sx_engine_diesel', 'hound_servo'] : ['sx_engine_buggy', 'gull_rotor']
    for (var k = 0; k < names.length && !st.engine; k++) {
      try {
        var hnd = G.audio.loop(names[k], { gain: 0, pitch: 0.4, pos: pos, ref: 6 })
        if (hnd && hnd.setGain && hnd.name) st.engine = hnd
      } catch (e) { }
    }
  }
  function engineStop() { if (st.engine) { try { st.engine.stop(0.4) } catch (e) { } st.engine = null } }
  function engineTick(throttle) {
    if (!st.engine) return
    // a gearbox: revs climb through each gear and drop on the shift
    var diesel = spec.mass > 2000, gears = diesel ? 5 : 4
    var sf = Math.min(1.25, Math.abs(st.fwdSpeed) / spec.topSpeed)
    var g = Math.min(gears - 1, Math.floor(sf * gears)), inGear = sf * gears - g
    var load = Math.abs(throttle)
    var revs = st.grounded ? 0.18 + (g === 0 ? inGear * 0.8 : 0.42 + inGear * 0.55) * (0.75 + 0.25 * load) : 0.25 + load * 0.75
    st.revs = st.revs == null ? revs : st.revs + (revs - st.revs) * Math.min(1, (revs > st.revs ? 9 : 5) * 0.016)
    try {
      st.engine.setPitch(diesel ? 0.7 + st.revs * 1.5 : 0.55 + st.revs * 2.6)
      st.engine.setGain((diesel ? 0.32 : 0.26) + load * 0.32 + st.revs * 0.18)
      st.engine.setPos && st.engine.setPos(pos)
    } catch (e) { }
  }

  // ---- weapons
  var muzzleW = new V3(), dirW = new V3()
  function muzzleWorld(k, out) {
    tur.yaw.updateMatrixWorld(true)
    return tur.pitch.localToWorld(out.copy(tur.muzzles[k % tur.muzzles.length]))
  }
  var gunBarrel = 0
  function fireGun() {
    var isRhino = spec.type === 'rhino'
    muzzleWorld(gunBarrel++, muzzleW)
    // shoot along the barrel, nudged onto the crosshair when close enough
    tur.pitch.getWorldDirection(dirW).negate()
    t1.copy(aimPt).sub(muzzleW).normalize()
    if (t1.dot(dirW) > 0.985) dirW.copy(t1)
    var spread = isRhino ? 0.006 : 0.011
    dirW.x += (Math.random() - 0.5) * spread * 2
    dirW.y += (Math.random() - 0.5) * spread * 2
    dirW.z += (Math.random() - 0.5) * spread * 2
    dirW.normalize()
    U.shoot(muzzleW, dirW, { damage: isRhino ? 45 : 18, range: isRhino ? 360 : 260, tracerFrom: muzzleW })
    try { G.fx && G.fx.muzzleFlash && G.fx.muzzleFlash(muzzleW, dirW, { scale: isRhino ? 1.6 : 1 }) } catch (e) { }
    try { G.render && G.render.lightPool && G.render.lightPool.flash(muzzleW, 16756832, isRhino ? 70 : 35, isRhino ? 10 : 7, 0.05) } catch (e) { }
    G.events.emit('weapon:fire', { origin: muzzleW, dir: dirW, muzzle: muzzleW, ads: 0, pitch: isRhino ? 0.5 : 0.82, gain: isRhino ? 1.35 : 0.85, weapon: spec.type })
    // brass / recoil
    if (G.fx && G.fx.shell) { try { G.fx.shell(t2.copy(muzzleW).addScaledVector(dirW, -0.5), t3.copy(right).multiplyScalar(2).addScaledVector(UP, 1.5).add(vel)) } catch (e) { } }
    tur.pitch.position.z = (tur.z0 || 0) + (isRhino ? 0.08 : 0.03)
  }
  function fireShell() {
    muzzleWorld(0, muzzleW)
    tur.pitch.getWorldDirection(dirW).negate()
    t1.copy(aimPt).sub(muzzleW).normalize()
    if (t1.dot(dirW) > 0.97) dirW.copy(t1)
    var mesh = new lt.Mesh(new lt.SphereGeometry(0.09, 10, 8), M.lamp)
    mesh.position.copy(muzzleW)
    G.scene.add(mesh)
    shells.push({ pos: muzzleW.clone(), vel: dirW.clone().multiplyScalar(95).add(vel), mesh: mesh, t: 0, trail: 0 })
    try { G.fx && G.fx.muzzleFlash && G.fx.muzzleFlash(muzzleW, dirW, { scale: 2.6 }) } catch (e) { }
    try { G.render && G.render.lightPool && G.render.lightPool.flash(muzzleW, 16756832, 140, 14, 0.08) } catch (e) { }
    G.events.emit('weapon:fire', { origin: muzzleW, dir: dirW, muzzle: muzzleW, ads: 0, pitch: 0.36, gain: 1.5, weapon: 'rhino_shell' })
    U.sound('explosion', { pos: muzzleW, gain: 0.35, pitch: 1.7 })
    tur.pitch.position.z = (tur.z0 || 0) + 0.22
    ang.addScaledVector(right, 0.5)
  }
  function updateShells(dt) {
    for (var k = shells.length - 1; k >= 0; k--) {
      var s = shells[k]
      s.t += dt
      s.vel.y -= 6 * dt
      var stp = t1.copy(s.vel).multiplyScalar(dt), len = stp.length()
      var d = t2.copy(stp).divideScalar(len || 1)
      var hit = U.cast(s.pos, d, len, 'enemy')
      if (hit || s.t > 5) {
        var at = hit ? t3.copy(hit.point).addScaledVector(d, -0.2) : s.pos
        U.blast(at.clone(), 6.5, 260, 'ally', { size: 1.3, selfScale: 0 })
        G.scene.remove(s.mesh)
        s.mesh.geometry.dispose()
        shells.splice(k, 1)
        continue
      }
      s.pos.add(stp)
      s.mesh.position.copy(s.pos)
      s.trail -= dt
      if (s.trail <= 0 && G.fx && G.fx.smoke) { s.trail = 0.03; try { G.fx.smoke(s.pos, { size: 0.35, life: 0.9, rise: 0.1, count: 1, alpha: 0.18 }) } catch (e) { } }
    }
  }

  // ---- running over robots
  function runOver(dt) {
    if (st.speed < 5 || !G.enemies) return
    var list = G.enemies.list || []
    var R = spec.runOver.radius
    for (var k = 0; k < list.length; k++) {
      var e = list[k]
      if (!e.alive || e.type !== 'hound') continue
      var dx = e.pos.x - api.pos.x, dz = e.pos.z - api.pos.z
      if (dx * dx + dz * dz > R * R || Math.abs(e.pos.y - api.pos.y) > 2.2) continue
      var last = st.runT.get(e) || 0
      if (G.time.t - last < 0.6) continue
      st.runT.set(e, G.time.t)
      var killed = e.damage(st.speed * spec.runOver.damage, e.pos.clone().setY(e.pos.y + 0.6), vel.clone().normalize(), 'body') === true
      G.events.emit('player:hitEnemy', { enemy: e, part: 'body', killed: killed, weak: false })
      api.damage(spec.runOver.selfDamage, e.pos.clone(), null, 'body', 'crash')
      vel.multiplyScalar(spec.mass > 2000 ? 0.95 : 0.82)
      U.sound('impact_enemy', { pos: e.pos, gain: 1, pitch: 0.7 })
    }
  }

  // ---- wreck
  function wreck() {
    api.alive = false
    U.killed(api)
    var c = api.center(new V3())
    try { G.fx && G.fx.explosion && G.fx.explosion(c, spec.mass > 2000 ? 1.8 : 1.4) } catch (e) { }
    U.blast(c, 5, 60, 'enemy', { fx: false, ignore: api })
    model.body.traverse(function (o) { if (o.isMesh && o.material !== M.tire) o.material = M.burnt })
    tur.yaw.traverse(function (o) { if (o.isMesh) o.material = M.burnt })
    try { fireFx = G.fx && G.fx.addEmitter ? G.fx.addEmitter(c, 'fire', { ttl: 30, scale: spec.mass > 2000 ? 1.2 : 0.8 }) : null } catch (e) { fireFx = null }
    ang.add(t1.set(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(2))
    vel.y += 4
    st.asleep = false
    engineStop()
  }

  // ---- the unit
  var api = {
    type: spec.type, label: spec.label, faction: 'ally', vehicle: true, alive: true,
    pos: new V3(), hp: spec.hp, maxHp: spec.hp, radius: spec.radius, armor: spec.armor, enterRadius: spec.enterRadius,
    // collisions (units framework): the car keeps its own body position
    push: function (dx, dz) { pos.x += dx; pos.z += dz; st.asleep = false; st.sleep = 0 },
    get vel() { return vel },
    get yaw() { return headingYaw() },
    center: function (out) { return toWorld(t1.set(0, 0.55, 0), out || new V3()) },
    raycast: function (o, d, max) {
      // ray vs the oriented hull box
      qInv.copy(q).invert()
      var lo = t1.copy(o).sub(pos).applyQuaternion(qInv)
      var ld = t2.copy(d).applyQuaternion(qInv)
      var bmin = spec.box.min, bmax = spec.box.max
      var tmin = 0, tmax = max, axis = -1, sign = 0
      for (var a = 0; a < 3; a++) {
        var oc = a === 0 ? lo.x : a === 1 ? lo.y : lo.z, dc = a === 0 ? ld.x : a === 1 ? ld.y : ld.z
        if (Math.abs(dc) < 1e-8) { if (oc < bmin[a] || oc > bmax[a]) return null; continue }
        var ta = (bmin[a] - oc) / dc, tb = (bmax[a] - oc) / dc, sg = -1
        if (ta > tb) { var sw = ta; ta = tb; tb = sw; sg = 1 }
        if (ta > tmin) { tmin = ta; axis = a; sign = sg }
        if (tb < tmax) tmax = tb
        if (tmin > tmax) return null
      }
      if (axis < 0) return null
      var nl = t3.set(axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0).applyQuaternion(q)
      return { dist: tmin, point: o.clone().addScaledVector(d, tmin), normal: nl.clone(), part: 'body' }
    },
    damage: function (amount, point, dir, part, source) {
      if (!api.alive || !(amount > 0)) return false
      api.hp -= amount
      st.hitT = 0.15
      st.asleep = false
      if (point && point.isVector3 && source !== 'crash' && G.fx && G.fx.sparks && Math.random() < 0.5) { try { G.fx.sparks(point, t4.copy(point).sub(pos).normalize(), 6) } catch (e) { } }
      if (api.hp <= 0) { api.hp = 0; wreck(); return true }
      return false
    },
    update: function (dt) {
      // the Buggy model finished loading after this Sandcat was built: swap the look
      if (spec.type === 'sandcat' && !model.glb && SXC_BG.ready) {
        var nm = SXC_buildSandcatGLB(G, M)
        bodyG.remove(model.body); bodyG.remove(tur.yaw)
        bodyG.add(nm.body); bodyG.add(nm.turret.yaw)
        wheels.forEach(function (w, i) {
          w.holder.clear()
          w.tyre = nm.wheels[i]; w.holder.add(w.tyre)
          if (nm.hubs && nm.hubs[i]) w.holder.add(nm.hubs[i])
          w.x = spec.wheels[i][0]; w.z = spec.wheels[i][1]
        })
        model = nm; tur = nm.turret
      }
      // the TMV model finished loading after this Rhino was built: same swap
      if (spec.type === 'rhino' && !model.glb && SXC_TMV.ready) {
        var nr = SXC_buildRhinoGLB(G, M)
        bodyG.remove(model.body); bodyG.remove(tur.yaw)
        bodyG.add(nr.body); bodyG.add(nr.turret.yaw)
        wheels.forEach(function (w, i) {
          w.holder.clear()
          w.tyre = nr.wheels[i]; w.holder.add(w.tyre)
          w.x = spec.wheels[i][0]; w.z = spec.wheels[i][1]
        })
        model = nr; tur = nr.turret
      }
      updateShells(dt)
      if (U.pilot !== api) {
        simulate(dt, idleCtl)
        syncVisual(dt, false)
        if (st.engine) engineStop()
      }
      if (!api.alive) {
        st.wreckT += dt
        st.smokeT -= dt
        if (st.smokeT <= 0 && st.wreckT < 40 && G.fx && G.fx.smoke) { st.smokeT = 0.18; try { G.fx.smoke(api.center(t1), { size: 1.4, life: 3.5, rise: 1.4, count: 1, alpha: 0.35, color: 0x1a1816 }) } catch (e) { } }
      }
      st.bangT -= dt
      tur.pitch.position.z += ((tur.z0 || 0) - tur.pitch.position.z) * Math.min(1, dt * 12)
    },
    dispose: function () {
      engineStop()
      if (rockets) rockets.dispose()
      if (fireFx && fireFx.stop) { try { fireFx.stop() } catch (e) { } }
      shells.forEach(function (s) { G.scene.remove(s.mesh) })
      shells.length = 0
      G.scene.remove(root)
    },
    // ---- vehicle extras
    enterPoint: function (out) {
      frame()
      out.copy(pos).addScaledVector(right, -(spec.box.max[0] + 0.4)).addScaledVector(fwd, 0.2)
      out.y = U.groundAt(out.x, out.z, pos.y + 1)
      return out
    },
    anchor: function (out) {
      return out.copy(pos).setY(pos.y - 0.6)
    },
    exitPoint: function (out) {
      frame()
      var sides = [[-1, 0.2], [1, 0.2], [0, -1], [0, 1]]
      for (var k = 0; k < sides.length; k++) {
        var sx = sides[k][0], sz = sides[k][1]
        out.copy(pos)
        if (sx) out.addScaledVector(right, sx * (spec.box.max[0] + 0.9)).addScaledVector(fwd, sz)
        else out.addScaledVector(fwd, sz > 0 ? -(spec.box.min[2] - 1) : spec.box.max[2] + 1)
        var gy = U.groundAt(out.x, out.z, pos.y + 1.5)
        var clear = true, boxes = G.physics.boxes || []
        for (var b = 0; b < boxes.length && clear; b++) {
          var bx = boxes[b]
          if (bx.bulletOnly || bx.max.y <= gy + 0.05 || bx.min.y > gy + 1.8) continue
          if (out.x + 0.4 > bx.min.x && out.x - 0.4 < bx.max.x && out.z + 0.4 > bx.min.z && out.z - 0.4 < bx.max.z) clear = false
        }
        if (clear) { out.y = gy; return out }
      }
      out.copy(pos).setY(pos.y + 2)
      return out
    },
    onEnter: function () {
      st.asleep = false
      st.lastLookYaw = U.look.yaw
      st.idleLookT = 0
      st.fpvHy = null // the driver view starts looking ahead
      engineStart()
      U.sound('reload_bolt', { pos: pos, gain: 0.7, pitch: spec.mass > 2000 ? 0.45 : 0.6 })
    },
    onExit: function () {
      engineStop()
    },
    drive: function (dt, inp, U2) {
      var mv = inp.move || { x: 0, y: 0 }
      // Shift alone drives forward at full boost (no W needed); S still brakes / reverses
      var my = mv.y || 0, boost = !!inp.sprint && my > -0.1
      var ctl = { throttle: boost ? 1 : my, steer: -(mv.x || 0), handbrake: !!(inp.down && inp.down('jump')), boost: boost }
      st.boostWant = boost && api.alive
      if (inp.pressed && inp.pressed('reload')) { frame(); if ((up.y < 0.6 || st.grounded <= 2) && st.speed < 5) unflip() }
      // C (the crouch key): first person ⇄ chase camera
      if (inp.pressed && inp.pressed('crouch') && spec.cockpit) {
        SXC_toggleView()
        try { G.hud.message(SXC_VIEW.fpv ? 'Driver view' : 'Chase view', 1.2) } catch (e) { }
      }
      simulate(dt, ctl)
      // auto-centre the camera behind the car when the mouse rests
      if (Math.abs(U.look.yaw - st.lastLookYaw) > 1e-4) st.idleLookT = 0
      else st.idleLookT += dt
      if (st.idleLookT > 1.1 && st.fwdSpeed > 5) {
        var hy = headingYaw()
        var dy = Math.atan2(Math.sin(hy - U.look.yaw), Math.cos(hy - U.look.yaw))
        U.look.yaw += dy * (1 - Math.exp(-1.6 * dt))
      }
      st.lastLookYaw = U.look.yaw
      syncVisual(dt, true)
      engineTick(ctl.throttle)
      runOver(dt)
      // guns
      var isRhino = spec.type === 'rhino'
      st.fireT -= dt
      st.heat = Math.max(0, st.heat - dt * (isRhino ? 0.32 : 0.4))
      if (st.overheat && st.heat < 0.35) st.overheat = false
      if (inp.fire && !st.overheat && st.fireT <= 0) {
        st.fireT += isRhino ? 0.25 : 1 / 12
        if (st.fireT < 0) st.fireT = 0
        fireGun()
        st.heat += isRhino ? 0.07 : 0.045
        if (st.heat >= 1) { st.heat = 1; st.overheat = true; U.sound('rifle_dry', { gain: 0.8, pitch: 0.6 }) }
      }
      if (st.fireT < 0) st.fireT = 0
      st.shellT -= dt
      var ads = !!inp.ads
      if (isRhino && ads && !st.adsPrev && st.shellT <= 0) { st.shellT = 3.5; fireShell() }
      st.adsPrev = ads
    },
    camera: function (cam, dt, U2) {
      var ck = spec.cockpit
      if (SXC_VIEW.fpv && ck) {
        // first person from the driver's seat: the car's own pitch and roll,
        // the view carried round as the car turns, the mouse looks about
        // within ±SXC_VIEW.look of straight ahead (the auto-centre in drive()
        // brings it back when the mouse rests)
        var hy = headingYaw()
        // the first frame in this view: look straight ahead, a little down at the wheel
        if (st.fpvHy == null) { st.fpvHy = hy; U.look.yaw = hy; U.look.pitch = ck.pitch || 0 }
        U.look.yaw += SXC_wrap(hy - st.fpvHy)
        st.fpvHy = hy
        var off = Math.max(-SXC_VIEW.look, Math.min(SXC_VIEW.look, SXC_wrap(U.look.yaw - hy)))
        U.look.yaw = hy + off
        toWorld(t1.set(ck.eye[0], ck.eye[1], ck.eye[2]), cam.position)
        var bk = st.boostK || 0, shake = bk * 0.0045
        fpvE.set(U.look.pitch + (Math.random() - 0.5) * shake, off + (Math.random() - 0.5) * shake, 0)
        cam.quaternion.copy(q).multiply(fpvQ.setFromEuler(fpvE))
        var fv = SXC_VIEW.fov + bk * 9 // the rockets widen the view
        if (Math.abs(cam.fov - fv) > 0.01) { cam.fov = fv; cam.updateProjectionMatrix() }
        cam.updateMatrixWorld()
      } else {
        st.fpvHy = null
        var focus = t1.copy(pos).setY(pos.y + spec.camHeight)
        U.chaseCam(cam, focus, U.look.yaw, U.look.pitch, spec.camDist, dt, spec.fov + (st.boostK || 0) * 8)
      }
      // what the crosshair is on, for the turret next frame
      var d = t2.set(0, 0, -1).applyQuaternion(cam.quaternion)
      var h = U.cast(cam.position, d, 500, 'enemy')
      aimPt.copy(cam.position).addScaledVector(d, h ? Math.max(h.dist, 2) : 500)
    },
    hud: function () {
      var kmh = Math.round(Math.abs(st.fwdSpeed) * 3.6)
      var gun = spec.type === 'rhino' ? 'CANNON' : 'MG'
      var lines = ['SPEED ' + kmh + ' KM/H', gun + (st.overheat ? ' OVERHEAT' : ' HEAT ' + Math.round(st.heat * 100) + '%')]
      if (spec.type === 'rhino') lines.push(st.shellT > 0 ? 'SHELL ' + st.shellT.toFixed(1) + 's' : 'SHELL READY (RMB)')
      frame()
      if (up.y < 0.6 || st.beachT > 0.8 || st.flipT > 0.5) lines.push('R  RESET CAR')
      if (spec.cockpit) lines.push(SXC_viewKey() + '  ' + (SXC_VIEW.fpv ? 'CHASE VIEW' : 'DRIVER VIEW'))
      return { hp: api.hp, maxHp: api.maxHp, lines: lines }
    },
    // debug / tests
    debug: {
      state: st, unflip: unflip,
      body: function () { return { pos: pos, vel: vel, ang: ang, q: q } },
      contacts: function () {
        gatherBoxes(0.016)
        return spec.hull.map(function (s2) {
          var c = toWorld(new V3(s2[0], s2[1], s2[2]), new V3())
          var g = G.physics.groundHeight(c.x, c.z, c.y + s2[3])
          var hitBoxes = near.filter(function (bx) {
            var cx = Math.max(bx.min.x, Math.min(bx.max.x, c.x)), cy = Math.max(bx.min.y, Math.min(bx.max.y, c.y)), cz = Math.max(bx.min.z, Math.min(bx.max.z, c.z))
            return (c.x - cx) * (c.x - cx) + (c.y - cy) * (c.y - cy) + (c.z - cz) * (c.z - cz) < s2[3] * s2[3]
          }).length
          return [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2), +g.toFixed(2), +(c.y - s2[3]).toFixed(2), hitBoxes]
        })
      },
      wheels: function () { return wheels.map(function (w) { return [w.touch, +w.comp.toFixed(2)] }) },
      aim: function () {
        muzzleWorld(0, muzzleW)
        var bd = tur.pitch.getWorldDirection(new V3()).negate()
        var ta = aimPt.clone().sub(muzzleW).normalize()
        return { tYaw: +turretYaw.toFixed(3), tPitch: +turretPitch.toFixed(3), muzzle: muzzleW.toArray().map(function (n) { return +n.toFixed(2) }), aim: aimPt.toArray().map(function (n) { return +n.toFixed(2) }), barrel: bd.toArray().map(function (n) { return +n.toFixed(3) }), dot: +bd.dot(ta).toFixed(4) }
      },
    },
  }
  frame()
  syncVisual(0, false)
  console.log('[sx-cars] ' + spec.label + ' at ' + pos.x.toFixed(1) + ',' + pos.z.toFixed(1))
  return api
}

if (typeof SXU_TYPES !== 'undefined') {
  SXU_TYPES.sandcat = function (G, U, opts) { SXC_bgStart(); return SXC_vehicle(G, U, SXC_SPECS.sandcat, opts, SXC_BG.ready ? SXC_buildSandcatGLB : SXC_buildSandcat) }
  SXU_TYPES.rhino = function (G, U, opts) { SXC_tmvStart(); return SXC_vehicle(G, U, SXC_SPECS.rhino, opts, SXC_TMV.ready ? SXC_buildRhinoGLB : SXC_buildRhino) }
}

// parse the Buggy at boot (the Sandcats are parked at the first deploy)
if (typeof SXU_PLUGINS !== 'undefined') SXU_PLUGINS.push(function () { SXC_bgStart(); SXC_tmvStart() })
