
/* Home menu: exact section + item order. Items keep their own page targets / badges; only grouping, labels and order change. */
(function(){try{
 const all=[];DR2.forEach(g=>g[1].forEach(it=>all.push(it)));
 const by=n=>all.find(it=>it[0]===n);
 const pinned=by('Pinned & Recent')||by('Pinned');
 const contact=by('Contact and feedback')||by('Contact & Feedback');if(contact)contact[0]='Contact & Feedback';
 const learn=DR2[0],review=DR2[1];
 /* Pinned & Recent is not part of "Your progress": it sits with the study-library items, right after Smart review */
 const rv=review[1],si=rv.findIndex(it=>/^smart review$/i.test(it[0]));
 if(pinned&&rv.indexOf(pinned)<0)rv.splice(si>=0?si+1:rv.length,0,pinned);
 const pick=n=>by(n);
 const SHOW_LEARN=false;   /* Learn section is hidden for now: set to true to show it again */
 const groups=[
  ...(SHOW_LEARN?[learn]:[]),review,
  ['Your progress',[pick('Statistics'),['Weak areas','weak','<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/><circle cx=\"16\" cy=\"8\" r=\"2.2\"/>'],pick('Study timer')].filter(Boolean)],
  ['Updates',[pick('Notifications')].filter(Boolean)],
  ['App & support',['Settings','Contact & Feedback','Changelog','About','Rate this app'].map(pick).filter(Boolean)]
 ];
 DR2.length=0;groups.forEach(g=>DR2.push(g));
}catch(e){console.warn('Menu order:',e)}})();
