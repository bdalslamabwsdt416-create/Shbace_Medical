/* Clinical Case Pediatrics — independent fifth collection. */
(function(){
'use strict';
const B=window.__SHB_BRIDGE;
if(!B){console.error('Clinical Case: Pediatrics bridge is missing.');return;}
const QB=B.QB,qs=B.qs,SYS=B.SYS;
const incoming=Array.isArray(window.__SHB_CLINICAL_CASE_QUESTIONS__)?window.__SHB_CLINICAL_CASE_QUESTIONS__:[];
const known=new Set(QB.map(q=>q&&q.id).filter(Boolean));
incoming.forEach(q=>{if(q&&q.cc===true&&q.id&&!known.has(q.id)){QB.push(q);known.add(q.id);}});
if(window.__bank){window.__bank.total=QB.length;window.__bank.clinicalcase=incoming.length;}
let ccActive='',ccSystem='';
const clinicalCaseQuestions=()=>QB.filter(q=>q&&q.cc===true);
const escText=v=>typeof esc==='function'?esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const iconFor={
 'Cardiovascular System':'cardio','Respiratory':'respiratory','Gastroenterology':'git',
 'Nephrology':'nephrology','Endocrinology':'endocrinology','Neurology':'cns',
 'Neonatology':'neonatology','Infectious Diseases':'infectious','Hematology':'haematology',
 'Growth & Development':'growth','Genetics':'genetics','Rheumatology':'rheum',
 'Emergency & Fluid Balance':'growth'
};
function clinicalCaseView(){
 const list=clinicalCaseQuestions(),groups=new Map();
 list.forEach(q=>{if(!groups.has(q.spec))groups.set(q.spec,{id:q.spec,name:q.ccSystem||'General Pediatrics',count:0});groups.get(q.spec).count++;});
 const rows=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
 const cards=rows.map(row=>{
  const sys=SYS.find(s=>s[0]===iconFor[row.name]);
  const icon=sys&&typeof B.sysIcon==='function'?B.sysIcon(sys[2],'lg'):'<div class="tno ti"><span>✚</span></div>';
  return '<div class="card sc spc ped-system-card" onclick="openClinicalCaseSystem(\''+row.id+'\')">'+icon+'<div class="spc-tx"><h3>'+escText(row.name)+'</h3><div class="meta"><b>'+row.count.toLocaleString()+'</b> questions</div></div><span class="chev">›</span></div>';
 }).join('');
 return appHeader('Clinical Cases')+'<div class="rs ped-systems-page"><div class="ped-collection-kicker">CLINICAL CASE · PEDIATRICS</div><h1>Choose a medical system</h1><p class="sub">'+rows.length+' systems · '+list.length.toLocaleString()+' questions</p><div class="ped-systems-grid">'+(cards||'<div class="card setcard"><p class="meta">No Clinical Case questions are available.</p></div>')+'</div></div>';
}
const oldSpecialtiesView=specialtiesView;
specialtiesView=function(){
 if(ccActive==='clinicalcase')return clinicalCaseView();
 let html=oldSpecialtiesView.apply(this,arguments);
 if(!ccActive&&html.indexOf('ped-collection-footnote')>=0&&html.indexOf('ped-collection-clinicalcase')<0){
  const card='<button type="button" class="ped-collection-card ped-collection-allonce ped-collection-clinicalcase" onclick="selectPediatricCollection(\'clinicalcase\')"><div class="ped-collection-avatar ped-avatar-allonce ped-avatar-icon ped-avatar-clinical" role="img" aria-label="Clinical Cases question bank">'+(window.__shbBankIcon?window.__shbBankIcon('clinical'):'')+'</div><span class="ped-collection-copy"><span class="eyebrow">ACCEPTED CLINICAL CASE BANK</span><b>Clinical Cases</b><small>Clinical case questions, organized by medical system and topic.</small><span class="ped-collection-count">'+clinicalCaseQuestions().length.toLocaleString()+' questions</span></span><span class="ped-collection-arrow">›</span></button>';
  html=html.replace('</div><div class="ped-collection-footnote">',card+'</div><div class="ped-collection-footnote">');
  html=html.replace('The four collections remain separate.','The five collections remain separate.');
 }
 return html;
};
const oldSelect=window.selectPediatricCollection;
window.selectPediatricCollection=function(which){
 if(which!=='clinicalcase'){ccActive='';ccSystem='';;return oldSelect.apply(this,arguments);}
 ccActive='clinicalcase';ccSystem='';;
 const result=oldSelect('aj');
 window.__SHB_PED_COLLECTION__='clinicalcase';
 if(typeof window.__SHBACE_HISTORY_SNAPSHOT__==='function')window.__SHBACE_HISTORY_SNAPSHOT__();
 return result;
};
const oldOpenChooser=window.openPediatricCollections;
if(typeof oldOpenChooser==='function')window.openPediatricCollections=function(){
 ccActive='';ccSystem='';;
 return oldOpenChooser.apply(this,arguments);
};
window.openClinicalCaseHome=function(){
 ccActive='clinicalcase';ccSystem='';;
 window.__SHB_PED_COLLECTION__='clinicalcase';
 appPage='specialties';renderAppDemo();
};
window.openClinicalCaseSystem=function(spec){
 ccActive='clinicalcase';ccSystem=String(spec||'');
 qs.spec=ccSystem;qs.topic=0;qs.filter='all';qs.tag='all';qs.idx=0;qs.lim=30;qs.view='all';
 window.__SHB_PED_COLLECTION__='clinicalcase';
 appPage='questions';renderAppDemo();
};
const oldInTopic=B.inTopic;
B.inTopic=function(){
 if(ccActive==='clinicalcase'){
  let list=clinicalCaseQuestions();
  if(ccSystem)list=list.filter(q=>q.spec===ccSystem);
  return list;
 }
 return oldInTopic.apply(this,arguments).filter(q=>!q.cc);
};
const oldOpenQ=window.openQ;
if(typeof oldOpenQ==='function')window.openQ=function(id){
 const q=QB.find(x=>x&&x.id===id);
 if(q&&q.cc){ccActive='clinicalcase';ccSystem=q.spec;qs.spec=q.spec;qs.topic=0;qs.filter='all';qs.tag='all';}
 else{ccActive='';ccSystem='';;}
 const result=oldOpenQ.apply(this,arguments);
 if(q&&q.cc)window.__SHB_PED_COLLECTION__='clinicalcase';
 return result;
};
window.__SHB_PED_COLLECTION__=window.__SHB_PED_COLLECTION__||'';
})();
