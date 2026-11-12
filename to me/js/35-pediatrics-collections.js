/* Pediatrics source split — isolated to the unified "to me" PWA.
   Question records, IDs, answer keys and explanations are never rewritten. */
(function(){
'use strict';
let activeCollection='aj';
let activePreviousSystem='';
const previousSystemByTopic=new Map();
const norm=v=>String(v==null?'':v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const isPreviousQuestion=q=>!!q&&q.py===true;
const isDoctorQuestion=q=>!!q&&!isPreviousQuestion(q);
const allQuestions=()=>Array.isArray(QB)?QB:[];
const doctorQuestions=()=>allQuestions().filter(isDoctorQuestion);
const previousQuestions=()=>allQuestions().filter(isPreviousQuestion);
function refreshPreviousTopicMap(){
 previousSystemByTopic.clear();
 try{(REAL&&REAL.spec&&REAL.spec.exams&&REAL.spec.exams.topics||[]).forEach(t=>{if(Array.isArray(t)&&t.length>=4)previousSystemByTopic.set(t[0],String(t[3]||'Other / Mixed Questions'))})}catch(e){}
}
refreshPreviousTopicMap();
function mappedSystem(name){
 const target=norm(name);if(!target)return null;
 let row=SYS.find(s=>norm(s[1])===target);if(row)return row;
 const aliases=[[/respiratory|lung/,'respiratory'],[/cardio|heart|circulatory/,'cardio'],[/gastro|digestive|git/,'git'],[/nephro|renal|kidney/,'nephrology'],[/endocrine|hormone/,'endocrinology'],[/central nervous|neurology|cns/,'cns'],[/neonat/,'neonatology'],[/infectious|vaccine/,'infectious'],[/haem|hemat|blood/,'haematology'],[/growth|nutrition/,'growth'],[/genetic|dermat/,'genetics'],[/rheum|metabolic|poison|immun/,'rheum'],[/uro/,'urology']];
 for(const pair of aliases){if(pair[0].test(target)){row=SYS.find(s=>s[0]===pair[1]);if(row)return row}}
 if(/general paediatrics|child protection/.test(target))return SYS.find(s=>s[0]==='growth')||null;
 return null;
}
function topicListForPreviousSystem(){
 const topics=REAL&&REAL.spec&&REAL.spec.exams&&REAL.spec.exams.topics||[];
 return topics.filter(t=>!activePreviousSystem||String(t[3]||'Other / Mixed Questions')===activePreviousSystem);
}
function questionsForPreviousSystem(){return previousQuestions().filter(q=>!activePreviousSystem||previousSystemByTopic.get(q.topic)===activePreviousSystem)}
function escHtml(v){return typeof esc==='function'?esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function imageCircle(data,kind,initials,alt){
 const cls='ped-collection-avatar '+kind;
 if(!data)return `<div class="${cls} is-fallback"><span class="ped-avatar-initials">${initials}</span></div>`;
 return `<div class="${cls}"><img src="${data}" alt="${alt}" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add('is-fallback')"><span class="ped-avatar-initials" hidden>${initials}</span></div>`;
}
function collectionView(){
 const doctorCount=doctorQuestions().length,previousCount=previousQuestions().length;
 const ajData=window.__SHBACE_AJ_PORTRAIT_DATA__||'',facultyData=window.__SHBACE_FACULTY_LOGO_DATA__||'';
 return `${appHeader('Pediatrics')}<div class="rs ped-collection-page">
  <div class="ped-collection-kicker">SHBACE MEDICAL · PEDIATRICS</div>
  <h1>Choose your question collection</h1>
  <p class="sub">Select the source you want to study. Each collection has its own systems and topics.</p>
  <div class="ped-collections-grid">
   <button type="button" class="ped-collection-card ped-collection-aj" onclick="selectPediatricCollection('aj')">
    ${imageCircle(ajData,'ped-avatar-doctor','AJ','Dr. Abdulrahman Al-Joaki')}
    <span class="ped-collection-copy"><span class="eyebrow">DOCTOR'S QUESTION BANK</span><b>Dr. Abdulrahman Al-Joaki MCQ</b><small>Study the doctor's MCQs, arranged by medical system and topic.</small><span class="ped-collection-count">${doctorCount.toLocaleString()} questions</span></span>
    <span class="ped-collection-arrow" aria-hidden="true">›</span>
   </button>
   <button type="button" class="ped-collection-card ped-collection-previous" onclick="selectPediatricCollection('previous')">
    ${imageCircle(facultyData,'ped-avatar-faculty','FM','Faculty of Medicine, University of Tripoli')}
    <span class="ped-collection-copy"><span class="eyebrow">FACULTY QUESTION ARCHIVE</span><b>Previous Questions</b><small>Browse previous exam questions by the same medical systems and topic icons.</small><span class="ped-collection-count">${previousCount.toLocaleString()} questions</span></span>
    <span class="ped-collection-arrow" aria-hidden="true">›</span>
   </button>
  </div>
  <div class="ped-collection-footnote">The two banks remain separate. Question records and source labels are preserved.</div>
 </div>`;
}
window.openPediatricCollections=function(ev){if(ev&&ev.stopPropagation)ev.stopPropagation();activeCollection='aj';activePreviousSystem='';appPage='pedcollections';renderAppDemo()};
window.selectPediatricCollection=function(which){
 activeCollection=which==='previous'?'previous':'aj';activePreviousSystem='';window.__SHB_PED_COLLECTION__=activeCollection;
 qs.spec=activeCollection==='previous'?'exams':'endocrinology';qs.topic=0;qs.filter='all';qs.tag='all';qs.idx=0;
 appPage='specialties';renderAppDemo();
};
window.openPreviousSystem=function(name){
 activeCollection='previous';activePreviousSystem=String(name||'Other / Mixed Questions');window.__SHB_PED_COLLECTION__='previous';
 qs.spec='exams';qs.topic=0;qs.filter='all';qs.tag='all';qs.idx=0;qs.view='single';appPage='topics';renderAppDemo();
};
window.openPreviousSystemFromCard=function(el){if(el)window.openPreviousSystem(el.getAttribute('data-ped-system')||'Other / Mixed Questions')};
function doctorSystemsView(){
 const rows=SYS.filter(s=>s[0]!=='exams').map(s=>{
  const list=doctorQuestions().filter(q=>q.spec===s[0]);
  return {id:s[0],label:s[1],image:s[2],count:list.length,topics:new Set(list.map(q=>q.topic)).size,answered:typeof answeredCount==='function'?answeredCount(list):0};
 });
 const available=rows.filter(x=>x.count>0),soon=rows.filter(x=>x.count===0),total=doctorQuestions().length;
 const cards=available.map(s=>{const progress=s.count?Math.round(s.answered*100/s.count):0;
  return `<div class="card sc spc ped-system-card" onclick="openSpec('${s.id}')">${sysIcon(s.image,'lg')}<div class="spc-tx"><h3>${escHtml(s.label)}</h3><div class="meta"><b>${s.count}</b> questions · <b>${s.topics}</b> topics</div><div class="bar"><span style="width:${progress}%"></span></div></div><span class="chev">›</span></div>`;
 }).join('');
 return `${appHeader('Dr. Abdulrahman Al-Joaki MCQ')}<div class="rs ped-systems-page">
  <div class="ped-collection-kicker">DR. ABDULRAHMAN AL-JOAKI MCQ</div><h1>Choose a medical system</h1>
  <p class="sub">${available.length} systems · ${total.toLocaleString()} questions</p>
  <div class="ped-systems-grid">${cards||'<div class="card setcard"><p class="meta">No doctor-bank questions are available for this grade yet.</p></div>'}</div>
  ${soon.length?`<div class="soon-h">Other systems</div><div class="soon-grid">${soon.map(s=>`<div class="soon-t">${sysIcon(s.image,'md')}<span>${escHtml(s.label)}</span></div>`).join('')}</div>`:''}
 </div>`;
}
function previousSystemsView(){
 refreshPreviousTopicMap();
 const groups=new Map();
 (REAL&&REAL.spec&&REAL.spec.exams&&REAL.spec.exams.topics||[]).forEach(t=>{
  if(!Array.isArray(t))return;const name=String(t[3]||'Other / Mixed Questions');
  if(!groups.has(name))groups.set(name,{name,topics:0,questions:0});
  const g=groups.get(name);g.topics++;g.questions+=Number(t[2])||0;
 });
 const systemRank=name=>{const row=mappedSystem(name);if(!row)return 999;const i=SYS.findIndex(s=>s[0]===row[0]);return i<0?999:i};
 const systems=[...groups.values()].sort((a,b)=>systemRank(a.name)-systemRank(b.name)||a.name.localeCompare(b.name)),total=previousQuestions().length;
 const cards=systems.map(s=>{
  const icon=mappedSystem(s.name),iconMarkup=icon&&icon[2]?sysIcon(icon[2],'lg'):sysIcon('s_growth','lg');
  return `<div class="card sc spc ped-system-card" data-ped-system="${escHtml(s.name)}" onclick="openPreviousSystemFromCard(this)">${iconMarkup}<div class="spc-tx"><h3>${escHtml(s.name)}</h3><div class="meta"><b>${s.questions}</b> questions · <b>${s.topics}</b> topics</div></div><span class="chev">›</span></div>`;
 }).join('');
 return `${appHeader('Previous Questions')}<div class="rs ped-systems-page">
  <div class="ped-collection-kicker">FACULTY OF MEDICINE · UNIVERSITY OF TRIPOLI</div><h1>Previous Questions</h1>
  <p class="sub">${systems.length} medical systems · ${total.toLocaleString()} questions</p>
  <div class="ped-systems-grid">${cards||'<div class="card setcard"><p class="meta">No previous-exam systems were found in the current question bank.</p></div>'}</div>
 </div>`;
}
const _oldSubjectsView=subjectsView;
subjectsView=function(){
 let html=_oldSubjectsView.apply(this,arguments);
 html=html.replace(/appPage\s*=\s*['"]specialties['"]/g,"appPage='pedcollections'");
 html=html.replace(/onclick="startPractice\(event\)"/g,'onclick="openPediatricCollections(event)"');
 html=html.replace('onkeydown="if(event.key===\'Enter\')appPage=\'pedcollections\',renderAppDemo()"','onkeydown="if(event.key===\'Enter\')openPediatricCollections(event)"');
 return html;
};
window.__shbRegisterPage('pedcollections',collectionView,'subjects');
if(typeof BACKP!=='undefined')BACKP.specialties='pedcollections';
const _oldSpecialtiesView=specialtiesView;
specialtiesView=function(){if(activeCollection==='previous')return previousSystemsView();if(activeCollection==='aj')return doctorSystemsView();return _oldSpecialtiesView.apply(this,arguments)};
const _oldOpenSpec=window.openSpec;
if(typeof _oldOpenSpec==='function')window.openSpec=function(id){activeCollection='aj';activePreviousSystem='';window.__SHB_PED_COLLECTION__='aj';return _oldOpenSpec(id)};
const _oldOpenTopic=window.openTopic;
if(typeof _oldOpenTopic==='function')window.openTopic=function(spec,id){if(activeCollection!=='previous')activeCollection='aj';return _oldOpenTopic(spec,id)};
const _oldInTopic=inTopic;
inTopic=function(){
 if(!gradeHasPediatrics())return [];
 let list=allQuestions().filter(q=>activeCollection==='previous'?isPreviousQuestion(q):isDoctorQuestion(q));
 if(qs.spec&&qs.spec!=='all')list=list.filter(q=>q.spec===qs.spec);
 if(qs.topic)list=list.filter(q=>q.topic===qs.topic);
 if(activeCollection==='previous'&&activePreviousSystem)list=list.filter(q=>previousSystemByTopic.get(q.topic)===activePreviousSystem);
 return list;
};
/* Conservative semantic matching: only equivalent/closely related topics reuse another bank's topic artwork. */
const PREVIOUS_TOPIC_ICON_MATCH={
 'respiratory distress syndrome & neonatal lung disease':'Prematurity & Respiratory Distress',
 'neonatal jaundice & kernicterus':'Neonatal Jaundice',
 'hypoxic ischaemic encephalopathy & birth asphyxia':'Birth Asphyxia, Resuscitation & Apgar',
 'neonatal sepsis':'Neonatal Sepsis & Congenital Infections',
 'newborn examination & neonatal skin umbilical conditions':'Newborn Examination & Normal Care',
 'infant of diabetic mother':'Neonatal Metabolic Problems & Infants of Diabetic Mothers',
 'necrotizing enterocolitis':'Neonatal Gastrointestinal & Surgical Conditions',
 'neonatal seizures':'Neonatal Seizures & Intracranial Haemorrhage',
 'prematurity & low birth weight':'Prematurity & Respiratory Distress',
 'haemorrhagic disease of the newborn vitamin k':'Vitamin K & Neonatal Bleeding',
 'neonatal hypoglycemia & metabolic problems':'Neonatal Metabolic Problems & Infants of Diabetic Mothers',
 'autism spectrum disorder & developmental behavioural disorders':'Autism, Attention-Deficit Hyperactivity Disorder & Developmental Delay',
 'meningitis & encephalitis':'Meningitis & Encephalitis',
 'headache migraine & raised icp':'Headache, Ataxia, Stroke & Tumours',
 'epilepsy':'Epilepsy & Seizures',
 'febrile convulsions':'Febrile Seizures',
 'cerebral palsy':'Cerebral Palsy',
 'neuromuscular disorders':'Neuromuscular Disorders',
 'hydrocephalus head size & neural tube defects':'Hydrocephalus & Neural Tube Defects',
 'cyanotic congenital heart disease':'Cyanosis & Congenital Heart Disease (General)',
 'acyanotic congenital heart disease':'Septal Defects & Patent Ductus Arteriosus',
 'infective endocarditis':'Infective Endocarditis',
 'heart failure & cardiomyopathy':'Heart Failure',
 'arrhythmias':'Arrhythmias (Supraventricular Tachycardia, Wolff-Parkinson-White & Heart Block)',
 'rheumatic fever & rheumatic heart disease':'Acute Rheumatic Fever',
 'puberty & precocious delayed puberty':'Puberty & Gonadal Disorders',
 'type 1 diabetes mellitus & dka':'Diabetic Ketoacidosis & Hyperosmolar State',
 'adrenal disorders cah addison cushing':'Adrenal Disorders (CAH, Addison Disease & Cushing Syndrome)',
 'diabetes insipidus & pituitary posterior pituitary':'Posterior Pituitary: DI, SIADH & Vasopressin',
 'short stature & growth hormone disorders':'Short Stature & Growth Disorders',
 'hyperthyroidism & graves disease':'Hyperthyroidism (Graves Disease)',
 'acute & chronic diarrhoea':'Diarrhoea & Dehydration',
 'gastro oesophageal reflux':'Reflux, Vomiting & Pyloric Stenosis',
 'coeliac disease':'Coeliac Disease & Malabsorption',
 'inflammatory bowel disease':'Inflammatory Bowel Disease',
 'liver disease hepatitis & portal hypertension':'Liver Disease & Jaundice',
 'biliary atresia & cholestatic jaundice':'Liver Disease & Jaundice',
 'pyloric stenosis':'Reflux, Vomiting & Pyloric Stenosis',
 'constipation & hirschsprung disease':'Constipation, Hirschsprung & Soiling',
 'dehydration & fluid therapy':'Diarrhoea & Dehydration',
 'intussusception & surgical abdomen':'Intussusception & Acute Abdomen',
 'patterns of inheritance':'Inheritance & Single-Gene Disorders',
 'eczema & skin disorders':'Skin Disorders',
 'chromosomal disorders down turner klinefelter':'Chromosomal Disorders',
 'inborn errors of metabolism':'Inborn Errors of Metabolism',
 'poisoning & toxicology':'Poisoning',
 'juvenile idiopathic arthritis sle & vasculitis':'Arthritis, Lupus, Kawasaki Disease & Vasculitis',
 'primary immunodeficiency & allergy':'Immunodeficiency & Allergy',
 'other bacterial infections & antibiotic use':'Fever, Sepsis & Bacterial Infections',
 'exanthems & childhood infectious fevers':'Exanthems & Viral Infections',
 'tuberculosis':'Tuberculosis',
 'vaccination & immunisation':'Vaccination & Immunisation',
 'hiv & mother to child transmission':'Human Immunodeficiency Virus (HIV)',
 'malaria parasitic & tropical infections':'Malaria & Parasitic Infections',
 'normal development & developmental milestones':'Breastfeeding & Infant Feeding',
 'malnutrition pem kwashiorkor marasmus':'Protein-Energy Malnutrition',
 'vitamins & micronutrient deficiencies':'Vitamins & Minerals',
 'breastfeeding & infant feeding':'Breastfeeding & Infant Feeding',
 'obesity & growth assessment':'Obesity',
 'solid tumours wilms neuroblastoma brain':'Leukaemia & Childhood Cancers',
 'iron deficiency anaemia':'Iron Deficiency & Nutritional Anaemia',
 'leukaemia lymphoma & childhood cancers':'Leukaemia & Childhood Cancers',
 'bleeding disorders itp vwd platelets':'Bleeding Disorders',
 'haemolytic anaemias & bone marrow failure':'Haemolytic Anaemias',
 'pertussis & foreign body aspiration':'Pertussis & Respiratory Infections',
 'asthma':'Asthma',
 'croup & upper airway infections':'Bronchiolitis, Croup & Stridor',
 'pneumonia':'Pneumonia',
 'bronchiolitis & rsv':'Bronchiolitis, Croup & Stridor',
 'cystic fibrosis':'Cystic Fibrosis & Chronic Lung Disease',
 'bronchiectasis chest x ray & other respiratory':'Cystic Fibrosis & Chronic Lung Disease',
 'urinary tract infection & vesicoureteric reflux':'Urinary Tract Infection & Vesicoureteral Reflux',
 'nephrotic syndrome':'Nephrotic Syndrome',
 'glomerulonephritis & henoch schonlein purpura':'Glomerulonephritis (Post-Streptococcal, IgA & Others)',
 'renal tubular acidosis & acid base disorders':'Tubular Disorders & Hereditary/Cystic Kidney Diseases',
 'hypertension in children':'Hypertension in Children'
};

const _oldTopicIcon=topicIcon;
topicIcon=function(spec,name,id){
 if(spec!=='exams'||activeCollection!=='previous')return _oldTopicIcon.apply(this,arguments);
 try{
  const target=norm(name);
  const desired=PREVIOUS_TOPIC_ICON_MATCH[target];
  const found=desired&&Object.keys(TOPIC_ICON_ASSET).find(k=>k.slice(k.indexOf('|')+1)===desired);
  if(found)return _oldTopicIcon(found.slice(0,found.indexOf('|')),desired,id);
  const row=mappedSystem(activePreviousSystem);
  if(row&&row[2]&&IMG[row[2]])return `<div class="tno ti"><img src="${IMG[row[2]]}" alt="${escHtml(name)}" width="176" height="176" loading="lazy" decoding="async"></div>`;
 }catch(e){}
 return _oldTopicIcon.apply(this,arguments);
};
const _oldTopicCards=topicCards;
topicCards=function(){
 if(activeCollection!=='previous')return _oldTopicCards.apply(this,arguments);
 const topics=topicListForPreviousSystem();
 if(!topics.length)return '<div class="card sc"><h3>No topics found</h3><div class="meta">No previous questions are mapped to this system.</div></div>';
 return '<div class="ped-topics-grid">'+topics.map(([id,name,count,sy])=>{
  const list=previousQuestions().filter(q=>q.topic===id&&(!activePreviousSystem||previousSystemByTopic.get(q.topic)===activePreviousSystem));
  const done=typeof answeredCount==='function'?answeredCount(list):0,p=list.length?Math.round(done*100/list.length):0;
  let pin='';
  try{if(typeof isPinned==='function'&&typeof togglePin==='function')pin=`<button type="button" class="pinb${isPinned('topic','exams',id)?' on':''}" data-inline="1" aria-label="Pin topic" onclick="togglePin(this,'topic','exams',${id},event)">${isPinned('topic','exams',id)?'★':'☆'}</button>`}catch(e){}
  return `<div class="card sc tpc" onclick="openTopic('exams',${id})">${topicIcon('exams',name,id)}<div class="tpc-tx"><h3>${escHtml(name)}</h3><div class="meta">${list.length} questions${done?` · ${done} answered`:''}</div><div class="bar"><span style="width:${p}%"></span></div></div>${pin}<span class="chev">›</span></div>`;
 }).join('')+'</div>';
};
const _oldTopicsView=topicsView;
topicsView=function(){
 let html=_oldTopicsView.apply(this,arguments);
 if(activeCollection==='previous'){
  const name=activePreviousSystem||'Previous Questions',tc=topicListForPreviousSystem().length,qc=questionsForPreviousSystem().length;
  html=html.replace(/<h1>[\s\S]*?<\/h1>/,`<h1>${escHtml(name)}</h1>`);
  html=html.replace(/<p class="sub">[\s\S]*?<\/p>/,`<p class="sub">${tc} topics · ${qc} questions</p>`);
  html=html.replace('<div class="rs">',`<div class="rs ped-bank-topics"><div class="ped-collection-kicker">PREVIOUS QUESTIONS · ${escHtml(name)}</div>`);
 }else if(activeCollection==='aj')html=html.replace('<div class="rs">','<div class="rs ped-bank-topics"><div class="ped-collection-kicker">DR. ABDULRAHMAN AL-JOAKI MCQ</div>');
 return html;
};
window.startPractice=function(ev){if(ev&&ev.stopPropagation)ev.stopPropagation();window.openPediatricCollections(ev)};
window.__SHB_PED_COLLECTION__=activeCollection;
})();