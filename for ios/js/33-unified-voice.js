/* SHBACE Medical · unified Chrome voice preferences and speech engine. */
(function(){
'use strict';
function settingsRoot(){
 try{var root=document.querySelector('#phoneContent .rs'),h=root&&root.querySelector('h1');return root&&h&&/^settings$/i.test((h.textContent||'').trim())?root:null}catch(_){return null}
}
/* Unified offline-aware question voice for Chrome on phone and computer. */
var UNIFIED_VOICE_KEY='shbace_unified_voice_language_v1';
var computerVoiceApi=false,computerVoicePreference='en-US',computerActiveLanguage='en-US';
var computerActiveVoice=null,computerVoiceList=[],computerVoiceReady=false;
var computerVoiceFallback=false,computerVoiceFallbackFor='en-US';
var computerVoiceMessage='',computerVoiceMessageOption='',computerVoicePendingChoice='';
var computerVoiceNoticesShown={},computerVoiceSpeechToken=0,computerVoiceReadingButton=null;
var computerVoiceRetryDelays=[250,650,1300,2600];
var QUESTION_TOOLS_KEY='shbace_question_tools_v1';
function computerVoiceReadQuestionTools(){
 var defaults={shareQuestion:true,copyQuestion:true,readAloud:true,readingSpeed:'normal'},saved=null,legacy=null;
 try{saved=JSON.parse(localStorage.getItem(QUESTION_TOOLS_KEY)||'null')}catch(_){}
 if(!saved||typeof saved!=='object'||Array.isArray(saved)){
  try{legacy=JSON.parse(localStorage.getItem('shbace_android_features_v1')||'null')}catch(_){}
 }
 var prefs=Object.assign({},defaults,saved&&typeof saved==='object'?saved:legacy&&typeof legacy==='object'?legacy:{});
 if(!['slow','normal','fast'].includes(prefs.readingSpeed))prefs.readingSpeed='normal';
 ['shareQuestion','copyQuestion','readAloud'].forEach(function(k){prefs[k]=prefs[k]!==false});
 return prefs;
}
var computerQuestionTools=computerVoiceReadQuestionTools();
function computerVoiceSaveQuestionTools(){
 try{localStorage.setItem(QUESTION_TOOLS_KEY,JSON.stringify(computerQuestionTools))}catch(_){}
 computerVoiceUpdateQuestionToolsUI();
}
function computerVoiceQuestionToolsRate(){
 return computerQuestionTools.readingSpeed==='slow'?0.78:computerQuestionTools.readingSpeed==='fast'?1.08:0.92;
}
function computerVoiceQuestionToolSetting(key,title,description){
 return '<div class="setrow shb-question-tool-setting"><span><b>'+title+'</b><small>'+description+'</small></span>'+
  '<button type="button" class="drsw '+(computerQuestionTools[key]?'on':'')+'" role="switch" aria-checked="'+(!!computerQuestionTools[key])+'" data-shb-question-pref="'+key+'"><i></i><span>'+(computerQuestionTools[key]?'ON':'OFF')+'</span></button></div>';
}
function computerVoiceUpdateQuestionToolsUI(){
 try{
  var root=document.getElementById('shbQuestionToolsSettings');if(!root)return;
  root.querySelectorAll('[data-shb-question-pref]').forEach(function(btn){
   var key=btn.getAttribute('data-shb-question-pref'),on=!!computerQuestionTools[key];
   btn.classList.toggle('on',on);btn.setAttribute('aria-checked',String(on));
   var label=btn.querySelector('span');if(label)label.textContent=on?'ON':'OFF';
  });
  root.querySelectorAll('[data-shb-question-speed]').forEach(function(btn){
   btn.classList.toggle('on',btn.getAttribute('data-shb-question-speed')===computerQuestionTools.readingSpeed);
  });
 }catch(_){}
}
function computerVoiceLanguageLabel(lang){
 return lang==='en-GB'?'English (UK)':lang==='ar'?'Arabic':'English (US)';
}
function computerVoiceReadPreference(){
 try{
  var saved=localStorage.getItem(UNIFIED_VOICE_KEY);
  return saved==='en-GB'||saved==='en-US'?saved:'en-US';
 }catch(_){return 'en-US'}
}
function computerVoiceSavePreference(lang){
 try{localStorage.setItem(UNIFIED_VOICE_KEY,lang)}catch(_){}
}
function computerVoiceGetVoices(){
 try{
  if(!computerVoiceApi)return [];
  var list=window.speechSynthesis.getVoices();
  return Array.isArray(list)?list:[];
 }catch(_){return []}
}
function computerVoiceNormLang(voice){
 try{return String(voice&&voice.lang||'').toLowerCase().replace(/_/g,'-')}catch(_){return ''}
}
function computerVoiceMatches(voice,lang){
 var l=computerVoiceNormLang(voice);
 if(lang==='ar')return /^ar(?:-|$)/.test(l);
 if(lang==='en-US')return l==='en-us'||l==='en'||/^en-us-/.test(l);
 if(lang==='en-GB')return l==='en-gb'||l==='en'||/^en-gb-/.test(l);
 return false;
}
function computerVoiceGenderHint(voice){
 var name=String(voice&&((voice.name||'')+' '+(voice.voiceURI||''))||'').toLowerCase();
 var male=/(^|[\s_-])(male|man|masculine|david|mark|guy|james|daniel|alex|fred|thomas|tom|george|oliver|ryan|aaron|jason|matthew|andrew|brian|arthur|liam|nathan|john|michael|christopher|eric|peter|paul|stephen|richard|william|henry|bruce|majed|hamed|naayf|hamdan|abdulrahman|fares|hisham|tarik|salim|mohammed|muhammad|omar|khalid|fahad|saud)([\s_-]|$)/i.test(name);
 var femaleId=/-x-(iob|sfg|tpc|tpf)\b/i.test(name),maleId=/-x-(iol|iom|tpd)\b/i.test(name);
 var female=femaleId||/(^|[\s_-])(female|woman|feminine|zira|aria|jenny|samantha|victoria|susan|hazel|eva|michelle|joanna|kate|sonia|libby|ava|emma|salli|kendra|kimberly|ivy|nicole|olivia|serena|moira|tessa|karen|fiona|veena)([\s_-]|$)/i.test(name);
 return (male||maleId)&&!female?2:female?-1:0;
}
function computerVoiceFind(lang,list){
 try{
  var all=(list||computerVoiceList)||[];
  var candidates=all.filter(function(v){return computerVoiceMatches(v,lang)});
  if(!candidates.length)candidates=all.filter(function(v){return /^en(?:-|$)/.test(computerVoiceNormLang(v))});
  var offline=false;try{offline=navigator.onLine===false}catch(_){}
  function score(v){
   var l=computerVoiceNormLang(v),exact=l===String(lang).toLowerCase();
   var gender=computerVoiceGenderHint(v),name=String(v.name||'').toLowerCase()+' '+String(v.voiceURI||'').toLowerCase();
   var natural=/(neural|natural|premium|enhanced|online)/i.test(name);
   var remote=v.localService===false;
   var s=gender*180+(exact?35:0)+(natural?60:0)+(v.default?4:0);
   if(remote)s+=offline?-400:-10;else if(v.localService===true)s+=70;else s+=35;
   if(/compact|espeak|robot/i.test(name))s-=120;
   return s;
  }
  candidates.sort(function(a,b){return score(b)-score(a)});
  return candidates[0]||null;
 }catch(_){return null}
}
function computerVoiceClean(text){
 var t=String(text||'');
 t=t.replace(/^\s*Q\s*\d+[.):]\s*/i,'').replace(/\s+/g,' ');
 var map=[[/\bmg\/dl\b/gi,' milligrams per deciliter'],[/\bmg\/kg\b/gi,' milligrams per kilogram'],[/\bmmol\/l\b/gi,' millimoles per liter'],[/\bmeq\/l\b/gi,' milliequivalents per liter'],[/\bg\/dl\b/gi,' grams per deciliter'],[/\bmmhg\b/gi,' millimeters of mercury'],[/\bbreaths?\/min\b/gi,' breaths per minute'],[/\bbeats?\/min\b/gi,' beats per minute'],[/\/min\b/gi,' per minute'],[/\bbpm\b/gi,' beats per minute'],[/\bmcg\b/gi,' micrograms'],[/\bmg\b/gi,' milligrams'],[/\bkg\b/gi,' kilograms'],[/\bml\b/gi,' milliliters'],[/\bpco2\b/gi,'P C O 2'],[/\bpo2\b/gi,'P O 2'],[/\bhco3\b/gi,'H C O 3'],[/\bhb\b/gi,'hemoglobin'],[/\bwbc\b/gi,'W B C'],[/\brbs\b/gi,'random blood sugar'],[/\bo\/e\b/gi,'on examination'],[/\bc\/o\b/gi,'complaining of'],[/\bh\/o\b/gi,'history of'],[/\bDx\b/g,'diagnosis'],[/\bRx\b/g,'treatment'],[/\bvs\.?\b/gi,'versus'],[/&/g,' and '],[/\u00b0\s?C\b/g,' degrees Celsius'],[/\s*[\u2192\u2794]\s*/g,' leads to '],[/\s*[\u2191]\s*/g,' increased '],[/\s*[\u2193]\s*/g,' decreased ']];
 map.forEach(function(m){t=t.replace(m[0],m[1])});
 return t.replace(/\s+/g,' ').trim();
}
function computerVoiceUpdateUi(){
 try{
  var card=document.getElementById('shbUnifiedVoiceSettings');
  if(!card)return;
  card.querySelectorAll('[data-shb-unified-voice]').forEach(function(btn){
   var selected=btn.getAttribute('data-shb-unified-voice')===computerVoicePreference;
   btn.classList.toggle('on',selected);
   btn.setAttribute('aria-pressed',selected?'true':'false');
   btn.disabled=!computerVoiceApi;
  });
  var status=card.querySelector('.shb-computer-voice-status');
  var statusText=card.querySelector('.shb-computer-voice-status-text');
  var dismiss=card.querySelector('.shb-computer-voice-dismiss');
  if(status&&statusText){
   var message=computerVoiceMessage;
   var dismissible=!!message;
   if(!message&&computerVoiceFallback&&computerVoicePreference!=='ar'&&computerVoiceReady){
    message=computerVoiceLanguageLabel(computerVoiceFallbackFor)+' voice is unavailable on this device. Arabic voice is being used instead.';
   }
   if(!message&&!computerVoiceApi)message='Voice playback is not supported in this browser.';
   if(!message&&computerVoiceApi&&!computerVoiceReady)message='Checking available voices…';
   status.hidden=!message;
   statusText.textContent=message||'';
   if(dismiss)dismiss.hidden=!dismissible;
  }
 }catch(_){}
}
function computerVoiceShowMissing(lang){
 try{
  if(computerVoiceNoticesShown[lang])return;
  computerVoiceNoticesShown[lang]=true;
  computerVoiceMessageOption=lang;
  computerVoiceMessage=computerVoiceLanguageLabel(lang)+' voice isn’t available on this device, so the current voice is still in use. Installing it in your device settings is optional.';
  computerVoiceUpdateUi();
 }catch(_){}
}
function computerVoiceApplySavedPreference(list){
 try{
  var voice=computerVoiceFind(computerVoicePreference,list);
  computerActiveLanguage=computerVoicePreference;computerActiveVoice=voice||null;computerVoiceFallback=false;
  computerVoiceUpdateUi();
 }catch(_){
  computerActiveLanguage=computerVoicePreference;computerActiveVoice=null;computerVoiceFallback=false;
  computerVoiceUpdateUi();
 }
}
function computerVoiceCommitChoice(lang,voice){
 try{
  computerVoiceStopQuestionReadAloud();
  computerVoicePreference=lang;computerVoiceSavePreference(lang);
  computerActiveLanguage=lang;computerActiveVoice=voice||computerVoiceFind(lang,computerVoiceList);
  computerVoiceFallback=false;computerVoiceMessage='';computerVoiceMessageOption='';
  computerVoicePendingChoice='';
  computerVoiceUpdateUi();
  computerVoicePlaySample(lang);
 }catch(_){}
}
function computerVoiceProcessList(list,finalAttempt){
 try{
  if(list&&list.length){
   computerVoiceList=list.slice();computerVoiceReady=true;
   if(computerVoicePendingChoice){
    var pending=computerVoicePendingChoice,found=computerVoiceFind(pending,computerVoiceList);
    if(found)computerVoiceCommitChoice(pending,found);
    else{computerVoicePendingChoice='';computerVoiceShowMissing(pending)}
   }else computerVoiceApplySavedPreference(computerVoiceList);
  }else if(finalAttempt){
   computerVoiceList=[];computerVoiceReady=true;
   if(computerVoicePendingChoice){
    var missing=computerVoicePendingChoice;computerVoicePendingChoice='';
    computerVoiceShowMissing(missing);
   }else computerVoiceApplySavedPreference([]);
  }
 }catch(_){}
}
var computerVoiceEmptyRetryPending=false;
function computerVoiceScan(finalAttempt){
 try{
  var list=computerVoiceGetVoices();
  if(list.length){
   computerVoiceEmptyRetryPending=false;
   computerVoiceProcessList(list,false);
   return;
  }
  if(finalAttempt){
   computerVoiceEmptyRetryPending=false;computerVoiceList=[];
   computerVoiceProcessList([],true);
   return;
  }
  if(computerVoiceReady&&!computerVoiceEmptyRetryPending){
   computerVoiceEmptyRetryPending=true;
   setTimeout(function(){
    try{
     var refreshed=computerVoiceGetVoices();
     computerVoiceEmptyRetryPending=false;
     if(refreshed.length)computerVoiceProcessList(refreshed,false);
     else{computerVoiceList=[];computerVoiceProcessList([],true)}
    }catch(_){computerVoiceEmptyRetryPending=false}
   },900);
  }
 }catch(_){}
}
function computerVoiceRequestChoice(lang){
 try{
  if(!computerVoiceApi)return;
  if(lang==='ar'){
   computerVoicePendingChoice='';
   computerVoiceCommitChoice('ar',computerVoiceFind('ar',computerVoiceGetVoices()));
   return;
  }
  var list=computerVoiceGetVoices();
  if(list.length)computerVoiceList=list.slice();
  var found=computerVoiceFind(lang,computerVoiceVoiceListForChoice(list));
  if(found){computerVoiceCommitChoice(lang,found);return}
  if(!list.length&&!computerVoiceReady){
   computerVoicePendingChoice=lang;computerVoiceUpdateUi();return;
  }
  computerVoiceShowMissing(lang);
 }catch(_){}
}
function computerVoiceVoiceListForChoice(list){
 return list&&list.length?list:computerVoiceList;
}
function computerVoiceSetReadButton(button,active){
 try{
  if(!button)return;
  button.setAttribute('aria-pressed',active?'true':'false');
  button.setAttribute('aria-label',active?'Stop reading aloud':'Read question aloud');
  button.classList.toggle('shb-reading-active',!!active);
  var label=button.querySelector('span');if(label)label.textContent=active?'Stop reading':'Read aloud';
 }catch(_){}
}
function computerVoiceFinishReadAloud(token){
 if(token!==computerVoiceSpeechToken)return;
 computerVoiceSetReadButton(computerVoiceReadingButton,false);
 computerVoiceReadingButton=null;
}
function computerVoiceStopQuestionReadAloud(){
 computerVoiceSpeechToken++;
 try{if(window.speechSynthesis)window.speechSynthesis.cancel()}catch(_){}
 computerVoiceSetReadButton(computerVoiceReadingButton,false);
 computerVoiceReadingButton=null;
}
function computerVoiceToggleQuestionReadAloud(card,text,button){
 try{
  if(!computerVoiceApi){computerVoiceUpdateUi();return}
  var same=!!button&&computerVoiceReadingButton===button;
  var synth=window.speechSynthesis;
  if(same&&(synth.speaking||synth.pending)){computerVoiceStopQuestionReadAloud();return}
  if(computerVoiceReadingButton||synth.speaking||synth.pending)computerVoiceStopQuestionReadAloud();
  if(!text)return;
  computerVoiceReadingButton=button||null;
  computerVoiceSetReadButton(computerVoiceReadingButton,true);
  computerVoiceSpeak(String(text),computerVoiceQuestionToolsRate());
 }catch(_){computerVoiceStopQuestionReadAloud()}
}
function computerVoiceMakeUtterance(text,lang,voice,allowFallback,rate){
 try{
  if(!computerVoiceApi||!text)return;
  var token=++computerVoiceSpeechToken;
  var utterance=new SpeechSynthesisUtterance(String(text));
  utterance.lang=(lang==='en-GB')?'en-GB':'en-US';
  var speed=Number(rate);utterance.rate=Number.isFinite(speed)?Math.max(0.7,Math.min(1.3,speed)):0.9;
  utterance.pitch=0.9;
  utterance.volume=1;
  if(voice)utterance.voice=voice;
  utterance.onend=function(){computerVoiceFinishReadAloud(token)};
  utterance.onerror=function(event){
   try{
    if(token!==computerVoiceSpeechToken)return;
    var reason=event&&event.error||'';
    if(allowFallback&&lang!=='ar'&&reason!=='canceled'&&reason!=='interrupted'){computerVoiceFallbackToArabic(text,rate);return}
    computerVoiceFinishReadAloud(token);
   }catch(_){computerVoiceFinishReadAloud(token)}
  };
  try{window.speechSynthesis.speak(utterance)}
  catch(_){if(allowFallback&&lang!=='ar')computerVoiceFallbackToArabic(text,rate);else computerVoiceFinishReadAloud(token)}
 }catch(_){if(allowFallback&&lang!=='ar')computerVoiceFallbackToArabic(text,rate)}
}
function computerVoiceFallbackToArabic(text,rate){
 /* Kept under its old name: retries once with the device's default English voice (Arabic is no longer used). */
 try{
  computerVoiceSpeechToken++;
  try{window.speechSynthesis.cancel()}catch(_){}
  var any=computerVoiceGetVoices().filter(function(v){return v.localService!==false&&/^en(?:-|$)/.test(computerVoiceNormLang(v))})[0]||null;
  computerActiveVoice=any;computerVoiceFallback=false;computerVoiceUpdateUi();
  computerVoiceMakeUtterance(text,computerVoicePreference,any,false,rate);
 }catch(_){}
}
function computerVoiceSpeak(text,rate){
 try{
  if(!computerVoiceApi||!text)return;
  var latest=computerVoiceGetVoices();
  if(latest.length){
   computerVoiceList=latest.slice();
   computerActiveLanguage=computerVoicePreference;computerActiveVoice=computerVoiceFind(computerVoicePreference,computerVoiceList);
   computerVoiceFallback=false;computerVoiceReady=true;computerVoiceUpdateUi();
  }else{computerActiveLanguage=computerVoicePreference;computerActiveVoice=null}
  computerVoiceSpeechToken++;
  try{window.speechSynthesis.cancel()}catch(_){}
  computerVoiceMakeUtterance(computerVoiceClean(text),computerActiveLanguage,computerActiveVoice,true,rate);
 }catch(_){
  try{computerVoiceFallbackToArabic(computerVoiceClean(String(text||'')))}catch(__){}
 }
}
function computerVoicePlaySample(lang){
 var samples={
  'en-US':'Welcome to Shbace Medical. Let’s study together.',
  'en-GB':'Welcome to Shbace Medical. Let’s study together.',
  'ar':'أهلاً بك في Shbace Medical. هيا نبدأ المذاكرة.'
 };
 try{
  var list=computerVoiceGetVoices();if(list.length)computerVoiceList=list.slice();
  var voice=computerVoiceFind(lang,computerVoiceList);
  computerVoiceSpeakSample(samples[lang]||samples.ar,lang,voice);
 }catch(_){}
}
function computerVoiceSpeakSample(text,lang,voice){
 try{
  if(!computerVoiceApi)return;
  try{window.speechSynthesis.cancel()}catch(_){}
  computerVoiceMakeUtterance(text,lang,voice,lang!=='ar');
 }catch(_){}
}
function computerVoiceMountSettings(){
 try{
  var root=settingsRoot();if(!root)return;
  if(!root.querySelector('#shbUnifiedVoiceSettings')){
   var card=document.createElement('section');
   card.className='card setcard';card.id='shbUnifiedVoiceSettings';
   card.innerHTML='<h3>Question voice</h3>'+
    '<p class="meta">Questions are read in English only. SHBACE picks the clearest male English voice your device provides (natural or neural voices first), reads slightly slower, and spells out medical units. English (US) is the default.</p>'+
    '<div class="shb-computer-voice-options" role="group" aria-label="Question reading voice">'+
    '<button type="button" data-shb-unified-voice="en-US" aria-pressed="false">English (US)</button>'+
    '<button type="button" data-shb-unified-voice="en-GB" aria-pressed="false">English (UK)</button>'+
    '</div>'+
    '<div class="shb-computer-voice-status" role="status" aria-live="polite" hidden><span class="shb-computer-voice-status-text"></span><button type="button" class="shb-computer-voice-dismiss" aria-label="Dismiss voice message" hidden>×</button></div>';
   root.appendChild(card);
  }
  if(!root.querySelector('#shbQuestionToolsSettings')){
   var tools=document.createElement('section');tools.className='card setcard';tools.id='shbQuestionToolsSettings';
   tools.innerHTML='<h3>Study experience</h3>'+
    '<p class="meta">Controls for study sessions and question tools on this iPhone.</p>'+
    computerVoiceQuestionToolSetting('shareQuestion','Share a question','Show the question-sharing action.')+
    computerVoiceQuestionToolSetting('copyQuestion','Copy question text','Show the copy action for notes or AI tools.')+
    computerVoiceQuestionToolSetting('readAloud','Read questions aloud','Show voice playback controls on questions.')+
    '<div class="setrow shb-question-tool-setting"><span><b>Reading speed</b><small>Applies to spoken question text.</small></span>'+
    '<div class="seg shb-question-tool-speed" role="group" aria-label="Reading speed">'+
    '<button type="button" data-shb-question-speed="slow">Slow</button>'+
    '<button type="button" data-shb-question-speed="normal">Normal</button>'+
    '<button type="button" data-shb-question-speed="fast">Fast</button></div></div>';
   root.appendChild(tools);
  }
  if(!root.querySelector('#shbStudyRemindersSettings')){
   var reminders=document.createElement('section');reminders.className='card setcard';reminders.id='shbStudyRemindersSettings';
   reminders.innerHTML='<h3>Study reminders</h3>'+
    '<p class="meta">Scheduled native reminders are not available in the iOS Home Screen app.</p>'+
    '<div class="setrow"><span><b>Copy app information</b><small>Send the copied details when reporting an app issue. No account or personal data is included.</small></span><button type="button" class="btn" id="shbCopyAppInfo">Copy app information</button></div>';
   root.appendChild(reminders);
  }
  computerVoiceUpdateUi();computerVoiceUpdateQuestionToolsUI();
 }catch(_){}
}
function computerVoiceQuestionText(card){
 try{
  if(!card)return '';
  var stem=card.querySelector('.qstem');
  var stemText=(stem&&(stem.innerText||stem.textContent)||'').replace(/^\s*Q\s*\d+\.\s*/i,'').trim();
  var options=Array.prototype.slice.call(card.querySelectorAll('.qopt')).map(function(option){
   var letter=option.querySelector('i'),value=option.querySelector('span');
   var a=(letter&&(letter.innerText||letter.textContent)||'').trim();
   var b=(value&&(value.innerText||value.textContent)||option.innerText||option.textContent||'').trim();
   return (a?a+'. ':'')+b;
  }).filter(Boolean);
  return [stemText,options.length?options.join('. '):''].filter(Boolean).join('. ');
 }catch(_){return ''}
}
var questionDecorationScheduled=false;
function scheduleQuestionDecoration(){
 if(questionDecorationScheduled)return;
 questionDecorationScheduled=true;
 var flush=function(){
  questionDecorationScheduled=false;
  computerVoiceDecorateQuestions();
 };
 if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(flush);
 else setTimeout(flush,16);
}
function computerVoiceDecorateQuestions(){
 try{
  var host=document.querySelector('#phoneContent');if(!host)return;
  var signature=[
   computerQuestionTools.shareQuestion?'1':'0',
   computerQuestionTools.copyQuestion?'1':'0',
   computerQuestionTools.readAloud?'1':'0'
  ].join(':');
  host.querySelectorAll('.qcard').forEach(function(card){
   var old=card.querySelector('.shb-question-tools'),stem=card.querySelector('.qstem');
   if(!stem)return;
   /* The observer also sees toolbar insertion. Preserve unchanged toolbars so
      our own DOM writes cannot trigger an endless remove/recreate cycle. */
   if(old&&old.dataset&&old.dataset.sig===signature)return;
   if(old)old.remove();
   var actions=[];
   if(computerQuestionTools.shareQuestion)actions.push('<button type="button" class="shb-question-tool" data-shb-question-tool="share" aria-label="Share question"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg><span>Share</span></button>');
   if(computerQuestionTools.copyQuestion)actions.push('<button type="button" class="shb-question-tool" data-shb-question-tool="copy" aria-label="Copy question"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg><span>Copy</span></button>');
   if(computerQuestionTools.readAloud)actions.push('<button type="button" class="shb-question-tool shb-computer-read-aloud" data-shb-question-tool="readAloud" aria-label="Read question aloud" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg><span>Read aloud</span></button>');
   if(!actions.length)return;
   var toolbar=document.createElement('div');toolbar.className='shb-question-tools';
   toolbar.dataset.sig=signature;
   toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Question tools');
   toolbar.innerHTML=actions.join('');
   stem.insertAdjacentElement('afterend',toolbar);
  });
 }catch(_){}
}
function computerVoiceNotify(text){try{if(typeof window.toast==='function')window.toast(text)}catch(_){}}
function computerVoiceFallbackCopy(text){
 var area=null;
 try{
  area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');
  area.style.position='fixed';area.style.opacity='0';area.style.pointerEvents='none';
  document.body.appendChild(area);area.select();
  var ok=!!(document.execCommand&&document.execCommand('copy'));
  area.remove();computerVoiceNotify(ok?'Question copied':'Could not copy question');
 }catch(_){try{if(area)area.remove()}catch(__){}computerVoiceNotify('Could not copy question')}
}
function computerVoiceCopyQuestion(text){
 if(!text)return;
 try{
  if(navigator.clipboard&&navigator.clipboard.writeText){
   navigator.clipboard.writeText(text).then(function(){computerVoiceNotify('Question copied')}).catch(function(){computerVoiceFallbackCopy(text)});
  }else computerVoiceFallbackCopy(text);
 }catch(_){computerVoiceFallbackCopy(text)}
}
function computerVoiceShareQuestion(text){
 if(!text)return;
 try{
  if(typeof navigator.share==='function'){navigator.share({title:'Shbace Medical question',text:text}).catch(function(){});return}
 }catch(_){}
 computerVoiceCopyQuestion(text);
}
function computerVoiceInstallStyles(){
 try{
  if(document.getElementById('shbComputerVoiceStyles'))return;
  var style=document.createElement('style');style.id='shbComputerVoiceStyles';
  style.textContent=[
   '.shb-computer-voice-options{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}',
   '.shb-question-tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0 12px}',
   '.shb-question-tools button.shb-question-tool{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 12px;border:1px solid rgba(91,169,255,.34);border-radius:12px;background:linear-gradient(145deg,rgba(25,81,145,.46),rgba(8,30,67,.72));color:#e7f3ff;font:700 12px/1.2 system-ui,sans-serif;cursor:pointer;touch-action:manipulation}',
   '.shb-question-tools button.shb-question-tool svg{display:block;width:17px;height:17px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
   '.shb-question-tools button.shb-question-tool:active{transform:translateY(1px) scale(.98)}',
   '.phone.light .shb-question-tools button.shb-question-tool{background:linear-gradient(145deg,#f7fbff,#e8f3ff);color:#174b7a;border-color:#c7def5}',
   '.shb-question-tool-setting>span{min-width:0;flex:1}.shb-question-tool-setting>span b,.shb-question-tool-setting>span small{display:block}',
   '.shb-question-tool-speed{flex:none;gap:5px}.shb-question-tool-speed button{font-size:10px;padding:7px 9px}',
   '@media(max-width:360px){.shb-question-tools{gap:6px}.shb-question-tools button.shb-question-tool{flex:1 1 auto;padding:8px 9px;font-size:11px}}',
   '.shb-computer-voice-options button,.shb-computer-read-aloud{appearance:none;border:1px solid rgba(91,169,255,.36);border-radius:11px;background:rgba(20,61,105,.42);color:inherit;padding:9px 13px;font:600 12px/1.3 system-ui,sans-serif;cursor:pointer}',
   '.shb-computer-voice-options button.on{border-color:#44c9ff;background:rgba(28,126,190,.28);box-shadow:0 0 0 1px rgba(68,201,255,.2)}',
   '.shb-computer-voice-options button:disabled,.shb-computer-read-aloud:disabled{opacity:.48;cursor:not-allowed}',
   '.shb-computer-voice-status{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:9px 11px;border:1px solid rgba(105,170,230,.23);border-radius:10px;background:rgba(70,130,190,.08);font-size:11px;line-height:1.45;color:var(--muted,#9db4d0)}',
   '.shb-computer-voice-status[hidden]{display:none!important}',
   '.shb-computer-voice-status-text{flex:1;min-width:0}',
   '.shb-computer-voice-dismiss{border:0;background:transparent;color:inherit;font-size:18px;line-height:1;cursor:pointer;padding:0 2px}',
   '.shb-computer-read-aloud{display:inline-flex;align-items:center;gap:6px;margin:8px 0 10px}',
   '.shb-computer-read-aloud:active{transform:translateY(1px)}',
   '.shb-af-qtool.shb-reading-active{border-color:#4fd6b2!important;background:rgba(35,160,129,.2)!important;color:#8ff0d0!important;box-shadow:0 0 0 1px rgba(79,214,178,.16)}',
   '.phone.light .shb-af-qtool.shb-reading-active{background:#e5faf3!important;color:#176c58!important;border-color:#7acdb7!important}',
   '.phone.light .shb-computer-voice-options button,.phone.light .shb-computer-read-aloud{background:#eef6ff;color:#174b7a;border-color:#c9def3}',
   '.phone.light .shb-computer-voice-options button.on{background:#dff2ff;border-color:#5aaee5}'
  ].join('');
  document.head.appendChild(style);
 }catch(_){}
}
function computerVoiceInit(){
 try{
  computerVoicePreference=computerVoiceReadPreference();
  computerVoiceApi=!!(window.speechSynthesis&&typeof window.SpeechSynthesisUtterance==='function');
  computerVoiceInstallStyles();
  if(!computerVoiceApi){computerVoiceReady=true;computerActiveLanguage='en-US';computerVoiceUpdateUi();return}
  computerVoiceApplySavedPreference(computerVoiceGetVoices());
  var synth=window.speechSynthesis;
  try{
   if(synth.addEventListener)synth.addEventListener('voiceschanged',function(){computerVoiceScan(false)});
   else{
    var old=synth.onvoiceschanged;
    synth.onvoiceschanged=function(){try{if(typeof old==='function')old.apply(this,arguments)}catch(_){}computerVoiceScan(false)};
   }
  }catch(_){}
  computerVoiceRetryDelays.forEach(function(delay,index){
   setTimeout(function(){computerVoiceScan(index===computerVoiceRetryDelays.length-1)},delay);
  });
  document.addEventListener('click',function(event){
   try{
    var copyInfo=event.target&&event.target.closest?event.target.closest('#shbCopyAppInfo'):null;
    if(copyInfo){
     event.preventDefault();event.stopPropagation();
     var info='Shbace Medical iOS app diagnostics\\n'+(navigator.userAgent||'User agent unavailable');
     if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(info).then(function(){computerVoiceNotify('App information copied')}).catch(function(){computerVoiceFallbackCopy(info)})}
     else computerVoiceFallbackCopy(info);
     return;
    }
    var questionTool=event.target&&event.target.closest?event.target.closest('[data-shb-question-tool]'):null;
    if(questionTool){
     event.preventDefault();event.stopPropagation();
     var qcard=questionTool.closest('.qcard'),qtext=computerVoiceQuestionText(qcard),kind=questionTool.getAttribute('data-shb-question-tool');
     if(kind==='share')computerVoiceShareQuestion(qtext);
     else if(kind==='copy')computerVoiceCopyQuestion(qtext);
     else if(kind==='readAloud')computerVoiceToggleQuestionReadAloud(qcard,qtext,questionTool);
     return;
    }
    var pref=event.target&&event.target.closest?event.target.closest('[data-shb-question-pref]'):null;
    if(pref){
     event.preventDefault();event.stopPropagation();
     var key=pref.getAttribute('data-shb-question-pref');
     if(Object.prototype.hasOwnProperty.call(computerQuestionTools,key)){
      computerQuestionTools[key]=!computerQuestionTools[key];computerVoiceSaveQuestionTools();
      if(key==='readAloud'&&!computerQuestionTools.readAloud)computerVoiceStopQuestionReadAloud();
      document.querySelectorAll('#phoneContent .shb-question-tools').forEach(function(node){node.remove()});
      computerVoiceDecorateQuestions();
     }
     return;
    }
    var speed=event.target&&event.target.closest?event.target.closest('[data-shb-question-speed]'):null;
    if(speed){
     event.preventDefault();event.stopPropagation();
     var nextSpeed=speed.getAttribute('data-shb-question-speed');
     if(['slow','normal','fast'].indexOf(nextSpeed)>=0){computerQuestionTools.readingSpeed=nextSpeed;computerVoiceSaveQuestionTools()}
     return;
    }
    var target=event.target&&event.target.closest?event.target.closest('[data-shb-unified-voice]'):null;
    if(target){
     event.preventDefault();event.stopPropagation();
     computerVoiceRequestChoice(target.getAttribute('data-shb-unified-voice'));
     return;
    }
    var dismiss=event.target&&event.target.closest?event.target.closest('.shb-computer-voice-dismiss'):null;
    if(dismiss){
     event.preventDefault();computerVoiceMessage='';computerVoiceMessageOption='';computerVoiceUpdateUi();return;
    }
    var read=event.target&&event.target.closest?event.target.closest('[data-shb-unified-read-aloud]'):null;
    if(read){
     event.preventDefault();event.stopPropagation();
     var card=read.closest('.qcard'),text=computerVoiceQuestionText(card);
     if(text)computerVoiceSpeak(text);
    }
   }catch(_){}
  },true);
 }catch(_){}
}
window.__shbUnifiedSpeakText=function(text,rate){computerVoiceSpeak(text,rate)};
window.__shbUnifiedToggleQuestionReadAloud=function(card,text,button){computerVoiceToggleQuestionReadAloud(card,text,button)};
computerVoiceInit();

function mountVoiceSettings(){
 try{
  computerVoiceMountSettings();
  if(typeof window.__shbOrganizeSettings==='function')window.__shbOrganizeSettings();
 }catch(_){}
}
/* Observe only screen replacement at the app viewport. Nested card/toolbar writes
   are outside this observer, so our own DOM changes cannot retrigger it. */
try{
 var questionHost=document.getElementById('phoneContent');
 if(questionHost&&window.MutationObserver)new MutationObserver(function(){
  mountVoiceSettings();scheduleQuestionDecoration();
 }).observe(questionHost,{childList:true});
}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountVoiceSettings,{once:true});else mountVoiceSettings();
computerVoiceMountSettings();
computerVoiceDecorateQuestions();

/* iPhone/PWA-compatible study experience controls.
   Android-only haptics and scheduled native reminders are intentionally not exposed here. */
var IOS_EXPERIENCE_KEY='shbace_ios_study_experience_v1';
var iosStudyPrefs=(function(){
 try{
  var saved=JSON.parse(localStorage.getItem(IOS_EXPERIENCE_KEY)||'null');
  return Object.assign({followSystemTheme:true,keepScreenAwake:true},
    saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{});
 }catch(_){return {followSystemTheme:true,keepScreenAwake:true}}
})();
var iosStudyMedia=null,iosStudyWakeLock=null,iosStudyWakeBusy=false,iosStudyThemeDriven=false;
var iosStudyWakeStatus='';
function iosStudySave(){try{localStorage.setItem(IOS_EXPERIENCE_KEY,JSON.stringify(iosStudyPrefs))}catch(_){}}
function iosStudyWakeSupported(){
 try{return !!(window.isSecureContext!==false&&navigator.wakeLock&&typeof navigator.wakeLock.request==='function')}catch(_){return false}
}
function iosStudyThemeUpdate(){
 if(!iosStudyPrefs.followSystemTheme)return;
 try{
  if(!iosStudyMedia)iosStudyMedia=window.matchMedia('(prefers-color-scheme: light)');
  var theme=iosStudyMedia.matches?'light':'dark';
  if(typeof window.setSet==='function'&&window.__SET&&window.__SET.theme!==theme){
   iosStudyThemeDriven=true;
   try{window.setSet('theme',theme)}finally{iosStudyThemeDriven=false}
  }else{
   var phone=document.querySelector('.phone');
   if(phone)phone.classList.toggle('light',theme==='light');
   document.body.classList.toggle('light',theme==='light');
  }
 }catch(_){}
 iosStudyUpdateUI();
}
function iosStudyUnbindTheme(){
 try{if(iosStudyMedia){
  if(iosStudyMedia.removeEventListener)iosStudyMedia.removeEventListener('change',iosStudyThemeUpdate);
  else if(iosStudyMedia.removeListener)iosStudyMedia.removeListener(iosStudyThemeUpdate);
 }}catch(_){}
}
function iosStudyBindTheme(){
 try{
  if(!window.matchMedia)return;
  iosStudyMedia=window.matchMedia('(prefers-color-scheme: light)');
  if(iosStudyMedia.addEventListener)iosStudyMedia.addEventListener('change',iosStudyThemeUpdate);
  else if(iosStudyMedia.addListener)iosStudyMedia.addListener(iosStudyThemeUpdate);
  iosStudyThemeUpdate();
 }catch(_){}
}
if(typeof window.setSet==='function'&&!window.__shbIosThemePreferenceWrapped){
 var iosOriginalSetSet=window.setSet;
 window.setSet=function(key,value){
  if(key==='theme'&&!iosStudyThemeDriven&&iosStudyPrefs.followSystemTheme){
   iosStudyPrefs.followSystemTheme=false;iosStudySave();iosStudyUnbindTheme();
  }
  var result=iosOriginalSetSet.apply(this,arguments);
  iosStudyUpdateUI();return result;
 };
 window.__shbIosThemePreferenceWrapped=true;
}
function iosStudyQuestionBankOpen(){
 try{return !!document.querySelector('#phoneContent .rs.qb')||!!document.querySelector('#phoneContent .qcard')}catch(_){return false}
}
function iosStudyReleaseWakeLock(){
 if(!iosStudyWakeLock)return;
 var lock=iosStudyWakeLock;iosStudyWakeLock=null;
 try{lock.release().catch(function(){})}catch(_){}
}
function iosStudySyncWakeLock(){
 var should=iosStudyPrefs.keepScreenAwake&&iosStudyWakeSupported()&&iosStudyQuestionBankOpen()&&!document.hidden;
 if(!should){iosStudyReleaseWakeLock();return}
 if(iosStudyWakeLock||iosStudyWakeBusy)return;
 iosStudyWakeBusy=true;
 try{
  navigator.wakeLock.request('screen').then(function(lock){
   iosStudyWakeLock=lock;iosStudyWakeStatus='';
   try{lock.addEventListener('release',function(){if(iosStudyWakeLock===lock)iosStudyWakeLock=null})}catch(_){}
   iosStudyUpdateUI();
  }).catch(function(){
   iosStudyWakeStatus='The device did not grant screen wake lock. Keep the app open and use a supported iOS Home Screen version.';
   iosStudyUpdateUI();
  }).finally(function(){iosStudyWakeBusy=false});
 }catch(_){iosStudyWakeBusy=false}
}
function iosStudyToggleMarkup(key,title,description,disabled){
 var on=!!iosStudyPrefs[key];
 return '<div class="setrow shb-ios-study-row"><span><b>'+title+'</b><small>'+description+'</small></span>'+
  '<button type="button" class="drsw '+(on?'on':'')+'" role="switch" aria-checked="'+on+'" aria-label="'+title+'" data-shb-ios-experience="'+key+'" '+(disabled?'disabled':'')+'><i></i><span>'+(on?'ON':'OFF')+'</span></button></div>';
}
function iosStudyMountSettings(){
 try{
  var root=settingsRoot();if(!root)return;
  /* These controls share the To Me Study experience card; only the iPhone-safe
     appearance and Screen Wake Lock options are added on this platform. */
  var card=root.querySelector('#shbQuestionToolsSettings');
  if(!card){computerVoiceMountSettings();card=root.querySelector('#shbQuestionToolsSettings')}
  if(card&&!card.querySelector('[data-shb-ios-experience]')){
   card.insertAdjacentHTML('beforeend',
    iosStudyToggleMarkup('keepScreenAwake','Keep screen awake','Prevent the display from sleeping while the Question Bank is open.',!iosStudyWakeSupported())+
    iosStudyToggleMarkup('followSystemTheme','Follow device theme','Automatically match device light or dark appearance.',false)+
    '<p class="meta shb-ios-study-status" id="shbIosStudyWakeStatus" role="status" aria-live="polite"></p>');
  }
  iosStudyUpdateUI();
  if(typeof window.__shbOrganizeSettings==='function')window.__shbOrganizeSettings();
 }catch(_){}
}
function iosStudyUpdateUI(){
 try{
  var root=document.getElementById('shbQuestionToolsSettings');if(!root)return;
  root.querySelectorAll('[data-shb-ios-experience]').forEach(function(button){
   var key=button.getAttribute('data-shb-ios-experience'),on=!!iosStudyPrefs[key];
   button.classList.toggle('on',on);button.setAttribute('aria-checked',String(on));
   var label=button.querySelector('span');if(label)label.textContent=on?'ON':'OFF';
  });
  var status=root.querySelector('#shbIosStudyWakeStatus');
  if(status)status.textContent=!iosStudyWakeSupported()
   ?'Screen wake lock is unavailable in this browser. On iPhone, use an up-to-date iOS Home Screen app (iOS 18.4 or newer).'
   :iosStudyWakeStatus||'Screen wake lock is active only while the Question Bank is open.';
 }catch(_){}
}
document.addEventListener('click',function(event){
 try{
  var button=event.target&&event.target.closest?event.target.closest('[data-shb-ios-experience]'):null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();
  var key=button.getAttribute('data-shb-ios-experience');
  if(key!=='followSystemTheme'&&key!=='keepScreenAwake')return;
  if(key==='keepScreenAwake'&&!iosStudyWakeSupported())return;
  iosStudyPrefs[key]=!iosStudyPrefs[key];iosStudySave();
  if(key==='followSystemTheme'){
   if(iosStudyPrefs.followSystemTheme)iosStudyBindTheme();
   else iosStudyUnbindTheme();
  }else{iosStudyWakeStatus='';iosStudySyncWakeLock()}
  iosStudyUpdateUI();
 }catch(_){}
},true);
document.addEventListener('visibilitychange',function(){
 if(document.hidden)iosStudyReleaseWakeLock();else iosStudySyncWakeLock();
});
window.addEventListener('pagehide',iosStudyReleaseWakeLock);
var iosStudyMountQueued=false;
function iosStudyScheduleMount(){
 if(iosStudyMountQueued)return;iosStudyMountQueued=true;
 var flush=function(){iosStudyMountQueued=false;iosStudyMountSettings();iosStudySyncWakeLock()};
 if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(flush);else setTimeout(flush,16);
}
try{
 var iosStudyHost=document.getElementById('phoneContent');
 if(iosStudyHost&&window.MutationObserver)new MutationObserver(iosStudyScheduleMount).observe(iosStudyHost,{childList:true});
}catch(_){}
if(iosStudyPrefs.followSystemTheme)iosStudyBindTheme();
iosStudyMountSettings();iosStudySyncWakeLock();
window.shbaceSyncIosStudyExperience=iosStudySyncWakeLock;

})();
