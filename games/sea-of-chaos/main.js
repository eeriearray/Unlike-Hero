import {createWorld,step,buoy,freshMatch,WIN,BOOST_CD,CAPTURE_T,ISLANDS} from './simulation.js';import{makeRenderer}from'./render.js';import{sound,pauseAudio}from'./audio.js';import{connect,roomCode}from'./network.js';import{createInput}from'./input.js';
const hub=window.Hub,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),canvas=$('sea'),view=makeRenderer(canvas),uid=hub?.player?.().id||`p${Math.random().toString(36).slice(2)}`;
const BOTS=['Blackbeard','Red Jenny','Calico Jack','Morrow','Anne Bonny','Salt Peg','One-Eyed Ned'];
let name=localStorage.getItem('soc-name')||'Captain',room=null,role='solo',mode='menu',world=null,players=[],controls={},lastInput=0,lastSnap=0,acc=0,last=performance.now(),remoteTarget=null,outbox=[],inbox=[],lastHp=100,lastHud='';$('name').value=name;
function setMode(m){mode=m;input?.setMode(m);for(const id of ['menu','lobby','end'])$(id).classList.toggle('hidden',m!==id);$('hud').classList.toggle('hidden',m!=='game')}
function note(t){$('menu-note').textContent=t}
function saveName(){name=$('name').value.trim().slice(0,16)||'Captain';localStorage.setItem('soc-name',name)}
function beginSolo(){saveName();role='solo';players=[{id:uid,name},...BOTS.slice(0,4).map((n,i)=>({id:`ai${i}`,name:n,ai:true}))];world=createWorld(players);startGame()}
function startGame(){setMode('game');$('toasts').innerHTML='';lastHp=100;toast('Grab the Skull Flag! Follow the gold arrow','big');sound('wave');hub?.report?.('session-start',{mode:role,players:players.length})}
function hostMatch(){players=players.slice(0,8);let i=0;while(players.length<6){players.push({id:`ai${i}`,name:BOTS[i%BOTS.length],ai:true});i++}world=createWorld(players);room?.emit('start',{players});startGame()}
const nameOf=id=>id===uid?'You':world?.ships.find(s=>s.id===id)?.name||'Someone';

// Minimap: you are the arrow, gold is the flag, your buoy is the big ring.
const mapctx=$('map').getContext('2d');function drawMap(w){const c=mapctx,K=1.4;c.clearRect(0,0,300,300);c.save();c.translate(150,150);c.scale(-1,-1);
 c.fillStyle='#0d3340';c.beginPath();c.arc(0,0,140,0,Math.PI*2);c.fill();c.fillStyle='#b8a06a';for(const i of ISLANDS){c.beginPath();c.arc(i.x*K,i.z*K,i.r*K,0,Math.PI*2);c.fill()}
 const dot=(x,z,color,r)=>{c.fillStyle=color;c.beginPath();c.arc(x*K,z*K,r,0,Math.PI*2);c.fill()};
 for(const h of w.whirl){c.strokeStyle='#b9a6ff';c.lineWidth=2;c.beginPath();c.arc(h.x*K,h.z*K,h.r*K,0,Math.PI*2);c.stroke()}
 for(const p of w.pickups)if(p.cooldown<=0)dot(p.x,p.z,p.kind==='repair'?'#7fe39b':'#ffb347',4);
 for(const s of w.ships){if(s.raider)continue;const b=buoy(s),mine=s.id===uid;c.strokeStyle=s.color;c.lineWidth=mine?4:2;c.beginPath();c.arc(b.x*K,b.z*K,mine?14:6,0,Math.PI*2);c.stroke()}
 for(const s of w.ships){if(s.dead>0)continue;if(s.id===uid){c.save();c.translate(s.x*K,s.z*K);c.rotate(-s.a);c.fillStyle='#fff';c.beginPath();c.moveTo(0,12);c.lineTo(7,-7);c.lineTo(-7,-7);c.closePath();c.fill();c.restore()}else if(s.raider){c.fillStyle=s.color;c.fillRect(s.x*K-5,s.z*K-5,10,10)}else dot(s.x,s.z,s.color,6)
  if(s.id===w.flag.carrier){c.strokeStyle='#ffd24a';c.lineWidth=3;c.beginPath();c.arc(s.x*K,s.z*K,12,0,Math.PI*2);c.stroke()}}
 if(!w.flag.carrier){const f=w.flag.returnAt>0?w.flag.home:w.flag;c.globalAlpha=w.flag.returnAt>0?.4:1;dot(f.x,f.z,'#ffd24a',9);c.globalAlpha=1}
 c.restore()}

$('solo').onclick=beginSolo;
$('host').onclick=()=>{saveName();if(!window.Hub){note('Multiplayer rooms require the Unlike Hero Hub. Solo mode works here.');return}const code=roomCode();role='host';players=[{id:uid,name}];room=connect(code,{hello:(d,meta)=>{if(role==='host'&&mode==='lobby'&&d?.id&&!players.some(p=>p.id===d.id)&&players.length<8){players.push(d);room.emit('lobby',{players,code});renderLobby(code)}else if(role==='host'&&mode==='game'&&meta?.id)room.emitTo(meta.id,'inprogress',{})},lobby:d=>{if(role==='client'&&d){players=d.players;renderLobby(d.code)}},start:d=>{if(role==='client'&&d?.players){players=d.players;world=createWorld(players);startGame()}},inprogress:()=>{if(role==='client')$('lobby-note').textContent='Battle in progress. You will join the next match.'},input:d=>{if(role==='host'&&d?.id)controls[d.id]=d.input},snap:d=>{if(role==='client')receive(d)},back:()=>{if(role==='client')setMode('lobby')}});room.emit('hello',{id:uid,name});renderLobby(code);setMode('lobby')};
function renderLobby(code){$('room-code').textContent=code||$('room-code').textContent;$('lobby-note').textContent=`${players.length} captain${players.length===1?'':'s'} ready · bots fill to 6 · Sea Raiders hunt the flag carrier`;$('start').classList.toggle('hidden',role==='client')}
$('join').onclick=()=>{const code=$('code').value.trim().toUpperCase();if(!/^[A-Z]{4}$/.test(code)){note('Enter the four-letter room code.');return}if(!window.Hub){note('Multiplayer rooms require the Unlike Hero Hub.');return}saveName();role='client';room=connect(code,{lobby:d=>{if(d?.players){players=d.players;renderLobby(code)}},start:d=>{if(d?.players){players=d.players;world=createWorld(players);startGame()}},inprogress:()=>{$('lobby-note').textContent='Battle in progress. You will join the next match.'},input:()=>{},snap:d=>receive(d),back:()=>setMode('lobby')});players=[{id:uid,name}];room.emit('hello',{id:uid,name});renderLobby(code);setMode('lobby')};
$('start').onclick=()=>{if(role==='host')hostMatch()};$('back').onclick=()=>{room?.leave();room=null;setMode('menu')};$('again').onclick=()=>{if(role==='host')hostMatch();else if(role==='solo'){world=freshMatch(world);startGame()}else $('winner').textContent='Waiting for host…'};$('menu-btn').onclick=()=>{room?.leave();room=null;setMode('menu')};
const input=createInput(canvas,sound,pauseAudio);let escAt=0;input.onEscape(()=>{const now=performance.now();if(now-escAt>2500){escAt=now;toast('Press Esc again to leave the match','bad');return}room?.leave();room=null;setMode('menu')});

function receive(s){inbox.push(...(s.events||[]));if(!world){world=s;return}remoteTarget=s}
function toast(text,kind=''){const el=document.createElement('div');el.className=`toast ${kind}`;el.textContent=text;const box=$('toasts');box.prepend(el);while(box.children.length>4)box.lastChild.remove();setTimeout(()=>el.remove(),3100)}
function pop(x,z,text,kind=''){const p=view.project(x,4,z);if(!p.on)return;const el=document.createElement('div');el.className=`pop ${kind}`;el.textContent=text;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;$('pops').append(el);setTimeout(()=>el.remove(),800)}

function events(w,list){view.fx(list,w,uid);for(const e of list){const me=e.id===uid,byMe=e.by===uid;
 if(e.type==='splash'||e.type==='bump'){if(e.type==='bump'&&me)sound('hit');continue}
 if(e.type==='fire'){if(me)sound('fire');continue}
 if(e.type==='hit'){if(me){sound('hit');flash()}else if(byMe){sound('hitmark');pop(e.x,e.z,`-${e.dmg}`)}continue}
 if(e.type==='block'){if(byMe)pop(e.x,e.z,'BLOCKED','blue');continue}
 if(e.type==='boost'){if(me)sound('boost');continue}
 if(e.type==='ram'){if(me||byMe)sound('ram');if(me)flash();if(byMe)pop(e.x,e.z,'RAMMED!');continue}
 if(e.type==='respawn'){if(me){sound('respawn');toast('Back afloat — shielded for a moment')}continue}
 sound(e.type);
 if(e.type==='pickup')toast(me?'You have the flag! Sail to your glowing buoy':`${nameOf(e.id)} grabbed the flag — hunt them!`,me?'big':'bad');
 if(e.type==='steal')toast(me?'Stolen! Now get it home':e.from===uid?`${nameOf(e.id)} rammed the flag off you!`:`${nameOf(e.id)} stole the flag from ${nameOf(e.from)}`,me?'big':'bad');
 if(e.type==='drop')toast(me?'You dropped the flag!':`${nameOf(e.id)} dropped the flag — grab it!`,me?'bad':'big');
 if(e.type==='sink'){if(me)toast(e.by?`Sunk by ${nameOf(e.by)}`:'Your ship went down','bad');else if(byMe)toast(`You sank ${nameOf(e.id)}!`,'big')}
 if(e.type==='stash'){const s=w.ships.find(x=>x.id===e.id);toast(me?`STASHED! ${s.score} / ${WIN}`:`${nameOf(e.id)} stashed the flag (${s.score}/${WIN})`,me?'big':'bad')}
 if(e.type==='spawn')toast('A new Skull Flag has surfaced');
 if(e.type==='return')toast('The flag drifted back');
 if(e.type==='repair'&&me)toast('Hull patched +45');
 if(e.type==='powder'&&me)toast('Powder keg! Rapid fire + boost refilled','big');
 if(e.type==='sudden')toast('SUDDEN DEATH — next stash wins!','bad')}}
function flash(){const v=$('vignette');v.classList.add('on');setTimeout(()=>v.classList.remove('on'),60)}

function updateHud(w){const m=w.ships.find(s=>s.id===uid),carrier=w.ships.find(s=>s.id===w.flag.carrier),f=w.flag;
 $('timer').textContent=w.sudden?'SUDDEN DEATH':`${Math.floor(w.remaining/60)}:${String(Math.floor(w.remaining%60)).padStart(2,'0')}`;$('timer').classList.toggle('sudden',!!w.sudden);
 $('flag-state').textContent=carrier?`FLAG · ${carrier.id===uid?'YOU':carrier.name.toUpperCase()}`:f.dropped>0?`FLAG LOOSE · ${Math.ceil(f.dropped)}s`:f.returnAt>0?`NEW FLAG IN ${Math.ceil(f.returnAt)}`:'FLAG IS FREE';
 const rows=w.ships.filter(s=>!s.raider).sort((a,b)=>b.score-a.score).map(s=>`<div class="score ${s.id===uid?'me':''} ${s.id===f.carrier?'carry':''}"><span style="color:${s.color}">●</span><span>${esc(s.id===uid?'You':s.name)}${s.id===f.carrier?' 🏴‍☠️':''}</span><span class="pips">${'<em>■</em>'.repeat(s.score)}${'■'.repeat(Math.max(0,WIN-s.score))}</span></div>`).join('');
 if(rows!==lastHud){$('scores').innerHTML=rows;lastHud=rows}
 if(!m)return;$('captain').textContent=m.name;$('captain').style.color=m.color;$('hp-txt').textContent=Math.ceil(m.hp);$('hp').style.width=`${m.hp}%`;
 const ready=m.boost<=0;$('boost').style.width=`${(1-m.boost/BOOST_CD)*100}%`;$('boost-txt').textContent=ready?'READY':`${m.boost.toFixed(1)}s`;$('boost-m').classList.toggle('ready',ready);
 $('buff').textContent=m.rapid>0?`🔥 RAPID FIRE ${Math.ceil(m.rapid)}s`:m.shield>0?`🛡 SHIELDED ${Math.ceil(m.shield)}s`:'';
 const o=$('objective'),b=buoy(m),db=Math.hypot(m.x-b.x,m.z-b.z);let text,cls;
 if(m.dead>0){text=`Sunk! Back in ${Math.ceil(m.dead)}s`;cls='dead'}
 else if(f.carrier===uid){text=db<14?'HOLD IN THE RING!':`Sail HOME to your buoy · ${db.toFixed(0)}m`;cls='home'}
 else if(carrier){text=`${esc(carrier.name)} has the flag — shoot or ram them!`;cls='hunt'}
 else if(f.returnAt>0){text='New flag surfacing — head for the gold ring';cls='flag'}
 else{text=f.dropped>0?'Flag is loose — grab it!':'Grab the Skull Flag — follow the gold arrow';cls='flag'}
 o.textContent=text;o.className=`objective plate ${cls}`;
 const cap=f.carrier===uid&&m.capture>0;$('capture').classList.toggle('hidden',!cap);if(cap)$('capture-bar').style.width=`${m.capture/CAPTURE_T*100}%`;
 if(f.carrier===uid&&w.ships.some(s=>s.raider&&!s.dead&&Math.hypot(s.x-m.x,s.z-m.z)<30))sound('warning');
 if(m.hp<lastHp-1&&m.hp<30&&lastHp>=30)toast('Hull critical — find a green repair crate','bad');lastHp=m.hp}

function finishScreen(w){if(!w.over||mode!=='game')return;setMode('end');const win=w.winner===uid,wn=w.ships.find(s=>s.id===w.winner);
 $('winner').textContent=win?'Victory, Captain!':`${wn?.name||'A rival'} wins`;$('end-reason').textContent=w.reason==='sudden-death'?'Sudden death decider':w.reason==='time'?'Time ran out':`First to ${WIN} stashes`;
 $('final-scores').innerHTML=w.ships.filter(s=>!s.raider).slice().sort((a,b)=>b.score-a.score||b.sinks-a.sinks).map(s=>`<div class="${s.id===w.winner?'win':''}"><span><b style="color:${s.color};text-shadow:0 0 2px #000">●</b> ${esc(s.id===uid?s.name+' (you)':s.name)}</span><span>${s.score} 🏴‍☠️ · ${s.sinks} sunk</span></div>`).join('');
 sound(win?'stash':'sink');hub?.report?.('session-end',{result:win?'win':'lose',score:w.ships.find(s=>s.id===uid)?.score||0})}

const lerpA=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;
 if(mode==='game'&&world){acc+=dt;let n=0;
  while(acc>=1/30&&n<3){if(role!=='client'){step(world,{...controls,[uid]:input.read()},1/30);if(role==='host')outbox.push(...world.events);events(world,world.events)}acc-=1/30;n++}
  if(n===3)acc=0;
  if(role==='host'&&now-lastSnap>100){room?.emit('snap',{...world,events:outbox});outbox=[];lastSnap=now}
  if(role==='client'&&now-lastInput>50){room?.emit('input',{id:uid,input:input.read()});lastInput=now}
  if(role==='client'&&remoteTarget){for(const a of world.ships){const b=remoteTarget.ships.find(s=>s.id===a.id);if(!b)continue;const {x,z,a:ang}=a,jump=Math.hypot(b.x-x,b.z-z)>20;Object.assign(a,b);if(!jump){a.x=x+(b.x-x)*.4;a.z=z+(b.z-z)*.4;a.a=lerpA(ang,b.a,.4)}}
   for(const k of['remaining','flag','shots','pickups','over','winner','reason','sudden','t'])world[k]=remoteTarget[k];remoteTarget=null}
  if(role==='client'&&inbox.length){events(world,inbox);inbox=[]}
  updateHud(world);drawMap(world);view.draw(world,uid,dt);if(world.over)finishScreen(world)
 }else view.draw({ships:[],shots:[],whirl:[],pickups:[],current:0,flag:{x:0,z:0,carrier:null,returnAt:0,home:{x:0,z:0}}},uid,dt)
}requestAnimationFrame(frame);
