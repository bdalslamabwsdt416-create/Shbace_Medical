import {ThoraxScene,POINTS} from './scene.js?v=scene-sync-4';
import {pointForView} from './listening-points.js?v=library-1';
import {SoundEngine} from './sound.js?v=library-1';
import {getTeachingGuide} from './unified-learning.js?v=1';
import {getClinicalLink,getRelativeIntensity} from './clinical-links.js?v=1';
export function mountAuscultation(root,systemOverride='heart'){
const $=s=>root.querySelector(s);
const initialSystem=systemOverride==='lung'?'lung':'heart';
const state={system:initialSystem,view:'front',point:initialSystem==='lung'?'lung-right':'aortic',piece:'diaphragm',selected:null,items:[],playing:false,loadToken:0,waveElapsed:0,waveStarted:false,quizMode:false,quiz:{target:null,round:0,score:0,answered:false,options:[]}};
const sound=new SoundEngine({assetBase:new URL('./',import.meta.url).pathname});let scene=null;let mounted=true;let animationFrame=0;let waveFrame=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pointById=id=>POINTS.find(p=>p.id===id);
const toast=message=>{const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),3200);};
function setPressed(selector,key,value){root.querySelectorAll(selector).forEach(b=>{const on=b.dataset[key]===value;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});}
function applySpatialIntensity(){
 const output=$('#spatial-level');
 if(!state.selected){sound.setStrength(1);if(output)output.hidden=true;return;}
 const level=getRelativeIntensity(state.selected,state.point);
 sound.setStrength(level.value);
 if(output){output.hidden=false;output.textContent=level.label+' · relative teaching level, not measured dB';}
}
function updatePoint(id,fromScene=false){
 const p=pointById(id);if(!p||p.system!==state.system)return;
 state.point=id;state.view=p.back?'back':'front';
 $('#active-point-name').textContent=p.name;$('#active-point-position').textContent=p.position;
 $('#point-buttons').querySelectorAll('[data-point]').forEach(b=>{const on=b.dataset.point===id;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 setPressed('[data-view]','view',state.view);
 $('#orientation-label').textContent=state.view==='back'?'BACK VIEW':'FRONT VIEW';
 $('#anatomical-side').innerHTML=state.view==='back'?'L <span>·</span> R':'R <span>·</span> L';
 if(!fromScene&&scene)scene.setView(state.view);
 if(scene)scene.selectPoint(id);
 applySpatialIntensity();
}
function renderPointButtons(){
 const points=POINTS.filter(p=>p.system===state.system);
 if(state.system==='heart'){
  $('#point-buttons').innerHTML=points.map(p=>'<button class="point-chip '+(p.id===state.point?'active':'')+'" data-point="'+p.id+'" aria-pressed="'+(p.id===state.point)+'" title="'+esc(p.position)+'"><span>'+esc(p.code)+'</span>'+esc(p.short)+'</button>').join('');
 }else{
  const front=points.filter(p=>!p.back),back=points.filter(p=>p.back);
  const group=(items,label)=>'<div class="point-group"><span>'+label+'</span><div>'+items.map(p=>'<button class="point-chip lung '+(p.id===state.point?'active':'')+'" data-point="'+p.id+'" aria-pressed="'+(p.id===state.point)+'" title="'+esc(p.position)+'"><span>'+esc(p.code)+'</span>'+esc(p.short)+'</button>').join('')+'</div></div>';
  $('#point-buttons').innerHTML=group(front,'FRONT OF CHEST')+group(back,'BACK OF CHEST');
 }
 $('#point-buttons').querySelectorAll('[data-point]').forEach(b=>b.addEventListener('click',()=>updatePoint(b.dataset.point)));
 $('#point-helper').textContent=state.system==='heart'?'Select a site to compare relative murmur intensity':'Compare matching points on both sides';
}
function clearSelection(){
 state.loadToken++;sound.pause();sound.buffer=null;state.playing=false;state.waveElapsed=0;state.waveStarted=false;state.selected=null;
 $('#play-title').textContent='No recording selected';$('#play-subtitle').textContent='Your selected recording appears here';
 $('#audio-type').textContent='Choose a recording';$('#play').disabled=true;
 $('#wave-placeholder').hidden=false;$('#wave-placeholder').textContent='Select a sound from the library';
 $('#sound-status').textContent='Ready to listen';
 $('#selected-path').textContent='No file selected';$('#selected-source').textContent='Source information appears when you select a recording.';$('#duplicate-source-wrap').hidden=true;$('#duplicate-source-list').innerHTML='';
 $('#go-to-point').disabled=true;$('#learning-card').hidden=true;$('#learning-content').innerHTML='';$('#spatial-level').hidden=true;sound.setStrength(1);scene?.setTeachingFocus('');
}
function setSystem(system){
 if(state.system===system)return;
 if(state.quizMode)exitQuiz();
 clearSelection();$('#sound-search').value='';state.system=system;state.point=system==='heart'?'aortic':'lung-right';state.view='front';
 setPressed('[data-system]','system',system);scene?.setSystem(system);scene?.setView('front');
 $('#anatomy-title').textContent=system==='heart'?'Heart · listening areas':'Lungs · anterior and posterior fields';
 $('#system-note').textContent=system==='heart'?'CARDIAC AUSCULTATION · FIVE STANDARD AREAS':'RESPIRATORY AUSCULTATION · BILATERAL FRONT / BACK FIELDS';
 renderPointButtons();updatePoint(state.point,true);renderTree();updateAudioUI();
 
}
function isPlaybackOnlyVariant(item){
 if(state.system==='lung')return false;
 const source=[item.variant,item.sourceTitle,item.path].filter(Boolean).join(' ').toLowerCase();
 return /half[\s_-]*speed/.test(source)||/(^|[\s_-])slow([\s_.-]|$)/.test(source);
}
function recordingType(item){
 const title=String(item.title||'');
 const category=String(item.category||'');
 const source=[item.kind,item.variant,item.sourceTitle,item.path].filter(Boolean).join(' ');
 if(/patient\s*0?2|patient 2 placement/i.test(source))return 'Patient Recording · Patient 02';
 if(/clinical recordings|clinical patient recording|patient recording|CirCor/i.test(category+' '+source))return 'Patient Recording';
 if(category==='Normal Heart Sounds'||category==='Normal breath sounds'||
    /normal heart sound|healthy bronchophony|healthy whispered pectoriloquy|s2\s*[-–]\s*physiological split/i.test(title)||
    /normal voice-transmission example/i.test(String(item.variant||'')))return 'Normal Recording';
 return 'Teaching Recording';
}
function meaningfulRecordingVariant(item){
 const v=String(item.variant||'').trim();
 if(/^(large defect|large secundum defect|rheumatic example|moderate murmur|mild lesion)$/i.test(v))return v;
 if(/half[\s_-]*speed/i.test(v))return 'Half speed';
 if(/^slow(?:\s+speed)?$/i.test(v))return 'Slow speed';
 return '';
}
function recordingPriority(item){
 const v=String(item.variant||'').toLowerCase();
 const p=String(item.path||'').toLowerCase();
 if(v==='normal speed')return 0;
 if(v==='patient recording'||v==='patient 2 recording'||v==='teaching sound'||v==='teaching recording')return 1;
 if(v==='standard recording'||v==='original file')return 2;
 if(/additional/.test(p)||/mp3 source|kbps/i.test(v))return 4;
 return 3;
}
function recordingButton(item,label,extraClass=''){
 const active=state.selected?.id===item.id?' active':'';
 return '<button class="recording-option '+extraClass+active+'" data-audio-id="'+item.id+'" aria-label="Play '+esc(item.title)+' — '+esc(label)+'"><span class="recording-play">▶</span><span class="recording-option-text">'+esc(label)+'</span></button>';
}
function renderRecordingChoices(rows){
 const usable=rows.filter(x=>!x.duplicateOf&&!isPlaybackOnlyVariant(x));
 const groups=new Map();
 for(const item of usable){
  const type=recordingType(item);
  if(!groups.has(type))groups.set(type,[]);
  groups.get(type).push(item);
 }
 const typeOrder=['Normal Recording','Teaching Recording','Patient Recording','Patient Recording · Patient 02'];
 let html='';
 for(const type of typeOrder){
  const group=groups.get(type);
  if(!group?.length)continue;
  group.sort((a,b)=>recordingPriority(a)-recordingPriority(b)||String(a.path||'').localeCompare(String(b.path||'')));
  const primary=group[0];
  const extras=group.slice(1);
  const primaryVariant=extras.length?meaningfulRecordingVariant(primary):'';
  html+=recordingButton(primary,type+(primaryVariant?' · '+primaryVariant:''));
  const meaningful=extras.filter(meaningfulRecordingVariant);
  const retained=extras.filter(x=>!meaningfulRecordingVariant(x));
  for(const item of meaningful)html+=recordingButton(item,type+' · '+meaningfulRecordingVariant(item),'recording-alternate');
  if(retained.length){
   html+='<details class="recording-alternates"><summary>Other '+esc(type.toLowerCase())+' sources ('+retained.length+')</summary><div>'+
    retained.map((item,i)=>recordingButton(item,'Additional '+type.toLowerCase()+' '+String(i+1).padStart(2,'0'),'recording-alternate')).join('')+
    '</div></details>';
  }
 }
 return html||'<span class="lung-muted">No playable recording is available.</span>';
}
function displaySoundTitle(title){
 const raw=String(title||'');
 if(/^Patient\s+0?\d+\s*-\s*/i.test(raw))return raw.replace(/^Patient\s+0?\d+\s*-\s*/i,'').trim();
 if(/^CirCor\s+\d+\s*-\s*/i.test(raw)){
  const parts=raw.replace(/^CirCor\s+\d+\s*-\s*/i,'').split(/\s+-\s*/);
  if(/^(Aortic|Mitral|Tricuspid|Pulmonary) Point$/i.test(parts.at(-1)||''))parts.pop();
  return parts.join(' · ');
 }
 if(/^KAUH\s+P\d+\s*-\s*/i.test(raw)){
  const parts=raw.replace(/^KAUH\s+P\d+\s*-\s*/i,'').split(/\s+-\s*/);
  if(/^(Anterior|Posterior)\b/i.test(parts.at(-1)||''))parts.pop();
  return parts.join(' · ');
 }
 if(/^Bronchial$/i.test(raw))return 'Bronchial breathing · normal over the trachea';
 return raw;
}
function heartSubgroupLabel(label){
 if(/^aortic valve$/i.test(label))return 'Aortic Valve Sounds';
 if(/^mitral valve$/i.test(label))return 'Mitral Valve Sounds';
 if(/^tricuspid valve$/i.test(label))return 'Tricuspid Valve Sounds';
 if(/^pulmonary valve$/i.test(label))return 'Pulmonary Valve Sounds';
 return label;
}
function heartMajor(sound){
 const item=sound.records[0]||{};
 const category=String(item.category||'');
 const title=String(sound.title||'');
 if(category==='Normal Heart Sounds'||/normal heart sound/i.test(title))return '01|Normal Heart Sounds';
 if(/S1-S4|Splitting|Prosthetic Valve Sounds/i.test(category)||/S[1-4]|opening snap|ejection click|mid-systolic click|gallop|split S1|split S2|loud S1/i.test(title))return '02|Added Heart Sounds';
 if(/Valvular Heart Disease|General Murmur Patterns|Innocent & Vascular Flow Murmurs|Clinical Murmur Cases/i.test(category)||/stenosis|regurgitation|murmur|ventricular septal defect|VSD|patent ductus arteriosus|PDA/i.test(title))return '03|Heart Murmurs';
 return '04|Other Cardiac Sounds';
}
function heartSubgroup(sound,major){
 const item=sound.records[0]||{};
 const category=String(item.category||'');
 const label=String(item.subgroup||'');
 const title=String(sound.title||'');
 if(major.startsWith('01'))return 'Normal cardiac cycle';
 if(major.startsWith('02')){
  if(/S1|S2|splitting/i.test(title)||/S1 and S2/i.test(label))return 'S1 and S2 patterns';
  if(/S3|S4|gallop/i.test(title)||/Gallops/i.test(label))return 'Gallops and extra heart sounds';
  if(/click|snap/i.test(title)||/clicks|snaps/i.test(label))return 'Clicks and opening snaps';
  if(/prosthetic/i.test(category))return 'Prosthetic valve sounds';
  return 'Other added sounds';
 }
 if(major.startsWith('03')){
  if(/clinical murmur/i.test(category))return 'Clinical patient phonocardiograms';
  if(/aortic/i.test(title+' '+label))return 'Aortic valve';
  if(/mitral/i.test(title+' '+label))return 'Mitral valve';
  if(/tricuspid/i.test(title+' '+label))return 'Tricuspid valve';
  if(/pulmonary|pulmonic/i.test(title+' '+label))return 'Pulmonary valve';
  if(/septal defect|VSD/i.test(title))return 'Septal defects';
  if(/ductus arteriosus|PDA/i.test(title))return 'Patent ductus arteriosus';
  return 'Other murmur patterns';
 }
 if(/Congenital & Structural/i.test(category))return 'Congenital and structural findings';
 if(/Postoperative & Palliated/i.test(category))return 'Postoperative and palliated cases';
 if(/Myocardial, Pericardial & Conduction/i.test(category))return 'Myocardial, pericardial and conduction findings';
 if(/Prosthetic Valve/i.test(category))return 'Prosthetic valve findings';
 if(/Korotkoff|Blood Pressure/i.test(category))return 'Blood pressure sounds';
 return category||label||'Other recordings';
}
function buildTree(items,query='',reviewItems=[]){
 const titleGroups=new Map();
 for(const item of items){
  if(!titleGroups.has(item.title))titleGroups.set(item.title,{title:item.title,records:[]});
  titleGroups.get(item.title).records.push(item);
 }
 const majors=new Map();
 for(const sound of titleGroups.values()){
  const major=heartMajor(sound);
  const subgroup=heartSubgroup(sound,major);
  if(!majors.has(major))majors.set(major,new Map());
  if(!majors.get(major).has(subgroup))majors.get(major).set(subgroup,[]);
  majors.get(major).get(subgroup).push(sound);
 }
 const renderSounds=sounds=>sounds.sort((a,b)=>a.title.localeCompare(b.title)).map(sound=>'<div class="tree-single-sound"><div class="tree-single-title">'+esc(displaySoundTitle(sound.title))+'</div><div class="tree-variants">'+renderRecordingChoices(sound.records)+'</div></div>').join('');
 let html='';
 for(const [major,subgroups] of [...majors.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
  const [number,title]=major.split('|');
  const open=Boolean(query);
  html+='<details class="tree-category heart-section"'+(open?' open':'')+'><summary><span class="heart-section-number">'+number+'</span><span class="tree-label">'+esc(title)+'</span></summary><div class="tree-level tree-sounds">';
  for(const [subgroup,sounds] of subgroups){
   html+='<section class="heart-subgroup"><h4>'+esc(heartSubgroupLabel(subgroup))+'</h4>'+renderSounds(sounds)+'</section>';
  }
  html+='</div></details>';
 }
 if(reviewItems.length){
  const grouped=new Map();
  for(const item of reviewItems){if(!grouped.has(item.title))grouped.set(item.title,[]);grouped.get(item.title).push(item);}
  const rows=[...grouped.entries()].map(([title,records])=>({title,records}));
  html+='<details class="tree-category unclassified-section"'+(query?' open':'')+'><summary><span class="heart-section-number">05</span><span class="tree-label">Unclassified Source Recordings</span></summary><div class="tree-level tree-sounds"><p class="unclassified-intro">Source annotations are unresolved. These recordings are retained separately and are not presented as confirmed findings.</p>'+renderSounds(rows)+'</div></details>';
 }
 return html;
}
function buildLungTree(items,query='',reviewItems=[]){
 const normalOrder=['Vesicular - Normal','Bronchovesicular','Bronchial'];
 const crackleOrder=['Fine Crackles','Coarse Crackles','Early Inspiratory Crackles','Late Inspiratory Crackles','High-Pitched Crackles','Low-Pitched Crackles'];
 const wheezeOrder=['Wheeze','Expiratory Wheeze','Monophonic Wheeze','Polyphonic Wheeze'];
 const otherOrder=['Rhonchi','Stridor','Pleural Friction Rub'];
 const voiceOrder=['Healthy Bronchophony','Abnormal Bronchophony','Egophony - A','Egophony - E','Healthy Whispered Pectoriloquy','Abnormal Whispered Pectoriloquy'];
 const orderBy=(list,rows)=>[...list.filter(t=>rows.some(x=>x.title===t)),...new Set(rows.map(x=>x.title).filter(t=>!list.includes(t)))];
 const soundCard=title=>{
  const rows=items.filter(x=>x.title===title);
  if(!rows.length)return '';
  return '<article class="lung-sound-card"><div class="lung-sound-title"><strong>'+esc(displaySoundTitle(title))+'</strong></div><div class="tree-variants lung-recordings">'+renderRecordingChoices(rows)+'</div></article>';
 };
 const soundGroup=(label,titles,rows)=>{
  const present=orderBy(titles,rows);
  if(!present.length)return '';
  return '<section class="lung-subgroup">'+(label?'<h4>'+esc(label)+'</h4>':'')+'<div class="lung-sound-list">'+present.map(soundCard).join('')+'</div></section>';
 };
 const section=(number,title,subtitle,rows,body)=>{
  if(!rows.length)return '';
  const openAttr=query?' open':'';
  return '<details class="tree-category lung-section"'+openAttr+'><summary><span class="lung-section-number">'+number+'</span><span class="lung-section-copy"><strong>'+esc(title)+'</strong><small>'+esc(subtitle)+'</small></span></summary><div class="lung-section-body">'+body+'</div></details>';
 };
 const normal=items.filter(x=>x.category==='Normal breath sounds');
 const added=items.filter(x=>x.category==='Added lung sounds');
 const voice=items.filter(x=>x.category==='Voice transmission');
 const clinical=items.filter(x=>x.category==='Clinical recordings');
 let html='';
 html+=section('01','Normal Breath Sounds','Physiological reference patterns',normal,soundGroup('',normalOrder,normal));
 const crackles=added.filter(x=>crackleOrder.includes(x.title));
 const wheezes=added.filter(x=>wheezeOrder.includes(x.title));
 const reduced=added.filter(x=>x.title==='Vesicular - Diminished');
 const other=added.filter(x=>otherOrder.includes(x.title));
 const known=new Set([...crackleOrder,...wheezeOrder,...otherOrder,'Vesicular - Diminished']);
 const remaining=added.filter(x=>!known.has(x.title));
 const adventitious=soundGroup('CRACKLES',crackleOrder,crackles)+soundGroup('WHEEZES',wheezeOrder,wheezes)+soundGroup('REDUCED BREATH SOUNDS',['Vesicular - Diminished'],reduced)+soundGroup('OTHER ADDED SOUNDS',otherOrder,other)+(remaining.length?soundGroup('ADDITIONAL FINDINGS',[],remaining):'');
 html+=section('02','Added & Abnormal Breath Sounds','Adventitious sounds and reduced breath-sound findings',added,adventitious);
 const bronch=voice.filter(x=>/Bronchophony/.test(x.title));
 const ego=voice.filter(x=>/Egophony/.test(x.title));
 const whispered=voice.filter(x=>/Pectoriloquy/.test(x.title));
 const voiceBody=soundGroup('BRONCHOPHONY',[],bronch)+soundGroup('EGOPHONY',[],ego)+soundGroup('WHISPERED PECTORILOQUY',[],whispered);
 html+=section('03','Voice Transmission Tests','Compare spoken and whispered voice transmission',voice,voiceBody);
 const clinicalCards=clinical.slice().sort((a,b)=>{
  const id=x=>{const t=String(x.title||'').toUpperCase();const a=t.indexOf('KAUH P');if(a>=0)return Number(t.slice(a+6).split(/[^0-9]/)[0]||999);const b=t.indexOf('PATIENT ');return b>=0?Number(t.slice(b+8).split(/[^0-9]/)[0]||999):999;};
  return id(a)-id(b);
 }).map(item=>{
  const patient=item.title.match(/^Patient\s+0?(\d+)\s*-\s*(.+)$/i);
  let caseLabel='Clinical case',condition='',finding='';
  if(patient){caseLabel='Patient '+String(Number(patient[1])).padStart(2,'0');condition=patient[2];}
  else{
   const parts=item.title.replace(/^KAUH\s+P\d+\s*-\s*/i,'').split(/\s+-\s*/);
   condition=parts.shift()||'Recorded finding';
   finding=parts.filter(part=>!(/^(Anterior|Posterior)\b/i.test(part))).join(' · ');
  }
  return '<div class="lung-case-card"><span class="lung-case-id">'+esc(caseLabel)+'</span><span class="lung-case-copy"><strong>'+esc(condition)+'</strong>'+(finding?'<small>'+esc(finding)+'</small>':'')+'<small class="lung-case-type">Patient Recording</small></span><button class="lung-case-play" data-audio-id="'+item.id+'" aria-label="Play patient recording">▶</button></div>';
 }).join('');
 html+=section('04','Clinical Patient Cases','Patient recordings kept separate from teaching examples',clinical,'<div class="lung-case-list">'+clinicalCards+'</div>');
 if(reviewItems.length){
  const reviewCards=reviewItems.map(item=>'<div class="lung-case-card"><span class="lung-case-id">Unclassified</span><span class="lung-case-copy"><strong>'+esc(item.title)+'</strong><small>Source annotation not confirmed</small></span><button class="lung-case-play" data-audio-id="'+item.id+'" aria-label="Play unclassified source recording">▶</button></div>').join('');
  html+=section('05','Unclassified Source Recordings','Source labels retained separately from confirmed teaching groups',reviewItems,'<div class="lung-case-list">'+reviewCards+'</div>');
 }
 return html;
}
function renderTree(){
 const query=$('#sound-search').value.trim().toLowerCase();
 const sourceItems=state.items.filter(x=>x.system===state.system&&!x.duplicateOf&&!isPlaybackOnlyVariant(x));
 const matches=x=>!query||[x.title,x.category,x.subgroup,recordingType(x),meaningfulRecordingVariant(x)].join(' ').toLowerCase().includes(query);
 const reviewItems=sourceItems.filter(x=>x.category==='Needs Source Review'||x.reviewStatus==='Needs Source Review').filter(matches);
 const items=sourceItems.filter(x=>x.category!=='Needs Source Review'&&x.reviewStatus!=='Needs Source Review').filter(matches);
 if(state.system==='heart')items.sort((a,b)=>(a.categoryOrder??99)-(b.categoryOrder??99)||String(a.title||'').localeCompare(String(b.title||'')));
 const total=[...items,...reviewItems];
 $('#category-tree').innerHTML=total.length?(state.system==='lung'?buildLungTree(items,query,reviewItems):buildTree(items,query,reviewItems)):'';
 $('#no-results').hidden=total.length>0;
 const sounds=[...new Set(total.map(x=>x.title))];
 $('#visible-count').textContent=sounds.length+' sounds';
 $('#category-tree').querySelectorAll('[data-audio-id]').forEach(b=>b.addEventListener('click',()=>selectRecording(b.dataset.audioId)));
}
function showSelection(item){
 const guide=getTeachingGuide(item)||{};
 const link=getClinicalLink(item);
 const p=pointById(link.point);
 $('#learning-card').hidden=false;
 $('#learning-title').textContent=displaySoundTitle(item.title);
 $('#learning-quick').textContent=guide.definition;
 $('#learning-timing').textContent=guide.timing;
 $('#learning-best').textContent=link.site;
 $('#learning-piece').textContent=item.piece||(/mitral stenosis|opening snap|S3|S4/i.test(item.title)?'Bell · light pressure':'Diaphragm');
 $('#learning-anatomy-title').textContent=link.source;
 $('#learning-anatomy-text').textContent=link.anatomyNote;
 $('#learning-listening-site').textContent=link.site;
 $('#learning-radiation').textContent=link.radiation;
 const fields=[
  ['Sound mechanism',guide.mechanism],
  ['Causes',guide.causes],
  ['Associated conditions & clues',guide.associations],
  ['Differential diagnosis',guide.ddx],
  ['Clinical examination',guide.exam]
 ];
 $('#learning-content').innerHTML='<div class="guide-grid">'+fields.map(([label,value])=>'<section class="guide-section"><h5>'+esc(label)+'</h5><p>'+esc(value)+'</p></section>').join('')+'</div>';
 $('#learning-clinical-context').textContent=item.context||guide.clinical||'Correlate the recording with the clinical history and examination. A sound label alone does not establish a diagnosis.';
 $('#go-to-point').disabled=link.focus==='none'&&!p;
 $('#go-to-point').textContent=p?'Move stethoscope to best listening site ↗':'Highlight anatomical region ↗';
 $('#go-to-point').onclick=()=>{
  if(p){if(p.system!==state.system)setSystem(p.system);updatePoint(p.id);}
  scene?.setTeachingFocus(link.focus);
 };
 scene?.setTeachingFocus(link.focus);
 $('#selected-path').textContent=item.path;
 const sourceFiles=state.items.filter(x=>x.system===item.system&&x.title===item.title&&x.id!==item.id);
 $('#duplicate-source-wrap').hidden=sourceFiles.length===0;
 $('#duplicate-source-list').innerHTML=sourceFiles.map(x=>'<code>'+esc(x.sourceTitle||x.variant||'Additional source')+' · '+esc(x.path)+'</code>').join('');
 if(item.path.includes('CirCor')){
  $('#selected-source').innerHTML='Oliveira et al. · CirCor DigiScope Phonocardiogram Dataset · PhysioNet v1.0.3 (2022) · DOI 10.13026/tshs-mw03 · <a href="https://physionet.org/content/circor-heart-sound/1.0.3/" target="_blank" rel="noopener">Dataset</a> · ODC-By v1.0. Filename labels describe acoustic annotations and listening point, not a definitive valve diagnosis.';
 }else if(item.path.includes('KAUH')){
  $('#selected-source').innerHTML='Fraiwan et al. · Mendeley Data v3 (2021) · DOI 10.17632/jwyy9np4gv.3 · <a href="https://data.mendeley.com/datasets/jwyy9np4gv/3" target="_blank" rel="noopener">Dataset</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Labels follow the source annotation.';
 }else{
  $('#selected-source').textContent='Inherited library recording. The source label is preserved; the original publisher and redistribution permission have not been independently verified.';
 }
}async function preloadSelected(item){
 const token=state.loadToken;
 try{
  $('#sound-status').textContent='Loading audio preview…';
  const buffer=await sound.load('user:'+item.path);
  if(token!==state.loadToken||state.selected?.id!==item.id)return;
  sound.buffer=buffer;sound.normalization=1;state.waveElapsed=0;state.waveStarted=false;
  $('#play').disabled=false;
  $('#wave-placeholder').hidden=false;$('#wave-placeholder').textContent='Start audio';
  $('#sound-status').textContent='AUDIO READY · '+buffer.duration.toFixed(1)+' SEC';
  drawWave();
 }catch(error){
  if(token!==state.loadToken||state.selected?.id!==item.id)return;
  sound.buffer=null;$('#play').disabled=true;
  $('#wave-placeholder').hidden=false;
  $('#wave-placeholder').textContent='Audio could not be loaded';
  $('#sound-status').textContent='AUDIO LOAD FAILED';
  console.error('Audio preview failed:',item.path,error);
  toast('Could not load this recording. Check the local audio file and try again.');
 }
}
function selectRecording(id){
 const item=state.items.find(x=>x.id===id);if(!item)return;
 if(item.system!==state.system)setSystem(item.system);
 state.loadToken++;sound.pause();sound.buffer=null;state.playing=false;state.waveElapsed=0;state.waveStarted=false;state.selected=item;
 const link=getClinicalLink(item);const mapped=pointById(link.point);
 if(mapped)updatePoint(mapped.id);else applySpatialIntensity();
 scene?.setTeachingFocus(link.focus);
 showSelection(item);
 $('#play-title').textContent=displaySoundTitle(item.title);$('#play-subtitle').textContent=recordingType(item);$('#audio-type').textContent=recordingType(item);
 $('#play').disabled=true;$('#wave-placeholder').hidden=false;$('#wave-placeholder').textContent='Loading audio preview…';$('#sound-status').textContent='Loading audio preview…';
 $('#category-tree').querySelectorAll('[data-audio-id]').forEach(b=>b.classList.toggle('active',b.dataset.audioId===id));
 updateAudioUI();preloadSelected(item);
 
}
function exitQuiz(){
 state.quizMode=false;sound.pause();state.playing=false;
 $('#quiz-panel').hidden=true;$('#search-wrap').hidden=false;
 $('#category-tree').hidden=false;$('#no-results').hidden=false;
 renderTree();if(state.selected)showSelection(state.selected);updateAudioUI();
}
function startQuiz(){
 state.quizMode=true;state.quiz.round=0;state.quiz.score=0;
 $('#search-wrap').hidden=true;$('#category-tree').hidden=true;$('#no-results').hidden=true;
 $('#learning-card').hidden=true;$('#quiz-panel').hidden=false;
 nextQuiz();
}
function nextQuiz(){
 sound.pause();sound.buffer=null;state.playing=false;state.waveElapsed=0;state.waveStarted=false;state.quiz.answered=false;state.quiz.round++;
 const pool=state.items.filter(x=>x.system===state.system&&!x.duplicateOf&&!isPlaybackOnlyVariant(x));
 const titles=[...new Set(pool.map(x=>x.title))];
 if(titles.length<4){toast('Not enough distinct recordings for a quiz in this section.');exitQuiz();return;}
 const targetTitle=titles[Math.floor(Math.random()*titles.length)];
 const targetFiles=pool.filter(x=>x.title===targetTitle);
 const target=targetFiles[Math.floor(Math.random()*targetFiles.length)];
 const others=titles.filter(t=>t!==targetTitle).sort(()=>Math.random()-.5).slice(0,3);
 state.quiz.target=target;state.quiz.options=[targetTitle,...others].sort(()=>Math.random()-.5);
 state.selected=target;
 if(target.point&&pointById(target.point))updatePoint(target.point);else updatePoint(state.system==='heart'?'mitral':'lung-right');
 $('#quiz-round').textContent='QUESTION '+String(state.quiz.round).padStart(2,'0');
 $('#quiz-score').textContent=state.quiz.score+' correct';
 $('#quiz-feedback').textContent='';$('#quiz-next').hidden=true;
 $('#quiz-options').innerHTML=state.quiz.options.map((t,i)=>'<button class="quiz-option" data-quiz-answer="'+i+'">'+esc(t)+'</button>').join('');
 $('#quiz-options').querySelectorAll('[data-quiz-answer]').forEach(b=>b.addEventListener('click',()=>answerQuiz(+b.dataset.quizAnswer)));
 $('#selected-path').textContent='Hidden during quiz';$('#selected-source').textContent='Answer the question to reveal the source details.';
 $('#learning-card').hidden=true;$('#go-to-point').disabled=true;
 $('#play-title').textContent='Mystery recording';$('#play-subtitle').textContent='Listening quiz · question '+state.quiz.round;
 $('#audio-type').textContent='Quiz recording';$('#play').disabled=false;$('#wave-placeholder').hidden=false;$('#wave-placeholder').textContent='Press play to listen';
 $('#sound-status').textContent='Ready to listen';
 playSelected();
}
function answerQuiz(index){
 if(state.quiz.answered)return;state.quiz.answered=true;
 const answer=state.quiz.options[index],correct=answer===state.quiz.target.title;
 if(correct)state.quiz.score++;
 $('#quiz-options').querySelectorAll('[data-quiz-answer]').forEach((b,i)=>{
  b.disabled=true;b.classList.toggle('correct',state.quiz.options[i]===state.quiz.target.title);
  b.classList.toggle('wrong',i===index&&!correct);
 });
 $('#quiz-feedback').textContent=correct?'Correct. '+state.quiz.target.title:'Not quite. The recording was '+state.quiz.target.title+'.';
 $('#quiz-score').textContent=state.quiz.score+' correct';
 $('#quiz-next').hidden=false;
 showSelection(state.quiz.target);
 $('#play-title').textContent=state.quiz.target.title;$('#play-subtitle').textContent=recordingType(state.quiz.target);
}
async function playSelected(){
 if(!state.selected)return;
 try{$('#play').disabled=true;$('#sound-status').textContent='Loading recording…';const ok=await sound.play('user:'+state.selected.path);state.playing=!!ok;state.waveStarted=!!ok;state.waveElapsed=0;updateAudioUI();}
 catch(e){state.playing=false;state.waveStarted=false;$('#sound-status').textContent='Could not load audio';toast('The selected audio could not be decoded. Check that the MP3 file is present.');console.error(e);}
 finally{$('#play').disabled=!state.selected;}
}
function updateAudioUI(){
 $('#play-icon').textContent=state.playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',state.playing?'Pause audio':'Play audio');
 $('#sound-status').textContent=state.playing?'PLAYING · '+sound.playbackRate+'×':sound.buffer?'AUDIO READY · '+sound.buffer.duration.toFixed(1)+' SEC':state.selected?'Loading audio preview…':'Ready to listen';
 const showStart=!!sound.buffer&&!state.waveStarted;
 $('#wave-placeholder').hidden=!!sound.buffer&&state.waveStarted;
 if(showStart)$('#wave-placeholder').textContent='Start audio';
}
function changeView(view){
 state.view=view;setPressed('[data-view]','view',view);$('#orientation-label').textContent=view==='back'?'BACK VIEW':'FRONT VIEW';
 $('#anatomical-side').innerHTML=view==='back'?'L <span>·</span> R':'R <span>·</span> L';
 if(scene)scene.setView(view);
 if(state.system==='lung'){const next=pointForView(state.point,view);if(next!==state.point)updatePoint(next,true);}
}
function drawWave(){
 const canvas=$('#waveform'),ctx=canvas.getContext('2d'),ratio=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h)return;
 if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
 ctx.strokeStyle='rgba(181,197,187,.14)';ctx.lineWidth=1;ctx.beginPath();
 for(let x=0;x<w;x+=w/10){ctx.moveTo(x,0);ctx.lineTo(x,h);}ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
 const buffer=sound.buffer;if(!buffer||!state.waveStarted)return;
 const data=buffer.getChannelData(0),duration=buffer.duration,sr=buffer.sampleRate,span=4;
 if(sound.playing&&sound.context)state.waveElapsed=Math.max(0,(sound.context.currentTime-sound.startedAt)*sound.playbackRate);
 const elapsed=state.waveElapsed;if(elapsed<=0)return;
 const samplesPerPixel=Math.max(1,Math.ceil(sr*span/w));
 ctx.strokeStyle='#df9a77';ctx.lineWidth=1.25;ctx.lineCap='round';
 for(let x=0;x<w;x+=1.5){
  const binStart=elapsed-span+span*x/w,binEnd=binStart+span/w;
  if(binEnd<=0)continue;
  const visibleStart=Math.max(0,binStart),visibleDuration=Math.max(0,binEnd-visibleStart);
  const firstSample=Math.floor(((visibleStart%duration)+duration)%duration*sr)%data.length;
  const count=Math.max(1,Math.min(samplesPerPixel,Math.ceil(visibleDuration*sr)));
  let min=0,max=0;
  for(let i=0;i<count;i+=3){const v=data[(firstSample+i)%data.length]*(sound.normalization||1)*sound.volume*(sound.strength||1);min=Math.min(min,v);max=Math.max(max,v);}
  const top=h/2-Math.min(h*.46,max*h*1.4),bottom=h/2-Math.max(-h*.46,min*h*1.4);
  ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,Math.max(top+.7,bottom));ctx.stroke();
 }
}
function animateWave(){if(!mounted)return;if(waveFrame++%2===0)drawWave();animationFrame=requestAnimationFrame(animateWave);}
async function init(){
 const response=await fetch(new URL('audio-catalog.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw new Error('Audio catalogue is missing');
 if(!mounted)return;
 state.items=await response.json();
 const countSounds=system=>new Set(state.items.filter(x=>x.system===system&&!x.duplicateOf&&!isPlaybackOnlyVariant(x)).map(x=>x.title)).size;
 const heart=countSounds('heart'),lung=countSounds('lung');
 $('#heart-count').textContent=heart;$('#lung-count').textContent=lung;$('#total-count').textContent=heart+lung;
 setPressed('[data-system]','system',state.system);
 $('#anatomy-title').textContent=state.system==='heart'?'Heart · listening areas':'Lungs · anterior and posterior fields';
 $('#system-note').textContent=state.system==='heart'?'CARDIAC AUSCULTATION · FIVE STANDARD AREAS':'RESPIRATORY AUSCULTATION · BILATERAL FRONT / BACK FIELDS';
 renderPointButtons();renderTree();updatePoint(state.point,true);
 $('#sound-search').addEventListener('input',renderTree);
 $('#sound-search').addEventListener('keydown',e=>{if(e.key==='Escape'){e.currentTarget.value='';renderTree();}});
 $('#quiz-start').addEventListener('click',startQuiz);$('#quiz-exit').addEventListener('click',exitQuiz);$('#quiz-next').addEventListener('click',nextQuiz);
 root.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA/.test(e.target.tagName)&&!state.quizMode){e.preventDefault();$('#sound-search').focus();}});
 root.querySelectorAll('[data-system]').forEach(b=>b.addEventListener('click',()=>setSystem(b.dataset.system)));
 root.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>changeView(b.dataset.view)));
 root.querySelectorAll('[data-piece]').forEach(b=>b.addEventListener('click',()=>{state.piece=b.dataset.piece;sound.setPiece(state.piece);setPressed('[data-piece]','piece',state.piece);}));
 $('#play').addEventListener('click',()=>{if(sound.playing){if(sound.context)state.waveElapsed=Math.max(0,(sound.context.currentTime-sound.startedAt)*sound.playbackRate);sound.pause();state.playing=false;updateAudioUI();}else playSelected();});
 $('#volume').addEventListener('input',e=>sound.setVolume(+e.target.value/100));
 $('#playback-speed').addEventListener('change',e=>{sound.setPlaybackRate(+e.target.value);updateAudioUI();});
 $('#reset-view').addEventListener('click',()=>{scene?.reset();changeView('front');});
 $('#zoom-in').addEventListener('click',()=>scene?.zoom(.85));$('#zoom-out').addEventListener('click',()=>scene?.zoom(1.15));
 $('#xray').addEventListener('change',e=>scene?.setXray(e.target.checked));
 $('#bone-opacity').addEventListener('input',e=>scene?.setBoneOpacity(+e.target.value/100));
 $('#show-points').addEventListener('change',e=>scene?.showPoints(e.target.checked));
 scene=new ThoraxScene($('#scene'),$('#point-labels'),{
  onPoint:id=>updatePoint(id,true),
  onView:view=>{state.view=view;setPressed('[data-view]','view',view);$('#orientation-label').textContent=view==='back'?'BACK VIEW':'FRONT VIEW';$('#anatomical-side').textContent=view==='back'?'L · R':'R · L';},
  onProgress:(received,total)=>{const p=$('#anatomy-progress');if(p)p.value=Math.round(received/total*100);},
  onReady:()=>{$('#model-loading').hidden=true;},
  onError:error=>{$('#model-loading').innerHTML='<strong>3D anatomy unavailable</strong><span>The sound library remains available. Reopen this section to retry.</span>';console.warn(error);}
 },{
  system:state.system,
  base:new URL('assets/models/thorax',import.meta.url).pathname,
  detailBase:new URL('assets/models/valve-heart',import.meta.url).pathname,
  distance:6.25,centerY:.28
 });
 scene.setSystem(state.system);scene.setXray($('#xray').checked);scene.setBoneOpacity(+$('#bone-opacity').value/100);scene.showPoints($('#show-points').checked);scene.setView('front');scene.load();
 animationFrame=requestAnimationFrame(animateWave);
}
init().catch(error=>{if(!mounted)return;console.error(error);$('#category-tree').innerHTML='<p class="no-results">The audio catalogue could not be loaded. Check the installed package.</p>';toast('Library data could not be loaded.');});
 return function dispose(){mounted=false;cancelAnimationFrame(animationFrame);sound.pause();if(scene)scene.dispose();};

}
