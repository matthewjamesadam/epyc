import { deflate, inflate, Serializable, Serialize } from 'serialazy';
import { SerializeDate, SerializeArray, SerializeArrayBasic, SerializeObjectId } from './Serialize';
import { v4 as uuid } from 'uuid';
import * as MongoDb from 'mongodb';
import { Constructor } from 'serialazy/lib/dist/types';
import * as API from './api';
import Cfg from './Cfg';
import { FilterQuery } from 'mongodb';
import { Avatar } from './api';

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

export class AvatarModel {
    @Serialize({ name: '_id' }) public id: string = '';
    @Serialize() public personId: string = '';
    @Serialize() public target: BotTarget = BotTarget.discord;
    @Serialize() public url: string = '';
    @Serialize() public width: number = 0;
    @Serialize() public height: number = 0;
    @Serialize() public hash: string = '';
    @SerializeDate() public lastUpdated: Date = new Date();

    static create(
        id: string,
        personId: string,
        target: BotTarget,
        url: string,
        width: number,
        height: number,
        hash: string
    ): AvatarModel {
        const model = new AvatarModel();
        model.id = id;
        model.personId = personId;
        model.target = target;
        model.url = url;
        model.width = width;
        model.height = height;
        model.hash = hash;
        return model;
    }

    toApi(): API.Avatar {
        return {
            url: this.url,
            width: this.width,
            height: this.height,
        };
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

    equals(other: PersonModel) {
        return this.id === other.id && this.target === other.target;
    }

    toApi(): API.Person {
        return { name: this.name };
    }
}

export class FrameImageModel {
    @Serialize() public imageUrl: string = '';
    @Serialize() public imageFileName: string = '';
    @Serialize() public width: number = 0;
    @Serialize() public height: number = 0;

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
    @Serialize({ optional: true }) public warnings?: number;

    static create(person: PersonModel) {
        const model = new FrameModel();
        model.id = uuid();
        model.person = person;
        return model;
    }

    get isComplete(): boolean {
        return !!this.title || !!this.image;
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
    @Serialize({ optional: true }) public titleImage?: FrameImageModel;

    static create(name: string, channel: ChannelModel, frames: FrameModel[]) {
        const model = new GameModel();
        model.name = name;
        model.channel = channel;
        model.frames = frames;
        return model;
    }

    toApi(): API.Game {
        return {
            name: this.name,
            titleImage: this.titleImage?.toApi(),
            frames: this.frames.map((frame) => frame.toApi()),
        };
    }
}

export class Db {
    client: MongoDb.MongoClient;
    game: MongoDb.Collection;
    avatar: MongoDb.Collection;

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
        this.avatar = db.collection('Avatar');
    }

    private async init() {
        await this.avatar.createIndex({
            personId: 1,
            target: 1,
        });
    }

    async deinit() {
        await this.client.close();
    }

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

    async putAvatar(avatar: AvatarModel): Promise<void> {
        const doc = deflate(avatar);
        await this.avatar.replaceOne({ personId: avatar.personId, target: avatar.target }, doc, { upsert: true });
    }

    async getAvatar(personId: string, target: BotTarget): Promise<AvatarModel | undefined> {
        const doc = await this.avatar.findOne({ personId, target });
        if (doc) {
            return inflate(AvatarModel, doc);
        }
        return undefined;
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
