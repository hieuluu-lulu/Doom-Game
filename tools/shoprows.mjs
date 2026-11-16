import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const root = doc.getRoot()
const res = [[/^Plane\.?(100|101|102|103|104|116|123|131)_/, 'A'], [/^Plane\.?(111|114|115|118|119|120|126|127|130|133)_/, 'B']]
function mul(m, p) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]] }
for (const [re, nm] of res) {
  const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9]
  const per = []
  for (const n of root.listNodes()) {
    // match self or any ancestor name
    let a = n, hit = false; while (a) { if (re.test(a.getName())) { hit = true; break } a = a.getParentNode ? a.getParentNode() : null }
    if (!hit || !n.getMesh()) continue
    const W = n.getWorldMatrix()
    const lm = [1e9,1e9,1e9], lx = [-1e9,-1e9,-1e9]
    for (const p of n.getMesh().listPrimitives()) { const A = p.getAttribute('POSITION'); const v = []
      for (let i = 0; i < A.getCount(); i++) { const q = mul(W, A.getElement(i, v)); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]); lm[k] = Math.min(lm[k], q[k]); lx[k] = Math.max(lx[k], q[k]) } } }
    per.push(n.getName() + ' x[' + lm[0].toFixed(2) + ',' + lx[0].toFixed(2) + '] y[' + lm[1].toFixed(2) + ',' + lx[1].toFixed(2) + '] z[' + lm[2].toFixed(2) + ',' + lx[2].toFixed(2) + ']')
  }
  console.log(nm, 'x', mn[0].toFixed(2), mx[0].toFixed(2), 'y', mn[1].toFixed(2), mx[1].toFixed(2), 'z', mn[2].toFixed(2), mx[2].toFixed(2))
  console.log(per.join('\n'))
}
