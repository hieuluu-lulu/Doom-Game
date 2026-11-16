// split / drop geometry islands into named nodes.
// usage: node split.mjs in.glb out.glb rules.json
// rules: [{ name, mesh: <index of mesh node>, box: [[minx,miny,minz],[maxx,maxy,maxz]], drop: bool }]
// an island goes to the first rule whose box contains the island's whole bbox (world space)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import fs from 'fs'
import { compactPrimitive } from '@gltf-transform/functions'
const [inp, out, rulesF] = process.argv.slice(2)
const rules = JSON.parse(fs.readFileSync(rulesF, 'utf8'))
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
const nodes = doc.getRoot().listNodes().filter(n => n.getMesh())
const report = {}
for (const [mi, node] of nodes.entries()) {
  const myRules = rules.filter(r => r.mesh === mi)
  if (!myRules.length) continue
  const M = node.getWorldMatrix()
  const groups = {} // name -> {prim -> [indices]}
  const keepNew = []
  for (const prim of node.getMesh().listPrimitives()) {
    const P = prim.getAttribute('POSITION'), I = prim.getIndices()
    const n = P.getCount(), key = new Map(), rep = new Int32Array(n), W = new Float32Array(n * 3), v = [0, 0, 0]
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
    const ni = I ? I.getCount() : n, idx = (t) => I ? I.getScalar(t) : t
    for (let t = 0; t < ni; t += 3) { const a = f(rep[idx(t)]), b = f(rep[idx(t + 1)]), c = f(rep[idx(t + 2)]); if (a !== b) par[a] = b; const b2 = f(b); if (f(c) !== b2) par[f(c)] = b2 }
    const isl = new Map()
    for (let t = 0; t < ni; t += 3) {
      const r = f(rep[idx(t)])
      let s = isl.get(r); if (!s) { s = { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; isl.set(r, s) }
      s.tris.push(t)
      for (let k = 0; k < 3; k++) { const vi = idx(t + k); for (let a = 0; a < 3; a++) { s.min[a] = Math.min(s.min[a], W[vi * 3 + a]); s.max[a] = Math.max(s.max[a], W[vi * 3 + a]) } }
    }
    const per = { __keep: [] }
    for (const s of isl.values()) {
      const r = myRules.find(r => s.min.every((m, a) => m >= r.box[0][a]) && s.max.every((m, a) => m <= r.box[1][a]))
      const name = r ? r.name : '__keep'
      ;(per[name] = per[name] || []).push(...s.tris)
      if (r) report[r.name] = (report[r.name] || 0) + s.tris.length
    }
    const mk = (tris) => {
      const arr = new Uint32Array(tris.length * 3)
      tris.forEach((t, j) => { arr[j * 3] = idx(t); arr[j * 3 + 1] = idx(t + 1); arr[j * 3 + 2] = idx(t + 2) })
      return doc.createAccessor().setType('SCALAR').setArray(arr).setBuffer(doc.getRoot().listBuffers()[0])
    }
    for (const name of Object.keys(per)) {
      if (name === '__keep') continue
      const rule = myRules.find(r => r.name === name)
      if (!rule.drop) {
        const np = prim.clone().setIndices(mk(per[name]))
        ;(groups[name] = groups[name] || []).push(np)
      }
    }
    prim.setIndices(mk(per.__keep))
  }
  const parent = node.getParentNode()
  for (const name of Object.keys(groups)) {
    const mesh = doc.createMesh(name)
    groups[name].forEach(p => mesh.addPrimitive(p))
    const nn = doc.createNode(name).setMesh(mesh).setMatrix(node.getMatrix())
    if (parent) parent.addChild(nn); else doc.getRoot().getDefaultScene().addChild(nn)
  }
}
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) compactPrimitive(pr)
await io.write(out, doc)
console.log(JSON.stringify(report))
