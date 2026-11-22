'use strict';
const a=require('../../lib/usage-analytics');
module.exports=async function adminSummary(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return a.sendJson(res,405,{error:'method_not_allowed'});}
  if(!a.hasSession(req))return a.sendJson(res,401,{error:'admin_auth_required'});
  const url=new URL(req.url,'https://'+(req.headers.host||'localhost'));
  const platform=url.searchParams.get('platform')||'all', page=Number(url.searchParams.get('page')||1);
  if(!['all','pwa','android'].includes(platform))return a.sendJson(res,400,{error:'invalid_platform'});
  if(!Number.isInteger(page)||page<1||page>10000)return a.sendJson(res,400,{error:'invalid_page'});
  try{return a.sendJson(res,200,await a.summary(platform,page,50));}
  catch(e){return a.sendJson(res,503,{error:e.message==='analytics_database_not_configured'?'analytics_database_not_configured':'analytics_summary_unavailable'});}
};
