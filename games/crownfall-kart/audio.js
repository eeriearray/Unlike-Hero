(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const MUSIC_LEVEL=.46,DUCK=.708,VOICE_LIMIT=90; // DUCK is -3 dB
  // Each weight class gets its own motor: base pitch, how much whine rides on top and how dark the rumble is.
  const ENGINE_TONE={light:{base:58,span:120,whine:2.6,rumble:.75,cutoff:1.25},medium:{base:46,span:105,whine:2.2,rumble:1,cutoff:1},heavy:{base:34,span:90,whine:1.75,rumble:1.3,cutoff:.8}};
  // Five fake gears, spaced wider at the top. The pitch drops at each shift and climbs through the gear.
  function engineRpm(speed,topSpeed,gears=5){
    const ratio=clamp(Math.abs(speed)/Math.max(1,topSpeed),0,1.3),edges=[0,.16,.34,.54,.76,1.3];
    let gear=0;while(gear<gears-1&&ratio>=edges[gear+1])gear++;
    return {gear:gear+1,rpm:.28+.72*clamp((ratio-edges[gear])/(edges[gear+1]-edges[gear]),0,1)};
  }
  // Exaggerated doppler (slow "speed of sound") so passing karts read clearly. Screen right is (-cos yaw, sin yaw).
  function doppler(listener,source,c=95){
    const dx=source.x-listener.x,dz=source.z-listener.z,d=Math.max(.5,Math.hypot(dx,dz)),ux=dx/d,uz=dz/d;
    const toListener=-((source.vx||0)*ux+(source.vz||0)*uz),toSource=(listener.vx||0)*ux+(listener.vz||0)*uz;
    const factor=clamp((c+toSource)/Math.max(20,c-toListener),.65,1.5);
    const gain=d>48?0:clamp(1/(1+(d/7)**2),0,1)*clamp((48-d)/12,0,1);
    const pan=clamp((ux*-Math.cos(listener.yaw||0)+uz*Math.sin(listener.yaw||0))*.85,-.85,.85);
    return {factor,gain,pan,distance:d};
  }
  function finalStretch(world,k){
    if(!world||!k)return false;
    if(world.mode==='battle')return world.racers.filter(r=>!r.eliminated).length<=2||world.time>150;
    const total=world.mode==='sprint'?10:world.laps*(root.CrownTrack?.makeTrack(world.trackIndex).gates||12);
    return k.gate>=total-2;
  }
  class KartAudio{
    constructor(){this.enabled=true;this.context=null;this.nextStep=0;this.step=0;this.track=0;this.mode='off';this.voices=0;this.layers=1;this.audible=1;this.prev=null;this.cooldowns={};}
    unlock(){
      if(!this.context){
        const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
        const c=this.context=new Context();this.master=c.createGain();this.master.gain.value=this.enabled ? .65 : 0;
        const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=4;
        this.master.connect(limiter);limiter.connect(c.destination);
        // Music: three layer buses -> low-pass (pause, big air) -> side-chain duck -> level.
        this.music=c.createGain();this.music.gain.value=MUSIC_LEVEL;this.music.connect(this.master);
        this.duck=c.createGain();this.duck.connect(this.music);
        this.musicFilter=c.createBiquadFilter();this.musicFilter.type='lowpass';this.musicFilter.frequency.value=18000;this.musicFilter.Q.value=.7;this.musicFilter.connect(this.duck);
        this.layerBus=[1,2,3].map(()=>{const g=c.createGain();g.gain.value=0;g.connect(this.musicFilter);return g;});
        this.cueBus=c.createGain();this.cueBus.gain.value=.9;this.cueBus.connect(this.duck);
        this.fx=c.createGain();this.fx.gain.value=.65;this.fx.connect(this.master);
        this.ui=c.createGain();this.ui.gain.value=.5;this.ui.connect(this.master);
        this.echo=c.createDelay(.8);this.echo.delayTime.value=.205;const feedback=c.createGain();feedback.gain.value=.23;
        this.echo.connect(feedback);feedback.connect(this.echo);const wet=c.createGain();wet.gain.value=.17;this.echo.connect(wet);wet.connect(this.musicFilter);
        this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=this.noise.getChannelData(0);let seed=131;
        for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
        this.buildLoops();this.nextStep=c.currentTime+.05;
      }
      this.context.resume().catch(()=>{});
    }
    // Persistent loops are built once and only have their levels moved; they never count against the one-shot budget.
    buildLoops(){
      const c=this.context,loop=(type,frequency,q,offset)=>{const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;gain.gain.value=0;source.connect(filter);filter.connect(gain);source.start(0,offset);return {source,filter,gain};};
      this.pan=()=>{if(c.createStereoPanner)return c.createStereoPanner();const g=c.createGain();g.pan={setTargetAtTime(){}};return g;};
      // Engine: a sawtooth plus sub-octave rumble through a low-pass, and a narrow band-passed whine above it.
      this.engineLow=c.createOscillator();this.engineLow.type='sawtooth';this.engineSub=c.createOscillator();this.engineSub.type='sine';
      this.engineLowFilter=c.createBiquadFilter();this.engineLowFilter.type='lowpass';this.engineLowFilter.frequency.value=300;this.engineLowGain=c.createGain();this.engineLowGain.gain.value=0;
      const sub=c.createGain();sub.gain.value=.8;this.engineSub.connect(sub);sub.connect(this.engineLowFilter);this.engineLow.connect(this.engineLowFilter);this.engineLowFilter.connect(this.engineLowGain);this.engineLowGain.connect(this.fx);
      this.engineHigh=c.createOscillator();this.engineHigh.type='square';this.engineHighFilter=c.createBiquadFilter();this.engineHighFilter.type='bandpass';this.engineHighFilter.Q.value=4;this.engineHighGain=c.createGain();this.engineHighGain.gain.value=0;
      this.engineHigh.connect(this.engineHighFilter);this.engineHighFilter.connect(this.engineHighGain);this.engineHighGain.connect(this.fx);
      for(const o of [this.engineLow,this.engineSub,this.engineHigh]){o.frequency.value=45;o.start();}
      this.roll=loop('bandpass',900,.7,.1);this.skid=loop('bandpass',1500,2.2,.3);this.wind=loop('bandpass',500,.6,.5);this.scrape=loop('bandpass',2600,3,.7);
      for(const l of [this.roll,this.skid,this.wind,this.scrape])l.gain.connect(this.fx);
      // Boulder rumble: low noise plus a slow sine, panned toward the stone.
      this.boulder=loop('lowpass',150,.8,.9);this.boulderTone=c.createOscillator();this.boulderTone.frequency.value=38;const tone=c.createGain();tone.gain.value=.5;this.boulderTone.connect(tone);tone.connect(this.boulder.gain);this.boulderTone.start();
      this.boulderPan=this.pan();this.boulder.gain.connect(this.boulderPan);this.boulderPan.connect(this.fx);
      // Two rival engines take the nearest karts, pitched by doppler and panned in screen space.
      this.rivals=[0,1].map(()=>{const osc=c.createOscillator(),filter=c.createBiquadFilter(),gain=c.createGain(),pan=this.pan();osc.type='sawtooth';osc.frequency.value=50;filter.type='lowpass';filter.frequency.value=700;gain.gain.value=0;osc.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.fx);osc.start();return {osc,filter,gain,pan};});
    }
    setEnabled(value){this.enabled=value;if(this.context)this.master.gain.setTargetAtTime(value ? .65 : 0,this.context.currentTime,.04);}
    take(){if(!this.context||this.voices>=VOICE_LIMIT)return false;this.voices++;return true;}
    release(...nodes){this.voices--;for(const n of nodes)n.disconnect();}
    note(frequency,duration,type,gain,at,bus=this.fx,cutoff=2500,echo=false){
      if(!this.take())return;const c=this.context;
      const osc=c.createOscillator(),volume=c.createGain(),filter=c.createBiquadFilter();osc.type=type;osc.frequency.value=frequency;filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.8;
      volume.gain.setValueAtTime(.001,at);volume.gain.exponentialRampToValueAtTime(Math.max(.002,gain),at+.008);volume.gain.exponentialRampToValueAtTime(.001,at+duration);
      osc.connect(filter);filter.connect(volume);volume.connect(bus);if(echo)volume.connect(this.echo);
      osc.onended=()=>this.release(osc,filter,volume);osc.start(at);osc.stop(at+duration+.02);
    }
    noiseHit(at,duration,gain,frequency,type='highpass',bus=this.fx,q=1,sweepTo=null){
      if(!this.take())return;const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),volume=c.createGain();source.buffer=this.noise;filter.type=type;filter.frequency.setValueAtTime(frequency,at);filter.Q.value=q;
      if(sweepTo)filter.frequency.exponentialRampToValueAtTime(sweepTo,at+duration);
      volume.gain.setValueAtTime(.001,at);volume.gain.exponentialRampToValueAtTime(Math.max(.002,gain),at+Math.min(.02,duration*.2));volume.gain.exponentialRampToValueAtTime(.001,at+duration);source.connect(filter);filter.connect(volume);volume.connect(bus);
      source.onended=()=>this.release(source,filter,volume);source.start(at,Math.random()*1.5);source.stop(at+duration+.02);
    }
    sweep(from,to,duration,type,gain,at,bus=this.fx){
      if(!this.take())return;const c=this.context,osc=c.createOscillator(),volume=c.createGain();osc.type=type;osc.frequency.setValueAtTime(from,at);osc.frequency.exponentialRampToValueAtTime(to,at+duration);
      volume.gain.setValueAtTime(Math.max(.002,gain),at);volume.gain.exponentialRampToValueAtTime(.001,at+duration);osc.connect(volume);volume.connect(bus);
      osc.onended=()=>this.release(osc,volume);osc.start(at);osc.stop(at+duration+.02);
    }
    schedule(event,at,theme,bus){
      const {instrument,frequency,duration,gain}=event;
      if(instrument==='hat'||instrument==='snare'){this.noiseHit(at,duration,gain,frequency,instrument==='hat'?'highpass':'bandpass',bus);if(instrument==='snare')this.note(180,.09,'triangle',.07,at,bus);return;}
      if(instrument==='kick'){this.sweep(145,42,duration,'sine',gain,at,bus);return;}
      const type=instrument==='bass'?'sawtooth':instrument==='lead'?theme.voice:instrument==='pad'?'triangle':'sine';
      this.note(frequency,duration,type,gain,at,bus,instrument==='bass'?380:instrument==='pad'?1200:3400,instrument==='lead'||instrument==='bell');
      if(instrument==='lead')this.note(frequency*1.004,duration,'sawtooth',gain*.25,at,bus,2200);
    }
    // Side-chain style dip: -3 dB under impacts and boosts, recovering over half a second.
    duckMusic(){if(!this.context)return;const g=this.duck.gain,t=this.context.currentTime;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(DUCK,t+.03);g.setTargetAtTime(1,t+.12,.18);}
    ready(name,gap){const t=this.context?.currentTime||0;if(t-(this.cooldowns[name]??-9)<gap)return false;this.cooldowns[name]=t;return true;}
    tone(frequency,duration=.15,type='sine',volume=.15,slide=null){
      if(!this.context||!this.enabled)return;const at=this.context.currentTime;
      if(slide)this.sweep(frequency,slide,duration,type,volume,at);else this.note(frequency,duration,type,volume,at);
    }
    uiSound(type){
      if(!this.context||!this.enabled)return;const t=this.context.currentTime,bus=this.ui,root=CrownScore.midi((CrownScore.THEMES[this.track]||CrownScore.THEMES[0]).root+24);
      if(type==='hover'){if(this.ready('hover',.06))this.note(1760,.04,'sine',.05,t,bus,5000);}
      else if(type==='click'){this.note(1320,.05,'triangle',.12,t,bus,5000);this.note(660,.08,'sine',.08,t+.025,bus);}
      else if(type==='count'){this.note(root,.16,'square',.09,t,bus,2200);this.note(root*2,.12,'sine',.07,t,bus);}
      else if(type==='go'){this.note(root*2,.42,'square',.1,t,bus,3200);this.note(root*3,.42,'sine',.08,t,bus);}
      else if(type==='gate'){this.note(2637,.045,'sine',.11,t,bus,6000);this.note(1319,.07,'triangle',.07,t+.02,bus);}
      else if(type==='up'){this.note(880,.08,'triangle',.1,t,bus);this.note(1319,.14,'triangle',.11,t+.07,bus);}
      else if(type==='down'){this.note(659,.09,'triangle',.08,t,bus,1800);this.note(494,.16,'triangle',.08,t+.08,bus,1400);}
    }
    // Item launches are distinct per item; hits are distinct per cause.
    itemSound(item){
      const t=this.context.currentTime;
      if(item==='trap'){this.sweep(190,80,.18,'triangle',.18,t);this.noiseHit(t,.12,.1,600,'lowpass');}
      else if(item==='bolt'){this.sweep(420,1700,.18,'sawtooth',.08,t);this.noiseHit(t,.15,.06,3000,'highpass');}
      else if(item==='coin'){this.note(1319,.18,'sine',.13,t);this.note(1976,.25,'sine',.11,t+.06);}
      else if(item==='homing'){this.sweep(600,1500,.35,'sine',.1,t);this.sweep(606,1480,.35,'triangle',.06,t+.02);}
      else if(item==='triple')for(let i=0;i<3;i++)this.sweep(500+i*120,1800,.12,'sawtooth',.07,t+i*.06);
      else if(item==='boost'){this.noiseHit(t,.5,.16,400,'bandpass',this.fx,1.2,3200);this.sweep(160,760,.45,'sawtooth',.08,t);}
      else if(item==='star')[1047,1319,1568,2093,2637,3136].forEach((f,i)=>this.note(f,.3,'triangle',.08,t+i*.045,this.fx,6000,true));
      else if(item==='overdrive'){this.sweep(70,330,.7,'sawtooth',.12,t);this.noiseHit(t,.7,.1,200,'bandpass',this.fx,1,2400);}
      else if(item==='hunter'){this.sweep(110,55,.8,'square',.1,t);this.note(1760,.6,'sine',.07,t+.1,this.fx,6000,true);}
    }
    hitSound(kind){
      const t=this.context.currentTime;this.duckMusic();
      if(kind==='mine'){this.noiseHit(t,.6,.32,900,'lowpass',this.fx,1,120);this.sweep(220,38,.45,'square',.14,t);}
      else if(kind==='breaker'){this.noiseHit(t,1,.32,1400,'lowpass',this.fx,1,90);this.sweep(160,30,.8,'sawtooth',.16,t);this.note(1760,.5,'sine',.06,t+.05);}
      else if(kind==='bolt'){this.noiseHit(t,.3,.22,1800,'bandpass',this.fx,2,500);this.sweep(900,110,.3,'sawtooth',.11,t);}
      else{this.noiseHit(t,.3,.22,500,'lowpass');this.sweep(130,35,.25,'square',.13,t);}
    }
    effect(type,weight='medium'){
      if(!this.context||!this.enabled)return;const t=this.context.currentTime;
      if(type==='boost'){this.duckMusic();this.noiseHit(t,.45,.17,500,'bandpass',this.fx,1,2600);this.sweep(160,750,.4,'sawtooth',.10,t);}
      else if(type==='pad'){this.duckMusic();this.sweep(2600,180,.2,'square',.07,t);this.noiseHit(t,.12,.12,5000,'highpass');this.sweep(320,900,.35,'sawtooth',.07,t+.05);}
      else if(type==='trick'){this.duckMusic();for(const [f,d] of [[1568,0],[2349,.04],[3136,.08]])this.note(f,.35,'sine',.1,t+d,this.fx,8000,true);}
      else if(type==='launch')this.noiseHit(t,.5,.16,300,'bandpass',this.fx,.9,2800);
      else if(type==='land'){const heavy=weight==='heavy',light=weight==='light';this.duckMusic();this.sweep(heavy?85:light?140:110,heavy?26:38,heavy?.45:.3,'sine',heavy?.42:light?.22:.3,t);this.noiseHit(t,heavy?.3:.18,heavy?.24:.14,heavy?260:420,'lowpass');}
      else if(type==='box'){this.noiseHit(t,.28,.14,4200,'highpass');for(let i=0;i<4;i++)this.note(2200+Math.random()*2600,.12,'sine',.05,t+i*.025,this.fx,9000);}
      else if(type==='bump'){this.duckMusic();this.noiseHit(t,.16,.18,380,'lowpass');this.sweep(150,60,.14,'triangle',.12,t);}
      else if(type==='pickup'){for(let i=0;i<3;i++)this.note([660,880,1320][i],.2,'sine',.16,t+i*.055);}
      else if(type==='tier1')this.note(1047,.2,'sine',.12,t,this.fx,6000);
      else if(type==='tier2'){this.note(1175,.18,'sine',.11,t);this.note(1568,.24,'sine',.11,t+.06,this.fx,6000);}
      else if(type==='tier3')[1397,1760,2093,2794].forEach((f,i)=>this.note(f,.3,'triangle',.08,t+i*.04,this.fx,8000,true));
      else if(type==='denied')this.note(220,.12,'square',.06,t,this.fx,900);
      else this.tone(600,.08,'triangle',.12);
    }
    // Countdown stinger, victory fanfare and the softer outro play on the cue bus, outside the layer mix.
    cue(list){if(!this.context||!this.enabled)return;const t=this.context.currentTime+.03,theme=CrownScore.THEMES[this.track]||CrownScore.THEMES[0];for(const event of list)this.schedule(event,t+event.at,theme,this.cueBus);}
    finish(win){this.cue(CrownScore.fanfare(this.track,win));this.mode='results';}
    // Derives one-shot cues by comparing the player's kart with the previous frame, so solo and online sound the same.
    observe(world,k,dt){
      const c=this.context,prev=this.prev,racing=world.phase==='racing';
      if(!prev||prev.id!==k.id||prev.mode!==world.mode||prev.trackIndex!==world.trackIndex||world.time<prev.time-.5){this.prev=this.snapshot(world,k);this.wallTime=0;this.boulderGain=0;return;}
      if(this.enabled&&c){
        const notice=k.noticeUntil>world.time?`${k.notice}:${k.noticeUntil}`:'';
        if(notice&&notice!==prev.notice){
          const text=k.notice;
          if(text==='RIFT PAD BOOST')this.effect('pad');else if(text==='LANDING BOOST')this.effect('trick');
          else if(text.includes('BOOST')||text.includes('TURBO'))this.effect('boost');
          else if(text==='NO TARGET AHEAD')this.effect('denied');
          else if(text==='HEXED!'||text==='OUT OF BALLOONS')this.hitSound(this.hitCause(prev,k));
          else if(k.item&&!prev.item)this.effect('pickup');
        }
        if(prev.item&&!k.item&&k.spin<=0)this.itemSound(prev.item);
        if(k.driftLevel>prev.driftLevel&&k.driftLevel>0)this.effect(`tier${k.driftLevel}`);
        if(prev.launchedAt==null&&k.launchedAt!=null)this.effect('launch');
        if(!prev.grounded&&k.grounded&&world.time-(k.airStart??world.time)>.22)this.effect('land',k.classId);
        if(racing&&k.gate>prev.gate&&k.gate>0&&k.finishTime==null)this.uiSound('gate');
        if(racing&&world.mode!=='trial'&&world.time>2.5&&k.place!==prev.place&&k.finishTime==null&&this.ready('place',.6))this.uiSound(k.place<prev.place?'up':'down');
        for(const box of world.boxes||[]){const was=prev.boxes.get(box.id);if(was!=null&&was<=0&&box.ready>0){const d=Math.hypot(box.x-k.x,box.z-k.z);if(d<12&&this.ready('box',.08))this.effect('box');}}
        const dv=Math.hypot(k.vx-prev.vx,k.vz-prev.vz),near=world.racers.some(r=>r.id!==k.id&&!r.eliminated&&Math.hypot(r.x-k.x,r.z-k.z)<3.4);
        if(near&&dv>3&&k.spin<=0&&k.grounded&&this.ready('bump',.3))this.effect('bump');
      }
      this.prev=this.snapshot(world,k);
    }
    hitCause(prev,k){
      const near=list=>list.filter(e=>Math.hypot(e.x-k.x,e.z-k.z)<6);
      if(near(prev.traps).length)return 'mine';const shots=near(prev.shots);if(shots.some(s=>s.hunter))return 'breaker';if(shots.length)return 'bolt';return 'ram';
    }
    snapshot(world,k){
      return {id:k.id,mode:world.mode,trackIndex:world.trackIndex,time:world.time,notice:k.noticeUntil>world.time?`${k.notice}:${k.noticeUntil}`:'',item:k.item,driftLevel:k.driftLevel,launchedAt:k.launchedAt,grounded:k.grounded,gate:k.gate,place:k.place,vx:k.vx,vz:k.vz,spin:k.spin,
        boxes:new Map((world.boxes||[]).map(b=>[b.id,b.ready])),traps:(world.traps||[]).map(t=>({x:t.x,z:t.z})),shots:(world.shots||[]).map(s=>({x:s.x,z:s.z,hunter:s.hunter}))};
    }
    // state: {world, me, screen}. screen is menu | lobby | race | paused | results.
    update({world,me:k,screen},dt=1/60){
      if(!this.context)return;const c=this.context,t=c.currentTime,track=world?.trackIndex||0,theme=CrownScore.THEMES[track]||CrownScore.THEMES[0];
      const phase=world?.phase,menu=screen==='menu'||screen==='lobby',live=screen==='race'&&phase==='racing',paused=screen==='paused';
      const mode=menu?'menu':screen==='results'?'results':phase==='countdown'&&!paused?'countdown':(live||paused)&&phase==='racing'?'race':'off';
      if(this.track!==track||this.mode!==mode){
        const from=this.mode;this.track=track;this.mode=mode;this.nextStep=t+.05;
        if(mode==='race'&&from!=='race'){this.step=64;this.layers=this.audible=CrownScore.layersFor(this.intensity(world,k),1);this.setLayers(this.layers,t,true);}
        if(mode==='menu'){this.step=0;this.setLayers(3,t,true);}
        if(mode==='countdown'&&world.countdown>2.6)this.cue(CrownScore.stinger(track,world.countdown));
      }
      if(k&&world&&(live||screen==='race'))this.observe(world,k,dt);
      // Engine, tyres and world loops.
      const tone=ENGINE_TONE[k?.classId]||ENGINE_TONE.medium,top=root.CrownData?.CLASSES[k?.classId]?.speed||35,driving=!!k&&screen==='race'&&!k.eliminated&&(phase==='racing'||phase==='countdown');
      const {rpm}=engineRpm(k?.speed||0,top),boost=k?.boost>0?1:0,throttle=phase==='countdown'?.25:1;
      const lowFreq=tone.base+rpm*tone.span*(.55+.45*clamp((k?.speed||0)/top,0,1))+boost*14;
      this.engineLow.frequency.setTargetAtTime(lowFreq,t,.05);this.engineSub.frequency.setTargetAtTime(lowFreq/2,t,.05);this.engineHigh.frequency.setTargetAtTime(lowFreq*tone.whine,t,.05);
      this.engineLowFilter.frequency.setTargetAtTime((220+rpm*520)*tone.cutoff,t,.08);this.engineHighFilter.frequency.setTargetAtTime(lowFreq*tone.whine*2,t,.08);
      this.engineLowGain.gain.setTargetAtTime(driving?.075*tone.rumble*throttle:0,t,.08);this.engineHighGain.gain.setTargetAtTime(driving&&phase==='racing'?(.012+rpm*.03+boost*.02)*clamp((k.speed||0)/6,0,1):0,t,.08);
      const grounded=driving&&live&&k.grounded,speedN=clamp((k?.speed||0)/top,0,1.2),mud=k?.surface==='mud';
      // Rolling noise: dry band-passed hiss on asphalt, a low wobbling squelch in mud.
      this.roll.filter.type=mud?'lowpass':'bandpass';this.roll.filter.frequency.setTargetAtTime(mud?260+Math.random()*180:700+speedN*900,t,.05);
      this.roll.gain.gain.setTargetAtTime(grounded?(mud?.13+.07*Math.sin(t*23):.035)*clamp(speedN*1.4,0,1):0,t,.05);
      const charge=clamp((k?.driftTime||0)/1.3,0,1),drifting=grounded&&k.drift;
      this.skid.filter.frequency.setTargetAtTime(1200+charge*1600,t,.06);this.skid.gain.gain.setTargetAtTime(drifting?.05+charge*.06:0,t,.05);
      const air=driving&&live&&!k.grounded?clamp((world.time-(k.airStart||world.time))/.5,0,1):0;
      this.wind.filter.frequency.setTargetAtTime(400+speedN*700,t,.1);this.wind.gain.gain.setTargetAtTime(air*(.05+speedN*.08),t,.12);
      this.scrape.gain.gain.setTargetAtTime(grounded&&this.touchingWall(world,k)?.05+speedN*.08:0,t,.03);this.scrape.filter.frequency.setTargetAtTime(2200+Math.random()*1400,t,.02);
      this.updateBoulder(world,k,live,t);this.updateRivals(world,k,live||phase==='countdown'&&screen==='race',t);
      // Music filter: closed while paused, partly closed during a big ramp jump, open again on landing.
      const bigAir=live&&k&&!k.grounded&&k.launchedAt!=null;
      this.musicFilter.frequency.setTargetAtTime(paused?650:bigAir?1300:18000,t,paused||bigAir?.12:.06);
      this.music.gain.setTargetAtTime(mode==='race'?(paused?MUSIC_LEVEL*.55:MUSIC_LEVEL):menu?MUSIC_LEVEL*.65:MUSIC_LEVEL*.4,t,.2);
      if(!this.enabled||(mode!=='race'&&mode!=='menu')){this.nextStep=t+.05;return;}
      if(this.nextStep<t-.2)this.nextStep=t+.03;
      const racing=mode==='race',final=racing&&finalStretch(world,k);
      if(racing)this.targetLayers=CrownScore.layersFor(this.intensity(world,k),this.layers);
      const interval=60/(racing?theme.bpm:100)/4;
      for(let budget=0;this.nextStep<t+.12&&budget<16;budget++){
        // Layers only change on a bar line: a rising layer fades in over a beat, a falling one fades across its last bar.
        if(racing&&this.step%16===0){this.audible=this.layers;if(this.targetLayers&&this.targetLayers!==this.layers){this.audible=Math.max(this.layers,this.targetLayers);this.layers=this.targetLayers;this.setLayers(this.layers,this.nextStep);}}
        for(const event of CrownScore.events(track,this.step,racing,{layers:racing?this.audible:3,final}))this.schedule(event,this.nextStep,theme,this.layerBus[(CrownScore.LAYER[event.instrument]||1)-1]);
        this.step++;this.nextStep+=interval;
      }
    }
    setLayers(count,at,now=false){this.layerBus.forEach((bus,i)=>{const on=i<count;bus.gain.cancelScheduledValues(at);if(now)bus.gain.setValueAtTime(on?1:0,at);else bus.gain.setTargetAtTime(on?1:0,at,on?.1:.45);});}
    intensity(world,k){
      if(!world||!k)return 0;const others=world.racers.filter(r=>r.id!==k.id&&!r.eliminated);
      const gap=others.length?Math.min(...others.map(r=>world.mode==='battle'?Math.hypot(r.x-k.x,r.z-k.z):Math.abs((r.distance||0)-(k.distance||0)))):Infinity;
      const total=world.mode==='sprint'?10:world.mode==='battle'?1:world.laps*(root.CrownTrack?.makeTrack(world.trackIndex).gates||12);
      return CrownScore.intensity({place:world.mode==='battle'?1+others.length-others.filter(r=>r.balloons>k.balloons).length:k.place,count:world.racers.length,gap,progress:world.mode==='battle'?world.time/180:Math.max(0,k.gate)/total,final:finalStretch(world,k)});
    }
    touchingWall(world,k){
      if(world.mode==='battle')return Math.hypot(k.x,k.z)>38.4;
      const T=root.CrownTrack;if(!T)return false;const track=T.makeTrack(world.trackIndex);
      return !T.inGap(track,k.s)&&Math.abs(k.lane)>T.edgeAt(track,k.segment,k.lane)-.7;
    }
    updateBoulder(world,k,live,t){
      let gain=0,pan=0;const T=root.CrownTrack;
      if(live&&T&&!['battle','trial'].includes(world.mode)){
        const track=T.makeTrack(world.trackIndex);
        for(let i=0;i<2;i++){const p=T.hazardPose(track,world.time,i),d=Math.hypot(p.x-k.x,p.y-k.y,p.z-k.z),g=clamp(1-d/70,0,1)**2;if(g>gain){gain=g;pan=doppler(k,{x:p.x,z:p.z}).pan;}}
      }
      this.boulder.gain.gain.setTargetAtTime(gain*.35,t,.1);this.boulderPan.pan.setTargetAtTime(pan,t,.1);
    }
    updateRivals(world,k,live,t){
      const nearest=live&&k?world.racers.filter(r=>r.id!==k.id&&!r.eliminated).map(r=>({r,d:Math.hypot(r.x-k.x,r.z-k.z)})).sort((a,b)=>a.d-b.d).slice(0,2):[];
      this.rivals.forEach((voice,i)=>{
        const entry=nearest[i];if(!entry){voice.gain.gain.setTargetAtTime(0,t,.1);return;}
        const r=entry.r,shift=doppler(k,r),tone=ENGINE_TONE[r.classId]||ENGINE_TONE.medium,top=root.CrownData?.CLASSES[r.classId]?.speed||35,{rpm}=engineRpm(r.speed,top);
        voice.osc.frequency.setTargetAtTime((tone.base+rpm*tone.span)*shift.factor,t,.04);voice.filter.frequency.setTargetAtTime(500+rpm*700,t,.08);
        voice.gain.gain.setTargetAtTime(shift.gain*.07*clamp(r.speed/4,0,1),t,.06);voice.pan.pan.setTargetAtTime(shift.pan,t,.06);
      });
    }
  }
  KartAudio.engineRpm=engineRpm;KartAudio.doppler=doppler;KartAudio.finalStretch=finalStretch;KartAudio.ENGINE_TONE=ENGINE_TONE;
  root.KartAudio=KartAudio;
})(typeof window!=='undefined'?window:globalThis);
