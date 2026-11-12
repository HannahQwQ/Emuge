/* ============================================================
   EMUGE machine — interactive 3D cardboard installation
   Parts come from the team's GLB (named nodes). Valve, sun slider,
   three buttons, joystick and seed tray all work; the screen is a
   pixel-art mood garden that reacts to them.
   ============================================================ */
(function machine3d(){
  const host=document.getElementById('heroMachine'); if(!host||!window.THREE||!THREE.GLTFLoader) return;
  const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas=document.createElement('canvas'); canvas.className='m3d'; canvas.setAttribute('aria-label','可交互的 Emuge 公共装置三维模型：拖动转动，点击阀门、滑块、按钮、摇杆和投币口'); canvas.setAttribute('role','img');
  host.appendChild(canvas);
  const hint=document.createElement('div'); hint.className='m3d-hint'; hint.textContent='拖动转一转 · 试试阀门、滑块、按钮和摇杆'; host.appendChild(hint);

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
  renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.92;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(26,1,.05,50);
  scene.add(new THREE.HemisphereLight(0xfff4e2,0x4a4570,.9));
  const key=new THREE.DirectionalLight(0xfff1dc,1.7); key.position.set(2.5,4,4); scene.add(key);
  const rim=new THREE.DirectionalLight(0x9db4ff,1.1); rim.position.set(-3,2,-2); scene.add(rim);
  const fill=new THREE.DirectionalLight(0xffffff,.55); fill.position.set(-2,1,3); scene.add(fill);

  const root=new THREE.Group(); scene.add(root);      // user yaw/pitch
  const bob=new THREE.Group(); root.add(bob);         // hop / idle float
  let model=null, parts={}, ready=false;

  // ---------- helpers ----------
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  function worldPoints(objs){ const pts=[]; const v=new THREE.Vector3(); for(const o of objs){ o.updateWorldMatrix(true,false); const p=o.geometry.attributes.position; for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld); pts.push(v.clone()); } } return pts; }
  function pca(pts){ // principal axes, largest first
    const c=new THREE.Vector3(); pts.forEach(p=>c.add(p)); c.divideScalar(pts.length);
    const m=[0,0,0,0,0,0]; for(const p of pts){ const x=p.x-c.x,y=p.y-c.y,z=p.z-c.z; m[0]+=x*x;m[1]+=x*y;m[2]+=x*z;m[3]+=y*y;m[4]+=y*z;m[5]+=z*z; }
    const M=(v)=>V(m[0]*v.x+m[1]*v.y+m[2]*v.z, m[1]*v.x+m[3]*v.y+m[4]*v.z, m[2]*v.x+m[4]*v.y+m[5]*v.z);
    const power=(seed,orth)=>{ let v=seed.clone().normalize(); for(let i=0;i<60;i++){ v=M(v); orth.forEach(o=>v.addScaledVector(o,-v.dot(o))); v.normalize(); } return v; };
    const a1=power(V(1,.3,.2),[]), a2=power(V(.2,1,.3),[a1]), a3=new THREE.Vector3().crossVectors(a1,a2).normalize();
    return {c,a:[a1,a2,a3]};
  }
  function centerOf(objs){ const b=new THREE.Box3(); objs.forEach(o=>b.expandByObject(o)); return b.getCenter(new THREE.Vector3()); }
  function pivotFor(name,objs,point){ // re-parent parts under a pivot at `point` keeping world transforms
    const pv=new THREE.Group(); pv.name=name; model.add(pv); pv.position.copy(model.worldToLocal(point.clone())); pv.updateMatrixWorld(true);
    objs.forEach(o=>pv.attach(o)); return pv;
  }
  const byName=n=>model.getObjectByName(n);
  const byPrefix=p=>{ const out=[]; model.traverse(o=>{ if(o.isMesh && o.name.startsWith(p)) out.push(o); }); return out; };

  // ---------- pixel screen ----------
  const PW=160, PH=100, pc=document.createElement('canvas'); pc.width=PW; pc.height=PH; const px=pc.getContext('2d');
  const screenTex=new THREE.CanvasTexture(pc); screenTex.magFilter=THREE.NearestFilter; screenTex.minFilter=THREE.NearestFilter; screenTex.encoding=THREE.sRGBEncoding; screenTex.generateMipmaps=false;
  const S={water:0,heat:0,sun:0,shake:0,joy:0,sel:2,t:0,drops:[],parts:[],flames:[],pokes:[],hammer:null,seeds:[],
    veg:[{k:'corn',x:22},{k:'cabbage',x:52},{k:'eggplant',x:82},{k:'chili',x:110},{k:'mushroom',x:138}].map(v=>Object.assign(v,{y:0,vy:0,sq:0,g:0,mood:0}))};
  const COL={sky0:'#1d2148',sky1:'#3a3f86',sun:'#ffd75a',soil:'#6e5236',soil2:'#8a6a48',grass:'#7db55a',white:'#f6f3ea',ink:'#1b1b2b',water:'#7cc4ff',fire1:'#ffb238',fire2:'#ff6a2b'};
  const R=(x,y,w,h,c)=>{ px.fillStyle=c; px.fillRect(Math.round(x),Math.round(y),w,h); };
  function ellipse(cx,cy,rx,ry,c){ for(let y=-ry;y<=ry;y++) for(let x=-rx;x<=rx;x++) if((x*x)/(rx*rx+.01)+(y*y)/(ry*ry+.01)<=1) R(cx+x,cy+y,1,1,c); }
  function face(x,y,m){ R(x-2,y,1,1,COL.ink); R(x+2,y,1,1,COL.ink); if(m>0){ R(x-1,y+2,3,1,COL.ink); R(x-2,y+1,1,1,COL.ink); R(x+2,y+1,1,1,COL.ink);} else if(m<0){ R(x-1,y+2,3,1,COL.ink); R(x-2,y+3,1,1,COL.ink); R(x+2,y+3,1,1,COL.ink);} else R(x-1,y+2,3,1,COL.ink); }
  function drawVeg(v,i){
    const base=82, gy=base-v.y, s=1-v.sq, h=Math.round(10*s);
    // stem grows with water
    const stem=Math.round(v.g*10); if(stem>0) R(v.x,base-stem,1,stem,COL.grass);
    const y=gy-stem; const m=v.mood;
    if(v.k==='corn'){ ellipse(v.x,y-h,5,h,'#f2c230'); for(let k=-h+2;k<h-1;k+=3) for(let j=-3;j<=3;j+=3) R(v.x+j,y-h+k,1,1,'#d9a51a'); R(v.x-6,y-6,2,6,COL.grass); R(v.x+5,y-6,2,6,COL.grass); face(v.x,y-h-1,m); }
    if(v.k==='cabbage'){ ellipse(v.x,y-7,8,Math.round(7*s),'#9acd6a'); ellipse(v.x,y-7,5,Math.round(5*s),'#b7e08a'); face(v.x,y-8,m); }
    if(v.k==='eggplant'){ ellipse(v.x,y-h,5,h,'#7a52b0'); R(v.x-3,y-2*h,7,2,'#5f9a43'); R(v.x,y-2*h-2,1,2,'#5f9a43'); face(v.x,y-h,m); }
    if(v.k==='chili'){ ellipse(v.x,y-h,4,h,'#e5483a'); R(v.x-1,y-2*h-2,3,2,'#4c8a3a'); R(v.x+1,y,2,1,'#e5483a'); face(v.x,y-h,m); }
    if(v.k==='mushroom'){ R(v.x-3,y-6,7,6,'#f3e6cf'); ellipse(v.x,y-8,8,Math.round(5*s),'#c99a6a'); R(v.x-4,y-11,2,2,'#f3e6cf'); R(v.x+3,y-10,2,2,'#f3e6cf'); face(v.x,y-4,m); }
    if(i===S.sel && S.joy>0){ const a=Math.round(Math.sin(S.t*8)*1); R(v.x-1,gy-stem-30+a,3,3,COL.white); R(v.x,gy-stem-27+a,1,2,COL.white); }
  }
  function note(x,y,c){ S.parts.push({x,y,vx:(Math.random()-.5)*14,vy:-18-Math.random()*10,life:1.4,k:'note',c:c||COL.white}); }
  function drawNote(p){ const x=Math.round(p.x),y=Math.round(p.y); R(x,y,2,2,p.c); R(x+1,y-5,1,5,p.c); R(x+2,y-5,2,1,p.c); }
  function screenStep(dt){
    S.t+=dt; S.water=Math.max(0,S.water-dt*.5); S.heat=Math.max(0,S.heat-dt*.8); S.shake=Math.max(0,S.shake-dt*3); S.joy=Math.max(0,S.joy-dt*.35);
    for(const v of S.veg){ v.vy-=180*dt; v.y+=v.vy*dt; if(v.y<0){ v.y=0; if(v.vy<-30) v.sq=Math.min(.35,-v.vy/400); v.vy=0; } v.sq*=Math.pow(.02,dt); v.mood+= (0-v.mood)*dt*.4;
      if(S.water>.2){ v.g=Math.min(1,v.g+dt*.12*S.water); if(Math.random()<dt*2*S.water) { v.vy=Math.max(v.vy,30); v.mood=1; } }
      if(S.heat>.2 && v.k==='chili' && v.y===0 && Math.random()<dt*6){ v.vy=55; v.mood=-1; note(v.x,60,'#ff8a5b'); }
      if(S.heat>.2 && Math.random()<dt*.6) v.mood=-1;
      if(S.sun>.6 && Math.random()<dt*.5){ v.mood=1; }
      if(Math.random()<dt*.15) note(v.x,58); }
    if(S.water>.05) for(let i=0;i<Math.ceil(S.water*4);i++) S.drops.push({x:Math.random()*PW,y:-2,v:70+Math.random()*40});
    for(const d of S.drops) d.y+=d.v*dt; S.drops=S.drops.filter(d=>d.y<84);
    if(S.heat>.05 && Math.random()<S.heat) S.flames.push({x:Math.random()*PW,y:86,life:.6});
    for(const f of S.flames){ f.y-=26*dt; f.life-=dt; } S.flames=S.flames.filter(f=>f.life>0);
    for(const p of S.parts){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; } S.parts=S.parts.filter(p=>p.life>0);
    for(const p of S.pokes){ p.t+=dt; if(p.t>.35&&!p.hit){ p.hit=1; const v=S.veg[p.i]; v.vy=70; v.mood=1; note(v.x,50,'#ffe08a'); note(v.x+4,52,'#ffe08a'); } } S.pokes=S.pokes.filter(p=>p.t<.8);
    if(S.hammer){ S.hammer.t+=dt; if(S.hammer.t>.25&&!S.hammer.hit){ S.hammer.hit=1; const v=S.veg[S.hammer.i]; v.sq=.45; v.vy=40; v.mood=-1; S.shake=1; for(let k=0;k<6;k++) S.parts.push({x:v.x,y:66,vx:(Math.random()-.5)*60,vy:-30-Math.random()*30,life:.6,k:'star',c:'#ffe08a'}); note(v.x,52,'#b7e08a'); } if(S.hammer.t>.7) S.hammer=null; }
    for(const s of S.seeds){ s.y+=s.v*dt; s.v+=200*dt; if(s.y>=80&&!s.done){ s.done=1; const v=S.veg[s.i]; v.g=0; v.y=0; v.vy=60; v.mood=1; for(let k=0;k<4;k++) note(v.x+(k-1.5)*4,60,'#b7e08a'); } } S.seeds=S.seeds.filter(s=>!s.done);
  }
  function screenDraw(){
    const sh=S.shake>0?Math.round((Math.random()-.5)*4*S.shake):0; px.save(); px.translate(sh,0);
    // sky brightens with the sun slider
    const sky=px.createLinearGradient(0,0,0,84); const b=S.sun; sky.addColorStop(0,b>.5?'#4a78c8':'#1d2148'); sky.addColorStop(1,b>.5?'#a8d4ff':'#3a3f86'); px.fillStyle=sky; px.fillRect(-4,0,PW+8,PH);
    if(b<.5) for(let i=0;i<14;i++){ const x=(i*37)%PW, y=(i*13)%40+3; if(Math.sin(S.t*2+i)>-.3) R(x,y,1,1,'#fff'); }
    if(b>.05){ const sy=40-b*30; ellipse(130,sy,7,7,COL.sun); if(b>.4) for(let k=0;k<8;k++){ const a=k/8*Math.PI*2+S.t*b; R(130+Math.cos(a)*11,sy+Math.sin(a)*11,2,2,COL.sun); } }
    if(S.heat>.05){ px.fillStyle=`rgba(255,120,40,${S.heat*.25})`; px.fillRect(-4,0,PW+8,PH); }
    R(-4,82,PW+8,18,COL.soil); for(let x=0;x<PW;x+=6) R(x+((x/6)%2)*2,84,2,1,COL.soil2); R(-4,82,PW+8,1,COL.grass);
    S.veg.forEach(drawVeg);
    for(const d of S.drops) R(d.x,d.y,1,3,COL.water);
    for(const f of S.flames){ R(f.x,f.y,2,2,f.life>.3?COL.fire1:COL.fire2); }
    for(const p of S.parts){ if(p.k==='note') drawNote(p); else R(p.x,p.y,1,1,p.c); }
    for(const p of S.pokes){ const v=S.veg[p.i], k=Math.min(1,p.t/.35), y=30+k*22; R(v.x-1,y-10,3,10,'#f2d4b5'); R(v.x-3,y-14,7,5,'#f2d4b5'); }
    if(S.hammer){ const v=S.veg[S.hammer.i], a=Math.min(1,S.hammer.t/.25); const hx=v.x+10-a*6, hy=36+a*22; R(hx,hy-12,2,12,'#8a6a48'); R(hx-4,hy-16,10,6,'#e5483a'); }
    for(const s of S.seeds) ellipse(S.veg[s.i].x,s.y,2,3,'#f6f3ea');
    // header strip
    R(-4,0,PW+8,9,'rgba(10,10,30,.55)'); px.fillStyle='#f6f3ea'; px.font='bold 7px monospace'; px.textBaseline='top'; px.fillText('EMUGE · MOOD GARDEN',4,1);
    const lv=[['💧',S.water],['☀',S.sun],['🔥',S.heat]]; lv.forEach(([_,v],k)=>{ R(112+k*16,3,12,3,'#2a2d55'); R(112+k*16,3,Math.round(12*Math.min(1,v)),3,['#7cc4ff','#ffd75a','#ff8a3d'][k]); });
    px.restore(); screenTex.needsUpdate=true;
  }

  // ---------- load ----------
  const interact={}, hoverables=[]; let cat=null;
  function pokeCat(){ if(!cat) return; lastInteract=performance.now(); hint.classList.add('gone'); if(cat.state==='hidden'||cat.state==='down'){ cat.state='rise'; cat.t=0; } else { cat.vj=2.2; cat.state='peek'; cat.t=0; cat.blinkT=.18; } for(let k=0;k<3;k++) note(20+k*55,40,'#ffd2a8'); }
  const onModel=gltf=>{
    model=gltf.scene;
    ['Backdrop','CamTarget'].forEach(n=>{ const o=model.getObjectByName(n); if(o) o.parent.remove(o); });
    model.updateMatrixWorld(true);
    // centre the model on its footprint
    const box=new THREE.Box3().setFromObject(model), c=box.getCenter(new THREE.Vector3()), size=box.getSize(new THREE.Vector3());
    model.position.sub(V(c.x,box.min.y,c.z)); bob.add(model); model.updateMatrixWorld(true);
    model.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); if(o.material.map) o.material.map.anisotropy=4; if(o.material.normalMap){ o.material.normalMap=null; o.material.needsUpdate=true; } } });

    // screen → pixel canvas with planar UVs
    const scr=byName('Screen');
    if(scr){ const pts=worldPoints([scr]), P=pca(pts); const g=scr.geometry.clone(); const pos=g.attributes.position, uv=new Float32Array(pos.count*2); const v=new THREE.Vector3();
      let ax=P.a[0], ay=P.a[1]; if(Math.abs(ax.y)>Math.abs(ax.x)) [ax,ay]=[ay,ax]; if(ax.x<0) ax=ax.clone().negate(); if(ay.y<0) ay=ay.clone().negate();
      let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9; const pr=[]; for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i).applyMatrix4(scr.matrixWorld).sub(P.c); const a=v.dot(ax), b2=v.dot(ay); pr.push([a,b2]); mnx=Math.min(mnx,a);mxx=Math.max(mxx,a);mny=Math.min(mny,b2);mxy=Math.max(mxy,b2); }
      pr.forEach(([a,b2],i)=>{ uv[i*2]=(a-mnx)/(mxx-mnx); uv[i*2+1]=(b2-mny)/(mxy-mny); });
      g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); scr.geometry=g;
      scr.material=new THREE.MeshBasicMaterial({map:screenTex,toneMapped:false}); interact.screen={objs:[scr]}; }

    // valve: spins around the axis of its rim
    const valveParts=['Valve_Boss','Valve_Hub','Valve_Rim','Valve_Spoke0','Valve_Spoke1','Valve_Spoke2'].map(byName).filter(Boolean);
    if(valveParts.length){ const P=pca(worldPoints([byName('Valve_Rim')||valveParts[0]])); const axisW=P.a[2].clone(); if(axisW.z<0) axisW.negate();
      const pv=pivotFor('valvePivot',valveParts,centerOf(valveParts)); const axisL=axisW.clone().transformDirection(new THREE.Matrix4().copy(pv.parent.matrixWorld).invert()).normalize();
      interact.valve={objs:valveParts,pivot:pv,axis:axisL,angle:0,vel:0,centerW:centerOf(valveParts)}; }

    // panel normal for buttons / slider / sun
    const plate=byName('Panel_Plate'); const PN=plate?pca(worldPoints([plate])):null; let normal=PN?PN.a[2].clone():V(0,1,0); if(normal.y<0) normal.negate();
    // buttons (pair each button with the icon that sits on it)
    const icons=['IconHand','IconFlame','IconFlame_Inner','IconHammer_Handle','IconHammer_Head'].map(byName).filter(Boolean);
    for(let i=0;i<3;i++){ const btn=byName('Button'+i); if(!btn) continue; const bc=centerOf([btn]);
      const mine=icons.filter(ic=>{ const cc=centerOf([ic]); return Math.hypot(cc.x-bc.x,cc.z-bc.z)<.06; });
      const kind=mine.some(o=>o.name.startsWith('IconHand'))?'poke':mine.some(o=>o.name.startsWith('IconFlame'))?'heat':'hammer';
      const pv=pivotFor('btn'+i,[btn,...mine],bc); const dirL=normal.clone().negate().transformDirection(new THREE.Matrix4().copy(pv.parent.matrixWorld).invert()).normalize();
      interact['b'+i]={objs:[btn,...mine],pivot:pv,home:pv.position.clone(),dir:dirL,press:0,down:false,kind}; }

    // slider: knob travels along the slot's long axis
    const knob=byName('Slider_Knob'), slot=byName('Slider_Slot');
    if(knob&&slot){ const P=pca(worldPoints([slot])); let ax=P.a[0].clone(); if(ax.y<0) ax.negate();
      const pts=worldPoints([slot]).map(p=>p.clone().sub(P.c).dot(ax)); const half=(Math.max(...pts)-Math.min(...pts))/2;
      const kpts=worldPoints([knob]).map(p=>p.clone().sub(P.c).dot(ax)); const khalf=(Math.max(...kpts)-Math.min(...kpts))/2;
      const kc=centerOf([knob]); const s0=kc.clone().sub(P.c).dot(ax);
      const pv=pivotFor('sliderPivot',[knob],kc); const axL=ax.clone().transformDirection(new THREE.Matrix4().copy(pv.parent.matrixWorld).invert()).normalize();
      const lo=-half+khalf*1.1, hi=half-khalf*1.1;
      interact.slider={objs:[knob,slot],pivot:pv,home:pv.position.clone(),axis:axL,axisW:ax,center:P.c,s0,lo,hi,s:Math.max(lo,Math.min(hi,s0)),half}; }
    const sunRays=byPrefix('Sun_Ray'), sunCore=byName('Sun_Core');
    if(sunRays.length){ const sc=sunCore?centerOf([sunCore]):centerOf(sunRays); const pv=pivotFor('sunPivot',sunRays,sc); const nL=normal.clone().transformDirection(new THREE.Matrix4().copy(pv.parent.matrixWorld).invert()).normalize(); interact.sun={pivot:pv,axis:nL,objs:[...sunRays,...(sunCore?[sunCore]:[])],spin:0}; }

    // joystick: ball + shaft tilt around the base
    const jb=byName('Joystick_Base'), jparts=['Joystick_Ball','Joystick_Shaft'].map(byName).filter(Boolean);
    if(jb&&jparts.length){ const bb=new THREE.Box3().setFromObject(jb); const pvp=centerOf([jb]); pvp.y=bb.max.y; const pv=pivotFor('joyPivot',jparts,pvp); interact.joy={objs:[...jparts,jb],pivot:pv,tx:0,tz:0,vx:0,vz:0}; }
    const tray=byPrefix('Tray_'); if(tray.length) interact.tray={objs:tray,center:centerOf(tray)};
    const spout=byName('Spout_Rim'); interact.spout=spout?centerOf([spout]):null;

    const boxParts=byPrefix('CatBox_'); if(boxParts.length) interact.cat={objs:boxParts};
    for(const [k,o] of Object.entries(interact)) if(o&&o.objs) o.objs.forEach(m=>{ m.userData.part=k; hoverables.push(m); });
    model.traverse(o=>{ if(o.isMesh && !o.userData.part){ o.userData.part='body'; hoverables.push(o);} });

    // camera framing: 3/4 view like the render
    const fb=new THREE.Box3().setFromObject(bob); const fs=fb.getSize(new THREE.Vector3()), fc=fb.getCenter(new THREE.Vector3());
    camera.userData.target=fc; camera.userData.dist=Math.max(fs.y,fs.x*1.15)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.12;
    root.rotation.y=-.42; baseYaw=-.42;
    // cat living in the cardboard box: peeks out, looks around, blinks, ducks back
    if(boxParts.length){ const bb=new THREE.Box3(); boxParts.forEach(o=>bb.expandByObject(o)); const sz=bb.getSize(new THREE.Vector3()), cc=bb.getCenter(new THREE.Vector3());
      const tl=new THREE.TextureLoader(), base=host.dataset.assets||'assets/';
      const texOpen=tl.load(base+'cat.webp'), texBlink=tl.load(base+'cat-blink.webp'); [texOpen,texBlink].forEach(t=>{ t.encoding=THREE.sRGBEncoding; t.anisotropy=4; });
      renderer.localClippingEnabled=true; const clip=new THREE.Plane(V(0,1,0),0);
      const mat=new THREE.SpriteMaterial({map:texOpen,transparent:true,alphaTest:.04,toneMapped:false,clippingPlanes:[clip]});
      const spr=new THREE.Sprite(mat); spr.center.set(.5,0); const h=Math.min(sz.x,sz.z)*1.2; spr.scale.set(h*640/608,h,1);
      const local=model.worldToLocal(cc.clone()); const rimY=model.worldToLocal(V(0,bb.max.y,0)).y;
      spr.position.set(local.x,rimY-h,local.z+sz.z*.05); spr.visible=false; spr.userData.part='cat'; model.add(spr); hoverables.push(spr);
      const floorL=model.worldToLocal(V(cc.x,bb.min.y+sz.y*.04,cc.z));
      cat={spr,mat,clip,floorL,texOpen,texBlink,h,rimY,state:'hidden',t:0,wait:1.2,up:0,jump:0,vj:0,blinkT:0,nextBlink:.8,tilt:0}; }
    ready=true; resize(); host.classList.add('m3d-ready'); screenDraw(); render();
    window.__m3d={get cat(){return cat},interact,root,camera,S,toScreen,parts:Object.keys(interact),pickAt:(x,y)=>pick({clientX:x,clientY:y})};
    if(window.__m3dReady) window.__m3dReady();
  };
  const onErr=err=>console.warn('machine model failed',err);
  if(window.EMUGE_GLB_B64){ const bin=atob(window.EMUGE_GLB_B64), buf=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i); new THREE.GLTFLoader().parse(buf.buffer,'',onModel,onErr); }
  else new THREE.GLTFLoader().load(host.dataset.model||'media/emuge-machine.glb',onModel,undefined,onErr);

  // ---------- size & camera ----------
  function resize(){ const r=host.getBoundingClientRect(); if(!r.width) return; renderer.setSize(r.width,r.height,false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix();
    if(camera.userData.target){ const t=camera.userData.target, d=camera.userData.dist/Math.min(1,camera.aspect/.8); camera.position.set(t.x,t.y+d*.16,t.z+d); camera.lookAt(t.x,t.y-.02,t.z); } }
  new ResizeObserver(resize).observe(host);

  // ---------- interaction ----------
  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
  let drag=null, hover=null, baseYaw=-.42, yaw=0, pitch=0, vyaw=0, hop=0, vhop=0, lastInteract=performance.now();
  function pick(e){ const r=canvas.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(ndc,camera); const hit=ray.intersectObjects(hoverables,false)[0]; return hit?hit.object.userData.part:null; }
  function toScreen(vw){ const v=vw.clone().project(camera), r=canvas.getBoundingClientRect(); return {x:r.left+(v.x+1)/2*r.width, y:r.top+(1-v.y)/2*r.height}; }
  function setHover(p){ if(hover===p) return; if(hover&&interact[hover]) glow(hover,0); hover=p; if(p&&interact[p]&&p!=='screen') glow(p,1); canvas.style.cursor=!p?'default':p==='body'||p==='screen'?'grab':'pointer'; }
  function glow(k,on){ (interact[k].objs||[]).forEach(m=>{ if(m.material&&m.material.emissive){ m.material.emissive.setRGB(on?.16:0,on?.12:0,on?.02:0); } }); }
  function press(k,on){ const b=interact[k]; b.down=on; if(on) act(b.kind); }
  function act(kind){ lastInteract=performance.now(); hint.classList.add('gone');
    if(kind==='poke'){ S.pokes.push({i:Math.floor(Math.random()*5),t:0}); }
    if(kind==='heat'){ S.heat=Math.min(1.4,S.heat+.6); }
    if(kind==='hammer'){ S.hammer={i:1,t:0}; }
    if(kind==='seed'){ S.seeds.push({i:Math.floor(Math.random()*5),y:12,v:10}); }
  }
  canvas.addEventListener('pointerdown',e=>{ if(!ready) return; e.preventDefault(); const p=pick(e); lastInteract=performance.now(); hint.classList.add('gone');
    canvas.setPointerCapture(e.pointerId); drag={part:p||'body',x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,moved:0};
    if(p&&p.startsWith('b')&&interact[p]) press(p,true);
    if(p==='tray') act('seed');
    if(p==='cat') pokeCat();
    if(p==='valve'){ const c=toScreen(interact.valve.centerW.clone().applyMatrix4(root.matrixWorld)); drag.cx=c.x; drag.cy=c.y; drag.a=Math.atan2(e.clientY-c.y,e.clientX-c.x); }
    if(p==='body'||p===null){ canvas.style.cursor='grabbing'; }
  });
  canvas.addEventListener('pointermove',e=>{ if(!ready) return; if(!drag){ setHover(pick(e)); return; }
    const dx=e.clientX-drag.lx, dy=e.clientY-drag.ly; drag.lx=e.clientX; drag.ly=e.clientY; drag.moved+=Math.abs(dx)+Math.abs(dy);
    const k=drag.part;
    if(k==='valve'){ const a=Math.atan2(e.clientY-drag.cy,e.clientX-drag.cx); let d=a-drag.a; if(d>Math.PI) d-=2*Math.PI; if(d<-Math.PI) d+=2*Math.PI; drag.a=a; interact.valve.vel=-d*60; interact.valve.angle-=d; S.water=Math.min(1.5,S.water+Math.abs(d)*.9); }
    else if(k==='slider'){ const sl=interact.slider; const w0=sl.center.clone().addScaledVector(sl.axisW,sl.lo), w1=sl.center.clone().addScaledVector(sl.axisW,sl.hi); const a=toScreen(w0.applyMatrix4(root.matrixWorld)), b=toScreen(w1.applyMatrix4(root.matrixWorld));
      const vx=b.x-a.x, vy=b.y-a.y, t=Math.max(0,Math.min(1,((e.clientX-a.x)*vx+(e.clientY-a.y)*vy)/(vx*vx+vy*vy))); sl.s=sl.lo+(sl.hi-sl.lo)*t; S.sun=t; }
    else if(k==='joy'){ const j=interact.joy; j.tx=Math.max(-.45,Math.min(.45,j.tx+dy*.01)); j.tz=Math.max(-.45,Math.min(.45,j.tz-dx*.01)); const dir=dx>4?1:dx<-4?-1:0; if(dir&&performance.now()-(j.lastMove||0)>220){ j.lastMove=performance.now(); S.sel=(S.sel+dir+5)%5; S.joy=1; S.veg[S.sel].vy=40; note(S.veg[S.sel].x,56,'#ffe08a'); } }
    else if(k==='body'||k==='screen'||k===null){ vyaw=dx*.006; yaw+=dx*.006; pitch=Math.max(-.25,Math.min(.3,pitch+dy*.003)); }
  });
  const end=e=>{ if(!drag) return; const k=drag.part;
    if(k&&k.startsWith('b')&&interact[k]) press(k,false);
    if((k==='body')&&drag.moved<6){ vhop=2.6; }
    if(k==='screen'&&drag.moved<6){ S.pokes.push({i:Math.floor(Math.random()*5),t:0}); }
    if(k==='joy'){ const j=interact.joy; j.vx=0; j.vz=0; }
    drag=null; canvas.style.cursor='default'; };
  canvas.addEventListener('pointerup',end); canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('pointerleave',()=>{ if(!drag) setHover(null); });

  // ---------- loop ----------
  const drops=[]; const dropGeo=new THREE.SphereGeometry(.012,8,6), dropMat=new THREE.MeshStandardMaterial({color:0x7cc4ff,roughness:.2,transparent:true,opacity:.85});
  let visible=true, running=false, last=0;
  function render(){ renderer.render(scene,camera); }
  function tick(ts){ if(!running) return; const dt=Math.min(.05,(ts-(last||ts))/1000)||.016; last=ts;
    if(ready){
      const idle=performance.now()-lastInteract>4000;
      if(!drag){ yaw+=vyaw; vyaw*=.92; yaw+= (0-yaw)*dt*(idle?.6:.15); pitch+=(0-pitch)*dt*1.5; }
      root.rotation.y=baseYaw+yaw+(idle&&!REDUCED?Math.sin(ts/2600)*.12:0); root.rotation.x=pitch*.5;
      vhop+=(-60*hop-7*vhop)*dt; hop+=vhop*dt; if(vhop>0&&hop>0&&!REDUCED) {} bob.position.y=Math.max(0,hop)*.12+(REDUCED?0:Math.sin(ts/1400)*.01); bob.scale.set(1+Math.max(0,-hop)*.05,1-Math.max(0,-hop)*.06,1+Math.max(0,-hop)*.05);
      const va=interact.valve; if(va){ if(!drag||drag.part!=='valve'){ va.angle+=va.vel*dt*.016; va.vel*=.9; } va.pivot.quaternion.setFromAxisAngle(va.axis,va.angle); }
      for(const k of ['b0','b1','b2']){ const b=interact[k]; if(!b) continue; const target=b.down?1:0; b.press+=(target-b.press)*Math.min(1,dt*24); b.pivot.position.copy(b.home).addScaledVector(b.dir,b.press*.012);
        if(b.down&&b.kind==='heat') S.heat=Math.min(1.4,S.heat+dt*1.2); }
      const sl=interact.slider; if(sl) sl.pivot.position.copy(sl.home).addScaledVector(sl.axis,sl.s-sl.s0);
      const su=interact.sun; if(su){ su.spin+=dt*(.3+S.sun*4); su.pivot.quaternion.setFromAxisAngle(su.axis,su.spin); su.objs.forEach(m=>m.material.emissive&&m.material.emissive.setRGB(S.sun*.9,S.sun*.65,S.sun*.1)); }
      if(cat){ const c=cat; c.t+=dt;
        if(c.state==='hidden'){ c.spr.visible=false; if(c.t>c.wait){ c.state='rise'; c.t=0; } }
        else if(c.state==='rise'){ c.up=Math.min(1,c.t/.7); if(c.up>=1){ c.state='peek'; c.t=0; } }
        else if(c.state==='peek'){ c.up=1; if(c.t>4.2&&!REDUCED){ c.state='down'; c.t=0; } }
        else if(c.state==='down'){ c.up=Math.max(0,1-c.t/.55); if(c.up<=0){ c.state='hidden'; c.t=0; c.wait=1.4+Math.random()*2.2; } }
        if(c.state!=='hidden'){ c.spr.visible=true; c.clip.constant=-model.localToWorld(c.floorL.clone()).y; const e=c.up<1?1-Math.pow(1-c.up,3):1;
          c.vj+=(-80*c.jump-8*c.vj)*dt; c.jump+=c.vj*dt;
          const peekH=c.h*.5; c.spr.position.y=c.rimY-c.h+e*peekH+Math.max(0,c.jump)*c.h*.12+(c.state==='peek'?Math.sin(c.t*3)*c.h*.01:0);
          // look around: lean left/right while peeking
          const look=c.state==='peek'?Math.sin(c.t*1.6)*.12:0; c.tilt+=(look-c.tilt)*Math.min(1,dt*5); c.mat.rotation=c.tilt;
          // blink every couple of seconds (sometimes twice)
          c.nextBlink-=dt; if(c.nextBlink<=0&&c.state==='peek'){ c.blinkT=.16; c.nextBlink=1.2+Math.random()*2.2; if(Math.random()<.3) c.nextBlink=.32; }
          if(c.blinkT>0){ c.blinkT-=dt; } const want=c.blinkT>0?c.texBlink:c.texOpen; if(c.mat.map!==want){ c.mat.map=want; c.mat.needsUpdate=true; } } }
      const j=interact.joy; if(j){ if(!drag||drag.part!=='joy'){ j.vx+=(-90*j.tx-9*j.vx)*dt; j.tx+=j.vx*dt; j.vz+=(-90*j.tz-9*j.vz)*dt; j.tz+=j.vz*dt; } j.pivot.rotation.set(j.tx,0,j.tz); }
      // water drops from the spout while the valve turns
      if(interact.spout && S.water>.15 && Math.random()<S.water*.6){ const m=new THREE.Mesh(dropGeo,dropMat); const p=interact.spout.clone(); m.position.copy(bob.worldToLocal(p.applyMatrix4(root.matrixWorld))); m.userData.v=0; bob.add(m); drops.push(m); }
      for(let i=drops.length-1;i>=0;i--){ const d=drops[i]; d.userData.v+=3.5*dt; d.position.y-=d.userData.v*dt; if(d.userData.v>1.1){ bob.remove(d); drops.splice(i,1);} }
      screenStep(dt); screenDraw(); render();
    }
    requestAnimationFrame(tick);
  }
  function setRun(on){ if(on&&!running){ running=true; last=0; requestAnimationFrame(tick);} else if(!on) running=false; }
  new IntersectionObserver(es=>es.forEach(e=>{ visible=e.isIntersecting; setRun(visible&&!document.hidden); }),{rootMargin:'80px'}).observe(host);
  document.addEventListener('visibilitychange',()=>setRun(visible&&!document.hidden));
})();
