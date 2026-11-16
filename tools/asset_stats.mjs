// per GLB: total, texture bytes (+ sizes/formats), geometry bytes, gzip ratio
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import fs from 'fs'
import zlib from 'zlib'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f), gz = zlib.gzipSync(buf, { level: 9 }).length
  if (!f.endsWith('.glb')) { console.log(f.split('/').slice(-1)[0].padEnd(22), (buf.length / 1048576).toFixed(2), 'MB  gz', (gz / buf.length * 100).toFixed(0) + '%'); continue }
  const doc = await io.read(f), root = doc.getRoot()
  let tex = 0; const t = []
  for (const x of root.listTextures()) { const n = x.getImage().byteLength; tex += n; t.push((x.getSize() || []).join('x') + ' ' + x.getMimeType().split('/')[1] + ' ' + (n / 1024).toFixed(0) + 'K') }
  const v = root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + p.getAttribute('POSITION').getCount(), 0), 0)
  console.log(f.split('/').slice(-1)[0].padEnd(22), (buf.length / 1048576).toFixed(2), 'MB  tex', (tex / 1048576).toFixed(2), 'geo', ((buf.length - tex) / 1048576).toFixed(2), 'verts', v, 'gz', (gz / buf.length * 100).toFixed(0) + '%', '|', t.join(', '))
}
