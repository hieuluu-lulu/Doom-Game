// C-channel stair → two parts: one tread (+ its two brackets) and the
// stringer set (channels + end plates). Balusters / platform dropped.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, flatten, join, quantize, simplify } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
const [inp, out] = process.argv.slice(2)
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
const root = doc.getRoot()
function mul(m, p) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]] }
const bb = (n) => { const W = n.getWorldMatrix(), mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9]
  for (const p of n.getMesh().listPrimitives()) { const A = p.getAttribute('POSITION'); for (let i = 0; i < A.getCount(); i++) { const q = mul(W, A.getElement(i, [])); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]) } } }
  return [mn, mx] }
let kept = 0
for (const n of root.listNodes()) { const me = n.getMesh(); if (!me) continue
  const mat = me.listPrimitives()[0].getMaterial().getName(), [mn, mx] = bb(n), zc = (mn[2] + mx[2]) / 2
  let keep = false
  if (/material_[467]/.test(mat)) keep = true // stringers + end plates
  if (/material_[23]/.test(mat) && zc > -60 && zc < -50) keep = true // the tread at z≈-55 and its brackets
  if (!keep) { n.setMesh(null); continue }
  kept++
  for (const p of me.listPrimitives()) for (const s of p.listSemantics()) if (s !== 'POSITION' && s !== 'NORMAL') p.setAttribute(s, null)
}
// name the two parts by moving the tread into its own top node
await doc.transform(prune(), dedup(), flatten(), join(), weld())
console.log('kept nodes', kept, 'meshes', root.listMeshes().length, root.listNodes().filter(n => n.getMesh()).map(n => n.getName() + ':' + n.getMesh().listPrimitives().map(p => p.getMaterial().getName() + '/' + (p.getIndices() ? p.getIndices().getCount() / 3 : 0)).join(',')).join(' | '))
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: 0.6, error: 0.0015 }), quantize())
await io.write(out, doc)
console.log(root.listNodes().filter(n => n.getMesh()).map(n => n.getMesh().listPrimitives().map(p => p.getMaterial().getName() + '/' + (p.getIndices() ? p.getIndices().getCount() / 3 : 0)).join(',')).join(' | '))
