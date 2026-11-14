/* Egyptian book Pediatrics — independent Arabic collection, All Once interaction model. */
(function(){
'use strict';
const B=window.__SHB_BRIDGE;
if(!B){console.error('Egyptian book: Pediatrics bridge is missing.');return;}
const QB=B.QB,qs=B.qs,SYS=B.SYS;
const incoming=Array.isArray(window.__SHB_EGYPTIAN_BOOK_QUESTIONS__)?window.__SHB_EGYPTIAN_BOOK_QUESTIONS__:[];
const known=new Set(QB.map(q=>q&&q.id).filter(Boolean));
incoming.forEach(q=>{if(q&&q.eb===true&&q.ao===true&&q.id&&!known.has(q.id)){QB.push(q);known.add(q.id);}});
if(window.__bank){window.__bank.total=QB.length;window.__bank.egyptianbook=incoming.length;}
let ebActive='';
const bankQuestions=()=>QB.filter(q=>q&&q.eb===true);
const escText=v=>typeof esc==='function'?esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const iconFor={'eb-cardio':'cardio','eb-endocrine':'endocrinology','eb-gastroenterology':'git','eb-genetics':'genetics','eb-growth':'growth','eb-haematology':'haematology','eb-immunology':'rheum','eb-infection':'infectious','eb-neonatology':'neonatology','eb-nephrology':'nephrology','eb-neurology':'cns','eb-nutrition':'growth','eb-public-health':'infectious','eb-respiratory':'respiratory','eb-rheumatology':'rheum','eb-toxicology':'growth'};
function systemsView(){
 const list=bankQuestions(),groups=new Map();
 list.forEach(q=>{if(!groups.has(q.spec))groups.set(q.spec,{id:q.spec,name:q.aoSystem||'موضوعات متنوعة',count:0});groups.get(q.spec).count++;});
 const rows=Array.from(groups.values()).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
 const cards=rows.map(row=>{
  const sys=SYS.find(s=>s[0]===iconFor[row.id]);
  const icon=sys&&typeof B.sysIcon==='function'?B.sysIcon(sys[2],'lg'):'<div class="tno ti"><span>📘</span></div>';
  return '<div class="card sc spc ped-system-card" dir="rtl" onclick="openEgyptianBookSystem(\''+row.id+'\')">'+icon+
   '<div class="spc-tx"><h3>'+escText(row.name)+'</h3><div class="meta"><b>'+row.count.toLocaleString('ar')+'</b> سؤال</div></div><span class="chev">‹</span></div>';
 }).join('');
 return appHeader('Egyptian book')+'<div class="rs ped-systems-page eb-systems-page" dir="rtl"><div class="ped-collection-kicker">SHBACE MEDICAL · PEDIATRICS</div><h1>اختر النظام الطبي</h1><p class="sub">'+rows.length.toLocaleString('ar')+' أنظمة · '+list.length.toLocaleString('ar')+' سؤال</p><div class="ped-systems-grid">'+(cards||'<div class="card setcard"><p class="meta">لا توجد أسئلة متاحة حالياً.</p></div>')+'</div></div>';
}
const oldSpecialtiesView=specialtiesView;
specialtiesView=function(){
 if(ebActive==='egyptian')return systemsView();
 let html=oldSpecialtiesView.apply(this,arguments);
 if(!ebActive&&html.indexOf('ped-collection-footnote')>=0&&html.indexOf('ped-collection-egyptian')<0){
  const card='<button type="button" class="ped-collection-card ped-collection-egyptian" dir="rtl" onclick="selectPediatricCollection(\'egyptian\')"><div class="ped-collection-avatar ped-avatar-allonce"><span aria-hidden="true">📘</span></div><span class="ped-collection-copy"><span class="eyebrow">PEDIATRICS QUESTION BANK</span><b>Egyptian book</b><small>بنك أسئلة الأطفال، مرتب حسب الأنظمة الطبية مع الشرح والمراجع</small><span class="ped-collection-count">'+bankQuestions().length.toLocaleString('ar')+' سؤال</span></span><span class="ped-collection-arrow">‹</span></button>';
  html=html.replace('</div><div class="ped-collection-footnote">',card+'</div><div class="ped-collection-footnote">');
  html=html.replace('The five collections remain separate.','The six collections remain separate.');
 }
 return html;
};
const oldSelect=window.selectPediatricCollection;
window.selectPediatricCollection=function(which){
 if(which!=='egyptian'){ebActive='';document.body.classList.remove('eb-bank-mode');return oldSelect.apply(this,arguments);}
 ebActive='egyptian';
 const result=oldSelect('aj');
 window.__SHB_PED_COLLECTION__='egyptianbook';
 return result;
};
const oldChooser=window.openPediatricCollections;
if(typeof oldChooser==='function')window.openPediatricCollections=function(){
 ebActive='';document.body.classList.remove('eb-bank-mode');return oldChooser.apply(this,arguments);
};
window.openEgyptianBookHome=function(){
 ebActive='egyptian';document.body.classList.remove('eb-bank-mode');window.__SHB_PED_COLLECTION__='egyptianbook';
 appPage='specialties';renderAppDemo();
};
window.openEgyptianBookSystem=function(spec){
 ebActive='egyptian';window.__SHB_PED_COLLECTION__='egyptianbook';
 qs.spec=String(spec||'');qs.topic=0;qs.filter='all';qs.tag='all';qs.idx=0;qs.lim=30;qs.view='all';
 appPage='questions';renderAppDemo();
};
const oldInTopic=B.inTopic;
B.inTopic=function(){
 if(ebActive==='egyptian'){
  document.body.classList.add('eb-bank-mode');
  if(typeof gradeHasPediatrics==='function'&&!gradeHasPediatrics())return [];
  return bankQuestions().filter(q=>!qs.spec||qs.spec==='all'||q.spec===qs.spec);
 }
 document.body.classList.remove('eb-bank-mode');
 return oldInTopic.apply(this,arguments).filter(q=>!q.eb);
};
const oldOpenQ=window.openQ;
if(typeof oldOpenQ==='function')window.openQ=function(id){
 const q=QB.find(x=>x&&x.id===id);
 ebActive=q&&q.eb?'egyptian':'';
 if(q&&q.eb){qs.spec=q.spec;qs.topic=0;qs.filter='all';qs.tag='all';window.__SHB_PED_COLLECTION__='egyptianbook';document.body.classList.add('eb-bank-mode');}
 else document.body.classList.remove('eb-bank-mode');
 const result=oldOpenQ.apply(this,arguments);
 if(q&&q.eb)window.__SHB_PED_COLLECTION__='egyptianbook';
 return result;
};
window.__SHB_PED_COLLECTION__=window.__SHB_PED_COLLECTION__||'';
})();