(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./data.js') : root.CrownData, node ? require('./track.js') : root.CrownTrack);
  if (node) module.exports = api; else root.CrownSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D, T) {
  'use strict';
  const STEP = 1 / 60, RADIUS = 0.95, POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
  // Heavier gravity and a firmer hop keep the karts planted; ramps aim their own landings.
  const GRAVITY = 32, HOP = 4.2, RAMP_LIFT = 9.5, BOT_PACE = 0.91;
  // Three-lap races need longer than a sprint; time trial keeps four minutes so ghosts stay bounded.
  const TIME_LIMIT = { sprint: 240, trial: 240, race: 360, gp: 300 };
  // Mini-turbo by tier: forward impulse, duration and the extra top speed it allows. Bots get a weaker release so a clean player drift wins.
  const TURBO = [null, [8, 1.1, 10], [12, 1.6, 14], [16, 2.2, 19]], BOT_TURBO = .6;
  const emptyInput = () => ({ throttle: 0, steer: 0, drift: false, hop: false, use: false, reset: false, assist:true });
  function cleanInput(input = {}) {
    const finite = n => typeof n === 'number' && Number.isFinite(n) ? n : 0;
    return { throttle: D.clamp(finite(input.throttle), -1, 1), steer: D.clamp(finite(input.steer), -1, 1),
      drift: input.drift === true, hop: input.hop === true, use: input.use === true, reset: input.reset === true, assist:input.assist!==false };
  }
  // Preserve discrete presses across coalesced network packets; held drift is a state, not a repeat action.
  function mergeInput(previous, next) {
    const result = cleanInput(next); result.hop ||= previous?.hop === true; result.use ||= previous?.use === true; result.reset ||= previous?.reset === true;
    return result;
  }
  function createWorld(options = {}) {
    const mode = ['sprint', 'race', 'gp', 'trial', 'battle'].includes(options.mode) ? options.mode : 'race';
    const trackIndex = D.mod(Math.floor(options.track || 0), D.TRACKS.length), track = T.makeTrack(trackIndex);
    const roster = (options.roster || [{ id: 'player', name: 'You', classId: options.classId || 'medium', human: true }]).slice(0, 8);
    const count = mode === 'trial' ? 1 : 8, racers = [];
    for (let i = 0; i < count; i++) {
      const seat = roster[i] || { id: `bot-${i}`, name: D.BOT_NAMES[(i-1+D.BOT_NAMES.length)%D.BOT_NAMES.length], classId: ['light','medium','heavy'][i%3], human: false };
      const classId = D.CLASSES[seat.classId] ? seat.classId : 'medium';
      const distance = -6 - Math.floor(i/2)*3.1, lane = i%2 ? 2 : -2;
      const pose = mode === 'battle' ? { x: Math.sin(i*Math.PI/4)*27, z: Math.cos(i*Math.PI/4)*27, y: 6, heading: i*Math.PI/4+Math.PI, s: 0, segment: 0 } : T.sample(track, distance, lane);
      racers.push({ id: String(seat.id).slice(0,64), name: String(seat.name || 'Racer').slice(0,18), classId, human: !!seat.human,
        color: D.COLORS[i], x: pose.x, y: pose.y + .65, z: pose.z, yaw: pose.heading, vx: 0, vz: 0, vy: 0,
        speed: 0, grounded: true, wasDrift: false, hopUntil: 0, airStart: 0, trickEligible: false, trickPress: -999,
        drift: false, driftSign: 0, driftTime: 0, driftLevel: 0, driftAngle: 0, pendingDrift: false,
        boost: 0, boostExtra: 0, invincible: 0, autopilot: 0, spin: 0, hitGrace: 0,
        item: null, coins: 0, balloons: 3, eliminated: false, finishTime: null, place: i+1,
        s: pose.s, segment: pose.segment, distance, gate: -1, lap: 1, lane, surface: 'stone',
        lastReset: -10, lastItem: -10, lastPad: -10, draft:0, draftCooldown:0, aiDriftTimer: 0, aiSpeed: 1, aiAccel: 1, points: options.points?.[seat.id] || 0,
        input: emptyInput(), notice: '', noticeUntil: 0 });
    }
    return { version: 1, seed: options.seed || 173, random: D.rng(options.seed || 173), mode, trackIndex,
      round: options.round || 0, laps: mode === 'trial' || mode === 'race' ? 3 : mode === 'sprint' ? 1 : 2, time: 0, countdown: 3, phase: 'countdown',
      // The bot that starts beside the first human is their named rival: it races wheel to wheel all the way.
      rival: ['race','gp','sprint'].includes(mode) ? racers.find((k,i) => !k.human && i > 0 && racers[i-1].human)?.id || null : null,
      racers, boxes: T.boxPoses(track, mode === 'battle').map((p,i) => ({ id: i, x: p.x, y: p.y+.9, z: p.z, ready: 0 })),
      shots: [], traps: [], events: [], nextId: 1, resultOrder: [], finished: false, recordValid: true };
  }
  function notify(w, k, text, kind = 'notice') {
    k.notice = text; k.noticeUntil = w.time + 2.1;
    w.events.push({ id: w.nextId++, type: kind, racer: k.id, x: k.x, y: k.y, z: k.z, text });
  }
  function boost(w, k, impulse, duration, extra, message) {
    const forward = k.vx*Math.sin(k.yaw)+k.vz*Math.cos(k.yaw);
    const allowance = Math.max(k.boost > 0 ? k.boostExtra : 0, extra);
    // Mid-jump the arc is already aimed at the landing; the boost still runs, its push starts once the kart lands.
    const delta = !k.grounded && k.launchedAt != null ? 0 : Math.max(0, Math.min(impulse, D.CLASSES[k.classId].speed + allowance - forward));
    k.vx += Math.sin(k.yaw)*delta; k.vz += Math.cos(k.yaw)*delta;
    k.boost = Math.max(k.boost, duration); k.boostExtra = allowance;
    if (message) notify(w, k, message, 'boost');
  }
  function cancelDrift(k) { k.drift = false; k.pendingDrift = false; k.driftTime = 0; k.driftLevel = 0; k.driftAngle = 0; }
  function hit(w, k, attacker = null) {
    if (k.eliminated || k.finishTime != null || k.invincible > 0 || k.hitGrace > 0) return false;
    k.spin = 1; k.hitGrace = 1.65; k.vx *= .3; k.vz *= .3;
    k.boost = 0; k.boostExtra = 0; k.autopilot = 0; cancelDrift(k);
    if (w.mode === 'battle') { k.balloons--; if (k.balloons <= 0) k.eliminated = true; }
    notify(w, k, k.eliminated ? 'OUT OF BALLOONS' : 'HEXED!', 'hit');
    return true;
  }
  function respawn(w, k, penalize = true) {
    const track = T.makeTrack(w.trackIndex), gateStart = k.gate < 0 ? -6 : k.gate * track.length / track.gates + 1;
    // Resume near the last road position, never before the last gate, and back off far enough to take a ramp run-up.
    let s = Math.max(gateStart, k.distance - 6);
    for (const ramp of track.ramps || []) { const r = ramp * track.length, u = D.mod(s, track.length);
      if (u > r - 12 && u < r + 32) s += r - 28 - u; }
    s = Math.max(s, gateStart);
    const p = w.mode === 'battle' ? { x: 0, y: 6, z: 0, heading: k.yaw, s: 0, segment: 0 } : T.sample(track, s);
    const roll = w.mode === 'battle' ? 0 : 14;
    Object.assign(k, { x: p.x, y: p.y+.65, z: p.z, yaw: p.heading, vx: Math.sin(p.heading)*roll, vz: Math.cos(p.heading)*roll, vy: 0, speed: roll, grounded: true,
      s: p.s, segment: p.segment, distance: s, lane: 0, boost: 0, boostExtra: 0, autopilot: 0, spin: 0, hopUntil: 0,
      trickEligible: false, trickPress: -999, hitGrace: 1.5, lastReset: w.time });
    cancelDrift(k);
    if (penalize) { if (w.mode === 'trial') w.recordValid = false; notify(w, k, w.mode === 'trial' ? 'RESPAWN · RUN INVALID' : 'BACK ON TRACK'); }
  }
  // Ramps launch on a ballistic arc that lands on the road beyond the gap, even when the gap sits in a bend.
  function launch(w, k, track, rampS) {
    const gap = (track.gaps || []).find(g => { const ahead = D.mod(g.start*track.length - rampS + track.length/2, track.length) - track.length/2; return ahead > -2 && ahead < 40; });
    const landS = gap ? gap.end*track.length + 9 : rampS + 24, hint = T.sample(track, landS);
    const edge = T.edgeAt(track, hint.segment, k.lane) - 3, q = T.sample(track, landS, D.clamp(k.lane, -edge, edge));
    const rise = q.y + .65 - k.y; let lift = RAMP_LIFT;
    if (lift*lift < 2*GRAVITY*rise + 4) lift = Math.sqrt(2*GRAVITY*Math.max(0, rise)) + 2;
    const dx = q.x - k.x, dz = q.z - k.z, distance = Math.hypot(dx, dz);
    // Keep the kart's own speed and shape the arc's height instead, unless that would be absurdly flat or tall.
    let speed = Math.max(26, Math.hypot(k.vx, k.vz)), flight = distance / speed, keep = (rise + GRAVITY*flight*flight/2) / flight;
    if (keep >= 6 && keep <= 15) lift = keep;
    else speed = D.clamp(distance / ((lift + Math.sqrt(lift*lift - 2*GRAVITY*rise)) / GRAVITY), 16, 46);
    k.yaw = Math.atan2(dx, dz); k.vx = Math.sin(k.yaw)*speed; k.vz = Math.cos(k.yaw)*speed; k.vy = lift;
    k.grounded = false; k.airStart = w.time; k.trickEligible = true; k.hopUntil = .12; k.launchedAt = rampS;
    if (k.drift) cancelDrift(k);
    notify(w, k, 'JUMP! · TAP SPACE BEFORE LANDING', 'jump');
  }
  function standings(w) {
    const sorted = [...w.racers].sort((a,b) => {
      if (w.mode === 'battle') return b.balloons-a.balloons || a.id.localeCompare(b.id);
      if (a.finishTime != null || b.finishTime != null) return (a.finishTime ?? Infinity)-(b.finishTime ?? Infinity) || a.id.localeCompare(b.id);
      return b.distance-a.distance || a.id.localeCompare(b.id);
    });
    sorted.forEach((k,i) => { k.place = i+1; }); return sorted;
  }
  function findTarget(w, owner, leader = false) {
    const alive = w.racers.filter(k => k !== owner && !k.eliminated && k.finishTime == null);
    if (w.mode === 'battle') return alive.sort((a,b) => Math.hypot(a.x-owner.x,a.z-owner.z)-Math.hypot(b.x-owner.x,b.z-owner.z))[0] || null;
    return alive.filter(k => leader ? k.place === 1 : k.distance > owner.distance).sort((a,b) => a.distance-b.distance)[0] || null;
  }
  function useItem(w, k) {
    if (!k.item || k.spin > 0 || k.eliminated || w.phase !== 'racing' || w.mode === 'trial' || w.time-k.lastItem < .2) return false;
    const item = k.item, target = ['homing', 'hunter'].includes(item) ? findTarget(w,k,item==='hunter') : null;
    if (['homing','hunter'].includes(item) && !target) { notify(w,k,'NO TARGET AHEAD'); return false; }
    k.item = null; k.lastItem = w.time;
    switch (item) {
      case 'coin': k.coins++; notify(w,k,'CROWN SHARD +1'); if (k.coins%3===0) boost(w,k,5,.8,7,'SHARD BOOST'); break;
      case 'boost': boost(w,k,10,1.4,13,'RIFT BOOST'); break;
      case 'star': k.invincible=7; boost(w,k,8,7,8,'UNDYING'); break;
      case 'overdrive': k.autopilot=5; k.invincible=5; boost(w,k,16,5,18,'PHANTOM DRIVE'); cancelDrift(k); break;
      case 'trap':
        if (w.traps.length < 32) w.traps.push({ id: w.nextId++, owner: k.id, x:k.x-Math.sin(k.yaw)*2.5, y:k.y-.3, z:k.z-Math.cos(k.yaw)*2.5, age:0 });
        notify(w,k,'HEX MINE DROPPED'); break;
      default:
        for (let i = 0; i < (item==='triple' ? 3 : 1); i++) {
          if (w.shots.length >= 40) break;
          const yaw = k.yaw + (item==='triple' ? (i-1)*.20 : 0);
          w.shots.push({ id:w.nextId++, owner:k.id, target:target?.id || null, hunter:item==='hunter', homing:!!target,
            x:k.x+Math.sin(yaw)*2, y:k.y+.2, z:k.z+Math.cos(yaw)*2, yaw, age:0 });
        }
        notify(w,k,D.ITEMS[item].name.toUpperCase(),'shot');
    }
    return true;
  }
  function aiInput(w, k, dt) {
    if (k.eliminated || k.finishTime != null) return emptyInput();
    const track = T.makeTrack(w.trackIndex); let heading, turn, curvature=0;
    if (w.mode === 'battle') {
      const target = findTarget(w,k);
      const box = w.boxes.filter(b => b.ready<=0).sort((a,b) => Math.hypot(a.x-k.x,a.z-k.z)-Math.hypot(b.x-k.x,b.z-k.z))[0];
      const goal = k.item || !box ? target : box;
      heading = goal ? Math.atan2(goal.x-k.x,goal.z-k.z) : k.yaw;
    } else {
      const p = T.sample(track, k.s + 5 + k.speed*.3, Math.sin(w.time*.35 + w.racers.indexOf(k))*1.4);
      heading = Math.atan2(p.x-k.x,p.z-k.z);
      curvature=Math.abs(D.angle(T.sample(track,k.s+26).heading-T.sample(track,k.s+5).heading));
    }
    turn = D.angle(heading-k.yaw);
    k.aiDriftTimer += dt;
    const driftCycle = k.aiDriftTimer % 3.4;
    const drift = w.mode !== 'battle' && k.autopilot <= 0 && Math.abs(turn)>.22 && k.speed>12 && driftCycle<2.2;
    return { throttle: D.clamp(1-Math.max(0,Math.abs(turn)-.3)*.3-curvature*.4,.38,1), steer:D.clamp(-turn*2.6,-1,1),
      drift, use:!!k.item && w.time-k.lastItem>1.6 && (w.mode!=='battle' || Math.abs(turn)<.6 || ['trap','boost','star'].includes(k.item)), reset:false };
  }
  function drive(w,k,input,dt) {
    const stats = D.CLASSES[k.classId], track = T.makeTrack(w.trackIndex), battle = w.mode==='battle';
    for (const timer of ['boost','invincible','autopilot','spin','hitGrace','hopUntil','draftCooldown']) k[timer]=Math.max(0,k[timer]-dt);
    if (k.boost<=0) k.boostExtra=0;
    if (k.eliminated || k.finishTime != null) { k.vx*=Math.exp(-3*dt); k.vz*=Math.exp(-3*dt); return; }
    if (input.reset && w.time-k.lastReset>2) { respawn(w,k); return; }
    const human = w.racers.find(r => r.human && !r.eliminated && r.finishTime==null);
    // Bots run slightly below a human's pace and are pulled back toward them from either side, so the pack stays in reach.
    // The named rival has a tighter leash: it catches up harder and barely eases off, so there is always a duel.
    const rival = k.id === w.rival, gapToHuman = human ? human.distance-k.distance : 0, band = D.clamp((Math.abs(gapToHuman)-(rival?4:8))/(rival?40:60),0,1);
    const correction = !k.human && human && !battle ? (gapToHuman > 0 ? band*(rival?.12:.08) : -band*(rival?.05:.08)) : 0, pace = k.human || battle ? 1 : BOT_PACE;
    // Catch-up never lifts a bot above its class's own pace.
    k.aiSpeed += (Math.min(1,pace+correction)-k.aiSpeed)*Math.min(1,dt*2);
    k.aiAccel += (Math.min(1,pace+correction*1.3)-k.aiAccel)*Math.min(1,dt*2);
    const pressed = input.hop || (input.drift && !k.wasDrift), released = !input.drift && k.wasDrift;
    k.wasDrift=input.drift;
    if (pressed && k.spin<=0) {
      if (k.grounded) {
        k.vy=HOP; k.grounded=false; k.hopUntil=.12; k.airStart=w.time; k.trickEligible=false;
        k.pendingDrift=Math.abs(input.steer)>.2 && k.speed>7;
        k.driftSign=Math.sign(input.steer)||1;
      } else k.trickPress=w.time;
    }
    if (released) {
      if (k.driftLevel>0 && k.spin<=0) { const [impulse,duration,extra]=TURBO[k.driftLevel], scale=k.human?1:BOT_TURBO; boost(w,k,impulse*scale,duration*scale,extra*scale,`MINI TURBO ${['','I','II','III'][k.driftLevel]}`); }
      cancelDrift(k);
    }
    if (k.pendingDrift && k.grounded && input.drift && w.time-k.airStart<.85) { k.drift=true; k.pendingDrift=false; }
    if (k.pendingDrift && w.time-k.airStart>=.85) k.pendingDrift=false;
    if (k.drift && (k.speed<6 || k.spin>0)) cancelDrift(k);
    let steer=k.spin>0 ? 0 : input.steer;
    let assistedThrottle=1;
    if(!battle&&k.human&&k.autopilot<=0&&input.assist!==false&&!k.drift&&k.spin<=0&&Math.abs(input.steer)<.05&&input.throttle>0){
      // The assistant eases in from whatever the driver was doing and never yanks the wheel to full lock.
      // Gentle by default; it firms up over the last 50 m before a ramp so it never lines you up badly for a gap.
      const lining=(track.ramps||[]).some(r=>D.mod(r*track.length-k.s,track.length)<50),strength=lining?.85:.65;
      const navigation=aiInput(w,k,0),target=D.clamp(navigation.steer*strength,-strength,strength);
      k.assistSteer=(k.assistSteer??steer)+(target-(k.assistSteer??steer))*Math.min(1,dt*(lining?8:6));
      steer=k.assistSteer;assistedThrottle=Math.max(.7,navigation.throttle);
    }else k.assistSteer=steer;
    if (k.drift) steer=k.driftSign*D.clamp(.62+steer*k.driftSign*.45,.25,1.1);
    k.visualSteer=steer; // Presentation state travels with snapshots, including assisted/AI steering.
    const forwardSpeed=k.vx*Math.sin(k.yaw)+k.vz*Math.cos(k.yaw);
    // A +Z-facing kart viewed from behind has screen-right along local -X.
    // Positive steering means RIGHT for every input device; therefore it decreases world yaw.
    // Full lock at parking speeds would make high-speed keyboard taps twitchy; ease it off as speed rises.
    const speedFraction=D.clamp((k.speed-8)/(stats.speed-8),0,1.2), turnRate=stats.turn*D.clamp(k.speed/6,0,1)*(1-.22*speedFraction)*(k.drift?1.12:1);
    k.yaw=D.angle(k.yaw-steer*turnRate*(k.grounded?1:.3)*(forwardSpeed<-.5?-1:1)*dt);
    const sx=Math.sin(k.yaw), cz=Math.cos(k.yaw);
    k.surface=battle?'stone':T.surfaceAt(track,k.s,k.lane);
    const max=stats.speed*k.aiSpeed*(k.surface==='mud'&&k.boost<=0?.54:1)+(k.boost>0?k.boostExtra:0);
    if (k.grounded && k.spin<=0) {
      const direction=k.yaw+(k.drift?k.driftSign*.34:0), rx=Math.cos(direction), rz=-Math.sin(direction);
      const lateral=k.vx*rx+k.vz*rz, grip=1-Math.exp(-(k.drift?5.2:14)*dt);
      k.vx-=rx*lateral*grip; k.vz-=rz*lateral*grip;
      const current=k.vx*sx+k.vz*cz, throttle=input.throttle>0?input.throttle*assistedThrottle:input.throttle;
      const target=throttle>=0?max*throttle:max*.32*throttle;
      const rate=Math.abs(throttle)<.01?7:current*throttle<0||current>target+2?35:stats.acceleration*k.aiAccel;
      const delta=D.clamp(target-current,-rate*dt,rate*dt);
      k.vx+=sx*delta; k.vz+=cz*delta;
    }
    k.x+=k.vx*dt; k.z+=k.vz*dt;
    let floor=6, onRoad=true;
    if (!battle) {
      const p=T.project(track,k.x,k.z,k.segment);
      const delta=D.mod(p.s-k.s+track.length/2,track.length)-track.length/2;
      k.segment=p.segment; k.lane=p.lane; floor=p.y;
      const inCorridor=Math.sqrt(p.d2)<track.width*.5, gap=T.inGap(track,p.s);
      onRoad=inCorridor&&!gap;
      // A small hop or spin just before the lip still launches; otherwise a gap becomes an unavoidable fall.
      if(inCorridor&&k.y<floor+1.6&&delta>0&&delta<8){
        for(const ramp of track.ramps||[]){const r=ramp*track.length;if(k.s<r&&p.s>=r&&k.launchedAt!==r){launch(w,k,track,r);break;}}
      }
      if(gap&&k.grounded&&delta>0&&k.launchedAt==null){const ramp=(track.ramps||[]).map(r=>r*track.length).find(r=>D.mod(p.s-r,track.length)<40);if(ramp!=null)launch(w,k,track,ramp);}
      // Energy rails rebound ordinary departures. Large launches can clear the rails and fall.
      const edge=T.edgeAt(track,p.segment,p.lane);
      if (!gap && Math.abs(p.lane)>edge-.55 && Math.abs(p.lane)<track.width*.5+2 && k.y<floor+2.2) {
        const sign=Math.sign(p.lane), nx=Math.cos(p.heading)*sign,nz=-Math.sin(p.heading)*sign;
        const outward=k.vx*nx+k.vz*nz;
        // Scrape along the wall: cancel the outward push, keep most forward speed and turn the nose back along the road.
        if(outward>0){k.vx-=nx*outward*1.15;k.vz-=nz*outward*1.15;k.vx*=1-.6*dt;k.vz*=1-.6*dt;
          const along=D.angle(p.heading+(Math.cos(D.angle(k.yaw-p.heading))<0?Math.PI:0)-k.yaw);k.yaw=D.angle(k.yaw+along*Math.min(1,dt*6));}
        k.x=p.x+Math.cos(p.heading)*sign*(edge-.6); k.z=p.z-Math.sin(p.heading)*sign*(edge-.6); onRoad=true;
      }
      if(inCorridor && Math.abs(delta)<8) {
        k.distance+=delta;
        const gateSize=track.length/track.gates, next=(k.gate+1)*gateSize;
        if(delta>0 && k.distance>=next && k.distance-next<8) k.gate++;
        k.distance=Math.min(k.distance,(k.gate+1)*gateSize+.01);
        if(k.gate>=(w.mode==='sprint'?10:w.laps*track.gates)){k.finishTime=w.time;notify(w,k,'FINISH!','finish');}
      }
      k.s=p.s; k.lap=D.clamp(Math.floor(Math.max(0,k.distance)/track.length)+1,1,w.laps);
      if(onRoad&&k.grounded&&k.spin<=0&&w.time-k.lastPad>1.5){
        for(const pad of T.padPoses(track))if(Math.abs(D.mod(p.s-pad.s+track.length/2,track.length)-track.length/2)<2.7&&Math.abs(p.lane-(track.pads[pad.id].lane||0))<pad.width/2){
          k.lastPad=w.time;boost(w,k,9,1.2,12,'RIFT PAD BOOST');break;
        }
      }
    } else {
      const d=Math.hypot(k.x,k.z);
      if(d>39){const nx=k.x/d,nz=k.z/d,out=k.vx*nx+k.vz*nz;if(out>0){k.vx-=nx*out*1.7;k.vz-=nz*out*1.7;}k.x=nx*39;k.z=nz*39;}
    }
    const wasGrounded=k.grounded;
    if (k.grounded && (!onRoad || k.y-floor>.95)) { k.grounded=false; k.airStart=w.time; k.trickEligible=true; }
    if (!k.grounded) { k.vy-=GRAVITY*dt; k.y+=k.vy*dt; }
    if (onRoad && k.hopUntil<=0 && k.y<=floor+.65 && k.vy<=0) {
      k.y=floor+.65; k.vy=0; k.grounded=true;
      if (!wasGrounded && k.trickEligible && w.time-k.airStart>=.23 && w.time-k.trickPress<=.2 && k.spin<=0)
        boost(w,k,10,1.2,12,'LANDING BOOST');
      k.trickPress=-999; k.trickEligible=false; k.launchedAt=null;
    } else if(k.grounded) k.y=floor+.65;
    if(k.y<-20 || (!onRoad && !k.grounded && w.time-k.airStart>(k.human?1.6:2) && k.y<floor-3)) respawn(w,k);
    k.speed=Math.hypot(k.vx,k.vz);
    if(k.drift&&k.grounded){
      k.driftAngle=D.angle(Math.atan2(k.vx,k.vz)-k.yaw);
      if(k.driftAngle*k.driftSign>.08&&Math.abs(k.driftAngle)<1.35) k.driftTime+=dt;
      k.driftLevel=k.driftTime>=1.3?3:k.driftTime>=.8?2:k.driftTime>=.35?1:0;
    }
    if(input.use) useItem(w,k);
    if(!battle&&k.grounded&&k.spin<=0&&k.speed>14&&k.draftCooldown<=0){
      const drafting=w.racers.some(other=>{if(other===k||other.eliminated||Math.abs(other.y-k.y)>2)return false;
        const dx=other.x-k.x,dz=other.z-k.z,d=Math.hypot(dx,dz);return d>3&&d<14&&(dx*Math.sin(k.yaw)+dz*Math.cos(k.yaw))/d>.97;});
      k.draft=Math.max(0,k.draft+(drafting?dt:-dt*2));
      if(k.draft>=.85){k.draft=0;k.draftCooldown=4;boost(w,k,5,.9,7,'SLIPSTREAM BOOST');}
    }else k.draft=0;
  }
  function kartCollisions(w) {
    for(let i=0;i<w.racers.length;i++)for(let j=i+1;j<w.racers.length;j++){
      const a=w.racers[i],b=w.racers[j],aiming=k=>!k.grounded&&k.launchedAt!=null;if(a.eliminated||b.eliminated||a.finishTime!=null||b.finishTime!=null||Math.abs(a.y-b.y)>1.8||aiming(a)||aiming(b))continue;
      const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d>=RADIUS*2||d<.001)continue;
      const nx=dx/d,nz=dz/d,ia=1/D.CLASSES[a.classId].mass,ib=1/D.CLASSES[b.classId].mass,overlap=RADIUS*2-d;
      a.x-=nx*overlap*ia/(ia+ib);a.z-=nz*overlap*ia/(ia+ib);b.x+=nx*overlap*ib/(ia+ib);b.z+=nz*overlap*ib/(ia+ib);
      const relative=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
      if(relative<0){const impulse=-1.45*relative/(ia+ib);a.vx-=nx*impulse*ia;a.vz-=nz*impulse*ia;b.vx+=nx*impulse*ib;b.vz+=nz*impulse*ib;}
      if(a.invincible>0)hit(w,b,a);if(b.invincible>0)hit(w,a,b);
    }
  }
  function segmentDistance(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=D.clamp(((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(px-ax-dx*t,pz-az-dz*t);}
  function itemsStep(w,dt){
    const track=T.makeTrack(w.trackIndex);
    for(const box of w.boxes){box.ready=Math.max(0,box.ready-dt);if(box.ready>0)continue;
      // Boxes always shatter on contact; a kart that already holds an item simply gets nothing new.
      for(const k of w.racers){if(k.eliminated||k.finishTime!=null||Math.abs(k.y-box.y)>2.5)continue;
        if(Math.hypot(k.x-box.x,k.z-box.z)<2.1){box.ready=3;w.events.push({id:w.nextId++,type:'box',racer:k.id,x:box.x,y:box.y,z:box.z});
          if(!k.item&&k.spin<=0){k.item=D.rollItem(k.place,w.racers.length,w.random,w.mode==='battle');notify(w,k,D.ITEMS[k.item].name.toUpperCase(),'pickup');}break;}}
    }
    w.shots=w.shots.filter(shot=>{
      shot.age+=dt;if(shot.age>9)return false;
      const owner=w.racers.find(k=>k.id===shot.owner);
      let target=w.racers.find(k=>k.id===shot.target&&!k.eliminated&&k.finishTime==null);
      if(shot.hunter){target=w.racers.find(k=>k.place===1&&!k.eliminated&&k.finishTime==null);if(!target||target===owner)return false;shot.target=target.id;}
      if(shot.homing&&target){const desired=Math.atan2(target.x-shot.x,target.z-shot.z);shot.yaw=D.angle(shot.yaw+D.clamp(D.angle(desired-shot.yaw),-5*dt,5*dt));shot.y+=(target.y+.2-shot.y)*Math.min(1,dt*5);}
      const ox=shot.x,oz=shot.z;shot.x+=Math.sin(shot.yaw)*44*dt;shot.z+=Math.cos(shot.yaw)*44*dt;
      for(const k of w.racers){if(k===owner||k.eliminated||k.finishTime!=null||(shot.hunter&&k!==target)||Math.abs(k.y-shot.y)>1.8)continue;
        if(segmentDistance(k.x,k.z,ox,oz,shot.x,shot.z)<1.3){hit(w,k,owner);return false;}}
      if(w.mode==='battle')return Math.hypot(shot.x,shot.z)<40;
      if(shot.hunter)return true; // Super item floats over the void to reach the current leader.
      const p=T.project(track,shot.x,shot.z);return p.d2<(track.width*.5+1)**2;
    });
    w.traps=w.traps.filter(trap=>{trap.age+=dt;if(trap.age>25)return false;if(trap.age<.5)return true;
      for(const k of w.racers)if(k.id!==trap.owner&&!k.eliminated&&Math.abs(k.y-trap.y)<2&&Math.hypot(k.x-trap.x,k.z-trap.z)<1.7){hit(w,k);return false;}return true;});
    if(w.mode!=='battle')for(let i=0;i<2;i++){const p=T.hazardPose(track,w.time,i);for(const k of w.racers)if(!k.eliminated&&Math.abs(k.y-p.y)<2.5&&Math.hypot(k.x-p.x,k.z-p.z)<2)hit(w,k);}
  }
  function finishWorld(w){
    if(w.finished)return;
    const order=standings(w);w.resultOrder=order.map(k=>k.id);w.finished=true;w.phase='results';
    if(w.mode==='gp')order.forEach((k,i)=>{k.points+=POINTS[i]||0;});
  }
  function step(w, inputs = {}, dt = STEP){
    dt=D.clamp(Number.isFinite(dt)?dt:STEP,0,.05);w.events=[];
    if(w.phase==='results')return;
    if(w.phase==='countdown'){w.countdown-=dt;if(w.countdown<=0){w.countdown=0;w.phase='racing';}return;}
    w.time+=dt;
    standings(w);
    for(const k of w.racers){
      const input=!k.human||k.autopilot>0?aiInput(w,k,dt):cleanInput(inputs[k.id]);
      drive(w,k,input,dt);
    }
    kartCollisions(w);standings(w);
    if(w.mode!=='trial')itemsStep(w,dt);
    const humans=w.racers.filter(k=>k.human);
    if(w.mode==='battle'){
      if(w.racers.filter(k=>!k.eliminated).length<=1||w.time>=180)finishWorld(w);
    }else if(humans.every(k=>k.finishTime!=null)||w.time>=TIME_LIMIT[w.mode])finishWorld(w);
  }
  function nextGrandPrix(w){
    if(w.mode!=='gp'||w.round>=3||w.phase!=='results')return null;
    return createWorld({mode:'gp',round:w.round+1,track:(w.trackIndex+1)%D.TRACKS.length,seed:w.seed+1,
      roster:w.racers.map(k=>({id:k.id,name:k.name,classId:k.classId,human:k.human})),points:Object.fromEntries(w.racers.map(k=>[k.id,k.points]))});
  }
  function snapshot(w){
    const {random,events,...data}=w;
    return JSON.parse(JSON.stringify(data,(key,value)=>typeof value==='number'?Math.round(value*1000)/1000:value));
  }
  function sampleGhost(samples,time){
    if(!samples?.length)return null;
    let low=0,high=samples.length-1;
    if(time<=samples[0][0])return samples[0].slice(1);
    if(time>=samples[high][0])return null;
    while(low+1<high){const mid=(low+high)>>1;if(samples[mid][0]<=time)low=mid;else high=mid;}
    const a=samples[low],b=samples[high],f=D.clamp((time-a[0])/(b[0]-a[0]||1),0,1);
    return [a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f,a[3]+(b[3]-a[3])*f,a[4]+D.angle(b[4]-a[4])*f];
  }
  return {STEP,RADIUS,POINTS,TURBO,TIME_LIMIT,emptyInput,cleanInput,mergeInput,createWorld,step,standings,boost,hit,respawn,useItem,aiInput,nextGrandPrix,snapshot,sampleGhost};
});
