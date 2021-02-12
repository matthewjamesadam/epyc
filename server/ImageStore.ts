import AWS from 'aws-sdk';
import { Readable } from 'stream';
import Cfg from './Cfg';

export default class ImageStore {
    static getFileUrl(gameName: string, frameId: string) {
        const fileName = this.getFileName(gameName, frameId);
        return `https://${Cfg.imageStoreAwsBucket}.s3-us-west-2.amazonaws.com/${fileName}`;
    }

    static getFileName(gameName: string, frameId: string) {
        return `${gameName}/${frameId}.png`;
    }

    static async uploadImage(
        gameName: string,
        frameId: string,
        data: Readable
    ): Promise<{ fileName: string; fileUrl: string }> {
        const s3 = new AWS.S3();

        const fileName = this.getFileName(gameName, frameId);
        const fileUrl = this.getFileUrl(gameName, frameId);

        await s3
            .upload({
                Bucket: Cfg.imageStoreAwsBucket,
                Key: fileName,
                Body: data,
                ContentType: 'image/png',
            })
            .promise();

        return { fileName, fileUrl };
    }
}
