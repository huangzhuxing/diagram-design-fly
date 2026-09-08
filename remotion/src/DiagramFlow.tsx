import React, {useEffect, useState} from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type DiagramFlowProps = {
  /** Every `<style>` block lifted verbatim out of the source diagram. */
  css: string;
  /** The first `<svg>…</svg>` block of the source diagram, verbatim. */
  svg: string;
  /**
   * Attributes lifted off the source `[data-motion-root]`. Flow CSS is scoped
   * as `[data-motion-mode="flow"] .flow-stream`, so these have to be replayed
   * onto the wrapper or every animation stays switched off.
   */
  rootAttrs: Record<string, string>;
  /** Google Fonts (or any) stylesheet URLs the source diagram linked. */
  fontHrefs: string[];
  /** Page background, taken from the diagram's `--color-paper`. */
  background: string;
  /** Uniform padding around the diagram, in composition pixels. */
  padding: number;

  /*
   * Composition geometry travels in the props rather than on the command line.
   * `--frames` can only select a subrange of an already-declared duration, so a
   * diagram whose cycle is longer than the default would be truncated by the
   * CLI. Resolving all four through `calculateMetadata` lets the source file
   * decide its own size and length.
   */
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

/**
 * Freeze every CSS animation at an exact time, without reimplementing any of it.
 *
 * `animation-play-state: paused` stops the clock; a negative `animation-delay`
 * seeks it. Together they render the authored keyframes at exactly `seconds`.
 *
 * The delay is expressed as `calc(var(--flow-delay, 0s) - Ns)` so each element
 * keeps the phase offset it declared. A conduit authored with
 * `--flow-delay: -.6s` stays .6s ahead of its neighbour in the video exactly as
 * it does in the browser — the per-element phase survives the seek.
 *
 * This is why the video and the live HTML cannot drift: they run the same
 * keyframes, from the same stylesheet, differing only in who advances the clock.
 */
const freezeAt = (seconds: number) => `
  *, *::before, *::after {
    animation-play-state: paused !important;
    animation-delay: calc(var(--flow-delay, 0s) - ${seconds}s) !important;
  }
`;

/**
 * The source stylesheet was written for a standalone page: it centres itself in
 * the viewport and floors the SVG at a print-safe minimum width. Inside a
 * fixed-size composition both work against us, so they are neutralised here
 * rather than stripped from the source — the diagram stays a valid page on disk.
 */
const COMPOSITION_RESET = `
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
    display: block !important;
    background: transparent !important;
  }
  [data-motion-root] { width: 100% !important; }
  svg {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    min-width: 0 !important;
  }
`;

export const DiagramFlow: React.FC<DiagramFlowProps> = ({
  css,
  svg,
  rootAttrs,
  fontHrefs,
  background,
  padding,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;

  // Hold the first frame until webfonts are in — otherwise frame 0 renders in a
  // fallback face and the whole clip inherits a one-frame typography pop.
  const [handle] = useState(() => delayRender('Waiting for diagram webfonts'));
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) {
        continueRender(handle);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <AbsoluteFill style={{background, padding, justifyContent: 'center'}}>
      {fontHrefs.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      <style dangerouslySetInnerHTML={{__html: css}} />
      <style dangerouslySetInnerHTML={{__html: COMPOSITION_RESET}} />
      <style dangerouslySetInnerHTML={{__html: freezeAt(seconds)}} />
      <div
        {...rootAttrs}
        style={{width: '100%'}}
        dangerouslySetInnerHTML={{__html: svg}}
      />
    </AbsoluteFill>
  );
};
