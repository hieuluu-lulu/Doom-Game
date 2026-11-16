// Shrink the embedded models for the build:
//  - EXT_meshopt_compression on geometry + animation (decoded in the browser by
//    common/lib/05_meshopt_decoder.js through SX_GLTFLoader)
//  - JPEG/PNG textures inside GLBs → WebP (keeps the size, quality 82)
// usage: node compress_assets.mjs <file.glb>...   (rewrites in place, prints before → after)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { meshopt, textureCompress, reorder, quantize } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'fs'
await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
for (const f of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const before = fs.statSync(f).size
  const doc = await io.read(f)
  if (doc.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression')) { console.log('skip (already meshopt)', f); continue }
  // meshopt quantizes positions (the scale moves into the node transform): code
  // that reads raw geometry without node transforms (the KR-12 shotgun builder)
  // would break, so models that weren't quantized before are left alone unless --force
  if (!process.argv.includes('--force') && !doc.getRoot().listExtensionsUsed().some(e => e.extensionName === 'KHR_mesh_quantization') && !/soldier/.test(f)) { console.log('skip (not quantized)', f); continue }
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, slots: /.*/, pattern: /.*/, formats: /^(jpeg|png)$/ }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )
  await io.write(f, doc)
  const after = fs.statSync(f).size
  console.log(f.split('/').slice(-1)[0].padEnd(22), (before / 1048576).toFixed(2), '→', (after / 1048576).toFixed(2), 'MB')
}
