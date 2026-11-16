import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const root = doc.getRoot()
// world matrix: Sketchfab_model is a -90° X rotation: (x, y, z) → (x, z, -y)
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue
  const wm = node.getWorldMatrix()
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), n = P.getCount(), v = [0, 0, 0]
    const pts = []
    for (let i = 0; i < n; i++) {
      P.getElement(i, v)
      const x = wm[0] * v[0] + wm[4] * v[1] + wm[8] * v[2] + wm[12], y = wm[1] * v[0] + wm[5] * v[1] + wm[9] * v[2] + wm[13], z = wm[2] * v[0] + wm[6] * v[1] + wm[10] * v[2] + wm[14]
      pts.push([x, y, z])
    }
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
    pts.forEach(p => { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]) } })
    console.log(node.getName(), n, 'min', mn.map(a => a.toFixed(2)).join(','), 'max', mx.map(a => a.toFixed(2)).join(','))
    // low part: z histogram for |x| > 0.6 and y < 0.9
    const h = {}
    pts.forEach(p => { if (p[1] < 0.9 && Math.abs(p[0]) > 0.55) { const b = Math.round(p[2] * 10) / 10; h[b] = (h[b] || 0) + 1 } })
    console.log(' low z hist', Object.keys(h).map(Number).sort((a, b) => a - b).map(k => k + ':' + h[k]).join(' '))
    const hy = {}
    pts.forEach(p => { if (Math.abs(p[0]) > 0.55) { const b = Math.round(p[1] * 10) / 10; hy[b] = (hy[b] || 0) + 1 } })
    console.log(' y hist (|x|>.55)', Object.keys(hy).map(Number).sort((a, b) => a - b).map(k => k + ':' + hy[k]).join(' '))
    const hx = {}
    pts.forEach(p => { if (p[1] < 0.9) { const b = Math.round(p[0] * 10) / 10; hx[b] = (hx[b] || 0) + 1 } })
    console.log(' x hist (y<.9)', Object.keys(hx).map(Number).sort((a, b) => a - b).map(k => k + ':' + hx[k]).join(' '))
  }
}
