/* ============================================================
   Walker — a small 3D copy of the cardboard installation walks
   around the outer edge of the public-device card, forever.
   Feet sit exactly on the card's outer border (rounded corners
   included); legs swing in step. No interaction.
   ============================================================ */
(function walker3d(){
  const wrap=document.getElementById('publicWrap'), card=document.getElementById('publicCard'), el=document.getElementById('walker');
  if(!wrap||!card||!el||!window.THREE||!THREE.GLTFLoader) return;
  const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas=document.createElement('canvas'); el.appendChild(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio||1)); renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e2,0x4a4570,.95));
  const key=new THREE.DirectionalLight(0xfff1dc,1.6); key.position.set(-3,4,3); scene.add(key);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,50);
  const body=new THREE.Group(); scene.add(body);
  let model=null, legs=[], ready=false, aspect=1;

  new THREE.GLTFLoader().load(el.dataset.model||'media/emuge-machine.glb',gltf=>{
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
    // side-on view, turned a little toward the front so the console shows; front (+z) faces screen-right
    const th=.42, dir=new THREE.Vector3(-Math.cos(th),.18,Math.sin(th)).normalize();
    const fb=new THREE.Box3().setFromObject(body), fc=fb.getCenter(new THREE.Vector3());
    camera.position.copy(fc).addScaledVector(dir,10); camera.lookAt(fc); camera.updateMatrixWorld(true);
    // fit the orthographic frustum to the model so its feet touch the bottom edge exactly
    const inv=camera.matrixWorldInverse, v=new THREE.Vector3(); let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    body.traverse(o=>{ if(!o.isMesh) return; const p=o.geometry.attributes.position; for(let i=0;i<p.count;i+=3){ v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y); } });
    const padX=(x1-x0)*.08, padTop=(y1-y0)*.06;
    camera.left=x0-padX; camera.right=x1+padX; camera.top=y1+padTop; camera.bottom=y0; camera.updateProjectionMatrix();
    aspect=(camera.right-camera.left)/(camera.top-camera.bottom);
    ready=true; measure(); el.classList.add('ready'); frame(0);
  },undefined,e=>console.warn('walker model failed',e));

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
  function frame(dt){
    if(!geo) return;
    const speed=Math.max(56,geo.W*.055);
    s+=dt*speed; phase+=dt*speed/(geo.h*.32);
    const [px,py,a]=at(s);
    // feet (bottom-centre of the element) on the border point, body leaning outward along the normal
    el.style.transform=`translate(${(px-geo.w/2).toFixed(2)}px,${(py-geo.h).toFixed(2)}px) rotate(${a.toFixed(4)}rad)`;
    if(ready){ const sw=Math.sin(phase)*.5; legs.forEach(l=>l.pv.rotation.x=sw*l.sign);
      body.position.y=Math.abs(Math.cos(phase))*.018; body.rotation.z=Math.sin(phase)*.03; renderer.render(scene,camera); }
  }
  el._seek=f=>{ if(geo) s=geo.total*f; };
  new ResizeObserver(measure).observe(card);
  let on=false, last=0;
  function tick(now){ if(!on) return; const dt=Math.min(.05,(now-(last||now))/1000); last=now; frame(REDUCED?0:dt); requestAnimationFrame(tick); }
  new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting&&!on){ on=true; last=0; requestAnimationFrame(tick); } else if(!e.isIntersecting) on=false; }),{rootMargin:'100px'}).observe(wrap);
})();
