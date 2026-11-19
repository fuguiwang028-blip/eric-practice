if(location.protocol==='file:')globalThis.ERIC_LOCAL_EDITOR=true;

function saveCourseDrafts(courses){
  const drafts=new Map(storedDraftCourses().map(course=>[course.id,course]));
  for(const course of courses)drafts.set(course.id,course);
  localStorage.setItem(COURSE_DRAFTS_KEY,JSON.stringify([...drafts.values()]));
}
function makeDraft(course,existing){
  const id=existing?.id||course.category+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const version=existing?existing.version+1:1;
  return {...existing,...course,id,version,...(!existing?{pendingPublication:true}:{})};
}
function downloadPublishedCourses(){
  const today=localDay();
  const releasing=storedDraftCourses().filter(course=>course.pendingPublication)
    .map(({pendingPublication,...course})=>({...course,publishedAt:today}));
  if(releasing.length)saveCourseDrafts(releasing);
  const source='globalThis.ERIC_PUBLISHED_COURSES = '+JSON.stringify(courseList(),null,2)+';\n'+
    'globalThis.ERIC_DELETED_COURSES = '+JSON.stringify([...deletedCourseIds()])+';\n';
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  const link=document.createElement('a');
  link.href=url;link.download='published-courses.js';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notice('已导出全部课次。发布时用它替换网页目录里的同名文件。');
}
function openCourseEditor(category,existing,seed){
  const draft=existing||seed||{title:'',board:'',questions:[]};
  popup(`<h2>${existing?'编辑课次':'导入课程'} · ${E(MODULES[category])}</h2>
    <form id="course-draft-form" class="form">
    <label>课次名称<input name="title" required maxlength="150" value="${E(draft.title)}"></label>
    <label>下一级目录<input name="folder" maxlength="80" value="${E(draft.folder)}" placeholder="例如 Unit 3"></label>
    <label>复习板书<textarea name="board" rows="5">${E(draft.board)}</textarea></label>
    <label>上传复习图片 <input id="course-boards" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple></label>
    <div class="action-row"><input id="course-board-link" type="text" aria-label="复习图片 HTTPS 地址" placeholder="或输入图片 HTTPS 地址"><button type="button" class="secondary" id="add-board-link">添加图片地址</button></div>
    <ol id="board-order"></ol>
    <div id="draft-questions"></div><button id="draft-add" class="secondary" type="button">新增题目</button>
    <button class="primary">保存到本地课程</button><p id="draft-error" role="status"></p></form>`);
  const list=$('draft-questions');
  const boards=(draft.boards||[]).map(path=>({path,label:path.split('/').at(-1)}));
  const pendingMedia=new Map();
  const boardList=$('board-order');
  function renderBoards(){
    boardList.replaceChildren();
    boards.forEach(({path,label},index)=>{
      const row=document.createElement('li');
      row.innerHTML=`<span>${E(label)}</span>
        <button type="button" class="secondary" data-up ${index===0?'disabled':''}>上移</button>
        <button type="button" class="secondary" data-down ${index===boards.length-1?'disabled':''}>下移</button>
        <button type="button" class="secondary" data-remove-board>移除</button>`;
      function move(offset){
        [boards[index],boards[index+offset]]=[boards[index+offset],boards[index]];
        renderBoards();
      }
      row.querySelector('[data-up]').onclick=()=>move(-1);
      row.querySelector('[data-down]').onclick=()=>move(1);
      row.querySelector('[data-remove-board]').onclick=()=>{
        pendingMedia.delete(path);boards.splice(index,1);renderBoards();
      };
      boardList.append(row);
    });
  }
  $('course-boards').onchange=event=>{
    const files=[...event.target.files];
    event.target.value='';
    const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
    if(boards.length+files.length>60||files.some(file=>!extensions[file.type]||file.size>15*1024*1024)){
      $('draft-error').textContent='每课最多 60 图，每张不超过 15 MB，支持 JPG、PNG、WebP、GIF、AVIF。';
      return;
    }
    for(const file of files){
      const id=globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+'-'+Date.now();
      const path='./course-media/'+id+'.'+extensions[file.type];
      pendingMedia.set(path,file);boards.push({path,label:file.name});
    }
    $('draft-error').textContent='';
    renderBoards();
  };
  $('add-board-link').onclick=()=>{
    const input=$('course-board-link'),path=input.value.trim();
    if(!validBoard(path)||boards.length>=60){$('draft-error').textContent='请填写有效图片地址，每课最多 60 张。';return;}
    boards.push({path,label:path});
    input.value='';$('draft-error').textContent='';renderBoards();
  };
  renderBoards();
  function addQuestion(q={kind:'choice',prompt:'',choices:['',''],answer:0,explanation:''}){
    const item=document.createElement('details');
    item.open=!q.prompt;
    item.className='editor-question';
    item.innerHTML=`<summary>${E(q.prompt||'新题目')}</summary><label>题型<select name="kind">${[['choice','选择题'],['check','作答后对照'],['read','朗读题']].map(([value,label])=>`<option value="${value}" ${q.kind===value?'selected':''}>${label}</option>`).join('')}</select></label>
    <label>题干或朗读句<textarea name="prompt" rows="2" required>${E(q.prompt)}</textarea></label>
    <div data-choice><label>选项（每行一个）<textarea name="choices" rows="3">${E(q.choices?.join('\n'))}</textarea></label>
    <label>正确选项序号<input name="answer" type="number" min="1" max="8" value="${Number.isInteger(q.answer)?q.answer+1:1}"></label></div>
    <div data-read><label>题目音频 / 范读地址（HTTPS 或站内路径）<input name="audio" value="${E(q.audio)}"></label>
    <label>上传或替换题目音频<input type="file" data-upload-audio accept=".ogg,.mp3,.wav,.m4a,audio/ogg,audio/mpeg,audio/wav,audio/mp4"></label>
    <div class="action-row"><button type="button" class="secondary" data-preview-audio>试听</button><button type="button" class="secondary" data-delete-audio>删除音频</button></div>
    <audio controls preload="none" data-audio-player hidden></audio><p data-audio-status role="status"></p></div>
    <label data-check>参考答案<textarea name="reference" rows="2">${E(q.reference)}</textarea></label>
    <label>解析或提示<textarea name="explanation" rows="2">${E(q.explanation)}</textarea></label>
    <label class="choice"><input type="checkbox" name="bonus" ${q.bonus?'checked':''}>王者冲刺</label>
    <div class="action-row"><button class="secondary" type="button" data-move-question="-1">上移</button><button class="secondary" type="button" data-move-question="1">下移</button><button class="secondary" data-remove type="button">移除此题</button></div>`;
    const audioInput=item.querySelector('[name="audio"]');
    const player=item.querySelector('[data-audio-player]');
    let previewUrl;
    let previewRequest=0;
    function stopPreview(){
      previewRequest++;
      player.pause();player.removeAttribute('src');player.hidden=true;
      if(previewUrl)URL.revokeObjectURL(previewUrl);
      previewUrl=null;
    }
    audioInput.oninput=stopPreview;
    item.querySelector('[data-upload-audio]').onchange=event=>{
      const file=event.target.files[0];event.target.value='';
      if(!file)return;
      const extension=file.name.split('.').at(-1).toLowerCase();
      const status=item.querySelector('[data-audio-status]');
      if(!['ogg','mp3','wav','m4a'].includes(extension)||file.size>25*1024*1024||file.size===0){
        status.textContent='请选择不超过 25 MB 的 OGG、MP3、WAV 或 M4A 音频。';return;
      }
      stopPreview();
      if(pendingMedia.has(audioInput.value))pendingMedia.delete(audioInput.value);
      const id=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
      const path='./course-media/'+id+'.'+extension;
      pendingMedia.set(path,file);audioInput.value=path;
      status.textContent='已选择 '+file.name+'，保存课次后可随媒体导出。';
    };
    item.querySelector('[data-preview-audio]').onclick=async()=>{
      stopPreview();
      const request=previewRequest;
      const path=audioInput.value.trim();
      const status=item.querySelector('[data-audio-status]');
      if(!validReadAudio(path)){status.textContent='请上传音频或填写有效的 HTTPS 音频直链。';return;}
      try{
        let src=path;
        if(path.startsWith('./course-media/')){
          const blob=pendingMedia.get(path)||await readCourseMedia(path);
          if(request!==previewRequest||!item.isConnected)return;
          if(blob)src=previewUrl=URL.createObjectURL(blob);
        }
        player.src=src;player.hidden=false;
        await player.play();
        status.textContent='';
      }catch{if(request===previewRequest)status.textContent='暂时无法播放，请检查链接或在播放器中再次播放。';}
    };
    item.querySelector('[data-delete-audio]').onclick=()=>{
      stopPreview();pendingMedia.delete(audioInput.value);audioInput.value='';
      item.querySelector('[data-audio-status]').textContent='已移除本题的范读。保存课次后生效。';
    };
    const kind=item.querySelector('[name="kind"]');
    function fields(){
      for(const [name,group] of [['choice','data-choice'],['check','data-check'],['read','data-read']]){
        const box=item.querySelector('['+group+']');
        box.hidden=group==='data-read'?kind.value==='check':kind.value!==name;
        box.querySelectorAll('input,textarea').forEach(el=>el.disabled=box.hidden);
      }
    }
    kind.onchange=()=>{stopPreview();fields();};fields();
    const prompt=item.querySelector('[name=prompt]');
    prompt.oninput=()=>{item.querySelector('summary').textContent=prompt.value.trim()||'新题目';};
    item.querySelectorAll('[data-move-question]').forEach(button=>{
      button.onclick=()=>{
        const offset=Number(button.dataset.moveQuestion);
        const sibling=offset<0?item.previousElementSibling:item.nextElementSibling;
        if(!sibling)return;
        if(offset<0)list.insertBefore(item,sibling);
        else list.insertBefore(sibling,item);
      };
    });
    item.querySelector('[data-remove]').onclick=()=>{stopPreview();pendingMedia.delete(audioInput.value);item.remove();};
    list.append(item);
  }
  draft.questions.forEach(q=>addQuestion(q));
  $('draft-add').onclick=()=>addQuestion();
  $('course-draft-form').onsubmit=async event=>{
    event.preventDefault();
    try{
      const form=new FormData(event.currentTarget);
      const submit=event.submitter;
      if(submit)submit.disabled=true;
      const questions=[...list.children].map(item=>{
        const value=name=>item.querySelector('[name="'+name+'"]').value;
        const kind=value('kind');
        const q={kind,prompt:value('prompt'),explanation:value('explanation'),bonus:item.querySelector('[name="bonus"]').checked};
        if(kind==='choice')Object.assign(q,{choices:value('choices').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),answer:Number(value('answer'))-1});
        if(kind==='check')q.reference=value('reference');
        if(kind==='read'||kind==='choice')q.audio=value('audio');
        return q;
      });
      const parsed=normalizeCourse({title:form.get('title'),board:form.get('board'),folder:form.get('folder'),boards:boards.map(item=>item.path),questions},category);
      const referenced=new Set([...parsed.boards,...parsed.questions.map(question=>question.audio).filter(Boolean)]);
      await storeCourseMedia(new Map([...pendingMedia].filter(([path])=>referenced.has(path))));
      saveCourseDrafts([makeDraft(parsed,existing)]);
      $('popup').close();
      if(location.hash===`#review/${category}`)refresh().catch(e=>notice(e.message));
      else location.hash=`#review/${category}`;
    }catch(e){if($('draft-error'))$('draft-error').textContent=e.message;if(event.submitter)event.submitter.disabled=false;}
  };
}
function wireCourseEditor(category){
  const input=$('course-import');
  if(input)input.onchange=async()=>{
    const files=[...input.files];
    input.value='';
    if(!files.length)return;
    try{
      const batch=[];
      const packageMedia=new Map();
      input.disabled=true;
      notice('正在读取课程与媒体…');
      for(const file of files){
        if(file.name.toLowerCase().endsWith('.zip')){
          const parsed=await parseCoursePackage(file,category);
          batch.push(...parsed.courses);
          for(const [path,blob] of parsed.media)packageMedia.set(path,blob);
          continue;
        }
        if(file.size>8*1024*1024)throw Error(file.name+' 文件过大。');
        try{
          const payload=JSON.parse(await file.text());
          const courses=Array.isArray(payload)?payload:payload?.courses||[payload];
          if(!Array.isArray(courses)||!courses.length)throw Error('没有可导入的课次。');
          batch.push(...courses.map(course=>normalizeCourse(course,course?.category||category)));
        }catch(error){throw Error(file.name+'：'+error.message);}
      }
      if(!input.isConnected)return;
      if(batch.length===1&&!files.some(file=>file.name.toLowerCase().endsWith('.zip'))){
        openCourseEditor(batch[0].category,null,batch[0]);return;
      }
      const counts=Object.keys(MODULES).map(key=>[MODULES[key],batch.filter(c=>c.category===key).length])
        .filter(([,count])=>count>0);
      popup(`<h2>批量导入 ${batch.length} 个课次</h2><p>已自动匹配 ${packageMedia.size} 个音频或图片文件。</p><ul>${counts.map(([label,count])=>`<li>${E(label)} · ${count} 个课次</li>`).join('')}</ul><button class="primary" id="import-batch">保存全部课次</button><p id="batch-error" role="status"></p>`);
      $('import-batch').onclick=async event=>{
        const button=event.currentTarget;
        button.disabled=true;
        try{
          await storeCourseMedia(packageMedia);
          saveCourseDrafts(batch.map(course=>makeDraft(course)));
          $('popup').close();
          refresh().then(()=>notice('已保存，可逐个编辑或导出发布文件。')).catch(e=>notice(e.message));
        }catch(error){if($('batch-error'))$('batch-error').textContent=error.message;button.disabled=false;}
      };
    }catch(e){if(input.isConnected)notice(e instanceof SyntaxError?'无法读取该 JSON 文件。':e.message);}
    finally{if(input.isConnected)input.disabled=false;}
  };
  $('publish-courses').onclick=()=>{try{downloadPublishedCourses();}catch(error){notice(error.message);}};
  $('publish-course-media').onclick=()=>downloadCourseMedia().catch(error=>notice(error.message));
  $('view').querySelectorAll('[data-move-course]').forEach(button=>{
    const courses=courseList(category),course=findCourse(button.dataset.moveCourse);
    const group=courses.filter(item=>(item.folder||'未分组')===(course.folder||'未分组'));
    const index=group.findIndex(item=>item.id===course.id),offset=Number(button.dataset.offset);
    button.disabled=index+offset<0||index+offset>=group.length;
    button.onclick=()=>{
      const target=group[index+offset];
      if(!target)return;
      const first=courses.findIndex(item=>item.id===course.id),second=courses.findIndex(item=>item.id===target.id);
      [courses[first],courses[second]]=[courses[second],courses[first]];
      try{
        saveCourseDrafts(courses.map((item,order)=>({...item,order})));
        refresh().catch(error=>notice(error.message));
      }catch(error){notice(error.message);}
    };
  });
  $('view').querySelectorAll('[data-delete-course]').forEach(button=>{
    button.onclick=()=>{
      const course=findCourse(button.dataset.deleteCourse);
      if(!course)return;
      popup(`<h2>删除课次</h2><p>将「${E(course.title)}」从课程目录中移除？学生已有练习记录会保留。</p><button id="confirm-delete-course" type="button" class="primary">确认删除</button>`);
      $('confirm-delete-course').onclick=()=>{
        try{
          const deleted=deletedCourseIds();
          deleted.add(course.id);
          localStorage.setItem(COURSE_DELETIONS_KEY,JSON.stringify([...deleted]));
          $('popup').close();
          refresh().catch(error=>notice(error.message));
        }catch(error){notice(error.message);}
      };
    };
  });
  $('view').querySelectorAll('[data-rename-folder]').forEach(button=>{
    button.onclick=()=>{
      const oldName=button.dataset.renameFolder;
      popup(`<h2>修改目录名称</h2><form id="folder-name-form" class="form"><label>目录名称<input name="folder" value="${E(oldName)}" maxlength="80" required></label><button class="primary">保存</button></form>`);
      $('folder-name-form').onsubmit=event=>{
        event.preventDefault();
        const folder=new FormData(event.currentTarget).get('folder').trim();
        if(!folder)return;
        try{
          saveCourseDrafts(courseList(category).filter(course=>(course.folder||'未分组')===oldName).map(course=>({...course,folder})));
          $('popup').close();refresh().catch(error=>notice(error.message));
        }catch(error){notice(error.message);}
      };
    };
  });
  $('view').querySelectorAll('[data-edit-course]').forEach(b=>{
    b.onclick=()=>openCourseEditor(category,findCourse(b.dataset.editCourse));
  });
}
