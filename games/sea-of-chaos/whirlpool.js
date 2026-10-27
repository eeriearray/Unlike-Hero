// A recessed water surface, not a decal. The ocean shader cuts a matching hole.
export function vortexSurface(radius=8.5,rings=18,segments=64){
 const positions=[],indices=[];
 for(let j=0;j<=rings;j++){const r=.16+(radius-.16)*j/rings,depth=-.34-4.7*Math.pow(1-r/radius,3);
  for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2;positions.push(Math.sin(a)*r,depth,Math.cos(a)*r);}
 }
 for(let j=0;j<rings;j++)for(let k=0;k<segments;k++){const a=j*(segments+1)+k,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
 return {positions,indices};
}
export function createWhirlpool(T,mobile=false){
 const root=new T.Group(),data=vortexSurface(8.5,mobile?12:18,mobile?40:64),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setIndex(data.indices);geometry.computeVertexNormals();
 const material=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{time:{value:0},spin:{value:1}},vertexShader:`
  uniform float time;uniform float spin;varying vec3 local;varying vec3 world;varying vec3 n;
  void main(){vec3 p=position;float r=length(p.xz)/8.5;float a=atan(p.x,p.z);
   p.y+=sin(a*5.+time*2.*spin+log(r+.1)*7.)*.10*r*(1.-r);
   vec3 wp=(modelMatrix*vec4(p,1.)).xyz;
   wp.y+=sin(wp.x*.17-wp.z*.09+time*.9)*.16+sin(wp.x*.08+wp.z*.21-time*.7)*.11;
   local=p;world=wp;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
  fragmentShader:`uniform float time;uniform float spin;varying vec3 local;varying vec3 world;varying vec3 n;
   void main(){float r=length(local.xz)/8.5;float a=atan(local.x,local.z);
    float phase=a*4.+log(r+.075)*11.+time*2.1*spin;
    float fold=pow(.5+.5*sin(phase+sin(r*27.-time)*.27),16.);
    float lace=.55+.45*sin(a*23.+r*53.+time*1.2);
    float foam=fold*smoothstep(.11,.45,r)*(.45+.4*lace);
    foam+=pow(.5+.5*sin(a*15.+r*71.-time*2.6*spin),12.)*smoothstep(.72,.85,r)*(1.-smoothstep(.96,1.,r))*.65;
    vec3 c=mix(vec3(.002,.012,.026),vec3(.018,.095,.13),pow(r,.7));
    c=mix(c,vec3(.43,.67,.67),min(.86,foam));
    vec3 viewDir=normalize(cameraPosition-world);float sheen=pow(max(dot(reflect(-normalize(vec3(-.6,1.,-.5)),normalize(n)),viewDir),0.),45.);
    c+=vec3(.27,.40,.39)*sheen*.35;
    c=mix(c,vec3(.12,.23,.29),smoothstep(185.,245.,length(cameraPosition-world)));
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
   }`});
 root.add(new T.Mesh(geometry,material));
 const bottom=new T.Mesh(new T.CircleGeometry(.3,16),new T.MeshBasicMaterial({color:'#020d18',side:T.DoubleSide}));bottom.rotation.x=-Math.PI/2;bottom.position.y=-4.88;root.add(bottom);
 const count=mobile?8:20,points=new Float32Array(count*3),alpha=new Float32Array(count),sprayGeometry=new T.BufferGeometry();sprayGeometry.setAttribute('position',new T.BufferAttribute(points,3));sprayGeometry.setAttribute('strength',new T.BufferAttribute(alpha,1));
 const spray=new T.Points(sprayGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:`attribute float strength;varying float opacity;void main(){opacity=strength;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(110./-mv.z,1.,4.);}`,fragmentShader:`varying float opacity;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.72,.9,.9,(1.-smoothstep(.1,.5,d))*opacity);}`}));spray.frustumCulled=false;root.add(spray);
 return {root,update(t,x,z,spin=1){root.position.set(x,0,z);root.rotation.y=t*.15*spin;material.uniforms.time.value=t;material.uniforms.spin.value=spin;
  for(let k=0;k<count;k++){const phase=(t*.55+k/count)%1,a=k*2.4+t*.8*spin,r=6.4+Math.sin(k*2.3)*1.5;points[k*3]=Math.sin(a)*r;points[k*3+1]=.12+Math.sin(phase*Math.PI)*(.6+k%3*.2);points[k*3+2]=Math.cos(a)*r;alpha[k]=(1-phase)*.6;}
  sprayGeometry.attributes.position.needsUpdate=true;sprayGeometry.attributes.strength.needsUpdate=true;
 }};
}
