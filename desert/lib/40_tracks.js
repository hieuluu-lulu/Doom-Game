// ============================================================================
// DoomZone mod — desert dirt tracks (desert/lib: built in front of desert.js)
// Graded dirt tracks from the far places — the towns, the ranch, the far
// outposts, the house groups — to the highway or to a track built before.
//   route    found once on a 20 m grid round the mesas, their ramps, the other
//            places, the basin and the map edge: A* (chamfer distance to the
//            network's cells as the estimate) to the nearest cell of the
//            network, pulled straight where the grid allows, then a
//            centripetal Catmull-Rom spline every 2 m (like the highway's)
//   bed      the ground under it smoothed and held to SXD_TRACK_TUNE.grade,
//            pinned to the pad / bowl it starts from and to the highway or
//            track it joins; SXD_terrainHeight levels it with cut / fill banks
//   ribbon   compacted dirt with two wheel ruts (SXD_trackBuild), built and
//            shown only where the streamed terrain is detailed
//   places   a town's main street is turned to meet its track, the ranch's
//            gate faces its track (site.trackDir / site.trackStart, read by
//            houses/houses.js)
// ============================================================================
var SXD_TRACK_TUNE = { half: 3, flat: 3.6, bank: 2, batter: 2, grade: 0.08, sigma: 18, step: 2, reach: 30, cell: 16, grid: 20, show: 540 }
// the places, in building order: each joins the highway or a track built before it
var SXD_TRACK_FROM = ['t1', 'v1', 't2', 'oasis', 'bunker', 'saltpan', 'scrapyard', 'g7', 'g5', 'wells', 'g3', 'quarry', 'g4']
var SXD_TRK = null
var SXD_TQ = { d: 0, y: 0, k: 0, i: 0 } // last SXD_trackAt result

function SXD_trackPlace(id) {
  var H = typeof SXH_SITES !== 'undefined' ? SXH_SITES : [], O = typeof SXO_SITES !== 'undefined' ? SXO_SITES : []
  for (var i = 0; i < H.length; i++) if (H[i].id === id) return { site: H[i], pad: true }
  for (var j = 0; j < O.length; j++) if (O[j].id === id) return { site: O[j], pad: false }
  return null
}

// centripetal Catmull-Rom through P ([x, z]...), resampled every step m
function SXD_splineXZ(P, step) {
  var pt = function (k) {
    if (k < 0) return [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]]
    if (k >= P.length) { var a = P[P.length - 1], b = P[P.length - 2]; return [2 * a[0] - b[0], 2 * a[1] - b[1]] }
    return P[k]
  }
  var lerp = function (a, b, ta, tb, t) { var u = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u] }
  var dense = []
  for (var k = 0; k < P.length - 1; k++) {
    var p0 = pt(k - 1), p1 = pt(k), p2 = pt(k + 1), p3 = pt(k + 2)
    var t0 = 0, t1 = t0 + Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 1e-6), t2 = t1 + Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + 1e-6), t3 = t2 + Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) + 1e-6)
    for (var j = 0; j < 60; j++) {
      var t = t1 + ((t2 - t1) * j) / 60
      var A1 = lerp(p0, p1, t0, t1, t), A2 = lerp(p1, p2, t1, t2, t), A3 = lerp(p2, p3, t2, t3, t)
      var B1 = lerp(A1, A2, t0, t2, t), B2 = lerp(A2, A3, t1, t3, t)
      dense.push(lerp(B1, B2, t1, t2, t))
    }
  }
  dense.push(P[P.length - 1])
  var xs = [dense[0][0]], zs = [dense[0][1]], acc = 0, want = step
  for (var d = 1; d < dense.length; d++) {
    var ax = dense[d - 1][0], az = dense[d - 1][1], seg = Math.hypot(dense[d][0] - ax, dense[d][1] - az)
    while (acc + seg >= want) {
      var u = (want - acc) / seg
      xs.push(ax + (dense[d][0] - ax) * u); zs.push(az + (dense[d][1] - az) * u)
      want += step
    }
    acc += seg
  }
  var e = P[P.length - 1]
  if (Math.hypot(xs[xs.length - 1] - e[0], zs[zs.length - 1] - e[1]) > 0.3) { xs.push(e[0]); zs.push(e[1]) }
  return { x: xs, z: zs }
}

function SXD_trackData() {
  if (SXD_TRK) return SXD_TRK
  var T = SXD_TRACK_TUNE, t0 = performance.now()
  SXD_TRK = { tracks: [], grid: null } // re-entry guard: SXD_trackAt answers "none" while planning
  var B = SXD_BOUND, bcx = (B.x0 + B.x1) / 2, bcz = (B.z0 + B.z1) / 2
  var GS = T.grid, H = 1520, N = Math.ceil((H * 2) / GS)
  var cx = function (i) { return -H + (i + 0.5) * GS }
  // what blocks a cell: -1 free, -2 terrain (mesa, ramp, basin, edge), else the
  // index+1 of the place in its way (a track may leave its own place)
  var places = []
  ;(typeof SXH_SITES !== 'undefined' ? SXH_SITES : []).forEach(function (s) { places.push({ id: s.id, x: s.x, z: s.z, r: s.r + (s.blend || 20) - 6 }) })
  ;(typeof SXO_SITES !== 'undefined' ? SXO_SITES : []).forEach(function (s) { places.push({ id: s.id, x: s.x, z: s.z, r: s.r + 22 }) })
  var ramps = typeof SXD_mesaRamps === 'function' ? SXD_mesaRamps() : []
  var segD = function (px, pz, ax, az, bx, bz) { var dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)); return Math.hypot(px - ax - dx * u, pz - az - dz * u) }
  var block = new Int16Array(N * N), cost = new Float32Array(N * N)
  for (var j = 0; j < N; j++)
    for (var i = 0; i < N; i++) {
      var x = cx(i), z = cx(j), k = j * N + i, b = -1, c = 1
      if (Math.hypot(x - bcx, z - bcz) > SXD_PLAY_R - 40 || SXD_basinSd(x, z) < 30) b = -2
      for (var m = 0; b === -1 && m < SXD_MESAS.length; m++) {
        var M = SXD_MESAS[m], md = Math.hypot(x - M[0], z - M[1])
        if (md < M[2] * 1.3 + 40) b = -2
        else if (md < M[2] * 1.3 + 140) c = Math.max(c, 2.5)
      }
      for (var q = 0; b === -1 && q < ramps.length; q++) {
        var R = ramps[q]
        if (segD(x, z, R.cx + R.ax * R.s0, R.cz + R.az * R.s0, R.cx + R.ax * (R.s1 + 20), R.cz + R.az * (R.s1 + 20)) < 22) b = -2
      }
      for (var p = 0; b === -1 && p < places.length; p++) if (Math.hypot(x - places[p].x, z - places[p].z) < places[p].r) b = p
      block[k] = b; cost[k] = c
    }
  // the network: the highway's points, then each track's as it is built
  var R0 = SXD_roadData(), net = [] // [x, z, kind ('road' | track index), index]
  for (var n0 = 0; n0 < R0.n; n0 += 2) net.push([R0.x[n0], R0.z[n0], 'road', n0])
  var goal = new Int32Array(N * N).fill(-1)
  var mark = function (from) {
    for (var g = from; g < net.length; g++) {
      var gi = Math.floor((net[g][0] + H) / GS), gj = Math.floor((net[g][1] + H) / GS)
      if (gi >= 0 && gj >= 0 && gi < N && gj < N && goal[gj * N + gi] < 0) goal[gj * N + gi] = g
    }
  }
  mark(0)
  var nearestNet = function (x, z) { var best = Infinity, bi = -1; for (var g = 0; g < net.length; g++) { var d = (net[g][0] - x) * (net[g][0] - x) + (net[g][1] - z) * (net[g][1] - z); if (d < best) { best = d; bi = g } } return bi }
  var free = function (k, self) { var b = block[k]; return b === -1 || (b >= 0 && places[b].id === self) }
  // A* from a cell to any goal cell. Heuristic: the obstacle-free 8-way grid
  // distance to the network (a two-pass chamfer transform of the goal cells,
  // redone as tracks are added) — never more than the true cost, so the route
  // is still the cheapest. Typed-array binary heap: no garbage.
  var dist = new Float32Array(N * N), prev = new Int32Array(N * N), hgt = new Float32Array(N * N), shut = new Uint8Array(N * N)
  var chamfer = function () {
    var D1 = GS, D2 = GS * 1.4142
    for (var k = 0; k < N * N; k++) hgt[k] = goal[k] >= 0 ? 0 : 1e9
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var k = j * N + i, v = hgt[k]
      if (i > 0) v = Math.min(v, hgt[k - 1] + D1)
      if (j > 0) { v = Math.min(v, hgt[k - N] + D1); if (i > 0) v = Math.min(v, hgt[k - N - 1] + D2); if (i < N - 1) v = Math.min(v, hgt[k - N + 1] + D2) }
      hgt[k] = v
    }
    for (var j2 = N - 1; j2 >= 0; j2--) for (var i2 = N - 1; i2 >= 0; i2--) {
      var k2 = j2 * N + i2, v2 = hgt[k2]
      if (i2 < N - 1) v2 = Math.min(v2, hgt[k2 + 1] + D1)
      if (j2 < N - 1) { v2 = Math.min(v2, hgt[k2 + N] + D1); if (i2 < N - 1) v2 = Math.min(v2, hgt[k2 + N + 1] + D2); if (i2 > 0) v2 = Math.min(v2, hgt[k2 + N - 1] + D2) }
      hgt[k2] = v2
    }
  }
  var hk = new Float64Array(N * N * 4), hv = new Int32Array(N * N * 4), hn = 0
  var hpush = function (key, v) { var a = hn++; hk[a] = key; hv[a] = v; while (a > 0) { var pa = (a - 1) >> 1; if (hk[pa] <= hk[a]) break; var tk = hk[pa], tv = hv[pa]; hk[pa] = hk[a]; hv[pa] = hv[a]; hk[a] = tk; hv[a] = tv; a = pa } }
  var hpop = function () {
    var v = hv[0]; hn--
    if (hn > 0) { hk[0] = hk[hn]; hv[0] = hv[hn]; var a = 0; for (;;) { var l = a * 2 + 1, r = l + 1, sm = a; if (l < hn && hk[l] < hk[sm]) sm = l; if (r < hn && hk[r] < hk[sm]) sm = r; if (sm === a) break; var tk = hk[sm], tv = hv[sm]; hk[sm] = hk[a]; hv[sm] = hv[a]; hk[a] = tk; hv[a] = tv; a = sm } }
    return v
  }
  var route = function (si, sj, self) {
    dist.fill(Infinity); prev.fill(-1); shut.fill(0); hn = 0
    var s0 = sj * N + si
    dist[s0] = 0; hpush(hgt[s0], s0)
    while (hn > 0) {
      var k = hpop()
      if (shut[k]) continue
      shut[k] = 1
      if (goal[k] >= 0) return k
      var d0 = dist[k], i0 = k % N, j0 = (k / N) | 0
      for (var dj = -1; dj <= 1; dj++)
        for (var di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          var ni = i0 + di, nj = j0 + dj
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue
          var nk = nj * N + ni
          if (shut[nk] || (!free(nk, self) && goal[nk] < 0)) continue
          var nd = d0 + (di && dj ? 1.4142 : 1) * GS * (cost[k] + cost[nk]) * 0.5
          if (nd < dist[nk]) { dist[nk] = nd; prev[nk] = k; if (hn < hk.length) hpush(nd + hgt[nk], nk) }
        }
    }
    return -1
  }
  // is the straight line a → b clear (and no dearer than the cells it skips)?
  var clear = function (a, b, self) {
    var L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 6))
    for (var s = 0; s <= n; s++) {
      var x = a[0] + ((b[0] - a[0]) * s) / n, z = a[1] + ((b[1] - a[1]) * s) / n
      var i = Math.floor((x + H) / GS), j = Math.floor((z + H) / GS)
      if (i < 0 || j < 0 || i >= N || j >= N) return false
      var k = j * N + i
      if (!free(k, self) && goal[k] < 0) return false
      if (cost[k] > 1.01) return false
    }
    return true
  }
  SXD_TRACK_FROM.forEach(function (id) {
    var P = SXD_trackPlace(id)
    if (!P) return
    var s = P.site
    // leave the place towards the nearest point of the network; a town on the
    // axis of its main street (snapped), the ranch from its gate
    var ng = net[nearestNet(s.x, s.z)], dx = ng[0] - s.x, dz = ng[1] - s.z, dl = Math.hypot(dx, dz) || 1
    dx /= dl; dz /= dl
    if (P.pad && (s.kind === 'town' || s.kind === 'ranch')) { if (Math.abs(dx) > Math.abs(dz)) { dx = Math.sign(dx); dz = 0 } else { dz = Math.sign(dz); dx = 0 } }
    var off = P.pad ? s.r - 4 : s.r + 3
    var start = [s.x + dx * off, s.z + dz * off]
    s.trackDir = [dx, dz]; s.trackStart = start
    var si = Math.floor((start[0] + H) / GS), sj = Math.floor((start[1] + H) / GS)
    chamfer()
    var end = route(si, sj, id)
    if (end < 0) { console.warn('[desert] no track from ' + id + ' (start ' + start.map(Math.round) + ', cell ' + block[sj * N + si] + ')'); return }
    var cells = []
    for (var k = end; k >= 0; k = prev[k]) cells.push([cx(k % N), cx((k / N) | 0)])
    cells.reverse()
    // the exact joint: the nearest network point to the goal cell
    var gj = net[goal[end]], pts = [start].concat(cells.slice(1, -1)), joint = [gj[0], gj[1]]
    // a few metres straight out of the place first
    pts.splice(1, 0, [start[0] + dx * 14, start[1] + dz * 14])
    pts.push(joint)
    // pull straight: from each kept point, as far ahead as the grid allows
    var kept = [pts[0], pts[1]], a = 1
    while (a < pts.length - 1) {
      var bb = pts.length - 1
      while (bb > a + 1 && !clear(pts[a], pts[bb], id)) bb--
      kept.push(pts[bb]); a = bb
    }
    var S = SXD_splineXZ(kept, T.step), n = S.x.length
    var tr = { id: id, n: n, x: new Float32Array(S.x), z: new Float32Array(S.z), y: new Float32Array(n), joins: gj[2], at: gj[3] }
    // the bed: the ground smoothed, pinned at both ends, grade-limited
    var raw = new Float32Array(n)
    for (var i1 = 0; i1 < n; i1++) {
      var i0 = Math.max(0, i1 - 1), i2 = Math.min(n - 1, i1 + 1), tx = tr.x[i2] - tr.x[i0], tz = tr.z[i2] - tr.z[i0], tl = Math.hypot(tx, tz) || 1
      var sx = tz / tl, sz = -tx / tl, mm = 0
      for (var o = -3; o <= 3; o += 3) mm += SXD_terrainBase(tr.x[i1] + sx * o, tr.z[i1] + sz * o)
      raw[i1] = mm / 3
    }
    var sg = T.sigma / T.step, W = Math.ceil(sg * 3)
    for (var i3 = 0; i3 < n; i3++) {
      var sw = 0, sv = 0
      for (var q2 = -W; q2 <= W; q2++) { var ii = Math.min(n - 1, Math.max(0, i3 + q2)), w = Math.exp(-(q2 * q2) / (2 * sg * sg)); sw += w; sv += raw[ii] * w }
      tr.y[i3] = sv / sw
    }
    var y0 = P.pad && typeof SXH_y === 'function' ? SXH_y(s) : 0, y1
    if (gj[2] === 'road') y1 = SXD_roadAt(joint[0], joint[1]) ? SXD_RQ.y : SXD_terrainBase(joint[0], joint[1])
    else y1 = SXD_TRK.tracks[gj[2]].y[gj[3]]
    var pins = [[0, y0], [n - 1, y1]], g = T.grade * T.step
    pins.forEach(function (pn) { for (var c0 = 0; c0 < n; c0++) { var pr = g * Math.abs(c0 - pn[0]); tr.y[c0] = Math.min(pn[1] + pr, Math.max(pn[1] - pr, tr.y[c0])) } })
    for (var f = 1; f < n; f++) tr.y[f] = Math.min(tr.y[f - 1] + g, Math.max(tr.y[f - 1] - g, tr.y[f]))
    for (var b2 = n - 2; b2 >= 0; b2--) tr.y[b2] = Math.min(tr.y[b2 + 1] + g, Math.max(tr.y[b2 + 1] - g, tr.y[b2]))
    tr.y[0] = y0; tr.y[n - 1] = y1
    var ti = SXD_TRK.tracks.length
    SXD_TRK.tracks.push(tr)
    var from = net.length
    for (var p2 = 0; p2 < n; p2 += 2) net.push([tr.x[p2], tr.z[p2], ti, p2])
    mark(from)
  })
  // segment buckets for the nearest-point lookups (all tracks in one grid)
  var C = T.cell, x0 = -H - C, z0 = -H - C, cw = Math.ceil((H * 2 + 2 * C) / C), cells2 = new Array(cw * cw)
  SXD_TRK.tracks.forEach(function (tr, ti) {
    for (var s6 = 0; s6 + 1 < tr.n; s6++) {
      var ca = Math.floor((Math.min(tr.x[s6], tr.x[s6 + 1]) - T.reach - x0) / C), cb = Math.floor((Math.max(tr.x[s6], tr.x[s6 + 1]) + T.reach - x0) / C)
      var ra = Math.floor((Math.min(tr.z[s6], tr.z[s6 + 1]) - T.reach - z0) / C), rb = Math.floor((Math.max(tr.z[s6], tr.z[s6 + 1]) + T.reach - z0) / C)
      for (var r = Math.max(0, ra); r <= Math.min(cw - 1, rb); r++) for (var c = Math.max(0, ca); c <= Math.min(cw - 1, cb); c++) { var key = r * cw + c; (cells2[key] || (cells2[key] = [])).push(ti * 65536 + s6) }
    }
  })
  SXD_TRK.grid = { x0: x0, z0: z0, cw: cw, cells: cells2 }
  var len = SXD_TRK.tracks.reduce(function (a, tr) { return a + tr.n * T.step }, 0)
  console.log('[desert] tracks ' + SXD_TRK.tracks.length + ', ' + Math.round(len) + ' m in ' + Math.round(performance.now() - t0) + 'ms')
  return SXD_TRK
}

// Nearest point of any track's centre line to (x, z) within T.reach: fills
// SXD_TQ (d = distance, y = bed height, k = track, i = segment), true / false
function SXD_trackAt(x, z) {
  var D = SXD_TRK || SXD_trackData(), G = D.grid
  if (!G) return false
  var C = SXD_TRACK_TUNE.cell, c = Math.floor((x - G.x0) / C), r = Math.floor((z - G.z0) / C)
  if (c < 0 || r < 0 || c >= G.cw || r >= G.cw) return false
  var list = G.cells[r * G.cw + c]
  if (!list) return false
  var best = Infinity, bk = -1, bt = 0
  for (var q = 0; q < list.length; q++) {
    var tr = D.tracks[(list[q] / 65536) | 0], k = list[q] & 65535, ax = tr.x[k], az = tr.z[k], dx = tr.x[k + 1] - ax, dz = tr.z[k + 1] - az
    var t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)
    t = t < 0 ? 0 : t > 1 ? 1 : t
    var ex = x - ax - dx * t, ez = z - az - dz * t, dd = ex * ex + ez * ez
    if (dd < best) { best = dd; bk = list[q]; bt = t }
  }
  var reach = SXD_TRACK_TUNE.reach
  if (bk < 0 || best > reach * reach) return false
  var tr2 = D.tracks[(bk / 65536) | 0], k2 = bk & 65535
  SXD_TQ.d = Math.sqrt(best)
  SXD_TQ.y = tr2.y[k2] + (tr2.y[k2 + 1] - tr2.y[k2]) * bt
  SXD_TQ.k = (bk / 65536) | 0
  SXD_TQ.i = k2
  return true
}
// the ground with the tracks' beds levelled in (SXD_terrainHeight)
function SXD_trackLevel(x, z, h) {
  if (!SXD_trackAt(x, z)) return h
  var T = SXD_TRACK_TUNE, ad = SXD_TQ.d, y = SXD_TQ.y
  if (ad <= T.flat) return y
  var dh = h - y, w = Math.min(T.reach - T.flat - 0.5, T.bank + Math.abs(dh) * T.batter)
  var t = (ad - T.flat) / w
  if (t >= 1) return h
  return y + dh * t * t * (3 - 2 * t)
}

// The ribbons: 80 m chunks, each built the first time the camera comes within
// SXD_TRACK_TUNE.show + 60 m (on SXD_heightAt, the ground the physics and the
// streamed terrain use) and shown inside SXD_TRACK_TUNE.show. A track stops
// short of the highway's asphalt / the track it joins.
function SXD_trackBuild(root, updaters, cam) {
  var D = SXD_trackData(), T = SXD_TRACK_TUNE
  var mat = new lt.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  mat.name = 'sxd_track'
  mat.onBeforeCompile = function (sh) {
    sh.vertexShader = 'varying vec3 vTrW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTrW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = 'varying vec3 vTrW;\nfloat trH(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\nfloat trN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(trH(i), trH(i + vec2(1.0, 0.0)), f.x), mix(trH(i + vec2(0.0, 1.0)), trH(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
      sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.78 + 0.26 * trN(vTrW.xz * 1.3) + 0.14 * trN(vTrW.xz * 6.1) + 0.06 * trN(vTrW.xz * 23.0);')
  }
  mat.customProgramCacheKey = function () { return 'sxd-track-2' }
  // across the track: sand-coloured edges, two dark ruts, a lighter crown
  var OFF = [-3.5, -2.5, -1.6, -1.0, 0, 1.0, 1.6, 2.5, 3.5]
  // (sRGB picks, turned linear: vertex colours are linear in the shader)
  var COL = [0xb99c74, 0x9a7f5d, 0x6c5844, 0x8a7255, 0x957c5c, 0x8a7255, 0x6c5844, 0x9a7f5d, 0xb99c74].map(function (c) { return [Math.pow(((c >> 16) & 255) / 255, 2.2), Math.pow(((c >> 8) & 255) / 255, 2.2), Math.pow((c & 255) / 255, 2.2)] })
  var chunks = []
  D.tracks.forEach(function (tr) {
    var trimEnd = tr.joins === 'road' ? Math.ceil((SXD_ROAD_TUNE.half + 1.5) / T.step) : 2
    var last = tr.n - 1 - trimEnd
    for (var a = 0; a < last; a += 40) {
      var b = Math.min(last, a + 40), mx = 0, mz = 0
      for (var k = a; k <= b; k++) { mx += tr.x[k]; mz += tr.z[k] }
      chunks.push({ tr: tr, a: a, b: b, cx: mx / (b - a + 1), cz: mz / (b - a + 1), mesh: null })
    }
  })
  var build = function (c) {
    var tr = c.tr, pos = [], col = [], idx = [], rows = 0
    for (var k = c.a; k <= c.b; k++) {
      var k0 = Math.max(0, k - 1), k1 = Math.min(tr.n - 1, k + 1), tx = tr.x[k1] - tr.x[k0], tz = tr.z[k1] - tr.z[k0], tl = Math.hypot(tx, tz) || 1
      var nx = tz / tl, nz = -tx / tl
      for (var o = 0; o < OFF.length; o++) {
        var x = tr.x[k] + nx * OFF[o], z = tr.z[k] + nz * OFF[o]
        // a little over the ground: the terrain mesh's triangles and the
        // bilinear height part by a few cm where the banks curve
        pos.push(x, SXD_heightAt(x, z) + (o === 0 || o === OFF.length - 1 ? 0.06 : 0.11), z)
        col.push(COL[o][0], COL[o][1], COL[o][2])
      }
      // wound to face up (across × along points down)
      if (rows) for (var o2 = 0; o2 < OFF.length - 1; o2++) { var p0 = (rows - 1) * OFF.length + o2, p1 = p0 + OFF.length; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1) }
      rows++
    }
    var g = new lt.BufferGeometry()
    g.setAttribute('position', new lt.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new lt.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    var m = new lt.Mesh(g, mat)
    m.name = 'sxd-track'
    m.receiveShadow = true
    root.add(m)
    c.mesh = m
  }
  var built = 0
  updaters.push(function () {
    var e = cam.matrixWorld.elements, px = e[12], pz = e[14], budget = 2
    for (var i = 0; i < chunks.length; i++) {
      var c = chunks[i], d = Math.hypot(c.cx - px, c.cz - pz)
      if (!c.mesh && d < T.show + 60 && budget-- > 0 && SXD_inWorld(c.cx, c.cz)) { build(c); built++ }
      if (c.mesh) { var on = d < T.show; if (c.mesh.visible !== on) c.mesh.visible = on }
    }
  })
  window.__sxdTracks = { data: D, chunks: chunks } // tests
}
