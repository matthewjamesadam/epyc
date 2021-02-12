import { observable } from 'mobx';
import { CopySource, DrawTool, ToolType } from './DrawTypes';

export default class SelectTool extends DrawTool implements CopySource {
    type = ToolType.select;
    name = 'Select';

    points: [number, number, number, number] = [0, 0, 0, 0];
    isActive = false;
    isDragging = false;

    get currentPoints(): { x: number; y: number; w: number; h: number } {
        return {
            x: Math.min(this.points[0], this.points[2]),
            y: Math.min(this.points[1], this.points[3]),
            w: Math.abs(this.points[0] - this.points[2]),
            h: Math.abs(this.points[1] - this.points[3]),
        };
    }

    onDeactivate() {
        this.manager.copySource = null;
    }

    render(context: CanvasRenderingContext2D) {
        if (!this.isActive) {
            return;
        }

        const { x, y, w, h } = this.currentPoints;

        context.lineWidth = 1;
        context.strokeStyle = '#ffffff';
        context.globalCompositeOperation = 'lighten';
        context.strokeRect(x - 1, y - 1, w + 2, h + 2);

        context.globalCompositeOperation = 'darken';
        context.strokeStyle = '#000000';
        context.setLineDash([5, 5]);
        context.strokeRect(x - 1, y - 1, w + 2, h + 2);

        context.setLineDash([]);
        context.globalCompositeOperation = 'source-over';
    }

    onPointerDown(e: PointerEvent) {
        this.isActive = true;
        this.isDragging = true;

        this.points[0] = this.points[2] = e.offsetX;
        this.points[1] = this.points[3] = e.offsetY;

        this.manager.rerender();
    }

    onPointerMove(e: PointerEvent) {
        if (this.isDragging) {
            this.points[2] = e.offsetX;
            this.points[3] = e.offsetY;

            this.manager.rerender();
        }
    }

    async onPointerUp(e: PointerEvent) {
        this.isDragging = false;
        this.manager.rerender();
        this.manager.copySource = this;
    }

    copy(): ImageData | null {
        if (!this.isActive) {
            return null;
        }

        const context = this.manager.canvasRef?.getContext('2d');
        if (!context) {
            return null;
        }

        const { x, y, w, h } = this.currentPoints;
        return context.getImageData(x, y, w, h);
    }
}
