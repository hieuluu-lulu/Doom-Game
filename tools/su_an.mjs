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
  let parent = node.getParentNode()
  console.log((parent ? parent.getName() : '') + '/' + node.getName(), r(b.min), r(b.max))
}
console.log('ALL', r(all.min), r(all.max))
// airframe vertex probes in world space: the tail end (nozzles), the lowest points
const af = doc.getRoot().listNodes().find(n => n.getMesh() && n.getParentNode() && /airframe/.test(n.getParentNode().getName()))
const m = af.getWorldMatrix(), pos = af.getMesh().listPrimitives()[0].getAttribute('POSITION'), v = [0, 0, 0], W = []
for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); W.push([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]) }
// along the longest axis
const ext = [0, 1, 2].map(i => all.max[i] - all.min[i]); const L = ext.indexOf(Math.max(...ext))
console.log('long axis', 'xyz'[L], 'extents', r(ext))
// nozzles: the rearmost slice of the airframe, split by side
const xmin = Math.min(...W.map(p => p[0]))
for (const side of [-1, 1]) {
  const s = W.filter(p => p[0] < xmin + 6 && Math.sign(p[2]) === side && Math.abs(p[2]) < 25 && Math.abs(p[1]) < 12)
  const c = [0, 1, 2].map(i => s.reduce((a, p) => a + p[i], 0) / Math.max(1, s.length))
  const ys = s.map(p => p[1]), zs = s.map(p => p[2])
  console.log('nozzle side', side, 'n', s.length, 'centre', r(c), 'y', r([Math.min(...ys), Math.max(...ys)]), 'z', r([Math.min(...zs), Math.max(...zs)]))
}
// wing lower surface height at a few span stations, mid-chord
for (const zz of [25, 40, 55]) {
  const s = W.filter(p => Math.abs(Math.abs(p[2]) - zz) < 2)
  const ys = s.map(p => p[1]), xs = s.map(p => p[0])
  console.log('span', zz, 'n', s.length, 'y', r([Math.min(...ys), Math.max(...ys)]), 'x', r([Math.min(...xs), Math.max(...xs)]))
}
// fin tops
const top = W.filter(p => p[1] > 18)
console.log('fin tops', r([Math.min(...top.map(p => p[0])), Math.max(...top.map(p => p[0]))]), 'z', r([Math.min(...top.map(p => p[2])), Math.max(...top.map(p => p[2]))]))
for (const side of [-1, 1]) {
  const band = W.filter(p => Math.sign(p[2]) === side && Math.abs(p[2]) > 8 && Math.abs(p[2]) < 26 && Math.abs(p[1]) < 10)
  const xm = Math.min(...band.map(p => p[0]))
  const ring = band.filter(p => p[0] < xm + 3)
  const c = [0, 1, 2].map(i => ring.reduce((a, p) => a + p[i], 0) / ring.length)
  const ys = ring.map(p => p[1]), zs = ring.map(p => p[2])
  console.log('engine', side, 'rear x', +xm.toFixed(1), 'centre', r(c), 'y', r([Math.min(...ys), Math.max(...ys)]), 'z', r([Math.min(...zs), Math.max(...zs)]))
}
for (const side of [-1, 1]) {
  const band = W.filter(p => Math.sign(p[2]) === side && Math.abs(p[2]) > 9 && Math.abs(p[2]) < 21 && p[1] > -7 && p[1] < 5)
  const xm = Math.min(...band.map(p => p[0]))
  const ring = band.filter(p => p[0] < xm + 1.5)
  const c = [0, 1, 2].map(i => ring.reduce((a, p) => a + p[i], 0) / ring.length)
  const ys = ring.map(p => p[1]), zs = ring.map(p => p[2])
  console.log('nozzle2', side, 'rear x', +xm.toFixed(1), 'n', ring.length, 'centre', r(c), 'y', r([Math.min(...ys), Math.max(...ys)]), 'z', r([Math.min(...zs), Math.max(...zs)]))
}
