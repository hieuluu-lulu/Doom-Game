import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
for (const m of doc.getRoot().listMaterials()) console.log(m.getName(), 'base', m.getBaseColorFactor().map(v => v.toFixed(2)).join(','), 'met', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), 'mr', !!m.getMetallicRoughnessTexture(), 'nrm', !!m.getNormalTexture(), 'alpha', m.getAlphaMode(), m.getDoubleSided() ? 'ds' : '', Object.keys(m.listExtensions ? {} : {}))
