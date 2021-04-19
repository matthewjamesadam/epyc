import { deflate, inflate, Serializable, Serialize } from 'serialazy';
import { SerializeDate, SerializeArray, SerializeRaw } from './Serialize';
import { v4 as uuid } from 'uuid';
import * as MongoDb from 'mongodb';
import { Constructor } from 'serialazy/lib/dist/types';
import * as API from './api';
import Cfg from './Cfg';
import { FilterQuery } from 'mongodb';

export enum BotTarget {
    discord = 'discord',
    slack = 'slack',
}

export function BotTargetFromString(value: string): BotTarget | undefined {
    switch (value) {
        case BotTarget.slack:
            return BotTarget.slack;
        case BotTarget.discord:
            return BotTarget.discord;
    }
}

export enum PersonFrameRole {
    author = 'author',
    artist = 'artist',
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

    equals(channel: ChannelModel): boolean {
        return this.id === channel.id && this.target === channel.target;
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
    @Serialize({ optional: true }) public preferredPersonId?: string;
    @Serialize({ optional: true }) public preferredGameRole?: PersonFrameRole;

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

export class SlackToken {
    @Serialize({ name: '_id' }) public teamId: string = '';
    @Serialize({ optional: true }) public token?: string;
    @SerializeRaw({ optional: true }) public installation?: any;
}

export class InterestModel {
    @Serialize() public personId: string = '';
    @Serialize() public channel: ChannelModel = new ChannelModel();

    static create(personId: string, channelId: string, target: BotTarget) {
        const model = new InterestModel();
        model.personId = personId;
        model.channel.id = channelId;
        model.channel.target = target;

        return model;
    }
}

class ChannelLinkModel {
    @Serialize() public lhs: ChannelModel = new ChannelModel();
    @Serialize() public rhs: ChannelModel = new ChannelModel();
}

export interface GameQuery {
    isComplete?: boolean;
    channel?: ChannelModel;
}

export interface IDb {
    getGames(query?: GameQuery): Promise<Array<GameModel>>;
    getGame(gameName: string): Promise<GameModel | undefined>;
    putGame(game: GameModel): Promise<void>;

    getPerson(id: string): Promise<PersonModel | undefined>;
    getPersonFromService(serviceId: string, target: BotTarget): Promise<PersonModel | undefined>;
    putPerson(person: PersonModel): Promise<void>;

    getSlackToken(teamId: string): Promise<string | undefined>;
    getSlackInstallation(teamId: string): Promise<any>;
    putSlackInstallation(teamId: string, installation: any): Promise<void>;

    getInterest(channel: ChannelModel): Promise<PersonModel[]>;
    putInterest(person: PersonModel, channel: ChannelModel, isInterested: boolean): Promise<void>;
}

export class Db implements IDb {
    client: MongoDb.MongoClient;
    game: MongoDb.Collection;
    person: MongoDb.Collection;
    slackToken: MongoDb.Collection;
    interest: MongoDb.Collection;
    channelLink: MongoDb.Collection;

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
        this.person = db.collection('Person');
        this.slackToken = db.collection('SlackToken');
        this.interest = db.collection('Interest');
        this.channelLink = db.collection('ChannelLink');
    }

    private async init() {
        await this.person.createIndex(
            {
                serviceId: 1,
                target: 1,
            }
            // {
            //     unique: true,
            // }
        );

        await this.interest.createIndex(
            {
                personId: 1,
                'channel.id': 1,
                'channel.target': 1,
            },
            {
                unique: true,
            }
        );

        await this.interest.createIndex({
            'channel.id': 1,
            'channel.target': 1,
        });
    }

    async deinit() {
        await this.client.close();
    }

    async getGamesForChannel(channel: ChannelModel, mongoQuery: MongoDb.FilterQuery<any>): Promise<any[]> {
        // Do a separate query for each channel associated with this one
        const channels = await this.resolveLinkedChannels(channel);

        const allDocs = await Promise.all(
            channels.map((channel) => {
                const channelQuery = Object.assign(
                    {
                        'channel.id': channel.id,
                        'channel.target': channel.target,
                    },
                    mongoQuery
                );
                return this.game.find(channelQuery).toArray();
            })
        );

        return allDocs.flat();
    }

    async getGames(query?: GameQuery): Promise<GameModel[]> {
        const mongoQuery: MongoDb.FilterQuery<any> = {};
        if (query?.isComplete !== undefined && query?.isComplete !== null) {
            mongoQuery.isComplete = query?.isComplete;
        }

        let docs: any[];

        // Channel query -- this is separated because we have to first resolve linked channels
        if (query?.channel) {
            docs = await this.getGamesForChannel(query.channel, mongoQuery);
        }

        // Plain query
        else {
            docs = await this.game.find(mongoQuery).limit(50).toArray();
        }

        let models = this.inflateArray(docs, GameModel);
        return models;
    }

    async getGame(gameName: string): Promise<GameModel | undefined> {
        let doc = await this.game.findOne({ _id: gameName });
        if (!doc) {
            return undefined;
        }

        return inflate(GameModel, doc);
    }

    async putGame(game: GameModel): Promise<void> {
        let doc = deflate(game);
        await this.game.replaceOne({ _id: game.name }, doc, { upsert: true });
        // return inflate(GameModel, doc);
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

    async getSlackToken(teamId: string): Promise<string | undefined> {
        const doc = await this.slackToken.findOne({ _id: teamId });
        if (!doc) {
            return;
        }

        const slackToken = inflate(SlackToken, doc);
        return slackToken.token || slackToken.installation?.bot?.token;
    }

    async getSlackInstallation(teamId: string): Promise<any> {
        const doc = await this.slackToken.findOne({ _id: teamId });
        if (!doc) {
            return;
        }

        const slackToken = inflate(SlackToken, doc);
        return slackToken.installation;
    }

    async putSlackInstallation(teamId: string, installation: any): Promise<void> {
        const slackToken = new SlackToken();
        slackToken.teamId = teamId;
        slackToken.installation = installation;

        await this.slackToken.replaceOne({ id: teamId }, deflate(slackToken), { upsert: true });
    }

    private async resolveLinkedChannels(channel: ChannelModel): Promise<ChannelModel[]> {
        // Find channel links
        const channelLinkDocs = await this.channelLink
            .find({
                $or: [
                    { 'lhs.id': channel.id, 'lhs.target': channel.target },
                    { 'rhs.id': channel.id, 'rhs.target': channel.target },
                ],
            })
            .toArray();

        const channelLinks = this.inflateArray(channelLinkDocs, ChannelLinkModel);
        const allChannels = [channel];

        channelLinks.forEach((link) => {
            if (!allChannels.find((channel) => link.lhs.equals(channel))) {
                allChannels.push(link.lhs);
            }
            if (!allChannels.find((channel) => link.rhs.equals(channel))) {
                allChannels.push(link.rhs);
            }
        });

        return allChannels;
    }

    async getInterest(channel: ChannelModel): Promise<PersonModel[]> {
        const allChannels = await this.resolveLinkedChannels(channel);

        const promises = allChannels.map((theChannel) => {
            return this.interest.find({ 'channel.id': theChannel.id, 'channel.target': theChannel.target }).toArray();
        });

        const interestDocs = (await Promise.all(promises)).flatMap((doc) => doc);
        const interests = this.inflateArray(interestDocs, InterestModel);
        const interestIds = interests.map((interest) => interest.personId);

        if (interestIds.length === 0) {
            return [];
        }

        // Find all people associated with these interests
        const personDocs = await this.person.find({ _id: { $in: interestIds } }).toArray();
        return this.inflateArray(personDocs, PersonModel);
    }

    async putInterest(person: PersonModel, channel: ChannelModel, isInterested: boolean): Promise<void> {
        const filter = {
            personId: person.id,
            'channel.id': channel.id,
            'channel.target': channel.target,
        };

        if (!isInterested) {
            await this.interest.deleteMany(filter);
            return;
        }

        const interest = InterestModel.create(person.id, channel.id, channel.target);
        const doc = deflate(interest);
        await this.interest.replaceOne(filter, doc, { upsert: true });
    }
}
