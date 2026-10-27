(function(root){
  'use strict';
  const THREE=root.THREE,D=root.CrownData,T=root.CrownTrack;
  class TrackScenery {
    constructor(owner){
      this.owner=owner;this.textures=[];this.ready=[];this.failed=[];this.skyCache=new Map();this.materialTextures=new Map();
      const loader=new THREE.TextureLoader();
      const load=(name,color)=>{const t=loader.load('assets/pbr/'+name,()=>this.ready.push(name),undefined,()=>this.failed.push(name));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=color?THREE.sRGBEncoding:THREE.LinearEncoding;t.anisotropy=Math.min(8,owner.renderer.capabilities.getMaxAnisotropy());this.textures.push(t);return t;};
      this.road=new THREE.MeshStandardMaterial({color:0xffffff,map:load('asphalt_02_diff.jpg',true),normalMap:load('asphalt_02_nor_gl.jpg'),normalScale:new THREE.Vector2(.55,.55),roughnessMap:load('asphalt_02_rough.jpg'),roughness:1,metalness:0});
      this.rock=new THREE.MeshStandardMaterial({color:'#b9a48e',map:load('sandstone_cracks_diff.jpg',true),normalMap:load('sandstone_cracks_nor_gl.jpg'),normalScale:new THREE.Vector2(1.3,1.3),roughnessMap:load('sandstone_cracks_rough.jpg'),roughness:1,metalness:0,vertexColors:true});
      this.metal=new THREE.MeshStandardMaterial({color:'#a1a5a3',metalness:.85,roughness:.37,roughnessMap:this.road.roughnessMap});
      this.bark=new THREE.MeshStandardMaterial({color:'#5b4937',map:this.rock.map,normalMap:this.rock.normalMap,roughness:1});
      this.needles=new THREE.MeshStandardMaterial({color:'#56603c',roughness:1,side:THREE.DoubleSide,vertexColors:true});
      this.glass=new THREE.MeshPhysicalMaterial({color:'#10181c',metalness:0,roughness:.16,clearcoat:.8,clearcoatRoughness:.1,envMapIntensity:.38});
      this.rubber=new THREE.MeshStandardMaterial({color:'#191a19',map:this.road.map,normalMap:this.road.normalMap,normalScale:new THREE.Vector2(.18,.18),roughness:.94});
      this.road.envMapIntensity=.3;this.rock.envMapIntensity=.35;this.needles.envMapIntensity=.35;this.bark.envMapIntensity=.35;
      this.border=new THREE.MeshPhysicalMaterial({roughness:.6,metalness:.4});
      this.materials=[this.border,this.road,this.rock,this.metal,this.bark,this.needles,this.glass,this.rubber];
    }
    setProfile(profile){
      this.profile=profile;const surface=profile.surface;
      this.road.color.set(surface.color);this.road.roughness=surface.roughness;this.road.metalness=surface.metalness;this.road.normalScale.setScalar(surface.normal);
      this.road.envMapIntensity=.3+profile.atmosphere.wet*.7;this.road.userData.profile=profile.id;
      const textures=this.terrainTextures(profile);this.rock.map=textures.color;this.rock.roughnessMap=textures.roughness;this.rock.color.set(profile.rock);this.rock.roughness=profile.terrain==='obsidian'?.32:1;this.rock.metalness=profile.terrain==='obsidian'?.18:0;this.rock.needsUpdate=true;
      this.needles.color.set(profile.foliage);
      const border=profile.border;this.border.color.set(border==='gothic'?profile.rock:border==='timber'?'#786046':border==='brass'?'#c9a966':profile.accent);
      this.border.map=['gothic','sandstone','timber'].includes(border)?textures.color:null;this.border.roughness=border==='ice'?.18:border==='brass'?.28:.68;this.border.metalness=['brass','neon'].includes(border)?.8:0;this.border.clearcoat=border==='ice'?1:0;this.border.emissive.set(border==='neon'?profile.accent:'#000000');this.border.emissiveIntensity=border==='neon'?.7:0;this.border.needsUpdate=true;
    }
    terrainTextures(profile){
      if(this.materialTextures.has(profile.id))return this.materialTextures.get(profile.id);
      const size=512,color=document.createElement('canvas'),rough=document.createElement('canvas');color.width=color.height=rough.width=rough.height=size;
      const c=color.getContext('2d'),r=rough.getContext('2d'),pixels=c.createImageData(size,size),roughPixels=r.createImageData(size,size),rng=D.rng(profile.seed);
      const kind=profile.terrain;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=(y*size+x)*4,n=rng(),strata=Math.sin(y*.09+Math.sin(x*.015)*2)*.025,vein=Math.abs(Math.sin(x*.029+Math.sin(y*.021)*3));
        let v=.68+n*.15+strata,green=1,blue=1;
        if(kind==='snow'){v=.88+n*.12;blue=1.03;}
        if(kind==='moss'){v=.35+n*.2+Math.sin(x*.04)*Math.cos(y*.05)*.14;green=1.2;blue=.7;}
        if(kind==='obsidian'){v=.22+n*.06+(vein>.96?.32:0);blue=1.2;}
        if(kind==='concrete'){v=.5+n*.12;if(x%128<3||y%64<3)v*=.55;}
        if(kind==='slate'){v=.5+n*.16+strata;if(Math.abs(Math.sin((y+Math.sin(x*.018)*8)*.11))<.035)v*=.75;blue=1.08;}
        if(kind==='coral'){v=.72+n*.18;green=1.02;blue=.95;}
        for(let j=0;j<3;j++){pixels.data[i+j]=Math.min(255,v*255*(j===1?green:j===2?blue:1));roughPixels.data[i+j]=(kind==='obsidian'?.5:kind==='snow'?.92:.76+n*.2)*255;}pixels.data[i+3]=roughPixels.data[i+3]=255;
      }
      c.putImageData(pixels,0,0);r.putImageData(roughPixels,0,0);
      const make=(canvas,encoding)=>{const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=encoding;t.anisotropy=4;this.textures.push(t);return t;};
      const result={color:kind==='sandstone'?this.bark.map:make(color,THREE.sRGBEncoding),roughness:make(rough,THREE.LinearEncoding)};this.materialTextures.set(profile.id,result);return result;
    }
    buildSky(){
      const o=this.owner,p=this.profile,apply=entry=>{o.scene.background=entry.sky;o.scene.environment=entry.env.texture;};
      let entry=this.skyCache.get(p.id);
      if(!entry){
        // Each profile owns a true linear HDR equirectangular sky, including reflected celestial lighting.
        const w=1024,h=512,data=new Float32Array(w*h*4),sun=new THREE.Vector3(...p.sky.sun).normalize(),top=new THREE.Color(p.sky.zenith),horizon=new THREE.Color(p.sky.horizon),ground=new THREE.Color(p.sky.ground),rng=D.rng(p.seed),v=new THREE.Vector3(),base=new THREE.Color();
        const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7+p.seed)*43758.5453;return n-Math.floor(n);};return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;};
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const phi=y/h*Math.PI,theta=x/w*Math.PI*2;v.set(-Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta));
          const gradient=Math.pow(Math.max(0,v.y),.45);base.copy(v.y>0?top:ground);if(v.y>0)base.lerp(horizon,1-gradient);
          const alignment=v.dot(sun),angle=Math.acos(Math.max(-1,Math.min(1,alignment))),radius=p.sky.moon||.012;
          let disc=angle<radius?p.sky.disc:Math.pow(Math.max(0,alignment),80)*.4;
          if(p.sky.eclipse&&angle<radius*.82)disc=0;
          if(p.sky.rings&&Math.abs(v.y-sun.y+(v.x-sun.x)*.35)<.009&&angle<radius*2.4&&angle>radius)disc=3;
          const star=p.sky.stars&&v.y>.1&&rng()>.9993?1.5*p.sky.stars:0;
          const aurora=p.sky.aurora?Math.exp(-Math.pow((v.y-.4-Math.sin(theta*3)*.12)*15,2))*(.5+.5*Math.sin(theta*13))*.8:0;
          const n=noise(v.x*6+v.z*2,v.z*6+v.y*3)*.7+noise(v.x*15,v.z*15+v.y*7)*.3;const clouds=v.y>.03?Math.max(0,n-(.8-p.sky.clouds*.3))*.35:0;
          const i=(y*w+x)*4;data[i]=base.r+disc+star+clouds;data[i+1]=base.g+disc*.94+star+aurora+clouds;data[i+2]=base.b+disc*.86+star+aurora*.55+clouds;data[i+3]=1;
        }
        const sky=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);sky.mapping=THREE.EquirectangularReflectionMapping;sky.minFilter=sky.magFilter=THREE.LinearFilter;sky.needsUpdate=true;
        const generator=new THREE.PMREMGenerator(o.renderer),env=generator.fromEquirectangular(sky);generator.dispose();entry={sky,env};this.skyCache.set(p.id,entry);
      }
      // LRU keeps switching eight maps from retaining eight HDR cubemaps indefinitely.
      this.skyCache.delete(p.id);this.skyCache.set(p.id,entry);apply(entry);
      while(this.skyCache.size>3){const [id,old]=this.skyCache.entries().next().value;this.skyCache.delete(id);if(old.sky!==this.photoSky)old.sky.dispose();old.env.dispose();}
      if(p.sky.asset){
        const applyPhoto=()=>{
          if(this.profile.id!==p.id)return;const current=this.skyCache.get(p.id);if(!current||current.sky===this.photoSky)return;
          const generator=new THREE.PMREMGenerator(o.renderer);current.sky.dispose();current.env.dispose();current.sky=this.photoSky;current.env=generator.fromEquirectangular(this.photoSky);generator.dispose();apply(current);
        };
        if(this.photoSky)applyPhoto();else if(!this.photoLoading){this.photoLoading=true;new root.RGBELoader().load('assets/pbr/golden-hour.hdr',texture=>{texture.mapping=THREE.EquirectangularReflectionMapping;this.photoSky=texture;this.ready.push('golden-hour.hdr');applyPhoto();},undefined,()=>this.failed.push('golden-hour.hdr'));}
      }
      o.renderer.domElement.dataset.environment=p.id;
    }
    rockGeometry(radius=1){
      const g=new THREE.SphereGeometry(radius,48,32),p=g.attributes.position,colors=[],uv=g.attributes.uv;
      for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=1+.025*Math.sin(y*27)+.1*Math.sin(x*7+z*4)*Math.cos(y*9)+.025*Math.sin(z*23+x*12);p.setXYZ(i,x*s,y,z*s);const layer=.86+.055*Math.sin(y*37)+.025*Math.sin(y*83);colors.push(layer,layer*.94,layer*.85);uv.setXY(i,uv.getX(i)*7,uv.getY(i)*5);}
      g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
    }
    pineGeometry(){
      // Individually oriented needle sprays, merged once and instanced across the valley.
      const positions=[],colors=[],rng=D.rng(192);
      for(let b=0;b<95;b++){const t=b/95,angle=b*2.3999,r=(1-t)*2.6,y=1+t*10;
        for(let n=0;n<32;n++){const f=rng(),a=angle+(rng()-.5)*.8,x=Math.cos(a)*r*f,z=Math.sin(a)*r*f,py=y-f*.65+(rng()-.5)*.4;
          const len=.22+rng()*.42,spread=.07+rng()*.08;
          positions.push(x-spread,py,z,x+spread,py,z,x+Math.cos(a)*len,py+.22,z+Math.sin(a)*len);
          const shade=.5+rng()*.5;for(let v=0;v<3;v++)colors.push(shade*.85,shade,shade*.72);
        }
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
    }
    build(track,battle){
      const o=this.owner,profile=this.profile,rng=D.rng(profile.seed),dummy=new THREE.Object3D();
      const abyss=['castles','cathedral'].includes(profile.architecture),city=profile.architecture==='city',alpine=profile.architecture==='alpine';
      const bounds=track.bounds,cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
      const radius=Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ)*.65+110;
      // Detailed continuous valley floor and weather-eroded ridge, with horizontal sediment bands.
      const rings=55,segments=256,positions=[],uvs=[],colors=[],indices=[];
      for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
        const a=i/segments*Math.PI*2,r=j/rings*(radius+480),ridge=Math.exp(-Math.pow((r-radius-90)/95,2));
        const erosion=Math.sin(a*19+r*.027)*10+Math.sin(a*43-r*.07)*4+Math.sin(r*.22+a*21)*2;
        const mountainHeight=city||profile.architecture==='observatory'?0:profile.architecture==='forest'?28:alpine?220:112;
        const y=-38+ridge*(mountainHeight+(city?0:35*Math.sin(a*5)+18*Math.sin(a*11)+erosion))+Math.sin(r*.017)*5;
        positions.push(cx+Math.sin(a)*r,y,cz+Math.cos(a)*r);uvs.push(i/segments*90,j/rings*42);
        const band=.8+.12*Math.sin(y*.55)+.04*Math.sin(y*2.1);colors.push(band,band*.94,band*.83);
        if(j<rings&&i<segments){const n=j*(segments+1)+i;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}
      }
      const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrain.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.setIndex(indices);terrain.computeVertexNormals();
      const mountain=new THREE.Mesh(terrain,this.rock);mountain.receiveShadow=true;if(!abyss)o.environment.add(mountain);else terrain.dispose();
      const rocks=new THREE.InstancedMesh(this.rockGeometry(),this.rock,100);
      for(let i=0;i<100;i++){const a=i/100*Math.PI*2,r=radius-15+rng()*100;dummy.position.set(cx+Math.sin(a)*r,-14+rng()*18,cz+Math.cos(a)*r);dummy.rotation.set(0,rng()*6,0);dummy.scale.set(12+rng()*25,25+rng()*62,14+rng()*20);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.castShadow=rocks.receiveShadow=true;if(!abyss&&!city&&profile.architecture!=='observatory')o.environment.add(rocks);else rocks.geometry.dispose();
      // Roadside rock shelves follow the actual elevation without blocking crossing roads.
      const places=[];
      for(let i=0;i<90;i++){const side=i%2?1:-1,p=T.sample(track,i/90*track.length,side*(track.width/2+9));let clear=true;
        for(let j=0;j<track.points.length;j+=3){const q=track.points[j];if(Math.hypot(q.x-p.x,q.z-p.z)<track.width/2+4&&Math.abs(q.y-p.y)<18){clear=false;break;}}
        if(clear&&!T.inGap(track,p.s))places.push(p);
      }
      if(battle)places.splice(0,places.length,...Array.from({length:50},(_,i)=>({x:Math.sin(i/50*Math.PI*2)*60,z:Math.cos(i/50*Math.PI*2)*60,y:3})));
      const shelves=new THREE.InstancedMesh(this.rockGeometry(),this.rock,places.length);
      const trees=new THREE.InstancedMesh(this.pineGeometry(),this.needles,places.length),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.08,.3,11,12,4),this.bark,places.length);
      places.forEach((p,i)=>{dummy.position.set(p.x,p.y-8,p.z);dummy.rotation.set(0,i*1.3,0);dummy.scale.set(5,9,5);dummy.updateMatrix();shelves.setMatrixAt(i,dummy.matrix);
        const scale=.8+rng()*.6;dummy.position.set(p.x,p.y-.4,p.z);dummy.scale.setScalar(scale);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);dummy.position.y+=5.1*scale;dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);});
      for(const m of [shelves,trees,trunks]){m.castShadow=m.receiveShadow=true;o.environment.add(m);}if(abyss||city||profile.architecture==='observatory')shelves.visible=false;this.trees=trees;this.trunks=trunks;this.treeCount=Math.floor(places.length*Math.min(1,profile.trees));
      root.buildTrackArchitecture(o,track,profile);
      this.setQuality(o.quality);
    }
    setQuality(quality){if(this.trees){this.trees.count=this.trunks.count=quality==='performance'?Math.ceil(this.treeCount*.45):this.treeCount;}}
  }
  root.TrackScenery=TrackScenery;
})(window);
