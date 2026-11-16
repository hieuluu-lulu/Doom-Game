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
