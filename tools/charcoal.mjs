// base-colour textures of the named materials → charcoal grey; strongly red pixels stay red
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'
const [inp, out, mats, base, gain] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
const B = +(base || 0.07), K = +(gain || 0.42)
for (const m of doc.getRoot().listMaterials()) {
  if (!mats.split(',').includes(m.getName())) continue
  const t = m.getBaseColorTexture()
  const { data, info } = await sharp(Buffer.from(t.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let reds = 0
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0
    const red = r === mx && sat > 0.45 && r > 0.35 && g < r * 0.6 && b < r * 0.6
    if (red) { reds++; data[i] = Math.min(255, 40 + r * 215); data[i + 1] = g * 70; data[i + 2] = b * 60; continue }
    const l = 0.3 * r + 0.59 * g + 0.11 * b
    const v = B + l * K
    data[i] = v * 255 * 0.96; data[i + 1] = v * 255 * 0.98; data[i + 2] = v * 255 * 1.04
  }
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer()
  t.setImage(new Uint8Array(png)).setMimeType('image/png')
  console.log('recoloured', m.getName(), info.width, info.height, 'red px', reds)
}
await io.write(out, doc)
