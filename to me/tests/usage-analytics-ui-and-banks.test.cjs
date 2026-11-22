'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Astra and Dr. Haitham external banks retain their complete validated data and logos',()=>{
 const haitham=JSON.parse(fs.readFileSync(path.join(root,'data/external-banks/haitham-nabil.json'),'utf8'));
 const aster=JSON.parse(fs.readFileSync(path.join(root,'data/external-banks/aster-qbank.json'),'utf8'));
 const audit=JSON.parse(fs.readFileSync(path.join(root,'data/audit/external-qbank-import-audit.json'),'utf8'));
 const count=bank=>bank.systems.flatMap(system=>system.topics.flatMap(topic=>topic.questions)).length;
 assert.equal(haitham.totalQuestions,458);assert.equal(count(haitham),458);
 assert.equal(aster.totalQuestions,1516);assert.equal(count(aster),1516);
 assert.equal(audit.totalImported,1974);
 assert.ok(fs.existsSync(path.join(root,'assets/img/bank-haitham-nabil.webp')));
 assert.ok(fs.existsSync(path.join(root,'assets/img/bank-aster-qbank.webp')));
 const adapter=fs.readFileSync(path.join(root,'js/43-ai-bank-engine-adapter.js'),'utf8');
 assert.ok(adapter.includes('bank-haitham-nabil.webp'));assert.ok(adapter.includes('bank-aster-qbank.webp'));
});

test('Analytics remains enabled with no startup disclosure popup',()=>{
 const client=fs.readFileSync(path.join(root,'js/54-usage-analytics.js'),'utf8');
 assert.ok(client.includes('function queueDaily()'));assert.ok(client.includes('async function flush()'));
 assert.doesNotMatch(client,/privacyNotice|Basic usage analytics|Got it/);
});

test('Privacy information is available from Settings on web and native Android',()=>{
 const settings=fs.readFileSync(path.join(root,'js/36-exam-planner-settings-smartreview.js'),'utf8');
 const nativeSettings=fs.readFileSync(path.join(root,'js/48-android-settings-layout.js'),'utf8');
 assert.ok(settings.includes('shb-privacy-card'));
 assert.ok(settings.includes('random installation identifier'));
 assert.ok(nativeSettings.includes("id: 'privacy'"));
 assert.ok(nativeSettings.includes("contains('shb-privacy-card')"));
});
