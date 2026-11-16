import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, simplify, textureCompress, quantize } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'fs'
const [inp, out, ratioArg, texArg] = process.argv.slice(2)
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
let v0 = 0, v1 = 0
const vc = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + p.getAttribute('POSITION').getCount(), 0), 0)
v0 = vc()
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) for (const sem of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) prim.setAttribute(sem, null)
await doc.transform(
  prune(), dedup(), weld({ tolerance: 0.0001 }),
  simplify({ simplifier: MeshoptSimplifier, ratio: +ratioArg, error: 0.0008 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+texArg, +texArg], quality: 82 }),
  prune(), dedup(),
  quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }),
)
v1 = vc()
await io.write(out, doc)
console.log(JSON.stringify({ verts: [v0, v1], sizeMB: +(fs.statSync(out).size / 1e6).toFixed(2), nodes: doc.getRoot().listNodes().map(n => n.getName()).join(' ') }))
