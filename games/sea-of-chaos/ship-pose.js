export function shipPose(s,t,reduced=false){
 const heave=reduced?0:(Math.sin(s.x*.17-s.z*.09+t*.9)*.16+Math.sin(s.x*.08+s.z*.21-t*.7)*.11)*.7;
 if(s.whirl>=0){const spin=s.whirl?-1:1,drag=Math.max(.4,s.drag||0),sink=s.dead?(s.respawnDuration||(s.team!==undefined?5:8))-s.dead:0;return {y:heave-drag*drag*4.7-sink*3,roll:spin*(.16+drag*.48),pitch:.18+drag*.48,scale:Math.max(.38,1-drag*.38-sink*.2),visible:!s.dead||s.dead>(s.respawnDuration||(s.team!==undefined?5:8))-1.2};}
 const sink=s.dead?(s.respawnDuration||(s.team!==undefined?5:8))-s.dead:0;return {y:(s.height||0)+heave-sink*4,roll:reduced?0:-(s.yawRate||0)*Math.min(1,Math.abs(s.v)/16)*.11+Math.sin(t*1.6+s.buoyA)*.018+sink*.36,pitch:reduced?0:Math.sin(t*1.4+s.buoyA)*.012+sink*.1,scale:1,visible:!s.dead||s.dead>(s.respawnDuration||(s.team!==undefined?5:8))-1.2};
}
