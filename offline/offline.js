// ============================================================================
// DoomZone mod — OFFLINE: the Settings rows of the web app (split build, where
// game/preload.js registers sw.js). Which maps this device can open offline,
// a button that saves the rest (their asset files fetched through the service
// worker, which keeps them), and Install where the browser offers it
// (beforeinstallprompt: Chrome / Edge / Android). Hidden in a --single build
// or when opened from a file.
// ============================================================================

var SXOF = { prompt: null, busy: false }
var SXOF_MAPS = [['port', 'Port'], ['waterworks', 'Waterworks'], ['crossroads', 'Crossroads'], ['desert', 'Desert']]

addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); SXOF.prompt = e; SXOF_sync() })
addEventListener('appinstalled', function () { SXOF.prompt = null; SXOF_sync() })

function SXOF_on() { return !!(window.SXL && SXL.sw && window.caches) }
// [ [map, label, filesMissing[]], … ] from the worker's asset cache
function SXOF_scan() {
  return caches.open('dz-assets').then(function (c) {
    return Promise.all(SXOF_MAPS.map(function (m) {
      var list = SXL.want(m[0], false)
      return Promise.all(list.map(function (a) { return c.match(new URL(a[1], location.href).href) })).then(function (hits) {
        return [m[0], m[1], list.filter(function (a, i) { return !hits[i] })]
      })
    }))
  })
}
function SXOF_mb(n) { return (n / 1048576).toFixed(1) + ' MB' }

function SXOF_panel() {
  var pane = document.querySelector('#ui .menu .panel-b[data-pane="settings"]')
  if (!pane || !SXOF_on() || pane.querySelector('.sxof-row')) return
  var box = document.createElement('div')
  box.innerHTML =
    '<div class="row sxof-row"><label id="l-sxof">Offline play</label><div class="sxof">' +
    '<span data-sxof-s>Checking…</span><button class="btn small" data-sxof-save hidden>Save all maps</button>' +
    '<button class="btn small" data-sxof-inst hidden>Install app</button></div></div>' +
    '<p class="panel-note sxof-row" data-sxof-n></p>'
  while (box.firstChild) pane.appendChild(box.firstChild)
  pane.querySelector('[data-sxof-save]').addEventListener('click', SXOF_saveAll)
  pane.querySelector('[data-sxof-inst]').addEventListener('click', function () {
    var p = SXOF.prompt
    if (!p) return
    SXOF.prompt = null
    p.prompt()
    ;(p.userChoice || Promise.resolve()).then(SXOF_sync, SXOF_sync)
  })
  SXOF_sync()
}
function SXOF_sync() {
  var pane = document.querySelector('#ui .menu .panel-b[data-pane="settings"]')
  var s = pane && pane.querySelector('[data-sxof-s]')
  if (!s) return
  var save = pane.querySelector('[data-sxof-save]'), inst = pane.querySelector('[data-sxof-inst]'), note = pane.querySelector('[data-sxof-n]')
  inst.hidden = !SXOF.prompt
  note.textContent = SXOF.prompt ? 'Install puts DoomZone on your home screen / app list, full screen.'
    : /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'To install: Safari → Share → Add to Home Screen.'
      : 'Installed or not, the game opens offline once a map is saved. Online rooms still need internet.'
  if (SXOF.busy) return
  SXOF_scan().then(function (maps) {
    var ready = maps.filter(function (m) { return !m[2].length }).map(function (m) { return m[1] })
    var miss = {}
    maps.forEach(function (m) { m[2].forEach(function (a) { miss[a[0]] = a }) })
    var left = Object.keys(miss).reduce(function (n, k) { return n + miss[k][2] }, 0)
    s.textContent = ready.length ? 'Offline: ' + ready.join(', ') + ' (' + ready.length + '/4 maps)' : 'No map saved for offline yet'
    save.hidden = !left
    save.textContent = 'Save all maps · ' + SXOF_mb(left)
  }).catch(function () { s.textContent = 'Offline play is not available in this browser' })
}
// fetch every missing file through the worker (it keeps them), a few at a time
function SXOF_saveAll() {
  if (SXOF.busy) return
  var pane = document.querySelector('#ui .menu .panel-b[data-pane="settings"]')
  var s = pane.querySelector('[data-sxof-s]'), save = pane.querySelector('[data-sxof-save]')
  SXOF.busy = true
  save.hidden = true
  SXOF_scan().then(function (maps) {
    var miss = {}
    maps.forEach(function (m) { m[2].forEach(function (a) { miss[a[0]] = a }) })
    var list = Object.keys(miss).map(function (k) { return miss[k] })
    var total = list.reduce(function (n, a) { return n + a[2] }, 0), got = 0, fails = 0, i = 0
    var show = function () { s.textContent = 'Saving ' + SXOF_mb(got) + ' / ' + SXOF_mb(total) + '…' }
    show()
    var next = function () {
      if (i >= list.length) return Promise.resolve()
      var a = list[i++]
      return fetch(a[1]).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer() })
        .then(function () { got += a[2]; show() }, function () { fails++ }).then(next)
    }
    return Promise.all([next(), next(), next()]).then(function () {
      SXOF.busy = false
      SXOF_sync()
      if (fails) s.textContent += ' · ' + fails + ' file(s) failed, try again'
    })
  }).catch(function () { SXOF.busy = false; SXOF_sync() })
}

;(function SXOF_boot() {
  var wait = function () {
    if (!window.__ready || !document.querySelector('#ui .menu .panel-b[data-pane="settings"]')) { setTimeout(wait, 400); return }
    SXOF_panel()
    // fresh numbers whenever the panel opens
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-act="settings"]')
      if (b) setTimeout(SXOF_sync, 50)
    })
  }
  setTimeout(wait, 600)
})()
