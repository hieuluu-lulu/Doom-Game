// ============================================================================
// DoomZone mod — PERF: cheap wins that keep the frame time flat.
//
// The stock renderer already adapts on its own (Quality "auto", the default):
// a frame over ~21 ms lowers the render scale (down to 0.6), and if it is
// still slow there the preset steps ultra → high → medium → low; it climbs
// back when there is headroom. This file trims what the mod itself adds:
//   * pickups: the model is drawn only within SXP_TUNE.pickupR of the camera
//     (the light beacon stays, so items are still spotted from afar) and never
//     casts a shadow;
//   * tiny parts (world radius < SXP_TUNE.casterR) stop casting shadows —
//     invisible in the shadow map, but each one is a draw call in the shadow
//     pass;
//   * the work runs a few times a second, never every frame, and allocates
//     nothing in the loop.
// ============================================================================

var SXP_TUNE = { pickupR: 35, scopePickupR: 160, casterR: 0.3, scanEvery: 2.0, lodEvery: 0.2 }
var SXP = { G: null, stats: { pruned: 0 } }

function SXP_pruneCasters(G) {
  var s = new lt.Vector3(), cam = G.camera, n = 0
  G.scene.traverse(function (o) {
    if (!o.isMesh || o.__sxpSeen) return
    o.__sxpSeen = true
    if (!o.castShadow || o.isSkinnedMesh) return
    // the first-person gun and hands live under the camera: leave them alone
    for (var p = o.parent; p; p = p.parent) if (p === cam) return
    var g = o.geometry
    if (!g) return
    if (!g.boundingSphere) g.computeBoundingSphere()
    if (!g.boundingSphere) return
    o.getWorldScale(s)
    var r = g.boundingSphere.radius * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z))
    if (r < SXP_TUNE.casterR) { o.castShadow = false; n++ }
  })
  SXP.stats.pruned += n
  // a changed caster set needs one fresh shadow map
  if (n && G.render && G.render.renderer) try { G.render.renderer.shadowMap.needsUpdate = true } catch (e) { }
}

// One pickup model = often several meshes sharing a material (a world gun is
// 8–12 parts, a backpack 12–15): bake them into one mesh per material, once
// per model (the merged geometry is cached and shared by every copy).
var SXP_mergeCache = {}
var SXP_mm = new lt.Matrix4(), SXP_inv = new lt.Matrix4(), SXP_nm = new lt.Matrix3(), SXP_v = new lt.Vector3()
function SXP_mergeModel(model) {
  model.updateMatrixWorld(true)
  SXP_inv.copy(model.matrixWorld).invert()
  var groups = new Map()
  model.traverse(function (o) {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.geometry || !o.geometry.attributes.position) return
    var g = groups.get(o.material)
    if (!g) groups.set(o.material, g = [])
    g.push(o)
  })
  groups.forEach(function (meshes, mat) {
    if (meshes.length < 2) return
    var names = Object.keys(meshes[0].geometry.attributes).filter(function (n) { return n === 'position' || n === 'normal' || n === 'uv' || n === 'color' }).sort().join(',')
    if (meshes.some(function (m) { return Object.keys(m.geometry.attributes).filter(function (n) { return n === 'position' || n === 'normal' || n === 'uv' || n === 'color' }).sort().join(',') !== names })) return
    var key = mat.uuid + '|' + meshes.map(function (m) {
      SXP_mm.multiplyMatrices(SXP_inv, m.matrixWorld)
      return m.geometry.uuid + ':' + SXP_mm.elements.map(function (e) { return e.toFixed(4) }).join(',')
    }).join('|')
    var geo = SXP_mergeCache[key]
    if (!geo) {
      var nv = 0, ni = 0
      meshes.forEach(function (m) { var g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count })
      var hasN = names.indexOf('normal') >= 0, hasUV = names.indexOf('uv') >= 0, hasC = names.indexOf('color') >= 0
      var P = new Float32Array(nv * 3), N = hasN ? new Float32Array(nv * 3) : null, UV = hasUV ? new Float32Array(nv * 2) : null
      var C = hasC ? new Float32Array(nv * meshes[0].geometry.attributes.color.itemSize) : null, cs = hasC ? meshes[0].geometry.attributes.color.itemSize : 0
      var I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), vo = 0, io2 = 0
      meshes.forEach(function (m) {
        var g = m.geometry, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color
        SXP_mm.multiplyMatrices(SXP_inv, m.matrixWorld)
        SXP_nm.getNormalMatrix(SXP_mm)
        for (var k = 0; k < pa.count; k++) {
          SXP_v.set(pa.getX(k), pa.getY(k), pa.getZ(k)).applyMatrix4(SXP_mm)
          P[(vo + k) * 3] = SXP_v.x; P[(vo + k) * 3 + 1] = SXP_v.y; P[(vo + k) * 3 + 2] = SXP_v.z
          if (N) { SXP_v.set(na.getX(k), na.getY(k), na.getZ(k)).applyMatrix3(SXP_nm).normalize(); N[(vo + k) * 3] = SXP_v.x; N[(vo + k) * 3 + 1] = SXP_v.y; N[(vo + k) * 3 + 2] = SXP_v.z }
          if (UV) { UV[(vo + k) * 2] = ua.getX(k); UV[(vo + k) * 2 + 1] = ua.getY(k) }
          if (C) for (var c = 0; c < cs; c++) C[(vo + k) * cs + c] = ca.getComponent(k, c)
        }
        if (g.index) for (var j = 0; j < g.index.count; j++) I[io2 + j] = g.index.getX(j) + vo
        else for (var j2 = 0; j2 < pa.count; j2++) I[io2 + j2] = j2 + vo
        io2 += g.index ? g.index.count : pa.count
        vo += pa.count
      })
      geo = new lt.BufferGeometry()
      geo.setAttribute('position', new lt.BufferAttribute(P, 3))
      if (N) geo.setAttribute('normal', new lt.BufferAttribute(N, 3))
      if (UV) geo.setAttribute('uv', new lt.BufferAttribute(UV, 2))
      if (C) geo.setAttribute('color', new lt.BufferAttribute(C, cs))
      geo.setIndex(new lt.BufferAttribute(I, 1))
      geo.computeBoundingSphere()
      SXP_mergeCache[key] = geo
    }
    var mesh = new lt.Mesh(geo, mat)
    mesh.castShadow = false
    mesh.receiveShadow = meshes[0].receiveShadow
    mesh.layers.mask = meshes[0].layers.mask
    mesh.__sxpSeen = true
    meshes.forEach(function (m) { m.parent && m.parent.remove(m) })
    model.add(mesh)
    SXP.stats.merged = (SXP.stats.merged || 0) + meshes.length - 1
  })
}

function SXP_pickupLod(G) {
  var A = G.weapon && G.weapon.arsenal
  if (!A || !A.pickups) return
  var list = A.pickups(), cam = G.camera.position
  // looking through a scope: items further out stay visible
  var zoomed = G.weapon.ads > 0.5 && G.camera.fov < 40
  var R = zoomed ? SXP_TUNE.scopePickupR : SXP_TUNE.pickupR, R2 = R * R
  for (var k = 0; k < list.length; k++) {
    var p = list[k], m = p.model
    if (!m || !p.active) continue
    if (!m.__sxpShadow) {
      m.__sxpShadow = true
      m.traverse(function (o) { if (o.isMesh) o.castShadow = false })
      try { SXP_mergeModel(m) } catch (e) { if (!SXP.mergeErr) { SXP.mergeErr = 1; console.warn('[perf] merge', e) } }
    }
    var h = p.holder.position, dx = h.x - cam.x, dy = h.y - cam.y, dz = h.z - cam.z
    var on = dx * dx + dy * dy + dz * dz < R2
    if (m.visible !== on) m.visible = on
  }
}

;(function SXP_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || !G.scene) { setTimeout(wait, 300); return }
    SXP.G = G
    window.__sxp = SXP // tests
    var scanT = 0.5, lodT = 0, last = performance.now()
    var loop = function () {
      var now = performance.now(), dt = Math.min(0.25, (now - last) / 1000)
      last = now
      var st = G.game && G.game.state
      if (st === 'playing') {
        scanT -= dt; lodT -= dt
        if (scanT <= 0) { scanT = SXP_TUNE.scanEvery; try { SXP_pruneCasters(G) } catch (e) { } }
        if (lodT <= 0) { lodT = SXP_TUNE.lodEvery; try { SXP_pickupLod(G) } catch (e) { } }
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }
  setTimeout(wait, 300)
})()
