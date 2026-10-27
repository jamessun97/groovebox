export const definitions = [['kick','底鼓','KICK',82],['snare','军鼓','SNARE',62],['clap','拍手','CLAP',55],['hat','闭镲','CH',43],['openhat','开镲','OH',38],['perc','打击','PERC',47],['bass','贝斯','BASS',64],['lead','旋律','LEAD',53]];
export const letters = ['A','B','C','D'];
export const melodic = t => t.id === 'bass' || t.id === 'lead';
export const color = t => melodic(t) ? '#84d5c5' : '#ff955b';
export const scales = { minor:[0,2,3,5,7,8,10], major:[0,2,4,5,7,9,11], pentatonic:[0,3,5,7,10] };
export const defaultAttributes = () => ({velocity:100,probability:100,ratchet:1,duration:1});
export const attributesGrid = () => definitions.map(()=>Array.from({length:16},defaultAttributes));
export function attach(p) { p.tracks.forEach((t,i)=>t.steps=p.patterns[p.pattern].steps[i]); return p; }
export function empty() {
 const p={version:3,name:'Untitled Groove',samples:{},bpm:120,swing:0,master:75,pattern:0,songMode:false,chain:[0],root:0,scale:'minor',effects:{filter:100,drive:0,delay:0,reverb:0},tracks:definitions.map(([id,name,short,volume])=>({id,name,short,volume,mute:false,solo:false,tune:0,decay:50,pan:0,sample:null,waveform:id==='bass'?'sawtooth':'triangle'})),patterns:letters.map(name=>({name,steps:definitions.map(()=>Array(16).fill(null)),attributes:attributesGrid()}))};
 return attach(p);
}
export function makePreset(kind) {
 const p=empty(),put=(i,steps,notes=60)=>steps.forEach((s,j)=>p.tracks[i].steps[s]=Array.isArray(notes)?notes[j%notes.length]:notes);
 if(kind==='hiphop'||kind==='lofi'){p.name=kind==='lofi'?'Rainy Lo-fi':'Dusty Hip-hop';p.bpm=kind==='lofi'?76:88;p.swing=35;put(0,[0,6,10]);put(1,[4,12]);put(2,[12]);put(3,[0,2,4,6,8,10,12,14,15]);put(4,[7]);put(5,[3,11]);put(6,[0,3,6,10,14],[36,36,39,34,36]);put(7,[2,7,11,15],[63,67,70,67]);if(kind==='lofi'){p.effects={filter:64,drive:12,delay:12,reverb:22};p.tracks[7].waveform='sine';}}
 else if(kind==='techno'){p.name='Warehouse Techno';p.bpm=134;put(0,[0,4,8,12]);put(1,[4,12]);put(2,[12]);put(3,[0,2,4,6,8,10,12,14]);put(4,[2,6,10,14]);put(5,[3,7,11,15]);put(6,[0,2,3,6,8,10,11,14],[33,33,45,33]);put(7,[1,5,9,13],[69,72,69,67]);p.tracks[6].decay=25;p.tracks[7].decay=22;}
 else if(kind==='synthwave'){p.name='Neon Synthwave';p.bpm=105;put(0,[0,8,10]);put(1,[4,12]);put(2,[4,12]);put(3,[0,2,4,6,8,10,12,14]);put(6,[0,2,4,6,8,10,12,14],[36,36,43,43,39,39,34,34]);put(7,[0,3,6,8,11,14],[60,67,70,63,67,72]);p.tracks[7].waveform='sawtooth';p.effects.delay=22;p.effects.reverb=18;}
 else if(kind==='breakbeat'){p.name='Broken Circuit';p.bpm=128;p.swing=18;put(0,[0,3,6,10,14]);put(1,[4,12]);put(2,[12]);put(3,[0,2,3,5,6,8,10,11,13,14]);put(4,[7,15]);put(5,[1,9]);put(6,[0,3,7,10,14],[36,43,39,36,34]);put(7,[2,6,11,15],[72,70,67,63]);p.effects.delay=15;}
 else if(kind==='dub'){p.name='Echo Dub';p.bpm=74;p.swing=18;put(0,[8]);put(1,[8]);put(3,[0,2,4,6,8,10,12,14]);put(5,[6,14]);put(6,[0,3,7,10],[36,43,34,36]);put(7,[2,10],[63,70]);p.effects={filter:72,drive:5,delay:32,reverb:20};p.tracks[7].waveform='sine';}
 else if(kind==='garage'){p.name='Night Garage';p.bpm=130;p.swing=42;put(0,[0,7,10]);put(1,[4,12]);put(3,[0,2,3,6,8,10,11,14]);put(4,[6,14]);put(5,[3,11]);put(6,[0,3,7,10,14],[36,43,39,34,36]);put(7,[2,6,13],[72,67,70]);p.effects.delay=16;}
 else if(kind==='electro'){p.name='Machine Electro';p.bpm=116;put(0,[0,6,10]);put(1,[4,12]);put(2,[12]);put(3,[0,2,4,6,8,10,12,14,15]);put(5,[3,7,11]);put(6,[0,2,5,6,8,11,14],[36,48,43,36]);put(7,[1,5,9,13],[72,67,70,75]);p.tracks[6].waveform='square';p.effects.drive=10;p.effects.delay=12;}
 else{p.name='Midnight House';p.bpm=120;p.swing=12;put(0,[0,4,8,12]);put(1,[4,12]);put(2,[4,12]);put(3,[0,2,4,6,8,10,12,14]);put(4,[2,6,10,14]);put(5,[7,15]);put(6,[0,3,6,8,11,14],[36,36,43,34,34,41]);put(7,[2,5,10,13],[60,63,67,70]);}
 p.chain=[0,1,2,3];
 for(let i=1;i<4;i++)p.patterns[i].steps=p.patterns[0].steps.map(row=>[...row]);
 p.patterns[1].steps[5][3]=60;p.patterns[1].steps[5][11]=60;
 p.patterns[2].steps[0].fill(null);p.patterns[2].steps[4].fill(null);p.patterns[2].steps[2].fill(null);
 for(const step of [13,14,15])p.patterns[3].steps[1][step]=60;
 for(let s=0;s<16;s++)if(p.patterns[3].steps[7][s]!==null)p.patterns[3].steps[7][s]=Math.min(84,p.patterns[3].steps[7][s]+12);
 return p;
}
export function validate(p) {
 const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const note=n=>n===null||Number.isInteger(n)&&n>=24&&n<=84;
 const grid=g=>Array.isArray(g)&&g.length===8&&g.every(row=>Array.isArray(row)&&row.length===16&&row.every(note));
 if(!p||![1,2,3].includes(p.version)||!Array.isArray(p.tracks)||p.tracks.length!==8)throw new Error('不是有效的 Groovebox 工程');
 if(!bounded(p.bpm,60,180)||!bounded(p.swing,0,60)||!bounded(p.master,0,100))throw new Error('工程中的速度或音量无效');
 const out=empty();out.name=typeof p.name==='string'?p.name.slice(0,80):'Imported Groove';out.bpm=p.bpm;out.swing=p.swing;out.master=p.master;
 p.tracks.forEach((t,i)=>{
  if(!t||t.id!==definitions[i][0]||!Array.isArray(t.steps)||t.steps.length!==16||!t.steps.every(note)||!bounded(t.volume,0,100)||!bounded(t.tune,-12,12)||!bounded(t.decay,10,100)||typeof t.mute!=='boolean'||typeof t.solo!=='boolean')throw new Error('工程中的声部数据无效');
  Object.assign(out.tracks[i],{volume:t.volume,tune:t.tune,decay:t.decay,mute:t.mute,solo:t.solo});
  if(p.version>=2){if(!bounded(t.pan,-100,100)||!['sine','triangle','sawtooth','square'].includes(t.waveform))throw new Error('音色设置无效');out.tracks[i].pan=t.pan;out.tracks[i].waveform=t.waveform;}
 });
 if(p.version===1){out.patterns[0].steps=p.tracks.map(t=>[...t.steps]);return attach(out);}
 if(!Number.isInteger(p.pattern)||p.pattern<0||p.pattern>3||typeof p.songMode!=='boolean'||!Array.isArray(p.chain)||p.chain.length<1||p.chain.length>16||!p.chain.every(n=>Number.isInteger(n)&&n>=0&&n<4)||!Array.isArray(p.patterns)||p.patterns.length!==4||!p.patterns.every(s=>s&&grid(s.steps))||!Number.isInteger(p.root)||p.root<0||p.root>11||!Object.hasOwn(scales,p.scale)||!p.effects||!['filter','drive','delay','reverb'].every(k=>bounded(p.effects[k],0,k==='filter'?100:50)))throw new Error('段落或效果设置无效');
 out.pattern=p.pattern;out.songMode=p.songMode;out.chain=[...p.chain];out.root=p.root;out.scale=p.scale;out.effects={filter:p.effects.filter,drive:p.effects.drive,delay:p.effects.delay,reverb:p.effects.reverb};out.patterns=p.patterns.map((s,i)=>({name:letters[i],steps:s.steps.map(row=>[...row]),attributes:attributesGrid()}));
 if(p.version===3){
  if(!p.samples||typeof p.samples!=='object'||Array.isArray(p.samples)||Object.keys(p.samples).length>32)throw new Error('采样列表无效');let total=0;
  for(const [id,s] of Object.entries(p.samples)){if(!/^sample-[a-z0-9-]{1,64}$/.test(id)||!s||typeof s.name!=='string'||s.name.length>120||typeof s.data!=='string'||s.data.length<4||s.data.length>11200000||s.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(s.data))throw new Error('采样数据无效');total+=s.data.length;out.samples[id]={name:s.name,mime:typeof s.mime==='string'?s.mime.slice(0,100):'audio/wav',data:s.data};}if(total>34000000)throw new Error('工程采样总量超过 24 MB');
  p.tracks.forEach((t,i)=>{if(t.sample===null)return;const s=t.sample;if(!s||!Object.hasOwn(out.samples,s.id)||!bounded(s.start,0,1)||!bounded(s.end,0,1)||s.end-s.start<.001||typeof s.reverse!=='boolean'||!Number.isInteger(s.root)||s.root<24||s.root>84)throw new Error('采样播放设置无效');out.tracks[i].sample={id:s.id,start:s.start,end:s.end,reverse:s.reverse,root:s.root};});
  p.patterns.forEach((pattern,i)=>{const g=pattern.attributes;if(!Array.isArray(g)||g.length!==8||!g.every(row=>Array.isArray(row)&&row.length===16&&row.every((a,s)=>a&&bounded(a.velocity,0,100)&&bounded(a.probability,0,100)&&Number.isInteger(a.ratchet)&&a.ratchet>=1&&a.ratchet<=4&&Number.isInteger(a.duration)&&a.duration>=1&&a.duration<=16-s)))throw new Error('音符表现数据无效');out.patterns[i].attributes=g.map(row=>row.map(a=>({velocity:a.velocity,probability:a.probability,ratchet:a.ratchet,duration:a.duration})));});
 }
 // The active grid is also serialized for backward-compatible track access.
 if(JSON.stringify(p.tracks.map(t=>t.steps))!==JSON.stringify(p.patterns[p.pattern].steps))throw new Error('当前段落与声部数据不一致');
 return attach(out);
}
export function generateTrack(p,index,pulses,offset=0,random=false) {
 const row=Array(16).fill(null),base=(index===6?36:60)+p.root,scale=scales[p.scale];
 for(let s=0;s<16;s++)if((s*pulses)%16<pulses){const n=melodic(p.tracks[index])?base+scale[random?Math.floor(Math.random()*scale.length):s%scale.length]:60;row[(s+offset)%16]=Math.min(84,n);}
 p.patterns[p.pattern].steps[index]=row;p.patterns[p.pattern].attributes[index]=Array.from({length:16},defaultAttributes);attach(p);
}
