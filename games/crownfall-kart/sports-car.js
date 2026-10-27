(function(root){
  'use strict';
  const THREE=root.THREE;
  // Original parametric coupe: smooth longitudinal loft, wheel arches, glazed cabin and alloy wheels.
  function loft(profile,segments=96,sides=48){
    const points=profile.map(p=>new THREE.Vector3(p[0],p[1],p[2])),curve=new THREE.CatmullRomCurve3(points),positions=[],uvs=[],indices=[];
    for(let i=0;i<=segments;i++){const t=i/segments,p=curve.getPoint(t);
      for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,x=Math.sin(a)*p.y,y=p.z+Math.cos(a)*(.22+.035*Math.sin(t*Math.PI));positions.push(x,y,p.x);uvs.push(j/sides,t);
        if(i<segments&&j<sides){const n=i*(sides+1)+j;indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}}
    }
    // Cap both ends. Without caps the narrow tail reads as a dark vertical slit into the hollow body.
    // Cap rings duplicate their vertices so the body's smooth normals are unaffected.
    for(const [i,rear] of [[0,true],[segments,false]]){
      const start=positions.length/3,ring=i*(sides+1);let cx=0,cy=0,cz=0;
      for(let j=0;j<=sides;j++){const n=(ring+j)*3;positions.push(positions[n],positions[n+1],positions[n+2]);uvs.push(0,0);if(j<sides){cx+=positions[n];cy+=positions[n+1];cz+=positions[n+2];}}
      const center=positions.length/3;positions.push(cx/sides,cy/sides,cz/sides);uvs.push(0,0);
      for(let j=0;j<sides;j++)if(rear)indices.push(center,start+j,start+j+1);else indices.push(center,start+j+1,start+j);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function batchStatic(group,sharedBox){
    const buckets=new Map();for(const mesh of group.children){if(!mesh.isMesh||mesh.userData.cabin)continue;const list=buckets.get(mesh.material)||[];list.push(mesh);buckets.set(mesh.material,list);}
    for(const [material,meshes] of buckets){
      if(meshes.length<2)continue;const positions=[],normals=[],uvs=[],indices=[],disposed=new Set();let offset=0;
      for(const mesh of meshes){mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrix),v=new THREE.Vector3();
        for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);positions.push(v.x,v.y,v.z);v.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);normals.push(v.x,v.y,v.z);uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}
        if(g.index)for(let i=0;i<g.index.count;i++)indices.push(offset+g.index.getX(i));else for(let i=0;i<p.count;i++)indices.push(offset+i);offset+=p.count;
        group.remove(mesh);if(g!==sharedBox&&!disposed.has(g)){g.dispose();disposed.add(g);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);group.add(new THREE.Mesh(geometry,material));
    }
  }
  root.buildSportsCar=function(o,visual,color){
    const low=o.quality==='performance';
    const paintKey='paint:'+color;
    if(!o.materials.has(paintKey))o.materials.set(paintKey,new THREE.MeshPhysicalMaterial({color,metalness:.18,roughness:.3,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:.65,roughnessMap:o.scenery.road.roughnessMap}));
    const paint=o.materials.get(paintKey),carbon=o.mat('#222320'),metal=o.scenery.metal,glass=o.scenery.glass;
    const add=(g,m,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);visual.add(mesh);return mesh;};
    const body=add(loft([[-1.7,.05,.03],[-1.61,.7,.06],[-1.2,.91,.16],[-.65,.82,.14],[.35,.79,.15],[1.04,.88,.12],[1.57,.7,.02],[1.68,.03,.01]],low?32:96,low?24:48),paint);
    body.name='96-section sculpted sports coupe';
    // Fastback glazing: flattened roof, sloped windscreen and tapering rear glass.
    const cabinPositions=[],cabinUV=[],cabinIndices=[];
    const sections=low?20:48,sides=low?20:40;
    for(let i=0;i<=sections;i++){
      const t=i/sections,z=-1.03+t*1.88;
      const h=z<-.5?.38+(z+1.03)/.53*.43:z>.24?.81-(z-.24)/.61*.43:.81;
      const width=.61-(h-.38)*.16;
      for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,sn=Math.sin(a),cs=Math.cos(a);cabinPositions.push(Math.sign(sn)*Math.pow(Math.abs(sn),.38)*width,.35+(h-.35)*(.5+.5*Math.sign(cs)*Math.pow(Math.abs(cs),.35)),z);cabinUV.push(j/sides,t);if(i<sections&&j<sides){const n=i*(sides+1)+j;cabinIndices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}}
    }
    const cabin=new THREE.BufferGeometry();cabin.setAttribute('position',new THREE.Float32BufferAttribute(cabinPositions,3));cabin.setAttribute('uv',new THREE.Float32BufferAttribute(cabinUV,2));cabin.setIndex(cabinIndices);cabin.computeVertexNormals();
    // Glazing, roof and pillars stay separate meshes so the cockpit camera can hide them.
    add(cabin,glass).userData.cabin=true;o.coachwork(visual,color,0,.817,-.13,1.03,.045,.74).userData.cabin=true;
    for(const side of [-1,1]){
      // Sculpted fender lips, mirrors, sill, window frames and flush lamps.
      for(const z of [-1.03,1.01]){const arch=add(new THREE.TorusGeometry(.405,.048,10,40,Math.PI),paint,side*.83,-.13,z);arch.rotation.y=Math.PI/2;arch.rotation.z=Math.PI/2;}
      o.coachwork(visual,'#292a27',side*.78,-.05,0,.12,.12,2.7);
      const mirror=add(new THREE.SphereGeometry(.12,20,12),paint,side*.81,.52,.36);mirror.scale.set(1.2,.6,1.5);
      for(const z of [-.73,.48]){const pillar=add(new THREE.CylinderGeometry(.018,.025,.42,10),paint,side*.55,.57,z);pillar.rotation.z=side*.25;pillar.rotation.x=z>0?-.6:.6;pillar.userData.cabin=true;}
      o.box(visual,side*.68,.21,1.44,.33,.06,.11,'#fff1d0',true);
      o.box(visual,side*.55,.23,-1.57,.51,.045,.05,'#ff2515',true);
      const exhaust=add(new THREE.CylinderGeometry(.075,.075,.23,20),metal,side*.49,-.08,-1.65);exhaust.rotation.x=Math.PI/2;
      o.box(visual,side*.48,.03,1.57,.35,.12,.03,'#111310');
      o.box(visual,side*.5,.52,-1.35,.035,.2,.035,'#292a27');
    }
    o.coachwork(visual,color,0,.64,-1.35,1.65,.065,.25);
    o.box(visual,0,-.12,-1.53,1.3,.12,.22,'#171918');
    for(let i=0;i<7;i++)o.box(visual,(i-3)*.12,-.11,-1.65,.025,.15,.2,'#171918');
    for(const z of [-1.38,1.35])for(let i=0;i<6;i++)o.box(visual,(i-2.5)*.1,.35,z,.06,.01,.2,'#292a27');
    const wheels=[];
    for(const x of [-.84,.84])for(const z of [-1.03,1.01]){
      const steering=new THREE.Group(),spin=new THREE.Group();steering.position.set(x,-.17,z);steering.userData.front=z>0;steering.add(spin);visual.add(steering);wheels.push(steering);
      const tire=new THREE.Mesh(new THREE.TorusGeometry(.275,.105,low?10:20,low?32:64),o.scenery.rubber);tire.rotation.y=Math.PI/2;spin.add(tire);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.23,.025,low?6:12,low?24:48),metal);rim.rotation.y=Math.PI/2;rim.position.x=Math.sign(x)*.09;spin.add(rim);
      const disc=new THREE.Mesh(new THREE.CylinderGeometry(.205,.205,.025,48),metal);disc.rotation.z=Math.PI/2;spin.add(disc);
      for(let j=0;j<10;j++){const spoke=o.box(spin,Math.sign(x)*.11,0,0,.025,.025,.42,'#a1a5a3');spoke.rotation.x=j*Math.PI/5;spoke.material=metal;}
      const caliper=o.box(steering,Math.sign(x)*.05,.14,.1,.09,.14,.08,'#bf3b22');caliper.material=paint;
    }
    batchStatic(visual,o.unitBox);for(const wheel of wheels)batchStatic(wheel.children[0],o.unitBox);
    visual.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true;});return wheels;
  };
})(window);
