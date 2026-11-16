import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const r = (a) => a.map(v => +v.toFixed(2))
const all = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }
for (const node of doc.getRoot().listNodes()) {
  if (!node.getMesh()) continue
  const b = getBounds(node)
  for (let i = 0; i < 3; i++) { all.min[i] = Math.min(all.min[i], b.min[i]); all.max[i] = Math.max(all.max[i], b.max[i]) }
  console.log(node.getParentNode().getName().padEnd(22), r(b.min), r(b.max))
}
console.log('ALL', r(all.min), r(all.max), 'size', r([0, 1, 2].map(i => all.max[i] - all.min[i])))
for (const n of ['Group001', 'Magazine_low']) { const nd = doc.getRoot().listNodes().find(x => x.getName() === n); console.log(n, 'bounds', r(getBounds(nd).min), r(getBounds(nd).max)) }
for (const t of doc.getRoot().listTextures()) { const s = t.getSize(); console.log('tex', s && s.join('x'), t.getMimeType()) }
const worldVerts = (name) => {
  const nd = doc.getRoot().listNodes().find(x => x.getName() === name), mesh = nd.listChildren()[0].getMesh()
  const m = nd.listChildren()[0].getWorldMatrix(), pos = mesh.listPrimitives()[0].getAttribute('POSITION'), v = [0, 0, 0], W = []
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); W.push([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]) }
  return W
}
const B = worldVerts('Barrel_low'), zmax = Math.max(...B.map(p => p[2]))
const face = B.filter(p => p[2] > zmax - 0.15)
const ys = face.map(p => p[1])
console.log('muzzle face: z', +zmax.toFixed(2), 'y', r([Math.min(...ys), Math.max(...ys)]), 'n', face.length)
// the bore: the innermost ring on the face (smallest radius around the face centre in x)
const M = worldVerts('Magazine_low'), ymin = Math.min(...M.map(p => p[1])), ymax = Math.max(...M.map(p => p[1]))
const lo = M.filter(p => p[1] < ymin + 1.5), hi = M.filter(p => p[1] > ymax - 1.5)
const cz = (a) => a.reduce((s, p) => s + p[2], 0) / a.length, cy = (a) => a.reduce((s, p) => s + p[1], 0) / a.length
console.log('mag axis: top', r([cy(hi), cz(hi)]), 'bottom', r([cy(lo), cz(lo)]), 'tilt deg', +(Math.atan2(cz(hi) - cz(lo), cy(hi) - cy(lo)) * 180 / Math.PI).toFixed(1))
const G = worldVerts('Grip_low'); console.log('grip centre', r([0, 1, 2].map(i => G.reduce((s, p) => s + p[i], 0) / G.length)))
