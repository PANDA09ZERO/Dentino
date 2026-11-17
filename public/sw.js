// Service worker de Dentino: permite instalar la app en el teléfono.
// No guarda nada en caché a propósito: la información clínica y de caja nunca se queda en el dispositivo.
// Si no hay conexión al abrir la app, se muestra un aviso en lugar de una página de error del navegador.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
const offline=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dentino · Sin conexión</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f8f7;font-family:system-ui,sans-serif;color:#263e3b;text-align:center;padding:24px}
div{max-width:320px}h1{font-size:22px;margin:16px 0 8px}p{color:#72817b;line-height:1.6}button{margin-top:16px;border:0;border-radius:12px;background:#174e42;color:#fff;padding:12px 20px;font-size:15px}</style></head>
<body><div><img src="/icon-192.png" width="72" height="72" alt=""><h1>Sin conexión</h1><p>Dentino necesita conexión con el servidor de la clínica. Revisa tu internet o la red de la clínica e inténtalo de nuevo.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`;
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>new Response(offline,{headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
