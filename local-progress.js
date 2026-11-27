const KEY = 'eric-practice-pages-v1';
const empty = () => ({version:1, lessons:{}, words:{}, awards:{}, cards:{}, runs:{}, climbs:{}, draws:{}, finishedCourses:{}, openedReviews:{}, passedCourses:{}, courseFloors:{}, drawDays:{}});
const localDay = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(new Date());
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeCount = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
const sum = values => values.reduce((a,b)=>a+b,0);
const cardTotal = state => sum(Object.values(state.cards));
const redeemedDrawCredits = state => Object.entries(state.redemptions||{}).filter(([digest,r])=>r.type==='draw'&&!state.awards[r.day+':course-redeem-'+digest]).reduce((n,[,r])=>n+r.amount,0);
const credits = state => Math.max(0, Object.keys(state.awards).length+redeemedDrawCredits(state)-cardTotal(state));
const has = (obj,key) => Object.hasOwn(obj,key);
function validateProgress(state) {
  if (!record(state) || state.version !== 1 || !['lessons','words','awards','cards'].every(k=>record(state[k]))) throw Error('这不是有效的练习进度文件。');
  for (const [id,result] of Object.entries(state.lessons)) {
    if (!has(LESSONS,id) || !record(result) || !safeCount(result.attempts) || !safeCount(result.best) || result.best > 300) throw Error('练习记录格式有误。');
  }
  for (const [word,result] of Object.entries(state.words)) {
    if (!/^[a-z][a-z' -]{0,60}$/i.test(word) || !record(result) || !safeCount(result.stage) || result.stage>5 || !datePattern.test(result.due) || (result.reviewed!==null && !datePattern.test(result.reviewed))) throw Error('单词记录格式有误。');
  }
  for(const entry of Object.values(state.words))if(entry.mastered!==undefined&&typeof entry.mastered!=='boolean')throw Error('单词掌握状态格式有误。');
  if(state.customWords!==undefined&&(!record(state.customWords)||Object.entries(state.customWords).some(([w,m])=>!/^[a-z][a-z' -]{0,60}$/i.test(w)||typeof m!=='string'||!m.trim()||m.length>300)))throw Error('自定义单词格式有误。');
  for (const [id,count] of Object.entries(state.cards)) {
    if (!CARDS.some(c=>c.id===id) || !safeCount(count)) throw Error('卡片记录格式有误。');
  }
  for (const [key,value] of Object.entries(state.awards)) {
    const [day,kind,...rest] = key.split(':');
    if (rest.length || !datePattern.test(day) || !(kind==='words' || has(LESSONS,kind) || /^course-[a-z0-9-]{1,80}$/.test(kind)) || value!==true) throw Error('抽卡机会格式有误。');
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
    if(rest.length||!datePattern.test(day)||!(id==='words'||has(LESSONS,id))||value!==true) throw Error('楼层记录格式有误。');
  }
  for (const [request,card] of Object.entries(state.draws||{})) {
    if(!request||request.length>100||!CARDS.some(c=>c.id===card)||!state.cards[card]) throw Error('抽卡记录格式有误。');
  }
  if(has(state,'finishedCourses')&&(!record(state.finishedCourses)||Object.entries(state.finishedCourses).some(([id,value])=>!courseIdPattern.test(id)||value!==true))) throw Error('课次完成记录格式有误。');
  if(has(state,'openedReviews')&&(!record(state.openedReviews)||Object.entries(state.openedReviews).some(([id,version])=>!courseIdPattern.test(id)||!Number.isSafeInteger(version)||version<1))) throw Error('复习解锁记录格式有误。');
  for(const prop of ['passedCourses','courseFloors','drawDays'])if(has(state,prop)&&!record(state[prop]))throw Error('奖励记录格式有误。');
  for(const [id,value] of Object.entries(state.passedCourses||{}))if(!courseIdPattern.test(id)||value!==true)throw Error('达标记录格式有误。');
  for(const [key,count] of Object.entries(state.courseFloors||{})){
    const [day,category,...rest]=key.split(':');
    if(rest.length||!datePattern.test(day)||!has(LESSONS,category)||!safeCount(count))throw Error('建楼记录格式有误。');
  }
  for(const [id,day] of Object.entries(state.drawDays||{}))if(!has(state.draws||{},id)||!datePattern.test(day))throw Error('抽卡日期格式有误。');
  if(state.redemptions!==undefined&&(!record(state.redemptions)||Object.entries(state.redemptions).some(([digest,r])=>!/^([a-f0-9]{64})$/.test(digest)||!record(r)||!datePattern.test(r.day)||!((r.type==='coins'&&r.amount===30)||(r.type==='draw'&&r.amount===1)))))throw Error('兑换记录格式有误。');
  if (cardTotal(state) > Object.keys(state.awards).length+redeemedDrawCredits(state)) throw Error('收藏和抽卡机会不一致。');
  if(state.economy&&typeof validateEconomy==='function')validateEconomy(state.economy);
  return state;
}
const READ_PASS_SCORE=80;
const DAILY_DRAW_LIMIT=4;
function coursePercentage(results,total){return total?countCorrect(results)/total*100:0;}
function dailyAwards(progress,day){return Object.keys(progress.awards).filter(key=>key.startsWith(day+':')&&!key.startsWith(day+':course-redeem-')).length;}
function grantAward(progress,day,id){
  const key=taskKey(day,id);
  if(['phonics','grammar','starter'].includes(id)&&Object.keys(progress.awards).some(k=>{if(!k.startsWith(day+':course-'))return false;return courseList().some(c=>'course-'+c.id===k.slice(11)&&c.category===id);}))return false;
  if(progress.awards[key]||dailyAwards(progress,day)>=DAILY_DRAW_LIMIT)return false;
  progress.awards[key]=true;return true;
}
function drawsToday(progress,day){return Object.values(progress.drawDays).filter(value=>value===day).length;}
function coursePassed(progress,course){
  if(progress.passedCourses[course.id])return true;
  return Object.entries(progress.runs).some(([key,results])=>key.slice(11)===runKey('',course).slice(1)&&
    results.length===course.questions.length&&coursePercentage(results,course.questions.length)>=90);
}
function scored(lesson) {return lesson.questions;}
function countCorrect(results){return results.filter(r=>r.correct===true||r.matches===true).length;}
function restoreMissedScores(progress){
  const courses=new Map(courseList().map(course=>[runKey('',course).slice(1),course]));
  let changed=false;
  for(const [key,results] of Object.entries(progress.runs)){
    if(!results.some(r=>r.matches===true&&r.correct!==true))continue;
    const course=courses.get(key.slice(11));
    if(!course||results.length!==course.questions.length)continue;
    const correct=countCorrect(results);
    const stats=progress.lessons[course.category]||{attempts:1,best:0};
    if(stats.best<correct){progress.lessons[course.category]={...stats,best:correct};changed=true;}
  }
  if(changed)saveProgress(progress);
  return progress;
}
function progressKey(){const profile=currentProfile();return profile?KEY+':'+profile.id:KEY;}
function readProgress() {
  try {
    const stored=JSON.parse(localStorage.getItem(progressKey()));
    return stored ? migrateRetiredWords(restoreMissedScores({...empty(),...validateProgress(stored)})) : empty();
  } catch {return empty();}
}
function migrateRetiredWords(progress){
  const retired=typeof WORD_RETIRED_DATA==='object'?WORD_RETIRED_DATA:{};
  let changed=false;
  for(const word of Object.keys(progress.words)){
    if(retired[word]&&!Object.hasOwn(WORD_DATA[0],word)&&!Object.hasOwn(progress.customWords||{},word)){
      progress.customWords={...progress.customWords,[word]:retired[word].meaning};changed=true;
    }
  }
  if(changed)saveProgress(progress);
  return progress;
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
function courseFinished(progress,course){
  if(has(progress.finishedCourses,course.id))return true;
  return Object.entries(progress.runs).some(([key,results])=>{
    const id=key.slice(11);
    if(id===course.id||id===runKey('',course).slice(1))return results.length>=course.questions.length;
    return id.startsWith(course.id+'-v')&&/^\d+$/.test(id.slice(course.id.length+2))&&results.at(-1)?.completed===true;
  });
}
function practiceUnlocked(progress,course){
  return progress.openedReviews[course.id]===course.version||courseFinished(progress,course)||
    Object.entries(progress.runs).some(([key,results])=>key.slice(11)===runKey('',course).slice(1)&&results.length>0);
}
function localModule(progress,course,day) {
  const task={...course,date:day};
  const results=progress.runs[runKey(day,course)]||[];
  const key=taskKey(day,course.category);
  return {key:course.id,category:course.category,label:MODULES[course.category],task,results,
    completed:results.length>=task.questions.length,finishedBefore:courseFinished(progress,course),climbed:!!(progress.climbs[key]||progress.awards[key])};
}
function localBook(progress,day){
  const words=Object.entries(progress.words).map(([word,info])=>({word,...info}));
  return {words,day,intervals,due:words.filter(w=>w.due<=day).length,
    added:words.filter(w=>w.added===day&&w.source!=='import'&&Object.hasOwn(WORD_DATA[0],w.word)).length,imported:words.filter(w=>w.added===day&&w.source==='import').length,reviewed:words.filter(w=>w.reviewed===day).length,
    climbed:!!progress.climbs[taskKey(day,'words')]};
}
function cardCatalog(progress) {
  return CARDS.map(card=>{
    const quantity=progress.cards[card.id]||0;
    return quantity?{...card,quantity,image:'./cards/'+card.id+'.png',back:'./cards/'+card.id+'-back.png',url:'./cards/'+card.id+'.html'}:{quantity:0};
  });
}
function localCollection(progress) {
  const remaining=Math.max(0,DAILY_DRAW_LIMIT-drawsToday(progress,localDay()));
  return {available:Math.min(credits(progress),remaining),banked:credits(progress),remaining,total:cardTotal(progress),cards:cardCatalog(progress)};
}
const CARD_WEIGHT_SCALE = 100;
function pickLocalCard(roll) {
  for(const card of CARDS){roll-=Math.round(card.weight*CARD_WEIGHT_SCALE);if(roll<0)return card;}
  throw Error('卡池概率设置有误。');
}
function conflict(message) {
  return Object.assign(new Error(message),{status:409});
}
function speechEndpoint(){
  try{
    const url=new URL(globalThis.ERIC_SPEECH_ENDPOINT);
    return location.protocol==='https:'&&url.protocol==='https:'&&!url.username&&!url.password
      ?new URL('/assess',url):null;
  }catch{return null;}
}
async function assessmentReady(){
  // A separate health request can time out even when an assessment request succeeds.
  // Keep submission available whenever the HTTPS endpoint is configured.
  return Boolean(speechEndpoint()&&location.hash.endsWith('/practice'));
}
async function assessSpeech(text,audio){
  const endpoint=speechEndpoint();
  if(!endpoint)throw Error('发音评测尚未配置。');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text,audio}),signal:controller.signal});
    let data;
    try{data=await response.json();}
    catch(error){
      if(controller.signal.aborted)throw error;
      throw Error('评测服务返回了无法读取的结果，请重新提交。');
    }
    if(!response.ok)throw Error(data?.error||'评测请求失败（HTTP '+response.status+'）。');
    if(!Number.isFinite(data?.scores?.total)||data.scores.total<0||data.scores.total>100)
      throw Error('没有收到有效的评测分数。');
    return data.scores;
  }catch(error){
    if(controller.signal.aborted)throw Error('评测连接超过 45 秒，请检查网络后重新提交。');
    if(error instanceof TypeError)throw Error('无法连接评测服务，请检查网络连接后重新提交。');
    throw error;
  }finally{clearTimeout(timeout);}
}

async function localAPI(path,body) {
  const [route]=path.split('?');
  const day=localDay(), progress=readProgress();
  switch(route) {
    case 'equipment':return equipmentAction(progress,body||{action:'read'});
    case 'state':{
      const book=localBook(progress,day);
      const user=currentProfile();
      const modules=Object.entries(MODULES).map(([key,label])=>({key,label,climbed:!!(progress.courseFloors[taskKey(day,key)]||progress.climbs[taskKey(day,key)]||progress.awards[taskKey(day,key)])}));
      return {day,user,rank:user?[{...user,floor:cityFloorCount(progress)}]:[],speechReady:await assessmentReady(),
        modules,todayFloors:sum(Object.entries(progress.courseFloors).filter(([key])=>key.startsWith(day+':')).map(([,count])=>count)),dailyDraws:drawsToday(progress,day),vocabulary:book.added,wordReview:{reviewed:book.reviewed,climbed:book.climbed}};
    }
    case 'open-review':{
      const course=findCourse(body.module);
      if(!course)throw Error('课次不存在。');
      if(progress.openedReviews[course.id]!==course.version){
        progress.openedReviews[course.id]=course.version;
        persist(progress);
      }
      return {};
    }
    case 'retry-practice':{
      const course=findCourse(body.module);
      if(!course)throw Error('课次不存在。');
      if(courseFinished(progress,course))progress.finishedCourses[course.id]=true;
      if(coursePassed(progress,course))progress.passedCourses[course.id]=true;
      delete progress.runs[runKey(day,course)];
      persist(progress);
      return {};
    }
    case 'question':{
      const course=findCourse(body.module);
      if(body.day!==day || !course || body.version!==course.version) throw conflict('课次已更新，请刷新。');
      if(!practiceUnlocked(progress,course))throw conflict('请先打开本课复习。');
      const module=localModule(progress,course,day);
      const q=module.task.questions[body.index];
      if(!q||body.index!==module.results.length) throw conflict('练习进度已变化，请刷新。');
      const result={explanation:q.explanation};
      if(q.kind==='choice') {
        if(!Number.isInteger(body.choice)||body.choice<0||body.choice>=q.choices.length) throw Error('请选择一个答案。');
        Object.assign(result,{correct:body.choice===q.answer,answer:q.answer});
      } else if(q.kind==='check'){
        const matches=String(body.response||'').trim().toLowerCase()===q.reference.trim().toLowerCase();
        Object.assign(result,{matches,correct:matches,reference:q.reference});
      } else if(q.kind==='read'){
        if(body.skip===true){
          Object.assign(result,{correct:false,skipped:true});
        }else{
          if(!body.audio||!speechEndpoint())throw Error('请先完成录音并提交评测，或选择跳过。');
          result.scores=await assessSpeech(q.prompt,body.audio);
          result.correct=result.scores.total>=READ_PASS_SCORE;
          // A low score stays on this question so another recording can be assessed.
          if(!result.correct)return {result,retry:true,completed:false,correctCount:countCorrect(module.results),earned:false};
          const latest=readProgress();
          const current=localModule(latest,course,day);
          if(current.results.length!==body.index||localDay()!==day)throw conflict('练习进度已变化，请刷新。');
          Object.assign(progress,latest);
        }
      }
      const passedBefore=coursePassed(progress,course);
      const key=taskKey(day,course.category);
      const results=[...module.results,result];
      const completed=results.length===module.task.questions.length;
      const correctCount=countCorrect(results);
      result.completed=completed;
      progress.runs[runKey(day,course)]=results;
      let earned=false;
      const percentage=coursePercentage(results,course.questions.length);
      const passed=completed&&percentage>=90;
      result.passed=passed;
      if(passed&&!course.testOnly&&typeof syncEconomy==='function'){syncEconomy(progress);progress.economy.taskDays[day]=true;}
      result.newFloor=passed&&!passedBefore&&!course.testOnly;
      result.percentage=percentage;
      if(completed&&!course.testOnly) {
        progress.finishedCourses[course.id]=true;
        if(passed&&!passedBefore){
          progress.city=citySettings(progress);
          progress.courseFloors[key]=(progress.courseFloors[key]||0)+1;
          progress.passedCourses[course.id]=true;
        }
        const old=progress.lessons[course.category]||{attempts:0,best:0};
        progress.lessons[course.category]={attempts:old.attempts+1,best:Math.max(old.best,correctCount)};
        if(!passedBefore&&passed)earned=grantAward(progress,day,course.category);
      }
      if(earned)result.earned=true;
      persist(progress);
      return {result,completed,correctCount,earned,passed,percentage};
    }
    case 'words':{
      if(!body) return localBook(progress,day);
      const [dictionary]=WORD_DATA;
      let selected=[body.word];
      if(body.random) {
        const available=WORD_FREQUENCY.filter(word=>!has(progress.words,word));
        const limit=Math.max(0,5-localBook(progress,day).added);
        selected=available.slice(0,limit);
      }
      for(const word of selected){
        if(!has(dictionary,word)) throw Error('词库里没有这个单词。');
        if(!has(progress.words,word)) progress.words[word]={stage:0,due:day,reviewed:null,added:day};
      }
      persist(progress);
      return localBook(progress,day);
    }
    case 'word-import':{
      if(!Array.isArray(body?.entries)||!body.entries.length||body.entries.length>1000)throw Error('请一次导入1至1000个单词。');
      const dictionary=WORD_DATA[0],entries=body.entries.map(r=>({word:String(r.word||'').trim().toLowerCase(),meaning:String(r.meaning||'').trim()}));
      for(const r of entries){if(!/^[a-z][a-z' -]{0,60}$/i.test(r.word))throw Error('单词格式有误：'+r.word);if(!r.meaning)r.meaning=dictionary[r.word]||'';if(!r.meaning||r.meaning.length>300)throw Error('请填写中文释义：'+r.word);}
      let added=0;progress.customWords={...progress.customWords};
      for(const {word,meaning}of entries){progress.customWords[word]=meaning;if(!has(progress.words,word)){progress.words[word]={stage:0,due:day,reviewed:null,added:day,source:'import'};added++;}}
      persist(progress);return {added,existing:entries.length-added};
    }
    case 'word-mastery':return a4SetSelfKnown(progress,day,body.word,body.mastered===true);
    case 'a4':return a4Action(progress,day,body||{});
    case 'words-review':{
      const {word,stage,known}=body;
      const result=applyA4WordReview(progress,day,word,stage,known);persist(progress);return result;
    }
    case 'collection':return localCollection(progress);
    case 'draw':{
      if(typeof body.requestId!=='string'||!body.requestId||body.requestId.length>100) throw Error('抽卡请求格式有误。');
      let id=has(progress.draws,body.requestId)?progress.draws[body.requestId]:null;
      if(!id) {
        if(drawsToday(progress,day)>=DAILY_DRAW_LIMIT)throw conflict('今日已抽卡 4 次，明天再来。');
        if(!credits(progress)) throw conflict('暂无抽卡次数。');
        id=pickLocalCard(Math.floor(Math.random()*100*CARD_WEIGHT_SCALE)).id;
        progress.draws={...progress.draws,[body.requestId]:id};
        progress.drawDays[body.requestId]=day;
        progress.cards[id]=(progress.cards[id]||0)+1;
        persist(progress);
      }
      const result=localCollection(progress);
      return {...result,card:result.cards.find(c=>c.id===id)};
    }
    default:throw Error('此功能需要完整版。');
  }
}

function applyA4WordReview(progress,day,word,stage,known){
      const entry=progress.words[word];
      if(!has(progress.words,word)||entry.stage!==stage||entry.due>day) throw conflict('该词的复习进度已变化。');
      let newFloor=false;
      if(known){
        const due=new Date(day+'T00:00:00Z');
        due.setUTCDate(due.getUTCDate()+(entry.mastered?14:intervals[entry.stage]));
        entry.due=due.toISOString().slice(0,10);
        entry.stage=Math.min(entry.stage+1,intervals.length-1);
        entry.reviewed=day;
        if(localBook(progress,day).reviewed>=5){
          const key=taskKey(day,'words');
          grantAward(progress,day,'words');
          if(!progress.climbs[key]){
            progress.city=citySettings(progress);
            progress.climbs[key]=true;
            newFloor=true;
          }
        }
      }
      if(!known){entry.mastered=false;entry.stage=0;entry.due=day;delete entry.masterySource;delete entry.masteredOn;}
      return {due:entry.due,newFloor};
}
