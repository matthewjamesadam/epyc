import { CopyDataSource, DrawOp, DrawTool, ToolType } from './DrawTypes';

class PasteOp implements DrawOp {
    isFullRender = false;
    imageData: CopyDataSource;
    x = 0;
    y = 0;
    width: number;
    height: number;

    constructor(imageData: CopyDataSource) {
        this.imageData = imageData;
        this.width = imageData.width;
        this.height = imageData.height;
    }

    render(context: CanvasRenderingContext2D): void {
        context.drawImage(this.imageData, this.x, this.y);
    }
}

export default class PasteTool extends DrawTool {
    type = ToolType.paste;
    name = 'Paste';

    isActive = false;
    draggingPoint: [number, number] | null = null;
    op: PasteOp | null = null;

    render(context: CanvasRenderingContext2D) {
        if (this.isActive && this.op) {
            this.op.render(context);

            this.renderHandles(this.op, context, 10, 8, '#ffffff');
            this.renderHandles(this.op, context, 7, 1, '#000000');
        }
    }

    renderHandles(
        op: PasteOp,
        context: CanvasRenderingContext2D,
        handleSize: number,
        lineWidth: number,
        strokeStyle: string
    ) {
        const points = { left: op.x, top: op.y, right: op.x + op.width, bottom: op.y + op.height };

        context.lineWidth = lineWidth;
        context.strokeStyle = strokeStyle;

        context.beginPath();

        // top-left
        context.moveTo(points.left, points.top + handleSize);
        context.lineTo(points.left, points.top);
        context.lineTo(points.left + handleSize, points.top);

        // top-right
        context.moveTo(points.right, points.top + handleSize);
        context.lineTo(points.right, points.top);
        context.lineTo(points.right - handleSize, points.top);

        // bottom-left
        context.moveTo(points.left, points.bottom - handleSize);
        context.lineTo(points.left, points.bottom);
        context.lineTo(points.left + handleSize, points.bottom);

        // bottom-right
        context.moveTo(points.right, points.bottom - handleSize);
        context.lineTo(points.right, points.bottom);
        context.lineTo(points.right - handleSize, points.bottom);

        context.stroke();
    }

    onActivate() {
        this.isActive = true;

        if (this.manager.copyData) {
            this.op = new PasteOp(this.manager.copyData);
        }
    }

    onPointerDown(e: PointerEvent) {
        if (!this.isActive || !this.op) {
            return;
        }

        if (
            e.offsetX > this.op.x &&
            e.offsetX < this.op.x + this.op.imageData.width &&
            e.offsetY > this.op.y &&
            e.offsetY < this.op.y + this.op.imageData.height
        ) {
            this.draggingPoint = [e.offsetX, e.offsetY];
        } else if (this.op) {
            this.manager.addOp(this.op);
            this.isActive = false;
            this.manager.rerender();
            // this.manager.selectLastTool();
        }
    }

    onPointerMove(e: PointerEvent) {
        if (this.op && this.draggingPoint) {
            this.op.x += e.offsetX - this.draggingPoint[0];
            this.op.y += e.offsetY - this.draggingPoint[1];

            this.draggingPoint = [e.offsetX, e.offsetY];
            this.manager.rerender();
        }
    }

    onPointerUp(e: PointerEvent) {
        this.draggingPoint = null;
    }
}
