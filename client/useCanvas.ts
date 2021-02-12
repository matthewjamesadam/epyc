import * as React from 'react';

export interface ICanvasTarget {
    setCanvasRef(ref: HTMLCanvasElement | null): void;
}

/*
    Allow binding a canvas element to an arbitrary object that will be responsible
    for rendering the canvas.

    This is tricky because both the canvas and rendering target are created asynchronously.
    This hook binds the two objects together.

    The argument is a function that will create the rendering target.  It will be sent the
    canbas ref whenever the canvas element is created, or null when it is destroyed.
*/
export function useCanvas<T extends ICanvasTarget>(
    targetCreateFn: () => T
): [T | null, React.RefCallback<HTMLCanvasElement>] {
    const [target, setTarget] = React.useState<T | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

    React.useEffect(() => {
        const newTarget = targetCreateFn();
        setTarget(newTarget);

        if (canvasRef.current) {
            newTarget.setCanvasRef(canvasRef.current);
        }
    }, []);

    const refCallback = React.useCallback((r) => {
        target?.setCanvasRef(r);
        canvasRef.current = r;
    }, []);

    return [target, refCallback];
}
