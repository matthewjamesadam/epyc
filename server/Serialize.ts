import { deflate, inflate, Serialize } from 'serialazy';
import { ObjectId } from 'mongodb';
import { DecoratorOptions } from 'serialazy/lib/dist/options';
import { MongoDbSettings } from 'aws-sdk/clients/dms';

type Constructor<T> = new (...args: any[]) => T;

function SerializeArray<Type>(
    ctor: Constructor<Type>,
    options: DecoratorOptions<Array<Type>, Array<Type>> = {}
) {
    return Serialize({
        ...options,
        down: (instances: Array<Type>) => {
            if (!instances) {
                return [];
            }
            return instances.map((instance) => deflate(instance));
        },
        up: (jsonObjs: Array<any>) => {
            if (!jsonObjs) {
                return;
            }
            return jsonObjs.map((jsonObj) => inflate(ctor, jsonObj));
        },
    });
}

function SerializeArrayBasic<Type>(options: DecoratorOptions<Array<Type>, Array<Type>> = {}) {
    return Serialize({
        ...options,
        down: (instances: Array<Type>) => {
            if (!instances) {
                return [];
            }
            return instances;
        },
        up: (jsonObjs: Array<any>) => {
            if (!jsonObjs) {
                return [];
            }
            return jsonObjs;
        },
    });
}

function SerializeDate(options: DecoratorOptions<String, Date> = {}) {
    return Serialize({
        ...options,
        down: (instance: Date) => {
            return instance;
        },
        up: (jsonObj: any) => {
            return new Date(jsonObj);
        }
    });
}

function SerializeObjectId(options: DecoratorOptions<ObjectId, string> = {}) {
    return Serialize({
        ...options,
        down: (instance: string) => {
            return ObjectId.createFromHexString(instance);
        },
        up: (jsonObj: any) => {
            return jsonObj.toHexString && jsonObj.toHexString();
        },
    });
}

export { SerializeArray, SerializeArrayBasic, SerializeDate, SerializeObjectId };
