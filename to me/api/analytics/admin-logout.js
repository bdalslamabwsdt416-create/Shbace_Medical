'use strict';
const a=require('../../lib/usage-analytics');
module.exports=function adminLogout(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return a.sendJson(res,405,{error:'method_not_allowed'});}
  if(!a.sameOrigin(req))return a.sendJson(res,403,{error:'origin_not_allowed'});
  a.clearCookie(res);return a.sendJson(res,200,{authenticated:false});
};
