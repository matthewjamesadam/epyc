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
    @Serialize() public url: string = '';
    @Serialize() public width: number = 0;
    @Serialize() public height: number = 0;
    @Serialize() public hash: string = '';
    @SerializeDate() public lastUpdated: Date = new Date();

    static create(url: string, width: number, height: number, hash: string): AvatarModel {
        const model = new AvatarModel();
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
    @Serialize({ name: '_id' }) public id: string = '';
    @Serialize() public name: string = '';
    @Serialize() public serviceId: string = '';
    @Serialize() public target: BotTarget = BotTarget.discord;
    @Serialize({ optional: true }) public avatar?: AvatarModel;

    static create(serviceId: string, name: string, target: BotTarget) {
        const model = new PersonModel();
        model.id = uuid();
        model.serviceId = serviceId;
        model.name = name;
        model.target = target;
        return model;
    }

    toApi(): API.Person {
        return {
            name: this.name,
            avatar: this.avatar?.toApi(),
        };
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
    @Serialize() public personId: string = '';
    @Serialize({ optional: true }) public title?: string;
    @Serialize({ optional: true }) public image?: FrameImageModel;
    @Serialize({ optional: true }) public warnings?: number;

    static create(personId: string) {
        const model = new FrameModel();
        model.id = uuid();
        model.personId = personId;
        return model;
    }

    get isComplete(): boolean {
        return !!this.title || !!this.image;
    }

    toApi(): API.Frame {
        return {
            person: { name: '' }, // Person has to be attached from the Person collection
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

export class OldPersonModel {
    @Serialize() public id: string = '';
    @Serialize() public name: string = '';
    @Serialize() public target: BotTarget = BotTarget.discord;

    static create(id: string, name: string, target: BotTarget) {
        const model = new OldPersonModel();
        model.id = id;
        model.name = name;
        model.target = target;
        return model;
    }

    equals(other: OldPersonModel) {
        return this.id === other.id && this.target === other.target;
    }
}

export class OldFrameModel {
    @Serialize() public id: string = '';
    @Serialize() public person: OldPersonModel = new OldPersonModel();
    @Serialize({ optional: true }) public title?: string;
    @Serialize({ optional: true }) public image?: FrameImageModel;
    @Serialize({ optional: true }) public warnings?: number;

    static create(person: OldPersonModel) {
        const model = new OldFrameModel();
        model.id = uuid();
        model.person = person;
        return model;
    }

    get isComplete(): boolean {
        return !!this.title || !!this.image;
    }
}

export class OldGameModel {
    @Serialize({ name: '_id' }) public name: string = '';
    @Serialize() public isComplete: boolean = false;
    @Serialize() public channel: ChannelModel = new ChannelModel();
    @SerializeArray(OldFrameModel) public frames: OldFrameModel[] = [];
    @Serialize({ optional: true }) public titleImage?: FrameImageModel;

    static create(name: string, channel: ChannelModel, frames: OldFrameModel[]) {
        const model = new OldGameModel();
        model.name = name;
        model.channel = channel;
        model.frames = frames;
        return model;
    }
}

export class OldAvatarModel {
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
        const model = new OldAvatarModel();
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

export class Db {
    client: MongoDb.MongoClient;
    game: MongoDb.Collection;
    avatar: MongoDb.Collection;
    person: MongoDb.Collection;

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
        this.person = db.collection('Person');
    }

    private async init() {
        await this.avatar.createIndex({
            personId: 1,
            target: 1,
        });

        await this.person.createIndex({
            serviceId: 1,
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

    async getPerson(id: string): Promise<PersonModel | undefined> {
        const doc = await this.person.findOne({ _id: id });
        if (doc) {
            return inflate(PersonModel, doc);
        }
        return undefined;
    }

    async getPersonFromService(serviceId: string, target: BotTarget): Promise<PersonModel | undefined> {
        const doc = await this.person.findOne({ serviceId, target });
        if (doc) {
            return inflate(PersonModel, doc);
        }
        return undefined;
    }

    async putPerson(person: PersonModel): Promise<void> {
        const doc = deflate(person);
        await this.person.replaceOne({ _id: person.id }, doc, { upsert: true });
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

    private async getOldAvatar(personId: string, target: BotTarget): Promise<OldAvatarModel | undefined> {
        const doc = await this.avatar.findOne({ personId, target });
        if (doc) {
            return inflate(OldAvatarModel, doc);
        }
        return undefined;
    }

    private async convertFrame(frame: OldFrameModel): Promise<FrameModel> {
        const personDoc = await this.person.findOne({ serviceId: frame.person.id, target: frame.person.target });
        let person = inflate(PersonModel, personDoc);

        // Matching person, return it
        if (!person) {
            console.log(`Creating new person: ${frame.person.name}`);

            // No matching person, make one
            person = PersonModel.create(frame.person.id, frame.person.name, frame.person.target);
            person.avatar = await this.getOldAvatar(frame.person.id, frame.person.target);

            this.putPerson(person);
        }

        const newFrame = new FrameModel();
        newFrame.id = frame.id;
        newFrame.image = frame.image;
        newFrame.personId = person.id;
        newFrame.title = frame.title;
        newFrame.warnings = frame.warnings;

        return newFrame;
    }

    private async convertGame(oldGame: OldGameModel) {
        const frames = new Array<FrameModel>();

        for (const oldFrame of oldGame.frames) {
            const frame = await this.convertFrame(oldFrame);
            frames.push(frame);
        }

        const game = GameModel.create(oldGame.name, oldGame.channel, frames);

        game.isComplete = oldGame.isComplete;
        game.titleImage = oldGame.titleImage;
        return game;
    }

    async runPersonMigration() {
        const docs = await this.game.find().toArray();
        const games = this.inflateArray<OldGameModel>(docs, OldGameModel);

        for (const oldGame of games) {
            const game = await this.convertGame(oldGame);

            await this.putGame(game);
        }
    }
}
