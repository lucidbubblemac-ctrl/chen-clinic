/* App-shell cache so the app opens offline. Only same-origin files; never caches Supabase traffic. */
var VER=19,CACHE="chen-clinic-v"+VER;
var SHELL=["./","index.html","app.css?v="+VER,"app.js?v="+VER,"sync.js?v="+VER,"config.js?v="+VER,"supabase.js","register-sw.js","manifest.webmanifest","icon-192.png","apple-touch-icon.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL);}).catch(function(){}).then(function(){return self.skipWaiting();}));});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener("fetch",function(e){
  var u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return;
  e.respondWith(fetch(new Request(e.request.url,{cache:"no-cache",credentials:"same-origin"})).then(function(r){var c=r.clone();caches.open(CACHE).then(function(ca){ca.put(e.request,c);});return r;}).catch(function(){return caches.match(e.request).then(function(r){return r||caches.match("index.html");});}));
});
