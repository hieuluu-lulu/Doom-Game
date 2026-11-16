import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(process.argv[2])
const root = doc.getRoot()
console.log(JSON.stringify(root.getAsset().extras || {}), root.getAsset().generator)
for (const n of root.listNodes()) {
  const m = n.getMesh()
  console.log('node', n.getName(), 'T', n.getTranslation().map(v=>+v.toFixed(3)), 'R', n.getRotation().map(v=>+v.toFixed(3)), 'S', n.getScale().map(v=>+v.toFixed(3)), 'kids', n.listChildren().map(c=>c.getName()).join(','))
  if (!m) continue
  for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), mat = p.getMaterial()
    const mn = pos.getMinNormalized ? null : null
    let lo=[1e9,1e9,1e9], hi=[-1e9,-1e9,-1e9], v=[0,0,0]
    for (let i=0;i<pos.getCount();i++){ pos.getElement(i,v); for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k])} }
    const tex = mat && mat.getBaseColorTexture()
    console.log('   prim verts', pos.getCount(), 'mat', mat && mat.getName(), 'alpha', mat && mat.getAlphaMode(), 'col', mat && mat.getBaseColorFactor().map(x=>+x.toFixed(2)), 'tex', tex && tex.getName(), tex && (tex.getSize()||[]).join('x'), 'lo', lo.map(x=>+x.toFixed(3)), 'hi', hi.map(x=>+x.toFixed(3)))
  }
}
