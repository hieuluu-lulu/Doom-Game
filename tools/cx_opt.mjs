// node cx_opt.mjs in out maxTex  (env: DROP_MAT regex, NO_NRM=1, STUB_NODE regex, RATIO, ERR)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, simplify, textureCompress, quantize } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
const [inp, out, maxTex] = process.argv.slice(2)
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
const root = doc.getRoot()
const DROP = process.env.DROP_MAT ? new RegExp(process.env.DROP_MAT) : null
const STUB = process.env.STUB_NODE ? new RegExp(process.env.STUB_NODE) : null
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial()
    if (DROP && mat && DROP.test(mat.getName())) { prim.dispose(); continue }
    for (const sem of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) prim.setAttribute(sem, null)
    if (STUB && STUB.test(node.getName())) {
      // keep the material (its texture), drop the geometry: one tiny triangle
      const P = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0.001, 0, 0, 0, 0.001, 0]))
      const N = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]))
      const U = doc.createAccessor().setType('VEC2').setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
      prim.setIndices(null); prim.setAttribute('POSITION', P); prim.setAttribute('NORMAL', N); prim.setAttribute('TEXCOORD_0', U)
    }
  }
}
if (process.env.NO_NRM) for (const m of root.listMaterials()) { m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null) }
await doc.transform(prune(), dedup(), weld())
const v0 = root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getAttribute('POSITION') ? p.getAttribute('POSITION').getCount() : 0), 0), 0)
if (+process.env.RATIO < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: +process.env.RATIO, error: +(process.env.ERR || 0.002) }))
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+maxTex, +maxTex], quality: 80 }), prune(), quantize())
const v1 = root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getAttribute('POSITION') ? p.getAttribute('POSITION').getCount() : 0), 0), 0)
await io.write(out, doc)
console.log(out, 'verts', v0, '->', v1, 'tex', root.listTextures().length)
