// ============================================================================
// DoomZone mod — NET: online rooms for up to 4 players, two teams
//
// Transport: PeerJS (lib/10_peerjs.min.js) — WebRTC data channels, the free
// PeerJS matchmaking server only swaps connection offers. Star topology: the
// room's host relays every guest's messages to the others.
//
// Teams: Blue and Red. Everyone (the host too) picks or switches team in the
// room's lobby; a newcomer lands on the smaller team. The robots fight both
// teams (each robot goes for the nearest player), the teams fight each other
// (friendly fire off), robots drop loot. Bosses come by the ladder in
// units/units.js: the leading team's humanoid-robot kills. All players on one
// team = co-op against the robots; both teams in = versus: elimination
// rounds, one life each, first to SXN.winRounds round wins with a 2-round lead
// (see "rounds" below; kills are only tallied). No relay mission in a room: the
// relays stand as scenery, nothing to cut, no boat — the objective panel shows
// the room's goal instead (SXN_objectiveText).
// Scores: the host is the authority — it credits robot kills to whoever hit
// last, counts player kills from 'died', and sends 'score' to everyone.
//
// World: the host is the authority. It streams its robots (gulls, hounds and
// every hostile unit) 10×/s; guests don't spawn hostiles of their own, they
// spawn twins of the host's and pin their positions to the host's (the twin's
// own AI still aims and shoots at the local player). Damage a guest deals to a
// robot is sent to the host; the host's hp/death wins. Outposts captured are
// shared. Players are streamed 15×/s and drawn with the
// soldier rig (troopers/lib/20_soldier.js) in team colours.
//
// Versus: a player's shot is tested against the other team's avatars on the
// shooter's machine; a hit is sent to the victim, whose own armor applies.
// Nobody gets the game-over screen in a room: dead players respawn in 5 s.
// ============================================================================

var SXN_TUNE = {
  // max: the absolute ceiling; a room's size is the host's pick, ≤ the map's maxPlayers
  version: 'sxn5', max: 16, idPrefix: 'doomzone-sx-',
  // the host batches what it relays (player states, shots, the world) into one
  // message per guest this many times a second (hits still go at once)
  batchHz: 30,
  // remote soldiers: animate every 2nd frame beyond lodNear m, every 3rd beyond
  // lodFar m or behind the camera (their position still moves every frame)
  lodNear: 30, lodFar: 60,
  rate: 15, worldRate: 10, interp: 0.12, respawn: 5, pvpScale: 0.6, orphanT: 1.5,
  credit: 4000,
  // versus = rounds. Blue vs Red: elimination, one life per round, a team with
  // nobody left standing loses it; when the time is up first, the team with
  // more players standing takes it (equal = a draw). Free-for-all: respawns,
  // and when the time is up the most player kills in the round takes it (a
  // tie = a draw). The time: SXN.roundMins, the host sets it in the lobby
  // (mins.min…max in steps of mins.step, default mins.def).
  // The match: SXN.winRounds round wins (the host sets it in the lobby,
  // rounds.min…max, default rounds.def) with a lead of rounds.by.
  // grace: no round can end in its first seconds (everyone still spawning);
  // pause: the banner time before the next round; matchPause: the results
  // screen's countdown to the next match (the host can start it sooner)
  rounds: { def: 5, min: 1, max: 15, by: 2, grace: 3, pause: 4, matchPause: 20, gone: 6, mins: { def: 3, min: 0.5, max: 15, step: 0.5 } },
  // out of a team round: the camera rides a teammate who is still standing,
  // over the shoulder (back / side / up m from the head, eased by follow per s;
  // pulled in when a wall is in the way)
  spectate: { back: 2.4, side: 0.55, up: 0.35, head: 1.55, follow: 10 },
  // ICE: how two browsers find a path to each other. STUN tells each one its
  // public address (a direct, peer-to-peer path); TURN relays the traffic when
  // no direct path exists — a VPN such as Cloudflare WARP / 1.1.1.1, mobile
  // data / carrier NAT, strict office networks. PeerJS's own free TURN
  // (eu-0 / us-0.turn.peerjs.com) is gone, so rooms across such networks need
  // a TURN of their own: put it in `turn` (e.g. a free Metered or ExpressTURN
  // account: { urls: ['turn:host:80', 'turn:host:443?transport=tcp', 'turns:host:443?transport=tcp'],
  // username: '…', credential: '…' }), or open the game once with
  // ?turn=<url,url>&turnuser=<user>&turnpass=<password> (kept in this browser;
  // ?turn=off forgets it). Everything here is public in the page, as with any
  // browser TURN setup: use a TURN account with a quota you are fine sharing.
  ice: {
    stun: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
    turn: [],
  },
  // spawn protection (s) at the match start and after every respawn; firing ends it early
  protect: 2.5,
  // robots per room setting (host picks in the lobby): share of the solo
  // squads / waves that still come
  bots: { many: 1, few: 0.4, off: 0 },
}
var SXN = {
  active: false, role: null, team: 'blue', code: '', myId: '', name: '', players: {}, guests: {}, map: {},
  score: null, focusN: 0, mode: 'teams', bots: 'few', protectUntil: 0, botN: 0,
  peer: null, conn: null, nextId: 0, started: false, applying: false, allowSpawn: false, lastBy: null,
  respawnT: -1, G: null, ui: null, allowGo: false,
  spec: null, winRounds: 5, roundMins: 3, roundLive: false, roundT0: 0, roundNextT: 0, matchOver: false, roundEndT: 0,
}
try { var SXN_wr0 = +localStorage.getItem('doomzone.rounds'); if (SXN_wr0 >= 1 && SXN_wr0 <= 15) SXN.winRounds = Math.round(SXN_wr0) } catch (e) { }
try { var SXN_rm0 = +localStorage.getItem('doomzone.roundmins'); if (SXN_rm0 >= 0.5 && SXN_rm0 <= 15) SXN.roundMins = Math.round(SXN_rm0 * 2) / 2 } catch (e) { }
window.SXN_MP = false
window.SXN_NOEXT = false

function SXN_team(t) { return t === 'red' ? 'red' : 'blue' }
function SXN_teamName(t) { return t === 'red' ? 'Red' : 'Blue' }
function SXN_newScore() { return { blue: { pk: 0, tk: 0, rw: 0 }, red: { pk: 0, tk: 0, rw: 0 }, round: 1 } }
function SXN_teamSize(t) { var n = 0; for (var id in SXN.players) if (SXN.players[id].team === t) n++; return n }
// room size: the map's maxPlayers (level data; SX_MAP_MAX for the stock port),
// the host's pick within 2..that, never below the players already in
function SXN_mapMax() {
  var lv = SXN.G && SXN.G.level, m = lv && lv.maxPlayers
  if (!m && typeof SX_MAP_MAX !== 'undefined') m = SX_MAP_MAX[SXN_mapName()]
  return Math.max(2, Math.min(SXN_TUNE.max, m || SXN_TUNE.max))
}
function SXN_roomMax() {
  var r = SXN.roomMax || SXN_mapMax()
  if (SXN.role !== 'guest') r = Math.min(r, SXN_mapMax())
  return Math.max(2, Math.min(SXN_TUNE.max, r))
}
function SXN_teamMax() { return Math.ceil(SXN_roomMax() / 2) }
function SXN_teamFull(t) { return SXN_teamSize(t) >= SXN_teamMax() }
// both teams have players: versus rules (no boat, score bar)
// Free-for-all (SXN.mode 'ffa', the host picks it in the lobby): everyone is
// everyone's enemy, the Blue/Red columns are ignored
function SXN_ffa() { return SXN.mode === 'ffa' }
function SXN_ally(p) { return !!p && (SXN_ffa() ? p.id === SXN.myId : p.team === SXN.team) }
function SXN_versus() {
  if (!SXN.active) return false
  if (SXN_ffa()) return Object.keys(SXN.players).length > 1
  return SXN_teamSize('blue') > 0 && SXN_teamSize('red') > 0
}
function SXN_rosterMsg() { return { t: 'roster', players: SXN_roster(), mode: SXN.mode, bots: SXN.bots, room: SXN_roomMax(), wr: SXN.winRounds, rm: SXN.roundMins } }
// share of robots that still come (troopers/troopers.js, the stock waves below)
function SXN_botScale() { return SXN.active ? (SXN_TUNE.bots[SXN.bots] != null ? SXN_TUNE.bots[SXN.bots] : 1) : 1 }
function SXN_protected() { return SXN.active && performance.now() < SXN.protectUntil }
function SXN_protect() { SXN.protectUntil = performance.now() + SXN_TUNE.protect * 1000 }
// a player's colour/class from where I stand
function SXN_clsOf(p) { return SXN_ally(p) ? 'sxn-friend' : 'sxn-foe' }
function SXN_updateMode() { window.SXN_NOEXT = SXN_versus(); SXN_refreshObjective() }
// the HUD objective in a room (game/js/10_game.js D() asks for it): the
// room's goal — there is no relay mission in multiplayer
function SXN_objectiveText() {
  var goal = ' · first to ' + SXN.winRounds + ' rounds, by ' + SXN_TUNE.rounds.by
  if (SXN_ffa() && SXN_versus()) return 'Free-for-all — most kills in each ' + SXN_ffaMins() + ' round' + goal
  if (SXN_versus()) return SXN_teamName(SXN.team) + ' team — wipe out the other team (' + SXN_ffaMins() + ' max)' + goal
  return 'Squad up — fight the machines together'
}
function SXN_refreshObjective() {
  try { document.body.classList.toggle('sxn-mp', !!SXN.active) } catch (e) { }
  if (!SXN.active || !SXN.G || !SXN.G.hud || !SXN.G.game) return
  var st = SXN.G.game.state
  if (st === 'playing' || st === 'paused' || st === 'intro') try { SXN.G.hud.setObjective(SXN_objectiveText()) } catch (e) { }
}
function SXN_playerCount() { return SXN.active ? Math.max(1, Object.keys(SXN.players).length) : 1 }
// the other players' last known spots (alive, in the mission, recent)
function SXN_remoteSpots() {
  var out = [], now = performance.now() / 1000
  for (var id in SXN.players) {
    if (id === SXN.myId) continue
    var p = SXN.players[id], s = p.buf && p.buf[p.buf.length - 1]
    if (!s || !s.al || now - s.t > 3) continue
    out.push(s)
  }
  return out
}
function SXN_mapName() { return typeof SX_MAP !== 'undefined' && (SX_MAP === 'desert' || SX_MAP === 'crossroads' || SX_MAP === 'waterworks') ? SX_MAP : 'port' }

// outposts: wake distance from the nearest player of either team
function SXN_nearestOps(x, z, dLocal) {
  if (!SXN.active) return dLocal
  var d = dLocal
  SXN_remoteSpots().forEach(function (s) { d = Math.min(d, Math.hypot(s.x - x, s.z - z)) })
  return d
}
// units/units.js U.target: the other players robots can go for (vehicle
// position when driving)
var SXN_tpool = []
// called by every robot every frame: built once per frame, no allocations
var SXN_tlist = [], SXN_tFrame = -1, SXN_EMPTY = []
function SXN_otherTargets() {
  if (!SXN.active || !SXN.G || !SXN_inGame()) return SXN_EMPTY
  var f = SXN.G.time && SXN.G.time.frame != null ? SXN.G.time.frame : Math.floor(performance.now() / 8)
  if (f === SXN_tFrame) return SXN_tlist
  SXN_tFrame = f
  SXN_tlist.length = 0
  var now = performance.now() / 1000, k = 0
  for (var id in SXN.players) {
    if (id === SXN.myId) continue
    var p = SXN.players[id], s = p.buf && p.buf[p.buf.length - 1]
    if (!s || !s.al || now - s.t > 3) continue
    var v = SXN_tpool[k] || (SXN_tpool[k] = new lt.Vector3())
    if (s.vp) v.set(s.vp[0], s.vp[1], s.vp[2]); else v.set(s.x, s.y + 1.1, s.z)
    SXN_tlist.push(v); k++
  }
  return SXN_tlist
}
// troopers/troopers.js: the host sends each squad at the next player in turn
function SXN_spawnFocus() {
  if (!SXN.active || SXN.role !== 'host') return null
  var G = SXN.G, list = []
  if (G.player && G.player.alive) list.push(G.player.pos.clone())
  SXN_remoteSpots().forEach(function (s) { if (!s.v) list.push(new lt.Vector3(s.x, s.y, s.z)) })
  if (!list.length) return null
  return list[(SXN.focusN++) % list.length]
}
// minimap: team-mates
function SXN_mapMarkers() {
  var out = []
  if (!SXN.active) return out
  for (var id in SXN.players) {
    var p = SXN.players[id], s = p.buf && p.buf[p.buf.length - 1]
    if (id === SXN.myId || !SXN_ally(p) || !s || !s.al) continue
    out.push({ x: s.x, z: s.z, kind: 'ally' })
  }
  return out
}

// ---------------------------------------------------------------- transport
// the ICE servers for every connection: the STUN list, the TURN entries in
// SXN_TUNE.ice.turn, and a TURN given in the link (?turn=…, remembered)
function SXN_iceServers() {
  var T = SXN_TUNE.ice, list = [{ urls: T.stun.slice() }], saved = null, q = new URLSearchParams(location.search)
  ;(T.turn || []).forEach(function (t) { if (t && t.urls && (t.urls.length || typeof t.urls === 'string')) list.push(t) })
  try { saved = JSON.parse(localStorage.getItem('doomzone.turn') || 'null') } catch (e) { saved = null }
  var tq = q.get('turn')
  if (tq === 'off') { saved = null; try { localStorage.removeItem('doomzone.turn') } catch (e) { } }
  else if (tq) {
    var urls = tq.split(',').map(function (s) { return s.trim() }).filter(function (u) { return /^turns?:[^\s"'<>]+$/.test(u) })
    saved = urls.length ? { urls: urls, username: q.get('turnuser') || '', credential: q.get('turnpass') || '' } : null
    try { saved ? localStorage.setItem('doomzone.turn', JSON.stringify(saved)) : localStorage.removeItem('doomzone.turn') } catch (e) { }
  }
  if (saved && saved.urls && saved.urls.length) list.push(saved)
  return list
}
function SXN_turnHosts() {
  var out = []
  SXN_iceServers().forEach(function (s) { [].concat(s.urls || []).forEach(function (u) { var m = /^turns?:([^:?]+)/.exec(u); if (m && out.indexOf(m[1]) < 0) out.push(m[1]) }) })
  return out
}
function SXN_peerOpts() {
  var q = new URLSearchParams(location.search), o = { debug: 0, config: { iceServers: SXN_iceServers() } }
  if (q.get('peerhost')) {
    o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 443); o.path = q.get('peerpath') || '/'
    o.secure = q.get('peersecure') !== '0'
    if (q.get('peerkey')) o.key = q.get('peerkey')
  }
  return o
}
function SXN_newCode() {
  var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = ''
  for (var i = 0; i < 5; i++) c += a[Math.floor(Math.random() * a.length)]
  return c
}
function SXN_clean(s) { return String(s || '').replace(/[<>&"']/g, '').trim().slice(0, 14) || 'Player' }

function SXN_host(name, cb, fixed, tries) {
  if (typeof Peer !== 'function') { cb('Networking is not available in this build'); return }
  var code = fixed || SXN_newCode(), done = false
  var peer = new Peer(SXN_TUNE.idPrefix + code, SXN_peerOpts())
  peer.on('open', function () {
    done = true
    SXN.peer = peer; SXN.code = code; SXN.role = 'host'; SXN.myId = 'h'; SXN.team = 'blue'; SXN.name = SXN_clean(name)
    SXN.players = {}; SXN.guests = {}; SXN.score = SXN_newScore(); SXN.roomMax = SXN_mapMax()
    SXN_addPlayer({ id: 'h', name: SXN.name, team: 'blue' })
    SXN_activate()
    cb(null, code)
  })
  peer.on('connection', function (conn) { SXN_onGuest(conn) })
  peer.on('error', function (e) {
    if (!done && e && e.type === 'unavailable-id') {
      try { peer.destroy() } catch (er) { }
      // the same room after a map switch: wait for the server to free its code
      if (fixed && (tries || 0) < 15) { done = true; SXN_status('Reopening room ' + code + '…'); setTimeout(function () { SXN_host(name, cb, fixed, (tries || 0) + 1) }, 1000); return }
      SXN_host(name, cb); return
    }
    if (!done) { done = true; cb(SXN_netError(e)); try { peer.destroy() } catch (er) { } return }
    SXN_status(SXN_netError(e))
  })
  peer.on('disconnected', function () { if (SXN.peer === peer && !peer.destroyed) try { peer.reconnect() } catch (e) { } })
}
function SXN_netError(e) {
  var t = e && e.type || ''
  if (t === 'peer-unavailable') return 'Room not found — check the code'
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Can\'t reach the matchmaking server (internet needed)'
  if (t === 'browser-incompatible') return 'This browser has no WebRTC'
  if (t === 'webrtc' || t === 'negotiation-failed') return 'No network path to the room — a VPN (WARP / 1.1.1.1), mobile data or a strict network; turn the VPN off or set up a TURN relay (README → TURN)'
  return 'Network error: ' + (t || e)
}
function SXN_onGuest(conn) {
  conn.on('data', function (m) { try { SXN_hostRecv(conn, m) } catch (e) { console.error('[net] host recv', e) } })
  conn.on('close', function () { SXN_dropGuest(conn) })
  conn.on('error', function () { SXN_dropGuest(conn) })
}
// ------------------------------------------------------------------ guard
// The host is the referee: every message from a guest is type-checked, range-
// checked and rate-limited before it is applied or relayed, so a modified
// client can't one-shot people, farm kills,
// teleport or flood the room. (A browser game can't stop local cheats such as
// wall-hacks; this keeps them from breaking other players' games.)
var SXN_GUARD = {
  // messages per second per guest, per type (token buckets, burst = 1.5 s)
  rate: { p: 24, shot: 30, hit: 30, dmg: 45, died: 1, team: 2, ready: 4 },
  flood: 260,          // any messages/s from one guest above this → kicked
  hitMax: 320,         // one player hit (after pvpScale): an SR-3 headshot is ~160, a missile ~300
  hitPerSec: 650,      // total player damage one sender may deal per second
  hitRange: 700,       // shooter ↔ victim distance (m)
  dmgMax: 1200,        // one robot-damage message (an AGM on a weak point is ~730)
  dmgRange: 1600,
  speed: 210,          // m/s between two states (jets top out ~130) → teleport
  WEAPONS: { rifle: 1, shotgun: 1, pistol: 1, sniper: 1, talon: 1, harrow: 1, kestrel: 1, warden: 1, sandcat: 1, rhino: 1 },
  TYPES: { p: 1, shot: 1, hit: 1, died: 1, dmg: 1, team: 1, ready: 1 },
}
function SXN_num(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi }
function SXN_v3(a, lim) { return Array.isArray(a) && a.length === 3 && SXN_num(a[0], -lim, lim) && SXN_num(a[1], -lim, lim) && SXN_num(a[2], -lim, lim) }
function SXN_str(v, max, re) { return typeof v === 'string' && v.length <= max && (!re || re.test(v)) }
// token bucket per guest and type
function SXN_take(conn, type) {
  var now = performance.now(), b = conn.__bk || (conn.__bk = {}), r = SXN_GUARD.rate[type] || 10
  var k = b[type] || (b[type] = { n: r * 1.5, t: now })
  k.n = Math.min(r * 1.5, k.n + (now - k.t) / 1000 * r); k.t = now
  if (k.n < 1) return false
  k.n -= 1
  return true
}
function SXN_flood(conn) {
  var now = performance.now()
  if (!conn.__fw || now - conn.__fw > 1000) { conn.__fw = now; conn.__fn = 0 }
  return ++conn.__fn > SXN_GUARD.flood
}
function SXN_last(p) { return p && p.buf && p.buf[p.buf.length - 1] }
// field checks per type; false = drop the message
function SXN_valid(m) {
  var g = SXN_GUARD
  switch (m.t) {
    case 'p':
      if (!SXN_num(m.x, -3000, 3000) || !SXN_num(m.y, -200, 2000) || !SXN_num(m.z, -3000, 3000)) return false
      if (!SXN_num(m.yw, -1e4, 1e4) || !SXN_num(m.pt, -4, 4) || !SXN_num(m.hp, -1000, 1000)) return false
      m.cr = m.cr ? 1 : 0; m.al = m.al ? 1 : 0; m.ad = m.ad ? 1 : 0; m.sp = m.sp ? 1 : 0
      m.ln = SXN_num(m.ln, -1, 1) ? m.ln : 0
      if (!g.WEAPONS[m.w]) m.w = 'rifle'
      if (m.v != null && !SXN_str(m.v, 24, /^[a-z]+#\d{1,2}$/)) return false
      if (m.vp != null && !(Array.isArray(m.vp) && (m.vp.length === 4 || m.vp.length === 8) && m.vp.every(function (x) { return SXN_num(x, -1e4, 1e4) }))) return false
      return true
    case 'shot':
      if (!SXN_v3(m.o, 3000) || !SXN_v3(m.d, 2)) return false
      var L = Math.hypot(m.d[0], m.d[1], m.d[2])
      if (L < 0.5 || L > 1.5) return false
      if (!g.WEAPONS[m.w]) m.w = 'rifle'
      return true
    case 'hit': return SXN_str(m.to, 8, /^(h|g\d{1,4})$/) && SXN_num(m.a, 0, g.hitMax) && (m.part == null || SXN_str(m.part, 12))
    case 'died': return m.by == null || SXN_str(m.by, 8, /^(h|g\d{1,4})$/)
    case 'dmg': return SXN_str(m.k, 12, /^[eu]\d{1,7}$/) && SXN_num(m.a, 0, g.dmgMax) && (m.p == null || SXN_str(m.p, 12))
    case 'team': return m.team === 'blue' || m.team === 'red'
    case 'ready': m.on = !!m.on; return true
  }
  return false
}
function SXN_near(p, pos, r) {
  var s = SXN_last(p)
  return !!s && s.al && Math.hypot(s.x - pos.x, s.z - pos.z) <= r && Math.abs(s.y - pos.y) <= r
}
// game-sense checks on the host (after the field checks)
function SXN_sensible(conn, p, m) {
  var g = SXN_GUARD, now = performance.now()
  if (m.t === 'p') {
    // teleports: a state far from the last one too soon is dropped (respawns,
    // long gaps and a run of 30 drops in a row — lag — are let through)
    var s = SXN_last(p)
    if (s && s.al && m.al) {
      var dt = Math.max(0.03, performance.now() / 1000 - s.t), d = Math.hypot(m.x - s.x, m.y - s.y, m.z - s.z)
      if (dt < 1.5 && d / dt > g.speed) { if ((p.tp = (p.tp | 0) + 1) < 30) return false }
    }
    p.tp = 0
    return true
  }
  if (m.t === 'hit') {
    var v = SXN.players[m.to], sh = SXN_last(p), vt = m.to === SXN.myId ? null : SXN_last(v)
    if (!v || v === p || SXN_sameSide(p, v) || !sh || !sh.al) return false
    var vp = m.to === SXN.myId ? SXN.G.player.pos : vt
    if (vp && Math.hypot(vp.x - sh.x, vp.y - sh.y, vp.z - sh.z) > g.hitRange) return false
    // damage per second per sender
    if (!p.__hw || now - p.__hw > 1000) { p.__hw = now; p.__hd = 0 }
    if ((p.__hd += m.a) > g.hitPerSec) return false
    // remember who hit whom (kill credit)
    v.__hitBy = p.id; v.__hitT = now
    return true
  }
  if (m.t === 'died') {
    // one death per life; the killer must have hit them in the last 10 s
    if (p.__diedT && now - p.__diedT < 3000) return false
    p.__diedT = now
    if (m.by && !(p.__hitBy === m.by && now - (p.__hitT || 0) < 10000)) m.by = null
    return true
  }
  if (m.t === 'dmg') {
    var G2 = SXN.G, rid = +String(m.k).slice(1), o = null, sh2 = SXN_last(p)
    if (m.k[0] === 'e') o = (G2.enemies.list || []).filter(function (x) { return x.id === rid })[0]
    else if (G2.units) o = G2.units.list.filter(function (x) { return x.id === rid })[0]
    if (o && sh2 && o.pos && Math.hypot(o.pos.x - sh2.x, o.pos.z - sh2.z) > g.dmgRange) return false
    return true
  }
  return true
}
function SXN_sameSide(a, b) { return !SXN_ffa() && a.team === b.team }

function SXN_hostRecv(conn, m) {
  if (!m || typeof m !== 'object') return
  if (SXN_flood(conn)) {
    // flooding: drop the guest
    var fp = SXN.players[conn.__id]
    fp && SXN_feed('<b class="sxn-foe">' + fp.name + '</b> was removed (message flood)')
    try { conn.close() } catch (e) { }
    SXN_dropGuest(conn)
    return
  }
  if (m.t === 'hello') {
    if (conn.__id) return
    if (m.v !== SXN_TUNE.version) { conn.send({ t: 'reject', why: 'version' }); setTimeout(function () { conn.close() }, 400); return }
    if (Object.keys(SXN.players).length >= SXN_roomMax()) { conn.send({ t: 'reject', why: 'full', room: SXN_roomMax() }); setTimeout(function () { conn.close() }, 400); return }
    var id = 'g' + (++SXN.nextId)
    conn.__id = id
    conn.__seen = performance.now()
    SXN.guests[id] = conn
    // a newcomer lands on the smaller team (or the one asked for after a map reload)
    var team = (m.team === 'blue' || m.team === 'red') && !SXN_teamFull(m.team) ? m.team : SXN_teamSize('red') < SXN_teamSize('blue') ? 'red' : 'blue'
    var p = SXN_addPlayer({ id: id, name: SXN_clean(m.name), team: team })
    var G = SXN.G
    conn.send({ t: 'welcome', id: id, code: SXN.code, map: SXN_mapName(), seed: String(G.params.seed || 4207), started: SXN.started, players: SXN_roster(), score: SXN.score, mode: SXN.mode, bots: SXN.bots, room: SXN_roomMax(), wr: SXN.winRounds, rm: SXN.roundMins, rt: SXN_roundLeft() })
    SXN_broadcast(SXN_rosterMsg())
    SXN_updateMode()
    SXN_feed('<b class="' + SXN_clsOf(p) + '">' + p.name + '</b> joined' + (SXN_ffa() ? '' : ' · ' + SXN_teamName(p.team)))
    SXN_refreshUi()
    return
  }
  if (!conn.__id) return
  conn.__seen = performance.now()
  if (m.t === 'hb') return
  // only what a guest may send, well-formed, at a sane rate, and sensible
  var gp = SXN.players[conn.__id]
  if (!SXN_GUARD.TYPES[m.t] || !gp || !SXN_valid(m) || !SXN_take(conn, m.t) || !SXN_sensible(conn, gp, m)) return
  m.from = conn.__id
  SXN_handle(m)
  if (m.t === 'hit') {
    if (m.to !== 'h' && SXN.guests[m.to]) SXN_sendTo(SXN.guests[m.to], m)
    return
  }
  if (m.t === 'p' || m.t === 'shot' || m.t === 'died') SXN_relay(m, conn.__id)
}
function SXN_dropGuest(conn) {
  var id = conn.__id
  if (!id || !SXN.guests[id]) return
  delete SXN.guests[id]
  var p = SXN.players[id]
  SXN_removePlayer(id)
  SXN_broadcast({ t: 'bye', id: id })
  SXN_broadcast(SXN_rosterMsg())
  p && SXN_feed('<b class="' + SXN_clsOf(p) + '">' + p.name + '</b> left')
  SXN_updateMode()
  SXN_refreshUi()
}

function SXN_join(code, name, team, cb) {
  if (typeof Peer !== 'function') { cb('Networking is not available in this build'); return }
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 5) { cb('Room codes have 5 letters'); return }
  var peer = new Peer(SXN_peerOpts()), done = false
  var fail = function (msg) { if (done) return; done = true; try { peer.destroy() } catch (e) { } cb(msg) }
  peer.on('open', function () {
    var conn = peer.connect(SXN_TUNE.idPrefix + code, { reliable: true, serialization: 'json' })
    // the room exists (an unknown code fails at once with peer-unavailable): no
    // data channel means no network path between the two players
    var noPath = function () {
      var relay = SXN_turnHosts()
      return relay.length
        ? 'Found room ' + code + ' but could not connect, even through the TURN relay (' + relay.join(', ') + ') — check its username / password and quota'
        : 'Found room ' + code + ' but there is no direct path between your networks — a VPN (Cloudflare WARP / 1.1.1.1), mobile data or a strict network blocks it. Turn the VPN off and try again, or set up a TURN relay (README → TURN)'
    }
    var to = setTimeout(function () { clearInterval(iceT); fail(noPath()) }, 15000)
    var iceT = setInterval(function () {
      var pc = conn.peerConnection
      if (done) { clearInterval(iceT); return }
      if (pc && pc.iceConnectionState === 'failed') { clearInterval(iceT); clearTimeout(to); fail(noPath()) }
    }, 500)
    conn.on('open', function () { conn.send({ t: 'hello', v: SXN_TUNE.version, name: SXN_clean(name), team: team || '' }) })
    conn.on('data', function (m) {
      if (!m || typeof m !== 'object') return
      SXN.hostSeen = performance.now()
      if (m.t === 'hb') return
      if (m.t === 'reject') { clearTimeout(to); fail(m.why === 'full' ? 'Room ' + code + ' is full (' + (m.room || SXN_TUNE.max) + '/' + (m.room || SXN_TUNE.max) + ')' : 'Different game version than the host'); return }
      if (m.t === 'welcome' && !done) {
        clearTimeout(to); clearInterval(iceT); done = true
        // the host's map / seed: reload into it and join again from there
        if (m.map !== SXN_mapName() || String(m.seed) !== String(SXN.G.params.seed || 4207)) {
          try { peer.destroy() } catch (e) { }
          var u = new URL(location.href)
          u.searchParams.set('map', m.map); u.searchParams.set('seed', m.seed)
          var mine = (m.players || []).filter(function (q) { return q.id === m.id })[0]
          u.searchParams.set('join', code); u.searchParams.set('team', mine ? mine.team : (team || '')); u.searchParams.set('name', SXN_clean(name))
          try { localStorage.setItem('doomzone.map', m.map) } catch (e) { }
          location.href = u.toString()
          return
        }
        SXN.peer = peer; SXN.conn = conn; SXN.role = 'guest'; SXN.code = code; SXN.myId = m.id; SXN.name = SXN_clean(name)
        SXN.players = {}
        m.players.forEach(function (q) { SXN_addPlayer(q) })
        SXN.team = SXN.players[m.id] ? SXN.players[m.id].team : 'blue'
        SXN.score = m.score || SXN_newScore()
        SXN.mode = m.mode === 'ffa' ? 'ffa' : 'teams'
        if (SXN_TUNE.bots[m.bots] != null) SXN.bots = m.bots
        if (m.room) SXN.roomMax = m.room
        if (m.wr >= 1) SXN.winRounds = m.wr
        if (m.rm > 0) SXN.roundMins = m.rm
        if (m.rt != null) { SXN.roundEndT = performance.now() + m.rt * 1000; SXN.roundLive = true }
        SXN.started = !!m.started
        SXN_activate()
        cb(null, code)
        return
      }
      if (m.t === 'b' && Array.isArray(m.m)) {
        // a batch from the host: each part in order
        for (var bi = 0; bi < m.m.length; bi++) { var bm = m.m[bi]; if (bm && typeof bm === 'object' && bm.t !== 'b') try { SXN_handle(bm) } catch (e) { console.error('[net] recv', e) } }
        return
      }
      try { SXN_handle(m) } catch (e) { console.error('[net] recv', e) }
    })
    conn.on('close', function () { if (done && SXN.conn === conn) SXN_hostLeft(); else fail('Connection closed') })
    conn.on('error', function () { if (!done) { clearInterval(iceT); clearTimeout(to); fail(noPath()) } })
  })
  peer.on('error', function (e) { if (!done) fail(SXN_netError(e)); else SXN_status(SXN_netError(e)) })
}
function SXN_hostLeft() {
  SXN_status('The host left — the room is closed')
  SXN_banner('Host left the room — you are on your own now', 5)
  SXN_deactivate()
}
function SXN_leave() {
  try { if (SXN.role === 'host') SXN_broadcast({ t: 'closed' }) } catch (e) { }
  try { SXN.peer && SXN.peer.destroy() } catch (e) { }
  SXN_deactivate()
  SXN.peer = null; SXN.conn = null; SXN.code = ''
  SXN_refreshUi()
}

function SXN_sendTo(conn, m) { try { conn && conn.open && conn.send(m) } catch (e) { } }
function SXN_broadcast(m, except) { for (var id in SXN.guests) if (id !== except) SXN_sendTo(SXN.guests[id], m) }
// host: queue for every guest but `except`; SXN_flush sends each guest's queue as one message
var SXN_out = {}
function SXN_relay(m, except) { for (var id in SXN.guests) if (id !== except) (SXN_out[id] || (SXN_out[id] = [])).push(m) }
function SXN_flush() {
  for (var id in SXN_out) {
    var q = SXN_out[id], c = SXN.guests[id]
    if (c && q.length) SXN_sendTo(c, q.length === 1 ? q[0] : { t: 'b', m: q })
  }
  SXN_out = {}
}
// from this player to everybody else
function SXN_emit(m) {
  if (!SXN.active) return
  m.from = SXN.myId
  if (SXN.role === 'host') {
    if (m.t === 'hit') {
      var hv = SXN.players[m.to]
      if (hv) { hv.__hitBy = SXN.myId; hv.__hitT = performance.now() } // kill credit check (guard)
      SXN.guests[m.to] && SXN_sendTo(SXN.guests[m.to], m)
      return
    }
    if (m.t === 'p' || m.t === 'shot') SXN_relay(m) // batched with the rest of this tick
    else SXN_broadcast(m)
  } else SXN_sendTo(SXN.conn, m)
}

// ----------------------------------------------------------------- players
function SXN_addPlayer(q) {
  var p = SXN.players[q.id] || { id: q.id, buf: [], av: null, kills: 0, pk: 0, deaths: 0 }
  var team = SXN_team(q.team)
  if (p.team && p.team !== team) SXN_dropAvatar(p) // switched sides: new colours
  p.name = SXN_clean(q.name); p.team = team
  if (q.id === SXN.myId) SXN.team = team
  if (q.kills != null) p.kills = q.kills
  if (q.pk != null) p.pk = q.pk
  if (q.deaths != null) p.deaths = q.deaths
  if (q.ready != null) p.ready = !!q.ready
  SXN.players[q.id] = p
  return p
}
function SXN_removePlayer(id) {
  var p = SXN.players[id]
  if (!p) return
  SXN_dropAvatar(p)
  if (p.veh) { p.veh.__netPilot = null; p.veh = null }
  delete SXN.players[id]
}
function SXN_roster() {
  return Object.keys(SXN.players).map(function (id) { var p = SXN.players[id]; return { id: id, name: p.name, team: p.team, kills: p.kills, pk: p.pk, deaths: p.deaths, ready: !!p.ready } })
}
function SXN_cls(team) { return team === SXN.team ? 'sxn-friend' : 'sxn-foe' }

// ------------------------------------------------------------ hook the game
function SXN_activate() {
  var G = SXN.G
  SXN.active = true
  window.SXN_MP = true
  SXN_updateMode()
  SXN_install(G)
  SXN_refreshUi()
}
function SXN_deactivate() {
  SXN.active = false
  window.SXN_MP = false
  window.SXN_NOEXT = false
  try { document.body.classList.remove('sxn-mp') } catch (e) { }
  try { SXN_resultsHide() } catch (e) { }
  for (var id in SXN.players) SXN_dropAvatar(SXN.players[id])
  for (var k in SXN.map) { var o = SXN.map[k]; if (o) { o.__net = null; o.__netKey = null } }
  SXN.map = {}
  try { (SXN.G.units && SXN.G.units.list || []).forEach(function (u) { u.__netPilot = null }) } catch (e) { }
  SXN.players = {}; SXN.guests = {}; SXN.role = null; SXN.started = false; SXN.respawnT = -1
  SXN_overlay(null)
  SXN_refreshUi()
}

function SXN_install(G) {
  if (SXN.installed) return
  SXN.installed = true
  var V3 = lt.Vector3, U = G.units
  // shots: the other team's avatars are targets too
  var ray0 = G.enemies.raycast
  G.enemies.raycast = function (o, d, max) {
    if (!SXN.active) return ray0.apply(this, arguments)
    if (max == null) max = 300
    var a = ray0.call(this, o, d, max)
    var b = SXN_raycastAvatars(o, d, a ? a.dist : max)
    return b || a
  }
  // guests: hostiles only come from the host
  var spawn0 = G.enemies.spawn
  G.enemies.spawn = function (type, pos, opts) {
    if (SXN.active && SXN.role === 'guest' && !SXN.allowSpawn) return null
    if (SXN.active && SXN.role === 'host') {
      // robots 'few' lets 2 of every 5 through, 'off' none
      var sc = SXN_botScale()
      if (sc <= 0) return null
      if (sc < 1 && (SXN.botN++ % 5) >= Math.round(sc * 5)) return null
    }
    var e = spawn0.apply(this, arguments)
    if (e) e.__spawnT = performance.now() / 1000
    return e
  }
  if (U) {
    var uspawn0 = U.spawn
    var HOSTILE = { colossus: 1, skua: 1, turret: 1, trooper: 1, petrel: 1 }
    U.spawn = function (type, opts) {
      if (SXN.active && SXN.role === 'guest' && HOSTILE[type] && !SXN.allowSpawn) return null
      var u = uspawn0.apply(this, arguments)
      if (u) u.__spawnT = performance.now() / 1000
      return u
    }
  }
  // spawn protection: no damage at all for a few seconds after a (re)spawn
  var P = G.player, dmg0 = P && P.damage
  if (dmg0) P.damage = function () { if (SXN_protected()) return false; return dmg0.apply(this, arguments) }
  // local events → the room
  G.events.on('weapon:fire', function (ev) {
    if (SXN.active && SXN_protected()) SXN.protectUntil = 0 // shooting ends it
    if (!SXN.active || !ev || !ev.dir) return
    var o = ev.origin || ev.muzzle || G.camera.position
    SXN_emit({ t: 'shot', o: [+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)], d: [+ev.dir.x.toFixed(3), +ev.dir.y.toFixed(3), +ev.dir.z.toFixed(3)], w: SXN_weapon() })
  })
  G.events.on('player:dead', function () { if (SXN.active) SXN_localDeath() })
  // spectate: the camera is placed right before each frame is drawn
  if (G.render && typeof G.render.frame === 'function') {
    var frame0 = G.render.frame
    G.render.frame = function () { try { SXN_specFrame() } catch (e) { } return frame0.apply(this, arguments) }
  }
  document.addEventListener('mousedown', function (e) { if (SXN.spec) { SXN_specStep(e.button === 2 ? -1 : 1); e.preventDefault() } }, true)
  document.addEventListener('contextmenu', function (e) { if (SXN.spec) e.preventDefault() }, true)
  document.addEventListener('keydown', function (e) { if (SXN.spec && e.code === 'Space') { SXN_specStep(1); e.preventDefault() } }, true)
  G.events.on('game:state', function (ev) {
    if (!SXN.active || !ev) return
    if (ev.state === 'playing' && (ev.prev === 'intro' || ev.prev === 'title')) SXN_afterStart()
    if (ev.state === 'playing' && SXN.role === 'host' && !SXN.started) {
      // the host starts: a fresh scoreboard for everyone
      SXN.started = true
      SXN.score = SXN_newScore()
      for (var id in SXN.players) { var q = SXN.players[id]; q.kills = 0; q.pk = 0; q.deaths = 0; q.tk = 0; q.rw = 0; q.rk = 0; q.dead = false; q.inRound = false }
      SXN.roundLive = true; SXN.roundT0 = performance.now(); SXN.roundNextT = 0; SXN.matchOver = false
      SXN.roundEndT = performance.now() + SXN_roundSecs() * 1000
      SXN_broadcast({ t: 'start' })
      SXN_pushScore()
    }
  })
}

// a run starts: each team at its base
function SXN_afterStart() {
  var G = SXN.G
  // every team starts at its own base (free-for-all: one spot each)
  var sp = SXN_spawnPoint(true)
  try { G.player.reset({ pos: sp.pos, yaw: sp.yaw }) } catch (e) { }
  SXN_protect()
  SXN_banner(SXN_ffa() && SXN_versus()
    ? 'Free-for-all — ' + SXN_ffaMins() + ' rounds, the most kills takes each one. First to ' + SXN.winRounds + ' rounds, by ' + SXN_TUNE.rounds.by
    : SXN_versus()
    ? SXN_teamName(SXN.team) + ' team — one life per round, wipe out the other team. First to ' + SXN.winRounds + ' rounds, by ' + SXN_TUNE.rounds.by
    : 'Squad up — fight the machines together', 4)
  // maps whose rooms start on the pistol (level.mpKit, arsenal/arsenal.js)
  if (G.level && G.level.mpKit === 'pistol') setTimeout(function () { SXN_banner('Knife and pistol only — pick up rifles, shotguns and snipers on the map. Ammo: left side of your yard, armour and medkits: right side', 5) }, 4200)
  // twins of the host's robots are rebuilt from the next snapshot
  SXN.map = {}
}
function SXN_weapon() { try { return SXN.G.weapon.arsenal.loadout.cur } catch (e) { return 'rifle' } }
function SXN_inGame() { var s = SXN.G.game && SXN.G.game.state; return s === 'playing' || s === 'paused' }

// ------------------------------------------------------------- messages in
function SXN_handle(m) {
  var G = SXN.G, p = m.from && SXN.players[m.from]
  switch (m.t) {
    case 'roster':
      var keep = {}
      if (m.mode && m.mode !== SXN.mode) SXN_setMode(m.mode)
      if (m.bots && SXN_TUNE.bots[m.bots] != null) SXN.bots = m.bots
      if (m.room && SXN.role === 'guest') SXN.roomMax = m.room
      if (m.wr >= 1 && SXN.role === 'guest') SXN.winRounds = m.wr
      if (m.rm > 0 && SXN.role === 'guest') SXN.roundMins = m.rm
      m.players.forEach(function (q) { SXN_addPlayer(q); keep[q.id] = 1 })
      for (var id in SXN.players) if (!keep[id]) SXN_removePlayer(id)
      SXN_updateMode()
      SXN_refreshUi()
      break
    case 'team':
      // a guest asks to switch sides (host only; lobby only)
      if (SXN.role === 'host' && p && (m.team === 'blue' || m.team === 'red') && p.team !== m.team && !SXN_teamFull(m.team)) {
        SXN_addPlayer({ id: p.id, name: p.name, team: m.team })
        SXN_broadcast(SXN_rosterMsg())
        SXN_updateMode()
        SXN_feed('<b class="' + SXN_clsOf(p) + '">' + p.name + '</b> switched to ' + SXN_teamName(m.team))
        SXN_refreshUi()
      }
      break
    case 'ready':
      // a guest is ready (or not) to start; only the host starts the match
      if (SXN.role === 'host' && p) {
        p.ready = !!m.on
        SXN_broadcast(SXN_rosterMsg())
        SXN_refreshUi()
        if (!SXN.started) { var w = SXN_notReady(); SXN_status(w.length ? p.name + (p.ready ? ' is ready' : ' is not ready') + ' · waiting for ' + w.join(', ') : 'Everyone is ready — press Start') }
      }
      break
    case 'map': if (SXN.role === 'guest' && !m.from) SXN_followMap(m); break
    case 'score': if (SXN.role === 'guest') SXN_applyScore(m); break
    case 'rk': SXN_robotKill(m); break
    case 'round': if (SXN.role === 'guest') SXN_roundMsg(m); break
    case 'bye': SXN_removePlayer(m.id); SXN_refreshUi(); break
    case 'closed': SXN_hostLeft(); break
    case 'start':
      SXN.started = true
      SXN_refreshUi()
      if (!SXN_inGame()) {
        if (SXN_meReady()) SXN_go() // ready players are taken into the match
        else { SXN_banner('The host started the match — press Ready to join', 6); SXN_status('The match has started — press Ready to join') }
      }
      break
    case 'p': if (p) SXN_playerState(p, m); break
    case 'shot': if (p) SXN_remoteShot(p, m); break
    case 'hit':
      if (m.to === SXN.myId && G.player && G.player.alive && SXN_inGame()) {
        if (!SXN_num(m.a, 0, SXN_GUARD.hitMax) || !p || SXN_sameSide(p, SXN.players[SXN.myId] || {})) break
        SXN.lastBy = m.from; SXN.lastByT = performance.now()
        var from = p && p.av ? p.av.grp.position.clone().add(new lt.Vector3(0, 1.5, 0)) : null
        G.player.damage(+m.a || 0, from)
      }
      break
    case 'died': SXN_markDeath(m.from, m.by); break
    case 'w': if (SXN.role === 'guest') SXN_applyWorld(m); break
    case 'dmg': if (SXN.role === 'host') SXN_hostDamage(m); break
  }
}

// --------------------------------------------------------------- avatars
function SXN_playerState(p, m) {
  var now = performance.now() / 1000
  var s = { t: now, x: m.x, y: m.y, z: m.z, yaw: m.yw, pitch: m.pt, cr: m.cr, hp: m.hp, al: m.al, w: m.w, ads: m.ad, ln: m.ln || 0, v: m.v || null, vp: m.vp || null, sp: m.sp | 0 }
  p.buf.push(s)
  if (p.buf.length > 8) p.buf.shift()
  p.hp = m.hp
  if (m.al) p.inRound = true
  if (m.al && p.dead) { p.dead = false; SXN_dropAvatar(p) } // respawned: a fresh rig
}
function SXN_gunFor(w) { return w === 'sniper' ? 'marksman' : 'rifle' }
function SXN_makeAvatar(p) {
  var G = SXN.G, grp = new lt.Group()
  G.scene.add(grp)
  var sv = null
  try { if (typeof SXS !== 'undefined' && SXS.ready) sv = SXS_make(G, SXN_ffa() ? 'net_red' : 'net_' + p.team, 1, 'rifle') } catch (e) { console.error('[net] avatar', e) }
  if (sv) grp.add(sv.holder)
  else {
    var m = new lt.Mesh(new lt.CapsuleGeometry(0.33, 1.15, 4, 10), new lt.MeshStandardMaterial({ color: !SXN_ffa() && p.team === 'blue' ? 0x3a7bd5 : 0xc0304a, roughness: 0.6 }))
    m.position.y = 0.92; m.castShadow = true
    grp.add(m)
  }
  var av = {
    p: p, grp: grp, sv: sv, gun: 'rifle', vel: new lt.Vector3(), last: null, deadT: 0, visible: true, losT: 0, seen: true, rigN: 0, rigDt: 0,
    st: { group: grp, alive: true, y: 0, yaw: 0, vx: 0, vz: 0, crouch: 0, aim: 1, aimYaw: 0, aimPitch: 0, recoil: 0, flinch: 0, groundY: function (x, z) { return G.physics.groundHeight(x, z, grp.position.y + 0.8) } },
  }
  av.proxy = {
    type: 'player', label: p.name, faction: 'enemy', pos: grp.position,
    get alive() { return !p.dead && av.visible },
    damage: function (amount, point, dir, part) { return SXN_hitPlayer(p, amount, part) },
  }
  return av
}
function SXN_dropAvatar(p) {
  var av = p.av
  if (!av) return
  try { av.sv && av.sv.dispose() } catch (e) { }
  av.grp.parent && av.grp.parent.remove(av.grp)
  av.tag && av.tag.remove()
  p.av = null
}
var SXN_tmp = null
function SXN_sample(buf, t, out) {
  // interpolate the buffered states at time t
  var b = buf
  if (!b.length) return null
  if (t <= b[0].t || b.length === 1) { out.x = b[0].x; out.y = b[0].y; out.z = b[0].z; out.yaw = b[0].yaw; out.pitch = b[0].pitch; return b[0] }
  for (var i = b.length - 1; i > 0; i--) {
    if (b[i - 1].t <= t) {
      var A = b[i - 1], B = b[i], f = Math.min(1, (t - A.t) / Math.max(1e-3, B.t - A.t))
      out.x = A.x + (B.x - A.x) * f; out.y = A.y + (B.y - A.y) * f; out.z = A.z + (B.z - A.z) * f
      var dy = B.yaw - A.yaw
      while (dy > Math.PI) dy -= 2 * Math.PI
      while (dy < -Math.PI) dy += 2 * Math.PI
      out.yaw = A.yaw + dy * f; out.pitch = A.pitch + (B.pitch - A.pitch) * f
      return B
    }
  }
  return b[b.length - 1]
}
var SXN_camP = null, SXN_camF = null
function SXN_updateAvatars(dt) {
  var G = SXN.G, now = performance.now() / 1000, t = now - SXN_TUNE.interp
  if (!SXN_tmp) { SXN_tmp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }; SXN_camP = new lt.Vector3(); SXN_camF = new lt.Vector3() }
  G.camera.getWorldPosition(SXN_camP)
  G.camera.getWorldDirection(SXN_camF)
  for (var id in SXN.players) {
    if (id === SXN.myId) continue
    var p = SXN.players[id]
    var last = p.buf[p.buf.length - 1]
    if (!last || !SXN_inGame()) { if (p.av) p.av.grp.visible = false; continue }
    // driving a vehicle: show the vehicle where they drive it, no body
    SXN_pinVehicle(p, last)
    if (!p.av) p.av = SXN_makeAvatar(p)
    var av = p.av, s = SXN_tmp, cur = SXN_sample(p.buf, t, s)
    var stale = now - last.t > 3
    av.visible = !last.v && !stale && (last.al || av.deadT < 8)
    av.grp.visible = av.visible
    if (!av.visible) { SXN_tag(av, null); continue }
    var P = av.grp.position
    if (av.last) { av.vel.set((s.x - av.last.x) / Math.max(dt, 1e-3), 0, (s.z - av.last.z) / Math.max(dt, 1e-3)) } else av.last = new lt.Vector3()
    var vy = av.stepY == null ? 0 : (s.y - av.stepY) / Math.max(dt, 1e-3)
    av.stepY = s.y
    av.last.set(s.x, s.y, s.z)
    P.set(s.x, s.y, s.z)
    var st = av.st, sp = Math.hypot(av.vel.x, av.vel.z)
    try { SXN_footstep(av, last, s, sp, vy, dt) } catch (e) { }
    st.alive = !!last.al; st.y = s.y; st.yaw = s.yaw; st.vx = av.vel.x; st.vz = av.vel.z
    st.crouch += ((last.cr ? 1 : 0) - st.crouch) * Math.min(1, dt * 8)
    st.aim = last.ads || sp < 4.5 ? 1 : 0.35
    st.aimPitch = s.pitch || 0
    st.lean = (st.lean || 0) + ((last.ln || 0) - (st.lean || 0)) * Math.min(1, dt * 10)
    st.recoil = Math.max(0, st.recoil - dt * 4)
    var gv = SXN_gunFor(last.w)
    if (av.sv && gv !== av.gun) { av.gun = gv; av.sv.setGun(gv) }
    if (!last.al) { av.deadT += dt; p.dead = true } else av.deadT = 0
    av.grp.rotation.set(0, s.yaw, 0)
    // the rig: every frame up close in view, every 2nd/3rd frame far off or behind
    var cx = P.x - SXN_camP.x, cz = P.z - SXN_camP.z, cd = Math.hypot(cx, cz)
    var every = cd > SXN_TUNE.lodFar || (cd > 4 && cx * SXN_camF.x + cz * SXN_camF.z < 0) ? 3 : cd > SXN_TUNE.lodNear ? 2 : 1
    av.rigDt = (av.rigDt || 0) + dt
    if (++av.rigN >= every || !last.al) { av.rigN = 0; try { av.sv && av.sv.update(av.rigDt, st) } catch (e) { } av.rigDt = 0 }
    if (!last.al) { var k = Math.min(1, av.deadT / 0.7); av.grp.rotation.set(-1.45 * k * k, s.yaw, 0, 'YXZ') }
    SXN_tag(av, last)
  }
}
// ------------------------------------------------------------ footsteps
// The other players' footsteps, heard where they are (3D, the world bus):
// one step per stride of their movement on the ground. Concrete and
// metal carry ~15 m, crouch-walking on dry ground is silent; wading through
// water (the flooded crossing, the settling basin) splashes loud and carries
// ~30 m — even crouched — so it gives you away. Gains are relative to the
// game's own step sounds; ref/roll = the panner's inverse distance model.
var SXN_STEP = {
  // one step per stride m, as the local player's own (game: stride walk/sprint/crouch)
  stride: 1.55, strideSprint: 2.1, strideCrouch: 1.05, minSpeed: 0.6, sprintSpeed: 5.2, maxDist: 45, sprint: 1.25,
  concrete: { gain: 0.55, ref: 2.2, roll: 1.1 },
  metal: { gain: 0.7, ref: 2.6, roll: 1.0 },
  water: { gain: 1.35, ref: 5, roll: 0.55, crouch: 0.6 },
  stats: { concrete: 0, metal: 0, water: 0 },
}
// world-bus copies of the game's step sounds (same generator, positional)
function SXN_stepSounds() {
  if (SXN_stepSounds.done) return true
  if (typeof Go === 'undefined' || !Go.step_concrete) return false
  ;['step_concrete', 'step_water', 'step_metal'].forEach(function (k) {
    if (Go[k] && !Go[k + '_w']) Go[k + '_w'] = Object.assign({}, Go[k], { bus: 'world', max: 6, boot: 0 })
  })
  SXN_stepSounds.done = true
  return true
}
function SXN_stepSurface(x, y, z) {
  var G = SXN.G
  try { if (G.ground && G.ground.isPuddle && y < 0.05 && G.ground.isPuddle(x, z)) return 'water' } catch (e) { }
  var f = 'concrete'
  try { f = (G.level && G.level.groundSurfaceAt && G.level.groundSurfaceAt(x, z)) || 'concrete' } catch (e) { }
  return f === 'metal' ? 'metal' : 'concrete'
}
function SXN_footstep(av, last, s, sp, vy, dt) {
  var T = SXN_STEP, G = SXN.G
  // dead, driving, airborne (jumping / falling) or barely moving: no steps
  if (!last.al || last.v || Math.abs(vy) > 1.6 || sp < T.minSpeed) { av.stepD = Math.min(av.stepD || 0, 0.6); return }
  // (the state's `sp` is spawn protection, not sprint: sprint = running fast)
  var run = sp > T.sprintSpeed, stride = last.cr ? T.strideCrouch : run ? T.strideSprint : T.stride
  av.stepD = (av.stepD || 0) + sp * Math.min(dt, 0.1)
  if (av.stepD < stride) return
  av.stepD -= stride
  if (SXN_camP && Math.hypot(s.x - SXN_camP.x, s.z - SXN_camP.z) > T.maxDist) return
  var f = SXN_stepSurface(s.x, s.y, s.z), k = T[f]
  var g = k.gain * (run ? T.sprint : 1)
  if (last.cr) { if (f !== 'water') return; g *= k.crouch }
  if (!SXN_stepSounds()) return
  T.stats[f]++
  G.audio && G.audio.play && G.audio.play('step_' + f + '_w', { pos: [s.x, s.y + 0.05, s.z], gain: g, ref: k.ref, roll: k.roll, pitch: run ? 1.05 : 1, jitter: 0.07 })
}

// name tag + health (team-mates), hidden behind walls for the other team
var SXN_tagV = null
function SXN_tag(av, last) {
  if (!SXN_tagV) SXN_tagV = new lt.Vector3()
  var G = SXN.G, ui = SXN.ui
  if (!ui || !ui.tags) return
  if (!last) { if (av.tag) av.tag.style.display = 'none'; return }
  if (!av.tag) {
    av.tag = document.createElement('div')
    av.tag.className = 'sxn-tag'
    av.tag.innerHTML = '<span></span><i><u></u></i>'
    ui.tags.appendChild(av.tag)
  }
  var friend = SXN_ally(av.p)
  av.losT -= G.time.dt || 0.016
  if (!friend && av.losT <= 0) {
    av.losT = 0.25
    var eye = G.player.eye || G.camera.position
    try { av.seen = G.physics.lineOfSight(eye, SXN_tagV.copy(av.grp.position).setY(av.grp.position.y + 1.5)) } catch (e) { av.seen = true }
  }
  var v = SXN_tagV.copy(av.grp.position).setY(av.grp.position.y + 2.15)
  var dist = v.distanceTo(G.camera.position)
  v.project(G.camera)
  var show = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist < (friend ? 400 : 90) && (friend || av.seen) && last.al
  av.tag.style.display = show ? 'block' : 'none'
  if (!show) return
  av.tag.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * innerWidth).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * innerHeight).toFixed(1) + 'px)'
  var cls = 'sxn-tag ' + (friend ? 'friend' : 'foe')
  if (av.tag._c !== cls) { av.tag._c = cls; av.tag.className = cls }
  var txt = (last.sp ? '⛨ ' : '') + av.p.name + (friend ? ' · ' + Math.round(dist) + 'm' : '')
  if (av.tag._t !== txt) { av.tag._t = txt; av.tag.firstChild.textContent = txt }
  var hpw = Math.max(0, Math.min(100, last.hp | 0)) + '%'
  if (av.tag._h !== hpw) { av.tag._h = hpw; av.tag.querySelector('u').style.width = hpw }
}
function SXN_raycastAvatars(o, d, max) {
  var best = null
  for (var id in SXN.players) {
    if (id === SXN.myId) continue
    var p = SXN.players[id], av = p.av
    if (!av || !av.visible || p.dead || SXN_ally(p)) continue
    var h = null
    if (av.sv) h = av.sv.raycast(o, d, best ? best.dist : max)
    else {
      var c = av.grp.position, ox = o.x - c.x, oy = o.y - (c.y + 0.9), oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - 0.5, hh = b * b - cc
      if (hh >= 0) { var tt = -b - Math.sqrt(hh); if (tt >= 0 && tt < (best ? best.dist : max)) h = { dist: tt, point: o.clone().addScaledVector(d, tt), normal: d.clone().negate(), part: 'body' } }
    }
    if (h && (!best || h.dist < best.dist)) best = { dist: h.dist, point: h.point, normal: h.normal, enemy: av.proxy, part: h.part }
  }
  return best
}
function SXN_hitPlayer(p, amount, part) {
  if (!SXN.active || p.dead || SXN_ally(p) || !(amount > 0)) return false
  var ls = p.buf && p.buf[p.buf.length - 1]
  if (ls && ls.sp) return false // spawn protection
  SXN_emit({ t: 'hit', to: p.id, a: +(amount * SXN_TUNE.pvpScale).toFixed(1), part: part || 'body' })
  if (p.av) p.av.st.flinch = Math.min(1, (p.av.st.flinch || 0) + 0.3)
  return false
}
function SXN_remoteShot(p, m) {
  var G = SXN.G
  if (!SXN_inGame() || !m.d) return
  var V3 = lt.Vector3, av = p.av
  // the shot is the shooter's eye ray (m.o, m.d); the tracer is drawn from the
  // gun of their avatar to where that ray stops — a wall, me, or another
  // player — so it meets what the shot really hit (a line parallel to the eye
  // ray from the gun passed 20-30 cm beside it)
  var eye = new V3(m.o[0], m.o[1], m.o[2]), d = new V3(m.d[0], m.d[1], m.d[2]).normalize()
  var o = av && av.visible && av.sv ? av.sv.muzzle(new V3()) : eye.clone()
  var len = 160
  try { var h = G.physics.raycast(eye, d, len); if (h) len = h.dist } catch (e) { }
  try {
    var me = G.player
    if (me && me.alive && typeof SXU_playerRay === 'function' && (SXN_ffa() || p.team !== SXN.team)) { var tm = SXU_playerRay(me, eye, d, len); if (tm >= 0) len = tm }
  } catch (e) { }
  for (var id in SXN.players) {
    var q = SXN.players[id]
    if (id === SXN.myId || q === p || q.dead || !q.av || !q.av.visible || !q.av.sv || (!SXN_ffa() && q.team === p.team)) continue
    try { var hq = q.av.sv.raycast(eye, d, len); if (hq && hq.dist < len) len = hq.dist } catch (e) { }
  }
  var end = eye.clone().addScaledVector(d, len)
  try { if (typeof CXR_glassTrace === 'function') CXR_glassTrace(eye, d, len) } catch (e) { } // window glass (crossroads)
  try { G.fx.tracer(o, end) } catch (e) { }
  try { G.render.lightPool.flash(o, 0xffb070, 28, 6, 0.05) } catch (e) { }
  var pitch = m.w === 'shotgun' ? 0.7 : m.w === 'sniper' ? 0.56 : m.w === 'pistol' ? 1.3 : 1
  try { G.audio.play('rifle_shot', { pos: o.clone(), gain: 0.85, pitch: pitch }) } catch (e) { }
  if (av) av.st.recoil = Math.min(1, av.st.recoil + (m.w === 'shotgun' || m.w === 'sniper' ? 1 : 0.45))
}

// a remote driver's vehicle follows their stream; nobody else can board it
function SXN_pinVehicle(p, last) {
  var U = SXN.G.units
  if (!U) return
  var key = last.v, veh = key ? SXN_vehicleByKey(key) : null
  if (p.veh && p.veh !== veh) { p.veh.__netPilot = null; p.veh = null }
  if (!veh || !last.vp) return
  p.veh = veh
  veh.__netPilot = p.id
  if (U.pilot === veh) return
  if (!veh.__sxnPinned) {
    veh.__sxnPinned = true
    var up0 = veh.update
    veh.update = function (dt) {
      var q = veh.__netPilot && SXN.players[veh.__netPilot], s = q && q.buf[q.buf.length - 1]
      if (SXN.active && s && s.vp) SXN_setVehPose(veh, s.vp)
      return up0.apply(this, arguments)
    }
  }
}
// a vehicle's real physics state: cars keep it in body(), jets expose pos + q,
// the mech / helicopter use pos + yaw
function SXN_vehBody(v) { var f = v.body || v.debug && v.debug.body; return typeof f === 'function' ? f() : null }
function SXN_vehPose(v) {
  var b = SXN_vehBody(v), P = b ? b.pos : v.pos, Q = b ? b.q : v.q && v.q.isQuaternion ? v.q : null
  var out = [SXN_r2(P.x), SXN_r2(P.y), SXN_r2(P.z), +(+(v.yaw || 0)).toFixed(3)]
  if (Q) out.push(+Q.x.toFixed(4), +Q.y.toFixed(4), +Q.z.toFixed(4), +Q.w.toFixed(4))
  return out
}
function SXN_setVehPose(v, vp) {
  var b = SXN_vehBody(v), P = b ? b.pos : v.pos, Q = b ? b.q : v.q && v.q.isQuaternion ? v.q : null
  P.set(vp[0], vp[1], vp[2])
  if (Q && vp.length >= 8) Q.set(vp[4], vp[5], vp[6], vp[7])
  else {
    var d = Object.getOwnPropertyDescriptor(v, 'yaw')
    if (d && (d.writable || d.set)) try { v.yaw = vp[3] } catch (e) { }
  }
  var V = b ? b.vel : v.vel
  if (V && V.set) V.set(0, 0, 0)
  if (b && b.ang && b.ang.set) b.ang.set(0, 0, 0)
  if (v.pos !== P) v.pos.copy(P)
}
function SXN_vehicleKey(u) {
  var U = SXN.G.units, n = 0
  for (var i = 0; i < U.list.length; i++) { var x = U.list[i]; if (x.vehicle && x.type === u.type) { if (x === u) return u.type + '#' + n; n++ } }
  return null
}
function SXN_vehicleByKey(key) {
  var U = SXN.G.units, parts = key.split('#'), n = 0
  for (var i = 0; i < U.list.length; i++) { var x = U.list[i]; if (x.vehicle && x.type === parts[0]) { if (n === +parts[1]) return x; n++ } }
  return null
}

// --------------------------------------------------------- deaths, respawn
function SXN_localDeath() {
  // a player's hit counts as the kill for 10 s (then robots/falls get it)
  var by = SXN.lastBy && performance.now() - (SXN.lastByT || 0) < 10000 ? SXN.lastBy : null
  var me = SXN.players[SXN.myId]
  if (me) { me.__diedT = performance.now(); if (by) { me.__hitBy = by; me.__hitT = SXN.lastByT } }
  SXN_emit({ t: 'died', by: by || null })
  SXN.respawnT = SXN_oneLife() ? -1 : SXN_TUNE.respawn
  SXN_markDeath(SXN.myId, by)
}
function SXN_markDeath(id, by) {
  var p = SXN.players[id], k = by && SXN.players[by]
  if (p) p.dead = true
  if (p) SXN_feed(k && k !== p ? '<b class="' + SXN_clsOf(k) + '">' + k.name + '</b> ✕ <b class="' + SXN_clsOf(p) + '">' + p.name + '</b>' : '<b class="' + SXN_clsOf(p) + '">' + p.name + '</b> went down')
  // my kill: the popup (the counter itself follows the host's tally)
  if (p && k && by === SXN.myId && id !== SXN.myId && typeof SXK_popup === 'function') {
    if (typeof SXK !== 'undefined') SXK.kills = (SXK.kills | 0) + 1
    SXK_popup(p.name, { pvp: true })
  }
  if (SXN.role === 'host') SXN_hostDeath(p, k)
  SXN_refreshUi()
}

// ---------------------------------------------------------- scores (host)
function SXN_hostDeath(p, k) {
  if (!p) return
  p.deaths = (p.deaths | 0) + 1
  var ffa = SXN_ffa()
  if (k && k !== p && (ffa || k.team !== p.team)) {
    k.kills = (k.kills | 0) + 1
    k.pk = (k.pk | 0) + 1
    SXN.score[k.team].pk++ // tallied for the scoreboard; rounds decide the match
    if (ffa) k.rk = (k.rk | 0) + 1 // this round's kills: the free-for-all round goes to the most
  }
  SXN_pushScore()
  SXN_roundCheck()
}

// ----------------------------------------------------- rounds (versus)
// Elimination: one life per round. A side (a team; a player in free-for-all)
// with nobody left standing loses the round — robots and falls count, both
// sides down at once is a draw. The match goes to the first side with
// SXN.winRounds round wins AND a lead of rounds.by (5:4 plays on, 6:4 wins).
// The host decides and sends 'round' {ph: end | match | go}; on 'go' everyone
// respawns at base with the starting kit and the map's pickups put back.
function SXN_elim() { return SXN.active && SXN_versus() }
// one life per round: team rounds only (free-for-all respawns, rounds are timed)
function SXN_oneLife() { return SXN_elim() && !SXN_ffa() }
// the round's length (s) and its name ("3-minute", "90-second")
function SXN_roundSecs() { return Math.max(10, Math.round((+SXN.roundMins || SXN_TUNE.rounds.mins.def) * 60)) }
function SXN_ffaMins() { var s = SXN_roundSecs(); return s % 60 ? s + '-second' : (s / 60) + '-minute' }
// time up in a team round (host): more players standing takes it, equal = a draw
function SXN_teamTimeUp() {
  var sides = SXN_roundSides(), b = sides.blue ? sides.blue.alive : 0, r = sides.red ? sides.red.alive : 0
  if (!sides.blue || !sides.red) { SXN.roundEndT = performance.now() + SXN_roundSecs() * 1000; return } // one team never showed up: the clock starts over
  SXN_roundEnd(b > r ? 'blue' : r > b ? 'red' : null, { k: b + ':' + r, why: 'time' })
}
// seconds left in a timed (free-for-all) round, null when none runs
function SXN_roundLeft() { return SXN.roundLive && SXN.roundEndT ? Math.max(0, Math.round((SXN.roundEndT - performance.now()) / 100) / 10) : null }
// time is up (host): the most kills this round takes it; a tie at the top, or no kills, is a draw
function SXN_ffaRoundEnd() {
  var top = -1, who = [], id
  for (id in SXN.players) { var n = SXN.players[id].rk | 0; if (n > top) { top = n; who = [id] } else if (n === top) who.push(id) }
  var win = top > 0 && who.length === 1 ? who[0] : null
  SXN_roundEnd(win, { k: Math.max(0, top), why: win ? 'kills' : top > 0 ? 'tie' : 'none' })
}
function SXN_sideOf(p) { return SXN_ffa() ? p.id : p.team }
// in this round: alive at some point since it began, and still in the mission
function SXN_inRound(p) {
  if (!p || !p.inRound) return false
  if (p.id === SXN.myId) return SXN_inGame()
  var s = SXN_last(p)
  return !!s && performance.now() / 1000 - s.t < SXN_TUNE.rounds.gone
}
function SXN_roundSides() {
  var sides = {}
  for (var id in SXN.players) {
    var p = SXN.players[id]
    if (!SXN_inRound(p)) continue
    var k = SXN_sideOf(p), sd = sides[k] || (sides[k] = { n: 0, alive: 0 })
    sd.n++
    if (!p.dead) sd.alive++
  }
  return sides
}
function SXN_roundCheck() {
  if (SXN.role !== 'host' || !SXN.roundLive || !SXN_oneLife() || !SXN_inGame() || !SXN.score) return
  if (performance.now() - SXN.roundT0 < SXN_TUNE.rounds.grace * 1000) return
  var sides = SXN_roundSides(), keys = Object.keys(sides)
  if (keys.length < 2) return // nobody to fight yet
  var up = keys.filter(function (k) { return sides[k].alive > 0 })
  if (up.length > 1) return
  SXN_roundEnd(up.length ? up[0] : null)
}
// round wins per side, best first
function SXN_tallies() {
  var S = SXN.score || SXN_newScore()
  var t = SXN_ffa() ? Object.keys(SXN.players).map(function (id) { return { k: id, n: SXN.players[id].rw | 0 } }) : [{ k: 'blue', n: S.blue.rw | 0 }, { k: 'red', n: S.red.rw | 0 }]
  return t.sort(function (a, b) { return b.n - a.n })
}
function SXN_roundEnd(win, extra) {
  var S = SXN.score, R = SXN_TUNE.rounds
  SXN.roundLive = false
  if (win) {
    if (SXN_ffa()) { var wp = SXN.players[win]; if (wp) wp.rw = (wp.rw | 0) + 1 }
    else S[win].rw = (S[win].rw | 0) + 1
  }
  var t = SXN_tallies(), best = t[0], next = t[1] || { n: 0 }
  var match = !!win && best.k === win && best.n >= SXN.winRounds && best.n - next.n >= R.by
  SXN_pushScore() // carries the round wins
  var m = { t: 'round', ph: match ? 'match' : 'end', win: win, round: S.round }
  if (extra) { m.k = extra.k; m.why = extra.why }
  if (match) m.next = R.matchPause
  SXN_broadcast(m)
  SXN_roundMsg(m)
  SXN.matchOver = match
  SXN.roundNextT = match ? R.matchPause : R.pause
}
function SXN_roundGo() {
  var S = SXN.score
  if (SXN.matchOver) {
    S.blue.rw = 0; S.red.rw = 0; S.round = 1
    S.blue.pk = 0; S.red.pk = 0; S.blue.tk = 0; S.red.tk = 0
    for (var id in SXN.players) { var q = SXN.players[id]; q.rw = 0; q.kills = 0; q.pk = 0; q.deaths = 0; q.tk = 0 }
  } else S.round = (S.round | 0) + 1
  SXN.matchOver = false
  for (var id2 in SXN.players) SXN.players[id2].rk = 0
  var m = { t: 'round', ph: 'go', round: S.round, dur: SXN_roundSecs() }
  if (m.dur) { SXN.roundEndT = performance.now() + m.dur * 1000; SXN.roundLive = true }
  SXN_pushScore()
  SXN_broadcast(m)
  SXN_roundMsg(m)
}
// "2:1" → "BLUE 2 v 1 RED alive"
function SXN_aliveLine(k) { var a = String(k || '0:0').split(':'); return 'BLUE ' + (a[0] | 0) + ' v ' + (a[1] | 0) + ' RED alive' }
// a side's name for the banners
function SXN_sideName(k) {
  if (k === 'blue' || k === 'red') return SXN_teamName(k).toUpperCase()
  var p = SXN.players[k]
  return k === SXN.myId ? 'YOU' : p ? p.name.toUpperCase() : '?'
}
function SXN_scoreLine() {
  var S = SXN.score
  if (!S) return ''
  if (!SXN_ffa()) return 'BLUE ' + (S.blue.rw | 0) + ' : ' + (S.red.rw | 0) + ' RED'
  return SXN_tallies().slice(0, 3).map(function (x) { return SXN_sideName(x.k) + ' ' + x.n }).join(' · ')
}
// everyone: what the host decided
function SXN_roundMsg(m) {
  if (!m) return
  if (m.ph === 'go') {
    SXN.roundLive = true
    SXN.roundT0 = performance.now()
    SXN.roundNextT = 0
    for (var id in SXN.players) { var p = SXN.players[id]; p.dead = false; p.inRound = false; p.rk = 0 }
    SXN.roundEndT = m.dur ? performance.now() + m.dur * 1000 : 0
    SXN.respawnT = -1
    if (SXN_inGame()) {
      SXN_respawn()
      try { SXN.G.weapon.arsenal.resetPickups && SXN.G.weapon.arsenal.resetPickups() } catch (e) { }
    }
    SXN_resultsHide()
    SXN_banner('ROUND ' + m.round + ' — ' + SXN_scoreLine(), 2.5)
    SXN_refreshUi()
    return
  }
  SXN.roundLive = false
  var who = m.win ? SXN_sideName(m.win) : null, mine = m.win && (m.win === SXN.myId || (!SXN_ffa() && m.win === SXN.team))
  if (m.ph === 'match') SXN_results(m)
  else if (who) SXN_banner((who === 'YOU' ? 'YOU WIN' : who + ' WINS') + ' ROUND ' + m.round + (m.why === 'kills' ? ' with ' + m.k + ' kill' + (m.k === 1 ? '' : 's') : m.why === 'time' ? ' on time (' + SXN_aliveLine(m.k) + ')' : '') + ' — ' + SXN_scoreLine(), SXN_TUNE.rounds.pause)
  else SXN_banner('ROUND ' + m.round + ' — DRAW, ' + (m.why === 'tie' ? 'tied on ' + m.k + ' kill' + (m.k === 1 ? '' : 's') : m.why === 'none' ? 'no kills' : m.why === 'time' ? 'time up with ' + SXN_aliveLine(m.k) : 'nobody left standing') + ' · ' + SXN_scoreLine(), SXN_TUNE.rounds.pause)
  SXN_refreshUi()
}
// ----------------------------------------------------- spectate
// Out in a team round (SXN_oneLife): the camera follows a teammate still
// standing, over the shoulder, until the next round. Left click / Space: the
// next teammate, right click: the previous one. The gun in your hands is put
// away; a bar at the bottom says who you watch and who is still standing.
function SXN_specOn() {
  var G = SXN.G
  return SXN.active && SXN_oneLife() && SXN_inGame() && G.player && !G.player.alive && !(SXN.ui && SXN.ui.res && SXN.ui.res.classList.contains('on'))
}
function SXN_specTargets() {
  var out = []
  Object.keys(SXN.players).sort().forEach(function (id) {
    var p = SXN.players[id]
    if (id !== SXN.myId && p.team === SXN.team && !p.dead && p.av && p.av.visible && SXN_inRound(p)) out.push(id)
  })
  return out
}
function SXN_specStep(d) {
  var list = SXN_specTargets(), S = SXN.spec
  if (!S || !list.length) return
  var i = list.indexOf(S.id)
  S.id = list[(i < 0 ? 0 : i + d + list.length) % list.length]
  S.snap = true
}
var SXN_specV = null
// every frame, before the scene is drawn (G.render.frame is wrapped in SXN_install)
function SXN_specFrame() {
  var G = SXN.G, ui = SXN.ui, on = SXN_specOn()
  if (!on) {
    if (SXN.spec) { SXN.spec = null; if (ui && ui.spec) ui.spec.classList.remove('on') }
    return
  }
  if (!SXN_specV) SXN_specV = { pos: new lt.Vector3(), look: new lt.Vector3(), head: new lt.Vector3(), c: new lt.Vector3(), f: new lt.Vector3(), r: new lt.Vector3() }
  var S = SXN.spec, now = performance.now()
  if (!S) {
    S = SXN.spec = { id: null, t: now, snap: true, look: new lt.Vector3(), pos: new lt.Vector3() }
    try { G.weapon.setVisible && G.weapon.setVisible(false) } catch (e) { }
  }
  var dt = Math.min(0.1, (now - S.t) / 1000); S.t = now
  var list = SXN_specTargets()
  if (S.id == null || list.indexOf(S.id) < 0) { S.id = list[0] || null; S.snap = true }
  var p = S.id && SXN.players[S.id], T = SXN_TUNE.spectate, V = SXN_specV
  if (p && p.av) {
    var grp = p.av.grp, yaw = grp.rotation.y, pitch = p.av.st && p.av.st.aimPitch || 0
    V.head.copy(grp.position); V.head.y += T.head
    V.f.set(-Math.sin(yaw), 0, -Math.cos(yaw)); V.r.set(Math.cos(yaw), 0, -Math.sin(yaw))
    // over the shoulder, pulled in when a wall is in the way
    var picked = false
    for (var k = 0; k < 5 && !picked; k++) {
      var d = T.back * (1 - k * 0.2)
      V.c.copy(V.head).addScaledVector(V.f, -d).addScaledVector(V.r, T.side * (d / T.back)); V.c.y += T.up * (d / T.back)
      var clear = true
      try { clear = G.physics.lineOfSight(V.head, V.c) } catch (e) { }
      if (clear) picked = true
    }
    if (!picked) V.c.copy(V.head).addScaledVector(V.f, -0.3)
    V.look.copy(V.head).addScaledVector(V.f, 10 * Math.cos(pitch)); V.look.y += 10 * Math.sin(pitch)
    var a = S.snap ? 1 : 1 - Math.exp(-dt * T.follow)
    S.pos.lerp(V.c, a); S.look.lerp(V.look, a); S.snap = false
    G.camera.position.copy(S.pos)
    G.camera.lookAt(S.look)
    G.camera.updateMatrixWorld()
  }
  if (ui && ui.spec) {
    var name = p ? p.name : null, txt = (name ? 'Spectating <b>' + String(name).replace(/[<>&"']/g, '') + '</b>' + (list.length > 1 ? ' (' + (list.indexOf(S.id) + 1) + '/' + list.length + ') · click / Space: next · right click: previous' : '') : 'No teammate to watch') + '<br><span>' + SXN_outText() + '</span>'
    if (ui.spec._t !== txt) { ui.spec._t = txt; ui.spec.innerHTML = txt }
    if (!ui.spec.classList.contains('on')) ui.spec.classList.add('on')
  }
}

// ----------------------------------------------------- match results
// Everyone, when the host calls the match: who won (VICTORY / DEFEAT for you),
// the final score and each player's match: player kills, deaths, K/D, robots
// downed (free-for-all: rounds won too), the MVP starred. Buttons: Main menu
// (leave the room, back to the title) for all; Next match for the host. The
// next match starts by itself when the countdown runs out.
function SXN_results(m) {
  var ui = SXN.ui, G = SXN.G
  if (!ui) return
  if (!ui.res) {
    var el = document.createElement('div')
    el.className = 'sxn-res'
    el.innerHTML = '<div class="sxn-res-card" role="dialog" aria-label="Match results"><p class="sxn-res-k"></p><h2 class="sxn-res-h"></h2><p class="sxn-res-s"></p>' +
      '<div class="sxn-res-t"></div><p class="sxn-res-n"></p>' +
      '<div class="sxn-res-a"><button class="btn sxn-res-menu" type="button">Main menu</button><button class="btn primary sxn-res-next" type="button">Next match</button></div></div>'
    ;(document.getElementById('app') || document.body).appendChild(el)
    el.addEventListener('keydown', function (e) { e.stopPropagation() })
    el.querySelector('.sxn-res-menu').addEventListener('click', function () { SXN_toMenu() })
    el.querySelector('.sxn-res-next').addEventListener('click', function () { if (SXN.role === 'host' && !SXN.roundLive && SXN.matchOver) SXN.roundNextT = 0.01 })
    ui.res = el
  }
  var ffa = SXN_ffa(), win = m.win, mine = win && (win === SXN.myId || (!ffa && win === SXN.team))
  var q = function (s) { return ui.res.querySelector(s) }
  q('.sxn-res-k').textContent = mine ? 'VICTORY' : 'DEFEAT'
  q('.sxn-res-k').className = 'sxn-res-k ' + (mine ? 'win' : 'lose')
  q('.sxn-res-h').textContent = ffa ? (win === SXN.myId ? 'YOU WIN THE MATCH' : SXN_sideName(win) + ' WINS THE MATCH') : SXN_teamName(win).toUpperCase() + ' TEAM WINS'
  q('.sxn-res-h').className = 'sxn-res-h ' + (ffa ? '' : win)
  q('.sxn-res-s').textContent = SXN_scoreLine() + ' · ' + (SXN.score ? (SXN.score.round | 0) : 0) + ' rounds played'
  // the table: teams side by side in order (the winners first), best first
  var rows = Object.keys(SXN.players).map(function (id) {
    var p = SXN.players[id], pk = p.pk | 0, d = p.deaths | 0
    return { id: id, name: p.name, team: p.team, pk: pk, d: d, kd: d ? pk / d : pk, bots: Math.max(0, (p.kills | 0) - pk), rw: p.rw | 0 }
  })
  var mvp = rows.slice().sort(function (a, b) { return b.pk - a.pk || a.d - b.d || b.bots - a.bots })[0]
  rows.sort(function (a, b) {
    if (ffa) return b.rw - a.rw || b.pk - a.pk || a.d - b.d
    if (a.team !== b.team) return a.team === win ? -1 : 1
    return b.pk - a.pk || a.d - b.d
  })
  var esc = function (s) { return String(s).replace(/[<>&"']/g, '') }
  var html = '<table><thead><tr><th class="n">Player</th>' + (ffa ? '<th>Rounds</th>' : '') + '<th>Kills</th><th>Deaths</th><th>K/D</th><th>Robots</th></tr></thead><tbody>'
  rows.forEach(function (r) {
    var cls = (r.id === SXN.myId ? 'me ' : '') + (ffa ? '' : r.team)
    html += '<tr class="' + cls + '"><td class="n">' + (ffa ? '' : '<i class="sxn-dot ' + r.team + '"></i>') + esc(r.name) + (r.id === SXN.myId ? ' <span>(you)</span>' : '') + (mvp && r.id === mvp.id && (mvp.pk > 0 || mvp.bots > 0) ? ' <b class="mvp">★ MVP</b>' : '') + '</td>' +
      (ffa ? '<td>' + r.rw + '</td>' : '') + '<td>' + r.pk + '</td><td>' + r.d + '</td><td>' + r.kd.toFixed(2) + '</td><td>' + r.bots + '</td></tr>'
  })
  q('.sxn-res-t').innerHTML = html + '</tbody></table>'
  q('.sxn-res-next').hidden = SXN.role !== 'host'
  ui.resEndT = performance.now() + (m.next || SXN_TUNE.rounds.matchPause) * 1000
  SXN_resultsTick()
  ui.res.classList.add('on')
  // free the mouse for the buttons without the game pausing (as the bag does)
  try { if (typeof SXM !== 'undefined' && SXM) SXM.holdPause = true } catch (e) { }
  try { document.pointerLockElement && document.exitPointerLock() } catch (e) { }
  try { G.player.enabled = false } catch (e) { }
  // nobody gets hurt while reading it (robots keep going)
  SXN.protectUntil = performance.now() + ((m.next || SXN_TUNE.rounds.matchPause) + 1) * 1000
}
function SXN_resultsTick() {
  var ui = SXN.ui
  if (!ui || !ui.res || !ui.res.classList.contains('on')) return
  var s = Math.max(0, Math.ceil((ui.resEndT - performance.now()) / 1000))
  var t = 'Next match in ' + s + ' s' + (SXN.role === 'host' ? ' — or start it now' : ' — the host can start it sooner')
  if (ui.res._t !== t) { ui.res._t = t; ui.res.querySelector('.sxn-res-n').textContent = t }
}
function SXN_resultsHide() {
  var ui = SXN.ui, G = SXN.G
  if (!ui || !ui.res || !ui.res.classList.contains('on')) return
  ui.res.classList.remove('on')
  try { G.player.enabled = true } catch (e) { }
  try { if (G.input && !G.input.touch && G.game && G.game.state === 'playing' && G.input.requestLock) G.input.requestLock() } catch (e) { }
  setTimeout(function () { try { if (typeof SXM !== 'undefined' && SXM && !SXM.open) SXM.holdPause = false } catch (e) { } }, 400)
}
// leave the room and go back to the title (the page reloads without the
// room in its link, so it does not rejoin)
function SXN_toMenu() {
  try { SXN_leave() } catch (e) { }
  var p = new URLSearchParams(location.search)
  ;['autostart', 'shot', 'cam', 'bench', 'dt', 'join', 'host', 'room', 'team', 'mode', 'bots', 'seed'].forEach(function (k) { p.delete(k) })
  if (typeof SX_MAP !== 'undefined') p.set('map', SX_MAP)
  var q = p.toString()
  setTimeout(function () { location.href = location.pathname + (q ? '?' + q : '') }, 150)
}
// the dead player's screen while the round goes on
function SXN_outText() {
  var sides = SXN_roundSides(), parts = []
  if (SXN_ffa()) { var n = 0; for (var k in sides) n += sides[k].alive; parts.push(n + ' left standing') }
  else ['blue', 'red'].forEach(function (t) { parts.push(SXN_teamName(t).toUpperCase() + ' ' + (sides[t] ? sides[t].alive : 0) + ' alive') })
  return 'You are out — back next round · ' + parts.join(' · ')
}
// lobby (host): Blue vs Red or free-for-all
function SXN_setMode(mode) {
  mode = mode === 'ffa' ? 'ffa' : 'teams'
  if (SXN.mode === mode) return
  SXN.mode = mode
  for (var id in SXN.players) SXN_dropAvatar(SXN.players[id]) // colours change
  SXN_updateMode()
  SXN_refreshUi()
}
// lobby (host): how many robots — many (the solo amount), few, off
// lobby (host): room size within 2..map max, never below the players in it
function SXN_pickRoom(d) {
  if (!SXN.active || SXN.role !== 'host') return
  var n = Object.keys(SXN.players).length, cur = SXN_roomMax()
  var next = Math.max(2, n, Math.min(SXN_mapMax(), cur + d))
  if (next === cur) { SXN_status(d < 0 ? 'Can\'t go below the ' + n + ' players in the room' : 'This map takes at most ' + SXN_mapMax()); return }
  SXN.roomMax = next
  SXN_broadcast(SXN_rosterMsg())
  SXN_refreshUi()
  SXN_status('Room size ' + next + ' · ' + Math.ceil(next / 2) + ' per team')
}
function SXN_pickRounds(n) {
  if (!SXN.active || SXN.role !== 'host' || SXN_inGame()) return
  var R = SXN_TUNE.rounds
  n = Math.round(+n)
  if (!(n >= R.min)) n = R.min
  n = Math.min(R.max, n)
  SXN.winRounds = n
  try { localStorage.setItem('doomzone.rounds', String(n)) } catch (e) { }
  SXN_broadcast(SXN_rosterMsg())
  SXN_updateMode()
  SXN_refreshUi()
  SXN_status('First to ' + n + ' round' + (n > 1 ? 's' : '') + ', winning by ' + R.by)
}
function SXN_pickMins(v) {
  if (!SXN.active || SXN.role !== 'host' || SXN_inGame()) return
  var R = SXN_TUNE.rounds.mins
  v = Math.round((+v) / R.step) * R.step
  if (!(v >= R.min)) v = R.min
  v = Math.min(R.max, v)
  SXN.roundMins = v
  try { localStorage.setItem('doomzone.roundmins', String(v)) } catch (e) { }
  SXN_broadcast(SXN_rosterMsg())
  SXN_updateMode()
  SXN_refreshUi()
  SXN_status('Rounds of ' + SXN_ffaMins().replace('-', ' ') + 's at most')
}
function SXN_pickBots(b) {
  if (!SXN.active || SXN.role !== 'host' || SXN_inGame() || SXN_TUNE.bots[b] == null) return
  SXN.bots = b
  SXN_broadcast(SXN_rosterMsg())
  SXN_refreshUi()
  SXN_status(b === 'off' ? 'No robots — players only' : b === 'few' ? 'Fewer robots' : 'Full robot waves')
}
function SXN_pickMode(mode) {
  if (!SXN.active || SXN.role !== 'host' || SXN_inGame()) return
  SXN_setMode(mode)
  SXN_broadcast(SXN_rosterMsg())
  SXN_status(SXN_ffa() ? 'Free-for-all: everyone fights everyone' : 'Blue vs Red teams')
}
function SXN_pushScore() {
  if (SXN.role !== 'host') return
  var m = { t: 'score', s: SXN.score, k: Object.keys(SXN.players).map(function (id) { var p = SXN.players[id]; return [id, p.kills | 0, p.pk | 0, p.deaths | 0, p.tk | 0, p.rw | 0, p.rk | 0] }), rt: SXN_roundLeft() }
  SXN_broadcast(m)
  SXN_applyScore(m)
}
function SXN_applyScore(m) {
  if (!m || !m.s) return
  SXN.score = m.s
  ;(m.k || []).forEach(function (r) { var p = SXN.players[r[0]]; if (p) { p.kills = r[1]; p.pk = r[2]; p.deaths = r[3]; p.tk = r[4] | 0; p.rw = r[5] | 0; p.rk = r[6] | 0 } })
  if (m.rt != null && SXN.role === 'guest') { SXN.roundEndT = performance.now() + m.rt * 1000; SXN.roundLive = true }
  var me = SXN.players[SXN.myId]
  if (me && typeof SXK !== 'undefined') SXK.kills = me.kills | 0
  SXN_refreshUi()
}
// a robot died here (score/score.js). Only the host's robots count: it credits
// whoever hit it last (its own player, or a guest through 'dmg').
function SXN_robotDown(o, type) {
  if (SXN.role !== 'host' || !o || !SXN.score) return
  var now = performance.now(), tM = o.__sxkT || 0, tN = o.__netHitT || 0, by = null
  if (tN > tM && now - tN < SXN_TUNE.credit) by = o.__netHitBy
  else if (o.__sxkMine || (tM && now - tM < SXN_TUNE.credit)) by = SXN.myId
  var p = by && SXN.players[by]
  if (!p) return
  var tr = typeof SXK_isTrooper === 'function' && SXK_isTrooper(o, type)
  p.kills = (p.kills | 0) + 1
  if (tr) { SXN.score[p.team].tk++; p.tk = (p.tk | 0) + 1 }
  var m = { t: 'rk', from: SXN.myId, by: by, n: typeof SXK_name === 'function' ? SXK_name(o, type) : 'Robot' }
  SXN_broadcast(m)
  SXN_robotKill(m)
  SXN_pushScore()
}
function SXN_robotKill(m) {
  var k = SXN.players[m.by]
  if (!k) return
  SXN_feed('<b class="' + SXN_clsOf(k) + '">' + k.name + '</b> ✕ ' + String(m.n || 'Robot').replace(/[<>&"']/g, ''))
  if (m.by === SXN.myId && typeof SXK_popup === 'function') {
    if (typeof SXK !== 'undefined') SXK.kills = (SXK.kills | 0) + 1
    SXK_popup(m.n)
  }
}
// team bases: Blue at the mission start; Red at the friendly camp farthest
// from it (desert: Camp Mirage, the Harrow's pad), else at the robots' ground
// spawn farthest from it, pulled 8 m toward Blue — the same spot everywhere
function SXN_base(team) {
  var G = SXN.G, lv = G.level || {}, V3 = lt.Vector3
  var st = lv.playerStart || { pos: new V3(), yaw: 0 }
  // a map that names its team bases (crossroads) wins
  var tsp = lv.teamSpawns && lv.teamSpawns[team === 'red' ? 'red' : 'blue']
  if (tsp) return { pos: tsp.pos.clone(), yaw: tsp.yaw || 0, r: tsp.r }
  if (team !== 'red') return { pos: st.pos.clone(), yaw: st.yaw || 0 }
  var camp = null, cd = -1
  ;((G.units && G.units.outposts) || []).forEach(function (site) {
    var d = site.def
    if (d && d.side === 'ally') { var dd = Math.hypot(d.x - st.pos.x, d.z - st.pos.z); if (dd > cd) { cd = dd; camp = d } }
  })
  if (camp) {
    var cx = camp.x + 6, cz = camp.z + 4
    return { pos: new V3(cx, 0, cz), yaw: Math.atan2(-(st.pos.x - cx), -(st.pos.z - cz)) }
  }
  var pts = (lv.enemySpawns || []).filter(function (s) { return s.type === 'ground' })
  if (!pts.length) pts = lv.enemySpawns || []
  var best = null, bd = -1
  pts.forEach(function (s) { var d = Math.hypot(s.pos.x - st.pos.x, s.pos.z - st.pos.z); if (d > bd) { bd = d; best = s } })
  if (!best) return { pos: st.pos.clone(), yaw: st.yaw || 0 }
  var p = best.pos.clone(), dx = st.pos.x - p.x, dz = st.pos.z - p.z, L = Math.hypot(dx, dz) || 1
  p.x += dx / L * 8; p.z += dz / L * 8
  return { pos: p, yaw: Math.atan2(-dx, -dz) }
}
// free-for-all: both team bases plus the robots' ground spawns; take the one
// farthest from the nearest other living player (nobody known yet: spread by
// the players' order, so a fresh round starts everyone apart)
function SXN_ffaBase(first) {
  var G = SXN.G, lv = G.level || {}, list = [SXN_base('blue'), SXN_base('red')]
  if (lv.ffaSpawns && lv.ffaSpawns.length > 2) lv.ffaSpawns.slice(2).forEach(function (sp) { list.push({ pos: sp.pos.clone(), yaw: sp.yaw || 0 }) })
  else (lv.enemySpawns || []).forEach(function (sp) { if (sp.type === 'ground') list.push({ pos: sp.pos.clone(), yaw: Math.random() * 6.28 }) })
  var others = SXN_remoteSpots()
  // the round's first spawn is by join order (players deploying together
  // can't see each other yet); respawns go far from whoever is alive
  if (first || !others.length) {
    // 1st player Blue's base, 2nd Red's, then the spawns farthest from both
    var b0 = list[0].pos, b1 = list[1].pos
    var rest = list.slice(2).sort(function (a, b) {
      var da = Math.min(a.pos.distanceTo(b0), a.pos.distanceTo(b1)), db = Math.min(b.pos.distanceTo(b0), b.pos.distanceTo(b1))
      return db - da
    })
    var order = list.slice(0, 2).concat(rest)
    var ids = Object.keys(SXN.players), i = Math.max(0, ids.indexOf(SXN.myId))
    return order[i % order.length]
  }
  var best = list[0], bd = -1
  list.forEach(function (c) {
    var d = Infinity
    others.forEach(function (o) { d = Math.min(d, Math.hypot(o.x - c.pos.x, o.z - c.pos.z)) })
    if (d > bd) { bd = d; best = c }
  })
  return best
}
function SXN_spawnPoint(first) {
  var G = SXN.G, V3 = lt.Vector3, b = SXN_ffa() ? SXN_ffaBase(first) : SXN_base(SXN.team)
  // a base may say how far from its spot a player lands (waterworks: inside the spawn pocket)
  var a = Math.random() * 6.28, r = Math.random() * (b.r != null ? b.r : 3)
  var pos = b.pos.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r))
  if (G.units && G.units.spotOutside) pos = G.units.spotOutside(pos.x, pos.z, 0.6, b.pos.y || 0)
  pos.y = G.physics.groundHeight(pos.x, pos.z, pos.y + 2)
  return { pos: pos, yaw: b.yaw }
}
function SXN_respawn() {
  var G = SXN.G, sp = SXN_spawnPoint()
  try { G.player.reset({ pos: sp.pos, yaw: sp.yaw }) } catch (e) { console.error('[net] respawn', e) }
  SXN_protect()
  // everything back to the starting kit: guns, ammo, attachments, armour,
  // backpack, grenades, medkits (arsenal resetKit; the world's pickups stay)
  try { if (G.weapon.resetKit) G.weapon.resetKit() } catch (e) { console.error('[net] respawn kit', e) }
  try { G.weapon.setVisible && G.weapon.setVisible(true) } catch (e) { }
  try { G.hud.show(true) } catch (e) { }
  SXN.lastBy = null
  SXN_overlay(null)
}

// --------------------------------------------------- world: host → guests
function SXN_r2(v) { return Math.round(v * 100) / 100 }
function SXN_worldSnapshot() {
  var G = SXN.G, U = G.units, e = [], u = [], s = []
  var E = G.enemies.list || []
  for (var i = 0; i < E.length; i++) {
    var x = E[i]
    if (!x.active && !x.alive) continue
    e.push([x.id, x.type === 'hound' ? 1 : 0, SXN_r2(x.pos.x), SXN_r2(x.pos.y), SXN_r2(x.pos.z), Math.round(x.hp), x.alive ? 1 : 0])
  }
  if (U) U.list.forEach(function (x) {
    if (x.faction !== 'enemy') return
    u.push([x.id, x.type, x.variant || '', SXN_r2(x.pos.x), SXN_r2(x.pos.y), SXN_r2(x.pos.z), Math.round(x.hp), x.alive ? 1 : 0])
  })
  if (U && U.outposts) U.outposts.forEach(function (st, k) { s.push([k, st.status === 'captured' ? 1 : 0, st.active ? 1 : 0, st.left || 0]) })
  return { t: 'w', e: e, u: u, s: s }
}
function SXN_bindRobot(o, key) {
  o.__netKey = key
  o.__net = { buf: [] }
  SXN.map[key] = o
  // pin to the host's position before the robot's own update runs
  var upName = typeof o._update === 'function' ? '_update' : 'update'
  if (!o.__sxnPin && typeof o[upName] === 'function') {
    o.__sxnPin = true
    var up0 = o[upName]
    o[upName] = function () { SXN_pin(o); return up0.apply(this, arguments) }
  }
  if (!o.__sxnDmg && typeof o.damage === 'function') {
    o.__sxnDmg = true
    var d0 = o.damage
    o.damage = function (amount, point, dir, part) {
      if (!SXN.active || SXN.applying || !o.__netKey) return d0.apply(this, arguments)
      if (SXN.role === 'guest' && amount > 0) SXN_emit({ t: 'dmg', k: o.__netKey, a: +(+amount).toFixed(2), p: part || 'body' })
      return d0.apply(this, arguments)
    }
  }
}
function SXN_pin(o) {
  var n = o.__net
  if (!SXN.active || !n || !n.buf.length) return
  if (!SXN_tmp) SXN_tmp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }
  var t = performance.now() / 1000 - SXN_TUNE.interp, s = SXN_tmp
  SXN_sample(n.buf, t, s)
  o.pos.set(s.x, s.y, s.z)
}
function SXN_quietRemove(o) {
  var G = SXN.G, U = G.units
  if (o.__netKey && SXN.map[o.__netKey] === o) delete SXN.map[o.__netKey]
  o.__netKey = null; o.__net = null
  if (U && U.list.indexOf(o) >= 0) { U.remove(o); return }
  try { o.alive = false; o._deactivate && o._deactivate() } catch (e) { }
  var L = G.enemies.list, k = L.indexOf(o)
  if (k >= 0) L.splice(k, 1)
}
function SXN_killLocal(o) {
  SXN.applying = true
  try { o.damage(1e6, o.pos.clone(), new lt.Vector3(0, -1, 0), 'body', 'net') } catch (e) { }
  SXN.applying = false
}
function SXN_applyWorld(m) {
  var G = SXN.G, U = G.units, V3 = lt.Vector3
  if (!SXN_inGame()) return
  var now = performance.now() / 1000, seen = {}
  var place = function (o, x, y, z) { var b = o.__net.buf; b.push({ t: now, x: x, y: y, z: z, yaw: 0, pitch: 0 }); if (b.length > 6) b.shift() }
  ;(m.e || []).forEach(function (r) {
    var key = 'e' + r[0], o = SXN.map[key]
    seen[key] = 1
    if (o && (o.__netKey !== key || (!o.active && !o.alive))) o = null
    if (!o) {
      if (!r[6]) return
      SXN.allowSpawn = true
      try { o = G.enemies.spawn(r[1] ? 'hound' : 'gull', new V3(r[2], r[3], r[4]), { state: 'alert' }) } catch (e) { o = null }
      SXN.allowSpawn = false
      if (!o) return
      SXN_bindRobot(o, key)
    }
    place(o, r[2], r[3], r[4])
    if (r[5] < o.hp) o.hp = r[5]
    if (!r[6] && o.alive) SXN_killLocal(o)
  })
  ;(m.u || []).forEach(function (r) {
    var key = 'u' + r[0], o = SXN.map[key]
    seen[key] = 1
    if (o && (o.__netKey !== key || U.list.indexOf(o) < 0)) o = null
    if (!o) {
      if (!r[7] || !U) return
      SXN.allowSpawn = true
      try { o = U.spawn(r[1], { pos: new V3(r[3], r[4], r[5]), yaw: 0, variant: r[2] || undefined, state: 'engage', home: new V3(r[3], 0, r[5]) }) } catch (e) { o = null }
      SXN.allowSpawn = false
      if (!o) return
      SXN_bindRobot(o, key)
    }
    place(o, r[3], r[4], r[5])
    if (r[6] < o.hp) o.hp = r[6]
    if (!r[7] && o.alive) SXN_killLocal(o)
  })
  for (var k in SXN.map) if (!seen[k]) SXN_quietRemove(SXN.map[k])
  // outposts
  if (U && U.outposts && U.outpostNet && m.s) m.s.forEach(function (r) {
    var st = U.outposts[r[0]]
    if (!st) return
    if (r[1]) U.outpostNet.capture(st)
    else U.outpostNet.setActive(st, !!r[2], r[3])
  })
  // anything hostile here that the host doesn't have goes
  var cut = now - SXN_TUNE.orphanT
  ;(G.enemies.list || []).slice().forEach(function (o) { if (o.alive && !o.__netKey && (o.__spawnT || 0) < cut) SXN_quietRemove(o) })
  if (U) U.list.slice().forEach(function (o) { if (o.faction === 'enemy' && o.alive && !o.__netKey && (o.__spawnT || 0) < cut) SXN_quietRemove(o) })
}
function SXN_hostDamage(m) {
  var G = SXN.G, U = G.units, o = null, id = +String(m.k).slice(1)
  if (m.k[0] === 'e') o = (G.enemies.list || []).filter(function (x) { return x.id === id })[0]
  else if (U) o = U.list.filter(function (x) { return x.id === id })[0]
  if (!o || !o.alive || !(m.a > 0)) return
  // who hit it last: the kill credit when it dies
  o.__netHitBy = m.from; o.__netHitT = performance.now()
  SXN.applying = true
  try { o.damage(m.a, o.pos.clone(), new lt.Vector3(0, -1, 0), m.p || 'body', 'player') } catch (e) { }
  SXN.applying = false
}

// ------------------------------------------------------------------ loop
var SXN_acc = { p: 0, w: 0 }
function SXN_tick(dt) {
  var G = SXN.G
  SXN_injectTitle()
  if (!SXN.active) return
  // heartbeat: a dropped tab can take WebRTC half a minute to notice
  SXN_acc.hb = (SXN_acc.hb || 0) + dt
  if (SXN_acc.hb >= 2) {
    SXN_acc.hb = 0
    var nowMs = performance.now()
    if (SXN.role === 'host') {
      SXN_broadcast({ t: 'hb' })
      for (var gid in SXN.guests) { var gc = SXN.guests[gid]; if (nowMs - (gc.__seen || nowMs) > 10000) { try { gc.close() } catch (e) { } SXN_dropGuest(gc) } }
    } else {
      SXN_sendTo(SXN.conn, { t: 'hb' })
      if (SXN.hostSeen && nowMs - SXN.hostSeen > 12000) { SXN_hostLeft(); return }
    }
  }
  if (SXN.role === 'host') {
    SXN_acc.b = (SXN_acc.b || 0) + dt
    if (SXN_acc.b >= 1 / SXN_TUNE.batchHz) { SXN_acc.b = 0; SXN_flush() }
  }
  if (SXN_inGame()) {
    // my state, 15×/s
    SXN_acc.p += dt
    // big rooms send a little less often: the host relays every state to everyone
    if (SXN_acc.p >= 1 / (Object.keys(SXN.players).length > 8 ? 10 : SXN_TUNE.rate)) {
      SXN_acc.p = 0
      var P = G.player, U = G.units, m = { t: 'p', x: SXN_r2(P.pos.x), y: SXN_r2(P.pos.y), z: SXN_r2(P.pos.z), yw: +P.yaw.toFixed(3), pt: +P.pitch.toFixed(3), cr: P.crouching ? 1 : 0, hp: Math.round(P.health), al: P.alive ? 1 : 0, w: SXN_weapon(), ad: G.weapon.ads > 0.5 ? 1 : 0, ln: window.SXV && SXV.lean ? +SXV.lean.toFixed(2) : 0, sp: SXN_protected() ? 1 : 0 }
      if (U && U.pilot && U.pilot.alive) { m.v = SXN_vehicleKey(U.pilot); m.vp = SXN_vehPose(U.pilot) }
      SXN_emit(m)
      var me = SXN.players[SXN.myId]; if (me) { me.hp = m.hp; me.dead = !P.alive; if (P.alive) me.inRound = true }
    }
    // the world, 10×/s
    if (SXN.role === 'host') {
      SXN_acc.w += dt
      if (SXN_acc.w >= 1 / SXN_TUNE.worldRate && Object.keys(SXN.guests).length) { SXN_acc.w = 0; SXN_relay(SXN_worldSnapshot()) }
    }
    var pr = SXN_protected() ? Math.ceil((SXN.protectUntil - performance.now()) / 1000) : 0
    if (SXN.ui && SXN.ui.prot && SXN.ui.prot._v !== pr) {
      SXN.ui.prot._v = pr
      SXN.ui.prot.textContent = pr ? 'SPAWN PROTECTION ' + pr + ' · firing ends it' : ''
      SXN.ui.prot.classList.toggle('on', !!pr)
    }
    if (SXN.respawnT > 0) {
      SXN.respawnT -= dt
      SXN_overlay('You are down — back in ' + Math.max(1, Math.ceil(SXN.respawnT)))
      if (SXN.respawnT <= 0) SXN_respawn()
    } else if (!G.player.alive) {
      // out for the round; if the other side is gone (no versus any more), the old respawn
      if (SXN_oneLife()) SXN_overlay(null) // (the spectate bar says it: SXN_specFrame)
      else SXN.respawnT = SXN_TUNE.respawn
    }
    SXN_resultsTick()
    if (SXN.role === 'host') {
      SXN_acc.rc = (SXN_acc.rc || 0) + dt
      if (SXN_acc.rc >= 0.25) { SXN_acc.rc = 0; SXN_roundCheck() }
      if (!SXN.roundLive && SXN.roundNextT > 0) { SXN.roundNextT -= dt; if (SXN.roundNextT <= 0) SXN_roundGo() }
      // the round's time is up (no versus — alone, one team — the clock just starts over)
      if (SXN.roundLive && SXN.score && SXN.roundEndT && performance.now() >= SXN.roundEndT) {
        if (!SXN_versus()) SXN.roundEndT = performance.now() + SXN_roundSecs() * 1000
        else if (SXN_ffa()) SXN_ffaRoundEnd()
        else SXN_teamTimeUp()
      }
    }
  }
  SXN_updateAvatars(dt)
  SXN_acc.r = (SXN_acc.r || 0) + dt
  if (SXN_acc.r >= 0.25) { SXN_acc.r = 0; SXN_updateRoster() }
}

// -------------------------------------------------------------------- UI
function SXN_buildUi() {
  if (SXN.ui) return SXN.ui
  var app = document.getElementById('app') || document.body
  var panel = document.createElement('div')
  panel.className = 'sxn-panel'
  panel.hidden = true
  panel.innerHTML =
    '<div class="sxn-card" role="dialog" aria-label="Multiplayer">' +
    '<header><b>Multiplayer</b><span class="sxn-sub">Teams or free-for-all</span><button class="sxn-x" type="button" aria-label="Close">×</button></header>' +
    '<section class="sxn-setup">' +
    '<label class="sxn-f">Your name<input class="sxn-name" maxlength="14" autocomplete="off" spellcheck="false"></label>' +
    '<div class="sxn-block"><button class="btn primary sxn-create" type="button">Create a room</button><p>Friends join with your room code. Everyone picks Blue or Red in the room.</p></div>' +
    '<p class="sxn-relay"></p>' +
    '<div class="sxn-sep"><span>or join a room</span></div>' +
    '<div class="sxn-block"><label class="sxn-f">Room code<input class="sxn-code" maxlength="5" autocomplete="off" spellcheck="false" placeholder="ABCDE"></label>' +
    '<button class="btn sxn-join" type="button">Join room</button></div>' +
    '</section>' +
    '<section class="sxn-room" hidden>' +
    '<div class="sxn-coderow"><span>Room</span><b class="sxn-codev"></b><button class="btn sxn-copy" type="button">Copy code</button><span class="sxn-count"></span></div>' +
    '<div class="sxn-mapsel"><span>Map</span><select class="sxn-mapv" aria-label="Map"></select><i class="sxn-mapn"></i></div>' +
    '<div class="sxn-mode" role="radiogroup" aria-label="Mode"><button type="button" data-mode="teams" role="radio"><b>Blue vs Red</b><span>Two teams</span></button><button type="button" data-mode="ffa" role="radio"><b>Free-for-all</b><span>Everyone for themselves</span></button></div>' +
    '<div class="sxn-size"><span>Players</span><button type="button" class="sxn-dec" aria-label="Fewer players">−</button><b class="sxn-sizev">8</b><button type="button" class="sxn-inc" aria-label="More players">+</button><i class="sxn-sizen"></i></div>' +
    '<div class="sxn-bots" role="radiogroup" aria-label="Robots"><span>Robots</span><button type="button" data-bots="many" role="radio">Many</button><button type="button" data-bots="few" role="radio">Few</button><button type="button" data-bots="off" role="radio">Off</button></div>' +
    '<div class="sxn-rounds"><span>Rounds to win</span><input class="sxn-roundsv" type="number" inputmode="numeric" min="1" max="15" step="1" aria-label="Rounds to win"><i class="sxn-roundsn"></i></div>' +
    '<div class="sxn-rounds sxn-mins"><span>Minutes per round</span><input class="sxn-minsv" type="number" inputmode="decimal" min="0.5" max="15" step="0.5" aria-label="Minutes per round"><i class="sxn-minsn"></i></div>' +
    '<div class="sxn-ffa"><h4>Free-for-all <span></span></h4><ol></ol></div>' +
    '<div class="sxn-teams">' +
    '<div class="sxn-col blue"><h4>Blue team <span></span></h4><ol></ol><button class="btn sxn-pick" type="button" data-team="blue">Join Blue</button></div>' +
    '<div class="sxn-col red"><h4>Red team <span></span></h4><ol></ol><button class="btn sxn-pick" type="button" data-team="red">Join Red</button></div>' +
    '</div>' +
    '<p class="sxn-note"></p>' +
    '<div class="sxn-block sxn-actions"><button class="btn sxn-leave" type="button">Leave room</button><button class="btn primary sxn-go" type="button">Start</button></div>' +
    '</section>' +
    '<p class="sxn-status" aria-live="polite"></p>' +
    '</div>'
  app.appendChild(panel)
  var q = function (s) { return panel.querySelector(s) }
  var ui = { panel: panel, name: q('.sxn-name'), code: q('.sxn-code'), status: q('.sxn-status'), setup: q('.sxn-setup'), room: q('.sxn-room'), codev: q('.sxn-codev'), count: q('.sxn-count'), note: q('.sxn-note'), go: q('.sxn-go'), team: '' }
  ui.cols = { blue: q('.sxn-col.blue'), red: q('.sxn-col.red') }
  var relay = SXN_turnHosts()
  q('.sxn-relay').textContent = relay.length ? 'TURN relay: ' + relay.join(', ') + ' — players behind VPNs / mobile data can connect' : 'No TURN relay set: players behind a VPN (WARP / 1.1.1.1), mobile data or strict networks may not connect'
  q('.sxn-relay').classList.toggle('off', !relay.length)
  ui.teams = q('.sxn-teams'); ui.ffa = q('.sxn-ffa'); ui.modeBtns = panel.querySelectorAll('.sxn-mode button')
  ui.modeBtns.forEach(function (b) { b.addEventListener('click', function () { SXN_pickMode(b.dataset.mode) }) })
  ui.sub = q('.sxn-sub'); ui.sizeV = q('.sxn-sizev'); ui.sizeN = q('.sxn-sizen'); ui.dec = q('.sxn-dec'); ui.inc = q('.sxn-inc')
  ui.dec.addEventListener('click', function () { SXN_pickRoom(-1) })
  ui.inc.addEventListener('click', function () { SXN_pickRoom(1) })
  ui.mapSel = q('.sxn-mapv'); ui.mapN = q('.sxn-mapn')
  ui.mapSel.innerHTML = SXN_MAPS.map(function (m) { return '<option value="' + m.id + '">' + m.name + ' · up to ' + SXN_mapMaxOf(m.id) + '</option>' }).join('')
  ui.mapSel.addEventListener('change', function () { SXN_pickMap(ui.mapSel.value) })
  ui.rounds = q('.sxn-roundsv'); ui.roundsN = q('.sxn-roundsn')
  ui.rounds.min = SXN_TUNE.rounds.min; ui.rounds.max = SXN_TUNE.rounds.max
  ui.rounds.addEventListener('change', function () { SXN_pickRounds(ui.rounds.value) })
  ui.mins = q('.sxn-minsv'); ui.minsN = q('.sxn-minsn')
  ui.mins.min = SXN_TUNE.rounds.mins.min; ui.mins.max = SXN_TUNE.rounds.mins.max; ui.mins.step = SXN_TUNE.rounds.mins.step
  ui.mins.addEventListener('change', function () { SXN_pickMins(ui.mins.value) })
  ui.botBtns = panel.querySelectorAll('.sxn-bots button')
  ui.botBtns.forEach(function (b) { b.addEventListener('click', function () { SXN_pickBots(b.dataset.bots) }) })
  // typing in the panel must not drive the game (Enter starts on the title)
  panel.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.code === 'Escape') SXN_openPanel(false) })
  panel.addEventListener('keyup', function (e) { e.stopPropagation() })
  try { ui.name.value = localStorage.getItem('doomzone.name') || '' } catch (e) { }
  if (!ui.name.value) ui.name.value = 'Breacher-' + Math.floor(100 + Math.random() * 900)
  ui.name.addEventListener('change', function () { try { localStorage.setItem('doomzone.name', SXN_clean(ui.name.value)) } catch (e) { } })
  q('.sxn-x').addEventListener('click', function () { SXN_openPanel(false) })
  panel.addEventListener('click', function (e) { if (e.target === panel) SXN_openPanel(false) })
  panel.querySelectorAll('.sxn-pick').forEach(function (b) {
    b.addEventListener('click', function () { SXN_pickTeam(b.dataset.team) })
  })
  q('.sxn-create').addEventListener('click', function () {
    SXN_status('Opening a room…')
    SXN_host(ui.name.value, function (err, code) { SXN_status(err ? err : 'Room ' + code + ' is open — share the code'); SXN_refreshUi() })
  })
  q('.sxn-join').addEventListener('click', function () {
    SXN_status('Joining ' + ui.code.value.toUpperCase() + '…')
    SXN_join(ui.code.value, ui.name.value, ui.team, function (err, code) { SXN_status(err ? err : 'Joined room ' + code); SXN_refreshUi() })
  })
  q('.sxn-copy').addEventListener('click', function () {
    try { navigator.clipboard.writeText(SXN.code); SXN_status('Code copied') } catch (e) { SXN_status('Code: ' + SXN.code) }
  })
  q('.sxn-leave').addEventListener('click', function () { SXN_leave(); SXN_status('You left the room') })
  // host: Start (once every guest is ready); guest: Ready / Not ready
  ui.go.addEventListener('click', function () {
    if (SXN.role === 'host') {
      var wait = SXN_notReady()
      if (wait.length && !SXN.started) { SXN_status('Waiting for ' + wait.join(', ') + ' to get ready'); return }
      SXN_go()
    } else SXN_setReady(!SXN_meReady())
  })
  // only the host starts the match: a guest's title Start / Enter is held back
  var hold = function (ev) {
    if (!SXN.active || SXN.role !== 'guest' || SXN.allowGo) return false
    ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
    SXN_openPanel(true)
    SXN_status(SXN.started ? 'The match is on — press Ready to join' : 'Only the host starts the match — press Ready')
    return true
  }
  var holdHost = function (ev) {
    if (!SXN.active || SXN.role !== 'host' || SXN.allowGo || SXN.started) return false
    var wait = SXN_notReady()
    if (!wait.length) return false
    ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation()
    SXN_openPanel(true)
    SXN_status('Waiting for ' + wait.join(', ') + ' to get ready')
    return true
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest('#ui [data-act="deploy"]')
    if (t) hold(ev) || holdHost(ev)
  }, true)
  document.addEventListener('keydown', function (ev) {
    if ((ev.code !== 'Enter' && ev.code !== 'NumpadEnter') || !SXN.G || !SXN.G.game || SXN.G.game.state !== 'title') return
    if (ev.target && (ev.target.tagName === 'BUTTON' || ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT')) return
    hold(ev) || holdHost(ev)
  }, true)
  // in game: roster, name tags, banners, respawn overlay
  var hudRoot = app
  ui.tags = document.createElement('div'); ui.tags.className = 'sxn-tags'; hudRoot.appendChild(ui.tags)
  ui.roster = document.createElement('div'); ui.roster.className = 'sxn-roster'; hudRoot.appendChild(ui.roster)
  ui.banner = document.createElement('div'); ui.banner.className = 'sxn-banner'; hudRoot.appendChild(ui.banner)
  ui.over = document.createElement('div'); ui.over.className = 'sxn-over'; hudRoot.appendChild(ui.over)
  ui.prot = document.createElement('div'); ui.prot.className = 'sxn-prot'; hudRoot.appendChild(ui.prot)
  ui.spec = document.createElement('div'); ui.spec.className = 'sxn-spec'; hudRoot.appendChild(ui.spec)
  SXN.ui = ui
  return ui
}
// lobby: switch sides (the host decides for guests; not while in the mission)
function SXN_pickTeam(t) {
  if (!SXN.active || (t !== 'blue' && t !== 'red') || SXN.team === t || SXN_inGame()) return
  if (SXN_teamFull(t)) { SXN_status(SXN_teamName(t) + ' is full (' + SXN_teamMax() + '/' + SXN_teamMax() + ')'); return }
  if (SXN.role === 'host') {
    SXN_addPlayer({ id: SXN.myId, name: SXN.name, team: t })
    SXN_broadcast(SXN_rosterMsg())
    SXN_updateMode()
    SXN_refreshUi()
  } else SXN_emit({ t: 'team', team: t })
  SXN_status('Switching to ' + SXN_teamName(t) + '…')
  setTimeout(function () { if (SXN.team === t) SXN_status('You are on ' + SXN_teamName(t)) }, 600)
}
function SXN_injectTitle() {
  var ui = SXN.ui
  if (!ui) return
  var actions = document.querySelector('#ui .menu .m-title .m-actions')
  if (!actions || actions.querySelector('.sxn-open')) return
  var b = document.createElement('button')
  b.className = 'btn sxn-open'
  b.type = 'button'
  b.innerHTML = '<span class="sxn-open-k">Multiplayer</span><span class="sxn-open-v">Up to ' + SXN_mapMax() + '</span>'
  b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); SXN_openPanel(true) })
  actions.appendChild(b)
  ui.openBtn = b
  SXN_refreshUi()
}
function SXN_openPanel(on) {
  var ui = SXN_buildUi()
  ui.panel.hidden = !on
  if (on) { SXN_refreshUi(); setTimeout(function () { try { (SXN.active ? ui.go : ui.name).focus() } catch (e) { } }, 30) }
}
function SXN_status(t) { if (SXN.ui) SXN.ui.status.textContent = t || '' }
function SXN_refreshUi() {
  var ui = SXN.ui
  if (!ui) return
  ui.setup.hidden = SXN.active
  ui.room.hidden = !SXN.active
  if (ui.openBtn) {
    var v = ui.openBtn.querySelector('.sxn-open-v')
    v.textContent = SXN.active ? 'Room ' + SXN.code + ' · ' + Object.keys(SXN.players).length + '/' + SXN_roomMax() : 'Up to ' + SXN_mapMax()
    ui.openBtn.classList.toggle('live', SXN.active)
  }
  if (!SXN.active) return
  ui.codev.textContent = SXN.code
  var nP = Object.keys(SXN.players).length, rm = SXN_roomMax()
  ui.count.textContent = nP + ' / ' + rm
  ui.sub.textContent = 'Up to ' + rm + ' players · teams of ' + SXN_teamMax() + ' or free-for-all'
  ui.sizeV.textContent = rm
  ui.sizeN.textContent = SXN_teamMax() + ' per team · map max ' + SXN_mapMax()
  var hostLobby = SXN.role === 'host' && !SXN_inGame()
  ui.dec.disabled = !hostLobby || rm <= Math.max(2, nP)
  ui.inc.disabled = !hostLobby || rm >= SXN_mapMax()
  ui.dec.hidden = ui.inc.hidden = SXN.role !== 'host'
  var inGame = SXN_inGame(), ffa = SXN_ffa()
  // map: the host picks it in the lobby (everyone reloads into it, same room)
  var cur = SXN_mapName()
  if (ui.mapSel.value !== cur) ui.mapSel.value = cur
  ui.mapSel.disabled = SXN.role !== 'host' || inGame || SXN.switching
  Array.prototype.forEach.call(ui.mapSel.options, function (o) { o.disabled = o.value !== cur && SXN_mapMaxOf(o.value) < nP })
  ui.mapN.textContent = SXN.role === 'host' ? (inGame ? 'leave the mission to change it' : '') : 'the host picks the map'
  var li = function (id) {
    var p = SXN.players[id]
    return '<li' + (id === SXN.myId ? ' class="me"' : '') + '><b>' + p.name + '</b><span>' + SXN_tagOf(id) + '</span></li>'
  }
  ui.modeBtns.forEach(function (b) {
    var on = b.dataset.mode === SXN.mode
    b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on))
    b.disabled = SXN.role !== 'host' || inGame
  })
  ui.botBtns.forEach(function (b) {
    var on = b.dataset.bots === SXN.bots
    b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on))
    b.disabled = SXN.role !== 'host' || inGame
  })
  if (document.activeElement !== ui.rounds) ui.rounds.value = SXN.winRounds
  ui.rounds.disabled = SXN.role !== 'host' || inGame
  ui.roundsN.textContent = 'win by ' + SXN_TUNE.rounds.by + ' · a round = ' + (ffa ? 'most kills when the time is up' : 'a team wiped out')
  if (document.activeElement !== ui.mins) ui.mins.value = SXN.roundMins
  ui.mins.disabled = SXN.role !== 'host' || inGame
  ui.minsN.textContent = ffa ? 'the round lasts this long' : 'time up: more players standing wins (equal = draw)'
  ui.teams.hidden = ffa
  ui.ffa.hidden = !ffa
  if (ffa) {
    var all = Object.keys(SXN.players)
    ui.ffa.querySelector('h4 span').textContent = all.length + ' / ' + SXN_roomMax()
    ui.ffa.querySelector('ol').innerHTML = all.map(li).join('')
  }
  ;['blue', 'red'].forEach(function (t) {
    var col = ui.cols[t], ids = Object.keys(SXN.players).filter(function (id) { return SXN.players[id].team === t })
    col.querySelector('h4 span').textContent = ids.length + ' / ' + SXN_teamMax()
    col.querySelector('ol').innerHTML = ids.map(li).join('') || '<li class="empty"><span>empty</span></li>'
    var b = col.querySelector('.sxn-pick')
    var full = ids.length >= SXN_teamMax()
    b.disabled = SXN.team === t || inGame || full
    b.textContent = SXN.team === t ? 'Your team' : full ? SXN_teamName(t) + ' is full' : 'Join ' + SXN_teamName(t)
  })
  ui.go.hidden = inGame
  var wait = SXN_notReady(), mine = SXN_meReady()
  if (SXN.role === 'host') {
    ui.go.textContent = SXN.started || !wait.length ? 'Start' : 'Start · ' + (Object.keys(SXN.players).length - 1 - wait.length) + '/' + (Object.keys(SXN.players).length - 1) + ' ready'
    ui.go.classList.toggle('sxn-wait', !SXN.started && wait.length > 0)
    ui.go.classList.add('primary')
  } else {
    ui.go.textContent = SXN.started ? 'Ready · join the match' : mine ? 'Ready ✓ (tap to cancel)' : 'Ready'
    ui.go.classList.toggle('primary', !mine || SXN.started)
    ui.go.classList.remove('sxn-wait')
  }
  var vs = SXN_versus()
  ui.note.textContent = (ffa
    ? 'Free-for-all: every player is everyone else\'s enemy, and the robots fight everybody. Rounds of ' + SXN_ffaMins().replace('-', ' ') + 's with respawns: the most player kills in the round takes it (a tie is a draw). First to ' + SXN.winRounds + ' rounds with a ' + SXN_TUNE.rounds.by + '-round lead wins the match.'
    : (inGame ? 'Leave the mission (pause → quit) to switch teams. ' : 'Pick a team, then get ready. ') +
      (vs ? 'Blue vs Red: the robots fight both teams, and the teams fight each other. One life per round: wipe out the other team to take it, or have more players standing when the ' + SXN_ffaMins() + ' clock runs out. First to ' + SXN.winRounds + ' rounds with a ' + SXN_TUNE.rounds.by + '-round lead wins the match (' + Math.max(SXN.winRounds, 1) + ':' + Math.max(0, SXN.winRounds - 1) + ' plays on).'
        : 'Everyone on one team = co-op: fight the machines together.')) +
    (SXN.role === 'host' && !inGame ? ' Only the host picks the map, the mode and the robots.' : '') +
    (SXN.role === 'host'
      ? (SXN.started ? ' The match is on — friends who press Ready join it.' : wait.length ? ' Start unlocks when everyone is ready (' + wait.join(', ') + ' not yet).' : ' Everyone is ready — press Start.')
      : SXN.started ? ' The host started the match — press Ready to join.' : mine ? ' You are ready — the match begins when the host presses Start.' : ' Press Ready; the host starts the match.')
}
// ------------------------------------------------------- ready / start / map
var SXN_MAPS = [{ id: 'port', name: 'DoomZone Port' }, { id: 'desert', name: 'Dust Basin' }, { id: 'crossroads', name: 'Crossroads' }, { id: 'waterworks', name: 'Waterworks' }]
function SXN_mapMaxOf(id) { return Math.max(2, Math.min(SXN_TUNE.max, (typeof SX_MAP_MAX !== 'undefined' && SX_MAP_MAX[id]) || SXN_TUNE.max)) }
function SXN_meReady() { var p = SXN.players[SXN.myId]; return !!(p && p.ready) }
// guests (by name) that are not ready yet
function SXN_notReady() {
  var out = []
  for (var id in SXN.players) if (id !== 'h' && !SXN.players[id].ready) out.push(SXN.players[id].name)
  return out
}
function SXN_tagOf(id) {
  var p = SXN.players[id], t = []
  if (id === 'h') t.push('host')
  else if (!SXN.started) t.push(p.ready ? '<em class="sxn-rdy">ready</em>' : '<em class="sxn-nrdy">not ready</em>')
  if (id === SXN.myId) t.push('you')
  return t.join(' · ')
}
function SXN_setReady(on) {
  if (!SXN.active || SXN.role !== 'guest') return
  var me = SXN.players[SXN.myId]
  if (me) me.ready = !!on
  SXN_emit({ t: 'ready', on: !!on })
  SXN_refreshUi()
  if (on && SXN.started && !SXN_inGame()) { SXN_go(); return }
  SXN_status(on ? 'Ready — waiting for the host to start' : 'Not ready')
}
// into the match (the title's Start, let through for the host / a ready guest)
function SXN_go() {
  SXN_openPanel(false)
  SXN_status('')
  SXN.allowGo = true
  try {
    var dep = document.querySelector('#ui [data-act="deploy"]')
    if (dep && SXN.G.game.state === 'title') dep.click()
    else if (SXN.G.game.state === 'title') SXN.G.game.start({})
  } catch (e) { console.error('[net] start', e) }
  SXN.allowGo = false
}
// host: switch the room to another map — everyone reloads into it and the
// room reopens under the same code (guests rejoin on their own)
function SXN_pickMap(id) {
  var ui = SXN.ui
  if (!SXN.active || SXN.role !== 'host' || SXN_inGame() || SXN.switching || id === SXN_mapName() || !SXN_MAPS.some(function (m) { return m.id === id })) { SXN_refreshUi(); return }
  var n = Object.keys(SXN.players).length
  if (SXN_mapMaxOf(id) < n) { SXN_status('That map takes at most ' + SXN_mapMaxOf(id) + ' players'); SXN_refreshUi(); return }
  SXN.switching = true
  var seed = String(SXN.G.params.seed || 4207)
  SXN_broadcast({ t: 'map', map: id, seed: seed })
  SXN_status('Switching the room to ' + SXN_MAPS.filter(function (m) { return m.id === id })[0].name + '…')
  ui && (ui.mapSel.disabled = true)
  setTimeout(function () {
    var u = new URL(location.href)
    ;['join', 'team', 'host', 'mode', 'bots', 'room'].forEach(function (k) { u.searchParams.delete(k) })
    u.searchParams.set('map', id); u.searchParams.set('seed', seed)
    u.searchParams.set('host', SXN.code); u.searchParams.set('name', SXN.name); u.searchParams.set('team', SXN.team)
    u.searchParams.set('mode', SXN.mode); u.searchParams.set('bots', SXN.bots); u.searchParams.set('room', String(SXN_roomMax() >= SXN_mapMax() ? SXN_mapMaxOf(id) : Math.min(SXN_roomMax(), SXN_mapMaxOf(id)))) // a full-size room stays full-size
    try { localStorage.setItem('doomzone.map', id) } catch (e) { }
    try { SXN.peer && SXN.peer.destroy() } catch (e) { }
    location.href = u.toString()
  }, 500)
}
// guest: the host switched maps — reload into it and rejoin the same room
function SXN_followMap(m) {
  if (!SXN_MAPS.some(function (x) { return x.id === m.map }) || !SXN_str(String(m.seed || ''), 12, /^[0-9A-Za-z_-]*$/)) return
  SXN.switching = true
  SXN_status('The host switched the map — reloading…')
  var u = new URL(location.href)
  ;['host', 'mode', 'bots', 'room'].forEach(function (k) { u.searchParams.delete(k) })
  u.searchParams.set('map', m.map); if (m.seed) u.searchParams.set('seed', m.seed)
  u.searchParams.set('join', SXN.code); u.searchParams.set('team', SXN.team); u.searchParams.set('name', SXN.name)
  try { localStorage.setItem('doomzone.map', m.map) } catch (e) { }
  try { SXN.peer && SXN.peer.destroy() } catch (e) { }
  setTimeout(function () { location.href = u.toString() }, 150)
}
// the title's map picker (desert.js) asks first: in a room only the host may
// switch, and the whole room goes along. true = handled here.
function SXN_roomMap(id) {
  if (!SXN.active) return false
  if (SXN.role !== 'host') { SXN_openPanel(true); SXN_status('Only the host can change the map'); return true }
  SXN_openPanel(true)
  SXN_pickMap(id)
  return true
}
function SXN_updateRoster() {
  var ui = SXN.ui
  if (!ui) return
  var on = SXN.active && SXN_inGame()
  if (ui.roster._on !== on) { ui.roster._on = on; ui.roster.classList.toggle('on', on) }
  if (!on) return
  var html = '<div class="sxn-rh">Room ' + SXN.code + '</div>' + Object.keys(SXN.players).map(function (id) {
    var p = SXN.players[id], friend = SXN_ally(p)
    var hp = id === SXN.myId ? Math.round(SXN.G.player.health) : p.hp
    return '<div class="sxn-rr ' + (friend ? 'friend' : 'foe') + (p.dead ? ' dead' : '') + '"><b>' + p.name + (id === SXN.myId ? ' (you)' : '') + '</b><span>' + (p.kills | 0) + '/' + (p.deaths | 0) + '</span>' + (friend ? '<i><u style="width:' + Math.max(0, Math.min(100, hp | 0)) + '%"></u></i>' : '') + '</div>'
  }).join('')
  if (ui.roster._h !== html) { ui.roster._h = html; ui.roster.innerHTML = html }
}
function SXN_feed(html) { try { SXN.G.hud.feed(html) } catch (e) { } }
var SXN_bannerT = null
function SXN_banner(text, secs) {
  var ui = SXN.ui
  if (!ui) return
  ui.banner.textContent = text
  ui.banner.classList.add('on')
  clearTimeout(SXN_bannerT)
  SXN_bannerT = setTimeout(function () { ui.banner.classList.remove('on') }, (secs || 4) * 1000)
}
function SXN_overlay(text) {
  var ui = SXN.ui
  if (!ui) return
  ui.over.textContent = text || ''
  ui.over.classList.toggle('on', !!text)
}

// --------------------------------------------------------------- profiler
// ?netprof=1: time the room's own work per second (ms) and count messages,
// read with window.__sxnProf.report() (tests / tuning only)
function SXN_profile(G) {
  var P = { t: {}, n: {}, since: performance.now(), frames: 0, msgIn: 0, msgOut: 0, bytesOut: 0 }
  var wrap = function (name, f) {
    return function () {
      var t0 = performance.now()
      try { return f.apply(this, arguments) } finally { P.t[name] = (P.t[name] || 0) + performance.now() - t0; P.n[name] = (P.n[name] || 0) + 1 }
    }
  }
  SXN_tick = wrap('tick', SXN_tick)
  SXN_handle = wrap('handle', SXN_handle)
  SXN_remoteShot = wrap('remoteShot', SXN_remoteShot)
  SXN_updateAvatars = wrap('avatars', SXN_updateAvatars)
  SXN_worldSnapshot = wrap('worldSnap', SXN_worldSnapshot)
  SXN_applyWorld = wrap('applyWorld', SXN_applyWorld)
  SXN_playerState = wrap('playerState', SXN_playerState)
  var send0 = SXN_sendTo
  SXN_sendTo = function (conn, m) { P.msgOut++; try { P.bytesOut += JSON.stringify(m).length } catch (e) { } return send0(conn, m) }
  var h0 = SXN_handle
  SXN_handle = function (m) { P.msgIn++; return h0.apply(this, arguments) }
  // whole-frame cost of the game's own systems
  ;['player', 'weapon', 'enemies', 'units'].forEach(function (k) { var o = G[k]; if (o && typeof o.update === 'function') o.update = wrap('g.' + k, o.update.bind(o)) })
  if (G.render && typeof G.render.frame === 'function') G.render.frame = wrap('g.render', G.render.frame.bind(G.render))
  var fr = function () { P.frames++; requestAnimationFrame(fr) }
  requestAnimationFrame(fr)
  window.__sxnProf = {
    raw: P,
    reset: function () { P.t = {}; P.n = {}; P.since = performance.now(); P.frames = 0; P.msgIn = 0; P.msgOut = 0; P.bytesOut = 0 },
    report: function () {
      var s = (performance.now() - P.since) / 1000, o = { fps: +(P.frames / s).toFixed(1), msgIn: Math.round(P.msgIn / s), msgOut: Math.round(P.msgOut / s), kbOut: +(P.bytesOut / s / 1024).toFixed(1) }
      Object.keys(P.t).sort(function (a, b) { return P.t[b] - P.t[a] }).forEach(function (k) { o[k] = (P.t[k] / s).toFixed(1) + 'ms/s ×' + Math.round(P.n[k] / s) })
      return o
    },
  }
}

// ------------------------------------------------------------------- boot
;(function SXN_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || !G.events || !G.enemies) { setTimeout(wait, 250); return }
    SXN.G = G
    window.__sxn = SXN // debug / tests
    window.__sxnApi = { versus: SXN_versus, hitPlayer: SXN_hitPlayer, pick: SXN_pickTeam, objective: SXN_objectiveText, updateMode: SXN_updateMode, tune: SXN_TUNE }
    if (/[?&]netprof=1/.test(location.search)) SXN_profile(G)
    SXN_buildUi()
    var last = performance.now()
    var loop = function () {
      var now = performance.now(), dt = Math.min(0.1, (now - last) / 1000)
      last = now
      try { SXN_tick(dt) } catch (e) { if (!SXN._err) { SXN._err = 1; console.error('[net] tick', e) } }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    addEventListener('beforeunload', function () { try { SXN.peer && SXN.peer.destroy() } catch (e) { } })
    // ?join=CODE&team=blue|red&name=… (also used after a map switch)
    var q = new URLSearchParams(location.search)
    if (q.get('join')) {
      var ui = SXN.ui
      if (q.get('name')) ui.name.value = SXN_clean(q.get('name'))
      ui.code.value = q.get('join')
      ui.team = q.get('team') === 'red' || q.get('team') === 'blue' ? q.get('team') : ''
      SXN_openPanel(true)
      SXN_status('Joining ' + q.get('join').toUpperCase() + '…')
      // after a map switch the host may still be reopening the room: retry a while
      var tryJoin = function (left) {
        SXN_join(q.get('join'), ui.name.value, ui.team, function (err, code) {
          if (err && left > 0 && /not found|No answer|closed|failed/i.test(err)) { SXN_status('Waiting for room ' + q.get('join').toUpperCase() + '…'); setTimeout(function () { tryJoin(left - 1) }, 1500); return }
          SXN_status(err ? err : 'Joined room ' + code); SXN_refreshUi()
        })
      }
      tryJoin(12)
    } else if (q.get('host') && /^[A-Z0-9]{5}$/.test(q.get('host'))) {
      // ?host=CODE&mode=…&bots=…&room=…: the host switched maps — reopen the same room
      var ui2 = SXN.ui
      if (q.get('name')) ui2.name.value = SXN_clean(q.get('name'))
      SXN_openPanel(true)
      SXN_status('Reopening room ' + q.get('host') + '…')
      SXN_host(ui2.name.value, function (err, code) {
        if (!err) {
          if (q.get('mode') === 'ffa' || q.get('mode') === 'teams') SXN_setMode(q.get('mode'))
          if (SXN_TUNE.bots[q.get('bots')] != null) SXN.bots = q.get('bots')
          var rm = +q.get('room'); if (rm >= 2) SXN.roomMax = Math.min(rm, SXN_mapMax())
          var tm = q.get('team'); if (tm === 'red' || tm === 'blue') SXN_addPlayer({ id: 'h', name: SXN.name, team: tm })
          SXN_broadcast(SXN_rosterMsg())
        }
        SXN_status(err ? err : code === q.get('host') ? 'Room ' + code + ' is open on the new map — friends are rejoining' : 'Room ' + code + ' is open (new code) — share it again')
        SXN_refreshUi()
      }, q.get('host'))
    }
  }
  setTimeout(wait, 300)
})()
