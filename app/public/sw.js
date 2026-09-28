const CACHE='buswatch-shell-v2';
const SHELL=['/','/index.html','/styles.css','/app.js','/data-api.js','/manifest.json','/favicon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('buswatch-shell-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Never cache API responses as fresh: the app owns its explicitly stale snapshot.
  if(event.request.method!=='GET' || url.origin!==self.location.origin || url.pathname.startsWith('/api/')) return;
  if(!SHELL.includes(url.pathname) && event.request.mode!=='navigate') return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok && !response.redirected){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>await caches.match(event.request) || (event.request.mode==='navigate'?await caches.match('/'):Response.error())));
});
