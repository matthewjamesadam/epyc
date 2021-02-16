import { BotTarget, ChannelModel, FrameImageModel, FrameModel, GameModel, PersonModel } from './Db';
import { v4 as uuid } from 'uuid';
import { Readable, Writable } from 'stream';
import fs from 'fs';
import { file as makeTmpFile } from 'tmp-promise';
import { Db } from './Db';
import { generateFakeWord } from 'fakelish';
import { Bot, MessageContent, Bold } from './Bot';
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
        const frames: Array<FrameModel> = players.map((player) => FrameModel.create(uuid(), player));

        // FIXME -- for dev testing -- remove at some point!
        if (!Cfg.isProduction) {
            while (frames.length < 4) {
                frames.push(frames[0]);
            }
        }

        if (frames.length < 4) {
            this.sendMessage(channel, 'You need at least 4 people to start a game of EPYC.');
            return;
        }

        let gameName = await generateFakeWord(7, 12);

        let game = GameModel.create(gameName, channel, frames);

        try {
            await this.db.createGame(game);
        } catch (error) {
            console.log(error);
            this.sendMessage(channel, 'Could not create game.');
            return;
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
        await this.onFrameDone(game, frame, frameIdx);
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
            await this.onFrameDone(game, frame, frameIdx);
        } finally {
            await this.unlink(path);
        }
    }

    private getGameUrl(game: GameModel) {
        return `${this.urlBase}/game/${game.name}`;
    }

    private async onFrameDone(game: GameModel, frame: FrameModel, frameIdx: number) {
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
}
