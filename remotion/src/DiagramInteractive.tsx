import React, {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';

export type DiagramInteractiveProps = {html:string; width:number; height:number; fps:number; durationInFrames:number};
type DiagramWindow = Window & {diagram?: {seek:(t:number)=>unknown}; diagramError?:string};

/** Run the exact portable artifact, seeking its pure timeline before each capture.
 * Only render locally authored/trusted HTML, just as when opening it in a browser.
 */
export const DiagramInteractive: React.FC<DiagramInteractiveProps> = ({html}) => {
  const frame=useCurrentFrame(); const {fps}=useVideoConfig();
  const iframe=useRef<HTMLIFrameElement>(null);
  const seconds=useRef(0); seconds.current=frame/fps;
  const [ready,setReady]=useState(false);
  const [handle]=useState(()=>delayRender('Initialize interactive diagram and fonts'));
  const srcDoc=useMemo(()=>html.replace(/<head>/i,'<head><script>window.__DIAGRAM_EXPORT__=true;document.documentElement.dataset.export="true";</script>'),[html]);
  useLayoutEffect(()=>{
    if(ready){
      try {(iframe.current?.contentWindow as DiagramWindow).diagram!.seek(frame/fps);}
      catch(error){cancelRender(error as Error);}
    }
  },[frame,fps,ready]);
  return <AbsoluteFill><iframe ref={iframe} title="Interactive diagram" srcDoc={srcDoc} style={{width:'100%',height:'100%',border:0}} onLoad={async()=>{
    try {
      const win=iframe.current?.contentWindow as DiagramWindow;
      if(!win.diagram)throw Error(win.diagramError || 'Interactive runtime did not initialize');
      await win.document.fonts.ready;
      win.diagram.seek(seconds.current);
      setReady(true); continueRender(handle);
    }catch(error){cancelRender(error as Error);}
  }}/></AbsoluteFill>;
};
