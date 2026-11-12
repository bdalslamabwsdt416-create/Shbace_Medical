(function(){
'use strict';
var EXAM_KEY='shbace_exam_goal_planner_v1';
var editingExamId=null;
function safeRead(){
  try{var raw=JSON.parse(localStorage.getItem(EXAM_KEY)||'[]');return Array.isArray(raw)?raw.filter(function(x){return x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.date==='string'&&x.date.length===10&&x.date.charAt(4)==='-'&&x.date.charAt(7)==='-'&&Number.isInteger(Number(x.questions))&&Number(x.questions)>0}):[]}
  catch(_){return []}
}
function safeWrite(items){
  try{localStorage.setItem(EXAM_KEY,JSON.stringify(items));return true}
  catch(e){try{if(typeof toast==='function')toast('Could not save your exam plan. Device storage may be full.')}catch(__){}return false}
}
function escText(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});
}
function localISO(d){
  d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dayDiff(date){
  var p=String(date||'').split('-').map(Number),n=localISO().split('-').map(Number);
  if(p.length!==3||p.some(function(v){return !Number.isFinite(v)}))return null;
  return Math.round((Date.UTC(p[0],p[1]-1,p[2])-Date.UTC(n[0],n[1]-1,n[2]))/86400000);
}
function questionBankCount(){
  try{var a=window.__shbQuestionIndex&&window.__shbQuestionIndex();if(Array.isArray(a)&&a.length)return a.length}catch(_){}
  return 1718;
}
function examMetrics(item){
  var diff=dayDiff(item.date),days=diff===null?0:diff>=0?diff+1:0;
  return {diff:diff,days:days,daily:days?Math.ceil(Number(item.questions)/days):0};
}
function examDateLabel(value){
  try{return new Date(value+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'})}catch(_){return value}
}
function examPlannerView(){
  var items=safeRead().sort(function(a,b){return a.date.localeCompare(b.date)});
  var bankCount=questionBankCount(),today=localISO(),active=items.filter(function(x){return dayDiff(x.date)>=0});
  var combined=active.reduce(function(n,x){return n+examMetrics(x).daily},0);
  var cards=items.length?items.map(function(item){
    var m=examMetrics(item),status=m.diff<0?'Exam date passed':m.diff===0?'Exam day':m.days+' study days left';
    var target=m.daily?m.daily.toLocaleString()+' questions/day':'—';
    return '<article class="card setcard egp-exam-card">'+
      '<div class="egp-exam-top"><div><span class="egp-date">'+escText(examDateLabel(item.date))+'</span><h3>'+escText(item.name)+'</h3></div><span class="egp-days'+(m.diff<0?' overdue':'')+'">'+escText(status)+'</span></div>'+
      '<div class="egp-exam-stats"><div><b>'+Number(item.questions).toLocaleString()+'</b><small>Questions to cover</small></div><div><b>'+target+'</b><small>Daily target</small></div></div>'+
      '<div class="egp-exam-actions"><button type="button" class="btn" onclick="shbExamEdit(&quot;'+escText(item.id)+'&quot;)">Edit</button><button type="button" class="btn danger" onclick="shbExamDelete(&quot;'+escText(item.id)+'&quot;)">Delete</button></div>'+
    '</article>';
  }).join(''):'<div class="card setcard egp-empty"><b>No exams added yet</b><p class="meta">Add your first exam date. You can create as many exams as you need, each with its own name and question target.</p></div>';
  return appHeader('Exam Goal Planner')+
    '<div class="rs shb-exam-planner">'+
      '<div class="egp-kicker">SHBACE MEDICAL · STUDY PLANNING</div><h1>Exam Goal Planner</h1>'+
      '<p class="sub">Set each exam date and turn the remaining workload into a practical daily question target.</p>'+
      '<div class="egp-overview">'+
        '<div class="egp-overview-item"><b>'+items.length+'</b><small>Exams planned</small></div>'+
        '<div class="egp-overview-item"><b>'+combined.toLocaleString()+'</b><small>Combined questions/day</small></div>'+
        '<div class="egp-overview-item"><b>'+bankCount.toLocaleString()+'</b><small>Questions in this bank</small></div>'+
      '</div>'+
      '<section class="card setcard egp-form"><div class="egp-form-head"><h2 id="egpFormTitle">Add an exam</h2><p class="meta">Use any exam name. There are no fixed exam categories.</p></div>'+
        '<label for="shbExamName">Exam name</label><input class="field" id="shbExamName" type="text" maxlength="90" placeholder="e.g. Pediatrics Final Exam" autocomplete="off">'+
        '<label for="shbExamDate">Exam date</label><input class="field" id="shbExamDate" type="date" min="'+today+'">'+
        '<label for="shbExamQuestions">Questions to cover</label><input class="field" id="shbExamQuestions" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="'+bankCount+'">'+
        '<small class="egp-help">The default is the full available question bank. Change it to match the topics you intend to finish before this exam.</small>'+
        '<div class="egp-form-actions"><button type="button" class="btn primary" id="shbExamSubmit" onclick="shbExamSave()">Add exam</button><button type="button" class="btn" id="shbExamCancel" onclick="shbExamCancel()" hidden>Cancel edit</button></div>'+
      '</section>'+
      '<div class="egp-list-heading"><div><h2>Your exams</h2><p class="meta">Each exam is calculated separately. Daily targets include today and the exam date.</p></div></div>'+
      '<div class="egp-exam-list">'+cards+'</div>'+
      '<p class="egp-storage-note">Your plan is saved locally on this device. Export a student backup from Settings before changing or clearing browser data.</p>'+
    '</div>';
}
function resetExamForm(){
  editingExamId=null;
  var name=document.getElementById('shbExamName'),date=document.getElementById('shbExamDate'),questions=document.getElementById('shbExamQuestions');
  if(name)name.value='';if(date)date.value='';if(questions)questions.value=String(questionBankCount());
  var submit=document.getElementById('shbExamSubmit'),cancel=document.getElementById('shbExamCancel'),title=document.getElementById('egpFormTitle');
  if(submit)submit.textContent='Add exam';if(cancel)cancel.hidden=true;if(title)title.textContent='Add an exam';
}
window.shbExamSave=function(){
  var nameEl=document.getElementById('shbExamName'),dateEl=document.getElementById('shbExamDate'),qEl=document.getElementById('shbExamQuestions');
  if(!nameEl||!dateEl||!qEl)return;
  var name=nameEl.value.trim(),date=dateEl.value,questions=Number(qEl.value),diff=dayDiff(date);
  if(!name){nameEl.focus();if(typeof toast==='function')toast('Enter a name for this exam.');return}
  if(!date||diff===null){dateEl.focus();if(typeof toast==='function')toast('Choose a valid exam date.');return}
  if(diff<0){dateEl.focus();if(typeof toast==='function')toast('The exam date must be today or in the future.');return}
  if(!Number.isInteger(questions)||questions<1||questions>1000000){qEl.focus();if(typeof toast==='function')toast('Enter a whole-number question target between 1 and 1,000,000.');return}
  var items=safeRead(),at=items.findIndex(function(x){return x.id===editingExamId}),old=at>=0?items[at]:null;
  var item={id:old?old.id:'exam_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),name:name,date:date,questions:questions,createdAt:old&&old.createdAt||Date.now(),updatedAt:Date.now()};
  if(at>=0)items[at]=item;else items.push(item);
  if(!safeWrite(items))return;
  resetExamForm();if(typeof renderAppDemo==='function')renderAppDemo();
  if(typeof toast==='function')toast(at>=0?'Exam updated.':'Exam added to your plan.');
};
window.shbExamEdit=function(id){
  var item=safeRead().find(function(x){return x.id===String(id)});if(!item)return;
  editingExamId=item.id;
  var name=document.getElementById('shbExamName'),date=document.getElementById('shbExamDate'),questions=document.getElementById('shbExamQuestions');
  if(!name||!date||!questions)return;
  name.value=item.name;date.value=item.date;questions.value=String(item.questions);
  var submit=document.getElementById('shbExamSubmit'),cancel=document.getElementById('shbExamCancel'),title=document.getElementById('egpFormTitle');
  if(submit)submit.textContent='Save changes';if(cancel)cancel.hidden=false;if(title)title.textContent='Edit exam';
  var root=document.querySelector('#phoneContent .shb-exam-planner');if(root)root.scrollIntoView({behavior:'smooth',block:'start'});name.focus();
};
window.shbExamCancel=function(){resetExamForm()};
window.shbExamDelete=function(id){
  var items=safeRead(),next=items.filter(function(x){return x.id!==String(id)});
  if(next.length===items.length)return;
  if(!window.confirm('Delete this exam from your study plan?'))return;
  if(!safeWrite(next))return;
  if(editingExamId===String(id))editingExamId=null;
  if(typeof renderAppDemo==='function')renderAppDemo();
  if(typeof toast==='function')toast('Exam removed from your plan.');
};
if(typeof window.__shbRegisterPage==='function')window.__shbRegisterPage('examplanner',examPlannerView,'subjects');
try{
  if(typeof DR2!=='undefined'&&Array.isArray(DR2)){
    var menuGroup=DR2.find(function(g){return /^(progress|analytics|analytics & topics|learning)$/i.test(String(g&&g[0]||''))});
    if(!menuGroup)menuGroup=DR2.find(function(g){return /analytics|learning/i.test(String(g&&g[0]||''))});
    if(!menuGroup){menuGroup=['Planning',[]];DR2.push(menuGroup)}
    if(!menuGroup[1].some(function(it){return it&&it[1]==='examplanner'})){
      menuGroup[1].push(['Exam Goal Planner','examplanner','<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>','']);
    }
  }
}catch(e){console.warn('Exam planner menu registration failed:',e)}

/* Clear Settings hierarchy: keep existing controls and stores, only change their visual order. */
var settingsBusy=false,settingsQueued=false;
function getSettingsRoot(){
  var root=document.querySelector('#phoneContent .rs'),h=root&&root.querySelector('h1');
  return root&&h&&/^settings$/i.test((h.textContent||'').trim())?root:null;
}
function makeSettingZone(order,id,title,description){
  var zone=document.createElement('section');zone.className='shb-settings-section';zone.setAttribute('data-shb-settings-zone',id);
  zone.innerHTML='<header><h2>'+title+'</h2><p>'+description+'</p></header><div class="shb-settings-items" data-shb-settings-items="'+id+'"></div>';
  order.appendChild(zone);return zone.querySelector('.shb-settings-items');
}
function findSettingCard(root,title){
  var cards=Array.prototype.slice.call(root.querySelectorAll('.card.setcard'));
  return cards.find(function(card){var h=card.querySelector('h3');return h&&(h.textContent||'').trim().toLowerCase()===title.toLowerCase()})||null;
}
function organizeSettings(){
  if(settingsBusy)return;
  var root=getSettingsRoot();if(!root)return;
  settingsBusy=true;
  try{
    var order=root.querySelector('.shb-settings-order');
    if(!order){
      order=document.createElement('div');order.className='shb-settings-order';root.appendChild(order);
      makeSettingZone(order,'appearance','Appearance & reading','Theme, text size, doctor character and question-reading voice.');
      makeSettingZone(order,'notifications','Study notifications','Choose which study events can notify you.');
      makeSettingZone(order,'experience','Onboarding & experience','Control the welcome screens and app presentation.');
      makeSettingZone(order,'data','Backup & data','Export or restore the student information saved on this device.');
      makeSettingZone(order,'progress','Progress management','Reset study progress only when needed. This section stays at the bottom.');
    }
    var target=function(id){return order.querySelector('[data-shb-settings-items="'+id+'"]')};
    var appearance=findSettingCard(root,'Appearance'),onboarding=findSettingCard(root,'Onboarding');
    var progress=findSettingCard(root,'Study progress'),backup=findSettingCard(root,'Student data backup');
    var notification=root.querySelector('.u10-settings-card'),voice=root.querySelector('#shbUnifiedVoiceSettings'),file=root.querySelector('#bkFile');
    if(appearance&&appearance.parentElement!==target('appearance'))target('appearance').appendChild(appearance);
    if(voice&&voice.parentElement!==target('appearance'))target('appearance').appendChild(voice);
    if(notification&&notification.parentElement!==target('notifications'))target('notifications').appendChild(notification);
    if(onboarding&&onboarding.parentElement!==target('experience'))target('experience').appendChild(onboarding);
    if(file&&file.parentElement!==target('data'))target('data').appendChild(file);
    if(backup&&backup.parentElement!==target('data'))target('data').appendChild(backup);
    if(progress&&progress.parentElement!==target('progress'))target('progress').appendChild(progress);
  }catch(e){console.warn('Settings organization skipped:',e)}
  settingsBusy=false;
}
function queueSettingsOrganization(){
  if(settingsQueued)return;settingsQueued=true;
  requestAnimationFrame(function(){settingsQueued=false;organizeSettings()});
}

/* Smart Review: fixed recommended path plus multi-level specialty/system/topic selection. */
function srApi(){
  try{return typeof window.__sr3x==='function'?window.__sr3x():null}catch(_){return null}
}
function poolSize(api,id){
  try{var p=api.srPool(id);return p.due.length+p.weak.length+p.fresh.length}catch(_){return 0}
}
function topicTargets(api,spec,system){
  return (api.SRT||[]).filter(function(t){
    return String(t.spec)===String(spec)&&(system==null||String(t.sy||'Other / Mixed Questions')===String(system));
  }).map(function(t){return {id:Number(t.id),available:poolSize(api,Number(t.id))}}).filter(function(t){return t.available>0});
}
function srBulkSelect(spec,system){
  var api=srApi(),ui=api&&api.SRUI;if(!api||!ui)return;
  var targets=topicTargets(api,spec,system);if(!targets.length){if(typeof toast==='function')toast('No available questions in this selection.');return}
  var selected=Array.isArray(ui.selected)?ui.selected.slice():[],set=new Set(selected);
  var clear=targets.every(function(t){return set.has(t.id)});
  if(clear){
    targets.forEach(function(t){set.delete(t.id);if(ui.counts)delete ui.counts[t.id]});
  }else{
    targets.forEach(function(t){
      if(!set.has(t.id)){set.add(t.id);if(!ui.counts)ui.counts={};ui.counts[t.id]=Math.min(10,t.available)}
    });
  }
  ui.selected=Array.from(set);
  if(typeof renderAppDemo==='function')renderAppDemo();
}
window.shbSrBulkSelectSpecialty=function(spec){srBulkSelect(spec,null)};
window.shbSrBulkSelectSystem=function(spec,system){srBulkSelect(spec,system)};
function enhanceSmartReview(){
  var api=srApi();if(!api)return;
  var host=document.querySelector('#phoneContent'),hero=host&&host.querySelector('.sr3-builder-hero');
  if(hero&&!host.querySelector('[data-shb-smart-recommended]')){
    var p=api.srPool(null),avail=p.due.length+p.weak.length+p.fresh.length;
    var store=typeof window.__sr3==='function'?window.__sr3():{},size=Math.max(1,Number(store&&store.size)||15),count=Math.min(size,avail);
    var card=document.createElement('section');card.className='shb-smart-recommended';card.setAttribute('data-shb-smart-recommended','true');
    var detail='<span><b>'+p.due.length+'</b> due</span><span><b>'+p.weak.length+'</b> weak</span><span><b>'+p.fresh.length+'</b> new</span>';
    card.innerHTML='<div class="shb-sr-rec-copy"><span class="shb-sr-rec-kicker">ALWAYS AVAILABLE · SMART REVIEW</span><h3>Smart Recommended</h3><p>Start with an automatically balanced mix of due reviews, weaker questions and new questions from across your bank. This recommendation is always kept available.</p><div class="shb-sr-rec-stats">'+detail+'</div></div><button type="button" class="btn primary" '+(count?'':'disabled')+' onclick="srStart(null)">Start recommended · '+count+' question'+(count===1?'':'s')+'</button>';
    hero.insertAdjacentElement('afterend',card);
  }
  var groups=host?host.querySelectorAll('.sr3-grp[data-spec]'):[];
  Array.prototype.forEach.call(groups,function(section){
    var spec=section.getAttribute('data-spec'),head=section.querySelector(':scope > .sr3-gh'),body=section.querySelector(':scope > .sr3-gb');
    if(!head)return;
    if(!section.querySelector(':scope > .shb-sr-specialty-action')){
      var action=document.createElement('button');action.type='button';action.className='shb-sr-specialty-action';
      action.textContent='Select all topics';action.setAttribute('data-spec',spec);
      action.onclick=function(ev){ev.preventDefault();ev.stopPropagation();window.shbSrBulkSelectSpecialty(spec)};
      head.insertAdjacentElement('afterend',action);
    }
    if(!body||body.getAttribute('data-shb-system-groups')==='1')return;
    var cards=Array.prototype.slice.call(body.querySelectorAll(':scope > .sr3-pick-item'));
    if(!cards.length)return;
    var byId=new Map((api.SRT||[]).map(function(t){return [Number(t.id),t]})),sets=new Map();
    cards.forEach(function(card){
      var b=card.querySelector('[data-tid]'),id=Number(b&&b.getAttribute('data-tid')),t=byId.get(id),name=String(t&&t.sy||'Other / Mixed Questions');
      if(!sets.has(name))sets.set(name,[]);sets.get(name).push(card);
    });
    body.innerHTML='';
    sets.forEach(function(topicCards,name){
      var ids=topicCards.map(function(card){var b=card.querySelector('[data-tid]');return Number(b&&b.getAttribute('data-tid'))});
      var chosen=Array.isArray(api.SRUI&&api.SRUI.selected)?api.SRUI.selected:[];
      var targets=topicTargets(api,spec,name),all=targets.length>0&&targets.every(function(t){return chosen.includes(t.id)});
      var system=document.createElement('section');system.className='shb-sr-system';
      var bar=document.createElement('div');bar.className='shb-sr-system-head';
      var copy=document.createElement('div');copy.innerHTML='<b>'+escText(name)+'</b><small>'+ids.length+' topics</small>';
      var button=document.createElement('button');button.type='button';button.className='shb-sr-system-action';
      button.textContent=all?'Clear system':'Select system';button.onclick=function(ev){ev.preventDefault();ev.stopPropagation();window.shbSrBulkSelectSystem(spec,name)};
      bar.appendChild(copy);bar.appendChild(button);
      var list=document.createElement('div');list.className='shb-sr-system-topics';
      topicCards.forEach(function(card){list.appendChild(card)});
      system.appendChild(bar);system.appendChild(list);body.appendChild(system);
    });
    body.setAttribute('data-shb-system-groups','1');
    var allIds=topicTargets(api,spec,null).map(function(x){return x.id});
    var current=Array.isArray(api.SRUI&&api.SRUI.selected)?api.SRUI.selected:[];
    var action=section.querySelector(':scope > .shb-sr-specialty-action');
    if(action)action.textContent=allIds.length&&allIds.every(function(id){return current.includes(id)})?'Clear specialty':'Select all topics';
  });
}
var originalRender=window.renderAppDemo;
if(typeof originalRender==='function'&&!window.__shbUxEnhancementsInstalled){
  window.__shbUxEnhancementsInstalled=true;
  window.renderAppDemo=function(){
    var result=originalRender.apply(this,arguments);
    try{enhanceSmartReview()}catch(e){console.warn('Smart Review enhancement skipped:',e)}
    queueSettingsOrganization();
    return result;
  };
}
try{
  var mo=new MutationObserver(function(){queueSettingsOrganization()});
  if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true});
}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queueSettingsOrganization,{once:true});
queueSettingsOrganization();
})();