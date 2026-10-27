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
  function events(track,step,racing=true){
    const theme=THEMES[((track%THEMES.length)+THEMES.length)%THEMES.length],bar=Math.floor(step/16)%32,s=step%16;
    const chordIndex=Math.floor(step/16)%4,offset=[0,-4,3,-2][chordIndex],root=theme.root+offset;
    const notes=chordIndex===0?[0,3,7]:[0,4,7],out=[];
    const add=(instrument,n,duration,gain)=>out.push({instrument,frequency:midi(n),duration,gain});
    if(s===0)for(const n of notes)add('pad',root+n+12,1.55,racing ? .08 : .12);
    if(!racing){if(s%4===0)add('bell',root+notes[(s/4)%3]+24,.7,.12);return out;}
    const breakdown=bar>=12&&bar<16;
    if(s%4===0&&!breakdown)out.push({instrument:'kick',gain:.9,duration:.22,frequency:145});
    if(s===4||s===12)out.push({instrument:'snare',gain:breakdown ? .12 : .28,duration:.14,frequency:1800});
    if(s%2===0)out.push({instrument:'hat',gain:s%4===2 ? .11 : .065,duration:s%4===2 ? .09 : .045,frequency:8500});
    if(s===3||s===10||s===14)out.push({instrument:'hat',gain:.035,duration:.03,frequency:10000});
    if(s%2===0&&!breakdown)add('bass',root-12+(s===14?7:0),.15,.20);
    if(s%2===1)add('arp',root+notes[Math.floor(s/2)%3]+24,.10,breakdown ? .075 : .035);
    const melody=MELODY[Math.floor(step/16)%4][s];
    if(melody!=null&&!breakdown)add('lead',theme.root+melody,.16,.11);
    if(bar%8===7&&s>=12)out.push({instrument:'snare',gain:.07+(s-12)*.025,duration:.07,frequency:2200});
    return out;
  }
  return {THEMES,MELODY,midi,events};
});
