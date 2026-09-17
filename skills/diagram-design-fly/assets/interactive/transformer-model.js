/* Original educational model: D=16, 4 heads of 4 dimensions, 3 pre-norm blocks.
   Deterministic untrained weights and a fixed 4-token vocabulary; not an LLM. */
(function(g){
  const D=16,H=4,F=32;
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const weights=(a,b,seed)=>Array.from({length:a},(_,i)=>Array.from({length:b},(_,j)=>Math.sin((i+1)*1.37+(j+1)*2.71+seed*3.17)*.22));
  const mul=(v,w)=>w[0].map((_,j)=>v.reduce((s,x,i)=>s+x*w[i][j],0));
  const soft=v=>{const m=Math.max(...v),a=v.map(x=>Math.exp(x-m)),s=a.reduce((x,y)=>x+y,0);return a.map(x=>x/s);};
  const norm=v=>{const m=v.reduce((a,b)=>a+b,0)/v.length,s=v.reduce((a,b)=>a+(b-m)**2,0)/v.length;return v.map(x=>(x-m)/Math.sqrt(s+1e-5));};
  function run(tokens){
    const embeddings=tokens.map((t,p)=>{const hash=Array.from(t).reduce((s,c)=>s*31+c.codePointAt(0),7)%65521;return Array.from({length:D},(_,j)=>Math.sin(hash+j*1.9)*.6+(j%2?Math.cos:Math.sin)(p/10000**(2*Math.floor(j/2)/D))*.2);});
    let X=embeddings;const layers=[];
    for(let l=0;l<3;l++){
      const N=X.map(norm),Q=N.map(v=>mul(v,weights(D,D,1+l*6))),K=N.map(v=>mul(v,weights(D,D,2+l*6))),V=N.map(v=>mul(v,weights(D,D,3+l*6)));
      const attention=Array.from({length:H},(_,h)=>Q.map((q,i)=>{const row=soft(K.slice(0,i+1).map(k=>dot(q.slice(h*4,h*4+4),k.slice(h*4,h*4+4))/2));return [...row,...Array(tokens.length-row.length).fill(0)];}));
      const merged=X.map((_,i)=>Array.from({length:H},(_,h)=>Array.from({length:4},(_,d)=>attention[h][i].reduce((s,a,j)=>s+a*V[j][h*4+d],0))).flat());
      const residual=X.map((v,i)=>add(v,mul(merged[i],weights(D,D,4+l*6))));
      const output=residual.map(v=>add(v,mul(mul(norm(v),weights(D,F,5+l*6)).map(x=>.5*x*(1+Math.tanh(Math.sqrt(2/Math.PI)*(x+.044715*x**3)))),weights(F,D,6+l*6))));
      layers.push({input:X,Q,K,V,attention,merged,output});X=output;
    }
    return {embeddings,layers,logits:mul(norm(X[X.length-1]),weights(D,4,99))};
  }
  g.TransformerMath={run,soft};
  g.DiagramModel=function(input){
    const tokens=String(input.tokens).trim().split(/\s+/).filter(Boolean).slice(0,6);if(!tokens.length)tokens.push('风');
    const data=run(tokens),l=Number(input.layer),h=Number(input.head),b=data.layers[l],last=tokens.length-1,probs=soft(data.logits.map(x=>x/Number(input.temperature)));
    const card=(id,label,x,y,w,hh,extra={})=>({id,label,x,y,w,h:hh,...extra});
    const nodes=[
      card('tokens','01 · 输入序列',24,90,170,190,{lines:tokens.map((t,i)=>`${i+1}  ${t}`),detail:'按空格分词，最多展示 6 个 Token。这里使用固定哈希词嵌入，未经训练。'}),
      card('embedding','02 · 词与位置',242,90,190,152,{kind:'vector',subtitle:'16 维 · 最后位置',values:data.embeddings[last],detail:'词内容向量与正弦位置编码逐元素相加。图中每格对应一个实际维度。'}),
      card('qkv','03 · Q / K / V',482,50,200,160,{kind:'vector',subtitle:`Head ${h+1} 的 Q · 4 维`,values:b.Q[last].slice(h*4,h*4+4),detail:'对归一化后的输入使用三组独立投影，生成查询 Q、键 K、值 V。切换 Head 可以查看不同子空间。',badge:`L${l+1} / H${h+1}`}),
      card('attention','04 · 因果注意力',480,300,260,260,{kind:'matrix',subtitle:'百分比 · 每行合计 100%',values:b.attention[h].map((row,i)=>row.map((v,j)=>j>i?null:v)),labels:tokens.map((_,i)=>i+1),detail:'先计算 QKᵀ / √4，再屏蔽未来位置并执行 Softmax。× 表示被屏蔽；逐格显示四舍五入后的百分比，未舍入行和为 1。'}),
      card('merge','05 · 汇聚上下文',790,90,185,155,{kind:'vector',subtitle:'4 × 4 → 16 维',values:b.merged[last],detail:'每个头按注意力权重汇聚 V；拼接四个头，再做输出投影。'}),
      card('ffn','06 · 残差与前馈',1025,90,185,160,{lines:['Pre-norm + 残差','16 → 32 → 16','GELU 非线性'],detail:'注意力输出与原输入相加；再次归一化后进入前馈网络，并加上第二条残差。'}),
      card('blocks',`Block ${l+1} / 3`,790,335,185,180,{kind:'stack',count:3,lines:['点击展开下一层','所有位置一起更新'],action:{type:'input',id:'layer',value:String((l+1)%3)},detail:'叠层代表三个独立参数的 Transformer Block。点击轮换当前展开层，上方的计算值同步更新。'}),
      card('prediction','07 · 下一词分布',1258,90,160,270,{kind:'bars',subtitle:`温度 T = ${input.temperature}`,values:probs,labels:['山','水','云','。'],format:'percent',max:1,detail:'最后位置经过三层后投影到固定的四词教学词表，再除以温度并 Softmax。未训练模型的概率不能解释为真实语言预测质量。'})
    ];
    const edges=[
      {id:'e1',from:'tokens',to:'embedding',start:0,end:2},
      {id:'e2',from:'embedding',to:'qkv',start:2,end:4},
      {id:'e3',from:'qkv',to:'attention',start:4,end:6,points:[[582,210],[582,240],[610,260],[610,300]],label:'匹配与 Mask'},
      {id:'e4',from:'attention',to:'merge',start:6,end:8,label:'权重 × V'},
      {id:'e5',from:'merge',to:'ffn',start:8,end:10},
      {id:'e6',from:'ffn',to:'prediction',start:10,end:12},
      {id:'residual',from:'embedding',to:'ffn',start:2,end:10,color:'#9c6b50',points:[[337,90],[337,8],[1117,8],[1117,90]],label:'残差旁路 · 保留输入'}
    ];
    return {nodes,edges,summaryTitle:'一次有边界的教学实验',summary:'从左向右追踪数据。点击矩阵查看解释，切换注意力头比较分配，点击叠层展开下一层。播放数据流只演示计算顺序；数值由当前输入完整计算。',metrics:`${tokens.length} 个 Token · 16 维 · 4 个头 · 3 层 · 实际前馈维度 32 · 未训练 / 固定词表`};
  };
})(globalThis);
