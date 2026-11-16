// ============================================================================
// builds.js — Per-model 3D scene construction. Each function receives
// (kit, state, model) and wires up chips / switches / LEDs / wires whose
// visuals read live from `state.values` (populated every tick by engine.js).
// Returns { ledMap } so the engine can additionally drive UI-side LED chips.
// ============================================================================
import * as THREE from 'three';
import { SEG } from './models.js';

const COL = {in:0x36e2ff, out:0x45f0b0, bad:0xff5d72, warn:0xffb648, clk:0xffb020};

function val(state,key){ const v=state.values[key]; return (v===undefined)?0:v; }

// ---------------------------------------------------------------------------
// Generic layout used by every pure combinational Logic-Gate / Adder /
// Subtractor model: switches (left) -> labelled chip (middle) -> LEDs (right)
// ---------------------------------------------------------------------------
function genericComb(kit, state, model){
  kit.board(Math.max(10, model.inputs.length*1.6+6), 6.4);
  const nIn=model.inputs.length, nOut=model.outputs.length;
  const spanIn=Math.min(4.6, (nIn-1)*1.15), spanOut=Math.min(3, (nOut-1)*1.3);
  const symbol = model.icon;
  kit.chip('core', model.name, symbol, model.desc, 0, 0, {w:2.6,d:1.3,pins:Math.max(nIn,nOut)});

  model.inputs.forEach((inp,i)=>{
    const z = nIn===1?0:(-spanIn/2 + i*(spanIn/(nIn-1)));
    const sw = kit.toggleSwitch('sw-'+inp,inp+' switch', inp+' input — click to toggle in the Controls panel, or drag the lever here.', -3.6, z);
    kit.wire([[-3.3,z],[-1.3,z*.35]], ()=>val(state,inp), {y:.065});
    const tag=document.createElement('div'); // not used; label handled via sprite below
    const spr = spriteLabel(kit, inp, -3.9, z);
    sw.setOn(false);
    sw.__stateKey=inp;
    state.switches3d[inp]=sw;
  });
  model.outputs.forEach((o,i)=>{
    const z = nOut===1?0:(-spanOut/2 + i*(spanOut/(nOut-1)));
    const led = kit.led('led-'+o, o+' LED', o+' output indicator.', 3.3, z, nOut>1&&i>0?COL.warn:COL.out);
    kit.wire([[1.3,z*.35],[3,z]], ()=>val(state,o), {y:.065});
    spriteLabel(kit, o, 3.9, z);
    state.leds3d[o]=led;
  });
}

function spriteLabel(kit,text,x,z){
  const tex = kit.labelTex(text,128,40,'#9fd6ea',null,26);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true}));
  s.scale.set(.9,.28,1); s.position.set(x,.55,z); s.raycast=()=>{};
  kit.group.add(s); return s;
}

// ---------------------------------------------------------------------------
// MUX 4:1 — shows the live selected data path
// ---------------------------------------------------------------------------
function buildMux(kit,state){
  kit.board(12,7);
  kit.chip('core','4-to-1 Multiplexer','MUX','Select lines S1S0 route one of D0-D3 to Y.',0,0,{w:2.4,d:2.2,pins:4});
  const zs=[-1.5,-.5,.5,1.5];
  ['D0','D1','D2','D3'].forEach((d,i)=>{
    const sw=kit.toggleSwitch('sw-'+d,d,d+' data input',-3.6,zs[i]); state.switches3d[d]=sw;
    spriteLabel(kit,d,-4.1,zs[i]);
    kit.wire([[-3.3,zs[i]],[-1.2,zs[i]*.5]], ()=>{ const sel=val(state,'S1')*2+val(state,'S0'); return sel===i? val(state,d) : 0; }, {y:.065+i*.01});
  });
  ['S1','S0'].forEach((s,i)=>{ const sw=kit.toggleSwitch('sw-'+s,s,s+' select',-1+i*1.1,2.6); state.switches3d[s]=sw; spriteLabel(kit,s,-1+i*1.1,3.15);
    kit.wire([[-1+i*1.1,2.3],[-1+i*1.1,1.1]], ()=>val(state,s), {y:.11}); });
  const led=kit.led('led-Y','Y output','Selected data line.',3.3,0,COL.out); state.leds3d['Y']=led;
  kit.wire([[1.2,0],[3,0]], ()=>val(state,'Y'), {y:.09}); spriteLabel(kit,'Y',3.9,0);
}
function buildDemux(kit,state){
  kit.board(12,7);
  kit.chip('core','1-to-4 Demultiplexer','DEMUX','D is routed to exactly one selected output.',0,0,{w:2.4,d:2.2,pins:4});
  const sw=kit.toggleSwitch('sw-D','D','Data input',-3.6,0); state.switches3d['D']=sw; spriteLabel(kit,'D',-4.1,0);
  kit.wire([[-3.3,0],[-1.2,0]], ()=>val(state,'D'), {y:.09});
  ['S1','S0'].forEach((s,i)=>{ const sws=kit.toggleSwitch('sw-'+s,s,s+' select',-1+i*1.1,-2.6); state.switches3d[s]=sws; spriteLabel(kit,s,-1+i*1.1,-3.15);
    kit.wire([[-1+i*1.1,-2.3],[-1+i*1.1,-1.1]], ()=>val(state,s), {y:.11}); });
  const zs=[-1.5,-.5,.5,1.5];
  ['Y0','Y1','Y2','Y3'].forEach((y,i)=>{
    const led=kit.led('led-'+y,y,y+' output.',3.3,zs[i],COL.out); state.leds3d[y]=led; spriteLabel(kit,y,3.9,zs[i]);
    kit.wire([[1.2,zs[i]*.5],[3,zs[i]]], ()=>val(state,y), {y:.065+i*.01});
  });
}
function buildDecoder(kit,state){
  kit.board(12,7);
  kit.chip('core','2-to-4 Decoder','DEC','Address lines A1A0 select one active-high output line while EN is asserted.',0,0,{w:2.3,d:1.8,pins:3});
  ['A1','A0'].forEach((s,i)=>{ const sw=kit.toggleSwitch('sw-'+s,s,s+' address bit',-1+i*1.1,-2.6); state.switches3d[s]=sw; spriteLabel(kit,s,-1+i*1.1,-3.15);
    kit.wire([[-1+i*1.1,-2.3],[-1+i*1.1,-.9]], ()=>val(state,s), {y:.11}); });
  const en=kit.toggleSwitch('sw-EN','EN','Enable',-3.6,0); state.switches3d['EN']=en; spriteLabel(kit,'EN',-4.1,0);
  kit.wire([[-3.3,0],[-1.2,0]], ()=>val(state,'EN'), {y:.09});
  const zs=[-1.5,-.5,.5,1.5];
  ['D0','D1','D2','D3'].forEach((d,i)=>{
    const led=kit.led('led-'+d,d,d+' output line.',3.3,zs[i],COL.out); state.leds3d[d]=led; spriteLabel(kit,d,3.9,zs[i]);
    kit.wire([[1.2,zs[i]*.5],[3,zs[i]]], ()=>val(state,d), {y:.065+i*.01});
  });
}
function buildComparator(kit,state){
  kit.board(12,7);
  kit.chip('core','4-bit Magnitude Comparator','A:B','Compares two 2-bit numbers A1A0 and B1B0.',0,0,{w:2.4,d:1.6,pins:4});
  ['A1','A0'].forEach((s,i)=>{ const sw=kit.toggleSwitch('sw-'+s,s,s,-3.6,-1.1+i*1.1); state.switches3d[s]=sw; spriteLabel(kit,s,-4.1,-1.1+i*1.1);
    kit.wire([[-3.3,-1.1+i*1.1],[-1.2,(-1.1+i*1.1)*.5]], ()=>val(state,s), {y:.09+i*.01}); });
  ['B1','B0'].forEach((s,i)=>{ const sw=kit.toggleSwitch('sw-'+s,s,s,-3.6,1.6+i*1.1); state.switches3d[s]=sw; spriteLabel(kit,s,-4.1,1.6+i*1.1);
    kit.wire([[-3.3,1.6+i*1.1],[-1.2,1.6]], ()=>val(state,s), {y:.11+i*.01}); });
  const outs=[['A>B',-1.4],['A=B',0],['A<B',1.4]];
  outs.forEach(([o,z])=>{ const led=kit.led('led-'+o,o,o+' output.',3.3,z,COL.out); state.leds3d[o]=led; spriteLabel(kit,o,3.9,z);
    kit.wire([[1.2,z*.5],[3,z]], ()=>val(state,o), {y:.09}); });
}

// ---------------------------------------------------------------------------
// Sequential flip-flops: chip + clock pulse wire + Q/Qbar LEDs + optional
// data switches.
// ---------------------------------------------------------------------------
function buildFlipFlop(kit,state,model){
  kit.board(10,6);
  kit.chip('core',model.name,model.icon,model.desc,0,0,{w:2,d:1.5,pins:4});
  const dataInputs = model.inputs.filter(i=>i.type==='switch');
  const clk = model.inputs.find(i=>i.type==='clock');
  const spanIn = Math.min(3, (dataInputs.length-1)*1.3);
  dataInputs.forEach((inp,i)=>{
    const z = dataInputs.length===1?0:(-spanIn/2+i*(spanIn/(dataInputs.length-1)));
    const sw=kit.toggleSwitch('sw-'+inp.id,inp.id,inp.label,-3.2,z); state.switches3d[inp.id]=sw; spriteLabel(kit,inp.id,-3.7,z);
    kit.wire([[-2.9,z],[-1,z*.4]], ()=>val(state,inp.id), {y:.07+i*.01});
  });
  if(clk){
    const btn=kit.pushButton('btn-clk','Clock Pulse','Click, or press Pulse, to apply one clock edge.',0,-2.4);
    state.clockBtn=btn;
    kit.wire([[0,-2.1],[0,-.9]], ()=>state.pulseGlow>0?1:0, {y:.07});
    spriteLabel(kit,'CLK',0,-2.9);
  }
  const ledQ=kit.led('led-Q','Q','Stored state Q.',3.1,-.5,COL.out); state.leds3d['Q']=ledQ; spriteLabel(kit,'Q',3.7,-.5);
  kit.wire([[1,-.3],[2.9,-.5]], ()=>val(state,'Q'), {y:.09});
  const ledQb=kit.led('led-Qbar','Q̄','Complement of Q.',3.1,.7,COL.warn); state.leds3d['Qbar']=ledQb; spriteLabel(kit,'Q̄',3.7,.7);
  kit.wire([[1,.4],[2.9,.7]], ()=>val(state,'Qbar'), {y:.1});
  if(model.id==='sr-latch'){
    const ledInv=kit.led('led-invalid','Invalid','S=R=1 forbidden state flag.',0,1.6,COL.bad);
    state.leds3d['invalid']=ledInv; spriteLabel(kit,'INVALID',0,2.1);
  }
}

function buildCounter(kit,state){
  kit.board(13,7.5);
  kit.chip('ffa','Flip-Flops FF0 & FF1','74LS76','FF0 toggles every pulse; FF1 toggles when Q0=1.',-3.2,1.2,{w:1.9,d:1,pins:5});
  kit.chip('ffb','Flip-Flops FF2 & FF3','74LS76','FF2 toggles on Q0·Q1; FF3 toggles on Q0·Q1·Q2.',-3.2,-1.2,{w:1.9,d:1,pins:5});
  kit.chip('and','AND Toggle-Enable Logic','74LS08','Builds T2=Q0·Q1 and T3=Q0·Q1·Q2.',0,-3,{w:1.9,d:1,pins:4});
  const btn=kit.pushButton('btn-clk','Clock Pulse','Click, or press Pulse / Start, to advance the count.',-5.5,0); state.clockBtn=btn;
  kit.wire([[-5.2,.3],[-4.3,1.2]], ()=>state.pulseGlow>0?1:0, {y:.07});
  kit.wire([[-5.2,-.3],[-4.3,-1.2]], ()=>state.pulseGlow>0?1:0, {y:.07});
  const zs=[-2.1,-.7,.7,2.1];
  ['Q0','Q1','Q2','Q3'].forEach((q,i)=>{
    const led=kit.led('led-'+q,q,q+' (weight '+(1<<i)+').',zs[i],3.9,0x00e5ff); state.leds3d[q]=led;
    spriteLabel(kit,q,zs[i],4.4);
  });
  const disp=kit.sevenSeg('disp','Hex Readout','Shows the count 0-F.',5.4,1.4,1);
  state.sevenSeg=disp;
}

function buildShiftRegister(kit,state){
  kit.board(12,6.5);
  kit.chip('core','4-bit Shift Register','SIPO','Serial-In, Parallel-Out shift register (4x D flip-flops).',0,0,{w:3,d:1.3,pins:5});
  const sw=kit.toggleSwitch('sw-SIN','SIN','Serial data in',-3.9,0); state.switches3d['SIN']=sw; spriteLabel(kit,'SIN',-4.4,0);
  kit.wire([[-3.6,0],[-1.5,0]], ()=>val(state,'SIN'), {y:.09});
  const btn=kit.pushButton('btn-clk','Clock Pulse','Shift one stage to the right.',0,-2.2); state.clockBtn=btn;
  kit.wire([[0,-1.9],[0,-.65]], ()=>state.pulseGlow>0?1:0, {y:.07});
  // place LEDs in a left-to-right chain to visualise the shift direction
  ['Q0','Q1','Q2','Q3'].forEach((q,i)=>{
    const led=kit.led('led-'+q,q,'Stage '+i+'. Bits move toward Q3 each pulse.', -1.4+i*.9, 1.4, COL.out);
    state.leds3d[q]=led; spriteLabel(kit,q,-1.4+i*.9,1.9);
    kit.wire([[-1.4+i*.9, i===0?-.3:1.1],[-1.4+i*.9,1.15]], ()=>val(state,q), {y:.08});
  });
}

// ---------------------------------------------------------------------------
// ADVANCED
// ---------------------------------------------------------------------------
function buildSevenSeg(kit,state){
  kit.board(7,6);
  const disp=kit.sevenSeg('disp','7-Segment Display','Seven LED bars a-g combine to form digits 0-F.',0,0,1.6);
  state.sevenSeg=disp;
}
function buildDigitalClock(kit,state){
  kit.board(13,5.5);
  kit.chip('core','Cascaded mod-60/mod-24 Counters','RTC','Seconds→Minutes→Hours ripple counters.',0,-2,{w:4,d:1,pins:6});
  const d1=kit.sevenSeg('h1','Hours tens','',-4.6,0,.85), d2=kit.sevenSeg('h2','Hours units','',-3.2,0,.85);
  const d3=kit.sevenSeg('m1','Minutes tens','',-.8,0,.85), d4=kit.sevenSeg('m2','Minutes units','',.6,0,.85);
  const d5=kit.sevenSeg('s1','Seconds tens','',3,0,.85), d6=kit.sevenSeg('s2','Seconds units','',4.4,0,.85);
  state.clockDigits=[d1,d2,d3,d4,d5,d6];
}
function buildMemory(kit,state,model){
  kit.board(13,8);
  kit.chip('core', model.name, model.id==='ram'?'RAM':'ROM', model.desc, 0,-3,{w:3,d:1,pins:6});
  const cells=[];
  for(let i=0;i<16;i++){
    const x=-2.6+(i%4)*1.75, z=-1.1+Math.floor(i/4)*1.3;
    const c=kit.memCell('cell-'+i,x,.3,z);
    cells.push(c);
  }
  state.memCells=cells;
}
function buildALU(kit,state){
  kit.board(14,8);
  kit.chip('core','4-bit Arithmetic Logic Unit','ALU',
    'Multiplexer-selected adder/logic core. The 3-bit opcode picks which result reaches the output bus.',0,.3,{w:3.2,d:1.8,pins:6});
  // Operand A bits (left column) and B bits (left column, offset) feeding the ALU
  for(let i=0;i<4;i++){
    const zA=-2.1+i*1.0;
    const lA=kit.led('a'+i,'A'+(3-i),'Operand A, bit '+(3-i)+'.',-4.6,zA,COL.in); state.leds3d['a'+i]=lA; spriteLabel(kit,'A'+(3-i),-5.1,zA);
    kit.wire([[-4.3,zA],[-1.9,zA*.3]], ()=>val(state,'a'+i), {y:.08+i*.01});
    const lB=kit.led('b'+i,'B'+(3-i),'Operand B, bit '+(3-i)+'.',-3.2,zA,COL.in); state.leds3d['b'+i]=lB; spriteLabel(kit,'B'+(3-i),-3.2,zA+.5);
    kit.wire([[-3.2,zA-.3],[-1.9,zA*.3]], ()=>val(state,'b'+i), {y:.09+i*.01});
  }
  // Result bits (right column)
  for(let i=0;i<4;i++){
    const z=-2.1+i*1.0;
    const l=kit.led('r'+i,'R'+(3-i),'Result, bit '+(3-i)+'.',4.6,z,COL.out); state.leds3d['r'+i]=l; spriteLabel(kit,'R'+(3-i),5.1,z);
    kit.wire([[1.9,z*.3],[4.3,z]], ()=>val(state,'r'+i), {y:.08+i*.01});
  }
  // Flags
  const flags=[['Zero',COL.warn,2.6],['Carry',COL.out,3.1],['Neg',COL.bad,3.6]];
  flags.forEach(([name,col,y],i)=>{
    const l=kit.led('flag-'+name,name,name+' flag.',0,2.4+i*.9,col); state.leds3d['flag'+name]=l; spriteLabel(kit,name,0,2.9+i*.9);
    kit.wire([[0,1.1],[0,2.1+i*.9]], ()=>val(state,'flag'+name), {y:.1+i*.02});
  });
}

function buildCPU(kit,state){
  kit.board(15,9);
  const cu  = kit.chip('cu','Control Unit','CU','Fetches & decodes instructions, sequences every other block.',-3.4,2.2,{w:2.6,d:1.4,pins:5});
  const alu = kit.chip('alu','Arithmetic Logic Unit','ALU','Executes the arithmetic/logic operation for the current instruction.',3.4,2.2,{w:2.6,d:1.4,pins:5});
  const reg = kit.chip('reg','Registers','REG','Small, extremely fast storage the ALU reads/writes directly.',-3.4,-2.2,{w:2.6,d:1.4,pins:5});
  const mem = kit.chip('mem','Main Memory','MEM','Holds the program instructions and data.',3.4,-2.2,{w:2.6,d:1.4,pins:5});
  kit.wire([[-2.1,2.2],[2.1,2.2]], ()=>state.values.phase==='FETCH'||state.values.phase==='DECODE'?1:0, {y:.1}); // CU<->ALU (control bus)
  kit.wire([[-3.4,.8],[-3.4,-.8]], ()=>state.values.phase==='WRITE-BACK'?1:0, {y:.1}); // CU<->REG
  kit.wire([[3.4,.8],[3.4,-.8]], ()=>state.values.phase==='EXECUTE'||state.values.phase==='WRITE-BACK'?1:0, {y:.1}); // ALU<->MEM/REG path
  kit.wire([[-2.1,-2.2],[2.1,-2.2]], ()=>state.values.phase==='FETCH'?1:0, {y:.1}); // REG<->MEM (address/data bus)
  kit.wire([[-3.4,1.5],[3.4,-1.5]], ()=>state.values.phase==='FETCH'?1:0, {y:.14}); // CU fetch path to MEM
  spriteLabel(kit,'Control Bus',0,2.75);
  spriteLabel(kit,'Data / Address Bus',0,-2.75);
  state.cpuBlocks={cu,alu,reg,mem};
  state.pcDisplay = kit.sevenSeg('pc','Program Counter','Current instruction address.',0,.2,1.1);
}

export const BUILDERS = {
  'mux4': buildMux, 'demux4': buildDemux, 'decoder': buildDecoder, 'comparator': buildComparator,
  'sr-latch': buildFlipFlop, 'jk-ff': buildFlipFlop, 'd-ff': buildFlipFlop, 't-ff': buildFlipFlop,
  'binary-counter': buildCounter, 'shift-register': buildShiftRegister,
  'seven-seg': buildSevenSeg, 'digital-clock': buildDigitalClock,
  'ram': buildMemory, 'rom': buildMemory, 'alu': buildALU, 'cpu': buildCPU,
};

export function buildModel(kit, state, model){
  const fn = BUILDERS[model.id] || genericComb;
  fn(kit, state, model);
}
