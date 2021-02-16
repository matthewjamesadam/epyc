import { deflate, inflate, Serializable, Serialize } from 'serialazy';
import { SerializeDate, SerializeArray, SerializeArrayBasic, SerializeObjectId } from './Serialize';
import spacetime from 'spacetime';
import * as MongoDb from 'mongodb';
import { Constructor } from 'serialazy/lib/dist/types';
import * as API from './api';
import Cfg from './Cfg';
import { FilterQuery } from 'mongodb';

export enum BotTarget {
    discord = 'discord',
    slack = 'slack',
}

export class ChannelModel {
    @Serialize() public id: string = '';
    @Serialize() public name: string = '';
    @Serialize() public target: BotTarget = BotTarget.discord;

    static create(id: string, name: string, target: BotTarget) {
        const model = new ChannelModel();
        model.id = id;
        model.name = name;
        model.target = target;
        return model;
    }
}

export class PersonModel {
    @Serialize() public id: string = '';
    @Serialize() public name: string = '';
    @Serialize() public target: BotTarget = BotTarget.discord;

    static create(id: string, name: string, target: BotTarget) {
        const model = new PersonModel();
        model.id = id;
        model.name = name;
        model.target = target;
        return model;
    }

    toApi(): API.Person {
        return { name: this.name };
    }
}

export class FrameImageModel {
    @Serialize({ optional: true }) public imageUrl: string = '';
    @Serialize({ optional: true }) public imageFileName: string = '';
    @Serialize({ optional: true }) public width: number = 0;
    @Serialize({ optional: true }) public height: number = 0;

    static create(imageUrl: string, imageFileName: string, width: number, height: number): FrameImageModel {
        const model = new FrameImageModel();
        model.imageUrl = imageUrl;
        model.imageFileName = imageFileName;
        model.width = width;
        model.height = height;
        return model;
    }

    toApi(): API.FrameImageData {
        return {
            imageUrl: this.imageUrl,
            width: this.width,
            height: this.height,
        };
    }
}

export class FrameModel {
    @Serialize() public id: string = '';
    @Serialize() public person: PersonModel = new PersonModel();
    @Serialize({ optional: true }) public title?: string;
    @Serialize({ optional: true }) public image?: FrameImageModel;

    static create(id: string, person: PersonModel) {
        const model = new FrameModel();
        model.id = id;
        model.person = person;
        return model;
    }

    toApi(): API.Frame {
        return {
            person: this.person.toApi(),
            playData: {
                title: this.title,
                image: this.image?.toApi(),
            },
        };
    }
}

export class GameModel {
    @Serialize({ name: '_id' }) public name: string = '';
    @Serialize() public isComplete: boolean = false;
    @Serialize() public channel: ChannelModel = new ChannelModel();
    @SerializeArray(FrameModel) public frames: FrameModel[] = [];

    static create(name: string, channel: ChannelModel, frames: FrameModel[]) {
        const model = new GameModel();
        model.name = name;
        model.channel = channel;
        model.frames = frames;
        return model;
    }

    toApi(): API.Game {
        return { name: this.name, frames: this.frames.map((frame) => frame.toApi()) };
    }
}

export class Db {
    client: MongoDb.MongoClient;
    game: MongoDb.Collection;

    static async create(): Promise<Db> {
        const connectionString = process.env['DB_CONNECTION_STRING'];
        if (!connectionString) {
            throw new Error('DB_CONNECTION_STRING is undefined');
        }

        const client = new MongoDb.MongoClient(connectionString);
        await client.connect();

        let db = new Db(client);
        await db.init();
        return db;
    }

    private constructor(client: MongoDb.MongoClient) {
        this.client = client;
        const db = this.client.db(Cfg.dbName);
        this.game = db.collection('Game');
    }

    private async init() {}

    async createGame(game: GameModel) {
        const doc = deflate(game);
        await this.game.insertOne(doc);
    }

    async getGames(query?: FilterQuery<any>): Promise<Array<GameModel>> {
        let docs = await this.game.find(query).limit(50).toArray();

        let models = this.inflateArray(docs, GameModel);
        return models;
    }

    async getGame(gameName: string): Promise<GameModel | null> {
        let doc = await this.game.findOne({ _id: gameName });
        if (!doc) {
            return null;
        }

        return inflate(GameModel, doc);
    }

    async putGame(game: GameModel) {
        let doc = deflate(game);
        await this.game.replaceOne({ _id: game.name }, doc);
        return inflate(GameModel, doc);
    }

    private inflateArray<Type>(docs: any[], type: Constructor<Type>): Type[] {
        let toReturn: Type[] = [];
        docs.forEach((doc) => {
            try {
                toReturn.push(inflate(type, doc));
            } catch (err) {}
        });

        return toReturn;
    }

    private deflateArray<Type>(objs: Type[]): any[] {
        return objs.map((obj) => deflate(obj));
    }
}
