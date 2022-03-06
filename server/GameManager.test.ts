import { v4 as uuid } from 'uuid';
import fs from 'fs';
import { Bot, IBot, MessageContent, PersonAvatar, PersonRef } from './Bot';
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
import { fetch } from 'undici';
const { fetch: fetchActual, Response } = jest.requireActual('undici');
import { Readable } from 'stream';

// Mock ImageProcessor so we don't bring in Jimp, which fails in Jest tests :(
// If unit tests ever actually
// jest.mock('./ImageProcessor', () => {
//     return function () {
//         return {};
//     };
// });

jest.mock('./ImageStore', () => ({
    uploadImage: async (
        gameName: string,
        frameId: string,
        data: Readable
    ): Promise<{ fileName: string; fileUrl: string }> => {
        return {
            fileName: 'fakeFileName',
            fileUrl: 'fakeFileUrl',
        };
    },
}));

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

jest.mock('undici', () => ({
    fetch: jest.fn(() => {
        return fetchActual();
    }),
}));

// Disable console logs
jest.spyOn(console, 'log').mockImplementation(() => {});

class MockBot implements IBot {
    messages = jest.fn<any, [ChannelModel, string]>();
    dms = jest.fn<any, [PersonModel, string]>();

    async sendMessage(channel: ChannelModel, ...content: MessageContent): Promise<void> {
        this.messages(channel, this.msgToString(content));
    }
    async sendDM(person: PersonModel, ...content: MessageContent): Promise<void> {
        this.dms(person, this.msgToString(content));
    }
    async getAvatar(person: PersonModel): Promise<PersonAvatar | undefined> {
        return undefined;
    }

    private msgToString(msg: MessageContent): string {
        return msg
            .map((chunk) => {
                if (typeof chunk === 'string') {
                    return chunk;
                }
                return chunk.message;
            })
            .join('');
    }
}

const defaultPeopleRefs: PersonRef[] = Array.from({ length: 10 }, (z, idx) => ({
    id: `person${idx}`,
    name: `Person ${idx}`,
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

const discordPersonRef: PersonRef = { id: 'discordPerson', name: 'Discord Person', target: BotTarget.discord };
const discordPerson = PersonModel.create(discordPersonRef.id, discordPersonRef.name, discordPersonRef.target);

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
        this.interests = this.interests.filter((interest) => {
            return (
                interest.channelId !== channel.id ||
                interest.target !== channel.target ||
                interest.personId !== person.id
            );
        });

        if (isInterested) {
            this.interests.push({ channelId: channel.id, target: channel.target, personId: person.id });
        }
    }

    populate() {
        this.persons.clear();
        defaultPeople.forEach((person) => {
            this.persons.set(person.id, person);
        });

        this.persons.set(artistPerson.id, artistPerson);
        this.persons.set(authorPerson.id, authorPerson);

        this.persons.set(discordPerson.id, discordPerson);

        this.interests.splice(0, this.interests.length);
        this.interests.push({
            personId: discordPerson.id,
            channelId: defaultChannel.id,
            target: defaultChannel.target,
        });

        this.games.clear();
        const frames = Array.from(this.persons.values()).map((person) => FrameModel.create(person.id));
        db.games.set('game1', GameModel.create('game1', defaultChannel, frames));

        // Add completed game
        const game2Frames = [
            FrameModel.create(defaultPeople[0].id),
            FrameModel.create(defaultPeople[1].id),
            FrameModel.create(defaultPeople[2].id),
            FrameModel.create(defaultPeople[3].id),
        ];
        game2Frames[0].title = 'title';
        game2Frames[1].image = FrameImageModel.create('imageurl', 'imagefile', 1, 1);
        game2Frames[2].title = 'title';
        game2Frames[3].image = FrameImageModel.create('imageurl', 'imagefile', 1, 1);
        const game2 = GameModel.create('game2', defaultChannel, game2Frames);
        game2.isComplete = true;
        db.games.set('game2', game2);
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

let db = new MockDb();
let discordBot = new MockBot();
let slackBot = new MockBot();
let mgr = new GameManager(db, discordBot, slackBot);

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
    jest.clearAllMocks();

    db = new MockDb();
    discordBot = new MockBot();
    slackBot = new MockBot();
    mgr = new GameManager(db, discordBot, slackBot);

    jest.spyOn(mgr, 'runLater').mockImplementation(async (fn: () => Promise<void>) => {
        return fn();
    });

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
    test('works', async () => {
        const newPersonRef: PersonRef = {
            id: 'newPerson',
            target: BotTarget.slack,
            name: 'New Person',
        };

        let game = await db.getGame('game1');
        expect(game?.frames.length).toEqual(13);

        await mgr.joinGame(defaultChannel, newPersonRef, 'game1');
        game = await db.getGame('game1');

        const newPerson = await db.getPersonFromService(newPersonRef.id, newPersonRef.target);

        expect(newPerson).toBeDefined();
        expect(game?.frames.length).toEqual(14);
        expect(game?.frames.some((frame) => frame.personId === newPerson?.id));

        // Verify notification is sent to channel
        expect(slackBot.messages.mock.calls.length).toEqual(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain(', you are now in game ');
    });

    test("rejects when game doesn't exist", async () => {
        await expect(mgr.joinGame(defaultChannel, artistPersonRef, 'game1bbb')).rejects.toThrowError(' does not exist');
    });

    test('rejects when player is already in the game', async () => {
        await expect(mgr.joinGame(defaultChannel, artistPersonRef, 'game1')).rejects.toThrowError(
            'You are already in game'
        );
    });

    test('rejects when game is already completed', async () => {
        await expect(mgr.joinGame(defaultChannel, artistPersonRef, 'game2')).rejects.toThrowError(
            'is already complete'
        );
    });

    test('works', async () => {
        const newPersonRef: PersonRef = {
            id: 'newPerson',
            target: BotTarget.slack,
            name: 'New Person',
        };

        await mgr.joinGame(defaultChannel, newPersonRef, 'game1');
    });

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

    test('notifies next player', async () => {
        let game = db.games.get('game1');
        expect(game?.frames.length).toEqual(13);

        await mgr.leaveGame(defaultChannel, defaultPeopleRefs[0], 'game1');

        game = db.games.get('game1');

        expect(slackBot.messages.mock.calls.length).toBe(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain("'s turn for game ");

        expect(slackBot.dms.mock.calls.length).toBe(1);
        expect(slackBot.dms.mock.calls[0][1]).toContain("It's your turn to play Eat Poop You Cat on game ");
    });

    test("doesn't notify when a future player leaves", async () => {
        let game = db.games.get('game1');
        expect(game?.frames.length).toEqual(13);

        await mgr.leaveGame(defaultChannel, defaultPeopleRefs[1], 'game1');

        game = db.games.get('game1');

        expect(slackBot.messages.mock.calls.length).toBe(0);
        expect(slackBot.dms.mock.calls.length).toBe(0);
    });

    test('cleans up game when last player leaves', async () => {
        // Mock out fetch so the game title image fetching doesn't fail
        mockFetch.mockResolvedValueOnce(new Response(undefined));

        const frames = defaultPeople.slice(0, 4).map((person) => FrameModel.create(person.id));
        frames[0].title = 'abc';
        frames[1].image = FrameImageModel.create('abc', 'def', 5, 5);
        frames[2].title = 'def';

        db.games.set('game1', GameModel.create('game1', defaultChannel, frames));

        await mgr.leaveGame(defaultChannel, defaultPeopleRefs[3], 'game1');

        let game = db.games.get('game1');

        expect(game?.isComplete).toBe(true);
        expect(game?.frames.length).toBe(3);

        expect(slackBot.messages.mock.calls.length).toBe(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain(' is done!  ');
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

    test("rejects when game doesn't exist", async () => {
        await expect(mgr.leaveGame(defaultChannel, artistPersonRef, 'game1bbb')).rejects.toThrowError(
            ' does not exist'
        );
    });

    test('rejects when player is not in the game', async () => {
        const randomPerson: PersonRef = {
            id: 'abc123random',
            name: 'somethingrandom',
            target: BotTarget.slack,
        };
        await expect(mgr.leaveGame(defaultChannel, randomPerson, 'game1')).rejects.toThrowError('You are not in game');
    });

    test('rejects when game is already completed', async () => {
        await expect(mgr.leaveGame(defaultChannel, defaultPeopleRefs[0], 'game2')).rejects.toThrowError(
            'is already complete'
        );
    });
});

describe('GameManager.setAvailable', () => {
    test('works when setting availability', async () => {
        expect(db.interests.length).toEqual(1);
        await mgr.setAvailable(defaultChannel, artistPersonRef, true);
        expect(db.interests.length).toEqual(2);
        expect(
            db.interests.some(
                (interest) =>
                    interest.personId === artistPerson.id &&
                    interest.channelId === defaultChannel.id &&
                    interest.target === defaultChannel.target
            )
        ).toBeTruthy();

        expect(slackBot.messages.mock.calls.length).toEqual(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain(', you are now available for new games in this channel.');
    });

    test('works when removing availability', async () => {
        expect(db.interests.length).toEqual(1);
        await mgr.setAvailable(defaultChannel, discordPersonRef, false);
        expect(db.interests.length).toEqual(0);

        expect(slackBot.messages.mock.calls.length).toEqual(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain(
            ', you are no longer available for new games in this channel.'
        );
    });
});

const createInProgressGame = async (numFrames: number, maxFrames: number = 4): Promise<GameModel> => {
    const frames = defaultPeople
        .slice(0, Math.max(numFrames, Math.min(maxFrames, 4)))
        .map((person) => FrameModel.create(person.id));
    if (numFrames > 0) {
        frames[0].title = 'abc';
    }
    if (numFrames > 1) {
        frames[1].image = FrameImageModel.create('abc', 'def', 5, 5);
    }
    if (numFrames > 2) {
        frames[2].title = 'def';
    }
    if (numFrames > 3) {
        frames[3].image = FrameImageModel.create('ghi', 'jkl', 15, 15);
    }

    const game = GameModel.create('game1', defaultChannel, frames);
    db.games.set('game1', game);

    return game;
};

describe('GameManager.playImageTurn', () => {
    test('works', async () => {
        const newGame = await createInProgressGame(1);

        const frameStream = fs.createReadStream('../client/epyc-sample-1.png');

        await mgr.playImageTurn(newGame.name, newGame.frames[1].id || '', frameStream);

        const game = await db.getGame(newGame.name);

        expect(game?.isComplete).toEqual(false);
        expect(game?.frames[1].isComplete).toEqual(true);
        expect(game?.frames[1].image?.width).toEqual(325);
        expect(game?.frames[1].image?.height).toEqual(250);
        expect(game?.frames[1].image?.imageFileName).toEqual('fakeFileName');
        expect(game?.frames[1].image?.imageUrl).toEqual('fakeFileUrl');

        expect(slackBot.messages.mock.calls.length).toEqual(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain("It is now Person 2's turn for game game1");
        expect(slackBot.dms.mock.calls.length).toEqual(1);
        expect(slackBot.dms.mock.calls[0][1]).toContain("It's your turn to play Eat Poop You Cat on game game1");
    });

    test('cleans up game when last frame played', async () => {
        // Mock out fetch so the game title image fetching doesn't fail
        mockFetch.mockResolvedValueOnce(new Response(undefined));

        const newGame = await createInProgressGame(3);

        const frameStream = fs.createReadStream('../client/epyc-sample-1.png');

        await mgr.playImageTurn(newGame.name, newGame.frames[3].id || '', frameStream);

        const game = await db.getGame(newGame.name);

        expect(game?.isComplete).toEqual(true);
        expect(game?.frames[3].isComplete).toEqual(true);
        expect(game?.frames[3].image?.width).toEqual(325);
        expect(game?.frames[3].image?.height).toEqual(250);
        expect(game?.frames[3].image?.imageFileName).toEqual('fakeFileName');
        expect(game?.frames[3].image?.imageUrl).toEqual('fakeFileUrl');

        expect(slackBot.messages.mock.calls.length).toEqual(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain('Game game1 is done!');
        expect(slackBot.dms.mock.calls.length).toEqual(0);
    });

    test("rejects when game doesn't exist", async () => {
        const frameStream = fs.createReadStream('../client/epyc-sample-1.png');

        await expect(mgr.playImageTurn('InvalidGameID', 'InvalidTurnID', frameStream)).rejects.toThrowError(
            "Game doesn't exist"
        );
    });

    test("rejects when turn doesn't exist", async () => {
        const frameStream = fs.createReadStream('../client/epyc-sample-1.png');

        await expect(mgr.playImageTurn('game1', 'InvalidTurnID', frameStream)).rejects.toThrowError(
            "Frame doesn't exist"
        );
    });

    test('rejects when previous turn was an image turn', async () => {
        const newGame = await createInProgressGame(2);

        const frameStream = fs.createReadStream('../client/epyc-sample-1.png');

        await expect(mgr.playImageTurn(newGame.name, newGame.frames[2].id, frameStream)).rejects.toThrowError(
            'Previous turn state is inconsistent'
        );
    });

    test('rejects when turn is completed', async () => {
        const newGame = await createInProgressGame(3);

        const frameStream = fs.createReadStream('../client/epyc-sample-1.png');

        await expect(mgr.playImageTurn(newGame.name, newGame.frames[1].id, frameStream)).rejects.toThrowError(
            'Turn is already complete'
        );
    });
});

describe('GameManager.playTitleTurn', () => {
    test('works', async () => {
        const newGame = await createInProgressGame(0);

        await mgr.playTitleTurn(newGame.name, newGame.frames[0].id || '', 'New title');

        const game = await db.getGame(newGame.name);

        expect(game?.isComplete).toEqual(false);
        expect(game?.frames[0].isComplete).toEqual(true);
        expect(game?.frames[0].title).toEqual('New title');

        expect(slackBot.messages.mock.calls.length).toEqual(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain("It is now Person 1's turn for game game1");
        expect(slackBot.dms.mock.calls.length).toEqual(1);
        expect(slackBot.dms.mock.calls[0][1]).toContain("It's your turn to play Eat Poop You Cat on game game1");
    });

    test('cleans up game when last frame played', async () => {
        // Mock out fetch so the game title image fetching doesn't fail
        mockFetch.mockResolvedValueOnce(new Response(undefined));

        const newGame = await createInProgressGame(2, 3);

        await mgr.playTitleTurn(newGame.name, newGame.frames[2].id || '', 'New title');

        const game = await db.getGame(newGame.name);

        expect(game?.isComplete).toEqual(true);
        expect(game?.frames[2].isComplete).toEqual(true);
        expect(game?.frames[2].title).toEqual('New title');

        expect(slackBot.messages.mock.calls.length).toEqual(1);
        expect(slackBot.messages.mock.calls[0][1]).toContain('Game game1 is done!');
        expect(slackBot.dms.mock.calls.length).toEqual(0);
    });

    test("rejects when game doesn't exist", async () => {
        await expect(mgr.playTitleTurn('InvalidGameID', 'InvalidTurnID', 'abc')).rejects.toThrowError(
            "Game doesn't exist"
        );
    });

    test("rejects when turn doesn't exist", async () => {
        await expect(mgr.playTitleTurn('game1', 'InvalidTurnID', 'abc')).rejects.toThrowError("Frame doesn't exist");
    });

    test('rejects when previous turn was a title turn', async () => {
        const newGame = await createInProgressGame(3);

        await expect(mgr.playTitleTurn(newGame.name, newGame.frames[3].id, 'abc')).rejects.toThrowError(
            'Previous turn state is inconsistent'
        );
    });

    test('rejects when turn is completed', async () => {
        const newGame = await createInProgressGame(2);

        await expect(mgr.playTitleTurn(newGame.name, newGame.frames[0].id, 'abc')).rejects.toThrowError(
            'Turn is already complete'
        );
    });
});

describe('GameManager.onFrameDone', () => {
    test('still succeeds when title image generation fails', async () => {
        // Mock out fetch so generating title image always fails
        mockFetch.mockRejectedValueOnce(new Error('Failure!'));

        // Mock stderr so we verify it's logged and doesn't pollute test output
        let stderrMock = jest.spyOn(console, 'error').mockImplementation(() => {});

        const newGame = await createInProgressGame(2, 3);
        await mgr.playTitleTurn(newGame.name, newGame.frames[2].id || '', 'New title');

        const game = await db.getGame(newGame.name);
        expect(game?.isComplete).toEqual(true);

        expect(stderrMock).toHaveBeenCalled();
        expect(stderrMock.mock.calls[0][0]).toContain('Error occurred while creating title image');
        stderrMock.mockRestore();
    });
});
