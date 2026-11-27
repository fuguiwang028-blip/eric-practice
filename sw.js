/* Immutable content-addressed resources. No user progress or speech requests are cached. */
const BASE=self.registration.scope,PREFIX='eric-offline-'+encodeURIComponent(new URL(BASE).pathname)+'-',FILES=PREFIX+'files',META=PREFIX+'meta';
const key=name=>new URL('__eric_offline/'+name,BASE).href,assetKey=e=>key('sha/'+e.sha256+'/'+e.path.split('.').pop());
let currentPromise,downloadBusy=false;const cancelled=new Set();
async function metaRead(name){const r=await(await caches.open(META)).match(key(name));return r?r.json():null;}
async function metaWrite(name,value){await(await caches.open(META)).put(key(name),new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));}
function current(){return currentPromise||(currentPromise=metaRead('active').catch(()=>null));}
async function remoteManifest(){const r=await fetch(new URL('offline-manifest.json',BASE),{cache:'no-store'});if(!r.ok)throw Error('无法检查资源版本，请联网后重试。');const m=await r.json();if(m.schema!==1||!Array.isArray(m.files)||!m.files.every(e=>typeof e.path==='string'&&!e.path.includes('..')&&!e.path.startsWith('/')&&!e.path.includes(':')&&/^[a-f0-9]{64}$/.test(e.sha256)&&Number.isSafeInteger(e.bytes)))throw Error('资源清单格式有误。');return m;}
async function cachedSet(){return new Set((await(await caches.open(FILES)).keys()).map(r=>r.url));}
async function status(m){const present=await cachedSet(),groups={};for(const f of m?.files||[]){const g=groups[f.group]||(groups[f.group]={files:0,bytes:0,cached:0,cachedBytes:0});g.files++;g.bytes+=f.bytes;if(present.has(assetKey(f))){g.cached++;g.cachedBytes+=f.bytes;}}return {manifestVersion:m?.version,release:m?.release,groups,selected:await metaRead('selected')||['core','visual']};}
async function getFile(e,cache){
  if(await cache.match(assetKey(e)))return;
  let last;for(let i=0;i<3;i++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    try{const r=await fetch(new URL(e.path,BASE),{cache:'no-store',signal:controller.signal});if(!r.ok||r.type==='opaque')throw Error('下载失败：'+e.path);const bytes=await r.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==e.sha256)throw Error('资源版本尚未同步：'+e.path);const headers=new Headers(r.headers);headers.delete('Content-Encoding');headers.delete('Transfer-Encoding');headers.set('Content-Length',String(bytes.byteLength));headers.set('Accept-Ranges','bytes');await cache.put(assetKey(e),new Response(bytes,{status:200,headers}));return;}
    catch(error){if(error.name==='QuotaExceededError')throw Error('浏览器存储空间不足，请减少下载分组或释放空间后继续。');last=error;}finally{clearTimeout(timer);}
  }throw last;
}
async function download(m,groups,id,notify=()=>{}){
  if(downloadBusy)throw Error('另一项资源下载正在进行，请稍后再试。');downloadBusy=true;
  const cache=await caches.open(FILES),items=m.files.filter(e=>groups.includes(e.group)),present=await cachedSet();let cursor=0,done=0,bytes=0;const totalBytes=items.reduce((n,e)=>n+e.bytes,0),errors=[];
  const progress=()=>notify({type:'progress',done,total:items.length,bytes,totalBytes});
  try{await Promise.all(Array.from({length:3},async()=>{while(cursor<items.length){if(cancelled.has(id))return;const e=items[cursor++];try{if(!present.has(assetKey(e)))await getFile(e,cache);done++;bytes+=e.bytes;progress();}catch(error){errors.push(error.message);if(error.message.includes('存储空间不足'))cursor=items.length;notify({type:'file-error',message:error.message});}}}));
    if(cancelled.has(id))throw Error('已停止。已下载文件会保留，下次可以继续。');if(errors.length)throw Error(errors.length+' 个文件未完成，已成功的文件会保留。'+errors[0]);progress();
  }finally{downloadBusy=false;cancelled.delete(id);}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const m=await remoteManifest();await download(m,['core'],'install');if(!await metaRead('active'))await metaWrite('active',m);await metaWrite('candidate',m);if(!self.registration.active)await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function normalize(url){const base=new URL(BASE);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return null;let path=decodeURI(url.pathname.slice(base.pathname.length));return path||'index.html';}
async function ranged(request,response){
  const range=request.headers.get('Range');if(!range)return response;
  const buf=await response.arrayBuffer(),m=/^bytes=(\d*)-(\d*)$/.exec(range);let start,end;
  if(m){start=m[1]?Number(m[1]):Math.max(0,buf.byteLength-Number(m[2]));end=m[1]?(m[2]?Math.min(Number(m[2]),buf.byteLength-1):buf.byteLength-1):buf.byteLength-1;}
  if(!m||!Number.isSafeInteger(start)||start<0||start>=buf.byteLength||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+buf.byteLength}});
  const headers=new Headers(response.headers);headers.set('Content-Range','bytes '+start+'-'+end+'/'+buf.byteLength);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');return new Response(buf.slice(start,end+1),{status:206,headers});
}
self.addEventListener('fetch',event=>{
  const r=event.request;if(r.method!=='GET')return;const path=normalize(new URL(r.url));if(path===null||['offline-manifest.json','sw.js'].includes(path)||path.startsWith('api/'))return;
  event.respondWith((async()=>{const m=await current(),entry=m?.files.find(e=>e.path===path);if(!entry)return fetch(r);const cache=await caches.open(FILES);let cached=await cache.match(assetKey(entry));if(!cached){try{await getFile(entry,cache);cached=await cache.match(assetKey(entry));}catch{if(r.mode==='navigate')return new Response('本页面尚未下载，请联网后打开资源下载。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});return new Response('资源尚未下载，请联网后重试。',{status:503});}}return ranged(r,cached);})());
});
self.addEventListener('message',event=>{
  const b=event.data||{},port=event.ports?.[0],reply=value=>port?.postMessage(value);
  if(b.action==='CANCEL'){cancelled.add(b.id);return;}
  if(b.action==='SKIP_WAITING'){self.skipWaiting();return;}
  event.waitUntil((async()=>{try{
    const m=await current();if(!m)throw Error('离线资源尚未初始化，请刷新后重试。');
    if(b.action==='STATUS'){reply({type:'done',data:await status(m)});return;}
    if(b.action==='CHECK'){
      const candidate=await remoteManifest();await metaWrite('candidate',candidate);const present=await cachedSet(),changed=candidate.files.filter(e=>!present.has(assetKey(e)));reply({type:'done',data:{update:candidate.version!==m.version,release:candidate.release,version:candidate.version,files:changed.length,bytes:changed.reduce((n,e)=>n+e.bytes,0)}});return;
    }
    if(['DOWNLOAD','APPLY','PREPARE'].includes(b.action)){
      const groups=[...new Set(['core',...(b.groups||[])])].filter(g=>['core','visual','word','course','print'].includes(g));
      const target=['APPLY','PREPARE'].includes(b.action)?await remoteManifest():m;await metaWrite('selected',groups);await download(target,groups,b.id,reply);
      if(b.action==='PREPARE')await metaWrite('prepared',target);
      if(b.action==='APPLY'){await metaWrite('active',target);currentPromise=Promise.resolve(target);}
      reply({type:'done',data:await status(target)});return;
    }
    if(b.action==='COMMIT'){const prepared=await metaRead('prepared');if(!prepared)throw Error('请先下载更新。');await metaWrite('active',prepared);currentPromise=Promise.resolve(prepared);reply({type:'done',data:await status(prepared)});return;}
    throw Error('未知资源操作。');
  }catch(error){reply({type:'error',message:error.message});}})());
});
