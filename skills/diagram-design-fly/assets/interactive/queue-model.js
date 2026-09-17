/* Rates are held constant for the entire selected time window. Changing an input
   recomputes that scenario from t=0; it is not an event-history queue simulator. */
globalThis.DiagramModel=function(input,{time}){
 const a=+input.arrival,s=+input.service,c=+input.capacity,t=time;
 const processed=Math.min(a,s)*t,queued=Math.min(c,Math.max(0,(a-s)*t)),dropped=Math.max(0,(a-s)*t-c);
 return {nodes:[
  {id:'source',label:'01 · 请求到达',x:30,y:100,w:210,h:180,lines:[`${a} 请求 / 秒`,`累计 ${Math.round(a*t)} 个`],detail:'流体近似：请求以固定速率连续到达，不模拟离散抖动。'},
  {id:'queue',label:'02 · 有限队列',x:340,y:100,w:240,h:230,kind:'bars',values:[queued,c-queued],labels:['已占用','空余'],max:c,detail:'队列积累速度为 max(到达速率 − 处理速率, 0)。超过容量的部分计入丢弃。'},
  {id:'worker',label:'03 · 处理服务',x:680,y:100,w:210,h:180,lines:[`${s} 请求 / 秒`,`累计处理 ${Math.round(processed)}`],detail:'处理能力高于到达速率时，实际吞吐受输入限制。参数修改后从空队列重新计算。'},
  {id:'result',label:'04 · 结果',x:970,y:100,w:200,h:210,kind:'bars',values:[processed,dropped],labels:['已处理','已丢弃'],max:Math.max(a*t,1),detail:'守恒关系：累计到达 = 已处理 + 当前排队 + 已丢弃。显示值经过四舍五入。'}
 ],edges:[{id:'in',from:'source',to:'queue',start:0,end:3,label:`${a}/s`},{id:'work',from:'queue',to:'worker',start:3,end:6},{id:'out',from:'worker',to:'result',start:6,end:10}],summaryTitle:a>s?'瓶颈在处理端':'处理能力充足',summary:`当前查看第 ${t.toFixed(1)} 秒。从空队列开始，固定当前参数计算整个时段。拖动进度条可比较任意时刻；修改参数会回到 0 秒。`,metrics:`到达 ${(a*t).toFixed(1)} = 处理 ${processed.toFixed(1)} + 排队 ${queued.toFixed(1)} + 丢弃 ${dropped.toFixed(1)}`};
};
