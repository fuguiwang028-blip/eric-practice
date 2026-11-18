const $=id=>document.getElementById(id);
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
let state, recorder;
$('popup-close').onclick=()=>$('popup').close();
$('popup').addEventListener('close',()=>{$('popup-content').replaceChildren();});
function popup(content){
  $('popup-content').innerHTML=content;
  if(!$('popup').open)$('popup').showModal();
}
const api = localAPI;
function notice(message=''){$('notice').textContent=message;$('notice').hidden=!message;}
const doneCount=()=>state.modules.filter(m=>m.climbed).length;
function avatar(student,mine){
  return `<span class="window ${mine?'own':''}" title="${E(student.alias)}"><span class="profile-avatar" aria-hidden="true">${E(student.avatar)}</span><span class="window-name">${E(student.alias)}${mine?' · 我':''}</span></span>`;
}
function tower(path){
  const {rank,user}=state;
  const me=rank.find(x=>x.id===user.id);
  const top=rank[0]?.floor??0;
  const here=me?.floor??top;
  const groups=new Map();
  for(const item of rank){
    if(!groups.has(item.floor))groups.set(item.floor,[]);
    groups.get(item.floor).push(item);
  }
  const ordered=new Set([0,top,here,...groups.keys()]);
  for(const n of [...ordered])for(let d=-2;d<=2;d++)if(n+d>=0&&n+d<=top)ordered.add(n+d);
  let previous;
  const floors=[...ordered].sort((a,b)=>b-a).map(f=>{
    const gap=previous!==undefined&&previous-f>1?`<div class="storey-gap">${previous-1}–${f+1} 层</div>`:'';
    previous=f;
    return gap+`<div class="storey ${me?.floor===f?'current':''} ${f===0?'foundation':''}" id="floor-${f}">
      <span class="floor-sign">${f===0?'大厅':f+' F'}</span><div class="windows">
      ${groups.has(f)?groups.get(f).map(x=>avatar(x,me?.id===x.id)).join(''):'<span class="window empty-window" aria-label="空楼层"></span>'}
      </div></div>`;
  }).join('');
  $('view').innerHTML=`
    <div class="hero"><div class="hero-copy"><p class="eyebrow">${state.day} · 个人楼层</p><h1>今天登楼了吗？</h1>
    <p class="muted">每天完成三个模块的练习，各可登一层。</p>${user.slogan?`<p class="profile-slogan">${E(user.slogan)}</p>`:''}</div>
    <div class="progress"><p class="eyebrow">${me?'我的楼层':'最高楼层'}</p><div class="progress-number">${here}<span>层</span></div>
    <p>${me?`今日已登 ${doneCount()} / 3 层`:`${rank.length} 位学生`}</p></div></div>
    <div class="tower-layout"><section class="tower-shell"><div class="tower-top"><h2>个人楼塔</h2>
    <div><button class="plain" id="locate">${me?'回到我的楼层':'查看最高层'}</button><button class="plain" id="to-top">到顶层</button></div></div>
    <div class="sky"><i class="cloud c1"></i><i class="cloud c2"></i><i class="cloud c3"></i><i class="bird"></i><i class="bird b2"></i>
      <div class="scene-scroll" id="tower-scroll" tabindex="0" aria-label="按楼层查看个人进度"><div class="building"><div class="roof"></div>${floors}</div></div></div></section>
    <section class="panel"><h2>今日路线</h2><div class="path-items daily-route">${moduleLinks()}
    ${me?`<a class="path-item" href="#wordbook"><span>我的生词本</span><small>今日点亮 ${state.vocabulary}/5</small></a>
    <a class="secondary" href="#collection">去抽卡</a>`:''}</div></section></div>`;
  function locate(n,smooth){
    const sc=$('tower-scroll'),floor=$('floor-'+n);
    if(!sc||!floor)return;
    const target=floor.getBoundingClientRect().top-sc.getBoundingClientRect().top+sc.scrollTop-(sc.clientHeight-floor.offsetHeight)/2;
    sc.scrollTo({top:target,behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto'});
  }
  $('locate').onclick=()=>locate(here,true);
  $('to-top').onclick=()=>locate(top,true);
  requestAnimationFrame(()=>locate(here,false));
}
function moduleLinks(active){
  return state.modules.map(m=>`<a class="path-item" href="#review/${m.key}" ${m.key===active?'aria-current="page"':''}><span>${m.label}</span><small>${m.climbed?'今日已登楼':''}</small></a>`).join('');
}
function sectionHeader(title,label=''){
  return `<p class="eyebrow">${E(label)}</p><h1 class="view-title">${title}</h1>`;
}
function material(m,model){
  if(!model)return '<p class="muted">老师还没有发布这个模块。</p>';
  const src=model.audioCourse?'/api/course-audio?id='+encodeURIComponent(model.audioCourse):'/api/module-audio?'+new URLSearchParams({module:m.key,day:model.date});
  return `<h3>${E(model.title)}</h3>${model.board?`<h4>复习板书</h4><div class="board">${E(model.board)}</div>`:''}
  ${(model.boards||[]).map(image=>`<img class="lesson-board" src="${E(image)}" alt="复习板书" loading="lazy">`).join('')}
  ${model.hasAudio?`<h4>音频</h4><audio class="media" controls preload="none" src="${E(src)}"></audio>`:''}`;
}
function review(key,id,mode){
  const category=Object.hasOwn(MODULES,key)?key:Object.keys(MODULES)[0];
  const path=`#review/${category}`;
  const local=globalThis.ERIC_LOCAL_EDITOR===true&&location.protocol==='file:';
  const courses=courseList(category);
  const course=id==='today'?findCourse(category):courses.find(c=>c.id===id);
  $('view').innerHTML=sectionHeader('课程复习')+`<nav class="review-tabs" aria-label="课程模块">${moduleLinks(category)}</nav><div id="review-content"></div>`;
  const host=$('review-content');
  if(course){
    const module=localModule(readProgress(),course,state.day);
    const href=path+'/'+course.id;
    if(mode==='practice'){task(module,host,href);return;}
    host.innerHTML=`<section class="panel">${material(module,module.task)}<div class="action-row"><a class="secondary" href="${path}">返回课次</a>
    <a class="primary" href="${href}/practice">${module.completed?'查看练习结果':module.results.length?'继续练习':'开始练习'} · ${module.task.questions.length} 题</a></div></section>`;
    return;
  }
  host.innerHTML=`<section class="panel course-list"><div class="row course-head"><h2>课次</h2>
    ${local?'<div class="action-row"><label>导入课程 JSON <input id="course-import" type="file" accept=".json,application/json"></label><button id="publish-courses" class="secondary">导出发布课程</button></div>':''}</div>
    <div class="path-items">${courses.map(c=>`<div class="course-row"><a class="path-item" href="${path}/${c.id}"><span>${E(c.title)}</span><small>${c.questions.length} 题</small></a>${local?`<button class="secondary" data-edit-course="${c.id}">编辑</button>`:''}</div>`).join('')}</div></section>`;
  if(local)wireCourseEditor(category);
}
function task(m,view,back){
  const title=sectionHeader(E(m.task?.title||m.label)+' · 练习',state.day);
  if(m.completed||!m.task){
    const correct=countCorrect(m.results);
    view.innerHTML=title+`<section class="panel"><h2>${m.completed?'本轮训练完成':'老师还没有发布今日练习'}</h2>
      ${m.completed?`<p>本轮答对 ${correct} / ${scored(m.task).length} 道计分题。单轮答对至少 9 道可获一次抽卡机会。</p>`:''}
      <div class="action-row"><a class="secondary" href="${back}">返回课程复习</a>
      ${m.completed?`<button class="secondary" id="retry-practice">重新练习</button>${correct>=9?'<a class="primary" href="#collection">去抽卡</a>':''}`:''}</div></section>`;
    if(m.completed)$('retry-practice').onclick=async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{await api('retry-practice',{module:m.key});await refresh();}
      catch(error){notice(error.message);button.disabled=false;}
    };
    return;
  }
  const index=m.results.length;
  const question=m.task.questions[index];
  if(!question){$('view').textContent='任务进度已更新，请刷新。';return;}
  const reading=question.kind==='read', checking=question.kind==='check', total=m.task.questions.length;
  view.innerHTML=`<div class="question-wrap">${title}<section class="panel"><details><summary>查看复习板书${m.task.hasAudio?'与音频':''}</summary>${material(m,m.task)}</details>
    <p class="eyebrow" style="margin-top:15px">第 ${index+1} / ${total} 题 · ${question.bonus?'王者冲刺 · ':''}${reading?'朗读题':checking?'作答后对照':'选择题'}</p>
    <div class="steps" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${index}"><i style="width:${index/total*100}%"></i></div>
    <form id="answer-form"><fieldset><legend>${E(question.prompt)}</legend>
    ${reading?`<div id="read-box"><p class="muted">${state.speechReady?'提交后，录音会发送到评测服务，由讯飞生成发音反馈。':'录音仅供本机回听。跟读后可以确认完成。'}</p>
      <div class="action-row"><button class="secondary" type="button" id="listen" ${typeof speechSynthesis==='undefined'?'hidden':''}>听范读</button>
      <button type="button" class="secondary" data-record>开始录音</button><button type="button" class="secondary" data-stop disabled>停止录音</button></div>
      <p class="grade" data-record-status role="status"></p><audio class="media" controls hidden></audio></div>`:
      checking?'<label>你的答案<input name="response" maxlength="2000" required autocomplete="off" placeholder="输入后按回车"></label>':question.choices.map((x,i)=>`<label class="choice"><input type="radio" required name="choice" value="${i}">${E(x)}</label>`).join('')}
    </fieldset><div id="feedback" role="status"></div>
    <button id="submit-answer" class="primary" style="margin-top:12px" ${reading?(state.speechReady?'disabled':''):'hidden'}>${reading?(state.speechReady?'提交评测':'确认已跟读'):''}</button>
    <button id="next-question" type="button" class="primary" hidden></button></form></section></div>`;
  if(reading){
    const host=$('read-box');
    recorder=attachRecorder(host);
    host.addEventListener('recorded',()=>$('submit-answer').disabled=false);
    host.addEventListener('recording',()=>$('submit-answer').disabled=state.speechReady);
    $('listen').onclick=()=>{
      speechSynthesis.cancel();
      const line=new SpeechSynthesisUtterance(question.prompt);line.lang='en-US';line.rate=.83;speechSynthesis.speak(line);
    };
  }
  const screen=$('answer-form');
  if(!checking&&!reading)screen.onchange=()=>screen.requestSubmit();
  if(checking)screen.elements.response.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.isComposing){event.preventDefault();screen.requestSubmit();}
  });
  screen.onsubmit=async event=>{
    event.preventDefault();
    const submit=$('submit-answer');
    if(submit.dataset.busy==='1')return;
    submit.dataset.busy='1';
    const payload={day:state.day,module:m.key,index,version:m.task.version};
    const activeRecorder=recorder;
    submit.disabled=true;
    notice();
    try{
      if(reading){
        if(state.speechReady&&!activeRecorder.audio())throw new Error('请先完成录音。');
        if(state.speechReady)payload.audio=await pcmFromRecording(activeRecorder.audio());
        else payload.selfCheck=true;
      }else if(checking)payload.response=new FormData(screen).get('response');
      else payload.choice=Number(new FormData(screen).get('choice'));
      const {result,completed,correctCount}=await api('question',payload);
      if(!screen.isConnected)return;
      if(completed){
        m.completed=true;

      }
      m.results[index]=result;
      screen.querySelectorAll('input, textarea, [data-record], [data-stop]').forEach(el=>el.disabled=true);
      const scores=result.scores;
      const scoreLabels={accuracy:'准确度',fluency:'流畅度',integrity:'完整度'};
      const details=scores?Object.entries(scoreLabels).filter(([key])=>scores[key]!==undefined).map(([key,label])=>label+' '+scores[key]).join(' · '):'';
      const words=Array.isArray(scores?.words)?scores.words.filter(w=>w.score<70).map(w=>E(w.text)).join('、'):'';
      $('feedback').innerHTML=`<div class="feedback ${result.correct===false?'wrong':''}">
        <strong>${reading?(scores?'讯飞朗读评分 '+E(scores.total)+' / 100':'已回听并完成跟读'):checking?(result.matches?'✓ 与参考答案一致':'请对照参考答案'):result.correct?'✓ 答对了':'还差一点'}</strong>
        ${!reading?`<p>${checking?'参考答案':'正确答案'}：${E(checking?result.reference:question.choices[result.answer])}</p>`:''}
        ${details?`<p>${E(details)}</p>`:''}${words?`<p>建议再读：${words}</p>`:''}
        <p>${E(result.explanation)}</p>${completed?`<strong>本轮答对 ${correctCount??countCorrect(m.results)} 道</strong>`:''}</div>`;
      submit.hidden=true;
      const next=$('next-question');
      next.hidden=false;
      next.textContent=completed?'查看完成记录':'下一题';
      next.onclick=()=>{cleanupRecorder();task(m,view,back);};
      next.focus();
    }catch(error){
      if(!screen.isConnected)return;
      notice(error.message);submit.dataset.busy='0';submit.disabled=false;
    }
  };
}
function cardDetail(c){
  popup(`<h2>${E(c.name)} · ${E(c.number)}</h2><iframe class="card-detail" title="${E(c.name)} 卡片详情" src="${E(c.url)}?embed=1"></iframe><button id="card-static" class="secondary">查看平面卡</button>`);
  $('card-static').onclick=()=>showCardSide(c,false);
}
function showCardSide(c,back){
  popup(`<h2>${E(c.name)} · ${E(c.number)}</h2><img class="draw-card" src="${E(back?c.back:c.image)}" alt="${back?'背面':'正面'}"><div class="action-row"><button id="card-flip" class="primary">${back?'回到正面':'翻到背面'}</button><button id="card-holo" class="secondary">镭射版</button></div>`);
  $('card-flip').onclick=()=>showCardSide(c,!back);
  $('card-holo').onclick=()=>cardDetail(c);
}
async function collection(){
  const view=$('view');
  view.innerHTML=sectionHeader('我的收藏')+`<section class="panel" id="collection-panel">正在读取卡片册…</section>`;
  const host=$('collection-panel');
  const requestKey='draw-request-'+state.user.id;
  function show(data){
    if(!host.isConnected)return;
    host.innerHTML=`<div class="row"><h2>卡片册</h2><button class="primary" id="draw" ${data.available||sessionStorage.getItem(requestKey)?'':'disabled'}>抽卡</button></div>
    <p class="muted">可抽 ${data.available} 次。单轮训练答对至少 9 题、复习 5 个到期词可获得次数。</p>
    <div class="card-grid">${data.cards.map((c,i)=>c.quantity
      ? `<button type="button" class="collection-card owned-card" data-card="${i}"><img loading="lazy" src="${E(c.image)}?owned=1" alt=""><span>${E(c.name)} · ${E(c.number)}</span><span class="card-quantity">${E(c.rarity)} 级 · 已获得 ${c.quantity} 张</span></button>`
      : '<div class="collection-card locked-card"><div class="locked-card-face" aria-hidden="true">?</div><span>未获得</span></div>').join('')}</div>
    <p class="collection-total" aria-live="polite">共 ${data.total} 张</p>`;
    host.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>cardDetail(data.cards[b.dataset.card]));
    $('draw').onclick=async()=>{
      $('draw').disabled=true;
      const requestId=sessionStorage.getItem(requestKey)||(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random());
      sessionStorage.setItem(requestKey,requestId);
      $('popup-close').disabled=true;
      popup('<h2>卡片正在旋转</h2><div class="spinning-card" aria-hidden="true">?</div><button id="reveal-draw" class="primary" disabled>等待揭晓…</button>');
      const reveal=$('reveal-draw');
      const dialog=$('popup');
      dialog.oncancel=event=>event.preventDefault();
      try{
        const [result]=await Promise.all([api('draw',{requestId}),new Promise(resolve=>setTimeout(resolve,3600))]);
        reveal.textContent='揭晓卡片';
        reveal.disabled=false;
        reveal.onclick=()=>{
          sessionStorage.removeItem(requestKey);
          show(result);
          $('popup-close').disabled=false;
          dialog.oncancel=null;
          if(result.card){
            const c=result.card;
            popup(`<h2>${c.quantity>1?'再次获得':'获得'} ${E(c.name)} · ${E(c.number)}</h2><img class="draw-card" src="${E(c.image)}?owned=1" alt=""><p>这张卡已累计获得 ${c.quantity} 张。</p><button class="primary" id="draw-detail">查看卡片</button>`);
            $('draw-detail').onclick=()=>cardDetail(c);
          }else popup('<h2>这次没有抽到卡片</h2><p>下次再来试试。</p>');
        };
      }catch(error){
        if(error.status===409)sessionStorage.removeItem(requestKey);
        dialog.oncancel=null;$('popup-close').disabled=false;dialog.close();
        notice(error.message);
        try{show(await api('collection'));}catch{}
      }
    };
  }
  try{show(await api('collection'));}catch(error){host.textContent=error.message;}
}
function backup() {
  $('view').innerHTML='<section class="panel"><h1>进度备份</h1><p>练习、单词和卡片存在当前浏览器。换设备前先导出，再在新设备导入。导入会替换当前进度。</p><div class="row"><button id="export" class="primary">导出进度</button><label>选择备份文件 <input type="file" id="import" accept=".json,application/json"></label><button id="restore" disabled>确认替换进度</button></div></section>';
  $('export').onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(readProgress(),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='eric-progress-'+localDay()+'.json'; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  let pending;
  $('import').onchange=async()=>{
    const input=$('import');
    const restore=$('restore');
    pending=null;
    restore.disabled=true;
    const file=input.files[0];
    if(!file) return;
    try {
      if(file.size>2*1024*1024) throw Error('备份文件过大。');
      const candidate=validateProgress(JSON.parse(await file.text()));
      if(!input.isConnected || input.files[0]!==file) return;
      pending=candidate; restore.disabled=false;
      notify(`备份包含 ${cardTotal(pending)} 张卡。请确认是否替换。`);
    } catch(error) {if(input.isConnected)notify(error instanceof SyntaxError?'无法读取该 JSON 文件。':error.message);}
  };
  $('restore').onclick=()=>{if(pending && saveProgress(pending)){backup();notify('进度已恢复。');}};
}
function cleanupRecorder(){
  recorder?.dispose();
  recorder=null;
  if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();
}
function render(){
  cleanupRecorder();
  const [raw,key,id,mode]=location.hash.slice(1).split('/');
  if(!state.user||raw==='profiles'||raw==='profile'){profilePage(raw==='profile');return;}
  $('menu').hidden=false;
  $('profile-link').hidden=false;
  $('profile-link').textContent=state.user.avatar+' '+state.user.alias;
  const page=raw==='home'?'tower':raw==='lesson'?'review':raw||'tower';
  const nav=page==='wordbook'?'words':page;
  for(const a of $('menu').querySelectorAll('a')){
    if(a.hash==='#'+nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  const pages={tower,review,collection,words:wordCanvas,wordbook,backup};
  (Object.hasOwn(pages,page)?pages[page]:tower)(key,id,mode);
}
async function refresh(){
  state=await api('state');
  render();
}
window.addEventListener('hashchange',()=>{notice();refresh().catch(e=>notice(e.message));});
document.addEventListener('DOMContentLoaded',()=>refresh().catch(e=>notice(e.message)));
