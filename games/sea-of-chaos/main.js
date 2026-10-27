import {cargoCount,capacity,RESOURCES} from './economy.js';
import {layerFor} from './defenses.js';
import {normalizeLoadout,PARTS,WEAPONS,PAINTS,SAILS,SHOP,weaponFor,weaponId} from './loadout.js';
import {teamOptions,upgradeInfo} from './team-rules.js';
import {createWorld,createTeamWorld,step,buoy,angleDelta,ISLANDS} from './simulation.js';
import {makeRenderer} from './render.js';
import {unlockAudio,sound,pauseAudio,toggleMute,seaAudio,toggleMusic,isMusicOn,isEffectsOn,musicScene} from './audio.js';
import {connect,roomCode,snapshot,readSnapshot,mergeControls} from './network.js';
import {createInput} from './input.js';
import {ARENA,BOUNDARY,sectorAt,tideAt} from './arena.js';
import {missionFor} from './objectives.js';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hub=window.Hub?.init({id:'sea-of-chaos',version:'5.0.0'});
const uid=`captain-${Math.random().toString(36).slice(2,10)}`;
const readStorage=(k,fallback)=>{try{return localStorage.getItem(k)||fallback;}catch{return fallback;}};
const save=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
const stored=(key)=>{try{return JSON.parse(readStorage(key,'{}'));}catch{return {};}};
let autoBuy=readStorage('soc-autobuy','1')==='1',loadout=normalizeLoadout(stored('soc-ship-v1')),matchOptions=teamOptions(stored('soc-match-v1')),previewWorld=null,shopOpen=false,queuedBuy=null,queuedCommand=null,shopCategory='ship';
const previewMotion=!matchMedia('(prefers-reduced-motion:reduce)').matches;
let view;
try{view=makeRenderer($('sea'));}catch(e){$('menu-note').textContent='This device could not start WebGL. Enable hardware acceleration and reload.';document.querySelectorAll('#solo,#host,#join').forEach(b=>b.disabled=true);throw e;}
let name=readStorage('soc-name','Captain'),mode='menu',role='solo',room=null,code='',world=null,target=null;
let roster=[],waiting=[],members=new Map(),hostConnection=null,controls={},pendingEvents=[],eventSeen=0;
let last=performance.now(),acc=0,lastSend=0,lastInput=0,lastHud=0,lastHello=0,lastSnapshot=0;
let tutorial=0,tutorialAt=0,noticeUntil=0,paused=false,warningAt=-10,coreWarningAt=-10;
$('name').value=name;
const input=createInput($('sea'),unlockAudio,pauseAudio);
const empty={t:0,ships:[],shots:[],pickups:[],whirl:[],flag:{x:0,z:0,returnAt:0}};
function setMode(m){mode=m;musicScene(m==='game',.2);input.setMode(m==='game'&&!paused?'game':m);for(const id of ['menu','lobby','end','shipyard'])$(id).classList.toggle('hidden',m!==id);$('hud').classList.toggle('hidden',m!=='game');$('pause-screen').classList.add('hidden');$('help-screen').classList.add('hidden');$('shop-screen').classList.add('hidden');shopOpen=false;queuedBuy=null;paused=false;acc=0;if(m==='menu')refreshSetup();}
function readName(){name=$('name').value.trim().slice(0,16)||'Captain';save('soc-name',name);unlockAudio();}
function bots(humans){const count=matchOptions.size*2,list=humans.slice(0,count).map(p=>({...p,ai:false,loadout:normalizeLoadout(p.loadout)})),names=['Cinder Vale','Tamsin Tide','Copper Rook','Nessa Gale','Morrow Flint'];while(list.length<count){const i=list.length;list.push({id:`ai-${i}`,name:names[(i-1+names.length)%names.length],ai:true,loadout:normalizeLoadout({part:['balanced','ram','swift','armor'][i%4],paint:PAINTS[i%PAINTS.length],sail:['ivory','crimson','ocean','night'][i%4],special:['fire','sticky','heavy','shock'][i%4],utility:'chain'})});}return list;}
function startGame(players,options=matchOptions){matchOptions=teamOptions(options);world=createTeamWorld(players,matchOptions);$('hud').classList.toggle('solo',role==='solo');target=null;controls={};pendingEvents=[];eventSeen=0;lastSnapshot=performance.now();setMode('game');tutorial=0;tutorialAt=0;coreWarningAt=-10;updateHud(world);view.recenter();notify('Grab treasure while the forts are shielded · follow the gold arrow',3.5);hub?.report('session-start',{mode:role,players:players.length});}
$('solo').onclick=()=>{leave();readName();role='solo';roster=[{id:uid,name,loadout}];startGame(bots(roster),{...matchOptions,practice:true});};
function renderLobby(){ $('room-code').textContent=code;$('roster').innerHTML=roster.map(p=>`<div>${escape(p.name)}${p.id===meId()?' · YOU':''} · ${roster.indexOf(p)%2?'MOON':'SUN'}</div>`).join('');$('lobby-note').textContent=`${roster.length} / ${matchOptions.size*2} captains · ${matchOptions.size}v${matchOptions.size} · Best of three · alternating Sun / Moon crews`;$('start').classList.toggle('hidden',role!=='host');}
function publishLobby(){room?.emit('lobby',{players:roster,code,options:matchOptions});renderLobby();}
function joinHello(d,meta){
 if(role!=='host'||!meta?.id||!d||typeof d.id!=='string'||typeof d.name!=='string')return;
 let p=members.get(meta.id);
 if(!p){if(members.size>=matchOptions.size*2-1){room.emitTo(meta.id,'full',{});return;}p={id:meta.id,name:d.name.slice(0,16)||'Captain',loadout:normalizeLoadout(d.loadout)};members.set(meta.id,p);}
 room.emitTo(meta.id,'identity',{id:p.id});
 if(mode==='game'||mode==='end'){
  if(!roster.some(x=>x.id===p.id)&&!waiting.some(x=>x.id===p.id))waiting.push(p);
  room.emitTo(meta.id,'inprogress',{});return;
 }
 if(!roster.some(x=>x.id===p.id))roster.push(p);
 publishLobby();
}
// Network participants use connection IDs assigned by the host. No client can
// write another captain's controls or send authoritative state to the host.
let clientId=uid;
function clientHandlers(){return {
 identity:(d,m)=>{if((!hostConnection||m.id===hostConnection)&&typeof d?.id==='string'){hostConnection=m.id;clientId=d.id;}},
 lobby:(d,m)=>{if(hostConnection&&hostConnection!==m.id)return;if(!d?.players)return;hostConnection=m.id;roster=d.players;matchOptions=teamOptions(d.options);code=d.code||code;renderLobby();},
 start:(d,m)=>{if(m.id!==hostConnection||!d?.players)return;startGame(d.players,d.options);},
 inprogress:(_,m)=>{if(hostConnection&&m.id!==hostConnection)return;hostConnection=m.id;$('lobby-note').textContent='Raid in progress. You are aboard for the next match.';},
 full:()=>{$('lobby-note').textContent='This room is full. Try another room.';},
 snap:(packet,m)=>{const d=readSnapshot(packet);if(role!=='client'||m.id!==hostConnection||mode!=='game'||!Array.isArray(d?.ships))return;target=d;lastSnapshot=performance.now();processEvents(d.events);},
 status:s=>{if(s==='disconnected'&&mode==='lobby')$('lobby-note').textContent='Reconnecting to the sea…';},
 closing:(_,m)=>{if(role==='client'&&m.id===hostConnection){leave();setMode('menu');$('menu-note').textContent='The host returned to port. Create or join another room.';}}
 };}
$('host').onclick=()=>{leave();readName();role='host';code=roomCode();roster=[{id:uid,name,loadout}];room=connect(code,{
 hello:joinHello,input:(d,m)=>{const p=members.get(m.id);if(p&&roster.some(s=>s.id===p.id)&&d?.input&&typeof d.input==='object'&&!Array.isArray(d.input))controls[p.id]={value:mergeControls(controls[p.id]?.value,d.input),at:performance.now()};},
 peers:peers=>{const ids=new Set(peers.map(p=>p.id));for(const [id,p]of members)if(!ids.has(id)){members.delete(id);if(mode==='game'){const ship=world?.ships.find(s=>s.id===p.id);if(ship){ship.ai=true;ship.name=ship.name.slice(0,12)+' · AI';}}waiting=waiting.filter(x=>x.id!==p.id);if(mode==='lobby')roster=roster.filter(x=>x.id!==p.id);}if(mode==='lobby')publishLobby();}
 });if(!room){$('menu-note').textContent='The Hub SDK could not load. Solo play is available.';return;}setMode('lobby');renderLobby();};
$('join').onclick=()=>{const entered=$('code').value.trim().toUpperCase();if(!/^[A-Z]{4}$/.test(entered)){$('menu-note').textContent='Enter a four-letter room code.';return;}leave();readName();role='client';code=entered;hostConnection=null;clientId=uid;roster=[{id:uid,name,loadout}];room=connect(code,clientHandlers());if(!room){$('menu-note').textContent='The Hub SDK could not load.';return;}setMode('lobby');renderLobby();$('lobby-note').textContent='Looking for your host…';hello();};
function hello(){room?.emit('hello',{id:uid,name,loadout});lastHello=performance.now();}
function hostMatch(){roster=roster.filter(p=>p.id===uid||[...members.values()].some(m=>m.id===p.id));roster.push(...waiting.filter(p=>!roster.some(r=>r.id===p.id)));waiting=[];const players=bots(roster.slice(0,matchOptions.size*2)),opts={...matchOptions,practice:false};room.emit('start',{players,options:opts});startGame(players,opts);}
$('start').onclick=hostMatch;
function leave(){if(role==='host')room?.emit('closing',{});room?.leave();room=null;members.clear();waiting=[];hostConnection=null;target=null;controls={};}
function port(){leave();setMode('menu');}
$('back').onclick=port;$('menu-btn').onclick=port;$('quit').onclick=port;
$('again').onclick=()=>{unlockAudio();if(role==='host')hostMatch();else if(role==='solo')startGame(bots(roster));else $('winner').textContent='Waiting for the host to raid again…';};
function pause(){if(mode!=='game')return;if(shopOpen){closeShop();return;}paused=!paused;musicScene(!paused,.2);input.setMode(paused?'paused':'game');$('pause-screen').classList.toggle('hidden',!paused);$('pause-note').textContent=role==='solo'?'Your raid is paused.':'The multiplayer raid continues while you are at anchor.';}
$('pause').onclick=pause;$('resume').onclick=pause;input.onEscape(pause);
let effectsEnabled=isEffectsOn();
function audioButtons(){document.querySelectorAll('[data-audio]').forEach(b=>{const musicButton=b.dataset.audio==='music',enabled=musicButton?isMusicOn():effectsEnabled;b.textContent=`${musicButton?'Music':'Effects'} ${enabled?'on':'off'}`;b.setAttribute('aria-pressed',String(enabled));});}
document.querySelectorAll('[data-audio]').forEach(b=>b.onclick=()=>{unlockAudio();if(b.dataset.audio==='music')toggleMusic();else effectsEnabled=!toggleMute();audioButtons();});audioButtons();
let helpWasPaused=false;
function showHelp(){helpWasPaused=paused;if(mode==='game'&&!paused)pause();$('help-screen').classList.remove('hidden');$('help-close').focus();$('help-close').textContent=mode==='game'?'Understood · back to the raid →':'Understood · back to port';}
$('how-to').onclick=showHelp;$('help').onclick=showHelp;
$('help-close').onclick=()=>{$('help-screen').classList.add('hidden');save('soc-rules-v7','1');if(mode==='game'&&!helpWasPaused&&paused)pause();(mode==='game'?$('help'):$('how-to')).focus();};
document.addEventListener('keydown',e=>{if(!$('help-screen').classList.contains('hidden')){if(e.code==='Escape')$('help-close').click();if(e.code==='Tab'){e.preventDefault();$('help-close').focus();}}});
$('standings-toggle').onclick=()=>{const on=$('hud').classList.toggle('show-scores');$('standings-toggle').setAttribute('aria-expanded',String(on));};
$('tutorial').onclick=()=>{tutorial=0;save('soc-tutorial','1');$('tutorial').classList.add('hidden');};
function meId(){return role==='client'?clientId:uid;}
function notify(text,seconds=2){const el=$('notice');el.textContent=text;el.classList.add('notice-active');if(previewMotion&&el.animate)el.animate([{opacity:0,transform:'translate(-50%,12px) scale(.98)'},{opacity:1,transform:'translate(-50%,0) scale(1)'}],{duration:240,easing:'ease-out'});noticeUntil=performance.now()+seconds*1000;}
function processEvents(events=[]){for(const e of events){if(e.n<=eventSeen)continue;eventSeen=e.n;
 const s=world?.ships.find(s=>s.id===e.id),mine=e.id===meId(),local=world?.ships.find(p=>p.id===meId()),source=e.type==='sentry'?world.teams[e.by]:s||world.teams?.[e.by],distance=source&&local?Math.hypot(source.x-local.x,source.z-local.z):0,pan=source&&local?(-(source.x-local.x)*Math.cos(local.a)+(source.z-local.z)*Math.sin(local.a))/55:0;if(s)view.event?.(e.type,s,e.by,e.kind,e.gun);view.worldEvent?.(e,world,meId());
 if(e.type==='fire'&&distance<85)sound(`shot-${e.kind||s?.fireKind||'ball'}`,pan,mine?1:Math.max(.2,1-distance/100)*.65);
 if(['hit','sink','respawn','boost','ram','whirlpool','collision','repair','ammo'].includes(e.type)&&(mine||distance<55))sound(e.type,pan,mine?1:.5);
 if(e.type==='sentry'&&distance<85)sound('sentry',pan,.65);if(e.type==='shieldhit'&&distance<75)sound('shieldhit',pan,.7);
 if(s&&['hit','sink','stash','repair','ammo','pickup','respawn'].includes(e.type))view.burst(s.x,s.z,s.color,e.type==='sink'?18:6);
 if(e.type==='stash')notify(`${mine?'You':s?.name||'A rival'} stashed the flag!`,2.5);
 if(e.type==='pickup'){notify(mine?'Flag secured! Return to YOUR buoy.':`${s?.name||'A rival'} has the flag!`);if(mine&&tutorial){tutorial=2;tutorialAt=world.t;}}
 if(e.type==='drop')notify('Flag dropped! Grab it before it returns.');
 if(e.type==='sink'&&mine)notify(s?.eliminated?'FINAL SINK · your core was destroyed':'Ship sunk · rebuilding at your dock in 5 seconds',3);
 if(e.type==='respawn'&&mine)notify('Back afloat · defend your core or raid theirs');
 if(e.type==='whirlpool'&&mine)notify('CAUGHT! The maelstrom is dragging you under.',3);

 if(e.type==='rounddraw'){closeShop();input.setMode('roundbreak');sound('warning');notify('DOUBLE SINK · replay this round with fresh ships',4);}
 if(e.type==='roundwin'){closeShop();input.setMode('roundbreak');sound('goal');notify(`Round ${e.round} won by ${world.teams[e.by].name}`,4);}
 if(e.type==='roundstart'){input.setMode(paused?'paused':'game');view.recenter();notify(`ROUND ${world.series.round} · fresh forts · grab treasure`,3);}
 if(e.type==='shieldbroken'||e.type==='turretbroken'){sound('corebroken',pan,.65);{const ours=e.by===local?.team;notify(ours?(e.type==='shieldbroken'?'YOUR SHIELD IS DOWN · defend the turrets':'You lost a turret!'):(e.type==='shieldbroken'?'SHIELD DOWN · now sink their turrets':'TURRET SUNK!'),3);}}
 if(e.type==='goal'){sound('goal');notify(`${s?.team===world.ships.find(p=>p.id===meId())?.team?'YOUR CREW':'ENEMY CREW'} SCORED!`,2.5);}
 if(e.type==='corebroken'){sound('corebroken');notify(`${world.teams[e.by]?.name||'A crew'} core destroyed · no more respawns!`,4);}
 if(e.type==='corehit'&&world.teams[e.by]?.id===world.ships.find(p=>p.id===meId())?.team&&world.t-coreWarningAt>3){coreWarningAt=world.t;sound('warning');notify('DEFEND! Your respawn core is under attack!',2);}
 if(e.type==='bank'&&mine&&(e.pearls||e.relics||e.gold>=8)){sound('gold');notify('Treasure banked · safe at home',1.5);}
 if(e.type==='collect'&&mine)sound('gold',0,.35);
 if(e.type==='boarding'){sound('warning');notify(mine?'BOARDING · stay slow in the ring':s?.team===local?.team?'Crewmate boarding · cover them!':'DEFEND YOUR CORE · shoot the boarder!',3);}
 if(e.type==='alarm'&&e.by===local?.team){sound('warning');notify('HARBOR ALERT · raiders approaching',2);}
 if(e.type==='purchasefailed'&&mine){$('shop-feedback').textContent=e.reason;notify(e.reason,1.5);}
 if(e.type==='command'&&s?.team===local?.team){$('crew-intent').textContent=`${s.name}: ${{attack:'Attack',defend:'Defend',help:'Need help',return:'Returning with treasure'}[e.by]}`;}
 if(e.type==='finalwarning')notify('In 15s: final lives · safe sea closes toward Crownfall',4);
 if(e.type==='finalwater'){sound('warning');notify('FINAL LIVES · stay inside the marked safe sea',4);}
 if(e.type==='overtimewarning')notify('In 30s: the center beacon opens · hold it to win the round',4);
 if(e.type==='gold'&&mine){sound('gold');notify('Gold salvage aboard · return home to bank',1.5);}
 if(e.type==='purchase'&&mine){const item=SHOP[e.by]?.name||'Upgrade';$('shop-feedback').textContent=`${item} fitted.`;sound('purchase');notify(`⚓ ${item} fitted`,1.6);}
 if(e.type==='defensecount'){sound('defensecount');notify(`SHIELDS UNLOCK IN ${e.by}`,1);}
 if(e.type==='defenseend'){sound('defenseend');notify('SHIELDS ARE VULNERABLE · RAID THEIR FORT!',3.5);}
 if(e.type==='sudden'){sound('sudden');}if(e.type==='sudden')notify(`BEACON OPEN · hold the center ring alone for ${world.overtime.target}s`,4);
 if(e.type==='stash'&&mine&&tutorial){tutorial=0;save('soc-tutorial','1');}
 }}
const map=$('map').getContext('2d');
function drawMap(w){const c=map;c.clearRect(0,0,284,284);c.save();c.translate(142,142);c.scale(130/ARENA,-130/ARENA);
 c.strokeStyle='#82b8b8';c.lineWidth=1;c.beginPath();c.arc(0,0,BOUNDARY,0,Math.PI*2);c.stroke();
 const local=w.ships.find(s=>s.id===meId());if(local&&!local.dead&&local.whirl<0){const goal=missionFor(w,local).goal;c.strokeStyle='#e6c77788';c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();c.moveTo(local.x,local.z);c.lineTo(goal.x,goal.z);c.stroke();c.setLineDash([]);}
 const dot=(x,z,color,r)=>{c.fillStyle=color;c.beginPath();c.arc(x,z,r,0,Math.PI*2);c.fill();};
 for(const i of w.islands||ISLANDS)dot(i.x,i.z,'#688784',i.r);
 for(const n of w.nodes||[]){dot(n.x,n.z,n.kind==='relics'?'#c6a1ff':'#8de9df',5);c.fillStyle='#f1e7ce';c.font='9px system-ui';c.save();c.translate(n.x,n.z+12);c.scale(1,-1);c.fillText(`${Math.ceil(n.next)}s`,-7,0);c.restore();}for(const p of w.loot||[])dot(p.x,p.z,RESOURCES[p.kind].color,2);
 for(const h of w.whirl){c.strokeStyle='#bf9eee';c.beginPath();c.arc(h.x,h.z,h.r,0,Math.PI*2);c.stroke();}
 for(const p of w.pickups)if(!p.cooldown)dot(p.x,p.z,p.kind==='repair'?'#8bdda9':'#edc470',2);
 for(const team of w.teams||[]){c.strokeStyle=team.color;c.lineWidth=3;c.strokeRect(team.x-8,team.z-8,16,16);}if(w.forge)dot(0,0,w.forge.contested?'#ff8d7c':'#ffe395',6);
 for(const s of w.ships){if(!s.raider&&!w.rules){const b=buoy(s);c.strokeStyle=s.id===meId()?'#fff1c7':s.color;c.lineWidth=s.id===meId()?2:1;c.strokeRect(b.x-4,b.z-4,8,8);}if(s.dead)continue;
 if(s.raider){c.fillStyle=s.color;c.fillRect(s.x-3,s.z-3,6,6);}else dot(s.x,s.z,s.teamColor||s.color,s.id===meId()?5:3);
 if(s.id===meId()){c.strokeStyle='#fff6e0';c.beginPath();c.moveTo(s.x,s.z);c.lineTo(s.x+Math.sin(s.a)*11,s.z+Math.cos(s.a)*11);c.stroke();}
 if(s.id===w.flag.carrier){c.strokeStyle='#ffda69';c.beginPath();c.arc(s.x,s.z,7,0,Math.PI*2);c.stroke();}
 }
 if(!w.rules&&w.flag.returnAt<=0){c.save();c.translate(w.flag.x,w.flag.z);c.rotate(Math.PI/4);c.fillStyle='#ffe395';c.fillRect(-4,-4,8,8);c.restore();}c.restore();}
function updateHud(w){const m=w.ships.find(s=>s.id===meId());if(!m)return;const home=w.teams[m.team],enemy=w.teams[1-m.team],mission=missionFor(w,m),goal=mission.goal;
 $('mode-title').textContent=`${w.teamSize}v${w.teamSize} · ROUND ${w.series.round}/3 · ${w.series.wins[0]} : ${w.series.wins[1]}`;
 const guarded=!!w.defense?.active,seconds=Math.ceil(w.defense?.remaining||0);$('raid-phase').classList.toggle('opening',guarded);$('raid-phase').classList.toggle('hidden',!guarded);$('phase-clock').textContent=guarded?`SHIELDS LOCKED · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'SHIELDS VULNERABLE · TURRETS LIVE';$('phase-copy').textContent=guarded?'Grab treasure, bank it at home for upgrades':'';
 $('timer').textContent=w.sudden?'BEACON OPEN':`${Math.floor(w.remaining/60)}:${String(Math.floor(w.remaining%60)).padStart(2,'0')}`;
 $('flag-state').textContent=`YOU ARE ${m.team===0?'SUN':'MOON'} · ${m.eliminated?'FINAL SINK':w.rules==='core'?(home.core>0?'RESPAWN CORE ONLINE':'LAST LIFE · CORE LOST'):'FIRST TO 5 GOALS'}`;
 $('team-status').innerHTML=[home,enemy].map(t=>{const layer=layerFor(t),turrets=t.turrets.filter(p=>p.hp>0).length;return `<span style="color:${t.color}">${t.id===m.team?'YOUR FORT':'ENEMY FORT'} · <b>${layer==='shield'?`🛡 ${Math.ceil(t.shieldHP)}`:layer==='turrets'?`${turrets} turret${turrets>1?'s':''} left`:layer==='core'?'CORE OPEN':'CORE LOST'}</b></span>`;}).join('');
 const between=w.series.phase==='intermission';$('round-break').classList.toggle('hidden',!between);if(between){$('round-result').textContent=w.series.replay?'Double sink · replay this round':`${w.teams[w.series.roundWinner].name} wins round ${w.series.round}`;$('round-score').textContent=`${w.series.wins[0]} — ${w.series.wins[1]}`;$('round-next').textContent=`Next round in ${Math.ceil(w.series.nextIn)}s · defenses, gold and upgrades reset`;}
 $('scores').innerHTML=w.ships.map(s=>`<div class="score ${s.id===meId()?'me':''}"><span class="dot" style="color:${s.teamColor}">●</span><span class="score-name">${escape(s.id===meId()?'YOU':s.name)}${s.eliminated?' · OUT':s.dead?' · rebuilding':''}</span><b>${s.kills||0} K</b></div>`).join('');
 const danger=w.whirl.some(h=>Math.hypot(m.x-h.x,m.z-h.z)<14);seaAudio(m.v,Math.min(1,.15+Math.abs(m.v)*.015+(danger?.3:0)+(m.attack>0?.4:0)+(w.defense?.remaining>0&&w.defense.remaining<6?.55:0)),danger&&!m.dead,w.remaining<60||home.core<=0||enemy.core<=0?'finale':w.defense?.active?'opening':'raid');
 $('captain').textContent=m.name;$('hp-txt').textContent=`${Math.ceil(m.hp)}/${m.maxHp}`;$('hp').style.width=`${m.hp/(m.maxHp||100)*100}%`;$('hp').style.background=m.hp<30?'#ff7f76':'#7dd7a1';
 $('life').textContent=m.eliminated?'OUT':m.dead?'REBUILDING':m.whirl>=0?'TRAPPED':m.burn>0?'ON FIRE':m.sticky>0?'STICKY':m.jam>0?'JAMMED':m.shield>0?'PROTECTED':m.team===0?'SUN CREW':'MOON CREW';
 $('objective-title').textContent=mission.title;$('objective').textContent=mission.detail;$('phase-label').textContent=mission.status;$('stash-count').textContent=`${cargoCount(m)} / ${capacity(m)} HOLD`;$('cargo-count').textContent=`${cargoCount(m)} / ${capacity(m)}`;$('cargo-resources').innerHTML=Object.entries(RESOURCES).map(([key,v])=>`<span style="color:${v.color}">${key==='gold'?'▰':key==='pearls'?'●':'◆'} <b>${m.cargo[key]}</b> ${v.name}</span>`).join('');$('bank-resources').textContent=`${m.coins} G · ${home.bank.pearls} P · ${home.bank.relics} R`;
 $('utility-button').firstChild.textContent=m.tool?`${m.tool[0].toUpperCase()+m.tool.slice(1)} `:'Tool ';$('utility-cd').textContent=m.toolCooldown>0?`${m.toolCooldown.toFixed(1)}s`:`R · ${m.toolCharges||0} left`;$('utility-button').classList.toggle('unavailable',!m.toolCharges);
 $('treasure-hud').classList.toggle('loaded',cargoCount(m)>0);$('treasure-hud').classList.toggle('hidden',cargoCount(m)===0);$('team-status').classList.toggle('under-attack',home.alarmUntil>w.t);
 const steps=guarded?['COLLECT pearls or relics','BANK treasure at home','EQUIP and choose your next route']:['BREAK their shield','DESTROY both turrets','HOLD STILL at core · 5 seconds'];document.querySelectorAll('[data-step]').forEach((p,i)=>{p.querySelector('span').textContent=steps[i];p.classList.toggle('active',guarded?i===(m.coins>=18?1:0):i===({shield:0,turrets:1,core:2,broken:2}[layerFor(enemy)]));});
 $('leader-line').textContent=`${PARTS[m.loadout.part].name} · Cannon ${m.power}/3 · Sails ${m.sailLevel}/3 · Siege ${m.siegeLevel}/3`;
 $('zone-label').textContent=Math.hypot(m.x-home.x,m.z-home.z)<25?'YOUR HOME DOCK':Math.hypot(m.x-enemy.x,m.z-enemy.z)<25?'ENEMY DOCK':Math.hypot(m.x,m.z)<22?'TREASURE CROSSING':sectorAt(m.x,m.z);$('tide-state').textContent=w.overtime.active?`BEACON · ${w.overtime.progress[0].toFixed(0)} : ${w.overtime.progress[1].toFixed(0)} / ${w.overtime.target}s`:`CROWNFALL · ${w.forge.bank} RELICS · NEXT ${Math.ceil(w.nodes[2].next)}s`;
 document.querySelector('.capture').classList.toggle('hidden',!m.attack);$('capture-fill').style.width=`${m.attack/3*100}%`;
 $('route').classList.toggle('hidden',!!m.dead||m.eliminated||m.whirl>=0);const a=angleDelta(Math.atan2(goal.x-m.x,goal.z-m.z),m.a);$('route-arrow').style.transform=`rotate(${-a}rad)`;$('route-label').textContent=mission.label;$('distance').textContent=`${Math.round(Math.hypot(goal.x-m.x,goal.z-m.z))} m`;
 for(const [key,label]of [['boost','SHIFT'],['ram','SPACE']])$(key+'-cd').textContent=m[key]>0?`${m[key].toFixed(1)}s`:label;
 document.querySelectorAll('[data-act]').forEach(b=>b.classList.toggle('unavailable',!!m.dead||m.eliminated||m.whirl>=0));$('fire-cd').textContent=m.eliminated?'Spectating · your crew can still win':m.dead?'Rebuilding ship · 5s':m.jam>0?`Cannons jammed · ${m.jam.toFixed(1)}s`:m.fire>0?`Reloading · ${m.fire.toFixed(1)}s`:'Ready · Fire aims itself · hold to keep firing';
 document.querySelectorAll('[data-ammo]').forEach(b=>{const n=+b.dataset.ammo;b.textContent=`${n} · ${weaponFor(m,n).name} ${n===1?'∞':m.ammo[n-1]}`;});
 $('wallet').textContent=`${m.coins} gold`;$('dock-shop').classList.toggle('at-dock',Math.hypot(m.x-home.x,m.z-home.z)<24);if(shopOpen)updateShop();
 if(performance.now()>noticeUntil){$('notice').classList.remove('notice-active');$('notice').textContent='';}if(role==='client'&&performance.now()-lastSnapshot>4000)notify('Sea connection interrupted · Reconnecting…',1);drawMap(w);
}
function finish(){closeShop();setMode('end');const won=world.winnerTeam===world.ships.find(s=>s.id===meId())?.team;sound(won?'victory':'defeat');$('winner').textContent=won?`Your crew wins ${world.series.wins[world.winnerTeam]}–${world.series.wins[1-world.winnerTeam]}!`:`${world.teams[world.winnerTeam]?.name||'The enemy crew'} wins`;
 $('final-scores').innerHTML=world.teams.map(t=>`<div style="margin:12px 0;color:${t.id===world.winnerTeam?'#98702b':'#74604a'}"><b>${t.name}</b> · ${world.series.wins[t.id]} round wins<br><small>${world.ships.filter(s=>s.team===t.id).map(s=>`${escape(s.name)} · ${s.kills} sinks`).join(' / ')}</small></div>`).join('');hub?.report('session-end',{result:won?'win':'lose',score:world.teams[world.winnerTeam]?.score||0});}
function interpolate(dt){if(!target)return;const alpha=1-Math.exp(-dt*16);
 for(const s of world.ships){const t=target.ships.find(e=>e.id===s.id);if(!t)continue;const x=s.x,z=s.z,a=s.a;Object.assign(s,t);const age=Math.min(.1,(performance.now()-lastSnapshot)/1000),local=s.id===meId(),turn=local?(input.read(false).turn||0):0,tx=t.x+Math.sin(t.a)*t.v*age,tz=t.z+Math.cos(t.a)*t.v*age,ta=t.a+((t.yawRate||0)*.6+turn*2.05*.4)*age;const far=Math.hypot(x-tx,z-tz)>25;s.x=far?tx:x+(tx-x)*alpha;s.z=far?tz:z+(tz-z)*alpha;s.a=a+angleDelta(ta,a)*alpha;}
 world.whirl=target.whirl.map((h,i)=>{const old=world.whirl[i]||h;return {...h,x:old.x+(h.x-old.x)*alpha,z:old.z+(h.z-old.z)*alpha};});
 const f=world.flag;world.flag={...target.flag,x:f.x+(target.flag.x-f.x)*alpha,z:f.z+(target.flag.z-f.z)*alpha};
 world.shots=target.shots.map(p=>{const old=world.shots.find(s=>s.id===p.id);return old?{...p,x:old.x+(p.x-old.x)*alpha,z:old.z+(p.z-old.z)*alpha}:{...p};});
 for(const key of ['loot','nodes','fields','overtime','t','remaining','pickups','sudden','over','winner','winnerTeam','tide','teams','forge','defense','series','roundStartedAt'])world[key]=target[key];
}
function refreshSetup(){ $('format').value=String(matchOptions.size);$('mode-description').textContent='Best of three. Shoot down their shield and turrets, sail into their core for 3 seconds, then sink their fleet.';save('soc-match-v1',JSON.stringify({size:matchOptions.size}));$('loadout-summary').textContent=`${PARTS[loadout.part].name} · ${WEAPONS[loadout.special].name} + ${WEAPONS[loadout.utility].name}`;}
$('format').onchange=()=>{matchOptions.size=+$('format').value;refreshSetup();};refreshSetup();
function options(id,entries){$(id).innerHTML=entries.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');}
options('ship-paint',PAINTS.map((p,i)=>[p,['Amber oak','Crimson','Jade sea','Amethyst','Forest','Navy','Bone white','Black pearl'][i]]));options('ship-sail',Object.keys(SAILS).map(k=>[k,k[0].toUpperCase()+k.slice(1)]));options('ship-part',Object.entries(PARTS).map(([k,v])=>[k,v.name]));for(const id of ['special-a','special-b'])options(id,Object.entries(WEAPONS).filter(([k])=>k!=='ball').map(([k,v])=>[k,v.name]));
function renderYard(){for(const [id,key]of [['ship-paint','paint'],['ship-sail','sail'],['ship-part','part'],['special-a','special'],['special-b','utility']])$(id).value=loadout[key];$('part-perk').textContent=PARTS[loadout.part].perk;$('special-a-perk').textContent=WEAPONS[loadout.special].perk;$('special-b-perk').textContent=WEAPONS[loadout.utility].perk;
 previewWorld=createWorld([{id:'preview',name:'YOUR SHIP'}]);previewWorld.ships=previewWorld.ships.slice(0,1);Object.assign(previewWorld.ships[0],{x:0,z:0,a:-.55,color:loadout.paint,loadout,weapons:['ball',loadout.special,loadout.utility]});previewWorld.flag.returnAt=99999;previewWorld.pickups=[];previewWorld.preview=true;
}
$('customize').onclick=()=>{readName();renderYard();setMode('shipyard');view.recenter();$('ship-paint').focus();};for(const [id,key]of [['ship-paint','paint'],['ship-sail','sail'],['ship-part','part'],['special-a','special'],['special-b','utility']])$(id).onchange=()=>{loadout=normalizeLoadout({...loadout,[key]:$(id).value});if(id==='special-b'&&loadout.utility!==$(id).value){loadout=normalizeLoadout({...loadout,special:loadout.utility,utility:$(id).value});}renderYard();};
function closeYard(){save('soc-ship-v1',JSON.stringify(loadout));refreshSetup();setMode('menu');$('customize').focus();}$('yard-close').onclick=closeYard;
function updateShop(){const s=world?.ships.find(p=>p.id===meId());if(!s)return;const home=world.teams[s.team],near=!s.dead&&!s.eliminated&&Math.hypot(s.x-home.x,s.z-home.z)<24;$('shop-info').textContent=`${s.coins} gold · ${home.bank.pearls} pearls · ${home.bank.relics} relics · ${near?'At your dock · choose an upgrade':'Return within 24m of your home dock to buy'}`;
 for(const b of document.querySelectorAll('[data-buy]')){const info=upgradeInfo(world,s,b.dataset.buy);b.disabled=!!info.reason;b.querySelector('b').textContent=info.def.max&&info.level>=info.def.max?'MAX':`${info.cost} ${info.currency}`;b.classList.toggle('recommended',!info.reason&&info.level===0);b.hidden=info.def.category!==shopCategory;b.querySelector('small').textContent=`${info.def.description}${info.def.max?` · ${info.level}/${info.def.max}`:''}${info.reason?' · '+info.reason:''}`;}}
$('shop-items').innerHTML=['ship','fortress','supplies'].map(category=>Object.entries(SHOP).filter(([,v])=>v.category===category).map(([k,v])=>`<button data-buy="${k}" data-shop-category="${category}"><span>${v.name}</span><b>${v.cost} ${v.currency||'gold'}</b><small>${v.description}</small></button>`).join('')).join('');document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{queuedBuy=b.dataset.buy;$('shop-feedback').textContent='Fitting purchase…';});
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{shopCategory=b.dataset.category;document.querySelectorAll('[data-category]').forEach(p=>p.setAttribute('aria-pressed',String(p===b)));updateShop();});
function autoButton(){$('auto-buy').textContent=`Auto-upgrade at dock · ${autoBuy?'ON':'OFF'}`;$('auto-buy').setAttribute('aria-pressed',String(autoBuy));}autoButton();
$('auto-buy').onclick=()=>{autoBuy=!autoBuy;save('soc-autobuy',autoBuy?'1':'0');autoButton();$('shop-feedback').textContent=autoBuy?'Your ship picks the next upgrade whenever you reach your dock.':'Manual: choose every upgrade yourself.';};
$('crew-command').onchange=()=>{queuedCommand=$('crew-command').value;$('crew-command').value='';};
$('dock-shop').onclick=()=>{if(mode!=='game')return;shopOpen=true;input.setMode('shop');$('shop-screen').classList.remove('hidden');updateShop();$('shop-close').focus();};
function closeShop(){shopOpen=false;$('shop-screen').classList.add('hidden');if(mode==='game')input.setMode(paused?'paused':'game');}$('shop-close').onclick=closeShop;
document.addEventListener('keydown',e=>{if(e.code==='Escape'){if(mode==='shipyard')closeYard();else if(shopOpen)closeShop();}if(e.code==='Tab'&&(shopOpen||mode==='shipyard')){const panel=shopOpen?$('shop-screen'):$('shipyard'),focusable=[...panel.querySelectorAll('button:not(:disabled),select')],first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});

document.addEventListener('click',e=>{const button=e.target.closest?.('button');if(button&&!button.dataset.act){unlockAudio();sound('ui');}});document.addEventListener('change',e=>{if(e.target.matches('select')){unlockAudio();sound('ui');}});
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;
 if(role==='client'&&room&&mode==='lobby'&&now-lastHello>1500)hello();
 if(mode==='game'&&world){
  if(role==='client'){
   if(now-lastInput>=50){room.emit('input',{input:{...input.read(),autobuy:autoBuy,...(queuedCommand?{command:queuedCommand}:{}),...(queuedBuy?{buy:queuedBuy}:{})}});queuedBuy=null;queuedCommand=null;lastInput=now;}interpolate(dt);
  }else if(!paused||role==='host'){
   acc=Math.min(.1,acc+dt);let n=0;
   while(acc>=1/30&&n++<3){const values={};for(const [id,c]of Object.entries(controls))if(now-c.at<650)values[id]=c.value;
    values[uid]={...input.read(),autobuy:autoBuy,...(queuedCommand?{command:queuedCommand}:{}),...(queuedBuy?{buy:queuedBuy}:{})};queuedBuy=null;queuedCommand=null;step(world,values);for(const c of Object.values(controls))for(const action of ['buy','command','utility','fire'])delete c.value[action];pendingEvents.push(...world.events);processEvents(world.events);acc-=1/30;}
   if(role==='host'&&now-lastSend>=100){room.emit('snap',snapshot(world,pendingEvents));pendingEvents=[];lastSend=now;}else if(role==='solo')pendingEvents=[];
  }
  if(now-lastHud>=100){updateHud(world);lastHud=now;}view.draw(world,meId(),dt);if(world.over)finish();
 }else if(mode==='shipyard'&&previewWorld){previewWorld.t+=dt;if(previewMotion)previewWorld.ships[0].a+=dt*.22;view.draw(previewWorld,'preview',dt);}else view.draw(world||empty,meId(),dt);
}
requestAnimationFrame(frame);
