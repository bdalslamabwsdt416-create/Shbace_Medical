#!/usr/bin/env python3
"""
SHBACE Medical - split the single-file app (index.html, ~19 MB) into a Capacitor `www/` folder.

LOSSLESS by design:
  * every base64 image is decoded to a real file with the SAME BYTES (no re-encoding, no resizing);
  * every <style> block is moved, in the original order, into css/core.css and css/late.css;
  * every deferred <script> becomes its own classic script file in js/ (same order, same global scope);
  * the 1.4 MB question bank JSON moves, byte for byte, to data/qbData.json;
  * the only code edits are the few explicit PATCHES listed below (all documented in www/BUILD_REPORT.json).

Usage:  python3 tools/split_html.py <original-index.html> <output-www-dir>
"""
import re, sys, os, json, base64, hashlib, shutil

SRC, OUT = sys.argv[1], sys.argv[2]
s = open(SRC, encoding='utf-8').read()

# ------------------------------------------------------------------ helpers
B64 = re.compile(r'data:([a-z]+/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]{200,})')
EXT = {'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg'}
images = {}      # sha -> dict(name, mime, bytes)
img_refs = {}    # name -> count

def extract(text, prefix):
    """replace each big base64 data-URI by a file path (/assets/img/<sha1>.<ext>); write the file once (content-addressed)."""
    def rep(m):
        mime, payload = m.group(1), m.group(2)
        raw = base64.b64decode(payload, validate=True)
        sha = hashlib.sha1(raw).hexdigest()[:12]
        if sha not in images:
            name = '%s.%s' % (sha, EXT[mime])
            images[sha] = dict(name=name, mime=mime, size=len(raw))
            os.makedirs(os.path.join(OUT, 'assets', 'img'), exist_ok=True)
            with open(os.path.join(OUT, 'assets', 'img', name), 'wb') as f:
                f.write(raw)
        name = images[sha]['name']
        img_refs[name] = img_refs.get(name, 0) + 1
        return '/assets/img/' + name        # root-absolute: resolves identically from HTML, CSS files, inline styles and var(--x) (url() inside custom properties is resolved against the stylesheet that USES it)
    return B64.sub(rep, text)

def slug(t):
    t = re.sub(r'[^A-Za-z0-9]+', '-', t).strip('-').lower()
    return t[:48] or 'script'

def css_balanced(css):
    """brace balance outside of strings/comments (so concatenation can never swallow the next block)"""
    depth = 0; i = 0; n = len(css)
    while i < n:
        c = css[i]
        if c == '/' and css.startswith('/*', i):
            j = css.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '"\'':
            q = c; i += 1
            while i < n and css[i] != q:
                i += 2 if css[i] == '\\' else 1
            i += 1; continue
        if c == '{': depth += 1
        elif c == '}': depth -= 1
        if depth < 0: return False
        i += 1
    return depth == 0

# ------------------------------------------------------------------ tokenise top level
tok = re.compile(r'<!--.*?-->|<(script|style)\b([^>]*)>', re.S)
blocks = []; pos = 0
while True:
    m = tok.search(s, pos)
    if not m: break
    if m.group(0).startswith('<!--'):
        pos = m.end(); continue
    kind = m.group(1); close = s.find('</' + kind + '>', m.end())
    assert close > 0
    blocks.append(dict(kind=kind, attrs=m.group(2), start=m.start(), body_start=m.end(), body_end=close, end=close + len(kind) + 3))
    pos = close + len(kind) + 3

SHELL_POS = s.index('<div class="shell">')
# readable file names for scripts that carry no id (position in the deferred list -> name)
NAMES = {1: 'ui-images', 2: 'doctor-images', 3: 'completion-scene', 4: 'app-main', 5: 'question-bank-summary',
         6: 'drawer-menu', 7: 'returning-student-migration', 8: 'daily-facts-data', 9: 'app-features-v6',
         10: 'history-sync', 17: 'motion-v2', 27: 'selection-safety-net'}
GATE_STYLES = {'shb-v47-gate', 'sb-early-bg', 'shb-shell-gate'}      # first-paint rules: stay inline

if os.path.isdir(OUT):
    # safety: only ever wipe an empty folder or one that is clearly a previous www/ output
    if os.listdir(OUT) and not os.path.exists(os.path.join(OUT, 'BUILD_REPORT.json')):
        raise SystemExit('refusing to delete non-empty %s (not a previous split_html output)' % OUT)
    shutil.rmtree(OUT)
os.makedirs(os.path.join(OUT, 'css')); os.makedirs(os.path.join(OUT, 'js')); os.makedirs(os.path.join(OUT, 'data'))

# ------------------------------------------------------------------ walk the document
out = []; cursor = 0
core_css, late_css = [], []
core_link_done = late_link_done = False
js_files = []; report = dict(css_blocks=[], js_files=[], patches=[])
preloads = []

def label_before(idx):
    """HTML comment directly preceding a block (only whitespace in between)."""
    m = re.search(r'<!--(.*?)-->\s*$', s[max(0, idx - 400):idx], re.S)
    return (m, (re.sub(r'\s+', ' ', m.group(1)).strip(' ═=-')) if m else '')

for b in blocks:
    attrs = b['attrs']; idm = re.search(r'\bid="([^"]+)"', attrs); bid = idm.group(1) if idm else ''
    body = s[b['body_start']:b['body_end']]
    seg = s[cursor:b['start']]
    cm, label = label_before(b['start'])

    if b['kind'] == 'style' and bid not in GATE_STYLES:
        # drop the label comment that belonged to this style block (it moves into the CSS file)
        if cm and seg.rstrip().endswith('-->'):
            seg = seg[:len(seg.rstrip()) - len(cm.group(0))] if seg.rstrip().endswith(cm.group(0)) else seg
        out.append(extract(seg, ''))
        css = extract(body, '').strip('\n')
        assert css_balanced(css), 'unbalanced braces in style %s' % bid
        title = bid or label or 'style'
        (core_css if b['start'] < SHELL_POS else late_css).append('/* ===== %s ===== */\n%s\n' % (title, css))
        report['css_blocks'].append(dict(id=bid or label, bytes=len(css.encode()), group='core' if b['start'] < SHELL_POS else 'late'))
        if b['start'] < SHELL_POS and not core_link_done:
            out.append('<link rel="stylesheet" href="css/core.css">'); core_link_done = True
        elif b['start'] >= SHELL_POS and not late_link_done:
            out.append('<link rel="stylesheet" href="css/late.css">'); late_link_done = True
    elif b['kind'] == 'script' and 'text/shb-deferred' in attrs:
        if cm and seg.rstrip().endswith(cm.group(0)):
            seg = seg[:len(seg.rstrip()) - len(cm.group(0))]
        out.append(extract(seg, ''))
        n = len(js_files) + 1
        name = '%02d-%s.js' % (n, NAMES.get(n) or slug(bid or label))
        code = extract(body, '')
        with open(os.path.join(OUT, 'js', name), 'w', encoding='utf-8', newline='') as f:
            f.write(code)
        big = 1 if len(code) > 200000 else 0
        js_files.append(name)
        report['js_files'].append(dict(file=name, id=bid, bytes=len(code.encode()), orig_bytes=len(body.encode())))
        out.append('<!-- %s -->\n<script type="text/shb-deferred"%s data-src="js/%s"%s></script>' %
                   (label or bid or name, (' id="%s"' % bid) if bid else '', name, ' data-big="1"' if big else ''))
    elif b['kind'] == 'script' and 'application/json' in attrs:
        out.append(extract(seg, ''))
        with open(os.path.join(OUT, 'data', 'qbData.json'), 'w', encoding='utf-8', newline='') as f:
            f.write(body)
        report['qbData_bytes'] = len(body.encode())
        out.append('<script id="qbData" type="application/json" data-src="data/qbData.json"></script>')
    else:
        # inline first-paint style / script: kept verbatim (data URIs, if any, become files)
        out.append(extract(seg, ''))
        out.append(extract(s[b['start']:b['end']], ''))
    cursor = b['end']
out.append(extract(s[cursor:], ''))
html = ''.join(out)

# ------------------------------------------------------------------ write css bundles
with open(os.path.join(OUT, 'css', 'core.css'), 'w', encoding='utf-8', newline='') as f:
    f.write('/* SHBACE Medical - core styles (splash + first screen). Concatenation of the original <style> blocks, original order. */\n' + '\n'.join(core_css))
with open(os.path.join(OUT, 'css', 'late.css'), 'w', encoding='utf-8', newline='') as f:
    f.write('/* SHBACE Medical - feature & theme layers. Concatenation of the original <style> blocks, original cascade order. */\n' + '\n'.join(late_css))


NATIVE_SHIM = """<script id="shb-native-shim">
/* Android app only: window.ShbaceNative is injected by MainActivity. In a normal browser nothing below changes behaviour.
   WebView ignores <a download> for blob:/data: links, so hand the bytes to the native side (public Downloads folder). */
(function(){
 var proto=window.HTMLAnchorElement&&HTMLAnchorElement.prototype; if(!proto)return;
 var orig=proto.click;
 function b64(blob,cb){var r=new FileReader();r.onloadend=function(){var s=String(r.result||'');cb(s.slice(s.indexOf(',')+1))};r.readAsDataURL(blob)}
 proto.click=function(){
  var a=this,N=window.ShbaceNative,href=a.href||'';
  if(N&&N.saveFile&&a.hasAttribute('download')&&/^(blob|data):/.test(href)){
   var name=a.getAttribute('download')||'shbace-medical-file';
   fetch(href).then(function(r){return r.blob()}).then(function(blob){
    b64(blob,function(s){var ok=false;try{ok=N.saveFile(name,blob.type||'application/octet-stream',s)}catch(e){}if(!ok)orig.call(a)})
   }).catch(function(){orig.call(a)});
   return;
  }
  return orig.apply(this,arguments);
 };
})();
</script>
"""

# ------------------------------------------------------------------ patches (explicit + verified)
def patch_once(text, old, new, what):
    assert text.count(old) == 1, 'patch anchor not unique/found: ' + what
    report['patches'].append(what)
    return text.replace(old, new)

# P1  boot loader: execute external script files instead of inert inline text; fetch the JSON data in parallel with the splash.
html = patch_once(html,
 "   var o=list[i++],txt=o.text,big=txt.length>200000;\n   function exec(){\n    var n=document.createElement('script');\n    for(var k=0;k<o.attributes.length;k++){var a=o.attributes[k];if(a.name!=='type')n.setAttribute(a.name,a.value)}\n    n.text=txt;\n    try{o.parentNode.replaceChild(n,o)}catch(e){console.error(e)}      /* inserting it runs it, synchronously, exactly like a parser-inserted classic script */\n    txt=null;\n    setTimeout(next,0);\n   }",
 "   var o=list[i++],big=o.getAttribute('data-big')==='1';\n   function exec(){\n    var n=document.createElement('script');\n    for(var k=0;k<o.attributes.length;k++){var a=o.attributes[k];if(a.name!=='type'&&a.name!=='data-src'&&a.name!=='data-big')n.setAttribute(a.name,a.value)}\n    n.async=false;\n    /* external classic script: same global scope and same order as the former inline text; the next one starts only after this one has RUN (onload/onerror) */\n    n.onload=function(){setTimeout(next,0)};\n    n.onerror=function(){console.error('shb-boot: could not load '+o.getAttribute('data-src'));setTimeout(next,0)};\n    n.src=o.getAttribute('data-src');\n    try{o.parentNode.replaceChild(n,o)}catch(e){console.error(e);setTimeout(next,0)}\n   }",
 'boot: deferred scripts are loaded from js/*.js (async=false, sequential) instead of being held as 14 MB of inline text')
html = patch_once(html,
 " var hold=false,held={dcl:[],load:[]},domReady=false,painted=false,started=false,T=null;",
 " var hold=false,held={dcl:[],load:[]},domReady=false,painted=false,started=false,T=null;\n /* question bank (1.4 MB JSON): fetched in parallel with the splash; placed into <script id=\"qbData\" type=\"application/json\"> before the first app script runs, so the code that reads its textContent is unchanged */\n var dataURL='data/qbData.json',dataText=null,dataErr=null;\n var dataFetch=(window.fetch?fetch(dataURL).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}):Promise.reject(new Error('no fetch'))).then(function(t){dataText=t},function(e){dataErr=e});",
 'boot: start fetching data/qbData.json immediately')
html = patch_once(html,
 " function go(){if(started||!domReady||!painted)return;started=true;clearTimeout(T);run()}",
 " function go(){if(started||!domReady||!painted)return;started=true;clearTimeout(T);\n  dataFetch.then(function(){\n   var q=document.getElementById('qbData');\n   if(q&&dataText!=null)q.textContent=dataText;\n   else console.error('shb-boot: question bank missing',dataErr);\n   dataText=null;run()\n  })\n }",
 'boot: wait for the JSON, fill #qbData, then run the app scripts')

# P2  JOURNEY_AVATAR: was atob(dataURI) -> Blob URL; now a normal file URL (pre-decoded when the browser is idle).
for fn in js_files:
    p = os.path.join(OUT, 'js', fn); t = open(p, encoding='utf-8').read()
    pat = re.compile(r"const JOURNEY_AVATAR_DATA='(/assets/img/[0-9a-f]+\.png)';\nconst JOURNEY_AVATAR=\(function\(\)\{try\{const bin=atob\(JOURNEY_AVATAR_DATA\.split\(','\)\[1\]\),u=new Uint8Array\(bin\.length\);for\(let i=0;i<bin\.length;i\+\+\)u\[i\]=bin\.charCodeAt\(i\);const url=URL\.createObjectURL\(new Blob\(\[u\],\{type:'image/png'\}\)\);const im=new Image\(\);im\.src=url;if\(im\.decode\)im\.decode\(\)\.catch\(function\(\)\{\}\);return url\}catch\(e\)\{return JOURNEY_AVATAR_DATA\}\}\)\(\);")
    mm = pat.search(t)
    if mm:
        new = ("const JOURNEY_AVATAR_DATA='%s';\nconst JOURNEY_AVATAR=JOURNEY_AVATAR_DATA;"
               "try{(window.requestIdleCallback||function(f){return setTimeout(f,1500)})(function(){const im=new Image();im.src=JOURNEY_AVATAR;if(im.decode)im.decode().catch(function(){})})}catch(e){}") % mm.group(1)
        t = t[:mm.start()] + new + t[mm.end():]
        open(p, 'w', encoding='utf-8', newline='').write(t)
        report['patches'].append('JOURNEY_AVATAR: atob(data-URI)->Blob URL replaced by the plain image file (decoded once the browser is idle) in ' + fn)
        break
else:
    raise SystemExit('JOURNEY_AVATAR patch anchor not found')

# P3  doctor images: the code asked for assets/doctor/<n>.png first (never shipped) and fell back to the embedded copy.
for fn in js_files:
    p = os.path.join(OUT, 'js', fn); t = open(p, encoding='utf-8').read()
    old = "const docImg=n=>`src=\"assets/doctor/${n}.png\" onerror=\"this.onerror=null;this.src=DOC_EMB['${n}']\"`;"
    if old in t:
        t = t.replace(old, "const docImg=n=>`src=\"${DOC_EMB[n]}\"`;")
        open(p, 'w', encoding='utf-8', newline='').write(t)
        report['patches'].append('docImg: use the extracted doctor image directly (no 404 round-trip to assets/doctor/*.png) in ' + fn)
        break
else:
    raise SystemExit('docImg patch anchor not found')

# P4  "Export PDF": WebView has no window.print(); on Android hand the generated document to the native print dialog (Save as PDF).
for fn in js_files:
    p = os.path.join(OUT, 'js', fn); t = open(p, encoding='utf-8').read()
    old = "function printHTML(html){let w=null;try{w=window.open('','_blank')}catch(e){}"
    if old in t:
        t = t.replace(old, "function printHTML(html){if(window.ShbaceNative&&window.ShbaceNative.printHtml){try{if(window.ShbaceNative.printHtml(String(html)))return true}catch(e){}}let w=null;try{w=window.open('','_blank')}catch(e){}")
        open(p, 'w', encoding='utf-8', newline='').write(t)
        report['patches'].append('printHTML: use the native print dialog when running inside the Android app (WebView has no window.print) in ' + fn)
        break
else:
    raise SystemExit('printHTML patch anchor not found')

# ------------------------------------------------------------------ preload hints for the splash images (first paint)
splash_imgs = re.findall(r'<img[^>]*class="(?:splash-poster|sp-beat|splash-wide)[^"]*"[^>]*src="(/assets/img/[^"]+)"', html)
splash_imgs += re.findall(r'<img[^>]*src="(/assets/img/[^"]+)"[^>]*class="(?:splash-poster|sp-beat)', html)
splash_imgs += re.findall(r'--splash-bg:url\((/assets/img/[^)]+)\)', html)
seen = []
for u in splash_imgs:
    if u not in seen: seen.append(u)
pre = ''.join('<link rel="preload" as="image" href="%s" fetchpriority="high">\n' % u for u in seen)
pre += '<link rel="preload" as="style" href="css/core.css">\n<link rel="preload" as="style" href="css/late.css">\n'
pre += ''.join('<link rel="preload" as="script" href="js/%s">\n' % fn for fn in js_files[:6])
html = patch_once(html, '<meta name="theme-color" content="#07131f">', pre + NATIVE_SHIM + '<meta name="theme-color" content="#07131f">', 'preload hints for splash images / css / first scripts + native-bridge shim for file export (Android only)')
report['splash_preloads'] = seen

# ------------------------------------------------------------------ result
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8', newline='').write(html)

left = len(re.findall(r'data:[a-z]+/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{200,}', html))
report['images'] = dict(unique=len(images), total_refs=sum(img_refs.values()), bytes=sum(i['size'] for i in images.values()))
report['index_html_bytes'] = len(html.encode()); report['remaining_big_data_uris'] = left
report['original_bytes'] = len(s.encode())
json.dump(report, open(os.path.join(OUT, 'BUILD_REPORT.json'), 'w'), indent=1)
print(json.dumps({k: v for k, v in report.items() if k not in ('css_blocks', 'js_files')}, indent=1))
