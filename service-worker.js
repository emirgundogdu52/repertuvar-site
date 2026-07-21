self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(event){
  event.waitUntil((async function(){
    var names = await caches.keys();
    await Promise.all(names.map(function(n){ return caches.delete(n); }));
    await self.registration.unregister();
    var list = await self.clients.matchAll({ type: 'window' });
    list.forEach(function(c){ c.navigate(c.url); });
  })());
});
