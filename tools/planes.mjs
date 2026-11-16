import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue
  const M = node.getWorldMatrix()
  for (const p of mesh.listPrimitives()) {
    if (!/^Material$/.test(p.getMaterial().getName())) continue
    const P = p.getAttribute('POSITION'), U = p.getAttribute('TEXCOORD_0'), I = p.getIndices()
    const v = [0, 0, 0], u = [0, 0]
    const W = (i) => { P.getElement(i, v); return [M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12], M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13], M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]] }
    const n = I.getCount(), groups = {}
    for (let t = 0; t < n; t += 3) {
      const a = [I.getScalar(t), I.getScalar(t + 1), I.getScalar(t + 2)], ps = a.map(W)
      const e1 = ps[1].map((x, k) => x - ps[0][k]), e2 = ps[2].map((x, k) => x - ps[0][k])
      const cr = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]], L = Math.hypot(...cr), area = L / 2
      if (L < 1e-6) continue
      const nn = cr.map(x => x / L)
      let key = null
      if (Math.abs(nn[2]) > 0.95) key = 'z' + (nn[2] > 0 ? '+' : '-') + Math.round(ps[0][2])
      else if (Math.abs(nn[0]) > 0.95) key = 'x' + (nn[0] > 0 ? '+' : '-') + Math.round(ps[0][0])
      else if (nn[1] > 0.95) key = 'y+' + Math.round(ps[0][1])
      else continue
      const g = groups[key] || (groups[key] = { area: 0, n: 0, umin: 9, umax: -9, vmin: 9, vmax: -9, ymin: 1e9, ymax: -1e9, wmin: 1e9, wmax: -1e9 })
      g.area += area; g.n++
      a.forEach((i, k) => { U.getElement(i, u); g.umin = Math.min(g.umin, u[0]); g.umax = Math.max(g.umax, u[0]); g.vmin = Math.min(g.vmin, u[1]); g.vmax = Math.max(g.vmax, u[1]); g.ymin = Math.min(g.ymin, ps[k][1]); g.ymax = Math.max(g.ymax, ps[k][1]); const w = key[0] === 'z' ? ps[k][0] : ps[k][2]; g.wmin = Math.min(g.wmin, w); g.wmax = Math.max(g.wmax, w) })
    }
    Object.entries(groups).sort((a, b) => b[1].area - a[1].area).slice(0, 18).forEach(([k, g]) => console.log(k.padEnd(8), 'area', Math.round(g.area), 'tris', g.n, 'w', Math.round(g.wmin), Math.round(g.wmax), 'y', Math.round(g.ymin), Math.round(g.ymax), 'uv', g.umin.toFixed(3), g.umax.toFixed(3), g.vmin.toFixed(3), g.vmax.toFixed(3)))
  }
}
