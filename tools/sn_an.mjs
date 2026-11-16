import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const r = (a) => a.map(v => +v.toFixed(2))
for (const node of doc.getRoot().listNodes()) {
  const b = node.getMesh() ? getBounds(node) : null
  console.log(node.getName().padEnd(28), 'T', r(node.getTranslation()), 'R', r(node.getRotation()), 'S', r(node.getScale()), b ? 'B ' + r(b.min) + ' ' + r(b.max) : '')
}
const wv = (name) => {
  const nd = doc.getRoot().listNodes().find(x => x.getName() === name), m = nd.getWorldMatrix(), pos = nd.getMesh().listPrimitives()[0].getAttribute('POSITION'), v = [0, 0, 0], W = []
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); W.push([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]) }
  return W
}
const B = wv('base_sniper_0')
const zmin = Math.min(...B.map(p => p[2])), zmax = Math.max(...B.map(p => p[2]))
for (const end of [['zmin', zmin, 1], ['zmax', zmax, -1]]) {
  const f = B.filter(p => Math.abs(p[2] - end[1]) < 1.5)
  console.log(end[0], r([end[1]]), 'x', r([Math.min(...f.map(p => p[0])), Math.max(...f.map(p => p[0]))]), 'y', r([Math.min(...f.map(p => p[1])), Math.max(...f.map(p => p[1]))]), 'n', f.length)
}
// slices along z: y-range at x≈0
for (let z = Math.floor(zmin / 10) * 10; z <= zmax; z += 10) {
  const f = B.filter(p => p[2] >= z && p[2] < z + 10)
  if (!f.length) continue
  console.log('z', z, 'y', r([Math.min(...f.map(p => p[1])), Math.max(...f.map(p => p[1]))]), 'x', r([Math.min(...f.map(p => p[0])), Math.max(...f.map(p => p[0]))]))
}
for (const t of doc.getRoot().listTextures()) console.log('tex', t.getName(), t.getSize(), t.getMimeType())
for (const m of doc.getRoot().listMaterials()) console.log('mat', m.getName(), !!m.getBaseColorTexture(), !!m.getNormalTexture(), !!m.getMetallicRoughnessTexture(), m.getMetallicFactor(), m.getRoughnessFactor())
