import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
let i = 0
for (const m of doc.getRoot().listMaterials()) {
  const t = m.getBaseColorTexture(); if (!t) continue
  await sharp(Buffer.from(t.getImage())).resize(256, 256, { fit: 'inside' }).png().toFile(process.argv[3] + '/' + (i++) + '_' + m.getName().replace(/[^a-z0-9_]/gi, '') + '.png')
}
