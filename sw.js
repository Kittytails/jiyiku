// 记忆库 v6.1：让管理页没网时也能打开。和 记忆库v6_1.html 放在同一个目录，文件名必须叫 sw.js。
// 只缓存网页自己（同源的 GET）；对 Worker 的请求（POST、别的域名）一概不碰，记忆数据的离线缓存由网页自己存在本机。
const CACHE='xsjmem-page-v2';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
self.addEventListener('install',()=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k.startsWith('xsjmem-page-')&&k!==CACHE)await caches.delete(k);
  await self.clients.claim();
})());});
async function anyHtml(cache){
  for(const k of await cache.keys()){const r=await cache.match(k);if(r&&/text\/html/i.test(r.headers.get('content-type')||''))return r;}
  return null;
}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin!==self.location.origin||u.pathname.endsWith('/sw.js'))return;
  const key=u.origin+u.pathname;   // 缓存只认「地址去掉 ? 后面的」，同一个页面只存一份，不会有旧的排在前面被命中
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(key);
    const net=fetch(req).then(res=>{if(res&&res.ok&&res.type==='basic')cache.put(key,res.clone()).catch(()=>{});return res;});
    e.waitUntil(net.catch(()=>{}));   // 先给了缓存、网络还在慢慢拿的时候，别让浏览器把 SW 杀掉，不然缓存更新不完
    if(!cached){
      try{return await net;}
      catch(err){if(req.mode==='navigate'){const any=await anyHtml(cache);if(any)return any;}throw err;}
    }
    if(req.mode==='navigate'){   // 网差时 3.5 秒后先给缓存的，不让人干等；后台拿到新的会更新缓存
      const r=await Promise.race([net.catch(()=>null),sleep(3500).then(()=>null)]);
      return r&&r.ok?r:cached;   // 服务器回 404 / 5xx 时也用缓存的，别把错误页盖上去
    }
    try{const r=await net;return r.ok?r:cached;}catch(err){return cached;}
  })());
});
