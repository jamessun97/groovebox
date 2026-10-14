const noiseCache = new WeakMap();
function noise(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < d.length; i++) { seed = (1664525 * seed + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
  noiseCache.set(ctx, b); return b;
}
export function midiName(n) { return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n % 12] + (Math.floor(n / 12) - 1); }
const sampleCache=new Map();
export function cachedSample(id) {return sampleCache.get(id)?.buffer;}
export async function prepareSamples(p,ctx) {
 let bytes=0;const needed=new Set(Object.keys(p.samples||{}));
 for(const [id,s] of Object.entries(p.samples||{})){
  if(!sampleCache.has(id)||sampleCache.get(id).data!==s.data){let raw;try{raw=Uint8Array.from(atob(s.data),c=>c.charCodeAt(0));}catch{throw new Error('采样文件内容损坏');}let buffer;try{buffer=await ctx.decodeAudioData(raw.buffer);}catch{throw new Error(`无法解码采样：${s.name}`);}if(buffer.duration>30||buffer.numberOfChannels>2)throw new Error('采样须为 30 秒以内的单声道或双声道音频');sampleCache.set(id,{buffer,data:s.data,reverse:null});}
  const b=sampleCache.get(id).buffer;bytes+=b.length*b.numberOfChannels*4;
 }
 if(bytes>128*1024*1024)throw new Error('解码后的采样总量过大，请缩短采样');
 let total=[...sampleCache.values()].reduce((n,s)=>n+s.buffer.length*s.buffer.numberOfChannels*4*(s.reverse?2:1),0);
 for(const [id,s] of sampleCache){if(total<=128*1024*1024)break;if(!needed.has(id)){total-=s.buffer.length*s.buffer.numberOfChannels*4*(s.reverse?2:1);sampleCache.delete(id);}}
}
function playSample(ctx,dest,track,pitch,start,detail) {
 const config=track.sample,entry=sampleCache.get(config.id);if(!entry)throw new Error('采样尚未加载，请重新播放');let buffer=entry.buffer;
 if(config.reverse){if(!entry.reverse){entry.reverse=ctx.createBuffer(buffer.numberOfChannels,buffer.length,buffer.sampleRate);for(let c=0;c<buffer.numberOfChannels;c++)entry.reverse.getChannelData(c).set(buffer.getChannelData(c).slice().reverse());}buffer=entry.reverse;}
 const src=ctx.createBufferSource(),gain=ctx.createGain(),rate=Math.pow(2,(pitch-config.root+track.tune)/12),offset=(config.reverse?1-config.end:config.start)*buffer.duration,segment=(config.end-config.start)*buffer.duration;
 const audible=Math.max(.003,Math.min(30,segment/rate,detail.gate??segment/rate)),fade=Math.min(.006,audible/3);
 src.buffer=buffer;src.playbackRate.value=rate;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime((detail.velocity??100)/100,start+fade);gain.gain.setValueAtTime((detail.velocity??100)/100,start+audible-fade);gain.gain.linearRampToValueAtTime(0,start+audible);src.connect(gain);gain.connect(dest);src.start(start,offset,Math.min(segment,audible*rate));src.stop(start+audible+.01);src.onended=()=>{src.disconnect();gain.disconnect();};
}
export function synth(ctx, destination, track, pitch, time, detail={}) {
  const start = Math.max(time, ctx.currentTime), tune = Math.pow(2, track.tune / 12), length = track.decay / 100;
  const velocity=(detail.velocity??100)/100;if(velocity===0)return;if(track.sample){playSample(ctx,destination,track,pitch,start,detail);return;}
  function envelope(duration, amp, attack = .003,gate) {
    amp*=velocity;const g=ctx.createGain();g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(Math.max(.0002,amp),start+attack);if(gate){g.gain.linearRampToValueAtTime(Math.max(.0002,amp*.7),start+Math.min(.07,gate*.5));g.gain.setValueAtTime(Math.max(.0002,amp*.7),start+gate);}g.gain.exponentialRampToValueAtTime(.0001,start+duration);g.connect(destination);return g;
  }
  function osc(type, freq, duration, amp, endFreq) {
    const o = ctx.createOscillator(), g = envelope(duration, amp); o.type = type; o.frequency.setValueAtTime(freq * tune, start); if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq * tune, start + duration * .65); o.connect(g); o.start(start); o.stop(start + duration + .02); o.onended = () => { o.disconnect(); g.disconnect(); }; return o;
  }
  function hiss(duration, amp, cutoff, type = 'highpass', bursts = false) {
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = envelope(duration, amp);
    source.buffer = noise(ctx); filter.type = type; filter.frequency.value = cutoff * tune; filter.Q.value = .7;
    if (bursts) for (let i = 1; i < 3; i++) { g.gain.setValueAtTime(.01*velocity, start + i * .014); g.gain.linearRampToValueAtTime(amp*velocity, start + i * .014 + .003); g.gain.exponentialRampToValueAtTime(.0001, start + duration); }
    source.connect(filter); filter.connect(g); source.start(start); source.stop(start + duration + .02); source.onended = () => { source.disconnect(); filter.disconnect(); g.disconnect(); };
  }
  switch (track.id) {
    case 'kick': osc('sine', 155, .18 + length * .55, .9, 42); osc('triangle', 900, .018, .08, 130); break;
    case 'snare': hiss(.08 + length * .24, .5, 1400); osc('triangle', 190, .06 + length * .12, .22, 110); break;
    case 'clap': hiss(.07 + length * .25, .55, 1500, 'bandpass', true); break;
    case 'hat': hiss(.015 + length * .09, .22, 7000); break;
    case 'openhat': hiss(.12 + length * .42, .22, 6500); break;
    case 'perc': osc('sine', 520, .04 + length * .25, .4, 180); break;
    default: {
      const gate=detail.gate??(.12+length*.4),duration=gate+.03+length*.3,o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=envelope(duration,track.id==='bass'?.42:.23,.009,gate);
      o.type = track.waveform || (track.id === 'bass' ? 'sawtooth' : 'triangle'); o.frequency.value = 440 * Math.pow(2, (pitch - 69) / 12) * tune;
      f.type = 'lowpass'; f.Q.value = track.id === 'bass' ? 2.5 : .7;
      f.frequency.setValueAtTime(track.id === 'bass' ? 1800 : 5500, start); f.frequency.exponentialRampToValueAtTime(track.id === 'bass' ? 150 : 900, start + duration);
      o.connect(f); f.connect(g); o.start(start); o.stop(start + duration + .02); o.onended = () => { o.disconnect(); f.disconnect(); g.disconnect(); };
    }
  }
}
export function scheduleNote(ctx,dest,track,pitch,time,attributes={},seconds=.125,rng=Math.random,gate=seconds) {
 const probability=attributes.probability??100;if(probability===0||probability<100&&rng()*100>=probability)return;
 const count=attributes.ratchet??1;for(let i=0;i<count;i++){const melodic=track.id==='bass'||track.id==='lead';synth(ctx,dest,track,pitch,time+i*seconds/count,{velocity:attributes.velocity??100,gate:melodic?(count>1?Math.min(gate,seconds/count*.85):gate):undefined});}
}
function gateSeconds(p,step,duration) {let n=0;for(let i=0;i<duration;i++)n+=60/p.bpm/4*(1+((step+i)%2?-1:1)*p.swing/100);return n;}
const impulseCache = new WeakMap();
export function filterHz(value) { return Math.round(180 * Math.pow(100, value / 100)); }
function impulse(ctx) {
  if(impulseCache.has(ctx))return impulseCache.get(ctx);
  const b=ctx.createBuffer(2,Math.floor(ctx.sampleRate*1.6),ctx.sampleRate);let seed=98765;
  for(let c=0;c<2;c++){const a=b.getChannelData(c);for(let i=0;i<a.length;i++){seed=(1664525*seed+1013904223)>>>0;a[i]=(seed/2147483648-1)*Math.pow(1-i/a.length,2.4);}}
  impulseCache.set(ctx,b);return b;
}
function makeOutput(ctx, project, dest) {
  const master = ctx.createGain(), compressor = ctx.createDynamicsCompressor(), filter=ctx.createBiquadFilter(), drive=ctx.createWaveShaper(), delay=ctx.createDelay(2),feedback=ctx.createGain(),delayMix=ctx.createGain(),reverb=ctx.createConvolver(),reverbMix=ctx.createGain();
  master.gain.value = project.master / 100; compressor.threshold.value = -12; compressor.knee.value = 18; compressor.ratio.value = 4; compressor.attack.value = .003; compressor.release.value = .15;
  filter.type='lowpass';filter.Q.value=.5;drive.oversample='2x';reverb.buffer=impulse(ctx);feedback.gain.value=.35;
  master.connect(filter);filter.connect(drive);drive.connect(compressor);drive.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(delayMix);delayMix.connect(compressor);drive.connect(reverb);reverb.connect(reverbMix);reverbMix.connect(compressor);compressor.connect(dest);
  const solo = project.tracks.some(t => t.solo);
  const pans=project.tracks.map(t=>{const n=ctx.createStereoPanner();n.pan.value=(t.pan||0)/100;n.connect(master);return n;});
  const gains = project.tracks.map((t,i) => { const g = ctx.createGain(); g.gain.value = !t.mute && (!solo || t.solo) ? t.volume / 100 : 0; g.connect(pans[i]); return g; });
  const out={master,compressor,gains,pans,filter,drive,delay,feedback,delayMix,reverb,reverbMix,driveValue:-1};
  updateGains(ctx, project, gains, master);updateEffects(ctx,project,out,true);return out;
}
function updateEffects(ctx,p,out,initial=false) {
  const fx=p.effects||{filter:100,drive:0,delay:0,reverb:0},set=(param,value)=>initial?param.setValueAtTime(value,ctx.currentTime):param.setTargetAtTime(value,ctx.currentTime,.015);
  set(out.filter.frequency,filterHz(fx.filter));set(out.delay.delayTime,60/p.bpm*.75);set(out.delayMix.gain,fx.delay/100);set(out.reverbMix.gain,fx.reverb/100);
  out.pans.forEach((n,i)=>set(n.pan,(p.tracks[i].pan||0)/100));
  if(out.driveValue!==fx.drive){out.driveValue=fx.drive;if(!fx.drive)out.drive.curve=null;else{const a=new Float32Array(1024),amount=1+fx.drive*.16;for(let i=0;i<a.length;i++){const x=i/(a.length-1)*2-1;a[i]=Math.tanh(x*amount)/Math.tanh(amount);}out.drive.curve=a;}}
}
function updateGains(ctx, p, gains, master) {
  const solo = p.tracks.some(t => t.solo);
  p.tracks.forEach((t, i) => gains[i].gain.setTargetAtTime(!t.mute && (!solo || t.solo) ? t.volume / 100 : 0, ctx.currentTime, .008));
  master.gain.setTargetAtTime(p.master / 100, ctx.currentTime, .008);
}
export class AudioEngine {
  constructor(getProject) { this.getProject = getProject; this.playing = false; this.step = 0; this.queue = []; this.activeStep = -1; this.playPattern=0;this.activePattern=-1;this.chainIndex=0; }
  async init() {
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) throw new Error('此浏览器不支持实时音频，请使用新版 Chrome、Edge 或 Safari');
      this.ctx = new Audio(); this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 512; this.analyser.connect(this.ctx.destination); this.output = makeOutput(this.ctx, this.getProject(), this.analyser);
    }
    await prepareSamples(this.getProject(),this.ctx);await this.ctx.resume();if(this.ctx.state!=='running')throw new Error('声音尚未启用，请再次点击播放');
  }
  sync() { if (this.ctx){const p=this.getProject();updateGains(this.ctx,p,this.output.gains,this.output.master);if(this.runGains)updateGains(this.ctx,p,this.runGains,this.output.master);updateEffects(this.ctx,p,this.output);} }
  async play() {
    await this.init(); if (this.playing) return;this.sync();
    this.runBus = this.ctx.createGain(); this.runBus.connect(this.output.master);
    this.runPans=this.getProject().tracks.map(t=>{const n=this.ctx.createStereoPanner();n.pan.value=(t.pan||0)/100;n.connect(this.runBus);return n;});
    const hasSolo=this.getProject().tracks.some(t=>t.solo);
    this.runGains = this.getProject().tracks.map((t,i) => { const g = this.ctx.createGain();g.gain.value=!t.mute&&(!hasSolo||t.solo)?t.volume/100:0;g.connect(this.runPans[i]);return g; });
    const p=this.getProject();if(this.step===0){this.chainIndex=0;this.playPattern=p.songMode?p.chain[0]:p.pattern||0;}
    this.playing = true; this.next = this.ctx.currentTime + .05; this.queue = []; this.schedule(); this.timer = setInterval(() => this.schedule(), 25);
  }
  schedule() {
    const p = this.getProject(); updateGains(this.ctx, p, this.runGains, this.output.master);this.runPans.forEach((n,i)=>n.pan.setTargetAtTime((p.tracks[i].pan||0)/100,this.ctx.currentTime,.015));
    while (this.next < this.ctx.currentTime + .1) {
      if (this.next < this.ctx.currentTime - .2) { this.next = this.ctx.currentTime + .04; }
      if(this.step===0)this.playPattern=p.songMode?p.chain[this.chainIndex%p.chain.length]:p.pattern||0;
      const grid=p.patterns?p.patterns[this.playPattern].steps:p.tracks.map(t=>t.steps);
      const seconds=60/p.bpm/4*(1+(this.step%2?-1:1)*p.swing/100);
      p.tracks.forEach((t,i)=>{if(grid[i][this.step]!==null){const a=p.patterns?.[this.playPattern].attributes?.[i]?.[this.step]||{};scheduleNote(this.ctx,this.runGains[i],t,grid[i][this.step],this.next,a,seconds,Math.random,gateSeconds(p,this.step,a.duration??1));}});
      this.queue.push({step:this.step,pattern:this.playPattern,chainIndex:this.chainIndex,time:this.next});this.next+=60/p.bpm/4*(1+(this.step%2?-1:1)*p.swing/100);this.step=(this.step+1)%16;if(this.step===0&&p.songMode)this.chainIndex=(this.chainIndex+1)%p.chain.length;
    }
  }
  position() { if (!this.ctx || !this.playing) return -1; while (this.queue.length && this.queue[0].time <= this.ctx.currentTime){this.lastEvent=this.queue.shift();this.activeStep=this.lastEvent.step;this.activePattern=this.lastEvent.pattern;}return this.activeStep; }
  recordPosition() {this.position();const options=[this.lastEvent,...this.queue].filter(Boolean);return options.reduce((best,e)=>!best||Math.abs(e.time-this.ctx.currentTime)<Math.abs(best.time-this.ctx.currentTime)?e:best,null);}
  pause(reset = false) {
    const last = this.position(); clearInterval(this.timer); this.playing = false;
    if (this.runBus) { const bus=this.runBus,gains=this.runGains,pans=this.runPans;bus.gain.setTargetAtTime(0,this.ctx.currentTime,.004);setTimeout(()=>{bus.disconnect();gains.forEach(g=>g.disconnect());pans.forEach(n=>n.disconnect());},80);this.runBus=null;this.runGains=null; }
    this.step=reset?0:last<0?this.step:(last+1)%16;if(!reset&&this.lastEvent){this.playPattern=this.lastEvent.pattern;this.chainIndex=this.lastEvent.chainIndex;if(this.step===0&&this.getProject().songMode)this.chainIndex=(this.chainIndex+1)%this.getProject().chain.length;}if(reset)this.chainIndex=0;this.queue=[];this.activeStep=-1;this.activePattern=-1;this.lastEvent=null;
  }
  async audition(track,pitch,attributes) {await this.init();this.sync();const p=this.getProject(),dest=this.output.gains[p.tracks.indexOf(track)],note=pitch??(track.id==='bass'?36:60);if(attributes)scheduleNote(this.ctx,dest,track,note,this.ctx.currentTime+.005,attributes,60/p.bpm/4,Math.random,60/p.bpm/4*attributes.duration);else synth(this.ctx,dest,track,note,this.ctx.currentTime+.005);}
}
export async function renderWav(p,repeats=4) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) throw new Error('此浏览器不支持音频导出');
  const sequence=p.songMode?p.chain:[p.pattern||0],totalSteps=sequence.length*16*repeats;
  const sampleRate=44100;await prepareSamples(p,new Offline(1,1,sampleRate));let duration=totalSteps*60/p.bpm/4+4,scanTime=.02;
  for(let j=0;j<totalSteps;j++){const s=j%16,pattern=sequence[Math.floor(j/16)%sequence.length],grid=p.patterns?p.patterns[pattern].steps:p.tracks.map(t=>t.steps);p.tracks.forEach((t,i)=>{const pitch=grid[i][s];if(pitch===null||!t.sample||t.id==='bass'||t.id==='lead')return;const b=cachedSample(t.sample.id),rate=Math.pow(2,(pitch-t.sample.root+t.tune)/12);duration=Math.max(duration,scanTime+Math.min(30,(t.sample.end-t.sample.start)*b.duration/rate)+2);});scanTime+=60/p.bpm/4*(1+(s%2?-1:1)*p.swing/100);}
  const ctx=new Offline(2,Math.ceil(duration*sampleRate),sampleRate),out=makeOutput(ctx,p,ctx.destination);
  let time = .02;
  let seed=24681357;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let j=0;j<totalSteps;j++){const s=j%16,pattern=sequence[Math.floor(j/16)%sequence.length],grid=p.patterns?p.patterns[pattern].steps:p.tracks.map(t=>t.steps),seconds=60/p.bpm/4*(1+(s%2?-1:1)*p.swing/100);p.tracks.forEach((t,i)=>{if(grid[i][s]!==null){const a=p.patterns?.[pattern].attributes?.[i]?.[s]||{};scheduleNote(ctx,out.gains[i],t,grid[i][s],time,a,seconds,rng,gateSeconds(p,s,a.duration??1));}});time+=seconds;}
  const buffer = await ctx.startRendering(); return encodeWav(buffer);
}
export function encodeWav(buffer) {
  const count = buffer.length, channels = buffer.numberOfChannels, bytes = count * channels * 2, data = new ArrayBuffer(44 + bytes), view = new DataView(data);
  const str = (at, s) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, bytes, true);
  const arrays = Array.from({length: channels}, (_, i) => buffer.getChannelData(i)); let peak = 0;
  for (const a of arrays) for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(a[i]));
  const scale = peak > .96 ? .96 / peak : 1;
  for (let i = 0; i < count; i++) for (let c = 0; c < channels; c++) { const s = Math.max(-1, Math.min(1, arrays[c][i] * scale)); view.setInt16(44 + (i * channels + c) * 2, s < 0 ? s * 32768 : s * 32767, true); }
  return new Blob([data], {type:'audio/wav'});
}
