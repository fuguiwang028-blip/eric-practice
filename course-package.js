const courseMediaTypes={
  mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',
  jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif'
};
function packagePath(name){
  if(name.includes('\\')||name.startsWith('/')||name.split('/').includes('..'))throw Error('媒体包中有无效文件路径。');
  return name.replace(/^\.\//,'');
}
async function parseCoursePackage(file,category){
  if(typeof globalThis.JSZip?.loadAsync!=='function')throw Error('ZIP 解析组件未加载。请使用完整本地编辑版，确认 vendor/jszip.min.js 存在后重新打开页面。');
  if(file.size>100*1024*1024)throw Error('单个课件 ZIP 请控制在 100 MB 以内。');
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const entries=Object.values(zip.files).filter(entry=>!entry.dir&&!entry.name.startsWith('__MACOSX/')&&!entry.name.split('/').at(-1).startsWith('.'));
  if(entries.length>2000)throw Error('课件包内文件过多，请按单元导入。');
  const fileMap=new Map();
  let expandedSize=0;
  for(const entry of entries){
    const size=entry._data?.uncompressedSize;
    if(!Number.isSafeInteger(size)||size<0)throw Error('无法读取压缩文件大小。');
    expandedSize+=size;
    if(expandedSize>256*1024*1024)throw Error('解压后的课件超过 256 MB，请按单元拆分导入。');
    const path=packagePath(entry.unsafeOriginalName||entry.name);
    fileMap.set(path,entry);
  }
  const courses=[];
  for(const [name,entry] of fileMap){
    if(!name.toLowerCase().endsWith('.json'))continue;
    if(entry._data.uncompressedSize>8*1024*1024)throw Error(name+' 的 JSON 超过 8 MB。');
    let payload;
    try{payload=JSON.parse(await entry.async('string'));}
    catch{throw Error(name+' 的 JSON 无法解析。');}
    const candidates=Array.isArray(payload)?payload:payload?.courses??(payload?.questions?[payload]:[]);
    if(!Array.isArray(candidates)||!candidates.length||!candidates.some(course=>course?.questions))continue;
    for(const candidate of candidates){
      const course=normalizeCourse(candidate,candidate?.category||category);
      courses.push({course,directory:name.includes('/')?name.slice(0,name.lastIndexOf('/')+1):''});
    }
  }
  if(!courses.length)throw Error('ZIP 内没有包含 questions 的课程 JSON。');
  const media=new Map(),remapped=new Map();
  const id=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
  async function resolve(reference,directory){
    if(!reference.startsWith('./course-media/'))return reference;
    let relative;
    try{relative=packagePath(decodeURIComponent(reference));}
    catch{throw Error('无效媒体路径：'+reference);}
    let source=directory+relative;
    if(!fileMap.has(source))source=relative;
    if(!fileMap.has(source))throw Error('ZIP 缺少媒体文件：'+reference+'。请把 course-media 文件夹与 JSON 一起打包。');
    if(remapped.has(source))return remapped.get(source);
    const entry=fileMap.get(source);
    if(entry._data.uncompressedSize>25*1024*1024)throw Error(source+' 超过单文件 25 MB。');
    const extension=source.split('.').at(-1).toLowerCase();
    if(!courseMediaTypes[extension])throw Error('暂不支持此媒体格式：'+source);
    const destination='./course-media/import-'+id+'/'+remapped.size+'.'+extension;
    remapped.set(source,destination);
    const bytes=await entry.async('uint8array');
    media.set(destination,new Blob([bytes],{type:courseMediaTypes[extension]}));
    return destination;
  }
  const batch=[];
  for(const {course,directory} of courses){
    course.boards=await Promise.all(course.boards.map(path=>resolve(path,directory)));
    for(const question of course.questions)if(question.audio)question.audio=await resolve(question.audio,directory);
    batch.push(course);
  }
  return {courses:batch,media};
}
