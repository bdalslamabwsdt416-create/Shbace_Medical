/* Shbace Medical · 37 — Study hub, readiness and cross-page linkage (additive, read-only).
   Reads only existing data (answers, Smart Review due list, exam goals, quiz state, wrong list) and
   navigates with existing functions. It never writes to the question bank, answers or Smart Review data. */
(function(){
'use strict';
if(window.__shbHub37)return;window.__shbHub37=true;

var GOALS_KEY='shbace_exam_goals_v2',QB_KEY='shbace_qb_v6',QUIZ_KEY='shbace_quiz_v1',WRONG_KEY='shbace_qb_wrong_v1',DAY=86400000;
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
function read(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(_){return d}}
function pad(n){return String(n).padStart(2,'0')}
function dayNo(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3])/DAY):NaN}
function todayKey(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function dateKey(t){var d=new Date(t);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}

/* ---------- data ---------- */
function nextExam(){
  var a=read(GOALS_KEY,[]);if(!Array.isArray(a))return null;
  var t=dayNo(todayKey()),best=null;
  a.forEach(function(e){
    if(!e||!/^\d{4}-\d{2}-\d{2}$/.test(e.date||''))return;
    var n=dayNo(e.date)-t;if(n<0)return;
    if(!best||n<best.days)best={name:String(e.name||'Exam'),days:n,date:e.date};
  });
  return best;
}
function hasExamEntries(){var a=read(GOALS_KEY,[]);return Array.isArray(a)&&a.length>0}
function stats(){try{return window.__shbStats&&window.__shbStats()||null}catch(_){return null}}
function dueCount(){try{var a=window.__sr3x&&window.__sr3x();return a&&a.dueList?a.dueList().length:0}catch(_){return 0}}
function answeredToday(){
  var ans=(read(QB_KEY,{})||{}).ans||{},k=todayKey(),n=0;
  Object.keys(ans).forEach(function(id){var t=Number(ans[id]&&ans[id].t);if(t>0&&dateKey(t)===k)n++});
  return n;
}
function wrongCount(){
  var w=read(WRONG_KEY,{}),n=0;
  if(w&&typeof w==='object')Object.keys(w).forEach(function(id){if(w[id]&&!w[id].hidden)n++});
  return n;
}
function activeQuiz(){var q=read(QUIZ_KEY,null);var A=q&&q.active;return A&&Array.isArray(A.ids)&&A.ids.length?{done:Object.keys(A.ans||{}).length,total:A.ids.length}:null}
function weakest(){
  try{
    var tp=window.__shbTopicPerformance&&window.__shbTopicPerformance()||[];
    var list=tp.filter(function(t){return t.a>=3&&t.acc<75}).sort(function(x,y){return x.acc-y.acc||y.a-x.a});
    if(!list.length)return null;
    var w=list[0],idx=window.__shbQuestionIndex&&window.__shbQuestionIndex()||[],spec=null;
    for(var i=0;i<idx.length;i++){if(String(idx[i].topic)===String(w.id)){spec=idx[i].spec;break}}
    return spec?{id:w.id,name:w.name,acc:w.acc,spec:spec}:null;
  }catch(_){return null}
}
/* Readiness = share of the WHOLE bank whose latest answer is correct (correct / bankTotal). */
function readiness(){
  var s=stats();if(!s||!(s.bankTotal>0))return null;
  return {pct:Math.round(100*s.correct/s.bankTotal),answered:s.answered,total:s.bankTotal,acc:s.accuracy,enough:s.answered>=20};
}

/* ---------- navigation helpers (existing routes only) ---------- */
window.__shbGo=function(page){try{appPage=page;renderAppDemo()}catch(e){console.error(e)}};
window.__shbHubWeak=function(spec,topic){
  try{
    var t=/^\d+$/.test(String(topic))?Number(topic):topic;
    if(typeof window.qzTopicQuiz==='function')window.qzTopicQuiz(spec,t);else window.__shbGo('quiz');
  }catch(e){console.error(e)}
};
window.__shbHubResume=function(){try{if(typeof window.qzResume==='function')window.qzResume()}catch(e){console.error(e)}};

/* ---------- styles ---------- */
(function(){
  var st=document.createElement('style');st.id='shb-hub37-style';
  st.textContent=
  '.hub37{margin:12px 0;padding:14px;border:1px solid rgba(95,169,225,.28);border-radius:18px;background:linear-gradient(150deg,rgba(14,42,78,.78),rgba(6,20,40,.86));color:#eaf4ff}'+
  '.hub37 h3{margin:0 0 10px;font-size:15px;font-weight:850;display:flex;justify-content:space-between;align-items:center;gap:8px}'+
  '.hub37 h3 small{font-size:10px;font-weight:700;color:#9bb8d5}'+
  '.hub37-ready{display:flex;align-items:center;gap:12px;margin-bottom:10px}'+
  '.hub37-ring{--p:0;width:64px;height:64px;border-radius:50%;flex:none;display:grid;place-items:center;background:conic-gradient(#35d8ff calc(var(--p)*1%),rgba(120,160,210,.2) 0)}'+
  '.hub37-ring b{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:#08182e;font-size:15px}'+
  '.hub37-ready p{margin:0;font-size:11px;line-height:1.5;color:#9bb8d5}.hub37-ready p b{color:#eaf4ff}'+
  '.hub37-rows{display:grid;gap:7px}'+
  '.hub37-row{display:flex;align-items:center;gap:10px;width:100%;text-align:start;padding:10px 12px;border-radius:13px;border:1px solid rgba(95,169,225,.22);background:rgba(8,25,48,.65);color:inherit;font:inherit;cursor:pointer;min-height:44px}'+
  '.hub37-row span{flex:1;min-width:0;font-size:12.5px;line-height:1.4;overflow-wrap:anywhere}.hub37-row span b{display:block;font-size:13px}'+
  '.hub37-row i{font-style:normal;font-size:11px;font-weight:800;color:#35d8ff;white-space:nowrap}'+
  '.hub37-row.off{opacity:.62}'+
  '.hub37-strip{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:8px 0 12px;padding:9px 12px;border-radius:13px;border:1px solid rgba(95,169,225,.24);background:rgba(10,32,60,.7);font-size:11.5px;color:#cfe3f7}'+
  '.hub37-strip button{background:none;border:0;color:#35d8ff;font:inherit;font-weight:800;padding:4px 2px;cursor:pointer}'+
  '.hub37-strip b{color:#fff}'+
  '.hub37-next{margin:12px 0}';
  (document.head||document.documentElement).appendChild(st);
})();

/* ---------- renderers ---------- */
function row(label,sub,tag,onclick,off){
  return '<button type="button" class="hub37-row'+(off?' off':'')+'" onclick="'+onclick+'"><span><b>'+esc(label)+'</b>'+esc(sub)+'</span><i>'+esc(tag)+'</i></button>';
}
function hubHtml(){
  var r=readiness(),ex=nextExam(),due=dueCount(),qz=activeQuiz(),w=weakest(),wr=wrongCount(),today=answeredToday();
  var ring='<div class="hub37-ready"><div class="hub37-ring" style="--p:'+(r&&r.enough?r.pct:0)+'"><b>'+(r&&r.enough?r.pct+'%':'—')+'</b></div><p>'+
    (r&&r.enough?'<b>Bank readiness</b> — correct answers out of all '+r.total.toLocaleString('en-GB')+' questions (your latest answer on each). Accuracy so far: '+(r.acc==null?'—':Math.round(r.acc)+'%')+'.'
      :'<b>Bank readiness</b> appears after you answer 20 questions. Answered so far: '+(r?r.answered:0)+'.')+
    '</p></div>';
  var rows=[];
  if(ex)rows.push(row(ex.name,ex.days===0?'Exam is today':ex.days+' day'+(ex.days===1?'':'s')+' left · '+today+' answered today','Planner','__shbGo(\'examgoal\')'));
  else rows.push(row('Set your exam date',hasExamEntries()?'Add a date to get a daily target':'Get a daily question target','Set','__shbGo(\'examgoal\')'));
  if(qz)rows.push(row('Unfinished quiz',qz.done+' of '+qz.total+' answered','Resume','__shbHubResume()'));
  rows.push(row('Smart Review',due?due+' question'+(due===1?'':'s')+' due now':'Nothing due right now',due?'Review':'Open','__shbGo(\'review\')',!due));
  if(w)rows.push(row('Weakest topic: '+w.name,w.acc+'% accuracy','Quiz','__shbHubWeak(\''+esc(w.spec)+'\',\''+esc(w.id)+'\')'));
  if(wr)rows.push(row('Wrong answers',wr+' to revisit','Open','__shbGo(\'wrong\')'));
  rows.push(row('Study Timer','Track focused study time','Open','__shbGo(\'timer\')'));
  return '<section class="hub37 card" data-hub37="home"><h3>Your study hub<small>'+today+' answered today</small></h3>'+ring+'<div class="hub37-rows">'+rows.join('')+'</div></section>';
}
function stripHtml(){
  var ex=nextExam(),due=dueCount(),today=answeredToday(),parts=[];
  parts.push(ex?'<span>📅 <b>'+esc(ex.name)+'</b> · '+(ex.days===0?'today':ex.days+'d')+'</span>':'<span>📅 No exam date set</span>');
  parts.push('<span>Today <b>'+today+'</b></span>');
  parts.push('<span>Due <b>'+due+'</b></span>');
  return '<div class="hub37-strip" data-hub37="strip">'+parts.join('')+'<button type="button" onclick="__shbGo(\'examgoal\')">Planner ›</button><button type="button" onclick="__shbGo(\'subjects\')">Home ›</button></div>';
}
function resultHtml(){
  var due=dueCount(),ex=nextExam(),wr=wrongCount();
  return '<section class="hub37 hub37-next card" data-hub37="result"><h3>What next?</h3><div class="hub37-rows">'+
    row('Smart Review',due?due+' due now':'Nothing due right now',due?'Review':'Open','__shbGo(\'review\')',!due)+
    (wr?row('Wrong answers',wr+' to revisit','Open','__shbGo(\'wrong\')'):'')+
    row(ex?ex.name:'Exam planner',ex?(ex.days===0?'Exam is today':ex.days+' days left'):'Set a date and daily target','Planner','__shbGo(\'examgoal\')')+
    row('Study hub','Back to Home','Home','__shbGo(\'subjects\')')+
    '</div></section>';
}

/* ---------- injection after each render ---------- */
var STRIP_PAGES={review:1,timer:1,stats:1,quiz:1,settings:0};
function inject(){
  try{
    if(typeof mode==='undefined'||mode!=='app')return;
    var root=document.querySelector('.rs');if(!root)return;
    root.querySelectorAll('[data-hub37]').forEach(function(n){n.remove()});
    if(appPage==='subjects'){
      /* Home intentionally stays clean; the Study Hub is not injected here. */
    }else if(appPage==='quizresult'){
      root.insertAdjacentHTML('beforeend',resultHtml());
    }else if(STRIP_PAGES[appPage]){
      var anchor=root.querySelector('.backb');
      if(anchor)anchor.insertAdjacentHTML('afterend',stripHtml());else root.insertAdjacentHTML('afterbegin',stripHtml());
    }
  }catch(e){console.error('Study hub 37',e)}
}
var prev=window.renderAppDemo||(typeof renderAppDemo==='function'?renderAppDemo:null);
var lastPage=null;
if(prev){
  renderAppDemo=function(){
    /* Question Bank always opens in the "All" view; Single stays available from the toggle. */
    var entering=(appPage==='questions'&&lastPage!=='questions');
    if(entering&&window.__qs){window.__qs.view='all';window.__qs.lim=Math.max(30,(window.__qs.idx||0)+12)}
    var r=prev.apply(this,arguments);inject();
    if(entering&&window.__qs&&window.__qs.idx>0){
      try{var cards=document.querySelectorAll('#qbBody .qcard'),c=cards[window.__qs.idx];if(c)setTimeout(function(){c.scrollIntoView({block:'start'})},60)}catch(_){}
    }
    lastPage=appPage;return r};
  window.renderAppDemo=renderAppDemo;
}

/* Back button for the review-audit screen (it had no back route). Its own renderer in 29 still draws the page. */
try{if(typeof window.__shbRegisterPage==='function')window.__shbRegisterPage('reviewAudit',function(){return ''},'settings')}catch(e){}
})();
