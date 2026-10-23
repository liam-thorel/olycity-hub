import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trackerSummary,nightSummary,receiverSummary,musicSummaryMessage,fresh,stamp,safeImage,values} from '../hub-summaries.mjs';
const now=Date.parse('2026-10-23T17:00:00Z');
const session=(extra={})=>({active:true,ts:now-1000,matchId:'one',member:'Mathis',memberId:'mathis',mapClean:'Lotus',...extra});
test('timestamps support seconds, heartbeat freshness and ignore future/stale data',()=>{
  assert.equal(stamp(now/1000),now);assert.equal(stamp('bad'),0);
  assert.equal(fresh({ts:now-400_000,heartbeatAt:now-1000},now,180_000),true);
  for(const ts of [0,now-180_000,now+120_000])assert.equal(fresh({ts},now,180_000),false);
});
test('ended, stale and malformed sessions never become a fake live game',()=>{
  assert.equal(trackerSummary(null,null,now),null);
  assert.equal(trackerSummary({a:session({active:false}),b:session({ts:now-200_000})},{},now),null);
  assert.equal(trackerSummary({a:'invalid'},[],now),null);
});
test('same match groups members and map artwork comes from the actual map',()=>{
  const result=trackerSummary({a:session(),b:session({member:'Rayhan',memberId:'rayhan'})},{},now,[{displayName:'Lotus',splash:'https://media.valorant-api.com/lotus.png'}]);
  assert.equal(result.title,'Lotus');assert.equal(result.detail,'Mathis et Rayhan · En partie');
  assert.deepEqual(result.members,['mathis','rayhan']);assert.match(result.image,/lotus.png$/);
});
test('multiple matches stay separate and do not mix everybody into one game',()=>{
  const r=trackerSummary({a:session(),b:session({matchId:'two',member:'Nico',memberId:'nico'})},{},now);
  assert.equal(r.extra,'2 parties suivies');assert.equal(r.members.length,1);
});
test('pregame and a recovering heartbeat are represented without erasing the game',()=>{
  assert.equal(trackerSummary({a:session({phase:'pregame'})},{},now).label,'En sélection');
  assert.equal(trackerSummary({a:session({ts:now-90_000})},{},now).recovering,true);
});
test('League and TFT labels do not inherit Valorant map information',()=>{
  const league=trackerSummary({},{a:session({game:'lol'})},now);
  assert.equal(league.title,'League of Legends');assert.equal(league.family,'lol');assert.equal(league.image,'');
  assert.equal(trackerSummary({},{a:session({game:'tft'})},now).title,'Teamfight Tactics');
});
test('the confirmed night uses its chosen game and slot-specific replies',()=>{
  const r=nightSummary({options:[{id:'first',date:'2026-10-24',time:'20:00'},{id:'final',date:'2026-10-25',time:'21:30'}],games:[{id:'x',title:'Other'},{id:'p',title:'PEAK',coverUrl:'https://example.com/peak.jpg'}],final:{optionId:'final',gameId:'p'},responses:{a:{memberId:'mathis',availability:{first:'yes',final:'no'}},b:{memberId:'nico',availability:{final:'yes'}}}},now);
  assert.equal(r.title,'PEAK');assert.equal(r.label,'Prévue');assert.deepEqual(r.members,['nico']);assert.match(r.detail,/1 confirmé/);
});
test('expired chosen slots, empty and old plans do not advertise a false upcoming night',()=>{
  assert.equal(nightSummary(null,now),null);
  assert.equal(nightSummary({date:'2026-01-01',time:'21:30'},now),null);
  assert.equal(nightSummary({final:{optionId:'old'},options:[{id:'old',date:'2026-01-01'},{id:'new',date:'2026-10-24'}]},now),null);
});
test('legacy night plans and pending votes remain readable',()=>{
  const r=nightSummary({date:'2026-10-24',time:'21:30',gameTitle:'PEAK',responses:{a:{status:'yes'},b:{status:'no'}}},now);
  assert.equal(r.title,'PEAK');assert.equal(r.label,'À décider');assert.match(r.detail,/1 confirmé/);
});
test('livechat counts only fresh receivers with reception enabled',()=>{
  assert.equal(receiverSummary({a:{enabled:true,ts:now},b:{enabled:false,ts:now},c:{enabled:true,ts:now-400_000}},now).count,1);
  assert.equal(receiverSummary(null,now).count,0);
});
test('music messages require the actual iframe and exact allowed origin',()=>{
  const source={};const data={type:'olycity:music-summary',status:'ready',title:'Song',author:'Artist',artwork:'javascript:bad'};
  const accept=musicSummaryMessage({source,origin:'https://musique.olycity.fr',data},source);
  assert.equal(accept.title,'Song');assert.equal(accept.artwork,'');
  assert.equal(musicSummaryMessage({source:{},origin:'https://musique.olycity.fr',data},source),null);
  assert.equal(musicSummaryMessage({source,origin:'https://musique.olycity.fr.evil.test',data},source),null);
  assert.equal(musicSummaryMessage({source,origin:'https://musique.olycity.fr',data:{...data,status:'execute'}},source),null);
});
test('logged-out or disconnected music summaries never retain private track details',()=>{
  const source={};const r=musicSummaryMessage({source,origin:'https://musique.olycity.fr',data:{type:'olycity:music-summary',status:'login',title:'old track',author:'old author'}},source);
  assert.equal(r.title,'');assert.equal(r.author,'');
});
test('external image URLs are HTTPS only, not script, credentials or relative paths',()=>{
  for(const value of ['javascript:alert(1)','http://example.com/a','/secret','https://user:pass@example.com/'])assert.equal(safeImage(value),'');
  assert.equal(safeImage('https://example.com/a'),'https://example.com/a');assert.deepEqual(values(null),[]);
});
test('the real hub keeps exactly four service cards and no simulated data',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/class="card (tracker|music|games|livechat)"/g)||[]).length,4);
  assert.doesNotMatch(html,/Instant Crush|Mathis et Rayhan|Prototype local|proto-picker/);
  assert.match(html,/hub-activity\.mjs/);assert.doesNotMatch(html,/data-probe/);
});
