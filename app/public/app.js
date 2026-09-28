import {api} from './data-api.js';
const $=id=>document.getElementById(id);
const BOOKMARK_KEY='buswatch.cairns.stops.v1', CACHE_KEY='buswatch.cairns.last.v1';
let storageProblem=false;
function read(key) { try {return localStorage.getItem(key);} catch {storageProblem=true;return null;} }
function write(key,value) { try {localStorage.setItem(key,JSON.stringify(value));return true;} catch {storageProblem=true;return false;} }
let bookmarks;
try { const raw=read(BOOKMARK_KEY); bookmarks=raw===null?['750042','750045']:JSON.parse(raw); if(!Array.isArray(bookmarks)) throw Error(); bookmarks=[...new Set(bookmarks.filter(id=>typeof id==='string' && /^\d{1,12}$/.test(id)))].slice(0,30); } catch {bookmarks=[];storageProblem=true;}
write(BOOKMARK_KEY,bookmarks);
let snapshot=null;
try {snapshot=JSON.parse(read(CACHE_KEY));}catch{}
let requestError=snapshot?'Saved information. Refreshing…':null, busy=false, searchSerial=0, clockOffset=0, currentTab=bookmarks.length?'live':'finder';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=(epoch,seconds=false)=>new Date(epoch*1000).toLocaleTimeString('en-AU',{timeZone:'Australia/Brisbane',hour:'numeric',minute:'2-digit',...(seconds?{second:'2-digit'}:{}),hour12:true});
const now=()=>Date.now()/1000+clockOffset;
function labelTime(epoch) {return `${new Date(epoch*1000).toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane'})!==new Date(now()*1000).toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane'})?'Tomorrow ':''}${time(epoch)}`;}
function showTab(tab) {currentTab=tab; $('live-panel').hidden=tab!=='live';$('finder-panel').hidden=tab!=='finder';for(const name of ['live','finder']) {if(name===tab) $(name+'-tab').setAttribute('aria-current','page');else $(name+'-tab').removeAttribute('aria-current');} }
function toast(message) {$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
function globallyStale() {return !!requestError || !navigator.onLine || !snapshot || snapshot.stale || now()-(snapshot.feedTimestamp || 0)>120;}
function departureMarkup(d,compact=false) {
  const stale=d.live && (globallyStale() || now()-(d.predictionAt || 0)>120);
  const canceled=d.status==='CANCELED' || d.status==='SKIPPED';
  const minutes=Math.max(0,Math.ceil(((d.live?d.arrival:d.expected)-now())/60));
  const badge=stale?'LAST KNOWN':d.status==='SCHEDULE'?'SCHEDULED':d.status;
  const eta=canceled?(d.status==='CANCELED'?'Cancelled':'Not stopping'):`${minutes}<small>MIN</small>`;
  const delta=d.delaySeconds==null?null:Math.round(d.delaySeconds/60);
  const delay=delta===null?'':delta>0?`+${delta} min late`:delta<0?`${Math.abs(delta)} min early`:'On time';
  const service=`<span class="route">${escape(d.route)}</span>`;
  const status=`<span class="badge ${stale?'stale':d.live?'live':''}">${escape(badge)}</span>`;
  const expected=`${stale?'Last prediction':d.live?'Expected':'Scheduled'} ${escape(labelTime(d.expected))}`;
  if(compact) return `<article class="departure compact">${service}<div><p class="destination">${escape(d.destination)}</p>${status}<div class="time-line">${expected}</div>${d.live?`<div class="scheduled">Scheduled ${escape(labelTime(d.scheduled))}${delay?' · '+escape(delay):''}</div>`:''}</div><div class="eta ${canceled?'inactive':''}" aria-label="${canceled?escape(badge):(stale?'Last known estimate: ':'')+minutes+' minutes'}">${eta}</div></article>`;
  return `<article class="departure"><div class="service-heading">${service}${status}</div><p class="destination">${escape(d.destination)}</p><div class="eta-label">${canceled?'SERVICE UPDATE':stale?'LAST KNOWN ETA':d.live?'ARRIVING IN':'SCHEDULED IN'}</div><div class="eta ${canceled?'inactive':''}">${eta}</div><div class="time-line"><span>${expected}</span>${delay?`<span class="delay">${escape(delay)}</span>`:''}</div>${d.live?`<div class="scheduled">Scheduled ${escape(labelTime(d.scheduled))}</div>`:''}</article>`;
}
function render() {
  $('bookmark-count').textContent=bookmarks.length;
  const stale=globallyStale();
  $('connection').textContent=snapshot?.scheduleOnly?'Scheduled timetable · no live delays':!navigator.onLine?'Offline · saved information':!snapshot?(requestError?'Connection unavailable':'Connecting to Translink…'):stale?'Showing last update':'Live predictions loaded';
  $('connection').className=stale?'stale':'fresh';
  $('updated').textContent=snapshot?.scheduleOnly?`Timetable downloaded ${snapshot.scheduleFetchedAt.slice(0,10)}`:snapshot?`Last updated ${time(snapshot.fetchedAt,true)} · tap ↻ to update`:'Tap ↻ to update departures';
  const warnings=[];
  if(requestError) warnings.push(requestError);
  else if(snapshot?.error) warnings.push(snapshot.error);
  else if(snapshot && stale) warnings.push('Showing the last known estimates and delays. Tap ↻ for an update.');
  if(!navigator.onLine) warnings.push('You’re offline. Reconnect for current departures.');
  if(snapshot?.scheduleExpired) warnings.push('The downloaded timetable has expired. The app needs a schedule update.');
  if(storageProblem) warnings.push('Browser storage is unavailable. Changes may not survive closing the app.');
  $('warning').textContent=warnings.join(' ');$('warning').hidden=!warnings.length;
  const open=new Set([...document.querySelectorAll('details[open]')].map(e=>e.dataset.stop));
  if(!bookmarks.length) {$('stops').innerHTML='<div class="empty"><h2>Your board is empty</h2><p>Add a Cairns stop to see its next departures here.</p><button data-action="add">＋ Add stop</button></div>';return;}
  $('stops').innerHTML=bookmarks.map(id=> {
    const stop=snapshot?.stops?.find(s=>s.id===id);
    const list=(stop?.departures || []).filter(d=>d.expected>=now()-30);
    return `<section class="stop-card"><div class="stop-heading"><div><span class="stop-id">STOP ${escape(id)}</span><h2>${escape(stop?.name || (busy?'Loading stop…':'Stop '+id))}</h2></div><button class="remove" data-remove="${escape(id)}" aria-label="Remove stop ${escape(id)}" title="Remove stop">×</button></div>${stop?.error?`<p class="empty">${escape(stop.error)}</p>`:!stop?`<p class="loading">${requestError?'Could not load this stop. Try Refresh.':'Loading departures…'}</p>`:!list.length?`<p class="loading">${stale?'No current departures available. Refresh when connected.':'No departures scheduled in the next 24 hours.'}</p>`:departureMarkup(list[0])+list.slice(1,3).map(d=>departureMarkup(d,true)).join('')+(list.length>3?`<details class="more" data-stop="${escape(id)}" ${open.has(id)?'open':''}><summary>${list.length-3} more departures</summary>${list.slice(3).map(d=>departureMarkup(d,true)).join('')}</details>`:'')}</section>`;
  }).join('');
}
async function refresh() {
  if(busy || !bookmarks.length) return;
  busy=true;$('refresh').disabled=true;
  const ids=[...bookmarks];
  try {
    const data=await api('/api/departures?stops='+ids.join(','));
    clockOffset=data.serverTime-Date.now()/1000;
    // A failed update keeps the existing estimates and delays on the board.
    if(!data.scheduleOnly && data.stale && snapshot && !snapshot.stale) {
      requestError='Could not get a fresh update. Keeping your last known estimates and delays. Tap ↻ to retry.';
      const oldIds=new Set(snapshot.stops.map(s=>s.id));
      snapshot.stops.push(...data.stops.filter(s=>!oldIds.has(s.id)));
      snapshot.scheduleExpired=data.scheduleExpired;
    } else {snapshot=data;requestError=null;write(CACHE_KEY,snapshot);}
  } catch(error) {requestError='Refresh failed. '+(snapshot?'Showing last saved information.':'Please try again.');console.error(error);}
  finally {busy=false;$('refresh').disabled=false;render();if(ids.join(',')!==bookmarks.join(',')) refresh();}
}
async function addBookmark(id) {
  if(bookmarks.length>=30 && !bookmarks.includes(id)) throw Error('You can save up to 30 stops. Remove one to add another.');
  const stop=await api('/api/stops?id='+encodeURIComponent(id));
  if(bookmarks.includes(stop.id)) {toast('That stop is already saved.');return stop;}
  bookmarks.push(stop.id);write(BOOKMARK_KEY,bookmarks);render();refresh();toast(`Stop ${stop.id} saved`);return stop;
}
function removeBookmark(id) {bookmarks=bookmarks.filter(s=>s!==id);write(BOOKMARK_KEY,bookmarks);render();toast(`Stop ${id} removed`);if(!bookmarks.length) showTab('finder');}
function openAdd() {$('add-status').textContent='';$('stop-id').value='';$('add-dialog').showModal();$('stop-id').focus();}
$('add-stop').onclick=openAdd;$('close-dialog').onclick=()=>$('add-dialog').close();
$('live-tab').onclick=()=>showTab('live');$('finder-tab').onclick=()=>showTab('finder');$('refresh').onclick=refresh;
$('stops').onclick=e=>{const remove=e.target.closest('[data-remove]');if(remove) removeBookmark(remove.dataset.remove);if(e.target.closest('[data-action="add"]')) openAdd();};
$('add-form').onsubmit=async e=>{e.preventDefault();$('save-stop').disabled=true;$('add-status').textContent='Checking Cairns schedule…';try{await addBookmark($('stop-id').value.trim());$('add-dialog').close();showTab('live');}catch(error){$('add-status').textContent=error.message;}finally{$('save-stop').disabled=false;}};
$('search-form').onsubmit=async e=>{e.preventDefault();const serial=++searchSerial;$('search-status').textContent='Searching Cairns stops…';$('results').innerHTML='';try{const data=await api('/api/stops?q='+encodeURIComponent($('search').value.trim()));if(serial!==searchSerial)return;$('search-status').textContent=data.stops.length?`${data.stops.length} matching stop${data.stops.length===1?'':'s'}${data.stops.length===30?' · showing first 30':''}`:'No Cairns stops found. Check the stop ID or try another name.';$('results').innerHTML=data.stops.map(s=>`<article class="search-result"><div><span class="stop-id">STOP ${escape(s.code)}</span><h2>${escape(s.name)}</h2><p>Routes ${s.routes.map(escape).join(' · ') || 'unavailable'}</p></div><button data-save="${escape(s.id)}" ${bookmarks.includes(s.id)?'disabled':''}>${bookmarks.includes(s.id)?'Saved':'＋ Save'}</button></article>`).join('');}catch(error){if(serial===searchSerial)$('search-status').textContent='Search failed. Check your connection and try again.';}};
$('results').onclick=async e=>{const button=e.target.closest('[data-save]');if(!button)return;button.disabled=true;try{await addBookmark(button.dataset.save);button.textContent='Saved';}catch(error){button.disabled=false;toast(error.message);}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden) render();});
window.addEventListener('online',render);window.addEventListener('offline',render);
window.addEventListener('storage',e=>{if(e.key===BOOKMARK_KEY){try{const value=JSON.parse(e.newValue);if(Array.isArray(value)){bookmarks=value.filter(id=>typeof id==='string'&&/^\d{1,12}$/.test(id)).slice(0,30);render();refresh();}}catch{}}});
// Keep countdowns moving; fetch only on initial load, saved-stop changes or ↻.
setInterval(()=>{if(!document.hidden && !$('stops').contains(document.activeElement)) render();},10000);
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').hidden=false;});$('install').onclick=async()=>{await installPrompt?.prompt();$('install').hidden=true;installPrompt=null;};
if('serviceWorker' in navigator) navigator.serviceWorker.register(new URL('./sw.js',import.meta.url)).catch(console.error);
showTab(currentTab);render();refresh();
// Optional browser-agent integration uses the same validation and local bookmarks.
if(document.modelContext?.registerTool) {
  const lifecycle=new AbortController();
  const tools=[
    {name:'list_saved_stops',description:'Read saved Cairns stop IDs and the displayed departures.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({bookmarks:[...bookmarks],stale:globallyStale(),stops:snapshot?.stops?.filter(s=>bookmarks.includes(s.id)) || []})},
    {name:'save_cairns_stop',description:'Validate a Cairns stop ID and save it to this browser’s departure board.',inputSchema:{type:'object',properties:{stopId:{type:'string',pattern:'^[0-9]{1,12}$'}},required:['stopId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(!input || typeof input.stopId!=='string' || !/^\d{1,12}$/.test(input.stopId))throw Error('A numeric Cairns stop ID is required.');const stop=await addBookmark(input.stopId);showTab('live');return {id:stop.id,name:stop.name,saved:true};}}
  ];
  for(const tool of tools) {try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(console.error);}catch(error){console.error(error);}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
