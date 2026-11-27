/* v4: cold retrieval for old words; learning and testing are separate evidence. */
function a4Store(p){
  const a=p.a4Review||(p.a4Review={version:4,groups:[],masteryClaims:[],qualified:{},session:null});
  if(a.version!==4){
    for(const r of Object.values(p.words)){
      if(r.mastered){r.selfKnown=true;r.mastered=false;}
      r.masteryDays=[];delete r.masterySource;
      if(r.reviewed)r.learnedOn=r.added||r.reviewed;
    }
    a.version=4;a.qualified={};
    if(a.session&&a.session.phase!=='done'){
      const s=a.session;s.legacy=true;s.learnBatch=s.batch;
      for(const t of s.tasks)t.mode='legacy';for(const r of s.results)r.mode='legacy';
    }
  }
  return a;
}
function a4Shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function a4Candidates(p,day){
  const a=a4Store(p),used=new Set(a.groups.filter(g=>g.day===day).flatMap(g=>g.words));
  const rows=Object.entries(p.words).map(([word,r])=>({word,...r,audioCatchup:!!r.audioPending&&recordedWords.has(word)}));
  const due=rows.filter(r=>(r.due<=day||r.audioCatchup)&&!used.has(r.word));
  const priority=r=>r.audioCatchup?0:r.reviewed||r.learnedOn||r.stage>0?1:2;
  return [...due.filter(r=>!r.mastered||r.audioCatchup).sort((a,b)=>priority(a)-priority(b)||a.due.localeCompare(b.due)),...due.filter(r=>r.mastered&&!r.audioCatchup).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,2)];
}
function a4ClaimMastery(p,day,word){
  const a=a4Store(p);
  if(a.qualified[word]!==day)throw Error('请先在今天通过这个词的全部可用题型，再标记已会。');
  if(a.masteryClaims.filter(c=>c.day===day).length>=2)throw Error('今天已手动标记2个词，明天再来。');
  a.masteryClaims.push({day,word});
}
function a4SetSelfKnown(p,day,word,on){
  const entry=p.words[word];if(!entry)throw Error('生词本中没有这个词。');
  if(on){if(!entry.selfKnown)a4ClaimMastery(p,day,word);entry.selfKnown=true;const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+7);entry.due=d.toISOString().slice(0,10);}
  else{entry.selfKnown=false;entry.mastered=false;entry.needsConsolidation=true;entry.due=day;}
  persist(p);return localBook(p,day);
}
function a4SpellingSample(rows){
  return a4Shuffle(rows).sort((a,b)=>(a.spellingChecks||0)-(b.spellingChecks||0)||Number(!!b.spellingWrong)-Number(!!a.spellingWrong)||(a.lastSpellingDay||'').localeCompare(b.lastSpellingDay||'')).slice(0,5).map(r=>r.word);
}
function a4Tasks(s,rows,mode,dictionary,kinds=null){
  kinds=kinds||(s.format===5?['listening','meaning','spelling']:['spelling','meaning','listening']);
  for(const kind of kinds)for(const row of a4Shuffle(rows)){
    if(kind==='listening'&&!recordedWords.has(row.word))continue;
    if(kind==='spelling'&&s.spellingSample&&!s.spellingSample.includes(row.word))continue;
    const zh=kind==='meaning'&&s.format===5;
    const others=Object.keys(dictionary).filter(w=>w!==row.word&&dictionary[w]!==row.meaning);
    const correct=zh?row.meaning:row.word;
    const distractors=[...new Set(a4Shuffle(others).map(w=>zh?dictionary[w]:w))].slice(0,3);
    const options=kind==='spelling'?[]:a4Shuffle([correct,...distractors]);
    s.tasks.push({id:s.tasks.length,word:row.word,kind,mode,options,answer:correct,direction:zh?'en-zh':'zh-en'});
  }
}
function a4BeginLearning(s){
  if(!s.learnBatch.length){s.phase='done';return;}
  s.phase='learn';s.k=1;s.p=0;
}
function a4NextPhase(s,dictionary){
  if(s.legacy){s.phase='done';return;}
  if(s.segment==='cold'){s.segment='learning';a4BeginLearning(s);}
  else s.phase='done';
}
function a4Action(p,day,b){
  const a=a4Store(p),dictionary={...WORD_DATA[0],...p.customWords};
  const snapshot=()=>({day,groupsToday:a.groups.filter(g=>g.day===day).length,masteredToday:a.masteryClaims.filter(c=>c.day===day).length,qualified:a.qualified,candidates:a4Candidates(p,day),session:a.session});
  if(b.action==='read'){persist(p);return snapshot();}
  if(b.action==='start'){
    if(a.session&&a.session.phase!=='done')return snapshot();
    if(a.groups.filter(g=>g.day===day).length>=3)throw Error('今天已学习3组，最多30词。明天再来。');
    const batch=a4Shuffle(a4Candidates(p,day).slice(0,10)).map(r=>({...r,meaning:dictionary[r.word]}));
    if(!batch.length)throw Error('今天没有可开始的新一组单词。');
    a.groups.push({day,words:batch.map(r=>r.word)});
    const s=a.session={id:day+'-'+a.groups.length,day,format:5,spellingSample:a4SpellingSample(batch),phase:'test',segment:'cold',batch,learnBatch:[],k:1,p:0,heard:[],hints:[],tasks:[],cursor:0,results:[],feedback:null,settled:[],outcomes:{}};
    const old=[],audio=[];
    for(const r of batch){if(r.audioCatchup){audio.push(r);p.words[r.word].due=day;}else if(r.reviewed||r.learnedOn||r.stage>0){old.push(r);}else{s.learnBatch.push(r);p.words[r.word].learnedOn=day;}}
    a4Tasks(s,old,'cold',dictionary);a4Tasks(s,audio,'audio',dictionary,['listening']);
    if(!s.tasks.length){s.segment='learning';a4BeginLearning(s);}
  }else{
    const s=a.session;if(!s||s.id!==b.id)throw Error('复习进度已变化，请返回生词本继续。');
    const learning=s.learnBatch||s.batch;
    if(b.action==='heard'){
      const word=b.word||learning[s.p]?.word;if(s.phase==='learn'&&learning.some(r=>r.word===word)&&!s.heard.includes(word))s.heard.push(word);
    }else if(b.action==='hint'){
      if(s.phase==='learn'&&!s.hints.includes(learning[s.p].word))s.hints.push(learning[s.p].word);
    }else if(b.action==='learn-next'){
      if(s.phase!=='learn')return snapshot();
      if(s.p>0)s.p--;else if(s.k<learning.length){s.k++;s.p=s.k-1;}else{
        const newRows=learning.filter(r=>!r.remedial),retry=learning.filter(r=>r.remedial);
        a4Tasks(s,newRows,s.legacy?'legacy':'new',dictionary);
        if(s.format!==5)a4Tasks(s,retry,'practice',dictionary,['spelling']);
        s.segment='after-learning';s.phase='test';
        if(s.cursor>=s.tasks.length)s.phase='done';
      }
    }else if(b.action==='answer'){
      if(s.phase!=='test')throw Error('当前不是检测阶段。');
      const q=s.tasks[s.cursor];if(!q||q.id!==b.task)throw Error('题目已变化，请继续当前题。');
      if(s.feedback)return snapshot();
      const norm=v=>String(v||'').trim().toLowerCase().replace(/’/g,"'");
      if(!b.skip&&q.kind!=='spelling'&&!q.options.includes(b.answer))throw Error('请选择一个答案。');
      if(!b.skip&&!norm(b.answer))throw Error('请先填写答案。');
      const correct=!b.skip&&norm(b.answer)===norm(q.answer||q.word);
      if(q.kind==='spelling'){const entry=p.words[q.word];if(entry){entry.spellingChecks=(entry.spellingChecks||0)+1;entry.spellingWrong=!correct;entry.lastSpellingDay=day;}}
      s.results.push({task:q.id,word:q.word,kind:q.kind,mode:q.mode,correct,day});s.feedback={correct,word:q.word,answer:String(b.answer||''),skip:!!b.skip};
      const required=s.tasks.filter(t=>t.word===q.word&&t.mode===q.mode),answered=s.results.filter(r=>r.word===q.word&&r.mode===q.mode);
      if(q.mode!=='practice'&&answered.length===required.length&&!s.settled.includes(q.word)){
        const row=s.batch.find(r=>r.word===q.word),known=answered.every(r=>r.correct),entry=p.words[q.word];
        if(entry&&entry.stage===row.stage&&entry.due<=day){
          if(!entry.learnedOn)entry.learnedOn=row.added||day;
          if(q.mode==='cold'&&known)entry.audioPending=!required.some(t=>t.kind==='listening');
          else if(q.mode==='audio')entry.audioPending=!known;
          else if(q.mode==='new'||q.mode==='legacy')entry.audioPending=!required.some(t=>t.kind==='listening');
          const fullTest=required.some(t=>t.kind==='spelling');
          const autoMastered=a4RecordMasteryDate(entry,day,known,q.mode==='cold'&&fullTest);
          const outcome=applyA4WordReview(p,day,q.word,row.stage,known);
          if(known){entry.needsConsolidation=false;if(entry.selfKnown&&!entry.mastered){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+7);entry.due=d.toISOString().slice(0,10);}}
          else{
            entry.mastered=false;entry.selfKnown=false;entry.needsConsolidation=true;
            entry.stage=Math.max(0,row.stage-1);const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);entry.due=d.toISOString().slice(0,10);
            if(q.mode==='cold')s.learnBatch.push({...row,remedial:true});
          }
          s.outcomes[q.word]={...outcome,due:entry.due,autoMastered,audioOnly:q.mode==='audio',fullTest};
          if(known&&fullTest)a.qualified[q.word]=day;else if(!known)delete a.qualified[q.word];
        }else s.outcomes[q.word]={changed:true};
        s.settled.push(q.word);
      }
    }else if(b.action==='continue'){
      if(s.phase!=='test'||!s.feedback)return snapshot();
      s.cursor++;s.feedback=null;if(s.cursor>=s.tasks.length)a4NextPhase(s,dictionary);
    }else throw Error('未知复习操作。');
  }
  persist(p);return snapshot();
}
function a4RecordMasteryDate(entry,day,known,cold=false){
  const dates=Array.isArray(entry.masteryDays)?entry.masteryDays.filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>entry.learnedOn&&d<=day):[];
  entry.masteryDays=[...new Set(dates)].sort();
  if(!known||!cold||!entry.learnedOn||day<=entry.learnedOn)return false;
  if(!entry.masteryDays.includes(day))entry.masteryDays.push(day);
  entry.masteryDays.sort();entry.masteryDays=entry.masteryDays.slice(-3);
  const elapsed=(Date.parse(day+'T00:00:00Z')-Date.parse(entry.learnedOn+'T00:00:00Z'))/86400000;
  if(!entry.mastered&&entry.masteryDays.length>=3&&elapsed>=7){entry.mastered=true;entry.selfKnown=false;entry.masterySource='automatic';entry.masteredOn=day;return true;}
  return false;
}
function a4WordStatus(row){
  if(row.mastered)return row.audioPending?'词义与拼写已掌握 · 听音待检测':'系统已掌握';
  if(row.needsConsolidation)return '待巩固';
  if(row.selfKnown)return '已会 · 减少复习';
  return '学习中';
}
