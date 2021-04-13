import { DrawOp, DrawTool, IconType, ToolType } from './DrawTypes';

class CircleOp implements DrawOp {
    isFullRender = false;
    points: [number, number, number, number] = [0, 0, 0, 0];
    colour = '';
    lineWidth = 1;

    render(context: CanvasRenderingContext2D): void {
        const left = Math.min(this.points[0], this.points[2]);
        const right = Math.max(this.points[0], this.points[2]);
        const top = Math.min(this.points[1], this.points[3]);
        const bottom = Math.max(this.points[1], this.points[3]);

        const centerX = left + (right - left) / 2;
        const centerY = top + (bottom - top) / 2;

        context.lineWidth = this.lineWidth;
        context.strokeStyle = this.colour;

        context.beginPath();
        context.ellipse(centerX, centerY, (right - left) / 2, (bottom - top) / 2, 0, 0, 2 * Math.PI);
        context.stroke();
    }
}

export default class CircleTool extends DrawTool {
    type = ToolType.circle;
    name = 'Circle';
    op = new CircleOp();
    isActive = false;
    icon: IconType = 'circle';

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
        this.op = new CircleOp();
        this.manager.rerender();
        this.manager.addColour(this.manager.strokeColour);
    }

    onPointerMove(e: PointerEvent): void {
        this.op.points[2] = e.offsetX;
        this.op.points[3] = e.offsetY;
        this.manager.rerender();
    }
}
