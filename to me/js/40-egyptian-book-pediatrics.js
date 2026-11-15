/* Egyptian Book Pediatrics — independent English-language collection; Accepted and answer-verified records only. */
(function(){
'use strict';
const B=window.__SHB_BRIDGE;if(!B){console.error('Egyptian Book: Pediatrics bridge is missing.');return;}
const QB=B.QB,qs=B.qs,SYS=B.SYS,incoming=Array.isArray(window.__SHB_EGYPTIAN_BOOK_QUESTIONS__)?window.__SHB_EGYPTIAN_BOOK_QUESTIONS__:[];
const known=new Set(QB.map(q=>q&&q.id).filter(Boolean));incoming.forEach(q=>{if(q&&q.eb===true&&q.id&&!known.has(q.id)){QB.push(q);known.add(q.id);}});
const validQuestion=q=>!!q&&q.eb===true&&q.aoClass==='Accepted'&&Array.isArray(q.o)&&q.o.length>=2&&Number.isInteger(q.k)&&q.k>=0&&q.k<q.o.length;
const bankQuestions=()=>QB.filter(validQuestion);if(window.__bank){window.__bank.total=QB.length;window.__bank.egyptianbook=bankQuestions().length;}
let ebActive='',ebSystem='',ebTopic='';
const escText=v=>typeof esc==='function'?esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const systemNames={'eb-cardio':'Cardiovascular System','eb-endocrine':'Endocrinology','eb-gastroenterology':'Gastroenterology','eb-genetics':'Genetics','eb-growth':'Growth & Development','eb-haematology':'Hematology','eb-immunology':'Immunology','eb-infection':'Infectious Diseases','eb-neonatology':'Neonatology','eb-nephrology':'Nephrology','eb-neurology':'Neurology','eb-nutrition':'Nutrition','eb-public-health':'Public Health','eb-respiratory':'Respiratory System','eb-rheumatology':'Rheumatology','eb-toxicology':'Toxicology'};
const iconFor={'eb-cardio':'cardio','eb-endocrine':'endocrinology','eb-gastroenterology':'git','eb-genetics':'genetics','eb-growth':'growth','eb-haematology':'haematology','eb-immunology':'rheum','eb-infection':'infectious','eb-neonatology':'neonatology','eb-nephrology':'nephrology','eb-neurology':'cns','eb-nutrition':'growth','eb-public-health':'infectious','eb-respiratory':'respiratory','eb-rheumatology':'rheum','eb-toxicology':'growth'};
const topicName=q=>String(q&&q.kind||'General Questions').trim()||'General Questions';
function systemsView(){
 const list=bankQuestions(),groups=new Map();list.forEach(q=>{if(!groups.has(q.spec))groups.set(q.spec,{id:q.spec,name:systemNames[q.spec]||'Other / Mixed Questions',count:0});groups.get(q.spec).count++;});
 const rows=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
 const cards=rows.map(row=>{const sys=SYS.find(s=>s[0]===iconFor[row.id]),icon=sys&&typeof B.sysIcon==='function'?B.sysIcon(sys[2],'lg'):'<div class="tno ti"><span>✚</span></div>';
 return '<div class="card sc spc ped-system-card" onclick="openEgyptianBookSystem(\''+row.id+'\')">'+icon+'<div class="spc-tx"><h3>'+escText(row.name)+'</h3><div class="meta"><b>'+row.count.toLocaleString()+'</b> questions</div></div><span class="chev">›</span></div>';}).join('');
 return appHeader('Egyptian Book')+'<div class="rs ped-systems-page eb-systems-page"><div class="ped-collection-kicker">SHBACE MEDICAL · PEDIATRICS</div><h1>Choose a medical system</h1><p class="sub">'+rows.length+' systems · '+list.length.toLocaleString()+' questions</p><div class="ped-systems-grid">'+(cards||'<div class="card setcard"><p class="meta">No accepted, answer-verified questions are available.</p></div>')+'</div></div>';
}
const oldSpecialtiesView=specialtiesView;specialtiesView=function(){
 if(ebActive==='egyptian')return systemsView();
 let html=oldSpecialtiesView.apply(this,arguments);
 if(!ebActive&&html.indexOf('ped-collection-footnote')>=0&&html.indexOf('ped-collection-egyptian')<0){
 const card='<button type="button" class="ped-collection-card ped-collection-egyptian" onclick="selectPediatricCollection(\'egyptian\')"><div class="ped-collection-avatar ped-avatar-allonce ped-avatar-icon ped-avatar-egbook" role="img" aria-label="Egyptian Book question bank">'+(window.__shbBankIcon?window.__shbBankIcon('egyptian'):'')+'</div><span class="ped-collection-copy"><span class="eyebrow">INDEPENDENT QUESTION BANK</span><b>Egyptian Book</b><small>Accepted questions, organized by medical system.</small><span class="ped-collection-count">'+bankQuestions().length.toLocaleString()+' questions</span></span><span class="ped-collection-arrow">›</span></button>';
 html=html.replace('</div><div class="ped-collection-footnote">',card+'</div><div class="ped-collection-footnote">');html=html.replace('The five collections remain separate.','The six collections remain separate.');
 }return html;
};
const oldSelect=window.selectPediatricCollection;window.selectPediatricCollection=function(which){
 if(which!=='egyptian'){ebActive='';ebSystem='';ebTopic='';document.body.classList.remove('eb-bank-mode');return oldSelect.apply(this,arguments);}
 ebActive='egyptian';ebSystem='';ebTopic='';const result=oldSelect('aj');window.__SHB_PED_COLLECTION__='egyptianbook';if(typeof window.__SHBACE_HISTORY_SNAPSHOT__==='function')window.__SHBACE_HISTORY_SNAPSHOT__();return result;
};
const oldChooser=window.openPediatricCollections;if(typeof oldChooser==='function')window.openPediatricCollections=function(){ebActive='';ebSystem='';ebTopic='';document.body.classList.remove('eb-bank-mode');return oldChooser.apply(this,arguments);};
window.openEgyptianBookHome=function(){ebActive='egyptian';ebSystem='';ebTopic='';document.body.classList.remove('eb-bank-mode');window.__SHB_PED_COLLECTION__='egyptianbook';appPage='specialties';renderAppDemo();};
window.openEgyptianBookSystem=function(spec){ebActive='egyptian';ebSystem=String(spec||'');ebTopic='';qs.spec=ebSystem;qs.topic=0;qs.filter='all';qs.tag='all';qs.idx=0;qs.lim=30;qs.view='all';window.__SHB_PED_COLLECTION__='egyptianbook';document.body.classList.add('eb-bank-mode');appPage='questions';renderAppDemo();};
window.openEgyptianBookTopic=function(index){
 if(!ebSystem)return;ebActive='egyptian';ebTopic='';qs.spec=ebSystem;qs.topic=0;qs.filter='all';qs.tag='all';qs.idx=0;qs.lim=30;qs.view='all';
 window.__SHB_PED_COLLECTION__='egyptianbook';document.body.classList.add('eb-bank-mode');appPage='questions';renderAppDemo();
};
const oldInTopic=B.inTopic;B.inTopic=function(){
 if(ebActive==='egyptian'){document.body.classList.add('eb-bank-mode');if(typeof gradeHasPediatrics==='function'&&!gradeHasPediatrics())return [];return bankQuestions().filter(q=>q.spec===ebSystem);}
 document.body.classList.remove('eb-bank-mode');return oldInTopic.apply(this,arguments).filter(q=>!q.eb);
};
const oldOpenQ=window.openQ;if(typeof oldOpenQ==='function')window.openQ=function(id){
 const q=QB.find(x=>x&&x.id===id);ebActive=q&&q.eb?'egyptian':'';
 if(q&&q.eb){ebSystem=q.spec;ebTopic='';qs.spec=q.spec;qs.topic=0;qs.filter='all';qs.tag='all';window.__SHB_PED_COLLECTION__='egyptianbook';document.body.classList.add('eb-bank-mode');}
 else{ebSystem='';ebTopic='';document.body.classList.remove('eb-bank-mode');}
 const result=oldOpenQ.apply(this,arguments);if(q&&q.eb)window.__SHB_PED_COLLECTION__='egyptianbook';return result;
};
window.__SHB_PED_COLLECTION__=window.__SHB_PED_COLLECTION__||'';
})();