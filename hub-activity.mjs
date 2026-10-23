import {MUSIC_ORIGIN, trackerSummary, nightSummary, receiverSummary, musicSummaryMessage, values, safeImage} from './hub-summaries.mjs';

export function mountHubActivity({root=document, fetchImpl=fetch, now=Date.now, musicOrigin=MUSIC_ORIGIN}={}) {
  const cards = Object.fromEntries(['tracker','music','games','livechat'].map(key => [key, root.querySelector(`.card.${key}`)]));
  if (Object.values(cards).some(card => !card)) return () => {};
  const state = {valorant:null,lol:null,night:null,receivers:null,maps:[],members:[]};
  const failed = new Set();
  let controller, inFlight=false, stopped=false, membersAt=0, mapAttempted=false, retryTimer, fastRetryUsed=false, refreshQueued=false;
  const channels = ['valorant','lol','night','receivers'];
  function setText(card, selector, value) { const el=card.querySelector(selector); if(el)el.textContent=value; }
  function art(card, image, fallback) {
    const img=card.querySelector('.art img'); if(!img)return;
    const src=image || fallback;
    if(img.getAttribute('src')===src)return;
    img.onerror=()=>{img.onerror=null;img.src=fallback;};img.src=src;
  }
  function avatars(card, ids=[]) {
    const row=card.querySelector('[data-people]'); if(!row)return;
    const members=ids.map(id => state.members.find(m=>m.id===id)).filter(Boolean).slice(0,4);
    const signature=JSON.stringify(members.map(m=>[m.id,m.avatar]));
    if(row.dataset.signature===signature)return;
    row.dataset.signature=signature;row.replaceChildren();
    for(const member of members){
      const el=document.createElement('span');el.className='person';el.title=member.name;el.textContent=String(member.name||'?').slice(0,1);
      const url=safeImage(member.avatar);
      if(url){const img=document.createElement('img');img.alt='';img.src=url;img.onerror=()=>img.remove();el.append(img);}
      row.append(el);
    }
    row.hidden=!members.length;
  }
  function badge(card,label,stale=false) {setText(card,'.status',stale?'À vérifier':label);card.querySelector('.status').dataset.state=stale?'unavailable':['Au calme','À organiser','Connexion','À décider'].includes(label)?'quiet':'online';}
  function render(){
    const tracker=trackerSummary(state.valorant,state.lol,now(),state.maps);
    const trackerFailed=failed.has('valorant')||failed.has('lol');
    setText(cards.tracker,'[data-card-title]',tracker?.title || (trackerFailed?'Live à vérifier':'Prêts pour la prochaine ?'));
    setText(cards.tracker,'[data-card-detail]',tracker?.detail || (trackerFailed?'Le Tracker reste accessible.':'Rangs, compos et historique du groupe.'));
    setText(cards.tracker,'[data-card-kicker]',tracker?.kicker || 'Valorant · League of Legends');
    setText(cards.tracker,'[data-card-extra]',tracker?.extra || 'Compos · Rangs · Live');
    badge(cards.tracker,tracker?.recovering?'Reconnexion':tracker?.label || 'Au calme',trackerFailed);
    art(cards.tracker,tracker?.image || (tracker?.family==='lol'?'assets/league-champions-group.webp':''),'assets/valorant-keyart.webp');
    avatars(cards.tracker,tracker?.members);
    const night=nightSummary(state.night,now());
    setText(cards.games,'[data-card-title]',night?.title || 'On joue à quoi ?');
    setText(cards.games,'[data-card-detail]',night?.detail || (failed.has('night')?'La liste de jeux reste accessible.':'Choisissez le prochain jeu et le bon créneau.'));
    setText(cards.games,'[data-card-kicker]',night?.kicker || 'Le coin jeux du Discord');
    badge(cards.games,night?.label || 'À organiser',failed.has('night'));
    art(cards.games,night?.image,'assets/peak-keyart.webp');avatars(cards.games,night?.members);
    const receivers=receiverSummary(state.receivers,now());
    setText(cards.livechat,'[data-card-title]',receivers.title);
    setText(cards.livechat,'[data-card-detail]',failed.has('receivers')?'Ouvre le Livechat pour vérifier les écrans disponibles.':receivers.detail);
    badge(cards.livechat,receivers.label,failed.has('receivers'));
  }
  async function read(url,signal){const r=await fetchImpl(url,{signal,cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
  async function refresh(){
    if(stopped||document.hidden)return;
    if(inFlight){refreshQueued=true;return;}
    inFlight=true;controller=new AbortController();const current=controller;
    const timeout=setTimeout(()=>current.abort(),12_000);
    try{
      try {
        const snapshot=await read(`${musicOrigin}/api/hub-summary`,current.signal);
        if(!snapshot?.data || !Array.isArray(snapshot.errors))throw new Error('Invalid hub snapshot');
        if(!stopped&&!current.signal.aborted)for(const key of channels){
          if(Object.hasOwn(snapshot.data,key))state[key]=snapshot.data[key];
          if(snapshot.errors.includes(key)||!Object.hasOwn(snapshot.data,key))failed.add(key);else failed.delete(key);
        }
      }catch{if(!stopped)channels.forEach(key=>failed.add(key));}
      if(!stopped)render();
    }finally{clearTimeout(timeout);inFlight=false;}
    if(!stopped&&!document.hidden){
      if(refreshQueued || (failed.size&&!fastRetryUsed)){
        clearTimeout(retryTimer);retryTimer=setTimeout(()=>void refresh(),refreshQueued?100:2000);
        refreshQueued=false;fastRetryUsed=true;
      }else if(!failed.size)fastRetryUsed=false;
    }
    if(stopped||document.hidden)return;
    if(!mapAttempted && trackerSummary(state.valorant,state.lol,now())?.family==='valorant'){
      mapAttempted=true;
      void read('https://valorant-api.com/v1/maps?language=fr-FR',AbortSignal.timeout(6000)).then(data=>{if(!stopped){state.maps=values(data?.data);render();}}).catch(()=>{mapAttempted=false;});
    }
    if(now()-membersAt>300_000){
      membersAt=now();
      void read('https://tracker.olycity.fr/data/members.json',AbortSignal.timeout(6000)).then(data=>{if(!stopped){state.members=values(data);render();}}).catch(()=>{});
    }
  }
  const onMusic=event=>{
    const frame=root.querySelector('#oly-music-remote iframe');
    const summary=musicSummaryMessage(event,frame?.contentWindow,musicOrigin);if(!summary)return;
    const ready=summary.status==='ready';
    setText(cards.music,'[data-card-title]',summary.title || (summary.status==='login'?'La musique du vocal':'Rien en lecture'));
    setText(cards.music,'[data-card-detail]',summary.title ? `${summary.author || 'Dans le vocal'}${summary.paused?' · En pause':''}` : summary.status==='login'?'Connecte Discord depuis le lecteur ou la page Musique.':summary.status==='offline'?'Reconnexion au lecteur…':'Recherche, playlists et file d’attente.');
    badge(cards.music,summary.title ? summary.paused?'En pause':'En écoute':ready?'Au calme':summary.status==='login'?'Connexion':'À vérifier',summary.status==='offline');
    const img=cards.music.querySelector('[data-music-cover]');
    const url=summary.artwork;
    if(img.getAttribute('src')!==url){img.dataset.failed='';img.onerror=()=>{img.dataset.failed=url;img.hidden=true;cards.music.querySelector('.eq').hidden=false;};if(url)img.src=url;else img.removeAttribute('src');}
    const hasCover=Boolean(url)&&img.dataset.failed!==url;
    img.hidden=!hasCover;
    cards.music.querySelector('.eq').hidden=hasCover;
    cards.music.classList.toggle('is-paused',!ready||summary.paused||!summary.title);
  };
  const wake=()=>{if(!document.hidden)void refresh();};
  const suspend=()=>{controller?.abort();clearTimeout(retryTimer);};
  window.addEventListener('message',onMusic);
  window.addEventListener('pageshow',wake);window.addEventListener('focus',wake);
  window.addEventListener('pagehide',suspend);document.addEventListener('visibilitychange',wake);
  const timer=setInterval(()=>{render();void refresh();},25_000);
  void refresh();
  return()=>{stopped=true;clearInterval(timer);suspend();window.removeEventListener('message',onMusic);window.removeEventListener('pageshow',wake);window.removeEventListener('focus',wake);window.removeEventListener('pagehide',suspend);document.removeEventListener('visibilitychange',wake);};
}
if(typeof document!=='undefined' && !document.documentElement.hasAttribute('data-hub-manual'))mountHubActivity();
