const KEY = 'eric-practice-pages-v1';
const empty = () => ({version:1, lessons:{}, words:{}, awards:{}, cards:{}, runs:{}, climbs:{}, draws:{}});
const localDay = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(new Date());
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeCount = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
const sum = values => values.reduce((a,b)=>a+b,0);
const cardTotal = state => sum(Object.values(state.cards));
const credits = state => Math.max(0, Object.keys(state.awards).length-cardTotal(state));
const has = (obj,key) => Object.hasOwn(obj,key);
function validateProgress(state) {
  if (!record(state) || state.version !== 1 || !['lessons','words','awards','cards'].every(k=>record(state[k]))) throw Error('这不是有效的练习进度文件。');
  for (const [id,result] of Object.entries(state.lessons)) {
    if (!has(LESSONS,id) || !record(result) || !safeCount(result.attempts) || !safeCount(result.best) || result.best > 300) throw Error('练习记录格式有误。');
  }
  for (const [word,result] of Object.entries(state.words)) {
    if (!/^[a-z][a-z' -]{0,60}$/i.test(word) || !record(result) || !safeCount(result.stage) || result.stage>5 || !datePattern.test(result.due) || (result.reviewed!==null && !datePattern.test(result.reviewed))) throw Error('单词记录格式有误。');
  }
  for (const [id,count] of Object.entries(state.cards)) {
    if (!CARDS.some(c=>c.id===id) || !safeCount(count)) throw Error('卡片记录格式有误。');
  }
  for (const [key,value] of Object.entries(state.awards)) {
    const [day,kind,...rest] = key.split(':');
    if (rest.length || !datePattern.test(day) || !(kind==='words' || has(LESSONS,kind)) || value!==true) throw Error('抽卡机会格式有误。');
  }
  for (const prop of ['runs','climbs','draws']) {
    if (has(state,prop) && !record(state[prop])) throw Error('进度记录格式有误。');
  }
  for (const [key,results] of Object.entries(state.runs||{})) {
    const [day,id,...rest]=key.split(':');
    if(rest.length||!datePattern.test(day)||!/^[a-z0-9-]{1,90}$/.test(id)||!Array.isArray(results)||
      results.length>300||!results.every(record)) throw Error('答题记录格式有误。');
  }
  for (const [key,value] of Object.entries(state.climbs||{})) {
    const [day,id,...rest]=key.split(':');
    if(rest.length||!datePattern.test(day)||!has(LESSONS,id)||value!==true) throw Error('楼层记录格式有误。');
  }
  for (const [request,card] of Object.entries(state.draws||{})) {
    if(!request||request.length>100||!CARDS.some(c=>c.id===card)||!state.cards[card]) throw Error('抽卡记录格式有误。');
  }
  if (cardTotal(state) > Object.keys(state.awards).length) throw Error('收藏和抽卡机会不一致。');
  return state;
}
function scored(lesson) {return lesson.questions.filter(q=>q.kind!=='read');}
function progressKey(){const profile=currentProfile();return profile?KEY+':'+profile.id:KEY;}
function readProgress() {
  try {
    const stored=JSON.parse(localStorage.getItem(progressKey()));
    return stored ? {...empty(),...validateProgress(stored)} : empty();
  } catch {return empty();}
}
function saveProgress(next) {
  try {localStorage.setItem(progressKey(),JSON.stringify(next));return true;}
  catch {return false;}
}
function persist(next) {
  if(!saveProgress(next)) throw Error('无法保存。请检查浏览器存储权限。');
}
const intervals=[1,2,4,7,14,30];
const taskKey=(day,id)=>day+':'+id;
const runKey=(day,course)=>taskKey(day,course.id+(course.version===1?'':'-v'+course.version));
function localModule(progress,course,day) {
  const task={...course,date:day};
  const results=progress.runs[runKey(day,course)]||[];
  const key=taskKey(day,course.category);
  return {key:course.id,category:course.category,label:MODULES[course.category],task,results,
    completed:results.length>=task.questions.length,climbed:!!(progress.climbs[key]||progress.awards[key])};
}
function localBook(progress,day){
  const words=Object.entries(progress.words).map(([word,info])=>({word,...info}));
  return {words,day,intervals,due:words.filter(w=>w.due<=day).length,
    added:words.filter(w=>w.added===day).length,reviewed:words.filter(w=>w.reviewed===day).length};
}
function cardCatalog(progress) {
  return CARDS.map(card=>{
    const quantity=progress.cards[card.id]||0;
    return quantity?{...card,quantity,image:'./cards/'+card.id+'.png',back:'./cards/'+card.id+'-back.png',url:'./cards/'+card.id+'.html'}:{quantity:0};
  });
}
function localCollection(progress) {
  return {available:credits(progress),total:cardTotal(progress),cards:cardCatalog(progress)};
}
function pickLocalCard(roll) {
  for(const card of CARDS){roll-=card.weight;if(roll<0)return card;}
  throw Error('卡池概率设置有误。');
}
function conflict(message) {
  return Object.assign(new Error(message),{status:409});
}
async function localAPI(path,body) {
  const [route]=path.split('?');
  const day=localDay(), progress=readProgress();
  switch(route) {
    case 'state':{
      const completedKeys=new Set([...Object.keys(progress.climbs),...Object.keys(progress.awards).filter(k=>!k.endsWith(':words'))]);
      const user=currentProfile();
      const modules=Object.keys(MODULES).map(id=>localModule(progress,findCourse(id),day));
      return {day,user,rank:user?[{...user,floor:completedKeys.size}]:[],speechReady:false,
        modules,vocabulary:localBook(progress,day).added};
    }
    case 'retry-practice':{
      const course=findCourse(body.module);
      if(!course)throw Error('课次不存在。');
      delete progress.runs[runKey(day,course)];
      persist(progress);
      return {};
    }
    case 'question':{
      const course=findCourse(body.module);
      if(body.day!==day || !course || body.version!==course.version) throw conflict('课次已更新，请刷新。');
      const module=localModule(progress,course,day);
      const q=module.task.questions[body.index];
      if(!q||body.index!==module.results.length) throw conflict('练习进度已变化，请刷新。');
      const result={explanation:q.explanation};
      if(q.kind==='choice') {
        if(!Number.isInteger(body.choice)||body.choice<0||body.choice>=q.choices.length) throw Error('请选择一个答案。');
        Object.assign(result,{correct:body.choice===q.answer,answer:q.answer});
      } else if(q.kind==='check'){
        const matches=String(body.response||'').trim().toLowerCase()===q.reference.trim().toLowerCase();
        Object.assign(result,{matches,reference:q.reference});
      } else if(q.kind==='read'&&!body.selfCheck) throw Error('请先完成跟读。');
      const key=taskKey(day,course.category);
      const results=[...module.results,result];
      const completed=results.length===module.task.questions.length;
      const correctCount=results.filter(r=>r.correct).length;
      progress.runs[runKey(day,course)]=results;
      if(completed) {
        progress.climbs[key]=true;
        const old=progress.lessons[course.category]||{attempts:0,best:0};
        progress.lessons[course.category]={attempts:old.attempts+1,best:Math.max(old.best,correctCount)};
        if(correctCount>=9) progress.awards[key]=true;
      }
      persist(progress);
      return {result,completed,correctCount};
    }
    case 'words':{
      if(!body) return localBook(progress,day);
      const [dictionary]=WORD_DATA;
      let selected=[body.word];
      if(body.random) {
        const available=Object.keys(dictionary).filter(w=>!has(progress.words,w));
        const limit=Math.min(available.length,Math.max(0,5-localBook(progress,day).added));
        for(let i=0;i<limit;i++){
          const j=i+Math.floor(Math.random()*(available.length-i));
          [available[i],available[j]]=[available[j],available[i]];
        }
        selected=available.slice(0,limit);
      }
      for(const word of selected){
        if(!has(dictionary,word)) throw Error('词库里没有这个单词。');
        if(!has(progress.words,word)) progress.words[word]={stage:0,due:day,reviewed:null,added:day};
      }
      persist(progress);
      return localBook(progress,day);
    }
    case 'words-review':{
      const {word,stage,known}=body;
      const entry=progress.words[word];
      if(!has(progress.words,word)||entry.stage!==stage||entry.due>day) throw conflict('该词的复习进度已变化。');
      if(known){
        const due=new Date(day+'T00:00:00Z');
        due.setUTCDate(due.getUTCDate()+intervals[entry.stage]);
        entry.due=due.toISOString().slice(0,10);
        entry.stage=Math.min(entry.stage+1,intervals.length-1);
        entry.reviewed=day;
        if(localBook(progress,day).reviewed>=5) progress.awards[taskKey(day,'words')]=true;
      }
      persist(progress);
      return {due:entry.due};
    }
    case 'collection':return localCollection(progress);
    case 'draw':{
      if(typeof body.requestId!=='string'||!body.requestId||body.requestId.length>100) throw Error('抽卡请求格式有误。');
      let id=has(progress.draws,body.requestId)?progress.draws[body.requestId]:null;
      if(!id) {
        if(!credits(progress)) throw conflict('暂无抽卡次数。');
        id=pickLocalCard(Math.floor(Math.random()*100)).id;
        progress.draws={...progress.draws,[body.requestId]:id};
        progress.cards[id]=(progress.cards[id]||0)+1;
        persist(progress);
      }
      const result=localCollection(progress);
      return {...result,card:result.cards.find(c=>c.id===id)};
    }
    default:throw Error('此功能需要完整版。');
  }
}
