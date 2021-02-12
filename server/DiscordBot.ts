import Discord, { Channel, TextChannel } from 'discord.js';
import { BotTarget, ChannelModel, Db, FrameModel, GameModel, PersonModel } from './Db';
import { ObjectId } from 'mongodb';
import { v4 as uuid } from 'uuid';
import { GameManagerProvider } from './GameManager';

type MessageChannel = Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel;

const helpMessage = `🧑🏾‍🎨 **Eat Poop You Cat**

🤖 Bot Commands:
* \`@epyc start @person1 @person2 @person3 @person4\`: Start a new game in this channel
* \`@epyc status\`: Show the status of all games in this channel

👨🏿‍💻 Go to https://epyc.phlegmatic.ca to see old games!
`;

export interface IBot {
    makeBold(label: string): string;
    sendMessage(channel: ChannelModel, content: string): Promise<void>;
    sendDM(person: PersonModel, content: string): Promise<void>;
}

export class DiscordBot implements IBot {
    client: Discord.Client;
    gameManager: GameManagerProvider;

    constructor(gameManager: GameManagerProvider) {
        this.client = new Discord.Client();
        this.gameManager = gameManager;
    }

    async init(): Promise<void> {
        const token = process.env['DISCORD_BOT_TOKEN'];
        if (!token) {
            throw new Error('DISCORD_BOT_TOKEN is undefined');
        }

        this.client.on('error', (err) => {
            console.log(err);
        });

        this.client.on('message', (message) => {
            if (message.mentions.users.has(this.client.user?.id || '')) {
                this.processMessage(message);
            }
        });

        let promise = new Promise<void>((resolve) => {
            this.client.on('ready', () => {
                resolve();
            });
        });

        this.client.login(token);
        return promise;
    }

    processMessage(message: Discord.Message) {
        let allItems = message.cleanContent.split(' ');

        if (allItems.length < 2) {
            return this.printIDunnoMessage(message.channel);
        }

        switch (allItems[1]) {
            case 'help':
                this.printHelpMessage(message.channel);
                break;
            case 'status':
                this.printStatus(message.channel);
                break;
            case 'start':
                this.startGame(message);
                break;

            default:
                this.printIDunnoMessage(message.channel);
                break;
        }
    }

    printIDunnoMessage(channel: MessageChannel) {
        channel.send('🧐 huh?  Try `@epyc help` for help.');
    }

    printHelpMessage(channel: MessageChannel) {
        channel.send(helpMessage);
    }

    printStatus(channel: MessageChannel) {
        channel.send('Oops, not implemented yet');
    }

    async startGame(message: Discord.Message) {
        const channel = message.channel;

        const channelModel = ChannelModel.create(channel.id, /* FIXME */ 'blah', BotTarget.discord);

        // Collect people
        const players: Array<PersonModel> = message.mentions.users
            .filter((user) => user.id !== this.client.user?.id)
            .map((user) => PersonModel.create(user.id, user.username, BotTarget.discord));

        // FIXME
        while (players.length < 4) {
            players.push(players[0]);
        }

        try {
            await this.gameManager.gameManager.startGame(players, channelModel, BotTarget.discord);
        } catch (error) {
            channel.send('Could not create game.');
            return;
        }
    }

    makeBold(label: string): string {
        return `**${label}**`;
    }

    async sendMessage(channel: ChannelModel, content: string) {
        let discordChannel = await this.client.channels.fetch(channel.id);
        if (!discordChannel.isText) {
            throw new Error('Channel is not a text channel'); // Should never happen, really
            return;
        }

        (discordChannel as TextChannel).send(content);
    }

    async sendDM(person: PersonModel, content: string): Promise<void> {
        try {
            let discordPerson = await this.client.users.fetch(person.id);
            discordPerson.send(content);
        } catch (e) {
            console.log(`Could not send frame message: ${e}`);
        }
    }
}
