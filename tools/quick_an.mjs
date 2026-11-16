// summary of a GLB: node tree (name, mesh, verts), materials, textures, bbox
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/core'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const root = doc.getRoot(), sc = root.getDefaultScene() || root.listScenes()[0]
const b = getBounds(sc)
const vc = root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + p.getAttribute('POSITION').getCount(), 0), 0)
console.log('nodes', root.listNodes().length, 'meshes', root.listMeshes().length, 'verts', vc, 'mats', root.listMaterials().length, 'tex', root.listTextures().map(t => (t.getSize() || []).join('x')).join(','), 'anims', root.listAnimations().length)
console.log('bbox', b.min.map(v => v.toFixed(2)).join(','), '→', b.max.map(v => v.toFixed(2)).join(','))
const names = root.listNodes().map(n => n.getName() + (n.getMesh() ? '*' : '')).filter(Boolean)
console.log('names', names.slice(0, +(process.argv[3] || 60)).join(' | '))
