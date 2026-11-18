// Asset preload (split build, the default: see build.py). The models and
// textures sit beside the page in assets/, under content-hashed names, so a
// browser keeps them across updates and a deploy only sends the files that
// changed. This runs in the <head>, before the game script arrives, and starts
// downloading the files the chosen map uses; boot (SX_bootAssets in
// common/common.js) waits for them on the loading bar. A --single build embeds
// the files in the script instead and leaves the list empty.
;(function () {
  // [key, url, bytes, feature folder], filled in by build.py
  var LIST = /*@@ASSET_LIST@@*/[]
  // features whose files only one map uses; every other file loads on all maps
  var ONLY = { desert: 'desert', aircraft: 'desert', cars: 'desert', jets: 'desert', crossroads: 'crossroads' }
  // features whose files do not hold up boot: they download right after it
  // (SX_assetLater in common/common.js) and their code swaps the procedural
  // stand-in for the model when it lands (helicopters, cars, jets)
  var LATE = { aircraft: 1, cars: 1, jets: 1 }
  var jobs = {}

  // the map boot will build: the same rule as SX_MAP in desert/desert.js
  function mapName() {
    var m = null
    try { m = new URLSearchParams(location.search).get('map') } catch (e) { m = null }
    if (m !== 'desert' && m !== 'port' && m !== 'crossroads' && m !== 'waterworks') {
      try { m = localStorage.getItem('doomzone.map') } catch (e) { m = null }
    }
    return m === 'desert' || m === 'crossroads' || m === 'waterworks' ? m : 'port'
  }
  // the files this map uses; late: true / false keeps only the late / the boot ones
  // single files another map borrows, late there: the desert's Crossroads-
  // style houses (houses/houses.js) use the old-apartment model and its brick
  var ALSO = { cx_oldap: 'desert', cx_skin_oabrick: 'desert' }
  function want(map, all, late) {
    return LIST.filter(function (a) {
      var also = ALSO[a[0]] === map
      if (late != null && (!!LATE[a[3]] || also) !== late) return false
      return all || !ONLY[a[3]] || ONLY[a[3]] === map || also
    })
  }
  // one download (retried once): job.got counts the bytes in so far,
  // job.bytes resolves to a Uint8Array
  function load(a) {
    if (jobs[a[0]]) return jobs[a[0]]
    var job = (jobs[a[0]] = { key: a[0], size: a[2], got: 0 })
    job.bytes = (async function () {
      for (var t = 0; ; t++) {
        try {
          var r = await fetch(a[1])
          if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + a[1])
          var rd = r.body && r.body.getReader ? r.body.getReader() : null
          if (!rd) {
            var whole = new Uint8Array(await r.arrayBuffer())
            job.got = whole.length
            return whole
          }
          var parts = [], n = 0
          for (;;) {
            var c = await rd.read()
            if (c.done) break
            parts.push(c.value)
            n += c.value.length
            job.got = n
          }
          var out = new Uint8Array(n), o = 0
          parts.forEach(function (p) { out.set(p, o); o += p.length })
          return out
        } catch (e) {
          job.got = 0
          if (t >= 1) throw e
        }
      }
    })()
    job.bytes.catch(function () { })
    return job
  }
  // the loading bar's first `share` while `jobs` download (MB in the message).
  // Runs from here, so it moves while the game script is still arriving;
  // SX_bootAssets ends it (L.show(null)) before boot's own steps take the bar.
  var shown = null, timer = 0, share = 0.4
  function show(list) {
    shown = list
    if (!list || !list.length) { clearInterval(timer); timer = 0; return }
    function tick() {
      if (!shown) return
      var got = 0, total = 0
      shown.forEach(function (j) { got += Math.min(j.got, j.size); total += j.size })
      var msg = document.getElementById('boot-msg'), fill = document.getElementById('boot-fill')
      if (msg) msg.textContent = 'Downloading models ' + (got / 1048576).toFixed(1) + ' / ' + (total / 1048576).toFixed(1) + ' MB'
      if (fill) fill.style.width = Math.round((share * 100 * got) / (total || 1)) + '%'
      shown.got = got
    }
    tick()
    if (!timer) timer = setInterval(tick, 100)
  }
  // Web app (split build over http/https): sw.js (game/sw.js) keeps the page
  // and the models this device has used, so the game opens offline and can be
  // installed. warm() runs once boot and the late files are in (common.js):
  // it fetches this map's files (plus the Google Fonts the page loaded)
  // through the worker so they land in its cache — on a first visit they came
  // in before the worker ran (straight from the HTTP cache now, no download).
  var swOk = LIST.length && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)
  function controlled() {
    return new Promise(function (ok) {
      if (navigator.serviceWorker.controller) { ok(); return }
      navigator.serviceWorker.addEventListener('controllerchange', function () { ok() }, { once: true })
    })
  }
  function warm(list) {
    if (!swOk) return Promise.resolve(0)
    return navigator.serviceWorker.ready.then(controlled).then(function () {
      var urls = (list || want(mapName(), /[?&]show=/.test(location.search))).map(function (a) { return a[1] })
      if (!list) try {
        performance.getEntriesByType('resource').forEach(function (r) { if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(r.name)) urls.push(r.name) })
      } catch (e) { }
      return Promise.all(urls.map(function (u) {
        return fetch(u, /^https:\/\/fonts\./.test(u) ? { mode: 'no-cors' } : undefined).then(function (r) { return r.ok || r.type === 'opaque' ? 1 : 0 }, function () { return 0 })
      })).then(function (n) { return n.reduce(function (s, x) { return s + x }, 0) })
    })
  }
  if (swOk) {
    addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('[sw] not registered: ' + ((e && e.message) || e)) })
    })
  }
  window.SXL = { list: LIST, map: mapName, want: want, load: load, show: show, share: share, warm: warm, sw: !!swOk }
  try {
    var first = want(mapName(), /[?&]show=/.test(location.search), false), early = {}, vals = {}
    first.forEach(function (a) { early[a[0]] = true })
    // the SX_ASSET_<key> globals boot sets; reading one this map uses before
    // that (code run while the bundle loads: use SX_afterAssets) says so,
    // instead of the feature quietly keeping its procedural stand-in
    LIST.forEach(function (a) {
      var key = a[0]
      Object.defineProperty(window, 'SX_ASSET_' + key, {
        configurable: true,
        get: function () {
          if (!(key in vals) && early[key]) { early[key] = false; console.warn('[assets] ' + key + ' read before it was downloaded') }
          return vals[key]
        },
        set: function (v) { vals[key] = v },
      })
    })
    show(first.map(load))
  } catch (e) { }
})()
