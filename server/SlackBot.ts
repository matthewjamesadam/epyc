import { SocketModeClient } from '@slack/socket-mode';
import { WebAPICallResult, WebClient } from '@slack/web-api';
import { InstallProvider } from '@slack/oauth';
import { createEventAdapter, SlackEventAdapter } from '@slack/events-api';
import { Bot, PersonAvatar, PersonRef } from './Bot';
import Cfg from './Cfg';
import { BotTarget, ChannelModel, Db, IDb, PersonModel } from './Db';
import { GameManagerProvider } from './GameManager';
import { RequestListener } from 'http';
import { v4 as uuid } from 'uuid';
import Express from 'express';
import Utils from './Utils';
import { Logger } from './Logger';

const RE_TAG = new RegExp('<@(.+?)>', 'g');

export class SlackBot extends Bot {
    socketMode?: SocketModeClient;
    webClient = new WebClient();
    eventAdapter?: SlackEventAdapter;
    installProvider?: InstallProvider;

    // Map team to bot user IDs
    botUserIds = new Map<string, PersonRef>();

    constructor(private db: IDb, gameManager: GameManagerProvider) {
        super(gameManager);
    }

    async init(): Promise<void> {
        const slackClientId = process.env['SLACK_CLIENT_ID'];
        const slackClientSecret = process.env['SLACK_CLIENT_SECRET'];

        // Initialize the oauth workflow
        if (slackClientId && slackClientSecret) {
            this.installProvider = new InstallProvider({
                clientId: slackClientId,
                clientSecret: slackClientSecret,
                stateSecret: uuid(),
                installationStore: {
                    storeInstallation: async (installation) => {
                        if (installation.isEnterpriseInstall && installation.enterprise?.id) {
                            return this.db.putSlackInstallation(installation.enterprise?.id, installation);
                        }
                        if (installation.team) {
                            return this.db.putSlackInstallation(installation.team.id, installation);
                        }

                        throw new Error('Could not store slack installation');
                    },

                    fetchInstallation: async (installQuery) => {
                        if (installQuery.isEnterpriseInstall && installQuery.enterpriseId) {
                            return await this.db.getSlackInstallation(installQuery.enterpriseId);
                        }
                        if (installQuery.teamId) {
                            return await this.db.getSlackInstallation(installQuery.teamId);
                        }
                        throw new Error('Could not fetch slack installation');
                    },
                },
            });
        } else {
            Logger.log('SLACK_CLIENT_ID or SLACK_CLIENT_SECRET is undefined -- slack oauth disabled.');
        }

        if (Cfg.slackUseSocketApi) {
            const token = process.env['SLACK_SOCKET_TOKEN'];
            // if (!token) {
            //     throw new Error('SLACK_SOCKET_TOKEN is undefined');
            // }

            if (!token) {
                Logger.log('SLACK_SOCKET_TOKEN is undefined');
                return;
            }

            const socketMode = new SocketModeClient({ appToken: token });

            socketMode.on('app_mention', async ({ event, body, ack }) => {
                await ack();
                await this.processSlackMessage(body, event);
            });

            await socketMode.start();

            this.socketMode = socketMode;
        }

        // Use event API
        else {
            const signingSecret = process.env['SLACK_REQUEST_SIGNING_SECRET'];
            // if (!signingSecret) {
            //     throw new Error('SLACK_REQUEST_SIGNING_SECRET is undefined');
            // }

            if (!signingSecret) {
                Logger.log('SLACK_REQUEST_SIGNING_SECRET is undefined');
                return;
            }

            const eventAdapter = createEventAdapter(signingSecret, { includeBody: true });

            eventAdapter.on('app_mention', async (event, body) => {
                await this.processSlackMessage(body, event);
            });

            this.eventAdapter = eventAdapter;
        }

        // this.client.on('error', (err) => {
        //     Logger.exception(err);
        // });
    }

    async deinit() {
        this.socketMode = undefined;
        this.eventAdapter = undefined;
    }

    get requestListener(): RequestListener | undefined {
        return this.eventAdapter?.requestListener();
    }

    installOAuth(req: Express.Request, res: Express.Response) {
        if (!this.installProvider) {
            res.sendStatus(500);
            return;
        }

        this.installProvider
            .generateInstallUrl({
                scopes: [
                    'app_mentions:read',
                    'channels:history',
                    'chat:write',
                    'im:write',
                    'links:write',
                    'users:read',
                ],
            })
            .then((url) => {
                res.redirect(url);
            });
    }

    handleOAuthRequest(req: Express.Request, res: Express.Response) {
        if (!this.installProvider) {
            res.sendStatus(500);
            return;
        }

        this.installProvider.handleCallback(req, res);
    }

    private parseString(value: any): string | undefined {
        if (!value || typeof value !== 'string') {
            return undefined;
        }

        return value;
    }

    private makeId(teamId: string, id: string): string {
        return `${teamId},${id}`;
    }

    private parseId(id: string): { teamId?: string; id?: string } {
        const items = id.split(',');

        if (items.length !== 2) {
            return {};
        }

        return { teamId: items[0], id: items[1] };
    }

    private async getBotUserId(teamId: string, teamToken: string): Promise<PersonRef | undefined> {
        const person = this.botUserIds.get(teamId);
        if (person) {
            return person;
        }

        const res = await this.webClient.auth.test({ token: teamToken });
        if (res.ok) {
            const userId = this.parseString(res['user_id']);
            const name = this.parseString(res['user']);

            if (userId && name) {
                const person: PersonRef = {
                    id: this.makeId(teamId, userId),
                    name,
                    target: BotTarget.slack,
                };
                this.botUserIds.set(teamId, person);
                return person;
            }
        }
    }

    private async resolvePersonRef(teamId: string, teamToken: string, userId: string): Promise<PersonRef | undefined> {
        const result = await this.webClient.users.info({ token: teamToken, user: userId });

        if (result.ok) {
            const user: any = result['user'];
            if (!user || typeof user !== 'object') {
                return;
            }

            const name = user.profile?.display_name || user.profile?.real_name || user.name;

            return {
                id: this.makeId(teamId, userId),
                name: this.parseString(name) || '',
                target: BotTarget.slack,
            };
        }
    }

    private async processSlackMessage(body: any, event: any) {
        const teamId = this.parseString(event.team);
        const text = this.parseString(event.text);
        const channelId = this.parseString(event.channel);
        const authorId = this.parseString(event.user);

        if (!teamId || !text || !channelId || !authorId) {
            return;
        }

        const teamToken = await this.getTeamToken(teamId);
        if (!teamToken) {
            Logger.error(`No token available for team ${teamId} -- cannot process incoming message`);
            return;
        }

        const authorPerson = await this.resolvePersonRef(teamId, teamToken, authorId);
        if (!authorPerson) {
            Logger.error(`Cannot resolve author for event ${teamId} ${authorId}`);
            return;
        }

        const botPerson = await this.getBotUserId(teamId, teamToken);
        if (!botPerson) {
            return;
        }

        const { id: botUserId } = this.parseId(botPerson.id);

        const mentionUserIds =
            text
                .match(RE_TAG)
                ?.map((res) => res.slice(2, -1))
                .filter((res) => res.startsWith('U') || res.startsWith('W'))
                .filter((res) => res !== botUserId) || [];

        const mentionResolved = await Promise.all(
            mentionUserIds.map((userId) => this.resolvePersonRef(teamId, teamToken, userId))
        );
        const mentionPersons = mentionResolved.filter(Utils.notNull);

        const channel = ChannelModel.create(this.makeId(teamId, channelId), '', BotTarget.slack);

        await this.processMessage(channel, authorPerson, text, mentionPersons);
    }

    private async getTeamToken(teamId: string): Promise<string | undefined> {
        return await this.db.getSlackToken(teamId);
    }

    protected async sendStringMessage(channel: ChannelModel, content: string): Promise<void> {
        const { teamId, id: channelId } = this.parseId(channel.id);
        if (!teamId || !channelId) {
            return;
        }

        const token = await this.getTeamToken(teamId);
        if (!token) {
            Logger.error(`No token available for team ${teamId} -- cannot send message to channel ${channel.id}`);
            return;
        }

        try {
            await this.webClient.chat.postMessage({ token, text: content, channel: channelId });
        } catch (error) {
            Logger.exception(error, `Could not send message to channel ${channel.id}`);
        }
    }

    protected async sendStringDM(person: PersonModel, content: string): Promise<void> {
        const { teamId, id: userId } = this.parseId(person.serviceId);
        if (!teamId || !userId) {
            return;
        }

        const token = await this.getTeamToken(teamId);
        if (!token) {
            Logger.error(`No token available for team ${teamId} -- cannot send DM to ${person.name} ${person.id}`);
            return;
        }

        try {
            await this.webClient.chat.postMessage({ token, text: content, channel: userId });
        } catch (error) {
            Logger.exception(error, `Could not send DM to ${person.name} ${person.id}`);
        }
    }

    protected toBold(content: string): string {
        return `*${content}*`;
    }

    protected toBlock(content: string): string {
        return `\`${content}\``;
    }

    async getAvatar(person: PersonModel): Promise<PersonAvatar | undefined> {
        const { teamId, id: userId } = this.parseId(person.serviceId);
        if (!teamId || !userId) {
            return;
        }

        const token = await this.getTeamToken(teamId);
        if (!token) {
            Logger.error(
                `No token available for team ${teamId} -- cannot get avatar for person ${person.name} ${person.id}`
            );
            return;
        }

        let user: WebAPICallResult;
        try {
            user = await this.webClient.users.info({ token, user: userId });
        } catch (error) {
            Logger.exception(
                error,
                `Could not get information for person ${person.name} ${person.id} -- cannot get avatar`
            );
            return;
        }

        if (user.ok) {
            const profile: any = user['user'];
            const imageUrl = this.parseString(profile?.profile?.image_72);

            if (imageUrl) {
                return {
                    url: imageUrl,
                    width: 72,
                    height: 72,
                };
            }
        }
    }
}
