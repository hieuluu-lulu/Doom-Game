import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const root = doc.getRoot()
function mul(m, p) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]] }
const [X0,X1,Y0,Y1,Z0,Z1] = process.argv.slice(3).map(Number)
const groups = new Map()
for (const n of root.listNodes()) { if (!n.getMesh()) continue; const W = n.getWorldMatrix()
  for (const p of n.getMesh().listPrimitives()) { if (p.getMaterial().getName() === 'glass') continue
    const A = p.getAttribute('POSITION'), I = p.getIndices(); const cnt = I ? I.getCount() : A.getCount()
    for (let t = 0; t < cnt; t += 3) { const v = [0,1,2].map(j => mul(W, A.getElement(I ? I.getScalar(t+j) : t+j, [])))
      const c = [0,1,2].map(k => (v[0][k]+v[1][k]+v[2][k])/3)
      if (c[0]<X0||c[0]>X1||c[1]<Y0||c[1]>Y1||c[2]<Z0||c[2]>Z1) continue
      const e1=[0,1,2].map(k=>v[1][k]-v[0][k]), e2=[0,1,2].map(k=>v[2][k]-v[0][k]); const nn=[e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]]; const L=Math.hypot(...nn)||1
      const ax = ['x','y','z'][nn.map(Math.abs).indexOf(Math.max(...nn.map(Math.abs)))]
      const key = ax + '@' + Math.round(c[ax==='x'?0:ax==='y'?1:2])
      const g = groups.get(key) || { n: 0, mn: [1e9,1e9,1e9], mx: [-1e9,-1e9,-1e9] }
      g.n++; v.forEach(q => { for (let k=0;k<3;k++){ g.mn[k]=Math.min(g.mn[k],q[k]); g.mx[k]=Math.max(g.mx[k],q[k]) } }); groups.set(key, g) } } }
for (const [k,g] of [...groups].sort()) console.log(k, g.n, 'x', g.mn[0].toFixed(0), g.mx[0].toFixed(0), 'y', g.mn[1].toFixed(0), g.mx[1].toFixed(0), 'z', g.mn[2].toFixed(0), g.mx[2].toFixed(0))
