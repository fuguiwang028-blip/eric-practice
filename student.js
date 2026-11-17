const lexicalDetails=async()=>WORD_DATA[1];
const lexicon=async()=>WORD_DATA[0];

function pronounce(word){
  if(!('speechSynthesis' in window)){notice('当前浏览器暂不支持朗读。');return;}
  speechSynthesis.cancel();
  const line=new SpeechSynthesisUtterance(({a:'ay',i:'I',mrs:'missus'})[word]||word);
  line.lang='en-US';
  const voices=speechSynthesis.getVoices();
  line.voice=voices.find(v=>v.localService&&v.lang==='en-US')||voices.find(v=>v.localService&&v.lang.startsWith('en'))||null;
  line.rate=.84;
  line.onerror=event=>{
    if(!['canceled','interrupted'].includes(event.error))notice('未能播放，请检查设备的英语语音设置。');
  };
  speechSynthesis.speak(line);
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
  view.innerHTML=sectionHeader('我的1000词')+`<section id="word-page" class="panel">
    <div class="row word-top"><div><p id="word-status" class="muted">正在读取词表…</p></div>
    <div class="action-row"><button class="secondary" id="random-words" disabled>随机补足 5 个</button><a class="primary" href="#wordbook">我的生词本</a></div></div>
    <div class="word-tools"><label>查找单词 <input id="find-word" type="search" autocomplete="off"></label>
    <button class="secondary" id="zoom-in" aria-label="放大">＋</button><button class="secondary" id="zoom-out" aria-label="缩小">−</button>
    <button class="secondary" id="reset-words">全览</button></div>
    <div class="word-viewport" id="word-viewport" tabindex="0" aria-label="单词画布，可拖动、滚动缩放或用方向键平移"><div id="word-plane" class="word-plane"></div></div>
  </section>`;
  const page=$('word-page'), frame=$('word-viewport'), plane=$('word-plane');
  try{
    const [words,initial,meta]=await Promise.all([lexicon(),api('words'),lexicalDetails()]);
    if(!page.isConnected)return;
    let current=initial;
    const entries=Object.entries(words);
    const columns=25, pitchX=132,pitchY=54;
    const buttons=new Map();
    const owned=new Set();
    let selected=null,x=0,y=0,scale=1,drag,pointers=new Map(),pinch;
    for(const [i,[word]] of entries.entries()){
      const button=document.createElement('button');
      button.type='button';button.className='word-tile';button.textContent=word;
      button.style.left=i%columns*pitchX+'px';button.style.top=Math.floor(i/columns)*pitchY+'px';
      button.onclick=()=>pick(word);
      buttons.set(word,button);plane.append(button);
    }
    function update(data){
      current=data;
      owned.clear();
      for(const r of data.words)owned.add(r.word);
      for(const [word,b] of buttons)b.classList.toggle('lit',owned.has(word));
      $('word-status').textContent=`共 ${entries.length} 词 · 今日点亮 ${data.added}/5${data.reviewed>=5?' · 今日抽卡机会已获得':` · 今日复习 ${data.reviewed}/5`}`;
      $('random-words').disabled=data.added>=5||data.words.length>=entries.length;
    }
    function pick(word){
      if(drag?.moved)return;
      selected?.classList.remove('selected');
      selected=buttons.get(word);selected.classList.add('selected');
      popup(`<h2>${E(word)}</h2><p class="lexical-detail">${E(meta[word]?.pos||'')} ${E(meta[word]?.ipa||'')}</p><p class="word-meaning">${E(words[word])}</p><div class="action-row">
        <button class="primary" id="light-word" ${owned.has(word)?'disabled':''}>${owned.has(word)?'已点亮':'点亮 · 加入生词本'}</button></div><p id="word-dialog-status" role="status"></p>`);
      pronounce(word);
      $('light-word').onclick=async()=>{
        const status=$('word-dialog-status'),btn=$('light-word');
        btn.disabled=true;
        try{
          const data=await api('words',{word});
          if(page.isConnected)update(data);
          if(status.isConnected)status.textContent='已加入生词本。复习 5 个到期词可获一次抽卡机会。';
          btn.textContent='已点亮';
        }catch(error){if(status.isConnected)status.textContent=error.message;btn.disabled=false;}
      };
    }
    function transform(){plane.style.transform=`translate(${x}px,${y}px) scale(${scale})`;}
    function zoom(next,cx=frame.clientWidth/2,cy=frame.clientHeight/2){
      next=Math.min(3,Math.max(.04,next));
      x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;
      scale=next;transform();
    }
    function fit(){
      const width=pitchX*columns, height=Math.ceil(entries.length/columns)*pitchY;
      scale=Math.max(.04,Math.min((frame.clientWidth-24)/width,(frame.clientHeight-24)/height));
      x=(frame.clientWidth-width*scale)/2;y=(frame.clientHeight-height*scale)/2;transform();
    }
    const metrics=()=>{
      const [a,b]=[...pointers.values()], r=frame.getBoundingClientRect();
      return {dist:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top};
    };
    let suppressClick=false;
    frame.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();}suppressClick=false;},true);
    frame.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      suppressClick=false;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){pinch=metrics();suppressClick=true;return;}
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,originX:x,originY:y,moved:false};
    });
    frame.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId))return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch&&pointers.size===2){
        const next=metrics();
        if(pinch.dist>0)zoom(scale*next.dist/pinch.dist,pinch.x,pinch.y);
        x+=next.x-pinch.x;y+=next.y-pinch.y;transform();pinch=next;return;
      }
      if(!drag||e.pointerId!==drag.id)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(!drag.moved&&Math.hypot(dx,dy)<5)return;
      if(!drag.moved)frame.setPointerCapture(e.pointerId);
      drag.moved=suppressClick=true;x=drag.originX+dx;y=drag.originY+dy;transform();
    });
    const release=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;drag=null;};
    frame.addEventListener('pointerup',release);frame.addEventListener('pointercancel',release);
    frame.addEventListener('pointerleave',e=>{if(!frame.hasPointerCapture(e.pointerId)&&!pinch)release(e);});
    frame.addEventListener('wheel',e=>{
      e.preventDefault();const r=frame.getBoundingClientRect();
      zoom(scale*Math.exp(-e.deltaY*.002),e.clientX-r.left,e.clientY-r.top);
    },{passive:false});
    frame.addEventListener('keydown',e=>{
      const movements={ArrowUp:[0,100],ArrowDown:[0,-100],ArrowLeft:[100,0],ArrowRight:[-100,0]};
      if(movements[e.key]){e.preventDefault();const [dx,dy]=movements[e.key];x+=dx;y+=dy;transform();}
      if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(scale*(e.key==='-'?.8:1.25));}
    });
    $('zoom-in').onclick=()=>zoom(scale*1.25);$('zoom-out').onclick=()=>zoom(scale*.8);
    $('reset-words').onclick=fit;
    $('find-word').oninput=e=>{
      const query=e.target.value.trim().toLowerCase();
      const entry=query&&(buttons.has(query)?query:entries.find(([w,meaning])=>w.startsWith(query)||meaning.includes(query))?.[0]);
      if(!entry)return;
      selected?.classList.remove('selected');selected=buttons.get(entry);selected.classList.add('selected');
      scale=1;x=frame.clientWidth/2-(parseFloat(selected.style.left)+60);y=frame.clientHeight/2-(parseFloat(selected.style.top)+20);transform();
    };
    $('find-word').onkeydown=e=>{
      if(e.key==='Enter'&&selected)pick(selected.textContent);
    };
    $('random-words').onclick=async()=>{
      $('random-words').disabled=true;
      try{const data=await api('words',{random:true});if(page.isConnected)update(data);}
      catch(error){notice(error.message);if(page.isConnected)update(current);}
    };
    update(initial);fit();
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
          <p>已点亮 ${data.words.length} 个 · 今日新增 ${data.added}/5 · 今日复习 ${data.reviewed}/5</p>
          <h3>艾宾浩斯复习计划</h3><div class="curve"><svg viewBox="0 0 540 105" role="img" aria-label="记忆随时间减弱，复习后回升示意"><path d="M5 20 Q20 70 74 76 L80 20 Q110 63 166 72 L172 20 Q215 53 260 67 L266 20 Q305 48 350 60 L356 20 Q404 46 440 54 L446 20 Q485 33 535 49" fill="none" stroke="currentColor" stroke-width="3"/></svg></div>
          <p class="muted">答对后逐步延长复习间隔（${data.intervals.join('、')} 天）。答错或选不认识的词会留在今天的复习列表。</p>
          <button class="primary" id="start-review" ${queue.length?'':'disabled'}>开始复习（本组 ${queue.length} 词）</button>
          <details><summary>查看生词及下次复习日期</summary><ul class="wordbook-list">${data.words.map(w=>`<li><b>${E(w.word)}</b>　${E(words[w.word])} <small>${E(w.due)}</small></li>`).join('')}</ul></details>`;
      $('start-review').onclick=question;
    }
    function question(){
      if(index>=queue.length){
        host.innerHTML=`<h2>本组复习完成</h2><p>已复习 ${queue.length} 词，答对或认识 ${correct} 词。</p><button class="primary" id="review-back">返回生词本</button>`;
        $('review-back').onclick=wordbook;return;
      }
      const row=queue[index],word=row.word, meaning=words[word],type=(index+variant)%4;
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
          $('word-feedback').innerHTML=`<p class="feedback ${known?'':'wrong'}"><strong>${known?'✓ 已记住':'稍后再复习'}</strong><br>${E(word)} · ${E(meaning)}<br>下次复习 ${E(outcome.due)}</p><button class="primary" id="word-next">继续</button>`;
          $('word-next').onclick=()=>{index++;question();};
          $('word-next').focus();
        }catch(error){if(form.isConnected){notice(error.message);controls.forEach(el=>el.disabled=false);}}
      };
    }
    home();
  }catch(error){if(host.isConnected)host.textContent=error.message;}
}

