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
import { Logger } from './Logger';

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

            // Update name if it's changed
            if (dbPerson.name !== person.name) {
                dbPerson.name = person.name;
                await this.db.putPerson(dbPerson);
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

    private isRoleIndexCorrect(index: number, role: PersonFrameRole | undefined) {
        if (!role) {
            return true;
        }

        const desiredOffset = role === PersonFrameRole.author ? 0 : 1;
        return index % 2 === desiredOffset;
    }

    private fulfillPlayerConstraints(players: PersonModel[], startingIdx: number = 0): PersonModel[] {
        const arrayToCheck = players.slice();

        // Find people who have preferred roles and swap them out
        for (let i = 0; i < arrayToCheck.length; ++i) {
            const thisPlayer = arrayToCheck[i];

            if (this.isRoleIndexCorrect(i + startingIdx, thisPlayer.preferredGameRole)) {
                continue;
            }

            const otherIdx = Utils.findRandomInArray(arrayToCheck, (player, idx) => {
                return (
                    this.isRoleIndexCorrect(i + startingIdx, player.preferredGameRole) &&
                    this.isRoleIndexCorrect(idx + startingIdx, thisPlayer.preferredGameRole)
                );
            });

            if (otherIdx >= 0) {
                [arrayToCheck[otherIdx], arrayToCheck[i]] = [arrayToCheck[i], arrayToCheck[otherIdx]];
            }
        }

        return arrayToCheck;
    }

    async startGame(
        players: PersonRef[],
        channel: ChannelModel,
        includeAvailable: boolean
    ): Promise<GameModel | undefined> {
        const persons = await this.resolvePersons(players);
        const personIds = new Set<string>(persons.map((person) => person.id));

        // Add interested people
        let interestedPeople: PersonModel[] = [];

        if (includeAvailable) {
            interestedPeople = (await this.db.getInterest(channel)).filter((person) => !personIds.has(person.id));
        }

        const allPersons = this.fulfillPlayerConstraints(Utils.shuffleArray(persons.concat(interestedPeople)));

        // Collect people
        const frames: Array<FrameModel> = allPersons.map((person) => FrameModel.create(person.id));

        // FIXME -- for dev testing -- remove at some point!
        if (!Cfg.isProduction && frames.length > 0) {
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
            Logger.exception(error);
            throw new GameLogicError('Could not create game');
        }

        let firstPerson = allPersons[0];

        await this.sendMessage(
            channel,
            `Game `,
            Bold(game.name),
            ` has begun!  It is now `,
            Bold(firstPerson.name),
            `'s turn.`
        );
        await this.sendFrameMessage(game, frames[0], firstPerson);

        return game;
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

        if (frame.isComplete) {
            throw new Error('Turn is already complete');
        }

        if (parentFrame?.title || (parentFrame && !parentFrame.image)) {
            throw new Error('Previous turn state is inconsistent');
        }

        frame.title = title;
        game.frames[frameIdx] = frame;

        await this.db.putGame(game);
        await this.onFrameDone(game, frameIdx);
        await this.updateAvatar(person);
    }

    private async pipeToStream(
        input: NodeJS.ReadableStream,
        output: NodeJS.WritableStream,
        completionEvent: string = 'close'
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            output.on(completionEvent, () => {
                resolve();
            });
            input.on('error', (err) => {
                reject(err);
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

    async runLater(fn: () => Promise<void>): Promise<void> {
        // Update avatar asynchronously after request completes
        setTimeout(() => fn(), 1000);
    }

    private async updateAvatar(person: PersonModel | undefined) {
        if (!person) {
            return;
        }
        await this.runLater(() => this.doUpdateAvatar(person));
    }

    private async doUpdateAvatar(person: PersonModel) {
        if (!person) {
            return; // No person to update
        }

        Logger.log(`doUpdateAvatar -- updating avatar for ${person.name}`);

        const lastValid = spacetime().subtract(1, 'month');

        if (person.avatar && spacetime(person.avatar.lastUpdated).isAfter(lastValid)) {
            Logger.log(`doUpdateAvatar -- avatar does not need to be updated`);
            return; // Nothing to update
        }

        const botAvatar = await this.getBotTarget(person.target).getAvatar(person);

        if (!botAvatar) {
            Logger.log(`doUpdateAvatar -- no avatar from bot`);
            return; // Nothing to update
        }

        // Fetch avatar
        const { fd, path, cleanup } = await makeTmpFile();
        try {
            Logger.log(`doUpdateAvatar -- making temp file`);
            const fileWriteStream = await fs.createWriteStream('', { fd });
            Logger.log(`doUpdateAvatar -- fetching avatar from URL ${botAvatar.url}`);
            const avatarRequest = await fetch(botAvatar.url);
            if (!avatarRequest.body) {
                Logger.log(`doUpdateAvatar -- no avatar body`);
                return; // No avatar body?
            }

            Logger.log(`doUpdateAvatar -- fetched avatar`);

            await this.pipeToStream(avatarRequest.body, fileWriteStream);

            const fileReadStream1 = await fs.createReadStream(path);
            const cryptoStream = crypto.createHash('md5');

            await this.pipeToStream(fileReadStream1, cryptoStream, 'finish');
            const hash = cryptoStream.digest('hex');

            if (hash === person.avatar?.hash) {
                Logger.log(`doUpdateAvatar -- avatar has same hash, not saving`);
                return; // Same avatar as before
            }
            const fileReadStream2 = await fs.createReadStream(path);

            Logger.log(`doUpdateAvatar -- uploading new avatar`);
            const { fileName, fileUrl } = await ImageStore.uploadAvatar(person.id, fileReadStream2);
            Logger.log(`doUpdateAvatar -- uploaded new avatar`);

            const newAvatar = AvatarModel.create(fileUrl, botAvatar.width, botAvatar.height, hash);

            person.avatar = newAvatar;

            await this.db.putPerson(person);
            Logger.log(`doUpdateAvatar -- done, cleaning up`);
            await cleanup();
        } catch (err) {
            // Log errors but otherwise eat them -- failing to update an avatar is fine
            Logger.exception(err, 'Error occurred while updating avatar');
        } finally {
            await this.unlink(path);
        }
    }

    async playImageTurn(gameName: string, frameId: string, blob: Readable) {
        Logger.log(`playImageTurn ${gameName} ${frameId}: playing image turn`);
        const { game, frameIdx, frame, parentFrame } = await this.getFrameData(gameName, frameId);
        const person = await this.db.getPerson(frame.personId);

        if (frame.isComplete) {
            throw new Error('Turn is already complete');
        }

        if (parentFrame?.image || (parentFrame && !parentFrame.title)) {
            throw new Error('Previous turn state is inconsistent');
        }

        Logger.log(`playImageTurn ${gameName} ${frameId}: writing stream`);

        const { fd, path, cleanup } = await makeTmpFile();

        try {
            const fileWriteStream = await fs.createWriteStream('', { fd });
            await this.pipeToStream(blob, fileWriteStream);

            Logger.log(`playImageTurn ${gameName} ${frameId}: decoding image`);

            const { width, height } = await ImageProcessor.decodeImage(path);

            Logger.log(`playImageTurn ${gameName} ${frameId}: uploading image`);

            const fileReadStream2 = await fs.createReadStream(path);
            const { fileName, fileUrl } = await ImageStore.uploadImage(gameName, frameId, fileReadStream2);

            frame.image = FrameImageModel.create(fileUrl, fileName, width, height);

            Logger.log(`playImageTurn ${gameName} ${frameId}: writing new game state`);

            await this.db.putGame(game);

            Logger.log(`playImageTurn ${gameName} ${frameId}: checking game completion state`);

            await this.onFrameDone(game, frameIdx);

            Logger.log(`playImageTurn ${gameName} ${frameId}: updating avatar`);

            await this.updateAvatar(person);

            Logger.log(`playImageTurn ${gameName} ${frameId}: cleaning up`);

            await cleanup();
        } finally {
            await this.unlink(path);
        }

        Logger.log(`playImageTurn ${gameName} ${frameId}: done`);
    }

    private getGameUrl(game: GameModel) {
        return `${this.urlBase}/game/${game.name}`;
    }

    private async createGameTitleImage(game: GameModel) {
        // Pick a random image
        const imageFrames = game.frames.map((frame) => frame.image).filter(ArrayUtils.notNull);

        if (imageFrames.length <= 0) {
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
        } catch (err) {
            // Log errors but otherwise eat them -- failing to create title image is fine
            Logger.exception(err, 'Error occurred while creating title image');
        } finally {
            this.unlink(path);
        }
    }

    private async onFrameDone(game: GameModel, frameIdx: number) {
        // If the game is over, mark the game model and tell everyone
        if (frameIdx + 1 >= game.frames.length) {
            game.isComplete = true;

            Logger.log(`playImageTurn ${game.name} ${frameIdx}: game is over, creating title image`);

            await this.createGameTitleImage(game);

            Logger.log(`playImageTurn ${game.name} ${frameIdx}: game is over, writing game state`);

            await this.db.putGame(game);

            Logger.log(`playImageTurn ${game.name} ${frameIdx}: game is over, writing to channel`);

            await this.sendMessage(game.channel, `Game `, Bold(game.name), ` is done!  `, this.getGameUrl(game));

            Logger.log(`playImageTurn ${game.name} ${frameIdx}: game is over, done`);
        }

        // Game's not over yet -- tell the next player
        else {
            const nextFrame = game.frames[frameIdx + 1];
            const nextPerson = await this.db.getPerson(nextFrame.personId);

            Logger.log(`playImageTurn ${game.name} ${frameIdx}: game is still going, sending DM to next person`);

            await this.sendFrameMessage(game, nextFrame, nextPerson);

            Logger.log(`playImageTurn ${game.name} ${frameIdx}: game is still going, writing to channel`);

            await this.sendMessage(
                game.channel,
                `It is now `,
                Bold(nextPerson?.name || '??'),
                `'s turn for game `,
                Bold(game.name),
                `.`
            );

            Logger.log(`playImageTurn ${game.name} ${frameIdx}: game is still going, done`);
        }
    }

    private getFramePlayUrl(game: GameModel, frame: FrameModel) {
        return `${this.urlBase}/play/${game.name}/${frame.id}`;
    }

    async sendFrameMessage(game: GameModel, frame: FrameModel, person: PersonModel | undefined) {
        if (!person) {
            Logger.error(`Could not send frame message for game ${game.name}`);
            return;
        }

        await this.sendDM(
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
        const games = await this.db.getGames({
            isComplete: false,
            channel,
        });

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

        const channelUrl = `${this.urlBase}/games/${channel.target}/${channel.id}`;

        await this.sendMessage(
            channel,
            ...gameMessages,
            ...availableMessages,
            '\n',
            `🖼 To see previous games for this channel click here: ${channelUrl}`
        );
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

        // See if we need to shuffle player into the remaining spots
        const currentFrameIdx = game.frames.findIndex((frame) => !frame.isComplete);
        if (currentFrameIdx >= 0) {
            await this.fulfillRemainingPlayerConstraints(game, currentFrameIdx + 1);
        }

        await this.db.putGame(game);

        this.sendMessage(channel, 'OK ', Bold(person.name), ', you are now in game ', Bold(gameName));
    }

    private async dropFrame(game: GameModel, frameIdx: number) {
        game.frames.splice(frameIdx, 1);

        const nextPlayerIdx = game.frames.findIndex((frame) => !frame.isComplete);
        if (nextPlayerIdx < 0) {
            return; // Game is over
        }

        await this.fulfillRemainingPlayerConstraints(game, nextPlayerIdx);
    }

    private async fulfillRemainingPlayerConstraints(game: GameModel, startingIdx: number) {
        if (startingIdx + 1 >= game.frames.length) {
            return; // No more frames to shuffle, no action to take
        }

        const remaining = await Promise.all(
            game.frames.slice(startingIdx).map((frame) => this.db.getPerson(frame.personId))
        );

        if (remaining.every((person) => !!person)) {
            const remainingPeople = this.fulfillPlayerConstraints(remaining.filter(Utils.notNull), startingIdx);
            const remainingFrames = remainingPeople.map((person) => FrameModel.create(person.id));
            game.frames = game.frames.slice(0, startingIdx).concat(remainingFrames);
        }
    }

    async leaveGame(channel: ChannelModel, personRef: PersonRef, gameName: string): Promise<void> {
        const [game, person] = await Promise.all([this.db.getGame(gameName), this.resolvePerson(personRef)]);

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

        const incompleteFrameIdx = game.frames.findIndex((frame) => !frame.isComplete);

        await this.dropFrame(game, frameIdx);
        await this.db.putGame(game);

        // If we just skipped the current frame, tell the next person
        if (incompleteFrameIdx === frameIdx) {
            await this.onFrameDone(game, frameIdx - 1);
        }
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
            await this.dropFrame(game, incompleteFrameIdx);
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
        const games = await this.db.getGames({ isComplete: false });

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
            await this.sendMessage(
                channel,
                'OK ',
                Bold(person.name),
                `, we will try to make sure you are an ${roleValue}.`
            );
        }
    }
}
