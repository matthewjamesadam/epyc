import * as React from 'react';
import { ResizingCanvas } from './ResizingCanvas';

const QUOTE_ROUNDING = 10;
const QUOTE_TAIL = 10;
const QUOTE_TAIL_Y = 50;

function DrawQuoteFrame(canvas: HTMLCanvasElement, bounds: DOMRectReadOnly) {
    const context = canvas.getContext('2d');
    if (!context) {
        return;
    }

    context.clearRect(0, 0, bounds.width, bounds.height);

    const bubbleBounds = new DOMRectReadOnly(
        bounds.left + QUOTE_TAIL,
        bounds.top,
        bounds.width - QUOTE_TAIL,
        bounds.height
    );

    context.beginPath();
    context.moveTo(bubbleBounds.left + QUOTE_ROUNDING, bubbleBounds.top);
    context.arcTo(
        bubbleBounds.left,
        bubbleBounds.top,
        bubbleBounds.left,
        bubbleBounds.top + QUOTE_ROUNDING,
        QUOTE_ROUNDING
    );

    context.lineTo(bubbleBounds.left, QUOTE_TAIL_Y - QUOTE_TAIL);
    context.arcTo(bubbleBounds.left, QUOTE_TAIL_Y, bounds.left, QUOTE_TAIL_Y, QUOTE_TAIL);
    context.arcTo(bubbleBounds.left, QUOTE_TAIL_Y, bubbleBounds.left, QUOTE_TAIL_Y + QUOTE_TAIL, QUOTE_TAIL);

    context.lineTo(bubbleBounds.left, bubbleBounds.bottom - QUOTE_ROUNDING);
    context.arcTo(
        bubbleBounds.left,
        bubbleBounds.bottom,
        bubbleBounds.left + QUOTE_ROUNDING,
        bubbleBounds.bottom,
        QUOTE_ROUNDING
    );

    context.lineTo(bubbleBounds.right - QUOTE_ROUNDING, bubbleBounds.bottom);
    context.arcTo(
        bubbleBounds.right,
        bubbleBounds.bottom,
        bubbleBounds.right,
        bubbleBounds.bottom - QUOTE_ROUNDING,
        QUOTE_ROUNDING
    );

    context.lineTo(bubbleBounds.right, bubbleBounds.top + QUOTE_ROUNDING);
    context.arcTo(
        bubbleBounds.right,
        bubbleBounds.top,
        bubbleBounds.right - QUOTE_ROUNDING,
        bubbleBounds.top,
        QUOTE_ROUNDING
    );

    context.closePath();

    context.fillStyle = '#ffffff';
    context.fill();

    context.globalCompositeOperation = 'source-atop';

    context.shadowBlur = 5;
    context.shadowColor = 'rgba(150, 150, 150, 1)';

    context.strokeStyle = '#bbbbbb';
    context.stroke();

    context.globalCompositeOperation = 'source-over';
    console.log('drawwwww');
}

export function Quote(props: { children: React.ReactNode }) {
    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}>
                <ResizingCanvas drawFn={DrawQuoteFrame} />
            </div>

            <div
                style={{
                    position: 'relative',
                    marginTop: '2rem',
                    marginLeft: '2.5rem',
                    marginRight: '2rem',
                    marginBottom: '2rem',
                }}
            >
                {props.children}
            </div>
        </div>
    );
}
