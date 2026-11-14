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
  computerVoiceSpeak(String(text),0.92);
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
  var root=settingsRoot();if(!root||root.querySelector('#shbUnifiedVoiceSettings'))return;
  var card=document.createElement('section');
  card.className='card setcard';card.id='shbUnifiedVoiceSettings';
  card.innerHTML='<h3>Question voice</h3>'+
   '<p class="meta">Questions are read in English only. SHBACE picks the clearest male English voice your device provides (natural or neural voices first), reads slightly slower, and spells out medical units. English (US) is the default.</p>'+
   '<div class="shb-computer-voice-options" role="group" aria-label="Question reading voice">'+
   '<button type="button" data-shb-unified-voice="en-US" aria-pressed="false">English (US)</button>'+
   '<button type="button" data-shb-unified-voice="en-GB" aria-pressed="false">English (UK)</button>'+
   '</div>'+
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

function mountVoiceSettings(){try{computerVoiceMountSettings()}catch(_){}}
try{
 var ob=new MutationObserver(function(){mountVoiceSettings()});
 if(document.body)ob.observe(document.body,{childList:true,subtree:true});
}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountVoiceSettings,{once:true});else mountVoiceSettings();
computerVoiceMountSettings();
})();
