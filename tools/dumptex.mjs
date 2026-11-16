import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'
const [inp, outPrefix, size] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
let k = 0
for (const t of doc.getRoot().listTextures()) {
  const name = (t.getName() || t.getURI() || 'tex').replace(/[^a-z0-9_]/gi, '_')
  await sharp(Buffer.from(t.getImage())).resize(+(size || 512)).png().toFile(outPrefix + (k++) + '_' + name + '.png')
}
for (const m of doc.getRoot().listMaterials()) console.log('mat', m.getName(), 'base', m.getBaseColorTexture() && m.getBaseColorTexture().getName(), 'nrm', !!m.getNormalTexture(), 'alpha', m.getAlphaMode())
