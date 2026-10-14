/* Quiet Day app shell: launch from cache, update in the background. */
const CACHE='quiet-day-shell-v2';
const ROOT=new URL('./',self.registration.scope).href;
const withinScope=url=>url.origin===self.location.origin&&url.href.startsWith(self.registration.scope);
async function cachePage(cache,response){
 if(!response.ok)return;
 await cache.put(ROOT,response.clone());
 const html=await response.text();
 const links=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
  .map(match=>new URL(match[1],ROOT)).filter(withinScope);
 await Promise.all(links.map(async url=>{try{
  const r=await fetch(url.href,{cache:'no-cache'});
  if(r.ok)await cache.put(url.href,r);
 }catch{}}));
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{await cachePage(cache,await fetch(ROOT,{cache:'reload'}))}catch{}
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('quiet-day-shell-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||!withinScope(new URL(request.url)))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   const stored=await cache.match(ROOT);
   const refresh=(async()=>{try{await cachePage(cache,await fetch(ROOT,{cache:'no-cache'}))}catch{}})();
   event.waitUntil(refresh);
   if(stored)return stored;
   try{const response=await fetch(request);if(response.ok){event.waitUntil(cachePage(cache,response.clone()));return response}}catch{}
   return Response.error();
  })());
  return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const stored=await cache.match(request);
  if(stored)return stored;
  try{const response=await fetch(request);if(response.ok)event.waitUntil(cache.put(request,response.clone()));return response}catch{return Response.error()}
 })());
});
