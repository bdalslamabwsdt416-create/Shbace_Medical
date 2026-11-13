
(function(){
 'use strict';
 const PROGRESS_KEY='shbace_home_pediatrics_resume_v1';
 const safeRead=()=>{try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null')}catch(e){return null}};
 const validTopic=(spec,topic)=>{
  try{const group=REAL.spec[spec];return !!group&&Array.isArray(group.topics)&&group.topics.some(t=>Number(t[0])===Number(topic))}catch(e){return false}
 };
 const firstTopic=()=>{
  try{for(const spec of Object.keys(REAL.spec||{})){const row=(REAL.spec[spec].topics||[])[0];if(row&&validTopic(spec,row[0]))return {spec,topic:Number(row[0])}}}catch(e){}
  return null;
 };
 function saveProgress(spec,topic,questionId){
  try{
   const state=window.__qs||{};spec=spec||state.spec;topic=topic==null?state.topic:topic;
   if(!spec||!validTopic(spec,topic))return;
   const row=(REAL.spec[spec].topics||[]).find(t=>Number(t[0])===Number(topic));
   const max=Math.max(0,Number(row&&row[2]||1)-1);
   const record={spec:String(spec),topic:Number(topic),idx:Math.max(0,Math.min(max,Number(state.idx)||0)),filter:typeof state.filter==='string'?state.filter:'all',tag:typeof state.tag==='string'?state.tag:'all',view:typeof state.view==='string'?state.view:'',questionId:questionId==null?null:String(questionId),updatedAt:Date.now()};
   localStorage.setItem(PROGRESS_KEY,JSON.stringify(record));
  }catch(e){}
 }
 const originalOpenTopic=window.openTopic;
 if(typeof originalOpenTopic==='function')window.openTopic=function(spec,topic){const result=originalOpenTopic.apply(this,arguments);saveProgress(spec,topic,null);return result};
 const originalStep=window.qStep;
 if(typeof originalStep==='function')window.qStep=function(){const result=originalStep.apply(this,arguments);saveProgress();return result};
 const originalAnswer=window.qAnswer;
 if(typeof originalAnswer==='function')window.qAnswer=function(id){const result=originalAnswer.apply(this,arguments);saveProgress(null,null,id);return result};
 const originalSetView=window.setView;
 if(typeof originalSetView==='function')window.setView=function(){const result=originalSetView.apply(this,arguments);saveProgress();return result};
 const originalDdPick=window.ddPick;
 if(typeof originalDdPick==='function')window.ddPick=function(id){const result=originalDdPick.apply(this,arguments);if(id==='filter'||id==='tag')saveProgress();return result};
 const originalOpenQ=window.openQ;
 if(typeof originalOpenQ==='function')window.openQ=function(){const result=originalOpenQ.apply(this,arguments);saveProgress();return result};
 window.h7ResumePediatrics=function(){
  let p=safeRead();
  if(!p||!validTopic(p.spec,p.topic)){
   let recent=null;try{recent=(REC||[]).find(e=>e&&e.k==='topic'&&validTopic(e.spec,e.topic))}catch(e){}
   p=recent?{spec:recent.spec,topic:Number(recent.topic),idx:0}:null;
  }
  if(!p){appPage='specialties';renderAppDemo();return}
  if(typeof window.openTopic==='function')window.openTopic(p.spec,Number(p.topic));
  const state=window.__qs;
  if(state){
   const row=(REAL.spec[p.spec].topics||[]).find(t=>Number(t[0])===Number(p.topic));
   const max=Math.max(0,Number(row&&row[2]||1)-1);
   state.idx=Math.max(0,Math.min(max,Number(p.idx)||0));
   if(typeof p.filter==='string')state.filter=p.filter;
   if(typeof p.tag==='string')state.tag=p.tag;
   if(typeof p.view==='string'&&p.view)state.view=p.view;
  }
  appPage='questions';renderAppDemo();
  saveProgress(p.spec,p.topic,p.questionId||null);
 };
 window.h7StartPediatrics=function(){
  // Start at the collection chooser so the student can choose the doctor's bank or previous exams.
  // This preserves each collection's own system/topic filters and never changes question data.
  if(typeof window.openPediatricCollections==='function'){
   window.openPediatricCollections();
   return;
  }
  appPage='specialties';
  renderAppDemo();
 };
})();
