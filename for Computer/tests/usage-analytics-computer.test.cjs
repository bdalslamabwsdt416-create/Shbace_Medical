'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const builder=fs.readFileSync(path.join(root,'scripts/build-pwa.mjs'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const updater=fs.readFileSync(path.join(root,'js/29-offline-setup.js'),'utf8');
test('Computer PWA packages the canonical shared analytics client once and after the app modules',()=>{
 assert.equal((html.match(new RegExp('data-src="js/54-usage-analytics\\.js"','g'))||[]).length,1);
 assert.ok(builder.includes('join(root, "../to me/js/54-usage-analytics.js")'));
 assert.ok(builder.includes('copyFileSync(sharedAnalyticsSource, join(output, "js/54-usage-analytics.js"))'));
 assert.ok(html.indexOf('js/44-islamic-reminders.js')<html.indexOf('js/54-usage-analytics.js'));
 assert.ok(builder.includes('process.env.SHBACE_ANALYTICS_API_BASE_URL'));
});
test('Computer analytics POST bypasses the original Service Worker and offline student stores',()=>{
 assert.match(worker,/if \(request\.method !== 'GET'\) return;/);
 assert.ok(worker.includes("const CACHE_NAME = 'shbace-computer-offline-v1.3.4'"));
 assert.ok(updater.includes('shbace-computer-offline-v1.3.4'));
 assert.doesNotMatch(updater,/shbace_usage_analytics_install_id_v1|shbace_usage_analytics_queue_v1/);
 assert.ok(html.includes('__SHBACE_ANALYTICS_API_BASE_URL__'));
});

test('the two imported clinical banks and their logos are bundled independently',()=>{
 const haitham=JSON.parse(fs.readFileSync(path.join(root,'data/external-banks/haitham-nabil.json'),'utf8'));
 const aster=JSON.parse(fs.readFileSync(path.join(root,'data/external-banks/aster-qbank.json'),'utf8'));
 const count=bank=>bank.systems.flatMap(system=>system.topics.flatMap(topic=>topic.questions)).length;
 assert.equal(haitham.totalQuestions,458);assert.equal(count(haitham),458);
 assert.equal(aster.totalQuestions,1516);assert.equal(count(aster),1516);
 const adapter=fs.readFileSync(path.join(root,'js/43-ai-bank-engine-adapter.js'),'utf8');
 assert.ok(adapter.includes('bank-haitham-nabil.webp'));assert.ok(adapter.includes('bank-aster-qbank.webp'));
 assert.ok(fs.existsSync(path.join(root,'assets/img/bank-haitham-nabil.webp')));
 assert.ok(fs.existsSync(path.join(root,'assets/img/bank-aster-qbank.webp')));
});
test('Analytics stays active without a startup banner and privacy details remain in Settings',()=>{
 const source=fs.readFileSync(path.join(root,'../to me/js/54-usage-analytics.js'),'utf8');
 const settings=fs.readFileSync(path.join(root,'js/36-exam-planner-settings-smartreview.js'),'utf8');
 assert.ok(source.includes('function queueDaily()'));assert.ok(source.includes('async function flush()'));
 assert.doesNotMatch(source,/privacyNotice|Basic usage analytics|Got it/);
 assert.ok(settings.includes('shb-privacy-card'));assert.ok(settings.includes('random installation identifier'));
});
