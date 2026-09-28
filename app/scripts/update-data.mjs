import { unzipSync, strFromU8 } from 'fflate';
import { parse } from 'csv-parse/sync';
import { mkdir, writeFile } from 'node:fs/promises';
import { STATIC_URL } from '../src/config.mjs';

const response = await fetch(STATIC_URL, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`GTFS download: ${response.status}`);
const zip = unzipSync(new Uint8Array(await response.arrayBuffer()));
const read = name => zip[name] ? parse(strFromU8(zip[name]), { columns: true, skip_empty_lines: true, bom: true }) : [];
const stops = Object.fromEntries(read('stops.txt').map(s => [s.stop_id, { id: s.stop_id, code: s.stop_code || s.stop_id, name: s.stop_name, routes: [] }]));
const routes = Object.fromEntries(read('routes.txt').map(r => [r.route_id, { number: r.route_short_name, name: r.route_long_name }]));
const trips = Object.fromEntries(read('trips.txt').map(t => [t.trip_id, { route: t.route_id, service: t.service_id, headsign: t.trip_headsign, times: [] }]));
const seconds = value => value.split(':').reduce((a, v) => a * 60 + Number(v), 0);
const stopTimes = {};
for (const row of read('stop_times.txt')) {
  const trip = trips[row.trip_id];
  if (!trip || !stops[row.stop_id]) throw new Error('GTFS references missing trip/stop');
  const time = { trip: row.trip_id, stop: row.stop_id, seq: Number(row.stop_sequence), arrival: seconds(row.arrival_time), departure: seconds(row.departure_time), pickup: row.pickup_type || '0', headsign: row.stop_headsign || '' };
  trip.times.push(time);
  if (!stops[row.stop_id].routes.includes(trip.route)) stops[row.stop_id].routes.push(trip.route);
}
for (const trip of Object.values(trips)) trip.times.sort((a,b) => a.seq-b.seq);
// Compact tuples avoid duplicating every stop time in the Worker bundle.
for (const [id, trip] of Object.entries(trips)) {
  trip.times = trip.times.map((t, index) => {
    (stopTimes[t.stop] ||= []).push([id, index]);
    return [t.stop, t.seq, t.arrival, t.departure, t.pickup, t.headsign];
  });
}
const calendar = read('calendar.txt');
const exceptions = read('calendar_dates.txt');
const dates = [...calendar.map(c=>c.end_date), ...exceptions.filter(c=>c.exception_type==='1').map(c=>c.date)].sort();
const data = { fetchedAt: new Date().toISOString(), source: STATIC_URL, validUntil: dates.at(-1), stops, routes, trips, stopTimes, calendar, exceptions };
for (const id of ['750042', '750045']) {
  const stop = Object.values(stops).find(s=>s.id===id || s.code===id);
  if (!stop) throw new Error(`Requested stop ${id} is absent from Cairns GTFS`);
  console.log('FOUND', JSON.stringify(stop));
}
await mkdir('data', { recursive: true });
await writeFile('data/schedule.json', JSON.stringify(data));
console.log(JSON.stringify({ stops: Object.keys(stops).length, trips: Object.keys(trips).length, calendarRows: calendar.length, exceptions: exceptions.length, validUntil: data.validUntil, bytes: JSON.stringify(data).length }));
