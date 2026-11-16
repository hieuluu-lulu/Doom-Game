import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const pts = []
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh || node.getName() !== 'Object_3') continue
  const wm = node.getWorldMatrix()
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), v = [0, 0, 0]
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, v); pts.push([wm[0] * v[0] + wm[4] * v[1] + wm[8] * v[2] + wm[12], wm[1] * v[0] + wm[5] * v[1] + wm[9] * v[2] + wm[13], wm[2] * v[0] + wm[6] * v[1] + wm[10] * v[2] + wm[14]]) }
  }
}
const ext = (s, k) => [Math.min(...s.map(p => p[k])), Math.max(...s.map(p => p[k]))].map(a => +a.toFixed(3))
const shield = pts.filter(p => p[1] > 2.06 && !(p[1] > 2.12 && Math.abs(p[0]) < 0.13))
console.log('shield x', ext(shield, 0), 'y', ext(shield, 1), 'z', ext(shield, 2))
const mount = pts.filter(p => p[1] > 2.03 && p[1] < 2.13 && Math.abs(p[0]) < 0.13)
console.log('mount x', ext(mount, 0), 'y', ext(mount, 1), 'z', ext(mount, 2))
const gun = pts.filter(p => p[1] > 2.12 && Math.abs(p[0]) < 0.13)
console.log('gun y', ext(gun, 1), 'z', ext(gun, 2))
const tip = gun.filter(p => p[2] > -1.5)
console.log('tips x', [...new Set(tip.map(p => p[0].toFixed(3)))].sort().join(' '), 'y', ext(tip, 1))
// front wheel: tyre-only (|x| > .75) points at axle band
const fw = pts.filter(p => Math.abs(p[0]) > 0.8 && p[1] > 0.1 && p[1] < 0.6 && p[2] > -1.4 && p[2] < 0)
console.log('front tyre z', ext(fw, 2))
const mw = pts.filter(p => Math.abs(p[0]) > 0.8 && p[1] > 0.1 && p[1] < 0.6 && p[2] > -2.9 && p[2] < -1.7)
console.log('mid tyre z', ext(mw, 2))
// ring base (cage level) centre
const ring = pts.filter(p => p[1] > 1.96 && p[1] < 2.06 && Math.hypot(p[0], p[2] + 2.6) < 0.5)
console.log('ring base x', ext(ring, 0), 'z', ext(ring, 2))
