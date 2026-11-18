#!/usr/bin/env python3
"""
Independent losslessness check: proves that www/ is the original single file, only re-packaged.

  python3 tools/verify_www.py <original-index.html> <www-dir>

Checks
  1. every base64 image of the original exists as a file with identical bytes (sha1 match) and every file in assets/img is used;
  2. every deferred <script> body == js/NN-*.js  (after putting the images back)   [+ the 3 documented code patches];
  3. the question bank JSON is byte-identical;
  4. all original <style> blocks (except the 3 inline first-paint ones) appear, in order and identical, in css/core.css + css/late.css;
  5. the page markup (everything outside script/style/comments) is identical;
  6. every /assets/... path referenced by html/css/js exists.
"""
import re, sys, os, base64, hashlib, glob
SRC, WWW = sys.argv[1], sys.argv[2]
s = open(SRC, encoding='utf-8').read()
B64 = re.compile(r'data:([a-z]+/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]{200,})')
EXT = {'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg'}
fails = []
def check(ok, msg):
    print(('PASS  ' if ok else 'FAIL  ') + msg)
    if not ok: fails.append(msg)

# --- 1. images
orig_imgs = {}
for m in B64.finditer(s):
    raw = base64.b64decode(m.group(2)); sha = hashlib.sha1(raw).hexdigest()[:12]
    orig_imgs[sha] = (sha + '.' + EXT[m.group(1)], raw)
files = set(os.listdir(os.path.join(WWW, 'assets', 'img')))
ok = all(os.path.exists(os.path.join(WWW, 'assets', 'img', n)) and open(os.path.join(WWW, 'assets', 'img', n), 'rb').read() == raw for n, raw in orig_imgs.values())
check(ok, '%d unique images: every file has byte-identical content to the original base64' % len(orig_imgs))
check(files == {n for n, _ in orig_imgs.values()}, 'assets/img contains exactly those images, nothing else')
def rep_to_path(text): return B64.sub(lambda m: '/assets/img/' + orig_imgs[hashlib.sha1(base64.b64decode(m.group(2))).hexdigest()[:12]][0], text)

# --- tokenise original
tok = re.compile(r'<!--.*?-->|<(script|style)\b([^>]*)>', re.S); blocks = []; pos = 0
while True:
    m = tok.search(s, pos)
    if not m: break
    if m.group(0).startswith('<!--'): pos = m.end(); continue
    k = m.group(1); c = s.find('</' + k + '>', m.end())
    blocks.append((k, m.group(2), m.start(), m.end(), c, c + len(k) + 3)); pos = c + len(k) + 3
GATE = ('shb-v47-gate', 'sb-early-bg', 'shb-shell-gate')
def bid(a):
    x = re.search(r'\bid="([^"]+)"', a); return x.group(1) if x else ''

# --- 2. deferred scripts
PATCHES = [  # (old, new) - the only code edits, all documented in README
 ("const docImg=n=>`src=\"assets/doctor/${n}.png\" onerror=\"this.onerror=null;this.src=DOC_EMB['${n}']\"`;", "const docImg=n=>`src=\"${DOC_EMB[n]}\"`;"),
 ("function printHTML(html){let w=null;try{w=window.open('','_blank')}catch(e){}", "function printHTML(html){if(window.ShbaceNative&&window.ShbaceNative.printHtml){try{if(window.ShbaceNative.printHtml(String(html)))return true}catch(e){}}let w=null;try{w=window.open('','_blank')}catch(e){}"),
]
AVATAR = re.compile(r"const JOURNEY_AVATAR=\(function\(\)\{try\{const bin=atob\(JOURNEY_AVATAR_DATA\.split\(','\)\[1\]\).*?return JOURNEY_AVATAR_DATA\}\}\)\(\);", re.S)
deferred = [b for b in blocks if b[0] == 'script' and 'text/shb-deferred' in b[1]]
jsfiles = sorted(glob.glob(os.path.join(WWW, 'js', '*.js')))
check(len(deferred) == len(jsfiles), '%d deferred scripts -> %d js files' % (len(deferred), len(jsfiles)))
allok = True
for b, f in zip(deferred, jsfiles):
    exp = rep_to_path(s[b[3]:b[4]]); got = open(f, encoding='utf-8').read()
    for o, n in PATCHES: exp = exp.replace(o, n)
    exp = AVATAR.sub('<<AVATAR>>', exp); got = re.sub(r"const JOURNEY_AVATAR=JOURNEY_AVATAR_DATA;try\{\(window\.requestIdleCallback.*?\}catch\(e\)\{\}", '<<AVATAR>>', got, flags=re.S)
    if exp != got: allok = False; print('   differs:', os.path.basename(f))
check(allok, 'every deferred script body is identical to its js file (images re-linked, 3 documented patches applied)')

# --- 3. JSON
qb = [b for b in blocks if b[0] == 'script' and 'application/json' in b[1]][0]
check(s[qb[3]:qb[4]] == open(os.path.join(WWW, 'data', 'qbData.json'), encoding='utf-8').read(), 'question bank JSON is byte-identical (%d chars)' % (qb[4] - qb[3]))

# --- 4. CSS
css = open(os.path.join(WWW, 'css', 'core.css'), encoding='utf-8').read() + open(os.path.join(WWW, 'css', 'late.css'), encoding='utf-8').read()
cur = 0; ok = True; n = 0
for b in blocks:
    if b[0] == 'style' and bid(b[1]) not in GATE:
        chunk = rep_to_path(s[b[3]:b[4]]).strip('\n'); i = css.find(chunk, cur)
        if i < 0: ok = False; print('   missing css block', bid(b[1])); break
        cur = i + len(chunk); n += 1
check(ok, '%d <style> blocks found in css/core.css + css/late.css, identical and in the original cascade order' % n)

# --- 5. markup
def markup(t):
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'<script\b.*?</script>', '', t, flags=re.S); t = re.sub(r'<style\b.*?</style>', '', t, flags=re.S)
    t = re.sub(r'<link rel="(?:stylesheet|preload)"[^>]*>', '', t)
    return re.sub(r'\s+', '', t)
new_html = open(os.path.join(WWW, 'index.html'), encoding='utf-8').read()
check(markup(rep_to_path(s)) == markup(new_html), 'page markup (outside scripts/styles) is identical')

# --- 6. references
missing = set(); used = set()
for f in [os.path.join(WWW, 'index.html')] + glob.glob(os.path.join(WWW, 'css', '*.css')) + glob.glob(os.path.join(WWW, 'js', '*.js')):
    for p in re.findall(r'/assets/img/[0-9a-f]{12}\.[a-z]+', open(f, encoding='utf-8').read()):
        used.add(p)
        if not os.path.exists(os.path.join(WWW, p.lstrip('/'))): missing.add(p)
check(not missing and {u.split('/')[-1] for u in used} == files, 'all %d referenced image paths exist and every image file is referenced' % len(used))
print('\nRESULT:', 'ALL CHECKS PASSED' if not fails else '%d FAILED' % len(fails)); sys.exit(1 if fails else 0)
