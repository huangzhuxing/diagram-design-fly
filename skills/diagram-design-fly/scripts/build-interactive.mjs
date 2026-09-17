#!/usr/bin/env node
/** Build a portable HTML: node build-interactive.mjs scene.json --out demo.html [--model model.js] */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/interactive');
const args=process.argv.slice(2), flag=(key,fallback)=>{const i=args.indexOf('--'+key);return i<0?fallback:args[i+1];};
if(!args[0])throw Error('Usage: build-interactive.mjs scene.json --out demo.html [--model model.js]');
const spec=JSON.parse(fs.readFileSync(args[0],'utf8'));
const runtime=fs.readFileSync(path.join(base,'runtime.js'),'utf8');
const model=flag('model')?fs.readFileSync(flag('model'),'utf8'):'';
// Models are authored local JavaScript, executed during build. vm is not a security boundary.
const context=vm.createContext({});
vm.runInContext(runtime,context,{timeout:2000});
if(model)vm.runInContext(model,context,{timeout:2000});
context.spec=spec;
const errors=vm.runInContext('DiagramInteractive.validate(spec)',context);
if(errors.length)throw Error(errors.join('\n'));
const s=vm.runInContext('DiagramInteractive.scene(spec,DiagramInteractive.initial(spec),globalThis.DiagramModel)',context,{timeout:2000});
const samples=[context.DiagramInteractive.initial(spec), ...[spec.duration/2,spec.duration,...(spec.timeline || []).map(e=>e.at)].map(t=>context.DiagramInteractive.at(spec,t))];
for(const c of spec.controls || []) {
  const values=c.type==='range'?[c.min,c.max]:c.type==='select'?c.options.map(o=>o.value):['',c.value];
  for(const value of values) samples.push(context.DiagramInteractive.action(spec,context.DiagramInteractive.initial(spec),{type:'input',id:c.id,value}));
}
for(const state of samples) {
  context.sampleState=state;
  const sampled=vm.runInContext('DiagramInteractive.scene(spec,sampleState,globalThis.DiagramModel)',context,{timeout:2000});
  const sceneErrors=context.DiagramInteractive.validateScene(sampled);
  if(sceneErrors.length)throw Error(JSON.stringify(state.input)+' at '+state.time+'s: '+sceneErrors.join('\n'));
}
const esc=context.DiagramInteractive.esc;
const svg=context.DiagramInteractive.svg(s,context.DiagramInteractive.initial(spec),true);
const css=fs.readFileSync(path.join(base,'style.css'),'utf8');
const theme=Object.entries(spec.theme || {}).map(([key,value])=>{if(!['paper','panel','ink','muted','line','accent'].includes(key)||!/^#[0-9a-f]{6}$/i.test(value))throw Error('theme accepts six-digit hex semantic colors');return `--${key}:${value}`;}).join(';');
const safeScript=t=>t.replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html>
<html lang="${esc(spec.lang || 'zh-CN')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(spec.title)}</title><style>${css}\n:root{${theme}}</style></head><body>
<main class="diagram-interactive" data-motion-root data-motion-mode="interactive" data-interactive-version="1" data-export-width="${spec.exportWidth || 1440}" data-export-height="${spec.exportHeight || 900}" data-duration="${spec.duration}">
<header><div class="eyebrow">${esc(spec.eyebrow || 'Diagram Design Fly · Interactive')}</div><h1>${esc(spec.title)}</h1><p>${esc(spec.description)}</p></header>
<div class="workspace"><div class="toolbar" data-ui hidden>${context.DiagramInteractive.controls(spec)}<div class="playback"><button data-action="play">▶ 播放</button><button data-action="reset">重置</button>${spec.timeline?.length?'<button data-action="tour">演示预设</button>':'<button data-action="tour" hidden>演示预设</button>'}<label>进度<input class="scrub" data-time type="range" min="0" max="${spec.duration}" step="0.01" value="0"></label><span class="clock" data-clock></span><button data-action="expand">沉浸模式</button></div></div>
<div class="stage-scroll" tabindex="0" role="region" aria-label="可横向滚动的交互图表"><div data-stage>${svg}</div></div><div class="details"><strong data-detail-title>${esc(s.summaryTitle || '探索这张图')}</strong><p data-detail>${esc(s.summary || spec.description)}</p></div><div class="metrics" data-metrics>${esc(s.metrics || '')}</div></div>
<noscript>当前显示默认参数的完整静态图。启用 JavaScript 后可调整参数与播放。</noscript>
<p class="hint">${esc(spec.hint || '点击节点查看细节 · 调整参数观察变化 · 播放一次后停止')}</p><div data-status class="status" role="status" aria-live="polite"></div></main>
<script type="application/json" data-diagram-spec>${JSON.stringify(spec).replace(/</g,'\\u003c')}</script>
<script data-diagram-model>${safeScript(model)}</script>
<script data-diagram-runtime>${safeScript(runtime)}</script>
<script data-diagram-boot>(()=>{const root=document.querySelector('[data-interactive-version]');try{const spec=JSON.parse(document.querySelector('[data-diagram-spec]').textContent);window.diagram=DiagramInteractive.mount(root,spec,globalThis.DiagramModel);window.diagramReady=true;}catch(error){root.querySelector('[data-status]').textContent='交互初始化失败，显示静态图。';window.diagramError=String(error);console.error(error);}})();</script>
</body></html>`;
const out=path.resolve(flag('out',args[0].replace(/\.json$/,'.html')));
if(out===path.resolve(args[0]))throw Error('--out must differ from input');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,html);console.log(out);
