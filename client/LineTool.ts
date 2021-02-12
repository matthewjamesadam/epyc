import { DrawOp, DrawTool, ToolType } from './DrawTypes';

class LineOp implements DrawOp {
    isFullRender = false;
    points: [number, number, number, number] = [0, 0, 0, 0];
    colour = '';
    lineWidth = 1;

    render(context: CanvasRenderingContext2D): void {
        context.lineWidth = this.lineWidth;
        context.strokeStyle = this.colour;

        context.beginPath();
        context.moveTo(this.points[0], this.points[1]);
        context.lineTo(this.points[2], this.points[3]);

        context.stroke();
    }
}

export default class LineTool extends DrawTool {
    type = ToolType.line;
    name = 'Line';
    op = new LineOp();
    isActive = false;

    render(context: CanvasRenderingContext2D) {
        if (this.isActive) {
            this.op.render(context);
        }
    }

    onPointerDown(e: PointerEvent): void {
        this.op.points[0] = e.offsetX;
        this.op.points[1] = e.offsetY;
        this.op.points[2] = e.offsetX;
        this.op.points[3] = e.offsetY;
        this.op.colour = this.manager.strokeColour;
        this.op.lineWidth = this.manager.lineWidth;
        this.isActive = true;
        this.manager.rerender();
    }

    onPointerUp(e: PointerEvent): void {
        this.isActive = false;
        this.manager.addOp(this.op);
        this.op = new LineOp();
        this.manager.rerender();
    }

    onPointerMove(e: PointerEvent): void {
        this.op.points[2] = e.offsetX;
        this.op.points[3] = e.offsetY;
        this.manager.rerender();
    }
}
