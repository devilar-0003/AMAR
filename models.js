// ============================================================================
// models.js — Pure data & logic layer. NO Three.js here.
// Every model = { id, name, cat, icon, diff, desc, objective, apps[], theory,
//                  kind: 'comb' | 'seq' | 'mem' | 'misc',
//                  inputs: [...], outputs: [...], compute / sim }
// Combinational models expose compute(bits)->outputs for auto truth-table.
// Sequential/memory/misc models own a `sim` object with reset()/tick()/etc.
// ============================================================================

export const SEG = {0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',
  7:'abc',8:'abcdefg',9:'abcdfg',A:'abcefg',B:'cdefg',C:'adef',D:'bcdeg',E:'adefg',F:'aefg'};

const h1 = n => n.toString(16).toUpperCase();

// ---------------------------------------------------------------------------
// CATEGORY METADATA
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  {id:'gates', name:'Logic Gates', icon:'◇'},
  {id:'comb', name:'Combinational Circuits', icon:'⊞'},
  {id:'seq', name:'Sequential Circuits', icon:'↻'},
  {id:'adv', name:'Advanced Models', icon:'◆'},
];

// ---------------------------------------------------------------------------
// Helper to build a combinational model definition quickly
// ---------------------------------------------------------------------------
function comb(id,name,cat,inputs,outputs,f,extra={}){
  return Object.assign({
    id,name,cat,kind:'comb',inputs,outputs,compute:f,
    icon:extra.icon||'◇', diff:extra.diff||'Beginner-friendly',
  }, extra);
}

// ============================================================================
// 1. LOGIC GATES
// ============================================================================
export const MODELS = [
comb('and-gate','AND Gate','gates',['A','B'],['Y'],(a,b)=>[a&b],{
  icon:'&', desc:'Output is HIGH only when every input is HIGH.',
  objective:'Understand the fundamental AND operation: Y = A·B. The output LED lights only when both input switches are ON.',
  apps:['Enable/gating logic in control circuits','Interlock safety systems (both conditions must be true)','Address decoding in memory systems'],
  theory:`<h4>Boolean expression</h4><p><code>Y = A · B</code> (Y = A AND B)</p>
  <h4>Working principle</h4><p>An AND gate conducts only when every input path is HIGH, modelled physically by two switches wired in series: current only reaches the output LED if both switches are closed.</p>
  <h4>Characteristics</h4><ul><li>2-input AND has 4 possible input combinations</li><li>Only 1 of 4 rows produces a HIGH output</li><li>Available as 7408 (quad 2-input AND) IC</li></ul>`
}),
comb('or-gate','OR Gate','gates',['A','B'],['Y'],(a,b)=>[a|b],{
  icon:'≥1', desc:'Output is HIGH when at least one input is HIGH.',
  objective:'Understand the OR operation: Y = A+B. Toggle either switch to see the output respond.',
  apps:['Alarm systems (any sensor triggers alert)','Redundant control paths','Combining multiple enable signals'],
  theory:`<h4>Boolean expression</h4><p><code>Y = A + B</code> (Y = A OR B)</p>
  <h4>Working principle</h4><p>Modelled as two switches in parallel — current reaches the output if either (or both) switch closes.</p>
  <h4>Characteristics</h4><ul><li>Only the 00 row produces LOW</li><li>Available as 7432 (quad 2-input OR) IC</li></ul>`
}),
comb('not-gate','NOT Gate','gates',['A'],['Y'],(a)=>[a^1],{
  icon:'¬', desc:'Inverts a single input bit.',
  objective:'Understand inversion: Y = Ā. A single switch toggles the output to its opposite state.',
  apps:['Signal inversion / active-low to active-high conversion','Clock signal inversion','Building NAND/NOR from AND/OR + NOT'],
  theory:`<h4>Boolean expression</h4><p><code>Y = Ā</code> (Y = NOT A)</p>
  <h4>Working principle</h4><p>A single transistor inverter: when the input base is HIGH the transistor saturates and pulls the output LOW, and vice-versa.</p>
  <h4>Characteristics</h4><ul><li>Only gate with a single input</li><li>Available as 7404 (hex inverter) IC</li></ul>`
}),
comb('nand-gate','NAND Gate','gates',['A','B'],['Y'],(a,b)=>[(a&b)^1],{
  icon:'&̄', desc:'Inverse of AND; output is LOW only when all inputs are HIGH.',
  objective:'NAND is a universal gate — any Boolean function can be built from NAND gates alone.',
  apps:['Universal gate for building any logic function','SR latches','TTL logic families are NAND-based (74LS00)'],
  theory:`<h4>Boolean expression</h4><p><code>Y = (A · B)'</code></p>
  <h4>Working principle</h4><p>An AND gate followed by a NOT gate. Because NAND is functionally complete, every other gate (OR, AND, NOT, XOR...) can be built from NAND gates alone.</p>
  <h4>Characteristics</h4><ul><li>Universal gate</li><li>Only the 11 row is LOW</li><li>7400 quad 2-input NAND is the most produced logic chip in history</li></ul>`
}),
comb('nor-gate','NOR Gate','gates',['A','B'],['Y'],(a,b)=>[(a|b)^1],{
  icon:'≥̄1', desc:'Inverse of OR; output is HIGH only when all inputs are LOW.',
  objective:'Like NAND, NOR is also a universal gate and forms the basis of the classic SR latch.',
  apps:['Universal gate — alternative to NAND','Cross-coupled NOR SR latches','Default-high enable logic'],
  theory:`<h4>Boolean expression</h4><p><code>Y = (A + B)'</code></p>
  <h4>Working principle</h4><p>An OR gate followed by a NOT gate. NOR is the second universal gate family (7402).</p>
  <h4>Characteristics</h4><ul><li>Universal gate</li><li>Only the 00 row is HIGH</li></ul>`
}),
comb('xor-gate','XOR Gate / XNOR Gate','gates',['A','B'],['XOR','XNOR'],(a,b)=>[a^b,(a^b)^1],{
  icon:'⊕', desc:'XOR is HIGH for unlike inputs; XNOR is HIGH for matching inputs.',
  objective:'XOR detects "difference"; XNOR detects "equality". Both outputs are shown live side-by-side.',
  apps:['Binary adders (sum bit = XOR)','Parity generation/checking for error detection','Equality comparators (XNOR)','Simple encryption (XOR cipher)'],
  theory:`<h4>Boolean expressions</h4><p><code>XOR = A⊕B</code>&nbsp;&nbsp;<code>XNOR = (A⊕B)'</code></p>
  <h4>Working principle</h4><p>XOR outputs HIGH only when inputs differ — it is the building block of the "Sum" bit in binary adders. XNOR is its exact complement and outputs HIGH when inputs match, making it a natural 1-bit equality comparator.</p>
  <h4>Characteristics</h4><ul><li>7486 quad 2-input XOR IC</li><li>XOR with a constant 1 acts as an inverter</li></ul>`,
  diff:'Intermediate'
}),

// ============================================================================
// 2. COMBINATIONAL CIRCUITS
// ============================================================================
comb('half-adder','Half Adder','comb',['A','B'],['Sum','Carry'],(a,b)=>[a^b,a&b],{
  icon:'+', desc:'Adds two 1-bit inputs and produces Sum and Carry.',
  objective:'See how XOR produces the Sum bit while AND produces the Carry bit — the foundation of all binary arithmetic.',
  apps:['Building block of the Full Adder','LSB stage of any ripple-carry adder','Teaching binary arithmetic fundamentals'],
  theory:`<h4>Equations</h4><p><code>Sum = A⊕B</code>&nbsp;&nbsp;<code>Carry = A·B</code></p>
  <h4>Working principle</h4><p>A Half Adder adds two single bits with no carry-in. It cannot chain with a previous stage because it has no Carry-in input — that limitation is solved by the Full Adder.</p>`,
  diff:'Intermediate'
}),
comb('full-adder','Full Adder','comb',['A','B','Cin'],['Sum','Cout'],(a,b,c)=>{const s=a^b^c,co=(a&b)|(c&(a^b));return[s,co]},{
  icon:'+c', desc:'Adds A, B and Carry-in to produce Sum and Carry-out.',
  objective:'Chain full adders together (ripple-carry) to add multi-bit binary numbers — exactly how early ALUs worked.',
  apps:['N-bit ripple-carry adders inside ALUs','Binary counters (adder + feedback)','Checksum / CRC hardware'],
  theory:`<h4>Equations</h4><p><code>Sum = A⊕B⊕Cin</code>&nbsp;&nbsp;<code>Cout = AB + Cin(A⊕B)</code></p>
  <h4>Working principle</h4><p>Built from two Half Adders and an OR gate: the first half-adder adds A and B, the second adds Cin to that partial sum, and the carries are OR-ed together. Chaining Cout→Cin across 4 full adders makes a 4-bit ripple-carry adder.</p>`,
  diff:'Intermediate'
}),
comb('half-sub','Half Subtractor','comb',['A','B'],['Diff','Borrow'],(a,b)=>[a^b,(a^1)&b],{
  icon:'−', desc:'Subtracts two bits and produces Difference and Borrow.',
  objective:'Borrow = 1 whenever you try to subtract a larger bit (1) from a smaller one (0).',
  apps:['Building block of the Full Subtractor','Binary subtraction / two\'s-complement arithmetic'],
  theory:`<h4>Equations</h4><p><code>Diff = A⊕B</code>&nbsp;&nbsp;<code>Borrow = A'·B</code></p>
  <h4>Working principle</h4><p>Computes A − B for single bits. Borrow activates only in the 0−1 case, where a bit must be borrowed from the next higher column.</p>`,
  diff:'Intermediate'
}),
comb('full-sub','Full Subtractor','comb',['A','B','Bin'],['Diff','Bout'],(a,b,bin)=>{const d=a^b^bin,bo=((a^1)&b)|((a^1)&bin)|(b&bin);return[d,bo]},{
  icon:'−b', desc:'Subtracts two bits and a Borrow-in.',
  objective:'Chain full subtractors to perform multi-bit binary subtraction, mirroring the Full Adder structure.',
  apps:['Multi-bit binary subtractors','ALU subtract mode (often via adder + two\'s complement instead)'],
  theory:`<h4>Equations</h4><p><code>Diff = A⊕B⊕Bin</code></p><p><code>Bout = A'B + A'Bin + B·Bin</code></p>
  <h4>Working principle</h4><p>Structurally a mirror of the Full Adder: two half-subtractors plus an OR gate combine the borrow terms.</p>`,
  diff:'Intermediate'
}),
comb('mux4','Multiplexer (MUX)','comb',['D0','D1','D2','D3','S1','S0'],['Y'],(d0,d1,d2,d3,s1,s0)=>[[d0,d1,d2,d3][s1*2+s0]],{
  icon:'⇶', desc:'Select lines choose one of several inputs for a single output.',
  objective:'This is a 4-to-1 MUX: 2 select lines (S1S0) choose which of D0–D3 reaches the output Y. Watch the highlighted data path change as you change the select lines.',
  apps:['Data routing / bus selection in CPUs','Parallel-to-serial conversion','Implementing arbitrary Boolean functions (function generators)'],
  theory:`<h4>Equation</h4><p><code>Y = D[S1S0]</code> — the select lines form a 2-bit address into the 4 data inputs.</p>
  <h4>Working principle</h4><p>Internally built from AND-OR logic: Y = D0·S1'S0' + D1·S1'S0 + D2·S1S0' + D3·S1S0. Only one AND gate is "open" at a time, determined by the select lines.</p>
  <h4>IC example</h4><p><code>74153</code> dual 4-to-1 multiplexer.</p>`,
  diff:'Intermediate'
}),
comb('demux4','Demultiplexer (DEMUX)','comb',['D','S1','S0'],['Y0','Y1','Y2','Y3'],(d,s1,s0)=>{const y=[0,0,0,0];y[s1*2+s0]=d;return y},{
  icon:'⇵', desc:'Routes one input to one selected output.',
  objective:'The inverse of a MUX: a single data input D is routed to exactly one of 4 outputs, chosen by S1S0.',
  apps:['Routing one data source to multiple destinations','Memory address decoding (as a decoder with data)','Serial-to-parallel conversion'],
  theory:`<h4>Equation</h4><p><code>Y[S1S0] = D</code>, all other outputs = 0.</p>
  <h4>Working principle</h4><p>Each output is driven by an AND gate of D with the unique minterm of S1,S0 for that line — exactly one minterm is true at a time.</p>
  <h4>IC example</h4><p><code>74155</code> dual 2-to-4 decoder/demultiplexer.</p>`,
  diff:'Intermediate'
}),
comb('decoder','Encoder / Decoder','comb',['A1','A0','EN'],['D0','D1','D2','D3'],(a1,a0,en)=>{const y=[0,0,0,0];if(en)y[a1*2+a0]=1;return y},{
  icon:'⌸', desc:'Converts between coded input and decoded output lines.',
  objective:'This is a 2-to-4 line decoder with Enable. A1A0 forms a 2-bit address; the matching output line goes HIGH only while EN is asserted. (An encoder performs the reverse mapping.)',
  apps:['Memory chip-select address decoding','Seven-segment / display decoding (conceptually)','Instruction decoding in CPUs'],
  theory:`<h4>Equation</h4><p><code>D[A1A0] = EN</code>, all other outputs = 0 when EN=1; all outputs 0 when EN=0.</p>
  <h4>Working principle</h4><p>A decoder "unpacks" a binary address into one-hot output lines — the opposite job of a priority encoder, which packs one-hot/active inputs back into a binary code (Y = highest-priority active input's index).</p>
  <h4>IC example</h4><p><code>74138</code> 3-to-8 decoder, <code>74148</code> 8-to-3 priority encoder.</p>`,
  diff:'Intermediate'
}),
comb('comparator','Magnitude Comparator','comb',['A1','A0','B1','B0'],['A>B','A=B','A<B'],(a1,a0,b1,b0)=>{const A=a1*2+a0,B=b1*2+b0;return[A>B?1:0,A===B?1:0,A<B?1:0]},{
  icon:'⚖', desc:'Compares two binary values: A>B, A=B or A<B.',
  objective:'Set the two 2-bit numbers A1A0 and B1B0 and watch exactly one of the three comparator outputs go HIGH.',
  apps:['Numeric comparisons in ALUs (branch-if-greater etc.)','Priority arbitration circuits','Sorting networks'],
  theory:`<h4>Working principle</h4><p>Each 2-bit number is converted to its decimal value internally and compared; exactly one of the three mutually-exclusive outputs is asserted. Real ICs (e.g. 7485) implement this with cascaded XNOR equality checks and priority logic bit-by-bit from MSB down, without converting to decimal.</p>
  <h4>IC example</h4><p><code>7485</code> 4-bit magnitude comparator (cascadable).</p>`,
  diff:'Intermediate'
}),
];

// ============================================================================
// 3. SEQUENTIAL CIRCUITS  (kind:'seq' — own explicit sim object)
// ============================================================================
MODELS.push({
  id:'sr-latch', name:'SR Flip-Flop', cat:'seq', kind:'seq', icon:'SR', diff:'Intermediate',
  desc:'Stores one bit using Set and Reset inputs.',
  objective:'S=1 forces Q=1 (Set). R=1 forces Q=0 (Reset). S=R=1 is an invalid/forbidden state in the basic SR latch — watch it get flagged.',
  apps:['Basic 1-bit memory cell','Debounce circuits for mechanical switches','Building block for more complex flip-flops'],
  theory:`<h4>Characteristic table</h4><p>S=0,R=0 → Hold &nbsp;|&nbsp; S=1,R=0 → Q=1 &nbsp;|&nbsp; S=0,R=1 → Q=0 &nbsp;|&nbsp; S=1,R=1 → Invalid</p>
  <h4>Working principle</h4><p>Built from two cross-coupled NOR (or NAND) gates: each gate's output feeds the other's input, creating a bistable loop that "latches" its state until S or R is asserted. It is level-sensitive (asynchronous), not clock-driven.</p>`,
  inputs:[{id:'S',type:'switch',label:'S (Set)'},{id:'R',type:'switch',label:'R (Reset)'}],
  outputs:['Q','Qbar'],
  sim:{
    q:0, invalid:false,
    step(vals){ const S=vals.S,R=vals.R;
      if(S&&R){ this.invalid=true; }
      else { this.invalid=false; if(S) this.q=1; else if(R) this.q=0; }
      return {Q:this.q, Qbar:this.invalid?this.q:this.q^1, invalid:this.invalid};
    },
    reset(){ this.q=0; this.invalid=false; }
  }
});
MODELS.push({
  id:'jk-ff', name:'JK Flip-Flop', cat:'seq', kind:'seq', icon:'JK', diff:'Advanced',
  desc:'A versatile flip-flop; J=K=1 toggles the output.',
  objective:'J and K behave like Set/Reset but resolve the forbidden case: J=K=1 makes the flip-flop toggle on every clock pulse instead of being invalid.',
  apps:['Binary counters (J=K=1 wired permanently = toggle flip-flop)','Shift registers','General-purpose sequential storage'],
  theory:`<h4>Characteristic table</h4><p>J=0,K=0 → Hold &nbsp;|&nbsp; J=1,K=0 → Set (Q=1) &nbsp;|&nbsp; J=0,K=1 → Reset (Q=0) &nbsp;|&nbsp; J=1,K=1 → Toggle</p>
  <h4>Working principle</h4><p>Internally an SR latch with feedback gating that prevents the invalid state: when both inputs are 1 the feedback forces a toggle instead. Updates occur on the active clock edge (here: each "Pulse" click).</p>`,
  inputs:[{id:'J',type:'switch',label:'J'},{id:'K',type:'switch',label:'K'},{id:'CLK',type:'clock'}],
  outputs:['Q','Qbar'],
  sim:{
    q:0,
    step(vals){ const {J,K}=vals;
      if(J&&K) this.q^=1; else if(J) this.q=1; else if(K) this.q=0;
      return {Q:this.q, Qbar:this.q^1};
    },
    reset(){ this.q=0; }
  }
});
MODELS.push({
  id:'d-ff', name:'D Flip-Flop', cat:'seq', kind:'seq', icon:'D', diff:'Intermediate',
  desc:'Captures D on the active clock edge.',
  objective:'Whatever D is at the moment you press Pulse becomes the new Q — a D flip-flop is a clocked 1-bit "data latch".',
  apps:['Registers (banks of D flip-flops) in CPUs','Data synchronization between clock domains','Shift register stages'],
  theory:`<h4>Characteristic table</h4><p>Q(next) = D, regardless of the previous Q, on every active clock edge.</p>
  <h4>Working principle</h4><p>Usually built from a JK or SR flip-flop with D tied to J and D' tied to K, eliminating the hold/invalid states entirely — it always transfers D straight to Q on the clock edge.</p>`,
  inputs:[{id:'D',type:'switch',label:'D'},{id:'CLK',type:'clock'}],
  outputs:['Q','Qbar'],
  sim:{ q:0, step(vals){ this.q=vals.D; return {Q:this.q,Qbar:this.q^1}; }, reset(){this.q=0;} }
});
MODELS.push({
  id:'t-ff', name:'T Flip-Flop', cat:'seq', kind:'seq', icon:'T', diff:'Intermediate',
  desc:'T=1 toggles state on each active clock edge.',
  objective:'T=1 flips Q every pulse; T=0 holds. Wiring T permanently HIGH turns this into the "divide-by-2" cell used inside every binary counter.',
  apps:['Binary ripple counters (T permanently HIGH)','Frequency dividers','Simple toggling indicators'],
  theory:`<h4>Characteristic table</h4><p>T=0 → Hold &nbsp;|&nbsp; T=1 → Toggle (Q(next)=Q')</p>
  <h4>Working principle</h4><p>Equivalent to a JK flip-flop with J and K tied together as T. Cascading T flip-flops with T=1 gives the classic ripple binary counter — exactly the circuit used in the Binary Counter model.</p>`,
  inputs:[{id:'T',type:'switch',label:'T'},{id:'CLK',type:'clock'}],
  outputs:['Q','Qbar'],
  sim:{ q:0, step(vals){ if(vals.T) this.q^=1; return {Q:this.q,Qbar:this.q^1}; }, reset(){this.q=0;} }
});
MODELS.push({
  id:'binary-counter', name:'Binary Counter', cat:'seq', kind:'seq', icon:'#', diff:'Intermediate',
  desc:'A sequential circuit that advances its binary state on clock pulses.',
  objective:'Four T flip-flops (T0=1, T1=Q0, T2=Q0·Q1, T3=Q0·Q1·Q2) count 0000→1111 then wrap, exactly implementing binary +1 each pulse.',
  apps:['Digital clocks and timers','Frequency division','Address sequencing in memory scans'],
  theory:`<h4>Working principle</h4><p>Four T flip-flops store Q0–Q3. AND gates build the toggle-enables: T0=1, T1=Q0, T2=Q0·Q1, T3=Q0·Q1·Q2 — a bit only flips when every lower bit is 1, which is exactly how binary addition carries. The count runs 0000→1111 then wraps to 0000 (mod 16).</p>
  <h4>Value</h4><p><code>N = 8·Q3 + 4·Q2 + 2·Q1 + Q0</code></p>`,
  inputs:[{id:'CLK',type:'clock',free:true}],
  outputs:['Q0','Q1','Q2','Q3'],
  sim:{
    q:[0,0,0,0],
    get t(){const q=this.q;return[1,q[0],q[0]&q[1],q[0]&q[1]&q[2]]},
    step(){ const t=this.t; this.q=this.q.map((v,i)=>v^t[i]); return {Q0:this.q[0],Q1:this.q[1],Q2:this.q[2],Q3:this.q[3],n:this.n}; },
    get n(){return this.q[0]+2*this.q[1]+4*this.q[2]+8*this.q[3];},
    reset(){ this.q=[0,0,0,0]; }
  }
});
MODELS.push({
  id:'shift-register', name:'Shift Register', cat:'seq', kind:'seq', icon:'→', diff:'Advanced',
  desc:'Stores bits and shifts them between stages on clock pulses.',
  objective:'A 4-bit Serial-In/Parallel-Out shift register: the Serial-In switch value shifts into Q0 each pulse, pushing older bits toward Q3.',
  apps:['Serial-to-parallel data conversion (e.g. reading a serial bus)','LED chasers / shift-based animations','Pseudo-random bit sequence generators (with XOR feedback)'],
  theory:`<h4>Working principle</h4><p>Four D flip-flops are chained: Q0's new value is Serial-In, Q1 takes the old Q0, Q2 takes the old Q1, Q3 takes the old Q2. Every active clock edge shifts the whole pattern one stage to the right. Q3 is the serial output.</p>`,
  inputs:[{id:'SIN',type:'switch',label:'Serial In'},{id:'CLK',type:'clock'}],
  outputs:['Q0','Q1','Q2','Q3'],
  sim:{ q:[0,0,0,0], step(vals){ this.q=[vals.SIN,this.q[0],this.q[1],this.q[2]]; return {Q0:this.q[0],Q1:this.q[1],Q2:this.q[2],Q3:this.q[3]}; }, reset(){this.q=[0,0,0,0];} }
});

// ============================================================================
// 4. ADVANCED MODELS
// ============================================================================
MODELS.push({
  id:'seven-seg', name:'7-Segment Display', cat:'adv', kind:'misc', icon:'8', diff:'Beginner-friendly',
  desc:'Seven LED segments combine to represent decimal digits.',
  objective:'Step through hex digits 0–F with the selector and watch the decoder light the correct combination of segments a–g.',
  apps:['Digital clocks, calculators, counters, meters — any numeric readout'],
  theory:`<h4>Working principle</h4><p>A decoder maps a 4-bit code (0000–1111) to seven on/off segment signals a–g. Example: 5 lights a,c,d,f,g; 8 lights all seven. Each segment is an LED through a current-limiting resistor (≈330Ω, giving ≈10mA at 5V).</p>`,
  inputs:[{id:'DIGIT',type:'hex4'}],
  outputs:[],
  sim:{ val:0, step(vals){ this.val=vals.DIGIT; return {hex:h1(this.val), segs:SEG[h1(this.val)]}; }, reset(){this.val=0;} }
});
MODELS.push({
  id:'digital-clock', name:'Digital Clock', cat:'adv', kind:'misc', icon:'⏱', diff:'Advanced',
  desc:'Uses counters and display drivers to keep and show time.',
  objective:'Three cascaded modulo counters (mod-60 seconds, mod-60 minutes, mod-24 hours) ripple into each other exactly like a real digital clock chip.',
  apps:['Wall clocks, wristwatches, microwave/oven timers','Any system needing a real-time clock (RTC) peripheral'],
  theory:`<h4>Working principle</h4><p>A fast internal clock increments a seconds counter. When seconds rolls over from 59→0 it carries into minutes; minutes rolling over carries into hours (mod 24). This cascaded-counter technique is exactly how hardware RTC/clock ICs work.</p>`,
  inputs:[{id:'CLK',type:'clock',free:true,label:'Time speed'}],
  outputs:[],
  sim:{ h:12,m:0,s:0,
    step(){ this.s++; if(this.s>59){this.s=0;this.m++; if(this.m>59){this.m=0;this.h=(this.h+1)%24;}} return {h:this.h,m:this.m,s:this.s}; },
    reset(){ this.h=12;this.m=0;this.s=0; }
  }
});
MODELS.push({
  id:'ram', name:'RAM Memory', cat:'adv', kind:'mem', icon:'▦', diff:'Advanced',
  desc:'Volatile read/write storage organized into addressable locations.',
  objective:'Set an Address (0–15) and Data value, then press Write to store it. Reading is continuous — the Data-Out always shows the currently addressed cell. Reset clears every cell.',
  apps:['Main memory in every computer (DRAM/SRAM)','CPU cache and registers (same read/write principle, smaller & faster)','Scratch storage in any digital system'],
  theory:`<h4>Working principle</h4><p>RAM is organised as 2ⁿ addressable locations (here 16, using a 4-bit address). A decoder selects exactly one location; a Write pulse stores the Data-In bus value there, while Data-Out continuously reflects the selected cell — this is true read/write, volatile storage: it is lost on Reset or power-off.</p>`,
  inputs:[{id:'ADDR',type:'hex4',label:'Address'},{id:'DATA',type:'hex4',label:'Data In'},{id:'WRITE',type:'pulse',label:'Write'}],
  outputs:[],
  sim:{ mem:new Array(16).fill(0),
    step(vals,write){ if(write) this.mem[vals.ADDR]=vals.DATA; return {dataOut:this.mem[vals.ADDR]}; },
    reset(){ this.mem=new Array(16).fill(0); }
  }
});
MODELS.push({
  id:'rom', name:'ROM Memory', cat:'adv', kind:'mem', icon:'▤', diff:'Advanced',
  desc:'Non-volatile memory used to store fixed data.',
  objective:'This ROM is permanently programmed with a simple lookup function (output = address² mod 16). Change the address and watch the fixed value appear — ROM has no Write control at all.',
  apps:['Bootloaders / firmware storage','Lookup tables for math functions (sine tables, etc.)','Character generators for displays'],
  theory:`<h4>Working principle</h4><p>Unlike RAM, ROM content is fixed at manufacture (or programmed once, for PROM/EPROM variants) and survives power loss. An address decoder still selects one location, but there is no write path — only Data-Out exists.</p>`,
  inputs:[{id:'ADDR',type:'hex4',label:'Address'}],
  outputs:[],
  sim:{ mem:Array.from({length:16},(_,i)=>(i*i)%16),
    step(vals){ return {dataOut:this.mem[vals.ADDR]}; }, reset(){}
  }
});
MODELS.push({
  id:'alu', name:'ALU', cat:'adv', kind:'misc', icon:'Σ', diff:'Advanced',
  desc:'Performs arithmetic and logical operations on binary operands.',
  objective:'Pick two 4-bit operands A, B and cycle through operations (ADD, SUB, AND, OR, XOR, NOT A, INC, DEC) — the Zero, Carry and Negative flags update exactly as in a real CPU ALU.',
  apps:['The arithmetic/logic core of every CPU','Digital signal processing operations','Any circuit needing selectable math/logic operations'],
  theory:`<h4>Working principle</h4><p>A multiplexer-controlled bank of adders and gates. The 3-bit opcode selects which result is routed to the output bus. Flags: <code>Zero</code>=result==0, <code>Carry</code>=arithmetic overflow out of 4 bits, <code>Negative</code>=MSB of result (two's-complement sign bit).</p>`,
  inputs:[{id:'A',type:'hex4',label:'Operand A'},{id:'B',type:'hex4',label:'Operand B'},{id:'OP',type:'cycle',label:'Operation',options:['ADD','SUB','AND','OR','XOR','NOT A','INC A','DEC A']}],
  outputs:[],
  sim:{
    step(vals){ const A=vals.A,B=vals.B; let r=0,carry=0;
      switch(vals.OP){
        case 'ADD': r=A+B; carry=r>15?1:0; r&=15; break;
        case 'SUB': r=A-B; carry=A<B?1:0; r=(r+16)&15; break;
        case 'AND': r=A&B; break;
        case 'OR': r=A|B; break;
        case 'XOR': r=A^B; break;
        case 'NOT A': r=(~A)&15; break;
        case 'INC A': r=(A+1)&15; carry=(A+1)>15?1:0; break;
        case 'DEC A': r=(A-1+16)&15; break;
      }
      return {result:r, carry, zero:r===0?1:0, neg:(r>>3)&1};
    }, reset(){}
  }
});
MODELS.push({
  id:'cpu', name:'CPU Architecture', cat:'adv', kind:'misc', icon:'▣', diff:'Advanced',
  desc:'Shows the relationship between control, ALU, registers and memory.',
  objective:'Press Step to advance the conceptual fetch→decode→execute→write-back cycle. The Program Counter increments once per completed cycle, exactly mirroring how a real CPU sequences instructions. This is a conceptual/educational model, not a full instruction-set simulator.',
  apps:['Foundational model for understanding any CPU, from microcontrollers to desktop processors'],
  theory:`<h4>The fetch–decode–execute cycle</h4>
  <ul><li><b>Fetch:</b> Control Unit reads the instruction at the address in the Program Counter from Memory.</li>
  <li><b>Decode:</b> Control Unit interprets the instruction's opcode and operands.</li>
  <li><b>Execute:</b> The ALU performs the required operation using the Registers.</li>
  <li><b>Write-back:</b> The result is written back to a Register or Memory, and the Program Counter advances.</li></ul>
  <p>This repeats continuously — it is the heartbeat of every stored-program computer (the von Neumann architecture).</p>`,
  inputs:[{id:'STEP',type:'pulse',label:'Step cycle',free:true}],
  outputs:[],
  sim:{ phase:0, pc:0, phases:['FETCH','DECODE','EXECUTE','WRITE-BACK'],
    step(){ this.phase=(this.phase+1)%4; if(this.phase===0) this.pc=(this.pc+1)&15; return {phase:this.phases[this.phase],pc:this.pc}; },
    reset(){ this.phase=0; this.pc=0; }
  }
});

// ---------------------------------------------------------------------------
export function byId(id){ return MODELS.find(m=>m.id===id); }
export function allBits(n){ const out=[]; for(let i=0;i<(1<<n);i++){ const row=[]; for(let b=n-1;b>=0;b--) row.push((i>>b)&1); out.push(row);} return out; }
