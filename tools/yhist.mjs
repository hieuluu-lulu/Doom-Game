import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
// world-space y of every vertex via node world matrices
const ys = []
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue
  const M = node.getWorldMatrix()
  for (const p of mesh.listPrimitives()) {
    const a = p.getAttribute('POSITION'), v = [0, 0, 0]
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); const y = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13]; ys.push(y) }
  }
}
ys.sort((a, b) => a - b)
const lo = ys[0], hi = ys[ys.length - 1], B = 24, h = new Array(B).fill(0)
ys.forEach(y => h[Math.min(B - 1, Math.floor((y - lo) / (hi - lo) * B))]++)
console.log('y', lo.toFixed(2), hi.toFixed(2)); h.forEach((n, k) => console.log((lo + (hi - lo) * k / B).toFixed(2), n))
