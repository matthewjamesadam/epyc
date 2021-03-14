import { BotTarget, ChannelModel, PersonModel } from './Db';
import { GameManagerProvider } from './GameManager';

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
    Bold('**Eat Poop You Cat**'),
    `\n\n`,
    `🤖 Bot Commands:\n`,
    `* `,
    Block(`@epyc start @person1 @person2 @person3 @person4`),
    `: Start a new game in this channel\n`,
    `* `,
    Block(`@epyc status`),
    `: Show the status of all games in this channel\n`,
    `* `,
    Block(`@epyc join <game>`),
    `: Join an in-progress game\n`,
    `* `,
    Block(`@epyc leave <game>`),
    `: Leave an in-progress game\n`,
    `* `,
    Block(`@epyc shuffle <game>`),
    `: Shuffle remaining turns for an in-progress game\n`,
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

export abstract class Bot {
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

    async processMessage(channel: ChannelModel, person: PersonRef, message: string, mentions: PersonRef[]) {
        let allItems = message.split(' ');

        if (allItems.length < 2) {
            return this.printIDunnoMessage(channel);
        }

        try {
            switch (allItems[1]) {
                case 'help':
                    this.printHelpMessage(channel);
                    break;

                case 'start':
                    await this.startGame(channel, mentions);
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

                // case 'shuffle':
                //     this.onShuffle(channel, person, allItems);
                //     break;

                default:
                    this.printIDunnoMessage(channel);
                    break;
            }
        } catch (error) {
            if (error instanceof GameLogicError) {
                this.sendMessage(channel, ...error.messageContent);
            } else {
                console.log(error);
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

    private async startGame(channel: ChannelModel, players: PersonRef[]) {
        await this.gameManager.gameManager.startGame(players, channel);
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

    // private onShuffle(channel: ChannelModel, person: PersonModel, allItems: string[]) {
    //     if (allItems.length < 3) {
    //         return this.printHelpMessage(channel);
    //     }

    //     this.gameManager.gameManager.shuffleGame(channel, person, allItems[2]);
    // }
}
