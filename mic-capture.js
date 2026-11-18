class MicCapture extends AudioWorkletProcessor {
  constructor(){
    super();
    this.chunk=new Float32Array(2048);
    this.used=0;
    this.ended=false;
    this.port.onmessage=event=>{
      if(event.data!=='stop'||this.ended)return;
      this.ended=true;
      this.flush();
      this.port.postMessage('finished');
    };
  }
  flush(){
    if(!this.used)return;
    const result=this.chunk.slice(0,this.used);
    this.port.postMessage(result,[result.buffer]);
    this.used=0;
  }
  process(inputs){
    const input=inputs[0]?.[0];
    if(this.ended||!input)return true;
    for(const sample of input){
      this.chunk[this.used++]=sample;
      if(this.used===this.chunk.length)this.flush();
    }
    return true;
  }
}
registerProcessor('mic-capture',MicCapture);
