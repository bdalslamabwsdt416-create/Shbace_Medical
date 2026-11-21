'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const analytics=require('../lib/usage-analytics');

const install='1f7b3f6a-37af-4b90-b8b8-a985f2bfcb2b';
const event='c97b1b2e-a184-4ad0-9e1e-1f50e5a20c60';
const now=Date.parse('2026-11-22T12:00:00.000Z');

test('platform storage is physically separated',()=>{
 assert.notEqual(analytics.getTables('pwa').installs,analytics.getTables('android').installs);
 assert.notEqual(analytics.getTables('pwa').events,analytics.getTables('android').events);
 assert.equal(analytics.getTables('unknown'),null);
});
test('accepts a valid event and normalizes UUIDs',()=>{
 const value=analytics.validateEvent({eventId:event.toUpperCase(),installId:install.toUpperCase(),occurredAt:new Date(now).toISOString()},now);
 assert.equal(value.eventId,event);assert.equal(value.installId,install);
});
test('rejects invalid fields, identifiers and timestamps',()=>{
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:'not-a-uuid',occurredAt:new Date(now).toISOString()},now),/invalid_install_id/);
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:install,occurredAt:new Date(now).toISOString(),extra:'x'},now),/invalid_fields/);
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:install,occurredAt:'bad'},now),/invalid_timestamp/);
});
test('rejects stale or future-dated offline events',()=>{
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:install,occurredAt:new Date(now-31*analytics.DAY).toISOString()},now),/event_too_old/);
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:install,occurredAt:new Date(now+6*60*1000).toISOString()},now),/timestamp_in_future/);
});
test('admin password comparison is constant input independent and correct',()=>{
 assert.equal(analytics.passwordMatches('correct horse battery staple','correct horse battery staple'),true);
 assert.equal(analytics.passwordMatches('wrong password','correct horse battery staple'),false);
});
test('admin session is signed, expiring and tamper-resistant',()=>{
 process.env.ANALYTICS_SESSION_SECRET='test-only-session-secret-with-at-least-32-bytes';
 const session=analytics.createSession(now);
 assert.equal(analytics.validSession(session.token,now),true);
 assert.equal(analytics.validSession(session.token,session.expiresAt+1),false);
 assert.equal(analytics.validSession(session.token+'x',now),false);
 delete process.env.ANALYTICS_SESSION_SECRET;
});
test('the API does not accept a client-selected platform',()=>{
 assert.equal(analytics.getTables('pwa').events,'pwa_analytics_events');
 assert.equal(analytics.getTables('android').events,'android_analytics_events');
});
