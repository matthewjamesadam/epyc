import { CopyDataSource, CopySource, DrawOp, DrawTool, IDrawManager, ToolType } from './DrawTypes';
import PencilTool from './PencilTool';
import { action, makeObservable, observable, configure as mobxConfigure } from 'mobx';
import { get as idbGet, set as idbSet } from 'idb-keyval';

import LineTool from './LineTool';
import PaintTool from './PaintTool';
import TextTool from './TextTool';

import * as React from 'react';
import CircleTool from './CircleTool';
import RectangleTool from './RectangleTool';
import DropperTool from './DropperTool';
import SelectTool from './SelectTool';
import PasteTool from './PasteTool';

const colourSlots = 16;

const fixedColours = [
    '#000000',
    '#0000AA',
    '#00AA00',
    '#00AAAA',
    '#AA0000',
    '#AA00AA',
    '#AA5500',
    '#AAAAAA',
    '#555555',
    '#5555FF',
    '#55FF55',
    '#55FFFF',
    '#FF5555',
    '#FF55FF',
    '#FFFF55',
    '#FFFFFF',
];

mobxConfigure({
    useProxies: 'always',
    enforceActions: 'never',
});

class ClearOp implements DrawOp {
    isFullRender = true;
    render(context: CanvasRenderingContext2D, width: number, height: number): void {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
    }
}

class FillImageOp implements DrawOp {
    isFullRender = true;

    constructor(private image: CanvasImageSource) {}

    render(context: CanvasRenderingContext2D, width: number, height: number): void {
        context.drawImage(this.image, 0, 0);
    }
}

export default class DrawManager implements IDrawManager {
    tools = [
        new PencilTool(this),
        new LineTool(this),
        new RectangleTool(this),
        new CircleTool(this),
        new PaintTool(this),
        new TextTool(this),
        new DropperTool(this),
    ];

    editTools = [new SelectTool(this), new PasteTool(this)];

    canvasRef: HTMLCanvasElement | null = null;

    @observable selectedTool: DrawTool;
    @observable strokeColour: string = '#000000';
    @observable lineWidth: number = 3;

    @observable ops = new Array<DrawOp>();
    @observable redos = new Array<DrawOp>();

    @observable copySource: CopySource | null = null;
    @observable copyData: CopyDataSource | null = null;

    @observable.shallow toolChildren: React.ReactNode = React.createElement('div');

    @observable colours = new Array<string | null>();

    fixedColours = fixedColours;

    private lastSelectedTool: DrawTool;
    private gameName: string;
    private frameId: string;

    private backgroundOp: DrawOp;

    constructor(gameName: string, frameId: string) {
        this.selectedTool = this.lastSelectedTool = this.tools[0];
        this.gameName = gameName;
        this.frameId = frameId;

        this.backgroundOp = new ClearOp();

        makeObservable(this);

        this.loadWipData();
    }

    async loadWipData() {
        const wipData = await idbGet('epyc-wip');

        if (wipData && wipData.gameName === this.gameName && wipData.frameId === this.frameId && wipData.image) {
            const imageBitmap = await this.createCanvasImageSource(wipData.image);
            this.backgroundOp = new FillImageOp(imageBitmap);
            this.rerender();
        }
    }

    async saveWipData() {
        const canvas = this.canvasRef;
        if (!canvas) {
            return;
        }

        const getImageBlob = new Promise((resolve) => {
            const pngData = canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });

        const blob = await getImageBlob;

        const wipData = {
            gameName: this.gameName,
            frameId: this.frameId,
            image: blob,
        };

        await idbSet('epyc-wip', wipData);
    }

    bindings = new Array<() => void>();

    bind<K extends keyof HTMLElementEventMap>(
        ref: HTMLCanvasElement,
        type: K,
        fn: (event: HTMLElementEventMap[K]) => void
    ) {
        const boundFn = fn.bind(this);
        ref.addEventListener(type, boundFn);

        const dropFn = () => {
            ref.removeEventListener(type, boundFn);
        };
        this.bindings.push(dropFn);
    }

    setCanvasRef(ref: HTMLCanvasElement | null) {
        // Mount
        if (ref) {
            ref.style.cursor = 'crosshair';
            ref.style.touchAction = 'none';
            this.bind(ref, 'pointerdown', this.onMouseDown);
            this.bind(ref, 'pointerup', this.onMouseUp);
            this.bind(ref, 'pointermove', this.onMouseMove);
            this.bind(ref, 'keypress', this.onKeyPress);

            // Block touch events -- this prevents the annoying popup
            // selection menu on mobile safari.  Touch events get
            // translated into pointer events, which we do use.
            this.bind(ref, 'touchstart', this.preventTouchEvents);
            this.bind(ref, 'touchmove', this.preventTouchEvents);
            this.bind(ref, 'touchend', this.preventTouchEvents);
        }

        // Unmount
        else if (this.canvasRef) {
            this.bindings.forEach((binding) => binding());
            this.bindings.length = 0;
        }

        this.canvasRef = ref;
        this.rerender();
    }

    preventTouchEvents(e: TouchEvent) {
        e.preventDefault();
    }

    @action setSelectedTool(type: ToolType) {
        if (type === this.selectedTool.type) {
            return;
        }

        this.selectedTool.onDeactivate();

        this.lastSelectedTool = this.selectedTool;

        this.toolChildren = null;
        this.selectedTool =
            this.tools.find((tool) => tool.type === type) ||
            this.editTools.find((tool) => tool.type === type) ||
            this.selectedTool;
        this.selectedTool.onActivate();
        this.rerender();
    }

    selectLastTool() {
        this.setSelectedTool(this.lastSelectedTool.type);
    }

    onMouseDown(e: PointerEvent) {
        this.selectedTool.onPointerDown(e);
        e.preventDefault();
    }

    onMouseUp(e: PointerEvent) {
        this.selectedTool.onPointerUp(e);
        e.preventDefault();
    }

    onMouseMove(e: PointerEvent) {
        this.selectedTool.onPointerMove(e);
        e.preventDefault();
    }

    onKeyPress(e: KeyboardEvent) {
        this.selectedTool.onKeyPress(e);
        e.preventDefault();
    }

    rerender(renderTool = true) {
        const canvas = this.canvasRef;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
            return;
        }

        context.lineJoin = 'round';
        context.lineCap = 'round';

        // Find last full-render op
        let lastFullDrawOpIdx = this.ops.length - 1;
        for (; lastFullDrawOpIdx > 0 && !this.ops[lastFullDrawOpIdx].isFullRender; --lastFullDrawOpIdx) {}
        lastFullDrawOpIdx = Math.max(lastFullDrawOpIdx, 0);

        // Draw background if needed
        if (lastFullDrawOpIdx <= 0) {
            this.backgroundOp.render(context, canvas.clientWidth, canvas.clientHeight);
        }

        // Render forward from this op to the end
        for (var i = lastFullDrawOpIdx; i < this.ops.length; ++i) {
            this.ops[i].render(context, canvas.clientWidth, canvas.clientHeight);
        }

        // Render the tool itself
        if (renderTool) {
            this.selectedTool.render(context, canvas.clientWidth, canvas.clientHeight);
        }
    }

    async getImage(): Promise<Blob | null> {
        const canvas = this.canvasRef;
        if (!canvas) {
            return null;
        }

        const getImageBlob = new Promise<Blob | null>((resolve) => {
            const pngData = canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        });

        return await getImageBlob;
    }

    @action addOp(op: DrawOp) {
        this.redos.length = 0;
        this.ops.push(op);
        this.rerender();

        // FIXME: Do this on a timer periodically instead of on every op
        this.saveWipData();
    }

    @action undo() {
        if (this.ops.length < 1) {
            return;
        }

        this.redos.splice(this.redos.length, 0, ...this.ops.splice(this.ops.length - 1, 1));
        this.rerender();

        // FIXME: Do this on a timer periodically instead of on every op
        this.saveWipData();
    }

    @action redo() {
        if (this.redos.length < 1) {
            return;
        }

        this.ops.splice(this.ops.length, 0, ...this.redos.splice(this.redos.length - 1, 1));
        this.rerender();

        // FIXME: Do this on a timer periodically instead of on every op
        this.saveWipData();
    }

    async copy() {
        const imageData = this.copySource?.copy();
        if (!imageData) {
            this.copyData = null;
            return;
        }

        this.copyData = await this.createCanvasImageSource(imageData);
    }

    private async createCanvasImageSource(data: Blob | ImageData): Promise<CopyDataSource> {
        // @ts-ignore: polyfill for missing createImageBitmap on Safari
        if (window.createImageBitmap) {
            return createImageBitmap(data);
        }

        return new Promise((resolve, reject) => {
            let dataURL;
            if (data instanceof Blob) {
                dataURL = URL.createObjectURL(data);
            } else if (data instanceof ImageData) {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = data.width;
                canvas.height = data.height;
                if (context) {
                    context.putImageData(data, 0, 0);
                }
                dataURL = canvas.toDataURL();
            }

            if (!dataURL) {
                reject(new Error('Could not create ImageBitmap'));
                return;
            }

            const img = document.createElement('img');
            img.addEventListener('load', function () {
                resolve(this);
            });
            img.src = dataURL;
        });
    }

    addColour(colour: string) {
        if (fixedColours.includes(colour)) {
            return;
        }

        const idx = this.colours.indexOf(colour);
        if (idx >= 0) {
            this.colours.splice(idx, 1);
        }

        this.colours.splice(0, 0, colour);
        this.colours.splice(colourSlots, this.colours.length - colourSlots);
    }
}
