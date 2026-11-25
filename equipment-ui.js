function armorIcon(slot,level,extra=''){
  return level<0?`<span class="armor-empty ${extra}" aria-label="未装备">◇</span>`:`<span class="armor-icon ${extra}" role="img" aria-label="${EQUIPMENT_MATERIALS[level]+EQUIPMENT_SLOTS[slot]}" style="background-position:${level*20}% ${slot*100/3}%"></span>`;
}
function equipmentCharacter(model,original=false){
  if(original)return `<img class="equipment-original" src="./equipment-assets/${model.gender==='女生'?'alex':'steve'}.png" alt="提供的人物原图">`;
  return '<div class="equipment-3d-host" data-equipment-model><p class="avatar-render-note">正在加载3D人物…</p></div>';
}
async function equipmentPage(){
  const view=$('view');view.innerHTML=sectionHeader('我的装备')+'<section id="equipment-page">正在读取金币与装备…</section>';
  const host=$('equipment-page');let model,slot=0,original=false,busy=false;
  async function act(body){if(busy)return;busy=true;host.querySelectorAll('button').forEach(b=>b.disabled=true);try{model=await api('equipment',body);if(host.isConnected)draw();}catch(error){notice(error.message);if(host.isConnected)draw();}finally{busy=false;}}
  function draw(){
    if(!host.isConnected)return;
    disposeEquipmentAvatar?.();
    const level=model.owned[slot],next=level+1,req=model.requirements[slot];
    const pending=model.milestones.reduce((n,m)=>n+(m.half&&!m.halfClaimed?20:0)+(m.full&&!m.fullClaimed?40:0),0);
    host.innerHTML=`<div class="equipment-summary"><strong><img src="./equipment-assets/coin.png" alt="金币"> 金币 ${model.balance}</strong><span>${model.population} 位居民</span><span>各部位独立升级 · 解锁后赠送皮革装备</span></div>
      <section class="rent-panel"><img src="./equipment-assets/rent-${model.rentClaimed?'open':'closed'}.png" alt="租金宝箱"><div><h2>今日租金 ${model.rent} 金币</h2><p>${model.rentClaimed?'今日已领取，明天完成任务后再来。':model.eligible?'学习任务已完成，可以领取租金。':'完成一套课程达90分，或成功复习5个到期词后领取。'}</p><small>20＋居民数÷10取整；每天一次，不补领离线日期。</small></div><button class="primary" id="collect-rent" ${!model.eligible||model.rentClaimed?'disabled':''}>${model.rentClaimed?'今日已领取':'领取今日租金'}</button></section>
      <div class="equipment-layout"><aside class="equipment-slots">${EQUIPMENT_SLOTS.map((name,i)=>`<button data-eq-slot="${i}" aria-pressed="${i===slot}">${armorIcon(i,model.equipped[i])}<span><b>${name}</b><small>${!model.unlocked[i]?'学习解锁':model.equipped[i]<0?'未装备':EQUIPMENT_MATERIALS[model.equipped[i]]+name}</small></span>${model.unlocked[i]?'':'🔒'}</button>`).join('')}</aside>
      <section class="equipment-avatar"><div class="equipment-avatar-stage ${original?'original-mode':'rendered-mode'}"><img class="equipment-plinth" src="./equipment-assets/plinth.png" alt="石台">${equipmentCharacter(model,original)}</div></section>
      <section class="equipment-upgrade panel"><h2>${EQUIPMENT_SLOTS[slot]}${model.unlocked[slot]?'升级':'解锁条件'}</h2>${model.unlocked[slot]?`<div class="equipment-compare"><div>${armorIcon(slot,level)}<p>已获得：${EQUIPMENT_MATERIALS[level]+EQUIPMENT_SLOTS[slot]}</p></div><span>→</span><div>${armorIcon(slot,Math.min(5,next))}<p>${next>5?'已达最高材质':'下一阶段：'+EQUIPMENT_MATERIALS[next]+EQUIPMENT_SLOTS[slot]}</p></div></div><p>${next>5?'全部升级已完成':`升级需要 <b>${EQUIPMENT_COSTS[next]}</b> 金币 · 当前 ${model.balance} 金币`}</p><button class="primary" id="upgrade-equipment" ${next>5||model.balance<EQUIPMENT_COSTS[next]?'disabled':''}>${next>5?'已是下界合金':'升级'+EQUIPMENT_SLOTS[slot]}</button>`:`<p>${slot===1?'自然拼读第二、第三册全部单元练习达标。':slot===2?'Starter 1 全部11个单元达标。':'四大时态各有至少一半课次达标，奇数向上取整。'}</p>${req.map(r=>`<label class="unlock-progress">${E(r.name)}：${r.passed}/${r.total||'暂无课次'}<progress max="${Math.max(1,r.total)}" value="${r.passed}"></progress></label>`).join('')}<p class="muted">达到条件后自动赠送皮革${EQUIPMENT_SLOTS[slot]}。达标指整套成绩90分及以上。</p>`}
      <h3>已拥有材质 · 点击换穿</h3><div class="equipment-materials">${EQUIPMENT_MATERIALS.map((m,i)=>`<button data-eq-level="${i}" ${i>level?'disabled':''} aria-pressed="${i===model.equipped[slot]}">${armorIcon(slot,i)}<small>${m}${i>level?' 🔒':''}</small></button>`).join('')}<button data-eq-level="-1" ${!model.unlocked[slot]?'disabled':''}>卸下</button></div></section></div>
      <details class="panel economy-ledger"><summary>金币记录</summary>${model.ledger.map(l=>`<p>${E(l.day)} · ${E(l.label)} <b>${l.amount>0?'+':''}${l.amount}</b></p>`).join('')||'<p>暂无金币流水。</p>'}</details>`;
    if(!original)mountEquipmentAvatar(host.querySelector('[data-equipment-model]'),model);
    $('collect-rent').onclick=()=>act({action:'rent'});
    host.querySelectorAll('[data-eq-slot]').forEach(b=>b.onclick=()=>{slot=Number(b.dataset.eqSlot);draw();});host.querySelectorAll('[data-eq-level]').forEach(b=>b.onclick=()=>act({action:'equip',slot,level:Number(b.dataset.eqLevel)}));
    if($('upgrade-equipment'))$('upgrade-equipment').onclick=()=>{popup(`<h2>确认升级${EQUIPMENT_SLOTS[slot]}</h2><p>花费 ${EQUIPMENT_COSTS[next]} 金币升级至${EQUIPMENT_MATERIALS[next]}，升级后仍可换穿已拥有的材质。</p><button class="primary" id="confirm-equipment-upgrade">确认升级</button>`);$('confirm-equipment-upgrade').onclick=()=>{$('popup').close();act({action:'upgrade',slot,from:level});};};
  }
  try{model=await api('equipment',{action:'read'});draw();}catch(error){if(host.isConnected)host.textContent=error.message;}
}
async function renderRentWidget(){
  const view=$('view'),marker=document.createElement('section');marker.className='home-rent-widget';marker.innerHTML='';view.prepend(marker);
  try{const m=await api('equipment',{action:'read'});if(!marker.isConnected)return;marker.innerHTML=`<img src="./equipment-assets/coin.png" alt=""><span>金币 <b>${m.balance}</b></span><span>今日租金 <b>${m.rent}</b> · ${m.rentClaimed?'已领取':m.eligible?'可领取':'完成学习任务后领取'}</span><a class="primary" href="#equipment">${m.rentClaimed?'我的装备':'收租与装备'}</a>`;}catch{}
}
