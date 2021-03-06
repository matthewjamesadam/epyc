import { BotTarget, ChannelModel, PersonModel } from './Db';
import { GameManagerProvider } from './GameManager';
import { Logger } from './Logger';

enum MessageStyle {
    normal,
    bold,
    block,
}

interface MessageTraits {
    style: MessageStyle;
}

interface Message {
    message: string;
    traits?: MessageTraits;
}

export function Bold(message: string): Message {
    return {
        message,
        traits: { style: MessageStyle.bold },
    };
}

export function Block(message: string): Message {
    return {
        message,
        traits: { style: MessageStyle.block },
    };
}

export type MessageChunk = Message | string;
export type MessageContent = MessageChunk[];

const helpMessage: MessageContent = [
    `🧑🏾‍🎨 `,
    Bold('Eat Poop You Cat'),
    `\n\n`,
    `🤖 Bot Commands:\n`,
    `• `,
    Block(`@epyc start @person1 @person2 @person3 @person4`),
    `: Start a new game in this channel\n`,
    `• `,
    Block(`@epyc status`),
    `: Show the status of all games in this channel\n`,
    `• `,
    Block(`@epyc join <game>`),
    `: Join an in-progress game\n`,
    `• `,
    Block(`@epyc leave <game>`),
    `: Leave an in-progress game\n`,
    `• `,
    Block(`@epyc available`),
    `: Automatically add yourself to all new games in this channel\n`,
    `• `,
    Block(`@epyc unavailable`),
    `: Do not auto-add yourself to all new games in this channel\n`,
    `• `,
    Block(`@epyc prefer author`),
    `: Prefer being an author for each game\n`,
    `• `,
    Block(`@epyc prefer artist`),
    `: Prefer being an artist for each game\n`,
    `• `,
    Block(`@epyc prefer none`),
    `: Be either an artist or author for each game\n`,
    `\n👨🏿‍💻 Go to https://epyc.phlegmatic.ca to see old games!\n`,
];

export class GameLogicError extends Error {
    public messageContent: MessageContent;

    constructor(...messageContent: MessageContent) {
        super(GameLogicError.messageContentToString(messageContent));

        this.messageContent = messageContent;

        // Typescript insanity -- see https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, GameLogicError.prototype);
    }

    static messageContentToString(messageContent: MessageContent) {
        return messageContent
            .map((chunk) => {
                if (typeof chunk === 'string') {
                    return chunk;
                }
                return chunk.message;
            })
            .join('');
    }
}

export interface PersonAvatar {
    url: string;
    width: number;
    height: number;
}

export interface PersonRef {
    id: string;
    target: BotTarget;
    name: string;
}

export interface IBot {
    sendMessage(channel: ChannelModel, ...content: MessageContent): Promise<void>;
    sendDM(person: PersonModel, ...content: MessageContent): Promise<void>;
    getAvatar(person: PersonModel): Promise<PersonAvatar | undefined>;
}

export abstract class Bot implements IBot {
    protected abstract sendStringMessage(channel: ChannelModel, content: string): Promise<void>;
    protected abstract sendStringDM(person: PersonModel, content: string): Promise<void>;
    protected abstract toBold(content: string): string;
    protected abstract toBlock(content: string): string;

    abstract getAvatar(person: PersonModel): Promise<PersonAvatar | undefined>;

    protected gameManager: GameManagerProvider;

    constructor(gameManager: GameManagerProvider) {
        this.gameManager = gameManager;
    }

    private messageToString(content: MessageChunk): string {
        if (typeof content === 'string') {
            return content;
        }

        if (content.traits?.style === MessageStyle.bold) {
            return this.toBold(content.message);
        } else if (content.traits?.style === MessageStyle.block) {
            return this.toBlock(content.message);
        }

        return content.message;
    }

    private messagesToString(...content: MessageContent): string {
        return content.map((chunk) => this.messageToString(chunk)).join('');
    }

    sendMessage(channel: ChannelModel, ...content: MessageContent): Promise<void> {
        const stringContent = this.messagesToString(...content);
        return this.sendStringMessage(channel, stringContent);
    }

    sendDM(person: PersonModel, ...content: MessageContent): Promise<void> {
        const stringContent = this.messagesToString(...content);
        return this.sendStringDM(person, stringContent);
    }

    protected async processMessage(channel: ChannelModel, person: PersonRef, message: string, mentions: PersonRef[]) {
        let allItems = message.split(' ').filter((str) => str.length > 0);

        if (allItems.length < 2) {
            return this.printIDunnoMessage(channel);
        }

        try {
            switch (allItems[1]) {
                case 'help':
                    this.printHelpMessage(channel);
                    break;

                case 'start':
                    await this.startGame(channel, mentions, allItems);
                    break;

                case 'status':
                    await this.gameManager.gameManager.reportStatus(channel);
                    break;

                case 'join':
                    await this.onJoin(channel, person, allItems);
                    break;

                case 'leave':
                    await this.onLeave(channel, person, allItems);
                    break;

                case 'available':
                    await this.gameManager.gameManager.setAvailable(channel, person, true);
                    break;

                case 'unavailable':
                    await this.gameManager.gameManager.setAvailable(channel, person, false);
                    break;

                case 'prefer':
                    await this.onPrefer(channel, person, allItems);
                    break;

                default:
                    this.printIDunnoMessage(channel);
                    break;
            }
        } catch (error) {
            if (error instanceof GameLogicError) {
                this.sendMessage(channel, ...error.messageContent);
            } else {
                Logger.exception(error);
                this.printIDunnoMessage(channel);
            }
        }
    }

    private printHelpMessage(channel: ChannelModel) {
        this.sendMessage(channel, ...helpMessage);
    }

    private printIDunnoMessage(channel: ChannelModel) {
        this.sendMessage(channel, '🧐 huh?  Try ', Block('@epyc help'), ' for help.');
    }

    private async startGame(channel: ChannelModel, players: PersonRef[], allItems: string[]) {
        const includeAvailable = allItems.includes('available');
        await this.gameManager.gameManager.startGame(players, channel, includeAvailable);
    }

    private async onJoin(channel: ChannelModel, person: PersonRef, allItems: string[]) {
        if (allItems.length < 3) {
            return this.printHelpMessage(channel);
        }

        await this.gameManager.gameManager.joinGame(channel, person, allItems[2]);
    }

    private async onLeave(channel: ChannelModel, person: PersonRef, allItems: string[]) {
        if (allItems.length < 3) {
            return this.printHelpMessage(channel);
        }

        await this.gameManager.gameManager.leaveGame(channel, person, allItems[2]);
    }

    private async onPrefer(channel: ChannelModel, person: PersonRef, allItems: string[]) {
        if (allItems.length < 3) {
            return this.printHelpMessage(channel);
        }

        const preference = allItems[2];
        if (preference !== 'author' && preference !== 'artist' && preference !== 'none') {
            return this.printHelpMessage(channel);
        }

        await this.gameManager.gameManager.setRolePreference(channel, person, preference);
    }
}
