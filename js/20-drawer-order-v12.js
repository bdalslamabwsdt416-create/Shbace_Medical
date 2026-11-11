/* Android 1.3 drawer: task-focused order, no count badges. iOS/PWA keeps its own menu. */
(function(){try{
 const cap=window.Capacitor;
 const android=!!(cap&&cap.isNativePlatform&&cap.isNativePlatform()&&(!cap.getPlatform||cap.getPlatform()==='android'));
 if(!android)return;
 const all=[];DR2.forEach(g=>g[1].forEach(it=>all.push(it)));
 const find=(names)=>all.find(it=>names.some(n=>String(it[0]||'').toLowerCase()===n.toLowerCase()));
 const item=(names,label,page,icon)=>{
   const it=find(names);
   const out=it||[label,page,icon||'', ''];
   out[0]=label;out[1]=page;out[2]=icon||out[2]||'';out[3]='';
   return out;
 };
 const smart=item(['Smart review'],'Smart Review','review','<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>');
 const wrong=item(['Wrong answers'],'Wrong Answers','wrong','<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>');
 const saved=item(['Saved questions'],'Saved Questions','saved','<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>');
 const notes=item(['My Notes'],'My Notes','notes','<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>');
 const pinned=item(['Pinned & Recent','Pinned'],'Pinned & Recent','pinned','<path d="M9 3h6l-1 6 3 3H7l3-3z"/><path d="M12 12v9"/>');
 const planner=['Exam goal planner','examgoal','<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/><path d="M8 14h3M8 17h7"/>',''];
 const timer=item(['Study timer'],'Study Timer','timer','<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>');
 const stats=item(['Statistics','Study Statistics'],'Statistics','stats','<path d="M5 20V10M12 20V4M19 20v-7"/>');
 const weak=item(['Weak areas'],'Weak Areas','weak','<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>');
 const settings=item(['Settings'],'Settings','settings','<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>');
 const contact=item(['Contact & Feedback','Contact and feedback'],'Contact & Feedback','feedback','<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>');
 const changelog=item(['Changelog'],'Changelog','changelog','<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>');
 const about=item(['About'],'About','about','<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>');
 const rate=item(['Rate this app','Rate This Website'],'Rate this app','rate','<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>');
 const groups=[
  ['REVIEW',[smart,wrong,saved,notes,pinned]],
  ['YOUR PROGRESS',[planner,timer,stats,weak]],
  ['APP & SUPPORT',[settings,contact,changelog,about,rate]]
 ];
 DR2.length=0;groups.forEach(g=>DR2.push(g));
 DR2.forEach(g=>g[1].forEach(it=>it[3]=''));
 window.__shbAndroidDrawerV13=true;
}catch(e){console.warn('Android drawer order:',e)}})();
