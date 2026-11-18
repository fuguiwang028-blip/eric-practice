const captureModule=new URL('./mic-capture.js?v=1',document.currentScript.src);
const captureSeconds=19;
const pcmRate=16000;

function encodeBase64(bytes) {
  let binary='';
  for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(binary);
}
function packPcm(samples){
  const view=new DataView(new ArrayBuffer(samples.length*2));
  for(let i=0;i<samples.length;i++){
    const value=Math.max(-1,Math.min(1,samples[i]));
    view.setInt16(i*2,Math.round(value*(value<0?32768:32767)),true);
  }
  return new Uint8Array(view.buffer);
}
function wavFromPcm(pcm){
  const header=new DataView(new ArrayBuffer(44));
  const tag=(offset,value)=>{for(let i=0;i<4;i++)header.setUint8(offset+i,value.charCodeAt(i));};
  tag(0,'RIFF');header.setUint32(4,36+pcm.length,true);
  tag(8,'WAVE');tag(12,'fmt ');header.setUint32(16,16,true);header.setUint16(20,1,true);
  header.setUint16(22,1,true);header.setUint32(24,pcmRate,true);header.setUint32(28,pcmRate*2,true);
  header.setUint16(32,2,true);header.setUint16(34,16,true);tag(36,'data');
  header.setUint32(40,pcm.length,true);
  return new Blob([header.buffer,pcm],{type:'audio/wav'});
}
async function toAssessmentPcm(chunks,count,rate){
  const size=Math.min(Math.floor(count*pcmRate/rate),captureSeconds*pcmRate);
  const resampler=new OfflineAudioContext(1,size,pcmRate);
  const buffer=resampler.createBuffer(1,count,rate);
  const channel=buffer.getChannelData(0);
  let offset=0;
  for(const chunk of chunks){channel.set(chunk,offset);offset+=chunk.length;}
  const source=resampler.createBufferSource();
  source.buffer=buffer;
  source.connect(resampler.destination);
  source.start();
  return packPcm((await resampler.startRendering()).getChannelData(0));
}
function attachRecorder(host){
  const record=host.querySelector('[data-record]');
  const stop=host.querySelector('[data-stop]');
  const playback=host.querySelector('audio');
  const status=host.querySelector('[data-record-status]');
  let session=null,url=null,pcm=null,disposed=false;
  function cleanup(current){
    clearTimeout(current.timer);
    current.graph?.disconnect();
    current.source?.disconnect();
    current.mic?.getTracks().forEach(track=>track.stop());
    if(current.context.state!=='closed')current.context.close().catch(()=>{});
  }
  function resetPlayback(){
    playback.pause();
    playback.removeAttribute('src');
    playback.hidden=true;
    if(url)URL.revokeObjectURL(url);
    url=null;
    pcm=null;
  }
  function collect(current,chunk){
    if(!chunk.length||disposed||current!==session)return;
    const room=Math.ceil(current.context.sampleRate*captureSeconds)-current.count;
    if(room<=0)return;
    const samples=chunk.subarray(0,room);
    let chunkPeak=0;
    for(const sample of samples)chunkPeak=Math.max(chunkPeak,Math.abs(sample));
    current.peak=Math.max(current.peak,chunkPeak);
    current.chunks.push(samples);
    current.count+=samples.length;
    const duration=(current.count/current.context.sampleRate).toFixed(1);
    if(!current.stopping&&duration!==current.duration){
      current.duration=duration;
      status.textContent=`正在录音 ${duration} 秒 · ${current.peak>=.008?'已检测到声音':'还没检测到声音'}`;
    }
  }
  async function finish(){
    const current=session;
    if(!current?.graph||current.stopping||disposed)return;
    current.stopping=true;
    stop.disabled=true;
    status.textContent='正在准备回听…';
    try{
      if(current.graph.port){
        await new Promise(resolve=>{
          const flushTimer=setTimeout(resolve,500);
          current.flushed=()=>{clearTimeout(flushTimer);resolve();};
          current.graph.port.postMessage('stop');
        });
      }
      const rate=current.context.sampleRate;
      cleanup(current);
      if(disposed||current!==session)return;
      if(current.count<rate*.2)throw Error('录音太短，请读完再停止。');
      if(current.peak<.003)throw Error('没检测到声音。请确认麦克风输入没有静音，再靠近一点重录。');
      const data=await toAssessmentPcm(current.chunks,current.count,rate);
      if(disposed||current!==session)return;
      pcm=data;
      url=URL.createObjectURL(wavFromPcm(data));
      playback.src=url;
      playback.hidden=false;
      status.textContent=`录音完成 · ${(data.length/(pcmRate*2)).toFixed(1)} 秒，可以先回听。`;
      record.textContent='重录';
      host.dispatchEvent(new Event('recorded'));
    }catch(error){
      if(!disposed&&current===session)status.textContent=error.message||'录音未能处理，请重试。';
    }finally{
      cleanup(current);
      if(current===session){session=null;if(!disposed)record.disabled=false;}
    }
  }
  record.onclick=async()=>{
    if(!navigator.mediaDevices?.getUserMedia||!window.AudioContext||!window.OfflineAudioContext){
      status.textContent='当前浏览器无法录音，请使用支持麦克风的 Safari 或 Chrome。';return;
    }
    record.disabled=true;
    resetPlayback();
    host.dispatchEvent(new Event('recording'));
    status.textContent='正在开启麦克风…';
    let current;
    try{
      const context=new AudioContext();
      current={context,chunks:[],count:0,peak:0};
      session=current;
      const resumed=context.resume();
      resumed.catch(()=>{});
      current.mic=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1}});
      if(disposed){cleanup(current);return;}
      await resumed;
      if(disposed){cleanup(current);return;}
      current.source=context.createMediaStreamSource(current.mic);
      if(context.audioWorklet){
        try{
          await context.audioWorklet.addModule(captureModule.href);
          if(disposed){cleanup(current);return;}
          current.graph=new AudioWorkletNode(context,'mic-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1});
          current.graph.port.onmessage=event=>{
            if(event.data==='finished')current.flushed?.();
            else collect(current,event.data);
          };
        }catch(error){if(disposed)return;if(!context.createScriptProcessor)throw error;}
      }
      if(!current.graph){
        current.graph=context.createScriptProcessor(4096,1,1);
        current.graph.onaudioprocess=event=>collect(current,event.inputBuffer.getChannelData(0).slice());
      }
      current.silent=context.createGain();
      current.silent.gain.value=0;
      current.source.connect(current.graph).connect(current.silent).connect(context.destination);
      stop.disabled=false;
      status.textContent='正在录音 0.0 秒 · 请开始朗读';
      current.timer=setTimeout(finish,captureSeconds*1000);
      for(const track of current.mic.getAudioTracks()){
        track.addEventListener('ended',()=>{if(session===current&&!current.stopping)finish();},{once:true});
      }
    }catch(error){
      if(current)cleanup(current);
      if(session===current)session=null;
      if(disposed)return;
      record.disabled=false;
      stop.disabled=true;
      status.textContent=error.name==='NotAllowedError'?'麦克风未授权，请在浏览器设置里允许访问。':'无法采集麦克风，请检查系统的输入设备。';
    }
  };
  stop.onclick=finish;
  return {
    audio:()=>pcm&&encodeBase64(pcm),
    dispose(){
      disposed=true;
      if(session)cleanup(session);
      resetPlayback();
    }
  };
}
