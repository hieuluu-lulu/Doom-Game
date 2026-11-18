// DoomZone service worker (split build: build.py writes it to dist/sw.js with
// the version and the asset list filled in; game/preload.js registers it).
// After one visit the game opens offline, with the maps this device has played
// (offline/offline.js can fetch the rest).
//  * the page (index.html, ./?…): network first, the saved copy when offline,
//    so a deploy shows up on the next load
//  * assets/<name>.<hash>.<ext>: cache first — a hashed name never changes
//  * manifest, icons: network first
//  * Google Fonts: cache first
// Anything else (PeerJS signalling, STUN…) is left alone. Each build changes
// VERSION, so the browser installs the new worker; it takes over at once and
// drops cached assets the new build no longer lists.
var VERSION = "03ac2397a8c9"
var ASSETS = ["assets/road_ludlow.9c636c57a8.webp", "assets/cx_ap13.08afcd16fc.glb", "assets/cx_fence.a791224277.glb", "assets/cx_oldap.adbd309dd6.glb", "assets/cx_shops.ec37009771.glb", "assets/cx_skin_band.6f4b8a2922.webp", "assets/cx_skin_brick.c6b752404f.webp", "assets/cx_skin_cornice.786df41cb8.webp", "assets/cx_skin_oabrick.76b5d958c0.webp", "assets/cx_skin_quoin.c3129be403.webp", "assets/cx_skin_sash.02b3d5a521.webp", "assets/cx_skin_win.1e3ede2398.webp", "assets/cx_stair.c2fbe15f8f.glb", "assets/cx_street.be884334a8.glb", "assets/deagle.636ac689e2.glb", "assets/knife.775d9bfaf7.glb", "assets/prop_ammo.1fecb4a416.glb", "assets/prop_attcase.28b2148392.glb", "assets/prop_frag.c6943ddd99.glb", "assets/prop_helmet.bbcd7812ae.glb", "assets/prop_medkit.d7f42b1fd0.glb", "assets/prop_meds.53f52c62a9.glb", "assets/prop_nadecrate.e64ab180d0.glb", "assets/prop_vest.db30bd6e17.glb", "assets/scope4x.71b96a9cf8.glb", "assets/shotgun.7d1a7cae46.glb", "assets/sniper.182c24aebf.glb", "assets/apache.b4747b1a3c.glb", "assets/gazelle.72ccb10826.glb", "assets/buggy.dc8ae32185.glb", "assets/tmv.d01c95748d.glb", "assets/harrow.6dd6f99717.glb", "assets/petrel.5da6c97d48.glb", "assets/su57.3d95e8fa52.glb", "assets/soldier.65befbd29e.glb"]
var PAGE = 'dz-page', FILES = 'dz-assets', FONTS = 'dz-fonts'

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(PAGE).then(function (c) { return c.addAll(['./', 'manifest.webmanifest']) }).catch(function () { }).then(function () { return self.skipWaiting() }))
})

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keep = {}
    ASSETS.forEach(function (p) { keep[new URL(p, self.registration.scope).href] = true })
    var c = await caches.open(FILES)
    var reqs = await c.keys()
    await Promise.all(reqs.map(function (r) { return keep[r.url] ? null : c.delete(r) }))
    await self.clients.claim()
  })())
})

function cacheFirst(name, req) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(function () { })
        return res
      })
    })
  })
}
// the page is kept under one key (the scope URL), whatever its ?query
function networkFirst(req, key) {
  return fetch(req).then(function (res) {
    if (res && res.ok) caches.open(PAGE).then(function (c) { return c.put(key || req, res.clone()) }).catch(function () { })
    return res
  }, function (err) {
    return caches.open(PAGE).then(function (c) {
      return c.match(key || req, { ignoreSearch: true }).then(function (hit) { if (hit) return hit; throw err })
    })
  })
}

self.addEventListener('fetch', function (e) {
  var req = e.request
  if (req.method !== 'GET') return
  var url = new URL(req.url)
  if (url.origin === self.location.origin) {
    var scope = self.registration.scope
    if (url.href.indexOf(scope + 'assets/') === 0) { e.respondWith(cacheFirst(FILES, req)); return }
    if (req.mode === 'navigate' || url.href.split('?')[0] === scope || url.href.split('?')[0] === scope + 'index.html') {
      e.respondWith(networkFirst(req, scope))
      return
    }
    if (url.href.split('?')[0] === self.location.href) return // this worker itself
    e.respondWith(networkFirst(req))
    return
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(cacheFirst(FONTS, req))
})
