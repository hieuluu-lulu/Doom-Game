import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue
  const M = node.getWorldMatrix()
  for (const p of mesh.listPrimitives()) {
    const name = p.getMaterial() && p.getMaterial().getName()
    const a = p.getAttribute('POSITION'), v = [0, 0, 0], pts = []
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); pts.push([M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12], M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13], M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]]) }
    const mn = [0,1,2].map(k => Math.min(...pts.map(q => q[k]))), mx = [0,1,2].map(k => Math.max(...pts.map(q => q[k])))
    console.log('prim', name, a.getCount(), 'min', mn.map(n => n.toFixed(1)).join(','), 'max', mx.map(n => n.toFixed(1)).join(','))
    if (/glass/i.test(name)) {
      // cluster vertices into rects: group by quantized plane
      const key = q => [Math.round(q[0]), Math.round(q[1]), Math.round(q[2])]
      const ys = [...new Set(pts.map(q => Math.round(q[1] / 5) * 5))].sort((x, y) => x - y)
      const xs = [...new Set(pts.map(q => Math.round(q[0] / 5) * 5))].sort((x, y) => x - y)
      const zs = [...new Set(pts.map(q => Math.round(q[2] / 5) * 5))].sort((x, y) => x - y)
      console.log('glass ys', ys.join(' ')); console.log('glass xs', xs.join(' ')); console.log('glass zs', zs.join(' '))
    }
  }
}
