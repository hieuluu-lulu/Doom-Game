import sharp from 'sharp'
const [src, outDir] = process.argv.slice(2)
const C = { brick: [200, 220, 280, 620, 256, 512], quoin: [544, 1170, 100, 860, 64, 512], win: [820, 1150, 360, 720, 192, 384], sash: [1686, 1350, 314, 560, 192, 320], cornice: [190, 910, 1490, 80, 512, 32], band: [540, 1000, 1160, 150, 512, 64] }
for (const k in C) { const [x, y, w, h, ow, oh] = C[k]; await sharp(src).extract({ left: x, top: y, width: w, height: h }).resize(ow, oh).webp({ quality: 82 }).toFile(outDir + '/cx_skin_' + k + '.webp') }
