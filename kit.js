// ============================================================================
// kit.js — Reusable 3D component factory ("professional component kit").
// Pure Three.js building blocks shared by every model's build() function.
// Exported as a factory fn so callers inject their own THREE + scene refs.
// ============================================================================
import * as THREE from 'three';

export function makeKit(scene, themeColors){
  const glowTex = (()=>{
    const k=document.createElement('canvas'); k.width=k.height=64;
    const x=k.getContext('2d'), g=x.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'#fff'); g.addColorStop(.35,'#fff8'); g.addColorStop(1,'#0000');
    x.fillStyle=g; x.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(k);
  })();

  const labelTex = (txt,w=256,h=72,fg='#bdf4ff',bg=null,fs=32)=>{
    const k=document.createElement('canvas'); k.width=w; k.height=h;
    const x=k.getContext('2d');
    if(bg){ x.fillStyle=bg; x.fillRect(0,0,w,h); }
    x.fillStyle=fg; x.font=`700 ${fs}px Arial`; x.textAlign='center'; x.textBaseline='middle';
    x.fillText(txt,w/2,h/2);
    const t=new THREE.CanvasTexture(k); t.anisotropy=4; return t;
  };

  const comps = []; // registry for raycasting / inspection
  const wires = []; // { curve, mat, sigFn, points(Float32Array), ... }
  const leds  = []; // { mesh, glow, color, on }
  const group = new THREE.Group(); scene.add(group);

  function M(color, o={}){ return new THREE.MeshStandardMaterial(Object.assign({color,roughness:.5,metalness:.3},o)); }
  function box(w,h,d,mat){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); }
  function cyl(r,h,mat,seg=16){ return new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),mat); }
  function sph(r,mat,seg=16){ return new THREE.Mesh(new THREE.SphereGeometry(r,seg,seg/2),mat); }

  function reg(obj,id,name,info,x,y,z,explodeDir=null){
    obj.position.set(x,y,z);
    obj.userData.comp={id,name,info};
    obj.userData.home=new THREE.Vector3(x,y,z);
    obj.userData.explode=explodeDir||new THREE.Vector3(0,0,0);
    group.add(obj); comps.push(obj);
    return obj;
  }

  // ---- PCB board -----------------------------------------------------------
  function board(w=12,d=7){
    const g=new THREE.Group();
    g.add(box(w,.28,d, M(0x0c2a36,{roughness:.65,metalness:.4})));
    const grid=new THREE.GridHelper(Math.max(w,d),Math.round(Math.max(w,d)*2),0x0d5570,0x0a3345);
    grid.position.y=.16; grid.scale.set(w/Math.max(w,d),1,d/Math.max(w,d)); g.add(grid);
    return reg(g,'board','Printed Circuit Board (PCB)','A fibreglass board with copper tracks connecting every component. Tracks carry current between chip pins — shown here as glowing wires.',0,-.3,0);
  }

  // ---- IC chip ---------------------------------------------------------
  function chip(id,name,label,info,x,z,opts={}){
    const w=opts.w||2.1, d=opts.d||1.1, pins=opts.pins||7;
    const g=new THREE.Group();
    g.add(box(w,.32,d, M(0x0e1319,{roughness:.75})));
    const notch=cyl(.09,.34,M(0x05070a),10); notch.rotation.z=Math.PI/2; notch.position.set(-w/2+.18,.02,0); g.add(notch);
    const pm=M(0xc9c9d2,{metalness:.9,roughness:.25});
    for(let i=0;i<pins;i++) for(const s of[-1,1]){
      const p=box(.13,.07,.22,pm); p.position.set(-w/2+.3+i*((w-.6)/(pins-1)),-.07,s*(d/2+.08)); g.add(p);
    }
    const l=new THREE.Mesh(new THREE.PlaneGeometry(w*.86,d*.5), new THREE.MeshBasicMaterial({map:labelTex(label,256,72,'#8fe6ff',null,34),transparent:true}));
    l.rotation.x=-Math.PI/2; l.position.y=.17; g.add(l);
    const body=g.children[0]; g.userData.bodyMat=body.material; g.userData.bodyBase=body.material.emissive?body.material.emissive.clone():new THREE.Color(0,0,0);
    return reg(g,id,name,info,x,.3,z,new THREE.Vector3(0,1.6,0));
  }

  // ---- resistor / capacitor ----------------------------------------------
  function resistor(bands=[0xff8c00,0xff8c00,0x8b4513]){
    const g=new THREE.Group(), r=Math.PI/2;
    const b=cyl(.09,.46,M(0xdcc094,{roughness:.8}),12); b.rotation.z=r; g.add(b);
    bands.forEach((c,i)=>{ const k=cyl(.095,.05,M(c),12); k.rotation.z=r; k.position.x=-.14+i*.12; g.add(k); });
    const lead=cyl(.013,.85,M(0xcccccc,{metalness:1}),6); lead.rotation.z=r; g.add(lead);
    return g;
  }

  // ---- LED -----------------------------------------------------------------
  function led(id,name,info,x,z,color,opts={}){
    const g=new THREE.Group();
    const m=M(0x0a1e24,{emissive:color,emissiveIntensity:.03,transparent:true,opacity:.92,roughness:.2});
    const b=cyl(.2,.26,m,18); b.position.y=.13;
    const d=sph(.19,m,18); d.position.y=.26;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color,blending:THREE.AdditiveBlending,depthWrite:false}));
    s.scale.set(1.7,1.7,1); s.position.y=.4; s.visible=false; s.raycast=()=>{};
    g.add(b,d,s);
    reg(g,id,name,info,x,opts.y||0,z);
    const o={m,s,color,on:false,
      set(v){ this.on=!!v; },
    };
    leds.push(o);
    return o;
  }

  // ---- toggle switch (3D, visual only — state driven externally) ---------
  function toggleSwitch(id,name,info,x,z){
    const g=new THREE.Group();
    g.add(box(.5,.12,.34,M(0x1a2733)));
    const lever=cyl(.045,.4,M(0xd7dde3,{metalness:.7,roughness:.3}),10);
    lever.position.y=.2; g.add(lever);
    reg(g,id,name,info,x,0,z);
    return { group:g, lever, setOn(on){ lever.rotation.z = on? .55 : -.55; lever.position.x = on? .1:-.1; } };
  }

  // ---- push button ---------------------------------------------------------
  function pushButton(id,name,info,x,z){
    const g=new THREE.Group();
    g.add(box(.5,.14,.5,M(0x20262e)));
    const cap=cyl(.19,.12,M(0xff3355,{emissive:0x330010}),16); cap.position.y=.13; g.add(cap);
    reg(g,id,name,info,x,0,z);
    return { group:g, cap };
  }

  // ---- wire (glowing tube + flowing current particles) ---------------------
  function wire(points, sigFn, opts={}){
    const y=opts.y??.08;
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],y,p[1])),false,'centripetal');
    const mat=M(0x0b3747,{emissive:0x12b8d8,emissiveIntensity:.1,roughness:.4});
    const tube=new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8,points.length*10), .035, 6), mat);
    group.add(tube);
    const N=5, pos=new Float32Array(N*3), g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const pts=new THREE.Points(g, new THREE.PointsMaterial({size:.22,map:glowTex,color:0xaef6ff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    pts.frustumCulled=false; group.add(pts);
    const w={curve, mat, tube, pts, sigFn, u:Array.from({length:N},(_,i)=>i/N), N, speed:opts.speed||.4};
    wires.push(w);
    return w;
  }

  // ---- seven-segment display -----------------------------------------------
  function sevenSeg(id,name,info,x,z,scale=1){
    const segs={}, seg=new THREE.Group();
    seg.add(box(1.5*scale,2.3*scale,.42*scale, M(0x060a0e,{roughness:.6})));
    const H=[.82*scale,.16*scale,.07*scale], V=[.16*scale,.74*scale,.07*scale];
    const P={a:[0,.82*scale,H],g:[0,0,H],d:[0,-.82*scale,H],
      f:[-.5*scale,.42*scale,V],b:[.5*scale,.42*scale,V],e:[-.5*scale,-.42*scale,V],c:[.5*scale,-.42*scale,V]};
    for(const k in P){ const m=M(0x0a2a1c,{emissive:0x39ff9c,emissiveIntensity:0,roughness:.3});
      const s=box(...P[k][2],m); s.position.set(P[k][0],P[k][1],.23*scale); seg.add(s); segs[k]=m; }
    reg(seg,id,name,info,x,1.1*scale,z);
    return { group:seg, segs, setDigit(code){ for(const k in segs) segs[k].emissiveIntensity = (code&&code.includes(k))?2.4:0; } };
  }

  // ---- memory cell (small glowing cube for RAM/ROM grid) -------------------
  function memCell(id,x,y,z){
    const m=M(0x0b2534,{emissive:0x1fd1ff,emissiveIntensity:.08,roughness:.4});
    const c=box(.46,.46,.46,m);
    reg(c,id,'Memory Cell','One addressable storage location.',x,y,z);
    return { mesh:c, mat:m };
  }

  function dispose(){
    group.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); }); } });
    scene.remove(group); comps.length=0; wires.length=0; leds.length=0;
  }

  return { group, comps, wires, leds, M, box, cyl, sph, board, chip, resistor, led, toggleSwitch, pushButton, wire, sevenSeg, memCell, labelTex, glowTex, dispose };
}
