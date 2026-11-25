let disposeEquipmentAvatar;
function mountEquipmentAvatar(host,model){
  disposeEquipmentAvatar?.();
  const female=model.gender==='女生';
  const fail=()=>{host.innerHTML=`<img class="equipment-original" src="./equipment-assets/${female?'alex':'steve'}.png" alt="人物原图"><p class="avatar-render-note">此浏览器未启用3D，已显示原人物图。</p>`;};
  if(!globalThis.THREE){fail();return;}
  const T=THREE;let renderer;
  try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{fail();return;}
  const textures=[],materials=[],geometries=[];
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  host.replaceChildren(renderer.domElement);renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','可拖动旋转的3D人物装备预览');renderer.domElement.tabIndex=0;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-17,17,38,-4,.1,300);camera.position.set(48,34,70);camera.lookAt(0,15,0);
  scene.add(new T.HemisphereLight(0xe7f5ff,0x6d8d58,2));const light=new T.DirectionalLight(0xfff3d9,3);light.position.set(-25,55,45);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-24;light.shadow.camera.right=24;light.shadow.camera.top=40;light.shadow.camera.bottom=-15;light.shadow.normalBias=.04;light.shadow.bias=-.0001;scene.add(light);scene.add(light.target);light.target.position.set(0,13,0);
  const fill=new T.DirectionalLight(0xd0e8ff,1);fill.position.set(30,20,-40);scene.add(fill);
  const character=new T.Group();scene.add(character);
  const palette={skin:female?'#c69b77':'#a8795e',hair:female?'#ad5c22':'#352619',shirt:female?'#5d893d':'#078c95',pants:female?'#714b2f':'#3d3579'};
  const tint=(hex,n)=>'#'+hex.slice(1).match(/../g).map(x=>Math.max(0,Math.min(255,parseInt(x,16)+n)).toString(16).padStart(2,'0')).join('');
  let seed=121;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function texture(color,w,h,kind){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){c.fillStyle=tint(color,Math.floor(random()*13)-6);c.fillRect(x,y,1,1);}
    if(kind==='face'){
      c.fillStyle=palette.hair;c.fillRect(0,0,w,2);c.fillRect(0,2,1,1);c.fillRect(7,2,1,1);
      c.fillStyle='#ede8dc';c.fillRect(1,4,2,1);c.fillRect(5,4,2,1);c.fillStyle=female?'#427849':'#4b497c';c.fillRect(2,4,1,1);c.fillRect(5,4,1,1);
      c.fillStyle=tint(palette.skin,-25);c.fillRect(3,5,2,1);
      if(!female){c.fillStyle='#70442d';c.fillRect(2,6,4,2);c.fillStyle='#a76c54';c.fillRect(3,6,2,1);}else{c.fillStyle='#995d43';c.fillRect(3,6,2,1);}
    }
    if(kind==='hair-side'){c.fillStyle=palette.hair;c.fillRect(0,0,w,female?h:3);if(female){c.fillStyle=tint(palette.hair,12);c.fillRect(2,2,1,h-3);}}
    if(kind==='shirt-front'){c.fillStyle=palette.skin;c.fillRect(3,0,2,1);c.fillRect(3,1,2,1);c.fillStyle=tint(color,-15);c.fillRect(3,3,1,6);c.fillRect(0,h-1,2,1);}
    if(kind==='chain'){c.clearRect(0,0,w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if((x+y)%4<2){c.fillStyle=(x+y)%4===0?'#b6bec0':'#687277';c.fillRect(x,y,1,1);}}
    if(kind==='leather'){c.fillStyle=tint(color,-15);c.fillRect(0,0,w,1);c.fillRect(0,h-1,w,1);}
    const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.magFilter=T.NearestFilter;t.minFilter=T.NearestFilter;t.generateMipmaps=false;textures.push(t);return t;
  }
  function mat(color,w,h,kind,metal=0){const m=new T.MeshStandardMaterial({map:texture(color,Math.max(2,Math.round(w)),Math.max(2,Math.round(h)),kind),roughness:metal?.55:1,metalness:metal,alphaTest:kind==='chain'?.4:0});materials.push(m);return m;}
  function cube(group,x,y,z,w,h,d,color,frontKind,sideKind,metal=0){
    const g=new T.BoxGeometry(w,h,d);geometries.push(g);
    // BoxGeometry materials: right, left, top, bottom, front, back.
    const faces=[mat(color,d,h,sideKind,metal),mat(color,d,h,sideKind,metal),mat(color,w,d,sideKind==='hair-side'?'hair':undefined,metal),mat(color,w,d,undefined,metal),mat(color,w,h,frontKind,metal),mat(color,w,h,sideKind,metal)];
    const mesh=new T.Mesh(g,faces);mesh.position.set(x,y+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  cube(character,0,24,0,8,8,8,palette.skin,'face','hair-side');
  // A separate hair cap produces the correct dark/orange top rather than a skin-colored scalp.
  cube(character,0,31.05,0,8.02,.98,8.02,palette.hair,undefined,undefined);
  cube(character,0,12,0,8,12,4,palette.shirt,'shirt-front');
  const arm=female?3:4;
  for(const sign of [-1,1]){const x=sign*(4+arm/2);cube(character,x,12,0,arm,12,4,palette.skin);cube(character,x,20,0,arm+.02,4,4.02,palette.shirt);}
  cube(character,-2,0,0,4,12,4,palette.pants);cube(character,2,0,0,4,12,4,palette.pants);
  cube(character,-2,0,.05,4.02,2,4.15,'#414443');cube(character,2,0,.05,4.02,2,4.15,'#414443');
  if(female){cube(character,0,24,-3.7,8.03,6,1,palette.hair);cube(character,2.9,22,2.15,1.5,4,.35,palette.hair);}
  const armorColors=['#8c562e','#929b9d','#b6c3c6','#dfb134','#2ebcbf','#443c4e'];
  function armor(x,y,z,w,h,d,level){return cube(character,x,y,z,w,h,d,armorColors[level],level===1?'chain':level===0?'leather':undefined,level===1?'chain':undefined,level===0?0:level===5?.25:.4);}
  const [helmet,chest,legs,boots]=model.equipped;
  if(helmet>=0){
    armor(0,32.05,0,8.8,.65,8.8,helmet);armor(-4.18,25.3,0,.5,6.75,8.75,helmet);armor(4.18,25.3,0,.5,6.75,8.75,helmet);armor(0,25.3,-4.18,8.8,6.75,.5,helmet);
    armor(0,30.7,4.18,8.8,1.35,.5,helmet);
  }
  if(chest>=0){armor(0,11.7,0,8.6,12,4.6,chest);for(const sign of [-1,1])armor(sign*(4+arm/2),19.7,0,arm+.6,4.6,4.65,chest);}
  if(legs>=0){armor(0,10.6,0,8.6,2.3,4.6,legs);for(const x of [-2,2])armor(x,boots>=0?3.4:.2,0,4.25,boots>=0?7.2:10.4,4.35,legs);}
  if(boots>=0)for(const x of [-2,2])armor(x,-.05,.25,4.5,3.6,4.9,boots);
  // Actual geometry for the plinth; a single perspective for feet, platform and shadows.
  cube(scene,0,-2.5,0,23,1,18,'#8b8e86');cube(scene,0,-1.5,0,21,1.5,16,'#a3a59a');
  const shadowGeo=new T.PlaneGeometry(70,60);geometries.push(shadowGeo);const shadowMat=new T.ShadowMaterial({opacity:.18});materials.push(shadowMat);const shadow=new T.Mesh(shadowGeo,shadowMat);shadow.rotation.x=-Math.PI/2;shadow.position.y=-2.53;shadow.receiveShadow=true;scene.add(shadow);
  let dead=false,drag=null;const initial=.05;
  character.rotation.y=initial;
  const render=()=>{if(!dead)renderer.render(scene,camera);};
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h,viewH=43;camera.left=-viewH*aspect/2;camera.right=viewH*aspect/2;camera.top=viewH/2;camera.bottom=-viewH/2;camera.updateProjectionMatrix();render();}
  const observer=new ResizeObserver(resize);observer.observe(host);
  renderer.domElement.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,rotation:character.rotation.y};renderer.domElement.setPointerCapture(e.pointerId);};
  renderer.domElement.onpointermove=e=>{if(drag&&drag.id===e.pointerId){character.rotation.y=drag.rotation+(e.clientX-drag.x)*.009;render();}};
  renderer.domElement.onpointerup=renderer.domElement.onpointercancel=()=>{drag=null;};
  renderer.domElement.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();character.rotation.y+=e.key==='ArrowLeft'?-.18:.18;render();}if(e.key==='Home'){character.rotation.y=initial;render();}};
  host.addEventListener('reset-avatar-view',()=>{character.rotation.y=initial;render();});
  const contextLoss=e=>{e.preventDefault();fail();};renderer.domElement.addEventListener('webglcontextlost',contextLoss);
  disposeEquipmentAvatar=()=>{if(dead)return;dead=true;observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLoss);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();disposeEquipmentAvatar=null;};
  resize();
}
