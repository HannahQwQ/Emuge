/* ============================================================
   Walker — a small 3D copy of the cardboard installation walks
   around the outer edge of the public-device card, forever.
   Feet sit exactly on the card's outer border (rounded corners
   included); legs swing in step. Now and then on the top edge
   it stops, turns to face you, hops and smiles on its screen;
   hovering makes it say hi, clicking makes it jump and spin.
   ============================================================ */
(function walker3d(){
  const wrap=document.getElementById('publicWrap'), card=document.getElementById('publicCard'), el=document.getElementById('walker');
  if(!wrap||!card||!el||!window.THREE||!THREE.GLTFLoader) return;
  const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas=document.createElement('canvas'); el.appendChild(canvas);
  const bubble=document.createElement('span'); bubble.className='walker-bubble'; el.appendChild(bubble);
  const hit=document.createElement('span'); hit.className='walker-hit'; el.appendChild(hit);   // generous hover/click target
  const LINES=['嗨～','今天心情怎么样？','♪ ♫','来浇浇水吧','种下一颗心情？'];
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio||1)); renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e2,0x4a4570,.95));
  const key=new THREE.DirectionalLight(0xfff1dc,1.6); key.position.set(-3,4,3); scene.add(key);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,50);
  const body=new THREE.Group(); scene.add(body);
  let model=null, legs=[], ready=false, aspect=1, screen=null, faceMat=null, screenMat=null;
  const FACE=Math.atan2(-Math.cos(.42),Math.sin(.42));   // yaw that turns the front toward the viewer

  // load after the first-page model so it gets the bandwidth first
  const afterHero=fn=>{ let done=false; const go=()=>{ if(!done){ done=true; fn(); } }; if(window.__heroReady) go(); else { addEventListener('emuge:hero-ready',go,{once:true}); setTimeout(go,8000); } };
  afterHero(()=>new THREE.GLTFLoader().load(el.dataset.model||'media/emuge-machine.glb',gltf=>{
    model=gltf.scene;
    const drop=[]; model.traverse(o=>{ if(/^(Backdrop|CamTarget|CatBox_)/.test(o.name)) drop.push(o); }); drop.forEach(o=>o.parent&&o.parent.remove(o));
    model.traverse(o=>{ if(o.isMesh&&o.material&&o.material.normalMap){ o.material=o.material.clone(); o.material.normalMap=null; } });
    model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model), c=box.getCenter(new THREE.Vector3());
    model.position.set(-c.x,-box.min.y,-c.z); body.add(model); model.updateMatrixWorld(true);
    // legs: group each side's parts under a hip pivot so they can swing
    for(const side of ['-1','1']){
      const parts=[]; model.traverse(o=>{ if(o.isMesh && new RegExp('^(LegUpper|LegLower|LegCollar|Foot|FootPlate|FootStripe)_'+side.replace('-','\\-')+'$').test(o.name)) parts.push(o);
        if(o.isMesh && new RegExp('^FootDot_'+side.replace('-','\\-')+'_').test(o.name)) parts.push(o); });
      if(!parts.length) continue;
      const lb=new THREE.Box3(); parts.forEach(p=>lb.expandByObject(p)); const hip=lb.getCenter(new THREE.Vector3()); hip.y=lb.max.y;
      const pv=new THREE.Group(); model.add(pv); pv.position.copy(model.worldToLocal(hip.clone())); pv.updateMatrixWorld(true); parts.forEach(p=>pv.attach(p));
      legs.push({pv,sign:side==='-1'?1:-1});
    }
    // the screen gets a tiny smiling face while it greets you
    model.traverse(o=>{ if(o.isMesh&&o.name==='Screen') screen=o; });
    if(screen){ screenMat=screen.material;
      const pos=screen.geometry.attributes.position, uv=new Float32Array(pos.count*2), b=new THREE.Box3().setFromBufferAttribute(pos), sz=b.getSize(new THREE.Vector3());
      const ax=sz.x>=sz.z?'x':'z', ay=sz.y>=Math.min(sz.x,sz.z)?'y':(ax==='x'?'z':'x');
      for(let i=0;i<pos.count;i++){ const G={x:pos.getX(i),y:pos.getY(i),z:pos.getZ(i)}; uv[i*2]=(G[ax]-b.min[ax])/(sz[ax]||1); uv[i*2+1]=(G[ay]-b.min[ay])/(sz[ay]||1); }
      const g=screen.geometry.clone(); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); screen.geometry=g;
      const fc=document.createElement('canvas'); fc.width=128; fc.height=80; const x=fc.getContext('2d');
      x.fillStyle='#1d2148'; x.fillRect(0,0,128,80); x.strokeStyle='#f6f3ea'; x.lineWidth=7; x.lineCap='round';
      x.beginPath(); x.arc(40,40,11,Math.PI*1.1,Math.PI*1.9); x.stroke(); x.beginPath(); x.arc(88,40,11,Math.PI*1.1,Math.PI*1.9); x.stroke();
      x.beginPath(); x.arc(64,46,13,Math.PI*.15,Math.PI*.85); x.stroke(); x.fillStyle='rgba(255,140,150,.55)'; x.beginPath(); x.arc(26,54,7,0,7); x.arc(102,54,7,0,7); x.fill();
      const tex=new THREE.CanvasTexture(fc); tex.encoding=THREE.sRGBEncoding; faceMat=new THREE.MeshBasicMaterial({map:tex,toneMapped:false}); }
    // side-on view, turned a little toward the front so the console shows; front (+z) faces screen-right
    const th=.42, dir=new THREE.Vector3(-Math.cos(th),.18,Math.sin(th)).normalize();
    const fb=new THREE.Box3().setFromObject(body), fc=fb.getCenter(new THREE.Vector3());
    camera.position.copy(fc).addScaledVector(dir,10); camera.lookAt(fc); camera.updateMatrixWorld(true);
    // fit the orthographic frustum to the model so its feet touch the bottom edge exactly
    const inv=camera.matrixWorldInverse, v=new THREE.Vector3(); let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    for(const yaw of [0,FACE*.5,FACE]){ body.rotation.y=yaw; body.updateMatrixWorld(true);   // fit walking and facing poses
      body.traverse(o=>{ if(!o.isMesh) return; const p=o.geometry.attributes.position; for(let i=0;i<p.count;i+=3){ v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y); } }); }
    body.rotation.y=0;
    const padX=(x1-x0)*.06, padTop=(y1-y0)*.3;   // headroom for hops
    camera.left=x0-padX; camera.right=x1+padX; camera.top=y1+padTop; camera.bottom=y0; camera.updateProjectionMatrix();
    aspect=(camera.right-camera.left)/(camera.top-camera.bottom);
    ready=true; measure(); el.classList.add('ready'); frame(0);
  },undefined,e=>console.warn('walker model failed',e)));

  // ---- the card's outer border as a path ----
  let geo=null, s=0, phase=0;
  function measure(){ const wr=wrap.getBoundingClientRect(), cr=card.getBoundingClientRect(); if(!cr.width) return;
    const h=Math.max(46,Math.min(92,cr.width*.07)), w=h*aspect;
    const r=parseFloat(getComputedStyle(card).borderTopLeftRadius)||48;
    const x=cr.left-wr.left, y=cr.top-wr.top, W=cr.width, H=cr.height;
    const L=[W-2*r,Math.PI/2*r,H-2*r,Math.PI/2*r,W-2*r,Math.PI/2*r,H-2*r,Math.PI/2*r];
    geo={x,y,W,H,r,L,total:L.reduce((a,b)=>a+b,0),h,w};
    el.style.width=w+'px'; el.style.height=h+'px'; renderer.setSize(w,h,false); }
  // point on the border (clockwise) and the direction of travel
  function at(d){ const g=geo; d=((d%g.total)+g.total)%g.total; const {x,y,W,H,r,L}=g; let i=0; while(i<7&&d>L[i]){ d-=L[i]; i++; }
    const arc=(cx,cy,a0)=>{ const a=a0+d/r; return [cx+Math.cos(a)*r, cy+Math.sin(a)*r, a+Math.PI/2]; };
    switch(i){ case 0:return [x+r+d,y,0]; case 1:return arc(x+W-r,y+r,-Math.PI/2); case 2:return [x+W,y+r+d,Math.PI/2]; case 3:return arc(x+W-r,y+H-r,0);
      case 4:return [x+W-r-d,y+H,Math.PI]; case 5:return arc(x+r,y+H-r,Math.PI/2); case 6:return [x,y+H-r-d,Math.PI*1.5]; default:return arc(x+r,y+r,Math.PI); } }
  // ---- behaviour: walk, greet (stop + face you), jump ----
  let mode='walk', mt=0, yaw=0, lapGreeted=-1, onTop=false, nextGreet=2.5, sinceGreet=99;
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  function say(on){ if(on&&onTop){ bubble.textContent=LINES[Math.floor(Math.random()*LINES.length)]; bubble.classList.add('show'); } else bubble.classList.remove('show'); }
  function greet(len){ if(mode!=='walk') return; mode='greet'; mt=0; greetLen=len||3.2; sinceGreet=0; }
  let greetLen=3.2;
  function jump(){ if(mode==='jump') return; mode='jump'; mt=0; say(true); bubble.textContent='♪'; }
  hit.addEventListener('pointerenter',()=>{ if(mode==='walk') greet(2.4); });
  hit.addEventListener('click',e=>{ e.preventDefault(); jump(); });
  function frame(dt){
    if(!geo) return;
    const speed=Math.max(56,geo.W*.055); mt+=dt;
    let walking=mode==='walk', hop=0, spin=0;
    if(mode==='greet'){
      const turn=.45, T=greetLen;
      yaw=FACE*(mt<turn?ease(mt/turn):mt>T-turn?ease(Math.max(0,(T-mt)/turn)):1);
      if(mt>turn&&mt<T-turn){ const k=(mt-turn)%.6; hop=k<.3?Math.sin(k/.3*Math.PI)*.12:0; }
      if(mt>turn*.8 && !bubble.classList.contains('show') && mt<T-turn) say(true);
      if(mt>T-turn) say(false);
      if(screen&&faceMat) screen.material=(mt>turn*.6&&mt<T-turn*.4)?faceMat:screenMat;
      if(mt>=T){ mode='walk'; yaw=0; if(screen) screen.material=screenMat; }
    } else if(mode==='jump'){
      const T=.8, k=Math.min(1,mt/T); hop=Math.sin(k*Math.PI)*.35; spin=ease(k)*Math.PI*2;
      if(mt>=T){ mode='walk'; spin=0; setTimeout(()=>{ if(mode==='walk') say(false); },500); }
    }
    if(walking){ s+=dt*speed; phase+=dt*speed/(geo.h*.32); }
    const [px,py,a]=at(s); onTop=Math.abs(a)<.02;
    // now and then, halfway along the top edge, stop and say hello
    const lap=Math.floor(s/geo.total), d=((s%geo.total)+geo.total)%geo.total, onMid=onTop && d>geo.L[0]*.35 && d<geo.L[0]*.65;
    // say hello often enough to be seen: soon after it appears, then every 7–12 s, and always mid-top-edge
    sinceGreet+=dt; if(walking){ nextGreet-=dt;
      if(onMid && lap!==lapGreeted && sinceGreet>4){ lapGreeted=lap; nextGreet=7+Math.random()*5; greet(3.2); }
      else if(nextGreet<=0){ nextGreet=7+Math.random()*5; greet(2.8); } }
    // feet (bottom-centre of the element) on the border point, body leaning outward along the normal
    el.style.transform=`translate(${(px-geo.w/2).toFixed(2)}px,${(py-geo.h).toFixed(2)}px) rotate(${a.toFixed(4)}rad)`;
    if(ready){
      const sw=walking?Math.sin(phase)*.5:0; legs.forEach(l=>l.pv.rotation.x+=(sw*l.sign-l.pv.rotation.x)*Math.min(1,dt*14));
      body.rotation.y=yaw+spin;
      body.position.y=(walking?Math.abs(Math.cos(phase))*.018:0)+hop;
      body.rotation.z=walking?Math.sin(phase)*.03:(mode==='greet'?Math.sin(mt*9)*.04:0);
      renderer.render(scene,camera); }
  }
  el._seek=f=>{ if(geo) s=geo.total*f; }; el._greet=()=>greet(3.2); el._jump=jump; el._state=()=>({mode,mt:+mt.toFixed(2),yaw:+yaw.toFixed(2),onTop});
  new ResizeObserver(measure).observe(card);
  let on=false, last=0;
  function tick(now){ if(!on) return; const dt=Math.min(.05,(now-(last||now))/1000); last=now; frame(REDUCED?0:dt); requestAnimationFrame(tick); }
  new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting&&!on){ on=true; last=0; requestAnimationFrame(tick); } else if(!e.isIntersecting) on=false; }),{rootMargin:'100px'}).observe(wrap);
})();
