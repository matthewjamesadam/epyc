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
import {
    Frame,
    FrameFromJSON,
    FrameFromJSONTyped,
    FrameToJSON,
} from './Frame';
import {
    FrameImageData,
    FrameImageDataFromJSON,
    FrameImageDataFromJSONTyped,
    FrameImageDataToJSON,
} from './FrameImageData';

/**
 * 
 * @export
 * @interface Game
 */
export interface Game {
    /**
     * 
     * @type {string}
     * @memberof Game
     */
    name: string;
    /**
     * 
     * @type {Array<Frame>}
     * @memberof Game
     */
    frames: Array<Frame>;
    /**
     * 
     * @type {FrameImageData}
     * @memberof Game
     */
    titleImage?: FrameImageData;
}

export function GameFromJSON(json: any): Game {
    return GameFromJSONTyped(json, false);
}

export function GameFromJSONTyped(json: any, ignoreDiscriminator: boolean): Game {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'name': json['name'],
        'frames': ((json['frames'] as Array<any>).map(FrameFromJSON)),
        'titleImage': !exists(json, 'titleImage') ? undefined : FrameImageDataFromJSON(json['titleImage']),
    };
}

export function GameToJSON(value?: Game | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'name': value.name,
        'frames': ((value.frames as Array<any>).map(FrameToJSON)),
        'titleImage': FrameImageDataToJSON(value.titleImage),
    };
}

