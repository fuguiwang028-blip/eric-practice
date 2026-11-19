const courseIdPattern=/^[a-z0-9-]{1,80}$/;
const COURSE_DELETIONS_KEY='eric-pages-course-deletions-v1';
const COURSE_DRAFTS_KEY='eric-pages-course-drafts-v1';
function normalizeCourse(input,category){
  if(!input||typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(MODULES,category))throw Error('课程格式有误。');
  const title=String(input.title||'').trim();
  const board=String(input.board||input.lessonBrief||'').trim();
  if(!title||title.length>150||board.length>50000||!Array.isArray(input.questions)||!input.questions.length||input.questions.length>300) throw Error('课程需要标题和 1–300 道题。');
  const folder=String(input.folder||'').trim();
  if(folder.length>80)throw Error('目录名称最多 80 个字。');
  const boards=input.boards??[];
  if(!Array.isArray(boards)||boards.length>60||boards.some(path=>!validBoard(path)))throw Error('复习图片地址有误，每课最多 60 张。');
  const questions=input.questions.map((q,i)=>{
    const prompt=String(q?.prompt||'').trim(), explanation=String(q?.explanation||'').trim();
    const bonus=Boolean(q?.bonus||q?.penalty);
    if(!prompt||prompt.length>4000||explanation.length>10000) throw Error('第 '+(i+1)+' 题内容有误。');
    const audio=String(q.audio||'').trim();
    if(audio&&!validReadAudio(audio))throw Error('第 '+(i+1)+' 题音频地址需为 HTTPS 或以 ./ 开头的音频文件。');
    if(q.kind==='read'){
      return {kind:'read',prompt,explanation,bonus,...(audio?{audio}:{})};
    }
    if(q.kind==='choice'){
      if(!Array.isArray(q.choices)||q.choices.length<2||q.choices.length>8||q.choices.some(c=>typeof c!=='string'||!c.trim())||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length)throw Error('第 '+(i+1)+' 题选项或答案有误。');
      return {kind:'choice',prompt,explanation,bonus,choices:q.choices,answer:q.answer,...(audio?{audio}:{})};
    }
    const answer=String(q.reference??q.answer??'').trim();
    const markers=[...prompt.matchAll(/(?:^|\s)(?:\[([A-H])\]|([A-H])[.．、])\s+/g)];
    const letter=answer.match(/^\s*(?:\[([A-H])\]|([A-H])(?:[.．、\s]|$))/)?.slice(1).find(Boolean);
    if(q.kind!=='check'&&letter&&markers.length>=2){
      const keys=markers.map(m=>m[1]||m[2]);
      const choices=markers.map((m,j)=>prompt.slice(m.index+m[0].length,markers[j+1]?.index).trim());
      const stem=prompt.slice(0,markers[0].index).trim();
      if(stem&&choices.every(Boolean)&&keys.join('')==='ABCDEFGH'.slice(0,keys.length)&&keys.includes(letter)){
        return {kind:'choice',prompt:stem,explanation,bonus,choices,answer:keys.indexOf(letter)};
      }
    }
    if(!answer) throw Error('第 '+(i+1)+' 题缺少参考答案。');
    return {kind:'check',prompt,reference:answer,explanation,bonus};
  });
  return {title,board,category,folder,boards,questions};
}
function validBoard(value){
  if(typeof value!=='string')return false;
  if(/^\.\/[a-z0-9_/%.-]+\.(?:jpg|jpeg|png|webp|gif|avif)$/i.test(value)&&!value.includes('..'))return true;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}
  catch{return false;}
}
function validReadAudio(value){
  if(/^\.\/[a-z0-9_/%.-]+\.(?:mp3|ogg|wav|m4a)$/i.test(value)&&!value.includes('..'))return true;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}
  catch{return false;}
}
function recentlyPublished(course,day){
  if(course.testOnly||!/^\d{4}-\d{2}-\d{2}$/.test(course.publishedAt||''))return false;
  const age=(Date.parse(day)-Date.parse(course.publishedAt))/86400000;
  return age>=0&&age<7;
}
function defaultCourses(){
  return Object.entries(LESSONS).map(([category,lesson])=>({...lesson,id:category,category,version:1}));
}
function storedDraftCourses(){
  if(!globalThis.ERIC_LOCAL_EDITOR||location.protocol!=='file:')return [];
  try{return JSON.parse(localStorage.getItem(COURSE_DRAFTS_KEY))||[];}
  catch{return [];}
}
function localCourseEditor(){return globalThis.ERIC_LOCAL_EDITOR===true&&location.protocol==='file:';}
function deletedCourseIds(){
  let local=[];
  if(localCourseEditor())try{local=JSON.parse(localStorage.getItem(COURSE_DELETIONS_KEY)||'[]');}catch{}
  return new Set([...(globalThis.ERIC_DELETED_COURSES||[]),...(Array.isArray(local)?local:[])]);
}
function courseList(category){
  const all=new Map(defaultCourses().map(c=>[c.id,c]));
  for(const c of [...(globalThis.ERIC_PUBLISHED_COURSES||[]),...storedDraftCourses()]){
    if(c&&Object.hasOwn(MODULES,c.category)&&courseIdPattern.test(c.id))all.set(c.id,c);
  }
  const deleted=deletedCourseIds();
  return [...all.values()].filter(c=>!deleted.has(c.id)&&(!category||c.category===category))
    .sort((a,b)=>(Number.isFinite(a.order)?a.order:1000000)-(Number.isFinite(b.order)?b.order:1000000));
}
function findCourse(id){return courseList().find(c=>c.id===id);}
