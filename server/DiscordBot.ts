import Discord, { TextChannel } from 'discord.js';
import { Bot, PersonAvatar, PersonRef } from './Bot';
import { BotTarget, ChannelModel, PersonModel } from './Db';
import { GameManagerProvider } from './GameManager';
import Express from 'express';
import { Logger } from './Logger';

export class DiscordBot extends Bot {
    client: Discord.Client;

    constructor(gameManager: GameManagerProvider) {
        super(gameManager);
        this.client = new Discord.Client({
            intents: [
                Discord.Intents.FLAGS.GUILDS,
                Discord.Intents.FLAGS.GUILD_MESSAGES,
                Discord.Intents.FLAGS.DIRECT_MESSAGES,
            ],
        });
    }

    async init(): Promise<void> {
        const token = process.env['DISCORD_BOT_TOKEN'];
        if (!token) {
            throw new Error('DISCORD_BOT_TOKEN is undefined');
        }

        this.client.on('error', (err) => {
            Logger.exception(err);
        });

        this.client.on('messageCreate', (message) => {
            // Match someone mentioning the bot
            if (message.mentions.users.has(this.client.user?.id || '')) {
                this.processDiscordMessage(message);
            }

            // Match someone mentinoing the bot's role
            else if (message.mentions.roles.some((role) => role.tags?.botId == this.client.user?.id)) {
                this.processDiscordMessage(message);
            }
        });

        let promise = new Promise<void>((resolve) => {
            this.client.once('ready', () => {
                resolve();
            });
        });

        await this.client.login(token);
        return promise;
    }

    async deinit() {
        this.client.destroy();
    }

    processDiscordMessage(message: Discord.Message) {
        let channelName = message.channel.type === 'GUILD_TEXT' ? message.channel.name : '';
        const channel = ChannelModel.create(message.channel.id, channelName, BotTarget.discord);
        const person = { id: message.author.id, target: BotTarget.discord, name: message.author.username };

        const mentions: Array<PersonRef> = message.mentions.users
            .filter((user) => user.id !== this.client.user?.id)
            .map((user) => ({ id: user.id, target: BotTarget.discord, name: user.username }));

        this.processMessage(channel, person, message.cleanContent, mentions);
    }

    protected async sendStringMessage(channel: ChannelModel, content: string): Promise<void> {
        let discordChannel = await this.client.channels.fetch(channel.id);
        if (!discordChannel) {
            throw new Error('Channel is null'); // Should never happen, really
            return;
        }

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

    installOAuth(req: Express.Request, res: Express.Response) {
        res.redirect(
            'https://discord.com/api/oauth2/authorize?client_id=799487868987899914&permissions=18432&scope=bot'
        );
    }
}
