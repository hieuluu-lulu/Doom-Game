import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, simplify, textureCompress, getBounds } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
const [inp, out, ratioArg, texArg] = process.argv.slice(2)
const RATIO = +(ratioArg || 0.3), TEX = +(texArg || 1024)
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
const root = doc.getRoot()
// cockpit interior: everything that fits inside the cabin bubble
const CAB = { min: [-0.7, -0.46, 0.25], max: [0.72, 0.95, 2.86] }
const inside = (b) => b.min.every((v, i) => v >= CAB.min[i]) && b.max.every((v, i) => v <= CAB.max[i])
let removed = [], kept = [], v0 = 0, v1 = 0
const vcount = (mesh) => mesh.listPrimitives().reduce((s, p) => s + p.getAttribute('POSITION').getCount(), 0)
for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const b = getBounds(node)
  v0 += vcount(mesh)
  if (inside(b)) { removed.push(node.getName()); node.dispose(); continue }
  kept.push(node)
}
// rotor hub = centroid of the blade disc (3 identical blades); fenestron = the thin disc at the tail
const info = {}
for (const node of kept) {
  const b = getBounds(node), name = node.getName()
  if (b.max[0] - b.min[0] > 8 && b.max[1] < 2.2 && b.min[1] > 1.2) {
    const pos = node.getMesh().listPrimitives()[0].getAttribute('POSITION'), m = node.getWorldMatrix()
    let sx = 0, sz = 0, sy = 0, n = pos.getCount(), v = [0, 0, 0]
    for (let i = 0; i < n; i++) { pos.getElement(i, v); const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]; sx += x; sy += y; sz += z }
    info.blades = { name, hub: [sx / n, sy / n, sz / n].map(x => +x.toFixed(3)), bounds: b }
  }
}
await doc.transform(
  prune(), dedup(), weld({ tolerance: 0.0001 }),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.0015 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 78 }),
  prune(), dedup(),
)
for (const node of doc.getRoot().listNodes()) if (node.getMesh()) v1 += vcount(node.getMesh())
await io.write(out, doc)
const fs = await import('fs')
console.log(JSON.stringify({ removed: removed.length, kept: kept.length, verts: [v0, v1], textures: doc.getRoot().listTextures().length, sizeMB: +(fs.statSync(out).size / 1e6).toFixed(2), info }, null, 1))
console.log('kept:', kept.map(n => n.getName()).join(' '))
