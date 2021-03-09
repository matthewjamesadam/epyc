import * as React from 'react';

/// <reference types="resize-observer-browser" />

export function useResizeObserver<T extends HTMLElement>(
    cb?: (element: T, bounds: DOMRectReadOnly) => void
): [React.RefObject<T>, number, number] {
    const [width, setWidth] = React.useState<number>(0);
    const [height, setHeight] = React.useState<number>(0);
    const elementRef = React.useRef<T>(null);

    // Whenever the element ref changes, re-observe
    React.useEffect(() => {
        const element = elementRef.current;

        if (!element) {
            return;
        }

        let observer: ResizeObserver | null = new ResizeObserver((entries: ResizeObserverEntry[]) => {
            if (cb) {
                cb(element, entries[0].contentRect);
            }

            setWidth(entries[0].contentRect.width);
            setHeight(entries[0].contentRect.height);
        });

        observer.observe(element);

        return () => {
            observer?.disconnect();
            observer = null;
        };
    }, [elementRef, cb]);

    return [elementRef, width, height];
}
