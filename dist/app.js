import { AudioEngine, midiName, renderWav, filterHz, prepareSamples } from './audio.js';
import { definitions, letters, melodic, color, attach, makePreset, validate, generateTrack } from './project.js';
const $=s=>document.querySelector(s),KEY='groovebox.studio.v1',padKeys=['a','s','d','f','g','h','j','k'];
let project=makePreset('house'),selected=0,selectedStep=0,saveTimer,toastTimer,busy=false,recording=false;
try{const saved=localStorage.getItem(KEY);if(saved)project=validate(JSON.parse(saved));}catch{$('#save-state').textContent='存储不可用或旧工程无效，请导出备份';}
const listeners=new Set();let persistence=null;
const engine=new AudioEngine(()=>project),undoStack=[],redoStack=[];let lastHistoryKey='',lastHistoryAt=0;
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
async function save(notify=false){try{if(persistence)await persistence(project);else localStorage.setItem(KEY,JSON.stringify(project));$('#save-state').textContent='已保存到当前设备';if(notify)toast('工程已保存到当前设备');return true;}catch{$('#save-state').textContent='无法保存，请导出工程备份';if(notify)toast('存储不可用，请导出工程备份');return false;}}
function historyEntry(){return{state:JSON.stringify({...project,samples:{}}),samples:project.samples};}
function historyProject(entry){const p=JSON.parse(entry.state);p.samples=entry.samples;return validate(p);}
function changed(){engine.sync();$('#save-state').textContent='正在保存…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(),350);}
function checkpoint(key=''){const now=performance.now();if(!key||key!==lastHistoryKey||now-lastHistoryAt>600){undoStack.push(historyEntry());if(undoStack.length>60)undoStack.shift();}lastHistoryKey=key;lastHistoryAt=now;redoStack.length=0;}
function mutate(fn,key=''){checkpoint(key);fn();render();changed();transport();}
function restoreHistory(from,to){if(!from.length)return;to.push(historyEntry());project=historyProject(from.pop());engine.pause(true);recording=false;lastHistoryKey='';render();transport();changed();}
$('#undo').onclick=()=>restoreHistory(undoStack,redoStack);$('#redo').onclick=()=>restoreHistory(redoStack,undoStack);
$('#step-head').innerHTML='<span></span>'+Array.from({length:16},(_,s)=>`<span class="step-number ${s%4===0?'bar-start':''}" data-step="${s}">${String(s+1).padStart(2,'0')}</span>`).join('');
$('#tracks').innerHTML=project.tracks.map((t,i)=>`<div class="track-row" data-track="${i}" style="--track:${color(t)}"><button class="track-label" data-select="${i}"><span class="track-index">0${i+1}</span><strong>${t.name}</strong><span class="track-dot"></span></button>${t.steps.map((_,s)=>`<button class="step ${Math.floor(s/4)%2?'group-alt':''}" data-track="${i}" data-step="${s}" aria-label="${t.name} 第 ${s+1} 步" aria-pressed="false"><span class="pitch"></span></button>`).join('')}</div>`).join('');
$('#mixer').innerHTML=project.tracks.map((t,i)=>`<div class="channel" style="--track:${color(t)}"><span class="channel-name">${t.short}</span><input class="fader" type="range" min="0" max="100" value="${t.volume}" data-volume="${i}" aria-label="${t.name}音量"><output id="vol-${i}">${t.volume}</output><div class="channel-buttons"><button data-solo="${i}" aria-label="${t.name}独奏" aria-pressed="false">S</button><button data-mute="${i}" aria-label="${t.name}静音" aria-pressed="false">M</button></div></div>`).join('');
$('#patterns').innerHTML=letters.map((n,i)=>`<button class="pattern-btn" data-pattern="${i}" aria-label="编辑段落 ${n}" aria-pressed="false"><strong>${n}</strong><span id="pattern-count-${i}">空白</span></button>`).join('');
$('#pads').innerHTML=project.tracks.map((t,i)=>`<button class="pad" data-pad="${i}" style="--track:${color(t)}" aria-label="演奏${t.name}"><span>${t.name}</span><strong>${t.short}</strong><kbd>${padKeys[i].toUpperCase()}</kbd></button>`).join('');
for(let n=24;n<=84;n++)$('#note').add(new Option(midiName(n),String(n)));for(let n=0;n<12;n++)$('#root').add(new Option(midiName(n+60).slice(0,-1),String(n)));
function exportDescription(){const repeats=Number($('#export-repeats').value),bars=repeats*(project.songMode?project.chain.length:1);$('#export-description').textContent=(project.songMode?'串联顺序':'当前段落')+` · ${bars} 小节＋尾音`;}
function render(){
 $('#bpm').value=project.bpm;$('#swing').value=project.swing;$('#swing-value').value=project.swing+'%';$('#master').value=project.master;$('#master-value').value=project.master+'%';$('#undo').disabled=!undoStack.length;$('#redo').disabled=!redoStack.length;
 const solo=project.tracks.some(t=>t.solo);
 project.tracks.forEach((t,i)=>{const row=$(`.track-row[data-track="${i}"]`);row.classList.toggle('muted',t.mute||solo&&!t.solo);row.querySelector('.track-label').classList.toggle('selected',i===selected);row.querySelectorAll('.step').forEach((b,s)=>{b.classList.toggle('active',t.steps[s]!==null);b.classList.toggle('edited',melodic(t)&&i===selected&&s===selectedStep);b.setAttribute('aria-pressed',t.steps[s]!==null);b.querySelector('.pitch').textContent=melodic(t)&&t.steps[s]!==null?midiName(t.steps[s]):'';b.setAttribute('aria-label',`${t.name} 第 ${s+1} 步${t.steps[s]!==null&&melodic(t)?' '+midiName(t.steps[s]):''}`);});$(`[data-volume="${i}"]`).value=t.volume;$(`#vol-${i}`).value=t.volume;for(const prop of ['solo','mute']){const b=$(`[data-${prop}="${i}"]`);b.classList.toggle('on',t[prop]);b.setAttribute('aria-pressed',t[prop]);}});
 const t=project.tracks[selected];$('#voice-title').textContent=t.name;$('#voice-sub').textContent=t.short+' / 0'+(selected+1);$('#voice-kind').textContent=melodic(t)?'MELODIC SYNTH':'DRUM SYNTH';$('#track-color').style.background=color(t);$('#audition').style.color=color(t);$('#tune').value=t.tune;$('#tune-value').value=(t.tune>0?'+':'')+t.tune+' st';$('#decay').value=t.decay;$('#decay-value').value=t.decay+'%';$('#note-editor').hidden=!melodic(t);$('#melodic-settings').hidden=!melodic(t);$('#selected-step').textContent=selectedStep+1;$('#note').value=t.steps[selectedStep]??(t.id==='bass'?36:60)+project.root;$('#waveform').value=t.waveform;$('#pan').value=t.pan;$('#pan-value').value=t.pan===0?'中央':`${t.pan<0?'L':'R'} ${Math.abs(t.pan)}`;
 $('#generator-track').textContent=t.name+' · '+letters[project.pattern];$('#root').value=project.root;$('#scale').value=project.scale;
 letters.forEach((_,i)=>{const b=$(`[data-pattern="${i}"]`);b.classList.toggle('selected',project.pattern===i);b.setAttribute('aria-pressed',project.pattern===i);const n=project.patterns[i].steps.flat().filter(n=>n!==null).length;$(`#pattern-count-${i}`).textContent=n?n+' 音符':'空白';});
 $('#song-mode').classList.toggle('on',project.songMode);$('#song-mode').setAttribute('aria-pressed',project.songMode);$('#chain').innerHTML=project.chain.map((n,i)=>`<button data-chain="${i}" class="chain-step" aria-label="移除播放顺序中的第 ${i+1} 段 ${letters[n]}"><span>${String(i+1).padStart(2,'0')}</span>${letters[n]} <small>×</small></button>`).join('');
 for(const prop of ['filter','drive','delay','reverb']){$('#'+prop).value=project.effects[prop];const hz=filterHz(project.effects.filter);$('#'+prop+'-value').value=prop==='filter'?(hz>=1000?(hz/1000).toFixed(1)+' kHz':hz+' Hz'):project.effects[prop]+'%';}
 $('#record').classList.toggle('on',recording);$('#record').setAttribute('aria-pressed',recording);$('#record-state').textContent=recording?'演奏会对齐最近一步':'键盘 A S D F G H J K';exportDescription();previous='';listeners.forEach(fn=>fn());
}
function transport(){const on=engine.playing;$('#play').classList.toggle('playing',on);$('#play-icon').textContent=on?'Ⅱ':'▶';$('#play-label').textContent=on?'暂停':'播放';$('#status').textContent=on?project.name+' · '+(project.songMode?'串联播放':'循环播放'):'点击播放，开始你的节奏';$('#audio-state').textContent=on?'播放中':'待机';$('#pattern-state').textContent=`编辑 ${letters[project.pattern]} · ${project.songMode?'串联播放':'单段循环'}`;}
async function togglePlay(){if(busy)return;busy=true;try{if(engine.playing)engine.pause();else await engine.play();transport();}catch(e){toast(e.message);}finally{busy=false;}}
$('#play').onclick=togglePlay;$('#stop').onclick=()=>{engine.pause(true);recording=false;render();transport();};
document.addEventListener('keydown',e=>{
 const tag=document.activeElement.tagName;if(document.body.classList.contains('loading'))return;if($('#help-dialog').open||['INPUT','SELECT','TEXTAREA'].includes(tag))return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restoreHistory(e.shiftKey?redoStack:undoStack,e.shiftKey?undoStack:redoStack);return;}
 if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
 if(e.code==='Space'&&tag!=='BUTTON'){e.preventDefault();togglePlay();return;}
 const i=padKeys.indexOf(e.key.toLowerCase());if(i>=0){e.preventDefault();hitPad(i);}
});
$('#tracks').onclick=e=>{const select=e.target.closest('[data-select]');if(select){selected=Number(select.dataset.select);render();return;}const b=e.target.closest('.step');if(!b)return;selected=Number(b.dataset.track);selectedStep=Number(b.dataset.step);if(e.shiftKey){render();return;}mutate(()=>{const t=project.tracks[selected];t.steps[selectedStep]=t.steps[selectedStep]===null?(t.id==='bass'?36:60)+project.root:null;});};
$('#tracks').oncontextmenu=e=>{const b=e.target.closest('.step');if(!b)return;e.preventDefault();selected=Number(b.dataset.track);selectedStep=Number(b.dataset.step);render();};
$('#note').onchange=e=>mutate(()=>project.tracks[selected].steps[selectedStep]=Number(e.target.value));
$('#mixer').addEventListener('input',e=>{if(e.target.dataset.volume!==undefined){const i=Number(e.target.dataset.volume);mutate(()=>project.tracks[i].volume=Number(e.target.value),'volume-'+i);}});
$('#mixer').onclick=e=>{const b=e.target.closest('button');if(!b)return;for(const prop of ['solo','mute'])if(b.dataset[prop]!==undefined)mutate(()=>{const t=project.tracks[Number(b.dataset[prop])];t[prop]=!t[prop];});};
$('#bpm').onchange=e=>{const n=Number(e.target.value);mutate(()=>project.bpm=Number.isFinite(n)?Math.min(180,Math.max(60,Math.round(n))):120);};
for(const prop of ['swing','master'])$('#'+prop).oninput=e=>mutate(()=>project[prop]=Number(e.target.value),prop);
for(const prop of ['tune','decay','pan'])$('#'+prop).oninput=e=>mutate(()=>project.tracks[selected][prop]=Number(e.target.value),prop+'-'+selected);
$('#waveform').onchange=e=>mutate(()=>project.tracks[selected].waveform=e.target.value);
for(const prop of ['root','scale'])$('#'+prop).onchange=e=>mutate(()=>project[prop]=prop==='root'?Number(e.target.value):e.target.value);
for(const prop of ['filter','drive','delay','reverb'])$('#'+prop).oninput=e=>mutate(()=>project.effects[prop]=Number(e.target.value),'fx-'+prop);
$('#reset-fx').onclick=()=>mutate(()=>project.effects={filter:100,drive:0,delay:0,reverb:0});
$('#patterns').onclick=e=>{const b=e.target.closest('[data-pattern]');if(!b)return;project.pattern=Number(b.dataset.pattern);attach(project);render();changed();transport();};
$('#copy-pattern').onclick=()=>{const target=Number($('#copy-to').value);if(target===project.pattern){toast('请选择另一个目标段落');return;}if(project.patterns[target].steps.flat().some(n=>n!==null)&&!confirm(`覆盖段落 ${letters[target]} 的音符？可撤销。`))return;mutate(()=>{project.patterns[target].steps=project.tracks.map(t=>[...t.steps]);project.patterns[target].attributes=structuredClone(project.patterns[project.pattern].attributes);});toast(`已将 ${letters[project.pattern]} 复制到 ${letters[target]}`);};
function stopForArrangement(){engine.pause(true);recording=false;}
$('#song-mode').onclick=()=>mutate(()=>{stopForArrangement();project.songMode=!project.songMode;});
$('#chain').onclick=e=>{const b=e.target.closest('[data-chain]');if(!b)return;if(project.chain.length===1){toast('至少保留一个段落');return;}mutate(()=>{stopForArrangement();project.chain.splice(Number(b.dataset.chain),1);});};
$('#add-chain').onclick=()=>{if(project.chain.length>=16){toast('最多 16 段');return;}mutate(()=>{stopForArrangement();project.chain.push(Number($('#chain-add').value));});};
for(const prop of ['pulses','offset'])$('#'+prop).oninput=e=>$('#'+prop+'-value').value=e.target.value+(prop==='pulses'?' / 16':'');
$('#generate').onclick=()=>mutate(()=>generateTrack(project,selected,Number($('#pulses').value),Number($('#offset').value)));
$('#variation').onclick=()=>mutate(()=>{generateTrack(project,selected,Number($('#pulses').value),Math.floor(Math.random()*16),true);});
$('#rotate').onclick=()=>mutate(()=>{const row=project.tracks[selected].steps;row.unshift(row.pop());const attrs=project.patterns[project.pattern].attributes[selected];attrs.unshift(attrs.pop());attrs.forEach((a,s)=>a.duration=Math.min(a.duration,16-s));});
$('#clear-track').onclick=()=>mutate(()=>project.tracks[selected].steps.fill(null));
async function hitPad(i){const t=project.tracks[i],pitch=melodic(t)?i===selected?Number($('#note').value):(i===6?36:60)+project.root:60;const at=recording&&engine.playing?engine.recordPosition():null;if(at)mutate(()=>project.patterns[at.pattern].steps[i][at.step]=pitch);const b=$(`[data-pad="${i}"]`);b.classList.add('hit');setTimeout(()=>b.classList.remove('hit'),150);try{await engine.audition(t,pitch);}catch(e){toast(e.message);}}
$('#pads').onpointerdown=e=>{const b=e.target.closest('[data-pad]');if(!b)return;b.focus();hitPad(Number(b.dataset.pad));};
$('#pads').onclick=e=>{if(e.detail===0){const b=e.target.closest('[data-pad]');if(b)hitPad(Number(b.dataset.pad));}};
$('#record').onclick=async()=>{recording=!recording;if(recording&&!engine.playing)await togglePlay();if(!engine.playing)recording=false;render();};
$('#audition').onclick=()=>engine.audition(project.tracks[selected],melodic(project.tracks[selected])?Number($('#note').value):60).catch(e=>toast(e.message));
function replace(p){clearTimeout(saveTimer);checkpoint();engine.pause(true);recording=false;project=p;selected=0;selectedStep=0;render();transport();save();}
$('#load-preset').onclick=()=>{if(!confirm('载入预设将替换当前工程的全部段落。可撤销。'))return;replace(makePreset($('#preset').value));toast('预设已载入 A 段，点击播放试听');};
$('#clear').onclick=()=>{if(!confirm(`清空段落 ${letters[project.pattern]} 的所有音符？可撤销。`))return;mutate(()=>{project.tracks.forEach(t=>t.steps.fill(null));});toast('当前段落已清空');};
$('#save').onclick=()=>save(true);
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('#export-project').onclick=()=>{download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'groovebox-project.json');toast('工程已导出，包含全部段落、效果和采样');};
$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>45000000)throw new Error('工程文件过大');const p=validate(JSON.parse(await f.text()));const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;await prepareSamples(p,new Offline(1,1,44100));if(!confirm('导入工程将替换当前工程。可撤销。'))return;replace(p);toast('工程已导入');}catch(err){toast(err instanceof SyntaxError?'无法读取工程，请选择有效的 JSON 文件':err.message);}finally{e.target.value='';}};
$('#export-repeats').onchange=exportDescription;
$('#export-wav').onclick=async()=>{const b=$('#export-wav');b.disabled=true;b.textContent='正在渲染…';try{const snapshot=structuredClone(project),repeats=Number($('#export-repeats').value),blob=await renderWav(snapshot,repeats);download(blob,`groovebox-${snapshot.songMode?'song':letters[snapshot.pattern]}-${snapshot.bpm}bpm.wav`);toast('WAV 已导出，包含混音、效果和尾音');}catch(e){toast('导出失败：'+e.message);}finally{b.disabled=false;b.textContent='导出 WAV';}};
$('#help').onclick=()=>$('#help-dialog').showModal();for(const id of ['close-help','help-done'])$('#'+id).onclick=()=>$('#help-dialog').close();
window.addEventListener('pagehide',()=>{save();engine.pause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&engine.playing){engine.pause();transport();$('#status').textContent='页面进入后台，已暂停播放';}});
let previous='';const canvas=$('#scope'),drawing=canvas.getContext('2d'),wave=new Uint8Array(512);
function frame(){const step=engine.position(),pattern=engine.activePattern,key=step+':'+pattern+':'+project.pattern;if(key!==previous){document.querySelectorAll('.current').forEach(b=>b.classList.remove('current'));if(step>=0&&pattern===project.pattern)document.querySelectorAll(`[data-step="${step}"]`).forEach(b=>b.classList.add('current'));document.querySelectorAll('.pattern-btn').forEach((b,i)=>b.classList.toggle('running',step>=0&&i===pattern));if(engine.playing&&step>=0)$('#pattern-state').textContent=`编辑 ${letters[project.pattern]} · 播放 ${letters[pattern]} / 第 ${String(step+1).padStart(2,'0')} 步`;previous=key;}drawing.clearRect(0,0,280,90);drawing.strokeStyle='#263728';drawing.lineWidth=1;for(let x=0;x<280;x+=28){drawing.beginPath();drawing.moveTo(x,0);drawing.lineTo(x,90);drawing.stroke();}drawing.strokeStyle='#84d5c5';drawing.lineWidth=1.5;drawing.beginPath();if(engine.analyser)engine.analyser.getByteTimeDomainData(wave);else wave.fill(128);for(let i=0;i<wave.length;i++){const x=i/wave.length*280,y=45+(wave[i]-128)/128*40;i?drawing.lineTo(x,y):drawing.moveTo(x,y);}drawing.stroke();requestAnimationFrame(frame);}
render();transport();frame();

export const studio={get project(){return project;},get selected(){return selected;},get step(){return selectedStep;},engine,mutate,replace,render,save,toast,download,
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},setPersistence(fn){persistence=fn;},async flush(){clearTimeout(saveTimer);return await save();},
 select(track,step=selectedStep){selected=track;selectedStep=step;render();},
 load(p){clearTimeout(saveTimer);engine.pause(true);recording=false;project=validate(p);selected=0;selectedStep=0;undoStack.length=0;redoStack.length=0;render();transport();}
};
