const CITY_STYLES = {
  residential:{name:'住宅楼', roof:'蓝色尖顶'},
  apartment:{name:'公寓楼', roof:'红色圆顶'},
  office:{name:'办公楼', roof:'青色折顶'},
  skyscraper:{name:'摩天楼', roof:'金色阶梯顶'}
};
const CITY_STYLE_IDS=Object.keys(CITY_STYLES);
const FLOORS_PER_BUILDING=10;
const RESIDENTS_PER_FLOOR=7;

function cityFloorCount(progress){
  return new Set([...Object.keys(progress.climbs),...Object.keys(progress.awards).filter(k=>!k.endsWith(':words'))]).size;
}
function citySettings(progress,total=cityFloorCount(progress)){
  const input=progress.city;
  const seen=Number.isSafeInteger(input?.seen)?Math.max(0,Math.min(total,input.seen)):total;
  const styles=Array.isArray(input?.styles)?input.styles.map(s=>CITY_STYLE_IDS.includes(s)?s:null):[];
  return {seen,styles};
}
function cityStyle(city,index){return city.styles[index]||CITY_STYLE_IDS[index%CITY_STYLE_IDS.length];}
function cityFloors(total,index){return Math.max(0,Math.min(FLOORS_PER_BUILDING,total-index*FLOORS_PER_BUILDING));}
function updateCity(profileKey,mutate){
  if(progressKey()!==profileKey)return false;
  const progress=readProgress();
  const city=citySettings(progress);
  mutate(city,cityFloorCount(progress));
  return saveProgress({...progress,city});
}
function cityStorey(){
  return '<div class="city-storey" aria-hidden="true"><i></i><i></i><i></i><i></i></div>';
}
function cityRoof(){
  return '<div class="city-roof" aria-hidden="true"><i></i></div>';
}
function cityBuilding(style,count){
  return `<div class="city-building theme-${style}">${count===FLOORS_PER_BUILDING?cityRoof():''}${cityStorey().repeat(count)}<div class="city-foundation" aria-hidden="true"></div></div>`;
}
function cityTower(){
  const user=state.user;
  const profileKey=progressKey();
  const progress=readProgress();
  const total=cityFloorCount(progress);
  let city=citySettings(progress,total);
  let visible=city.seen;
  let index=Math.floor(visible/FLOORS_PER_BUILDING);
  let population=visible*RESIDENTS_PER_FLOOR;
  let buildingInProgress=false;
  const view=$('view');
  view.innerHTML=`
    <header class="city-heading"><div><p class="eyebrow">${E(state.day)} · 个人进度</p><h1>我的摩天楼</h1>${user.slogan?`<p class="city-slogan">${E(user.slogan)}</p>`:''}</div>
      <div class="city-stats"><div><span>累计楼层</span><strong id="city-floor-count">${visible}</strong></div><div><span>城市人口</span><strong id="city-population">${population}</strong></div></div>
    </header>
    <div class="city-layout">
      <section class="city-stage" id="city-stage" aria-label="摩天楼施工场景">
        <div class="city-skyline" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="city-ground" aria-hidden="true"></div>
        <div class="city-scene-top"><span id="city-building-name"></span><span id="city-building-floor"></span></div>
        <div id="city-construction" class="city-construction"></div>
        <div id="city-residents" class="city-residents" aria-hidden="true"></div>
        <p id="city-status" class="city-status" role="status">完成一次打卡，吊车就会放下一层。</p>
      </section>
      <aside class="city-side">
        <section class="panel city-plan"><div class="city-section-head"><h2>城市规划</h2><span id="city-building-total"></span></div>
          <div id="city-map" class="city-map" aria-label="楼栋地图"></div>
          <h3>下一栋楼的风格</h3><p class="muted" id="city-style-note"></p>
          <div id="city-styles" class="city-styles"></div>
        </section>
        <section class="panel"><h2>今日路线</h2><p class="muted">已打卡 ${doneCount()} / 3 · 每完成一个模块，建一层</p>
          <div class="path-items daily-route">${moduleLinks()}
            <a class="path-item" href="#wordbook"><span>我的生词本</span><small>今日点亮 ${state.vocabulary}/5</small></a>
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
    const count=cityFloors(visible,index);
    const name=CITY_STYLES[style].name;
    $('city-building-name').textContent=`第 ${index+1} 栋 · ${name}`;
    $('city-building-floor').textContent=`${count} / ${FLOORS_PER_BUILDING} 层`;
    stage.style.setProperty('--built',count);
    construction.innerHTML=cityBuilding(style,count)+
      (count<FLOORS_PER_BUILDING?`<div class="city-crane theme-${style}" id="city-crane" aria-hidden="true"><div class="city-cable"></div><div class="city-hook"></div>${cityStorey()}</div>`:'');
  }
  function setStats(){
    $('city-floor-count').textContent=visible;
    $('city-population').textContent=population;
  }
  function renderPlan(){
    const next=Math.floor(visible/FLOORS_PER_BUILDING);
    const alreadyStarted=cityFloors(visible,next)>0;
    const configurable=alreadyStarted?next+1:next;
    const selected=cityStyle(city,configurable);
    const first=Math.max(0,next-7);
    const lots=Array.from({length:9},(_,i)=>first+i);
    $('city-building-total').textContent=`已封顶 ${Math.floor(visible/FLOORS_PER_BUILDING)} 栋`;
    $('city-map').innerHTML=lots.map(i=>{
      const count=cityFloors(visible,i);
      const style=cityStyle(city,i);
      const name=CITY_STYLES[style].name;
      return `<button type="button" data-lot="${i}" class="city-lot ${i===index?'focused':''}" ${buildingInProgress||(!count&&i!==next)?'disabled':''} aria-label="第 ${i+1} 栋，${count} 层">
        <span class="city-lot-icon theme-${style} ${count||i===next?'':'empty'}">${count||i===next?cityRoof():''}</span>
        <small>${count?name+' '+count+'F':i===next?'施工位':'空地'}</small></button>`;
    }).join('');
    $('city-style-note').textContent=`第 ${configurable+1} 栋 · ${alreadyStarted?'当前楼栋封顶后启用':'落下第一层后锁定风格'}`;
    $('city-styles').innerHTML=CITY_STYLE_IDS.map(id=>`<button type="button" data-style="${id}" class="city-style theme-${id}" aria-pressed="${id===selected}" ${buildingInProgress?'disabled':''}>${cityRoof()}<span><strong>${CITY_STYLES[id].name}</strong><small>${CITY_STYLES[id].roof}</small></span></button>`).join('');
    $('city-map').querySelectorAll('[data-lot]').forEach(button=>button.onclick=()=>{
      index=Number(button.dataset.lot);renderScene();renderPlan();
      $('city-status').textContent=index===next?'完成一次打卡，吊车就会放下一层。':'这栋楼已经封顶。';
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
      index=Math.floor(visible/FLOORS_PER_BUILDING);
      renderScene();renderPlan();
      $('city-status').textContent='打卡完成！吊车正在安装新楼层。';
      const crane=$('city-crane');
      if(motion()&&crane?.animate){
        const offset=construction.offsetHeight-cityFloors(visible,index)*39-26-39-105;
        const animation=crane.animate([{transform:'translate(-50%, 0)'},{transform:`translate(-50%, ${Math.max(45,offset)}px)`}],{duration:720,easing:'cubic-bezier(.6,.05,.65,1)',fill:'forwards'});
        await animation.finished.catch(()=>{});
      }
      if(!stillHere())return;
      visible++;
      setStats();renderScene();
      stage.classList.add('city-landed');
      $('city-status').textContent='楼层建好了！居民正在入住。';
      const arrivals=Array.from({length:RESIDENTS_PER_FLOOR},async(_,i)=>{
        await pause(i*140);
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
      if(visible%FLOORS_PER_BUILDING===0){
        $('city-status').textContent='十层封顶！吊车将移到下一栋楼。';
        await pause(850);
      }
    }
    if(!stillHere())return;
    buildingInProgress=false;
    index=Math.floor(visible/FLOORS_PER_BUILDING);
    renderScene();renderPlan();
    $('city-status').textContent='下一层已备好，等你完成下一次打卡。';
  }
  if(!progress.city)updateCity(profileKey,()=>{});
  renderScene();renderPlan();
  buildPending().catch(()=>{if(stillHere())notice('施工动画暂未完成，返回首页可以重播。');});
}
