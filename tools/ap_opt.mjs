// Apache → Skua: split the material-merged body (Object_8) into the main rotor,
// the tail rotor and the chin gun (own nodes, so they can spin / aim), tint the
// paint a darker hostile grey-olive, then the usual size pass.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, simplify, textureCompress, quantize, compactPrimitive } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'fs'
const [inp, out] = process.argv.slice(2)
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
const root = doc.getRoot()
const body = root.listNodes().find(n => n.getName() === 'Object_8')
const prim = body.getMesh().listPrimitives()[0]
const pos = prim.getAttribute('POSITION'), idx = prim.getIndices()
const n = pos.getCount(), keyM = new Map(), canon = new Int32Array(n), v = [0, 0, 0]
for (let i = 0; i < n; i++) { pos.getElement(i, v); const k = v.map(x => Math.round(x * 1e4)).join(','); if (!keyM.has(k)) keyM.set(k, i); canon[i] = keyM.get(k) }
const par = new Int32Array(n).map((_, i) => i)
const f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i] } return i }
const tri = idx.getCount() / 3
for (let t = 0; t < tri; t++) { const a = f(canon[idx.getScalar(3 * t)]), b = f(canon[idx.getScalar(3 * t + 1)]), c = f(canon[idx.getScalar(3 * t + 2)]); par[a] = b; par[f(c)] = f(b) }
const comps = new Map()
for (let t = 0; t < tri; t++) {
  const r = f(canon[idx.getScalar(3 * t)])
  if (!comps.has(r)) comps.set(r, { lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] })
  const c = comps.get(r)
  for (let k = 0; k < 3; k++) { pos.getElement(idx.getScalar(3 * t + k), v); for (let j = 0; j < 3; j++) { c.lo[j] = Math.min(c.lo[j], v[j]); c.hi[j] = Math.max(c.hi[j], v[j]) } }
}
const HUB = [0.265, 0.0], TAIL = [-1.057, 0.1, 0.077]
function kind(c) {
  const cx = (c.lo[0] + c.hi[0]) / 2, cy = (c.lo[1] + c.hi[1]) / 2, cz = (c.lo[2] + c.hi[2]) / 2
  if (c.lo[2] >= 0.094 && c.hi[0] > -0.75 && Math.hypot(cx - HUB[0], cy - HUB[1]) < 1.05) return 'rotor'
  if (c.lo[0] > 0.24 && c.hi[0] < 0.29 && Math.abs(cy) < 0.02 && c.hi[2] > 0.18) return 'rotor' // mast
  if (cx > -1.26 && cx < -0.86 && cy > 0.044 && cy < 0.13 && cz > -0.06 && cz < 0.2) return 'tail'
  if (cx > 0.52 && cx < 0.88 && Math.abs(cy) < 0.045 && c.hi[2] < -0.24) return 'gun'
  return 'body'
}
const lists = { body: [], rotor: [], tail: [], gun: [] }
for (let t = 0; t < tri; t++) { const k = kind(comps.get(f(canon[idx.getScalar(3 * t)]))); lists[k].push(idx.getScalar(3 * t), idx.getScalar(3 * t + 1), idx.getScalar(3 * t + 2)) }
console.log('split tris', Object.fromEntries(Object.entries(lists).map(([k, a]) => [k, a.length / 3])))
const parent = body.getParentNode()
for (const k of ['rotor', 'tail', 'gun']) {
  const p2 = prim.clone()
  p2.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(lists[k])).setBuffer(idx.getBuffer()))
  compactPrimitive(p2)
  const mesh = doc.createMesh('sx_' + k).addPrimitive(p2)
  parent.addChild(doc.createNode('sx_' + k).setMesh(mesh))
}
prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(lists.body)).setBuffer(idx.getBuffer()))
compactPrimitive(prim)
// strip tangents / extra UVs
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) for (const sem of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) p.setAttribute(sem, null)
// hostile paint: darker, greyer olive
for (const m of root.listMaterials()) {
  if (!/Main_Body/.test(m.getName())) continue
  const t = m.getBaseColorTexture()
  const img = await sharp(Buffer.from(t.getImage())).modulate({ brightness: +(process.env.BRI || 0.8), saturation: +(process.env.SAT || 0.55) }).png().toBuffer()
  t.setImage(new Uint8Array(img)).setMimeType('image/png')
}
await doc.transform(
  prune(), dedup(), weld({ tolerance: 0.0001 }),
  simplify({ simplifier: MeshoptSimplifier, ratio: +(process.env.RATIO || 0.75), error: 0.0006 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  prune(), dedup(),
  quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }),
)
await io.write(out, doc)
const vc = root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + p.getAttribute('POSITION').getCount(), 0), 0)
console.log(JSON.stringify({ verts: vc, sizeMB: +(fs.statSync(out).size / 1e6).toFixed(2), nodes: root.listNodes().map(n => n.getName()).join(' | ') }))
