(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CrownScore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Original 32-bar arcade score. All voices share a sixteenth-note clock.
  const THEMES=[
    {name:'Crown on the Run',bpm:146,root:50,voice:'sawtooth'},
    {name:'Furnace Heart',bpm:150,root:45,voice:'square'},
    {name:'Moonlit Pursuit',bpm:140,root:52,voice:'triangle'},
    {name:'Fall of Kings',bpm:144,root:48,voice:'sawtooth'},
    {name:'Glacier Rush',bpm:148,root:55,voice:'triangle'},
    {name:'Witchwood Run',bpm:138,root:47,voice:'square'},
    {name:'Thunder Crown',bpm:154,root:50,voice:'sawtooth'},
    {name:'Clockwork Hearts',bpm:142,root:53,voice:'triangle'}
  ];
  const MELODY=[
    [12,null,12,15,19,null,17,null,15,null,12,10,12,null,7,null],
    [10,null,10,12,15,null,19,null,17,15,12,null,10,null,7,null],
    [19,null,19,22,24,null,22,19,17,null,15,null,17,19,15,null],
    [17,null,15,12,10,null,12,15,12,null,7,null,10,7,3,null]
  ];
  const midi=n=>440*Math.pow(2,(n-69)/12);
  // Every course is in natural minor on its theme root; the chords run i–VI–III–VII.
  const SCALE=[0,2,3,5,7,8,10];
  // Layer 1 is the pad bed, layer 2 adds bass and drums, layer 3 the arpeggio and lead.
  const LAYER={pad:1,bell:1,kick:2,snare:2,hat:2,bass:2,arp:3,lead:3};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const themeOf=track=>THEMES[((track%THEMES.length)+THEMES.length)%THEMES.length];
  const inKey=(track,note)=>SCALE.includes((((Math.round(note)-themeOf(track).root)%12)+12)%12);
  // How hard the race is pushing, 0–1: running near the front, fighting someone wheel to wheel, and the closing gates all raise it.
  function intensity({place=1,count=8,gap=Infinity,progress=0,final=false}={}){
    const rank=count>1?1-(clamp(place,1,count)-1)/(count-1):1;
    const close=Number.isFinite(gap)?clamp(1-(gap-4)/26,0,1):0;
    return clamp(.12+rank*.28+close*.35+clamp(progress,0,1)*.15+(final?.3:0),0,1);
  }
  // Hysteresis keeps the arrangement from flickering when intensity sits on a threshold.
  function layersFor(level,current=1){
    if(current>=3)return level<.56?(level<.28?1:2):3;
    if(current===2)return level>=.68?3:level<.28?1:2;
    return level>=.68?3:level>=.38?2:1;
  }
  function events(track,step,racing=true,{layers=3,final=false}={}){
    const out=raw(track,step,racing,final);
    return layers>=3?out:out.filter(event=>(LAYER[event.instrument]||1)<=layers);
  }
  // A rising run over the countdown that lands on the tonic chord at GO. Times are seconds from the start of the count.
  function stinger(track,length=3){
    const theme=themeOf(track),out=[],steps=12;
    for(let i=0;i<steps;i++){const degree=SCALE[i%7]+12*Math.floor(i/7),at=length*(1-Math.pow(1-i/steps,1.35));out.push({instrument:'bell',frequency:midi(theme.root+12+degree),duration:.22,gain:.05+i*.006,at});}
    for(const n of [0,7,12,15])out.push({instrument:n===0?'bass':'pad',frequency:midi(theme.root+(n===0?-12:n)),duration:n===0?.5:1.3,gain:n===0?.2:.1,at:length});
    out.push({instrument:'kick',frequency:145,duration:.3,gain:.9,at:length});
    return out;
  }
  // First place resolves up to the relative major (the III chord); anything else gets a soft falling i–VI–i outro.
  function fanfare(track,win=true){
    const r=themeOf(track).root,out=[];
    if(win){
      [[3,0],[7,.14],[10,.28],[15,.42],[19,.62]].forEach(([n,at])=>out.push({instrument:'lead',frequency:midi(r+12+n),duration:n===19?1.1:.2,gain:.12,at}));
      for(const n of [3,7,10,15])out.push({instrument:'pad',frequency:midi(r+12+n),duration:2.2,gain:.08,at:.62});
      out.push({instrument:'bass',frequency:midi(r-9),duration:1.2,gain:.18,at:.62},{instrument:'kick',frequency:145,duration:.3,gain:.8,at:.62},{instrument:'snare',frequency:1800,duration:.25,gain:.2,at:.62});
    }else{
      [[[-4,0,3],0],[[-2,2,5],1.1],[[0,3,7],2.2]].forEach(([chord,at])=>{for(const n of chord)out.push({instrument:'pad',frequency:midi(r+12+n),duration:1.6,gain:.07,at});});
      [[15,.2],[14,1.3],[12,2.4]].forEach(([n,at])=>out.push({instrument:'bell',frequency:midi(r+12+n),duration:1,gain:.07,at}));
    }
    return out;
  }
  function raw(track,step,racing,final){
    const theme=themeOf(track),bar=Math.floor(step/16)%32,s=step%16;
    const chordIndex=Math.floor(step/16)%4,offset=[0,-4,3,-2][chordIndex],root=theme.root+offset;
    const notes=chordIndex===0?[0,3,7]:[0,4,7],out=[];
    const add=(instrument,n,duration,gain)=>out.push({instrument,frequency:midi(n),duration,gain});
    if(s===0)for(const n of notes)add('pad',root+n+12,1.55,racing ? .08 : .12);
    if(!racing){if(s%4===0)add('bell',root+notes[(s/4)%3]+24,.7,.12);return out;}
    // The final stretch skips the breakdown, doubles the hats, pushes the bass into octaves and lifts the lead an octave.
    const breakdown=!final&&bar>=12&&bar<16;
    if(s%4===0&&!breakdown)out.push({instrument:'kick',gain:.9,duration:.22,frequency:145});
    if(final&&s===14)out.push({instrument:'kick',gain:.6,duration:.18,frequency:145});
    if(s===4||s===12)out.push({instrument:'snare',gain:breakdown ? .12 : .28,duration:.14,frequency:1800});
    if(s%2===0)out.push({instrument:'hat',gain:s%4===2 ? .11 : .065,duration:s%4===2 ? .09 : .045,frequency:8500});
    if(final?s%2===1:(s===3||s===10||s===14))out.push({instrument:'hat',gain:final?.05:.035,duration:.03,frequency:10000});
    if(s%2===0&&!breakdown)add('bass',root-12+(s===14?7:final&&s%4===2?12:0),.15,.20);
    if(s%2===1)add('arp',root+notes[Math.floor(s/2)%3]+24,.10,breakdown ? .075 : .035);
    const melody=MELODY[Math.floor(step/16)%4][s];
    if(melody!=null&&!breakdown)add('lead',theme.root+melody+(final?12:0),.16,final?.09:.11);
    if(bar%8===7&&s>=12)out.push({instrument:'snare',gain:.07+(s-12)*.025,duration:.07,frequency:2200});
    return out;
  }
  return {THEMES,MELODY,SCALE,LAYER,midi,inKey,intensity,layersFor,events,stinger,fanfare};
});
