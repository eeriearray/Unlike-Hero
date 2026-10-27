(function(){
  'use strict';
  const D=CrownData,T=CrownTrack,S=CrownSim,$=id=>document.getElementById(id);
  const hub=window.Hub?.init({id:'crownfall-kart',version:'1.2.0',title:'Crownfall Kart'});
  const storage=hub?.storage()||{get:(k,f)=>{try{return JSON.parse(localStorage.getItem(`crownfall.${k}`))??f;}catch{return f;}},set:(k,v)=>{try{localStorage.setItem(`crownfall.${k}`,JSON.stringify(v));}catch{}}};
  const descriptions={sprint:'A start-to-finish dash. Ten checkpoints. No waiting for another lap.',race:'Two laps. Eight karts. Absolutely no royal etiquette.',gp:'Four realms. Four races. One crown. Points carry across the whole cup.',trial:'Three clean laps. No items. No rivals. Chase your personal-best ghost.',battle:'Three balloons each. An enclosed arena. Be the last ghost standing.'};
  let classId=storage.get('class','medium'),mode='sprint',trackIndex=0,screen='menu',paused=false,connection=null,room=null,playerId='player';
  if(!D.CLASSES[classId])classId='medium';
  let world=S.createWorld({classId}),accumulator=0,previous=performance.now(),uiTime=0,netTime=0,sessionActive=false;
  let ghost=null,recording=[],recordAt=0,lastCountdown=0,busy=false;
  const input=new KartInput(),audio=new KartAudio();let renderer;
  try{renderer=new KartRenderer($('world'));}catch(error){$('fatal').classList.remove('hidden');$('fatal-message').textContent='This game needs WebGL. Enable hardware acceleration or try a recent Chrome, Edge, Firefox or Safari browser.';console.error(error);return;}
  const graphicsNotes={performance:'Lower resolution, one shadow cascade, reduced foliage. Post effects off. Targets 60 FPS; hardware dependent.',balanced:'Two shadow cascades, SSAO, bloom and atmospheric haze. Resolution adapts to frame time.',high:'Three shadow cascades, SSAO, cinematic focus and speed blur. Best on a dedicated GPU.'};
  function applyGraphics(value){renderer.setQuality(value);$('graphics-quality').value=renderer.quality;$('graphics-note').textContent=graphicsNotes[renderer.quality]+(!renderer.post.enabled?' HDR post effects are unavailable on this device.':'');storage.set('graphics.v1',renderer.quality);}
  applyGraphics(storage.get('graphics.v1','balanced'));
  $('graphics-quality').addEventListener('change',event=>applyGraphics(event.target.value));
  $('world').addEventListener('webglcontextlost',event=>{event.preventDefault();input.clear();paused=true;$('fatal').classList.remove('hidden');$('fatal-message').textContent='The graphics context was interrupted. Reload to reopen the track.';});
  $('name').value=storage.get('name',hub?.player()?.name==='Player'?'Racer':hub?.player()?.name||'Racer');
  $('auto-drive').checked=storage.get('auto.v3',true);input.auto=$('auto-drive').checked;
  $('steering-assist').checked=storage.get('assist',true);input.assist=$('steering-assist').checked;
  $('track').replaceChildren(...D.TRACKS.map((track,index)=>{const option=document.createElement('option');option.value=index;option.textContent=`${String(index+1).padStart(2,'0')} · ${track.name}`;return option;}));
  audio.setEnabled(storage.get('sound',true));updateSound();
  function formatTime(time){const n=Math.max(0,Number(time)||0);return `${String(Math.floor(n/60)).padStart(2,'0')}:${(n%60).toFixed(3).padStart(6,'0')}`;}
  function name(){return $('name').value.trim().slice(0,18)||'Racer';}
  function saveSettings(){storage.set('class',classId);storage.set('name',name());storage.set('auto.v3',$('auto-drive').checked);storage.set('assist',$('steering-assist').checked);}
  function setBusy(value){busy=value;$('solo').disabled=value;for(const id of ['host','join'])$(id).disabled=value||mode==='trial';}
  function message(text,error=false){$('menu-message').textContent=text;$('menu-message').classList.toggle('error',error);$('lobby-message').textContent=text;}
  function setScreen(next){
    screen=next;input.clear();input.active=next==='race';
    $('menu').classList.toggle('hidden',next!=='menu');$('lobby').classList.toggle('hidden',next!=='lobby');
    $('pause').classList.toggle('hidden',next!=='paused');$('results').classList.toggle('hidden',next!=='results');
    $('hud').classList.toggle('hidden',!['race','paused'].includes(next));$('pause-button').classList.toggle('hidden',!['race','paused'].includes(next));
    document.body.classList.toggle('racing',['race','paused','results'].includes(next));
  }
  function preview(){
    if(screen!=='menu')return;
    world=S.createWorld({mode:mode==='battle'?'battle':'sprint',track:trackIndex,classId,roster:[{id:'player',name:name(),classId,human:true}]});
    playerId='player';renderer.readyCamera=false;
    $('scene-name').textContent=mode==='battle'?'THE HOLLOW RING':D.TRACKS[trackIndex].name.toUpperCase();
    $('scene-subtitle').textContent=mode==='battle'?'Three balloons. No second lives.':CrownEnvironments.get(D.TRACKS[trackIndex]).identity;
    document.querySelector('.scene-caption .number').textContent=`${String(trackIndex+1).padStart(2,'0')} / ${String(D.TRACKS.length).padStart(2,'0')}`;
    const best=loadGhost();$('best-time').textContent=mode==='trial'&&best?`BEST ${formatTime(best.duration)}`:'';
  }
  function loadGhost(){
    const g=storage.get(`ghost.v4.${trackIndex}.${classId}`,null);
    if(!g||g.version!==4||g.track!==trackIndex||g.classId!==classId||g.laps!==3||!Number.isFinite(g.duration)||g.duration<=0||g.duration>240||!Array.isArray(g.samples)||g.samples.length<2||g.samples.length>5000)return null;
    let last=-1;
    for(const sample of g.samples){if(!Array.isArray(sample)||sample.length!==5||sample.some(n=>typeof n!=='number'||!Number.isFinite(n))||sample[0]<last||sample[0]<0||sample[0]>241||Math.abs(sample[1])>500||Math.abs(sample[2])>200||Math.abs(sample[3])>500)return null;last=sample[0];}
    return g;
  }
  function reportStart(){if(sessionActive)return;sessionActive=true;hub?.report('session-start',{mode,track:world.trackIndex,online:!!connection});}
  function reportEnd(quit=false){
    if(!sessionActive)return;
    if(!quit&&world.mode==='gp'&&world.round<3)return;
    const me=world.racers.find(k=>k.id===playerId),sorted=world.mode==='gp'?[...world.racers].sort((a,b)=>b.points-a.points||a.place-b.place):[...world.racers].sort((a,b)=>a.place-b.place);
    hub?.report('session-end',{result:quit?'quit':sorted[0]?.id===playerId?'win':'lose',mode:world.mode,position:sorted.findIndex(k=>k.id===playerId)+1,score:me?.points||0,durationMs:Math.round(world.time*1000),online:!!connection});sessionActive=false;
  }
  function startSolo(){
    if(busy)return;audio.unlock();saveSettings();connection?.close();connection=null;room=null;playerId='player';paused=false;
    world=S.createWorld({mode,track:trackIndex,classId,seed:Math.floor(Math.random()*2**30),roster:[{id:'player',name:name(),classId,human:true}]});
    ghost=mode==='trial'?loadGhost():null;recording=[];recordAt=0;accumulator=0;lastCountdown=0;renderer.readyCamera=false;
    setScreen('race');reportStart();
  }
  function quitToMenu(){
    reportEnd(true);connection?.close();connection=null;room=null;paused=false;setBusy(false);$('resume').disabled=false;$('help').classList.add('hidden');setScreen('menu');preview();message('Solo runs offline. Online rooms use the Unlike Hero server.');
  }
  function togglePause(){
    if(screen==='race'){paused=!connection;setScreen('paused');$('pause-note').textContent=connection?'Online racing continues while this menu is open.':'Your race is paused. The crown can wait.';$('restart').classList.toggle('hidden',!!connection);$('resume').focus();}
    else if(screen==='paused'){paused=false;setScreen('race');}
  }
  input.onPause=togglePause;
  function updateSound(){ $('sound').textContent=audio.enabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(audio.enabled)); }
  $('sound').onclick=()=>{audio.unlock();audio.setEnabled(!audio.enabled);storage.set('sound',audio.enabled);updateSound();};
  $('auto-drive').onchange=()=>{input.auto=$('auto-drive').checked;saveSettings();};$('steering-assist').onchange=()=>{input.assist=$('steering-assist').checked;saveSettings();};
  for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>{
    mode=button.dataset.mode;for(const b of document.querySelectorAll('[data-mode]')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));}
    $('mode-description').textContent=descriptions[mode];$('host').disabled=mode==='trial';$('join').disabled=mode==='trial';$('track').disabled=mode==='battle';$('course-open').disabled=mode==='battle';preview();
  };
  for(const button of document.querySelectorAll('[data-class]'))button.onclick=()=>{
    classId=button.dataset.class;for(const b of document.querySelectorAll('[data-class]')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));}
    $('class-description').textContent=D.CLASSES[classId].description;saveSettings();preview();
  };
  document.querySelector(`[data-class="${classId}"]`).click();
  $('track').onchange=()=>{trackIndex=Number($('track').value);preview();};$('name').onchange=saveSettings;
  document.addEventListener('pointerdown',()=>audio.unlock(),{once:true});
  // Menu buttons tick on hover and click; the in-race touch pads stay silent.
  let hovered=null;const menuButton=e=>{const b=e.target.closest?.('button,select,.course-card');return b&&!b.disabled&&!b.closest('[data-control],#touch-controls')?b:null;};
  document.addEventListener('pointerover',e=>{const b=menuButton(e);if(b!==hovered){hovered=b;if(b&&e.pointerType==='mouse')audio.uiSound('hover');}});
  document.addEventListener('click',e=>{if(menuButton(e))audio.uiSound('click');});
  function showCourses(){
    $('course-grid').replaceChildren(...D.TRACKS.map((definition,index)=>{
      const button=document.createElement('button'),canvas=document.createElement('canvas'),title=document.createElement('b'),description=document.createElement('small'),stats=document.createElement('span');
      button.className='course-card';button.setAttribute('aria-pressed',String(index===trackIndex));canvas.width=320;canvas.height=180;canvas.setAttribute('aria-hidden','true');
      const track=T.makeTrack(index),bounds=track.bounds,ctx=canvas.getContext('2d'),scale=148/Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ),mx=(bounds.minX+bounds.maxX)/2,mz=(bounds.minZ+bounds.maxZ)/2;
      ctx.fillStyle='#171522';ctx.fillRect(0,0,320,180);ctx.lineCap='round';
      for(let i=0;i<track.count;i++){
        const a=track.points[i],b=track.points[i+1];if(T.inGap(track,track.lengths[i]))continue;
        ctx.strokeStyle=mode==='sprint'&&i>track.count*10/12?'#494253':definition.energy;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(160+(a.x-mx)*scale,90+(a.z-mz)*scale);ctx.lineTo(160+(b.x-mx)*scale,90+(b.z-mz)*scale);ctx.stroke();
      }
      const start=T.sample(track,0);ctx.fillStyle='#fff0bb';ctx.beginPath();ctx.arc(160+(start.x-mx)*scale,90+(start.z-mz)*scale,5,0,Math.PI*2);ctx.fill();
      if(mode==='sprint'){const finish=T.sample(track,track.length*10/12),fx=160+(finish.x-mx)*scale,fz=90+(finish.z-mz)*scale;ctx.fillStyle='#ffe5a0';ctx.fillRect(fx-3,fz-8,7,9);ctx.fillRect(fx-4,fz-8,2,16);}
      title.textContent=definition.name;description.textContent=CrownEnvironments.get(definition).identity;stats.textContent=`${(track.length*(mode==='sprint'?10/12:1)/1000).toFixed(2)} KM · ${definition.ramps.length} JUMPS · ${CrownScore.THEMES[index].bpm} BPM`;
      button.append(canvas,title,description,stats);button.onclick=()=>{trackIndex=index;$('track').value=index;preview();$('course-picker').classList.add('hidden');$('course-open').focus();};return button;
    }));
    $('course-picker').classList.remove('hidden');$('course-close').focus();
  }
  $('course-open').onclick=showCourses;$('course-close').onclick=()=>{$('course-picker').classList.add('hidden');$('course-open').focus();};
  $('solo').onclick=startSolo;$('pause-button').onclick=togglePause;$('resume').onclick=togglePause;
  $('restart').onclick=()=>{reportEnd(true);startSolo();};$('quit').onclick=quitToMenu;$('result-menu').onclick=quitToMenu;$('leave-room').onclick=quitToMenu;
  $('item').onclick=()=>{if(input.active){audio.unlock();input.use=true;}};
  $('exit').onclick=()=>{reportEnd(true);connection?.close();if(hub)hub.exit();else location.href='../../index.html';};
  $('help-open').onclick=()=>{if(screen==='race')togglePause();$('help').classList.remove('hidden');$('help-close').focus();};
  $('help-close').onclick=()=>{$('help').classList.add('hidden');if(screen==='paused')$('resume').focus();else $('help-open').focus();};
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('course-picker').classList.contains('hidden')){$('course-picker').classList.add('hidden');$('course-open').focus();e.stopImmediatePropagation();return;}if(e.code==='Escape'&&!$('help').classList.contains('hidden')){$('help').classList.add('hidden');e.stopImmediatePropagation();}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){input.clear();audio.context?.suspend();if(!connection&&screen==='race')togglePause();}else if(audio.enabled)audio.context?.resume().catch(()=>{});});
  function online(command){
    if(busy)return;saveSettings();audio.unlock();setBusy(true);message('Opening the starting gate…');
    connection?.close();connection=new KartConnection(handleOnline,reason=>{setBusy(false);message(reason,true);if(screen!=='menu'&&screen!=='lobby'){paused=true;setScreen('paused');$('pause-note').textContent=reason;$('resume').disabled=true;} });
    connection.open({...command,name:name(),classId,mode,track:trackIndex});
  }
  $('host').onclick=()=>online({type:'create'});
  $('join').onclick=()=>{const code=$('room-code').value.trim().toUpperCase();if(!/^[A-Z]{4}$/.test(code)){message('Enter the four-letter room code.',true);$('room-code').focus();return;}online({type:'join',code});};
  $('room-code').addEventListener('input',()=>{$('room-code').value=$('room-code').value.toUpperCase().replace(/[^A-Z]/g,'');});
  $('start-online').onclick=()=>connection?.send({type:'start'});
  $('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(room?.code||'');$('lobby-message').textContent='Room code copied.';}catch{$('lobby-message').textContent=`Room code: ${room?.code||''}`;}};
  function handleOnline(data){
    if(data.type==='error'){setBusy(false);message(data.message,true);if(screen==='menu'){connection?.close();connection=null;}return;}
    if(data.type==='closed'){message(data.message,true);return;}
    if(data.type==='lobby'){
      room=data;mode=data.mode;playerId=connection.id;setBusy(false);
      if(data.running){if(screen==='results'){$('next').disabled=data.host!==playerId;$('next').textContent=data.host!==playerId?'WAITING FOR THE HOST':world.mode==='gp'&&world.round<3?'NEXT REALM →':'RACE AGAIN →';}return;}
      setScreen('lobby');$('copy-code').textContent=data.code;$('lobby-mode').textContent=`${{sprint:'Rift sprint',race:'Lap race',gp:'Grand Prix',battle:'Balloon battle'}[data.mode]} · ${D.TRACKS[data.track].name}`;
      $('seats').replaceChildren(...data.seats.map((seat,i)=>{const row=document.createElement('div');row.className='seat';const label=document.createElement('span');label.textContent=`${i+1}. ${seat.name}${seat.id===playerId?' · YOU':''}`;const info=document.createElement('small');info.textContent=`${D.CLASSES[seat.classId].name}${seat.id===data.host?' / HOST':''}`;row.append(label,info);return row;}));
      $('start-online').disabled=data.host!==playerId;$('start-online').textContent=data.host===playerId?'START THE RACE →':'WAITING FOR THE HOST';
      $('lobby-message').textContent=data.host===playerId?'Ready when you are. Friends can join before you start.':'Choose your line. The host will start the race.';
    }
    if(data.type==='state'){
      if(!data.world||!Array.isArray(data.world.racers))return;
      const old=world;world=data.world;playerId=connection.id;mode=world.mode;
      if(screen==='lobby'||screen==='menu'||(screen==='results'&&world.phase!=='results')){paused=false;setScreen('race');renderer.readyCamera=false;lastCountdown=0;reportStart();}
      if(old.phase!=='results'&&world.phase==='results')showResults();
    }
  }
  function showResults(){
    paused=false;input.clear();$('help').classList.add('hidden');setScreen('results');reportEnd();
    const me=world.racers.find(k=>k.id===playerId),finalCup=world.mode==='gp'&&world.round===3;
    const order=finalCup?[...world.racers].sort((a,b)=>b.points-a.points||a.place-b.place):[...world.racers].sort((a,b)=>a.place-b.place);
    const place=order.findIndex(k=>k.id===playerId)+1;audio.finish(place===1&&(world.mode!=='trial'||me?.finishTime!=null));
    $('result-eyebrow').textContent=world.mode==='gp'?`GRAND PRIX · ROUND ${world.round+1} / 4`:world.mode==='trial'?'THE CLOCK TELLS NO LIES':'THE DUST HAS SETTLED';
    $('result-title').textContent=world.mode==='trial'?(world.recordValid?'A clean escape.':'A fractured run.'):place===1?'The crown is yours.':place<=3?'A noble disaster.':'Long live the chaos.';
    let summary=world.mode==='battle'?`${me?.balloons||0} balloons remain. ${world.time>=180?'Time limit reached; remaining balloons decide the order.':'Last survivor takes the crown.'}`:world.mode==='gp'?`${finalCup?'Final cup standings':'Race standings'} · ${D.TRACKS[world.trackIndex].name}`:`${place}${['','st','nd','rd'][place]||'th'} place · ${formatTime(me?.finishTime||world.time)}`;
    if(world.mode==='trial'){
      if(me?.finishTime==null)$('result-title').textContent='Out of time.';
      summary=me?.finishTime==null?'The four-minute limit was reached. Complete all three laps to save a ghost.':world.recordValid?`${formatTime(me.finishTime)} · Three laps, no shortcuts.`:'Respawning invalidated this record. Try again for a clean ghost.';
      if(world.recordValid&&me?.finishTime!=null&&recording.length>1&&(!ghost||me.finishTime<ghost.duration)){
        const record={version:4,track:world.trackIndex,classId:me.classId,laps:3,duration:me.finishTime,samples:recording};
        storage.set(`ghost.v4.${world.trackIndex}.${me.classId}`,record);summary=`PERSONAL BEST · ${formatTime(me.finishTime)} · Ghost saved on this device.`;
      }
    }
    $('result-summary').textContent=summary;
    $('result-list').replaceChildren(...order.map((k,i)=>{const li=document.createElement('li');if(k.id===playerId)li.className='you';const rank=document.createElement('strong');rank.textContent=i+1;const label=document.createElement('span');label.textContent=`${k.name}${k.id===playerId?' · YOU':''}`;const stat=document.createElement('small');stat.textContent=world.mode==='gp'?`${k.points} PTS`:world.mode==='battle'?`${k.balloons} BALLOONS`:k.finishTime!=null?formatTime(k.finishTime):'ON TRACK';li.append(rank,label,stat);return li;}));
    $('next').disabled=!!connection&&room?.host!==playerId;
    $('next').textContent=connection&&room?.host!==playerId?'WAITING FOR THE HOST':world.mode==='gp'&&!finalCup?'NEXT REALM →':'RACE AGAIN →';
    $('next').focus();
  }
  $('next').onclick=()=>{
    if(connection){connection.send({type:'start'});return;}
    const next=S.nextGrandPrix(world);if(next){world=next;accumulator=0;renderer.readyCamera=false;setScreen('race');lastCountdown=0;}
    else startSolo();
  };
  function hud(){
    const k=world.racers.find(k=>k.id===playerId)||world.racers[0];
    $('place').textContent=world.mode==='trial'?'TT':world.mode==='battle'?k.balloons:k.place;
    $('position-label').innerHTML=world.mode==='battle'?'BALLOONS<br>REMAINING':world.mode==='trial'?'CLEAN<br>RUN':`/ ${world.racers.length}<br>POSITION`;
    $('lap').textContent=world.mode==='sprint'?`RIFT SPRINT · GATE ${Math.min(10,Math.max(0,k.gate))} / 10`:world.mode==='battle'?`${world.racers.filter(r=>!r.eliminated).length} KARTS REMAIN`:world.mode==='gp'?`RACE ${world.round+1} / 4 · LAP ${k.lap} / ${world.laps}`:`LAP ${k.lap} / ${world.laps}`;
    $('timer').textContent=formatTime(world.time);$('race-name').textContent=world.mode==='battle'?'THE HOLLOW RING':k.gate<0?D.TRACKS[world.trackIndex].zones[0]:T.sectionAt(T.makeTrack(world.trackIndex),k.s);$('speed').textContent=Math.round(k.speed*3.6);
    const charge=D.clamp(k.driftTime/1.5,0,1);$('turbo-fill').style.width=`${charge*100}%`;$('turbo-fill').style.background=k.driftLevel===3?'#bd73ff':k.driftLevel===2?'#ff963c':'#65cfff';
    $('turbo-level').textContent=['','I','II','III'][k.driftLevel];$('turbo-label').textContent=k.autopilot>0?'PHANTOM DRIVE':k.boost>0?'BOOST ACTIVE':k.draft>.1?'DRAFTING · STAY CLOSE':k.drift?'RELEASE TO BOOST':'HOP · HOLD · RELEASE';
    $('surface-label').textContent=k.eliminated?'ELIMINATED · SPECTATING':!k.grounded?'AIRBORNE · TAP TO TRICK':k.invincible>0?'UNDYING / PROTECTED':k.surface==='mud'?'HEX MUD / SLOWED':'ASPHALT / GRIP';
    const item=D.ITEMS[k.item];$('item-symbol').textContent=item?.symbol||'◇';$('item-name').textContent=item?.name.toUpperCase()||(world.mode==='trial'?'CLEAN TRACK':'NO ITEM');$('item-hint').textContent=item?'E · TAP TO USE':world.mode==='trial'?'NO ITEMS IN TIME TRIAL':'E · FIND A RIFT BOX';$('item').classList.toggle('ready',!!item);$('item').setAttribute('aria-label',item?`Use ${item.name}: ${item.description}`:'No item held');
    $('notice').textContent=k.noticeUntil>world.time?k.notice:'';
    const count=world.phase==='countdown'?Math.ceil(world.countdown):world.time<.7?'GO':'';$('countdown').textContent=count;
    if(count&&count!==lastCountdown){lastCountdown=count;audio.uiSound(count==='GO'?'go':'count');}
    const sorted=[...world.racers].sort((a,b)=>a.place-b.place).slice(0,6);
    $('standings').replaceChildren(...sorted.map(kart=>{const row=document.createElement('div');row.className=`standing ${kart.id===playerId?'you':''}`;const rank=document.createElement('small');rank.textContent=kart.place;const dot=document.createElement('i');dot.style.background=kart.color;const label=document.createElement('span');label.textContent=kart.name;row.append(rank,dot,label);return row;}));
    renderer.drawMap($('map'),world,playerId);
  }
  function frame(now){
    const dt=Math.min(.1,(now-previous)/1000);previous=now;uiTime+=dt;netTime+=dt;
    if(connection){if(netTime>=.05){netTime=0;connection.send({type:'input',input:input.read()});}}
    else if(screen==='race'&&!paused){
      accumulator=Math.min(accumulator+dt,.15);
      while(accumulator>=S.STEP){
        const old=world.phase;S.step(world,{[playerId]:input.read()},S.STEP);accumulator-=S.STEP;
        if(world.mode==='trial'&&world.phase==='racing'&&world.time>=recordAt&&recording.length<5000){const k=world.racers[0];recording.push([world.time,k.x,k.y,k.z,k.yaw]);recordAt=world.time+.05;}
        if(old!=='results'&&world.phase==='results'){showResults();break;}
      }
    }
    const me=world.racers.find(k=>k.id===playerId);audio.update({world,me,screen},dt);
    const ghostPose=screen!=='menu'&&world.mode==='trial'&&ghost?S.sampleGhost(ghost.samples,world.time):null;
    renderer.render(world,playerId,dt,screen==='menu'||screen==='lobby',ghostPose);
    if(uiTime>=.075&&['race','paused'].includes(screen)){uiTime=0;hud();}
    requestAnimationFrame(frame);
  }
  // Small read-only debug surface for diagnostics; no online authoritative state can be modified through it.
  rootDiagnostics();
  function rootDiagnostics(){window.Crownfall={getState:()=>S.snapshot(world),getScreen:()=>screen};}
  $('resume').disabled=false;preview();requestAnimationFrame(frame);
})();
