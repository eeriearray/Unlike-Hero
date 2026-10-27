(function(root){
  'use strict';
  const D=root.CrownData,T=root.CrownTrack,THREE=root.THREE;
  class KartRenderer {
    constructor(canvas){
      // r147 stores CSS colors in linear space only when legacy color management is disabled.
      THREE.ColorManagement.legacyMode=false;
      this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
      this.renderer.outputEncoding=THREE.sRGBEncoding;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
      this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(59,1,.1,1600);
      this.hemisphere=new THREE.HemisphereLight(0xb4c9e0,0x735338,.35);this.scene.add(this.hemisphere);
      this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      this.quality='high';this.renderScale=1;
      this.environment=new THREE.Group();this.scene.add(this.environment);this.dynamic=new THREE.Group();this.scene.add(this.dynamic);
      this.karts=new Map();this.entities=new Map();this.trackKey='';this.follow=new THREE.Vector3();this.look=new THREE.Vector3();this.readyCamera=false;
      this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.materials=new Map();this.materialDisposalHooks=new WeakSet();this.unitBox=new THREE.BoxGeometry(1,1,1);this.unitRock=new THREE.DodecahedronGeometry(1,0);
      this.scenery=new root.TrackScenery(this);this.roadTexture=this.scenery.road.map;this.artTextures=[];this.signBoards=[];this.lastMotion=new Map();this.particleCursor=0;
      this.particles=Array.from({length:420},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));
      this.particlePositions=new Float32Array(420*3);this.particleColors=new Float32Array(420*3);
      const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(this.particlePositions,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(this.particleColors,3));
      const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const glowContext=glowCanvas.getContext('2d'),glow=glowContext.createRadialGradient(32,32,0,32,32,31);glow.addColorStop(0,'rgba(255,255,255,1)');glow.addColorStop(.25,'rgba(255,255,255,.7)');glow.addColorStop(1,'rgba(255,255,255,0)');glowContext.fillStyle=glow;glowContext.fillRect(0,0,64,64);
      this.particleMesh=new THREE.Points(particleGeo,new THREE.PointsMaterial({size:.12,map:new THREE.CanvasTexture(glowCanvas),vertexColors:true,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));this.particleMesh.frustumCulled=false;this.scene.add(this.particleMesh);
      const streakGeo=new THREE.BufferGeometry();streakGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(36*6),3));
      this.streaks=new THREE.LineSegments(streakGeo,new THREE.LineBasicMaterial({color:'#c7ecff',transparent:true,opacity:0,depthTest:false,depthWrite:false}));this.streaks.frustumCulled=false;this.camera.add(this.streaks);this.scene.add(this.camera);
      this.post=new root.KartPostProcessing(this.renderer);this.ambientWeather=new root.TrackWeather(this);this.initSmoke();this.setQuality('high');
      this.resize();window.addEventListener('resize',()=>this.resize());
    }
    registerMaterials(){
      const register=m=>{if((m.isMeshStandardMaterial||m.isMeshPhysicalMaterial)&&!this.csm.shaders.has(m)){this.csm.setupMaterial(m);if(!this.materialDisposalHooks.has(m)){this.materialDisposalHooks.add(m);m.addEventListener('dispose',()=>this.csm?.shaders.delete(m));}}};
      this.scene.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])register(m);});
    }
    setQuality(value){
      const previousQuality=this.quality;
      this.quality=['performance','balanced','high'].includes(value)?value:'balanced';
      if(previousQuality===this.quality&&this.csm)return;
      const settings={performance:{cascades:1,size:1024,ratio:1,scale:.85},balanced:{cascades:2,size:1536,ratio:1.25,scale:1},high:{cascades:3,size:2048,ratio:1.5,scale:1}}[this.quality];
      if(this.csm){
        this.csm.remove();for(const light of this.csm.lights)light.shadow.dispose();this.csm.dispose();
        // CSM removes its uniforms on disposal. Release each material's cached programs
        // before reusing it, otherwise returning to a previous cascade count can revive
        // a program whose uniform list points at those removed values. Textures survive.
        const reset=new Set([...this.materials.values(),...this.scenery.materials]);
        this.scene.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])reset.add(m);});
        for(const material of reset)if(material.isMeshStandardMaterial)material.dispose();
      }
      this.csm=new root.CSM({camera:this.camera,parent:this.scene,cascades:settings.cascades,maxFar:this.quality==='performance'?90:260,shadowMapSize:settings.size,mode:'practical',lightDirection:new THREE.Vector3(.65,-.32,.7).normalize(),lightIntensity:2.6,lightNear:1,lightFar:800,lightMargin:180,shadowBias:-.000015});
      this.csm.fade=this.quality!=='performance';for(const light of this.csm.lights){light.color.set('#ffe0ac');light.shadow.normalBias=.025;}
      this.csm.updateFrustums();this.registerMaterials();this.scenery.setQuality(this.quality);this.ambientWeather.setQuality(this.quality);if(this.profile)this.applyProfileLighting();
      this.renderScale=settings.scale;this.pixelRatio=Math.min(devicePixelRatio||1,settings.ratio);this.renderer.setPixelRatio(this.pixelRatio*this.renderScale);
      this.post.quality=this.quality;this.post.resetHistory=true;this.resize();this.slowFrames=0;this.fastFrames=0;
      if(previousQuality!==this.quality){for(const mesh of this.karts.values())this.removeKart(mesh);this.karts.clear();if(this.ghost){this.removeKart(this.ghost);this.ghost=null;}}
      this.renderer.domElement.dataset.graphics=this.quality;
    }
    applyProfileLighting(){
      const p=this.profile;if(!p)return;
      this.renderer.toneMappingExposure=p.light.exposure;this.hemisphere.color.set(p.light.ambient);this.hemisphere.groundColor.set(p.light.ground);this.hemisphere.intensity=p.light.fill;
      this.csm.lightDirection.set(...p.sky.sun).normalize().negate();for(const light of this.csm.lights){light.color.set(p.light.color);light.intensity=p.light.intensity;}
      this.scene.fog=new THREE.FogExp2(p.atmosphere.color,p.atmosphere.density*.35);this.post.setProfile(p);this.csm.updateFrustums();
    }
    adaptResolution(dt,menu){
      if(menu||document.hidden||dt<=0)return;
      // Sustained frame budget feedback; no oscillation on isolated load/network spikes.
      this.slowFrames=dt>1/52?(this.slowFrames||0)+1:Math.max(0,(this.slowFrames||0)-1);
      this.fastFrames=dt<1/65?(this.fastFrames||0)+1:0;
      const old=this.renderScale,max=this.quality==='performance'?.85:1;
      if(this.slowFrames>100){this.renderScale=Math.max(.6,this.renderScale-.1);this.slowFrames=0;}
      if(this.fastFrames>360){this.renderScale=Math.min(max,this.renderScale+.05);this.fastFrames=0;}
      if(old!==this.renderScale){this.renderer.setPixelRatio(this.pixelRatio*this.renderScale);this.resize();}
      this.renderer.domElement.dataset.renderScale=this.renderScale.toFixed(2);
    }
    mat(color,emissive=false){const key=color+emissive;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.08,roughnessMap:emissive?null:this.scenery?.rock.roughnessMap,emissive:emissive?color:0,emissiveIntensity:emissive ? 3.2 : 0}));return this.materials.get(key);}
    mesh(geometry,color,parent=this.environment,emissive=false){const m=new THREE.Mesh(geometry,this.mat(color,emissive));parent.add(m);return m;}
    box(parent,x,y,z,sx,sy,sz,color,emissive=false){const m=this.mesh(this.unitBox,color,parent,emissive);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;}
    resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.csm)this.csm.updateFrustums();if(this.post)this.post.resize(Math.round(w*this.renderer.getPixelRatio()),Math.round(h*this.renderer.getPixelRatio()));}
    sign(text,sub,color,width=5,height=2){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#151521';ctx.fillRect(0,0,512,192);ctx.strokeStyle=color;ctx.lineWidth=8;ctx.strokeRect(5,5,502,182);ctx.fillStyle=color;ctx.font='bold 40px Arial';ctx.textAlign='center';ctx.fillText(text,256,82);ctx.fillStyle='#f9eddb';ctx.font='19px Arial';ctx.fillText(sub,256,137);
      const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;this.artTextures.push(texture);
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.userData.ownedMaterial=true;this.signBoards.push(mesh);return mesh;
    }
    disposeGroup(group){
      const geometries=new Set();group.traverse(object=>{if(object.geometry&&object.geometry!==this.unitBox&&object.geometry!==this.unitRock)geometries.add(object.geometry);});
      group.clear();for(const geometry of geometries)geometry.dispose();
    }
    removeKart(mesh){
      this.dynamic.remove(mesh);
      if(mesh.userData.ghost){const materials=new Set();mesh.traverse(o=>{if(o.isMesh)materials.add(o.material);});for(const material of materials)material.dispose();}
      mesh.traverse(o=>{if(o.userData.ownedMaterial&&!mesh.userData.ghost)o.material.dispose();});this.disposeGroup(mesh);
    }
    ribbon(track,laneA,laneB,offset,color){
      // Adjacent segments share their exact edge vertices. Sampling just before
      // each joint uses a different lane normal and creates overlapping wedges.
      const positions=[],colors=[],uvs=[],indices=[],base=new THREE.Color(color);
      for(let i=0;i<=track.count;i++){
        const distance=track.lengths[i];
        for(const [edge,lane] of [[0,laneA],[1,laneB]]){
          const p=T.sample(track,distance,lane);
          positions.push(p.x,p.y+offset,p.z);const shoulder=Math.abs(lane)>track.width/2-1.7;
          const grain=shoulder?.62+.18*Math.sin(i*2.37+edge):1;
          colors.push(base.r*grain,base.g*grain,base.b*grain);uvs.push(edge*Math.abs(laneB-laneA)/3,distance/3);
        }
        if(i<track.count&&!T.inGap(track,(distance+track.lengths[i+1])/2)){
          const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);
        }
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      const mat=offset===0?this.scenery.road:new THREE.MeshStandardMaterial({vertexColors:true,roughness:offset===0?.68:.8,metalness:offset===0?.12:0,side:THREE.DoubleSide,map:offset===0?this.roadTexture:null,emissive:color===track.energy?color:0,emissiveIntensity:.4});
      const mesh=new THREE.Mesh(geo,mat);this.environment.add(mesh);mesh.receiveShadow=true;mesh.userData.ownedMaterial=offset!==0;return mesh;
    }
    // Props belong to one stretch of road; skip any that would stand in another stretch's driving space.
    clearOfRoad(track,x,z,low,high,pad,s){
      for(let j=0;j<track.count;j+=2){const q=track.points[j],ds=Math.abs(track.lengths[j]-s);if(Math.min(ds,track.length-ds)<25)continue;
        if(q.y+3>low&&q.y-1.5<high&&Math.hypot(q.x-x,q.z-z)<track.width/2+pad)return false;}
      return true;
    }
    edgeBlend(track,side){
      const mesh=this.ribbon(track,side*(track.width/2-1.7),side*(track.width/2),.016,'#a6a28d');
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
      const ctx=canvas.getContext('2d'),rng=D.rng(71),pixels=ctx.createImageData(128,256);
      for(let y=0;y<256;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,noise=rng();pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=110+noise*100;pixels.data[i+3]=Math.pow(x/127,2)*(35+noise*110);}
      ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapT=THREE.RepeatWrapping;texture.encoding=THREE.sRGBEncoding;this.artTextures.push(texture);
      const uv=mesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,i%2);
      mesh.material.map=texture;mesh.material.transparent=true;mesh.material.depthWrite=false;mesh.material.roughness=1;
    }
    build(world){
      const battle=world.mode==='battle',sourceTrack=T.makeTrack(world.trackIndex),profile=root.CrownEnvironments.get(sourceTrack),track={...sourceTrack,energy:profile.accent,accent:profile.accent,stone:profile.rock},key=`${world.trackIndex}:${battle}:${world.mode==='sprint'}`;
      if(key===this.trackKey)return;
      for(const texture of this.artTextures)texture.dispose();this.artTextures=[];this.signBoards=[];
      this.environment.traverse(o=>{if(o.userData.ownedMaterial)o.material.dispose();});this.disposeGroup(this.environment);this.trackKey=key;this.readyCamera=false;
      this.weather=null;this.clouds=[];this.lastMotion.clear();for(const p of this.particles)p.life=0;for(const p of this.smoke)p.life=0;
      this.profile=profile;this.scenery.setProfile(profile);this.ambientWeather.setProfile(profile);this.applyProfileLighting();
      this.buildSky(track);
      this.buildTrackDetails(track,battle);
      const rng=D.rng(80+world.trackIndex),dummy=new THREE.Object3D();
      if(battle){
        const floor=this.mesh(new THREE.CylinderGeometry(42,39,5,48),track.stone);floor.position.y=3.5;
        const ring=this.mesh(new THREE.TorusGeometry(40,.28,5,96),track.energy,this.environment,true);ring.rotation.x=Math.PI/2;ring.position.y=6.5;
        for(let i=0;i<16;i++){const a=i*Math.PI/8;const pillar=this.box(this.environment,Math.sin(a)*40,8,Math.cos(a)*40,2,5,2,'#333042');pillar.rotation.y=a;}
      }else{
        this.ribbon(track,-track.width/2,track.width/2,0,'#575e6c');
        for(const side of [-1,1]){
          this.edgeBlend(track,side);
          this.ribbon(track,side*(track.width/2-.32),side*(track.width/2-.06),.13,track.energy);
          this.ribbon(track,side*(track.width/2-.95),side*(track.width/2-.72),.03,'#c7a56b');
        }
        const edgePositions=[];
        for(let i=0;i<track.count;i++){
          const s0=track.lengths[i],s1=track.lengths[i+1];if(T.inGap(track,(s0+s1)/2))continue;
          for(const side of [-1,1]){const a=T.sample(track,s0,side*track.width/2),b=T.sample(track,s1,side*track.width/2);edgePositions.push(a.x,a.y,a.z,b.x,b.y,b.z,a.x,a.y-1.4,a.z,a.x,a.y-1.4,a.z,b.x,b.y,b.z,b.x,b.y-1.4,b.z);}
        }
        const deckGeo=new THREE.BufferGeometry();deckGeo.setAttribute('position',new THREE.Float32BufferAttribute(edgePositions,3));deckGeo.computeVertexNormals();
        const deck=this.mesh(deckGeo,'#465064');deck.material=this.mat('#465064');deck.material.side=THREE.DoubleSide;deck.receiveShadow=true;
        const dashes=new THREE.InstancedMesh(this.unitBox,this.mat('#e5e8eb'),Math.floor(track.length/12));
        for(let i=0;i<dashes.count;i++){const p=T.sample(track,i*12);dummy.position.set(p.x,p.y+.035,p.z);dummy.rotation.set(0,p.heading,0);dummy.rotateX(-Math.atan2(T.sample(track,i*12+1).y-T.sample(track,i*12-1).y,2));dummy.scale.set(.16,.04,2.4);if(T.inGap(track,i*12))dummy.scale.setScalar(.001);dummy.updateMatrix();dashes.setMatrixAt(i,dummy.matrix);}this.environment.add(dashes);
        const curbCount=Math.floor(track.length/3),curbs=new THREE.InstancedMesh(this.unitBox,this.mat('#ffffff'),curbCount*2);
        for(let i=0;i<curbCount;i++)for(let side=0;side<2;side++){
          const p=T.sample(track,i*3,(side?1:-1)*(track.width/2-.55));dummy.position.set(p.x,p.y+.12,p.z);dummy.rotation.set(0,p.heading,0);dummy.rotateX(-Math.atan2(T.sample(track,i*3+1).y-T.sample(track,i*3-1).y,2));dummy.scale.set(.8,.22,1.5);if(T.inGap(track,i*3))dummy.scale.setScalar(.001);dummy.updateMatrix();curbs.setMatrixAt(i*2+side,dummy.matrix);curbs.setColorAt(i*2+side,new THREE.Color(i%2?'#e9eff4':'#e54b51'));
        }this.environment.add(curbs);
        for(const pad of T.padPoses(track)){
          const group=new THREE.Group();group.position.set(pad.x,pad.y+.1,pad.z);group.rotation.y=pad.heading;this.environment.add(group);
          this.box(group,0,0,0,pad.width,.12,4.5,'#143d4f');
          for(let i=0;i<3;i++)for(const side of [-1,1]){const arrow=this.box(group,side*pad.width*.18,.12,(i-1)*1.2,pad.width*.42,.07,.26,'#73ffdf',true);arrow.rotation.y=side*.45;}
        }
        for(const u of [.08,.26,.43,.6,.77,.92]){
          const p=T.sample(track,u*track.length,track.width/2+5),turn=D.angle(T.sample(track,u*track.length+30).heading-p.heading);
          if(!this.clearOfRoad(track,p.x,p.z,p.y,p.y+5,2,p.s))continue;
          const board=this.sign(Math.abs(turn)>.25?(turn>0?'<<< DRIFT LEFT':'DRIFT RIGHT >>>'):'FULL THROTTLE',T.sectionAt(track,u*track.length),track.accent);
          board.position.set(p.x,p.y+3,p.z);board.rotation.y=p.heading+Math.PI;this.environment.add(board);
          const support=this.box(this.environment,p.x,p.y+1,p.z,.2,4,.2,'#272434');support.rotation.y=p.heading;
        }
        for(let i=0;i<3;i++){
          const p=T.sample(track,(i+.1)/3*track.length),portal=new THREE.Group();
          if([-1,1].some(side=>{const q=T.sample(track,p.s,side*(track.width/2+.8));return !this.clearOfRoad(track,q.x,q.z,p.y,p.y+12,2,p.s);}))continue;portal.position.set(p.x,p.y,p.z);portal.rotation.y=p.heading;this.environment.add(portal);
          for(const side of [-1,1])this.box(portal,side*(track.width/2+.8),6,0,1.5,12,2.5,track.stone);
          this.box(portal,0,11,0,track.width+3,1.1,2.5,track.stone);this.box(portal,0,10.3,-1.3,track.width,.12,.12,track.energy,true);
          const board=this.sign(track.zones[i],`${i+1} / 3 · ${track.name.toUpperCase()}`,track.energy,10,2.2);board.position.set(0,11,-1.3);board.rotation.y=Math.PI;portal.add(board);
        }
        if(world.trackIndex===2){
          const tunnel=new THREE.InstancedMesh(this.unitBox,this.mat('#344d62'),63),lanterns=new THREE.InstancedMesh(new THREE.SphereGeometry(.35,8,6),this.mat(track.energy,true),42);let bay=0,light=0;
          for(const start of [.24,.43,.68])for(let i=0;i<7;i++){
            const p=T.sample(track,start*track.length+i*5),anchor=new THREE.Object3D();anchor.position.set(p.x,p.y,p.z);anchor.rotation.y=p.heading;anchor.updateMatrix();
            for(const side of [-1,0,1]){dummy.position.set(side*(track.width/2+1),side===0?8.7:4.3,0);dummy.rotation.set(0,0,0);dummy.scale.set(side===0?track.width+4:1,side===0?.8:8.6,5.2);dummy.updateMatrix();tunnel.setMatrixAt(bay++,new THREE.Matrix4().multiplyMatrices(anchor.matrix,dummy.matrix));}
            for(const side of [-1,1]){dummy.position.set(side*(track.width/2-1),6.6,0);dummy.scale.set(1,1.5,1);dummy.updateMatrix();lanterns.setMatrixAt(light++,new THREE.Matrix4().multiplyMatrices(anchor.matrix,dummy.matrix));}
          }this.environment.add(tunnel,lanterns);
        }
        // Thick, ink-like mud patches are matched to the simulation's surface bands.
        for(const {start,end,lane,width} of T.mudPatches(track)){
          const count=18,strip=new THREE.InstancedMesh(this.unitBox,this.mat('#211d29'),count);
          for(let i=0;i<count;i++){const p=T.sample(track,track.length*(start+(end-start)*i/count),lane);dummy.position.set(p.x,p.y+.055,p.z);dummy.rotation.set(0,p.heading,0);dummy.scale.set(width,.10,track.length*(end-start)/count+1);dummy.updateMatrix();strip.setMatrixAt(i,dummy.matrix);}this.environment.add(strip);
        }
        if(world.mode==='sprint'){
          const finish=T.sample(track,track.length*10/12),gate=new THREE.Group();gate.position.set(finish.x,finish.y,finish.z);gate.rotation.y=finish.heading;this.environment.add(gate);
          for(const side of [-1,1])this.box(gate,side*(track.width/2+.6),5,0,1.3,10,2,'#d6b57c');
          this.box(gate,0,9,0,track.width+3,.7,2,'#d6b57c');const sign=this.sign('SPRINT FINISH','THE CROWN IS YOURS TO STEAL','#ffde90',12,2.7);sign.position.set(0,8.8,-1.1);sign.rotation.y=Math.PI;gate.add(sign);
          for(let i=0;i<20;i++)this.box(gate,-track.width/2+i*track.width/20,.06,0,track.width/20,.08,2,i%2?'#efe8da':'#241e2e');
        }
        const start=T.sample(track,0),arch=new THREE.Group();arch.position.set(start.x,start.y,start.z);arch.rotation.y=start.heading;this.environment.add(arch);
        for(const side of [-1,1]){this.box(arch,side*8.2,4.3,0,1.2,8.6,1.7,'#48414f');this.box(arch,side*8.2,8.7,0,1.8,.5,2.2,'#bc9870');}
        this.box(arch,0,8.1,0,17.5,.8,1.6,'#39323f');this.box(arch,0,7.6,-.86,13,.10,.10,track.energy,true);
        for(let i=0;i<16;i++)this.box(arch,-7.5+i,0.04,0,.95,.05,1.5,i%2?'#ddd0ba':'#292732');
        const crown=this.mesh(new THREE.OctahedronGeometry(1.2,0),track.accent,arch,true);crown.position.y=10;
      }
      this.scenery.build(track,battle);
      this.environment.traverse(m=>{if(m.isMesh)m.receiveShadow=true;});
    }
    buildSky(){this.scenery.buildSky();}
    buildTrackDetails(track,battle){
      if(battle)return;
      const dummy=new THREE.Object3D(),count=Math.floor(track.length/4);
      const solid=['gothic','sandstone','ice','timber'].includes(this.profile.border);
      const railGeo=new THREE.BoxGeometry(solid?.3:.12,.35,4.1,1,12,1);const railPos=railGeo.attributes.position;for(let i=0;!solid&&i<railPos.count;i++)railPos.setX(i,railPos.getX(i)+Math.cos(railPos.getY(i)*36)*.045);railGeo.computeVertexNormals();
      const rails=new THREE.InstancedMesh(railGeo,this.scenery.border,count*4);
      const posts=new THREE.InstancedMesh(new THREE.CylinderGeometry(solid?.17:.065,solid?.2:.065,1.2,12),this.scenery.border,count*2);
      for(let i=0;i<count;i++)for(let side=0;side<2;side++){
        const distance=i*4,p=T.sample(track,distance,(side?1:-1)*(track.width/2+.25));
        const hidden=T.inGap(track,distance)||T.inGap(track,distance+2)||T.inGap(track,distance-2);
        for(let level=0;level<2;level++){dummy.position.set(p.x,p.y+.5+level*.45,p.z);dummy.rotation.set(0,p.heading,0);dummy.scale.set(1,1,1);if(hidden)dummy.scale.setScalar(.001);dummy.updateMatrix();rails.setMatrixAt(i*4+side*2+level,dummy.matrix);}
        dummy.position.set(p.x,p.y+.48,p.z);dummy.scale.set(1,1,1);if(hidden)dummy.scale.setScalar(.001);dummy.updateMatrix();posts.setMatrixAt(i*2+side,dummy.matrix);
      }
      rails.castShadow=posts.castShadow=true;this.environment.add(rails,posts);
      // Structural piers make the elevated circuit read as a built racing venue.
      const piers=new THREE.InstancedMesh(this.unitBox,this.mat('#4d5264'),Math.floor(track.length/24));
      for(let i=0;i<piers.count;i++){const distance=i*24,p=T.sample(track,distance);dummy.position.set(p.x,p.y-21,p.z);dummy.rotation.set(0,p.heading,0);dummy.scale.set(3,40,3);if(T.inGap(track,distance)||!this.clearOfRoad(track,p.x,p.z,p.y-41,p.y-1.2,1.5,distance))dummy.scale.setScalar(.001);dummy.updateMatrix();piers.setMatrixAt(i,dummy.matrix);}this.environment.add(piers);
      for(let i=0;i<24;i++){
        const p=T.sample(track,i/24*track.length,track.width/2+2);if(!this.clearOfRoad(track,p.x,p.z,p.y,p.y+9.5,3.5,p.s))continue;
        const g=new THREE.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.heading;this.environment.add(g);
        const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(0,7.8,0),new THREE.Vector3(-.3,9,0),new THREE.Vector3(-2.8,9.3,0)]);
        const pole=new THREE.Mesh(new THREE.TubeGeometry(curve,28,.075,10,false),this.scenery.metal);g.add(pole);
        const housing=this.box(g,-3,9.25,0,1.1,.16,.48,'#454743');housing.material=this.scenery.metal;
        this.box(g,-3,9.14,0,.85,.035,.35,'#ffe6b7',true);
        g.traverse(m=>{if(m.isMesh)m.castShadow=true;});
      }
      this.rubberWear(track);

    }
    rubberWear(track){
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=512;const ctx=canvas.getContext('2d'),rng=D.rng(216);
      for(let y=0;y<512;y++){const fade=.1+.15*Math.sin(y*.015)**2;for(let x=0;x<128;x++){ctx.fillStyle=`rgba(12,11,9,${Math.sin(x/128*Math.PI)*fade*rng()})`;ctx.fillRect(x,y,1,1);}}
      const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.encoding=THREE.sRGBEncoding;this.artTextures.push(texture);
      for(const lane of [-2.3,-1.15,1.15,2.3]){const strip=this.ribbon(track,lane-.15,lane+.15,.012,'#ffffff');strip.material.map=texture;strip.material.transparent=true;strip.material.depthWrite=false;strip.material.roughness=.62;const uv=strip.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,i%2);}
    }
    coachwork(parent,color,x,y,z,width,height,length){
      const shape=new THREE.Shape(),w=width/2,h=height/2,r=Math.min(.16,h*.65);
      shape.moveTo(-w+r,-h);shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);shape.lineTo(-w+r,h);shape.quadraticCurveTo(-w,h,-w,h-r);shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
      const geo=new THREE.ExtrudeGeometry(shape,{depth:length-.12,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.06,bevelThickness:.06,curveSegments:5});geo.translate(0,0,-(length-.12)/2);
      const key='paint:'+color;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshPhysicalMaterial({color,metalness:.55,roughness:.25,clearcoat:1,clearcoatRoughness:.17,envMapIntensity:1.2}));
      const mesh=new THREE.Mesh(geo,this.materials.get(key));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    }
    makeKart(k,ghost=false){
      const group=new THREE.Group(),visual=new THREE.Group();group.add(visual);
      const stats=D.CLASSES[k.classId],color=ghost?'#9de5ef':k.color||stats.color;
      const wheels=root.buildSportsCar(this,visual,color);
      if(k.classId==='heavy'){visual.scale.set(1.08,1.06,1.08);}
      if(k.classId==='light')visual.scale.set(.89,.95,.91);
      const flames=[];for(const x of [-.38,.38]){const flame=this.mesh(new THREE.ConeGeometry(.19,1.3,7),'#9af7ed',visual,true);flame.rotation.x=-Math.PI/2;flame.position.set(x,.1,-1.65);flame.visible=false;flames.push(flame);}
      const sparks=[];for(const x of [-.88,.88]){const spark=this.mesh(new THREE.OctahedronGeometry(.16),'#7bd7ff',visual,true);spark.position.set(x,-.1,-.8);spark.visible=false;sparks.push(spark);}
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.8,3.8),new THREE.MeshBasicMaterial({map:this.particleMesh.material.map,color:'#080e18',transparent:true,opacity:.42,depthWrite:false}));group.add(shadow);shadow.userData.ownedMaterial=true;shadow.rotation.x=-Math.PI/2;shadow.position.y=-.59;
      const balloons=[];for(let i=0;i<3;i++){const b=this.mesh(new THREE.SphereGeometry(.4,10,8),color,group);b.position.set((i-1)*.8,2.5+Math.abs(i-1)*.25,-.5);balloons.push(b);const string=this.box(group,(i-1)*.4,1.65,-.5,.018,1.2,.018,'#b3a5be');balloons.push(string);}
      if(ghost){group.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.28;o.material.depthWrite=false;}});}
      group.userData={baseScale:visual.scale.clone(),bounceTime:1,lean:0,steer:0,visual,wheels,flames,sparks,balloons,shadow,ghost,classId:k.classId};this.dynamic.add(group);return group;
    }
    initSmoke(){
      const count=320;this.smoke=Array.from({length:count},()=>({life:0}));this.smokeCursor=0;
      const geo=new THREE.BufferGeometry();for(const name of ['position','color'])geo.setAttribute(name,new THREE.BufferAttribute(new Float32Array(count*3),3));
      for(const name of ['size','alpha'])geo.setAttribute(name,new THREE.BufferAttribute(new Float32Array(count),1));
      const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelScale:{value:600}},
        vertexShader:`attribute float size,alpha;attribute vec3 color;varying vec3 tint;varying float opacity;uniform float pixelScale;
        void main(){tint=color;opacity=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*pixelScale/max(1.,-p.z),1.,80.);}`,
        fragmentShader:`varying vec3 tint;varying float opacity;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
        void main(){float r=length(gl_PointCoord-.5)*2.;float turbulence=.55+noise(gl_PointCoord*7.)*.3+noise(gl_PointCoord*17.)*.15;float a=(1.-smoothstep(.05,.95,r))*opacity*turbulence;if(a<.005)discard;gl_FragColor=vec4(tint*(.85+turbulence*.3),a);}`});
      this.smokeMesh=new THREE.Points(geo,mat);this.smokeMesh.frustumCulled=false;this.scene.add(this.smokeMesh);
    }
    emitSmoke(k,dust,acceleration){
      const p=this.smoke[this.smokeCursor++%this.smoke.length],side=Math.random()<.5?-1:1;
      Object.assign(p,{x:k.x-Math.sin(k.yaw)*1.35+Math.cos(k.yaw)*side*(dust?.85:.36),y:k.y-(dust?.45:0),z:k.z-Math.cos(k.yaw)*1.35-Math.sin(k.yaw)*side*(dust?.85:.36),
        vx:-k.vx*.08+(Math.random()-.5)*1.4,vy:dust?.4:1.1,vz:-k.vz*.08+(Math.random()-.5)*1.4,life:dust?1.1:.85,maxLife:dust?1.1:.85,size:dust?.45:.24+acceleration*.008,dust});
    }
    updateSmoke(dt){
      const a=this.smokeMesh.geometry.attributes;
      this.smokeMesh.material.uniforms.pixelScale.value=innerHeight*this.renderer.getPixelRatio()*.7;
      for(let i=0;i<this.smoke.length;i++){const p=this.smoke[i];p.life=Math.max(0,p.life-dt);if(!p.life){a.alpha.setX(i,0);continue;}
        p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;const age=1-p.life/p.maxLife;
        a.position.setXYZ(i,p.x,p.y,p.z);a.size.setX(i,p.size+age*(p.dust?1.4:.85));a.alpha.setX(i,Math.sin(Math.PI*age)*(p.dust?.32:.22));
        a.color.setXYZ(i,p.dust?.48:.36,p.dust?.36:.4,p.dust?.23:.46);
      }for(const attribute of Object.values(a))attribute.needsUpdate=true;
    }
    emit(x,y,z,color,count=1,vx=0,vz=0){
      const c=new THREE.Color(color);
      for(let i=0;i<count;i++){
        const index=this.particleCursor++%this.particles.length,p=this.particles[index];
        Object.assign(p,{x:x+(Math.random()-.5)*.4,y,z:z+(Math.random()-.5)*.4,vx:vx+(Math.random()-.5)*3,vy:1+Math.random()*3,vz:vz+(Math.random()-.5)*3,life:.25+Math.random()*.4});
        this.particleColors[index*3]=c.r;this.particleColors[index*3+1]=c.g;this.particleColors[index*3+2]=c.b;
      }
    }
    updateParticles(dt){
      for(let i=0;i<this.particles.length;i++){
        const p=this.particles[i];p.life-=dt;
        if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=8*dt;}
        this.particlePositions[i*3]=p.life>0?p.x:0;this.particlePositions[i*3+1]=p.life>0?p.y:-1000;this.particlePositions[i*3+2]=p.life>0?p.z:0;
      }
      this.particleMesh.geometry.attributes.position.needsUpdate=true;this.particleMesh.geometry.attributes.color.needsUpdate=true;
    }
    syncEntities(world,time){
      const needed=new Set();
      const sync=(id,type,p,color)=>{
        needed.add(id);let mesh=this.entities.get(id);
        if(!mesh){mesh=this.mesh(type==='box'?new THREE.OctahedronGeometry(.8):type==='hazard'?new THREE.IcosahedronGeometry(1.5,0):type==='trap'?new THREE.OctahedronGeometry(.65):new THREE.SphereGeometry(.32,8,6),color,this.dynamic,true);this.entities.set(id,mesh);}
        mesh.position.set(p.x,p.y+(type==='box'?Math.sin(time*2+p.id)*.23:0),p.z);mesh.rotation.y=time*(type==='box'?1:2);mesh.rotation.z=type==='hazard'?time:.2;
      };
      if(world.mode!=='trial'){
        for(const box of world.boxes)if(box.ready<=0)sync(`b${box.id}`,'box',box,'#d5acff');
        for(const shot of world.shots)sync(`s${shot.id}`,'shot',shot,shot.hunter?'#ffdb78':'#c6a0ff');
        for(const trap of world.traps)sync(`t${trap.id}`,'trap',trap,'#ff87cb');
        if(world.mode!=='battle')for(let i=0;i<2;i++){const p=T.hazardPose(T.makeTrack(world.trackIndex),world.time,i);sync(`h${i}`,'hazard',{...p,y:p.y+1},'#c177e5');}
      }
      for(const [id,mesh]of this.entities)if(!needed.has(id)){this.dynamic.remove(mesh);mesh.geometry.dispose();this.entities.delete(id);}
    }
    render(world,playerId,dt,menu=false,ghostPose=null){
      dt=D.clamp(dt,0,.05);this.build(world);const track=T.makeTrack(world.trackIndex),ids=new Set(world.racers.map(k=>k.id));
      for(const[id,m]of this.karts)if(!ids.has(id)){this.removeKart(m);this.karts.delete(id);this.lastMotion.delete(id);}
      const now=performance.now()/1000;
      for(const k of world.racers){
        let mesh=this.karts.get(k.id);if(!mesh||mesh.userData.classId!==k.classId){if(mesh)this.removeKart(mesh);mesh=this.makeKart(k);this.karts.set(k.id,mesh);}
        const target=new THREE.Vector3(k.x,k.y,k.z),snap=menu||!mesh.userData.placed||mesh.position.distanceTo(target)>12;
        mesh.position.lerp(target,snap?1:1-Math.exp(-18*dt));mesh.rotation.y+=D.angle(k.yaw-mesh.rotation.y)*(snap?1:1-Math.exp(-20*dt));mesh.userData.placed=true;mesh.visible=!k.eliminated;
        const u=mesh.userData;u.visual.rotation.y=k.spin>0?(k.spin*18):k.drift?-k.driftSign*.08:0;
        const previous=this.lastMotion.get(k.id),blend=1-Math.exp(-14*dt);
        const acceleration=previous&&!snap?D.clamp((k.speed-previous.speed)/Math.max(dt,.001),-40,40):0;
        u.steer+=((k.visualSteer||0)-u.steer)*blend;
        u.lean+=(u.steer*Math.min(.15,k.speed*.005)-u.lean)*blend;u.visual.rotation.z=u.lean;
        if(previous&&!snap&&previous.grounded&&!k.grounded&&k.hopUntil>0&&!k.trickEligible)u.bounceTime=0;
        if(previous&&!snap&&!previous.grounded&&k.grounded){u.bounceTime=.24;if(k.id===playerId&&previous.vy < -4)this.shake=Math.max(this.shake||0,Math.min(.16,-previous.vy*.009));}
        u.bounceTime+=dt;
        const bounce=this.reduced?0:u.bounceTime<.09?-.2*Math.sin(u.bounceTime/.09*Math.PI):u.bounceTime<.24?.22*Math.sin((u.bounceTime-.09)/.15*Math.PI):u.bounceTime<.46?-.13*Math.sin((u.bounceTime-.24)/.22*Math.PI):0;
        u.visual.scale.copy(u.baseScale);u.visual.scale.y*=1+bounce;u.visual.scale.x*=1-bounce*.45;u.visual.scale.z*=1-bounce*.45;
        // Follow the road's slope so the nose dips downhill and lifts uphill instead of hovering level.
        let pitch=0;
        if(k.grounded&&world.mode!=='battle'){const ahead=T.sample(track,k.s+1.6),behind=T.sample(track,k.s-1.6),facing=Math.cos(D.angle(k.yaw-ahead.heading));pitch=-Math.atan2(ahead.y-behind.y,3.2)*facing;}
        else if(!k.grounded)pitch=D.clamp(-Math.atan2(k.vy,Math.max(4,k.speed))*.5,-.3,.3);
        u.pitch=snap?pitch:(u.pitch||0)+(pitch-(u.pitch||0))*(1-Math.exp(-(k.grounded?16:6)*dt));
        u.visual.rotation.x=u.pitch+(k.grounded?Math.sin(now*28+k.x)*Math.min(.006,k.speed*.0002)-D.clamp(acceleration*.0016,-.035,.035):0);
        for(const wheel of u.wheels){wheel.rotation.y=wheel.userData.front?-u.steer*.42:0;wheel.children[0].rotation.x+=(k.vx*Math.sin(k.yaw)+k.vz*Math.cos(k.yaw))*dt/.38;}
        for(const flame of u.flames){flame.visible=k.boost>0;flame.scale.y=.8+Math.sin(now*40)*.2;}
        for(const spark of u.sparks){spark.visible=k.driftLevel>0;spark.material=this.mat(k.driftLevel===3?'#bd73ff':k.driftLevel===2?'#ff963c':'#65cfff',true);spark.scale.setScalar(1+Math.sin(now*26)*.3);}
        u.balloons.forEach((b,i)=>{b.visible=world.mode==='battle'&&Math.floor(i/2)<k.balloons;});
        // Physics rides .65 above the road; seat the tyres on the asphalt rather than a hand's width above it.
        u.visual.position.y=.56*u.baseScale.y-.65+(k.invincible>0?Math.sin(now*14)*.04:0);
        u.shadow.position.y=(world.mode==='battle'?6:T.sample(track,k.s).y)-mesh.position.y+.05;
        u.shadow.visible=world.mode==='battle'||!T.inGap(track,k.s);
        if(!menu&&!snap&&!k.eliminated){
          u.smokeBudget=(u.smokeBudget||0)+dt*(k.speed>1?7+Math.max(0,acceleration)*.9:2);
          while(u.smokeBudget>=1){this.emitSmoke(k,false,Math.max(0,acceleration));u.smokeBudget--;}
          const dusty=k.grounded&&k.speed>4&&(k.surface==='mud'||(world.mode!=='battle'&&Math.abs(k.lane)>track.width/2-1.4));
          u.dustBudget=(u.dustBudget||0)+(dusty?dt*Math.min(45,k.speed*1.2):0);
          while(u.dustBudget>=1){this.emitSmoke(k,true,0);u.dustBudget--;}
          u.sparkBudget=(u.sparkBudget||0)+dt*45;
          const sparkCount=Math.floor(u.sparkBudget);u.sparkBudget-=sparkCount;
          if(k.drift&&k.grounded)for(const side of [-1,1])this.emit(k.x+Math.cos(k.yaw)*side*.85,k.y-.4,k.z-Math.sin(k.yaw)*side*.85,k.driftLevel===3?'#bd73ff':k.driftLevel===2?'#ff963c':'#65cfff',sparkCount,-k.vx*.15,-k.vz*.15);
          if(k.boost>0&&sparkCount)this.emit(k.x-Math.sin(k.yaw)*1.4,k.y,k.z-Math.cos(k.yaw)*1.4,'#8ffff0',sparkCount,-k.vx*.2,-k.vz*.2);
          if(previous&&!previous.grounded&&k.grounded)this.emit(k.x,k.y-.3,k.z,k.boost>0?'#ffe3a0':'#c6b6cc',18);
          if(previous&&k.spin>previous.spin+.1){this.emit(k.x,k.y,k.z,'#ffa889',28);if(k.id===playerId)this.shake=.14;}
        }
        this.lastMotion.set(k.id,{grounded:k.grounded,spin:k.spin,speed:k.speed,vy:k.vy});
      }
      if(ghostPose){const classId=world.racers[0].classId;if(this.ghost&&this.ghost.userData.classId!==classId){this.removeKart(this.ghost);this.ghost=null;}if(!this.ghost)this.ghost=this.makeKart({classId,color:'#9de5ef'},true);this.ghost.visible=true;this.ghost.position.set(ghostPose[0],ghostPose[1],ghostPose[2]);this.ghost.rotation.y=ghostPose[3];}
      else if(this.ghost)this.ghost.visible=false;
      this.syncEntities(world,now);
      const own=world.racers.find(k=>k.id===playerId)||world.racers[0];
      const player=own.eliminated ? world.racers.find(k=>!k.eliminated&&k.place===1)||own : own;
      if(menu){
        const p=world.mode==='battle'?{x:0,y:6,z:22,heading:Math.PI}:T.sample(track,-6);
        // Keep the showroom camera inside the gate opening, clear of its side pillars.
        const yaw=p.heading+(this.reduced ? .62 : .62+Math.sin(now*.12)*.06);
        this.follow.set(p.x+Math.sin(yaw)*11,p.y+5.5,p.z+Math.cos(yaw)*11);
        this.look.set(player.x-3*Math.cos(p.heading),player.y+.5,player.z+3*Math.sin(p.heading));
        this.camera.position.copy(this.follow);this.camera.lookAt(this.look);this.readyCamera=false;this.camera.fov=59;this.camera.updateProjectionMatrix();this.shake=0;
      }else{
        const yaw=player.yaw,speed=player.speed;
        this.follow.set(player.x-Math.sin(yaw)*(6.5+speed*.045),player.y+2.65,player.z-Math.cos(yaw)*(6.5+speed*.045));
        const ahead=world.mode==='battle'?null:T.sample(track,player.s+16);
        const look=new THREE.Vector3(player.x+Math.sin(yaw)*10,Math.max(player.y-3,ahead?.y??player.y)+1.2,player.z+Math.cos(yaw)*10);
        if(!this.readyCamera||this.camera.position.distanceTo(this.follow)>35){this.cameraBase=this.follow.clone();this.camera.position.copy(this.follow);this.look.copy(look);this.readyCamera=true;}
        this.cameraBase.lerp(this.follow,1-Math.exp(-(player.boost>0?4.5:7)*dt));this.camera.position.copy(this.cameraBase);this.look.lerp(look,1-Math.exp(-10*dt));this.camera.lookAt(this.look);
        if(!this.reduced){this.camera.rotateZ(player.drift?player.driftSign*.025:0);const shake=this.shake||0;this.camera.position.x+=Math.sin(now*71)*shake;this.camera.position.y+=Math.cos(now*89)*shake*.65;}
        this.shake=(this.shake||0)*Math.exp(-12*dt);
        const fov=60+(this.reduced?0:Math.min(5,speed*.13)+D.clamp((speed*3.6-130)/35,0,1)*12+(player.boost>0?13:0));this.camera.fov+=(fov-this.camera.fov)*Math.min(1,dt*4);this.camera.updateProjectionMatrix();
      }
      this.updateParticles(dt);this.updateSmoke(dt);this.ambientWeather.update(dt,player,menu);
      for(const cloud of this.clouds){cloud.position.x=cloud.userData.origin.x+Math.sin(now*.025+cloud.userData.phase)*22;cloud.position.z=cloud.userData.origin.z+Math.cos(now*.018+cloud.userData.phase)*12;}
      const boardPosition=new THREE.Vector3();for(const board of this.signBoards){board.getWorldPosition(boardPosition);board.visible=boardPosition.distanceTo(this.camera.position)>8;}
      // Let the camera frustum clip racers naturally; proximity-based hiding pops during overtakes.
      if(this.weather){const positions=this.weather.geometry.attributes.position;for(let i=0;i<positions.count;i++){let y=positions.getY(i)-dt*(2+i%3);if(y<0)y=95;positions.setY(i,y);}positions.needsUpdate=true;}
      const streakAmount=!this.reduced&&!menu?D.clamp((player.speed-24)/25,0,1)*(player.boost>0?.45:.16):0;
      this.streaks.material.opacity=streakAmount;
      const streakPositions=this.streaks.geometry.attributes.position;
      for(let i=0;i<36;i++){
        const angle=i/36*Math.PI*2,phase=D.mod(now*1.8+i*.37,1),r=1.1+phase*1.2;
        streakPositions.setXYZ(i*2,Math.cos(angle)*r*this.camera.aspect,Math.sin(angle)*r,-3);
        streakPositions.setXYZ(i*2+1,Math.cos(angle)*(r+.25)*this.camera.aspect,Math.sin(angle)*(r+.25),-3);
      }streakPositions.needsUpdate=true;
      this.registerMaterials();this.camera.updateMatrixWorld();
      if(Math.abs((this.shadowFov||0)-this.camera.fov)>.3){this.csm.updateFrustums();this.shadowFov=this.camera.fov;}this.csm.update();
      this.renderer.info.autoReset=false;this.renderer.info.reset();this.post.render(this.scene,this.camera,this.reduced,menu?0:player.speed,dt);
      this.adaptResolution(dt,menu);
      this.frameCount=(this.frameCount||0)+1;
      if(!this.frameStarted)this.frameStarted=now;
      if(now-this.frameStarted>=1){this.renderer.domElement.dataset.fps=String(Math.round(this.frameCount/(now-this.frameStarted)));this.renderer.domElement.dataset.drawCalls=String(this.renderer.info.render.calls);this.frameStarted=now;this.frameCount=0;}
    }
    drawMap(canvas,world,playerId){
      const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,track=T.makeTrack(world.trackIndex);
      ctx.clearRect(0,0,w,h);
      const bounds=track.bounds,centerX=(bounds.minX+bounds.maxX)/2,centerZ=(bounds.minZ+bounds.maxZ)/2;
      const scale=world.mode==='battle'?w/100:(w-24)/Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ);
      const pos=(x,z)=>[w/2+(x-(world.mode==='battle'?0:centerX))*scale,h/2+(z-(world.mode==='battle'?0:centerZ))*scale];
      ctx.strokeStyle='#756981';ctx.lineWidth=world.mode==='battle'?3:5;ctx.beginPath();
      if(world.mode==='battle')ctx.arc(w/2,h/2,40*scale,0,Math.PI*2);
      else track.points.forEach((p,i)=>{const[x,y]=pos(p.x,p.z);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
      for(const k of [...world.racers].reverse()){if(k.eliminated)continue;const[x,y]=pos(k.x,k.z);ctx.fillStyle=k.id===playerId?'#ffe1a0':k.color;ctx.beginPath();ctx.arc(x,y,k.id===playerId?5:3,0,Math.PI*2);ctx.fill();}
    }
  }
  root.KartRenderer=KartRenderer;
})(window);
