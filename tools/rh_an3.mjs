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
const yb = -0.113
for (const g of [-0.7, -2.3, -3.8]) {
  const band = pts.filter(p => Math.abs(p[0]) > 0.75 && p[1] > yb + 0.25 && p[1] < yb + 0.6 && Math.abs(p[2] - g) < 0.55)
  const zs = band.map(p => p[2]); const z0 = Math.min(...zs), z1 = Math.max(...zs)
  const R = (z1 - z0) / 2, zc = (z0 + z1) / 2
  const xs = pts.filter(p => Math.hypot(p[1] - (yb + R), p[2] - zc) < R && Math.abs(p[0]) > 0.5).map(p => Math.abs(p[0]))
  console.log('wheel', g, 'zc', zc.toFixed(3), 'R', R.toFixed(3), 'yc', (yb + R).toFixed(3), 'x', Math.min(...xs).toFixed(3), Math.max(...xs).toFixed(3))
}
// ring/shield: horizontal profile per y band
for (const [a, b] of [[1.75, 1.85], [1.85, 1.95], [1.95, 2.0], [2.0, 2.05], [2.05, 2.12], [2.12, 2.2], [2.2, 2.27]]) {
  const s = pts.filter(p => p[1] >= a && p[1] < b)
  const inner = s.filter(p => Math.abs(p[0]) < 0.56)
  const zs = inner.map(p => p[2]), xs = inner.map(p => p[0])
  console.log('y', a, b, 'n', s.length, 'inner', inner.length, 'x', Math.min(...xs).toFixed(2), Math.max(...xs).toFixed(2), 'z', Math.min(...zs).toFixed(2), Math.max(...zs).toFixed(2))
}
// the gun: narrow, top
const gun = pts.filter(p => p[1] > 2.12 && Math.abs(p[0]) < 0.2)
console.log('gun', gun.length, 'x', Math.min(...gun.map(p => p[0])).toFixed(3), Math.max(...gun.map(p => p[0])).toFixed(3), 'y', Math.min(...gun.map(p => p[1])).toFixed(3), Math.max(...gun.map(p => p[1])).toFixed(3), 'z', Math.min(...gun.map(p => p[2])).toFixed(3), Math.max(...gun.map(p => p[2])).toFixed(3))
