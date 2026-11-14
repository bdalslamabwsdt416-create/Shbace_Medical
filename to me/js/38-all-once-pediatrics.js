/* All Once Pediatrics — fourth independent question collection. */
(function(){
'use strict';
const B=window.__SHB_BRIDGE;
if(!B){console.error('All Once: Pediatrics bridge is missing.');return;}
const QB=B.QB,qs=B.qs,SYS=B.SYS;
const incoming=Array.isArray(window.__SHB_ALLONCE_QUESTIONS__)?window.__SHB_ALLONCE_QUESTIONS__:[];
const known=new Set(QB.map(q=>q&&q.id).filter(Boolean));
incoming.forEach(q=>{if(q&&q.ao===true&&q.id&&!known.has(q.id)){QB.push(q);known.add(q.id);}});
if(window.__bank){window.__bank.total=QB.length;window.__bank.allonce=incoming.length;}
let aoActive='';
const allOnceQuestions=()=>QB.filter(q=>q&&q.ao===true);
const escText=v=>typeof esc==='function'?esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const iconFor={
 'Allergy':'genetics','Endocrine':'endocrinology','Emergency':'growth',
 'Growth & Development':'growth','Haematology':'haematology','Nephrology':'nephrology',
 'Infections & Vaccination':'infectious','Nutrition':'growth','Respiration':'respiratory',
 'Rheumatology':'rheum','Neurology':'cns','Genetics':'genetics','Neonatology':'neonatology',
 'Hepatology':'git','Final Exam May 2018':'growth','Cardiology':'cardio','GIT':'git'
};
function allOnceSystemsView(){
 const list=allOnceQuestions();
 const groups=new Map();
 list.forEach(q=>{if(!groups.has(q.spec))groups.set(q.spec,{id:q.spec,name:q.aoSystem,count:0});groups.get(q.spec).count++;});
 const rows=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
 const cards=rows.map(row=>{
  const sys=SYS.find(s=>s[0]===iconFor[row.name]);
  const icon=sys&&typeof B.sysIcon==='function'?B.sysIcon(sys[2],'lg'):'<div class="tno ti"><span>✚</span></div>';
  return '<div class="card sc spc ped-system-card" onclick="openAllOnceSystem(\''+row.id+'\')">'+icon+
   '<div class="spc-tx"><h3>'+escText(row.name)+'</h3><div class="meta"><b>'+row.count.toLocaleString()+'</b> questions</div></div><span class="chev">›</span></div>';
 }).join('');
 return appHeader('All Once')+'<div class="rs ped-systems-page"><div class="ped-collection-kicker">ALL ONCE · PEDIATRICS</div><h1>Choose a medical system</h1><p class="sub">'+rows.length+' systems · '+list.length.toLocaleString()+' questions</p><div class="ped-systems-grid">'+(cards||'<div class="card setcard"><p class="meta">No All Once questions are available.</p></div>')+'</div></div>';
}
const oldSpecialtiesView=specialtiesView;
specialtiesView=function(){
 if(aoActive==='allonce')return allOnceSystemsView();
 let html=oldSpecialtiesView.apply(this,arguments);
 if(!aoActive&&html.indexOf('ped-collection-footnote')>=0){
  const card='<button type="button" class="ped-collection-card ped-collection-allonce" onclick="selectPediatricCollection(\'allonce\')"><div class="ped-collection-avatar ped-avatar-allonce"><img src="/assets/img/all-once-pediatrics-cover.svg" alt="All Once Pediatrics question bank" decoding="async"></div><span class="ped-collection-copy"><span class="eyebrow">CURATED QUESTION BANK</span><b>All Once</b><small>Accepted and Needs Review questions, arranged by medical system.</small><span class="ped-collection-count">'+allOnceQuestions().length.toLocaleString()+' questions</span></span><span class="ped-collection-arrow">›</span></button>';
  html=html.replace('</div><div class="ped-collection-footnote">',card+'</div><div class="ped-collection-footnote">');
  html=html.replace('The three collections remain separate.','The four collections remain separate.');
 }
 return html;
};
const oldSelect=window.selectPediatricCollection;
window.selectPediatricCollection=function(which){
 if(which!=='allonce'){aoActive='';return oldSelect.apply(this,arguments);}
 aoActive='allonce';
 const result=oldSelect('aj');
 window.__SHB_PED_COLLECTION__='allonce';
 return result;
};
const oldOpenChooser=window.openPediatricCollections;
if(typeof oldOpenChooser==='function')window.openPediatricCollections=function(){
 aoActive='';
 return oldOpenChooser.apply(this,arguments);
};
window.openAllOnceSystem=function(spec){
 aoActive='allonce';window.__SHB_PED_COLLECTION__='allonce';
 qs.spec=String(spec||'all');qs.topic=0;qs.filter='all';qs.tag='all';qs.idx=0;qs.lim=30;qs.view='all';
 appPage='questions';renderAppDemo();
};
const oldInTopic=B.inTopic;
B.inTopic=function(){
 if(aoActive==='allonce'){
  if(typeof gradeHasPediatrics==='function'&&!gradeHasPediatrics())return [];
  let list=allOnceQuestions();
  if(qs.spec&&qs.spec!=='all')list=list.filter(q=>q.spec===qs.spec);
  if(qs.topic)list=list.filter(q=>q.topic===qs.topic);
  return list;
 }
 return oldInTopic.apply(this,arguments).filter(q=>!q.ao);
};
const oldOpenQ=window.openQ;
if(typeof oldOpenQ==='function')window.openQ=function(id){
 const q=QB.find(x=>x&&x.id===id);
 aoActive=q&&q.ao?'allonce':'';
 const result=oldOpenQ.apply(this,arguments);
 if(q&&q.ao)window.__SHB_PED_COLLECTION__='allonce';
 return result;
};
window.__SHB_PED_COLLECTION__=window.__SHB_PED_COLLECTION__||'';
})();
