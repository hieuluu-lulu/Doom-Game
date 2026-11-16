import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
function mul(m, p) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]] }
const st = new Map(), meshes = []
for (const n of doc.getRoot().listNodes()) { if (!n.getMesh()) continue; const W = n.getWorldMatrix()
  for (const p of n.getMesh().listPrimitives()) { const mat = p.getMaterial().getName(); const A = p.getAttribute('POSITION'), I = p.getIndices(); const c = I ? I.getCount() : A.getCount()
    const s = st.get(mat) || { tris: 0, mn: [1e9,1e9,1e9], mx: [-1e9,-1e9,-1e9], up: 0, area: 0 }; const mm = [1e9,1e9,1e9], mX = [-1e9,-1e9,-1e9]
    for (let t = 0; t < c; t += 3) { const v = [0,1,2].map(j => mul(W, A.getElement(I ? I.getScalar(t+j) : t+j, [])))
      const e1=[0,1,2].map(k=>v[1][k]-v[0][k]), e2=[0,1,2].map(k=>v[2][k]-v[0][k]); const nn=[e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]]; const ar = Math.hypot(...nn)/2
      s.tris++; s.area += ar; if (nn[1] > 0.9*Math.hypot(...nn)) s.up += ar
      v.forEach(q => { for (let k=0;k<3;k++){ s.mn[k]=Math.min(s.mn[k],q[k]); s.mx[k]=Math.max(s.mx[k],q[k]); mm[k]=Math.min(mm[k],q[k]); mX[k]=Math.max(mX[k],q[k]) } }) }
    st.set(mat, s); meshes.push([mat, mm.map(v=>v.toFixed(0)).join(','), mX.map(v=>v.toFixed(0)).join(','), c/3]) } }
for (const [m, s] of st) console.log(m, 'tris', s.tris, 'bbox', s.mn.map(v=>v.toFixed(0)).join(','), '→', s.mx.map(v=>v.toFixed(0)).join(','), 'upArea%', (100*s.up/s.area).toFixed(0))
if (process.argv[3]) meshes.filter(m => m[0] === process.argv[3]).slice(0, 60).forEach(m => console.log(m.join(' ')))
