// Browser fixtures, activated only by the local preview server. Never imported
// by index.html, and never written to Firebase or the music server.
export function hubFixtureFetch(scenario, realFetch=fetch) {
  return async (url,options)=>{
    if(!String(url).endsWith('/api/hub-summary'))return realFetch(url,options);
    if(scenario==='offline')throw new Error('Simulated offline');
    const now=Date.now();
    const data={valorant:null,lol:null,night:null,receivers:{one:{enabled:true,ts:now}}};
    const base={active:true,ts:scenario==='stale'?now-999_999:now,matchId:'fixture-match',member:'Mathis',memberId:'mathis',mapClean:'Lotus'};
    if(scenario==='valorant'||scenario==='stale')data.valorant={a:base,b:{...base,member:'Rayhan',memberId:'rayhan'}};
    if(scenario==='lol')data.lol={a:{...base,game:'lol',member:'Liam',memberId:'liam'}};
    if(scenario==='night'){
      const when=new Date(now+3_600_000);
      const date=[when.getFullYear(),String(when.getMonth()+1).padStart(2,'0'),String(when.getDate()).padStart(2,'0')].join('-');
      const time=`${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')}`;
      data.night={options:[{id:'one',date,time,startsAt:when.getTime()}],games:[{id:'peak',title:'PEAK'}],final:{optionId:'one',gameId:'peak'},responses:{a:{memberId:'mathis',availability:{one:'yes'}}}};
    }
    return {ok:true,json:async()=>({data,errors:[],fetchedAt:now})};
  };
}
