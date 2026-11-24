const lexicalDetails=async()=>WORD_DATA[1];
const lexicon=async()=>WORD_DATA[0];

let wordRecording;
function stopWordRecording(){
  wordRecording?.pause();
  wordRecording=null;
}
function pronounce(word){
  stopWordRecording();
  if(!recordedWords.has(word))return;
  const audio=new Audio('./word-audio/'+encodeURIComponent(word)+'.ogg');
  wordRecording=audio;
  audio.play().catch(()=>{
    if(wordRecording===audio)notice('录音暂时无法播放，请再试一次。');
  });
}
function rankSummary(rank){
  rank=rank||{medals:[0,0,0,0,0,0,0],stars:0,attempts:0,best:0,streak:0};
  const medals=['青铜','白银','黄金','铂金','钻石','星耀','王者'];
  return `<div class="rank-medals">${medals.map((m,i)=>`<span>${m} <strong>${rank.medals[i]||0}</strong></span>`).reverse().join('')}</div>
  <p>${rank.rank?`总榜第 <strong>${rank.rank}</strong> 名 · `: ''} ${rank.stars} 星 · ${rank.attempts} 次挑战</p>
  <p class="muted">平均正确率 ${Math.round(rank.best*1000)/10}% · 最高连胜 ${rank.streak}</p>`;
}

async function wordCanvas(){
  const view=$('view');
  view.innerHTML=`<section id="word-page" class="blueprint-page">
    <header class="blueprint-header"><div><p class="eyebrow" id="word-date"></p><h1>我的1000词</h1></div>
      <div class="blueprint-stats"><img class="blueprint-stat-icon" src="./word-assets/blocks-icon.svg" alt=""><div>累计点亮 <b id="word-total">—</b><div class="blueprint-progress"><i id="word-progress"></i></div></div><div class="blueprint-daily"><img src="./word-assets/helmet-icon.svg" alt=""><span>今日点亮 <b id="word-added">— / 5</b></span></div><div class="blueprint-daily"><img src="./word-assets/clipboard-icon.svg" alt=""><span>今日复习 <b id="word-reviewed">— / 5</b></span></div></div>
      <div class="action-row"><button class="primary" id="random-words" disabled>▶ 开始今日学习</button><a class="secondary" href="#wordbook">▤ 我的生词本</a></div>
    </header>
    <div class="blueprint-tools"><h2>单词施工蓝图</h2><label class="blueprint-search"><span class="sr-only">搜索单词或中文释义</span><input id="find-word" type="search" placeholder="搜索单词或中文，定位到词图" autocomplete="off"></label><div class="blueprint-filters" aria-label="学习状态筛选">${[['all','全部'],['new','未学习'],['due','待复习'],['mastered','已掌握']].map(([v,t])=>`<button class="secondary" data-word-filter="${v}" aria-pressed="${v==='all'}">${t}</button>`).join('')}</div></div>
    <div class="blueprint-layout"><div class="blueprint-main"><div class="blueprint-site" id="blueprint-site">
      <div class="blueprint-ruler">词汇大厦 · <span id="blueprint-count">1000</span>词施工图</div>
      <div class="blueprint-crane" aria-hidden="true"></div><div class="blueprint-crane-arm" aria-hidden="true"></div><div class="blueprint-scaffold" aria-hidden="true"></div>
      <div class="word-viewport" id="word-viewport" tabindex="0" aria-label="单词施工蓝图，点击结构区放大展开单词。"><div id="word-plane" class="word-plane"></div></div>
      <section id="word-zone-deck" class="word-zone-deck" aria-label="结构区单词" hidden></section>
      <div class="blueprint-ground" aria-hidden="true"></div>
    </div><div class="blueprint-bottom"><div id="word-legend" class="blueprint-legend"></div><div class="blueprint-view-controls"><button class="secondary" id="reset-words">全览</button><button class="secondary" id="word-fullscreen">全屏</button></div></div></div>
    <aside id="word-inspector" class="word-inspector" aria-label="单词详情"><p>正在读取词表…</p></aside></div>
    <p id="word-status" class="blueprint-status" role="status"></p>
    <footer class="word-material-yard"><div class="yard-sign">词汇墙 · 我的词汇建材库<small>每一个点亮的单词，都是城市的基石</small></div><img class="yard-forklift" src="./word-assets/new-forklift.svg" alt="搬运车"><div class="yard-pallet mastered"><span>▦ 已掌握</span><b id="yard-mastered">0 块</b></div><div class="yard-pallet due"><span>▦ 待复习</span><b id="yard-due">0 块</b></div><div class="yard-pallet new"><span>▦ 未学习</span><b id="yard-new">0 块</b></div><img class="yard-pipes" src="./word-assets/new-pipes.svg" alt="混凝土管"></footer>
    <p class="blueprint-credit"><a href="./word-audio/credits.html" target="_blank" rel="noopener">真人发音来源与授权</a> · 已掌握表示已复习且暂未到期</p>
  </section>`;
  const page=$('word-page'),frame=$('word-viewport'),plane=$('word-plane'),deck=$('word-zone-deck');
  const site=$('blueprint-site'),stage=document.createElement('div');stage.className='blueprint-stage';while(site.firstChild)stage.append(site.firstChild);site.append(stage);
  const exit=document.createElement('button');exit.className='secondary blueprint-exit';exit.textContent='退出全屏';exit.onclick=()=>document.fullscreenElement?document.exitFullscreen():page.classList.remove('blueprint-expanded');site.append(exit);
  try{
    const [words,initial,meta]=await Promise.all([lexicon(),api('words'),lexicalDetails()]);
    if(!page.isConnected)return;
    const entries=Object.entries(words), buttons=new Map(), positions=new Map();
    let current=initial,records=new Map(),filter='all',activeWord=null,activeZone=null,selected=null;
    let drag=null;
    const columns=10,pitchX=107,pitchY=247,width=columns*pitchX,height=2*pitchY;
    const zones=Array.from({length:Math.ceil(entries.length/50)},(_,z)=>entries.slice(z*50,z*50+50));
    function status(word){const r=records.get(word);return !r?'new':r.due<=current.day?'due':'mastered';}
    function matches(word){return filter==='all'||status(word)===filter;}
    const labels={new:'未学习',due:'待复习',mastered:'已掌握'};
    zones.forEach((zone,z)=>{
      const box=document.createElement('section');box.className='blueprint-zone';box.dataset.zoneIndex=z;box.style.left=z%columns*pitchX+'px';box.style.top=Math.floor(z/columns)*pitchY+'px';
      box.innerHTML=`<button class="blueprint-zone-label" aria-label="展开结构区${z+1}，第${z*50+1}至${Math.min((z+1)*50,entries.length)}词"><b>${String(z+1).padStart(2,'0')}栋</b><span>${z*50+1}–${Math.min((z+1)*50,entries.length)}</span></button><div class="blueprint-bricks"></div>`;
      box.querySelector('button').onclick=()=>openZone(z);const bricks=box.querySelector('.blueprint-bricks');
      zone.forEach(([word],i)=>{const b=document.createElement('button');b.type='button';b.className='word-brick';b.tabIndex=-1;b.title=word;b.setAttribute('aria-label',word);b.onclick=()=>{openZone(z);pick(word);};bricks.append(b);buttons.set(word,b);positions.set(word,z);});plane.append(box);
    });
    function openZone(z){
      activeZone=z;deck.hidden=false;plane.querySelectorAll('.blueprint-zone').forEach(el=>el.classList.toggle('zone-active',Number(el.dataset.zoneIndex)===z));
      deck.innerHTML=`<header><h3>▦ ${String(z+1).padStart(2,'0')}栋 <small>（${z*50+1}–${Math.min((z+1)*50,entries.length)}）</small></h3><button class="plain" id="close-word-zone" aria-label="收起结构区">✕</button></header><div class="zone-word-grid">${zones[z].filter(([w])=>matches(w)).map(([w])=>`<button class="zone-word ${status(w)}" data-zone-word="${E(w)}" ${activeWord===w?'aria-current="true"':''}>${E(w)}</button>`).join('')||'<p class="muted">该区没有此状态的单词。</p>'}</div>`;
      $('close-word-zone').onclick=()=>{deck.hidden=true;activeZone=null;plane.querySelectorAll('.zone-active').forEach(el=>el.classList.remove('zone-active'));};deck.querySelectorAll('[data-zone-word]').forEach(b=>b.onclick=()=>pick(b.dataset.zoneWord));
    }
    function update(data){
      current=data;records=new Map(data.words.map(r=>[r.word,r]));const counts={new:0,due:0,mastered:0};
      for(const [w,b]of buttons){const st=status(w);counts[st]++;b.className='word-brick '+st+(matches(w)?'':' filtered')+(w===activeWord?' selected':'');}
      $('word-total').textContent=`${data.words.length} / ${entries.length}`;$('blueprint-count').textContent=entries.length;
      $('word-progress').style.width=(data.words.length/entries.length*100)+'%';$('word-added').textContent=`${data.added} / 5`;$('word-reviewed').textContent=`${Math.min(data.reviewed,5)} / 5`;
      $('word-date').textContent=data.day+' · 词汇建设中';
      $('word-legend').innerHTML=['mastered','due','new'].map(st=>`<span><i class="${st}"></i>${labels[st]}（${counts[st]}）</span>`).join('');
      for(const st of Object.keys(counts))$('yard-'+st).textContent=counts[st]+' 块';
      const remaining=Math.max(0,5-data.added);$('random-words').disabled=!remaining||data.words.length>=entries.length;
      $('random-words').textContent=remaining?`▶ 按词频学习 ${Math.min(remaining,entries.length-data.words.length)} 词`:'今日点亮已完成';
      $('word-status').textContent=`实际词库 ${entries.length} 词 · 每区 50 词 · 点击结构区展开单词，或搜索定位。`;
      if(activeZone!==null)openZone(activeZone);if(activeWord)renderDetail(activeWord);
    }
    function pick(word){
      if(drag?.moved)return;activeWord=word;stopWordRecording();
      selected?.classList.remove('selected');selected=buttons.get(word);selected.classList.add('selected');renderDetail(word);
      deck.querySelectorAll('[data-zone-word]').forEach(b=>{if(b.dataset.zoneWord===word)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
    }
    function renderDetail(word){
      const detail=meta[word]||{},r=records.get(word),st=status(word),z=positions.get(word);
      $('word-inspector').innerHTML=`<h2><img class="word-heading-icon" src="./word-assets/crane-icon.svg" alt="">词块检测 <span class="word-state ${st}">${labels[st]}</span></h2><div class="inspector-word"><h3>${E(word)}</h3>${recordedWords.has(word)?`<button class="plain" id="play-word" aria-label="播放 ${E(word)} 的真人发音"><img class="word-speaker-icon" src="./word-assets/speaker-icon.svg" alt=""></button>`:''}</div><p class="inspector-ipa">${E(detail.ipa||'')}</p><p class="inspector-meaning">${detail.pos?`<span>${E(detail.pos)}</span> `:''}${E(words[word])}</p>${recordedWords.has(word)?'':'<p class="muted">真人录音待补</p>'}
        <section class="word-example" aria-label="例句，待导入"><h4>例句</h4><div class="word-example-empty"></div></section>
        <section class="word-construction-info"><h3><img class="word-heading-icon" src="./word-assets/construction-icon.svg" alt="">施工信息</h3><dl><div><dt>所属结构区</dt><dd>${String(z+1).padStart(2,'0')}（${z*50+1}–${Math.min((z+1)*50,entries.length)}）</dd></div><div><dt>施工状态</dt><dd><i class="status-square ${st}"></i>${labels[st]}</dd></div><div><dt>点亮日期</dt><dd>${r?E(r.added):'—'}</dd></div><div><dt>上次复习</dt><dd>${r?.reviewed?E(r.reviewed):'—'}</dd></div><div><dt>下次复习</dt><dd>${r?(r.due<=current.day?'今天待复习':E(r.due)):'点亮后安排'}</dd></div></dl></section>
        ${r?'<a class="primary inspector-action" href="#wordbook">✎ 去生词本复习</a>':'<button class="primary inspector-action" id="light-word">点亮 · 加入生词本</button>'}<p id="word-dialog-status" role="status"></p>`;
      if($('play-word'))$('play-word').onclick=()=>pronounce(word);
      if($('light-word'))$('light-word').onclick=async()=>{
        const btn=$('light-word');btn.disabled=true;
        try{const data=await api('words',{word});if(page.isConnected){update(data);$('word-dialog-status').textContent='已点亮并加入生词本。';}}
        catch(error){if(page.isConnected){$('word-dialog-status').textContent=error.message;btn.disabled=false;}}
      };
    }
    function fit(){const sceneScale=Math.min(site.clientWidth/1586,site.clientHeight/793);stage.style.transform=`translate(${(site.clientWidth-1586*sceneScale)/2}px,${(site.clientHeight-793*sceneScale)/2}px) scale(${sceneScale})`;const scale=Math.min(1200/width,600/height);plane.style.transform=`translate(${(1200-width*scale)/2}px,${(600-height*scale)/2}px) scale(${scale})`;}
    $('reset-words').onclick=()=>{deck.hidden=true;activeZone=null;plane.querySelectorAll('.zone-active').forEach(el=>el.classList.remove('zone-active'));};
    page.querySelectorAll('[data-word-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.wordFilter;page.querySelectorAll('[data-word-filter]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));update(current);});
    function locate(){
      const query=$('find-word').value.trim().toLowerCase();if(!query)return;
      const entry=entries.find(([w])=>w.toLowerCase()===query)||entries.find(([w,m])=>w.toLowerCase().startsWith(query)||m.includes(query));
      if(!entry){$('word-status').textContent='没有找到这个词，试试其他英文或中文。';return;}
      if(filter!=='all'){filter='all';page.querySelectorAll('[data-word-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wordFilter==='all')));update(current);}
      const z=positions.get(entry[0]);openZone(z);pick(entry[0]);
    }
    $('find-word').oninput=locate;$('find-word').onkeydown=e=>{if(e.key==='Enter')locate();};
    $('random-words').onclick=async()=>{
      $('random-words').disabled=true;
      try{const before=new Set(current.words.map(r=>r.word)),data=await api('words',{random:true});if(page.isConnected){update(data);const fresh=data.words.find(r=>!before.has(r.word));if(fresh){filter='all';page.querySelectorAll('[data-word-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wordFilter==='all')));update(data);openZone(positions.get(fresh.word));pick(fresh.word);$('word-status').textContent='已按词频点亮本组单词，可以前往生词本复习。';}}}
      catch(error){notice(error.message);if(page.isConnected)update(current);}
    };
    $('word-fullscreen').onclick=async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else if($('blueprint-site').requestFullscreen)await $('blueprint-site').requestFullscreen();else{page.classList.toggle('blueprint-expanded');fit();}}catch{page.classList.toggle('blueprint-expanded');fit();}
    };
    const observer=new ResizeObserver(()=>{if(page.isConnected)fit();else observer.disconnect();});observer.observe(site);
    update(initial);fit();pick(WORD_FREQUENCY.find(w=>Object.hasOwn(words,w))||entries[0][0]);
  }catch(error){if(page.isConnected)$('word-status').textContent=error.message;}
}

function shuffled(items){
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
}

async function wordbook(){
  $('view').innerHTML=sectionHeader('我的生词本')+'<section class="panel" id="wordbook-panel">正在读取…</section>';
  const host=$('wordbook-panel');
  try{
    const [data,words]=await Promise.all([api('words'),lexicon()]);
    if(!host.isConnected)return;
    const queue=data.words.filter(w=>w.due<=data.day).sort((a,b)=>Number(b.added===data.day)-Number(a.added===data.day)).slice(0,20);
    let index=0,correct=0;
    const variant=Math.floor(Math.random()*4);
    function home(){
      host.innerHTML=`<div class="row"><h2>今日待复习 ${data.due} 个</h2><a class="secondary" href="#words">去点亮单词</a></div>
          <p>已点亮 ${data.words.length} 个 · 今日新增 ${data.added}/5 · 今日复习 ${Math.min(data.reviewed,5)}/5 · ${data.climbed?'今日已登楼':'成功复习 5 词可建一层'}</p>
          <h3>艾宾浩斯复习计划</h3><div class="curve"><svg viewBox="0 0 540 105" role="img" aria-label="记忆随时间减弱，复习后回升示意"><path d="M5 20 Q20 70 74 76 L80 20 Q110 63 166 72 L172 20 Q215 53 260 67 L266 20 Q305 48 350 60 L356 20 Q404 46 440 54 L446 20 Q485 33 535 49" fill="none" stroke="currentColor" stroke-width="3"/></svg></div>
          <p class="muted">答对后逐步延长复习间隔（${data.intervals.join('、')} 天）。答错或选不认识的词会留在今天的复习列表。</p>
          <button class="primary" id="start-review" ${queue.length?'':'disabled'}>开始复习（本组 ${queue.length} 词）</button>
          <details><summary>查看生词及下次复习日期</summary><ul class="wordbook-list">${data.words.map(w=>`<li><b>${E(w.word)}</b>　${E(words[w.word])} <small>${E(w.due)}</small></li>`).join('')}</ul></details>`;
      $('start-review').onclick=question;
    }
    function question(){
      if(index>=queue.length){
        host.innerHTML=`<h2>本组复习完成</h2><p>已复习 ${queue.length} 词，答对或认识 ${correct} 词。</p><div class="action-row"><button class="primary" id="review-back">返回生词本</button><a class="secondary" href="#tower">回摩天楼</a></div>`;
        $('review-back').onclick=wordbook;return;
      }
      stopWordRecording();
      const row=queue[index],word=row.word, meaning=words[word],plannedType=(index+variant)%4;
      const type=plannedType<2&&!recordedWords.has(word)?plannedType+2:plannedType;
      let options=[];
      if(type<2){
        const available=shuffled(Object.keys(words).filter(w=>w!==word&&words[w]!==meaning));
        options=shuffled([type===0?meaning:word,...new Set(available.map(w=>type===0?words[w]:w))].slice(0,4));
      }
      host.innerHTML=`<p class="eyebrow">${index+1} / ${queue.length}</p><h2>${['听词选意思','听声音选单词','这个词你认识吗？','看中文写英文'][type]}</h2>
      ${type<2?'<button class="secondary" id="play-review">▶ 播放发音</button>':`<p class="word-meaning">${E(type===2?word:meaning)}</p>`}
      <form id="review-answer" class="form">
      ${type<2?options.map((item,i)=>`<label class="choice"><input type="radio" name="answer" value="${i}" required>${E(item)}</label>`).join('')+'<button class="primary">确认</button>':type===2?
      '<div class="action-row"><button class="primary" name="decision" value="yes">认识</button><button class="secondary" name="decision" value="no">不认识</button></div>':
      '<label>你的拼写<input name="spelling" required autocomplete="off" autocapitalize="none" spellcheck="false"></label><button class="primary">确认</button>'}</form>
      <div id="word-feedback" role="status"></div>`;
      if(type<2)$('play-review').onclick=()=>pronounce(word);
      const form=$('review-answer');
      form.onsubmit=async event=>{
        event.preventDefault();
        const fields=new FormData(form);
        const known=type<2?options[Number(fields.get('answer'))]===(type===0?meaning:word):type===2?event.submitter?.value==='yes':fields.get('spelling').trim().toLowerCase()===word;
        const controls=[...form.querySelectorAll('input,button')];
        controls.forEach(el=>el.disabled=true);
        try{
          const outcome=await api('words-review',{word,stage:row.stage,known});
          if(!form.isConnected)return;
          if(known)correct++;
          $('word-feedback').innerHTML=`<p class="feedback ${known?'':'wrong'}"><strong>${known?'✓ 已记住':'稍后再复习'}</strong><br>${E(word)} · ${E(meaning)}<br>下次复习 ${E(outcome.due)}${outcome.newFloor?'<br>今日生词本已打卡，可回摩天楼看施工。':''}</p><button class="primary" id="word-next">继续</button>`;
          $('word-next').onclick=()=>{index++;question();};
          $('word-next').focus();
        }catch(error){if(form.isConnected){notice(error.message);controls.forEach(el=>el.disabled=false);}}
      };
    }
    home();
  }catch(error){if(host.isConnected)host.textContent=error.message;}
}

