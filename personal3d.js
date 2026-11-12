/* ============================================================
   Personal device — 3D egg you can drag to turn.
   The step recordings (#stepVideo) are painted onto the screen
   through a canvas: the round UI sits in the middle with a soft
   edge, and the rest of the non-round screen is filled with the
   video's own edge colour, so the screen never shows a hard
   circle or black corners.
   ============================================================ */
(function personal3d(){
  const host=document.getElementById('egg'), video=document.getElementById('stepVideo');
  if(!host||!video||!window.THREE||!THREE.GLTFLoader) return;
  const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS=[['cabbage','#b5d69a','卷心菜绿'],['corn','#eed58a','玉米黄'],['eggplant','#b79cc7','茄子紫'],['chili','#e3907f','辣椒红'],['Pivot','#e9e6dc','蘑菇白']];

  const canvas=document.createElement('canvas'); canvas.className='p3d'; canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','可拖动旋转的个人装置三维模型，屏幕播放当前步骤的录屏'); host.appendChild(canvas);
  const sw=document.createElement('div'); sw.className='p3d-swatches'; sw.setAttribute('role','group'); sw.setAttribute('aria-label','外壳颜色');
  COLORS.forEach(([k,c,n],i)=>{ const b=document.createElement('button'); b.type='button'; b.style.background=c; b.title=n; b.setAttribute('aria-label',n); b.setAttribute('aria-pressed',i===0); b.dataset.k=k; sw.appendChild(b); });
  host.appendChild(sw);

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio||1)); renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.9;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(22,1,.1,200);
  if(THREE.RoomEnvironment){ const pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromScene(new THREE.RoomEnvironment(),.04).texture; }
  scene.add(new THREE.HemisphereLight(0xffffff,0x8a7fb0,.6));
  const key=new THREE.DirectionalLight(0xffffff,1.1); key.position.set(3,5,8); scene.add(key);
  const pivot=new THREE.Group(); scene.add(pivot);

  // ---- screen compositor ----
  const SC=document.createElement('canvas'), sx=SC.getContext('2d'); let SW=512, SH=512;
  const tiny=document.createElement('canvas'); tiny.width=tiny.height=24; const tx=tiny.getContext('2d',{willReadFrequently:true});
  const screenTex=new THREE.CanvasTexture(SC); screenTex.encoding=THREE.sRGBEncoding; screenTex.flipY=false;
  let edge=[18,20,26], edgeT=[18,20,26], frame=0, circle={x:.5,y:.5,r:.5};
  function sampleEdge(){ try{ tx.drawImage(video,0,0,24,24); const d=tx.getImageData(0,0,24,24).data; let r=0,g=0,b=0,n=0;
      for(let a=0;a<24;a++){ const t=a/24*Math.PI*2, x=Math.round(12+Math.cos(t)*9.4), y=Math.round(12+Math.sin(t)*9.4), i=(y*24+x)*4; r+=d[i];g+=d[i+1];b+=d[i+2];n++; }
      edgeT=[r/n,g/n,b/n]; }catch(e){} }
  let painted=false;
  function paint(){
    // between segments the next clip may not have a frame yet: keep the last picture instead of flashing
    if(video.readyState<2 && painted) return;
    if(video.readyState>=2 && (frame++%8===0)) sampleEdge();
    for(let i=0;i<3;i++) edge[i]+=(edgeT[i]-edge[i])*.15;
    const bg=`rgb(${edge.map(v=>Math.round(v)).join(',')})`;
    sx.globalCompositeOperation='source-over'; sx.fillStyle=bg; sx.fillRect(0,0,SW,SH);
    if(video.readyState>=2){
      const cx=circle.x*SW, cy=circle.y*SH, r=circle.r*Math.min(SW,SH);
      sx.save(); sx.beginPath(); sx.arc(cx,cy,r,0,Math.PI*2); sx.clip();
      sx.drawImage(video,cx-r*1.02,cy-r*1.02,r*2.04,r*2.04); sx.restore();
      // feather the circle into the fill colour so there is no hard edge
      const g=sx.createRadialGradient(cx,cy,r*.86,cx,cy,r*1.01); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,bg.replace('rgb','rgba').replace(')',',1)'));
      sx.fillStyle=g; sx.beginPath(); sx.arc(cx,cy,r*1.02,0,Math.PI*2); sx.fill();
    }
    // a faint glass sheen
    const sh=sx.createLinearGradient(0,0,SW*.7,SH*.7); sh.addColorStop(0,'rgba(255,255,255,.10)'); sh.addColorStop(.35,'rgba(255,255,255,0)'); sx.fillStyle=sh; sx.fillRect(0,0,SW,SH);
    screenTex.needsUpdate=true; if(video.readyState>=2) painted=true;
  }

  // ---- model ----
  let devices={}, current=null, ready=false;
  new THREE.GLTFLoader().load(host.dataset.model||'media/personal-device.glb',gltf=>{
    const root=gltf.scene;
    ['Backdrop','Target','Key_Top_target','Fill_Front_target','Strip_Left_target','Strip_Right_target'].forEach(n=>{ const o=root.getObjectByName(n); if(o&&o.parent) o.parent.remove(o); });
    COLORS.forEach(([k])=>{ const d=root.getObjectByName('Device_'+k); if(d) devices[k]=d; });
    // keep the shell colours rich: less environment wash, a little more saturation
    const seen=new Set(); root.traverse(o=>{ if(!o.isMesh) return; const m=o.material; if(!m||seen.has(m)) return; seen.add(m);
      if(/Shell_Silicone|Play_Key/.test(m.name)){ m.envMapIntensity=.35; const h={}; m.color.getHSL(h); m.color.setHSL(h.h,Math.min(1,h.s*1.7),h.l*.9); }
      else if(/Chrome|Steel/.test(m.name)){ m.envMapIntensity=1.1; } });
    // screen material → video canvas; work out the screen's aspect from its UV-mapped size
    let aspect=1;
    root.traverse(o=>{ if(o.isMesh && /^Screen_Glass/.test(o.name)){
        if(aspect===1){ const b=new THREE.Box3().setFromObject(o), s=b.getSize(new THREE.Vector3()); aspect=s.x/s.y; }
        o.material=new THREE.MeshBasicMaterial({map:screenTex,toneMapped:false}); } });
    SW=512; SH=Math.round(512/aspect); SC.width=SW; SC.height=SH;
    // the round UI fills the screen height, nudged a touch low where the egg screen is widest
    circle={x:.5,y:.52,r:.5};
    Object.values(devices).forEach(d=>{ d.userData.home=d.position.clone(); d.visible=false; pivot.add(d); });
    show('cabbage');
    const b=new THREE.Box3().setFromObject(devices.cabbage||Object.values(devices)[0]), s=b.getSize(new THREE.Vector3());
    camera.userData.size=Math.max(s.x,s.y); ready=true; resize(); host.classList.add('p3d-ready');
    window.__p3d={pivot,camera,devices,SC};
  },undefined,e=>console.warn('personal device model failed',e));

  function show(k){ if(!devices[k]) return; Object.values(devices).forEach(d=>d.visible=false); const d=devices[k];
    d.visible=true; d.position.set(0,0,0); d.updateMatrixWorld(true); const b=new THREE.Box3().setFromObject(d), c=b.getCenter(new THREE.Vector3()); d.position.sub(c); current=k;
    sw.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.k===k)); }
  sw.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b){ show(b.dataset.k); kick(); } });

  function resize(){ const r=host.getBoundingClientRect(); if(!r.width) return; renderer.setSize(r.width,r.height,false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix();
    if(camera.userData.size){ const d=camera.userData.size*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*1.08/Math.min(1,camera.aspect); camera.position.set(0,0,d); camera.lookAt(0,0,0); } kick(); }
  new ResizeObserver(resize).observe(host);

  // ---- drag to turn (no auto rotation) ----
  let yaw=-.32, pitch=.04, vy=0, vp=0, drag=null;
  canvas.addEventListener('pointerdown',e=>{ if(!ready) return; e.preventDefault(); drag={x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing'; vy=vp=0; kick(); });
  canvas.addEventListener('pointermove',e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY;
    vy=dx*.008; vp=dy*.005; yaw+=vy; pitch=Math.max(-.7,Math.min(.7,pitch+vp)); kick(); });
  const end=()=>{ drag=null; canvas.style.cursor='grab'; };
  canvas.addEventListener('pointerup',end); canvas.addEventListener('pointercancel',end);

  // ---- loop: renders while visible; video frames keep the screen live ----
  let visible=false, running=false;
  function kick(){ if(!running&&visible){ running=true; requestAnimationFrame(tick); } }
  function tick(){
    if(!visible){ running=false; return; }
    if(!drag && (Math.abs(vy)>.0004||Math.abs(vp)>.0004)){ yaw+=vy; pitch=Math.max(-.7,Math.min(.7,pitch+vp)); vy*=.85; vp*=.85; }
    pivot.rotation.set(pitch,yaw,0);
    if(ready){ paint(); renderer.render(scene,camera); }
    requestAnimationFrame(tick);
  }
  new IntersectionObserver(es=>es.forEach(en=>{ visible=en.isIntersecting; kick(); }),{rootMargin:'60px'}).observe(host);
  canvas.style.cursor='grab';
})();
