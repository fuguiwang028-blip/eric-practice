// Local editor course drafts: durable IndexedDB storage, with legacy migration.
let courseDraftCache;
let courseDraftReady;
let courseDraftSaveQueue=Promise.resolve();
function initCourseDraftStore(){
  if(!localCourseEditor())return Promise.resolve();
  if(!courseDraftReady)courseDraftReady=(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('eric-course-drafts',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('无法打开课程草稿数据库，请不要清除浏览器数据。'));
    });
    const existing=await new Promise((resolve,reject)=>{
      const request=db.transaction('drafts').objectStore('drafts').get('courses');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('无法读取课程草稿。'));
    });
    let legacy;
    try{legacy=JSON.parse(localStorage.getItem(COURSE_DRAFTS_KEY)||'[]');}catch{throw Error('旧课程草稿无法读取，已保留原数据。');}
    if(!Array.isArray(legacy))throw Error('旧课程草稿格式有误，已保留原数据。');
    const merged=new Map((Array.isArray(existing)?existing:[]).map(c=>[c.id,c]));
    for(const c of legacy)if(!merged.has(c.id))merged.set(c.id,c);
    const drafts=[...merged.values()];
    await writeCourseDraftDatabase(db,drafts);
    courseDraftCache=drafts;
    // Only remove the legacy course key after a successful transaction.
    localStorage.removeItem(COURSE_DRAFTS_KEY);
    return db;
  })();
  return courseDraftReady;
}
function writeCourseDraftDatabase(db,drafts){
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('drafts','readwrite');
    transaction.objectStore('drafts').put(drafts,'courses');
    transaction.oncomplete=()=>resolve();
    transaction.onabort=()=>reject(Error('课程草稿保存失败，旧数据仍保留。请检查磁盘或浏览器存储空间。'));
    transaction.onerror=()=>{};
  });
}
function persistCourseDrafts(courses){
  const operation=courseDraftSaveQueue.catch(()=>{}).then(async()=>{
    const db=await initCourseDraftStore();
    if(!db)throw Error('请在本地编辑版中保存课程。');
    const drafts=new Map((courseDraftCache||[]).map(c=>[c.id,c]));
    for(const c of courses)drafts.set(c.id,c);
    const next=[...drafts.values()];
    await writeCourseDraftDatabase(db,next);
    courseDraftCache=next;
  });
  courseDraftSaveQueue=operation;
  return operation;
}
