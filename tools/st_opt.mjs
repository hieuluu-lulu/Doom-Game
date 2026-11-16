// street kit: spec-gloss → metal-rough, no MR map, 1024 webp, dedup, quantize
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, textureCompress, quantize, metalRough } from '@gltf-transform/functions'
import sharp from 'sharp'
const [inp, out, maxTex] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
await doc.transform(metalRough())
for (const m of doc.getRoot().listMaterials()) { m.setMetallicRoughnessTexture(null); m.setMetallicFactor(0); m.setRoughnessFactor(0.92); m.setOcclusionTexture(null); for (const e of m.listExtensions()) m.setExtension(e.extensionName, null) }
for (const n of doc.getRoot().listNodes()) { const me = n.getMesh(); if (!me) continue
  for (const p of me.listPrimitives()) for (const sem of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) p.setAttribute(sem, null) }
await doc.transform(prune(), dedup(), weld())
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+maxTex, +maxTex], quality: +(process.env.Q || 80) }), prune(), quantize())
await io.write(out, doc)
const root = doc.getRoot()
console.log(out, 'meshes', root.listMeshes().length, 'tex', root.listTextures().map(t => t.getSize().join('x') + ':' + (t.getImage().byteLength >> 10) + 'K').join(' '))
