import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
import sharp from 'sharp'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const r = (a) => a.map(v => +v.toFixed(3))
const all = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }
for (const node of doc.getRoot().listNodes()) {
  if (!node.getMesh()) continue
  const b = getBounds(node)
  for (let i = 0; i < 3; i++) { all.min[i] = Math.min(all.min[i], b.min[i]); all.max[i] = Math.max(all.max[i], b.max[i]) }
  const mat = node.getMesh().listPrimitives()[0].getMaterial(), tex = mat.getBaseColorTexture()
  let avg = ''
  if (tex) { const st = await sharp(Buffer.from(tex.getImage())).stats(); avg = st.channels.slice(0, 3).map(c => Math.round(c.mean)).join(',') + ' ' + (tex.getSize() || []).join('x') }
  console.log(node.getParentNode().getName().padEnd(16), r(b.min), r(b.max), 'avgRGB', avg)
}
console.log('ALL', r(all.min), r(all.max))
const ban = doc.getRoot().listNodes().find(n => n.getMesh() && /BAN/.test(n.getParentNode().getName()))
const m = ban.getWorldMatrix(), prim = ban.getMesh().listPrimitives()[0], pos = prim.getAttribute('POSITION'), v = [0, 0, 0], W = []
for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); W.push([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]) }
const cx = (all.min[0] + all.max[0]) / 2, cz = (all.min[2] + all.max[2]) / 2
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const s = W.filter(p => Math.sign(p[0] - cx) === sx && Math.sign(p[2] - cz) === sz)
  const mn = [0, 1, 2].map(i => Math.min(...s.map(p => p[i]))), mx = [0, 1, 2].map(i => Math.max(...s.map(p => p[i])))
  console.log('wheel', sx, sz, 'n', s.length, 'centre', r(mn.map((a, i) => (a + mx[i]) / 2)), 'size', r(mx.map((a, i) => a - mn[i])))
}
