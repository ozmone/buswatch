import test from 'node:test';
import assert from 'node:assert/strict';
import { activeServices, midnight, serviceDate, prediction, departures } from '../src/transit.mjs';

const base=midnight('20260928');
const trip={route:'r',service:'weekday',headsign:'Cairns',times:[['a',1,3600,3660,'0',''],['b',2,4200,4260,'0',''],['a',3,4800,4860,'0','']]};
const data={fetchedAt:'2026-09-28',validUntil:'20261125',stops:{a:{id:'a',code:'a',name:'A',routes:['r']},b:{id:'b',code:'b',name:'B',routes:['r']}},routes:{r:{number:'110'}},trips:{t:trip},stopTimes:{a:[['t',0],['t',2]],b:[['t',1]]},calendar:[{service_id:'weekday',start_date:'20260901',end_date:'20261125',monday:'1',tuesday:'1',wednesday:'1',thursday:'1',friday:'1',saturday:'0',sunday:'0'}],exceptions:[]};
const update=stops=>({trip:{tripId:'t',startDate:'20260928',scheduleRelationship:'SCHEDULED'},stopTimeUpdate:stops});
test('Brisbane service days and times beyond 24h stay on correct date',()=>{
  assert.equal(serviceDate(base),'20260928');assert.equal(serviceDate(base-1),'20260927');
  assert.equal(serviceDate(base+25*3600),'20260929');
});
test('calendar removes and adds exception services',()=>{
  assert(activeServices(data,'20260928').has('weekday'));
  assert(!activeServices(data,'20260927').has('weekday'));
  const changed={...data,exceptions:[{date:'20260928',service_id:'weekday',exception_type:'2'},{date:'20260928',service_id:'holiday',exception_type:'1'}]};
  assert.deepEqual([...activeServices(changed,'20260928')],['holiday']);
});
test('sequence identifies repeated stop; zero delay is a live prediction',()=>{
  const u=update([{stopId:'a',stopSequence:3,departure:{delay:0}}]);
  assert.deepEqual(prediction(trip,0,u,base),{});
  assert.equal(prediction(trip,2,u,base).expected,base+4860);
});
test('absolute departure beats delay and preserves distinct arrival',()=>{
  const u=update([{stopSequence:2,departure:{time:base+4400,delay:999},arrival:{time:base+4380}}]);
  assert.deepEqual(prediction(trip,1,u,base),{expected:base+4400,arrival:base+4380});
});
test('delays propagate forward, NO_DATA stops propagation, SKIPPED does not',()=>{
  const u=update([{stopSequence:1,departure:{delay:120}},{stopSequence:2,scheduleRelationship:'SKIPPED'}]);
  assert.equal(prediction(trip,2,u,base).expected,base+4980);
  assert(prediction(trip,1,u,base).skipped);
  u.stopTimeUpdate[1].scheduleRelationship='NO_DATA';
  assert.deepEqual(prediction(trip,2,u,base),{});
});
test('canceled trips never produce an ETA',()=>{
  const u=update([]);u.trip.scheduleRelationship='CANCELED';
  assert.deepEqual(prediction(trip,0,u,base),{canceled:true});
});
test('fresh feed joins exact trip/date; stale feed or stale trip falls back',()=>{
  const now=base+3500,u=update([{stopSequence:1,departure:{delay:90}}]);
  const feed={header:{timestamp:now},entity:[{tripUpdate:u}]};
  let result=departures(data,['a'],feed,now);
  assert.equal(result.stops[0].departures[0].delaySeconds,90);
  assert(result.stops[0].departures[0].live);
  const tomorrow=result.stops[0].departures.find(d=>d.serviceDate==='20260929');
  if(tomorrow)assert.equal(tomorrow.live,false);
  result=departures(data,['a'],{...feed,header:{timestamp:now-121}},now);
  assert(result.stale);assert.equal(result.stops[0].departures[0].live,false);
  u.timestamp=now-121;
  assert.equal(departures(data,['a'],feed,now).stops[0].departures[0].live,false);
});
test('departures after midnight include prior service day and sort by prediction',()=>{
  const overnight={...trip,times:[['a',1,90000,90000,'0','']]};
  const d={...data,trips:{t:overnight},stopTimes:{a:[['t',0]]}};
  const rows=departures(d,['a'],null,base+86460).stops[0].departures;
  assert.equal(rows[0].scheduled,base+90000);assert.equal(rows[0].serviceDate,'20260928');
});
test('no pickup services are not presented as boardable',()=>{
  const d={...data,trips:{t:{...trip,times:[['a',1,3600,3660,'1','']]}},stopTimes:{a:[['t',0]]}};
  assert.equal(departures(d,['a'],null,base+3500).stops[0].departures.length,0);
});
