/* Browser-side, offline-capable A4 PDF export. No student answers leave the device. */
const CoursePDF=(()=>{
  function loadScript(path,ready){
    if(ready())return Promise.resolve();
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=path;s.onload=()=>ready()?resolve():reject(Error('打印组件未能加载。'));s.onerror=()=>{s.remove();reject(Error('打印资源尚未下载，请联网后重试，或下载完整本地版。'));};document.head.append(s);});
  }
  async function dependencies(){
    await loadScript('./vendor/pdf-lib.min.js',()=>!!globalThis.PDFLib);
    await loadScript('./vendor/fontkit.umd.min.js',()=>!!globalThis.fontkit);
    await loadScript('./print-assets/print-font.js',()=>!!globalThis.ERIC_PRINT_FONT_BASE64);
    return Uint8Array.from(atob(globalThis.ERIC_PRINT_FONT_BASE64),c=>c.charCodeAt(0));
  }
  const clean=value=>String(value??'').replace(/\r/g,'').replace(/\t/g,'  ').replace(/👑/g,'').replace(/✗/g,'×').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  async function make({title,courses,mode='student',fontBytes,imageLoader,onProgress=()=>{}}){
    const {PDFDocument,rgb}=globalThis.PDFLib,doc=await PDFDocument.create();doc.registerFontkit(globalThis.fontkit);
    const font=await doc.embedFont(fontBytes,{subset:false});const ink=rgb(.13,.20,.16),muted=rgb(.39,.45,.40),lineColor=rgb(.75,.80,.75);
    const W=595.28,H=841.89,M=43,content=W-2*M,warnings=[];let page,y,section='';
    doc.setTitle(title+' · '+(mode==='answers'?'家长参考答案':'打印练习'));doc.setAuthor('Eric和他的朋友们');doc.setSubject('Unit复习与练习 · 本地生成');
    function newPage(){page=doc.addPage([W,H]);y=H-54;page.drawText('Eric和他的朋友们  /  '+clean(title).slice(0,46),{x:M,y:H-29,font,size:8,color:muted});page.drawLine({start:{x:M,y:H-36},end:{x:W-M,y:H-36},thickness:.5,color:lineColor});}
    function ensure(h){if(!page||y-h<47)newPage();}
    function lines(text,size=11,width=content){
      const out=[];for(const para of clean(text).split('\n')){
        if(!para){out.push('');continue;}const tokens=para.match(/[A-Za-z0-9_'’.-]+|\s+|./gu)||[];let buf='';
        for(const token of tokens){if(font.widthOfTextAtSize(buf+token,size)<=width){buf+=token;continue;}if(buf.trim())out.push(buf.trimEnd());buf='';if(font.widthOfTextAtSize(token,size)<=width)buf=token.trimStart();else for(const ch of token){if(font.widthOfTextAtSize(buf+ch,size)>width){out.push(buf);buf='';}buf+=ch;}}
        out.push(buf.trimEnd());
      }return out;
    }
    function text(value,size=11,options={}){const x=options.x??M,width=options.width??content,leading=options.leading||size*1.65;const blocks=clean(value).split(/\n\n+/);for(let bi=0;bi<blocks.length;bi++){const ls=lines(blocks[bi],size,width);if(blocks.length>1)ensure(Math.min(ls.length*leading,650));for(const l of ls){ensure(leading);if(l)page.drawText(l,{x,y,font,size,color:options.muted?muted:ink});y-=leading;}if(bi<blocks.length-1)y-=leading;}}
    function heading(value,small=false){ensure(small?48:72);y-=small?6:10;text(value,small?14:19,{leading:small?24:31});y-=8;}
    function blank(n=2){for(let i=0;i<n;i++){ensure(25);page.drawLine({start:{x:M+12,y:y-10},end:{x:W-M,y:y-10},thickness:.5,color:lineColor});y-=26;}}
    function needed(q){return lines(q.prompt,11).length*18+(q.choices||[]).reduce((n,c)=>n+lines(c,10.5,content-25).length*17,0)+(q.kind==='choice'?24:q.kind==='read'?44:clean(q.reference??q.answer).length>25?68:42)+(q.audio&&q.kind!=='read'?18:0);}
    async function boardImage(path){
      if(!imageLoader){warnings.push('复习图片未附入：'+path);return;}
      try{const bytes=await imageLoader(path);let img;try{img=await doc.embedPng(bytes);}catch{img=await doc.embedJpg(bytes);}const scale=Math.min(content/img.width,630/img.height);ensure(img.height*scale+24);page.drawImage(img,{x:M+(content-img.width*scale)/2,y:y-img.height*scale,width:img.width*scale,height:img.height*scale});y-=img.height*scale+20;}
      catch{warnings.push('复习图片未附入：'+path);text('复习图片请在网页查看：'+path,9,{muted:true});}
    }
    newPage();heading(title);text(mode==='answers'?'家长参考答案（请与学生练习分开打印）':'姓名：________________    日期：________________',11);text('共 '+courses.length+' 个课次，'+courses.reduce((n,c)=>n+c.questions.length,0)+' 道题。',10,{muted:true});
    if(mode!=='answers'){
      text('听力题需配合网页播放音频；朗读题由家长听读确认。本打印版不会自动计分或发放网站奖励。',9,{muted:true});
      if(mode==='student'){
        const seen=new Set();for(const c of courses){const key=clean(c.board).trim();if(key&&!seen.has(key)){seen.add(key);heading('复习要点 · '+c.title,true);text(key,10.5);}}
        const images=[...new Set(courses.flatMap(c=>c.boards||[]))];for(const path of images)await boardImage(path);
      }
    }
    for(let ci=0;ci<courses.length;ci++){
      const c=courses[ci];if(ci===0&&mode!=='answers')heading('练习题');ensure(100);heading(c.title,true);
      if(mode==='answers'){
        for(let i=0;i<c.questions.length;i++){const q=c.questions[i],answer=q.kind==='choice'?String.fromCharCode(65+q.answer)+' · '+q.choices[q.answer]:q.kind==='read'?q.prompt:q.reference??q.answer??'请按课堂要求核对';ensure(48);text((i+1)+'. '+answer,11);if(q.explanation)text(q.explanation,9.5,{muted:true});y-=9;}
      }else{
        for(let i=0;i<c.questions.length;i++){
          const q=c.questions[i];const h=needed(q);ensure(Math.min(h,650));
          const tag=q.kind==='read'?'朗读题':q.audio?'听力题':q.kind==='choice'?'选择题':'填写题';
          text((i+1)+'. ['+tag+'] '+q.prompt,11);
          if(q.audio&&q.kind!=='read')text('配合网页本课第 '+(i+1)+' 题音频作答。',9,{muted:true});
          if(q.kind==='choice'){for(let j=0;j<q.choices.length;j++)text(String.fromCharCode(65+j)+'. '+q.choices[j],10.5,{x:M+14,width:content-14});y-=12;}
          else if(q.kind==='read'){text('家长确认：□ 能独立朗读    □ 需要帮助',10,{muted:true});y-=16;}
          else blank(clean(q.reference??q.answer).length>65?3:clean(q.reference??q.answer).length>25?2:1);
          y-=12;
        }
      }
      onProgress({course:ci+1,total:courses.length});
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const total=doc.getPageCount();doc.getPages().forEach((p,i)=>{const label=(i+1)+' / '+total;p.drawText(label,{x:W-M-font.widthOfTextAtSize(label,9),y:25,font,size:9,color:muted});p.drawText(mode==='answers'?'家长答案版':'学生打印版',{x:M,y:25,font,size:9,color:muted});});
    const bytes=await doc.save();return {bytes,pages:total,warnings};
  }
  async function imageLoader(path){
    let blob;
    if(path.startsWith('./course-media/'))blob=await readCourseMedia(path).catch(()=>null);
    if(!blob){const response=await fetch(path);if(!response.ok)throw Error('图片未下载');blob=await response.blob();}
    if(/image\/(webp|gif|avif)/i.test(blob.type)||/\.(webp|gif|avif)(?:[?#]|$)/i.test(path)){
      const url=URL.createObjectURL(blob);try{
        const image=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});
        const canvas=document.createElement('canvas');const scale=Math.min(1,1800/image.width,2200/image.height);canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('图片无法转换')),'image/png'));
      }finally{URL.revokeObjectURL(url);}
    }
    return new Uint8Array(await blob.arrayBuffer());
  }
  function open(title,items){
    if(!items.length){notice('当前主题没有课次可导出。');return;}
    popup(`<h2>导出 ${E(title)}</h2><p>生成可直接下载的 A4 PDF。可选择本 Unit 的课次，也可单独下载家长答案。</p><div class="pdf-options"><label>打印内容<select id="pdf-mode"><option value="student">复习资料 + 练习（不含答案）</option><option value="exercise">仅练习（不含答案）</option><option value="answers">家长参考答案</option></select></label><fieldset><legend>包含的课次</legend>${items.map((c,i)=>`<label class="pdf-course"><input type="checkbox" data-pdf-course="${i}" checked><span>${E(c.title)} <small>${c.questions.length} 题</small></span></label>`).join('')}</fieldset><p class="muted">听力需配合网页播放。初次生成会读取中文字体，可能需要稍等片刻。</p><button class="primary" id="pdf-generate">生成并下载 PDF</button><p id="pdf-status" role="status"></p></div>`);
    const button=$('pdf-generate'),status=$('pdf-status');button.onclick=async()=>{
      const selected=[...document.querySelectorAll('[data-pdf-course]:checked')].map(el=>items[Number(el.dataset.pdfCourse)]);if(!selected.length){status.textContent='请至少选择一个课次。';return;}
      button.disabled=true;try{
        status.textContent='正在准备中文字体和打印内容…';const fontBytes=await dependencies();
        const mode=$('pdf-mode').value;
        const result=await make({title,courses:selected,mode,fontBytes,imageLoader,onProgress:p=>{status.textContent='正在排版 '+p.course+' / '+p.total+' 个课次…';}});
        const name=(title+'-'+(mode==='answers'?'家长答案':'学生打印')).replace(/[\\/:*?"<>|]/g,'-')+'.pdf';
        const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        status.textContent='已生成 '+result.pages+' 页 PDF。'+(result.warnings.length?'有 '+result.warnings.length+' 张图片未附入，请在网页查看。':'可直接下载打印。');
      }catch(error){status.textContent='生成失败：'+error.message;}finally{button.disabled=false;}
    };
  }
  function forCourse(course){
    const unit=course.title.match(/(?:Unit\s*|\bU)(\d{1,2})\b/i)?.[1];const items=courseList(course.category).filter(c=>c.folder===course.folder&&(!unit||Number(c.title.match(/(?:Unit\s*|\bU)(\d{1,2})\b/i)?.[1])===Number(unit)));
    open((course.folder||'课程')+(unit?' · Unit '+Number(unit):''),items);
  }
  return {make,open,forCourse,dependencies};
})();
