// shotgun.glb (DJMaesen): side profile of each mesh in world space — per
// 8-unit slice along z: y min/max, x min/max (to find the bore, grip, ends)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const want = process.argv[3] || 'base'
const mul = (m, v) => [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12], m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13], m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]]
for (const n of doc.getRoot().listNodes()) {
  const mesh = n.getMesh(); if (!mesh || !n.getName().startsWith(want)) continue
  const W = n.getWorldMatrix(), bins = {}
  for (const p of mesh.listPrimitives()) {
    const a = p.getAttribute('POSITION'), v = [0, 0, 0]
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v); const w = mul(W, v), k = Math.floor(w[2] / 8)
      const b = bins[k] || (bins[k] = { y0: 1e9, y1: -1e9, x0: 1e9, x1: -1e9, n: 0 })
      b.y0 = Math.min(b.y0, w[1]); b.y1 = Math.max(b.y1, w[1]); b.x0 = Math.min(b.x0, w[0]); b.x1 = Math.max(b.x1, w[0]); b.n++
    }
  }
  console.log(n.getName())
  for (const k of Object.keys(bins).map(Number).sort((a, b) => a - b)) { const b = bins[k]; console.log(`  z ${String(k * 8).padStart(4)}..${String(k * 8 + 8).padEnd(4)} y ${b.y0.toFixed(1).padStart(6)} .. ${b.y1.toFixed(1).padStart(5)}   x ${b.x0.toFixed(1)} .. ${b.x1.toFixed(1)}  (${b.n})`) }
}
