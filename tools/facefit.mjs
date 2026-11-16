import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const X0 = -352.3, X1 = 299.1, Z0 = -157.1, Z1 = 133.3, TOP = 452.8
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue
  const M = node.getWorldMatrix()
  for (const p of mesh.listPrimitives()) {
    if (!/^Material$/.test(p.getMaterial().getName())) continue
    const P = p.getAttribute('POSITION'), U = p.getAttribute('TEXCOORD_0'), I = p.getIndices()
    const v = [0, 0, 0], u = [0, 0], W = (i) => { P.getElement(i, v); return [M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12], M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13], M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]] }
    const UV = (i) => { U.getElement(i, u); return [u[0], u[1]] }
    const n = I ? I.getCount() : P.getCount(), idx = (k) => I ? I.getScalar(k) : k
    const cat = { front: [], back: [], west: [], east: [], roof: [], inset: [], out: [] }
    for (let t = 0; t < n; t += 3) {
      const a = [idx(t), idx(t + 1), idx(t + 2)], ps = a.map(W)
      const all = (f) => ps.every(f)
      const e = 1.5
      let c
      if (all(q => Math.abs(q[2] - Z1) < e)) c = 'front'
      else if (all(q => Math.abs(q[2] - Z0) < e)) c = 'back'
      else if (all(q => Math.abs(q[0] - X0) < e)) c = 'west'
      else if (all(q => Math.abs(q[0] - X1) < e)) c = 'east'
      else if (ps.some(q => q[0] < X0 - e || q[0] > X1 + e || q[2] < Z0 - e || q[2] > Z1 + e)) c = 'out'
      else if (all(q => q[1] > 400)) c = 'roof'
      else c = 'inset'
      cat[c].push(a.map(i => [W(i), UV(i)]))
    }
    for (const k in cat) {
      const tr = cat[k]; if (!tr.length) { console.log(k, 0); continue }
      const pts = tr.flat()
      const mn = [0,1,2].map(j => Math.min(...pts.map(q => q[0][j])).toFixed(0)), mx = [0,1,2].map(j => Math.max(...pts.map(q => q[0][j])).toFixed(0))
      const umn = [0,1].map(j => Math.min(...pts.map(q => q[1][j])).toFixed(3)), umx = [0,1].map(j => Math.max(...pts.map(q => q[1][j])).toFixed(3))
      console.log(k, tr.length, 'pos', mn.join(','), '→', mx.join(','), 'uv', umn.join(','), '→', umx.join(','))
    }
    // affine fit per facade: uv = a*w + b*y + c (w = along-face coord)
    for (const k of ['front', 'back', 'west', 'east']) {
      const pts = cat[k].flat(); if (pts.length < 3) continue
      const wOf = q => (k === 'front' || k === 'back') ? q[0][0] : q[0][2]
      // least squares 3x3
      const fit = (ci) => {
        let S = [[0,0,0],[0,0,0],[0,0,0]], b = [0,0,0]
        for (const q of pts) { const r = [wOf(q), q[0][1], 1]; for (let i = 0; i < 3; i++) { b[i] += r[i] * q[1][ci]; for (let j = 0; j < 3; j++) S[i][j] += r[i] * r[j] } }
        // solve
        const A = S.map((row, i) => row.concat([b[i]]))
        for (let i = 0; i < 3; i++) { let piv = i; for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r; [A[i], A[piv]] = [A[piv], A[i]]; for (let r = 0; r < 3; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c] } }
        return [0,1,2].map(i => A[i][3] / A[i][i])
      }
      const fu = fit(0), fv = fit(1)
      let err = 0; for (const q of pts) { const w = wOf(q), y = q[0][1]; err = Math.max(err, Math.abs(fu[0]*w+fu[1]*y+fu[2]-q[1][0]), Math.abs(fv[0]*w+fv[1]*y+fv[2]-q[1][1])) }
      console.log('fit', k, 'u=', fu.map(x => x.toExponential(4)).join(' '), 'v=', fv.map(x => x.toExponential(4)).join(' '), 'maxErr', err.toFixed(4))
    }
  }
}
