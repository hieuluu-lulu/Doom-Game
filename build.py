"""Build DoomZone: one HTML page plus its model / texture files.

Project layout
  game/favicon/     the tab / home-screen icons (doomzone-32/64/180.png, made by
                    tools/favicon.cjs), inlined where <!--@@ICON@@--> sits
  game/shell.html   the page skeleton; /*@@CSS@@*/ and //@@JS@@ mark where the
                    styles and the script go, /*@@PRELOAD@@*/ where
                    game/preload.js goes (in the <head>)
  game/preload.js   starts downloading the asset files the chosen map uses
                    before the game script arrives (split build)
  game/style.css    the game's own styles
  game/js/*.js      the game's own code (three.js + the game), concatenated in
                    name order; they are slices of ONE script
  <feature>/        the mod features, built in FEATURES order. Each may hold:
      <name>.js     its code; inserted between game/js/10_game.js and
                    90_boot.js, so it shares the game's scope (three.js is `lt`)
      <name>.css    appended after the game's styles
      lib/*.js      vendored scripts, inserted (sorted) in front of <name>.js
      assets/*      binary files (models, textures). The game reads each one
                    as the base64 string SX_ASSET_<stem>; see "builds" below
  models/           the original downloaded models (sources, not built)
  tools/            model optimisation scripts, esbuild for --min

Builds
  split (default)   dist/index.html + dist/assets/<stem>.<hash>.<ext>. The
                    files keep a content-hashed name, so a browser reuses them
                    across deploys and each map downloads only what it uses
                    (game/preload.js + SX_bootAssets in common/common.js).
                    Needs a web server (GitHub Pages, `python3 -m http.server`).
  --single          everything embedded in the one HTML file
                    (`var SX_ASSET_<stem> = "<base64>"`): runs offline, opened
                    straight from disk, but every visit loads all of it.

usage: python3 -I build.py [--single] [--debug] [--features arsenal,desert] [--out path] [--copy]
  default: a release build — the script minified with esbuild
           (tools/node_modules/.bin/esbuild, or esbuild on PATH; run
           `npm install` in tools/ once) — written to dist/index.html
           (inside this folder only). Without esbuild it builds unminified.
  --single   one self-contained file (see above)
  --debug    keep the script readable (no minify), for the browser devtools
  --out      write the page there (a split build puts assets/ beside it)
  --copy     also copy the result next to the project folder (../doomzone.html);
             implies --single, since the copy has no assets/ beside it.
             Off by default (--no-copy is still accepted and does nothing)
"""

import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, 'game')
# index.html: the page a static host (GitHub Pages, Vercel, …) serves at the site root
DIST = os.path.join(HERE, 'dist', 'index.html')
COPY = os.path.join(HERE, '..', 'doomzone.html')
FEATURES = ['common', 'desert', 'crossroads', 'waterworks', 'arsenal', 'units', 'walkers', 'aircraft', 'cars', 'driver', 'jets',
            'outposts', 'houses', 'troopers', 'minimap', 'menu', 'view', 'score', 'modes', 'stats', 'keys', 'offline', 'net', 'perf', 'shots', 'gunfx']
SPLIT_AFTER = '10_game.js'  # the features go right after this slice of the game script
ASSET_DIR = 'assets'  # beside the page, split build
ASSET_NAME = re.compile(r'^[A-Za-z0-9_]+\.[0-9a-f]{10}\.[A-Za-z0-9]+$')  # <stem>.<hash>.<ext>


def read(path):
    return open(path, encoding='utf-8').read()


def asset_key(fn):
    return ''.join(c if c.isalnum() else '_' for c in os.path.splitext(fn)[0])


def feature_parts(name, files):
    """(css or None, js or None) of one feature folder. `files` is None for a
    --single build (assets embedded), else a list that collects
    (key, published name, bytes, feature) for the split build."""
    folder = os.path.join(HERE, name)
    if not os.path.isdir(folder):
        raise SystemExit(f'feature folder missing: {name}/')
    css_path = os.path.join(folder, name + '.css')
    js_path = os.path.join(folder, name + '.js')
    css = read(css_path) if os.path.exists(css_path) else None
    pre = []
    lib_dir = os.path.join(folder, 'lib')
    if os.path.isdir(lib_dir):
        for fn in sorted(os.listdir(lib_dir)):
            if fn.endswith('.js'):
                pre.append(read(os.path.join(lib_dir, fn)))
    asset_dir = os.path.join(folder, 'assets')
    if os.path.isdir(asset_dir):
        for fn in sorted(os.listdir(asset_dir)):
            if fn.startswith('.'):
                continue
            key = asset_key(fn)
            data = open(os.path.join(asset_dir, fn), 'rb').read()
            if files is None:
                pre.append(f'var SX_ASSET_{key} = "{base64.b64encode(data).decode("ascii")}"')
            else:
                ext = os.path.splitext(fn)[1].lstrip('.').lower()
                published = f'{key}.{hashlib.sha256(data).hexdigest()[:10]}.{ext}'
                files.append((key, published, data, name))
    js = None
    if os.path.exists(js_path):
        js = '\n;\n'.join(pre + [read(js_path)])
        if '</script' in js:
            raise SystemExit(f'[{name}] JS must not contain a closing script tag')
    return css, js


def esbuild_path():
    local = os.path.join(HERE, 'tools', 'node_modules', '.bin', 'esbuild')
    if os.path.exists(local):
        return local
    return shutil.which('esbuild')


def minify(js):
    exe = esbuild_path()
    if not exe:
        print('note: esbuild not found (run `npm install` in tools/) — building unminified')
        return js
    with tempfile.TemporaryDirectory() as tmp:
        src, out = os.path.join(tmp, 'in.js'), os.path.join(tmp, 'out.js')
        open(src, 'w', encoding='utf-8').write(js)
        # whitespace + syntax only: the mod features look each other up by name
        # (typeof SXN_..., window.__G), so identifiers are left alone
        subprocess.run([exe, src, '--minify-whitespace', '--minify-syntax', '--log-level=warning', '--outfile=' + out],
                       check=True)
        return read(out)


def build(features, do_min, files):
    """The page's HTML. `files`: None (--single) or the list the split build's
    asset files are collected into."""
    shell = read(os.path.join(GAME, 'shell.html'))
    css = [read(os.path.join(GAME, 'style.css'))]
    slices = sorted(fn for fn in os.listdir(os.path.join(GAME, 'js')) if fn.endswith('.js'))
    if SPLIT_AFTER not in slices:
        raise SystemExit(f'game/js/{SPLIT_AFTER} missing')
    head = [read(os.path.join(GAME, 'js', fn)) for fn in slices if fn <= SPLIT_AFTER]
    tail = [read(os.path.join(GAME, 'js', fn)) for fn in slices if fn > SPLIT_AFTER]
    mods = []
    for name in features:
        fcss, fjs = feature_parts(name, files)
        if fcss is not None:
            css.append(f'/* --- mod:{name} --- */\n{fcss}')
        if fjs is not None:
            mods.append(f'/* --- mod:{name} --- */\n;{fjs}\n;')
    js = '\n'.join(head + mods + tail)
    if do_min:
        js = minify(js)
    for mark in ('/*@@CSS@@*/', '//@@JS@@', '/*@@PRELOAD@@*/'):
        if shell.count(mark) != 1:
            raise SystemExit(f'game/shell.html must hold one {mark}')
    return (icons(shell, files is not None).replace('/*@@PRELOAD@@*/', preload(files or []))
            .replace('/*@@CSS@@*/', '\n'.join(css)).replace('//@@JS@@', js))


def preload(files):
    """game/preload.js with the asset list filled in ([] for --single)."""
    src = read(os.path.join(GAME, 'preload.js'))
    if src.count('/*@@ASSET_LIST@@*/[]') != 1:
        raise SystemExit('game/preload.js must hold one /*@@ASSET_LIST@@*/[]')
    keys = [f[0] for f in files]
    dup = sorted({k for k in keys if keys.count(k) > 1})
    if dup:
        raise SystemExit(f'two asset files share a name: {", ".join(dup)}')
    rows = [[key, f'{ASSET_DIR}/{pub}', len(data), feat] for key, pub, data, feat in files]
    listing = json.dumps(rows, separators=(',', ':')) if rows else '[]'
    out = src.replace('/*@@ASSET_LIST@@*/[]', listing)
    if '</script' in out:
        raise SystemExit('game/preload.js must not contain a closing script tag')
    return out


def write_assets(out, files, clean):
    """The split build's files into assets/ beside the page. `clean` (the
    dist/ build only) also removes the ones an older build left there."""
    folder = os.path.join(os.path.dirname(os.path.abspath(out)), ASSET_DIR)
    os.makedirs(folder, exist_ok=True)
    keep = set()
    for _key, pub, data, _feat in files:
        keep.add(pub)
        path = os.path.join(folder, pub)
        if not (os.path.exists(path) and os.path.getsize(path) == len(data)):
            with open(path, 'wb') as fh:
                fh.write(data)
    if clean:
        for fn in os.listdir(folder):
            if fn not in keep and ASSET_NAME.match(fn):
                os.remove(os.path.join(folder, fn))
    return sum(len(f[2]) for f in files)


# the favicons as data: URIs, so the page needs nothing beside it for them;
# a split build also links the web-app manifest (installable, see write_pwa)
def icons(shell, split=False):
    if '<!--@@ICON@@-->' not in shell:
        return shell
    d = os.path.join(GAME, 'favicon')
    links = []
    for n, rel in ((32, 'icon'), (64, 'icon'), (180, 'apple-touch-icon')):
        fn = os.path.join(d, f'doomzone-{n}.png')
        if not os.path.exists(fn):
            continue
        b64 = base64.b64encode(open(fn, 'rb').read()).decode('ascii')
        size = '' if rel == 'apple-touch-icon' else f' type="image/png" sizes="{n}x{n}"'
        links.append(f'<link rel="{rel}"{size} href="data:image/png;base64,{b64}">')
    if split:
        links += ['<link rel="manifest" href="manifest.webmanifest">',
                  '<meta name="theme-color" content="#0b0d0f">',
                  '<meta name="mobile-web-app-capable" content="yes">',
                  '<meta name="apple-mobile-web-app-capable" content="yes">',
                  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
                  '<meta name="apple-mobile-web-app-title" content="DoomZone">']
    return shell.replace('<!--@@ICON@@-->', '\n'.join(links))


PWA_ICONS = [('doomzone-192.png', '192x192', 'any'), ('doomzone-512.png', '512x512', 'any'),
             ('doomzone-512-maskable.png', '512x512', 'maskable')]
PWA_FILES = ['sw.js', 'manifest.webmanifest', 'icons']


def write_pwa(out, files, html):
    """The split build's web-app files beside the page: icons/, the manifest
    and sw.js (game/sw.js with this build's version and asset list), which
    game/preload.js registers so the game opens offline and installs."""
    base = os.path.dirname(os.path.abspath(out))
    os.makedirs(os.path.join(base, 'icons'), exist_ok=True)
    for fn, _size, _purpose in PWA_ICONS:
        src = os.path.join(GAME, 'favicon', fn)
        if not os.path.exists(src):
            raise SystemExit(f'game/favicon/{fn} missing (node tools/favicon.cjs game/favicon)')
        shutil.copyfile(src, os.path.join(base, 'icons', fn))
    manifest = {
        'name': 'DoomZone', 'short_name': 'DoomZone',
        'description': 'First-person shooter in the browser: missions, Survival, online rooms.',
        'start_url': './', 'scope': './', 'id': './',
        'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'], 'orientation': 'landscape',
        'background_color': '#0b0d0f', 'theme_color': '#0b0d0f',
        'icons': [{'src': f'icons/{fn}', 'sizes': size, 'type': 'image/png', 'purpose': purpose}
                  for fn, size, purpose in PWA_ICONS],
    }
    with open(os.path.join(base, 'manifest.webmanifest'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=1)
    sw = read(os.path.join(GAME, 'sw.js'))
    for mark in ("/*@@SW_VERSION@@*/'dev'", '/*@@SW_ASSETS@@*/[]'):
        if sw.count(mark) != 1:
            raise SystemExit(f'game/sw.js must hold one {mark}')
    urls = [f'{ASSET_DIR}/{pub}' for _k, pub, _d, _f in files]
    version = hashlib.sha256((html + '\n'.join(urls)).encode('utf-8')).hexdigest()[:12]
    sw = sw.replace("/*@@SW_VERSION@@*/'dev'", json.dumps(version)).replace('/*@@SW_ASSETS@@*/[]', json.dumps(urls))
    with open(os.path.join(base, 'sw.js'), 'w', encoding='utf-8') as fh:
        fh.write(sw)


def main(argv):
    features = list(FEATURES)
    out = DIST
    if '--features' in argv:
        features = [f for f in argv[argv.index('--features') + 1].split(',') if f]
        if 'common' not in features:
            features.insert(0, 'common')  # shared loader/helpers, always first
    if '--out' in argv:
        out = argv[argv.index('--out') + 1]
    do_min = '--debug' not in argv
    single = '--single' in argv or '--copy' in argv
    files = None if single else []
    html = build(features, do_min, files)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(html)
    is_dist = os.path.abspath(out) == DIST
    kind = ' release (minified)' if do_min and esbuild_path() else ' debug (readable)'
    if single:
        if is_dist:  # a single page needs no assets/, worker or manifest beside it
            for fn in [ASSET_DIR] + PWA_FILES:
                p = os.path.join(os.path.dirname(DIST), fn)
                if os.path.isdir(p):
                    shutil.rmtree(p)
                elif os.path.exists(p):
                    os.remove(p)
        print(f'built {out} ({len(html)} bytes, single file) features={features}' + kind)
    else:
        size = write_assets(out, files, is_dist)
        write_pwa(out, files, html)
        print(f'built {out} ({len(html)} bytes) + {len(files)} files in {ASSET_DIR}/ ({size} bytes) + sw.js, manifest, icons/ features={features}' + kind)
    if is_dist and '--copy' in argv:
        shutil.copyfile(out, COPY)
        print(f'copied to {os.path.normpath(COPY)}')


if __name__ == '__main__':
    main(sys.argv[1:])
