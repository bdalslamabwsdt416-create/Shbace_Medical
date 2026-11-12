/* SHBACE Medical v1.3 · Computer PWA planner, drawer and navigation refinement. */
/* Release artifact retry: static artifact names; the previous Gradle compile completed successfully. */
(function(){
'use strict';
function computerPwa(){try{return !!window.__SHBACE_CHROME_COMPUTER__&&!window.Capacitor&&!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')}catch(_){return false}}
if(!computerPwa())return;
var GOALS='shbace_exam_goals_v2',LEGACY='shbace_exam_goal_v1',HISTORY='shbace_exam_goal_history_v1',
 ACTIVITY='shbace_study_activity_days_v1',REMINDER_IDS='shbace_exam_goal_notification_ids_v1',DAY=86400000;
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var pad=function(n){return String(n).padStart(2,'0')};
function jsonRead(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(_){return d}}
function jsonWrite(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}}
function dateKey(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function dayNo(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/DAY):NaN}
function today(){return dateKey(new Date())}
function fromDay(n){var d=new Date(n*DAY);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
function localDate(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));return m?new Date(+m[1],+m[2]-1,+m[3],0,0,0,0):null}
function makeExam(name,date){return {id:'eg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:name||'Written paper',date:date||'',bufferDays:3,restDaysPerWeek:1,reminderEnabled:false,reminderTime:'19:30'}}
function goals(){
 var a=jsonRead(GOALS,null);
 if(Array.isArray(a))return a.filter(function(x){return x&&typeof x==='object'}).map(function(x){return {
  id:String(x.id||('eg-'+Math.random().toString(36).slice(2))),name:String(x.name||'Written paper'),
  date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')?x.date:'',
  bufferDays:Math.max(0,Math.min(30,Math.round(Number.isFinite(+x.bufferDays)?+x.bufferDays:3))),
  restDaysPerWeek:Math.max(0,Math.min(3,Math.round(Number.isFinite(+x.restDaysPerWeek)?+x.restDaysPerWeek:1))),
  reminderEnabled:!!x.reminderEnabled,reminderTime:/^\d{2}:\d{2}$/.test(x.reminderTime||'')?x.reminderTime:'19:30'
 }});
 var old='';try{old=localStorage.getItem(LEGACY)||''}catch(_){}
 var first=makeExam('Written paper',/^\d{4}-\d{2}-\d{2}$/.test(old)?old:'');jsonWrite(GOALS,[first]);return [first]
}
var reminderBusy=false;
function saveGoals(a){
 jsonWrite(GOALS,a);
 scheduleReminder();
 // Keep the generic daily reminder at least 15 minutes away if the planner
 // reminder time was just enabled or changed.
 if(typeof window.__shbPlanDailyReminders==='function')
  setTimeout(window.__shbPlanDailyReminders,350);
}
function qState(){return jsonRead('shbace_qb_v6',{ans:{},sr:{}})||{ans:{},sr:{}}}
function liveStats(){
 try{var s=window.__shbStats&&window.__shbStats();if(s&&Number.isFinite(+s.bankTotal)&&Number.isFinite(+s.answered))return {total:Math.max(0,+s.bankTotal),answered:Math.max(0,+s.answered),remaining:Math.max(0,+s.bankTotal-(+s.answered))}}catch(_){}
 var a=qState().ans||{},n=Object.keys(a).length;return {total:n,answered:n,remaining:0}
}
function todayInfo(){
 var ans=qState().ans||{},counts={},count=0,k=today();
 Object.keys(ans).forEach(function(id){var t=Number(ans[id]&&ans[id].t);if(!Number.isFinite(t)||t<=0)return;var d=dateKey(new Date(t));counts[d]=(counts[d]||0)+1;if(d===k)count++});
 var days=jsonRead(ACTIVITY,[]);if(!Array.isArray(days))days=[];
 Object.keys(counts).forEach(function(d){if(days.indexOf(d)<0)days.push(d)});
 var set={};days.forEach(function(d){if(/^\d{4}-\d{2}-\d{2}$/.test(d))set[d]=1});
 var n=dayNo(k),start=set[k]?n:n-1,streak=0;while(set[fromDay(start-streak)])streak++;
 return {count:count,counts:counts,streak:streak,answers:ans}
}
function dueReview(){
 try{var api=window.__sr3x&&window.__sr3x();return api&&typeof api.dueList==='function'?api.dueList().length:0}catch(_){return 0}
}
function qIndex(){try{return window.__shbQuestionIndex&&window.__shbQuestionIndex()||[]}catch(_){return []}}
function topicPerf(){try{return window.__shbTopicPerformance&&window.__shbTopicPerformance()||[]}catch(_){return []}}
function specialties(){
 var a=qIndex(),ans=qState().ans||{},g={};
 a.forEach(function(q){
  var k=String(q.spec||'other').toLowerCase(),id=String(q.topic||''),x=g[k]||(g[k]={key:k,total:0,remaining:0,topics:{}});
  x.total++;if(!ans[q.id])x.remaining++;
  var t=x.topics[id]||(x.topics[id]={id:id,name:q.topicName||'Other',total:0,remaining:0,answered:0,correct:0});
  t.total++;if(ans[q.id]){t.answered++;if(ans[q.id].ok)t.correct++}else t.remaining++;
 });
 var perf=topicPerf(),map={};perf.forEach(function(t){map[String(t.id)]={accuracy:Number(t.acc)}});
 return Object.keys(g).map(function(k){var x=g[k];x.topics=Object.keys(x.topics).map(function(id){
  var t=x.topics[id],p=map[id];t.accuracy=p&&Number.isFinite(p.accuracy)?p.accuracy:(t.answered?t.correct/t.answered*100:null);return t
 }).filter(function(t){return t.remaining>0}).sort(function(a,b){var aa=a.accuracy==null?101:a.accuracy,bb=b.accuracy==null?101:b.accuracy;return aa-bb||b.remaining-a.remaining});
 return x}).filter(function(x){return x.total>0}).sort(function(a,b){return b.remaining-a.remaining})
}
function avgMs(){try{var api=window.__sr3x&&window.__sr3x(),r=api&&api.srSpeedRef&&api.srSpeedRef();if(r&&Number.isFinite(r.med)&&r.n>0)return r.med}catch(_){}return 0}
function calc(e,s){
 var days=e.date?dayNo(e.date)-dayNo(today()):NaN,buffer=Math.max(0,Math.round(+e.bufferDays||0)),
 rest=Number.isFinite(days)&&days>0?Math.ceil(days/7)*Math.max(0,Math.round(+e.restDaysPerWeek||0)):0,
 raw=Number.isFinite(days)?days-buffer-rest:0,study=Math.max(1,raw),
 target=e.date&&Number.isFinite(days)&&days>0&&s.remaining?Math.ceil(s.remaining/study):0;
 return {days:days,buffer:buffer,rest:rest,raw:raw,study:study,target:target,past:Number.isFinite(days)&&days<0,
  today:Number.isFinite(days)&&days===0,constrained:Number.isFinite(days)&&days>0&&raw<1,unrealistic:target>150}
}
function saveSnapshot(){var h=jsonRead(HISTORY,{});if(!h||typeof h!=='object')h={};h[today()]=liveStats().remaining;var keys=Object.keys(h).sort();while(keys.length>60)delete h[keys.shift()];jsonWrite(HISTORY,h)}
function burnChart(m,s){
 var h=jsonRead(HISTORY,{})||{},end=Number.isFinite(m.days)&&m.days>0?dayNo(today())+m.days:dayNo(today())+7,
 start=dayNo(today())-6,span=Math.max(1,end-start),max=Math.max(1,s.remaining);
 Object.keys(h).forEach(function(k){if(Number.isFinite(+h[k]))max=Math.max(max,+h[k])});
 var X=function(d){return 8+344*(d-start)/span},Y=function(v){return 108-94*Math.max(0,Math.min(1,v/max))};
 var past=Object.keys(h).filter(function(k){var d=dayNo(k);return Number.isFinite(d)&&d>=start&&d<=dayNo(today())}).sort(),
 actual=past.map(function(k){return X(dayNo(k)).toFixed(1)+','+Y(+h[k]).toFixed(1)}).join(' ');
 var points=[],now=dayNo(today()),count=Math.max(2,Math.min(18,Math.ceil(span/Math.max(1,Math.ceil(span/18)))+1));
 for(var i=0;i<count;i++){var d=Math.round(now+(end-now)*i/(count-1)),elapsed=d-now,v=elapsed>=m.study?0:s.remaining*(1-elapsed/Math.max(1,m.study));points.push(X(d).toFixed(1)+','+Y(v).toFixed(1))}
 return '<svg class="eg-chart" viewBox="0 0 360 124" role="img" aria-label="Question burn-down chart"><path class="eg-gridline" d="M8 14H352M8 61H352M8 108H352"/><polyline class="eg-ideal" points="'+points.join(' ')+'"/>'+
 (actual?'<polyline class="eg-actual" points="'+actual+'"/>':'')+'<circle class="eg-current" cx="'+X(now).toFixed(1)+'" cy="'+Y(s.remaining).toFixed(1)+'" r="4"/><text x="8" y="121">Now</text><text x="352" y="121" text-anchor="end">Exam</text></svg>'
}
function weekBars(counts){
 var a=[],max=1,n=dayNo(today()),names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 for(var i=6;i>=0;i--){var key=fromDay(n-i),v=Number(counts[key]||0);a.push({key:key,n:v});max=Math.max(max,v)}
 return '<div class="eg-week">'+a.map(function(x){var d=localDate(x.key),label=d?names[d.getDay()]:'—';return '<div class="eg-week-col"><span class="eg-week-count">'+(x.n||'')+'</span><i style="height:'+Math.max(4,Math.round(x.n/max*48))+'px"></i><small>'+label+'</small></div>'}).join('')+'</div>'
}
function mascotHtml(){
 // The doctor mascot is intentionally omitted from Exam Goal Planner to prevent overlap with the date/target cards.
 return '';
}
function dateText(s){var d=localDate(s);return d?d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):''}
function specialtiesHtml(){
 var a=specialties();if(!a.length)return '';
 return '<div class="eg-specialties"><h3>Remaining by specialty</h3>'+a.map(function(g){
  var topics=g.topics.slice(0,3).map(function(t){return '<div class="eg-topic"><span>'+esc(t.name)+'</span><b>'+t.remaining+' left</b><small>'+(t.accuracy==null?'Not rated yet':Math.round(t.accuracy)+'% accuracy')+'</small></div>'}).join('');
  return '<details class="eg-specialty"><summary><span>'+esc(g.key.replace(/[-_]/g,' '))+'</span><b>'+g.remaining+' remaining</b></summary>'+(topics||'<div class="eg-topic"><span>All questions answered</span><b>0 left</b></div>')+'</details>'
 }).join('')+'</div>'
}
function examCard(e,s,t){
 var m=calc(e,s),status=m.past?'Date passed':m.today?'Exam today':s.remaining===0?'Complete':m.constrained?'Not enough study days':m.unrealistic?'High daily target':t.count>m.target?'Ahead':t.count===m.target?'On track':'Behind',
 cls=status==='Ahead'||status==='On track'||status==='Complete'?'good':status==='Behind'||status==='High daily target'||status==='Not enough study days'?'warn':'neutral',
 target=!e.date||m.past||m.today?'—':String(m.target),days=!e.date||m.past?'—':m.today?'Today':String(m.days),
 sentence=e.date&&!m.past&&!m.today&&s.remaining>0?'<p class="eg-sentence">Answer about '+m.target+' questions each day to finish the currently unanswered bank before your exam.</p>':
  s.remaining===0?'<p class="eg-sentence">Your Question Bank is complete.</p>':m.today?'<p class="eg-sentence">Exam day · Final review.</p>':m.past?'<p class="eg-sentence eg-warning">This exam date has passed.</p>':'',
 warning=m.unrealistic?'<p class="eg-warning">Daily target exceeds 150 questions.</p>':m.constrained?'<p class="eg-warning">Not enough study days remain after review and rest days.</p>':'',
 pct=m.target?Math.min(100,Math.round(t.count/m.target*100)):(s.remaining===0?100:0),
 ring='<div class="eg-ring" style="--eg-progress:'+pct+'%"><div><b>'+t.count+'</b><small> / '+m.target+'</small></div></div>',
 average=avgMs(),minutes=average&&s.remaining?Math.max(1,Math.round(s.remaining*average/60000)):'—',
 time=average&&s.remaining?'About '+minutes+' min':'—',
 types=['Written paper','OSCE','Clinical exam','Other'];
 return '<article class="eg-card" data-eg-card="'+esc(e.id)+'"><div class="eg-card-head"><div><span class="eg-kicker">EXAM</span><h2>'+esc(e.name)+'</h2><span class="eg-status '+cls+'">'+status+'</span></div><button type="button" class="eg-remove" data-eg-remove="'+esc(e.id)+'" aria-label="Remove exam">×</button></div>'+
 '<label class="eg-label" for="eg-type-'+esc(e.id)+'">Exam type</label><select id="eg-type-'+esc(e.id)+'" class="eg-type" data-eg-name="'+esc(e.id)+'">'+types.map(function(x){return '<option '+(x===e.name?'selected':'')+'>'+x+'</option>'}).join('')+'</select>'+
 '<label class="eg-label" for="eg-date-'+esc(e.id)+'">Your exam date</label><input id="eg-date-'+esc(e.id)+'" class="eg-date" type="date" dir="ltr" lang="en-GB" value="'+esc(e.date)+'" min="'+today()+'" data-eg-date="'+esc(e.id)+'"/>'+
 '<div class="eg-stats"><div><b>'+days+'</b><small>Days left</small></div><div><b>'+s.remaining.toLocaleString('en-GB')+'</b><small>Questions remaining</small></div><div class="eg-target"><b>'+target+'</b><small>Questions per day</small><em>Smart Review · '+dueReview()+' due</em></div></div>'+sentence+warning+
 '<div class="eg-today"><div><span class="eg-label">Today</span><b>'+t.count+' / '+(m.target||0)+'</b><small>Answered today</small></div>'+ring+'<div class="eg-streak"><b>'+t.streak+'</b><small>Day streak</small></div></div>'+
 mascotHtml(m,t.count)+'<div class="eg-tools"><div class="eg-review-line"><span>Smart Review due</span><b>'+dueReview()+'</b></div><a href="#" data-eg-timer="1">Study Timer</a></div>'+
 '<div class="eg-time"><span>Estimated study time</span><b>'+time+'</b></div><details class="eg-settings"><summary>Planning settings</summary><div class="eg-settings-grid">'+
 '<label>Final review days<input type="number" min="0" max="30" value="'+m.buffer+'" data-eg-buffer="'+esc(e.id)+'"/></label><label>Rest days per week<input type="number" min="0" max="3" value="'+e.restDaysPerWeek+'" data-eg-rest="'+esc(e.id)+'"/></label></div>'+
 '<p class="eg-sentence">Background reminders are not scheduled in this Computer browser. Exam dates, targets and planning settings are saved locally.</p></details>'+
 '<div class="eg-chart-wrap"><h3>Burn-down</h3>'+burnChart(m,s)+'</div><div class="eg-week-wrap"><h3>Questions this week</h3>'+weekBars(t.counts)+'</div></article>'
}
function plannerPage(){
 saveSnapshot();
 var s=liveStats(),t=todayInfo();t.streak=t.streak||0;
 return appHeader('Exam goal planner')+'<div class="rs eg-page"><div class="eg-hero"><span class="eg-kicker">YOUR PROGRESS</span><h1>Exam goal planner</h1><p>Set your exam date and get a realistic daily question target.</p></div>'+
 '<div class="eg-exams">'+goals().map(function(e){return examCard(e,s,t)}).join('')+'</div>'+specialtiesHtml()+
 '<button type="button" class="eg-add" id="eg-add-exam">＋ Add another exam</button></div>'
}
function updateExam(id,fn){
 var a=goals(),e=a.find(function(x){return x.id===id});if(!e)return;fn(e);saveGoals(a);if(appPage==='examgoal')renderAppDemo()
}
window.shbGoalAdd=function(){var a=goals();a.push(makeExam('OSCE',''));saveGoals(a);renderAppDemo()};
window.shbGoalRemove=function(id){var a=goals().filter(function(e){return e.id!==id});if(!a.length)a.push(makeExam('Written paper',''));saveGoals(a);renderAppDemo()};
function onGoalChange(ev){
 var el=ev.target,id=el.getAttribute('data-eg-date')||el.getAttribute('data-eg-buffer')||el.getAttribute('data-eg-rest')||
  el.getAttribute('data-eg-reminder')||el.getAttribute('data-eg-time')||el.getAttribute('data-eg-name');
 if(!id)return;
 var field=el.hasAttribute('data-eg-date')?'date':el.hasAttribute('data-eg-buffer')?'buffer':el.hasAttribute('data-eg-rest')?'rest':
  el.hasAttribute('data-eg-reminder')?'reminder':el.hasAttribute('data-eg-time')?'time':'name';
 updateExam(id,function(e){
  if(field==='date')e.date=/^\d{4}-\d{2}-\d{2}$/.test(el.value)?el.value:'';
  if(field==='buffer')e.bufferDays=Math.max(0,Math.min(30,Number(el.value)||0));
  if(field==='rest')e.restDaysPerWeek=Math.max(0,Math.min(3,Number(el.value)||0));
  if(field==='reminder')e.reminderEnabled=!!el.checked;
  if(field==='time')e.reminderTime=/^\d{2}:\d{2}$/.test(el.value)?el.value:'19:30';
  if(field==='name')e.name=String(el.value||'Written paper');
 });
 if(field==='reminder'&&el.checked&&typeof window.__shbRequestReminderAccess==='function'){
  window.__shbRequestReminderAccess().then(function(ok){
   if(ok){
    setTimeout(scheduleReminder,250);
    if(typeof window.__shbPlanDailyReminders==='function')setTimeout(window.__shbPlanDailyReminders,350);
   }
  });
 }
}
document.addEventListener('change',onGoalChange);
document.addEventListener('click',function(ev){
 var add=ev.target.closest&&ev.target.closest('#eg-add-exam');if(add){window.shbGoalAdd();return}
 var rm=ev.target.closest&&ev.target.closest('[data-eg-remove]');if(rm){window.shbGoalRemove(rm.getAttribute('data-eg-remove'));return}
 var timer=ev.target.closest&&ev.target.closest('[data-eg-timer]');if(timer){ev.preventDefault();appPage='timer';renderAppDemo();return}
});
function nextMidnight(){
 var n=new Date(),at=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1,0,0,2,0);
 setTimeout(function(){saveSnapshot();scheduleReminder();if(appPage==='examgoal')renderAppDemo();nextMidnight()},Math.max(1000,at.getTime()-n.getTime()))
}
async function scheduleReminder(){ return; }
try{
 var LN=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications;
 if(LN&&typeof LN.addListener==='function')LN.addListener('localNotificationActionPerformed',function(a){
  var extra=a&&a.notification&&a.notification.extra||{};if(extra.shbaceExamGoal){appPage='examgoal';renderAppDemo()}
 });
}catch(_){}
var stack=[],lastPage=typeof appPage==='string'?appPage:'subjects',backing=false,popping=false,scrollMemo={};
function closeOverlay(){
 var d=document.getElementById('drawer');if(d&&d.classList.contains('open')){toggleDrawer(false);return true}
 var cf=document.getElementById('cfwrap');if(cf){if(typeof window.cfClose==='function')window.cfClose();else cf.remove();return true}
 var ask=document.querySelector('.npx-ask');if(ask){var b=ask.querySelector('.xbk');if(b)b.click();else ask.remove();return true}
 var qd=document.querySelector('.qd-sheet.on');if(qd){var c=qd.querySelector('[data-close],.qd-close,.qd-x');if(c)c.click();return true}
 return false
}
window.navBack=function(){
 if(closeOverlay())return;
 var to=stack.length?stack.pop():null;
 if(!to){try{to=window.__shbGetBackTarget(appPage)}catch(_){}}
 if(to==='*'){try{to=window.__qs&&window.__qs.spec&&window.__qs.spec!=='all'?'topics':'subjects'}catch(_){to='subjects'}}
 if(!to)to='subjects';if(to===appPage)return;
 backing=true;appPage=to;renderAppDemo();backing=false
};
window.addEventListener('popstate',function(e){
 popping=true;var target=e&&e.state&&e.state.p;
 if(target){while(stack.length&&stack[stack.length-1]!==target)stack.pop();if(stack.length&&stack[stack.length-1]===target)stack.pop()}
 setTimeout(function(){popping=false},0)
},true);
var originalRender=window.renderAppDemo;
if(typeof originalRender==='function')window.renderAppDemo=function(){
 var to=appPage;if(mode==='app'&&to!==lastPage&&!backing&&!popping){stack.push(lastPage);if(stack.length>40)stack.shift();var cur=document.getElementById('phoneContent');if(cur)scrollMemo[lastPage]=cur.scrollTop}
 var result=originalRender.apply(this,arguments);lastPage=to;
 var sc=document.getElementById('phoneContent');if(sc&&Number.isFinite(scrollMemo[to]))requestAnimationFrame(function(){var p=document.getElementById('phoneContent');if(p)p.scrollTop=scrollMemo[to]});
 removeBadges();removeOldPlanner();return result
};
function removeBadges(){try{document.querySelectorAll('#drawer .nb,.drawer .nb,.app-nav .nbadge').forEach(function(x){x.remove()})}catch(_){}}
function removeOldPlanner(){var e=document.getElementById('shbExamGoal');if(e&&appPage==='stats')e.remove()}
var oldDrawer=window.toggleDrawer;if(typeof oldDrawer==='function')window.toggleDrawer=function(){var r=oldDrawer.apply(this,arguments);removeBadges();return r};
try{
 DR2.splice(0,DR2.length,
 ['REVIEW',[
  ['Smart Review','review','<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',''],
  ['Wrong answers','wrong','<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',''],
  ['Saved questions','saved','<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',''],
  ['My Notes','notes','<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',''],
  ['Pinned & Recent','pinned','<path d="M9 3h6l-1 6 3 3H7l3-3z"/><path d="M12 12v9"/>','']
 ]],
 ['YOUR PROGRESS',[
  ['Exam goal planner','examgoal','<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',''],
  ['Study timer','timer','<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',''],
  ['Statistics','stats','<path d="M5 20V10M12 20V4M19 20v-7"/>',''],
  ['Weak Areas','weak','<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><circle cx="16" cy="8" r="2.2"/>','']
 ]],
 ['APP & SUPPORT',[
  ['Settings','settings','<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',''],
  ['Contact & Feedback','feedback','<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',''],
  ['Changelog','changelog','<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',''],
  ['About','about','<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',''],
  ['Rate this app','rate','<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>','']
 ]]);
 DR2.forEach(function(g){g[1].forEach(function(x){x[3]=''})});
}catch(e){console.warn('v1.3 navigation menu setup failed',e)}
function installDoctorSetting(){
 var p=document.getElementById('shbAndroidSettings');if(!p||p.querySelector('[data-shb-pref="doctorExpressions"]'))return;
 var state={};try{state=window.__shbAndroidFeatures.state().prefs||{}}catch(_){}
 if(typeof state.doctorExpressions==='undefined'){
  var b=document.createElement('button');b.type='button';b.innerHTML='<span></span>';b.setAttribute('data-shb-pref','doctorExpressions');b.style.display='none';document.body.appendChild(b);b.click();b.remove();
  try{state=window.__shbAndroidFeatures.state().prefs||{}}catch(_){}
 }
 var on=state.doctorExpressions!==false;
 p.insertAdjacentHTML('beforeend','<div class="shb-af-row eg-doctor-pref"><div class="shb-af-copy"><b>Doctor character &amp; expressions</b><small>Show the doctor only in the related event, including after a question is answered.</small></div><button type="button" class="shb-af-toggle '+(on?'on':'')+'" data-shb-pref="doctorExpressions" role="switch" aria-checked="'+on+'"><span>'+(on?'ON':'OFF')+'</span></button></div>')
}
function doctorOn(){try{return window.__shbAndroidFeatures.state().prefs.doctorExpressions!==false}catch(_){return true}}
try{if(typeof window.docFace==='function'){var oldDocFace=window.docFace;window.docFace=function(){return doctorOn()?oldDocFace.apply(this,arguments):''}}}catch(_){}
function settingsPatch(){
 installDoctorSetting();var s={};try{s=window.__shbAndroidFeatures.state().prefs||{}}catch(_){}
 document.querySelectorAll('[data-shb-pref="doctorExpressions"]').forEach(function(b){
  var on=s.doctorExpressions!==false,label=on?'ON':'OFF';
  // The phoneContent observer watches descendant child-list changes. Assigning textContent
  // unconditionally replaces the text node, queues another observer callback, and can create
  // an endless render loop that freezes Settings. Only mutate the DOM when its value differs.
  if(b.classList.contains('on')!==on)b.classList.toggle('on',on);
  if(b.getAttribute('aria-checked')!==String(on))b.setAttribute('aria-checked',String(on));
  var v=b.querySelector('span');if(v&&v.textContent!==label)v.textContent=label;
 })
}
if(window.__shbRegisterPage)window.__shbRegisterPage('examgoal',plannerPage,'subjects');
var pc=document.getElementById('phoneContent');
if(pc&&window.MutationObserver)new MutationObserver(function(){removeOldPlanner();removeBadges();settingsPatch()}).observe(pc,{childList:true,subtree:true});
var prevAnswer=window.qAnswer;if(typeof prevAnswer==='function')window.qAnswer=function(){var r=prevAnswer.apply(this,arguments);saveSnapshot();if(appPage==='examgoal')renderAppDemo();scheduleReminder();return r};
window.addEventListener('pageshow',function(){saveSnapshot();scheduleReminder();if(appPage==='examgoal')renderAppDemo()});
document.addEventListener('visibilitychange',function(){if(!document.hidden){saveSnapshot();scheduleReminder();if(appPage==='examgoal')renderAppDemo()}});
function midnight(){var n=new Date(),at=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1,0,0,2,0);setTimeout(function(){saveSnapshot();scheduleReminder();if(appPage==='examgoal')renderAppDemo();midnight()},Math.max(1000,at.getTime()-n.getTime()))}
try{
 var appPlugin=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
 if(appPlugin&&typeof appPlugin.addListener==='function')appPlugin.addListener('backButton',function(){window.navBack()});
}catch(_){}
/* The Computer PWA keeps its own onboarding and selected study year unchanged. */
function startup(){
 saveSnapshot();scheduleReminder();midnight();removeBadges();removeOldPlanner();settingsPatch();
 if(appPage==='examgoal'&&mode==='app')renderAppDemo()
}
setTimeout(startup,700);
window.__shbaceV13={version:'1.3',plannerState:function(){return {exams:goals(),stats:liveStats(),dueSmartReview:dueReview()}},refresh:function(){if(appPage==='examgoal')renderAppDemo();scheduleReminder()}};
})();