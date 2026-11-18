// ============================================================================
// DoomZone mod — KEYS: rebind the keyboard (Settings → Controls → Key bindings).
// Every keyboard action of the game except the map goes through one table,
// h_ in game/js/10_game.js (KeyboardEvent.code → action, read through
// G.input.down / pressed by the player, arsenal, lean, vehicles…; arsenal adds
// Digit5). Rebinding rewrites that table in place from a snapshot of the stock
// one, so no event is re-sent for those. The map is read raw (e.code 'KeyM')
// by minimap/minimap.js: a capture listener here turns the bound map key into
// a synthetic KeyM, and keeps a real M away from the minimap once the map has
// moved (an action now bound to M still gets it, through an alias code).
// Saved in doomzone.keys.v1 as { action: code } (only the changed ones).
// Esc (pause) and the mouse buttons stay fixed.
// ============================================================================

// [action, label, stock key, stock extras (kept only while the action is not rebound)]
var SXKB_ACTIONS = [
  ['forward', 'Move forward', 'KeyW'],
  ['back', 'Move back', 'KeyS'],
  ['left', 'Move left', 'KeyA'],
  ['right', 'Move right', 'KeyD'],
  ['jump', 'Jump', 'Space'],
  ['sprint', 'Sprint', 'ShiftLeft', ['ShiftRight']],
  ['crouch', 'Crouch', 'KeyC', ['ControlLeft', 'ControlRight']],
  ['reload', 'Reload', 'KeyR'],
  ['interact', 'Use · cut relay · board', 'KeyF'],
  ['melee', 'Knife slash', 'KeyV'],
  ['w1', 'Weapon slot 1', 'Digit1', ['Numpad1']],
  ['w2', 'Weapon slot 2', 'Digit2', ['Numpad2']],
  ['w3', 'Weapon slot 3', 'Digit3', ['Numpad3']],
  ['w4', 'Weapon slot 4', 'Digit4', ['Numpad4']],
  ['w5', 'Knife (slot 5)', 'Digit5', ['Numpad5']],
  ['wlast', 'Last weapon', 'KeyX'],
  ['grenade', 'Grenade · detonate C4', 'KeyG'],
  ['nadeType', 'Grenade type', 'KeyT'],
  ['heal', 'Medkit (best fit)', 'KeyH'],
  ['heal_s', 'Small medkit', 'Digit7', ['Numpad7']],
  ['heal_m', 'Medkit', 'Digit8', ['Numpad8']],
  ['heal_l', 'Large medkit', 'Digit9', ['Numpad9']],
  ['scope', 'Switch scope', 'KeyB'],
  ['leanL', 'Lean left', 'KeyQ'],
  ['leanR', 'Lean right', 'KeyE'],
  ['bag', 'Backpack', 'Tab'],
  ['map', 'Map', 'KeyM'], // not in h_: minimap.js reads KeyM itself
]
var SXKB_FIXED = [['Look', 'Mouse'], ['Fire', 'Left button'], ['Aim', 'Right button'], ['Weapon wheel', 'Mouse wheel'], ['Pause', 'Esc']]
var SXKB_NOBIND = { Escape: 1, MetaLeft: 1, MetaRight: 1, ContextMenu: 1, F5: 1, F11: 1, F12: 1 }
var SXKB_KEY = 'doomzone.keys.v1'
var SXKB_ALIAS = 'SXKB_KeyM' // a real M, sent on to the action now bound to it
var SXKB = { bind: {}, stock: null, listen: null, ui: null }

function SXKB_def(id) { for (var i = 0; i < SXKB_ACTIONS.length; i++) if (SXKB_ACTIONS[i][0] === id) return SXKB_ACTIONS[i]; return null }
function SXKB_load() {
  var b = {}
  SXKB_ACTIONS.forEach(function (a) { b[a[0]] = a[2] })
  try {
    var s = JSON.parse(localStorage.getItem(SXKB_KEY) || 'null')
    if (s && typeof s === 'object') {
      var used = {}
      for (var id in s) if (b[id] && typeof s[id] === 'string' && s[id] && !SXKB_NOBIND[s[id]]) b[id] = s[id]
      // a stored set that maps one key twice (hand-edited): drop it
      for (var k in b) { if (used[b[k]]) return SXKB_load.stock(); used[b[k]] = 1 }
    }
  } catch (e) { }
  return b
}
SXKB_load.stock = function () { var b = {}; SXKB_ACTIONS.forEach(function (a) { b[a[0]] = a[2] }); return b }
function SXKB_save() {
  var out = {}
  SXKB_ACTIONS.forEach(function (a) { if (SXKB.bind[a[0]] !== a[2]) out[a[0]] = SXKB.bind[a[0]] })
  try { localStorage.setItem(SXKB_KEY, JSON.stringify(out)) } catch (e) { }
}
SXKB.bind = SXKB_load()

// a readable name for a KeyboardEvent.code
function SXKB_name(code) {
  if (!code) return '—'
  var m
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1]
  if ((m = /^Digit(\d)$/.exec(code))) return m[1]
  if ((m = /^Numpad(\d)$/.exec(code))) return 'Num ' + m[1]
  if ((m = /^F(\d+)$/.exec(code))) return code
  var N = {
    Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', ControlRight: 'R Ctrl', AltLeft: 'Alt', AltRight: 'R Alt',
    Tab: 'Tab', Enter: 'Enter', NumpadEnter: 'Num Enter', Backspace: 'Backspace', CapsLock: 'Caps', ArrowUp: '↑', ArrowDown: '↓',
    ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End',
    PageUp: 'PgUp', PageDown: 'PgDn', NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadDecimal: 'Num .',
    IntlBackslash: '\\', IntlRo: 'Ro', IntlYen: '¥',
  }
  return N[code] || code
}
// the key shown for an action (the HUD's "Hold F" prompt reads this)
function SXKB_label(id) { return SXKB_name(SXKB.bind[id]) }

// h_ = the stock table, then each moved action leaves its stock key (and its
// extras), then every bound key points at its action; the map's key is taken
// out of h_ (a turn key on it would fire too)
function SXKB_apply() {
  if (typeof h_ === 'undefined' || !h_) return
  if (!SXKB.stock) SXKB.stock = Object.assign({}, h_)
  var base = Object.assign({}, SXKB.stock), B = SXKB.bind
  SXKB_ACTIONS.forEach(function (a) {
    if (B[a[0]] === a[2]) return
    if (base[a[2]] === a[0]) delete base[a[2]]
    ;(a[3] || []).forEach(function (c) { if (base[c] === a[0]) delete base[c] })
  })
  SXKB_ACTIONS.forEach(function (a) {
    var c = B[a[0]]
    if (a[0] === 'map') delete base[c]
    else base[c] = a[0]
  })
  if (B.map !== 'KeyM' && base.KeyM) base[SXKB_ALIAS] = base.KeyM
  for (var k in h_) delete h_[k]
  Object.assign(h_, base)
  SXKB_hints()
}
// bind action `id` to `code`; the action holding it gets id's old key
function SXKB_set(id, code) {
  var B = SXKB.bind, old = B[id]
  if (!old || old === code) return
  for (var k in B) if (k !== id && B[k] === code) B[k] = old
  B[id] = code
  SXKB_save(); SXKB_apply(); SXKB_fill()
}
function SXKB_reset() {
  SXKB.bind = SXKB_load.stock()
  SXKB_save(); SXKB_apply(); SXKB_fill()
}

// ---------------------------------------------------------------- key events
function SXKB_typing(t) { var g = t && t.tagName; return g === 'INPUT' || g === 'TEXTAREA' || g === 'SELECT' || !!(t && t.isContentEditable) }
function SXKB_send(e, code, key) {
  var ev = new KeyboardEvent(e.type, { code: code, key: key, bubbles: true, cancelable: true, repeat: e.repeat, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey })
  ev.__sxkb = true
  ;(e.target && e.target.dispatchEvent ? e.target : window).dispatchEvent(ev)
  if (ev.defaultPrevented) e.preventDefault()
}
function SXKB_onKey(e) {
  if (e.__sxkb) return
  // the bindings list is waiting for a key: it takes this one, nothing else sees it
  if (SXKB.listen) {
    e.preventDefault(); e.stopImmediatePropagation()
    if (e.type !== 'keydown' || e.repeat) return
    var id = SXKB.listen
    SXKB.listen = null
    if (e.code !== 'Escape' && e.code && !SXKB_NOBIND[e.code]) SXKB_set(id, e.code)
    else SXKB_fill()
    return
  }
  var mk = SXKB.bind.map
  if (mk === 'KeyM' || SXKB_typing(e.target)) return
  if (e.code === mk) {
    // the bound map key: minimap.js listens for KeyM
    e.stopImmediatePropagation()
    SXKB_send(e, 'KeyM', 'm')
  } else if (e.code === 'KeyM') {
    // M without the map: hidden from minimap.js, sent on to its new action
    e.stopImmediatePropagation()
    if (typeof h_ !== 'undefined' && h_[SXKB_ALIAS]) SXKB_send(e, SXKB_ALIAS, e.key)
  }
}
// registered while the bundle loads: ahead of every other window capture listener
addEventListener('keydown', SXKB_onKey, true)
addEventListener('keyup', SXKB_onKey, true)

// ---------------------------------------------------------------- the list
function SXKB_build() {
  var pane = document.querySelector('#ui .menu .panel-b[data-pane="controls"]')
  if (!pane) return null
  if (SXKB.ui && SXKB.ui.root.isConnected) return SXKB.ui
  var h3 = pane.querySelector('h3'), stockList = h3 && h3.nextElementSibling
  // the stock keyboard list: replaced by this one (the touch / gamepad lists stay)
  if (stockList && stockList.matches('dl.keys')) stockList.hidden = true
  var root = document.createElement('div')
  root.className = 'sxkb'
  root.innerHTML = '<div class="sxkb-top"><span>Click a key to change it · Esc cancels</span><button class="btn small" data-sxkb-reset>Reset to defaults</button></div><div class="sxkb-list"></div>'
  pane.insertBefore(root, stockList || (h3 ? h3.nextSibling : pane.firstChild))
  root.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button')
    if (!b) return
    if (b.hasAttribute('data-sxkb-reset')) { SXKB.listen = null; SXKB_reset(); return }
    var id = b.dataset.sxkb
    if (!id) return
    SXKB.listen = SXKB.listen === id ? null : id
    SXKB_fill()
  })
  // clicking anywhere else stops listening
  document.addEventListener('mousedown', function (e) {
    if (!SXKB.listen || (e.target.closest && e.target.closest('[data-sxkb]'))) return
    SXKB.listen = null
    SXKB_fill()
  }, true)
  SXKB.ui = { root: root, list: root.querySelector('.sxkb-list') }
  return SXKB.ui
}
function SXKB_fill() {
  var ui = SXKB_build()
  if (!ui) return
  var B = SXKB.bind, rows = []
  SXKB_ACTIONS.forEach(function (a) {
    var id = a[0], code = B[id], listening = SXKB.listen === id, extra = ''
    if (code === a[2] && a[3]) {
      var kept = a[3].filter(function (c) { return typeof h_ === 'undefined' || h_[c] === id })
      if (kept.length && id !== 'w1' && id !== 'w2' && id !== 'w3' && id !== 'w4' && id !== 'w5' && id.indexOf('heal_') !== 0)
        extra = '<small>also ' + SXKB_esc(kept.map(SXKB_name).filter(function (n, i, l) { return l.indexOf(n) === i }).join(', ')) + '</small>'
    }
    var nm = SXKB_esc(SXKB_name(code))
    rows.push('<div class="sxkb-row"><span>' + a[1] + extra + '</span><button class="sxkb-key' + (listening ? ' listen' : code !== a[2] ? ' moved' : '') +
      '" data-sxkb="' + id + '" aria-label="' + a[1] + ': ' + nm + '">' + (listening ? 'Press a key…' : nm) + '</button></div>')
  })
  SXKB_FIXED.forEach(function (f) { rows.push('<div class="sxkb-row sxkb-fixed"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>') })
  ui.list.innerHTML = rows.join('')
}
// key names come from KeyboardEvent.code / localStorage: escaped before going into markup
function SXKB_esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';' }) }

// ---------------------------------------------------------------- key hints
// the title legend's <kbd>s, by their label
var SXKB_LEGEND = {
  Move: ['forward', 'left', 'back', 'right'], Reload: ['reload'], 'Cut relay': ['interact'], Knife: ['melee'], Jump: ['jump'], Sprint: ['sprint'],
  Crouch: ['crouch'], Grenade: ['grenade'], 'Grenade type': ['nadeType'], Medkit: ['heal'], Scope: ['scope'], Lean: ['leanL', 'leanR'],
  'Last weapon': ['wlast'], Weapons: ['w1', 'w2', 'w3', 'w4'],
}
function SXKB_hints() {
  var leg = document.querySelector('#ui .menu .m-legend')
  if (!leg) return
  leg.querySelectorAll('span').forEach(function (sp) {
    if (!sp.querySelector('kbd')) return
    if (sp._sxkb == null) {
      // the label = the span's own text, outside its <kbd>s ("– Weapons" → "Weapons")
      var t = ''
      sp.childNodes.forEach(function (n) { if (n.nodeType === 3) t += n.textContent })
      sp._sxkb = t.replace(/^[^A-Za-z]+/, '').trim()
    }
    var ids = SXKB_LEGEND[sp._sxkb]
    if (!ids) return
    var B = SXKB.bind, stockW = ids[0] === 'w1' && ids.every(function (id) { return B[id] === SXKB_def(id)[2] })
    sp.innerHTML = ''
    if (stockW) sp.innerHTML = '<kbd>1</kbd>–<kbd>4</kbd>'
    else ids.forEach(function (id) { var k = document.createElement('kbd'); k.textContent = SXKB_name(B[id]); sp.appendChild(k) })
    sp.appendChild(document.createTextNode(' ' + sp._sxkb))
  })
}

;(function SXKB_boot() {
  var wait = function () {
    var G = window.__G
    if (!G || !window.__ready || typeof h_ === 'undefined') { setTimeout(wait, 250); return }
    window.__sxkb = SXKB // tests
    SXKB_apply() // after arsenal added Digit5 to the stock table
    SXKB_fill()
    G.events.on('game:state', function (ev) { if (ev && ev.state === 'title') { SXKB_fill(); SXKB_hints() } })
    addEventListener('blur', function () { if (SXKB.listen) { SXKB.listen = null; SXKB_fill() } })
  }
  setTimeout(wait, 300)
})()
