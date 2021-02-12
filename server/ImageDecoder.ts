import { decode } from 'jsonwebtoken';
import { Metadata, PNG } from 'pngjs';
import { Readable } from 'stream';

export interface ImageDecodedData {
    // data: Buffer;
    width: number;
    height: number;
}

export class ImageDecoder {
    static decodeImage(imageStream: Readable): Promise<ImageDecodedData> {
        return new Promise<ImageDecodedData>((resolve, reject) => {
            const decodeStream = imageStream.pipe(new PNG());

            decodeStream.on('error', (png: PNG, error: Error) => {
                reject(error);
            });

            decodeStream.on('metadata', (png: PNG, buffer: Metadata) => {
                const q = 5;

                resolve({
                    // data: buffer,
                    width: png.width,
                    height: png.height,
                });
            });
        });
    }
}
