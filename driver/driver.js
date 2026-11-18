// ============================================================================
// DoomZone mod — DRIVER: the player at the wheel of a car (Sandcat, Rhino).
//  * SXDR_wheel(M, ck): a steering wheel (rim, three spokes, hub, column) at
//    the cockpit's wheel point, tilted like the car's own; .spin turns about
//    the column. The cars hide their modelled wheel (Sandcat STIR) and use it.
//  * SXDR_make(G, ck, variant): the soldier model (troopers/lib/20_soldier.js)
//    sat on the seat: hips on the cushion, feet on the pedals, both hands on
//    the rim at ten-to-two turning with the wheel (two-bone IK, SXT_ik), the
//    head following the look. pose() runs every frame while it is shown;
//    first person shrinks the head away so the camera sits inside it.
// ck (the car spec's cockpit, body frame: front -Z, +Y up, metres):
//   hip [x,y,z] where the hips sit, wheel [x,y,z] rim centre, tilt (rad, how
//   far the column rises: 0 = upright wheel, π/2 = flat), r rim radius, feet [dx, y, z]
//   pedal points (±dx), eye [x,y,z] the first-person camera, ratio steering
//   wheel turns per rad of road-wheel steer.
// ============================================================================

var SXDR_TUNE = { lean: 0.12, headYaw: 1.2, headPitch: 0.7, grip: 0.98 }

function SXDR_wheel(M, ck) {
  var g = new lt.Group()
  g.name = 'sx-steering-wheel'
  g.position.set(ck.wheel[0], ck.wheel[1], ck.wheel[2])
  // the column rises toward the driver at `tilt` above horizontal: the rim's
  // face (+Z) points back and up, its top leans forward
  g.rotation.x = -ck.tilt
  var spin = new lt.Group()
  g.add(spin)
  var rubber = (M && (M.rubber || M.tyre)) || new lt.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 })
  var steel = (M && (M.steel || M.metal)) || new lt.MeshStandardMaterial({ color: 0x6d7072, roughness: 0.5, metalness: 0.7 })
  var r = ck.r
  var add = function (geo, mat) { var m = new lt.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; spin.add(m); return m }
  add(new lt.TorusGeometry(r, r * 0.12, 8, 28), rubber) // rim in the XY plane, axis +Z (toward the driver)
  add(new lt.CylinderGeometry(r * 0.2, r * 0.22, r * 0.25, 12).rotateX(Math.PI / 2), steel) // hub
  for (var k = 0; k < 3; k++) {
    var a = -Math.PI / 2 + (k * Math.PI * 2) / 3 // spokes at 6, 10 and 2 o'clock
    var sp = new lt.BoxGeometry(r * 0.9, r * 0.13, r * 0.06).translate(r * 0.5, 0, 0).rotateZ(a)
    add(sp, steel)
  }
  // the column, from the hub down into the dash
  var col = new lt.Mesh(new lt.CylinderGeometry(r * 0.09, r * 0.11, r * 2.2, 8).rotateX(Math.PI / 2).translate(0, 0, -r * 1.15), steel)
  col.castShadow = true
  g.add(col)
  g.userData.spin = spin
  return g
}

// world point on the rim: angle a (0 = 3 o'clock, CCW as the driver sees it)
function SXDR_rim(wheelG, r, a, out) {
  out.set(Math.cos(a) * r, Math.sin(a) * r, 0)
  return wheelG.userData.spin.localToWorld(out)
}

function SXDR_make(G, ck, variant) {
  if (typeof SXS === 'undefined' || !SXS.ready || typeof SXS_clone !== 'function') return null
  var V3 = lt.Vector3, Q4 = lt.Quaternion
  var root = SXS_clone(SXS.scene)
  var mats = SXS_mats(G, variant || 'net_blue')
  root.traverse(function (o) {
    if (!o.isSkinnedMesh) return
    var visor = /visor/i.test(o.name)
    o.material = visor ? mats.visor : mats.body
    o.castShadow = !visor
    o.receiveShadow = true
    o.boundingSphere = SXS.sphere
    o.frustumCulled = false // sits inside the car; the seat pose leaves the bind sphere
  })
  var holder = new lt.Group()
  holder.rotation.y = SXS.face
  holder.add(root)
  var group = new lt.Group()
  group.name = 'sx-driver'
  group.add(holder)
  group.visible = false

  var B = {}
  ;['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'].forEach(function (n) { B[n] = root.getObjectByName('mixamorig' + n) })
  // the clip's first frame as the base pose (arms down, standing)
  var mixer = new lt.AnimationMixer(root)
  var idle = mixer.clipAction(SXS.clips.Idle)
  idle.play()
  mixer.update(0)
  var OVR = Object.keys(B).filter(function (n) { return B[n] }).map(function (n) { return { b: B[n], p: B[n].position.clone(), q: B[n].quaternion.clone() } })

  var _p = new V3(), _s = new V3(), _a = new V3(), _b = new V3(), _d1 = new V3(), _d2 = new V3(), mid = new V3(), end = new V3()
  var _qa = new Q4(), _qb = new Q4(), _qw = new Q4(), _q2 = new Q4()
  var tL = new V3(), tR = new V3(), fL = new V3(), fR = new V3(), pole = new V3(), ax = new V3()
  function wpos(o, out) { return out.setFromMatrixPosition(o.matrixWorld) }
  function wquat(o, out) { o.matrixWorld.decompose(_p, out, _s); return out }
  function rotWorld(bone, qw) {
    wquat(bone.parent, _qa)
    _qb.copy(_qa).invert().multiply(qw).multiply(_qa)
    bone.quaternion.premultiply(_qb)
    bone.updateMatrixWorld(true)
  }
  function aimBone(bone, child, target) {
    wpos(bone, _a); wpos(child, _b)
    _d1.subVectors(_b, _a).normalize()
    _d2.subVectors(target, _a)
    if (_d2.lengthSq() < 1e-8) return
    _d2.normalize()
    _qw.setFromUnitVectors(_d1, _d2)
    rotWorld(bone, _qw)
  }
  function limb(a, b, c, target, poleDir) {
    wpos(a, _a); wpos(b, _b)
    var l1 = _a.distanceTo(_b), l2 = _b.distanceTo(wpos(c, _p))
    SXT_ik(_s.copy(_a), target, l1, l2, poleDir, mid, end)
    aimBone(a, b, mid)
    aimBone(b, c, end)
  }
  // body-frame direction → world (the car's rotation)
  function dirW(x, y, z, out) {
    group.parent.getWorldQuaternion(_q2)
    return out.set(x, y, z).applyQuaternion(_q2).normalize()
  }
  // sit the hips on the seat: measured once from the base pose
  var seated = false
  function seat() {
    holder.position.set(0, 0, 0)
    group.updateMatrixWorld(true)
    var hp = group.worldToLocal(wpos(B.Hips, new V3()))
    holder.position.set(ck.hip[0] - hp.x, ck.hip[1] - hp.y, ck.hip[2] - hp.z)
    seated = true
  }

  var api = {
    root: group,
    // steerA: the steering wheel's turn (rad, + = left); lookYaw / lookPitch:
    // the look relative to the car; fpv: hide the head
    pose: function (wheelG, steerA, lookYaw, lookPitch, fpv) {
      if (!group.parent) return
      if (!seated) seat()
      for (var i = 0; i < OVR.length; i++) { OVR[i].b.position.copy(OVR[i].p); OVR[i].b.quaternion.copy(OVR[i].q) }
      B.Head.scale.setScalar(1)
      group.updateMatrixWorld(true)
      // lean back into the seat a little
      if (B.Spine) rotWorld(B.Spine, _qw.setFromAxisAngle(dirW(1, 0, 0, ax), SXDR_TUNE.lean))
      // legs: knees up and forward, feet on the pedals
      var F = ck.feet
      group.localToWorld(fL.set(ck.hip[0] - F[0], F[1], F[2]))
      group.localToWorld(fR.set(ck.hip[0] + F[0], F[1], F[2]))
      dirW(0, 1, -0.6, pole)
      limb(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, fL, pole)
      limb(B.RightUpLeg, B.RightLeg, B.RightFoot, fR, pole)
      // hands at ten-to-two on the rim, turning with it
      var r = ck.r * SXDR_TUNE.grip
      SXDR_rim(wheelG, r, Math.PI * 5 / 6, tL)
      SXDR_rim(wheelG, r, Math.PI / 6, tR)
      limb(B.LeftArm, B.LeftForeArm, B.LeftHand, tL, dirW(-0.8, -1, 0.4, pole))
      limb(B.RightArm, B.RightForeArm, B.RightHand, tR, dirW(0.8, -1, 0.4, pole))
      // the head follows the look
      if (B.Head) {
        var y = Math.max(-SXDR_TUNE.headYaw, Math.min(SXDR_TUNE.headYaw, lookYaw || 0))
        var p = Math.max(-SXDR_TUNE.headPitch, Math.min(SXDR_TUNE.headPitch, lookPitch || 0))
        rotWorld(B.Head, _qw.setFromAxisAngle(dirW(0, 1, 0, ax), y))
        rotWorld(B.Head, _qw.setFromAxisAngle(dirW(Math.cos(y), 0, -Math.sin(y), ax), p))
        if (fpv) B.Head.scale.setScalar(0.001)
      }
    },
    show: function (on) { group.visible = !!on },
    dispose: function () { if (group.parent) group.parent.remove(group) },
  }
  return api
}

// the player's look for the driver: the team colour online, blue solo
function SXDR_variant() {
  try {
    if (typeof SXN !== 'undefined' && SXN.active && SXN.players && SXN.players[SXN.myId] && SXN.players[SXN.myId].team === 'red') return 'net_red'
  } catch (e) { }
  return 'net_blue'
}
