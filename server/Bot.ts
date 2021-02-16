import { ChannelModel, PersonModel } from './Db';
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

type MessageChunk = Message | string;
export type MessageContent = MessageChunk[];

const helpMessage: MessageContent = [
    `🧑🏾‍🎨 `,
    Bold('**Eat Poop You Cat**'),
    `\n\n🤖 Bot Commands:\n* `,
    Block(`@epyc start @person1 @person2 @person3 @person4`),
    `: Start a new game in this channel\n* `,
    Block(`@epyc status`),
    `: Show the status of all games in this channel\n\n👨🏿‍💻 Go to https://epyc.phlegmatic.ca to see old games!\n`,
];

export abstract class Bot {
    protected abstract sendStringMessage(channel: ChannelModel, content: string): Promise<void>;
    protected abstract sendStringDM(person: PersonModel, content: string): Promise<void>;
    protected abstract toBold(content: string): string;
    protected abstract toBlock(content: string): string;

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

    processMessage(channel: ChannelModel, message: string, mentions: PersonModel[]) {
        let allItems = message.split(' ');

        if (allItems.length < 2) {
            return this.printIDunnoMessage(channel);
        }

        switch (allItems[1]) {
            case 'help':
                this.printHelpMessage(channel);
                break;
            case 'start':
                this.startGame(channel, mentions);
                break;

            default:
                this.printIDunnoMessage(channel);
                break;
        }
    }

    private printHelpMessage(channel: ChannelModel) {
        this.sendMessage(channel, ...helpMessage);
    }

    private printIDunnoMessage(channel: ChannelModel) {
        this.sendMessage(channel, '🧐 huh?  Try ', Block('@epyc help'), ' for help.');
    }

    private async startGame(channel: ChannelModel, players: PersonModel[]) {
        // FIXME remove
        while (players.length < 4) {
            players.push(players[0]);
        }

        try {
            await this.gameManager.gameManager.startGame(players, channel);
        } catch (error) {
            this.sendMessage(channel, 'Could not create game.');
            return;
        }
    }
}
