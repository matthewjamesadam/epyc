import { v4 as uuid } from 'uuid';
import { IBot, MessageContent, PersonAvatar, PersonRef } from './Bot';
import {
    BotTarget,
    ChannelModel,
    FrameImageModel,
    FrameModel,
    GameModel,
    GameQuery,
    IDb,
    PersonFrameRole,
    PersonModel,
} from './Db';
import { GameManager } from './GameManager';
import Utils from './Utils';

class MockBot implements IBot {
    async sendMessage(channel: ChannelModel, ...content: MessageContent): Promise<void> {}
    async sendDM(person: PersonModel, ...content: MessageContent): Promise<void> {}
    async getAvatar(person: PersonModel): Promise<PersonAvatar | undefined> {
        return undefined;
    }
}

const defaultPeopleRefs: PersonRef[] = Array.from({ length: 10 }, (z, idx) => ({
    id: `person${idx}`,
    name: '',
    target: BotTarget.slack,
}));

const defaultPeople = defaultPeopleRefs.map((ref) => {
    return PersonModel.create(ref.id, ref.name, ref.target);
});

const artistPerson = PersonModel.create('artistPerson', 'artistPerson', BotTarget.slack);
artistPerson.preferredGameRole = PersonFrameRole.artist;

const artistPersonRef: PersonRef = { id: artistPerson.serviceId, name: '', target: artistPerson.target };

const authorPerson = PersonModel.create('authorPerson', 'authorPerson', BotTarget.slack);
authorPerson.preferredGameRole = PersonFrameRole.author;

const authorPersonRef: PersonRef = { id: authorPerson.serviceId, name: '', target: authorPerson.target };

const defaultChannel = ChannelModel.create('channel1', 'channel1', BotTarget.slack);

class MockDb implements IDb {
    games = new Map<string, GameModel>();
    persons = new Map<string, PersonModel>();
    interests = new Array<{ channelId: string; target: BotTarget; personId: string }>();

    async getGames(query?: GameQuery): Promise<GameModel[]> {
        return Array.from(this.games.values());
    }
    async getGame(gameName: string): Promise<GameModel | undefined> {
        return this.games.get(gameName);
    }
    async putGame(game: GameModel): Promise<void> {
        this.games.set(game.name, game);
    }

    async getPerson(id: string): Promise<PersonModel | undefined> {
        return this.persons.get(id);
    }
    async getPersonFromService(serviceId: string, target: BotTarget): Promise<PersonModel | undefined> {
        return Array.from(this.persons.values()).find((person) => {
            return person.serviceId === serviceId && person.target === target;
        });
    }
    async putPerson(person: PersonModel): Promise<void> {
        this.persons.set(person.id, person);
    }

    async getSlackToken(teamId: string): Promise<string | undefined> {
        return undefined;
    }
    async getSlackInstallation(teamId: string): Promise<any> {
        return null;
    }
    async putSlackInstallation(teamId: string, installation: any): Promise<void> {}
    async getInterest(channel: ChannelModel): Promise<PersonModel[]> {
        return this.interests
            .filter((int) => {
                return int.channelId === channel.id && int.target === channel.target;
            })
            .map((int) => this.persons.get(int.personId))
            .filter(Utils.notNull);
    }

    async putInterest(person: PersonModel, channel: ChannelModel, isInterested: boolean): Promise<void> {
        if (isInterested) {
            this.interests.push({ channelId: channel.id, target: channel.target, personId: person.id });
        }
        // FIXME: remove dupes, implement removal
    }

    populate() {
        this.persons.clear();
        defaultPeople.forEach((person) => {
            this.persons.set(person.id, person);
        });

        this.persons.set(artistPerson.id, artistPerson);
        this.persons.set(authorPerson.id, authorPerson);

        this.persons.set('discordPerson', PersonModel.create('discordPerson', '', BotTarget.discord));

        this.interests.splice(0, this.interests.length);
        this.interests.push({ personId: 'discordPerson', channelId: 'channel1', target: BotTarget.slack });

        this.games.clear();
        const frames = Array.from(this.persons.values()).map((person) => FrameModel.create(person.id));
        db.games.set('game1', GameModel.create('game1', defaultChannel, frames));
    }

    makeFrame(personId: string, isComplete: boolean) {
        const frame = FrameModel.create(personId);

        if (isComplete) {
            frame.image = FrameImageModel.create('blah', 'blah', 1, 1);
            frame.title = 'something';
        }

        return frame;
    }

    addRandomGame(): GameModel {
        // Randomize people and completions, verify each person exists at the end and the completed frame order isn't wrecked
        const numFrames = 4 + Math.floor(Math.random() * (defaultPeople.length - 4));
        const numCompleted = Math.floor(Math.random() * (numFrames - 1));

        const peopleIds = Utils.shuffleArray(defaultPeople).slice(0, numFrames);
        const frames = peopleIds.map((person, idx) => this.makeFrame(person.id, idx < numCompleted));

        const game = GameModel.create(uuid(), ChannelModel.create('channelId', 'blah', BotTarget.slack), frames);

        this.games.set(game.name, game);
        return game;
    }
}

const db = new MockDb();
const mgr = new GameManager(db, new MockBot(), new MockBot());

function verifyPersonRoles(game: GameModel | undefined, db: MockDb) {
    expect(game).toBeDefined();
    if (!game) {
        return;
    }

    game.frames.forEach((frame, index) => {
        const person = db.persons.get(frame.personId);
        if (!person?.preferredGameRole) {
            return;
        }

        const desiredOffset = person.preferredGameRole === PersonFrameRole.author ? 0 : 1;
        expect(index % 2).toEqual(desiredOffset);
    });
}

beforeEach(() => {
    db.populate();
});

describe('GameManager.startGame', () => {
    test(`works with referenced people`, async () => {
        const game = await mgr.startGame(defaultPeopleRefs, defaultChannel, false);

        expect(game).toBeDefined();
        expect(game?.frames.length).toEqual(10);

        const dbGame = db.games.get(game?.name || 'NOVALID');
        expect(dbGame).toBeDefined();
        expect(dbGame?.frames.length).toEqual(10);
        expect(dbGame?.name).toEqual(game?.name);
    });

    test(`works with interested people`, async () => {
        const game = await mgr.startGame(defaultPeopleRefs, defaultChannel, true);

        expect(game).toBeDefined();
        expect(game?.frames.length).toEqual(11);

        const dbGame = db.games.get(game?.name || 'NOVALID');
        expect(dbGame).toBeDefined();
        expect(dbGame?.frames.length).toEqual(11);
        expect(dbGame?.name).toEqual(game?.name);
    });

    test(`fulfills game role constraints`, async () => {
        // Because games are created with people in a random order, try this a lot of times
        for (let i = 0; i < 100; ++i) {
            const game = await mgr.startGame(
                [...defaultPeopleRefs, artistPersonRef, authorPersonRef],
                defaultChannel,
                true
            );

            expect(game?.frames.length).toEqual(13);
            verifyPersonRoles(game, db);
        }
    });
});

describe('GameManager.joinGame', () => {
    test('fulfills game role constraints', async () => {
        // Because role constraints are resolved by swapping to a random location, run this a bunch of times, with differing
        // lengths of completed game.
        for (let i = 0; i < 100; ++i) {
            let newGame = db.addRandomGame();
            const nextFrameIdx = newGame.frames.findIndex((frame) => !frame.isComplete) + 1;
            const originalFrames = newGame.frames.length;
            const expectedPersonIds = [...newGame.frames.map((frame) => frame.personId), authorPerson.id].sort();
            const framesThatShouldntChange = newGame.frames.slice(0, nextFrameIdx);

            await mgr.joinGame(defaultChannel, authorPersonRef, newGame.name);

            let game = db.games.get(newGame.name);
            expect(game).toBeDefined();
            expect(game?.frames.length).toEqual(originalFrames + 1);
            verifyPersonRoles(game, db);
            expect(game?.frames.slice(0, nextFrameIdx)).toEqual(framesThatShouldntChange);
            expect(game?.frames.map((frame) => frame.personId).sort()).toEqual(expectedPersonIds);
        }
    });
});

describe('GameManager.leaveGame', () => {
    test('works', async () => {
        let game = db.games.get('game1');
        expect(game?.frames.length).toEqual(13);

        const secondPerson = game?.frames[1].personId;

        await mgr.leaveGame(defaultChannel, defaultPeopleRefs[0], 'game1');

        game = db.games.get('game1');
        expect(game).toBeDefined();
        expect(game?.frames.length).toEqual(12);
        expect(game?.frames[0].personId).toEqual(secondPerson);
    });

    test('fulfills game role constraints', async () => {
        // Because role constraints are resolved by swapping to a random location, run this a bunch of times
        for (let i = 0; i < 100; ++i) {
            const people = [defaultPeople[0], artistPerson, defaultPeople[1], defaultPeople[2], authorPerson];
            const frames = people.map((person) => FrameModel.create(person.id));
            db.games.set('game1', GameModel.create('game1', defaultChannel, frames));

            let game = db.games.get('game1');
            expect(game?.frames.length).toEqual(5);

            await mgr.leaveGame(defaultChannel, defaultPeopleRefs[0], 'game1');

            game = db.games.get('game1');
            expect(game?.frames.length).toEqual(4);
            verifyPersonRoles(game, db);

            await mgr.leaveGame(defaultChannel, artistPersonRef, 'game1');

            game = db.games.get('game1');
            expect(game).toBeDefined();
            expect(game?.frames.length).toEqual(3);
            verifyPersonRoles(game, db);
        }
    });

    test('drops and shuffles after completed turns', async () => {
        // Because role constraints are resolved by swapping to a random location, run this a bunch of times
        for (let i = 0; i < 100; ++i) {
            const people = [
                defaultPeople[0],
                artistPerson,
                defaultPeople[1],
                defaultPeople[2],
                authorPerson,
                defaultPeople[3],
            ];
            const frames = people.map((person) => FrameModel.create(person.id));
            frames[0].title = 'blah';
            frames[1].image = FrameImageModel.create('abc', 'def', 5, 10);
            db.games.set('game1', GameModel.create('game1', defaultChannel, frames));

            let game = db.games.get('game1');
            expect(game?.frames.length).toEqual(6);

            await mgr.leaveGame(defaultChannel, defaultPeopleRefs[1], 'game1');

            game = db.games.get('game1');
            expect(game?.frames.length).toEqual(5);
            verifyPersonRoles(game, db);
        }
    });
});
