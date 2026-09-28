import schedule from '../data/schedule.json';
import { departures, fetchFeed, findStop, stopDetails } from './transit.mjs';

let cachedFeed, lastAttempt=0, lastError=null, pending;
async function realtime() {
  if(Date.now()-lastAttempt<20000) return;
  if(pending) return pending;
  pending=(async()=>{
    try { cachedFeed=await fetchFeed(); lastError=null; }
    catch(error) { lastError=error.message; console.error('CNS realtime:',error.message); }
    finally { lastAttempt=Date.now(); pending=null; }
  })();
  return pending;
}
const json = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')) {
      if(request.method!=='GET') return json({error:'Method not allowed'},405);
      try {
        if(url.pathname==='/api/stops') {
          const id=url.searchParams.get('id');
          if(id) { const stop=findStop(schedule,id.trim()); return stop?json(stopDetails(schedule,stop)):json({error:'That stop ID is not in the Cairns schedule.'},404); }
          const query=(url.searchParams.get('q') || '').trim().toLowerCase().slice(0,100);
          if(query.length<2) return json({stops:[]});
          const stops=Object.values(schedule.stops).filter(s=>s.id.includes(query) || s.code.includes(query) || s.name.toLowerCase().includes(query)).sort((a,b)=>(a.id===query?-1:b.id===query?1:a.name.localeCompare(b.name))).slice(0,30).map(s=>stopDetails(schedule,s));
          return json({stops});
        }
        if(url.pathname==='/api/departures') {
          const ids=[...new Set((url.searchParams.get('stops') || '').split(',').filter(Boolean))];
          if(!ids.length || ids.length>30 || ids.some(id=>!/^\d{1,12}$/.test(id))) return json({error:'Supply 1–30 Cairns stop IDs.'},400);
          await realtime();
          return json(departures(schedule,ids,cachedFeed,Date.now()/1000,lastError));
        }
        return json({error:'Not found'},404);
      } catch(error) { console.error(error); return json({error:'Unable to load departures. Please try again.'},503); }
    }
    if(!env.ASSETS) return new Response('Static asset binding is missing.',{status:503});
    return env.ASSETS.fetch(request);
  }
};
