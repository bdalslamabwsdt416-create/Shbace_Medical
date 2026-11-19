import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = readFileSync(resolve(root, "js/52-page-builder-v1.js"), "utf8");
const index = readFileSync(resolve(root, "index.html"), "utf8");
const remoteUi = readFileSync(resolve(root, "js/46-android-remote-ui.js"), "utf8");
const remoteControl = readFileSync(resolve(root, "js/47-android-remote-control.js"), "utf8");

function runtime(platform = "android") {
  const services = new Map();
  let clickHandler = null;
  const document = {
    getElementById:()=>null,
    createElement:()=>({style:{},textContent:""}),
    head:{appendChild(){}},
    addEventListener:(name,handler)=>{if(name==="click")clickHandler=handler}
  };
  const window = {
    Capacitor:{getPlatform:()=>platform,isNativePlatform:()=>platform==="android"},
    SHBACECore:{
      services:{register:(name,value)=>{services.set(name,value);return {ok:true}}},
      events:{emit(){}},
      diagnostics:{record(){}}
    }
  };
  const context = vm.createContext({window,document,console,Number,Array,Object,String,Math,Date,JSON});
  vm.runInContext(source,context,{filename:"52-page-builder-v1.js"});
  return {window,services,clickHandler};
}

test("Page Builder activates only inside the native Android APK",()=>{
  assert.equal(runtime("android").window.SHBACEPageBuilder.platform,"android");
  assert.equal(runtime("web").window.SHBACEPageBuilder,undefined);
});

test("renders bounded stack, grid, tabs and accordion layouts with safe labels",()=>{
  const api=runtime().window.SHBACEPageBuilder;
  const html=api.render([
    {type:"stack",gap:8,children:[
      {type:"heading",text:"Overview"},
      {type:"grid",columns:2,gap:10,children:[
        {type:"card",title:"Card One"},
        {type:"metric",label:"Score",value:8}
      ]}
    ]},
    {type:"tabs",defaultTab:"first",tabs:[
      {id:"first",label:"First <tab>",blocks:[{type:"text",text:"Panel one"}]},
      {id:"second",label:"Second",blocks:[{type:"text",text:"Panel two"}]}
    ]},
    {type:"accordion",items:[
      {id:"details",title:"Details",open:true,blocks:[{type:"text",text:"Expanded details"}]}
    ]}
  ],block=>"<span>"+String(block.text||block.title||block.value||"leaf")+"</span>","test-page");
  assert.match(html,/shb-pb-stack/);
  assert.match(html,/shb-pb-grid/);
  assert.match(html,/grid-template-columns:repeat\(2/);
  assert.match(html,/role="tablist"/);
  assert.match(html,/data-shb-pb-tab="first"/);
  assert.match(html,/First &lt;tab&gt;/);
  assert.match(html,/data-shb-pb-panel="second"[^>]* hidden/);
  assert.match(html,/<details class="shb-pb-accordion-item" open>/);
  assert.match(html,/Expanded details/);
});

test("caps recursive depth and total rendered block count",()=>{
  const api=runtime().window.SHBACEPageBuilder;
  let nested={type:"text",text:"too deep"};
  for(let i=0;i<7;i++)nested={type:"stack",children:[nested]};
  const deep=api.render([nested],()=>"<i>leaf</i>","deep");
  assert.doesNotMatch(deep,/leaf/);
  const many=api.render(Array.from({length:130},()=>({type:"text"})),()=>"<i>x</i>","many");
  assert.equal((many.match(/<i>x<\/i>/g)||[]).length,120);
});

test("registers a local renderer service and is loaded after navigation",()=>{
  const result=runtime();
  assert.equal(result.services.get("page-builder.renderer"),result.window.SHBACEPageBuilder);
  assert.ok(index.indexOf('data-src="js/52-page-builder-v1.js"') >
    index.indexOf('data-src="js/51-navigation-contract-v1.js"'));
  assert.match(remoteUi,/SHBACEPageBuilder\.render\(page\.blocks/);
  assert.match(remoteUi,/SHBACEPageBuilder\.render\(blocks/);
  assert.match(remoteControl,/SHBACEPageBuilder\.render\(blocks/);
});

test("Page Builder does not access student stores or evaluate remote code",()=>{
  assert.doesNotMatch(source,/localStorage\.|indexedDB\.|eval\s*\(|new Function\s*\(/);
});
