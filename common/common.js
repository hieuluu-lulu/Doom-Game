// ============================================================================
// DoomZone mod — COMMON helpers shared by the other features (always built,
// first). lib/10_gltfloader.js is three.js r180's GLTFLoader running on the
// bundle's own three.js (SX_GLTFLoader).
// ============================================================================

// Settings saved by builds from before the renames lived under the earlier
// game names' prefixes ('salt' + 'line.', then 'war' + 'zone.'): copy them to
// the 'doomzone.' keys once (the newer name wins when both exist), so graphics
// settings, the chosen map and the player name survive the update. Runs while
// the bundle loads, before the game reads its settings at boot.
;(function SX_migrateStorage() {
  try {
    // joined at runtime so no rename or build step folds them back
    ;[['war', 'zone.'].join(''), ['salt', 'line.'].join('')].forEach(function (old) {
      var keys = []
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(old) === 0) keys.push(k) }
      keys.forEach(function (k) {
        var nk = 'doomzone.' + k.slice(old.length)
        if (localStorage.getItem(nk) == null) localStorage.setItem(nk, localStorage.getItem(k))
      })
    })
  } catch (e) { }
})()

function SX_b64Bytes(b64) {
  var bin = atob(b64), out = new Uint8Array(bin.length)
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// an embedded .glb (base64 string) -> Promise<gltf>
function SX_parseGLB(b64) {
  return new Promise(function (ok, fail) {
    if (typeof b64 !== 'string' || typeof SX_GLTFLoader !== 'function') { fail(new Error('glb asset or loader missing')); return }
    try { new SX_GLTFLoader().parse(SX_b64Bytes(b64).buffer, '', ok, fail) } catch (e) { fail(e) }
  })
}

// an embedded image (base64 jpeg / png) -> Promise<HTMLImageElement>
function SX_image(b64, mime) {
  var img = new Image()
  img.src = 'data:' + (mime || 'image/jpeg') + ';base64,' + b64
  return img.decode().then(function () { return img })
}

// a promise that gives up after `ms` (boot must never hang on an asset)
function SX_timeout(p, ms, what) {
  return Promise.race([p, new Promise(function (_, fail) { setTimeout(function () { fail(new Error((what || 'asset') + ' timed out')) }, ms) })])
}

// bytes -> base64 (native: toBase64 where the browser has it, else a data: URL)
function SX_bytesB64(b) {
  if (typeof b.toBase64 === 'function') return Promise.resolve(b.toBase64())
  return new Promise(function (ok, fail) {
    var fr = new FileReader()
    fr.onload = function () { var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)) }
    fr.onerror = function () { fail(fr.error) }
    fr.readAsDataURL(new Blob([b]))
  })
}

// Split build (game/preload.js): the first stretch of the loading bar (SXL.share)
// is the asset download; Nr (10_game.js) fits the boot steps into the rest.
var SX_BOOT_BASE = 0
var SX_BOOT_TUNE = { stallMs: 30000 }
var SX_ASSETS_WAIT = [] // starters queued by SX_afterAssets, null once the assets are in
// Code that reads SX_ASSET_* while the bundle loads (before boot) goes through
// this: a --single build has them already, so fn runs now; a split build runs
// it once SX_bootAssets has set them.
function SX_afterAssets(fn) {
  var L = window.SXL
  if (!SX_ASSETS_WAIT || !L || !L.list || !L.list.length) fn()
  else SX_ASSETS_WAIT.push(fn)
}
function SX_assetsIn() {
  var q = SX_ASSETS_WAIT || []
  SX_ASSETS_WAIT = null
  q.forEach(function (fn) { try { fn() } catch (e) { console.error('[assets] starter failed', e) } })
}
// Waits for the files this map uses (preload.js started them in the <head> and
// shows their MB on the loading bar), then sets each as the SX_ASSET_<key>
// base64 global the features read — the same string a --single build embeds.
// A file that fails leaves its global unset, so that feature keeps its
// procedural stand-in; a download that stops moving for stallMs ends the wait.
async function SX_bootAssets(params) {
  SX_ASSET_ALL = !!(params && params.show)
  try { await SX_fetchAssets(params) } finally {
    SX_assetsIn()
    // then the late files (preload.js LATE) of this map, in the background
    var L = window.SXL
    if (L && L.list && L.list.length) {
      var late = L.want(SX_assetMap(), SX_ASSET_ALL, true).map(function (a) { return SX_assetLater(a[0]) })
      // all in: this map's files into the offline cache (sw.js, preload.js warm)
      if (L.warm) Promise.all(late).then(function () { return L.warm() }).catch(function () { })
    }
  }
}
var SX_ASSET_ALL = false // ?show=: every file, whatever the map
var SX_LATER = {}
function SX_assetMap() { return typeof SX_MAP !== 'undefined' ? SX_MAP : window.SXL ? window.SXL.map() : 'port' }
// Promise<base64 string | null> of one asset, for code that can wait for it
// (a late file downloads after boot). `have` is the SX_ASSET_<key> value the
// caller already sees (a --single build embeds it: resolved at once). A split
// build downloads the file only if this map uses it, else null — as for a
// file that fails, the caller keeps its procedural stand-in.
function SX_assetLater(key, have) {
  if (typeof have === 'string') return Promise.resolve(have)
  if (SX_LATER[key]) return SX_LATER[key]
  var L = window.SXL, a = null
  if (L && L.list && L.list.length) a = L.want(SX_assetMap(), SX_ASSET_ALL).find(function (x) { return x[0] === key }) || null
  if (!a) return (SX_LATER[key] = Promise.resolve(null))
  SX_LATER[key] = L.load(a).bytes.then(SX_bytesB64).then(function (s) { window['SX_ASSET_' + key] = s; return s }, function (e) {
    window['SX_ASSET_' + key] = undefined
    console.warn('[assets] ' + key + ' not loaded, its procedural stand-in stays: ' + ((e && e.message) || e))
    return null
  })
  return SX_LATER[key]
}
async function SX_fetchAssets(params) {
  var L = window.SXL
  if (!L || !L.list || !L.list.length) return
  var map = typeof SX_MAP !== 'undefined' ? SX_MAP : L.map()
  var jobs = L.want(map, !!(params && params.show), false).map(L.load)
  if (!jobs.length) return
  SX_BOOT_BASE = L.share
  L.show(jobs)
  if (location.protocol === 'file:') console.warn('[assets] opened from a file: the models need a web server (or build with --single)')
  var done = Promise.all(jobs.map(function (j) {
    return j.bytes.then(SX_bytesB64).then(function (s) { window['SX_ASSET_' + j.key] = s }, function (e) {
      window['SX_ASSET_' + j.key] = undefined // settled: preload.js's early-read warning stays quiet
      console.warn('[assets] ' + j.key + ' not loaded, its procedural stand-in stays: ' + ((e && e.message) || e))
    })
  }))
  var last = -1, lastT = Date.now(), timer = 0
  await new Promise(function (ok) {
    done.then(ok)
    timer = setInterval(function () {
      if (jobs.got !== last) { last = jobs.got; lastT = Date.now() }
      else if (Date.now() - lastT > SX_BOOT_TUNE.stallMs) { console.warn('[assets] download stalled, booting without the rest'); ok() }
    }, 500)
  })
  clearInterval(timer)
  L.show(null)
}
