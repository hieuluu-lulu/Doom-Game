// DoomZone favicon: "DOOM" (signal orange) over "ZONE" (bone) in the logo's
// font (Big Shoulders Display 900) on the ink tile, rendered at each size
// usage: node tools/favicon.cjs game/favicon   (needs playwright-core + Google Chrome; then python3 build.py)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const n of [32, 64, 180]) {
    const p = await b.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
    const r = Math.round(n * 0.16), fs = n * 0.41, pad = n * 0.06, bar = Math.max(1, Math.round(n * 0.045));
    await p.setContent(`<!doctype html><html><head>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&display=block">
      <style>html,body{margin:0;background:transparent}
      .t{width:${n}px;height:${n}px;box-sizing:border-box;border-radius:${r}px;background:#0b0d0f;display:flex;flex-direction:column;justify-content:center;align-items:center;
         box-shadow:inset 0 0 0 ${Math.max(1, Math.round(n * 0.03))}px rgba(255,179,71,.55);overflow:hidden}
      .l{font:900 ${fs}px/0.86 "Big Shoulders Display",Impact,sans-serif;letter-spacing:${(n * 0.004).toFixed(2)}px;transform:scaleX(1.0)}
      .a{color:#ffb347}.b{color:#e8e4da}
      .bar{width:${(n * 0.56).toFixed(1)}px;height:${bar}px;background:#ffb347;margin:${(n * 0.035).toFixed(1)}px 0 ${(n * 0.03).toFixed(1)}px;opacity:.9}
      </style></head><body><div class="t"><div class="l a">DOOM</div><div class="bar"></div><div class="l b">ZONE</div></div></body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    const fam = await p.evaluate(() => document.fonts.check('900 20px "Big Shoulders Display"'));
    await p.locator('.t').screenshot({ path: `${out}/doomzone-${n}.png`, omitBackground: true });
    console.log(n, 'font loaded:', fam);
    await p.close();
  }
  await b.close();
})();
