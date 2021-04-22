import { DrawOp, DrawTool, IconType, ToolType } from './DrawTypes';

class ClearOp implements DrawOp {
    isFullRender = true;

    constructor(private colour: string) {}

    render(context: CanvasRenderingContext2D, width: number, height: number): void {
        context.fillStyle = this.colour;
        context.fillRect(0, 0, width, height);
    }
}

export default class ClearTool extends DrawTool {
    type = ToolType.clear;
    name = 'Clear';
    icon: IconType = 'clear';
    isSelectable = false;

    onActivate() {
        this.manager.addOp(new ClearOp(this.manager.strokeColour));
        this.manager.addColour(this.manager.strokeColour);
    }
}
