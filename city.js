const CITY_STYLES = {
  residential:{name:'住宅楼', roof:'蓝色尖顶', floors:10, residents:7, crop:'52 79 144 139'},
  apartment:{name:'公寓楼', roof:'红色圆顶', floors:20, residents:12, crop:'326 57 169 162'},
  office:{name:'办公楼', roof:'青色折顶', floors:30, residents:18, crop:'602 21 197 200'},
  skyscraper:{name:'摩天楼', roof:'金色阶梯顶', floors:40, residents:26, crop:'866 40 184 178'}
};
const CITY_STYLE_IDS=Object.keys(CITY_STYLES);
const CITY_TILE_SIZE=84;
const CITY_VISIBLE_FLOORS=4;

function cityFloorCount(progress){
  return new Set([...Object.keys(progress.climbs),...Object.keys(progress.awards).filter(k=>!k.endsWith(':words'))]).size;
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
  if(height>=40)return ['space','近地轨道','🚀','🛸'];
  if(height>=20)return ['air','高空航路','🎈','✈'];
  return ['street','城市天际线','',''];
}
function updateCity(profileKey,mutate){
  if(progressKey()!==profileKey)return false;
  const progress=readProgress();
  const city=citySettings(progress);
  mutate(city,cityFloorCount(progress));
  return saveProgress({...progress,city});
}
function cityStorey(){
  return '<div class="city-storey" aria-hidden="true"><i></i><i></i></div>';
}
function cityRoof(){
  return '<div class="city-roof" aria-hidden="true"><i></i></div>';
}
function cityBuilding(style,count){
  return `<div class="city-building theme-${style}">${count===CITY_STYLES[style].floors?cityRoof():''}${cityStorey().repeat(Math.min(count,CITY_VISIBLE_FLOORS))}<div class="city-foundation" aria-hidden="true"></div></div>`;
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
  let selectedLot=null;
  let mapPage=Math.floor((cityLotAssignments(city,index+1).get(index)||0)/25);
  const view=$('view');
  view.innerHTML=`
    <header class="city-heading"><div><p class="eyebrow">${E(state.day)} · 个人进度</p><h1>我的摩天楼</h1>${user.slogan?`<p class="city-slogan">${E(user.slogan)}</p>`:''}</div>
      <div class="city-console">
        <div class="city-height-hud" aria-label="当前建筑楼层"><span class="city-hud-icon city-building-icon" aria-hidden="true"></span><strong id="city-building-floor"></strong></div>
        <div class="city-pop-hud"><span class="city-hud-icon city-people-icon" aria-hidden="true"></span><div id="city-population" class="city-digits" aria-label="城市人口"></div></div>
        <small>累计 <strong id="city-floor-count">${visible}</strong> 层</small>
      </div>
    </header>
    <div class="city-layout">
      <section class="city-stage" id="city-stage" aria-label="摩天楼施工场景">
        <div class="city-skyline" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="city-aircraft" id="city-aircraft" aria-hidden="true"></div>
        <div class="city-ground" aria-hidden="true"></div>
        <div class="city-scene-top"><span id="city-building-name"></span><span id="city-altitude"></span></div>
        <div id="city-construction" class="city-construction"></div>
        <div id="city-residents" class="city-residents" aria-hidden="true"></div>
        <p id="city-status" class="city-status" role="status">完成一次打卡，吊车就会放下一层。</p>
      </section>
      <aside class="city-side">
        <section class="panel city-plan"><div class="city-section-head"><h2>城市规划</h2><span id="city-building-total"></span></div>
          <div id="city-map" class="city-map" aria-label="楼栋地图"></div>
          <p class="muted city-map-help">拖动楼栋换位置，也可以先点楼栋，再点目标格。</p><div id="city-map-pager" class="city-map-pager"></div><h3>下一栋楼的风格</h3><p class="muted" id="city-style-note"></p>
          <div id="city-styles" class="city-styles"></div>
        </section>
        <section class="panel"><h2>今日路线</h2><p class="muted">已打卡 ${doneCount()+Number(state.wordReview.climbed)} / 4 · 每项打卡建一层</p>
          <div class="path-items daily-route">${moduleLinks()}
            <a class="path-item" href="#wordbook"><span>我的生词本</span><small>${state.wordReview.climbed?'今日已登楼':'今日复习 '+state.wordReview.reviewed+'/5'}</small></a>
            <a class="secondary" href="#collection">去抽卡</a>
          </div>
        </section>
      </aside>
    </div>`;
  const stage=$('city-stage'),construction=$('city-construction');
  const stillHere=()=>stage.isConnected&&progressKey()===profileKey;
  const motion=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,motion()?ms:0));
  function renderScene(){
    const style=cityStyle(city,index);
    const count=cityCountAt(city,visible,index);
    const name=CITY_STYLES[style].name;
    $('city-building-name').textContent=`第 ${index+1} 栋 · ${name}`;
    const [scene,label,first,second]=cityAtmosphere(Math.max(count,visible));
    if(stage.dataset.scene!==scene){
      stage.dataset.scene=scene;
      $('city-aircraft').innerHTML=`<span>${first}</span><span>${second}</span>`;
    }
    $('city-altitude').textContent=label;
    $('city-building-floor').textContent=`${count}/${cityCapacity(city,index)}`;
    stage.style.setProperty('--built',Math.min(count,CITY_VISIBLE_FLOORS));
    construction.innerHTML=cityBuilding(style,count)+
      (count<cityCapacity(city,index)?`<div class="city-crane theme-${style}" id="city-crane" aria-hidden="true"><div class="city-cable"></div><div class="city-hook"></div>${cityStorey()}</div>`:'');
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
        $('city-status').textContent=selectedLot!==null?'已选楼栋，点目标格移动。':index===next?'完成打卡，吊车就会放下一层。':'这栋楼已经封顶。';
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
        const offset=construction.offsetHeight-Math.min(cityCountAt(city,visible,index),CITY_VISIBLE_FLOORS)*CITY_TILE_SIZE-26-CITY_TILE_SIZE-105;
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
  buildPending().catch(()=>{if(stillHere())notice('施工动画暂未完成，返回首页可以重播。');});
}
