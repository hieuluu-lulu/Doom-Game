// connected components (by position-welded vertices) of one node's mesh
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const node = doc.getRoot().listNodes().find(n => n.getName() === process.argv[3])
const p = node.getMesh().listPrimitives()[0]
const pos = p.getAttribute('POSITION'), idx = p.getIndices()
const n = pos.getCount(), key = new Map(), canon = new Int32Array(n), v = [0, 0, 0]
for (let i = 0; i < n; i++) { pos.getElement(i, v); const k = v.map(x => Math.round(x * 1e4)).join(','); if (!key.has(k)) key.set(k, i); canon[i] = key.get(k) }
const par = new Int32Array(n).map((_, i) => i)
const f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i] } return i }
const tri = idx.getCount() / 3
for (let t = 0; t < tri; t++) { const a = f(canon[idx.getScalar(3 * t)]), b = f(canon[idx.getScalar(3 * t + 1)]), c = f(canon[idx.getScalar(3 * t + 2)]); par[a] = b; par[f(c)] = f(b) }
const comps = new Map()
for (let t = 0; t < tri; t++) { const r = f(canon[idx.getScalar(3 * t)]); if (!comps.has(r)) comps.set(r, { tris: 0, lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] }); const c = comps.get(r); c.tris++; for (let k = 0; k < 3; k++) { pos.getElement(idx.getScalar(3 * t + k), v); for (let j = 0; j < 3; j++) { c.lo[j] = Math.min(c.lo[j], v[j]); c.hi[j] = Math.max(c.hi[j], v[j]) } } }
const list = [...comps.values()].sort((a, b) => b.tris - a.tris)
console.log('components', list.length)
for (const c of list.slice(0, +(process.argv[4] || 60))) console.log(c.tris, 'lo', c.lo.map(x => x.toFixed(3)).join(','), 'hi', c.hi.map(x => x.toFixed(3)).join(','), 'size', c.hi.map((x, j) => (x - c.lo[j]).toFixed(3)).join(','))
