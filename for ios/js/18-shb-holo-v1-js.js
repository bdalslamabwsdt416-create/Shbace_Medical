
/* SHBHolo.set({size:1, y:0, speed:1, pulse:.022, glow:1, halo:1, ecg:1})  -> live tuning without touching onboarding code */
(function(){
 const MAP={size:'--holo-size',y:'--holo-y',speed:'--holo-speed',pulse:'--holo-pulse',glow:'--holo-glow',halo:'--holo-halo',ecg:'--holo-ecg'};
 const root=document.documentElement;
 root.style.setProperty('--holo-url','url("'+window.SHB_HOLO_SRC+'")');
 const cfg=window.SHB_HOLO_CONFIG||{};
 function set(o){for(const k in o){if(!MAP[k])continue;let v=o[k];if(k==='y'&&typeof v==='number')v+='px';root.style.setProperty(MAP[k],String(v))}}
 set(cfg);window.SHBHolo={set:set,vars:MAP};
})();
