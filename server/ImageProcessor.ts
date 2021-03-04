import jimp from 'jimp';
import { tmpName as makeTmpFileName } from 'tmp-promise';

export interface ImageDecodedData {
    width: number;
    height: number;
}

export interface TitleImageData {
    path: string;
    width: number;
    height: number;
}

const TITLE_IMAGE_WIDTH = 400;
const TITLE_IMAGE_HEIGHT = 200;
const TITLE_IMAGE_RATIO = TITLE_IMAGE_WIDTH / TITLE_IMAGE_HEIGHT;

export class ImageProcessor {
    static async decodeImage(path: string): Promise<ImageDecodedData> {
        const image = await jimp.read(path);

        return {
            width: image.getWidth(),
            height: image.getHeight(),
        };
    }

    static async makeTitleImage(path: string): Promise<TitleImageData> {
        const image = await jimp.read(path);

        const inputWidth = image.getWidth();
        const inputHeight = image.getHeight();
        const inputRatio = inputWidth / inputHeight;

        const fileName = await makeTmpFileName();

        if (inputRatio > TITLE_IMAGE_RATIO) {
            const ratioWidth = inputHeight * TITLE_IMAGE_RATIO;
            await image
                .crop((inputWidth - ratioWidth) / 2, 0, ratioWidth, inputHeight)
                .scaleToFit(TITLE_IMAGE_WIDTH, TITLE_IMAGE_HEIGHT)
                .writeAsync(fileName);
        } else {
            const ratioHeight = inputWidth / TITLE_IMAGE_RATIO;
            await image
                .crop(0, (inputHeight - ratioHeight) / 2, inputWidth, ratioHeight)
                .scaleToFit(TITLE_IMAGE_WIDTH, TITLE_IMAGE_HEIGHT)
                .writeAsync(fileName);
        }

        return {
            path: fileName,
            width: TITLE_IMAGE_WIDTH,
            height: TITLE_IMAGE_HEIGHT,
        };
    }
}
