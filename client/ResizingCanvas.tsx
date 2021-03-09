import * as React from 'react';
import { useResizeObserver } from './useResizeObserver';

export type ResizingCanvasDrawFn = (canvas: HTMLCanvasElement, bounds: DOMRectReadOnly) => void;

/*
    The way canvas resolution works is bananas.  This is the only way I've figured out how to get
    a resizing canvas to use its correct resolution:

    * Use a parent div that sizes as expected with in its own parent
    * Use a ResizeObserver to track the div's size
    * Apply that size to a child canvas div that has its own absolute positioning
 */
export function ResizingCanvas(props: { drawFn: ResizingCanvasDrawFn }) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [outerDivRef, width, height] = useResizeObserver<HTMLDivElement>((element, bounds) => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        props.drawFn(canvas, bounds);
    });

    const dpr = window.devicePixelRatio;

    return (
        <div
            ref={outerDivRef}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
        >
            <canvas
                className="position-absolute"
                width={Math.floor(width * dpr)}
                height={Math.floor(height * dpr)}
                ref={canvasRef}
            />
        </div>
    );
}
