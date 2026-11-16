/* Collections integration — links the six Pediatrics collections (Dr. Al-Joaki, Previous Questions, Nelson,
   Kasr Al-Ainy, Clinical Cases, Egyptian Book) to the rest of the app.
   Navigation / labels only: question records, IDs, answer keys and explanations are never modified. */
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
})();
