// Офлайн-режим: приложение и фото сохраняются в телефоне после первого открытия.
// При изменениях меняй номер версии, чтобы телефоны подтянули новое.
const V="zal-v2";
const FILES=["./","index.html","data.js","extra.js","app.js","manifest.json","icon.svg","icon-512.png","img/bbsquat-0.jpg","img/bbsquat-1.jpg","img/bench-0.jpg","img/bench-1.jpg","img/calf-0.jpg","img/calf-1.jpg","img/curl-0.jpg","img/curl-1.jpg","img/dbbench-0.jpg","img/dbbench-1.jpg","img/dips-0.jpg","img/dips-1.jpg","img/facepull-0.jpg","img/facepull-1.jpg","img/fly-0.jpg","img/fly-1.jpg","img/glute-0.jpg","img/glute-1.jpg","img/hammer-0.jpg","img/hammer-1.jpg","img/incline-0.jpg","img/incline-1.jpg","img/kneeraise-0.jpg","img/kneeraise-1.jpg","img/latraise-0.jpg","img/latraise-1.jpg","img/legcurl-0.jpg","img/legcurl-1.jpg","img/legext-0.jpg","img/legext-1.jpg","img/legpress-0.jpg","img/legpress-1.jpg","img/lunge-0.jpg","img/lunge-1.jpg","img/ohp-0.jpg","img/ohp-1.jpg","img/plank-0.jpg","img/plank-1.jpg","img/pulldown-0.jpg","img/pulldown-1.jpg","img/pullup-0.jpg","img/pullup-1.jpg","img/pushdown-0.jpg","img/pushdown-1.jpg","img/rdl-0.jpg","img/rdl-1.jpg","img/row-0.jpg","img/row-1.jpg","img/seatedrow-0.jpg","img/seatedrow-1.jpg","img/squat-0.jpg","img/squat-1.jpg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  // Сначала сеть (чтобы видеть обновления), без сети — из памяти телефона
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});
