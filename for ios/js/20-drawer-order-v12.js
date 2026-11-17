/* Home menu: align To Me section order while retaining the native iOS page handlers. */
(function(){try{
 const all=[];DR2.forEach(g=>g[1].forEach(it=>all.push(it)));
 const by=n=>all.find(it=>String(it[0]||'').toLowerCase()===String(n).toLowerCase());
 const pick=n=>by(n);
 const pinned=pick('Pinned & Recent')||pick('Pinned');
 const contact=pick('Contact and feedback')||pick('Contact & Feedback');
 if(contact)contact[0]='Contact & Feedback';
 const reviewItems=[
  pick('Smart Review'),pick('Wrong answers'),pick('Saved questions'),pick('My Notes'),pinned
 ].filter(Boolean);
 const groups=[
  ['REVIEW',reviewItems],
  ['YOUR PROGRESS',[
   ['Exam goal planner','examplanner','<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
   pick('Study timer'),
   pick('Statistics'),
   ['Weak Areas','weak','<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><circle cx="16" cy="8" r="2.2"/>']
  ].filter(Boolean)],
  ['APP & SUPPORT',['Settings','Contact & Feedback','Changelog','About','Rate this app'].map(pick).filter(Boolean)]
 ];
 /* To Me removes numeric menu badges; do the same without importing its Android module. */
 all.forEach(function(item){if(item)item[3]=''});
 DR2.length=0;groups.forEach(g=>DR2.push(g));
}catch(e){console.warn('Menu order:',e)}})();
