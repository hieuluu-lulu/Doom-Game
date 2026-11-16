import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const r = (a) => a.map(v => +v.toFixed(2))
const wv = (name) => {
  const nd = doc.getRoot().listNodes().find(x => x.getName() === name), m = nd.getWorldMatrix(), pos = nd.getMesh().listPrimitives()[0].getAttribute('POSITION'), v = [0, 0, 0], W = []
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); W.push([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]) }
  return W
}
const S = wv('scope_sniper_0')
for (let z = -1; z <= 54; z += 3) {
  const f = S.filter(p => p[2] >= z && p[2] < z + 3 && Math.abs(p[0]) < 4.2)
  if (!f.length) continue
  console.log('scope z', z, 'y', r([Math.min(...f.map(p => p[1])), Math.max(...f.map(p => p[1]))]), 'x', r([Math.min(...f.map(p => p[0])), Math.max(...f.map(p => p[0]))]))
}
const B = wv('base_sniper_0')
for (let z = -12; z <= 14; z += 2) {
  const f = B.filter(p => p[2] >= z && p[2] < z + 2 && p[1] < 3)
  if (!f.length) continue
  console.log('grip z', z, 'y', r([Math.min(...f.map(p => p[1])), Math.max(...f.map(p => p[1]))]))
}
for (const n of ['bolt_sniper_0', 'boltback_sniper_0']) {
  const W = wv(n); const xs = W.filter(p => p[0] < -4)
  console.log(n, 'knob verts', xs.length, xs.length ? r([0, 1, 2].map(i => xs.reduce((s, p) => s + p[i], 0) / xs.length)) : '')
}
// parent chain
for (const nd of doc.getRoot().listNodes()) console.log(nd.getName(), '->', nd.getParentNode() ? nd.getParentNode().getName() : '(scene)')
