/* Diagram Design Fly interactive runtime. MIT. No network or dependencies. */
(function (global) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const copy = x => JSON.parse(JSON.stringify(x));
  const number = (x, fallback = 0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
  const palette = ['#7c8f6f', '#9c6b50', '#6e6479', '#5e7a9b', '#b8915a'];
  function defaults(spec) { return Object.fromEntries((spec.controls || []).map(c => [c.id, c.value])); }
  function normalize(spec, input) {
    const result = defaults(spec);
    for (const c of spec.controls || []) {
      const value = input[c.id] ?? result[c.id];
      if (c.type === 'range') result[c.id] = clamp(number(value, c.value), c.min, c.max);
      else if (c.type === 'select') result[c.id] = c.options.some(o => String(o.value) === String(value)) ? String(value) : String(c.value);
      else result[c.id] = String(value).slice(0, c.maxLength || 120);
    }
    return result;
  }
  function initial(spec) { return {input: defaults(spec), selected: '', time: 0}; }
  function action(spec, state, event) {
    const next = copy(state);
    if (event.type === 'input') next.input = normalize(spec, {...next.input, [event.id]: event.value});
    else if (event.type === 'select') next.selected = String(event.id || '');
    else if (event.type === 'reset') return initial(spec);
    return next;
  }
  function at(spec, seconds) {
    let state = initial(spec);
    state.time = clamp(number(seconds), 0, spec.duration);
    for (const event of spec.timeline || []) if (event.at <= state.time) {
      const t = state.time;
      state = action(spec, state, event);
      state.time = t;
    }
    return state;
  }
  function scene(spec, state, model) {
    const derived = model ? model(copy(state.input), {time: state.time, selected: state.selected, seed: spec.seed || 1}) : {};
    return {...spec, ...derived, nodes: derived.nodes || spec.nodes || [], edges: derived.edges || spec.edges || []};
  }
  function validate(spec) {
    const errors = [];
    if (spec.version !== 1) errors.push('version must be 1');
    if (!/^[a-z][a-z0-9-]*$/.test(spec.id || '')) errors.push('id needs a lowercase slug');
    if (!spec.title || !spec.description) errors.push('title and description are required');
    if (!(spec.width >= 320 && spec.height >= 200 && spec.duration > 0 && spec.duration <= 300)) errors.push('width >= 320, height >= 200, duration 0..300 seconds required');
    const ids = new Set();
    for (const c of spec.controls || []) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(c.id || '') || ids.has(c.id)) errors.push('control IDs must be unique safe identifiers');
      ids.add(c.id);
      if (!c.label || !['text', 'range', 'select'].includes(c.type)) errors.push('controls need label and text/range/select type');
      if (c.type === 'range' && !(Number.isFinite(c.min) && c.max > c.min && c.value >= c.min && c.value <= c.max)) errors.push('invalid range ' + c.id);
      if (c.type === 'select' && !(c.options?.length && c.options.some(o => String(o.value) === String(c.value)))) errors.push('invalid select ' + c.id);
    }
    let previous = -1;
    for (const e of spec.timeline || []) {
      if (!(e.at >= previous && e.at >= 0 && e.at <= spec.duration)) errors.push('timeline must be sorted and within duration');
      if (!['input','select','reset'].includes(e.type)) errors.push('unknown timeline action');
      if (e.type === 'input' && !ids.has(e.id)) errors.push('unknown timeline control ' + e.id);
      previous = e.at;
    }
    return errors;
  }
  function validateScene(s) {
    const errors = [], ids = new Set();
    for (const n of s.nodes) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(n.id || '') || ids.has(n.id)) errors.push('node IDs must be unique safe identifiers');
      ids.add(n.id);
      if (!['card','vector','matrix','bars','stack','sparkline'].includes(n.kind || 'card')) errors.push('unknown node kind ' + n.kind);
      if (!n.label) errors.push('node label required');
      if (![n.x,n.y,n.w,n.h].every(Number.isFinite) || n.w <= 0 || n.h <= 0) errors.push('finite node x/y/w/h required: ' + n.id);
      if (n.x < 0 || n.y < 0 || n.x + n.w > s.width || n.y + n.h > s.height) errors.push('node outside viewBox: ' + n.id);
      if(['bars','sparkline','vector'].includes(n.kind) && !n.values?.length) errors.push('values required: '+n.id);
      if(n.kind==='bars' && n.values?.some(v=>v<0)) errors.push('bars require nonnegative values: '+n.id);
      const vals = (n.values || []).flat();
      if (vals.some(v => v !== null && !Number.isFinite(v))) errors.push('nonfinite values: ' + n.id);
      if (n.kind === 'matrix' && (!(n.values?.length) || !n.values.every(row => Array.isArray(row) && row.length === n.values[0].length))) errors.push('matrix must be rectangular');
    }
    for(let i=0;i<s.nodes.length;i++)for(let j=i+1;j<s.nodes.length;j++) {
      const a=s.nodes[i],b=s.nodes[j];
      if(a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y) errors.push('overlapping nodes: '+a.id+' / '+b.id);
    }
    const edges = new Set();
    for (const e of s.edges) {
      if (!e.id || edges.has(e.id)) errors.push('edge IDs must be unique');
      edges.add(e.id);
      if (!ids.has(e.from) || !ids.has(e.to)) errors.push('edge endpoint missing: ' + e.id);
      if (!(e.start >= 0 && e.end > e.start && e.end <= s.duration)) errors.push('edge needs start < end within duration: ' + e.id);
      if (e.points && (e.points.length !== 4 || !e.points.flat().every(Number.isFinite))) errors.push('edge points must be four [x,y] cubic control points');
    }
    return errors;
  }
  function points(edge, nodes) {
    if (edge.points) return edge.points;
    const a = nodes.find(n => n.id === edge.from), b = nodes.find(n => n.id === edge.to);
    const x = a.x + a.w, y = a.y + a.h/2, xx = b.x, yy = b.y + b.h/2;
    return [[x,y],[x+(xx-x)/2,y],[x+(xx-x)/2,yy],[xx,yy]];
  }
  function point(p, t) {
    return [0,1].map(i => (1-t)**3*p[0][i]+3*(1-t)**2*t*p[1][i]+3*(1-t)*t*t*p[2][i]+t**3*p[3][i]);
  }
  const text = (x,y,value,cls='',extra='') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(value)}</text>`;
  function node(n, index, selected) {
    const col = n.color || palette[index % palette.length];
    const depth=n.kind==='stack'?(Math.min(8,n.count || 3)-1)*5:0;
    const x=n.x, y=n.y, w=n.w-depth, h=n.h-depth;
    let content = '';
    if (n.kind === 'stack') {
      for (let i=Math.min(8,n.count || 3)-1;i>0;i--) content += `<rect x="${x+i*5}" y="${y+i*5}" width="${w}" height="${h}" rx="10" fill="var(--panel)" stroke="${esc(col)}" opacity=".55"/>`;
    }
    content += `<rect class="node-surface" x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="var(--panel)" stroke="${esc(col)}" stroke-width="${selected===n.id?3:1.2}"/>`;
    content += `<path d="M${x+12} ${y+12}h20" stroke="${esc(col)}" stroke-width="3"/>`;
    content += text(x+12,y+36,n.label,'node-label');
    if(n.subtitle) content += text(x+12,y+55,n.subtitle,'node-subtitle');
    const top=y+70, inner=w-24, room=h-82;
    if (n.kind === 'vector' && n.values?.length) {
      const step=inner/n.values.length;
      n.values.forEach((v,i)=>{content+=`<rect x="${x+12+i*step}" y="${top}" width="${Math.max(1,step-3)}" height="${Math.min(34,room)}" rx="2" fill="${esc(col)}" fill-opacity="${.15+.8*clamp(Math.abs(v),0,1)}"><title>${esc(n.labels?.[i] || i+1)}: ${v.toFixed(3)}</title></rect>`;});
    } else if (n.kind === 'matrix' && n.values?.length) {
      const rows=n.values.length, cols=n.values[0].length, size=Math.min(inner/(cols+1),room/(rows+1),42), ox=x+12+size, oy=top+size;
      n.values.forEach((row,r)=>{
        content+=text(ox-5,oy+r*size+size*.6,n.labels?.[r] || r+1,'cell-label','text-anchor="end"');
        row.forEach((v,c)=>{if(r===0)content+=text(ox+c*size+size/2,oy-8,n.labels?.[c] || c+1,'cell-label','text-anchor="middle"');content+=`<rect x="${ox+c*size}" y="${oy+r*size}" width="${size-2}" height="${size-2}" rx="3" fill="${esc(col)}" fill-opacity="${v===null?.04:.10+.35*clamp(v,0,1)}"/>`+text(ox+c*size+size/2,oy+r*size+size*.6,v===null?'×':`${Math.round(v*100)}`,'cell-label','text-anchor="middle"');});
      });
    } else if (n.kind === 'sparkline' && n.values?.length) {
      const min=n.min ?? Math.min(0,...n.values), max=n.max ?? Math.max(...n.values,1);
      const ch=Math.max(20,room-30), cw=inner-34, ox=x+42, oy=top+ch;
      const pts=n.values.map((v,i)=>[ox+cw*i/Math.max(1,n.values.length-1),oy-ch*clamp((v-min)/(max-min || 1),0,1)]);
      content+=`<path d="M${ox} ${top}V${oy}H${ox+cw}" fill="none" stroke="var(--line)"/>`;
      content+=text(ox-5,top+8,Number(max.toFixed(2)),'cell-label','text-anchor="end"')+text(ox-5,oy,Number(min.toFixed(2)),'cell-label','text-anchor="end"');
      content+=`<polyline data-series="${esc(n.id)}" points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${esc(col)}" stroke-width="2.5"/>`;
      pts.forEach((p,i)=>{content+=`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${esc(col)}"><title>${esc(n.labels?.[i] || i+1)}: ${esc(n.values[i])}</title></circle>`;});
      content+=text(ox,oy+18,n.labels?.[0] || '0','cell-label')+text(ox+cw,oy+18,n.labels?.[n.values.length-1] || n.values.length,'cell-label','text-anchor="end"');
    } else if (n.kind === 'bars' && n.values?.length) {
      const step=Math.min(38,room/n.values.length), max=n.max || Math.max(...n.values,1);
      n.values.forEach((v,i)=>{const yy=top+i*step;content+=text(x+12,yy+10,n.labels?.[i] || i+1,'cell-label')+text(x+w-12,yy+10,n.format==='percent'?`${(v*100).toFixed(1)}%`:Number(v.toFixed(2)),'cell-label','text-anchor="end"');content+=`<rect x="${x+12}" y="${yy+17}" width="${inner}" height="5" rx="2" fill="${esc(col)}" opacity=".1"/><rect x="${x+12}" y="${yy+17}" width="${inner*clamp(v/max,0,1)}" height="5" rx="2" fill="${esc(col)}"/>`;});
    } else {
      (n.lines || []).forEach((line,i)=>{content+=text(x+12,top+i*22,line,'node-line');});
    }
    if(n.badge) content+=text(x+w-12,y+16,n.badge,'cell-label','text-anchor="end"');
    return `<g data-node="${esc(n.id)}" role="button" tabindex="0" aria-label="${esc(n.label+'。'+(n.detail || n.subtitle || ''))}" aria-pressed="${selected===n.id}"><title>${esc(n.detail || n.label)}</title>${content}</g>`;
  }
  function svg(s, state, staticFrame=false) {
    const selected=state.selected, relevant=new Set([selected]);
    s.edges.forEach(e=>{if(e.from===selected||e.to===selected){relevant.add(e.from);relevant.add(e.to);}});
    let body='';
    for(const e of s.edges){
      const p=points(e,s.nodes), col=e.color || '#4f5d75', active=!selected||e.from===selected||e.to===selected;
      const d=`M${p[0]} C${p[1]} ${p[2]} ${p[3]}`;
      body+=`<g opacity="${active?1:.18}"><path d="${d}" fill="none" stroke="${esc(col)}" stroke-width="${active&&selected?2.5:1.4}"/>`;
      if(e.label){const q=point(p,.5);body+=text(q[0],q[1]-10,e.label,'edge-label','text-anchor="middle"');}
      if(!staticFrame && state.time>=e.start&&state.time<e.end){const q=point(p,(state.time-e.start)/(e.end-e.start));body+=`<circle data-packet="${esc(e.id)}" cx="${q[0]}" cy="${q[1]}" r="5" fill="${esc(col)}" stroke="var(--paper)" stroke-width="2"/>`;}
      body+='</g>';
    }
    s.nodes.forEach((n,i)=>{body+=`<g opacity="${!selected||relevant.has(n.id)?1:.8}">${node(n,i,selected)}</g>`;});
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.width} ${s.height}" data-interactive-svg="1" data-diagram-id="${esc(s.id)}" role="group" aria-labelledby="${s.id}-title ${s.id}-desc"><title id="${s.id}-title">${esc(s.title)}</title><desc id="${s.id}-desc">${esc(s.description)}</desc>${body}</svg>`;
  }
  function controls(spec) {
    return (spec.controls || []).map(c=>{
      const id=esc(spec.id+'-'+c.id);
      const input=c.type==='select'?`<select id="${id}" data-input="${esc(c.id)}">${c.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(c.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`:`<input id="${id}" data-input="${esc(c.id)}" type="${c.type}" value="${esc(c.value)}" ${c.type==='range'?`min="${c.min}" max="${c.max}" step="${c.step || 1}"`:`maxlength="${c.maxLength || 120}"`}/>`;
      return `<label for="${id}">${esc(c.label)}${input}${c.type==='range'?`<output data-output="${esc(c.id)}">${esc(c.value)}</output>`:''}</label>`;
    }).join('');
  }
  function mount(root, spec, model) {
    if(root.diagram) return root.diagram;
    let state=initial(spec), current, playing=false, raf=0, previous=0, scripted=false;
    const $=s=>root.querySelector(s), reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const isStatic=new URLSearchParams(location.search).get('motion')==='static';
    const exporting=!!global.__DIAGRAM_EXPORT__;
    function render(full=true) {
      current=scene(spec,state,model);
      if(full){
        const focus=document.activeElement?.closest('[data-node]')?.dataset.node;
        $('[data-stage]').innerHTML=svg(current,state,isStatic||reduced.matches&&!exporting);
        if(focus) [...root.querySelectorAll('[data-node]')].find(e=>e.dataset.node===focus)?.focus({preventScroll:true});
        const selected=current.nodes.find(n=>n.id===state.selected);
        $('[data-detail-title]').textContent=selected?.label || current.summaryTitle || '探索这张图';
        $('[data-detail]').textContent=selected?.detail || current.summary || spec.description;
        $('[data-metrics]').textContent=current.metrics || '';
      } else {
        // The geometry is deterministic; animation does not measure DOM paths.
        $('[data-stage]').innerHTML=svg(current,state,reduced.matches&&!exporting);
      }
      $('[data-time]').value=String(state.time);
      $('[data-clock]').textContent=state.time.toFixed(1)+' / '+spec.duration+' s';
      $('[data-action="play"]').textContent=playing?'Ⅱ 暂停':'▶ 播放';
      root.dataset.time=state.time.toFixed(4);
    }
    function pause(){playing=false;cancelAnimationFrame(raf);raf=0;previous=0;}
    function syncControls(){for(const el of root.querySelectorAll('[data-input]')) {el.value=state.input[el.dataset.input];const out=[...root.querySelectorAll('[data-output]')].find(o=>o.dataset.output===el.dataset.input);if(out)out.value=el.value;}}
    function seek(t,{timeline=true}={}) {pause();scripted=timeline;state=timeline?at(spec,t):{...state,time:clamp(number(t),0,spec.duration)};syncControls();render();return snapshot();}
    function snapshot(){return copy({state,scene:current,playing});}
    function dispatch(e){if(isStatic)return snapshot();pause();scripted=false;state=action(spec,state,e);if(e.type==='input')state.time=0;syncControls();render();$('[data-status]').textContent='已更新：'+(current.metrics || current.title);return snapshot();}
    function tick(now){if(!playing)return;const dt=previous?(now-previous)/1000:0;previous=now;const t=Math.min(spec.duration,state.time+dt);state=scripted?at(spec,t):{...state,time:t};syncControls();if(t>=spec.duration)pause();render(true);if(playing)raf=requestAnimationFrame(tick);}
    function play(){if(isStatic||reduced.matches&&!exporting)return;if(playing){pause();render();return;}if(state.time>=spec.duration)state.time=0;playing=true;previous=0;raf=requestAnimationFrame(tick);render();}
    function activate(target){if(isStatic)return;const el=target.closest('[data-node]');if(el){const n=current.nodes.find(n=>n.id===el.dataset.node);dispatch(n?.action || {type:'select',id:el.dataset.node});}}
    root.addEventListener('click',e=>{
      const act=e.target.closest('[data-action]')?.dataset.action;
      if(act==='play')play();else if(act==='reset')dispatch({type:'reset'});else if(act==='tour'){seek(0);play();}else if(act==='expand'){root.classList.toggle('is-expanded');e.target.textContent=root.classList.contains('is-expanded')?'退出沉浸':'沉浸模式';}else activate(e.target);
    });
    root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-node]')){e.preventDefault();activate(e.target);}if(e.key==='Escape')root.classList.remove('is-expanded');});
    root.addEventListener('input',e=>{if(e.target.matches('[data-time]'))seek(e.target.value,{timeline:scripted});else if(e.target.matches('[data-input]'))dispatch({type:'input',id:e.target.dataset.input,value:e.target.value});});
    reduced.addEventListener('change',()=>{pause();render();$('[data-action="play"]').disabled=reduced.matches;$('[data-action="tour"]').disabled=reduced.matches;});
    const beforePrint=()=>{$('[data-stage]').innerHTML=svg(current,state,true);};
    const afterPrint=()=>render();
    global.addEventListener('beforeprint',beforePrint);global.addEventListener('afterprint',afterPrint);
    const api={seek,dispatch,snapshot,play,pause:()=>{pause();render();},destroy:()=>{pause();global.removeEventListener('beforeprint',beforePrint);global.removeEventListener('afterprint',afterPrint);}};
    root.diagram=api;
    for(const el of root.querySelectorAll('[data-input]')){
      el.id=spec.id+'-'+el.dataset.input;
      const label=el.closest('label');if(label)label.htmlFor=el.id;
    }
    render();
    if(!isStatic){root.classList.add('interactive-ready');$('[data-ui]').hidden=false;}
    $('[data-action="play"]').disabled=reduced.matches;$('[data-action="tour"]').disabled=reduced.matches;
    return api;
  }
  global.DiagramInteractive={esc,defaults,normalize,initial,action,at,scene,validate,validateScene,points,point,svg,controls,mount};
  if(typeof module!=='undefined')module.exports=global.DiagramInteractive;
})(typeof window==='undefined'?globalThis:window);
