/* SHBACE Medical · unified Chrome voice preferences and speech engine. */
(function(){
'use strict';
function settingsRoot(){
 try{var root=document.querySelector('#phoneContent .rs'),h=root&&root.querySelector('h1');return root&&h&&/^settings$/i.test((h.textContent||'').trim())?root:null}catch(_){return null}
}
/* Unified offline-aware question voice for Chrome on phone and computer. */
var UNIFIED_VOICE_KEY='shbace_unified_voice_language_v1';
var computerVoiceApi=false,computerVoicePreference='en-US',computerActiveLanguage='ar';
var computerActiveVoice=null,computerVoiceList=[],computerVoiceReady=false;
var computerVoiceFallback=false,computerVoiceFallbackFor='en-US';
var computerVoiceMessage='',computerVoiceMessageOption='',computerVoicePendingChoice='';
var computerVoiceNoticesShown={},computerVoiceSpeechToken=0;
var computerVoiceRetryDelays=[250,650,1300,2600];
function computerVoiceLanguageLabel(lang){
 return lang==='en-GB'?'English (UK)':lang==='ar'?'Arabic':'English (US)';
}
function computerVoiceReadPreference(){
 try{
  var saved=localStorage.getItem(UNIFIED_VOICE_KEY);
  return saved==='ar'||saved==='en-GB'||saved==='en-US'?saved:'en-US';
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
function computerVoiceFind(lang,list){
 try{
  var candidates=(list||computerVoiceList).filter(function(v){return computerVoiceMatches(v,lang)});
  candidates.sort(function(a,b){
   function score(v){
    var l=computerVoiceNormLang(v),exact=lang==='ar'?l==='ar':l===lang.toLowerCase();
    return (v.localService===true?100:v.localService===false?0:45)+(exact?25:0)+(v.default?3:0);
   }
   return score(b)-score(a);
  });
  return candidates[0]||null;
 }catch(_){return null}
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
  var voice=computerVoicePreference==='ar'?computerVoiceFind('ar',list):computerVoiceFind(computerVoicePreference,list);
  if(computerVoicePreference==='ar'){
   computerActiveLanguage='ar';computerActiveVoice=voice;computerVoiceFallback=false;
  }else if(voice){
   computerActiveLanguage=computerVoicePreference;computerActiveVoice=voice;computerVoiceFallback=false;
  }else{
   computerActiveLanguage='ar';computerActiveVoice=computerVoiceFind('ar',list);computerVoiceFallback=true;
   computerVoiceFallbackFor=computerVoicePreference;
  }
  computerVoiceUpdateUi();
 }catch(_){
  computerActiveLanguage='ar';computerActiveVoice=null;computerVoiceFallback=computerVoicePreference!=='ar';
  computerVoiceFallbackFor=computerVoicePreference;computerVoiceUpdateUi();
 }
}
function computerVoiceCommitChoice(lang,voice){
 try{
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
function computerVoiceMakeUtterance(text,lang,voice,allowFallback,rate){
 try{
  if(!computerVoiceApi||!text)return;
  var token=++computerVoiceSpeechToken;
  var utterance=new SpeechSynthesisUtterance(String(text));
  utterance.lang=lang==='ar'?'ar':lang;
  var speed=Number(rate);utterance.rate=Number.isFinite(speed)?Math.max(0.7,Math.min(1.3,speed)):1;
  if(voice)utterance.voice=voice;
  utterance.onerror=function(event){
   try{
    if(token!==computerVoiceSpeechToken||!allowFallback)return;
    var reason=event&&event.error||'';
    if(reason==='canceled'||reason==='interrupted')return;
    computerVoiceFallbackToArabic(text,rate);
   }catch(_){}
  };
  try{window.speechSynthesis.speak(utterance)}
  catch(_){if(allowFallback&&lang!=='ar')computerVoiceFallbackToArabic(text)}
 }catch(_){if(allowFallback&&lang!=='ar')computerVoiceFallbackToArabic(text)}
}
function computerVoiceFallbackToArabic(text,rate){
 try{
  computerVoiceSpeechToken++;
  try{window.speechSynthesis.cancel()}catch(_){}
  computerActiveLanguage='ar';computerActiveVoice=computerVoiceFind('ar',computerVoiceGetVoices());
  computerVoiceFallback=computerVoicePreference!=='ar';
  computerVoiceFallbackFor=computerVoicePreference;
  computerVoiceUpdateUi();
  computerVoiceMakeUtterance(text,'ar',computerActiveVoice,false,rate);
 }catch(_){}
}
function computerVoiceSpeak(text,rate){
 try{
  if(!computerVoiceApi||!text)return;
  var latest=computerVoiceGetVoices();
  if(latest.length){
   computerVoiceList=latest.slice();
   var preferred=computerVoiceFind(computerVoicePreference,computerVoiceList);
   if(computerVoicePreference==='ar'){
    computerActiveLanguage='ar';computerActiveVoice=computerVoiceFind('ar',computerVoiceList);computerVoiceFallback=false;
   }else if(preferred){
    computerActiveLanguage=computerVoicePreference;computerActiveVoice=preferred;computerVoiceFallback=false;
   }else{
    computerActiveLanguage='ar';computerActiveVoice=computerVoiceFind('ar',computerVoiceList);
    computerVoiceFallback=true;computerVoiceFallbackFor=computerVoicePreference;
   }
   computerVoiceReady=true;computerVoiceUpdateUi();
  }else if(computerVoiceReady&&computerVoicePreference!=='ar'){
   computerVoiceList=[];computerActiveLanguage='ar';computerActiveVoice=null;
   computerVoiceFallback=true;computerVoiceFallbackFor=computerVoicePreference;computerVoiceUpdateUi();
  }else if(computerVoicePreference==='ar'){
   computerActiveLanguage='ar';computerActiveVoice=null;
  }
  try{window.speechSynthesis.cancel()}catch(_){}
  var lang=computerActiveLanguage,voice=computerActiveVoice;
  computerVoiceMakeUtterance(String(text),lang,voice,lang!=='ar',rate);
 }catch(_){
  try{computerVoiceFallbackToArabic(String(text||''))}catch(__){}
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
  var root=settingsRoot();if(!root||root.querySelector('#shbUnifiedVoiceSettings'))return;
  var card=document.createElement('section');
  card.className='card setcard';card.id='shbUnifiedVoiceSettings';
  card.innerHTML='<h3>Question voice</h3>'+
   '<p class="meta">Choose the voice used when reading questions aloud. English (US) is the default; Arabic is used automatically when it is unavailable.</p>'+
   '<div class="shb-computer-voice-options" role="group" aria-label="Question reading voice">'+
   '<button type="button" data-shb-unified-voice="en-US" aria-pressed="false">English (US)</button>'+
   '<button type="button" data-shb-unified-voice="en-GB" aria-pressed="false">English (UK)</button>'+
   '<button type="button" data-shb-unified-voice="ar" aria-pressed="false">Arabic</button></div>'+
   '<div class="shb-computer-voice-status" role="status" aria-live="polite" hidden><span class="shb-computer-voice-status-text"></span><button type="button" class="shb-computer-voice-dismiss" aria-label="Dismiss voice message" hidden>×</button></div>';
  root.appendChild(card);computerVoiceUpdateUi();
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
function computerVoiceDecorateQuestions(){ /* Unified Share / Copy / Read aloud toolbar is mounted by 30. */ }
function computerVoiceInstallStyles(){
 try{
  if(document.getElementById('shbComputerVoiceStyles'))return;
  var style=document.createElement('style');style.id='shbComputerVoiceStyles';
  style.textContent=[
   '.shb-computer-voice-options{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}',
   '.shb-computer-voice-options button,.shb-computer-read-aloud{appearance:none;border:1px solid rgba(91,169,255,.36);border-radius:11px;background:rgba(20,61,105,.42);color:inherit;padding:9px 13px;font:600 12px/1.3 system-ui,sans-serif;cursor:pointer}',
   '.shb-computer-voice-options button.on{border-color:#44c9ff;background:rgba(28,126,190,.28);box-shadow:0 0 0 1px rgba(68,201,255,.2)}',
   '.shb-computer-voice-options button:disabled,.shb-computer-read-aloud:disabled{opacity:.48;cursor:not-allowed}',
   '.shb-computer-voice-status{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:9px 11px;border:1px solid rgba(105,170,230,.23);border-radius:10px;background:rgba(70,130,190,.08);font-size:11px;line-height:1.45;color:var(--muted,#9db4d0)}',
   '.shb-computer-voice-status[hidden]{display:none!important}',
   '.shb-computer-voice-status-text{flex:1;min-width:0}',
   '.shb-computer-voice-dismiss{border:0;background:transparent;color:inherit;font-size:18px;line-height:1;cursor:pointer;padding:0 2px}',
   '.shb-computer-read-aloud{display:inline-flex;align-items:center;gap:6px;margin:8px 0 10px}',
   '.shb-computer-read-aloud:active{transform:translateY(1px)}',
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
  if(!computerVoiceApi){computerVoiceReady=true;computerVoiceActiveLanguage='ar';computerVoiceUpdateUi();return}
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
computerVoiceInit();

function mountVoiceSettings(){try{computerVoiceMountSettings()}catch(_){}}
try{
 var ob=new MutationObserver(function(){mountVoiceSettings()});
 if(document.body)ob.observe(document.body,{childList:true,subtree:true});
}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountVoiceSettings,{once:true});else mountVoiceSettings();
computerVoiceMountSettings();
})();
