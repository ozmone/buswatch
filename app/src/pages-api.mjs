import schedule from '../data/schedule.json';
import {departures,findStop,stopDetails} from './transit.mjs';

// A GitHub Actions job publishes bounded official snapshots on live-feed.
// Original feed timestamps control LIVE eligibility, never the download time.
const LIVE_URL='https://raw.githubusercontent.com/ozmone/buswatch/live-feed/live/';
let feed=null;
export async function api(path) {
  const url=new URL(path,'https://local.invalid');
  if(url.pathname==='/api/departures') {
    let error=null;
    try {
      let snapshot;
      const slot=Math.floor(Date.now()/20000);
      // The preceding slot is complete; older slots cover short publishing delays.
      for(const offset of [1,2,3]) {
        const response=await fetch(LIVE_URL+(slot-offset)+'.json',{cache:'no-store',signal:AbortSignal.timeout(6000)});
        if(response.ok){snapshot=await response.json();break;}
        if(response.status!==404)throw Error(`Live feed HTTP ${response.status}`);
      }
      if(!snapshot?.feed?.header?.timestamp)throw Error('Invalid live feed');
      feed=snapshot.feed;
    }catch(e){error='Live feed refresh failed. Showing scheduled times until it recovers.';console.error(e);}
    return departures(schedule,(url.searchParams.get('stops') || '').split(','),feed,Date.now()/1000,error);
  }
  if(url.pathname==='/api/stops') {
    const id=url.searchParams.get('id');
    if(id) {
      const stop=findStop(schedule,id.trim());
      if(!stop) throw Error('That stop ID is not in the Cairns schedule.');
      return stopDetails(schedule,stop);
    }
    const query=(url.searchParams.get('q') || '').trim().toLowerCase();
    return {stops:query.length<2?[]:Object.values(schedule.stops)
      .filter(s=>s.id.includes(query)||s.code.includes(query)||s.name.toLowerCase().includes(query))
      .slice(0,30).map(s=>stopDetails(schedule,s))};
  }
  throw Error('Unknown request');
}
