import React from 'react';
import {Composition} from 'remotion';
import {DiagramFlow, DiagramFlowProps} from './DiagramFlow';

/**
 * Placeholder props. `scripts/render-video.mjs` overrides all of these with the
 * real diagram via `--props`. They exist so `npm run studio` opens on something
 * rather than a blank frame.
 */
const defaultProps: DiagramFlowProps = {
  css: '',
  svg: '<svg viewBox="0 0 960 440" xmlns="http://www.w3.org/2000/svg"></svg>',
  rootAttrs: {'data-motion-mode': 'flow'},
  fontHrefs: [],
  background: '#f5f5f5',
  padding: 32,
  width: 1024,
  height: 504,
  fps: 30,
  durationInFrames: 96,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DiagramFlow"
      component={DiagramFlow}
      defaultProps={defaultProps}
      /*
       * The diagram is the authority on its own geometry: the viewBox sets the
       * aspect, and `data-flow-cycle` sets the duration that makes the loop
       * seamless. Resolving them here means one render call fits any source.
       */
      calculateMetadata={({props}) => ({
        width: props.width,
        height: props.height,
        fps: props.fps,
        durationInFrames: props.durationInFrames,
      })}
      width={defaultProps.width}
      height={defaultProps.height}
      fps={defaultProps.fps}
      durationInFrames={defaultProps.durationInFrames}
    />
  );
};
