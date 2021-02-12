export abstract class DrawTool {
    abstract type: ToolType;
    abstract name: string;

    constructor(protected readonly manager: IDrawManager) {}

    render(context: CanvasRenderingContext2D, width: number, height: number) {}

    onActivate(): void {}
    onDeactivate(): void {}

    onKeyPress(e: KeyboardEvent): void {}

    onClick(e: MouseEvent): void {}
    onPointerDown(e: PointerEvent): void {}
    onPointerUp(e: PointerEvent): void {}
    onPointerMove(e: PointerEvent): void {}
}

export interface DrawOp {
    isFullRender: boolean;
    render(context: CanvasRenderingContext2D, width: number, height: number): void;
}

export enum ToolType {
    pencil,
    line,
    paint,
    text,
    circle,
    rectangle,
    dropper,
    select,
    copy,
    paste,
}

export interface CopySource {
    copy(): ImageData | null;
}

export type CopyDataSource = HTMLImageElement | ImageBitmap;

export interface IDrawManager {
    rerender(): void;
    addOp(op: DrawOp): void;
    undo(): void;
    redo(): void;

    selectLastTool(): void;

    canvasRef: HTMLCanvasElement | null;

    toolChildren: React.ReactNode;

    strokeColour: string;
    fillColour: string;
    lineWidth: number;

    copySource: CopySource | null;
    copyData: CopyDataSource | null;
}
