
/* ===== Shbace Medical v6 — question bank controls, icons, mascot reactions, onboarding, stairs ===== */
(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){lsFail(e);return false}}};
/* H-01: tell the student once in a while when progress could not be stored (never silent, never spammy) */
let _lsFailAt=0;
/* storage fully blocked (e.g. file preview inside another app): nothing can be saved there, so the warning would only be noise */
function lsBlocked(){try{const k='__shbace_probe__';localStorage.setItem(k,'1');localStorage.removeItem(k);return false}catch(_){return true}}
function lsFail(e){try{console.warn('Storage write failed',e);if(lsBlocked())return;const n=Date.now();if(n-_lsFailAt<60000)return;_lsFailAt=n;toast('Your latest progress could not be saved on this device (storage full or blocked). Free some space or export a backup.')}catch(_){}}
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){})}catch(e){}
const KEY='shbace_qb_v6';
const S=Object.assign({ans:{},saved:{},notes:{},rep:{},sr:{}},LS.get(KEY,{}));
/* H-06: drop only malformed records so a corrupt entry can never break Stats/Review */
(function(){try{const isO=x=>x&&typeof x==='object'&&!Array.isArray(x);for(const f of ['ans','saved','notes','rep','sr'])if(!isO(S[f]))S[f]={};
for(const id of Object.keys(S.ans)){const r=S.ans[id];if(!isO(r)||!Number.isInteger(r.sel)||typeof r.ok!=='boolean')delete S.ans[id]}
for(const id of Object.keys(S.sr))if(!isO(S.sr[id]))delete S.sr[id];
for(const id of Object.keys(S.notes))if(typeof S.notes[id]!=='string')delete S.notes[id];
for(const f of ['saved','rep'])for(const id of Object.keys(S[f]))if(S[f][id]===null||S[f][id]===undefined)delete S[f][id]}catch(e){console.warn('State sanitise failed',e)}})();
const save=()=>LS.set(KEY,S);


/* ===== QUESTION SOURCE SWITCH =====
   USE_FULL_BANK=true  -> the complete bank embedded in <script id="qbData"> (1718 questions)
   USE_FULL_BANK=false -> the original demo set below (kept intact, never deleted). Backup copy: demo_questions_backup.json */
const USE_FULL_BANK=true;
const LEGACY_DEMO={total:REAL.total,spec:REAL.spec};
let FULL_QB=[];
/* ---- Unit 1 helpers: display-only (source data in qbData is never modified) ---- */
const QLT=(q,i)=>(q&&q.ol&&q.ol[i])||String.fromCharCode(65+i);
const STEM_LBL=/^\s*(?:Q(?:uestion)?\s*\d+(?:\s*\([^)\n]*\))?\s*(?:[.):\-\u2013\u2014]\s+|\n\s*)|\d+\s*[.):]\s+)/i;
const QSTEM=q=>{const t=String(q.q==null?'':q.q);const r=t.replace(STEM_LBL,'');return r.trim()?r:t};
const VERIFY_RE=/needs?\s+(?:review|verification)|needs?\s+to\s+be\s+verified|(?:key|answer|item)[^.\n]{0,40}\bverif|verify\b|\u064a\u062d\u062a\u0627\u062c \u0645\u0631\u0627\u062c\u0639\u0629/i;
const qUnsure=q=>!!(q&&(q.f||q.kx||VERIFY_RE.test(String(q.note||'')+' '+String(q.ex||''))));
const FULL_KEY={'Respiratory':'respiratory','Cardiovascular System':'cardio','Gastrointestinal Tract':'git','Nephrology':'nephrology','Endocrinology':'endocrinology','Central Nervous System':'cns','Neonatology':'neonatology','Infectious Diseases & Vaccines':'infectious','Haematology':'haematology','Growth and Nutrition':'growth','Genetics & Dermatology':'genetics','Rheumatology / Metabolic / Poisoning / Immunology':'rheum',"Previous Years' Exam Questions":'exams'};
const FULL_TAGS=['PDF Bank','Previous Years','Repeated Question','Repeated Topic'];
let EXAMS={};
if(USE_FULL_BANK){try{
 const QD=JSON.parse(document.getElementById('qbData').textContent),D=QD.questions,ORD=QD.order,PX=ORD.py,PYS="Previous Years' Exam Questions";EXAMS=PX.exams||{};
 const subjects=ORD.subjects.filter(s=>D.some(q=>q.s===s)).concat([...new Set(D.map(q=>q.s))].filter(s=>!ORD.subjects.includes(s)));
 const by=(a,f)=>a.reduce((m,x)=>((m[f(x)]=m[f(x)]||[]).push(x),m),{});
 const ixT=(s,t)=>t.startsWith('Other')?99:(i=>i<0?50:i)((ORD.topics[s]||[]).findIndex(k=>t.includes(k)));
 const spec={};let tcount=0;
 subjects.forEach(sub=>{const key=FULL_KEY[sub]||sub.toLowerCase().replace(/\W+/g,'_');let L=D.filter(q=>q.s===sub);
  if(sub===PYS)L=L.slice().sort((a,b)=>a.xk-b.xk||a.xn-b.xn);
  const T=by(L,x=>(x.sy||'')+'\u0001'+x.t);let tl=Object.keys(T).map(k=>({sy:T[k][0].sy||'',t:T[k][0].t,n:T[k].length}));
  if(sub===PYS)tl.sort((a,b)=>PX.systems.indexOf(a.sy)-PX.systems.indexOf(b.sy)||b.n-a.n||a.t.localeCompare(b.t));else tl.sort((a,b)=>ixT(sub,a.t)-ixT(sub,b.t));
  const TID={};const topics=tl.map(x=>{const id=++tcount;TID[x.sy+'\u0001'+x.t]=id;return[id,x.t,x.n,x.sy]});
  L.forEach((q,n)=>{const ltr=q.o.map(o=>o[0]);const kx=ltr.indexOf(q.a)<0;const k=Math.max(0,ltr.indexOf(q.a));
   let e='';if(q.c)e+='The answer key was revised (solved with AI). The original explanation below may refer to the previous key.\n';
   if(q.ai&&q.f)e+='AI review: multiple, none or undetermined correct answers. Check your textbook.\n';
   e+=q.e||'';if(q.note)e+='\n'+q.note;
   FULL_QB.push({id:q.id,spec:key,topic:TID[(q.sy||'')+'\u0001'+q.t],tag:q.py?((q.rq||[]).length?'Repeated Question':(q.rc||[]).length?'Repeated Topic':'Previous Years'):'PDF Bank',
    q:q.q,o:q.o.map(o=>o[1]),ol:ltr,kx,k,ex:e.trim(),no:n+1,src:q.src||'',cs:q.cs||null,cm:!!q.cm,rq:q.rq||[],rc:q.rc||[],ai:!!q.ai,f:!!q.f,py:!!q.py})});
  spec[key]={q:L.length,label:sub,topics}});
 if(!FULL_QB.length)throw new Error('empty bank');
 REAL.total=FULL_QB.length;REAL.spec=spec;
}catch(err){console.error('Full question bank failed to build',err);FULL_QB=[];window.__BANK_ERROR=String((err&&err.message)||err);
 (function(){const show=()=>{if(document.getElementById('bankErrorOverlay'))return;const d=document.createElement('div');d.id='bankErrorOverlay';d.setAttribute('role','alertdialog');
  d.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0b1624;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px;text-align:center;font:500 15px/1.55 system-ui,sans-serif';
  d.innerHTML='<div style="font-size:42px">\u26a0</div><div style="font-size:20px;font-weight:800">Question bank could not be loaded</div><div style="max-width:320px;opacity:.85">The app stopped instead of showing sample questions. Please reload. If this repeats, reinstall the latest app file.</div><button type="button" style="padding:12px 22px;border-radius:12px;border:0;background:#2f80ff;color:#fff;font:700 15px system-ui,sans-serif" onclick="location.reload()">Reload</button>';
  (document.body||document.documentElement).appendChild(d)};if(document.body)show();else document.addEventListener('DOMContentLoaded',show)})()}}
const BANK_ON=USE_FULL_BANK&&FULL_QB.length>0;

/* ---------- sample question bank (same shape the real bank uses: id, topic, tag, stem, options, key, explanation) ---------- */
const TOPIC_NAME={};Object.values(REAL.spec).forEach(sp=>sp.topics.forEach(t=>TOPIC_NAME[t[0]]=t[1]));
/* M-03 · stable topic keys. Topic ids are positional; if the topic list ever changes, saved Pinned/Recent/Quiz-setup/Resume references are re-pointed by topic key (specialty|system|name) instead of silently landing on another topic. Question ids and answers are never touched; a raw backup of the touched stores is kept before any change. */
(function(){try{if(!BANK_ON)return;
 const cur={},byKey={};
 Object.keys(REAL.spec).forEach(sp=>REAL.spec[sp].topics.forEach(t=>{const k=sp+'|'+(t[3]||'')+'|'+t[1];cur[t[0]]=k;byKey[k]=t[0]}));
 const MK='shbace_topicmap_v1',old=LS.get(MK,null);
 const ok=old&&typeof old==='object'&&!Array.isArray(old);
 const same=ok&&Object.keys(cur).length===Object.keys(old).length&&Object.keys(cur).every(i=>old[i]===cur[i]);
 if(ok&&!same){
  const map={};Object.keys(old).forEach(i=>{map[i]=byKey[old[i]]!==undefined?byKey[old[i]]:0});
  const raw={};['shbace_pins_v1','shbace_recent_v1','shbace_quizcfg_v1','shbace_home_pediatrics_resume_v1'].forEach(k=>{try{const v=localStorage.getItem(k);if(v!==null)raw[k]=v}catch(e){}});
  if(!LS.set('shbace_topicmap_backup_v1',{at:Date.now(),old,raw}))return; /* no backup -> no migration */
  const mp=id=>Object.prototype.hasOwnProperty.call(map,id)?map[id]:id; /* unknown ids (new topics) stay */
  ['shbace_pins_v1','shbace_recent_v1'].forEach(k=>{const a=LS.get(k,null);if(!Array.isArray(a))return;
   LS.set(k,a.filter(e=>e&&typeof e==='object').map(e=>{if(e.k!=='topic'||!e.topic)return e;const n=mp(e.topic);return n?Object.assign({},e,{topic:n}):null}).filter(Boolean))});
  const qc=LS.get('shbace_quizcfg_v1',null);
  if(qc&&typeof qc==='object'&&Array.isArray(qc.topics))LS.set('shbace_quizcfg_v1',Object.assign({},qc,{topics:qc.topics.map(mp).filter(Boolean)}));
  try{const r=JSON.parse(localStorage.getItem('shbace_home_pediatrics_resume_v1')||'null');
   if(r&&typeof r==='object'&&r.topic){const n=mp(r.topic);if(n){r.topic=n;localStorage.setItem('shbace_home_pediatrics_resume_v1',JSON.stringify(r))}else localStorage.removeItem('shbace_home_pediatrics_resume_v1')}}catch(e){}
 }
 if(!ok||!same)LS.set(MK,cur);
}catch(e){console.warn('Topic key check failed',e)}})();
let SPEC_NAME={endocrinology:'Endocrinology',nephrology:'Nephrology',urology:'Urology'};
const DEMO_QB=[
['ENDO-001','endocrinology',1,'Clinical Case','A 7-year-old boy has had 3 weeks of polyuria, polydipsia and weight loss. Random plasma glucose is 340 mg/dL. What is the most likely diagnosis?',['Type 2 diabetes mellitus','Type 1 diabetes mellitus','MODY','Diabetes insipidus','Cushing syndrome'],1,'Polyuria, polydipsia and weight loss with a random glucose ≥ 200 mg/dL confirm diabetes. In a thin child the cause is autoimmune β-cell destruction: type 1 DM, about 90% of childhood diabetes.'],
['ENDO-002','endocrinology',1,'Knowledge','In childhood diabetes mellitus (DM) the following are correct except:',['Could be presented with fungal vulvovaginitis in an adolescent girl.','90% is type 1 DM.','Could be presented with nocturnal enuresis.','Needs good familial education to achieve good control.','These children need to learn in special schools.'],4,'Children with DM have normal intelligence and attend regular schools. Candidal vulvovaginitis and secondary enuresis are recognised presentations, and family education is the basis of control.'],
['ENDO-003','endocrinology',1,'Management','Typical insulin requirement in prepubertal children after the "honeymoon" period is:',['< 0.5 U/kg/day','0.5 U/kg/day','0.7–1.0 U/kg/day','1.2–1.5 U/kg/day','2 U/kg/day'],2,'After the honeymoon (partial remission) phase prepubertal children need about 0.7–1.0 U/kg/day. In puberty it rises to 1.0–1.5 U/kg/day because of insulin resistance.'],
['ENDO-004','endocrinology',1,'Investigation','Which test best reflects average glycaemic control over the previous 2–3 months?',['Fasting plasma glucose','Urine ketones','HbA1c','Random blood glucose','Oral glucose tolerance test'],2,'HbA1c reflects mean glucose over the life span of red cells (about 8–12 weeks) and is the standard long-term control marker.'],
['ENDO-005','endocrinology',2,'Clinical Case','A 9-year-old has polyuria, vomiting and deep, rapid breathing. Glucose is 480 mg/dL and venous pH is 7.1. What is the first step in management?',['Immediate insulin bolus','Isotonic saline resuscitation','Sodium bicarbonate infusion','Oral rehydration'],1,'This is DKA. Restore circulating volume first with isotonic saline; an insulin infusion (no bolus) starts after the first hour of fluids. Bicarbonate is not routinely given.'],
['ENDO-006','endocrinology',2,'Knowledge','The most serious complication of DKA treatment in children is:',['Cerebral oedema','Hypokalaemia','Hypoglycaemia','Pulmonary embolism','Acute pancreatitis'],0,'Cerebral oedema, usually 4–12 hours into treatment, causes most DKA deaths in children. Avoid fluid boluses beyond need and a rapid fall in osmolality.'],
['ENDO-007','endocrinology',3,'Management','A macrosomic, jittery newborn of a diabetic mother has a blood glucose of 25 mg/dL. What is the best treatment?',['Oral formula only','IV 10% dextrose 2 mL/kg bolus, then infusion','IV glucagon only','Observe and repeat glucose in 6 hours','IV hydrocortisone'],1,'Symptomatic neonatal hypoglycaemia needs immediate IV 10% dextrose followed by a continuous glucose infusion. Fetal hyperinsulinism explains both the macrosomia and the hypoglycaemia.'],
['ENDO-008','endocrinology',4,'Investigation','Which pattern indicates primary hypothyroidism?',['High TSH, low free T4','Low TSH, high free T4','Low TSH, low free T4','High TSH, high free T4','Normal TSH, low free T4'],0,'Loss of thyroid hormone removes negative feedback, so TSH rises while free T4 falls. Low TSH with low T4 points to a central (pituitary) cause.'],
['ENDO-009','endocrinology',5,'Knowledge','Congenital hypothyroidism is characterized by all of the following except:',['Mental retardation (if untreated)','Macroglossia','Warm peripheries','Short stature','Delayed teething'],2,'Hypothyroidism lowers the metabolic rate, giving cold, mottled peripheries, hypothermia, constipation and bradycardia. Intellectual disability, macroglossia, short stature and delayed dentition are typical.'],
['ENDO-010','endocrinology',5,'Investigation','What is the best screening test for congenital hypothyroidism in the newborn?',['TSH on a heel-prick blood spot (day 2–5)','Thyroid ultrasound','Bone age X-ray','Serum cholesterol','Maternal thyroid antibodies'],0,'Newborn screening measures TSH on a dried blood spot between day 2 and 5, because most infants have no obvious signs at birth.'],
['ENDO-011','endocrinology',5,'Management','What is the treatment of congenital hypothyroidism?',['Iodine supplements only','Levothyroxine started as early as possible','Carbimazole','Radioactive iodine','Thyroidectomy'],1,'Lifelong levothyroxine (about 10–15 µg/kg/day), started within the first 2 weeks, protects neurodevelopment. Early treatment is the main determinant of IQ.'],
['ENDO-012','endocrinology',6,'Diagnosis','The most common cause of acquired hypothyroidism in iodine-sufficient areas is:',['Hashimoto (chronic lymphocytic) thyroiditis','Iodine deficiency','Thyroid dysgenesis','Subacute thyroiditis','Drug-induced hypothyroidism'],0,'Autoimmune Hashimoto thyroiditis, with anti-TPO and anti-thyroglobulin antibodies and a firm goitre, is the leading cause outside iodine-deficient regions.'],
['ENDO-013','endocrinology',7,'Diagnosis','The most common cause of hyperthyroidism in children is:',['Graves disease','Toxic adenoma','Hashimoto thyroiditis','TSH-secreting adenoma','Subacute thyroiditis'],0,'Graves disease (TSH-receptor stimulating antibodies) accounts for most paediatric thyrotoxicosis. First-line treatment is an antithyroid drug such as methimazole or carbimazole.'],
['ENDO-014','endocrinology',8,'PDF Bank','The most common type of thyroid carcinoma in children is:',['Papillary','Follicular','Medullary','Anaplastic','Lymphoma'],0,'Papillary carcinoma makes up the large majority of paediatric thyroid cancers and has an excellent prognosis.'],
['ENDO-015','endocrinology',9,'Clinical Case','A 10-day-old girl has ambiguous genitalia, vomiting, hyponatraemia and hyperkalaemia. Which enzyme is deficient?',['21-hydroxylase','11β-hydroxylase','17α-hydroxylase','Aromatase','5α-reductase'],0,'Salt-wasting 21-hydroxylase deficiency (classic CAH) causes cortisol and aldosterone deficiency with androgen excess: virilisation of a female fetus and a salt-losing crisis at 1–2 weeks.'],
['ENDO-016','endocrinology',9,'Investigation','Which hormone is markedly raised and diagnostic in 21-hydroxylase deficiency?',['Cortisol','Aldosterone','17-hydroxyprogesterone','Serum sodium','Blood glucose'],2,'The enzyme block makes 17-hydroxyprogesterone accumulate. It is the screening and diagnostic marker, while cortisol and aldosterone are low.'],
['ENDO-017','endocrinology',10,'Investigation','Which pair is the best initial screening test for growth hormone deficiency?',['IGF-1 and IGFBP-3','Random GH level','Fasting glucose','TSH only','Morning cortisol'],0,'GH is pulsatile, so a random level is unhelpful. IGF-1 and IGFBP-3 reflect GH secretion and are checked before a provocation test.'],
['ENDO-018','endocrinology',11,'Clinical Case','A child has polyuria and polydipsia, serum sodium 150 mmol/L, and low urine osmolality that rises after desmopressin. What is the diagnosis?',['Central diabetes insipidus','Nephrogenic diabetes insipidus','Primary polydipsia','Type 1 DM','SIADH'],0,'Urine concentrates after desmopressin only when the kidney can respond, so the defect is a lack of ADH: central diabetes insipidus.'],
['ENDO-019','endocrinology',12,'Diagnosis','A healthy 8-year-old boy has short stature with normal growth velocity, bone age equal to chronological age, and short parents. The most likely diagnosis is:',['Growth hormone deficiency','Familial short stature','Constitutional delay of growth','Hypothyroidism','Turner syndrome'],1,'Normal velocity with bone age = chronological age and short parents is familial short stature. In constitutional delay the bone age is delayed.'],
['ENDO-020','endocrinology',13,'Knowledge','The first sign of puberty in girls is:',['Menarche','Pubic hair','Breast budding (thelarche)','Growth spurt','Axillary hair'],2,'Thelarche is normally first (8–13 years), followed by pubarche, the growth spurt and, about 2 years after thelarche, menarche.'],
['ENDO-021','endocrinology',14,'PDF Bank','The most common cause of rickets worldwide is:',['Vitamin D deficiency','Hypophosphataemic rickets','Renal tubular acidosis','Vitamin D-dependent rickets','Hypoparathyroidism'],0,'Nutritional vitamin D (and calcium) deficiency is by far the most common cause of rickets.'],
['NEPH-001','nephrology',17,'Knowledge','The most common cause of nephrotic syndrome in children is:',['Minimal change disease','Focal segmental glomerulosclerosis','Membranous nephropathy','MPGN','IgA nephropathy'],0,'Minimal change disease causes about 85% of childhood nephrotic syndrome and usually responds to corticosteroids.'],
['NEPH-002','nephrology',16,'Investigation','Which finding is expected in acute post-streptococcal glomerulonephritis?',['Low serum C3','Raised serum C3','Low C4 only','Normal complement','Raised albumin'],0,'APSGN activates the alternative pathway, so C3 is low (normalising in 6–8 weeks) while C4 is usually normal.'],
['URO-001','urology',25,'Investigation','Which investigation is the gold standard for diagnosing vesicoureteral reflux?',['Micturating cystourethrogram (MCUG)','Renal ultrasound','DMSA scan','Plain abdominal X-ray','Intravenous urogram'],0,'MCUG shows and grades reflux. Ultrasound screens for hydronephrosis and DMSA detects renal scarring.']
].map(a=>({id:a[0],spec:a[1],topic:a[2],tag:a[3],q:a[4],o:a[5],k:a[6],ex:a[7]}));
const QB=BANK_ON?FULL_QB:DEMO_QB;
const TAGS=BANK_ON?FULL_TAGS:['Clinical Case','Diagnosis','Investigation','Knowledge','Management','PDF Bank'];
window.__bank={on:BANK_ON,total:QB.length,demo:DEMO_QB};
const FILTERS=[['all','All Questions'],['unanswered','Unanswered'],['correct','Correct'],['incorrect','Incorrect'],['bookmarked','Bookmarked']];

/* ---------- state ---------- */
const qs={spec:'endocrinology',topic:0,filter:'all',tag:'all',view:'all',idx:0,full:false,noteOpen:{},streak:0,dd:null};
window.__qs=qs;

/* ---------- icons ---------- */
const URO_SVG=`<svg viewBox="0 0 100 100" class="uro-svg" aria-hidden="true"><defs><linearGradient id="urg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9f8a"/><stop offset="1" stop-color="#d2566a"/></linearGradient><radialGradient id="urb" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#ffd3b8"/><stop offset="1" stop-color="#e98a7c"/></radialGradient></defs><rect width="100" height="100" fill="#0b1f55"/><circle cx="50" cy="50" r="46" fill="#123a99" opacity=".55"/><path d="M33 14c-12 4-16 22-10 38 4 10 12 12 16 6 5-8 2-22-1-30-1-5 0-11-5-14z" fill="url(#urg)"/><path d="M67 14c12 4 16 22 10 38-4 10-12 12-16 6-5-8-2-22 1-30 1-5 0-11 5-14z" fill="url(#urg)"/><path d="M37 50c4 10 10 14 12 24M63 50c-4 10-10 14-12 24" stroke="#ffb36b" stroke-width="3.4" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="80" rx="15" ry="13" fill="url(#urb)"/><path d="M50 60v9" stroke="#ffb36b" stroke-width="3.4" stroke-linecap="round"/></svg>`;
const SYS=[
 ['endocrinology','Endocrinology','s_endocrinology',1],['nephrology','Nephrology','s_nephrology',1],['urology','Urology',null,1],
 ['respiratory','Respiratory','s_respiratory',0],['cardio','Cardiovascular System','s_cardio',0],['git','Gastrointestinal Tract','s_git',0],
 ['cns','Central Nervous System','s_cns',0],['neonatology','Neonatology','s_neonatology',0],['infectious','Infectious Diseases & Vaccines','s_infectious',0],
 ['haematology','Haematology','s_haematology',0],['growth','Growth and Nutrition','s_growth',0],['genetics','Genetics & Dermatology','s_genetics',0],
 ['rheum','Rheumatology / Metabolic / Poisoning / Immunology','s_rheum',0],['exams','Previous Years\u2019 Exam Questions','s_exams',0]
];
if(BANK_ON){/* demo-only specialty (Urology) has no questions in the full bank -> disabled with the demo set */for(let i=SYS.length-1;i>=0;i--)if(!REAL.spec[SYS[i][0]]&&SYS[i][0]==='urology')SYS.splice(i,1);SYS.forEach(r=>{r[3]=REAL.spec[r[0]]?1:0});SPEC_NAME={};SYS.forEach(r=>SPEC_NAME[r[0]]=r[1])}
const sysIcon=(img,cls='')=>img?`<img class="sysimg ${cls}" src="${IMG[img]}" alt="">`:`<span class="sysimg ${cls} uro">${URO_SVG}</span>`;

/* ---------- helpers ---------- */
const subjectQs=()=>QB;
const inTopic=()=>(gradeHasPediatrics()?QB:[]).filter(q=>(qs.spec==='all'||q.spec===qs.spec)&&(!qs.topic||q.topic===qs.topic));
function statusOf(q){const a=S.ans[q.id];return !a?'unanswered':(a.ok?'correct':'incorrect')}
function filtered(){return inTopic().filter(q=>{
  if(qs.filter==='bookmarked'&&!S.saved[q.id])return false;
  if(['unanswered','correct','incorrect'].includes(qs.filter)&&statusOf(q)!==qs.filter)return false;
  if(qs.tag!=='all'&&q.tag!==qs.tag)return false;return true})}
const answeredCount=list=>list.filter(q=>S.ans[q.id]).length;
const topicTitle=()=>qs.topic?TOPIC_NAME[qs.topic]:'All topics';
function pct(n,d){return d?Math.round(n*100/d):0}

/* ---------- toast ---------- */
function toast(msg,face){const ph=$('.phone');if(!ph)return;ph.querySelectorAll('.toast6').forEach(e=>e.remove());const t=document.createElement('div');t.className='toast6';t.innerHTML=(face?`<img src="${IMG['f_'+face]}" alt="">`:'')+`<span>${esc(msg)}</span>`;ph.appendChild(t);setTimeout(()=>t.classList.add('out'),1700);setTimeout(()=>t.remove(),2100)}

/* ---------- confetti ---------- */
function confetti(host,n=26){if(!host)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const box=document.createElement('div');box.className='cf-box';const cols=['#5eb6ff','#2b7bff','#ffd166','#ff7a90','#7ee0a6','#b497ff'];
 for(let i=0;i<n;i++){const p=document.createElement('i');const star=i%4===0;p.className='cf'+(star?' st':'');if(star)p.textContent='★';p.style.cssText=`left:${5+Math.random()*90}%;--dx:${(Math.random()*120-60).toFixed(0)}px;--r:${(Math.random()*720-360).toFixed(0)}deg;animation-delay:${(Math.random()*.25).toFixed(2)}s;animation-duration:${(1+Math.random()*.7).toFixed(2)}s;background:${star?'none':cols[i%cols.length]};color:${cols[(i+2)%cols.length]};width:${star?'auto':(5+Math.random()*5)+'px'};height:${star?'auto':(8+Math.random()*6)+'px'}`;box.appendChild(p)}
 host.appendChild(box);setTimeout(()=>box.remove(),2000)}
const PRAISE=['Excellent!','Well done!','Great job!','Spot on!'];
const PRAISE2=['Excellent work. Keep building on what you know.','Well done — that knowledge is sticking.','Great job. One more step toward the goal.','Spot on. Keep the momentum going.'];

/* ============================================================
   QUESTION BANK
   ============================================================ */
function ddHTML(id,items,val,label){const cur=(items.find(i=>i[0]===val)||items[0])[1];return `<div class="dd ${qs.dd===id?'open':''}" id="dd-${id}"><button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="${qs.dd===id}" onclick="ddToggle('${id}',event)"><span>${esc(label||cur)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button><div class="dd-list" role="listbox">${items.map(([v,l])=>`<button type="button" role="option" class="dd-item ${v===val?'sel':''}" onclick="ddPick('${id}','${String(v).replace(/'/g,"\\'")}',event)"><i></i><span>${esc(l)}</span></button>`).join('')}</div></div>`}
window.ddToggle=function(id,e){e&&e.stopPropagation();qs.dd=qs.dd===id?null:id;refreshDD()};
function refreshDD(){document.querySelectorAll('.dd').forEach(d=>{const o=d.id==='dd-'+qs.dd;d.classList.toggle('open',o);const b=d.querySelector('.dd-btn');b&&b.setAttribute('aria-expanded',o)})}
document.addEventListener('click',e=>{if(qs.dd&&!e.target.closest('.dd')){qs.dd=null;refreshDD()}});
window.ddPick=function(id,v,e){e&&e.stopPropagation();qs.dd=null;
 if(id==='filter'){qs.filter=v;qs.idx=0;paintBank()}
 else if(id==='tag'){qs.tag=v;qs.idx=0;paintBank()}
 else if(id==='xscope'){exp.scope=v;paintExport()}
 else if(id==='xlayout'){exp.layout=v;paintExport()}
 refreshDD()};

const exName=e=>String((EXAMS[e]||e)).replace("Previous Years' Exam Questions \u2014 ",'Exam ');
const repRef=a=>{const g={};a.forEach(([e,n])=>(g[e]=g[e]||[]).push(n));return Object.keys(g).map(e=>`<bdi>${esc(exName(e))}</bdi> \u2013 ${g[e].map(n=>'Q'+n).join(', ')}`).join(' \u00b7 ')};
function qExtra(q){if(!BANK_ON)return '';let x='';
 if(q.py){if(q.src)x+=`<div class="qsrc">Source: <bdi>${esc(q.src)}</bdi></div>`;if(q.cs)x+=`<div class="qcase"><b>${esc(q.cs[0])}</b>\n${esc(q.cs[1])}</div>`;if(q.cm)x+='<div class="qrep"><span class="qflag w">Case text not in source file \u2013 classified by explanation</span></div>';
  if(q.rq.length)x+=`<div class="qrep"><span class="qflag r">Repeated Question</span> also appears in: ${repRef(q.rq)}</div>`;if(q.rc.length)x+=`<div class="qrep"><span class="qflag w">Repeated Topic/Concept</span> also tested in: ${repRef(q.rc)}</div>`}
 if(q.f)x+='<span class="qflag w">Needs review</span>';if(q.ai)x+='<span class="qflag">Solved with AI</span>';
 if(qUnsure(q))x+=`<div class="qwarn" role="note"><b>\u26a0 Needs Review / Verification</b><span>${q.kx?'The answer key does not match any option \u2014 do not rely on it.':'This question or its answer key is not confirmed. Check your textbook before relying on the answer.'}</span></div>`;
 return x}
function cardHTML(q,n,single){
 const a=S.ans[q.id],st=statusOf(q),L=i=>QLT(q,i);
 const opts=q.o.map((t,i)=>{let c='qopt';if(a){if(i===q.k)c+=' correct';else if(i===a.sel)c+=' incorrect';else c+=' dim'}
  return `<button type="button" class="${c}" ${(a||q.kx)?'disabled':''} onclick="qAnswer('${q.id}',${i})"><i>${L(i)}</i><span>${esc(t)}</span>${a&&i===q.k?'<b class="ck">✓</b>':''}${a&&i===a.sel&&i!==q.k?'<b class="ck x">✕</b>':''}</button>`}).join('');
 let react='';
 if(a){const ok=a.ok;const face=ok?'happy':(DOCF[q.id]||'sad');
  const msg=ok?(a.msg||PRAISE2[0]):(face==='angry'?'Let’s pause and review this one carefully.':face==='encouraging'?'A tough run — keep going, every mistake teaches you something.':'Not quite — the explanation below will help.');
  react=`<div class="qreact ${ok?'ok':'no'}">${docFace(face)}<div><b>${ok?(a.pr||'Excellent!'):(face==='angry'?'Careful!':face==='encouraging'?'Keep going!':'Incorrect')}</b><span>${esc(msg)}</span></div></div>
  <div class="qfb ${ok?'ok':'no'}"><b>${ok?'Correct':'Incorrect'} · Correct answer: ${L(q.k)}. ${esc(q.o[q.k])}${qUnsure(q)?' <em class="qunsure">(unconfirmed key)</em>':''}</b><p>Explanation: ${esc(q.ex)}</p></div>`}
 else if(single){react=`<div class="qreact think"><div><b>Take your time</b><span>Think it through, then choose an answer.</span></div></div>`}
 const acts=`<div class="qacts">
  <button type="button" class="qa ${S.saved[q.id]?'on':''}" onclick="qSave('${q.id}')"><span>${S.saved[q.id]?'★':'☆'}</span>${S.saved[q.id]?'Saved':'Save'}</button>
  ${REPORT_ERROR_ENABLED?`<button type="button" class="qa ${S.rep[q.id]?'on':''}" onclick="qReport('${q.id}')"><span>⚑</span>${S.rep[q.id]?'Reported':'Report error'}</button>`:''}
  <button type="button" class="qa ${S.notes[q.id]?'on':''}" onclick="qNote('${q.id}')"><span>✎</span>Personal note</button>
</div>`;
 const note=qs.noteOpen[q.id]?`<div class="qnote"><textarea placeholder="Write your note…" oninput="qNoteSave('${q.id}',this.value)">${esc(S.notes[q.id]||'')}</textarea></div>`:'';
 const sname=a?(a.ok?'Correct':'Incorrect'):'Unanswered';
 return `<article class="qcard" id="qc-${q.id}" data-id="${q.id}"><div class="qtop"><span class="qid">${q.id} · mcq</span><span class="qstat s-${st}">${sname}</span><span class="qtag">${esc(q.tag)}</span></div><div class="qtopic">${esc(TOPIC_NAME[q.topic])}</div>${qExtra(q)}<h3 class="qstem">Q${n}. ${esc(QSTEM(q))}</h3><div class="qopts">${opts}</div>${react}${acts}${note}</article>`}

function bankBody(){
 const list=filtered();
 if(!list.length){const none=!inTopic().length;return `<div class="qempty"><img src="${IMG.f_think}" alt=""><b>${none?'No questions here yet':'No questions match this filter'}</b><span>${none?'Questions for this topic will appear here.':'Try another filter or tag.'}</span></div>`}
 if(qs.view==='single'){qs.idx=Math.min(Math.max(qs.idx,0),list.length-1);const q=list[qs.idx];
  return cardHTML(q,qs.idx+1,true)+`<div class="qnav"><button type="button" class="btn" onclick="qStep(-1)" ${qs.idx===0?'disabled':''}>← Previous</button><span>${qs.idx+1} / ${list.length}</span><button type="button" class="btn primary" onclick="qStep(1)" ${qs.idx>=list.length-1?'disabled':''}>Next →</button></div>`}
 return list.map((q,i)=>cardHTML(q,i+1,false)).join('')}
function progHTML(){const base=filtered();const t=inTopic();const n=answeredCount(base);const p=pct(n,base.length);return `<div class="qprog"><span>${n} / ${base.length} answered in this view</span><b>${p}%</b></div><div class="qbar"><i style="width:${p}%"></i></div>`}
window.paintBank=function(){const b=$('#qbBody'),p=$('#qbProg');if(b)b.innerHTML=bankBody();if(p)p.innerHTML=progHTML();document.querySelectorAll('.seg button').forEach(x=>x.classList.toggle('on',x.dataset.v===qs.view));const dd1=$('#dd-filter .dd-btn span'),dd2=$('#dd-tag .dd-btn span');if(dd1)dd1.textContent=(FILTERS.find(f=>f[0]===qs.filter)||FILTERS[0])[1];if(dd2)dd2.textContent=qs.tag==='all'?'All Tags':qs.tag;document.querySelectorAll('#dd-filter .dd-item').forEach(x=>x.classList.toggle('sel',x.textContent===(FILTERS.find(f=>f[0]===qs.filter)||[0,''])[1]));document.querySelectorAll('#dd-tag .dd-item').forEach(x=>x.classList.toggle('sel',x.textContent===(qs.tag==='all'?'All Tags':qs.tag)))};
function repaintCard(id){const q=QB.find(x=>x.id===id);const el=document.getElementById('qc-'+id);if(!q||!el)return null;const list=filtered();let n=list.findIndex(x=>x.id===id)+1;if(qs.view==='single')n=qs.idx+1;const wrap=document.createElement('div');wrap.innerHTML=cardHTML(q,n||1,qs.view==='single');el.replaceWith(wrap.firstElementChild);return document.getElementById('qc-'+id)}
window.qAnswer=function(id,i){const q=QB.find(x=>x.id===id);if(!q||S.ans[id])return;const ok=i===q.k;
 S.ans[id]={sel:i,ok,t:Date.now()};if(ok){qs.streak=0;S.ans[id].pr=PRAISE[Math.floor(Math.random()*PRAISE.length)];S.ans[id].msg=PRAISE2[Math.floor(Math.random()*PRAISE2.length)]}else{qs.streak++;DOCF[id]=qs.streak>=3?'encouraging':qs.streak===2?'angry':'sad'}save();
 const el=repaintCard(id);const p=$('#qbProg');if(p)p.innerHTML=progHTML();
 if(el){const r=el.querySelector('.qreact');if(ok){confetti(el);r&&r.insertAdjacentHTML('afterbegin','<span class="burst">'+(S.ans[id].pr||'Excellent!')+'</span>')}
  setTimeout(()=>{(el.querySelector('.qreact')||el).scrollIntoView({block:'nearest',behavior:'smooth'})},60)}};
window.qStep=function(d){qs.idx+=d;paintBank();const t=$('#qbBody');t&&t.scrollIntoView({block:'start',behavior:'smooth'})};
window.qSave=function(id){S.saved[id]?delete S.saved[id]:S.saved[id]=1;save();repaintCard(id);toast(S.saved[id]?'Saved':'Removed from saved',S.saved[id]?'happy':null);if(qs.filter==='bookmarked')paintBank()};
/* Report Error is switched off until the feature is ready (flag defined once, near the top of the main script): set REPORT_ERROR_ENABLED=true to bring back the button, the handler and the Reported-questions page. Existing S.rep data and backups are untouched. */
window.qReport=function(id){if(!REPORT_ERROR_ENABLED)return;S.rep[id]?delete S.rep[id]:S.rep[id]=1;save();repaintCard(id);toast(S.rep[id]?'Error reported — thank you':'Report removed')};
window.qNote=function(id){qs.noteOpen[id]=!qs.noteOpen[id];repaintCard(id);if(qs.noteOpen[id]){const t=document.querySelector('#qc-'+id+' textarea');t&&t.focus()}};
window.qNoteSave=function(id,v){v.trim()?S.notes[id]=v:delete S.notes[id];save()};

window.setView=function(v){qs.view=v;qs.idx=0;paintBank()};
window.qFull=function(){qs.full=!qs.full;const ph=$('.phone');ph&&ph.classList.toggle('qfull',qs.full);const b=$('#fsBtn');b&&(b.innerHTML=fsLabel());
 try{if(qs.full){const e=document.documentElement;(e.requestFullscreen||e.webkitRequestFullscreen||(()=>{})).call(e)}else if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document)}}catch(e){}
 renderFullExit()};
const fsIc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const fsLabel=()=>fsIc+(qs.full?'Exit Full Screen':'Full Screen');
function renderFullExit(){const ph=$('.phone');if(!ph)return;let b=ph.querySelector('.fs-exit');if(qs.full&&!b){b=document.createElement('button');b.className='fs-exit';b.type='button';b.textContent='✕ Exit full screen';b.onclick=()=>qFull();ph.appendChild(b)}else if(!qs.full&&b)b.remove()}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&qs.full){qs.full=false;const ph=$('.phone');ph&&ph.classList.remove('qfull');const b=$('#fsBtn');b&&(b.innerHTML=fsLabel());renderFullExit()}});

/* ---------- export PDF ---------- */
const exp={open:false,scope:'filtered',layout:'study'};
const SCOPES=()=>[['filtered',`Current filtered questions (${filtered().length})`],['topic',`Current topic (${inTopic().length})`],['subject',`Entire subject (${QB.length})`]];
const LAYOUTS=[['study','Study Mode · answer and explanation under each question'],['exam','Exam Mode · answer key and explanations at the end']];
function exportHTML(){return `<div class="xbk" onclick="xClose()"></div><div class="xsheet" role="dialog" aria-label="Export Questions to PDF"><div class="xhead"><h3>Export Questions to PDF</h3><button type="button" class="xclose" onclick="xClose()" aria-label="Close">✕</button></div><label>Export scope</label>${ddHTML('xscope',SCOPES(),exp.scope)}<label>PDF layout</label>${ddHTML('xlayout',LAYOUTS,exp.layout)}<button type="button" class="btn primary block" onclick="xCreate()">Create PDF</button><p class="xnote">A print-ready white document will open. Choose “Save as PDF” in the browser dialog.</p></div>`}
function paintExport(){const h=$('#xwrap');if(h)h.innerHTML=exportHTML()}
window.xOpen=function(){exp.open=true;let h=$('#xwrap');if(!h){h=document.createElement('div');h.id='xwrap';h.className='xwrap';($('.phone')||document.body).appendChild(h)}paintExport()};
window.xClose=function(){exp.open=false;qs.dd=null;const h=$('#xwrap');h&&h.remove()};
function pdfList(){return exp.scope==='subject'?QB:exp.scope==='topic'?inTopic():filtered()}
function buildPDF(list,layout){const L=(q,i)=>QLT(q,i);const title='Shbace Medical — Question Bank';const sub=`Pediatrics · ${qs.spec==='all'?'All specialties':SPEC_NAME[qs.spec]} · ${exp.scope==='subject'?'Entire subject':topicTitle()}`;
 const q1=(q,i)=>`<section class="q"><div class="meta">${q.id} · ${esc(TOPIC_NAME[q.topic])} · ${esc(q.tag)}</div><p class="stem"><b>Q${i+1}.</b> ${esc(QSTEM(q))}</p><ol type="A" style="list-style:none;padding-left:0">${q.o.map((t,j)=>`<li class="${layout==='study'&&j===q.k?'key':''}"><b>${L(q,j)}.</b> ${esc(t)}${layout==='study'&&j===q.k?' ✓':''}</li>`).join('')}</ol>${layout==='study'?`<div class="ans"><b>Correct answer: ${L(q,q.k)}. ${esc(q.o[q.k])}</b><p>${esc(q.ex)}</p></div>`:''}</section>`;
 let body=list.map(q1).join('');
 if(layout==='exam')body+=`<section class="keys"><h2>Answer key &amp; explanations</h2>${list.map((q,i)=>`<div class="k"><b>Q${i+1}. ${L(q,q.k)}. ${esc(q.o[q.k])}</b><p>${esc(q.ex)}</p></div>`).join('')}</section>`;
 if(!list.length)body='<p>No questions in this selection.</p>';
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>@page{margin:16mm}*{box-sizing:border-box}body{font:14px/1.55 Georgia,'Times New Roman',serif;color:#111;background:#DCE8F2;margin:0;padding:20px;max-width:800px;margin:0 auto}h1{font:700 22px/1.2 system-ui,sans-serif;margin:0 0 4px;color:#123a8f}.sub{font:13px system-ui,sans-serif;color:#555;margin:0 0 18px;padding-bottom:10px;border-bottom:2px solid #2b7bff}.q{break-inside:avoid;margin:0 0 18px}.meta{font:600 11px system-ui,sans-serif;color:#2b5fc2;letter-spacing:.04em}.stem{margin:4px 0 6px;font-size:15px}ol{margin:0;padding-left:26px}li{margin:2px 0}li.key{font-weight:700;color:#0a6b3a}.ans{margin-top:8px;padding:8px 10px;border-left:3px solid #2b7bff;background:#eef4ff;font-size:13px}.ans p{margin:3px 0 0}.keys{break-before:page}.keys h2{font:700 18px system-ui,sans-serif;color:#123a8f}.k{margin:0 0 10px;break-inside:avoid;font-size:13px}.k p{margin:2px 0 0;color:#333}.foot{font:11px system-ui,sans-serif;color:#777;margin-top:24px;text-align:center}</style><style id="doctor-mascot-tuning">
/* Subtle doctor-character polish; the supplied expressions and doctor-off preference remain intact. */
.drface{filter:drop-shadow(0 4px 7px rgba(0,0,0,.24));transform-origin:50% 92%}
.qreact .drface{animation:doctorReactIn .34s cubic-bezier(.2,.8,.2,1) both}
@keyframes doctorReactIn{0%{opacity:0;transform:translateY(5px) scale(.94)}100%{opacity:1;transform:translateY(0) scale(1)}}
@media(prefers-reduced-motion:reduce){.qreact .drface{animation:none}}
</style>
<style id="home-premium-visual-functional-v1">
/* Home: single blended medical hero background, no rectangular overlay artwork. */
.rs.h7{background:radial-gradient(ellipse at 82% 5%,rgba(0,112,255,.14),transparent 32%),radial-gradient(ellipse at 5% 45%,rgba(0,72,180,.12),transparent 38%),linear-gradient(180deg,rgba(2,10,29,.04),rgba(2,8,24,.16));}
.rs.h7:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.52;background-image:radial-gradient(circle at 12% 18%,rgba(45,190,255,.16) 0 1px,transparent 2px),radial-gradient(circle at 88% 40%,rgba(45,190,255,.13) 0 1px,transparent 2px),repeating-linear-gradient(120deg,transparent 0 38px,rgba(48,135,230,.035) 39px,transparent 40px 78px);}
.h7-greet{position:relative;isolation:isolate;overflow:hidden;min-height:150px;padding:24px 9px 20px;margin:0 -4px 12px;border-radius:20px;display:flex;flex-direction:column;justify-content:center;}
.h7-greet:before{content:"";position:absolute;z-index:-2;inset:-18px -8px;background-image:linear-gradient(90deg,rgba(2,10,30,.93) 0%,rgba(2,12,36,.72) 42%,rgba(2,12,36,.14) 100%),url("/assets/img/8c4bf2fdcaf9.webp");background-size:100% auto;background-repeat:no-repeat;background-position:center 42%;filter:saturate(1.08) contrast(1.04);mask-image:linear-gradient(180deg,transparent 0%,#000 12%,#000 84%,transparent 100%);}
.h7-greet:after{content:"";position:absolute;z-index:-1;inset:0;pointer-events:none;background:radial-gradient(ellipse at 83% 56%,rgba(0,132,255,.16),transparent 42%),linear-gradient(180deg,transparent 72%,rgba(3,13,36,.34));}
.h7-greet h1,.rs.h7 .h7-greet p{position:relative;z-index:1;text-shadow:0 2px 14px rgba(0,0,0,.55)}
.h7-greet h1{max-width:70%;}
.rs.h7 .h7-greet p{max-width:66%;}
/* Pediatrics card retains the original doctor/child hero asset; only the two CTAs are actionable. */
.h7-cont{cursor:default!important;}
.h7-pill{appearance:none;-webkit-appearance:none;cursor:pointer;white-space:nowrap;font:700 13px/1 inherit;}
.h7-go .h7-start-star{width:17px;height:17px;flex:none;margin-right:7px;color:#fff4c8;filter:drop-shadow(0 0 5px rgba(255,214,139,.34));}
.h7-pill:active,.h7-go:active,.h7-chipbtn:active{transform:translateY(1px) scale(.985);filter:brightness(1.09);}
/* The golden bulb is an isolated transparent asset, with a soft ground reflection. */
.h7-fact{align-items:stretch;gap:0;padding:13px 12px 13px 8px;min-height:0;}
.h7-bulb-wrap{position:relative;z-index:0;align-self:center;flex:0 0 clamp(58px,20vw,82px);width:clamp(58px,20vw,82px);min-width:0;display:flex;align-items:center;justify-content:center;isolation:isolate;}
.h7-bulb-wrap:before{content:"";position:absolute;z-index:-1;inset:10% -10%;border-radius:50%;background:radial-gradient(ellipse,rgba(255,181,48,.28),rgba(255,151,25,.12) 38%,transparent 72%);filter:blur(8px);}
.h7-bulb-wrap:after{content:"";position:absolute;z-index:-1;left:8%;right:8%;bottom:1%;height:13px;border-radius:50%;background:radial-gradient(ellipse,rgba(255,183,56,.52),rgba(255,170,35,.19) 45%,transparent 76%);filter:blur(5px);}
.h7-fact .h7-bulb{display:block;width:100%!important;height:auto;max-height:154px;object-fit:contain;filter:drop-shadow(0 0 7px rgba(255,189,63,.95)) drop-shadow(0 0 18px rgba(255,158,25,.5));animation:h7glow 5.8s ease-in-out infinite;}
.h7-fact .h7-div{margin:2px 10px 2px 8px;flex:0 0 1px;background:linear-gradient(transparent,rgba(130,170,240,.32),transparent);}
.h7-fact .h7-ft{flex:1;min-width:0;gap:7px;}
.h7-fhead{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap;margin:0 0 1px;}
.h7-fact .h7-fhead h3{padding:0!important;margin:0!important;font-size:clamp(16px,4.6vw,21px);line-height:1.15;}
.h7-fact .h7-date{position:static;flex:none;height:27px;padding:0 8px;font-size:11px;gap:4px;white-space:nowrap;}
.h7-fact .h7-date svg{width:14px;height:14px;}
.h7-facts{display:flex;flex-direction:column;gap:8px;min-width:0;}
.h7-daily-item{min-width:0;padding:5px 0 7px;}
.h7-daily-item+.h7-daily-item{border-top:1px solid rgba(91,151,232,.22);padding-top:9px;}
.h7-daily-kicker{font-size:9px;line-height:1.2;letter-spacing:.09em;text-transform:uppercase;color:#8ecbff;font-weight:800;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.h7-daily-item h4{margin:0 0 3px;color:#f3f8ff;font-size:clamp(12.5px,3.6vw,14px);font-weight:800;line-height:1.28;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.h7-daily-item p{margin:0;color:#cfe0fa;font-size:clamp(11.5px,3.25vw,13px);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.h7-daily-actions{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:5px;min-width:0;}
.h7-fact-source{min-width:0;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ffda91;font-size:10px;font-weight:650;text-decoration:none;border-bottom:1px dotted rgba(255,218,145,.55);}
.h7-fact-source:active{color:#fff0c8;}
.h7-fact .h7-readmore{height:28px;min-height:28px;padding:0 8px 0 10px;margin:0;font-size:11px;gap:4px;white-space:nowrap;border-color:rgba(77,152,255,.65);box-shadow:0 0 10px rgba(34,132,255,.16);}
.h7-fact .h7-readmore svg{width:12px;height:12px;}
/* Recent Activity on Home is a recent-topics preview; View All opens a Home overlay. */
.h7-rh .h7-chipbtn{flex:none;}
.h7-sheet{z-index:9999!important;}
.h7-pane{max-height:min(88%,780px);}
.h7-detail-category{display:inline-flex;margin:2px 0 8px;padding:4px 9px;border-radius:99px;border:1px solid rgba(63,154,255,.48);background:rgba(19,65,130,.34);color:#9edbff;font-size:11px;font-weight:750;}
.h7-detail-title{font-size:19px!important;line-height:1.3;margin:0 0 9px!important;color:#eaf5ff;}
.h7-detail-pearl{margin:15px 0;padding:13px 14px;border-radius:13px;border-left:3px solid #36cfff;background:rgba(43,151,255,.10);color:#e9f5ff;display:grid;gap:5px;font-size:14px;line-height:1.5;}
.h7-detail-pearl b,.h7-detail-sources>b{font-size:11px;color:#70dfff;letter-spacing:.08em;text-transform:uppercase;}
.h7-detail-sources{display:grid;gap:8px;margin-top:15px;padding-top:12px;border-top:1px solid rgba(106,159,232,.24);}
.h7-detail-source{color:#ffda91;font-size:13px;text-decoration:none;overflow-wrap:anywhere;}
.h7-recent-intro{margin:0 0 12px;color:#a9c3ee;font-size:13px;}
.h7-recent-list{display:grid;gap:8px;}
.h7-recent-entry{width:100%;display:flex;align-items:center;gap:9px;text-align:left;padding:11px 10px;border-radius:14px;border:1px solid rgba(69,137,226,.3);background:linear-gradient(110deg,rgba(11,39,88,.83),rgba(5,21,51,.82));color:#f4f8ff;min-height:62px;}
.h7-recent-entry:active{background:linear-gradient(110deg,rgba(17,69,144,.9),rgba(5,30,73,.9));border-color:rgba(40,202,255,.72);}
.h7-recent-icon{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:10px;background:rgba(28,125,255,.17);color:#85d8ff;}
.h7-recent-icon svg{width:28px;height:28px;}
.h7-recent-label{min-width:0;flex:1;display:grid;gap:2px;}
.h7-recent-label b{font-size:13px;line-height:1.25;}
.h7-recent-label small{font-size:12px;color:#a9c3ee;line-height:1.3;}
.h7-recent-time{font-size:10px;color:#91afd8;white-space:nowrap;}
.h7-recent-arrow{color:#8bcfff;display:flex;}
.h7-recent-arrow svg{width:15px;height:15px;}
.h7-recent-empty{padding:24px 15px;border:1px dashed rgba(91,151,232,.38);border-radius:14px;color:#a9c3ee;text-align:center;font-size:13px;line-height:1.5;}
/* Remove Android/WebView's square tap flash while retaining our deliberate active glow. */
.h7 button,.h7 a,.h7-recent-sheet button{-webkit-tap-highlight-color:transparent;}
.h7 button:focus:not(:focus-visible),.h7 a:focus:not(:focus-visible){outline:none;}
@media(max-width:390px){
 .h7-greet{min-height:136px;padding-top:17px;padding-bottom:15px;}
 .h7-fact{padding-left:6px;padding-right:9px;}
 .h7-fact .h7-div{margin-left:6px;margin-right:8px;}
 .h7-bulb-wrap{flex-basis:58px;width:58px;}
 .h7-fact .h7-date{font-size:10px;height:25px;}
 .h7-daily-actions{gap:4px;}
 .h7-fact-source{font-size:9px;max-width:57%;}
 .h7-fact .h7-readmore{font-size:10px;padding:0 7px;}
}
@media(min-width:600px){.h7-greet{min-height:176px;padding-left:16px;}.h7-greet h1{max-width:62%;}.rs.h7 .h7-greet p{max-width:58%;}.h7-bulb-wrap{flex-basis:98px;width:98px;}.h7-fact .h7-div{margin-left:14px;margin-right:16px;}.h7-daily-item p{-webkit-line-clamp:3;}}
</style>
<style id="requested-behavior-polish-v1">
/* Daily Medical Fact: headline first, one active fact, original full artwork preserved. */
.h7-fact{display:flex;flex-direction:column;align-items:stretch;gap:12px;}
.h7-fact .h7-bulb-wrap{display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;flex:none;overflow:visible;}
.h7-fact .h7-bulb{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;max-height:190px!important;aspect-ratio:3/2;object-fit:contain!important;object-position:center!important;filter:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;}
.h7-fact .h7-ft{min-width:0;width:100%;display:flex;flex-direction:column;gap:7px;}
.h7-fact .h7-fhead{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.h7-fact .h7-fhead h3{margin:0!important;padding:0!important;}
.h7-daily-item{min-width:0;width:100%;}
.h7-daily-item h4{margin:0 0 7px!important;color:#f4f8ff;font-size:16px;font-weight:850;line-height:1.28;}
.h7-daily-text{margin:0!important;color:#d2e2fa;font-size:13px;line-height:1.55;white-space:normal;overflow-wrap:anywhere;}
.h7-daily-text.collapsed{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}
.h7-daily-sources{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px;padding-top:8px;border-top:1px solid rgba(105,158,232,.2);}
.h7-daily-sources[hidden]{display:none!important;}
.h7-readmore{align-self:flex-start;margin:7px 0 0!important;min-height:30px;padding:4px 10px!important;font-size:11px!important;}
.h7-fact-source{display:inline-flex;max-width:100%;font-size:11px;color:#ffd68b;overflow-wrap:anywhere;text-decoration:underline;text-decoration-color:rgba(255,214,139,.5);text-underline-offset:3px;}
.h7-daily-kicker{display:none!important;}
/* Recent list: compact rows with predictable icon and text dimensions on small screens. */
.h7-recent-sheet .h7-pane{width:min(100%,520px);max-height:88%;}
.h7-recent-list{display:grid;gap:8px;}
.h7-recent-entry{display:grid;grid-template-columns:34px minmax(0,1fr) auto 16px;align-items:center;gap:9px;min-height:58px;padding:9px 10px;width:100%;max-width:100%;box-sizing:border-box;}
.h7-recent-icon{width:32px;height:32px;}
.h7-recent-icon svg{width:22px;height:22px;max-width:22px;max-height:22px;}
.h7-recent-label{min-width:0;overflow:hidden;}
.h7-recent-label b,.h7-recent-label small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.h7-recent-time{font-size:10px;white-space:nowrap;}
/* Pinned screen is separate from Home Recent Activity. */
@media(max-width:360px){.h7-recent-entry{grid-template-columns:30px minmax(0,1fr) auto 14px;gap:7px;padding:8px;}.h7-recent-icon{width:29px;height:29px;}}
</style>
<style id="splash-onboarding-premium-v4">
/* Splash neon heart: separate layer, no dark shadow/halo; the neon ECG now passes IN FRONT of the heart. */
#startupSplash .sp-frame .sp-ecg{z-index:3;}
#startupSplash .sp-frame .sp-beat{z-index:1;filter:none;animation:spBeat .833s cubic-bezier(.3,.1,.3,1) infinite;}
/* The heart is a distinct image layer; keep an intentional breathing gap from the doctor's arms. */
#startupSplash .sp-frame .sp-beat{pointer-events:none;}
@media(prefers-reduced-motion:reduce){#startupSplash .sp-frame .sp-beat{animation:none!important;}}

/* Onboarding completion: real SVG route + grade state; the selectedGrade data flow is unchanged. */
.jr-finish-layout{display:flex;flex-direction:column;flex:1;min-height:0;justify-content:flex-start;align-items:stretch;padding:0 1px;}
.jr-finish-kicker{margin:4px 0 0!important;text-align:center;font-size:10px;letter-spacing:.2em;color:#69cfff!important;text-shadow:0 0 13px rgba(32,150,255,.28);}
.jr-scene-wrap{width:100%;max-width:370px;height:clamp(220px,36vh,292px);flex:none;align-self:center;display:flex;align-items:center;justify-content:center;margin:0 auto -1px;position:relative;}
.jr-scene.jr-mountain-scene{width:100%;height:100%;max-height:100%;display:block;margin:0;overflow:visible;mask-image:none;-webkit-mask-image:none;}
.jr-mountain-scene .jr-star{fill:#9bdcff;filter:drop-shadow(0 0 3px #2c9fff);animation:jrTw 3.6s ease-in-out infinite;}
.jr-mountain-scene .jr-star:nth-child(2n){animation-delay:-1.2s}.jr-mountain-scene .jr-star:nth-child(3n){animation-delay:-2.2s}
.jr-route-shadow{fill:none;stroke:#0a2852;stroke-width:13;stroke-linecap:round;stroke-linejoin:round;opacity:.66;}
.jr-route-base{fill:none;stroke:#183d70;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55));}
.jr-route-progress{fill:none;stroke:url(#jrRoad);stroke-width:7;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(27,154,255,.9));transition:stroke-dasharray .7s ease;}
.jr-route-current{fill:none;stroke:url(#jrGoldRoad);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;opacity:.96;filter:drop-shadow(0 0 4px rgba(255,187,51,.85));}
.jr-platform-halo{fill:rgba(24,153,255,.15);filter:blur(3px);}
.jr-platform-base{fill:#071a37;stroke:#277ed2;stroke-width:1.2;}
.jr-platform-top{fill:#0e3470;stroke:#53baff;stroke-width:1.1;}
.jr-node-disc{stroke:rgba(185,224,255,.75);stroke-width:1.1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));}
.jr-node-edge{fill:none;stroke:rgba(160,220,255,.42);stroke-width:.8;}
.jr-node-number{font-size:12px;font-weight:900;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));}
.jr-node--completed .jr-platform-halo{fill:rgba(20,157,255,.34);}.jr-node--completed .jr-node-disc{fill:url(#jrBlueNode);}
.jr-node--completed .jr-platform-base{stroke:#31aaff;filter:drop-shadow(0 0 7px rgba(25,145,255,.45));}
.jr-node--current .jr-platform-halo{fill:rgba(255,187,55,.46);filter:blur(5px);}
.jr-node--current .jr-platform-base{stroke:#ffd36b;fill:#33240d;filter:drop-shadow(0 0 7px rgba(255,178,40,.52));}
.jr-node--current .jr-platform-top{fill:#684010;stroke:#ffe29b;}
.jr-node--current .jr-node-disc{fill:url(#jrGoldNode);stroke:#fff0bd;stroke-width:1.6;filter:url(#jrGoldGlowFilter);}
.jr-node--upcoming{opacity:.65;}
.jr-node--upcoming .jr-platform-base{stroke:#315378;}
.jr-node--upcoming .jr-platform-top{fill:#142944;stroke:#436589;}
.jr-complete-check circle{fill:#13cda6;stroke:#c6fff0;stroke-width:1.15;filter:drop-shadow(0 0 5px rgba(42,255,207,.75));}
.jr-complete-check path{fill:none;stroke:#DCE8F2;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.jr-current-pin circle:first-child{fill:rgba(255,196,69,.2);stroke:#ffd779;stroke-width:1.2;}
.jr-current-pin path{fill:#f7b832;stroke:#fff0be;stroke-width:.7;}
.jr-current-pin circle:last-child{fill:#fff4c8;}
.jr-current-pulse{fill:none;stroke:#ffd36b;stroke-width:1.2;opacity:.7;transform-box:fill-box;transform-origin:center;animation:jrCurrentPulse 2s ease-out infinite;}
.jr-graduation-cap{opacity:.98;}
.jr-summit-label{font-size:6px;letter-spacing:1.1px;font-weight:850;fill:#c6e7ff;filter:drop-shadow(0 0 5px #178fff);}
.jr-welcome{text-align:center;display:flex;align-items:center;flex-direction:column;gap:3px;margin:0 0 4px;}
.jr-welcome .hero-title{font-size:clamp(23px,6.2vw,29px)!important;line-height:1.02;margin:1px 0 3px!important;letter-spacing:-.045em;}
.jr-future-text{background:linear-gradient(100deg,#eaf7ff 4%,#64d7ff 42%,#a4e6ff 68%,#eaf7ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;}
.jr-welcome .hero-sub{font-size:11px;margin:0!important;color:#b7d6eb!important;}
.jr-grade-badge{display:inline-flex;align-items:center;justify-content:center;gap:6px;margin-top:4px;padding:5px 12px;border-radius:999px;border:1px solid rgba(81,179,255,.66);background:linear-gradient(145deg,rgba(12,53,105,.9),rgba(5,22,54,.92));box-shadow:0 0 13px rgba(35,149,255,.22),inset 0 1px 0 rgba(220,242,255,.14);color:#e5f5ff;font-size:10px;font-weight:850;letter-spacing:.08em;}
.jr-cap-mini{color:#ffc95c;font-size:12px;}
.jr-finish-foot{padding-top:9px!important;}
.jr-finish-foot .primary-btn{min-height:46px;box-shadow:0 7px 22px rgba(20,116,255,.24),inset 0 1px 0 rgba(167,221,245,.16);}
@keyframes jrCurrentPulse{0%{transform:scale(.82);opacity:.78}100%{transform:scale(1.75);opacity:0}}
@media(max-height:700px){.jr-scene-wrap{height:clamp(190px,31vh,230px)}.jr-finish-kicker{margin-top:0!important}.jr-welcome .hero-title{font-size:23px!important}.jr-finish-foot{padding-top:5px!important;}}
@media(max-width:350px){.jr-scene-wrap{height:clamp(200px,33vh,248px)}.jr-finish-kicker{font-size:9px;letter-spacing:.15em}.jr-welcome .hero-title{font-size:22px!important}.jr-welcome .hero-sub{font-size:10px;}}
@media(min-width:600px){.jr-scene-wrap{height:min(40vh,330px);max-width:410px}.jr-welcome .hero-title{font-size:30px!important;}}
@media(prefers-reduced-motion:reduce){.jr-mountain-scene .jr-star,.jr-current-pulse{animation:none!important;}.jr-route-progress{transition:none!important;}}
</style>
</head><body><h1>${esc(title)}</h1><p class="sub">${esc(sub)} · ${list.length} question${list.length===1?'':'s'} · ${layout==='study'?'Study mode':'Exam mode'}</p>${body}<p class="foot">Shbace Medical · Learn. Practice. Excel.</p></body></html>`}
function printHTML(html){if(window.ShbaceNative&&window.ShbaceNative.printHtml){try{if(window.ShbaceNative.printHtml(String(html)))return true}catch(e){}}let w=null;try{w=window.open('','_blank')}catch(e){}
 if(w&&w.document){w.document.open();w.document.write(html);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch(e){}},450);return true}
 const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';document.body.appendChild(f);f.onload=()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){}};f.srcdoc=html;setTimeout(()=>f.remove(),120000);return true}
window.xCreate=function(){const list=pdfList();window.__lastPDF=buildPDF(list,exp.layout);printHTML(window.__lastPDF);xClose()};

/* ---------- question bank view ---------- */
questionBankView=function(){
 const sp=qs.spec==='all'?'All specialties':SPEC_NAME[qs.spec];
 return `${appHeader('Question bank')}<div class="rs qb"><h1>Question Bank</h1><p class="sub">Pediatrics · ${esc(sp)} · ${esc(topicTitle())}</p>
 <div class="qtools"><button type="button" class="btn" id="fsBtn" onclick="qFull()">${fsLabel()}</button><button type="button" class="btn" onclick="xOpen()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>Export PDF</button></div>
 <div class="qfilters">${ddHTML('filter',FILTERS,qs.filter)}${ddHTML('tag',[['all','All Tags'],...TAGS.map(t=>[t,t])],qs.tag)}</div>
 <div class="seg" role="tablist"><button type="button" data-v="single" class="${qs.view==='single'?'on':''}" onclick="setView('single')">Single</button><button type="button" data-v="all" class="${qs.view==='all'?'on':''}" onclick="setView('all')">All</button></div>
 <div id="qbProg">${progHTML()}</div><div id="qbBody">${bankBody()}</div></div>`};

/* ============================================================
   SUBJECTS / SPECIALTIES / TOPICS / SEARCH
   ============================================================ */
const specProg=id=>{const l=QB.filter(q=>q.spec===id);return pct(answeredCount(l),l.length)};
window.openSpec=function(id){qs.spec=id;qs.topic=0;appPage='topics';renderAppDemo()};
window.openTopic=function(spec,id){qs.spec=spec;qs.topic=id;qs.filter='all';qs.tag='all';qs.idx=0;appPage='questions';renderAppDemo()};
/* Pediatrics hero image. Override with window.SHBACE_PEDIA_HERO = 'path/or/url.webp' before this script to swap the asset. */
const PEDIA_HERO_SRC=window.SHBACE_PEDIA_HERO||'/assets/img/9fbea08e77d0.webp';
window.startPractice=function(ev){ev&&ev.stopPropagation();const un=QB.some(q=>!S.ans[q.id]);qs.spec='all';qs.topic=0;qs.tag='all';qs.filter=un?'unanswered':'all';qs.idx=0;appPage='questions';renderAppDemo()};
subjectsView=function(){const n=answeredCount(QB),all=pct(n,QB.length);
 return `${appHeader('Subjects')}<div class="rs"><h1>Subjects</h1><p class="sub">Choose a subject to practise.</p>
 <div class="card hero-ped" role="button" tabindex="0" aria-label="Pediatrics, ${QB.length} questions, ${all}% completed" onclick="appPage='specialties';renderAppDemo()" onkeydown="if(event.key==='Enter')appPage='specialties',renderAppDemo()"><img class="hp-img" src="${PEDIA_HERO_SRC}" alt="A male pediatrician in a white coat with a stethoscope smiling at a happy child holding a teddy bear" width="1100" height="516"><div class="hp-ov"><div class="eyebrow">SUBJECT</div><h3>Pediatrics</h3><div class="hp-q">${QB.length} questions</div></div>
  <div class="hp-foot"><div><div class="hp-pr"><span>${n} answered</span><b>${all}%</b></div><div class="bar"><span style="width:${all}%"></span></div></div><button type="button" class="btn primary" onclick="startPractice(event)">Start practice</button></div></div>
 <div class="card sc soon"><div class="sic">🩺</div><div><h3>More subjects</h3><div class="meta">Content is in development</div></div></div></div>`};
specialtiesView=function(){const av=gradeHasPediatrics()?SYS.filter(s=>s[3]):[],soon=gradeHasPediatrics()?SYS.filter(s=>!s[3]):[];
 return `${appHeader('Pediatrics')}<div class="rs"><h1>Pediatrics</h1><p class="sub">${av.length} specialties · ${gradeHasPediatrics()?REAL.total:0} questions</p>
 ${av.map(([id,l,img])=>{const s=REAL.spec[id]||{q:0,topics:[]};const p=specProg(id);return `<div class="card sc spc" onclick="openSpec('${id}')">${sysIcon(img,'lg')}<div class="spc-tx"><h3>${l}</h3><div class="meta">${s.q} questions · ${s.topics.length} topics</div><div class="bar"><span style="width:${p}%"></span></div></div><span class="chev">›</span></div>`}).join('')}
 ${soon.length?`<div class="soon-h">Coming soon</div><div class="soon-grid">${soon.map(([id,l,img])=>`<div class="soon-t">${sysIcon(img,'md')}<span>${l}</span></div>`).join('')}</div>`:''}</div>`};
const TOPIC_ICON_ASSET = {"respiratory|Asthma":"/assets/img/debd90e0fef6.webp","respiratory|Bronchiolitis, Croup & Stridor":"/assets/img/3d3feb82a064.webp","respiratory|Pneumonia":"/assets/img/adada4e0a86b.webp","respiratory|Cystic Fibrosis & Chronic Lung Disease":"/assets/img/cec184976243.webp","respiratory|Ear, Nose & Throat Infections":"/assets/img/4537b905a2d5.webp","respiratory|Foreign Body, Pneumothorax & Bronchoscopy":"/assets/img/b8ec11cc647c.webp","respiratory|Other / Mixed Questions":"/assets/img/491b78033ad8.webp","respiratory|Pertussis & Respiratory Infections":"/assets/img/a2d9c069ec03.webp","cardio|Tetralogy of Fallot":"/assets/img/3c095677ec87.webp","cardio|Infective Endocarditis":"/assets/img/84b4a909231d.webp","cardio|Cyanosis & Congenital Heart Disease (General)":"/assets/img/7c067d04bf4a.webp","cardio|Septal Defects & Patent Ductus Arteriosus":"/assets/img/564bedab668b.webp","cardio|Heart Failure":"/assets/img/aec9ca7eeabf.webp","cardio|Acute Rheumatic Fever":"/assets/img/f8940761f879.webp","cardio|Arrhythmias (Supraventricular Tachycardia, Wolff-Parkinson-White & Heart Block)":"/assets/img/77ffc9f10573.webp","cardio|Coarctation of the Aorta":"/assets/img/3fcc3c3b707a.webp","cardio|Innocent Murmurs & Cardiac Examination":"/assets/img/1daa68d32a37.webp","cardio|Transposition of the Great Arteries":"/assets/img/d4b8afc82331.webp","cardio|Myocarditis":"/assets/img/be6caf82b381.webp","git|Diarrhoea & Dehydration":"/assets/img/8267de0d1eb4.webp","git|Reflux, Vomiting & Pyloric Stenosis":"/assets/img/5161208444fa.webp","git|Coeliac Disease & Malabsorption":"/assets/img/74b97b9f8b81.webp","git|Constipation, Hirschsprung & Soiling":"/assets/img/4eafe7974238.webp","git|Intussusception & Acute Abdomen":"/assets/img/20f136574e30.webp","git|Inflammatory Bowel Disease":"/assets/img/f7f21a832364.webp","git|Liver Disease & Jaundice":"/assets/img/3e3fa001e012.webp","git|Other / Mixed Questions":"/assets/img/2ad0e3a8dd0a.webp","git|Gastrointestinal Bleeding & Foreign Bodies":"/assets/img/3aafd14fb97c.webp","nephrology|Urinary Tract Infection & Vesicoureteral Reflux":"/assets/img/6e50c70b32a8.webp","nephrology|Nephrotic Syndrome":"/assets/img/c92f00f20778.webp","nephrology|Glomerulonephritis (Post-Streptococcal, IgA & Others)":"/assets/img/a83234a60e79.webp","nephrology|Chronic Kidney Disease, Dialysis & Transplantation":"/assets/img/f991564871d8.webp","nephrology|Hemolytic Uremic Syndrome":"/assets/img/1ca5570ba411.webp","nephrology|Henoch-Schönlein Purpura":"/assets/img/10b94c932ac8.webp","nephrology|Tubular Disorders & Hereditary/Cystic Kidney Diseases":"/assets/img/b31e5d360df6.webp","nephrology|Hypertension in Children":"/assets/img/6dd6f38cdc11.webp","nephrology|Acute Kidney Injury, Fluids & Electrolytes":"/assets/img/86d16539a9ea.webp","nephrology|Renal & Abdominal Masses":"/assets/img/3590165c8b32.webp","nephrology|Voiding Disorders & Enuresis":"/assets/img/11d9f88ea3cd.webp","nephrology|Renal Basics, Urinalysis, Hematuria & Proteinuria":"/assets/img/0dcc03900570.webp","nephrology|Other / Mixed Questions":"/assets/img/652001211733.webp","endocrinology|Adrenal Disorders (CAH, Addison Disease & Cushing Syndrome)":"/assets/img/e88887f3e9ef.webp","endocrinology|Short Stature & Growth Disorders":"/assets/img/3997690bc1b2.webp","endocrinology|Diabetes Mellitus":"/assets/img/e0b1cda2fad7.webp","endocrinology|Puberty & Gonadal Disorders":"/assets/img/4bec0149cb36.webp","endocrinology|Diabetic Ketoacidosis & Hyperosmolar State":"/assets/img/a5463bacb96a.webp","endocrinology|Congenital Hypothyroidism & Cretinism":"/assets/img/19a6b685eaf2.webp","endocrinology|Hypoglycemia & Infant of Diabetic Mother":"/assets/img/7031c18331cf.webp","endocrinology|Posterior Pituitary: DI, SIADH & Vasopressin":"/assets/img/1d6134bdcef3.webp","endocrinology|Pituitary Disorders & Growth Hormone":"/assets/img/734e566d7dfc.webp","endocrinology|Hyperthyroidism (Graves Disease)":"/assets/img/852f9489a92d.webp","endocrinology|Thyroid Physiology & Function Tests":"/assets/img/73310ab50c36.webp","endocrinology|Calcium & Parathyroid Disorders":"/assets/img/459bdf1d7541.webp","endocrinology|Acquired Hypothyroidism, Thyroiditis, Goiter & Iodine Deficiency":"/assets/img/e9d5a26be138.webp","endocrinology|Other / Mixed Questions":"/assets/img/b760e2ed29ac.webp","cns|Meningitis & Encephalitis":"/assets/img/6ef3ea1c149b.webp","cns|Neuromuscular Disorders":"/assets/img/8105c9dff833.webp","cns|Epilepsy & Seizures":"/assets/img/8f6de7612180.webp","cns|Hydrocephalus & Neural Tube Defects":"/assets/img/a9666d0b7cf1.webp","cns|Other / Mixed Questions":"/assets/img/5b361303adc2.webp","cns|Autism, Attention-Deficit Hyperactivity Disorder & Developmental Delay":"/assets/img/fc43a3ade184.webp","cns|Headache, Ataxia, Stroke & Tumours":"/assets/img/9947c202f0f1.webp","cns|Febrile Seizures":"/assets/img/73a529842f55.webp","cns|Cerebral Palsy":"/assets/img/610793712610.webp","cns|Head Size & Craniosynostosis":"/assets/img/1f6a6e45780b.webp","neonatology|Newborn Examination & Normal Care":"/assets/img/117dd2cc6f5f.webp","neonatology|Prematurity & Respiratory Distress":"/assets/img/be3f2b9a3bc9.webp","neonatology|Birth Asphyxia, Resuscitation & Apgar":"/assets/img/81d8aef7b2d7.webp","neonatology|Neonatal Jaundice":"/assets/img/e9cd39caf56f.webp","neonatology|Neonatal Sepsis & Congenital Infections":"/assets/img/783207f29794.webp","neonatology|Other / Mixed Questions":"/assets/img/1ebdd733ecd6.webp","neonatology|Vitamin K & Neonatal Bleeding":"/assets/img/d25c6ac79069.webp","neonatology|Neonatal Gastrointestinal & Surgical Conditions":"/assets/img/6718bfdfd030.webp","neonatology|Neonatal Seizures & Intracranial Haemorrhage":"/assets/img/65c9f5ece122.webp","neonatology|Neonatal Metabolic Problems & Infants of Diabetic Mothers":"/assets/img/e4c4f9ff99de.webp","infectious|Exanthems & Viral Infections":"/assets/img/f32d58a1f147.webp","infectious|Vaccination & Immunisation":"/assets/img/777f0034278a.webp","infectious|Malaria & Parasitic Infections":"/assets/img/87f1928e27e9.webp","infectious|Fever, Sepsis & Bacterial Infections":"/assets/img/e0a5e7749061.webp","infectious|Human Immunodeficiency Virus (HIV)":"/assets/img/97df3fca2c76.webp","infectious|Tuberculosis":"/assets/img/6a45d0f9735a.webp","infectious|Other / Mixed Questions":"/assets/img/38301a5d0941.webp","infectious|Diarrhoea & Gastrointestinal Infections":"/assets/img/fbff0a69c0bd.webp","haematology|Bleeding Disorders":"/assets/img/fbae16a40475.webp","haematology|Haemolytic Anaemias":"/assets/img/41168e3fbda9.webp","haematology|Iron Deficiency & Nutritional Anaemia":"/assets/img/f5aefafed33e.webp","haematology|Leukaemia & Childhood Cancers":"/assets/img/e9efcb2a8c7d.webp","haematology|Transfusion & Other Blood Disorders":"/assets/img/5b2bd7013d31.webp","haematology|Other / Mixed Questions":"/assets/img/09d508d09239.webp","haematology|Aplastic Anaemia & Marrow Failure":"/assets/img/c2f5db19ca4e.webp","growth|Vitamins & Minerals":"/assets/img/67a070a02b53.webp","growth|Breastfeeding & Infant Feeding":"/assets/img/c5473526d238.webp","growth|Protein-Energy Malnutrition":"/assets/img/14a1bc2232ea.webp","growth|Other / Mixed Questions":"/assets/img/98b1e84a6187.webp","growth|Obesity":"/assets/img/5d41a0d2631e.webp","genetics|Other / Mixed Questions":"/assets/img/af025797053a.webp","genetics|Chromosomal Disorders":"/assets/img/fcd865173c09.webp","genetics|Inheritance & Single-Gene Disorders":"/assets/img/fc35ac2367e2.webp","genetics|Skin Disorders":"/assets/img/24ead7ae42d3.webp","rheum|Arthritis, Lupus, Kawasaki Disease & Vasculitis":"/assets/img/5afa6e92cea5.webp","rheum|Poisoning":"/assets/img/fe9392f0badd.webp","rheum|Other / Mixed Questions":"/assets/img/116d17e0a9ed.webp","rheum|Immunodeficiency & Allergy":"/assets/img/79063dbb6872.webp","rheum|Inborn Errors of Metabolism":"/assets/img/23438945e9a5.webp"};
function topicIcon(sp,n,id){
 const src=TOPIC_ICON_ASSET[sp+'|'+n];
 return src
  ? `<div class="tno ti"><img src="${src}" alt="${esc(n)}" width="176" height="176" loading="lazy" decoding="async"></div>`
  : `<div class="tno">${String(id).padStart(2,'0')}</div>`;
}

function topicCards(){const sp=REAL.spec[qs.spec]||{topics:[]};
 let lastSy=null;return sp.topics.map(([id,n,c,sy])=>{const l=QB.filter(q=>q.topic===id);const done=answeredCount(l);const p=pct(done,l.length);let hd='';if(sy&&sy!==lastSy){lastSy=sy;hd=`<div class="soon-h">${esc(sy)}</div>`}return hd+`<div class="card sc tpc" onclick="openTopic('${qs.spec}',${id})">${topicIcon(qs.spec,n,id)}<div class="tpc-tx"><h3>${esc(n)}</h3><div class="meta">${c} questions${done?` · ${done} answered`:''}</div><div class="bar"><span style="width:${p}%"></span></div></div><span class="chev">›</span></div>`}).join('')}
topicsView=function(){const sp=REAL.spec[qs.spec]||{q:0,topics:[]};
 return `${appHeader(SPEC_NAME[qs.spec]||'Topics')}<div class="rs"><h1>${SPEC_NAME[qs.spec]||'Topics'}</h1><p class="sub">${sp.topics.length} topics · ${sp.q} questions</p>
 <button type="button" class="btn primary block allq" onclick="openTopic('${qs.spec}',0)">All questions →</button><div id="topicList">${topicCards()}</div></div>`};
let gq='',gSpec='all',gTag='all',gSrc='all',gTopic='all',gSys='all',gSort='bank',gLim=40,gIdx=null,gTmr=null;
/* ---- Unit 2: search engine (display/query only; question data is never modified) ---- */
const AR_MARKS='\\u064B-\\u065F\\u0670\\u0640';
const nz=s=>String(s==null?'':s).toLowerCase().replace(new RegExp('['+AR_MARKS+']','g'),'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
const gEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const AR_CLS={'ا':'[اأإآٱ]','ي':'[يى]','ه':'[هة]'};
function tokRe(tok){const w=tok.filter(x=>x.length>1).map(nz);if(!w.length)return null;
 const alt=w.map(t=>/[؀-ۿ]/.test(t)?[...t].map(c=>(AR_CLS[c]||gEsc(c))+'['+AR_MARKS+']*').join(''):gEsc(t));
 return new RegExp('('+alt.join('|')+')','ig')}
function hl(t,tok){t=String(t==null?'':t);const re=tokRe(tok);if(!re)return esc(t);return t.split(re).map((p,i)=>i%2?'<mark>'+esc(p)+'</mark>':esc(p)).join('')}
const gSrcGroup=s=>String(s||'').replace(/\s*[–—-]\s*Q\s*\d+\s*$/i,'').trim()||'Unknown source';
function gIndex(){if(!gIdx)gIdx=QB.map(q=>{const nq=nz(q.q),no=nz(q.o.join(' \n')),ne=nz(q.ex||''),ns=nz(q.src||''),nt=nz(TOPIC_NAME[q.topic]||''),ny=nz((q.sy||'')+' '+(SPEC_NAME[q.spec]||q.spec)),ng=nz(q.id+' '+q.tag);
 return {q,sg:gSrcGroup(q.src),nq,no,ne,ns,nt,ny,ng,hay:[ng,nq,no,ne,ns,nt,ny].join(' \n')}});return gIdx}
function gSources(){const m={};gIndex().forEach(x=>m[x.sg]=(m[x.sg]||0)+1);return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function gSystems(){const m={};QB.forEach(q=>{if(q.sy)m[q.sy]=(m[q.sy]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
const gPYKEY=()=>Object.keys(REAL.spec).find(k=>/^Previous Years/.test(REAL.spec[k].label||''))||null;
const gNeedle=()=>nz(gq.trim()).split(/\s+/).filter(Boolean);
const gRawTok=()=>gq.trim().toLowerCase().split(/\s+/).filter(Boolean);
const gFilterOn=()=>gTag!=='all'||gSrc!=='all'||gTopic!=='all'||gSys!=='all';
const gAnyOn=()=>gFilterOn()||gSpec!=='all'||!!gq.trim();
function gFields(x,n){const has=s=>n.some(w=>s.includes(w)),r=[];
 if(has(x.nq))r.push('Question');if(has(x.no))r.push('Options');if(has(x.ne))r.push('Explanation');if(has(x.ns))r.push('Source');if(has(x.nt))r.push('Topic');if(has(x.ny))r.push('System');if(has(x.ng))r.push('ID / Tag');return r}
function gScore(x,n){let s=0;n.forEach(w=>{if(x.nq.includes(w))s+=4;if(x.no.includes(w))s+=3;if(x.nt.includes(w))s+=2;if(x.ne.includes(w))s+=1;if(x.ns.includes(w))s+=.5});return s}
function gSnip(t,tok,len){len=len||170;t=String(t==null?'':t);const re=tokRe(tok);let p=-1;if(re){const m=new RegExp(re.source,'i').exec(t);if(m)p=m.index}
 const s=Math.max(0,p-50);return (s?'…':'')+t.slice(s,s+len)+(s+len<t.length?'…':'')}
function topicRow(sid,id,n,c,sy){const l=QB.filter(q=>q.topic===id),d=answeredCount(l),p=pct(d,l.length);return `<div class="card sc tpc" role="button" tabindex="0" onclick="openTopic('${sid}',${id})">${topicIcon(sid,n,id)}<div class="tpc-tx"><div class="eyebrow">${esc(SPEC_NAME[sid]||sid)}</div><h3>${GQ_TOK?hl(n,GQ_TOK):esc(n)}</h3><div class="meta">${l.length} questions${d?` · ${d} answered`:''}</div><div class="bar"><span style="width:${p}%"></span></div></div><span class="chev">›</span></div>`}
let GQ_TOK=null;
function gCard(x,n,tok){const q=x.q,f=tok.length?gFields(x,n):[];
 let prev;
 if(!tok.length||x.nq&&n.some(w=>x.nq.includes(w))||!tok.length)prev=hl(tok.length?gSnip(q.q,tok,200):(q.q.length>200?q.q.slice(0,198)+'…':q.q),tok);
 else prev=hl(q.q.length>200?q.q.slice(0,198)+'…':q.q,tok);
 let ev='';
 if(tok.length){const oi=q.o.findIndex(o=>n.some(w=>nz(o).includes(w)));
  if(oi>=0&&!n.some(w=>x.nq.includes(w)))ev=`<div class="gmatch"><b>Option ${esc(QLT(q,oi))}</b>: ${hl(gSnip(q.o[oi],tok),tok)}</div>`;
  else if(n.some(w=>x.ne.includes(w))&&!n.some(w=>x.nq.includes(w)))ev=`<div class="gmatch"><b>Explanation</b>: ${hl(gSnip(q.ex||'',tok),tok)}</div>`;
  else if(n.some(w=>x.ns.includes(w))&&!n.some(w=>x.nq.includes(w)))ev=`<div class="gmatch"><b>Source</b>: ${hl(gSnip(q.src||'',tok),tok)}</div>`}
 const a=S.ans[q.id];
 return `<div class="card sc gq" role="button" tabindex="0" data-qid="${esc(q.id)}" onclick="openQ('${q.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openQ('${q.id}')}"><div class="eyebrow">${esc(q.id)} · ${esc(q.sy||SPEC_NAME[q.spec]||q.spec)}</div><h3>${prev}</h3>${ev}${f.length?`<div class="gmf">${f.map(t=>`<span>${t}</span>`).join('')}</div>`:''}<div class="meta">${esc(TOPIC_NAME[q.topic]||'')} · ${esc(q.tag)} · ${esc(x.sg)}${a?' · '+(a.ok?'answered ✓':'answered ✕'):''}${qUnsure(q)?' · ⚠ needs review':''}</div></div>`}
function searchResults(){const n=gNeedle(),tok=gRawTok();GQ_TOK=tok.length?tok:null;
 const specs=Object.entries(REAL.spec).filter(([s])=>gSpec==='all'||s===gSpec);
 if(!n.length&&!gFilterOn()){
  const rows=specs.map(([sid,sp])=>{let t=sp.topics.map(([id,nm,c,sy])=>[id,nm,QB.filter(q=>q.topic===id).length,sy]);
   if(gSort==='az')t.sort((a,b)=>a[1].localeCompare(b[1]));else if(gSort==='size')t.sort((a,b)=>b[2]-a[2]);else if(gSort==='progress')t.sort((a,b)=>pct(answeredCount(QB.filter(q=>q.topic===a[0])),a[2])-pct(answeredCount(QB.filter(q=>q.topic===b[0])),b[2]));
   return `<div class="soon-h">${esc(SPEC_NAME[sid]||sp.label||sid)} · ${t.length} topics</div>`+t.map(([id,nm,c,sy])=>topicRow(sid,id,nm,c,sy)).join('')}).join('');
  return rows||'<div class="card setcard"><p class="meta">No topics.</p></div>'}
 const tops=(n.length&&!gFilterOn())?specs.flatMap(([sid,sp])=>sp.topics.filter(([id,nm,c,sy])=>n.every(w=>nz(nm+' '+(SPEC_NAME[sid]||'')+' '+(sy||'')).includes(w))).map(([id,nm,c,sy])=>[sid,id,nm,c,sy])):[];
 let qs2=gIndex().filter(x=>(gSpec==='all'||x.q.spec===gSpec)&&(gTag==='all'||x.q.tag===gTag)&&(gSrc==='all'||x.sg===gSrc)&&(gTopic==='all'||String(x.q.topic)===gTopic)&&(gSys==='all'||x.q.sy===gSys)&&n.every(w=>x.hay.includes(w)));
 if(n.length)qs2=qs2.map((x,i)=>[x,gScore(x,n),i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]).map(a=>a[0]);
 if(!tops.length&&!qs2.length)return `<div class="card setcard" style="text-align:center">${docFace('thinking','dr-top')}<h3>No results${tok.length?` for “${esc(gq.trim())}”`:''}</h3><p class="meta">Check the spelling, use fewer words, or remove some filters.</p><button type="button" class="btn block" onclick="gClear()">Clear search and filters</button></div>`;
 let out=`<div class="qreact think">${docFace('investigating')}<div><b>${tok.length?'Investigating…':'Filtered'}</b><span>${tops.length?tops.length+' topic'+(tops.length===1?'':'s')+' · ':''}${qs2.length} question${qs2.length===1?'':'s'} found</span></div></div>`;
 if(tops.length)out+=`<div class="soon-h">Topics · ${tops.length}</div>`+tops.map(([sid,id,nm,c,sy])=>topicRow(sid,id,nm,c,sy)).join('');
 if(qs2.length){const shown=qs2.slice(0,gLim);out+=`<div class="soon-h">Questions · ${qs2.length}</div>`+shown.map(x=>gCard(x,n,tok)).join('')+(qs2.length>gLim?`<button type="button" class="btn block" onclick="gMore()">Show more (${qs2.length-gLim} left)</button>`:'')}
 return out}
window.gMore=function(){gLim+=40;const e=$('#gResults');e&&(e.innerHTML=searchResults())};
window.gClear=function(){gq='';gSpec='all';gTag='all';gSrc='all';gTopic='all';gSys='all';gLim=40;renderAppDemo();const i=$('#gSearch');i&&i.focus()};
window.gSet=function(k,v){if(k==='spec'){gSpec=v;gTopic='all'}else if(k==='tag')gTag=v;else if(k==='src')gSrc=v;else if(k==='topic')gTopic=v;else if(k==='sys')gSys=v;else gSort=v;gLim=40;renderAppDemo()};
runSearch=function(v){gq=v;gLim=40;const c=$('#gX');if(c)c.hidden=!v;clearTimeout(gTmr);gTmr=setTimeout(()=>{const e=$('#gResults');if(e)e.innerHTML=searchResults();const k=$('#gClr');if(k)k.hidden=!gAnyOn()},v?120:0)};
window.openQ=function(id){const q=QB.find(x=>x.id===id);if(!q)return;if(typeof recordRecent==='function')recordRecent('topic',q.spec,q.topic);qs.spec=q.spec;qs.topic=q.topic;qs.filter='all';qs.tag='all';appPage='questions';qs.idx=Math.max(0,filtered().findIndex(x=>x.id===id));renderAppDemo();
 if(qs.view!=='single')setTimeout(()=>{const el=document.getElementById('qc-'+id);if(el){el.scrollIntoView({block:'start'});el.classList.add('flash')}},80)};
searchView=function(){const chip=(k,v,l,cur)=>`<button type="button" class="chip${cur===v?' on':''}" onclick="gSet('${k}','${v}')">${esc(l)}</button>`;
 const sel=(k,cur,all,opts,lab)=>`<label class="gsel"><span>${lab}</span><select class="field" onchange="gSet('${k}',this.value)" aria-label="${lab}"><option value="all"${cur==='all'?' selected':''}>${all}</option>${opts.map(([v,t])=>`<option value="${esc(v)}"${String(cur)===String(v)?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
 const topicOpts=gSpec==='all'?[]:(REAL.spec[gSpec]?REAL.spec[gSpec].topics.map(([id,nm,c,sy])=>[String(id),nm+(sy?' · '+sy:'')+' ('+c+')']):[]);
 const showSys=(gSpec==='all'||gSpec===gPYKEY())&&gSystems().length>0;
 return `${appHeader('Search')}<div class="rs"><h1>Search &amp; topics</h1><p class="sub">Find topics and questions — in the question, options, explanation, source, system and tags.</p>
 <div class="sbox"><input class="field" id="gSearch" type="search" placeholder="Search questions, options, explanations…" value="${esc(gq)}" oninput="runSearch(this.value)" autocomplete="off" aria-label="Search"><button type="button" id="gX" class="sx" aria-label="Clear search" ${gq?'':'hidden'} onclick="gClear()">✕</button></div>
 <div class="chips fscroll" aria-label="Specialty filter">${chip('spec','all','All specialties',gSpec)}${Object.keys(REAL.spec).map(s=>chip('spec',s,SPEC_NAME[s]||s,gSpec)).join('')}</div>
 <div class="chips fscroll" aria-label="Tag filter">${chip('tag','all','All tags',gTag)}${FULL_TAGS.map(t=>chip('tag',t,t,gTag)).join('')}</div>
 <div class="gfil">${sel('src',gSrc,'All sources',gSources().map(([v,c])=>[v,v+' ('+c+')']),'Source')}${gSpec!=='all'?sel('topic',gTopic,'All topics',topicOpts,'Topic'):''}${showSys?sel('sys',gSys,'All systems',gSystems().map(([v,c])=>[v,v+' ('+c+')']),'System (exams)'):''}</div>
 <button type="button" id="gClr" class="btn gclr" ${gAnyOn()?'':'hidden'} onclick="gClear()">✕ Clear search &amp; filters</button>
 ${!gq.trim()&&!gFilterOn()?`<div class="seg wide" style="margin:4px 0 6px">${[['bank','Bank order'],['az','A–Z'],['size','Largest'],['progress','Progress']].map(([v,l])=>`<button type="button" class="${gSort===v?'on':''}" onclick="gSet('sort','${v}')">${l}</button>`).join('')}</div>`:''}
 <div id="gResults">${searchResults()}</div></div>`};

/* ============================================================
   SMART REVIEW v3 — topic-based smart tutor
   -----------------------------------------------------------
   * Own store: localStorage "shbace_sr3_v1" (included automatically in the app backup because it is shbace_-prefixed).
   * The question bank (QB) is shared READ-ONLY. Smart Review memory is keyed by the permanent question id (never by text).
   * Question Bank answers (S.ans), Quiz attempts and Saved questions NEVER feed this memory, and nothing here writes to them.
   * Legacy v2 data (S.sr / S.srm) is left untouched as an archive; only reviews that really happened (n>0) are migrated.
   ============================================================ */
const DAY=864e5,MIN=6e4,SR_MAX=120*DAY,SR_HMAX=100;
const _o=x=>x&&typeof x==='object'&&!Array.isArray(x);
const dkey=t=>{const d=new Date(t==null?Date.now():t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dStart=t=>{const d=new Date(t==null?Date.now():t);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()};
const dNext=t=>{const d=new Date(t==null?Date.now():t);return new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime()};
const dayStart=()=>dStart();
const qmap=new Map(QB.map(q=>[q.id,q]));
const SR3KEY='shbace_sr3_v1';
const SR_LV=[['new','New'],['learning','Learning'],['reviewing','Reviewing'],['known','Known'],['mastered','Mastered']];
const SR_LV_COL={new:'#7b8da3',learning:'#ffb454',reviewing:'#4da3ff',known:'#35cf82',mastered:'#b58cff'};
const SR_LV_W={new:0,learning:.25,reviewing:.55,known:.8,mastered:1};
const SR_LV_RANK={new:0,learning:1,reviewing:2,known:3,mastered:4};
const SR_RATE=['Again','Hard','Good','Easy'];
const SR_RATE_COL=['#ff8c8c','#ffb454','#4da3ff','#35cf82'];
const SR_HT=['review','retry','drill','postpone','resched','skip','suspend','restore'];
const SR_ST_COL={'Not Started':'#7b8da3','Learning':'#ffb454','Improving':'#4da3ff','Strong':'#35cf82','Mastered':'#b58cff'};

/* ---------- static topic index (derived from the bank; nothing is copied or stored) ---------- */
const SRT=[],SRT_BY=new Map(),SRT_Q=new Map();
Object.keys(REAL.spec).forEach(sk=>{const sp=REAL.spec[sk];(sp.topics||[]).forEach(t=>{const o={id:t[0],name:t[1],sy:t[3]||'',spec:sk,specLabel:sp.label||SPEC_NAME[sk]||sk,key:sk+'|'+(t[3]||'')+'|'+t[1]};SRT.push(o);SRT_BY.set(o.id,o);SRT_Q.set(o.id,[])})});
QB.forEach(q=>{const a=SRT_Q.get(q.topic);if(a)a.push(q)});

/* ---------- store: load / normalise / save ---------- */
function srBlankRec(now){return{n:0,ok:0,streak:0,lapses:0,wc:0,ease:2.3,iv:0,rl:false,sus:false,due:now||Date.now(),added:now||Date.now(),last:0,pp:0,sk:0,h:[]}}
function srNorm(r){
 if(!_o(r))return null;
 const num=(k,d,lo,hi)=>{r[k]=Number.isFinite(r[k])?Math.min(hi,Math.max(lo,r[k])):d};
 num('n',0,0,1e6);num('ok',0,0,1e6);num('streak',0,0,1e3);num('lapses',0,0,1e6);num('wc',0,0,1e6);num('ease',2.3,1.3,3);num('iv',0,0,SR_MAX);num('pp',0,0,1e6);num('sk',0,0,1e6);
 num('due',Date.now(),0,1e15);num('added',r.due,0,1e15);num('last',0,0,1e15);
 r.rl=!!r.rl;r.sus=!!r.sus;
 r.h=(Array.isArray(r.h)?r.h:[]).filter(x=>_o(x)&&Number.isFinite(x.t)&&SR_HT.includes(x.type)).slice(-SR_HMAX);
 return r}
let SR3=(()=>{
 const b={v:3,q:{},ses:[],days:{},goal:20,size:15,spd:[],sess:null,seen:{},last:null,mig:null};
 const d=LS.get(SR3KEY,null);if(!_o(d))return b;
 const o=Object.assign(b,d);o.v=3;
 if(!_o(o.q))o.q={};Object.keys(o.q).forEach(id=>{if(!srNorm(o.q[id]))delete o.q[id]});
 if(!Array.isArray(o.ses))o.ses=[];o.ses=o.ses.filter(x=>_o(x)&&Number.isFinite(x.t)).slice(0,60);
 if(!_o(o.days))o.days={};
 o.spd=(Array.isArray(o.spd)?o.spd:[]).filter(Number.isFinite).slice(-40);
 if(!_o(o.seen))o.seen={};
 o.goal=Number.isFinite(o.goal)?Math.min(200,Math.max(1,Math.round(o.goal))):20;
 o.size=[10,15,20].includes(o.size)?o.size:15;
 if(o.sess&&!(_o(o.sess)&&Array.isArray(o.sess.queue)&&Array.isArray(o.sess.plan)&&_o(o.sess.first)&&_o(o.sess.rt)&&Array.isArray(o.sess.att)))o.sess=null;
 if(!_o(o.last))o.last=null;
 return o})();
let srCache=null,srSaveFail=false;
function srSave(){srCache=null;
 try{localStorage.setItem(SR3KEY,JSON.stringify(SR3));srSaveFail=false;return true}
 catch(e){if(!srSaveFail){srSaveFail=true;try{toast('Could not save Smart Review progress (storage is full)')}catch(_){}}return false}}
window.__sr3=()=>SR3; /* read-only handle used by the self-tests */
window.__sr3x=()=>({SRT,SRT_Q,QB,qmap,srTopicStats,srTotals,srLevel,srIsWeak,srPickTopic,srSpeedRef,srCompose,srCalc,srAutoGrade,dueList,srPool});

/* ---------- one-time, idempotent migration of REAL v2 reviews (never imports Question Bank history) ---------- */
function sr3Migrate(){
 let n=0,a2=0,ch=0;const L=_o(S.sr)?S.sr:{},now=Date.now();
 Object.keys(L).forEach(id=>{const r=L[id];if(!_o(r)||SR3.q[id]||!qmap.has(id))return;let rec=null;
  if(r.v===2){if(!(r.n>0))return; /* added with the old diamond but never reviewed: NOT a review, not imported */
   rec=srNorm(Object.assign(srBlankRec(now),{n:r.n,ok:r.ok,streak:r.streak,lapses:r.lapses,ease:r.ease,iv:r.iv,rl:r.rl,due:r.due,added:r.added,last:r.last,pp:r.pp,sk:r.sk,h:Array.isArray(r.h)?r.h.map(x=>Object.assign({},x)):[]}))}
  else{const st=Number.isInteger(r.stage)&&r.stage>0?r.stage:0;if(!st&&!Number.isFinite(r.last))return;
   rec=srNorm(Object.assign(srBlankRec(now),{n:Math.max(st,1),ok:st,streak:st,iv:st>0?[1,3,7,14,30,60][Math.min(st-1,5)]*DAY:0,due:r.due,added:r.added,last:r.last}))}
  if(rec){rec.mig=1;SR3.q[id]=rec;n++}});
 const M=_o(S.srm)?S.srm:null;
 if(M){
  Object.keys(_o(M.days)?M.days:{}).forEach(k=>{if(!SR3.days[k]&&_o(M.days[k])){SR3.days[k]={n:+M.days[k].n||0,ok:+M.days[k].ok||0,ms:+M.days[k].ms||0,nw:0,dr:0};ch++}});
  if(!SR3.mig&&Number.isFinite(M.goal)){SR3.goal=Math.min(200,Math.max(1,Math.round(M.goal)));ch++}
  const have=new Set(SR3.ses.map(s=>s.id));
  (Array.isArray(M.ses)?M.ses:[]).forEach(s=>{if(_o(s)&&s.id&&!have.has(s.id)&&Number.isFinite(s.t)){SR3.ses.push({id:s.id,t:s.t,end:s.end||s.t,n:+s.n||0,ok:+s.ok||0,ms:+s.ms||0,label:s.label||'Session',mode:'legacy',g:Array.isArray(s.g)?s.g.slice(0,4):[0,0,0,0],legacy:1});ch++}});
  Object.keys(_o(M.arch)?M.arch:{}).forEach(id=>{const a=M.arch[id];if(!_o(a)||SR3.q[id]||!qmap.has(id)||!(a.n>0))return;
   const rec=srNorm(Object.assign(srBlankRec(now),{n:a.n,ok:a.ok,lapses:a.lapses,ease:a.ease,iv:DAY,due:now,sus:true,h:Array.isArray(a.h)?a.h:[]}));rec.mig=1;SR3.q[id]=rec;a2++})}
 if(n||a2||ch){SR3.ses.sort((x,y)=>y.t-x.t);SR3.ses=SR3.ses.slice(0,60);SR3.mig={at:now,n,a:a2};srSave()}}
sr3Migrate();

/* ---------- derived per-question facts ---------- */
const rvs=r=>r.h.filter(x=>x.type==='review');
const srRecentLapses=(r,k)=>rvs(r).slice(-(k||5)).filter(x=>!x.ok||x.g===0).length;
function srLevel(r){if(!r||!r.n)return 'new';const s=r.streak||0,iv=r.iv||0;
 if(s>=5&&iv>=30*DAY&&!srRecentLapses(r,4)&&!r.rl)return 'mastered';
 if(s>=3&&iv>=10*DAY)return 'known';
 if(s>=2&&iv>=3*DAY)return 'reviewing';
 return 'learning'}
function srIsWeak(r){if(!r||!(r.n>0)||r.sus)return false;const v=rvs(r),last=v[v.length-1];
 return !!r.rl||(last&&(!last.ok||last.g===0))||srRecentLapses(r,5)>=2||(r.ease||2.3)<1.8}
function srDiff(r){const v=rvs(r).slice(-8);if(v.length<2)return{s:null,l:'Unrated'};
 const w=v.filter(x=>!x.ok).length/v.length,sl=v.filter(x=>x.sp==='slow').length/v.length;
 const s=Math.round(100*(.55*w+.2*sl+.25*(1-((r.ease||2.3)-1.3)/1.7)));return{s,l:s<30?'Easy':s<60?'Medium':'Hard'}}
const srList=()=>Object.keys(SR3.q).map(id=>({q:qmap.get(id),r:SR3.q[id]})).filter(x=>x.q&&!x.r.sus).sort((a,b)=>a.r.due-b.r.due);
const dueList=()=>{const now=Date.now();return srList().filter(x=>x.r.due<=now)};

/* ---------- speed model: median of the last 20 valid correct answers (scheduled first attempts only) ---------- */
function srSpeedRef(){
 const a=SR3.spd.slice(-20),n=a.length;let fast=20000,slow=45000,med=null;
 if(n>=1){const s=a.slice().sort((x,y)=>x-y);med=n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2}
 if(n>=10){const w=Math.min(1,(n-9)/11); /* 10 samples = first blend, 20 = fully personal */
  fast=(1-w)*20000+w*Math.min(40000,Math.max(6000,.6*med));
  slow=(1-w)*45000+w*Math.min(100000,Math.max(25000,1.5*med))}
 return{fast,slow,n,med,personal:n>=10}}
function srAutoGrade(r,ok,ms,vt){
 if(!ok)return{g:0,speed:'wrong',why:'Incorrect answer — it returns tomorrow.'};
 if(!vt)return{g:2,speed:'unknown',why:'Correct (time was not measured).'};
 const ref=srSpeedRef(),t=Math.min(ms,120000),sp=t<ref.fast?'fast':t>ref.slow?'slow':'normal';
 if(sp==='slow')return{g:1,speed:'slow',why:'Correct, but slower than your usual pace.'};
 if(sp==='fast'){
  const earned=!!r&&r.n>=2&&(r.streak||0)>=2&&!r.rl&&srRecentLapses(r,5)===0&&(r.lapses||0)<2;
  return earned?{g:3,speed:'fast',why:'Correct, fast, and this question has a solid record.'}:{g:2,speed:'fast',why:'Quick — but this question has not proven itself yet.'}}
 return{g:2,speed:'normal',why:'Correct at a normal pace.'}}

/* ---------- scheduling (Ease Factor 2.3, streak, intervals; adapted to automatic grading) ---------- */
function srCalc(r,g,now){now=now||Date.now();
 let ease=r.ease||2.3;const base=r.iv||0;let ns=r.streak||0,rl=!!r.rl;
 const lapR=srRecentLapses(r,5)+(g===0?1:0),early=r.due>dNext(now);let nIv=base,due;
 if(g===0){ /* Again: reduced interval is remembered, but the question simply returns tomorrow */
  ease=Math.max(1.3,ease-.2);ns=0;rl=true;const f=lapR>=3?.15:lapR===2?.25:.35;
  nIv=base>0?Math.max(DAY,Math.round(base*f/DAY)*DAY):DAY;due=dNext(now)}
 else{const lapF=1-.07*Math.min(lapR,4);
  if(g===1){ /* Hard: always shorter than Good */
   ease=Math.max(1.3,ease-.15);
   nIv=rl?DAY:base<DAY?12*36e5:Math.max(DAY,Math.round(base*1.2/DAY)*DAY)}
  else if(g===2){ /* Good: the normal interval */
   nIv=rl?Math.max(2*DAY,base):base<DAY?DAY:base*Math.max(1.5,ease*lapF);
   if(!rl&&ns===1&&lapR<2)nIv=Math.max(nIv,3*DAY)}
  else{ /* Easy: longer, only reachable with a good record (or by manual choice) */
   nIv=rl?Math.max(3*DAY,base*1.3):base<DAY?4*DAY:Math.max(base*ease*1.3*lapF,base+2*DAY);ease=Math.min(3,ease+.1)}
  if(g>=2){if(early)nIv=base+(nIv-base)*.5;else ns++}
  rl=false;if(nIv>=DAY)nIv=Math.round(nIv/DAY)*DAY;
  if(g>=2&&!early&&base>=DAY)nIv=Math.max(nIv,base+DAY);
  nIv=Math.min(SR_MAX,Math.max(nIv,12*36e5));due=now+nIv}
 return{due,iv:nIv,ease,streak:ns,rl}}
function srLog(r,e){r.h.push(Object.assign({t:Date.now()},e));
 if(r.h.length>SR_HMAX){let i=r.h.findIndex(x=>x.type!=='review');
  while(r.h.length>SR_HMAX){if(i>=0&&i<r.h.length-1){r.h.splice(i,1);i=r.h.findIndex(x=>x.type!=='review')}else r.h.shift()}}}
function srApplyReview(r,g,info,now){now=now||Date.now();
 const c=srCalc(r,g,now),from=r.due;
 r.n=(r.n||0)+1;if(info.ok)r.ok=(r.ok||0)+1;if(!info.ok||g===0)r.lapses=(r.lapses||0)+1;if(!info.ok)r.wc=(r.wc||0)+1;
 r.ease=c.ease;r.iv=c.iv;r.streak=c.streak;r.rl=c.rl;r.due=c.due;r.last=now;
 srLog(r,{t:now,type:'review',sel:info.sel,ok:!!info.ok,ms:Math.min(info.ms||0,6e5),vt:!!info.vt,g,ag:info.ag,man:!!info.man,sp:info.sp||'',from,to:c.due,iv:c.iv,e:+c.ease.toFixed(2)});
 return c}
const ivTxt=ms=>ms<3600000?Math.max(1,Math.round(ms/60000))+' min':ms<DAY?Math.round(ms/3600000)+' h':Math.round(ms/DAY)+' d';
function srRetTxt(due,now){now=now||Date.now();const d=due-now;if(d<=0)return 'now';if(dStart(due)===dNext(now))return 'tomorrow';if(d<DAY)return 'in '+ivTxt(d);const n=Math.max(1,Math.round(d/DAY));return 'in '+n+' day'+(n>1?'s':'')}
function srDueTxt(t){const now=Date.now();if(t<=now){const n=Math.round((dStart(now)-dStart(t))/DAY);return n>0?n+' day'+(n>1?'s':'')+' overdue':'Due now'}
 const n=Math.round((dStart(t)-dStart(now))/DAY);const tm=new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
 if(n===0)return 'Today '+tm;if(n===1)return 'Tomorrow';return new Date(t).toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}
function srAgo(t){if(!t)return 'Never';const d=Math.round((dStart()-dStart(t))/DAY);return d<=0?'Today':d===1?'Yesterday':d+' days ago'}
function srDayStat(ok,ms,wasNew,drill){const k=dkey(),d=SR3.days[k]||(SR3.days[k]={n:0,ok:0,ms:0,nw:0,dr:0});
 if(drill)d.dr=(d.dr||0)+1;else{d.n++;if(ok)d.ok++;d.ms+=Math.min(ms||0,3e5);if(wasNew)d.nw=(d.nw||0)+1}
 const ks=Object.keys(SR3.days).sort();while(ks.length>120)delete SR3.days[ks.shift()]}

/* ---------- topic analytics (computed from real question records — never from answer percentage alone) ---------- */
function srStatus(e){if(!e.rev)return 'Not Started';
 if(e.pct>=85&&e.fresh<=Math.ceil(e.tot*.1)&&!e.weak)return 'Mastered';
 if(e.pct>=65)return 'Strong';if(e.pct>=35)return 'Improving';return 'Learning'}
function srTopicStats(){const now=Date.now();if(srCache&&now-srCache.t<20000)return srCache.m;
 const M=new Map(),t0=dStart(now);
 SRT.forEach(t=>M.set(t.id,{t,id:t.id,tot:0,sus:0,fresh:0,rev:0,due:0,od:0,weak:0,lv:{new:0,learning:0,reviewing:0,known:0,mastered:0},credit:0,last:0,ok:0,n:0,next:0}));
 QB.forEach(q=>{const e=M.get(q.topic);if(!e)return;const r=SR3.q[q.id];
  if(r&&r.sus){e.sus++;return}
  e.tot++;if(!r||!r.n){e.fresh++;e.lv.new++;return}
  e.rev++;const lv=srLevel(r);e.lv[lv]++;const wk=srIsWeak(r);if(wk)e.weak++;
  let c=SR_LV_W[lv]*(wk?.6:1);
  if(r.due<=now){e.due++;if(r.due<t0)e.od++;const late=Math.min(1.6,(now-r.due)/Math.max(DAY,r.iv||DAY));c*=Math.max(.6,1-.25*late)}
  else if(!e.next||r.due<e.next)e.next=r.due;
  e.credit+=c;if(r.last>e.last)e.last=r.last;
  const v=rvs(r).slice(-6);e.n+=v.length;e.ok+=v.filter(x=>x.ok).length});
 M.forEach(e=>{e.pct=e.tot?Math.round(100*e.credit/e.tot):0;e.status=srStatus(e)});
 srCache={t:now,m:M};return M}
function srTotals(){const M=srTopicStats(),o={tot:0,fresh:0,rev:0,due:0,od:0,weak:0,credit:0,lv:{new:0,learning:0,reviewing:0,known:0,mastered:0},topics:0,started:0};
 M.forEach(e=>{o.tot+=e.tot;o.fresh+=e.fresh;o.rev+=e.rev;o.due+=e.due;o.od+=e.od;o.weak+=e.weak;o.credit+=e.credit;o.topics++;if(e.rev)o.started++;for(const k in e.lv)o.lv[k]+=e.lv[k]});
 o.pct=o.tot?Math.round(100*o.credit/o.tot):0;
 const d=SR3.days[dkey()]||{n:0,ok:0,ms:0,nw:0,dr:0};o.today=d.n;o.todayOk=d.ok;o.todayNew=d.nw||0;
 const now=Date.now(),t1=dNext(now);o.dueToday=0;o.upcoming=0;o.week=0;
 Object.keys(SR3.q).forEach(id=>{const r=SR3.q[id];if(r.sus||!qmap.has(id))return;if(r.due<t1)o.dueToday++;else{o.upcoming++;if(r.due<t1+6*DAY+36e5)o.week++}});
 return o}
function srRingCol(p,started){if(!started)return '#4b5d73';
 const st=[[0,[255,140,107]],[35,[255,180,84]],[65,[77,163,255]],[85,[53,207,130]],[100,[181,140,255]]];
 p=Math.max(0,Math.min(100,p));for(let i=1;i<st.length;i++){if(p<=st[i][0]){const a=st[i-1],b=st[i],f=(p-a[0])/(b[0]-a[0]||1);
  return 'rgb('+[0,1,2].map(k=>Math.round(a[1][k]+(b[1][k]-a[1][k])*f)).join(',')+')'}}
 return 'rgb(181,140,255)'}

/* ---------- Smart Pick ---------- */
function srPickTopic(){const M=srTopicStats(),now=Date.now();let best=null;
 M.forEach(e=>{if(!e.tot||!(e.due+e.weak+e.fresh))return;
  const stale=e.rev&&e.last?Math.min(30,(now-e.last)/DAY)/30:0;
  const s=.30*Math.min(1,e.due/20)+.08*Math.min(1,e.od/10)+.22*Math.min(1,e.weak/12)+.15*(1-e.pct/100)*(e.rev?1:.6)+.10*stale+.10*Math.min(1,e.fresh/20);
  e.s=s;if(!best||s>best.s)best=e});
 if(!best)return null;
 const lines=[];if(best.due)lines.push([best.due+(best.due===1?' Question Due':' Questions Due'),'due']);
 if(best.weak)lines.push([best.weak+(best.weak===1?' Weak Question':' Weak Questions'),'weak']);
 if(best.fresh&&(lines.length<2||!best.rev))lines.push([best.fresh+(best.fresh===1?' New Question':' New Questions'),'new']);
 if(best.rev&&best.last&&lines.length<3)lines.push(['Last reviewed '+srAgo(best.last).toLowerCase(),'time']);
 const prio=best.s>=.45?'High Priority for Improvement':best.s>=.25?'Recommended Next':best.rev?'Good Place to Continue':'Good Place to Start';
 return{e:best,s:best.s,lines,prio,hi:best.s>=.45}}

/* ---------- automatic question selection (nothing is added by hand) ---------- */
function srPool(topic){const qs=topic==null?QB:(SRT_Q.get(topic)||[]),now=Date.now(),due=[],weak=[],fresh=[];
 qs.forEach(q=>{const r=SR3.q[q.id];if(!r||!r.n){if(!(r&&r.sus))fresh.push(q);return}if(r.sus)return;
  const wk=srIsWeak(r);
  if(r.due<=now){const late=Math.min(3,Math.max(0,(now-r.due)/Math.max(DAY,r.iv||DAY)));
   due.push({q,r,s:1+late*.6+Math.min(3,r.lapses||0)*.35+(wk?.5:0)+(r.rl?.3:0)})}
  else if(wk)weak.push({q,r,s:(r.lapses||0)*.3+(r.rl?.5:0)+Math.min(1,(r.wc||0)*.1)})});
 due.sort((a,b)=>b.s-a.s||a.r.due-b.r.due);weak.sort((a,b)=>b.s-a.s||a.r.due-b.r.due);
 return{due,weak,fresh}}
function srPickCapped(list,take,cap){
 if(!cap)return list.slice(0,take);
 const out=[],cnt={};for(const x of list){if(out.length>=take)break;const t=x.q.topic;if((cnt[t]||0)>=cap)continue;cnt[t]=(cnt[t]||0)+1;out.push(x)}
 if(out.length<take){const have=new Set(out);for(const x of list){if(out.length>=take)break;if(!have.has(x))out.push(x)}}
 return out}
function srPickNew(fresh,take,all){
 if(!all)return fresh.slice(0,take);
 const M=srTopicStats(),by=new Map();fresh.forEach(q=>{if(!by.has(q.topic))by.set(q.topic,[]);by.get(q.topic).push(q)});
 const order=[...by.keys()].sort((a,b)=>{const ea=M.get(a),eb=M.get(b),sa=ea&&ea.rev?0:1,sb=eb&&eb.rev?0:1;return sa-sb||((ea?ea.pct:0)-(eb?eb.pct:0))});
 const out=[];let i=0;while(out.length<take&&order.length){const t=order[i%order.length],arr=by.get(t);out.push(arr.shift());if(!arr.length){order.splice(i%order.length,1);if(i>0)i--}else i++}
 return out}
function srInterleave(a,b){const n=a.length+b.length,out=[];let ai=0,bi=0;
 for(let i=0;i<n;i++){const wantNew=bi<b.length&&(ai>=a.length||(bi+.5)/b.length<=(i+.5)/n);out.push(wantNew?b[bi++]:a[ai++])}
 return out}
function srSpread(arr){for(let i=1;i<arr.length;i++){if(arr[i].topic===arr[i-1].topic){let j=i+1;while(j<arr.length&&arr[j].topic===arr[i].topic)j++;if(j<arr.length){const t=arr[i];arr[i]=arr[j];arr[j]=t}}}return arr}
function srCompose(topic,size){
 const P=srPool(topic),all=topic==null,rev=P.due.concat(P.weak);let selR,selN;
 if(!rev.length){selR=[];selN=srPickNew(P.fresh,size,all)}
 else{ /* reviews first; new questions capped at ~30% of the session while enough reviews exist, otherwise they fill the remaining slots */
  const R=rev.length,target=Math.min(size,Math.max(Math.min(10,size),Math.floor(R/.7))); /* new questions stay <=30% unless needed to reach the 10-question minimum */
  const cap=Math.floor(target*.3),nNew0=Math.min(P.fresh.length,cap),takeR=Math.min(R,target-nNew0);
  selR=srPickCapped(rev,takeR,all?Math.ceil(size*.4):0);
  selN=srPickNew(P.fresh,Math.min(P.fresh.length,target-selR.length),all)}
 let seq=srInterleave(selR.map(x=>x.q),selN);if(all)seq=srSpread(seq);
 return seq.map(q=>q.id)}

/* ---------- session state ---------- */
let srTab='topics',srRun=false,SU={qid:null},SRSUM=null,SRX={open:null,lim:{}},SRH={lim:10,open:null},SRUI={filter:'all',q:'',open:{},rings:{},celebrated:null};
let srFaceIx={};
function srSid(){return 's'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36)}
function srM0(ids){const M=srTopicStats(),m={};ids.forEach(id=>{const q=qmap.get(id);if(q&&!m[q.topic]){const e=M.get(q.topic);if(e)m[q.topic]={p:e.pct,s:e.status}}});return m}
function srNewSession(o){
 if(SR3.sess&&Object.keys(SR3.sess.first).length)srFinish(true); /* never lose a half-finished session */
 SR3.sess=Object.assign({sid:srSid(),start:Date.now(),mode:'topic',topic:null,label:'Review',plan:[],queue:[],first:{},rt:{},att:[],n0:0,m0:{},cur:null},o);
 SR3.sess.n0=SR3.sess.plan.length;SR3.sess.queue=SR3.sess.plan.slice();SR3.sess.m0=srM0(SR3.sess.plan);
 SU={qid:null};SRSUM=null;srRun=true;srTab='topics';srSave();renderAppDemo();
 requestAnimationFrame(()=>{const sc=document.getElementById('phoneContent');if(sc)sc.scrollTop=0})}
window.srStart=function(topic){topic=(topic==null||topic==='')?null:Number(topic);
 const ids=srCompose(topic,SR3.size);if(!ids.length){toast(topic==null?'No questions are available right now':'No questions are available in this topic');return}
 srNewSession({mode:topic==null?'all':'topic',topic,label:topic==null?'All Topics':(SRT_BY.get(topic)||{}).name||'Topic',plan:ids})};
window.srPickStart=function(){const p=srPickTopic();if(!p){toast('Nothing to review right now');return}srStart(p.e.id)};
window.srResume=function(){if(!SR3.sess)return;SU={qid:null};SRSUM=null;srRun=true;renderAppDemo()};
window.srPause=function(){srTPause(true);srRun=false;SU={qid:null};srSave();renderAppDemo()};
window.srSize=function(n){n=Number(n);if(![10,15,20].includes(n))return;SR3.size=n;srSave();renderAppDemo()};
window.srEnd=function(){const s=SR3.sess;if(!s)return;const n=Object.keys(s.first).length;
 confirmBox({title:'End this session?',text:n?`${n} answered question${n>1?'s':''} will be kept and scheduled. The rest stay as they are.`:'No questions were answered in this session.',detail:'Unanswered questions are never counted.',ok:'End session'},()=>{srFinish();renderAppDemo()})};
window.srDrill=function(){const sum=SRSUM||SR3.last;if(!sum||!Array.isArray(sum.weak))return;
 const seen=new Set(),ids=sum.weak.filter(id=>{const r=SR3.q[id];if(seen.has(id)||!qmap.has(id)||!r||r.sus)return false;seen.add(id);return true}).slice(0,20);
 if(!ids.length){toast('No weak questions to drill');return}
 srNewSession({mode:'drill',topic:sum.topic==null?null:sum.topic,label:'Drill · weak questions',plan:ids})};

/* ---------- active-time timer: runs only while the question is on screen and the app is in the foreground ---------- */
function srTPause(persist){
 if(SU&&SU.qid&&!SU.checked&&SU.t0){SU.acc+=performance.now()-SU.t0;SU.t0=0}
 if(persist&&SU&&SU.qid&&!SU.checked&&SR3.sess){SR3.sess.cur={id:SU.qid,acc:Math.round(SU.acc)};srSave()}}
function srTResume(){
 if(SU&&SU.qid&&!SU.checked&&!SU.t0&&srRun&&mode==='app'&&appPage==='review'&&!document.hidden&&srFg)SU.t0=performance.now()}
let srFg=true;
const srBg=()=>{srFg=false;srTPause(true)},srFgOn=()=>{srFg=true;srTResume()};
document.addEventListener('pointerdown',()=>{if(!srFg&&!document.hidden){srFg=true;srTResume()}},true); /* a touch proves the app is in the foreground */
document.addEventListener('visibilitychange',()=>{if(document.hidden)srBg();else{srFgOn();srTick();if(mode==='app'&&appPage==='review'&&!srRun)renderAppDemo()}});
window.addEventListener('pagehide',srBg);window.addEventListener('pageshow',()=>{if(!document.hidden)srFgOn()});
window.addEventListener('blur',srBg);window.addEventListener('focus',()=>{if(!document.hidden)srFgOn()});
document.addEventListener('freeze',srBg);document.addEventListener('resume',()=>{if(!document.hidden)srFgOn()});
document.addEventListener('pause',srBg,false); /* Cordova / Capacitor legacy lifecycle events */
try{const A=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;if(A&&A.addListener)A.addListener('appStateChange',s=>{if(s&&s.isActive){srFgOn()}else srBg()})}catch(e){}
setInterval(()=>{ /* leaving the Review page (or locking the phone) pauses the question; coming back resumes it */
 if(SU&&SU.qid&&!SU.checked){const vis=srRun&&mode==='app'&&appPage==='review'&&!document.hidden&&srFg;
  if(vis){if(!SU.t0)SU.t0=performance.now()}else if(SU.t0){SU.acc+=performance.now()-SU.t0;SU.t0=0}
  const el=document.getElementById('srClock');if(el){const s=Math.floor((SU.acc+(SU.t0?performance.now()-SU.t0:0))/1000);el.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}}},500);
const srElapsed=()=>Math.round(SU.acc+(SU.t0?performance.now()-SU.t0:0));

/* ---------- answering ---------- */
function srCur(){const s=SR3.sess;if(!s)return null;
 while(s.queue.length&&!qmap.get(s.queue[0]))s.queue.shift(); /* a question removed from the bank is skipped, its record is kept */
 return s.queue[0]||null}
window.srAnswer=function(i){
 const s=SR3.sess;if(!srRun||!s||SU.checked||!SU.qid)return;const id=SU.qid,q=qmap.get(id);if(!q)return;
 srTPause(false);const ms=Math.round(SU.acc),ok=i===q.k,now=Date.now(),vt=SU.valid!==false;
 const first=!s.first[id],drill=s.mode==='drill';
 SU.checked=true;SU.sel=i;SU.first=first;SU.drill=drill;SU.res={ok,ms,vt};SU.rateOpen=false;
 let r=SR3.q[id];
 if(drill||!first){ /* practice attempt: logged correctly, never touches the review schedule */
  if(r){srLog(r,{type:drill?'drill':'retry',sel:i,ok,ms:Math.min(ms,6e5),vt});if(!ok)r.wc=(r.wc||0)+1}
  if(first){s.first[id]={ok,ms,vt,drill:true,wasNew:false,lv0:srLevel(r),lv1:srLevel(r),g:null};srDayStat(ok,ms,false,true)}
  else{const f=s.first[id];if(ok)f.rec=true;else f.fail=(f.fail||0)+1;srDayStat(ok,ms,false,true)}
  SU.ag=null}
 else{ /* first scheduled attempt of this question in this session */
  const wasNew=!r||!r.n,lv0=srLevel(r);SU.pre=r&&r.n?JSON.stringify(r):null;
  if(!r)r=SR3.q[id]=srBlankRec(now);
  const ag=srAutoGrade(wasNew?null:r,ok,ms,vt);SU.ag=ag;
  srApplyReview(r,ag.g,{sel:i,ok,ms,vt,ag:ag.g,man:false,sp:ag.speed},now);
  s.first[id]={ok,ms,vt,wasNew,lv0,lv1:srLevel(r),g:ag.g,man:false,sp:ag.speed};
  srDayStat(ok,ms,wasNew,false);
  if(ok&&vt&&ms>=1500&&ms<=120000){SR3.spd.push(ms);if(SR3.spd.length>40)SR3.spd=SR3.spd.slice(-40)}}
 s.att.push({id,ok,ms:Math.min(ms,6e5),first,drill,t:now});
 if(s.queue[0]===id)s.queue.shift();else{const k=s.queue.indexOf(id);if(k>=0)s.queue.splice(k,1)}
 SU.retry=false;const used=s.rt[id]||0;
 if(!ok&&used<2&&s.queue.length>=1){ /* come back after 3–5 other questions, at most twice, never straight away */
  const pos=Math.min(s.queue.length,3+Math.floor(Math.random()*3));s.queue.splice(pos,0,id);s.rt[id]=used+1;SU.retry=true}
 s.cur=null;
 /* reaction kind for the mascot */
 const rr=SR3.q[id],repeat=!ok&&rr&&((rr.lapses||0)>=2||!first);
 SU.kind=ok?(!first?'retryok':SU.ag&&SU.ag.speed==='fast'?'fast':SU.ag&&SU.ag.speed==='slow'?'slow':'good'):(repeat?'repeat':!first?'retrybad':'wrong');
 srSave();srNotify();updateBadges();renderAppDemo();
 requestAnimationFrame(()=>{const e=document.getElementById('srFb');e&&e.scrollIntoView({block:'nearest',behavior:'smooth'});
  const h=document.getElementById('srReact');if(h&&(SU.kind==='fast'||SU.kind==='retryok'))confetti(h,SU.kind==='fast'?30:16)})};
window.srNext=function(){const s=SR3.sess;SU={qid:null};if(!s||!srCur()){srFinish();renderAppDemo();return}
 renderAppDemo();requestAnimationFrame(()=>{const sc=document.getElementById('phoneContent');if(sc)sc.scrollTop=0})};
window.srRateToggle=function(){SU.rateOpen=!SU.rateOpen;renderAppDemo()};
window.srSetGrade=function(g){
 const s=SR3.sess,id=SU.qid;if(!s||!SU.checked||!SU.first||SU.drill||!SU.ag||!(g>=0&&g<=3))return;
 const res=SU.res;if(!res.ok&&g!==0)return; /* an incorrect answer can only be Again */
 const now=Date.now();let r;
 if(SU.pre)r=SR3.q[id]=srNorm(JSON.parse(SU.pre));else r=SR3.q[id]=srBlankRec(now);
 srApplyReview(r,g,{sel:SU.sel,ok:res.ok,ms:res.ms,vt:res.vt,ag:SU.ag.g,man:g!==SU.ag.g,sp:SU.ag.speed},now);
 const f=s.first[id];f.g=g;f.man=g!==SU.ag.g;f.lv1=srLevel(r);SU.rateOpen=false;srSave();srNotify();updateBadges();renderAppDemo()};
window.srSuspendCur=function(){const id=SU.qid;if(id)srSuspend(id,true)};

/* ---------- finishing, summary, drill source ---------- */
function srNextAction(){const t=srTotals(),pick=srPickTopic();
 if(t.weak>0)return{k:'weak',title:'Strengthen your weak questions',text:t.weak+(t.weak===1?' question is':' questions are')+' still shaky. They return automatically — or practise them now.',btn:['Open weak topics',"srTabSet('weak')"]};
 if(t.due>0&&pick)return{k:'due',title:'Keep the momentum',text:t.due+(t.due===1?' review is':' reviews are')+' due. Smart Pick suggests '+pick.e.t.name+'.',btn:['Start recommended session','srPickStart()']};
 let nx=0,c=0;Object.keys(SR3.q).forEach(id=>{const r=SR3.q[id];if(r.sus||!qmap.has(id)||r.due<=Date.now())return;if(!nx||r.due<nx){nx=r.due;c=1}else if(dStart(r.due)===dStart(nx))c++});
 if(pick&&pick.e.fresh)return{k:'new',title:'Nothing urgent — explore',text:'You are caught up. '+pick.e.t.name+' has '+pick.e.fresh+' new question'+(pick.e.fresh>1?'s':'')+'.',btn:['Start recommended session','srPickStart()']};
 return{k:'rest',title:'You are all caught up',text:nx?'Next reviews: '+srDueTxt(nx).toLowerCase()+'.':'Nothing is scheduled right now.',btn:null}}
function srFinish(silent){
 const s=SR3.sess;SR3.sess=null;srRun=false;SU={qid:null};
 if(!s){return}
 const ids=Object.keys(s.first),n=ids.length;
 if(!n){srSave();SRSUM=null;srTab='topics';return}
 const F=id=>s.first[id],okN=ids.filter(id=>F(id).ok).length,drill=s.mode==='drill';
 const ms=s.att.reduce((a,x)=>a+x.ms,0),newN=ids.filter(id=>F(id).wasNew).length;
 const g=[0,0,0,0];if(!drill)ids.forEach(id=>{const f=F(id);if(f.g!=null)g[f.g]++});
 const impr=ids.filter(id=>{const f=F(id);return !f.drill&&f.ok&&SR_LV_RANK[f.lv1]>SR_LV_RANK[f.lv0]})
   .sort((a,b)=>SR_LV_RANK[F(b).lv1]-SR_LV_RANK[F(a).lv1]).slice(0,40);
 const weak=ids.filter(id=>{const f=F(id),r=SR3.q[id];return !f.ok||f.fail||(r&&srIsWeak(r))}).slice(0,40);
 const M=srTopicStats(),tp=[];
 Object.keys(s.m0||{}).forEach(tid=>{const e=M.get(Number(tid));if(!e)return;const b=s.m0[tid];tp.push({id:Number(tid),from:b.p,to:e.pct,s0:b.s,s1:e.status,n:ids.filter(id=>{const q=qmap.get(id);return q&&q.topic===Number(tid)}).length})});
 tp.sort((a,b)=>b.n-a.n||(b.to-b.from)-(a.to-a.from));
 const up=tp.filter(x=>x.s1==='Mastered'&&x.s0!=='Mastered').map(x=>x.id);
 const sum={id:s.sid,t:s.start,end:Date.now(),n,ok:okN,ms,newN,revN:n-newN,mode:s.mode,topic:s.topic,label:s.label,g,impr,weak,tp:tp.slice(0,8),up,
  retries:Object.values(s.rt).reduce((a,x)=>a+x,0),left:s.queue.length,act:srNextAction()};
 SR3.ses.unshift({id:sum.id,t:sum.t,end:sum.end,n,ok:okN,ms,newN,label:sum.label,mode:sum.mode,g,wk:weak.length});SR3.ses=SR3.ses.slice(0,60);
 SR3.last={id:sum.id,t:sum.t,end:sum.end,n,ok:okN,ms,newN,revN:sum.revN,mode:sum.mode,topic:sum.topic,label:sum.label,g,impr,weak,tp:sum.tp,up,retries:sum.retries,left:sum.left};
 SRSUM=Object.assign({},SR3.last,{act:sum.act});srTab='summary';srSave();
 if(!silent)try{addNotif('src-'+s.sid,'Smart Review session complete',`${n} question${n>1?'s':''} · ${pct(okN,n)}% correct`,'review')}catch(e){}
 srNotify();updateBadges()}

/* ---------- schedule tools (postpone / reschedule / suspend) ---------- */
window.srPostpone=function(id,days){const r=SR3.q[id];if(!r)return;const from=r.due,to=Math.max(Date.now(),r.due)+days*DAY;
 r.due=to;r.pp=(r.pp||0)+1;srLog(r,{type:'postpone',from,to});SRX.open=null;srSave();srNotify();updateBadges();renderAppDemo();toast('Postponed '+days+' day'+(days>1?'s':''))};
window.srResched=function(id,val){const r=SR3.q[id];if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(val||'')){toast('Choose a date');return}
 const p=val.split('-').map(Number),d=new Date(p[0],p[1]-1,p[2],8),from=r.due;
 if(dStart(d.getTime())<dStart()){toast('Choose today or a later date');return}
 r.due=dkey(d.getTime())===dkey()?Date.now():d.getTime();srLog(r,{type:'resched',from,to:r.due});SRX.open=null;srSave();srNotify();updateBadges();renderAppDemo();toast('Rescheduled')};
function srSuspend(id,fromSession){const r=SR3.q[id];if(!r)return;r.sus=true;srLog(r,{type:'suspend'});
 const s=SR3.sess;if(s){s.queue=s.queue.filter(x=>x!==id)}
 SRX.open=null;if(fromSession&&SU.qid===id)SU.rateOpen=false;srSave();srNotify();updateBadges();renderAppDemo();toast('Stopped showing this question in Smart Review. Restore it from Schedule.')}
window.srSuspend=function(id){confirmBox({title:'Stop showing this question?',text:'It leaves Smart Review. The question stays in the Question Bank untouched.',detail:'Its history is kept — restore it any time from Schedule.',ok:'Stop showing',danger:true},()=>srSuspend(id,false))};
window.srRestore=function(id){const r=SR3.q[id];if(!r)return;r.sus=false;r.due=Math.max(r.due,Date.now());srLog(r,{type:'restore'});SRX.open=null;srSave();srNotify();updateBadges();renderAppDemo();toast('Back in Smart Review')};
window.srGoal=function(v){v=Math.round(Number(v));if(!Number.isFinite(v))return;SR3.goal=Math.min(200,Math.max(1,v));srSave();renderAppDemo()};

/* ---------- notifications (one per day, updated after every change; no background push is claimed) ---------- */
function srNotify(){try{const now=Date.now(),dn=dueList().length,id='sr-'+dkey(now);
 let n=NOTIF.find(x=>x.id===id);
 if(dn>0){const body=`${dn} question${dn>1?'s are':' is'} ready to review.`;
  if(!n)addNotif(id,'Smart Review due',body,'review');
  else if(n.body!==body||n.title!=='Smart Review due'){if(n.title!=='Smart Review due')n.read=false;n.title='Smart Review due';n.body=body;LS.set(NKEY,NOTIF)}}
 else if(n&&n.title==='Smart Review due'){n.title='Smart Review — all caught up';n.body='No reviews are due right now.';n.read=true;LS.set(NKEY,NOTIF)}}catch(e){}}
let srDayNow=dkey();
function srTick(){const k=dkey();if(k!==srDayNow){srDayNow=k;if(mode==='app'&&appPage==='review'&&!srRun)renderAppDemo()}srNotify();updateBadges()}
window.srTick=srTick;

/* ============================================================
   SMART REVIEW v3 — interface
   ============================================================ */
const srSn=(q,n)=>{const t=QSTEM(q);n=n||88;return esc(t.length>n?t.slice(0,n-2)+'…':t)};
const srChip=(l,c)=>`<span class="sr2-chip" style="--c:${c}">${l}</span>`;
const srLvChip=r=>{const l=srLevel(r);return srChip(SR_LV.find(x=>x[0]===l)[1],SR_LV_COL[l])};
const srI={play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
 clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 layers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
 spark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7z"/></svg>',
 chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'};

/* ---------- mastery ring (real data; animates from the last value the student saw) ---------- */
function srRing(p,started,size,key,o){o=o||{};
 const sw=o.sw||Math.max(3,Math.round(size/10)),r=(size-sw)/2,C=+(2*Math.PI*r).toFixed(2),c=size/2;
 p=Math.max(0,Math.min(100,Math.round(p)));
 const to=+(C*(1-p/100)).toFixed(2),seen=key?SR3.seen[key]:p,from=started?(seen==null?0:seen):0;
 const same=seen===p||!started||!key,col=srRingCol(p,started);
 if(key&&started&&seen!==p)SRUI.rings[key]=p;else if(key&&!started&&seen!==0&&seen!=null)SRUI.rings[key]=0;
 const fo=+(C*(1-from/100)).toFixed(2);
 return `<svg class="sr3-ring${o.glow?' glow':''}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(150,175,205,.17)" stroke-width="${sw}"/>
 <circle class="sr3-arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${same?col:srRingCol(from,from>0)}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${same?to:fo}" transform="rotate(-90 ${c} ${c})" data-to="${to}" data-col="${col}"/>
 ${o.txt===false?'':`<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${o.fs||Math.round(size*.27)}" font-weight="800" fill="#eaf3fc">${started?p+'%':'–'}</text>`}</svg>`}
const srStChip=s=>`<span class="sr3-st" style="--c:${SR_ST_COL[s]}">${s}</span>`;

/* ---------- shell + tabs ---------- */
function srTabs(){const cur=srTab==='summary'?'topics':srTab;
 return `<div class="sr2-tabs sr3-tabs" role="tablist">${[['topics','Topics'],['dash','Overview'],['sched','Schedule'],['weak','Weak'],['hist','History']].map(([k,l])=>`<button type="button" role="tab" aria-selected="${cur===k}" class="${cur===k?'on':''}" onclick="srTabSet('${k}')">${l}</button>`).join('')}</div>`}
const srShell=(inner,tabs)=>`${appHeader('Smart review')}<div class="rs sr2 sr3"><h1>Smart review</h1><p class="sub">Your personal review coach — pick a topic and start.</p>${tabs===false?'':srTabs()}<div class="sr2-in">${inner}</div></div>`;
const srNote=()=>`<p class="meta sr2-note">Reminders appear in Notifications when you open the app. This version does not send background notifications.</p>`;

/* ---------- TOPICS (home of Smart Review) ---------- */
function srCounts(e){const z=n=>n?'':' z';
 return `<span class="sr3-n due${z(e.due)}"><b>${e.due}</b> Due</span><span class="sr3-n new${z(e.fresh)}"><b>${e.fresh}</b> New</span><span class="sr3-n weak${z(e.weak)}"><b>${e.weak}</b> Weak</span>`}
function srTopicCard(e){const t=e.t,dis=!e.tot||!(e.due+e.weak+e.fresh);
 return `<button type="button" class="sr3-tc${e.status==='Mastered'?' mst':''}${e.due?' hasdue':''}" data-tid="${t.id}" ${dis?'disabled':''} onclick="srStart(${t.id})" aria-label="${esc(t.name)} — ${e.status}, ${e.pct}% mastery, ${e.due} due, ${e.fresh} new, ${e.weak} weak">
  ${srRing(e.pct,e.rev>0,54,t.key,{glow:e.status==='Mastered'})}
  <span class="sr3-tx"><span class="sr3-tt"><b>${esc(t.name)}</b>${srStChip(e.status)}</span>
  <small>${esc(t.specLabel)}${t.sy?' · '+esc(t.sy):''}</small>
  <span class="sr3-ns">${srCounts(e)}</span>
  <span class="sr3-ft"><span>${e.lv.mastered} of ${e.tot} mastered</span><span>${e.rev?'Last: '+srAgo(e.last):'Not reviewed yet'}</span></span></span></button>`}
function srFilterOk(e){const f=SRUI.filter;
 if(f==='due')return e.due>0;if(f==='weak')return e.weak>0;if(f==='prog')return e.rev>0&&e.status!=='Mastered';if(f==='new')return e.rev===0;return true}
function srTopicList(){const M=srTopicStats(),q=SRUI.q.trim().toLowerCase(),active=q||SRUI.filter!=='all';
 const groups=[];const bySpec=new Map();
 SRT.forEach(t=>{const e=M.get(t.id);if(!e)return;if(q&&!(t.name+' '+t.specLabel+' '+t.sy).toLowerCase().includes(q))return;if(!srFilterOk(e))return;
  if(!bySpec.has(t.spec)){const g={spec:t.spec,label:t.specLabel,items:[]};bySpec.set(t.spec,g);groups.push(g)}bySpec.get(t.spec).items.push(e)});
 if(!groups.length)return `<div class="card"><p class="meta" style="margin:0">No topics match this view.</p></div>`;
 return groups.map(g=>{const tot=g.items.reduce((a,e)=>a+e.tot,0),cr=g.items.reduce((a,e)=>a+e.credit,0),p=tot?Math.round(100*cr/tot):0;
  const started=g.items.some(e=>e.rev>0||e.due>0);
  const open=active||(SRUI.open[g.spec]!=null?SRUI.open[g.spec]:started);
  const due=g.items.reduce((a,e)=>a+e.due,0);
  return `<section class="sr3-grp${open?' open':''}" data-spec="${esc(g.spec)}"><button type="button" class="sr3-gh" aria-expanded="${open}" onclick="srGroup('${esc(g.spec)}')"><span class="sr3-gt"><b>${esc(g.label)}</b><small>${g.items.length} topic${g.items.length>1?'s':''}${due?' · '+due+' due':''}</small></span><span class="sr3-gp" style="color:${srRingCol(p,cr>0)}">${p}%</span><span class="sr3-gc">${srI.chev}</span></button>
   ${open?`<div class="sr3-gb">${g.items.map(srTopicCard).join('')}</div>`:''}</section>`}).join('')}
function srTopicsHTML(){const T=srTotals(),pick=srPickTopic(),s=SR3.sess;let h='';
 if(s&&Object.keys(s.first).length+s.queue.length>0){const done=Object.keys(s.first).length;
  h+=`<div class="card sr3-resume"><div><b>Session in progress</b><small>${esc(s.label)} · ${s.queue.length} left · ${done} answered</small></div><div class="sr3-rb"><button type="button" class="btn primary" onclick="srResume()">Resume</button><button type="button" class="btn" onclick="srEnd()">End</button></div></div>`}
 if(pick){const e=pick.e;
  h+=`<div class="card sr3-pick${pick.hi?' hi':''}"><div class="sr3-pk-top"><span class="sr3-kick">${srI.spark} SMART PICK</span><span class="sr3-prio">${pick.prio}</span></div>
   <div class="sr3-pk-body">${srRing(e.pct,e.rev>0,64,e.t.key)}<div class="sr3-pk-tx"><h3>${esc(e.t.name)}</h3><small>${esc(e.t.specLabel)}${e.t.sy?' · '+esc(e.t.sy):''}</small>
   <ul class="sr3-why">${pick.lines.map(([l,k])=>`<li class="${k}"><i></i>${l}</li>`).join('')}</ul></div></div>
   <button type="button" class="btn primary block sr3-go" onclick="srPickStart()">${srI.play} Start Recommended Session</button></div>`}
 else h+=`<div class="card sr3-pick"><div class="sr3-pk-top"><span class="sr3-kick">${srI.spark} SMART PICK</span></div><h3 style="margin:8px 0 4px">Nothing to review right now</h3><p class="meta" style="margin:0">Every question is either suspended or has no available questions. Restore suspended questions from the Schedule tab.</p></div>`;
 const allAvail=T.due+T.weak+T.fresh;
 h+=`<div class="card sr3-all"><div class="sr3-all-t"><span class="sr3-all-i">${srI.layers}</span><div><b>All Topics</b><small>${T.due} due · ${T.weak} weak · ${T.fresh} new — mixed by priority</small></div></div>
  <button type="button" class="btn" ${allAvail?'':'disabled'} onclick="srStart()">Start</button></div>
  <div class="sr3-size"><span>Session size</span><div class="seg">${[10,15,20].map(n=>`<button type="button" class="${SR3.size===n?'on':''}" onclick="srSize(${n})">${n}</button>`).join('')}</div></div>
  <div class="sr3-sec"><h2>Topics</h2><small>${T.started} of ${T.topics} started · ${T.lv.mastered} of ${T.tot} questions mastered</small></div>
  <input class="field sr3-search" type="search" id="srSearch" placeholder="Search topics" value="${esc(SRUI.q)}" oninput="srSearch(this.value)" autocomplete="off">
  <div class="sr3-fl" role="group" aria-label="Filter topics">${[['all','All'],['due','Due'],['weak','Weak'],['prog','In progress'],['new','Not started']].map(([k,l])=>`<button type="button" class="${SRUI.filter===k?'on':''}" onclick="srFilter('${k}')">${l}</button>`).join('')}</div>
  <div id="srTL">${srTopicList()}</div>`;
 return h}
window.srSearch=function(v){SRUI.q=v;const el=document.getElementById('srTL');if(el){el.innerHTML=srTopicList();srPost()}};
window.srFilter=function(f){SRUI.filter=f;renderAppDemo()};
window.srGroup=function(spec){const cur=document.querySelector(`.sr3-grp[data-spec="${spec}"]`);const open=!(cur&&cur.classList.contains('open'));SRUI.open[spec]=open;const el=document.getElementById('srTL');if(el){el.innerHTML=srTopicList();srPost()}};
window.srJump=function(id){const t=SRT_BY.get(id);if(!t)return;SRUI.filter='all';SRUI.q='';SRUI.open[t.spec]=true;srTab='topics';renderAppDemo();
 requestAnimationFrame(()=>{const el=document.querySelector(`.sr3-tc[data-tid="${id}"]`);if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1600)}})};

/* ---------- OVERVIEW ---------- */
function srMapHTML(){const M=srTopicStats(),by=new Map();
 SRT.forEach(t=>{const e=M.get(t.id);if(!e)return;if(!by.has(t.spec))by.set(t.spec,{label:t.specLabel,items:[]});by.get(t.spec).items.push(e)});
 return [...by.values()].map(g=>`<div class="sr3-mg"><div class="sr3-mh">${esc(g.label)}</div><div class="sr3-mr">${g.items.map(e=>`<button type="button" class="sr3-mc${e.status==='Mastered'?' mst':''}" onclick="srJump(${e.t.id})" aria-label="${esc(e.t.name)}: ${e.status}, ${e.pct}%" title="${esc(e.t.name)} · ${e.pct}%">${srRing(e.pct,e.rev>0,34,e.t.key,{txt:false,sw:4,glow:e.status==='Mastered'})}${e.due?'<i class="dot due"></i>':''}${e.status==='Mastered'?'<i class="dot star">★</i>':''}</button>`).join('')}</div></div>`).join('')}
function srDashHTML(){const T=srTotals(),pick=srPickTopic(),s=SR3.sess,gp=Math.min(100,pct(T.today,SR3.goal)),remain=Math.max(SR3.goal-T.today,0);
 const dueT=T.dueToday;
 const hero=`<div class="card sr2-hero"><div class="sr2-big"><b>${dueT}</b><span>${dueT===1?'question':'questions'} due today${T.od?` <em>· ${T.od} overdue</em>`:''}</span></div>
  <button type="button" class="btn primary block sr2-go" ${pick||s?'':'disabled'} onclick="${s?'srResume()':'srPickStart()'}">${srI.play} ${s?'Resume session · '+s.queue.length+' left':'Start Recommended Session'}</button>
  <div class="sr2-goal"><div><b>${T.today}</b> / ${SR3.goal} questions today</div><span>${gp>=100?'Goal reached':remain+' to go'}</span></div><div class="bar"><i style="width:${gp}%"></i></div></div>`;
 const stat=(v,l,c)=>`<div class="sr2-st"><b style="${c?'color:'+c:''}">${v}</b><small>${l}</small></div>`;
 const grid=`<div class="sr2-grid">${stat(T.dueToday-T.od,'Due today','#8fc6ff')}${stat(T.od,'Overdue',T.od?'#ffb454':'')}${stat(T.upcoming,'Upcoming')}${stat(T.today,'Reviewed today','#35cf82')}${stat(T.lv.mastered,'Mastered','#b58cff')}${stat(T.weak,'Need more review',T.weak?'#ff8c8c':'')}</div>`;
 const lvTot=Math.max(T.tot,1);
 const lv=`<div class="card"><div class="sr2-h">Mastery journey</div><div class="sr3-ov"><div class="sr3-ovr">${srRing(T.pct,T.rev>0,74,'__all',{fs:19})}</div><div><b>${T.lv.mastered} of ${T.tot}</b><small>questions mastered</small><small>${T.rev} reviewed · ${T.fresh} not started</small></div></div>
  <div class="sr2-lvbar">${SR_LV.map(([k])=>T.lv[k]?`<i style="flex:${T.lv[k]};background:${SR_LV_COL[k]}"></i>`:'').join('')}</div>
  <div class="sr2-leg">${SR_LV.map(([k,l])=>`<span><i style="background:${SR_LV_COL[k]}"></i>${l} <b>${T.lv[k]}</b></span>`).join('')}</div>
  <p class="meta" style="margin:10px 0 0">Questions you have not met in Smart Review count as New, never as mastered. A question becomes Mastered only after several successful reviews at increasing intervals.</p></div>`;
 const goal=`<div class="card"><div class="sr2-h">Daily goal</div><div class="sr2-step"><button type="button" aria-label="Decrease goal" onclick="srGoal(${SR3.goal-5})">−</button><label><input type="number" inputmode="numeric" min="1" max="200" value="${SR3.goal}" onchange="srGoal(this.value)" aria-label="Daily goal"><span>questions / day</span></label><button type="button" aria-label="Increase goal" onclick="srGoal(${SR3.goal+5})">+</button></div></div>`;
 const map=`<div class="card"><div class="sr2-h">Topic mastery map</div>${srMapHTML()}<div class="sr3-lg">${[['Not started','#4b5d73'],['Learning','#ffb454'],['Improving','#4da3ff'],['Strong','#35cf82'],['Mastered','#b58cff']].map(([l,c])=>`<span><i style="background:${c}"></i>${l}</span>`).join('')}<span><i class="dot due" style="position:static;display:inline-block"></i>Needs review</span></div></div>`;
 return hero+grid+lv+map+goal+srNote()}

/* ---------- SCHEDULE ---------- */
function srRowHTML(x){const {q,r}=x,open=SRX.open===q.id,d=dkey(Math.max(Date.now(),r.due));
 return `<div class="sr2-row${open?' open':''}"><button type="button" class="sr2-rt" onclick="srOpenRow('${q.id}')" aria-expanded="${open}"><div class="sr2-rm"><b>${srSn(q)}</b><small>${esc(TOPIC_NAME[q.topic]||'')} · ${r.sus?'Stopped':srDueTxt(r.due)}</small></div>${r.sus?srChip('Stopped','#7b8da3'):srLvChip(r)}</button>
  ${open?`<div class="sr2-ra">${r.sus?`<div class="sr2-btns"><button type="button" class="btn primary" onclick="srRestore('${q.id}')">Restore to Smart Review</button><button type="button" class="btn" onclick="openQ('${q.id}')">Open question</button></div>`
  :`<div class="sr2-btns"><button type="button" class="btn" onclick="srPostpone('${q.id}',1)">Postpone 1 d</button><button type="button" class="btn" onclick="srPostpone('${q.id}',3)">Postpone 3 d</button></div>
  <div class="sr2-date"><input type="date" id="rs-${q.id}" min="${dkey()}" value="${d}" aria-label="New review date"><button type="button" class="btn" onclick="srResched('${q.id}',document.getElementById('rs-${q.id}').value)">Reschedule</button></div>
  <div class="sr2-btns"><button type="button" class="btn" onclick="openQ('${q.id}')">Open question</button><button type="button" class="btn danger" onclick="srSuspend('${q.id}')">Stop showing</button></div>
  <p class="meta" style="margin:8px 0 0">Postponing is not a review and never raises mastery. Stopping a question does not delete it from the Question Bank.</p>`}</div>`:''}</div>`}
function srSection(title,arr,key){if(!arr.length)return '';const lim=SRX.lim[key]||8;
 return `<div class="soon-h">${title} · ${arr.length}</div>${arr.slice(0,lim).map(x=>srRowHTML(x)).join('')}${arr.length>lim?`<button type="button" class="btn block" onclick="srMore('${key}')">Show ${Math.min(12,arr.length-lim)} more</button>`:''}`}
function srSchedHTML(){const all=srList(),now=Date.now(),t0=dStart(now),t1=dNext(now);
 const sus=Object.keys(SR3.q).filter(id=>SR3.q[id].sus&&qmap.has(id)).map(id=>({q:qmap.get(id),r:SR3.q[id]}));
 if(!all.length&&!sus.length)return `<div class="card sr2-empty"><h3>Nothing is scheduled yet</h3><p class="meta">Start a topic from the Topics tab. Every question you answer gets its own review date and appears here — overdue, today and the next seven days.</p><button type="button" class="btn primary block" onclick="srTabSet('topics')">Choose a topic</button></div>`;
 const od=all.filter(x=>x.r.due<t0),td=all.filter(x=>x.r.due>=t0&&x.r.due<t1),up=all.filter(x=>x.r.due>=t1),days={};
 up.forEach(x=>{const k=dStart(x.r.due);if(x.r.due<t1+7*DAY)(days[k]||(days[k]=[])).push(x)});
 const later=up.filter(x=>x.r.due>=t1+7*DAY);
 const wk=Object.keys(days).sort((a,b)=>a-b).map(k=>srSection(new Date(Number(k)).toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'}),days[k],'d'+k)).join('');
 return `${srSection('Overdue',od,'od')}${srSection('Due today',td,'td')}${!od.length&&!td.length?`<div class="card"><p class="meta" style="margin:0">No reviews are due today. The next 7 days are below.</p></div>`:''}${wk}
  ${later.length?`<div class="soon-h">Later · ${later.length}</div><div class="card"><p class="meta" style="margin:0">Next one: ${srDueTxt(later[0].r.due)} (${new Date(later[0].r.due).toLocaleDateString()}).</p></div>`:''}
  ${srSection('Stopped questions',sus,'sus')}`}
window.srOpenRow=function(id){SRX.open=SRX.open===id?null:id;renderAppDemo()};
window.srMore=function(k){SRX.lim[k]=(SRX.lim[k]||8)+12;renderAppDemo()};

/* ---------- WEAK TOPICS ---------- */
function srWeakHTML(){const M=srTopicStats();
 const l=[...M.values()].filter(e=>e.weak>0||(e.rev&&e.n-e.ok>0&&e.due>0)).map(e=>Object.assign(e,{p:e.weak*3+(e.n-e.ok)*2+e.due})).sort((a,b)=>b.p-a.p);
 if(!l.length)return `<div class="card"><h3 style="margin:0 0 6px">No weak topics yet</h3><p class="meta" style="margin:0">Topics appear here when you keep missing questions during reviews. You can start any topic from the Topics tab.</p></div>`;
 return `<p class="meta" style="margin:0 0 10px">Ranked by repeated mistakes, weak questions and reviews due.</p>${l.slice(0,30).map((e,i)=>`<div class="card sr2-wk"><div class="sr2-wh"><span class="sr2-rank">${i+1}</span><div style="min-width:0;flex:1"><b>${esc(e.t.name)}</b><small>${esc(e.t.specLabel)} · ${e.weak} weak of ${e.tot}${e.n?' · '+pct(e.ok,e.n)+'% recent accuracy':''}${e.due?' · '+e.due+' due':''}</small></div>${srRing(e.pct,e.rev>0,44,e.t.key)}</div>
  <div class="bar"><i style="width:${Math.min(100,pct(e.weak,e.tot))}%;background:#ff8c8c"></i></div><button type="button" class="btn block" onclick="srStart(${e.t.id})">${srI.play} Practise this topic</button></div>`).join('')}`}

/* ---------- HISTORY ---------- */
function srTrail(r){return r.h.slice(-12).reverse().map(x=>{
 const d=new Date(x.t).toLocaleDateString([],{day:'numeric',month:'short'});
 if(x.type==='review')return `<div class="sr2-at"><span>${d}</span><b style="color:${x.ok?'#35cf82':'#ff8c8c'}">${x.ok?'Correct':'Incorrect'}</b><span>${SR_RATE[x.g]}${x.man?' ✎':''} · ${Math.round((x.ms||0)/1000)}s</span><span>→ ${srRetTxt(x.to,x.t).replace('in ','')}</span></div>`;
 if(x.type==='retry'||x.type==='drill')return `<div class="sr2-at mut"><span>${d}</span><span>${x.type==='drill'?'Drill':'Retry'} · ${x.ok?'correct':'incorrect'} · ${Math.round((x.ms||0)/1000)}s</span></div>`;
 return `<div class="sr2-at mut"><span>${d}</span><span>${{postpone:'Postponed → '+(x.to?new Date(x.to).toLocaleDateString([],{day:'numeric',month:'short'}):''),resched:'Rescheduled → '+(x.to?new Date(x.to).toLocaleDateString([],{day:'numeric',month:'short'}):''),skip:'Skipped',suspend:'Stopped',restore:'Restored'}[x.type]||x.type}</span></div>`}).join('')}
function srHistHTML(){
 const all=Object.keys(SR3.q).filter(id=>qmap.has(id)&&SR3.q[id].n>0).map(id=>({q:qmap.get(id),r:SR3.q[id]})).sort((a,b)=>(b.r.last||0)-(a.r.last||0));
 const days=[];for(let i=13;i>=0;i--){const t=new Date();t.setDate(t.getDate()-i);const k=dkey(t.getTime());days.push([k,t,SR3.days[k]||{n:0,ok:0,ms:0}])}
 const tot=Object.values(SR3.days).reduce((a,d)=>({n:a.n+d.n,ok:a.ok+d.ok}),{n:0,ok:0}),mx=Math.max(1,...days.map(d=>d[2].n));
 if(!tot.n&&!SR3.ses.length)return `<div class="card"><h3 style="margin:0 0 6px">No review history yet</h3><p class="meta" style="margin:0">Finish a session and your attempts, ratings and progress show up here.</p></div>`;
 let streak=0;for(let i=0;i<400;i++){const t=new Date();t.setDate(t.getDate()-i);if((SR3.days[dkey(t.getTime())]||{}).n)streak++;else if(i>0)break;else continue}
 const chart=`<div class="card"><div class="sr2-h">Last 14 days</div><div class="sr2-chart">${days.map(([k,t,d])=>`<div title="${k}: ${d.n} reviews"><i style="height:${d.n?Math.max(8,Math.round(d.n/mx*100)):3}%;background:${d.n?(pct(d.ok,d.n)>=70?'#35cf82':pct(d.ok,d.n)>=50?'#ffb454':'#ff8c8c'):'#1d3148'}"></i><span>${t.getDate()}</span></div>`).join('')}</div>
  <div class="sr2-grid" style="margin:12px 0 0"><div class="sr2-st"><b>${tot.n}</b><small>Reviews</small></div><div class="sr2-st"><b>${pct(tot.ok,tot.n)}%</b><small>Accuracy</small></div><div class="sr2-st"><b>${streak}</b><small>Day streak</small></div></div></div>`;
 const ses=SR3.ses.slice(0,6).map(s=>`<div class="sr2-ses"><div><b>${esc(s.label||'Session')}${s.mode==='drill'?' ':''}</b><small>${new Date(s.t).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}${s.newN?' · '+s.newN+' new':''}</small></div><span>${s.n} · ${pct(s.ok,s.n)}%</span></div>`).join('');
 const lim=SRH.lim,rows=all.slice(0,lim).map(({q,r})=>{const df=srDiff(r);
  return `<details class="sr2-hrow"><summary><div class="sr2-rm"><b>${srSn(q)}</b><small>${esc(TOPIC_NAME[q.topic]||'')} · reviewed ${r.n}× · next ${r.sus?'stopped':srDueTxt(r.due)}</small></div>${srLvChip(r)}</summary>
  <div class="sr2-hd"><div class="sr2-hm">${srChip('Difficulty: '+df.l,df.l==='Hard'?'#ff8c8c':df.l==='Medium'?'#ffb454':'#35cf82')}${(r.lapses||0)>=2?srChip('Repeated mistakes ×'+r.lapses,'#ff8c8c'):''}${r.wc?srChip('Wrong ×'+r.wc,'#ff8c8c'):''}${r.pp?srChip('Postponed ×'+r.pp,'#7b8da3'):''}${srChip('Ease '+(r.ease||2.3).toFixed(2),'#4da3ff')}${srChip('Streak '+(r.streak||0),'#35cf82')}</div>${srTrail(r)}</div></details>`}).join('');
 return chart+(ses?`<div class="soon-h">Recent sessions</div><div class="card">${ses}</div>`:'')+(all.length?`<div class="soon-h">Reviewed questions · ${all.length}</div>${rows}${all.length>lim?`<button type="button" class="btn block" onclick="srHistMore()">Show more</button>`:''}`:'')}

/* ---------- SESSION ---------- */
const SR_MSG={
 fast:[['Brilliant!','Quick and accurate — that one is locked in.'],['Sharp recall!','You answered fast and got it right.'],['Lightning!','That is real knowledge, not luck.'],['Excellent pace!','Confident and correct.']],
 good:[['Well done!','Correct. Steady recall is exactly the goal.'],['Nice work!','That one is moving in the right direction.'],['Correct!','Read the explanation to cement it.'],['Good job!','Solid answer.']],
 slow:[['Correct — keep going!','It took a moment, but you got there. It will return a little sooner.'],['You got it!','Slow and steady. This one comes back soon to build speed.'],['Right answer!','A bit of thinking time — that is how recall grows.']],
 wrong:[['Not quite — that is okay.','Read the explanation; it comes back after a few questions.'],['Good attempt.','Mistakes are how memory is built. You will see this again soon.'],['Let us learn from this one.','Take a moment with the explanation.'],['Almost there.','The explanation below will make it click.']],
 repeat:[['This one keeps slipping.','Look closely at the explanation and link it to something you already know.'],['Same trap again.','Slow down and read every option carefully.'],['Let us look closer.','This question needs a different angle — try a quick note or a mnemonic.']],
 retryok:[['Recovered!','You fixed it on the second look. It still returns tomorrow to make sure it sticks.'],['That is the fix!','Second look, right answer.']],
 retrybad:[['Still tricky.','No problem — it stays on your weak list and returns soon.'],['Keep at it.','It will come back tomorrow for another go.']]};
const SR_FACE={fast:'celebrating',good:'happy',slow:'encouraging',wrong:'sad',repeat:'investigating',retryok:'discovery',retrybad:'encouraging'};
function srPhrase(k){const a=SR_MSG[k]||SR_MSG.good;let i=Math.floor(Math.random()*a.length);if(a.length>1&&i===srFaceIx[k])i=(i+1)%a.length;srFaceIx[k]=i;return a[i]}
function srRatePrev(g){const base=SU.pre?srNorm(JSON.parse(SU.pre)):srBlankRec(Date.now());return srCalc(base,g,Date.now())}
function srSessionHTML(){
 const s=SR3.sess,cur=srCur();
 if(!SU.checked&&!cur){srFinish();return srSummaryHTML()}
 const id=SU.checked?SU.qid:cur,q=qmap.get(id);
 if(!SU.checked&&SU.qid!==id){const c=s.cur&&s.cur.id===id?s.cur.acc:0;SU={qid:id,sel:null,checked:false,res:null,t0:0,acc:c,valid:true};s.cur=null;SU.t0=(srFg&&!document.hidden)?performance.now():0}
 const r=SR3.q[id],done=Object.keys(s.first).length,isRetry=SU.checked?!SU.first:!!s.first[id],res=SU.res,ok=res&&res.ok;
 const pr=Math.round(100*Math.min(done,s.n0)/Math.max(s.n0,1)),drill=s.mode==='drill';
 const num=SU.checked?done:done+1;
 const opts=q.o.map((o,i)=>{const cls=SU.checked?(i===q.k?'correct':i===SU.sel?'incorrect':'dim'):'';
  return `<button type="button" class="qopt ${cls}" ${SU.checked?'disabled':''} onclick="srAnswer(${i})"><i>${QLT(q,i)}</i><span>${esc(o)}</span>${SU.checked&&i===q.k?'<b class="ck">✓</b>':''}${SU.checked&&i===SU.sel&&i!==q.k?'<b class="ck x">✕</b>':''}</button>`}).join('');
 let fb='';
 if(SU.checked){
  const kind=SU.kind||'good',[ttl,msg]=srPhrase(kind),face=SR_FACE[kind]||'happy',secs=Math.round(res.ms/1000),ref=srSpeedRef();
  const react=`<div class="qreact ${ok?'ok':'no'} sr3-react k-${kind}" id="srReact">${docFace(face,'sr3-face')}<div><b>${ttl}</b><span>${esc(msg)}</span></div></div>`;
  const key=`<div class="qfb ${ok?'ok':'no'}" id="srFb"><b>${ok?'Correct':'Incorrect'} · Answer: ${QLT(q,q.k)}. ${esc(q.o[q.k])}${qUnsure(q)?' <em class="qunsure">(unconfirmed key)</em>':''}</b><p>${esc(q.ex||'')}</p><div class="sr2-time">${res.vt?`Your time ${secs}s · your usual ${Math.round((ref.med||30000)/1000)}s`:'Time was not measured for this question'}</div></div>`;
  let badge='';
  if(SU.first&&!SU.drill&&SU.ag){const f=s.first[id],g=f.g,c=srRatePrev(g),col=SR_RATE_COL[g];
   badge=`<button type="button" class="sr3-badge" style="--c:${col}" aria-expanded="${!!SU.rateOpen}" onclick="srRateToggle()"><i></i><b>${SR_RATE[g]}${f.man?' ✎':''}</b><span>Returns ${srRetTxt(SR3.q[id].due)}</span><em>${SU.rateOpen?'▴':'▾'}</em></button>`;
   if(SU.rateOpen)badge+=`<div class="sr3-rp"><div class="sr2-rl">Change how this question is scheduled</div><div class="sr2-rate">${SR_RATE.map((n,gi)=>{const off=!ok&&gi!==0,p=srRatePrev(gi);return `<button type="button" class="${gi===g?'sug':''}" ${off?'disabled':''} onclick="srSetGrade(${gi})"><span>${n}</span><small>${srRetTxt(p.due).replace('in ','')}</small>${gi===SU.ag.g?'<em>Auto</em>':''}</button>`}).join('')}</div>
    <p class="meta sr2-why2">${esc(SU.ag.why)} ${ok?'Tap another rating if it felt different — it is optional.':'An incorrect answer can only be Again.'}</p><button type="button" class="sr3-link" onclick="srSuspendCur()">Stop showing this question</button></div>`}
  else badge=`<div class="sr3-badge static"><i></i><b>${drill?'Practice':'Retry'}</b><span>${drill?'Recorded — your schedule is unchanged':ok?'Recorded — it still returns tomorrow':'Recorded — it returns tomorrow'}</span></div>`;
  const more=srCur();
  fb=react+key+badge+`<button type="button" class="btn primary block sr3-next" onclick="srNext()">${more?'Next question':'See summary'} ${srI.chev}</button>`}
 const lv=r&&r.n?srLvChip(r):srChip('New','#7b8da3');
 return srShell(`<div class="sr2-sh"><div><b>${esc(s.label)}</b><small>${isRetry?'Retry · ':''}Question ${Math.min(num,s.n0)} of ${s.n0} · ${s.queue.length} left</small></div><div class="sr3-hb"><button type="button" class="btn" onclick="srPause()">Pause</button><button type="button" class="btn" onclick="srEnd()">End</button></div></div><div class="bar sr2-pb"><i style="width:${pr}%"></i></div>
  <div class="card srcard"><div class="qid">${q.id} · ${esc(TOPIC_NAME[q.topic]||'')}</div><div class="sr2-meta">${lv}${isRetry?srChip('Retry','#ffb454'):''}${drill?srChip('Drill','#ff8c8c'):''}${r&&r.due>dNext()&&!SU.checked&&!drill?srChip('Early review','#7b8da3'):''}${SU.checked?'':`<span class="sr3-tm">${srI.clock}<b id="srClock">0:00</b></span>`}</div>
  ${q.cs?`<div class="qcase"><b>${esc(q.cs[0])}</b>\n${esc(q.cs[1])}</div>`:''}<div class="stem">${esc(QSTEM(q))}</div>${opts}</div>${fb}`,false)}

/* ---------- SUMMARY ---------- */
function srSummaryHTML(){const s=SRSUM||SR3.last;if(!s)return srShell(srTopicsHTML());
 const a=pct(s.ok,s.n),drill=s.mode==='drill',M=srTopicStats();
 const face=s.up&&s.up.length?'climbing':a>=85?'celebrating':a>=60?'happy':'encouraging';
 const title=s.up&&s.up.length?'Topic mastered!':a>=85?'Excellent session!':a>=60?'Good session':'Keep going — this is how it sticks';
 const ms=s.ms,mm=ms>=60000?Math.round(ms/6000)/10+' min':Math.round(ms/1000)+' s';
 const perf=`<div class="sr2-grid sr3-perf"><div class="sr2-st"><b style="color:#35cf82">${s.ok}</b><small>Correct</small></div><div class="sr2-st"><b style="color:#ff8c8c">${s.n-s.ok}</b><small>Wrong</small></div><div class="sr2-st"><b>${a}%</b><small>Accuracy</small></div><div class="sr2-st"><b>${mm}</b><small>Active time</small></div><div class="sr2-st"><b>${s.newN}</b><small>New questions</small></div><div class="sr2-st"><b>${s.revN}</b><small>${drill?'Practised':'Reviewed'}</small></div></div>`;
 const item=(id,extra)=>{const q=qmap.get(id);if(!q)return '';const r=SR3.q[id];return `<button type="button" class="sr2-cd sr3-it" onclick="openQ('${id}')"><div class="sr2-rm"><b>${srSn(q,78)}</b><small>${esc(TOPIC_NAME[q.topic]||'')}</small></div>${extra}</button>`};
 const impr=(s.impr||[]).slice(0,6).map(id=>item(id,`<span class="sr3-arrow">${srChip(SR_LV.find(x=>x[0]===srLevel(SR3.q[id]))[1],SR_LV_COL[srLevel(SR3.q[id])])}</span>`)).join('');
 const weak=(s.weak||[]).slice(0,6).map(id=>item(id,srChip(SR3.q[id]&&SR3.q[id].rl?'Weak':'Practise','#ff8c8c'))).join('');
 const tp=(s.tp||[]).map(x=>{const e=M.get(x.id);if(!e)return '';const d=x.to-x.from;return `<div class="sr3-tp"><span>${srRing(e.pct,e.rev>0,40,e.t.key)}</span><div><b>${esc(e.t.name)}</b><small>${x.from}% → <b style="color:${d>0?'#35cf82':d<0?'#ff8c8c':'#9aadc1'}">${x.to}%</b> ${d>0?'(+'+d+')':d<0?'('+d+')':''} · ${x.s1}${x.s0!==x.s1?' (was '+x.s0+')':''}</small></div></div>`}).join('');
 const act=s.act||srNextAction();
 const due=dueList().length;
 return srShell(`<div class="card sr2-sum sr3-sum">${docFace(face,'dr-top sr3-face')}<div class="sr3-kick2">${drill?'DRILL COMPLETE':'SESSION COMPLETE'}</div><h3>${title}</h3><p class="meta" style="margin:0 0 4px">${esc(s.label)} · ${s.n} question${s.n>1?'s':''}${s.retries?' · '+s.retries+' retr'+(s.retries>1?'ies':'y'):''}${s.left?' · '+s.left+' not reached':''}</p></div>
  <div class="sr3-sec"><h2>Your performance</h2></div>${perf}
  ${impr?`<div class="sr3-sec"><h2>What you mastered</h2><small>Questions that moved up a level</small></div>${impr}`:''}
  ${weak?`<div class="sr3-sec"><h2>Needs more practice</h2><small>Missed or still shaky — they return automatically</small></div>${weak}`:''}
  ${tp?`<div class="sr3-sec"><h2>Topic progress</h2></div><div class="card">${tp}</div>`:''}
  <div class="card sr3-act"><div class="sr2-h">Next recommended action</div><b>${esc(act.title)}</b><p class="meta" style="margin:4px 0 0">${esc(act.text)}</p></div>
  ${(s.weak||[]).length?`<button type="button" class="btn primary block sr3-drill" onclick="srDrill()">${srI.play} Drill Weak Ones · ${Math.min(20,s.weak.length)}</button>`:''}
  ${act.btn?`<button type="button" class="btn ${(s.weak||[]).length?'':'primary '}block" onclick="${act.btn[1]}">${act.btn[0]}</button>`:''}
  <button type="button" class="btn block" onclick="srBack()">Back to topics</button>`,false)}

/* ---------- view router + hooks ---------- */
reviewView=function(){
 if(srRun&&SR3.sess)return srSessionHTML();
 srRun=false;
 if(srTab==='summary')return srSummaryHTML();
 const body={topics:srTopicsHTML,dash:srDashHTML,sched:srSchedHTML,weak:srWeakHTML,hist:srHistHTML}[srTab]||srTopicsHTML;
 return srShell(body(),true)};
window.srBack=function(){srTab='topics';SRSUM=null;renderAppDemo();const sc=document.getElementById('phoneContent');if(sc)sc.scrollTop=0};
window.srHistMore=function(){SRH.lim+=10;renderAppDemo()};
window.srTabSet=function(t){srTab=t;SRX.open=null;renderAppDemo();const sc=document.getElementById('phoneContent');if(sc)sc.scrollTop=0};
function srPost(){
 if(mode!=='app'||appPage!=='review')return;
 const arcs=document.querySelectorAll('.sr3-arc[data-to]');
 if(arcs.length)requestAnimationFrame(()=>requestAnimationFrame(()=>{arcs.forEach(a=>{if(a.getAttribute('stroke-dashoffset')!==a.dataset.to){a.style.strokeDashoffset=a.dataset.to;a.style.stroke=a.dataset.col}})}));
 const keys=Object.keys(SRUI.rings);if(keys.length){keys.forEach(k=>{SR3.seen[k]=SRUI.rings[k]});SRUI.rings={};srSave()}
 srTResume();
 if(srTab==='summary'&&!srRun&&(SRSUM||SR3.last)&&!SRUI.celebrated){const s=SRSUM||SR3.last;SRUI.celebrated=s.id;const a=pct(s.ok,s.n);if((s.up&&s.up.length)||a>=85){const h=document.querySelector('.sr3-sum');h&&confetti(h,s.up&&s.up.length?44:30)}}}
const __srRAD=renderAppDemo;renderAppDemo=function(){const r=__srRAD.apply(this,arguments);try{srPost()}catch(e){console.error('Smart Review post-render',e)}return r};

function updateBadges(){const n=dueList().length+srList().filter(x=>x.r.due>Date.now()).length;const d=dueList().length;document.querySelectorAll('.app-nav button[data-p="review"] .nbadge').forEach(e=>e.remove());if(d){document.querySelectorAll('.app-nav button[data-p="review"]').forEach(b=>b.insertAdjacentHTML('beforeend',`<em class="nbadge">${d}</em>`))}}
appNav=function(){const it=[['subjects','Home'],['search','Search'],['quiz','Quiz'],['review','Review']];const grp={subjects:['subjects','specialties','topics','questions','menu','saved','wrong'],quiz:['quiz','quizrun','quizresult','quizhistory']};
 return `<div class="app-nav">${it.map(([id,n])=>`<button data-p="${id}" class="${(grp[id]||[id]).includes(appPage)?'active':''}" onclick="appPage='${id}';renderAppDemo()">${NAVI[id]}<span>${n}</span>${id==='review'&&dueList().length?`<em class="nbadge">${dueList().length}</em>`:''}</button>`).join('')}</div>`};
/* drawer: Saved / Wrong answers work, Smart review badge is live */
DR2[1][1][0][1]='saved';DR2[1][1][1][1]='wrong';
const __menu=menuView;
menuView=function(){if(appPage==='saved'||appPage==='wrong'){qs.spec='all';qs.topic=0;qs.tag='all';qs.filter=appPage==='saved'?'bookmarked':'incorrect';return questionBankView()}return __menu()};
const __td=toggleDrawer;
toggleDrawer=function(f){const n=dueList().length;DR2[1][1][2][3]=n?String(n):'';return __td(f)};
/* leaving the bank leaves fullscreen */
const __rad=renderAppDemo;
renderAppDemo=function(){if(qs.full&&appPage!=='questions'){qs.full=false;const ph=$('.phone');ph&&ph.classList.remove('qfull');renderFullExit();try{document.fullscreenElement&&document.exitFullscreen()}catch(e){}}
 __rad.apply(this,arguments);if(qs.full)renderFullExit();updateBadges()};
/* ============================================================
   MASCOT, INTRO, QUESTION DEMO, GRADE STAIRS
   ============================================================ */
window.SHB_HOLO_SRC='/assets/img/ae021c4b89a5.webp';
introScreen=function(){return screenShell(`<div class="intro-brand"><img src="${ICON_SRC}" alt=""><b>Shbace <span>Medical</span></b></div>
 <div class="in6-stage" aria-hidden="true"><div class="in6-comp">
 <div class="shb-holo" data-holo aria-hidden="true"><div class="shb-holo__halo"><i></i></div><img class="shb-holo__img" src="${window.SHB_HOLO_SRC}" alt="" decoding="async"><img class="shb-holo__glow" src="${window.SHB_HOLO_SRC}" alt="" decoding="async"><div class="shb-holo__ecg"><div class="shb-holo__lit"><i></i></div></div></div>
 <div class="in6-hub waves"><i class="in6-ring"></i><i class="in6-ring"></i><i class="in6-ring"></i><i class="in6-orbit"></i></div>
 <div class="in6-hub core"><div class="in6-core"><img src="${IMG.iconBig}" alt="Shbace Medical"></div></div>
 <div class="in6-chip c1 ic-img"><img src="/assets/img/f677b975daa9.webp" alt="" decoding="async"></div>
 <div class="in6-chip c2 ic-img"><img src="/assets/img/eff42ab27cab.webp" alt="" decoding="async"></div>
 <div class="in6-chip c3 ic-img"><img src="/assets/img/4f1fe9eb829b.webp" alt="" decoding="async"></div>
 <div class="in6-chip c4 ic-img"><img src="/assets/img/3e72ffb1d6d4.webp" alt="" decoding="async"></div>
 <span class="in6-sp s1">✦</span><span class="in6-sp s2">✦</span></div></div>${footer()}`,'intro in6')};

let qdTimers=[],qdTok=0;const qdClear=()=>{qdTok++;qdTimers.forEach(clearTimeout);qdTimers=[]};
const QD_OPTS=['Radial pulse palpation','Carotid artery auscultation','Electrocardiography (ECG)','Chest X-ray'];
quizDemo=function(){
 return screenShell(`<div class="screen-kicker">SEE HOW LEARNING WORKS · SAMPLE 01</div><div class="screen-heading">Try a medical question.</div><p class="hero-sub">Choose an answer and watch the Shbace character react.</p>
 <div class="qd-stage" id="qdStage">
 <div class="question-box qd" id="qd"><div class="question-meta"><span>CARDIOVASCULAR · SAMPLE MCQ</span><span>01 / 01</span></div><div class="question-text qd-in" style="animation-delay:0s">What is the most common method used to assess heart rate in a conscious adult?</div>
 <div class="options">${QD_OPTS.map((t,i)=>`<button class="option qd-in" data-l="${'ABCD'[i]}" style="animation-delay:${.05+i*.06}s" onclick="chooseDemo('${'ABCD'[i]}')"><span class="letter">${'ABCD'[i]}</span><span>${t}</span></button>`).join('')}</div></div>
 <div class="question-box qd qd-sheet" id="qdSheet" aria-live="polite"><div class="qd-grab" id="qdGrab" data-noswipe role="separator" aria-orientation="horizontal" aria-label="Drag to resize the explanation"><i></i></div><button type="button" class="qd-skip" id="qdSkip" data-noswipe onclick="qdSkip()">Skip</button><div class="qd-sheet-body" id="qdSheetBody"></div></div>
 </div>
 <div class="feedback-box" id="qdFb" style="display:none"></div>
 <div class="reaction-row" id="qdReact"><div class="qd-hint">Tap an answer</div></div>
 <div class="screen-foot" id="qdFoot">${dots()}<span class="tiny">Tap an answer</span></div>`,'qd-screen')};
const QD_WHY={A:'Palpating the radial pulse at the wrist is the quickest and most widely used bedside method. It needs no equipment, and in a conscious adult the rate can be counted in 30–60 seconds while you also feel rhythm and volume.',
 B:'The carotid is palpated, not auscultated, and mainly in emergencies or when peripheral pulses are weak. Pressing on it can also trigger reflex bradycardia.',
 C:'Accurate, but it needs a machine and electrodes. An ECG is used to assess rhythm and conduction, not as the routine way to count the rate.',
 D:'A chest X-ray shows heart size and the lung fields. It gives no information about heart rate.'};
function qdW(t){return t.split(' ').map(w=>`<span class="qd-w">${w}</span>`).join(' ')}
const QD_TAKE='Pulse by touch (radial) is the fastest, equipment-free way to check heart rate at the bedside.';
function qdExplain(letter){const ok=letter==='A';
 const row=l=>`<div class="qd-step qd-row" data-say="${l==='B'?'Next one — a common mix-up.':l==='C'?'Accurate, but not for this job.':'This one tells us nothing about rate.'}"><span class="qd-l bad">${l}</span><div><b>${QD_OPTS['ABCD'.indexOf(l)]}<span class="qd-x">✕</span></b><p class="qd-ty">${qdW(QD_WHY[l])}</p></div></div>`;
 const others=['B','C','D'].filter(l=>l!==letter);
 return `<div class="question-meta"><span>CARDIOVASCULAR · SAMPLE MCQ</span><span>EXPLANATION</span></div>
 <div class="qd-prog"><i id="qdProg"></i></div>
 <div class="qd-exp">
 <div class="qd-step qd-res ${ok?'ok':'no'}" data-say="${ok?'Nice! Let me show you why that works.':'No worries — we will walk through it together.'}"><i>${ok?'✓':'✕'}</i><div><b>${ok?'Correct!':'Not quite'}</b><small>${ok?'You picked A · '+QD_OPTS[0]:'You picked '+letter+' · '+QD_OPTS['ABCD'.indexOf(letter)]}</small></div></div>
 ${ok?'':`<div class="qd-step qd-row you" data-say="First, why your pick does not fit."><span class="qd-l bad">${letter}</span><div><b>${QD_OPTS['ABCD'.indexOf(letter)]}<span class="qd-you">YOUR ANSWER</span></b><p class="qd-ty">${qdW(QD_WHY[letter])}</p></div></div>`}
 <div class="qd-step qd-card" data-say="${ok?'Here is the reasoning behind A.':'And here is the right answer.'}"><div class="qd-ch"><span class="qd-l good">A</span><b>${QD_OPTS[0]}</b><em>Correct answer</em></div><p class="qd-ty">${qdW(QD_WHY.A)}</p></div>
 <div class="qd-step qd-sub" data-say="Now let us rule out the others.">${ok?'Why not the others?':'And the other options'}</div>
 <div class="qd-list">${others.map(row).join('')}</div>
 <div class="qd-step qd-take" data-say="Remember this one!"><i>💡</i><div><small>KEY TAKEAWAY</small><p class="qd-ty">${qdW(QD_TAKE)}</p></div></div>
 </div>`}
chooseDemo=function(letter,auto){qdClear();const box=$('#qd');if(!box||box.dataset.done)return;box.dataset.done='1';demoAnswer=letter;
 const ok=letter==='A';if(ok)wrongStreak=0;else wrongStreak++;
 const tap=box.querySelector('.qd-tap');tap&&tap.remove();
 box.querySelectorAll('.option').forEach(o=>{o.style.pointerEvents='none';o.style.animation='none';o.style.opacity='1';if(o.dataset.l==='A')o.classList.add('correct');else if(o.dataset.l===letter)o.classList.add('incorrect')});
 const fb=$('#qdFb');fb.style.display='none';
 const sheet=$('#qdSheet'),body=$('#qdSheetBody'),tok=qdTok;
 body.innerHTML=qdExplain(letter);sheet.classList.add('qd-playing');
 $('#qdReact').innerHTML=`<div class="qd-coach"><span class="qd-avatar" id="qdAv">${mascot('thinking','mascot small')}</span><div class="qd-bubble"><span class="qd-dots"><i></i><i></i><i></i></span><span id="qdSay"></span></div></div>`;
 if(ok){qdTimers.push(setTimeout(()=>{if(document.body.contains(box))confetti(box,24)},160))}
 /* The swap is driven by the character's real position: when it has risen to its resting place above the arrows, the answer card recedes and the explanation takes its space. */
 qdWatchCoach(()=>{if(tok!==qdTok||!document.body.contains(box))return;
  box.classList.add('qd-recede');sheet.classList.add('on');
  qdTimers.push(setTimeout(()=>{if(tok!==qdTok||!document.body.contains(box))return;qdSheetReady();qdPlay(body,letter,ok)},760))},tok)};
const QD_TRIG_PX=16;
function qdWatchCoach(go,tok){
 const row=$('#qdReact'),co=row&&row.querySelector('.qd-coach');let done=false;const t0=performance.now();
 const fire=()=>{if(done)return;done=true;go()};
 if(!co||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){fire();return}
 const tick=()=>{if(done||tok!==qdTok||!co.isConnected)return;
  const dy=co.getBoundingClientRect().top-row.getBoundingClientRect().top;
  if(dy<=QD_TRIG_PX||performance.now()-t0>2200){fire();return}
  requestAnimationFrame(tick)};
 requestAnimationFrame(tick)}
/* After the automatic hand-over the explanation becomes a draggable sheet: drag the handle down to bring the answer back, up to give the explanation more room. */
function qdSheetReady(){
 const st=$('#qdStage'),sh=$('#qdSheet'),gr=$('#qdGrab'),card=$('#qd');if(!st||!sh||!gr||!card||sh.dataset.rdy)return;sh.dataset.rdy='1';
 card.classList.remove('qd-recede');card.style.opacity='0';card.style.pointerEvents='none';sh.classList.add('ready');
 const full=()=>st.clientHeight,low=()=>Math.max(92,Math.min(full()-card.offsetHeight-10,full()-92));
 let drag=false,y0=0,h0=0,moved=false;
 const paint=h=>{const f=full(),l=low(),p=f>l?(f-h)/(f-l):0;card.style.opacity=String(Math.max(0,Math.min(1,p*1.3-.1)));card.style.transform='translate3d(0,'+(-8*(1-Math.min(1,p)))+'px,0)'};
 const setH=(h,anim)=>{const f=full(),l=low();h=Math.max(l,Math.min(f,h));sh.style.transition=anim?'height .4s cubic-bezier(.22,.8,.24,1)':'none';
  if(h>=f-1&&anim){sh.style.height=f+'px';setTimeout(()=>{if(sh.isConnected)sh.style.height=''},430)}else sh.style.height=h+'px';
  card.style.transition=anim?'opacity .4s ease,transform .4s ease':'none';paint(h);return h};
 const snap=()=>{const f=full(),l=low(),h=sh.getBoundingClientRect().height;setH(h<(f+l)/2?l:f,true)};
 gr.addEventListener('pointerdown',e=>{drag=true;moved=false;y0=e.clientY;h0=sh.getBoundingClientRect().height;sh.style.transition='none';try{gr.setPointerCapture(e.pointerId)}catch(_){}e.stopPropagation()});
 gr.addEventListener('pointermove',e=>{if(!drag)return;const dy=e.clientY-y0;if(Math.abs(dy)>3)moved=true;setH(h0-dy,false);e.stopPropagation()});
 const end=e=>{if(!drag)return;drag=false;if(!moved){const f=full();setH(sh.getBoundingClientRect().height>=f-2?low():f,true)}else snap()};
 gr.addEventListener('pointerup',end);gr.addEventListener('pointercancel',end)}
function qdMorph(box,mutate){mutate()}
function qdMood(m){const a=$('#qdAv');if(a)a.innerHTML=mascot(m,'mascot small')}
function qdSay(txt,cb){const el=$('#qdSay'),d=document.querySelector('.qd-dots');if(!el)return;el.textContent='';if(d)d.classList.add('on');
 qdTimers.push(setTimeout(()=>{if(d)d.classList.remove('on');const ws=txt.split(' ');let i=0;const t=()=>{if(!document.body.contains(el))return;el.textContent=ws.slice(0,++i).join(' ');if(i<ws.length)qdTimers.push(setTimeout(t,55));else cb&&cb()};t()},520))}
function qdFollow(el){try{const b=el.closest('.qd-sheet-body');if(!b)return;const d=el.getBoundingClientRect().bottom-b.getBoundingClientRect().bottom+14;if(d>0)b.scrollBy({top:d,behavior:'smooth'})}catch(e){}}
function qdFinish(ok){qdMood(ok?'celebrate':'encourage');qdSay(ok?'You are getting the hang of this — tap the arrow!':'Good effort — you will remember this next time. Tap the arrow!');const sk=$('#qdSkip');sk&&(sk.style.display='none');const nb=document.querySelector('#qdFoot .ob-arrow:last-of-type');nb&&nb.classList.add('qd-pulse')}
function qdPlay(box,letter,ok){
 const steps=[...box.querySelectorAll('.qd-step')];let i=0;const prog=box.querySelector('#qdProg');
 box.__steps=steps;
 const next=()=>{if(!document.body.contains(box))return;
  if(i>=steps.length){qdFinish(ok);return}
  const st=steps[i++];st.classList.add('qd-show');if(prog)prog.style.width=Math.round(i/steps.length*100)+'%';
  setTimeout(()=>qdFollow(st),320);setTimeout(()=>qdFollow(st),760);
  qdMood(st.classList.contains('qd-res')?(ok?'happy':'wrong'):'explaining');
  const ty=st.querySelector('.qd-ty');
  const go=()=>{qdTimers.push(setTimeout(next,ty?650:480))};
  qdSay(st.dataset.say||'',()=>{});
  if(ty){const ws=[...ty.querySelectorAll('.qd-w')];let k=0;
   qdTimers.push(setTimeout(()=>{const t=()=>{if(!document.body.contains(box))return;ws[k++].classList.add('on');if(k%6===0)qdFollow(st);if(k<ws.length)qdTimers.push(setTimeout(t,62));else go()};t()},900))}
  else qdTimers.push(setTimeout(go,1500));
 };
 qdTimers.push(setTimeout(next,350))}
function qdSkip(){qdClear();const body=$('#qdSheetBody');if(!body)return;qdSheetReady();(body.__steps||[...body.querySelectorAll('.qd-step')]).forEach(st=>{st.classList.add('qd-show','qd-now');st.querySelectorAll('.qd-w').forEach(w=>w.classList.add('on'))});
 const pr=body.querySelector('#qdProg');pr&&(pr.style.width='100%');const el=$('#qdSay'),d=document.querySelector('.qd-dots');d&&d.classList.remove('on');el&&(el.textContent='');qdFinish(demoAnswer==='A')}
window.qdSkip=qdSkip;
resetDemoQuestion=function(){demoAnswer=null;renderSlide()};
function qdAuto(){qdClear();const box=$('#qd');if(!box||demoAnswer!==null)return;
 const target=box.querySelector('.option[data-l="A"]');
 qdTimers.push(setTimeout(()=>{if(!document.body.contains(box)||box.dataset.done)return;
  const br=box.getBoundingClientRect(),tr=target.getBoundingClientRect();
  const f=document.createElement('span');f.className='qd-tap';f.style.left=(br.width-40)+'px';f.style.top=(tr.top-br.top+tr.height+22)+'px';box.appendChild(f);
  requestAnimationFrame(()=>{f.style.left=(tr.left-br.left+tr.width*.55)+'px';f.style.top=(tr.top-br.top+tr.height*.55)+'px'});
  qdTimers.push(setTimeout(()=>{f.classList.add('press')},440));
  qdTimers.push(setTimeout(()=>chooseDemo('A',true),560));
 },900))}

/* grade stairs — articulated character rig (canvas). One canvas, one figure, jointed limbs, IK legs, real 3/4 turn.
   Source art = the supplied reference board only: side / three-quarter / front views were cut into body parts
   (head, torso, upper-arm, forearm, hand, thigh, shin, foot). Hair is part of the head/body pixels, so it can never change. */
let gxCur=0,gxWant=null,gxBusy=false,gxM=null,gxOri='F',gxReady=false,gxLoadP=null;
window.gxIsBusy=()=>gxBusy;
/* the step the character stands on glows softly (position taken from the PNG tap areas, so it follows resizes) */
let gxLit=0;
const GXCOL=[[305,561,544],[561,843,448],[843,1133,352],[1133,1436,241],[1436,1745,199]];   /* [left,right,top] of each column in the stairs PNG (whole block, lid included) */
/* every column the character has reached stays lit (steady); the column he stands on pulses stronger. The light is the art itself, brighter, clipped to the column, so it follows the real block edges (no fog). */
function gxStepLight(n,walking){gxLit=n;const box=document.getElementById('gxSteps'),art=document.getElementById('gxArt');if(!box||!gxM||!art)return;
 const old=document.getElementById('gxSg');if(old)old.remove();
 const m=gxM;
 for(let i=1;i<=5;i++){let e=document.getElementById('gxCol'+i);
  if(i>n){if(e)e.remove();continue}
  const c=GXCOL[i-1],cls=(i===n&&!walking)?'cur':'done';
  if(!e){e=document.createElement('img');e.id='gxCol'+i;e.alt='';e.draggable=false;e.setAttribute('aria-hidden','true');e.src=art.src;e.className='gx-col '+cls;e.dataset.s=cls;art.after(e)}
  else if(e.dataset.s!==cls){e.className='gx-col '+cls;e.dataset.s=cls}
  e.style.width=m.W+'px';e.style.top=m.imgTop+'px';
  e.style.clipPath='inset('+(c[2]*m.k)+'px '+((GXA.w-c[1])*m.k)+'px 0px '+(c[0]*m.k)+'px)'}}
function gxSyncNext(){if(!document.getElementById('gradeStage'))return;const a=document.querySelector('.screen-foot.ob-foot .ob-arrow:last-child');if(a)a.classList.toggle('ob-wait',!selectedGrade||gxBusy)}
const GXR={"side":{"cx":65,"fl":543,"J":{"S":[57,148],"E":[59,205],"W":[84,266],"H":[65,292],"K":[60.5,400],"A":[56,507],"N":[62,92]},"P":{"head":{"u":"/assets/img/06c844c183a0.webp","ox":26,"oy":7,"w":89,"h":118},"torso":{"u":"/assets/img/d4632b485ae9.webp","ox":22,"oy":86,"w":91,"h":214},"ua":{"u":"/assets/img/42bd3b093f74.webp","ox":29,"oy":118,"w":58,"h":107},"fo":{"u":"/assets/img/502f0b2cc385.webp","ox":40,"oy":189,"w":59,"h":94},"ha":{"u":"/assets/img/efe8e129ad85.webp","ox":70,"oy":252,"w":39,"h":60},"th":{"u":"/assets/img/fd8d749b2524.webp","ox":28,"oy":275,"w":83,"h":143},"sh":{"u":"/assets/img/487cb96f774e.webp","ox":24,"oy":389,"w":62,"h":131},"ft":{"u":"/assets/img/b2195d6d16d0.webp","ox":20,"oy":495,"w":89,"h":49}},"pv":{"head":"N","torso":"H","ua":"S","fo":"E","ha":"W","th":"H","sh":"K","ft":"A"}},"front":{"cx":95.5,"fl":543,"J":{"S":[36,128],"E":[27,212],"W":[27,268],"LH":[68,296],"RH":[122,296],"SW":[76,56]},"P":{"body":{"u":"/assets/img/ac73ee96c449.webp","ox":9,"oy":5,"w":171,"h":301},"ua":{"u":"/assets/img/f70716f688d5.webp","ox":10,"oy":104,"w":46,"h":126},"fo":{"u":"/assets/img/a9279685d76c.webp","ox":14,"oy":197,"w":26,"h":84},"ha":{"u":"/assets/img/8b12a1776573.webp","ox":18,"oy":257,"w":30,"h":58},"legL":{"u":"/assets/img/c7e9a973364f.webp","ox":37,"oy":289,"w":60,"h":255},"legR":{"u":"/assets/img/164d909841d4.webp","ox":96,"oy":289,"w":78,"h":255},"sh":{"u":"/assets/img/e6504fb5ef48.webp","ox":66,"oy":25,"w":62,"h":48}},"pv":{"body":"LH","ua":"S","fo":"E","ha":"W","legL":"LH","legR":"RH","sh":"SW"}},"q34":{"cx":78.5,"fl":543,"J":{"O":[0,0]},"P":{"all":{"u":"/assets/img/0f0a5457afc6.webp","ox":10,"oy":7,"w":133,"h":537}},"pv":{"all":"O"}}};
/* salute arm: ONE separate, pre-posed arm image (sleeve + arm + flat hand). Aligned to the front-view right shoulder; shown only in the salute pose, the original ua/fo/ha arm is hidden then. */
GXR.front.P.sa={"u":"/assets/img/b198e5a2368c.webp","ox":-33.5,"oy":30,"w":109.6,"h":102.9};GXR.front.pv.sa="S";
const GXI={},GXC={};                                   /* GXI: decoded images · GXC: device-resolution mip canvases (+ darkened copies) */
const gxRot=(x,y,a)=>{const c=Math.cos(a),s=Math.sin(a);return[x*c-y*s,x*s+y*c]};
const gxSm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const gxClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* monotone cubic keyframes (no overshoot → a planted foot can never sink through a tread) */
function gxSpl(keys){const n=keys.length,t=keys.map(k=>k[0]),y=keys.map(k=>k[1]),d=[],m=[];
 for(let i=0;i<n-1;i++)d[i]=(y[i+1]-y[i])/(t[i+1]-t[i]);
 m[0]=0;m[n-1]=0;for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
 for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=0;m[i+1]=0}else{const a=m[i]/d[i],b=m[i+1]/d[i],h=a*a+b*b;if(h>9){const q=3/Math.sqrt(h);m[i]=q*a*d[i];m[i+1]=q*b*d[i]}}}
 return x=>{if(x<=t[0])return y[0];if(x>=t[n-1])return y[n-1];let i=0;while(x>t[i+1])i++;
  const h=t[i+1]-t[i],s=(x-t[i])/h,s2=s*s,s3=s2*s;
  return(2*s3-3*s2+1)*y[i]+(s3-2*s2+s)*h*m[i]+(-2*s3+3*s2)*y[i+1]+(s3-s2)*h*m[i+1]}}
function gxLoad(){if(gxLoadP)return gxLoadP;const jobs=[];
 for(const v in GXR){GXI[v]={};for(const k in GXR[v].P){const P=GXR[v].P[k],J=GXR[v].J[GXR[v].pv[k]];P.px=J[0]-P.ox;P.py=J[1]-P.oy;
  const im=new Image();jobs.push(new Promise(r=>{im.onload=()=>{try{(im.decode?im.decode():Promise.resolve()).then(r,r)}catch(e){r()}};im.onerror=r}));im.src=P.u;GXI[v][k]=im}}
 gxLoadP=Promise.all(jobs).then(()=>{gxReady=true;return true});return gxLoadP}
/* pre-scale every part to the exact on-screen pixel size (crisp edges, no shimmer while limbs rotate) */
const GXCACHE={};
function gxPrep(only){if(!gxReady||!gxM)return;const tg=Math.min(1,gxM.f*gxM.dpr),tkey=Math.round(tg*1000);
 for(const v in GXR){if(only&&v!==only)continue;const ck=v+'@'+tkey;if(GXCACHE[ck]){GXC[v]=GXCACHE[ck];continue}GXC[v]={};for(const k in GXR[v].P){const im=GXI[v][k];if(!im||!im.naturalWidth)continue;
  let cur=im,sc=1;
  while(sc*.5>=tg){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(cur.width*.5));c.height=Math.max(1,Math.round(cur.height*.5));
   const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(cur,0,0,c.width,c.height);cur=c;sc*=.5}
  const f=document.createElement('canvas');f.width=Math.max(1,Math.round(im.naturalWidth*tg));f.height=Math.max(1,Math.round(im.naturalHeight*tg));
  const fx=f.getContext('2d');fx.imageSmoothingQuality='high';fx.drawImage(cur,0,0,f.width,f.height);
  const d=document.createElement('canvas');d.width=f.width;d.height=f.height;const dx=d.getContext('2d');dx.drawImage(f,0,0);
  dx.globalCompositeOperation='source-atop';dx.fillStyle='rgba(3,9,38,0)';dx.fillRect(0,0,d.width,d.height);   /* far-side limbs: shade removed (same colour as the near side) */
  GXC[v][k]={c:f,d:d,pr:f.width/im.naturalWidth}}GXCACHE[ck]=GXC[v]}}
/* ===== v37: Grade stairs now use the supplied PNG (1774x887, transparent). Numbers below are measured on that PNG:
   p[n] = [x,y] of the point where the soles touch the TOP surface of step n (n=0 flat start plate, 1..5 = Grade 1..5);
   hit[n-1] = [left,right,top] of each step's tap area; bot = lowest opaque row. ===== */
const GX_STAIRS_PNG='/assets/img/abd2eb421fe3.png';
const GXA={w:1774,bot:788,p:[[168,733],[443,629],[703,536],[990,441],[1288,345],[1592,234]],hit:[[300,565,595],[565,845,505],[845,1137,408],[1137,1440,316],[1440,1745,203]]};
/* v47: the stage may now use the side padding (4 px from the screen edge) and the character is no longer capped at .40, so stairs and
   character grow TOGETHER (same ratio as the approved design). Height is no longer wasted above the top step. A fit loop shrinks the pair
   only if the page would otherwise scroll, so nothing is ever clipped or pushed under the footer. */
function gxSH(W,s){return Math.round(554*(W/GXA.w)+2+461*s+50)}
function gxFit(stage){
 try{const par=stage.parentElement;if(!par)return;
  const key=innerWidth+'x'+innerHeight+'|'+par.clientWidth+'x'+par.clientHeight;
  if(stage.__gxKey===key&&stage.style.width)return;          /* geometry stays fixed while the character climbs / a grade is chosen */
  stage.style.minHeight='0px';stage.style.flex='0 0 auto';
  const cs=getComputedStyle(par),pl=parseFloat(cs.paddingLeft)||0,pr=parseFloat(cs.paddingRight)||0;
  const inner=par.clientWidth-pl-pr,maxW=Math.max(inner,par.clientWidth-8);
  /* height budget from the real sibling heights (stage excluded); reserve room for the taller "Grade N subjects" card shown after a choice */
  let others=0,n=0;for(const c of par.children){if(c===stage)continue;const q=getComputedStyle(c);if(q.position==='absolute'||q.position==='fixed'||q.display==='none')continue;
   others+=c.getBoundingClientRect().height;if(q.position!=='sticky')others+=(parseFloat(q.marginTop)||0)+(parseFloat(q.marginBottom)||0);n++}
  const sm=getComputedStyle(stage);others+=(parseFloat(sm.marginTop)||0)+(parseFloat(sm.marginBottom)||0)+(parseFloat(cs.rowGap)||0)*n+40;
  const avail=par.clientHeight-(parseFloat(cs.paddingTop)||0)-(parseFloat(cs.paddingBottom)||0)-others;
  let W=Math.min(maxW,Math.floor((avail-36)/.9197));W=Math.max(290,W);
  const s=Math.min(.62,(W-26)/(6*126.5));
  stage.style.width=W+'px';stage.style.marginLeft=stage.style.marginRight=((inner-W)/2)+'px';stage.style.height=gxSH(W,s)+'px';
  stage.__gxKey=key}catch(e){console.error('gxFit',e)}}
function gxLayout(){const stage=$('#gradeStage');if(!stage)return null;
 gxFit(stage);
 const W=stage.clientWidth||322,d=12,base=22,r=d+4;
 const s=Math.min(.62,(W-26)/(6*126.5)),sw=126.5*s,inc=67*s,H=461*s;
 const X1=W-r-5*sw,SH=gxSH(W,s);
 stage.style.height=SH+'px';stage.style.setProperty('--d',d+'px');
 const f=s*.863,k=W/GXA.w,imgTop=SH-GXA.bot*k-2,swN=(GXA.p[5][0]-GXA.p[1][0])/4*k;
 gxM={W,d,base,s,sw:swN,inc,H,X1,SH,f,k,imgTop,RUN:swN/f,RISE:inc/f,dpr:Math.min(3,window.devicePixelRatio||1)};
 const art=document.getElementById('gxArt');if(art){art.style.width=W+'px';art.style.top=imgTop+'px'}
 const cv=document.getElementById('gxCv');
 if(cv){const w=Math.round(W*gxM.dpr),h=Math.round(SH*gxM.dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}cv.style.width=W+'px';cv.style.height=SH+'px'}
 gxPrep();return gxM}
const gxR=n=>gxAX(n);          /* planted (rear) shoe x on level n — kept for the reaction pop */
const gxY=n=>{const m=gxM,i=Math.max(0,Math.min(5,n));return m.SH-(m.imgTop+GXA.p[i][1]*m.k)};          /* tread surface (bottom coordinate) */
const gxAX=n=>GXA.p[Math.max(0,Math.min(5,n))][0]*gxM.k;         /* figure centre x on level n */
const gxAY=n=>gxM.SH-gxY(n);                                       /* tread surface in canvas coordinates */
function gxPos(n){const m=gxM||gxLayout();return{l:gxR(n),b:gxY(n)}}
function gxBuild(){const m=gxLayout();if(!m)return;
 document.querySelectorAll('#gradeStage .gx-step').forEach((el,i)=>{const b=GXA.hit[i];if(!b)return;const top=m.imgTop+b[2]*m.k;el.style.left=(b[0]*m.k)+'px';el.style.width=((b[1]-b[0])*m.k)+'px';el.style.height=(m.SH-top)+'px'});
 const pl=$('#gxPlinth');if(pl){pl.style.width=m.X1+'px';pl.style.height=m.base+'px'}
 gxStepLight(gxLit)}
function gxShadowC(cx,bottom,w){const sh=$('#gxShadow');if(!sh)return;sh.style.width=w+'px';sh.style.left=(cx-w/2)+'px';sh.style.bottom=(bottom-4)+'px'}
function gxCtx(){const cv=document.getElementById('gxCv');if(!cv||!gxM||!gxReady||!GXC.side)return null;
 const c=cv.getContext('2d');c.setTransform(gxM.dpr,0,0,gxM.dpr,0,0);c.clearRect(0,0,gxM.W,gxM.SH);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';return c}
/* draw one part: pivot at (x,y) in the current (anchor-relative) space */
function gxPart(c,v,k,x,y,rot,sx,sy,dark){const g=GXC[v][k],P=GXR[v].P[k];if(!g)return;const f=gxM.f,sc=f/g.pr;
 c.save();c.translate(x,y);if(rot)c.rotate(rot);c.scale((sx||1)*sc,(sy||1)*sc);c.drawImage(dark?g.d:g.c,-P.px*g.pr,-P.py*g.pr);c.restore()}
const gxRel=(v,p)=>{const R=GXR[v],f=gxM.f;return[(p[0]-R.cx)*f,(p[1]-R.fl)*f]};   /* source point → anchor-relative px */

/* ---------------- side view rig ---------------- */
function gxSideRest(){const f=gxM.f,J=GXR.side.J,H=gxRel('side',J.H),A=gxRel('side',J.A);
 return{hip:H,lean:0,head:0,legs:[{a:[A[0],A[1]],ft:0},{a:[A[0]-4*f,A[1]],ft:0}],arms:[[0,0,0],[0,0,0]]}}
function gxLeg(c,ax,hip,tx,ty,ft,dark){const f=gxM.f,J=GXR.side.J,L1=Math.hypot(J.K[0]-J.H[0],J.K[1]-J.H[1])*f,L2=Math.hypot(J.A[0]-J.K[0],J.A[1]-J.K[1])*f;
 let dx=tx-hip[0],dy=ty-hip[1],d=Math.hypot(dx,dy);const mx=(L1+L2)*.9995,mn=Math.abs(L1-L2)+.01;
 if(d>mx){tx=hip[0]+dx*mx/d;ty=hip[1]+dy*mx/d;dx=tx-hip[0];dy=ty-hip[1];d=mx}else if(d<mn){d=mn}
 const a=Math.atan2(dy,dx),al=Math.acos(gxClamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1));
 const k1=[hip[0]+L1*Math.cos(a+al),hip[1]+L1*Math.sin(a+al)],k2=[hip[0]+L1*Math.cos(a-al),hip[1]+L1*Math.sin(a-al)];
 const kn=k1[0]>=k2[0]?k1:k2;                                   /* knee always bends forward */
 const r1=Math.atan2(J.K[1]-J.H[1],J.K[0]-J.H[0]),r2=Math.atan2(J.A[1]-J.K[1],J.A[0]-J.K[0]);
 const th=Math.atan2(kn[1]-hip[1],kn[0]-hip[0])-r1,sh=Math.atan2(ty-kn[1],tx-kn[0])-r2;
 gxPart(c,'side','ft',tx,ty,ft,1,1,dark);gxPart(c,'side','sh',kn[0],kn[1],sh,1,1,dark);gxPart(c,'side','th',hip[0],hip[1],th,1,1,dark)}
function gxArm(c,sw,lean,ang,dark){const f=gxM.f,J=GXR.side.J,v=(a,b)=>[(b[0]-a[0])*f,(b[1]-a[1])*f];
 const a1=lean+ang[0],a2=a1+ang[1],a3=a2+ang[2],e=gxRot(...v(J.S,J.E),a1),w=gxRot(...v(J.E,J.W),a2),E=[sw[0]+e[0],sw[1]+e[1]],W=[E[0]+w[0],E[1]+w[1]];
 gxPart(c,'side','ha',W[0],W[1],a3,1,1,dark);gxPart(c,'side','fo',E[0],E[1],a2,1,1,dark);gxPart(c,'side','ua',sw[0],sw[1],a1,1,1,dark)}
/* P: {hip,lean,head,legs:[near,far],arms:[near,far]} — all anchor-relative px */
function gxDrawSide(c,ax,ay,face,P){const f=gxM.f,J=GXR.side.J;
 c.save();c.translate(ax,ay);c.scale(face,1);
 const hp=P.hip,sh=gxRot((J.S[0]-J.H[0])*f,(J.S[1]-J.H[1])*f,P.lean),sw=[hp[0]+sh[0],hp[1]+sh[1]];
 const nk=gxRot((J.N[0]-J.H[0])*f,(J.N[1]-J.H[1])*f,P.lean),nw=[hp[0]+nk[0],hp[1]+nk[1]];
 gxArm(c,sw,P.lean,P.arms[1],true);                                         /* far arm (behind the torso) */
 gxLeg(c,ax,[hp[0]-4*f,hp[1]],P.legs[1].a[0],P.legs[1].a[1],P.legs[1].ft,true);   /* far leg */
 gxLeg(c,ax,hp,P.legs[0].a[0],P.legs[0].a[1],P.legs[0].ft,false);                  /* near leg */
 gxPart(c,'side','head',nw[0],nw[1],P.lean+P.head,1,1,false);
 gxPart(c,'side','torso',hp[0],hp[1],P.lean,1,1,false);
 gxArm(c,sw,P.lean,P.arms[0],false);                                        /* near arm (in front) */
 c.restore()}

/* ---------------- front view rig (turn finish, heel click, salute) ---------------- */
function gxFrontRest(){return{dx:0,dy:0,leg:0,arm:[0,0,0],s:[1,1]}}
function gxDrawFront(c,ax,ay,face,F){const f=gxM.f,J=GXR.front.J,rl=p=>gxRel('front',p);
 c.save();c.translate(ax+(F.dx||0),ay+(F.dy||0));c.scale(face,1);
 const L=rl(J.LH),R=rl(J.RH);
 gxPart(c,'front','legL',L[0],L[1],-F.leg,1,1,false);gxPart(c,'front','legR',R[0],R[1],F.leg,1,1,false);
 gxPart(c,'front','body',L[0],L[1],0,1,1,false);
 const S=rl(J.S),a1=F.arm[0],a2=a1+F.arm[1],a3=a2+F.arm[2],s1=F.s[0],s2=F.s[1];
 const e=gxRot((J.E[0]-J.S[0])*f*s1,(J.E[1]-J.S[1])*f*s1,a1),E=[S[0]+e[0],S[1]+e[1]];
 const w=gxRot((J.W[0]-J.E[0])*f*s2,(J.W[1]-J.E[1])*f*s2,a2),W=[E[0]+w[0],E[1]+w[1]];
 const sa=gxClamp(F.sa||0,0,1);   /* 0 = original arm (exactly as before) · 1 = salute-arm image; in between = short dissolve between the two */
 if(sa<1){if(sa>0)c.globalAlpha=1-sa;
  if(!(F.sh>=1))gxPart(c,'front','ha',W[0],W[1],a3,s2,s2,false);gxPart(c,'front','fo',E[0],E[1],a2,s2,s2,false);gxPart(c,'front','ua',S[0],S[1],a1,s1,s1,false);
  c.globalAlpha=1}
 if(sa>0)gxSaluteArmDraw(c,sa);
 if(F.sh>0){c.globalAlpha=gxClamp(F.sh,0,1);gxPart(c,'front','sh',W[0],W[1],(a2-4.19+(F.shr||0)),s2*.95,s2*.95,false);c.globalAlpha=1}
 c.restore()}
function gxSaluteArmDraw(c,al){const R=GXR.front,P=R.P.sa,g=GXC.front&&GXC.front.sa,im=g?g.c:(GXI.front&&GXI.front.sa);if(!P||!im||!(im.naturalWidth||im.width))return;
 const f=gxM.f;c.save();c.globalAlpha=al;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 c.drawImage(im,(P.ox-R.cx)*f,(P.oy-R.fl)*f,P.w*f,P.h*f);c.restore()}
function gxDrawQ(c,ax,ay,face){const R=GXR.q34,f=gxM.f;c.save();c.translate(ax,ay);c.scale(face,1);
 const o=gxRel('q34',[0,0]);gxPart(c,'q34','all',o[0],o[1],0,1,1,false);c.restore()}

/* ---------------- orientation views + the real 3/4 turn ---------------- */
function gxFig(c,ori,ax,ay,pose){const face=ori==='L'?-1:1;
 if(ori==='R'||ori==='L')gxDrawSide(c,ax,ay,face,pose||gxSideRest());else if(ori==='F')gxDrawFront(c,ax,ay,1,pose||gxFrontRest());else if(ori==='Q'||ori==='Ql')gxDrawQ(c,ax,ay,ori==='Ql'?-1:1)}
let gxScr=null;
function gxBlend(c,ori,ax,ay,a,pose){                      /* incoming view fades in OVER a solid outgoing view — the stage never goes empty and never holds two separate figures */
 if(!gxScr)gxScr=document.createElement('canvas');const cv=document.getElementById('gxCv');if(gxScr.width!==cv.width||gxScr.height!==cv.height){gxScr.width=cv.width;gxScr.height=cv.height}
 const x=gxScr.getContext('2d');x.setTransform(gxM.dpr,0,0,gxM.dpr,0,0);x.clearRect(0,0,gxM.W,gxM.SH);x.imageSmoothingQuality='high';gxFig(x,ori,ax,ay,pose);
 c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=gxClamp(a,0,1);c.drawImage(gxScr,0,0);c.restore()}
/* turn profile (right-facing) → front: side · 3/4 · front, aligned on the same floor point and body axis. u:0=side … 1=front */
function gxTurnDraw(c,u,ax,ay,mir){const prof=mir?'L':'R',q=mir?'Ql':'Q';
 if(u<.22)gxFig(c,prof,ax,ay);
 else if(u<.36){gxFig(c,prof,ax,ay);gxBlend(c,q,ax,ay,gxSm((u-.22)/.14))}
 else if(u<.55)gxFig(c,q,ax,ay);
 else if(u<.69){gxFig(c,q,ax,ay);gxBlend(c,'F',ax,ay,gxSm((u-.55)/.14))}
 else gxFig(c,'F',ax,ay)}
function gxRaf(dur,fn){return new Promise(res=>{const t0=performance.now();let done=false;
 const fin=()=>{if(done)return;done=true;res()};
 const tick=now=>{if(!document.getElementById('gxCv')){fin();return}const u=Math.min(1,(now-t0)/dur);fn(u);if(u>=1)fin();else requestAnimationFrame(tick)};
 requestAnimationFrame(tick);setTimeout(fin,dur+4000)})}
/* turn to a target orientation: R ↔ F ↔ L (always passing through the real 3/4 view) */
async function gxTurnTo(target,dur){if(gxOri===target)return;const n=gxCur,ax=gxAX(n),ay=gxAY(n),m=gxM;dur=dur||520;
 const path=gxOri==='R'&&target==='F'?[['R',0,1]]:gxOri==='F'&&target==='R'?[['R',1,0]]:gxOri==='F'&&target==='L'?[['L',1,0]]:gxOri==='L'&&target==='F'?[['L',0,1]]:gxOri==='R'&&target==='L'?[['R',0,1],['L',1,0]]:[['L',0,1],['R',1,0]];
 for(const[side,a,b]of path){await gxRaf(dur,u=>{const c=gxCtx();if(!c)return;gxTurnDraw(c,a+(b-a)*gxSm(u),ax,ay,side==='L')});}
 gxOri=target;gxRender(n)}
function gxRender(n,pose){const c=gxCtx();if(!c)return;const ax=gxAX(n),ay=gxAY(n);gxFig(c,gxOri==='Q'?'F':gxOri,ax,ay,pose)}
function gxPlace(n){gxLit=n;gxBuild();if(!gxReady){gxLoad().then(()=>{if(gxM)gxPlace(n)});return}
 const m=gxM;if(!m)return;gxCur=n;gxPrep();gxRender(n);const ax=gxAX(n);gxShadowC(ax,gxY(n),80*m.s);
 document.querySelectorAll('.gx-step').forEach((el,j)=>{el.classList.toggle('on',n>0&&j===n-1);el.classList.toggle('passed',j<n-1)})}

/* ---------------- stairs: one real step, both directions ---------------- */
/* All maths are in "source px" relative to the start tread; hip/ankles are positions, limbs are solved by IK so a planted foot never slides. */
function gxStepFn(dir,lead,runO,riseO){const m=gxM,f=m.f,RUN=runO||m.RUN,RISE=riseO||m.RISE,q=RISE/77.6,r=RUN/146.6,J=GXR.side.J;
 const hip0=[0,J.H[1]-GXR.side.fl],aY=J.A[1]-GXR.side.fl,aX=J.A[0]-GXR.side.cx,Lt=Math.hypot(J.K[0]-J.H[0],J.K[1]-J.H[1])+Math.hypot(J.A[0]-J.K[0],J.A[1]-J.K[1]),Llim=Lt*.985;
 const hipEnd=[RUN,hip0[1]-dir*RISE],dY=-dir*RISE;
 const up=dir>0;
 /* hip path (u→[x,y]) */
 const hx=gxSpl(up?[[0,0],[.12,4],[.36,14],[.46,22],[.58,RUN*.57],[.70,RUN*.95],[.80,RUN],[1,RUN]]:[[0,0],[.14,8],[.30,RUN*.31],[.44,RUN*.58],[.60,RUN*.85],[.72,RUN],[1,RUN]]);
 const hy=gxSpl(up?[[0,hip0[1]],[.12,hip0[1]+8*q],[.36,hip0[1]+8*q],[.46,hip0[1]+13*q],[.58,hip0[1]-34*q],[.70,hip0[1]-71*q],[.80,hipEnd[1]+3],[.90,hipEnd[1]+8*q],[1,hipEnd[1]]]
  :[[0,hip0[1]],[.14,hip0[1]+14*q],[.30,hip0[1]+61*q],[.44,hip0[1]+101*q],[.60,hip0[1]+91*q],[.72,hipEnd[1]+3],[.86,hipEnd[1]+1],[1,hipEnd[1]]]);
 const lean=gxSpl(up?[[0,0],[.12,.05],[.40,.11],[.55,.15],[.70,.08],[.90,.02],[1,0]]:[[0,0],[.20,-.03],[.44,-.06],[.62,.03],[.85,.01],[1,0]]);
 /* lead foot */
 const lx=gxSpl(up?[[.12,0],[.22,7*r],[.32,69*r],[.40,RUN*.88],[.46,RUN]]:[[.14,0],[.24,38*r],[.34,RUN*.7],[.44,RUN]]);
 const ly=gxSpl(up?[[.12,0],[.22,-72*q],[.32,-114*q],[.40,-99*q],[.46,dY]]:[[.14,0],[.24,-28*q],[.34,-22*q],[.44,dY]]);
 const lf=gxSpl(up?[[.12,0],[.22,.25],[.32,-.12],[.40,-.10],[.46,0]]:[[.14,0],[.24,-.10],[.34,.14],[.44,0]]);
 const hipAt=u=>[hx(u),hy(u)];
 /* trailing foot: planted → heel lifts about the toe (no slide) → leaves the tread → swings → lands */
 function trail(u,off){const a0=[aX+off,aY],toe=[a0[0]+50,0],v=[a0[0]-toe[0],a0[1]-toe[1]];
  const tsw=up?.70:.60,te=up?.90:.88;
  const ankAt=ph=>{const r=gxRot(v[0],v[1],ph);return[toe[0]+r[0],toe[1]+r[1]]};
  const pose=uu=>{const hh=[hx(uu)+off,hy(uu)];let ph=0,a=a0;
   if(Math.hypot(a[0]-hh[0],a[1]-hh[1])>Llim){ph=.55;for(let p=0;p<=.55;p+=.01){const q=ankAt(p);if(Math.hypot(q[0]-hh[0],q[1]-hh[1])<=Llim){ph=p;break}}
    a=ankAt(ph);const d=Math.hypot(a[0]-hh[0],a[1]-hh[1]);if(d>Llim)a=[hh[0]+(a[0]-hh[0])*Llim/d,hh[1]+(a[1]-hh[1])*Llim/d]}
   return{a,ph}};
  if(u<tsw)return pose(u);
  const p0=pose(tsw),end=[a0[0]+RUN,a0[1]+dY];
  if(u>=te)return{a:end,ph:0};
  const s=(u-tsw)/(te-tsw),e=gxSm(s);
  const x=p0.a[0]+(end[0]-p0.a[0])*e,y=p0.a[1]+(end[1]-p0.a[1])*(up?e:gxSm(Math.min(1,s*1.25)))-(up?12:30)*Math.sin(Math.PI*s);
  return{a:[x,y],ph:p0.ph*(1-e)+(up?-.08:-.05)*Math.sin(Math.PI*s)}}
 const swing=gxSpl(up?[[0,0],[.40,1],[.68,0],[.82,-1],[1,0]]:[[0,0],[.34,.8],[.55,0],[.78,-.8],[1,0]]);
 const t0=up?.12:.14;
 return u=>{const legs=[0,1].map(i=>{const off=i?-4:0;
   if(i===lead){return u<t0?{a:[aX+off,aY],ft:0}:{a:[aX+off+lx(u),aY+ly(u)],ft:lf(u)}}
   const t=trail(u,off);return{a:t.a,ft:t.ph}});
  const w=swing(u),arms=[0,1].map(i=>{const a1=(i===lead?1:-1)*.36*w;return[a1,-(.18+.45*Math.max(0,-a1)/.36),0]});
  const ln=lean(u);
  return{hip:[hx(u)*f,hy(u)*f],lean:ln,head:-ln*.7,legs:legs.map(l=>({a:[l.a[0]*f,l.a[1]*f],ft:l.ft})),arms}}}
async function gxStep(from,to){const m=gxM;if(!m||!gxReady||!document.getElementById('gxCv'))return;
 const up=to>from,ax=gxAX(from),ay=gxAY(from),f=m.f;
 if(up&&gxOri!=='R')await gxTurnTo('R');if(!up&&gxOri!=='L')await gxTurnTo('L');
 const face=up?1:-1,lead=(from+(up?0:1))%2;           /* alternate the leading leg */
 const fn=gxStepFn(up?1:-1,lead,Math.abs(gxAX(to)-gxAX(from))/f,Math.abs(gxAY(from)-gxAY(to))/f),dur=up?1050:1000,dx=(gxAX(to)-ax),dy=(gxAY(to)-ay);
 await gxRaf(dur,u=>{const c=gxCtx();if(!c)return;const P=fn(u);
  gxDrawSide(c,ax,ay,face,P);
  /* shadow follows the supporting foot: old tread → new tread while the weight moves across */
  const w=gxSm((u-(up?.46:.44))/.24),sx=ax+dx*w,sy=gxY(from)+(gxY(to)-gxY(from))*w;gxShadowC(sx,sy,80*m.s);
  if(u>.9&&u<1){/* settle bob already inside the keyframes */}});
 gxCur=to;gxRender(to);gxShadowC(gxAX(to),gxY(to),80*m.s)}

/* ---------------- arrival: stop → turn to the student (real 3/4) → feet together → right-hand salute → hold → lower → turn back ---------------- */

function gxGlow(n){const st=$('#gradeStage'),m=gxM;if(!st||!m||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const ax=gxAX(n),b=gxY(n),rw=m.sw*.9,rh=Math.max(10,m.sw*.2),els=[],add=(cls,css,life)=>{const e=document.createElement('i');e.className=cls;e.style.cssText=css;st.appendChild(e);els.push(e);return e};
 add('gx-fx gx-fx-halo',`left:${ax-m.H*.55}px;bottom:${b-m.H*.02}px;width:${m.H*1.1}px;height:${m.H*1.1}px`);
 add('gx-fx gx-fx-ring',`left:${ax-rw/2}px;bottom:${b-rh/2}px;width:${rw}px;height:${rh}px`);
 add('gx-fx gx-fx-ring r2',`left:${ax-rw/2}px;bottom:${b-rh/2}px;width:${rw}px;height:${rh}px`);
 add('gx-fx gx-fx-gleam',`left:${ax+rw*.3}px;bottom:${b-7}px`);
 for(let i=0;i<14;i++){const s=2+Math.random()*2.6,w=Math.random()<.45;
  add('gx-fx gx-fx-p',`left:${ax+(Math.random()-.5)*rw*.8}px;bottom:${b+Math.random()*6}px;width:${s}px;height:${s}px;background:${w?'#fff':'#6ab4ff'};--dy:${-(46+Math.random()*(m.H*.5))}px;--dx:${(Math.random()-.5)*16}px;animation-delay:${Math.random()*.5}s`)}
 setTimeout(()=>els.forEach(e=>e.remove()),2300)}
const gxWait=ms=>new Promise(r=>setTimeout(r,ms));
async function gxSalute(n,celebrate){const m=gxM,st=$('#gradeStage');if(!m||!st||!gxReady||!document.getElementById('gxCv'))return;
 const ax=gxAX(n),ay=gxAY(n),f=m.f;
 await gxWait(260);                                          /* stands still, body settled */
 if(gxWant!==null)return;
 await gxTurnTo('F',520);                                    /* 3/4 → front, gradual */
 if(!document.getElementById('gxCv'))return;
 await gxWait(140);
 if(gxWant!==null)return;
 /* heel click: legs swing in about the hips, tiny hop */
 await gxRaf(300,u=>{const c=gxCtx();if(!c)return;const F=gxFrontRest();F.leg=.066*gxSm(Math.min(1,u*1.6));F.dy=-5*f*3*Math.sin(Math.PI*u)*.5;gxDrawFront(c,ax,ay,1,F)});
 const sp=document.createElement('i');sp.className='gx-click';sp.style.left=ax+'px';sp.style.bottom=(gxY(n)-6)+'px';st.appendChild(sp);setTimeout(()=>sp.remove(),450);
 try{navigator.vibrate&&navigator.vibrate(12)}catch(e){}
 await gxWait(240);
 if(gxWant!==null)return;
 /* salute restored (original timeline); v49: afterwards the character stays facing the student (no turn back to the side) */
 const drawF=(c,sa,leg)=>{const F=gxFrontRest();F.leg=leg;F.sa=sa;gxDrawFront(c,ax,ay,1,F)};
 await gxRaf(620,u=>{const c=gxCtx();if(!c)return;drawF(c,gxSm(Math.min(1,u/.34)),.066)});
 gxFace('happy',{l:ax-12*m.s,b:gxY(n)});if(celebrate)gxGlow(n);
 await gxRaf(1150,u=>{const c=gxCtx();if(!c)return;drawF(c,1,.066)});   /* holds the salute */
 await gxRaf(520,u=>{const c=gxCtx();if(!c)return;drawF(c,1-gxSm(Math.min(1,u/.4)),.066)});   /* salute arm dissolves back */
 await gxRaf(240,u=>{const c=gxCtx();if(!c)return;const F=gxFrontRest();F.leg=.066*(1-gxSm(u));gxDrawFront(c,ax,ay,1,F)});   /* feet relax */
 await gxWait(140);
 gxPlace(n)}   /* ends in the front view (gxOri==='F'): standing, facing the user */

const GXBADGE='/assets/img/7d7d3e277629.webp';
function gxFace(kind,p){return;/* face popup beside the character removed */const st=$('#gradeStage'),m=gxM;if(!st)return;
 const im=document.createElement('img');im.className='gx-face-pop';im.alt=kind==='celebrate'?'Celebrating':'Happy';
 im.src=GXBADGE;
 im.style.left=Math.max(2,p.l-34*m.s-72)+'px';im.style.bottom=(p.b+m.H*.55)+'px';st.appendChild(im);setTimeout(()=>im.remove(),2700)}
function gxSave(n){try{localStorage.setItem('shbace_onboarding_v3_grade',String(n))}catch(e){}}
gradeScreen=function(){
 return screenShell(`<div class="screen-kicker">MAKE IT YOUR LEARNING SPACE</div><div class="screen-heading">Which grade are you in?</div><p class="hero-sub">Choose your current study year. The character climbs Grade 1, then Grade 2, and continues one step at a time.</p>
 <div class="gx" id="gradeStage"><div class="gx-glow"></div><div class="gx-floor"></div><div class="gx-steps" id="gxSteps"><img class="gx-art" id="gxArt" src="${GX_STAIRS_PNG}" alt="" draggable="false">${[1,2,3,4,5].map(n=>`<button type="button" class="gx-step ${n===5?'last':''} ${selectedGrade===n?'on':''} ${selectedGrade&&n<selectedGrade?'passed':''}" onclick="selectGrade(${n})" aria-label="Select Grade ${n}"></button>`).join('')}</div><i class="gx-shadow" id="gxShadow"></i><div class="gx-actor" id="gxMan"><canvas id="gxCv" class="gx-cv" aria-hidden="true"></canvas></div></div>
 ${gradeSubjectsBlock()}<div class="grade-hint">${selectedGrade?`Grade ${selectedGrade} selected · You can change it later.`:'Choose your current study year to continue.'}</div>
 <div class="screen-foot">${dots()}</div>`)};
selectGrade=async function(n){
 const stage=$('#gradeStage');
 if(!stage){selectedGrade=n;renderSlide();return}
 if(gxBusy){if(n!==selectedGrade){gxWant=n;selectedGrade=n;document.querySelectorAll('.grade-select').forEach((el,j)=>el.classList.toggle('active',j===n-1))}return}   /* new tap mid-motion → retarget, never replay */
 const hint=document.querySelector('.grade-hint');const cont=document.querySelector('.screen-foot .primary-btn');
 const from=gxCur,calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 selectedGrade=n;
 if(n===from){                                            /* no new progress → no replay */
  gxPlace(n);document.querySelectorAll('.grade-select').forEach((el,j)=>el.classList.toggle('active',j===n-1));
  if(hint)hint.textContent=`Grade ${n} selected · You can change it later.`;updateGradeSubjects();if(cont)cont.disabled=false;gxSave(n);gxSyncNext();return}
 const token=++gradeAnimationToken;gxBusy=true;gxSyncNext();
 if(cont)cont.disabled=true;
 const steps=document.querySelectorAll('.gx-step');stage.classList.add('climbing');gxLayout();
 let goingUp=n>from;
 if(hint)hint.textContent=goingUp?`Starting the climb to Grade ${n}…`:`Moving to Grade ${n}…`;
 let seq=[];if(goingUp){for(let i=from+1;i<=n;i++)seq.push(i)}else{for(let i=from-1;i>=n;i--)seq.push(i)}
 await wait(calm?30:260);
 let prev=from;
 for(let ix=0;ix<seq.length;ix++){const i=seq[ix];
  if(token!==gradeAnimationToken){gxBusy=false;gxSyncNext();return}
  gxStepLight(prev,true);if(!calm)await gxStep(prev,i);
  gxPlace(i);gxCur=i;
  steps[i-1]&&(steps[i-1].classList.remove('pulse'),void steps[i-1].offsetWidth,steps[i-1].classList.add('pulse'));
  document.querySelectorAll('.grade-select').forEach((el,j)=>el.classList.toggle('active',j===i-1));
  if(hint)hint.textContent=goingUp?`Climbing… Grade ${i} of ${n}`:`Grade ${i}`;
  prev=i;await wait(calm?40:goingUp?170:90);
  if(gxWant!==null){const w=gxWant;gxWant=null;n=w;selectedGrade=w;goingUp=w>prev;seq=[];if(goingUp){for(let k=prev+1;k<=w;k++)seq.push(k)}else{for(let k=prev-1;k>=w;k--)seq.push(k)}ix=-1}}
 gxSave(n);
 if(hint)hint.textContent=`You reached Grade ${n}. Your study space is ready.`;updateGradeSubjects();
 if(cont)cont.disabled=false;
 if(!calm){try{await gxSalute(n,goingUp)}catch(e){console.error(e);gxPlace(n)}}else if(goingUp)gxFace('happy',gxPos(n));
 gxBusy=false;stage.classList.remove('climbing');gxSyncNext();
 if(gxWant!==null){const w=gxWant;gxWant=null;selectedGrade=gxCur;return selectGrade(w)}};
Object.assign(window,{selectGrade,chooseDemo,resetDemoQuestion});

/* post-render hooks (slide animations, resize) */
/* ------------------------------------------------------------------
   Onboarding lifecycle refinement
   Grade selection is slide 5 (zero-based). Build the stair geometry and
   place the same Canvas-rig character as soon as the screen is rendered,
   before the learner taps any grade. The finish screen uses the same
   individual rig parts for a short 3-cycle hand wave; no portrait image.
------------------------------------------------------------------- */
let jrGreetingToken=0;
function jrCanvasFrames(canvas,duration,draw){return new Promise(resolve=>{
 const start=performance.now();let done=false;
 const finish=()=>{if(done)return;done=true;resolve()};
 const frame=now=>{if(!canvas||!canvas.isConnected){finish();return}const u=Math.min(1,(now-start)/duration);draw(u);if(u>=1)finish();else requestAnimationFrame(frame)};
 requestAnimationFrame(frame);setTimeout(finish,duration+2500);
})}
async function jrStartWelcomeWave(){
 const canvas=document.getElementById('jrWelcomeCanvas');if(!canvas)return;
 const token=++jrGreetingToken;
 try{await gxLoad()}catch(e){console.warn('Welcome character assets could not load',e);return}
 if(token!==jrGreetingToken||!canvas.isConnected)return;
 const box=canvas.getBoundingClientRect(),w=Math.max(44,box.width||66),h=Math.max(90,box.height||132),dpr=Math.min(2.5,window.devicePixelRatio||1);
 /* Scale the same rig used on the stairs to fit the mountain milestone. */
 gxM=Object.assign({},gxM||{},{W:w,SH:h,dpr,f:Math.min(.255,(h-7)/543)});
 canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
 const ctx=canvas.getContext('2d');if(!ctx)return;
 gxPrep('front');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const ax=w/2,ay=h-3;
 const paint=(lift,wrist,bob,shift=0)=>{
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.save();
  const F=gxFrontRest();F.arm=[1.82*lift,2.28*lift,wrist];F.s=[1+.035*lift,1+.035*lift];F.dy=bob;F.dx=shift;
  gxDrawFront(ctx,ax,ay,1,F);ctx.restore();
 };
 paint(0,0,0);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced){paint(.92,0,0);return}
 /* Raise the same arm, make three clear wrist waves, then lower it naturally. */
 await jrCanvasFrames(canvas,560,u=>{const e=u*u*(3-2*u);paint(.92*e,0,-1.1*Math.sin(u*Math.PI),0)});
 if(token!==jrGreetingToken||!canvas.isConnected)return;
 await jrCanvasFrames(canvas,1740,u=>{const wrist=Math.sin(u*Math.PI*6)*.34;const bob=-.7*Math.sin(u*Math.PI*6);const tilt=Math.sin(u*Math.PI*6)*.5;paint(.92,wrist,bob,tilt)});
 if(token!==jrGreetingToken||!canvas.isConnected)return;
 await jrCanvasFrames(canvas,480,u=>{const e=1-u;paint(.92*e,Math.sin((1-u)*Math.PI*6)*.12,-.6*Math.sin(u*Math.PI))});
 if(token===jrGreetingToken&&canvas.isConnected)paint(0,0,0);
}
const __rs=renderSlide;
renderSlide=function(){qdClear();__rs.apply(this,arguments);
 if(mode==='preview'){
  if(slide===1)qdAuto();
  if(slide===5){requestAnimationFrame(()=>{if(document.getElementById('gradeStage'))gxPlace(selectedGrade||0)})}
  if(slide===6){cpMountFinish();requestAnimationFrame(()=>{cpMountFinish();setTimeout(jrStartWelcomeWave,140)})}
 }};
addEventListener('resize',()=>{
 if(mode!=='preview')return;
 if(slide===5&&!gxBusy)requestAnimationFrame(()=>gxPlace(selectedGrade||0));
 if(slide===6)requestAnimationFrame(()=>{if(window.cpScene)window.cpScene.fit();jrStartWelcomeWave()});
});
/* ============================================================
   SETTINGS — theme, font size, bank layout, backup/restore, progress reset
   ============================================================ */
const SKEY='shbace_settings_v1';
const SET=Object.assign({theme:'dark',font:'medium',view:'all',doctor:'on',obFirst:'off',obLast:'off',lastBackup:null},LS.get(SKEY,{}));
try{if(LS.get(SKEY,null)===null){const lt=localStorage.getItem('shbace_theme');if(lt)SET.theme=lt==='light'?'light':'dark'}}catch(e){}
const ENUM={theme:['dark','light'],font:['small','medium','large'],view:['single','all'],doctor:['on','off'],obFirst:['on','off'],obLast:['on','off']};
const FZ={small:.92,medium:1,large:1.1};
Object.keys(ENUM).forEach(k=>{if(!ENUM[k].includes(SET[k]))SET[k]={theme:'dark',font:'medium',view:'all',doctor:'on',obFirst:'off',obLast:'off'}[k]});
window.__SET=SET;   /* v47: lets the global onboarding router read the real, persisted switches */
function persistSettings(){LS.set(SKEY,SET);try{localStorage.setItem('shbace_theme',SET.theme)}catch(e){}}
function applySettings(){const ph=$('.phone');if(ph){ph.classList.toggle('light',SET.theme==='light');ph.classList.toggle('nodoc',SET.doctor==='off')}document.body.classList.toggle('nodoc',SET.doctor==='off');document.documentElement.style.setProperty('--fz',FZ[SET.font]||1);qs.view=SET.view}
window.setSet=function(k,v){if(!ENUM[k]||!ENUM[k].includes(v))return;SET[k]=v;persistSettings();applySettings();if(mode==='app')renderAppDemo();else if(mode==='preview')renderSlide()};
toggleTheme=function(){setSet('theme',SET.theme==='light'?'dark':'light')};
const __sv=window.setView;window.setView=function(v){SET.view=v;persistSettings();__sv(v)};
const __ht=hdrTap;hdrTap=function(n){if(n==='Settings'){appPage='settings';renderAppDemo();return}__ht(n)};
DR2.forEach(g=>g[1].forEach(it=>{if(it[0]==='Settings')it[1]='settings'}));
const __menu2=menuView;menuView=function(){return appPage==='settings'?settingsView():__menu2()};

function confirmBox(o,fn){const old=$('#cfwrap');old&&old.remove();const h=document.createElement('div');h.id='cfwrap';h.className='xwrap';
 h.innerHTML=`<div class="xbk" onclick="cfClose()"></div><div class="xsheet" role="alertdialog"><div class="xhead"><h3>${esc(o.title)}</h3></div><p class="xnote" style="margin:6px 0 0;font-size:15px;color:inherit">${esc(o.text)}</p>${o.detail?`<p class="xnote">${esc(o.detail)}</p>`:''}<div class="cfbtns"><button type="button" class="btn" onclick="cfClose()">Cancel</button><button type="button" class="btn ${o.danger?'danger':'primary'}" id="cfOk">${esc(o.ok)}</button></div></div>`;
 ($('.phone')||document.body).appendChild(h);$('#cfOk').onclick=()=>{cfClose();fn()}}
window.cfClose=function(){const h=$('#cfwrap');h&&h.remove()};

let rTopic=1;
function settingsView(){
 const answers=Object.values(S.ans),n=answers.length,ok=answers.filter(a=>a.ok).length;
 const seg=(k,items)=>`<div class="seg wide">${items.map(([v,l])=>`<button type="button" class="${SET[k]===v?'on':''}" onclick="setSet('${k}','${v}')">${l}</button>`).join('')}</div>`;
 const row=(t,d,c)=>`<div class="setrow"><b>${t}</b><small>${d}</small>${c}</div>`;
 const topics=[];Object.values(REAL.spec).forEach(sp=>sp.topics.forEach(t=>topics.push([String(t[0]),t[1]])));
 const tn=QB.filter(q=>q.topic===rTopic&&S.ans[q.id]).length;
 const last=SET.lastBackup?'Last backup: '+new Date(SET.lastBackup).toLocaleString():'No backup created yet.';
 return `${appHeader('Settings')}<div class="rs"><h1>Settings</h1><p class="sub">Appearance, backup and study progress</p>
 <div class="card setcard"><h3>Appearance</h3>
  ${row('Theme','Dark or light for the whole app',seg('theme',[['dark','Dark'],['light','Light']]))}
  ${row('Font size','Scales text and controls',seg('font',[['small','Small'],['medium','Medium'],['large','Large']]))}
  ${row('Question Bank layout','Default view when you open a topic',seg('view',[['single','Single'],['all','All']]))}
  <div class="setrow"><b dir="rtl"><bdi>شخصية الطبيب والتعابير</bdi></b><small dir="rtl">تظهر تعبيرات الطبيب داخل العنصر المرتبط بالحدث فقط، وبعد الإجابة في الأسئلة</small><button type="button" class="drsw ${SET.doctor==='on'?'on':''}" role="switch" aria-checked="${SET.doctor==='on'}" aria-label="شخصية الطبيب والتعابير" onclick="setSet('doctor','${SET.doctor==='on'?'off':'on'}')"><i></i><span>${SET.doctor==='on'?'ON':'OFF'}</span></button></div></div>
 <div class="card setcard"><h3>Onboarding</h3>
  <div class="setrow"><b>First Onboarding Page</b><small>When ON, the welcome page is shown at app start. Turn it OFF to skip it.</small><button type="button" class="drsw ${SET.obFirst==='on'?'on':''}" role="switch" aria-checked="${SET.obFirst==='on'}" aria-label="First Onboarding Page" onclick="setSet('obFirst','${SET.obFirst==='on'?'off':'on'}')"><i></i><span>${SET.obFirst==='on'?'ON':'OFF'}</span></button></div>
  <div class="setrow"><b>Last Onboarding Page</b><small>When ON, the final “Your journey starts here” page is shown at app start. Turn it OFF to skip it.</small><button type="button" class="drsw ${SET.obLast==='on'?'on':''}" role="switch" aria-checked="${SET.obLast==='on'}" aria-label="Last Onboarding Page" onclick="setSet('obLast','${SET.obLast==='on'?'off':'on'}')"><i></i><span>${SET.obLast==='on'?'ON':'OFF'}</span></button></div></div>
 <input type="file" id="bkFile" accept=".json,application/json" hidden onchange="restoreBackup(this)">
 <div class="card setcard"><h3>Study progress</h3><p class="meta">${n} answered · ${ok} correct</p><p class="meta">Reset clears answers and progress only. Saved questions, notes, reports and Smart Review are kept.</p>
  <div class="setrow"><b>Reset one topic</b>${ddHTML('rtopic',topics,String(rTopic))}<button type="button" class="btn danger block" style="margin-top:10px" ${tn?'':'disabled'} onclick="resetTopicAsk()">Reset topic progress${tn?` (${tn})`:''}</button></div>
  <div class="setrow"><b>Reset everything</b><button type="button" class="btn danger block" style="margin-top:10px" ${n?'':'disabled'} onclick="resetAllAsk()">Reset all study progress${n?` (${n})`:''}</button></div></div></div>`}
const __dp=window.ddPick;window.ddPick=function(id,v,e){if(id==='rtopic'){e&&e.stopPropagation();qs.dd=null;rTopic=+v;renderAppDemo();return}__dp(id,v,e)};
window.resetTopicAsk=function(){const ids=QB.filter(q=>q.topic===rTopic&&S.ans[q.id]).map(q=>q.id);if(!ids.length)return;
 confirmBox({title:'Reset topic progress?',text:`This clears ${ids.length} answer${ids.length>1?'s':''} in “${TOPIC_NAME[rTopic]}”.`,detail:'Saved questions, notes, reports and Smart Review are kept. This cannot be undone.',ok:'Reset topic',danger:true},()=>{ids.forEach(i=>delete S.ans[i]);qs.streak=0;save();renderAppDemo();toast(`Topic progress reset (${ids.length})`)})};
window.resetAllAsk=function(){const n=Object.keys(S.ans).length;if(!n)return;
 confirmBox({title:'Reset all study progress?',text:`This clears all ${n} answer${n>1?'s':''} and your progress.`,detail:'Saved questions, notes, reports and Smart Review are kept. This cannot be undone. Export a backup first if unsure.',ok:'Reset all',danger:true},()=>{S.ans={};qs.streak=0;save();renderAppDemo();toast('All study progress reset')})};

window.exportBackup=function(){
 let grade=null;try{grade=localStorage.getItem('shbace_onboarding_v3_grade')}catch(e){}
 const obj={app:'Shbace Medical',format:'backup',version:1,exportedAt:new Date().toISOString(),data:{qb:{ans:S.ans,saved:S.saved,notes:S.notes,rep:S.rep,sr:S.sr},settings:{theme:SET.theme,font:SET.font,view:SET.view,obFirst:SET.obFirst,obLast:SET.obLast},grade}};
 const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download='shbace-medical-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();
 setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},4000);
 SET.lastBackup=Date.now();persistSettings();renderAppDemo();toast('Backup file created')};
const isObj=o=>o&&typeof o==='object'&&!Array.isArray(o);
function validateBackup(obj){
 if(!isObj(obj)||obj.app!=='Shbace Medical')throw new Error('not a Shbace Medical backup');
 if(obj.version!==1)throw new Error('unsupported version');
 if(!isObj(obj.data)||!isObj(obj.data.qb))throw new Error('missing data');
 const q=obj.data.qb,out={ans:{},saved:{},notes:{},rep:{},sr:{}},idOk=k=>/^[A-Za-z]{2,8}-[A-Za-z0-9-]{1,12}$/.test(k);
 for(const f of Object.keys(out)){if(q[f]===undefined)continue;if(!isObj(q[f]))throw new Error(f+' is malformed');if(Object.keys(q[f]).length>20000)throw new Error('too many entries')}
 for(const [k,v] of Object.entries(q.ans||{})){if(!idOk(k)||!isObj(v)||!Number.isInteger(v.sel)||v.sel<0||v.sel>9||typeof v.ok!=='boolean')throw new Error('invalid answer record');out.ans[k]={sel:v.sel,ok:v.ok,t:Number.isFinite(v.t)?v.t:0,...(typeof v.pr==='string'?{pr:v.pr.slice(0,40)}:{}),...(typeof v.msg==='string'?{msg:v.msg.slice(0,120)}:{})}}
 for(const f of ['saved','rep']){for(const k of Object.keys(q[f]||{})){if(!idOk(k))throw new Error('invalid '+f+' id');out[f][k]=1}}
 for(const [k,v] of Object.entries(q.notes||{})){if(!idOk(k)||typeof v!=='string'||v.length>5000)throw new Error('invalid note');out.notes[k]=v}
 for(const [k,v] of Object.entries(q.sr||{})){if(!idOk(k)||!isObj(v)||!Number.isFinite(v.due)||!Number.isFinite(v.added))throw new Error('invalid Smart Review record');out.sr[k]={added:v.added,due:v.due,stage:Number.isInteger(v.stage)?v.stage:0,...(Number.isFinite(v.last)?{last:v.last}:{})}}
 let st=null;if(obj.data.settings!==undefined){if(!isObj(obj.data.settings))throw new Error('settings are malformed');st={};for(const k of Object.keys(ENUM)){const v=obj.data.settings[k];if(v===undefined)continue;if(!ENUM[k].includes(v))throw new Error('invalid setting: '+k);st[k]=v}}
 const g=obj.data.grade;const grade=(g===null||g===undefined)?null:(['1','2','3','4','5'].includes(String(g))?String(g):(()=>{throw new Error('invalid grade')})());
 return {qb:out,settings:st,grade}}
window.restoreBackup=function(input){const f=input.files&&input.files[0];input.value='';if(!f)return;
 if(f.size>8*1024*1024)return toast('Backup file is too large');
 const r=new FileReader();r.onerror=()=>toast('Could not read the file');
 r.onload=()=>{let clean;try{clean=validateBackup(JSON.parse(r.result))}catch(e){return toast('Invalid backup: '+(e instanceof SyntaxError?'not a JSON file':e.message))}
  const c=clean.qb,n=o=>Object.keys(o).length;
  confirmBox({title:'Restore this backup?',text:`Answers: ${n(c.ans)} · Saved: ${n(c.saved)} · Notes: ${n(c.notes)} · Reports: ${n(c.rep)} · Smart Review: ${n(c.sr)}`,detail:'Your current study data on this device will be replaced. Export a backup first if you want to keep it.',ok:'Restore',danger:true},()=>{
   S.ans=c.ans;S.saved=c.saved;S.notes=c.notes;S.rep=c.rep;S.sr=c.sr;qs.streak=0;qs.noteOpen={};save();
   if(clean.settings)Object.assign(SET,clean.settings);persistSettings();
   if(clean.grade){try{localStorage.setItem('shbace_onboarding_v3_grade',clean.grade)}catch(e){}selectedGrade=Number(clean.grade)}
   applySettings();updateBadges();renderAppDemo();toast('Backup restored')})};
 r.readAsText(f)};
/* ============================================================
   ABOUT · CHANGELOG · CONTACT & FEEDBACK · RATE · PINNED & RECENT
   ============================================================ */
const fmtDT=t=>{try{return new Date(t).toLocaleString()}catch(e){return ''}};
const specCount=()=>new Set(QB.map(q=>q.spec)).size;
const specList=()=>[...new Set(QB.map(q=>q.spec))].map(s=>SPEC_NAME[s]||s);
let clTab='all';
window.setClTab=function(t){clTab=t;renderAppDemo()};
const CHANGELOG=[
 {v:'Version 36',tag:'current',st:'done',items:[
  ['Quiz Mode','Timed and untimed quizzes built from the question bank, with saved quiz history.'],
  ['Study Statistics','Accuracy, answered questions, streak, study time and topic performance from your real answers.'],
  ['Study Timer','Focus session timer that keeps counting while you move between pages.'],
  ['Smart Review','Spaced-repetition review with due and difficulty information.'],
  ['Notifications','In-app notification centre for reminders and study updates.'],
  ['Backup & restore','One full student-data backup (export, restore or merge) in Settings; files are validated before anything changes.'],
  ['Question bank fixes','Cleaner explanations, corrected spelling slips, safer handling of invalid answer keys, and a clear error instead of sample questions if the bank cannot load.']]},
 {v:'Version 5.8',tag:'available',st:'done',items:[
  ['Settings','Theme (dark / light), font size (small / medium / large) and Question Bank layout (single / all), saved on this device.'],
  ['Backup & restore','JSON backup of answers, saved questions, notes, reports, Smart Review and settings. Files are validated, summarised and confirmed before restoring; invalid files are rejected without changing your data.'],
  ['Reset progress','Reset one topic or all topics. Saved questions, notes, reports and Smart Review are kept.'],
  ['About page','What the app is for, live question and specialty counts, and how your data is stored.'],
  ['Changelog page','This page.'],
  ['Contact & Feedback','Write feedback or report a problem. Entries are stored on this device and can be exported — nothing is sent anywhere.'],
  ['Rate this app','Star rating with optional comment, saved locally.'],
  ['Pinned & Recent','Pin topics and specialties; recently opened topics are listed automatically.']]},
 {v:'Earlier builds',tag:'foundation',st:'done',note:'Release dates were not recorded.',items:[
  ['Question Bank','Full bank embedded in the app, organised by specialty and topic, with filters (all / unanswered / correct / incorrect / bookmarked) and source tags.'],
  ['Answering','Instant correct / incorrect feedback with explanations; Single and All views; fullscreen reading mode.'],
  ['Study tools','Saved questions, personal notes, reported questions and a Wrong Answers list.'],
  ['Smart Review','Spaced-repetition queue with due counts and a badge in the navigation.'],
  ['Search','Search topics and question text.'],
  ['Start-up','Splash screen and first-run onboarding with grade selection.']]},
 {v:'Not available yet',tag:'planned',st:'dev',items:[
  ['More subjects','Only Pediatrics content is available.']]}];
function changelogView(){
 const sec=CHANGELOG.filter(s=>clTab==='all'||(clTab==='done'&&s.st==='done')||(clTab==='dev'&&s.st==='dev'));
 return `${appHeader('Changelog')}<div class="rs"><h1>Changelog</h1><p class="sub">What the app does today and what is still missing.</p>
 <div class="seg wide" style="margin-bottom:14px">${[['all','All'],['done','Available'],['dev','Not yet']].map(([v,l])=>`<button type="button" class="${clTab===v?'on':''}" onclick="setClTab('${v}')">${l}</button>`).join('')}</div>
 ${sec.map(s=>`<div class="card cl ${s.st}"><div class="clh"><h3>${s.v}</h3><span class="pill clp ${s.st}">${s.st==='dev'?'IN DEVELOPMENT':s.tag==='current'?'CURRENT':'AVAILABLE'}</span></div>${s.note?`<p class="meta">${s.note}</p>`:''}<ul class="cll">${s.items.map(([a,b])=>`<li><b>${a}</b><span>${b}</span></li>`).join('')}</ul></div>`).join('')}</div>`}
function aboutView(){
 return `${appHeader('About')}<div class="rs ab2"><h1>About</h1><p class="sub">Shbace Medical · Version 36</p>
 <div class="ab2-card"><h2>About Shbace Medical</h2><p>A journey of curiosity, knowledge, and continuous growth. Shbace Medical brings learning and practice together, empowering future physicians to think critically, build confidence, and grow beyond the classroom.<br><br>Learn with purpose. Grow with knowledge.</p></div>
 <div class="ab2-card"><h2>Purpose</h2><p>Designed to turn medical knowledge into clinical understanding through focused practice, meaningful explanations, and continuous self-assessment.<br><br>Practice. Understand. Improve.</p></div>
 <div class="ab2-card"><h2>At a Glance</h2><div class="ab2-stats"><div><b>${QB.length}</b><small>Total Questions</small></div><div><b>${specCount()}</b><small>Specialties</small></div><div><b>${Object.keys(TOPIC_NAME).length}</b><small>Topics</small></div></div></div>
 <div class="ab2-card"><h2>Key Features</h2><div class="ab2-feat"><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/><circle cx="18" cy="16" r="3"/></svg><span>Topic-Based Practice</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg><span>Detailed Explanations</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14.2 5"/><path d="M4 12a8 8 0 0 1 14.2-5"/><path d="M18.5 3v4.5H14"/><path d="M5.5 21v-4.5H10"/></svg><span>Smart Review</span></div><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg><span>Saved Questions &amp; Progress Tracking</span></div></div></div>
 <div class="ab2-card ab2-proj"><h2>Project</h2><b>${esc(ownerName)}</b><span>${esc(ownerLine)}</span><div class="ab2-btns"><button type="button" class="btn" onclick="appPage='changelog';renderAppDemo()">Changelog</button><button type="button" class="btn" onclick="appPage='feedback';renderAppDemo()">Send feedback</button></div></div>
 <div class="ab2-card ab2-ded ab2-ded-entry"><h2>One More Thing</h2>
  <p class="ded-mys">Curious? Tap below.</p>
  <button type="button" class="btn primary block ded-open" onclick="dedGate()">Tap to open</button></div>
 <div class="ab2-card ab2-disc"><h2>Medical Disclaimer</h2><p>Educational and examination practice only. Not intended to replace professional medical advice or clinical guidelines.</p></div></div>`}

/* ---- Pinned & Recent ---- */
const PKEY='shbace_pins_v1',RKEY='shbace_recent_v1';
const pkey=e=>e.k+':'+e.spec+':'+e.topic;
const okEntry=e=>isObj(e)&&(e.k==='topic'||e.k==='spec')&&typeof e.spec==='string'&&REAL.spec[e.spec]&&Number.isInteger(e.topic)&&(e.k==='spec'?e.topic===0:(e.topic===0||(REAL.spec[e.spec].topics.some(t=>t[0]===e.topic))))&&Number.isFinite(e.t);
const loadList=k=>{const v=LS.get(k,[]);return Array.isArray(v)?v.filter(okEntry):[]};
let PINS=loadList(PKEY),REC=loadList(RKEY);
const isPinned=(k,s,t)=>PINS.some(e=>pkey(e)===k+':'+s+':'+t);
function recordRecent(k,spec,topic){if(!REAL.spec[spec])return;const e={k,spec,topic,t:Date.now()};if(!okEntry(e))return;REC=[e,...REC.filter(x=>pkey(x)!==pkey(e))].slice(0,12);LS.set(RKEY,REC)}
const __ot=window.openTopic;window.openTopic=function(s,t){recordRecent('topic',s,t);__ot(s,t)};
const __os=window.openSpec;window.openSpec=function(s){recordRecent('spec',s,0);__os(s)};
window.togglePin=function(btn,k,s,t,ev){ev&&ev.stopPropagation();const key=k+':'+s+':'+t;
 if(PINS.some(e=>pkey(e)===key)){PINS=PINS.filter(e=>pkey(e)!==key);toast('Unpinned')}else{const e={k,spec:s,topic:t,t:Date.now()};if(!okEntry(e))return;PINS.unshift(e);toast('Pinned')}
 LS.set(PKEY,PINS);if(btn&&btn.dataset.inline){btn.classList.toggle('on',isPinned(k,s,t));btn.textContent=btn.dataset.long?(isPinned(k,s,t)?'★ Pinned':'☆ Pin this specialty'):(isPinned(k,s,t)?'★':'☆')}else renderAppDemo()};
window.clearRecent=function(){if(!REC.length)return;confirmBox({title:'Clear recent items?',text:`Remove ${REC.length} recently opened item${REC.length>1?'s':''} from this list.`,detail:'Pinned items and your study data are not affected.',ok:'Clear',danger:true},()=>{REC=[];LS.set(RKEY,REC);renderAppDemo();toast('Recent list cleared')})};
const __tcards=topicCards;topicCards=function(){return __tcards().replace(/onclick="openTopic\('([^']+)',(\d+)\)"(.*?)<span class="chev">›<\/span>/g,(m,s,t,mid)=>`onclick="openTopic('${s}',${t})"${mid}<button type="button" class="pinb${isPinned('topic',s,+t)?' on':''}" data-inline="1" aria-label="Pin topic" onclick="togglePin(this,'topic','${s}',${t},event)">${isPinned('topic',s,+t)?'★':'☆'}</button><span class="chev">›</span>`)};
const __tv=topicsView;topicsView=function(){const h=__tv(),p=isPinned('spec',qs.spec,0);return h.replace('<div id="topicList">',`<button type="button" class="btn block pinlong${p?' on':''}" data-inline="1" data-long="1" onclick="togglePin(this,'spec','${qs.spec}',0,event)">${p?'★ Pinned':'☆ Pin this specialty'}</button><div id="topicList">`)};
function entryCard(e,pin){const sp=SPEC_NAME[e.spec]||e.spec;let title,sub,l;
 if(e.k==='spec'){title=sp;l=QB.filter(q=>q.spec===e.spec);sub='Specialty'}else if(e.topic===0){title='All questions';l=QB.filter(q=>q.spec===e.spec);sub=sp}else{title=TOPIC_NAME[e.topic]||'Topic';l=QB.filter(q=>q.topic===e.topic);sub=sp}
 const d=answeredCount(l),p=pct(d,l.length);
 return `<div class="card sc tpc" onclick="${e.k==='spec'?`openSpec('${e.spec}')`:`openTopic('${e.spec}',${e.topic})`}"><div class="tpc-tx"><div class="eyebrow">${esc(sub)}</div><h3>${esc(title)}</h3><div class="meta">${l.length} questions · ${d} answered${pin?'':' · '+fmtDT(e.t)}</div><div class="bar"><span style="width:${p}%"></span></div></div>${pin?`<button type="button" class="pinb on" aria-label="Unpin" onclick="togglePin(null,'${e.k}','${e.spec}',${e.topic},event)">★</button>`:''}<span class="chev">›</span></div>`}
function pinnedView(){
 return `${appHeader('Pinned')}<div class="rs"><h1>Pinned</h1><p class="sub">Your saved shortcuts to specialties and topics.</p>
 ${PINS.length?PINS.map(e=>entryCard(e,true)).join(''):'<div class="card setcard"><p class="meta">Nothing pinned yet. Tap ☆ on a topic, or “Pin this specialty”, to keep it here.</p><button type="button" class="btn block" onclick="appPage=\'specialties\';renderAppDemo()">Browse specialties</button></div>'}</div>`}


/* ---- Contact & Feedback (stored locally) ---- */
const FBKEY='shbace_feedback_v1',FBT=[['bug','Problem'],['question','Question issue'],['idea','Suggestion'],['other','Other']];
let FB=(()=>{const v=LS.get(FBKEY,[]);return Array.isArray(v)?v.filter(e=>isObj(e)&&typeof e.msg==='string'&&typeof e.id==='string'&&Number.isFinite(e.t)):[]})();
let fbType='idea',fbDraft={qid:'',msg:''};
window.fbSet=function(t){fbDraft.qid=($('#fbQ')||{}).value||'';fbDraft.msg=($('#fbM')||{}).value||'';fbType=t;renderAppDemo()};
window.fbSend=function(){const msg=(($('#fbM')||{}).value||'').trim(),qid=(($('#fbQ')||{}).value||'').trim().toUpperCase(),err=$('#fbErr');
 const bad=m=>{err.textContent=m;err.hidden=false};
 if(msg.length<5)return bad('Please write at least 5 characters.');if(msg.length>2000)return bad('Please keep it under 2000 characters.');
 if(qid&&!QB.some(q=>q.id===qid))return bad('No question has the ID “'+qid+'”. Leave it empty or check the ID.');
 FB.unshift({id:'F'+Date.now().toString(36),t:Date.now(),type:fbType,qid,msg});FB=FB.slice(0,100);LS.set(FBKEY,FB);fbDraft={qid:'',msg:''};renderAppDemo();toast('Saved on this device')};
const fbText=e=>`[${(FBT.find(x=>x[0]===e.type)||[0,'Other'])[1]}] ${fmtDT(e.t)}${e.qid?' · '+e.qid:''}\n${e.msg}`;
function fbCopy(txt){const done=()=>toast('Copied');try{navigator.clipboard.writeText(txt).then(done,()=>fbCopyOld(txt))}catch(e){fbCopyOld(txt)}}
function fbCopyOld(t){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');toast('Copied')}catch(e){toast('Copy not available')}a.remove()}
window.fbCopyOne=function(id){const e=FB.find(x=>x.id===id);e&&fbCopy(fbText(e))};
window.fbDel=function(id){FB=FB.filter(x=>x.id!==id);LS.set(FBKEY,FB);renderAppDemo()};
window.fbExport=function(){if(!FB.length)return;const blob=new Blob([JSON.stringify({app:'Shbace Medical',format:'feedback',version:1,exportedAt:new Date().toISOString(),items:FB},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='shbace-medical-feedback.json';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},4000)};
window.fbClear=function(){if(!FB.length)return;confirmBox({title:'Delete all feedback?',text:`${FB.length} saved entr${FB.length>1?'ies':'y'} will be removed from this device.`,ok:'Delete all',danger:true},()=>{FB=[];LS.set(FBKEY,FB);renderAppDemo()})};
function feedbackView(){
 return `${appHeader('Contact & Feedback')}<div class="rs"><h1>Contact &amp; Feedback</h1><p class="sub">Tell us what to fix or improve.</p>
 <div class="card setcard"><h3>New message</h3><p class="meta">This app has no server or public contact address yet, so messages are saved on this device only. Export them to pass on yourself.</p>
  <div class="setrow"><b>Type</b><div class="seg wide" style="margin-top:8px;flex-wrap:wrap">${FBT.map(([v,l])=>`<button type="button" class="${fbType===v?'on':''}" onclick="fbSet('${v}')">${l}</button>`).join('')}</div></div>
  <div class="setrow"><b>Question ID <small style="display:inline;color:#8aa0b8">(optional)</small></b><input class="field" id="fbQ" placeholder="e.g. ${esc(QB[0].id)}" value="${esc(fbDraft.qid)}" autocomplete="off"></div>
  <div class="setrow"><b>Message</b><textarea class="field" id="fbM" rows="5" maxlength="2000" placeholder="Describe the problem or idea">${esc(fbDraft.msg)}</textarea></div>
  <p class="meta" id="fbErr" hidden style="color:#ff9aa2"></p>
  <button type="button" class="btn primary block" style="margin-top:12px" onclick="fbSend()">Save feedback</button></div>
 <div class="card setcard"><h3>Saved on this device (${FB.length})</h3>${FB.length?FB.map(e=>`<div class="fbi"><div class="meta"><b>${(FBT.find(x=>x[0]===e.type)||[0,'Other'])[1]}</b> · ${fmtDT(e.t)}${e.qid?' · '+esc(e.qid):''}</div><p>${esc(e.msg)}</p><div class="setbtns" style="margin:6px 0 0"><button type="button" class="btn" onclick="fbCopyOne('${e.id}')">Copy</button><button type="button" class="btn danger" onclick="fbDel('${e.id}')">Delete</button></div></div>`).join(''):'<p class="meta">No feedback saved yet.</p>'}
  ${FB.length?'<div class="setbtns"><button type="button" class="btn" onclick="fbExport()">⇩ Export JSON</button><button type="button" class="btn danger" onclick="fbClear()">Delete all</button></div>':''}</div></div>`}

/* ---- Rate this app (stored locally) ---- */
const RTKEY='shbace_rating_v1',RT_LBL=['','Poor','Fair','Good','Very good','Excellent'],RT_TAGS=['Question quality','Explanations','Design','Smart Review','Speed','Ease of use'];
let RATE=(()=>{const v=LS.get(RTKEY,null);return isObj(v)&&Number.isInteger(v.stars)&&v.stars>=1&&v.stars<=5?{stars:v.stars,tags:Array.isArray(v.tags)?v.tags.filter(t=>RT_TAGS.includes(t)):[],comment:typeof v.comment==='string'?v.comment.slice(0,1000):'',t:Number.isFinite(v.t)?v.t:Date.now()}:null})();
let rtDraft={stars:RATE?RATE.stars:0,tags:RATE?RATE.tags.slice():[],comment:RATE?RATE.comment:''};
const rtKeep=()=>{const c=$('#rtC');if(c)rtDraft.comment=c.value};
window.rtStar=function(n){rtKeep();rtDraft.stars=n;renderAppDemo()};
window.rtTag=function(t){rtKeep();const i=rtDraft.tags.indexOf(t);i<0?rtDraft.tags.push(t):rtDraft.tags.splice(i,1);renderAppDemo()};
window.rtSave=function(){rtKeep();if(!rtDraft.stars){const e=$('#rtErr');e.hidden=false;return}RATE={stars:rtDraft.stars,tags:rtDraft.tags.slice(),comment:rtDraft.comment.trim().slice(0,1000),t:Date.now()};LS.set(RTKEY,RATE);renderAppDemo();toast('Rating saved on this device')};
window.rtClear=function(){confirmBox({title:'Remove your rating?',text:'Your saved rating and comment will be deleted from this device.',ok:'Remove',danger:true},()=>{RATE=null;rtDraft={stars:0,tags:[],comment:''};try{localStorage.removeItem(RTKEY)}catch(e){}renderAppDemo()})};
function rateView(){const n=Object.keys(S.ans).length;
 return `${appHeader('Rate this app')}<div class="rs"><h1>Rate this app</h1><p class="sub">${n?`You have answered ${n} question${n===1?'':'s'} so far.`:'How is it working for you?'}</p>
 <div class="card setcard"><div class="stars" role="radiogroup" aria-label="Rating">${[1,2,3,4,5].map(i=>`<button type="button" role="radio" aria-checked="${rtDraft.stars===i}" aria-label="${i} star${i>1?'s':''}" class="${i<=rtDraft.stars?'on':''}" onclick="rtStar(${i})">★</button>`).join('')}</div>
  <p class="meta" style="text-align:center;min-height:20px">${rtDraft.stars?RT_LBL[rtDraft.stars]:'Tap a star'}</p>
  <div class="setrow"><b>What stands out? <small style="display:inline;color:#8aa0b8">(optional)</small></b><div class="chips">${RT_TAGS.map(t=>`<button type="button" class="chip${rtDraft.tags.includes(t)?' on':''}" onclick="rtTag('${t}')">${t}</button>`).join('')}</div></div>
  <div class="setrow"><b>Comment <small style="display:inline;color:#8aa0b8">(optional)</small></b><textarea class="field" id="rtC" rows="3" maxlength="1000" placeholder="Anything else?">${esc(rtDraft.comment)}</textarea></div>
  <p class="meta" id="rtErr" hidden style="color:#ff9aa2">Choose a star rating first.</p>
  <button type="button" class="btn primary block" style="margin-top:12px" onclick="rtSave()">${RATE?'Update rating':'Save rating'}</button></div>
 <div class="card setcard"><h3>Your rating</h3>${RATE?`<p style="font-size:22px;color:#ffc857;margin:4px 0">${'★'.repeat(RATE.stars)}<span style="opacity:.3">${'★'.repeat(5-RATE.stars)}</span></p><p class="meta">${RT_LBL[RATE.stars]} · saved ${fmtDT(RATE.t)}</p>${RATE.tags.length?`<p class="meta">${RATE.tags.map(esc).join(' · ')}</p>`:''}${RATE.comment?`<p class="meta">“${esc(RATE.comment)}”</p>`:''}<button type="button" class="btn danger block" style="margin-top:10px" onclick="rtClear()">Remove rating</button>`:'<p class="meta">No rating yet.</p>'}
  <p class="meta" style="margin-top:12px">Ratings stay on this device. The app is not listed in an app store and has no server, so nothing is submitted. Use Contact &amp; Feedback to write more.</p></div></div>`}

const PAGES={about:aboutView,changelog:changelogView,feedback:feedbackView,rate:rateView,pinned:pinnedView};
const __menu4=menuView;menuView=function(){return PAGES[appPage]?PAGES[appPage]():__menu4()};
const DRMAP={'Pinned':'pinned','Changelog':'changelog','About':'about','Contact and feedback':'feedback','Rate this app':'rate'};
DR2.forEach(g=>g[1].forEach(it=>{if(DRMAP[it[0]])it[1]=DRMAP[it[0]]}));

/* ============================================================
   NOTIFICATIONS · QUIZ (config + engine + results) · STATS
   ============================================================ */
const NKEY='shbace_notif_v1',QKEY='shbace_quiz_v1',QCKEY='shbace_quizcfg_v1';
const L26=i=>String.fromCharCode(65+i),dayKey=()=>new Date().toISOString().slice(0,10);
/* ---- notifications: only real events ---- */
const nidOk=id=>typeof id==='string'&&id.length>0&&id.length<=160&&!/['"\\<>`&;(){}\u0000-\u001f]/.test(id);
let NOTIF=(()=>{const v=LS.get(NKEY,[]);return Array.isArray(v)?v.filter(n=>isObj(n)&&nidOk(n.id)&&typeof n.title==='string'&&Number.isFinite(n.t)).slice(0,100):[]})();
const unreadN=()=>NOTIF.filter(n=>!n.read).length;
function addNotif(id,title,body,page,ref){if(!nidOk(id)||NOTIF.some(n=>n.id===id))return;NOTIF.unshift({id,t:Date.now(),title,body:body||'',page:page||'',ref:ref||'',read:false});NOTIF=NOTIF.slice(0,100);LS.set(NKEY,NOTIF)}
window.nOpen=function(id){const n=NOTIF.find(x=>x.id===id);if(!n)return;n.read=true;LS.set(NKEY,NOTIF);
 if(n.page==='quizresult'&&n.ref&&QZ.attempts.some(a=>a.id===n.ref))qzViewId=n.ref;
 if(n.page&&PAGES2[n.page]!==0){appPage=n.page==='quizresult'&&!QZ.attempts.some(a=>a.id===n.ref)?'notifs':n.page}renderAppDemo()};
window.nReadAll=function(){if(!unreadN())return;NOTIF.forEach(n=>n.read=true);LS.set(NKEY,NOTIF);renderAppDemo()};
window.nToggle=function(id,ev){ev&&ev.stopPropagation();const n=NOTIF.find(x=>x.id===id);if(!n)return;n.read=!n.read;LS.set(NKEY,NOTIF);renderAppDemo()};
window.nClear=function(){if(!NOTIF.length)return;confirmBox({title:'Clear all notifications?',text:`${NOTIF.length} notification${NOTIF.length>1?'s':''} will be removed.`,detail:'Your study data is not affected.',ok:'Clear',danger:true},()=>{NOTIF=[];LS.set(NKEY,NOTIF);renderAppDemo()})};
const PAGES2={};
function notifsView(){
 return `${appHeader('Notifications')}<div class="rs"><h1>Notifications</h1><p class="sub">${unreadN()?unreadN()+' unread':'All caught up'} · events from this app on this device</p>
 <div class="setbtns"><button type="button" class="btn" ${unreadN()?'':'disabled'} onclick="nReadAll()">Mark all as read</button><button type="button" class="btn danger" ${NOTIF.length?'':'disabled'} onclick="nClear()">Clear all</button></div>
 ${NOTIF.length?NOTIF.map(n=>`<div class="card sc ntf${n.read?'':' unread'}" data-nid="${esc(n.id)}" onclick="nOpen(this.dataset.nid)"><i class="ndot"></i><div class="tpc-tx"><h3>${esc(n.title)}</h3>${n.body?`<div class="meta">${esc(n.body)}</div>`:''}<div class="meta">${fmtDT(n.t)}</div></div><button type="button" class="pinb" style="font-size:12px" data-nid="${esc(n.id)}" onclick="nToggle(this.dataset.nid,event)">${n.read?'Mark unread':'Mark read'}</button></div>`).join(''):'<div class="card setcard"><p class="meta">No notifications yet. They appear when something happens in the app — a finished quiz, a backup, a reset, or Smart Review questions becoming due.</p></div>'}</div>`}
const __toast=toast;
const TOAST_N=[['Backup file created','Backup exported','A JSON backup file was created.'],['Backup restored','Backup restored','Your backup was validated and restored.'],['Topic progress reset','Topic progress reset','Answers for one topic were cleared. Saved questions, notes, reports and Smart Review were kept.'],['All study progress reset','All progress reset','All answers were cleared. Saved questions, notes, reports and Smart Review were kept.'],['Rating saved','Rating saved','Your rating was saved on this device.'],['Saved on this device','Feedback saved','Your feedback was saved on this device.']];
toast=function(msg){const h=TOAST_N.find(x=>String(msg).startsWith(x[0]));if(h)addNotif('e'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),h[1],h[2]);return __toast.apply(this,arguments)};
const __hdr=hdrTap;hdrTap=function(n){if(n==='Notifications'){appPage='notifs';renderAppDemo();return}__hdr(n)};
const __ah=appHeader;appHeader=function(l){const h=__ah(l),u=unreadN();return u?h.replace(/(onclick="hdrTap\('Notifications'\)"[^>]*>)/,`$1<i class="bdot"></i>`):h};

/* ---- quiz data ---- */
let QZ=(()=>{const v=LS.get(QKEY,null);const A=isObj(v)&&Array.isArray(v.attempts)?v.attempts.filter(a=>isObj(a)&&typeof a.id==='string'&&Array.isArray(a.items)&&Number.isFinite(a.end)):[];return {attempts:A.slice(0,200),active:isObj(v)&&isObj(v.active)&&Array.isArray(v.active.ids)&&v.active.ids.length?v.active:null}})();
const qzSave=()=>LS.set(QKEY,QZ);
const QBY=new Map(QB.map(q=>[q.id,q]));
QZ.attempts.forEach(a=>{a.items=a.items.filter(i=>isObj(i)&&QBY.has(i.id))});
if(QZ.active)QZ.active.ids=QZ.active.ids.filter(id=>QBY.has(id));if(QZ.active&&!QZ.active.ids.length)QZ.active=null;
let QC=Object.assign({scope:'all',specs:[],topics:[],filt:'any',mode:'practice',fb:'instant',order:'random',count:20,mins:0},(()=>{const v=LS.get(QCKEY,{});return isObj(v)?v:{}})());
(()=>{const E={scope:['all','sel','custom'],filt:['any','new','wrong','saved'],mode:['practice','timed'],fb:['instant','end'],order:['random','bank']};Object.keys(E).forEach(k=>{if(!E[k].includes(QC[k]))QC[k]=E[k][0]});
 QC.specs=Array.isArray(QC.specs)?QC.specs.filter(s=>REAL.spec[s]):[];QC.topics=Array.isArray(QC.topics)?QC.topics.filter(t=>TOPIC_NAME[t]):[];
 QC.count=Number.isInteger(QC.count)&&QC.count>0?QC.count:20;QC.mins=Number.isInteger(QC.mins)&&QC.mins>0?QC.mins:0})();
const qcSave=()=>LS.set(QCKEY,QC);
let qzViewId=null,qzPal=false,qzRevF='all',qzAnim=false,qzBack=null;
function qzPool(cfg=QC){if(!gradeHasPediatrics())return [];let l=QB;
 if(cfg.scope==='sel'){
  const tsp=new Set((cfg.topics||[]).filter(t=>(cfg.specs||[]).some(sp=>REAL.spec[sp]&&REAL.spec[sp].topics.some(x=>x[0]===t))));
  const hasT=sp=>REAL.spec[sp].topics.some(x=>tsp.has(x[0]));
  l=QB.filter(q=>(cfg.specs||[]).includes(q.spec)&&(!hasT(q.spec)||tsp.has(q.topic)));
 }else if(cfg.scope==='custom'){
  l=QB.filter(q=>cfg.filt==='any'||(cfg.filt==='new'&&!S.ans[q.id])||(cfg.filt==='wrong'&&S.ans[q.id]&&!S.ans[q.id].ok)||(cfg.filt==='saved'&&S.saved[q.id]));
 }
 return l;
}
const qzEff=(p,cfg=QC)=>Math.max(1,Math.min(cfg.count,p));
const qzClone=cfg=>Object.assign({},cfg,{specs:(cfg.specs||[]).slice(),topics:(cfg.topics||[]).slice()});
let QCD=qzClone(QC),QCD_DIRTY=false;
function qcdPool(){return qzPool(QCD)}
function qcdUpdateUI(){
 document.querySelectorAll('[data-qcd-key]').forEach(el=>{const k=el.dataset.qcdKey,v=el.dataset.qcdValue;el.classList.toggle('on',Array.isArray(QCD[k])?QCD[k].includes(v):String(QCD[k])===String(v));});
 document.querySelectorAll('[data-qcd-spec]').forEach(el=>el.classList.toggle('on',QCD.specs.includes(el.dataset.qcdSpec)));
 document.querySelectorAll('[data-qcd-topic-panel]').forEach(el=>{el.hidden=!QCD.specs.includes(el.dataset.qcdTopicPanel)});
 document.querySelectorAll('[data-qcd-topic]').forEach(el=>{el.checked=QCD.topics.includes(Number(el.dataset.qcdTopic));});
 document.querySelectorAll('[data-qcd-panel]').forEach(el=>{el.hidden=el.dataset.qcdPanel!==QCD.scope});
 const timer=document.getElementById('qcd-timer');if(timer)timer.hidden=QCD.mode!=='timed';
 const pool=qcdPool(),available=pool.length,chosen=available?Math.min(QCD.count,available):0;
 const p=document.getElementById('qcd-available');if(p)p.textContent=`${available.toLocaleString()} questions available · ${chosen.toLocaleString()} selected`;
 const st=document.getElementById('qcd-status');if(st)st.textContent=QCD_DIRTY?'Selections are not applied yet. Confirm once when you are ready.':'Settings are saved. You can start the quiz.';
 const apply=document.getElementById('qcd-apply');if(apply)apply.classList.toggle('pending',QCD_DIRTY);
 const begin=document.getElementById('qcd-start');if(begin){begin.disabled=QCD_DIRTY||!available;begin.textContent=`Start quiz · ${chosen} questions${QCD.mode==='timed'?' · '+(QCD.mins||chosen)+' min':''}`;}
}
window.qcDraftSet=function(k,v){if(!['scope','mode','fb','order','filt'].includes(k))return;QCD[k]=v;QCD_DIRTY=true;qcdUpdateUI()};
window.qcDraftToggle=function(k,v){if(k==='specs'){
  const i=QCD.specs.indexOf(v);if(i<0)QCD.specs.push(v);else{QCD.specs.splice(i,1);const ids=REAL.spec[v].topics.map(t=>t[0]);QCD.topics=QCD.topics.filter(t=>!ids.includes(t));}
 }else if(k==='topics'){const n=Number(v),i=QCD.topics.indexOf(n);if(i<0)QCD.topics.push(n);else QCD.topics.splice(i,1);}else return;
 QCD_DIRTY=true;qcdUpdateUI();
};
window.qcDraftInput=function(k,el){const v=String(el.value||'').trim();if(k==='count')QCD.count=v?Math.max(1,Math.min(5000,parseInt(v,10)||1)):1;else if(k==='mins')QCD.mins=v?Math.max(1,Math.min(600,parseInt(v,10)||1)):0;else return;QCD_DIRTY=true;qcdUpdateUI()};
window.qcDraftAll=function(){const n=qcdPool().length;QCD.count=Math.max(1,n);const el=document.getElementById('qzCount');if(el)el.value=QCD.count;QCD_DIRTY=true;qcdUpdateUI()};
window.qcApplyDraft=function(){
 const pool=qcdPool();if(!pool.length){const st=document.getElementById('qcd-status');if(st)st.textContent='No questions match these selections. Change the scope or specialty first.';return;}
 QCD.count=Math.max(1,Math.min(Number(QCD.count)||1,pool.length));QCD.mins=QCD.mode==='timed'?(Number(QCD.mins)>0?Math.min(600,Number(QCD.mins)):0):QCD.mins;
 QC=qzClone(QCD);qcSave();QCD=qzClone(QC);QCD_DIRTY=false;const countInput=document.getElementById('qzCount');if(countInput)countInput.value=QCD.count;qcdUpdateUI();
 const st=document.getElementById('qcd-status');if(st)st.textContent='✓ Settings applied and saved. Your quiz is ready.';
};
const qcdSeg=(key,items)=>`<div class="seg wide">${items.map(([v,l])=>`<button type="button" data-qcd-key="${key}" data-qcd-value="${v}" class="${QCD[key]===v?'on':''}" onclick="qcDraftSet('${key}','${v}')">${l}</button>`).join('')}</div>`;
quizView=function(){
 QCD=qzClone(QC);QCD_DIRTY=false;
 const act=QZ.active,pool=qcdPool(),n=pool.length?qzEff(pool.length,QCD):0,mins=QCD.mins||n;
 let resume='';if(act){const done=Object.keys(act.ans).length;resume=`<div class="card setcard qz-resume"><h3>Quiz in progress</h3><p class="meta">${act.ids.length} questions · ${done} answered · ${act.mode==='timed'?'Timed':'Practice'}</p><div class="setbtns"><button type="button" class="btn primary" onclick="qzResume()">Resume</button><button type="button" class="btn danger" onclick="qzDiscard()">Discard</button></div></div>`}
 const specs=gradeHasPediatrics()?Object.keys(REAL.spec):[];
 const specButtons=specs.map(sp=>`<button type="button" class="chip qcd-spec${QCD.specs.includes(sp)?' on':''}" data-qcd-spec="${sp}" onclick="qcDraftToggle('specs','${sp}')">${esc(SPEC_NAME[sp]||sp)}</button>`).join('');
 const topicPanels=specs.map(sp=>`<details class="qzd qcd-topics" data-qcd-topic-panel="${sp}" ${QCD.specs.includes(sp)?'':'hidden'}><summary>${esc(SPEC_NAME[sp]||sp)} topics <small>${REAL.spec[sp].topics.filter(t=>QCD.topics.includes(t[0])).length||'all'} selected</small></summary>${REAL.spec[sp].topics.map(t=>`<label class="qzt"><input type="checkbox" data-qcd-topic="${t[0]}" ${QCD.topics.includes(t[0])?'checked':''} onchange="qcDraftToggle('topics',${t[0]})"><span>${esc(t[1])}</span></label>`).join('')}<p class="meta">No topic selected in this specialty means all its topics are included.</p></details>`).join('');
 return `${appHeader('Quiz')}<div class="rs quiz-premium"><h1>Quiz mode</h1><p class="sub">Choose everything first. Your selections are saved together only when you confirm.</p>${resume}${QZ.attempts.length?`<button type="button" class="btn block qz-history" style="margin-bottom:10px" onclick="appPage='quizhistory';renderAppDemo()">Quiz history · ${QZ.attempts.length}</button>`:''}
 <section class="card setcard qz-config"><div class="qz-section-head"><span class="qz-step">01</span><div><h3>Question source</h3><small>Choose where your questions come from</small></div></div>
  ${qcdSeg('scope',[['all','All questions'],['sel','By Specialty'],['custom','My study list']])}
  <div class="qcd-panel" data-qcd-panel="all"><p class="qz-help">Use the complete Question Bank. No specialty or topic filter will be applied.</p></div>
  <div class="qcd-panel" data-qcd-panel="sel" hidden><p class="qz-help">Select one or more specialties, then open a specialty to choose topics. Leave its topics unchecked to include all of them.</p><div class="chips qcd-specs">${specButtons}</div>${topicPanels}</div>
  <div class="qcd-panel" data-qcd-panel="custom" hidden><p class="qz-help">Build a quiz from your own study state.</p>${qcdSeg('filt',[['any','Any'],['new','Unanswered'],['wrong','Answered wrong'],['saved','Saved']])}</div>
  <div class="setrow qz-count-row"><div><b>Number of questions</b><small id="qcd-available">${pool.length} questions available · ${n} selected</small></div><div class="qz-count-controls"><input class="field" id="qzCount" type="number" inputmode="numeric" min="1" max="5000" value="${QCD.count}" oninput="qcDraftInput('count',this)" aria-label="Number of questions"><button type="button" class="btn" onclick="qcDraftAll()">All</button></div></div>
 </section>
 <section class="card setcard qz-config"><div class="qz-section-head"><span class="qz-step">02</span><div><h3>Quiz behavior</h3><small>Set the timing and feedback once</small></div></div>
  <div class="setrow"><b>Mode</b>${qcdSeg('mode',[['practice','Practice'],['timed','Timed']])}</div>
  <div class="setrow qcd-timer" id="qcd-timer" ${QCD.mode==='timed'?'':'hidden'}><b>Time limit (minutes)</b><small>Leave empty to use one minute per selected question.</small><input class="field" id="qzMins" type="number" inputmode="numeric" min="1" max="600" placeholder="${n||1}" value="${QCD.mins||''}" oninput="qcDraftInput('mins',this)"></div>
  <div class="setrow"><b>Feedback</b><small>Choose when the correct answer and explanation appear.</small>${qcdSeg('fb',[['instant','After each answer'],['end','At the end']])}</div>
  <div class="setrow"><b>Question order</b>${qcdSeg('order',[['random','Random order'],['bank','Bank order']])}</div>
 </section>
 <div class="qcd-confirm"><p id="qcd-status" role="status">Settings are saved. You can start the quiz.</p><button type="button" id="qcd-apply" class="btn qcd-apply" onclick="qcApplyDraft()">✓ Confirm my choices</button><button type="button" id="qcd-start" class="btn primary block" onclick="qzStart()" ${pool.length?'':'disabled'}>Start quiz · ${n} questions${QCD.mode==='timed'?' · '+mins+' min':''}</button></div>
 </div>`};
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
window.qzStart=function(){
 if(QCD_DIRTY){const st=document.getElementById('qcd-status');if(st)st.textContent='Confirm your choices first. Your selections have not been applied yet.';return;}
 const pool=qzPool(QC);if(!pool.length)return;
 const go=()=>{const n=qzEff(pool.length,QC);const ids=(QC.order==='random'?shuffle(pool).slice(0,n):pool.slice(0,n)).map(q=>q.id);
  const now=Date.now(),mins=QC.mins||n;
  QZ.active={id:'A'+now.toString(36),start:now,scope:QC.scope,mode:QC.mode,fb:QC.fb,order:QC.order,ids,ans:{},mark:{},idx:0,limit:QC.mode==='timed'?mins*60000:0,deadline:QC.mode==='timed'?now+mins*60000:0,spent:0,kind:'new',cfg:{scope:QC.scope,specs:QC.scope==='sel'?QC.specs.slice():[],topics:QC.scope==='sel'?QC.topics.slice():[],filt:QC.scope==='custom'?QC.filt:null}};
  qcSave();qzSave();qzPal=false;appPage='quizrun';renderAppDemo()};
 if(QZ.active)confirmBox({title:'Replace the quiz in progress?',text:'Starting a new quiz discards the unfinished one. It will not be counted in your statistics.',ok:'Start new',danger:true},go);else go();};
window.qzResume=function(){if(QZ.active){appPage='quizrun';renderAppDemo()}};
window.qzDiscard=function(){confirmBox({title:'Discard this quiz?',text:'The unfinished quiz will be deleted and will not be counted in your statistics.',ok:'Discard',danger:true},()=>{QZ.active=null;qzSave();renderAppDemo()})};
/* ---- engine ---- */
const fmtT=ms=>{ms=Math.max(0,ms);const s=Math.ceil(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s%60).padStart(2,'0')};
function qzFaceFor(A,id){const q=QBY.get(id),sel=A.ans[id];if(sel===q.k)return 'happy';let s=0;for(let i=A.ids.indexOf(id);i>=0;i--){const x=A.ids[i],a=A.ans[x];if(a===undefined)continue;if(a===QBY.get(x).k)break;s++}return s>=3?'encouraging':s===2?'angry':'sad'}
quizRunView=function(){const A=QZ.active;if(!A)return quizView();
 const anim=qzAnim;qzAnim=false;const q=QBY.get(A.ids[A.idx]),sel=A.ans[q.id],shown=A.fb==='instant'&&sel!==undefined,total=A.ids.length;
 const opts=q.o.map((t,i)=>{let c='qopt';if(shown){if(i===q.k)c+=' correct';else if(i===sel)c+=' incorrect';else c+=' dim'}else if(i===sel)c+=' picked';
  return `<button type="button" class="${c}" ${shown?'disabled':''} aria-pressed="${i===sel}" onclick="qzPick(${i})"><i>${QLT(q,i)}</i><span>${esc(t)}</span>${shown&&i===q.k?'<b class="ck">✓</b>':''}${shown&&i===sel&&i!==q.k?'<b class="ck x">✕</b>':''}</button>`}).join('');
 const fb=shown?`<div class="qfb ${sel===q.k?'ok':'no'}">${docFace(qzFaceFor(A,q.id),'fl')}<b>${sel===q.k?'Correct':'Incorrect'} · Correct answer: ${QLT(q,q.k)}. ${esc(q.o[q.k])}${qUnsure(q)?' <em class="qunsure">(unconfirmed key)</em>':''}</b><p>Explanation: ${esc(q.ex||'No explanation available for this question.')}</p></div>`:'';
 const st=i=>{const id=A.ids[i];return (i===A.idx?' cur':'')+(A.ans[id]!==undefined?' ans':'')+(A.mark[id]?' mk':'')};
 const ansN=Object.keys(A.ans).length,mkN=Object.keys(A.mark).length;
 return `${appHeader('Quiz')}<div class="rs qb quiz-premium"><div class="qzbar"><span>Question <b>${A.idx+1}</b> / ${total}</span>${A.mode==='timed'?`<b class="qzt2" id="qzTimer">${fmtT(A.deadline-Date.now())}</b>`:`<span class="pill" id="qzElapsed">${fmtDur(A.spent||0)}</span>`}</div>
 <div class="qbar"><i style="width:${Math.round(ansN*100/total)}%"></i></div><div class="qzstat"><span><b>${ansN}</b> answered</span><span><b>${total-ansN}</b> remaining</span><span><b>${mkN}</b> marked</span><span>${A.mode==='timed'?'TIMED':'PRACTICE'}</span></div>
 <article class="qcard${anim?' qzin':''}"><div class="qtop"><span class="qid">${q.id}</span><button type="button" class="qa ${A.mark[q.id]?'on':''}" onclick="qzMark()"><span>⚑</span>${A.mark[q.id]?'Marked for review':'Mark for review'}</button></div><div class="qtopic">${esc(TOPIC_NAME[q.topic])}</div>${qUnsure(q)?'<div class="qwarn" role="note"><b>\u26a0 Needs Review / Verification</b><span>This question or its answer key is not confirmed.</span></div>':''}<h3 class="qstem">Q${A.idx+1}. ${esc(QSTEM(q))}</h3><div class="qopts">${opts}</div>${fb}${sel!==undefined&&!shown?'<button type="button" class="btn" style="margin-top:4px" onclick="qzPick(-1)">Clear answer</button>':''}</article>
 <div class="qnav"><button type="button" class="btn" onclick="qzGo(-1)" ${A.idx===0?'disabled':''}>← Previous</button><button type="button" class="btn" onclick="qzTogglePal()">${qzPal?'Hide':'Questions'}</button><button type="button" class="btn primary" onclick="qzGo(1)" ${A.idx>=total-1?'disabled':''}>Next →</button></div>
 ${qzPal?`<div class="qpal">${A.ids.map((id,i)=>`<button type="button" class="${st(i).trim()}" onclick="qzJump(${i})">${i+1}</button>`).join('')}</div><p class="meta"><span class="lg ans"></span>Answered <span class="lg mk"></span>Marked <span class="lg"></span>Unanswered</p>`:''}
 <button type="button" class="btn block" style="margin-top:14px" onclick="appPage='quiz';renderAppDemo()">Pause &amp; exit \u2014 progress is saved</button><button type="button" class="btn danger block" style="margin-top:10px" onclick="qzSubmitAsk()">Submit quiz</button></div>`};
const qzRe=()=>{if(appPage==='quizrun')renderAppDemo()};
window.qzPick=function(i){const A=QZ.active;if(!A)return;const id=A.ids[A.idx];
 if(i<0||A.ans[id]===i){if(A.fb==='instant'&&A.ans[id]!==undefined)return;delete A.ans[id]}else{if(A.fb==='instant'&&A.ans[id]!==undefined)return;A.ans[id]=i}qzSave();qzRe()};
window.qzMark=function(){const A=QZ.active;if(!A)return;const id=A.ids[A.idx];A.mark[id]?delete A.mark[id]:A.mark[id]=1;qzSave();qzRe()};
const qzTop=()=>setTimeout(()=>{const e=document.querySelector('.qzbar');e&&e.scrollIntoView({block:'start'})},30);
window.qzGo=function(d){const A=QZ.active;if(!A)return;const n=Math.max(0,Math.min(A.ids.length-1,A.idx+d));if(n!==A.idx){qzAnim=true;A.idx=n;qzSave();qzRe();qzTop()}};
window.qzJump=function(i){const A=QZ.active;if(!A)return;qzAnim=i!==A.idx;A.idx=i;qzSave();qzRe();qzTop()};
window.qzTogglePal=function(){qzPal=!qzPal;qzRe()};
window.qzSubmitAsk=function(){const A=QZ.active;if(!A)return;const un=A.ids.length-Object.keys(A.ans).length,mk=Object.keys(A.mark).length;
 confirmBox({title:'Submit quiz?',text:`${un} unanswered · ${mk} marked for review.`,detail:'You cannot change answers after submitting.',ok:'Submit'},()=>qzFinish('submitted'))};
function qzFinish(reason){const A=QZ.active;if(!A)return;
 const end=Math.min(Date.now(),A.deadline||Infinity);
 const items=A.ids.map(id=>{const q=QBY.get(id),s=A.ans[id];return {id,sel:s===undefined?-1:s,ok:s!==undefined&&s===q.k,mk:A.mark[id]?1:0}});
 const correct=items.filter(i=>i.ok).length,answered=items.filter(i=>i.sel>=0).length;
 const at={id:A.id,start:A.start,end:Math.max(end,A.start),reason,mode:A.mode,fb:A.fb,order:A.order,scope:A.scope,limit:A.limit,items,correct,incorrect:answered-correct,unanswered:items.length-answered,marked:items.filter(i=>i.mk).length,spent:A.mode==='timed'?null:(A.spent||0),cfg:A.cfg||null,from:A.from||null,kind:A.kind||'new'};
 if(!QZ.attempts.some(a=>a.id===at.id))QZ.attempts.unshift(at);QZ.attempts=QZ.attempts.slice(0,200);QZ.active=null;qzSave();
 qzViewId=at.id;qzRevF='all';qzBack=null;const p=Math.round(correct*100/items.length);
 addNotif('quiz-'+at.id,reason==='expired'?'Timed quiz ended — time expired':'Quiz completed',`${correct} / ${items.length} correct (${p}%)${at.unanswered?' · '+at.unanswered+' unanswered':''}`,'quizresult',at.id);
 appPage='quizresult';renderAppDemo()}
/* M-07: questions removed from the bank must not block finishing a saved quiz */
{const _qf=qzFinish;qzFinish=function(reason){const A=QZ.active;if(A&&Array.isArray(A.ids)){try{const miss=A.ids.filter(id=>!QBY.get(id));if(miss.length){A.ids=A.ids.filter(id=>QBY.get(id));miss.forEach(id=>{if(A.ans)delete A.ans[id];if(A.mark)delete A.mark[id]});
 if(!A.ids.length){QZ.active=null;qzSave();try{toast('This quiz used questions that are no longer in the bank, so it was closed.')}catch(e){}appPage='quiz';renderAppDemo();return}}}catch(e){}}return _qf(reason)}}
let qzLast=Date.now(),qzTick=0;
setInterval(()=>{const now=Date.now(),d=now-qzLast;qzLast=now;const A=QZ.active;if(!A)return;
 if(appPage==='quizrun'&&!document.hidden&&d>0&&d<5000){A.spent=(A.spent||0)+d;if(++qzTick%20===0)qzSave();const x=$('#qzElapsed');if(x)x.textContent=fmtDur(A.spent)}
 if(!A.deadline)return;const left=A.deadline-now;if(left<=0){qzFinish('expired');return}const e=$('#qzTimer');if(e){e.textContent=fmtT(left);e.classList.toggle('low',left<60000)}},500);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&QZ.active)qzSave()});addEventListener('pagehide',()=>{if(QZ.active)qzSave()});
/* ---- results ---- */
window.qzRevSet=function(f){qzRevF=f;renderAppDemo()};
window.qzOpen=function(id){if(!QZ.attempts.some(a=>a.id===id))return;qzViewId=id;appPage='quizresult';renderAppDemo()};
/* ===== Unit 3: Quiz results, actions, history (Quiz data only: QKEY store; never mixes Question Bank answers or Smart Review) ===== */
const fmtDur=ms=>{const s=Math.max(0,Math.round(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`};
const qzDur=a=>(a.mode==='timed'||a.spent==null)?Math.max(0,a.end-a.start):a.spent;
const qzTier=o=>o.n<2?'few':pct(o.c,o.n)>=80?'strong':pct(o.c,o.n)<60?'weak':'mid';
const QZ_TIER_LBL={strong:'Strong',weak:'Needs work',mid:'Fair',few:'Too few questions'};
function qzAgg(items){const sp={},tp={};items.forEach(it=>{const q=QBY.get(it.id);if(!q)return;[[sp,q.spec,q.spec],[tp,q.topic,q.spec]].forEach(([m,k,s])=>{const o=m[k]||(m[k]={n:0,c:0,w:0,u:0,spec:s,id:k});o.n++;it.sel<0?o.u++:it.ok?o.c++:o.w++})});return {sp,tp}}
function qzSelText(a){const c=a.cfg,sy=[...new Set(a.items.map(i=>(QBY.get(i.id)||{}).spec).filter(Boolean))],tp=new Set(a.items.map(i=>(QBY.get(i.id)||{}).topic).filter(Boolean));
 const sysTxt=sy.slice(0,3).map(s=>SPEC_NAME[s]||s).join(', ')+(sy.length>3?` +${sy.length-3}`:'');
 let base;if(c&&c.scope==='sel'&&c.specs&&c.specs.length)base=`${c.specs.slice(0,3).map(s=>SPEC_NAME[s]||s).join(', ')}${c.specs.length>3?` +${c.specs.length-3}`:''} · ${(c.topics||[]).filter(t=>TOPIC_NAME[t]).length||'all'} topic${(c.topics||[]).filter(t=>TOPIC_NAME[t]).length===1?'':'s'}`;
 else if(a.scope==='custom'||(c&&c.scope==='custom'))base=`Custom${c&&c.filt&&c.filt!=='any'?' ('+({new:'unanswered',wrong:'answered wrong',saved:'saved'}[c.filt]||c.filt)+')':''} · ${sysTxt}`;
 else if(a.kind!=='retry'&&a.scope==='all')base='All questions';
 else base=`${sysTxt} · ${tp.size} topic${tp.size===1?'':'s'}`;
 const pre=a.kind==='retry'?'Retry incorrect · ':a.kind==='retake'?'Retake · ':'';return pre+base}
const qzTypeTxt=a=>`${a.mode==='timed'?'Timed':'Practice'} · ${a.fb==='end'?'feedback at end':'instant feedback'} · ${a.order==='bank'?'bank order':'random order'}`;
function qzBegin(ids,base,kind){const go=()=>{const now=Date.now(),timed=base.mode==='timed';
  const mins=timed?(base.limit?Math.max(1,Math.round(base.limit/60000*ids.length/Math.max(1,base.items?base.items.length:ids.length))):ids.length):0;
  QZ.active={id:'A'+now.toString(36),start:now,scope:base.scope||'all',mode:base.mode,fb:base.fb,order:base.order,ids,ans:{},mark:{},idx:0,limit:timed?mins*60000:0,deadline:timed?now+mins*60000:0,cfg:base.cfg||null,from:base.id||null,kind,spent:0};
  qzSave();qzPal=false;qzAnim=false;appPage='quizrun';renderAppDemo()};
 if(QZ.active)confirmBox({title:'Replace the quiz in progress?',text:'Starting this quiz discards the unfinished one. It will not be counted in your statistics.',ok:'Start new',danger:true},go);else go()}
window.qzRetake=function(id){const a=QZ.attempts.find(x=>x.id===id);if(!a)return;const ids=a.items.map(i=>i.id).filter(i=>QBY.has(i));if(!ids.length)return;qzBegin(a.order==='random'?shuffle(ids):ids,a,'retake')};
window.qzRetryWrong=function(id){const a=QZ.attempts.find(x=>x.id===id);if(!a)return;const ids=a.items.filter(i=>i.sel>=0&&!i.ok&&QBY.has(i.id)).map(i=>i.id);if(!ids.length)return;qzBegin(a.order==='random'?shuffle(ids):ids,a,'retry')};
window.qzRevMarked=function(){qzRevF='mk';renderAppDemo();setTimeout(()=>{const e=$('#qzRevTop');e&&e.scrollIntoView({block:'start'})},60)};
window.qzTopicQuiz=function(spec,topic){QC.scope='sel';QC.specs=[spec];QC.topics=[topic];qcSave();appPage='quiz';renderAppDemo()};
window.qzWeakQuiz=function(id){const a=QZ.attempts.find(x=>x.id===id);if(!a)return;const g=qzAgg(a.items),w=Object.values(g.tp).filter(o=>qzTier(o)==='weak');if(!w.length)return;QC.scope='sel';QC.specs=[...new Set(w.map(o=>o.spec))];QC.topics=w.map(o=>o.id);qcSave();appPage='quiz';renderAppDemo()};
window.qzOpen=function(id,from){if(!QZ.attempts.some(a=>a.id===id))return;qzViewId=id;qzRevF='all';qzBack=from||null;appPage='quizresult';renderAppDemo()};
const qzRowHTML=(name,o,extra)=>{const p=pct(o.c,o.n),t=qzTier(o);return `<div class="strow"><div><b>${esc(name)}</b><small>${o.c}/${o.n} correct${o.w?` · ${o.w} incorrect`:''}${o.u?` · ${o.u} unanswered`:''}${extra||''}</small></div><span>${p}%</span><div class="bar"><span style="width:${p}%"></span></div>${t==='few'?'':`<small class="qtier ${t}">${QZ_TIER_LBL[t]}</small>`}</div>`};
quizResultView=function(){const at=QZ.attempts.find(a=>a.id===qzViewId)||QZ.attempts[0];if(!at)return `${appHeader('Quiz result')}<div class="rs"><h1>Quiz result</h1><div class="card setcard"><p class="meta">No completed quiz yet.</p><button type="button" class="btn primary block" onclick="appPage='quiz';renderAppDemo()">Build a quiz</button></div></div>`;
 const n=at.items.length,p=pct(at.correct,n),dur=qzDur(at),answered=at.correct+at.incorrect,g=qzAgg(at.items);
 const flt=i=>qzRevF==='all'||(qzRevF==='wrong'&&i.sel>=0&&!i.ok)||(qzRevF==='un'&&i.sel<0)||(qzRevF==='mk'&&i.mk);
 const list=at.items.map((it,ix)=>[it,ix]).filter(([it])=>flt(it));
 const topics=Object.values(g.tp).sort((a,b)=>pct(a.c,a.n)-pct(b.c,b.n)||b.n-a.n);
 const strong=topics.filter(o=>qzTier(o)==='strong'),weak=topics.filter(o=>qzTier(o)==='weak');
 const spRows=Object.values(g.sp).sort((a,b)=>pct(a.c,a.n)-pct(b.c,b.n)).map(o=>qzRowHTML(SPEC_NAME[o.id]||o.id,o)).join('');
 const tpRows=topics.map(o=>qzRowHTML(TOPIC_NAME[o.id]||'',o)+`<div class="setbtns qtbtn"><button type="button" class="btn" onclick="openTopic('${o.spec}',${o.id})">Open topic</button><button type="button" class="btn" onclick="qzTopicQuiz('${o.spec}',${o.id})">Quiz this topic</button></div>`).join('');
 const wrongN=at.items.filter(i=>i.sel>=0&&!i.ok).length;
 const names=a=>a.slice(0,3).map(o=>esc(TOPIC_NAME[o.id])).join(', ')+(a.length>3?` +${a.length-3} more`:'');
 return `${appHeader('Quiz result')}<div class="rs"><h1>Quiz result</h1><p class="sub">${fmtDT(at.end)} · ${qzTypeTxt(at)}${at.reason==='expired'?' · time expired':''}</p>
 <p class="meta">${esc(qzSelText(at))}</p>
 <div class="card setcard" style="text-align:center">${p>=85?docFace('celebrating','dr-top'):p<50?docFace('encouraging','dr-top'):''}<div class="qzscore">${p}%</div><p class="meta">${at.correct} of ${n} questions correct · ${fmtDur(dur)} ${at.mode==='timed'&&at.limit?'of '+fmtDur(at.limit):'used'}</p></div>
 <div class="abgrid" style="grid-template-columns:repeat(4,1fr)"><div><b style="color:#53e0b0">${at.correct}</b><small>Correct</small></div><div><b style="color:#ff9aa2">${at.incorrect}</b><small>Incorrect</small></div><div><b>${at.unanswered}</b><small>Unanswered</small></div><div><b style="color:#ffc857">${at.marked}</b><small>Marked</small></div></div>
 <p class="meta qzdef">Score = correct ÷ questions in this quiz (unanswered count as not correct). Accuracy of answered questions: ${pct(at.correct,answered)}%.</p>
 <div class="card setcard"><h3>What to do next</h3><div class="qzact">
  <button type="button" class="btn primary" ${wrongN?'':'disabled'} onclick="qzRetryWrong('${at.id}')">Retry incorrect only (${wrongN})</button>
  <button type="button" class="btn" onclick="qzRetake('${at.id}')">Retake whole quiz</button>
  <button type="button" class="btn" ${at.marked?'':'disabled'} onclick="qzRevMarked()">Review marked (${at.marked})</button>
  <button type="button" class="btn" ${weak.length?'':'disabled'} onclick="qzWeakQuiz('${at.id}')">Quiz my weak topics (${weak.length})</button></div></div>
 <div class="card setcard"><h3>Strengths &amp; weaknesses</h3><p class="meta"><b style="color:#53e0b0">Strong</b> (≥80%, at least 2 questions): ${strong.length?names(strong):'none yet'}</p><p class="meta"><b style="color:#ffb199">Needs work</b> (&lt;60%, at least 2 questions): ${weak.length?names(weak):'none — nice'}</p></div>
 <div class="card setcard"><h3>By medical system</h3>${spRows||'<p class="meta">No data.</p>'}</div>
 <details class="card setcard"><summary style="font-weight:800;font-size:17px;cursor:pointer">By topic (${topics.length}) — weakest first</summary>${tpRows||'<p class="meta">No data.</p>'}</details>
 <h3 id="qzRevTop" style="margin:16px 0 8px">Review all questions</h3>
 <div class="seg wide" style="margin-bottom:12px;flex-wrap:wrap">${[['all','All'],['wrong','Incorrect'],['un','Unanswered'],['mk','Marked']].map(([v,l])=>`<button type="button" class="${qzRevF===v?'on':''}" onclick="qzRevSet('${v}')">${l}</button>`).join('')}</div>
 ${list.length?list.map(([it,ix])=>{const q=QBY.get(it.id);if(!q)return `<div class="card qzr un"><b>Q${ix+1}</b> -- this question is no longer in the bank</div>`;return `<details class="card qzr ${it.sel<0?'un':it.ok?'ok':'no'}"><summary><b>Q${ix+1}</b> · ${it.sel<0?'Unanswered':it.ok?'Correct':'Incorrect'}${it.mk?' · ⚑ marked':''}<span>${esc(QSTEM(q))}</span></summary><div class="qopts">${q.o.map((t,i)=>`<div class="qopt ${i===q.k?'correct':i===it.sel?'incorrect':'dim'}"><i>${QLT(q,i)}</i><span>${esc(t)}${i===it.sel?' <em>(your answer)</em>':''}</span></div>`).join('')}</div><div class="qfb ${it.ok?'ok':'no'}"><b>Correct answer: ${QLT(q,q.k)}. ${esc(q.o[q.k])}${qUnsure(q)?' <em class="qunsure">(unconfirmed key)</em>':''}</b><p>Explanation: ${esc(q.ex||'No explanation available for this question.')}</p></div></details>`}).join(''):'<div class="card setcard"><p class="meta">Nothing in this filter.</p></div>'}
 <div class="setbtns"><button type="button" class="btn primary" onclick="appPage='quiz';renderAppDemo()">New quiz</button><button type="button" class="btn" onclick="appPage='quizhistory';renderAppDemo()">Quiz history</button></div></div>`};
/* ---- Quiz history ---- */
let qzHistF='all';
window.qzHistSet=function(f){qzHistF=f;renderAppDemo()};
function qzMarkedAll(){const m=new Map();QZ.attempts.slice().reverse().forEach(a=>a.items.forEach(i=>{if(i.mk&&QBY.has(i.id))m.set(i.id,a.id)}));return [...m.keys()]}
function qzHistoryView(){const A=QZ.attempts.filter(a=>qzHistF==='all'||a.mode===qzHistF),mk=qzMarkedAll();
 return `${appHeader('Quiz history')}<div class="rs"><h1>Quiz history</h1><p class="sub">${QZ.attempts.length} completed quiz${QZ.attempts.length===1?'':'zes'} · stored separately from Question Bank answers and Smart Review</p>
 <div class="seg wide" style="margin-bottom:10px">${[['all','All'],['practice','Practice'],['timed','Timed']].map(([v,l])=>`<button type="button" class="${qzHistF===v?'on':''}" onclick="qzHistSet('${v}')">${l}</button>`).join('')}</div>
 ${A.length?A.map(a=>{const n=a.items.length,p=pct(a.correct,n);return `<div class="card sc qzh" role="button" tabindex="0" onclick="qzOpen('${a.id}','history')" onkeydown="if(event.key==='Enter'){qzOpen('${a.id}','history')}"><div class="tpc-tx"><div class="eyebrow">${fmtDT(a.end)}</div><h3>${esc(qzSelText(a))}</h3><div class="meta">${qzTypeTxt(a)}${a.reason==='expired'?' · time expired':''}</div><div class="meta">${a.correct}/${n} correct · ${a.incorrect} incorrect · ${a.unanswered} unanswered${a.marked?' · ⚑ '+a.marked:''} · ${fmtDur(qzDur(a))}</div></div><b class="qzhp ${p>=80?'hi':p<60?'lo':''}">${p}%</b></div>`}).join(''):`<div class="card setcard"><p class="meta">${QZ.attempts.length?'No quizzes of this type yet.':'No completed quizzes yet. Finish a quiz and it will appear here with its date, type, selection, score and duration.'}</p><button type="button" class="btn primary block" onclick="appPage='quiz';renderAppDemo()">Build a quiz</button></div>`}
 ${mk.length?`<details class="card setcard"><summary style="font-weight:800;font-size:16px;cursor:pointer">Marked for review in quizzes (${mk.length})</summary><p class="meta">Questions you flagged during quizzes. This list is separate from Saved and Smart Review.</p>${mk.map(id=>{const q=QBY.get(id);return `<div class="strow hist" onclick="openQ('${id}')"><div><b>${esc(q.id)}</b><small>${esc(QSTEM(q).slice(0,110))}</small></div></div>`}).join('')}</details>`:''}
 ${QZ.attempts.length?`<button type="button" class="btn danger block" style="margin-top:12px" onclick="qzClearAsk()">Delete quiz history</button>`:''}</div>`}
/* ---- stats from completed attempts ---- */
function qzStats(){const A=QZ.attempts,by={sp:{},tp:{}},seen=new Set();let tot=0,cor=0,inc=0,un=0;
 A.forEach(a=>a.items.forEach(i=>{const q=QBY.get(i.id);if(!q)return;tot++;seen.add(i.id);if(i.sel<0){un++;return}i.ok?cor++:inc++;
  [[by.sp,q.spec],[by.tp,q.topic]].forEach(([m,k])=>{const o=m[k]||(m[k]={c:0,w:0,ids:new Set()});o.ids.add(i.id);i.ok?o.c++:o.w++})
 }));
 A.forEach(a=>a.items.forEach(i=>{const q=QBY.get(i.id);if(q&&i.sel<0){[[by.sp,q.spec],[by.tp,q.topic]].forEach(([m,k])=>{(m[k]||(m[k]={c:0,w:0,ids:new Set()})).ids.add(i.id)})}}));
 return {A,by,tot,cor,inc,un,seen:seen.size}}
/* ===== Unit 5: Statistics — three separate sources, each with its own definitions ===== */
let stTab='overview',stTopF='prog',stLim=30;
window.stSet=function(t){stTab=t;stLim=30;renderAppDemo()};
window.stTopSet=function(f){stTopF=f;stLim=30;renderAppDemo()};
window.stMore=function(){stLim+=30;renderAppDemo()};
const stSrc=t=>`<p class="stsrc">${t}</p>`;
const stDef=(t)=>`<details class="stdef"><summary>How this is calculated</summary>${t}</details>`;
function stSpark(A){const L=A.slice(0,20).reverse();if(L.length<2)return '';const W=300,H=110,px=i=>L.length<2?W/2:18+i*(W-30)/(L.length-1),py=v=>96-v*0.84;
 const pts=L.map((a,i)=>`${px(i).toFixed(1)},${py(pct(a.correct,a.items.length)).toFixed(1)}`).join(' ');
 return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Quiz scores over time, oldest to newest: ${L.map(a=>pct(a.correct,a.items.length)+'%').join(', ')}"><g stroke="rgba(138,160,184,.25)" stroke-width="1"><line x1="18" x2="${W-6}" y1="${py(0)}" y2="${py(0)}"/><line x1="18" x2="${W-6}" y1="${py(50)}" y2="${py(50)}"/><line x1="18" x2="${W-6}" y1="${py(100)}" y2="${py(100)}"/></g><g fill="#8aa0b8" font-size="9"><text x="0" y="${py(100)+3}">100</text><text x="2" y="${py(50)+3}">50</text><text x="6" y="${py(0)+3}">0</text></g><polyline fill="none" stroke="#55b4ff" stroke-width="2.2" stroke-linejoin="round" points="${pts}"/>${L.map((a,i)=>`<circle cx="${px(i).toFixed(1)}" cy="${py(pct(a.correct,a.items.length)).toFixed(1)}" r="3.2" fill="#55b4ff"/>`).join('')}</svg>`}
function stQuizHTML(){const A=QZ.attempts;
 if(!A.length)return `${stSrc('Source: completed quizzes only')}<div class="card setcard"><h3>No quiz results yet</h3><p class="meta">Quiz Statistics are calculated from quizzes you submit in Quiz mode. Question Bank answers and Smart Review are tracked in their own tabs.</p><button type="button" class="btn primary block" onclick="appPage='quiz';renderAppDemo()">Build a quiz</button></div>`;
 let pres=0,cor=0,inc=0,un=0;const all=[];A.forEach(a=>{pres+=a.items.length;cor+=a.correct;inc+=a.incorrect;un+=a.unanswered;all.push(...a.items)});
 const sc=A.map(a=>pct(a.correct,a.items.length)),avg=Math.round(sc.reduce((x,y)=>x+y,0)/sc.length),best=Math.max(...sc),g=qzAgg(all);
 const sp=Object.values(g.sp).sort((a,b)=>pct(a.c,a.n)-pct(b.c,b.n)).map(o=>qzRowHTML(SPEC_NAME[o.id]||o.id,o)).join('');
 const tpAll=Object.values(g.tp).sort((a,b)=>pct(a.c,a.n)-pct(b.c,b.n)||b.n-a.n);
 const tp=tpAll.map(o=>qzRowHTML(TOPIC_NAME[o.id]||'',o)).join('');
 const recent=A.slice(0,5).map(a=>`<div class="strow hist" onclick="qzOpen('${a.id}','stats')"><div><b>${fmtDT(a.end)}</b><small>${a.mode==='timed'?'Timed':'Practice'} · ${esc(qzSelText(a))} · ${fmtDur(qzDur(a))}</small></div><span>${pct(a.correct,a.items.length)}%</span></div>`).join('');
 return `${stSrc('Source: completed quizzes only')}
 <div class="abgrid" style="grid-template-columns:repeat(4,1fr)"><div><b>${A.length}</b><small>Quizzes</small></div><div><b>${pres}</b><small>Presented</small></div><div><b>${avg}%</b><small>Avg score</small></div><div><b>${best}%</b><small>Best</small></div></div>
 <div class="abgrid"><div><b style="color:#53e0b0">${cor}</b><small>Correct</small></div><div><b style="color:#ff9aa2">${inc}</b><small>Incorrect</small></div><div><b>${un}</b><small>Unanswered</small></div></div>
 ${stDef(`<p class="meta"><b>Presented</b> = every question shown in a completed quiz (a question repeated in two quizzes counts twice).</p><p class="meta"><b>Avg score</b> = the mean of each quiz's score; each quiz counts equally. <b>Quiz score</b> = correct ÷ questions in that quiz. <b>Best</b> = highest single quiz score.</p><p class="meta">System and topic percentages = correct ÷ questions presented in that system/topic across all quizzes. Unanswered counts as not correct. Strong ≥80%, Needs work &lt;60%, only with at least 2 questions.</p>`)}
 ${A.length>1?`<div class="card setcard"><h3>Performance over time</h3>${stSpark(A)}<p class="meta">Score of each quiz, oldest to newest (last ${Math.min(A.length,20)}).</p></div>`:'<div class="card setcard"><h3>Performance over time</h3><p class="meta">Complete at least two quizzes to see your trend.</p></div>'}
 <div class="card setcard"><h3>By medical system</h3>${sp}</div>
 <details class="card setcard"><summary style="font-weight:800;font-size:17px;cursor:pointer">By topic (${tpAll.length}) — weakest first</summary>${tp}</details>
 <div class="card setcard"><h3>Recent quizzes</h3>${recent}<button type="button" class="btn block" style="margin-top:12px" onclick="appPage='quizhistory';renderAppDemo()">Open full quiz history (${A.length})</button></div>`}
function stBankHTML(){const ans=Object.keys(S.ans).filter(id=>QBY.has(id)),tot=QB.length;let c=0;ans.forEach(id=>{if(S.ans[id].ok)c++});const w=ans.length-c;
 const spRows=(gradeHasPediatrics()?Object.keys(REAL.spec):[]).map(k=>{const l=QB.filter(q=>q.spec===k),a=l.filter(q=>S.ans[q.id]),ok=a.filter(q=>S.ans[q.id].ok).length;return `<div class="strow"><div><b>${esc(SPEC_NAME[k]||REAL.spec[k].label||k)}</b><small>${a.length}/${l.length} questions answered${a.length?` · ${pct(ok,a.length)}% accurate`:''}</small></div><span>${pct(a.length,l.length)}%</span><div class="bar"><span style="width:${pct(a.length,l.length)}%"></span></div></div>`}).join('');
 const T=[];(gradeHasPediatrics()?Object.entries(REAL.spec):[]).forEach(([k,sp])=>sp.topics.forEach(([id,nm,c0,sy])=>{const l=QB.filter(q=>q.topic===id),a=l.filter(q=>S.ans[q.id]),ok=a.filter(q=>S.ans[q.id].ok).length;if(l.length)T.push({id,spec:k,nm,sy,n:l.length,a:a.length,ok,st:a.length===0?'new':a.length>=l.length?'done':'prog'})}));
 const cnt={new:T.filter(t=>t.st==='new').length,prog:T.filter(t=>t.st==='prog').length,done:T.filter(t=>t.st==='done').length};
 const shown=T.filter(t=>t.st===stTopF).sort((a,b)=>stTopF==='prog'?pct(b.a,b.n)-pct(a.a,a.n):a.nm.localeCompare(b.nm)),page=shown.slice(0,stLim);
 const chip=(v,l)=>`<button type="button" class="${stTopF===v?'on':''}" onclick="stTopSet('${v}')">${l} (${cnt[v]})</button>`;
 return `${stSrc('Source: Question Bank answers only (not quizzes, not Smart Review)')}
 <div class="abgrid" style="grid-template-columns:repeat(4,1fr)"><div><b>${tot}</b><small>In bank</small></div><div><b>${ans.length}</b><small>Answered</small></div><div><b style="color:#53e0b0">${c}</b><small>Correct</small></div><div><b style="color:#ff9aa2">${w}</b><small>Wrong</small></div></div>
 <div class="card setcard"><div class="strow" style="border:0;padding-top:0"><div><b>Completion</b><small>${ans.length} of ${tot} questions answered at least once</small></div><span>${pct(ans.length,tot)}%</span><div class="bar"><span style="width:${pct(ans.length,tot)}%"></span></div></div><div class="strow"><div><b>Accuracy</b><small>${c} of ${ans.length} answered questions are currently correct</small></div><span>${pct(c,ans.length)}%</span><div class="bar"><span style="width:${pct(c,ans.length)}%"></span></div></div></div>
 ${stDef(`<p class="meta"><b>Answered</b> counts unique questions. The Question Bank keeps one answer per question, so answering the same question again never adds to this number, and attempts are not counted.</p><p class="meta"><b>Completion</b> = unique answered ÷ questions in the bank. <b>Accuracy</b> = correct ÷ unique answered (by the stored answer). A topic is Not started at 0 answered, Completed when every question is answered, otherwise In progress.</p>`)}
 <div class="card setcard"><h3>By medical system</h3>${spRows}</div>
 <div class="card setcard"><h3>Topics</h3><div class="seg wide" style="margin-bottom:10px;flex-wrap:wrap">${chip('prog','In progress')}${chip('new','Not started')}${chip('done','Completed')}</div>
 ${page.length?page.map(t=>`<div class="strow hist" onclick="openTopic('${t.spec}',${t.id})"><div><b>${esc(t.nm)}</b><small>${esc(SPEC_NAME[t.spec]||t.spec)}${t.sy?' · '+esc(t.sy):''} · ${t.a}/${t.n} answered${t.a?` · ${pct(t.ok,t.a)}% accurate`:''}</small></div><span>${pct(t.a,t.n)}%</span><div class="bar"><span style="width:${pct(t.a,t.n)}%"></span></div></div>`).join('')+(shown.length>stLim?`<button type="button" class="btn block" style="margin-top:10px" onclick="stMore()">Show more (${shown.length-stLim} left)</button>`:''):'<p class="meta">No topics in this group.</p>'}</div>`}
function stSRHTML(){const T=srTotals(),src0=stSrc('Source: Smart Review only');
 if(!T.rev&&!SR3.ses.length)return `${src0}<div class="card setcard"><h3>No Smart Review activity yet</h3><p class="meta">Pick a topic in Smart Review and answer a few questions. Progress, scheduling and recall history will appear here. Quiz results and Question Bank answers stay separate.</p></div>`;
 const recs=Object.values(SR3.q),attempts=recs.reduce((a,r)=>a+(r.n||0),0),correct=recs.reduce((a,r)=>a+(r.ok||0),0);
 const levelRows=SR_LV.map(([k,l])=>`<div class="strow"><div><b>${l}</b><small>${T.lv[k]||0} question${T.lv[k]===1?'':'s'}</small></div><span>${pct(T.lv[k]||0,T.tot)}%</span><div class="bar"><span style="width:${pct(T.lv[k]||0,T.tot)}%"></span></div></div>`).join('');
 return `${src0}
 <div class="abgrid" style="grid-template-columns:repeat(4,1fr)"><div><b>${T.rev}</b><small>Reviewed</small></div><div><b style="color:#ffc857">${T.due}</b><small>Due now</small></div><div><b>${T.od}</b><small>Overdue</small></div><div><b>${T.weak}</b><small>Needs attention</small></div></div>
 <div class="card setcard"><h3>Bank coverage</h3><div class="strow"><div><b>Seen in Smart Review</b><small>${T.rev} of ${T.tot} questions</small></div><span>${pct(T.rev,T.tot)}%</span><div class="bar"><span style="width:${pct(T.rev,T.tot)}%"></span></div></div><div class="strow"><div><b>Not started</b><small>${T.fresh} questions</small></div><span>${pct(T.fresh,T.tot)}%</span><div class="bar"><span style="width:${pct(T.fresh,T.tot)}%"></span></div></div><p class="meta">${attempts} reviews recorded · ${correct} correct</p></div>
 <div class="card setcard"><h3>Learning levels</h3>${levelRows}</div>
 <div class="card setcard"><h3>Schedule &amp; daily activity</h3><div class="abgrid"><div><b>${T.dueToday}</b><small>Due today</small></div><div><b>${T.upcoming}</b><small>Due after today</small></div><div><b>${T.week}</b><small>Next 7 days</small></div><div><b>${T.today}</b><small>Reviewed today</small></div></div><p class="meta">Daily goal: ${SR3.goal} questions · overall mastery ${T.pct}%</p></div>
 ${stDef(`<p class="meta"><b>Mastery</b> is computed from each question's level and schedule, never from correct-answer percentage alone, and questions not yet met in Smart Review count as New. <b>Due now</b> = review time has arrived. <b>Overdue</b> = due before today began. <b>Needs attention</b> = questions flagged weak. Smart Review memory is independent of Question Bank answers and Quiz results.</p>`)}`}
statsView=function(){const tab=(v,l)=>`<button type="button" class="${stTab===v?'on':''}" onclick="stSet('${v}')">${l}</button>`;
 const title={quiz:'Quiz Statistics',bank:'Question Bank Progress',sr:'Smart Review Statistics'}[stTab]||'Quiz Statistics';
 return `${appHeader('Statistics')}<div class="rs"><h1>Statistics</h1><div class="seg wide" style="margin:6px 0 10px">${tab('quiz','Quiz')}${tab('bank','Question Bank')}${tab('sr','Smart Review')}</div><h2 class="sth">${title}</h2>${stTab==='bank'?stBankHTML():stTab==='sr'?stSRHTML():stQuizHTML()}</div>`};
window.qzClearAsk=function(){confirmBox({title:'Delete quiz history?',text:`${QZ.attempts.length} completed quiz${QZ.attempts.length>1?'zes':''} and all statistics based on them will be removed.`,detail:'Question Bank answers, saved questions, notes, reports and Smart Review are not affected.',ok:'Delete',danger:true},()=>{QZ.attempts=[];qzSave();renderAppDemo()})};
/* ===== Study Session Timer (real): counts ACTIVE time only; Pause/Resume; sessions + progress saved on this device ===== */
const STK='shbace_studytime_v1',ST_IDLE=5*60*1000;
const ST=(()=>{let d=null;try{d=JSON.parse(localStorage.getItem(STK)||'null')}catch(e){}if(!d||typeof d!=='object')d={};
 d.sessions=Array.isArray(d.sessions)?d.sessions.filter(x=>x&&Number.isFinite(x.ms)&&x.ms>0).slice(-500):[];
 {const c=d.cur;if(c&&Number.isFinite(c.ms)){if(c.running&&Number.isFinite(c.rs)){const hb=Number.isFinite(c.hb)?c.hb:c.rs;if(Date.now()-hb>6*36e5){c.ms+=Math.max(0,hb-c.rs);c.running=false;c.auto=true}}else{c.running=false}}else d.cur=null}
 d.goal=(Number.isFinite(d.goal)&&d.goal>=5&&d.goal<=240)?d.goal:25; /* a running session keeps counting across page changes, minimising and restarts (wall-clock); only a 6h+ gap counts as abandoned */
 return d})();
const stSave=()=>{try{if(ST.cur&&ST.cur.running)ST.cur.hb=Date.now();localStorage.setItem(STK,JSON.stringify({sessions:ST.sessions,cur:ST.cur,goal:ST.goal}))}catch(e){}};
let stLast=Date.now(),stIdleAt=Date.now(),stN=0;
const stClock=ms=>{const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`};
const stHuman=ms=>{const m=Math.round(ms/60000);if(ms<60000)return Math.round(ms/1000)+'s';return m<60?m+'m':Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'};
const stAnsCount=()=>Object.keys(S.ans).length;
const stCurMs=c=>c?c.ms+(c.running&&Number.isFinite(c.rs)?Math.max(0,Date.now()-c.rs):0):0;
function stTotals(){const now=new Date(),d0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),wk=d0-6*864e5;let tot=0,today=0,week=0,q=0;
 ST.sessions.forEach(x=>{tot+=x.ms;q+=x.q||0;if(x.end>=d0)today+=x.ms;if(x.end>=wk)week+=x.ms});
 if(ST.cur){const cm=stCurMs(ST.cur);tot+=cm;today+=cm;week+=cm}
 const days=[];for(let i=6;i>=0;i--){const a=d0-i*864e5,b=a+864e5;let ms=ST.sessions.filter(x=>x.end>=a&&x.end<b).reduce((t,x)=>t+x.ms,0);if(ST.cur&&i===0)ms+=stCurMs(ST.cur);days.push({a,ms})}
 return {tot,today,week,q,sessions:ST.sessions.length,days}}
function stStart(){if(!ST.cur)ST.cur={id:'S'+Date.now().toString(36),start:Date.now(),ms:0,running:false,a0:stAnsCount()};ST.cur.rs=Date.now();ST.cur.running=true;ST.cur.auto=false;stLast=Date.now();stIdleAt=Date.now();stSave();stBarRefresh()}
function stPause(auto){if(!ST.cur||!ST.cur.running)return;ST.cur.ms=stCurMs(ST.cur);ST.cur.running=false;ST.cur.auto=!!auto;stSave();stBarRefresh()}
function stFinish(){const c=ST.cur;if(!c)return;const ms=stCurMs(c),ok=ms>=5000;if(ok)ST.sessions.push({id:c.id,start:c.start,end:Date.now(),ms:ms,q:Math.max(0,stAnsCount()-(c.a0||0))});ST.cur=null;stSave();stBarRefresh();try{toast(ok?'Session saved · '+stHuman(ms):'Sessions under 5 seconds are not saved')}catch(e){}if(appPage==='stats'||appPage==='timer')renderAppDemo()}
function stBarHTML(){const c=ST.cur,run=!!(c&&c.running),state=!c?'idle':run?'running':'paused';
 const ico='<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';
 const lab=!c?'Study timer':run?'Studying':(c.auto?'Auto-paused':'Paused');
 const btns=!c?'<button type="button" class="go" onclick="stTimerStart()" aria-label="Start study timer">▶ Start</button>':run?'<button type="button" onclick="stTimerPause()" aria-label="Pause study timer">❚❚</button><button type="button" onclick="stTimerFinish()" aria-label="Finish and save session">■</button>':'<button type="button" class="go" onclick="stTimerStart()" aria-label="Resume study timer">▶</button><button type="button" onclick="stTimerFinish()" aria-label="Finish and save session">■</button>';
 return `<div class="sst-bar ${state}" role="group" aria-label="Study timer">${ico}<span class="sst-lab">${lab}</span><b class="sst-time">${stClock(stCurMs(c))}</b>${btns}</div>`}
function stBarRefresh(){const o=document.querySelector('.sst-bar');if(!o)return;const t=document.createElement('div');t.innerHTML=stBarHTML();o.replaceWith(t.firstElementChild)}
function stInject(){document.querySelectorAll('.sst-bar').forEach(n=>n.remove());if(appPage!=='questions')return;const host=document.querySelector('.phone-content .rs');if(!host)return;const t=document.createElement('div');t.innerHTML=stBarHTML();host.insertBefore(t.firstElementChild,host.firstChild)}
window.stTimerStart=stStart;window.stTimerPause=()=>stPause(false);window.stTimerFinish=stFinish;
const stTick=()=>{const c=ST.cur;if(!c||!c.running)return;const ms=stCurMs(c);if(++stN%10===0)stSave();document.querySelectorAll('.sst-time').forEach(el=>{el.textContent=stClock(ms)});try{window.stTimerTick&&window.stTimerTick(ms)}catch(e){}};
setInterval(stTick,500);
['pointerdown','keydown','scroll','touchstart'].forEach(ev=>addEventListener(ev,()=>{stIdleAt=Date.now()},{passive:true,capture:true}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stSave();else{stLast=Date.now();stTick()}});
addEventListener('pagehide',()=>{stSave()});
const __stR=renderAppDemo;renderAppDemo=function(){const r=__stR.apply(this,arguments);try{stInject()}catch(e){console.error(e)}return r};
window.__shbStudy={start:stStart,pause:()=>stPause(false),finish:stFinish,state:()=>JSON.parse(JSON.stringify({sessions:ST.sessions,cur:ST.cur})),totals:stTotals};
/* ===== v16 · Study Timer page (Focus Session) — same ST store/session history as the Question Bank bar; wall-clock based ===== */
const TM_R=100,TM_C=2*Math.PI*TM_R;let tmArm=0;
function tmFrac(ms){const g=ST.goal*60000;return g?Math.min(1,ms/g):0}
function tmDot(f){const a=f*2*Math.PI-Math.PI/2;return [120+TM_R*Math.cos(a),120+TM_R*Math.sin(a)]}
function tmGoalText(ms){const g=ST.goal;return ms>=g*60000?`Goal reached · ${g} min`:`Goal ${g} min · ${Math.round(tmFrac(ms)*100)}%`}
window.stTimerTick=function(ms){const dg=document.getElementById('tmDigits');if(!dg)return;dg.textContent=stClock(ms);
 const f=tmFrac(ms),arc=document.getElementById('tmArc'),dot=document.getElementById('tmDot'),gl=document.getElementById('tmGoalTxt');
 if(arc)arc.style.strokeDashoffset=String(TM_C*(1-f));
 if(dot){const p=tmDot(f);dot.setAttribute('cx',p[0].toFixed(1));dot.setAttribute('cy',p[1].toFixed(1))}
 if(gl)gl.textContent=tmGoalText(ms)};
function timerView(){
 const c=ST.cur,run=!!(c&&c.running),ms=stCurMs(c),f=tmFrac(ms),T=stTotals(),p=tmDot(f);
 const state=!c?'ready':run?'running':'paused';
 const stTxt=!c?'Ready to focus':run?'Studying · counting':(c.auto?'Auto-paused':'Paused');
 const qn=c?Math.max(0,stAnsCount()-(c.a0||0)):0;
 const PRE=[15,25,45,60],isCu=PRE.indexOf(ST.goal)<0;
 const chips=PRE.map(m=>`<button type="button" class="tm-chip${ST.goal===m?' on':''}" onclick="tmGoal(${m})">${m} min</button>`).join('')+`<button type="button" class="tm-chip${isCu?' on':''}" onclick="tmCuOpen()">${isCu?ST.goal+' min · ':''}Custom</button>`;
 const cuRow=(isCu||window.__tmCu)?`<div class="tm-cu"><input id="tmCuIn" class="tm-cuin" type="number" inputmode="numeric" min="5" max="240" step="1" placeholder="5–240" value="${isCu?ST.goal:''}" aria-label="Custom session minutes" onkeydown="if(event.key==='Enter')tmCuSet()"><span class="tm-cuu">min</span><button type="button" class="tm-chip on" onclick="tmCuSet()">Set</button></div><p class="meta tm-cuerr" id="tmCuErr" style="text-align:center;margin:6px 0 0;display:none">Enter a whole number from 5 to 240.</p>`:'';
 const main=!c?'Start':run?'Pause':'Resume';
 const ico=run?'<path d="M8 5v14M16 5v14"/>':'<path d="M8 5l11 7-11 7z"/>';
 const armed=tmArm&&Date.now()-tmArm<3500;
 const hist=ST.sessions.slice(-5).reverse().map(x=>`<div class="strow hist"><div><b>${fmtDT(x.end)}</b><small>${stClock(x.ms)} study time · ${x.q||0} question${(x.q||0)===1?'':'s'} answered</small></div><span>${stHuman(x.ms)}</span></div>`).join('');
 return `${appHeader('Study timer')}<div class="rs tm"><h1>Study timer</h1><p class="sub">Focus Session · real study time, saved on this device.</p>
 <div class="card tm-card tm-${state}">
  <div class="tm-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><defs><linearGradient id="tmGr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fb4ff"/><stop offset="1" stop-color="#5fe0cf"/></linearGradient></defs>
   <circle class="tm-track" cx="120" cy="120" r="${TM_R}"/>
   <circle id="tmArc" class="tm-arc" cx="120" cy="120" r="${TM_R}" stroke="url(#tmGr)" style="stroke-dasharray:${TM_C.toFixed(2)};stroke-dashoffset:${(TM_C*(1-f)).toFixed(2)}"/>
   <circle id="tmDot" class="tm-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="7"/></svg>
   <div class="tm-center"><b id="tmDigits" class="tm-digits">${stClock(ms)}</b><span class="tm-kick">FOCUS SESSION</span><span class="tm-state"><i></i>${stTxt}</span></div></div>
  <p class="tm-goal" id="tmGoalTxt">${tmGoalText(ms)}</p>
  <button type="button" class="btn primary block tm-main" onclick="tmToggle()"><svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ico}</svg>${main}</button>
  <div class="tm-row"><button type="button" class="btn tm-sec" ${c?'':'disabled'} onclick="tmReset()">${armed?'Tap again to reset':'↺ Reset'}</button><button type="button" class="btn tm-sec" ${c?'':'disabled'} onclick="stTimerFinish()">■ Save session</button></div>
  <div class="tm-chips" role="group" aria-label="Session goal">${chips}</div>${cuRow}
  ${c?`<p class="meta tm-q">This session: ${qn} question${qn===1?'':'s'} answered.</p>`:''}
 </div>
 <div class="abgrid" style="grid-template-columns:repeat(3,1fr)"><div><b>${stHuman(T.today)}</b><small>Today</small></div><div><b>${stHuman(T.tot)}</b><small>Total study</small></div><div><b>${T.sessions}</b><small>Sessions</small></div></div>
 ${hist?`<div class="card setcard"><h3>Previous sessions</h3>${hist}</div>`:`<div class="card setcard"><h3>No sessions yet</h3><p class="meta">Start a Focus Session. When you save it, it appears here and in your Statistics.</p></div>`}
 <p class="meta" style="text-align:center;margin:6px 4px 10px">Time keeps counting while you move between pages or minimise the app. Pause or save the session when you finish.</p></div>`}
window.tmToggle=function(){const c=ST.cur;if(c&&c.running)stPause(false);else stStart();renderAppDemo()};
window.tmGoal=function(m){window.__tmCu=false;ST.goal=m;stSave();renderAppDemo()};
window.tmCuOpen=function(){window.__tmCu=true;renderAppDemo();setTimeout(function(){var i=document.getElementById('tmCuIn');if(i)i.focus()},30)};
window.tmCuSet=function(){var i=document.getElementById('tmCuIn'),v=i?Number(i.value):NaN;if(!Number.isInteger(v)||v<5||v>240){var e=document.getElementById('tmCuErr');if(e)e.style.display='block';return}window.__tmCu=false;ST.goal=v;stSave();renderAppDemo()};
window.tmReset=function(){if(!ST.cur)return;
 if(tmArm&&Date.now()-tmArm<3500){tmArm=0;ST.cur=null;stSave();stBarRefresh();renderAppDemo();try{toast('Session reset')}catch(e){}}
 else{tmArm=Date.now();renderAppDemo();setTimeout(()=>{if(appPage==='timer'&&tmArm&&Date.now()-tmArm>=3400){tmArm=0;renderAppDemo()}},3600)}};

/* ===== v16 · Statistics overview — every number comes from the real answer log, Study Timer sessions, quiz attempts and Smart Review history ===== */
function stDayIdx(t){return Math.floor((t-new Date(t).getTimezoneOffset()*6e4)/864e5)}
function stActivityDays(){const s=new Set();
 Object.keys(S.ans).forEach(id=>{const a=S.ans[id];if(a&&a.t&&QBY.has(id))s.add(stDayIdx(a.t))});
 ST.sessions.forEach(x=>{if(x.end)s.add(stDayIdx(x.end))});
 if(ST.cur&&stCurMs(ST.cur)>=5000)s.add(stDayIdx(Date.now()));
 try{QZ.attempts.forEach(a=>{if(a&&a.end)s.add(stDayIdx(a.end))})}catch(e){}
 try{Object.values(SR3.q).forEach(r=>{if(r&&r.last)s.add(stDayIdx(r.last))})}catch(e){}
 return s}
function stStreak(){const s=stActivityDays(),t0=stDayIdx(Date.now());let d=t0,n=0;if(!s.has(d))d--;while(s.has(d)){n++;d--}return {n,today:s.has(t0)}}
function stTopicPerf(){const m={};QB.forEach(q=>{const o=m[q.topic]||(m[q.topic]={a:0,c:0,tot:0});o.tot++;const x=S.ans[q.id];if(x){o.a++;if(x.ok)o.c++}});
 return Object.keys(m).filter(k=>m[k].a>0).map(k=>({id:k,name:TOPIC_NAME[k]||'Other',a:m[k].a,c:m[k].c,tot:m[k].tot,acc:pct(m[k].c,m[k].a)})).sort((x,y)=>x.acc-y.acc||y.a-x.a)}
function stSrSnap(){try{const now=Date.now(),L=srList().filter(x=>x.r.due<=now),dc={Hard:0,Medium:0,Easy:0,Unrated:0};L.forEach(x=>{const l=srDiff(x.r).l;dc[l]=(dc[l]||0)+1});return {due:L.length,dc}}catch(e){return null}}
function stOverviewHTML(){
 const B=window.__shbStats(),stk=stStreak(),T=stTotals(),sr=stSrSnap(),has=B.answered>0,C=2*Math.PI*100;
 const ring=`<div class="ov-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><defs><linearGradient id="ovGr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fb4ff"/><stop offset="1" stop-color="#5fe0cf"/></linearGradient></defs><circle class="tr" cx="120" cy="120" r="100"/>${has?`<circle class="pg" cx="120" cy="120" r="100" stroke="url(#ovGr)" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${(C*(1-B.accuracy/100)).toFixed(2)}"/>`:''}</svg><div class="ct"><b>${has?B.accuracy+'%':'—'}</b><small>ACCURACY</small></div></div>`;
 const hero=`<div class="card ov-hero">${ring}${has?`<p class="meta" style="margin:2px 0 0">${B.correct} correct of ${B.answered} answered</p>`:`<p class="meta" style="margin:2px 0 10px">No answers yet. Answer questions in the Question Bank or a Quiz and your accuracy appears here.</p><button type="button" class="btn primary block" onclick="appPage='questions';renderAppDemo()">Open Question Bank</button>`}</div>`;
 const card=(v,l,s,bar)=>`<div class="ov-st"><small class="k">${l}</small><b>${v}</b><small>${s}</small>${bar!=null?`<div class="bar" style="margin:8px 0 0"><span style="width:${bar}%"></span></div>`:''}</div>`;
 const grid=`<div class="ov-grid">${card(B.answered,'Answered Questions',`of ${B.bankTotal} in the bank`)}${card(stk.n+(stk.n===1?' day':' days'),'Study Streak',stk.n?(stk.today?'Active today':'Study today to keep it'):'Start your streak today')}${card(T.tot>=1000?stHuman(T.tot):'—','Study Time',T.tot>=1000?`${stHuman(T.today)} today · ${T.sessions} session${T.sessions===1?'':'s'}`:'Start a Focus Session')}${card(B.completion+'%','Progress',`${B.topicsStarted} of ${B.topicsTotal} topics started`,B.completion)}</div>`;
 const d0=stDayIdx(Date.now()),dn=['Su','Mo','Tu','We','Th','Fr','Sa'],days=[];for(let i=6;i>=0;i--)days.push({i:d0-i,dow:new Date(Date.now()-i*864e5).getDay(),c:0,w:0});
 Object.keys(S.ans).forEach(id=>{const a=S.ans[id];if(!a||!a.t||!QBY.has(id))return;const o=days.find(x=>x.i===stDayIdx(a.t));if(o){if(a.ok)o.c++;else o.w++}});
 const mx=Math.max(1,...days.map(x=>x.c+x.w)),any=days.some(x=>x.c+x.w>0);
 const chart=any?`<div class="ov-chart">${days.map(x=>`<div class="ov-col"><small>${x.c+x.w||''}</small><div class="ov-bar" style="height:${Math.max(4,Math.round((x.c+x.w)*100/mx*0.72))}px" title="${x.c} correct · ${x.w} wrong"><i style="flex:${x.c};background:#4fb4ff"></i><i style="flex:${x.w};background:#ff8c8c"></i></div><small>${dn[x.dow]}</small></div>`).join('')}</div><div class="ov-leg"><span><i style="background:#4fb4ff"></i>Correct</span><span><i style="background:#ff8c8c"></i>Wrong</span></div>`:`<p class="meta">Answer questions to see your last 7 days here.</p>`;
 const tp=stTopicPerf(),weak=tp.slice(0,6);
 const topics=tp.length?weak.map(t=>`<div class="strow" style="border:0;padding:5px 0"><div><b>${esc(t.name)}</b><small>${t.c}/${t.a} correct · ${t.a} of ${t.tot} answered</small></div><div class="bar"><span style="width:${t.acc}%;${t.acc<50?'background:linear-gradient(90deg,#ff8c8c,#ffb454)':''}"></span></div><span>${t.acc}%</span></div>`).join('')+(tp.length>6?`<p class="meta" style="margin:8px 0 0">Showing the 6 topics that need the most work · ${tp.length} topics started.</p>`:`<p class="meta" style="margin:8px 0 0">Weakest first.</p>`):`<p class="meta">Topic performance appears after you answer questions.</p>`;
 const srCard=sr?`<div class="card ov-sr"><div class="ov-srh"><div><b class="ov-srn">${sr.due}</b><span> question${sr.due===1?'':'s'} to review</span></div></div>${sr.due?`<div class="ov-chips">${['Hard','Medium','Easy','Unrated'].filter(k=>sr.dc[k]).map(k=>`<span class="ov-chip ${k.toLowerCase()}">${k==='Unrated'?'New':k} · ${sr.dc[k]}</span>`).join('')}</div>`:`<p class="meta" style="margin:6px 0 0">Nothing is due right now.</p>`}<button type="button" class="btn primary block" style="margin-top:12px" onclick="appPage='review';renderAppDemo()">${sr.due?'Review now':'Open Smart Review'}</button></div>`:'';
 return `${stSrc('Source: your answers, Study Timer sessions and Smart Review history on this device')}${hero}${grid}
 <div class="card setcard"><h3>Last 7 days</h3>${chart}</div>
 <div class="card setcard"><h3>Topic performance</h3>${topics}</div>
 <h3 class="ov-h">Smart Review</h3>${srCard}
 ${stDef('<p class="meta"><b>Accuracy</b> = questions whose latest answer is correct ÷ questions answered at least once. <b>Study streak</b> = consecutive days with any recorded study activity (answers, quizzes, Smart Review or timer sessions); today counts once you study. <b>Study time</b> = total of your saved Focus Sessions plus the open one. The 7-day chart groups each question by the day of its latest answer. Nothing here is sample data.</p>')}`}

/* ---- Statistics: one extra tab fed by the timer; the three existing tabs and their calculations are untouched ---- */
function stTimeHTML(){const T=stTotals();
 if(!ST.sessions.length&&!ST.cur)return `${stSrc('Source: your Study Timer sessions (Focus Sessions)')}<div class="card setcard"><h3>No study sessions yet</h3><p class="meta">Open the Study Timer and start a Focus Session. Your sessions and total study time will appear here.</p></div>`;
 const mx=Math.max(1,...T.days.map(d=>d.ms)),dn=['Su','Mo','Tu','We','Th','Fr','Sa'];
 const bars=T.days.map(d=>`<div class="strow" style="border:0;padding:4px 0"><div><b>${dn[new Date(d.a).getDay()]}</b><small>${d.ms?stHuman(d.ms):'—'}</small></div><div class="bar"><span style="width:${pct(d.ms,mx)}%"></span></div></div>`).join('');
 const rec=ST.sessions.slice(-6).reverse().map(x=>`<div class="strow hist"><div><b>${fmtDT(x.end)}</b><small>${stClock(x.ms)} active · ${x.q||0} question${(x.q||0)===1?'':'s'} answered</small></div><span>${stHuman(x.ms)}</span></div>`).join('');
 return `${stSrc('Source: your Study Timer sessions (Focus Sessions)')}<div class="abgrid" style="grid-template-columns:repeat(4,1fr)"><div><b>${stHuman(T.today)}</b><small>Today</small></div><div><b>${stHuman(T.week)}</b><small>7 days</small></div><div><b>${stHuman(T.tot)}</b><small>Total</small></div><div><b>${T.sessions}</b><small>Sessions</small></div></div>
 ${ST.cur?`<div class="card setcard"><p class="meta">A session is open (${stClock(stCurMs(ST.cur))} so far). It is saved to your history when you press ■ Finish.</p></div>`:''}
 <div class="card setcard"><h3>Last 7 days</h3>${bars}</div>${rec?`<div class="card setcard"><h3>Recent sessions</h3>${rec}</div>`:''}
 ${stDef('<p class="meta"><b>Study time</b> is the real duration of your Focus Sessions: it keeps counting while you move between pages or minimise the app, and stops only when you pause or save the session. <b>Questions answered</b> = new Question Bank answers recorded between Start and Finish.</p>')}`}
const __stv=statsView;
statsView=function(){const keep=stTab,cust=keep==='time'||keep==='overview';let out;if(cust){stTab='quiz';try{out=__stv()}finally{stTab=keep}}else out=__stv();
 if(cust)out=out.replace('<button type="button" class="on"','<button type="button" class=""');
 out=out.replace(/(<div class="seg wide"[^>]*>)([\s\S]*?)<\/div>/,`$1<button type="button" class="${keep==='overview'?'on':''}" onclick="stSet('overview')">Overview</button>$2<button type="button" class="${keep==='time'?'on':''}" onclick="stSet('time')">Time</button></div>`);
 if(keep==='time')out=out.replace(/<h2 class="sth">[\s\S]*$/,`<h2 class="sth">Study Time</h2>${stTimeHTML()}</div>`);
 else if(keep==='overview')out=out.replace(/<h2 class="sth">[\s\S]*$/,`<h2 class="sth">Overview</h2>${stOverviewHTML()}</div>`);
 return out};
/* ---- Onboarding bridge: the SAME numbers/definitions as the Question Bank tab (stBankHTML), exposed read-only ---- */
window.__shbStats=function(){const ans=Object.keys(S.ans).filter(id=>QBY.has(id)),tot=QB.length;let c=0;ans.forEach(id=>{if(S.ans[id].ok)c++});
 let tS=0,tD=0,tT=0;(gradeHasPediatrics()?Object.entries(REAL.spec):[]).forEach(([k,sp])=>sp.topics.forEach(([id])=>{const l=QB.filter(q=>q.topic===id);if(!l.length)return;tT++;const a=l.filter(q=>S.ans[q.id]).length;if(a>0)tS++;if(a>=l.length)tD++}));
 const T=stTotals();return {bankTotal:tot,answered:ans.length,correct:c,accuracy:ans.length?pct(c,ans.length):null,completion:pct(ans.length,tot),topicsTotal:tT,topicsStarted:tS,topicsDone:tD,quizzes:QZ.attempts.length,studyMs:T.tot,sessions:T.sessions}};
/* ---- wiring ---- */
PAGES.notifs=notifsView;PAGES.quizhistory=qzHistoryView;PAGES.timer=timerView;
/* ---- Weak areas: topics ranked weakest-first from your real answers (same source as Statistics > Topic performance) ---- */
window.wkPractice=function(){const tp=stTopicPerf();if(!tp.length)return;
 let pick=tp.filter(t=>t.acc<75);if(!pick.length)pick=tp.slice(0,3);pick=pick.slice(0,5);
 const specs=[...new Set(pick.map(t=>(QB.find(q=>q.topic===t.id)||{}).spec).filter(Boolean))];
 QC.scope='sel';QC.specs=specs;QC.topics=pick.map(t=>t.id);qcSave();appPage='quiz';renderAppDemo()};
window.wkTopic=function(id){const q=QB.find(x=>x.topic===id);if(q)qzTopicQuiz(q.spec,id)};
function weakView(){const tp=stTopicPerf(),n=tp.length,wk=tp.filter(t=>t.acc<50).length,mid=tp.filter(t=>t.acc>=50&&t.acc<75).length,ok=n-wk-mid;
 const tier=a=>a<50?['Weak','#ff8c8c']:a<75?['Needs work','#ffb454']:['Strong','#5fe0cf'];
 const rows=tp.map(t=>{const [lb,col]=tier(t.acc);return `<button type="button" class="card setcard wk-row" onclick="wkTopic('${t.id}')" aria-label="Practice ${esc(t.name)}"><div class="wk-top"><b>${esc(t.name)}</b><span class="wk-tag" style="color:${col};border-color:${col}55">${lb}</span></div><div class="bar" style="margin:8px 0 6px"><span style="width:${t.acc}%;${t.acc<50?'background:linear-gradient(90deg,#ff8c8c,#ffb454)':''}"></span></div><small class="meta">${t.acc}% · ${t.c} correct · ${t.a-t.c} wrong · ${t.a} of ${t.tot} answered</small></button>`}).join('');
 const hero=n?`<div class="card ov-sr"><div class="ov-srh"><div><b class="ov-srn">${wk}</b><span> weak topic${wk===1?'':'s'}</span></div></div><div class="ov-chips"><span class="ov-chip hard">Weak · ${wk}</span><span class="ov-chip medium">Needs work · ${mid}</span><span class="ov-chip easy">Strong · ${ok}</span></div><button type="button" class="btn primary block" style="margin-top:12px" onclick="wkPractice()">Practice weakest topics</button></div>`
  :`<div class="card setcard"><h3>No data yet</h3><p class="meta">Answer some questions and your weakest topics will appear here, ranked from weakest to strongest.</p><button type="button" class="btn primary block" onclick="appPage='quiz';renderAppDemo()">Start a quiz</button></div>`;
 return `${appHeader('Weak areas')}<div class="rs"><h1>Weak areas</h1><p class="sub">Topics ranked weakest first, from your own answers.</p>${hero}${n?`<h3 class="ov-h">All topics you started</h3>${rows}<p class="meta" style="text-align:center;margin:8px 4px 12px">Tap a topic to practise it. Weak &lt; 50% · Needs work 50–74% · Strong 75%+</p>`:''}</div>`}
PAGES.weak=weakView;

/* ---- Grade page: grade <-> subjects ---- */
const GR_ICO={'Pediatrics':'👶','Internal Medicine':'🫀','Surgery':'🩺'};
let grPend=0;const GR_BOOK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5c-3.5-.4-6.5 0-8.5 1.5zM12 6.5v13"/></svg>';
function grStats(){let n=0,p=0;try{n=answeredCount(QB);p=pct(n,QB.length)}catch(e){}return{n:n,p:p,t:(QB&&QB.length)||0}}
function grScope(g){return g===5?grStats().p:0}
window.grPick=function(n){if(n===selectedGrade){grPend=0;return}
 if(grPend!==n){grPend=n;renderAppDemo();return}
 grPend=0;selectedGrade=n;try{localStorage.setItem('shbace_onboarding_v3_grade',String(n))}catch(e){}
 try{toast('Switched to Grade '+n)}catch(e){}renderAppDemo()};
function gradeView(){const g=selectedGrade||5,list=GRADE_SUBJECTS[g]||[],st=grStats(),p=grScope(g),R=44,C=2*Math.PI*R;
 const lastTxt=(()=>{let t='Not started yet';try{const l=(REC||[]).find(e=>e&&e.k==='topic'&&e.topic);if(l)t='Last Topic: '+(TOPIC_NAME[l.topic]||'Topic')}catch(e){}return t})();
 const cards=list.map(nm=>{const live=(nm==='Pediatrics');
  return live?`<section class="h7-card h7-cont" role="button" tabindex="0" aria-label="Pediatrics, ${st.p}% answered" onclick="appPage='specialties';renderAppDemo()" onkeydown="if(event.key==='Enter'){appPage='specialties';renderAppDemo()}" style="cursor:pointer"><img class="h7-ph" alt="" src="${PEDIA_HERO_SRC}"><div class="h7-in"><h2>Pediatrics</h2><div class="h7-last">${GR_BOOK}<span>${lastTxt}</span></div><div class="h7-prog"><div class="h7-bar"><i style="width:${st.p}%"></i></div><b class="h7-pct">${st.p}%</b></div></div></section>`
  :`<div class="card sc soon"><div class="sic">${GR_ICO[nm]||'📘'}</div><div><h3>${nm}</h3><div class="meta">Coming soon</div></div></div>`}).join('');
 const chips=[1,2,3,4,5].map(n=>`<button type="button" class="tm-chip${n===g?' on':''}" onclick="grPick(${n})">Grade ${n}</button>`).join('');
 let note='';if(grPend&&grPend!==g){const a=GRADE_SUBJECTS[g]||[],b=GRADE_SUBJECTS[grPend]||[],hid=a.filter(x=>b.indexOf(x)<0);note=`<p class="meta gr-note">Switch to Grade ${grPend}?${hid.length?' '+hid.join(', ')+' will be hidden.':''} Tap Grade ${grPend} again to confirm.</p>`}
 return `${appHeader('Grade')}<div class="rs h7"><h1>Grade ${g}</h1><p class="sub">${list.length} core subjects · progress is counted for this grade only.</p>
 <div class="card gr-hero"><div class="gr-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="grGr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fb4ff"/><stop offset="1" stop-color="#5fe0cf"/></linearGradient></defs><circle class="gr-track" cx="50" cy="50" r="${R}"/><circle class="gr-arc" cx="50" cy="50" r="${R}" stroke="url(#grGr)" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${(C*(1-p/100)).toFixed(2)}"/></svg><b>${p}%</b></div>
 <div class="gr-tx"><div class="eyebrow">YOUR GRADE</div><h3>Grade ${g}</h3><div class="meta">${list.join(' · ')}</div></div></div>
 ${cards}
 <div class="soon-h">Change grade</div><div class="tm-chips" role="group" aria-label="Grade">${chips}</div>${note}</div>`}
PAGES.grade=gradeView;
{const _sv=subjectsView;subjectsView=function(){const g=selectedGrade;if(!g||g===5)return _sv.apply(this,arguments);
 const list=GRADE_SUBJECTS[g]||[];return `${appHeader('Subjects')}<div class="rs"><h1>Subjects</h1><p class="sub">Grade ${g} · ${list.length} subjects</p>${list.map(nm=>`<div class="card sc soon"><div class="sic">${GR_ICO[nm]||'📘'}</div><div><h3>${nm}</h3><div class="meta">Coming soon</div></div></div>`).join('')}<button type="button" class="btn primary block" style="margin-top:12px" onclick="appPage='grade';renderAppDemo()">Change grade</button></div>`}}

DR2.forEach(g=>g[1].forEach(it=>{if(it[0]==='Notifications')it[1]='notifs'}));
{const pg=DR2.find(g=>g[0]==='Progress');if(pg&&!pg[1].some(it=>it[0]==='Study timer'))pg[1].push(['Study timer','timer','<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>'])}
const __td2=toggleDrawer;toggleDrawer=function(f){const u=unreadN();DR2.forEach(g=>g[1].forEach(it=>{if(it[0]==='Notifications')it[3]=u?String(u):''}));__td2(f);
 const me=$('.dr-me');if(me){const p=pct(answeredCount(QB),QB.length);const sp=me.querySelectorAll('span');const gp=(selectedGrade&&selectedGrade!==5)?0:p;if(sp[1])sp[1].textContent=gp+'% of Grade '+(selectedGrade||5)+' answered';const b=me.querySelector('.bar i');if(b)b.style.width=gp+'%'}};
if(QZ.active&&QZ.active.deadline&&QZ.active.deadline<=Date.now())qzFinish('expired');
{const due=dueList().length;if(due)addNotif('sr-'+dayKey(),'Smart Review due',`${due} question${due>1?'s are':' is'} ready to review.`,'review')}

/* ---- navigation integration: reported page, back button, live due badge ---- */
function reportedView(){const ids=Object.keys(S.rep).filter(id=>QBY.has(id));
 return `${appHeader('Reported questions')}<div class="rs"><h1>Reported questions</h1><p class="sub">Questions you flagged as possibly wrong. Reports are stored on this device.</p>
 ${ids.length?ids.map(id=>{const q=QBY.get(id);return `<div class="card sc gq" role="button" tabindex="0" onclick="openQ('${id}')"><div class="eyebrow">${id} · ${esc(SPEC_NAME[q.spec]||q.spec)}</div><h3>${esc(q.q.length>200?q.q.slice(0,198)+'…':q.q)}</h3><div class="meta">${esc(TOPIC_NAME[q.topic]||'')}</div></div>`}).join(''):'<div class="card setcard"><p class="meta">No reported questions. Use “Report error” on a question in the Question Bank.</p><button type="button" class="btn block" onclick="appPage=\'questions\';renderAppDemo()">Open question bank</button></div>'}</div>`}
PAGES.reported=reportedView;
DR2.forEach(g=>g[1].forEach(it=>{if(it[0]==='Reported questions')it[1]='reported'}));
const BACKP={specialties:'subjects',topics:'specialties',questions:'*',saved:'subjects',wrong:'subjects',quizresult:'quiz',quizhistory:'quiz',stats:'subjects',timer:'subjects',settings:'subjects',about:'subjects',dedication:'about',changelog:'subjects',feedback:'subjects',rate:'subjects',pinned:'subjects',weak:'stats',notifs:'subjects',reported:'subjects',menu:'subjects'};
window.navBack=function(){let p=BACKP[appPage];if(p==='*')p=(qs.spec&&qs.spec!=='all')?'topics':'subjects';if(appPage==='quizresult'&&qzBack)p=qzBack==='history'?'quizhistory':qzBack;appPage=p||'subjects';renderAppDemo()};
const __rad2=renderAppDemo;renderAppDemo=function(){__rad2.apply(this,arguments);if(mode!=='app'||BACKP[appPage]===undefined)return;const r=$('.rs');if(r&&!r.querySelector('.backb'))r.insertAdjacentHTML('afterbegin','<button type="button" class="backb" onclick="navBack()" aria-label="Go back">‹ Back</button>')};
setInterval(()=>{const d=dueList().length;if(d)addNotif('sr-'+dayKey(),'Smart Review due',`${d} question${d>1?'s are':' is'} ready to review.`,'review');updateBadges()},60000);
applySettings();
/* Doctor: 'explaining' appears only in the quiz-result item whose explanation is open (one at a time) */
document.addEventListener('toggle',function(e){const d=e.target;if(!d||!d.classList||!d.classList.contains('qzr'))return;
 document.querySelectorAll('.qzr .qfb img.drface').forEach(i=>i.remove());
 const open=[...document.querySelectorAll('details.qzr[open]')],rs=d.closest('.rs');
 if(rs)rs.classList.toggle('qzhide',open.length>0);
 const last=d.open?d:open[open.length-1];
 if(last){const f=last.querySelector('.qfb');if(f)f.insertAdjacentHTML('afterbegin',docFace('explaining','fl'))}
},true);
/* ===== HOME v7 ===== */
(function(){
const FK='shbace_daily_facts_v1';
const $e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ART={heart:'/assets/img/21eeeb5ae263.png',bulb:'/assets/img/bb481cab562d.png',ecg:'/assets/img/d33153f6f605.png'};
/* ---- facts: read-only. Edit the static DAILY_FACTS array (script#dailyFactsData) to add facts ---- */
function norm(o){
 if(typeof o==='string')o={text:o};
 if(!o||typeof o!=='object'||typeof o.text!=='string'||!o.text.trim())return null;
 const r={text:o.text.trim()};
 ['title','source','topic','category','pearl'].forEach(k=>{if(typeof o[k]==='string'&&o[k].trim())r[k]=o[k].trim()});
 if(Array.isArray(o.sources))r.sources=o.sources.filter(x=>x&&typeof x.url==='string'&&/^https:\/\//i.test(x.url)).map(x=>({label:String(x.label||'Reference'),url:x.url}));
 if(/^\d{4}-\d{2}-\d{2}$/.test(o.date||''))r.date=o.date;
 return r
}
const legacyFacts=(()=>{try{const v=JSON.parse(localStorage.getItem(FK)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}})();
const staticList=(typeof DAILY_FACTS!=='undefined'&&Array.isArray(DAILY_FACTS))?DAILY_FACTS:[];
const FACTS=(staticList.length?staticList:legacyFacts).map(norm).filter(Boolean);
function todayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function todayFacts(){
 if(!FACTS.length)return [];
 const pool=FACTS.filter(f=>!f.date).length?FACTS.filter(f=>!f.date):FACTS;
 let seed=2166136261;const key=todayKey();for(let i=0;i<key.length;i++){seed^=key.charCodeAt(i);seed=Math.imul(seed,16777619)}
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const a=pool.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
 const pair=a.slice(0,Math.min(2,a.length));
 const slot=new Date().getHours()>=12?1:0;
 return pair.length?[pair[Math.min(slot,pair.length-1)]]:[];
}
function scheduleDailyFactRefresh(){
 try{
  if(window.__shbaceDailyFactTimer)clearTimeout(window.__shbaceDailyFactTimer);
  const now=new Date(),next=new Date(now);
  if(now.getHours()<12)next.setHours(12,0,0,0);
  else{next.setDate(next.getDate()+1);next.setHours(0,0,0,0)}
  window.__shbaceDailyFactTimer=setTimeout(()=>{
   if(typeof mode!=='undefined'&&mode==='app'&&appPage==='subjects'&&typeof renderAppDemo==='function')renderAppDemo();
  },Math.max(500,next.getTime()-Date.now()+250));
 }catch(e){}
}
function todayFact(index=0){return todayFacts()[index]||null}
/* ---- icons ---- */
const IC={
play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5c-3.5-.4-6.5 0-8.5 1.5zM12 6.5v13"/></svg>',
cal:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" fill="#f4a51c"/><rect x="3" y="5" width="18" height="5" rx="2.5" fill="#d9780f"/><path d="M8 3v4M16 3v4" stroke="#ffd37a" stroke-width="2" stroke-linecap="round"/><rect x="6.5" y="12.5" width="3" height="2.6" rx=".6" fill="#fff3d0"/><rect x="10.5" y="12.5" width="3" height="2.6" rx=".6" fill="#fff3d0"/><rect x="14.5" y="12.5" width="3" height="2.6" rx=".6" fill="#fff3d0"/></svg>',
clock:'<svg class="h7-ci" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.5H8"/><path d="M12 7.5V12l3 2"/></svg>',
bk:'<svg class="h7-ri" viewBox="0 0 34 34"><defs><linearGradient id="h7a" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#58b8ff"/><stop offset="1" stop-color="#1b5fe0"/></linearGradient></defs><path d="M17 9c-2.6-2-6.4-2.5-11-2v18c4.6-.5 8.4 0 11 2 2.6-2 6.4-2.5 11-2V7c-4.600-.5-8.400 0-11 2z" fill="url(#h7a)" stroke="#bfe3ff" stroke-width="1.2" stroke-linejoin="round"/><path d="M17 9v18" stroke="#bfe3ff" stroke-width="1.2"/><path d="M8.500 12.500c2.200 0 4.200.3 6 1.200M8.500 17c2.200 0 4.200.3 6 1.200M19.500 13.700c1.800-.9 3.800-1.200 6-1.200M19.500 18.200c1.800-.9 3.800-1.200 6-1.200" stroke="#d9efff" stroke-width="1" stroke-linecap="round" fill="none"/></svg>',
tr:'<svg class="h7-ri" viewBox="0 0 34 34"><defs><linearGradient id="h7b" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#b78cff"/><stop offset="1" stop-color="#6a3de0"/></linearGradient></defs><path d="M10 5h14v8c0 4.200-3 7.500-7 7.500S10 17.200 10 13z" fill="url(#h7b)" stroke="#e3d2ff" stroke-width="1.2" stroke-linejoin="round"/><path d="M10 8H5.500c0 4 1.800 6.500 5 7M24 8h4.500c0 4-1.800 6.500-5 7" fill="none" stroke="#e3d2ff" stroke-width="1.5" stroke-linecap="round"/><path d="M17 20.500V25M12 28.500h10l-1.500-3.500h-7z" fill="#f4b73a" stroke="#ffd986" stroke-width="1" stroke-linejoin="round"/><circle cx="17" cy="12" r="2.800" fill="#ffd25a"/></svg>'};
function ago(t){const s=(Date.now()-t)/1000;if(s<90)return'Just now';const m=s/60;if(m<60)return Math.round(m)+' min ago';const h=m/60;if(h<24){const r=Math.round(h);return r+(r===1?' hour ago':' hours ago')}
 const dd=Math.floor(new Date().setHours(0,0,0,0)/864e5)-Math.floor(new Date(t).setHours(0,0,0,0)/864e5);if(dd<=1)return'Yesterday';if(dd<7)return dd+' days ago';return new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function activity(){
 const list=[];
 try{(REC||[]).filter(e=>e&&((e.k==='topic')||(e.k==='spec'))).slice(0,3).forEach(e=>{
  const sp=SPEC_NAME[e.spec]||e.spec||'Pediatrics';
  const nm=e.k==='spec'?'All topics':(e.topic===0?'All questions':(TOPIC_NAME[e.topic]||'Topic'));
  list.push({t:e.t||Date.now(),k:e.k,spec:e.spec,topic:Number(e.topic)||0,txt:e.k==='topic'&&e.topic?sp+' • '+nm:(e.k==='spec'?sp+' • '+nm:nm),ic:IC.bk});
 })}catch(e){}
 return list;
}
function greet(){const h=new Date().getHours();return h<12?'Good Morning':h<18?'Good Afternoon':'Good Evening'}
/* ---- Home view ---- */
const legacy=window.subjectsView||subjectsView;
window.measureDailyFactOverflow=measureDailyFactOverflow;
function measureDailyFactOverflow(){
 try{
  document.querySelectorAll('.h7-daily-item').forEach(item=>{
   const text=item.querySelector('.h7-daily-text'),btn=item.querySelector('.h7-readmore'),links=item.querySelector('.h7-daily-sources');
   if(!text||!btn||!links)return;
   const expanded=item.classList.contains('expanded');
   btn.hidden=false;
   text.classList.toggle('collapsed',!expanded);
   links.hidden=!expanded;
   btn.setAttribute('aria-expanded',expanded?'true':'false');
   btn.innerHTML=expanded?'Read Less':'Read More'+IC.chev;
  });
 }catch(e){}
}
const home=function(){
 const hasPed=gradeHasPediatrics()&&!!(QB&&QB.length);
 let n=0,all=0,last=null,lastTxt='Not started yet';
 try{n=answeredCount(QB);all=pct(n,QB.length)}catch(e){}
 try{last=(REC||[]).find(e=>e&&e.k==='topic'&&e.topic);if(last)lastTxt='Last Topic: '+(TOPIC_NAME[last.topic]||'Topic')}catch(e){}
 try{const saved=JSON.parse(localStorage.getItem('shbace_home_pediatrics_resume_v1')||'null');if(saved&&saved.spec&&saved.topic&&REAL.spec[saved.spec]){const nm=TOPIC_NAME[saved.topic]||'Topic';lastTxt='Last Topic: '+nm}}catch(e){}
 scheduleDailyFactRefresh();
 const daily=todayFacts(),act=activity();
 const d=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
 const f=daily[0]||null;
 const dailyMarkup=f?(()=>{
  const links=(f.sources||[]).map(x=>`<a class="h7-fact-source" href="${$e(x.url)}" target="_blank" rel="noopener noreferrer">${$e(x.label)} ↗</a>`).join('');
  return `<article class="h7-daily-item">
   <h3 class="h7-daily-headline">${$e(f.pearl||'')}</h3>
   <p class="h7-daily-text collapsed" dir="auto">${$e(f.text)}</p>
   <button type="button" class="h7-chipbtn h7-readmore" aria-expanded="false" onclick="h7ToggleFact(this)">Read More${IC.chev}</button>
   <div class="h7-daily-sources" hidden>${links}</div>
  </article>`;
 })():'<p class="h7-empty">No verified daily medical fact is available for this time period.</p>';
 return `${appHeader('Home')}<div class="rs h7" data-grade="${GRADE_ID[obGradeNow()||5]}">
 <div class="h7-greet"><h1>${greet()} <span class="h7-wv" aria-hidden="true">👋</span></h1><p>Keep going towards your goal!</p></div>
 ${hasPed?`<section class="h7-card h7-cont" aria-label="Pediatrics study progress">
  <img class="h7-ph" alt="" src="${PEDIA_HERO_SRC}">
  <div class="h7-in">
   <button type="button" class="h7-pill" onclick="h7ResumePediatrics()">${IC.play}Continue Studying</button>
   <h2>Pediatrics</h2>
   <div class="h7-last">${IC.book}<span>${$e(lastTxt)}</span></div>
   <div class="h7-prog"><div class="h7-bar"><i style="width:${all}%"></i></div><b class="h7-pct">${all}%</b></div>
   <button type="button" class="h7-go" onclick="h7StartPediatrics()"><svg class="h7-start-star" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8z"/></svg>Start Studying${IC.chev}</button>
  </div>
 </section>
 <section class="h7-card h7-fact" aria-label="Daily Medical Facts">
  <div class="h7-bulb-wrap"><img class="h7-bulb" alt="Medical stethoscope, ECG heart and glowing lightbulb artwork" src="${ART.bulb}" loading="eager"></div>
  <div class="h7-ft">
   <div class="h7-fhead"><span class="h7-date">${IC.cal}${d}</span></div>
   <div class="h7-facts">${dailyMarkup}</div>
  </div>
 </section>
 <section class="h7-card h7-recent" aria-label="Recent Activity">
  <div class="h7-rh">${IC.clock}<h3>Recent Activity</h3><button type="button" class="h7-chipbtn" style="align-self:center;margin:0" onclick="h7RecentSheet()">View All${IC.chev}</button></div>
  ${act.length?act.map(a=>`<button type="button" class="h7-row" onclick="h7OpenRecent('${a.k}','${$e(a.spec)}',${a.topic})">${a.ic}<span class="h7-rt">${$e(a.txt)}</span><span class="h7-rw">${ago(a.t)}</span><span class="h7-rc">${IC.chev}</span></button>`).join(''):'<p class="h7-none">Topics you study will appear here. Pinned topics remain in Pinned Items.</p>'}
 </section>`:''}</div>`};
window.__legacySubjectsView=legacy;
subjectsView=home;
/* ---- read-only details sheet ---- */
function closeSheet(){const s=document.querySelector('.h7-sheet');s&&s.remove()}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
window.h7Close=closeSheet;
window.h7ToggleFact=function(btn){
 const item=btn&&btn.closest('.h7-daily-item');if(!item)return;
 const text=item.querySelector('.h7-daily-text'),links=item.querySelector('.h7-daily-sources');
 if(!text||!links)return;
 const expanded=item.classList.toggle('expanded');
 text.classList.toggle('collapsed',!expanded);
 links.hidden=!expanded;
 btn.setAttribute('aria-expanded',expanded?'true':'false');
 btn.innerHTML=expanded?'Read Less':'Read More'+IC.chev;
};
window.h7Sheet=function(index=0,override){
 const f=override||todayFact(Number(index)||0),ph=document.querySelector('.phone');if(!f||!ph)return;closeSheet();
 const s=document.createElement('div');s.className='h7-sheet';s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-label','Daily Medical Fact details');
 const sourceHtml=(f.sources||[]).map(x=>`<a class="h7-detail-source" href="${$e(x.url)}" target="_blank" rel="noopener noreferrer">${$e(x.label)} ↗</a>`).join('');
 s.innerHTML=`<div class="h7-pane"><div class="h7-ph2"><h3>${$e(f.pearl||'')}</h3><button class="h7-x" aria-label="Close" onclick="h7Close()">✕</button></div>
 <h4 class="h7-detail-title" dir="auto">${$e(f.pearl||'')}</h4>
 <div class="h7-ftxt" dir="auto">${$e(f.text)}</div>
 
 ${sourceHtml?`<div class="h7-detail-sources"><b>References</b>${sourceHtml}</div>`:''}
 </div>`;
 s.addEventListener('click',e=>{if(e.target===s)closeSheet()});ph.appendChild(s);const x=s.querySelector('.h7-x');x&&x.focus();
};
window.h7RecentSheet=function(){
 const ph=document.querySelector('.phone');if(!ph)return;closeSheet();
 let rows=[];try{rows=(REC||[]).filter(e=>e&&((e.k==='topic')||(e.k==='spec'))).sort((a,b)=>(b.t||0)-(a.t||0))}catch(e){}
 const s=document.createElement('div');s.className='h7-sheet h7-recent-sheet';s.setAttribute('role','dialog');s.setAttribute('aria-modal','true');s.setAttribute('aria-label','Recent Activity');
 const content=rows.length?rows.map(e=>{
  const spec=String(e.spec||'');const topic=Number(e.topic)||0;const sp=SPEC_NAME[spec]||spec||'Pediatrics';const nm=e.k==='spec'?'All topics':(topic===0?'All questions':(TOPIC_NAME[topic]||'Topic'));
  return `<button type="button" class="h7-recent-entry" onclick="h7OpenRecent('${e.k}','${$e(spec)}',${topic})"><span class="h7-recent-icon">${IC.bk}</span><span class="h7-recent-label"><b>${$e(sp)}</b><small>${$e(nm)}</small></span><span class="h7-recent-time">${$e(ago(e.t||Date.now()))}</span><span class="h7-recent-arrow">${IC.chev}</span></button>`;
 }).join(''):'<div class="h7-recent-empty">No recent study topics yet. Topics you open will appear here. Your Pinned Items are kept separately.</div>';
 s.innerHTML=`<div class="h7-pane h7-recent-pane"><div class="h7-ph2"><h3>Recent Activity</h3><button class="h7-x" aria-label="Close" onclick="h7Close()">✕</button></div><p class="h7-recent-intro">Your recently opened study topics, newest first.</p><div class="h7-recent-list">${content}</div></div>`;
 s.addEventListener('click',e=>{if(e.target===s)closeSheet()});ph.appendChild(s);const x=s.querySelector('.h7-x');x&&x.focus();
};
window.h7OpenRecent=function(kind,spec,topic){
 closeSheet();if(!spec)return;
 if(kind==='spec'&&typeof window.openSpec==='function')window.openSpec(spec);
 else if(typeof window.openTopic==='function')window.openTopic(spec,Number(topic)||0);
};
/* ===== v46 · Grade data scope =====
   Everything that is derived from the Pediatrics bank (questions, specialties, topics, tags, search index, Smart Review pools,
   Saved / Wrong / Notes / Pinned / Recent lists, statistics) is read through these shared structures. For a grade that has no content
   they are emptied (hidden, never deleted: the originals are kept and put back when a grade with content is selected again).
   User data (answers, saved, notes, Smart Review, quiz history) is never touched. */
(function(){
 let applied=null,keep=null;
 const has=(n)=>{try{return typeof eval(n)!=='undefined'}catch(e){return false}};
 window.gradeSync=function(){
  let want;try{want=!!gradeHasPediatrics()}catch(e){return}
  if(want===applied)return;
  try{
   if(!want){
    if(!keep){keep={qb:QB.slice(),qby:Array.from(QBY.entries()),spec:REAL.spec,total:REAL.total,
     tags:(has('FULL_TAGS')?FULL_TAGS.slice():null),
     qmap:(has('qmap')?Array.from(qmap.entries()):null),
     srt:(has('SRT')?SRT.slice():null),srtBy:(has('SRT_BY')?Array.from(SRT_BY.entries()):null),srtQ:(has('SRT_Q')?Array.from(SRT_Q.entries()).map(([k,a])=>[k,a.slice()]):null)}}
    QB.length=0;QBY.clear();REAL.spec={};REAL.total=0;
    if(keep.tags)FULL_TAGS.length=0;
    if(keep.qmap)qmap.clear();
    if(keep.srt){SRT.length=0;SRT_BY.clear();SRT_Q.forEach(a=>{a.length=0})}
   }else if(keep){
    QB.length=0;keep.qb.forEach(q=>QB.push(q));QBY.clear();keep.qby.forEach(([k,v])=>QBY.set(k,v));REAL.spec=keep.spec;REAL.total=keep.total;
    if(keep.tags){FULL_TAGS.length=0;keep.tags.forEach(t=>FULL_TAGS.push(t))}
    if(keep.qmap){qmap.clear();keep.qmap.forEach(([k,v])=>qmap.set(k,v))}
    if(keep.srt){SRT.length=0;keep.srt.forEach(t=>SRT.push(t));SRT_BY.clear();keep.srtBy.forEach(([k,v])=>SRT_BY.set(k,v));keep.srtQ.forEach(([k,a])=>{const t=SRT_Q.get(k);if(t){t.length=0;a.forEach(q=>t.push(q))}})}
   }
   try{if(typeof gIdx!=='undefined')gIdx=null}catch(e){}
   try{if(typeof srCache!=='undefined')srCache=null}catch(e){}
   applied=want;
  }catch(e){console.error('gradeSync',e)}
 };
})();
})();

/* ===== SHARED APP SHELL: header (fixed) / .app-scroll (only scroller) / .app-nav (fixed, one component) ===== */
const __rShell=renderAppDemo;
renderAppDemo=function(){__rShell.apply(this,arguments);
 try{if(mode!=='app')return;const sc=phoneContent.querySelector(':scope>.screen'),nav=sc&&sc.querySelector(':scope>.app-nav');if(!sc||!nav)return;
  if(!sc.querySelector(':scope>.app-scroll')){const hd=sc.querySelector(':scope>.phone-appbar'),w=document.createElement('div');w.className='app-scroll';
   let n=hd?hd.nextSibling:sc.firstChild;while(n&&n!==nav){const x=n.nextSibling;w.appendChild(n);n=x}sc.insertBefore(w,nav)}
  sc.classList.add('app-shell')}catch(e){console.error(e)}};
/* ===== PEDIATRICS SPECIALTIES — premium styling hook (markup classes only; data/order/handlers untouched) ===== */
const __spv=specialtiesView;
specialtiesView=function(){return __spv.apply(this,arguments).replace('<div class="rs">','<div class="rs sp7">').replace(/<div class="meta">(\d+) questions · (\d+) topics<\/div>/g,'<div class="meta"><b>$1</b> questions<i aria-hidden="true">·</i><b>$2</b> topics</div>')};
/* re-render the current screen with the new functions */
try{if(!splashHolding()){if(mode==='preview')renderSlide();else if(mode==='app')renderAppDemo()}}catch(e){console.error(e)}

/* Measure the daily fact's true rendered line count after each screen render. */
const __h7MeasureRender=renderAppDemo;
renderAppDemo=function(){const r=__h7MeasureRender.apply(this,arguments);try{if(typeof appPage!=='undefined'&&appPage==='subjects'&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(measureDailyFactOverflow));}catch(e){}return r};

/* ===== FONT SIZE: scale the scrollable page content only, never the app frame/bars ===== */
function applyAppFontScaleStage(){
 try{
  const screen=phoneContent&&phoneContent.querySelector(':scope>.screen.app-shell');
  const sc=screen&&screen.querySelector(':scope>.app-scroll');
  if(!sc)return;
  let stage=sc.querySelector(':scope>.app-scale-stage');
  if(!stage){
   stage=document.createElement('div');stage.className='app-scale-stage';
   while(sc.firstChild)stage.appendChild(sc.firstChild);
   sc.appendChild(stage);
  }
 }catch(e){console.warn('App font-size layout stage:',e)}
}
const __fontScaleRender=renderAppDemo;
renderAppDemo=function(){const result=__fontScaleRender.apply(this,arguments);applyAppFontScaleStage();return result};
/* Apply once if an app screen was already mounted before this hook was registered. */
applyAppFontScaleStage();

/* =====================================================================
   SHBACE_STUDENT_MODULES_V2
   Unit 7 — Saved Questions / Wrong Answers / Pinned & Recent
   Unit 8 — My Notes (legacy-compatible, question-linked)
   Unit 10 — In-app Notifications & preferences (real event sources only)
   Unit 11 — Full local-data Backup / Merge / Replace / Restore
   ===================================================================== */
(function installStudentModulesV2(){
'use strict';
const U7_SAVED_META_KEY='shbace_saved_meta_v1';
const U7_WRONG_KEY='shbace_qb_wrong_v1';
const U8_NOTE_META_KEY='shbace_note_meta_v2';
const U10_PREF_KEY='shbace_notif_prefs_v1';
const U11_VERSION=2;
const u7LoadObj=(k,d={})=>{const x=LS.get(k,d);return x&&typeof x==='object'&&!Array.isArray(x)?x:d};
const u7SaveObj=(k,v)=>LS.set(k,v);
let U7_SAVED_META=u7LoadObj(U7_SAVED_META_KEY,{});
let U7_WRONG=u7LoadObj(U7_WRONG_KEY,{});
let U8_NOTE_META=u7LoadObj(U8_NOTE_META_KEY,{});
let U10_PREFS=Object.assign({review:true,quiz:true,reminders:true,updates:true},u7LoadObj(U10_PREF_KEY,{}));
Object.keys(U10_PREFS).forEach(k=>U10_PREFS[k]=U10_PREFS[k]!==false);
const u7Selected={saved:new Set(),wrong:new Set(),pins:new Set(),recent:new Set()};
const u7State={
 saved:{search:'',spec:'all',topic:'all',source:'all',sort:'new'},
 wrong:{search:'',spec:'all',topic:'all',source:'all',sort:'new'},
 notes:{search:'',spec:'all',topic:'all',source:'all',sort:'updated'},
 pinTab:'pins',pinSearch:'',pinSpec:'all',recentSearch:'',recentSpec:'all'
};
const u10State={filter:'all',sort:'new',prefsOpen:false};
const u7Q=id=>QBY.get(String(id))||QB.find(q=>String(q.id)===String(id))||null;
const u7Spec=q=>q?(SPEC_NAME[q.spec]||REAL.spec[q.spec]?.label||q.spec):'';
const u7Topic=q=>q?(TOPIC_NAME[q.topic]||'Topic'):'';
const u7Source=q=>q?(q.tag||q.src||'Question Bank'):'Question Bank';
const u7Text=q=>q?[q.id,q.q,(q.o||[]).join(' '),q.ex,q.src,q.tag,u7Spec(q),u7Topic(q)].join(' ').toLowerCase():'';
const u7Option=(v,label,cur)=>`<option value="${esc(String(v))}"${String(v)===String(cur)?' selected':''}>${esc(label)}</option>`;
const u7Specs=()=>[...new Set(QB.map(q=>q.spec))].sort((a,b)=>u7Spec({spec:a}).localeCompare(u7Spec({spec:b})));
const u7Topics=(spec)=>[...new Map(QB.filter(q=>spec==='all'||q.spec===spec).map(q=>[String(q.topic),u7Topic(q)])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
const u7Sources=(spec)=>[...new Set(QB.filter(q=>spec==='all'||q.spec===spec).map(u7Source))].sort();
const u7EnsureLegacyWrong=()=>{
 let dirty=false;
 Object.entries(S.ans||{}).forEach(([id,a])=>{
  if(a&&a.ok===false&&u7Q(id)&&!U7_WRONG[id]){U7_WRONG[id]={count:1,firstAt:Number(a.t)||0,lastAt:Number(a.t)||0,attempts:[Number(a.t)||0],hidden:false};dirty=true}
 });
 if(dirty)u7SaveObj(U7_WRONG_KEY,U7_WRONG);
};
u7EnsureLegacyWrong();

/* Preserve the existing stores; timestamp metadata is kept separately so legacy
   saved records and notes remain readable by their original code paths. */
const u7OriginalSave=window.qSave;
if(typeof u7OriginalSave==='function')window.qSave=function(id){
 const had=!!S.saved[id];u7OriginalSave.apply(this,arguments);
 if(!had&&S.saved[id]){U7_SAVED_META[id]={savedAt:Date.now()};u7SaveObj(U7_SAVED_META_KEY,U7_SAVED_META)}
 if(had&&!S.saved[id]){delete U7_SAVED_META[id];u7SaveObj(U7_SAVED_META_KEY,U7_SAVED_META)}
};
const u7OriginalAnswer=window.qAnswer;
if(typeof u7OriginalAnswer==='function')window.qAnswer=function(id,choice){
 const existed=!!S.ans[id];u7OriginalAnswer.apply(this,arguments);
 const a=S.ans[id];
 if(!existed&&a&&a.ok===false&&u7Q(id)){
  const old=U7_WRONG[id]||{count:0,firstAt:0,lastAt:0,attempts:[],hidden:false};
  const t=Number(a.t)||Date.now();old.count=(Number(old.count)||0)+1;old.firstAt=old.firstAt||t;old.lastAt=t;
  old.attempts=Array.isArray(old.attempts)?old.attempts:[];old.attempts.push(t);old.attempts=old.attempts.slice(-100);old.hidden=false;U7_WRONG[id]=old;u7SaveObj(U7_WRONG_KEY,U7_WRONG);
 }
};
const u7OriginalNoteSave=window.qNoteSave;
if(typeof u7OriginalNoteSave==='function')window.qNoteSave=function(id,value){
 const text=String(value==null?'':value);u7OriginalNoteSave.apply(this,[id,text]);
 const q=u7Q(id),old=U8_NOTE_META[id]||{};
 if(text.trim()){
  U8_NOTE_META[id]={qid:String(id),spec:q?q.spec:(old.spec||''),topic:q?q.topic:(old.topic||0),source:q?u7Source(q):(old.source||''),createdAt:Number(old.createdAt)||Date.now(),updatedAt:Date.now()};
 }else delete U8_NOTE_META[id];
 u7SaveObj(U8_NOTE_META_KEY,U8_NOTE_META);
};
/* Backfill metadata without changing the legacy S.notes map or any note text. */
Object.entries(S.notes||{}).forEach(([id,text])=>{
 if(typeof text!=='string'||!text.trim()||U8_NOTE_META[id])return;
 const q=u7Q(id);U8_NOTE_META[id]={qid:id,spec:q?q.spec:'',topic:q?q.topic:0,source:q?u7Source(q):'',createdAt:0,updatedAt:0,legacy:true};
});
u7SaveObj(U8_NOTE_META_KEY,U8_NOTE_META);

function u7FiltersHtml(kind){
 const st=u7State[kind],systems=u7Specs(),topics=u7Topics(st.spec),sources=u7Sources(st.spec);
 return `<div class="u7-filters"><input class="field" type="search" id="u7-${kind}-search" placeholder="Search question, ID, explanation…" value="${esc(st.search)}" oninput="u7SetFilter('${kind}','search',this.value)">
 <select class="field" aria-label="Specialty" onchange="u7SetFilter('${kind}','spec',this.value)">${u7Option('all','All specialties',st.spec)}${systems.map(x=>u7Option(x,u7Spec({spec:x}),st.spec)).join('')}</select>
 <select class="field" aria-label="Topic" onchange="u7SetFilter('${kind}','topic',this.value)">${u7Option('all','All topics',st.topic)}${topics.map(([id,n])=>u7Option(id,n,st.topic)).join('')}</select>
 <select class="field" aria-label="Source" onchange="u7SetFilter('${kind}','source',this.value)">${u7Option('all','All sources',st.source)}${sources.map(x=>u7Option(x,x,st.source)).join('')}</select>
 <select class="field" aria-label="Sort" onchange="u7SetFilter('${kind}','sort',this.value)">${u7Option('new','Newest first',st.sort)}${u7Option('old','Oldest first',st.sort)}${u7Option('az','A–Z',st.sort)}</select></div>`;
}
function u7Toolbar(kind,count){
 const selected=u7Selected[kind].size;
 return `<div class="u7-toolbar"><span class="meta">${count} item${count===1?'':'s'} · ${selected} selected</span><div class="u7-actions"><button type="button" class="btn" onclick="u7SelectAll('${kind}')">${selected===count&&count?'Clear selection':'Select all'}</button><button type="button" class="btn danger" ${selected?'':'disabled'} onclick="u7BulkDelete('${kind}')">Delete selected</button></div></div>`;
}
function u7GetQuestionItems(kind){
 let ids=[];
 if(kind==='saved')ids=Object.keys(S.saved||{}).filter(id=>S.saved[id]&&u7Q(id));
 else ids=Object.keys(U7_WRONG).filter(id=>U7_WRONG[id]&&!U7_WRONG[id].hidden&&u7Q(id));
 let rows=ids.map(id=>({id,q:u7Q(id)})).filter(x=>x.q);
 const st=u7State[kind];
 rows=rows.filter(({q})=>(st.spec==='all'||q.spec===st.spec)&&(st.topic==='all'||String(q.topic)===String(st.topic))&&(st.source==='all'||u7Source(q)===st.source)&&(!st.search||u7Text(q).includes(st.search.toLowerCase())));
 rows.sort((a,b)=>{
  if(st.sort==='az')return a.q.q.localeCompare(b.q.q);
  const ta=kind==='saved'?(Number(U7_SAVED_META[a.id]?.savedAt)||0):(Number(U7_WRONG[a.id]?.lastAt)||Number(S.ans[a.id]?.t)||0);
  const tb=kind==='saved'?(Number(U7_SAVED_META[b.id]?.savedAt)||0):(Number(U7_WRONG[b.id]?.lastAt)||Number(S.ans[b.id]?.t)||0);
  return st.sort==='old'?ta-tb:tb-ta;
 });
 return rows;
}
function u7QuestionRows(kind){
 const rows=u7GetQuestionItems(kind),sel=u7Selected[kind];
 if(!rows.length)return `<div class="card setcard u7-empty"><h3>${kind==='saved'?'No saved questions':'No Question Bank mistakes recorded'}</h3><p class="meta">${kind==='saved'?'Use Save on any Question Bank item to add it here.':'Only answers submitted in Question Bank appear here. Quiz answers remain in Quiz History.'}</p>${kind==='saved'?'<button type="button" class="btn block" onclick="appPage=\'subjects\';renderAppDemo()">Browse specialties</button>':'<button type="button" class="btn block" onclick="appPage=\'questions\';renderAppDemo()">Open Question Bank</button>'}</div>`;
 return rows.map(({id,q})=>{
  const chosen=sel.has(id),meta=kind==='wrong'?U7_WRONG[id]||{}:U7_SAVED_META[id]||{};
  const detail=kind==='wrong'?`${Number(meta.count)||1} wrong attempt${(Number(meta.count)||1)===1?'':'s'} · last ${meta.lastAt?fmtDT(meta.lastAt):'date not recorded'}`:`Saved ${meta.savedAt?fmtDT(meta.savedAt):'before saved-date tracking'}`;
  const stem=String(q.q||'').replace(/\s+/g,' ').slice(0,260);
  return `<article class="u7-qrow"><label class="u7-check"><input type="checkbox" ${chosen?'checked':''} onchange="u7Select('${kind}','${esc(id)}',this.checked)" aria-label="Select ${esc(id)}"></label><div class="u7-qmain"><div class="u7-qid">${esc(id)} · ${esc(u7Source(q))}</div><b>${esc(u7Spec(q))}</b><div class="u7-qtopic">${esc(u7Topic(q))}</div><p>${esc(stem)}${String(q.q||'').length>260?'…':''}</p><small>${esc(detail)}</small></div><div class="u7-qbtns"><button type="button" class="btn primary" onclick="openQ('${esc(id)}')">Open question</button>${kind==='wrong'?`<button type="button" class="btn" onclick="u7RetryWrong('${esc(id)}')">Retry answer</button>`:`<button type="button" class="btn danger" onclick="u7DeleteSaved('${esc(id)}')">Remove saved</button>`}</div></article>`;
 }).join('');
}
function u7QuestionPage(kind){
 const title=kind==='saved'?'Saved Questions':'Wrong Answers';
 const count=u7GetQuestionItems(kind).length;
 return `${appHeader(title)}<div class="rs u7-page"><div class="u7-title"><div><h1>${title}</h1><p class="sub">${kind==='saved'?'Your own saved Question Bank items. Removing one here never deletes the original question.':'Question Bank mistakes only. Quiz results and wrong answers remain in Quiz History.'}</p></div><span class="u7-count">${count}</span></div>${u7FiltersHtml(kind)}<div id="u7-${kind}-results">${u7Toolbar(kind,count)}<div class="u7-qrows">${u7QuestionRows(kind)}</div></div></div>`;
}
window.u7SetFilter=function(kind,key,value){if(!u7State[kind])return;u7State[kind][key]=String(value);if(key==='spec'){u7State[kind].topic='all';u7State[kind].source='all'}const box=document.getElementById(`u7-${kind}-results`);if(box){const count=u7GetQuestionItems(kind).length;box.innerHTML=u7Toolbar(kind,count)+`<div class="u7-qrows">${u7QuestionRows(kind)}</div>`}};
window.u7Select=function(kind,id,yes){if(!u7Selected[kind])return;yes?u7Selected[kind].add(id):u7Selected[kind].delete(id);const box=document.getElementById(`u7-${kind}-results`);if(box){const count=u7GetQuestionItems(kind).length;box.innerHTML=u7Toolbar(kind,count)+`<div class="u7-qrows">${u7QuestionRows(kind)}</div>`}};
window.u7SelectAll=function(kind){const rows=u7GetQuestionItems(kind);const set=u7Selected[kind];if(set.size===rows.length&&rows.length)set.clear();else{set.clear();rows.forEach(x=>set.add(x.id))}const box=document.getElementById(`u7-${kind}-results`);if(box){const count=rows.length;box.innerHTML=u7Toolbar(kind,count)+`<div class="u7-qrows">${u7QuestionRows(kind)}</div>`}};
window.u7DeleteSaved=function(id){if(!S.saved[id])return;confirmBox({title:'Remove saved question?',text:`Remove ${id} from Saved Questions?`,detail:'The original question in Question Bank will remain untouched.',ok:'Remove',danger:true},()=>{delete S.saved[id];delete U7_SAVED_META[id];save();u7SaveObj(U7_SAVED_META_KEY,U7_SAVED_META);u7Selected.saved.delete(id);renderAppDemo()})};
window.u7RetryWrong=function(id){const q=u7Q(id);if(!q)return;delete S.ans[id];save();openQ(id)};
window.u7BulkDelete=function(kind){const ids=[...u7Selected[kind]];if(!ids.length)return;confirmBox({title:kind==='saved'?'Delete saved selections?':'Remove wrong-answer records?',text:`Apply this action to ${ids.length} selected item${ids.length===1?'':'s'}?`,detail:kind==='saved'?'Only Saved Questions bookmarks are removed. Question Bank records remain.':'Only the Wrong Answers collection is hidden. Question Bank items and Quiz History are not deleted.',ok:'Confirm',danger:true},()=>{
  if(kind==='saved'){ids.forEach(id=>{delete S.saved[id];delete U7_SAVED_META[id]});save();u7SaveObj(U7_SAVED_META_KEY,U7_SAVED_META)}
  else{ids.forEach(id=>{if(U7_WRONG[id]){U7_WRONG[id].hidden=true;U7_WRONG[id].hiddenAt=Date.now()}});u7SaveObj(U7_WRONG_KEY,U7_WRONG)}
  u7Selected[kind].clear();renderAppDemo();
 })};

/* Unit 8: legacy notes remain in S.notes as their original questionId -> string map.
   The metadata sidecar adds timestamps/system/topic/source without rewriting old note text. */
function u8Notes(){
 const rows=Object.entries(S.notes||{}).filter(([id,text])=>typeof text==='string'&&text.trim()&&u7Q(id)).map(([id,text])=>{const q=u7Q(id),m=U8_NOTE_META[id]||{};return{id,text,q,meta:m}});
 const st=u7State.notes;
 return rows.filter(x=>(st.spec==='all'||x.q.spec===st.spec)&&(st.topic==='all'||String(x.q.topic)===String(st.topic))&&(st.source==='all'||u7Source(x.q)===st.source)&&(!st.search||(x.text+' '+x.id+' '+x.q.q+' '+u7Spec(x.q)+' '+u7Topic(x.q)+' '+u7Source(x.q)).toLowerCase().includes(st.search.toLowerCase()))).sort((a,b)=>{
  const ta=Number(st.sort==='added'?a.meta.createdAt:a.meta.updatedAt)||0,tb=Number(st.sort==='added'?b.meta.createdAt:b.meta.updatedAt)||0;return tb-ta;
 });
}
function u8NoteRows(){const rows=u8Notes();if(!rows.length)return `<div class="card setcard u7-empty"><h3>No notes found</h3><p class="meta">Existing question notes stay here. Open any Question Bank item and choose Personal note to add one. Old notes are preserved even when their original date metadata was unavailable.</p><button type="button" class="btn block" onclick="appPage='questions';renderAppDemo()">Open Question Bank</button></div>`;
 return rows.map(({id,text,q,meta})=>`<article class="u8-note"><div class="u8-note-head"><div><b>${esc(id)}</b><span>${esc(u7Spec(q))} · ${esc(u7Topic(q))}</span><small>Source: ${esc(u7Source(q))} · ${meta.updatedAt?`Updated ${fmtDT(meta.updatedAt)}`:'Legacy date not recorded'}</small></div><button type="button" class="btn primary" onclick="openQ('${esc(id)}')">Open question</button></div><textarea class="field u8-note-text" aria-label="Edit note ${esc(id)}" oninput="qNoteSave('${esc(id)}',this.value)">${esc(text)}</textarea><div class="u8-note-actions"><small>Auto-saved on this device</small><button type="button" class="btn danger" onclick="u8DeleteNote('${esc(id)}')">Delete note</button></div></article>`).join('')}
function myNotesView(){
 const systems=u7Specs(),st=u7State.notes,topics=u7Topics(st.spec),sources=u7Sources(st.spec),n=u8Notes().length;
 const qcount=QB.length;
 return `${appHeader('My Notes')}<div class="rs u7-page"><div class="u7-title"><div><h1>My Notes</h1><p class="sub">Notes stay attached to their original Question Bank question.</p></div><span class="u7-count">${n}</span></div>
 <div class="u7-add-note"><h3>Add a note from a question</h3><input class="field" id="u8-add-search" type="search" placeholder="Search question ID or text…" oninput="u8SearchQuestions(this.value)"><div id="u8-question-matches" class="u8-question-matches"><small class="meta">Search the Question Bank to open an item and write a linked note.</small></div><small class="meta">${qcount} original questions available · notes are not converted into Saved Questions.</small></div>
 <div class="u7-filters"><input class="field" type="search" placeholder="Search note text…" value="${esc(st.search)}" oninput="u7SetFilter('notes','search',this.value)"><select class="field" onchange="u7SetFilter('notes','spec',this.value)">${u7Option('all','All specialties',st.spec)}${systems.map(x=>u7Option(x,u7Spec({spec:x}),st.spec)).join('')}</select><select class="field" onchange="u7SetFilter('notes','topic',this.value)">${u7Option('all','All topics',st.topic)}${topics.map(([id,nm])=>u7Option(id,nm,st.topic)).join('')}</select><select class="field" onchange="u7SetFilter('notes','source',this.value)">${u7Option('all','All sources',st.source)}${sources.map(x=>u7Option(x,x,st.source)).join('')}</select><select class="field" onchange="u7SetFilter('notes','sort',this.value)">${u7Option('updated','Last modified',st.sort)}${u7Option('added','Date added',st.sort)}</select></div>
 <div id="u8-note-results">${u8NoteRows()}</div></div>`;
}
window.u8SearchQuestions=function(value){const box=document.getElementById('u8-question-matches');if(!box)return;const s=String(value||'').trim().toLowerCase();if(s.length<2){box.innerHTML='<small class="meta">Type at least 2 characters to find a Question Bank item.</small>';return}const rows=QB.filter(q=>u7Text(q).includes(s)).slice(0,8);box.innerHTML=rows.length?rows.map(q=>`<div class="u8-match"><div><b>${esc(q.id)}</b><small>${esc(u7Spec(q))} · ${esc(u7Topic(q))}</small><span>${esc(String(q.q).slice(0,120))}</span></div><button type="button" class="btn primary" onclick="u8OpenQuestion('${esc(q.id)}')">Add / edit note</button></div>`).join(''):'<small class="meta">No matching Question Bank question.</small>'};
window.u8OpenQuestion=function(id){const q=u7Q(id);if(!q)return;openQ(id);setTimeout(()=>{const card=document.getElementById('qc-'+id);if(card){if(!S.notes[id]&&!qs.noteOpen[id])qNote(id);card.scrollIntoView({block:'start',behavior:'smooth'})}},140)};
window.u8DeleteNote=function(id){if(typeof S.notes[id]!=='string')return;confirmBox({title:'Delete this note?',text:`Delete the note linked to ${id}?`,detail:'The original Question Bank question is not affected. This action cannot be undone.',ok:'Delete note',danger:true},()=>{delete S.notes[id];delete U8_NOTE_META[id];save();u7SaveObj(U8_NOTE_META_KEY,U8_NOTE_META);renderAppDemo()})};
window.u8BulkDeleteNotes=function(ids){ids=Array.isArray(ids)?ids:[];if(!ids.length)return;confirmBox({title:'Delete selected notes?',text:`Delete ${ids.length} selected note${ids.length===1?'':'s'}?`,detail:'Original Question Bank questions remain unchanged.',ok:'Delete notes',danger:true},()=>{ids.forEach(id=>{delete S.notes[id];delete U8_NOTE_META[id]});save();u7SaveObj(U8_NOTE_META_KEY,U8_NOTE_META);renderAppDemo()})};
window.u7SetFilter=function(kind,key,value){if(!u7State[kind])return;u7State[kind][key]=String(value);if(key==='spec'){u7State[kind].topic='all';u7State[kind].source='all'}const box=document.getElementById(kind==='notes'?'u8-note-results':`u7-${kind}-results`);if(box){if(kind==='notes')box.innerHTML=u8NoteRows();else{const count=u7GetQuestionItems(kind).length;box.innerHTML=u7Toolbar(kind,count)+`<div class="u7-qrows">${u7QuestionRows(kind)}</div>`}}};

/* Unit 7: separate Pinned and Recent collections backed by the original PKEY/RKEY stores. */
function u7PinKey(e){return `${e.k}:${e.spec}:${e.topic}`}
function u7PinRows(kind){const list=kind==='pins'?(PINS||[]):(REC||[]);const q=u7State;const search=(kind==='pins'?q.pinSearch:q.recentSearch).toLowerCase();const spec=kind==='pins'?q.pinSpec:q.recentSpec;return list.filter(e=>{
 const sp=SPEC_NAME[e.spec]||e.spec;const topic=e.k==='spec'?'All topics':(e.topic===0?'All questions':TOPIC_NAME[e.topic]||'Topic');return (spec==='all'||e.spec===spec)&&(!search||(sp+' '+topic).toLowerCase().includes(search));
 }).sort((a,b)=>(b.t||0)-(a.t||0));}
function u7PinMarkup(kind){const rows=u7PinRows(kind),sel=u7Selected[kind];if(!rows.length)return `<div class="card setcard u7-empty"><h3>${kind==='pins'?'No pinned items':'No recent topics'}</h3><p class="meta">${kind==='pins'?'Use the star beside a specialty or topic to pin it.':'Recently opened specialties and topics appear here automatically.'}</p><button type="button" class="btn block" onclick="appPage='subjects';renderAppDemo()">Browse specialties</button></div>`;
 return rows.map(e=>{const key=u7PinKey(e),sp=SPEC_NAME[e.spec]||e.spec,title=e.k==='spec'?sp:(e.topic===0?'All questions':TOPIC_NAME[e.topic]||'Topic');const n=QB.filter(x=>x.spec===e.spec&&(e.k==='spec'||e.topic===0||x.topic===e.topic)).length;const selected=sel.has(key);return `<article class="u7-pinrow"><label class="u7-check"><input type="checkbox" ${selected?'checked':''} onchange="u7PinSelect('${kind}','${esc(key)}',this.checked)"></label><button type="button" class="u7-pin-main" onclick="${e.k==='spec'?`openSpec('${esc(e.spec)}')`:`openTopic('${esc(e.spec)}',${Number(e.topic)||0})`}"><b>${esc(title)}</b><span>${esc(sp)} · ${n} questions</span><small>${kind==='recent'?'Visited':'Pinned'} · ${e.t?fmtDT(e.t):'Date not recorded'}</small></button>${kind==='pins'?`<button class="btn" type="button" onclick="u7Unpin('${esc(key)}')">Unpin</button>`:`<button class="btn danger" type="button" onclick="u7RemoveRecent('${esc(key)}')">Remove</button>`}</article>`}).join('')}
function pinnedRecentView(){const tab=u7State.pinTab==='recent'?'recent':'pins',rows=u7PinRows(tab),specs=u7Specs();return `${appHeader('Pinned & Recent')}<div class="rs u7-page"><div class="u7-title"><div><h1>Pinned &amp; Recent</h1><p class="sub">Two independent lists: saved shortcuts and recently visited study topics.</p></div><span class="u7-count">${rows.length}</span></div><div class="seg wide u7-tabs"><button type="button" class="${tab==='pins'?'on':''}" onclick="u7PinTab('pins')">Pinned (${PINS.length})</button><button type="button" class="${tab==='recent'?'on':''}" onclick="u7PinTab('recent')">Recent (${REC.length})</button></div><div class="u7-filters"><input class="field" type="search" placeholder="Search ${tab==='pins'?'pinned':'recent'} items…" value="${esc(tab==='pins'?u7State.pinSearch:u7State.recentSearch)}" oninput="u7PinFilter('${tab}','search',this.value)"><select class="field" onchange="u7PinFilter('${tab}','spec',this.value)">${u7Option('all','All specialties',tab==='pins'?u7State.pinSpec:u7State.recentSpec)}${specs.map(x=>u7Option(x,u7Spec({spec:x}),tab==='pins'?u7State.pinSpec:u7State.recentSpec)).join('')}</select></div><div class="u7-toolbar"><span class="meta">${rows.length} ${tab==='pins'?'pinned':'recent'} · ${u7Selected[tab].size} selected</span><div class="u7-actions"><button type="button" class="btn" onclick="u7PinSelectAll('${tab}')">Select all</button><button type="button" class="btn danger" ${u7Selected[tab].size?'':'disabled'} onclick="u7PinBulkRemove('${tab}')">Remove selected</button></div></div><div id="u7-pin-results" class="u7-pinrows">${u7PinMarkup(tab)}</div></div>`}
window.u7PinTab=function(tab){u7State.pinTab=tab==='recent'?'recent':'pins';renderAppDemo()};
window.u7PinFilter=function(tab,k,v){if(tab==='pins'){if(k==='search')u7State.pinSearch=v;else u7State.pinSpec=v}else{if(k==='search')u7State.recentSearch=v;else u7State.recentSpec=v}const box=document.getElementById('u7-pin-results');if(box)box.innerHTML=u7PinMarkup(tab)};
window.u7PinSelect=function(tab,key,yes){const set=u7Selected[tab];yes?set.add(key):set.delete(key);const box=document.getElementById('u7-pin-results');if(box)box.innerHTML=u7PinMarkup(tab)};
window.u7PinSelectAll=function(tab){const set=u7Selected[tab],rows=u7PinRows(tab);if(rows.length&&set.size===rows.length)set.clear();else{set.clear();rows.forEach(e=>set.add(u7PinKey(e)))}const box=document.getElementById('u7-pin-results');if(box)box.innerHTML=u7PinMarkup(tab)};
window.u7Unpin=function(key){const e=PINS.find(x=>u7PinKey(x)===key);if(!e)return;confirmBox({title:'Unpin this item?',text:'Remove this specialty or topic from Pinned?',ok:'Unpin',danger:true},()=>{PINS=PINS.filter(x=>u7PinKey(x)!==key);LS.set(PKEY,PINS);u7Selected.pins.delete(key);renderAppDemo()})};
window.u7RemoveRecent=function(key){if(!REC.some(x=>u7PinKey(x)===key))return;confirmBox({title:'Remove recent item?',text:'Remove this item from Recent Activity? The topic and its study data stay untouched.',ok:'Remove',danger:true},()=>{REC=REC.filter(x=>u7PinKey(x)!==key);LS.set(RKEY,REC);u7Selected.recent.delete(key);renderAppDemo()})};
window.u7PinBulkRemove=function(tab){const set=u7Selected[tab],keys=[...set];if(!keys.length)return;confirmBox({title:tab==='pins'?'Unpin selected items?':'Remove selected recent items?',text:`Remove ${keys.length} selected item${keys.length===1?'':'s'}?`,detail:'Study questions and progress are not deleted.',ok:'Remove',danger:true},()=>{if(tab==='pins'){PINS=PINS.filter(e=>!set.has(u7PinKey(e)));LS.set(PKEY,PINS)}else{REC=REC.filter(e=>!set.has(u7PinKey(e)));LS.set(RKEY,REC)}set.clear();renderAppDemo()})};

/* Register the dedicated pages and menu routes. */
PAGES.saved=()=>u7QuestionPage('saved');
PAGES.wrong=()=>u7QuestionPage('wrong');
PAGES.notes=myNotesView;
PAGES.pinned=pinnedRecentView;
PAGES2.saved=PAGES2.wrong=PAGES2.notes=PAGES2.pinned=1;
try{
 DR2[1][1][0][1]='saved';DR2[1][1][1][1]='wrong';
 if(!DR2[1][1].some(x=>x[1]==='notes'))DR2[1][1].splice(2,0,['My Notes','notes','<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>']);
 DR2[2][1][1][0]='Pinned & Recent';DR2[2][1][1][1]='pinned';
}catch(e){console.warn('Study library menu registration:',e)}
try{BACKP.saved='subjects';BACKP.wrong='subjects';BACKP.notes='subjects';BACKP.pinned='subjects'}catch(e){}

/* Unit 10: notification preferences and event classification. */
function u10Kind(id,title){const s=String(id||'')+' '+String(title||'');if(/^sr-/i.test(id)||/review due|review ready/i.test(s))return'review';if(/^quiz-/i.test(id)||/quiz completed|timed quiz ended/i.test(s))return'quiz';if(/^reminder-/i.test(id)||/study reminder/i.test(s))return'reminders';return'updates'}
const u10Priority={review:4,quiz:3,reminders:2,updates:1};
const u10OldAddNotif=addNotif;
addNotif=function(id,title,body,page,ref){
 const kind=u10Kind(id,title);if(U10_PREFS[kind]===false)return;
 u10OldAddNotif(id,title,body,page,ref);
 const n=NOTIF.find(x=>x.id===id);if(n){n.kind=kind;n.priority=n.priority||u10Priority[kind];n.route=n.page||'';n.ref=n.ref||'';n.updatedAt=n.updatedAt||n.t;LS.set(NKEY,NOTIF)}
};
NOTIF.forEach(n=>{if(!n.kind)n.kind=u10Kind(n.id,n.title);if(!n.priority)n.priority=u10Priority[n.kind]||1;if(!n.updatedAt)n.updatedAt=n.t});
LS.set(NKEY,NOTIF);
window.nToggle=function(id,ev){ev&&ev.stopPropagation();const n=NOTIF.find(x=>x.id===id);if(!n)return;n.read=!n.read;n.readAt=n.read?Date.now():0;LS.set(NKEY,NOTIF);renderAppDemo()};
window.nReadAll=function(){if(!unreadN())return;NOTIF.forEach(n=>{n.read=true;n.readAt=Date.now()});LS.set(NKEY,NOTIF);renderAppDemo()};
window.nDeleteOne=function(id){if(!NOTIF.some(n=>n.id===id))return;confirmBox({title:'Delete notification?',text:'Delete this notification from your in-app centre?',ok:'Delete',danger:true},()=>{NOTIF=NOTIF.filter(n=>n.id!==id);LS.set(NKEY,NOTIF);renderAppDemo()})};
window.nClear=function(){if(!NOTIF.length)return;confirmBox({title:'Clear all notifications?',text:`${NOTIF.length} notifications will be removed from this device.`,detail:'This does not alter Question Bank, Quiz History or study progress.',ok:'Clear all',danger:true},()=>{NOTIF=[];LS.set(NKEY,NOTIF);renderAppDemo()})};
window.nSetPref=function(kind,value){if(!(kind in U10_PREFS))return;U10_PREFS[kind]=!!value;u7SaveObj(U10_PREF_KEY,U10_PREFS);
 if(value){try{if(kind==='reminders')u10CheckDailyReminder();if(kind==='review'){const d=dueList().length;if(d)addNotif('sr-'+dayKey(),'Smart Review due',`${d} question${d>1?'s are':' is'} ready to review.`,'review')}}catch(e){}}
 try{toast((value?'Enabled: ':'Disabled: ')+({review:'Review due',quiz:'Quiz / session completion',reminders:'Study reminders',updates:'App updates'})[kind])}catch(e){}
 try{updateBadges()}catch(e){}};
window.nPrefToggle=function(btn){const c=btn.closest('.np');if(!c)return;const o=!c.classList.contains('open');c.classList.toggle('open',o);btn.setAttribute('aria-expanded',o);u10State.prefsOpen=o};
window.nSetFilter=function(v){u10State.filter=v;renderAppDemo()};
window.nSetSort=function(v){u10State.sort=v;renderAppDemo()};
window.nOpen=function(id){
 const n=NOTIF.find(x=>x.id===id);if(!n)return;n.read=true;n.readAt=Date.now();LS.set(NKEY,NOTIF);
 const page=n.page||n.route,ref=n.ref||'';
 if(page==='quizresult'&&ref&&QZ.attempts.some(a=>a.id===ref)){qzViewId=ref;appPage='quizresult';renderAppDemo();return}
 if((page==='questions'||page==='question')&&ref&&u7Q(ref)){renderAppDemo();openQ(ref);return}
 if(page==='review'||page==='settings'||page==='notifs'||page==='saved'||page==='wrong'||page==='notes'||page==='pinned'||page==='stats'){appPage=page;renderAppDemo();return}
 if(page&&PAGES2[page]!==0){appPage=page;renderAppDemo();return}
 renderAppDemo();
};
const NI={gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
down:'<path d="M6 9l6 6 6-6"/>',right:'<path d="M9 6l6 6-6 6"/>',review:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',quiz:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>',cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',phone:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',cap:'<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',star:'<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',mega:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',funnel:'<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',sort:'<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',check:'<path d="M5 12l5 5L20 7"/>'};
const niSvg=(k,sz)=>`<svg viewBox="0 0 24 24" width="${sz||20}" height="${sz||20}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NI[k]}</svg>`;
function u10NiKind(n){const t=String(n.title||'');if(/^welcome/i.test(t))return['mega','welcome'];const k=n.kind||u10Kind(n.id,n.title);return k==='review'?['review','review']:k==='quiz'?['quiz','quiz']:k==='reminders'?['cap','reminders']:['star','updates']}
function u10When(t){try{const d=new Date(t);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' • '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}catch(e){return ''}}
function u10PushReady(){return !!(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.PushNotifications)}
function u10PrefCard(){const items=[['review','review','Review due','When items become due'],['quiz','quiz','Quiz / session completion','When a quiz is completed'],['reminders','cal','Study reminders','Local study reminders'],['updates','bell','App updates','Important app events']];const ok=u10PushReady();
 return `<div class="np${u10State.prefsOpen?' open':''}"><button type="button" class="np-head" aria-expanded="${!!u10State.prefsOpen}" onclick="nPrefToggle(this)"><span class="np-gear">${niSvg('gear',26)}</span><span class="np-t"><b>Notification preferences</b><small>Customize what notifications you want to receive</small></span><span class="np-chev">${niSvg('down',22)}</span></button>
 <div class="np-wrap"><div class="np-body"><div class="np-grid">${items.map(([k,ic,t,d])=>`<div class="np-it"><span class="np-ic">${niSvg(ic,22)}</span><b>${t}</b><small>${d}</small><label class="np-sw"><input type="checkbox" ${U10_PREFS[k]?'checked':''} onchange="nSetPref('${k}',this.checked)" aria-label="${t}"><i></i></label></div>`).join('')}</div>
 <button type="button" class="np-push" onclick="shbaceEnablePush()"><span class="np-ic">${niSvg('phone',26)}</span><span class="np-pt"><b>Android Push Notifications (FCM)</b><small>${ok?'Native push plugin detected; Firebase and backend setup still need verification.':'Push plugin not detected; Android plugin, Firebase configuration and backend are required.'}</small></span><span class="np-badge off">${ok?'Setup pending':'Not configured'}</span><span class="np-chev r">${niSvg('right',20)}</span></button></div></div></div>`}
notifsView=function(){
 let rows=NOTIF.slice();if(u10State.filter==='unread')rows=rows.filter(n=>!n.read);else if(u10State.filter!=='all')rows=rows.filter(n=>(n.kind||u10Kind(n.id,n.title))===u10State.filter);
 rows.sort((a,b)=>u10State.sort==='priority'?((b.priority||u10Priority[b.kind]||1)-(a.priority||u10Priority[a.kind]||1))||b.t-a.t:b.t-a.t);
 const filters=[['all','All'],['unread','Unread'],['review','Review'],['quiz','Quiz'],['reminders','Reminders'],['updates','Updates']];
 const card=n=>{const [ic,tone]=u10NiKind(n),id=esc(n.id);return `<article class="nc ${n.read?'read':'unread'}" data-nid="${id}" onclick="nOpen(this.dataset.nid)"><span class="nc-ico t-${tone}">${niSvg(ic,30)}</span><div class="nc-main"><div class="nc-top">${n.read?'<span class="nc-pill">Read</span>':'<i class="nc-dot"></i><span class="nc-pill new">New</span>'}</div><b class="nc-title">${esc(n.title)}</b><p>${esc(n.body||'')}</p><div class="nc-foot"><span class="nc-time">${niSvg('clock',14)}${u10When(n.t)}</span><span class="nc-acts">${n.read?'':`<button type="button" class="nc-b" data-nid="${id}" onclick="nToggle(this.dataset.nid,event)">${niSvg('check',14)}Mark read</button>`}<button type="button" class="nc-b del" data-nid="${id}" onclick="event.stopPropagation();nDeleteOne(this.dataset.nid)">${niSvg('trash',14)}Delete</button></span></div></div><span class="nc-go">${niSvg('right',22)}</span></article>`};
 return `${appHeader('Notifications')}<div class="rs u7-page"><div class="u7-title"><div><h1>Notifications</h1><p class="sub">${unreadN()} unread · stored on this device · manage types in Settings</p></div><span class="u7-count">${NOTIF.length}</span></div><div class="nc-tools"><button type="button" class="nc-t danger" ${NOTIF.length?'':'disabled'} onclick="nClear()">${niSvg('trash',17)}Clear all</button><label class="nc-t sel">${niSvg('funnel',17)}<select aria-label="Filter" onchange="nSetFilter(this.value)">${filters.map(([v,l])=>u7Option(v,l,u10State.filter)).join('')}</select>${niSvg('down',14)}</label><label class="nc-t sel">${niSvg('sort',17)}<select aria-label="Sort" onchange="nSetSort(this.value)">${u7Option('new','Newest first',u10State.sort)}${u7Option('priority','Importance',u10State.sort)}</select>${niSvg('down',14)}</label><button type="button" class="nc-t primary" ${unreadN()?'':'disabled'} onclick="nReadAll()">${niSvg('check',17)}Mark all read</button></div>${rows.length?rows.map(card).join(''):'<div class="card setcard u7-empty"><h3>No notifications in this view</h3><p class="meta">Notifications appear only when a real app event occurs and its category is enabled in Settings.</p></div>'}</div>`;
};

/* Real local study reminder: one deduplicated in-app reminder per local date, only
   when reminders are enabled and there has been no QB/Quiz activity today. */
function u10CheckDailyReminder(){
 if(!U10_PREFS.reminders)return;
 const today=new Date().toLocaleDateString('en-CA');
 const last=Math.max(0,...Object.values(S.ans||{}).map(x=>Number(x&&x.t)||0),...QZ.attempts.map(x=>Number(x.end)||0));
 const lastDay=last?new Date(last).toLocaleDateString('en-CA'):'';
 if(lastDay===today)return;
 addNotif('reminder-'+today,'A gentle study reminder','You have not recorded a study or Question Bank session today. Open a topic when you are ready.','subjects','');
}
try{u10CheckDailyReminder()}catch(e){}

/* Android bridge. The actual FCM plugin, Firebase project and HTTPS backend must be
   installed/configured in the native project. No tokens are exported in user backups. */
window.shbaceEnablePush=async function(){
 const plug=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.PushNotifications;
 if(!plug){toast('Android Push plugin is not installed in this build');return false}
 try{
  const perm=await plug.requestPermissions();if(!perm||perm.receive!=='granted'){toast('Notification permission was not granted');return false}
  if(!window.__shbacePushListeners){
   window.__shbacePushListeners=true;
   await plug.addListener('registration',async token=>{
    try{window.__shbaceCurrentFcmToken=String(token.value||'');if(window.SHBACE_FCM_BACKEND_URL){await fetch(window.SHBACE_FCM_BACKEND_URL.replace(/\/$/,'')+'/devices/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:window.__shbaceCurrentFcmToken,platform:'android',app:'shbace-medical'})})}else toast('FCM token received; backend endpoint is not configured') }catch(e){console.warn('FCM token registration failed',e);toast('Could not register this device with the push backend')}
   });
   await plug.addListener('registrationError',e=>{console.warn('Push registration error',e);toast('Android push registration failed')});
   await plug.addListener('pushNotificationReceived',n=>{
    const d=n&&n.data||{},id=String(d.eventId||d.id||('push-'+(n&&n.id||Date.now())));
    addNotif(id,(n&&n.title)||d.title||'Shbace Medical', (n&&n.body)||d.body||'',d.page||'',d.ref||d.questionId||'');
   });
   await plug.addListener('pushNotificationActionPerformed',a=>{const d=a&&a.notification&&a.notification.data||{};const id=String(d.eventId||d.id||'');if(id&&NOTIF.some(n=>n.id===id))nOpen(id);else if(d.questionId&&u7Q(d.questionId))openQ(d.questionId);else if(d.page){appPage=d.page;renderAppDemo()}});
  }
  await plug.register();toast('Android notification permission granted; waiting for FCM registration');return true;
 }catch(e){console.error('Android push setup failed',e);toast('Android push could not be enabled');return false}
};

/* Unit 11: versioned, integrity-checked backup of all app-prefixed student stores,
   including the separate Quiz History store. Never includes the static QB data script. */
const U11_EXCLUDED_KEYS=new Set(['shbace_splash_completed_session_v1','shbace_fcm_token_v1','shbace_push_auth_v1']);
function u11DataKeys(){const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('shbace_')&&!U11_EXCLUDED_KEYS.has(k)&&!/token|secret|credential/i.test(k))keys.push(k)}return keys.sort()}
function u11Capture(){const stores={};u11DataKeys().forEach(k=>{const v=localStorage.getItem(k);if(v!==null)stores[k]=v});return stores}
function u11Checksum(stores){const payload=Object.keys(stores).sort().map(k=>k+'\u0000'+stores[k]).join('\u0001');let h=2166136261;for(let i=0;i<payload.length;i++){h^=payload.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
function u11Parse(v){try{return JSON.parse(v)}catch(e){return undefined}}
function u11Counts(stores){
 const qb=u11Parse(stores[KEY])||{},quiz=u11Parse(stores[QKEY])||{},pins=u11Parse(stores[PKEY])||[],recent=u11Parse(stores[RKEY])||[],notifs=u11Parse(stores[NKEY])||[],ans=qb.ans||{},saved=qb.saved||{},notes=qb.notes||{},rep=qb.rep||{},sr=qb.sr||{};
 const wrong=Object.values(ans).filter(x=>x&&x.ok===false).length;
 const wr=u11Parse(stores[U7_WRONG_KEY])||{};
 return {qbAnswers:Object.keys(ans).length,quizAttempts:Array.isArray(quiz.attempts)?quiz.attempts.length:0,quizActive:!!quiz.active,savedQuestions:Object.keys(saved).filter(k=>saved[k]).length,wrongAnswers:Math.max(wrong,Object.keys(wr).filter(k=>wr[k]&&!wr[k].hidden).length),notes:Object.keys(notes).filter(k=>typeof notes[k]==='string'&&notes[k].trim()).length,smartReview:(()=>{const x=u11Parse(stores[SR3KEY]);return x&&x.q&&typeof x.q==='object'?Object.keys(x.q).length:Object.keys(sr).length})(),pinned:Array.isArray(pins)?pins.length:0,recent:Array.isArray(recent)?recent.length:0,notifications:Array.isArray(notifs)?notifs.length:0,reported:Object.keys(rep).length,otherStores:Object.keys(stores).length};
}
function u11LegacyV1(obj){
 if(!obj||obj.version!==1||obj.format!=='backup'||obj.app!=='Shbace Medical'||!obj.data||!obj.data.qb)throw new Error('Unsupported or malformed legacy backup');
 const d=obj.data,q=d.qb;const stores={};stores[KEY]=JSON.stringify({ans:q.ans||{},saved:q.saved||{},notes:q.notes||{},rep:q.rep||{},sr:q.sr||{}});
 if(d.settings){stores[SKEY]=JSON.stringify(Object.assign({theme:'dark',font:'medium',view:'all',doctor:'on'},d.settings));if(d.settings.theme)stores['shbace_theme']=d.settings.theme}
 if(d.grade!==null&&d.grade!==undefined)stores['shbace_onboarding_v3_grade']=String(d.grade);
 return {app:'Shbace Medical',format:'backup',version:U11_VERSION,exportedAt:obj.exportedAt||'',stores,checksum:u11Checksum(stores),legacyPartial:true};
}
function u11Validate(obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||obj.app!=='Shbace Medical'||obj.format!=='backup')throw new Error('Not a Shbace Medical backup');
 if(obj.version===1)obj=u11LegacyV1(obj);
 if(obj.version!==U11_VERSION||!obj.stores||typeof obj.stores!=='object'||Array.isArray(obj.stores))throw new Error('Unsupported backup version or missing stores');
 const keys=Object.keys(obj.stores);if(!keys.length||keys.length>100)throw new Error('Backup store list is invalid');
 let total=0;for(const k of keys){if(!k.startsWith('shbace_')||U11_EXCLUDED_KEYS.has(k)||/token|secret|credential/i.test(k))throw new Error('Backup contains a non-user or restricted store');const v=obj.stores[k];if(typeof v!=='string')throw new Error('Malformed store: '+k);total+=v.length;if(total>25*1024*1024)throw new Error('Backup data is too large');}
 if(obj.checksum!==u11Checksum(obj.stores))throw new Error('Backup integrity check failed');
 // Validate the independent critical data stores before applying anything.
 for(const k of [KEY,SR3KEY,QKEY,QCKEY,PKEY,RKEY,NKEY,U7_SAVED_META_KEY,U7_WRONG_KEY,U8_NOTE_META_KEY,U10_PREF_KEY])if(obj.stores[k]!==undefined){const x=u11Parse(obj.stores[k]);if(x===undefined||!x||typeof x!=='object')throw new Error('Malformed data in '+k)}
 const qb=u11Parse(obj.stores[KEY])||{};for(const k of ['ans','saved','notes','rep','sr'])if(qb[k]!==undefined&&(!qb[k]||typeof qb[k]!=='object'||Array.isArray(qb[k])))throw new Error('Invalid Question Bank data: '+k);
 {const s3=u11Parse(obj.stores[SR3KEY]);if(s3&&s3.q!==undefined&&(!s3.q||typeof s3.q!=='object'||Array.isArray(s3.q)))throw new Error('Smart Review data is malformed')}
 const quiz=u11Parse(obj.stores[QKEY]);if(quiz&&(quiz.attempts!==undefined&&!Array.isArray(quiz.attempts)))throw new Error('Quiz History is malformed');
 return obj;
}
function u11MergeMap(a,b,scoreA,scoreB){const out=Object.assign({},a||{});Object.entries(b||{}).forEach(([k,v])=>{if(!(k in out)){out[k]=v;return}const sa=scoreA?scoreA(out[k]):0,sb=scoreB?scoreB(v):0;if(sb>=sa)out[k]=v});return out}
/* Backup merge: ask the student about every note that exists on both sides with different text. */
function u11NoteMap(raw){var q=u11Parse(raw);return(q&&q.notes&&typeof q.notes==='object')?q.notes:{}}
function u11NoteConflicts(obj){
  var cur=u11NoteMap(localStorage.getItem(KEY)),inc=u11NoteMap(obj&&obj.stores&&obj.stores[KEY]),out=[];
  Object.keys(inc).forEach(function(id){
    var a=cur[id],b=inc[id];
    if(typeof a==='string'&&typeof b==='string'&&a.trim()&&b.trim()&&a.trim()!==b.trim())out.push({id:id,cur:a,inc:b});
  });
  return out;
}
function u11MergeNotes(a,b){
  var ch=window.__u11NoteChoices||{},out=Object.assign({},a||{});
  Object.keys(b||{}).forEach(function(id){
    var x=out[id],y=b[id];
    if(!(id in out)){out[id]=y;return}
    var bothText=typeof x==='string'&&typeof y==='string'&&x.trim()&&y.trim()&&x.trim()!==y.trim();
    if(!bothText){ if(!(typeof x==='string'&&x.trim()))out[id]=y; return }
    var c=ch[id]||'current';              /* no answer = keep the student's current note, never overwrite silently */
    if(c==='backup')out[id]=y;
    else if(c==='both')out[id]=x+'\n\n— From backup —\n'+y;
  });
  return out;
}
function u11AskNoteConflicts(list,done){
  var ph=document.querySelector('.phone')||document.body,choices={},n=list.length;
  var old=document.getElementById('u11-note-conflict');old&&old.remove();
  var box=document.createElement('div');box.id='u11-note-conflict';box.className='u11-modal';
  function label(id){var t=String(id).replace(/[|_:]+/g,' · ');return t.length>70?t.slice(0,67)+'…':t}
  var rows=list.map(function(c,i){
    return '<article class="u11-conflict"><div class="u11-conflict-top"><b>Note conflict '+(i+1)+' of '+n+'</b><small>'+esc(label(c.id))+'</small></div>'
     +'<div class="u11-note-compare"><section><small>THIS DEVICE</small><p>'+esc(c.cur)+'</p><button type="button" class="u11-note-choice" data-i="'+i+'" data-a="current">Keep this note</button></section>'
     +'<section><small>BACKUP FILE</small><p>'+esc(c.inc)+'</p><button type="button" class="u11-note-choice" data-i="'+i+'" data-a="backup">Use backup note</button></section></div>'
     +'<button type="button" class="u11-note-choice u11-note-both" data-i="'+i+'" data-a="both">Keep both notes</button>'
     +'<div class="u11-choice-status" id="u11-cs-'+i+'">Choose what to keep</div></article>'}).join('');
  box.innerHTML='<div class="u11-backdrop"></div><section class="u11-dialog u11-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="u11-nc-t"><header><div><small>MERGE · NOTE REVIEW</small><h3 id="u11-nc-t">Resolve your note conflicts</h3><p>Nothing has been changed yet. Choose a version for every note below.</p></div><button class="h7-x" type="button" data-a="cancel" aria-label="Cancel">✕</button></header>'
   +'<div class="u11-conflict-progress" id="u11-nc-prog">0 of '+n+' decisions made</div><div class="u11-conflict-list">'+rows+'</div>'
   +'<div class="u11-dialog-actions"><button type="button" class="btn" data-a="cancel">Cancel merge</button><button type="button" class="btn" id="u11-nc-ok" data-a="ok" disabled>Confirm choices &amp; Merge</button></div>'
   +'<p class="u11-conflict-foot">Cancel keeps your current data untouched.</p></section>';
  ph.appendChild(box);
  var txt={current:'Keeping the note from this device',backup:'Using the note from the backup',both:'Keeping both notes'};
  box.addEventListener('click',function(ev){
    var btn=ev.target.closest&&ev.target.closest('[data-a]');if(!btn)return;
    var a=btn.getAttribute('data-a');
    if(a==='cancel'){box.remove();window.__u11NoteChoices=null;return}
    if(a==='ok'){if(Object.keys(choices).length!==n)return;box.remove();window.__u11NoteChoices=choices;done();return}
    var i=+btn.getAttribute('data-i');if(!list[i])return;
    choices[list[i].id]=a;
    box.querySelectorAll('[data-i="'+i+'"]').forEach(function(x){x.classList.toggle('selected',x===btn)});
    var st=box.querySelector('#u11-cs-'+i);if(st)st.textContent=txt[a];
    var cnt=Object.keys(choices).length,pg=box.querySelector('#u11-nc-prog'),ok=box.querySelector('#u11-nc-ok');
    if(pg)pg.textContent=cnt+' of '+n+' decisions made';if(ok)ok.disabled=cnt!==n;
  });
}
function u11MergeStore(key,current,incoming){
 const a=u11Parse(current),b=u11Parse(incoming);if(a===undefined||b===undefined)return incoming;
 if(key===KEY){const out=Object.assign({},a,b);const merged={};for(const f of ['ans','saved','notes','rep','sr']){
   const aa=a[f]||{},bb=b[f]||{};let sc;
   if(f==='ans')sc=x=>Number(x&&x.t)||0;
   else if(f==='sr')sc=x=>Math.max(Number(x&&x.last)||0,Number(x&&x.due)||0,Number(x&&x.added)||0);
   else if(f==='notes')sc=x=>0;
   else sc=x=>1;
   merged[f]=f==='notes'?u11MergeNotes(aa,bb):u11MergeMap(aa,bb,sc,sc);
  }out.ans=merged.ans;out.saved=merged.saved;out.notes=merged.notes;out.rep=merged.rep;out.sr=merged.sr;return JSON.stringify(out)}
 if(key===SR3KEY&&a&&b&&typeof a==='object'&&typeof b==='object'){const A=a.q&&typeof a.q==='object'?a.q:{},B=b.q&&typeof b.q==='object'?b.q:{},q={};
  new Set([...Object.keys(A),...Object.keys(B)]).forEach(id=>{const x=A[id],y=B[id];if(!x)q[id]=y;else if(!y)q[id]=x;else{const nx=Number(x.n)||0,ny=Number(y.n)||0;q[id]=ny>nx||(ny===nx&&(Number(y.last)||0)>=(Number(x.last)||0))?y:x}});
  const days=Object.assign({},a.days||{});Object.entries(b.days||{}).forEach(([k,v])=>{if(!days[k]||(Number(v&&v.n)||0)>(Number(days[k].n)||0))days[k]=v});
  const ses=new Map();[...(a.ses||[]),...(b.ses||[])].forEach(s=>{if(s&&s.id)ses.set(s.id,s)});
  return JSON.stringify(Object.assign({},a,b,{q,days,ses:[...ses.values()].sort((x,y)=>(y.t||0)-(x.t||0)).slice(0,60),sess:null,spd:(a.spd||[]).concat(b.spd||[]).slice(-40)}))}
 if(key===QKEY){const attempts=new Map();[...(Array.isArray(a.attempts)?a.attempts:[]),...(Array.isArray(b.attempts)?b.attempts:[])].forEach(x=>{if(x&&x.id){const old=attempts.get(x.id);if(!old||(Number(x.end)||0)>=(Number(old.end)||0))attempts.set(x.id,x)}});const active=[a.active,b.active].filter(x=>x&&Array.isArray(x.ids)).sort((x,y)=>(Number(y.start)||0)-(Number(x.start)||0))[0]||null;return JSON.stringify(Object.assign({},a,b,{attempts:[...attempts.values()].sort((x,y)=>(Number(y.end)||0)-(Number(x.end)||0)).slice(0,200),active}))}
 if([PKEY,RKEY].includes(key)&&Array.isArray(a)&&Array.isArray(b)){const map=new Map();[...a,...b].forEach(x=>{if(!x)return;const id=`${x.k}:${x.spec}:${x.topic}`;const o=map.get(id);if(!o||(Number(x.t)||0)>=(Number(o.t)||0))map.set(id,x)});return JSON.stringify([...map.values()].sort((x,y)=>(Number(y.t)||0)-(Number(x.t)||0)).slice(0,key===RKEY?12:500))}
 if(key===NKEY&&Array.isArray(a)&&Array.isArray(b)){const map=new Map();[...a,...b].forEach(x=>{if(!x||!x.id)return;const o=map.get(x.id);if(!o)map.set(x.id,x);else{const newer=(Number(x.updatedAt)||Number(x.t)||0)>=(Number(o.updatedAt)||Number(o.t)||0)?x:o;map.set(x.id,Object.assign({},o,newer,{read:!!o.read&&!!x.read}))}});return JSON.stringify([...map.values()].sort((x,y)=>(Number(y.t)||0)-(Number(x.t)||0)).slice(0,500))}
 if(key===U7_SAVED_META_KEY||key===U7_WRONG_KEY||key===U8_NOTE_META_KEY){const sc=x=>Math.max(Number(x&&x.updatedAt)||0,Number(x&&x.lastAt)||0,Number(x&&x.savedAt)||0,Number(x&&x.createdAt)||0);return JSON.stringify(u11MergeMap(a,b,sc,sc))}
 if(Array.isArray(a)&&Array.isArray(b)){const map=new Map();[...a,...b].forEach(x=>{const id=x&&x.id?String(x.id):JSON.stringify(x);if(!map.has(id))map.set(id,x)});return JSON.stringify([...map.values()])}
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return JSON.stringify(Object.assign({},a,b));
 return incoming;
}
function u11BuildMerged(incoming){const stores=u11Capture();Object.entries(incoming.stores).forEach(([k,v])=>{stores[k]=stores[k]===undefined?v:u11MergeStore(k,stores[k],v)});return stores}
function u11Commit(stores,mode){
 const before=u11Capture(),beforeKeys=Object.keys(before);const targetKeys=Object.keys(stores);
 try{
  // Write all destination values first. Existing stores are not removed until every set succeeds.
  targetKeys.forEach(k=>localStorage.setItem(k,stores[k]));
  if(mode==='replace')beforeKeys.forEach(k=>{if(!(k in stores)&&!U11_EXCLUDED_KEYS.has(k))localStorage.removeItem(k)});
  return true;
 }catch(e){
  // Roll back every affected app store if any write/removal fails.
  try{u11DataKeys().forEach(k=>{if(!(k in before))localStorage.removeItem(k)});Object.entries(before).forEach(([k,v])=>localStorage.setItem(k,v))}catch(rollbackError){console.error('Backup rollback error',rollbackError)}
  throw new Error('Restore could not be completed; the previous data snapshot was reapplied. '+(e&&e.message||''));
 }
}
/* M-05/M-06 (additive layer; u11Validate/u11Commit bodies untouched): deep content check + safe restore */
function u11SafeId(id){return typeof id==='string'&&id.length>0&&id.length<=160&&!/['"\\<>`&;(){}\u0000-\u001f]/.test(id)}
function u11DeepCheck(obj){
 const st=obj.stores,P=k=>st[k]===undefined?undefined:u11Parse(st[k]),isO=x=>x&&typeof x==='object'&&!Array.isArray(x),bad=m=>{throw new Error('Backup content check failed: '+m)};
 const qb=P(KEY);if(qb!==undefined){if(!isO(qb))bad('question data');
  for(const f of ['ans','saved','notes','rep','sr']){const m=qb[f];if(m===undefined)continue;if(!isO(m))bad(f);for(const id of Object.keys(m)){if(!u11SafeId(id))bad('question id');const r=m[id];
   if(f==='ans'&&(!isO(r)||!Number.isInteger(r.sel)||typeof r.ok!=='boolean'))bad('answer record');
   if(f==='notes'&&typeof r!=='string')bad('note');if(f==='sr'&&!isO(r))bad('review record')}}}
 const nt=P(NKEY);if(nt!==undefined){if(!Array.isArray(nt)||nt.length>500)bad('notifications');nt.forEach(n=>{if(!isO(n)||!u11SafeId(n.id)||typeof n.title!=='string')bad('notification')})}
 const qz=P(QKEY);if(isO(qz)&&qz.attempts!==undefined)qz.attempts.forEach(a=>{if(!isO(a)||!u11SafeId(a.id)||!Array.isArray(a.items))bad('quiz attempt');a.items.forEach(i=>{if(!isO(i)||!u11SafeId(i.id)||!Number.isInteger(i.sel))bad('quiz item')})});
 const s3=P(SR3KEY);if(isO(s3)&&isO(s3.q))Object.keys(s3.q).forEach(id=>{if(!u11SafeId(id))bad('review id')});
 for(const k of [U7_SAVED_META_KEY,U7_WRONG_KEY,U8_NOTE_META_KEY]){const m=P(k);if(isO(m))Object.keys(m).forEach(id=>{if(!u11SafeId(id))bad('record id')})}
 for(const k of [PKEY,RKEY]){const a=P(k);if(a!==undefined&&!Array.isArray(a))bad('list')}
}
{const _vc=u11Validate;u11Validate=function(o){const r=_vc(o);u11DeepCheck(r);return r};
 const _cm=u11Commit;u11Commit=function(stores,mode){const snap=u11Capture();window.__u11PrevData=snap;
  const same=()=>{const now=u11Capture();return Object.keys(now).length===Object.keys(snap).length&&Object.keys(snap).every(k=>now[k]===snap[k])};
  try{const r=_cm(stores,mode);window.__u11PrevData=null;return r}catch(e){
   let ok=false;try{ok=same()}catch(_){}
   if(!ok){try{u11DataKeys().forEach(k=>{if(!(k in snap))localStorage.removeItem(k)});Object.entries(snap).forEach(([k,v])=>localStorage.setItem(k,v));ok=same()}catch(_){ok=false}}
   if(!ok)throw new Error('Restore failed and your previous data could not be fully recovered. Please do not continue; keep this backup file and contact support. '+(e&&e.message||''));
   window.__u11PrevData=null;throw e}}}
function u11SummaryHtml(c){const labels=[['qbAnswers','QB answers'],['quizAttempts','Quiz attempts'],['savedQuestions','Saved questions'],['wrongAnswers','Wrong-answer records'],['notes','My Notes'],['smartReview','Smart Review'],['pinned','Pinned'],['recent','Recent'],['notifications','Notifications'],['reported','Reported questions']];return `<div class="u11-summary">${labels.map(([k,l])=>`<div><b>${Number(c[k])||0}</b><span>${l}</span></div>`).join('')}</div>`}
function u11PreviewModal(obj,fileName){
 const old=document.getElementById('u11-backup-preview');old&&old.remove();const ph=document.querySelector('.phone')||document.body;const c=u11Counts(obj.stores);const box=document.createElement('div');box.id='u11-backup-preview';box.className='u11-modal';box.innerHTML=`<div class="u11-backdrop" onclick="u11ClosePreview()"></div><section class="u11-dialog" role="dialog" aria-modal="true" aria-labelledby="u11-preview-title"><header><div><small>BACKUP VALIDATED</small><h3 id="u11-preview-title">${esc(fileName)}</h3><p>${obj.exportedAt?`Created ${fmtDT(Date.parse(obj.exportedAt)||0)}`:'Older backup format'}</p></div><button class="h7-x" type="button" onclick="u11ClosePreview()" aria-label="Close">✕</button></header>${u11SummaryHtml(c)}${obj.legacyPartial?'<p class="u11-warning">This is a legacy v1 backup. It did not contain Quiz History or the newer collections. Replace will preserve your current Quiz History and stores absent from the legacy file.</p>':''}<p class="meta">Choose how to apply this backup. Merge keeps existing items and adds missing/newer records. Replace swaps the backed-up app data after a safety snapshot.</p><div class="u11-dialog-actions"><button type="button" class="btn" onclick="u11ApplyImport('merge')">Merge Data</button><button type="button" class="btn danger" onclick="u11ConfirmReplace()">Replace Data</button></div><button type="button" class="btn block" onclick="u11ClosePreview()">Cancel</button></section>`;ph.appendChild(box);window.__u11Pending=obj;
}
window.u11ClosePreview=function(){document.getElementById('u11-backup-preview')?.remove();window.__u11Pending=null};
window.u11ConfirmReplace=function(){const obj=window.__u11Pending;if(!obj)return;confirmBox({title:'Replace all backed-up app data?',text:'Your current student data will be replaced by the selected backup.',detail:'A temporary in-memory snapshot is kept for rollback. Export a separate backup before proceeding if you want an additional copy.',ok:'Replace data',danger:true},()=>u11ApplyImport('replace'))};
window.u11ApplyImport=function(mode){const obj=window.__u11Pending;if(!obj||!['merge','replace'].includes(mode))return;
 if(mode==='merge'&&!window.__u11NoteAsked){let list=[];try{list=u11NoteConflicts(obj)}catch(e){console.error(e)}
  if(list.length){u11AskNoteConflicts(list,function(){window.__u11NoteAsked=1;try{window.u11ApplyImport('merge')}finally{window.__u11NoteAsked=0}});return}}
 if(mode!=='merge')window.__u11NoteChoices=null;
 try{let stores;
 if(mode==='merge')stores=u11BuildMerged(obj);
 else{
  stores=Object.assign({},obj.stores);
  // Old v1 backups did not carry Quiz History, settings preferences or the new metadata.
  if(obj.legacyPartial){const current=u11Capture();[QKEY,QCKEY,U7_SAVED_META_KEY,U7_WRONG_KEY,U8_NOTE_META_KEY,U10_PREF_KEY,NKEY,PKEY,RKEY].forEach(k=>{if(current[k]!==undefined&&stores[k]===undefined)stores[k]=current[k]})}
 }
 u11Commit(stores,mode);
 /* C1: the page reloads right after a restore. Stop pagehide/timer savers from writing stale in-memory data over the restored stores. */
 try{const _si=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===window.localStorage&&typeof k==='string'&&k.indexOf('shbace_')===0)return;return _si.apply(this,arguments)}}catch(_g){}
 u11ClosePreview();
 try{const settings=u11Parse(stores[SKEY]);if(settings){Object.assign(SET,settings);applySettings()}}catch(e){}
 toast(mode==='merge'?'Backup data merged':'Backup data restored');
 setTimeout(()=>location.reload(),250);
 }catch(e){console.error('Restore failed',e);toast(e.message||'Restore failed; current data was retained')}
};
window.exportBackup=function(){
 try{
  const stores=u11Capture();const counts=u11Counts(stores);
  const obj={app:'Shbace Medical',format:'backup',version:U11_VERSION,schema:'student-data-v2',exportedAt:new Date().toISOString(),appBuild:'ShbaceMedical-7S',stores,summary:counts,checksum:u11Checksum(stores)};
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='shbace-medical-backup-v2-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},5000);
  SET.lastBackup=Date.now();persistSettings();addNotif('backup-'+new Date().toISOString().slice(0,10),'Student backup created','All available Shbace Medical student stores, including Quiz History, were exported.','settings','');renderAppDemo();toast('Backup file created');
 }catch(e){console.error('Backup export failed',e);toast('Could not create backup: '+(e.message||''))}
};
window.restoreBackup=function(input){const f=input&&input.files&&input.files[0];if(input)input.value='';if(!f)return;if(f.size>30*1024*1024){toast('Backup file exceeds 30 MB');return}
 const r=new FileReader();r.onerror=()=>toast('Could not read backup file');r.onload=()=>{try{const raw=JSON.parse(r.result),obj=u11Validate(raw);u11PreviewModal(obj,f.name)}catch(e){console.error('Backup validation failed',e);toast('Invalid backup: '+(e.message||'file could not be validated'))}};r.readAsText(f);
};

/* Extend Settings without replacing its existing Appearance / Progress controls. */
const u11OriginalSettings=settingsView;
settingsView=function(){let h=u11OriginalSettings();const extra=`<div class="u10-settings-card">${u10PrefCard()}</div><div class="card setcard"><h3>Student data backup</h3><p class="meta">Versioned JSON backup includes the separate Quiz History store, Question Bank progress, Saved Questions, Wrong Answers, Smart Review, Pinned &amp; Recent, My Notes, reports, settings, notification history and other app-prefixed student stores. Static Question Bank content is not exported.</p><div class="setbtns"><button type="button" class="btn primary" onclick="exportBackup()">Export full backup</button><button type="button" class="btn" onclick="document.getElementById('bkFile').click()">Restore / Merge</button></div><p class="meta">${SET.lastBackup?'Last backup: '+new Date(SET.lastBackup).toLocaleString():'No backup created yet.'}</p></div>`;const ix=h.lastIndexOf('</div>');return ix>=0?h.slice(0,ix)+extra+h.slice(ix):h+extra};
/* PAGES stores function references, so refresh the routes after replacing their renderers. */
PAGES.notifs=notifsView;PAGES.settings=settingsView;

/* Push setup guidance is intentionally explicit: this HTML has no Firebase project,
   native Android folder, google-services.json or deployed backend endpoint to bind. */

})();
})();

