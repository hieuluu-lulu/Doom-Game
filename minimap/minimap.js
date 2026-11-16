// ============================================================================
// DoomZone mod — MINIMAP + full map (PUBG-style)
// Corner minimap (north up, follows the player) and a full-screen map on M:
// wheel zooms, drag pans, click drops a waypoint (right-click clears it), M or
// Esc closes. The base image is painted once: on the desert from the terrain
// height grid (hill-shading) + every collider footprint; on the port from the
// colliders over asphalt and sea. Live layer: you, relays, extraction,
// outposts, vehicles, allies, bosses, your waypoint.
// ============================================================================

var SXM = null

function SXM_init(G) {
  try {
    SXM = SXM_build(G)
    G.minimap = SXM
  } catch (err) {
    console.error('[minimap] disabled: ' + (err && err.stack || err))
  }
}

function SXM_build(G) {
  var desert = typeof SX_MAP !== 'undefined' && SX_MAP === 'desert' && typeof SXD_HG !== 'undefined' && SXD_HG
  var plant = typeof SX_MAP !== 'undefined' && SX_MAP === 'waterworks'
  var city = typeof SX_MAP !== 'undefined' && SX_MAP === 'crossroads' || plant
  var W = desert
    ? { x0: SXD_HG.x0, z0: SXD_HG.z0, size: (SXD_HG.n - 1) * SXD_HG.step, major: 200, minor: 100, mini: 90, name: 'Dust Basin' }
    : plant ? { x0: -30, z0: -30, size: 60, major: 10, minor: 5, mini: 20, name: 'Waterworks' }
    : city ? { x0: -53, z0: -53, size: 106, major: 10, minor: 5, mini: 24, name: 'Crossroads' }
    : { x0: -62, z0: -55, size: 110, major: 20, minor: 10, mini: 28, name: 'DoomZone Terminal' }
  var IMG = desert ? 1024 : 768
  var base = document.createElement('canvas')
  base.width = base.height = IMG
  var t0 = performance.now()
  paintBase()
  console.log('[minimap] base map ' + IMG + 'px in ' + Math.round(performance.now() - t0) + 'ms')

  function paintBase() {
    var ctx = base.getContext('2d')
    var mpp = W.size / IMG
    var img = ctx.createImageData(IMG, IMG), d = img.data
    var rnd = function (i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x) }
    if (desert) {
      var H = new Float32Array(IMG * IMG)
      for (var py = 0; py < IMG; py++)
        for (var px = 0; px < IMG; px++) H[py * IMG + px] = SXD_heightAt(W.x0 + (px + 0.5) * mpp, W.z0 + (py + 0.5) * mpp)
      var Lx = -0.52, Ly = 0.68, Lz = -0.52
      for (var y = 0; y < IMG; y++)
        for (var x = 0; x < IMG; x++) {
          var i = y * IMG + x
          var h = H[i]
          var gx = (H[y * IMG + Math.min(IMG - 1, x + 1)] - H[y * IMG + Math.max(0, x - 1)]) / (2 * mpp)
          var gz = (H[Math.min(IMG - 1, y + 1) * IMG + x] - H[Math.max(0, y - 1) * IMG + x]) / (2 * mpp)
          var nl = Math.hypot(gx, 1, gz)
          var shade = ((-gx * Lx + Ly - gz * Lz) / nl) * 1.3
          shade = Math.max(0.42, Math.min(1.2, shade))
          var slope = Math.hypot(gx, gz)
          var rock = Math.max(0, Math.min(1, (slope - 0.95) / 0.6))
          var hk = Math.min(1, h / 22)
          var r = 226 - 18 * hk, g = 203 - 26 * hk, b = 158 - 30 * hk
          if (h < 0.2) { r = 206; g = 190; b = 158 }
          r = r * (1 - rock) + 172 * rock; g = g * (1 - rock) + 116 * rock; b = b * (1 - rock) + 80 * rock
          var n = 0.94 + 0.08 * rnd(i)
          d[i * 4] = Math.min(255, r * shade * n)
          d[i * 4 + 1] = Math.min(255, g * shade * n)
          d[i * 4 + 2] = Math.min(255, b * shade * n)
          d[i * 4 + 3] = 255
        }
    } else {
      var quay = typeof oi !== 'undefined' ? oi.quayX : 30
      for (var y2 = 0; y2 < IMG; y2++)
        for (var x2 = 0; x2 < IMG; x2++) {
          var j = y2 * IMG + x2, wx = W.x0 + (x2 + 0.5) * mpp
          var sea = wx > quay
          var nn = 0.92 + 0.12 * rnd(j)
          d[j * 4] = (sea ? 34 : 70) * nn
          d[j * 4 + 1] = (sea ? 58 : 73) * nn
          d[j * 4 + 2] = (sea ? 74 : 76) * nn
          d[j * 4 + 3] = 255
        }
    }
    ctx.putImageData(img, 0, 0)
    // the desert highway (desert.js SXD_ROAD): asphalt band + centre line
    if (desert && typeof SXD_ROAD !== 'undefined' && SXD_ROAD) {
      var R = SXD_ROAD, line = function (w, col) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath()
        for (var k = 0; k < R.n; k += 2) { var px2 = (R.x[k] - W.x0) / mpp, pz2 = (R.z[k] - W.z0) / mpp; k ? ctx.lineTo(px2, pz2) : ctx.moveTo(px2, pz2) }
        ctx.stroke()
      }
      line(Math.max(3, 13 / mpp), 'rgba(96,92,86,0.9)')
      line(Math.max(1, 0.8 / mpp), 'rgba(226,186,70,0.85)')
    }
    // collider footprints = buildings, containers, walls, rocks
    var boxes = G.physics && G.physics.boxes || []
    var toPx = function (wx, wz) { return [(wx - W.x0) / mpp, (wz - W.z0) / mpp] }
    // waterworks: the settling basin's water under the footprints
    if (plant && typeof WW_BASIN !== 'undefined') {
      var bq = toPx(WW_BASIN.x0 + 0.5, WW_BASIN.z0 + 0.5), bw = (WW_BASIN.x1 - WW_BASIN.x0 - 1) / mpp, bd = (WW_BASIN.z1 - WW_BASIN.z0 - 1) / mpp
      ctx.fillStyle = 'rgba(58,78,74,0.95)'
      ctx.fillRect(bq[0], bq[1], bw, bd)
    }
    boxes.forEach(function (bx) {
      if (bx.playerOnly || bx.bulletOnly || bx.tag === 'roof') return
      var w = bx.max.x - bx.min.x, dd = bx.max.z - bx.min.z
      if (w > 60 || dd > 60) return
      var a = toPx(bx.min.x, bx.min.z)
      var tall = bx.max.y > 2.4
      ctx.fillStyle = desert ? (tall ? 'rgba(88,72,54,0.92)' : 'rgba(120,100,76,0.85)') : (tall ? 'rgba(128,134,140,0.95)' : 'rgba(104,108,112,0.9)')
      ctx.fillRect(a[0], a[1], Math.max(1, w / mpp), Math.max(1, dd / mpp))
      ctx.strokeStyle = desert ? 'rgba(52,40,28,0.9)' : 'rgba(30,32,34,0.9)'
      ctx.lineWidth = 1
      ctx.strokeRect(a[0] + 0.5, a[1] + 0.5, Math.max(1, w / mpp) - 1, Math.max(1, dd / mpp) - 1)
    })
    if (!desert && !city) {
      var q = toPx(typeof oi !== 'undefined' ? oi.quayX : 30, 0)
      ctx.strokeStyle = 'rgba(210,200,170,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(q[0], 0); ctx.lineTo(q[0], IMG); ctx.stroke()
    }
  }

  // ------------------------------------------------------------ live state
  var V3 = lt.Vector3
  var cut = {}
  var wp = null
  G.events.on('objective:done', function (ev) { if (ev && ev.id) cut[ev.id] = true })
  var origReset = G.weapon && G.weapon.reset
  if (origReset) G.weapon.reset = function () { var r = origReset.apply(this, arguments); cut = {}; wp = null; return r }

  function markers() {
    var out = [], lv = G.level || {}, U = typeof SXU !== 'undefined' ? SXU : null, P = G.player
    // no relay mission in a room (net/net.js): no relays, no boat on the map
    var objs = window.SXN_MP ? [] : lv.objectives || []
    ;objs.forEach(function (o) {
      var letter = (o.id || '').split('_').pop().toUpperCase().slice(0, 1) || '?'
      out.push({ x: o.pos.x, z: o.pos.z, kind: 'relay', text: letter, done: !!cut[o.id] })
    })
    var allCut = objs.length && objs.every(function (o) { return cut[o.id] })
    if (lv.extraction && lv.extraction.pos && !window.SXN_MP) out.push({ x: lv.extraction.pos.x, z: lv.extraction.pos.z, kind: 'extract', text: 'EX', done: !allCut })
    if (U) {
      ;(U.outposts || []).forEach(function (s) { out.push({ x: s.def.x, z: s.def.z, kind: 'outpost', text: s.def.name, hostile: s.status === 'hostile', left: s.left }) })
      U.list.forEach(function (u) {
        if (!u.alive) return
        var air = u.solid && u.solid.air || u.type === 'kestrel' || u.type === 'skua' || u.type === 'petrel'
        if (air) {
          if (U.pilot === u) return
          var hd = u.heading != null ? u.heading : u.yaw != null ? u.yaw : u.vel && (u.vel.x || u.vel.z) ? Math.atan2(-u.vel.x, -u.vel.z) : 0
          var foe = u.faction !== 'ally'
          if (!foe || (P && u.pos.distanceTo(P.pos) < 400)) out.push({ x: u.pos.x, z: u.pos.z, kind: 'jet', enemy: foe, rot: -hd, text: u.label })
          return
        }
        if (u.vehicle) { if (U.pilot !== u) out.push({ x: u.pos.x, z: u.pos.z, kind: 'vehicle', text: (u.label || '?').slice(0, 1).toUpperCase() }) }
        else if (u.faction === 'ally') out.push({ x: u.pos.x, z: u.pos.z, kind: 'ally' })
        else if (u.boss && P && u.pos.distanceTo(P.pos) < 260) out.push({ x: u.pos.x, z: u.pos.z, kind: 'boss', text: u.label })
      })
    }
    if (typeof SXN_mapMarkers === 'function') { try { SXN_mapMarkers().forEach(function (m) { out.push(m) }) } catch (e) { } }
    if (wp) out.push({ x: wp.x, z: wp.z, kind: 'wp' })
    return out
  }

  function drawMarker(ctx, m, sx, sy, s, full) {
    ctx.save()
    ctx.translate(sx, sy)
    var lw = Math.max(1.2, s * 0.14)
    ctx.lineWidth = lw
    if (m.kind === 'relay' || m.kind === 'extract') {
      var col = m.kind === 'extract' ? '#7dffb0' : m.done ? 'rgba(232,228,218,0.45)' : '#ffb347'
      ctx.strokeStyle = col; ctx.fillStyle = 'rgba(11,13,15,0.7)'
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = col; ctx.font = '700 ' + Math.round(s * 0.95) + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(m.text, 0, 0.5)
    } else if (m.kind === 'outpost') {
      var oc = m.hostile ? '#ff5a40' : '#7fd6ff'
      ctx.strokeStyle = oc; ctx.fillStyle = 'rgba(11,13,15,0.55)'
      ctx.beginPath(); ctx.rect(-s, -s, 2 * s, 2 * s); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.5); ctx.lineTo(-s * 0.45, -s * 0.55); ctx.lineTo(s * 0.5, -s * 0.3); ctx.lineTo(-s * 0.45, -s * 0.05); ctx.strokeStyle = oc; ctx.stroke()
      if (full) {
        ctx.font = '700 ' + Math.round(s * 1.05) + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(11,13,15,0.85)'; ctx.strokeText(m.text.toUpperCase(), 0, s * 1.4)
        ctx.fillStyle = oc; ctx.fillText(m.text.toUpperCase(), 0, s * 1.4)
      }
    } else if (m.kind === 'vehicle') {
      ctx.fillStyle = '#7fd6ff'; ctx.strokeStyle = 'rgba(11,13,15,0.9)'
      ctx.beginPath(); ctx.rect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#0b0d0f'; ctx.font = '700 ' + Math.round(s * 1.1) + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.text, 0, 0.5)
    } else if (m.kind === 'ally') {
      ctx.fillStyle = '#7fd6ff'; ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, 6.283); ctx.fill()
    } else if (m.kind === 'jet') {
      // plane silhouette pointing along the heading (north-up map)
      ctx.rotate(m.rot || 0)
      ctx.fillStyle = m.enemy ? '#ff5a40' : '#7fd6ff'; ctx.strokeStyle = 'rgba(11,13,15,0.9)'
      var pts = [[0, -1.25], [0.2, -0.55], [1.1, 0.12], [1.1, 0.4], [0.2, 0.18], [0.14, 0.72], [0.48, 1.0], [0.48, 1.18], [0, 1.04]]
      ctx.beginPath()
      pts.forEach(function (p, i) { i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s) })
      for (var k = pts.length - 2; k > 0; k--) ctx.lineTo(-pts[k][0] * s, pts[k][1] * s)
      ctx.closePath(); ctx.fill(); ctx.stroke()
    } else if (m.kind === 'boss') {
      ctx.fillStyle = '#ff5a40'; ctx.strokeStyle = 'rgba(11,13,15,0.9)'
      ctx.beginPath(); ctx.moveTo(0, -s * 1.1); ctx.lineTo(s * 1.0, s * 0.8); ctx.lineTo(-s * 1.0, s * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke()
    } else if (m.kind === 'wp') {
      ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = 'rgba(11,13,15,0.9)'
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * 0.7, -s * 1.3); ctx.arc(0, -s * 1.5, s * 0.72, Math.PI * 0.85, Math.PI * 0.15, false); ctx.closePath(); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
  }
  function drawPlayer(ctx, sx, sy, yaw, s, fov) {
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(-yaw)
    // view cone
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 6)
    g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 6, -Math.PI / 2 - fov / 2, -Math.PI / 2 + fov / 2); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0b0d0f'; ctx.lineWidth = Math.max(1.2, s * 0.18)
    ctx.beginPath(); ctx.moveTo(0, -s * 1.2); ctx.lineTo(s * 0.8, s * 0.9); ctx.lineTo(0, s * 0.45); ctx.lineTo(-s * 0.8, s * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.restore()
  }
  var font = (function () { try { return getComputedStyle(document.documentElement).getPropertyValue('--f-label').trim() || 'sans-serif' } catch (e) { return 'sans-serif' } })()

  function gridLabel(k) { return String.fromCharCode(65 + k) }

  // ------------------------------------------------------------------- DOM
  var ui = null
  var dpr = Math.min(2, window.devicePixelRatio || 1)
  function buildUi() {
    var h = G.hud && !G.hud.stub ? G.hud : null
    if (!h || !h.root) return
    var mini = document.createElement('div')
    mini.className = 'sxm-mini'
    mini.innerHTML = '<canvas></canvas><b class="sxm-n">N</b><span class="sxm-key">M</span>'
    h.root.appendChild(mini)
    var full = document.createElement('div')
    full.className = 'sxm-full'
    full.innerHTML = '<div class="sxm-frame"><canvas></canvas><div class="sxm-title"></div><div class="sxm-help"></div><button class="sxm-btn sxm-close" aria-label="Close map">✕</button><button class="sxm-btn sxm-zin" aria-label="Zoom in">+</button><button class="sxm-btn sxm-zout" aria-label="Zoom out">−</button></div>'
    document.getElementById('ui').appendChild(full)
    ui = { mini: mini, mc: mini.querySelector('canvas'), full: full, fc: full.querySelector('canvas'), frame: full.querySelector('.sxm-frame'), title: full.querySelector('.sxm-title'), help: full.querySelector('.sxm-help') }
    ui.title.textContent = W.name
    ui.help.textContent = 'M close · wheel zoom · drag pan · click marker · right-click clear'
    mini.addEventListener('click', function () { setOpen(true) })
    mini.addEventListener('touchend', function (e) { e.preventDefault(); setOpen(true) })
    full.querySelector('.sxm-close').addEventListener('click', function (e) { e.stopPropagation(); setOpen(false) })
    full.querySelector('.sxm-zin').addEventListener('click', function (e) { e.stopPropagation(); zoomAt(1.6, null) })
    full.querySelector('.sxm-zout').addEventListener('click', function (e) { e.stopPropagation(); zoomAt(1 / 1.6, null) })
    wireFull()
  }

  // ------------------------------------------------------------- full map
  var F = { open: false, zoom: 1, cx: W.x0 + W.size / 2, cz: W.z0 + W.size / 2, drag: null }
  var api = { open: false, holdPause: false, update: update, setWaypoint: function (x, z) { wp = x == null ? null : new V3(x, 0, z) }, get waypoint() { return wp } }
  function setOpen(on) {
    if (!ui || on === F.open) return
    if (on && (!G.game || G.game.state !== 'playing')) return
    F.open = on
    api.open = on
    ui.full.classList.toggle('on', on)
    if (on) {
      api.holdPause = true
      var P = G.player
      F.zoom = desert ? 2.2 : 1
      F.cx = P ? P.pos.x : F.cx
      F.cz = P ? P.pos.z : F.cz
      clampView()
      try { document.pointerLockElement && document.exitPointerLock() } catch (e) { }
    } else {
      try { G.input && !G.input.touch && G.input.requestLock && G.input.requestLock() } catch (e) { }
      setTimeout(function () { api.holdPause = false }, 400)
    }
  }
  function view() {
    var span = W.size / F.zoom
    return { x0: F.cx - span / 2, z0: F.cz - span / 2, span: span }
  }
  function clampView() {
    F.zoom = Math.max(1, Math.min(desert ? 12 : 4, F.zoom))
    var span = W.size / F.zoom
    F.cx = Math.max(W.x0 + span / 2, Math.min(W.x0 + W.size - span / 2, F.cx))
    F.cz = Math.max(W.z0 + span / 2, Math.min(W.z0 + W.size - span / 2, F.cz))
  }
  function toWorld(ev) {
    var r = ui.fc.getBoundingClientRect(), v = view()
    return { x: v.x0 + ((ev.clientX - r.left) / r.width) * v.span, z: v.z0 + ((ev.clientY - r.top) / r.height) * v.span }
  }
  function zoomAt(k, ev) {
    var before = ev ? toWorld(ev) : { x: F.cx, z: F.cz }
    F.zoom *= k
    clampView()
    if (ev) {
      var after = toWorld(ev)
      F.cx += before.x - after.x; F.cz += before.z - after.z
      clampView()
    }
  }
  function wireFull() {
    var fc = ui.fc
    ui.frame.addEventListener('wheel', function (e) { e.preventDefault(); e.stopPropagation(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e) }, { passive: false })
    fc.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation() })
    fc.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); F.drag = { x: e.clientX, y: e.clientY, cx: F.cx, cz: F.cz, moved: false, btn: e.button } })
    addEventListener('mousemove', function (e) {
      if (!F.open || !F.drag) return
      var r = fc.getBoundingClientRect(), v = view()
      var dx = e.clientX - F.drag.x, dy = e.clientY - F.drag.y
      if (Math.abs(dx) + Math.abs(dy) > 4) F.drag.moved = true
      F.cx = F.drag.cx - (dx / r.width) * v.span
      F.cz = F.drag.cz - (dy / r.height) * v.span
      clampView()
    })
    addEventListener('mouseup', function (e) {
      if (!F.open || !F.drag) return
      var dr = F.drag
      F.drag = null
      if (dr.moved) return
      if (dr.btn === 2) { wp = null; return }
      var w = toWorld(e)
      if (wp && Math.hypot(wp.x - w.x, wp.z - w.z) < view().span * 0.02) wp = null
      else wp = new V3(w.x, 0, w.z)
      try { G.audio && G.audio.play && G.audio.play('ui_click', { gain: 0.6 }) } catch (er) { }
    })
    fc.addEventListener('touchend', function (e) {
      e.preventDefault(); e.stopPropagation()
      var tch = e.changedTouches[0]
      if (!tch) return
      var w = toWorld(tch)
      wp = wp && Math.hypot(wp.x - w.x, wp.z - w.z) < view().span * 0.03 ? null : new V3(w.x, 0, w.z)
    }, { passive: false })
  }
  addEventListener('keydown', function (e) {
    if (e.repeat) return
    var tag = e.target && e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.code === 'KeyM') {
      if (!G.game || (G.game.state !== 'playing' && !F.open)) return
      e.preventDefault(); e.stopImmediatePropagation()
      setOpen(!F.open)
    } else if (e.code === 'Escape' && F.open) {
      e.preventDefault(); e.stopImmediatePropagation()
      setOpen(false)
    }
  }, true)

  // ---------------------------------------------------------------- draw
  var miniT = 0, sz = { m: 0, f: 0 }
  function fitCanvas(c, key) {
    var r = c.getBoundingClientRect(), w = Math.max(32, Math.round(r.width * dpr))
    if (sz[key] !== w) { sz[key] = w; c.width = c.height = w }
    return w
  }
  function drawGrid(ctx, v, N, full) {
    var px = N / v.span
    var stepMinor = W.minor, stepMajor = W.major
    ctx.lineWidth = 1
    for (var pass = 0; pass < 2; pass++) {
      var step = pass ? stepMajor : stepMinor
      ctx.strokeStyle = pass ? 'rgba(11,13,15,0.42)' : 'rgba(11,13,15,0.16)'
      var gx0 = Math.ceil((v.x0 - W.x0) / step) * step + W.x0
      for (var gx = gx0; gx < v.x0 + v.span; gx += step) { var sx = Math.round((gx - v.x0) * px) + 0.5; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, N); ctx.stroke() }
      var gz0 = Math.ceil((v.z0 - W.z0) / step) * step + W.z0
      for (var gz = gz0; gz < v.z0 + v.span; gz += step) { var sy = Math.round((gz - v.z0) * px) + 0.5; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(N, sy); ctx.stroke() }
    }
    if (!full) return
    // PUBG-style square labels on the major grid
    ctx.font = '700 ' + Math.round(11 * dpr) + 'px ' + font
    ctx.fillStyle = 'rgba(11,13,15,0.75)'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    var cols = Math.round(W.size / stepMajor)
    for (var c = 0; c < cols; c++) {
      var cx = W.x0 + (c + 0.5) * stepMajor
      if (cx < v.x0 || cx > v.x0 + v.span) continue
      ctx.fillText(gridLabel(c), (cx - v.x0) * px - 4 * dpr, 4 * dpr)
    }
    for (var r2 = 0; r2 < cols; r2++) {
      var cz = W.z0 + (r2 + 0.5) * stepMajor
      if (cz < v.z0 || cz > v.z0 + v.span) continue
      ctx.fillText(String(r2 + 1), 5 * dpr, (cz - v.z0) * px - 6 * dpr)
    }
  }
  function drawView(ctx, N, v, full) {
    ctx.imageSmoothingEnabled = true
    ctx.fillStyle = desert ? '#cdb58a' : '#3a3d40'
    ctx.fillRect(0, 0, N, N)
    var mpp = W.size / IMG
    ctx.drawImage(base, (v.x0 - W.x0) / mpp, (v.z0 - W.z0) / mpp, v.span / mpp, v.span / mpp, 0, 0, N, N)
    drawGrid(ctx, v, N, full)
    var px = N / v.span, s = (full ? 7 : 5.5) * dpr
    var P = G.player
    markers().forEach(function (m) {
      var sx = (m.x - v.x0) * px, sy = (m.z - v.z0) * px
      var inside = sx >= 0 && sy >= 0 && sx <= N && sy <= N
      if (!inside) {
        if (m.kind !== 'wp' && m.kind !== 'relay' && m.kind !== 'extract') return
        // pin important markers to the edge of the minimap
        var cx = N / 2, cy = N / 2, dx = sx - cx, dy = sy - cy, k = (N / 2 - s * 1.6) / Math.max(Math.abs(dx), Math.abs(dy))
        sx = cx + dx * k; sy = cy + dy * k
      }
      drawMarker(ctx, m, sx, sy, s * (m.kind === 'ally' ? 0.8 : 1), full)
    })
    if (P) drawPlayer(ctx, (P.pos.x - v.x0) * px, (P.pos.z - v.z0) * px, P.yaw, s * 1.15, (G.camera ? G.camera.fov : 74) * Math.PI / 180 * 1.2)
    if (wp && P && full) {
      ctx.setLineDash([6 * dpr, 6 * dpr]); ctx.strokeStyle = 'rgba(255,216,74,0.7)'; ctx.lineWidth = 1.5 * dpr
      ctx.beginPath(); ctx.moveTo((P.pos.x - v.x0) * px, (P.pos.z - v.z0) * px); ctx.lineTo((wp.x - v.x0) * px, (wp.z - v.z0) * px); ctx.stroke(); ctx.setLineDash([])
    }
  }

  // waypoint marker in the 3D view
  var wpEl = null, proj = new V3()
  function updateWpMarker() {
    if (!wpEl) {
      var h = G.hud && G.hud.root
      if (!h) return
      wpEl = document.createElement('div'); wpEl.className = 'sxm-wp'; wpEl.innerHTML = '<i></i><span></span>'; h.appendChild(wpEl); wpEl._s = wpEl.querySelector('span')
    }
    var P = G.player, show = !!wp && !!P && G.game && G.game.state === 'playing'
    if (show) {
      var d = Math.hypot(wp.x - P.pos.x, wp.z - P.pos.z)
      if (d < 6) { wp = null; show = false }
      else {
        var gy = Math.max(0, G.physics.groundHeight(wp.x, wp.z, 999))
        proj.set(wp.x, gy + 2, wp.z).project(G.camera)
        show = proj.z < 1 && Math.abs(proj.x) < 1.02 && Math.abs(proj.y) < 1.02
        if (show) {
          wpEl.style.transform = 'translate3d(' + Math.round((proj.x * 0.5 + 0.5) * innerWidth) + 'px,' + Math.round((-proj.y * 0.5 + 0.5) * innerHeight) + 'px,0)'
          var lbl = Math.round(d) + 'm'
          if (wpEl._l !== lbl) { wpEl._l = lbl; wpEl._s.textContent = lbl }
        }
      }
    }
    if (wpEl._on !== show) { wpEl._on = show; wpEl.classList.toggle('on', show) }
  }

  function update(dt) {
    if (!ui) buildUi()
    if (!ui) return
    var P = G.player
    var playing = G.game && G.game.state === 'playing'
    if (F.open && !playing) setOpen(false)
    miniT -= dt
    if (miniT <= 0 && P) {
      miniT = 0.05
      var N = fitCanvas(ui.mc, 'm')
      var ctx = ui.mc.getContext('2d')
      var span = W.mini * 2
      drawView(ctx, N, { x0: P.pos.x - span / 2, z0: P.pos.z - span / 2, span: span }, false)
    }
    if (F.open) {
      var N2 = fitCanvas(ui.fc, 'f')
      drawView(ui.fc.getContext('2d'), N2, view(), true)
    }
    updateWpMarker()
  }

  return api
}
