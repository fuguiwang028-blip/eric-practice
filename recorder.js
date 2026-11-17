function encodeBase64(bytes) {
  let binary='';
  for (let i=0;i<bytes.length;i+=16384) binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(binary);
}
async function pcmFromRecording(blob) {
  const context=new AudioContext();
  try {
    const original=await context.decodeAudioData(await blob.arrayBuffer());
    const resampler=new OfflineAudioContext(1,Math.ceil(original.duration*16000),16000);
    const source=resampler.createBufferSource();
    source.buffer=original;source.connect(resampler.destination);source.start();
    const output=(await resampler.startRendering()).getChannelData(0);
    const view=new DataView(new ArrayBuffer(output.length*2));
    output.forEach((value,i)=>view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,value))*32767),true));
    return encodeBase64(new Uint8Array(view.buffer));
  } finally {await context.close();}
}
function attachRecorder(host) {
  const record=host.querySelector('[data-record]');
  const stop=host.querySelector('[data-stop]');
  const playback=host.querySelector('audio');
  const status=host.querySelector('[data-record-status]');
  let mic,recorder,url,blob,timer,disposed=false;
  function cleanup() {
    clearTimeout(timer);
    mic?.getTracks().forEach(track=>track.stop());
  }
  function finish(){if(recorder?.state==='recording')recorder.stop();}
  record.onclick=async()=>{
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      status.textContent='当前浏览器无法录音，请使用支持麦克风的浏览器。';return;
    }
    record.disabled=true;
    try{
      mic=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1}});
      if(disposed){cleanup();return;}
      recorder=new MediaRecorder(mic);
      const chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>{cleanup();record.disabled=false;stop.disabled=true;status.textContent='录音中断，请重试。';};
      recorder.onstop=()=>{
        cleanup();
        if(disposed)return;
        if(url)URL.revokeObjectURL(url);
        blob=new Blob(chunks,{type:recorder.mimeType});
        url=URL.createObjectURL(blob);
        playback.src=url;playback.hidden=false;
        status.textContent='录音完成，可以回听或提交。';
        stop.disabled=true;record.disabled=false;record.textContent='重录';
        host.dispatchEvent(new Event('recorded'));
      };
      recorder.start();
      blob=null;stop.disabled=false;playback.hidden=true;playback.pause();
      status.textContent='正在录音（最多 19 秒）…';
      host.dispatchEvent(new Event('recording'));
      timer=setTimeout(finish,19000);
    }catch(error){
      cleanup();record.disabled=false;status.textContent='麦克风未授权或无法使用。';
    }
  };
  stop.onclick=finish;
  return {audio:()=>blob,dispose:()=>{disposed=true;finish();cleanup();if(url)URL.revokeObjectURL(url);}};
}
