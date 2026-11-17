const AVATARS=['🐼','🦊','🐱','🐶','🐰','🐻','🐸','🐯','🦁','🐨','🦉','🐲'];
const PROFILE_KEY='eric-pages-profiles-v1';
const CURRENT_PROFILE='eric-pages-active-profile-v1';
function profiles(){
  try{
    const list=JSON.parse(localStorage.getItem(PROFILE_KEY));
    return Array.isArray(list)?list.filter(p=>p&&/^[a-z0-9-]+$/.test(p.id)&&AVATARS.includes(p.avatar)&&typeof p.alias==='string'):[];
  }catch{return [];}
}
function currentProfile(){
  return profiles().find(p=>p.id===localStorage.getItem(CURRENT_PROFILE))||null;
}
function selectProfile(id){
  if(!profiles().some(p=>p.id===id))throw Error('没有找到这个档案。');
  localStorage.setItem(CURRENT_PROFILE,id);
}
function upsertProfile(form,existing){
  const alias=String(form.get('alias')||'').trim();
  const slogan=String(form.get('slogan')||'').trim();
  const avatar=form.get('avatar');
  const gender=form.get('gender');
  if(!alias||alias.length>16||slogan.length>40||!AVATARS.includes(avatar)||!['未设置','男生','女生'].includes(gender))throw Error('请检查档案内容。');
  const list=profiles();
  const id=existing?.id||globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const next={id,alias,avatar,gender,slogan};
  const newList=list.filter(p=>p.id!==id);
  if(!list.length&&!existing){
    const old=localStorage.getItem('eric-practice-pages-v1');
    if(old)localStorage.setItem('eric-practice-pages-v1:'+id,old);
  }
  localStorage.setItem(PROFILE_KEY,JSON.stringify([...newList,next]));
  selectProfile(id);
}
function profilePage(editing=false){
  const old=editing?currentProfile():null;
  const saved=profiles();
  $('menu').hidden=true;
  $('profile-link').hidden=true;
  $('view').innerHTML=`<section class="login-card panel"><p class="eyebrow">ERIC CLASSROOM</p><h1>${old?'编辑我的档案':'欢迎加入'}</h1>
    <p class="muted">档案和学习进度保存在这台设备的浏览器里。</p>
    ${!old&&saved.length?`<div class="action-row profile-choices">${saved.map(p=>`<button class="secondary" data-profile="${E(p.id)}">${E(p.avatar)} ${E(p.alias)}</button>`).join('')}</div>`:''}
    <form id="profile-form" class="form"><fieldset><legend>选择头像</legend><div class="avatar-options">${AVATARS.map((icon,i)=>`<label><input name="avatar" type="radio" value="${icon}" aria-label="头像 ${icon}" ${icon===(old?.avatar||AVATARS[0])?'checked':''}><span>${icon}</span></label>`).join('')}</div></fieldset>
    <label>昵称<input name="alias" maxlength="16" required value="${E(old?.alias||'')}" autocomplete="off"></label>
    <label>性别<select name="gender">${['未设置','男生','女生'].map(g=>`<option ${g===old?.gender?'selected':''}>${g}</option>`).join('')}</select></label>
    <label>学习口号<input name="slogan" maxlength="40" value="${E(old?.slogan||'')}" placeholder="例如：每天进步一点点"></label>
    <button class="primary">${old?'保存档案':'创建档案并进入'}</button>
    ${old?'<a class="secondary" href="#profiles">切换档案</a>':''}</form></section>`;
  function enter(){
    if(['#profile','#profiles'].includes(location.hash)) location.hash='#tower';
    else refresh().catch(e=>notice(e.message));
  }
  $('view').querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{selectProfile(b.dataset.profile);enter();});
  $('profile-form').onsubmit=event=>{
    event.preventDefault();
    try{upsertProfile(new FormData(event.currentTarget),old);enter();}
    catch(e){notice(e.message);}
  };
}
