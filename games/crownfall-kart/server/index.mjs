import { WebSocketServer } from 'ws';
import { randomBytes, randomInt } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../engine/simulation.js');
const D = require('../engine/data.js');

// Owns all online physics, inventories, standings and win conditions. Clients send bounded input only.
export default function attach({ httpServer, basePath = '/games/crownfall-kart/', tickMs = 1000 / 60 }) {
  const path = `${basePath}ws`, rooms = new Map(), peers = new Set();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  const send = (ws, data) => { if (ws.readyState === 1 && ws.bufferedAmount < 128*1024) ws.send(JSON.stringify(data)); };
  const broadcast = (room, data) => { for (const ws of room.members.values()) send(ws,data); };
  const lobby = room => ({ type:'lobby', code:room.code, host:room.host, mode:room.mode, track:room.track,
    seats:[...room.members.values()].map(ws=>({id:ws.id,name:ws.name,classId:ws.classId})), running:!!room.world });
  const error = (ws,message) => send(ws,{type:'error',message});
  function leave(ws) {
    const room=rooms.get(ws.code); if(!room)return;
    room.members.delete(ws.id); delete room.inputs[ws.id]; ws.code=null;
    if(room.world){const k=room.world.racers.find(k=>k.id===ws.id);if(k){k.human=false;k.notice='AI TAKEOVER';}}
    if(room.host===ws.id)room.host=room.members.keys().next().value;
    if(!room.members.size){rooms.delete(room.code);return;}
    broadcast(room,lobby(room));
  }
  const upgrade=(req,socket,head)=>{
    let url;try{url=new URL(req.url,'http://local');}catch{return;}
    if(url.pathname!==path)return;
    // Rooms are anonymous but browser cross-origin socket access is restricted to this hub host.
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}}catch{socket.destroy();return;}}
    if(peers.size>=256){socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  };
  httpServer.on('upgrade',upgrade);
  wss.on('connection',ws=>{
    peers.add(ws);ws.id=randomBytes(10).toString('hex');ws.credit=100;ws.lastCredit=Date.now();ws.lastActive=Date.now();
    send(ws,{type:'hello',id:ws.id});
    ws.on('message',(raw,binary)=>{
      const now=Date.now();ws.credit=Math.min(100,ws.credit+(now-ws.lastCredit)*.06);ws.lastCredit=now;
      if(binary||ws.credit<1)return;ws.credit--;ws.lastActive=now;
      let data;try{data=JSON.parse(raw.toString());}catch{return;}
      if(!data||typeof data!=='object')return;
      const room=rooms.get(ws.code);
      if(data.type==='create'||data.type==='join'){
        if(ws.code){error(ws,'Leave your current room first.');return;}
        let target;
        if(data.type==='create'){
          if(rooms.size>=32){error(ws,'The track servers are full. Try again shortly.');return;}
          const letters='ABCDEFGHJKLMNPQRSTUVWXYZ';let code;
          do{code=Array.from({length:4},()=>letters[randomInt(letters.length)]).join('');}while(rooms.has(code));
          target={code,host:ws.id,mode:['sprint','race','gp','battle'].includes(data.mode)?data.mode:'race',track:D.clamp(Math.floor(Number(data.track)||0),0,D.TRACKS.length-1),members:new Map(),inputs:{},world:null,ticks:0,created:now};
          rooms.set(code,target);
        }else{
          const code=String(data.code||'').trim().toUpperCase();target=rooms.get(code);
          if(!target){error(ws,'Room not found. Check the code and try again.');return;}
          if(target.world){error(ws,'That race has already started. Join a new room.');return;}
          if(target.members.size>=8){error(ws,'That room is full.');return;}
        }
        ws.name=String(data.name||'Racer').replace(/[\x00-\x1f<>]/g,'').slice(0,18)||'Racer';
        ws.classId=D.CLASSES[data.classId]?data.classId:'medium';ws.code=target.code;target.members.set(ws.id,ws);
        broadcast(target,lobby(target));return;
      }
      if(!room)return;
      if(data.type==='leave'){leave(ws);return;}
      if(data.type==='input'&&room.world?.phase!=='results')room.inputs[ws.id]={...S.mergeInput(room.inputs[ws.id],data.input),at:now};
      if(data.type==='start'){
        if(room.host!==ws.id){error(ws,'Only the host can start the race.');return;}
        if(room.world&&room.world.phase!=='results')return;
        if(room.world?.mode==='gp'&&room.world.round<3&&room.world.phase==='results')room.world=S.nextGrandPrix(room.world);
        else room.world=S.createWorld({mode:room.mode,track:room.track,seed:randomInt(1,0x7fffffff),roster:[...room.members.values()].map(p=>({id:p.id,name:p.name,classId:p.classId,human:true}))});
        // A disconnected seat stays an AI in subsequent tournament rounds.
        for(const k of room.world.racers)if(!room.members.has(k.id))k.human=false;
        room.inputs={};broadcast(room,{type:'state',world:S.snapshot(room.world)});
      }
    });
    ws.on('close',()=>{leave(ws);peers.delete(ws);});ws.on('error',()=>{});
  });
  const interval=setInterval(()=>{
    const now=Date.now();
    for(const ws of peers)if(now-ws.lastActive>180000){send(ws,{type:'closed',message:'Room closed after three minutes without input.'});ws.close();}
    for(const room of rooms.values()){
      if(!room.world)continue;
      const inputs={};for(const[id,input]of Object.entries(room.inputs))inputs[id]=now-input.at<700?input:S.emptyInput();
      const previous=room.world.phase;S.step(room.world,inputs,S.STEP);
      for(const input of Object.values(room.inputs)){input.hop=false;input.use=false;input.reset=false;}
      if(++room.ticks%4===0||room.world.phase!==previous)broadcast(room,{type:'state',world:S.snapshot(room.world)});
    }
  },tickMs);interval.unref();
  let closed=false;
  function close(){if(closed)return;closed=true;clearInterval(interval);httpServer.off('upgrade',upgrade);for(const ws of peers)ws.terminate();wss.close();rooms.clear();}
  httpServer.once('close',close);
  return {paths:[path],rooms,close};
}
