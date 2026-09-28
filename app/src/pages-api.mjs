import schedule from '../data/schedule.json';
import {departures,findStop,stopDetails} from './transit.mjs';

// GitHub Pages cannot run a server. Use the official timetable in-browser,
// with an explicit schedule-only state until a live proxy is connected.
export async function api(path) {
  const url=new URL(path,'https://local.invalid');
  if(url.pathname==='/api/departures') {
    const result=departures(schedule,(url.searchParams.get('stops') || '').split(','),null);
    return {...result,scheduleOnly:true,error:'Scheduled timetable only — live delays are not connected on this page.'};
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
