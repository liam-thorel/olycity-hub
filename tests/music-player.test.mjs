import test from 'node:test';
import assert from 'node:assert/strict';
import {musicFrameMessage} from '../music-player.mjs';
test('music messages require both the expected window and exact origin',()=>{
  const source={}; const origin='https://musique.olycity.fr';
  assert.equal(musicFrameMessage({source:{},origin,data:{type:'olycity:music-ready'}},source,origin),null);
  assert.equal(musicFrameMessage({source,origin:origin+'.evil.test',data:{type:'olycity:music-ready'}},source,origin),null);
  assert.deepEqual(musicFrameMessage({source,origin,data:{type:'olycity:music-ready'}},source,origin),{ready:true});
});
test('iframe size is bounded and never accepts a command or CSS payload',()=>{
  const source={}; const origin='https://musique.olycity.fr';
  const message=data=>musicFrameMessage({source,origin,data},source,origin);
  assert.deepEqual(message({type:'olycity:music-size',height:9000,collapsed:true}),{height:480,collapsed:true});
  assert.deepEqual(message({type:'olycity:music-size',height:0}),{height:44,collapsed:false});
  for (const height of [NaN,Infinity,'123px',null]) assert.equal(message({type:'olycity:music-size',height}),null);
  assert.equal(message({type:'control',action:'skip'}),null);
});
