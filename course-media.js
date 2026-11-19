let courseMediaDatabase;
function openCourseMedia(){
  if(!courseMediaDatabase)courseMediaDatabase=new Promise((resolve,reject)=>{
    const request=indexedDB.open('eric-course-media',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('无法打开本地课件媒体存储。'));
  }).catch(error=>{courseMediaDatabase=null;throw error;});
  return courseMediaDatabase;
}
async function readCourseMedia(path){
  const database=await openCourseMedia();
  return new Promise((resolve,reject)=>{
    const request=database.transaction('files').objectStore('files').get(path);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(Error('无法读取本地课件媒体。'));
  });
}
async function storeCourseMedia(files){
  if(!files.size)return;
  const database=await openCourseMedia();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction('files','readwrite');
    const store=transaction.objectStore('files');
    for(const [path,file] of files)store.put(file,path);
    transaction.oncomplete=()=>resolve();
    transaction.onabort=()=>reject(Error('课件媒体未能保存，请检查浏览器存储空间。'));
  });
}

async function downloadCourseMedia(){
  const paths=new Set(courseList().flatMap(course=>[...(course.boards||[]),...course.questions.map(question=>question.audio).filter(Boolean)]).filter(path=>path.startsWith('./course-media/')));
  const files=new Map();
  let bytes=0;
  for(const path of paths){
    const blob=await readCourseMedia(path);
    if(!blob)continue;
    bytes+=blob.size;
    if(bytes>256*1024*1024)throw Error('媒体超过 256 MB。请将较大的课件上传到对象存储，再填写 HTTPS 媒体地址。');
    files.set(path.slice(2),new Uint8Array(await blob.arrayBuffer()));
  }
  if(!files.size){notice('当前没有需要导出的本地媒体。');return;}
  const url=URL.createObjectURL(makeZip(files));
  const link=document.createElement('a');
  link.href=url;link.download='course-media.zip';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(filesToZip) {
  const content = [];
  const central = [];
  let offset = 0;
  let centralSize = 0;
  for (const [name, data] of filesToZip) {
    const path = new TextEncoder().encode(name);
    const crc = crc32(data);
    const header = new DataView(new ArrayBuffer(30));
    const dir = new DataView(new ArrayBuffer(46));
    header.setUint32(0,0x04034b50,true);
    header.setUint16(4,20,true);
    header.setUint16(6,0x800,true);
    header.setUint16(12,33,true);
    header.setUint32(14,crc,true);
    header.setUint32(18,data.length,true);
    header.setUint32(22,data.length,true);
    header.setUint16(26,path.length,true);
    dir.setUint32(0,0x02014b50,true);
    dir.setUint16(4,20,true);
    dir.setUint16(6,20,true);
    dir.setUint16(8,0x800,true);
    dir.setUint16(14,33,true);
    dir.setUint32(16,crc,true);
    dir.setUint32(20,data.length,true);
    dir.setUint32(24,data.length,true);
    dir.setUint16(28,path.length,true);
    dir.setUint32(42,offset,true);
    content.push(header.buffer,path,data);
    central.push(dir.buffer,path);
    offset += 30+path.length+data.length;
    centralSize += 46+path.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);
  end.setUint16(8,filesToZip.size,true);
  end.setUint16(10,filesToZip.size,true);
  end.setUint32(12,centralSize,true);
  end.setUint32(16,offset,true);
  return new Blob([...content,...central,end.buffer],{type:'application/zip'});
}
