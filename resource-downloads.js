/* Explicit media downloads; app updates require a user action outside practice. */
const ResourceDownloads=(()=>{
  const labels={core:'网站基础文件',visual:'背景、卡片与人物图片',word:'1000词真人范读',course:'课程图片与范读音频',print:'PDF打印组件与中文字体'};
  const descriptions={core:'页面、词表、课程题库和功能脚本',visual:'摩天楼、装备、卡包等页面素材',word:'包含已补齐的单词录音',course:'发布在本网站的课程媒体；外部链接需联网',print:'下载后可离线生成中文PDF'};
  const supported=()=>location.protocol!=='file:'&&isSecureContext&&'serviceWorker'in navigator&&'caches'in globalThis;
  let registration,bootPromise,job=null,lastStatus,updateInfo;
  const size=n=>n>=1024*1024?(n/1024/1024).toFixed(1)+' MB':Math.ceil(n/1024)+' KB';
  async function boot(){
    if(!supported())return null;
    return bootPromise||(bootPromise=(async()=>{registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});registration=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('资源服务初始化超时，请检查网络后重试。')),90000);navigator.serviceWorker.ready.then(r=>{clearTimeout(timer);resolve(r);},e=>{clearTimeout(timer);reject(e);});});return registration;})().catch(e=>{bootPromise=null;throw e;}));
  }
  async function rpc(action,body={},onProgress=()=>{}){
    await boot();const worker=registration?.active;if(!worker)throw Error('资源服务尚未就绪，请稍后重试。');
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel();let timer;
      const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{channel.port1.close();reject(Error('连接中断，已完成文件会保留，请重新进入资源下载继续。'));},180000);};arm();
      channel.port1.onmessage=e=>{const r=e.data;arm();if(r.type==='done'||r.type==='error'){clearTimeout(timer);channel.port1.close();r.type==='done'?resolve(r.data):reject(Error(r.message));}else onProgress(r);};
      worker.postMessage({action,...body},[channel.port2]);
    });
  }
  function practicing(){return document.body.classList.contains('focus-practice')||!!document.querySelector('#a4-form,#a4-paper');}
  function banner(){
    let box=$('resource-update-banner');if(!box){box=document.createElement('aside');box.id='resource-update-banner';box.className='resource-update-banner';box.hidden=true;document.querySelector('.bar')?.after(box);}
    if(!updateInfo?.update){box.hidden=true;return;}
    box.hidden=false;box.innerHTML='<span>发现网站资源更新'+(updateInfo.release?' · '+E(updateInfo.release):'')+'</span><div><button class="secondary" id="resource-show-update">查看并下载更新</button><button class="plain" id="resource-later">稍后</button></div>';
    $('resource-show-update').onclick=()=>{if(practicing()){notice('当前学习进度已保存，请先返回列表，再打开资源下载更新。');return;}location.hash='#resources';};$('resource-later').onclick=()=>{box.hidden=true;};
  }
  async function check(silent=false){try{if(!supported())return;await boot();updateInfo=await rpc('CHECK');banner();if(!silent)notice(updateInfo.update?'发现更新，可以下载更新资源。':'当前已经是最新版本。');return updateInfo;}catch(error){if(!silent)notice(error.message);}}
  async function begin(action,groups){
    if(job)throw Error('资源正在下载，请等待完成或停止后再试。');
    if(action==='APPLY'&&practicing())throw Error('请先退出当前练习，再应用更新。学习进度会保留。');
    const id=Date.now()+'-'+Math.random().toString(36).slice(2),current=job={id,action,progress:null,error:null};updateProgress();
    try{if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
      lastStatus=await rpc(action==='APPLY'?'PREPARE':action,{groups,id},p=>{if(p.type==='progress'){current.progress=p;updateProgress();}else if(p.type==='file-error'){current.error=p.message;updateProgress();}});
      if(action==='APPLY'){
        if(practicing()){notice('更新资源已下载。请结束当前练习后，回资源下载点击应用更新。');return;}
        await rpc('COMMIT');updateInfo=null;banner();if(registration.waiting)registration.waiting.postMessage({action:'SKIP_WAITING'});
        notice('资源更新已完成，正在重新打开网站；学生档案会保留。');setTimeout(()=>location.reload(),1200);
      }else notice('所选学习资源已下载，可以离线使用。');
    }catch(error){notice(error.message);}finally{job=null;if($('resource-host')?.isConnected)page();}
  }
  function updateProgress(){const el=$('resource-progress');if(!el||!job)return;$('resource-stop')?.removeAttribute('hidden');document.querySelectorAll('#resource-host .resource-actions button:not(#resource-stop),#resource-host [data-resource-group]').forEach(b=>b.disabled=true);const p=job.progress;el.innerHTML='<p>'+(!p?'正在准备下载…':'已完成 '+p.done+' / '+p.total+' 个文件 · '+size(p.bytes)+' / '+size(p.totalBytes))+'</p><progress max="'+(p?.total||1)+'" value="'+(p?.done||0)+'"></progress>'+(job.error?'<p class="muted">'+E(job.error)+'</p>':'');}
  async function page(){
    $('view').innerHTML=sectionHeader('学习资源下载')+'<section class="panel resource-panel" id="resource-host"><p>正在读取资源状态…</p></section>';
    const host=$('resource-host');
    if(!supported()){
      host.innerHTML='<h2>当前是完整本地版</h2><p>解压包已包含背景、课程和单词录音，保留整个文件夹即可使用，无需在浏览器里重复下载。</p><p>在线网站的 HTTPS 页面会显示分组下载、进度及更新按钮。直接双击HTML时，浏览器不提供网站离线缓存功能。</p><p>打印PDF仍可在本地版使用。</p><a class="secondary" href="#review">返回课程复习</a>';return;
    }
    try{
      await boot();lastStatus=await rpc('STATUS');if(!host.isConnected)return;
      const estimate=await navigator.storage?.estimate?.().catch(()=>null),selected=new Set(lastStatus.selected||['core','visual']);
      host.innerHTML=`<header><h2>下载一次，日常更快打开</h2><p>基础文件自动保存；可一次下载全部图片和范读音频。中断后重新点击，会跳过已下载文件。</p></header><div class="resource-groups">${Object.entries(labels).map(([key,label])=>{const g=lastStatus.groups[key]||{files:0,bytes:0,cached:0};return `<label class="resource-group"><input type="checkbox" data-resource-group="${key}" ${selected.has(key)||key==='core'?'checked':''} ${key==='core'||job?'disabled':''}><span><strong>${label}</strong><small>${descriptions[key]}</small></span><span class="resource-group-size">${size(g.bytes)}<small>${g.cached} / ${g.files} 已下载</small></span></label>`;}).join('')}</div><div class="resource-actions"><button class="primary" id="resource-download" ${job?'disabled':''}>下载所选资源</button><button class="secondary" id="resource-download-all" ${job?'disabled':''}>一键下载全部资源</button><button class="secondary" id="resource-check" ${job?'disabled':''}>检查更新</button><button class="secondary" id="resource-apply" ${job?'disabled':''}>下载更新并重新打开</button><button class="plain" id="resource-stop" ${job?'':'hidden'}>停止下载</button></div><div id="resource-progress" role="status"></div><p id="resource-update-info" class="muted"></p><details><summary>离线使用与存储说明</summary><p>下载仅保存在当前设备的当前浏览器，不用每次登录重新下载。浏览器清理网站数据或空间不足时，仍可能移除缓存；可以回到这里重新下载。</p><p>图片和范读可以离线使用；讯飞语音测评、外链视频仍需联网。HTTPS外部媒体不包含在此资源包中。</p><p>更新按文件内容核对，只补下载改变的资源；学生进度保存在原档案，不会作为资源更新的一部分清除。请保留进度备份。</p>${estimate?`<p>浏览器当前已使用约 ${size(estimate.usage||0)}，配额约 ${size(estimate.quota||0)}；配额以浏览器实际允许为准。</p>`:''}</details>`;
      const groups=()=>[...host.querySelectorAll('[data-resource-group]:checked')].map(x=>x.dataset.resourceGroup);
      $('resource-download').onclick=()=>begin('DOWNLOAD',groups());$('resource-download-all').onclick=()=>begin('DOWNLOAD',Object.keys(labels));
      $('resource-check').onclick=async()=>{const info=await check();if($('resource-update-info'))$('resource-update-info').textContent=info?.update?'有新版本，点击「下载更新并重新打开」应用更新。':'当前已经是最新版本。';};
      $('resource-apply').onclick=()=>begin('APPLY',groups());$('resource-stop').onclick=()=>registration.active.postMessage({action:'CANCEL',id:job?.id});updateProgress();
      if(updateInfo?.update)$('resource-update-info').textContent='有新版本可下载。更新时会保留学生档案。';
    }catch(error){if(host.isConnected)host.innerHTML='<p>'+E(error.message)+'</p><button class="secondary" id="resource-retry">重试</button>';if($('resource-retry'))$('resource-retry').onclick=page;}
  }
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{if(supported())setTimeout(()=>{boot().then(()=>check(true)).catch(()=>{});},2500);});
  return {page,check,boot,rpc,supported};
})();
function resourcesPage(){return ResourceDownloads.page();}
