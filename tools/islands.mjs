// connected components (by welded position) of one mesh, world space; print bboxes
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const [file, meshIdx, minTris] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(file)
const nodes = doc.getRoot().listNodes().filter(n => n.getMesh())
const node = nodes[+meshIdx]
const M = node.getWorldMatrix()
const out = []
for (const prim of node.getMesh().listPrimitives()) {
  const P = prim.getAttribute('POSITION'), I = prim.getIndices()
  const n = P.getCount(), key = new Map(), rep = new Int32Array(n)
  const v = [0, 0, 0], W = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    P.getElement(i, v)
    const x = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], y = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], z = M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]
    W[i * 3] = x; W[i * 3 + 1] = y; W[i * 3 + 2] = z
    const k = Math.round(x * 2000) + ',' + Math.round(y * 2000) + ',' + Math.round(z * 2000)
    if (!key.has(k)) key.set(k, i)
    rep[i] = key.get(k)
  }
  const par = new Int32Array(n).map((_, i) => i)
  const f = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a] } return a }
  const u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b }
  const ni = I ? I.getCount() : n
  const idx = (t) => I ? I.getScalar(t) : t
  for (let t = 0; t < ni; t += 3) { const a = rep[idx(t)], b = rep[idx(t + 1)], c = rep[idx(t + 2)]; u(a, b); u(b, c) }
  const isl = new Map()
  for (let t = 0; t < ni; t += 3) {
    const r = f(rep[idx(t)])
    let s = isl.get(r); if (!s) { s = { tris: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; isl.set(r, s) }
    s.tris++
    for (let k = 0; k < 3; k++) { const vi = idx(t + k); for (let a = 0; a < 3; a++) { s.min[a] = Math.min(s.min[a], W[vi * 3 + a]); s.max[a] = Math.max(s.max[a], W[vi * 3 + a]) } }
  }
  for (const s of isl.values()) out.push(s)
}
out.sort((a, b) => b.tris - a.tris)
console.log('islands', out.length)
for (const s of out) if (s.tris >= +(minTris || 0)) console.log(s.tris, 'min', s.min.map(x => x.toFixed(2)).join(','), 'max', s.max.map(x => x.toFixed(2)).join(','))
