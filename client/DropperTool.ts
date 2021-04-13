import { DrawTool, IconType, ToolType } from './DrawTypes';

export default class DropperTool extends DrawTool {
    type = ToolType.dropper;
    name = 'Dropper';
    icon: IconType = 'dropper';

    isActive = false;

    sample(e: PointerEvent) {
        const context = this.manager.canvasRef?.getContext('2d');
        if (!context) {
            return;
        }

        const imageData = context.getImageData(e.offsetX, e.offsetY, 1, 1);

        let toHex = (i: number) => imageData.data[i].toString(16).padStart(2, '0');
        const colour = `#${toHex(0)}${toHex(1)}${toHex(2)}`;

        this.manager.strokeColour = colour;
    }

    onPointerDown(e: PointerEvent) {
        this.isActive = true;
        this.sample(e);
    }

    onPointerMove(e: PointerEvent) {
        if (this.isActive) {
            this.sample(e);
        }
    }

    onPointerUp(e: PointerEvent) {
        this.isActive = false;
        this.manager.addColour(this.manager.strokeColour);
    }
}
