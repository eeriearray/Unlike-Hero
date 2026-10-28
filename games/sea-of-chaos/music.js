// An original 32-bar minor-key sea jig. No fetched audio or large sample bank.
// Six eighth notes per bar; A/A/B/B phrases alternate whistle and mandolin lead.
export const EIGHTH=60/116/2;
const A=[
 [76,79,83,83,81,79],[78,81,83,86,83,81],[79,76,74,76,-1,71],[74,78,81,78,-1,74],
 [76,79,83,88,86,83],[81,83,86,83,81,78],[79,76,74,71,74,78],[76,-1,0,71,74,76]
];
const B=[
 [83,86,88,90,88,86],[83,81,79,81,83,86],[88,86,83,79,81,83],[86,83,81,78,-1,74],
 [79,83,88,91,90,88],[86,83,81,83,86,90],[88,86,83,81,79,78],[76,-1,0,74,76,79]
];
const CHORDS=[[52,55,59],[50,54,57],[48,52,55],[47,51,54],[52,55,59],[50,54,57],[48,52,55],[47,54,59]];
export const MUSIC_THEMES={harbor:'Harbor Lights',voyage:'Corsair Run',battle:'Iron & Thunder',finale:'The Last Lantern'};
const HARBOR=[[72,76,79,83,79,76],[74,77,81,84,81,77],[76,79,83,86,83,79],[74,71,67,71,-1,74],[72,76,79,84,83,79],[77,81,84,88,84,81],[76,79,83,79,76,72],[74,71,67,71,74,76]];
const BATTLE=[[64,64,71,67,74,71],[62,69,66,74,69,66],[60,67,72,67,76,72],[59,66,71,74,71,66],[64,71,76,79,76,71],[62,69,74,78,74,69],[60,67,76,72,67,64],[59,66,75,78,75,71]];
const FINALE=[[76,83,88,86,83,79],[78,81,86,90,86,81],[79,83,88,91,88,83],[78,83,87,90,87,83],[76,79,83,88,91,88],[78,81,86,90,93,90],[79,83,88,91,95,91],[78,75,71,75,78,83]];
export function musicThemeFor(active,energy=.2,phase=''){if(!active)return 'harbor';if(phase==='finale')return 'finale';if(phase==='opening')return 'voyage';return phase==='raid'||energy>.62?'battle':'voyage';}
export function beatFor(theme){return EIGHTH*({harbor:1.22,voyage:1,battle:.93,finale:.86}[theme]||1);}
export function scoreAt(step,energy=.2,playing=true,theme='voyage'){
 const bar=Math.floor(step/6)%32,slot=step%6,chord=CHORDS[bar%8],phrase=(theme==='harbor'?HARBOR:theme==='battle'?BATTLE:theme==='finale'?FINALE:bar<16?A:B)[bar%8],notes=[],beat=beatFor(theme);
 const push=(voice,midi,duration,gain,pan=0)=>notes.push({voice,midi,duration,gain,pan});
 // A swaying low bass and off-beat accordion sustain the jig's 6/8 meter.
 if(slot===0||slot===3){push('bass',chord[slot===0?0:2]-12,beat*2.6,.12);if(playing)push('drum',0,.17,slot===0?.19:.12);}
 if(slot===1||slot===4)for(const midi of chord)push('accordion',midi+12,beat*1.65,playing?.027:.015,-.32);
 if(playing||slot%3===0)push('pluck',chord[[0,2,1,2,0,1][slot]]+24,beat*1.5,playing?.065:.04,.4);
 if((playing||theme==='harbor')&&phrase[slot]>0){let hold=1;while(slot+hold<6&&phrase[slot+hold]===-1)hold++;
  push(theme==='harbor'?'bell':theme==='battle'?'fiddle':bar%16<8?'whistle':'fiddle',phrase[slot],beat*hold*.9,playing?.075+energy*.022:.04,-.08);
 }
 if(playing&&energy>.45){push('brush',0,.07,.025+energy*.015,.55);if(slot===5)push('pluck',chord[1]+24,beat*.7,.04,-.5);}
 if(playing&&energy>.75&&slot===0)push('horn',chord[0]+12,beat*2.4,.045,-.2);
 if((theme==='battle'||theme==='finale')&&playing){if(slot===2||slot===5)push('drum',0,.12,.09,.15);if(slot===0||slot===3)push('strings',chord[0]+12,beat*2.8,.037,-.45);if(theme==='finale'&&slot%2===0)push('bell',chord[2]+24,beat*1.4,.035,.45);}
 return notes;
}
export function createMusic(ctx,destination){
 const bus=ctx.createGain();bus.gain.value=.7;bus.connect(destination);
 const room=ctx.createDelay(.5);room.delayTime.value=EIGHTH*.75;
 const echo=ctx.createGain();echo.gain.value=.16;const echoFilter=ctx.createBiquadFilter();echoFilter.frequency.value=1800;
 room.connect(echoFilter).connect(echo).connect(bus);
 let reverb,wet;if(ctx.createConvolver){reverb=ctx.createConvolver();wet=ctx.createGain();wet.gain.value=.11;const impulse=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.85),ctx.sampleRate),samples=impulse.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/samples.length,3);reverb.buffer=impulse;echoFilter.connect(reverb).connect(wet).connect(bus);}
 const noise=ctx.createBuffer(1,ctx.sampleRate*.25,ctx.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 let next=ctx.currentTime+.06,step=0,energy=.2,target=.2,playing=false,enabled=true,stopped=false,theme='harbor',requested='harbor';
 const hz=n=>440*2**((n-69)/12);
 function play(note,at){const {voice,midi,duration,gain,pan}=note;const amp=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value={whistle:3200,fiddle:2300,accordion:1450,pluck:2600,horn:1000,bass:480,drum:350,brush:4000,bell:4500,strings:1900}[voice];
  const panner=ctx.createStereoPanner?.();amp.connect(filter);if(panner){panner.pan.value=pan;filter.connect(panner).connect(bus);}else filter.connect(bus);
  if(['whistle','fiddle','pluck','bell','strings'].includes(voice))filter.connect(room);
  amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(gain,at+(voice==='pluck'?.007:voice==='horn'?.07:.025));amp.gain.exponentialRampToValueAtTime(.0001,at+duration);
  let source,vibrato,vibratoGain;
  if(voice==='brush'){source=ctx.createBufferSource();source.buffer=noise;filter.type='highpass';filter.frequency.value=2600;}
  else{source=ctx.createOscillator();source.type={whistle:'sine',fiddle:'sawtooth',accordion:'triangle',pluck:'triangle',horn:'sawtooth',bass:'sine',drum:'sine',bell:'sine',strings:'sawtooth'}[voice]||'sine';source.frequency.setValueAtTime(voice==='drum'?105:hz(midi),at);if(voice==='drum')source.frequency.exponentialRampToValueAtTime(42,at+duration);
   if(voice==='whistle'||voice==='fiddle'){vibrato=ctx.createOscillator();vibratoGain=ctx.createGain();vibrato.frequency.value=5.2;vibratoGain.gain.value=voice==='whistle'?2:3;vibrato.connect(vibratoGain).connect(source.frequency);vibrato.start(at);vibrato.stop(at+duration+.02);}
  }
  source.connect(amp);source.start(at);source.stop(at+duration+.03);
  source.onended=()=>{source.disconnect();amp.disconnect();filter.disconnect();panner?.disconnect();vibrato?.disconnect();vibratoGain?.disconnect();};
 }
 function schedule(){if(stopped||ctx.state!=='running')return;if(next<ctx.currentTime-.2)next=ctx.currentTime+.03;let count=0;while(next<ctx.currentTime+.14&&count++<4){energy+=(target-energy)*.1;if(step%6===0)theme=requested;if(enabled)for(const n of scoreAt(step,energy,playing,theme))play(n,next);next+=beatFor(theme);step++;}}
 const timer=setInterval(schedule,40);
 return {scene(active,intensity,phase){playing=active;requested=musicThemeFor(active,intensity,phase);target=Math.max(0,Math.min(1,intensity));},enable(value){enabled=value;bus.gain.setTargetAtTime(value?.7:0,ctx.currentTime,.12);},stop(){stopped=true;clearInterval(timer);bus.disconnect();room.disconnect();echo.disconnect();echoFilter.disconnect();reverb?.disconnect();wet?.disconnect();}};
}
