// ============================================================================
// DoomZone mod — SOLDIER model for the troopers
// The soldier model (bones named mixamorig*, Idle / Walk / Run clips),
// embedded as SX_ASSET_soldier and parsed once by SX_GLTFLoader (common/lib).
// Every trooper gets a clone with its own skeleton and AnimationMixer.
// Locomotion blends Idle / Walk / Run by ground speed like the example; on
// top of the clip pose, each frame:
//   hips turn toward the move direction (strafe, backpedal with the clip
//   reversed) and the spine turns back to the aim + leans with the pitch;
//   legs IK for crouching and to put both feet on the dune slope;
//   a rifle is placed against the right shoulder pointing at the target
//   (low ready on patrol) and both arms IK onto its grips.
// Falls back to the robot rig (troopers.js) if the asset fails to load.
// ============================================================================

var SXS_TUNE = {
  walkNat: 1.6, runNat: 4.2, // ground speed (m/s) the Walk / Run clips are authored at
  crouchDrop: 0.42, lowReadyPitch: -0.6, lowReadyYaw: 0.55,
  tint: { rifle: 0xffffff, heavy: 0x7d848c, marksman: 0xdcc9a0, net_blue: 0xa9c2dc, net_red: 0xc08080 },
  // visor glow: red-orange for the machines' troopers, team colours for online players
  visor: { net_blue: 0x2f9dff, net_red: 0xff2a4a },
}
var SXS = { ready: false, failed: false, started: false, scene: null, clips: {}, face: 0, sphere: null, mats: {}, guns: {} }

function SXS_start() {
  if (SXS.started) return
  SXS.started = true
  window.__sxSoldier = SXS // debug / tests
  try {
    if (typeof SX_ASSET_soldier !== 'string' || typeof SX_GLTFLoader !== 'function') { SXS.failed = true; return }
    var bin = atob(SX_ASSET_soldier), buf = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    new SX_GLTFLoader().parse(buf.buffer, '', function (gltf) {
      try { SXS_prepare(gltf) } catch (e) { SXS.failed = true; console.warn('[sx] soldier model unusable', e) }
    }, function (e) { SXS.failed = true; console.warn('[sx] soldier model failed to load', e) })
  } catch (e) { SXS.failed = true; console.warn('[sx] soldier model failed to load', e) }
}

function SXS_prepare(gltf) {
  var scene = gltf.scene, body = null
  var keep = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']
  scene.traverse(function (o) {
    if (!o.isSkinnedMesh) return
    var g = o.geometry
    Object.keys(g.attributes).forEach(function (k) { if (keep.indexOf(k) < 0) g.deleteAttribute(k) })
    if (!/visor/i.test(o.name)) body = o
  })
  if (!body) throw new Error('no body mesh')
  gltf.animations.forEach(function (c) { SXS.clips[c.name] = c })
  if (!SXS.clips.Idle || !SXS.clips.Walk || !SXS.clips.Run) throw new Error('clips missing')
  scene.updateMatrixWorld(true)
  var wp = function (n) { var b = scene.getObjectByName('mixamorig' + n); if (!b) throw new Error('bone ' + n); return new lt.Vector3().setFromMatrixPosition(b.matrixWorld) }
  // troopers face -Z: turn the model if its toes point +Z
  SXS.face = wp('LeftToeBase').z > wp('LeftFoot').z ? Math.PI : 0
  // the IK arms / crouch reach outside the bind pose: a roomier cull sphere
  body.geometry.computeBoundingSphere()
  SXS.sphere = body.geometry.boundingSphere.clone()
  SXS.sphere.radius *= 1.7
  SXS.body = body
  SXS.scene = scene
  SXS.ready = true
}

// SkeletonUtils.clone: same graph, new bones, skins rebound to them
function SXS_clone(src) {
  var dst = src.clone(true), a = [], b = [], map = new Map()
  src.traverse(function (o) { a.push(o) })
  dst.traverse(function (o) { b.push(o) })
  a.forEach(function (o, i) { map.set(o, b[i]) })
  b.forEach(function (o, i) {
    if (!o.isSkinnedMesh) return
    var s = a[i]
    o.bind(new lt.Skeleton(s.skeleton.bones.map(function (x) { return map.get(x) }), s.skeleton.boneInverses), s.bindMatrix)
  })
  return dst
}

function SXS_mats(G, variant) {
  if (SXS.mats[variant]) return SXS.mats[variant]
  var body = SXS.body.material.clone()
  body.color.multiply(new lt.Color(SXS_TUNE.tint[variant] || 0xffffff))
  var visor = null
  var vc = SXS_TUNE.visor[variant] || 0xff3c1c
  try { visor = G.mats.emissive(vc, 6) } catch (e) { }
  if (!visor) visor = new lt.MeshBasicMaterial({ color: vc })
  return (SXS.mats[variant] = { body: body, visor: visor })
}

// rifles in the soldier's hands: local -Z forward, butt at +Z;
// grip = right hand, fore = left hand
function SXS_gunDef(G, variant) {
  if (SXS.guns[variant]) return SXS.guns[variant]
  var dark = [], metal = []
  var box = function (arr, w, h, d, x, y, z, rx) {
    var g = Wi(w, h, d, Math.min(w, h, d) * 0.2)
    if (rx) g.rotateX(rx)
    arr.push(g.translate(x, y, z))
  }
  var tube = function (arr, r, len, zFront, y, x) { arr.push(new lt.CylinderGeometry(r, r, len, 10).rotateX(Math.PI / 2).translate(x || 0, y, zFront + len / 2)) }
  var def
  if (variant === 'heavy') {
    box(dark, 0.08, 0.11, 0.5, 0, 0, -0.08)          // receiver
    box(dark, 0.06, 0.09, 0.24, 0, -0.012, 0.29)     // stock
    box(metal, 0.07, 0.072, 0.26, 0, 0.004, -0.44)   // barrel shroud
    tube(metal, 0.017, 0.26, -0.83, 0.004)           // barrel
    box(dark, 0.12, 0.13, 0.13, 0.02, -0.115, -0.12) // box magazine
    box(dark, 0.036, 0.1, 0.046, 0, -0.085, 0.07, 0.25)
    box(metal, 0.014, 0.17, 0.014, 0.03, -0.09, -0.56, -0.5) // bipod
    box(metal, 0.014, 0.17, 0.014, -0.03, -0.09, -0.56, -0.5)
    box(dark, 0.035, 0.05, 0.12, 0, 0.08, -0.02)     // carry handle
    def = { butt: 0.41, grip: [0.01, -0.07, 0.07], fore: [0, -0.05, -0.38], muzzle: [0, 0.004, -0.84] }
  } else if (variant === 'marksman') {
    box(dark, 0.06, 0.09, 0.46, 0, 0, -0.04)
    box(dark, 0.056, 0.1, 0.27, 0, -0.016, 0.31)
    box(dark, 0.06, 0.062, 0.32, 0, -0.004, -0.42)
    tube(metal, 0.011, 0.42, -0.99, 0.006)
    tube(metal, 0.02, 0.06, -1.03, 0.006)            // brake
    box(dark, 0.034, 0.1, 0.07, 0, -0.1, -0.1, -0.15)
    box(dark, 0.036, 0.1, 0.046, 0, -0.085, 0.07, 0.25)
    tube(metal, 0.024, 0.32, -0.22, 0.09)            // scope
    tube(metal, 0.032, 0.07, -0.28, 0.09)            // objective bell
    box(metal, 0.02, 0.05, 0.02, 0, 0.055, -0.15)
    box(metal, 0.02, 0.05, 0.02, 0, 0.055, 0.02)
    def = { butt: 0.445, grip: [0.01, -0.07, 0.07], fore: [0, -0.045, -0.4], muzzle: [0, 0.006, -1.05] }
  } else {
    box(dark, 0.06, 0.09, 0.4, 0, 0, -0.05)
    box(dark, 0.05, 0.085, 0.22, 0, -0.015, 0.25)
    box(dark, 0.058, 0.066, 0.24, 0, -0.004, -0.36)
    tube(metal, 0.011, 0.2, -0.68, 0.006)
    box(dark, 0.034, 0.15, 0.07, 0, -0.11, -0.11, -0.22) // magazine
    box(dark, 0.036, 0.1, 0.046, 0, -0.085, 0.06, 0.25)
    box(metal, 0.036, 0.048, 0.085, 0, 0.07, -0.06)      // optic
    def = { butt: 0.36, grip: [0.01, -0.07, 0.06], fore: [0, -0.046, -0.34], muzzle: [0, 0.006, -0.68] }
  }
  var merge = function (arr) {
    var list = arr.map(function (g) {
      Object.keys(g.attributes).forEach(function (k) { if (k !== 'position' && k !== 'normal') g.deleteAttribute(k) })
      return g.index ? g.toNonIndexed() : g
    })
    return Ii(list)
  }
  var get = function (n, c) { try { return G.mats.get(n) } catch (e) { return new lt.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.5 }) } }
  def.geoDark = merge(dark)
  def.geoMetal = merge(metal)
  def.matDark = new lt.MeshStandardMaterial({ color: 0x24272a, roughness: 0.62, metalness: 0.25 })
  def.matMetal = get('gunmetal', 0x3a3d40)
  return (SXS.guns[variant] = def)
}

function SXS_make(G, variant, scale, gunVariant) {
  var V3 = lt.Vector3, Q4 = lt.Quaternion
  var T = SXS_TUNE
  var root = SXS_clone(SXS.scene)
  var mats = SXS_mats(G, variant)
  root.traverse(function (o) {
    if (!o.isSkinnedMesh) return
    var visor = /visor/i.test(o.name)
    o.material = visor ? mats.visor : mats.body
    o.castShadow = !visor
    o.receiveShadow = true
    o.boundingSphere = SXS.sphere
  })
  var holder = new lt.Group()
  holder.rotation.y = SXS.face
  holder.add(root)

  var B = {}
  ;['Hips', 'Spine', 'Spine2', 'Head', 'Neck', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftHandMiddle1', 'RightHandMiddle1'].forEach(function (n) { B[n] = root.getObjectByName('mixamorig' + n) })

  var mixer = new lt.AnimationMixer(root)
  var act = { idle: mixer.clipAction(SXS.clips.Idle), walk: mixer.clipAction(SXS.clips.Walk), run: mixer.clipAction(SXS.clips.Run) }
  var W = { idle: 1, walk: 0, run: 0 }
  Object.keys(act).forEach(function (k) {
    var a = act[k]
    a.play()
    a.setEffectiveWeight(W[k])
    a.time = Math.random() * a.getClip().duration
  })

  // the rifle
  var gd = SXS_gunDef(G, gunVariant || variant)
  var gun = new lt.Group()
  var gm1 = new lt.Mesh(gd.geoDark, gd.matDark), gm2 = new lt.Mesh(gd.geoMetal, gd.matMetal)
  gm1.castShadow = gm2.castShadow = true
  gun.add(gm1, gm2)
  gun.scale.setScalar(scale)
  G.scene.add(gun)
  var dropped = false

  // scratch
  var _p = new V3(), _s = new V3(), _a = new V3(), _b = new V3(), _d1 = new V3(), _d2 = new V3()
  var _qa = new Q4(), _qb = new Q4(), _qw = new Q4(), _e = new lt.Euler()
  var UP = new V3(0, 1, 0), fwd = new V3(), right = new V3(), gunQ = new Q4(), gunPos = new V3(), anchor = new V3()
  var fL = new V3(), fR = new V3(), tL = new V3(), tR = new V3(), mid = new V3(), end = new V3(), pole = new V3()
  var footQL = new Q4(), footQR = new Q4(), wrist = new V3(), tgt = new V3()
  var st = { legs: 0, aimW: 0, back: false }
  // world joints, refreshed every pose (hits, head, LOS)
  var J = {}
  ;['head', 'neck', 'hips', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR'].forEach(function (n) { J[n] = new V3() })

  function wpos(o, out) { return out.setFromMatrixPosition(o.matrixWorld) }
  function wquat(o, out) { o.matrixWorld.decompose(_p, out, _s); return out }
  // rotate a bone by a world-space rotation about its own pivot
  function rotWorld(bone, qw) {
    wquat(bone.parent, _qa)
    _qb.copy(_qa).invert().multiply(qw).multiply(_qa)
    bone.quaternion.premultiply(_qb)
  }
  function setWorldQuat(bone, qw) {
    wquat(bone.parent, _qa)
    bone.quaternion.copy(_qa.invert().multiply(qw))
  }
  // turn `bone` so that `child` lies toward `target`
  function aimBone(bone, child, target) {
    wpos(bone, _a); wpos(child, _b)
    _d1.subVectors(_b, _a).normalize()
    _d2.subVectors(target, _a)
    if (_d2.lengthSq() < 1e-8) return
    _d2.normalize()
    _qw.setFromUnitVectors(_d1, _d2)
    rotWorld(bone, _qw)
    bone.updateMatrixWorld(true)
  }
  function limb(a, b, c, target, poleDir) {
    wpos(a, _a); wpos(b, _b)
    var l1 = _a.distanceTo(_b)
    var l2 = _b.distanceTo(wpos(c, _p))
    var sh = _s.copy(_a)
    SXT_ik(sh, target, l1, l2, poleDir, mid, end)
    aimBone(a, b, mid)
    aimBone(b, c, end)
  }

  // AnimationMixer only writes a bone when its blended value differs from the
  // previous update, so the overrides below would stack on any bone a clip
  // holds still (and on all of them once the pose is frozen at death). Keep
  // the clean clip pose of every overridden bone and put it back before each
  // mixer update.
  var OVR = ['Hips', 'Spine', 'Spine2', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'].map(function (n) { return { b: B[n], p: new V3(), q: new Q4() } })
  var haveClip = false
  function restoreClip() {
    if (!haveClip) return
    for (var i = 0; i < OVR.length; i++) { OVR[i].b.position.copy(OVR[i].p); OVR[i].b.quaternion.copy(OVR[i].q) }
  }
  function saveClip() {
    for (var i = 0; i < OVR.length; i++) { OVR[i].p.copy(OVR[i].b.position); OVR[i].q.copy(OVR[i].b.quaternion) }
    haveClip = true
  }

  var skipN = 0, owed = 0
  function update(dt, s) {
    var alive = s.alive
    // far away (s.far): clip + IK every other frame; a skipped frame keeps
    // last frame's posed bones
    if (s.far && alive && (skipN++ & 1) === 0) { owed += dt; return }
    dt += owed; owed = 0
    restoreClip()
    // --- clip blend from ground speed (m/s in model scale)
    var sp = Math.hypot(s.vx, s.vz) / scale
    var mv = sp > 0.35 ? SXT_wrap(Math.atan2(-s.vx, -s.vz) - s.yaw) : 0
    var back = Math.abs(mv) > 1.95
    if (back) mv = SXT_wrap(mv + Math.PI)
    if (alive) {
      var t1 = Math.min(1, sp / 1.1), t2 = Math.max(0, Math.min(1, (sp - 2.1) / 1.4))
      var k = Math.min(1, dt * 8)
      W.idle += ((1 - t1) - W.idle) * k
      W.walk += (t1 * (1 - t2) - W.walk) * k
      W.run += (t1 * t2 - W.run) * k
      var sum = W.idle + W.walk + W.run || 1
      act.idle.setEffectiveWeight(W.idle / sum)
      act.walk.setEffectiveWeight(W.walk / sum)
      act.run.setEffectiveWeight(W.run / sum)
      var dir = back ? -1 : 1
      act.walk.timeScale = dir * Math.max(0.55, Math.min(1.7, sp / T.walkNat))
      act.run.timeScale = dir * Math.max(0.65, Math.min(1.35, sp / T.runNat))
      mixer.update(dt)
      st.legs += (Math.max(-1.05, Math.min(1.05, mv)) - st.legs) * Math.min(1, dt * 7)
      var wantAim = s.aim
      st.aimW += (wantAim - st.aimW) * Math.min(1, dt * (wantAim > st.aimW ? 6 : 2.5))
    } else {
      st.legs *= Math.exp(-dt * 3) // clip frozen at the moment of death
    }
    saveClip()
    s.group.updateMatrixWorld(true)

    var H = B.Hips
    // --- hips toward the move direction, spine back to the aim
    var aimYaw = alive ? Math.max(-0.9, Math.min(0.9, s.aimYaw)) * st.aimW : 0
    if (Math.abs(st.legs) > 0.002) { _qw.setFromAxisAngle(UP, st.legs); rotWorld(H, _qw); H.updateMatrixWorld(true) }
    // feet where the clip put them (after the hip turn), then onto the ground
    wpos(B.LeftFoot, fL); wpos(B.RightFoot, fR)
    wquat(B.LeftFoot, footQL); wquat(B.RightFoot, footQR)
    var gL = 0, gR = 0
    if (s.groundY) {
      gL = Math.max(-0.35, Math.min(0.35, s.groundY(fL.x, fL.z) - s.y))
      gR = Math.max(-0.35, Math.min(0.35, s.groundY(fR.x, fR.z) - s.y))
    }
    var drop = s.crouch * T.crouchDrop * scale + Math.max(0, -Math.min(gL, gR))
    tL.copy(fL); tL.y += gL
    tR.copy(fR); tR.y += gR
    // peeking: hips slide a little toward the lean (the feet stay planted)
    var leanV = alive ? (s.lean || 0) : 0
    if (drop > 0.002 || Math.abs(leanV) > 0.01) {
      wpos(H, _a); _a.y -= drop
      _a.x += Math.cos(s.yaw) * leanV * 0.1 * scale; _a.z -= Math.sin(s.yaw) * leanV * 0.1 * scale
      H.parent.worldToLocal(_a)
      H.position.copy(_a)
      H.updateMatrixWorld(true)
    }
    // spine: undo the hip turn, add the aim twist, lean with the pitch / flinch
    var yawA = s.yaw + aimYaw
    var pitch = alive ? (s.aimPitch * st.aimW) : 0
    var lean = (alive ? -s.flinch * 0.35 - s.recoil * 0.05 : 0) + s.crouch * 0.12
    fwd.set(-Math.sin(yawA), 0, -Math.cos(yawA))
    right.set(Math.cos(yawA), 0, -Math.sin(yawA))
    _qw.setFromAxisAngle(UP, -st.legs + aimYaw * 0.6)
    _qb.setFromAxisAngle(right, (pitch * 0.45 - lean) * 0.5)
    _qw.premultiply(_qb)
    rotWorld(B.Spine, _qw); B.Spine.updateMatrixWorld(true)
    _qw.setFromAxisAngle(UP, aimYaw * 0.4)
    _qb.setFromAxisAngle(right, (pitch * 0.45 - lean) * 0.5)
    _qw.premultiply(_qb)
    rotWorld(B.Spine2, _qw); B.Spine2.updateMatrixWorld(true)
    // peeking (online players' lean, view/view.js): the upper body rolls to that side
    if (Math.abs(leanV) > 0.01) {
      _qw.setFromAxisAngle(fwd, leanV * 0.42); rotWorld(B.Spine, _qw); B.Spine.updateMatrixWorld(true)
      _qw.setFromAxisAngle(fwd, leanV * 0.2); rotWorld(B.Spine2, _qw); B.Spine2.updateMatrixWorld(true)
    }

    // --- legs: crouch + slope
    if (drop > 0.002 || Math.abs(gL) > 0.01 || Math.abs(gR) > 0.01 || Math.abs(leanV) > 0.01) {
      var la = s.yaw + st.legs
      pole.set(-Math.sin(la), 0.15, -Math.cos(la))
      limb(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, tL, pole)
      setWorldQuat(B.LeftFoot, footQL); B.LeftFoot.updateMatrixWorld(true)
      limb(B.RightUpLeg, B.RightLeg, B.RightFoot, tR, pole)
      setWorldQuat(B.RightFoot, footQR); B.RightFoot.updateMatrixWorld(true)
    }

    // --- rifle + arms
    if (!dropped) {
      if (!alive) {
        // let go: the rifle stays with the right hand as the body falls
        B.RightHand.attach(gun)
        dropped = true
      } else {
        var aw = st.aimW
        var gy = s.yaw + (aimYaw + (1 - aw) * T.lowReadyYaw)
        var gp = aw * (Math.max(-0.95, Math.min(0.95, s.aimPitch)) + s.recoil * 0.1 - s.flinch * 0.12) + (1 - aw) * T.lowReadyPitch
        _e.set(gp, gy, (1 - aw) * 0.35, 'YXZ')
        gunQ.setFromEuler(_e)
        // butt in the right shoulder pocket
        wpos(B.RightArm, _a); wpos(B.LeftArm, _b)
        anchor.lerpVectors(_b, _a, 0.72)
        anchor.addScaledVector(fwd, 0.07 * scale)
        anchor.y -= (0.035 + (1 - aw) * 0.1) * scale
        gunPos.set(0, 0, gd.butt * scale).applyQuaternion(gunQ)
        gunPos.subVectors(anchor, gunPos)
        gunPos.addScaledVector(_d1.set(0, 0, 1).applyQuaternion(gunQ), s.recoil * 0.035 * scale)
        gun.position.copy(gunPos)
        gun.quaternion.copy(gunQ)
        gun.updateMatrixWorld(true)
        // right wrist a little behind/below the pistol grip, left under the handguard
        wrist.set(gd.grip[0] + 0.02, gd.grip[1] - 0.02, gd.grip[2] + 0.07)
        gun.localToWorld(wrist)
        pole.copy(right).multiplyScalar(0.9).addScaledVector(UP, -1).addScaledVector(fwd, -0.3)
        limb(B.RightArm, B.RightForeArm, B.RightHand, wrist, pole)
        wrist.set(gd.fore[0] - 0.035, gd.fore[1] - 0.035, gd.fore[2] + 0.06)
        gun.localToWorld(wrist)
        pole.copy(right).multiplyScalar(-0.35).addScaledVector(UP, -1).addScaledVector(fwd, -0.15)
        limb(B.LeftArm, B.LeftForeArm, B.LeftHand, wrist, pole)
        // hands along the rifle
        handTo(B.RightHand, B.RightHandMiddle1, gd.grip)
        handTo(B.LeftHand, B.LeftHandMiddle1, gd.fore)
        // head: look down the sights
        _qw.setFromAxisAngle(right, pitch * 0.3)
        rotWorld(B.Head, _qw); B.Head.updateMatrixWorld(true)
      }
    }

    // --- joints for hits / LOS
    wpos(B.Head, J.head); J.head.y += 0.1 * scale
    wpos(B.Neck, J.neck); wpos(H, J.hips)
    wpos(B.LeftArm, J.shL); wpos(B.LeftForeArm, J.elL); wpos(B.LeftHand, J.wrL)
    wpos(B.RightArm, J.shR); wpos(B.RightForeArm, J.elR); wpos(B.RightHand, J.wrR)
    wpos(B.LeftUpLeg, J.hipL); wpos(B.LeftLeg, J.knL); wpos(B.LeftFoot, J.anL)
    wpos(B.RightUpLeg, J.hipR); wpos(B.RightLeg, J.knR); wpos(B.RightFoot, J.anR)
  }
  // point the hand (wrist → fingers) at the grip point on the rifle
  function handTo(hand, c, local) {
    if (!c) return
    tgt.set(local[0], local[1], local[2])
    gun.localToWorld(tgt)
    wpos(hand, _a); wpos(c, _b)
    _d1.subVectors(_b, _a).normalize()
    _d2.subVectors(tgt, _a)
    if (_d2.lengthSq() < 1e-6) return
    _d2.normalize()
    _qw.setFromUnitVectors(_d1, _d2)
    rotWorld(hand, _qw)
    hand.updateMatrixWorld(true)
  }

  var hA = new V3(), hB = new V3()
  function raycast(o, d, max) {
    var best = -1, part = 'body'
    var t = SXT_sphere(o, d, J.head, 0.15 * scale, max)
    if (t >= 0) { best = t; part = 'weak' }
    hB.copy(J.neck).lerp(J.hips, 0.12)
    t = SXT_segRay(o, d, J.hips, hB, 0.21 * scale, best >= 0 ? best : max)
    if (t >= 0 && (best < 0 || t < best)) { best = t; part = 'body' }
    var segs = [['hipL', 'knL', 0.1], ['knL', 'anL', 0.08], ['hipR', 'knR', 0.1], ['knR', 'anR', 0.08], ['shL', 'elL', 0.07], ['elL', 'wrL', 0.06], ['shR', 'elR', 0.07], ['elR', 'wrR', 0.06]]
    for (var k = 0; k < segs.length; k++) {
      t = SXT_segRay(o, d, J[segs[k][0]], J[segs[k][1]], segs[k][2] * scale, best >= 0 ? best : max)
      if (t >= 0 && (best < 0 || t < best)) { best = t; part = 'limb' }
    }
    if (best < 0) return null
    return { dist: best, point: o.clone().addScaledVector(d, best), normal: d.clone().negate(), part: part }
  }
  var mz = new V3()
  return {
    holder: holder, root: root, bones: B, joints: J, mixer: mixer, gun: gun, state: st,
    update: update, raycast: raycast,
    head: function (out) { return out.copy(J.head) },
    muzzle: function (out) { return gun.localToWorld(out.set(gd.muzzle[0], gd.muzzle[1], gd.muzzle[2])) },
    dispose: function () { if (gun.parent) gun.parent.remove(gun); mixer.stopAllAction(); mixer.uncacheRoot(root) },
    // swap the rifle in its hands (online players switching weapons)
    setGun: function (gv) { var d2 = SXS_gunDef(G, gv); if (d2 === gd) return; gd = d2; gm1.geometry = gd.geoDark; gm2.geometry = gd.geoMetal },
  }
}
