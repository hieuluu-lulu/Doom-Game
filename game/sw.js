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
var VERSION = /*@@SW_VERSION@@*/'dev'
var ASSETS = /*@@SW_ASSETS@@*/[]
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
