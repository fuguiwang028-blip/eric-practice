const CITY_STYLES = {
  residential:{name:'住宅楼', roof:'蓝色尖顶', floors:10, residents:7, crop:'52 79 144 139'},
  apartment:{name:'公寓楼', roof:'红色圆顶', floors:20, residents:12, crop:'326 57 169 162'},
  office:{name:'办公楼', roof:'青色折顶', floors:30, residents:18, crop:'602 21 197 200'},
  skyscraper:{name:'摩天楼', roof:'金色阶梯顶', floors:40, residents:26, crop:'866 40 184 178'}
};
const CITY_STYLE_IDS=Object.keys(CITY_STYLES);
const CITY_TILE_SIZE=84;
const CITY_FOUNDATION_HEIGHT=26;
const CITY_CAMERA_TOP=64;
const CITY_CAMERA_BOTTOM=37;

let releaseCityScene;
const CITY_PHRASES_KEY='eric-city-phrases-v1';
function cityTime(now=new Date()){
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(now));
  const greeting=hour<5?'夜深了':hour<11?'早上好':hour<13?'中午好':hour<18?'下午好':'晚上好';
  const phase=hour<5||hour>=19?'night':hour<11?'morning':hour<17?'day':'sunset';
  return {hour,greeting,phase};
}
function validCityPhrases(value){
  return Array.isArray(value)&&value.length<=500&&value.every(line=>typeof line==='string'&&line.trim().length>0&&line.length<=160);
}
function cityPhrases(){
  if(location.protocol==='file:')try{
    const draft=JSON.parse(localStorage.getItem(CITY_PHRASES_KEY));
    if(validCityPhrases(draft))return draft;
  }catch{}
  return validCityPhrases(globalThis.ERIC_CITY_PHRASES)?globalThis.ERIC_CITY_PHRASES:[];
}
let lastCityPhrase;
function randomCityPhrase(){
  const phrases=[...new Set(cityPhrases())];
  const options=phrases.length>1?phrases.filter(line=>line!==lastCityPhrase):phrases;
  if(!options.length)return '';
  lastCityPhrase=options[Math.floor(Math.random()*options.length)];
  return lastCityPhrase;
}
function editCityPhrases(){
  if(location.protocol!=='file:')return;
  popup(`<h2>住户流行语库</h2><p>每行一句，最多 500 句，每句不超过 160 字。留空可以关闭气泡。</p><label>流行语<textarea id="city-phrase-input" rows="12">${E(cityPhrases().join('\n'))}</textarea></label><div class="action-row"><button class="primary" id="city-phrase-save">保存到本地</button><button class="secondary" id="city-phrase-export">保存并导出发布文件</button></div><p id="city-phrase-message" role="status"></p>`);
  function save(){
    const lines=$('city-phrase-input').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(!validCityPhrases(lines))throw Error('最多 500 句，每句不超过 160 字。');
    localStorage.setItem(CITY_PHRASES_KEY,JSON.stringify(lines));
    $('city-phrase-message').textContent='已保存 '+lines.length+' 句。网页版需替换导出的同名文件后发布。';
    return lines;
  }
  $('city-phrase-save').onclick=()=>{try{save();}catch(e){$('city-phrase-message').textContent=e.message;}};
  $('city-phrase-export').onclick=()=>{try{
    const lines=save();
    const url=URL.createObjectURL(new Blob(['globalThis.ERIC_CITY_PHRASES = '+JSON.stringify(lines,null,2)+';\n'],{type:'text/javascript'}));
    const link=document.createElement('a');link.href=url;link.download='published-city-phrases.js';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){$('city-phrase-message').textContent=e.message;}};
}

function cityFloorCount(progress){
  return new Set([...Object.keys(progress.climbs),...Object.keys(progress.awards).filter(k=>!k.endsWith(':words')&&!k.slice(11).startsWith('course-'))]).size+sum(Object.values(progress.courseFloors||{}));
}
function citySettings(progress,total=cityFloorCount(progress)){
  const input=progress.city;
  const seen=Number.isSafeInteger(input?.seen)?Math.max(0,Math.min(total,input.seen)):total;
  const styles=Array.isArray(input?.styles)?input.styles.map(s=>CITY_STYLE_IDS.includes(s)?s:null):[];
  const used=new Set();
  const lots=(Array.isArray(input?.lots)?input.lots:[]).map(value=>{
    if(!Number.isSafeInteger(value)||value<0||used.has(value))return null;
    used.add(value);return value;
  });
  return {seen,styles,lots};
}
function cityStyle(city,index){return city.styles[index]||CITY_STYLE_IDS[index%CITY_STYLE_IDS.length];}
function cityCapacity(city,index){return CITY_STYLES[cityStyle(city,index)].floors;}
function cityCountAt(city,total,index){
  for(let i=0;i<index&&total>0;i++)total-=cityCapacity(city,i);
  return Math.max(0,Math.min(total,cityCapacity(city,index)));
}
function cityActive(city,total){
  let index=0;
  while(total>=cityCapacity(city,index)){total-=cityCapacity(city,index);index++;}
  return index;
}
function cityPopulation(city,total){
  let population=0;
  for(let i=0;total>0;i++){
    const count=Math.min(total,cityCapacity(city,i));
    population+=count*CITY_STYLES[cityStyle(city,i)].residents;
    total-=count;
  }
  return population;
}
function cityLotAssignments(city,count){
  const lots=new Map();
  for(let i=0;i<count;i++)if(Number.isSafeInteger(city.lots[i]))lots.set(i,city.lots[i]);
  const occupied=new Set(lots.values());
  for(let i=0,next=0;i<count;i++){
    if(lots.has(i))continue;
    while(occupied.has(next))next++;
    lots.set(i,next);occupied.add(next);
  }
  return lots;
}
function roofSprite(style){
  return `<svg class="city-roof-sprite" viewBox="${CITY_STYLES[style].crop}" aria-hidden="true"><image href="./city-assets/roof-sheet.png" width="1094" height="250"/></svg>`;
}
function cityDigits(n){
  return String(n).padStart(5,'0').split('').map(value=>`<b>${value}</b>`).join('');
}
function cityAtmosphere(height){
  if(height>=35)return ['space','近地轨道','🚀','🛸'];
  if(height>=15)return ['air','高空航路','🎈','✈'];
  return ['street','城市天际线','',''];
}
function updateCity(profileKey,mutate){
  if(progressKey()!==profileKey)return false;
  const progress=readProgress();
  const city=citySettings(progress);
  mutate(city,cityFloorCount(progress));
  return saveProgress({...progress,city});
}
function cityStorey(entrance=false){
  if(entrance)return '<div class="city-storey city-entrance" aria-hidden="true"><b></b><span><em></em><em></em></span><b></b></div>';
  return '<div class="city-storey" aria-hidden="true"><i></i><i></i></div>';
}
function cityRoof(){
  return '<div class="city-roof" aria-hidden="true"><i></i></div>';
}
function cityBuilding(style,count){
  return `<div class="city-building theme-${style}" data-storeys="${count}" aria-label="${CITY_STYLES[style].name}，已建${count}层">${count===CITY_STYLES[style].floors?cityRoof():''}${cityStorey().repeat(Math.max(0,count-1))}${count>0?cityStorey(true):''}<div class="city-foundation" aria-hidden="true"></div></div>`;
}
function cityCameraLayout(count,capacity,stageHeight,mode='full'){
  const completed=count===capacity;
  const towerHeight=count*CITY_TILE_SIZE+CITY_FOUNDATION_HEIGHT+(completed?30:0);
  // Keep square floors intact. Move/scale the camera, never truncate the tower.
  const worldHeight=towerHeight+(completed?70:270);
  const available=Math.max(1,stageHeight-CITY_CAMERA_TOP-CITY_CAMERA_BOTTOM);
  const scale=mode==='near'?1:Math.min(1,available/worldHeight);
  const bottom=mode==='near'&&worldHeight>available?stageHeight-CITY_CAMERA_TOP-worldHeight:CITY_CAMERA_BOTTOM;
  const residentBottom=Math.max(60,Math.min(stageHeight-160,bottom+(count*CITY_TILE_SIZE+CITY_FOUNDATION_HEIGHT)*scale));
  return {worldHeight,scale,bottom,residentBottom};
}
function cityTower(){
  const user=state.user;
  const profileKey=progressKey();
  const progress=readProgress();
  const total=cityFloorCount(progress);
  let city=citySettings(progress,total);
  let visible=city.seen;
  let index=cityActive(city,visible);
  let population=cityPopulation(city,visible);
  let buildingInProgress=false;
  let cameraMode='full';
  let selectedLot=null;
  let mapPage=Math.floor((cityLotAssignments(city,index+1).get(index)||0)/25);
  const view=$('view');
  view.innerHTML=`
    <header class="city-heading"><div><p class="eyebrow">${E(state.day)} · 个人进度</p><p class="city-greeting" id="city-greeting"></p><h1>我的摩天楼</h1>${user.slogan?`<p class="city-slogan">${E(user.slogan)}</p>`:''}</div>
      <div class="city-console">
        <div class="city-height-hud" aria-label="当前建筑楼层"><span class="city-hud-icon city-building-icon" aria-hidden="true"></span><strong id="city-building-floor"></strong></div>
        <div class="city-pop-hud"><span class="city-hud-icon city-people-icon" aria-hidden="true"></span><div id="city-population" class="city-digits" aria-label="城市人口"></div></div>
        <small>累计 <strong id="city-floor-count">${visible}</strong> 层</small>
      </div>
    </header>
    <div class="city-layout">
      <section class="city-stage" id="city-stage" aria-label="摩天楼施工场景">
        <div class="city-celestial" aria-hidden="true"></div><div class="city-stars" aria-hidden="true"></div>
        <div class="city-skyline" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="city-aircraft" id="city-aircraft" aria-hidden="true"></div>
        <div class="city-ground" aria-hidden="true"></div>
        <div class="city-site" aria-hidden="true">
          <div class="city-site-hedge"></div><div class="city-site-tree"><i></i></div>
          <div class="city-site-mesh"><i></i><i></i><i></i></div>
          <div class="city-site-hoarding"><i></i></div>
          <div class="city-site-cone city-site-cone-left"></div><div class="city-site-cone city-site-cone-right"></div>
        </div>
        <div class="city-scene-top"><span id="city-building-name"></span><span id="city-altitude"></span></div>
        <div class="city-view-controls" role="group" aria-label="建筑视角"><button type="button" id="city-view-full" aria-pressed="true">全楼</button><button type="button" id="city-view-near" aria-pressed="false">近景</button><span id="city-view-description" class="sr-only"></span></div>
        <div id="city-construction" class="city-construction"></div>
        <div id="city-residents" class="city-residents" aria-hidden="true"></div>
        <p id="city-status" class="city-status" role="status">新课次首次达到 90 分，吊车就会放下一层。</p>
      </section>
      <aside class="city-side">
        <section class="panel city-plan"><div class="city-section-head"><h2>城市规划</h2><span id="city-building-total"></span></div>
          <div id="city-map" class="city-map" aria-label="楼栋地图"></div>
          <p class="muted city-map-help">拖动楼栋换位置，也可以先点楼栋，再点目标格。</p><div id="city-map-pager" class="city-map-pager"></div><h3>下一栋楼的风格</h3><p class="muted" id="city-style-note"></p>
          <div id="city-styles" class="city-styles"></div>
        </section>
        ${location.protocol==='file:'?'<section class="panel city-phrase-editor"><h2>住户流行语</h2><p class="muted">每次回家随机一句，气泡显示 3 秒。</p><button type="button" class="secondary" id="city-edit-phrases">编辑 / 导出流行语库</button></section>':''}
        <section class="panel"><h2>今日路线</h2><p class="muted">今日练习建楼 ${state.todayFloors} 层 · 每课首次达 90 分建一层</p>
          <div class="path-items daily-route">${moduleLinks()}
            <a class="path-item" href="#wordbook"><span>我的生词本</span><small>${state.wordReview.climbed?'今日已建造':'今日复习 '+state.wordReview.reviewed+'/5'}</small></a>
            <a class="secondary" href="#collection">去抽卡</a>
          </div>
        </section>
      </aside>
    </div>`;
  const stage=$('city-stage'),construction=$('city-construction');
  const stillHere=()=>stage.isConnected&&progressKey()===profileKey;
  let bubbleTimer, bubbleShown=false, cameraObserver;
  function updateCamera(){
    if(!stillHere())return;
    const count=cityCountAt(city,visible,index);
    const layout=cityCameraLayout(count,cityCapacity(city,index),stage.clientHeight||640,cameraMode);
    construction.style.setProperty('--city-world-height',layout.worldHeight+'px');
    construction.style.setProperty('--city-camera-scale',layout.scale);
    construction.style.setProperty('--city-camera-bottom',layout.bottom+'px');
    stage.style.setProperty('--city-resident-bottom',layout.residentBottom+'px');
    stage.dataset.view=cameraMode;
    $('city-view-full').setAttribute('aria-pressed',String(cameraMode==='full'));
    $('city-view-near').setAttribute('aria-pressed',String(cameraMode==='near'));
    $('city-view-description').textContent=cameraMode==='full'?`全楼视角，完整显示已建${count}层`:'近景视角，查看楼顶；切换全楼可查看所有楼层';
  }
  for(const mode of ['full','near'])$('city-view-'+mode).onclick=()=>{cameraMode=mode;stage.querySelectorAll('.city-speech-bubble').forEach(b=>b.remove());updateCamera();};
  if(typeof ResizeObserver!=='undefined'){cameraObserver=new ResizeObserver(updateCamera);cameraObserver.observe(stage);}
  else window.addEventListener('resize',updateCamera);
  function updateTime(){
    if(!stillHere())return;
    const {phase,greeting}=cityTime();
    stage.dataset.time=phase;
    $('city-greeting').textContent=greeting+'！'+user.alias+'市长';
  }
  updateTime();
  const clockTimer=setInterval(updateTime,60000);
  releaseCityScene=()=>{clearInterval(clockTimer);clearTimeout(bubbleTimer);cameraObserver?.disconnect();if(typeof window!=='undefined')window.removeEventListener('resize',updateCamera);};
  if(location.protocol==='file:')$('city-edit-phrases').onclick=editCityPhrases;
  function showResidentBubble(){
    if(bubbleShown||!stillHere())return;
    const viewport=stage.getBoundingClientRect();
    const floors=[...construction.querySelectorAll('.city-building > .city-storey')].filter(f=>{const r=f.getBoundingClientRect();return r.bottom>viewport.top+70&&r.top<viewport.bottom-50;});
    const phrase=randomCityPhrase();
    if(!floors.length||!phrase)return;
    bubbleShown=true;
    const floor=floors[Math.floor(Math.random()*floors.length)];
    const bubble=document.createElement('div');bubble.className='city-speech-bubble';
    bubble.setAttribute('role','status');
    const label=document.createElement('small');label.textContent='住户说';
    const content=document.createElement('span');content.textContent=phrase;
    bubble.append(label,content);stage.append(bubble);
    const rect=floor.getBoundingClientRect(), bounds=stage.getBoundingClientRect();
    const targetX=rect.left-bounds.left+rect.width/2;
    const left=Math.max(14,Math.min(bounds.width-bubble.offsetWidth-14,targetX-bubble.offsetWidth/2));
    bubble.style.left=left+'px';
    bubble.style.setProperty('--tail-at',Math.max(20,Math.min(bubble.offsetWidth-20,targetX-left))+'px');
    bubble.style.top=Math.max(64,rect.top-bounds.top+rect.height*.35-bubble.offsetHeight-14)+'px';
    bubbleTimer=setTimeout(()=>bubble.remove(),3000);
  }
  const motion=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,motion()?ms:0));
  function renderScene(){
    const style=cityStyle(city,index);
    const count=cityCountAt(city,visible,index);
    const name=CITY_STYLES[style].name;
    $('city-building-name').textContent=`第 ${index+1} 栋 · ${name}`;
    const [scene,label,first,second]=cityAtmosphere(count);
    if(stage.dataset.scene!==scene){
      stage.dataset.scene=scene;
      $('city-aircraft').innerHTML=`<span>${first}</span><span>${second}</span>`;
    }
    $('city-altitude').textContent=label;
    $('city-building-floor').textContent=`${count}/${cityCapacity(city,index)}`;
    stage.style.setProperty('--built',count);
    construction.innerHTML=cityBuilding(style,count)+
      (count<cityCapacity(city,index)?`<div class="city-crane theme-${style}" id="city-crane" aria-hidden="true"><div class="city-cable"></div><div class="city-hook"></div>${cityStorey(count===0)}</div>`:'');
    updateCamera();
  }
  function setStats(){
    $('city-floor-count').textContent=visible;
    $('city-population').innerHTML=cityDigits(population);
    $('city-population').setAttribute('aria-label','城市人口 '+population+' 人');
  }
  function renderPlan(){
    const next=cityActive(city,visible);
    const alreadyStarted=cityCountAt(city,visible,next)>0;
    const configurable=alreadyStarted?next+1:next;
    const selected=cityStyle(city,configurable);
    const assignments=cityLotAssignments(city,next+1);
    const occupants=new Map([...assignments].map(([building,lot])=>[lot,building]));
    const lastPage=Math.max(mapPage,Math.floor(Math.max(...assignments.values(),0)/25));
    const lots=Array.from({length:25},(_,i)=>mapPage*25+i);
    $('city-building-total').textContent=`已封顶 ${next} 栋`;
    $('city-map').innerHTML=lots.map(lot=>{
      const i=occupants.get(lot);
      const count=i===undefined?0:cityCountAt(city,visible,i);
      const style=i===undefined?null:cityStyle(city,i);
      const name=style?CITY_STYLES[style].name:'空地';
      return `<button type="button" data-lot="${lot}" class="city-lot ${i===index?'focused':''} ${selectedLot===lot?'moving':''}"
        ${buildingInProgress?'disabled':''} draggable="${!buildingInProgress&&i!==undefined}" aria-label="${name}${style?' '+count+' 层':''}">
        <span class="city-lot-icon">${style?roofSprite(style):''}</span><small>${style?(count?count+'F':'施工'):'空地'}</small></button>`;
    }).join('');
    $('city-map-pager').innerHTML=lastPage?'<button class="plain" data-map-page="-1">上一街区</button><button class="plain" data-map-page="1">下一街区</button>':'';
    $('city-map-pager').querySelectorAll('[data-map-page]').forEach(b=>{
      b.disabled=buildingInProgress||mapPage+Number(b.dataset.mapPage)<0||mapPage+Number(b.dataset.mapPage)>lastPage;
      b.onclick=()=>{mapPage+=Number(b.dataset.mapPage);renderPlan();};
    });
    $('city-style-note').textContent=`第 ${configurable+1} 栋 · ${alreadyStarted?'当前楼栋封顶后启用':'落下第一层后锁定风格'}`;
    $('city-styles').innerHTML=CITY_STYLE_IDS.map(id=>`<button type="button" data-style="${id}" class="city-style theme-${id}" aria-pressed="${id===selected}" ${buildingInProgress?'disabled':''}>${roofSprite(id)}<span><strong>${CITY_STYLES[id].name}</strong><small>${CITY_STYLES[id].floors} 层 · 每层 ${CITY_STYLES[id].residents} 人</small></span></button>`).join('');
    function move(from,to){
      if(from===to||!occupants.has(from))return;
      const moving=occupants.get(from), target=occupants.get(to);
      if(!updateCity(profileKey,current=>{
        current.lots=Array.from({length:next+1},(_,i)=>assignments.get(i));
        current.lots[moving]=to;
        if(target!==undefined)current.lots[target]=from;
        city.lots=current.lots;
      })){notice('无法保存楼栋位置。');return;}
      selectedLot=null;renderPlan();
    }
    $('city-map').querySelectorAll('[data-lot]').forEach(button=>{
      const lot=Number(button.dataset.lot);
      button.onclick=()=>{
        if(selectedLot!==null&&selectedLot!==lot){move(selectedLot,lot);return;}
        if(!occupants.has(lot))return;
        index=occupants.get(lot);
        selectedLot=selectedLot===lot?null:lot;
        renderScene();renderPlan();
        $('city-status').textContent=selectedLot!==null?'已选楼栋，点目标格移动。':index===next?'新课次首次达到 90 分，吊车就会放下一层。':'这栋楼已经封顶。';
      };
      button.ondragstart=event=>{event.dataTransfer.setData('text/plain',String(lot));event.dataTransfer.effectAllowed='move';};
      button.ondragover=event=>{if(!buildingInProgress)event.preventDefault();};
      button.ondrop=event=>{
        event.preventDefault();
        const raw=event.dataTransfer.getData('text/plain');
        if(/^\d+$/.test(raw))move(Number(raw),lot);
      };
    });
    $('city-styles').querySelectorAll('[data-style]').forEach(button=>button.onclick=()=>{
      const style=button.dataset.style;
      const saved=updateCity(profileKey,current=>{current.styles[configurable]=style;});
      if(!saved){notice('无法保存建筑风格，请检查浏览器存储权限。');return;}
      city.styles[configurable]=style;
      renderScene();renderPlan();
    });
  }
  function floatResident(i){
    const person=document.createElement('span');
    person.className='city-resident';
    person.style.setProperty('--from',i%2===0?'-140px':'140px');
    person.style.setProperty('--lane',i%4-1.5);
    person.innerHTML='<i></i><b></b>';
    $('city-residents').append(person);
    person.addEventListener('animationend',()=>person.remove(),{once:true});
  }
  async function buildPending(){
    if(visible>=total)return;
    buildingInProgress=true;
    while(visible<total&&stillHere()){
      index=cityActive(city,visible);
      renderScene();renderPlan();
      $('city-status').textContent='打卡完成！吊车正在安装新楼层。';
      const crane=$('city-crane');
      if(motion()&&crane?.animate){
        const offset=construction.offsetHeight-cityCountAt(city,visible,index)*CITY_TILE_SIZE-CITY_FOUNDATION_HEIGHT-CITY_TILE_SIZE-105;
        const animation=crane.animate([{transform:'translate(-50%, 0)'},{transform:`translate(-50%, ${Math.max(45,offset)}px)`}],{duration:720,easing:'cubic-bezier(.6,.05,.65,1)',fill:'forwards'});
        await animation.finished.catch(()=>{});
      }
      if(!stillHere())return;
      visible++;
      setStats();renderScene();
      stage.classList.add('city-landed');
      $('city-status').textContent='楼层建好了！居民正在入住。';
      const arrivals=Array.from({length:CITY_STYLES[cityStyle(city,index)].residents},async(_,i)=>{
        await pause(i*105);
        if(!stillHere())return;
        if(motion())floatResident(i);
        await pause(780);
        if(!stillHere())return;
        population++;
        setStats();
      });
      await Promise.all(arrivals);
      if(!stillHere())return;
      if(!updateCity(profileKey,current=>{
        current.seen=Math.max(current.seen,visible);
        current.styles[index]=cityStyle(city,index);
      })){
        notice('楼层已完成，动画进度未能保存。');
        buildingInProgress=false;renderPlan();
        return;
      }
      city.seen=visible;
      stage.classList.remove('city-landed');
      if(cityCountAt(city,visible,index)===cityCapacity(city,index)){
        $('city-status').textContent='楼栋已封顶！吊车将移到下一栋楼。';
        await pause(850);
      }
    }
    if(!stillHere())return;
    buildingInProgress=false;
    index=cityActive(city,visible);
    renderScene();renderPlan();
    $('city-status').textContent='下一层已备好，等你完成下一次打卡。';
  }
  if(!progress.city)updateCity(profileKey,()=>{});
  setStats();renderScene();renderPlan();
  buildPending().then(showResidentBubble).catch(()=>{if(stillHere())notice('施工动画暂未完成，返回首页可以重播。');});
}
