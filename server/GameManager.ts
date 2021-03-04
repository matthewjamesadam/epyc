import { AvatarModel, BotTarget, ChannelModel, FrameImageModel, FrameModel, GameModel, PersonModel } from './Db';
import { Readable, Writable } from 'stream';
import fs from 'fs';
import { file as makeTmpFile } from 'tmp-promise';
import { Db } from './Db';
import { generateFakeWord } from 'fakelish';
import { Bot, MessageContent, Bold, GameLogicError, Block } from './Bot';
import { FramePlayData } from './api';
import ImageStore from './ImageStore';
import { ImageProcessor } from './ImageProcessor';
import spacetime from 'spacetime';
import Cfg from './Cfg';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';

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

    constructor(private db: Db, private discordBot: Bot) {
        this.urlBase = Cfg.baseWebPath;
    }

    async startGame(players: Array<PersonModel>, channel: ChannelModel): Promise<void> {
        // Collect people
        const frames: Array<FrameModel> = players.map((player) => FrameModel.create(player));

        // FIXME -- for dev testing -- remove at some point!
        if (!Cfg.isProduction) {
            while (frames.length < 4) {
                frames.push(frames[0]);
            }
        }

        if (frames.length < 4) {
            throw new GameLogicError('You need at least 4 people to start a game of Eat Poop You Cat');
        }

        let gameName = await generateFakeWord(7, 12);

        let game = GameModel.create(gameName, channel, frames);

        try {
            await this.db.createGame(game);
        } catch (error) {
            console.log(error);
            throw new GameLogicError('Could not create game');
        }

        let firstPerson = frames[0].person;

        this.sendMessage(
            channel,
            `Game `,
            Bold(game.name),
            ` has begun!  It is now `,
            Bold(firstPerson.name),
            `'s turn.`
        );
        this.sendFrameMessage(game, frames[0]);
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

        if (parentFrame?.title || (parentFrame && !parentFrame.image)) {
            throw new Error('Previous turn state is inconsistent');
        }

        frame.title = title;
        game.frames[frameIdx] = frame;

        await this.db.putGame(game);
        await this.updateAvatar(frame.person);
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

    private async updateAvatar(person: PersonModel) {
        const [dbAvatar, botAvatar] = await Promise.all([
            this.db.getAvatar(person.id, person.target),
            this.getBotTarget(person.target).getAvatar(person),
        ]);

        if (!botAvatar) {
            return; // Nothing to update
        }

        const lastValid = spacetime().subtract(1, 'month');

        if (dbAvatar && spacetime(dbAvatar.lastUpdated).isAfter(lastValid)) {
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

            if (hash === dbAvatar?.hash) {
                return; // Same avatar as before
            }

            const id = dbAvatar?.id || uuid();

            const fileReadStream2 = await fs.createReadStream(path);

            const { fileName, fileUrl } = await ImageStore.uploadAvatar(id, fileReadStream2);

            const newAvatar = AvatarModel.create(
                id,
                person.id,
                person.target,
                fileUrl,
                botAvatar.width,
                botAvatar.height,
                hash
            );

            await this.db.putAvatar(newAvatar);
            await cleanup();
        } finally {
            await this.unlink(path);
        }
    }

    async playImageTurn(gameName: string, frameId: string, blob: Readable) {
        const { game, frameIdx, frame, parentFrame } = await this.getFrameData(gameName, frameId);

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
            await this.updateAvatar(frame.person);
            await this.onFrameDone(game, frameIdx);
            await cleanup();
        } finally {
            await this.unlink(path);
        }
    }

    private getGameUrl(game: GameModel) {
        return `${this.urlBase}/game/${game.name}`;
    }

    private static filterNotNull<T>(value: T | null | undefined): value is T {
        return value !== null && value !== undefined;
    }

    private async createGameTitleImage(game: GameModel) {
        // Pick a random image
        const imageFrames = game.frames.map((frame) => frame.image).filter(GameManager.filterNotNull);

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
            await this.sendFrameMessage(game, nextFrame);
            await this.sendMessage(
                game.channel,
                `It is now `,
                Bold(nextFrame.person.name),
                `'s turn for game `,
                Bold(game.name),
                `.`
            );
        }
    }

    private getFramePlayUrl(game: GameModel, frame: FrameModel) {
        return `${this.urlBase}/play/${game.name}/${frame.id}`;
    }

    async sendFrameMessage(game: GameModel, frame: FrameModel) {
        this.getBotTarget(frame.person.target).sendDM(
            frame.person,
            `It's your turn to play Eat Poop You Cat!\nYou can go here to play your turn: ${this.getFramePlayUrl(
                game,
                frame
            )}`
        );
    }

    private getBotTarget(target: BotTarget): Bot {
        switch (target) {
            case BotTarget.discord:
                return this.discordBot;
        }

        throw new Error('No valid bot!'); // FIXME
    }

    private sendMessage(channel: ChannelModel, ...content: MessageContent) {
        this.getBotTarget(channel.target).sendMessage(channel, ...content);
    }

    async reportStatus(channel: ChannelModel): Promise<void> {
        const query = {
            isComplete: false,
            'channel.id': channel.id,
        };

        const games = await (await this.db.getGames()).filter((game) => !game.isComplete);

        if (games.length === 0) {
            throw new GameLogicError('No games are in progress in this channel');
            return;
        }

        const gameMessages: MessageContent = games.flatMap((game) => {
            const nextFrameIdx = game.frames.findIndex((frame) => !frame.image && !frame.title);
            if (nextFrameIdx < 0) {
                return []; // Should never happen
            }
            const nextFrame = game.frames[nextFrameIdx];
            const turnsComplete = nextFrameIdx;
            const turnsLeft = game.frames.length - nextFrameIdx;
            return [
                '\n',
                Bold(game.name),
                ': Waiting on ',
                Bold(nextFrame.person.name),
                `.  ${turnsComplete} turns completed, ${turnsLeft} remaining.`,
            ];
        });

        this.sendMessage(channel, 'The following games are in progress:', ...gameMessages);
    }

    async joinGame(channel: ChannelModel, person: PersonModel, gameName: string): Promise<void> {
        const game = await this.db.getGame(gameName);

        if (!game) {
            throw new GameLogicError('Game ', Bold(gameName), ' does not exist');
        }

        if (game.isComplete) {
            throw new GameLogicError('Game ', Bold(gameName), ' is already complete');
        }

        if (game.frames.find((frame) => frame.person.equals(person))) {
            throw new GameLogicError('You are already in game ', Bold(gameName));
        }

        game.frames.push(FrameModel.create(person));
        await this.db.putGame(game);

        this.sendMessage(channel, 'OK ', Bold(person.name), ', you are now in game ', Bold(gameName));
    }

    async leaveGame(channel: ChannelModel, person: PersonModel, gameName: string): Promise<void> {
        const game = await this.db.getGame(gameName);

        if (!game) {
            throw new GameLogicError('Game ', Bold(gameName), ' does not exist');
        }

        if (game.isComplete) {
            throw new GameLogicError('Game ', Bold(gameName), ' is already complete');
        }

        const frameIdx = game.frames.findIndex((frame) => frame.person.equals(person));

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

    // async shuffleGame(channel: ChannelModel, person: PersonModel, gameName: string): Promise<void> {
    //     const game = await this.db.getGame(gameName);

    //     if (!game) {
    //         throw new GameLogicError('Game ', Bold(gameName), ' does not exist');
    //     }

    //     if (game.isComplete) {
    //         throw new GameLogicError('Game ', Bold(gameName), ' is already complete');
    //     }

    //     const frames = game.frames;

    //     // Shuffle remaining frames
    //     const firstIncompleteFrame = game.frames.findIndex(frame => !frame.isComplete);
    //     if (firstIncompleteFrame < 0) {
    //         // Should never happen
    //         throw new Error("Could not shuffle");
    //     }

    //     // Shuffle
    //     for (let i = frames.length - 1; i > 0; i--) {
    //         const j = Math.floor(Math.random() * (i + 1));
    //         [frames[i], frames[j]] = [frames[j], frames[i]];
    //     }

    //     await this.db.putGame(game);
    //     await this.onFrameDone()

    // }

    private async notifyGame(game: GameModel): Promise<void> {
        // Find frame
        const incompleteFrameIdx = game.frames.findIndex((frame) => !frame.isComplete);
        if (incompleteFrameIdx < 0) {
            return; // Shouldn't happen
        }

        const frame = game.frames[incompleteFrameIdx];

        const warnings = frame.warnings || 0;

        if (warnings == 2) {
            // Drop this person from the game
            game.frames.splice(incompleteFrameIdx, 1);
            await this.db.putGame(game);
            await this.onFrameDone(game, incompleteFrameIdx - 1);

            await this.getBotTarget(frame.person.target).sendDM(
                frame.person,
                'Oh no!  You took too long to play your turn on game ',
                Bold(game.name),
                '!\n',
                `If you'd like to re-join the game, you can use the command `,
                Block(`@epyc join ${game.name}`)
            );

            return;
        }

        // Add one warning ping
        frame.warnings = warnings + 1;
        await this.db.putGame(game);

        await this.getBotTarget(frame.person.target).sendDM(
            frame.person,
            'This is a reminder to play your turn on game ',
            Bold(game.name),
            '!\n',
            `You can go here to play your turn: ${this.getFramePlayUrl(game, frame)}`
        );
    }

    async notifyPlayers(): Promise<void> {
        const games = (await this.db.getGames()).filter((game) => !game.isComplete);

        const promises = games.map((game) => this.notifyGame(game));

        await Promise.all(promises);
    }
}
