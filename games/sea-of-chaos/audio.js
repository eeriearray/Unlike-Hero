import {effectFor} from './sound-design.js';
import {createMusic} from './music.js';
let ctx,master,effectsBus,ambience,wind,whirlNoise,noiseBuffer,music,muted=false,unlocked=false;
let musicEnabled=true;try{musicEnabled=localStorage.getItem('soc-music')!=='off';muted=localStorage.getItem('soc-effects')==='off';}catch{}
let sceneActive=false,intensity=.15,audioPhase='',voiceCount=0;const last={};
export function unlockAudio(){if(unlocked){if(ctx?.state==='suspended'&&!document.hidden)ctx.resume().catch(()=>{});return;}
 try{
  ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.36;const limiter=ctx.createDynamicsCompressor?.();if(limiter){limiter.threshold.value=-18;limiter.knee.value=18;limiter.ratio.value=4;limiter.attack.value=.006;limiter.release.value=.18;master.connect(limiter).connect(ctx.destination);}else master.connect(ctx.destination);
  effectsBus=ctx.createGain();effectsBus.gain.value=muted?0:1;effectsBus.connect(master);unlocked=true;
  const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);let v=0;
  noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const noise=noiseBuffer.getChannelData(0);
  for(let i=0;i<data.length;i++){v=(v+Math.random()*.04-.02)*.98;data[i]=v;if(i<noise.length)noise[i]=Math.random()*2-1;}
  const waves=ctx.createBufferSource();waves.buffer=buffer;waves.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=550;
  ambience=ctx.createGain();ambience.gain.value=.15;waves.connect(filter).connect(ambience).connect(effectsBus);waves.start();
  const breeze=ctx.createBufferSource();breeze.buffer=buffer;breeze.loop=true;const windFilter=ctx.createBiquadFilter();windFilter.type='bandpass';windFilter.frequency.value=1000;windFilter.Q.value=.4;
  wind=ctx.createGain();wind.gain.value=.06;breeze.connect(windFilter).connect(wind).connect(effectsBus);breeze.start();
  const churn=ctx.createBufferSource();churn.buffer=noiseBuffer;churn.loop=true;const churnFilter=ctx.createBiquadFilter();churnFilter.type='bandpass';churnFilter.frequency.value=480;churnFilter.Q.value=.6;whirlNoise=ctx.createGain();whirlNoise.gain.value=0;churn.connect(churnFilter).connect(whirlNoise).connect(effectsBus);churn.start();
  music=createMusic(ctx,master);music.enable(musicEnabled);music.scene(sceneActive,intensity,audioPhase);ctx.resume().catch(()=>{});
 }catch(error){console.warn('Sea audio could not start',error);}}
function noise(at,length,volume,frequency,pan){if(voiceCount>=32)return;voiceCount++;const source=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();source.buffer=noiseBuffer;f.type='lowpass';f.frequency.value=frequency;g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.001,at+length);source.connect(f).connect(g);
 const p=ctx.createStereoPanner?.();if(p){p.pan.value=Math.max(-1,Math.min(1,pan));g.connect(p).connect(effectsBus);}else g.connect(effectsBus);source.start(at);source.stop(at+length);source.onended=()=>{voiceCount=Math.max(0,voiceCount-1);source.disconnect();g.disconnect();f.disconnect();p?.disconnect();};}
export function sound(kind,pan=0,volume=1){if(!ctx||muted||document.hidden)return;const recipe=effectFor(kind),t=ctx.currentTime;if(t-(last[kind]??-99)<recipe.cooldown)return;last[kind]=t;volume=Math.max(0,Math.min(1,volume));
 if(recipe.noise){const n=recipe.noise;noise(t+n.offset,n.length,n.gain*volume,n.frequency,pan);}
 for(const note of recipe.tones){if(voiceCount>=32)break;voiceCount++;const at=t+note.offset,o=ctx.createOscillator(),g=ctx.createGain();o.type=note.wave;o.frequency.setValueAtTime(note.frequency,at);o.frequency.exponentialRampToValueAtTime(note.end,at+note.length);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.max(.0002,note.gain*volume),at+Math.min(.012,note.length*.2));g.gain.exponentialRampToValueAtTime(.0001,at+note.length);o.connect(g);const p=ctx.createStereoPanner?.();if(p){p.pan.value=Math.max(-1,Math.min(1,pan));g.connect(p).connect(effectsBus);}else g.connect(effectsBus);o.start(at);o.stop(at+note.length+.02);o.onended=()=>{voiceCount=Math.max(0,voiceCount-1);o.disconnect();g.disconnect();p?.disconnect();};}
}
export function pauseAudio(paused){if(!ctx)return;if(paused)ctx.suspend().catch(()=>{});else if(unlocked)ctx.resume().catch(()=>{});}
export function toggleMute(){muted=!muted;if(effectsBus)effectsBus.gain.setTargetAtTime(muted?0:1,ctx.currentTime,.06);try{localStorage.setItem('soc-effects',muted?'off':'on');}catch{}return muted;}
export function toggleMusic(){musicEnabled=!musicEnabled;music?.enable(musicEnabled);try{localStorage.setItem('soc-music',musicEnabled?'on':'off');}catch{}return musicEnabled;}
export function isEffectsOn(){return !muted;}
export function isMusicOn(){return musicEnabled;}
export function musicScene(active,energy=.15,phase){sceneActive=active;intensity=energy;if(phase!==undefined)audioPhase=phase;if(!active)audioPhase='harbor';music?.scene(active,energy,audioPhase);}
export function seaAudio(speed,energy=.15,nearWhirlpool=false,phase=''){if(!ctx||document.hidden)return;ambience.gain.setTargetAtTime(.1+Math.min(28,Math.abs(speed))*.004,ctx.currentTime,.6);wind.gain.setTargetAtTime(.04+Math.min(28,Math.abs(speed))*.003,ctx.currentTime,.6);whirlNoise.gain.setTargetAtTime(nearWhirlpool?.035:0,ctx.currentTime,.7);musicScene(sceneActive,energy,phase);}
