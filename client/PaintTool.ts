import { DrawOp, DrawTool, IconType, ToolType } from './DrawTypes';

class FullCaptureOp implements DrawOp {
    isFullRender = true;
    imageData: ImageData;

    constructor(imageData: ImageData) {
        this.imageData = imageData;
    }

    render(context: CanvasRenderingContext2D): void {
        context.putImageData(this.imageData, 0, 0);
    }
}

// Fuzzy matching values
// The first is how much an individual colour channel can vary before we consider it a different colour
// The second is how much the summed channels can vary
const maxElementOffset = 35;
const maxTotalOffset = 70;

export default class PaintTool extends DrawTool {
    type = ToolType.paint;
    name = 'Paint';
    icon: IconType = 'paint';

    render(context: CanvasRenderingContext2D) {}

    onPointerUp(e: PointerEvent): void {
        const canvas = this.manager.canvasRef;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
            return;
        }

        const canvasWidth = Math.floor(canvas.width);
        const canvasHeight = Math.floor(canvas.height);
        const offsetX = Math.floor(e.offsetX);
        const offsetY = Math.floor(e.offsetY);

        // FIXME: Cheap parsing code, fix this at some point
        const colour = this.manager.strokeColour;
        const colours = [
            parseInt(colour.substr(1, 2), 16),
            parseInt(colour.substr(3, 2), 16),
            parseInt(colour.substr(5, 2), 16),
            255,
        ];

        const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);

        const visited = new Array<boolean>(canvasWidth * canvasHeight);
        visited.fill(false);

        const toVisit = new Array<[number, number]>();
        toVisit.push([offsetX, offsetY]);

        const visitedIdx = (x: number, y: number) => {
            return y * canvasWidth + x;
        };
        const imageIdx = (x: number, y: number) => {
            return (y * imageData.width + x) * 4;
        };

        const addToVisit = (x: number, y: number) => {
            if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.width && !visited[visitedIdx(x, y)]) {
                toVisit.push([x, y]);
            }
        };

        const bgIdx = imageIdx(offsetX, offsetY);
        const bgColours = [
            imageData.data[bgIdx],
            imageData.data[bgIdx + 1],
            imageData.data[bgIdx + 2],
            imageData.data[bgIdx + 3],
        ];

        const colourMatch = (idx: number) => {
            const diff0 = Math.abs(imageData.data[idx] - bgColours[0]);
            const diff1 = Math.abs(imageData.data[idx + 1] - bgColours[1]);
            const diff2 = Math.abs(imageData.data[idx + 2] - bgColours[2]);
            const diff3 = Math.abs(imageData.data[idx + 3] - bgColours[3]);

            return (
                diff0 < maxElementOffset &&
                diff1 < maxElementOffset &&
                diff2 < maxElementOffset &&
                diff3 < maxElementOffset &&
                diff0 + diff1 + diff2 + diff3 < maxTotalOffset
            );
        };

        while (true) {
            const thisOne = toVisit.pop();
            if (!thisOne) {
                break;
            }

            visited[visitedIdx(thisOne[0], thisOne[1])] = true;

            const thisImageIdx = imageIdx(thisOne[0], thisOne[1]);

            if (!colourMatch(thisImageIdx)) {
                continue;
            }

            imageData.data[thisImageIdx] = colours[0];
            imageData.data[thisImageIdx + 1] = colours[1];
            imageData.data[thisImageIdx + 2] = colours[2];
            imageData.data[thisImageIdx + 3] = colours[3];

            addToVisit(thisOne[0] - 1, thisOne[1]);
            addToVisit(thisOne[0] + 1, thisOne[1]);
            addToVisit(thisOne[0], thisOne[1] - 1);
            addToVisit(thisOne[0], thisOne[1] + 1);
        }

        this.manager.addOp(new FullCaptureOp(imageData));
        this.manager.addColour(this.manager.strokeColour);
    }
}
