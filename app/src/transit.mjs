import bindings from 'gtfs-realtime-bindings';
import { MAX_FEED_AGE, REALTIME_URL } from './config.mjs';

export function decodeFeed(bytes) {
  const Feed = bindings.transit_realtime.FeedMessage;
  return Feed.toObject(Feed.decode(bytes), { longs: Number, enums: String });
}
export async function fetchFeed() {
  const response = await fetch(REALTIME_URL, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Translink live feed returned HTTP ${response.status}`);
  const feed = decodeFeed(new Uint8Array(await response.arrayBuffer()));
  if (feed.header?.incrementality === 'DIFFERENTIAL') throw new Error('Unsupported differential feed');
  return feed;
}
// Cairns is UTC+10 year round. GTFS times can exceed 24:00:00.
export const serviceDate = epoch => new Date((epoch + 36000) * 1000).toISOString().slice(0,10).replaceAll('-','');
export function midnight(date) {
  return Date.parse(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T00:00:00+10:00`) / 1000;
}
export function activeServices(data, date) {
  const day = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(midnight(date)*1000+36000000).getUTCDay()];
  const active = new Set(data.calendar.filter(c=>c.start_date<=date && c.end_date>=date && c[day]==='1').map(c=>c.service_id));
  for (const e of data.exceptions) if(e.date===date) e.exception_type==='1' ? active.add(e.service_id) : active.delete(e.service_id);
  return active;
}
export function findStop(data, id) {
  return data.stops[id] || Object.values(data.stops).find(s=>s.code===id);
}
export function stopDetails(data, stop) {
  return { ...stop, routes: stop.routes.map(r=>data.routes[r]?.number).filter(Boolean).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})) };
}
const present = value => typeof value === 'number' && Number.isFinite(value);
function eventTime(event, scheduled) {
  if (present(event?.time)) return event.time;
  if (present(event?.delay)) return scheduled + event.delay;
  return null;
}
export function prediction(trip, index, update, base) {
  const target = trip.times[index];
  if (!update) return {};
  if (['CANCELED','DELETED'].includes(update.trip.scheduleRelationship)) return { canceled: true };
  // Propagate delays forward only. NO_DATA clears propagation; SKIPPED preserves it.
  let delay = present(update.delay) ? update.delay : null;
  const updates = [...(update.stopTimeUpdate || [])].map(u=>({ u, index: present(u.stopSequence) ? trip.times.findIndex(t=>t[1]===u.stopSequence) : trip.times.findIndex(t=>t[0]===u.stopId) })).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index);
  for (const {u,index: position} of updates) {
    if(position>index) break;
    if(u.scheduleRelationship==='NO_DATA') { delay=null; if(position===index) return {}; continue; }
    if(u.scheduleRelationship==='SKIPPED') { if(position===index) return { skipped:true }; continue; }
    const t=trip.times[position];
    const departure=eventTime(u.departure,base+t[3]);
    const arrival=eventTime(u.arrival,base+t[2]);
    if(position===index && (departure!==null || arrival!==null)) return { expected: departure ?? (base+t[3]+arrival-(base+t[2])), arrival: arrival ?? departure };
    if(departure!==null) delay=departure-(base+t[3]);
    else if(arrival!==null) delay=arrival-(base+t[2]);
  }
  return delay===null ? {} : { expected:base+target[3]+delay, arrival:base+target[2]+delay };
}
export function departures(data, ids, feed, now = Date.now()/1000, feedError = null) {
  const timestamp = feed?.header?.timestamp || 0;
  const fresh = timestamp>0 && now-timestamp<=MAX_FEED_AGE && timestamp<=now+60 && !feedError;
  const updates = new Map();
  let unmatched = 0;
  for(const entity of feed?.entity || []) {
    const u=entity.tripUpdate;
    if(!u || entity.isDeleted) continue;
    if(!data.trips[u.trip.tripId]) { unmatched++; continue; }
    const key=`${u.trip.tripId}|${u.trip.startDate || ''}`;
    if(!updates.has(key) || (u.timestamp || 0)>(updates.get(key).timestamp || 0)) updates.set(key,u);
  }
  const days = [-1,0,1].map(offset=>{const date=serviceDate(now+offset*86400);return {date,base:midnight(date),active:activeServices(data,date)};});
  const stops = ids.map(id=> {
    const stop=findStop(data,id);
    if(!stop) return {id,error:'Stop not found in Cairns schedule',departures:[]};
    const result=[];
    for(const {date,base,active} of days) for(const [tripId,index] of data.stopTimes[stop.id] || []) {
      const trip=data.trips[tripId], t=trip.times[index];
      if(!active.has(trip.service) || t[4]==='1') continue;
      const scheduled=base+t[3];
      let update=updates.get(`${tripId}|${date}`);
      // Without start_date, match only today's instance, never yesterday/tomorrow.
      if(!update && date===serviceDate(now)) update=updates.get(`${tripId}|`);
      const updateFresh=fresh && (!update?.timestamp || (now-update.timestamp<=MAX_FEED_AGE && update.timestamp<=now+60));
      const p=updateFresh ? prediction(trip,index,update,base) : {};
      const expected=p.expected ?? scheduled;
      if(expected<now-30 || expected>now+86400) continue;
      const live=p.expected!=null;
      result.push({ key:`${tripId}|${date}|${t[1]}`, tripId, serviceDate:date, sequence:t[1], route:data.routes[trip.route]?.number || trip.route, destination:t[5] || trip.headsign || data.routes[trip.route]?.name, scheduled, expected, arrival:p.arrival ?? base+t[2], live, status:p.canceled?'CANCELED':p.skipped?'SKIPPED':live?'LIVE':'SCHEDULE', delaySeconds:live?expected-scheduled:null, predictionAt:live?(update?.timestamp || timestamp):null });
    }
    result.sort((a,b)=>a.expected-b.expected);
    return {...stopDetails(data,stop),departures:result.slice(0,8)};
  });
  return { serverTime:now, fetchedAt:now, feedTimestamp:timestamp || null, stale:!fresh, error:feedError || (!fresh?'Live feed is stale or unavailable. Showing scheduled times.':null), scheduleFetchedAt:data.fetchedAt, scheduleValidUntil:data.validUntil, scheduleExpired:serviceDate(now)>data.validUntil, unmatchedTrips:unmatched, stops };
}
