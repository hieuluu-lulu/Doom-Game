import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
for (const n of doc.getRoot().listNodes()) if (n.getMesh()) { const b = getBounds(n); console.log(n.getName(), b.min.map(v => v.toFixed(3)).join(','), '→', b.max.map(v => v.toFixed(3)).join(','), 'mat', n.getMesh().listPrimitives().map(p => p.getMaterial() && p.getMaterial().getName()).join('/')) }
