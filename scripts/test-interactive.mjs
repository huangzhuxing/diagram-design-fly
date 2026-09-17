import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../skills/diagram-design-fly/assets/interactive');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(base,'runtime.js'),'utf8'),ctx);
const R=ctx.DiagramInteractive;
let checks=0;
function test(name,fn){fn();checks++;console.log('OK '+name);}
const spec=JSON.parse(fs.readFileSync(path.join(base,'transformer.json'),'utf8'));
vm.runInContext(fs.readFileSync(path.join(base,'transformer-model.js'),'utf8'),ctx);
const model=ctx.DiagramModel;
test('valid shipped metadata',()=>assert.equal(R.validate(spec).length,0));
test('seek backwards discards future input events',()=>{
 assert.equal(R.at(spec,11).input.temperature,1.8);assert.equal(R.at(spec,2).input.temperature,.8);
 assert.equal(R.at(spec,9).input.layer,'1');assert.equal(R.at(spec,1).input.layer,'0');
});
test('models do not mutate state and reproduce each frame',()=>{
 const state=R.at(spec,8),before=JSON.stringify(state);
 assert.equal(JSON.stringify(R.scene(spec,state,model)),JSON.stringify(R.scene(spec,state,model)));
 assert.equal(JSON.stringify(state),before);
});
test('causal attention row sums and future masking for every layer/head',()=>{
 const data=ctx.TransformerMath.run(['a','b','c','d','e','f']);
 for(const b of data.layers)for(const head of b.attention)head.forEach((row,i)=>{
  assert.ok(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-10);
  row.forEach((v,j)=>{if(j>i)assert.equal(v,0);});
 });
});
test('earlier tokens cannot depend on future tokens',()=>{
 const a=ctx.TransformerMath.run(['a','b','c']),b=ctx.TransformerMath.run(['a','b','different']);
 for(let l=0;l<3;l++)assert.equal(JSON.stringify(a.layers[l].output[1]),JSON.stringify(b.layers[l].output[1]));
});
test('attention head and block selection change inspected computation',()=>{
 const data=ctx.TransformerMath.run(['a','b','c']);
 assert.notEqual(JSON.stringify(data.layers[0].attention[0]),JSON.stringify(data.layers[0].attention[1]));
 assert.notEqual(JSON.stringify(data.layers[0].merged),JSON.stringify(data.layers[1].merged));
});
test('temperature preserves normalization and increases entropy',()=>{
 const logits=[2,1,-1,.5],soft=ctx.TransformerMath.soft;
 const a=soft(logits.map(x=>x/.2)),b=soft(logits.map(x=>x/2));
 const entropy=p=>-p.reduce((s,x)=>s+x*Math.log(x),0);
 assert.ok(entropy(b)>entropy(a));assert.ok(Math.abs(b.reduce((s,x)=>s+x,0)-1)<1e-10);
});
test('all input boundaries produce finite in-bounds scenes',()=>{
 for(const tokens of ['', 'a', 'a b c d e f g', '<script>alert(1)</script>'])for(const layer of ['0','1','2'])for(const head of ['0','1','2','3']){
  const state=R.initial(spec);state.input={...state.input,tokens,layer,head};
  const s=R.scene(spec,state,model);assert.equal(R.validateScene(s).length,0);
  const markup=R.svg(s,state);assert.ok(!markup.includes('<script>alert'));
 }
});
test('invalid edges, unknown primitives and bad ranges fail validation',()=>{
 const state=R.initial(spec),s=R.scene(spec,state,model);s.edges[0].to='missing';assert.ok(R.validateScene(s).length);
 s.nodes[0].kind='unknown';assert.ok(R.validateScene(s).length>1);
 const bad=structuredClone(spec);bad.controls[3].max=-1;assert.ok(R.validate(bad).length);
});
test('cubic endpoints and midpoint match independent geometry',()=>{
 const p=[[0,0],[0,10],[10,10],[10,0]];
 assert.equal(JSON.stringify(R.point(p,0)),'[0,0]');assert.equal(JSON.stringify(R.point(p,1)),'[10,0]');
 assert.equal(JSON.stringify(R.point(p,.5)),'[5,7.5]');
});
test('packets appear only in their declared interval; static frame remains complete',()=>{
 const s=R.scene(spec,R.initial(spec),model);
 assert.ok(R.svg(s,{time:1,selected:''}).includes('data-packet="e1"'));
 assert.ok(!R.svg(s,{time:3,selected:''}).includes('data-packet="e1"'));
 const html=R.svg(s,{time:1,selected:''},true);assert.ok(!html.includes('data-packet'));assert.equal((html.match(/data-node=/g)||[]).length,8);
});
const queue=JSON.parse(fs.readFileSync(path.join(base,'queue.json'),'utf8'));
vm.runInContext(fs.readFileSync(path.join(base,'queue-model.js'),'utf8'),ctx);
test('queue model conserves arrivals across overload and underload boundaries',()=>{
 for(const arrival of [1,18,30])for(const service of [1,10,30])for(const capacity of [10,100])for(const time of [0,1,5,10]){
  const state={input:{arrival,service,capacity},time,selected:''};const s=R.scene(queue,state,ctx.DiagramModel);
  assert.equal(R.validateScene(s).length,0);
  const q=s.nodes.find(n=>n.id==='queue').values[0],out=s.nodes.find(n=>n.id==='result').values;
  assert.ok(Math.abs(arrival*time-q-out[0]-out[1])<1e-10);
 }
});
test('overlap and color-versus-height encoding failures are caught',()=>{
 const s=R.scene(queue,R.initial(queue),ctx.DiagramModel);
 s.nodes[1].x=s.nodes[0].x;assert.ok(R.validateScene(s).some(e=>e.includes('overlapping')));
 const series={...queue,nodes:[{id:'series',kind:'sparkline',label:'Litres',x:40,y:40,w:400,h:220,values:[0,10,20],labels:['0 min','5 min','10 min']}],edges:[]};
 assert.equal(R.validateScene(series).length,0);
 const markup=R.svg(series,{time:0,selected:''});
 assert.ok(markup.includes('data-series="series"'));
 const pts=markup.match(/data-series="series" points="([^"]+)"/)[1].split(' ').map(p=>p.split(',').map(Number));
 assert.ok(pts[0][1]>pts[1][1] && pts[1][1]>pts[2][1]);
});
console.log(`${checks} meaningful invariant groups passed`);
