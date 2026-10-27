(function(root){
  'use strict';
  const THREE=root.THREE;
  class KartPostProcessing {
    constructor(renderer){
      this.renderer=renderer;this.quality='high';this.resetHistory=true;
      this.enabled=renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float');
      if(!this.enabled)return;
      this.sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
      this.sceneTarget.samples=Math.min(4,renderer.capabilities.maxSamples);
      this.sceneTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
      this.bloomA=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});this.bloomB=this.bloomA.clone();
      this.aoTarget=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
      this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
      const material=(uniforms,fragmentShader)=>new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false});
      this.extract=material({source:{value:this.sceneTarget.texture}},`varying vec2 vUv;uniform sampler2D source;void main(){vec3 c=texture2D(source,vUv).rgb;float p=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(1.3,3.,p),1.);}`);
      this.blur=material({source:{value:null},stepUv:{value:new THREE.Vector2()}},`varying vec2 vUv;uniform sampler2D source;uniform vec2 stepUv;void main(){vec3 c=texture2D(source,vUv).rgb*.227027;c+=(texture2D(source,vUv+stepUv*1.384615).rgb+texture2D(source,vUv-stepUv*1.384615).rgb)*.316216;c+=(texture2D(source,vUv+stepUv*3.230769).rgb+texture2D(source,vUv-stepUv*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`);
      const depthCode=`uniform sampler2D depthMap;uniform mat4 inverseProjection;vec3 viewPosition(vec2 uv){float d=texture2D(depthMap,uv).x;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}`;
      this.ao=material({depthMap:{value:this.sceneTarget.depthTexture},inverseProjection:{value:new THREE.Matrix4()},projection:{value:new THREE.Matrix4()}},`
        varying vec2 vUv;uniform mat4 projection;${depthCode}
        void main(){vec3 p=viewPosition(vUv);if(-p.z>280.){gl_FragColor=vec4(1.);return;}
          vec3 normal=normalize(cross(dFdx(p),dFdy(p)));if(normal.z<0.)normal=-normal;
          vec3 tangent=normalize(cross(abs(normal.y)<.99?vec3(0.,1.,0.):vec3(1.,0.,0.),normal));vec3 bitangent=cross(normal,tangent);float occlusion=0.;
          for(int i=0;i<12;i++){float f=(float(i)+.5)/12.,angle=float(i)*2.399963;vec3 kernel=vec3(cos(angle)*sqrt(f),sin(angle)*sqrt(f),sqrt(1.-f));vec3 sampleP=p+(tangent*kernel.x+bitangent*kernel.y+normal*kernel.z)*mix(.14,1.1,f*f);
            vec4 clip=projection*vec4(sampleP,1.);vec2 uv=clip.xy/clip.w*.5+.5;
            if(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.){float z=viewPosition(uv).z;occlusion+=step(sampleP.z+.035,z)*(1.-smoothstep(.2,1.5,abs(p.z-z)));}
          }gl_FragColor=vec4(vec3(1.-occlusion/12.*.65),1.);
        }`);this.ao.extensions.derivatives=true;
      this.composite=material({source:{value:this.sceneTarget.texture},depthMap:{value:this.sceneTarget.depthTexture},bloom:{value:this.bloomA.texture},aoMap:{value:this.aoTarget.texture},resolution:{value:new THREE.Vector2()},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},previousVP:{value:new THREE.Matrix4()},strength:{value:.2},motion:{value:0},cinematic:{value:1},cameraPositionWorld:{value:new THREE.Vector3()},profileFog:{value:new THREE.Vector3(.003,5,.02)},fogTint:{value:new THREE.Color('#b99069')},grade:{value:new THREE.Vector3(1,1,1)},contrast:{value:1},shadowLift:{value:0},saturation:{value:1},sunDirection:{value:new THREE.Vector3()},sunTint:{value:new THREE.Color()},sunScreen:{value:new THREE.Vector3()},rayStrength:{value:0},reflectionAmount:{value:0},projection:{value:new THREE.Matrix4()},cloudAmount:{value:0},weatherTime:{value:0}},`
        varying vec2 vUv;uniform sampler2D source,bloom,aoMap;uniform vec2 resolution;uniform mat4 cameraWorld,previousVP;uniform vec3 cameraPositionWorld;uniform float strength,motion,cinematic;${depthCode}
        uniform vec3 profileFog,fogTint,grade,sunDirection,sunTint,sunScreen;uniform float shadowLift,contrast,saturation,rayStrength,reflectionAmount,cloudAmount,weatherTime;uniform mat4 projection;
        float hash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
        float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}

        void main(){vec3 vp=viewPosition(vUv);float depth=-vp.z;vec3 world=(cameraWorld*vec4(vp,1.)).xyz;vec3 c=texture2D(source,vUv).rgb;
          // Depth-reprojected camera motion; reject foreground samples to keep the car readable.
          vec4 old=previousVP*vec4(world,1.);vec2 velocity=(vUv-(old.xy/max(old.w,.001)*.5+.5))*motion;velocity=clamp(velocity,-vec2(9.)/resolution,vec2(9.)/resolution);
          float weight=1.;for(int i=1;i<=4;i++){vec2 uv=clamp(vUv-velocity*float(i)/4.,vec2(0.),vec2(1.));float d=-viewPosition(uv).z;float w=1.-smoothstep(.5,3.,abs(d-depth));c+=texture2D(source,uv).rgb*w;weight+=w;}c/=weight;
          // Subtle far-field depth of field: never blur the player's vehicle or nearby track.
          float coc=smoothstep(70.,230.,depth)*cinematic;vec3 farColor=c;float farWeight=1.;
          for(int i=0;i<6;i++){float a=float(i)*1.0472;vec2 uv=clamp(vUv+vec2(cos(a),sin(a))*coc*2.2/resolution,vec2(0.),vec2(1.));float w=smoothstep(40.,75.,-viewPosition(uv).z);farColor+=texture2D(source,uv).rgb*w;farWeight+=w;}c=mix(c,farColor/farWeight,coc*.65);
          float ao=texture2D(aoMap,vUv).r,aoWeight=1.;for(int i=0;i<4;i++){float a=float(i)*1.5708;vec2 uv=vUv+vec2(cos(a),sin(a))*2./resolution;float w=1.-smoothstep(.1,1.,abs(viewPosition(uv).z-vp.z));ao+=texture2D(aoMap,uv).r*w;aoWeight+=w;}c*=ao/aoWeight;
          // Wet-surface SSR: depth reconstruct + view-space ray march. Environment reflections remain the miss fallback.
          vec3 normal=normalize(cross(dFdx(vp),dFdy(vp)));if(normal.z<0.)normal=-normal;
          vec3 worldNormal=mat3(cameraWorld)*normal;
          if(reflectionAmount>0.&&depth<130.&&worldNormal.y>.65){
            vec3 reflected=reflect(normalize(vp),normal),origin=vp+normal*.15,previousPosition=origin;float previousIntersection=-1.;
            for(int i=0;i<16;i++){
              float distanceAlong=.6+float(i)*1.4+float(i*i)*.65;vec3 samplePosition=origin+reflected*distanceAlong;
              vec4 clip=projection*vec4(samplePosition,1.);vec2 uv=clip.xy/max(clip.w,.001)*.5+.5;
              if(clip.w<=0.||uv.x<.01||uv.x>.99||uv.y<.01||uv.y>.99)break;
              float z=viewPosition(uv).z,intersection=z-samplePosition.z;
              if(intersection>0.&&previousIntersection<=0.&&length(uv-vUv)>.008){
                vec3 lo=previousPosition,hi=samplePosition;
                for(int refine=0;refine<4;refine++){vec3 mid=(lo+hi)*.5;vec4 q=projection*vec4(mid,1.);vec2 probe=q.xy/q.w*.5+.5;float hit=viewPosition(probe).z-mid.z;if(hit>0.)hi=mid;else lo=mid;}
                vec4 hitClip=projection*vec4(hi,1.);uv=hitClip.xy/hitClip.w*.5+.5;
                float edge=smoothstep(0.,.1,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
                float fresnel=.12+.65*pow(1.-max(dot(-normalize(vp),normal),0.),3.);
                c=mix(c,texture2D(source,uv).rgb,min(.55,reflectionAmount*fresnel)*edge);break;
              }
              previousPosition=samplePosition;previousIntersection=intersection;
            }
          }
          vec3 ray=world-cameraPositionWorld;float distanceToSurface=min(length(ray),700.);vec3 direction=normalize(ray);float transmittance=1.;vec3 fog=vec3(0.);
          float sunPhase=pow(max(dot(direction,sunDirection),0.),8.);
          for(int i=0;i<8;i++){float t=(float(i)+.5)/8.;vec3 p=cameraPositionWorld+direction*distanceToSurface*t;
            float layered=.7+.3*sin(p.x*.018+p.z*.012)*sin(p.y*.045);float density=profileFog.x*exp(-max(p.y-profileFog.y,0.)*profileFog.z)*layered;
            float extinction=1.-exp(-density*distanceToSurface/8.);fog+=transmittance*extinction*(fogTint+sunPhase*sunTint*.3);transmittance*=1.-extinction;
          }
          c=c*transmittance+fog;
          // Ray-march the cloud layer only where the visible ray reaches its altitude before terrain.
          if(cloudAmount>0.&&direction.y>.03){
            float start=max(0.,(115.-cameraPositionWorld.y)/direction.y),end=min(length(ray),(175.-cameraPositionWorld.y)/direction.y);
            if(end>start){float cloudTrans=1.;vec3 cloudLight=vec3(0.);
              for(int i=0;i<16;i++){float jitter=.35+.3*hash(vec3(floor(gl_FragCoord.xy),0.));float t=(float(i)+jitter)/16.;vec3 p=cameraPositionWorld+direction*mix(start,end,t);vec3 q=p*.01+vec3(weatherTime*.007,0.,weatherTime*.003);
                float n=noise3(q)*.75+noise3(q*2.03)*.25;
                float edge=smoothstep(115.,128.,p.y)*(1.-smoothstep(160.,175.,p.y));float density=max(0.,n-(.72-cloudAmount*.38))*edge;
                float extinction=1.-exp(-density*(end-start)/16.*.025);float illumination=.18+.45*smoothstep(115.,175.,p.y)+sunPhase*.7;cloudLight+=cloudTrans*extinction*(fogTint*.4+sunTint*illumination);cloudTrans*=1.-extinction;
              }c=c*cloudTrans+cloudLight;
            }
          }
          // Depth-occluded screen-space sun shafts, with no strobing or temporal noise.
          if(rayStrength>0.&&sunScreen.z>0.){vec2 delta=(sunScreen.xy-vUv)/12.;float shafts=0.,decay=1.;vec2 uv=vUv;
            for(int i=0;i<12;i++){uv+=delta;float visible=step(.9998,texture2D(depthMap,clamp(uv,vec2(0.),vec2(1.))).x);shafts+=visible*decay;decay*=.93;}
            c+=sunTint*shafts/12.*rayStrength*(.25+sunPhase);
          }
          c+=texture2D(bloom,vUv).rgb*strength;
          float luma=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(luma),c,saturation)*grade;c=pow(max(c,vec3(0.)),vec3(contrast));
          // Lift the darkest tones so road texture and hazards stay readable in night shadows.
          c+=shadowLift*sqrt(c)*.16*(1.-smoothstep(.02,.3,c));
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`);
      this.composite.extensions.derivatives=true;
      this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.extract);this.scene.add(this.quad);this.previousVP=new THREE.Matrix4();this.previousPosition=new THREE.Vector3();
    }
    setProfile(profile){
      this.profile=profile;this.resetHistory=true;if(!this.enabled)return;const a=profile.atmosphere,u=this.composite.uniforms;
      u.profileFog.value.set(a.density,a.height,a.falloff);u.fogTint.value.set(a.color);u.grade.value.set(...a.grade);u.contrast.value=a.contrast;u.shadowLift.value=profile.light.intensity<2?2.2:.4;u.saturation.value=a.saturation;u.sunDirection.value.set(...profile.sky.sun).normalize();u.sunTint.value.set(profile.light.color);
    }
    resize(w,h){if(!this.enabled)return;this.sceneTarget.setSize(w,h);this.bloomA.setSize(Math.max(1,Math.ceil(w/4)),Math.max(1,Math.ceil(h/4)));this.bloomB.setSize(this.bloomA.width,this.bloomA.height);this.aoTarget.setSize(Math.max(1,Math.ceil(w/2)),Math.max(1,Math.ceil(h/2)));this.composite.uniforms.resolution.value.set(w,h);this.resetHistory=true;}
    pass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);}
    render(scene,camera,reduced,speed=0,dt=1/60){
      const r=this.renderer;if(!this.enabled||this.quality==='performance'){r.setRenderTarget(null);r.render(scene,camera);this.resetHistory=true;return;}
      const savedFog=scene.fog;scene.fog=null;r.setRenderTarget(this.sceneTarget);r.render(scene,camera);scene.fog=savedFog;
      this.ao.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);this.ao.uniforms.projection.value.copy(camera.projectionMatrix);this.pass(this.ao,this.aoTarget);
      this.pass(this.extract,this.bloomA);
      this.blur.uniforms.source.value=this.bloomA.texture;this.blur.uniforms.stepUv.value.set(1.5/this.bloomA.width,0);this.pass(this.blur,this.bloomB);
      this.blur.uniforms.source.value=this.bloomB.texture;this.blur.uniforms.stepUv.value.set(0,1.5/this.bloomA.height);this.pass(this.blur,this.bloomA);
      const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),u=this.composite.uniforms;
      if(this.resetHistory||this.previousPosition.distanceTo(camera.position)>20)this.previousVP.copy(vp);
      u.inverseProjection.value.copy(camera.projectionMatrixInverse);u.cameraWorld.value.copy(camera.matrixWorld);u.previousVP.value.copy(this.previousVP);u.cameraPositionWorld.value.copy(camera.position);
      u.motion.value=reduced||this.resetHistory||this.quality!=='high'?0:THREE.MathUtils.clamp((speed-24)/30,0,.65)*Math.min(1,(1/60)/Math.max(.001,dt));u.cinematic.value=reduced||this.quality!=='high'?0:1;u.strength.value=(this.profile?.atmosphere.bloom??.2)*(reduced?.6:1);
      const atmosphere=this.profile?.atmosphere;u.projection.value.copy(camera.projectionMatrix);u.weatherTime.value+=dt*(reduced?.3:1);
      u.reflectionAmount.value=(atmosphere?.wet||0)*(this.quality==='high'?1:.55);u.cloudAmount.value=this.quality==='high'?(this.profile?.sky.clouds||0):0;u.rayStrength.value=(atmosphere?.rays||0)*(reduced?.3:1);
      const sun=u.sunDirection.value.clone(),sunView=sun.clone().transformDirection(camera.matrixWorldInverse),projected=sun.multiplyScalar(1000).add(camera.position).project(camera);u.sunScreen.value.set(projected.x*.5+.5,projected.y*.5+.5,sunView.z<0?1:0);
      this.pass(this.composite,null);this.previousVP.copy(vp);this.previousPosition.copy(camera.position);this.resetHistory=false;
    }
    dispose(){if(!this.enabled)return;for(const t of [this.sceneTarget,this.bloomA,this.bloomB,this.aoTarget])t.dispose();for(const m of [this.extract,this.blur,this.ao,this.composite])m.dispose();this.quad.geometry.dispose();}
  }
  root.KartPostProcessing=KartPostProcessing;
})(window);
