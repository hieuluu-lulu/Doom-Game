"""Build DoomZone into one self-contained HTML file.

Project layout
  game/favicon/     the tab / home-screen icons (doomzone-32/64/180.png, made by
                    tools/favicon.cjs), inlined where <!--@@ICON@@--> sits
  game/shell.html   the page skeleton; /*@@CSS@@*/ and //@@JS@@ mark where the
                    styles and the script go
  game/style.css    the game's own styles
  game/js/*.js      the game's own code (three.js + the game), concatenated in
                    name order; they are slices of ONE script
  <feature>/        the mod features, built in FEATURES order. Each may hold:
      <name>.js     its code; inserted between game/js/10_game.js and
                    90_boot.js, so it shares the game's scope (three.js is `lt`)
      <name>.css    appended after the game's styles
      lib/*.js      vendored scripts, inserted (sorted) in front of <name>.js
      assets/*      binary files (models, textures), embedded as
                    `var SX_ASSET_<stem> = "<base64>"` so the game runs offline
  models/           the original downloaded models (sources, not built)
  tools/            model optimisation scripts, esbuild for --min

usage: python3 -I build.py [--debug] [--features arsenal,desert] [--out path] [--copy]
  default: a release build — the script minified with esbuild
           (tools/node_modules/.bin/esbuild, or esbuild on PATH; run
           `npm install` in tools/ once) — written to dist/index.html
           (inside this folder only). Without esbuild it builds unminified.
  --debug    keep the script readable (no minify), for the browser devtools
  --copy     also copy the result next to the project folder (../doomzone.html);
             off by default (--no-copy is still accepted and does nothing)
"""

import base64
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, 'game')
# index.html: the page a static host (Vercel, …) serves at the site root
DIST = os.path.join(HERE, 'dist', 'index.html')
COPY = os.path.join(HERE, '..', 'doomzone.html')
FEATURES = ['common', 'desert', 'crossroads', 'waterworks', 'arsenal', 'units', 'walkers', 'aircraft', 'cars', 'jets',
            'outposts', 'troopers', 'minimap', 'menu', 'view', 'score', 'net', 'perf', 'shots', 'gunfx']
SPLIT_AFTER = '10_game.js'  # the features go right after this slice of the game script


def read(path):
    return open(path, encoding='utf-8').read()


def feature_parts(name):
    """(css or None, js or None) of one feature folder."""
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
            stem = ''.join(c if c.isalnum() else '_' for c in os.path.splitext(fn)[0])
            data = base64.b64encode(open(os.path.join(asset_dir, fn), 'rb').read()).decode('ascii')
            pre.append(f'var SX_ASSET_{stem} = "{data}"')
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


def build(features, do_min):
    shell = read(os.path.join(GAME, 'shell.html'))
    css = [read(os.path.join(GAME, 'style.css'))]
    slices = sorted(fn for fn in os.listdir(os.path.join(GAME, 'js')) if fn.endswith('.js'))
    if SPLIT_AFTER not in slices:
        raise SystemExit(f'game/js/{SPLIT_AFTER} missing')
    head = [read(os.path.join(GAME, 'js', fn)) for fn in slices if fn <= SPLIT_AFTER]
    tail = [read(os.path.join(GAME, 'js', fn)) for fn in slices if fn > SPLIT_AFTER]
    mods = []
    for name in features:
        fcss, fjs = feature_parts(name)
        if fcss is not None:
            css.append(f'/* --- mod:{name} --- */\n{fcss}')
        if fjs is not None:
            mods.append(f'/* --- mod:{name} --- */\n;{fjs}\n;')
    js = '\n'.join(head + mods + tail)
    if do_min:
        js = minify(js)
    if shell.count('/*@@CSS@@*/') != 1 or shell.count('//@@JS@@') != 1:
        raise SystemExit('game/shell.html must hold one /*@@CSS@@*/ and one //@@JS@@')
    return icons(shell).replace('/*@@CSS@@*/', '\n'.join(css)).replace('//@@JS@@', js)


# the favicons as data: URIs, so the one file needs nothing beside it
def icons(shell):
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
    return shell.replace('<!--@@ICON@@-->', '\n'.join(links))


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
    html = build(features, do_min)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print(f'built {out} ({len(html)} bytes) features={features}' + (' release (minified)' if do_min and esbuild_path() else ' debug (readable)'))
    if out == DIST and '--copy' in argv:
        shutil.copyfile(out, COPY)
        print(f'copied to {os.path.normpath(COPY)}')


if __name__ == '__main__':
    main(sys.argv[1:])
