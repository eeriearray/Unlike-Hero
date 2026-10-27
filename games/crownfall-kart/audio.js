(function(root){
  'use strict';
  class KartAudio{
    constructor(){this.enabled=true;this.context=null;this.nextStep=0;this.step=0;this.track=0;this.running=false;this.voices=0;this.driftTier=0;}
    unlock(){
      if(!this.context){
        const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
        const c=this.context=new Context();this.master=c.createGain();this.master.gain.value=this.enabled ? .65 : 0;
        const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=4;
        this.master.connect(limiter);limiter.connect(c.destination);
        this.music=c.createGain();this.music.gain.value=.55;this.music.connect(this.master);
        this.fx=c.createGain();this.fx.gain.value=.65;this.fx.connect(this.master);
        this.echo=c.createDelay(.8);this.echo.delayTime.value=.205;const feedback=c.createGain();feedback.gain.value=.23;
        this.echo.connect(feedback);feedback.connect(this.echo);const wet=c.createGain();wet.gain.value=.17;this.echo.connect(wet);wet.connect(this.music);
        this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let seed=131;
        for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
        this.engine=c.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=45;
        this.motor=c.createGain();this.motor.gain.value=0;this.engineFilter=c.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=320;
        this.engine.connect(this.engineFilter);this.engineFilter.connect(this.motor);this.motor.connect(this.fx);this.engine.start();
        this.skid=c.createBufferSource();this.skid.buffer=this.noise;this.skid.loop=true;const skidFilter=c.createBiquadFilter();skidFilter.type='bandpass';skidFilter.frequency.value=1600;skidFilter.Q.value=.5;
        this.skidGain=c.createGain();this.skidGain.gain.value=0;this.skid.connect(skidFilter);skidFilter.connect(this.skidGain);this.skidGain.connect(this.fx);this.skid.start();
        this.nextStep=c.currentTime+.05;
      }
      this.context.resume().catch(()=>{});
    }
    setEnabled(value){this.enabled=value;if(this.context)this.master.gain.setTargetAtTime(value ? .65 : 0,this.context.currentTime,.04);}
    note(frequency,duration,type,gain,at,bus=this.fx,cutoff=2500,echo=false){
      const c=this.context;if(!c||this.voices>90)return;
      const osc=c.createOscillator(),volume=c.createGain(),filter=c.createBiquadFilter();osc.type=type;osc.frequency.value=frequency;filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.8;
      volume.gain.setValueAtTime(.001,at);volume.gain.exponentialRampToValueAtTime(Math.max(.002,gain),at+.008);volume.gain.exponentialRampToValueAtTime(.001,at+duration);
      osc.connect(filter);filter.connect(volume);volume.connect(bus);if(echo)volume.connect(this.echo);
      this.voices++;osc.onended=()=>{this.voices--;osc.disconnect();filter.disconnect();volume.disconnect();};osc.start(at);osc.stop(at+duration+.02);
    }
    noiseHit(at,duration,gain,frequency,type='highpass',bus=this.music){
      const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),volume=c.createGain();source.buffer=this.noise;filter.type=type;filter.frequency.value=frequency;
      volume.gain.setValueAtTime(gain,at);volume.gain.exponentialRampToValueAtTime(.001,at+duration);source.connect(filter);filter.connect(volume);volume.connect(bus);
      source.onended=()=>{source.disconnect();filter.disconnect();volume.disconnect();};source.start(at);source.stop(at+duration);
    }
    schedule(event,at,theme){
      const {instrument,frequency,duration,gain}=event,c=this.context;
      if(instrument==='hat'||instrument==='snare'){this.noiseHit(at,duration,gain,frequency,instrument==='hat'?'highpass':'bandpass');if(instrument==='snare')this.note(180,.09,'triangle',.07,at,this.music);return;}
      if(instrument==='kick'){
        const osc=c.createOscillator(),volume=c.createGain();osc.frequency.setValueAtTime(145,at);osc.frequency.exponentialRampToValueAtTime(42,at+.16);volume.gain.setValueAtTime(gain,at);volume.gain.exponentialRampToValueAtTime(.001,at+duration);osc.connect(volume);volume.connect(this.music);osc.onended=()=>{osc.disconnect();volume.disconnect();};osc.start(at);osc.stop(at+duration);return;
      }
      const type=instrument==='bass'?'sawtooth':instrument==='lead'?theme.voice:instrument==='pad'?'triangle':'sine';
      this.note(frequency,duration,type,gain,at,this.music,instrument==='bass'?380:instrument==='pad'?1200:3400,instrument==='lead'||instrument==='bell');
      if(instrument==='lead')this.note(frequency*1.004,duration,'sawtooth',gain*.25,at,this.music,2200);
    }
    tone(frequency,duration=.15,type='sine',volume=.15,slide=null){
      if(!this.context||!this.enabled)return;const at=this.context.currentTime;
      if(!slide){this.note(frequency,duration,type,volume,at);return;}
      const c=this.context,osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,at);osc.frequency.exponentialRampToValueAtTime(slide,at+duration);gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.001,at+duration);osc.connect(gain);gain.connect(this.fx);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+duration+.01);
    }
    effect(type){
      if(!this.context||!this.enabled)return;const t=this.context.currentTime;
      if(type==='boost'){this.noiseHit(t,.45,.17,800,'bandpass',this.fx);this.tone(160,.4,'sawtooth',.10,750);}
      else if(type==='hit'){this.noiseHit(t,.3,.2,500,'lowpass',this.fx);this.tone(130,.25,'square',.13,35);}
      else if(type==='pickup'){for(let i=0;i<3;i++)this.note([660,880,1320][i],.2,'sine',.16,t+i*.055);}
      else if(type==='finish'){for(let i=0;i<5;i++)this.note([392,494,587,784,988][i],.5,'triangle',.2,t+i*.12);}
      else if(type==='jump')this.tone(260,.2,'sine',.1,800);
      else this.tone(600,.08,'triangle',.12);
    }
    update(k,running,track=0,menu=false){
      if(!this.context)return;const c=this.context,t=c.currentTime,theme=CrownScore.THEMES[track]||CrownScore.THEMES[0];
      if(this.track!==track||this.running!==running){this.track=track;this.running=running;this.step=running?64:0;this.nextStep=t+.05;}
      this.engine.frequency.setTargetAtTime(42+(k?.speed||0)*3.6+(k?.boost>0?40:0),t,.06);
      this.engineFilter.frequency.setTargetAtTime(230+(k?.speed||0)*9,t,.08);this.motor.gain.setTargetAtTime(running ? .065 : 0,t,.08);
      this.skidGain.gain.setTargetAtTime(running&&k?.drift&&k.grounded ? .09 : 0,t,.05);
      this.music.gain.setTargetAtTime(running ? (k?.boost>0 ? .7 : .53) : menu ? .33 : .13,t,.2);
      if(k?.driftLevel>this.driftTier&&running)this.tone(700+k.driftLevel*240,.13,'sine',.13);this.driftTier=k?.driftLevel||0;
      if(!this.enabled||(!running&&!menu)){this.nextStep=t+.05;return;}
      if(this.nextStep<t-.2)this.nextStep=t+.03;
      const interval=60/(running?theme.bpm:100)/4;
      for(let budget=0;this.nextStep<t+.12&&budget<16;budget++){
        for(const event of CrownScore.events(track,this.step,running))this.schedule(event,this.nextStep,theme);
        this.step++;this.nextStep+=interval;
      }
    }
  }
  root.KartAudio=KartAudio;
})(window);
