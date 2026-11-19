const $=id=>document.getElementById(id);
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
let state, recorder;
$('popup-close').onclick=()=>$('popup').close();
$('popup').addEventListener('close',()=>{if($('popup-content').querySelector('.word-card'))stopWordRecording();$('popup-content').replaceChildren();});
function popup(content){
  $('popup-content').innerHTML=content;
  if(!$('popup').open)$('popup').showModal();
}
const api = localAPI;
function notice(message=''){$('notice').textContent=message;$('notice').hidden=!message;}
const doneCount=()=>state.modules.filter(m=>m.climbed).length;
function moduleLinks(active){
  return state.modules.map(m=>`<a class="path-item" href="#review/${m.key}" ${m.key===active?'aria-current="page"':''}><span>${m.label}</span><small>${m.climbed?'今日已登楼':''}</small></a>`).join('');
}
function sectionHeader(title,label=''){
  return `<p class="eyebrow">${E(label)}</p><h1 class="view-title">${title}</h1>`;
}
function material(m,model){
  if(!model)return '<p class="muted">老师还没有发布这个模块。</p>';
  const src=model.audioCourse?'/api/course-audio?id='+encodeURIComponent(model.audioCourse):'/api/module-audio?'+new URLSearchParams({module:m.key,day:model.date});
  const boards=(model.boards||[]).filter(validBoard);
  return `<h3>${E(model.title)}</h3>${model.board?`<h4>复习板书</h4><div class="board">${E(model.board)}</div>`:''}
  ${boards.length?`<section class="review-slides" aria-label="复习图片">
    <div class="review-slide-stage" tabindex="0" aria-label="向左或向右滑动，也可按左右方向键"><img alt="" decoding="async"><p class="muted" data-slide-error hidden></p></div>
    <div class="review-slide-controls"><button class="secondary" type="button" data-slide-prev>上一页</button><span data-slide-count aria-live="polite"></span><button class="secondary" type="button" data-slide-next>下一页</button></div></section>`:''}
  ${model.hasAudio?`<h4>音频</h4><audio class="media" controls preload="none" src="${E(src)}"></audio>`:''}`;
}
let releaseReviewImage;
function wireReviewSlides(host,model){
  const stage=host.querySelector('.review-slide-stage');
  if(!stage)return;
  const boards=model.boards.filter(validBoard);
  const image=stage.querySelector('img'), error=stage.querySelector('[data-slide-error]');
  const prev=host.querySelector('[data-slide-prev]'), next=host.querySelector('[data-slide-next]');
  const counter=host.querySelector('[data-slide-count]');
  let position=0, start=null, generation=0, objectUrl;
  releaseReviewImage?.();
  const release=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;};
  releaseReviewImage=()=>{generation++;release();};
  async function show(target){
    position=Math.min(boards.length-1,Math.max(0,target));
    const request=++generation;
    release();
    image.removeAttribute('src');
    image.alt='第 '+(position+1)+' 页复习图片';
    error.hidden=true;
    prev.disabled=position===0;next.disabled=position===boards.length-1;
    counter.textContent=(position+1)+' / '+boards.length;
    try{
      let src=boards[position];
      if(localCourseEditor()&&src.startsWith('./course-media/')){
        const blob=await readCourseMedia(src);
        if(request!==generation||!stage.isConnected)return;
        if(blob)src=objectUrl=URL.createObjectURL(blob);
      }
      image.src=src;
    }catch{
      if(request===generation){error.textContent='这张复习图暂时无法加载。';error.hidden=false;}
    }
  }
  image.onerror=()=>{error.textContent='这张复习图暂时无法加载。';error.hidden=false;};
  prev.onclick=()=>show(position-1);
  next.onclick=()=>show(position+1);
  stage.onkeydown=event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();
      show(position+(event.key==='ArrowLeft'?-1:1));
    }
  };
  stage.ontouchstart=event=>{start=event.changedTouches[0];};
  stage.ontouchcancel=()=>{start=null;};
  stage.ontouchend=event=>{
    if(!start)return;
    const touch=event.changedTouches[0],dx=touch.clientX-start.clientX,dy=touch.clientY-start.clientY;
    start=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))show(position+(dx<0?1:-1));
  };
  show(0);
}
async function review(key,id,mode){
  const category=Object.hasOwn(MODULES,key)?key:Object.keys(MODULES)[0];
  const path=`#review/${category}`;
  const local=localCourseEditor();
  const courses=courseList(category);
  const course=id==='today'?findCourse(category):courses.find(c=>c.id===id);
  $('view').innerHTML=sectionHeader('课程复习')+`<nav class="review-tabs" aria-label="课程模块">${moduleLinks(category)}</nav><div id="review-content"></div>`;
  const host=$('review-content');
  const progress=readProgress();
  if(course){
    const module=localModule(progress,course,state.day);
    const href=path+'/'+course.id;
    if(mode==='practice'){
      if(practiceUnlocked(progress,course)){task(module,host,href+'/review');return;}
      host.innerHTML=`<section class="panel"><p>请先打开本课复习，再开始练习。</p><a class="primary" href="${href}/review">打开复习</a></section>`;
      return;
    }
    host.innerHTML=`<section class="panel">${material(module,module.task)}<div class="action-row"><a class="secondary" href="${path}">返回课次</a><span id="review-unlock"></span></div></section>`;
    wireReviewSlides(host,module.task);
    try{
      await api('open-review',{module:course.id});
      if(host.isConnected)$('review-unlock').innerHTML=`<a class="primary" href="${href}/practice">${module.completed?'查看练习结果':module.results.length?'继续练习':'开始练习'} · ${module.task.questions.length} 题</a>`;
    }catch(error){if(host.isConnected)notice(error.message);}
    return;
  }
  const folders=new Map();
  for(const course of courses){
    const folder=course.folder||'未分组';
    if(!folders.has(folder))folders.set(folder,[]);
    folders.get(folder).push(course);
  }
  function courseRow(c){
    const href=path+'/'+c.id;
    const isNew=recentlyPublished(c,state.day)&&!courseFinished(progress,c);
    return `<div class="course-row"><div class="path-item ${isNew?'has-new':''}">${isNew?'<span class="course-new">NEW</span>':''}<span>${E(c.title)}</span><small>${c.questions.length} 题${coursePassed(progress,c)?' · 已完成':''}</small></div>
      <div class="course-actions"><a class="secondary" href="${href}/review">复习</a>
      ${practiceUnlocked(progress,c)?`<a class="primary" href="${href}/practice">练习</a>`:'<button class="primary" disabled title="打开复习后解锁">练习</button>'}
      ${local?`<button class="secondary" data-edit-course="${c.id}">编辑</button><button class="secondary" data-move-course="${c.id}" data-offset="-1">上移</button><button class="secondary" data-move-course="${c.id}" data-offset="1">下移</button><button class="secondary course-delete" data-delete-course="${c.id}">删除</button>`:''}</div></div>
      ${local?`<details class="course-question-list"><summary>题目名称</summary><ol>${c.questions.map(q=>`<li>${E(q.prompt)}</li>`).join('')}</ol></details>`:''}`;
  }
  host.innerHTML=`<section class="panel course-list"><div class="row course-head"><h2>课次</h2>
    ${local?'<div class="action-row"><label>导入课件 ZIP / JSON <input id="course-import" type="file" multiple accept=".zip,.json,application/zip,application/json"></label><button id="publish-courses" class="secondary">导出发布课程</button><button id="publish-course-media" class="secondary">导出课件媒体</button></div>':''}</div>
    ${[...folders].map(([name,items])=>`<details class="course-folder" ${folders.size===1?'open':''}><summary>${E(name)} <small>${items.length} 个课次</small></summary><div class="path-items">${local?`<div class="course-folder-tools"><button class="secondary" type="button" data-rename-folder="${E(name)}">修改目录名</button></div>`:''}${items.map(courseRow).join('')}</div></details>`).join('')||'<p class="muted">这个模块暂无课次。</p>'}</section>`;
  if(local)wireCourseEditor(category);
}
function pronunciationFeedback(scores,prompt){
  if(!scores)return '';
  const words=Array.isArray(scores.words)?scores.words:[];
  const phones=Array.isArray(scores.phones)?scores.phones:[];
  const errors=(scores.phoneIssues||0)+(scores.syllableIssues||0);
  const statusByCode={16:['red','漏读'],32:['yellow','多读'],64:['yellow','重复'],128:['red','读成别的音或词']};
  const singleWord=/^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(prompt.trim());
  const wordStatus=word=>{
    if(statusByCode[word.code])return statusByCode[word.code];
    if((singleWord&&errors>0)||(Number.isFinite(word.score)&&word.score<85))return ['yellow','建议再读'];
    if(singleWord&&!phones.length)return ['neutral','未收到逐音素状态'];
    if(Number.isFinite(word.score))return ['green','读得较清楚'];
    return ['neutral','无单词得分'];
  };
  const needsRetry=errors>0||(scores.accuracy??scores.total)<85||words.some(w=>['red','yellow'].includes(wordStatus(w)[0]));
  const hasDetails=words.length||phones.length;
  const verdict=needsRetry?'建议再读一次。':hasDetails?'以下是讯飞返回的分项结果。':'讯飞本次未返回可定位的分项，单个音是否准确还需回听确认。';
  const chip=(text,[color,label])=>`<span class="speech-chip speech-${color}"><strong>${E(text)}</strong><small>${E(label)}</small></span>`;
  const isShip=prompt.trim().toLowerCase()==='ship';
  const phoneSymbols={aa:'ɑː',ae:'æ',ah:'ʌ',ao:'ɔː',ar:'eə',aw:'aʊ',ax:'ə',ay:'aɪ',eh:'e',er:'ɜː',ey:'eɪ',ih:'ɪ',ir:'ɪə',iy:'iː',oo:'ɒ',ow:'əʊ',oy:'ɔɪ',uh:'ʊ',uw:'uː',ur:'ʊə',hh:'h',jh:'dʒ',ng:'ŋ',sh:'ʃ',th:'θ',dh:'ð',y:'j',zh:'ʒ',ch:'tʃ',b:'b',d:'d',f:'f',g:'g',k:'k',l:'l',m:'m',n:'n',p:'p',r:'r',s:'s',t:'t',v:'v',w:'w',z:'z'};
  const phoneStatus=phone=>phone.code===0?['green','✓ 正常读出']:statusByCode[phone.code]||['neutral','? 未返回状态'];
  const wordView=words.length?`<h4>逐词反馈</h4><div class="speech-chips">${words.map(w=>chip(w.text,wordStatus(w))).join('')}</div>`:'';
  const phoneView=phones.length?`<h4>音素反馈</h4><div class="speech-chips">${phones.map(p=>{
    const symbol=String(p.symbol||'');
    const ipa=phoneSymbols[symbol.toLowerCase()];
    return chip(ipa?`/${ipa}/`:symbol,phoneStatus(p));
  }).join('')}</div><p class="muted">绿色：正常读出 · 黄色：多读或重复 · 红色：漏读或替换 · 灰色：未返回状态。<br>颜色依据讯飞的增漏读标记，不代表逐音素得分；正常读出也可能存在发音偏差。</p>`:'';
  const hint=isShip?'<p><strong>ship /ʃɪp/</strong> 中间是短元音 /ɪ/。嘴巴放松、少张开，别读成更张口的 /æ/。</p>':'';
  const missing=hasDetails&&!phones.length?'<p class="muted">本次未返回逐音素状态，无法定位到某一个音。</p>':'';
  return `<p>${verdict}</p>${wordView}${phoneView}${missing}${hint}`;
}
function task(m,view,back){
  const title=sectionHeader(E(m.task?.title||m.label)+' · 练习',state.day);
  if(m.completed||!m.task){
    const correct=countCorrect(m.results);
    const testScore=m.results[0]?.scores?.total;
    const earned=m.earned??m.results.at(-1)?.earned;
    const percentage=coursePercentage(m.results,m.task?.questions.length||0);
    const passed=m.completed&&percentage>=90;
    const summary=m.task?.testOnly
      ? Number.isFinite(testScore)?`<p>讯飞朗读评分 <strong>${E(testScore)} / 100</strong></p>${pronunciationFeedback(m.results[0].scores,m.task.questions[0].prompt)}`:'<p>已完成跟读，本次没有评测分数。</p>'
      : `<p>本轮 ${Math.round(percentage*10)/10} 分，答对 ${correct} / ${m.task?scored(m.task).length:0} 题。${passed?(m.results.at(-1)?.newFloor?'首次达标，楼层 +1。':'已完成，本次为复练。'):'达到 90 分才能显示已完成并建楼。'}${earned?'本次获得一次抽卡机会。':'首次完成课次且达到 90 分可获抽卡机会，每天最多 4 次。'}</p>`;
    view.innerHTML=title+`<section class="panel"><h2>${m.completed?(passed?'已完成':'本轮结束 · 请再练习'):'老师还没有发布今日练习'}</h2>
      ${m.completed?summary:''}
      <div class="action-row"><a class="secondary" href="${back}">返回课程复习</a>
      ${m.completed?`${m.task.testOnly?'':'<a class="primary" href="#tower">回摩天楼看施工</a>'}<button class="secondary" id="retry-practice">重新练习</button>${earned?'<a class="primary" href="#collection">去抽卡</a>':''}`:''}</div></section>`;
    if(m.completed)$('retry-practice').onclick=async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{await api('retry-practice',{module:m.key});await refresh();}
      catch(error){notice(error.message);button.disabled=false;}
    };
    return;
  }
  const index=m.results.length;
  const rewardNote=m.task.testOnly?'':'每个课次首次整套达到 90 分可建一层。'+(coursePassed(readProgress(),m.task)?'本课已完成，可继续复练。':'首次完成达标可获抽卡机会，每天最多 4 次。');
  const question=m.task.questions[index];
  if(!question){$('view').textContent='任务进度已更新，请刷新。';return;}
  const shipSample=question.prompt.trim().toLowerCase()==='ship';
  const providedSample=question.audio&&validReadAudio(question.audio)?question.audio:'';
  const reading=question.kind==='read', checking=question.kind==='check', total=m.task.questions.length;
  view.innerHTML=`<div class="question-wrap">${title}<section class="panel">${rewardNote?'<p class="muted">'+rewardNote+'</p>':''}<p><a href="${back}">返回课次复习资料</a></p>
    <p class="eyebrow" style="margin-top:15px">第 ${index+1} / ${total} 题 · ${question.bonus?'王者冲刺 · ':''}${reading?'朗读题':checking?'作答后对照':providedSample?'听音选择题':'选择题'}</p>
    <div class="steps" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${index}"><i style="width:${index/total*100}%"></i></div>
    <form id="answer-form"><fieldset><legend>${E(question.prompt)}</legend>
    ${reading?`<div id="read-box"><p class="muted">${state.speechReady?'提交后由讯飞评测，90 分及以上算对；不足 90 分可重录或跳过。':'当前可本机录音回听。评分服务接通后，90 分及以上算对，也可跳过本题。'}</p>
      <div class="action-row"><button class="secondary" type="button" id="listen" ${!shipSample&&!providedSample&&typeof speechSynthesis==='undefined'?'hidden':''}>听范读</button>
      <button type="button" class="secondary" data-record>开始录音</button><button type="button" class="secondary" data-stop disabled>停止录音</button></div>
      <p class="grade" data-record-status role="status"></p><audio class="media" controls hidden></audio>
      ${shipSample?'<small>范读来源：<a href="https://commons.wikimedia.org/wiki/File:En-us-ship.ogg" target="_blank" rel="noopener">Dvortygirl / Wikimedia Commons</a></small>':''}</div>`:
      checking?'<label>你的答案<input name="response" maxlength="2000" required autocomplete="off" placeholder="输入后按回车"></label>':(providedSample?'<div class="question-listening"><button type="button" class="secondary" id="play-question-audio">▶ 播放题目音频</button><p id="question-audio-status" role="status"></p></div>':'')+question.choices.map((x,i)=>`<label class="choice"><input type="radio" required name="choice" value="${i}">${E(x)}</label>`).join('')}
    </fieldset><div id="feedback" role="status"></div>
    <button id="submit-answer" type="submit" class="primary" style="margin-top:12px" ${reading?'disabled':'hidden'}>${reading?(state.speechReady?'提交评测':'请在正式网页进行评测'):''}</button>
    ${reading?'<button type="button" class="secondary" id="skip-reading">跳过本题</button>':''}
    <button id="next-question" type="button" class="primary" hidden></button></form></section></div>`;
  if(!reading&&providedSample){
    const host=$('answer-form');
    const audio=new Audio(providedSample);
    audio.preload='none';
    let sampleUrl,loading=false;
    const previous=releaseReviewImage;
    releaseReviewImage=()=>{audio.pause();if(sampleUrl)URL.revokeObjectURL(sampleUrl);previous?.();};
    $('play-question-audio').onclick=async()=>{
      if(loading)return;
      loading=true;
      try{
        if(localCourseEditor()&&providedSample.startsWith('./course-media/')&&!sampleUrl){
          const blob=await readCourseMedia(providedSample);
          if(!host.isConnected)return;
          if(blob)audio.src=sampleUrl=URL.createObjectURL(blob);
        }
        audio.currentTime=0;
        await audio.play();
        if(host.isConnected)$('question-audio-status').textContent='';
      }catch{if(host.isConnected)$('question-audio-status').textContent='音频暂时无法播放，请检查课件媒体文件。';}
      finally{loading=false;}
    };
  }
  if(reading){
    const host=$('read-box');
    recorder=attachRecorder(host);
    host.addEventListener('recorded',()=>{$('submit-answer').disabled=!state.speechReady;});
    host.addEventListener('recording',()=>$('submit-answer').disabled=state.speechReady);
    let sample=providedSample?new Audio(providedSample):shipSample?new Audio('https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a9/En-us-ship.ogg/En-us-ship.ogg.mp3'):null;
    function browserVoice(){
      if(typeof speechSynthesis==='undefined'){notice('没有可用的范读，请点下方音频来源播放。');return;}
      speechSynthesis.cancel();
      const line=new SpeechSynthesisUtterance(question.prompt);
      line.lang='en-US';line.rate=.83;
      const voices=speechSynthesis.getVoices();
      line.voice=voices.find(v=>v.localService&&v.lang==='en-US')||voices.find(v=>v.lang==='en-US')||null;
      line.onerror=event=>{
        if(!['canceled','interrupted'].includes(event.error)&&host.isConnected)notice('英语语音播放失败，请检查浏览器的语音与音量设置。');
      };
      speechSynthesis.speak(line);
    }
    let sampleUrl;
    const disposeSample=()=>{sample?.pause();if(sampleUrl)URL.revokeObjectURL(sampleUrl);};
    const disposeReview=releaseReviewImage;
    releaseReviewImage=()=>{disposeSample();disposeReview?.();};
    $('listen').onclick=async()=>{
      if(localCourseEditor()&&providedSample.startsWith('./course-media/')&&!sampleUrl){
        try{
          const blob=await readCourseMedia(providedSample);
          if(!host.isConnected)return;
          if(blob){sampleUrl=URL.createObjectURL(blob);sample.src=sampleUrl;}
        }catch{notice('无法读取本地范读音频。');return;}
      }
      if(!sample){browserVoice();return;}
      sample.currentTime=0;
      sample.play().catch(()=>{if(host.isConnected)notice('指定范读无法播放，请检查音频链接或文件。');});
    };
    if(sample)host.querySelector('[data-record]').addEventListener('click',()=>{sample.pause();if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();});
  }
  const screen=$('answer-form');
  if(!checking&&!reading)screen.onchange=()=>screen.requestSubmit();
  if(checking)screen.elements.response.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.isComposing){event.preventDefault();screen.requestSubmit();}
  });
  let skipReading=false;
  if(reading)$('skip-reading').onclick=()=>{
    if($('submit-answer').dataset.busy==='1')return;
    skipReading=true;screen.requestSubmit();
  };
  screen.onsubmit=async event=>{
    event.preventDefault();
    const submit=$('submit-answer');
    if(submit.dataset.busy==='1')return;
    submit.dataset.busy='1';
    const payload={day:state.day,module:m.key,index,version:m.task.version};
    const activeRecorder=recorder;
    let pendingTimer;
    const recordingControls=reading?[...screen.querySelectorAll('[data-record], [data-stop], #listen')].map(button=>[button,button.disabled]):[];
    const originalLabel=submit.textContent;
    submit.disabled=true;
    if(reading)$('skip-reading').disabled=true;
    notice();
    try{
      if(reading){
        if(skipReading)payload.skip=true;
        else if(state.speechReady){
          payload.audio=activeRecorder.audio();
          if(!payload.audio)throw new Error('请先完成录音，并确认回听有声音。');
        }else throw Error('评测暂不可用，可以选择跳过本题。');
      }else if(checking)payload.response=new FormData(screen).get('response');
      else payload.choice=Number(new FormData(screen).get('choice'));
      if(reading&&!skipReading){
        submit.textContent='正在评测…';
        for(const [button] of recordingControls)button.disabled=true;
        let elapsed=0;
        const showPending=()=>{
          if(!screen.isConnected)return;
          $('feedback').innerHTML=`<p class="feedback" role="status">正在提交 ${(atob(payload.audio).length/32000).toFixed(1)} 秒录音并等待讯飞评分… ${elapsed} 秒${elapsed>=10?'。连接较慢，最迟 45 秒会显示结果或超时提示。':''}</p>`;
        };
        showPending();
        pendingTimer=setInterval(()=>{elapsed++;showPending();},1000);
      }
      const {result,completed,correctCount,earned,retry}=await api('question',payload);
      clearInterval(pendingTimer);
      if(!screen.isConnected)return;
      if(retry){
        $('feedback').innerHTML=`<div class="feedback wrong"><strong>本次 ${E(result.scores.total)} 分，达到 90 分才算对，请再读一次。</strong>${pronunciationFeedback(result.scores,question.prompt)}</div>`;
        submit.dataset.busy='0';submit.disabled=false;
        submit.textContent='重新提交评测';
        for(const [button,wasDisabled] of recordingControls)button.disabled=wasDisabled;
        $('skip-reading').disabled=false;
        return;
      }
      if(completed){
        m.completed=true;
        m.earned=earned;
      }
      m.results[index]=result;
      screen.querySelectorAll('input, textarea, [data-record], [data-stop]').forEach(el=>el.disabled=true);
      const scores=result.scores;
      const scoreLabels={accuracy:'准确度',fluency:'流畅度',integrity:'完整度'};
      const details=scores?Object.entries(scoreLabels).filter(([key])=>scores[key]!==undefined).map(([key,label])=>label+' '+scores[key]).join(' · '):'';
      $('feedback').innerHTML=`<div class="feedback ${result.correct===false?'wrong':''}">
        <strong>${reading?(result.skipped?'已跳过 · 本题未计正确':scores?'✓ 朗读达标 '+E(scores.total)+' / 100':'本题未计正确'):checking?(result.matches?'✓ 与参考答案一致':'请对照参考答案'):result.correct?'✓ 答对了':'还差一点'}</strong>
        ${!reading?`<p>${checking?'参考答案':'正确答案'}：${E(checking?result.reference:question.choices[result.answer])}</p>`:''}
        ${details?`<p>${E(details)}</p>`:''}${reading?pronunciationFeedback(scores,question.prompt):''}
        <p>${E(result.explanation)}</p>${completed&&!m.task.testOnly?`<strong>本轮答对 ${correctCount??countCorrect(m.results)} 道</strong>`:''}</div>`;
      submit.hidden=true;
      const next=$('next-question');
      next.hidden=false;
      next.textContent=completed?'查看完成记录':'下一题';
      next.onclick=()=>{cleanupRecorder();task(m,view,back);};
      next.focus();
    }catch(error){
      if(!screen.isConnected)return;
      notice(error.message);
      $('feedback').innerHTML=`<div class="feedback wrong"><strong>${E(error.message)}</strong>${reading?'<p>录音已保留，可以重新提交或跳过本题。</p>':''}</div>`;
      submit.dataset.busy='0';submit.disabled=reading&&!state.speechReady;
      submit.textContent=originalLabel;
      for(const [button,wasDisabled] of recordingControls)button.disabled=wasDisabled;
      if(reading){skipReading=false;$('skip-reading').disabled=false;}
    }finally{clearInterval(pendingTimer);}
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
    <p class="muted">可抽 ${data.available} 次，今日还可抽 ${data.remaining} 次。首次完成课次达 90 分、复习 5 个到期词可获抽卡机会，每日最多 4 次。</p>
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
  releaseReviewImage?.();
  releaseReviewImage=null;
  stopWordRecording();
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
  const tower=cityTower;
  const pages={tower,review,collection,words:wordCanvas,wordbook,backup};
  (Object.hasOwn(pages,page)?pages[page]:tower)(key,id,mode);
}
async function refresh(){
  state=await api('state');
  render();
}
window.addEventListener('hashchange',()=>{notice();refresh().catch(e=>notice(e.message));});
document.addEventListener('DOMContentLoaded',()=>refresh().catch(e=>notice(e.message)));
