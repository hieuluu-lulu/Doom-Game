import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const pts = []
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh || node.getName() !== 'Object_3') continue
  const wm = node.getWorldMatrix()
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), v = [0, 0, 0]
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, v); pts.push([wm[0] * v[0] + wm[4] * v[1] + wm[8] * v[2] + wm[12], wm[1] * v[0] + wm[5] * v[1] + wm[9] * v[2] + wm[13], wm[2] * v[0] + wm[6] * v[1] + wm[10] * v[2] + wm[14]]) }
  }
}
// grid search the circle (yc, zc, r) that best explains the outermost tyre sidewall ring
for (const [z0, z1] of [[-1.35, -0.05], [-2.9, -1.7], [-4.45, -3.2]]) {
  const s = pts.filter(p => Math.abs(p[0]) > 0.86 && p[1] < 0.55 && p[2] > z0 && p[2] < z1)
  let best = null
  for (let yc = 0.3; yc <= 0.42; yc += 0.005) for (let zc = z0 + 0.3; zc <= z1 - 0.3; zc += 0.005) {
    const d = s.map(p => Math.hypot(p[1] - yc, p[2] - zc))
    const r = Math.max(...d)
    // the tyre sits on y=-0.113: r ≈ yc + 0.113
    const err = Math.abs(r - (yc + 0.113))
    const score = err + 0.001 * r
    if (!best || score < best.score) best = { yc: +yc.toFixed(3), zc: +zc.toFixed(3), r: +r.toFixed(3), err: +err.toFixed(4), score }
  }
  console.log(z0, z1, s.length, JSON.stringify(best))
}
