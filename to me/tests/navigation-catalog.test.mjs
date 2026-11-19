import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const navigationSource = readFileSync(resolve(root, "js/51-navigation-contract-v1.js"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "modules/routes.v1.json"), "utf8"));
const feature = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");
const coreMain = readFileSync(resolve(root, "js/04-app-main.js"), "utf8");
const examPlanner = readFileSync(resolve(root, "js/36-exam-planner-settings-smartreview.js"), "utf8");
const remoteContent = readFileSync(resolve(root, "js/45-android-remote-content.js"), "utf8");
const remoteUi = readFileSync(resolve(root, "js/46-android-remote-ui.js"), "utf8");
const remoteControl = readFileSync(resolve(root, "js/47-android-remote-control.js"), "utf8");
const index = readFileSync(resolve(root, "index.html"), "utf8");
const gradle = readFileSync(resolve(root, "../android/app/build.gradle"), "utf8");

function createRuntime(platform = "android") {
  const listeners = new Map();
  const services = new Map();
  const diagnostics = [];
  const events = {
    emit(name, payload) {
      for (const handler of listeners.get(name) || []) handler(payload);
    },
    on(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
      return () => listeners.get(name)?.delete(handler);
    }
  };
  let renderCount = 0;
  let backCount = 0;
  const window = {
    Capacitor:{getPlatform:()=>platform,isNativePlatform:()=>platform==="android"},
    SHBACECore:{
      events,
      services:{
        register(name,value){if(services.has(name))return {ok:false};services.set(name,value);return {ok:true};},
        get(name){return services.get(name)||null;}
      },
      diagnostics:{record:(...args)=>diagnostics.push(args)}
    },
    __shbGetBackTarget:(id)=>id==="questions"?"topics":id==="quizresult"?"quizhistory":id==="examplanner"?"subjects":"subjects",
    navBack(){backCount++;},
    renderAppDemo(){renderCount++;}
  };
  const context = vm.createContext({window,console,Date,Map,Set,Object,Array,String,Number,JSON});
  vm.runInContext("var appPage='subjects'; var mode='app';",context);
  context.window.renderAppDemo = function(){renderCount++;};
  vm.runInContext(navigationSource,context,{filename:"51-navigation-contract-v1.js"});
  return {window,context,renderCount:()=>renderCount,backCount:()=>backCount,diagnostics};
}

test("navigation catalog activates only in the native Android APK",()=>{
  const android=createRuntime("android");
  assert.equal(android.window.SHBACENavigation.platform,"android");
  const chrome=createRuntime("web");
  assert.equal(chrome.window.SHBACENavigation,undefined);
});

test("route catalogue covers the inspected built-in and registered local screens",()=>{
  const ids=manifest.routes.map(route=>route.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of [
    "subjects","grade","specialties","topics","questions","quiz","quizrun","quizresult",
    "quizhistory","review","weak","stats","search","settings","notifs","saved","wrong",
    "notes","pinned","reported","timer","examplanner","shbRemoteFlashcards","about",
    "dedication","changelog","feedback","rate","menu"
  ]) assert.ok(ids.includes(id),"missing route "+id);
  assert.equal(manifest.registeredLocalPages.find(page=>page.id==="examplanner").backTarget,"subjects");
  assert.equal(manifest.registeredLocalPages.find(page=>page.id==="shbRemoteFlashcards").backTarget,"subjects");
  assert.equal(manifest.dynamicRemotePage.routePrefix,"shbRemotePage_");
});

test("manifest mirrors the current Android V2 and V3 remote allow-lists",()=>{
  const v2=(remoteUi.match(/var BUILTIN_PAGES = \{([\s\S]*?)\};/)||[])[1]||"";
  const v3=(remoteControl.match(/var BUILTIN = \{([\s\S]*?)\};/)||[])[1]||"";
  const keys=source=>Array.from(source.matchAll(/([A-Za-z0-9_]+):1/g),m=>m[1]).sort();
  assert.deepEqual(manifest.remoteAllowLists.androidRemoteUiV1.slice().sort(),keys(v2));
  assert.deepEqual(manifest.remoteAllowLists.androidRemoteControlV3.slice().sort(),keys(v3));
});

test("manifest back targets match the existing BACKP map and registerPage exceptions",()=>{
  const block=(feature.match(/const BACKP=\{([^}]+)\}/)||[])[1]||"";
  const actual=new Map(Array.from(block.matchAll(/([A-Za-z0-9_]+):'([^']+)'/g),m=>[m[1],m[2]]));
  const later=(feature.match(/BACKP\.saved='subjects'[\s\S]{0,120}/)||[])[0]||"";
  for(const route of manifest.routes){
    if(actual.has(route.id)) assert.equal(route.backTarget,actual.get(route.id),"BACKP mismatch: "+route.id);
  }
  for(const id of ["examplanner","shbRemoteFlashcards"]){
    const page=manifest.routes.find(route=>route.id===id);
    assert.match(id==="examplanner"?examPlanner:remoteContent,new RegExp("__shbRegisterPage\\\\('"+id+"'"));
    assert.equal(page.backTarget,"subjects");
  }
  assert.match(later,/BACKP\.notes='subjects'/);
  assert.match(feature,/window\.__shbGetBackTarget=function/);
});

test("core shell and page-registry renderer families have source evidence",()=>{
  for(const route of manifest.routes.filter(route=>route.renderer==="core-switch")){
    assert.match(coreMain,new RegExp("appPage==='"+route.id+"'"));
  }
  assert.match(feature,/const PAGES=\{/);
  assert.match(feature,/PAGES\.grade=gradeView/);
  assert.match(feature,/PAGES\.reported=reportedView/);
  assert.match(feature,/PAGES\.notes=myNotesView/);
});

test("history inventory reflects local browser history, not cross-device sync",()=>{
  assert.deepEqual(manifest.renderModel.historyStateFields,["m","s","p","c"]);
  const history=readFileSync(resolve(root,"js/10-history-sync.js"),"utf8");
  for(const key of ["m:mode","s:slide","p:appPage","c:collection()"]) assert.ok(history.includes(key));
  assert.match(manifest.renderModel.historyNote,/not cross-device/);
});

test("navigation API returns route metadata, respects wildcard back, and does not accept unknown routes",()=>{
  const runtime=createRuntime("android");
  const api=runtime.window.SHBACENavigation;
  assert.ok(api.get("questions"));
  assert.equal(api.resolveBackTarget("questions"),"topics");
  assert.equal(api.resolveBackTarget("quizresult"),"quizhistory");
  assert.equal(api.navigate("quiz").ok,true);
  assert.equal(api.current().id,"quiz");
  assert.equal(api.navigate("not-a-real-route").reason,"unknown-route");
  assert.equal(api.isRemoteTarget("grade","v3"),true);
  assert.equal(api.isRemoteTarget("grade","v2"),false);
});

test("route observer emits a route change after the real renderer is called",()=>{
  const runtime=createRuntime("android");
  const changes=[];
  runtime.window.SHBACENavigation.onChange(event=>changes.push(event));
  assert.equal(runtime.window.SHBACENavigation.navigate("stats").ok,true);
  assert.equal(changes.length,1);
  assert.equal(changes[0].from,"subjects");
  assert.equal(changes[0].to,"stats");
});

test("Back adapter delegates to the existing navBack function for routes with a shared Back target",()=>{
  const runtime=createRuntime("android");
  assert.equal(runtime.window.SHBACENavigation.navigate("stats").ok,true);
  const result=runtime.window.SHBACENavigation.back();
  assert.equal(result.ok,true);
  assert.equal(runtime.backCount(),1);
});

test("loader order, module registration and frozen Android version are preserved",()=>{
  const p50=index.indexOf('data-src="js/50-module-registry-v1.js"');
  const p51=index.indexOf('data-src="js/51-navigation-contract-v1.js"');
  assert.ok(p50>=0&&p51>p50);
  assert.match(gradle,/versionName\s+"1\.3\.9"/);
  assert.match(gradle,/versionCode\s+18/);
});

test("navigation adapter never rewrites student stores or executes remote code",()=>{
  assert.doesNotMatch(navigationSource,/localStorage\.|indexedDB\.|eval\s*\(|new Function\s*\(/);
});
