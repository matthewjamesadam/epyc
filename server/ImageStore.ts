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

    static getAvatarFileUrl(id: string) {
        const fileName = this.getAvatarFileName(id);
        return `https://${Cfg.imageStoreAwsBucket}.s3-us-west-2.amazonaws.com/${fileName}`;
    }

    static getAvatarFileName(id: string) {
        return `avatars/${id}.png`;
    }

    static async uploadAvatar(id: string, data: Readable): Promise<{ fileName: string; fileUrl: string }> {
        const s3 = new AWS.S3();

        const fileName = this.getAvatarFileName(id);
        const fileUrl = this.getAvatarFileUrl(id);

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
