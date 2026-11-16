// ============================================================================
// DoomZone mod — ARSENAL
// Weapon slots (1 PAC-9 rifle, 2 KR-12 Breakwater pump shotgun, 3 M7 Tern
// pistol), grenades (frag / EMP / remote C4), ammo + grenade crates and enemy
// drops. Inserted inside the bundle's IIFE, so it reuses three.js (`lt`) and
// the bundle's own viewmodel helpers: Rt/Cn/xr/qo/Ii geometry, Vv gloves,
// N_ muzzle flash, Bf viewmodel material detail, pa/ma springs, Yo easing.
// Every top-level name here starts with SXA_ to stay clear of minified names.
//
// Geometry helpers use the PAC-9 convention: x right, y up, "fwd" = -z
// (Rt(w,h,d,r,x,y,fwd), Cn([[radius,fwd]..]), xr([[fwd,y]..],x0,x1),
// qo([[x,y]..],fwd0,fwd1)). Arrays named *Final are plain local z.
// ============================================================================

var SXA_TUNE = {
  order: ['rifle', 'shotgun', 'pistol', 'sniper'],
  // PAC-9 base handling (SXA_RMOD): stronger climb than the stock rifle
  recoil: { rifle: 2.3, rifleYaw: 2.0, shake: 1.35, bloom: 1.4, keep: 0.45, recover: 5 },
  sniper: {
    name: 'SR-3 Albatross', short: 'SR-3', mag: 5, reserve: 15, maxReserve: 40,
    damage: 118, range: 650, spreadHip: 0.05, spreadAds: 0.0004, bolt: 1.15,
    reload: 2.5, reloadEmpty: 3.0, crate: 10, drop: 5, pickup: 15, pitch: 0.56, gain: 1.45,
  },
  rifleMaxReserve: 300,
  // the PAC-9 as a pickup (maps whose rooms start on the pistol, level.mpKit
  // 'pistol'): a full magazine + `pickup` rounds; when you have it, `crate` rounds
  rifle: { pickup: 60, crate: 60 },
  // attachments on the map: scattered at random (around cover points, robot
  // ground spawns and the map's pickup spots), base + perPlayer for every other
  // player in the room (max), at least apart (m) from each other; a fresh
  // layout every round (rooms: the same layout on every machine — seeded by the
  // room code and the round). kinds: how likely each one is
  // (x4Share of them, at least one, are always 4x scopes)
  gear: { base: 8, perPlayer: 3, max: 32, apart: 4, x4Share: 0.2,
    kinds: { x4: 3, reddot: 1.5, holo: 1.5, supp: 2, comp: 1.5, extmag: 2, grip: 1.5, stock: 1.5, x8: 1 } },
  // the PAC-9's 4x scope: an ACOG-style prism scope (arsenal/assets/scope4x.glb,
  // "4x Scope" by Monstr 3d, CC-BY-4.0) in place of the built-in red dot.
  // len: its length (m); z: its middle on the receiver (viewmodel z, the red
  // dot sits at -0.021); flip: turn it end for end; adsZ: the aim pose's
  // distance (the eye ~4–5 cm behind the eyepiece); reticle: the red chevron's
  // size and the black crosshair / post (m, drawn at the objective lens).
  // Fully aimed (ads > 0.88) the view is the scope's own: a wide round window
  // with the eyepiece's dark rim, a red chevron and the BDC post (.sx-acog) —
  // looking down the model's tube would only show a pinhole of world
  scope4x: { len: 0.136, z: -0.016, flip: true, adsZ: -0.1, reticle: { chevron: 0.0016, bar: 0.00032, line: 0.00016, post: 0.006 } },
  rifleCrate: 60,
  rifleDrop: 30,
  shotgun: {
    name: 'KR-12 Breakwater', short: 'KR-12', mag: 6, reserve: 18, maxReserve: 42,
    pellets: 9, damage: 14, range: 48, spreadHip: 0.062, spreadAds: 0.042,
    pump: 0.62, shellStart: 0.34, shellEach: 0.47, shellEnd: 0.3,
    crate: 12, drop: 6, pickup: 18, pitch: 0.7, gain: 1.25,
  },
  // the Desert Eagle model (SXA_pistolGeoModel): GLB in cm, muzzle +Z; its
  // bore / muzzle are put where the M7's were. right = palm contact nudge (m),
  // rightRot = extra glove rotation (rad)
  pistolModel: { s: 0.01, boreY: 23.8, muzzleZ: 10.84, hip: [0.07, -0.068, -0.35], adsZ: -0.27, right: [0, 0, 0], rightRot: [0, 0, 0] },
  // placement of the pump-shotgun model (SXA_shotgunGeoModel): gun offset
  // along the bore, hip / ADS poses, glove nudges (metres) and the right
  // glove's extra rotation onto the stock wrist (radians)
  // pickup props (SXA_loadProps): size in metres along the fitted axis, the
  // first-aid pouch's rest rotation, armor tint per level (texture × colour)
  props: {
    ammo: 0.32, ammoDrop: 0.24, nadeCrate: 0.56, nadeBright: 1.7, frag: 0.1, meds: 0.24, medsRot: [0, 0, 0],
    medkit: 0.38, medkitL: 0.56, helmet: 0.27, vest: 0.42, attCase: 0.44,
    helmetTint: [null, [1, 0.95, 0.82], [0.78, 0.9, 0.6], [0.34, 0.35, 0.37]],
    vestTint: [null, [2.5, 2.05, 1.35], [1.45, 1.7, 1.05], [1, 1, 1]],
  },
  // the bolt-action sniper model (SXA_sniperGeoModel): GLB units, muzzle +Z,
  // bore / scope axis heights; s scales it to the SR-3's 1.09 m. right / left =
  // glove nudges (m), rightRot = extra glove rotation (rad)
  sniperModel: { s: 0.0065, boreY: 11.1, scopeY: 18.85, muzzleZ: 127.39, hip: [0.108, -0.105, -0.3], adsZ: -0.2,
    right: [0, 0, 0], rightRot: [0, 0, 0], left: [0, 0, -0.105] },
  // the KR-12 = the "Shotgun" model (arsenal/assets/shotgun.glb, DJMaesen,
  // CC-BY-4.0): a pistol-grip pump gun. Its own frame (model units, muzzle
  // toward +z): s = m per unit (0.79 m overall); boreY / triggerZ = the bore
  // height and the trigger (the gun's origin); muzzleZ / rearZ = its ends;
  // beadY = the front bead's top (the eye line); magZ/magY = the magazine
  // tube's cap (the extended-mag tube goes on there); forendZ/forendY = where
  // the left hand holds the pump; gripZ/gripY = the pistol grip (right hand);
  // ejectZ = the port. oz shifts the gun along z; hip / adsZ: the poses;
  // left / right / rightRot: glove nudges (m, rad)
  shotgunModel: {
    s: 0.0057, boreY: 14.15, triggerZ: 7.7, muzzleZ: 128.8, rearZ: -9.24, beadY: 19.6,
    magZ: 112, magY: 9.05, forendZ: 66, forendY: 9.5, gripZ: -2, gripY: -3, ejectZ: 40,
    oz: 0, hip: [0.112, -0.112, -0.27], adsZ: -0.12, pumpTravel: 0.085,
    left: [0, 0, 0], right: [0, 0, 0], rightRot: [0, 0, 0],
    // the model's own colour map is near black (~0.12) and its metal map high,
    // so under the game's light the gun read as a black shape: bright scales
    // the colour, metal / rough are the factors on its metal / roughness maps
    look: { bright: 2.4, metal: 0.5, rough: 1.0 },
    // the roll mark on both flat sides of the receiver (gun frame, m): centre
    // z / y, size w × h, x = the side's distance from the bore line
    engrave: { text: 'KR-12 BREAKWATER', sub: '12 GA \u00b7 PUMP \u00b7 DOOMZONE ARMS', z: -0.05, y: -0.0185, w: 0.19, h: 0.03, x: 0.0182 },
  },
  pistol: {
    name: 'M7 Tern', short: 'M7', mag: 12, reserve: 48, maxReserve: 120,
    damage: 34, interval: 0.115, range: 160, spreadHip: 0.0105, spreadAds: 0.0016,
    reload: 1.45, reloadEmpty: 1.8, crate: 24, drop: 12, pitch: 1.32, gain: 0.78,
  },
  nades: {
    frag: { label: 'Frag', max: 4, start: 2, crate: 2, fuse: 2.2, radius: 6.5, damage: 160 },
    emp: { label: 'EMP', max: 3, start: 1, crate: 1, fuse: 1.3, radius: 8.5, damage: 30, stun: 5 },
    c4: { label: 'C4', max: 2, start: 1, crate: 1, radius: 7.5, damage: 250 },
  },
  nadeOrder: ['frag', 'emp', 'c4'],
  throwSpeed: 15.5,
  throwLift: 3.4,
  gravity: 17,
  crateRespawn: 60,
  dropLife: 45,
  maxDrops: 24,
  // first aid: a small kit adds 20% but never past 80%, a kit tops up to 80%,
  // only the large kit fills to 100%. Natural regen waits 10 s and stops at 30%.
  med: { small: 0.2, cap: 0.8, respawnSmall: 50, respawnKit: 75, respawnLarge: 120,
    carry: { med_s: 6, med: 4, med_l: 2 }, start: { med_s: 1, med: 0, med_l: 0 }, useTime: { med_s: 1.5, med: 3, med_l: 4.5 } },
  regen: { cap: 0.3, delay: 10, rate: 3 },
  // combat knife (V / middle mouse): a quick slash from any gun. dmg per hit
  // (players take it × net pvpScale), range from the eye, time = the whole
  // swing, hitAt = when the blade connects, spread = the swing's arc (rad)
  knife: { dmg: 75, range: 2.1, time: 0.46, hitAt: 0.13, cool: 0.5, spread: 0.32,
    // knife.glb (DJMaesen's "knife Animated"): one clip; its stretches (s) —
    // draw (from below), idle (loops; ends before the clip's own quick cut at
    // 1.36 s), inspect (R) — and the playback rate
    clip: { draw: [4.54, 4.83, 1], idle: [0, 1.33, 1], inspect: [2.72, 4.3, 1] },
    // the attacks, all the clip's own; parts = [from, to, rate(, 'out')] played
    // in turn, hitAt = one time or a list (s into the attack). The clip's swings
    // are very quick (~9 frames at 60 fps, a sharp turn from wind-up to strike,
    // then a dead stop) and read as a stutter in game, so the strikes play at
    // 0.7, their last few hundredths brake to a stop ('out': eased, starting at
    // the same speed), and the dead hold after them is cut (the settle eases
    // the arm back into the idle instead):
    //   ltr  — the quick cut left → right: wind-up left, strike across (1.36–1.51 s)
    //   rtl  — the swing right → left: the strike (2.04–2.18 s), then the clip's
    //          own slow return (2.18–2.72 s)
    //   turn — the third: exactly R's knife turn (2.72–4.3 s at 1.0), with a hit
    //          at each of its two fast moves — the flick up into a reverse grip
    //          (blade fastest at 2.80 s) and the turn back that sweeps the blade
    //          across (hit at 3.47 s)
    // combo: an attack started within `combo` s of the last one ending takes the
    // next one (ltr, rtl, turn, …); a pause starts again at the first.
    // R only turns the knife over (inspect: the same move, no damage).
    styles: [
      { id: 'ltr', label: 'Slash', dmg: 75, spread: 0.32, range: 2.1, parts: [[1.36, 1.47, 0.7], [1.47, 1.51, 0.35, 'out']], hitAt: 0.14, cool: 0.4 },
      { id: 'rtl', label: 'Backslash', dmg: 75, spread: 0.32, range: 2.1, parts: [[2.04, 2.14, 0.7], [2.14, 2.18, 0.35, 'out'], [2.18, 2.72, 1.25]], hitAt: 0.13, cool: 0.4 },
      { id: 'turn', label: 'Turn', dmg: 60, spread: 0.34, range: 2.1, parts: [[2.72, 4.3, 1.0]], hitAt: [0.08, 0.75], cool: 1.5 },
    ],
    combo: 0.7,
    blend: 0.06, // s: cross-fade into an attack from the pose on screen (eased)
    settle: 0.18, // s: cross-fade from the attack's last pose back into the idle loop (eased)
    partBlend: 0.05, // s: cross-fade across a cut inside an attack (the twirl's skipped hold; eased)
    // the rig's own eye (model units, cm) and where it looks; s = cm → m
    vm: { eye: [-3, 29, -50], look: [0, 8, 40], s: 0.01 } },
  // armor: durability lost per point of damage a piece stops; pickup respawn (s)
  armor: { wear: 3, respawn: 150 },
  // spare attachments carried per kind (scopes swapped with B come from here)
  spareMax: 3,
  // PUBG-style backpack: everything carried (reserve ammo, grenades, medkits,
  // spare parts) has a size; worn armor, guns and fitted parts don't count.
  // Capacity: pockets only, then backpacks Lv.1-3 (picked up, PUBG style).
  // The starting kit (~147) fits in the pockets.
  bag: {
    caps: [200, 260, 320, 380], // pockets, Lv.1, Lv.2, Lv.3 (bags add +60 / +120 / +180)
    size: {
      ammo: { '556': 0.5, '50ae': 0.4, '12g': 1, '338': 1 }, // per round, by calibre
      nade: { frag: 12, emp: 12, c4: 15 },
      med: { med_s: 2, med: 10, med_l: 20 },
      att: { reddot: 10, holo: 10, x4: 15, x8: 15, supp: 10, comp: 6, extmag: 10, grip: 6, stock: 10 },
    },
    // rounds per "Drop" = the calibre's box size (SXA_CAL.box)
    dropLife: 180,
    trooperDrop: 0.07, // chance a trooper drops a backpack (30% of those Lv.2)
  },
};
var SXA_REGEN_CAP = SXA_TUNE.regen.cap;
// PAC-9 handling multipliers read by the rifle code in game/js/10_game.js
var SXA_RMOD = { recoil: SXA_TUNE.recoil.rifle, yaw: SXA_TUNE.recoil.rifleYaw, shake: SXA_TUNE.recoil.shake, bloom: SXA_TUNE.recoil.bloom, spread: 1, flash: 1, gain: 1, pitch: 1, hear: 0 };
// Attachments: picked up from cases, auto-fitted to a compatible gun.
var SXA_ATT = {
  // (the M7's red dot is the PAC-9's own sight at 80%: its sight line 0.0255 × 0.8 over the mount)
  reddot: { slot: 'optic', label: 'Red dot sight', short: 'RDS', zoom: 1.4, above: 0.0204 },
  holo: { slot: 'optic', label: 'Holo sight', short: 'HOLO', zoom: 1.4, above: 0.03 },
  x4: { slot: 'optic', label: '4x scope', short: '4X', zoom: 4, above: 0.036 },
  x8: { slot: 'optic', label: '8x scope', short: '8X', zoom: 8, above: 0.04 },
  supp: { slot: 'muzzle', label: 'Suppressor', short: 'SUP', recoil: 0.92, flash: 0.12, gain: 0.42, pitch: 1.4, hear: 9 },
  comp: { slot: 'muzzle', label: 'Compensator', short: 'COMP', recoil: 0.72, yaw: 0.6 },
  extmag: { slot: 'mag', label: 'Extended mag', short: 'EXT', mag: 1.5 },
  grip: { slot: 'grip', label: 'Vertical grip', short: 'GRIP', recoil: 0.82, spread: 0.85 },
  // butt stock: steadier shoulder — less climb, much less sideways kick
  stock: { slot: 'stock', label: 'Tactical stock', short: 'STK', recoil: 0.8, yaw: 0.7, spread: 0.92 },
};
var SXA_ATT_ORDER = ['reddot', 'holo', 'x4', 'x8', 'supp', 'comp', 'extmag', 'grip', 'stock'];
var SXA_COMPAT = {
  rifle: { optic: ['x4'], muzzle: ['supp', 'comp'], mag: ['extmag'], grip: ['grip'], stock: ['stock'] },
  shotgun: { mag: ['extmag'], grip: ['grip'], stock: ['stock'] }, // no optic: the KR-12 shoots off its bead
  pistol: { optic: ['reddot', 'holo'], muzzle: ['supp'], mag: ['extmag'] },
  sniper: { optic: ['x4', 'x8'], muzzle: ['supp', 'comp'], mag: ['extmag'], stock: ['stock'] },
};
var SXA_ATT_DEFAULT = { rifle: {}, shotgun: {}, pistol: {}, sniper: { optic: 'x8' } };
// where each slot sits on each gun (local viewmodel coords) and which group it rides
var SXA_MOUNTS = {
  rifle: { optic: { at: [0, 0.0435, 0.085], line: 0.069, magnifier: true }, muzzle: { at: [0, 0, -0.531] }, grip: { at: [0, -0.021, -0.345] } },
  shotgun: { mag: { at: [0, -0.028, -0.588], tube: true }, grip: null },
  pistol: { optic: { at: [0, 0.031, -0.01], on: 'mover' }, muzzle: { at: [0, 0.0135, -0.168] }, mag: { at: [0, -0.165, 0.087], on: 'mag' } },
  sniper: { optic: { at: [0, 0.036, -0.02] }, muzzle: { at: [0, 0.012, -0.83] }, mag: { at: [0, -0.11, -0.075], on: 'mag' } },
};
var SXA_MEDS = { med_s: 'Small medkit', med: 'Medkit', med_l: 'Large medkit' };
// Calibres (PUBG style): ammo is carried in the backpack per calibre, and a
// gun's reserve IS the stack of its calibre (you can carry rounds for a gun you
// don't own yet). box = rounds in one box (drops, "Drop N"), crate = rounds
// per calibre from a mixed ammo crate, start = the starting kit.
var SXA_CAL = {
  '556': { label: '5.56', gun: 'rifle', color: '#8fe07a', tint: [0.72, 1.0, 0.62], box: 30, crate: 60, start: 150 },
  '12g': { label: '12 GA', gun: 'shotgun', color: '#ff7a66', tint: [1.25, 0.6, 0.55], box: 6, crate: 12, start: 0 },
  '50ae': { label: '.50 AE', gun: 'pistol', color: '#ffd24a', tint: [1.3, 1.08, 0.5], box: 12, crate: 24, start: 48 },
  '338': { label: '.338', gun: 'sniper', color: '#7ab8ff', tint: [0.6, 0.82, 1.35], box: 5, crate: 10, start: 0 },
};
var SXA_CAL_ORDER = ['556', '12g', '50ae', '338'];
var SXA_GUN_CAL = { rifle: '556', shotgun: '12g', pistol: '50ae', sniper: '338' };
function SXA_isCal(kind) { return typeof kind === 'string' && kind.indexOf('ammo:') === 0 && !!SXA_CAL[kind.slice(5)]; }
// backpacks (pickups bag1-3): their level sets the carry capacity (SXA_TUNE.bag.caps)
var SXA_PACKS = { bag1: { lv: 1, label: 'Backpack Lv.1' }, bag2: { lv: 2, label: 'Backpack Lv.2' }, bag3: { lv: 3, label: 'Backpack Lv.3' } };
// the guns an attachment fits (SXA_COMPAT), in loadout order
function SXA_fitsGuns(id) {
  var d = SXA_ATT[id], out = [];
  if (!d) return out;
  SXA_TUNE.order.forEach(function (k) { var c = SXA_COMPAT[k]; if (c && (c[d.slot] || []).indexOf(id) >= 0) out.push(k); });
  return out;
}
var SXA_MED_SHORT = { med_s: 'SM', med: 'MED', med_l: 'LG' };
var SXA_MED_ORDER = ['med_s', 'med', 'med_l'];
// Helmets and vests (PUBG-style levels): each cuts the damage that reaches you
// by `cut` (a helmet and a vest stack), paying for it out of its durability
// until it breaks. Not used while you are in a vehicle (the vehicle takes it).
var SXA_ARMOR = {
  helm1: { slot: 'helmet', lv: 1, label: 'Helmet Lv.1', cut: 0.15, dur: 80 },
  helm2: { slot: 'helmet', lv: 2, label: 'Helmet Lv.2', cut: 0.22, dur: 150 },
  helm3: { slot: 'helmet', lv: 3, label: 'Helmet Lv.3', cut: 0.3, dur: 230 },
  vest1: { slot: 'vest', lv: 1, label: 'Vest Lv.1', cut: 0.25, dur: 100 },
  vest2: { slot: 'vest', lv: 2, label: 'Vest Lv.2', cut: 0.35, dur: 170 },
  vest3: { slot: 'vest', lv: 3, label: 'Vest Lv.3', cut: 0.45, dur: 250 },
};

// PAC-9 lower-receiver parts, copied so the PAC-9 glove grips the new guns the
// same way (x already squeezed by the rifle's 0.86 factor).
var SXA_GRIP = [[-0.038, -0.05], [-0.045, -0.074], [-0.049, -0.086], [-0.049, -0.1], [-0.054, -0.112], [-0.057, -0.13], [-0.064, -0.158], [-0.11, -0.152], [-0.102, -0.112], [-0.096, -0.082], [-0.095, -0.064], [-0.103, -0.046], [-0.08, -0.044]];
var SXA_GUARD = [[0.033, -0.056], [0.033, -0.093], [0.024, -0.1005], [-0.031, -0.1005], [-0.041, -0.09], [-0.041, -0.06]];
var SXA_GUARD_HOLE = [[0.028, -0.059], [0.028, -0.091], [0.022, -0.096], [-0.029, -0.096], [-0.036, -0.088], [-0.036, -0.061]];
var SXA_TRIGGER = [[-0.006, -0.057], [0.004, -0.057], [0.003, -0.069], [0.0065, -0.079], [0.01, -0.086], [0.0065, -0.088], [0.001, -0.081], [-0.004, -0.07]];
var SXA_ONE = [1, 1, 1];

function SXA_bucket() {
  return { ano: [], gun: [], poly: [], tan: [], plain: [], brass: [], glass: [], ret: [] };
}
// a reflex sight's aiming mark, drawn on its glass (facing the eye): a dot, or
// a ring + dot (holo). Geometry with the same attributes as the rest of the
// bucket's (position, normal, uv, color) so they merge.
function SXA_reticle(kind, x, y, z) {
  var col = function (g, c) { var n = g.attributes.position.count, a = new Float32Array(n * 3); for (var k = 0; k < n; k++) { a[k * 3] = c[0]; a[k * 3 + 1] = c[1]; a[k * 3 + 2] = c[2]; } g.setAttribute('color', new lt.BufferAttribute(a, 3)); return g.translate(x, y, z); };
  var red = [1, 0.12, 0.08], out = [col(new lt.CircleGeometry(kind === 'holo' ? 0.00075 : 0.001, 14), red)];
  if (kind === 'holo') out.push(col(new lt.RingGeometry(0.0052, 0.0059, 32), red));
  return out;
}

// Vertical lathe (along +y) with a flat vertex colour, for shell hulls etc.
function SXA_vlathe(points, segs, color) {
  var g = new lt.LatheGeometry(points.map(function (p) { return new lt.Vector2(p[0], p[1]); }), segs);
  var n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (var k = 0; k < n; k++) { c[k * 3] = color[0]; c[k * 3 + 1] = color[1]; c[k * 3 + 2] = color[2]; }
  g.setAttribute('color', new lt.BufferAttribute(c, 3));
  return g;
}

function SXA_lower(b) {
  b.poly.push(xr(SXA_GRIP, -0.0142, 0.0142, 0.005, SXA_ONE, 0.6));
  b.poly.push(xr(SXA_GUARD, -0.0073, 0.0073, 8e-4, SXA_ONE, 0.6, [SXA_GUARD_HOLE]));
}

function SXA_shotgunGeo() {
  var S = SXA_bucket(), P = SXA_bucket(), trig = SXA_bucket();
  // receiver, with the trigger-group bump the PAC-9 guard hangs from
  S.ano.push(xr([[-0.105, -0.05], [-0.05, -0.05], [-0.046, -0.058], [0.036, -0.058], [0.045, -0.05], [0.14, -0.05], [0.14, 0.018], [0.128, 0.031], [-0.085, 0.031], [-0.105, 0.017]], -0.0205, 0.0205, 0.0022, SXA_ONE, 6));
  // ejection port (right) with the bolt face showing
  S.gun.push(Rt(0.002, 0.018, 0.056, 8e-4, 0.0212, 0.004, 0.072, [0.12, 0.12, 0.12]));
  S.gun.push(Rt(0.0012, 0.011, 0.03, 5e-4, 0.0222, 0.004, 0.066, [4, 4, 4.2]));
  // loading port lip under the receiver
  S.gun.push(Rt(0.03, 0.002, 0.07, 8e-4, 0, -0.0505, 0.09, [0.2, 0.2, 0.2]));
  // ghost-ring rear sight
  S.ano.push(Rt(0.024, 0.008, 0.034, 0.002, 0, 0.034, -0.068, SXA_ONE, 4));
  S.ano.push(Rt(0.0045, 0.02, 0.014, 0.0012, -0.0098, 0.046, -0.07, SXA_ONE, 4));
  S.ano.push(Rt(0.0045, 0.02, 0.014, 0.0012, 0.0098, 0.046, -0.07, SXA_ONE, 4));
  var ring = new lt.TorusGeometry(0.0062, 0.0017, 8, 22);
  ring.translate(0, 0.047, 0.07);
  S.ano.push(ring);
  // barrel, bore, vent rib, front post with a hi-vis insert
  S.gun.push(Cn([[0, 0.13], [0.0105, 0.13], [0.0105, 0.618], [0.0121, 0.621], [0.0121, 0.638], [0.0098, 0.641], [0, 0.641]], 18, [2.6, 2.6, 2.75], 2, 0, 0.008));
  S.plain.push(Cn([[0, 0.6412], [0.0074, 0.6412], [0.0074, 0.6414], [0, 0.6414]], 14, [0.02, 0.02, 0.02], 0, 0, 0.008));
  S.ano.push(Rt(0.006, 0.004, 0.44, 0.001, 0, 0.0198, 0.372, SXA_ONE, 2));
  S.ano.push(Rt(0.003, 0.03, 0.007, 0.001, 0, 0.033, 0.598, SXA_ONE, 2));
  S.plain.push(Rt(0.0034, 0.004, 0.004, 8e-4, 0, 0.0455, 0.598, [9, 2.4, 0.3]));
  // magazine tube, cap, barrel clamp
  S.ano.push(Cn([[0, 0.13], [0.0115, 0.13], [0.0115, 0.555], [0.0127, 0.558], [0.0127, 0.582], [0.009, 0.588], [0, 0.588]], 16, SXA_ONE, 3, 0, -0.028));
  S.ano.push(Rt(0.03, 0.062, 0.02, 0.005, 0, -0.01, 0.548, SXA_ONE, 4));
  // stock + butt pad
  S.poly.push(xr([[-0.1, 0.024], [-0.1, -0.044], [-0.118, -0.05], [-0.23, -0.1], [-0.244, -0.1], [-0.25, -0.06], [-0.246, -0.012], [-0.232, -0.004], [-0.13, 0.018]], -0.016, 0.016, 0.004, SXA_ONE, 0.6));
  S.poly.push(Rt(0.034, 0.1, 0.016, 0.006, 0, -0.052, -0.254, [0.55, 0.55, 0.55], 0.3, [0.12, 0, 0]));
  // side saddle with four red shells (left side)
  S.ano.push(Rt(0.0035, 0.034, 0.104, 0.0015, -0.0225, -0.012, 0.088, SXA_ONE, 3));
  for (var k = 0; k < 4; k++) {
    var z = -(0.052 + k * 0.0245);
    S.plain.push(SXA_vlathe([[0, -0.02], [0.0093, -0.02], [0.0093, 0.013], [0.0087, 0.016], [0, 0.016]], 12, [0.55, 0.05, 0.035]).translate(-0.034, 0, z));
    S.brass.push(SXA_vlathe([[0, -0.033], [0.0098, -0.033], [0.0098, -0.027], [0.0094, -0.026], [0.0094, -0.02], [0, -0.02]], 12, SXA_ONE).translate(-0.034, 0, z));
  }
  SXA_lower(S);
  trig.gun.push(xr(SXA_TRIGGER, -0.00275, 0.00275, 8e-4, [5.5, 5.5, 5.7], 0));
  // pump: ribbed forend + action bars (moves back 75 mm)
  P.poly.push(Rt(0.046, 0.044, 0.16, 0.009, 0, -0.03, 0.28, SXA_ONE, 0.6));
  for (var r = 0; r < 7; r++) P.poly.push(Rt(0.049, 0.047, 0.006, 0.0025, 0, -0.03, 0.214 + r * 0.022, [0.72, 0.72, 0.72], 0.3));
  P.gun.push(Rt(0.003, 0.006, 0.12, 0.001, -0.0128, -0.016, 0.16, [3, 3, 3.1]));
  P.gun.push(Rt(0.003, 0.006, 0.12, 0.001, 0.0128, -0.016, 0.16, [3, 3, 3.1]));
  return {
    parts: { body: S, pump: P, trigger: trig },
    muzzle: [0, 0.008, -0.642], eject: [0.024, 0.004, -0.07], sightY: 0.047,
    hip: { p: [0.112, -0.118, -0.29], r: [0.03, 0.08, -0.03] },
    ads: { p: [0, -0.047, -0.17], r: [0, 0, 0] },
    sprint: { p: [-0.035, 0.004, 0.03], r: [-0.04, 0.62, 0.26] },
    reload: { p: [-0.02, 0.035, 0.02], r: [0.14, 0.12, 0.55] },
    leftOffset: [0, -0.03, -0.044],
  };
}

// ---------------------------------------------------------------------------
// KR-12 from the "Shotgun" model (Sketchfab, DJMaesen, CC-BY-4.0; tools/
// shotgun_opt.mjs → assets/shotgun.glb: 2048 WebP textures, meshopt). Meshes:
// base (receiver, barrel, magazine tube, pistol grip), loader (loading gate),
// pump (forend + action bars), trigger, slug (a loose shell: left out). Baked
// into the gun's frame here (SXA_TUNE.shotgunModel): turned round so the
// muzzle points down -z, in metres, the origin on the bore at the trigger.
// Its own material (colour, metal/roughness and normal maps).
// The procedural KR-12 (SXA_shotgunGeo) stays as the fallback.
// ---------------------------------------------------------------------------
var SXA_SGM = null;
// every mesh of a glTF scene as float geometry (position / normal / uv) in the
// scene's own space — quantised (meshopt) attributes come out as plain floats
function SXA_bakeScene(scene) {
  scene.updateMatrixWorld(true);
  var inv = new lt.Matrix4().copy(scene.matrixWorld).invert(), out = [];
  scene.traverse(function (o) {
    if (!o.isMesh) return;
    var src = o.geometry, g = new lt.BufferGeometry();
    ['position', 'normal', 'uv'].forEach(function (name) {
      var a = src.attributes[name];
      if (!a) return;
      var arr = new Float32Array(a.count * a.itemSize);
      for (var i = 0; i < a.count; i++) for (var c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
      g.setAttribute(name, new lt.BufferAttribute(arr, a.itemSize));
    });
    if (src.index) g.setIndex(src.index.clone());
    g.applyMatrix4(new lt.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    out.push({ geo: g, mat: o.material, name: o.name || '' });
  });
  return out;
}
async function SXA_loadShotgunModel() {
  if (typeof SX_ASSET_shotgun !== 'string' || typeof SX_parseGLB !== 'function') return null;
  var gltf = await SX_parseGLB(SX_ASSET_shotgun), T = SXA_TUNE.shotgunModel, k = T.s;
  // model → gun frame: turned round (muzzle onto -z), metres, the origin on the bore at the trigger
  var M = new lt.Matrix4().makeRotationY(Math.PI).multiply(new lt.Matrix4().makeScale(k, k, k)).multiply(new lt.Matrix4().makeTranslation(0, -T.boreY, -T.triggerZ));
  var groups = { Body: [], Grip: [], Trigger: [] }, mat = null;
  SXA_bakeScene(gltf.scene).forEach(function (p) {
    var key = /^pump/i.test(p.name) ? 'Grip' : /^trigger/i.test(p.name) ? 'Trigger' : /^slug/i.test(p.name) ? null : 'Body';
    if (!key) return;
    p.geo.applyMatrix4(M);
    groups[key].push(p.geo);
    mat = mat || p.mat;
  });
  var geos = {};
  for (var g in groups) if (groups[g].length) geos[g] = groups[g].length > 1 ? Ii(groups[g]) : groups[g][0];
  if (!geos.Body || !geos.Grip || !mat) throw new Error('shotgun meshes missing');
  [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap].forEach(function (t) { if (t) { t.anisotropy = 8; t.needsUpdate = true; } });
  mat.name = 'sxa_kr12';
  var LK = T.look || {};
  if (LK.bright) mat.color.setScalar(LK.bright);
  if (LK.metal != null) mat.metalness = LK.metal;
  if (LK.rough != null) mat.roughness = LK.rough;
  // the roll mark uses the HUD's font: wait for it a moment (else a fallback face)
  try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 40px "Big Shoulders Display"'), new Promise(function (r) { setTimeout(r, 1500); })]); } catch (e) { }
  return { geos: geos, mat: mat, engrave: SXA_engrave(T.engrave) };
}
// a roll mark: the text drawn on a canvas, on a thin plane on each flat side of
// the receiver (left side reads muzzle → stock, the right side the other way)
function SXA_engrave(E) {
  if (!E || typeof document === 'undefined') return null;
  var W = 1024, H = Math.round(W * E.h / E.w), cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var c = cv.getContext('2d'), big = Math.round(H * 0.5), small = Math.round(H * 0.27);
  var draw = function (txt, size, y) {
    c.font = '700 ' + size + 'px "Big Shoulders Display", "Arial Narrow", Arial, sans-serif';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    var sp = size * 0.12, x = W * 0.03;
    // cut into the steel: a dark edge over a bright floor
    for (var pass = 0; pass < 2; pass++) {
      c.fillStyle = pass ? 'rgba(214,219,224,0.95)' : 'rgba(8,9,10,0.85)';
      var xx = x + (pass ? 0 : -2), yy = y + (pass ? 0 : -2);
      for (var k = 0; k < txt.length; k++) { c.fillText(txt[k], xx, yy); xx += c.measureText(txt[k]).width + sp; }
    }
  };
  draw(E.text, big, H * 0.34);
  if (E.sub) draw(E.sub, small, H * 0.8);
  var tex = new lt.CanvasTexture(cv);
  tex.colorSpace = lt.SRGBColorSpace; tex.anisotropy = 8;
  var mat = new lt.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.2, depthWrite: false, metalness: 0.55, roughness: 0.38, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  mat.name = 'sxa_kr12_mark';
  var geos = [-1, 1].map(function (side) {
    var g = new lt.PlaneGeometry(E.w, E.h);
    g.rotateY(side * Math.PI / 2); // left (-x) plane faces -x, right faces +x
    g.translate(side * E.x, E.y, E.z);
    return g;
  });
  return { geos: geos, mat: mat };
}
function SXA_shotgunGeoModel(M) {
  // the model sits in the viewmodel frame with its bore 8 mm above the root,
  // like the procedural KR-12, so the hip / ADS framing stays the same; the
  // points below come from the model's own measurements (SXA_TUNE.shotgunModel)
  var BY = 0.008, TM = SXA_TUNE.shotgunModel, OZ = TM.oz, g = M.geos, k = TM.s;
  var z = function (mz) { return -(mz - TM.triggerZ) * k + OZ; }, y = function (my) { return (my - TM.boreY) * k + BY; };
  var line = y(TM.beadY) + 0.002; // eye line just over the front bead
  SXA_MOUNTS.shotgun = { mag: { at: [0, y(TM.magY), z(TM.magZ)], tube: true }, grip: null }; // no optic slot
  return {
    parts: {},
    model: {
      mat: M.mat, offset: [0, BY, OZ],
      body: [g.Body],
      pump: [g.Grip],
      trigger: g.Trigger ? [g.Trigger] : [],
      length: [z(TM.muzzleZ), z(TM.rearZ)],
      marks: M.engrave,
    },
    muzzle: [0, BY, z(TM.muzzleZ)], eject: [0.016, BY + 0.006, z(TM.ejectZ)], sightY: line,
    hip: { p: TM.hip.slice(), r: [0.03, 0.08, -0.03] },
    ads: { p: [0, -line, TM.adsZ], r: [0, 0, 0] },
    sprint: { p: [-0.035, 0.004, 0.03], r: [-0.04, 0.62, 0.26] },
    reload: { p: [-0.02, 0.035, 0.02], r: [0.14, 0.12, 0.55] },
    // left glove onto the pump's forend (same relation to it as on the procedural KR-12)
    leftOffset: [TM.left[0], y(TM.forendY) + TM.left[1], z(TM.forendZ) + 0.236 + TM.left[2]],
    // right glove from the PAC-9's pistol grip onto this one's
    rightGrip: { from: [0, -0.1, 0.073], to: [TM.right[0], y(TM.gripY) + TM.right[1], z(TM.gripZ) + TM.right[2]], rot: TM.rightRot },
    pumpTravel: TM.pumpTravel,
  };
}

// ---------------------------------------------------------------------------
// Pickup props from Sketchfab models, assets/prop_*.glb (CC-BY 4.0; titles /
// authors in the GLB asset info): ammo cans (crate + drop), stacked supply
// crates (grenades), the frag grenade, first-aid pouch / medkit case,
// helmet, plate carrier, the attachment hard case. Textures ≤512 px WebP,
// quantised. Each is parsed once, normalised (centred on x/z, resting on
// y = 0, scaled to the old procedural footprint) and cloned per pickup; the
// procedural kit stays the fallback, and pickups already placed are swapped
// when the models arrive late.
// ---------------------------------------------------------------------------
var SXA_PROPS = null, SXA_propsSwap = null;
var SXA_PROP_SRC = { ammo: 1, nadecrate: 1, frag: 1, meds: 1, medkit: 1, helmet: 1, vest: 1, attcase: 1 };
// scene → group with the model centred on x/z, standing on y = 0 (centre:
// centred on y too), `size` metres along `axis` ('x' | 'y' | 'z' | 'max')
function SXA_propFit(obj, size, axis, centre) {
  var root = new lt.Group();
  root.add(obj);
  obj.updateMatrixWorld(true);
  var b = new lt.Box3().setFromObject(obj), s = b.getSize(new lt.Vector3());
  var k = size / (axis === 'max' ? Math.max(s.x, s.y, s.z) : s[axis]);
  obj.scale.multiplyScalar(k);
  obj.updateMatrixWorld(true);
  b.setFromObject(obj);
  var c = b.getCenter(new lt.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z;
  obj.position.y -= centre ? c.y : b.min.y;
  root.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}
function SXA_propOnly(scene, names) {
  var drop = [];
  scene.traverse(function (o) { if (o.isMesh && names.indexOf(o.name) < 0) drop.push(o); });
  drop.forEach(function (o) { o.parent.remove(o); });
  return scene;
}
async function SXA_loadProps() {
  if (typeof SX_parseGLB !== 'function') return null;
  var keys = Object.keys(SXA_PROP_SRC), src = {};
  var assets = { ammo: typeof SX_ASSET_prop_ammo === 'string' && SX_ASSET_prop_ammo, nadecrate: typeof SX_ASSET_prop_nadecrate === 'string' && SX_ASSET_prop_nadecrate, frag: typeof SX_ASSET_prop_frag === 'string' && SX_ASSET_prop_frag,
    meds: typeof SX_ASSET_prop_meds === 'string' && SX_ASSET_prop_meds, medkit: typeof SX_ASSET_prop_medkit === 'string' && SX_ASSET_prop_medkit, helmet: typeof SX_ASSET_prop_helmet === 'string' && SX_ASSET_prop_helmet,
    vest: typeof SX_ASSET_prop_vest === 'string' && SX_ASSET_prop_vest, attcase: typeof SX_ASSET_prop_attcase === 'string' && SX_ASSET_prop_attcase };
  var res = await Promise.all(keys.map(function (k) { return assets[k] ? SX_parseGLB(assets[k]).then(function (g) { return g.scene; }, function (e) { console.warn('[arsenal] prop ' + k + ': ' + (e && e.message || e)); return null; }) : null; }));
  res.forEach(function (sc, i) {
    if (!sc) return;
    src[keys[i]] = sc;
    // painted / fabric props: the sources' metal and mirror-gloss settings read
    // black under the game's light, so cap metalness and floor roughness
    var maxMet = keys[i] === 'frag' ? 0.6 : 0.25;
    sc.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var m = o.material;
      m.metalness = Math.min(m.metalness, maxMet);
      m.roughness = Math.max(m.roughness, 0.5);
    });
  });
  var P = {}, T = SXA_TUNE.props;
  // pair of ammo cans for the crate spot, one can for a drop
  if (src.ammo) {
    // the two cans side by side (the source has them far apart)
    var cOld = SXA_propFit(SXA_propOnly(src.ammo.clone(true), ['Box_LP_Low_Poly_Old_0']), T.ammo, 'z');
    var cNew = SXA_propFit(SXA_propOnly(src.ammo.clone(true), ['Box_LP_Low_Poly_New_0']), T.ammo, 'z');
    var cw = new lt.Box3().setFromObject(cNew).getSize(new lt.Vector3()).x;
    cOld.position.x = -(cw / 2 + 0.012); cNew.position.x = cw / 2 + 0.012; cNew.rotation.y = 0.06;
    P.ammo = new lt.Group(); P.ammo.add(cOld, cNew);
    P.ammo1 = SXA_propFit(SXA_propOnly(src.ammo.clone(true), ['Box_LP_Low_Poly_New_0']), T.ammoDrop, 'z');
  }
  // two long supply crates, the top one skewed
  if (src.nadecrate) {
    // its olive paint reads near-black in the desert light: lift it
    src.nadecrate.traverse(function (o) { if (o.isMesh) o.material.color.setScalar(T.nadeBright); });
    var a = SXA_propFit(src.nadecrate.clone(true), T.nadeCrate, 'x'), b2 = SXA_propFit(src.nadecrate.clone(true), T.nadeCrate * 0.92, 'x');
    var h = new lt.Box3().setFromObject(a).max.y;
    b2.position.set(0.015, h - 0.003, 0.01); b2.rotation.y = 0.16;
    var g = new lt.Group(); g.add(a, b2); P.nadecrate = g;
  }
  if (src.frag) P.frag = SXA_propFit(src.frag, T.frag, 'y', true);
  if (src.meds) { var mo = src.meds; mo.rotation.set(T.medsRot[0], T.medsRot[1], T.medsRot[2]); P.meds = SXA_propFit(mo, T.meds, 'max'); }
  if (src.medkit) { P.medkit = SXA_propFit(src.medkit.clone(true), T.medkit, 'x'); P.medkitL = SXA_propFit(src.medkit, T.medkitL, 'x'); }
  if (src.helmet) P.helmet = SXA_propFit(src.helmet, T.helmet, 'x');
  if (src.vest) P.vest = SXA_propFit(src.vest, T.vest, 'y');
  if (src.attcase) {
    src.attcase.traverse(function (o) { if (o.isMesh) o.material.roughness = Math.max(o.material.roughness, 0.72); });
    // close the lid over the base, the foam stays inside
    var cs = SXA_propOnly(src.attcase, ['main_mesh_main_0', 'lid_mesh_lid_0', 'handle_mesh_handle_0']);
    cs.updateMatrixWorld(true);
    var lid = cs.getObjectByName('lid_mesh_lid_0'), base = cs.getObjectByName('main_mesh_main_0');
    if (lid && base) {
      var bb = new lt.Box3().setFromObject(base), lb = new lt.Box3().setFromObject(lid);
      var piv = new lt.Group();
      piv.position.copy(lb.getCenter(new lt.Vector3()));
      cs.add(piv); piv.updateMatrixWorld(true);
      piv.attach(lid);
      piv.rotation.x = Math.PI / 2;
      piv.updateMatrixWorld(true);
      lb.setFromObject(lid);
      piv.position.y += bb.max.y - 0.01 - lb.min.y;
      piv.position.z += (bb.min.z + bb.max.z) / 2 - (lb.min.z + lb.max.z) / 2;
    }
    P.attcase = SXA_propFit(cs, T.attCase, 'x');
  }
  return P;
}
function SXA_propClone(name, tint) {
  var p = SXA_PROPS && SXA_PROPS[name];
  if (!p) return null;
  var c = p.clone(true);
  if (tint) {
    var cache = SXA_propClone.tints || (SXA_propClone.tints = {}), key = name + ':' + tint.join(',');
    c.traverse(function (o) {
      if (!o.isMesh) return;
      var k = key + ':' + o.material.uuid;
      if (!cache[k]) { cache[k] = o.material.clone(); cache[k].color.setRGB(tint[0], tint[1], tint[2]); }
      o.material = cache[k];
    });
  }
  return c;
}

// ---------------------------------------------------------------------------
// M7 from the Desert Eagle model (desert_eagle.glb),
// assets/deagle.glb (106 MB → 1.1 MB: loose round dropped, 1024 px WebP,
// quantised). GLB frame: cm, muzzle +Z, up +Y. Slide assembly = Group001,
// magazine = Magazine_low + MagazineBase_low + BaseInside_low, trigger.
// ---------------------------------------------------------------------------
var SXA_PSM = null;
async function SXA_loadPistolModel() {
  if (typeof SX_ASSET_deagle !== 'string' || typeof SX_parseGLB !== 'function') return null;
  var g = await SX_parseGLB(SX_ASSET_deagle);
  if (!g.scene.getObjectByName('Group001') || !g.scene.getObjectByName('Magazine_low')) throw new Error('Desert Eagle parts missing');
  return { scene: g.scene };
}
function SXA_pistolGeoModel(PM) {
  var TM = SXA_TUNE.pistolModel, s = TM.s;
  // GLB point (cm) → viewmodel frame (m, forward -Z, muzzle at the M7's)
  var ty = 0.0135 - TM.boreY * s, tz = -0.168 + TM.muzzleZ * s;
  var P = function (x, y, z) { return [-x * s, y * s + ty, -z * s + tz]; };
  var sight = P(0, 26.22, -11)[1];
  var grip = P(0.12, 16.27, -10.45);
  SXA_MOUNTS.pistol = { optic: { at: [0, P(0, 25.66, 0)[1], -0.015], on: 'mover' }, muzzle: { at: [0, 0.0135, -0.168] }, mag: { at: P(0, 10.6, -10.2), on: 'mag' } };
  return {
    parts: {},
    model: {
      build: function () {
        var hold = new lt.Group();
        hold.rotation.y = Math.PI;
        hold.scale.setScalar(s);
        hold.position.set(0, ty, tz);
        hold.add(PM.scene.clone(true));
        return hold;
      },
      moverNodes: ['Group001'],
      magNodes: ['Magazine_low', 'MagazineBase_low', 'BaseInside_low'],
      triggerNodes: ['Trigger_low'],
    },
    muzzle: [0, 0.0135, -0.168], eject: [0.014, P(0, 24.2, -4.5)[1], P(0, 24.2, -4.5)[2]], sightY: sight,
    hip: { p: TM.hip.slice(), r: [0.07, 0.12, -0.05] },
    ads: { p: [0, -sight, TM.adsZ], r: [0, 0, 0] },
    sprint: { p: [-0.025, -0.05, 0.035], r: [0.62, 0.05, 0.14] },
    reload: { p: [-0.025, 0.05, 0.03], r: [0.36, 0.26, -0.38] },
    magAxis: [0, -0.987, 0.16],
    // the right glove from the old grip onto the Desert Eagle's
    rightGrip: { from: [0, -0.1, 0.073], to: [grip[0] + TM.right[0], grip[1] + 0.004 + TM.right[1], grip[2] + 0.004 + TM.right[2]], rot: TM.rightRot },
  };
}

// ---- SR-3: the bolt-action sniper model (arsenal/assets/sniper.glb) ----
// Nodes: base, scope, boltback (+ child bolt: shroud, bolt body, handle),
// trigger, mag (+ child bullet), release. The bolt rides the gun's mover group
// (lifts about the bore, slides back), the magazine its mag group; the model's
// own scope is the gun's optic (x8, or x4 when that is fitted).
var SXA_SNM = null;
var SXA_KNM = null; // knife_animated.glb (arms + knife, skinned, one clip)
var SXA_S4M = null; // scope4x.glb (the PAC-9's 4x scope, an ACOG-style prism scope)
async function SXA_loadSniperModel() {
  if (typeof SX_ASSET_sniper !== 'string' || typeof SX_parseGLB !== 'function') return null;
  var g = await SX_parseGLB(SX_ASSET_sniper);
  if (!g.scene.getObjectByName('boltback') || !g.scene.getObjectByName('mag') || !g.scene.getObjectByName('scope')) throw new Error('sniper parts missing');
  return { scene: g.scene };
}
function SXA_sniperGeoModel(SM) {
  var TM = SXA_TUNE.sniperModel, s = TM.s;
  // GLB point → viewmodel frame (m, forward -Z, bore on y = 0, muzzle where the SR-3's was)
  var ty = -TM.boreY * s, tz = -0.838 + TM.muzzleZ * s;
  var P = function (x, y, z) { return [-x * s, y * s + ty, -z * s + tz]; };
  var sight = P(0, TM.scopeY, 0)[1];
  var grip = P(0, -3.2, -3.5);
  SXA_MOUNTS.sniper = {
    optic: { at: [0, sight, -0.02], builtIn: true, line: sight },
    muzzle: { at: [0, 0, -0.832] },
    mag: { at: P(0, -4.4, 20.4), on: 'mag' },
  };
  return {
    parts: {},
    model: {
      build: function () {
        var hold = new lt.Group();
        hold.rotation.y = Math.PI;
        hold.scale.setScalar(s);
        hold.position.set(0, ty, tz);
        hold.add(SM.scene.clone(true));
        return hold;
      },
      moverNodes: ['boltback'],
      magNodes: ['mag'],
      triggerNodes: ['trigger'],
      world: function () {
        // lying-down pickup copy, centred along its length, resting on the ground
        var o = SM.scene.clone(true), inner = new lt.Group(), hold = new lt.Group();
        inner.add(o);
        inner.scale.setScalar(s * 1.1);
        inner.rotation.y = Math.PI / 2;
        inner.position.set(-(TM.muzzleZ - 40.51) / 2 * s * 1.1, (8.28) * s * 1.1, 0);
        hold.add(inner);
        return hold;
      },
    },
    muzzle: [0, 0, -0.838], eject: P(-2.6, 11.1, 9), sightY: sight,
    hip: { p: TM.hip.slice(), r: [0.03, 0.08, -0.03] },
    ads: { p: [0, -sight, TM.adsZ], r: [0, 0, 0] },
    sprint: { p: [-0.035, 0.004, 0.03], r: [-0.04, 0.62, 0.26] },
    reload: { p: [-0.025, 0.045, 0.03], r: [0.32, 0.22, -0.32] },
    leftOffset: TM.left.slice(), magAxis: [0, -1, 0],
    rightGrip: { from: [0, -0.1, 0.073], to: [grip[0] + TM.right[0], grip[1] + TM.right[1], grip[2] + TM.right[2]], rot: TM.rightRot },
  };
}

function SXA_pistolGeo() {
  var S = SXA_bucket(), SL = SXA_bucket(), MG = SXA_bucket(), trig = SXA_bucket();
  // polymer frame with the same trigger-group bump as the rifle lower
  S.poly.push(xr([[-0.105, -0.004], [0.15, -0.004], [0.156, -0.012], [0.152, -0.026], [0.046, -0.026], [0.036, -0.058], [-0.046, -0.058], [-0.05, -0.05], [-0.105, -0.05], [-0.11, -0.02]], -0.0125, 0.0125, 0.003, SXA_ONE, 0.6));
  for (var k = 0; k < 4; k++) S.poly.push(Rt(0.0262, 0.004, 0.006, 0.001, 0, -0.0262, 0.078 + k * 0.016, [0.55, 0.55, 0.55], 0.2));
  S.gun.push(Rt(0.0025, 0.005, 0.03, 0.001, -0.0136, -0.006, 0.02, [2.2, 2.2, 2.3]));
  S.gun.push(Cn([[0, 0.158], [0.0066, 0.158], [0.0066, 0.1672], [0, 0.1672]], 16, [2.4, 2.4, 2.5], 0, 0, 0.0135));
  S.plain.push(Cn([[0, 0.1673], [0.0042, 0.1673], [0.0042, 0.1675], [0, 0.1675]], 12, [0.02, 0.02, 0.02], 0, 0, 0.0135));
  SXA_lower(S);
  trig.gun.push(xr(SXA_TRIGGER, -0.00275, 0.00275, 8e-4, [5.5, 5.5, 5.7], 0));
  // slide (moves on every shot, locks back on empty)
  SL.ano.push(xr([[-0.062, -0.003], [0.162, -0.003], [0.166, 0.004], [0.166, 0.024], [0.159, 0.031], [-0.052, 0.031], [-0.062, 0.024]], -0.0122, 0.0122, 0.0016, SXA_ONE, 6));
  for (var s = 0; s < 7; s++) SL.gun.push(Rt(0.0252, 0.022, 0.0016, 3e-4, 0, 0.012, -0.055 + s * 0.0045, [0.3, 0.3, 0.32]));
  SL.gun.push(Rt(0.011, 0.0012, 0.034, 5e-4, 0.003, 0.0312, 0.035, [0.1, 0.1, 0.1]));
  SL.ano.push(Rt(0.0035, 0.007, 0.006, 0.001, 0, 0.0345, 0.152, SXA_ONE, 2));
  SL.plain.push(Rt(0.0018, 0.0018, 0.001, 3e-4, 0, 0.0352, 0.1555, [6, 6, 6]));
  SL.ano.push(Rt(0.021, 0.006, 0.009, 0.001, 0, 0.0335, -0.045, SXA_ONE, 2));
  SL.ano.push(Rt(0.0068, 0.005, 0.009, 0.001, -0.0071, 0.0385, -0.045, SXA_ONE, 2));
  SL.ano.push(Rt(0.0068, 0.005, 0.009, 0.001, 0.0071, 0.0385, -0.045, SXA_ONE, 2));
  // magazine along the grip axis (only the base plate shows until reload)
  MG.poly.push(Rt(0.021, 0.115, 0.03, 0.002, 0, -0.103, -0.071, [0.8, 0.8, 0.8], 0, [-0.237, 0, 0]));
  MG.poly.push(Rt(0.03, 0.009, 0.052, 0.0025, 0, -0.1605, -0.087, [0.9, 0.9, 0.9], 0.3, [-0.13, 0, 0]));
  MG.brass.push(SXA_vlathe([[0, -0.004], [0.0045, -0.004], [0.0045, 0.006], [0.003, 0.01], [0, 0.011]], 10, SXA_ONE).rotateX(-1.57).translate(0, -0.0455, 0.06));
  return {
    parts: { body: S, slide: SL, mag: MG, trigger: trig },
    muzzle: [0, 0.0135, -0.168], eject: [0.012, 0.031, -0.035], sightY: 0.0375,
    hip: { p: [0.07, -0.068, -0.35], r: [0.07, 0.12, -0.05] },
    ads: { p: [0, -0.0375, -0.27], r: [0, 0, 0] },
    sprint: { p: [-0.025, -0.05, 0.035], r: [0.62, 0.05, 0.14] },
    reload: { p: [-0.025, 0.05, 0.03], r: [0.36, 0.26, -0.38] },
    magAxis: [0, -0.972, 0.235],
  };
}

function SXA_sniperGeo() {
  var S = SXA_bucket(), B = SXA_bucket(), MG = SXA_bucket(), trig = SXA_bucket();
  // receiver with the trigger-group bump, round action on top, rail
  S.ano.push(xr([[-0.11, -0.05], [-0.05, -0.05], [-0.046, -0.058], [0.036, -0.058], [0.045, -0.05], [0.16, -0.05], [0.16, 0.012], [0.15, 0.022], [-0.095, 0.022], [-0.11, 0.01]], -0.0185, 0.0185, 0.0025, SXA_ONE, 5));
  S.gun.push(Cn([[0, -0.09], [0.017, -0.09], [0.017, 0.15], [0, 0.15]], 18, [2.2, 2.2, 2.3], 2, 0, 0.012));
  S.ano.push(qo([[-0.011, 0.028], [0.011, 0.028], [0.011, 0.036], [-0.011, 0.036]], -0.08, 0.14, 5e-4, SXA_ONE, 2));
  for (var k = 0; k < 12; k++) S.ano.push(Rt(0.024, 0.004, 0.005, 0.001, 0, 0.037, -0.075 + k * 0.018, SXA_ONE, 1));
  // heavy barrel + muzzle brake with ports
  S.gun.push(Cn([[0, 0.15], [0.0135, 0.15], [0.0125, 0.45], [0.0105, 0.76], [0, 0.76]], 16, [2.4, 2.4, 2.5], 2, 0, 0.012));
  S.ano.push(Cn([[0, 0.76], [0.016, 0.76], [0.016, 0.83], [0.012, 0.834], [0, 0.834]], 14, SXA_ONE, 3, 0, 0.012));
  for (var q = 0; q < 3; q++) S.plain.push(Rt(0.035, 0.008, 0.008, 0.002, 0, 0.012, 0.775 + q * 0.019, [0.04, 0.04, 0.04]));
  S.plain.push(Cn([[0, 0.8342], [0.0065, 0.8342], [0.0065, 0.8344], [0, 0.8344]], 12, [0.02, 0.02, 0.02], 0, 0, 0.012));
  // free-float handguard (tan), cheek riser, stock + pad, folded bipod
  S.tan.push(qo([[-0.011, -0.02], [0.011, -0.02], [0.026, -0.006], [0.026, 0.018], [0.011, 0.032], [-0.011, 0.032], [-0.026, 0.018], [-0.026, -0.006]], 0.16, 0.52, 0.004, SXA_ONE, 0.5));
  for (var v = 0; v < 6; v++) S.plain.push(Rt(0.0012, 0.012, 0.03, 4e-4, 0.0262, 0.008, 0.2 + v * 0.05, [0.08, 0.08, 0.08]));
  S.tan.push(xr([[-0.1, 0.022], [-0.1, -0.044], [-0.118, -0.05], [-0.24, -0.098], [-0.252, -0.098], [-0.258, -0.06], [-0.254, 0.02], [-0.24, 0.028], [-0.13, 0.026]], -0.017, 0.017, 0.004, SXA_ONE, 0.5));
  S.poly.push(Rt(0.026, 0.018, 0.1, 0.006, 0, 0.037, -0.18, [0.8, 0.8, 0.8], 0.3));
  S.poly.push(Rt(0.036, 0.13, 0.016, 0.006, 0, -0.036, -0.262, [0.55, 0.55, 0.55], 0.3, [0.1, 0, 0]));
  S.gun.push(Rt(0.006, 0.006, 0.16, 0.002, -0.012, -0.03, 0.4, [1.4, 1.4, 1.4]));
  S.gun.push(Rt(0.006, 0.006, 0.16, 0.002, 0.012, -0.03, 0.4, [1.4, 1.4, 1.4]));
  S.ano.push(Rt(0.04, 0.012, 0.02, 0.003, 0, -0.024, 0.49, SXA_ONE, 2));
  SXA_lower(S);
  trig.gun.push(xr(SXA_TRIGGER, -0.00275, 0.00275, 8e-4, [5.5, 5.5, 5.7], 0));
  // bolt: shroud at the back + handle with a ball knob (rotates up, slides back)
  B.gun.push(Cn([[0, -0.115], [0.0128, -0.115], [0.0128, -0.088], [0, -0.088]], 12, [3, 3, 3.1], 0, 0, 0.012));
  B.gun.push(Rt(0.04, 0.007, 0.007, 0.002, 0.03, 0.012, -0.07, [2.4, 2.4, 2.5]));
  var knob = new lt.SphereGeometry(0.0095, 12, 8).translate(0.052, 0.01, 0.07);
  B.poly.push(knob);
  // detachable box magazine
  MG.poly.push(Rt(0.024, 0.06, 0.068, 0.003, 0, -0.08, 0.075, [0.85, 0.85, 0.85], 0.2));
  return {
    parts: { body: S, bolt: B, mag: MG, trigger: trig },
    muzzle: [0, 0.012, -0.838], eject: [0.026, 0.022, -0.03], sightY: 0.076,
    hip: { p: [0.108, -0.12, -0.3], r: [0.03, 0.08, -0.03] },
    ads: { p: [0, -0.076, -0.21], r: [0, 0, 0] },
    sprint: { p: [-0.035, 0.004, 0.03], r: [-0.04, 0.62, 0.26] },
    reload: { p: [-0.025, 0.045, 0.03], r: [0.32, 0.22, -0.32] },
    leftOffset: [0, 0, -0.105], magAxis: [0, -1, 0],
  };
}

// Attachment meshes, built at the mount (local viewmodel coords).
function SXA_attGeo(id, mount) {
  var b = SXA_bucket(), at = mount.at, x = at[0], y = at[1], z = at[2];
  var fwd = -z, lens = [0.05, 0.09, 0.14], dark = [0.06, 0.06, 0.065];
  var tube = function (r0, len, cy, c, f0) {
    // a sealed tube along the bore at height cy above the mount, from fwd f0 for len
    return Cn([[0, f0], [r0, f0], [r0, f0 + len], [0, f0 + len]], 18, c || SXA_ONE, 2, x, cy);
  };
  if (id === 'x4' || id === 'x8') {
    var big = id === 'x8', line = mount.line != null ? mount.line : y + SXA_ATT[id].above;
    var len = mount.magnifier ? 0.085 : big ? 0.24 : 0.15, f0 = fwd - len * 0.55, r = big ? 0.0165 : 0.0155;
    b.ano.push(tube(r, len, line, null, f0));
    // objective bell + eyepiece
    b.ano.push(Cn([[0, f0 + len], [r, f0 + len], [big ? 0.026 : 0.021, f0 + len + 0.04], [big ? 0.026 : 0.021, f0 + len + 0.07], [0, f0 + len + 0.07]], 18, SXA_ONE, 2, x, line));
    b.ano.push(Cn([[0, f0 - 0.05], [0.02, f0 - 0.05], [0.02, f0 - 0.005], [r, f0], [0, f0]], 18, SXA_ONE, 2, x, line));
    b.plain.push(Cn([[0, f0 + len + 0.0702], [big ? 0.022 : 0.018, f0 + len + 0.0702], [big ? 0.022 : 0.018, f0 + len + 0.0704], [0, f0 + len + 0.0704]], 16, lens, 0, x, line));
    b.plain.push(Cn([[0, f0 - 0.0504], [0.016, f0 - 0.0504], [0.016, f0 - 0.0502], [0, f0 - 0.0502]], 16, lens, 0, x, line));
    // turrets + rings / magnifier mount
    b.ano.push(Rt(0.018, 0.016, 0.018, 0.004, x, line + r + 0.006, f0 + len * 0.5, SXA_ONE, 2));
    b.ano.push(Rt(0.016, 0.018, 0.016, 0.004, x + r + 0.006, line, f0 + len * 0.5, SXA_ONE, 2));
    var ringH = line - y;
    b.ano.push(Rt(0.022, ringH, 0.012, 0.003, x, y + ringH / 2, f0 + len * 0.18, SXA_ONE, 2));
    b.ano.push(Rt(0.022, ringH, 0.012, 0.003, x, y + ringH / 2, f0 + len * 0.82, SXA_ONE, 2));
  } else if (id === 'reddot') {
    b.ano.push(Rt(0.022, 0.006, 0.034, 0.002, x, y + 0.003, fwd, SXA_ONE, 2));
    // the hood: a frame round the window (open front and back)
    b.ano.push(Rt(0.003, 0.026, 0.006, 0.001, x - 0.0095, y + 0.018, fwd + 0.012, SXA_ONE, 2));
    b.ano.push(Rt(0.003, 0.026, 0.006, 0.001, x + 0.0095, y + 0.018, fwd + 0.012, SXA_ONE, 2));
    b.ano.push(Rt(0.022, 0.0025, 0.006, 0.001, x, y + 0.0298, fwd + 0.012, SXA_ONE, 2));
    b.ano.push(Rt(0.022, 0.006, 0.006, 0.002, x, y + 0.008, fwd + 0.012, SXA_ONE, 2));
    b.glass.push(Rt(0.016, 0.018, 0.0015, 5e-4, x, y + 0.02, fwd + 0.011, [1, 0.78, 0.62]));
    b.ret.push.apply(b.ret, SXA_reticle('reddot', x, y + SXA_ATT.reddot.above, -(fwd + 0.011) + 0.0012));
  } else if (id === 'holo') {
    b.ano.push(Rt(0.03, 0.008, 0.05, 0.003, x, y + 0.004, fwd, SXA_ONE, 2));
    b.ano.push(Rt(0.004, 0.03, 0.04, 0.0015, x - 0.014, y + 0.022, fwd, SXA_ONE, 2));
    b.ano.push(Rt(0.004, 0.03, 0.04, 0.0015, x + 0.014, y + 0.022, fwd, SXA_ONE, 2));
    b.ano.push(Rt(0.032, 0.004, 0.04, 0.0015, x, y + 0.038, fwd, SXA_ONE, 2));
    b.glass.push(Rt(0.024, 0.026, 0.0015, 5e-4, x, y + 0.023, fwd + 0.017, [0.62, 0.9, 0.85]));
    b.ret.push.apply(b.ret, SXA_reticle('holo', x, y + SXA_ATT.holo.above, -(fwd + 0.017) + 0.0012));
  } else if (id === 'supp') {
    b.ano.push(Cn([[0, fwd], [0.0175, fwd], [0.0175, fwd + 0.17], [0.013, fwd + 0.176], [0, fwd + 0.176]], 18, SXA_ONE, 3, x, y));
    b.plain.push(Cn([[0, fwd + 0.1762], [0.006, fwd + 0.1762], [0.006, fwd + 0.1764], [0, fwd + 0.1764]], 12, [0.02, 0.02, 0.02], 0, x, y));
  } else if (id === 'comp') {
    b.ano.push(Cn([[0, fwd], [0.0125, fwd], [0.0125, fwd + 0.05], [0.01, fwd + 0.053], [0, fwd + 0.053]], 14, SXA_ONE, 3, x, y));
    for (var k = 0; k < 3; k++) b.plain.push(Rt(0.004, 0.006, 0.008, 0.001, x, y + 0.011, fwd + 0.01 + k * 0.013, dark));
  } else if (id === 'grip') {
    b.poly.push(Rt(0.018, 0.058, 0.026, 0.007, x, y - 0.03, fwd, SXA_ONE, 0.4, [-0.12, 0, 0]));
  } else if (id === 'extmag') {
    if (mount.tube) b.ano.push(Cn([[0, fwd], [0.0127, fwd], [0.0127, fwd + 0.07], [0.009, fwd + 0.076], [0, fwd + 0.076]], 16, SXA_ONE, 3, x, y));
    else b.poly.push(Rt(0.026, 0.034, 0.052, 0.003, x, y - 0.016, fwd, [0.9, 0.9, 0.9], 0.3));
  }
  return b;
}

function SXA_viewMats(G) {
  var mk = function (name, color, rough, metal, kind) {
    var m = new lt.MeshStandardMaterial({ color: color, roughness: rough, metalness: metal, vertexColors: true });
    m.name = name;
    if (kind >= 0) Bf(m, kind);
    return m;
  };
  return {
    ano: mk('sxa_anodised', new lt.Color(0.0085, 0.009, 0.0105), 0.4, 0.45, 0),
    gun: mk('sxa_phosphate', new lt.Color(0.016, 0.016, 0.0165), 0.5, 0.7, 1),
    poly: mk('sxa_polymer', new lt.Color(0.0125, 0.0128, 0.0135), 0.62, 0, 2),
    tan: mk('sxa_polymer_tan', new lt.Color(0.105, 0.08, 0.05), 0.62, 0, 2),
    plain: mk('sxa_matte', new lt.Color(1, 1, 1), 0.92, 0, -1),
    brass: G.mats.get('brass', { triplanar: true, vertexColors: true, scale: 4 }),
    glove: G.mats.get('glove_fabric', { triplanar: true, vertexColors: true, scale: 3 }),
    // reflex sights: see-through tinted glass, and the aiming mark (unlit, bright)
    glass: (function () { var m = new lt.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, depthWrite: false }); m.name = 'sxa_glass'; return m; })(),
    ret: (function () { var m = new lt.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false, side: lt.DoubleSide }); m.name = 'sxa_reticle'; return m; })(),
  };
}

// The PAC-9 gloves (same Vv parameters), built once and shared.
function SXA_hands() {
  var dirIn = function (q, v, mirror) {
    var o = new lt.Vector3(v[0], v[1], v[2]).normalize().applyQuaternion(q.clone().invert());
    if (mirror) o.x *= -1;
    return [o.x, o.y, o.z];
  };
  var rq = i0(-0.24, 0, 0).multiply(i0(0, 0, -Math.PI / 2));
  var right = Vv({ mirror: false, fingers: [null, [0.62, 1.72, 0.8, 0], [0.68, 1.7, 0.8, -0.03], [0.74, 1.66, 0.8, -0.09]], indexPoses: [[0.1, 0.16, 0.1, 0.05], [0.46, 1.15, 0.5, 0]], thumb: [dirIn(rq, [-0.85, 0.05, -0.5]), dirIn(rq, [-0.6, -0.05, -0.8]), dirIn(rq, [-0.05, -0.2, -0.97])], forearm: dirIn(rq, [0.27, -0.44, 0.86]), sleeve: 0.34 });
  var lq = i0(0, 0, Math.PI / 2).multiply(i0(0.06, 0, 0));
  var left = Vv({ mirror: true, fingers: [[1.27, 1.42, 0.75, 0.02], [1.3, 1.45, 0.75, 0], [1.3, 1.45, 0.75, -0.02], [1.33, 1.45, 0.75, -0.05]], thumb: [dirIn(lq, [0, 0.25, -0.97], true), dirIn(lq, [0.05, 0.1, -0.99], true), dirIn(lq, [0, 0, -1], true)], forearm: dirIn(lq, [-0.5, -0.35, 0.79], true), sleeve: 0.34 });
  var rpos = new lt.Vector3(0, -0.1, 0.073).sub(new lt.Vector3(0.006, -0.031, -0.085).applyQuaternion(rq));
  var lpos = new lt.Vector3(-0.015, -0.062, -0.236).sub(new lt.Vector3(0, -0.015, -0.055).applyQuaternion(lq));
  return { rq: rq, rpos: rpos, right: right, lq: lq, lpos: lpos, left: left };
}

function SXA_addParts(group, bucket, mats, mk) {
  for (var key in bucket) {
    if (!bucket[key].length) continue;
    var geo = Ii(bucket[key]);
    geo.computeBoundingSphere();
    group.add(mk(geo, mats[key]));
  }
}

function SXA_vmMesh(geo, mat) {
  var m = new lt.Mesh(geo, mat);
  m.castShadow = false;
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------------------
// A viewmodel gun (shotgun or pistol) with the same API as the PAC-9 object.
// ---------------------------------------------------------------------------
function SXA_makeGun(G, kind, geo, mats, hands, rng) {
  var T = SXA_TUNE[kind];
  var root = new lt.Group();
  root.name = 'viewmodel-' + kind;
  var trigger = new lt.Group(), mover = new lt.Group();
  if (geo.model && !geo.model.build) {
    // the pump-shotgun model: body, trigger and pump (forend) meshes
    var addModel = function (group, list) {
      list.forEach(function (gg) { var m = SXA_vmMesh(gg, geo.model.mat); m.position.fromArray(geo.model.offset); group.add(m); });
    };
    addModel(root, geo.model.body);
    if (geo.model.marks) geo.model.marks.geos.forEach(function (gg) { var m = SXA_vmMesh(gg, geo.model.marks.mat); m.position.fromArray(geo.model.offset); m.renderOrder = 2; root.add(m); });
    addModel(trigger, geo.model.trigger);
    addModel(mover, geo.model.pump);
  } else {
    SXA_addParts(root, geo.parts.body, mats, SXA_vmMesh);
    SXA_addParts(trigger, geo.parts.trigger, mats, SXA_vmMesh);
    SXA_addParts(mover, geo.parts.pump || geo.parts.slide || geo.parts.bolt, mats, SXA_vmMesh);
  }
  root.add(trigger);
  root.add(mover);
  // attachment mounts (meshes are added by the arsenal when attachments change)
  var attRoot = new lt.Group(), attMover = new lt.Group(), attMag = new lt.Group();
  root.add(attRoot); mover.add(attMover);
  var mag = null;
  if (geo.parts.mag || (geo.model && geo.model.magNodes)) {
    mag = new lt.Group();
    if (geo.parts.mag) SXA_addParts(mag, geo.parts.mag, mats, SXA_vmMesh);
    root.add(mag);
    mag.add(attMag);
  }
  if (geo.model && geo.model.build) {
    // a whole model (the Desert Eagle): its nodes keep their place and move
    // into the slide / magazine / trigger groups
    var hold = geo.model.build();
    root.add(hold);
    root.updateMatrixWorld(true);
    var into = function (group, names) { (names || []).forEach(function (n) { var o = hold.getObjectByName(n); if (o && group) group.attach(o); }); };
    into(mover, geo.model.moverNodes);
    into(mag, geo.model.magNodes);
    into(trigger, geo.model.triggerNodes);
    hold.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; } });
    mover.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  }
  // right glove + its trigger finger (morphs between the two index poses)
  var rh = new lt.Group();
  rh.quaternion.copy(hands.rq);
  rh.position.copy(hands.rpos);
  if (geo.rightGrip) {
    // turn the glove about its palm contact point and move that point onto the new grip
    var RG = geo.rightGrip, rgq = new lt.Quaternion().setFromEuler(new lt.Euler(RG.rot[0], RG.rot[1], RG.rot[2]));
    rh.quaternion.premultiply(rgq);
    rh.position.sub(new lt.Vector3().fromArray(RG.from)).applyQuaternion(rgq).add(new lt.Vector3().fromArray(RG.to));
  }
  rh.add(SXA_vmMesh(hands.right.fabric, mats.glove));
  var finger = SXA_vmMesh(hands.right.index[0].clone(), mats.glove);
  rh.add(finger);
  root.add(rh);
  var idxA = hands.right.index[0].attributes, idxB = hands.right.index[1].attributes, fingerLast = -1;
  function setFinger(v) {
    if (Math.abs(v - fingerLast) < 4e-3) return;
    fingerLast = v;
    var p = finger.geometry.attributes.position, n = finger.geometry.attributes.normal;
    var a = idxA.position.array, b = idxB.position.array, na = idxA.normal.array, nb = idxB.normal.array;
    for (var k = 0; k < a.length; k++) { p.array[k] = a[k] + (b[k] - a[k]) * v; n.array[k] = na[k] + (nb[k] - na[k]) * v; }
    p.needsUpdate = true;
    n.needsUpdate = true;
  }
  var lh = null, lhBase = null;
  if (geo.leftOffset) {
    lh = new lt.Group();
    lh.add(SXA_vmMesh(hands.left.fabric, mats.glove));
    lh.quaternion.copy(hands.lq);
    lhBase = hands.lpos.clone().add(new lt.Vector3().fromArray(geo.leftOffset));
    lh.position.copy(lhBase);
    root.add(lh);
  }
  var flash = N_();
  flash.position.fromArray(geo.muzzle);
  flash.visible = false;
  root.add(flash);
  root.traverse(function (o) { o.layers.set(zc); });
  root.visible = false;
  G.camera.add(root);

  var S;
  function springs() {
    return { kZ: pa(520, 30), kP: pa(380, 26), kY: pa(300, 22), kR: pa(300, 20), swY: pa(110, 15), swP: pa(110, 15), jY: pa(140, 13), jP: pa(140, 13), bump: pa(600, 30) };
  }
  function freshState() {
    S = Object.assign({ t: 0, cool: 0, prevFire: false, dryDone: false, autoReload: -1, reload: null, adsLin: 0, adsE: 0, sprintT: 0, reloadW: 0, bloom: 0, spreadS: T.spreadHip, bobPhase: 0, bobAmt: 0, finger: 0, flashT: 0, flashDur: 0.05, wasGround: true, lastVy: 0, pumpT: 9, pumpF: {}, slideT: 9, slideLocked: false, queued: 0, magOff: 0 }, springs());
  }
  freshState();

  var api = {
    kind: kind, name: T.name, short: T.short, ammo: T.mag, magSize: T.mag, reserve: T.reserve,
    maxReserve: T.maxReserve, state: 'idle', ads: 0, spread: T.spreadHip, damage: T.damage,
    rpm: kind === 'pistol' ? Math.round(60 / T.interval) : Math.round(60 / (T.pump || T.bolt)), root: root,
    blockFire: false, debug: { noFire: false }, info: {},
    geo: geo, mounts: { root: attRoot, mover: attMover, mag: attMag },
    mods: { recoil: 1, yaw: 1, spread: 1, flash: 1, gain: 1, pitch: 1, hear: 0 },
    update: update, reset: reset, snap: snap, muzzleWorld: muzzleWorld, reloadNow: reloadNow,
    setVisible: function (v) { root.visible = !!v; },
    addAmmo: function (n) { api.reserve = Math.min(api.maxReserve, api.reserve + n); },
    setWetness: function () {},
    holster: function () {
      // A swap cancels a half-done reload of this gun (the PAC-9 keeps its own).
      if (S.reload) { S.reload = null; S.reloadW = 0; if (mag) { mag.visible = true; mag.position.set(0, 0, 0); } }
      S.prevFire = true;
    },
  };

  var tmpA = new lt.Vector3(), tmpB = new lt.Vector3(), tmpDir = new lt.Vector3(), tmpEye = new lt.Vector3(), tmpVel = new lt.Vector3();
  function toWorld(local, out) {
    root.updateMatrix();
    out.fromArray(local).applyMatrix4(root.matrix);
    var cam = G.camera, k = Math.tan(cam.fov * Math.PI / 360) / Math.tan(G.viewCamera.fov * Math.PI / 360);
    out.x *= k;
    out.y *= k;
    return out.applyQuaternion(cam.quaternion).add(cam.position);
  }
  function muzzleWorld(out) { return toWorld(geo.muzzle, out || new lt.Vector3()); }

  function snd(name, o) { try { G.audio && G.audio.play && G.audio.play(name, o || {}); } catch (e) { } }

  function eject() {
    var fx = G.fx;
    if (!fx || !fx.shell) return;
    toWorld(geo.eject, tmpA);
    tmpVel.set(1.6 + rng() * 1.1, 1.1 + rng() * 0.8, 0.4 - rng() * 0.6).applyQuaternion(G.camera.quaternion);
    if (G.player && G.player.vel) tmpVel.add(G.player.vel);
    fx.shell(tmpA, tmpVel);
  }

  function shoot() {
    var P = G.player, cam = G.camera;
    tmpEye.copy(P.eye || cam.position);
    muzzleWorld(tmpB);
    var stats = G.combat && G.combat.stats, s0 = stats ? stats.shots : 0, h0 = stats ? stats.hits : 0;
    var pellets = kind === 'shotgun' ? T.pellets : 1;
    var spread = api.spread;
    for (var k = 0; k < pellets; k++) {
      var a = rng() * Math.PI * 2, r = Math.tan(spread) * (pellets > 1 ? Math.sqrt(0.15 + 0.85 * rng()) : Math.sqrt(rng()));
      tmpDir.set(Math.cos(a) * r, Math.sin(a) * r, -1).normalize().applyQuaternion(cam.quaternion);
      var hit = null;
      try { hit = G.combat.playerShot(tmpEye, tmpDir, { damage: T.damage, range: T.range }); } catch (e) { }
      if (G.fx && G.fx.tracer && (k === 0 || k % 3 === 1)) {
        tmpA.copy(hit && hit.point ? hit.point : tmpA.copy(tmpEye).addScaledVector(tmpDir, T.range));
        G.fx.tracer(tmpB, tmpA);
      }
    }
    // a shotgun blast is one shot for the accuracy rating, not nine
    if (stats && pellets > 1) { stats.shots = s0 + 1; stats.hits = h0 + (stats.hits > h0 ? 1 : 0); }
    api.ammo--;
    var md = api.mods;
    try { G.render && G.render.lightPool && G.render.lightPool.flash(tmpB, 16756832, (kind === 'shotgun' ? 80 : kind === 'sniper' ? 70 : 38) * md.flash, kind === 'pistol' ? 8 : 12, 0.055); } catch (e) { }
    G.events.emit('weapon:fire', { origin: tmpEye, dir: tmpDir, muzzle: tmpB, ads: S.adsE, pitch: T.pitch * md.pitch, gain: T.gain * md.gain, hear: md.hear || 0, weapon: kind });
    var ads = S.adsE, crouch = P.crouching ? 0.8 : 1, side = rng() - 0.5, rk = md.recoil;
    if (kind === 'shotgun') {
      P.addRecoil && P.addRecoil(0.052 * bi(1, 0.8, ads) * crouch * rk, side * 0.018 * md.yaw);
      P.addShake && P.addShake(0.5 * crouch);
      S.kZ.v += 5.2 * bi(1, 0.7, ads); S.kP.v += 6.4 * crouch * rk; S.kY.v += side * 1.6; S.kR.v += side * 3;
      S.pumpT = api.ammo > 0 ? 0 : 9;
      S.pumpF = {};
      S.cool = api.ammo > 0 ? T.pump : 0.25;
    } else if (kind === 'sniper') {
      P.addRecoil && P.addRecoil(0.075 * bi(1, 0.85, ads) * crouch * rk, side * 0.02 * md.yaw);
      P.addShake && P.addShake(0.55 * crouch);
      S.kZ.v += 6 * bi(1, 0.8, ads); S.kP.v += 7 * crouch * rk; S.kY.v += side * 1.6; S.kR.v += side * 2.2;
      S.boltT = api.ammo > 0 ? 0 : 9;
      S.boltF = {};
      S.cool = api.ammo > 0 ? T.bolt : 0.3;
    } else {
      P.addRecoil && P.addRecoil(0.021 * bi(1, 0.75, ads) * crouch * rk, side * 0.006 * md.yaw);
      P.addShake && P.addShake(0.16 * crouch);
      S.kZ.v += 1.9 * bi(1, 0.6, ads); S.kP.v += 4.6 * crouch * rk; S.kY.v += side * 1; S.kR.v += side * 1.6;
      S.slideT = 0;
      S.cool = T.interval;
      eject();
      if (api.ammo <= 0) S.slideLocked = true;
    }
    S.bloom = Math.min(1, S.bloom + (kind === 'shotgun' ? 0.5 : kind === 'sniper' ? 0.8 : 0.36));
    S.flashT = S.flashDur = kind === 'pistol' ? 0.05 + rng() * 0.02 : 0.07;
    var u = flash.material.uniforms;
    u.uSeed.value = rng() * 100;
    u.uJet.value = 0.6 + rng() * 0.6;
    flash.rotation.z = (rng() - 0.5) * 0.4;
    var sc = (kind === 'shotgun' ? 1.55 : kind === 'sniper' ? 1.4 : 0.75) * (0.8 + rng() * 0.4) * bi(1, 0.62, ads) * md.flash;
    flash.scale.set(sc, sc, sc * (0.8 + rng() * 0.5));
  }

  function reloadNow() {
    if (S.reload || api.ammo >= api.magSize || api.reserve <= 0) return false;
    var empty = api.ammo <= 0;
    S.reload = kind === 'shotgun' ? { t: 0, phase: 'start', empty: empty, n: 0 } : { t: 0, T: empty ? T.reloadEmpty : T.reload, empty: empty, f: {} };
    S.autoReload = -1;
    G.events.emit('weapon:reload', { phase: 'start', empty: empty, weapon: kind });
    return true;
  }

  function updatePistolReload(dt) {
    var R = S.reload;
    R.t += dt;
    var t = R.t;
    var once = function (key, at) { if (t >= at && !R.f[key]) { R.f[key] = 1; return true; } return false; };
    if (once('out', 0.3)) { G.events.emit('weapon:reload', { phase: 'magout', empty: R.empty, weapon: kind }); S.bump.v -= 0.2; }
    if (once('in', 0.92)) {
      G.events.emit('weapon:reload', { phase: 'magin', empty: R.empty, weapon: kind });
      S.bump.v += 0.45;
      var need = Math.min(api.magSize - api.ammo, api.reserve);
      api.ammo += need; api.reserve -= need;
    }
    // the sniper chambers the first round with a full bolt cycle (no case comes out)
    if (R.empty && kind === 'sniper' && once('boltcyc', R.T - 0.82)) { S.boltT = 0.24; S.boltF = { shell: 1 }; }
    if (R.empty && once('slide', R.T - 0.46)) { G.events.emit('weapon:reload', { phase: 'bolt', empty: true, weapon: kind }); S.slideLocked = false; S.slideT = 0.03; S.kZ.v -= 0.4; }
    // mag drops out along the grip, a fresh one comes back up
    S.magOff = t < 0.3 ? 0 : t < 0.5 ? Yo((t - 0.3) / 0.2) : t < 0.7 ? 1 : t < 0.92 ? 1 - Yo((t - 0.7) / 0.22) : 0;
    S.reloadW = Math.min(Yo(t / 0.3), 1 - Yo((t - (R.T - 0.42)) / 0.38));
    if (t >= R.T) { S.reload = null; S.reloadW = 0; S.magOff = 0; G.events.emit('weapon:reload', { phase: 'done', weapon: kind }); }
  }

  function updateShotgunReload(dt, firePressed) {
    var R = S.reload;
    R.t += dt;
    if (R.phase === 'start') {
      if (R.t >= T.shellStart) { R.phase = 'shell'; R.t = 0; R.done = false; }
    } else if (R.phase === 'shell') {
      if (!R.done && R.t >= 0.27) {
        R.done = true;
        if (api.reserve > 0 && api.ammo < api.magSize) {
          api.ammo++; api.reserve--; R.n++;
          snd('reload_magin', { gain: 0.75, pitch: 1.45 });
          S.bump.v += 0.32; S.kR.v += 0.4;
        }
      }
      if (R.t >= T.shellEach) {
        var more = api.ammo < api.magSize && api.reserve > 0 && !(firePressed && api.ammo > 0);
        if (more) { R.t = 0; R.done = false; } else { R.phase = 'end'; R.t = 0; }
      }
    } else if (R.phase === 'end') {
      if (R.t >= T.shellEnd) {
        S.reload = null;
        G.events.emit('weapon:reload', { phase: 'done', weapon: kind });
        if (R.empty) { S.pumpT = 0; S.pumpF = {}; S.cool = T.pump * 0.75; }
      }
    }
    var inW = R.phase === 'start' ? Yo(R.t / T.shellStart) : R.phase === 'end' ? 1 - Yo(R.t / T.shellEnd) : 1;
    S.reloadW = S.reload ? inW : 0;
  }

  function pumpOffset(t) {
    if (t < 0.1) return 0;
    if (t < 0.23) return Yo((t - 0.1) / 0.13);
    if (t < 0.29) return 1;
    if (t < 0.42) return 1 - Yo((t - 0.29) / 0.13);
    return 0;
  }

  function update(dt) {
    var P = G.player, inp = G.input;
    if (!P || !inp || !P.alive) { S.prevFire = false; flash.visible = false; return; }
    S.t += dt;
    var held = !!inp.fire && root.visible && !api.blockFire && !api.debug.noFire;
    var pressed = held && !S.prevFire;
    S.prevFire = held;
    if (!held) S.dryDone = false;
    if (pressed) S.queued = 0.18;
    S.queued = Math.max(0, S.queued - dt);
    var sprintWant = !!P.sprinting && !held && !inp.ads && !S.reload;
    S.sprintT = kn(S.sprintT, sprintWant ? 1 : 0, 9, dt);
    if (inp.pressed && inp.pressed('reload')) reloadNow();
    if (S.autoReload >= 0) { S.autoReload -= dt; if (S.autoReload < 0) reloadNow(); }

    if (S.reload) {
      if (kind === 'shotgun') updateShotgunReload(dt, pressed || S.queued > 0);
      else updatePistolReload(dt);
    }
    S.cool -= dt;
    var canFire = !S.reload && S.sprintT < 0.45 && S.cool <= 0 && !api.blockFire;
    if (S.queued > 0 && canFire) {
      if (api.ammo > 0) { S.queued = 0; shoot(); }
      else if (!S.dryDone) {
        S.dryDone = true; S.queued = 0;
        G.events.emit('weapon:dry', { weapon: kind });
        S.bump.v -= 0.08;
        if (api.reserve > 0) S.autoReload = 0.3;
      }
    }

    // pump-action cycle
    if (kind === 'shotgun') {
      S.pumpT += dt;
      if (S.pumpT >= 0.12 && !S.pumpF.back) { S.pumpF.back = 1; snd('reload_bolt', { gain: 0.9, pitch: 1.12 }); S.kP.v += 0.6; }
      if (S.pumpT >= 0.25 && !S.pumpF.shell) { S.pumpF.shell = 1; eject(); }
      if (S.pumpT >= 0.36 && !S.pumpF.fwd) { S.pumpF.fwd = 1; snd('reload_magout', { gain: 0.7, pitch: 1.55 }); S.bump.v += 0.2; }
      var po = pumpOffset(S.pumpT);
      var travel = geo.pumpTravel || 0.075;
      mover.position.z = travel * po;
      if (lh) lh.position.set(lhBase.x, lhBase.y, lhBase.z + travel * po);
    } else if (kind === 'sniper') {
      S.boltT = (S.boltT == null ? 9 : S.boltT) + dt
      S.boltF = S.boltF || {}
      var bt2 = S.boltT, up = 0, back = 0;
      if (bt2 >= 0.28 && bt2 < 0.9) {
        up = bt2 < 0.38 ? Yo((bt2 - 0.28) / 0.1) : bt2 < 0.8 ? 1 : 1 - Yo((bt2 - 0.8) / 0.1);
        back = bt2 < 0.4 ? 0 : bt2 < 0.55 ? Yo((bt2 - 0.4) / 0.15) : bt2 < 0.62 ? 1 : bt2 < 0.77 ? 1 - Yo((bt2 - 0.62) / 0.15) : 0;
      }
      if (bt2 >= 0.3 && !S.boltF.up) { S.boltF.up = 1; snd('reload_bolt', { gain: 0.95, pitch: 0.85 }); }
      if (bt2 >= 0.55 && !S.boltF.shell) { S.boltF.shell = 1; eject(); }
      if (bt2 >= 0.76 && !S.boltF.fwd) { S.boltF.fwd = 1; snd('reload_magout', { gain: 0.8, pitch: 1.2 }); S.bump.v += 0.15; }
      mover.rotation.z = 1.05 * up;
      mover.position.z = 0.085 * back;
      if (mag) {
        var axs = geo.magAxis;
        mag.position.set(axs[0] * 0.15 * S.magOff, axs[1] * 0.15 * S.magOff, axs[2] * 0.15 * S.magOff);
        mag.visible = S.magOff < 0.96;
      }
    } else {
      S.slideT += dt;
      var sb = S.slideT < 0.065 ? Math.sin(Math.PI * S.slideT / 0.065) : 0;
      mover.position.z = 0.034 * (S.slideLocked ? Math.max(sb, 0.9) : sb);
      if (mag) {
        var ax = geo.magAxis;
        mag.position.set(ax[0] * 0.15 * S.magOff, ax[1] * 0.15 * S.magOff, ax[2] * 0.15 * S.magOff);
        mag.visible = S.magOff < 0.96;
      }
    }

    // aim, spread, bloom
    var wantAds = !!inp.ads && !S.reload && S.sprintT < 0.35;
    S.adsLin = Zn(S.adsLin + (wantAds ? dt : -dt) / (kind === 'pistol' ? 0.14 : kind === 'sniper' ? 0.27 : 0.2), 0, 1);
    S.adsE = Yo(S.adsLin);
    api.ads = S.adsE;
    var speed = P.speed || 0, mv = Fo(speed / 6), air = P.onGround === false;
    S.bloom = Math.max(0, S.bloom - dt * (kind === 'shotgun' ? 1.4 : 2.4));
    var spread = kind === 'shotgun'
      ? bi(T.spreadHip, T.spreadAds, S.adsE) + mv * 0.008 + (air ? 0.012 : 0) + S.bloom * 0.006
      : kind === 'sniper'
        ? bi(T.spreadHip, T.spreadAds, S.adsE) + mv * bi(0.03, 0.012, S.adsE) + S.bloom * 0.01 + (air ? 0.06 : 0) - (P.crouching ? 0.0002 : 0)
        : bi(T.spreadHip, T.spreadAds, S.adsE) + mv * bi(0.013, 0.004, S.adsE) + S.bloom * bi(0.009, 0.003, S.adsE) + (air ? 0.02 : 0) - (P.crouching ? 0.002 * (1 - S.adsE) : 0);
    spread *= kind === 'shotgun' ? Math.max(0.85, api.mods.spread) : api.mods.spread;
    S.spreadS = kn(S.spreadS, spread, 18, dt);
    api.spread = S.spreadS;
    api.state = S.reload ? 'reloading' : S.sprintT > 0.5 ? 'sprinting' : S.cool > 0 ? 'firing' : 'idle';

    // trigger finger + muzzle flash
    S.finger = kn(S.finger, held && canFire ? 1 : 0, 30, dt);
    setFinger(S.finger);
    trigger.position.z = 0.004 * S.finger;
    var u = flash.material.uniforms;
    S.flashT -= dt;
    u.uInt.value = S.flashT > 0 ? 9.5 * Math.sqrt(Math.max(0, S.flashT / S.flashDur)) : 0;
    u.uHeat.value = 0;
    flash.visible = u.uInt.value > 0;

    // bob, sway, jump/land and recoil springs (same model as the PAC-9)
    var ground = P.onGround !== false, vy = P.vel ? P.vel.y : 0;
    S.bobAmt = kn(S.bobAmt, ground ? Fo(speed / 3.6) : 0, 8, dt);
    S.bobPhase += dt * (speed > 0.3 && ground ? 5.2 + speed * 1.55 : 0);
    var ph = S.bobPhase, amt = S.bobAmt * bi(1, 0.12, S.adsE) * (1 + S.sprintT * 1.4);
    var bobX = Math.sin(ph) * 6e-3 * amt, bobY = (Math.sin(2 * ph) * 42e-4 - Math.pow(0.5 + 0.5 * Math.cos(2 * ph + 0.6), 4) * 48e-4) * amt;
    var idle = bi(1, 0.3, S.adsE), t = S.t, swayK = bi(1, 0.4, S.adsE);
    S.swY.v += Zn(inp.look ? inp.look.dx : 0, -0.2, 0.2) * 3.2 * swayK;
    S.swP.v += Zn(inp.look ? inp.look.dy : 0, -0.2, 0.2) * 2.6 * swayK;
    ma(S.swY, 0, dt); ma(S.swP, 0, dt);
    S.swY.x = Zn(S.swY.x, -0.09, 0.09); S.swP.x = Zn(S.swP.x, -0.07, 0.07);
    if (S.wasGround && !ground && vy > 1) { S.jY.v -= 0.22; S.jP.v += 0.7; }
    if (!S.wasGround && ground) { var land = Zn(-S.lastVy * 0.06, 0, 0.6); S.jY.v -= land; S.jP.v -= land * 3.2; S.kR.v += (rng() - 0.5) * land * 2; }
    S.wasGround = ground;
    if (!ground) S.lastVy = vy;
    ma(S.jY, ground ? 0 : Zn(-vy * 45e-4, -0.02, 0.024), dt);
    ma(S.jP, ground ? 0 : Zn(vy * 0.012, -0.06, 0.06), dt);
    ma(S.kZ, 0, dt); ma(S.kP, 0, dt); ma(S.kY, 0, dt); ma(S.kR, 0, dt); ma(S.bump, 0, dt);
    var mvx = inp.move ? inp.move.x : 0, mvy = inp.move ? inp.move.y : 0, hipW = 1 - S.adsE, ads = S.adsE, spr = S.sprintT, rw = S.reloadW;
    var H = geo.hip, A = geo.ads, SP = geo.sprint, RL = geo.reload;
    var px = bi(H.p[0], A.p[0], ads) + SP.p[0] * spr + RL.p[0] * rw + bobX + Math.sin(t * 0.85 + 1) * 12e-4 * idle - S.swY.x * 0.06 - mvx * 4e-3 * hipW;
    var py = bi(H.p[1], A.p[1], ads) + SP.p[1] * spr + RL.p[1] * rw + bobY + Math.sin(t * 1.7) * 16e-4 * idle + S.swP.x * 0.05 + S.jY.x + S.bump.x * 0.6;
    var pz = bi(H.p[2], A.p[2], ads) + SP.p[2] * spr + RL.p[2] * rw + S.kZ.x * (kind === 'pistol' ? 0.5 : 0.75) + mvy * 4e-3 * hipW * (1 - spr);
    var rx = H.r[0] * hipW + SP.r[0] * spr + RL.r[0] * rw + Math.sin(t * 1.7 + 0.8) * 35e-4 * idle + Math.sin(2 * ph + 0.5) * 8e-3 * amt + S.swP.x + S.jP.x + S.kP.x + S.bump.x * 1.5;
    var ry = H.r[1] * hipW + SP.r[1] * spr + RL.r[1] * rw + Math.sin(t * 0.6) * 2e-3 * idle + Math.sin(ph) * 0.01 * amt + S.swY.x + S.kY.x;
    var rz = H.r[2] * hipW + SP.r[2] * spr + RL.r[2] * rw + Math.sin(ph) * 0.014 * amt + S.swY.x * 0.7 - mvx * 0.035 * hipW + S.kR.x + Math.sin(t * 0.5) * 4e-3 * idle;
    root.position.set(px, py, pz);
    root.rotation.set(rx, ry, rz, 'YXZ');
  }

  function snap() {
    S.adsLin = G.input && G.input.ads ? 1 : 0;
    var sp = springs();
    for (var k in sp) S[k] = sp[k];
  }

  function reset() {
    api.ammo = api.magSize; api.reserve = T.reserve; api.state = 'idle'; api.ads = 0;
    freshState();
    mover.position.set(0, 0, 0);
    mover.rotation.set(0, 0, 0);
    S.boltT = 9;
    if (mag) { mag.visible = true; mag.position.set(0, 0, 0); }
    if (lh) lh.position.copy(lhBase);
  }

  return api;
}

// ---------------------------------------------------------------------------
// World meshes: crates, beacons, grenades
// ---------------------------------------------------------------------------
function SXA_beaconMat(color) {
  return new lt.ShaderMaterial({
    uniforms: { uColor: { value: new lt.Color(color[0], color[1], color[2]) }, uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 wp = vec4(position,1.0); vec3 n0 = normal;\n#ifdef USE_INSTANCING\n wp = instanceMatrix * wp; n0 = mat3(instanceMatrix) * n0;\n#endif\n vec4 mv = modelViewMatrix * wp; vec3 n = normalize(normalMatrix * n0); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; uniform float uFade; varying vec2 vUv; varying float vF; void main(){ float h = vUv.y; float a = pow(1.0 - h, 3.0) * (0.7 + 0.3 * sin(uTime * 3.0 - h * 9.0)); a *= pow(vF, 2.2) * 0.42; gl_FragColor = vec4(uColor * a * uFade, 1.0); }',
    transparent: true, blending: lt.AdditiveBlending, depthWrite: false, side: lt.DoubleSide, fog: false, toneMapped: false,
  });
}

function SXA_ringMat(color) {
  return new lt.ShaderMaterial({
    uniforms: { uColor: { value: new lt.Color(color[0], color[1], color[2]) }, uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; vec4 wp = vec4(position,1.0);\n#ifdef USE_INSTANCING\n wp = instanceMatrix * wp;\n#endif\n gl_Position = projectionMatrix * modelViewMatrix * wp; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; uniform float uFade; varying vec2 vUv; void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float ring = smoothstep(0.78, 0.9, r) * (1.0 - smoothstep(0.92, 1.0, r)); float pulse = fract(uTime * 0.6); float wave = smoothstep(pulse - 0.12, pulse, r) * (1.0 - smoothstep(pulse, pulse + 0.04, r)) * (1.0 - pulse); gl_FragColor = vec4(uColor * (ring * 0.75 + wave * 0.6) * uFade, 1.0); }',
    transparent: true, blending: lt.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
  });
}

function SXA_worldKit(G, shotgunGeo, viewMats, sniperGeo) {
  var std = function (color, rough, metal) { return new lt.MeshStandardMaterial({ color: color, roughness: rough, metalness: metal }); };
  var safeMat = function (name, fallback) { try { return G.mats.get(name); } catch (e) { return fallback; } };
  var M = {
    yellow: safeMat('paint_yellow', std(0xc9a227, 0.5, 0.1)),
    red: safeMat('plastic_red', std(0x9a1d14, 0.5, 0)),
    steel: safeMat('steel_dark', std(0x2c2e30, 0.45, 0.8)),
    tan: safeMat('polymer_tan', std(0x7a6a4c, 0.8, 0)),
    nadeBody: std(0x3e4a2e, 0.55, 0.2),
    nadeMetal: std(0x5d6064, 0.35, 0.85),
    empBody: std(0x22262b, 0.38, 0.7),
    c4Body: std(0xb8a57c, 0.92, 0),
    black: std(0x111214, 0.6, 0.2),
    cyan: G.mats.emissive ? G.mats.emissive(0x55d8ff, 9) : std(0x55d8ff, 0.5, 0),
    led: G.mats.emissive ? G.mats.emissive(0xff2414, 16) : std(0xff2414, 0.5, 0),
  };
  var mesh = function (geo, mat, cast) { var m = new lt.Mesh(geo, mat); m.castShadow = cast !== false; m.receiveShadow = true; return m; };

  var labelFont = (function () {
    try { var f = getComputedStyle(document.documentElement).getPropertyValue('--f-label').trim(); return f || 'sans-serif'; } catch (e) { return 'sans-serif'; }
  })();
  function labelTex(text, color) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    var x = c.getContext('2d');
    x.font = '700 78px ' + labelFont;
    x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 68, 480);
    // stencil bridges and wear
    x.globalCompositeOperation = 'destination-out';
    for (var k = 0; k < 7; k++) x.fillRect(40 + k * 66, 0, 3, 128);
    for (var j = 0; j < 260; j++) { x.globalAlpha = Math.random() * 0.6; x.fillRect(Math.random() * 512, Math.random() * 128, 2 + Math.random() * 7, 1 + Math.random() * 3); }
    var t = new lt.CanvasTexture(c);
    t.colorSpace = lt.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  var labelMat = function (text, color) { return new lt.MeshStandardMaterial({ map: labelTex(text, color), alphaTest: 0.4, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }); };
  M.crate = std(0x46542f, 0.74, 0.06);
  M.ammoLabel = labelMat('AMMO  5.56 / 12GA / 9MM', '#d8b54a');
  M.nadeLabel = labelMat('GRENADES  FRAG / EMP / C4', '#d8b54a');
  var merge = function (list) { return Ii(list); };
  var labelPlanes = function (w, h, y, halfD) {
    var a = new lt.PlaneGeometry(w, h).translate(0, y, halfD + 0.002);
    var b = new lt.PlaneGeometry(w, h).rotateY(Math.PI).translate(0, y, -halfD - 0.002);
    return merge([a, b]);
  };
  // the downloaded models when they loaded (SXA_PROPS), else the boxes below
  var propNoShadow = function (g) { if (g) g.userData.noShadow = true; return g; };
  function ammoCrate() {
    var pm = SXA_propClone('ammo'); if (pm) return pm;
    var g = new lt.Group();
    g.add(mesh(Wi(0.6, 0.28, 0.34, 0.025).translate(0, 0.14, 0), M.crate));
    g.add(mesh(merge([Wi(0.56, 0.02, 0.3, 0.008).translate(0, 0.29, 0), Wi(0.04, 0.03, 0.16, 0.008).translate(-0.31, 0.2, 0), Wi(0.04, 0.03, 0.16, 0.008).translate(0.31, 0.2, 0), Wi(0.612, 0.018, 0.352, 0.006).translate(0, 0.262, 0)]), M.steel));
    g.add(mesh(labelPlanes(0.54, 0.135, 0.13, 0.17), M.ammoLabel, false));
    return g;
  }
  function fragMesh() {
    var pm = SXA_propClone('frag'); if (pm) return pm;
    var g = new lt.Group();
    var body = new lt.LatheGeometry([[0, -0.042], [0.018, -0.04], [0.028, -0.03], [0.032, -0.012], [0.031, 0.01], [0.025, 0.026], [0.014, 0.034], [0, 0.035]].map(function (p) { return new lt.Vector2(p[0], p[1]); }), 18);
    g.add(mesh(body, M.nadeBody));
    g.add(mesh(new lt.CylinderGeometry(0.011, 0.012, 0.024, 12).translate(0, 0.045, 0), M.nadeMetal));
    g.add(mesh(new lt.BoxGeometry(0.008, 0.06, 0.012).translate(0.016, 0.03, 0).rotateZ(-0.25), M.nadeMetal));
    g.add(mesh(new lt.TorusGeometry(0.011, 0.0018, 6, 16).rotateY(Math.PI / 2).translate(-0.012, 0.056, 0), M.nadeMetal, false));
    g.scale.setScalar(1.25);
    return g;
  }
  function empMesh() {
    var g = new lt.Group();
    g.add(mesh(new lt.CylinderGeometry(0.03, 0.03, 0.1, 16), M.empBody));
    g.add(mesh(new lt.CylinderGeometry(0.0315, 0.0315, 0.012, 16).translate(0, 0.022, 0), M.cyan, false));
    g.add(mesh(new lt.CylinderGeometry(0.0315, 0.0315, 0.012, 16).translate(0, -0.022, 0), M.cyan, false));
    g.add(mesh(new lt.CylinderGeometry(0.014, 0.018, 0.02, 12).translate(0, 0.06, 0), M.nadeMetal));
    g.scale.setScalar(1.2);
    return g;
  }
  function c4Mesh() {
    var g = new lt.Group();
    g.add(mesh(Wi(0.13, 0.045, 0.075, 0.01), M.c4Body));
    g.add(mesh(Wi(0.05, 0.022, 0.04, 0.004).translate(0.02, 0.032, 0), M.black));
    var led = mesh(new lt.SphereGeometry(0.006, 10, 8).translate(0.034, 0.046, 0.008), M.led, false);
    led.name = 'led';
    g.add(led);
    g.add(mesh(new lt.CylinderGeometry(0.0025, 0.0025, 0.07, 6).rotateZ(Math.PI / 2).translate(-0.02, 0.026, 0.02), M.red, false));
    return g;
  }
  function nadeCrate() {
    var pm = SXA_propClone('nadecrate'); if (pm) return pm;
    var g = new lt.Group();
    g.add(mesh(Wi(0.46, 0.22, 0.32, 0.02).translate(0, 0.11, 0), M.crate));
    g.add(mesh(Wi(0.472, 0.03, 0.332, 0.008).translate(0, 0.2, 0), M.red));
    g.add(mesh(labelPlanes(0.42, 0.105, 0.095, 0.16), M.nadeLabel, false));
    return g;
  }
  // one calibre's ammo box: the ammo can tinted in the calibre's colour, its
  // name stencilled on the lid and both sides
  var calLabels = {}, calMats = {};
  function ammoBox(cal) {
    var C = SXA_CAL[cal];
    if (!calLabels[cal]) calLabels[cal] = labelMat(C.label, C.color);
    var pm = propNoShadow(SXA_propClone('ammo1', C.tint)), g = pm;
    if (!g) {
      g = new lt.Group();
      g.userData.noShadow = true;
      if (!calMats[cal]) calMats[cal] = std(new lt.Color(C.color).multiplyScalar(0.45).getHex(), 0.6, 0.35);
      g.add(mesh(Wi(0.24, 0.14, 0.11, 0.012).translate(0, 0.07, 0), calMats[cal]));
      g.add(mesh(Wi(0.07, 0.02, 0.03, 0.006).translate(0, 0.15, 0), M.steel));
    }
    var b = new lt.Box3().setFromObject(g), w = b.max.x - b.min.x, dz = b.max.z - b.min.z, top = b.max.y, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    // a bright band in the calibre colour round the can: readable from afar
    if (!calMats['band' + cal]) { var bc = new lt.Color(C.color); calMats['band' + cal] = new lt.MeshStandardMaterial({ color: bc, emissive: bc.clone().multiplyScalar(0.45), roughness: 0.5, metalness: 0 }); }
    var bh = (top - b.min.y) * 0.16;
    g.add(mesh(new lt.BoxGeometry(w * 1.04, bh, dz * 1.06).translate(cx, b.min.y + (top - b.min.y) * 0.72, cz), calMats['band' + cal], false));
    // the calibre on the lid and on both long sides
    var lw = Math.max(w, dz) * 0.82, lh = lw * 0.32, along = w >= dz;
    g.add(mesh(new lt.PlaneGeometry(lw, lh).rotateX(-Math.PI / 2).rotateY(along ? 0 : Math.PI / 2).translate(cx, top + 0.003, cz), calLabels[cal], false));
    var sy = b.min.y + (top - b.min.y) * 0.4, half = (along ? dz : w) / 2 + 0.004;
    [1, -1].forEach(function (sd) {
      var pl = new lt.PlaneGeometry(lw, lh);
      if (along) { if (sd < 0) pl.rotateY(Math.PI); pl.translate(cx, sy, cz + sd * half); }
      else { pl.rotateY(sd * Math.PI / 2); pl.translate(cx + sd * half, sy, cz); }
      g.add(mesh(pl, calLabels[cal], false));
    });
    return g;
  }
  function pouch() {
    var pm = propNoShadow(SXA_propClone('ammo1')); if (pm) return pm;
    var g = new lt.Group();
    g.userData.noShadow = true;
    g.add(mesh(Wi(0.22, 0.1, 0.14, 0.02).translate(0, 0.05, 0), M.tan));
    g.add(mesh(Wi(0.224, 0.02, 0.144, 0.006).translate(0, 0.075, 0), M.yellow));
    return g;
  }
  function gunWorld(src, centreFwd) {
    var g = new lt.Group();
    if (src.model) {
      // the pump-shotgun model, centred along its length
      src.model.body.concat(src.model.pump, src.model.trigger).forEach(function (gg) {
        var m = mesh(gg, src.model.mat); m.position.fromArray(src.model.offset); g.add(m);
      });
      if (src.model.marks) src.model.marks.geos.forEach(function (gg) { var m = mesh(gg, src.model.marks.mat); m.position.fromArray(src.model.offset); m.castShadow = false; g.add(m); });
      var hm = new lt.Group();
      hm.add(g);
      g.rotation.set(0, Math.PI / 2, 0);
      g.position.set(-(src.model.length[0] + src.model.length[1]) / 2, 0.03, 0);
      hm.scale.setScalar(1.05);
      return hm;
    }
    var addAll = function (bucket) {
      for (var key in bucket) {
        if (!bucket[key] || !bucket[key].length) continue;
        var geo = Ii(bucket[key].map(function (x) { return x.clone(); }));
        g.add(mesh(geo, viewMats[key]));
      }
    };
    for (var part in src.parts) addAll(src.parts[part]);
    // lie it sideways and centre it
    var holder = new lt.Group();
    holder.add(g);
    g.rotation.set(0, Math.PI / 2, 0);
    g.position.set(centreFwd, 0.03, 0);
    holder.scale.setScalar(1.15);
    return holder;
  }
  // first-aid kits: white cross on green (small pouch, kit, large trauma case)
  var crossTex = (function () {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var x = c.getContext('2d');
    x.fillStyle = '#f2f2ec';
    x.fillRect(46, 18, 36, 92);
    x.fillRect(18, 46, 92, 36);
    var t = new lt.CanvasTexture(c);
    t.colorSpace = lt.SRGBColorSpace;
    return t;
  })();
  M.medGreen = std(0x2c7a43, 0.55, 0.05);
  M.medDark = std(0x1d4f2c, 0.6, 0.05);
  M.medTrim = std(0xd9d9d0, 0.5, 0.1);
  M.cross = new lt.MeshStandardMaterial({ map: crossTex, alphaTest: 0.5, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 });
  var crossTop = function (size, y) { return new lt.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(0, y + 0.002, 0); };
  var crossSides = function (size, y, halfD) {
    return Ii([new lt.PlaneGeometry(size, size).translate(0, y, halfD + 0.002), new lt.PlaneGeometry(size, size).rotateY(Math.PI).translate(0, y, -halfD - 0.002)]);
  };
  function medSmall() {
    var pm = propNoShadow(SXA_propClone('meds')); if (pm) return pm;
    var g = new lt.Group();
    g.userData.noShadow = true;
    g.add(mesh(Wi(0.18, 0.08, 0.13, 0.025).translate(0, 0.04, 0), M.medGreen));
    g.add(mesh(Wi(0.184, 0.012, 0.134, 0.004).translate(0, 0.055, 0), M.medTrim));
    g.add(mesh(crossTop(0.09, 0.08), M.cross, false));
    return g;
  }
  function medKit() {
    var pm = SXA_propClone('medkit'); if (pm) return pm;
    var g = new lt.Group();
    g.add(mesh(Wi(0.38, 0.15, 0.26, 0.025).translate(0, 0.075, 0), M.medGreen));
    g.add(mesh(Ii([Wi(0.386, 0.014, 0.266, 0.005).translate(0, 0.1, 0), Wi(0.12, 0.022, 0.03, 0.008).translate(0, 0.162, 0)]), M.medTrim));
    g.add(mesh(Ii([crossTop(0.13, 0.15), crossSides(0.1, 0.07, 0.13)]), M.cross, false));
    return g;
  }
  function medLarge() {
    var pm = SXA_propClone('medkitL'); if (pm) return pm;
    var g = new lt.Group();
    g.add(mesh(Wi(0.64, 0.26, 0.42, 0.035).translate(0, 0.13, 0), M.medDark));
    g.add(mesh(Ii([Wi(0.648, 0.03, 0.428, 0.008).translate(0, 0.2, 0), Wi(0.648, 0.03, 0.428, 0.008).translate(0, 0.06, 0), Wi(0.16, 0.03, 0.04, 0.01).translate(0, 0.275, 0)]), M.medTrim));
    g.add(mesh(Ii([crossTop(0.22, 0.26), crossSides(0.12, 0.13, 0.21)]), M.cross, false));
    return g;
  }
  function shotgunWorld() { return gunWorld(shotgunGeo, 0.145); }
  function sniperWorld() {
    if (sniperGeo.model && sniperGeo.model.world) {
      var wm = sniperGeo.model.world();
      wm.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return wm;
    }
    var w = gunWorld(sniperGeo, 0.29);
    var sc = SXA_attGeo('x8', SXA_MOUNTS.sniper.optic), g2 = new lt.Group();
    for (var key in sc) if (sc[key].length) g2.add(mesh(Ii(sc[key]), viewMats[key]));
    g2.rotation.set(0, Math.PI / 2, 0); g2.position.set(0.29, 0.03, 0);
    w.children[0].add(g2);
    g2.rotation.set(0, 0, 0); g2.position.set(0, 0, 0);
    return w;
  }
  // attachment case: a small hard case with the part's name stencilled on it
  var attLabels = {};
  function attCase(id) {
    if (!attLabels[id]) attLabels[id] = labelMat(SXA_ATT[id].short, '#d9c8ff');
    var pm = propNoShadow(SXA_propClone('attcase'));
    if (pm) {
      // the part's name on the lid
      var top = new lt.Box3().setFromObject(pm), w = top.max.x - top.min.x;
      pm.add(mesh(new lt.PlaneGeometry(w * 0.62, w * 0.155).rotateX(-Math.PI / 2).translate(0, top.max.y + 0.003, 0), attLabels[id], false));
      return pm;
    }
    var g = new lt.Group();
    g.userData.noShadow = true;
    g.add(mesh(Wi(0.34, 0.1, 0.22, 0.02).translate(0, 0.05, 0), M.attCase));
    g.add(mesh(Wi(0.346, 0.02, 0.226, 0.006).translate(0, 0.07, 0), M.attStripe));
    if (!attLabels[id]) attLabels[id] = labelMat(SXA_ATT[id].short, '#d9c8ff');
    g.add(mesh(new lt.PlaneGeometry(0.26, 0.065).rotateX(-Math.PI / 2).translate(0, 0.1025, 0), attLabels[id], false));
    return g;
  }
  M.attCase = std(0x2a2d31, 0.5, 0.45);
  M.attStripe = std(0x7d5cc8, 0.45, 0.2);
  // helmets and vests, coloured by level (tan / olive / black) with level bars
  var armorCol = [0, 0x8a7d5c, 0x4f5b3c, 0x232629];
  M.armorDark = std(0x16181a, 0.6, 0.25);
  M.armorBar = std(0xe8e4da, 0.5, 0.05);
  M.visor = std(0x0d1318, 0.12, 0.7);
  M.pouch = std(0x6f6046, 0.85, 0.02);
  var armorMat = function (lv) { return M['armor' + lv] || (M['armor' + lv] = std(armorCol[lv], 0.82, 0.04)); };
  function helmet(lv) {
    var pm = propNoShadow(SXA_propClone('helmet', SXA_TUNE.props.helmetTint[lv])); if (pm) return pm;
    var g = new lt.Group();
    g.userData.noShadow = true;
    g.add(mesh(new lt.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.92, 1.12).translate(0, 0.03, 0), armorMat(lv)));
    g.add(mesh(new lt.TorusGeometry(0.141, 0.009, 6, 30).rotateX(Math.PI / 2).scale(1, 1.12, 1).translate(0, 0.03, 0), M.armorDark));
    if (lv >= 2) g.add(mesh(Wi(0.055, 0.045, 0.02, 0.006).rotateX(-0.5).translate(0, 0.1, -0.135), M.armorDark));
    if (lv >= 2) [-1, 1].forEach(function (sd) { g.add(mesh(Wi(0.012, 0.03, 0.09, 0.004).translate(sd * 0.137, 0.06, 0), M.armorDark)); });
    if (lv === 3) g.add(mesh(new lt.CylinderGeometry(0.152, 0.152, 0.075, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8).scale(1, 1, 1.12).translate(0, 0.0, 0), M.visor));
    for (var k = 0; k < lv; k++) [-1, 1].forEach(function (sd) { g.add(mesh(Wi(0.006, 0.012, 0.032, 0.002).translate(sd * 0.128, 0.1, 0.03 - k * 0.022), M.armorBar, false)); });
    return g;
  }
  function vest(lv) {
    var pm = propNoShadow(SXA_propClone('vest', SXA_TUNE.props.vestTint[lv])); if (pm) return pm;
    var g = new lt.Group();
    g.userData.noShadow = true;
    var mb = armorMat(lv);
    g.add(mesh(Wi(0.32, 0.38, 0.05, 0.02).translate(0, 0.2, -0.07), mb));   // front plate bag
    g.add(mesh(Wi(0.32, 0.4, 0.05, 0.02).translate(0, 0.21, 0.07), mb));    // back plate bag
    [-1, 1].forEach(function (sd) {
      g.add(mesh(Wi(0.06, 0.03, 0.19, 0.01).translate(sd * 0.1, 0.4, 0), mb));            // shoulder straps
      g.add(mesh(Wi(0.03, 0.15, 0.16, 0.01).translate(sd * 0.165, 0.11, 0), M.armorDark)); // cummerbund
    });
    if (lv >= 2) for (var k = 0; k < 3; k++) g.add(mesh(Wi(0.085, 0.11, 0.045, 0.01).translate(-0.095 + k * 0.095, 0.1, -0.115), lv === 3 ? M.pouch : M.armorDark));
    if (lv === 3) { g.add(mesh(Wi(0.2, 0.06, 0.05, 0.015).translate(0, 0.39, -0.08), mb)); g.add(mesh(Wi(0.14, 0.1, 0.03, 0.01).translate(0, -0.02, -0.08), mb)); }
    for (var j = 0; j < lv; j++) g.add(mesh(Wi(0.03, 0.012, 0.006, 0.002).translate(0.09, 0.33 - j * 0.022, -0.097), M.armorBar, false));
    return g;
  }
  // backpacks: body, top flap, front + side pockets, shoulder straps, grab
  // handle, a colour per level (olive / desert tan / black) and a level tag
  var packCol = [0, 0x55603f, 0x9a8460, 0x26292c], packTrim = [0, 0x343b28, 0x6b5a3f, 0x111315];
  var packTags = {};
  function backpack(lv) {
    var body = M['pack' + lv] || (M['pack' + lv] = std(packCol[lv], 0.88, 0.02));
    var trim = M['packT' + lv] || (M['packT' + lv] = std(packTrim[lv], 0.8, 0.04));
    if (!packTags[lv]) packTags[lv] = labelMat('LV.' + lv, lv === 3 ? '#ffd27a' : '#f2eee2');
    var g = new lt.Group();
    g.userData.noShadow = true;
    var h = 0.4 + lv * 0.04, w = 0.3 + lv * 0.02, d = 0.17 + lv * 0.02;
    g.add(mesh(Wi(w, h, d, 0.05).translate(0, h / 2 + 0.01, 0), body));                                  // main body
    g.add(mesh(Wi(w * 1.02, 0.07, d * 1.04, 0.03).rotateX(0.12).translate(0, h + 0.005, -0.012), trim));  // top flap
    g.add(mesh(Wi(w * 0.78, h * 0.42, 0.07, 0.03).translate(0, h * 0.3, -d / 2 - 0.03), body));          // front pocket
    g.add(mesh(Wi(w * 0.8, 0.02, 0.075, 0.008).translate(0, h * 0.52, -d / 2 - 0.03), trim));            // pocket flap
    [-1, 1].forEach(function (sd) {
      g.add(mesh(Wi(0.06, h * 0.45, d * 0.75, 0.02).translate(sd * (w / 2 + 0.028), h * 0.32, 0), body)); // side pockets
      g.add(mesh(Wi(0.045, h * 0.92, 0.02, 0.008).translate(sd * w * 0.27, h * 0.52, d / 2 + 0.012), trim)); // shoulder straps
      g.add(mesh(Wi(0.03, 0.04, 0.03, 0.008).translate(sd * w * 0.27, 0.06, d / 2 + 0.02), trim));
      if (lv >= 2) g.add(mesh(Wi(0.012, h * 0.7, d * 0.5, 0.004).translate(sd * (w / 2 + 0.002), h * 0.55, 0), trim)); // compression straps
    });
    g.add(mesh(Wi(0.09, 0.025, 0.02, 0.008).translate(0, h + 0.05, d * 0.3), trim));                     // grab handle
    if (lv === 3) g.add(mesh(Wi(w * 0.9, 0.09, 0.09, 0.04).translate(0, h + 0.075, -0.01), trim));      // bedroll on top
    g.add(mesh(new lt.PlaneGeometry(w * 0.5, w * 0.17).translate(0, h * 0.3, -d / 2 - 0.066).rotateY(Math.PI), packTags[lv], false));
    return g;
  }
  var beamGeo = new lt.CylinderGeometry(0.34, 0.34, 2.3, 24, 1, true).translate(0, 1.15, 0);
  var ringGeo = new lt.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2);
  var beaconMats = {
    ammo: SXA_beaconMat([1.0, 0.55, 0.14]),
    grenade: SXA_beaconMat([1.0, 0.22, 0.12]),
    weapon: SXA_beaconMat([0.25, 0.8, 1.0]),
    med: SXA_beaconMat([0.3, 1.0, 0.45]),
    att: SXA_beaconMat([0.72, 0.45, 1.0]),
    armor: SXA_beaconMat([1.0, 0.9, 0.5]),
  };
  var ringMats = {
    ammo: SXA_ringMat([1.0, 0.55, 0.14]),
    grenade: SXA_ringMat([1.0, 0.22, 0.12]),
    weapon: SXA_ringMat([0.25, 0.8, 1.0]),
    med: SXA_ringMat([0.3, 1.0, 0.45]),
    att: SXA_ringMat([0.72, 0.45, 1.0]),
    armor: SXA_ringMat([1.0, 0.9, 0.5]),
  };
  // Beacons are drawn as instances (one beam + one ring mesh per colour);
  // a pickup only carries an anchor, see syncBeacons().
  var pools = {};
  ['ammo', 'grenade', 'weapon', 'med', 'att', 'armor'].forEach(function (k) {
    var beam = new lt.InstancedMesh(beamGeo, beaconMats[k], 96), ring = new lt.InstancedMesh(ringGeo, ringMats[k], 96);
    beam.renderOrder = 880; ring.renderOrder = 881;
    beam.frustumCulled = ring.frustumCulled = false;
    beam.count = ring.count = 0;
    pools[k] = { beam: beam, ring: ring };
  });
  function beacon(kind, scale) {
    var a = new lt.Object3D();
    a.userData.beacon = { kind: kind, scale: scale };
    return a;
  }
  var bm = new lt.Matrix4(), bq = new lt.Quaternion(), bs = new lt.Vector3(), bp = new lt.Vector3();
  function syncBeacons(list) {
    var n = {};
    for (var k in pools) n[k] = 0;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p.active || !p.holder.visible || !p.beacon) continue;
      var b = p.beacon.userData.beacon, pool = pools[b.kind];
      if (!pool || n[b.kind] >= 96) continue;
      bp.copy(p.holder.position);
      bs.set(b.scale, b.scale > 0.8 ? 1 : 0.6, b.scale);
      pool.beam.setMatrixAt(n[b.kind], bm.compose(bp, bq, bs));
      bs.set(b.scale, 1, b.scale); bp.y += 0.02;
      pool.ring.setMatrixAt(n[b.kind], bm.compose(bp, bq, bs));
      n[b.kind]++;
    }
    for (var k2 in pools) {
      var pl = pools[k2];
      pl.beam.count = pl.ring.count = n[k2];
      pl.beam.instanceMatrix.needsUpdate = pl.ring.instanceMatrix.needsUpdate = true;
    }
  }
  return { M: M, ammoCrate: ammoCrate, nadeCrate: nadeCrate, fragMesh: fragMesh, empMesh: empMesh, c4Mesh: c4Mesh, pools: pools, syncBeacons: syncBeacons, pouch: pouch, medSmall: medSmall, medKit: medKit, medLarge: medLarge, shotgunWorld: shotgunWorld, sniperWorld: sniperWorld, attCase: attCase, helmet: helmet, vest: vest, backpack: backpack, ammoBox: ammoBox, beacon: beacon, beaconMats: beaconMats, ringMats: ringMats };
}

// ---------------------------------------------------------------------------
// The arsenal: the object the game sees as `weapon`.
// ---------------------------------------------------------------------------
async function SXA_createArsenal(G) {
  var rifle = await dm(G);
  var models = await Promise.all([
    SX_timeout(SXA_loadShotgunModel(), 8000, 'shotgun model').catch(function (err) { console.warn('[arsenal] shotgun model not loaded, procedural KR-12: ' + (err && err.message || err)); return null; }),
    SX_timeout(SXA_loadPistolModel(), 8000, 'pistol model').catch(function (err) { console.warn('[arsenal] pistol model not loaded, procedural M7: ' + (err && err.message || err)); return null; }),
    SX_timeout(SXA_loadSniperModel(), 8000, 'sniper model').catch(function (err) { console.warn('[arsenal] sniper model not loaded, procedural SR-3: ' + (err && err.message || err)); return null; }),
    SX_timeout(typeof SX_ASSET_knife === 'string' ? SX_parseGLB(SX_ASSET_knife) : Promise.reject(new Error('no asset')), 8000, 'knife model').catch(function (err) { console.warn('[arsenal] knife model not loaded, procedural knife: ' + (err && err.message || err)); return null; }),
    SX_timeout(typeof SX_ASSET_scope4x === 'string' ? SX_parseGLB(SX_ASSET_scope4x) : Promise.reject(new Error('no asset')), 8000, '4x scope model').catch(function (err) { console.warn('[arsenal] 4x scope model not loaded, simple PAC-9 4x: ' + (err && err.message || err)); return null; }),
    (function () {
      var lp = SXA_loadProps().then(function (P) { SXA_PROPS = P; if (SXA_propsSwap) SXA_propsSwap(); return P; }, function (err) { console.warn('[arsenal] pickup props not loaded, procedural kit: ' + (err && err.message || err)); return null; });
      return SX_timeout(lp, 6000, 'pickup props').catch(function () { return null; });
    })(),
  ]);
  SXA_SGM = models[0];
  SXA_PSM = models[1];
  SXA_SNM = models[2];
  SXA_KNM = models[3];
  SXA_S4M = models[4];
  try {
    return SXA_buildArsenal(G, rifle);
  } catch (err) {
    console.error('[arsenal] disabled, plain rifle only: ' + (err && err.stack || err));
    rifle.root.visible = true;
    return rifle;
  }
}

// The combat knife viewmodel: the PAC-9's right glove round a rubber grip,
// steel guard, a 17 cm clip-point blade. Hidden until a slash.
function SXA_makeKnife(G, mats, hands) {
  if (SXA_KNM) {
    try { return SXA_makeKnifeModel(G, SXA_KNM) } catch (e) { console.warn('[arsenal] knife model failed, procedural knife', e) }
  }
  var root = new lt.Group()
  root.name = 'viewmodel-knife'
  var steel = new lt.MeshStandardMaterial({ color: 0xa7adb2, metalness: 0.95, roughness: 0.24 })
  var edge = new lt.MeshStandardMaterial({ color: 0xd9dee2, metalness: 1, roughness: 0.12 })
  var rubber = new lt.MeshStandardMaterial({ color: 0x17181a, metalness: 0, roughness: 0.82 })
  var dark = new lt.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.6, roughness: 0.5 })
  var knife = new lt.Group() // local: handle along -y..0 (grip axis), blade up +y, edge toward -z
  var sh = new lt.Shape()
  sh.moveTo(-0.012, 0); sh.lineTo(-0.013, 0.13); sh.lineTo(-0.004, 0.172); sh.lineTo(0.006, 0.152); sh.lineTo(0.013, 0.118); sh.lineTo(0.013, 0); sh.lineTo(-0.012, 0)
  var bg = new lt.ExtrudeGeometry(sh, { depth: 0.0035, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 1 })
  bg.translate(0, 0, -0.00175)
  bg.rotateY(Math.PI / 2) // the flat of the blade faces sideways (x)
  var blade = SXA_vmMesh(bg, steel)
  blade.position.y = 0.012
  knife.add(blade)
  var eg = new lt.BoxGeometry(0.0012, 0.12, 0.004)
  var ed = SXA_vmMesh(eg, edge)
  ed.position.set(0, 0.075, 0.0125) // the bright bevel along the cutting edge
  knife.add(ed)
  var guard = SXA_vmMesh(new lt.BoxGeometry(0.016, 0.009, 0.05), dark)
  guard.position.y = 0.008
  knife.add(guard)
  var grip = SXA_vmMesh(new lt.CylinderGeometry(0.0135, 0.0125, 0.105, 10), rubber)
  grip.position.y = -0.05
  knife.add(grip)
  for (var r = 0; r < 4; r++) { var ring = SXA_vmMesh(new lt.TorusGeometry(0.0137, 0.0018, 4, 12), rubber); ring.rotation.x = Math.PI / 2; ring.position.y = -0.018 - r * 0.022; knife.add(ring) }
  var pommel = SXA_vmMesh(new lt.CylinderGeometry(0.011, 0.014, 0.012, 10), dark)
  pommel.position.y = -0.108
  knife.add(pommel)
  // in the glove: the grip runs where the PAC-9's pistol grip is
  var rh = new lt.Group()
  rh.quaternion.copy(hands.rq)
  rh.position.copy(hands.rpos)
  rh.add(SXA_vmMesh(hands.right.fabric, mats.glove))
  rh.add(SXA_vmMesh(hands.right.index[1].clone(), mats.glove))
  root.add(rh)
  knife.position.set(0.003, -0.052, 0.078)
  knife.rotation.set(-0.24, 0, 0)
  root.add(knife)
  root.traverse(function (o) { o.layers.set(zc) })
  root.visible = false
  G.camera.add(root)
  return { root: root, knife: knife, model: false }
}
// the animated arms + knife: the rig sits so its own eye is the camera's
function SXA_makeKnifeModel(G, gltf) {
  var V = SXA_TUNE.knife.vm, E = new lt.Vector3().fromArray(V.eye), Lk = new lt.Vector3().fromArray(V.look)
  var root = new lt.Group(), rig = new lt.Group()
  root.name = 'viewmodel-knife'
  var d = Lk.clone().sub(E).normalize() // the rig's view direction (it looks along +z, a little down)
  root.rotation.x = Math.atan2(-d.y, Math.hypot(d.x, d.z)) // tilt the rig up so that view runs down the camera's -z
  rig.rotation.y = Math.PI
  rig.scale.setScalar(V.s)
  rig.position.set(E.x * V.s, -E.y * V.s, E.z * V.s) // the eye (turned by the flip) onto the camera
  rig.add(gltf.scene)
  root.add(rig)
  gltf.scene.traverse(function (o) {
    o.layers.set(zc)
    if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false }
  })
  var clip = gltf.animations[0], mixer = new lt.AnimationMixer(gltf.scene)
  var acts = [mixer.clipAction(clip), mixer.clipAction(clip.clone()), mixer.clipAction(clip.clone())]
  acts.forEach(function (a, i) { a.play(); a.setEffectiveWeight(i ? 0 : 1) })
  root.visible = false
  G.camera.add(root)
  // at(t): one pose; at(t, t2, w): cross-fade from t toward t2 (w 0..1);
  // at(from, t2, w) with from = { a, b, w }: from a pose that is itself a mix
  // of a and b (what was on screen when the fade began) toward t2
  var mix = function (list) { for (var i = 0; i < 3; i++) { var e = list[i]; acts[i].time = e ? e[0] : 0; acts[i].setEffectiveWeight(e ? e[1] : 0) } mixer.update(0) }
  return { root: root, model: true, at: function (t, t2, w) {
    w = t2 == null ? 0 : Math.max(0, Math.min(1, w))
    if (t && typeof t === 'object') { var fw = Math.max(0, Math.min(1, t.w)); mix([[t.a, (1 - fw) * (1 - w)], [t.b, fw * (1 - w)], [t2 == null ? t.b : t2, w]]); return }
    mix([[t, 1 - w], [t2 == null ? t : t2, w]])
  } }
}

function SXA_buildArsenal(G, rifle) {
  var TU = SXA_TUNE;
  var rng = G.rng && G.rng.fork ? G.rng.fork() : Math.random;
  Mt.regenDelay = TU.regen.delay;
  Mt.regenRate = TU.regen.rate;
  var viewMats = SXA_viewMats(G);
  var hands = SXA_hands();
  var shotgunGeo = SXA_SGM ? SXA_shotgunGeoModel(SXA_SGM) : SXA_shotgunGeo();
  var sniperGeo = SXA_SNM ? SXA_sniperGeoModel(SXA_SNM) : SXA_sniperGeo();
  Mt.recoilKeep = TU.recoil.keep;
  Mt.recoilRecover = TU.recoil.recover;
  var pistolGeo = SXA_PSM ? SXA_pistolGeoModel(SXA_PSM) : SXA_pistolGeo();
  var guns = {
    rifle: rifle,
    shotgun: SXA_makeGun(G, 'shotgun', shotgunGeo, viewMats, hands, rng),
    pistol: SXA_makeGun(G, 'pistol', pistolGeo, viewMats, hands, rng),
    sniper: SXA_makeGun(G, 'sniper', sniperGeo, viewMats, hands, rng),
  };
  rifle.kind = 'rifle'; rifle.short = 'PAC-9'; rifle.maxReserve = TU.rifleMaxReserve;
  var knifeVM = SXA_makeKnife(G, viewMats, hands);
  // 5 selects the knife too (V is the game's own melee key)
  if (typeof h_ !== 'undefined' && h_) { h_.Digit5 = h_.Digit5 || 'w5'; h_.Numpad5 = h_.Numpad5 || 'w5'; }
  if (rifle.reserve > 0) SXA_CAL['556'].start = rifle.reserve;
  var kit = SXA_worldKit(G, shotgunGeo, viewMats, sniperGeo);
  // the PAC-9 gets an attachment mount too (it rides the stock viewmodel root)
  rifle.mounts = { root: new lt.Group() };
  rifle.root.add(rifle.mounts.root);
  var world = new lt.Group();
  world.name = 'sx-arsenal-world';
  G.scene.add(world);
  for (var pk in kit.pools) world.add(kit.pools[pk].beam, kit.pools[pk].ring);

  var tmp = new lt.Vector3(), tmp2 = new lt.Vector3(), tmp3 = new lt.Vector3(), UP = new lt.Vector3(0, 1, 0);
  var snd = function (name, o) { try { G.audio && G.audio.play && G.audio.play(name, o || {}); } catch (e) { } };
  var hud = function () { return G.hud && !G.hud.stub ? G.hud : null; };

  // ---- loadout state ----
  var L = { owned: { rifle: true, shotgun: false, pistol: true, sniper: false }, att: {}, cur: 'rifle', last: 'pistol', nades: {}, nadeType: 'frag', visible: true, sw: null, thr: null, wheel: 0, hinted: false, fullMsgT: 0, meds: {}, heal: null, medHinted: false, armor: { helmet: null, vest: null }, armorHinted: false, spare: {}, pack: 0 };
  function resetMeds() { for (var k in TU.med.start) L.meds[k] = TU.med.start[k]; L.heal = null; }
  resetMeds();
  // each gun's reserve reads / writes its calibre stack; a gun's own reset()
  // (which sets its stock reserve) leaves the stack alone
  L.ammo = {};
  function resetAmmo() { SXA_CAL_ORDER.forEach(function (c) { L.ammo[c] = SXA_CAL[c].start; }); }
  Object.keys(SXA_GUN_CAL).forEach(function (k) {
    var g = guns[k], cal = SXA_GUN_CAL[k];
    try { delete g.reserve; } catch (e) { }
    Object.defineProperty(g, 'reserve', {
      configurable: true, enumerable: true,
      get: function () { return L.ammo[cal] | 0; },
      set: function (v) { L.ammo[cal] = Math.max(0, Math.round(+v || 0)); },
    });
    g.maxReserve = 9999;
    var r0 = g.reset;
    g.reset = function () { var keep = L.ammo[cal]; var out = r0.apply(this, arguments); L.ammo[cal] = keep; return out; };
  });
  resetAmmo();
  function resetNades() { for (var k in TU.nades) L.nades[k] = TU.nades[k].start; L.nadeType = 'frag'; }
  resetNades();
  var cur = function () { return guns[L.cur]; };

  // ---- combat knife: V (or middle mouse) slashes from any gun ----
  var KQ = { a: new lt.Quaternion(), b: new lt.Quaternion(), e: new lt.Euler() };
  var KP = [ // swing keys: t (0..1), position (camera space), rotation (x, y, z)
    [0.0, [0.26, -0.22, -0.36], [-0.25, 0.5, -0.6]], // drawn low right
    [0.18, [0.20, -0.10, -0.42], [-0.55, 0.3, -0.2]], // raised, blade up
    [0.34, [0.00, -0.10, -0.55], [-0.95, -0.2, 0.7]], // across the centre: the cut
    [0.55, [-0.16, -0.18, -0.46], [-0.75, -0.55, 1.2]], // follow-through left
    [1.0, [0.24, -0.26, -0.34], [-0.25, 0.45, -0.55]], // back down right
  ];
  function knifePose(u) {
    var r = knifeVM.root, k = 0;
    while (k < KP.length - 2 && u > KP[k + 1][0]) k++;
    var A = KP[k], B = KP[k + 1], f = Math.min(1, Math.max(0, (u - A[0]) / (B[0] - A[0])));
    f = f * f * (3 - 2 * f);
    r.position.set(A[1][0] + (B[1][0] - A[1][0]) * f, A[1][1] + (B[1][1] - A[1][1]) * f, A[1][2] + (B[1][2] - A[1][2]) * f);
    KQ.a.setFromEuler(KQ.e.set(A[2][0], A[2][1], A[2][2]));
    KQ.b.setFromEuler(KQ.e.set(B[2][0], B[2][1], B[2][2]));
    r.quaternion.copy(KQ.a).slerp(KQ.b, f);
  }
  function knifeStyle() { var S = TU.knife.styles; return S[(L.knStyle | 0) % S.length]; }
  function knifeHit() {
    var K = knifeStyle(), cam = G.camera, P = G.player;
    var o = new lt.Vector3(), fwd = new lt.Vector3(), d = new lt.Vector3(), hit = null;
    cam.getWorldPosition(o);
    cam.getWorldDirection(fwd);
    // a fan of short traces across the arc (centre first); the first that finds a target lands
    var yaws = [0, -K.spread / 2, K.spread / 2, -K.spread, K.spread], pit = [-0.2, -0.05, 0.1]; // chest first
    var emit = G.events.emit, wall = null;
    G.events.emit = function (type, ev) { if (type === 'impact' && ev && ev.surface !== 'enemy') { wall = wall || ev; return; } return emit.apply(this, arguments); };
    try {
      for (var a = 0; a < pit.length && !hit; a++) for (var b = 0; b < yaws.length && !hit; b++) {
        d.copy(fwd).applyAxisAngle(UP, yaws[b]);
        d.y += pit[a];
        d.normalize();
        var r = G.combat.playerShot(o, d, { damage: K.dmg, range: K.range, impulse: 0.6 });
        if (r && r.enemy) hit = r;
      }
    } finally { G.events.emit = emit; }
    if (hit) { L.knifeHitT = performance.now(); snd('impact_enemy', { pos: hit.point, gain: 0.9, pitch: 0.8 }); P.addShake && P.addShake(0.12); }
    else if (wall && wall.dist < 1.6) { snd('impact_metal', { pos: wall.point, gain: 0.45, pitch: 1.6 }); try { G.fx.sparks && G.fx.sparks(wall.point, wall.normal, 4) } catch (e) { } }
  }
  // held knife: V (or 5) draws it, V again / 1–4 / wheel puts it away;
  // fire slashes (hold to keep slashing), R turns it over (inspect)
  function knifeEquip() {
    if (L.knOut) return;
    cancelHeal();
    L.sw = null;
    L.knOut = true;
    L.kn = { mode: 'draw', t: 0, hit: false };
    showOnly('none');
    knifeVM.root.visible = L.visible;
    knifeShow(0);
    snd('reload_bolt', { gain: 0.3, pitch: 1.9 });
    document.body.classList.add('sx-knife');
    if (ui) ui.last = '';
  }
  function knifeHolster(to) {
    if (!L.knOut) return;
    L.knOut = false; L.kn = null;
    knifeVM.root.visible = false;
    document.body.classList.remove('sx-knife');
    showOnly(L.cur);
    var g = cur(); g.snap && g.snap();
    if (ui) ui.last = '';
    if (to && to !== L.cur) requestSwitch(to);
  }
  // the attack's parts: duration of each
  function partLen(p) { return p[0] === p[1] ? p[2] : Math.abs(p[1] - p[0]) / p[2]; }
  // cross-fade weight: smoothstep, so the blade eases in and out of a fade
  // instead of stalling (a linear fade under a fast swing reads as a stutter)
  function ease(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  // pose for the current stretch at time t into it
  function knifeShow(t) {
    var K = TU.knife, C = K.clip, k = L.kn, st = knifeStyle(), r = knifeVM.root;
    if (!k) return;
    r.position.set(0, 0, 0);
    if (!knifeVM.model) { knifePose(k.mode === 'slash' ? Math.min(1, t / K.time) : 0); return; }
    var tt;
    if (k.mode === 'slash') {
      var P = st.parts, left = t, i = 0;
      while (i < P.length - 1 && left > partLen(P[i])) { left -= partLen(P[i]); i++; }
      var p = P[i], u = Math.min(1, left / partLen(p));
      if (p[3] === 'out') u = 1 - (1 - u) * (1 - u); // brake: starts at 2× the part's rate, ends at rest
      tt = p[0] + (p[1] - p[0]) * u;
      if (p[3] === 'thrust') r.position.z = -0.17 * Math.sin(Math.PI * u); // in and out
      // across a cut (the next part starts at another pose): fade from where the last part ended
      if (i > 0 && P[i - 1][1] !== p[0] && left < K.partBlend && t >= K.blend) { k.last = tt; knifeVM.at(P[i - 1][1], tt, ease(left / K.partBlend)); return; }
    } else {
      var seg = C[k.mode];
      tt = Math.min(seg[1], seg[0] + t * seg[2]);
    }
    k.last = tt;
    if (k.mode === 'slash' && k.from != null && t < K.blend) knifeVM.at(k.from, tt, ease(t / K.blend));
    else if (k.mode === 'idle' && k.from != null && t < K.settle) knifeVM.at(k.from, tt, ease(t / K.settle));
    else knifeVM.at(tt);
  }
  function knifeLen(mode) {
    var K = TU.knife;
    if (!knifeVM.model) return mode === 'slash' ? K.time : mode === 'draw' ? 0.15 : 1e9;
    if (mode === 'slash') return knifeStyle().parts.reduce(function (a, p) { return a + partLen(p); }, 0);
    var C = K.clip[mode];
    return (C[1] - C[0]) / C[2];
  }
  function knifeHitT() { return knifeVM.model ? knifeStyle().hitAt : TU.knife.hitAt; }
  function updateKnife(dt, alive, inp) {
    var K = TU.knife;
    if (L.knCool > 0) L.knCool -= dt;
    var want = inp && inp.pressed && (inp.pressed('melee') || inp.pressed('w5'));
    if (!L.knOut) {
      if (want && alive && !BP.open && !L.thr && G.game && G.game.state === 'playing') knifeEquip();
      return;
    }
    if (!alive) { knifeHolster(); return; }
    if (inp && inp.pressed && inp.pressed('melee')) { knifeHolster(); return; }
    var k = L.kn;
    if (k.freeze) { knifeShow(k.t); return; } // tests: hold one pose
    k.t += dt;
    // hits: one time or a list of times into the attack
    var HT = knifeHitT(), hits = Array.isArray(HT) ? HT : [HT];
    while (k.mode === 'slash' && !k.hit && (k.hitN | 0) < hits.length && k.t >= hits[k.hitN | 0]) {
      k.hitN = (k.hitN | 0) + 1;
      if (k.hitN >= hits.length) k.hit = true;
      try { knifeHit(); } catch (e) { console.error('[arsenal] knife', e); }
    }
    if (k.mode !== 'idle' && k.t >= knifeLen(k.mode)) {
      if (k.mode === 'slash') L.knEndT = performance.now(); // the combo window starts here
      L.kn = k = { mode: 'idle', t: 0, hit: false, from: k.mode === 'draw' ? null : k.last };
    }
    if (k.mode === 'idle' && k.from != null && k.t >= K.settle) k.from = null; // settled
    if (k.mode === 'idle' && knifeVM.model) { var Ci = K.clip.idle; k.t = k.t % ((Ci[1] - Ci[0]) / Ci[2]); }
    var free = k.mode === 'idle' || (k.mode === 'draw' && k.t > knifeLen('draw') * 0.7) || k.mode === 'inspect';
    if (inp && inp.fire && free && !(L.knCool > 0) && !BP.open && !L.heal) {
      // start the attack from the pose on screen (cross-fade): right after the
      // last attack that is still its end pose (the settle has barely begun),
      // otherwise the idle/inspect pose
      var from = null;
      if (knifeVM.model) {
        var Cm = K.clip[k.mode] || K.clip.idle, cur = Math.min(Cm[1], Cm[0] + k.t * Cm[2]);
        // still settling from the last attack: the screen shows a mix of its end pose and the idle
        from = k.mode === 'idle' && k.from != null && typeof k.from === 'number' && k.t < K.settle ? { a: k.from, b: cur, w: ease(k.t / K.settle) } : cur;
      }
      // combo: soon after the last swing → the next one; after a pause → the first
      if (K.combo && K.styles.length > 1) L.knStyle = performance.now() - (L.knEndT || -1e9) < K.combo * 1000 ? ((L.knStyle | 0) + 1) % K.styles.length : 0;
      L.kn = k = { mode: 'slash', t: 0, hit: false, from: from };
      L.knCool = Math.max(knifeStyle().cool || K.cool, knifeLen('slash') * 0.85);
      G.events.emit('weapon:melee', { pos: G.player.pos });
    } else if (inp && inp.pressed && inp.pressed('reload') && k.mode !== 'slash') {
      // R: turn the knife over (inspect); with several attacks and no combo, also the next one
      if (K.styles.length > 1 && !K.combo) {
        L.knStyle = ((L.knStyle | 0) + 1) % K.styles.length;
        var h = hud(); h && h.message('Knife — ' + knifeStyle().label, 1.6);
        snd('ui_click', { gain: 0.5, pitch: 1.5 });
        if (ui) ui.last = '';
      }
      if (knifeVM.model && K.clip.inspect && k.mode !== 'inspect') L.kn = k = { mode: 'inspect', t: 0, hit: false };
    }
    knifeShow(k.t);
  }

  function showOnly(kind) {
    for (var k in guns) {
      var g = guns[k], on = k === kind && L.visible;
      if (g === rifle) rifle.setVisible(on); else g.setVisible(on);
    }
  }

  function requestSwitch(kind) {
    if (L.knOut) { if (L.owned[kind]) knifeHolster(kind === L.cur ? null : kind); return; }
    if (!L.owned[kind] || (kind === L.cur && !L.sw) || L.thr) return;
    if (L.sw && L.sw.to === kind) return;
    if (L.sw && L.sw.phase === 'raise') { L.sw = { phase: 'lower', t: 0, to: kind }; return; }
    if (L.sw) { L.sw.to = kind; return; }
    L.sw = { phase: 'lower', t: 0, to: kind };
  }
  function cycle(dir) {
    var order = TU.order.filter(function (k) { return L.owned[k]; });
    var at = order.indexOf(L.sw ? L.sw.to : L.cur);
    if (order.length < 2) return;
    requestSwitch(order[(at + dir + order.length) % order.length]);
  }

  // mouse wheel cycles weapons while playing
  addEventListener('wheel', function (e) {
    if (!G.game || G.game.state !== 'playing') return;
    if (G.input && !(G.input.locked || G.input.mode === 'drag')) return;
    L.wheel += e.deltaY;
  }, { passive: true });

  // ---- grenades ----
  var live = [];
  function nadeMesh(type) { return type === 'frag' ? kit.fragMesh() : type === 'emp' ? kit.empMesh() : kit.c4Mesh(); }
  function armedC4() { return live.filter(function (n) { return n.type === 'c4' && !n.dead; }); }

  function tryThrow() {
    var type = L.nadeType;
    if (type === 'c4' && armedC4().length) { detonateC4(); return; }
    if (L.thr || L.sw) return;
    if ((L.nades[type] | 0) <= 0) {
      var alt = TU.nadeOrder.filter(function (k) { return L.nades[k] > 0; })[0];
      var h = hud();
      if (!alt) { h && h.message('No grenades left', 1.4); snd('rifle_dry', { gain: 0.6, pitch: 1.3 }); return; }
      L.nadeType = alt; type = alt;
    }
    L.nades[type]--;
    L.thr = { t: 0, type: type, spawned: false };
    snd('rifle_dry', { gain: 0.5, pitch: type === 'c4' ? 0.8 : 1.5 });
  }

  function spawnNade(type) {
    var cam = G.camera, P = G.player;
    var eye = tmp.copy(P.eye || cam.position);
    var fwd = tmp2.set(0, 0, -1).applyQuaternion(cam.quaternion);
    var start = new lt.Vector3(0.16, -0.12, -0.42).applyQuaternion(cam.quaternion).add(eye);
    var dir = tmp3.copy(start).sub(eye), len = dir.length();
    dir.normalize();
    var block = G.physics.raycast(eye, dir, len + 0.1);
    if (block) start.copy(eye).addScaledVector(dir, Math.max(0, block.dist - 0.15));
    var vel = fwd.clone().multiplyScalar(TU.throwSpeed).addScaledVector(UP, TU.throwLift);
    if (P.vel) vel.addScaledVector(P.vel, 0.6);
    var m = nadeMesh(type);
    m.position.copy(start);
    world.add(m);
    live.push({ type: type, pos: start, vel: vel, mesh: m, t: 0, fuse: type === 'c4' ? Infinity : TU.nades[type].fuse, stuck: false, stuckTo: null, off: null, rest: false, lastBounce: 0, spin: new lt.Vector3((rng() - 0.5) * 18, (rng() - 0.5) * 10, (rng() - 0.5) * 18), dead: false, blink: 0 });
    snd('jump', { gain: 0.55, pitch: 1.7 });
  }

  function detonateC4() {
    var list = armedC4();
    list.forEach(function (n, k) { n.fuse = n.t + 0.08 + k * 0.12; });
    snd('ui_click', { gain: 1, pitch: 1.8 });
  }

  function blast(pos, radius, damage, selfScale) {
    var P = G.player, hits = 0;
    var en = G.enemies && G.enemies.list || [];
    for (var k = 0; k < en.length; k++) {
      var e = en[k];
      if (!e.alive) continue;
      var c = tmp.copy(e.pos); c.y += e.type === 'hound' ? 0.6 : 0;
      var d = c.distanceTo(pos);
      if (d > radius) continue;
      if (!G.physics.lineOfSight(tmp2.copy(pos).setY(pos.y + 0.25), c)) continue;
      var amount = damage * (0.3 + 0.7 * (1 - d / radius));
      var dir = tmp3.copy(c).sub(pos).normalize();
      var killed = e.damage(amount, c.clone(), dir.clone(), 'body') === true;
      hits++;
      G.events.emit('player:hitEnemy', { enemy: e, part: 'body', killed: killed, weak: false, explosive: true });
    }
    if (typeof SXU !== 'undefined' && SXU) hits += SXU.blast(pos, radius, damage, 'ally', { unitsOnly: true, fx: false });
    if (P && P.alive && selfScale > 0 && !(typeof SXU !== 'undefined' && SXU && SXU.pilot)) {
      var pc = tmp.copy(P.pos).setY(P.pos.y + 1), pd = pc.distanceTo(pos);
      if (pd < radius && G.physics.lineOfSight(tmp2.copy(pos).setY(pos.y + 0.25), pc)) P.damage(damage * selfScale * (1 - pd / radius), pos.clone());
    }
    return hits;
  }

  var shocks = [];
  var shockGeo = new lt.SphereGeometry(1, 28, 18);
  function shockwave(pos, radius) {
    var mat = new lt.ShaderMaterial({
      uniforms: { uA: { value: 1 } },
      vertexShader: 'varying float vF; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vec3 n = normalize(normalMatrix * normal); vF = 1.0 - abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uA; varying float vF; void main(){ float a = pow(vF, 2.5) * uA; gl_FragColor = vec4(vec3(0.35, 0.8, 1.0) * a * 6.0, 1.0); }',
      transparent: true, blending: lt.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    });
    var m = new lt.Mesh(shockGeo, mat);
    m.position.copy(pos); m.scale.setScalar(0.2); m.frustumCulled = false; m.renderOrder = 900;
    world.add(m);
    shocks.push({ m: m, t: 0, r: radius });
  }

  function emp(pos) {
    var conf = TU.nades.emp, n = 0;
    var en = G.enemies && G.enemies.list || [];
    for (var k = 0; k < en.length; k++) {
      var e = en[k];
      if (!e.alive) continue;
      var d = e.pos.distanceTo(pos);
      if (d > conf.radius) continue;
      n++;
      var dir = tmp3.copy(e.pos).sub(pos).normalize();
      if (e.type === 'gull') {
        // drones lose their rotors to the pulse and drop
        var killed = e.damage(999, e.pos.clone(), dir.clone(), 'body') === true;
        G.events.emit('player:hitEnemy', { enemy: e, part: 'body', killed: killed, weak: false, explosive: true });
      } else {
        e.sxStun = conf.stun;
        e.sxSpark = 0;
        var killedH = e.damage(conf.damage, e.pos.clone(), dir.clone(), 'body') === true;
        G.events.emit('player:hitEnemy', { enemy: e, part: 'body', killed: killedH, weak: false, explosive: true });
      }
    }
    if (typeof SXU !== 'undefined' && SXU) {
      SXU.list.forEach(function (u) {
        if (!u.alive || u.faction !== 'enemy') return;
        if (u.center(tmp).distanceTo(pos) > conf.radius + (u.radius || 3) * 0.5) return;
        n++;
        u.stun && u.stun(conf.stun * 0.6);
        var k2 = u.damage(conf.damage * 3, tmp.clone(), tmp.clone().sub(pos).normalize(), 'body', 'ally') === true;
        G.events.emit('player:hitEnemy', { enemy: u, part: 'body', killed: k2, weak: false, explosive: true });
      });
    }
    try { G.render.lightPool.flash(pos, 0x66ccff, 260, 16, 0.3); } catch (e) { }
    if (G.fx) {
      for (var s = 0; s < 6; s++) G.fx.sparks && G.fx.sparks(pos, tmp.set(rng() - 0.5, rng() * 0.8 + 0.2, rng() - 0.5).normalize(), 14);
      G.fx.smoke && G.fx.smoke(pos, { size: 0.9, life: 1.6, rise: 0.4, count: 3, alpha: 0.18 });
    }
    shockwave(pos, conf.radius);
    snd('relay_cut', { pos: pos, gain: 1, pitch: 1.35 });
    snd('explosion', { pos: pos, gain: 0.45, pitch: 1.9 });
    try { G.enemies.alert(pos, 28); } catch (e) { }
    var h = hud();
    if (h && n) h.feed('<b class="sx-pk">EMP</b> ' + n + (n > 1 ? ' machines' : ' machine') + ' hit');
    if (G.player && G.player.addShake) {
      var pd = G.player.pos.distanceTo(pos);
      if (pd < 14) G.player.addShake(0.35 * (1 - pd / 14));
    }
  }

  function explodeNade(n) {
    n.dead = true;
    world.remove(n.mesh);
    var pos = n.pos.clone();
    if (pos.y < -0.4) { G.fx && G.fx.splash && G.fx.splash(pos, 1.2); return; }
    if (n.type === 'emp') { emp(pos.setY(pos.y + 0.15)); return; }
    var conf = TU.nades[n.type];
    var size = n.type === 'c4' ? 1.7 : 1.15;
    pos.y += 0.12;
    try { G.fx && G.fx.explosion && G.fx.explosion(pos, size); } catch (e) { console.error('[arsenal] explosion fx', e); }
    if (G.fx && G.fx.debris) G.fx.debris(pos, { count: n.type === 'c4' ? 24 : 14, speed: 9, size: 0.05 });
    blast(pos, conf.radius, conf.damage, 0.5);
  }

  var rayDir = new lt.Vector3(), step = new lt.Vector3();
  function updateNades(dt) {
    var g = TU.gravity, en = G.enemies && G.enemies.list || [];
    for (var k = live.length - 1; k >= 0; k--) {
      var n = live[k];
      if (n.dead) { live.splice(k, 1); continue; }
      n.t += dt;
      if (n.stuck && n.stuckTo) {
        if (n.stuckTo.alive) n.pos.copy(n.stuckTo.pos).add(n.off);
        else { n.stuck = false; n.stuckTo = null; n.vel.set(0, 0, 0); n.rest = false; }
      }
      if (!n.stuck && !n.rest) {
        var sub = Math.max(1, Math.ceil(n.vel.length() * dt / 0.12));
        var h = dt / sub;
        for (var s = 0; s < sub && !n.rest && !n.stuck; s++) {
          n.vel.y -= g * h;
          step.copy(n.vel).multiplyScalar(h);
          var len = step.length();
          if (len < 1e-5) continue;
          rayDir.copy(step).divideScalar(len);
          var hit = G.physics.raycast(n.pos, rayDir, len + 0.05);
          if (n.type === 'c4' && n.t > 0.05) {
            var eh = null;
            try { eh = G.enemies.raycast(n.pos, rayDir, len + 0.1); } catch (e) { }
            if (eh && (!hit || eh.dist < hit.dist)) {
              n.stuck = true; n.stuckTo = eh.enemy; n.off = eh.point.clone().sub(eh.enemy.pos); n.pos.copy(eh.point);
              snd('impact_enemy', { pos: n.pos, gain: 0.6, pitch: 1.6 });
              break;
            }
          }
          if (hit && hit.dist <= len + 0.05) {
            var nrm = hit.normal || UP;
            n.pos.copy(hit.point).addScaledVector(nrm, 0.045);
            if (n.type === 'c4') {
              n.stuck = true; n.vel.set(0, 0, 0);
              n.mesh.quaternion.setFromUnitVectors(UP, nrm);
              snd('shell_bounce', { pos: n.pos, gain: 0.8, pitch: 0.5 });
              break;
            }
            var vn = n.vel.dot(nrm);
            if (vn < 0) n.vel.addScaledVector(nrm, -1.38 * vn);
            n.vel.multiplyScalar(0.62);
            n.spin.multiplyScalar(0.6);
            if (Math.abs(vn) > 1.6 && n.t - n.lastBounce > 0.08) {
              n.lastBounce = n.t;
              snd('shell_bounce', { pos: n.pos, gain: Math.min(1, 0.35 + Math.abs(vn) * 0.08), pitch: 0.48 });
            }
            if (nrm.y > 0.6 && n.vel.length() < 1.1) { n.rest = true; n.vel.set(0, 0, 0); }
          } else {
            n.pos.add(step);
          }
        }
        n.mesh.rotation.x += n.spin.x * dt; n.mesh.rotation.y += n.spin.y * dt; n.mesh.rotation.z += n.spin.z * dt;
        if (n.pos.y < -3) { n.dead = true; world.remove(n.mesh); G.fx && G.fx.splash && G.fx.splash(n.pos, 1); continue; }
      }
      n.mesh.position.copy(n.pos);
      if (n.type === 'c4') {
        var led = n.mesh.getObjectByName('led');
        n.blink += dt;
        if (led) led.visible = (n.blink % 0.8) < 0.12;
        if (n.stuck && n.blink % 0.8 < dt) snd('ui_click', { pos: n.pos, gain: 0.25, pitch: 2.2 });
      }
      if (n.t >= n.fuse) { explodeNade(n); live.splice(k, 1); }
    }
    for (var j = shocks.length - 1; j >= 0; j--) {
      var sh = shocks[j];
      sh.t += dt;
      var q = sh.t / 0.45;
      sh.m.scale.setScalar(0.3 + sh.r * Yo(Math.min(1, q)));
      sh.m.material.uniforms.uA.value = Math.max(0, 1 - q);
      if (q >= 1) { world.remove(sh.m); sh.m.material.dispose(); shocks.splice(j, 1); }
    }
  }

  // EMP stun: a stunned machine skips its own AI/animation update.
  function wrapEnemy(e) {
    if (!e || e.__sxa) return;
    e.__sxa = true;
    e.sxStun = 0;
    var up = e._update, act = e._activate;
    e._update = function (dt) {
      if (e.sxStun > 0 && e.alive) {
        e.sxStun -= dt;
        e.sxSpark = (e.sxSpark || 0) - dt;
        if (e.sxSpark <= 0) {
          e.sxSpark = 0.12 + rng() * 0.22;
          var p = tmp.copy(e.pos); p.y += e.type === 'hound' ? 0.7 : 0.1;
          G.fx && G.fx.sparks && G.fx.sparks(p, tmp2.set(rng() - 0.5, 1, rng() - 0.5).normalize(), 7);
          if (rng() < 0.35) { try { G.render.lightPool.flash(p, 0x66ccff, 14, 4, 0.06); } catch (er) { } }
        }
        return;
      }
      return up.apply(this, arguments);
    };
    e._activate = function () { e.sxStun = 0; return act.apply(this, arguments); };
  }
  var enemiesWrapped = false;
  function ensureEnemies() {
    if (enemiesWrapped || !G.enemies || !G.enemies.debug) return;
    enemiesWrapped = true;
    (G.enemies.debug.gulls || []).forEach(wrapEnemy);
    (G.enemies.debug.hounds || []).forEach(wrapEnemy);
  }

  // ---- pickups ----
  var pickups = [];
  var bounds = G.physics.bounds || { min: new lt.Vector3(-40, 0, -30), max: new lt.Vector3(40, 30, 30) };
  function blocked(x, y, z, r) {
    var boxes = G.physics.boxes || [];
    for (var k = 0; k < boxes.length; k++) {
      var b = boxes[k];
      if (b.max.y <= y + 0.03 || b.min.y > y + 1.2) continue;
      if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) return true;
    }
    return false;
  }
  function findSpot(center, rMin, rMax, seed, taken) {
    for (var k = 0; k < 48; k++) {
      var a = seed + k * 2.39996, r = rMin + (rMax - rMin) * ((k * 0.618034) % 1);
      var x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      if (x < bounds.min.x + 1 || x > bounds.max.x - 1 || z < bounds.min.z + 1 || z > bounds.max.z - 1) continue;
      var y = G.physics.groundHeight(x, z, center.y + 0.8);
      if (y < -0.3 || y > center.y + 0.6) continue;
      if (blocked(x, y, z, 0.42)) continue;
      if (!G.physics.lineOfSight(tmp.set(center.x, center.y + 0.6, center.z), tmp2.set(x, y + 0.5, z))) continue;
      var near = false;
      for (var t = 0; t < taken.length; t++) if (taken[t].distanceTo(tmp3.set(x, y, z)) < 1.6) near = true;
      if (near) continue;
      return new lt.Vector3(x, y, z);
    }
    return null;
  }
  function autoSpots() {
    var lv = G.level || {}, spots = [], taken = [];
    var add = function (kind, center, rMin, rMax, seed) {
      if (!center) return;
      var p = findSpot(center, rMin, rMax, seed, taken);
      if (p) { taken.push(p); spots.push({ kind: kind, pos: p }); }
    };
    var start = lv.playerStart && lv.playerStart.pos;
    var objs = lv.objectives || [];
    if (start) {
      var yaw = lv.playerStart.yaw || 0;
      var ahead = start.clone().add(new lt.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(6));
      add('shotgun', ahead, 1, 4, 0.3);
      add('ammo', start, 2.5, 5, 1.1);
      add('grenade', ahead, 2, 5, 2.2);
    }
    objs.forEach(function (o, k) {
      add('ammo', o.pos, 2.2, 5.5, k * 1.7 + 0.4);
      add('grenade', o.pos, 3, 7, k * 2.3 + 1.9);
    });
    var cover = lv.coverPoints || [];
    for (var c = 0; c < cover.length && spots.length < 14; c += 5) add(c % 2 ? 'grenade' : 'ammo', cover[c], 0.6, 2.5, c * 0.77);
    if (lv.extraction && lv.extraction.pos) add('ammo', lv.extraction.pos, 3, 7, 0.9);
    return spots;
  }

  // Medkits: a kit by each relay, small kits on the cover line, one large
  // kit at the extraction (and one by the start).
  function medSpots(existing) {
    var lv = G.level || {}, out = [], taken = existing.map(function (s) { return s.pos.isVector3 ? s.pos : new lt.Vector3(s.pos[0], s.pos[1], s.pos[2]); });
    var add = function (kind, center, rMin, rMax, seed) {
      if (!center) return;
      var p = findSpot(center, rMin, rMax, seed, taken);
      if (p) { taken.push(p); out.push({ kind: kind, pos: p }); }
    };
    (lv.objectives || []).forEach(function (o, k) { add('med', o.pos, 3.5, 8, k * 2.9 + 0.7); });
    var cover = lv.coverPoints || [];
    for (var c = 2, n = 0; c < cover.length && n < 5; c += 6, n++) add('med_s', cover[c], 0.8, 3, c * 1.31);
    if (lv.extraction && lv.extraction.pos) add('med_l', lv.extraction.pos, 4, 9, 2.4);
    if (lv.playerStart && lv.playerStart.pos) add('med_l', lv.playerStart.pos, 3, 7, 4.1);
    return out;
  }

  // Armor: Lv.1 helmet + vest by the start, Lv.2 at the first relays, Lv.3
  // at the last relay and the extraction (desert outposts add more).
  function armorSpots(existing) {
    var lv = G.level || {}, out = [], taken = existing.map(function (s) { return s.pos.isVector3 ? s.pos : new lt.Vector3(s.pos[0], s.pos[1], s.pos[2]); });
    var add = function (kind, center, rMin, rMax, seed) {
      if (!center) return;
      var p = findSpot(center, rMin, rMax, seed, taken);
      if (p) { taken.push(p); out.push({ kind: kind, pos: p }); }
    };
    var start = lv.playerStart && lv.playerStart.pos, objs = lv.objectives || [];
    if (start) { add('helm1', start, 2, 5, 6.1); add('vest1', start, 2, 5, 6.9); }
    objs.forEach(function (o, k) { add(k >= 2 ? 'vest3' : k ? 'helm2' : 'vest2', o.pos, 3, 8, k * 3.1 + 1.3); });
    if (lv.extraction && lv.extraction.pos) add('helm3', lv.extraction.pos, 3, 8, 3.7);
    return out;
  }

  // Backpacks on every map: Lv.1 by the start and the first relay (common),
  // Lv.2 at the middle relay, one Lv.3 by the extraction (rare)
  function packSpots(existing) {
    var lv = G.level || {}, out = [], taken = existing.map(function (s) { return s.pos.isVector3 ? s.pos : new lt.Vector3(s.pos[0], s.pos[1], s.pos[2]); });
    var add = function (kind, center, rMin, rMax, seed) {
      if (!center) return;
      var p = findSpot(center, rMin, rMax, seed, taken);
      if (p) { taken.push(p); out.push({ kind: kind, pos: p }); }
    };
    var start = lv.playerStart && lv.playerStart.pos, objs = lv.objectives || [], cover = lv.coverPoints || [];
    add('bag1', start, 3, 6, 8.3);
    if (objs[0]) add('bag1', objs[0].pos, 3, 8, 2.9);
    if (cover.length) add('bag1', cover[Math.floor(cover.length / 2)], 1, 4, 4.4);
    if (objs[1]) add('bag2', objs[1].pos, 3, 8, 7.7);
    var ex = lv.extraction && lv.extraction.pos || (objs[objs.length - 1] || {}).pos;
    add('bag3', ex, 4, 9, 5.9);
    return out;
  }

  // The sniper rifle and attachment cases, spread over the map.
  function gearSpots(existing) {
    var lv = G.level || {}, out = [], taken = existing.map(function (s) { return s.pos.isVector3 ? s.pos : new lt.Vector3(s.pos[0], s.pos[1], s.pos[2]); });
    var add = function (kind, center, rMin, rMax, seed) {
      if (!center) return;
      var p = findSpot(center, rMin, rMax, seed, taken);
      if (p) { taken.push(p); out.push({ kind: kind, pos: p }); }
    };
    var objs = lv.objectives || [], cover = lv.coverPoints || [];
    if (!existing.some(function (s) { return s.kind === 'sniper'; })) {
      add('sniper', objs[0] ? objs[0].pos : lv.playerStart && lv.playerStart.pos, 4, 9, 5.3);
      if (out.length) add('ammo:338', out[out.length - 1].pos, 0.8, 2.2, 3.3);
    }
    // calibre boxes for the guns you find on the map
    if (objs[1]) add('ammo:12g', objs[1].pos, 2, 6, 8.8);
    if (objs[2]) add('ammo:338', objs[2].pos, 2, 6, 9.4);
    // attachments: at random (gearCount of them), see SXA_TUNE.gear
    var R = TU.gear, rnd = gearRng(), n = gearCount();
    var centres = [].concat(cover, (lv.enemySpawns || []).filter(function (e) { return e.type === 'ground'; }).map(function (e) { return e.pos; }),
      existing.map(function (s2) { return s2.pos.isVector3 ? s2.pos : new lt.Vector3(s2.pos[0], s2.pos[1], s2.pos[2]); }), objs.map(function (o) { return o.pos; }))
      .filter(function (c2) { return c2 && isFinite(c2.x); });
    var kinds = Object.keys(R.kinds).filter(function (k2) { return SXA_ATT[k2]; }), total = kinds.reduce(function (a2, k2) { return a2 + R.kinds[k2]; }, 0);
    var pick = function () { var r2 = rnd() * total; for (var i2 = 0; i2 < kinds.length; i2++) { r2 -= R.kinds[kinds[i2]]; if (r2 <= 0) return kinds[i2]; } return kinds[0]; };
    var placed = [], tries = 0;
    while (placed.length < n && centres.length && tries++ < n * 12) {
      var c = centres[Math.floor(rnd() * centres.length)], p = findSpot(c, 0.8, 3.5, rnd() * 6.283, taken);
      if (!p || placed.some(function (q) { return q.distanceTo(p) < R.apart; })) continue;
      taken.push(p); placed.push(p);
      out.push({ kind: 'att:' + (placed.length <= Math.max(1, Math.round(n * R.x4Share)) && SXA_ATT.x4 ? 'x4' : pick()), pos: p });
    }
    return out;
  }
  // how many attachments: more players in the room, more of them
  function gearCount() {
    var R = TU.gear, n = 1;
    try { if (window.SXN_MP && typeof SXN_playerCount === 'function') n = SXN_playerCount(); } catch (e) { }
    return Math.min(R.max, R.base + R.perPlayer * Math.max(0, n - 1));
  }
  // the layout's dice: the same on every machine in a room (room code + round), fresh solo
  function gearRng() {
    var key = 'solo:' + Math.random();
    try { if (window.SXN_MP && typeof SXN !== 'undefined' && SXN.code) key = SXN.code + ':' + ((SXN.score && SXN.score.round) || 0) + ':' + (SXN.score && SXN.score.blue ? (SXN.score.blue.rw | 0) + (SXN.score.red.rw | 0) : 0); } catch (e) { }
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Rooms on a map with level.mpKit === 'pistol' (waterworks): everyone starts
  // with the knife and the M7 pistol only; the PAC-9 is picked up on the map.
  function pistolStart() { try { return !!(window.SXN_MP && G.level && G.level.mpKit === 'pistol'); } catch (e) { return false; } }
  function applyStartKit() {
    if (!pistolStart()) return;
    L.owned.rifle = false;
    L.ammo[SXA_GUN_CAL.rifle] = 0;
    L.cur = 'pistol'; L.last = 'pistol';
  }
  // the PAC-9 lying on the ground: a copy of the viewmodel's gun meshes (no
  // gloves, no red-dot lens), on the world layer, laid sideways like the others
  function rifleWorld() {
    var holder = new lt.Group(), g = new lt.Group();
    try {
      rifle.root.updateMatrixWorld(true);
      var inv = new lt.Matrix4().copy(rifle.root.matrixWorld).invert(), mm = new lt.Matrix4();
      rifle.root.traverse(function (o) {
        if (!o.isMesh || !o.geometry || !o.material || Array.isArray(o.material)) return;
        var mn = o.material.name || '';
        if (/glove|hand|sleeve|arm/i.test(mn) || o.material.isShaderMaterial || o.material.transparent || o.material.isMeshBasicMaterial) return;
        for (var a = o; a && a !== rifle.root; a = a.parent) if (a.visible === false) return;
        var m = new lt.Mesh(o.geometry, o.material);
        mm.multiplyMatrices(inv, o.matrixWorld);
        mm.decompose(m.position, m.quaternion, m.scale);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
      });
    } catch (e) { console.warn('[arsenal] rifle world model', e); }
    if (!g.children.length) return kit.shotgunWorld();
    var box = new lt.Box3().setFromObject(g), c = box.getCenter(new lt.Vector3());
    g.position.set(-c.x, -box.min.y + 0.02, -c.z);
    var mid = new lt.Group();
    mid.add(g);
    mid.rotation.set(0, Math.PI / 2, 0);
    holder.add(mid);
    holder.scale.setScalar(1.08);
    return holder;
  }
  function pickupModel(kind, isDrop) {
    var model = SXA_isCal(kind) ? kit.ammoBox(kind.slice(5)) : kind === 'ammo' ? (isDrop ? kit.pouch() : kit.ammoCrate()) : kind === 'grenade' ? (isDrop ? kit.fragMesh() : kit.nadeCrate())
      : kind === 'med_s' ? kit.medSmall() : kind === 'med' ? kit.medKit() : kind === 'med_l' ? kit.medLarge()
      : SXA_ARMOR[kind] ? (SXA_ARMOR[kind].slot === 'helmet' ? kit.helmet(SXA_ARMOR[kind].lv) : kit.vest(SXA_ARMOR[kind].lv))
      : SXA_PACKS[kind] ? kit.backpack(SXA_PACKS[kind].lv)
      : kind === 'sniper' ? kit.sniperWorld() : kind === 'rifle' ? rifleWorld() : kind.indexOf('att:') === 0 ? kit.attCase(kind.slice(4)) : kit.shotgunWorld();
    if (isDrop || model.userData.noShadow) model.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    return model;
  }
  // the props finished loading after pickups were placed: swap their models
  SXA_propsSwap = function () {
    pickups.forEach(function (p) {
      if (p.kind === 'shotgun' || p.kind === 'sniper' || p.kind === 'rifle') return;
      var nm = pickupModel(p.kind, p.isDrop), old = p.model;
      nm.position.copy(old.position); nm.rotation.copy(old.rotation); nm.visible = old.visible;
      p.holder.remove(old); p.holder.add(nm); p.model = nm;
    });
  };
  function makePickup(kind, pos, isDrop) {
    var holder = new lt.Group();
    var model = pickupModel(kind, isDrop);
    holder.add(model);
    var bk = SXA_isCal(kind) ? 'ammo' : kind === 'shotgun' || kind === 'sniper' || kind === 'rifle' ? 'weapon' : SXA_MEDS[kind] ? 'med' : SXA_ARMOR[kind] || SXA_PACKS[kind] ? 'armor' : kind.indexOf('att:') === 0 ? 'att' : kind;
    var bc = kit.beacon(bk, isDrop ? 0.55 : kind === 'shotgun' || kind === 'sniper' || kind === 'rifle' || kind === 'med_l' ? 1 : kind === 'med_s' || bk === 'att' ? 0.65 : bk === 'armor' ? 0.8 : 0.95);
    holder.add(bc);
    holder.position.copy(pos);
    if (!isDrop) holder.rotation.y = rng() * Math.PI * 2;
    world.add(holder);
    return { n: SXA_isCal(kind) ? SXA_CAL[kind.slice(5)].box : undefined, kind: kind, pos: pos.clone(), holder: holder, model: model, beacon: bc, active: true, respawn: 0, isDrop: !!isDrop, ttl: isDrop ? TU.dropLife : Infinity, vy: 0, ground: pos.y, falling: false, phase: rng() * 6.28 };
  }

  function placePickups() {
    pickups.forEach(function (p) { world.remove(p.holder); });
    pickups = [];
    var lv = G.level || {};
    var spots = Array.isArray(lv.pickupSpots) && lv.pickupSpots.length ? lv.pickupSpots.slice() : autoSpots();
    // attachments are scattered at random (gearSpots), not at the map's fixed spots
    spots = spots.filter(function (s0) { return typeof s0.kind !== 'string' || s0.kind.indexOf('att:') !== 0; });
    if (!spots.some(function (s) { return SXA_MEDS[s.kind]; })) spots = spots.concat(medSpots(spots));
    spots = spots.concat(gearSpots(spots));
    if (!spots.some(function (s) { return SXA_ARMOR[s.kind]; })) spots = spots.concat(armorSpots(spots));
    if (!spots.some(function (s) { return SXA_PACKS[s.kind]; })) spots = spots.concat(packSpots(spots));
    spots.forEach(function (s) {
      var kind = s.kind === 'weapon' || s.kind === 'weapon:shotgun' ? 'shotgun' : s.kind;
      if (kind !== 'ammo' && !SXA_isCal(kind) && kind !== 'grenade' && kind !== 'shotgun' && kind !== 'sniper' && kind !== 'rifle' && !SXA_MEDS[kind] && !SXA_ARMOR[kind] && !SXA_PACKS[kind] && !(kind.indexOf('att:') === 0 && SXA_ATT[kind.slice(4)])) return;
      var pos = s.pos.isVector3 ? s.pos.clone() : new lt.Vector3(s.pos[0], s.pos[1], s.pos[2]);
      pickups.push(makePickup(kind, pos, false));
    });
    console.log('[arsenal] pickups ' + pickups.map(function (p) { return p.kind + '@' + p.pos.x.toFixed(1) + ',' + p.pos.z.toFixed(1); }).join(' '));
  }

  // the generic 'ammo' pickup (map crates, outposts): a mixed crate giving
  // each calibre your guns use; a loose generic one (old map data) = a box
  // for the gun in hand
  function giveAmmo(fromCrate) {
    var parts = [], seen = {};
    var cals = fromCrate ? TU.order.filter(function (k) { return L.owned[k]; }).map(function (k) { return SXA_GUN_CAL[k]; }) : [SXA_GUN_CAL[L.cur]];
    cals.forEach(function (c) {
      if (seen[c]) return;
      seen[c] = 1;
      var C = SXA_CAL[c], add = Math.min(fromCrate ? C.crate : C.box, bagRoom('ammo', c));
      if (add > 0) { L.ammo[c] += add; parts.push('<b class="sx-pk">+' + add + '</b> ' + C.label); }
    });
    return parts.length ? parts.join(' &nbsp;') : null;
  }
  function giveNades(fromCrate) {
    var parts = [], gave = false;
    var order = fromCrate ? TU.nadeOrder : [rng() < 0.6 ? 'frag' : rng() < 0.6 ? 'emp' : 'c4'];
    order.forEach(function (k) {
      var conf = TU.nades[k], add = Math.max(0, Math.min(fromCrate ? conf.crate : 1, bagRoom('nade', k)));
      if (add > 0) { L.nades[k] += add; gave = true; parts.push('<b class="sx-pk">+' + add + '</b> ' + conf.label); }
    });
    if (!gave && !fromCrate) {
      // the rolled type is full: try the others
      for (var j = 0; j < TU.nadeOrder.length && !gave; j++) {
        var kk = TU.nadeOrder[j], cf = TU.nades[kk];
        if (bagRoom('nade', kk) > 0) { L.nades[kk]++; gave = true; parts.push('<b class="sx-pk">+1</b> ' + cf.label); }
      }
    }
    return gave ? parts.join(' &nbsp;') : null;
  }

  function collect(p) {
    var r = collect0(p);
    if (r && r !== 'partial') pickToast(p, r);
    else if (r === 'partial') pickToast(p, p._partMsg || '');
    return r === true || (typeof r === 'string' && r !== 'partial');
  }
  // returns the detail text (truthy) when it was taken, false when it can't be
  function collect0(p) {
    var h = hud(), msg = null;
    if (SXA_isCal(p.kind)) {
      // a box of one calibre: into its stack, whether or not you own the gun
      var cal = p.kind.slice(5), C = SXA_CAL[cal], want = p.n != null ? p.n : C.box, roomA = bagRoom('ammo', cal);
      if (roomA <= 0 || want <= 0) return false;
      var addA = Math.min(want, roomA);
      L.ammo[cal] += addA;
      p.n = want - addA;
      snd('reload_magin', { gain: 0.9, pitch: 1.15 });
      var txtA = C.label + ' ×' + addA + ' (' + gunShort(C.gun) + ')';
      if (p.n > 0) { p._partMsg = txtA + ' · ' + p.n + ' left — bag full'; return 'partial'; }
      return txtA;
    }
    if (p.give && p.give.nade) {
      var nk = p.give.nade, room = bagRoom('nade', nk);
      if (room <= 0) return false;
      var addN = Math.min(room, p.give.n);
      L.nades[nk] = (L.nades[nk] | 0) + addN;
      p.give.n -= addN;
      snd('shell_bounce', { gain: 0.9, pitch: 0.6 });
      if (p.give.n > 0) { p._partMsg = '+' + addN + ' ' + TU.nades[nk].label; return 'partial'; }
      return '+' + addN + ' ' + TU.nades[nk].label;
    }
    if (SXA_PACKS[p.kind]) {
      // a bigger backpack replaces the worn one, which drops at your feet
      var pk = SXA_PACKS[p.kind], old = L.pack | 0;
      if (pk.lv <= old) return false;
      L.pack = pk.lv;
      if (old) dropPack(old);
      snd('reload_bolt', { gain: 0.8, pitch: 0.5 });
      return 'capacity ' + bagCap() + (old ? ' · Lv.' + old + ' dropped' : '');
    }
    if (p.kind.indexOf('att:') === 0) {
      var aid = p.kind.slice(4), fitted = fitAttachment(aid);
      if (!fitted) return false;
      msg = '<b class="sx-pk">' + SXA_ATT[aid].label + '</b> → ' + (fitted.bag ? 'bag' + (SXA_ATT[aid].slot === 'optic' ? ' · B to swap scope' : '') : fitted.short);
      snd('reload_bolt', { gain: 0.6, pitch: 1.6 });
    } else if (SXA_ARMOR[p.kind]) {
      // wear it if it is better than what you have on (higher level, or the
      // same level when yours is worn below 70%)
      var ad = SXA_ARMOR[p.kind], on = L.armor[ad.slot];
      if (on) { var od = SXA_ARMOR[on.id]; if (od.lv > ad.lv || (od.lv === ad.lv && on.dur >= ad.dur * 0.7)) return false; }
      L.armor[ad.slot] = { id: p.kind, dur: ad.dur, hitT: 0 };
      msg = '<b class="sx-pk">' + ad.label + '</b> on · −' + Math.round(armorCut() * 100) + '% damage';
      snd('reload_bolt', { gain: 0.85, pitch: 0.62 });
      if (!L.armorHinted) { L.armorHinted = true; h && h.message('Helmet + vest stack: they soak damage until they break', 3.2); }
    } else if (p.kind === 'sniper') {
      if (!L.owned.sniper) {
        L.owned.sniper = true;
        guns.sniper.reset();
        applyAttachments('sniper');
        guns.sniper.ammo = guns.sniper.magSize;
        guns.sniper.reserve += Math.min(TU.sniper.pickup, bagRoom('ammo', 'sniper'));
        fitFromBag('sniper');
        msg = '<b class="sx-pk">' + TU.sniper.name + '</b> picked up';
        requestSwitch('sniper');
        h && h.message('4 — sniper · right mouse — scope', 3);
      } else {
        var addS = Math.max(0, Math.min(TU.sniper.crate, bagRoom('ammo', 'sniper')));
        if (addS <= 0) return false;
        guns.sniper.reserve += addS;
        msg = '<b class="sx-pk">+' + addS + '</b> ' + TU.sniper.short;
      }
      snd('reload_bolt', { gain: 1, pitch: 0.8 });
    } else if (p.kind === 'rifle') {
      if (!L.owned.rifle) {
        L.owned.rifle = true;
        applyAttachments('rifle');
        rifle.ammo = rifle.magSize || 30;
        L.ammo[SXA_GUN_CAL.rifle] += Math.max(0, Math.min(TU.rifle.pickup, bagRoom('ammo', 'rifle')));
        fitFromBag('rifle');
        msg = '<b class="sx-pk">PAC-9</b> picked up';
        requestSwitch('rifle');
        h && h.message('1 — rifle · 3 — pistol · V — knife', 3);
      } else {
        var addR = Math.max(0, Math.min(TU.rifle.crate, bagRoom('ammo', 'rifle')));
        if (addR <= 0) return false;
        L.ammo[SXA_GUN_CAL.rifle] += addR;
        msg = '<b class="sx-pk">+' + addR + '</b> 5.56';
      }
      snd('reload_bolt', { gain: 1, pitch: 0.9 });
    } else if (p.kind === 'shotgun') {
      if (!L.owned.shotgun) {
        L.owned.shotgun = true;
        guns.shotgun.reset();
        guns.shotgun.reserve += Math.min(TU.shotgun.pickup, bagRoom('ammo', 'shotgun'));
        fitFromBag('shotgun');
        msg = '<b class="sx-pk">' + TU.shotgun.name + '</b> picked up';
        requestSwitch('shotgun');
        h && h.message('2 — shotgun · 1 — rifle · 3 — pistol', 3);
      } else {
        var add = Math.max(0, Math.min(TU.shotgun.crate, bagRoom('ammo', 'shotgun')));
        if (add <= 0) return false;
        guns.shotgun.reserve += add;
        msg = '<b class="sx-pk">+' + add + '</b> ' + TU.shotgun.short;
      }
      snd('reload_bolt', { gain: 1, pitch: 0.95 });
    } else if (SXA_MEDS[p.kind]) {
      // a kit that helps right now is used on the spot; otherwise it goes
      // into the bag for later (H or 7/8/9)
      var PL = G.player, gain = healTarget(p.kind) - PL.health;
      if (gain > 0.5 && !L.heal) {
        PL.heal(gain);
        msg = '<b class="sx-pk">+' + Math.round(gain) + '</b> HP · used on the spot';
        snd('reload_magin', { gain: 0.9, pitch: 0.75 });
        return msg;
      }
      if (bagRoom('med', p.kind) < 1) return false;
      L.meds[p.kind] = (L.meds[p.kind] | 0) + 1;
      msg = '<b class="sx-pk">+1</b> ' + SXA_MEDS[p.kind] + ' (bag)';
      snd('reload_magin', { gain: 0.8, pitch: 0.8 });
      if (!L.medHinted) { L.medHinted = true; h && h.message((G.input && G.input.touch ? 'MED' : 'H') + ' — use a medkit · 7 / 8 / 9 — small / kit / large', 3.5); }
    } else if (p.kind === 'ammo') {
      msg = giveAmmo(!p.isDrop);
      if (!msg) return false;
      snd('reload_magin', { gain: 0.9, pitch: 1.15 });
    } else {
      msg = giveNades(!p.isDrop);
      if (!msg) return false;
      snd('shell_bounce', { gain: 0.9, pitch: 0.6 });
    }
    return msg || true;
  }

  function spawnDrop(kind, pos) {
    // a hard cap on loose items in the world (dropping a whole backpack, a
    // big fight): the oldest robot drop goes first, a player's own drop last
    var live2 = pickups.filter(function (p) { return p.isDrop && p.active; });
    if (live2.length >= TU.maxDrops) {
      var old = live2.filter(function (p) { return !p.byPlayer; })[0] || live2[0];
      old.active = false; world.remove(old.holder);
    }
    var start = pos.clone();
    var gy = G.physics.groundHeight(start.x, start.z, start.y + 0.5);
    if (gy < -0.5) return;
    var p = makePickup(kind, start, true);
    p.ground = gy;
    p.falling = start.y > gy + 0.05;
    pickups.push(p);
    return p;
  }

  G.events.on('enemy:killed', function (ev) {
    try {
      var e = ev && ev.enemy, pos = ev && ev.pos || e && e.pos;
      if (!pos) return;
      var type = ev.type || e && e.type;
      if (ev.big) {
        // a big unit: drop a large medkit, ammo and grenades round its wreck
        var base = tmp3.copy(pos);
        var ring = function (k) { var a = k * 2.1 + rng(); return new lt.Vector3(base.x + Math.cos(a) * 3, base.y + 0.5, base.z + Math.sin(a) * 3); };
        spawnDrop('med_l', ring(0)); spawnDrop('grenade', ring(2));
        // a bit of every calibre
        SXA_CAL_ORDER.forEach(function (c, i) { var d = spawnDrop('ammo:' + c, ring(5 + i)); if (d) d.n = SXA_CAL[c].box * 2; });
        spawnDrop(rng() < 0.5 ? 'vest3' : 'helm3', ring(3));
        spawnDrop('bag3', ring(4));
        return;
      }
      var pAmmo = type === 'hound' ? 0.75 : 0.42, pNade = type === 'hound' ? 0.3 : 0.14, pMed = type === 'hound' ? 0.24 : 0.1;
      var trooper = (e && e.type === 'trooper') || String(type || '').toLowerCase().indexOf('trooper') >= 0;
      // humanoid troopers carry armor: heavies a vest, marksmen a helmet
      if (trooper) {
        var vr = e && e.variant, ar = null;
        if (vr === 'heavy') ar = rng() < 0.32 ? 'vest2' : null;
        else if (vr === 'marksman') ar = rng() < 0.28 ? 'helm2' : null;
        else if (rng() < 0.1) ar = rng() < 0.5 ? 'helm1' : 'vest1';
        if (ar) spawnDrop(ar, tmp.copy(pos).add(tmp2.set(rng() - 0.5, 0.3, rng() - 0.5)));
        // now and then a backpack (Lv.1, sometimes Lv.2)
        if (rng() < SXA_TUNE.bag.trooperDrop) spawnDrop(rng() < 0.3 ? 'bag2' : 'bag1', tmp.copy(pos).add(tmp2.set(rng() - 0.5, 0.3, rng() - 0.5)));
      }
      if (rng() < (trooper ? 0.2 : 0.06)) spawnDrop('att:' + SXA_ATT_ORDER[Math.floor(rng() * SXA_ATT_ORDER.length)], tmp.copy(pos).add(tmp2.set(rng() - 0.5, 0.3, rng() - 0.5)));
      // ammo of the calibre it fired: rifle troopers 5.56, marksmen .338,
      // heavies 12 GA or 5.56; drones and dogs anything, mostly 5.56
      if (rng() < pAmmo) {
        var vr2 = e && e.variant, rc = rng();
        var calD = trooper ? (vr2 === 'marksman' ? '338' : vr2 === 'heavy' ? (rc < 0.5 ? '12g' : '556') : '556')
          : rc < 0.5 ? '556' : rc < 0.7 ? '50ae' : rc < 0.85 ? '12g' : '338';
        spawnDrop('ammo:' + calD, tmp.copy(pos).add(tmp2.set(rng() - 0.5, 0.3, rng() - 0.5)));
      }
      if (rng() < pNade) spawnDrop('grenade', tmp.copy(pos).add(tmp2.set(rng() - 0.5, 0.3, rng() - 0.5)));
      if (rng() < pMed) spawnDrop('med_s', tmp.copy(pos).add(tmp2.set(rng() - 0.5, 0.3, rng() - 0.5)));
    } catch (er) { console.error('[arsenal] drop', er); }
  });

  function updatePickups(dt) {
    var P = G.player, t = G.time ? G.time.t : 0;
    kit.beaconMats.ammo.uniforms.uTime.value = t;
    kit.beaconMats.grenade.uniforms.uTime.value = t;
    kit.beaconMats.weapon.uniforms.uTime.value = t;
    kit.ringMats.ammo.uniforms.uTime.value = t;
    kit.ringMats.grenade.uniforms.uTime.value = t;
    kit.ringMats.weapon.uniforms.uTime.value = t;
    kit.beaconMats.med.uniforms.uTime.value = t;
    kit.ringMats.med.uniforms.uTime.value = t;
    kit.beaconMats.armor.uniforms.uTime.value = t;
    kit.ringMats.armor.uniforms.uTime.value = t;
    kit.syncBeacons(pickups);
    L.fullMsgT -= dt;
    var piloting = typeof SXU !== 'undefined' && SXU && SXU.pilot;
    for (var k = pickups.length - 1; k >= 0; k--) {
      var p = pickups[k];
      if (!p.active) {
        if (p.isDrop) { pickups.splice(k, 1); continue; }
        p.respawn -= dt;
        if (p.respawn <= 0 && (!P || P.pos.distanceTo(p.pos) > 6)) { p.active = true; p.holder.visible = true; }
        continue;
      }
      if (p.ammoT > 0) p.ammoT -= dt;
      if (p.falling) {
        p.vy -= 14 * dt;
        p.holder.position.y += p.vy * dt;
        if (p.holder.position.y <= p.ground) { p.holder.position.y = p.ground; p.falling = false; p.pos.y = p.ground; }
      }
      // gentle float + spin for weapons and drops
      if (p.kind === 'shotgun' || p.kind === 'sniper' || p.kind === 'rifle') { p.model.position.y = 0.72 + Math.sin(t * 2 + p.phase) * 0.05; p.model.rotation.y += dt * 0.9; }
      else if ((p.kind.indexOf('att:') === 0 || SXA_ARMOR[p.kind] || SXA_PACKS[p.kind] || SXA_isCal(p.kind)) && !p.isDrop) { p.model.position.y = 0.05 + Math.sin(t * 2.2 + p.phase) * 0.03; p.model.rotation.y += dt * 0.7; }
      else if (p.isDrop) { p.model.position.y = 0.22 + Math.sin(t * 2.6 + p.phase) * 0.04; p.model.rotation.y += dt * 1.4; }
      if (p.isDrop) {
        p.ttl -= dt;
        p.holder.visible = p.ttl > 5 || (p.ttl * 4) % 1 > 0.35;
        if (p.ttl <= 0) { p.active = false; world.remove(p.holder); continue; }
      }
      // far crates: only the beacon shows (saves draw calls)
      if (P) { var far = Math.abs(P.pos.x - p.holder.position.x) + Math.abs(P.pos.z - p.holder.position.z) > 70; if (p.model.visible === far) p.model.visible = !far; }
      if (!P || !P.alive || p.falling || piloting) continue;
      var dx = P.pos.x - p.holder.position.x, dz = P.pos.z - p.holder.position.z, dy = P.pos.y - p.holder.position.y;
      if (p.mustLeave) { if (dx * dx + dz * dz > 2.6 * 2.6) p.mustLeave = false; else continue; }
      if (dx * dx + dz * dz < 1.25 * 1.25 && Math.abs(dy) < 1.6) {
        // rooms: a gun on the map (PAC-9, shotgun, sniper) stays there. Without
        // that gun you take the gun; carrying it, you only take its ammo as
        // before — the gun itself is never taken twice. Either way that spot
        // then gives no ammo for p.ammoT s (the old 90 s respawn). After a
        // respawn (the gun is gone) you can arm from it again at once.
        var station = !!window.SXN_MP && !p.isDrop && (p.kind === 'rifle' || p.kind === 'shotgun' || p.kind === 'sniper');
        var had = station && !!L.owned[p.kind];
        if (had && p.ammoT > 0) continue;
        var took = collect(p);
        if (took && station) { p.ammoT = TU.crateRespawn * 1.5; continue; } // it stays on the map
        if (!took && p.give && p._partMsg) { p._partMsg = null; L.fullMsgT = 4; continue; }
        if (took) {
          p.active = false;
          if (p.isDrop) world.remove(p.holder);
          else {
            p.holder.visible = false;
            p.respawn = (p.kind === 'shotgun' && L.owned.shotgun) || (p.kind === 'sniper' && L.owned.sniper) || (p.kind === 'rifle' && L.owned.rifle) ? TU.crateRespawn * 1.5 : p.kind.indexOf('att:') === 0 ? 120 : SXA_ARMOR[p.kind] || SXA_PACKS[p.kind] ? TU.armor.respawn : p.kind === 'med_s' ? TU.med.respawnSmall : p.kind === 'med' ? TU.med.respawnKit : p.kind === 'med_l' ? TU.med.respawnLarge : TU.crateRespawn;
          }
        } else if (L.fullMsgT <= 0) {
          L.fullMsgT = 4;
          var h = hud();
          var need = needSize(p), full = SXA_PACKS[p.kind] ? 'Already carrying ' + (SXA_PACKS[p.kind].lv === L.pack ? 'this' : 'a better') + ' backpack (Lv.' + L.pack + ')'
            : need > 0 && bagFree() < need ? 'Backpack full — ' + itemName(p.kind, p) + ' needs ' + need + ' (' + Math.round(bagUsed()) + ' / ' + bagCap() + ')'
            : SXA_ARMOR[p.kind] ? 'Already wearing ' + SXA_ARMOR[L.armor[SXA_ARMOR[p.kind].slot].id].label
            : p.kind.indexOf('att:') === 0 ? SXA_ATT[p.kind.slice(4)].label + ': bag full (' + TU.spareMax + ')' : p.kind === 'grenade' ? 'Grenades full' : SXA_MEDS[p.kind] ? 'Can\'t carry more: ' + SXA_MEDS[p.kind] + ' (' + TU.med.carry[p.kind] + ')' : 'Ammo full';
          h && h.message(full, 1.6);
        }
      }
    }
  }

  // ---- attachments ----
  function attFrom(kind) { var a = L.att[kind] || {}; var out = []; for (var sl in a) if (a[sl]) out.push(SXA_ATT[a[sl]]); return out; }
  // The PAC-9's own red-dot sight, lifted off its receiver: every triangle of
  // the rifle's meshes inside the sight's box (base clamp, hood, front frame,
  // turret, screws) plus its lens — the shader that draws the dot at infinity
  // along the sight's axis, so it lines up wherever the sight sits. The M7's
  // red dot attachment is this sight, scaled to the slide (k). Built once.
  var PAC9_SIGHT = { box: { x0: -0.033, x1: 0.033, y0: 0.0445, y1: 0.095, z0: -0.047, z1: 0.004 }, base: [0, 0.0435, -0.021], k: 0.8, parts: null };
  function pac9SightParts() {
    if (PAC9_SIGHT.parts) return PAC9_SIGHT.parts;
    var out = [], B = PAC9_SIGHT.box;
    rifle.root.updateMatrixWorld(true);
    var inv = new lt.Matrix4().copy(rifle.root.matrixWorld).invert(), mm = new lt.Matrix4();
    rifle.root.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.material || Array.isArray(o.material)) return;
      if (/glove|hand|sleeve/i.test(o.material.name || '')) return;
      // (the red dot's lens may be hidden right now: the 4x scope is on the PAC-9)
      var hid = S4.cut && S4.cut.some(function (c) { return c.mesh === o && c.lens; });
      for (var a = o; a && a !== rifle.root; a = a.parent) if ((a.visible === false && !(hid && a === o)) || a === rifle.mounts.root) return;
      var src0 = S4.cut && S4.cut.filter(function (c) { return c.mesh === o && c.full; })[0];
      var g = (src0 ? src0.full : o.geometry);
      g = g.index ? g.toNonIndexed() : g.clone();
      mm.multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(mm);
      var pa = g.attributes.position, keep = [];
      for (var t = 0; t + 2 < pa.count; t += 3) {
        var cx = (pa.getX(t) + pa.getX(t + 1) + pa.getX(t + 2)) / 3, cy = (pa.getY(t) + pa.getY(t + 1) + pa.getY(t + 2)) / 3, cz = (pa.getZ(t) + pa.getZ(t + 1) + pa.getZ(t + 2)) / 3;
        if (cx > B.x0 && cx < B.x1 && cy > B.y0 && cy < B.y1 && cz > B.z0 && cz < B.z1) keep.push(t);
      }
      if (!keep.length) return;
      var ng = new lt.BufferGeometry();
      for (var nm in g.attributes) {
        var at = g.attributes[nm], arr = new Float32Array(keep.length * 3 * at.itemSize), w = 0;
        keep.forEach(function (t0) { for (var j = 0; j < 3; j++) for (var c = 0; c < at.itemSize; c++) arr[w++] = at.getComponent(t0 + j, c); });
        ng.setAttribute(nm, new lt.BufferAttribute(arr, at.itemSize));
      }
      ng.computeBoundingSphere();
      out.push({ geo: ng, mat: o.material, lens: !!o.material.isShaderMaterial });
    });
    PAC9_SIGHT.parts = out;
    return out;
  }
  function pac9Sight(mt) {
    var parts = pac9SightParts(), S = PAC9_SIGHT, k = S.k, g = new lt.Group();
    if (!parts.some(function (p) { return p.lens; })) throw new Error('PAC-9 sight lens not found');
    parts.forEach(function (p) {
      var m = new lt.Mesh(p.geo, p.mat);
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = !p.lens;
      if (p.lens) m.renderOrder = 2;
      g.add(m);
    });
    g.scale.setScalar(k);
    g.position.set(mt.at[0] - k * S.base[0], mt.at[1] - k * S.base[1], mt.at[2] - k * S.base[2]);
    g.name = 'pac9-sight';
    return g;
  }
  // ---- the PAC-9's 4x scope (SXA_S4M) ----
  // The model's frame is read off its geometry: the optical axis runs through
  // the two thin glass discs (its lenses), the base is its lowest point, its
  // length sets the scale. The scope sits on the rail where the red dot was
  // (the red dot comes off the receiver while it is on), the aim pose drops to
  // its axis and the reticle is drawn at the objective lens: you look through
  // the eyepiece at the world zoomed 4x — no sniper overlay.
  var S4 = { info: null, cut: null, on: false };
  var qv0 = (function () { try { return qv.p.slice(); } catch (e) { return null; } })();
  function scope4xInfo() {
    if (S4.info) return S4.info;
    var root = SXA_S4M.scene;
    root.updateMatrixWorld(true);
    var box = new lt.Box3().setFromObject(root), lenses = [];
    root.traverse(function (o) {
      if (!o.isMesh || !o.material || !o.material.transparent) return;
      var b = new lt.Box3().setFromObject(o), sz = b.getSize(new lt.Vector3());
      if (sz.z < Math.min(sz.x, sz.y) * 0.2) lenses.push({ c: b.getCenter(new lt.Vector3()), r: Math.min(sz.x, sz.y) / 2 });
    });
    if (lenses.length < 2) throw new Error('4x scope lenses not found');
    lenses.sort(function (p, q) { return p.c.z - q.c.z; });
    var T = TU.scope4x, k = T.len / (box.max.z - box.min.z), lo = lenses[0], hi = lenses[lenses.length - 1];
    var ax = (lo.c.x + hi.c.x) / 2, ay = (lo.c.y + hi.c.y) / 2, mz = (box.min.z + box.max.z) / 2;
    // model +z is the gun's forward (-z) unless flipped; the objective = the forward lens
    var fwd = T.flip ? 1 : -1, obj = T.flip ? lo : hi;
    S4.info = { k: k, ax: ax, ay: ay, base: box.min.y, mz: mz, fwd: fwd, objZ: (obj.c.z - mz) * k * fwd, objR: obj.r * k, axisH: (ay - box.min.y) * k };
    return S4.info;
  }
  function scope4x(mt) {
    var I = scope4xInfo(), T = TU.scope4x, rail = mi.railTop || 0.0435;
    var outer = new lt.Group(), inner = SXA_S4M.scene.clone(true);
    if (!S4.glass) {
      // the model's glass reads as white haze against the sky: dark coated
      // lenses, a faint smoked cover on the fibre optic
      S4.glass = true;
      SXA_S4M.scene.traverse(function (o) {
        if (!o.isMesh || !o.material || !o.material.transparent) return;
        var mt2 = o.material, b = new lt.Box3().setFromObject(o).getSize(new lt.Vector3()), lens = b.z < Math.min(b.x, b.y) * 0.2;
        if (mt2.color) mt2.color.set(lens ? 0x14242a : 0x30383a);
        mt2.opacity = lens ? 0.9 : 0.35; mt2.metalness = lens ? 0.65 : 0.2; mt2.roughness = 0.12; mt2.depthWrite = lens;
        mt2.needsUpdate = true;
      });
    }
    inner.position.set(-I.ax, -I.base, -I.mz);
    var mid = new lt.Group();
    mid.add(inner);
    mid.scale.setScalar(I.k);
    mid.rotation.y = I.fwd < 0 ? Math.PI : 0; // model +z forward: turned round onto the gun's -z
    mid.position.set(0, rail, T.z);
    outer.add(mid);
    mid.traverse(function (o) { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = true; if (o.material && o.material.transparent) o.renderOrder = 2; } });
    // the reticle at the objective lens, on the axis (a red chevron, a fine black
    // crosshair and a post below it)
    var R = T.reticle, ly = rail + I.axisH, lz = T.z + I.objZ + 0.001;
    var red = viewMats.ret, blk = new lt.MeshBasicMaterial({ color: 0x050505, side: lt.DoubleSide });
    var bar = function (mat, w, h, x, y, rz) { var m = new lt.Mesh(new lt.PlaneGeometry(w, h), mat); m.position.set(x, y, lz); m.rotation.z = rz || 0; m.renderOrder = 3; outer.add(m); return m; };
    var c = R.chevron, aSlope = 0.62;
    bar(red, c, R.bar, -c * 0.5 * Math.cos(aSlope), ly - c * 0.5 * Math.sin(aSlope), aSlope);
    bar(red, c, R.bar, c * 0.5 * Math.cos(aSlope), ly - c * 0.5 * Math.sin(aSlope), -aSlope);
    var hw = I.objR * 0.95;
    bar(blk, hw - c * 1.2, R.line, -(hw + c * 1.2) / 2, ly, 0);
    bar(blk, hw - c * 1.2, R.line, (hw + c * 1.2) / 2, ly, 0);
    bar(blk, R.line * 1.6, R.post, 0, ly - c * 1.1 - R.post / 2, 0);
    outer.name = 'pac9-4x';
    S4.line = ly;
    return outer;
  }
  // the PAC-9's built-in red dot off (the 4x scope takes its place) or back on:
  // its triangles cut from the receiver meshes (PAC9_SIGHT.box), its lens hidden
  function rifleRedDot(on) {
    if (!S4.cut) {
      S4.cut = [];
      var B = PAC9_SIGHT.box, mnt = rifle.mounts && rifle.mounts.root;
      rifle.root.children.forEach(function (o) {
        if (o === mnt || !o.isMesh || !o.geometry || !o.material || Array.isArray(o.material)) return;
        if (/glove|hand|sleeve/i.test(o.material.name || '')) return;
        if (o.material.isShaderMaterial) { if (o.position.z > -0.3) S4.cut.push({ mesh: o, lens: true }); return; } // the red dot's lens (not the muzzle flash)
        var src = o.geometry, g = src.index ? src.toNonIndexed() : src.clone(), pa = g.attributes.position, keep = [], drop = 0, v = new lt.Vector3();
        o.updateMatrix();
        for (var t = 0; t + 2 < pa.count; t += 3) {
          v.set((pa.getX(t) + pa.getX(t + 1) + pa.getX(t + 2)) / 3, (pa.getY(t) + pa.getY(t + 1) + pa.getY(t + 2)) / 3, (pa.getZ(t) + pa.getZ(t + 1) + pa.getZ(t + 2)) / 3).applyMatrix4(o.matrix);
          if (v.x > B.x0 && v.x < B.x1 && v.y > B.y0 && v.y < B.y1 && v.z > B.z0 && v.z < B.z1) drop++; else keep.push(t);
        }
        if (!drop) return;
        var ng = new lt.BufferGeometry();
        for (var nm in g.attributes) {
          var at = g.attributes[nm], arr = new Float32Array(keep.length * 3 * at.itemSize), w = 0;
          keep.forEach(function (t0) { for (var j = 0; j < 3; j++) for (var cc = 0; cc < at.itemSize; cc++) arr[w++] = at.getComponent(t0 + j, cc); });
          ng.setAttribute(nm, new lt.BufferAttribute(arr, at.itemSize));
        }
        ng.computeBoundingSphere();
        S4.cut.push({ mesh: o, full: src, cut: ng });
      });
    }
    S4.cut.forEach(function (c) { if (c.lens) c.mesh.visible = on; else c.mesh.geometry = on ? c.full : c.cut; });
  }
  function applyAttachments(kind) {
    var g = guns[kind], a = L.att[kind] || {}, mounts = SXA_MOUNTS[kind] || {};
    var groups = g.mounts || {};
    for (var gk in groups) { var grp = groups[gk]; while (grp.children.length) grp.remove(grp.children[0]); }
    var line = null, scoped4 = false;
    for (var slot in a) {
      var id = a[slot], mt = mounts[slot];
      if (!id || !mt) continue;
      // the gun model's own scope serves as its optic (x8, or x4 when fitted)
      if (mt.builtIn) { if (slot === 'optic') line = mt.line; continue; }
      var grp2 = groups[mt.on || 'root'] || groups.root;
      if (!grp2) continue;
      var holder = new lt.Group();
      var built = false;
      if (id === 'reddot') { try { holder.add(pac9Sight(mt)); built = true; } catch (e) { if (!PAC9_SIGHT.warned) { PAC9_SIGHT.warned = true; console.warn('[arsenal] PAC-9 sight unavailable, simple red dot', e); } } }
      if (id === 'x4' && kind === 'rifle' && SXA_S4M) { try { holder.add(scope4x(mt)); built = true; scoped4 = true; } catch (e) { if (!S4.warned) { S4.warned = true; console.warn('[arsenal] 4x scope model unavailable, simple 4x', e); } } }
      if (!built) SXA_addParts(holder, SXA_attGeo(id, mt), viewMats, SXA_vmMesh);
      grp2.add(holder);
      holder.traverse(function (o) { o.layers.set(zc); });
      if (slot === 'optic' && !mt.magnifier) line = mt.at[1] + SXA_ATT[id].above;
    }
    var m = { recoil: 1, yaw: 1, spread: 1, flash: 1, gain: 1, pitch: 1, hear: 0, mag: 1, zoom: 1 };
    attFrom(kind).forEach(function (d) {
      if (d.recoil) m.recoil *= d.recoil;
      if (d.yaw) m.yaw *= d.yaw;
      if (d.spread) m.spread *= d.spread;
      if (d.flash) m.flash *= d.flash;
      if (d.gain) m.gain *= d.gain;
      if (d.pitch) m.pitch *= d.pitch;
      if (d.hear) m.hear = d.hear;
      if (d.mag) m.mag *= d.mag;
      if (d.zoom) m.zoom = d.zoom;
    });
    g.attMods = m;
    if (kind === 'rifle') {
      try { rifleRedDot(!scoped4); } catch (e) { console.warn('[arsenal] red dot toggle', e); }
      S4.on = scoped4;
      if (qv0) { qv.p[1] = scoped4 ? -S4.line : qv0[1]; qv.p[2] = scoped4 ? TU.scope4x.adsZ : qv0[2]; }
      SXA_RMOD.recoil = TU.recoil.rifle * m.recoil;
      SXA_RMOD.yaw = TU.recoil.rifleYaw * m.yaw;
      SXA_RMOD.spread = m.spread;
      SXA_RMOD.flash = m.flash; SXA_RMOD.gain = m.gain; SXA_RMOD.pitch = m.pitch; SXA_RMOD.hear = m.hear;
      g.magSize = Math.round(30 * m.mag);
    } else {
      g.mods.recoil = m.recoil; g.mods.yaw = m.yaw; g.mods.spread = m.spread; g.mods.flash = m.flash;
      g.mods.gain = m.gain; g.mods.pitch = m.pitch; g.mods.hear = m.hear;
      var T0 = TU[kind];
      g.magSize = kind === 'shotgun' ? T0.mag + (m.mag > 1 ? 3 : 0) : Math.round(T0.mag * m.mag);
      if (g.geo._adsY0 == null) g.geo._adsY0 = g.geo.ads.p[1];
      g.geo.ads.p[1] = line != null ? -line : g.geo._adsY0;
    }
    if (g.ammo > g.magSize) { g.reserve += g.ammo - g.magSize; g.ammo = g.magSize; }
    if (ui) ui.last = '';
  }
  function resetAttachments() {
    TU.order.forEach(function (k) { L.att[k] = Object.assign({}, SXA_ATT_DEFAULT[k] || {}); applyAttachments(k); });
    TU.order.forEach(function (k) { guns[k].ammo = guns[k].magSize; });
  }
  // fit a picked-up part: the gun in hand first, else any owned gun with the
  // slot free; when every fitting gun already has one, swap it on the gun in hand
  // A scope never replaces the one already on a gun: with no free optic
  // slot it goes into the spare bag and B swaps it in. Other parts replace
  // the one on the gun in hand, and the old part goes into the bag.
  function bagAdd(id) {
    if (bagRoom('att', id) < 1) return false;
    L.spare[id] = (L.spare[id] | 0) + 1;
    return true;
  }
  function fitAttachment(id) {
    var d = SXA_ATT[id], order = [L.cur].concat(TU.order.filter(function (k) { return k !== L.cur; }));
    var ok = order.filter(function (k) { return L.owned[k] && SXA_COMPAT[k] && (SXA_COMPAT[k][d.slot] || []).indexOf(id) >= 0; });
    var free = ok.filter(function (k) { return !L.att[k][d.slot]; })[0];
    var target = free || (d.slot !== 'optic' && L.att[L.cur][d.slot] !== id && ok.indexOf(L.cur) >= 0 ? L.cur : null);
    if (!target) return bagAdd(id) ? { bag: true } : null;
    var old = L.att[target][d.slot];
    L.att[target][d.slot] = id;
    applyAttachments(target);
    if (old && old !== id && !bagAdd(old)) {
      // bag full: the part it replaced drops beside you
      var P = G.player, side = new lt.Vector3(Math.cos(P.yaw), 0, -Math.sin(P.yaw)).multiplyScalar(1.7);
      var dp = spawnDrop('att:' + old, P.pos.clone().add(side).setY(P.pos.y + 0.6));
      if (dp) { dp.mustLeave = true; dp.ttl = 90; }
    }
    return guns[target];
  }
  // a gun you just picked up takes spare parts from the bag for its empty slots
  function fitFromBag(kind) {
    var cp = SXA_COMPAT[kind] || {}, a = L.att[kind], changed = false;
    for (var sl in cp) {
      if (a[sl]) continue;
      var id = (cp[sl] || []).filter(function (x) { return (L.spare[x] | 0) > 0; }).pop();
      if (id) { a[sl] = id; L.spare[id]--; changed = true; }
    }
    if (changed) applyAttachments(kind);
  }
  // B: the optics this gun can switch between (no optic = iron sights / the
  // PAC-9's own red dot; the SR-3 always keeps a scope)
  function scopeOptions(kind) {
    var list = (SXA_COMPAT[kind] && SXA_COMPAT[kind].optic) || [], on = (L.att[kind] || {}).optic || null;
    var opts = kind === 'sniper' ? [] : [null];
    list.forEach(function (id) { if (id === on || (L.spare[id] | 0) > 0) opts.push(id); });
    return opts;
  }
  function scopeName(kind, id) { return id ? SXA_ATT[id].short : kind === 'rifle' ? 'RDS' : 'IRON'; }
  function cycleScope() {
    var kind = L.cur, h = hud();
    if (L.sw || L.heal || !L.owned[kind]) return;
    var opts = scopeOptions(kind), on = L.att[kind].optic || null;
    if (opts.length < 2) { h && h.message('No other scope for the ' + guns[kind].short + ' — pick one up', 1.6); return; }
    var next = opts[(opts.indexOf(on) + 1) % opts.length];
    if (on) L.spare[on] = (L.spare[on] | 0) + 1;
    if (next) L.spare[next]--;
    L.att[kind].optic = next;
    applyAttachments(kind);
    snd('reload_bolt', { gain: 0.5, pitch: 1.7 });
    h && h.message('Scope: ' + (next ? SXA_ATT[next].label : kind === 'rifle' ? 'built-in red dot' : 'iron sights') + ' (' + guns[kind].short + ')', 1.4);
  }

  // ---- armor ----
  function armorCut() {
    var k = 1;
    ['helmet', 'vest'].forEach(function (sl) { var pc = L.armor[sl]; if (pc) k *= 1 - SXA_ARMOR[pc.id].cut; });
    return 1 - k;
  }
  var armorPingT = 0;
  function armorAbsorb(d) {
    var out = d, h = hud(), hit = false;
    ['helmet', 'vest'].forEach(function (sl) {
      var pc = L.armor[sl];
      if (!pc || out <= 0) return;
      var def = SXA_ARMOR[pc.id], stop = out * def.cut;
      out -= stop;
      pc.dur -= stop * TU.armor.wear;
      pc.hitT = 0.3;
      hit = true;
      if (pc.dur <= 0) {
        L.armor[sl] = null;
        h && (h.warn ? h.warn(def.label + ' broken', 2) : h.message(def.label + ' broken', 2));
        snd('container_bang', { gain: 0.45, pitch: 1.9 });
      }
    });
    if (hit && armorPingT <= 0) { armorPingT = 0.2; snd('shell_bounce', { gain: 0.35, pitch: 1.85 }); }
    return out;
  }
  // every hit that reaches you on foot goes through the armor first (in a
  // vehicle the units framework sends it to the vehicle instead)
  function wrapPlayerDamage() {
    var P = G.player;
    if (!P || P._sxaArmor || typeof P.damage !== 'function') return;
    var base = P.damage;
    P._sxaArmor = true;
    P.damage = function (amount, from) {
      var piloting = typeof SXU !== 'undefined' && SXU && SXU.pilot;
      if (!(amount > 0) || piloting || !this.alive || this.invulnerable) return base.apply(this, arguments);
      var args = Array.prototype.slice.call(arguments);
      args[0] = armorAbsorb(amount);
      return base.apply(this, args);
    };
  }
  wrapPlayerDamage();
  function curZoom() { var g = cur(); return g.attMods ? g.attMods.zoom : 1; }
  var scopeEl = null, acogEl = null, sway = { a: 0, b: 0 };
  function updateScope(dt) {
    var g = cur(), z = curZoom(), P = G.player;
    var fov = z >= 2 ? 2 * Math.atan(Math.tan(37 * Math.PI / 180) / z) * 180 / Math.PI : 52;
    Mt.fovAds = fov;
    Mt.adsLook = 0.6 * Math.tan(fov * Math.PI / 360) / Math.tan(26 * Math.PI / 180);
    // the PAC-9's 4x scope has its own view (.sx-acog), not the sniper's
    var acog = L.cur === 'rifle' && S4.on && z >= 4 && g.ads > 0.88 && !L.sw && !L.heal;
    var scoped = z >= 4 && g.ads > 0.88 && !L.sw && !L.heal && !acog;
    if (!acogEl && acog) {
      var h2 = hud();
      if (h2 && h2.root) {
        acogEl = document.createElement('div');
        acogEl.className = 'sx-acog';
        // red chevron, the bullet-drop post with its stadia ticks (SVG units: the window is 200 across)
        acogEl.innerHTML = '<div class="sx-acog-ret"><svg viewBox="-100 -100 200 200" aria-hidden="true">' +
          '<path class="chev" d="M0,-1.6 L-6.4,8 L-4.6,8 L0,1.4 L4.6,8 L6.4,8 Z"/>' +
          '<rect class="post" x="-0.45" y="11" width="0.9" height="58"/>' +
          '<rect class="post" x="-5.5" y="22" width="11" height="0.8"/><rect class="post" x="-4" y="33" width="8" height="0.8"/>' +
          '<rect class="post" x="-2.8" y="44" width="5.6" height="0.8"/><rect class="post" x="-1.8" y="55" width="3.6" height="0.8"/>' +
          '<rect class="post" x="-96" y="-0.35" width="72" height="0.7"/><rect class="post" x="24" y="-0.35" width="72" height="0.7"/>' +
          '</svg></div>';
        h2.root.appendChild(acogEl);
      }
    }
    if (acogEl && acogEl._on !== acog) { acogEl._on = acog; acogEl.classList.toggle('on', acog); }
    if (acog) g.root.position.y -= 3; // (the gun is out of the way: the window is the scope)
    if (!scopeEl) {
      var h = hud();
      if (h && h.root) {
        scopeEl = document.createElement('div');
        scopeEl.className = 'sx-scope';
        scopeEl.innerHTML = '<div class="sx-scope-ret"><i class="h"></i><i class="v"></i><i class="d"></i></div>';
        h.root.appendChild(scopeEl);
      }
    }
    if (scopeEl && scopeEl._on !== scoped) { scopeEl._on = scoped; scopeEl.classList.toggle('on', scoped); scopeEl.classList.toggle('x8', z >= 8); }
    if (scoped || acog) {
      if (scoped) g.root.position.y -= 3;
      var t = G.time ? G.time.t : 0, k = (P && P.crouching ? 0.35 : 1) * (z >= 8 ? 1 : acog ? 0.45 : 0.6);
      var a = Math.sin(t * 0.83) * 0.0018 * k + Math.sin(t * 2.1) * 0.0004 * k, b = Math.sin(t * 1.27 + 1) * 0.0013 * k;
      if (P) { P.yaw += a - sway.a; P.pitch += b - sway.b; }
      sway.a = a; sway.b = b;
    } else { sway.a = 0; sway.b = 0; }
  }

  // ---- medkits from the bag ----
  // small: +20% but never past 80% · kit: up to 80% · large: up to 100%
  function healTarget(kind) {
    var P = G.player, mx = P.maxHealth || 100, hp = P.health, med = TU.med;
    return kind === 'med_l' ? mx : kind === 'med' ? mx * med.cap : Math.min(mx * med.cap, hp + mx * med.small);
  }
  function pickMed() {
    var P = G.player, mx = P.maxHealth || 100, hp = P.health, have = function (k) { return (L.meds[k] | 0) > 0; };
    if (hp >= mx - 0.5) return { msg: 'Health full' };
    if (hp >= mx * TU.med.cap - 0.5) return have('med_l') ? { kind: 'med_l' } : { msg: 'Above 80% — only a large medkit helps' };
    var deficit = mx * TU.med.cap - hp;
    if (deficit <= mx * TU.med.small + 0.5 && have('med_s')) return { kind: 'med_s' };
    if (have('med')) return { kind: 'med' };
    if (have('med_s')) return { kind: 'med_s' };
    if (have('med_l')) return { kind: 'med_l' };
    return { msg: 'No medkits' };
  }
  function startHeal(kind) {
    var h = hud(), P = G.player;
    if (L.heal || L.thr || L.sw || !P || !P.alive) return;
    if (!kind) { var c = pickMed(); if (!c.kind) { h && h.message(c.msg, 1.4); return; } kind = c.kind; }
    if ((L.meds[kind] | 0) <= 0) { h && h.message('No ' + SXA_MEDS[kind].toLowerCase(), 1.4); return; }
    if (healTarget(kind) <= P.health + 0.5) { h && h.message(kind === 'med_l' ? 'Health full' : 'Above 80% — only a large medkit helps', 1.4); return; }
    L.heal = { kind: kind, t: 0, T: TU.med.useTime[kind] };
    snd('reload_magout', { gain: 0.7, pitch: 0.7 });
  }
  function cancelHeal() { if (L.heal) { L.heal = null; snd('rifle_dry', { gain: 0.4, pitch: 0.8 }); } }
  function updateHeal(dt) {
    var hl = L.heal;
    if (!hl) return;
    var P = G.player, inp = G.input;
    if (!P || !P.alive || (inp && inp.fire)) { cancelHeal(); return; }
    hl.t += dt;
    if (hl.t >= hl.T) {
      var target = healTarget(hl.kind);
      if (target > P.health) {
        var gain = target - P.health;
        P.heal(gain);
        L.meds[hl.kind]--;
        var h = hud();
        h && h.feed('<b class="sx-pk">+' + Math.round(gain) + '</b> HP · ' + SXA_MEDS[hl.kind]);
        snd('reload_magin', { gain: 0.9, pitch: 0.75 });
      }
      L.heal = null;
    }
  }

  // ---- loadout HUD ----
  var ui = null;
  function buildHud() {
    var h = hud();
    if (!h || !h.root || ui) return;
    var el = document.createElement('div');
    el.className = 'sx-load';
    el.innerHTML = '<div class="sx-slots">' + TU.order.map(function (k, i) { return '<span class="sx-slot" data-k="' + k + '"><b>' + (i + 1) + '</b>' + guns[k].short + '</span>'; }).join('') + '<span class="sx-slot own" data-k="knife"><b>5</b>Knife</span></div>' +
      '<div class="sx-atts"></div>' +
      '<div class="sx-nades">' + TU.nadeOrder.map(function (k) { return '<span class="sx-n" data-k="' + k + '">' + TU.nades[k].label + '<b>0</b></span>'; }).join('') + '<span class="sx-key">G</span></div>' +
      '<div class="sx-meds">' + SXA_MED_ORDER.map(function (k, i) { return '<span class="sx-m" data-k="' + k + '"><i>' + (i + 7) + '</i>' + SXA_MED_SHORT[k] + '<b>0</b></span>'; }).join('') + '<span class="sx-key sx-hkey">H</span></div>';
    h.root.appendChild(el);
    var bar = document.createElement('div');
    bar.className = 'sx-heal';
    bar.innerHTML = '<span></span><div><i></i></div>';
    h.root.appendChild(bar);
    ui = { el: el, slots: {}, nades: {}, meds: {}, key: el.querySelector('.sx-key'), hkey: el.querySelector('.sx-hkey'), bar: bar, barT: bar.querySelector('span'), barI: bar.querySelector('i'), last: '' };
    // helmet + vest badges next to the health bar: level and durability
    var icons = {
      helmet: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 13.5a7 7 0 0 1 14 0V15H3zM1.5 15.5h17V17h-17z" fill="currentColor"/></svg>',
      vest: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 2h2.2L10 4.6 11.8 2H14l.8 4 2.2 1.2V18H3V7.2L5.2 6z" fill="currentColor"/></svg>',
    };
    var arm = document.createElement('div');
    arm.className = 'sx-armor';
    arm.innerHTML = ['helmet', 'vest'].map(function (sl) { return '<div class="sx-ar" data-s="' + sl + '">' + icons[sl] + '<b>–</b><i><u></u></i></div>'; }).join('');
    h.root.appendChild(arm);
    ui.armor = {};
    arm.querySelectorAll('.sx-ar').forEach(function (e) { ui.armor[e.dataset.s] = { el: e, b: e.querySelector('b'), u: e.querySelector('u'), k: '' }; });
    el.querySelectorAll('.sx-m').forEach(function (s) { ui.meds[s.dataset.k] = { el: s, b: s.querySelector('b') }; });
    ui.atts = el.querySelector('.sx-atts');
    el.querySelectorAll('.sx-slot').forEach(function (s) { ui.slots[s.dataset.k] = s; });
    el.querySelectorAll('.sx-n').forEach(function (s) { ui.nades[s.dataset.k] = { el: s, b: s.querySelector('b') }; });
  }
  function updateArmorHud(dt) {
    ['helmet', 'vest'].forEach(function (sl) {
      var pc = L.armor[sl], a = ui.armor[sl];
      if (pc && pc.hitT > 0) pc.hitT -= dt;
      var def = pc && SXA_ARMOR[pc.id], f = pc ? Math.max(0, pc.dur / def.dur) : 0;
      var key = pc ? pc.id + ':' + Math.ceil(f * 40) + (pc.hitT > 0 ? 'h' : '') : 'none';
      if (key === a.k) return;
      a.k = key;
      a.el.className = 'sx-ar' + (pc ? ' on lv' + def.lv : '') + (pc && f < 0.25 ? ' low' : '') + (pc && pc.hitT > 0 ? ' hit' : '');
      a.b.textContent = pc ? 'LV' + def.lv : '–';
      a.u.style.width = Math.round(f * 100) + '%';
      a.el.title = pc ? def.label + ' · ' + Math.round(def.cut * 100) + '% · ' + Math.max(0, Math.round(pc.dur)) + '/' + def.dur : '';
    });
  }
  function updateHud(dt) {
    if (!ui) buildHud();
    if (!ui) return;
    updateArmorHud(dt || 0);
    var armed = armedC4().length;
    var touch = G.input && G.input.touch;
    // reminder: low on health with a usable kit in the bag
    var P0 = G.player, want = !!P0 && P0.alive && !L.heal && P0.health < (P0.maxHealth || 100) - 0.5 && !!pickMed().kind;
    if (!ui.hint) {
      ui.hint = document.createElement('div');
      ui.hint.className = 'sx-medhint';
      ui.el.parentNode.appendChild(ui.hint);
    }
    if (ui.hintOn !== want) { ui.hintOn = want; ui.hint.classList.toggle('on', want); }
    if (want) { var ht = (touch ? 'MED' : 'H') + ' — use ' + SXA_MEDS[pickMed().kind].toLowerCase(); if (ui.hintT !== ht) { ui.hintT = ht; ui.hint.textContent = ht; } }
    // medkit progress
    var on = !!L.heal;
    if (ui.barOn !== on) { ui.barOn = on; ui.bar.classList.toggle('on', on); if (on) ui.barT.textContent = 'Using ' + SXA_MEDS[L.heal.kind]; }
    if (on) ui.barI.style.width = Math.round(Math.min(1, L.heal.t / L.heal.T) * 100) + '%';
    var sig = L.cur + (L.knOut ? 'K' + (L.knStyle | 0) : '') + (L.sw ? L.sw.to : '') + JSON.stringify(L.owned) + JSON.stringify(L.nades) + JSON.stringify(L.meds) + JSON.stringify(L.att) + JSON.stringify(L.spare) + L.nadeType + armed + touch;
    if (sig === ui.last) return;
    SXA_MED_ORDER.forEach(function (k) {
      var m = ui.meds[k];
      m.b.textContent = String(L.meds[k] | 0);
      m.el.classList.toggle('zero', !(L.meds[k] > 0));
    });
    ui.hkey.textContent = touch ? 'MED' : 'H';
    var aw = L.sw ? L.sw.to : L.cur, al = L.att[aw] || {}, ap = [];
    ['optic', 'muzzle', 'mag', 'grip', 'stock'].forEach(function (sl) { if (al[sl]) ap.push(SXA_ATT[al[sl]].short); });
    // B: what the next scope swap gives
    var so = L.owned[aw] ? scopeOptions(aw) : [], nx = so.length > 1 ? so[(so.indexOf(al.optic || null) + 1) % so.length] : undefined;
    ui.atts.innerHTML = ap.join(' · ') + (nx !== undefined ? ' <span class="sx-scopekey">' + (touch ? 'OPT' : 'B') + ' ⇄ ' + scopeName(aw, nx) + '</span>' : '');
    ui.atts.classList.toggle('on', ap.length > 0 || nx !== undefined);
    ui.last = sig;
    TU.order.forEach(function (k) {
      var s = ui.slots[k];
      s.classList.toggle('own', !!L.owned[k]);
      s.classList.toggle('on', !L.knOut && (L.sw ? L.sw.to : L.cur) === k);
    });
    if (ui.slots.knife) { ui.slots.knife.classList.toggle('on', !!L.knOut); ui.slots.knife.innerHTML = '<b>5</b>Knife' + (L.knOut && TU.knife.styles.length > 1 && !TU.knife.combo ? ' · ' + knifeStyle().label : ''); }
    TU.nadeOrder.forEach(function (k) {
      var n = ui.nades[k];
      n.b.textContent = String(L.nades[k] | 0);
      n.el.classList.toggle('on', L.nadeType === k);
      n.el.classList.toggle('zero', !(L.nades[k] > 0) && !(k === 'c4' && armed));
      n.el.classList.toggle('armed', k === 'c4' && armed > 0);
    });
    ui.key.textContent = touch ? 'NADE' : L.nadeType === 'c4' && armed ? 'G · DET' : 'G';
  }

  // ---- backpack, item names, pickup toasts (PUBG style) ----
  // Capacity: every carried thing has a size (TU.bag.size); worn armor, guns
  // and the parts fitted on them don't count. Tab opens the backpack: it lists
  // the stacks and drops them as real pickups in front of you (you have to
  // step away once before walking over it picks it up again).
  var BAG = TU.bag;
  function gunShort(k) { return k === 'rifle' ? 'PAC-9' : guns[k].short; }
  function bagItems() {
    var out = [];
    SXA_CAL_ORDER.forEach(function (c) {
      var n = L.ammo[c] | 0;
      if (n > 0) out.push({ key: 'ammo:' + c, cat: 'ammo', id: c, name: SXA_CAL[c].label + ' ammo', n: n, each: BAG.size.ammo[c] || 0.5 });
    });
    TU.nadeOrder.forEach(function (k) { if (L.nades[k] > 0) out.push({ key: 'nade:' + k, cat: 'nade', id: k, name: TU.nades[k].label + (k === 'c4' ? ' charge' : ' grenade'), n: L.nades[k], each: BAG.size.nade[k] }); });
    SXA_MED_ORDER.forEach(function (k) { if (L.meds[k] > 0) out.push({ key: 'med:' + k, cat: 'med', id: k, name: SXA_MEDS[k], n: L.meds[k], each: BAG.size.med[k] }); });
    SXA_ATT_ORDER.forEach(function (id) { if (L.spare[id] > 0) out.push({ key: 'att:' + id, cat: 'att', id: id, name: SXA_ATT[id].label, n: L.spare[id], each: BAG.size.att[id] || 10 }); });
    return out;
  }
  function bagUsed() { var u = 0; bagItems().forEach(function (it) { u += it.n * it.each; }); return u; }
  function bagCap() { return BAG.caps[L.pack | 0] || BAG.caps[0]; }
  function bagFree() { return bagCap() - bagUsed(); }
  function packName(lv) { return lv ? 'Backpack Lv.' + lv : 'Pockets'; }
  // the worn backpack goes on the ground in front of you
  function dropPack(lv) {
    var P = G.player;
    if (!P) return null;
    var fwd = new lt.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    var at = P.pos.clone().addScaledVector(fwd, 0.9);
    at.y = P.pos.y + 0.8;
    var d = spawnDrop('bag' + lv, at);
    if (d) { d.mustLeave = true; d.ttl = BAG.dropLife; d.byPlayer = true; }
    return d;
  }
  function takeOffPack() {
    var lv = L.pack | 0;
    if (!lv) return;
    var used = bagUsed();
    if (used > BAG.caps[0] + 1e-6) {
      var h = hud();
      h && h.message('Too full to take off — ' + Math.round(used) + ' / ' + BAG.caps[0] + ' pockets', 1.8);
      snd('rifle_dry', { gain: 0.5, pitch: 0.8 });
      return;
    }
    if (!dropPack(lv)) return;
    L.pack = 0;
    snd('shell_bounce', { gain: 0.7, pitch: 0.55 });
    toast('pack', packName(lv), 'capacity ' + bagCap(), 'Dropped');
    renderBag(true);
  }
  function fitNames(id) { return SXA_fitsGuns(id).map(gunShort); }
  // how many of this item still fit
  function bagRoom(cat, id) {
    if (cat === 'ammo' && SXA_GUN_CAL[id]) id = SXA_GUN_CAL[id];
    var each = (BAG.size[cat] || {})[id] || 1;
    return Math.max(0, Math.floor((bagFree() + 1e-6) / each));
  }
  // the size a pickup needs (0 = doesn't go in the backpack)
  function needSize(p) {
    var k = p.kind;
    if (SXA_isCal(k)) return BAG.size.ammo[k.slice(5)] || 0.5;
    if (p.give && p.give.nade) return BAG.size.nade[p.give.nade];
    if (SXA_MEDS[k]) return BAG.size.med[k];
    if (k.indexOf('att:') === 0) return BAG.size.att[k.slice(4)] || 10;
    if (k === 'grenade') return 12;
    if (k === 'ammo') { var m = 99; TU.order.forEach(function (g) { if (L.owned[g]) m = Math.min(m, BAG.size.ammo[SXA_GUN_CAL[g]] || 0.5); }); return m; }
    return 0;
  }
  function itemCat(kind, p) {
    if (SXA_isCal(kind)) return 'ammo';
    if (p && p.give) return p.give.gun ? 'ammo' : 'nade';
    return kind === 'ammo' ? 'ammo' : kind === 'grenade' ? 'nade' : SXA_MEDS[kind] ? 'med' : SXA_ARMOR[kind] ? (SXA_ARMOR[kind].slot === 'helmet' ? 'helmet' : 'vest') : SXA_PACKS[kind] ? 'pack' : kind.indexOf('att:') === 0 ? 'att' : 'gun';
  }
  function itemName(kind, p) {
    if (SXA_isCal(kind)) { var CC = SXA_CAL[kind.slice(5)]; return CC.label + ' ×' + (p && p.n != null ? p.n : CC.box); }
    if (p && p.give && p.give.nade) return TU.nades[p.give.nade].label + (p.give.n > 1 ? ' ×' + p.give.n : '');
    if (kind === 'ammo') return p && !p.isDrop ? 'Mixed ammo crate' : 'Ammo';
    if (kind === 'grenade') return p && !p.isDrop ? 'Grenade crate' : 'Grenade';
    if (SXA_MEDS[kind]) return SXA_MEDS[kind];
    if (SXA_ARMOR[kind]) return SXA_ARMOR[kind].label;
    if (SXA_PACKS[kind]) return SXA_PACKS[kind].label + ' (+' + (BAG.caps[SXA_PACKS[kind].lv] - BAG.caps[0]) + ')';
    if (kind.indexOf('att:') === 0) return SXA_ATT[kind.slice(4)] ? SXA_ATT[kind.slice(4)].label : 'Attachment';
    if (kind === 'sniper') return TU.sniper.name;
    if (kind === 'shotgun') return TU.shotgun.name;
    if (kind === 'rifle') return 'PAC-9 rifle';
    return kind;
  }
  var ICON = {
    ammo: '<svg viewBox="0 0 20 20"><path d="M4 7.5 5.5 4 7 7.5V17H4zM8.5 7.5 10 4l1.5 3.5V17h-3zM13 7.5 14.5 4 16 7.5V17h-3z" fill="currentColor"/></svg>',
    nade: '<svg viewBox="0 0 20 20"><circle cx="10" cy="12" r="5.5" fill="currentColor"/><path d="M8 4.5h4V7H8zM12 5h3.5v1.6H12z" fill="currentColor"/></svg>',
    med: '<svg viewBox="0 0 20 20"><rect x="2.5" y="5" width="15" height="11" rx="1.5" fill="currentColor"/><path d="M8.7 7.5h2.6v2.2h2.2v2.6h-2.2v2.2H8.7v-2.2H6.5V9.7h2.2z" fill="#0b0d0f"/></svg>',
    helmet: '<svg viewBox="0 0 20 20"><path d="M3 13.5a7 7 0 0 1 14 0V15H3zM1.5 15.5h17V17h-17z" fill="currentColor"/></svg>',
    vest: '<svg viewBox="0 0 20 20"><path d="M6 2h2.2L10 4.6 11.8 2H14l.8 4 2.2 1.2V18H3V7.2L5.2 6z" fill="currentColor"/></svg>',
    att: '<svg viewBox="0 0 20 20"><path d="M2 8h11v4H2zM13 7h4v6h-4zM5 6h4v2H5zM4 12h2v3H4z" fill="currentColor"/></svg>',
    gun: '<svg viewBox="0 0 20 20"><path d="M1 8h13l2-1.5h3V9h-3v1.5h-4.5L10 13H8l.5-2.5H5L4 14H2l1-3.5H1z" fill="currentColor"/></svg>',
    bag: '<svg viewBox="0 0 20 20"><path d="M7.5 2.5h5V5h2a2 2 0 0 1 2 2v9.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3.5 16.5V7a2 2 0 0 1 2-2h2zM9 4v1h2V4zM6 10h8v3.5H6z" fill="currentColor"/></svg>',
  };
  ICON.pack = ICON.bag;
  function esc(t) { return String(t).replace(/[<>&"]/g, ''); }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = String(html || ''); return d.textContent.replace(/\s+/g, ' ').trim(); }

  // toasts: "Picked up" cards stacked bottom-left above the vitals
  var toastBox = null;
  function toast(cat, title, detail, verb) {
    var h = hud();
    if (!h || !h.root) return;
    if (!toastBox || !toastBox.isConnected) { toastBox = document.createElement('div'); toastBox.className = 'sx-toasts'; h.root.appendChild(toastBox); }
    var t = document.createElement('div');
    t.className = 'sx-toast c-' + cat;
    t.innerHTML = '<i>' + (ICON[cat] || ICON.bag) + '</i><div><small>' + esc(verb || 'Picked up') + '</small><b>' + esc(title) + '</b>' + (detail ? '<span>' + esc(detail) + '</span>' : '') + '</div>';
    toastBox.insertBefore(t, toastBox.firstChild);
    while (toastBox.children.length > 4) toastBox.removeChild(toastBox.lastChild);
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 260); }, 2600);
  }
  function pickToast(p, detail) {
    var title = itemName(p.kind, p), d = typeof detail === 'string' ? plain(detail) : '';
    if (p.kind === 'ammo' || p.kind === 'grenade' || SXA_isCal(p.kind)) { title = d || title; d = ''; }
    // the detail without the item's own name: "→ PAC-9", "+1 → bag"
    d = d.split(title).join('').replace(/\(bag\)/, '→ bag').replace(/^\s*[·:\-]\s*/, '').replace(/\s+/g, ' ').trim();
    if (/^picked up$/i.test(d)) d = '';
    if (p.kind.indexOf('att:') === 0 && /bag/.test(d)) d += ' · fits ' + (fitNames(p.kind.slice(4)).join(' · ') || 'no gun');
    toast(itemCat(p.kind, p), title, d);
  }

  // floating names over nearby pickups and the one under the crosshair
  var labelBox = null, labels = [], labelT = 0, labelSel = [], lp = new lt.Vector3(), lf = new lt.Vector3(), lq = new lt.Vector3();
  function labelTop(p) {
    var y = p.kind === 'shotgun' || p.kind === 'sniper' || p.kind === 'rifle' ? 1.05 : p.isDrop ? 0.55 : SXA_ARMOR[p.kind] || p.kind.indexOf('att:') === 0 ? 0.55 : p.kind === 'ammo' || p.kind === 'grenade' ? 0.75 : 0.5;
    return lp.copy(p.holder.position).setY(p.holder.position.y + y);
  }
  function updateLabels(dt) {
    var h = hud();
    if (!h || !h.root) return;
    if (!labelBox || !labelBox.isConnected) {
      labelBox = document.createElement('div');
      labelBox.className = 'sx-plabels';
      h.root.appendChild(labelBox);
      labels = [];
      for (var k = 0; k < 5; k++) { var e = document.createElement('div'); e.className = 'sx-plabel'; e.innerHTML = '<b></b><span></span>'; labelBox.appendChild(e); labels.push({ el: e, b: e.firstChild, s: e.lastChild, p: null, t: '', u: '' }); }
    }
    var P = G.player, cam = G.camera, on = !!P && P.alive && G.game && G.game.state === 'playing' && !BP.open && !(typeof SXU !== 'undefined' && SXU && SXU.pilot);
    labelT -= dt;
    if (labelT <= 0 && on) {
      labelT = 0.12;
      var eye = P.eye || cam.position, fwd = lf.set(0, 0, -1).applyQuaternion(cam.quaternion), near = [], aim = null, aimD = 1e9;
      for (var i = 0; i < pickups.length; i++) {
        var p = pickups[i];
        if (!p.active || !p.holder.visible || p.falling) continue;
        var top = labelTop(p), d = top.distanceTo(eye);
        if (d > 35) continue;
        // under the crosshair: off-axis distance at that range
        var v = lq.copy(top).sub(eye), along = v.dot(fwd);
        if (d < 6 && along > d * 0.35) near.push({ p: p, d: d }); // nearby and in view
        if (along > 0.5) { var off = Math.sqrt(Math.max(0, v.lengthSq() - along * along)); if (off < 0.35 + along * 0.025 && along < aimD) { aimD = along; aim = p; } }
      }
      near.sort(function (a, b) { return a.d - b.d; });
      var sel = near.slice(0, 4).map(function (x) { return x.p; });
      if (aim && sel.indexOf(aim) < 0) sel.push(aim);
      labelSel = sel.filter(function (p) {
        try { return G.physics.lineOfSight(eye, labelTop(p).clone()) !== false; } catch (e) { return true; }
      }).map(function (p) { return { p: p, aim: p === aim }; });
    }
    for (var j = 0; j < labels.length; j++) {
      var L2 = labels[j], s2 = on ? labelSel[j] : null;
      if (!s2) { if (L2.p) { L2.p = null; L2.el.style.display = 'none'; } continue; }
      var pp = s2.p, tp = labelTop(pp).clone(), dist = tp.distanceTo(P.eye || cam.position);
      tp.project(cam);
      if (tp.z > 1 || Math.abs(tp.x) > 1.05 || Math.abs(tp.y) > 1.05) { L2.el.style.display = 'none'; L2.p = null; continue; }
      if (!L2.p) L2.el.style.display = 'block';
      L2.p = pp;
      var txt = itemName(pp.kind, pp);
      if (pp.kind.indexOf('att:') === 0) txt += ' · ' + (fitNames(pp.kind.slice(4)).join(', ') || 'no gun');
      else if (SXA_isCal(pp.kind)) txt += ' · ' + gunShort(SXA_CAL[pp.kind.slice(5)].gun);
      if (L2.t !== txt) { L2.t = txt; L2.b.textContent = txt; }
      var u = Math.round(dist) + ' m';
      if (L2.u !== u) { L2.u = u; L2.s.textContent = u; }
      L2.el.className = 'sx-plabel c-' + itemCat(pp.kind, pp) + (s2.aim ? ' aim' : '');
      L2.el.style.opacity = String(s2.aim && dist > 6 ? 0.9 : Math.max(0.35, Math.min(1, 1.25 - dist / 8)));
      L2.el.style.transform = 'translate(' + ((tp.x * 0.5 + 0.5) * innerWidth).toFixed(1) + 'px,' + ((-tp.y * 0.5 + 0.5) * innerHeight).toFixed(1) + 'px)';
    }
  }

  // the backpack panel (Tab) + the always-on bag gauge
  var BP = { open: false, el: null, sig: '', gauge: null };
  function dropAt() {
    var P = G.player, fwd = new lt.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    var at = P.pos.clone().addScaledVector(fwd, 1.15).add(new lt.Vector3((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5));
    at.y = P.pos.y + 0.8;
    return at;
  }
  function dropItem(key, all) {
    var P = G.player;
    if (!P || !P.alive) return;
    var it = bagItems().filter(function (x) { return x.key === key; })[0];
    if (!it) return;
    var made = [], n = 0;
    var finish = function (p) { if (!p) return false; p.mustLeave = true; p.ttl = BAG.dropLife; p.byPlayer = true; made.push(p); return true; };
    if (it.cat === 'ammo') {
      n = all ? L.ammo[it.id] : Math.min(L.ammo[it.id], SXA_CAL[it.id].box);
      var pa = spawnDrop('ammo:' + it.id, dropAt());
      if (finish(pa)) { pa.n = n; L.ammo[it.id] -= n; }
    } else if (it.cat === 'nade') {
      n = all ? L.nades[it.id] : 1;
      var pn = spawnDrop('grenade', dropAt());
      if (finish(pn)) { pn.give = { nade: it.id, n: n }; L.nades[it.id] -= n; }
    } else {
      var count = all ? it.n : 1;
      for (var c = 0; c < count; c++) {
        var pk = spawnDrop(it.cat === 'med' ? it.id : 'att:' + it.id, dropAt());
        if (!finish(pk)) break;
        n++;
        if (it.cat === 'med') L.meds[it.id]--; else L.spare[it.id]--;
      }
    }
    if (!made.length) return;
    snd('shell_bounce', { gain: 0.7, pitch: 0.75 });
    toast(it.cat, it.name, (n > 1 ? '×' + n + ' · ' : '') + 'frees ' + Math.round(n * it.each * 10) / 10, 'Dropped');
    if (ui) ui.last = '';
    renderBag(true);
  }
  function bagPanel() {
    if (BP.el && BP.el.isConnected) return BP.el;
    var h = hud();
    if (!h || !h.root) return null;
    var el = document.createElement('div');
    el.className = 'sx-bagp';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Backpack');
    h.root.appendChild(el);
    var act = function (e, all) {
      var b = e.target.closest('[data-drop]');
      if (b) { dropItem(b.dataset.drop, all || b.dataset.all === '1'); return true; }
      if (e.target.closest('.sx-bagx')) { setBag(false); return true; }
      if (e.target.closest('.sx-bagoff')) { takeOffPack(); return true; }
      return false;
    };
    el.addEventListener('click', function (e) { act(e); e.stopPropagation(); });
    el.addEventListener('contextmenu', function (e) {
      var row = e.target.closest('[data-row]');
      e.preventDefault(); e.stopPropagation();
      if (row) dropItem(row.dataset.row, false);
    });
    ['mousedown', 'pointerdown', 'mouseup', 'pointerup', 'wheel'].forEach(function (ev) { el.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    BP.el = el;
    return el;
  }
  function renderBag(force) {
    if (!BP.open || !bagPanel()) return;
    var items = bagItems(), used = 0;
    items.forEach(function (it) { used += it.n * it.each; });
    var worn = ['helmet', 'vest'].map(function (sl) { var a = L.armor[sl]; return a ? sl + a.id + Math.round(a.dur) : ''; }).join();
    var sig = JSON.stringify(items.map(function (it) { return it.key + it.n; })) + worn + JSON.stringify(L.owned) + JSON.stringify(L.att) + '|' + L.pack;
    if (!force && sig === BP.sig) return;
    BP.sig = sig;
    var cap = bagCap(), pct = Math.min(100, used / cap * 100);
    var cats = [['ammo', 'Ammo'], ['nade', 'Throwables'], ['med', 'Medical'], ['att', 'Spare attachments']];
    var rows = cats.map(function (c) {
      var list = items.filter(function (it) { return it.cat === c[0]; });
      if (!list.length) return '';
      return '<h5>' + c[1] + '</h5>' + list.map(function (it) {
        var one = it.cat === 'ammo' ? Math.min(it.n, SXA_CAL[it.id].box) : 1;
        // spare parts: the guns they fit (yours lit, others greyed)
        var fit = '', none = false;
        if (it.cat === 'ammo') {
          var ug = SXA_CAL[it.id].gun;
          none = !L.owned[ug];
          fit = '<small>used by <s class="' + (L.owned[ug] ? 'own' : 'no') + '">' + gunShort(ug) + '</s>' + (none ? ' · <s class="no">not carried</s>' : '') + '</small>';
          none = false;
        } else if (it.cat === 'att') {
          var fg = SXA_fitsGuns(it.id);
          none = !fg.some(function (k) { return L.owned[k]; });
          fit = '<small>fits ' + (fg.map(function (k) { return '<s class="' + (L.owned[k] ? 'own' : 'no') + '">' + gunShort(k) + '</s>'; }).join(' ') || '—') + (none ? ' · <s class="none">no gun for it</s>' : '') + '</small>';
        }
        return '<div class="sx-bagr c-' + it.cat + (none ? ' nogun' : '') + '" data-row="' + it.key + '"><i>' + ICON[it.cat] + '</i><b>' + esc(it.name) + fit + '</b><em>×' + it.n + '</em>' +
          '<span>' + (Math.round(it.n * it.each * 10) / 10) + '</span>' +
          '<button type="button" data-drop="' + it.key + '">Drop ' + (it.cat === 'ammo' ? one : 1) + '</button>' +
          (it.n > one ? '<button type="button" data-drop="' + it.key + '" data-all="1">All</button>' : '<button type="button" disabled>All</button>') + '</div>';
      }).join('');
    }).join('') || '<p class="sx-bage">Empty</p>';
    var eq = [];
    ['helmet', 'vest'].forEach(function (sl) { var a = L.armor[sl]; if (a) eq.push('<li><i>' + ICON[sl] + '</i>' + SXA_ARMOR[a.id].label + ' · ' + Math.max(0, Math.round(a.dur / SXA_ARMOR[a.id].dur * 100)) + '%</li>'); });
    TU.order.forEach(function (k) {
      if (!L.owned[k]) return;
      var a = L.att[k] || {}, parts = [];
      for (var sl in a) if (a[sl]) parts.push(SXA_ATT[a[sl]].short);
      // free slots and what fits them (★ = you carry one)
      var cp = SXA_COMPAT[k] || {}, free = [];
      for (var sl2 in cp) if (!a[sl2]) free.push('<s>' + sl2 + '</s> ' + cp[sl2].map(function (id) { return (L.spare[id] > 0 ? '★' : '') + SXA_ATT[id].short; }).join('/'));
      eq.push('<li><i>' + ICON.gun + '</i><div>' + (guns[k].name || gunShort(k)) + (parts.length ? ' · ' + parts.join(' ') : '') +
        '<small>' + (free.length ? 'free: ' + free.join(' · ') : 'all slots fitted') + '</small></div></li>');
    });
    var lvp = L.pack | 0;
    BP.el.innerHTML = '<header><i>' + ICON.bag + '</i><b>' + packName(lvp) + '</b>' +
      (lvp ? '<button type="button" class="sx-bagoff" title="Drop the backpack (contents must fit in your pockets: ' + BAG.caps[0] + ')">Take off</button>' : '<em class="sx-bagno">no backpack — find one for more room</em>') +
      '<span>' + (Math.round(used * 10) / 10) + ' / ' + cap + '</span><button type="button" class="sx-bagx" aria-label="Close">×</button></header>' +
      '<div class="sx-bagbar' + (cap - used < 10 ? ' full' : '') + '"><u style="width:' + pct.toFixed(1) + '%"></u></div>' +
      '<div class="sx-bagcols"><div class="sx-bagl">' + rows + '</div><div class="sx-bagq"><h5>Equipped · not in the bag</h5><ul>' + eq.join('') + '</ul></div></div>' +
      '<footer>' + (G.input && G.input.touch ? 'BAG closes' : '<kbd>Tab</kbd>, × or click outside to close · right-click a row drops one') + ' · dropped items land in front of you</footer>';
  }
  function setBag(on) {
    on = !!on;
    if (on === BP.open) return;
    var P = G.player;
    if (on && (!G.game || G.game.state !== 'playing' || !P || !P.alive || (typeof SXU !== 'undefined' && SXU && SXU.pilot))) return;
    BP.open = on;
    if (!bagPanel()) { BP.open = false; return; }
    BP.el.classList.toggle('on', on);
    if (on) {
      if (typeof SXM !== 'undefined' && SXM) SXM.holdPause = true;
      try { document.pointerLockElement && document.exitPointerLock(); } catch (e) { }
      renderBag(true);
      snd('ui_click', { gain: 0.5, pitch: 0.9 });
    } else {
      try { G.input && !G.input.touch && G.game && G.game.state === 'playing' && G.input.requestLock && G.input.requestLock(); } catch (e) { }
      setTimeout(function () { if (!BP.open && typeof SXM !== 'undefined' && SXM && !SXM.open) SXM.holdPause = false; }, 400);
    }
  }
  function updateBagHud() {
    if (!ui) return;
    if (!BP.gauge) {
      var g = document.createElement('div');
      g.className = 'sx-bag';
      g.innerHTML = '<i>' + ICON.bag + '</i><span><u></u></span><b></b><em class="sx-key"></em>';
      ui.el.insertBefore(g, ui.el.firstChild);
      BP.gauge = { el: g, u: g.querySelector('u'), b: g.querySelector('b'), k: g.querySelector('em'), t: '' };
    }
    var used = bagUsed(), cap = bagCap(), t = (L.pack | 0) + '|' + Math.round(used) + ' / ' + cap + (G.input && G.input.touch ? '' : '|TAB');
    if (BP.gauge.t !== t) {
      BP.gauge.t = t;
      BP.gauge.b.textContent = (L.pack ? 'LV.' + L.pack + ' ' : '') + Math.round(used) + ' / ' + cap;
      BP.gauge.k.textContent = G.input && G.input.touch ? 'BAG' : 'TAB';
      BP.gauge.u.style.width = Math.min(100, used / cap * 100).toFixed(1) + '%';
      BP.gauge.el.classList.toggle('full', cap - used < 10); // red once a medkit no longer fits
      BP.gauge.el.classList.toggle('lv0', !L.pack);
    }
    if (BP.open) renderBag(false);
  }
  // Esc does nothing while the backpack is open: the browser won't re-lock the
  // mouse after an Esc, so closing with it would drop the game into the pause
  // menu. Close with Tab, × or a click outside the panel (both re-lock fine).
  // Tab never moves focus in play.
  addEventListener('keydown', function (e) {
    if (e.code === 'Escape' && BP.open) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.code === 'Tab' && G.game && G.game.state === 'playing') e.preventDefault();
  }, true);
  addEventListener('mousedown', function (e) {
    if (!BP.open || !BP.el || BP.el.contains(e.target)) return;
    e.preventDefault(); e.stopImmediatePropagation()
    setBag(false);
  }, true);
  G.events.on('input:lock', function (ev) { if (ev && ev.locked && BP.open) setBag(false); });
  // online you respawn without a backpack, like without armor (net.js resets that)
  G.events.on('player:dead', function () { if (window.SXN_MP) L.packReset = true; });
  G.events.on('game:state', function (ev) { if (ev && ev.state !== 'playing' && BP.open) setBag(false); });

  // ---- the facade the rest of the game talks to ----
  function applyOffsets(g, dt) {
    var root = g.root;
    var lower = 0;
    if (L.sw) lower = L.sw.phase === 'lower' ? Yo(L.sw.t / 0.15) : 1 - Yo(L.sw.t / 0.22);
    if (lower > 0) {
      root.position.y -= 0.17 * lower;
      root.position.x += 0.02 * lower;
      root.rotation.x -= 0.6 * lower;
    }
    if (L.heal) {
      var hk = Yo(Math.min(1, L.heal.t / 0.25)) * (1 - Yo(Math.max(0, (L.heal.t - L.heal.T + 0.25) / 0.25)));
      root.position.y -= 0.2 * hk;
      root.rotation.x -= 0.7 * hk;
    }
    if (L.thr) {
      var k = Math.sin(Math.PI * Math.min(1, L.thr.t / 0.5));
      root.position.y -= 0.11 * k;
      root.position.x += 0.035 * k;
      root.rotation.x -= 0.3 * k;
      root.rotation.z -= 0.28 * k;
    }
  }

  var A = {
    get name() { return cur().name; },
    get ammo() { return cur().ammo; }, set ammo(v) { cur().ammo = v; },
    get magSize() { return cur().magSize; },
    get reserve() { return cur().reserve; }, set reserve(v) { cur().reserve = v; },
    get state() { return L.sw ? 'switching' : cur().state; },
    get ads() { return cur().ads; },
    get spread() { return cur().spread; },
    get damage() { return cur().damage; },
    get rpm() { return cur().rpm; },
    get root() { return cur().root; },
    get debug() { return rifle.debug; },
    get info() { return rifle.info; },
    arsenal: { knife: { equip: function () { knifeEquip(); }, holster: function () { knifeHolster(); }, get out() { return !!L.knOut; }, get mode() { return L.kn && L.kn.mode; }, get style() { return knifeStyle().id; }, freeze: function (style, t) { var i = TU.knife.styles.findIndex(function (x) { return x.id === style; }); if (i >= 0) L.knStyle = i; if (!L.knOut) knifeEquip(); L.kn = { mode: 'slash', t: t, hit: true, freeze: true }; knifeShow(t); }, model: !!knifeVM.model, root: knifeVM.root }, knifeKeys: KP, guns: guns, loadout: L, heal: startHeal, cycleScope: function () { cycleScope(); }, armorCut: armorCut, pickups: function () { return pickups; }, grenades: function () { return live; }, select: requestSwitch, tune: TU, bag: { open: function (v) { setBag(v); }, get isOpen() { return BP.open; }, items: function () { return bagItems(); }, used: function () { return bagUsed(); }, cap: function () { return bagCap(); }, takeOff: function () { takeOffPack(); }, drop: function (k, all) { dropItem(k, all); } }, spawnPickup: function (kind, pos) { var pk = makePickup(kind, pos, false); pickups.push(pk); return pk; }, resetPickups: function () { placePickups(); } },
    update: function (dt) {
      ensureEnemies();
      if (typeof SXU !== 'undefined' && SXU && SXU.pilot) {
        L.sw = null; L.thr = null; L.wheel = 0; L.heal = null;
        if (BP.open) setBag(false);
        updateLabels(dt);
        if (scopeEl && scopeEl._on) { scopeEl._on = false; scopeEl.classList.remove('on'); }
        if (acogEl && acogEl._on) { acogEl._on = false; acogEl.classList.remove('on'); }
        updateNades(dt);
        updatePickups(dt);
        return;
      }
      var inp = G.input, P = G.player;
      var alive = P && P.alive;
      if (L.packReset && alive) { L.packReset = false; L.pack = 0; resetAmmo(); }
      if (inp && inp.pressed && inp.pressed('bag')) setBag(!BP.open);
      if (BP.open && !alive) setBag(false);
      if (alive && inp && inp.pressed && !BP.open) {
        if (inp.pressed('w1')) requestSwitch('rifle');
        if (inp.pressed('w2')) requestSwitch('shotgun');
        if (inp.pressed('w3')) requestSwitch('pistol');
        if (inp.pressed('w4')) requestSwitch('sniper');
        if (inp.pressed('wnext')) cycle(1);
        if (inp.pressed('wprev')) cycle(-1);
        if (inp.pressed('wlast') && L.owned[L.last] && L.last !== L.cur) requestSwitch(L.last);
        if (inp.pressed('nadeType')) {
          var at = TU.nadeOrder.indexOf(L.nadeType);
          L.nadeType = TU.nadeOrder[(at + 1) % TU.nadeOrder.length];
          snd('ui_click', { gain: 0.6, pitch: 1.3 });
        }
        if (inp.pressed('grenade')) { cancelHeal(); tryThrow(); }
        if (inp.pressed('heal')) startHeal(null);
        if (inp.pressed('heal_s')) startHeal('med_s');
        if (inp.pressed('heal_m')) startHeal('med');
        if (inp.pressed('heal_l')) startHeal('med_l');
        if (inp.pressed('scope')) cycleScope();
        if (L.sw) cancelHeal();
      }
      if (Math.abs(L.wheel) >= 40) { if (alive) cycle(L.wheel > 0 ? 1 : -1); L.wheel = 0; }
      L.wheel *= 0.9;

      // weapon swap: lower the current gun, swap, raise the next
      if (L.sw) {
        L.sw.t += dt;
        if (L.sw.phase === 'lower' && L.sw.t >= 0.15) {
          var from = cur();
          from.holster && from.holster();
          if (L.sw.to !== L.cur) L.last = L.cur;
          L.cur = L.sw.to;
          showOnly(L.cur);
          var to = cur();
          to.snap && to.snap();
          L.sw.phase = 'raise'; L.sw.t = 0;
          snd('reload_bolt', { gain: 0.35, pitch: 1.5 });
        } else if (L.sw.phase === 'raise' && L.sw.t >= 0.22) L.sw = null;
      }
      if (L.thr) {
        L.thr.t += dt;
        if (!L.thr.spawned && L.thr.t >= 0.14) { L.thr.spawned = true; spawnNade(L.thr.type); }
        if (L.thr.t >= 0.55) L.thr = null;
      }
      updateHeal(dt);
      updateKnife(dt, alive, inp);
      wrapPlayerDamage();
      armorPingT -= dt;
      var g = cur(), block = !!(L.sw || L.thr || L.heal || BP.open || L.knOut);
      var mask = L.knOut && inp, m0 = mask ? { fire: inp.fire, ads: inp.ads, pressed: inp.pressed } : null;
      if (mask) { inp.fire = false; inp.ads = false; inp.pressed = function (n) { return n === 'reload' || n === 'fire' || n === 'ads' ? false : m0.pressed.call(inp, n); }; }
      try {
        if (g === rifle) { rifle.debug.noFire = block; rifle.update(dt); }
        else { g.blockFire = block; g.update(dt); }
      } finally { if (mask) { inp.fire = m0.fire; inp.ads = m0.ads; inp.pressed = m0.pressed; } }
      applyOffsets(g, dt);
      updateScope(dt);
      updateNades(dt);
      updatePickups(dt);
      updateHud(dt);
      updateBagHud();
      updateLabels(dt);
    },
    // back to the starting kit (a respawn in a room): guns, attachments, armour,
    // backpack, ammo, grenades, medkits — the world's pickups stay as they are
    resetKit: function () {
      rifle.reset();
      guns.shotgun.reset();
      guns.pistol.reset();
      guns.sniper.reset();
      L.owned = { rifle: true, shotgun: false, pistol: true, sniper: false };
      L.spare = {};
      L.pack = 0; L.packReset = false;
      L.armor = { helmet: null, vest: null };
      resetAttachments();
      L.cur = 'rifle'; L.last = 'pistol'; L.sw = null; L.thr = null; L.heal = null;
      L.knOut = false; L.kn = null; L.knCool = 0; knifeVM.root.visible = false; document.body.classList.remove('sx-knife');
      resetNades();
      resetMeds();
      resetAmmo();
      applyStartKit();
      if (BP.open) setBag(false);
      L.visible = true;
      showOnly(L.cur);
      if (ui) ui.last = '';
    },
    reset: function () {
      L.knOut = false; L.kn = null; L.knCool = 0; knifeVM.root.visible = false; document.body.classList.remove('sx-knife');
      rifle.reset();
      guns.shotgun.reset();
      guns.pistol.reset();
      guns.sniper.reset();
      L.owned = { rifle: true, shotgun: false, pistol: true, sniper: false };
      L.spare = {};
      L.pack = 0; L.packReset = false;
      L.armor = { helmet: null, vest: null };
      resetAttachments();
      L.cur = 'rifle'; L.last = 'pistol'; L.sw = null; L.thr = null;
      resetNades();
      resetMeds();
      resetAmmo();
      applyStartKit();
      live.forEach(function (n) { world.remove(n.mesh); });
      live.length = 0;
      shocks.forEach(function (s) { world.remove(s.m); });
      shocks.length = 0;
      placePickups();
      if (BP.open) setBag(false);
      (G.enemies && G.enemies.list || []).forEach(function (e) { e.sxStun = 0; });
      showOnly(L.cur);
      if (ui) ui.last = '';
    },
    setVisible: function (v) { L.visible = !!v; showOnly(L.cur); },
    muzzleWorld: function (out) { return cur().muzzleWorld(out); },
    reloadNow: function () { return cur().reloadNow(); },
    addAmmo: function (n) { var g = cur(); g.reserve = Math.min(g.maxReserve || 999, g.reserve + n); },
    setWetness: function (v) { rifle.setWetness(v); },
    snap: function () { cur().snap(); },
  };

  G.events.on('game:state', function (ev) {
    if (ev && ev.state === 'playing' && !L.hinted) {
      L.hinted = true;
      setTimeout(function () {
        var h = hud();
        if (h && G.game && G.game.state === 'playing' && !(typeof SXU !== 'undefined' && SXU && SXU.pilot)) h.message(G.input && G.input.touch ? 'SWAP — weapons · NADE — throw · TYPE — grenade type' : '1–4 / wheel — weapons · G — grenade · T — grenade type · H — medkit', 5);
      }, 4200);
    }
  });

  // out of everything on this gun: swap to one that still has rounds
  G.events.on('weapon:dry', function () {
    var g = cur();
    if (g.reserve > 0 || L.sw) return;
    var next = TU.order.filter(function (k) { return L.owned[k] && k !== L.cur && (guns[k].ammo > 0 || guns[k].reserve > 0); })[0];
    if (next) setTimeout(function () { var c = cur(); if (c.ammo <= 0 && c.reserve <= 0) requestSwitch(next); }, 260);
  });

  placePickups();
  showOnly(L.cur);
  console.log('[arsenal] ready: rifle, ' + guns.shotgun.name + ', ' + guns.pistol.name + '; grenades ' + TU.nadeOrder.join('/'));
  return A;
}
