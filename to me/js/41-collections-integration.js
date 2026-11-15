/* Collections integration — links the six Pediatrics collections (Dr. Al-Joaki, Previous Questions, Nelson,
   Kasr Al-Ainy, Clinical Cases, Egyptian Book) to the rest of the app.
   Navigation / labels / layout only: question records, IDs, answer keys and explanations are never modified. */
(function(){
'use strict';
const B=window.__SHB_BRIDGE;
if(!B){console.error('Collections integration: bridge from 09-app-features-v6.js is missing.');return}
const QB=B.QB;

/* 1. Readable system names for collection-only system ids, so Search, Quiz, Statistics, Saved and Reset
      never show raw ids such as "eb-cardio" or "ao-allergy". */
const EB_NAMES={'eb-cardio':'Cardiovascular System','eb-endocrine':'Endocrinology','eb-gastroenterology':'Gastroenterology','eb-genetics':'Genetics','eb-growth':'Growth & Development','eb-haematology':'Hematology','eb-immunology':'Immunology','eb-infection':'Infectious Diseases','eb-neonatology':'Neonatology','eb-nephrology':'Nephrology','eb-neurology':'Neurology','eb-nutrition':'Nutrition','eb-public-health':'Public Health','eb-respiratory':'Respiratory System','eb-rheumatology':'Rheumatology','eb-toxicology':'Toxicology'};
try{
 const names=B.SPEC_NAME;
 if(names&&typeof names==='object')QB.forEach(q=>{
  if(!q||!q.spec||names[q.spec])return;
  if(q.eb===true&&EB_NAMES[q.spec])names[q.spec]=EB_NAMES[q.spec];
  else if(q.ao===true&&q.aoSystem&&!/[؀-ۿ]/.test(q.aoSystem))names[q.spec]=q.aoSystem;
 });
}catch(e){console.error(e)}

/* 2. Back: a medical-system list returns to the list of banks (not straight to Subjects). */
const prevBack=window.navBack;
function overlayOpen(){
 const d=document.getElementById('drawer');
 return !!((d&&d.classList.contains('open'))||document.getElementById('cfwrap')||document.querySelector('.npx-ask')||document.querySelector('.qd-sheet.on'));
}
window.navBack=function(){
 try{
  if(!overlayOpen()&&appPage==='specialties'&&String(window.__SHB_PED_COLLECTION__||'')!==''&&typeof window.openPediatricCollections==='function'){
   window.__SHB_PED_COLLECTION__='';
   window.openPediatricCollections();
   return;
  }
 }catch(e){console.error(e)}
 return typeof prevBack==='function'?prevBack.apply(this,arguments):undefined;
};
/* Phone / browser Back: the history entry of the bank list has no collection, so reset the collection scripts' own state too. */
addEventListener('popstate',function(e){
 try{
  const st=e&&e.state;
  if(st&&st.p==='specialties'&&!st.c&&typeof window.openPediatricCollections==='function'){
   window.__SHB_PED_COLLECTION__='';
   window.openPediatricCollections();
  }
 }catch(err){console.error(err)}
});

/* 3. Search screen — less clutter. The search box and the bank chips stay on top; the specialty chips, tag chips,
      Source / Topic / System lists and the topic sort are folded into ONE "Filters" panel. Nothing is removed:
      every control keeps its own handler (gSet / runSearch / gClear) and the panel opens by itself whenever a
      filter inside it is active, so a hidden filter can never silently shrink the results. View-only. */
try{
 if(typeof searchView==='function'){
  const _oldSearchView=searchView;
  if(!document.getElementById('shb-search-simplify-css')){
   const st=document.createElement('style');st.id='shb-search-simplify-css';
   st.textContent='.gmore{margin:8px 0 10px;border:1px solid rgba(130,170,220,.28);border-radius:14px;background:rgba(130,170,220,.06)}'+
    '.gmore>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:11px 14px;font-weight:700}'+
    '.gmore>summary::-webkit-details-marker{display:none}'+
    '.gmore>summary::after{content:"\\25BE";margin-inline-start:auto;opacity:.7;transition:transform .2s}'+
    '.gmore[open]>summary::after{transform:rotate(180deg)}'+
    '.gmore-n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#2f9bff;color:#fff;font-size:12px;display:inline-flex;align-items:center;justify-content:center}'+
    '.gmore>:not(summary){margin-left:12px;margin-right:12px}.gmore>:last-child{margin-bottom:12px}';
   document.head.appendChild(st);
  }
  searchView=function(){
   const html=_oldSearchView.apply(this,arguments);
   try{
    const root=document.createElement('div');root.innerHTML=html;
    const rs=root.querySelector('.rs');
    const spec=rs&&rs.querySelector('.chips[aria-label="Specialty filter"]');
    const tag=rs&&rs.querySelector('.chips[aria-label="Tag filter"]');
    const sel=rs&&rs.querySelector('.gfil');
    const clr=rs&&rs.querySelector('#gClr');
    if(!rs||!spec||!tag||!sel||!clr||!clr.parentNode)return html;
    const sort=rs.querySelector('.seg.wide');
    let active=0;
    [spec,tag].forEach(row=>{
     const on=row.querySelector('.chip.on');
     if(on&&!/,'all'\)/.test(on.getAttribute('onclick')||''))active++;
    });
    sel.querySelectorAll('select').forEach(s=>{if(s.value&&s.value!=='all')active++});
    const det=document.createElement('details');
    det.className='gmore';
    if(active||window.__shbGMoreOpen)det.open=true;
    det.setAttribute('ontoggle','window.__shbGMoreOpen=this.open');
    const sum=document.createElement('summary');
    sum.innerHTML='<span>Filters</span>'+(active?'<b class="gmore-n">'+active+'</b>':'');
    det.appendChild(sum);
    det.appendChild(spec);det.appendChild(tag);det.appendChild(sel);
    if(sort)det.appendChild(sort);
    clr.parentNode.insertBefore(det,clr);
    return root.innerHTML;
   }catch(err){console.error(err);return html}
  };
 }
}catch(e){console.error(e)}
})();
