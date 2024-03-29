/* tslint:disable */
/* eslint-disable */
/**
 * EPYC API
 * epyc API
 *
 * The version of the OpenAPI document: 1.0.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { exists, mapValues } from '../runtime';
/**
 * 
 * @export
 * @interface FrameImageData
 */
export interface FrameImageData {
    /**
     * 
     * @type {string}
     * @memberof FrameImageData
     */
    imageUrl: string;
    /**
     * 
     * @type {number}
     * @memberof FrameImageData
     */
    width: number;
    /**
     * 
     * @type {number}
     * @memberof FrameImageData
     */
    height: number;
}

export function FrameImageDataFromJSON(json: any): FrameImageData {
    return FrameImageDataFromJSONTyped(json, false);
}

export function FrameImageDataFromJSONTyped(json: any, ignoreDiscriminator: boolean): FrameImageData {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'imageUrl': json['imageUrl'],
        'width': json['width'],
        'height': json['height'],
    };
}

export function FrameImageDataToJSON(value?: FrameImageData | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'imageUrl': value.imageUrl,
        'width': value.width,
        'height': value.height,
    };
}

