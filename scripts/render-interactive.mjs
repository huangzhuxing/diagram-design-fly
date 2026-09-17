#!/usr/bin/env node
/** Render an authored interactive HTML using its shared timeline. Supports --format mp4|webm|gif|png, --frame for PNG. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),flag=(key,d)=>{const i=args.indexOf('--'+key);return i<0?d:args[i+1];};
if(!args[0])throw Error('Provide interactive HTML');
const source=path.resolve(args[0]),html=readFileSync(source,'utf8');
if(!html.includes('data-motion-mode="interactive"'))throw Error('Expected interactive artifact');
const attr=(key,d)=>Number(html.match(new RegExp(key+'="([\\d.]+)"'))?.[1] || d);
const positive=(name,value)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)throw Error(name+' must be positive');return n;};
const width=Math.round(positive('width',flag('width',attr('data-export-width',1440)))/2)*2;
const height=Math.round(positive('height',flag('height',attr('data-export-height',900)))/2)*2;
const fps=positive('fps',flag('fps',30)),duration=positive('duration',flag('duration',attr('data-duration',10)));
const format=flag('format','mp4');if(!['mp4','webm','gif','png'].includes(format))throw Error('Unknown format');
const output=path.resolve(flag('out',source.replace(/\.html$/,'.'+format)));if(output===source)throw Error('Cannot overwrite source');
const dir=mkdtempSync(path.join(tmpdir(),'diagram-interactive-'));
mkdirSync(path.dirname(output),{recursive:true});
const props=path.join(dir,'props.json');writeFileSync(props,JSON.stringify({html,width,height,fps,durationInFrames:Math.max(1,Math.round(fps*duration))}));
const common=['src/index.ts','DiagramInteractive',`--props=${props}`,'--log=error',`--concurrency=${flag('concurrency',2)}`];
const run=(a)=>execFileSync(path.join(root,'remotion/node_modules/.bin/remotion'),a,{cwd:path.join(root,'remotion'),stdio:'inherit'});
try {
 if(format==='png')run(['still',...common,`--frame=${flag('frame',0)}`,output]);
 else if(format==='gif'){
  const frames=path.join(dir,'frames');run(['render',...common,'--sequence',frames]);
  const digits=readdirSync(frames).find(n=>n.endsWith('.png')).match(/element-(\d+)/)[1].length;
  const pattern=path.join(frames,`element-%0${digits}d.png`);
  execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',pattern,'-filter_complex','[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',output],{stdio:'inherit'});
 }else run(['render',...common,`--codec=${format==='mp4'?'h264':'vp9'}`,output]);
 console.log('Rendered '+output);
}finally{rmSync(dir,{recursive:true,force:true});}
