/* A4 wordbook: local, per-student, resumable. */
wordbook=async function(){
  $('view').innerHTML=sectionHeader('我的生词本')+'<section class="panel a4-book" id="a4-host">正在读取…</section>';
  const host=$('a4-host'),profile=progressKey();let data,dict,model,timer,positions=[],busy=false;
  const active=()=>host.isConnected&&profile===progressKey();
  const refresh=async()=>{model=await api('a4',{action:'read'});[data,dict]=await Promise.all([api('words'),lexicon()]);};
  async function act(action,extra={}){if(!active())return false;model=await api('a4',{action,id:model.session?.id,...extra});return active();}
  const speakButton=w=>recordedWords.has(w)?`<button class="plain wordbook-speak" type="button" data-say="${E(w)}" aria-label="播放 ${E(w)} 的真人发音"><img src="./word-assets/speaker-icon.svg" alt=""></button>`:'';
  function wireSpeak(){host.querySelectorAll('[data-say]').forEach(b=>b.onclick=()=>pronounce(b.dataset.say));}
  async function run(fn){if(busy||!active())return;busy=true;try{await fn();}catch(e){notice(e.message);}finally{busy=false;}}
  function home(){
    if(!active())return;clearTimeout(timer);stopWordRecording();
    const s=model.session,resume=s&&s.phase!=='done',list=model.candidates,limit=model.groupsToday>=3,mastered=data.words.filter(w=>w.mastered).length,known=data.words.filter(w=>w.selfKnown).length;
    const label=resume?(s.phase==='test'?`继续检测 · ${s.cursor+1}/${s.tasks.length} 题`:`继续A4复习 · ${s.k}/${(s.learnBatch||s.batch).length} 词`):limit?'今日3组已用完':list.length?'先复习 '+Math.min(10,list.length)+' 词':'当前没有待复习单词';
    host.innerHTML=`<section class="wordbook-today"><div><p class="eyebrow">A4 散落复习 · Beta</p><h2>${list.length}<small> 词待复习</small></h2><p>今日学习 ${model.groupsToday}/3 组 · 每组最多10词 · 每词停留2秒</p><div class="action-row"><button class="primary" id="a4-start" ${!resume&&(limit||!list.length)?'disabled':''}>${label}</button><button class="secondary" id="import-parent-words">批量导入单词</button><a class="secondary" href="#words">从1000词添加</a>${s?.phase==='done'?'<button class="secondary" id="a4-last">查看上组结果</button>':''}</div>${resume?'<p class="muted">现有进度已保存；继续当前组不额外占用组数。</p>':''}</div><div><h3>今日成功复习 ${Math.min(data.reviewed,5)}/5</h3><progress max="5" value="${Math.min(data.reviewed,5)}"></progress><p>成功复习5个不同词，可建造一层。</p><p>今日手动标记已会 ${model.masteredToday}/2 词</p><p>系统已掌握 ${mastered} 词 · 已会 ${known} 词 · 已收录 ${data.words.length} 词</p></div></section>
    <div class="row"><button class="secondary" data-filter="due">待复习</button><button class="secondary" data-filter="all">全部单词</button><button class="secondary" data-filter="mastered">已掌握 ${mastered}</button><button class="secondary" data-filter="known">已会 ${known}</button><input id="a4-search" type="search" placeholder="搜索单词或中文"></div><div class="wordbook-table-wrap"><table class="wordbook-table"><thead><tr><th>单词</th><th>释义</th><th>发音</th><th>状态</th><th>下次复习</th><th class="a4-known-head">已会</th></tr></thead><tbody id="a4-rows"></tbody></table></div><details><summary>复习与掌握规则</summary><p>每天最多3组，每组最多10词，到期旧词优先。新词先A4学习，旧词直接检测；旧词未通过才回A4巩固，再做简短巩固。每组先听音选英文，再看英文选中文，最后抽最多5词拼写；优先轮换少测和易错的词。没抽到拼写的词只计本次认读完成，不累计全部题型达标。</p><p>初学当天不计长期掌握；之后在3个不同日期直接检测达标，且最后一次距初学至少7天，才自动进入系统已掌握。当天先看A4答案的练习不计长期达标。</p><p>手动“已会，减少复习”每天最多2词，不等于系统已掌握。已掌握词14天后抽查；失误转待巩固、缩短间隔，保留历史。缺录音标记听音待检测，补音频后只补听音，保留原词义和拼写进度。</p><p>退出、刷新、重新打开同一浏览器均可继续原进度，不重复扣组数。</p></details>`;
    let filter='due';function rows(){
      const q=$('a4-search').value.trim().toLowerCase();
      const list=data.words.filter(w=>(filter==='all'||(filter==='mastered'?w.mastered:filter==='known'?w.selfKnown:w.due<=data.day||(w.audioPending&&recordedWords.has(w.word))))&&(!q||w.word.includes(q)||(dict[w.word]||'').includes(q)));
      $('a4-rows').innerHTML=list.map(w=>{
        const marked=w.mastered||w.selfKnown,can=model.qualified[w.word]===model.day&&model.masteredToday<2;
        const status=w.mastered?(w.audioPending?'已掌握 · 待听音':'已掌握'):w.needsConsolidation?'待巩固':w.selfKnown?'已会':w.due<=data.day?'待复习':'学习中';
        const title=marked?'移回待复习':can?'标记已会，减少复习':model.masteredToday>=2?'今天的2个手动名额已用完':'完成本词拼写等检测后可标记';
        return '<tr><th>'+E(w.word)+'</th><td>'+E(dict[w.word]||'')+'</td><td>'+(speakButton(w.word)||'<span class="muted">待补录</span>')+'</td><td><span class="a4-status '+(w.mastered?'mastered':w.needsConsolidation?'needs':'')+'">'+E(status)+'</span></td><td>'+(w.due<=data.day?'今天':E(w.due))+'</td><td class="a4-known-cell"><button class="a4-known-toggle" data-master="'+E(w.word)+'" aria-pressed="'+!!marked+'" title="'+E(title)+'" aria-label="'+E(w.word+'：'+title)+'" '+(!marked&&!can?'disabled':'')+'>'+(marked?'✓':'＋')+'</button></td></tr>';
      }).join('')||'<tr><td colspan="6">暂无符合条件的单词。</td></tr>';
      wireSpeak();host.querySelectorAll('[data-master]').forEach(b=>b.onclick=()=>run(async()=>{const row=data.words.find(w=>w.word===b.dataset.master);await api('word-mastery',{word:row.word,mastered:!(row.mastered||row.selfKnown)});await refresh();if(active())home();}));
    }
    host.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;host.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));rows();});$('a4-search').oninput=rows;$('import-parent-words').onclick=parentWordImport;
    $('a4-start').onclick=()=>run(async()=>{if(!resume){if(!await act('start'))return;positions=[];}resumeScreen();});if($('a4-last'))$('a4-last').onclick=finish;rows();
  }
  function resumeScreen(){if(!active())return;stopWordRecording();if(model.session.phase==='learn')learn();else if(model.session.phase==='test')test();else finish();}
  function shell(title){clearTimeout(timer);host.innerHTML=`<header class="a4-session-header"><button class="a4-back-button" id="a4-back">返回生词本</button><span class="a4-session-caption">${title}</span><span class="a4-saved">进度已保存</span></header><div id="a4-body"></div>`;$('a4-back').onclick=()=>run(async()=>{clearTimeout(timer);stopWordRecording();await refresh();if(active())home();});return $('a4-body');}
  function learn(){
    if(!active())return;const s=model.session,learning=s.learnBatch||s.batch,w=learning[s.p],isNew=s.p===s.k-1,b=shell(`累积回想 · 已加入 ${s.k}/${(s.learnBatch||s.batch).length} 词`);
    b.innerHTML=`<p>新词先看意思；回看时先自己想，想不起来再看中文。</p><div class="a4-paper" id="a4-paper"></div><p class="a4-meaning" id="a4-meaning">${isNew?E(w.meaning):'先想一想这个词的意思'}</p>${isNew&&typeof wordExampleMarkup==='function'&&wordExampleMarkup(w.word)?`<details class="a4-example"><summary>查看例句</summary>${wordExampleMarkup(w.word)}</details>`:''}<div class="action-row">${speakButton(w.word)}<button class="secondary" id="a4-hint">看中文 / 没想起来</button><button class="primary" id="a4-next" disabled>再想想… 2</button></div><p id="a4-audio-note" class="muted">${recordedWords.has(w.word)?'':'此词真人录音待补，检测时不出听音题。'}</p>`;
    const paper=$('a4-paper');learning.slice(0,s.k).forEach((r,i)=>{const el=document.createElement('span');el.className='a4-word'+(i===s.p?' current':'');el.textContent=r.word;paper.append(el);if(!positions[i]){const width=el.offsetWidth,height=el.offsetHeight;let pos;for(let n=0;n<500;n++){const x=12+Math.random()*Math.max(1,paper.clientWidth-width-24),y=12+Math.random()*Math.max(1,paper.clientHeight-height-24);if(positions.every(p=>x+width+14<p.x||x>p.x+p.w+14||y+height+14<p.y||y>p.y+p.h+14)){pos={x,y,w:width,h:height};break;}}if(!pos){const y=paper.clientHeight;paper.style.height=y+70+'px';pos={x:12,y,w:width,h:height};}positions[i]=pos;}const p=positions[i];el.style.left=p.x+'px';el.style.top=p.y+'px';paper.style.minHeight=Math.max(380,...positions.map(p=>p.y+p.h+14))+'px';});
    wireSpeak();$('a4-hint').disabled=isNew;$('a4-hint').onclick=()=>run(async()=>{if(await act('hint'))$('a4-meaning').textContent=w.meaning;});
    // Playback is attempted only at the first appearance, never on cumulative recalls.
    if(isNew&&!s.heard.includes(w.word)){
      if(recordedWords.has(w.word)){
        stopWordRecording();const audio=new Audio(wordAudioSource(w.word));wordRecording=audio;
        act('heard',{word:w.word}).catch(e=>notice(e.message));
        audio.play().catch(()=>{if(active()&&$('a4-audio-note'))$('a4-audio-note').textContent='浏览器未允许自动播放，请点原发音图标。';});
      }else act('heard',{word:w.word}).catch(e=>notice(e.message));
    }
    const next=$('a4-next');timer=setTimeout(()=>{if(!next.isConnected||!active())return;next.textContent='再想想… 1';timer=setTimeout(()=>{if(next.isConnected&&active()){next.disabled=false;next.textContent=s.k===learning.length&&s.p===0?(learning.every(r=>r.remedial)?'完成巩固':'进入检测'):'继续';}},1000);},1000);
    next.onclick=()=>run(async()=>{next.disabled=true;stopWordRecording();if(await act('learn-next'))resumeScreen();});
  }
  function test(){
    if(!active())return;const s=model.session,q=s.tasks[s.cursor];if(!q){finish();return;}
    const row=s.batch.find(w=>w.word===q.word),modern=s.format===5;
    const titles={meaning:q.direction==='en-zh'?'选出中文意思':'选出英文单词',spelling:'写出英文单词',listening:'听音，选出单词'};
    const kinds=modern?['listening','meaning','spelling']:['spelling','meaning','listening'];
    const b=shell((q.mode==='cold'?'旧词复习':q.mode==='practice'?'巩固练习':q.mode==='audio'?'补听音':'新词检测')+' · '+(s.cursor+1)+' / '+s.tasks.length);
    const stepNames={listening:'听音',meaning:'词义',spelling:'拼写'};
    const steps=kinds.map(k=>'<span class="'+(k===q.kind?'current':'')+'">'+stepNames[k]+'</span>').join('');
    const prompt=q.kind==='listening'?'<div class="a4-listen">'+speakButton(q.word)+'<span>点击播放，仔细听一听</span></div>':'<p class="a4-prompt '+(q.direction==='en-zh'&&q.kind==='meaning'?'english':'')+'">'+E(q.kind==='meaning'&&q.direction==='en-zh'?q.word:row.meaning)+'</p>';
    const choices=q.options.map((w,i)=>'<button type="button" class="a4-option" data-option="'+i+'"><span class="a4-option-letter">'+String.fromCharCode(65+i)+'</span><span>'+E(w)+'</span><span class="a4-option-result" aria-hidden="true"></span></button>').join('');
    b.innerHTML='<section class="a4-test-card"><div class="a4-test-top"><div class="a4-steps" aria-label="检测流程">'+steps+'</div><span class="a4-question-count">'+(s.cursor+1)+' / '+s.tasks.length+'</span></div><progress class="a4-test-progress" max="'+s.tasks.length+'" value="'+s.cursor+'" aria-label="本组检测进度"></progress><div class="a4-question"><p class="a4-instruction">'+titles[q.kind]+'</p>'+prompt+'</div><form id="a4-form">'+(q.kind==='spelling'?'<label class="a4-spelling-label" for="a4-spelling">英文单词</label><input id="a4-spelling" class="a4-spelling-input" placeholder="在这里输入英文" autocomplete="off" autocapitalize="none" spellcheck="false" required><div class="a4-answer-actions"><button class="primary" type="submit">确认拼写</button><button class="a4-skip" type="button" id="a4-skip">暂时想不起来</button></div>':'<div class="a4-options">'+choices+'</div><div class="a4-answer-actions"><span class="a4-choice-note">点击选项，即可查看答案</span><button class="a4-skip" type="button" id="a4-skip">我还不会</button></div>')+'</form><div id="a4-feedback" aria-live="polite"></div></section>';
    wireSpeak();if(q.kind==='listening')host.querySelector('[data-say]')?.setAttribute('aria-label','播放本题单词的真人发音');
    const form=$('a4-form');
    function feedback(){
      form.querySelectorAll('input,button').forEach(x=>x.disabled=true);const r=s.feedback,expected=q.answer||q.word;
      host.querySelectorAll('[data-option]').forEach(btn=>{const value=q.options[Number(btn.dataset.option)],right=value===expected,wrong=!r.correct&&r.answer===value;btn.classList.toggle('is-right',right);btn.classList.toggle('is-wrong',wrong);btn.querySelector('.a4-option-result').textContent=right?'✓':wrong?'×':'';});
      if(q.kind==='spelling'){$('a4-spelling').value=r.answer||'';$('a4-spelling').classList.add(r.correct?'is-right':'is-wrong');}
      const o=s.outcomes[q.word];
      $('a4-feedback').innerHTML='<div class="a4-result '+(r.correct?'correct':'incorrect')+'"><span class="a4-result-mark">'+(r.correct?'✓':'!')+'</span><div><strong>'+(r.correct?'答对了':'再记一次')+'</strong><p><span class="a4-result-word">'+E(q.word)+'</span><span>'+E(row.meaning)+'</span></p>'+(o?.autoMastered?'<small>这个词已达到系统掌握标准</small>':'')+'</div></div><div class="a4-next-row"><button class="primary" id="a4-continue">'+(s.cursor===s.tasks.length-1?(s.segment==='cold'&&(s.learnBatch||[]).length?'继续巩固':'查看结果'):'下一题')+'</button></div>';
      $('a4-continue').onclick=()=>run(async()=>{if(await act('continue'))resumeScreen();});$('a4-continue').focus();
    }
    if(s.feedback){feedback();return;}
    async function submit(skip,choice){const answer=q.kind==='spelling'?$('a4-spelling').value:choice;if(!skip&&!String(answer||'').trim())return;form.querySelectorAll('input,button').forEach(x=>x.disabled=true);try{if(await act('answer',{task:q.id,answer:answer||'',skip}))test();}catch(e){form.querySelectorAll('input,button').forEach(x=>x.disabled=false);throw e;}}
    form.onsubmit=e=>{e.preventDefault();if(q.kind==='spelling')run(()=>submit(false));};
    host.querySelectorAll('[data-option]').forEach(btn=>btn.onclick=()=>run(()=>submit(false,q.options[Number(btn.dataset.option)])));
    $('a4-skip').onclick=()=>run(()=>submit(true));if(q.kind==='spelling')$('a4-spelling').focus();
  }
  async function finish(){
    await refresh();if(!active())return;const s=model.session,list=model.candidates,limit=model.groupsToday>=3,b=shell('本组复习完成');
    const pass=s.batch.filter(w=>s.results.filter(r=>r.word===w.word&&r.mode!=='practice').every(r=>r.correct)&&!s.outcomes[w.word]?.changed),missing=s.batch.filter(w=>!recordedWords.has(w.word));
    b.innerHTML=`<h2>本组完成 · ${pass.length}/${s.batch.length} 词通过</h2><p>答对 ${s.results.filter(r=>r.correct).length}/${s.tasks.length} 题 · 今日学习 ${model.groupsToday}/3 组 · 今日手动标记已会 ${model.masteredToday}/2 词</p>${missing.length?`<p class="muted">${missing.map(w=>E(w.word)).join('、')} 暂无真人录音，听音待补；拼写按本组抽词安排。</p>`:''}<p>${limit?'今日已达到3组上限，明天再来。':list.length?'今天还可继续复习 '+Math.min(10,list.length)+' 词。':'今天的可用单词已复习完。'}</p><div class="action-row">${!limit&&list.length?`<button class="primary" id="a4-more">再复习 ${Math.min(10,list.length)} 词</button>`:''}<button class="secondary" id="a4-home">返回生词本</button></div><h3>本组单词</h3><div id="a4-results">${s.batch.map(w=>{const passed=pass.some(r=>r.word===w.word),row=data.words.find(r=>r.word===w.word),marked=row?.mastered||row?.selfKnown,can=passed&&model.qualified[w.word]===model.day&&model.masteredToday<2;return '<p><strong>'+E(w.word)+'</strong> · '+E(w.meaning)+' · '+(passed?'检测通过':'待巩固')+' · '+E(a4WordStatus(row||{}))+(passed&&!marked?'<button class="secondary" data-done="'+E(w.word)+'" '+(!can?'disabled':'')+'>'+(can?'已会，减少复习':'今日手动名额不可用')+'</button>':'')+'</p>';}).join('')}</div>`;
    $('a4-home').onclick=home;if($('a4-more'))$('a4-more').onclick=()=>run(async()=>{if(await act('start')){positions=[];resumeScreen();}});host.querySelectorAll('[data-done]').forEach(btn=>btn.onclick=()=>run(async()=>{await api('word-mastery',{word:btn.dataset.done,mastered:true});await finish();}));
  }
  try{await refresh();home();}catch(e){if(active())host.textContent=e.message;}
};
