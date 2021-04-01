import {
    AvatarModel,
    BotTarget,
    ChannelModel,
    FrameImageModel,
    FrameModel,
    GameModel,
    IDb,
    PersonFrameRole,
    PersonModel,
} from './Db';
import { Readable, Writable } from 'stream';
import fs from 'fs';
import { file as makeTmpFile } from 'tmp-promise';
import { Db } from './Db';
import { generateFakeWord } from 'fakelish';
import { Bot, MessageContent, Bold, GameLogicError, Block, PersonRef, MessageChunk, IBot } from './Bot';
import { FramePlayData } from './api';
import ImageStore from './ImageStore';
import { ImageProcessor } from './ImageProcessor';
import spacetime from 'spacetime';
import Cfg from './Cfg';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { RandomEmoji } from './Emojis';

import { v4 as uuid } from 'uuid';
import ArrayUtils from './Utils';
import Utils from './Utils';

// Cheap IOC container
export class GameManagerProvider {
    _gameManager: GameManager | null = null;

    get gameManager(): GameManager {
        if (!this._gameManager) {
            throw new Error('GameManager not initialized');
        }

        return this._gameManager;
    }
}

export class GameManager {
    urlBase: string;

    constructor(private db: IDb, private discordBot: IBot, private slackBot: IBot) {
        this.urlBase = Cfg.baseWebPath;
    }

    private async resolvePerson(person: PersonRef): Promise<PersonModel> {
        const dbPerson = await this.db.getPersonFromService(person.id, person.target);
        if (dbPerson) {
            // Check for preferred person ID
            if (dbPerson.preferredPersonId) {
                const preferredPerson = await this.db.getPerson(dbPerson.preferredPersonId);
                if (preferredPerson) {
                    return preferredPerson;
                }
            }

            return dbPerson;
        }

        const newPerson = PersonModel.create(person.id, person.name, person.target);
        await this.db.putPerson(newPerson);
        return newPerson;
    }

    private async resolvePersons(persons: PersonRef[]): Promise<PersonModel[]> {
        const models: PersonModel[] = [];

        for (const person of persons) {
            models.push(await this.resolvePerson(person));
        }
        return models;
    }

    private fulfillPlayerConstraints(players: PersonModel[]) {
        // Find people who have preferred roles and swap them out
        for (let i = 0; i < players.length; ++i) {
            if (!players[i].preferredGameRole) {
                continue;
            }

            const otherIdx = Utils.findRandomInArray(
                players,
                (player) => player.preferredGameRole !== players[i].preferredGameRole
            );

            if (otherIdx >= 0) {
                [players[otherIdx], players[i]] = [players[i], players[otherIdx]];
            }
        }
    }

    async startGame(players: PersonRef[], channel: ChannelModel, includeAvailable: boolean): Promise<void> {
        const persons = await this.resolvePersons(players);
        const personIds = new Set<string>(persons.map((person) => person.id));

        // Add interested people
        let interestedPeople: PersonModel[] = [];

        if (includeAvailable) {
            interestedPeople = (await this.db.getInterest(channel)).filter((person) => !personIds.has(person.id));
        }

        const allPersons = Utils.shuffleArray(persons.concat(interestedPeople));
        this.fulfillPlayerConstraints(allPersons);

        // Collect people
        const frames: Array<FrameModel> = allPersons.map((person) => FrameModel.create(person.id));

        // FIXME -- for dev testing -- remove at some point!
        if (!Cfg.isProduction) {
            while (frames.length < 4) {
                frames.push(FrameModel.create(frames[0].personId));
            }
        }

        if (frames.length < 4) {
            throw new GameLogicError('You need at least 4 people to start a game of Eat Poop You Cat');
        }

        let gameName = await generateFakeWord(7, 12);

        let game = GameModel.create(gameName, channel, frames);

        try {
            await this.db.putGame(game);
        } catch (error) {
            console.log(error);
            throw new GameLogicError('Could not create game');
        }

        let firstPerson = allPersons[0];

        this.sendMessage(
            channel,
            `Game `,
            Bold(game.name),
            ` has begun!  It is now `,
            Bold(firstPerson.name),
            `'s turn.`
        );
        this.sendFrameMessage(game, frames[0], firstPerson);
    }

    private async getFrameData(
        gameName: string,
        frameId: string
    ): Promise<{ game: GameModel; frameIdx: number; frame: FrameModel; parentFrame: FrameModel | null }> {
        const game = await this.db.getGame(gameName);
        if (!game) {
            throw new Error("Game doesn't exist");
        }

        const frameIdx = game.frames.findIndex((frame) => frame.id === frameId);
        if (frameIdx < 0) {
            throw new Error("Frame doesn't exist");
        }

        return {
            game,
            frameIdx,
            frame: game.frames[frameIdx],
            parentFrame: frameIdx > 0 ? game.frames[frameIdx - 1] : null,
        };
    }

    async getFramePlayData(gameName: string, frameId: string): Promise<FramePlayData> {
        const { game, frameIdx, frame, parentFrame } = await this.getFrameData(gameName, frameId);

        if (frame.image || frame.title) {
            throw new Error('Turn already played');
        }

        if (parentFrame && !parentFrame.image && !parentFrame.title) {
            throw new Error('Previous turn not played');
        }

        return {
            title: parentFrame?.title,
            image: parentFrame?.image?.toApi(),
        };
    }

    async playTitleTurn(gameName: string, frameId: string, title: string) {
        const { game, frameIdx, frame, parentFrame } = await this.getFrameData(gameName, frameId);
        const person = await this.db.getPerson(frame.personId);

        if (parentFrame?.title || (parentFrame && !parentFrame.image)) {
            throw new Error('Previous turn state is inconsistent');
        }

        frame.title = title;
        game.frames[frameIdx] = frame;

        await this.db.putGame(game);
        await this.updateAvatar(person);
        await this.onFrameDone(game, frameIdx);
    }

    private async pipeToStream(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            output.on('finish', () => {
                resolve();
            });
            output.on('error', (err) => {
                reject(err);
            });
            input.pipe(output);
        });
    }

    private async unlink(path: string) {
        return new Promise<void>((resolve, reject) => {
            fs.unlink(path, () => {
                resolve();
            });
        });
    }

    private async updateAvatar(person: PersonModel | undefined) {
        if (!person) {
            return; // No person to update
        }

        const lastValid = spacetime().subtract(1, 'month');

        if (person.avatar && spacetime(person.avatar.lastUpdated).isAfter(lastValid)) {
            return; // Nothing to update
        }

        const botAvatar = await this.getBotTarget(person.target).getAvatar(person);

        if (!botAvatar) {
            return; // Nothing to update
        }

        // Fetch avatar
        const { fd, path, cleanup } = await makeTmpFile();
        try {
            const fileWriteStream = await fs.createWriteStream('', { fd });
            const avatarRequest = await fetch(botAvatar.url);
            if (!avatarRequest.body) {
                return; // No avatar body?
            }

            this.pipeToStream(avatarRequest.body, fileWriteStream);

            const fileReadStream1 = await fs.createReadStream(path);
            const cryptoStream = crypto.createHash('md5');

            this.pipeToStream(fileReadStream1, cryptoStream);
            const hash = cryptoStream.digest('hex');

            if (hash === person.avatar?.hash) {
                return; // Same avatar as before
            }
            const fileReadStream2 = await fs.createReadStream(path);

            const { fileName, fileUrl } = await ImageStore.uploadAvatar(person.id, fileReadStream2);

            const newAvatar = AvatarModel.create(fileUrl, botAvatar.width, botAvatar.height, hash);

            person.avatar = newAvatar;

            await this.db.putPerson(person);
            await cleanup();
        } finally {
            await this.unlink(path);
        }
    }

    async playImageTurn(gameName: string, frameId: string, blob: Readable) {
        const { game, frameIdx, frame, parentFrame } = await this.getFrameData(gameName, frameId);
        const person = await this.db.getPerson(frame.personId);

        if (parentFrame?.image || (parentFrame && !parentFrame.title)) {
            throw new Error('Previous turn state is inconsistent');
        }

        const { fd, path, cleanup } = await makeTmpFile();

        try {
            const fileWriteStream = await fs.createWriteStream('', { fd });
            await this.pipeToStream(blob, fileWriteStream);

            const { width, height } = await ImageProcessor.decodeImage(path);

            const fileReadStream2 = await fs.createReadStream(path);
            const { fileName, fileUrl } = await ImageStore.uploadImage(gameName, frameId, fileReadStream2);

            frame.image = FrameImageModel.create(fileUrl, fileName, width, height);

            await this.db.putGame(game);
            await this.updateAvatar(person);
            await this.onFrameDone(game, frameIdx);
            await cleanup();
        } finally {
            await this.unlink(path);
        }
    }

    private getGameUrl(game: GameModel) {
        return `${this.urlBase}/game/${game.name}`;
    }

    private async createGameTitleImage(game: GameModel) {
        // Pick a random image
        const imageFrames = game.frames.map((frame) => frame.image).filter(ArrayUtils.notNull);

        if (imageFrames.length < 0) {
            return;
        }

        const image = imageFrames[Math.floor(Math.random() * imageFrames.length)];

        const { fd, path, cleanup } = await makeTmpFile();
        try {
            // Fetch image
            const fileWriteStream = await fs.createWriteStream('', { fd });
            const frameImage = await fetch(image.imageUrl);
            if (!frameImage.body) {
                return; // No avatar body?
            }

            await this.pipeToStream(frameImage.body, fileWriteStream);

            const titleImageData = await ImageProcessor.makeTitleImage(path);

            const imageTitleReadStream = await fs.createReadStream(titleImageData.path);
            const titleStoreData = await ImageStore.uploadImage(game.name, 'title-image', imageTitleReadStream);

            game.titleImage = FrameImageModel.create(
                titleStoreData.fileUrl,
                titleStoreData.fileName,
                titleImageData.width,
                titleImageData.height
            );

            cleanup();
        } finally {
            this.unlink(path);
        }
    }

    private async onFrameDone(game: GameModel, frameIdx: number) {
        // If the game is over, mark the game model and tell everyone
        if (frameIdx + 1 >= game.frames.length) {
            game.isComplete = true;

            await this.createGameTitleImage(game);
            await this.db.putGame(game);
            await this.sendMessage(game.channel, `Game `, Bold(game.name), ` is done!  ${this.getGameUrl(game)}`);
        }

        // Game's not over yet -- tell the next player
        else {
            const nextFrame = game.frames[frameIdx + 1];
            const nextPerson = await this.db.getPerson(nextFrame.personId);

            await this.sendFrameMessage(game, nextFrame, nextPerson);
            await this.sendMessage(
                game.channel,
                `It is now `,
                Bold(nextPerson?.name || '??'),
                `'s turn for game `,
                Bold(game.name),
                `.`
            );
        }
    }

    private getFramePlayUrl(game: GameModel, frame: FrameModel) {
        return `${this.urlBase}/play/${game.name}/${frame.id}`;
    }

    async sendFrameMessage(game: GameModel, frame: FrameModel, person: PersonModel | undefined) {
        if (!person) {
            return;
        }

        this.sendDM(
            person,
            `It's your turn to play Eat Poop You Cat on game `,
            Bold(game.name),
            `!  You have two days to play your turn.\nYou can go here to play: ${this.getFramePlayUrl(game, frame)}`
        );
    }

    private getBotTarget(target: BotTarget): IBot {
        switch (target) {
            case BotTarget.discord:
                return this.discordBot;
            case BotTarget.slack:
                return this.slackBot;
        }
    }

    private async sendMessage(channel: ChannelModel, ...content: MessageContent) {
        await this.getBotTarget(channel.target).sendMessage(channel, ...content);
    }

    private async sendDM(person: PersonModel, ...content: MessageContent) {
        let dmTarget = person;

        // Check for person redirect
        if (person.preferredPersonId) {
            const preferredPerson = await this.db.getPerson(person.preferredPersonId);
            if (preferredPerson) {
                dmTarget = preferredPerson;
            }
        }

        await this.getBotTarget(dmTarget.target).sendDM(dmTarget, ...content);
    }

    private async getGameStatuses(channel: ChannelModel): Promise<MessageContent> {
        const query = {
            isComplete: false,
            'channel.id': channel.id,
        };

        const games = await (await this.db.getGames()).filter((game) => !game.isComplete);

        if (games.length === 0) {
            return [`${RandomEmoji('shrugger')} No games are in progress in this channel`];
        }

        const messagePromises: Promise<MessageContent>[] = games.map(async (game) => {
            const nextFrameIdx = game.frames.findIndex((frame) => !frame.image && !frame.title);
            if (nextFrameIdx < 0) {
                return []; // Should never happen
            }
            const nextFrame = game.frames[nextFrameIdx];
            const turnsComplete = nextFrameIdx;
            const turnsLeft = game.frames.length - nextFrameIdx;
            const person = await this.db.getPerson(nextFrame.personId);

            return [
                '\n• ',
                Bold(game.name),
                ': Waiting on ',
                Bold(person?.name || '??'),
                `.  ${turnsComplete} turns completed, ${turnsLeft} remaining.`,
            ];
        });

        const gameMessages = (await Promise.all(messagePromises)).flatMap((messages) => messages);
        return ['🕒 The following games are in progress:', ...gameMessages];
    }

    async getAvailableStatuses(channel: ChannelModel): Promise<MessageContent> {
        const available = await this.db.getInterest(channel);

        if (available.length === 0) {
            return [`\n\n${RandomEmoji('shrugger')} No people are available to play in this channel`];
        }

        const availableNames = available
            .flatMap<MessageChunk>((person) => [', ', Bold(person.name)])
            .slice(1);

        return [
            `\n\n${RandomEmoji('artist')} The following people are available to play in this channel: `,
            ...availableNames,
        ];
    }

    async reportStatus(channel: ChannelModel): Promise<void> {
        const [gameMessages, availableMessages] = await Promise.all([
            this.getGameStatuses(channel),
            this.getAvailableStatuses(channel),
        ]);
        await this.sendMessage(channel, ...gameMessages, ...availableMessages);
    }

    async joinGame(channel: ChannelModel, personRef: PersonRef, gameName: string): Promise<void> {
        const [game, person] = await Promise.all([this.db.getGame(gameName), this.resolvePerson(personRef)]);

        if (!game) {
            throw new GameLogicError('Game ', Bold(gameName), ' does not exist');
        }

        if (game.isComplete) {
            throw new GameLogicError('Game ', Bold(gameName), ' is already complete');
        }

        if (game.frames.find((frame) => frame.personId === person.id)) {
            throw new GameLogicError('You are already in game ', Bold(gameName));
        }

        game.frames.push(FrameModel.create(person.id));
        await this.db.putGame(game);

        this.sendMessage(channel, 'OK ', Bold(person.name), ', you are now in game ', Bold(gameName));
    }

    async leaveGame(channel: ChannelModel, personRef: PersonRef, gameName: string): Promise<void> {
        const [game, person] = await Promise.all([
            this.db.getGame(gameName),
            this.db.getPersonFromService(personRef.id, personRef.target),
        ]);

        if (!game) {
            throw new GameLogicError('Game ', Bold(gameName), ' does not exist');
        }

        if (game.isComplete) {
            throw new GameLogicError('Game ', Bold(gameName), ' is already complete');
        }

        const frameIdx = game.frames.findIndex((frame) => frame.personId === person?.id);

        if (frameIdx === -1) {
            throw new GameLogicError('You are not in game ', Bold(gameName));
        }

        if (game.frames[frameIdx].isComplete) {
            throw new GameLogicError(`You've already played your turn on game `, Bold(gameName));
        }

        game.frames.splice(frameIdx, 1);
        await this.db.putGame(game);
        await this.onFrameDone(game, frameIdx - 1);
    }

    async setAvailable(channel: ChannelModel, personRef: PersonRef, isAvailable: boolean) {
        const person = await this.resolvePerson(personRef);
        await this.db.putInterest(person, channel, isAvailable);

        if (!isAvailable) {
            this.sendMessage(
                channel,
                'OK ',
                Bold(person.name),
                ', you are no longer available for new games in this channel.'
            );
        } else {
            this.sendMessage(
                channel,
                'OK ',
                Bold(person.name),
                ', you are now available for new games in this channel.'
            );
        }
    }

    private async notifyGame(game: GameModel): Promise<void> {
        // Find frame
        const incompleteFrameIdx = game.frames.findIndex((frame) => !frame.isComplete);
        if (incompleteFrameIdx < 0) {
            return; // Shouldn't happen
        }

        const frame = game.frames[incompleteFrameIdx];
        const person = await this.db.getPerson(frame.personId);

        const warnings = frame.warnings || 0;

        if (warnings == 2) {
            // Drop this person from the game
            game.frames.splice(incompleteFrameIdx, 1);
            await this.db.putGame(game);
            await this.onFrameDone(game, incompleteFrameIdx - 1);

            if (person) {
                await this.sendDM(
                    person,
                    'Oh no!  You took too long to play your turn on game ',
                    Bold(game.name),
                    '!\n',
                    `If you'd like to re-join the game, you can use the command `,
                    Block(`@epyc join ${game.name}`)
                );
            }

            return;
        }

        // Add one warning ping
        frame.warnings = warnings + 1;
        await this.db.putGame(game);

        if (person) {
            await this.sendDM(
                person,
                'This is a reminder to play your turn on game ',
                Bold(game.name),
                ' in the next day!\n',
                `You can go here to play your turn: ${this.getFramePlayUrl(game, frame)}`
            );
        }
    }

    async notifyPlayers(): Promise<void> {
        const games = (await this.db.getGames()).filter((game) => !game.isComplete);

        const promises = games.map((game) => this.notifyGame(game));

        await Promise.all(promises);
    }

    async setRolePreference(channel: ChannelModel, personRef: PersonRef, role: 'author' | 'artist' | 'none') {
        const person = await this.resolvePerson(personRef);

        const roleValue: PersonFrameRole | undefined = role === 'none' ? undefined : PersonFrameRole[role];
        person.preferredGameRole = roleValue;
        await this.db.putPerson(person);

        if (!roleValue) {
            await this.sendMessage(channel, 'OK ', Bold(person.name), ', you no longer have a preferred game role.');
        } else {
            await this.sendMessage(channel, 'OK ', Bold(person.name), ', you will now .');
        }
    }
}
