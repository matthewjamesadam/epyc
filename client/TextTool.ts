import { DrawOp, DrawTool, IconType, ToolType } from './DrawTypes';
import * as React from 'react';
import TextToolInput from './TextToolInput';

class TextOp implements DrawOp {
    isFullRender = false;
    start: [number, number] = [0, 0];
    text = '';
    font = '';
    colour = '';

    render(context: CanvasRenderingContext2D): void {
        context.fillStyle = this.colour;
        context.font = this.font;
        context.textBaseline = 'top';

        const lines = this.text.split('\n');
        let y = this.start[1];

        lines.forEach((line) => {
            context.fillText(line, this.start[0], y);
            y += lineHeight;
        });
    }
}

enum TextToolState {
    inactive,
    enteringText,
    positioning,
}

const font = '15px sans-serif';
const lineHeight = 16;

export default class TextTool extends DrawTool {
    type = ToolType.text;
    name = 'Text';
    icon: IconType = 'text';
    state = TextToolState.inactive;
    text = '';
    start: [number, number] = [0, 0];

    render(context: CanvasRenderingContext2D) {}

    onTextChange(text: string) {
        this.text = text;
    }

    onPointerUp(e: PointerEvent): void {
        if (this.state === TextToolState.inactive) {
            this.text = '';
            this.manager.toolChildren = React.createElement(TextToolInput, {
                font,
                lineHeight,
                left: e.offsetX,
                top: e.offsetY,
                onChange: (text) => {
                    this.onTextChange(text);
                },
            });
            this.state = TextToolState.enteringText;
            this.start = [e.offsetX, e.offsetY];
        } else if (this.state === TextToolState.enteringText) {
            this.manager.toolChildren = null;

            const op = new TextOp();
            op.colour = this.manager.strokeColour;
            op.text = this.text;
            op.start = this.start;
            op.font = font;

            this.state = TextToolState.inactive;

            this.manager.addOp(op);
            this.manager.addColour(this.manager.strokeColour);
        }
    }
}
