import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_RECORD_MS,cameraErrorMessage,createWebcam,recordClock,recorderType,webcamFileName} from '../livechat/webcam.mjs';

test('la vidéo est enregistrée en MP4 quand le navigateur sait le faire, en WebM sinon',()=>{
  assert.deepEqual(recorderType(()=>true),{mimeType:'video/mp4;codecs=avc1.42E01E,mp4a.40.2',fileType:'video/mp4',ext:'mp4'});
  assert.deepEqual(recorderType(type=>type.startsWith('video/webm')),{mimeType:'video/webm;codecs=vp9,opus',fileType:'video/webm',ext:'webm'});
  assert.equal(recorderType(()=>false),null);
  assert.equal(recorderType(()=>{throw new Error('x');}),null);
});

test('noms, chronomètre et messages d’erreur',()=>{
  assert.equal(webcamFileName('jpg',new Date(2026,9,25,8,5)),'webcam-2026-10-25-08h05.jpg');
  assert.equal(recordClock(7400),'0:07 / 1:00');
  assert.equal(MAX_RECORD_MS,60000,'une minute au plus');
  assert.match(cameraErrorMessage({name:'NotAllowedError'}),/refusé/);
  assert.match(cameraErrorMessage({name:'NotReadableError'}),/déjà utilisée/);
  assert.match(cameraErrorMessage({name:'NotFoundError'}),/Aucune webcam/);
});

test('la caméra se coupe à la fermeture, et sans micro la webcam s’ouvre quand même',async()=>{
  const stopped=[];
  const track={stop:()=>stopped.push('track')};
  const calls=[];
  const nav={mediaDevices:{getUserMedia:async constraints=>{
    calls.push(constraints.audio);
    if(constraints.audio) throw Object.assign(new Error('pas de micro'),{name:'NotFoundError'});
    return {getTracks:()=>[track]};
  }}};
  const video={srcObject:null,play:async()=>{}};
  const states=[];
  const cam=createWebcam({video,nav,onFile:()=>{},onState:s=>states.push(s)});
  assert.equal(await cam.open(),true);
  assert.deepEqual(calls,[true,false],'repli sans micro');
  assert.ok(video.srcObject);
  cam.close();
  assert.deepEqual(stopped,['track'],'le voyant de la caméra s’éteint');
  assert.equal(video.srcObject,null);
  assert.equal(states.at(-1).open,false);

  const errors=[];
  const refused=createWebcam({video,nav:{mediaDevices:{getUserMedia:async()=>{throw Object.assign(new Error('non'),{name:'NotAllowedError'});}}},onFile:()=>{},onError:m=>errors.push(m)});
  assert.equal(await refused.open(),false);
  assert.match(errors[0],/refusé/);
});

test('la page propose la webcam et la coupe dès qu’un média est choisi',()=>{
  const page=readFileSync(new URL('../livechat/index.html',import.meta.url),'utf8');
  assert.match(page,/import \{ createWebcam, recordClock \} from '\.\/webcam\.mjs';/);
  assert.match(page,/id="camOpen"/);
  assert.match(page,/onFile: file => setFile\(file\)/,'même chemin d’envoi qu’un fichier déposé');
  const setFile=page.slice(page.indexOf('async function setFile'),page.indexOf('function naturalSize'));
  assert.match(setFile,/webcam\.close\(\);/);
  assert.match(page,/window\.addEventListener\('pagehide', \(\) => webcam\.close\(\)\);/);
});
