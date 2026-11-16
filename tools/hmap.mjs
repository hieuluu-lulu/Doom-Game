// top-surface height map of a node's mesh (world coords): grid of max y of up-facing triangles
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const re = new RegExp(process.argv[3]), N = +(process.argv[4] || 16)
function mul(m, p) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]] }
for (const n of doc.getRoot().listNodes()) { if (!n.getMesh() || !re.test(n.getName())) continue
  const W = n.getWorldMatrix(); const tris = []; let mn=[1e9,1e9], mx=[-1e9,-1e9]
  for (const p of n.getMesh().listPrimitives()) { const A = p.getAttribute('POSITION'), I = p.getIndices(); const c = I ? I.getCount() : A.getCount()
    for (let t = 0; t < c; t += 3) { const v = [0,1,2].map(j => mul(W, A.getElement(I ? I.getScalar(t+j) : t+j, [])))
      const e1=[0,1,2].map(k=>v[1][k]-v[0][k]), e2=[0,1,2].map(k=>v[2][k]-v[0][k]); const nn=[e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]]
      if (Math.abs(nn[1]) < 0.8*Math.hypot(...nn)) continue
      tris.push(v); v.forEach(q=>{mn[0]=Math.min(mn[0],q[0]);mn[1]=Math.min(mn[1],q[2]);mx[0]=Math.max(mx[0],q[0]);mx[1]=Math.max(mx[1],q[2])}) } }
  console.log(n.getName(), 'x', mn[0].toFixed(0), mx[0].toFixed(0), 'z', mn[1].toFixed(0), mx[1].toFixed(0))
  const inside = (px, pz, v) => { const s = (a, b) => (b[0]-a[0])*(pz-a[2]) - (b[2]-a[2])*(px-a[0]); const d1=s(v[0],v[1]), d2=s(v[1],v[2]), d3=s(v[2],v[0]); return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0)) }
  for (let j = 0; j < N; j++) { let row = ''
    for (let i = 0; i < N; i++) { const px = mn[0] + (i+0.5)*(mx[0]-mn[0])/N, pz = mn[1] + (j+0.5)*(mx[1]-mn[1])/N; let y = null
      for (const v of tris) if (inside(px, pz, v)) { const yy = (v[0][1]+v[1][1]+v[2][1])/3; if (y === null || yy > y) y = yy }
      row += y === null ? '   .' : (Math.round(y)+'').padStart(4) }
    console.log(row) }
}
