// small prop: strip extras, drop AO/emissive (+normal with NONORMAL=1), join, simplify, webp, quantize
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, simplify, textureCompress, quantize, flatten, join } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'fs'
const [inp, out, ratioArg, texArg] = process.argv.slice(2)
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
const vc = () => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + p.getAttribute('POSITION').getCount(), 0), 0)
const v0 = vc()
const DROP = (process.env.DROP || '').split(',').filter(Boolean)
for (const node of doc.getRoot().listNodes()) if (DROP.some(d => node.getName() === d)) { node.listChildren().forEach(c => c.dispose()); node.dispose() }
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) for (const sem of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) prim.setAttribute(sem, null)
for (const m of doc.getRoot().listMaterials()) {
  m.setOcclusionTexture(null); m.setEmissiveTexture(null); m.setEmissiveFactor([0, 0, 0])
  for (const ti of [m.getBaseColorTextureInfo(), m.getNormalTextureInfo(), m.getMetallicRoughnessTextureInfo()]) if (ti && ti.getTexCoord()) { console.log('texCoord', ti.getTexCoord(), '→ 0', m.getName()); ti.setTexCoord(0) }
  if (process.env.NONORMAL) m.setNormalTexture(null)
  if (process.env.NOMR) { m.setMetallicRoughnessTexture(null); m.setMetallicFactor(+(process.env.MET || 0)); m.setRoughnessFactor(+(process.env.ROUGH || 0.7)) }
}
const T = +texArg
await doc.transform(
  prune(), dedup(), flatten(), join(), weld({ tolerance: 0.0001 }),
  simplify({ simplifier: MeshoptSimplifier, ratio: +ratioArg, error: +(process.env.ERR || 0.002) }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [T, T], quality: 80, slots: /baseColor/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [T / 2, T / 2], quality: 80, slots: /^(?!baseColor)/ }),
  prune(), dedup(),
  quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }),
)
await io.write(out, doc)
console.log(JSON.stringify({ verts: [v0, vc()], sizeKB: Math.round(fs.statSync(out).size / 1e3), meshes: doc.getRoot().listMeshes().map(m => m.getName()).join(' ') }))
