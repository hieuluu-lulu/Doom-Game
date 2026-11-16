// knife_animated.glb (Sketchfab, DJMaesen, CC-BY-4.0) → arsenal/assets/knife.glb:
// prune/dedup, resample the animation, textures → 1024² WebP, meshopt.
// usage: node knife_opt.mjs <in.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, resample, textureCompress, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'fs'
await MeshoptEncoder.ready
await MeshoptDecoder.ready
const [src, dst] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(src)
for (const t of doc.getRoot().listTextures()) console.log('tex', t.getMimeType(), JSON.stringify(t.getSize()), doc.getRoot().listMaterials().filter(m => [m.getBaseColorTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture(), m.getEmissiveTexture()].includes(t)).map(m => m.getName()).join(','))
await doc.transform(
  prune(), dedup(), resample({ tolerance: 1e-4 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 80, resize: [1024, 1024] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
)
await io.write(dst, doc)
console.log((fs.statSync(src).size / 1048576).toFixed(2), '→', (fs.statSync(dst).size / 1048576).toFixed(2), 'MB')
