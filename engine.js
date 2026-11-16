// ============================================================================
// engine.js — Application shell: theme, camera, dashboard/library, simulation
// loop and UI wiring. Imports pure logic from models.js and 3D construction
// from kit.js / builds.js, keeping rendering, simulation and UI separated.
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MODELS, CATEGORIES, byId, allBits, SEG } from './models.js';
import { makeKit } from './kit.js';
import { buildModel } from './builds.js';

const $ = id => document.getElementById(id);
// Storage can be blocked in private browsing, file:// contexts, or strict privacy modes.
const storage = {
  get(key, fallback=null){ try { const value=localStorage.getItem(key); return value===null?fallback:value; } catch { return fallback; } },
  set(key, value){ try { localStorage.setItem(key, value); return true; } catch { return false; } }
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Combinational models (built via the comb() helper in models.js) declare
// `inputs` as plain string names, e.g. ['A','B']. Sequential/memory/misc
// models declare richer {id,type,label,...} descriptor objects. Normalize
// every input to the descriptor shape so the dynamic UI builder and the
// simulation-state initializer only ever deal with one format.
function normInputs(m){
  return (m.inputs||[]).map(inp => typeof inp === 'string' ? {id:inp, type:'switch', label:inp} : inp);
}

// ---------------------------------------------------------------------------
// THEME
// ---------------------------------------------------------------------------
const savedTheme = storage.get('digilab_theme', 'light') === 'dark' ? 'dark' : 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
$('themeBtn').textContent = savedTheme === 'dark' ? '🌙' : '☀️';
$('themeBtn').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  storage.set('digilab_theme', next);
  $('themeBtn').textContent = next === 'dark' ? '🌙' : '☀️';
  applyBackgroundColor();
};

// ---------------------------------------------------------------------------
// THREE.JS SCENE / CAMERA
// ---------------------------------------------------------------------------
const wrap = $('canvasWrap'), canvas = $('scene');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
} catch (err) {
  console.error('WebGL initialization failed:', err);
  $('loadingMsg').textContent = '3D view is unavailable in this browser/device. Enable WebGL or try another browser.';
  $('loading').classList.remove('hide');
}
const scene = new THREE.Scene();
function applyBackgroundColor(){
  const light = document.documentElement.getAttribute('data-theme')==='light';
  scene.background = new THREE.Color(light ? 0xdfe9f3 : 0x060b14);
  scene.fog = new THREE.Fog(scene.background.getHex(), 22, 55);
}
applyBackgroundColor();
const camera = new THREE.PerspectiveCamera(42, 1, .1, 120);
camera.position.set(9,7,11);

scene.add(new THREE.AmbientLight(0x6a86a8, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(6,12,8); key.castShadow=true;
key.shadow.mapSize.set(1024,1024);
scene.add(key);
const rim1 = new THREE.PointLight(0x36e2ff, .8, 30); rim1.position.set(-8,5,-4); scene.add(rim1);
const rim2 = new THREE.PointLight(0x5b8cff, .8, 30); rim2.position.set(8,5,-4); scene.add(rim2);
const floorGrid = new THREE.GridHelper(40,40,0x184865,0x0c2638); floorGrid.position.y=-.9; scene.add(floorGrid);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.minDistance = 3.5; controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI*.49;
controls.target.set(0,0,0);
const HOME = {pos:new THREE.Vector3(9,7,11), target:new THREE.Vector3(0,0,0)};

function resize(){
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  if (renderer) renderer.setSize(w,h,false);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
if ('ResizeObserver' in window) new ResizeObserver(resize).observe(wrap);
else window.addEventListener('resize', resize, {passive:true});
resize();

function flyTo(pos,target){
  flyGoal.pos.copy(pos); flyGoal.target.copy(target); flying=true;
}
const flyGoal = {pos:new THREE.Vector3(), target:new THREE.Vector3()};
let flying=false;

$('btnReset').onclick = ()=>flyTo(HOME.pos, HOME.target);
$('btnIso').onclick = ()=>flyTo(new THREE.Vector3(9,7,11), new THREE.Vector3(0,0,0));
$('btnFront').onclick = ()=>flyTo(new THREE.Vector3(0,2,13), new THREE.Vector3(0,0,0));
$('btnTop').onclick = ()=>flyTo(new THREE.Vector3(0.01,15,0.01), new THREE.Vector3(0,0,0));
let autoOn=false;
$('btnAuto').onclick = (e)=>{ autoOn=!autoOn; controls.autoRotate=autoOn; e.target.classList.toggle('on',autoOn); };
let wireOn=false;
$('btnWire').onclick = (e)=>{ wireOn=!wireOn; e.target.classList.toggle('on',wireOn); setWireframe(wireOn); };
let explodeOn=false;
$('btnExplode').onclick = (e)=>{ explodeOn=!explodeOn; e.target.classList.toggle('on',explodeOn); };
$('fsBtn').onclick = ()=>{ if(!document.fullscreenElement) wrap.requestFullscreen?.(); else document.exitFullscreen?.(); };

function setWireframe(on){
  if(!kit) return;
  kit.group.traverse(o=>{ if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if('wireframe' in m) m.wireframe = on; }); } });
}

// ---------------------------------------------------------------------------
// SELECTION / INSPECTION (raycasting)
// ---------------------------------------------------------------------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let selMesh=null, boxHelper=null;
function hitTest(e){
  if(!kit) return null;
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(kit.comps, true);
  if(!hits.length) return null;
  let o = hits[0].object; while(o && !o.userData.comp) o = o.parent; return o;
}
let downPt=null;
canvas.addEventListener('pointerdown', e=>{ downPt={x:e.clientX,y:e.clientY}; });
canvas.addEventListener('pointerup', e=>{
  if(downPt && Math.hypot(e.clientX-downPt.x, e.clientY-downPt.y) < 5){
    const o = hitTest(e);
    if(o) selectPart(o);
  }
  downPt=null;
});
canvas.addEventListener('pointermove', e=>{
  if(e.pointerType==='touch') return;
  canvas.style.cursor = hitTest(e) ? 'pointer' : 'grab';
});
const tagEl = $('tag');
function selectPart(o){
  selMesh = o;
  if(boxHelper) scene.remove(boxHelper);
  boxHelper = new THREE.BoxHelper(o, 0x36e2ff); scene.add(boxHelper);
  const c = o.userData.comp;
  tagEl.textContent = c.name; tagEl.style.display='block';
  $('partInfo').innerHTML = `<h4 style="color:var(--accent);margin:8px 0 4px">${c.name}</h4><p style="font-size:12.5px;color:var(--muted);margin:0">${c.info}</p>`;
  setTab('info');
}

// ---------------------------------------------------------------------------
// LIBRARY / SEARCH / FILTER / RECENTLY VIEWED
// ---------------------------------------------------------------------------
let activeFilter = 'all';
let currentModel = null;
let recent = [];
try { const parsed = JSON.parse(storage.get('digilab_recent', '[]')); if (Array.isArray(parsed)) recent = parsed.filter(id => typeof id === 'string' && byId(id)).slice(0,8); } catch { recent = []; }

$('statCount').textContent = MODELS.length;
$('statCat').textContent = CATEGORIES.length;

function renderCatChips(){
  const wrap = $('catChips'); wrap.innerHTML='';
  const allChip = document.createElement('div'); allChip.className='filterchip'+(activeFilter==='all'?' on':''); allChip.textContent='All';
  allChip.onclick=()=>{ activeFilter='all'; renderCatChips(); renderLibrary($('search').value); };
  wrap.appendChild(allChip);
  CATEGORIES.forEach(c=>{
    const el=document.createElement('div'); el.className='filterchip'+(activeFilter===c.id?' on':'');
    el.textContent=c.icon+' '+c.name.split(' ')[0];
    el.onclick=()=>{ activeFilter=c.id; renderCatChips(); renderLibrary($('search').value); };
    wrap.appendChild(el);
  });
}
function diffColor(d){ return d==='Advanced'?'var(--bad)':d==='Intermediate'?'var(--warn)':'var(--good)'; }
function diffLevel(d){ return d==='Advanced'?3:d==='Intermediate'?2:1; }
function diffTicks(d){
  const lvl=diffLevel(d), col=diffColor(d);
  let html='';
  for(let i=1;i<=3;i++) html+=`<i class="${i<=lvl?'lit':''}" style="${i<=lvl?`background:${col};box-shadow:0 0 6px ${col}`:''}"></i>`;
  return html;
}

function renderLibrary(filter=''){
  const lib = $('library'); lib.innerHTML='';
  const f = filter.toLowerCase();
  let any=false;
  CATEGORIES.forEach(cat=>{
    if(activeFilter!=='all' && activeFilter!==cat.id) return;
    const models = MODELS.filter(m=>m.cat===cat.id && m.name.toLowerCase().includes(f));
    if(!models.length) return;
    any=true;
    const g = document.createElement('div'); g.className='catgroup';
    g.innerHTML = `<div class="cat-h"><span class="dot"></span>${cat.icon} ${cat.name}</div>`;
    models.forEach(m=>{
      const b=document.createElement('button'); b.className='model-btn'+(currentModel&&currentModel.id===m.id?' active':'');
      b.innerHTML = `<span class="ic">${m.icon}</span><span class="nm">${m.name}</span><span class="diff">${diffTicks(m.diff)}</span>`;
      b.onclick=()=>{ selectModel(m.id); if(innerWidth<=980) closeSidebar(); };
      g.appendChild(b);
    });
    lib.appendChild(g);
  });
  if(!any) lib.innerHTML = `<div class="empty-lib">No models match “${filter}”.</div>`;
}
$('search').addEventListener('input', e=>renderLibrary(e.target.value));

function renderRecent(){
  const wrap=$('recentWrap'), row=$('recentRow');
  if(!recent.length){ wrap.style.display='none'; return; }
  wrap.style.display='block'; row.innerHTML='';
  recent.slice(0,8).forEach(id=>{
    const m=byId(id); if(!m) return;
    const p=document.createElement('div'); p.className='recent-pill'; p.textContent=m.icon+' '+m.name;
    p.onclick=()=>selectModel(id);
    row.appendChild(p);
  });
}
function pushRecent(id){
  recent = [id, ...recent.filter(x=>x!==id)].slice(0,8);
  storage.set('digilab_recent', JSON.stringify(recent));
  renderRecent();
}

// mobile sidebar
$('menuBtn').style.display = innerWidth<=980 ? 'grid' : 'none';
addEventListener('resize', ()=>{ $('menuBtn').style.display = innerWidth<=980 ? 'grid' : 'none'; });
$('menuBtn').onclick = ()=>{ $('sidebar').classList.add('open'); $('scrim').classList.add('show'); };
function closeSidebar(){ $('sidebar').classList.remove('open'); $('scrim').classList.remove('show'); }
$('scrim').onclick = closeSidebar;

// ---------------------------------------------------------------------------
// TABS
// ---------------------------------------------------------------------------
function setTab(t){
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.t===t));
  document.querySelectorAll('.sec').forEach(s=>s.classList.toggle('on', s.id==='sec-'+t));
}
$('tabs').addEventListener('click', e=>{ if(e.target.dataset.t) setTab(e.target.dataset.t); });

// ---------------------------------------------------------------------------
// SIMULATION STATE  (per selected model)
// ---------------------------------------------------------------------------
let kit=null, state=null, inputValues={}, clockTimer=null;

function clearClock(){ if(clockTimer){ clearInterval(clockTimer); clockTimer=null; } }

function freshState(){
  return { values:{}, switches3d:{}, leds3d:{}, clockBtn:null, pulseGlow:0,
           sevenSeg:null, clockDigits:null, memCells:null, cpuBlocks:null, pcDisplay:null };
}

function selectModel(id){
  const m = byId(id); if(!m) return;
  clearClock();
  currentModel = m;
  pushRecent(id);
  $('loading').classList.remove('hide'); $('loadingMsg').textContent = 'Building '+m.name+'…';

  if(kit) kit.dispose();
  kit = makeKit(scene);
  state = freshState();
  inputValues = {};
  normInputs(m).forEach(inp=>{
    if(inp.type==='switch') inputValues[inp.id]=0;
    else if(inp.type==='hex4') inputValues[inp.id]=0;
    else if(inp.type==='cycle') inputValues[inp.id]=inp.options[0];
  });
  if(m.sim && m.sim.reset) m.sim.reset();

  requestAnimationFrame(()=>{
    try{ buildModel(kit, state, m); }catch(err){ console.error('Build error for',id,err); }
    recompute(true);
    renderHeader(m); renderControlsPanel(m); renderTruthTab(m); renderTheoryTab(m); renderBottom(m);
    renderLibrary($('search').value);
    boxHelper && scene.remove(boxHelper); boxHelper=null; tagEl.style.display='none';
    setTab('controls');
    setWireframe(wireOn);
    $('loading').classList.add('hide');
  });
}

// ---- HEADER -----------------------------------------------------------
function renderHeader(m){
  const cat = CATEGORIES.find(c=>c.id===m.cat);
  $('crumb').textContent = cat.name;
  $('modelName').textContent = m.name;
  $('modelDesc').textContent = m.desc;
  $('diffBadge').textContent = m.diff;
  $('diffBadge').style.color = diffColor(m.diff);
  $('vpTitle').textContent = m.name;
}
function renderBottom(m){
  $('objective').textContent = m.objective;
  $('apps').innerHTML = (m.apps||[]).map(a=>`<div>${a}</div>`).join('');
}
function renderTheoryTab(m){ $('sec-theory').innerHTML = m.theory; }

// ---- RECOMPUTE: combinational / sequential / memory / misc -------------
function recompute(initial){
  const m = currentModel; if(!m) return;
  if(m.kind==='comb'){
    const args = m.inputs.map(id=>inputValues[id]);
    const res = m.compute(...args);
    m.inputs.forEach(id=>state.values[id]=inputValues[id]);
    m.outputs.forEach((o,i)=>state.values[o]=res[i]);
  } else if(m.id==='sr-latch'){
    const r = m.sim.step(inputValues);
    Object.assign(state.values, r, inputValues);
  } else if(m.id==='ram'){
    const r = m.sim.step(inputValues, false);
    Object.assign(state.values, r, inputValues);
    updateMemCells(m);
  } else if(m.id==='rom'){
    const r = m.sim.step(inputValues);
    Object.assign(state.values, r, inputValues);
    updateMemCells(m);
  } else if(m.id==='seven-seg'){
    const r = m.sim.step(inputValues);
    Object.assign(state.values, r, inputValues);
    state.sevenSeg && state.sevenSeg.setDigit(r.segs);
  } else if(m.id==='alu'){
    const r = m.sim.step(inputValues);
    Object.assign(state.values, r, inputValues);
    for(let i=0;i<4;i++){ state.values['a'+i]=(inputValues.A>>(3-i))&1; state.values['b'+i]=(inputValues.B>>(3-i))&1; state.values['r'+i]=(r.result>>(3-i))&1; }
    state.values.flagZero=r.zero; state.values.flagCarry=r.carry; state.values.flagNeg=r.neg;
  } else if(m.id==='digital-clock'){
    Object.assign(state.values, m.sim); // h,m,s already on sim
    updateClockDigits();
  } else if(m.id==='cpu'){
    Object.assign(state.values, {phase:m.sim.phases[m.sim.phase], pc:m.sim.pc});
    updateCpuVisual();
  } else {
    // jk-ff, d-ff, t-ff, binary-counter, shift-register: driven only by tick()/pulse; just sync switches
    m.inputs.filter(i=>i.type==='switch').forEach(i=>state.values[i.id]=inputValues[i.id]);
    if(m.id==='binary-counter' && initial){ state.values.n=0; [0,1,2,3].forEach(i=>state.values['Q'+i]=0); if(state.sevenSeg) state.sevenSeg.setDigit(SEG['0']); }
  }
  refreshIOPanel(m);
  refreshTruthHighlight(m);
}

function tick(){
  const m = currentModel; if(!m) return;
  state.pulseGlow = .35;
  if(m.id==='binary-counter'){ const r=m.sim.step(); Object.assign(state.values,r); updateCounterDisplay(r); }
  else if(m.id==='shift-register'){ const r=m.sim.step(inputValues); Object.assign(state.values,r,inputValues); }
  else if(m.id==='digital-clock'){ const r=m.sim.step(); Object.assign(state.values,r); updateClockDigits(); }
  else if(m.id==='cpu'){ const r=m.sim.step(); Object.assign(state.values,r); updateCpuVisual(); }
  else if(m.sim && m.sim.step){ const r=m.sim.step(inputValues); Object.assign(state.values,r,inputValues); }
  refreshIOPanel(m); refreshTruthHighlight(m);
}

function updateCounterDisplay(r){
  if(state.sevenSeg) state.sevenSeg.setDigit(SEG[r.n.toString(16).toUpperCase()]);
}
function updateClockDigits(){
  if(!state.clockDigits) return;
  const m=currentModel.sim;
  const hh=String(m.h).padStart(2,'0'), mm=String(m.m).padStart(2,'0'), ss=String(m.s).padStart(2,'0');
  const chars=(hh+mm+ss).split('');
  state.clockDigits.forEach((d,i)=> d.setDigit(SEG[chars[i]]));
}
function updateMemCells(m){
  if(!state.memCells) return;
  const mem = m.sim.mem, addr = inputValues.ADDR||0;
  state.memCells.forEach((c,i)=>{
    const v = mem[i];
    c.mat.emissiveIntensity = (i===addr) ? 2.6 : (v>0 ? .5+v*.09 : .07);
    c.mat.emissive.set(i===addr ? 0xff9a3c : 0x1fd1ff);
  });
}
function updateCpuVisual(){
  if(!state.cpuBlocks) return;
  const phase = currentModel.sim.phases[currentModel.sim.phase];
  const active = {FETCH:['cu','mem'], DECODE:['cu'], EXECUTE:['alu'], 'WRITE-BACK':['alu','reg']}[phase]||[];
  Object.entries(state.cpuBlocks).forEach(([k,chipGroup])=>{
    const mat = chipGroup.userData.bodyMat;
    mat.emissive.set(0x36e2ff); mat.emissiveIntensity = active.includes(k) ? 1.4 : 0;
  });
  if(state.pcDisplay) state.pcDisplay.setDigit(SEG[currentModel.sim.pc.toString(16).toUpperCase()]);
}

// ---------------------------------------------------------------------------
// CONTROLS PANEL (dynamic per model)
// ---------------------------------------------------------------------------
function renderControlsPanel(m){
  const io = $('ioArea'); io.innerHTML='';
  const metricRow = $('metricRow'); metricRow.innerHTML='';
  const convo = $('convo');

  // ---- input controls ----
  const inputsWrap = document.createElement('div'); inputsWrap.className='iorow';
  normInputs(m).forEach(inp=>{
    if(inp.type==='switch'){
      inputsWrap.appendChild(makeSwitchUI(inp));
    } else if(inp.type==='hex4'){
      inputsWrap.appendChild(makeHexUI(inp));
    } else if(inp.type==='cycle'){
      inputsWrap.appendChild(makeCycleUI(inp));
    } else if(inp.type==='clock'){
      inputsWrap.appendChild(makeClockUI(inp));
    } else if(inp.type==='pulse'){
      inputsWrap.appendChild(inp.free ? makeClockUI(inp) : makePulseUI(inp));
    }
  });
  if(inputsWrap.children.length) io.appendChild(sectionLabel('Inputs'));
  io.appendChild(inputsWrap);

  // ---- outputs ----
  io.appendChild(sectionLabel('Live Outputs'));
  const ledrow = document.createElement('div'); ledrow.className='ledrow'; ledrow.id='ledrow';
  io.appendChild(ledrow);

  if(m.id==='seven-seg' || m.id==='digital-clock'){
    const sw = document.createElement('div'); sw.className='sevenwrap'; sw.id='sevenwrap';
    io.appendChild(sw);
  }
  if(m.id==='ram'){
    const note=document.createElement('div'); note.className='convo'; note.innerHTML='<b>Tip:</b> set Address &amp; Data, click Write, then change Address to a different cell and back to see the value persisted — real read/write storage.';
    io.appendChild(note);
  }
  if(m.id==='cpu'){
    const note=document.createElement('div'); note.className='convo'; note.id='cpuPhaseNote';
    io.appendChild(note);
  }

  refreshIOPanel(m);
}
function sectionLabel(t){ const d=document.createElement('div'); d.className='sec-label'; d.textContent=t; d.style.marginTop='2px'; return d; }

function makeSwitchUI(inp){
  const g=document.createElement('div'); g.className='swgroup';
  const lab=document.createElement('div'); lab.className='swlabel'; lab.textContent=inp.label||inp.id;
  const sw=document.createElement('div'); sw.className='sw'; sw.setAttribute('role','switch'); sw.tabIndex=0;
  sw.innerHTML='<i></i>';
  const toggle=()=>{ inputValues[inp.id]=inputValues[inp.id]?0:1; sw.classList.toggle('on', !!inputValues[inp.id]);
    sw.setAttribute('aria-checked', String(!!inputValues[inp.id]));
    if(state.switches3d[inp.id]) state.switches3d[inp.id].setOn(!!inputValues[inp.id]);
    recompute(); };
  sw.setAttribute('aria-label', inp.label || inp.id);
  sw.setAttribute('aria-checked', 'false');
  sw.onclick=toggle; sw.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } };
  g.appendChild(sw); g.appendChild(lab);
  return g;
}
function makeHexUI(inp){
  const g=document.createElement('div'); g.className='swgroup';
  const lab=document.createElement('div'); lab.className='swlabel'; lab.textContent=inp.label||inp.id;
  const ctl=document.createElement('div'); ctl.className='spin-ctl';
  const minus=document.createElement('button'); minus.textContent='−';
  const val=document.createElement('b'); val.textContent='0x0';
  const plus=document.createElement('button'); plus.textContent='+';
  const set=v=>{ inputValues[inp.id]=((v%16)+16)%16; val.textContent='0x'+inputValues[inp.id].toString(16).toUpperCase(); recompute(); };
  minus.onclick=()=>set((inputValues[inp.id]||0)-1);
  plus.onclick=()=>set((inputValues[inp.id]||0)+1);
  ctl.append(minus,val,plus); g.append(ctl,lab);
  set(inputValues[inp.id]||0);
  return g;
}
function makeCycleUI(inp){
  const g=document.createElement('div'); g.className='swgroup';
  const lab=document.createElement('div'); lab.className='swlabel'; lab.textContent=inp.label||inp.id;
  const btn=document.createElement('button'); btn.className='ctlbtn primary';
  btn.textContent=inputValues[inp.id];
  btn.onclick=()=>{ const idx=inp.options.indexOf(inputValues[inp.id]); inputValues[inp.id]=inp.options[(idx+1)%inp.options.length]; btn.textContent=inputValues[inp.id]; recompute(); };
  g.append(btn,lab);
  return g;
}
function makePulseUI(inp){
  const g=document.createElement('div'); g.className='swgroup';
  const lab=document.createElement('div'); lab.className='swlabel'; lab.textContent=inp.label||inp.id;
  const btn=document.createElement('button'); btn.className='ctlbtn primary'; btn.textContent='⚡ '+(inp.label||'Pulse');
  btn.onclick=()=>{
    if(currentModel.id==='ram'){ const r=currentModel.sim.step(inputValues,true); Object.assign(state.values,r,inputValues); updateMemCells(currentModel); refreshIOPanel(currentModel); state.pulseGlow=.4; }
    else tick();
  };
  g.append(btn,lab);
  if(currentModel.id==='ram'){
    const clear=document.createElement('button');
    clear.className='ctlbtn'; clear.textContent='↺ Clear RAM';
    clear.setAttribute('aria-label','Clear all RAM cells');
    clear.onclick=()=>{
      currentModel.sim.reset();
      const r=currentModel.sim.step(inputValues,false);
      Object.assign(state.values,r,inputValues);
      updateMemCells(currentModel);
      refreshIOPanel(currentModel);
    };
    g.appendChild(clear);
  }
  return g;
}
function makeClockUI(inp){
  const g=document.createElement('div'); g.style.display='flex'; g.style.flexDirection='column'; g.style.gap='8px'; g.style.width='100%';
  const row=document.createElement('div'); row.className='btnrow';
  const pulse=document.createElement('button'); pulse.className='ctlbtn primary'; pulse.textContent='⚡ '+(inp.label? 'Advance':'Pulse');
  pulse.onclick=()=>tick();
  const start=document.createElement('button'); start.className='ctlbtn'; start.textContent='▶ Start';
  const stop=document.createElement('button'); stop.className='ctlbtn'; stop.textContent='■ Stop';
  const reset=document.createElement('button'); reset.className='ctlbtn'; reset.textContent='↺ Reset';
  row.append(pulse,start,stop,reset);
  const rw=document.createElement('div'); rw.className='rangewrap';
  rw.innerHTML=`<div class="rw-top"><span>Clock speed</span><span id="hzLabel">2 Hz</span></div>`;
  const range=document.createElement('input'); range.type='range'; range.min='0.5'; range.max='10'; range.step='0.5'; range.value='2';
  rw.appendChild(range);
  let hz=2;
  range.oninput=()=>{ hz=+range.value; rw.querySelector('#hzLabel').textContent=hz+' Hz'; if(clockTimer) restartTimer(); };
  start.onclick=()=>{ clearClock(); restartTimer(); start.classList.add('on'); };
  stop.onclick=()=>{ clearClock(); start.classList.remove('on'); };
  reset.onclick=()=>{
    clearClock(); start.classList.remove('on'); state.pulseGlow=0;
    if(currentModel.sim && currentModel.sim.reset) currentModel.sim.reset();
    if(currentModel.id==='binary-counter'){ state.values.n=0; [0,1,2,3].forEach(i=>state.values['Q'+i]=0); state.sevenSeg&&state.sevenSeg.setDigit(SEG['0']); }
    else if(currentModel.id==='digital-clock'){ updateClockDigits(); }
    else if(currentModel.id==='cpu'){ updateCpuVisual(); }
    else if(['sr-latch','jk-ff','d-ff','t-ff'].includes(currentModel.id)){ state.values.Q=0; state.values.Qbar=1; state.values.invalid=false; }
    else if(currentModel.id==='shift-register'){ [0,1,2,3].forEach(i=>state.values['Q'+i]=0); }
    refreshIOPanel(currentModel); refreshTruthHighlight(currentModel);
  };
  function restartTimer(){ clockTimer=setInterval(tick, 1000/hz); }
  g.append(row,rw);
  return g;
}

function refreshIOPanel(m){
  // output LEDs
  const row = $('ledrow'); if(row){
    row.innerHTML='';
    (m.outputs||[]).forEach(o=>{
      const v = state.values[o];
      const chip=document.createElement('div'); chip.className='ledchip';
      chip.innerHTML=`<div class="dot good${v?' on':''}"></div><small>${o}</small>`;
      row.appendChild(chip);
    });
    if(m.id==='sr-latch'){
      const chip=document.createElement('div'); chip.className='ledchip';
      chip.innerHTML=`<div class="dot bad${state.values.invalid?' on':''}"></div><small>INVALID</small>`;
      row.appendChild(chip);
    }
    if(m.id==='alu'){
      ['zero','carry','neg'].forEach(f=>{
        const chip=document.createElement('div'); chip.className='ledchip';
        chip.innerHTML=`<div class="dot warn${state.values[f]?' on':''}"></div><small>${f.toUpperCase()}</small>`;
        row.appendChild(chip);
      });
    }
  }
  // 3D LED sync
  Object.entries(state.leds3d).forEach(([k,led])=> led.set(!!state.values[k]));
  if(state.leds3d.Q) state.leds3d.Q.set(!!state.values.Q);
  if(m.id==='sr-latch' && state.leds3d.invalid) state.leds3d.invalid.set(!!state.values.invalid);
  if(m.id==='alu'){
    if(state.leds3d.flagZero) state.leds3d.flagZero.set(!!state.values.flagZero);
    if(state.leds3d.flagCarry) state.leds3d.flagCarry.set(!!state.values.flagCarry);
    if(state.leds3d.flagNeg) state.leds3d.flagNeg.set(!!state.values.flagNeg);
  }

  // metric row + convo per kind
  const metricRow=$('metricRow'); metricRow.innerHTML=''; const convo=$('convo');
  function metric(label,val){ const d=document.createElement('div'); d.className='metric'; d.innerHTML=`<small>${label}</small><b>${val}</b>`; metricRow.appendChild(d); }

  if(m.kind==='comb'){
    metric('Inputs', m.inputs.length);
    metric('Truth rows', 1<<m.inputs.length);
    convo.innerHTML = m.inputs.map(i=>`${i}=<b>${state.values[i]}</b>`).join(' &nbsp;·&nbsp; ') + ' &nbsp;→&nbsp; ' + m.outputs.map(o=>`${o}=<b>${state.values[o]}</b>`).join(', ');
  } else if(['sr-latch','jk-ff','d-ff','t-ff'].includes(m.id)){
    metric('Q', state.values.Q ?? 0);
    metric('State', state.values.invalid? 'INVALID' : (state.values.Q? 'SET':'RESET'));
    convo.innerHTML = m.id==='sr-latch' ? `S=<b>${inputValues.S||0}</b>, R=<b>${inputValues.R||0}</b> → Q=<b>${state.values.Q||0}</b>${state.values.invalid?' <b style="color:var(--bad)">(forbidden state)</b>':''}`
      : `Press Pulse to apply a clock edge. Current Q=<b>${state.values.Q||0}</b>.`;
  } else if(m.id==='binary-counter'){
    const n=state.values.n ?? currentModel.sim.n;
    metric('Decimal', n); metric('Hex', '0x'+n.toString(16).toUpperCase());
    convo.innerHTML = `Binary (Q3Q2Q1Q0) = <b>${[3,2,1,0].map(i=>state.values['Q'+i]||0).join('')}</b> &nbsp;·&nbsp; 8·${state.values.Q3||0} + 4·${state.values.Q2||0} + 2·${state.values.Q1||0} + ${state.values.Q0||0} = <b>${n}</b>`;
  } else if(m.id==='shift-register'){
    const bits=[0,1,2,3].map(i=>state.values['Q'+i]||0);
    metric('Register', bits.join('')); metric('Serial out (Q3)', bits[3]);
    convo.innerHTML = `Serial-In=<b>${inputValues.SIN||0}</b> shifts into Q0 each pulse; bits move right toward Q3.`;
  } else if(m.id==='seven-seg'){
    metric('Hex digit', '0x'+(inputValues.DIGIT||0).toString(16).toUpperCase());
    metric('Segments lit', (state.values.segs||'').length);
    convo.innerHTML = `Digit <b>${(inputValues.DIGIT||0).toString(16).toUpperCase()}</b> lights segments <b>${(state.values.segs||'').toUpperCase().split('').join(', ')}</b>`;
    renderSevenWrap([state.values.hex||'0']);
  } else if(m.id==='digital-clock'){
    const s=currentModel.sim;
    metric('Time', `${String(s.h).padStart(2,'0')}:${String(s.m).padStart(2,'0')}:${String(s.s).padStart(2,'0')}`);
    metric('Seconds elapsed', s.h*3600+s.m*60+s.s);
    convo.innerHTML = 'Seconds roll 0-59 then carry into minutes; minutes roll 0-59 then carry into hours (mod 24) — just like a hardware RTC.';
    renderSevenWrap([String(s.h).padStart(2,'0')[0],String(s.h).padStart(2,'0')[1],':',String(s.m).padStart(2,'0')[0],String(s.m).padStart(2,'0')[1],':',String(s.s).padStart(2,'0')[0],String(s.s).padStart(2,'0')[1]]);
  } else if(m.id==='ram' || m.id==='rom'){
    metric('Address', '0x'+(inputValues.ADDR||0).toString(16).toUpperCase());
    metric('Data out', '0x'+(state.values.dataOut||0).toString(16).toUpperCase());
    convo.innerHTML = m.id==='ram' ? `Reading cell <b>${inputValues.ADDR||0}</b> continuously. Last written value shown on Data-Out.` : `ROM is pre-programmed: output = (address²) mod 16.`;
  } else if(m.id==='alu'){
    metric('Result', '0x'+(state.values.result||0).toString(16).toUpperCase());
    metric('Operation', inputValues.OP);
    convo.innerHTML = `A=<b>0x${(inputValues.A||0).toString(16).toUpperCase()}</b> ${inputValues.OP} B=<b>0x${(inputValues.B||0).toString(16).toUpperCase()}</b> = <b>0x${(state.values.result||0).toString(16).toUpperCase()}</b>`;
  } else if(m.id==='cpu'){
    const s=currentModel.sim;
    metric('Phase', s.phases[s.phase]); metric('Program Counter', '0x'+s.pc.toString(16).toUpperCase());
    convo.innerHTML = {FETCH:'Control Unit reads the next instruction from Memory at the address in the PC.',
      DECODE:'Control Unit interprets the opcode and prepares operands.',
      EXECUTE:'The ALU performs the operation using the Registers.',
      'WRITE-BACK':'The result is written back and the Program Counter advances.'}[s.phases[s.phase]];
    const note=$('cpuPhaseNote'); if(note) note.textContent = 'This is a conceptual model of the universal fetch-decode-execute cycle, not a full instruction-set simulator.';
  }
}
function renderSevenWrap(chars){
  const sw=$('sevenwrap'); if(!sw) return;
  sw.innerHTML = chars.map(c=>`<div class="digitface">${c}</div>`).join('');
}

// ---------------------------------------------------------------------------
// TRUTH TABLE TAB
// ---------------------------------------------------------------------------
const CHAR_TABLES = {
  'sr-latch': [['S','R','Q(next)'],['0','0','Hold'],['1','0','1 (Set)'],['0','1','0 (Reset)'],['1','1','Invalid']],
  'jk-ff': [['J','K','Q(next)'],['0','0','Hold'],['1','0','1 (Set)'],['0','1','0 (Reset)'],['1','1','Toggle']],
  'd-ff': [['D','Q(next)'],['0','0'],['1','1']],
  't-ff': [['T','Q(next)'],['0','Hold'],['1','Toggle']],
};
function renderTruthTab(m){
  const tbl = $('truthTable');
  if(m.kind==='comb'){
    const n=m.inputs.length;
    let head = '<tr>'+m.inputs.map(i=>`<th>${i}</th>`).join('')+m.outputs.map(o=>`<th>${o}</th>`).join('')+'</tr>';
    let rows='';
    allBits(n).forEach((bits,idx)=>{
      const res=m.compute(...bits);
      rows+=`<tr id="trow-${idx}">`+bits.map(b=>`<td>${b}</td>`).join('')+res.map(r=>`<td>${r}</td>`).join('')+'</tr>';
    });
    tbl.innerHTML = head+rows;
  } else if(m.id==='seven-seg'){
    let head='<tr><th>Digit</th><th>Segments</th></tr>', rows='';
    Object.entries(SEG).forEach(([k,v])=>{ rows+=`<tr id="trow-${k}"><td>${k}</td><td>${v}</td></tr>`; });
    tbl.innerHTML=head+rows;
  } else if(CHAR_TABLES[m.id]){
    const t=CHAR_TABLES[m.id];
    tbl.innerHTML = `<tr>${t[0].map(h=>`<th>${h}</th>`).join('')}</tr>` + t.slice(1).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('');
  } else {
    tbl.innerHTML = `<tr><td style="padding:16px;color:var(--muted)">This is a live state machine without a fixed input→output truth table. Use the <b>Theory</b> tab for its characteristic behaviour and the <b>Controls</b> tab to interact with it in real time.</td></tr>`;
  }
}
function refreshTruthHighlight(m){
  if(!m) return;
  document.querySelectorAll('#truthTable tr.cur').forEach(r=>r.classList.remove('cur'));
  if(m.kind==='comb'){
    const idx = m.inputs.reduce((acc,i)=>acc*2+(inputValues[i]||0),0);
    const row=$('trow-'+idx); if(row) row.classList.add('cur');
  } else if(m.id==='seven-seg'){
    const row=$('trow-'+(state.values.hex||'0')); if(row) row.classList.add('cur');
  }
}

// ---------------------------------------------------------------------------
// MAIN RENDER LOOP
// ---------------------------------------------------------------------------
let last = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(.05,(now-last)/1000); last=now;

  if(flying){
    camera.position.lerp(flyGoal.pos, .12);
    controls.target.lerp(flyGoal.target, .12);
    if(camera.position.distanceTo(flyGoal.pos) < .02) flying=false;
  }
  controls.update();

  if(kit){
    if(state.pulseGlow>0) state.pulseGlow -= dt;
    for(const w of kit.wires){
      const on = !!w.sigFn();
      w.mat.emissiveIntensity += ((on?1.5:.1)-w.mat.emissiveIntensity)*.22;
      w.pts.visible = on && !reducedMotion;
      if(on && !reducedMotion){
        const a=w.pts.geometry.attributes.position;
        for(let i=0;i<w.N;i++){ w.u[i]=(w.u[i]+dt*w.speed)%1; const p=w.curve.getPointAt(w.u[i]); a.setXYZ(i,p.x,p.y+.04,p.z); }
        a.needsUpdate=true;
      }
    }
    for(const l of kit.leds){
      const target = l.on ? 2.2 : .04;
      l.m.emissiveIntensity += (target-l.m.emissiveIntensity)*.25;
      l.s.visible = l.on;
    }
    // Smoothly interpolate registered components to/from their exploded positions.
    kit.comps.forEach(o=>{
      const target = explodeOn ? o.userData.home.clone().add(o.userData.explode) : o.userData.home;
      o.position.lerp(target, .12);
    });
    if(boxHelper && selMesh){ boxHelper.update();
      const v=new THREE.Vector3(); v.copy(selMesh.position); v.y+=1; v.project(camera);
      const r=canvas.getBoundingClientRect();
      tagEl.style.left=(v.x*.5+.5)*r.width+'px'; tagEl.style.top=(-v.y*.5+.5)*r.height+'px';
    }
  }
  if (renderer) renderer.render(scene,camera);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------
renderCatChips(); renderRecent(); renderLibrary();
selectModel('binary-counter');
