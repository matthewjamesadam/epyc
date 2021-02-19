import { BotTarget, ChannelModel, FrameImageModel, FrameModel, GameModel, PersonModel } from './Db';
import { Readable, Writable } from 'stream';
import fs from 'fs';
import { file as makeTmpFile } from 'tmp-promise';
import { Db } from './Db';
import { generateFakeWord } from 'fakelish';
import { Bot, MessageContent, Bold, GameLogicError } from './Bot';
import { FramePlayData } from './api';
import ImageStore from './ImageStore';
import { ImageDecoder } from './ImageDecoder';
import Cfg from './Cfg';

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
        await this.onFrameDone(game, frameIdx);
    }

    private async pipeToStream(input: Readable, output: Writable): Promise<void> {
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

    async playImageTurn(gameName: string, frameId: string, blob: Readable) {
        const { game, frameIdx, frame, parentFrame } = await this.getFrameData(gameName, frameId);

        if (parentFrame?.image || (parentFrame && !parentFrame.title)) {
            throw new Error('Previous turn state is inconsistent');
        }

        const { fd, path, cleanup } = await makeTmpFile();

        try {
            const fileWriteStream = await fs.createWriteStream('', { fd });
            await this.pipeToStream(blob, fileWriteStream);

            const fileReadStream1 = await fs.createReadStream(path);
            const { width, height } = await ImageDecoder.decodeImage(fileReadStream1);

            const fileReadStream2 = await fs.createReadStream(path);
            const { fileName, fileUrl } = await ImageStore.uploadImage(gameName, frameId, fileReadStream2);

            frame.image = FrameImageModel.create(fileUrl, fileName, width, height);

            await this.db.putGame(game);
            await this.onFrameDone(game, frameIdx);
        } finally {
            await this.unlink(path);
        }
    }

    private getGameUrl(game: GameModel) {
        return `${this.urlBase}/game/${game.name}`;
    }

    private async onFrameDone(game: GameModel, frameIdx: number) {
        // If the game is over, mark the game model and tell everyone
        if (frameIdx + 1 >= game.frames.length) {
            game.isComplete = true;
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

    async sendFrameMessage(game: GameModel, frame: FrameModel) {
        this.getBotTarget(frame.person.target).sendDM(
            frame.person,
            `It's your turn to play Eat Poop You Cat!\nYou can go here to play your turn: ${this.urlBase}/play/${game.name}/${frame.id}`
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

        const games = await this.db.getGames();

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
}
