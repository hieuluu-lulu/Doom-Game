// ============================================================================
// DoomZone mod — MAIN MENU button
// The bundle has no in-place way back to the title screen, so "Main menu"
// reloads the page on the title (no autostart), keeping the chosen map; the
// title screen's map toggle switches maps from there.
// ============================================================================
function SXMENU_toTitle() {
  var p = new URLSearchParams(location.search)
  // (and the room: a link that still says join/host would walk straight back in)
  ;['autostart', 'shot', 'cam', 'bench', 'dt', 'join', 'host', 'room', 'team', 'mode', 'bots', 'seed'].forEach(function (k) { p.delete(k) })
  try { if (typeof SXN_leave === 'function' && typeof SXN !== 'undefined' && SXN.active) SXN_leave() } catch (e) { }
  if (typeof SX_MAP !== 'undefined') p.set('map', SX_MAP)
  var veil = document.createElement('div')
  veil.className = 'sxmenu-veil'
  veil.textContent = 'Returning to main menu…'
  document.body.appendChild(veil)
  setTimeout(function () {
    var q = p.toString()
    location.href = location.pathname + (q ? '?' + q : '')
  }, 120)
}
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('[data-act="sx-mainmenu"]') : null
  if (!b) return
  e.preventDefault()
  try { window.__G && window.__G.audio && window.__G.audio.play && window.__G.audio.play('ui_click', {}) } catch (er) { }
  SXMENU_toTitle()
})
