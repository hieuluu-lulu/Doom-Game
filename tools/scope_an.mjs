// 4x_scope.glb: world-space bounds per mesh node (orientation / size check)
import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const scene = doc.getRoot().listScenes()[0]
const f = (v) => v.map((x) => +x.toFixed(4)).join(',')
const all = getBounds(scene)
console.log('scene', 'min', f(all.min), 'max', f(all.max))
for (const n of doc.getRoot().listNodes()) if (n.getMesh()) { const b = getBounds(n); console.log(n.getName().padEnd(32), 'min', f(b.min), 'max', f(b.max), n.getMesh().listPrimitives().map((p) => p.getMaterial() && p.getMaterial().getName()).join(',')) }
