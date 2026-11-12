/* ============================================================
   Team page — the two devices as live 3D models.
   Each screen shows a looping pixel face (happy, blink,
   surprised, love, sleepy, singing). No interaction.
   ============================================================ */
(function team3d(){
  if(!window.THREE||!THREE.GLTFLoader) return;
  const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hosts=[...document.querySelectorAll('.t3d')]; if(!hosts.length) return;

  // ---------- pixel faces (32×20 grid) ----------
  function makeFace(bg){
    const c=document.createElement('canvas'); c.width=32; c.height=20; const x=c.getContext('2d');
    const P=(a,b,col)=>{ x.fillStyle=col; x.fillRect(a,b,1,1); }, R=(a,b,w,h,col)=>{ x.fillStyle=col; x.fillRect(a,b,w,h); };
    const INK='#f6f3ea', PINK='#ff8fa3', GOLD='#ffd75a', MINT='#9be7b4';
    const eye={
      happy:(cx,cy)=>{ P(cx-1,cy,INK);P(cx,cy-1,INK);P(cx+1,cy-1,INK);P(cx+2,cy,INK); },
      open:(cx,cy)=>{ R(cx,cy-1,2,3,INK); },
      blink:(cx,cy)=>{ R(cx-1,cy,4,1,INK); },
      wow:(cx,cy)=>{ R(cx,cy-2,2,1,INK);R(cx-1,cy-1,1,2,INK);R(cx+2,cy-1,1,2,INK);R(cx,cy+1,2,1,INK); },
      heart:(cx,cy)=>{ P(cx-1,cy-1,PINK);P(cx+1,cy-1,PINK);R(cx-1,cy,3,1,PINK);P(cx,cy+1,PINK);P(cx-2,cy-1,PINK);P(cx+2,cy-1,PINK);R(cx-2,cy,5,1,PINK); },
      sleepy:(cx,cy)=>{ R(cx-1,cy+1,4,1,INK); }
    };
    const mouth={
      smile:()=>{ P(13,13,INK);R(14,14,4,1,INK);P(18,13,INK); },
      grin:()=>{ R(13,13,6,1,INK);R(14,14,4,1,PINK); },
      o:()=>{ R(15,13,2,1,INK);P(14,14,INK);P(17,14,INK);R(15,15,2,1,INK); },
      flat:()=>{ R(14,14,4,1,INK); },
      sing:()=>{ R(15,13,2,2,INK); }
    };
    const FACES=[
      {e:'happy',m:'smile',t:1.5},{e:'blink',m:'smile',t:.14},{e:'happy',m:'grin',t:1.2},
      {e:'wow',m:'o',t:1.1},{e:'heart',m:'grin',t:1.5},{e:'open',m:'smile',t:.9},{e:'blink',m:'smile',t:.14},
      {e:'sleepy',m:'flat',t:1.6,z:1},{e:'happy',m:'sing',t:1.6,notes:1}
    ];
    let i=0, t=0, tick=0;
    function draw(){
      const f=FACES[i]; R(0,0,32,20,bg);
      // soft scanlines + corner glow
      for(let y=1;y<20;y+=3) R(0,y,32,1,'rgba(255,255,255,.035)');
      eye[f.e](9,8); eye[f.e](21,8); mouth[f.m]();
      if(f.e!=='heart'){ P(6,11,'rgba(255,143,163,.55)'); P(25,11,'rgba(255,143,163,.55)'); }
      if(f.z){ const k=Math.floor(tick*2)%3; R(26,4-k,3,1,MINT);P(28,5-k,MINT);P(27,6-k,MINT);R(26,7-k,3,1,MINT); }
      if(f.notes){ const k=Math.floor(tick*3)%4; R(3,6-k,1,4,GOLD);R(2,9-k,2,1,GOLD);R(4,6-k,2,1,GOLD); R(28,8-((k+2)%4),1,4,GOLD);R(27,11-((k+2)%4),2,1,GOLD); }
    }
    draw();
    return { canvas:c, step(dt){ t+=dt; tick+=dt; if(t>FACES[i].t){ t=0; i=(i+1)%FACES.length; } draw(); } };
  }

  function planarUV(mesh){
    const pos=mesh.geometry.attributes.position, b=new THREE.Box3().setFromBufferAttribute(pos), sz=b.getSize(new THREE.Vector3());
    const axes=['x','y','z'].sort((p,q)=>sz[q]-sz[p]); let ax=axes[0], ay=axes[1]; if(ax==='y'){ ax=axes[1]; ay='y'; }
    const uv=new Float32Array(pos.count*2);
    for(let i=0;i<pos.count;i++){ const G={x:pos.getX(i),y:pos.getY(i),z:pos.getZ(i)}; uv[i*2]=(G[ax]-b.min[ax])/(sz[ax]||1); uv[i*2+1]=(G[ay]-b.min[ay])/(sz[ay]||1); }
    const g=mesh.geometry.clone(); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); mesh.geometry=g;
  }

  function stage(host){
    const kind=host.dataset.kind; // 'machine' | 'egg'
    const canvas=document.createElement('canvas'); host.appendChild(canvas);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(2,devicePixelRatio||1)); renderer.outputEncoding=THREE.sRGBEncoding;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
    const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(24,1,.05,200);
    if(THREE.RoomEnvironment){ const pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromScene(new THREE.RoomEnvironment(),.04).texture; }
    scene.add(new THREE.HemisphereLight(0xfff4e2,0x4a4570,.85));
    const key=new THREE.DirectionalLight(0xfff1dc,1.4); key.position.set(2.5,4,5); scene.add(key);
    const rim=new THREE.DirectionalLight(0xa9bcff,1.4); rim.position.set(-3,2.5,-2.5); scene.add(rim);
    const pivot=new THREE.Group(); scene.add(pivot);
    const face=makeFace(kind==='egg'?'#151826':'#1d2148');
    const tex=new THREE.CanvasTexture(face.canvas); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter; tex.generateMipmaps=false; tex.encoding=THREE.sRGBEncoding;
    let ready=false, size=1;
    const url=host.dataset.model;
    new THREE.GLTFLoader().load(url,gltf=>{
      let root=gltf.scene;
      if(kind==='egg'){ const d=root.getObjectByName('Device_'+(host.dataset.color||'chili'))||root.children[0]; d.position.set(0,0,0); root=d; }
      const drop=[]; root.traverse(o=>{ if(/^(Backdrop|CamTarget|Target|Key_Top_target|Fill_Front_target|Strip_)/.test(o.name)) drop.push(o); }); drop.forEach(o=>o.parent&&o.parent.remove(o));
      root.traverse(o=>{ if(!o.isMesh) return;
        if(o.material&&o.material.normalMap){ o.material=o.material.clone(); o.material.normalMap=null; }
        if(o.material&&/Shell_Silicone|Play_Key/.test(o.material.name)){ o.material=o.material.clone(); o.material.envMapIntensity=.35; const h={}; o.material.color.getHSL(h); o.material.color.setHSL(h.h,Math.min(1,h.s*1.7),h.l*.9); }
        if(kind==='machine'&&o.name==='Screen'){ planarUV(o); o.material=new THREE.MeshBasicMaterial({map:tex,toneMapped:false}); }
        if(kind==='egg'&&/^Screen_Glass/.test(o.name)){ tex.flipY=false; o.material=new THREE.MeshBasicMaterial({map:tex,toneMapped:false}); } });
      pivot.add(root); root.updateMatrixWorld(true);
      const b=new THREE.Box3().setFromObject(root), c=b.getCenter(new THREE.Vector3()), s=b.getSize(new THREE.Vector3()); root.position.sub(c);
      size=Math.max(s.x,s.y)*(kind==='egg'?1.05:1.1);
      pivot.rotation.y=kind==='machine'?-.38:-.3;
      ready=true; resize(); host.classList.add('ready');
    },undefined,e=>console.warn('team model failed',e));
    function resize(){ const r=host.getBoundingClientRect(); if(!r.width) return; renderer.setSize(r.width,r.height,false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix();
      const d=size*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.min(1,camera.aspect); camera.position.set(0,size*.08,d); camera.lookAt(0,0,0); }
    new ResizeObserver(resize).observe(host);
    let t=0;
    return { host, frame(dt){ if(!ready) return; t+=dt; face.step(dt); tex.needsUpdate=true;
      if(!REDUCED){ if(kind==='machine'){ pivot.rotation.y=-.38+Math.sin(t*.6)*.16; pivot.position.y=Math.abs(Math.sin(t*1.6))*size*.012; }
        else { pivot.rotation.y=-.3+Math.sin(t*.7)*.45; pivot.rotation.z=Math.sin(t*1.1)*.08; pivot.position.y=Math.sin(t*1.3)*size*.05; } }
      renderer.render(scene,camera); } };
  }

  const afterHero=fn=>{ let done=false; const go=()=>{ if(!done){ done=true; fn(); } }; if(window.__heroReady) go(); else { addEventListener('emuge:hero-ready',go,{once:true}); setTimeout(go,8000); } };
  afterHero(()=>{
    const stages=hosts.map(stage); let on=false, last=0;
    function loop(now){ if(!on) return; const dt=Math.min(.05,(now-(last||now))/1000); last=now; stages.forEach(s=>s.frame(dt)); requestAnimationFrame(loop); }
    new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting&&!on){ on=true; last=0; requestAnimationFrame(loop); } else if(!e.isIntersecting) on=false; }),{rootMargin:'200px'}).observe(hosts[0].parentElement);
  });
})();
