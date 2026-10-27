import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import attach from '../games/crownfall-kart/server/index.mjs';
import { createRequire } from 'node:module';
const D=createRequire(import.meta.url)('../games/crownfall-kart/engine/data.js');

async function setup(t){
  const server=createServer((req,res)=>res.end('test'));
  const game=attach({httpServer:server,tickMs:2});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{game.close();await new Promise(resolve=>server.close(resolve));});
  return {game,url:`ws://127.0.0.1:${server.address().port}/games/crownfall-kart/ws`};
}
async function client(url,t){
  const ws=new WebSocket(url),queue=[],waiting=[];
  ws.on('message',raw=>{const data=JSON.parse(raw);const index=waiting.findIndex(w=>w.type===data.type&&w.predicate(data));
    if(index>=0){const[entry]=waiting.splice(index,1);clearTimeout(entry.timer);entry.resolve(data);}else queue.push(data);});
  t.after(()=>{for(const w of waiting){clearTimeout(w.timer);w.reject(new Error('Client closed'));}ws.terminate();});
  await once(ws,'open');
  const next=(type,predicate=()=>true)=>{
    const index=queue.findIndex(d=>d.type===type&&predicate(d));if(index>=0)return Promise.resolve(queue.splice(index,1)[0]);
    return new Promise((resolve,reject)=>{const entry={type,predicate,resolve,reject};entry.timer=setTimeout(()=>{const i=waiting.indexOf(entry);if(i>=0)waiting.splice(i,1);reject(new Error(`Timed out waiting for ${type}`));},5000);waiting.push(entry);});
  };
  const hello=await next('hello');return {ws,id:hello.id,next,send:data=>ws.send(JSON.stringify(data))};
}

test('online rooms share server-owned races, reject guest starts and switch disconnected humans to AI',async t=>{
  const{game,url}=await setup(t),host=await client(url,t),guest=await client(url,t);
  host.send({type:'create',name:'Host',classId:'heavy',mode:'race',track:1});const lobby=await host.next('lobby');
  assert.match(lobby.code,/^[A-Z]{4}$/);assert.equal(lobby.host,host.id);
  guest.send({type:'join',code:lobby.code,name:'<Guest>',classId:'light'});const joined=await guest.next('lobby',d=>d.seats.length===2);
  assert.equal(joined.seats[1].name,'Guest');assert.equal(joined.seats[1].classId,'light');
  guest.send({type:'start'});assert.match((await guest.next('error')).message,/host/);
  host.send({type:'start'});const first=(await host.next('state')).world,second=(await guest.next('state')).world;
  assert.equal(first.racers.length,8);assert.equal(first.racers.filter(k=>k.human).length,2);assert.equal(second.trackIndex,1);
  assert.equal(first.racers.find(k=>k.id===host.id).classId,'heavy');
  guest.send({type:'state',world:{racers:[{id:guest.id,x:999999,item:'star'}]}});
  guest.send({type:'input',input:{throttle:999,steer:0,x:999999,item:'star',coins:1000}});
  const active=(await guest.next('state',d=>d.world.phase==='racing'&&d.world.time>.3)).world;
  const racer=active.racers.find(k=>k.id===guest.id);assert.ok(Math.abs(racer.x)<300);assert.ok(racer.speed<60);assert.equal(racer.coins,0);
  const late=await client(url,t);late.send({type:'join',code:lobby.code,name:'Late'});assert.match((await late.next('error')).message,/started/);
  host.ws.close();const migrated=await guest.next('lobby',d=>d.host===guest.id);assert.equal(migrated.running,true);
  const authoritative=game.rooms.get(lobby.code).world;assert.equal(authoritative.racers.find(k=>k.id===host.id).human,false);
});

test('online lobbies enforce eight human seats and clamp untrusted room configuration',async t=>{
  const{url}=await setup(t),host=await client(url,t);host.send({type:'create',mode:'invalid',track:999,name:'Host',classId:'invalid'});
  const lobby=await host.next('lobby');assert.equal(lobby.mode,'race');assert.equal(lobby.track,D.TRACKS.length-1);assert.equal(lobby.seats[0].classId,'medium');
  for(let i=1;i<8;i++){const peer=await client(url,t);peer.send({type:'join',code:lobby.code,name:`Racer ${i}`});await peer.next('lobby',d=>d.seats.length===i+1);}
  const ninth=await client(url,t);ninth.send({type:'join',code:lobby.code,name:'Ninth'});assert.match((await ninth.next('error')).message,/full/);
  host.send({type:'start'});assert.equal((await host.next('state')).world.trackIndex,D.TRACKS.length-1);
});

test('the authoritative server completes Rift Sprint at gate ten without requiring a lap',{timeout:12000},async t=>{
  const{url}=await setup(t),host=await client(url,t);host.send({type:'create',mode:'sprint',track:0,name:'Sprint driver'});await host.next('lobby');host.send({type:'start'});
  let view=(await host.next('state')).world;assert.equal(view.mode,'sprint');assert.equal(view.laps,1);let packets=0;
  host.send({type:'input',input:{throttle:1,assist:true}});
  while(view.phase!=='results'&&packets++<1200){view=(await host.next('state')).world;if(packets%4===0)host.send({type:'input',input:{throttle:1,assist:true}});}
  const racer=view.racers.find(k=>k.id===host.id);assert.equal(view.phase,'results');assert.equal(racer.gate,10);assert.ok(racer.finishTime>0&&racer.finishTime<120);
});
