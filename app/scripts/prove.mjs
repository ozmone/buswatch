import { readFile, writeFile } from 'node:fs/promises';
import { fetchFeed, departures } from '../src/transit.mjs';
const schedule=JSON.parse(await readFile('data/schedule.json','utf8'));
const feed=await fetchFeed();
const result=departures(schedule,['750042','750045'],feed);
console.log('Feed timestamp:',new Date(result.feedTimestamp*1000).toISOString(),'Unmatched trips:',result.unmatchedTrips);
for(const stop of result.stops) {
  console.log(`\n${stop.id} ${stop.name}`);
  console.table(stop.departures.map(d=>({route:d.route,destination:d.destination,scheduled:new Date(d.scheduled*1000).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'}),expected:new Date(d.expected*1000).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'}),status:d.status,delayMinutes:d.delaySeconds==null?'':Math.round(d.delaySeconds/60),trip:d.tripId})));
}
await writeFile('data/proof.json',JSON.stringify(result,null,2));
