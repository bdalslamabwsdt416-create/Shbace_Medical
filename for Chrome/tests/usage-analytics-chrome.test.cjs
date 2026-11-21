'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const builder=fs.readFileSync(path.join(root,'scripts/build-pwa.mjs'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const updater=fs.readFileSync(path.join(root,'js/29-offline-setup.js'),'utf8');
test('Chrome PWA packages the canonical shared analytics client once and after the app modules',()=>{
 assert.equal((html.match(new RegExp('data-src="js/54-usage-analytics\\.js"','g'))||[]).length,1);
 assert.ok(builder.includes('join(root, "../to me/js/54-usage-analytics.js")'));
 assert.ok(builder.includes('copyFileSync(sharedAnalyticsSource, join(output, "js/54-usage-analytics.js"))'));
 assert.ok(html.indexOf('js/44-islamic-reminders.js')<html.indexOf('js/54-usage-analytics.js'));
 assert.ok(builder.includes('process.env.SHBACE_ANALYTICS_API_BASE_URL'));
});
test('Chrome analytics POST bypasses the original Service Worker and offline student stores',()=>{
 assert.match(worker,/if \(request\.method !== 'GET'\) return;/);
 assert.ok(worker.includes("const CACHE_NAME = 'shbace-chrome-offline-v1.3.4'"));
 assert.ok(updater.includes('shbace-chrome-offline-v1.3.4'));
 assert.doesNotMatch(updater,/shbace_usage_analytics_install_id_v1|shbace_usage_analytics_queue_v1/);
 assert.ok(html.includes('__SHBACE_ANALYTICS_API_BASE_URL__'));
});
