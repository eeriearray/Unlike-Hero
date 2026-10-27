(function(root){
  'use strict';
  const THREE=root.THREE,D=root.CrownData;
  class ArchitectureBatch {
    constructor(owner){this.owner=owner;this.batches=new Map();this.dummy=new THREE.Object3D();}
    add(geometry,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
      const key=geometry.uuid+material.uuid;let batch=this.batches.get(key);if(!batch){batch={geometry,material,matrices:[]};this.batches.set(key,batch);}
      this.dummy.position.set(x,y,z);this.dummy.scale.set(sx,sy,sz);this.dummy.rotation.set(rx,ry,rz);this.dummy.updateMatrix();batch.matrices.push(this.dummy.matrix.clone());
    }
    finish(){for(const {geometry,material,matrices} of this.batches.values()){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mesh.receiveShadow=true;mesh.userData.ownedMaterial=!!material.userData.environmentOwned;this.owner.environment.add(mesh);}}
  }
  root.buildTrackArchitecture=function(owner,track,profile){
    const s=owner.scenery,b=new ArchitectureBatch(owner),rng=D.rng(profile.seed),box=owner.unitBox;
    const stone=s.rock.clone();stone.vertexColors=false;stone.userData.environmentOwned=true;
    const metal=s.metal.clone();metal.color.set(profile.border==='brass'?'#a48b52':'#69747e');metal.userData.environmentOwned=true;
    const glow=new THREE.MeshStandardMaterial({color:profile.accent,emissive:profile.accent,emissiveIntensity:2.8,roughness:.4});glow.userData.environmentOwned=true;
    const dark=new THREE.MeshStandardMaterial({color:'#101822',roughness:.58,metalness:.3,normalMap:s.rock.normalMap,normalScale:new THREE.Vector2(.2,.2)});dark.userData.environmentOwned=true;
    const cylinder=new THREE.CylinderGeometry(1,1,1,32,6),cone=new THREE.ConeGeometry(1,1,40,10),sphere=s.rockGeometry(),arch=new THREE.TorusGeometry(1,.09,12,48,Math.PI),ring=new THREE.TorusGeometry(1,.045,12,64);
    const bounds=track.bounds,cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2,radius=Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ)*.64+55;
    const place=(i,n,extra=0)=>{const a=i/n*Math.PI*2;return {x:cx+Math.sin(a)*(radius+extra),z:cz+Math.cos(a)*(radius+extra),a};};
    function castle(x,y,z,scale=1,cathedral=false){
      const add=(geo,mat,px,py,pz,sx,sy,sz,rx=0,ry=0,rz=0)=>b.add(geo,mat,x+px*scale,y+py*scale,z+pz*scale,sx*scale,sy*scale,sz*scale,rx,ry,rz);
      add(sphere,stone,0,-19,0,28,26,25);add(box,stone,0,12,0,34,24,22);
      for(const side of [-1,1])for(const end of [-1,1]){
        const tx=side*19,tz=end*13,h=cathedral?66:43;
        add(cylinder,stone,tx,h*.5,tz,4.2,h,4.2);add(cone,metal,tx,h+10,tz,5.5,24,5.5);
        for(let level=0;level<5;level++){add(box,glow,tx,12+level*6,tz-4.22,1.1,3.2,.08);add(box,stone,tx,9+level*7,tz,4.7,.7,4.7);}
        for(let i=0;i<8;i++){const a=i/8*Math.PI*2;add(box,stone,tx+Math.sin(a)*4.4,h-1,tz+Math.cos(a)*4.4,1.2,3,1.2);}
      }
      add(arch,stone,0,9,-11.6,8,13,2);add(box,dark,0,7,-11.5,12,14,.2);
      add(ring,metal,0,23,-11.7,5,5,1);add(new THREE.CircleGeometry(4.6,48),glow,0,23,-11.75,1,1,1);
      for(let i=0;i<8;i++){const a=i*Math.PI/8;add(box,metal,0,23,-11.9,.24,10,.3,0,0,a);}
      for(const side of [-1,1])for(let i=0;i<4;i++){add(arch,stone,side*21,12,-7+i*5,7,17,1,0,Math.PI/2);add(box,stone,side*28,9,-7+i*5,2,18,2);}
      if(cathedral){add(box,stone,0,31,0,12,22,28);add(cone,metal,0,54,0,12,25,17,0,Math.PI/4);}
    }
    switch(profile.architecture){
      case 'castles':case 'cathedral':
        for(let i=0;i<7;i++){const p=place(i,7);castle(p.x,12+(i%3)*18,p.z,.8+(i%3)*.15,profile.architecture==='cathedral');}
        if(profile.architecture==='cathedral'){const p=place(1,7,-25);b.add(ring,glow,p.x,120,p.z,65,65,4,.2,.4);}
        break;
      case 'fortress':
        for(let i=0;i<5;i++){const p=place(i,5);castle(p.x,-5,p.z,.8);}
        for(let i=0;i<34;i++){const p=place(i,34,-10);b.add(box,stone,p.x,9,p.z,34,18,4,0,p.a);for(let j=-2;j<=2;j++)b.add(box,stone,p.x+Math.cos(p.a)*j*5,19,p.z-Math.sin(p.a)*j*5,2.5,3,4,0,p.a);}
        break;
      case 'ruins':
        for(let i=0;i<42;i++){const p=place(i,42,-15),h=12+rng()*27;b.add(cylinder,stone,p.x,h/2-4,p.z,2.4,h,2.4);b.add(cylinder,stone,p.x,h-4,p.z,3.5,1,3.5);if(i%3===0)b.add(arch,stone,p.x,17,p.z,12,19,2,0,p.a);}
        for(let i=0;i<9;i++){const p=place(i,9,35);b.add(new THREE.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2),stone,p.x,15,p.z,24,12,24);}
        break;
      case 'city':{
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const c=canvas.getContext('2d');c.fillStyle='#080f1b';c.fillRect(0,0,256,512);
        for(let y=0;y<512;y+=16)for(let x=0;x<256;x+=12){c.fillStyle=rng()>.4?(rng()>.2?profile.accent:'#ed76b8'):'#142235';c.fillRect(x+3,y+3,5,9);}
        const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;owner.artTextures.push(texture);
        const windows=new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:'#ffffff',emissiveIntensity:1.3,color:'#a7bdce',metalness:.45,roughness:.28});windows.userData.environmentOwned=true;
        for(let i=0;i<110;i++){const p=place(i,110,(i%3)*32),h=25+rng()*145,width=10+rng()*16;
          b.add(box,windows,p.x,h*.5-20,p.z,width,h,width*.8,0,p.a*.15);b.add(box,metal,p.x,h-19,p.z,width+1,1.3,width*.8+1);
          if(i%3===0){b.add(cylinder,metal,p.x,h-9,p.z,.2,20,.2);b.add(box,glow,p.x+width*.5,h*.4,p.z,width*.05,h*.7,.25);}
          if(i%8===0)b.add(ring,glow,p.x,h-10,p.z,14,14,1,0,p.a);
        }
        break;}
      case 'alpine':
        // Jagged high-detail glacial summits and an elevated ski gondola station.
        for(let i=0;i<18;i++){const p=place(i,18,40);b.add(sphere,stone,p.x,50,p.z,30,65+rng()*90,24);}
        for(let i=0;i<3;i++){const p=place(i,3,-15);b.add(box,stone,p.x,8,p.z,24,16,14);b.add(cone,metal,p.x,22,p.z,20,14,13,0,Math.PI/4);b.add(box,glow,p.x,10,p.z-7.1,15,3,.1);}
        break;
      case 'forest':{
        const foliage=s.needles.clone();foliage.userData.environmentOwned=true;
        for(let i=0;i<170;i++){const p=place(i,170,-30+(i%4)*18),h=16+rng()*23;
          b.add(cylinder,s.bark,p.x,h/2-15,p.z,.8,h,1);for(let j=0;j<3;j++)b.add(sphere,foliage,p.x+Math.sin(j*2)*4,h-16+j*3,p.z+Math.cos(j*2)*4,6,7,6);
          if(i%5===0)for(const side of [-1,1])b.add(cylinder,s.bark,p.x+side*3,-9,p.z,1,12,1,0,0,side*.55);
        }break;}
      case 'observatory':{
        const dome=new THREE.SphereGeometry(1,64,32,0,Math.PI*2,0,Math.PI/2),water=new THREE.MeshPhysicalMaterial({color:'#315a64',metalness:.25,roughness:.18,clearcoat:.8,normalMap:s.road.normalMap,normalScale:new THREE.Vector2(.15,.15),envMapIntensity:1});water.userData.environmentOwned=true;
        b.add(new THREE.PlaneGeometry(1800,1800,1,1),water,cx,-25,cz,1,1,1,-Math.PI/2);
        for(let i=0;i<8;i++){const p=place(i,8,-20);b.add(cylinder,stone,p.x,0,p.z,22,36,22);b.add(dome,metal,p.x,18,p.z,23,20,23);b.add(box,dark,p.x,29,p.z-18,3,18,8);b.add(cylinder,metal,p.x,41,p.z-8,2,27,2,.6);for(let j=0;j<3;j++)b.add(ring,glow,p.x,58,p.z,14+j*5,14+j*5,1,.5+j*.5,j*.6);}
        break;}
    }
    b.finish();owner.environment.userData.architecture=profile.architecture;
  };
})(window);
