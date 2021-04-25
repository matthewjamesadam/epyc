import { DrawOp, DrawTool, IconType, ToolType } from './DrawTypes';

class PencilOp implements DrawOp {
    isFullRender = false;
    points = new Array<[number, number]>();
    colour = '';
    lineWidth = 1;

    render(context: CanvasRenderingContext2D) {
        if (this.points.length === 1) {
            context.beginPath();
            context.moveTo(this.points[0][0], this.points[0][1]);
            context.lineTo(this.points[0][0], this.points[0][1]);

            context.strokeStyle = this.colour;
            context.lineWidth = this.lineWidth;
            context.stroke();
        }

        if (this.points.length > 1) {
            context.beginPath();
            context.moveTo(this.points[0][0], this.points[0][1]);

            for (let i = 1; i < this.points.length; ++i) {
                context.lineTo(this.points[i][0], this.points[i][1]);
            }

            context.strokeStyle = this.colour;
            context.lineWidth = this.lineWidth;
            context.stroke();
        }
    }
}

export default class PencilTool extends DrawTool {
    type = ToolType.pencil;
    name = 'Pencil';
    icon: IconType = 'pencil';

    drawing = false;

    op = new PencilOp();

    onPointerDown(e: PointerEvent) {
        this.drawing = true;
        this.op.colour = this.manager.strokeColour;
        this.op.lineWidth = this.manager.lineWidth;
        this.op.points.push([e.offsetX, e.offsetY]);
        this.manager.rerender();

        this.manager.addColour(this.manager.strokeColour);
    }

    onPointerUp(e: PointerEvent) {
        this.drawing = false;
        console.log(`*** Stuff: ${this.op.points.length}`);
        this.manager.addOp(this.op);
        this.op = new PencilOp();
    }

    onPointerMove(e: PointerEvent) {
        if (this.drawing) {
            this.op.points.push([e.offsetX, e.offsetY]);
            this.manager.rerender();
        }
    }

    render(context: CanvasRenderingContext2D) {
        if (this.drawing) {
            this.op.render(context);
        }
    }
}
