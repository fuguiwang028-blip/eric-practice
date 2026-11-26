// Browser-wide local redemption journal. No plaintext reward codes are stored here.
let redemptionDatabase;
function openRedemptionDatabase(){
  if(redemptionDatabase)return redemptionDatabase;
  redemptionDatabase=new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(Error('浏览器未允许本地存储，暂时无法兑换。'));return;}
    const request=indexedDB.open('eric-local-redemption-v1',1);let failed=false;
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('claims'))request.result.createObjectStore('claims',{keyPath:'digest'});};
    request.onerror=()=>reject(Error('无法打开本地兑换记录，请检查浏览器存储权限。'));
    request.onblocked=()=>{failed=true;reject(Error('请关闭其他旧版网站页面后，再重试兑换。'));};
    request.onsuccess=()=>{const db=request.result;if(failed){db.close();return;}db.onversionchange=()=>{db.close();redemptionDatabase=null;};resolve(db);};
  }).catch(error=>{redemptionDatabase=null;throw error;});
  return redemptionDatabase;
}
function rewardProgressFor(profileId){
  if(currentProfile()?.id!==profileId)throw Error('学生档案已切换，请重新打开兑换页面。');
  const raw=localStorage.getItem(progressKey());
  // Do not silently replace a damaged progress file with an empty wallet.
  return raw?{...empty(),...validateProgress(JSON.parse(raw))}:empty();
}
function redemptionTransaction(db,digest,profileId,reward,phase){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('claims','readwrite'),store=tx.objectStore('claims');let outcome,problem;
    tx.oncomplete=()=>resolve(outcome);
    tx.onabort=()=>reject(problem||Error('兑换记录未能保存，请重试；同一档案重试不会重复发放。'));
    tx.onerror=()=>{};
    const request=store.get(digest);
    request.onsuccess=()=>{
      try{
        const previous=request.result;
        if(previous&&previous.profileId!==profileId)throw Error('这个兑换码已在当前浏览器使用过。');
        if(previous?.status==='applied'){outcome={alreadyUsed:true};return;}
        const p=rewardProgressFor(profileId),owned=Object.hasOwn(p.redemptions||{},digest);
        if(phase==='claim'){
          if(!previous)store.put({digest,profileId,type:reward.type,amount:reward.amount,status:owned?'applied':'pending',day:localDay()});
          outcome={alreadyUsed:owned};return;
        }
        if(!previous)throw Error('未找到本次兑换记录，请重新提交。');
        if(owned){store.put({...previous,status:'applied'});outcome={alreadyUsed:true};return;}
        // The read/write IDB transaction serializes the synchronous wallet update across tabs.
        p.redemptions={...p.redemptions,[digest]:{type:reward.type,amount:reward.amount,day:localDay()}};
        if(reward.type==='coins'){syncEconomy(p);economyTransaction(p,reward.amount,'兑换码奖励');}
        validateProgress(p);persist(p);
        store.put({...previous,status:'applied'});
        outcome={...reward,balance:p.economy?.balance||0,banked:credits(p)};
      }catch(error){problem=error;tx.abort();}
    };
  });
}
async function redeemLocalCode(input){
  const code=String(input||'').normalize('NFKC').replace(/[\s-]/g,'');
  if(!/^\d{8}$/.test(code))throw Error('请输入8位数字兑换码。');
  const profileId=currentProfile()?.id;if(!profileId)throw Error('请先设置学生档案。');
  if(!globalThis.crypto?.subtle)throw Error('当前浏览器不支持兑换校验，请使用新版浏览器打开网站。');
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));
  const digest=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  const reward=globalThis.ERIC_REDEMPTION_CODES?.[digest];
  if(!reward||!((reward.type==='coins'&&reward.amount===30)||(reward.type==='draw'&&reward.amount===1)))throw Error('兑换码不正确，请核对后再试。');
  const db=await openRedemptionDatabase();
  const claim=await redemptionTransaction(db,digest,profileId,reward,'claim');
  if(claim.alreadyUsed)throw Error('这个兑换码已使用过，奖励不会重复发放。');
  const result=await redemptionTransaction(db,digest,profileId,reward,'apply');
  if(result.alreadyUsed)throw Error('这个兑换码已使用过，奖励不会重复发放。');
  return result;
}
function redemptionPage(){
  const view=$('view'),p=readProgress();syncEconomy(p);
  view.innerHTML=sectionHeader('兑换奖励')+`<section class="panel redeem-panel"><div class="redeem-balances"><span>当前金币 <b>${p.economy.balance}</b></span><span>累计可用抽卡机会 <b>${credits(p)}</b></span></div><h2>输入老师赠送的兑换码</h2><p>金币码可领取30金币，抽卡码可领取1次机会。</p><form id="redeem-form" class="form"><label for="reward-code">8位数字兑换码</label><input id="reward-code" name="code" type="text" inputmode="numeric" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="16" placeholder="请输入8位数字" required><button class="primary" id="redeem-submit">确认兑换</button></form><p id="redeem-result" role="status" aria-live="polite"></p><p class="muted">同一浏览器内每个码仅能使用一次，切换学生档案也不能重复领取。换设备或清空网站数据后，记录无法互通。抽卡仍每天最多4次，额外机会可留待以后使用。</p><div class="action-row"><a class="secondary" href="#equipment">查看我的装备</a><a class="secondary" href="#collection">去抽卡</a></div></section>`;
  const form=$('redeem-form'),button=$('redeem-submit'),status=$('redeem-result');let busy=false;
  form.onsubmit=async event=>{
    event.preventDefault();if(busy)return;busy=true;button.disabled=true;status.textContent='正在核对兑换码…';
    try{
      const r=await redeemLocalCode(new FormData(form).get('code'));
      if(!form.isConnected)return;
      status.className='redeem-success';status.textContent=r.type==='coins'?'兑换成功，金币＋30，当前金币 '+r.balance+'。':'兑换成功，抽卡机会＋1，累计可用 '+r.banked+' 次。';
      $('reward-code').value='';
      view.querySelector('.redeem-balances').innerHTML=`<span>当前金币 <b>${r.balance}</b></span><span>累计可用抽卡机会 <b>${r.banked}</b></span>`;
    }catch(error){if(form.isConnected){status.className='redeem-error';status.textContent=error.message||'兑换失败，请重试。';}}
    finally{busy=false;if(form.isConnected)button.disabled=false;}
  };
}
