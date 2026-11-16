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
const st = (f) => { const s = pts.filter(f); const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; s.forEach(p => { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]) } }); return s.length + ' min ' + mn.map(a => a.toFixed(3)).join(',') + ' max ' + mx.map(a => a.toFixed(3)).join(',') }
for (const zc of [-0.7, -2.3, -3.8]) for (const sx of [-1, 1]) console.log('wheel', zc, sx, st(p => p[0] * sx > 0.62 && p[1] < 0.86 && Math.abs(p[2] - zc) < 0.55))
console.log('wheel x-depth', st(p => p[1] < 0.2 && Math.abs(p[2] + 0.7) < 0.3 && p[0] > 0))
console.log('top y>1.75', st(p => p[1] > 1.75))
console.log('top y>1.95', st(p => p[1] > 1.95))
console.log('gun y>2.05', st(p => p[1] > 2.05))
console.log('ring 1.8..2.05 |x|<.6', st(p => p[1] > 1.8 && p[1] < 2.05 && Math.abs(p[0]) < 0.6))
