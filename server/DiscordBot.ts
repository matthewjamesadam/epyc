import Discord, { TextChannel } from 'discord.js';
import { Bot, PersonAvatar, PersonRef } from './Bot';
import { BotTarget, ChannelModel, PersonModel } from './Db';
import { GameManagerProvider } from './GameManager';

export class DiscordBot extends Bot {
    client: Discord.Client;

    constructor(gameManager: GameManagerProvider) {
        super(gameManager);
        this.client = new Discord.Client();
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
                this.processDiscordMessage(message);
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

    async deinit() {
        this.client.destroy();
    }

    processDiscordMessage(message: Discord.Message) {
        let channelName = message.channel.type === 'text' ? message.channel.name : '';
        const channel = ChannelModel.create(message.channel.id, channelName, BotTarget.discord);
        const person = { id: message.author.id, target: BotTarget.discord, name: message.author.username };

        const mentions: Array<PersonRef> = message.mentions.users
            .filter((user) => user.id !== this.client.user?.id)
            .map((user) => ({ id: user.id, target: BotTarget.discord, name: user.username }));

        this.processMessage(channel, person, message.cleanContent, mentions);
    }

    protected async sendStringMessage(channel: ChannelModel, content: string): Promise<void> {
        let discordChannel = await this.client.channels.fetch(channel.id);
        if (!discordChannel.isText) {
            throw new Error('Channel is not a text channel'); // Should never happen, really
            return;
        }

        await (discordChannel as TextChannel).send(content);
    }

    protected async sendStringDM(person: PersonModel, content: string): Promise<void> {
        let discordPerson = await this.client.users.fetch(person.serviceId);
        await discordPerson.send(content);
    }

    protected toBold(content: string): string {
        return `**${content}**`;
    }

    protected toBlock(content: string): string {
        return `\`${content}\``;
    }

    async getAvatar(person: PersonModel): Promise<PersonAvatar | undefined> {
        const discordPerson = await this.client.users.fetch(person.serviceId);
        const url = discordPerson.avatarURL({ format: 'png', size: 64 });
        if (!url) {
            return undefined;
        }

        return { url, width: 64, height: 64 };
    }
}
