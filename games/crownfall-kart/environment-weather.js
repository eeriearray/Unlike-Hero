(function(root){
  'use strict';
  const THREE=root.THREE,D=root.CrownData;
  class TrackWeather {
    constructor(owner){this.owner=owner;this.group=new THREE.Group();this.group.name='Profile weather';owner.scene.add(this.group);this.time=0;}
    setProfile(profile){
      for(const child of [...this.group.children]){child.geometry.dispose();child.material.dispose();this.group.remove(child);}
      this.dust=null;const owner=this.owner;this.profile=profile;this.time=0;const w=profile.weather,rng=D.rng(profile.seed+19);
      this.particles=Array.from({length:w.count},()=>({x:(rng()-.5)*100,y:rng()*60,z:(rng()-.5)*100,phase:rng()*Math.PI*2}));
      this.positions=new Float32Array(w.count*(w.type==='rain'?6:3));
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
      const color={snow:'#e5f6ff',embers:'#ff9c43',rain:'#8ccce2',mist:profile.atmosphere.color,ash:'#9d88ad',leaves:'#bd975b',spray:'#b9e8ed'}[w.type];
      const material=w.type==='rain'?new THREE.LineBasicMaterial({color,transparent:true,opacity:.28,depthWrite:false}):new THREE.PointsMaterial({color,map:owner.particleMesh.material.map,size:w.size,sizeAttenuation:true,transparent:true,opacity:w.type==='mist'?.12:.65,blending:w.type==='embers'?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:false});
      this.mesh=w.type==='rain'?new THREE.LineSegments(geometry,material):new THREE.Points(geometry,material);this.mesh.frustumCulled=false;this.group.add(this.mesh);this.setQuality(owner.quality);
      this.dust=null;
      if(w.secondary==='dust'){
        this.groundParticles=Array.from({length:80},()=>({x:(rng()-.5)*80,z:(rng()-.5)*80,phase:rng()*6}));const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(80*3),3));
        this.dust=new THREE.Points(g,new THREE.PointsMaterial({color:'#bc936b',size:2.3,map:owner.particleMesh.material.map,transparent:true,opacity:.13,depthWrite:false}));this.dust.frustumCulled=false;this.group.add(this.dust);
      }
      this.setQuality(owner.quality);this.anchor=new THREE.Vector3();this.placed=false;
    }
    setQuality(quality){if(!this.mesh)return;const factor=quality==='performance'?.3:quality==='balanced'?.65:1;this.count=Math.max(1,Math.floor(this.particles.length*factor));this.mesh.geometry.setDrawRange(0,this.count*(this.profile.weather.type==='rain'?2:1));if(this.dust)this.dust.geometry.setDrawRange(0,Math.ceil(80*factor));}
    update(dt,player,menu){
      if(!this.mesh||!player)return;dt=Math.min(.05,Math.max(0,dt));this.time+=dt;const w=this.profile.weather,rain=w.type==='rain',mist=w.type==='mist',speed=menu?0:player.speed;
      if(!this.placed||this.anchor.distanceTo(new THREE.Vector3(player.x,player.y,player.z))>120){this.anchor.set(player.x,player.y,player.z);this.placed=true;}
      // Recenter the weather volume without making particles stick to the car/camera.
      const dx=player.x-this.anchor.x,dy=player.y-this.anchor.y,dz=player.z-this.anchor.z;
      for(let i=0;i<this.count;i++){
        const p=this.particles[i];p.x-=dx;p.y-=dy;p.z-=dz;
        const radius=Math.hypot(p.x,p.z),wake=radius<7&&p.y<4?1-radius/7:0,angle=Math.atan2(p.z,p.x);
        p.x+=(w.wind[0]+Math.sin(this.time*.7+p.phase)*.4+Math.cos(angle+Math.PI/2)*speed*wake*.35+(player.vx||0)*wake*.12)*dt;
        p.z+=(w.wind[1]+Math.cos(this.time*.6+p.phase)*.4+Math.sin(angle+Math.PI/2)*speed*wake*.35+(player.vz||0)*wake*.12)*dt;
        p.y+=(w.type==='embers'?w.speed:mist?Math.sin(this.time+p.phase)*.08:-w.speed)*dt;
        p.x=D.mod(p.x+50,100)-50;p.z=D.mod(p.z+50,100)-50;p.y=D.mod(p.y,mist?3:60);
        const x=player.x+p.x,y=player.y-1+p.y,z=player.z+p.z,offset=i*(rain?6:3);
        this.positions[offset]=x;this.positions[offset+1]=y;this.positions[offset+2]=z;
        if(rain){this.positions[offset+3]=x-w.wind[0]*.06;this.positions[offset+4]=y+.75+speed*.012;this.positions[offset+5]=z-w.wind[1]*.06;}
      }
      if(this.dust){const a=this.dust.geometry.attributes.position;for(let i=0;i<this.groundParticles.length;i++){const p=this.groundParticles[i],radius=Math.hypot(p.x,p.z),wake=Math.max(0,1-radius/8);p.x=D.mod(p.x-dx+(w.wind[0]*2+(player.vx||0)*wake*.2)*dt+40,80)-40;p.z=D.mod(p.z-dz+(w.wind[1]*2+(player.vz||0)*wake*.2)*dt+40,80)-40;a.setXYZ(i,player.x+p.x,player.y+.2+Math.sin(this.time+p.phase)*.35,player.z+p.z);}a.needsUpdate=true;}
      this.anchor.set(player.x,player.y,player.z);this.mesh.geometry.attributes.position.needsUpdate=true;
      this.owner.renderer.domElement.dataset.weather=w.type;
    }
    dispose(){for(const child of this.group.children){child.geometry.dispose();child.material.dispose();}this.group.clear();this.owner.scene.remove(this.group);}
  }
  root.TrackWeather=TrackWeather;
})(window);
