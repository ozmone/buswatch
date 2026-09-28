import schedule from '../data/schedule.json';
import {departures,findStop,stopDetails} from './transit.mjs';
import {createLiveLoader} from './live-loader.mjs';

// A GitHub Actions job publishes bounded official snapshots on live-feed.
// Original feed timestamps control LIVE eligibility, never the download time.
const loadLive=createLiveLoader();
let feed=null;
export async function api(path) {
  const url=new URL(path,'https://local.invalid');
  if(url.pathname==='/api/departures') {
    let error=null;
    try {
      feed=await loadLive();
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
