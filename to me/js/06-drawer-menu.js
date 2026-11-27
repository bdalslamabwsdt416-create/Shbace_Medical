
const DR=[['Learning',[['Subjects','subjects'],['Question Bank','questions'],['Quiz Mode','quiz'],['Global Search']]],['Review',[['Saved Questions'],['Wrong Answers'],['Smart Review','review'],['Reported Questions']]],['Analytics',[['Study Statistics','stats'],['Pinned & Recent Topics']]],['Account & help',[['Changelog'],['About'],['Contact & Feedback'],['Rate This Website'],['Settings']]]];

function drawerGroups(){
  var groups=DR.map(function(g){return [g[0],g[1].map(function(it){return [it[0],it[1],it[2]||''];})];});
  var cfg=window.__SHBACE_REMOTE_DRAWER_CONFIG__;
  if(!cfg||typeof cfg!=='object')return groups;
  var hidden=Array.isArray(cfg.hiddenItems)?cfg.hiddenItems.map(String):[];
  var renames=cfg.renames&&typeof cfg.renames==='object'?cfg.renames:{};
  var groupRenames=cfg.groupRenames&&typeof cfg.groupRenames==='object'?cfg.groupRenames:{};
  groups=groups.map(function(g){
    var title=String(groupRenames[g[0]]||g[0]);
    var items=g[1].filter(function(it){return hidden.indexOf(String(it[0]))<0&&hidden.indexOf(String(it[1]||''))<0;})
      .map(function(it){return [String(renames[it[0]]||renames[it[1]]||it[0]),it[1],it[2]||''];});
    return [title,items];
  }).filter(function(g){return g[1].length>0;});
  if(Array.isArray(cfg.groups))cfg.groups.forEach(function(g){
    if(g&&typeof g[0]==='string'&&Array.isArray(g[1])&&g[1].length)groups.push(g);
  });
  /* V3: reorder existing entries and relocate them between named drawer groups. */
  if(Array.isArray(cfg.itemOrder)){
    var ranks=Object.create(null);cfg.itemOrder.forEach(function(id,index){ranks[String(id)]=index;});
    groups.forEach(function(g){g[1].sort(function(a,b){
      var ai=Object.prototype.hasOwnProperty.call(ranks,String(a[1]||''))?ranks[String(a[1]||'')]:9999;
      var bi=Object.prototype.hasOwnProperty.call(ranks,String(b[1]||''))?ranks[String(b[1]||'')]:9999;
      return ai-bi;
    });});
  }
  if(cfg.itemGroups&&typeof cfg.itemGroups==='object'){
    Object.keys(cfg.itemGroups).forEach(function(route){
      var destination=String(cfg.itemGroups[route]||'').trim(),entry=null;
      if(!destination)return;
      groups.forEach(function(g){
        var at=g[1].findIndex(function(it){return String(it[1]||'')===route;});
        if(at>=0)entry=g[1].splice(at,1)[0];
      });
      if(entry){
        var target=groups.find(function(g){return g[0]===destination;});
        if(!target){target=[destination,[]];groups.push(target);}
        target[1].push(entry);
      }
    });
    groups=groups.filter(function(g){return g[1].length>0;});
  }
  if(Array.isArray(cfg.groupOrder)){
    var order=cfg.groupOrder.map(String);
    groups.sort(function(a,b){
      var ai=order.indexOf(a[0]),bi=order.indexOf(b[0]);
      if(ai<0)ai=9999;if(bi<0)bi=9999;
      return ai-bi;
    });
  }
  return groups;
}
function drawerText(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});
}
function drawerIcon(value){
  if(!value)return '';
  return '<span class="di-icon">'+String(value).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})+'</span>';
}

function drawerNavigate(route){
 const key=String(route||'');if(!key)return false;
 if(/^shbRemotePage_[A-Za-z0-9_-]{1,48}$/.test(key)&&typeof window.shbRemoteOpenPage==='function')return !!window.shbRemoteOpenPage(key.slice(14));
 const navigation=window.SHBACENavigation;
 if(navigation&&typeof navigation.validate==='function'&&navigation.validate(key).ok)return !!navigation.navigate(key).ok;
 try{appPage=key;renderAppDemo();return true}catch(e){console.warn('Drawer navigation failed:',e);return false}
}
document.addEventListener('click',function(event){
 const button=event.target&&event.target.closest?event.target.closest('[data-shb-drawer-route]'):null;
 if(!button)return;
 const route=button.getAttribute('data-shb-drawer-route')||'';
 if(route)drawerNavigate(route);
 event.preventDefault();
 toggleDrawer(false);
},true);

function drawerIsNativeAndroid(){
  try{
    var cap=window.Capacitor;
    if(cap&&typeof cap.getPlatform==='function'&&cap.getPlatform()==='android'&&
       typeof cap.isNativePlatform==='function'&&cap.isNativePlatform())return true;
  }catch(e){}
  /* MainActivity injects this bridge before page scripts. It is a stronger native-host
     signal and keeps the drawer working even if Capacitor's JS platform registry is late. */
  try{
    var nativeBridge=window.ShbaceNative;
    return !!(nativeBridge&&typeof nativeBridge.getAuscultationPackState==='function'&&
      typeof nativeBridge.startAuscultationPackDownload==='function');
  }catch(e){return false;}
}
function installDrawerAuscultationStyles(){
  if(document.getElementById('shb-auscultation-drawer-styles'))return;
  var style=document.createElement('style');style.id='shb-auscultation-drawer-styles';
  style.textContent=[
    '.phone .shb-ausc-menu{margin:9px 0 4px;padding:0 2px}',
    '.phone .shb-ausc-parent{box-sizing:border-box;width:100%;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid rgba(56,189,248,.28);border-radius:14px;background:linear-gradient(110deg,rgba(47,139,255,.16),rgba(56,189,248,.07));color:#e7f4ff;text-align:left;font-family:inherit;font-size:14px;font-weight:700;line-height:1.3;cursor:pointer}',
    '.phone .shb-ausc-parent-main{display:flex;align-items:center;gap:11px;min-width:0}',
    '.phone .shb-ausc-parent-icon{width:21px;height:21px;flex:none;color:#62c6ff}',
    '.phone .shb-ausc-total{margin-left:auto;padding:4px 8px;border:1px solid rgba(56,189,248,.24);border-radius:999px;background:rgba(56,189,248,.10);color:#8fd8ff;font-size:10px;font-weight:800;white-space:nowrap}',
    '.phone .shb-ausc-child-count{margin-left:auto;padding:3px 7px;border-radius:999px;background:rgba(56,189,248,.09);color:#8fd8ff;font-size:10px;font-weight:800;white-space:nowrap}',
    '.phone .shb-ausc-chevron{width:17px;height:17px;flex:none;color:#8fc6ff;transition:transform .18s ease}',
    '.phone .shb-ausc-parent[aria-expanded=true] .shb-ausc-chevron{transform:rotate(180deg)}',
    '.phone .shb-ausc-children{display:grid;gap:5px;padding:7px 0 2px 9px}',
    '.phone .shb-ausc-children[hidden]{display:none!important}',
    '.phone .shb-ausc-child{box-sizing:border-box;min-height:45px;display:flex;align-items:center;gap:7px;padding:5px 7px 5px 10px;border-inline-start:2px solid rgba(56,189,248,.28);border-radius:0 11px 11px 0;color:#b9cde4;background:rgba(18,43,70,.34);font-size:13.5px;font-weight:650}',
    '.phone .shb-ausc-child-open{flex:1;min-width:0;min-height:35px;display:flex;align-items:center;gap:10px;padding:4px 2px;border:0;background:transparent;color:inherit;text-align:left;font:inherit}',
    '.phone .shb-ausc-child-open svg{width:19px;height:19px;flex:none}',
    '.phone .shb-ausc-download{width:34px;height:34px;flex:none;display:grid;place-items:center;border:1px solid rgba(56,189,248,.2);border-radius:10px;background:rgba(44,139,210,.1);color:#8fd8ff}',
    '.phone .shb-ausc-download svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
    '.phone .shb-ausc-download:disabled{opacity:.65;cursor:default}',
    '.phone .shb-ausc-download.is-installed{color:#6ee7b7;border-color:rgba(110,231,183,.25)}',
    '.phone .shb-ausc-download.is-downloading{color:#8fd8ff}',
    '.phone .shb-ausc-download-spinner{width:15px;height:15px;border:2px solid rgba(143,216,255,.25);border-top-color:#8fd8ff;border-radius:50%;animation:shbAuscSpin .8s linear infinite}',
    '.phone .shb-ausc-child svg{width:19px;height:19px;flex:none}',
    '.phone .shb-ausc-child[data-system=heart] svg{color:#f28b9a}',
    '.phone .shb-ausc-child[data-system=lung] svg{color:#64c6ff}',
    '.phone.light .shb-ausc-parent{color:#173451;background:linear-gradient(110deg,rgba(47,139,255,.10),rgba(56,189,248,.05));border-color:rgba(47,139,255,.25)}',
    '.phone.light .shb-ausc-child{color:#395571;background:rgba(47,139,255,.045)}',
    '.phone.light .shb-ausc-total,.phone.light .shb-ausc-child-count{color:#17669b;background:rgba(47,139,255,.08);border-color:rgba(47,139,255,.18)}',
    '@keyframes shbAuscSpin{to{transform:rotate(360deg)}}'
  ].join('');
  document.head.appendChild(style);
}
function drawerAuscultationMarkup(){
  if(!drawerIsNativeAndroid())return '';
  return '<section class="shb-ausc-menu" data-shb-auscultation-menu="1">'+
    '<button type="button" class="shb-ausc-parent" data-shb-ausc-toggle aria-expanded="false" aria-controls="shbAuscultationSubmenu">'+
      '<span class="shb-ausc-parent-main"><svg class="shb-ausc-parent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V9"/><path d="M12 12c-1.8-4.8-6.8-6.1-8.4-2.3-1.6 3.8 1.3 8.1 5.3 8.1 1.8 0 3.1-1.1 3.1-2.9"/><path d="M12 12c1.8-4.8 6.8-6.1 8.4-2.3 1.6 3.8-1.3 8.1-5.3 8.1-1.8 0-3.1-1.1-3.1-2.9"/></svg><span>Auscultation Library</span></span>'+
      '<span class="shb-ausc-total">108 sounds</span><svg class="shb-ausc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'+
    '</button>'+
    '<div class="shb-ausc-children" id="shbAuscultationSubmenu" role="list" hidden>'+
      '<div class="shb-ausc-child" data-system="heart" role="listitem"><button type="button" class="shb-ausc-child-open" data-shb-ausc-open="heart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/><path d="M3.5 12h4l2-4 3.1 8 2.1-4h5.8"/></svg><span>Heart Auscultation</span><small class="shb-ausc-child-count">77</small></button><button type="button" class="shb-ausc-download" data-shb-ausc-download="heart" aria-label="Download Heart Auscultation" title="Download Heart Auscultation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/></svg></button></div>'+
      '<div class="shb-ausc-child" data-system="lung" role="listitem"><button type="button" class="shb-ausc-child-open" data-shb-ausc-open="lung"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v8"/><path d="M10 8c-1.8 0-3.1 1.4-4.2 4.2C4.5 15.6 3.5 18 3.5 20c0 1.2 1 1.7 2.2 1.7 3.7 0 6.3-2.7 6.3-6.4V9.8C12 8.6 11.2 8 10 8Z"/><path d="M14 8c1.8 0 3.1 1.4 4.2 4.2 1.3 3.4 2.3 5.8 2.3 7.8 0 1.2-1 1.7-2.2 1.7-3.7 0-6.3-2.7-6.3-6.4V9.8C12 8.6 12.8 8 14 8Z"/><path d="M12 11c-1.2 1.4-2.4 2.1-3.7 2.1M12 11c1.2 1.4 2.4 2.1 3.7 2.1"/></svg><span>Lung Auscultation</span><small class="shb-ausc-child-count">31</small></button><button type="button" class="shb-ausc-download" data-shb-ausc-download="lung" aria-label="Download Lung Auscultation" title="Download Lung Auscultation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/></svg></button></div>'+
    '</div></section>';
}
function ensureDrawerAuscultation(d){
  if(!d||!drawerIsNativeAndroid())return false;
  installDrawerAuscultationStyles();
  if(d.querySelector('[data-shb-auscultation-menu]'))return true;
  var markup=drawerAuscultationMarkup();
  if(!markup)return false;
  /* Recover a drawer that was created before the native bridge/platform check was ready. */
  var brand=d.querySelector('.brand-small');
  if(brand)brand.insertAdjacentHTML('afterend',markup);
  else d.insertAdjacentHTML('afterbegin',markup);
  return !!d.querySelector('[data-shb-auscultation-menu]');
}
document.addEventListener('click',function(event){
  const toggle=event.target&&event.target.closest?event.target.closest('[data-shb-ausc-toggle]'):null;
  if(!toggle)return;
  const section=toggle.closest('[data-shb-auscultation-menu]');
  const children=section&&section.querySelector('.shb-ausc-children');
  if(!children)return;
  const expanded=toggle.getAttribute('aria-expanded')==='true';
  toggle.setAttribute('aria-expanded',expanded?'false':'true');
  children.hidden=expanded;
  event.preventDefault();
},true);

function toggleDrawer(f){
 const ph=document.querySelector('.phone');
 if(!ph)return;
 let d=document.getElementById('drawer');
 if(!d){
  ph.insertAdjacentHTML('beforeend',`<div id="drawerBk" class="drawer-bk" onclick="toggleDrawer(false)"></div><aside id="drawer" class="drawer"><div class="brand-small" style="margin:0 6px 8px"><b style="font-size:17px">Shbace <span style="color:var(--mint)">Medical</span></b></div>${drawerAuscultationMarkup()}${drawerGroups().map(([g,a])=>`<div class="dl">${drawerText(g)}</div>${a.map(([n,p,ic])=>`<button class="di" ${p?'data-shb-drawer-route="'+drawerText(p)+'"':''} ${p?'':'onclick="toggleDrawer(false)"'}>${drawerIcon(ic)}${drawerText(n)}</button>`).join('')}`).join('')}</aside>`);
  d=document.getElementById('drawer');
 }
 /* Run on every open/close, not only initial creation: recover stale drawers too. */
 ensureDrawerAuscultation(d);
 if(!d)return;
 const o=f===undefined?!d.classList.contains('open'):f;
 d.classList.toggle('open',o);
 const backdrop=document.getElementById('drawerBk');
 if(backdrop)backdrop.classList.toggle('show',o);
}
function appHeader(label){const lt=!!(document.querySelector('.phone')&&document.querySelector('.phone').classList.contains('light'));return `<div class="phone-appbar hdr2">
<button class="menu-btn" aria-label="Open menu" onclick="toggleDrawer()">☰</button>
<div class="hdr-brand2"><img class="hdr-ic" src="${ICON_SRC}" alt="Shbace Medical"><div class="hdr-tx"><b>Shbace Medical</b><span><i class="hdr-ed">03</i><small>MEDICAL QBANK</small></span></div></div>
<div class="hdr-actions">
<button class="hdr-btn" aria-label="Toggle theme" onclick="toggleTheme()">${lt?`<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`:`<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`}</button>
<button class="hdr-btn" aria-label="Notifications" onclick="hdrTap('Notifications')"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg></button>
<button class="hdr-btn" aria-label="Settings" onclick="hdrTap('Settings')"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
</div></div>`}
function toggleTheme(){const ph=document.querySelector('.phone');if(!ph)return;const on=ph.classList.toggle('light');try{localStorage.setItem('shbace_theme',on?'light':'dark')}catch(e){}if(mode==='app')renderAppDemo()}
try{if(localStorage.getItem('shbace_theme')==='light'){const p=document.querySelector('.phone');p&&p.classList.add('light')}}catch(e){}
function hdrTap(n){const ph=document.querySelector('.phone');if(!ph)return;const o=ph.querySelector('.hdr-toast');if(o)o.remove();const t=document.createElement('div');t.className='hdr-toast';t.textContent=n+' · opens in the full app';ph.appendChild(t);setTimeout(()=>t.remove(),1900)}
