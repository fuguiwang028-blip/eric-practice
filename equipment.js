const EQUIPMENT_SLOTS=['头盔','胸甲','护腿','靴子'];
const EQUIPMENT_MATERIALS=['皮革','锁链','铁','金','钻石','下界合金'];
const EQUIPMENT_COSTS=[0,120,240,480,960,1920];
function initialEconomy(){return {version:1,balance:0,owned:[0,-1,-1,-1],equipped:[0,-1,-1,-1],unlocked:[true,false,false,false],rents:{},milestones:{},taskDays:{},scopes:{},ledger:[]};}
function validateEconomy(e){
  if(!record(e)||e.version!==1||!safeCount(e.balance))throw Error('金币档案格式有误。');
  for(const n of ['owned','equipped'])if(!Array.isArray(e[n])||e[n].length!==4||e[n].some(x=>!Number.isInteger(x)||x< -1||x>5))throw Error('装备档案格式有误。');
  if(!Array.isArray(e.unlocked)||e.unlocked.length!==4||e.unlocked.some(x=>typeof x!=='boolean'))throw Error('装备解锁记录有误。');
  for(let i=0;i<4;i++)if(e.equipped[i]>e.owned[i]||(!e.unlocked[i]&&e.owned[i]!==-1))throw Error('装备状态不一致。');
  for(const n of ['rents','milestones','taskDays','scopes'])if(!record(e[n]))throw Error('金币记录格式有误。');
  if(Object.entries(e.rents).some(([d,v])=>!datePattern.test(d)||!safeCount(v))||Object.entries(e.taskDays).some(([d,v])=>!datePattern.test(d)||v!==true)||Object.values(e.milestones).some(v=>v!==true))throw Error('金币领取记录有误。');
  if(Object.values(e.scopes).some(s=>!record(s)||typeof s.name!=='string'||!Array.isArray(s.ids)||!s.ids.length||!s.ids.every(id=>typeof id==='string'&&courseIdPattern.test(id))))throw Error('学习里程碑记录有误。');
  if(!Array.isArray(e.ledger)||e.ledger.some(l=>!record(l)||!datePattern.test(l.day)||!Number.isSafeInteger(l.amount)||typeof l.label!=='string'))throw Error('金币流水格式有误。');
  return e;
}
function economyPool(){const pool=new Map;for(const c of [...(globalThis.ERIC_PUBLISHED_COURSES||[]),...courseList()])if(c?.id&&!c.testOnly)pool.set(c.id,c);return [...pool.values()];}
function economyPassed(p,id,pool){return p.passedCourses?.[id]===true||!!pool.find(c=>c.id===id&&coursePassed(p,c));}
function syncEconomy(p){
  p.economy=p.economy||initialEconomy();const e=p.economy,pool=economyPool();
  const groups=new Map;
  for(const c of pool){
    const unit=c.title.match(/(?:Unit\s*|\bU)(\d{1,2})\b/i);
    let key,name;
    if(c.category==='phonics'&&unit){key='unit|'+c.folder+'|'+Number(unit[1]);name=c.folder+' · Unit '+Number(unit[1]);}
    else if(c.category==='starter'&&unit){key='unit|'+c.folder+'|'+Number(unit[1]);name=c.folder+' · Unit '+Number(unit[1]);}
    else if(c.category==='grammar'){key='grammar|'+(c.folder||'未分组');name=c.folder||'未分组';}
    else continue;
    if(!groups.has(key))groups.set(key,{name,ids:[]});groups.get(key).ids.push(c.id);
  }
  // Freeze membership for existing scopes so future imports do not take earned progress away.
  for(const [key,scope]of groups)if(!Object.hasOwn(e.scopes,key))e.scopes[key]=scope;
  const requirement=(key,name,items)=>{if(!e.scopes[key]&&items.length)e.scopes[key]={name,ids:items.map(c=>c.id)};const ids=e.scopes[key]?.ids||[];return {name,total:ids.length,passed:ids.filter(id=>economyPassed(p,id,pool)).length};};
  const b2=requirement('unlock-book2','自然拼读第二册',pool.filter(c=>c.category==='phonics'&&/第二册/.test(c.folder||'')&&/(?:Unit\s*|\bU)\d+/i.test(c.title)));
  const b3=requirement('unlock-book3','自然拼读第三册',pool.filter(c=>c.category==='phonics'&&/第三册/.test(c.folder||'')&&/(?:Unit\s*|\bU)\d+/i.test(c.title)));
  const starter=requirement('unlock-starter1','Starter 1',pool.filter(c=>c.category==='starter'&&/Starter\s*1/i.test(c.folder||'')&&/Unit\s*\d+/i.test(c.title)));
  const tenses=['一般现在时','现在进行时','一般过去时','一般将来时'].map(n=>requirement('unlock-'+n,n,pool.filter(c=>c.category==='grammar'&&(c.folder||'').startsWith(n))));
  const all=r=>r.total>0&&r.passed>=r.total,half=r=>r.total>0&&r.passed>=Math.ceil(r.total/2);
  const conditions=[true,all(b2)&&all(b3),all(starter),tenses.every(half)];
  conditions.forEach((ok,i)=>{if(ok&&!e.unlocked[i]){e.unlocked[i]=true;e.owned[i]=Math.max(0,e.owned[i]);e.equipped[i]=Math.max(0,e.equipped[i]);}});
  return {e,pool,requirements:[[],[b2,b3],[starter],tenses]};
}
function equipmentModel(p){
  const {e,pool,requirements}=syncEconomy(p),day=localDay();
  const milestones=Object.entries(e.scopes).filter(([key])=>key.startsWith('unit|')||key.startsWith('grammar|')).map(([key,s])=>{const passed=s.ids.filter(id=>economyPassed(p,id,pool)).length,total=s.ids.length;return {key,name:s.name,total,passed,half:passed>=Math.ceil(total/2),full:passed===total,halfClaimed:!!e.milestones[key+'|half'],fullClaimed:!!e.milestones[key+'|full']};});
  const eligible=!!e.taskDays[day]||Object.entries(p.runs).some(([key,rs])=>key.startsWith(day+':')&&pool.some(c=>key===runKey(day,c)&&rs.length===c.questions.length&&coursePercentage(rs,c.questions.length)>=90))||localBook(p,day).reviewed>=5;
  const population=cityPopulation(citySettings(p),cityFloorCount(p));
  return {balance:e.balance,owned:e.owned,equipped:e.equipped,unlocked:e.unlocked,requirements,milestones,population,rent:20+Math.floor(population/10),eligible,rentClaimed:Object.hasOwn(e.rents,day),ledger:e.ledger.slice(-50).reverse(),gender:currentProfile()?.gender||'未设置',day};
}
function economyTransaction(p,amount,label){const e=p.economy;if(e.balance+amount<0)throw Error('金币不足，请先领取租金或里程碑奖励。');if(!safeCount(e.balance+amount))throw Error('金币超出可保存范围。');e.balance+=amount;e.ledger.push({day:localDay(),amount,label});}
function equipmentAction(p,body){
  const model=equipmentModel(p),e=p.economy,day=localDay();
  if(body.action==='rent'){
    if(!model.eligible)throw Error('今天先完成一套课程达90分，或成功复习5个到期词，再来收租。');
    if(!model.rentClaimed){economyTransaction(p,model.rent,'每日租金 · '+model.population+'位居民');e.rents[day]=model.rent;}
  }else if(body.action==='milestone'){
    const m=model.milestones.find(m=>m.key===body.key),tier=body.tier;
    if(!m||!['half','full'].includes(tier)||!m[tier])throw Error('请先达到对应学习进度。');
    if(!m[tier+'Claimed']){economyTransaction(p,tier==='half'?20:40,m.name+(tier==='half'?' · 过半奖励':' · 全通奖励'));e.milestones[m.key+'|'+tier]=true;}
  }else if(body.action==='upgrade'){
    const i=body.slot;if(!Number.isInteger(i)||i<0||i>3||!e.unlocked[i])throw Error('请先完成学习条件，解锁这个装备部位。');
    if(body.from!==e.owned[i])throw Error('装备进度已变化，请重新确认。');
    const next=e.owned[i]+1;if(next>5)throw Error('已经是最高材质。');
    economyTransaction(p,-EQUIPMENT_COSTS[next],EQUIPMENT_SLOTS[i]+'升级为'+EQUIPMENT_MATERIALS[next]);e.owned[i]=next;e.equipped[i]=next;
  }else if(body.action==='equip'){
    const {slot,level}=body;if(!Number.isInteger(slot)||slot<0||slot>3||!Number.isInteger(level)||level< -1||level>e.owned[slot])throw Error('还没有获得这件装备。');e.equipped[slot]=level;
  }else if(body.action!=='read')throw Error('未知装备操作。');
  persist(p);return equipmentModel(p);
}
